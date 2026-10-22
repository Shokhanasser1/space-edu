import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Atom, Layers, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { FitToViewport, ReleaseContextOnUnmount } from './Hologram';
import { LAB_DPR, LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import { DotProvider, mainSequenceRadius } from './SceneKit';
import {
  CutawayStar,
  FusionCore,
  GAMMA_COLOUR,
  LAYER_COLOUR,
  NEUTRINO_COLOUR,
  NEUTRON_COLOUR,
  POSITRON_COLOUR,
  PROTON_COLOUR,
  fusionChain,
  starLayers,
  structureOf,
} from './FusionScenes';
import {
  CLASS_COLOUR,
  mainSequenceLuminosity,
  massFromSlider,
  sliderFromMass,
  spectralClass,
} from '@/lib/stellarEvolution';

/**
 * Inside a star: how it shines.
 *
 * This used to be a button inside Life of a Star, and it was too much for one
 * stage of another module: the reactions deserve their own controls, and a
 * reader following a star from cloud to remnant does not need a nuclear
 * physics lesson in the middle of it. Here it has two views:
 *
 * - **The star cut open.** Core, radiative and convective zones as they lie
 *   for the chosen mass - a red dwarf churns all the way through, the Sun has
 *   a radiative zone under a convective one, a heavy star the other way round.
 * - **The core.** The proton-proton chain and the CNO cycle, played nucleus by
 *   nucleus. Both run in every star; the one that makes most of the energy is
 *   marked. The reader can pause, change the speed, and step through.
 *
 * The figures in the facts and the explanation (0.7 % of the mass, 26.7 MeV,
 * 600 million tonnes a second) are the standard textbook values and are
 * sourced on the page. The Sun counter uses that same 600 million tonnes.
 */

const PRESETS = [
  { id: 'redDwarf', mass: 0.2, labelKey: 'fusPresetRedDwarf' },
  { id: 'sun', mass: 1, labelKey: 'fusPresetSun' },
  { id: 'sirius', mass: 2.1, labelKey: 'fusPresetSirius' },
  { id: 'massive', mass: 15, labelKey: 'fusPresetMassive' },
];

const PP_STEPS = ['fusPp1', 'fusPp2', 'fusPp3', 'fusPpNet'];
const CNO_STEPS = ['fusCno1', 'fusCno2', 'fusCno3', 'fusCno4', 'fusCno5', 'fusCno6', 'fusCnoNet'];
const SPEEDS = [0.5, 1, 2];

const LAYER_KEYS = {
  core: 'fusLayerCore',
  convectiveCore: 'fusLayerConvectiveCore',
  radiative: 'fusLayerRadiative',
  convective: 'fusLayerConvective',
};

const STRUCTURE_KEYS = {
  fullyConvective: 'fusStructureFullyConvective',
  radiativeCore: 'fusStructureRadiativeCore',
  convectiveCore: 'fusStructureConvectiveCore',
};

/** Hydrogen the Sun turns into helium, tonnes per second (NASA). */
const SUN_TONNES_PER_SECOND = 6e8;

export function FusionLab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [mass, setMass] = useState(1);
  const [view, setView] = useState('structure');
  const [chain, setChain] = useState(() => fusionChain(1));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [step, setStep] = useState(0);
  const [seek, setSeek] = useState(null);
  const [finished, setFinished] = useState({ pp: false, cno: false });
  const [structuresSeen, setStructuresSeen] = useState(() => new Set(['radiativeCore']));
  const [sunSeconds, setSunSeconds] = useState(0);

  const cls = spectralClass(mass);
  const luminosity = mainSequenceLuminosity(mass);
  const mainChain = fusionChain(mass);
  const structure = structureOf(mass);
  const layers = starLayers(mass);
  const steps = chain === 'cno' ? CNO_STEPS : PP_STEPS;
  const at = Math.min(step, steps.length - 1);

  // The Sun keeps fusing while the page is open; count it.
  useEffect(() => {
    const opened = Date.now();
    const timer = setInterval(() => setSunSeconds((Date.now() - opened) / 1000), 200);
    return () => clearInterval(timer);
  }, []);

  const pickMass = (value) => {
    setMass(value);
    const kind = structureOf(value);
    setStructuresSeen((seen) => (seen.has(kind) ? seen : new Set([...seen, kind])));
  };

  const pickChain = (next) => {
    setChain(next);
    setStep(0);
    setSeek({ step: 0, n: Date.now() });
  };

  const onStep = (s) => {
    setStep(s);
    const last = (chain === 'cno' ? CNO_STEPS : PP_STEPS).length - 1;
    if (s === last) setFinished((f) => (f[chain] ? f : { ...f, [chain]: true }));
  };

  const goToStep = (s) => {
    setStep(s);
    setSeek({ step: s, n: Date.now() });
  };

  const number = (value, options = { maximumSignificantDigits: 2 }) =>
    new Intl.NumberFormat(i18n.language, options).format(value);

  const labels = useMemo(
    () => ({
      p: t('lab', 'fusSymP'),
      d: t('lab', 'fusSymD'),
      he3: t('lab', 'fusSymHe3'),
      he4: t('lab', 'fusSymHe4'),
      positron: t('lab', 'fusSymPositron'),
      neutrino: t('lab', 'fusSymNeutrino'),
      gamma: t('lab', 'fusSymGamma'),
      energy: t('lab', 'fusSymEnergy'),
      c12: t('lab', 'fusSymC12'),
      n13: t('lab', 'fusSymN13'),
      c13: t('lab', 'fusSymC13'),
      n14: t('lab', 'fusSymN14'),
      o15: t('lab', 'fusSymO15'),
      n15: t('lab', 'fusSymN15'),
    }),
    [t],
  );

  const missions = useMemo(
    () => [
      { id: 'ppChain', title: t('lab', 'fusMissionPp'), hint: t('lab', 'fusMissionPpHint'), done: finished.pp },
      { id: 'cnoCycle', title: t('lab', 'fusMissionCno'), hint: t('lab', 'fusMissionCnoHint'), done: finished.cno },
      {
        id: 'layers',
        title: t('lab', 'fusMissionLayers'),
        hint: t('lab', 'fusMissionLayersHint'),
        done: structuresSeen.has('fullyConvective') && structuresSeen.has('convectiveCore'),
      },
    ],
    [t, finished, structuresSeen],
  );

  const facts = useMemo(
    () => [1, 2, 3, 4, 5, 6, 7].map((n) => ({ text: t('lab', `fusFact${n}`), source: t('lab', `fusFactSource${n}`) })),
    [t],
  );

  const activePreset = PRESETS.find((p) => Math.abs(p.mass - mass) / p.mass < 0.01)?.id;
  const colour = CLASS_COLOUR[cls];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Atom className="text-amber-300" /> {t('lab', 'fusTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'fusSubtitle')}</p>
          </div>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('lab', 'fusView')}>
            {[
              ['structure', 'fusViewStructure'],
              ['reactions', 'fusViewReactions'],
            ].map(([id, key]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-pressed={view === id}
                className={`flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  view === id
                    ? 'bg-amber-400/20 border-amber-300/50 text-amber-50'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {id === 'structure' ? <Layers className="w-4 h-4" /> : <Atom className="w-4 h-4" />} {t('lab', key)}
              </button>
            ))}
          </div>

          <LabPresets
            presets={PRESETS.map((p) => ({ id: p.id, label: t('lab', p.labelKey) }))}
            activeId={activePreset}
            onPick={(id) => {
              const preset = PRESETS.find((p) => p.id === id);
              if (preset) pickMass(preset.mass);
            }}
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-gray-400">
              <span>{t('lab', 'fusMass')}</span>
              <span className="font-mono text-white whitespace-nowrap">{t('lab', 'fusMassValue', { value: number(mass) })}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1000"
              step="1"
              value={Math.round(sliderFromMass(mass) * 1000)}
              onChange={(e) => pickMass(massFromSlider(parseInt(e.target.value, 10) / 1000))}
              className="w-full accent-amber-400"
              aria-label={t('lab', 'fusMass')}
            />
          </div>

          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'fusClass')}</dt>
              <dd className="font-mono text-xs text-cyan-300 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colour }} />
                {cls}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'fusLuminosity')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{t('lab', 'fusLuminosityValue', { value: number(luminosity) })}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'fusMainReaction')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{t('lab', mainChain === 'cno' ? 'fusReactionCno' : 'fusReactionPp')}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2.5">
              <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{t('lab', 'fusStructure')}</dt>
              <dd className="font-mono text-xs text-cyan-300">{t('lab', STRUCTURE_KEYS[structure])}</dd>
            </div>
          </dl>

          {view === 'reactions' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('lab', 'fusReaction')}>
                {['pp', 'cno'].map((id) => (
                  <button
                    key={id}
                    onClick={() => pickChain(id)}
                    aria-pressed={chain === id}
                    className={`relative min-h-[40px] px-3 py-2 rounded-lg text-xs border transition-colors ${
                      chain === id
                        ? 'bg-violet-500/20 border-violet-400/50 text-violet-50'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {t('lab', id === 'cno' ? 'fusReactionCno' : 'fusReactionPp')}
                    {mainChain === id ? (
                      <span className="block text-[10px] text-amber-200">{t('lab', 'fusMainHere')}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              <ol className="space-y-1.5">
                {steps.map((key, i) => (
                  <li key={key}>
                    <button
                      onClick={() => goToStep(i)}
                      aria-current={i === at}
                      className={`w-full min-h-[40px] text-left rounded-xl border px-3 py-2 transition-colors ${
                        i === at ? 'border-amber-300/50 bg-amber-400/10' : 'border-white/5 bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <span className={`block font-mono text-xs ${i === at ? 'text-white' : 'text-gray-400'}`}>
                        {t('lab', key)}
                      </span>
                      {i === at ? <span className="block mt-1 text-xs leading-relaxed text-gray-300">{t('lab', `${key}Desc`)}</span> : null}
                    </button>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => goToStep((at - 1 + steps.length) % steps.length)}
                  aria-label={t('lab', 'fusPrevStep')}
                  className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/30"
                >
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {t('lab', playing ? 'fusPause' : 'fusPlay')}
                </button>
                <button
                  onClick={() => goToStep((at + 1) % steps.length)}
                  aria-label={t('lab', 'fusNextStep')}
                  className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1 ml-auto" role="group" aria-label={t('lab', 'fusSpeed')}>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpeed(s)}
                      aria-pressed={speed === s}
                      className={`min-h-[40px] px-2.5 rounded-lg text-xs font-mono border ${
                        speed === s ? 'border-amber-300/60 text-amber-100 bg-amber-400/15' : 'border-white/10 text-gray-400 bg-white/5'
                      }`}
                    >
                      {t('lab', 'fusSpeedValue', { value: number(s) })}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-gray-300">{t('lab', 'fusCutawayNote')}</p>
              <ul className="space-y-1.5">
                {layers.map((layer) => (
                  <li key={layer.kind} className="flex items-center gap-2 text-xs text-gray-200">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: LAYER_COLOUR[layer.kind] }}
                    />
                    {t('lab', LAYER_KEYS[layer.kind])}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
            {t('lab', 'fusSunCounter', {
              tonnes: number(sunSeconds * SUN_TONNES_PER_SECOND, { notation: 'compact', maximumSignificantDigits: 3 }),
            })}
          </p>

          <button
            onClick={() => navigate('/lab/universe')}
            className="flex items-center gap-1.5 min-h-[40px] text-xs text-cyan-300 hover:text-cyan-100"
          >
            {t('lab', 'fusToLife')} <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <LabMissions prefix="lab_fusion_" missions={missions} />
          <LabExplain
            simple={t('lab', 'fusExplainSimple')}
            formula={[t('lab', 'fusExplainFormula1'), t('lab', 'fusExplainFormula2')]}
            details={t('lab', 'fusExplainDetails')}
          />
          <LabFacts facts={facts} />
          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'fusModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={`${t('lab', view === 'reactions' ? 'fusCoreTitle' : 'fusViewStructure')} — ${t('lab', 'hintDrag')}`}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-amber-100 bg-amber-500/15 border border-amber-400/30 px-3 py-1.5 rounded-full pointer-events-none">
          {t('lab', 'uniNotToScale')}
        </div>

        {view === 'reactions' ? (
          <div
            className="absolute left-4 right-4 bottom-14 z-10 md:right-auto md:max-w-sm rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-3 text-xs text-gray-200 pointer-events-none"
            aria-live="polite"
          >
            <p className="text-[10px] uppercase tracking-widest text-amber-200">
              {t('lab', chain === 'cno' ? 'fusCnoTitle' : 'fusPpTitle')}
            </p>
            <div className="flex gap-1 my-2" aria-hidden="true">
              {steps.map((key, i) => (
                <span
                  key={key}
                  className={`h-1 flex-1 rounded-full ${i === at ? 'bg-amber-300' : i < at ? 'bg-amber-300/40' : 'bg-white/10'}`}
                />
              ))}
            </div>
            <p className="font-mono text-sm text-white">{t('lab', steps[at])}</p>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
              {[
                [PROTON_COLOUR, 'fusLegendProton'],
                [NEUTRON_COLOUR, 'fusLegendNeutron'],
                [POSITRON_COLOUR, 'fusLegendPositron'],
                [NEUTRINO_COLOUR, 'fusLegendNeutrino'],
                [GAMMA_COLOUR, 'fusLegendGamma'],
              ].map(([c, key]) => (
                <li key={key} className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: c }} />
                  {t('lab', key)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Canvas
          dpr={LAB_DPR}
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          {view === 'reactions' ? (
            <FitToViewport key="core" height={8.6} radius={3.9} azimuth={0} elevation={0} margin={1.05} />
          ) : (
            <FitToViewport key="star" height={7} radius={2.9} azimuth={0} elevation={0.05} margin={1.15} />
          )}
          <ambientLight intensity={0.05} />
          <DotProvider>
            {view === 'reactions' ? (
              <FusionCore
                key={chain}
                chain={chain}
                playing={playing}
                speed={speed}
                seek={seek}
                onStep={onStep}
                labels={labels}
              />
            ) : (
              <>
                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.5} fade speed={1} />
                <CutawayStar
                  key={structure}
                  mass={mass}
                  colour={colour}
                  radius={mainSequenceRadius(mass) * 1.25}
                  intensity={mass < 0.5 ? 2.2 : 3}
                />
              </>
            )}
          </DotProvider>
          <OrbitControls key={view} enablePan={false} minDistance={4} maxDistance={30} />
          <EffectComposer>
            <Bloom luminanceThreshold={1} mipmapBlur intensity={view === 'reactions' ? 1.1 : 1.4} />
            <Vignette eskil={false} offset={0.1} darkness={1.1} />
          </EffectComposer>
        </Canvas>
      </LabViewport>
    </div>
  );
}
