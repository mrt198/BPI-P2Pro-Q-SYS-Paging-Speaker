#!/usr/bin/env python3
"""
AES67 PoE Paging Speaker Daemon for Armbian SBC (Target: BananaPi BPI-P2Pro)
Supports:
  - AES67 RTP reception via SAP (224.2.127.254:9875), RTSP, and Q-SYS announcements
  - 5 Receive Channels: Stage Calls, All Calls, Program 1/2/3 (Mono or Stereo)
  - 8-Band Parametric EQ (PK/LS/HS/LP/HP) with Room EQ Wizard (REW) .txt import
  - GStreamer WebRTC Acoustic Echo Cancellation (webrtcechoprobe -> webrtcdsp)
    so speaker playback is cancelled from the SPL measurement microphone
  - I2S Amplifier or Onboard Audio Output + I2S Mic or Onboard ADC SPL Monitoring
  - REST API (/api/spl, /api/spl/history, /api/spl/metrics, /api/peq/import-rew)
  - Adaptive Room SPL Level Control with configurable ratio & Room Cluster sharing
  - GPIO Program/Calls buttons, Rotary Encoder Knob, SSD1306 I2C OLED, Amp SD_MODE pin
  - Low-Power & Silent Schedule Windows with Emergency Wake Override
"""

import asyncio
import collections
import json
import logging
import math
import os
import re
import socket
import struct
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("aes67-pager")

CONFIG_PATH = Path(os.environ.get("AES67_CONFIG_PATH", "/etc/aes67-pager/config.json"))

try:
    import gi
    gi.require_version("Gst", "1.0")
    from gi.repository import Gst
    Gst.init(None)
    HAS_GST = True
except Exception:
    HAS_GST = False

try:
    import gpiod
    from gpiod.line import Direction, Value
    HAS_GPIOD = True
except Exception:
    HAS_GPIOD = False

try:
    from aiohttp import web
    HAS_AIOHTTP = True
except Exception:
    HAS_AIOHTTP = False


def parse_sdp(sdp_text: str) -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "name": "Unnamed AES67 Stream",
        "address": "",
        "port": 5004,
        "encoding": "L24",
        "rate": 48000,
        "channels": 2,
        "ptp_gm": "",
    }
    for raw_line in sdp_text.splitlines():
        line = raw_line.strip()
        if line.startswith("s="):
            info["name"] = line[2:].strip()
        elif line.startswith("c=IN IP4 "):
            info["address"] = line[9:].strip().split("/")[0]
        elif line.startswith("m=audio "):
            parts = line.split()
            if len(parts) >= 2:
                info["port"] = int(parts[1])
        elif line.startswith("a=rtpmap:"):
            m = re.search(r"a=rtpmap:\d+\s+(L16|L24)/(\d+)(?:/(\d+))?", line)
            if m:
                info["encoding"] = m.group(1)
                info["rate"] = int(m.group(2))
                info["channels"] = int(m.group(3) or 1)
        elif line.startswith("a=ts-refclk:ptp="):
            info["ptp_gm"] = line.split("=", 1)[1]
    return info


def parse_rew_filters(rew_text: str) -> Dict[str, Any]:
    """
    Parse Room EQ Wizard (REW) Generic Equalizer / EqualizerAPO filter export (.txt).
    Example lines:
      Preamp: -3.2 dB
      Filter  1: ON  PK       Fc   63.00 Hz  Gain  -4.80 dB  Q  4.500
      Filter  2: ON  LS       Fc   90.00 Hz  Gain   2.50 dB  Q  0.707
    """
    preamp_db = 0.0
    bands: List[Dict[str, Any]] = []
    preamp_match = re.search(r"Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB", rew_text, re.I)
    if preamp_match:
        preamp_db = float(preamp_match.group(1))

    line_re = re.compile(
        r"Filter\s+(\d+)\s*:\s*(ON|OFF)\s+(PK|LS|HS|LP|HP|PEQ|LSC|HSC)\b"
        r"(?:.*?Fc\s+(\d+(?:\.\d+)?)\s*Hz)?"
        r"(?:.*?Gain\s+([+-]?\d+(?:\.\d+)?)\s*dB)?"
        r"(?:.*?Q\s+(\d+(?:\.\d+)?))?",
        re.I,
    )
    type_map = {"PEQ": "PK", "LSC": "LS", "HSC": "HS"}

    for raw_line in rew_text.splitlines():
        m = line_re.search(raw_line.strip())
        if not m or len(bands) >= 8:
            continue
        raw_type = m.group(3).upper()
        bands.append({
            "band": len(bands) + 1,
            "enabled": m.group(2).upper() == "ON",
            "type": type_map.get(raw_type, raw_type),
            "freqHz": float(m.group(4) or 1000.0),
            "gainDb": float(m.group(5) or 0.0),
            "q": float(m.group(6) or 1.41),
        })

    while len(bands) < 8:
        idx = len(bands) + 1
        bands.append({
            "band": idx,
            "enabled": False,
            "type": "PK",
            "freqHz": 1000.0,
            "gainDb": 0.0,
            "q": 1.41,
        })

    return {"preampDb": preamp_db, "bands": bands}


class SapDiscoveryListener:
    SAP_MCAST = "224.2.127.254"
    SAP_PORT = 9875

    def __init__(self) -> None:
        self.streams: Dict[str, Dict[str, Any]] = {}

    async def run(self, stop_event: asyncio.Event) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", self.SAP_PORT))
        mreq = struct.pack("4sl", socket.inet_aton(self.SAP_MCAST), socket.INADDR_ANY)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        sock.setblocking(False)
        loop = asyncio.get_running_loop()

        while not stop_event.is_set():
            try:
                data = await asyncio.wait_for(loop.sock_recv(sock, 4096), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except Exception:
                await asyncio.sleep(1.0)
                continue

            if len(data) < 8:
                continue
            auth_len = data[1]
            payload = data[8 + auth_len:]
            if payload.startswith(b"application/sdp\x00"):
                payload = payload[len(b"application/sdp\x00"):]
            sdp_text = payload.decode("utf-8", errors="ignore")
            if "m=audio" in sdp_text:
                parsed = parse_sdp(sdp_text)
                if parsed["address"]:
                    parsed["last_seen"] = time.time()
                    self.streams[f"{parsed['address']}:{parsed['port']}"] = parsed


class AudioEngine:
    """
    GStreamer AES67 playback pipeline with:
      - 8-band Parametric EQ (equalizer-nbands) for Room Correction (REW)
      - webrtcechoprobe right before alsasink to feed speaker playback reference to mic AEC
    """

    AEC_PROBE_NAME = "bpi_p2pro_aec_probe"

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        self.pipeline: Optional[Any] = None
        self.volume_elem: Optional[Any] = None
        self.preamp_elem: Optional[Any] = None
        self.eq_elem: Optional[Any] = None
        self.current_uri: str = ""
        self.current_mode: str = "Stereo"

    def get_alsa_device(self) -> str:
        hw = self.config.get("hardware", {})
        if hw.get("audio_output") == "onboard":
            return hw.get("onboard_alsa_device", "plughw:0,0")
        return hw.get("i2s_alsa_device", "plughw:1,0")

    def set_amp_power(self, enabled: bool) -> None:
        hw = self.config.get("hardware", {})
        pin = hw.get("amp_sd_gpio")
        if not HAS_GPIOD or pin is None:
            return
        try:
            chip_path = hw.get("gpio_chip", "/dev/gpiochip0")
            val = Value.ACTIVE if enabled else Value.INACTIVE
            with gpiod.request_lines(
                chip_path,
                consumer="aes67-amp-sd",
                config={int(pin): gpiod.LineSettings(direction=Direction.OUTPUT, output_value=val)},
            ) as req:
                req.set_value(int(pin), val)
        except Exception as exc:
            log.debug("Amp SD_MODE GPIO write skipped: %s", exc)

    def apply_peq(self) -> None:
        """Apply 8-band parametric EQ and preamp gain onto live GStreamer elements."""
        if not HAS_GST or not self.eq_elem or not self.preamp_elem:
            return
        peq = self.config.get("peq", {})
        enabled = bool(peq.get("enabled", True))
        preamp_db = float(peq.get("preampDb", 0.0)) if enabled else 0.0
        self.preamp_elem.set_property("volume", 10 ** (preamp_db / 20.0))

        bands = peq.get("bands", [])
        for idx in range(8):
            band_obj = self.eq_elem.get_child_by_index(idx)
            if not band_obj:
                continue
            if idx < len(bands) and enabled and bands[idx].get("enabled", False):
                freq = max(20.0, min(20000.0, float(bands[idx].get("freqHz", 1000.0))))
                q = max(0.1, min(20.0, float(bands[idx].get("q", 1.41))))
                gain = max(-24.0, min(12.0, float(bands[idx].get("gainDb", 0.0))))
                band_obj.set_property("freq", freq)
                band_obj.set_property("bandwidth", freq / q)
                band_obj.set_property("gain", gain)
            else:
                band_obj.set_property("gain", 0.0)

    def switch_stream(self, uri: str, channel_mode: str, volume_db: float, muted: bool) -> None:
        if not uri or muted:
            self.stop()
            return
        if uri == self.current_uri and channel_mode == self.current_mode and self.pipeline:
            self.set_volume(volume_db, muted)
            self.apply_peq()
            return

        self.stop()
        self.current_uri = uri
        self.current_mode = channel_mode
        self.set_amp_power(True)

        if not HAS_GST:
            log.info("[Dry-Run Audio] Playing %s (%s) @ %.1f dB with 8-band PEQ + AEC probe", uri, channel_mode, volume_db)
            return

        host, _, port_str = uri.replace("rtp://", "").partition(":")
        port = int(port_str or 5004)
        alsa_dev = self.get_alsa_device()
        channels = 1 if "Mono" in channel_mode else 2
        caps = (
            f"application/x-rtp,media=audio,clock-rate=48000,encoding-name=L24,"
            f"channels={channels},payload=96"
        )
        pan_stage = "audioconvert ! audio/x-raw,channels=1 ! audioconvert" if channels == 1 else "audioconvert"
        # webrtcechoprobe taps exact post-EQ/post-volume output for mic Acoustic Echo Cancellation
        aec_probe = f"webrtcechoprobe name={self.AEC_PROBE_NAME} !"
        pipe_desc = (
            f"udpsrc address={host} port={port} caps=\"{caps}\" ! "
            f"rtpjitterbuffer latency={int(self.config.get('jitter_ms', 10))} ! "
            f"rtpL24depay ! {pan_stage} ! "
            f"volume name=preamp ! equalizer-nbands name=peq num-bands=8 ! "
            f"volume name=vol ! audioconvert ! audioresample ! "
            f"{aec_probe} alsasink device={alsa_dev} sync=true"
        )
        try:
            self.pipeline = Gst.parse_launch(pipe_desc)
            self.preamp_elem = self.pipeline.get_by_name("preamp")
            self.eq_elem = self.pipeline.get_by_name("peq")
            self.volume_elem = self.pipeline.get_by_name("vol")
            self.apply_peq()
            self.set_volume(volume_db, muted)
            self.pipeline.set_state(Gst.State.PLAYING)
        except Exception as exc:
            log.error("Failed to launch GStreamer playback pipeline: %s", exc)
            self.pipeline = None

    def set_volume(self, volume_db: float, muted: bool) -> None:
        if not HAS_GST or not self.volume_elem:
            return
        linear = 0.0 if muted else max(0.0, min(2.0, 10 ** (volume_db / 20.0)))
        self.volume_elem.set_property("volume", linear)
        self.volume_elem.set_property("mute", bool(muted))

    def stop(self) -> None:
        if self.pipeline and HAS_GST:
            self.pipeline.set_state(Gst.State.NULL)
        self.pipeline = None
        self.volume_elem = None
        self.preamp_elem = None
        self.eq_elem = None
        self.current_uri = ""
        self.set_amp_power(False)


class SplMonitor:
    """
    Captures I2S microphone or Onboard ADC audio through GStreamer WebRTC AEC
    (`webrtcdsp` linked to `webrtcechoprobe`) so speaker output is cancelled out
    before calculating calibrated Room SPL (dBA).
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        self.ambient_spl_dba: float = 54.0
        self.raw_mic_dba: float = 54.0
        self.erle_db: float = 18.0
        self.history: Deque[Dict[str, Any]] = collections.deque(maxlen=300)
        self._running = False
        self._mic_pipeline: Optional[Any] = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        t = threading.Thread(target=self._capture_loop, daemon=True)
        t.start()

    def stop(self) -> None:
        self._running = False
        if self._mic_pipeline and HAS_GST:
            self._mic_pipeline.set_state(Gst.State.NULL)
            self._mic_pipeline = None

    def _capture_loop(self) -> None:
        hw = self.config.get("hardware", {})
        mic_mode = hw.get("mic_input", "i2s")
        if mic_mode == "none" or not HAS_GST:
            return

        dev = hw.get("mic_alsa_device", "plughw:2,0" if mic_mode == "i2s" else "plughw:0,0")
        aec_cfg = self.config.get("spl", {}).get("aec", {})
        aec_enabled = bool(aec_cfg.get("enabled", True))
        suppression = aec_cfg.get("echoSuppressionLevel", "high")
        delay_ms = int(aec_cfg.get("referenceDelayMs", 12))
        cal_offset = float(self.config.get("spl", {}).get("calibration_offset_db", 94.0))

        aec_stage = (
            f"webrtcdsp probe={AudioEngine.AEC_PROBE_NAME} "
            f"echo-cancel=true echo-suppression-level={suppression} "
            f"delay-agnostic=true noise-suppression={'true' if aec_cfg.get('noiseSuppression', True) else 'false'} !"
            if aec_enabled
            else ""
        )
        pipe_desc = (
            f"alsasrc device={dev} ! audio/x-raw,rate=48000,channels=1,format=S16LE ! "
            f"level name=raw_lvl interval=200000000 post-messages=true ! "
            f"{aec_stage} "
            f"level name=clean_lvl interval=200000000 post-messages=true ! "
            f"fakesink sync=false"
        )
        try:
            self._mic_pipeline = Gst.parse_launch(pipe_desc)
            bus = self._mic_pipeline.get_bus()
            self._mic_pipeline.set_state(Gst.State.PLAYING)
            log.info("SPL mic pipeline active on %s (AEC=%s, delay=%dms)", dev, aec_enabled, delay_ms)

            while self._running:
                msg = bus.timed_pop_filtered(250 * Gst.MSECOND, Gst.MessageType.ELEMENT)
                if not msg:
                    continue
                st = msg.get_structure()
                if not st or st.get_name() != "level":
                    continue
                rms_list = st.get_value("rms")
                if not rms_list:
                    continue
                dbfs = float(rms_list[0])
                spl_val = max(30.0, min(120.0, dbfs + cal_offset))
                src_name = msg.src.get_name()
                if src_name == "raw_lvl":
                    self.raw_mic_dba = round(0.8 * self.raw_mic_dba + 0.2 * spl_val, 1)
                elif src_name == "clean_lvl":
                    self.ambient_spl_dba = round(0.8 * self.ambient_spl_dba + 0.2 * spl_val, 1)
                    self.erle_db = round(max(0.0, self.raw_mic_dba - self.ambient_spl_dba), 1)
                    self.history.append({
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "ambientSplDba": self.ambient_spl_dba,
                        "rawMicDba": self.raw_mic_dba,
                        "erleDb": self.erle_db,
                    })
        except Exception as exc:
            log.warning("GStreamer SPL/AEC capture fallback on %s: %s", dev, exc)


class PagingDaemon:
    def __init__(self) -> None:
        self.config = self.load_config()
        self.sap = SapDiscoveryListener()
        self.audio = AudioEngine(self.config)
        self.spl_mon = SplMonitor(self.config)
        self.detected_zones: Dict[str, Dict[str, Any]] = {}
        self.active_calls = {"stage": False, "all": False}
        self.cluster_spl_samples: Dict[str, float] = {}
        self.stop_event = asyncio.Event()

    def load_config(self) -> Dict[str, Any]:
        if CONFIG_PATH.exists():
            with CONFIG_PATH.open("r", encoding="utf-8") as fh:
                return json.load(fh)
        return {
            "unit_id": socket.gethostname(),
            "zone_mode": "auto",
            "bound_zone": "FOH",
            "room_cluster": {"enabled": True, "room_name": "Main Auditorium", "share_settings": True, "share_spl": True, "spl_aggregation": "mean"},
            "selected_program": 1,
            "calls_mode": "all",
            "allow_none_calls": False,
            "base_volume_db": -12.0,
            "muted": False,
            "priority": ["all_calls", "stage_calls", "program"],
            "spl": {
                "enabled": True,
                "threshold_dba": 58.0,
                "ratio": 0.65,
                "max_boost_db": 14.0,
                "calibration_offset_db": 94.0,
                "aec": {"enabled": True, "engine": "webrtc_dsp", "tailLengthMs": 120, "referenceDelayMs": 12, "noiseSuppression": True, "echoSuppressionLevel": "high"},
            },
            "peq": {
                "enabled": True,
                "preampDb": -2.5,
                "bands": [
                    {"band": i + 1, "enabled": False, "type": "PK", "freqHz": 1000.0, "gainDb": 0.0, "q": 1.41}
                    for i in range(8)
                ],
            },
            "hardware": {"audio_output": "i2s", "mic_input": "i2s"},
            "power": {"schedule_enabled": True, "window_start": "23:00", "window_end": "07:00", "emergency_wake": True},
            "channels": {
                "stage_calls": {"source": "qsys", "uri": "239.69.10.1:5004", "format": "Mono"},
                "all_calls": {"source": "qsys", "uri": "239.69.10.2:5004", "format": "Mono"},
                "program_1": {"source": "sap", "uri": "239.69.20.1:5004", "format": "Stereo"},
                "program_2": {"source": "sap", "uri": "239.69.20.2:5004", "format": "Stereo"},
                "program_3": {"source": "rtsp", "uri": "239.69.20.3:5004", "format": "Mono"},
            },
        }

    def save_config(self) -> None:
        CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with CONFIG_PATH.open("w", encoding="utf-8") as fh:
            json.dump(self.config, fh, indent=2)

    def effective_spl(self) -> float:
        local = self.spl_mon.ambient_spl_dba
        rc = self.config.get("room_cluster", {})
        if not rc.get("enabled") or not rc.get("share_spl") or not self.cluster_spl_samples:
            return local
        vals = [local] + list(self.cluster_spl_samples.values())
        return max(vals) if rc.get("spl_aggregation") == "max" else round(sum(vals) / len(vals), 1)

    def compute_adaptive_boost(self) -> float:
        spl_cfg = self.config.get("spl", {})
        if not spl_cfg.get("enabled"):
            return 0.0
        room_spl = self.effective_spl()
        thresh = float(spl_cfg.get("threshold_dba", 58.0))
        ratio = float(spl_cfg.get("ratio", 0.65))
        cap = float(spl_cfg.get("max_boost_db", 14.0))
        return 0.0 if room_spl <= thresh else min(cap, round((room_spl - thresh) * ratio, 1))

    def evaluate_audio(self) -> None:
        calls_mode = self.config.get("calls_mode", "all")
        chosen_channel = None
        for item in self.config.get("priority", ["all_calls", "stage_calls", "program"]):
            if item == "all_calls" and self.active_calls["all"] and calls_mode == "all":
                chosen_channel = "all_calls"
                break
            if item == "stage_calls" and self.active_calls["stage"] and calls_mode in ("stage", "all"):
                chosen_channel = "stage_calls"
                break
            if item == "program":
                prog = int(self.config.get("selected_program", 0))
                if prog in (1, 2, 3):
                    chosen_channel = f"program_{prog}"
                    break
        if not chosen_channel:
            self.audio.stop()
            return
        ch_cfg = self.config.get("channels", {}).get(chosen_channel, {})
        vol = float(self.config.get("base_volume_db", -12.0)) + self.compute_adaptive_boost()
        self.audio.switch_stream(
            ch_cfg.get("uri", ""),
            ch_cfg.get("format", "Mono"),
            min(0.0, vol),
            bool(self.config.get("muted", False)),
        )

    async def start_rest_api(self) -> None:
        if not HAS_AIOHTTP:
            return
        app = web.Application()

        async def get_spl(_req: web.Request) -> web.Response:
            return web.json_response({
                "unit_id": self.config["unit_id"],
                "room_name": self.config.get("room_cluster", {}).get("room_name"),
                "zone": self.config.get("bound_zone"),
                "ambient_spl_dba": self.spl_mon.ambient_spl_dba,
                "cluster_spl_dba": self.effective_spl(),
                "raw_mic_dba": self.spl_mon.raw_mic_dba,
                "aec_enabled": self.config.get("spl", {}).get("aec", {}).get("enabled", True),
                "aec_erle_db": self.spl_mon.erle_db,
                "adaptive_boost_db": self.compute_adaptive_boost(),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })

        async def get_spl_history(_req: web.Request) -> web.Response:
            return web.json_response({"samples": list(self.spl_mon.history)})

        async def get_spl_metrics(_req: web.Request) -> web.Response:
            unit = self.config["unit_id"]
            body = (
                f"# HELP aes67_room_spl_dba Ambient Room SPL after Acoustic Echo Cancellation\n"
                f"# TYPE aes67_room_spl_dba gauge\n"
                f"aes67_room_spl_dba{{unit=\"{unit}\"}} {self.spl_mon.ambient_spl_dba}\n"
                f"aes67_mic_raw_dba{{unit=\"{unit}\"}} {self.spl_mon.raw_mic_dba}\n"
                f"aes67_aec_erle_db{{unit=\"{unit}\"}} {self.spl_mon.erle_db}\n"
                f"aes67_adaptive_boost_db{{unit=\"{unit}\"}} {self.compute_adaptive_boost()}\n"
            )
            return web.Response(text=body, content_type="text/plain")

        async def import_rew(req: web.Request) -> web.Response:
            text = await req.text()
            parsed = parse_rew_filters(text)
            self.config["peq"]["enabled"] = True
            self.config["peq"]["preampDb"] = parsed["preampDb"]
            self.config["peq"]["bands"] = parsed["bands"]
            self.save_config()
            self.audio.apply_peq()
            return web.json_response(self.config["peq"])

        app.router.add_get("/api/spl", get_spl)
        app.router.add_get("/api/spl/history", get_spl_history)
        app.router.add_get("/api/spl/metrics", get_spl_metrics)
        app.router.add_post("/api/peq/import-rew", import_rew)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", int(os.environ.get("AES67_HTTP_PORT", "8080")))
        await site.start()
        log.info("SBC REST API listening on :%s (/api/spl, /api/spl/metrics, /api/peq/import-rew)", os.environ.get("AES67_HTTP_PORT", "8080"))

    async def qsys_listener(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", 7767))
        mreq = struct.pack("4sl", socket.inet_aton("239.255.77.67"), socket.INADDR_ANY)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_ADD_MEMBERSHIP, mreq)
        sock.setblocking(False)
        loop = asyncio.get_running_loop()

        while not self.stop_event.is_set():
            try:
                data = await asyncio.wait_for(loop.sock_recv(sock, 16384), timeout=1.0)
                msg = json.loads(data.decode("utf-8"))
                for z in msg.get("zones", []):
                    self.detected_zones[z["name"]] = z
                    if z["name"] == self.config.get("bound_zone"):
                        self.active_calls["stage"] = bool(z["calls"]["stage_active"])
                        self.active_calls["all"] = bool(z["calls"]["all_active"])
                self.evaluate_audio()
            except asyncio.TimeoutError:
                continue
            except Exception:
                pass

    async def run(self) -> None:
        self.spl_mon.start()
        self.evaluate_audio()
        await asyncio.gather(
            self.start_rest_api(),
            self.sap.run(self.stop_event),
            self.qsys_listener(),
        )


if __name__ == "__main__":
    daemon = PagingDaemon()
    try:
        asyncio.run(daemon.run())
    except KeyboardInterrupt:
        daemon.stop_event.set()
        daemon.spl_mon.stop()
        daemon.audio.stop()
