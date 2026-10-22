import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Orbit, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import { starColour } from '@/lib/hrDiagram';
import {
  EARTH_RADIUS_KM,
  JUPITER_RADIUS_KM,
  OBSERVATION,
  REAL_PLANETS,
  STAR_TYPES,
  SUN_RADIUS_KM,
  buildLightCurve,
  earthRadiiFromRatio,
  evaluateMarks,
  modelFlux,
  planetClassKey,
  radiusRatio,
  randomPlanet,
  snapToDip,
  starOf,
  transitCenters,
  transitDepth,
} from '@/lib/transits';

/**
 * Exoplanet Hunter: find a planet the way TESS does, from the dip in its
 * star's light.
 *
 * Two modes, and they teach different halves of the method:
 *
 * - **Simulation.** The reader sets the planet's size, its year and its star,
 *   and watches what each does to the light curve. It opens on a prediction —
 *   "double the radius, how much deeper is the dip?" — because the answer
 *   (four times: area goes as the square) is the whole of the physics. The
 *   star choice is the other half of it: the same planet round a smaller star
 *   blocks more of it, which is why an Earth-sized planet that is invisible in
 *   front of the Sun is easy in front of TRAPPIST-1. Real planets are one tap
 *   away, with published sizes, so the dips on screen are the dips astronomers
 *   measured. Time slows while the planet is on the disc so the crossing can
 *   be watched — for about three seconds, whether the transit lasts one hour
 *   or four — and runs fast between transits.
 * - **Mystery star.** A planet the reader cannot see, round a star whose size
 *   they are told. They mark the dips; the depth and the star's size give the
 *   planet's radius, the spacing gives its year, and the numbers shown are
 *   measured from their marks, not read from the answer. Time runs at one
 *   rate here — slowing near a transit would give its position away — and the
 *   planet is not drawn, because nobody has ever seen one of these planets
 *   cross its star; the star only dims.
 *
 * No WebGL: a light curve is a chart, and SVG draws it crisply at every size on
 * the cheapest phone. The animation writes to a few DOM nodes through refs
 * rather than through React state, so the chart's 1700-point path is not
 * re-rendered sixty times a second.
 *
 * Every number comes from `lib/transits.js`, which names its constants and
 * sources. The model's simplifications are printed under the panel.
 */

const SIM_EPOCH_DAYS = 1.2;
const SIM_SEED = 7;
const CORRECT_PREDICTION = 'x4';

/** Days of simulated time per real second. Slow near a transit: a third of it per second. */
const FAST_RATE = 1;
const HUNT_RATE = 0.8;
const SLOW_SECONDS_PER_TRANSIT = 3;

/** Planet radius slider, in Earth radii, on a log scale: Mars-sized to a puffed-up giant. */
const RADIUS_MIN = 0.5;
const RADIUS_MAX = 25;
const PERIOD_MIN = 0.5;
const PERIOD_MAX = 6.5;

/** Drawing geometry, in viewBox units. */
const VIEW_W = 800;
const VIEW_H = 760;
const STAR = { x: 450, y: 185, r: 118 };
const PLOT = { x0: 84, x1: 772, y0: 478, y1: 680 };
const PX_PER_DAY = (PLOT.x1 - PLOT.x0) / OBSERVATION.spanDays;
const dayToX = (t) => PLOT.x0 + t * PX_PER_DAY;

/**
 * The size comparison card: the star's edge drawn at radius 64, Jupiter and
 * Earth beside it at fixed centres. Jupiter next to TRAPPIST-1 is 55 units
 * across the card's radius scale — the widest it gets — and still clears both
 * the star's edge and Earth.
 */
const SCALE = { x: 22, y: 232, w: 236, h: 158, starR: 64, jupiterX: 160, earthX: 232 };

const FACT_COUNT = 7;

/** Percent with enough places to show a small dip. */
function formatPercent(fraction) {
  const pct = fraction * 100;
  return pct.toFixed(pct < 0.1 ? 3 : 2);
}

/** Earth radii at a precision that suits the size. */
const formatRadius = (r) => (r < 10 ? r.toFixed(2) : r.toFixed(1));

/** Solar radii: 1 stays 1, TRAPPIST-1 keeps its three places. */
const formatStarRadius = (r) => String(Number(r.toPrecision(3)));

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const newSeed = () => Math.floor(Math.random() * 2147483647);

/** A tick spacing that gives three to five labels across the flux range. */
function fluxTicks(top, bottom) {
  const rangePct = (top - bottom) * 100;
  const step = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2].find((s) => rangePct / s <= 5) ?? 5;
  const ticks = [];
  for (let v = 100; v / 100 >= bottom; v -= step) ticks.push(v);
  return { ticks, places: step < 0.1 ? 2 : 1 };
}

export function ExoplanetHunterLab() {
  const { t } = useTranslation();

  const [mode, setMode] = useState('sim');
  const [star, setStar] = useState(STAR_TYPES[0]);
  const [radiusEarth, setRadiusEarth] = useState((1 * JUPITER_RADIUS_KM) / EARTH_RADIUS_KM);
  const [periodDays, setPeriodDays] = useState(3.52);
  const [presetId, setPresetId] = useState(null);
  const [presetsTried, setPresetsTried] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [huntSeed, setHuntSeed] = useState(newSeed);
  const [marks, setMarks] = useState([]);
  const [result, setResult] = useState(null);
  const [foundSeeds, setFoundSeeds] = useState([]);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  const svgRef = useRef(null);
  const playheadRef = useRef(null);
  const planetRef = useRef(null);
  const dimRef = useRef(null);
  const dayRef = useRef(null);
  const countdownRef = useRef(null);
  const timeRef = useRef(0);

  const hunting = mode === 'hunt';

  const simPlanet = useMemo(
    () => ({
      rpOverRs: radiusRatio(radiusEarth, star),
      periodDays,
      epochDays: SIM_EPOCH_DAYS,
      seed: SIM_SEED,
      star,
    }),
    [radiusEarth, star, periodDays],
  );
  const huntPlanet = useMemo(() => randomPlanet(huntSeed), [huntSeed]);
  const planet = hunting ? huntPlanet : simPlanet;
  const host = starOf(planet);

  const curve = useMemo(() => buildLightCurve(planet), [planet]);
  const duration = curve.duration;
  const depth = transitDepth(planet.rpOverRs);
  const simDepth = transitDepth(simPlanet.rpOverRs);
  const hostColour = starColour(host.teffK);

  // The flux axis fits the dip, as any plotting tool would, with the noise
  // floor as a minimum so an Earth-sized dip is shown lost in the scatter
  // rather than magnified out of it.
  const chart = useMemo(() => {
    const top = 1 + OBSERVATION.noise * 4;
    const bottom = 1 - Math.max(depth * 1.3, OBSERVATION.noise * 8);
    const fluxToY = (f) => {
      const y = PLOT.y0 + ((top - f) / (top - bottom)) * (PLOT.y1 - PLOT.y0);
      return Math.min(PLOT.y1, Math.max(PLOT.y0, y));
    };
    let path = '';
    for (let i = 0; i < curve.times.length; i += 1) {
      path += `${i ? 'L' : 'M'}${dayToX(curve.times[i]).toFixed(1)},${fluxToY(curve.flux[i]).toFixed(1)}`;
    }
    return { fluxToY, path, ...fluxTicks(top, bottom) };
  }, [curve, depth]);

  // Templates for the two strings the animation rewrites every frame, kept in
  // a ref so the frame loop does not restart whenever `t` is re-created.
  const templatesRef = useRef({});
  templatesRef.current = {
    day: t('lab', 'exoDay', { day: '{day}' }),
    countdown: t('lab', 'exoNextTransit', { days: '{days}' }),
  };

  const paint = useCallback(
    (time) => {
      const x = dayToX(time);
      playheadRef.current?.setAttribute('x1', x);
      playheadRef.current?.setAttribute('x2', x);
      if (dayRef.current) dayRef.current.textContent = templatesRef.current.day.replace('{day}', time.toFixed(1));

      const n = Math.round((time - planet.epochDays) / planet.periodDays);
      const fromCenter = time - (planet.epochDays + n * planet.periodDays);
      const crossing = !hunting && Math.abs(fromCenter) < duration * 0.9;
      if (planetRef.current) {
        const offset = (fromCenter / (duration / 2)) * STAR.r * (1 + planet.rpOverRs);
        planetRef.current.setAttribute('cx', STAR.x + offset);
        planetRef.current.setAttribute('opacity', crossing ? 1 : 0);
      }
      // The dimming is drawn 25 times stronger than it is, capped, so that a
      // one-per-cent dip is visible on a screen at all. The note says so.
      const dim = Math.min(0.45, 25 * (1 - modelFlux(time, planet, duration)));
      dimRef.current?.setAttribute('opacity', dim);

      if (countdownRef.current) {
        let next = planet.epochDays + Math.ceil((time - planet.epochDays) / planet.periodDays) * planet.periodDays;
        if (next < time) next += planet.periodDays;
        countdownRef.current.textContent =
          hunting || crossing ? '' : templatesRef.current.countdown.replace('{days}', (next - time).toFixed(1));
      }
    },
    [planet, duration, hunting],
  );

  useEffect(() => {
    paint(timeRef.current);
    if (!playing || typeof requestAnimationFrame !== 'function') return undefined;
    let frame = 0;
    let last = performance.now();
    const slowRate = Math.max(0.008, duration / SLOW_SECONDS_PER_TRANSIT);
    const step = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const time = timeRef.current;
      const n = Math.round((time - planet.epochDays) / planet.periodDays);
      const near = Math.abs(time - (planet.epochDays + n * planet.periodDays)) < duration * 1.2;
      const rate = hunting ? HUNT_RATE : near ? slowRate : FAST_RATE;
      timeRef.current = (time + rate * dt) % OBSERVATION.spanDays;
      paint(timeRef.current);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, paint, planet, duration, hunting]);

  const switchMode = (next) => {
    setMode(next);
    setMarks([]);
    setResult(null);
    timeRef.current = 0;
  };

  const newStar = () => {
    setHuntSeed(newSeed());
    setMarks([]);
    setResult(null);
    timeRef.current = 0;
  };

  const pickStar = (type) => {
    setStar(type);
    setPresetId(null);
  };

  const pickPreset = (id) => {
    const preset = REAL_PLANETS.find((p) => p.id === id);
    if (!preset) return;
    setStar(preset.star);
    setRadiusEarth(preset.radiusEarth);
    setPeriodDays(preset.periodDays);
    setPresetId(id);
    setPresetsTried((tried) => (tried.includes(id) ? tried : [...tried, id]));
  };

  // A mark toggles: a second tap near an existing one takes it away.
  const toggleMark = (rawTime) => {
    const time = snapToDip(curve, Math.min(OBSERVATION.spanDays, Math.max(0, rawTime)));
    setMarks((previous) => {
      const near = previous.findIndex((m) => Math.abs(m - time) < 0.15);
      return near >= 0 ? previous.filter((_, i) => i !== near) : [...previous, time];
    });
    setResult(null);
  };

  const onChartClick = (event) => {
    if (!hunting) return;
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(ctm.inverse());
    if (x < PLOT.x0 || x > PLOT.x1 || y < PLOT.y0 - 40 || y > PLOT.y1 + 10) return;
    toggleMark((x - PLOT.x0) / PX_PER_DAY);
  };

  const check = () => {
    const verdict = evaluateMarks(marks, planet, curve);
    setResult(verdict);
    if (verdict.status === 'found') {
      setFoundSeeds((seeds) => (seeds.includes(huntSeed) ? seeds : [...seeds, huntSeed]));
    }
  };

  // What the readouts show: the planet itself while simulating, the reader's
  // own measurement once they have found it, and nothing before that.
  const shown = hunting
    ? result?.status === 'found'
      ? { depth: result.depth, ratio: result.ratio, period: result.period, radiusEarth: result.radiusEarth }
      : null
    : { depth, ratio: planet.rpOverRs, period: planet.periodDays, radiusEarth };

  const readouts = [
    { label: t('lab', 'exoDepth'), value: shown ? `${formatPercent(shown.depth)} %` : '—' },
    { label: t('lab', 'exoRatio'), value: shown ? shown.ratio.toFixed(3) : '—' },
    { label: t('lab', 'exoPeriod'), value: shown ? t('lab', 'exoDays', { value: shown.period.toFixed(2) }) : '—' },
    {
      label: t('lab', 'exoType'),
      value: shown ? t('lab', planetClassKey(shown.radiusEarth, shown.period)) : '—',
    },
  ];

  const centers = transitCenters(planet);
  const sortedMarks = [...marks].sort((a, b) => a - b);
  // Which pair of dips the period bracket spans, and which dip the depth arrow
  // sits beside: the planet's own while simulating, the reader's once found.
  const bracket = !hunting && centers.length >= 2
    ? { from: centers[0], to: centers[1], period: planet.periodDays, depth, at: centers[1] }
    : result?.status === 'found'
      ? { from: sortedMarks[0], to: sortedMarks[1], period: result.period, depth: result.depth, at: sortedMarks[1] }
      : null;

  const resultMessage = (() => {
    if (!result) return null;
    switch (result.status) {
      case 'empty': return t('lab', 'exoResultEmpty');
      case 'miss': return t('lab', 'exoResultMiss', { n: result.misses });
      case 'one': return t('lab', 'exoResultOne');
      case 'skipped': return t('lab', 'exoResultSkipped');
      default: return t('lab', 'exoResultFound');
    }
  })();

  const lostInNoise = !hunting && depth < 3 * OBSERVATION.noise;
  const jupiterRadii = (radiusEarth * EARTH_RADIUS_KM) / JUPITER_RADIUS_KM;
  const starName = t('lab', host.nameKey);

  const missions = [
    { id: 'predict', title: t('lab', 'exoMissionPredict'), done: prediction === CORRECT_PREDICTION },
    {
      id: 'real',
      title: t('lab', 'exoMissionReal'),
      hint: t('lab', 'exoMissionRealHint', { n: Math.min(3, presetsTried.length) }),
      done: presetsTried.length >= 3,
    },
    {
      id: 'earth',
      title: t('lab', 'exoMissionEarth'),
      hint: t('lab', 'exoMissionEarthHint'),
      done: radiusEarth <= 1.25 && simDepth >= 3 * OBSERVATION.noise,
    },
    { id: 'hunt', title: t('lab', 'exoMissionHunt'), done: foundSeeds.length >= 1 },
    {
      id: 'hunt2',
      title: t('lab', 'exoMissionHunt2'),
      hint: t('lab', 'exoMissionHunt2Hint', { n: Math.min(2, foundSeeds.length) }),
      done: foundSeeds.length >= 2,
    },
  ];

  const facts = Array.from({ length: FACT_COUNT }, (_, i) => ({
    text: t('lab', `exoFact${i + 1}`),
    source: t('lab', `exoFactSrc${i + 1}`),
  }));

  // The comparison card draws the host star, Jupiter and Earth to one scale.
  const scaleJupiter = Math.min(56, (SCALE.starR * JUPITER_RADIUS_KM) / (host.radiusSun * SUN_RADIUS_KM));
  const scaleEarth = Math.max(1, (SCALE.starR * EARTH_RADIUS_KM) / (host.radiusSun * SUN_RADIUS_KM));
  const scaleMidY = SCALE.y + 80;
  const { jupiterX, earthX } = SCALE;
  // A darker, warmer rim gives the disc depth; the light curve itself has no
  // limb darkening, and the note says so.
  const [cr, cg, cb] = hostColour.match(/\d+/g).map(Number);
  const hostRim = `rgb(${cr},${Math.round(cg * 0.82)},${Math.round(cb * 0.62)})`;

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Orbit className="text-amber-400" /> {t('lab', 'exoTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'exoSubtitle')}</p>
          </div>

          {/* Stacked from md until xl: up to 1280 px the panel is a third of
              what the sidebar leaves, and "Simulyatsiya" no longer fits half
              of it. Side by side on phones and wide screens. */}
          <div className="grid grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-2" role="tablist">
            {[
              ['sim', t('lab', 'exoModeSim')],
              ['hunt', t('lab', 'exoModeHunt')],
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => switchMode(id)}
                className={`py-2 min-h-[40px] rounded-lg text-sm transition-colors ${
                  mode === id ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!hunting ? (
            <>
              <LabPresets
                label={t('lab', 'exoPresetsTitle')}
                presets={REAL_PLANETS.map((p) => ({ id: p.id, label: t('lab', p.nameKey) }))}
                activeId={presetId}
                onPick={pickPreset}
              />

              <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-4">
                <p className="text-[11px] uppercase tracking-wider text-violet-300 mb-2">{t('lab', 'exoPredictTitle')}</p>
                <p className="text-sm text-white mb-3">{t('lab', 'exoPredictQuestion')}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['x2', t('lab', 'exoPredictX2')],
                    ['x4', t('lab', 'exoPredictX4')],
                    ['same', t('lab', 'exoPredictSame')],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setPrediction(id)}
                      aria-pressed={prediction === id}
                      className={`px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-full text-xs border transition-colors ${
                        prediction === id
                          ? id === CORRECT_PREDICTION
                            ? 'bg-green-500/20 border-green-400 text-green-200'
                            : 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {prediction ? (
                  <p
                    className={`mt-3 text-xs leading-relaxed ${
                      prediction === CORRECT_PREDICTION ? 'text-green-300' : 'text-amber-200'
                    }`}
                  >
                    {t('lab', prediction === CORRECT_PREDICTION ? 'exoPredictRight' : 'exoPredictWrong')}
                  </p>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{t('lab', 'exoStarTitle')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {STAR_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => pickStar(type)}
                      aria-pressed={star.id === type.id}
                      className={`flex items-center gap-2 min-h-[44px] rounded-lg px-2.5 py-2 text-left text-xs border transition-colors ${
                        star.id === type.id
                          ? 'bg-cyan-400/15 border-cyan-400/60 text-cyan-50'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: starColour(type.teffK), boxShadow: `0 0 8px ${starColour(type.teffK)}` }}
                        aria-hidden="true"
                      />
                      <span className="leading-tight">
                        {t('lab', type.nameKey)}
                        <span className="block text-[10px] text-gray-500">
                          {t('lab', 'exoStarRadius', { r: formatStarRadius(type.radiusSun) })}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-gray-400">
                  <span>{t('lab', 'exoRadius')}</span>
                  <span className="font-mono text-white whitespace-nowrap">
                    {t('lab', 'exoRadiusEarth', { re: formatRadius(radiusEarth) })}
                  </span>
                </div>
                <p className="text-xs text-gray-500 text-right">
                  {t('lab', 'exoRadiusJupiter', { rj: jupiterRadii.toFixed(2) })}
                </p>
                <input
                  type="range"
                  min={Math.log10(RADIUS_MIN)}
                  max={Math.log10(RADIUS_MAX)}
                  step="0.005"
                  value={Math.log10(radiusEarth)}
                  onChange={(e) => {
                    setRadiusEarth(10 ** parseFloat(e.target.value));
                    setPresetId(null);
                  }}
                  className="w-full accent-cyan-400"
                  aria-label={t('lab', 'exoRadius')}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-gray-400">
                  <span>{t('lab', 'exoOrbitPeriod')}</span>
                  <span className="font-mono text-white whitespace-nowrap">{t('lab', 'exoDays', { value: periodDays.toFixed(2) })}</span>
                </div>
                <input
                  type="range"
                  min={PERIOD_MIN}
                  max={PERIOD_MAX}
                  step="0.01"
                  value={periodDays}
                  onChange={(e) => {
                    setPeriodDays(parseFloat(e.target.value));
                    setPresetId(null);
                  }}
                  className="w-full accent-cyan-400"
                  aria-label={t('lab', 'exoOrbitPeriod')}
                />
              </div>

              <p className="text-xs text-gray-400">
                {t('lab', 'exoDurationNote', { hours: (duration * 24).toFixed(1) })}
              </p>
              {lostInNoise ? <p className="text-xs leading-relaxed text-amber-200">{t('lab', 'exoNoiseWarning')}</p> : null}
            </>
          ) : (
            <>
              <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-gray-300">
                {t('lab', 'exoHuntIntro')}
              </p>
              <p className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-200">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: hostColour, boxShadow: `0 0 8px ${hostColour}` }}
                  aria-hidden="true"
                />
                {t('lab', 'exoHuntStar', { name: starName, r: formatStarRadius(host.radiusSun) })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400 mr-auto">{t('lab', 'exoMarks', { n: marks.length })}</span>
                <button
                  onClick={() => toggleMark(timeRef.current)}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                >
                  <Crosshair className="w-3.5 h-3.5" /> {t('lab', 'exoMarkNow')}
                </button>
                <button
                  onClick={() => { setMarks([]); setResult(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> {t('lab', 'exoClear')}
                </button>
                <button
                  onClick={newStar}
                  className="flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] md:min-h-[32px] rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {t('lab', 'exoNewStar')}
                </button>
              </div>
              {resultMessage ? (
                <div
                  role="status"
                  className={`rounded-2xl border p-4 text-sm leading-relaxed ${
                    result.status === 'found'
                      ? 'border-green-400/40 bg-green-500/10 text-green-100'
                      : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                  }`}
                >
                  <p className="font-semibold">{resultMessage}</p>
                  {result.status === 'found' ? (
                    <>
                      <p className="mt-2 text-xs text-green-200/90">
                        {t('lab', 'exoResultMeasured', {
                          radius: result.radiusEarth.toFixed(1),
                          period: result.period.toFixed(2),
                        })}
                      </p>
                      <p className="mt-1 text-xs text-gray-300">
                        {t('lab', 'exoResultTruth', {
                          radius: earthRadiiFromRatio(planet.rpOverRs, host).toFixed(1),
                          period: planet.periodDays.toFixed(2),
                        })}
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}
            </>
          )}

          <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
              </div>
            ))}
          </dl>

          {hunting ? (
            <button
              onClick={check}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-500 shadow-[0_0_22px_rgba(124,58,237,0.45)] hover:brightness-110"
            >
              {t('lab', 'exoCheck')}
            </button>
          ) : null}

          <LabMissions prefix="lab_exoplanet_" missions={missions} />

          <LabExplain
            simple={t('lab', 'exoExplainSimple')}
            formula={[t('lab', 'exoExplainFormula1'), t('lab', 'exoExplainFormula2'), t('lab', 'exoExplainFormula3')]}
            details={t('lab', 'exoExplainDetails')}
          />

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'exoModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', hunting ? 'exoHintHunt' : 'exoHintSim')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'exoTransitView')}
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span ref={dayRef} className="font-mono text-xs text-cyan-200 bg-black/50 px-3 py-1.5 rounded-full" />
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={t('lab', playing ? 'exoPause' : 'exoPlay')}
            className="w-10 h-10 md:w-8 md:h-8 grid place-items-center rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
          role="img"
          aria-label={t('lab', 'exoChartLabel')}
        >
          <defs>
            <radialGradient id="exo-star">
              <stop offset="0" stopColor="#fffdf6" />
              <stop offset="0.55" stopColor={hostColour} />
              <stop offset="1" stopColor={hostRim} />
            </radialGradient>
            <radialGradient id="exo-glow">
              <stop offset="0.55" stopColor={hostColour} stopOpacity="0.35" />
              <stop offset="1" stopColor={hostColour} stopOpacity="0" />
            </radialGradient>
            <clipPath id="exo-scale-clip">
              <rect x={SCALE.x} y={SCALE.y} width={SCALE.w} height={SCALE.h} rx="14" />
            </clipPath>
          </defs>

          {/* The dimming below is exaggerated; say so where it is seen. */}
          <text x={STAR.x} y={STAR.y - STAR.r - 26} textAnchor="middle" className="fill-gray-500" fontSize="14">
            {t('lab', 'exoDimNote')}
          </text>
          <circle cx={STAR.x} cy={STAR.y} r={STAR.r * 1.45} fill="url(#exo-glow)" />
          <circle cx={STAR.x} cy={STAR.y} r={STAR.r} fill="url(#exo-star)" />
          <circle ref={dimRef} cx={STAR.x} cy={STAR.y} r={STAR.r} fill="#030208" opacity="0" />
          {!hunting ? (
            <>
              <line
                x1={STAR.x - STAR.r * 2.2}
                y1={STAR.y}
                x2={STAR.x + STAR.r * 2.2}
                y2={STAR.y}
                stroke="#ffffff"
                strokeOpacity="0.2"
                strokeDasharray="4 6"
              />
              <circle
                ref={planetRef}
                cx={STAR.x}
                cy={STAR.y}
                r={Math.max(1.5, planet.rpOverRs * STAR.r)}
                fill="#0b0816"
                stroke="#ffffff"
                strokeOpacity="0.3"
                opacity="0"
              />
            </>
          ) : null}
          <text x={STAR.x} y={STAR.y + STAR.r + 40} textAnchor="middle" className="fill-gray-300" fontSize="18">
            {t('lab', 'exoStarLabel', { name: starName, r: formatStarRadius(host.radiusSun) })}
          </text>
          <text
            ref={countdownRef}
            x={STAR.x}
            y={STAR.y + STAR.r + 66}
            textAnchor="middle"
            className="fill-cyan-300"
            fontSize="17"
          />
          {hunting ? (
            <text x={STAR.x} y={STAR.y + STAR.r + 66} textAnchor="middle" className="fill-violet-200" fontSize="17">
              {t('lab', 'exoHiddenPlanet')}
            </text>
          ) : null}

          {/* How big are Jupiter and Earth next to this star? One scale for all three. */}
          <g>
            <rect x={SCALE.x} y={SCALE.y} width={SCALE.w} height={SCALE.h} rx="14" fill="#030208" fillOpacity="0.55" stroke="#ffffff" strokeOpacity="0.1" />
            <g clipPath="url(#exo-scale-clip)">
              <circle cx={SCALE.x + 6} cy={scaleMidY} r={SCALE.starR} fill="url(#exo-star)" />
            </g>
            <text x={SCALE.x + SCALE.w - 14} y={SCALE.y + 22} textAnchor="end" className="fill-gray-400" fontSize="13" letterSpacing="1.5">
              {t('lab', 'exoScaleTitle').toUpperCase()}
            </text>
            <circle cx={jupiterX} cy={scaleMidY} r={Math.max(1.2, scaleJupiter)} fill="#d6a46b" stroke="#ffffff" strokeOpacity="0.4" />
            <circle cx={earthX} cy={scaleMidY} r={scaleEarth} fill="#60a5fa" stroke="#ffffff" strokeOpacity="0.4" />
            <text x={jupiterX} y={SCALE.y + SCALE.h - 14} textAnchor="middle" className="fill-gray-300" fontSize="13">
              {t('lab', 'exoScaleJupiter')}
            </text>
            <text x={earthX} y={SCALE.y + SCALE.h - 14} textAnchor="middle" className="fill-gray-300" fontSize="13">
              {t('lab', 'exoScaleEarth')}
            </text>
          </g>

          {/* The light curve. Taps land here in the mystery-star mode. */}
          <g onClick={onChartClick} style={{ cursor: hunting ? 'crosshair' : 'default' }}>
            <rect x="16" y="412" width="768" height="340" rx="18" fill="#ffffff" fillOpacity="0.03" stroke="#ffffff" strokeOpacity="0.08" />
            <text x="38" y="446" className="fill-gray-400" fontSize="15" letterSpacing="2">
              {t('lab', 'exoLightCurve').toUpperCase()}
            </text>
            {chart.ticks.map((v) => (
              <g key={v}>
                <line x1={PLOT.x0} x2={PLOT.x1} y1={chart.fluxToY(v / 100)} y2={chart.fluxToY(v / 100)} stroke="#ffffff" strokeOpacity="0.06" />
                <text x={PLOT.x0 - 8} y={chart.fluxToY(v / 100) + 5} textAnchor="end" className="fill-gray-500" fontSize="14">
                  {v.toFixed(chart.places)}
                </text>
              </g>
            ))}
            <line x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0} y2={PLOT.y1} stroke="#ffffff" strokeOpacity="0.2" />
            <line x1={PLOT.x0} x2={PLOT.x1} y1={PLOT.y1} y2={PLOT.y1} stroke="#ffffff" strokeOpacity="0.2" />
            {[0, 2, 4, 6, 8, 10, 12].map((d) => (
              <text key={d} x={dayToX(d)} y={PLOT.y1 + 24} textAnchor="middle" className="fill-gray-500" fontSize="14">
                {d}
              </text>
            ))}
            <text x={(PLOT.x0 + PLOT.x1) / 2} y={PLOT.y1 + 54} textAnchor="middle" className="fill-gray-400" fontSize="15">
              {t('lab', 'exoTimeAxis')}
            </text>
            <text
              x="30"
              y={(PLOT.y0 + PLOT.y1) / 2}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize="15"
              transform={`rotate(-90 30 ${(PLOT.y0 + PLOT.y1) / 2})`}
            >
              {t('lab', 'exoFluxAxis')}
            </text>

            <path d={chart.path} fill="none" stroke="#a78bfa" strokeWidth="1.3" strokeLinejoin="round" />

            {marks.map((m) => (
              <rect
                key={m}
                x={dayToX(m) - 10}
                y={PLOT.y0 + 4}
                width="20"
                height={PLOT.y1 - PLOT.y0 - 8}
                rx="6"
                fill="#fbbf24"
                fillOpacity="0.12"
                stroke="#fbbf24"
                strokeDasharray="5 4"
              />
            ))}

            {bracket ? (
              <g>
                <line x1={dayToX(bracket.from)} x2={dayToX(bracket.to)} y1={PLOT.y0 - 12} y2={PLOT.y0 - 12} stroke="#fbbf24" strokeWidth="1.5" />
                <line x1={dayToX(bracket.from)} x2={dayToX(bracket.from)} y1={PLOT.y0 - 18} y2={PLOT.y0 - 6} stroke="#fbbf24" strokeWidth="1.5" />
                <line x1={dayToX(bracket.to)} x2={dayToX(bracket.to)} y1={PLOT.y0 - 18} y2={PLOT.y0 - 6} stroke="#fbbf24" strokeWidth="1.5" />
                <text
                  x={(dayToX(bracket.from) + dayToX(bracket.to)) / 2}
                  y={PLOT.y0 - 20}
                  textAnchor="middle"
                  className="fill-amber-300 font-mono"
                  fontSize="16"
                  fontWeight="700"
                >
                  {t('lab', 'exoPeriodLabel', { value: bracket.period.toFixed(2) })}
                </text>
                <line
                  x1={dayToX(bracket.at) + 22}
                  x2={dayToX(bracket.at) + 22}
                  y1={chart.fluxToY(1)}
                  y2={chart.fluxToY(1 - bracket.depth)}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                />
                <text
                  x={dayToX(bracket.at) + 30}
                  y={(chart.fluxToY(1) + chart.fluxToY(1 - bracket.depth)) / 2 + 5}
                  className="fill-cyan-300 font-mono"
                  fontSize="16"
                  fontWeight="700"
                >
                  {t('lab', 'exoDepthLabel', { value: formatPercent(bracket.depth) })}
                </text>
              </g>
            ) : null}

            <line ref={playheadRef} x1={PLOT.x0} x2={PLOT.x0} y1={PLOT.y0 - 4} y2={PLOT.y1} stroke="#22d3ee" strokeOpacity="0.75" strokeWidth="1.5" />
          </g>
        </svg>
      </LabViewport>
    </div>
  );
}
