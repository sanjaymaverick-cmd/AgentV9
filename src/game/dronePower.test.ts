import { describe, expect, it } from 'vitest';
import {
  canLaunchDrone,
  droneOwnerRange,
  shouldAutoReturn,
  stepDroneBattery,
} from './dronePower';
import { DRONE } from './tunables';

describe('stepDroneBattery', () => {
  it('regenerates while docked', () => {
    const next = stepDroneBattery(40, 1, { docked: true, moving: false, returning: false });
    expect(next).toBeCloseTo(40 + DRONE.batteryRegenPerSec, 5);
  });

  it('drains faster while flying and moving than while hovering', () => {
    const hover = stepDroneBattery(100, 1, { docked: false, moving: false, returning: false });
    const cruise = stepDroneBattery(100, 1, { docked: false, moving: true, returning: false });
    expect(cruise).toBeLessThan(hover);
    expect(hover).toBeLessThan(100);
  });
});

describe('shouldAutoReturn', () => {
  it('returns at empty battery or past the leash', () => {
    expect(shouldAutoReturn(0, 10)).toBe(true);
    expect(shouldAutoReturn(50, DRONE.maxRange)).toBe(true);
    expect(shouldAutoReturn(50, 10)).toBe(false);
  });
});

describe('canLaunchDrone', () => {
  it('blocks a launch when the cell is too empty', () => {
    expect(canLaunchDrone(DRONE.launchMinBattery)).toBe(true);
    expect(canLaunchDrone(DRONE.launchMinBattery - 0.01)).toBe(false);
  });
});

describe('droneOwnerRange', () => {
  it('is planar so height does not eat the leash', () => {
    expect(droneOwnerRange(0, 0, 3, 4)).toBeCloseTo(5, 5);
  });
});
