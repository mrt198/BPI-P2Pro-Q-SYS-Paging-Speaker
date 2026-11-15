import React from 'react';
import { BellRing, Disc, Power, Radio, RotateCw, Volume2, VolumeX } from 'lucide-react';
import type { QsysZonePreset, SpeakerConfig, SystemStateResponse } from '../types';

interface OledHardwarePanelProps {
  config: SpeakerConfig;
  runtime: SystemStateResponse['runtime'];
  boundZone?: QsysZonePreset;
  onProgramCycle: () => void;
  onCallsCycle: () => void;
  onVolumeStep: (delta: number) => void;
  onToggleCall: (circuit: 'stage' | 'all', active: boolean) => void;
}

export const OledHardwarePanel: React.FC<OledHardwarePanelProps> = ({
  config,
  runtime,
  boundZone,
  onProgramCycle,
  onCallsCycle,
  onVolumeStep,
  onToggleCall,
}) => {
  const programLabel =
    config.selectedProgram === 0 ? 'NONE' : `PROG ${config.selectedProgram}`;
  const callsLabel =
    config.callsMode === 'all'
      ? 'ALL+STG'
      : config.callsMode === 'stage'
      ? 'STAGE'
      : 'NONE';

  const activeBanner =
    runtime.activeCircuit === 'all_calls'
      ? '!! ALL CALL ACTIVE !!'
      : runtime.activeCircuit === 'stage_calls'
      ? '! STAGE CALL ACTIVE !'
      : runtime.activeCircuit === 'scheduled_silent'
      ? 'SCHEDULED LOW-POWER'
      : null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between gap-5">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Front-Panel Hardware & OLED Emulator
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {config.hardware.oledModel} · GPIO {config.hardware.progButtonGpio}/{config.hardware.callsButtonGpio} · Encoder {config.hardware.encoderAGpio}/{config.hardware.encoderBGpio}
          </p>
        </div>
        <span className="text-xs font-mono text-slate-600 whitespace-nowrap shrink-0">
          {runtime.ampPowerEnabled ? 'AMP ON' : 'AMP STANDBY'}
        </span>
      </div>

      {/* Physical Bezel + 128x64 Monochrome OLED */}
      <div className="bg-slate-900 rounded-md p-4 border border-slate-800">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
          <span>I2C 0x3C · {config.hardware.hasOled ? 'ENABLED' : 'HEADLESS'}</span>
          <span>{runtime.oledAwake ? 'DISPLAY AWAKE' : 'SCREEN SLEEP'}</span>
        </div>

        <div
          className={`rounded border border-slate-700 p-3.5 font-mono transition-opacity ${
            runtime.oledAwake ? 'bg-[#070B12] text-[#DCEEFF]' : 'bg-[#05070B] text-slate-700'
          }`}
        >
          {!config.hardware.hasOled ? (
            <div className="h-28 flex flex-col items-center justify-center text-xs text-slate-500 gap-1">
              <span>NO LOCAL OLED FITTED</span>
              <span className="text-[11px] text-slate-600">
                Controlled via Room Cluster ({config.roomCluster.roomName})
              </span>
            </div>
          ) : !runtime.oledAwake ? (
            <div className="h-28 flex flex-col items-center justify-center text-xs text-slate-600 gap-1">
              <Power className="w-4 h-4 text-slate-600" />
              <span>OLED IN POWER-SAVE SLEEP</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {/* Row 1: Zone & Room */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold truncate max-w-[180px]">
                  ZN:{config.boundZoneName.toUpperCase()}
                </span>
                <span className="text-[#93C5FD]">
                  {runtime.effectiveSplDba.toFixed(1)} dBA
                </span>
              </div>

              {/* Row 2: Active Banner or Program/Calls */}
              {activeBanner ? (
                <div className="bg-[#DCEEFF] text-[#070B12] px-2 py-1 font-bold text-center tracking-wide">
                  {activeBanner}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 py-0.5">
                  <div>
                    <div className="text-[10px] text-slate-400">PROGRAM</div>
                    <div className="font-semibold text-sm">{programLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">CALLS MODE</div>
                    <div className="font-semibold text-sm">
                      {callsLabel}
                      {!config.allowNoneCalls && (
                        <span className="text-[10px] text-slate-400 ml-1">(LK)</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 3: Output Volume Bar */}
              <div className="pt-1 border-t border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span>
                    VOL {config.muted ? 'MUTE' : `${runtime.effectiveOutputDb.toFixed(1)} dB`}
                  </span>
                  <span className="text-slate-400">
                    BASE {config.baseVolumeDb} {runtime.adaptiveBoostDb > 0 ? `+${runtime.adaptiveBoostDb} SPL` : ''}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#DCEEFF] transition-all duration-150"
                    style={{
                      width: config.muted
                        ? '0%'
                        : `${Math.max(4, Math.min(100, ((runtime.effectiveOutputDb + 60) / 60) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Physical Controls Simulator */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={onProgramCycle}
            disabled={!config.hardware.hasButtons}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-md bg-slate-50 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span>Prog Cycle</span>
          </button>

          <button
            type="button"
            onClick={onCallsCycle}
            disabled={!config.hardware.hasButtons}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium border border-slate-300 rounded-md bg-slate-50 text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-600" />
            <span>Calls Cycle</span>
          </button>

          <div className="flex items-center border border-slate-300 rounded-md bg-slate-50 overflow-hidden">
            <button
              type="button"
              onClick={() => onVolumeStep(-2)}
              disabled={!config.hardware.hasKnob}
              aria-label="Turn volume knob down"
              className="flex-1 py-2.5 text-xs font-mono font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              -2
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-500 flex items-center gap-1">
              <RotateCw className="w-3 h-3" />
            </span>
            <button
              type="button"
              onClick={() => onVolumeStep(2)}
              disabled={!config.hardware.hasKnob}
              aria-label="Turn volume knob up"
              className="flex-1 py-2.5 text-xs font-mono font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-40 transition-colors"
            >
              +2
            </button>
          </div>
        </div>

        {/* Q-SYS Call Trigger Verification */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            Q-SYS Call Circuit Trigger ({config.boundZoneName})
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                onToggleCall('stage', !(boundZone?.stageCallActive ?? false))
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                boundZone?.stageCallActive
                  ? 'bg-amber-600 text-white border-amber-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {boundZone?.stageCallActive ? 'Stop Stage Call' : 'Test Stage Call'}
            </button>
            <button
              type="button"
              onClick={() =>
                onToggleCall('all', !(boundZone?.allCallActive ?? false))
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                boundZone?.allCallActive
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {boundZone?.allCallActive ? 'Stop All Call' : 'Test All Call'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
