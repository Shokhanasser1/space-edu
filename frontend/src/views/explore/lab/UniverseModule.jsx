import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Atom, Pause, Play, SkipForward, Sparkles } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { FitToViewport, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import { DotProvider, NEBULA_SECONDS, StageMorph } from './StarLifeScenes';
import { preloadModels } from './ModelKit';
import { BIRTH_MODELS } from './StarBirthScenes';
import { STAR_LIFE_MODELS } from './StarDeathScenes';
import { CRAB_MODELS } from './StarRemnants';
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
 * The scenes are in `StarLifeScenes.jsx`: each stage morphs into the next the
 * way the star really changes, the life starts with a cloud collapsing into a
 * protostar. How the star shines - the fusion in its core - has a module of
 * its own (`FusionModule.jsx`), linked from the main sequence. The hologram
 * rings the lab's other
 * models stand in are left out here: they framed the star in a cage and made
 * a living star read as a diagram.
 */

/** How long Play lingers on each stage: the birth needs longer. */
const STAGE_SECONDS = { nebula: NEBULA_SECONDS + 1.5, mainSequence: 5.5, supernova: 4.5 };
const DEFAULT_STAGE_SECONDS = 4;
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

/** What the viewer says while one stage turns into the next. */
const MORPH_KEYS = {
  'nebula>mainSequence': 'uniMorphIgnite',
  'mainSequence>redGiant': 'uniMorphSwell',
  'mainSequence>redSupergiant': 'uniMorphSwell',
  'mainSequence>whiteDwarf': 'uniMorphDwarf',
  'redGiant>planetaryNebula': 'uniMorphShed',
  'planetaryNebula>whiteDwarf': 'uniMorphFade',
  'redSupergiant>supernova': 'uniMorphCollapse',
  'supernova>neutronStar': 'uniMorphRemnant',
  'supernova>blackHole': 'uniMorphRemnant',
};

/** What the viewer says during each part of a stage that tells a story. */
const PHASE_KEYS = {
  nebula: { pillars: 'uniNebulaPillars', cloud: 'uniNebulaCloud', collapse: 'uniNebulaCollapse', protostar: 'uniNebulaProtostar' },
  supernova: { blast: 'uniSupernovaBlast', remnant: 'uniSupernovaRemnant' },
  planetaryNebula: { helix: 'uniPlanetaryHelix' },
  neutronStar: { crab: 'uniPulsarCrab' },
};

const FATE_KEYS = {
  heliumWhiteDwarf: 'uniFateHeliumWhiteDwarf',
  whiteDwarf: 'uniFateWhiteDwarf',
  neutronStar: 'uniFateNeutronStar',
  blackHole: 'uniFateBlackHole',
};

export function UniverseChangesSimulator() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mass, setMass] = useState(1);
  // The life starts where a star does: in a cloud.
  const [stageIndex, setStageIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  // The birth opens on the Pillars of Creation; the scene reports later phases.
  const [phase, setPhase] = useState({ stage: 'nebula', name: 'pillars' });
  const [morph, setMorph] = useState(null);

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
    const timer = setTimeout(() => setStageIndex(at + 1), (STAGE_SECONDS[stage] ?? DEFAULT_STAGE_SECONDS) * 1000);
    return () => clearTimeout(timer);
  }, [playing, at, stage, stages.length]);


  // Fetch every stage's model up front (about 1.6 MB in all), so a stage
  // opens complete rather than filling in.
  useEffect(() => {
    preloadModels([...BIRTH_MODELS.pillars, ...BIRTH_MODELS.dgTau, ...Object.values(STAR_LIFE_MODELS), ...CRAB_MODELS]);
  }, []);

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
          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'uniModelCredits')}</p>
        </div>
      </div>

      <LabViewport hint={`${t('lab', STAGE_KEYS[stage])} — ${t('lab', 'hintDrag')}`}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full pointer-events-none">
          {t('lab', 'uniNotToScale')}
        </div>

        {stage === 'mainSequence' ? (
          <button
            onClick={() => navigate('/lab/fusion')}
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold bg-amber-400/20 border border-amber-300/50 text-amber-50 hover:bg-amber-400/30 backdrop-blur-md"
          >
            <Atom className="w-4 h-4" /> {t('lab', 'uniToFusion')}
          </button>
        ) : null}

        <ViewerCaption t={t} stage={stage} morph={morph} phase={phase?.stage === stage ? phase.name : null} />

        <Canvas
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <FitToViewport height={9} radius={4.2} elevation={0.02} margin={1.12} />
          <ambientLight intensity={0.05} />
          <DotProvider>
            <Stars radius={100} depth={50} count={6000} factor={4} saturation={0.5} fade speed={1} />
            <StageMorph stage={stage} mass={mass} onPhase={setPhase} onMorph={setMorph} />
          </DotProvider>

          <OrbitControls enablePan={false} autoRotate autoRotateSpeed={0.8} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={stage === 'supernova' ? 3 : stage === 'blackHole' ? 0.8 : 1.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}

/**
 * The line under the picture: what is happening right now. During a morph it
 * names the change; in a stage that tells a story - the birth in the
 * nebula, the blast and its remnant - it follows that story.
 */
function ViewerCaption({ t, stage, morph, phase }) {
  const box =
    'absolute left-4 right-4 bottom-14 z-10 md:right-auto md:max-w-sm rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3 text-xs leading-relaxed text-gray-200 pointer-events-none';

  if (morph && MORPH_KEYS[morph]) {
    return (
      <div className={box} aria-live="polite">
        <p className="text-amber-100">{t('lab', MORPH_KEYS[morph])}</p>
      </div>
    );
  }

  const keys = PHASE_KEYS[stage];
  if (keys && phase && keys[phase]) {
    const phases = Object.keys(keys);
    return (
      <div className={box} aria-live="polite">
        {stage === 'nebula' ? (
          <p className="text-[10px] uppercase tracking-widest text-pink-200">
            {t('lab', 'uniNebulaStep', { n: phases.indexOf(phase) + 1, of: phases.length })}
          </p>
        ) : null}
        <p className={stage === 'nebula' ? 'mt-1' : ''}>{t('lab', keys[phase])}</p>
      </div>
    );
  }

  return null;
}
