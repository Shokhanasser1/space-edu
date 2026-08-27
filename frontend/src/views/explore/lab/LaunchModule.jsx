import { useEffect, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import {
  APOLLO_11_ASCENT,
  altitudeKmAt,
  burnRemaining,
  missionClock,
  stageAt,
} from './labFacts';
import { HOLO, HologramStage, HoloLabel, HoloMesh, ReleaseContextOnUnmount } from './Hologram';

/**
 * The Apollo 11 ascent, drawn as an altitude column.
 *
 * What this replaced, and why it is a column rather than a chase camera:
 *
 * - The old simulator wrote `camera.position` and `camera.lookAt` every frame
 *   while drei's OrbitControls wrote them back in the same frame. Controls won,
 *   because `update()` recomputes the camera from its own target, so the
 *   camera never followed: the rocket climbed out of the top of the frame in
 *   about two seconds and the reader watched an empty pad.
 * - Two additive cones with a bloom threshold of 1 filled the viewport with
 *   white within a second of liftoff. The whole screen was a white blob for the
 *   rest of the run.
 * - Nothing ended it. There was no cutoff, no staging you could see, no apogee
 *   and no return to the pad; RESET left the smoke and the rocket where they
 *   were.
 *
 * A fixed column solves the first by not needing a moving camera at all, and it
 * teaches something the chase never did: where the events happen. The two
 * marked altitudes are NASA's. Between them the trace is interpolated, and the
 * caption says so.
 */

/** The drawn column, in scene units, covering 0 to `ceilingKm`. */
const COLUMN = 11;
const RADIUS = 1.4;

/** Scene y for an altitude in kilometres. */
function kmToY(km) {
  return (km / APOLLO_11_ASCENT.ceilingKm) * COLUMN - COLUMN / 2;
}

/** The vehicle, small enough to read against the column it is climbing. */
const VEHICLE_H = 1.05;

function Vehicle({ clockRef }) {
  const stackRef = useRef(null);
  const boosterRef = useRef(null);
  const plumeRef = useRef(null);
  const traceRef = useRef(null);

  useFrame(() => {
    const seconds = clockRef.current;
    const y = kmToY(altitudeKmAt(seconds));
    const stage = stageAt(seconds);

    if (stackRef.current) stackRef.current.position.y = y;

    // The first stage lets go at cutoff and falls away behind the stack.
    if (boosterRef.current) {
      const sinceStaging = seconds - APOLLO_11_ASCENT.stages[0].untilS;
      if (sinceStaging <= 0) {
        boosterRef.current.position.set(0, -VEHICLE_H * 0.34, 0);
        boosterRef.current.rotation.z = 0;
      } else {
        boosterRef.current.position.y = -VEHICLE_H * 0.34 - sinceStaging * 0.012;
        boosterRef.current.position.x = sinceStaging * 0.0035;
        boosterRef.current.rotation.z = -sinceStaging * 0.02;
      }
    }

    if (plumeRef.current) {
      // Visible only while something is burning, and never more than a third
      // of the vehicle's own length. The old plume was five times the rocket.
      const burning = stage ? 0.35 + burnRemaining(seconds) * 0.25 : 0;
      plumeRef.current.scale.set(burning ? 1 : 0.0001, burning || 0.0001, burning ? 1 : 0.0001);
      plumeRef.current.material.opacity = burning ? 0.55 : 0;
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
        {/* Everything above the first stage: it is what reaches orbit. */}
        <HoloMesh active position={[0, VEHICLE_H * 0.25, 0]}>
          <cylinderGeometry args={[0.055, 0.075, VEHICLE_H * 0.5, 18]} />
        </HoloMesh>
        <HoloMesh active position={[0, VEHICLE_H * 0.56, 0]}>
          <coneGeometry args={[0.055, VEHICLE_H * 0.12, 18]} />
        </HoloMesh>

        <group ref={boosterRef} position={[0, -VEHICLE_H * 0.34, 0]}>
          <HoloMesh>
            <cylinderGeometry args={[0.075, 0.075, VEHICLE_H * 0.68, 18]} />
          </HoloMesh>
          <mesh ref={plumeRef} position={[0, -VEHICLE_H * 0.5, 0]}>
            <coneGeometry args={[0.07, VEHICLE_H * 0.55, 14]} />
            <meshBasicMaterial
              color="#ffb266"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Advances the simulated clock. The only thing in the scene that owns time. */
function AscentClock({ clockRef, running, rate }) {
  useFrame((_, delta) => {
    if (!running) return;
    const last = APOLLO_11_ASCENT.events[APOLLO_11_ASCENT.events.length - 1].atS;
    clockRef.current = Math.min(last, clockRef.current + delta * rate);
  });
  return null;
}

/** The marked altitudes, with the pad ring at the bottom of the column. */
function AltitudeScale({ t }) {
  return (
    <>
      {APOLLO_11_ASCENT.events.map((event, index) => (
        <group key={event.id} position={[0, kmToY(event.altitudeKm), 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[RADIUS * 0.72, RADIUS * 0.75, 64]} />
            <meshBasicMaterial
              color={HOLO.accent}
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <HoloLabel
            position={[RADIUS * 0.75, 0, 0]}
            side={index % 2 === 0 ? 1 : -1}
            title={t('lab', event.labelKey)}
            subtitle={`${event.altitudeKm} km`}
          />
        </group>
      ))}
    </>
  );
}

export const ApolloLaunchSimulator = () => {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);

  /** Simulated seconds since liftoff. Advanced in useFrame, sampled below. */
  const clockRef = useRef(0);
  const [status, setStatus] = useState('idle');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [rate, setRate] = useState(30);

  const finalS = APOLLO_11_ASCENT.events[APOLLO_11_ASCENT.events.length - 1].atS;

  // The countdown. It lives in an effect rather than in the click handler,
  // because an interval started in a handler has nothing to clear it: leaving
  // the module between "3" and "0" left it running for the rest of the visit.
  useEffect(() => {
    if (status !== 'countdown') return undefined;
    const id = setInterval(() => {
      setCountdown((remaining) => {
        if (remaining > 1) return remaining - 1;
        clockRef.current = 0;
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
      setElapsed(clockRef.current);
      if (clockRef.current >= finalS) setStatus('complete');
    }, 100);
    return () => clearInterval(id);
  }, [status, finalS]);

  const start = () => {
    if (status === 'idle') {
      trackEvent('lab_apollo_launch');
      setCountdown(3);
      setStatus('countdown');
      return;
    }
    clockRef.current = 0;
    setElapsed(0);
    setCountdown(3);
    setStatus('idle');
  };

  const stage = stageAt(elapsed);
  const statusText =
    status === 'idle'
      ? t('lab', 'statusHolding')
      : status === 'countdown'
        ? `T-00:0${countdown}`
        : status === 'complete'
          ? t('lab', 'statusOrbit')
          : missionClock(elapsed);

  const readouts = [
    { label: t('lab', 'launchStage'), value: stage ? t('lab', stage.nameKey) : t('lab', 'launchStageNone') },
    { label: t('lab', 'apolloFactThrust'), value: stage ? stage.thrust : '0 kN' },
    { label: t('lab', 'launchAltitude'), value: `${altitudeKmAt(elapsed).toFixed(0)} km` },
    { label: t('lab', 'launchBurnLeft'), value: `${Math.round(burnRemaining(elapsed) * 100)}%` },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-4 md:overflow-y-auto">
        <div className="glass p-5 rounded-2xl border border-orange-500/20">
          <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Flame className="text-orange-500" /> {t('lab', 'launchControl')}
          </h3>
          <p className="text-xs text-gray-400 mb-4">{t('lab', 'launchSubtitle')}</p>

          <div className="flex justify-center my-6">
            <button
              onClick={start}
              disabled={status === 'countdown'}
              className={`w-28 h-28 rounded-full font-bold text-xl border-4 flex items-center justify-center transition-all ${
                status === 'idle'
                  ? 'bg-red-500/20 border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                  : status === 'countdown'
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500'
                    : 'bg-space-700 border-space-600 text-gray-300 hover:bg-space-600'
              }`}
            >
              {status === 'idle'
                ? t('lab', 'launch')
                : status === 'countdown'
                  ? countdown
                  : t('lab', 'reset')}
            </button>
          </div>

          <div className="bg-space-800 p-4 rounded-xl border border-white/5 mb-4">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              {t('lab', 'status')}
            </div>
            <div className="font-mono text-neon-blue font-bold">{statusText}</div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-gray-400">
              <span>{t('lab', 'launchTimeRate')}</span>
              <span>{rate}x</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={rate}
              onChange={(e) => setRate(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500"
              aria-label={t('lab', 'launchTimeRate')}
            />
            {/* Named for what it is. The old control was labelled "launch speed"
                and its number was multiplied into the thrust readout. */}
            <p className="text-[10px] text-gray-500">{t('lab', 'launchTimeRateNote')}</p>
          </div>

          <dl className="grid grid-cols-2 gap-2">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300 break-words">{readout.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 pt-3 border-t border-white/10 text-[10px] leading-relaxed text-gray-500">
            {t('lab', 'launchScaleNote')}
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-gray-500">
            <span className="uppercase tracking-wider">{t('lab', 'apolloSource')}: </span>
            {APOLLO_11_ASCENT.stages.map((s) => s.source).join('; ')}
          </p>
        </div>
      </div>

      <div className="w-full md:w-2/3 bg-space-900/50 rounded-3xl border border-white/10 overflow-hidden relative min-h-[400px]">
        <Canvas
          camera={{ position: [4.2, 0, 12] }}
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <ReleaseContextOnUnmount />
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
            <Bloom luminanceThreshold={0.6} mipmapBlur intensity={0.7} />
            <Vignette eskil={false} offset={0.1} darkness={1.05} />
          </EffectComposer>
        </Canvas>
        <div className="absolute bottom-4 left-4 text-xs text-gray-400 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md">
          {t('lab', 'hintDrag')} — {t('lab', 'hintScroll')}
        </div>
      </div>
    </div>
  );
};
