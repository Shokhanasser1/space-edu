import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSolarStore } from '../clock';
import { getRadius, getWorld } from '../positions';

/**
 * Follows the selected body and flies to it; flies home on request.
 *
 * Runs before drei's OrbitControls (priority −2 < −1) so the controls'
 * own update applies damping to a target that has already moved this frame
 * — two owners of the camera used to fight, which is why zoom stuttered.
 * The closest allowed distance scales with the body: 1.6 radii, so Ceres can
 * be approached and the Sun cannot be entered.
 */

export const HOME_POSITION = new THREE.Vector3(0, 95, 175);
const ORIGIN = new THREE.Vector3();
const prev = new THREE.Vector3();
const delta = new THREE.Vector3();
const dir = new THREE.Vector3();
const goal = new THREE.Vector3();

export default function CameraRig({ controlsRef }) {
  const { camera } = useThree();
  const state = useRef({ selected: null, flying: false, home: false, homeSeen: 0 });

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const s = state.current;
    const { selectedId, homeRequest, scaleMode } = useSolarStore.getState();
    const k = 1 - Math.pow(0.0015, Math.min(dt, 0.1));

    if (homeRequest !== s.homeSeen) {
      s.homeSeen = homeRequest;
      s.home = true;
      s.flying = false;
    }

    if (selectedId !== s.selected) {
      s.selected = selectedId;
      const p = selectedId ? getWorld(selectedId) : null;
      if (p) {
        prev.copy(p);
        s.flying = true;
        s.home = false;
      }
    }

    if (selectedId) {
      const p = getWorld(selectedId);
      if (!p) return;
      const r = getRadius(selectedId);
      delta.subVectors(p, prev);
      camera.position.add(delta);
      prev.copy(p);
      controls.target.copy(p);
      controls.minDistance = Math.max(r * 1.6, scaleMode === 'true' ? 0.001 : 0.05);
      if (s.flying) {
        const desired = Math.max(r * 5.5, scaleMode === 'true' ? 0.006 : 0.4);
        dir.subVectors(camera.position, p);
        if (dir.lengthSq() < 1e-9) dir.set(0.3, 0.5, 1);
        dir.normalize();
        dir.y = Math.max(dir.y, 0.28);
        dir.normalize();
        goal.copy(p).addScaledVector(dir, desired);
        camera.position.lerp(goal, k);
        if (camera.position.distanceTo(goal) < desired * 0.02) s.flying = false;
      }
    } else {
      controls.minDistance = scaleMode === 'true' ? 0.002 : 0.5;
    }

    if (s.home) {
      camera.position.lerp(HOME_POSITION, k);
      controls.target.lerp(ORIGIN, k);
      if (camera.position.distanceTo(HOME_POSITION) < 0.5) {
        s.home = false;
        controls.target.copy(ORIGIN);
      }
    }
  }, -2);

  return null;
}
