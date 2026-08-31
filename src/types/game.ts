export type AgentRank = 
  | 'Rookie' 
  | 'Explorer' 
  | 'Investigator' 
  | 'Field Agent' 
  | 'Special Agent' 
  | 'Elite Agent' 
  | 'V9 Agent';

export type GadgetType = 
  | 'emp' 
  | 'foam' 
  | 'drone' 
  | 'hologram' 
  | 'remote_v9';

export type DisguiseType = 
  | 'agent_suit' 
  | 'delivery_worker' 
  | 'maintenance_tech' 
  | 'lab_scientist' 
  | 'race_crew';

export interface VehicleCustomization {
  bodyColor: string;
  secondaryColor: string;
  underglowColor: string;
  rimColor: string;
  decalStyle: 'stripes' | 'cyber' | 'stealth' | 'flames' | 'academy';
  exhaustEffect: 'blue_flame' | 'neon_spark' | 'stealth_smoke' | 'golden_sparkle';
  suitColor: string;
}

export interface PlayerStats {
  xp: number;
  rank: AgentRank;
  credits: number;
  secretsFound: number;
  stuntsCompleted: number;
  missionsCompleted: string[];
  unlockedDisguises: DisguiseType[];
  unlockedGadgets: GadgetType[];
  unlockedUpgrades: string[];
  bestRaceTimes: Record<string, number>;
  stuntHighScore: number;
}

export type MissionPathChoice = 'speed' | 'stealth' | 'smarts' | 'undecided';

export interface MissionStep {
  id: string;
  title: string;
  instruction: string;
  targetPosition: [number, number, number];
  approachHint: {
    speed: string;
    stealth: string;
    smarts: string;
  };
  completed: boolean;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  category: 'story' | 'side_race' | 'stunt' | 'hack' | 'chase';
  steps: MissionStep[];
  currentStepIndex: number;
  chosenPath?: MissionPathChoice;
  rewardXP: number;
  rewardCredits: number;
  unlockedReward?: string;
  active: boolean;
  completed: boolean;
}

export interface CollectibleItem {
  id: string;
  name: string;
  type: 'spy_drive' | 'prototype_part' | 'stunt_ring';
  position: [number, number, number];
  collected: boolean;
  hint: string;
}

export type GuardState = 'unaware' | 'curious' | 'investigating' | 'alert' | 'searching';

export interface RestrictedZone {
  id: string;
  allowedDisguises: DisguiseType[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface SecurityBot {
  id: string;
  type: 'guard_bot' | 'camera' | 'drone' | 'hunter';
  position: [number, number, number];
  rotation: number;
  patrolPoints?: [number, number, number][];
  currentPatrolIndex?: number;
  viewAngle: number; // degrees
  viewDistance: number;
  alertLevel: number; // 0 to 1 — derived from GuardState for radar / CHAOS
  disabledUntil: number; // timestamp
  trappedByFoamUntil: number; // timestamp
  name: string;
  /** Restricted zone this bot enforces; disguise check is data-driven from the zone. */
  zoneId?: string;
}

export interface FuelStation {
  id: string;
  name: string;
  position: [number, number, number];
  active: boolean;
}

export type POICategory = 'story' | 'side' | 'fuel' | 'landmark' | 'locker' | 'terminal' | 'stunt' | 'secret';

export interface CityPOI {
  id: string;
  name: string;
  category: POICategory;
  position: [number, number, number];
  description: string;
  iconType: string;
  district: string;
}

export interface GPSRoute {
  destinationId: string;
  destinationName: string;
  targetPos: [number, number, number];
  waypoints: [number, number, number][];
  totalDistance: number;
  etaSeconds: number;
  nextTurnInstruction: string;
}

export interface NPCLocal {
  id: string;
  name: string;
  title: string;
  avatarColor: string;
  position: [number, number, number];
  rotation: number;
  district: string;
  dialogue: string[];
  sideQuestId?: string;
  sideQuestOffer?: string;
}

export type CameraMode = 'chase' | 'action' | 'fpv' | 'tactical';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface GameSettings {
  soundVolume: number;
  musicVolume: number;
  voiceVolume: number;
  steeringAssist: number; // 0 to 1
  timeLimitMinutes: number; // 0 for infinite, parental timer
  touchControls: boolean;
  touchControlMode: 'joystick' | 'dpad';
  qualityLevel: QualityLevel; // LOW / MEDIUM / HIGH graphics preset (spec §26)
  showControlsHelper: boolean;
  /** Tiny FPS chip — for on-tablet B4 profiling. Off by default. */
  showPerfHud: boolean;
}

export interface RadarEntity {
  id: string;
  type: 'player' | 'bike' | 'drone' | 'traffic' | 'bot' | 'camera' | 'fuel' | 'terminal' | 'locker' | 'collectible' | 'objective' | 'npc' | 'poi' | 'chaos';
  x: number;
  z: number;
  rot?: number;
  label?: string;
  alert?: number; // 0 to 1
  status?: string;
  style?: string;
  category?: POICategory;
}
