import * as THREE from 'three';

/**
 * Circle-vs-AABB push-out on XZ for the bike and on-foot agent against city
 * footprints plus museum interior walls. Airborne actors (vent jump, drone)
 * skip when `pos.y` is above `airborneY`.
 */
export function resolveCircleAabbs(
  pos: THREE.Vector3,
  radius: number,
  boxes: THREE.Box3[],
  airborneY = 2.7
) {
  if (pos.y > airborneY) return;
  for (const b of boxes) {
    if (pos.y + 1.4 < b.min.y || pos.y > b.max.y) continue;
    const inside = pos.x >= b.min.x && pos.x <= b.max.x && pos.z >= b.min.z && pos.z <= b.max.z;
    if (inside) {
      const dl = pos.x - b.min.x;
      const dr = b.max.x - pos.x;
      const dn = pos.z - b.min.z;
      const df = b.max.z - pos.z;
      const m = Math.min(dl, dr, dn, df);
      if (m === dl) pos.x = b.min.x - radius;
      else if (m === dr) pos.x = b.max.x + radius;
      else if (m === dn) pos.z = b.min.z - radius;
      else pos.z = b.max.z + radius;
      continue;
    }
    const cx = THREE.MathUtils.clamp(pos.x, b.min.x, b.max.x);
    const cz = THREE.MathUtils.clamp(pos.z, b.min.z, b.max.z);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d > 1e-5 && d < radius) {
      const p = (radius - d) / d;
      pos.x += dx * p;
      pos.z += dz * p;
    }
  }
}

export function pointInAabb(
  x: number,
  z: number,
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}
