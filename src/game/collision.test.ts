import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointInAabb, resolveCircleAabbs } from './collision';

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

describe('pointInAabb', () => {
  const room = { minX: -4, maxX: 4, minZ: -10, maxZ: -2 };

  it('is true inside and false on the outside', () => {
    expect(pointInAabb(0, -6, room)).toBe(true);
    expect(pointInAabb(-4, -2, room)).toBe(true);
    expect(pointInAabb(-4.01, -6, room)).toBe(false);
    expect(pointInAabb(0, -1.9, room)).toBe(false);
  });
});
