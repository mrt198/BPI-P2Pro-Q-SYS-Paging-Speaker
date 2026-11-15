import React from 'react';
import { Lock } from 'lucide-react';
import type { CpuGovernor, PowerScheduleMode, SpeakerConfig, SystemStateResponse } from '../types';

interface HardwarePowerTabProps {
  state: SystemStateResponse;
  isAdmin: boolean;
  onUpdateConfig: (patch: Partial<SpeakerConfig>) => void;
}

export const HardwarePowerTab: React.FC<HardwarePowerTabProps> = ({
  state,
  isAdmin,
  onUpdateConfig,
}) => {
  const { config, runtime } = state;

  return (
    <div className="space-y-6">
      {/* Front-Panel Controls & Policy */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Physical Controls, GPIO & OLED Screen
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure optional BananaPi BPI-P2Pro front-panel hardware and life-safety Calls button policies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-3">
            <label className="flex items-center justify-between text-slate-800 font-medium">
              <span>Program & Calls Pushbuttons</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.hardware.hasButtons}
                onChange={(e) =>
                  onUpdateConfig({
                    hardware: { ...config.hardware, hasButtons: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-1">Prog Button GPIO</span>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={config.hardware.progButtonGpio}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        progButtonGpio: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Calls Button GPIO</span>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={config.hardware.callsButtonGpio}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        callsButtonGpio: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-slate-800 font-medium">
              <span>Rotary Volume Control Knob</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.hardware.hasKnob}
                onChange={(e) =>
                  onUpdateConfig({
                    hardware: { ...config.hardware, hasKnob: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-1">Encoder A (CLK)</span>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={config.hardware.encoderAGpio}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        encoderAGpio: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Encoder B (DT)</span>
                <input
                  type="number"
                  disabled={!isAdmin}
                  value={config.hardware.encoderBGpio}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        encoderBGpio: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between text-slate-800 font-medium">
              <span>Small I2C OLED Display</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.hardware.hasOled}
                onChange={(e) =>
                  onUpdateConfig({
                    hardware: { ...config.hardware, hasOled: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block mb-1">Display Driver</span>
                <select
                  disabled={!isAdmin}
                  value={config.hardware.oledModel}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        oledModel: e.target.value as 'SSD1306 128x64' | 'SH1106 128x64',
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                >
                  <option value="SSD1306 128x64">SSD1306 128x64</option>
                  <option value="SH1106 128x64">SH1106 128x64</option>
                </select>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Sleep Timeout (s)</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  disabled={!isAdmin}
                  value={config.hardware.oledTimeoutSec}
                  onChange={(e) =>
                    onUpdateConfig({
                      hardware: {
                        ...config.hardware,
                        oledTimeoutSec: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Disable "None" on Calls Button Policy */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-slate-900">
                Allow "None" Selection on Calls Circuit
              </div>
              <p className="text-xs text-slate-500">
                When unchecked, the physical Calls button cycles strictly between Stage and All Calls and prevents silencing paging circuits.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={config.allowNoneCalls}
              onChange={(e) =>
                onUpdateConfig({ allowNoneCalls: e.target.checked })
              }
              className="accent-blue-600 h-4 w-4"
            />
            <span>{config.allowNoneCalls ? 'None Allowed' : 'None Disabled (Enforced)'}</span>
          </label>
        </div>
      </section>

      {/* PoE Power Minimization & Schedule Window */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Armbian PoE Power Minimization
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reduces idle PoE budget across large speaker deployments.
              </p>
            </div>
            <span className="text-sm font-mono font-semibold text-slate-900">
              {runtime.estimatedPoeWatts.toFixed(2)} W
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-600 block mb-1">CPU Frequency Governor</label>
              <select
                disabled={!isAdmin}
                value={config.power.cpuGovernor}
                onChange={(e) =>
                  onUpdateConfig({
                    power: {
                      ...config.power,
                      cpuGovernor: e.target.value as CpuGovernor,
                    },
                  })
                }
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
              >
                <option value="powersave">powersave (Lowest PoE draw · 408 MHz idle)</option>
                <option value="ondemand">ondemand (Dynamic scaling)</option>
                <option value="schedutil">schedutil (Low-latency DSP priority)</option>
              </select>
            </div>

            <label className="flex items-center justify-between py-1 text-slate-800">
              <span>Class-D Amplifier SD_MODE GPIO auto-shutdown when idle</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.ampAutoShutdown}
                onChange={(e) =>
                  onUpdateConfig({
                    power: { ...config.power, ampAutoShutdown: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between py-1 text-slate-800">
              <span>Disable HDMI display subsystem (-0.35 W)</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.disableHdmi}
                onChange={(e) =>
                  onUpdateConfig({
                    power: { ...config.power, disableHdmi: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between py-1 text-slate-800">
              <span>Disable Wi-Fi & Bluetooth radios on PoE Ethernet (-0.30 W)</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.disableWifiBt}
                onChange={(e) =>
                  onUpdateConfig({
                    power: { ...config.power, disableWifiBt: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>

            <label className="flex items-center justify-between py-1 text-slate-800">
              <span>Disable SBC heartbeat & Ethernet LEDs (-0.08 W)</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.disableBoardLeds}
                onChange={(e) =>
                  onUpdateConfig({
                    power: { ...config.power, disableBoardLeds: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>
          </div>
        </section>

        {/* Quiet / Low-Power Schedule Window */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Scheduled Low-Power & Silent Mode
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically silences program audio and shuts down amplifier outside working hours.
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.scheduleEnabled}
                onChange={(e) =>
                  onUpdateConfig({
                    power: { ...config.power, scheduleEnabled: e.target.checked },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-slate-600 block mb-1">Window Start</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={config.power.windowStart}
                  onChange={(e) =>
                    onUpdateConfig({
                      power: { ...config.power, windowStart: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Window End</label>
                <input
                  type="time"
                  disabled={!isAdmin}
                  value={config.power.windowEnd}
                  onChange={(e) =>
                    onUpdateConfig({
                      power: { ...config.power, windowEnd: e.target.value },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1">Scheduled Action</label>
                <select
                  disabled={!isAdmin}
                  value={config.power.scheduleMode}
                  onChange={(e) =>
                    onUpdateConfig({
                      power: {
                        ...config.power,
                        scheduleMode: e.target.value as PowerScheduleMode,
                      },
                    })
                  }
                  className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="low_power">Deep Low Power (Amp + OLED Off)</option>
                  <option value="silent">Silent Mode (Mute Program Only)</option>
                </select>
              </div>
            </div>

            <label className="flex items-center justify-between py-1 text-slate-800">
              <span>Emergency All-Call wakes speaker during schedule window</span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={config.power.emergencyAllCallWake}
                onChange={(e) =>
                  onUpdateConfig({
                    power: {
                      ...config.power,
                      emergencyAllCallWake: e.target.checked,
                    },
                  })
                }
                className="accent-blue-600 h-4 w-4"
              />
            </label>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-600">
                Test schedule state on OLED & PoE telemetry
              </span>
              <button
                type="button"
                disabled={!isAdmin}
                onClick={() =>
                  onUpdateConfig({
                    power: {
                      ...config.power,
                      simulateScheduleActive: !config.power.simulateScheduleActive,
                    },
                  })
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  config.power.simulateScheduleActive
                    ? 'bg-blue-600 text-white border-blue-700'
                    : 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {config.power.simulateScheduleActive
                  ? 'Exit Simulated Window'
                  : 'Simulate Off-Hours Window'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
