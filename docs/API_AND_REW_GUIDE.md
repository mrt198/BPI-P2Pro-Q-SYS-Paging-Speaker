# SPL REST API & Room EQ Wizard (REW) Guide

## Acoustic Echo Cancellation (AEC) Pipeline

To prevent speaker output from inflating the room noise measurement, `aes67_daemon.py` links the playback and capture GStreamer pipelines:

```text
Playback: udpsrc -> rtpL24depay -> preamp -> equalizer-nbands (8-band PEQ) -> volume -> webrtcechoprobe -> alsasink
Capture:  alsasrc -> level (raw_lvl) -> webrtcdsp (probe=bpi_p2pro_aec_probe) -> level (clean_lvl) -> fakesink
```

Because `webrtcechoprobe` sits **after** the 8-band PEQ and volume stages, `webrtcdsp` receives the exact room-corrected signal sent to the amplifier and cancels speaker bleed cleanly before SPL calculation.

---

## SPL Monitoring REST API

Both the web console (`:3000`) and the Armbian daemon (`:8080`) expose identical SPL monitoring endpoints:

### `GET /api/spl`

Returns instantaneous post-AEC ambient SPL, raw pre-AEC mic SPL, Echo Return Loss Enhancement (`aec_erle_db`), and adaptive boost:

```bash
curl -s http://localhost:3000/api/spl
```

```json
{
  "unit_id": "bpi-p2pro-foh-01",
  "hostname": "spk-foh-west-01.venue.local",
  "zone": "FOH",
  "room_name": "Main FOH Lobby",
  "ambient_spl_dba": 65.7,
  "raw_mic_spl_dba": 74.1,
  "speaker_contribution_dba": 73.6,
  "aec_enabled": true,
  "aec_engine": "webrtc_dsp",
  "aec_erle_db": 20.5,
  "adaptive_boost_db": 5.0,
  "effective_output_db": -7.0,
  "amp_active": true,
  "timestamp": "2026-11-15T15:35:40.089Z"
}
```

### `GET /api/spl/history`

Returns the rolling time-series sample buffer (`ambientSplDba`, `rawMicDba`, `speakerContributionDba`, `erleDb`, `adaptiveBoostDb`).

### `GET /api/spl/metrics`

Prometheus-compatible text exposition format for Grafana / Prometheus / Zabbix scraping:

```text
# HELP aes67_room_spl_dba Ambient Room SPL in dBA after Acoustic Echo Cancellation
# TYPE aes67_room_spl_dba gauge
aes67_room_spl_dba{unit="bpi-p2pro-foh-01",zone="FOH",room="Main FOH Lobby"} 65.7
aes67_mic_raw_dba{unit="bpi-p2pro-foh-01",zone="FOH",room="Main FOH Lobby"} 74.1
aes67_aec_erle_db{unit="bpi-p2pro-foh-01",zone="FOH",room="Main FOH Lobby"} 20.5
aes67_adaptive_boost_db{unit="bpi-p2pro-foh-01",zone="FOH",room="Main FOH Lobby"} 5
```

---

## Room EQ Wizard (REW) 8-Band Parametric EQ

### Importing from REW

1. Measure the speaker response in **Room EQ Wizard (REW)** using your calibrated measurement mic.
2. In REW's **EQ** window, set Equaliser to **Generic**, limit active filters to **8**, and click **Export filter settings as text**.
3. In the web console under **Room EQ (8-Band PEQ)**, click **Import REW (.txt)** to upload or paste the exported file, or push it directly over HTTP:

```bash
curl -X POST http://localhost:3000/api/peq/import-rew \
  -H "Content-Type: application/json" \
  -d '{"filename":"FOH_Lobby_REW.txt","rewText":"Preamp: -3.2 dB\nFilter 1: ON PK Fc 128.0 Hz Gain -6.10 dB Q 4.800"}'
```

### Exporting to REW Format

Download the active 8-band filter bank in REW-compatible `.txt` format via `GET /api/peq/export-rew`.
