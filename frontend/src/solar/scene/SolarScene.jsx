import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { ToneMappingMode } from 'postprocessing';
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { BODIES, MOONS } from '../catalog';
import { advanceClock, simClock, useSolarStore } from '../clock';
import { SceneBridge } from './bridge';
import CameraRig, { HOME_POSITION } from './CameraRig';
import MoonBody from './MoonBody';
import OrbitLine from './OrbitLine';
import Planet from './Planet';
import Satellites from './Satellites';
import SkyDome from './SkyDome';
import SmallBodies from './SmallBodies';
import Spacecraft from './Spacecraft';
import StarField from './StarField';
import Sun from './Sun';

/**
 * The scene graph and the render settings that make it hold 60 fps on an
 * integrated GPU:
 *
 * - `dpr` capped at 1.5: the bloom pass is per-pixel and retina doubles them.
 * - MSAA on the composer (`multisampling`) instead of no anti-aliasing.
 * - No shadow maps: a 4096² point-light shadow was six renders of the whole
 *   scene per frame for shadows too small to see; Saturn's ring shadow is done
 *   analytically in the ring shader.
 * - Logarithmic depth: the camera can be 0.005 units from Ceres and 5 000
 *   from the Sun in the same session without z-fighting.
 * - Bloom threshold 1.0: only the HDR Sun blooms, not every bright planet.
 */

/**
 * With the composer the renderer must stay linear and the ToneMapping pass
 * does it once at the end; without it (low quality) the renderer tone-maps
 * the HDR Sun itself, or it would clip to a white disc.
 */
function RendererToneMapping({ composer }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = composer ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }, [gl, composer]);
  return null;
}

function ClockDriver() {
  const acc = useRef(0);
  const tick = useSolarStore((s) => s.tick);
  useFrame((_, dt) => {
    const edge = advanceClock(Math.min(dt, 0.25));
    acc.current += dt;
    if (acc.current > 0.1 || edge) {
      acc.current = 0;
      tick(simClock.ms, edge);
    }
  }, -3);
  return null;
}

export default function SolarScene({ onSelect, onSelectSatellite }) {
  const controlsRef = useRef();
  const selectedId = useSolarStore((s) => s.selectedId);
  const layers = useSolarStore((s) => s.layers);
  const quality = useSolarStore((s) => s.quality);
  const setQuality = useSolarStore((s) => s.setQuality);
  const centreMs = useMemo(() => simClock.ms, []);
  const high = quality === 'high';

  const sun = BODIES[0];
  const planets = useMemo(() => BODIES.filter((b) => b.kind !== 'star'), []);
  const bodyById = useMemo(() => new Map(BODIES.map((b) => [b.id, b])), []);

  return (
    <Canvas
      dpr={high ? [1, 1.5] : 1}
      camera={{ position: HOME_POSITION.toArray(), fov: 45, near: 0.002, far: 60000 }}
      gl={{ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <color attach="background" args={['#02030a']} />
      <ambientLight intensity={0.035} />
      <ClockDriver />
      <RendererToneMapping composer={high} />
      {/* A few seconds under 50 fps drops to the light preset; it climbs back if the GPU copes. */}
      <PerformanceMonitor flipflops={2} onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} onFallback={() => setQuality('low')} />

      <SkyDome visible={layers.stars} />
      <StarField visible={layers.stars} />
      <Sun entry={sun} onSelect={onSelect} />
      {planets.map((entry) => (
        <Planet key={entry.id} entry={entry} onSelect={onSelect} selected={selectedId === entry.id} />
      ))}
      {MOONS.map((moon) => (
        <MoonBody key={moon.id} entry={moon} parent={bodyById.get(moon.parent)} onSelect={onSelect} selected={selectedId === moon.id} />
      ))}
      {layers.orbits && planets.map((entry) => (
        <OrbitLine key={`orbit-${entry.id}`} entry={entry} centreMs={centreMs} color={entry.color} selected={selectedId === entry.id} />
      ))}
      <SmallBodies set="mainBelt" color="#a89e90" visible={layers.asteroids} />
      <SmallBodies set="kuiper" color="#8fa3c4" visible={layers.asteroids} />
      <Satellites earth={bodyById.get('earth')} enabled={layers.satellites} onSelect={onSelectSatellite} />
      <Spacecraft enabled={layers.spacecraft} onSelect={onSelect} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        zoomToCursor={!selectedId}
        zoomSpeed={1.1}
        rotateSpeed={0.65}
        panSpeed={0.6}
        enablePan={!selectedId}
        minDistance={0.5}
        maxDistance={9000}
      />
      <CameraRig controlsRef={controlsRef} />
      <SceneBridge />

      {high && (
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={0.9} radius={0.55} />
          <Vignette eskil={false} offset={0.18} darkness={0.65} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
