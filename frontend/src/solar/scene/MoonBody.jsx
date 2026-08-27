import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { simClock, useSolarStore } from '../clock';
import { bodyOrientation, moonOffsetAU } from '../ephemeris';
import { getWorld, setWorld } from '../positions';
import { AU_KM, displayRadius, eclipticToScene, moonOrbitRadius } from '../scale';
import { useSolarTextures } from '../textures';
import { applyOrientation } from './Planet';

/**
 * A moon, placed by its offset from the planet. The offset's *direction* is
 * the real one (the Moon really is over there tonight); its *length* is
 * compressed in visual mode because the planet is drawn far too large — see
 * `moonOrbitRadius`. In true-scale mode the length is real too.
 *
 * The old view added the planet's position to a child of the planet's group
 * and so drew every moon at twice the planet's distance from the Sun.
 */

const tmpEcl = [0, 0, 0];
const tmpScene = [0, 0, 0];

export default function MoonBody({ entry, parent, onSelect, selected }) {
  const groupRef = useRef();
  const tiltRef = useRef();
  const scaleMode = useSolarStore((s) => s.scaleMode);
  const textures = useSolarTextures(entry.textures);
  const radius = displayRadius(entry.radiusKm, scaleMode, { isMoon: true });
  const segments = radius > 0.4 ? 48 : 24;

  useFrame(() => {
    const group = groupRef.current;
    const parentPos = getWorld(parent.id);
    if (!group || !parentPos) return;
    const ms = simClock.ms;
    moonOffsetAU(entry, parent, ms, tmpEcl);
    const lenAU = Math.hypot(tmpEcl[0], tmpEcl[1], tmpEcl[2]) || 1e-12;
    const parentRadius = displayRadius(parent.radiusKm, scaleMode);
    const drawn = moonOrbitRadius(lenAU * AU_KM, parent.radiusKm, parentRadius, scaleMode);
    const k = drawn / lenAU;
    eclipticToScene(tmpEcl, k, tmpScene);
    group.position.set(parentPos.x + tmpScene[0], parentPos.y + tmpScene[1], parentPos.z + tmpScene[2]);
    if (tiltRef.current) applyOrientation(tiltRef.current, bodyOrientation(entry, ms));
    setWorld(entry.id, group.position, radius);
  });

  return (
    <group ref={groupRef}>
      <group ref={tiltRef}>
        <mesh>
          <sphereGeometry args={[radius, segments, segments]} />
          <meshStandardMaterial
            color={textures.map ? '#ffffff' : entry.color}
            map={textures.map || null}
            roughness={0.95}
            emissive={selected ? entry.color : '#000000'}
            emissiveIntensity={selected ? 0.1 : 0}
          />
        </mesh>
      </group>
      <mesh visible={false} onClick={(e) => { e.stopPropagation(); onSelect?.(entry.id); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
        <sphereGeometry args={[Math.max(radius * 2, 0.3), 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
