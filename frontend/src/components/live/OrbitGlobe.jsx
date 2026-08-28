import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { propagate, gstime, eciToEcf, eciToGeodetic } from 'satellite.js';
import { useTextures } from '@/hooks/useTextures';

/**
 * The Earth, and the satellites we have real elements for.
 *
 * Split out of `LiveSpaceView` because that file was at 755 lines and the
 * house ceiling is 800. Nothing here decides *which* satellites to draw or
 * what to say about them — it is handed a list and draws it.
 *
 * Textures come through `useTextures`, not `useLoader`. `useLoader` throws
 * when a file does not arrive, and this scene sits inside the page rather
 * than behind its own boundary, so one missing texture would replace the
 * whole route with the error screen. A missing texture should cost you the
 * clouds, not the planet.
 */
export const EARTH_RADIUS = 2;
const EARTH_KM = 6371;

const EARTH_TEXTURES = [
  '/textures/earth_atmos_2048.jpg',
  '/textures/earth_normal_2048.jpg',
  '/textures/earth_specular_2048.jpg',
  '/textures/earth_lights_2048.png',
  '/textures/earth_clouds_1024.png',
];

/** Where a satellite is right now, in scene units. */
export function scenePosition(satrec, when, gmstValue) {
  const pv = propagate(satrec, when);
  if (!pv.position) return null;
  const ecf = eciToEcf(pv.position, gmstValue);
  return {
    x: (ecf.x / EARTH_KM) * EARTH_RADIUS,
    y: (ecf.z / EARTH_KM) * EARTH_RADIUS,
    z: (ecf.y / EARTH_KM) * EARTH_RADIUS,
  };
}

function RealEarth() {
  const earthRef = useRef(null);
  const cloudRef = useRef(null);
  const [dayMap, bumpMap, specMap, nightMap, cloudMap] = useTextures(EARTH_TEXTURES);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.03;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.037;
  });

  return (
    <group>
      <group ref={earthRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          {/* `color` carries the sphere when `map` is null, so a texture that
              did not arrive leaves a blue planet rather than a black hole.

              The `key` is load-bearing. `useTextures` resolves after the first
              render, so `map` goes null -> texture, and three.js only compiles
              a material's shader once: without a remount the textures arrive
              and are never sampled, which shows up as a flat blue ball on a
              page where every file downloaded correctly. */}
          <meshPhongMaterial
            key={dayMap ? 'earth-textured' : 'earth-plain'}
            map={dayMap}
            color={dayMap ? '#ffffff' : '#2a4a7c'}
            bumpMap={bumpMap}
            bumpScale={0.03}
            specularMap={specMap}
            specular={new THREE.Color('#4a5a75')}
            shininess={16}
          />
        </mesh>
        {nightMap && (
          <mesh>
            <sphereGeometry args={[EARTH_RADIUS * 1.0015, 96, 96]} />
            <meshBasicMaterial
              map={nightMap}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>

      {cloudMap && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[EARTH_RADIUS * 1.01, 96, 96]} />
          <meshPhongMaterial map={cloudMap} transparent opacity={0.26} depthWrite={false} />
        </mesh>
      )}

      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.035, 64, 64]} />
        <meshBasicMaterial
          color="#6fb4ff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/** The path the selected satellite is about to fly, and a marker on it. */
function SelectedTrail({ sat }) {
  const markerRef = useRef(null);

  const points = useMemo(() => {
    const trail = [];
    const base = new Date();
    for (let i = 0; i <= 40; i++) {
      const at = new Date(base.getTime() + i * 60 * 1000);
      const p = scenePosition(sat.satrec, at, gstime(at));
      if (p) trail.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    return trail;
  }, [sat]);

  useFrame(() => {
    if (!markerRef.current) return;
    const now = new Date();
    const p = scenePosition(sat.satrec, now, gstime(now));
    if (p) markerRef.current.position.set(p.x, p.y, p.z);
  });

  if (points.length < 3) return null;
  return (
    <group>
      <Line points={points} color="#ffd166" opacity={0.9} transparent lineWidth={2} />
      <group ref={markerRef}>
        <mesh>
          <sphereGeometry args={[0.05, 18, 18]} />
          <meshBasicMaterial color="#ffd166" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial
            color="#ffd166" transparent opacity={0.3}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function OrbitGlobe({ satellites, selectedSatId, onSelect }) {
  const orbitRef = useRef(null);
  const groundRef = useRef(null);
  const pickRef = useRef(null);
  const lastTickRef = useRef(0);

  // A round sprite, drawn once. Without it every satellite is a square.
  const dotSprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const orbitPositions = useMemo(
    () => new Float32Array(satellites.length * 3), [satellites]);
  const groundPositions = useMemo(
    () => new Float32Array(satellites.length * 3), [satellites]);

  const colors = useMemo(() => {
    const out = new Float32Array(satellites.length * 3);
    for (let i = 0; i < satellites.length; i++) {
      const c = satellites[i].id === selectedSatId
        ? new THREE.Color('#ffd166')
        : satellites[i].color;
      out[i * 3] = c.r;
      out[i * 3 + 1] = c.g;
      out[i * 3 + 2] = c.b;
    }
    return out;
  }, [satellites, selectedSatId]);

  useFrame(() => {
    const nowMs = performance.now();
    if (nowMs - lastTickRef.current < 250) return;
    lastTickRef.current = nowMs;
    if (!orbitRef.current || !satellites.length) return;

    const now = new Date();
    const gmstValue = gstime(now);
    const orbit = orbitRef.current.geometry.attributes.position.array;
    const ground = groundRef.current?.geometry.attributes.position.array;
    const pick = pickRef.current?.geometry.attributes.position.array;

    for (let i = 0; i < satellites.length; i++) {
      const pv = propagate(satellites[i].satrec, now);
      if (!pv.position) continue;
      const ecf = eciToEcf(pv.position, gmstValue);
      const geo = eciToGeodetic(pv.position, gmstValue);
      const x = (ecf.x / EARTH_KM) * EARTH_RADIUS;
      const y = (ecf.z / EARTH_KM) * EARTH_RADIUS;
      const z = (ecf.y / EARTH_KM) * EARTH_RADIUS;
      orbit[i * 3] = x;
      orbit[i * 3 + 1] = y;
      orbit[i * 3 + 2] = z;
      if (pick) {
        pick[i * 3] = x;
        pick[i * 3 + 1] = y;
        pick[i * 3 + 2] = z;
      }
      if (ground) {
        // The point on the surface the satellite is directly above — the bit
        // that makes "it is over the Indian Ocean right now" legible.
        const cosLat = Math.cos(geo.latitude);
        ground[i * 3] = EARTH_RADIUS * 1.002 * cosLat * Math.cos(geo.longitude);
        ground[i * 3 + 1] = EARTH_RADIUS * 1.002 * Math.sin(geo.latitude);
        ground[i * 3 + 2] = EARTH_RADIUS * 1.002 * cosLat * Math.sin(geo.longitude);
      }
    }

    orbitRef.current.geometry.attributes.position.needsUpdate = true;
    if (groundRef.current) groundRef.current.geometry.attributes.position.needsUpdate = true;
    if (pickRef.current) pickRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const selectedSat = useMemo(
    () => satellites.find((sat) => sat.id === selectedSatId),
    [satellites, selectedSatId],
  );

  const pickSatellite = (event) => {
    event.stopPropagation();
    if (typeof event.index !== 'number') return;
    const sat = satellites[event.index];
    if (sat) onSelect(sat.id);
  };

  return (
    <group>
      <RealEarth />

      {satellites.length > 0 && (
        <>
          <points ref={orbitRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={satellites.length} array={orbitPositions} itemSize={3} />
              <bufferAttribute attach="attributes-color" count={satellites.length} array={colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial
              map={dotSprite} alphaTest={0.4} size={0.075} vertexColors
              transparent opacity={0.95} sizeAttenuation depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>

          <points ref={groundRef}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={satellites.length} array={groundPositions} itemSize={3} />
              <bufferAttribute attach="attributes-color" count={satellites.length} array={colors} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial
              map={dotSprite} alphaTest={0.4} size={0.032} vertexColors
              transparent opacity={0.55} sizeAttenuation depthWrite={false}
            />
          </points>

          {/* Invisible, larger points so a fingertip can hit a satellite. */}
          <points ref={pickRef} onPointerDown={pickSatellite}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" count={satellites.length} array={orbitPositions} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.16} transparent opacity={0} sizeAttenuation depthWrite={false} />
          </points>
        </>
      )}

      {selectedSat && <SelectedTrail sat={selectedSat} />}

      {/* Warmer than the old pure-white key light: the brief for this theme is
          "observatory dusk", and a blue-white sun made the planet look grey. */}
      <ambientLight intensity={0.32} />
      <directionalLight position={[8, 3, -6]} intensity={1.9} color="#ffe9c4" />
      <directionalLight position={[-7, -2, 7]} intensity={0.4} color="#8fb0ff" />
    </group>
  );
}
