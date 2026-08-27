import * as THREE from 'three';

/**
 * Where each body is on screen this frame, shared without React.
 *
 * Bodies write their world position and drawn radius here from `useFrame`;
 * the camera rig, the label layer and the info panel read them. A Map of
 * mutable vectors, deliberately — putting this in React state was the old
 * view's one-commit-per-frame problem.
 */

const positions = new Map();
const radii = new Map();

export function setWorld(id, position, radius) {
  let v = positions.get(id);
  if (!v) {
    v = new THREE.Vector3();
    positions.set(id, v);
  }
  v.copy(position);
  radii.set(id, radius);
}

export function getWorld(id) {
  return positions.get(id) || null;
}

export function getRadius(id) {
  return radii.get(id) ?? 0;
}

export function allWorld() {
  return positions;
}
