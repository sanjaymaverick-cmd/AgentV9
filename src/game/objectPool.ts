import * as THREE from 'three';

/**
 * Reusable mesh pool (spec §25). Particles borrow a mesh, then go invisible
 * instead of being constructed and disposed every spawn.
 */
export class MeshPool {
  private free: THREE.Mesh[] = [];

  constructor(
    private scene: THREE.Scene,
    private factory: () => THREE.Mesh
  ) {}

  acquire(): THREE.Mesh {
    const m = this.free.pop() ?? this.factory();
    m.visible = true;
    if (!m.parent) this.scene.add(m);
    return m;
  }

  release(m: THREE.Mesh) {
    m.visible = false;
    this.free.push(m);
  }
}

export const PARTICLE_GEO = new THREE.SphereGeometry(0.13, 6, 6);
