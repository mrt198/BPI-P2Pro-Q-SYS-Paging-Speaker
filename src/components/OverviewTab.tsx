import React from 'react';
import { Lock, Volume2, VolumeX } from 'lucide-react';
import type { CallsMode, ProgramSlot, QsysZonePreset, SpeakerConfig, SystemStateResponse } from '../types';
import { OledHardwarePanel } from './OledHardwarePanel';

interface OverviewTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
  onProgramCycle: () => void;
  onCallsCycle: () => void;
  onVolumeStep: (delta: number) => void;
  onToggleCall: (circuit: 'stage' | 'all', active: boolean) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
  onProgramCycle,
  onCallsCycle,
  onVolumeStep,
  onToggleCall,
}) => {
  const { config, runtime, qsysZones, roomPeers } = state;
  const boundZone = qsysZones.find((z) => z.id === config.boundZoneId);

  const circuitLabelMap: Record<SystemStateResponse['runtime']['activeCircuit'], string> = {
    all_calls: 'All Calls Circuit',
    stage_calls: 'Stage Calls Circuit',
    program: `Program ${config.selectedProgram}`,
    idle: 'Idle (No Source)',
    scheduled_silent:
      config.power.scheduleMode === 'low_power' ? 'Scheduled Low-Power' : 'Scheduled Silent',
  };

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="text-xs text-slate-500">Effective Output Gain</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {config.muted ? 'MUTE' : `${runtime.effectiveOutputDb.toFixed(1)} dB`}
            </span>
            {runtime.adaptiveBoostDb > 0 && !config.muted && (
              <span className="text-xs font-mono text-blue-600">
                +{runtime.adaptiveBoostDb.toFixed(1)} dB SPL
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Base {config.baseVolumeDb} dB · {config.hardware.audioOutput === 'i2s' ? 'I2S Amp' : 'Onboard DAC'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500">Room SPL Level</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {runtime.effectiveSplDba.toFixed(1)} dBA
            </span>
            <span className="text-xs font-mono text-slate-500">
              Ratio {config.spl.ratio}:1
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {config.roomCluster.enabled && config.roomCluster.shareSpl
              ? `Cluster ${config.roomCluster.splAggregation} (${roomPeers.filter((p) => p.hasMic).length} mics)`
              : `Local ${config.hardware.micInput.toUpperCase()} mic`}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500">Active Audio Circuit</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-xl font-semibold ${
                runtime.activeCircuit === 'all_calls'
                  ? 'text-red-600'
                  : runtime.activeCircuit === 'stage_calls'
                  ? 'text-amber-600'
                  : 'text-slate-900'
              }`}
            >
              {circuitLabelMap[runtime.activeCircuit]}
            </span>
          </div>
          <div className="mt-1 text-xs font-mono text-slate-500 truncate">
            {runtime.activeStreamUri || 'Amplifier in standby'}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-500">PoE Power Draw</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-slate-900">
              {runtime.estimatedPoeWatts.toFixed(2)} W
            </span>
            <span className="text-xs font-mono text-slate-500">
              {config.power.cpuGovernor}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {runtime.ampPowerEnabled ? 'Class-D SD_MODE High' : 'Class-D Shutdown Active'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Balanced Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Primary Mixing, Program & Calls Control */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Speaker Output & Mode Controls
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zone {config.boundZoneName} ({config.zoneMode === 'auto' ? 'Q-SYS Auto' : 'Manual'}) · Room {config.roomCluster.roomName}
                </p>
              </div>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() => onUpdateConfig({ muted: !config.muted })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  config.muted
                    ? 'bg-red-600 text-white border-red-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                } disabled:opacity-50`}
              >
                {config.muted ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                <span>{config.muted ? 'Muted' : 'Mute Output'}</span>
              </button>
            </div>

            {/* Base Volume Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label htmlFor="base-volume-slider" className="text-sm font-medium text-slate-800">
                  Base Output Volume
                </label>
                <span className="text-sm font-mono font-semibold text-slate-900">
                  {config.baseVolumeDb} dBFS
                </span>
              </div>
              <input
                id="base-volume-slider"
                type="range"
                min={-60}
                max={0}
                step={1}
                disabled={!isAdmin}
                value={config.baseVolumeDb}
                onChange={(e) =>
                  onUpdateConfig({ baseVolumeDb: Number(e.target.value) })
                }
                className="w-full accent-blue-600 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>-60 dB</span>
                <span>-30 dB</span>
                <span>-12 dB (Nominal)</span>
                <span>0 dB</span>
              </div>
            </div>

            {/* Program Channel Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">
                  Program Channel Selection
                </span>
                <span className="text-xs text-slate-500">
                  Button cycles 1 · 2 · 3 · None
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 p-1 bg-slate-100 rounded-md">
                {([1, 2, 3, 0] as ProgramSlot[]).map((slot) => {
                  const active = config.selectedProgram === slot;
                  const chKey =
                    slot === 0 ? null : (`program_${slot}` as 'program_1' | 'program_2' | 'program_3');
                  const fmt = chKey ? config.channels[chKey].format : null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => onUpdateConfig({ selectedProgram: slot })}
                      className={`py-2 px-3 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      } disabled:opacity-50`}
                    >
                      {slot === 0 ? 'None' : `Program ${slot}`}
                      {fmt && (
                        <span className="ml-1 text-[11px] text-slate-400">
                          ({fmt === 'Stereo' ? 'ST' : 'M'})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calls Mode Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">
                  Paging Calls Mode
                </span>
                {!config.allowNoneCalls && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <Lock className="w-3 h-3" />
                    None mode disabled by policy
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-md">
                {(['stage', 'all', 'none'] as CallsMode[]).map((mode) => {
                  const active = config.callsMode === mode;
                  const lockedOut = mode === 'none' && !config.allowNoneCalls;
                  const label =
                    mode === 'stage'
                      ? 'Stage Calls'
                      : mode === 'all'
                      ? 'All Calls (+Stage)'
                      : 'None (Disabled)';
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={!isAdmin || lockedOut}
                      onClick={() => onUpdateConfig({ callsMode: mode })}
                      className={`py-2 px-3 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cluster & Signal Summary Footer inside panel */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Unit Identity</span>
              <span className="font-mono text-slate-800">{config.unitId}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Network / PoE</span>
              <span className="font-mono text-slate-800">{config.ipAddress} · IEEE 802.3af</span>
            </div>
            <div>
              <span className="text-slate-500 block">Cluster Sync</span>
              <span className="text-slate-800">
                {config.roomCluster.enabled
                  ? `${roomPeers.length} units in ${config.roomCluster.roomName}`
                  : 'Standalone unit'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: OLED & Physical Hardware Emulator */}
        <div className="lg:col-span-5 flex flex-col">
          <OledHardwarePanel
            config={config}
            runtime={runtime}
            boundZone={boundZone}
            onProgramCycle={onProgramCycle}
            onCallsCycle={onCallsCycle}
            onVolumeStep={onVolumeStep}
            onToggleCall={onToggleCall}
          />
        </div>
      </div>
    </div>
  );
};
