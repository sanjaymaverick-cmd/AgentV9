import { describe, expect, it } from 'vitest';
import { inTagRange } from './droneTagManager';
import { DRONE_TAG } from './tunables';

describe('inTagRange', () => {
  it('tags a drone beside the player on the plaza', () => {
    expect(inTagRange(0, 1, 0, 4, 8, 0, DRONE_TAG.empRadius)).toBe(true);
  });

  it('allows a ramp jump to reach a high drone', () => {
    expect(inTagRange(0, 6, 0, 2, 13, 1, DRONE_TAG.empRadius)).toBe(true);
  });

  it('misses a drone across the district', () => {
    expect(inTagRange(0, 1, 0, 40, 8, 40, DRONE_TAG.empRadius)).toBe(false);
  });

  it('uses the tighter foam radius', () => {
    expect(inTagRange(0, 1.2, 0, 8, 8, 0, DRONE_TAG.foamRadius)).toBe(false);
    expect(inTagRange(0, 1.2, 0, 2, 7, 1, DRONE_TAG.foamRadius)).toBe(true);
  });
});
