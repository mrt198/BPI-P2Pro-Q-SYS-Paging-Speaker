import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AudioWaveform,
  Cpu,
  Download,
  FileCode2,
  Menu,
  Radio,
  Shield,
  Sliders,
  X,
} from 'lucide-react';
import { AccessSsoTab } from './components/AccessSsoTab';
import { DeploymentTab } from './components/DeploymentTab';
import { HardwarePowerTab } from './components/HardwarePowerTab';
import { OverviewTab } from './components/OverviewTab';
import { RoomEqTab } from './components/RoomEqTab';
import { SplRoomTab } from './components/SplRoomTab';
import { StreamsZonesTab } from './components/StreamsZonesTab';
import type { SpeakerConfig, SystemStateResponse } from './types';

type NavTab =
  | 'overview'
  | 'streams'
  | 'spl_room'
  | 'room_eq'
  | 'hardware_power'
  | 'access_sso'
  | 'deployment';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview & Controls', icon: Sliders },
  { id: 'streams', label: 'Streams & Q-SYS Zones', icon: Radio },
  { id: 'spl_room', label: 'Room SPL, AEC & API', icon: Activity },
  { id: 'room_eq', label: 'Room EQ (8-Band PEQ)', icon: AudioWaveform },
  { id: 'hardware_power', label: 'Hardware & PoE Power', icon: Cpu },
  { id: 'access_sso', label: 'LDAP & Entra SSO', icon: Shield },
  { id: 'deployment', label: 'SBC & Q-SYS Code', icon: FileCode2 },
];

export default function App() {
  const [state, setState] = useState<SystemStateResponse | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = (await res.json()) as SystemStateResponse;
        setState(data);
      }
    } catch {
      setErrorMsg('Unable to reach paging speaker daemon API.');
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleApiUpdate = async (
    url: string,
    method: 'PUT' | 'POST',
    body?: unknown
  ) => {
    setErrorMsg(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Operation rejected by speaker policy.');
        return;
      }
      setState(data as SystemStateResponse);
    } catch {
      setErrorMsg('Network error communicating with speaker daemon.');
    }
  };

  const handleUpdateConfig = (patch: Partial<SpeakerConfig>) => {
    handleApiUpdate('/api/config', 'PUT', patch);
  };

  const handleProgramCycle = () => {
    handleApiUpdate('/api/hardware/program-cycle', 'POST');
  };

  const handleCallsCycle = () => {
    handleApiUpdate('/api/hardware/calls-cycle', 'POST');
  };

  const handleVolumeStep = (delta: number) => {
    handleApiUpdate('/api/hardware/volume-step', 'POST', { delta });
  };

  const handleBindZone = (zoneId: string) => {
    handleApiUpdate('/api/qsys/bind-zone', 'POST', { zoneId });
  };

  const handleToggleCall = (circuit: 'stage' | 'all', active: boolean) => {
    if (!state) return;
    handleApiUpdate('/api/qsys/trigger-call', 'POST', {
      zoneId: state.config.boundZoneId,
      circuit,
      active,
    });
  };

  const handleAddPeer = (hasMic: boolean, hasControls: boolean) => {
    handleApiUpdate('/api/room/add-peer', 'POST', { hasMic, hasControls });
  };

  const handleUpdatePeerSpl = (unitId: string, splDba: number) => {
    handleApiUpdate('/api/room/update-peer-spl', 'POST', { unitId, splDba });
  };

  const handleImportRew = (rewText: string, filename: string) => {
    handleApiUpdate('/api/peq/import-rew', 'POST', { rewText, filename });
  };

  const handleLoginAs = (
    provider: 'ldap' | 'entra' | 'local',
    username: string,
    group?: string
  ) => {
    handleApiUpdate('/api/auth/login', 'POST', { provider, username, group });
  };

  const handleTestDirectory = async (provider: 'ldap' | 'entra') => {
    const res = await fetch('/api/auth/test-directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    });
    return (await res.json()) as { ok: boolean; message: string };
  };

  const currentNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? 'Overview';

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm text-slate-600 font-mono">
          Loading BPI-P2Pro AES67 Paging Console...
        </div>
      </div>
    );
  }

  const isAdmin = state.session.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-150 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-display font-bold text-sm tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              BPI-P2Pro AES67 Pager
            </span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1 text-slate-500 hover:text-slate-900"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Unit & Session Footer inside Sidebar */}
        <div className="p-4 border-t border-slate-200 text-xs space-y-2">
          <div>
            <div className="text-slate-400">Target Hardware</div>
            <div className="font-mono text-slate-800 truncate">
              {state.config.unitId}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Signed In ({state.session.provider.toUpperCase()})</div>
            <div className="text-slate-800 font-medium truncate">
              {state.session.userDisplay}
            </div>
            <div className="text-slate-500">
              {isAdmin ? 'Admin Group Access' : 'Operator (Read-Only)'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-8 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 border border-slate-200 rounded text-slate-600"
              aria-label="Open navigation"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500 whitespace-nowrap">
                {state.config.boundZoneName}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline text-xs font-mono text-slate-500 whitespace-nowrap">
              {state.config.ipAddress} · {state.runtime.effectiveOutputDb.toFixed(1)} dB
            </span>
            <a
              href="/api/firmware/download/config"
              download="speaker-config.json"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Config</span>
            </a>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1280px] w-full mx-auto space-y-5">
          {!isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-4">
              <span>
                Signed in with Read-Only Operator privileges ({state.session.matchedGroup}). Configuration edits require LDAP or Entra Admin Group membership.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('access_sso')}
                className="font-semibold underline whitespace-nowrap shrink-0"
              >
                Switch Session
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2.5 text-xs text-red-800 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
              onProgramCycle={handleProgramCycle}
              onCallsCycle={handleCallsCycle}
              onVolumeStep={handleVolumeStep}
              onToggleCall={handleToggleCall}
            />
          )}

          {activeTab === 'streams' && (
            <StreamsZonesTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
              onBindZone={handleBindZone}
              onToggleCall={handleToggleCall}
            />
          )}

          {activeTab === 'spl_room' && (
            <SplRoomTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
              onAddPeer={handleAddPeer}
              onUpdatePeerSpl={handleUpdatePeerSpl}
              onRefreshState={loadState}
            />
          )}

          {activeTab === 'room_eq' && (
            <RoomEqTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
              onImportRew={handleImportRew}
            />
          )}

          {activeTab === 'hardware_power' && (
            <HardwarePowerTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
            />
          )}

          {activeTab === 'access_sso' && (
            <AccessSsoTab
              state={state}
              isAdmin={isAdmin}
              onUpdateConfig={handleUpdateConfig}
              onLoginAs={handleLoginAs}
              onTestDirectory={handleTestDirectory}
            />
          )}

          {activeTab === 'deployment' && <DeploymentTab />}
        </main>
      </div>
    </div>
  );
}
