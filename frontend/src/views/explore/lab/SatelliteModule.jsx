import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useTextures } from '@/hooks/useTextures';
import { HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { Spacecraft } from './Spacecraft';
import {
  EARTH_RADIUS_KM,
  orbitType,
  orbitalPeriodMinutes,
  orbitalSpeedKms,
} from '@/lib/orbits';

/**
 * Satellite Control: the altitude slider now changes the orbit.
 *
 * What it did before, and why each of these was worth fixing:
 *
 * - **Altitude did nothing except move the ring.** The satellite advanced at a
 *   fixed `delta * 0.42` radians a second whatever the slider said, so a 200 km
 *   orbit and a 2000 km orbit took exactly the same time to go round. That is
 *   the one thing an altitude control is for. The angular rate is derived from
 *   the orbital period now, so dragging the slider up visibly slows the
 *   satellite down.
 * - **The scale was invented.** The orbit radius was `2.8 + altitude / 900`
 *   against an Earth of radius 2.15 — which puts a 200 km orbit 1900 km up.
 *   Low Earth orbit really is a thin shell close to the surface, and drawing it
 *   truthfully teaches that; the module now uses one scale for both and says so
 *   underneath.
 * - **The inclination slider destroyed its own default.** It opened at 51.6
 *   degrees, the ISS figure, and `parseInt` on the change handler meant the
 *   first touch of the slider rounded it to an integer for the rest of the
 *   session.
 *
 * Everything printed here is derived from the two sliders by the formulae in
 * `orbits.js`, which names the constant it uses. Nothing is a stored figure
 * about a real spacecraft: the four models are recognisable shapes, not
 * measurements, and the panel says which numbers come from where.
 */

const PLANET_TEXTURES = [
  '/textures/earth_atmos_2048.jpg',
  '/textures/earth_normal_2048.jpg',
  '/textures/earth_specular_2048.jpg',
  '/textures/earth_lights_2048.png',
  '/textures/earth_clouds_1024.png',
];

/** Earth's radius in scene units. One scale for the planet and the orbit. */
const EARTH_UNITS = 2.15;
const KM_PER_UNIT = EARTH_RADIUS_KM / EARTH_UNITS;

const SPACECRAFT = [
  { id: 'iss', label: 'ISS' },
  { id: 'tiangong', label: 'Tiangong' },
  { id: 'dragon', label: 'Crew Dragon' },
  { id: 'soyuz', label: 'Soyuz' },
];

function OrbitalEarthAndVehicle({ altitude, inclination, solarPanelsDeployed, satelliteType }) {
  const earthRef = useRef(null);
  const cloudRef = useRef(null);
  const satelliteRef = useRef(null);
  const orbitAngleRef = useRef(0);

  const inclinationRad = useMemo(() => inclination * (Math.PI / 180), [inclination]);
  const orbitRadius = useMemo(
    () => (EARTH_RADIUS_KM + altitude) / KM_PER_UNIT,
    [altitude],
  );
  // Radians per second of simulated time. The run is sped up so a 90-minute
  // orbit takes about twelve seconds to watch, and the readout says so.
  const angularRate = useMemo(() => {
    const periodSeconds = orbitalPeriodMinutes(altitude) * 60;
    return (Math.PI * 2) / periodSeconds;
  }, [altitude]);

  const [dayMap, bumpMap, specularMap, nightMap, cloudMap] = useTextures(PLANET_TEXTURES);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.06;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.08;
    orbitAngleRef.current += angularRate * delta * 450;

    if (satelliteRef.current) {
      const a = orbitAngleRef.current;
      satelliteRef.current.position.set(
        orbitRadius * Math.cos(a),
        orbitRadius * Math.sin(a) * Math.sin(inclinationRad),
        orbitRadius * Math.sin(a) * Math.cos(inclinationRad),
      );
      satelliteRef.current.rotation.y += delta * 1.2;
    }
  });

  return (
    <group>
      <group ref={earthRef}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[EARTH_UNITS, 96, 96]} />
          <meshPhongMaterial
            key={dayMap ? 'sat-earth-textured' : 'sat-earth-plain'}
            map={dayMap}
            color={dayMap ? '#ffffff' : '#2a5d8f'}
            bumpMap={bumpMap}
            bumpScale={0.03}
            specularMap={specularMap}
            specular={new THREE.Color('#5f769b')}
            shininess={24}
          />
        </mesh>
        {nightMap && (
          <mesh>
            <sphereGeometry args={[EARTH_UNITS * 1.002, 96, 96]} />
            <meshBasicMaterial
              map={nightMap}
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {cloudMap && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[EARTH_UNITS * 1.023, 96, 96]} />
          <meshPhongMaterial map={cloudMap} transparent opacity={0.24} depthWrite={false} />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[EARTH_UNITS * 1.05, 64, 64]} />
        <meshBasicMaterial
          color="#4ca6ff"
          transparent
          opacity={0.09}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* The orbit track, tilted by the inclination like the orbit it draws.
          It used to lie flat on the equator whatever the slider said, so a
          90-degree polar orbit was drawn as an equatorial one. */}
      <group rotation={[0, 0, inclinationRad]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[orbitRadius - 0.008, orbitRadius + 0.008, 180]} />
          <meshBasicMaterial color="#66d9ff" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <group ref={satelliteRef}>
        <group scale={0.16}>
          <Spacecraft type={satelliteType} deployed={solarPanelsDeployed} />
        </group>
      </group>
    </group>
  );
}

export function SatelliteControlSimulator() {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [altitude, setAltitude] = useState(400);
  const [inclination, setInclination] = useState(51.6);
  const [solarPanelsDeployed, setSolarPanelsDeployed] = useState(true);
  const [power, setPower] = useState(100);
  const [satelliteType, setSatelliteType] = useState('iss');

  useEffect(() => {
    trackEvent('lab_satellite_' + satelliteType);
  }, [satelliteType, trackEvent]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPower((p) => {
        if (!solarPanelsDeployed && p > 0) return Math.max(0, p - 0.5);
        if (solarPanelsDeployed && p < 100) return Math.min(100, p + 2);
        return p;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [solarPanelsDeployed]);

  const period = orbitalPeriodMinutes(altitude);
  const speed = orbitalSpeedKms(altitude);
  const kind = orbitType(altitude);

  const readouts = [
    { label: t('lab', 'orbitalPeriod'), value: `${period.toFixed(1)} min` },
    { label: t('lab', 'velocity'), value: `${speed.toFixed(2)} km/s` },
    { label: t('lab', 'orbitType'), value: t('lab', kind.labelKey) },
    { label: t('lab', 'revolutionsPerDay'), value: (1440 / period).toFixed(2) },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-6 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Globe2 className="text-blue-400" /> {t('lab', 'satelliteControl')}
          </h3>

          <div className="space-y-6">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">
                {t('lab', 'spacecraftType')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SPACECRAFT.map((craft) => (
                  <button
                    key={craft.id}
                    onClick={() => setSatelliteType(craft.id)}
                    className={`py-2 rounded-lg text-sm transition-colors ${
                      satelliteType === craft.id
                        ? 'bg-neon-blue text-space-900 font-bold'
                        : 'bg-space-800 text-gray-400 hover:bg-space-700'
                    }`}
                  >
                    {craft.label}
                  </button>
                ))}
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
                step="10"
                value={altitude}
                onChange={(e) => setAltitude(parseInt(e.target.value, 10))}
                className="w-full accent-blue-400"
                aria-label={t('lab', 'altitude')}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'orbitalInclination')}</span>
                <span>{inclination.toFixed(1)}°</span>
              </div>
              {/* `parseFloat` and a 0.1 step: the default is the ISS's 51.6
                  degrees, and `parseInt` used to round it away permanently the
                  first time anybody touched the control. */}
              <input
                type="range"
                min="0"
                max="90"
                step="0.1"
                value={inclination}
                onChange={(e) => setInclination(parseFloat(e.target.value))}
                className="w-full accent-blue-400"
                aria-label={t('lab', 'orbitalInclination')}
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <span className="text-gray-300">{t('lab', 'solarPanels')}</span>
              <button
                onClick={() => setSolarPanelsDeployed(!solarPanelsDeployed)}
                aria-pressed={solarPanelsDeployed}
                aria-label={t('lab', 'solarPanels')}
                className={`w-12 h-6 rounded-full transition-colors relative ${
                  solarPanelsDeployed ? 'bg-blue-400' : 'bg-space-700'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    solarPanelsDeployed ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2 pt-4 border-t border-white/10">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'powerLevel')}</span>
                <span className={power < 20 ? 'text-red-500' : 'text-green-400'}>
                  {Math.round(power)}%
                </span>
              </div>
              <div className="h-2 bg-space-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${power < 20 ? 'bg-red-500' : 'bg-green-400'}`}
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
              {readouts.map((readout) => (
                <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                  <dt className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {readout.label}
                  </dt>
                  <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
                </div>
              ))}
            </dl>

            <p className="text-[10px] leading-relaxed text-gray-500">
              {t('lab', 'orbitScaleNote')}
            </p>
          </div>
        </div>
      </div>

      <LabViewport hint={`${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')}`}>
        <Canvas
          shadows
          dpr={LAB_DPR}
          camera={{ position: [0, 2.1, 8.4], fov: 44 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.16} />
          <hemisphereLight skyColor="#9dc1ff" groundColor="#2c2621" intensity={0.33} />
          <directionalLight position={[9, 8, 8]} intensity={2.25} castShadow />
          <Stars radius={120} depth={60} count={6000} factor={3.2} saturation={0} fade speed={0.8} />

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
      </LabViewport>
    </div>
  );
}
