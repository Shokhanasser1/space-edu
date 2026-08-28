import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useTextures } from '@/hooks/useTextures';
import { HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';

/**
 * Planetary Processes: what an event does to a planet, not what colour it is.
 *
 * Split out of `SpaceLabView.jsx`, which had reached 743 lines with three
 * modules inside it. Two things were fixed on the way out:
 *
 * 1. **The planet used to change identity.** Selecting any event replaced the
 *    textured Earth with an untextured grey sphere, so "meteor shower" did not
 *    show a meteor shower hitting the Earth — it showed a different, poorer
 *    planet with some meteors near it. The textured planet is now the one
 *    constant, and every event is an overlay on top of it.
 * 2. **The meteors cost about a hundred materials.** Each one was a group of
 *    two meshes with materials declared inline in JSX, rebuilt from scratch
 *    whenever the intensity slider moved. There are two materials and two
 *    geometries now, shared by every meteor and disposed together.
 */

const GLOBE_TEXTURES = [
  '/textures/earth_color_2048.jpg',
  '/textures/earth_topology_2048.jpg',
  '/textures/earth_water_1600.png',
];

/** What an Earth looks like when its texture never arrived. */
const UNTEXTURED_EARTH = '#2a5d8f';

/** The planet. One sphere, textured, whatever the weather is doing to it. */
function PlanetBody({ radius = 2 }) {
  const [colorMap, bumpMap, specularMap] = useTextures(GLOBE_TEXTURES);
  const earthRef = useRef(null);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.03;
  });

  return (
    <group>
      <mesh ref={earthRef} castShadow receiveShadow>
        <sphereGeometry args={[radius, 64, 64]} />
        {/* The `key` is load-bearing, for the same reason it is on the Live
            page's globe: `useTextures` resolves after the first render, and
            three.js compiles a material's shader once. Without a remount the
            texture arrives and is never sampled. */}
        <meshPhongMaterial
          key={colorMap ? 'planet-textured' : 'planet-plain'}
          map={colorMap}
          color={colorMap ? '#ffffff' : UNTEXTURED_EARTH}
          bumpMap={bumpMap}
          bumpScale={0.02}
          specularMap={specularMap}
          specular={new THREE.Color('grey')}
          shininess={35}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius + 0.05, 48, 48]} />
        <meshPhongMaterial
          color="#4ca6ff"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

/**
 * A meteor shower falling onto the planet, sharing two materials between
 * every meteor rather than owning two each.
 */
function MeteorShower({ intensity, radius = 2 }) {
  const count = Math.max(4, Math.floor(intensity / 2));
  const groupRef = useRef(null);

  const meteors = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        speed: 0.05 + Math.random() * 0.12,
        start: radius * 2.6 + Math.random() * 3,
        offset: Math.random() * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.9,
      })),
    [count, radius],
  );

  const gpu = useMemo(() => {
    const head = new THREE.MeshStandardMaterial({
      color: '#ffaa00',
      emissive: new THREE.Color('#ff5500'),
      emissiveIntensity: 2,
    });
    const trail = new THREE.MeshBasicMaterial({
      color: '#ff5500',
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const headGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const trailGeometry = new THREE.CylinderGeometry(0.01, 0.05, 0.5, 6);
    return { head, trail, headGeometry, trailGeometry };
  }, []);

  useEffect(
    () => () => {
      for (const resource of Object.values(gpu)) resource.dispose();
    },
    [gpu],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.children.forEach((child, i) => {
      const meteor = meteors[i];
      if (!meteor) return;
      child.position.y -= meteor.speed * delta * 60;
      child.position.x -= meteor.speed * 0.5 * delta * 60;
      // Burn up at the surface rather than passing through the planet.
      if (child.position.y < -radius) {
        child.position.y = meteor.start;
        child.position.x = Math.cos(meteor.offset) * radius * 2;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {meteors.map((meteor, i) => (
        <group
          key={i}
          position={[
            Math.cos(meteor.offset) * radius * 2,
            meteor.start - i * 0.35,
            Math.sin(meteor.offset) * radius * 1.4,
          ]}
        >
          <mesh geometry={gpu.headGeometry} material={gpu.head} />
          <mesh
            geometry={gpu.trailGeometry}
            material={gpu.trail}
            position={[0.1, 0.2, 0]}
            rotation={[0, 0, Math.PI / 4 + meteor.tilt]}
          />
        </group>
      ))}
    </group>
  );
}

/** Volcanic haze and dust are shells over the planet, not a repaint of it. */
function EventOverlay({ event, intensity, radius = 2 }) {
  if (event === 'volcano') {
    return (
      <group>
        <mesh>
          <sphereGeometry args={[radius * 1.012, 48, 48]} />
          <meshBasicMaterial
            color="#ff3300"
            transparent
            opacity={intensity / 320}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[radius * 1.05, 48, 48]} />
          <meshBasicMaterial
            color="#4a3a33"
            transparent
            opacity={intensity / 420}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  if (event === 'dust') {
    return (
      <mesh>
        <sphereGeometry args={[radius * 1.04, 48, 48]} />
        <meshStandardMaterial
          color="#e77d11"
          transparent
          opacity={intensity / 260}
          roughness={1}
          depthWrite={false}
        />
      </mesh>
    );
  }

  return null;
}

const EVENTS = [
  { id: 'none', labelKey: 'normalConditions', tone: 'border-neon-blue bg-neon-blue/20' },
  { id: 'meteor', labelKey: 'meteorShower', tone: 'border-red-500 bg-red-500/20' },
  { id: 'volcano', labelKey: 'volcanicEruption', tone: 'border-orange-500 bg-orange-500/20' },
  { id: 'dust', labelKey: 'dustStorm', tone: 'border-yellow-500 bg-yellow-500/20' },
];

export function PlanetaryProcessesLab() {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [activeEvent, setActiveEvent] = useState('none');
  const [intensity, setIntensity] = useState(50);
  const [timeOfDay, setTimeOfDay] = useState(12);

  useEffect(() => {
    if (activeEvent !== 'none') trackEvent('lab_planetary_processes');
  }, [activeEvent, trackEvent]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Globe2 className="text-green-400" /> {t('lab', 'environment')}
          </h3>

          <div className="space-y-3 mb-6">
            {EVENTS.map((event) => (
              <button
                key={event.id}
                onClick={() => setActiveEvent(event.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  activeEvent === event.id ? event.tone : 'border-white/10 hover:bg-white/5'
                }`}
              >
                {t('lab', event.labelKey)}
              </button>
            ))}
          </div>

          <div className="space-y-2 mb-6">
            <label className="text-sm text-gray-400" htmlFor="lab-intensity">
              {t('lab', 'eventIntensity')}
            </label>
            <input
              id="lab-intensity"
              type="range"
              min="10"
              max="100"
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value, 10))}
              className="w-full accent-neon-blue"
              disabled={activeEvent === 'none'}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{t('lab', 'timeOfDay')}</span>
              <span>{timeOfDay}:00</span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(parseInt(e.target.value, 10))}
              className="w-full accent-neon-blue"
              aria-label={t('lab', 'timeOfDay')}
            />
          </div>
        </div>
      </div>

      <LabViewport hint={`${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')}`}>
        <Canvas
          shadows
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 6], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.05} />
          {/* Noon used to be midnight. The angle was `timeOfDay / 24`, so at the
              default 12:00 the sun sat at z = -10, directly behind the planet
              from a camera at z = +6, and the module opened on a flat black
              disc - the first thing anybody saw in it. Offsetting by 12 puts
              the sun on the camera's side at noon and behind at midnight. */}
          <directionalLight
            position={[
              Math.sin(((timeOfDay - 12) / 24) * Math.PI * 2) * 10,
              3,
              Math.cos(((timeOfDay - 12) / 24) * Math.PI * 2) * 10,
            ]}
            intensity={2}
            castShadow
          />
          <Stars radius={100} depth={50} count={4000} factor={4} saturation={0} fade speed={1} />

          <Suspense fallback={null}>
            <HologramStage
              height={4.6}
              radius={2.2}
              accent={HOLO.accent}
              spin={0}
              float={false}
              plinth={false}
              lighting={false}
            >
              <PlanetBody radius={2} />
              <EventOverlay event={activeEvent} intensity={intensity} radius={2} />
            </HologramStage>
          </Suspense>

          {activeEvent === 'meteor' && <MeteorShower intensity={intensity} radius={2} />}

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            {activeEvent === 'dust' && <Noise opacity={intensity / 320} />}
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}
