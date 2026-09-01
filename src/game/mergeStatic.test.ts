import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeMeshes } from './mergeStatic';

describe('mergeMeshes', () => {
  it('turns N planes into one mesh', () => {
    const mat = new THREE.MeshBasicMaterial({ color: '#fff' });
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    a.position.set(0, 0, 0);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    b.position.set(4, 0, 0);
    const merged = mergeMeshes([a, b], mat);
    expect(merged).not.toBeNull();
    expect(merged).not.toBe(a);
    expect(merged!.geometry.getAttribute('position').count).toBeGreaterThan(
      a.geometry.getAttribute('position').count,
    );
  });

  it('returns the single mesh unchanged', () => {
    const mat = new THREE.MeshBasicMaterial();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    expect(mergeMeshes([a], mat)).toBe(a);
  });

  it('returns null for an empty list', () => {
    expect(mergeMeshes([], new THREE.MeshBasicMaterial())).toBeNull();
  });
});
