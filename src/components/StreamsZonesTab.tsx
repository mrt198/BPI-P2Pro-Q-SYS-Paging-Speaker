import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Radio } from 'lucide-react';
import type {
  AudioChannelFormat,
  DiscoverySource,
  PriorityCircuit,
  ReceiveChannelConfig,
  SpeakerConfig,
  SystemStateResponse,
} from '../types';

interface StreamsZonesTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
  onBindZone: (zoneId: string) => void;
  onToggleCall: (circuit: 'stage' | 'all', active: boolean) => void;
}

const CIRCUIT_LABELS: Record<PriorityCircuit, string> = {
  all_calls: 'All Calls Circuit',
  stage_calls: 'Stage Calls Circuit',
  program: 'Selected Program (1 / 2 / 3)',
};

export const StreamsZonesTab: React.FC<StreamsZonesTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
  onBindZone,
  onToggleCall,
}) => {
  const { config, qsysZones, discoveredStreams } = state;
  const [sourceFilter, setSourceFilter] = useState<'all' | DiscoverySource>('all');
  const [assignTarget, setAssignTarget] = useState<ReceiveChannelConfig['id']>('program_1');

  const channelList: ReceiveChannelConfig[] = [
    config.channels.stage_calls,
    config.channels.all_calls,
    config.channels.program_1,
    config.channels.program_2,
    config.channels.program_3,
  ];

  const filteredStreams = discoveredStreams.filter(
    (s) => sourceFilter === 'all' || s.source === sourceFilter
  );

  const movePriority = (index: number, dir: -1 | 1) => {
    const next = [...config.priorityOrder];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onUpdateConfig({ priorityOrder: next });
  };

  const updateChannel = (
    id: ReceiveChannelConfig['id'],
    patch: Partial<ReceiveChannelConfig>
  ) => {
    onUpdateConfig({
      zoneMode: 'manual',
      channels: {
        ...config.channels,
        [id]: {
          ...config.channels[id],
          ...patch,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Q-SYS Auto-Detected Zones */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Q-SYS Plugin Auto-Detected Zones
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Discovered via Q-SYS Paging Controller UDP multicast (239.255.77.67:7767). Binding a zone auto-configures all 5 streams and defaults.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Mode:</span>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() =>
                onUpdateConfig({
                  zoneMode: config.zoneMode === 'auto' ? 'manual' : 'auto',
                })
              }
              className="px-3 py-1.5 border border-slate-300 rounded-md bg-slate-50 font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {config.zoneMode === 'auto' ? 'Auto-Sync From Q-SYS' : 'Manual Stream Override'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                <th className="py-2.5 pr-4">Zone Name</th>
                <th className="py-2.5 px-3">Q-SYS Core</th>
                <th className="py-2.5 px-3">Default Vol / SPL Ratio</th>
                <th className="py-2.5 px-3">None Calls</th>
                <th className="py-2.5 px-3">Live Call Circuit</th>
                <th className="py-2.5 pl-3 text-right">Assignment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {qsysZones.map((zone) => {
                const isBound = config.boundZoneId === zone.id;
                return (
                  <tr
                    key={zone.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      isBound ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {zone.name}
                      <div className="text-[11px] font-mono text-slate-400">
                        P1 {zone.program1Stream} ({zone.program1Format})
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600">
                      {zone.coreIp}
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-700">
                      {zone.defaultVolumeDb} dB · {zone.splRatio}:1
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      {zone.allowNoneCalls ? 'Allowed' : 'Locked Out'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCall('stage', !zone.stageCallActive)
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                            zone.stageCallActive
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          Stage {zone.stageCallActive ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCall('all', !zone.allCallActive)
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                            zone.allCallActive
                              ? 'bg-red-600 text-white border-red-700'
                              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          All {zone.allCallActive ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => onBindZone(zone.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                          isBound
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                        } disabled:opacity-50`}
                      >
                        {isBound && <Check className="w-3.5 h-3.5" />}
                        <span>{isBound ? 'Bound Zone' : 'Apply Zone'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Call Priority Matrix & 5 Receive Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Order */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Circuit Priority & Preemption
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Highest-ranked active circuit preempts lower-priority audio.
            </p>
          </div>

          <div className="space-y-2">
            {config.priorityOrder.map((circuit, idx) => (
              <div
                key={circuit}
                className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    0{idx + 1}.
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {CIRCUIT_LABELS[circuit]}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={!isAdmin || idx === 0}
                    onClick={() => movePriority(idx, -1)}
                    aria-label="Move priority up"
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!isAdmin || idx === config.priorityOrder.length - 1}
                    onClick={() => movePriority(idx, 1)}
                    aria-label="Move priority down"
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <label className="flex items-center justify-between text-xs text-slate-700">
              <span>Hard mute program during active call</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.hardMuteOnCall}
                onChange={(e) =>
                  onUpdateConfig({ hardMuteOnCall: e.target.checked })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
            {!config.hardMuteOnCall && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Program Duck Attenuation</span>
                  <span className="font-mono">{config.duckAttenuationDb} dB</span>
                </div>
                <input
                  type="range"
                  min={-40}
                  max={-3}
                  step={1}
                  disabled={!isAdmin}
                  value={config.duckAttenuationDb}
                  onChange={(e) =>
                    onUpdateConfig({ duckAttenuationDb: Number(e.target.value) })
                  }
                  className="w-full accent-blue-600"
                />
              </div>
            )}
          </div>
        </section>

        {/* 5 Receive Channels Mapping */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              AES67 Receive Channels (5 Streams)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure SAP multicast, RTSP URI, or Q-SYS announced stream and Mono/Stereo routing per channel.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                  <th className="py-2 pr-3">Channel</th>
                  <th className="py-2 px-2">Protocol</th>
                  <th className="py-2 px-2">Stream Multicast / RTSP URI</th>
                  <th className="py-2 px-2">Format</th>
                  <th className="py-2 pl-2 text-right">Jitter (ms)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channelList.map((ch) => {
                  const isCall = ch.id === 'stage_calls' || ch.id === 'all_calls';
                  return (
                    <tr key={ch.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900 whitespace-nowrap">
                        {ch.label}
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          disabled={!isAdmin}
                          value={ch.source}
                          onChange={(e) =>
                            updateChannel(ch.id, {
                              source: e.target.value as DiscoverySource,
                            })
                          }
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800"
                        >
                          <option value="qsys">Q-SYS</option>
                          <option value="sap">SAP</option>
                          <option value="rtsp">RTSP</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          disabled={!isAdmin}
                          value={ch.uri}
                          onChange={(e) =>
                            updateChannel(ch.id, { uri: e.target.value })
                          }
                          className="w-full min-w-[200px] border border-slate-300 rounded px-2.5 py-1 text-xs font-mono text-slate-800 bg-white"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <select
                          disabled={!isAdmin || isCall}
                          value={ch.format}
                          onChange={(e) =>
                            updateChannel(ch.id, {
                              format: e.target.value as AudioChannelFormat,
                            })
                          }
                          className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-800 disabled:bg-slate-100"
                        >
                          <option value="Mono">Mono</option>
                          <option value="Mono (Sum L+R)">Mono (Sum L+R)</option>
                          {!isCall && <option value="Stereo">Stereo</option>}
                        </select>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <input
                          type="number"
                          min={2}
                          max={80}
                          disabled={!isAdmin}
                          value={ch.jitterMs}
                          onChange={(e) =>
                            updateChannel(ch.id, {
                              jitterMs: Number(e.target.value),
                            })
                          }
                          className="w-16 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-right text-slate-800"
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

      {/* Section 3: Discovered SAP / RTSP / Q-SYS Streams Directory */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Discovered AES67 Streams (SAP · RTSP · Q-SYS)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a target receive slot and click Assign to route a discovered stream.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Target Slot:</span>
              <select
                value={assignTarget}
                onChange={(e) =>
                  setAssignTarget(e.target.value as ReceiveChannelConfig['id'])
                }
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-800"
              >
                {channelList.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
              {(['all', 'sap', 'rtsp', 'qsys'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                    sourceFilter === src
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {src === 'all' ? 'All Sources' : src.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 font-medium">
                <th className="py-2 pr-4">Stream Name</th>
                <th className="py-2 px-3">Protocol</th>
                <th className="py-2 px-3">SDP Address / URI</th>
                <th className="py-2 px-3">Format</th>
                <th className="py-2 px-3">PTP Grandmaster</th>
                <th className="py-2 pl-3 text-right">Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStreams.map((stream) => (
                <tr key={stream.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">
                    {stream.name}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-600 uppercase">
                    {stream.source}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-700">
                    {stream.uri}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                    {stream.encoding} / {stream.sampleRate / 1000}kHz / {stream.channels}ch
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                    {stream.ptpGrandmaster}
                  </td>
                  <td className="py-2.5 pl-3 text-right">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() =>
                        updateChannel(assignTarget, {
                          source: stream.source,
                          uri: stream.uri,
                          format: stream.channels >= 2 && !assignTarget.includes('calls') ? 'Stereo' : 'Mono',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white text-slate-800 hover:bg-slate-100 whitespace-nowrap disabled:opacity-50"
                    >
                      <Radio className="w-3 h-3 text-blue-600" />
                      <span>Assign</span>
                    </button>
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
