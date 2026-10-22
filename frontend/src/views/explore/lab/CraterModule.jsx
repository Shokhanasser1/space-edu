import { useEffect, useMemo, useRef, useState } from 'react';
import { Target } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { useGamificationStore } from '@/store/useGamificationStore';
import { LabViewport } from './LabCanvas';
import {
  BODIES,
  GOOD_GUESS_FACTOR,
  MAX_SPEED_KMS,
  METEOR_CRATER,
  craterDepthAt,
  guessFactor,
  simulateImpact,
} from '@/lib/impacts';

/**
 * Crater Lab: guess the hole, then make it.
 *
 * The reader sets an asteroid (size, what it is made of, speed, angle) and a
 * target (Earth or the Moon), and says how wide they think the crater will
 * be before anything happens. "Impact!" flies the asteroid in, and the crater
 * opens in a cross-section drawn to true scale — no vertical exaggeration —
 * beside the Tashkent TV Tower and a scale bar, with the guess as a dashed
 * outline. The point is the surprise: a 50 m rock makes a hole more than a
 * kilometre wide, and the same rock makes a bigger one on the Moon.
 *
 * The crater's diameter comes from the Collins, Melosh & Marcus (2005) scaling
 * law in `lib/impacts.js`; its shape is schematic and the page says so. Mass,
 * energy and TNT are shown before the impact — they are the inputs' own
 * arithmetic — but the crater is not, so the guess is a guess.
 *
 * The scale fits the guess until the impact and then fits both, so the scale
 * bar cannot give the answer away before the reader has committed to one.
 */

const GOOD_GUESS_EVENT = 'lab_crater_prediction';

/** Drawing geometry, in viewBox units. */
const VIEW_W = 800;
const VIEW_H = 760;
const GROUND_Y = 440;
const IMPACT_X = 400;
const DRAW_W = 760;

/** Animation timeline, seconds. */
const FLIGHT_S = 1.1;
const FLASH_S = 0.35;
const GROW_S = 1.0;
const FAR_PX = 560;
const PARKED_PX = 300;

const TOWER_M = 375;

const BODY_LOOK = {
  earth: { skyTop: '#120a2e', skyBottom: '#3b2a6b', strata: ['#3a2a52', '#2a1f3d', '#1d1530'] },
  moon: { skyTop: '#000000', skyBottom: '#0b0b12', strata: ['#4b4b55', '#3a3a44', '#2a2a32'] },
};

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A number with a sensible count of places for its size. */
function short(n) {
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** 1, 2 or 5 times a power of ten, near `x`. */
function niceLength(x) {
  const power = 10 ** Math.floor(Math.log10(x));
  const step = [1, 2, 5, 10].find((s) => s * power >= x * 0.75) ?? 10;
  return step * power;
}

/** The ground line with a crater of `diameterM` cut into it, as an SVG path. */
function groundPath(diameterM, complex, pxPerM, viewWidthM) {
  const steps = 240;
  let d = `M0,${VIEW_H} L0,${GROUND_Y}`;
  for (let i = 0; i <= steps; i += 1) {
    const x = -viewWidthM / 2 + (viewWidthM * i) / steps;
    const depth = diameterM > 0 ? craterDepthAt(x, diameterM, complex) : 0;
    d += ` L${(IMPACT_X + x * pxPerM).toFixed(1)},${(GROUND_Y + depth * pxPerM).toFixed(1)}`;
  }
  return `${d} L${VIEW_W},${GROUND_Y} L${VIEW_W},${VIEW_H} Z`;
}

/** The dashed bowl a guess would make. */
function guessPath(diameterM, pxPerM) {
  const radius = diameterM / 2;
  let d = '';
  for (let i = 0; i <= 60; i += 1) {
    const x = -radius + (diameterM * i) / 60;
    const r = x / radius;
    const depth = 0.2 * diameterM * (1 - r * r);
    d += `${i ? 'L' : 'M'}${(IMPACT_X + x * pxPerM).toFixed(1)},${(GROUND_Y + depth * pxPerM).toFixed(1)}`;
  }
  return d;
}

/** `5.1 × 10^8` with the exponent raised. */
function Scientific({ value, unit }) {
  const exponent = Math.floor(Math.log10(value));
  const mantissa = (value / 10 ** exponent).toFixed(1);
  return (
    <>
      {mantissa}×10<sup>{exponent}</sup> {unit}
    </>
  );
}

export function CraterImpactLab() {
  const { t } = useTranslation();
  const trackEvent = useGamificationStore((s) => s.trackEvent);
  const alreadyEarned = useGamificationStore((s) => s.trackedEvents.includes(GOOD_GUESS_EVENT));

  const [body, setBody] = useState(METEOR_CRATER.body);
  const [diameterLog, setDiameterLog] = useState(Math.log10(METEOR_CRATER.diameterM));
  const [composition, setComposition] = useState(METEOR_CRATER.composition);
  const [speedKms, setSpeedKms] = useState(METEOR_CRATER.speedKms);
  const [angleDeg, setAngleDeg] = useState(METEOR_CRATER.angleDeg);
  const [guessLog, setGuessLog] = useState(Math.log10(300));
  const [phase, setPhase] = useState('pre');

  const groundRef = useRef(null);
  const asteroidRef = useRef(null);
  const trailRef = useRef(null);
  const flashRef = useRef(null);

  const diameterM = 10 ** diameterLog;
  const guessM = 10 ** guessLog;
  const params = useMemo(
    () => ({ body, diameterM, composition, speedKms, angleDeg }),
    [body, diameterM, composition, speedKms, angleDeg],
  );
  const result = useMemo(() => simulateImpact(params), [params]);
  const meteor = useMemo(() => simulateImpact(METEOR_CRATER), []);

  const revealed = phase !== 'pre';
  const viewWidthM = revealed ? Math.max(guessM, result.diameterM) * 1.6 : Math.max(guessM * 1.6, 200);
  const pxPerM = DRAW_W / viewWidthM;
  const theta = (angleDeg * Math.PI) / 180;
  const astR = Math.max(4, (diameterM * pxPerM) / 2);
  const factor = guessFactor(guessM, result.diameterM);
  const goodGuess = factor <= GOOD_GUESS_FACTOR;

  const formatDistance = (m) =>
    m < 1000
      ? t('lab', 'craterMeters', { value: m < 10 ? m.toFixed(1) : Math.round(m) })
      : t('lab', 'craterKm', { value: short(m / 1000) });

  const formatTnt = (mt) => {
    if (mt < 1) return t('lab', 'craterKt', { value: short(mt * 1000) });
    if (mt >= 1000) return t('lab', 'craterGt', { value: short(mt / 1000) });
    return t('lab', 'craterMt', { value: short(mt) });
  };

  // Any change to the inputs or the guess starts a new experiment.
  const change = (setter) => (value) => {
    setter(value);
    setPhase('pre');
  };

  const setTarget = (next) => {
    setBody(next);
    setSpeedKms((v) => Math.max(v, BODIES[next].minSpeedKms));
    setPhase('pre');
  };

  const applyMeteorPreset = () => {
    setBody(METEOR_CRATER.body);
    setDiameterLog(Math.log10(METEOR_CRATER.diameterM));
    setComposition(METEOR_CRATER.composition);
    setSpeedKms(METEOR_CRATER.speedKms);
    setAngleDeg(METEOR_CRATER.angleDeg);
    setPhase('pre');
  };

  const impact = () => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      setPhase('done');
      if (goodGuess) trackEvent(GOOD_GUESS_EVENT);
      return;
    }
    setPhase('animating');
  };

  // The flight, the flash and the crater opening, written straight to the
  // DOM so the 240-point ground path is not pushed through React each frame.
  useEffect(() => {
    if (phase !== 'animating') return undefined;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const trailPx = Math.max(60, astR * 8);
    const begin = performance.now();
    let frame = 0;
    const step = (now) => {
      const s = (now - begin) / 1000;
      if (s < FLIGHT_S) {
        const dist = FAR_PX * (1 - s / FLIGHT_S);
        const x = IMPACT_X - dist * cos;
        const y = GROUND_Y - dist * sin;
        asteroidRef.current?.setAttribute('cx', x);
        asteroidRef.current?.setAttribute('cy', y);
        trailRef.current?.setAttribute('x1', x - trailPx * cos);
        trailRef.current?.setAttribute('y1', y - trailPx * sin);
        trailRef.current?.setAttribute('x2', x);
        trailRef.current?.setAttribute('y2', y);
      } else {
        asteroidRef.current?.setAttribute('opacity', 0);
        trailRef.current?.setAttribute('opacity', 0);
        const flash = Math.min(1, (s - FLIGHT_S) / FLASH_S);
        flashRef.current?.setAttribute('r', 20 + 180 * flash);
        flashRef.current?.setAttribute('opacity', 1 - flash);
        const grow = Math.min(1, (s - FLIGHT_S) / GROW_S);
        const eased = 1 - (1 - grow) ** 3;
        groundRef.current?.setAttribute(
          'd',
          groundPath(result.diameterM * eased, result.complex, pxPerM, viewWidthM),
        );
      }
      if (s >= FLIGHT_S + GROW_S + 0.1) {
        setPhase('done');
        if (goodGuess) trackEvent(GOOD_GUESS_EVENT);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [phase, theta, astR, result, pxPerM, viewWidthM, goodGuess, trackEvent]);

  const look = BODY_LOOK[body];
  const ground = groundPath(phase === 'done' ? result.diameterM : 0, result.complex, pxPerM, viewWidthM);
  const towerPx = TOWER_M * pxPerM;
  const towerX = 740;
  const towerTop = Math.max(8, GROUND_Y - towerPx);
  const barM = niceLength(viewWidthM / 4);
  const barPx = barM * pxPerM;
  const guessDepthPx = 0.2 * guessM * pxPerM;
  const parked = { x: IMPACT_X - PARKED_PX * Math.cos(theta), y: GROUND_Y - PARKED_PX * Math.sin(theta) };
  const craterRadiusPx = (result.diameterM / 2) * pxPerM;
  const rimPx = (result.complex ? 0.015 : 0.03) * result.diameterM * pxPerM;
  const airburst = body === 'earth' && composition !== 'iron' && diameterM <= 100;

  const readouts = [
    { label: t('lab', 'craterMass'), value: <Scientific value={result.mass} unit={t('lab', 'craterKg')} /> },
    { label: t('lab', 'craterEnergy'), value: <Scientific value={result.energy} unit={t('lab', 'craterJoule')} /> },
    { label: t('lab', 'craterTnt'), value: formatTnt(result.megatons) },
    { label: t('lab', 'craterCrater'), value: phase === 'done' ? formatDistance(result.diameterM) : '—' },
  ];

  const slider = (label, value, display, min, max, step, onChange, note) => (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 text-sm text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-white text-right">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
        aria-label={label}
      />
      {note ? <p className="text-[11px] leading-relaxed text-gray-500">{note}</p> : null}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Target className="text-red-400" /> {t('lab', 'craterTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'craterSubtitle')}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('lab', 'craterTarget')}</p>
            <div className="grid grid-cols-2 gap-2" role="tablist">
              {[
                ['earth', t('lab', 'craterEarth')],
                ['moon', t('lab', 'craterMoon')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={body === id}
                  onClick={() => setTarget(id)}
                  className={`py-2 rounded-lg text-sm transition-colors ${
                    body === id ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-wider text-violet-300">{t('lab', 'craterPredictTitle')}</p>
            <p className="text-sm text-white">{t('lab', 'craterPredictQuestion')}</p>
            {slider(t('lab', 'craterGuess'), guessLog, formatDistance(guessM), 1, Math.log10(300000), 0.01, change(setGuessLog))}
          </div>

          <div className="space-y-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">{t('lab', 'craterImpactor')}</p>
            {slider(t('lab', 'craterDiameter'), diameterLog, formatDistance(diameterM), 1, Math.log10(5000), 0.01, change(setDiameterLog))}
            <div className="grid grid-cols-3 gap-2">
              {[
                ['ice', t('lab', 'craterIce')],
                ['stone', t('lab', 'craterStone')],
                ['iron', t('lab', 'craterIron')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => change(setComposition)(id)}
                  aria-pressed={composition === id}
                  aria-label={`${t('lab', 'craterComposition')}: ${label}`}
                  className={`py-2 rounded-lg text-sm transition-colors ${
                    composition === id ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {slider(
              t('lab', 'craterSpeed'),
              speedKms,
              t('lab', 'craterKms', { value: speedKms.toFixed(1) }),
              BODIES[body].minSpeedKms,
              MAX_SPEED_KMS,
              0.1,
              change(setSpeedKms),
              t('lab', body === 'earth' ? 'craterSpeedFloorEarth' : 'craterSpeedFloorMoon', {
                min: BODIES[body].minSpeedKms,
              }),
            )}
            {slider(t('lab', 'craterAngle'), angleDeg, `${angleDeg}°`, 15, 90, 1, change(setAngleDeg), t('lab', 'craterAngleNote'))}
          </div>

          {airburst ? (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">
              {t('lab', 'craterAirburst')}
            </p>
          ) : null}

          <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
              </div>
            ))}
          </dl>

          {phase === 'done' ? (
            <div
              role="status"
              className={`rounded-2xl border p-4 text-sm leading-relaxed ${
                goodGuess ? 'border-green-400/40 bg-green-500/10 text-green-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
              }`}
            >
              <p className="font-semibold">
                {goodGuess
                  ? t('lab', 'craterResultClose')
                  : t('lab', result.diameterM > guessM ? 'craterResultBigger' : 'craterResultSmaller', {
                      ratio: short(factor),
                    })}
              </p>
              <p className="mt-2 text-xs">
                {t('lab', 'craterResultLine', { model: formatDistance(result.diameterM), guess: formatDistance(guessM) })}
              </p>
              {result.complex ? (
                <p className="mt-2 text-xs text-gray-300">
                  {t('lab', 'craterComplexNote', { dc: formatDistance(BODIES[body].transitionDiameterM) })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              onClick={impact}
              disabled={phase === 'animating'}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-500 shadow-[0_0_22px_rgba(124,58,237,0.45)] hover:brightness-110 disabled:opacity-60"
            >
              {t('lab', 'craterImpact')}
            </button>
            <span className="px-3 py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30">
              {t('lab', alreadyEarned ? 'craterXpEarned' : 'craterXpReward')}
            </span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-gray-300 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{t('lab', 'craterMeteorTitle')}</p>
            <p>{t('lab', 'craterMeteorText', { model: formatDistance(meteor.diameterM) })}</p>
            <button onClick={applyMeteorPreset} className="text-cyan-300 hover:text-cyan-200">
              {t('lab', 'craterMeteorPreset')}
            </button>
          </div>

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'craterModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', 'craterHint')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'craterView')}
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
          role="img"
          aria-label={t('lab', 'craterChartLabel')}
        >
          <defs>
            <linearGradient id="crater-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={look.skyTop} stopOpacity="0" />
              <stop offset="1" stopColor={look.skyBottom} stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="crater-strata" x1="0" y1="0" x2="0" y2={VIEW_H} gradientUnits="userSpaceOnUse">
              <stop offset={`${(GROUND_Y - 40) / VIEW_H}`} stopColor={look.strata[0]} />
              <stop offset={`${(GROUND_Y + 110) / VIEW_H}`} stopColor={look.strata[0]} />
              <stop offset={`${(GROUND_Y + 110) / VIEW_H}`} stopColor={look.strata[1]} />
              <stop offset={`${(GROUND_Y + 210) / VIEW_H}`} stopColor={look.strata[1]} />
              <stop offset={`${(GROUND_Y + 210) / VIEW_H}`} stopColor={look.strata[2]} />
              <stop offset="1" stopColor={look.strata[2]} />
            </linearGradient>
            <radialGradient id="crater-rock" cx="0.35" cy="0.35">
              <stop offset="0" stopColor="#d1d5db" />
              <stop offset="1" stopColor="#4b5563" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width={VIEW_W} height={GROUND_Y} fill="url(#crater-sky)" />
          {/* Keyed by phase: the animation writes `d` behind React's back, so a
              new phase gets a fresh element rather than a half-grown crater. */}
          <path key={`ground-${phase}`} ref={groundRef} d={ground} fill="url(#crater-strata)" stroke="#fbbf24" strokeOpacity="0.45" strokeWidth="1.5" />

          {/* The guess, as the bowl it would make. */}
          <path d={guessPath(guessM, pxPerM)} fill="none" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="6 5" />
          <text
            x={IMPACT_X}
            y={Math.min(VIEW_H - 40, GROUND_Y + guessDepthPx + 26)}
            textAnchor="middle"
            className="fill-violet-200"
            fontSize="16"
          >
            {t('lab', 'craterGuessLabel', { value: formatDistance(guessM) })}
          </text>

          {/* The TV tower at the same scale, or a note when it would be a speck. */}
          {towerPx >= 2 ? (
            <g stroke="#cbd5e1" strokeWidth="2" fill="none">
              <line x1={towerX} y1={GROUND_Y} x2={towerX} y2={towerTop} />
              <line x1={towerX - Math.min(10, towerPx * 0.06)} y1={GROUND_Y} x2={towerX} y2={Math.max(towerTop, GROUND_Y - towerPx * 0.15)} />
              <line x1={towerX + Math.min(10, towerPx * 0.06)} y1={GROUND_Y} x2={towerX} y2={Math.max(towerTop, GROUND_Y - towerPx * 0.15)} />
              {GROUND_Y - towerPx * 0.7 > towerTop ? (
                <ellipse cx={towerX} cy={GROUND_Y - towerPx * 0.7} rx={Math.max(2, Math.min(9, towerPx * 0.05))} ry={Math.max(1.5, Math.min(5, towerPx * 0.03))} fill="#cbd5e1" />
              ) : null}
            </g>
          ) : null}
          <text x={VIEW_W - 16} y={towerPx >= 2 ? Math.max(26, towerTop - 12) : GROUND_Y - 14} textAnchor="end" className="fill-gray-400" fontSize="15">
            {t('lab', towerPx >= 2 ? 'craterTower' : 'craterTowerTiny')}
          </text>

          {/* The asteroid: parked on its line before the impact, flying during it. */}
          {phase !== 'done' ? (
            <g key={`asteroid-${phase}`}>
              <line
                x1={IMPACT_X - FAR_PX * Math.cos(theta)}
                y1={GROUND_Y - FAR_PX * Math.sin(theta)}
                x2={IMPACT_X}
                y2={GROUND_Y}
                stroke="#fbbf24"
                strokeOpacity="0.5"
                strokeDasharray="6 6"
              />
              <path
                d={`M${IMPACT_X - 60} ${GROUND_Y} A60 60 0 0 1 ${IMPACT_X - 60 * Math.cos(theta)} ${GROUND_Y - 60 * Math.sin(theta)}`}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              />
              <text x={IMPACT_X - 70} y={GROUND_Y - 14} textAnchor="end" className="fill-amber-300 font-mono" fontSize="16" fontWeight="700">
                {`${angleDeg}°`}
              </text>
              <line
                ref={trailRef}
                x1={parked.x}
                y1={parked.y}
                x2={parked.x}
                y2={parked.y}
                stroke="#fb923c"
                strokeOpacity="0.7"
                strokeWidth={Math.max(4, astR * 1.4)}
                strokeLinecap="round"
              />
              <circle ref={asteroidRef} cx={parked.x} cy={parked.y} r={astR} fill="url(#crater-rock)" />
            </g>
          ) : null}
          <circle key={`flash-${phase}`} ref={flashRef} cx={IMPACT_X} cy={GROUND_Y} r="0" fill="#fde68a" opacity="0" />

          {/* The answer, once there is one. */}
          {phase === 'done' ? (
            <g>
              <line x1={IMPACT_X - craterRadiusPx} x2={IMPACT_X + craterRadiusPx} y1={GROUND_Y - rimPx - 28} y2={GROUND_Y - rimPx - 28} stroke="#67e8f9" strokeWidth="1.5" />
              <line x1={IMPACT_X - craterRadiusPx} x2={IMPACT_X - craterRadiusPx} y1={GROUND_Y - rimPx - 36} y2={GROUND_Y - rimPx - 20} stroke="#67e8f9" strokeWidth="1.5" />
              <line x1={IMPACT_X + craterRadiusPx} x2={IMPACT_X + craterRadiusPx} y1={GROUND_Y - rimPx - 36} y2={GROUND_Y - rimPx - 20} stroke="#67e8f9" strokeWidth="1.5" />
              <text x={IMPACT_X} y={GROUND_Y - rimPx - 40} textAnchor="middle" className="fill-cyan-300 font-mono" fontSize="20" fontWeight="700">
                {formatDistance(result.diameterM)}
              </text>
            </g>
          ) : null}

          {/* Scale bar. */}
          <g stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2">
            <line x1="30" y1={VIEW_H - 46} x2={30 + barPx} y2={VIEW_H - 46} />
            <line x1="30" y1={VIEW_H - 54} x2="30" y2={VIEW_H - 38} />
            <line x1={30 + barPx} y1={VIEW_H - 54} x2={30 + barPx} y2={VIEW_H - 38} />
          </g>
          <text x={30 + barPx / 2} y={VIEW_H - 18} textAnchor="middle" className="fill-white" fontSize="16">
            {formatDistance(barM)}
          </text>
        </svg>
      </LabViewport>
    </div>
  );
}
