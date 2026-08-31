/**
 * Central home for gameplay tuning constants (ARCHITECTURE.md rule 5).
 *
 * Values here are lifted verbatim from the inline magic numbers that used to live in
 * `gameEngine.ts`; extracting them changes nothing about behaviour, it just puts the
 * dials in one place. Grouped by the subsystem that owns them.
 */

/** V9 motorcycle arcade physics — see MotorcyclePhysics. */
export const BIKE = {
  // Acceleration (m/s²) by state
  accelOutOfFuel: 7,
  accelBoost: 40,
  accelNormal: 24,

  // Forward speed cap (m/s) by state
  maxSpeedOutOfFuel: 6,
  maxSpeedBoost: 45,
  maxSpeedNormal: 28,

  // Reverse speed floor (m/s)
  reverseMaxOutOfFuel: -4,
  reverseMaxNormal: -12,

  brakeDecel: 38, // m/s² when braking while moving forward
  reverseAccel: 16, // m/s² when accelerating into reverse
  frictionPerFrame: 0.92, // coast decay, applied as pow(x, dt*60)
  idleDecayControlled: 0.9, // speed *= this per frame when not actively controlled

  nitroDrainPerSec: 25,
  nitroRegenPerSec: 10,

  // Fuel burn
  fuelBurnBase: 1.1,
  fuelBurnSpeedScale: 1.5, // × (speed / maxSpeedNormal)
  fuelBurnBoostBonus: 3.2,
  fuelBurnSilentMult: 0.45,
  fuelBurnDriftBonus: 0.7,
  lowFuelAlertCooldownMs: 15000,

  steerBase: 3.4,
  steerAssistFactor: 0.45, // × settings.steeringAssist
  steerDriftMult: 1.6,
  leanNormal: 0.42,
  leanDrift: 0.58,
  leanLerpNormal: 8,
  leanLerpDrift: 12,
  leanReturnLerp: 10,
  steerAngleDegScale: 55, // state.steerAngleDeg = lean × this

  driftMinSpeed: 8,
  driftScorePerSec: 25,

  gravity: 22, // m/s² while airborne
  rampLaunchImpulse: 14.5, // × ramp.boostForce
  rampMinSpeed: 13,
  rampScore: 150,

  worldBound: 165, // ± clamp on x/z
  wheelRadius: 0.38, // for wheel-spin visual
} as const;

/** Security bots, vision cones, CHAOS meter, escort-out — see StealthAI. */
export const STEALTH = {
  patrolSpeed: 2.2, // m/s
  patrolArriveDist: 0.6,
  investigateSpeed: 3.3,
  alertSpeed: 4.4,
  searchSpeed: 2.4,

  silentDetectMult: 0.5, // detection range while riding in silent mode
  alertRisePerSec: 1.5, // toward 1.0 when the player is in a vision cone
  alertDecayPerSec: 0.8,

  curiousDurationSec: 2.4,
  curiousToInvestigateSec: 0.7, // held in cone
  investigateToAlertSec: 0.55,
  searchDurationSec: 5.5,
  hearInvestigateDist: 9,

  engineNoiseSpeed: 12, // m/s on bike, not silent
  engineHearRadius: 18,
  sprintHearRadius: 14,
  hornHearRadius: 22,
  gadgetHearRadius: 16,
  decoyHearRadius: 24,

  empDisableMs: 9000,
  empBotXP: 60,
  relayHitDist: 14,
  relayXP: 250,

  escortDurationSec: 3.5,
  escortLerpPerSec: 3,

  navLinkDist: 28,
  /** Guards this close to an alarming camera start investigating. */
  cameraAlarmRadius: 22,
} as const;

/**
 * Distance activation / LOD (spec §25). Fractions of the active quality drawDistance.
 */
export const LOD = {
  /** Traffic + pedestrians skip simulation beyond this fraction of camera.far. */
  agentRange: 0.36,
  /** Street-light SpotLights disable beyond this. */
  lightRange: 0.2,
  /** Trees / benches hide beyond this; inner canopy LOD at 0.55 of it. */
  propRange: 0.48,
} as const;

/**
 * City-wide CHAOS heat (spec §17). Owned by ChaosAlertManager — StealthAI no longer
 * writes chaosAlertLevel. Progress is 0–100 toward the next level, not a bot clone.
 */
export const CHAOS = {
  maxLevel: 5,

  /** ~10 s of being watched climbs L0 → L1. */
  sightRisePerSec: 10,
  progressAfterLevelUp: 18,
  progressAfterLevelDown: 72,
  caughtProgressBump: 35,

  naturalDecayPerSec: 4,
  hideWarmupSec: 3.5,
  hideDecayPerSec: 12,
  escapeRadius: 60,
  escapeDecayPerSec: 18,
  safeCenter: [-70, 0, -48] as [number, number, number],
  safeRadius: 22,
  safeWarmupSec: 2,
  safeDecayPerSec: 28,
  undergroundDecayPerSec: 18,
  disguiseCooldownSec: 15,
  disguiseProgressDrop: 50,
  agentSuitProgressDrop: 12,
  trackerEmpLevelDrop: 1,

  cameraViewDistance: 14,
  cameraViewAngle: 50,
  cameraSweepAmp: 0.7, // radians
  cameraSweepSpeed: 0.55,
  cameraEnhanceRangeMult: 1.6,
  cameraEnhanceSweepMult: 2.2,
  cameraEnhanceConeOpacity: 0.42,

  searchOrbitRadius: 12,
  searchOrbitHeight: 11,
  searchOrbitSpeed: 0.55,
  searchViewDistance: 20,
  searchViewAngle: 42,

  interceptorSpeed: 20, // m/s — below V9 cruise (28) and boost (45)
  interceptorHeight: 8,
  interceptorStandoff: 10,
  interceptorViewDistance: 16,

  trackerFollowLerp: 2.4,
  trackerHeight: 5.2,

  eliteSpeed: 12,
  eliteCatchDist: 2.4,
  eliteScale: 1.65,

  roadblockBumpMaxSpeed: 5,
  roadblockSlots: [
    { position: [10, 0, -30] as [number, number, number], yaw: 0 },
    { position: [70, 0, 10] as [number, number, number], yaw: Math.PI / 2 },
    { position: [-10, 0, 30] as [number, number, number], yaw: 0 },
  ],

  empDisableMs: 9000,

  levelNames: [
    'Clear',
    'Search Drone',
    'Enhanced Cameras',
    'Interceptors',
    'Roadblocks',
    'Elite Pursuit',
  ] as const,
} as const;

/** Chase / action / FPV / tactical camera feel — see CameraRig. */
export const CAMERA = {
  dragYawSensitivity: 0.008,
  dragPitchSensitivity: 0.006,
  pitchOffsetMin: -0.4,
  pitchOffsetMax: 0.7,
  /** Only used while the followed subject is actually moving — never while standing still. */
  recenterLerpPerSec: 2.2,
  recenterMinBikeSpeed: 4,
  /** Stick / trigger must exceed this before look-around recenters. */
  moveDeadzone: 0.28,

  posLerpDefault: 11,
  posLerpLook: 20,
  posLerpFPV: 22,
  fovLerpPerSec: 6,

  fovBaseChase: 65,
  fovBaseAction: 70,
  fovBaseFPV: 76,
  fovBoostBonus: 14,
  fovSpeedBonusMax: 10,

  fpvVibMinSpeed: 15,
} as const;

/** Story mission proximity gates & rewards — see MissionRunner. */
export const MISSION = {
  step1ReachDist: 15,
  step2ScanDist: 10,
  step4SpeedPathMinY: 6,
  step4SpeedPathDist: 15,
  bossStepIndex: 4,
  objectiveXP: 200,
} as const;

/** Plaza rogue-drone tagger (Officer Jax side quest). */
export const DRONE_TAG = {
  id: 'side_drone_tag',
  count: 4,
  empRadius: 14,
  foamRadius: 3.8,
  smartsHackDist: 5.5,
  heightSlack: 10,
  winHoldSec: 2.6,
} as const;

export const ROGUE_DRONE_FLIGHTS: readonly {
  radius: number;
  height: number;
  speed: number;
  cx: number;
  cz: number;
  phase: number;
}[] = [
  { radius: 14, height: 8.5, speed: 0.72, cx: 0, cz: 0, phase: 0 },
  { radius: 20, height: 11, speed: -0.55, cx: 4, cz: -6, phase: 1.2 },
  { radius: 11, height: 7.2, speed: 0.95, cx: -8, cz: 8, phase: 2.4 },
  { radius: 17, height: 13.5, speed: -0.42, cx: 6, cz: 10, phase: 0.6 },
];

/** Downtown checkpoint sprint (spec §19) — see RaceManager. */
export const RACE = {
  downtownId: 'side_race_downtown',
  parTimeSec: 45,
  countdownSec: 3,
  passRadius: 6.5, // xz metres — jumps still count
  wrongGateCooldownSec: 1.4,
  winHoldSec: 2.4,
} as const;

/** Street-level loop around Central Plaza. Index 0 is the start gate (near Maya). */
export const DOWNTOWN_RACE_GATES: readonly (readonly [number, number, number])[] = [
  [18, 1.2, 0],
  [0, 1.2, -30],
  [-30, 1.2, -30],
  [-30, 1.2, 0],
  [-30, 1.2, 30],
  [0, 1.2, 30],
  [30, 1.2, 30],
  [30, 1.2, 0],
];

/**
 * Motorcycle chase (spec §18) — see ChaseController.
 * Speed adapts only when the player is TOO CLOSE (drone pulls away). It never
 * slows down to wait — that's the unfair rubber-band the spec forbids.
 */
export const CHASE = {
  storyStepIndex: 2,
  cruiseSpeed: 14, // m/s — below V9 cruise (28) so a kid can catch up
  closeSpeedMult: 1.2,
  empSlowMult: 0.6,
  empSlowSec: 4.5,
  flyHeight: 9,
  minBand: 14, // closer than this → drone edges forward
  maxBand: 36, // comfortable follow distance
  loseRadius: 58,
  winRadius: 28, // must be this close at the last waypoint
  failFillPerSec: 18, // ~5.5 s fully out of range to trip a recovery
  failDrainPerSec: 28,
  recoverHoldSec: 1.6,
  maxRecoveries: 3,
  obstacleBumpMaxSpeed: 8,
  path: [
    [0, 9, -100],
    [12, 9, -68],
    [0, 9, -36],
    [0, 9, 8],
    [42, 9, 8],
    [72, 9, -16],
    [92, 9, 12],
    [85, 9, 28],
  ] as readonly (readonly [number, number, number])[],
  obstacles: [
    [8, 0, -48],
    [28, 0, 6],
    [78, 0, -8],
  ] as readonly (readonly [number, number, number])[],
} as const;
