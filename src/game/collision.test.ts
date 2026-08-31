import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  circleHitsAabb,
  inRadiusXZ,
  occludeSegment,
  pickSafeDismount,
  pointInAabb,
  rayAabbT,
  resolveCircleAabbs,
} from './collision';

function aabb(cx: number, cz: number, w: number, d: number, h = 10): THREE.Box3 {
  return new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(cx, h / 2, cz),
    new THREE.Vector3(w, h, d),
  );
}

describe('resolveCircleAabbs', () => {
  it('pushes a grazing circle out to rest on the box face', () => {
    const pos = new THREE.Vector3(0, 0, 0);
    // Box occupies x=1..3; circle radius 1.2 overlaps 0.2m into the west face.
    resolveCircleAabbs(pos, 1.2, [aabb(2, 0, 2, 4)]);
    expect(pos.x).toBeCloseTo(-0.2, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('ejects a point that spawned inside a solid to the nearest face', () => {
    const pos = new THREE.Vector3(-1.5, 0, 0);
    resolveCircleAabbs(pos, 1, [aabb(0, 0, 4, 4)]);
    expect(pos.x).toBeCloseTo(-3, 5);
    expect(pos.z).toBeCloseTo(0, 5);
  });

  it('does not move a circle that is clear of every box', () => {
    const pos = new THREE.Vector3(10, 0, 10);
    resolveCircleAabbs(pos, 1, [aabb(0, 0, 2, 2)]);
    expect(pos.x).toBe(10);
    expect(pos.z).toBe(10);
  });

  it('skips collision while airborne above the threshold', () => {
    const pos = new THREE.Vector3(0, 4, 0);
    resolveCircleAabbs(pos, 1.5, [aabb(0, 0, 4, 4)]);
    expect(pos.x).toBe(0);
    expect(pos.z).toBe(0);
  });

  it('still collides when the actor is only slightly off the ground', () => {
    const pos = new THREE.Vector3(0, 1, 0);
    resolveCircleAabbs(pos, 1.2, [aabb(2, 0, 2, 4)]);
    expect(pos.x).toBeCloseTo(-0.2, 5);
  });
});

describe('inRadiusXZ', () => {
  it('traps a bot standing in a foam blob', () => {
    expect(inRadiusXZ(0, 0, 1.2, 0.4, 2.5)).toBe(true);
  });

  it('misses a bot down the hall', () => {
    expect(inRadiusXZ(0, 0, 8, 0, 2.5)).toBe(false);
  });
});

describe('pointInAabb', () => {
  const room = { minX: -4, maxX: 4, minZ: -10, maxZ: -2 };

  it('is true inside and false on the outside', () => {
    expect(pointInAabb(0, -6, room)).toBe(true);
    expect(pointInAabb(-4, -2, room)).toBe(true);
    expect(pointInAabb(-4.01, -6, room)).toBe(false);
    expect(pointInAabb(0, -1.9, room)).toBe(false);
  });
});

describe('camera arm occlusion', () => {
  it('returns 0 when the look-at origin is already inside the box', () => {
    expect(rayAabbT(0, 1, 0, 0, 0, 8, aabb(0, 0, 4, 4))).toBe(0);
  });

  it('hits a wall between the agent and the chase camera', () => {
    // Agent at origin, camera 8m back along +Z, wall occupying z=2..4.
    const t = rayAabbT(0, 2, 0, 0, 0, 8, aabb(0, 3, 6, 2, 20));
    expect(t).not.toBeNull();
    expect(t as number).toBeGreaterThan(0.2);
    expect(t as number).toBeLessThan(0.6);
  });

  it('pulls the camera in front of the wall, not through it', () => {
    const from = new THREE.Vector3(0, 2, 0);
    const to = new THREE.Vector3(0, 2, 8);
    occludeSegment(from, to, [aabb(0, 3, 6, 2, 20)], 0.4, 1.2);
    expect(to.z).toBeLessThan(2);
    expect(to.z).toBeGreaterThan(1.2);
    expect(to.x).toBeCloseTo(0, 5);
  });

  it('leaves a clear arm alone', () => {
    const from = new THREE.Vector3(0, 2, 0);
    const to = new THREE.Vector3(0, 2, 8);
    occludeSegment(from, to, [aabb(40, 40, 4, 4)], 0.4, 1.2);
    expect(to.z).toBe(8);
  });
});

describe('safe dismount', () => {
  const out = new THREE.Vector3();

  it('steps off to the left when the street is clear (rot 0 faces -Z)', () => {
    pickSafeDismount(0, 0, 0, [], out, 0.55, 1.65);
    expect(out.x).toBeCloseTo(-1.65, 5);
    expect(out.z).toBeCloseTo(0, 5);
  });

  it('flips to the right when the left side is a wall', () => {
    // Left of a rot=0 bike is -X. Wall covers x=-3..-1.
    const wall = aabb(-2, 0, 2, 8);
    expect(circleHitsAabb(-1.65, 0, 0, 0.55, wall)).toBe(true);
    pickSafeDismount(0, 0, 0, [wall], out, 0.55, 1.65);
    expect(out.x).toBeCloseTo(1.65, 5);
    expect(out.z).toBeCloseTo(0, 5);
  });

  it('ejects onto the street when every side is a solid', () => {
    const bunker = aabb(0, 0, 6, 6);
    pickSafeDismount(0, 0, 0, [bunker], out, 0.55, 1.65);
    const inside =
      out.x >= bunker.min.x && out.x <= bunker.max.x && out.z >= bunker.min.z && out.z <= bunker.max.z;
    expect(inside).toBe(false);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThan(3);
  });
});
