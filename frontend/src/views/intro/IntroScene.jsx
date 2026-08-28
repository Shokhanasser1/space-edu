import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX } from '@/solar/scene/shaders';
import { useSolarTextures } from '@/solar/textures';

/**
 * The intro's sky: the Sun at the origin, the Earth and Moon sixty units
 * out, and a ten-second camera flight in from the Sun's side — the Sun just
 * off the Earth's limb — to a three-quarter view of the lit face, after
 * which the camera sways gently for as long as the page is open.
 *
 * Deliberately small: a 4k Earth over a 2k first frame, 2k Moon and Sun
 * (1.6 MB together), no clouds, no post-processing, DPR capped at 2. The full solar system is a page of
 * its own; this is a doorstep. The atmosphere shader is borrowed from it and
 * assumes the Sun at the origin, which is why the Sun is at the origin.
 */

const EARTH_POS = new THREE.Vector3(0, 0, 60);
const EARTH_R = 6;
const MOON_R = 1.6;
const MOON_DIST = 17;
const FLIGHT_S = 10;
const END_OFFSET = new THREE.Vector3(-14, 5, -18);
const SWAY_R = Math.hypot(END_OFFSET.x, END_OFFSET.z);
const SWAY_CENTRE = Math.atan2(END_OFFSET.z, END_OFFSET.x);

// Best first, as the solar system's catalogue does: the 2k map is on screen
// within a second, the 4k one replaces it when it arrives. The 2k Earth is
// 167 KB and looks it; the 4k one (558 KB) is what the visitor keeps. No 8k
// here — a decoded 8k map is 134 MB of GPU memory, for a doorstep.
const TEXTURES = {
  earth: {
    map: ['/textures/4k_earth_daymap.webp', '/textures/2k_earth_daymap.webp'],
    night: ['/textures/4k_earth_nightmap.webp', '/textures/2k_earth_nightmap.webp'],
  },
  moon: { map: ['/textures/2k_moon.webp'] },
  sun: { map: ['/textures/2k_sun.webp'] },
};

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

function coronaTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.16, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 220, 150, 0.95)');
    g.addColorStop(0.3, 'rgba(255, 175, 70, 0.38)');
    g.addColorStop(1, 'rgba(255, 120, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Sun() {
  const textures = useSolarTextures(TEXTURES.sun);
  const corona = useMemo(coronaTexture, []);
  const hdr = useMemo(() => new THREE.Color(1.9, 1.5, 1.05), []);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[4, 48, 48]} />
        <meshBasicMaterial key={textures.map ? 'map' : 'flat'} map={textures.map || null} color={hdr} toneMapped={false} />
      </mesh>
      <sprite scale={[26, 26, 1]}>
        <spriteMaterial map={corona} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.9} toneMapped={false} />
      </sprite>
      <pointLight intensity={2.6} decay={0} distance={0} color="#fff6e5" />
    </group>
  );
}

function Moon() {
  const textures = useSolarTextures(TEXTURES.moon);
  const ref = useRef();
  const angle = useRef(2.3);
  useFrame((_, dt) => {
    angle.current += dt * 0.03;
    if (!ref.current) return;
    ref.current.position.set(Math.cos(angle.current) * MOON_DIST, 1.2, Math.sin(angle.current) * MOON_DIST);
    ref.current.rotation.y += dt * 0.03;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[MOON_R, 32, 32]} />
      <meshStandardMaterial key={textures.map ? 'map' : 'flat'} map={textures.map || null} color={textures.map ? '#ffffff' : '#b8b8b8'} roughness={1} metalness={0} />
    </mesh>
  );
}

function Earth() {
  const textures = useSolarTextures(TEXTURES.earth, { hiRes: true });
  const spin = useRef();
  const atmosphere = useMemo(
    () => ({ color: { value: new THREE.Color('#6fb3ff') }, strength: { value: 1.15 } }),
    [],
  );
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 0.04;
  });
  const hasMaps = Boolean(textures.map);
  return (
    <group position={EARTH_POS} rotation={[0, 0, THREE.MathUtils.degToRad(23.4)]}>
      <mesh ref={spin}>
        <sphereGeometry args={[EARTH_R, 64, 64]} />
        <meshStandardMaterial
          key={`${hasMaps}-${Boolean(textures.night)}`}
          map={textures.map || null}
          color={hasMaps ? '#ffffff' : '#3b8ad9'}
          emissiveMap={textures.night || null}
          emissive={textures.night ? '#ffffff' : '#000000'}
          emissiveIntensity={0.6}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[EARTH_R * 1.04, 48, 48]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={atmosphere}
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Moon />
    </group>
  );
}

/** The scripted flight, then the orbit. Nothing here is React state. */
function Rig() {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    // Every point keeps z below the Earth's, i.e. on the Sun's side of it:
    // the lit face is what the visitor sees, with the Sun off the left limb.
    EARTH_POS.clone().add(new THREE.Vector3(-44, 9, -40)),
    EARTH_POS.clone().add(new THREE.Vector3(-32, 8, -26)),
    EARTH_POS.clone().add(new THREE.Vector3(-20, 6, -14)),
    EARTH_POS.clone().add(END_OFFSET),
  ]), []);
  const firstLook = useMemo(() => EARTH_POS.clone().add(new THREE.Vector3(0, 2, -22)), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    elapsed.current += Math.min(dt, 0.05);
    const s = elapsed.current;
    if (s < FLIGHT_S) {
      const p = easeInOut(s / FLIGHT_S);
      curve.getPointAt(p, camera.position);
      target.lerpVectors(firstLook, EARTH_POS, Math.min(1, p * 1.5));
    } else {
      // Not a full orbit — that would carry the camera round to the night
      // side for half of every turn. A slow sway about the final view.
      const a = SWAY_CENTRE + 0.35 * Math.sin((s - FLIGHT_S) * 0.12);
      camera.position.set(EARTH_POS.x + Math.cos(a) * SWAY_R, EARTH_POS.y + 5, EARTH_POS.z + Math.sin(a) * SWAY_R);
      target.copy(EARTH_POS);
    }
    camera.lookAt(target);
    // Turn a little to the left, so the Earth sits right of centre and the
    // heading has the left third to itself.
    camera.rotateY(0.16 * Math.min(1, s / FLIGHT_S));
  });
  return null;
}

export default function IntroScene({ onReady }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: 42, near: 0.1, far: 3000, position: [-44, 9, 20] }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onReady?.();
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#05040a']} />
      <ambientLight intensity={0.06} />
      <Stars radius={420} depth={120} count={6000} factor={5} saturation={0} fade speed={0.15} />
      <Sun />
      <Earth />
      <Rig />
    </Canvas>
  );
}
