import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars as ThreeStars, Grid } from '@react-three/drei';
import * as THREE from 'three';

function StarField({ stars, zoom }) {
  const pointsRef = useRef();
  const labelsRef = useRef([]);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(Math.min(stars.length, 500) * 3);
    const colors = new Float32Array(Math.min(stars.length, 500) * 3);
    const sizes = new Float32Array(Math.min(stars.length, 500));

    const visibleStars = stars.filter(s => s.altitude >= -5).slice(0, 500);

    visibleStars.forEach((star, i) => {
      const azRad = (star.azimuth * Math.PI) / 180;
      const altRad = (star.altitude * Math.PI) / 180;
      const distance = Math.cos(altRad) * 15;

      positions[i * 3] = distance * Math.cos(azRad);
      positions[i * 3 + 1] = Math.sin(altRad) * 15;
      positions[i * 3 + 2] = distance * Math.sin(azRad);

      const brightness = Math.max(0.2, Math.min(1, (6 - star.magnitude) / 6));
      colors[i * 3] = brightness;
      colors[i * 3 + 1] = brightness * 0.9;
      colors[i * 3 + 2] = Math.min(1, brightness * 1.4);

      sizes[i] = Math.max(0.1, brightness * 0.5);
    });

    return { positions, colors, sizes };
  }, [stars, zoom]);

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
            count={positions.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            array={colors}
            count={colors.length / 3}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            array={sizes}
            count={sizes.length}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.2}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
        />
      </points>

      {/* Background cosmos */}
      <ThreeStars radius={200} depth={150} count={10000} factor={8} saturation={0.3} />

      {/* Grid */}
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellColor="#6366f1"
        sectionSize={5}
        sectionColor="#a855f7"
        fadeStrength={0.2}
        fadeDistance={100}
        infiniteGrid
        position={[0, -15, 0]}
      />

      {/* Hemisphere dome */}
      <mesh position={[0, 0, 0]}>
        <hemisphereGeometry args={[100, 32, 16]} />
        <meshBasicMaterial
          color="#000814"
          emissive="#1a0033"
          emissiveIntensity={0.2}
          side={THREE.BackSide}
          wireframe={false}
        />
      </mesh>
    </group>
  );
}

export default function StarCanvas3D({ stars, zoom = 1 }) {
  return (
    <Canvas
      camera={{
        position: [0, 5, 20 / Math.max(0.5, zoom)],
        fov: 60,
      }}
      style={{ width: '100%', height: '500px' }}
    >
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.1} />
      <StarField stars={stars} zoom={zoom} />
      <OrbitControls
        autoRotate
        autoRotateSpeed={1}
        enableZoom
        enablePan
        minDistance={5}
        maxDistance={100}
      />
    </Canvas>
  );
}