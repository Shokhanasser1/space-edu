import { useEffect, useMemo, useState } from 'react';
import { HelpCircle, Layers, Rocket, Ruler } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
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
import {
  FitToViewport,
  HOLO,
  HologramStage,
  HoloLabel,
  HoloMesh,
  ReleaseContextOnUnmount,
} from './Hologram';

/**
 * Apollo, as a hologram you can take apart - and stand beside things you know.
 *
 * What was here before: nothing. `RocketEngineeringLab` - the only module in
 * the lab where a rocket came apart, and the only one offering a capsule
 * instead of a satellite fairing - was 130 lines of code that no branch ever
 * rendered. Ticket 12 put the rocket back, as the vehicle the ticket names,
 * with figures that have a source printed beside them.
 *
 * What the October 2026 pass added, and why:
 *
 * - **Something to compare it with.** "110.6 m" means nothing to a ten-year-old.
 *   A person, NASA's own two comparisons (a 36-storey building, the Statue of
 *   Liberty) and Tashkent's TV tower now stand beside the rocket at the same
 *   scale. Only the heights are to scale; the shapes are sketches, and the page
 *   says so.
 * - **Goals.** Missions, a one-question quiz ("only one part came home -
 *   which?") and the shared kit's explanation and facts, so a reader who opens
 *   the module has something to do and someone who wants the physics finds it.
 * - **Labels that stay readable.** They were children of the spinning model,
 *   so every few seconds a label swung in front of the hull and the bloom
 *   washed it out. They are in world space now, beside the stack; the stack
 *   is round, so a fixed label still points at the right part.
 *
 * Every number shown here comes from `labFacts.js`. Nothing is computed from a
 * control on the page.
 */

/** 110.6 m of rocket into about 11 scene units. */
const SCALE = 0.1;
const HEIGHT = SATURN_V.heightM * SCALE;
const RADIUS = (SATURN_V.diameterM / 2) * SCALE;
const BASE_Y = -HEIGHT / 2;

/** A height above the base of the rocket, in metres, as a scene y. */
function atMetres(metres) {
  return metres * SCALE - HEIGHT / 2;
}

/** Centre of a section, in scene units, with the whole stack centred on 0. */
function sectionY(section) {
  return atMetres((section.fromM + section.toM) / 2);
}

/** The five F-1 bells: one fixed in the centre, four gimballed around it. */
function EngineCluster({ count, bellRadiusM, ringRadiusM, lengthM, y }) {
  const positions = [[0, 0]];
  for (let i = 0; i < count - 1; i += 1) {
    const angle = (i / (count - 1)) * Math.PI * 2;
    positions.push([Math.cos(angle) * ringRadiusM * SCALE, Math.sin(angle) * ringRadiusM * SCALE]);
  }
  return (
    <>
      {positions.map(([x, z]) => (
        <HoloMesh key={`${x}-${z}`} position={[x, y, z]}>
          <cylinderGeometry
            args={[bellRadiusM * 0.45 * SCALE, bellRadiusM * SCALE, lengthM * SCALE, 20, 1, true]}
          />
        </HoloMesh>
      ))}
    </>
  );
}

/** The lattice the escape motor stands on, above the Command Module. */
function EscapeTower({ baseY, topY }) {
  const legs = [0, 1, 2, 3].map((i) => (i / 4) * Math.PI * 2);
  const length = topY - baseY;
  return (
    <>
      {legs.map((angle) => (
        <HoloMesh
          key={angle}
          position={[Math.cos(angle) * 0.05, baseY + length / 2, Math.sin(angle) * 0.05]}
          rotation={[Math.cos(angle) * 0.09, 0, -Math.sin(angle) * 0.09]}
        >
          <cylinderGeometry args={[0.012, 0.012, length, 6]} />
        </HoloMesh>
      ))}
    </>
  );
}

function SaturnV({ activePart, onSelect, explode }) {
  return (
    <group>
      {SATURN_V_STACK.map((part, index) => {
        const lift = explodeOffsetM(index, explode) * SCALE;
        const active = activePart === part.id;
        return (
          <group
            key={part.id}
            position={[0, lift, 0]}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(part.id);
            }}
          >
            {part.sections.map((section) => (
              <HoloMesh
                key={`${section.fromM}-${section.toM}`}
                active={active}
                position={[0, sectionY(section), 0]}
              >
                <cylinderGeometry
                  args={[
                    section.topRadiusM * SCALE,
                    section.bottomRadiusM * SCALE,
                    (section.toM - section.fromM) * SCALE,
                    40,
                    1,
                  ]}
                />
              </HoloMesh>
            ))}

            {/* Five F-1 bells under the first stage, and its four base fins. */}
            {part.id === 's-ic' && (
              <>
                <EngineCluster
                  count={5}
                  bellRadiusM={1.5}
                  ringRadiusM={3.1}
                  lengthM={4}
                  y={-HEIGHT / 2 - 4 * SCALE * 0.5}
                />
                {[0, 1, 2, 3].map((i) => {
                  const angle = (i / 4) * Math.PI * 2;
                  return (
                    <HoloMesh
                      key={`fin-${angle}`}
                      position={[
                        Math.cos(angle) * 5.6 * SCALE,
                        -HEIGHT / 2 + 3 * SCALE,
                        Math.sin(angle) * 5.6 * SCALE,
                      ]}
                      rotation={[0, -angle, 0]}
                    >
                      <boxGeometry args={[2.4 * SCALE, 6 * SCALE, 0.3 * SCALE]} />
                    </HoloMesh>
                  );
                })}
              </>
            )}

            {/* The J-2 cluster, which only becomes visible once it is opened. */}
            {part.id === 's-ii' && explode > 0.05 && (
              <EngineCluster
                count={5}
                bellRadiusM={1.0}
                ringRadiusM={2.2}
                lengthM={2.8}
                y={atMetres(42) - 2.8 * SCALE * 0.5}
              />
            )}

            {part.id === 's-ivb' && explode > 0.05 && (
              <EngineCluster
                count={1}
                bellRadiusM={1.0}
                ringRadiusM={0}
                lengthM={2.8}
                y={atMetres(70) - 2.8 * SCALE * 0.5}
              />
            )}

            {part.id === 'les' && (
              <EscapeTower
                baseY={atMetres(106.5)}
                topY={atMetres(109)}
              />
            )}
          </group>
        );
      })}
    </group>
  );
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
        return (
          <HoloLabel
            key={part.id}
            position={[(widest * 1.25 + 0.12) * side, middle + explodeOffsetM(index, explode) * SCALE, 0]}
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

/** The comparison's colour: warm, so it never reads as part of the rocket. */
const SKETCH = HOLO.accentWarm;

/** A translucent, outlined solid in the comparison colour. */
function Sketch({ children, ...props }) {
  return (
    <group {...props}>
      <mesh>
        {children}
        <meshBasicMaterial color={SKETCH} transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh scale={1.004}>
        {children}
        <meshBasicMaterial color={SKETCH} wireframe transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Floor lines for the building: one line per storey, in one draw call. */
function FloorLines({ widthM, heightM, floors }) {
  const geometry = useMemo(() => {
    const created = new THREE.BufferGeometry();
    const half = (widthM * SCALE) / 2;
    const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
    const points = [];
    for (let floor = 0; floor <= floors; floor += 1) {
      const y = (floor / floors) * heightM * SCALE;
      for (let c = 0; c < 4; c += 1) {
        const [x1, z1] = corners[c];
        const [x2, z2] = corners[(c + 1) % 4];
        points.push(x1, y, z1, x2, y, z2);
      }
    }
    for (const [x, z] of corners) points.push(x, 0, z, x, heightM * SCALE, z);
    created.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return created;
  }, [widthM, heightM, floors]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={SKETCH} transparent opacity={0.45} depthWrite={false} />
    </lineSegments>
  );
}

/**
 * The thing standing beside the rocket, its base on the rocket's base.
 * Heights are to scale; the shapes are sketches.
 */
function ComparisonModel({ comparison, x }) {
  const s = SCALE;
  switch (comparison.id) {
    case 'person':
      return (
        <group position={[x, BASE_Y, 0]}>
          <Sketch position={[0, 0.75 * s, 0]}>
            <cylinderGeometry args={[0.16 * s, 0.2 * s, 1.5 * s, 10]} />
          </Sketch>
          <Sketch position={[0, 1.62 * s, 0]}>
            <sphereGeometry args={[0.13 * s, 10, 10]} />
          </Sketch>
        </group>
      );
    case 'building':
      return (
        <group position={[x, BASE_Y, 0]}>
          <Sketch position={[0, (comparison.heightM * s) / 2, 0]}>
            <boxGeometry args={[comparison.widthM * s, comparison.heightM * s, comparison.widthM * s]} />
          </Sketch>
          <FloorLines widthM={comparison.widthM} heightM={comparison.heightM} floors={comparison.floors} />
        </group>
      );
    case 'liberty':
      // Foundation 20 m, pedestal 27 m, then the statue, base to torch, 46 m:
      // 93 m from the ground to the tip of the torch.
      return (
        <group position={[x, BASE_Y, 0]}>
          <Sketch position={[0, 10 * s, 0]}>
            <boxGeometry args={[30 * s, 20 * s, 30 * s]} />
          </Sketch>
          <Sketch position={[0, 33.5 * s, 0]}>
            <boxGeometry args={[14 * s, 27 * s, 14 * s]} />
          </Sketch>
          <Sketch position={[0, 61 * s, 0]}>
            <cylinderGeometry args={[3.2 * s, 5.5 * s, 28 * s, 16]} />
          </Sketch>
          <Sketch position={[0, 77.5 * s, 0]}>
            <sphereGeometry args={[2.6 * s, 14, 12]} />
          </Sketch>
          <Sketch position={[3.2 * s, 82 * s, 0]} rotation={[0, 0, -0.12]}>
            <cylinderGeometry args={[0.9 * s, 1.1 * s, 14 * s, 8]} />
          </Sketch>
          <Sketch position={[4.1 * s, 91 * s, 0]}>
            <coneGeometry args={[1.4 * s, 4 * s, 10]} />
          </Sketch>
        </group>
      );
    case 'tower':
      return (
        <group position={[x, BASE_Y, 0]}>
          {[0, 1, 2].map((i) => {
            const angle = (i / 3) * Math.PI * 2;
            return (
              <Sketch
                key={angle}
                position={[Math.cos(angle) * 9 * s, 30 * s, Math.sin(angle) * 9 * s]}
                rotation={[Math.sin(angle) * 0.3, 0, -Math.cos(angle) * 0.3]}
              >
                <cylinderGeometry args={[1.2 * s, 2 * s, 62 * s, 6]} />
              </Sketch>
            );
          })}
          <Sketch position={[0, 170 * s, 0]}>
            <cylinderGeometry args={[2 * s, 4.5 * s, 340 * s, 10]} />
          </Sketch>
          <Sketch position={[0, 100 * s, 0]}>
            <cylinderGeometry args={[14 * s, 14 * s, 12 * s, 20]} />
          </Sketch>
          <Sketch position={[0, 357.5 * s, 0]}>
            <cylinderGeometry args={[0.6 * s, 1.2 * s, 35 * s, 6]} />
          </Sketch>
        </group>
      );
    default:
      return null;
  }
}

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
    radius: Math.max(RADIUS, (Math.abs(compareX) + compareHalfWidth) / 1.6),
  };
}

export const ApolloHologramModule = () => {
  const { t } = useTranslation();
  const [activePart, setActivePart] = useState('s-ic');
  const [visited, setVisited] = useState(() => new Set(['s-ic']));
  const [explode, setExplode] = useState(0);
  const [compareId, setCompareId] = useState('none');
  const [homeGuess, setHomeGuess] = useState(null);

  const selectPart = (id) => {
    setActivePart(id);
    setVisited((seen) => (seen.has(id) ? seen : new Set([...seen, id])));
  };

  const comparison = SIZE_COMPARISONS.find((c) => c.id === compareId) ?? SIZE_COMPARISONS[0];
  const frame = frameFor(explode, comparison);
  const homeRight = homeGuess === 'spacecraft';

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
    ],
    [t, visited, explode, homeRight, compareId],
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
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas
          camera={{ position: [4, 1.5, 17], fov: 42 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          {/* The frame grows with the opened stack and with whatever stands
              beside it, or the escape tower - or the TV tower - leaves the top
              of the frame. */}
          <FitToViewport height={frame.height} radius={frame.radius} />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.6} />
          <group position={[0, frame.shift, 0]}>
            <HologramStage height={HEIGHT} radius={RADIUS} accent={HOLO.accent} spin={0.1}>
              <SaturnV activePart={activePart} onSelect={selectPart} explode={explode} />
            </HologramStage>
            <StackLabels t={t} explode={explode} oneSide={Boolean(comparison.heightM)} />
            {comparison.heightM ? (
              <>
                <ComparisonModel comparison={comparison} x={frame.compareX} />
                <HoloLabel
                  position={[frame.compareX, BASE_Y + comparison.heightM * SCALE, 0]}
                  side={-1}
                  accent={SKETCH}
                  title={t('lab', comparison.labelKey)}
                  subtitle={`${comparison.heightM} m`}
                />
              </>
            ) : null}
          </group>
          <OrbitControls
            enablePan={false}
            minDistance={comparison.id === 'person' ? 2 : 8}
            maxDistance={Math.max(30, frame.height * 2.6)}
            maxPolarAngle={Math.PI / 1.7}
            minPolarAngle={Math.PI / 6}
          />
          <EffectComposer>
            <Bloom luminanceThreshold={0.62} mipmapBlur intensity={0.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.05} />
          </EffectComposer>
        </Canvas>
        {comparison.heightM ? (
          <div className="absolute top-4 left-4 max-w-[70%] text-[11px] text-amber-100 bg-amber-500/15 border border-amber-400/40 px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none">
            {t('lab', 'apolloCompareSketch')}
          </div>
        ) : null}
        <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md w-fit">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')} — {t('lab', 'hintClick')}
        </div>
      </div>
    </div>
  );
};
