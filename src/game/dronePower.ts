import { DRONE } from './tunables';

/** Battery after one tick. Docked regenerates; airborne drains faster while moving. */
export function stepDroneBattery(
  battery: number,
  dt: number,
  opts: { docked: boolean; moving: boolean; returning: boolean },
): number {
  if (opts.docked) {
    return Math.min(100, battery + dt * DRONE.batteryRegenPerSec);
  }
  const drain = opts.returning
    ? DRONE.batteryDrainIdlePerSec
    : opts.moving
    ? DRONE.batteryDrainMovePerSec
    : DRONE.batteryDrainIdlePerSec;
  return Math.max(0, battery - dt * drain);
}

export function droneOwnerRange(
  droneX: number,
  droneZ: number,
  ownerX: number,
  ownerZ: number,
): number {
  return Math.hypot(droneX - ownerX, droneZ - ownerZ);
}

export function shouldAutoReturn(battery: number, range: number): boolean {
  return battery <= 0 || range >= DRONE.maxRange;
}

export function canLaunchDrone(battery: number): boolean {
  return battery >= DRONE.launchMinBattery;
}
