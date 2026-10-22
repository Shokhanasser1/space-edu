import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Moon } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  LUNAR_ECLIPSE_LIMIT_DEG,
  MOON_INCLINATION_DEG,
  NODE_STEP_PER_MONTH_DEG,
  PHASE_KEYS,
  SOLAR_ECLIPSE_LIMIT_DEG,
  SYNODIC_MONTH_DAYS,
  daysToFull,
  distanceFromNodeDeg,
  eclipseNow,
  eclipsesThisMonth,
  illuminatedFraction,
  isWaxing,
  latitudeLimitDeg,
  moonLatitudeDeg,
  moonStateAt,
  nextEclipses,
  nextUmbralLunarEclipse,
  phaseAngleDeg,
  phaseCenterAge,
  phaseIndex,
  phaseKey,
  visibilityKey,
  wrap360,
  wrapAge,
} from '@/lib/moonPhases';

/**
 * Moon phases and eclipses: why the Moon changes shape, and why that does not
 * mean an eclipse every fortnight.
 *
 * The page opens on today's real Moon (astronomy-engine), drawn three ways at
 * once — from above the Solar System, as seen from Tashkent, and side-on — and
 * the reader moves it by dragging it round its orbit or with the day slider.
 * Every view follows the same age, so dragging the Moon to the far side of
 * Earth and watching the Tashkent disc fill up is the whole lesson.
 *
 * The side view is the second lesson. The orbit is tilted 5.1 degrees, so at
 * most new and full moons the Moon passes above or below the line to the Sun;
 * stepping through the months shows the eclipse windows lining up twice a
 * year. Switching the tilt off shows what a flat orbit would do: an eclipse
 * every month. Heights in that view are exaggerated and the page says so.
 *
 * No animation loop: everything moves because the reader moves it.
 *
 * Around that, the shared lab kit: real dates to jump to (tonight, the total
 * lunar eclipse of 7 September 2025, the next umbral lunar and the next solar
 * eclipse, worked out by astronomy-engine), five missions from "make the Moon
 * full" to "find a month with both eclipses", the ball-and-lamp explanation
 * with the formulas behind a toggle, and sourced facts. The quiz is one of the
 * missions now, not a separate XP faucet.
 */

const QUIZ_TARGET = 3;
const MISSION_PREFIX = 'lab_moon_';

/** A total lunar eclipse every almanac lists; `lib/moonPhases.test.js` checks it. */
const ECLIPSE_2025 = new Date('2025-09-07T18:12:00Z');

/**
 * The lunar seas, schematic, as ellipses on a unit disc (x east, y down, as the
 * Moon looks from the northern hemisphere). Decoration so the disc reads as the
 * Moon; the model note says the surface is drawn schematically.
 */
const MARIA = [
  [-0.55, -0.1, 0.22, 0.36], // Oceanus Procellarum
  [-0.22, -0.5, 0.24, 0.2], // Imbrium
  [0.28, -0.42, 0.15, 0.13], // Serenitatis
  [0.38, -0.12, 0.18, 0.15], // Tranquillitatis
  [0.68, -0.3, 0.12, 0.11], // Crisium
  [0.62, 0.12, 0.12, 0.15], // Fecunditatis
  [0.48, 0.3, 0.09, 0.09], // Nectaris
  [-0.12, 0.35, 0.16, 0.13], // Nubium
];

/** Drawing geometry, in viewBox units. */
const VIEW_W = 800;
const VIEW_H = 760;
const EARTH = { x: 280, y: 270, r: 30 };
const ORBIT_R = 190;
const SKY = { x: 662, y: 186, r: 92, moon: 56 };
const SIDE = { y: 632, earthX: 400, reach: 250, pxPerDeg: 12 };

const NIGHT = '#1f1d33';
const LIT = '#f3f0e6';

/**
 * The lit part of the disc as seen from the northern hemisphere, as an SVG
 * path: waxing lit on the right, waning on the left, the terminator an ellipse
 * whose half-width is r * |1 - 2k|. Null at new moon.
 */
function litPath(cx, cy, r, age) {
  const k = illuminatedFraction(age);
  if (k < 0.005) return null;
  if (k > 0.995) return `M${cx - r} ${cy}A${r} ${r} 0 1 1 ${cx + r} ${cy}A${r} ${r} 0 1 1 ${cx - r} ${cy}Z`;
  const rx = (r * Math.abs(1 - 2 * k)).toFixed(2);
  const waxing = isWaxing(age);
  const outer = waxing ? 1 : 0;
  const inner = waxing ? (k < 0.5 ? 0 : 1) : k < 0.5 ? 1 : 0;
  return `M${cx} ${cy - r}A${r} ${r} 0 0 ${outer} ${cx} ${cy + r}A${rx} ${r} 0 0 ${inner} ${cx} ${cy - r}Z`;
}

/** A Moon as seen from Earth: dark disc, lit part on top. */
function PhaseDisc({ cx, cy, r, age, outline = false }) {
  const lit = litPath(cx, cy, r, age);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={NIGHT} stroke={outline ? '#ffffff' : 'none'} strokeOpacity="0.25" />
      {lit ? <path d={lit} fill={LIT} /> : null}
    </g>
  );
}

/**
 * The large Moon in the "seen from Tashkent" view: the seas drawn on the lit
 * part only, and earthshine — sunlight bounced off Earth — glowing faintly on
 * the dark part of a thin crescent, as it does in the real sky.
 */
function DetailedMoon({ cx, cy, r, age }) {
  const lit = litPath(cx, cy, r, age);
  const k = illuminatedFraction(age);
  const earthshine = k < 0.35 ? 0.2 * (1 - k / 0.35) : 0;
  return (
    <g>
      <defs>
        {lit ? (
          <clipPath id="moon-lit-clip">
            <path d={lit} />
          </clipPath>
        ) : null}
      </defs>
      <circle cx={cx} cy={cy} r={r} fill={NIGHT} />
      {earthshine > 0 ? <circle cx={cx} cy={cy} r={r} fill="#93a4c8" fillOpacity={earthshine} /> : null}
      {lit ? (
        <>
          <path d={lit} fill={LIT} />
          <g clipPath="url(#moon-lit-clip)">
            {MARIA.map(([x, y, rx, ry]) => (
              <ellipse key={`${x}${y}`} cx={cx + x * r} cy={cy + y * r} rx={rx * r} ry={ry * r} fill="#a8a294" fillOpacity="0.45" />
            ))}
            <circle cx={cx - 0.18 * r} cy={cy + 0.7 * r} r={r * 0.045} fill="#ffffff" fillOpacity="0.7" />
          </g>
        </>
      ) : null}
    </g>
  );
}

/** A Moon seen from above the orbit: the half facing the Sun (left) is lit. */
function TopDownMoon({ x, y, r }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#2a2840" />
      <path d={`M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}Z`} fill="#e5e7eb" />
    </g>
  );
}

/** Where the Moon is drawn in the top view for a given age. New moon is towards the Sun. */
function orbitPoint(age, radius = ORBIT_R) {
  const theta = (phaseAngleDeg(age) * Math.PI) / 180;
  return { x: EARTH.x - radius * Math.cos(theta), y: EARTH.y + radius * Math.sin(theta) };
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function newQuestion(previous) {
  let index;
  do {
    index = Math.floor(Math.random() * 8);
  } while (index === previous);
  const others = shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => i !== index)).slice(0, 3);
  return { index, options: shuffle([index, ...others]) };
}

/** Today's Moon, or a sensible stand-in if the ephemeris throws. */
function realMoon() {
  try {
    return moonStateAt(new Date());
  } catch {
    return { age: 10, sigma: 230 };
  }
}

function upcomingEclipses() {
  try {
    return nextEclipses(new Date());
  } catch {
    return null;
  }
}

/**
 * The real moments the page can jump to. The lunar one skips penumbral
 * eclipses: they lie beyond the umbral limit this page uses, so showing one
 * would contradict the page's own "eclipse possible" readout.
 */
function realDates() {
  const dates = [{ id: 'tonight', date: null }, { id: 'lunar2025', date: ECLIPSE_2025, kind: 'total', type: 'lunar' }];
  try {
    const now = new Date();
    const lunar = nextUmbralLunarEclipse(now);
    const solar = nextEclipses(now).solar;
    dates.push({ id: 'nextLunar', date: lunar.date, kind: lunar.kind, type: 'lunar' });
    dates.push({ id: 'nextSolar', date: solar.date, kind: solar.kind, type: 'solar' });
  } catch {
    // Without the ephemeris the two fixed dates are still worth offering.
  }
  return dates;
}

export function MoonPhasesLab() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [today] = useState(realMoon);
  const [age, setAgeState] = useState(today.age);
  const [sigma, setSigmaState] = useState(today.sigma);
  const [tilted, setTilted] = useState(true);
  const [eclipses] = useState(upcomingEclipses);
  const [dates] = useState(realDates);
  const [presetId, setPresetId] = useState('tonight');
  const [returnedToday, setReturnedToday] = useState(false);
  const [question, setQuestion] = useState(() => newQuestion(-1));
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);

  const svgRef = useRef(null);
  const dragging = useRef(false);

  // Moving the Moon by hand leaves whichever real date the reader had picked.
  const setAge = (value) => {
    setAgeState(value);
    setPresetId(null);
  };
  const setSigma = (update) => {
    setSigmaState(update);
    setPresetId(null);
  };

  const pickDate = (id) => {
    const entry = dates.find((d) => d.id === id);
    if (!entry) return;
    let state;
    try {
      state = entry.date ? moonStateAt(entry.date) : moonStateAt(new Date());
    } catch {
      state = today;
    }
    setAgeState(state.age);
    setSigmaState(state.sigma);
    if (id === 'tonight' && presetId !== 'tonight') setReturnedToday(true);
    setPresetId(id);
  };

  const inclination = tilted ? MOON_INCLINATION_DEG : 0;
  const month = eclipsesThisMonth(sigma, inclination);
  const now = eclipseNow(age, sigma, inclination);
  const moon = orbitPoint(age);
  const pct = Math.round(illuminatedFraction(age) * 100);

  // The Moon's path through this lunation, side-on: along the Sun line
  // horizontally, height above the ecliptic vertically.
  const side = useMemo(() => {
    const point = (a) => ({
      x: SIDE.earthX - SIDE.reach * Math.cos((phaseAngleDeg(a) * Math.PI) / 180),
      y: SIDE.y - SIDE.pxPerDeg * moonLatitudeDeg(sigma, a, inclination),
    });
    let path = '';
    const nodes = [];
    let previous = null;
    for (let a = 0; a <= SYNODIC_MONTH_DAYS + 1e-9; a += 0.2) {
      const p = point(a);
      path += `${path ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      const lat = moonLatitudeDeg(sigma, a, inclination);
      if (inclination && previous !== null && Math.sign(lat) !== Math.sign(previous)) nodes.push(p.x);
      previous = lat;
    }
    return {
      path,
      nodes,
      newMoon: point(0),
      fullMoon: point(SYNODIC_MONTH_DAYS / 2),
      solarHalf: SIDE.pxPerDeg * Math.max(latitudeLimitDeg(SOLAR_ECLIPSE_LIMIT_DEG), 0.6),
      lunarHalf: SIDE.pxPerDeg * Math.max(latitudeLimitDeg(LUNAR_ECLIPSE_LIMIT_DEG), 0.4),
      point,
    };
  }, [sigma, inclination]);
  const sideMoon = side.point(age);

  const toSvg = (event) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    return p.matrixTransform(ctm.inverse());
  };
  const ageAt = ({ x, y }) => {
    const deg = wrap360((Math.atan2(y - EARTH.y, -(x - EARTH.x)) * 180) / Math.PI);
    return wrapAge((deg / 360) * SYNODIC_MONTH_DAYS);
  };
  const onPointerDown = (event) => {
    const p = toSvg(event);
    if (!p) return;
    const d = Math.hypot(p.x - EARTH.x, p.y - EARTH.y);
    if (d < ORBIT_R - 55 || d > ORBIT_R + 55 || p.y > 500) return;
    dragging.current = true;
    svgRef.current.setPointerCapture?.(event.pointerId);
    setAge(ageAt(p));
  };
  const onPointerMove = (event) => {
    if (!dragging.current) return;
    const p = toSvg(event);
    if (p) setAge(ageAt(p));
  };
  const endDrag = () => {
    dragging.current = false;
  };

  const answer = (index) => {
    if (picked !== null) return;
    setPicked(index);
    if (index === question.index) setScore((s) => s + 1);
  };
  const nextQuestion = () => {
    setQuestion((q) => newQuestion(q.index));
    setPicked(null);
  };

  const eclipseLabel = now === 'solar' ? 'moonEclipseSolar' : now === 'lunar' ? 'moonEclipseLunar' : 'moonEclipseNone';
  const readouts = [
    { label: t('lab', 'moonPhase'), value: t('lab', phaseKey(age)) },
    { label: t('lab', 'moonLit'), value: `${pct} %` },
    { label: t('lab', 'moonToFull'), value: t('lab', 'moonDays', { value: daysToFull(age).toFixed(1) }) },
    { label: t('lab', 'moonEclipse'), value: t('lab', eclipseLabel) },
    { label: t('lab', 'moonVisible'), value: t('lab', visibilityKey(age)), wide: true },
  ];
  const kindKey = (kind) => `moonKind${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  const isoDay = (date) => date.toISOString().slice(0, 10);
  const current = phaseIndex(age);
  const button =
    'flex items-center justify-center gap-1.5 min-h-10 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10';

  // Why a new or full moon is not an eclipse: the Moon passes above or below
  // the line to the Sun, by more than the few tenths of a degree it would need.
  const nearSyzygy = age < 1 || age > SYNODIC_MONTH_DAYS - 1 || Math.abs(age - SYNODIC_MONTH_DAYS / 2) < 1;
  const missLatitude = moonLatitudeDeg(sigma, age, inclination);
  const whyNoEclipse =
    tilted && nearSyzygy && now === null
      ? t('lab', missLatitude >= 0 ? 'moonWhyNoEclipseAbove' : 'moonWhyNoEclipseBelow', {
          deg: Math.abs(missLatitude).toFixed(1),
        })
      : null;

  const presets = dates.map((entry) => ({
    id: entry.id,
    label:
      entry.id === 'tonight'
        ? t('lab', 'moonToday')
        : t('lab', entry.type === 'lunar' ? 'moonPresetLunar' : 'moonPresetSolar', {
            kind: t('lab', kindKey(entry.kind)),
            date: isoDay(entry.date),
          }),
  }));

  const missions = [
    { id: 'full', title: t('lab', 'moonMissionFull'), done: current === 4 },
    { id: 'today', title: t('lab', 'moonMissionToday'), hint: t('lab', 'moonMissionTodayHint'), done: returnedToday },
    {
      id: 'quiz',
      title: t('lab', 'moonMissionQuiz'),
      hint: t('lab', 'moonQuizScore', { n: Math.min(score, QUIZ_TARGET) }),
      done: score >= QUIZ_TARGET,
    },
    { id: 'eclipse', title: t('lab', 'moonMissionEclipse'), hint: t('lab', 'moonMissionEclipseHint'), done: tilted && now !== null },
    {
      id: 'both',
      title: t('lab', 'moonMissionBoth'),
      hint: t('lab', 'moonMissionBothHint'),
      done: tilted && month.solar && month.lunar,
    },
  ];

  const facts = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    text: t('lab', `moonFact${n}`),
    source: t('lab', `moonFactSource${n}`),
  }));

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Moon className="text-violet-300" /> {t('lab', 'moonTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'moonSubtitle')}</p>
          </div>

          <LabPresets label={t('lab', 'moonPresetsLabel')} presets={presets} activeId={presetId} onPick={pickDate} />

          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>{t('lab', 'moonDay')}</span>
              <span className="font-mono text-white">{t('lab', 'moonDayValue', { day: age.toFixed(1) })}</span>
            </div>
            <input
              type="range"
              min="0"
              max={SYNODIC_MONTH_DAYS.toFixed(2)}
              step="0.1"
              value={age}
              onChange={(e) => setAge(parseFloat(e.target.value))}
              className="w-full accent-violet-300"
              aria-label={t('lab', 'moonDay')}
            />
            <div className="grid grid-cols-8 gap-1 pt-1">
              {PHASE_KEYS.map((key, i) => (
                <button
                  key={key}
                  onClick={() => setAge(phaseCenterAge(i))}
                  aria-label={t('lab', key)}
                  aria-pressed={current === i}
                  className={`h-10 grid place-items-center rounded-full ${current === i ? 'ring-2 ring-violet-300' : ''}`}
                >
                  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                    <PhaseDisc cx={13} cy={13} r={11} age={phaseCenterAge(i)} outline />
                  </svg>
                </button>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
            {readouts.map((readout) => (
              <div
                key={readout.label}
                className={`rounded-xl border border-white/10 bg-black/30 p-2.5 ${readout.wide ? 'col-span-2' : ''}`}
              >
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300">{readout.value}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t('lab', 'moonTilt')}</span>
              {/* A 40 px tall button round a 24 px switch, so a thumb can find it. */}
              <button
                onClick={() => setTilted((v) => !v)}
                aria-pressed={tilted}
                aria-label={t('lab', 'moonTilt')}
                className="h-10 w-14 grid place-items-center"
              >
                <span className={`block w-12 h-6 rounded-full transition-colors relative ${tilted ? 'bg-violet-400' : 'bg-space-700'}`}>
                  <span
                    className={`block w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                      tilted ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSigma((s) => wrap360(s - NODE_STEP_PER_MONTH_DEG))} aria-label={t('lab', 'moonPrevMonth')} className={button}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">{t('lab', 'moonSeason')}</p>
                <p className="text-xs text-gray-300">
                  {t('lab', 'moonNodeDistance', { deg: Math.round(distanceFromNodeDeg(sigma)) })}
                </p>
              </div>
              <button onClick={() => setSigma((s) => wrap360(s + NODE_STEP_PER_MONTH_DEG))} aria-label={t('lab', 'moonNextMonth')} className={button}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                [month.solar, month.solar ? 'moonMonthSolarYes' : 'moonMonthSolarNo'],
                [month.lunar, month.lunar ? 'moonMonthLunarYes' : 'moonMonthLunarNo'],
              ].map(([yes, key]) => (
                <span
                  key={key}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    yes ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/5 text-gray-400'
                  }`}
                >
                  {t('lab', key)}
                </span>
              ))}
            </div>
            {whyNoEclipse ? <p className="text-xs leading-relaxed text-amber-200">{whyNoEclipse}</p> : null}
          </div>

          {eclipses ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> {t('lab', 'moonNextTitle')}
              </p>
              <p className="text-xs text-gray-200">
                {t('lab', 'moonNextSolar', { date: isoDay(eclipses.solar.date), kind: t('lab', kindKey(eclipses.solar.kind)) })}
              </p>
              <p className="text-xs text-gray-200">
                {t('lab', 'moonNextLunar', { date: isoDay(eclipses.lunar.date), kind: t('lab', kindKey(eclipses.lunar.kind)) })}
              </p>
              <button onClick={() => navigate('/calendar')} className="text-xs text-cyan-300 hover:text-cyan-200">
                {t('lab', 'moonOpenCalendar')}
              </button>
            </div>
          ) : null}

          <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-violet-300">{t('lab', 'moonQuizTitle')}</p>
              <span className="text-[11px] text-gray-300">{t('lab', 'moonQuizScore', { n: Math.min(score, QUIZ_TARGET) })}</span>
            </div>
            <div className="flex items-center gap-4">
              <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={t('lab', 'moonQuizQuestion')}>
                <PhaseDisc cx={32} cy={32} r={28} age={phaseCenterAge(question.index)} outline />
              </svg>
              <p className="text-sm text-white">{t('lab', 'moonQuizQuestion')}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {question.options.map((i) => {
                const state =
                  picked === null ? '' : i === question.index ? 'right' : i === picked ? 'wrong' : '';
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    className={`min-h-10 px-2 py-1.5 rounded-lg text-xs border transition-colors ${
                      state === 'right'
                        ? 'bg-green-500/20 border-green-400 text-green-200'
                        : state === 'wrong'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {t('lab', PHASE_KEYS[i])}
                  </button>
                );
              })}
            </div>
            {picked !== null ? (
              <div className="flex items-center justify-between mt-3 gap-2">
                <p role="status" className={`text-xs ${picked === question.index ? 'text-green-300' : 'text-amber-200'}`}>
                  {picked === question.index
                    ? t('lab', 'moonQuizRight')
                    : t('lab', 'moonQuizWrong', { name: t('lab', PHASE_KEYS[question.index]) })}{' '}
                  {/* How to tell, every time: a clue a reader can use on the real sky. */}
                  <span className="text-gray-300">{t('lab', `moonQuizClue${question.index}`)}</span>
                </p>
                <button onClick={nextQuestion} className={button}>
                  {t('lab', 'moonQuizNext')}
                </button>
              </div>
            ) : null}
          </div>

          <LabMissions prefix={MISSION_PREFIX} missions={missions} />

          <LabExplain
            simple={t('lab', 'moonExplainSimple')}
            formula={[t('lab', 'moonExplainFormula1'), t('lab', 'moonExplainFormula2'), t('lab', 'moonExplainFormula3')]}
            details={t('lab', 'moonExplainDetails')}
          />

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'moonModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', 'moonDragHint')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'moonViewName')}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)] touch-none select-none"
          role="img"
          aria-label={t('lab', 'moonChartLabel')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <linearGradient id="moon-sunlight" x1="0" x2="1">
              <stop offset="0" stopColor="#fbbf24" stopOpacity="0.35" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="moon-earth" cx="0.35" cy="0.4">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="0.6" stopColor="#2563eb" />
              <stop offset="1" stopColor="#1e3a8a" />
            </radialGradient>
            <linearGradient id="moon-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0b0a1f" />
              <stop offset="1" stopColor="#1e1b4b" />
            </linearGradient>
            <clipPath id="moon-sky-clip">
              <circle cx={SKY.x} cy={SKY.y} r={SKY.r} />
            </clipPath>
          </defs>

          {/* Top view: sunlight from the left. */}
          <rect x="0" y="0" width="40" height="490" fill="url(#moon-sunlight)" />
          {[120, 220, 320, 420].map((y) => (
            <line key={y} x1="20" x2="70" y1={y} y2={y} stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="2" />
          ))}
          <text x="24" y="84" className="fill-amber-300" fontSize="17" fontWeight="700">
            {t('lab', 'moonSunlight')}
          </text>
          <circle cx={EARTH.x} cy={EARTH.y} r={ORBIT_R} fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeDasharray="4 6" />
          {PHASE_KEYS.map((key, i) => {
            const p = orbitPoint(phaseCenterAge(i));
            return <TopDownMoon key={key} x={p.x} y={p.y} r={11} />;
          })}
          {/* Labels for the four principal phases. Last quarter's goes inside the
              ring: above it is where the view-name chip sits. */}
          {[
            [0, 0, -30],
            [2, 0, 33],
            [4, 0, -30],
            [6, 0, 40],
          ].map(([i, dx, dy]) => {
            const p = orbitPoint(phaseCenterAge(i));
            return (
              <text key={i} x={p.x + dx} y={p.y + dy} textAnchor="middle" className="fill-gray-400" fontSize="16">
                {t('lab', PHASE_KEYS[i])}
              </text>
            );
          })}
          <circle cx={EARTH.x} cy={EARTH.y} r={EARTH.r} fill="url(#moon-earth)" />
          <path d={`M${EARTH.x} ${EARTH.y - EARTH.r}A${EARTH.r} ${EARTH.r} 0 0 1 ${EARTH.x} ${EARTH.y + EARTH.r}Z`} fill="#000000" fillOpacity="0.55" />
          <text x={EARTH.x} y={EARTH.y + EARTH.r + 24} textAnchor="middle" className="fill-white" fontSize="16">
            {t('lab', 'moonEarth')}
          </text>
          <text x="520" y="490" textAnchor="end" className="fill-gray-500" fontSize="13">
            {t('lab', 'moonNotToScale')}
          </text>
          <circle cx={moon.x} cy={moon.y} r="27" fill="none" stroke="#67e8f9" strokeDasharray="4 3" />
          <g style={{ cursor: 'grab' }}>
            <TopDownMoon x={moon.x} y={moon.y} r={17} />
          </g>

          {/* Seen from Tashkent. */}
          <rect x="540" y="24" width="244" height="380" rx="18" fill="#ffffff" fillOpacity="0.04" stroke="#ffffff" strokeOpacity="0.1" />
          <text x={SKY.x} y="62" textAnchor="middle" className="fill-gray-400" fontSize="15" letterSpacing="1.5">
            {t('lab', 'moonSkyTitle').toUpperCase()}
          </text>
          <g clipPath="url(#moon-sky-clip)">
            <rect x={SKY.x - SKY.r} y={SKY.y - SKY.r} width={SKY.r * 2} height={SKY.r * 2} fill="url(#moon-sky)" />
            <DetailedMoon cx={SKY.x} cy={SKY.y - 10} r={SKY.moon} age={age} />
            <path
              d={`M${SKY.x - SKY.r} ${SKY.y + 52}L${SKY.x - 70} ${SKY.y + 34}L${SKY.x - 42} ${SKY.y + 48}L${SKY.x - 8} ${SKY.y + 26}L${SKY.x + 26} ${SKY.y + 46}L${SKY.x + 58} ${SKY.y + 30}L${SKY.x + SKY.r} ${SKY.y + 50}V${SKY.y + SKY.r}H${SKY.x - SKY.r}Z`}
              fill="#05040c"
            />
          </g>
          <circle cx={SKY.x} cy={SKY.y} r={SKY.r} fill="none" stroke="#ffffff" strokeOpacity="0.15" />
          <text x={SKY.x} y="322" textAnchor="middle" className="fill-white" fontSize="18" fontWeight="700">
            {t('lab', phaseKey(age))}
          </text>
          <text x={SKY.x} y="348" textAnchor="middle" className="fill-gray-400" fontSize="15">
            {t('lab', 'moonLitPercent', { pct })}
          </text>
          <text x={SKY.x} y="376" textAnchor="middle" className="fill-cyan-300" fontSize="14">
            {t('lab', visibilityKey(age))}
          </text>

          {/* Side view: the tilt, the nodes, the eclipse windows. Heights exaggerated. */}
          <rect x="16" y="502" width="768" height="244" rx="18" fill="#ffffff" fillOpacity="0.03" stroke="#ffffff" strokeOpacity="0.08" />
          <text x="36" y="532" className="fill-gray-400" fontSize="15" letterSpacing="1.5">
            {t('lab', tilted ? 'moonSideTitle' : 'moonSideTitleFlat').toUpperCase()}
          </text>
          <text x="772" y="532" textAnchor="end" className="fill-gray-500" fontSize="13">
            {t('lab', 'moonSideNotToScale')}
          </text>
          <circle cx="48" cy={SIDE.y} r="22" fill="#fbbf24" fillOpacity="0.2" />
          <circle cx="48" cy={SIDE.y} r="13" fill="#fde68a" />
          <line x1="76" x2="772" y1={SIDE.y} y2={SIDE.y} stroke="#fbbf24" strokeOpacity="0.45" strokeDasharray="6 6" />
          <text x="770" y={SIDE.y - 10} textAnchor="end" className="fill-amber-300" fontSize="15">
            {t('lab', 'moonEcliptic')}
          </text>
          <rect
            x={side.newMoon.x - 16}
            y={SIDE.y - side.solarHalf}
            width="32"
            height={side.solarHalf * 2}
            rx="6"
            fill="#fbbf24"
            fillOpacity="0.08"
            stroke="#fbbf24"
            strokeOpacity="0.6"
            strokeDasharray="4 3"
          />
          <rect
            x={side.fullMoon.x - 16}
            y={SIDE.y - side.lunarHalf}
            width="32"
            height={side.lunarHalf * 2}
            rx="6"
            fill="#f87171"
            fillOpacity="0.08"
            stroke="#f87171"
            strokeOpacity="0.6"
            strokeDasharray="4 3"
          />
          <text x={side.newMoon.x} y="728" textAnchor="middle" className={month.solar ? 'fill-amber-300' : 'fill-gray-500'} fontSize="15">
            {t('lab', 'moonSolarWindow')}
          </text>
          <text x={side.fullMoon.x} y="728" textAnchor="middle" className={month.lunar ? 'fill-red-300' : 'fill-gray-500'} fontSize="15">
            {t('lab', 'moonLunarWindow')}
          </text>
          <path d={side.path} fill="none" stroke="#c4b5fd" strokeOpacity="0.7" strokeWidth="1.5" />
          {side.nodes.map((x) => (
            <g key={x}>
              <path d={`M${x} ${SIDE.y - 6}l6 6l-6 6l-6 -6z`} fill="#fbbf24" />
              <text x={x} y={SIDE.y + 28} textAnchor="middle" className="fill-gray-400" fontSize="14">
                {t('lab', 'moonNode')}
              </text>
            </g>
          ))}
          <circle cx={SIDE.earthX} cy={SIDE.y} r="12" fill="url(#moon-earth)" />
          <circle cx={side.newMoon.x} cy={side.newMoon.y} r="5" fill={month.solar ? '#fbbf24' : '#6b7280'} />
          <circle cx={side.fullMoon.x} cy={side.fullMoon.y} r="5" fill={month.lunar ? '#f87171' : '#6b7280'} />
          <circle cx={sideMoon.x} cy={sideMoon.y} r="9" fill="#e5e7eb" stroke="#67e8f9" strokeWidth="2" />
        </svg>
      </LabViewport>
    </div>
  );
}
