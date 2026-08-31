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

export function inRadiusXZ(ax: number, az: number, bx: number, bz: number, radius: number): boolean {
  return Math.hypot(ax - bx, az - bz) <= radius;
}

export function pointInAabb(
  x: number,
  z: number,
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

/** First hit `t` in [0, 1] along origin + t·dir. `0` if the origin is already inside. */
export function rayAabbT(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  box: THREE.Box3,
): number | null {
  let tmin = 0;
  let tmax = 1;
  for (let i = 0; i < 3; i++) {
    const o = i === 0 ? ox : i === 1 ? oy : oz;
    const d = i === 0 ? dx : i === 1 ? dy : dz;
    const min = i === 0 ? box.min.x : i === 1 ? box.min.y : box.min.z;
    const max = i === 0 ? box.max.x : i === 1 ? box.max.y : box.max.z;
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
      continue;
    }
    let t1 = (min - o) / d;
    let t2 = (max - o) / d;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}

/**
 * Pull `to` (camera) toward `from` (look-at) so the arm does not sit inside any box.
 * Mutates `to`. No-op when the segment is clear.
 */
export function occludeSegment(
  from: THREE.Vector3,
  to: THREE.Vector3,
  boxes: THREE.Box3[],
  padding: number,
  minDist: number,
): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-4) return;
  let bestT = 1;
  for (let i = 0; i < boxes.length; i++) {
    const t = rayAabbT(from.x, from.y, from.z, dx, dy, dz, boxes[i]);
    if (t != null && t < bestT) bestT = t;
  }
  if (bestT >= 1) return;
  const padT = padding / len;
  const minT = Math.min(1, minDist / len);
  const tUse = Math.max(minT, bestT - padT);
  to.set(from.x + dx * tUse, from.y + dy * tUse, from.z + dz * tUse);
}

export function circleHitsAabb(
  x: number,
  y: number,
  z: number,
  radius: number,
  box: THREE.Box3,
): boolean {
  if (y + 1.4 < box.min.y || y > box.max.y) return false;
  const inside = x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z;
  if (inside) return true;
  const cx = THREE.MathUtils.clamp(x, box.min.x, box.max.x);
  const cz = THREE.MathUtils.clamp(z, box.min.z, box.max.z);
  return Math.hypot(x - cx, z - cz) < radius;
}

/**
 * Bike faces `-sin(rot), -cos(rot)`. Prefer left of the bike, then right, behind, ahead,
 * then the bike itself with a collision eject so the agent never spawns inside a wall.
 */
export function pickSafeDismount(
  bikeX: number,
  bikeZ: number,
  bikeRot: number,
  boxes: THREE.Box3[],
  out: THREE.Vector3,
  radius = 0.55,
  side = 1.65,
): THREE.Vector3 {
  const fx = -Math.sin(bikeRot);
  const fz = -Math.cos(bikeRot);
  const lx = fz;
  const lz = -fx;
  const candidates: [number, number][] = [
    [lx * side, lz * side],
    [-lx * side, -lz * side],
    [-fx * 2.2, -fz * 2.2],
    [fx * 2.2, fz * 2.2],
    [0, 0],
  ];
  for (let i = 0; i < candidates.length; i++) {
    const x = bikeX + candidates[i][0];
    const z = bikeZ + candidates[i][1];
    let blocked = false;
    for (let b = 0; b < boxes.length; b++) {
      if (circleHitsAabb(x, 0, z, radius, boxes[b])) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      out.set(x, 0, z);
      return out;
    }
  }
  out.set(bikeX, 0, bikeZ);
  resolveCircleAabbs(out, radius + 0.08, boxes);
  return out;
}
