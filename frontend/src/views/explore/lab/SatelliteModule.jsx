import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Moon, Sun } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useTextures } from '@/hooks/useTextures';
import { HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import { Spacecraft } from './Spacecraft';
import {
  EARTH_RADIUS_KM,
  GEO_ALTITUDE_KM,
  SIDEREAL_DAY_MINUTES,
  altitudeFromSlider,
  eclipseFraction,
  greatCircleKm,
  labOrbitClass,
  orbitalPeriodMinutes,
  orbitalSpeedKms,
  sliderFromAltitude,
  visibleSurfaceFraction,
} from '@/lib/orbits';

/**
 * Satellite Control: put a spacecraft on any circular orbit from 200 km to
 * beyond geostationary height, and watch what that does.
 *
 * The first rework made the altitude slider change the orbit (period, speed
 * and one true scale for planet and orbit). What this one fixed:
 *
 * - **The famous orbits were out of reach.** The slider stopped at 2000 km, so
 *   GPS (about 20 200 km) and geostationary (35 786 km) could not be shown.
 *   It is logarithmic now, 200 km to 40 000 km, with nudge buttons for the
 *   last few kilometres, and the view zooms out as the orbit grows so a
 *   36 000 km orbit still fits on the screen at true scale.
 * - **The satellite left its own orbit.** The drawn ring was tilted about one
 *   axis and the satellite's path about another, so on any inclined orbit the
 *   spacecraft flew off the line it was supposed to follow — and it went round
 *   the wrong way, against the Earth's rotation. Both now use one plane and go
 *   eastward.
 * - **The Earth turned at a made-up rate.** It spins at one sidereal day per
 *   turn under the same time warp as the orbit, which is what makes a
 *   geostationary satellite visibly hover over one spot.
 * - **"Power" ignored the shadow.** The battery now drains whenever the
 *   satellite is in the Earth's shadow, which really happens for about a third
 *   of every low orbit, and the shadow is drawn.
 *
 * Every number on the page is computed by `orbits.js` from the two sliders;
 * the presets are sourced figures for real orbits (see `PRESETS`). Missions
 * only count once the reader has moved a slider themselves, so a preset cannot
 * complete them.
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
/** The largest orbit radius drawn before the view starts zooming out. */
const FIT_UNITS = 2.95;

export const MIN_ALTITUDE_KM = 200;
export const MAX_ALTITUDE_KM = 40000;
const SLIDER_STEPS = 2000;

/** Simulated seconds per real second. */
const TIME_WARPS = [60, 450, 3000];
const DEFAULT_WARP = 450;

/**
 * Where the Sun is in the scene. Twelve degrees above the equator — a date
 * between a solstice and an equinox — rather than the 34 degrees the light
 * used to sit at, which the real Sun never reaches.
 */
const SUN_DIRECTION = new THREE.Vector3(9, 2.5, 7).normalize();
const SUN_LIGHT_POSITION = SUN_DIRECTION.clone().multiplyScalar(12).toArray();
/** The shadow is a cylinder along the anti-Sun direction, as long as the widest orbit. */
const SHADOW_LENGTH = 16;
const SHADOW_POSITION = SUN_DIRECTION.clone().multiplyScalar(-SHADOW_LENGTH / 2).toArray();
const SHADOW_ROTATION = new THREE.Euler()
  .setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), SUN_DIRECTION))
  .toArray()
  .slice(0, 3);

/**
 * Real orbits, as their operators describe them.
 *
 *   ISS        about 400 km, 51.6 deg              NASA, ISS facts and figures
 *   Hubble     about 535 km, 28.5 deg, ~95 min     NASA, Hubble mission facts
 *              (the height drifts down over the years as thin air drags on it)
 *   GPS        about 20 200 km, 55 deg, two orbits a day        GPS.gov
 *   Geostationary  35 786 km over the equator, one turn a sidereal day
 */
export const PRESETS = [
  { id: 'iss', craft: 'iss', altitude: 400, inclination: 51.6, labelKey: 'satPresetIss' },
  { id: 'hubble', craft: 'hubble', altitude: 535, inclination: 28.5, labelKey: 'satPresetHubble' },
  { id: 'gps', craft: 'satellite', altitude: 20200, inclination: 55, labelKey: 'satPresetGps' },
  { id: 'geo', craft: 'satellite', altitude: GEO_ALTITUDE_KM, inclination: 0, labelKey: 'satPresetGeo' },
];

const SPACECRAFT = [
  { id: 'iss', labelKey: 'satModelIss' },
  { id: 'tiangong', labelKey: 'satModelTiangong' },
  { id: 'dragon', labelKey: 'satModelDragon' },
  { id: 'soyuz', labelKey: 'satModelSoyuz' },
  { id: 'hubble', labelKey: 'satModelHubble' },
  { id: 'satellite', labelKey: 'satModelSatellite' },
];

/** Tashkent and Samarkand, for the "how fast is that" comparison. */
const TASHKENT = [41.2995, 69.2401];
const SAMARKAND = [39.627, 66.975];
const TASHKENT_SAMARKAND_KM = greatCircleKm(...TASHKENT, ...SAMARKAND);
/** A typical airliner's cruising speed, stated on the page as an approximation. */
const AIRLINER_KMH = 900;

/** The angle between the orbit plane and the Sun, for the orbit drawn. */
export function betaAngleDeg(inclinationDeg) {
  const i = (inclinationDeg * Math.PI) / 180;
  // Orbit normal for the plane used below: (0, cos i, sin i).
  const sinBeta = Math.cos(i) * SUN_DIRECTION.y + Math.sin(i) * SUN_DIRECTION.z;
  return (Math.asin(Math.max(-1, Math.min(1, sinBeta))) * 180) / Math.PI;
}

/**
 * Which missions the current orbit satisfies. Nothing counts while the orbit
 * is still exactly what a preset set: the reader has to fly it themselves.
 */
export function satelliteMissions({ altitude, inclination, fromPreset }) {
  const manual = !fromPreset;
  const period = orbitalPeriodMinutes(altitude);
  return {
    polar: manual && Math.abs(inclination - 90) <= 3,
    slow: manual && orbitalSpeedKms(altitude) < 4,
    gps: manual && Math.abs(period - SIDEREAL_DAY_MINUTES / 2) <= 5,
    geo: manual && Math.abs(period - SIDEREAL_DAY_MINUTES) <= 10 && Math.abs(inclination) <= 1,
  };
}

/**
 * One line telling the reader why a mission has not ticked yet, or how close
 * they are — a bare "not done" teaches nothing. Returns a locale key and the
 * values it needs, or null when there is nothing useful to say.
 */
export function missionFeedback({ altitude, inclination, fromPreset }) {
  const would = satelliteMissions({ altitude, inclination, fromPreset: false });
  if (fromPreset) return Object.values(would).some(Boolean) ? { key: 'satPresetNoCount' } : null;
  const period = orbitalPeriodMinutes(altitude);
  const geoGap = period - SIDEREAL_DAY_MINUTES;
  if (!would.geo && Math.abs(geoGap) <= 60) {
    if (Math.abs(geoGap) > 10) return { key: 'satNearGeoPeriod', period, dirKey: geoGap < 0 ? 'satGoHigher' : 'satGoLower' };
    return { key: 'satNearGeoTilt' };
  }
  const gpsGap = period - SIDEREAL_DAY_MINUTES / 2;
  if (!would.gps && Math.abs(gpsGap) <= 30) {
    return { key: 'satNearGps', period, dirKey: gpsGap < 0 ? 'satGoHigher' : 'satGoLower' };
  }
  return null;
}

/** 35786 -> "35 786": the same in all three languages. */
function grouped(value) {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function OrbitalEarthAndVehicle({ altitude, inclination, solarPanelsDeployed, satelliteType, warp, shadowRef }) {
  const viewRef = useRef(null);
  const earthRef = useRef(null);
  const cloudRef = useRef(null);
  const satelliteRef = useRef(null);
  const modelRef = useRef(null);
  const markerRef = useRef(null);
  const orbitAngleRef = useRef(0);
  const viewScaleRef = useRef(null);

  const inclinationRad = useMemo(() => inclination * (Math.PI / 180), [inclination]);
  const orbitRadius = useMemo(() => (EARTH_RADIUS_KM + altitude) / KM_PER_UNIT, [altitude]);
  // The ring is drawn inside the zoomed group, so its width is divided by the
  // zoom to keep the line the same thickness on screen at every height.
  const ringHalfWidth = 0.012 / Math.min(1, FIT_UNITS / orbitRadius);
  // Radians per real second: the true rates, times the chosen warp.
  const orbitRate = useMemo(
    () => ((Math.PI * 2) / (orbitalPeriodMinutes(altitude) * 60)) * warp,
    [altitude, warp],
  );
  const earthRate = ((Math.PI * 2) / (SIDEREAL_DAY_MINUTES * 60)) * warp;

  const [dayMap, bumpMap, specularMap, nightMap, cloudMap] = useTextures(PLANET_TEXTURES);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    if (earthRef.current) earthRef.current.rotation.y += earthRate * dt;
    if (cloudRef.current) cloudRef.current.rotation.y += earthRate * 1.1 * dt;
    orbitAngleRef.current += orbitRate * dt;

    // Zoom out smoothly when the orbit would leave the frame. The first frame
    // starts at the right zoom; only later changes are animated.
    const targetScale = Math.min(1, FIT_UNITS / orbitRadius);
    if (viewScaleRef.current === null) viewScaleRef.current = targetScale;
    viewScaleRef.current += (targetScale - viewScaleRef.current) * Math.min(1, dt * 4);
    const s = viewScaleRef.current;
    if (viewRef.current) viewRef.current.scale.setScalar(s);

    const a = orbitAngleRef.current;
    const r = orbitRadius * s;
    const x = r * Math.cos(a);
    const y = r * Math.sin(a) * Math.sin(inclinationRad);
    const z = -r * Math.sin(a) * Math.cos(inclinationRad);
    if (satelliteRef.current) satelliteRef.current.position.set(x, y, z);
    if (modelRef.current) {
      modelRef.current.scale.setScalar(0.16 * (0.45 + 0.55 * s));
      modelRef.current.rotation.y += dt * 0.6;
    }

    // In the shadow: behind the Earth and within its radius of the Sun line.
    const along = x * SUN_DIRECTION.x + y * SUN_DIRECTION.y + z * SUN_DIRECTION.z;
    const px = x - along * SUN_DIRECTION.x;
    const py = y - along * SUN_DIRECTION.y;
    const pz = z - along * SUN_DIRECTION.z;
    const dark = along < 0 && Math.sqrt(px * px + py * py + pz * pz) < EARTH_UNITS * s;
    if (dark !== shadowRef.current) {
      shadowRef.current = dark;
      markerRef.current?.color.set(dark ? '#5b6b8c' : '#ffd27a');
    }
  });

  return (
    <group>
      <group ref={viewRef}>
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

        {/* The Earth's shadow, drawn as the cylinder it very nearly is. */}
        <mesh position={SHADOW_POSITION} rotation={SHADOW_ROTATION}>
          <cylinderGeometry args={[EARTH_UNITS, EARTH_UNITS, SHADOW_LENGTH, 48, 1, true]} />
          <meshBasicMaterial color="#020617" transparent opacity={0.28} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>

        {/* The orbit track, in the same plane the satellite flies in. */}
        <group rotation={[inclinationRad, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[orbitRadius - ringHalfWidth, orbitRadius + ringHalfWidth, 256]} />
            <meshBasicMaterial color="#66d9ff" transparent opacity={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      <group ref={satelliteRef}>
        {/* A bright point so the craft can be found at 36 000 km; grey in shadow. */}
        <mesh>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshBasicMaterial ref={markerRef} color="#ffd27a" />
        </mesh>
        <group ref={modelRef} scale={0.16}>
          <Spacecraft type={satelliteType} deployed={solarPanelsDeployed} />
        </group>
      </group>
    </group>
  );
}

export function SatelliteControlSimulator() {
  const { t } = useTranslation();
  const [altitude, setAltitude] = useState(PRESETS[0].altitude);
  const [inclination, setInclination] = useState(PRESETS[0].inclination);
  const [satelliteType, setSatelliteType] = useState(PRESETS[0].craft);
  const [presetId, setPresetId] = useState(PRESETS[0].id);
  const [solarPanelsDeployed, setSolarPanelsDeployed] = useState(true);
  const [power, setPower] = useState(100);
  const [warp, setWarp] = useState(DEFAULT_WARP);
  const [sunlit, setSunlit] = useState(true);
  const shadowRef = useRef(false);

  const fromPreset = presetId !== null;

  // The battery: charged by the panels in sunlight, drained in the Earth's
  // shadow or with the panels folded. Rates scale with the time warp, so an
  // eclipse costs the same charge however fast it is played.
  useEffect(() => {
    const interval = setInterval(() => {
      const dark = shadowRef.current;
      setSunlit(!dark);
      setPower((p) => {
        const k = warp / DEFAULT_WARP;
        if (solarPanelsDeployed && !dark) return Math.min(100, p + 2 * k);
        return Math.max(0, p - 0.4 * k);
      });
    }, 100);
    return () => clearInterval(interval);
  }, [solarPanelsDeployed, warp]);

  const pickPreset = (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setAltitude(preset.altitude);
    setInclination(preset.inclination);
    setSatelliteType(preset.craft);
    setPresetId(preset.id);
  };

  const flyAltitude = (km) => {
    setAltitude(Math.min(MAX_ALTITUDE_KM, Math.max(MIN_ALTITUDE_KM, km)));
    setPresetId(null);
  };

  const period = orbitalPeriodMinutes(altitude);
  const speed = orbitalSpeedKms(altitude);
  const kind = labOrbitClass(altitude, inclination);
  const beta = betaAngleDeg(inclination);
  const shadowMinutes = eclipseFraction(altitude, beta) * period;
  const visible = visibleSurfaceFraction(altitude);
  const missionsDone = satelliteMissions({ altitude, inclination, fromPreset });

  const formatPeriod = (minutes) => {
    if (minutes < 120) return t('lab', 'satUnitMin', { value: minutes.toFixed(1) });
    const whole = Math.round(minutes);
    return t('lab', 'satUnitHourMin', { h: Math.floor(whole / 60), m: whole % 60 });
  };
  const periodText = formatPeriod(period);
  const feedback = missionFeedback({ altitude, inclination, fromPreset });

  const readouts = [
    { label: t('lab', 'orbitalPeriod'), value: periodText },
    { label: t('lab', 'velocity'), value: t('lab', 'satUnitKms', { value: speed.toFixed(2) }) },
    { label: t('lab', 'orbitType'), value: t('lab', kind.labelKey) },
    { label: t('lab', 'revolutionsPerDay'), value: (1440 / period).toFixed(2) },
    { label: t('lab', 'satShadowPerOrbit'), value: t('lab', 'satUnitMin', { value: shadowMinutes.toFixed(0) }) },
    { label: t('lab', 'satVisibleEarth'), value: `${(visible * 100).toFixed(1)} %` },
  ];

  const missions = [
    { id: 'polar', title: t('lab', 'satMissionPolar'), hint: t('lab', 'satMissionPolarHint'), done: missionsDone.polar },
    { id: 'slow', title: t('lab', 'satMissionSlow'), hint: t('lab', 'satMissionSlowHint'), done: missionsDone.slow },
    { id: 'gps', title: t('lab', 'satMissionGps'), hint: t('lab', 'satMissionGpsHint'), done: missionsDone.gps },
    { id: 'geo', title: t('lab', 'satMissionGeo'), hint: t('lab', 'satMissionGeoHint'), done: missionsDone.geo },
  ];

  const facts = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    text: t('lab', `satFact${n}`),
    source: t('lab', `satFact${n}Source`),
  }));

  const sliderValue = Math.round(sliderFromAltitude(altitude, MIN_ALTITUDE_KM, MAX_ALTITUDE_KM) * SLIDER_STEPS);
  const ticks = [
    { label: 'LEO', km: 2000 },
    { label: 'GPS', km: 20200 },
    { label: 'GEO', km: GEO_ALTITUDE_KM },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Globe2 className="text-blue-400" /> {t('lab', 'satelliteControl')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'satSubtitle')}</p>
          </div>

          <LabPresets
            presets={PRESETS.map((p) => ({ id: p.id, label: t('lab', p.labelKey) }))}
            activeId={presetId}
            onPick={pickPreset}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
              <span>{t('lab', 'altitude')}</span>
              <span className="font-mono text-white">{t('lab', 'satUnitKm', { value: grouped(altitude) })}</span>
            </div>
            <input
              type="range"
              min="0"
              max={SLIDER_STEPS}
              step="1"
              value={sliderValue}
              onChange={(e) =>
                flyAltitude(
                  altitudeFromSlider(parseInt(e.target.value, 10) / SLIDER_STEPS, MIN_ALTITUDE_KM, MAX_ALTITUDE_KM),
                )
              }
              className="w-full accent-cyan-400"
              aria-label={t('lab', 'altitude')}
            />
            {/* Where the famous heights sit on a logarithmic scale. */}
            <div className="relative h-4 text-[10px] font-mono text-gray-500" aria-hidden="true">
              {ticks.map((tick) => (
                <span
                  key={tick.label}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${sliderFromAltitude(tick.km, MIN_ALTITUDE_KM, MAX_ALTITUDE_KM) * 100}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[-100, -10, 10, 100].map((dk) => (
                <button
                  key={dk}
                  onClick={() => flyAltitude(Math.round(altitude) + dk)}
                  className="min-h-[40px] md:min-h-[32px] rounded-lg text-xs font-mono bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                  aria-label={t('lab', 'satNudge', { value: dk > 0 ? `+${dk}` : `${dk}` })}
                >
                  {dk > 0 ? `+${dk}` : dk}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
              <span>{t('lab', 'orbitalInclination')}</span>
              <span className="font-mono text-white">{inclination.toFixed(1)}°</span>
            </div>
            {/* `parseFloat` and a 0.1 step: `parseInt` once rounded the
                ISS's 51.6 degrees away on the first touch. 0-180, because
                Earth-observing satellites fly retrograde, just past 90. */}
            <input
              type="range"
              min="0"
              max="180"
              step="0.1"
              value={inclination}
              onChange={(e) => {
                setInclination(parseFloat(e.target.value));
                setPresetId(null);
              }}
              className="w-full accent-cyan-400"
              aria-label={t('lab', 'orbitalInclination')}
            />
            <p className="text-xs text-gray-500">
              {t('lab', inclination > 90 ? 'satInclinationRetrograde' : 'satInclinationHint')}
            </p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{t('lab', 'satTimeWarp')}</p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('lab', 'satTimeWarp')}>
              {TIME_WARPS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWarp(w)}
                  aria-pressed={warp === w}
                  className={`min-h-[40px] md:min-h-[32px] rounded-lg text-sm font-mono transition-colors ${
                    warp === w ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  ×{w}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{t('lab', 'spacecraftType')}</p>
            <div className="grid grid-cols-3 gap-2">
              {SPACECRAFT.map((craft) => (
                <button
                  key={craft.id}
                  onClick={() => setSatelliteType(craft.id)}
                  aria-pressed={satelliteType === craft.id}
                  className={`min-h-[40px] md:min-h-[32px] px-1 rounded-lg text-xs transition-colors ${
                    satelliteType === craft.id
                      ? 'bg-neon-blue text-space-900 font-bold'
                      : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  {t('lab', craft.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-gray-300">{t('lab', 'solarPanels')}</span>
              {/* A 40 px hit area around the 24 px switch, for fingers. */}
              <button
                onClick={() => setSolarPanelsDeployed(!solarPanelsDeployed)}
                aria-pressed={solarPanelsDeployed}
                aria-label={t('lab', 'solarPanels')}
                className="h-10 w-16 -mr-2 flex items-center justify-center"
              >
                <span
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    solarPanelsDeployed ? 'bg-blue-400' : 'bg-space-700'
                  }`}
                >
                  <span
                    className={`w-4 h-4 bg-white rounded-full absolute top-1 left-0 transition-transform ${
                      solarPanelsDeployed ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </span>
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span>{t('lab', 'powerLevel')}</span>
                <span className={power < 20 ? 'text-red-400' : 'text-green-400'}>{Math.round(power)}%</span>
              </div>
              <div className="h-2 bg-space-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${power < 20 ? 'bg-red-500' : 'bg-green-400'}`}
                  style={{ width: `${power}%` }}
                />
              </div>
              <p className={`flex items-center gap-1.5 text-xs ${sunlit ? 'text-amber-200' : 'text-slate-300'}`}>
                {sunlit ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {t('lab', sunlit ? 'satSunlit' : 'satInShadow')}
              </p>
              {power < 20 ? <p className="text-xs text-red-300">{t('lab', 'satLowPower')}</p> : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
              </div>
            ))}
          </dl>

          <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-gray-300">
            {t('lab', 'satAnalogy', {
              seconds: (TASHKENT_SAMARKAND_KM / speed).toFixed(0),
              km: TASHKENT_SAMARKAND_KM.toFixed(0),
              times: ((speed * 3600) / AIRLINER_KMH).toFixed(0),
            })}
          </p>

          {feedback ? (
            <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {t('lab', feedback.key, {
                now: feedback.period ? formatPeriod(feedback.period) : '',
                dir: feedback.dirKey ? t('lab', feedback.dirKey) : '',
              })}
            </p>
          ) : null}

          <LabMissions prefix="lab_satellite_" missions={missions} />

          <LabExplain
            simple={t('lab', 'satExplainSimple')}
            formula={[t('lab', 'satFormulaSpeed'), t('lab', 'satFormulaPeriod'), t('lab', 'satFormulaConstants')]}
            details={t('lab', 'satExplainDetails')}
          />

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'orbitScaleNote')}</p>
        </div>
      </div>

      <LabViewport hint={`${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')}`}>
        <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-1.5">
          <span className="text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
            {t('lab', 'satViewChip')}
          </span>
          {/* The craft are drawn thousands of times too big to be seen at all. */}
          <span className="text-[10px] text-gray-300 bg-black/50 px-2.5 py-1 rounded-full">{t('lab', 'satNotToScale')}</span>
        </div>
        <div
          className={`absolute top-4 right-4 z-10 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            sunlit ? 'text-amber-100 bg-amber-400/10 border-amber-300/30' : 'text-slate-200 bg-slate-500/20 border-slate-300/20'
          }`}
        >
          {sunlit ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          {t('lab', sunlit ? 'satSunlit' : 'satInShadow')} · ×{warp}
        </div>
        <Canvas
          shadows
          dpr={LAB_DPR}
          camera={{ position: [0, 2.1, 8.4], fov: 44 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <ambientLight intensity={0.12} />
          <hemisphereLight skyColor="#9dc1ff" groundColor="#2c2621" intensity={0.25} />
          <directionalLight position={SUN_LIGHT_POSITION} intensity={2.4} castShadow />
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
                warp={warp}
                shadowRef={shadowRef}
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
