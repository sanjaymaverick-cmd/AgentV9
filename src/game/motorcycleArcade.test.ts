import { describe, expect, it } from 'vitest';
import {
  applyCrashSlowdown,
  detectHardLanding,
  detectWallCrash,
  idleDriveInput,
  makeArcadeBike,
  stepMotorcycleArcade,
  type ArcadeDriveContext,
  type ArcadeDriveInput,
} from './motorcycleArcade';
import { BIKE } from './tunables';

function riding(
  input: Partial<ArcadeDriveInput> = {},
  extras: Partial<Omit<ArcadeDriveContext, 'input'>> = {},
): ArcadeDriveContext {
  return {
    isControlActive: true,
    isBoosting: false,
    isRefueling: false,
    isSilentMode: false,
    steeringAssist: 0.5,
    ...extras,
    input: { ...idleDriveInput(), ...input },
  };
}

describe('stepMotorcycleArcade', () => {
  it('accelerates from rest toward the normal speed cap', () => {
    const bike = makeArcadeBike();
    stepMotorcycleArcade(bike, riding({ forward: true }), 1);
    expect(bike.bikeSpeed).toBeCloseTo(BIKE.accelNormal, 5);
    expect(bike.bikeSpeed).toBeLessThan(BIKE.maxSpeedNormal);
  });

  it('clamps throttle at the normal top speed', () => {
    const bike = makeArcadeBike({ bikeSpeed: BIKE.maxSpeedNormal - 1 });
    stepMotorcycleArcade(bike, riding({ forward: true }), 1);
    expect(bike.bikeSpeed).toBe(BIKE.maxSpeedNormal);
  });

  it('uses the crawl cap when out of fuel', () => {
    const bike = makeArcadeBike({ fuelLevel: 0, bikeSpeed: 0 });
    stepMotorcycleArcade(bike, riding({ forward: true }), 2);
    expect(bike.bikeSpeed).toBe(BIKE.maxSpeedOutOfFuel);
  });

  it('uses the boost cap while boosting with fuel', () => {
    const bike = makeArcadeBike({ bikeSpeed: 40 });
    stepMotorcycleArcade(bike, riding({ forward: true }, { isBoosting: true }), 1);
    expect(bike.bikeSpeed).toBe(BIKE.maxSpeedBoost);
  });

  it('brakes forward speed to a stop before reversing', () => {
    const bike = makeArcadeBike({ bikeSpeed: 10 });
    stepMotorcycleArcade(bike, riding({ backward: true }), 1);
    expect(bike.bikeSpeed).toBe(0);
  });

  it('reverses after a stop, clamped to reverseMax', () => {
    const bike = makeArcadeBike({ bikeSpeed: 0 });
    stepMotorcycleArcade(bike, riding({ backward: true }), 1);
    expect(bike.bikeSpeed).toBe(Math.max(BIKE.reverseMaxNormal, -BIKE.reverseAccel));
    stepMotorcycleArcade(bike, riding({ backward: true }), 2);
    expect(bike.bikeSpeed).toBe(BIKE.reverseMaxNormal);
  });

  it('applies per-frame coast friction when no throttle is held', () => {
    const bike = makeArcadeBike({ bikeSpeed: 10 });
    stepMotorcycleArcade(bike, riding(), 1 / 60);
    expect(bike.bikeSpeed).toBeCloseTo(10 * BIKE.frictionPerFrame, 8);
  });

  it('honours analog throttle over digital forward', () => {
    const bike = makeArcadeBike();
    stepMotorcycleArcade(bike, riding({ analogThrottle: 0.5, forward: true }), 1);
    expect(bike.bikeSpeed).toBeCloseTo(BIKE.accelNormal * 0.5, 5);
  });

  it('drains nitro while boosting and regenerates otherwise', () => {
    const draining = makeArcadeBike({ nitroLevel: 100 });
    stepMotorcycleArcade(draining, riding({ boost: true }), 1);
    expect(draining.nitroLevel).toBeCloseTo(100 - BIKE.nitroDrainPerSec, 5);

    const regen = makeArcadeBike({ nitroLevel: 50 });
    stepMotorcycleArcade(regen, riding(), 1);
    expect(regen.nitroLevel).toBeCloseTo(50 + BIKE.nitroRegenPerSec, 5);
  });

  it('does not drain nitro when empty or out of fuel', () => {
    const empty = makeArcadeBike({ nitroLevel: 0, fuelLevel: 100 });
    stepMotorcycleArcade(empty, riding({ boost: true }), 1);
    expect(empty.nitroLevel).toBeCloseTo(BIKE.nitroRegenPerSec, 5);

    const dry = makeArcadeBike({ nitroLevel: 80, fuelLevel: 0 });
    stepMotorcycleArcade(dry, riding({ boost: true }), 1);
    expect(dry.nitroLevel).toBeCloseTo(Math.min(100, 80 + BIKE.nitroRegenPerSec), 5);
  });

  it('burns fuel while moving and skips burn while refueling or nearly stopped', () => {
    const moving = makeArcadeBike({ bikeSpeed: BIKE.maxSpeedNormal, fuelLevel: 50 });
    stepMotorcycleArcade(moving, riding({ forward: true }), 1);
    const expectedBurn = BIKE.fuelBurnBase + BIKE.fuelBurnSpeedScale;
    expect(moving.fuelLevel).toBeCloseTo(50 - expectedBurn, 5);

    const parked = makeArcadeBike({ bikeSpeed: 0.2, fuelLevel: 50 });
    stepMotorcycleArcade(parked, riding({ forward: true }), 1);
    expect(parked.fuelLevel).toBe(50);

    const pumping = makeArcadeBike({ bikeSpeed: 20, fuelLevel: 50 });
    stepMotorcycleArcade(pumping, riding({ forward: true }, { isRefueling: true }), 1);
    expect(pumping.fuelLevel).toBe(50);
  });

  it('burns less fuel in silent mode', () => {
    const loud = makeArcadeBike({ bikeSpeed: 14, fuelLevel: 50 });
    const quiet = makeArcadeBike({ bikeSpeed: 14, fuelLevel: 50 });
    stepMotorcycleArcade(loud, riding({ forward: true }), 1);
    stepMotorcycleArcade(quiet, riding({ forward: true }, { isSilentMode: true }), 1);
    expect(quiet.fuelLevel).toBeGreaterThan(loud.fuelLevel);
  });

  it('decays speed and clears drift when not under control', () => {
    const bike = makeArcadeBike({ bikeSpeed: 20, isDrifting: true });
    stepMotorcycleArcade(bike, riding({ drift: true }, { isControlActive: false }), 1);
    expect(bike.bikeSpeed).toBeCloseTo(20 * BIKE.idleDecayControlled, 8);
    expect(bike.isDrifting).toBe(false);
  });

  it('only drifts above the minimum speed with a drift input', () => {
    const slow = makeArcadeBike({ bikeSpeed: BIKE.driftMinSpeed });
    stepMotorcycleArcade(slow, riding({ forward: true, drift: true }), 0);
    expect(slow.isDrifting).toBe(false);

    const fast = makeArcadeBike({ bikeSpeed: BIKE.driftMinSpeed + 1 });
    stepMotorcycleArcade(fast, riding({ forward: true, drift: true }), 0);
    expect(fast.isDrifting).toBe(true);
  });

  it('steers left and leans into the turn', () => {
    const bike = makeArcadeBike({ bikeSpeed: 20 });
    const rot0 = bike.bikeRot;
    stepMotorcycleArcade(bike, riding({ left: true }), 0.2);
    expect(bike.bikeRot).toBeGreaterThan(rot0);
    expect(bike.bikeLean).toBeGreaterThan(0);
    expect(bike.steerAngleDeg).toBe(Math.round(bike.bikeLean * BIKE.steerAngleDegScale));
  });

  it('moves along heading and clamps to the world bound', () => {
    const moving = makeArcadeBike({ bikeSpeed: 10, bikeRot: 0 });
    stepMotorcycleArcade(moving, riding({ forward: true }), 1);
    expect(moving.bikeZ).toBeLessThan(0);
    expect(moving.bikeX).toBeCloseTo(0, 8);

    const oob = makeArcadeBike({ bikeX: 200, bikeZ: -200, bikeSpeed: 0 });
    stepMotorcycleArcade(oob, riding(), 0);
    expect(oob.bikeX).toBe(BIKE.worldBound);
    expect(oob.bikeZ).toBe(-BIKE.worldBound);
  });

  it('applies gravity while airborne and lands at y = 0', () => {
    const bike = makeArcadeBike({
      isBikeGrounded: false,
      bikeY: 2,
      bikeVerticalVel: 0,
    });
    stepMotorcycleArcade(bike, riding(), 1);
    expect(bike.bikeY).toBe(0);
    expect(bike.bikeVerticalVel).toBe(0);
    expect(bike.isBikeGrounded).toBe(true);
    expect(bike.landingImpact).toBeGreaterThan(0);
  });
});

describe('crash detection', () => {
  it('counts a fast wall hit with a real push-out', () => {
    expect(detectWallCrash(20, 0.4)).toBe(true);
    expect(detectWallCrash(5, 0.8)).toBe(false);
    expect(detectWallCrash(20, 0.05)).toBe(false);
  });

  it('counts a heavy landing and ignores a tap', () => {
    expect(detectHardLanding(22)).toBe(true);
    expect(detectHardLanding(8)).toBe(false);
  });

  it('keeps a little speed so the crash is not a hard stop', () => {
    expect(applyCrashSlowdown(20)).toBeCloseTo(20 * BIKE.crashSpeedKeep, 5);
  });
});
