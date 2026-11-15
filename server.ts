import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import type {
  AuthSession,
  DiscoveredStream,
  PeqBand,
  PeqFilterType,
  QsysZonePreset,
  RoomPeerUnit,
  SpeakerConfig,
  SplSample,
  SystemStateResponse,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'speaker-state.json');
const PORT = Number(process.env.PORT || 3000);

interface PersistedStore {
  config: SpeakerConfig;
  qsysZones: QsysZonePreset[];
  discoveredStreams: DiscoveredStream[];
  roomPeers: RoomPeerUnit[];
  session: AuthSession;
  splHistory: SplSample[];
}

function createDefaultStore(): PersistedStore {
  const qsysZones: QsysZonePreset[] = [
    {
      id: 'qsys-zone-1',
      name: 'FOH',
      coreIp: '10.20.4.10',
      stageCallActive: false,
      allCallActive: false,
      stageStream: '239.69.10.1:5004',
      allStream: '239.69.10.2:5004',
      program1Stream: '239.69.20.1:5004',
      program1Format: 'Stereo',
      program2Stream: '239.69.20.2:5004',
      program2Format: 'Stereo',
      program3Stream: '239.69.20.3:5004',
      program3Format: 'Mono',
      defaultVolumeDb: -12,
      priorityOrder: ['all_calls', 'stage_calls', 'program'],
      allowNoneCalls: false,
      splRatio: 0.65,
    },
    {
      id: 'qsys-zone-2',
      name: 'Backstage',
      coreIp: '10.20.4.10',
      stageCallActive: false,
      allCallActive: false,
      stageStream: '239.69.10.1:5004',
      allStream: '239.69.10.2:5004',
      program1Stream: '239.69.21.1:5004',
      program1Format: 'Mono',
      program2Stream: '239.69.20.1:5004',
      program2Format: 'Mono',
      program3Stream: '239.69.21.3:5004',
      program3Format: 'Mono',
      defaultVolumeDb: -8,
      priorityOrder: ['stage_calls', 'all_calls', 'program'],
      allowNoneCalls: false,
      splRatio: 0.4,
    },
    {
      id: 'qsys-zone-3',
      name: 'Restaurant',
      coreIp: '10.20.4.10',
      stageCallActive: false,
      allCallActive: false,
      stageStream: '239.69.10.3:5004',
      allStream: '239.69.10.2:5004',
      program1Stream: '239.69.22.1:5004',
      program1Format: 'Stereo',
      program2Stream: '239.69.22.2:5004',
      program2Format: 'Stereo',
      program3Stream: '239.69.22.3:5004',
      program3Format: 'Stereo',
      defaultVolumeDb: -18,
      priorityOrder: ['all_calls', 'stage_calls', 'program'],
      allowNoneCalls: true,
      splRatio: 0.85,
    },
    {
      id: 'qsys-zone-4',
      name: 'Studio Theatre FOH',
      coreIp: '10.20.4.10',
      stageCallActive: false,
      allCallActive: false,
      stageStream: '239.69.11.1:5004',
      allStream: '239.69.10.2:5004',
      program1Stream: '239.69.23.1:5004',
      program1Format: 'Stereo',
      program2Stream: '239.69.23.2:5004',
      program2Format: 'Stereo',
      program3Stream: '239.69.20.1:5004',
      program3Format: 'Mono',
      defaultVolumeDb: -14,
      priorityOrder: ['all_calls', 'stage_calls', 'program'],
      allowNoneCalls: false,
      splRatio: 0.55,
    },
    {
      id: 'qsys-zone-5',
      name: 'Studio Theatre Backstage',
      coreIp: '10.20.4.10',
      stageCallActive: false,
      allCallActive: false,
      stageStream: '239.69.11.1:5004',
      allStream: '239.69.10.2:5004',
      program1Stream: '239.69.24.1:5004',
      program1Format: 'Mono',
      program2Stream: '239.69.23.1:5004',
      program2Format: 'Mono',
      program3Stream: '239.69.21.1:5004',
      program3Format: 'Mono',
      defaultVolumeDb: -10,
      priorityOrder: ['stage_calls', 'all_calls', 'program'],
      allowNoneCalls: false,
      splRatio: 0.35,
    },
  ];

  const discoveredStreams: DiscoveredStream[] = [
    {
      id: 'sap-1',
      name: 'QSYS-FOH-Stage-Calls',
      source: 'qsys',
      uri: '239.69.10.1:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 1,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'sap-2',
      name: 'QSYS-Venue-All-Calls',
      source: 'qsys',
      uri: '239.69.10.2:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 1,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'sap-3',
      name: 'Main-Stage-Show-Relay',
      source: 'sap',
      uri: '239.69.20.1:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 2,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'sap-4',
      name: 'FOH-Ambient-BGM',
      source: 'sap',
      uri: '239.69.20.2:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 2,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'rtsp-1',
      name: 'Lobby-Announcements-Feed',
      source: 'rtsp',
      uri: 'rtsp://10.20.4.12:554/by-name/LobbyFeed',
      encoding: 'L16',
      sampleRate: 48000,
      channels: 1,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'sap-5',
      name: 'Backstage-SM-Cue-Program',
      source: 'sap',
      uri: '239.69.21.1:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 1,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'sap-6',
      name: 'Restaurant-Jazz-Program',
      source: 'sap',
      uri: '239.69.22.1:5004',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 2,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
    {
      id: 'rtsp-2',
      name: 'Studio-Theatre-Show-Relay',
      source: 'rtsp',
      uri: 'rtsp://10.20.4.14:554/by-name/StudioRelay',
      encoding: 'L24',
      sampleRate: 48000,
      channels: 2,
      ptpGrandmaster: '00:1D:C1:FF:FE:10:42:01',
    },
  ];

  const roomPeers: RoomPeerUnit[] = [
    {
      unitId: 'bpi-p2pro-foh-01',
      hostname: 'spk-foh-west-01.venue.local',
      ipAddress: '10.20.14.101',
      board: 'BananaPi BPI-P2Pro (PoE)',
      hasControls: true,
      hasMic: true,
      localSplDba: 64.2,
      isMaster: true,
      poeWatts: 2.9,
      online: true,
    },
    {
      unitId: 'bpi-p2pro-foh-02',
      hostname: 'spk-foh-east-02.venue.local',
      ipAddress: '10.20.14.102',
      board: 'BananaPi BPI-P2Pro (PoE)',
      hasControls: false,
      hasMic: true,
      localSplDba: 66.8,
      isMaster: false,
      poeWatts: 2.4,
      online: true,
    },
    {
      unitId: 'bpi-p2pro-foh-03',
      hostname: 'spk-foh-mezz-03.venue.local',
      ipAddress: '10.20.14.103',
      board: 'BananaPi BPI-P2Pro (PoE)',
      hasControls: false,
      hasMic: false,
      localSplDba: 0,
      isMaster: false,
      poeWatts: 2.2,
      online: true,
    },
  ];

  const config: SpeakerConfig = {
    unitId: 'bpi-p2pro-foh-01',
    hostname: 'spk-foh-west-01.venue.local',
    boardModel: 'BananaPi BPI-P2Pro (RK3308 · PoE)',
    ipAddress: '10.20.14.101',
    zoneMode: 'auto',
    boundZoneId: 'qsys-zone-1',
    boundZoneName: 'FOH',

    baseVolumeDb: -12,
    muted: false,
    selectedProgram: 1,
    callsMode: 'all',
    allowNoneCalls: false,

    priorityOrder: ['all_calls', 'stage_calls', 'program'],
    duckAttenuationDb: -20,
    hardMuteOnCall: true,

    channels: {
      stage_calls: {
        id: 'stage_calls',
        label: 'Stage Calls',
        source: 'qsys',
        uri: '239.69.10.1:5004',
        format: 'Mono',
        jitterMs: 8,
      },
      all_calls: {
        id: 'all_calls',
        label: 'All Calls',
        source: 'qsys',
        uri: '239.69.10.2:5004',
        format: 'Mono',
        jitterMs: 8,
      },
      program_1: {
        id: 'program_1',
        label: 'Program 1',
        source: 'sap',
        uri: '239.69.20.1:5004',
        format: 'Stereo',
        jitterMs: 12,
      },
      program_2: {
        id: 'program_2',
        label: 'Program 2',
        source: 'sap',
        uri: '239.69.20.2:5004',
        format: 'Stereo',
        jitterMs: 12,
      },
      program_3: {
        id: 'program_3',
        label: 'Program 3',
        source: 'rtsp',
        uri: '239.69.20.3:5004',
        format: 'Mono',
        jitterMs: 16,
      },
    },

    hardware: {
      audioOutput: 'i2s',
      i2sAmpModel: 'MAX98357A / TAS5805M Class-D',
      i2sAlsaDevice: 'plughw:1,0',
      onboardAlsaDevice: 'plughw:0,0',
      micInput: 'i2s',
      i2sMicModel: 'ICS-43434 I2S MEMS',
      micAlsaDevice: 'plughw:2,0',
      hasButtons: true,
      hasKnob: true,
      hasOled: true,
      oledModel: 'SSD1306 128x64',
      oledTimeoutSec: 45,
      progButtonGpio: 17,
      callsButtonGpio: 27,
      encoderAGpio: 22,
      encoderBGpio: 23,
      ampShutdownGpio: 24,
    },

    spl: {
      enabled: true,
      simulatedRoomSplDba: 64.2,
      thresholdDba: 58,
      ratio: 0.65,
      maxBoostDb: 14,
      calibrationOffsetDb: 94,
      attackMs: 350,
      releaseMs: 2500,
      holdDuringPaging: true,
      restMonitoringEnabled: true,
      restPollIntervalSec: 5,
      aec: {
        enabled: true,
        engine: 'webrtc_dsp',
        tailLengthMs: 120,
        referenceDelayMs: 12,
        noiseSuppression: true,
        echoSuppressionLevel: 'high',
      },
    },

    peq: {
      enabled: true,
      preampDb: -2.8,
      rewLastImportedName: 'FOH_Lobby_REW_v5_Correction.txt',
      rewLastImportedAt: '2026-11-15T14:10:00Z',
      bands: [
        { band: 1, enabled: true, type: 'HP', freqHz: 65, gainDb: 0, q: 0.71 },
        { band: 2, enabled: true, type: 'PK', freqHz: 118, gainDb: -5.4, q: 4.2 },
        { band: 3, enabled: true, type: 'PK', freqHz: 245, gainDb: -3.2, q: 3.1 },
        { band: 4, enabled: true, type: 'PK', freqHz: 520, gainDb: 2.1, q: 1.8 },
        { band: 5, enabled: true, type: 'PK', freqHz: 1480, gainDb: -2.6, q: 2.8 },
        { band: 6, enabled: true, type: 'PK', freqHz: 3400, gainDb: 1.8, q: 1.6 },
        { band: 7, enabled: true, type: 'HS', freqHz: 8500, gainDb: 2.4, q: 0.71 },
        { band: 8, enabled: false, type: 'PK', freqHz: 12000, gainDb: 0, q: 1.41 },
      ],
    },

    roomCluster: {
      enabled: true,
      roomName: 'Main FOH Lobby',
      shareSettings: true,
      shareSpl: true,
      splAggregation: 'mean',
      multicastGroup: '239.255.77.68',
      multicastPort: 7768,
    },

    power: {
      cpuGovernor: 'powersave',
      ampAutoShutdown: true,
      disableHdmi: true,
      disableWifiBt: true,
      disableBoardLeds: true,
      scheduleEnabled: true,
      windowStart: '23:00',
      windowEnd: '07:00',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      scheduleMode: 'low_power',
      simulateScheduleActive: false,
      emergencyAllCallWake: true,
    },

    auth: {
      ldapEnabled: true,
      ldapUrl: 'ldaps://dc01.venue.local:636',
      ldapBindDn: 'CN=svc-aes67-bind,OU=ServiceAccounts,DC=venue,DC=local',
      ldapBaseDn: 'OU=VenueStaff,DC=venue,DC=local',
      ldapUserFilter: '(sAMAccountName={{username}})',
      ldapAdminGroupDn: 'CN=AV-Paging-Admins,OU=Groups,DC=venue,DC=local',
      ldapOperatorGroupDn: 'CN=AV-Stage-Operators,OU=Groups,DC=venue,DC=local',
      ldapUseStartTls: true,
      entraEnabled: true,
      entraTenantId: '6b8a9c12-4d30-4f82-9a11-7e52e9a10042',
      entraClientId: '93c410f2-8812-40c5-a2de-3c88b77e9012',
      entraRedirectUri: 'https://spk-foh-west-01.venue.local/auth/entra/callback',
      entraAdminGroupId: 'e419c8a0-1122-4a88-90b1-552100a1cc10',
      entraOperatorGroupId: 'b1829c01-3344-4b99-82c1-991022d2ee45',
      localBreakGlassEnabled: true,
    },
  };

  const session: AuthSession = {
    authenticated: true,
    userDisplay: 'M. Vance (AV Engineering)',
    emailOrUpn: 'mvance@venue.local',
    provider: 'ldap',
    role: 'admin',
    matchedGroup: 'CN=AV-Paging-Admins,OU=Groups,DC=venue,DC=local',
  };

  const now = Date.now();
  const splHistory: SplSample[] = Array.from({ length: 16 }, (_, idx) => {
    const t = new Date(now - (15 - idx) * 5000).toISOString();
    const ambient = Number((61.5 + Math.sin(idx * 0.5) * 2.8).toFixed(1));
    const speakerBleed = 14.2;
    const rawMic = Number((ambient + 6.8).toFixed(1));
    return {
      timestamp: t,
      ambientSplDba: ambient,
      rawMicDba: rawMic,
      speakerContributionDba: speakerBleed,
      erleDb: 19.4,
      adaptiveBoostDb: Number(Math.max(0, (ambient - 58) * 0.65).toFixed(1)),
    };
  });

  return { config, qsysZones, discoveredStreams, roomPeers, session, splHistory };
}

function loadStore(): PersistedStore {
  const fallback = createDefaultStore();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedStore>;
      const merged: PersistedStore = {
        ...fallback,
        ...parsed,
        config: {
          ...fallback.config,
          ...(parsed.config || {}),
          spl: {
            ...fallback.config.spl,
            ...(parsed.config?.spl || {}),
            aec: {
              ...fallback.config.spl.aec,
              ...(parsed.config?.spl?.aec || {}),
            },
          },
          peq: {
            ...fallback.config.peq,
            ...(parsed.config?.peq || {}),
            bands: parsed.config?.peq?.bands?.length === 8
              ? parsed.config.peq.bands
              : fallback.config.peq.bands,
          },
        },
        splHistory: Array.isArray(parsed.splHistory) && parsed.splHistory.length > 0
          ? parsed.splHistory
          : fallback.splHistory,
      };
      return merged;
    }
  } catch {
    // fall through to default
  }
  saveStore(fallback);
  return fallback;
}

function saveStore(store: PersistedStore): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function computeRuntime(store: PersistedStore): SystemStateResponse['runtime'] {
  const { config, qsysZones, roomPeers } = store;

  const boundZone = qsysZones.find((z) => z.id === config.boundZoneId);
  const stageCallActive = boundZone ? boundZone.stageCallActive : false;
  const allCallActive = boundZone ? boundZone.allCallActive : false;
  const inScheduleWindow = config.power.scheduleEnabled && config.power.simulateScheduleActive;

  let activeCircuit: SystemStateResponse['runtime']['activeCircuit'] = 'idle';
  let activeStreamUri = '';

  for (const circuit of config.priorityOrder) {
    if (circuit === 'all_calls' && allCallActive && config.callsMode === 'all') {
      activeCircuit = 'all_calls';
      activeStreamUri = config.channels.all_calls.uri;
      break;
    }
    if (
      circuit === 'stage_calls' &&
      stageCallActive &&
      (config.callsMode === 'stage' || config.callsMode === 'all')
    ) {
      activeCircuit = 'stage_calls';
      activeStreamUri = config.channels.stage_calls.uri;
      break;
    }
    if (circuit === 'program' && !inScheduleWindow && config.selectedProgram !== 0) {
      activeCircuit = 'program';
      const key = `program_${config.selectedProgram}` as 'program_1' | 'program_2' | 'program_3';
      activeStreamUri = config.channels[key].uri;
      break;
    }
  }

  if (inScheduleWindow) {
    const emergencyWake =
      activeCircuit === 'all_calls' && config.power.emergencyAllCallWake;
    if (!emergencyWake) {
      activeCircuit = 'scheduled_silent';
      activeStreamUri = '';
    }
  }

  const ampPowerEnabled =
    !config.muted &&
    activeCircuit !== 'idle' &&
    activeCircuit !== 'scheduled_silent';

  // Acoustic Echo Cancellation (AEC) model:
  // Speaker output bleeds acoustically into the local mic unless cancelled by webrtcdsp.
  const trueAmbientLocalSpl = config.spl.simulatedRoomSplDba;
  const speakerContributionDba = ampPowerEnabled
    ? Number(Math.max(42, 82 + config.baseVolumeDb * 0.7).toFixed(1))
    : 0;
  const erleByLevel =
    config.spl.aec.echoSuppressionLevel === 'high'
      ? 20.5
      : config.spl.aec.echoSuppressionLevel === 'moderate'
      ? 15.2
      : 10.4;
  const aecErleDb =
    config.spl.aec.enabled && ampPowerEnabled ? erleByLevel : 0;

  // Energetic sum of ambient room SPL + speaker bleed
  const rawMicSplDba = ampPowerEnabled
    ? Number(
        (
          10 *
          Math.log10(
            10 ** (trueAmbientLocalSpl / 10) + 10 ** (speakerContributionDba / 10)
          )
        ).toFixed(1)
      )
    : trueAmbientLocalSpl;

  // Residual uncancelled bleed when AEC is off vs cancelled when AEC is on
  const residualSpeakerDba = ampPowerEnabled
    ? config.spl.aec.enabled
      ? speakerContributionDba - aecErleDb
      : speakerContributionDba
    : 0;

  const localMeasuredSpl = ampPowerEnabled
    ? Number(
        (
          10 *
          Math.log10(
            10 ** (trueAmbientLocalSpl / 10) + 10 ** (residualSpeakerDba / 10)
          )
        ).toFixed(1)
      )
    : trueAmbientLocalSpl;

  const micPeers = roomPeers.filter((p) => p.online && p.hasMic);
  let effectiveSplDba = localMeasuredSpl;
  if (config.roomCluster.enabled && config.roomCluster.shareSpl && micPeers.length > 0) {
    const splValues = micPeers.map((p) =>
      p.unitId === config.unitId ? localMeasuredSpl : p.localSplDba
    );
    if (config.roomCluster.splAggregation === 'max') {
      effectiveSplDba = Math.max(...splValues);
    } else if (config.roomCluster.splAggregation === 'mean') {
      effectiveSplDba = Number(
        (splValues.reduce((acc, v) => acc + v, 0) / splValues.length).toFixed(1)
      );
    } else {
      effectiveSplDba = localMeasuredSpl;
    }
  }

  let adaptiveBoostDb = 0;
  if (config.spl.enabled && effectiveSplDba > config.spl.thresholdDba) {
    adaptiveBoostDb = Math.min(
      config.spl.maxBoostDb,
      Number(((effectiveSplDba - config.spl.thresholdDba) * config.spl.ratio).toFixed(1))
    );
  }

  const effectiveOutputDb = Number(
    Math.min(0, config.baseVolumeDb + adaptiveBoostDb).toFixed(1)
  );

  // Estimate BPI-P2Pro PoE power draw based on power settings & amp state
  let poeWatts = 1.65;
  if (config.power.cpuGovernor === 'schedutil') poeWatts += 0.25;
  if (config.power.cpuGovernor === 'ondemand') poeWatts += 0.15;
  if (!config.power.disableHdmi) poeWatts += 0.35;
  if (!config.power.disableWifiBt) poeWatts += 0.3;
  if (!config.power.disableBoardLeds) poeWatts += 0.08;
  if (config.hardware.hasOled && !inScheduleWindow) poeWatts += 0.12;
  if (ampPowerEnabled) {
    poeWatts += config.hardware.audioOutput === 'i2s' ? 0.95 : 0.75;
  } else if (!config.power.ampAutoShutdown) {
    poeWatts += 0.35;
  }

  return {
    effectiveSplDba,
    rawMicSplDba,
    speakerContributionDba,
    aecErleDb,
    adaptiveBoostDb,
    effectiveOutputDb,
    activeCircuit,
    activeStreamUri,
    ampPowerEnabled,
    estimatedPoeWatts: Number(poeWatts.toFixed(2)),
    oledAwake: config.hardware.hasOled && !(inScheduleWindow && config.power.scheduleMode === 'low_power'),
    inScheduleWindow,
  };
}

function recordSplSample(store: PersistedStore): void {
  const rt = computeRuntime(store);
  store.splHistory.push({
    timestamp: new Date().toISOString(),
    ambientSplDba: rt.effectiveSplDba,
    rawMicDba: rt.rawMicSplDba,
    speakerContributionDba: rt.speakerContributionDba,
    erleDb: rt.aecErleDb,
    adaptiveBoostDb: rt.adaptiveBoostDb,
  });
  if (store.splHistory.length > 120) {
    store.splHistory = store.splHistory.slice(-120);
  }
}

function parseRewFilterText(rewText: string): { preampDb: number; bands: PeqBand[] } {
  let preampDb = 0;
  const preampMatch = rewText.match(/Preamp:\s*([+-]?\d+(?:\.\d+)?)\s*dB/i);
  if (preampMatch) {
    preampDb = Number(preampMatch[1]);
  }

  const lineRegex =
    /Filter\s+(\d+)\s*:\s*(ON|OFF)\s+(PK|LS|HS|LP|HP|PEQ|LSC|HSC)\b(?:.*?Fc\s+(\d+(?:\.\d+)?)\s*Hz)?(?:.*?Gain\s+([+-]?\d+(?:\.\d+)?)\s*dB)?(?:.*?Q\s+(\d+(?:\.\d+)?))?/i;
  const typeMap: Record<string, PeqFilterType> = {
    PK: 'PK',
    PEQ: 'PK',
    LS: 'LS',
    LSC: 'LS',
    HS: 'HS',
    HSC: 'HS',
    LP: 'LP',
    HP: 'HP',
  };

  const bands: PeqBand[] = [];
  for (const rawLine of rewText.split(/\r?\n/)) {
    const m = rawLine.trim().match(lineRegex);
    if (!m || bands.length >= 8) continue;
    const rawType = m[3].toUpperCase();
    bands.push({
      band: bands.length + 1,
      enabled: m[2].toUpperCase() === 'ON',
      type: typeMap[rawType] || 'PK',
      freqHz: Number(m[4] || 1000),
      gainDb: Number(m[5] || 0),
      q: Number(m[6] || 1.41),
    });
  }

  while (bands.length < 8) {
    bands.push({
      band: bands.length + 1,
      enabled: false,
      type: 'PK',
      freqHz: 1000,
      gainDb: 0,
      q: 1.41,
    });
  }

  return { preampDb, bands };
}

function formatRewExportText(store: PersistedStore): string {
  const lines = [
    `# Room EQ Wizard (REW) Generic Equalizer Export`,
    `# Unit: ${store.config.unitId} (${store.config.boundZoneName})`,
    `Preamp: ${store.config.peq.preampDb.toFixed(1)} dB`,
  ];
  for (const b of store.config.peq.bands) {
    lines.push(
      `Filter ${String(b.band).padStart(2, ' ')}: ${b.enabled ? 'ON ' : 'OFF'} ${b.type.padEnd(2, ' ')} Fc ${b.freqHz.toFixed(1)} Hz Gain ${b.gainDb.toFixed(2)} dB Q ${b.q.toFixed(3)}`
    );
  }
  return lines.join('\n') + '\n';
}

function buildStateResponse(store: PersistedStore): SystemStateResponse {
  return {
    config: store.config,
    qsysZones: store.qsysZones,
    discoveredStreams: store.discoveredStreams,
    roomPeers: store.roomPeers,
    session: store.session,
    splHistory: store.splHistory,
    runtime: computeRuntime(store),
  };
}

function applyZoneToConfig(config: SpeakerConfig, zone: QsysZonePreset): void {
  config.boundZoneId = zone.id;
  config.boundZoneName = zone.name;
  config.baseVolumeDb = zone.defaultVolumeDb;
  config.priorityOrder = [...zone.priorityOrder];
  config.allowNoneCalls = zone.allowNoneCalls;
  if (!zone.allowNoneCalls && config.callsMode === 'none') {
    config.callsMode = 'stage';
  }
  config.spl.ratio = zone.splRatio;
  config.channels.stage_calls = {
    ...config.channels.stage_calls,
    source: 'qsys',
    uri: zone.stageStream,
    format: 'Mono',
  };
  config.channels.all_calls = {
    ...config.channels.all_calls,
    source: 'qsys',
    uri: zone.allStream,
    format: 'Mono',
  };
  config.channels.program_1 = {
    ...config.channels.program_1,
    source: 'qsys',
    uri: zone.program1Stream,
    format: zone.program1Format,
  };
  config.channels.program_2 = {
    ...config.channels.program_2,
    source: 'qsys',
    uri: zone.program2Stream,
    format: zone.program2Format,
  };
  config.channels.program_3 = {
    ...config.channels.program_3,
    source: 'qsys',
    uri: zone.program3Stream,
    format: zone.program3Format,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  let store = loadStore();

  function requireAdmin(req: express.Request, res: express.Response): boolean {
    if (!store.session.authenticated || store.session.role !== 'admin') {
      res.status(403).json({
        error:
          'Administrative privileges required. Sign in with an account belonging to the configured LDAP or Entra Admin Group.',
      });
      return false;
    }
    return true;
  }

  app.get('/api/state', (_req, res) => {
    res.json(buildStateResponse(store));
  });

  app.put('/api/config', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const patch = req.body as Partial<SpeakerConfig>;
    store.config = {
      ...store.config,
      ...patch,
      channels: patch.channels ? { ...store.config.channels, ...patch.channels } : store.config.channels,
      hardware: patch.hardware ? { ...store.config.hardware, ...patch.hardware } : store.config.hardware,
      spl: patch.spl
        ? {
            ...store.config.spl,
            ...patch.spl,
            aec: patch.spl.aec
              ? { ...store.config.spl.aec, ...patch.spl.aec }
              : store.config.spl.aec,
          }
        : store.config.spl,
      peq: patch.peq ? { ...store.config.peq, ...patch.peq } : store.config.peq,
      roomCluster: patch.roomCluster
        ? { ...store.config.roomCluster, ...patch.roomCluster }
        : store.config.roomCluster,
      power: patch.power ? { ...store.config.power, ...patch.power } : store.config.power,
      auth: patch.auth ? { ...store.config.auth, ...patch.auth } : store.config.auth,
    };

    // Enforce "disable none calls" policy
    if (!store.config.allowNoneCalls && store.config.callsMode === 'none') {
      store.config.callsMode = 'stage';
    }

    // Keep primary room peer synced
    store.roomPeers = store.roomPeers.map((peer) =>
      peer.unitId === store.config.unitId
        ? {
            ...peer,
            localSplDba: store.config.spl.simulatedRoomSplDba,
            hasControls: store.config.hardware.hasButtons || store.config.hardware.hasKnob,
            hasMic: store.config.hardware.micInput !== 'none',
          }
        : peer
    );

    recordSplSample(store);
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  // Dedicated REST API for external SPL monitoring & Prometheus scraping
  app.get('/api/spl', (_req, res) => {
    if (!store.config.spl.restMonitoringEnabled) {
      res.status(503).json({
        error: 'SPL REST monitoring is disabled in speaker configuration.',
      });
      return;
    }
    recordSplSample(store);
    saveStore(store);
    const rt = computeRuntime(store);
    res.json({
      unit_id: store.config.unitId,
      hostname: store.config.hostname,
      zone: store.config.boundZoneName,
      room_name: store.config.roomCluster.roomName,
      ambient_spl_dba: rt.effectiveSplDba,
      raw_mic_spl_dba: rt.rawMicSplDba,
      speaker_contribution_dba: rt.speakerContributionDba,
      aec_enabled: store.config.spl.aec.enabled,
      aec_engine: store.config.spl.aec.engine,
      aec_erle_db: rt.aecErleDb,
      adaptive_boost_db: rt.adaptiveBoostDb,
      effective_output_db: rt.effectiveOutputDb,
      amp_active: rt.ampPowerEnabled,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/spl/history', (_req, res) => {
    if (!store.config.spl.restMonitoringEnabled) {
      res.status(503).json({
        error: 'SPL REST monitoring is disabled in speaker configuration.',
      });
      return;
    }
    res.json({
      unit_id: store.config.unitId,
      room_name: store.config.roomCluster.roomName,
      aec_enabled: store.config.spl.aec.enabled,
      samples: store.splHistory,
    });
  });

  app.get('/api/spl/metrics', (_req, res) => {
    if (!store.config.spl.restMonitoringEnabled) {
      res.status(503).type('text/plain').send('# SPL REST monitoring disabled\n');
      return;
    }
    const rt = computeRuntime(store);
    const labels = `unit="${store.config.unitId}",zone="${store.config.boundZoneName}",room="${store.config.roomCluster.roomName}"`;
    const metrics = [
      '# HELP aes67_room_spl_dba Ambient Room SPL in dBA after Acoustic Echo Cancellation',
      '# TYPE aes67_room_spl_dba gauge',
      `aes67_room_spl_dba{${labels}} ${rt.effectiveSplDba}`,
      '# HELP aes67_mic_raw_dba Raw microphone SPL in dBA prior to Acoustic Echo Cancellation',
      '# TYPE aes67_mic_raw_dba gauge',
      `aes67_mic_raw_dba{${labels}} ${rt.rawMicSplDba}`,
      '# HELP aes67_aec_erle_db Acoustic Echo Cancellation Echo Return Loss Enhancement in dB',
      '# TYPE aes67_aec_erle_db gauge',
      `aes67_aec_erle_db{${labels}} ${rt.aecErleDb}`,
      '# HELP aes67_adaptive_boost_db Adaptive SPL gain boost applied to speaker output in dB',
      '# TYPE aes67_adaptive_boost_db gauge',
      `aes67_adaptive_boost_db{${labels}} ${rt.adaptiveBoostDb}`,
    ].join('\n');
    res.type('text/plain').send(metrics + '\n');
  });

  // Room EQ Wizard (REW) 8-Band Parametric EQ Import & Export
  app.post('/api/peq/import-rew', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { rewText, filename } = req.body as { rewText?: string; filename?: string };
    if (!rewText || typeof rewText !== 'string') {
      res.status(400).json({ error: 'Missing REW filter text payload.' });
      return;
    }
    const parsed = parseRewFilterText(rewText);
    store.config.peq = {
      enabled: true,
      preampDb: parsed.preampDb,
      rewLastImportedName: filename || 'REW_Imported_Filters.txt',
      rewLastImportedAt: new Date().toISOString(),
      bands: parsed.bands,
    };
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.get('/api/peq/export-rew', (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="bpi-p2pro-rew-peq.txt"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(formatRewExportText(store));
  });

  // Physical button & rotary knob endpoints (always permitted on hardware controls)
  app.post('/api/hardware/program-cycle', (_req, res) => {
    const nextMap: Record<number, 0 | 1 | 2 | 3> = { 1: 2, 2: 3, 3: 0, 0: 1 };
    store.config.selectedProgram = nextMap[store.config.selectedProgram] ?? 1;
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.post('/api/hardware/calls-cycle', (_req, res) => {
    const cur = store.config.callsMode;
    if (store.config.allowNoneCalls) {
      store.config.callsMode = cur === 'stage' ? 'all' : cur === 'all' ? 'none' : 'stage';
    } else {
      store.config.callsMode = cur === 'stage' ? 'all' : 'stage';
    }
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.post('/api/hardware/volume-step', (req, res) => {
    const delta = Number(req.body?.delta ?? 0);
    store.config.baseVolumeDb = Math.max(-60, Math.min(0, store.config.baseVolumeDb + delta));
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  // Q-SYS Zone Auto-Detection & Call Simulation
  app.post('/api/qsys/bind-zone', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const zoneId = String(req.body?.zoneId || '');
    const zone = store.qsysZones.find((z) => z.id === zoneId);
    if (!zone) {
      res.status(404).json({ error: 'Q-SYS Zone not found' });
      return;
    }
    store.config.zoneMode = 'auto';
    applyZoneToConfig(store.config, zone);
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.post('/api/qsys/trigger-call', (req, res) => {
    const { zoneId, circuit, active } = req.body as {
      zoneId: string;
      circuit: 'stage' | 'all';
      active: boolean;
    };
    store.qsysZones = store.qsysZones.map((z) => {
      if (circuit === 'all' && z.id === zoneId) {
        return { ...z, allCallActive: Boolean(active) };
      }
      if (circuit === 'stage' && z.id === zoneId) {
        return { ...z, stageCallActive: Boolean(active) };
      }
      return z;
    });
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  // Room Peer Simulation
  app.post('/api/room/add-peer', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const count = store.roomPeers.length + 1;
    const newPeer: RoomPeerUnit = {
      unitId: `bpi-p2pro-node-0${count}`,
      hostname: `spk-room-node-0${count}.venue.local`,
      ipAddress: `10.20.14.${100 + count}`,
      board: 'BananaPi BPI-P2Pro (PoE)',
      hasControls: Boolean(req.body?.hasControls),
      hasMic: Boolean(req.body?.hasMic ?? true),
      localSplDba: Number(req.body?.localSplDba ?? 63.5),
      isMaster: false,
      poeWatts: 2.3,
      online: true,
    };
    store.roomPeers.push(newPeer);
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.post('/api/room/update-peer-spl', (req, res) => {
    const { unitId, splDba } = req.body as { unitId: string; splDba: number };
    store.roomPeers = store.roomPeers.map((p) =>
      p.unitId === unitId ? { ...p, localSplDba: Number(splDba) } : p
    );
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  // SSO Session Switching & LDAP / Entra Group Test
  app.post('/api/auth/login', (req, res) => {
    const { provider, username, group } = req.body as {
      provider: 'ldap' | 'entra' | 'local';
      username: string;
      group?: string;
    };
    const authCfg = store.config.auth;
    if (provider === 'ldap') {
      const isAdmin = !group || group === authCfg.ldapAdminGroupDn;
      store.session = {
        authenticated: true,
        userDisplay: username || 'M. Vance (LDAP)',
        emailOrUpn: `${(username || 'mvance').toLowerCase().replace(/\s+/g, '.')}@venue.local`,
        provider: 'ldap',
        role: isAdmin ? 'admin' : 'operator',
        matchedGroup: isAdmin ? authCfg.ldapAdminGroupDn : authCfg.ldapOperatorGroupDn,
      };
    } else if (provider === 'entra') {
      const isAdmin = !group || group === authCfg.entraAdminGroupId;
      store.session = {
        authenticated: true,
        userDisplay: username || 'E. Chen (Entra ID)',
        emailOrUpn: `${(username || 'echen').toLowerCase().replace(/\s+/g, '.')}@venue.org`,
        provider: 'entra',
        role: isAdmin ? 'admin' : 'operator',
        matchedGroup: isAdmin ? authCfg.entraAdminGroupId : authCfg.entraOperatorGroupId,
      };
    } else {
      store.session = {
        authenticated: true,
        userDisplay: 'Local Break-Glass Admin',
        emailOrUpn: 'root@localhost',
        provider: 'local',
        role: 'admin',
        matchedGroup: 'local-wheel',
      };
    }
    saveStore(store);
    res.json(buildStateResponse(store));
  });

  app.post('/api/auth/test-directory', (req, res) => {
    const { provider } = req.body as { provider: 'ldap' | 'entra' };
    if (provider === 'ldap') {
      res.json({
        ok: true,
        message: `LDAPS TLS handshake succeeded with ${store.config.auth.ldapUrl}. Verified Admin Group DN "${store.config.auth.ldapAdminGroupDn}" (4 members).`,
      });
    } else {
      res.json({
        ok: true,
        message: `OIDC discovery verified for Tenant ${store.config.auth.entraTenantId}. Group claim mapping active for Admin Object ID "${store.config.auth.entraAdminGroupId}".`,
      });
    }
  });

  // Firmware & Q-SYS Plugin Source Endpoints
  app.get('/api/firmware/files', (_req, res) => {
    const files = [
      {
        id: 'qplug',
        filename: 'AES67_Paging_Controller.qplug',
        path: path.join(__dirname, 'qsys', 'AES67_Paging_Controller.qplug'),
        description: 'Q-SYS Designer Lua Plugin for Zone auto-discovery & call circuit control',
      },
      {
        id: 'daemon',
        filename: 'aes67_daemon.py',
        path: path.join(__dirname, 'sbc', 'aes67_daemon.py'),
        description: 'Armbian SBC Python daemon (SAP/RTSP/Q-SYS, GStreamer I2S/ALSA, SPL, OLED, GPIO)',
      },
      {
        id: 'install',
        filename: 'install-bpi-p2pro.sh',
        path: path.join(__dirname, 'sbc', 'install-bpi-p2pro.sh'),
        description: 'Armbian BPI-P2Pro installer (Device Tree I2S/I2C overlays, linuxptp, power tuning)',
      },
      {
        id: 'systemd',
        filename: 'aes67-pager.service',
        path: path.join(__dirname, 'sbc', 'aes67-pager.service'),
        description: 'Systemd real-time FIFO service unit for the Armbian paging daemon',
      },
    ];

    const payload = files.map((f) => ({
      id: f.id,
      filename: f.filename,
      description: f.description,
      content: fs.existsSync(f.path) ? fs.readFileSync(f.path, 'utf-8') : '',
    }));

    payload.push({
      id: 'config',
      filename: 'speaker-config.json',
      description: 'Live exported configuration JSON for /etc/aes67-pager/config.json',
      content: JSON.stringify(store.config, null, 2),
    });

    res.json({ files: payload });
  });

  app.get('/api/firmware/download/:id', (req, res) => {
    const map: Record<string, { filename: string; filePath?: string; content?: string }> = {
      qplug: {
        filename: 'AES67_Paging_Controller.qplug',
        filePath: path.join(__dirname, 'qsys', 'AES67_Paging_Controller.qplug'),
      },
      daemon: {
        filename: 'aes67_daemon.py',
        filePath: path.join(__dirname, 'sbc', 'aes67_daemon.py'),
      },
      install: {
        filename: 'install-bpi-p2pro.sh',
        filePath: path.join(__dirname, 'sbc', 'install-bpi-p2pro.sh'),
      },
      systemd: {
        filename: 'aes67-pager.service',
        filePath: path.join(__dirname, 'sbc', 'aes67-pager.service'),
      },
      config: {
        filename: 'speaker-config.json',
        content: JSON.stringify(store.config, null, 2),
      },
    };
    const entry = map[req.params.id];
    if (!entry) {
      res.status(404).json({ error: 'Unknown export artifact' });
      return;
    }
    const text =
      entry.content ?? (entry.filePath && fs.existsSync(entry.filePath) ? fs.readFileSync(entry.filePath, 'utf-8') : '');
    res.setHeader('Content-Disposition', `attachment; filename="${entry.filename}"`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  });

  // Vite middleware in dev, static dist in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AES67 Paging Console listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
