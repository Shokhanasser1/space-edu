import { useContext, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DotContext, FadeContext, clamp01, easeOut, seeded, smooth } from './SceneKit';
import { FittedModels, useGasMaterial } from './ModelKit';
import { StarSurface } from './StarSurface';

/**
 * The two deaths that leave a shell of gas behind, played out in time and
 * finished with the real objects' 3D shapes.
 *
 * - `Supernova`: the blast - a flash, a shock front tearing outward through
 *   the star's old wind, and ejecta flying at thousands of km/s - settling
 *   into Cassiopeia A, the remnant of a star whose explosion we see as about
 *   340 years old, as NASA and Chandra reconstructed it in 3D from X-ray,
 *   infrared and optical data. It keeps NASA's own colour coding of the
 *   different parts of the debris.
 * - `PlanetaryNebula`: a Sun-like star's outer layers drifting away as the
 *   Helix Nebula, glowing blue-green inside (oxygen) and red outside
 *   (hydrogen and nitrogen), with the white dwarf left at its centre.
 *
 * Each calls `onPhase` as it moves from one part of its story to the next,
 * so the page can say what is happening.
 */

export const STAR_LIFE_MODELS = {
  casA: '/models/star-life/cas-a.glb',
  helix: '/models/star-life/helix.glb',
};

// ---------------------------------------------------------------------------
// Supernova

const BLAST_SECONDS = 3.6;

/** Debris flying out of the explosion, each speck with its own speed. */
function Ejecta({ start }) {
  const dot = useContext(DotContext);
  const COUNT = 2600;
  const data = useMemo(() => {
    const rand = seeded(91);
    const dirs = new Float32Array(COUNT * 3);
    const speed = new Float32Array(COUNT);
    const colours = new Float32Array(COUNT * 3);
    const palette = ['#ffd27a', '#ff7a3c', '#7fe0ff', '#c58bff', '#ffffff'].map((c) => new THREE.Color(c));
    for (let i = 0; i < COUNT; i += 1) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      dirs[i * 3] = r * Math.cos(a);
      dirs[i * 3 + 1] = u;
      dirs[i * 3 + 2] = r * Math.sin(a);
      // Clumpy: most debris in a few fast fingers, the rest slower.
      speed[i] = 0.5 + rand() ** 0.5 * 1.1;
      const c = palette[Math.floor(rand() * palette.length)];
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    return { dirs, speed, colours, pos: new Float32Array(COUNT * 3) };
  }, []);
  const ref = useRef(null);
  useFrame((state) => {
    if (start.current === null || !ref.current) return;
    const t = state.clock.elapsedTime - start.current;
    const grow = easeOut(t / BLAST_SECONDS) * 5.2 + 0.25 * t;
    const { dirs, speed, pos } = data;
    for (let i = 0; i < COUNT; i += 1) {
      const r = grow * speed[i];
      pos[i * 3] = dirs[i * 3] * r;
      pos[i * 3 + 1] = dirs[i * 3 + 1] * r;
      pos[i * 3 + 2] = dirs[i * 3 + 2] * r;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.material.opacity = 0.85 * (1 - smooth((t - 2.2) / 3));
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={COUNT} array={data.colours} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        map={dot}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function Supernova({ onPhase }) {
  const fade = useContext(FadeContext);
  const start = useRef(null);
  const phase = useRef(null);
  const flash = useRef(null);
  const shock = useRef(null);
  const remnant = useRef(null);
  const shockMaterial = useGasMaterial({ mode: 'glow', from: '#e8f8ff', to: '#8fd0ff', radial: true, range: [0.9, 1], intensity: 1.2, noiseScale: 6 });
  const remnantLight = useRef(null);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    // The clock starts when the blast becomes visible: after a collapse the
    // morph holds this stage back for a moment.
    if (start.current === null) {
      if (fade.current < 0.05) return;
      start.current = now;
    }
    const t = now - start.current;
    const next = t < 3 ? 'blast' : 'remnant';
    if (next !== phase.current) {
      phase.current = next;
      onPhase?.(next);
    }
    if (flash.current) {
      const q = t / 0.9;
      flash.current.visible = q < 1;
      flash.current.scale.setScalar(0.4 + 2.6 * easeOut(q));
      flash.current.material.opacity = (1 - clamp01(q)) ** 2;
    }
    if (shock.current) {
      const q = t / BLAST_SECONDS;
      shock.current.visible = q < 1.5;
      shock.current.scale.setScalar(0.3 + 5.4 * easeOut(q));
      shockMaterial.uniforms.uIntensity.value = 1.3 * (1 - smooth((t - 1.2) / 2.6));
    }
    if (remnant.current) {
      const q = smooth((t - 2.2) / 3);
      remnant.current.scale.setScalar(0.45 + 0.55 * easeOut((t - 2.2) / 4));
      remnant.current.rotation.y = t * 0.06;
      remnant.current.visible = q > 0.001;
      // The model keeps NASA's own colours; it fades in by its materials.
      remnant.current.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.material.userData.glowing) {
          // NASA's colour coding, made to glow like hot debris. The file's
          // transmission would cost a whole extra render pass; opacity does.
          o.material.userData.glowing = true;
          o.material.transmission = 0;
          o.material.emissive = new THREE.Color('#ffffff');
          o.material.emissiveMap = o.material.map;
          o.material.emissiveIntensity = 0.55;
          o.material.needsUpdate = true;
        }
        o.material.userData.selfFade = true;
        o.material.transparent = true;
        o.material.opacity = q * fade.current;
        o.material.depthWrite = q > 0.95;
      });
      if (remnantLight.current) remnantLight.current.intensity = 2.2 * q;
    }
  });

  return (
    <group>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          userData={{ selfFade: true }}
        />
      </mesh>
      <mesh ref={shock} material={shockMaterial} visible={false}>
        <icosahedronGeometry args={[1, 5]} />
      </mesh>
      <Ejecta start={start} />
      <group ref={remnant} visible={false}>
        <FittedModels urls={[STAR_LIFE_MODELS.casA]} fit={9} />
      </group>
      {/* Light for the remnant's own coloured surfaces. */}
      <hemisphereLight ref={remnantLight} args={['#ffffff', '#40305a', 0]} />
    </group>
  );
}


// ---------------------------------------------------------------------------
// Planetary nebula

export function PlanetaryNebula({ onPhase }) {
  const shell = useRef(null);
  const start = useRef(null);
  const told = useRef(false);
  const material = useGasMaterial({ mode: 'glow', from: '#4fe3d0', to: '#ff4a5a', radial: true, range: [12, 48], intensity: 1.35, noiseScale: 0.08 });
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (start.current === null) start.current = now;
    if (!told.current) {
      told.current = true;
      onPhase?.('helix');
    }
    if (shell.current) {
      const t = now - start.current;
      // Drifting outward at a steady pace, turning very slowly.
      shell.current.scale.setScalar(1 + 0.025 * t);
      shell.current.rotation.z = t * 0.01;
    }
  });
  return (
    <group rotation={[0.45, 0.25, 0]}>
      <group ref={shell}>
        <FittedModels urls={[STAR_LIFE_MODELS.helix]} materials={material} fit={8} />
      </group>
      <StarSurface radius={0.18} colour="#e3ecff" cells={50} contrast={0.06} brightness={2.4} glow={8} glowOpacity={0.6} segments={32} />
    </group>
  );
}
