import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Flame, Gauge, Layers, Orbit, Rocket, RotateCw, Shield } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { LabExplain, LabFacts, LabMissions } from './LabKit';
import {
  APOLLO_11_ASCENT,
  LAUNCH_FACTS,
  ORBIT_INSERTION_S,
  SATURN_V,
  SOURCES,
  altitudeKmAt,
  burnRemaining,
  eventsReached,
  missionClock,
  nextEvent,
  stageAt,
  velocityMsAt,
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
 * The Apollo 11 ascent, drawn as an altitude column - now all the way to orbit.
 *
 * What this replaced, and why it is a column rather than a chase camera:
 *
 * - The old simulator wrote `camera.position` and `camera.lookAt` every frame
 *   while drei's OrbitControls wrote them back in the same frame. Controls won,
 *   so the camera never followed: the rocket climbed out of the top of the
 *   frame in about two seconds and the reader watched an empty pad.
 * - Two additive cones with a bloom threshold of 1 filled the viewport with
 *   white within a second of liftoff.
 * - Nothing ended it: no cutoff, no staging you could see, no orbit.
 *
 * A fixed column needs no moving camera, and it teaches where things happen.
 *
 * The October 2026 pass made it a mission rather than a meter:
 *
 * - **The real flight, to orbit.** Twelve events from NASA's records - the
 *   roll program, Max-Q, every engine cutoff, both stagings, the escape tower
 *   leaving, insertion at T+11:49 - each with the altitude and speed Apollo 11
 *   actually had there (`labFacts.js` says which record each comes from).
 *   The run used to stop at second-stage cutoff for want of a source; the
 *   flight evaluation report is that source.
 * - **Speed, because orbit is speed.** The third stage climbs about 2 km and
 *   adds about 850 m/s. A speed readout and a bar towards the 7.8 km/s a
 *   circular orbit at that height needs show the reader what altitude alone
 *   hid. Between records both readouts are straight-line readings, and the
 *   note under the panel says so.
 * - **A clock you can run at 1x.** Real time is the only rate at which Max-Q
 *   feels like anything; one mission asks for it.
 * - **Three stages that come apart**, and an escape tower that leaves, at the
 *   recorded times. The first stage's flame is bright orange (kerosene); the
 *   hydrogen stages' is drawn faint, because it nearly is.
 */

/** The drawn column, in scene units, covering 0 to `ceilingKm`. */
const COLUMN = 11;
const RADIUS = 1.4;

/** Scene y for an altitude in kilometres. */
function kmToY(km) {
  return (km / APOLLO_11_ASCENT.ceilingKm) * COLUMN - COLUMN / 2;
}

/** Clock rates the reader can pick; 1 is real time. */
const RATES = [1, 10, 30, 60, 120];
/** The orbit speed the bar fills towards: the speed recorded at insertion. */
const ORBIT_SPEED_MS = APOLLO_11_ASCENT.events.find((e) => e.id === 'orbit').velocityMs;
const MAXQ_S = APOLLO_11_ASCENT.events.find((e) => e.id === 'maxq').atS;
const STAGING_1_S = APOLLO_11_ASCENT.events.find((e) => e.id === 'staging1').atS;
const STAGING_2_S = APOLLO_11_ASCENT.events.find((e) => e.id === 'staging2').atS;
const TOWER_S = APOLLO_11_ASCENT.events.find((e) => e.id === 'tower').atS;
/** The altitudes marked with a ring on the column. */
const MARKED = ['meco', 'tower', 'seco', 'orbit'];

const EVENT_ICONS = {
  liftoff: Rocket,
  roll: RotateCw,
  maxq: Gauge,
  staging1: Layers,
  staging2: Layers,
  tower: Shield,
  orbit: Orbit,
};

/**
 * The vehicle, small enough to read against the column. Its proportions are
 * the stack's own (`SATURN_V_STACK` in metres), widened 1.6 times so a 11:1
 * rocket is not a hairline at this size.
 */
const VEHICLE_H = 1.9;
const PER_M = VEHICLE_H / SATURN_V.heightM;
const WIDEN = 1.6;
const yOf = (metres) => metres * PER_M;
const rOf = (metres) => metres * PER_M * WIDEN;

/** A hull section from `fromM` to `toM`, in the vehicle's own frame. */
function Hull({ fromM, toM, bottomRadiusM, topRadiusM, active = true }) {
  return (
    <HoloMesh active={active} position={[0, yOf((fromM + toM) / 2), 0]}>
      <cylinderGeometry args={[rOf(topRadiusM), rOf(bottomRadiusM), yOf(toM - fromM), 18]} />
    </HoloMesh>
  );
}

/** One plume, below `atM`. Kerosene is bright; hydrogen burns almost unseen. */
function Plume({ plumeRef, atM, radiusM, kind }) {
  const hydrogen = kind === 'hydrogen';
  return (
    <mesh ref={plumeRef} position={[0, yOf(atM) - VEHICLE_H * 0.2, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[rOf(radiusM) * 0.9, VEHICLE_H * 0.4, 14]} />
      <meshBasicMaterial
        color={hydrogen ? '#9fd8ff' : '#ffb266'}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function setPlume(ref, burning, strength, peakOpacity) {
  if (!ref.current) return;
  const scale = burning ? 0.7 + strength * 0.3 : 0.0001;
  ref.current.scale.set(burning ? 1 : 0.0001, scale, burning ? 1 : 0.0001);
  ref.current.material.opacity = burning ? peakOpacity : 0;
}

/** A part that has let go: it drops behind the stack and tumbles away. */
function fallAway(ref, since, baseY, drift) {
  if (!ref.current) return;
  if (since <= 0) {
    ref.current.position.set(0, baseY, 0);
    ref.current.rotation.z = 0;
    ref.current.visible = true;
    return;
  }
  ref.current.position.set(since * 0.004 * drift, baseY - since * 0.012, 0);
  ref.current.rotation.z = -since * 0.02 * drift;
  // Gone once it is well clear, rather than falling forever below the pad.
  ref.current.visible = since < 120;
}

function Vehicle({ clockRef }) {
  const stackRef = useRef(null);
  const firstRef = useRef(null);
  const secondRef = useRef(null);
  const towerRef = useRef(null);
  const plume1Ref = useRef(null);
  const plume2Ref = useRef(null);
  const plume3Ref = useRef(null);
  const traceRef = useRef(null);
  const maxQRef = useRef(null);

  useFrame(() => {
    const seconds = clockRef.current;
    const y = kmToY(altitudeKmAt(seconds));
    const stage = stageAt(seconds);
    const strength = burnRemaining(seconds);

    if (stackRef.current) stackRef.current.position.y = y;

    fallAway(firstRef, seconds - STAGING_1_S, 0, 1);
    fallAway(secondRef, seconds - STAGING_2_S, 0, -1);

    // The escape tower is pulled off by its own motor, upwards and aside.
    if (towerRef.current) {
      const since = seconds - TOWER_S;
      towerRef.current.position.set(since > 0 ? since * 0.01 : 0, since > 0 ? since * 0.02 : 0, 0);
      towerRef.current.visible = since < 60;
    }

    setPlume(plume1Ref, stage?.partId === 's-ic', strength, 0.6);
    setPlume(plume2Ref, stage?.partId === 's-ii', strength, 0.16);
    setPlume(plume3Ref, stage?.partId === 's-ivb', strength, 0.16);

    // Max-Q: a ring of pressure that swells to the moment and fades after it.
    if (maxQRef.current) {
      const closeness = Math.max(0, 1 - Math.abs(seconds - MAXQ_S) / 18);
      maxQRef.current.material.opacity = closeness * 0.5;
      maxQRef.current.scale.setScalar(0.8 + closeness * 0.4);
    }

    // The trace: how far it has come, drawn from the pad.
    if (traceRef.current) {
      const travelled = Math.max(0.0001, y - kmToY(0));
      traceRef.current.scale.y = travelled;
      traceRef.current.position.y = kmToY(0) + travelled / 2;
    }
  });

  return (
    <group>
      <mesh ref={traceRef} position={[0, kmToY(0), 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1, 8]} />
        <meshBasicMaterial
          color={HOLO.accent}
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <group ref={stackRef} position={[0, kmToY(0), 0]}>
        {/* Third stage and spacecraft: what reaches orbit. */}
        <Hull fromM={70} toM={87.8} bottomRadiusM={3.3} topRadiusM={3.3} />
        <Hull fromM={87.8} toM={95.5} bottomRadiusM={3.3} topRadiusM={1.95} />
        <Hull fromM={95.5} toM={103} bottomRadiusM={1.95} topRadiusM={1.95} />
        <Hull fromM={103} toM={106.5} bottomRadiusM={1.95} topRadiusM={0.6} />
        <Plume plumeRef={plume3Ref} atM={70} radiusM={3.3} kind="hydrogen" />

        <group ref={towerRef}>
          <Hull fromM={106.5} toM={110.6} bottomRadiusM={0.42} topRadiusM={0.3} />
        </group>

        <group ref={secondRef}>
          <Hull fromM={42} toM={66.8} bottomRadiusM={5.05} topRadiusM={5.05} active={false} />
          <Hull fromM={66.8} toM={70} bottomRadiusM={5.05} topRadiusM={3.3} active={false} />
          <Plume plumeRef={plume2Ref} atM={42} radiusM={5.05} kind="hydrogen" />
        </group>

        <group ref={firstRef}>
          <Hull fromM={0} toM={42} bottomRadiusM={5.05} topRadiusM={5.05} active={false} />
          <Plume plumeRef={plume1Ref} atM={0} radiusM={5.05} kind="kerosene" />
        </group>

        <mesh ref={maxQRef} position={[0, VEHICLE_H * 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[rOf(5.05) * 1.4, rOf(5.05) * 2.4, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Advances the simulated clock. The only thing in the scene that owns time. */
function AscentClock({ clockRef, running, rate }) {
  useFrame((_, delta) => {
    if (!running) return;
    clockRef.current = Math.min(ORBIT_INSERTION_S, clockRef.current + delta * rate);
  });
  return null;
}

/** The marked altitudes, with a ring at each and its name beside it. */
function AltitudeScale({ t }) {
  const marked = APOLLO_11_ASCENT.events.filter((e) => MARKED.includes(e.id));
  return (
    <>
      {marked.map((event, index) => (
        <group key={event.id} position={[0, kmToY(event.altitudeKm), 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[RADIUS * 0.72, RADIUS * 0.75, 64]} />
            <meshBasicMaterial
              color={event.id === 'orbit' ? HOLO.accentWarm : HOLO.accent}
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <HoloLabel
            position={[RADIUS * 0.75 * (index % 2 === 0 ? 1 : -1), 0, 0]}
            side={index % 2 === 0 ? 1 : -1}
            accent={event.id === 'orbit' ? HOLO.accentWarm : HOLO.accent}
            title={t('lab', event.labelKey)}
            subtitle={`${Math.round(event.altitudeKm)} km`}
          />
        </group>
      ))}
    </>
  );
}

/** `MM:SS` for a duration in seconds. */
function clockText(seconds) {
  return missionClock(seconds).slice(2);
}

export const ApolloLaunchSimulator = () => {
  const { t } = useTranslation();

  /** Simulated seconds since liftoff. Advanced in useFrame, sampled below. */
  const clockRef = useRef(0);
  const lastSampleRef = useRef(0);
  const [status, setStatus] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [rate, setRate] = useState(30);
  const rateRef = useRef(rate);
  const [maxQAtRealSpeed, setMaxQAtRealSpeed] = useState(false);
  /** The rate Max-Q went by at, when it was not 1x - so the page can say why. */
  const [maxQMissedAt, setMaxQMissedAt] = useState(null);

  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  // The countdown. It lives in an effect rather than in the click handler,
  // because an interval started in a handler has nothing to clear it: leaving
  // the module between "3" and "0" left it running for the rest of the visit.
  useEffect(() => {
    if (status !== 'countdown') return undefined;
    const id = setInterval(() => {
      setCountdown((remaining) => {
        if (remaining > 1) return remaining - 1;
        clockRef.current = 0;
        lastSampleRef.current = 0;
        setStatus('flight');
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // The panel reads the flight clock ten times a second. The clock itself
  // advances every frame; putting a setState in useFrame would re-render the
  // whole module sixty times a second, which is the rule the game is held to.
  useEffect(() => {
    if (status !== 'flight') return undefined;
    const id = setInterval(() => {
      const now = clockRef.current;
      // Max-Q watched at real speed: the clock crossed 1:23 while at 1x. At
      // any other rate, remember which, so the page can say why it did not count.
      if (lastSampleRef.current < MAXQ_S && now >= MAXQ_S) {
        if (rateRef.current === 1) setMaxQAtRealSpeed(true);
        else setMaxQMissedAt(rateRef.current);
      }
      lastSampleRef.current = now;
      setElapsed(now);
      if (now >= ORBIT_INSERTION_S) setStatus('complete');
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  const start = () => {
    if (status === 'idle') {
      setCountdown(3);
      setStatus('countdown');
      return;
    }
    clockRef.current = 0;
    lastSampleRef.current = 0;
    setElapsed(0);
    setCountdown(3);
    setStatus('idle');
  };

  const flying = status === 'flight' || status === 'complete';
  // Nothing burns on the pad: before liftoff the first stage is not "the
  // stage that is pushing", whatever the clock's zero says.
  const stage = flying ? stageAt(elapsed) : null;
  const upcoming = nextEvent(elapsed);
  const reached = eventsReached(flying ? elapsed : -1);
  const speed = velocityMsAt(elapsed);

  const statusText =
    status === 'idle'
      ? t('lab', 'statusHolding')
      : status === 'countdown'
        ? `T-00:0${countdown}`
        : status === 'complete'
          ? t('lab', 'statusOrbit')
          : missionClock(elapsed);

  const stageText = stage
    ? t('lab', stage.nameKey)
    : flying && elapsed < ORBIT_INSERTION_S && elapsed > 0
      ? t('lab', 'launchStageGap')
      : t('lab', status === 'complete' ? 'launchStageNone' : 'launchStagePad');

  const readouts = [
    { label: t('lab', 'launchStage'), value: stageText },
    { label: t('lab', 'apolloFactThrust'), value: stage ? stage.thrust : '0 kN' },
    { label: t('lab', 'launchAltitude'), value: t('lab', 'launchApprox', { value: `${altitudeKmAt(elapsed).toFixed(1)} km` }) },
    {
      label: t('lab', 'launchSpeed'),
      value: t('lab', 'launchApprox', {
        value: `${(speed / 1000).toFixed(2)} km/s`,
      }),
    },
  ];

  const missions = useMemo(
    () => [
      { id: 'liftoff', title: t('lab', 'launchMissionLiftoff'), done: flying },
      {
        id: 'maxq',
        title: t('lab', 'launchMissionMaxQ'),
        hint: t('lab', 'launchMissionMaxQHint'),
        done: maxQAtRealSpeed,
      },
      { id: 'staging', title: t('lab', 'launchMissionStaging'), done: flying && elapsed >= STAGING_1_S },
      { id: 'orbit', title: t('lab', 'launchMissionOrbit'), done: status === 'complete' },
    ],
    [t, flying, maxQAtRealSpeed, elapsed, status],
  );

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-4 md:overflow-y-auto">
        <div className="glass p-5 rounded-2xl border border-orange-500/20 space-y-4">
          <div>
            <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Flame className="text-orange-500" /> {t('lab', 'launchControl')}
            </h3>
            <p className="text-xs leading-relaxed text-gray-400">{t('lab', 'launchSubtitle')}</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={start}
              disabled={status === 'countdown'}
              className={`w-24 h-24 shrink-0 rounded-full font-bold text-lg border-4 flex items-center justify-center transition-all ${
                status === 'idle'
                  ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500 hover:text-white shadow-[0_0_24px_rgba(239,68,68,0.35)]'
                  : status === 'countdown'
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 text-3xl'
                    : 'bg-space-700 border-space-600 text-gray-300 hover:bg-space-600'
              }`}
            >
              {status === 'idle'
                ? t('lab', 'launch')
                : status === 'countdown'
                  ? countdown
                  : t('lab', 'reset')}
            </button>
            <div className="flex-1 bg-space-800 p-3 rounded-xl border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('lab', 'status')}</div>
              <div className="font-mono text-lg text-neon-blue font-bold">{statusText}</div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{t('lab', 'launchTimeRate')}</span>
              <span>{rate === 1 ? t('lab', 'launchRealTime') : `${rate}x`}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label={t('lab', 'launchTimeRate')}>
              {RATES.map((option) => (
                <button
                  key={option}
                  onClick={() => setRate(option)}
                  aria-pressed={rate === option}
                  className={`min-h-[40px] py-2 rounded-lg text-xs font-mono transition-colors ${
                    rate === option
                      ? 'bg-orange-500 text-space-900 font-bold'
                      : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  {option}x
                </button>
              ))}
            </div>
            {/* Named for what it is. The old control was labelled "launch speed"
                and its number was multiplied into the thrust readout. */}
            <p className="mt-2 text-[10px] text-gray-500">{t('lab', 'launchTimeRateNote')}</p>
            {maxQMissedAt && !maxQAtRealSpeed ? (
              <p role="status" className="mt-2 text-xs leading-relaxed text-amber-200">
                {t('lab', 'launchMaxQMissed', { rate: maxQMissedAt })}
              </p>
            ) : null}
          </div>

          <dl className="grid grid-cols-2 gap-2">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300 break-words">{readout.value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
              <span>{t('lab', 'launchOrbitBar')}</span>
              <span className="font-mono text-amber-300">{Math.round((speed / ORBIT_SPEED_MS) * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-amber-300 transition-all duration-200"
                style={{ width: `${Math.min(100, (speed / ORBIT_SPEED_MS) * 100)}%` }}
              />
            </div>
          </div>

          {upcoming && flying ? (
            <p className="text-xs text-gray-300">
              {t('lab', 'launchNextEvent', {
                event: t('lab', upcoming.labelKey),
                time: clockText(upcoming.atS - elapsed),
              })}
            </p>
          ) : null}
        </div>

        <section className="glass p-4 rounded-2xl border border-white/10">
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-300">
            {t('lab', 'launchLogTitle')}
          </h4>
          <ol className="space-y-1.5">
            {APOLLO_11_ASCENT.events.map((event) => {
              const done = reached.includes(event);
              const isNext = flying && upcoming?.id === event.id;
              const Icon = EVENT_ICONS[event.id] ?? Flame;
              return (
                <li
                  key={event.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
                    isNext ? 'bg-amber-400/10 text-amber-100' : done ? 'text-gray-200' : 'text-gray-500'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-mono w-12 shrink-0">{clockText(event.atS)}</span>
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="flex-1">{t('lab', event.labelKey)}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <LabMissions prefix="lab_launch_" missions={missions} />
        <LabExplain
          simple={t('lab', 'launchExplainSimple')}
          formula={[t('lab', 'launchExplainFormula1'), t('lab', 'launchExplainFormula2')]}
          details={t('lab', 'launchExplainDetails')}
        />
        <LabFacts facts={LAUNCH_FACTS.map((fact) => ({ text: t('lab', fact.key), source: fact.source }))} />

        <div className="glass p-4 rounded-2xl">
          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'launchScaleNote')}</p>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
            <span className="uppercase tracking-wider">{t('lab', 'apolloSource')}: </span>
            {[SOURCES.afj, SOURCES.as506].join('; ')}
          </p>
        </div>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative h-[62vh] min-h-[360px] lg:h-full lg:min-h-[400px]">
        <Canvas
          camera={{ position: [4.2, 0, 12] }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
          <FitToViewport height={COLUMN} radius={RADIUS} />
          <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.6} />
          <AscentClock clockRef={clockRef} running={status === 'flight'} rate={rate} />
          <HologramStage height={COLUMN} radius={RADIUS} accent={HOLO.accent} spin={0} float={false}>
            <AltitudeScale t={t} />
            <Vehicle clockRef={clockRef} />
          </HologramStage>
          {/* No camera work of any kind here on purpose: the controls own the
              camera, and there is nothing to chase. */}
          <OrbitControls enablePan={false} minDistance={7} maxDistance={22} />
          <EffectComposer>
            {/* 0.6, not 1: at 1 nothing was ever bright enough to bloom except
                the additive plume, which then bloomed without limit. */}
            <Bloom luminanceThreshold={0.62} mipmapBlur intensity={0.5} />
            <Vignette eskil={false} offset={0.1} darkness={1.05} />
          </EffectComposer>
        </Canvas>

        <div className="absolute top-4 left-4 max-w-[55%] text-[11px] text-amber-100 bg-amber-500/15 border border-amber-400/40 px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none">
          {t('lab', 'launchNotToScale')}
        </div>
        <div className="absolute top-4 right-4 text-right pointer-events-none">
          <div className="font-mono text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">
            {statusText}
          </div>
          {reached.length ? (
            <div className="mt-1 text-xs text-amber-200">{t('lab', reached[reached.length - 1].labelKey)}</div>
          ) : null}
        </div>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')}
        </div>
      </div>
    </div>
  );
};
