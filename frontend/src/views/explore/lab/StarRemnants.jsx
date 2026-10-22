import { useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { DotContext, seeded } from './SceneKit';
import { FittedModels, useGasMaterial } from './ModelKit';
import { StarSurface } from './StarSurface';

/**
 * What a star leaves behind when it dies: a white dwarf, a pulsar, a black
 * hole. Each is drawn by shaders and animated the way the real thing behaves.
 *
 * - **White dwarf** - a hot, Earth-sized ball with nothing left to burn; it
 *   just glows, very slowly cooling.
 * - **Pulsar** - a neutron star spinning many times a second. Its magnetic
 *   field (drawn as dipole field lines, r = L sin^2 theta) is tilted from its
 *   spin axis, so the two radio beams along the magnetic poles sweep round
 *   like a lighthouse; each time one points at us the glow flashes. The spin
 *   here is slowed right down - the Crab pulsar turns about 30 times a second.
 * - **Black hole** - a black shadow, a thin bright photon ring, and an
 *   accretion disc that is hotter and faster near the hole (Kepler: angular
 *   speed falls as r^-1.5). The side of the disc turning towards us is
 *   brighter (relativistic beaming), and light from the far side of the disc
 *   is bent over and under the shadow into a halo, as in the Event Horizon
 *   Telescope images and the well-known simulations. Gas spirals in.
 *
 * Not to scale; the page says so.
 */

// ---------------------------------------------------------------------------
// White dwarf

export function WhiteDwarf() {
  return (
    <StarSurface
      radius={0.3}
      colour="#dfe9ff"
      cells={60}
      contrast={0.06}
      speed={0.05}
      brightness={2.2}
      glow={7}
      glowOpacity={0.55}
      segments={48}
    />
  );
}

// ---------------------------------------------------------------------------
// Pulsar

/** Points along one dipole field line, r = L sin^2(theta), in its own plane. */
function fieldLine(L, steps = 64) {
  const pts = [];
  // Start and end at the star's surface, r = 1 * radius scale handled outside.
  const theta0 = Math.asin(Math.min(1, Math.sqrt(1 / L)));
  for (let i = 0; i <= steps; i += 1) {
    const th = theta0 + (i / steps) * (Math.PI - 2 * theta0);
    const r = L * Math.sin(th) ** 2;
    pts.push(new THREE.Vector3(r * Math.sin(th), r * Math.cos(th), 0));
  }
  return new THREE.CatmullRomCurve3(pts);
}

const FIELD_SHELLS = [2.2, 3.4, 5];
const STAR_R = 0.34;

// A radio beam: brightest at the pole, fading along its length and at its
// edges, so it reads as light rather than a solid cone.
const BEAM_VERTEX = /* glsl */ `
varying float vAlong;
varying float vFacing;
void main() {
  vAlong = uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;
const BEAM_FRAGMENT = /* glsl */ `
uniform float uStrength;
uniform vec3 uColour;
varying float vAlong;
varying float vFacing;
void main() {
  float along = clamp(vAlong, 0.0, 1.0);
  float facing = clamp(vFacing, 0.0, 1.0);
  // No pow() here: pow(0, y) gave NaN on some GPUs and blacked out the bloom.
  float a = clamp(along * along * facing * uStrength, 0.0, 1.0);
  gl_FragColor = vec4(uColour * a, a);
  #include <colorspace_fragment>
}
`;
const FIELD_TURNS = 6;

export const CRAB_MODELS = [
  '/models/star-life/crab-disc.glb',
  '/models/star-life/crab-jet1.glb',
  '/models/star-life/crab-jet2.glb',
];
/**
 * The Crab files put the pulsar at their origin, with the jets running along
 * roughly (0.54, 0.56, 0.60); this turns that axis to point up, along the
 * pulsar's spin axis.
 */
const CRAB_TURN = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0.54, 0.56, 0.6).normalize(),
  new THREE.Vector3(0, 1, 0),
);

/**
 * The Crab Nebula's inner ring and jets, as Chandra sees them in X-rays and
 * NASA modelled them in 3D: the pulsar's wind of particles, flung out in its
 * equator as a ring and along its poles as jets. The ring turns, the jets
 * flicker.
 */
function CrabWind() {
  // Model units: the ring is ~130 across, the jets ~140 long.
  const ring = useGasMaterial({ mode: 'glow', from: '#e6f4ff', to: '#5f86ff', radial: true, range: [15, 70], intensity: 1.05, noiseScale: 0.07 });
  const jet = useGasMaterial({ mode: 'glow', from: '#f4fbff', to: '#8fb0ff', radial: true, range: [5, 140], intensity: 1.3, noiseScale: 0.09 });
  const spin = useRef(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Turning about the jet axis: the ring wheels round, the jets stay put.
    if (spin.current) spin.current.rotation.y = t * 0.15;
    jet.uniforms.uIntensity.value = 1.1 + 0.35 * Math.sin(t * 7) * Math.sin(t * 2.3);
  });
  return (
    <group ref={spin}>
      <group quaternion={CRAB_TURN}>
        <FittedModels urls={CRAB_MODELS} materials={[ring, jet, jet]} fit={6.5} centreAt={[0, 0, 0]} />
      </group>
    </group>
  );
}

export function Pulsar({ onPhase }) {
  const told = useRef(false);
  const spin = useRef(null);
  const glow = useRef(null);
  const beam = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERTEX,
        fragmentShader: BEAM_FRAGMENT,
        uniforms: { uStrength: { value: 0.5 }, uColour: { value: new THREE.Color('#a9e2ff') } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => beam.dispose(), [beam]);
  const camera = useThree((s) => s.camera);
  const dot = useContext(DotContext);
  const curves = useMemo(() => FIELD_SHELLS.map((L) => fieldLine(L)), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    if (!told.current) {
      told.current = true;
      onPhase?.('crab');
    }
    if (!spin.current) return;
    spin.current.rotation.y += Math.min(delta, 0.05) * 3.2;
    // The magnetic axis, in world space: tilted from the spin axis.
    axis.set(0, 1, 0).applyQuaternion(spin.current.getWorldQuaternion(new THREE.Quaternion()).multiply(TILT_Q));
    toCamera.copy(camera.position).normalize();
    const facing = Math.max(Math.abs(axis.dot(toCamera)), 0);
    // A pulse: the glow flares while a beam sweeps across us.
    const pulse = Math.max(0, (facing - 0.86) / 0.14) ** 2;
    if (glow.current) {
      glow.current.material.opacity = 0.35 + 0.65 * pulse;
      glow.current.scale.setScalar(1.6 + 2.2 * pulse);
    }
    const flicker = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 40);
    beam.uniforms.uStrength.value = (0.45 * flicker + 0.5 * pulse) * beam.opacity;
  });

  return (
    <group rotation={[0, 0, 0.2]}>
      <group ref={spin}>
        <group quaternion={TILT_Q}>
          <StarSurface radius={STAR_R} colour="#cfe3ff" cells={14} contrast={0.15} brightness={2.4} glow={0} segments={48} />
          {/* Field lines: loops from one magnetic pole round to the other. */}
          {curves.map((curve, s) =>
            Array.from({ length: FIELD_TURNS }, (_, k) => (
              <mesh key={`${s}-${k}`} rotation={[0, (k / FIELD_TURNS) * Math.PI * 2, 0]} scale={STAR_R}>
                <tubeGeometry args={[curve, 64, 0.025, 5, false]} />
                <meshBasicMaterial
                  color="#7fc8ff"
                  transparent
                  opacity={0.55 - s * 0.12}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            )),
          )}
          {/* The beams, along the magnetic poles. */}
          {[1, -1].map((side) => (
            <mesh key={side} position={[0, side * 2.9, 0]} rotation={[side > 0 ? Math.PI : 0, 0, 0]} material={beam}>
              <coneGeometry args={[0.7, 5.2, 48, 1, true]} />
            </mesh>
          ))}
        </group>
      </group>
      <sprite ref={glow} scale={1.6}>
        <spriteMaterial
          map={dot}
          color="#bfe0ff"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          userData={{ selfFade: true }}
        />
      </sprite>
      <PulsarWind />
      <CrabWind />
    </group>
  );
}

const TILT_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.55);

/** The wind of particles a young pulsar blows: a torus in its equator. */
function PulsarWind() {
  const dot = useContext(DotContext);
  const COUNT = 1800;
  const data = useMemo(() => {
    const rand = seeded(61);
    const pos = new Float32Array(COUNT * 3);
    const r0 = new Float32Array(COUNT);
    const a0 = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      r0[i] = 0.6 + rand() * 3.4;
      a0[i] = rand() * Math.PI * 2;
      pos[i * 3 + 1] = (rand() - 0.5) * 0.25 * r0[i];
    }
    return { pos, r0, a0 };
  }, []);
  const ref = useRef(null);
  useFrame((state) => {
    const { pos, r0, a0 } = data;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i += 1) {
      // Flowing outward, wrapping back in.
      const r = 0.6 + ((r0[i] - 0.6 + t * 0.35) % 3.4);
      const a = a0[i] + t * 0.3 / r;
      pos[i * 3] = r * Math.cos(a);
      pos[i * 3 + 2] = r * Math.sin(a);
    }
    if (ref.current) ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.09}
        map={dot}
        color="#8fb8ff"
        transparent
        opacity={0.45}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Black hole

const DISC_VERTEX = /* glsl */ `
varying vec2 vPolar;
varying vec3 vWorld;
varying vec3 vTangent;
void main() {
  vPolar = vec2(length(position.xy), atan(position.y, position.x));
  // Which way the gas here is moving, in world space.
  vTangent = normalize((modelMatrix * vec4(-sin(vPolar.y), cos(vPolar.y), 0.0, 0.0)).xyz);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

// Disc colour from radius and a swirl of noise carried round at Kepler speed.
// uLensed draws the bent image of the disc's far side (no beaming, dimmer).
const DISC_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform float uLensed;
uniform vec3 uCamera;
varying vec2 vPolar;
varying vec3 vWorld;
varying vec3 vTangent;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  float r = vPolar.x;
  float x = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  // Angular speed falls as r^-1.5.
  float omega = 1.6 * pow(uInner / r, 1.5);
  float a = vPolar.y + uTime * omega;
  // Noise sampled in a frame turning with the gas, so it streaks round the
  // hole instead of forming rings.
  vec2 p = vec2(cos(a), sin(a)) * r;
  float n = 0.5 * noise(p * 1.4) + 0.3 * noise(p * 3.7 + 7.0);
  n += 0.2 * noise(vec2(a * 5.0 + log(r) * 9.0, log(r) * 2.0));
  float streaks = 0.65 + 0.7 * n;

  // Hotter inside: white, then yellow, orange, deep red at the edge.
  vec3 c1 = vec3(1.0, 0.97, 0.9);
  vec3 c2 = vec3(1.0, 0.72, 0.32);
  vec3 c3 = vec3(0.85, 0.3, 0.08);
  vec3 c4 = vec3(0.35, 0.06, 0.02);
  // The bent image is redshifted and dimmer: colour it as if further out.
  float xc = uLensed > 0.5 ? 0.25 + 0.75 * x : x;
  vec3 col = xc < 0.25 ? mix(c1, c2, xc / 0.25) : xc < 0.6 ? mix(c2, c3, (xc - 0.25) / 0.35) : mix(c3, c4, (xc - 0.6) / 0.4);
  float glow = pow(max(1.0 - x, 0.001), 1.8) * 1.5 + 0.12;

  float beam = 1.0;
  if (uLensed < 0.5) {
    // Gas moving towards us looks brighter: relativistic beaming.
    float towards = dot(normalize(vTangent), normalize(uCamera - vWorld));
    beam = pow(1.0 + 0.55 * towards, 3.0);
  }

  float edge = smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.75, 1.0, x));
  float alpha = edge * clamp(streaks * glow * 0.6, 0.0, 1.0) * uOpacity;
  // The bent image is thin and dim: it hugs the shadow and fades outward.
  // Brightest over the top and under the bottom of the shadow, where the
  // bent image of the far side of the disc lies.
  float s = sin(vPolar.y);
  float lens = uLensed > 0.5 ? 0.5 * (1.0 - smoothstep(0.0, 0.5, x)) * (0.2 + 0.8 * s * s) : 1.0;
  gl_FragColor = vec4(col * glow * streaks * beam * lens, alpha * lens);
  #include <colorspace_fragment>
}
`;

function useDiscMaterial(lensed) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: DISC_VERTEX,
        fragmentShader: DISC_FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uInner: { value: 1.55 },
          uOuter: { value: 5.2 },
          uOpacity: { value: 1 },
          uLensed: { value: lensed ? 1 : 0 },
          uCamera: { value: new THREE.Vector3() },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [lensed],
  );
  useEffect(() => () => material.dispose(), [material]);
  return material;
}

export function BlackHole() {
  const disc = useDiscMaterial(false);
  const halo = useDiscMaterial(true);
  const camera = useThree((s) => s.camera);
  const billboard = useRef(null);
  const ring = useRef(null);
  const parent = useRef(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const m of [disc, halo]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uCamera.value.copy(camera.position);
      // Follow the morph's fade, which sets each material's opacity.
      m.uniforms.uOpacity.value = m.opacity;
    }
    // The lensed halo always faces the viewer, as the bent light does.
    if (billboard.current && parent.current) {
      const inverse = parent.current.getWorldQuaternion(new THREE.Quaternion()).invert();
      billboard.current.quaternion.copy(inverse.multiply(camera.quaternion));
    }
    if (ring.current) ring.current.material.opacity = (0.85 + 0.15 * Math.sin(t * 3)) * disc.opacity;
  });

  return (
    <group ref={parent} rotation={[0.32, 0, 0.08]}>
      {/* The shadow: nothing comes back out from inside the event horizon. */}
      <mesh>
        <sphereGeometry args={[1, 64, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* The accretion disc, in the hole's equator. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={disc}>
        <ringGeometry args={[1.55, 5.2, 160, 24]} />
      </mesh>
      <group ref={billboard}>
        {/* Light from the far side of the disc, bent round the shadow. */}
        <mesh material={halo} renderOrder={-1}>
          <ringGeometry args={[1.2, 2.4, 128, 8]} />
        </mesh>
        {/* The photon ring: light that has orbited the hole before escaping. */}
        <mesh ref={ring}>
          <ringGeometry args={[1.12, 1.19, 128, 1]} />
          <meshBasicMaterial
            color="#ffe2b0"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
            userData={{ selfFade: true }}
          />
        </mesh>
      </group>
      <InfallingGas />
    </group>
  );
}

/** Clumps of gas spiralling in through the disc and vanishing at the horizon. */
function InfallingGas() {
  const dot = useContext(DotContext);
  const COUNT = 600;
  const data = useMemo(() => {
    const rand = seeded(73);
    const phase = new Float32Array(COUNT);
    const a0 = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      phase[i] = rand();
      a0[i] = rand() * Math.PI * 2;
    }
    return { pos: new Float32Array(COUNT * 3), phase, a0 };
  }, []);
  const ref = useRef(null);
  useFrame((state) => {
    const { pos, phase, a0 } = data;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i += 1) {
      const life = (phase[i] + t * 0.06) % 1;
      const r = 5.6 - 4.4 * life ** 1.6;
      const a = a0[i] + 4 * Math.log(5.6 / r) + t * 1.6 * (1.55 / r) ** 1.5;
      pos[i * 3] = r * Math.cos(a);
      pos[i * 3 + 1] = (Math.sin(a0[i] * 7) * 0.04 * r) / 3;
      pos[i * 3 + 2] = r * Math.sin(a);
    }
    if (ref.current) ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={COUNT} array={data.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        map={dot}
        color="#ffcf8a"
        transparent
        opacity={0.6}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
