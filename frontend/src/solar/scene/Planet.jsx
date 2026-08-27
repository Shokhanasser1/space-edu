import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simClock, useSolarStore } from '../clock';
import { bodyOrientation, helioPositionAU } from '../ephemeris';
import { setWorld } from '../positions';
import { AU_UNITS, displayRadius, eclipticToScene } from '../scale';
import { useSolarTextures } from '../textures';
import {
  ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, EARTH_FRAGMENT, EARTH_VERTEX, RING_FRAGMENT, RING_VERTEX,
} from './shaders';

/**
 * One planet or dwarf planet.
 *
 * Position, pole and spin come from the ephemeris every frame; nothing here
 * is React state, so a planet moving does not re-render anything. The tilt
 * group carries the pole (IAU north) and the node, the mesh inside it spins
 * about that pole — the old view put both rotations on one object, which is
 * why Uranus tumbled.
 */

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const tmpEcl = [0, 0, 0];
const tmpScene = [0, 0, 0];
const vX = new THREE.Vector3();
const vY = new THREE.Vector3();
const vZ = new THREE.Vector3();
const basis = new THREE.Matrix4();
const qSpin = new THREE.Quaternion();
const vSun = new THREE.Vector3();
const qInv = new THREE.Quaternion();

/** Sets `target.quaternion` so local +Y is the pole and +X the node, then spins. */
export function applyOrientation(target, orientation) {
  eclipticToScene(orientation.node, 1, tmpScene);
  vX.set(tmpScene[0], tmpScene[1], tmpScene[2]);
  eclipticToScene(orientation.north, 1, tmpScene);
  vY.set(tmpScene[0], tmpScene[1], tmpScene[2]);
  vZ.crossVectors(vX, vY).normalize();
  basis.makeBasis(vX, vY, vZ);
  target.quaternion.setFromRotationMatrix(basis);
  qSpin.setFromAxisAngle(Y_AXIS, (orientation.spinDeg * Math.PI) / 180);
  target.quaternion.multiply(qSpin);
}

function EarthSurface({ radius, textures, segments }) {
  const uniforms = useMemo(
    () => ({
      dayMap: { value: null },
      nightMap: { value: null },
      specMap: { value: null },
      hasNight: { value: 0 },
      hasSpec: { value: 0 },
      sunStrength: { value: 1.15 },
    }),
    [],
  );
  uniforms.dayMap.value = textures.map || null;
  uniforms.nightMap.value = textures.night || null;
  uniforms.specMap.value = textures.specular || null;
  uniforms.hasNight.value = textures.night ? 1 : 0;
  uniforms.hasSpec.value = textures.specular ? 1 : 0;

  if (!textures.map) {
    return (
      <mesh>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial color="#3b8ad9" roughness={0.9} />
      </mesh>
    );
  }
  return (
    <mesh>
      <sphereGeometry args={[radius, segments, segments]} />
      <shaderMaterial vertexShader={EARTH_VERTEX} fragmentShader={EARTH_FRAGMENT} uniforms={uniforms} />
    </mesh>
  );
}

function Atmosphere({ radius, glow }) {
  const uniforms = useMemo(
    () => ({ color: { value: new THREE.Color(glow.color) }, strength: { value: glow.strength } }),
    [glow.color, glow.strength],
  );
  return (
    <mesh>
      <sphereGeometry args={[radius * 1.035, 48, 48]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERTEX}
        fragmentShader={ATMOSPHERE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function Rings({ entry, planetRadius, scale }) {
  const meshRef = useRef();
  const textures = useSolarTextures(entry.rings.textures);
  const inner = entry.rings.innerKm * scale;
  const outer = entry.rings.outerKm * scale;
  const gap = entry.rings.gaps?.[0] || [0, 0];
  const uniforms = useMemo(
    () => ({
      map: { value: null },
      hasMap: { value: 0 },
      tint: { value: new THREE.Color(entry.color) },
      inner: { value: inner },
      outer: { value: outer },
      planetRadius: { value: planetRadius },
      sunLocal: { value: new THREE.Vector3(1, 0, 0) },
      normalLocal: { value: new THREE.Vector3(0, 0, 1) },
      gap0: { value: new THREE.Vector4(gap[0], gap[1], 0, 0) },
      thin: { value: entry.rings.thin ? 1 : 0 },
    }),
    // Geometry-derived numbers; the entry itself is static catalogue data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inner, outer, planetRadius],
  );
  uniforms.map.value = textures.ring || null;
  uniforms.hasMap.value = textures.ring ? 1 : 0;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    // Sun direction in the ring's own space: from the planet towards the origin.
    mesh.getWorldPosition(vSun).negate();
    mesh.getWorldQuaternion(qInv).invert();
    vSun.applyQuaternion(qInv).normalize();
    uniforms.sunLocal.value.copy(vSun);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[inner, outer, 160, 1]} />
      <shaderMaterial
        vertexShader={RING_VERTEX}
        fragmentShader={RING_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function Planet({ entry, onSelect, selected }) {
  const groupRef = useRef();
  const tiltRef = useRef();
  const cloudRef = useRef();
  const scaleMode = useSolarStore((s) => s.scaleMode);
  const textures = useSolarTextures(entry.textures);

  const radius = displayRadius(entry.radiusKm, scaleMode);
  const kmScale = radius / entry.radiusKm;
  const segments = radius > 1 ? 96 : 48;
  const isEarth = entry.id === 'earth';

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const ms = simClock.ms;
    helioPositionAU(entry, ms, tmpEcl);
    eclipticToScene(tmpEcl, AU_UNITS, tmpScene);
    group.position.set(tmpScene[0], tmpScene[1], tmpScene[2]);
    if (tiltRef.current) applyOrientation(tiltRef.current, bodyOrientation(entry, ms));
    if (cloudRef.current) cloudRef.current.rotation.y = (ms / 3_600_000 / 90) * Math.PI * 2;
    setWorld(entry.id, group.position, radius);
  });

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect?.(entry.id);
  };

  return (
    <group ref={groupRef}>
      <group ref={tiltRef}>
        {isEarth ? (
          <EarthSurface radius={radius} textures={textures} segments={segments} />
        ) : (
          <mesh>
            <sphereGeometry args={[radius, segments, segments]} />
            <meshStandardMaterial
              color={textures.map ? '#ffffff' : entry.color}
              map={textures.map || null}
              bumpMap={textures.bump || null}
              bumpScale={textures.bump ? radius * 0.01 : 0}
              roughness={0.92}
              metalness={0}
              emissive={selected ? entry.color : '#000000'}
              emissiveIntensity={selected ? 0.08 : 0}
            />
          </mesh>
        )}
        {isEarth && textures.clouds && (
          <mesh ref={cloudRef}>
            <sphereGeometry args={[radius * 1.008, segments, segments]} />
            <meshStandardMaterial map={textures.clouds} transparent opacity={0.55} depthWrite={false} roughness={1} />
          </mesh>
        )}
        {entry.rings && <Rings entry={entry} planetRadius={radius} scale={kmScale} />}
      </group>
      {entry.glow && <Atmosphere radius={radius} glow={entry.glow} />}
      {/* Hit target: bigger than the planet so a 4-pixel dot can be clicked. */}
      <mesh visible={false} onClick={handleClick} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = 'auto'; }}>
        <sphereGeometry args={[Math.max(radius * 1.6, 0.9), 12, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
