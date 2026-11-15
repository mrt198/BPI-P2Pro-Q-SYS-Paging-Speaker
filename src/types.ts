export type DiscoverySource = 'sap' | 'rtsp' | 'qsys';
export type AudioChannelFormat = 'Mono' | 'Mono (Sum L+R)' | 'Stereo';
export type CallsMode = 'stage' | 'all' | 'none';
export type ProgramSlot = 0 | 1 | 2 | 3; // 0 = None
export type AudioOutputType = 'i2s' | 'onboard';
export type MicInputType = 'i2s' | 'onboard' | 'none';
export type SplAggregation = 'mean' | 'max' | 'primary';
export type PowerScheduleMode = 'silent' | 'low_power';
export type CpuGovernor = 'powersave' | 'ondemand' | 'schedutil';
export type PriorityCircuit = 'all_calls' | 'stage_calls' | 'program';
export type AuthRole = 'admin' | 'operator';
export type AuthProvider = 'ldap' | 'entra' | 'local';
export type PeqFilterType = 'PK' | 'LS' | 'HS' | 'LP' | 'HP';
export type AecEngine = 'webrtc_dsp' | 'speex_dsp';

export interface PeqBand {
  band: number;
  enabled: boolean;
  type: PeqFilterType;
  freqHz: number;
  gainDb: number;
  q: number;
}

export interface PeqConfig {
  enabled: boolean;
  preampDb: number;
  rewLastImportedName: string;
  rewLastImportedAt: string;
  bands: PeqBand[];
}

export interface AecConfig {
  enabled: boolean;
  engine: AecEngine;
  tailLengthMs: number;
  referenceDelayMs: number;
  noiseSuppression: boolean;
  echoSuppressionLevel: 'low' | 'moderate' | 'high';
}

export interface SplSample {
  timestamp: string;
  ambientSplDba: number;
  rawMicDba: number;
  speakerContributionDba: number;
  erleDb: number;
  adaptiveBoostDb: number;
}

export interface ReceiveChannelConfig {
  id: 'stage_calls' | 'all_calls' | 'program_1' | 'program_2' | 'program_3';
  label: string;
  source: DiscoverySource;
  uri: string;
  format: AudioChannelFormat;
  jitterMs: number;
}

export interface DiscoveredStream {
  id: string;
  name: string;
  source: DiscoverySource;
  uri: string;
  encoding: 'L24' | 'L16';
  sampleRate: number;
  channels: number;
  ptpGrandmaster: string;
}

export interface QsysZonePreset {
  id: string;
  name: string;
  coreIp: string;
  stageCallActive: boolean;
  allCallActive: boolean;
  stageStream: string;
  allStream: string;
  program1Stream: string;
  program1Format: AudioChannelFormat;
  program2Stream: string;
  program2Format: AudioChannelFormat;
  program3Stream: string;
  program3Format: AudioChannelFormat;
  defaultVolumeDb: number;
  priorityOrder: PriorityCircuit[];
  allowNoneCalls: boolean;
  splRatio: number;
}

export interface RoomPeerUnit {
  unitId: string;
  hostname: string;
  ipAddress: string;
  board: string;
  hasControls: boolean;
  hasMic: boolean;
  localSplDba: number;
  isMaster: boolean;
  poeWatts: number;
  online: boolean;
}

export interface SpeakerConfig {
  unitId: string;
  hostname: string;
  boardModel: string;
  ipAddress: string;
  zoneMode: 'auto' | 'manual';
  boundZoneId: string;
  boundZoneName: string;

  // Live audio control
  baseVolumeDb: number;
  muted: boolean;
  selectedProgram: ProgramSlot;
  callsMode: CallsMode;
  allowNoneCalls: boolean;

  // Priority & ducking
  priorityOrder: PriorityCircuit[];
  duckAttenuationDb: number;
  hardMuteOnCall: boolean;

  // 5 receive channels
  channels: {
    stage_calls: ReceiveChannelConfig;
    all_calls: ReceiveChannelConfig;
    program_1: ReceiveChannelConfig;
    program_2: ReceiveChannelConfig;
    program_3: ReceiveChannelConfig;
  };

  // Hardware I/O
  hardware: {
    audioOutput: AudioOutputType;
    i2sAmpModel: string;
    i2sAlsaDevice: string;
    onboardAlsaDevice: string;
    micInput: MicInputType;
    i2sMicModel: string;
    micAlsaDevice: string;
    hasButtons: boolean;
    hasKnob: boolean;
    hasOled: boolean;
    oledModel: 'SSD1306 128x64' | 'SH1106 128x64';
    oledTimeoutSec: number;
    progButtonGpio: number;
    callsButtonGpio: number;
    encoderAGpio: number;
    encoderBGpio: number;
    ampShutdownGpio: number;
  };

  // Room SPL adaptive gain & Acoustic Echo Cancellation
  spl: {
    enabled: boolean;
    simulatedRoomSplDba: number;
    thresholdDba: number;
    ratio: number;
    maxBoostDb: number;
    calibrationOffsetDb: number;
    attackMs: number;
    releaseMs: number;
    holdDuringPaging: boolean;
    restMonitoringEnabled: boolean;
    restPollIntervalSec: number;
    aec: AecConfig;
  };

  // 8-Band Parametric EQ (Room Correction / REW)
  peq: PeqConfig;

  // Room clustering
  roomCluster: {
    enabled: boolean;
    roomName: string;
    shareSettings: boolean;
    shareSpl: boolean;
    splAggregation: SplAggregation;
    multicastGroup: string;
    multicastPort: number;
  };

  // Power & schedules
  power: {
    cpuGovernor: CpuGovernor;
    ampAutoShutdown: boolean;
    disableHdmi: boolean;
    disableWifiBt: boolean;
    disableBoardLeds: boolean;
    scheduleEnabled: boolean;
    windowStart: string;
    windowEnd: string;
    daysOfWeek: string[];
    scheduleMode: PowerScheduleMode;
    simulateScheduleActive: boolean;
    emergencyAllCallWake: boolean;
  };

  // LDAP & Entra SSO
  auth: {
    ldapEnabled: boolean;
    ldapUrl: string;
    ldapBindDn: string;
    ldapBaseDn: string;
    ldapUserFilter: string;
    ldapAdminGroupDn: string;
    ldapOperatorGroupDn: string;
    ldapUseStartTls: boolean;
    entraEnabled: boolean;
    entraTenantId: string;
    entraClientId: string;
    entraRedirectUri: string;
    entraAdminGroupId: string;
    entraOperatorGroupId: string;
    localBreakGlassEnabled: boolean;
  };
}

export interface AuthSession {
  authenticated: boolean;
  userDisplay: string;
  emailOrUpn: string;
  provider: AuthProvider;
  role: AuthRole;
  matchedGroup: string;
}

export interface SystemStateResponse {
  config: SpeakerConfig;
  qsysZones: QsysZonePreset[];
  discoveredStreams: DiscoveredStream[];
  roomPeers: RoomPeerUnit[];
  session: AuthSession;
  splHistory: SplSample[];
  runtime: {
    effectiveSplDba: number;
    rawMicSplDba: number;
    speakerContributionDba: number;
    aecErleDb: number;
    adaptiveBoostDb: number;
    effectiveOutputDb: number;
    activeCircuit: 'all_calls' | 'stage_calls' | 'program' | 'idle' | 'scheduled_silent';
    activeStreamUri: string;
    ampPowerEnabled: boolean;
    estimatedPoeWatts: number;
    oledAwake: boolean;
    inScheduleWindow: boolean;
  };
}
