import { describe, expect, it } from 'vitest';
import { pointInViewCone } from './guardAI';

describe('pointInViewCone', () => {
  it('sees a target straight ahead within range', () => {
    expect(pointInViewCone(0, 0, 0, 0, 8, 14, 50)).toBe(true);
  });

  it('misses a target behind the camera', () => {
    expect(pointInViewCone(0, 0, 0, 0, -8, 14, 50)).toBe(false);
  });

  it('misses a target outside the view angle', () => {
    // yaw 0 looks +Z; a point far to +X is ~90° off-axis
    expect(pointInViewCone(0, 0, 0, 10, 0.1, 14, 50)).toBe(false);
  });

  it('misses a target beyond range even if centred', () => {
    expect(pointInViewCone(0, 0, 0, 0, 20, 14, 50)).toBe(false);
  });

  it('treats coinciding positions as visible', () => {
    expect(pointInViewCone(3, -4, 1.2, 3, -4, 14, 50)).toBe(true);
  });

  it('honours yaw so a turned camera sees its new forward', () => {
    // yaw = π/2 looks +X
    expect(pointInViewCone(0, 0, Math.PI / 2, 8, 0, 14, 50)).toBe(true);
    expect(pointInViewCone(0, 0, Math.PI / 2, 0, 8, 14, 50)).toBe(false);
  });
});
