import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Layers } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import {
  SATURN_V,
  SATURN_V_STACK,
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
 * Apollo, as a hologram you can take apart.
 *
 * What was here before: nothing. `RocketEngineeringLab` - the only module in
 * the lab where a rocket came apart, and the only one offering a capsule
 * instead of a satellite fairing - was 130 lines of code that no branch ever
 * rendered. It had a name in all three locale files and no way in. Ticket 12
 * puts the rocket back, as the vehicle the ticket names, with figures that have
 * a source printed beside them.
 *
 * Every number shown here comes from `labFacts.js`. Nothing is computed from a
 * control on the page.
 */

/** 110.6 m of rocket into about 11 scene units. */
const SCALE = 0.1;
const HEIGHT = SATURN_V.heightM * SCALE;
const RADIUS = (SATURN_V.diameterM / 2) * SCALE;

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

function StackLabels({ t, explode }) {
  return (
    <>
      {SATURN_V_STACK.map((part, index) => {
        const top = part.sections[part.sections.length - 1];
        const bottom = part.sections[0];
        const middle = ((bottom.fromM + top.toM) / 2) * SCALE - HEIGHT / 2;
        const widest = Math.max(...part.sections.map((s) => s.bottomRadiusM)) * SCALE;
        const side = index % 2 === 0 ? 1 : -1;
        return (
          <HoloLabel
            key={part.id}
            position={[widest * side * 1.15, middle + explodeOffsetM(index, explode) * SCALE, 0]}
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

export const ApolloHologramModule = () => {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const [activePart, setActivePart] = useState('s-ic');
  const [explode, setExplode] = useState(0);

  useEffect(() => {
    if (activePart) trackEvent(`lab_apollo_${activePart}`);
  }, [activePart, trackEvent]);

  const part = SATURN_V_STACK.find((p) => p.id === activePart) ?? SATURN_V_STACK[0];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-4 md:overflow-y-auto">
        <div className="glass p-5 rounded-2xl">
          <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Rocket className="text-neon-blue" /> {t('lab', 'apolloTitle')}
          </h3>
          <p className="text-xs text-gray-400 mb-4">{t('lab', 'apolloSubtitle')}</p>

          <dl className="grid grid-cols-2 gap-2 mb-4">
            {SATURN_V.facts.map((fact) => {
              const { label, value } = readFact(fact, t);
              return (
                <div key={fact.key} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                  <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</dt>
                  <dd className="font-mono text-xs text-cyan-300">{value}</dd>
                </div>
              );
            })}
          </dl>

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
            className="w-full accent-neon-blue mb-4"
            aria-label={t('lab', 'apolloExplode')}
          />

          <div className="space-y-2">
            {SATURN_V_STACK.map((entry) => (
              <button
                key={entry.id}
                onClick={() => setActivePart(entry.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  activePart === entry.id
                    ? 'border-neon-blue bg-neon-blue/20'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <span className="block text-sm font-bold">{t('lab', entry.nameKey)}</span>
                <span className="block text-xs text-gray-400">{t('lab', entry.roleKey)}</span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={part.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass p-5 rounded-2xl border border-neon-blue/30"
          >
            <h4 className="text-base font-bold text-neon-blue mb-3">{t('lab', part.nameKey)}</h4>
            <dl className="space-y-2">
              {part.facts.map((fact) => {
                const { label, value } = readFact(fact, t);
                return (
                  <div key={fact.key} className="flex justify-between gap-3 text-sm">
                    <dt className="text-gray-400 shrink-0">{label}</dt>
                    <dd className="text-right text-gray-200">{value}</dd>
                  </div>
                );
              })}
            </dl>
            <p className="mt-3 pt-3 border-t border-white/10 text-[10px] leading-relaxed text-gray-500">
              <span className="uppercase tracking-wider">{t('lab', 'apolloSource')}: </span>
              {part.source}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas
          camera={{ position: [4, 1.5, 17], fov: 42 }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          {/* The stack grows as it opens, so the framing has to grow with it,
              or the escape tower leaves the top of the frame. */}
          <FitToViewport
            height={HEIGHT + explodeOffsetM(SATURN_V_STACK.length - 1, explode) * SCALE}
            radius={RADIUS}
          />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.6} />
          <HologramStage height={HEIGHT} radius={RADIUS} accent={HOLO.accent} spin={0.1}>
            <SaturnV activePart={activePart} onSelect={setActivePart} explode={explode} />
            <StackLabels t={t} explode={explode} />
          </HologramStage>
          <OrbitControls
            enablePan={false}
            minDistance={8}
            maxDistance={30}
            maxPolarAngle={Math.PI / 1.7}
            minPolarAngle={Math.PI / 6}
          />
          <EffectComposer>
            <Bloom luminanceThreshold={0.62} mipmapBlur intensity={0.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.05} />
          </EffectComposer>
        </Canvas>
        <div className="absolute bottom-4 left-4 right-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md w-fit">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')} — {t('lab', 'hintClick')}
        </div>
      </div>
    </div>
  );
};
