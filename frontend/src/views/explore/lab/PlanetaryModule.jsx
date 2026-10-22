import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useTextures } from '@/hooks/useTextures';
import { FitToViewport, HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  EARTH_GRAVITY,
  IO,
  MARS_TAU,
  METEOR_SHOWERS,
  TNT_J_PER_GRAM,
  directSunlight,
  fastestShower,
  grainEnergyJ,
  nextPeak,
  plumeHeightKm,
  soonestShower,
} from '@/lib/worldPhenomena';

/**
 * Worlds in action: three real processes, each on the world where it happens.
 *
 * The module used to put a "meteor shower", a "volcanic eruption" and a "dust
 * storm" on the Earth, and drew the last two by tinting the whole planet red
 * or orange. None of that happens here. Each process now has its own world and
 * its own piece of physics the reader can move:
 *
 * - **Earth, meteor showers.** Real showers with their parent comets, peak
 *   dates (the next one is worked out from today), hourly rates and entry
 *   speeds. The meteoroids of one stream travel in parallel, so they all come
 *   from one direction - the radiant - and burn up in the atmosphere instead
 *   of reaching the ground.
 * - **Mars, dust storms.** Optical depth tau, and the e^-tau law that dimmed
 *   the sky over the Opportunity rover until its solar panels went dark.
 * - **Io, volcanoes.** Plume height h = v^2 / 2g, drawn at true scale against
 *   Io, with the same throw on Earth for comparison.
 *
 * Two things kept from before: the textured world is the one constant, with
 * every process an overlay on top of it, and the meteors share two materials
 * and two geometries between all of them, disposed together.
 *
 * The world turns and the camera frames it with `FitToViewport`; the old
 * fixed camera cut the globe off at the sides in a tall viewer, and the "time
 * of day" slider - which only swung the light round - is gone.
 */

const EARTH_TEXTURES = [
  '/textures/earth_color_2048.jpg',
  '/textures/earth_topology_2048.jpg',
  '/textures/earth_water_1600.png',
];
const MARS_TEXTURES = ['/textures/2k_mars.webp'];
const JUPITER_TEXTURES = ['/textures/2k_jupiter.webp'];

const RADIUS = 2;
const WORLDS = [
  { id: 'earth', nameKey: 'planetWorldEarth', whatKey: 'planetWhatEarth', dot: '#4ca6ff' },
  { id: 'mars', nameKey: 'planetWorldMars', whatKey: 'planetWhatMars', dot: '#e0784a' },
  { id: 'io', nameKey: 'planetWorldIo', whatKey: 'planetWhatIo', dot: '#e8cf5a' },
];
const SHOWER_KEY = (id) => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** A small seeded generator, so Io's map and the plumes look the same every visit. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One textured sphere that turns slowly; plain colour until the map arrives. */
function TexturedWorld({ map, bumpMap, specularMap, fallback, spin = 0.03 }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      {/* The `key` is load-bearing: the texture arrives after the first render
          and three.js compiles a material's shader once. */}
      <meshPhongMaterial
        key={map ? 'world-textured' : 'world-plain'}
        map={map}
        color={map ? '#ffffff' : fallback}
        bumpMap={bumpMap}
        bumpScale={0.02}
        specularMap={specularMap}
        specular={new THREE.Color('#333333')}
        shininess={14}
      />
    </mesh>
  );
}

/** Turns everything inside it together, so plumes stay on their vents. */
function Spinner({ speed, children }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function AtmosphereGlow({ color, scale = 1.04, opacity = 0.16 }) {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS * scale, 48, 48]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Meteors of one shower. A stream's meteoroids move in parallel, so they all
 * arrive from the radiant; each burns out where it meets the air, shrinking
 * as it goes, and a new one starts far out. Count follows the shower's hourly
 * rate, speed its entry speed.
 */
function MeteorStream({ zhr, speedKms }) {
  const count = Math.min(26, Math.max(4, Math.round(zhr / 6)));
  const groupRef = useRef(null);
  // Where the air starts, drawn thicker than the real ~100 km so it shows,
  // and how deep into it a meteor lasts: it is gone before the ground.
  const air = RADIUS * 1.06;
  const burnDepth = RADIUS * 0.05;
  const far = RADIUS * 3.2;

  const meteors = useMemo(() => {
    const random = seeded(17);
    return Array.from({ length: count }, () => {
      const angle = random() * Math.PI * 2;
      const r = RADIUS * 0.95 * Math.sqrt(random());
      return { x: r * Math.cos(angle), z: r * Math.sin(angle), s: air + random() * (far - air) };
    });
  }, [count, air, far]);

  const gpu = useMemo(() => {
    const head = new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false });
    const trail = new THREE.MeshBasicMaterial({
      color: '#ffc46b',
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    // Far larger than a real grain, or nothing would be visible at all.
    const headGeometry = new THREE.SphereGeometry(0.06, 10, 10);
    const trailGeometry = new THREE.CylinderGeometry(0.006, 0.05, 1.1, 8);
    trailGeometry.translate(0, 0.58, 0);
    return { head, trail, headGeometry, trailGeometry };
  }, []);

  useEffect(
    () => () => {
      for (const resource of Object.values(gpu)) resource.dispose();
    },
    [gpu],
  );

  // The stream's frame: local -Y is the direction of travel, towards the planet.
  const orientation = useMemo(() => {
    const radiant = new THREE.Vector3(0.75, 0.55, 0.37).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radiant);
  }, []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const step = delta * 0.9 * (speedKms / 59);
    group.children.forEach((child, i) => {
      const m = meteors[i];
      if (!m) return;
      m.s -= step;
      const distance = Math.hypot(m.x, m.s, m.z);
      const burn = distance < air ? Math.max(0, 1 - (air - distance) / burnDepth) : 1;
      if (burn <= 0 || m.s < 0) {
        m.s = far + (i % 5) * 0.2;
      }
      child.position.set(m.x, m.s, m.z);
      child.scale.setScalar(distance < air ? burn * 1.6 : 1);
    });
  });

  return (
    <group quaternion={orientation}>
      <group ref={groupRef}>
        {meteors.map((m, i) => (
          <group key={i} position={[m.x, m.s, m.z]}>
            <mesh geometry={gpu.headGeometry} material={gpu.head} />
            <mesh geometry={gpu.trailGeometry} material={gpu.trail} />
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Dust over Mars: a haze whose thickness follows the optical depth, and a
 * cloud of grains drifting round the planet - more of them the dustier it is,
 * so the storm can be seen moving rather than as a tint.
 */
function DustShell({ tau }) {
  const ref = useRef(null);
  const total = 1800;
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.09;
  });
  const positions = useMemo(() => {
    const random = seeded(2018);
    const pos = new Float32Array(total * 3);
    for (let i = 0; i < total; i += 1) {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = RADIUS * (1.012 + random() * 0.05);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);
  const haze = Math.min(0.9, 1 - Math.exp(-tau / 3));
  const shown = Math.round(total * Math.min(1, tau / 8));
  useEffect(() => {
    ref.current?.geometry.setDrawRange(0, shown);
  }, [shown]);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[RADIUS * 1.02, 48, 48]} />
        <meshStandardMaterial color="#c98a4b" transparent opacity={haze} roughness={1} depthWrite={false} />
      </mesh>
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={total} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.03} color="#f0b47a" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}

/**
 * Io's map, painted once from a seed: sulphur yellow, red and orange flows,
 * pale frost, and dark volcanic pits - and no craters, because Io's volcanoes
 * cover them faster than impacts make them. A sketch of its colours, not a
 * map of its surface; the note under the panel says so.
 */
function paintIo() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  const random = seeded(1610);
  ctx.fillStyle = '#e2c862';
  ctx.fillRect(0, 0, 512, 256);
  const blot = (colour, count, size, alpha) => {
    ctx.fillStyle = colour;
    for (let i = 0; i < count; i += 1) {
      ctx.globalAlpha = alpha * (0.5 + random() * 0.5);
      ctx.beginPath();
      ctx.ellipse(random() * 512, random() * 256, size * (0.4 + random()), size * (0.3 + random() * 0.7), random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  blot('#f4efd8', 110, 9, 0.45);
  blot('#d48a35', 150, 7, 0.5);
  blot('#a94a2c', 90, 5, 0.55);
  blot('#6b4a2a', 70, 3.5, 0.6);
  blot('#1f1712', 80, 1.6, 0.9);
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Where on Io the plumes stand, as latitude and longitude in degrees. */
const VENTS = [
  [-19, 20],
  [12, -55],
  [40, 110],
  [-45, -140],
  [5, 170],
];

/**
 * Umbrella plumes at true scale: a particle thrown from the vent rides a
 * parabola that tops out at the plume height and lands about two heights
 * away, which is the shape of the rings Pele leaves on the ground.
 */
function Plumes({ heightKm }) {
  const perPlume = 160;
  const total = perPlume * VENTS.length;
  const pointsRef = useRef(null);
  const height = (heightKm / IO.radiusKm) * RADIUS;

  const seeds = useMemo(() => {
    const random = seeded(42);
    return Array.from({ length: total }, () => ({ phase: random(), azimuth: random() * Math.PI * 2, spread: 0.7 + random() * 0.3 }));
  }, [total]);

  const frames = useMemo(
    () =>
      VENTS.map(([lat, lon]) => {
        const la = (lat * Math.PI) / 180;
        const lo = (lon * Math.PI) / 180;
        const normal = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo));
        const east = new THREE.Vector3(-Math.sin(lo), 0, Math.cos(lo));
        const north = new THREE.Vector3().crossVectors(normal, east);
        return { normal, east, north };
      }),
    [],
  );

  const positions = useMemo(() => new Float32Array(total * 3), [total]);

  useFrame((state) => {
    const points = pointsRef.current;
    if (!points) return;
    const t = state.clock.elapsedTime * 0.35;
    for (let i = 0; i < total; i += 1) {
      const { normal, east, north } = frames[Math.floor(i / perPlume)];
      const seed = seeds[i];
      const s = (seed.phase + t) % 1;
      const up = RADIUS + height * 4 * s * (1 - s);
      const out = height * 2 * s * seed.spread;
      const cx = Math.cos(seed.azimuth) * out;
      const cy = Math.sin(seed.azimuth) * out;
      positions[i * 3] = normal.x * up + east.x * cx + north.x * cy;
      positions[i * 3 + 1] = normal.y * up + east.y * cx + north.y * cy;
      positions[i * 3 + 2] = normal.z * up + east.z * cx + north.z * cy;
    }
    points.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={total} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={0.035}
          color="#fff3c2"
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {frames.map(({ normal }, i) => (
        <mesh key={i} position={normal.clone().multiplyScalar(RADIUS * 1.002)}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshBasicMaterial color="#ff5a1f" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function EarthScene({ shower }) {
  const [colorMap, bumpMap, specularMap] = useTextures(EARTH_TEXTURES);
  return (
    <>
      <TexturedWorld map={colorMap} bumpMap={bumpMap} specularMap={specularMap} fallback="#2a5d8f" />
      <AtmosphereGlow color="#4ca6ff" />
      <MeteorStream zhr={shower.zhr} speedKms={shower.speedKms} />
    </>
  );
}

function MarsScene({ tau }) {
  const [marsMap] = useTextures(MARS_TEXTURES);
  return (
    <>
      <TexturedWorld map={marsMap} fallback="#b5562e" spin={0.035} />
      <AtmosphereGlow color="#e8a36b" scale={1.05} opacity={0.08} />
      <DustShell tau={tau} />
    </>
  );
}

function IoScene({ heightKm }) {
  const ioMap = useMemo(() => paintIo(), []);
  useEffect(() => () => ioMap?.dispose(), [ioMap]);
  const [jupiterMap] = useTextures(JUPITER_TEXTURES);
  return (
    <>
      <Spinner speed={0.025}>
        <TexturedWorld map={ioMap} fallback="#e2c862" spin={0} />
        <Plumes heightKm={heightKm} />
      </Spinner>
      {/* Jupiter, behind and far smaller and nearer than it really is. */}
      <mesh position={[-11, 3.5, -20]}>
        <sphereGeometry args={[RADIUS * 3.2, 48, 48]} />
        <meshPhongMaterial key={jupiterMap ? 'jupiter-textured' : 'jupiter-plain'} map={jupiterMap} color={jupiterMap ? '#ffffff' : '#c8a27a'} />
      </mesh>
    </>
  );
}

export function PlanetaryProcessesLab() {
  const { t, i18n } = useTranslation();
  const [now] = useState(() => new Date());
  const [world, setWorld] = useState('earth');
  const [visited, setVisited] = useState(['earth']);
  // Opens on the Perseids, the shower most people have heard of; finding the
  // next one by date is a mission, so it is not pre-selected.
  const [showerId, setShowerId] = useState('perseids');
  const [picked, setPicked] = useState(false);
  const [tau, setTau] = useState(MARS_TAU.clear);
  const [ventSpeed, setVentSpeed] = useState(600);

  const shower = METEOR_SHOWERS.find((s) => s.id === showerId) ?? METEOR_SHOWERS[0];
  const peak = nextPeak(shower, now);
  const plumeKm = plumeHeightKm(ventSpeed);
  const earthKm = plumeHeightKm(ventSpeed, EARTH_GRAVITY);
  const sunlight = directSunlight(tau);

  const number = (value, digits = 2) =>
    new Intl.NumberFormat(i18n.language, { maximumSignificantDigits: digits }).format(value);
  const peakDate = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long' }).format(peak.date);

  const goTo = (id) => {
    setWorld(id);
    setVisited((was) => (was.includes(id) ? was : [...was, id]));
  };

  const missions = useMemo(
    () => [
      { id: 'next', title: t('lab', 'planetMissionNext'), hint: t('lab', 'planetMissionNextHint'), done: picked && showerId === soonestShower(now) && world === 'earth' },
      { id: 'fastest', title: t('lab', 'planetMissionFastest'), done: showerId === fastestShower() && world === 'earth' },
      { id: 'storm', title: t('lab', 'planetMissionStorm'), hint: t('lab', 'planetMissionStormHint'), done: world === 'mars' && tau >= 10 },
      { id: 'pele', title: t('lab', 'planetMissionPele'), hint: t('lab', 'planetMissionPeleHint'), done: world === 'io' && plumeKm >= 290 },
      { id: 'visitAll', title: t('lab', 'planetMissionVisitAll'), done: visited.length === WORLDS.length },
    ],
    [t, picked, showerId, now, visited, world, tau, plumeKm],
  );

  const factCount = { earth: 6, mars: 5, io: 5 }[world];
  const worldKey = { earth: 'Earth', mars: 'Mars', io: 'Io' }[world];
  const facts = useMemo(
    () =>
      Array.from({ length: factCount }, (_, i) => ({
        text: t('lab', `planetFact${worldKey}${i + 1}`),
        source: t('lab', `planetFactSource${worldKey}${i + 1}`),
      })),
    [t, factCount, worldKey],
  );

  const readout = (label, value) => (
    <div key={label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
      <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="font-mono text-xs text-cyan-300">{value}</dd>
    </div>
  );

  const energy = grainEnergyJ(1, shower.speedKms);
  const lightIntensity = world === 'mars' ? 0.45 + 1.55 * Math.exp(-tau / 4) : 2;

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Globe2 className="text-green-400" /> {t('lab', 'planetaryProcesses')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'planetSubtitle')}</p>
          </div>

          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('lab', 'planetChooseWorld')}>
            {WORLDS.map((w) => (
              <button
                key={w.id}
                onClick={() => goTo(w.id)}
                aria-pressed={world === w.id}
                className={`min-h-[48px] rounded-xl border p-2.5 text-left transition-colors ${
                  world === w.id ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: w.dot }} />
                  {t('lab', w.nameKey)}
                </span>
                <span className="block mt-0.5 text-[11px] leading-tight text-gray-400">{t('lab', w.whatKey)}</span>
              </button>
            ))}
          </div>

          {world === 'earth' ? (
            <>
              <LabPresets
                label={t('lab', 'planetShowerPick')}
                presets={METEOR_SHOWERS.map((s) => ({ id: s.id, label: t('lab', `planetShower${SHOWER_KEY(s.id)}`) }))}
                activeId={showerId}
                onPick={(id) => {
                  setShowerId(id);
                  setPicked(true);
                }}
              />
              <dl className="grid grid-cols-2 gap-2">
                {readout(t('lab', 'planetParent'), t('lab', `planetParent${SHOWER_KEY(shower.id)}`))}
                {readout(
                  t('lab', 'planetPeak'),
                  peak.days === 0
                    ? t('lab', 'planetPeakTonight', { date: peakDate })
                    : t('lab', 'planetPeakIn', { date: peakDate, days: peak.days }),
                )}
                {readout(t('lab', 'planetZhr'), t('lab', 'planetZhrValue', { value: shower.zhr }))}
                {readout(t('lab', 'planetSpeed'), t('lab', 'planetSpeedValue', { value: shower.speedKms }))}
              </dl>
              <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-gray-300">
                {t('lab', 'planetGrainEnergy', {
                  kj: number(energy / 1000),
                  tnt: number(energy / TNT_J_PER_GRAM),
                })}
              </p>
            </>
          ) : null}

          {world === 'mars' ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
                  <span>{t('lab', 'planetTau')}</span>
                  <span className="font-mono text-white whitespace-nowrap">{tau.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={MARS_TAU.min}
                  max={MARS_TAU.max}
                  step="0.1"
                  value={tau}
                  onChange={(e) => setTau(parseFloat(e.target.value))}
                  className="w-full accent-orange-400"
                  aria-label={t('lab', 'planetTau')}
                />
                <div className="flex flex-wrap justify-between gap-2">
                  {[
                    [MARS_TAU.clear, 'planetTauClear'],
                    [MARS_TAU.opportunity, 'planetTauStorm'],
                  ].map(([value, key]) => (
                    <button
                      key={key}
                      onClick={() => setTau(value)}
                      className="min-h-[40px] md:min-h-[32px] px-3 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                    >
                      {t('lab', key)}
                    </button>
                  ))}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {readout(t('lab', 'planetSunlight'), t('lab', 'planetPercentValue', { value: number(sunlight * 100) }))}
                {readout(t('lab', 'planetDimmer'), t('lab', 'planetTimesValue', { value: number(1 / sunlight) }))}
              </dl>
            </>
          ) : null}

          {world === 'io' ? (
            <>
              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
                  <span>{t('lab', 'planetVent')}</span>
                  <span className="font-mono text-white whitespace-nowrap">
                    {t('lab', 'planetVentValue', { value: ventSpeed })}
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1100"
                  step="10"
                  value={ventSpeed}
                  onChange={(e) => setVentSpeed(parseInt(e.target.value, 10))}
                  className="w-full accent-yellow-400"
                  aria-label={t('lab', 'planetVent')}
                />
              </div>
              <dl className="grid grid-cols-2 gap-2">
                {readout(t('lab', 'planetPlumeIo'), t('lab', 'planetKmValue', { value: Math.round(plumeKm) }))}
                {readout(t('lab', 'planetPlumeEarth'), t('lab', 'planetKmValue', { value: Math.round(earthKm) }))}
              </dl>
              <p className="text-xs leading-relaxed text-gray-400">
                {t('lab', 'planetGravityNote', { value: number(EARTH_GRAVITY / IO.gravity) })}
              </p>
            </>
          ) : null}

          <LabMissions prefix="lab_planet_" missions={missions} />
          <LabExplain
            simple={t('lab', `planetExplain${worldKey}`)}
            formula={t('lab', `planetFormula${worldKey}`)}
            details={t('lab', `planetDetails${worldKey}`)}
          />
          <LabFacts key={world} facts={facts} />
          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'planetModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={`${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')}`}>
        {/* What is and is not drawn to scale, on the picture itself. */}
        <div className="absolute top-4 left-4 right-4 z-10 flex pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
            {t('lab', `planetScale${worldKey}`)}
          </span>
        </div>
        <Canvas
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 7], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <FitToViewport height={RADIUS * 2.3} radius={RADIUS * 0.95} elevation={0.02} margin={1.15} />
          <ambientLight intensity={0.06} />
          <directionalLight position={[7, 3, 6]} intensity={lightIntensity} />
          <Stars radius={100} depth={50} count={4000} factor={4} saturation={0} fade speed={1} />

          <Suspense fallback={null}>
            <HologramStage
              height={RADIUS * 2.3}
              radius={RADIUS * 1.1}
              accent={HOLO.accent}
              spin={0}
              float={false}
              plinth={false}
              lighting={false}
            >
              {world === 'earth' ? <EarthScene shower={shower} /> : null}
              {world === 'mars' ? <MarsScene tau={tau} /> : null}
              {world === 'io' ? <IoScene heightKm={plumeKm} /> : null}
            </HologramStage>
          </Suspense>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.4} minDistance={4} maxDistance={20} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={1.2} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}
