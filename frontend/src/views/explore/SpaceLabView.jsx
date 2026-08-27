import { useState, useRef, useMemo, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Flame, Globe2, Sparkles, Satellite } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useTextures } from '@/hooks/useTextures';
import { ApolloHologramModule } from './lab/ApolloModule';
import { ApolloLaunchSimulator } from './lab/LaunchModule';
import {
  HOLO,
  HologramStage,
  ReleaseContextOnUnmount,
} from './lab/Hologram';
import { Spacecraft } from './lab/Spacecraft';

/*
 * Eight textures, served from this site.
 *
 * Until 24 August 2026 these were fetched from `unpkg.com` and
 * `raw.githubusercontent.com` at runtime. Neither is an asset host: GitHub
 * rate-limits raw file access and does not support it for production traffic,
 * so the page failed on exactly the day a whole class opened it at once, and a
 * school network that blocks either host broke it every day. They are in
 * `public/textures/` now — see `public/textures/ATTRIBUTION.md` for where each
 * one came from and what was done to it.
 *
 * `useTextures` stays regardless: it returns null for whatever did not load,
 * and the materials fall back to a plain colour. A local path can still be
 * wrong, and `useLoader` would throw the whole view away if it were.
 */
const GLOBE_TEXTURES = [
  '/textures/earth_color_2048.jpg',
  '/textures/earth_topology_2048.jpg',
  '/textures/earth_water_1600.png',
];

const TOPOLOGY_TEXTURE = ['/textures/earth_topology_2048.jpg'];

const PLANET_TEXTURES = [
  '/textures/earth_atmos_2048.jpg',
  '/textures/earth_normal_2048.jpg',
  '/textures/earth_specular_2048.jpg',
  '/textures/earth_lights_2048.png',
  '/textures/earth_clouds_1024.png',
];

/** What an Earth looks like when its texture never arrived. */
const UNTEXTURED_EARTH = '#2a5d8f';

// --- Realistic Earth Component ---
const RealisticEarth = ({ radius = 5, position = [0, 0, 0] }) => {
  const [colorMap, bumpMap, specularMap] = useTextures(GLOBE_TEXTURES);

  const earthRef = useRef(null);
  useFrame(() => {
    if (earthRef.current) earthRef.current.rotation.y += 0.0005;
  });

  return (
    <group position={new THREE.Vector3(...position)}>
      <mesh ref={earthRef} receiveShadow>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshPhongMaterial
          map={colorMap}
          color={colorMap ? undefined : UNTEXTURED_EARTH}
          bumpMap={bumpMap}
          bumpScale={0.02}
          specularMap={specularMap}
          specular={new THREE.Color('grey')}
          shininess={35}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius + 0.05, 64, 64]} />
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
};

// --- Sub-modules ---

const MeteorShower = ({ intensity }) => {
  const meteors = useMemo(() => {
    return Array.from({ length: Math.floor(intensity / 2) }).map(() => ({
      position: new THREE.Vector3((Math.random() - 0.5) * 10, 5 + Math.random() * 5, (Math.random() - 0.5) * 10),
      speed: 0.1 + Math.random() * 0.2,
      impacted: false
    }));
  }, [intensity]);

  const groupRef = useRef(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        child.position.y -= meteors[i].speed;
        child.position.x -= meteors[i].speed * 0.5;

        // Impact effect (scale up slightly before reset)
        if (child.position.y < -2 && child.position.y > -2.2) {
          child.scale.setScalar(2);
        } else {
          child.scale.setScalar(1);
        }

        if (child.position.y < -3) {
          child.position.y = 5 + Math.random() * 5;
          child.position.x = (Math.random() - 0.5) * 10;
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {meteors.map((m, i) => (
        <group key={i} position={m.position}>
          <mesh>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color="#ffaa00" emissive="#ff5500" emissiveIntensity={2} />
          </mesh>
          {/* Trail */}
          <mesh position={[0.1, 0.2, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.01, 0.05, 0.5]} />
            <meshBasicMaterial color="#ff5500" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const PlanetaryProcessesLab = () => {
  const { t, i18n } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [activeEvent, setActiveEvent] = useState('none');
  const [intensity, setIntensity] = useState(50);
  const [timeOfDay, setTimeOfDay] = useState(12);

  useEffect(() => {
    if (activeEvent !== 'none') trackEvent('lab_planetary_processes');
  }, [activeEvent, trackEvent]);

  const [bumpMap] = useTextures(TOPOLOGY_TEXTURE);

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe2 className="text-green-400" /> {t('lab', 'environment')}</h3>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => setActiveEvent('none')}
              className={`w-full text-left p-3 rounded-xl border transition-all ${activeEvent === 'none' ? 'border-neon-blue bg-neon-blue/20' : 'border-white/10 hover:bg-white/5'}`}
            >
              {t('lab', 'normalConditions')}
            </button>
            <button
              onClick={() => setActiveEvent('meteor')}
              className={`w-full text-left p-3 rounded-xl border transition-all ${activeEvent === 'meteor' ? 'border-red-500 bg-red-500/20' : 'border-white/10 hover:bg-white/5'}`}
            >
              {t('lab', 'meteorShower')}
            </button>
            <button
              onClick={() => setActiveEvent('volcano')}
              className={`w-full text-left p-3 rounded-xl border transition-all ${activeEvent === 'volcano' ? 'border-orange-500 bg-orange-500/20' : 'border-white/10 hover:bg-white/5'}`}
            >
              {t('lab', 'volcanicEruption')}
            </button>
            <button
              onClick={() => setActiveEvent('dust')}
              className={`w-full text-left p-3 rounded-xl border transition-all ${activeEvent === 'dust' ? 'border-yellow-500 bg-yellow-500/20' : 'border-white/10 hover:bg-white/5'}`}
            >
              {t('lab', 'dustStorm')}
            </button>
          </div>

          <div className="space-y-2 mb-6">
            <label className="text-sm text-gray-400">{t('lab', 'eventIntensity')}</label>
            <input
              type="range"
              min="10"
              max="100"
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
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
              onChange={(e) => setTimeOfDay(parseInt(e.target.value))}
              className="w-full accent-neon-blue"
            />
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas shadows camera={{ position: [0, 0, 6], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
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
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

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
            {activeEvent === 'none' ? (
              <RealisticEarth radius={2} position={[0, 0, 0]} />
            ) : (
              <group>
                {/* Textured Planet */}
                <mesh castShadow receiveShadow>
                  <sphereGeometry args={[2, 64, 64]} />
                  <meshStandardMaterial
                    color={activeEvent === 'dust' ? '#c1440e' : activeEvent === 'volcano' ? '#2a1511' : '#555555'}
                    bumpMap={bumpMap}
                    bumpScale={activeEvent === 'volcano' ? 0.05 : 0.02}
                    roughness={0.9}
                    metalness={0.1}
                  />
                </mesh>

                {/* Atmosphere */}
                <mesh>
                  <sphereGeometry args={[2.02, 64, 64]} />
                  <meshStandardMaterial
                    color={activeEvent === 'dust' ? '#e77d11' : '#ffffff'}
                    transparent
                    opacity={activeEvent === 'dust' ? intensity / 150 : 0.1}
                    blending={THREE.AdditiveBlending}
                  />
                </mesh>
              </group>
            )}
            </HologramStage>
          </Suspense>

          {/* Meteor Shower */}
          {activeEvent === 'meteor' && <MeteorShower intensity={intensity} />}

          {/* Volcano Glow */}
          {activeEvent === 'volcano' && (
            <mesh>
              <sphereGeometry args={[2.05, 64, 64]} />
              <meshBasicMaterial color="#ff3300" transparent opacity={intensity / 200} blending={THREE.AdditiveBlending} />
            </mesh>
          )}

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.5} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
            {activeEvent === 'dust' && <Noise opacity={intensity / 200} />}
          </EffectComposer>
        </Canvas>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')}
        </div>
      </div>
    </div>
  );
};

const ParticleSystem = ({ count, color, size, radius }) => {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count, radius]);

  const pointsRef = useRef(null);
  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001;
      pointsRef.current.rotation.z += 0.0005;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={0.6} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
    </points>
  );
};

const UniverseChangesSimulator = () => {
  const { t, i18n } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [stage, setStage] = useState('nebula');

  useEffect(() => {
    trackEvent('lab_universe_evolution_' + stage);
  }, [stage, trackEvent]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Sparkles className="text-neon-purple" /> {t('lab', 'stellarEvolution')}</h3>

          <div className="relative border-l-2 border-space-700 ml-3 space-y-8 py-4">
            {[
              { id: 'nebula', name: t('lab', 'stellarNebula'), desc: t('lab', 'stellarNebulaDesc') },
              { id: 'star', name: t('lab', 'mainSequenceStar'), desc: t('lab', 'mainSequenceStarDesc') },
              { id: 'supernova', name: t('lab', 'supernova'), desc: t('lab', 'supernovaDesc') },
              { id: 'blackhole', name: t('lab', 'blackHole'), desc: t('lab', 'blackHoleDesc') }
            ].map((s, idx) => (
              <div key={s.id} className="relative pl-6">
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-space-900 ${stage === s.id ? 'bg-neon-purple scale-125' : 'bg-space-600'} transition-all`} />
                <button
                  onClick={() => setStage(s.id)}
                  className={`text-left transition-colors ${stage === s.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  <div className="font-bold">{s.name}</div>
                  {stage === s.id && <div className="text-sm text-gray-400 mt-1">{s.desc}</div>}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas camera={{ position: [0, 0, 12], fov: 45 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.05} />
          <Stars radius={100} depth={50} count={10000} factor={4} saturation={0.5} fade speed={1} />

          <HologramStage
            height={9}
            radius={4.4}
            accent={HOLO.accent}
            spin={0}
            float={false}
            plinth={false}
            lighting={false}
          >
          {stage === 'nebula' && (
            <group>
              <ParticleSystem count={10000} color="#b026ff" size={0.05} radius={5} />
              <ParticleSystem count={5000} color="#00f0ff" size={0.08} radius={3} />
              <ParticleSystem count={2000} color="#ff00aa" size={0.1} radius={1.5} />
            </group>
          )}

          {stage === 'star' && (
            <mesh>
              <sphereGeometry args={[1.5, 64, 64]} />
              <meshStandardMaterial color="#ffcc00" emissive="#ffaa00" emissiveIntensity={4} toneMapped={false} />
              <pointLight intensity={5} distance={100} color="#ffcc00" />
            </mesh>
          )}

          {stage === 'supernova' && (
            <group>
              <ParticleSystem count={20000} color="#00f0ff" size={0.03} radius={8} />
              <ParticleSystem count={10000} color="#ffffff" size={0.05} radius={4} />
              <mesh>
                <sphereGeometry args={[2, 64, 64]} />
                <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={10} toneMapped={false} />
                <pointLight intensity={10} distance={200} color="#00f0ff" />
              </mesh>
            </group>
          )}

          {stage === 'blackhole' && (
            <group>
              {/* Event Horizon */}
              <mesh>
                <sphereGeometry args={[1, 64, 64]} />
                <meshBasicMaterial color="#000000" />
              </mesh>
              {/* Accretion Disk Particles */}
              <group rotation={[Math.PI / 2.2, 0, 0]}>
                <ParticleSystem count={8000} color="#ffaa00" size={0.02} radius={3.5} />
                <ParticleSystem count={4000} color="#ffffff" size={0.04} radius={2.5} />
              </group>
              {/* Photon Sphere Glow */}
              <mesh>
                <sphereGeometry args={[1.1, 64, 64]} />
                <meshBasicMaterial color="#ff5500" transparent opacity={0.3} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
              </mesh>
            </group>
          )}
          </HologramStage>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={1} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={stage === 'supernova' ? 3 : 1.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')}
        </div>
      </div>
    </div>
  );
};

const OrbitalEarthAndVehicle = ({ altitude, inclination, solarPanelsDeployed, satelliteType }) => {
  const earthRef = useRef(null);
  const cloudRef = useRef(null);
  const satelliteRef = useRef(null);
  const orbitAngleRef = useRef(0);
  const inclinationRad = useMemo(() => inclination * (Math.PI / 180), [inclination]);
  const orbitRadius = useMemo(() => 2.8 + altitude / 900, [altitude]);

  const [dayMap, bumpMap, specularMap, nightMap, cloudMap] = useTextures(PLANET_TEXTURES);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.06;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.08;
    orbitAngleRef.current += delta * 0.42;

    if (satelliteRef.current) {
      const a = orbitAngleRef.current;
      const x = orbitRadius * Math.cos(a);
      const y = orbitRadius * Math.sin(a) * Math.sin(inclinationRad);
      const z = orbitRadius * Math.sin(a) * Math.cos(inclinationRad);
      satelliteRef.current.position.set(x, y, z);
      satelliteRef.current.rotation.y += delta * 1.2;
      satelliteRef.current.rotation.z += delta * 0.3;
    }
  });

  return (
    <group>
      <group ref={earthRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[2.15, 96, 96]} />
          <meshPhongMaterial
            map={dayMap}
            bumpMap={bumpMap}
            bumpScale={0.03}
            specularMap={specularMap}
            specular={new THREE.Color('#5f769b')}
            shininess={24}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[2.154, 96, 96]} />
          <meshBasicMaterial map={nightMap} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <mesh ref={cloudRef}>
        <sphereGeometry args={[2.2, 96, 96]} />
        <meshPhongMaterial map={cloudMap} transparent opacity={0.24} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.26, 64, 64]} />
        <meshBasicMaterial color="#4ca6ff" transparent opacity={0.09} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[orbitRadius - 0.012, orbitRadius + 0.012, 160]} />
        <meshBasicMaterial color="#66d9ff" transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>

      <group ref={satelliteRef}>
        <Spacecraft type={satelliteType} deployed={solarPanelsDeployed} />
      </group>
    </group>
  );
};

const SatelliteControlSimulator = () => {
  const { t, i18n } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [altitude, setAltitude] = useState(400); // km
  const [inclination, setInclination] = useState(51.6); // degrees
  const [solarPanelsDeployed, setSolarPanelsDeployed] = useState(true);
  const [power, setPower] = useState(100);
  const [satelliteType, setSatelliteType] = useState('iss');

  useEffect(() => {
    trackEvent('lab_satellite_' + satelliteType);
  }, [satelliteType, trackEvent]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPower(p => {
        if (!solarPanelsDeployed && p > 0) {
          return Math.max(0, p - 0.5);
        } else if (solarPanelsDeployed && p < 100) {
          return Math.min(100, p + 2);
        }
        return p;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [solarPanelsDeployed]);

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Globe2 className="text-blue-400" /> {t('lab', 'satelliteControl')}</h3>

          <div className="space-y-6">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t('lab', 'spacecraftType')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSatelliteType('iss')} className={`py-2 rounded-lg text-sm transition-colors ${satelliteType === 'iss' ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'}`}>ISS</button>
                <button onClick={() => setSatelliteType('tiangong')} className={`py-2 rounded-lg text-sm transition-colors ${satelliteType === 'tiangong' ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'}`}>Tiangong</button>
                <button onClick={() => setSatelliteType('dragon')} className={`py-2 rounded-lg text-sm transition-colors ${satelliteType === 'dragon' ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'}`}>Crew Dragon</button>
                <button onClick={() => setSatelliteType('soyuz')} className={`py-2 rounded-lg text-sm transition-colors ${satelliteType === 'soyuz' ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'}`}>Soyuz</button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'altitude')}</span>
                <span>{altitude} km</span>
              </div>
              <input
                type="range"
                min="200"
                max="2000"
                value={altitude}
                onChange={(e) => setAltitude(parseInt(e.target.value))}
                className="w-full accent-blue-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'orbitalInclination')}</span>
                <span>{inclination}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                value={inclination}
                onChange={(e) => setInclination(parseInt(e.target.value))}
                className="w-full accent-blue-400"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-gray-300">{t('lab', 'solarPanels')}</span>
              <button
                onClick={() => setSolarPanelsDeployed(!solarPanelsDeployed)}
                className={`w-12 h-6 rounded-full transition-colors relative ${solarPanelsDeployed ? 'bg-blue-400' : 'bg-space-700'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${solarPanelsDeployed ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'powerLevel')}</span>
                <span className={power < 20 ? 'text-red-500' : 'text-green-400'}>{Math.round(power)}%</span>
              </div>
              <div className="h-2 bg-space-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${power < 20 ? 'bg-red-500' : 'bg-green-400'}`}
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas shadows camera={{ position: [0, 2.1, 8.4], fov: 44 }} gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}>
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.16} />
          <hemisphereLight skyColor="#9dc1ff" groundColor="#2c2621" intensity={0.33} />
          <directionalLight position={[9, 8, 8]} intensity={2.25} castShadow />
          <Stars radius={120} depth={60} count={7000} factor={3.2} saturation={0} fade speed={0.8} />

          <Suspense fallback={null}>
            <HologramStage
              height={6.4}
              radius={3.1}
              accent={HOLO.accent}
              spin={0}
              float={false}
              plinth={false}
              lighting={false}
            >
              <OrbitalEarthAndVehicle
                altitude={altitude}
                inclination={inclination}
                solarPanelsDeployed={solarPanelsDeployed}
                satelliteType={satelliteType}
              />
            </HologramStage>
          </Suspense>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.35} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.7} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')}
        </div>
      </div>
    </div>
  );
};

// --- Falcon 9 AI Tracker ---
const FalconTrackerLab = () => {
  return (
    <div className="w-full h-full bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative min-h-[600px] flex">
      <iframe
        src="/falcon9-simulator/index.html"
        className="w-full h-full border-0 flex-1"
        allow="camera; microphone; fullscreen"
        title="Falcon 9 AI Tracker"
      />
    </div>
  );
};

// --- Main View ---

export default function SpaceLabView() {
  const { t, i18n } = useTranslation();
  const [activeModule, setActiveModule] = useState('apollo');

  const modules = [
    { id: 'apollo', name: t('lab', 'apolloTitle'), icon: Rocket, color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
    { id: 'launch', name: t('lab', 'launchSimulator'), icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { id: 'satellite', name: t('lab', 'satelliteControl'), icon: Globe2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { id: 'planet', name: t('lab', 'planetaryProcesses'), icon: Globe2, color: 'text-green-400', bg: 'bg-green-400/10' },
    { id: 'universe', name: t('lab', 'universeChanges'), icon: Sparkles, color: 'text-neon-purple', bg: 'bg-neon-purple/10' },
    { id: 'falcon', name: t('lab', 'satelliteTracker'), icon: Satellite, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
  ];

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* The height is pinned to the viewport only where the panel and the
          viewer sit side by side. Stacked on a phone they are taller than
          that, and a fixed height made the Apollo panel overflow the
          container and land on top of the footer. */}
      <div className="flex flex-col lg:flex-row gap-8 lg:h-[calc(100vh-140px)] lg:min-h-[600px]">
        {/* Sidebar */}
        <div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0">
          {modules.map(mod => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={`flex items-center gap-3 p-4 rounded-2xl transition-all whitespace-nowrap lg:whitespace-normal ${
                activeModule === mod.id
                  ? 'glass border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              <div className={`p-2 rounded-xl ${mod.bg}`}>
                <mod.icon className={`w-5 h-5 ${mod.color}`} />
              </div>
              <span className={`font-bold ${activeModule === mod.id ? 'text-white' : 'text-gray-400'}`}>
                {mod.name}
              </span>
            </button>
          ))}
        </div>

        {/* Main Lab Area */}
        <div className="flex-grow">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {activeModule === 'apollo' && <ApolloHologramModule />}
              {activeModule === 'launch' && <ApolloLaunchSimulator />}
              {activeModule === 'satellite' && <SatelliteControlSimulator />}
              {activeModule === 'planet' && <PlanetaryProcessesLab />}
              {activeModule === 'universe' && <UniverseChangesSimulator />}
              {activeModule === 'falcon' && <FalconTrackerLab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

