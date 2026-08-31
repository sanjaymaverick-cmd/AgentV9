import { BIKE } from './tunables';

/**
 * Numeric V9 arcade step (spec §5) — no Three.js, no audio, no scene.
 *
 * MotorcyclePhysics feeds engine fields in, then copies them back so visuals, ramps
 * and collision stay where they are. Tests drive this function directly.
 */
export interface ArcadeBike {
  bikeSpeed: number;
  bikeRot: number;
  bikeLean: number;
  bikeX: number;
  bikeY: number;
  bikeZ: number;
  bikeVerticalVel: number;
  isBikeGrounded: boolean;
  isDrifting: boolean;
  fuelLevel: number;
  nitroLevel: number;
  steerAngleDeg: number;
}

export interface ArcadeDriveInput {
  analogThrottle: number;
  analogSteer: number;
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  drift: boolean;
  jump: boolean;
}

export interface ArcadeDriveContext {
  isControlActive: boolean;
  isBoosting: boolean;
  isRefueling: boolean;
  isSilentMode: boolean;
  steeringAssist: number;
  input: ArcadeDriveInput;
}

export function makeArcadeBike(overrides: Partial<ArcadeBike> = {}): ArcadeBike {
  return {
    bikeSpeed: 0,
    bikeRot: 0,
    bikeLean: 0,
    bikeX: 0,
    bikeY: 0,
    bikeZ: 0,
    bikeVerticalVel: 0,
    isBikeGrounded: true,
    isDrifting: false,
    fuelLevel: 100,
    nitroLevel: 100,
    steerAngleDeg: 0,
    ...overrides,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** One simulation tick. Mutates `bike` in place. */
export function stepMotorcycleArcade(bike: ArcadeBike, ctx: ArcadeDriveContext, dt: number): void {
  const isOutOfFuel = bike.fuelLevel <= 0;
  const accel = isOutOfFuel ? BIKE.accelOutOfFuel : ctx.isBoosting ? BIKE.accelBoost : BIKE.accelNormal;
  const maxSpeed = isOutOfFuel ? BIKE.maxSpeedOutOfFuel : ctx.isBoosting ? BIKE.maxSpeedBoost : BIKE.maxSpeedNormal;
  const reverseMax = isOutOfFuel ? BIKE.reverseMaxOutOfFuel : BIKE.reverseMaxNormal;
  const input = ctx.input;

  if (input.boost && ctx.isControlActive && bike.nitroLevel > 0 && !isOutOfFuel) {
    bike.nitroLevel = Math.max(0, bike.nitroLevel - dt * BIKE.nitroDrainPerSec);
  } else {
    bike.nitroLevel = Math.min(100, bike.nitroLevel + dt * BIKE.nitroRegenPerSec);
  }

  if (ctx.isControlActive && Math.abs(bike.bikeSpeed) > 0.4 && !ctx.isRefueling) {
    let fuelBurnRate = BIKE.fuelBurnBase + (Math.abs(bike.bikeSpeed) / BIKE.maxSpeedNormal) * BIKE.fuelBurnSpeedScale;
    if (ctx.isBoosting) {
      fuelBurnRate += BIKE.fuelBurnBoostBonus;
    }
    if (ctx.isSilentMode) {
      fuelBurnRate *= BIKE.fuelBurnSilentMult;
    }
    if (bike.isDrifting) {
      fuelBurnRate += BIKE.fuelBurnDriftBonus;
    }
    bike.fuelLevel = Math.max(0, bike.fuelLevel - fuelBurnRate * dt);
  }

  if (ctx.isControlActive) {
    const throttleInput = input.analogThrottle !== 0
      ? input.analogThrottle
      : input.forward ? 1 : input.backward ? -1 : 0;

    if (throttleInput > 0) {
      bike.bikeSpeed = Math.min(maxSpeed, bike.bikeSpeed + accel * throttleInput * dt);
    } else if (throttleInput < 0) {
      if (bike.bikeSpeed > 0) {
        bike.bikeSpeed = Math.max(0, bike.bikeSpeed - BIKE.brakeDecel * Math.abs(throttleInput) * dt);
      } else {
        bike.bikeSpeed = Math.max(reverseMax, bike.bikeSpeed - BIKE.reverseAccel * Math.abs(throttleInput) * dt);
      }
    } else {
      bike.bikeSpeed *= Math.pow(BIKE.frictionPerFrame, dt * 60);
    }

    const isDriftAction = input.drift || (input.jump && (input.left || input.right || Math.abs(input.analogSteer) > 0.2));
    bike.isDrifting = isDriftAction && Math.abs(bike.bikeSpeed) > BIKE.driftMinSpeed;

    let steerVal = 0;
    if (input.analogSteer !== 0) {
      steerVal = -input.analogSteer;
    } else if (input.left) {
      steerVal = 1;
    } else if (input.right) {
      steerVal = -1;
    }

    let steerSpeed = (BIKE.steerBase * (1 + ctx.steeringAssist * BIKE.steerAssistFactor)) * Math.sign(bike.bikeSpeed || 1);
    if (bike.isDrifting) {
      steerSpeed *= BIKE.steerDriftMult;
    }

    if (steerVal !== 0) {
      const speedFactor = Math.min(1, Math.abs(bike.bikeSpeed) / 5);
      bike.bikeRot += steerSpeed * steerVal * dt * speedFactor;
      const targetLean = bike.isDrifting ? steerVal * BIKE.leanDrift : steerVal * BIKE.leanNormal;
      bike.bikeLean = lerp(bike.bikeLean, targetLean, dt * (bike.isDrifting ? BIKE.leanLerpDrift : BIKE.leanLerpNormal));
    } else {
      bike.bikeLean = lerp(bike.bikeLean, 0, dt * BIKE.leanReturnLerp);
    }
  } else {
    bike.bikeSpeed *= BIKE.idleDecayControlled;
    bike.isDrifting = false;
  }

  bike.steerAngleDeg = Math.round(bike.bikeLean * BIKE.steerAngleDegScale);

  if (!bike.isBikeGrounded) {
    bike.bikeVerticalVel -= BIKE.gravity * dt;
    bike.bikeY += bike.bikeVerticalVel * dt;
    if (bike.bikeY <= 0) {
      bike.bikeY = 0;
      bike.bikeVerticalVel = 0;
      bike.isBikeGrounded = true;
    }
  }

  bike.bikeX += -Math.sin(bike.bikeRot) * bike.bikeSpeed * dt;
  bike.bikeZ += -Math.cos(bike.bikeRot) * bike.bikeSpeed * dt;

  bike.bikeX = clamp(bike.bikeX, -BIKE.worldBound, BIKE.worldBound);
  bike.bikeZ = clamp(bike.bikeZ, -BIKE.worldBound, BIKE.worldBound);
}

export function idleDriveInput(): ArcadeDriveInput {
  return {
    analogThrottle: 0,
    analogSteer: 0,
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false,
    drift: false,
    jump: false,
  };
}
