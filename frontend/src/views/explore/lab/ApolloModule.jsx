import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Focus, HelpCircle, Layers, Pause, Play, Rocket, Ruler } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  APOLLO_FACTS,
  SATURN_V,
  SATURN_V_STACK,
  SIZE_COMPARISONS,
  explodeOffsetM,
  readFact,
} from './labFacts';
import { FitToViewport, HOLO, HoloLabel, ReleaseContextOnUnmount } from './Hologram';
import { BASE_Y, HEIGHT, RADIUS, SCALE, SaturnV, partBounds } from './SaturnVModel';
import { ComparisonModel } from './LandmarkModels';

/**
 * Apollo: the Saturn V you can take apart, look at up close, and stand beside
 * things you know.
 *
 * What was here before: nothing. `RocketEngineeringLab` - the only module in
 * the lab where a rocket came apart, and the only one offering a capsule
 * instead of a satellite fairing - was 130 lines of code that no branch ever
 * rendered. Ticket 12 put the rocket back, as the vehicle the ticket names,
 * with figures that have a source printed beside them.
 *
 * What the October 2026 passes added, and why:
 *
 * - **Something to compare it with.** "110.6 m" means nothing to a ten-year-old.
 *   A person, NASA's own two comparisons (a 36-storey building, the Statue of
 *   Liberty) and Tashkent's TV tower stand beside the rocket at the same
 *   scale, as models (`LandmarkModels.jsx`).
 * - **The real rocket, not a hologram.** Readers found the glowing wireframe
 *   unlike the thing they had seen in photographs. The model is painted and
 *   lit by a sun now (`SaturnVModel.jsx`), with no bloom to wash it out.
 * - **A closer look.** Opened up, a part can be picked and the camera flies to
 *   it: everything else fades, the part turns on its own, and the reader can
 *   drag round it all the way and zoom in - the engines from underneath, the
 *   Lunar Module inside its opened adapter.
 * - **Goals.** Missions, a one-question quiz ("only one part came home -
 *   which?") and the shared kit's explanation and facts.
 * - **Labels that stay readable.** They are in world space beside the stack;
 *   the stack is round, so a fixed label still points at the right part.
 *
 * Every number shown here comes from `labFacts.js`. Nothing is computed from a
 * control on the page.
 */

/** Opened at least this far, picking a part flies the camera to it. */
const FOCUS_FROM = 0.3;

/** Turntable speeds, radians a second: the whole stack, and one part close up. */
const SPIN_WHOLE = 0.12;
const SPIN_FOCUS = 0.45;

/** Turns its children about the vertical axis while `spinning`. */
function Turntable({ spinning, speed, children }) {
  const ref = useRef(null);
  useFrame((_, delta) => {
    if (spinning && ref.current) ref.current.rotation.y += delta * speed;
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * Flies the orbit controls' target and the camera's distance to `focus`, or
 * back to the middle of the scene, then lets go so the reader's dragging owns
 * the camera again. It keeps the direction the camera was looking from, so
 * the move reads as zooming in rather than as a jump.
 */
function CameraRig({ focus }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const goal = useRef(null);
  const key = focus ? `${focus.centre.join(',')}|${focus.height}|${focus.width}` : 'whole';

  useEffect(() => {
    if (!camera?.isPerspectiveCamera) return;
    if (!focus) {
      goal.current = { target: new THREE.Vector3(0, 0, 0), distance: null };
      return;
    }
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * (camera.aspect || 1));
    const distance = Math.max(
      (focus.height * 1.4) / (2 * Math.tan(vertical / 2)),
      (focus.width * 1.5) / (2 * Math.tan(horizontal / 2)),
      0.6,
    );
    goal.current = { target: new THREE.Vector3(...focus.centre), distance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, camera]);

  useFrame((_, delta) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-delta * 4);
    const offset = camera.position.clone().sub(controls.target);
    controls.target.lerp(g.target, k);
    let length = offset.length();
    if (g.distance) length += (g.distance - length) * k;
    camera.position.copy(controls.target).add(offset.setLength(length));
    controls.update();
    const arrived = controls.target.distanceTo(g.target) < 0.002;
    if (arrived && (!g.distance || Math.abs(length - g.distance) < 0.01)) goal.current = null;
  });

  return null;
}

/**
 * The part labels, in world space beside the stack. `oneSide` puts them all on
 * the right, which is where they go while something stands on the left.
 */
function StackLabels({ t, explode, oneSide }) {
  return (
    <>
      {SATURN_V_STACK.map((part, index) => {
        const top = part.sections[part.sections.length - 1];
        const bottom = part.sections[0];
        const middle = ((bottom.fromM + top.toM) / 2) * SCALE - HEIGHT / 2;
        const widest = Math.max(...part.sections.map((s) => s.bottomRadiusM)) * SCALE;
        const side = oneSide || index % 2 === 0 ? 1 : -1;
        const reach = part.id === 's-ic' ? 0.8 : widest * 1.25 + 0.12;
        return (
          <HoloLabel
            key={part.id}
            position={[reach * side, middle + explodeOffsetM(index, explode) * SCALE, 0]}
            side={side}
            accent={part.accent}
            title={t('lab', part.nameKey)}
            subtitle={t('lab', part.roleKey)}
          />
        );
      })}
    </>
  );
}

/** Why each wrong answer to "which part brought the crew home?" is wrong. */
const QUIZ_WHY = {
  's-ic': 'apolloQuizWhySic',
  's-ii': 'apolloQuizWhySii',
  's-ivb': 'apolloQuizWhySivb',
  les: 'apolloQuizWhyLes',
};

/** The comparison label's colour: warm, so it never reads as part of the rocket. */
const COMPARE_ACCENT = HOLO.accentWarm;

/**
 * How to frame rocket and comparison together: the frame runs from the
 * rocket's base to whichever top is higher, and the scene is shifted so that
 * span is centred where FitToViewport looks.
 */
function frameFor(explode, comparison) {
  const rocketTop = HEIGHT / 2 + explodeOffsetM(SATURN_V_STACK.length - 1, explode) * SCALE;
  const compareTop = comparison?.heightM ? BASE_Y + comparison.heightM * SCALE : -Infinity;
  const top = Math.max(rocketTop, compareTop);
  const height = top - BASE_Y;
  const compareHalfWidth = comparison?.widthM ? (comparison.widthM * SCALE) / 2 : 0;
  const compareX = comparison?.heightM ? -(RADIUS * 2.2 + compareHalfWidth + 0.4) : 0;
  return {
    height,
    shift: -(BASE_Y + top) / 2,
    compareX,
    // Room for the comparison's label too, which hangs off its left side.
    radius: Math.max(RADIUS, (Math.abs(compareX) + compareHalfWidth + (comparison?.heightM ? 1.4 : 0)) / 1.6),
  };
}

export const ApolloHologramModule = () => {
  const { t } = useTranslation();
  const [activePart, setActivePart] = useState('s-ic');
  const [visited, setVisited] = useState(() => new Set(['s-ic']));
  const [explode, setExplode] = useState(0);
  const [compareId, setCompareId] = useState('none');
  const [homeGuess, setHomeGuess] = useState(null);
  const [focusPart, setFocusPart] = useState(null);
  const [lookedClose, setLookedClose] = useState(false);
  const [spinning, setSpinning] = useState(true);
  // Remounts FitToViewport on the way back from a close-up, so the whole
  // stack is framed again.
  const [viewKey, setViewKey] = useState(0);

  const visit = (id) => {
    setActivePart(id);
    setVisited((seen) => (seen.has(id) ? seen : new Set([...seen, id])));
  };

  const focusOn = (id) => {
    visit(id);
    setExplode((e) => Math.max(e, 0.6));
    setFocusPart(id);
    setLookedClose(true);
    setSpinning(true);
  };

  const leaveFocus = () => {
    setFocusPart(null);
    setViewKey((k) => k + 1);
  };

  // Picking a part in the opened-up stack flies to it; in the closed stack it
  // only opens its card.
  const selectPart = (id) => {
    if (explode >= FOCUS_FROM) focusOn(id);
    else visit(id);
  };

  // Closing the stack again ends a close-up.
  useEffect(() => {
    if (focusPart && explode < FOCUS_FROM) {
      setFocusPart(null);
      setViewKey((k) => k + 1);
    }
  }, [explode, focusPart]);

  const comparison = SIZE_COMPARISONS.find((c) => c.id === compareId) ?? SIZE_COMPARISONS[0];
  const frame = frameFor(explode, comparison);
  const homeRight = homeGuess === 'spacecraft';
  const bounds = focusPart ? partBounds(focusPart, explode) : null;
  const focus = bounds ? { centre: [0, frame.shift + bounds.centreY, 0], height: bounds.height, width: bounds.width } : null;
  const focusEntry = SATURN_V_STACK.find((part) => part.id === focusPart);

  const missions = useMemo(
    () => [
      {
        id: 'parts',
        title: t('lab', 'apolloMissionParts'),
        hint: t('lab', 'apolloMissionPartsHint', { n: visited.size, total: SATURN_V_STACK.length }),
        done: visited.size === SATURN_V_STACK.length,
      },
      { id: 'explode', title: t('lab', 'apolloMissionExplode'), done: explode >= 0.95 },
      { id: 'home', title: t('lab', 'apolloMissionHome'), done: homeRight },
      { id: 'compare', title: t('lab', 'apolloMissionCompare'), done: compareId !== 'none' },
      { id: 'closeup', title: t('lab', 'apolloMissionCloseup'), done: lookedClose },
    ],
    [t, visited, explode, homeRight, compareId, lookedClose],
  );

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-4 md:overflow-y-auto">
        <div className="glass p-5 rounded-2xl space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Rocket className="text-neon-blue" /> {t('lab', 'apolloTitle')}
            </h3>
            <p className="text-xs leading-relaxed text-gray-400">{t('lab', 'apolloSubtitle')}</p>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            {SATURN_V.facts.map((fact) => {
              const { label, value } = readFact(fact, t);
              return (
                <div
                  key={fact.key}
                  className={`rounded-xl border border-white/10 bg-black/30 p-2.5 ${
                    fact.key === 'apolloFactFlight' ? 'col-span-2' : ''
                  }`}
                >
                  <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</dt>
                  <dd className="font-mono text-xs text-cyan-300">{value}</dd>
                </div>
              );
            })}
          </dl>

          <LabPresets
            label={t('lab', 'apolloCompareTitle')}
            presets={SIZE_COMPARISONS.map((c) => ({ id: c.id, label: t('lab', c.labelKey) }))}
            activeId={compareId}
            onPick={setCompareId}
          />
          {comparison.noteKey ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-100">
                <Ruler className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                {t('lab', comparison.noteKey)}
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                {t('lab', 'apolloCompareSketch')}
                {comparison.source ? ` ${t('lab', 'apolloSource')}: ${comparison.source}` : ''}
                {comparison.modelCredit ? ` ${comparison.modelCredit}.` : ''}
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> {t('lab', 'apolloExplode')}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={explode}
              onChange={(e) => setExplode(parseFloat(e.target.value))}
              className="w-full h-10 accent-neon-blue"
              aria-label={t('lab', 'apolloExplode')}
            />
            <p className="text-[11px] leading-relaxed text-gray-500">{t('lab', 'apolloFocusTip')}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('lab', 'apolloPartsTitle')}</p>
            {SATURN_V_STACK.map((entry) => {
              const open = activePart === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`rounded-xl border transition-all ${
                    open ? 'border-neon-blue bg-neon-blue/10' : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <button
                    onClick={() => selectPart(entry.id)}
                    aria-expanded={open}
                    className="w-full text-left p-3 flex items-start gap-3"
                  >
                    <span
                      className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: entry.accent }}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="block text-sm font-bold">{t('lab', entry.nameKey)}</span>
                      <span className="block text-xs text-gray-400">{t('lab', entry.roleKey)}</span>
                    </span>
                  </button>
                  {open ? (
                    <div className="px-3 pb-3">
                      <button
                        onClick={() => focusOn(entry.id)}
                        className="mb-3 w-full min-h-[40px] flex items-center justify-center gap-2 rounded-lg bg-neon-blue/15 border border-neon-blue/50 text-xs font-semibold text-cyan-100 hover:bg-neon-blue/25"
                      >
                        <Focus className="w-4 h-4" /> {t('lab', 'apolloFocusButton')}
                      </button>
                      <dl className="space-y-1.5 border-t border-white/10 pt-2.5">
                        {entry.facts.map((fact) => {
                          const { label, value } = readFact(fact, t);
                          return (
                            <div key={fact.key} className="flex justify-between gap-3 text-xs">
                              <dt className="text-gray-400 shrink-0">{label}</dt>
                              <dd className="text-right text-gray-200">{value}</dd>
                            </div>
                          );
                        })}
                      </dl>
                      <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
                        {t('lab', 'apolloSource')}: {entry.source}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <section className="glass p-4 rounded-2xl border border-white/10">
          <h4 className="flex items-center gap-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-300">
            <HelpCircle className="w-3.5 h-3.5 text-neon-blue" /> {t('lab', 'apolloQuizTitle')}
          </h4>
          <p className="text-sm text-white mb-3">{t('lab', 'apolloQuizQuestion')}</p>
          <div className="flex flex-wrap gap-2">
            {SATURN_V_STACK.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setHomeGuess(entry.id)}
                aria-pressed={homeGuess === entry.id}
                className={`min-h-[40px] px-3 py-2 rounded-full text-xs border transition-colors ${
                  homeGuess === entry.id
                    ? entry.id === 'spacecraft'
                      ? 'bg-green-500/20 border-green-400 text-green-100'
                      : 'bg-amber-500/20 border-amber-400 text-amber-100'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                {t('lab', entry.nameKey)}
              </button>
            ))}
          </div>
          {homeGuess ? (
            <p role="status" className={`mt-3 text-xs leading-relaxed ${homeRight ? 'text-green-300' : 'text-amber-200'}`}>
              {homeRight
                ? t('lab', 'apolloQuizRight')
                : `${t('lab', 'apolloQuizWrong')} ${t('lab', QUIZ_WHY[homeGuess])}`}
            </p>
          ) : null}
        </section>

        <LabMissions prefix="lab_apollo_" missions={missions} />
        <LabExplain
          simple={t('lab', 'apolloExplainSimple')}
          formula={[t('lab', 'apolloExplainFormula1'), t('lab', 'apolloExplainFormula2')]}
          details={t('lab', 'apolloExplainDetails')}
        />
        <LabFacts facts={APOLLO_FACTS.map((fact) => ({ text: t('lab', fact.key), source: fact.source }))} />
        <p className="px-1 text-[10px] leading-relaxed text-gray-500">{t('lab', 'apolloModelNote')}</p>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas
          camera={{ position: [4, 1.5, 17], fov: 42, near: 0.05 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          {/* The frame grows with the opened stack and with whatever stands
              beside it, or the escape tower - or the TV tower - leaves the top
              of the frame. Not while a part is close up: CameraRig owns the
              camera then. */}
          {focus ? null : <FitToViewport key={viewKey} height={frame.height} radius={frame.radius} />}
          <CameraRig focus={focus} />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.6} />

          {/* Daylight: a sun, a sky above and dark ground below. */}
          <ambientLight intensity={0.25} />
          <hemisphereLight args={['#c9dcff', '#1b1e24', 0.65]} />
          <directionalLight position={[9, 14, 12]} intensity={2.6} />
          <directionalLight position={[-8, 5, -9]} intensity={0.5} color="#9db8ff" />

          <group position={[0, frame.shift, 0]}>
            <mesh position={[0, BASE_Y - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[30, 64]} />
              <meshStandardMaterial color="#14171c" roughness={1} />
            </mesh>
            <mesh position={[0, BASE_Y - 0.005, 0]}>
              <cylinderGeometry args={[1.2, 1.3, 0.02, 48]} />
              <meshStandardMaterial color="#3a3d43" roughness={0.9} />
            </mesh>
            <Turntable spinning={spinning} speed={focus ? SPIN_FOCUS : SPIN_WHOLE}>
              <SaturnV activePart={activePart} focusPart={focusPart} onSelect={selectPart} explode={explode} />
            </Turntable>
            {/* Close up, the chip above names the part; a label's dot and
                leader would be drawn at the rocket's scale and fill the view. */}
            {focus ? null : <StackLabels t={t} explode={explode} oneSide={Boolean(comparison.heightM)} />}
            {comparison.heightM && !focus ? (
              <>
                <ComparisonModel comparison={comparison} x={frame.compareX} />
                <HoloLabel
                  position={[frame.compareX, BASE_Y + comparison.heightM * SCALE, 0]}
                  side={-1}
                  accent={COMPARE_ACCENT}
                  title={t('lab', comparison.labelKey)}
                  subtitle={`${comparison.heightM} m`}
                />
              </>
            ) : null}
          </group>
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={focus ? 0.25 : comparison.id === 'person' ? 2 : 8}
            maxDistance={focus ? 25 : Math.max(30, frame.height * 2.6)}
            maxPolarAngle={focus ? Math.PI * 0.95 : Math.PI / 1.7}
            minPolarAngle={focus ? Math.PI * 0.05 : Math.PI / 6}
          />
          <EffectComposer>
            <Vignette eskil={false} offset={0.1} darkness={0.9} />
          </EffectComposer>
        </Canvas>
        {focusEntry ? (
          <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-cyan-100 bg-black/55 border border-white/15 px-3 py-1.5 rounded-full backdrop-blur-md">
              {t('lab', 'apolloFocusChip', { name: t('lab', focusEntry.nameKey) })}
            </span>
            <button
              onClick={leaveFocus}
              className="min-h-[40px] flex items-center gap-1.5 text-xs font-semibold text-white bg-black/55 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-md hover:bg-black/70"
            >
              <ArrowLeft className="w-4 h-4" /> {t('lab', 'apolloFocusBack')}
            </button>
            <button
              onClick={() => setSpinning((on) => !on)}
              aria-pressed={spinning}
              className="min-h-[40px] flex items-center gap-1.5 text-xs text-white bg-black/55 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-md hover:bg-black/70"
            >
              {spinning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {t('lab', spinning ? 'apolloFocusPause' : 'apolloFocusSpin')}
            </button>
          </div>
        ) : comparison.heightM ? (
          <div className="absolute top-4 left-4 max-w-[70%] text-[11px] text-amber-100 bg-amber-500/15 border border-amber-400/40 px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none">
            {t('lab', 'apolloCompareSketch')}
          </div>
        ) : null}
        <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md w-fit">
          {focusEntry ? t('lab', 'apolloFocusHint') : `${t('lab', 'hintDrag')} — ${t('lab', 'hintScroll')} — ${t('lab', 'hintClick')}`}
        </div>
      </div>
    </div>
  );
};
