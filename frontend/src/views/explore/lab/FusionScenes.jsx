import { useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DotContext, StarHalo, clamp01, easeIn, easeOut, seeded, smooth } from './SceneKit';

/**
 * The pictures for the fusion lab: a main-sequence star cut open, and the
 * reactions in its core played out nucleus by nucleus.
 *
 * - `CutawayStar` draws the star with a quarter removed. The core, radiative
 *   and convective zones are laid out as they really lie for the star's mass,
 *   and each one moves the way energy moves through it: sparks of fusion in
 *   the core, light staggering outward through the radiative zone, gas
 *   turning over in convection cells.
 * - `FusionCore` plays the proton-proton chain or the CNO cycle in the hot
 *   plasma of the core. Its clock belongs to the lab panel, so the reader can
 *   pause it, slow it down, and jump to any step; the steps start at the times
 *   in PP_STEP_STARTS and CNO_STEP_STARTS.
 *
 * Symbols on the nuclei (2H, 3He, e+ ...) come in as `labels` from the locale
 * files, so this file holds no reader-facing text.
 */

// ---------------------------------------------------------------------------
// The star cut open

/**
 * How energy leaves the core depends on mass: a red dwarf below about 0.35
 * Suns churns all the way through; a star like the Sun carries it out by
 * radiation to about 70 % of its radius and by convection above that; above
 * about 1.3 Suns it is the other way round, a churning core under a
 * radiative envelope.
 */
export function starLayers(mass) {
  if (mass < 0.35) {
    return [
      { kind: 'core', r: 0.25 },
      { kind: 'convective', r: 1 },
    ];
  }
  if (mass < 1.3) {
    return [
      { kind: 'core', r: 0.25 },
      { kind: 'radiative', r: 0.7 },
      { kind: 'convective', r: 1 },
    ];
  }
  return [
    { kind: 'convectiveCore', r: 0.3 },
    { kind: 'radiative', r: 1 },
  ];
}

/** The three ways a main-sequence star can be built inside. */
export function structureOf(mass) {
  if (mass < 0.35) return 'fullyConvective';
  if (mass < 1.3) return 'radiativeCore';
  return 'convectiveCore';
}

/** Which reaction a star of this mass mostly runs on. */
export const fusionChain = (mass) => (mass >= 1.3 ? 'cno' : 'pp');

export const LAYER_COLOUR = {
  core: '#fff2b8',
  convectiveCore: '#fff2b8',
  radiative: '#ffb347',
  convective: '#ff6a2a',
};

/** The cut-away wedge faces the camera; these are its two faces' turns. */
const CUT_FACES = [-Math.PI / 4, (-3 * Math.PI) / 4];
// The sphere without the wedge: from 3/4 pi round to 1/4 pi.
const CUT_PHI_START = (3 * Math.PI) / 4;
const CUT_PHI_LENGTH = (3 * Math.PI) / 2;

/** Moving dots on one cut face: fusion sparks, photons, convection cells. */
function FaceMotion({ radius, layers, side }) {
  const dot = useContext(DotContext);
  const sparksRef = useRef(null);
  const photonsRef = useRef(null);
  const cellsRef = useRef(null);
  const coreR = layers[0].r * radius;
  const radiativeAt = layers.findIndex((l) => l.kind === 'radiative');
  const radiativeInner = radiativeAt > 0 ? layers[radiativeAt - 1].r * radius : 0;
  const radiativeOuter = radiativeAt >= 0 ? layers[radiativeAt].r * radius : 0;
  const convectiveAt = layers.findIndex((l) => l.kind === 'convective' || l.kind === 'convectiveCore');
  const convective = convectiveAt >= 0 ? layers[convectiveAt] : null;
  const convectiveInner = convective && convective.kind === 'convective' ? layers[convectiveAt - 1].r * radius : 0;
  const convectiveOuter = convective ? convective.r * radius : 0;

  const SPARKS = 40;
  const PHOTONS = radiativeAt >= 0 ? 46 : 0;
  const CELLS = convective ? (convective.kind === 'convective' ? 9 : 4) : 0;
  const PER_CELL = 8;

  const data = useMemo(() => {
    const rand = seeded(side > 0 ? 3 : 5);
    const sparks = new Float32Array(SPARKS * 3);
    const sparkLife = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i += 1) sparkLife[i] = rand();
    const n = Math.max(1, PHOTONS);
    const photons = new Float32Array(n * 3);
    const photonR = new Float32Array(n);
    const photonA = new Float32Array(n);
    for (let i = 0; i < PHOTONS; i += 1) {
      photonR[i] = radiativeInner + rand() * (radiativeOuter - radiativeInner);
      photonA[i] = (rand() - 0.5) * Math.PI * 0.95;
    }
    const cells = new Float32Array(Math.max(1, CELLS * PER_CELL) * 3);
    return { rand, sparks, sparkLife, photons, photonR, photonA, cells };
  }, [side, PHOTONS, CELLS, radiativeInner, radiativeOuter]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const now = state.clock.elapsedTime;
    const { rand, sparks, sparkLife, photons, photonR, photonA, cells } = data;
    // Fusion: brief flashes scattered through the core, most near its centre,
    // where it is hottest.
    if (sparksRef.current) {
      for (let i = 0; i < SPARKS; i += 1) {
        sparkLife[i] += dt * 2.2;
        if (sparkLife[i] >= 1) {
          sparkLife[i] -= 1;
          const r = coreR * rand() ** 1.5 * 0.92;
          const a = (rand() - 0.5) * Math.PI;
          sparks[i * 3] = r * Math.cos(a);
          sparks[i * 3 + 1] = r * Math.sin(a);
          sparks[i * 3 + 2] = 0.01 * side;
        }
      }
      sparksRef.current.geometry.attributes.position.needsUpdate = true;
      sparksRef.current.material.size = 0.11 + 0.05 * Math.sin(now * 9);
    }
    // Radiation: light staggers outward in a random walk.
    if (photonsRef.current && PHOTONS) {
      for (let i = 0; i < PHOTONS; i += 1) {
        photonR[i] += (rand() - 0.42) * dt * 1.6;
        photonA[i] = Math.max(-1.5, Math.min(1.5, photonA[i] + (rand() - 0.5) * dt * 1.5));
        if (photonR[i] > radiativeOuter || photonR[i] < radiativeInner) photonR[i] = radiativeInner;
        photons[i * 3] = photonR[i] * Math.cos(photonA[i]);
        photons[i * 3 + 1] = photonR[i] * Math.sin(photonA[i]);
        photons[i * 3 + 2] = 0.012 * side;
      }
      photonsRef.current.geometry.attributes.position.needsUpdate = true;
    }
    // Convection: hot gas rises, cools and sinks again, round and round.
    if (cellsRef.current && CELLS) {
      const ring = convectiveInner > 0;
      const mid = ring ? (convectiveInner + convectiveOuter) / 2 : convectiveOuter * 0.5;
      const loop = ring ? (convectiveOuter - convectiveInner) * 0.36 : convectiveOuter * 0.3;
      for (let c = 0; c < CELLS; c += 1) {
        const a = -Math.PI / 2 + ((c + 0.5) / CELLS) * Math.PI;
        const cx = mid * Math.cos(a);
        const cy = mid * Math.sin(a);
        const turn = c % 2 ? 1 : -1;
        for (let k = 0; k < PER_CELL; k += 1) {
          const u = turn * now * 0.9 + (k / PER_CELL) * Math.PI * 2;
          const j = (c * PER_CELL + k) * 3;
          cells[j] = cx + loop * Math.cos(u) * Math.cos(a) - loop * 0.7 * Math.sin(u) * Math.sin(a);
          cells[j + 1] = cy + loop * Math.cos(u) * Math.sin(a) + loop * 0.7 * Math.sin(u) * Math.cos(a);
          cells[j + 2] = 0.012 * side;
        }
      }
      cellsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      <points ref={sparksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={SPARKS} array={data.sparks} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          map={dot}
          color="#ffffff"
          transparent
          opacity={0.95}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
      {PHOTONS ? (
        <points ref={photonsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={PHOTONS} array={data.photons} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.1}
            map={dot}
            color="#fff7a8"
            transparent
            opacity={0.9}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      ) : null}
      {CELLS ? (
        <points ref={cellsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={CELLS * PER_CELL} array={data.cells} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            size={0.12}
            map={dot}
            color="#ffd0a0"
            transparent
            opacity={0.85}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      ) : null}
    </group>
  );
}

/**
 * A main-sequence star with a quarter cut away to show its insides. It sways
 * gently so both cut faces catch the eye without the wedge turning away.
 */
export function CutawayStar({ mass, colour, radius, intensity = 3 }) {
  const layers = starLayers(mass);
  const coreRef = useRef([]);
  const sway = useRef(null);
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const flicker = 2.6 + Math.sin(now * 7) * 0.35 + Math.sin(now * 13) * 0.2;
    for (const m of coreRef.current) if (m) m.emissiveIntensity = flicker;
    if (sway.current) sway.current.rotation.y = Math.sin(now * 0.35) * 0.45;
  });

  return (
    <group ref={sway}>
      <mesh>
        <sphereGeometry args={[radius, 64, 48, CUT_PHI_START, CUT_PHI_LENGTH]} />
        <meshStandardMaterial
          color={colour}
          emissive={colour}
          emissiveIntensity={intensity}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <StarHalo colour={colour} radius={radius * 1.25} />
      {CUT_FACES.map((turn, f) => (
        <group key={turn} rotation={[0, turn, 0]}>
          {layers.map((layer, i) => {
            const inner = i === 0 ? 0 : layers[i - 1].r * radius;
            const isCore = layer.kind === 'core' || layer.kind === 'convectiveCore';
            return (
              <mesh key={layer.kind}>
                <ringGeometry args={[inner, layer.r * radius, 64, 1, -Math.PI / 2, Math.PI]} />
                <meshStandardMaterial
                  ref={(m) => {
                    if (isCore) coreRef.current[f] = m;
                  }}
                  color={LAYER_COLOUR[layer.kind]}
                  emissive={LAYER_COLOUR[layer.kind]}
                  emissiveIntensity={isCore ? 2.6 : layer.kind === 'radiative' ? 0.9 : 0.7}
                  toneMapped={!isCore}
                  side={THREE.DoubleSide}
                />
              </mesh>
            );
          })}
          <FaceMotion radius={radius} layers={layers} side={f === 0 ? 1 : -1} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Inside the core: the reactions themselves

export const PROTON_COLOUR = '#ff5040';
export const NEUTRON_COLOUR = '#9fb2c8';
export const POSITRON_COLOUR = '#ffe0f4';
export const NEUTRINO_COLOUR = '#8dffb0';
export const GAMMA_COLOUR = '#fff27a';
const NUCLEON_R = 0.3;

/** Nucleon centres for a nucleus of n, packed into a rough ball. */
function packNucleons(n) {
  if (n === 1) return [[0, 0, 0]];
  if (n === 2) return [[-0.27, 0, 0], [0.27, 0, 0]];
  if (n === 3) return [[-0.27, -0.16, 0], [0.27, -0.16, 0], [0, 0.31, 0]];
  if (n === 4) return [[0.25, 0.25, 0.25], [-0.25, -0.25, 0.25], [-0.25, 0.25, -0.25], [0.25, -0.25, -0.25]];
  const out = [];
  const R = NUCLEON_R * Math.cbrt(n) * 1.15;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    const k = i % 3 === 0 ? 0.55 : 1;
    out.push([R * k * r * Math.cos(a), R * k * y, R * k * r * Math.sin(a)]);
  }
  return out;
}

/** How far above its centre a nucleus of n puts its label. */
const labelLift = (n) => (n <= 1 ? 0.55 : n <= 4 ? 0.75 : NUCLEON_R * Math.cbrt(n) * 1.15 + 0.6);

/**
 * A nucleus: protons and neutrons packed together. `turning` marks one
 * nucleon that has just changed from a proton into a neutron; it glows red
 * over the grey for a moment (`turnRef` holds the material to fade).
 */
function Nucleus({ protons, neutrons, glow = 0.25, label, turnRef }) {
  const n = protons + neutrons;
  const spots = packNucleons(n);
  let neutronSeen = false;
  return (
    <group>
      {spots.map((p, i) => {
        // Spread the protons evenly through the list so they mix.
        const proton = Math.floor(((i + 1) * protons) / n) > Math.floor((i * protons) / n);
        const c = proton ? PROTON_COLOUR : NEUTRON_COLOUR;
        const turning = turnRef && !proton && !neutronSeen;
        if (!proton) neutronSeen = true;
        return (
          <group key={i} position={p}>
            <mesh>
              <sphereGeometry args={[NUCLEON_R, 24, 18]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} roughness={0.35} metalness={0.1} />
            </mesh>
            {turning ? (
              <mesh scale={1.04}>
                <sphereGeometry args={[NUCLEON_R, 24, 18]} />
                <meshBasicMaterial ref={turnRef} color={PROTON_COLOUR} transparent opacity={0} depthWrite={false} />
              </mesh>
            ) : null}
          </group>
        );
      })}
      {label ? <TextSprite text={label} position={[0, labelLift(n), 0]} /> : null}
    </group>
  );
}

/**
 * A short text label that always faces the camera. The text is drawn once
 * onto a canvas texture; it is given by the page, from the locale files.
 */
function TextSprite({ text, position, height = 0.34, colour = '#fff4e0' }) {
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d');
    const font = '600 64px Inter, system-ui, sans-serif';
    let width = 64;
    if (g) {
      g.font = font;
      width = Math.ceil(g.measureText(text).width) + 24;
    }
    canvas.width = width;
    canvas.height = 84;
    if (g) {
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0,0,0,0.85)';
      g.shadowBlur = 10;
      g.fillStyle = colour;
      g.fillText(text, width / 2, 44);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.aspect = width / 84;
    return texture;
  }, [text, colour]);
  useEffect(() => () => label.dispose(), [label]);
  return (
    <sprite position={position} scale={[height * label.userData.aspect, height, 1]} renderOrder={10}>
      <spriteMaterial map={label} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

/** A small glowing ball: a positron. */
function Lepton({ colour, size = 0.13, label }) {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[size, 16, 12]} />
        <meshBasicMaterial color={colour} toneMapped={false} />
      </mesh>
      {label ? <TextSprite text={label} position={[0, 0.38, 0]} height={0.28} /> : null}
    </group>
  );
}

/** A neutrino: a faint streak pointing the way it flies, nearly unstoppable. */
function Streak({ colour, length = 1, width = 0.03, label }) {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[width, width * 0.3, length, 8]} />
        <meshBasicMaterial color={colour} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      {label ? <TextSprite text={label} position={[0, 0.35, 0]} height={0.28} /> : null}
    </group>
  );
}

/** A gamma ray: a short wave packet of light, drawn as a glowing wavy tube. */
function GammaWave({ label }) {
  const curve = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 48; i += 1) {
      const u = i / 48;
      const envelope = Math.sin(u * Math.PI);
      pts.push(new THREE.Vector3((u - 0.5) * 1.8, Math.sin(u * Math.PI * 8) * 0.16 * envelope, 0));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 96, 0.035, 6, false]} />
        <meshBasicMaterial color={GAMMA_COLOUR} toneMapped={false} />
      </mesh>
      {label ? <TextSprite text={label} position={[0, 0.42, 0]} height={0.28} colour="#fff7b0" /> : null}
    </group>
  );
}

/** Hot plasma all round: hydrogen nuclei darting about at random. */
function Plasma({ clock }) {
  const dot = useContext(DotContext);
  const COUNT = 520;
  const data = useMemo(() => {
    const rand = seeded(17);
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i += 1) {
      pos[i * 3] = (rand() - 0.5) * 14;
      pos[i * 3 + 1] = (rand() - 0.5) * 9;
      pos[i * 3 + 2] = -1.5 - rand() * 5;
      vel[i * 3] = (rand() - 0.5) * 2.4;
      vel[i * 3 + 1] = (rand() - 0.5) * 2.4;
      vel[i * 3 + 2] = (rand() - 0.5) * 0.6;
    }
    return { pos, vel };
  }, []);
  const ref = useRef(null);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) * clock.current.speed * (clock.current.playing ? 1 : 0.15);
    const { pos, vel } = data;
    for (let i = 0; i < COUNT * 3; i += 1) pos[i] += vel[i] * dt;
    for (let i = 0; i < COUNT; i += 1) {
      if (pos[i * 3] > 7) pos[i * 3] -= 14;
      if (pos[i * 3] < -7) pos[i * 3] += 14;
      if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] -= 9;
      if (pos[i * 3 + 1] < -4.5) pos[i * 3 + 1] += 9;
      if (pos[i * 3 + 2] > -1.5 || pos[i * 3 + 2] < -6.5) vel[i * 3 + 2] = -vel[i * 3 + 2];
    }
    if (ref.current) ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[40, 32, 16]} />
        <meshBasicMaterial color="#2a0a03" side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, 0, -8]}>
        <planeGeometry args={[30, 20]} />
        <meshBasicMaterial map={dot} color="#ff6a2a" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.22}
          map={dot}
          color="#ff7a4a"
          transparent
          opacity={0.45}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

const lerp3 = (a, b, t, out) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t;
  return out;
};
const TMP = [0, 0, 0];
const linear = (x) => clamp01(x);

/**
 * Two like charges closing in: they rush together, are slowed hard by their
 * electric repulsion just before touching, and then - by quantum tunnelling -
 * get through anyway.
 */
const repelled = (x) => {
  const t = clamp01(x);
  if (t < 0.62) return 0.82 * easeOut(t / 0.62);
  if (t < 0.9) return 0.82 + 0.06 * Math.sin(((t - 0.62) / 0.28) * Math.PI);
  return 0.82 + 0.18 * easeIn((t - 0.9) / 0.1);
};

/**
 * Places an actor for time `t`: hidden outside [from, to), and moved from `a`
 * to `b` over [moveFrom, moveTo] in between. Flying things point along their
 * path; `fadeFrom` shrinks them away towards the end.
 */
function place(ref, t, { from, to, a, b = a, moveFrom = from, moveTo = to, ease = smooth, fadeFrom, turn = true }) {
  const g = ref.current;
  if (!g) return;
  const on = t >= from && t < to;
  g.visible = on;
  if (!on) return;
  const q = ease((t - moveFrom) / Math.max(1e-6, moveTo - moveFrom));
  lerp3(a, b, q, TMP);
  g.position.set(TMP[0], TMP[1], TMP[2]);
  if (turn && b !== a) g.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const s = fadeFrom !== undefined ? 1 - smooth((t - fadeFrom) / Math.max(1e-6, to - fadeFrom)) : 1;
  g.scale.setScalar(Math.max(0.001, s));
}

function flashAt(ref, t, at, size, length = 0.5) {
  const g = ref.current;
  if (!g) return;
  const q = (t - at) / length;
  const on = q > 0 && q < 1;
  g.visible = on;
  if (!on) return;
  g.scale.setScalar(size * (0.2 + 0.8 * easeOut(q)));
  g.children[0].material.opacity = (1 - q) ** 2;
}

function Burst({ colour = '#fff4d0' }) {
  return (
    <mesh>
      <sphereGeometry args={[1, 24, 16]} />
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/** An expanding ring of light: the energy a reaction gives off. */
function EnergyRing({ colour = '#ffd27a' }) {
  return (
    <mesh>
      <torusGeometry args={[1, 0.04, 8, 64]} />
      <meshBasicMaterial color={colour} transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

function ringAt(ref, t, at, size, length = 0.9) {
  const g = ref.current;
  if (!g) return;
  const q = (t - at) / length;
  const on = q > 0 && q < 1;
  g.visible = on;
  if (!on) return;
  g.scale.setScalar(0.3 + size * easeOut(q));
  g.children[0].material.opacity = 0.9 * (1 - q);
}

/** The repulsion before two nuclei fuse: a shimmering ring between them. */
function Barrier() {
  return (
    <mesh>
      <ringGeometry args={[0.62, 0.68, 48]} />
      <meshBasicMaterial
        color="#9fd0ff"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function barrierAt(ref, t, from, to, now) {
  const g = ref.current;
  if (!g) return;
  const on = t >= from && t < to;
  g.visible = on;
  if (!on) return;
  const q = (t - from) / (to - from);
  g.children[0].material.opacity = 0.4 * Math.sin(q * Math.PI) * (0.6 + 0.4 * Math.sin(now * 30));
  g.scale.setScalar(0.9 + 0.12 * Math.sin(now * 18));
}

// The proton-proton chain, told left to right in one loop.
export const PP_LOOP = 10.5;
export const PP_STEP_STARTS = [0, 2.6, 5, 7.8];
const PP_A = [-2.9, 0.5, 0];
const PP_B = [0, -0.3, 0];
const PP_C = [2.9, 0.4, 0];
const stepAt = (starts, t) => {
  let s = 0;
  for (let i = 0; i < starts.length; i += 1) if (t >= starts[i]) s = i;
  return s;
};

function ProtonProtonChain({ clock, onStep, labels }) {
  const r = {
    p1: useRef(null),
    p2: useRef(null),
    barrierA: useRef(null),
    d: useRef(null),
    turn: useRef(null),
    eplus: useRef(null),
    nu: useRef(null),
    p3: useRef(null),
    barrierB: useRef(null),
    he3: useRef(null),
    gamma: useRef(null),
    he3b: useRef(null),
    barrierC: useRef(null),
    he4: useRef(null),
    energy: useRef(null),
    out1: useRef(null),
    out2: useRef(null),
    fA: useRef(null),
    fB: useRef(null),
    fC: useRef(null),
    ringC: useRef(null),
  };
  const step = useRef(-1);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const t = clock.current.t % PP_LOOP;
    const s = stepAt(PP_STEP_STARTS, t);
    if (s !== step.current) {
      step.current = s;
      onStep?.(s);
    }
    // 1. p + p -> d + e+ + neutrino. The protons are held off by their
    // repulsion, then tunnel through; one of them becomes a neutron.
    place(r.p1, t, { from: 0, to: 1.6, a: [-4.9, 2.2], b: [PP_A[0] - 0.3, PP_A[1]], ease: repelled, turn: false });
    place(r.p2, t, { from: 0, to: 1.6, a: [-1.2, -1.8], b: [PP_A[0] + 0.3, PP_A[1]], ease: repelled, turn: false });
    barrierAt(r.barrierA, t, 0.95, 1.6, now);
    if (r.barrierA.current) r.barrierA.current.position.set(PP_A[0], PP_A[1], 0.05);
    flashAt(r.fA, t, 1.6, 0.9);
    place(r.d, t, { from: 1.6, to: 3.95, a: PP_A, b: [PP_B[0] - 0.45, PP_B[1]], moveFrom: 2.6, moveTo: 3.7, turn: false });
    if (r.turn.current) r.turn.current.opacity = 1 - smooth((t - 1.6) / 0.7);
    place(r.eplus, t, { from: 1.6, to: 2.8, a: PP_A, b: [PP_A[0] + 0.9, PP_A[1] + 2.7], ease: easeOut, fadeFrom: 2.3, turn: false });
    place(r.nu, t, { from: 1.6, to: 2.3, a: PP_A, b: [PP_A[0] - 1.6, PP_A[1] - 3.6], ease: linear });
    // 2. d + p -> helium-3 + gamma
    place(r.p3, t, { from: 2.6, to: 3.95, a: [1.3, 2.9], b: [PP_B[0] + 0.42, PP_B[1] + 0.12], ease: repelled, turn: false });
    barrierAt(r.barrierB, t, 3.3, 3.95, now);
    if (r.barrierB.current) r.barrierB.current.position.set(PP_B[0], PP_B[1], 0.05);
    flashAt(r.fB, t, 3.95, 1.1);
    place(r.gamma, t, { from: 3.95, to: 4.9, a: PP_B, b: [PP_B[0] + 1.6, PP_B[1] - 3.4], ease: linear });
    place(r.he3, t, { from: 3.95, to: 6.6, a: PP_B, b: [PP_C[0] - 0.55, PP_C[1]], moveFrom: 5, moveTo: 6.3, turn: false });
    // 3. helium-3 + helium-3 -> helium-4 + 2p
    place(r.he3b, t, { from: 5, to: 6.6, a: [5.3, 2.8], b: [PP_C[0] + 0.55, PP_C[1]], ease: repelled, turn: false });
    barrierAt(r.barrierC, t, 6, 6.6, now);
    if (r.barrierC.current) r.barrierC.current.position.set(PP_C[0], PP_C[1], 0.05);
    flashAt(r.fC, t, 6.6, 1.8, 0.7);
    ringAt(r.ringC, t, 6.6, 2.6);
    place(r.out1, t, { from: 6.6, to: 8, a: PP_C, b: [PP_C[0] + 1.6, PP_C[1] - 2.3], ease: easeOut, fadeFrom: 7.5, turn: false });
    place(r.out2, t, { from: 6.6, to: 8, a: PP_C, b: [PP_C[0] - 0.7, PP_C[1] - 2.7], ease: easeOut, fadeFrom: 7.5, turn: false });
    // The product, and the energy it was paid for with.
    place(r.he4, t, { from: 6.6, to: PP_LOOP - 0.3, a: PP_C, fadeFrom: PP_LOOP - 0.8, turn: false });
    if (r.he4.current?.visible) r.he4.current.scale.multiplyScalar(1 + 0.06 * Math.sin(now * 6));
    place(r.energy, t, { from: 7.8, to: PP_LOOP - 0.3, a: [PP_C[0], PP_C[1] + 1.2], b: [PP_C[0], PP_C[1] + 1.7], fadeFrom: PP_LOOP - 0.8, turn: false });
    for (const k of ['d', 'he3', 'he3b', 'he4']) if (r[k].current) r[k].current.rotation.y = now * 0.8;
  });

  return (
    <group>
      <group ref={r.p1} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={r.p2} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={r.barrierA} visible={false}><Barrier /></group>
      <group ref={r.d} visible={false}>
        <Nucleus protons={1} neutrons={1} label={labels.d} turnRef={r.turn} />
      </group>
      <group ref={r.eplus} visible={false}><Lepton colour={POSITRON_COLOUR} label={labels.positron} /></group>
      <group ref={r.nu} visible={false}><Streak colour={NEUTRINO_COLOUR} label={labels.neutrino} /></group>
      <group ref={r.p3} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={r.barrierB} visible={false}><Barrier /></group>
      <group ref={r.gamma} visible={false}><GammaWave label={labels.gamma} /></group>
      <group ref={r.he3} visible={false}><Nucleus protons={2} neutrons={1} label={labels.he3} /></group>
      <group ref={r.he3b} visible={false}><Nucleus protons={2} neutrons={1} label={labels.he3} /></group>
      <group ref={r.barrierC} visible={false}><Barrier /></group>
      <group ref={r.he4} visible={false}><Nucleus protons={2} neutrons={2} glow={0.6} label={labels.he4} /></group>
      <group ref={r.energy} visible={false}><TextSprite text={labels.energy} position={[0, 0, 0]} height={0.4} colour="#ffd27a" /></group>
      <group ref={r.out1} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={r.out2} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={r.fA} position={PP_A} visible={false}><Burst colour="#d8ecff" /></group>
      <group ref={r.fB} position={PP_B} visible={false}><Burst colour="#fff3a0" /></group>
      <group ref={r.fC} position={PP_C} visible={false}><Burst /></group>
      <group ref={r.ringC} position={PP_C} visible={false}><EnergyRing /></group>
    </group>
  );
}

// The CNO cycle: one carbon nucleus taken round six steps and back again.
const CNO_STEP = 1.9;
export const CNO_LOOP = CNO_STEP * 6 + 1.2;
export const CNO_STEP_STARTS = [0, 1, 2, 3, 4, 5, 6].map((k) => k * CNO_STEP);
const CNO_RADIUS = 2.75;
const REACT_AT = 0.8;
/** The nucleus after each step: C-12, N-13, C-13, N-14, O-15, N-15. */
const CNO_NUCLEI = [
  [6, 6, 'c12'],
  [7, 6, 'n13'],
  [6, 7, 'c13'],
  [7, 7, 'n14'],
  [8, 7, 'o15'],
  [7, 8, 'n15'],
];
/** What each step takes in and gives off. */
const CNO_EVENTS = ['capture', 'decay', 'capture', 'capture', 'decay', 'helium'];
const station = (k) => {
  const a = Math.PI / 2 - (k % 6) * ((2 * Math.PI) / 6);
  return [CNO_RADIUS * Math.cos(a), CNO_RADIUS * Math.sin(a), 0];
};

function CnoCycle({ clock, onStep, labels }) {
  const nuclei = useRef([]);
  const holder = useRef(null);
  const proton = useRef(null);
  const barrier = useRef(null);
  const gamma = useRef(null);
  const eplus = useRef(null);
  const nu = useRef(null);
  const helium = useRef(null);
  const burst = useRef(null);
  const ring = useRef(null);
  const step = useRef(-1);
  const circle = useMemo(() => {
    const pts = new Float32Array(65 * 3);
    for (let i = 0; i <= 64; i += 1) {
      const a = (i / 64) * Math.PI * 2;
      pts[i * 3] = CNO_RADIUS * Math.cos(a);
      pts[i * 3 + 1] = CNO_RADIUS * Math.sin(a);
    }
    return pts;
  }, []);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const t = clock.current.t % CNO_LOOP;
    const resting = t >= CNO_STEP * 6;
    const k = resting ? 5 : Math.floor(t / CNO_STEP);
    const tau = t - k * CNO_STEP;
    const s = resting ? 6 : k;
    if (s !== step.current) {
      step.current = s;
      onStep?.(s);
    }
    const here = station(k);
    const there = station(k + 1);
    const out = [here[0] / CNO_RADIUS, here[1] / CNO_RADIUS];

    // Which nucleus: the one before this step until the reaction, then after.
    const shown = resting ? 0 : tau < REACT_AT ? k : (k + 1) % 6;
    nuclei.current.forEach((g, i) => {
      if (g) g.visible = i === shown;
    });
    if (holder.current) {
      const glide = resting ? 0 : smooth((tau - 1.2) / (CNO_STEP - 1.2));
      const at = resting ? station(0) : lerp3(here, there, glide, [0, 0, 0]);
      holder.current.position.set(at[0], at[1], 0);
      holder.current.children.forEach((g) => {
        g.rotation.y = now * 0.6;
      });
    }

    const event = resting ? null : CNO_EVENTS[k];
    const captures = event === 'capture' || event === 'helium';
    const from = [here[0] + out[0] * 2.5 - out[1] * 1, here[1] + out[1] * 2.5 + out[0] * 1, 0];
    place(proton, captures ? tau : -1, { from: 0, to: REACT_AT, a: from, b: here, ease: repelled, turn: false });
    barrierAt(barrier, captures ? tau : -1, REACT_AT - 0.35, REACT_AT, now);
    if (barrier.current) barrier.current.position.set(here[0], here[1], 0.05);
    flashAt(burst, resting ? -1 : tau, REACT_AT, event === 'helium' ? 1.5 : 1);
    ringAt(ring, resting ? -1 : tau, REACT_AT, event === 'helium' ? 2.4 : 1.4);
    for (const g of [burst.current, ring.current]) if (g) g.position.set(here[0], here[1], 0);
    const away = [here[0] + out[0] * 3.2 + out[1] * 1.2, here[1] + out[1] * 3.2 - out[0] * 1.2, 0];
    const away2 = [here[0] + out[0] * 3.2 - out[1] * 1.4, here[1] + out[1] * 3.2 + out[0] * 1.4, 0];
    place(gamma, event === 'capture' ? tau : -1, { from: REACT_AT, to: REACT_AT + 0.9, a: here, b: away, ease: linear });
    place(eplus, event === 'decay' ? tau : -1, { from: REACT_AT, to: REACT_AT + 1, a: here, b: away, ease: easeOut, fadeFrom: REACT_AT + 0.6, turn: false });
    place(nu, event === 'decay' ? tau : -1, { from: REACT_AT, to: REACT_AT + 0.6, a: here, b: away2, ease: linear });
    // The helium made in the last step drifts to the middle and waits there.
    const heT = k === 5 ? tau : -1;
    place(helium, heT, { from: REACT_AT, to: CNO_STEP + 1.2, a: here, b: [0, 0, 0], moveFrom: REACT_AT, moveTo: REACT_AT + 1, fadeFrom: CNO_STEP + 0.8, turn: false });
    if (helium.current) helium.current.rotation.y = now;
  });

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={65} array={circle} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffb070" transparent opacity={0.25} />
      </line>
      {CNO_NUCLEI.map(([, , key], k) => {
        const at = station(k);
        const out = [at[0] / CNO_RADIUS, at[1] / CNO_RADIUS];
        return (
          <group key={key}>
            <mesh position={at}>
              <ringGeometry args={[1.0, 1.05, 48]} />
              <meshBasicMaterial color="#ffb070" transparent opacity={0.18} side={THREE.DoubleSide} />
            </mesh>
            <TextSprite
              text={labels[key]}
              position={[at[0] + out[0] * 1.45, at[1] + out[1] * 1.45, 0]}
              height={0.44}
              colour="#ffd9b0"
            />
          </group>
        );
      })}
      <group ref={holder}>
        {CNO_NUCLEI.map(([p, n, key], i) => (
          <group
            key={key}
            ref={(g) => {
              nuclei.current[i] = g;
            }}
            visible={i === 0}
          >
            <Nucleus protons={p} neutrons={n} />
          </group>
        ))}
      </group>
      <group ref={proton} visible={false}><Nucleus protons={1} neutrons={0} label={labels.p} /></group>
      <group ref={barrier} visible={false}><Barrier /></group>
      <group ref={gamma} visible={false}><GammaWave label={labels.gamma} /></group>
      <group ref={eplus} visible={false}><Lepton colour={POSITRON_COLOUR} label={labels.positron} /></group>
      <group ref={nu} visible={false}><Streak colour={NEUTRINO_COLOUR} label={labels.neutrino} /></group>
      <group ref={helium} visible={false}><Nucleus protons={2} neutrons={2} glow={0.6} label={labels.he4} /></group>
      <group ref={burst} visible={false}><Burst /></group>
      <group ref={ring} visible={false}><EnergyRing /></group>
    </group>
  );
}

/**
 * Hydrogen fusion in a star's core: the reactions, in the plasma.
 *
 * The clock is the panel's: `playing` and `speed` drive it, and a new `seek`
 * ({ step, n }) jumps it to the start of that step.
 */
export function FusionCore({ chain, playing, speed, seek, onStep, labels }) {
  const clock = useRef({ t: 0, playing, speed });
  clock.current.playing = playing;
  clock.current.speed = speed;
  const loop = chain === 'cno' ? CNO_LOOP : PP_LOOP;
  const starts = chain === 'cno' ? CNO_STEP_STARTS : PP_STEP_STARTS;

  useEffect(() => {
    if (seek) clock.current.t = starts[Math.min(seek.step, starts.length - 1)] + 0.001;
  }, [seek, starts]);

  useFrame((_, delta) => {
    if (playing) clock.current.t = (clock.current.t + Math.min(delta, 0.1) * speed) % loop;
  });

  return (
    <group>
      <ambientLight intensity={0.55} />
      <pointLight position={[0, 2, 6]} intensity={40} color="#fff1dc" />
      <Plasma clock={clock} />
      {/* Lifted a little so the caption under the picture does not cover it. */}
      <group position={[0, 0.75, 0]}>
        {chain === 'cno' ? (
          <CnoCycle clock={clock} onStep={onStep} labels={labels} />
        ) : (
          <ProtonProtonChain clock={clock} onStep={onStep} labels={labels} />
        )}
      </group>
    </group>
  );
}
