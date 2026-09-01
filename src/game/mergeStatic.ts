import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bake many meshes that share a material into one draw. Used for road dashes,
 * zebra stripes and other static decorations (spec §25 / D1).
 */
export function mergeMeshes(meshes: THREE.Mesh[], material: THREE.Material): THREE.Mesh | null {
  if (meshes.length === 0) return null;
  if (meshes.length === 1) return meshes[0];

  const geos: THREE.BufferGeometry[] = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  merged.computeBoundingSphere();
  const out = new THREE.Mesh(merged, material);
  out.matrixAutoUpdate = false;
  out.updateMatrix();
  return out;
}
