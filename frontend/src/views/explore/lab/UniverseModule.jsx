import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Pause, Play, SkipForward, Sparkles } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { FitToViewport, HOLO, HologramStage, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  CLASS_COLOUR,
  SUN_AGE_YEARS,
  fateOf,
  lifeStages,
  mainSequenceLifetimeYears,
  mainSequenceLuminosity,
  massFromSlider,
  outlivesUniverse,
  sliderFromMass,
  spectralClass,
  splitYears,
} from '@/lib/stellarEvolution';

/**
 * The life of a star — and the reason two stars end so differently: mass.
 *
 * The module used to step every star through the same four stages, nebula,
 * star, supernova, black hole, which told a child the Sun will become a black
 * hole. The reader now picks a mass (or a real kind of star) and gets the road
 * that mass really takes, with the numbers that go with it:
 *
 * - a red dwarf burns for trillions of years and has never yet died anywhere;
 * - the Sun becomes a red giant, a planetary nebula, then a white dwarf;
 * - a heavy star becomes a supergiant, explodes, and leaves a neutron star or,
 *   heavier still, a black hole.
 *
 * Lifetimes, luminosities and classes come from `lib/stellarEvolution.js`,
 * which names its sources. The pictures are not to scale — a red supergiant
 * would be a thousand Suns across and a neutron star twenty kilometres — and
 * the page says so.
 *
 * Kept from the old module: the particle table approach (14 000 points at
 * most, which a phone can draw at frame rate) and the shared hologram stage.
 */

const STAGE_SECONDS = 2.6;
const PRESETS = [
  { id: 'redDwarf', mass: 0.12, labelKey: 'uniPresetRedDwarf' },
  { id: 'sun', mass: 1, labelKey: 'uniPresetSun' },
  { id: 'massive', mass: 15, labelKey: 'uniPresetMassive' },
  { id: 'veryMassive', mass: 30, labelKey: 'uniPresetVeryMassive' },
];

const STAGE_KEYS = {
  nebula: 'uniStageNebula',
  mainSequence: 'uniStageMainSequence',
  redGiant: 'uniStageRedGiant',
  planetaryNebula: 'uniStagePlanetaryNebula',
  whiteDwarf: 'uniStageWhiteDwarf',
  redSupergiant: 'uniStageRedSupergiant',
  supernova: 'uniStageSupernova',
  neutronStar: 'uniStageNeutronStar',
  blackHole: 'uniStageBlackHole',
};

const FATE_KEYS = {
  heliumWhiteDwarf: 'uniFateHeliumWhiteDwarf',
  whiteDwarf: 'uniFateWhiteDwarf',
  neutronStar: 'uniFateNeutronStar',
  blackHole: 'uniFateBlackHole',
};

/** Points spread through a ball, a flat ring, or a thin shell. */
function scatter(count, radius, shape) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * 2 * Math.PI;
    let x;
    let y;
    let z;
    if (shape === 'ring') {
      const r = radius * (0.75 + 0.25 * Math.random());
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = (Math.random() - 0.5) * radius * 0.18;
    } else {
      const phi = Math.acos(2 * Math.random() - 1);
      const r = shape === 'shell' ? radius * (0.92 + 0.08 * Math.random()) : radius * Math.cbrt(Math.random());
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi);
    }
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  return pos;
}

function ParticleSystem({ count, color, size, radius, shape = 'ball', opacity = 0.6, spin = 1 }) {
  const positions = useMemo(() => scatter(count, radius, shape), [count, radius, shape]);
  const pointsRef = useRef(null);
  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.06 * spin;
    if (shape !== 'ring') pointsRef.current.rotation.z += delta * 0.03 * spin;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color={color}
        transparent
        opacity={opacity}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** A glowing ball with a soft halo; breathes slightly so it reads as alive. */
function GlowingStar({ colour, radius, intensity = 3, halo = 1.25 }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(state.clock.elapsedTime * 1.3) * 0.015;
    ref.current.scale.setScalar(s);
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={intensity} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * halo, 32, 32]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.18}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** The explosion grows from the core outward for its first few seconds. */
function Supernova() {
  const ref = useRef(null);
  const start = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    if (start.current === null) start.current = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - start.current) / 2.5);
    ref.current.scale.setScalar(0.15 + 0.85 * (1 - (1 - t) ** 3));
  });
  return (
    <group ref={ref}>
      <ParticleSystem count={8000} color="#00f0ff" size={0.035} radius={8} shape="shell" opacity={0.55} />
      <ParticleSystem count={5000} color="#ffd9a0" size={0.05} radius={5} opacity={0.6} />
      <GlowingStar colour="#ffffff" radius={1.4} intensity={8} halo={1.6} />
    </group>
  );
}

/** A pulsar: a tiny ball with two beams sweeping round like a lighthouse. */
function NeutronStar() {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 2.4;
  });
  return (
    <group rotation={[0, 0, 0.35]}>
      <GlowingStar colour="#cfe3ff" radius={0.16} intensity={10} halo={3} />
      <group ref={ref}>
        <group rotation={[0, 0, 0.5]}>
          {[1, -1].map((side) => (
            <mesh key={side} position={[0, side * 2.2, 0]} rotation={[side > 0 ? Math.PI : 0, 0, 0]}>
              <coneGeometry args={[0.45, 4.2, 24, 1, true]} />
              <meshBasicMaterial
                color="#8fd8ff"
                transparent
                opacity={0.22}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

function BlackHole() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <group rotation={[Math.PI / 2.2, 0, 0]}>
        <ParticleSystem count={6000} color="#ffaa00" size={0.02} radius={3.6} shape="ring" spin={3} />
        <ParticleSystem count={3000} color="#ffffff" size={0.035} radius={2.4} shape="ring" spin={4} />
      </group>
      {/* The thin bright rim the Event Horizon Telescope saw around M87*. */}
      <mesh>
        <torusGeometry args={[1.22, 0.035, 12, 96]} />
        <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshBasicMaterial
          color="#ff5500"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

/** Each stage drawn for a star of this mass. Not to scale, by design. */
function StageScene({ stage, mass }) {
  const colour = CLASS_COLOUR[spectralClass(mass)];
  const msRadius = Math.min(2.4, Math.max(0.45, 1.1 * mass ** 0.3));

  switch (stage) {
    case 'nebula':
      return (
        <group>
          <ParticleSystem count={7000} color="#b026ff" size={0.05} radius={5} />
          <ParticleSystem count={3500} color="#00f0ff" size={0.08} radius={3} />
          <ParticleSystem count={1500} color="#ff00aa" size={0.1} radius={1.5} />
        </group>
      );
    case 'mainSequence':
      return <GlowingStar colour={colour} radius={msRadius} intensity={mass < 0.5 ? 2.2 : 3.5} />;
    // Giants get a speckled skin: their surfaces boil in huge convection cells,
    // and a flat disc read as a ball of paint rather than a star.
    case 'redGiant':
      return (
        <group>
          <GlowingStar colour="#ff8a4c" radius={3.1} intensity={1.6} halo={1.15} />
          <ParticleSystem count={2200} color="#ffd0a0" size={0.07} radius={3.13} shape="shell" opacity={0.3} spin={0.3} />
        </group>
      );
    case 'redSupergiant':
      return (
        <group>
          <GlowingStar colour="#ff5a3c" radius={3.9} intensity={1.4} halo={1.1} />
          <ParticleSystem count={2600} color="#ffb48a" size={0.08} radius={3.93} shape="shell" opacity={0.3} spin={0.25} />
        </group>
      );
    case 'planetaryNebula':
      return (
        <group>
          <group rotation={[Math.PI / 2.6, 0, 0.3]}>
            <ParticleSystem count={5000} color="#3ef0d0" size={0.05} radius={3.6} shape="ring" spin={0.4} />
            <ParticleSystem count={2500} color="#ff5fa8" size={0.06} radius={4.2} shape="ring" spin={0.3} />
          </group>
          <ParticleSystem count={1500} color="#9ad8ff" size={0.04} radius={2.6} shape="shell" opacity={0.35} />
          <GlowingStar colour="#e8f1ff" radius={0.2} intensity={9} halo={2.5} />
        </group>
      );
    case 'whiteDwarf':
      return <GlowingStar colour="#e8f1ff" radius={0.24} intensity={9} halo={2.6} />;
    case 'supernova':
      return <Supernova />;
    case 'neutronStar':
      return <NeutronStar />;
    case 'blackHole':
      return <BlackHole />;
    default:
      return null;
  }
}

export function UniverseChangesSimulator() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mass, setMass] = useState(1);
  const [stageIndex, setStageIndex] = useState(1);
  const [playing, setPlaying] = useState(false);

  const stages = useMemo(() => lifeStages(mass), [mass]);
  const at = Math.min(stageIndex, stages.length - 1);
  const stage = stages[at];
  const fate = fateOf(mass);
  const cls = spectralClass(mass);
  const lifetime = mainSequenceLifetimeYears(mass);
  const luminosity = mainSequenceLuminosity(mass);
  const outlives = outlivesUniverse(mass);

  // Plays the rest of the star's life one stage at a time, then stops.
  useEffect(() => {
    if (!playing) return undefined;
    if (at >= stages.length - 1) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setStageIndex(at + 1), STAGE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [playing, at, stages.length]);

  const number = (value) => new Intl.NumberFormat(i18n.language, { maximumSignificantDigits: 2 }).format(value);
  const years = (value) => {
    const { value: scaled, unit } = splitYears(value);
    return t('lab', `uniYears${unit}`, { value: number(Number(scaled)) });
  };

  const pickPreset = (id) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) setMass(preset.mass);
  };
  const activePreset = PRESETS.find((p) => Math.abs(p.mass - mass) / p.mass < 0.01)?.id;

  const missions = useMemo(
    () => [
      { id: 'sunFuture', title: t('lab', 'uniMissionSunFuture'), hint: t('lab', 'uniMissionSunFutureHint'), done: stage === 'whiteDwarf' && fate === 'whiteDwarf' },
      { id: 'outlive', title: t('lab', 'uniMissionOutlive'), hint: t('lab', 'uniMissionOutliveHint'), done: outlives },
      { id: 'neutron', title: t('lab', 'uniMissionNeutron'), done: stage === 'neutronStar' },
      { id: 'shortLife', title: t('lab', 'uniMissionShortLife'), done: lifetime < 1e7 },
      { id: 'blackHole', title: t('lab', 'uniMissionBlackHole'), hint: t('lab', 'uniMissionBlackHoleHint'), done: stage === 'blackHole' },
    ],
    [t, stage, fate, outlives, lifetime],
  );

  const facts = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ text: t('lab', `uniFact${n}`), source: t('lab', `uniFactSource${n}`) })),
    [t],
  );

  const stageDescKey =
    stage === 'whiteDwarf' && fate === 'heliumWhiteDwarf' ? 'uniStageHeliumWhiteDwarfDesc' : `${STAGE_KEYS[stage]}Desc`;

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Sparkles className="text-neon-purple" /> {t('lab', 'universeChanges')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'uniSubtitle')}</p>
          </div>

          <LabPresets
            presets={PRESETS.map((p) => ({ id: p.id, label: t('lab', p.labelKey) }))}
            activeId={activePreset}
            onPick={pickPreset}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
              <span>{t('lab', 'uniMass')}</span>
              <span className="font-mono text-white whitespace-nowrap">{t('lab', 'uniMassValue', { value: number(mass) })}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={Math.round(sliderFromMass(mass) * 1000)}
              onChange={(e) => setMass(massFromSlider(parseInt(e.target.value, 10) / 1000))}
              className="w-full accent-violet-400"
              aria-label={t('lab', 'uniMass')}
            />
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'uniClass')}</dt>
              <dd className="font-mono text-xs text-cyan-300 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CLASS_COLOUR[cls] }} />
                {cls}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'uniLuminosity')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{t('lab', 'uniLuminosityValue', { value: number(luminosity) })}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'uniLifetime')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{years(lifetime)}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'uniFate')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{t('lab', FATE_KEYS[fate])}</dd>
            </div>
          </dl>

          {outlives ? (
            <p className="rounded-xl border border-green-400/30 bg-green-500/10 p-3 text-xs leading-relaxed text-green-100">
              {t('lab', 'uniOutlives')}
            </p>
          ) : null}
          {mass > 0.9 && mass < 1.1 ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
              {t('lab', 'uniSunNow', { age: years(SUN_AGE_YEARS) })}
            </p>
          ) : null}

          <div>
            <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-3">{t('lab', 'uniStages')}</p>
            <ol className="relative border-l-2 border-space-700 ml-3 space-y-4 py-1">
              {stages.map((s, i) => (
                <li key={s} className="relative pl-6">
                  <span
                    className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-space-900 transition-all ${
                      i === at ? 'bg-neon-purple scale-125' : i < at ? 'bg-violet-400/60' : 'bg-space-600'
                    }`}
                  />
                  <button
                    onClick={() => {
                      setPlaying(false);
                      setStageIndex(i);
                    }}
                    aria-current={i === at}
                    className={`w-full min-h-[40px] py-1 text-left transition-colors ${
                      i === at ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <span className="block font-bold">{t('lab', STAGE_KEYS[s])}</span>
                    {i === at ? <span className="block text-sm text-gray-400 mt-1">{t('lab', stageDescKey)}</span> : null}
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={() => {
                  if (at >= stages.length - 1) setStageIndex(0);
                  setPlaying((p) => !p);
                }}
                className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/30"
              >
                {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {t('lab', playing ? 'uniPause' : 'uniPlay')}
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setStageIndex(Math.min(at + 1, stages.length - 1));
                }}
                disabled={at >= stages.length - 1}
                className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" /> {t('lab', 'uniNextStage')}
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/lab/hr')}
            className="flex items-center gap-1.5 min-h-[40px] text-xs text-cyan-300 hover:text-cyan-100"
          >
            {t('lab', 'uniToHr')} <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <LabMissions prefix="lab_universe_" missions={missions} />
          <LabExplain
            simple={t('lab', 'uniExplainSimple')}
            formula={[t('lab', 'uniExplainFormula1'), t('lab', 'uniExplainFormula2')]}
            details={t('lab', 'uniExplainDetails')}
          />
          <LabFacts facts={facts} />
          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'uniModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={`${t('lab', STAGE_KEYS[stage])} — ${t('lab', 'hintDrag')}`}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full pointer-events-none">
          {t('lab', 'uniNotToScale')}
        </div>
        <Canvas
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <FitToViewport height={9} radius={4.2} elevation={0.02} margin={1.12} />
          <ambientLight intensity={0.05} />
          <Stars radius={100} depth={50} count={6000} factor={4} saturation={0.5} fade speed={1} />

          <HologramStage
            height={9}
            radius={4.4}
            accent={HOLO.accent}
            spin={0}
            float={false}
            plinth={false}
            lighting={false}
          >
            <StageScene key={`${stage}-${cls}`} stage={stage} mass={mass} />
          </HologramStage>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={stage === 'supernova' ? 3 : 1.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}
