import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { CLASS_COLOUR, spectralClass } from '@/lib/stellarEvolution';
import { PILLARS_DIVE, PILLARS_HOLD, PillarsIntro, ProtostarModel } from './StarBirthScenes';
import { PlanetaryNebula, Supernova } from './StarDeathScenes';
import { BlackHole, Pulsar, WhiteDwarf } from './StarRemnants';
import { MassLoss, Prominences, StarSurface, Turning } from './StarSurface';
import {
  DotContext,
  DotProvider,
  FadeContext,
  StarHalo,
  clamp01,
  easeIn,
  easeOut,
  gauss,
  mainSequenceRadius,
  seeded,
  smooth,
} from './SceneKit';

export { DotProvider };

/**
 * The pictures for Life of a Star: every stage, and the way one stage turns
 * into the next.
 *
 * - **Stages morph.** Swapping one picture for the next told the reader
 *   nothing about how a star changes. The outgoing stage does what the star
 *   does - swells into a giant, blows off its envelope, collapses before the
 *   supernova - while the incoming one grows or shrinks into place.
 * - **Real shapes where science has them.** The birth opens on the Pillars
 *   of Creation and ends on DG Tau's disc and jets (`StarBirthScenes`); the
 *   planetary nebula is the Helix and the supernova settles into Cassiopeia A
 *   (`StarDeathScenes`); the pulsar sits in the Crab's ring and jets
 *   (`StarRemnants`). All are NASA / Chandra 3D reconstructions, loaded from
 *   this site (`ModelKit`).
 * - **Shaders where a model adds nothing.** A star is a ball: its living
 *   surface - convection cells, spots, limb darkening, prominences - is drawn
 *   by `StarSurface`; the black hole's disc and bent light by `StarRemnants`.
 *
 * How a star shines - the fusion in its core - has its own module
 * (`FusionModule.jsx`). Not to scale, and the page says so.
 */


// ---------------------------------------------------------------------------
// Shared pieces


function fadeGroup(group, factor) {
  group.traverse((object) => {
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const m of materials) {
      if (m.userData.selfFade) continue;
      if (m.userData.baseOpacity === undefined) {
        m.userData.baseOpacity = m.opacity;
        m.userData.baseTransparent = m.transparent;
      }
      const transparent = factor < 0.999 || m.userData.baseTransparent;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.opacity = m.userData.baseOpacity * factor;
    }
  });
}

/** A bright ball that swells and fades: ignition, the supernova's blast. */
function Flash({ progress, at, colour, size, length = 0.35 }) {
  const ref = useRef(null);
  const mat = useRef(null);
  useFrame(() => {
    if (!ref.current || !mat.current) return;
    const q = (progress.current - at) / length;
    const on = q > 0 && q < 1;
    ref.current.visible = on;
    if (!on) return;
    ref.current.scale.setScalar(size * (0.15 + 0.85 * easeOut(q)));
    mat.current.opacity = (1 - q) ** 2;
  });
  return (
    <mesh ref={ref} visible={false}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        ref={mat}
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

// ---------------------------------------------------------------------------
// Birth: a cold cloud whose densest clump collapses into a protostar

export const NEBULA_COLLAPSE_SECONDS = 7;
/** The collapse starts while the view is diving into the pillar. */
const COLLAPSE_DELAY = PILLARS_HOLD + PILLARS_DIVE * 0.6;
/**
 * Each cloud layer's own opacity: haze, gas, dust, young stars. Kept here,
 * not on the materials, because React resets a material's userData whenever
 * the scene re-renders.
 */
const CLOUD_OPACITY = [0.04, 0.75, 0.55, 0.9];
/** The whole birth: pillars, the dive, the collapse. */
export const NEBULA_SECONDS = COLLAPSE_DELAY + NEBULA_COLLAPSE_SECONDS;
const GAS_COUNT = 6500;

/** Phases the reader is told about as the cloud collapses. */
export const NEBULA_PHASES = ['cloud', 'collapse', 'protostar'];

function buildCloud() {
  const rand = seeded(7);
  // Clumps: one dense one at the centre - the one that will become the star -
  // and lighter ones around it, plus a long filament through the cloud, which
  // is the shape real star-forming clouds take.
  const clumps = [{ c: [0, 0, 0], s: 1.1, w: 3 }];
  for (let i = 0; i < 6; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 2 + rand() * 2.2;
    clumps.push({ c: [r * Math.cos(a), (rand() - 0.5) * 2.4, r * Math.sin(a) * 0.7], s: 0.6 + rand() * 0.8, w: 1 });
  }
  const total = clumps.reduce((sum, c) => sum + c.w, 0);
  const inner = new THREE.Color('#ff5a8a');
  const middle = new THREE.Color('#b25cff');
  const outer = new THREE.Color('#47c8ff');
  const colour = new THREE.Color();

  const base = new Float32Array(GAS_COUNT * 3);
  const colours = new Float32Array(GAS_COUNT * 3);
  const fall = new Float32Array(GAS_COUNT);
  for (let i = 0; i < GAS_COUNT; i += 1) {
    let x;
    let y;
    let z;
    if (i < GAS_COUNT * 0.25) {
      // The filament: a gentle S through the cloud.
      const u = rand() * 2 - 1;
      x = u * 5.2 + gauss(rand) * 0.35;
      y = Math.sin(u * 2.2) * 1.4 + gauss(rand) * 0.35;
      z = Math.cos(u * 1.7) * 0.8 + gauss(rand) * 0.35;
    } else {
      let pick = rand() * total;
      let clump = clumps[0];
      for (const c of clumps) {
        pick -= c.w;
        if (pick <= 0) {
          clump = c;
          break;
        }
      }
      x = clump.c[0] + gauss(rand) * clump.s;
      y = clump.c[1] + gauss(rand) * clump.s * 0.8;
      z = clump.c[2] + gauss(rand) * clump.s;
    }
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    const d = Math.hypot(x, y, z);
    // Only the inner clump falls all the way in; the rest of the cloud stays.
    fall[i] = 0.05 + 0.95 * smooth((d - 0.4) / 4.2);
    const k = clamp01(d / 5);
    if (k < 0.45) colour.copy(inner).lerp(middle, k / 0.45);
    else colour.copy(middle).lerp(outer, (k - 0.45) / 0.55);
    colour.multiplyScalar(0.55 + 0.45 * rand());
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }

  // Dark dust lanes, drawn in front of the glowing gas.
  const DUST = 1400;
  const dust = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i += 1) {
    const u = rand() * 2 - 1;
    dust[i * 3] = u * 5.5 + gauss(rand) * 0.3;
    dust[i * 3 + 1] = -0.6 + u * 1.1 + Math.sin(u * 3) * 0.5 + gauss(rand) * 0.28;
    dust[i * 3 + 2] = 1.2 + gauss(rand) * 0.5;
  }

  // A thin haze of big soft blobs gives the cloud its body.
  const HAZE = 700;
  const haze = new Float32Array(HAZE * 3);
  const hazeColours = new Float32Array(HAZE * 3);
  for (let i = 0; i < HAZE; i += 1) {
    const x = gauss(rand) * 2.6;
    const y = gauss(rand) * 1.6;
    const z = gauss(rand) * 2;
    haze[i * 3] = x;
    haze[i * 3 + 1] = y;
    haze[i * 3 + 2] = z;
    colour.copy(inner).lerp(outer, clamp01(Math.hypot(x, y, z) / 5));
    hazeColours[i * 3] = colour.r;
    hazeColours[i * 3 + 1] = colour.g;
    hazeColours[i * 3 + 2] = colour.b;
  }

  // A few young stars already shining in the outskirts.
  const SPARKS = 14;
  const sparks = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 2.6 + rand() * 2.6;
    sparks[i * 3] = r * Math.cos(a);
    sparks[i * 3 + 1] = (rand() - 0.5) * 3;
    sparks[i * 3 + 2] = r * Math.sin(a) * 0.8;
  }

  // The disc that forms around the protostar.
  const DISC = 1200;
  const disc = new Float32Array(DISC * 3);
  for (let i = 0; i < DISC; i += 1) {
    const a = rand() * Math.PI * 2;
    const r = 0.35 + 1.25 * rand() ** 0.7;
    disc[i * 3] = r * Math.cos(a);
    disc[i * 3 + 1] = gauss(rand) * 0.03 * r;
    disc[i * 3 + 2] = r * Math.sin(a);
  }

  return { base, colours, fall, dust, haze, hazeColours, sparks, disc };
}

/**
 * The cloud collapses over NEBULA_COLLAPSE_SECONDS and then holds. Each point
 * falls towards the centre by its own share and turns faster the further in
 * it gets - angular momentum is kept, so a shrinking clump spins up like a
 * skater pulling in their arms - and the inner part flattens into a disc.
 */
function CollapsingNebula({ onPhase, delay = 0 }) {
  const dot = useContext(DotContext);
  const born = useRef(null);
  const cloudGroup = useRef(null);
  const cloudMats = useRef([]);
  const modelGlow = useRef(0);
  const fade = useContext(FadeContext);
  const cloud = useMemo(() => buildCloud(), []);
  const positions = useMemo(() => new Float32Array(cloud.base), [cloud]);
  const angles = useMemo(() => new Float32Array(GAS_COUNT), []);
  const gasRef = useRef(null);
  const start = useRef(null);
  const phase = useRef(-1);
  const proto = useRef(null);
  const protoMat = useRef(null);
  const protoHalo = useRef(null);
  const discRef = useRef(null);
  const discMat = useRef(null);
  const jets = useRef(null);
  const jetMats = useRef([]);
  const group = useRef(null);

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime;
    if (born.current === null) born.current = now;
    const age = now - born.current;
    if (start.current === null && age >= delay) start.current = now;
    const p = start.current === null ? 0 : clamp01((now - start.current) / NEBULA_COLLAPSE_SECONDS);
    const pe = smooth(p);
    const dt = Math.min(delta, 0.05);

    // The cloud comes into view as the dive into the pillar ends.
    const intro = delay > 0 ? smooth((age - (delay - 1.4)) / 1.8) : 1;
    if (cloudGroup.current) {
      cloudGroup.current.visible = intro > 0.002;
      cloudGroup.current.scale.setScalar(0.3 + 0.7 * intro);
    }
    cloudMats.current.forEach((m, i) => {
      if (m) m.opacity = CLOUD_OPACITY[i] * intro * fade.current;
    });

    if (start.current !== null) {
      const next = p < 0.28 ? 0 : p < 0.62 ? 1 : 2;
      if (next !== phase.current) {
        phase.current = next;
        onPhase?.(NEBULA_PHASES[next]);
      }
    }
    modelGlow.current = smooth((p - 0.62) / 0.3);

    const geo = gasRef.current?.geometry;
    if (geo) {
      const base = cloud.base;
      for (let i = 0; i < GAS_COUNT; i += 1) {
        const shrink = 1 - (1 - cloud.fall[i]) * pe;
        // Spin rate grows as 1/r^2, capped so the core does not strobe.
        angles[i] += dt * Math.min(2.4, 0.05 / (shrink * shrink));
        const c = Math.cos(angles[i]);
        const s = Math.sin(angles[i]);
        const x = base[i * 3] * shrink;
        const z = base[i * 3 + 2] * shrink;
        const flatten = 1 - 0.75 * pe * (1 - cloud.fall[i]);
        positions[i * 3] = x * c - z * s;
        positions[i * 3 + 1] = base[i * 3 + 1] * shrink * flatten;
        positions[i * 3 + 2] = x * s + z * c;
      }
      geo.attributes.position.needsUpdate = true;
    }

    const f = fade.current;
    // The protostar: cool and red at first, heated only by its own squeezing.
    const glow = smooth((p - 0.3) / 0.6);
    if (proto.current && protoMat.current) {
      proto.current.scale.setScalar(0.05 + 0.32 * glow);
      protoMat.current.opacity = glow * f;
      protoMat.current.emissiveIntensity = 0.8 + 3.2 * glow;
      protoMat.current.emissive.setRGB(1, 0.35 + 0.35 * glow, 0.15 + 0.2 * glow);
    }
    if (protoHalo.current) protoHalo.current.opacity = 0.25 * glow * f;
    if (discRef.current && discMat.current) {
      discRef.current.rotation.y += dt * 1.6;
      discMat.current.opacity = 0.65 * smooth((p - 0.45) / 0.4) * f;
    }
    if (jets.current) {
      const jet = smooth((p - 0.68) / 0.3);
      const pulse = 0.75 + 0.25 * Math.sin(now * 5);
      jets.current.scale.set(1, 0.2 + 0.8 * jet, 1);
      for (const m of jetMats.current) if (m) m.opacity = 0.16 * jet * pulse * f;
    }
    if (group.current) group.current.rotation.y += dt * 0.02;
  });

  const keep = (i) => (m) => {
    cloudMats.current[i] = m;
  };

  return (
    <group ref={cloudGroup} visible={delay === 0}>
      <group ref={group} rotation={[0.18, 0, 0.12]}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={700} array={cloud.haze} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={700} array={cloud.hazeColours} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={keep(0)}
            size={2.6}
            map={dot}
            vertexColors
            transparent
            opacity={0.04}
            userData={{ selfFade: true }}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
        <points ref={gasRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={GAS_COUNT} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={GAS_COUNT} array={cloud.colours} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={keep(1)}
            size={0.16}
            map={dot}
            vertexColors
            transparent
            opacity={0.75}
            userData={{ selfFade: true }}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
        <points renderOrder={2}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={1400} array={cloud.dust} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={keep(2)}
            size={0.55}
            map={dot}
            color="#0b0610"
            transparent
            opacity={0.55}
            userData={{ selfFade: true }}
            sizeAttenuation
            depthWrite={false}
          />
        </points>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={14} array={cloud.sparks} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={keep(3)}
            size={0.32}
            map={dot}
            color="#dff1ff"
            transparent
            opacity={0.9}
            userData={{ selfFade: true }}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        <mesh ref={proto} scale={0.05}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial
            ref={protoMat}
            color="#ff6a3a"
            emissive="#ff5a26"
            emissiveIntensity={0.8}
            transparent
            opacity={0}
            toneMapped={false}
            userData={{ selfFade: true }}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.9, 32, 32]} />
          <meshBasicMaterial
            ref={protoHalo}
            color="#ff8a4c"
            transparent
            opacity={0}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            userData={{ selfFade: true }}
          />
        </mesh>
        <points ref={discRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={1200} array={cloud.disc} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial
            ref={discMat}
            size={0.09}
            map={dot}
            color="#ffb27a"
            transparent
            opacity={0}
            sizeAttenuation
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            userData={{ selfFade: true }}
          />
        </points>
        {/* Jets: gas the young star cannot swallow, thrown out along its poles. */}
        <group ref={jets} scale={[1, 0.2, 1]}>
          {[1, -1].map((side, i) => (
            <mesh key={side} position={[0, side * 1.7, 0]} rotation={[side > 0 ? Math.PI : 0, 0, 0]}>
              <coneGeometry args={[0.11, 3.2, 20, 1, true]} />
              <meshBasicMaterial
                ref={(m) => {
                  jetMats.current[i] = m;
                }}
                color="#9fd8ff"
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                userData={{ selfFade: true }}
              />
            </mesh>
          ))}
        </group>
        {/* The real thing: DG Tau's disc and jets, as NASA and INAF modelled them. */}
        <ProtostarModel glow={modelGlow} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Death

/**
 * The whole birth: the Pillars of Creation, a dive into the tip of one, and
 * a clump inside it collapsing into a protostar.
 */
function StarBirth({ onPhase }) {
  const told = useRef(false);
  useFrame(() => {
    if (!told.current) {
      told.current = true;
      onPhase?.('pillars');
    }
  });
  return (
    <group>
      <PillarsIntro />
      <CollapsingNebula onPhase={onPhase} delay={COLLAPSE_DELAY} />
    </group>
  );
}

/** Each stage drawn for a star of this mass. Not to scale, by design. */
function StageScene({ stage, mass, onPhase }) {
  const colour = CLASS_COLOUR[spectralClass(mass)];
  const msRadius = mainSequenceRadius(mass);
  // Warmed a little for the surface: a white disc shows no granulation.
  const surface = useMemo(() => '#' + new THREE.Color(colour).lerp(new THREE.Color('#ffb347'), 0.5).getHexString(), [colour]);

  switch (stage) {
    case 'nebula':
      return <StarBirth onPhase={onPhase} />;
    case 'mainSequence':
      return (
        <Turning speed={0.06}>
          <StarSurface
            radius={msRadius}
            colour={surface}
            cells={34}
            contrast={0.5}
            warp={0.6}
            soft={0.35}
            spots={mass > 0.7 && mass < 1.4 ? 0.9 : 0}
            brightness={mass < 0.5 ? 1.1 : 1.2}
            glowOpacity={0.55}
            glowColour={surface}
          />
          <Prominences radius={msRadius} count={mass < 0.5 ? 3 : 6} colour={mass > 2 ? '#9fc8ff' : '#ff8a3c'} />
        </Turning>
      );
    // Giants: a few huge convection cells, a dim red rim, an outline that is
    // not quite round - the outer layers are barely held - and a slow
    // breathing in and out. They shed gas and dust all the while.
    case 'redGiant':
      return (
        <Turning speed={0.03} pulse={0.025} period={8}>
          <StarSurface radius={3.1} colour="#ff7a2e" cells={6} contrast={0.62} speed={0.12} wobble={0.03} warp={1.3} soft={0.9} fine={0.6} brightness={1.15} glow={2.4} glowOpacity={0.35} />
          <MassLoss radius={3.1} count={700} colour="#ffb07a" speed={0.2} />
        </Turning>
      );
    case 'redSupergiant':
      return (
        <Turning speed={0.02} pulse={0.035} period={11}>
          <StarSurface radius={3.9} colour="#ee4a1c" cells={2.6} contrast={0.7} speed={0.08} wobble={0.08} warp={1.5} soft={1.1} fine={0.7} brightness={1.1} glow={2.2} glowOpacity={0.3} />
          <MassLoss radius={3.9} count={1100} colour="#ff8a5a" lopsided={0.7} speed={0.16} />
        </Turning>
      );
    case 'planetaryNebula':
      return <PlanetaryNebula onPhase={onPhase} />;
    case 'whiteDwarf':
      return <WhiteDwarf />;
    case 'supernova':
      return <Supernova onPhase={onPhase} />;
    case 'neutronStar':
      return <Pulsar onPhase={onPhase} />;
    case 'blackHole':
      return <BlackHole />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// One stage turning into the next

const MORPH_SECONDS = 1.8;

/**
 * What the outgoing stage does (`out`: the scale it ends at) and where the
 * incoming one starts (`in`), for each real change. A step backwards along
 * the timeline gets a plain cross-fade.
 */
function morphFor(from, to, mass) {
  const ms = mainSequenceRadius(mass);
  switch (`${from}>${to}`) {
    case 'nebula>mainSequence':
      // The protostar's core reaches ignition: the cloud falls in, a flash.
      return { seconds: 2.6, out: 0.12, in: 0.06, inDelay: 0.3, flash: { at: 0.28, colour: '#fff3d6', size: 2.6 } };
    case 'mainSequence>redGiant':
      return { seconds: 2.2, out: 3.1 / ms, in: ms / 3.1 };
    case 'mainSequence>redSupergiant':
      return { seconds: 2.2, out: 3.9 / ms, in: ms / 3.9 };
    case 'mainSequence>whiteDwarf':
      return { seconds: 2.4, out: 0.24 / ms, in: ms / 0.24 };
    case 'redGiant>planetaryNebula':
      return { seconds: 2.4, out: 1.7, in: 0.35 };
    case 'planetaryNebula>whiteDwarf':
      return { seconds: 2.2, out: 2, in: 1 };
    case 'redSupergiant>supernova':
      // The core gives way: the star falls in, then the blast.
      return {
        seconds: 2.2,
        out: 0.04,
        outEnd: 0.4,
        collapse: true,
        in: 1,
        inDelay: 0.38,
      };
    case 'supernova>neutronStar':
    case 'supernova>blackHole':
      return { seconds: 2.2, out: 1.8, in: 0.25 };
    default:
      return { out: 1.15, in: 0.85 };
  }
}

function MorphLayer({ role, spec, progress, children }) {
  const ref = useRef(null);
  const fade = useRef(1);
  const last = useRef(-1);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    let s = 1;
    let f = 1;
    if (spec) {
      const p = progress.current;
      if (role === 'out') {
        const q = clamp01(p / (spec.outEnd ?? 1));
        s = 1 + (spec.out - 1) * (spec.collapse ? easeIn(q) : smooth(q));
        f = 1 - smooth(q);
      } else {
        const d = spec.inDelay ?? 0;
        const q = clamp01((p - d) / (1 - d));
        s = spec.in + (1 - spec.in) * easeOut(q);
        f = smooth(q * 1.4);
      }
    }
    g.scale.setScalar(Math.max(1e-3, s));
    g.visible = f > 0.002;
    fade.current = f;
    if (f !== 1 || last.current !== 1) fadeGroup(g, f);
    last.current = f;
  });

  return (
    <group ref={ref} scale={role === 'in' && spec ? spec.in : 1}>
      <FadeContext.Provider value={fade}>{children}</FadeContext.Provider>
    </group>
  );
}

/**
 * Draws `stage`, morphing from whatever was drawn before. The outgoing stage
 * keeps its React key when it becomes the outgoing layer, so it carries on
 * from where it was - the collapsed cloud does not spring back to a haze.
 */
export function StageMorph({ stage, mass, onPhase, onMorph }) {
  const [shown, setShown] = useState({ stage, prev: null, id: 0 });
  if (shown.stage !== stage) setShown({ stage, prev: shown.stage, id: shown.id + 1 });

  const spec = useMemo(() => (shown.prev ? morphFor(shown.prev, shown.stage, mass) : null), [shown.prev, shown.stage, mass]);
  const progress = useRef(1);
  const started = useRef({ id: -1, at: 0 });
  // A new morph starts at 0 from its very first frame; the layers read this
  // before the clock below has caught up.
  if (shown.prev && started.current.id !== shown.id) progress.current = 0;

  useEffect(() => {
    onMorph?.(shown.prev ? `${shown.prev}>${shown.stage}` : null);
  }, [shown.prev, shown.stage, onMorph]);

  useFrame((state) => {
    if (!shown.prev || !spec) {
      progress.current = 1;
      return;
    }
    if (started.current.id !== shown.id) started.current = { id: shown.id, at: state.clock.elapsedTime };
    const p = (state.clock.elapsedTime - started.current.at) / (spec.seconds ?? MORPH_SECONDS);
    progress.current = p;
    if (p >= 1) {
      const id = shown.id;
      setShown((s) => (s.id === id && s.prev ? { ...s, prev: null } : s));
    }
  });

  const layers = [];
  if (shown.prev) {
    layers.push(
      <MorphLayer key={`layer-${shown.id - 1}`} role="out" spec={spec} progress={progress}>
        <StageScene stage={shown.prev} mass={mass} />
      </MorphLayer>,
    );
  }
  layers.push(
    <MorphLayer key={`layer-${shown.id}`} role="in" spec={shown.prev ? spec : null} progress={progress}>
      <StageScene stage={shown.stage} mass={mass} onPhase={(name) => onPhase?.({ stage: shown.stage, name })} />
    </MorphLayer>,
  );

  return (
    <group>
      {layers}
      {shown.prev && spec?.flash ? (
        <Flash
          key={`flash-${shown.id}`}
          progress={progress}
          at={spec.flash.at}
          colour={spec.flash.colour}
          size={spec.flash.size}
          length={spec.flash.length}
        />
      ) : null}
    </group>
  );
}
