import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Html, OrbitControls, Stars as ThreeStars } from '@react-three/drei';
import * as THREE from 'three';

/**
 * The local sky as a dome: the observer at the origin, the horizon as a grid
 * through it, north away from the default camera, east to its right. Each
 * catalogue star is placed from the azimuth and altitude the view computed
 * for the current place and minute, so the dome turns as the night goes on.
 */
const DOME_RADIUS = 15;
const MAX_STARS = 500;

function positionOf({ azimuth, altitude }) {
  const az = THREE.MathUtils.degToRad(azimuth);
  const alt = THREE.MathUtils.degToRad(altitude);
  const flat = Math.cos(alt) * DOME_RADIUS;
  // +x east, +y up, −z north (the default camera looks down −z).
  return [flat * Math.sin(az), Math.sin(alt) * DOME_RADIUS, -flat * Math.cos(az)];
}

function CatalogueStars({ stars }) {
  const visible = useMemo(
    () => stars
      .filter((s) => Number.isFinite(s.altitude) && s.altitude >= -5)
      .slice(0, MAX_STARS),
    [stars],
  );

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(visible.length * 3);
    const colors = new Float32Array(visible.length * 3);
    visible.forEach((star, i) => {
      const [x, y, z] = positionOf(star);
      positions.set([x, y, z], i * 3);
      // Brighter (lower magnitude) → whiter and a little bluer.
      const brightness = Math.max(0.35, Math.min(1, (6 - star.magnitude) / 6));
      colors.set([brightness, brightness * 0.92, Math.min(1, brightness * 1.3)], i * 3);
    });
    return { positions, colors };
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <group>
      {/* `key` on the array length: a BufferAttribute is sized when it is
          built, so a different number of stars needs a new geometry. */}
      <points key={visible.length}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.45} sizeAttenuation vertexColors transparent opacity={0.95} />
      </points>
      {visible.map((star) => (
        <Html key={star.id} position={positionOf(star)} center zIndexRange={[10, 0]}>
          <span className="pointer-events-none whitespace-nowrap text-[11px] font-semibold text-white/80 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)] translate-y-3">
            {star.name}
          </span>
        </Html>
      ))}
    </group>
  );
}

export default function StarCanvas3D({ stars }) {
  return (
    <Canvas
      camera={{ position: [0, 6, 22], fov: 55 }}
      style={{ width: '100%', height: '500px' }}
      dpr={[1, 1.5]}
    >
      <color attach="background" args={['#02030a']} />
      <ThreeStars radius={120} depth={60} count={4000} factor={5} saturation={0.2} fade />
      <CatalogueStars stars={stars} />
      {/* The horizon. Stars below it sit under the grid. */}
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellColor="#6366f1"
        sectionSize={5}
        sectionColor="#a855f7"
        fadeStrength={0.4}
        fadeDistance={60}
        infiniteGrid
      />
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.6}
        enableZoom
        enablePan={false}
        minDistance={6}
        maxDistance={60}
        maxPolarAngle={Math.PI * 0.55}
      />
    </Canvas>
  );
}
