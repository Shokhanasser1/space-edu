import { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DotContext, FadeContext, easeIn, seeded, smooth } from './SceneKit';
import { FittedModels, useGasMaterial } from './ModelKit';

/**
 * Where a star's life begins, with the real shapes.
 *
 * - `PillarsIntro`: the Pillars of Creation in the Eagle Nebula, as NASA's
 *   Universe of Learning modelled them in 3D from Hubble and Webb images.
 *   Dark, dusty columns lit from above by hot young stars, their edges
 *   glowing where that light boils gas off them (photoevaporation, drawn as
 *   streams of gas rising off the tips). Then the view dives into the tip of
 *   the tallest pillar, where the next scene - a clump collapsing into a
 *   star - takes over.
 * - `ProtostarModel`: DG Tau, a young star in Taurus, with its disc and its
 *   two jets, as NASA and INAF modelled it; the disc turns, knots of gas run
 *   out along the jets.
 */

export const BIRTH_MODELS = {
  pillars: [
    '/models/star-life/pillar-1a.glb',
    '/models/star-life/pillar-1b.glb',
    '/models/star-life/pillar-2.glb',
    '/models/star-life/pillar-3.glb',
  ],
  dgTau: ['/models/star-life/dg-tau-disc.glb', '/models/star-life/dg-tau-jets.glb'],
};

/**
 * The 3D-print files stand the pillars along their Z axis, spread them along
 * Y and put depth along X. This stands them up (Z to up) and looks at them
 * from -X, as Hubble did - tall pillar 1A on the left: first a turn about X,
 * then about Y.
 */
const PILLARS_TURN = new THREE.Matrix4()
  .makeRotationY(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
const PILLARS_QUATERNION = new THREE.Quaternion().setFromRotationMatrix(PILLARS_TURN);
/** DG Tau's jets run along the file's Z axis; turn them to point up and down. */
export const DG_TAU_TURN = [-Math.PI / 2, 0, 0];

export const PILLARS_HOLD = 4.5;
export const PILLARS_DIVE = 2;
const PILLARS_HEIGHT = 8;

/** Gas boiled off the lit tips of the pillars, streaming up towards the light. */
function Photoevaporation({ tips, clock }) {
  const dot = useContext(DotContext);
  const COUNT = 900;
  const data = useMemo(() => {
    const rand = seeded(29);
    const tip = new Uint8Array(COUNT);
    const phase = new Float32Array(COUNT);
    const off = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i += 1) {
      tip[i] = Math.floor(rand() * 4);
      phase[i] = rand();
      off[i * 3] = (rand() - 0.5) * 0.5;
      off[i * 3 + 1] = rand() * 0.2;
      off[i * 3 + 2] = (rand() - 0.5) * 0.5;
    }
    return { tip, phase, off, pos: new Float32Array(COUNT * 3) };
  }, []);
  const ref = useRef(null);
  useFrame(() => {
    if (!ref.current || !tips.length) return;
    const { tip, phase, off, pos } = data;
    const t = clock.current;
    for (let i = 0; i < COUNT; i += 1) {
      const p = tips[tip[i] % tips.length];
      const life = (phase[i] + t * 0.12) % 1;
      const rise = life * 1.4;
      pos[i * 3] = p[0] + off[i * 3] * (1 + life * 2) + rise * 0.35;
      pos[i * 3 + 1] = p[1] + off[i * 3 + 1] + rise;
      pos[i * 3 + 2] = p[2] + off[i * 3 + 2] * (1 + life * 2);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        map={dot}
        color="#ffd6a0"
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** The glowing nebula behind the pillars, and the hot stars that light them. */
function EagleBackdrop() {
  const dot = useContext(DotContext);
  const stars = useMemo(() => {
    const rand = seeded(37);
    const pos = new Float32Array(40 * 3);
    for (let i = 0; i < 40; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 14;
      pos[i * 3 + 1] = 2 + rand() * 4;
      pos[i * 3 + 2] = -3 - rand() * 4;
    }
    return pos;
  }, []);
  return (
    <group>
      <sprite position={[0, 0.5, -6]} scale={[22, 16, 1]}>
        <spriteMaterial map={dot} color="#2fa7a0" transparent opacity={0.55} depthWrite={false} />
      </sprite>
      <sprite position={[3, 4, -5]} scale={[12, 10, 1]}>
        <spriteMaterial map={dot} color="#6fd8ff" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={40} array={stars} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.35}
          map={dot}
          color="#e8f6ff"
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

/**
 * The pillars, held for PILLARS_HOLD seconds and then dived into over
 * PILLARS_DIVE: the view closes on the tallest tip as the pillars fade.
 */
export function PillarsIntro() {
  const fade = useContext(FadeContext);
  const clock = useRef(0);
  const dive = useRef(null);
  const [tips, setTips] = useState([]);
  const [target, setTarget] = useState([0, 3, 0]);
  const dust = useGasMaterial({
    mode: 'dust',
    from: '#3a1d12',
    to: '#a8603a',
    rim: '#ffe2b0',
    axis: [0, 1, 0],
    range: [-PILLARS_HEIGHT / 2, PILLARS_HEIGHT / 2],
    light: [0.35, 1, 0.5],
    intensity: 1.2,
    noiseScale: 0.8,
  });
  dust.userData.selfFade = true;

  // Work out where each pillar's tip is once the shapes are in.
  const onReady = useCallback((placed, models) => {
    const found = models.map((model) => {
      // The tip is the pillar's highest point along the file's Z axis; the
      // pillars lean, so it is not above the middle of their box.
      const top = new THREE.Vector3(0, 0, -Infinity);
      for (const part of model.parts) {
        const pos = part.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 1) {
          if (pos.getZ(i) > top.z) top.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        }
      }
      const tip = top.sub(placed.centre).multiplyScalar(placed.scale).applyMatrix4(PILLARS_TURN);
      tip.y -= 0.15;
      return [tip.x, tip.y, tip.z];
    });
    setTips(found);
    setTarget(found.reduce((best, tip) => (tip[1] > best[1] ? tip : best), found[0]));
  }, []);

  const born = useRef(null);
  useFrame((state) => {
    // Real time, so the dive stays in step with the collapse that follows it.
    if (born.current === null) born.current = state.clock.elapsedTime;
    clock.current = state.clock.elapsedTime - born.current;
    const t = clock.current;
    const q = smooth((t - PILLARS_HOLD) / PILLARS_DIVE);
    const visible = 1 - smooth((t - PILLARS_HOLD - PILLARS_DIVE * 0.4) / (PILLARS_DIVE * 0.6));
    dust.opacity = visible * fade.current;
    if (dive.current) {
      // Scale about the tip so the view seems to fly into it.
      const s = 1 + 9 * easeIn(q);
      dive.current.scale.setScalar(s);
      // The tip stays put while the view closes in, then is brought to the middle.
      dive.current.position.set(
        target[0] * (1 - q) - target[0] * s,
        target[1] * (1 - q) - target[1] * s,
        target[2] * (1 - q) - target[2] * s,
      );
      dive.current.rotation.y = Math.sin(t * 0.25) * 0.12;
      dive.current.visible = visible > 0.002;
    }
  });

  return (
    <group ref={dive}>
      <EagleBackdrop />
      <group quaternion={PILLARS_QUATERNION}>
        <FittedModels urls={BIRTH_MODELS.pillars} materials={dust} fit={PILLARS_HEIGHT} onReady={onReady} />
      </group>
      <Photoevaporation tips={tips} clock={clock} />
    </group>
  );
}

/** DG Tau's disc and jets, glowing; `glow` (a ref, 0..1) fades it in. */
export function ProtostarModel({ glow, size = 5 }) {
  const fade = useContext(FadeContext);
  const spin = useRef(null);
  // Model units: the disc is ~99 across, the jets ~316 long, centred on 0.
  const disc = useGasMaterial({
    mode: 'glow',
    from: '#fff0c0',
    to: '#ff7a3a',
    radial: true,
    range: [5, 50],
    intensity: 1.5,
    noiseScale: 0.12,
  });
  const jets = useGasMaterial({
    mode: 'glow',
    from: '#e6f6ff',
    to: '#5f9cff',
    radial: true,
    range: [10, 160],
    intensity: 1.6,
    noiseScale: 0.06,
  });
  disc.userData.selfFade = true;
  jets.userData.selfFade = true;
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    disc.opacity = glow.current * fade.current;
    // The jets come on after the disc, and flicker as clumps of gas go by.
    jets.opacity = smooth((glow.current - 0.3) / 0.7) * fade.current * (0.8 + 0.2 * Math.sin(t * 6));
    if (spin.current) spin.current.rotation.y = t * 0.35;
  });
  return (
    <group ref={spin}>
      <group rotation={DG_TAU_TURN}>
        <FittedModels urls={BIRTH_MODELS.dgTau} materials={[disc, jets]} fit={size} />
      </group>
      <JetKnots glow={glow} length={size / 2} />
    </group>
  );
}

/**
 * Knots of shocked gas running out along the jets - Herbig-Haro objects,
 * which telescopes see moving outward over the years.
 */
function JetKnots({ glow, length }) {
  const dot = useContext(DotContext);
  const fade = useContext(FadeContext);
  const COUNT = 60;
  const data = useMemo(() => {
    const rand = seeded(47);
    const phase = new Float32Array(COUNT);
    const off = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i += 1) {
      phase[i] = rand();
      off[i * 2] = (rand() - 0.5) * 0.12;
      off[i * 2 + 1] = (rand() - 0.5) * 0.12;
    }
    return { phase, off, pos: new Float32Array(COUNT * 3) };
  }, []);
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const { phase, off, pos } = data;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i += 1) {
      const life = (phase[i] + t * 0.18) % 1;
      const side = i % 2 ? 1 : -1;
      pos[i * 3] = off[i * 2] * (1 + life);
      pos[i * 3 + 1] = side * (0.25 + life * length);
      pos[i * 3 + 2] = off[i * 2 + 1] * (1 + life);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.material.opacity = 0.8 * smooth((glow.current - 0.5) / 0.5) * fade.current;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        map={dot}
        color="#cfe8ff"
        transparent
        opacity={0}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        userData={{ selfFade: true }}
      />
    </points>
  );
}
