import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simClock, useSolarStore } from '../clock';
import { bodyOrientation } from '../ephemeris';
import { setWorld } from '../positions';
import { displayRadius } from '../scale';
import { useSolarTextures } from '../textures';
import { applyOrientation } from './Planet';

/**
 * The Sun: an emissive sphere brighter than white so the bloom pass picks it
 * up and nothing else, a soft corona sprite, and the one light in the scene.
 *
 * `decay={0}`: three's physically correct falloff would make Neptune black
 * and force an ambient light to compensate — which is what flattened every
 * planet before. Real sunlight at Neptune is 1/900 of Earth's; a viewer that
 * shows that is a viewer nobody can use, so we take the same liberty as every
 * planetarium and light everything equally.
 */

function coronaTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 214, 140, 0.9)');
    g.addColorStop(0.35, 'rgba(255, 170, 60, 0.35)');
    g.addColorStop(1, 'rgba(255, 120, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default function Sun({ entry, onSelect }) {
  const meshRef = useRef();
  const scaleMode = useSolarStore((s) => s.scaleMode);
  const textures = useSolarTextures(entry.textures);
  const radius = displayRadius(entry.radiusKm, scaleMode);
  const corona = useMemo(coronaTexture, []);
  const hdr = useMemo(() => new THREE.Color(1.9, 1.5, 1.05), []);

  useFrame(() => {
    if (meshRef.current) applyOrientation(meshRef.current, bodyOrientation(entry, simClock.ms));
    setWorld(entry.id, ORIGIN, radius);
  });

  return (
    <group>
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onSelect?.(entry.id); }}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial map={textures.map || null} color={hdr} toneMapped={false} />
      </mesh>
      <sprite scale={[radius * 4.2, radius * 4.2, 1]}>
        <spriteMaterial map={corona} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} toneMapped={false} />
      </sprite>
      <pointLight intensity={2.3} decay={0} distance={0} color="#fff6e5" />
    </group>
  );
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
