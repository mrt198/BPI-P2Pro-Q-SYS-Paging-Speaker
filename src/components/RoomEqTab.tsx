import React, { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import type { PeqBand, PeqFilterType, SpeakerConfig, SystemStateResponse } from '../types';

interface RoomEqTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
  onImportRew: (rewText: string, filename: string) => void;
}

const SAMPLE_REW_FILTERS = `# Room EQ Wizard (REW) V5.30 Filter Settings
# Target: BananaPi BPI-P2Pro PoE Ceiling Speaker - Studio Room Correction
Preamp: -3.2 dB
Filter  1: ON  HP       Fc    70.0 Hz  Gain   0.00 dB  Q  0.707
Filter  2: ON  PK       Fc   128.0 Hz  Gain  -6.10 dB  Q  4.800
Filter  3: ON  PK       Fc   260.0 Hz  Gain  -3.40 dB  Q  2.900
Filter  4: ON  PK       Fc   580.0 Hz  Gain   2.30 dB  Q  1.750
Filter  5: ON  PK       Fc  1620.0 Hz  Gain  -2.90 dB  Q  3.200
Filter  6: ON  PK       Fc  3850.0 Hz  Gain   1.90 dB  Q  1.500
Filter  7: ON  HS       Fc  8000.0 Hz  Gain   2.80 dB  Q  0.707
Filter  8: OFF PK       Fc 12000.0 Hz  Gain   0.00 dB  Q  1.410`;

/**
 * RBJ Audio EQ Cookbook biquad magnitude response at frequency f (Hz), Fs = 48000 Hz.
 */
function computeBiquadMagDb(band: PeqBand, f: number, fs = 48000): number {
  if (!band.enabled) return 0;
  const w0 = (2 * Math.PI * Math.max(20, Math.min(20000, band.freqHz))) / fs;
  const w = (2 * Math.PI * f) / fs;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const q = Math.max(0.1, band.q);
  const A = 10 ** (band.gainDb / 40);
  const alpha = sinW0 / (2 * q);

  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  if (band.type === 'PK') {
    b0 = 1 + alpha * A;
    b1 = -2 * cosW0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosW0;
    a2 = 1 - alpha / A;
  } else if (band.type === 'LS') {
    const sqA = Math.sqrt(A);
    const twoSqAAlpha = 2 * sqA * alpha;
    b0 = A * (A + 1 - (A - 1) * cosW0 + twoSqAAlpha);
    b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
    b2 = A * (A + 1 - (A - 1) * cosW0 - twoSqAAlpha);
    a0 = A + 1 + (A - 1) * cosW0 + twoSqAAlpha;
    a1 = -2 * (A - 1 + (A + 1) * cosW0);
    a2 = A + 1 + (A - 1) * cosW0 - twoSqAAlpha;
  } else if (band.type === 'HS') {
    const sqA = Math.sqrt(A);
    const twoSqAAlpha = 2 * sqA * alpha;
    b0 = A * (A + 1 + (A - 1) * cosW0 + twoSqAAlpha);
    b1 = -2 * A * (A - 1 + (A + 1) * cosW0);
    b2 = A * (A + 1 + (A - 1) * cosW0 - twoSqAAlpha);
    a0 = A + 1 - (A - 1) * cosW0 + twoSqAAlpha;
    a1 = 2 * (A - 1 - (A + 1) * cosW0);
    a2 = A + 1 - (A - 1) * cosW0 - twoSqAAlpha;
  } else if (band.type === 'HP') {
    b0 = (1 + cosW0) / 2;
    b1 = -(1 + cosW0);
    b2 = (1 + cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (band.type === 'LP') {
    b0 = (1 - cosW0) / 2;
    b1 = 1 - cosW0;
    b2 = (1 - cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  }

  const cosW = Math.cos(w);
  const sinW = Math.sin(w);
  const cos2W = Math.cos(2 * w);
  const sin2W = Math.sin(2 * w);

  const numRe = b0 + b1 * cosW + b2 * cos2W;
  const numIm = -(b1 * sinW + b2 * sin2W);
  const denRe = a0 + a1 * cosW + a2 * cos2W;
  const denIm = -(a1 * sinW + a2 * sin2W);

  const magSq = (numRe * numRe + numIm * numIm) / Math.max(1e-12, denRe * denRe + denIm * denIm);
  return 10 * Math.log10(Math.max(1e-12, magSq));
}

export const RoomEqTab: React.FC<RoomEqTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
  onImportRew,
}) => {
  const { peq } = state.config;
  const [rewPaste, setRewPaste] = useState(SAMPLE_REW_FILTERS);
  const [showImportBox, setShowImportBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateBand = (index: number, patch: Partial<PeqBand>) => {
    const nextBands = peq.bands.map((b, idx) =>
      idx === index ? { ...b, ...patch } : b
    );
    onUpdateConfig({ peq: { ...peq, bands: nextBands } });
  };

  const resetFlat = () => {
    onUpdateConfig({
      peq: {
        ...peq,
        preampDb: 0,
        bands: peq.bands.map((b, idx) => ({
          ...b,
          enabled: false,
          type: 'PK',
          freqHz: [63, 125, 250, 500, 1000, 2000, 4000, 8000][idx] ?? 1000,
          gainDb: 0,
          q: 1.41,
        })),
      },
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportRew(text, file.name);
    setRewPaste(text);
    setShowImportBox(false);
    e.target.value = '';
  };

  // Compute SVG logarithmic frequency response curve (20 Hz – 20,000 Hz)
  const svgW = 860;
  const svgH = 220;
  const padL = 42;
  const padR = 16;
  const padT = 14;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const freqToX = (f: number) => {
    const logMin = Math.log10(20);
    const logMax = Math.log10(20000);
    const ratio = (Math.log10(Math.max(20, Math.min(20000, f))) - logMin) / (logMax - logMin);
    return padL + ratio * plotW;
  };

  const dbToY = (db: number) => {
    const clamped = Math.max(-18, Math.min(12, db));
    return padT + ((12 - clamped) / 30) * plotH;
  };

  const curvePoints = useMemo(() => {
    const pts: string[] = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
      const f = 20 * 10 ** ((i / steps) * 3); // 20 Hz -> 20,000 Hz
      let totalDb = peq.enabled ? peq.preampDb : 0;
      if (peq.enabled) {
        for (const b of peq.bands) {
          totalDb += computeBiquadMagDb(b, f);
        }
      }
      pts.push(`${freqToX(f).toFixed(1)},${dbToY(totalDb).toFixed(1)}`);
    }
    return pts.join(' ');
  }, [peq]);

  const zeroY = dbToY(0);

  return (
    <div className="space-y-6">
      {/* Header & Frequency Response Plot */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              8-Band Parametric EQ & Room EQ Wizard (REW) Correction
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inline GStreamer 8-band IIR filter stage prior to AEC reference probe · Active profile: {peq.rewLastImportedName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800 mr-2">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={peq.enabled}
                onChange={(e) =>
                  onUpdateConfig({ peq: { ...peq, enabled: e.target.checked } })
                }
                className="accent-blue-600 h-4 w-4"
              />
              <span>EQ Active</span>
            </label>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setShowImportBox((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import REW (.txt)</span>
            </button>
            <a
              href="/api/peq/export-rew"
              download="bpi-p2pro-rew-peq.txt"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export REW</span>
            </a>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={resetFlat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Flatten</span>
            </button>
          </div>
        </div>

        {/* Optional REW Import Drawer */}
        {showImportBox && (
          <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Paste Room EQ Wizard (REW) Generic Equalizer Filter Export or Upload .txt
              </span>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white text-slate-800 hover:bg-slate-100"
                >
                  Choose .txt File
                </button>
                <button
                  type="button"
                  onClick={() => setRewPaste(SAMPLE_REW_FILTERS)}
                  className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-100"
                >
                  Load Sample REW
                </button>
              </div>
            </div>
            <textarea
              rows={7}
              value={rewPaste}
              onChange={(e) => setRewPaste(e.target.value)}
              className="w-full border border-slate-300 rounded p-2.5 text-xs font-mono bg-white text-slate-900"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowImportBox(false)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => {
                  onImportRew(rewPaste, 'REW_Pasted_Correction.txt');
                  setShowImportBox(false);
                }}
                className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Apply REW Filters to 8-Band PEQ
              </button>
            </div>
          </div>
        )}

        {/* Logarithmic 20 Hz - 20 kHz Magnitude Graph */}
        <div className="space-y-2">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full h-56 border border-slate-200 bg-slate-950 rounded-md"
          >
            {/* dB horizontal grid */}
            {[12, 6, 0, -6, -12, -18].map((db) => {
              const y = dbToY(db);
              return (
                <g key={db}>
                  <line
                    x1={padL}
                    y1={y}
                    x2={svgW - padR}
                    y2={y}
                    stroke={db === 0 ? '#475569' : '#1E293B'}
                    strokeWidth={db === 0 ? '1.2' : '1'}
                  />
                  <text
                    x={6}
                    y={y + 3}
                    fontSize="10"
                    fill="#94A3B8"
                    fontFamily="monospace"
                  >
                    {db > 0 ? `+${db}` : db}
                  </text>
                </g>
              );
            })}

            {/* Log frequency gridlines */}
            {[20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].map((f) => {
              const x = freqToX(f);
              const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
              return (
                <g key={f}>
                  <line x1={x} y1={padT} x2={x} y2={svgH - padB} stroke="#1E293B" strokeWidth="1" />
                  <text
                    x={x - 8}
                    y={svgH - 8}
                    fontSize="10"
                    fill="#94A3B8"
                    fontFamily="monospace"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Preamp reference line */}
            {peq.enabled && peq.preampDb !== 0 && (
              <line
                x1={padL}
                y1={dbToY(peq.preampDb)}
                x2={svgW - padR}
                y2={dbToY(peq.preampDb)}
                stroke="#64748B"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            )}

            {/* Composite Response Curve */}
            <polyline
              fill="none"
              stroke={peq.enabled ? '#38BDF8' : '#64748B'}
              strokeWidth="2.5"
              points={curvePoints}
            />

            {/* Individual active band markers */}
            {peq.enabled &&
              peq.bands
                .filter((b) => b.enabled)
                .map((b) => {
                  const cx = freqToX(b.freqHz);
                  const cy = dbToY(
                    b.type === 'HP' || b.type === 'LP' ? peq.preampDb : b.gainDb + peq.preampDb
                  );
                  return (
                    <g key={b.band}>
                      <circle cx={cx} cy={cy} r="6" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.8" />
                      <text
                        x={cx}
                        y={cy + 3}
                        fontSize="8"
                        fill="#E0F2FE"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {b.band}
                      </text>
                    </g>
                  );
                })}
            {/* Zero reference */}
            <line x1={padL} y1={zeroY} x2={padL} y2={zeroY} stroke="transparent" />
          </svg>

          {/* Preamp Headroom Trim Control */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-700">EQ Preamp Headroom Trim:</span>
              <input
                type="range"
                min={-12}
                max={6}
                step={0.1}
                disabled={!isAdmin}
                value={peq.preampDb}
                onChange={(e) =>
                  onUpdateConfig({
                    peq: { ...peq, preampDb: Number(e.target.value) },
                  })
                }
                className="w-40 accent-blue-600"
              />
              <span className="font-mono font-semibold text-slate-900">
                {peq.preampDb.toFixed(1)} dB
              </span>
            </div>
            <span className="text-slate-500">
              {peq.bands.filter((b) => b.enabled).length} of 8 bands active
            </span>
          </div>
        </div>
      </section>

      {/* 8-Band Filter Editor Table */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">
            8-Band Parametric Filter Bank
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Fine-tune individual biquad filters or import directly from Room EQ Wizard (PK = Peaking, LS/HS = Low/High Shelf, HP/LP = High/Low Pass).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                <th className="py-2 pr-3">Band</th>
                <th className="py-2 px-2">Active</th>
                <th className="py-2 px-2">Filter Type</th>
                <th className="py-2 px-2">Frequency (Hz)</th>
                <th className="py-2 px-2">Gain (dB)</th>
                <th className="py-2 pl-2">Q Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {peq.bands.map((b, idx) => {
                const isPass = b.type === 'HP' || b.type === 'LP';
                return (
                  <tr key={b.band} className={b.enabled ? '' : 'opacity-60'}>
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-800">
                      Band {b.band}
                    </td>
                    <td className="py-2.5 px-2">
                      <input
                        type="checkbox"
                        disabled={!isAdmin}
                        checked={b.enabled}
                        onChange={(e) => updateBand(idx, { enabled: e.target.checked })}
                        className="accent-blue-600 h-4 w-4"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      <select
                        disabled={!isAdmin}
                        value={b.type}
                        onChange={(e) =>
                          updateBand(idx, { type: e.target.value as PeqFilterType })
                        }
                        className="border border-slate-300 rounded px-2 py-1 text-xs bg-white font-mono"
                      >
                        <option value="PK">PK (Peaking)</option>
                        <option value="LS">LS (Low Shelf)</option>
                        <option value="HS">HS (High Shelf)</option>
                        <option value="HP">HP (High Pass)</option>
                        <option value="LP">LP (Low Pass)</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={20}
                          max={20000}
                          step={1}
                          disabled={!isAdmin}
                          value={b.freqHz}
                          onChange={(e) =>
                            updateBand(idx, { freqHz: Number(e.target.value) })
                          }
                          className="w-24 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="range"
                          min={20}
                          max={20000}
                          step={5}
                          disabled={!isAdmin}
                          value={b.freqHz}
                          onChange={(e) =>
                            updateBand(idx, { freqHz: Number(e.target.value) })
                          }
                          className="w-24 accent-blue-600 hidden sm:inline"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={-24}
                          max={12}
                          step={0.1}
                          disabled={!isAdmin || isPass}
                          value={isPass ? 0 : b.gainDb}
                          onChange={(e) =>
                            updateBand(idx, { gainDb: Number(e.target.value) })
                          }
                          className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono disabled:bg-slate-100"
                        />
                        <input
                          type="range"
                          min={-18}
                          max={12}
                          step={0.2}
                          disabled={!isAdmin || isPass}
                          value={isPass ? 0 : b.gainDb}
                          onChange={(e) =>
                            updateBand(idx, { gainDb: Number(e.target.value) })
                          }
                          className="w-24 accent-blue-600 hidden sm:inline"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pl-2">
                      <input
                        type="number"
                        min={0.2}
                        max={16}
                        step={0.05}
                        disabled={!isAdmin}
                        value={b.q}
                        onChange={(e) => updateBand(idx, { q: Number(e.target.value) })}
                        className="w-20 border border-slate-300 rounded px-2 py-1 text-xs font-mono"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
