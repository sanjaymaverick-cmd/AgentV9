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

  silentDetectMult: 0.5, // detection range while riding in silent mode
  alertRisePerSec: 1.5, // toward 1.0 when the player is in a vision cone
  alertDecayPerSec: 0.8,

  empDisableMs: 9000,
  empBotXP: 60,
  relayHitDist: 14,
  relayXP: 250,

  escortDurationSec: 3.5,
  escortLerpPerSec: 3,
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
  dragYawSensitivity: 0.006,
  dragPitchSensitivity: 0.005,
  pitchOffsetMin: -0.4,
  pitchOffsetMax: 0.7,
  recenterLerpPerSec: 2.5,
  recenterMinBikeSpeed: 4,

  posLerpDefault: 9,
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
  step3FollowDist: 18,
  step4SpeedPathMinY: 6,
  step4SpeedPathDist: 15,
  step4StealthDist: 12,
  bossStepIndex: 4,
  objectiveXP: 200,
} as const;
