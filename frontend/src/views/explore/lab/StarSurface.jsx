import { useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { DotContext, seeded } from './SceneKit';

/**
 * A living star's surface, drawn by a shader rather than a model.
 *
 * A star is a ball, so no downloaded mesh adds anything to it; what makes one
 * look real is its skin, and that moves. The shader draws:
 *
 * - **Convection cells.** Hot gas wells up in bright cells and sinks in dark
 *   lanes between them (granulation on the Sun). The cells drift and change
 *   shape over time. `cells` sets how many: thousands of small ones on the
 *   Sun, only a handful of giant ones on a red supergiant - Betelgeuse's
 *   surface, imaged by ESO's VLTI and ALMA, shows a few huge bright patches.
 * - **Limb darkening.** Looking at the edge of a star you see cooler, higher
 *   gas, so the disc dims and reddens towards its rim.
 * - **Spots** (`spots`, for the Sun): cooler, darker patches in bands either
 *   side of the equator.
 * - **An uneven outline** (`wobble`) for supergiants, whose outer layers are so
 *   loosely held that the star is not a clean sphere.
 *
 * The cell pattern is Worley (cellular) noise and the large patches value
 * noise, both written here; no third-party shader code is included.
 */

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uWobble;
varying vec3 vDir;
varying vec3 vNormalV;
varying vec3 vViewDir;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

void main() {
  vDir = normalize(position);
  float bump = uWobble * (vnoise(vDir * 2.2 + vec3(uTime * 0.12)) - 0.5);
  vec3 p = position * (1.0 + bump);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCells;
uniform float uContrast;
uniform float uSpeed;
uniform float uSpots;
uniform float uBrightness;
uniform float uOpacity;
uniform float uWarp;
uniform float uSoft;
uniform float uFine;
uniform vec3 uColour;
varying vec3 vDir;
varying vec3 vNormalV;
varying vec3 vViewDir;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// Distance to the nearest and second-nearest moving cell centre.
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(i + g);
        o = 0.5 + 0.42 * sin(uTime * uSpeed + 6.2831 * o);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return vec2(sqrt(d1), sqrt(d2));
}

void main() {
  // Warp the cell pattern so the cells are irregular, as real ones are.
  vec3 warp = vec3(fbm(vDir * 1.7 + 1.3), fbm(vDir * 1.7 + 5.1), fbm(vDir * 1.7 + 9.7)) - 0.5;
  vec3 p = vDir * uCells + warp * uWarp;
  vec2 w = worley(p);
  // Bright in the middle of a cell, dark in the lanes between cells.
  float cell = smoothstep(0.0, uSoft, w.y - w.x);
  float fine = 1.0;
  if (uFine > 0.0) {
    vec2 w2 = worley(p * 3.1 + 17.0);
    fine = mix(1.0, 0.72 + 0.28 * smoothstep(0.0, 0.5, w2.y - w2.x), uFine);
  }
  float patches = fbm(vDir * 2.6 + vec3(0.0, uTime * 0.015, 0.0));
  // Kept off zero: pow(0, y) is undefined in GLSL and some GPUs return NaN,
  // which the bloom pass then smears over the whole picture.
  float mu = clamp(dot(normalize(vNormalV), normalize(vViewDir)), 0.001, 1.0);
  float limb = 0.16 + 0.84 * pow(mu, 0.7);

  float lat = abs(vDir.y);
  float spot = uSpots * smoothstep(0.66, 0.72, fbm(vDir * 5.0 + 3.7)) * smoothstep(0.6, 0.25, lat) * smoothstep(0.05, 0.12, lat);

  float heat = mix(1.0 - uContrast, 1.0, cell) * fine;
  heat *= 0.75 + 0.5 * patches;
  heat *= 1.0 - 0.85 * spot;

  // Hotter gas is yellower, not pinker: mix towards a warm white.
  vec3 hot = mix(uColour, vec3(1.0, 0.78, 0.36), 0.45);
  vec3 cool = uColour * vec3(0.62, 0.34, 0.2);
  vec3 col = mix(cool, hot, clamp(heat, 0.0, 1.2));
  // The rim is cooler and redder as well as dimmer.
  col *= mix(vec3(1.0, 0.6, 0.38), vec3(1.0), pow(mu, 0.45));
  col *= limb * uBrightness;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}
`;

export function StarSurface({
  radius,
  colour,
  cells = 30,
  contrast = 0.5,
  speed = 0.3,
  spots = 0,
  wobble = 0,
  warp = 0.8,
  soft = 0.45,
  fine = 0,
  brightness = 1.2,
  glow = 3,
  glowOpacity = 0.5,
  glowColour,
  segments = 96,
}) {
  const dot = useContext(DotContext);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uTime: { value: 0 },
          uCells: { value: 30 },
          uContrast: { value: 0.5 },
          uSpeed: { value: 0.3 },
          uSpots: { value: 0 },
          uWobble: { value: 0 },
          uBrightness: { value: 1.8 },
          uOpacity: { value: 1 },
          uWarp: { value: 0.8 },
          uSoft: { value: 0.45 },
          uFine: { value: 0 },
          uColour: { value: new THREE.Color('#ffffff') },
        },
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const u = material.uniforms;
  u.uCells.value = cells;
  u.uContrast.value = contrast;
  u.uSpeed.value = speed;
  u.uSpots.value = spots;
  u.uWobble.value = wobble;
  u.uBrightness.value = brightness;
  u.uWarp.value = warp;
  u.uSoft.value = soft;
  u.uFine.value = fine;
  u.uColour.value.set(colour);

  const glowRef = useRef(null);
  useFrame((state) => {
    u.uTime.value = state.clock.elapsedTime;
    // The morph fades a stage by its materials' opacity; follow it.
    u.uOpacity.value = material.opacity;
    material.transparent = material.opacity < 0.999;
    // While fading out, let what grows inside it (a nebula, the next stage)
    // show through instead of hiding behind its depth.
    material.depthWrite = !material.transparent;
    if (glowRef.current) glowRef.current.material.opacity = glowOpacity * material.opacity;
  });

  return (
    <group>
      <mesh material={material}>
        <sphereGeometry args={[radius, segments, segments / 2]} />
      </mesh>
      {glow > 0 ? (
        <sprite ref={glowRef} scale={[radius * glow, radius * glow, 1]}>
          <spriteMaterial
            map={dot}
            color={glowColour ?? colour}
            transparent
            opacity={glowOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            userData={{ selfFade: true }}
          />
        </sprite>
      ) : null}
    </group>
  );
}

// ---------------------------------------------------------------------------
// What happens just above a star's surface

/**
 * Prominences: loops of hot gas held up by the magnetic field, rising from
 * the surface and arching back down. Each is a few glowing strands that
 * swell and fade over a few seconds.
 */
export function Prominences({ radius, count = 5, colour = '#ff8a3c', seed = 9 }) {
  const loops = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
      const dir = new THREE.Vector3(rand() * 2 - 1, (rand() * 2 - 1) * 0.6, rand() * 2 - 1).normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const twist = rand() * Math.PI;
      const width = radius * (0.12 + rand() * 0.14);
      const height = radius * (0.12 + rand() * 0.22);
      const strands = [0, 1, 2].map((k) => {
        const pts = [];
        for (let i = 0; i <= 24; i += 1) {
          const u = i / 24;
          const x = width * Math.cos(Math.PI * u);
          const y = radius * 0.97 + height * Math.sin(Math.PI * u) * (1 + 0.12 * (k - 1));
          pts.push(new THREE.Vector3(x, y, (k - 1) * width * 0.12));
        }
        return new THREE.CatmullRomCurve3(pts);
      });
      return { quaternion, twist, strands, phase: rand() * Math.PI * 2, period: 4 + rand() * 4 };
    });
  }, [radius, count, seed]);
  const groups = useRef([]);
  const mats = useRef([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    loops.forEach((loop, i) => {
      const life = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / loop.period + loop.phase);
      const g = groups.current[i];
      if (g) g.scale.set(1, 0.55 + 0.45 * life, 1);
      for (let k = 0; k < 3; k += 1) {
        const m = mats.current[i * 3 + k];
        if (m) m.opacity = (0.25 + 0.55 * life) * (k === 1 ? 1 : 0.6);
      }
    });
  });

  return (
    <group>
      {loops.map((loop, i) => (
        <group key={i} quaternion={loop.quaternion}>
          <group rotation={[0, loop.twist, 0]}>
            <group
              ref={(g) => {
                groups.current[i] = g;
              }}
            >
              {loop.strands.map((curve, k) => (
                <mesh key={k}>
                  <tubeGeometry args={[curve, 32, radius * (k === 1 ? 0.012 : 0.007), 5, false]} />
                  <meshBasicMaterial
                    ref={(m) => {
                      mats.current[i * 3 + k] = m;
                    }}
                    color={colour}
                    transparent
                    opacity={0.5}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * Gas and dust leaving a cool giant: specks lifted off the surface that
 * drift outward and fade. `lopsided` pushes most of it out of one side, as
 * the dust cloud that dimmed Betelgeuse in 2019-2020 was.
 */
export function MassLoss({ radius, count = 900, colour = '#ff9a6a', lopsided = 0, speed = 0.25, seed = 13 }) {
  const dot = useContext(DotContext);
  const data = useMemo(() => {
    const rand = seeded(seed);
    const dirs = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const bias = new THREE.Vector3(1, 0.3, 0.4).normalize();
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i += 1) {
      v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      v.lerp(bias, lopsided * rand()).normalize();
      dirs[i * 3] = v.x;
      dirs[i * 3 + 1] = v.y;
      dirs[i * 3 + 2] = v.z;
      phase[i] = rand();
    }
    return { dirs, phase, pos: new Float32Array(count * 3), colours: new Float32Array(count * 3) };
  }, [count, lopsided, seed]);
  const ref = useRef(null);
  const base = useMemo(() => new THREE.Color(colour), [colour]);

  useFrame((state) => {
    const { dirs, phase, pos, colours } = data;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i += 1) {
      const life = (phase[i] + t * speed * 0.1) % 1;
      const r = radius * (1.02 + 1.4 * life);
      pos[i * 3] = dirs[i * 3] * r;
      pos[i * 3 + 1] = dirs[i * 3 + 1] * r;
      pos[i * 3 + 2] = dirs[i * 3 + 2] * r;
      const fade = (1 - life) * Math.min(1, life * 8);
      colours[i * 3] = base.r * fade;
      colours[i * 3 + 1] = base.g * fade;
      colours[i * 3 + 2] = base.b * fade;
    }
    if (ref.current) {
      ref.current.geometry.attributes.position.needsUpdate = true;
      ref.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={data.pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={data.colours} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={radius * 0.07}
        map={dot}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** Turns slowly, and - for giants - breathes in and out. */
export function Turning({ speed = 0.05, pulse = 0, period = 7, children }) {
  const ref = useRef(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += Math.min(delta, 0.05) * speed;
    if (pulse) ref.current.scale.setScalar(1 + pulse * Math.sin((state.clock.elapsedTime * Math.PI * 2) / period));
  });
  return <group ref={ref}>{children}</group>;
}
