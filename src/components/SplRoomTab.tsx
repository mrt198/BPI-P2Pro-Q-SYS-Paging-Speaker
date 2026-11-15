import React, { useState } from 'react';
import { Check, Copy, Plus, RefreshCw } from 'lucide-react';
import type {
  AecEngine,
  AudioOutputType,
  MicInputType,
  SpeakerConfig,
  SplAggregation,
  SystemStateResponse,
} from '../types';

interface SplRoomTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
  onAddPeer: (hasMic: boolean, hasControls: boolean) => void;
  onUpdatePeerSpl: (unitId: string, splDba: number) => void;
  onRefreshState: () => void;
}

export const SplRoomTab: React.FC<SplRoomTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
  onAddPeer,
  onUpdatePeerSpl,
  onRefreshState,
}) => {
  const { config, runtime, roomPeers, splHistory } = state;
  const [apiPreview, setApiPreview] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  // Build SVG transfer curve points from 40 dBA to 100 dBA
  const points: string[] = [];
  const w = 420;
  const h = 150;
  const padL = 36;
  const padB = 22;
  const plotW = w - padL - 12;
  const plotH = h - padB - 12;

  for (let spl = 40; spl <= 100; spl += 2) {
    const boost =
      config.spl.enabled && spl > config.spl.thresholdDba
        ? Math.min(config.spl.maxBoostDb, (spl - config.spl.thresholdDba) * config.spl.ratio)
        : 0;
    const x = padL + ((spl - 40) / 60) * plotW;
    const y = 12 + plotH - (boost / 20) * plotH;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const curX =
    padL + ((Math.max(40, Math.min(100, runtime.effectiveSplDba)) - 40) / 60) * plotW;
  const curY = 12 + plotH - (Math.min(20, runtime.adaptiveBoostDb) / 20) * plotH;

  // Build rolling SPL history SVG (Ambient Post-AEC vs Raw Pre-AEC)
  const histSamples = splHistory.slice(-24);
  const hw = 480;
  const hh = 130;
  const hPadL = 34;
  const hPadB = 18;
  const hPlotW = hw - hPadL - 10;
  const hPlotH = hh - hPadB - 10;

  const mapSplY = (val: number) => {
    const clamped = Math.max(40, Math.min(95, val));
    return 10 + hPlotH - ((clamped - 40) / 55) * hPlotH;
  };

  const ambientPts = histSamples
    .map((s, idx) => {
      const x = hPadL + (idx / Math.max(1, histSamples.length - 1)) * hPlotW;
      return `${x.toFixed(1)},${mapSplY(s.ambientSplDba).toFixed(1)}`;
    })
    .join(' ');

  const rawPts = histSamples
    .map((s, idx) => {
      const x = hPadL + (idx / Math.max(1, histSamples.length - 1)) * hPlotW;
      return `${x.toFixed(1)},${mapSplY(s.rawMicDba).toFixed(1)}`;
    })
    .join(' ');

  const handleTestSplEndpoint = async (endpoint: '/api/spl' | '/api/spl/metrics') => {
    try {
      const res = await fetch(endpoint);
      const text = await res.text();
      setApiPreview(text);
      onRefreshState();
    } catch {
      setApiPreview('Failed to query endpoint.');
    }
  };

  const handleCopyCurl = async (endpoint: string) => {
    const cmd = `curl -s ${window.location.origin}${endpoint}`;
    await navigator.clipboard.writeText(cmd);
    setCopiedEndpoint(endpoint);
    setTimeout(() => setCopiedEndpoint(null), 1600);
  };

  return (
    <div className="space-y-6">
      {/* Audio Input / Output Hardware */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            SBC Audio Output & SPL Microphone Interface
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select I2S amplifier/microphone overlays or onboard RK3308 codec/ADC when fitted.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Speaker Output Hardware */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              Speaker Output Driver
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-md">
              {(['i2s', 'onboard'] as AudioOutputType[]).map((outType) => (
                <button
                  key={outType}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() =>
                    onUpdateConfig({
                      hardware: { ...config.hardware, audioOutput: outType },
                    })
                  }
                  className={`py-2 px-3 text-xs font-medium rounded transition-colors ${
                    config.hardware.audioOutput === outType
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  } disabled:opacity-50`}
                >
                  {outType === 'i2s' ? 'I2S Amplifier HAT' : 'Onboard Audio Out'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">DAC / Amp IC</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={config.hardware.i2sAmpModel}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: { ...config.hardware, i2sAmpModel: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">ALSA Playback Device</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={
                    config.hardware.audioOutput === 'i2s'
                      ? config.hardware.i2sAlsaDevice
                      : config.hardware.onboardAlsaDevice
                  }
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        [config.hardware.audioOutput === 'i2s'
                          ? 'i2sAlsaDevice'
                          : 'onboardAlsaDevice']: e.target.value,
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Microphone Input Hardware */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-700">
              Room SPL Microphone Input
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-md">
              {(['i2s', 'onboard', 'none'] as MicInputType[]).map((micType) => (
                <button
                  key={micType}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() =>
                    onUpdateConfig({
                      hardware: { ...config.hardware, micInput: micType },
                    })
                  }
                  className={`py-2 px-2 text-xs font-medium rounded transition-colors ${
                    config.hardware.micInput === micType
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  } disabled:opacity-50`}
                >
                  {micType === 'i2s'
                    ? 'I2S MEMS Mic'
                    : micType === 'onboard'
                    ? 'Onboard ADC'
                    : 'None (Cluster)'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Capture ALSA Device</label>
                <input
                  type="text"
                  disabled={!isAdmin || config.hardware.micInput === 'none'}
                  value={config.hardware.micAlsaDevice}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: { ...config.hardware, micAlsaDevice: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="text-slate-500 block mb-1">Mic Calibration Offset (dB)</label>
                <input
                  type="number"
                  disabled={!isAdmin || config.hardware.micInput === 'none'}
                  value={config.spl.calibrationOffsetDb}
                  onChange={(e) =>
                    onUpdateConfig({
                      spl: {
                        ...config.spl,
                        calibrationOffsetDb: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Acoustic Echo Cancellation (AEC) on Mic */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Microphone Acoustic Echo Cancellation (AEC)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cancels speaker playback reference (GStreamer webrtcechoprobe → webrtcdsp) from the mic signal before SPL measurement so speaker output never inflates room noise readings.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={config.spl.aec.enabled}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    aec: { ...config.spl.aec, enabled: e.target.checked },
                  },
                })
              }
              className="accent-blue-600 h-4 w-4"
            />
            <span>AEC Active</span>
          </label>
        </div>

        {/* Live AEC Comparison Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 border border-slate-200 rounded-md divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-50">
          <div className="p-3">
            <div className="text-[11px] text-slate-500">Raw Mic Input (Pre-AEC)</div>
            <div className="text-lg font-mono font-semibold text-slate-900 mt-0.5">
              {runtime.rawMicSplDba.toFixed(1)} dBA
            </div>
          </div>
          <div className="p-3">
            <div className="text-[11px] text-slate-500">Speaker Playback Bleed</div>
            <div className="text-lg font-mono font-semibold text-slate-700 mt-0.5">
              {runtime.ampPowerEnabled ? `${runtime.speakerContributionDba.toFixed(1)} dBA` : '0.0 (Idle)'}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[11px] text-slate-500">Echo Cancellation (ERLE)</div>
            <div
              className={`text-lg font-mono font-semibold mt-0.5 ${
                config.spl.aec.enabled ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {config.spl.aec.enabled ? `-${runtime.aecErleDb.toFixed(1)} dB` : 'Bypassed'}
            </div>
          </div>
          <div className="p-3">
            <div className="text-[11px] text-slate-500">Measured Ambient SPL</div>
            <div className="text-lg font-mono font-semibold text-blue-700 mt-0.5">
              {runtime.effectiveSplDba.toFixed(1)} dBA
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-600 block mb-1">AEC DSP Engine</label>
            <select
              disabled={!isAdmin || !config.spl.aec.enabled}
              value={config.spl.aec.engine}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    aec: { ...config.spl.aec, engine: e.target.value as AecEngine },
                  },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white disabled:bg-slate-100"
            >
              <option value="webrtc_dsp">WebRTC DSP (webrtcdsp)</option>
              <option value="speex_dsp">SpeexDSP NLMS</option>
            </select>
          </div>
          <div>
            <label className="text-slate-600 block mb-1">Echo Suppression</label>
            <select
              disabled={!isAdmin || !config.spl.aec.enabled}
              value={config.spl.aec.echoSuppressionLevel}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    aec: {
                      ...config.spl.aec,
                      echoSuppressionLevel: e.target.value as 'low' | 'moderate' | 'high',
                    },
                  },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white disabled:bg-slate-100"
            >
              <option value="high">High (-20.5 dB ERLE)</option>
              <option value="moderate">Moderate (-15.2 dB ERLE)</option>
              <option value="low">Low (-10.4 dB ERLE)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-600 block mb-1">Echo Tail Length (ms)</label>
            <input
              type="number"
              min={32}
              max={400}
              disabled={!isAdmin || !config.spl.aec.enabled}
              value={config.spl.aec.tailLengthMs}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    aec: { ...config.spl.aec, tailLengthMs: Number(e.target.value) },
                  },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="text-slate-600 block mb-1">DAC-to-Mic Delay (ms)</label>
            <input
              type="number"
              min={0}
              max={120}
              disabled={!isAdmin || !config.spl.aec.enabled}
              value={config.spl.aec.referenceDelayMs}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    aec: { ...config.spl.aec, referenceDelayMs: Number(e.target.value) },
                  },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono disabled:bg-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Adaptive SPL Control & Transfer Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Adaptive SPL Level Control
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically raises speaker gain as post-AEC room SPL exceeds threshold.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.spl.enabled}
                onChange={(e) =>
                  onUpdateConfig({
                    spl: { ...config.spl, enabled: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-700 font-medium">
                  Adaptation Ratio (Output dB : Room dBA)
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  {config.spl.ratio.toFixed(2)} : 1
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                disabled={!isAdmin}
                value={config.spl.ratio}
                onChange={(e) =>
                  onUpdateConfig({
                    spl: { ...config.spl, ratio: Number(e.target.value) },
                  })
                }
                className="w-full accent-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  Noise Floor Threshold (dBA)
                </label>
                <input
                  type="number"
                  min={35}
                  max={85}
                  disabled={!isAdmin}
                  value={config.spl.thresholdDba}
                  onChange={(e) =>
                    onUpdateConfig({
                      spl: { ...config.spl, thresholdDba: Number(e.target.value) },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 block mb-1">
                  Maximum Boost Cap (+dB)
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  disabled={!isAdmin}
                  value={config.spl.maxBoostDb}
                  onChange={(e) =>
                    onUpdateConfig({
                      spl: { ...config.spl, maxBoostDb: Number(e.target.value) },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>

            <label className="flex items-center justify-between text-xs text-slate-700 pt-1">
              <span>Hold adaptation during active voice paging (safety interlock)</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.spl.holdDuringPaging}
                onChange={(e) =>
                  onUpdateConfig({
                    spl: { ...config.spl, holdDuringPaging: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
          </div>
        </section>

        {/* Live Transfer Curve & Room Noise Simulator */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Gain Adaptation Curve & Ambient Noise Test
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current Ambient SPL {runtime.effectiveSplDba.toFixed(1)} dBA yields +{runtime.adaptiveBoostDb.toFixed(1)} dB boost
              </p>
            </div>
            <span className="text-xs font-mono text-blue-700 font-semibold">
              Out: {runtime.effectiveOutputDb.toFixed(1)} dB
            </span>
          </div>

          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40 border border-slate-100 bg-slate-50 rounded">
            {[0, 5, 10, 15, 20].map((val) => {
              const y = 12 + plotH - (val / 20) * plotH;
              return (
                <g key={val}>
                  <line x1={padL} y1={y} x2={w - 12} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                  <text x={4} y={y + 3} fontSize="9" fill="#64748B" fontFamily="monospace">
                    +{val}
                  </text>
                </g>
              );
            })}
            {[40, 55, 70, 85, 100].map((spl) => {
              const x = padL + ((spl - 40) / 60) * plotW;
              return (
                <text key={spl} x={x - 8} y={h - 6} fontSize="9" fill="#64748B" fontFamily="monospace">
                  {spl}
                </text>
              );
            })}
            <polyline
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              points={points.join(' ')}
            />
            <circle cx={curX} cy={curY} r="5" fill="#0F172A" stroke="#FFFFFF" strokeWidth="2" />
          </svg>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Simulate True Ambient Room Noise</span>
              <span className="font-mono font-medium text-slate-900">
                {config.spl.simulatedRoomSplDba.toFixed(1)} dBA
              </span>
            </div>
            <input
              type="range"
              min={40}
              max={95}
              step={0.5}
              value={config.spl.simulatedRoomSplDba}
              onChange={(e) =>
                onUpdateConfig({
                  spl: {
                    ...config.spl,
                    simulatedRoomSplDba: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-blue-600"
            />
          </div>
        </section>
      </div>

      {/* REST API for External SPL Monitoring */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              SPL Telemetry REST API & History Monitor
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Expose real-time post-AEC SPL measurements via JSON REST endpoints and Prometheus metrics.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={config.spl.restMonitoringEnabled}
              onChange={(e) =>
                onUpdateConfig({
                  spl: { ...config.spl, restMonitoringEnabled: e.target.checked },
                })
              }
              className="accent-blue-600 h-4 w-4"
            />
            <span>Enable SPL REST API</span>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Rolling SPL Time-Series Chart */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>SPL History ({histSamples.length} samples)</span>
              <span className="font-mono">
                <span className="text-blue-600">― Post-AEC Ambient</span>
                {' · '}
                <span className="text-slate-400">--- Raw Mic</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${hw} ${hh}`} className="w-full h-36 border border-slate-100 bg-slate-50 rounded">
              {[45, 60, 75, 90].map((val) => {
                const y = mapSplY(val);
                return (
                  <g key={val}>
                    <line x1={hPadL} y1={y} x2={hw - 10} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                    <text x={4} y={y + 3} fontSize="9" fill="#64748B" fontFamily="monospace">
                      {val}
                    </text>
                  </g>
                );
              })}
              {rawPts && (
                <polyline
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  points={rawPts}
                />
              )}
              {ambientPts && (
                <polyline
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2.2"
                  points={ambientPts}
                />
              )}
            </svg>
          </div>

          {/* Endpoint Directory & Live Tester */}
          <div className="lg:col-span-6 space-y-3 text-xs">
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {[
                { path: '/api/spl', label: 'Current SPL & AEC JSON' },
                { path: '/api/spl/history', label: 'Rolling SPL Samples JSON' },
                { path: '/api/spl/metrics', label: 'Prometheus Gauge Metrics' },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <span className="font-mono text-slate-900 font-medium">{ep.path}</span>
                    <span className="text-slate-500 ml-2">{ep.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyCurl(ep.path)}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50"
                    >
                      {copiedEndpoint === ep.path ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>curl</span>
                    </button>
                    {ep.path !== '/api/spl/history' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleTestSplEndpoint(ep.path as '/api/spl' | '/api/spl/metrics')
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 border border-slate-300 rounded bg-slate-50 text-slate-800 hover:bg-slate-100"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Query</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {apiPreview && (
              <pre className="bg-slate-950 text-slate-100 rounded p-2.5 text-[11px] font-mono overflow-x-auto max-h-32">
                <code>{apiPreview}</code>
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* Room Clustering Section */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Room Clustering & Shared Settings / SPL Mesh
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Units in the same Room share combined SPL measurements and mirror master settings so satellite speakers require no local buttons or mics.
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => onAddPeer(false, false)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Headless Room Unit</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="text-slate-600 block mb-1">Room Cluster Name</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={config.roomCluster.roomName}
              onChange={(e) =>
                onUpdateConfig({
                  roomCluster: { ...config.roomCluster, roomName: e.target.value },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-900"
            />
          </div>
          <div>
            <label className="text-slate-600 block mb-1">SPL Aggregation Method</label>
            <select
              disabled={!isAdmin}
              value={config.roomCluster.splAggregation}
              onChange={(e) =>
                onUpdateConfig({
                  roomCluster: {
                    ...config.roomCluster,
                    splAggregation: e.target.value as SplAggregation,
                  },
                })
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
            >
              <option value="mean">Mean Across Room Mics</option>
              <option value="max">Peak (Loudest Mic)</option>
              <option value="primary">Primary Master Mic Only</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-5 text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={config.roomCluster.shareSettings}
              onChange={(e) =>
                onUpdateConfig({
                  roomCluster: {
                    ...config.roomCluster,
                    shareSettings: e.target.checked,
                  },
                })
              }
              className="accent-blue-600 h-4 w-4"
            />
            <span>Share Program, Calls & Vol</span>
          </label>
          <label className="flex items-center gap-2 pt-5 text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={config.roomCluster.shareSpl}
              onChange={(e) =>
                onUpdateConfig({
                  roomCluster: {
                    ...config.roomCluster,
                    shareSpl: e.target.checked,
                  },
                })
              }
              className="accent-blue-600 h-4 w-4"
            />
            <span>Share Combined SPL Data</span>
          </label>
        </div>

        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                <th className="py-2 pr-4">Unit Hostname</th>
                <th className="py-2 px-3">IP Address</th>
                <th className="py-2 px-3">Hardware Role</th>
                <th className="py-2 px-3">Local Mic SPL (dBA)</th>
                <th className="py-2 pl-3 text-right">PoE Draw</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roomPeers.map((peer) => (
                <tr key={peer.unitId}>
                  <td className="py-2.5 pr-4 font-mono text-xs text-slate-900">
                    {peer.hostname}
                    {peer.isMaster && (
                      <span className="ml-2 text-blue-700 font-sans font-medium">
                        Cluster Master
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                    {peer.ipAddress}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {peer.hasControls ? 'Buttons + Knob + OLED' : 'Headless Synced'} ·{' '}
                    {peer.hasMic ? 'SPL Mic + AEC' : 'No Mic'}
                  </td>
                  <td className="py-2.5 px-3">
                    {peer.hasMic ? (
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <input
                          type="range"
                          min={40}
                          max={95}
                          step={0.5}
                          value={
                            peer.unitId === config.unitId
                              ? config.spl.simulatedRoomSplDba
                              : peer.localSplDba
                          }
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (peer.unitId === config.unitId) {
                              onUpdateConfig({
                                spl: { ...config.spl, simulatedRoomSplDba: val },
                              });
                            } else {
                              onUpdatePeerSpl(peer.unitId, val);
                            }
                          }}
                          className="w-24 accent-blue-600"
                        />
                        <span className="font-mono text-xs text-slate-800">
                          {(peer.unitId === config.unitId
                            ? config.spl.simulatedRoomSplDba
                            : peer.localSplDba
                          ).toFixed(1)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Consumes cluster ({runtime.effectiveSplDba.toFixed(1)} dBA)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-xs text-slate-700">
                    {peer.unitId === config.unitId
                      ? runtime.estimatedPoeWatts.toFixed(2)
                      : peer.poeWatts.toFixed(2)}{' '}
                    W
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
