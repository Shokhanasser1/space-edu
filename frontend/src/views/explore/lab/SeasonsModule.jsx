import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Sun } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  AU_KM,
  CITIES,
  DAYS_IN_YEAR,
  EARTH_TILT_DEG,
  calendarDate,
  cityById,
  dayLengthHours,
  dayLengthRange,
  dayOfYearFor,
  declinationDeg,
  equinoxesAndSolstices,
  formatClock,
  monthlyDayLengths,
  noonSun,
  noonSunlightFraction,
  perihelionAndAphelion,
  polarNightDays,
  seasonKeyAt,
  shadowLengthM,
  sunDistanceAu,
  sunLongitudeDeg,
  sunTimes,
} from '@/lib/seasons';

/**
 * Seasons and day length: the tilt makes the seasons, the distance does not.
 *
 * Two pictures of the same moment. On the left, Earth's orbit from above,
 * with the axis drawn leaning the same way all year — so it leans towards the
 * Sun in June and away from it in December without anything turning. On the
 * right, a south-north slice through Tashkent at noon: the Sun's altitude, the
 * stick and its shadow, and a faint copy of the opposite solstice to compare.
 * Under it, the day length month by month.
 *
 * The tilt slider is the experiment. At 0 degrees every day is twelve hours
 * and the seasons vanish; at 90 the Sun circles the sky in June and never
 * rises in December. Nothing here is a stored table: `lib/seasons.js` works
 * every number out from the date and the tilt, and names its sources.
 *
 * The question card is the misconception this module exists for — "summer is
 * when we are closer to the Sun" — and the distance readout under the orbit
 * keeps contradicting it: Earth is nearest the Sun in January.
 *
 * No WebGL: two diagrams and a bar chart are SVG, and stay sharp on a phone.
 *
 * Around that, the shared lab kit. Seven cities to stand in — four in
 * Uzbekistan, plus Murmansk (polar night), Quito (the equator) and Cape Town
 * (seasons the other way round) — each with its sunrise and sunset on its own
 * clock. A torch beam in the noon slice shows the same light spreading over
 * more ground as the Sun gets lower. Five missions, the torch-on-a-ball
 * explanation with the formulas behind a toggle, and sourced facts, three of
 * them worked out live from the same formulas.
 */

const CORRECT_ANSWER = 'tilt';
const MISSION_PREFIX = 'lab_seasons_';
/** Days of the year per real second while playing. */
const PLAY_RATE = 20;

const RAD = Math.PI / 180;
const VIEW_W = 800;
const VIEW_H = 760;
const ORBIT = { x: 215, y: 280, rx: 180, ry: 95 };
const CROSS = { x0: 452, x1: 768, y0: 84, horizon: 520, ground: 560, gx: 610, stick: 50 };
const CHART = { x0: 466, step: 24.5, bar: 15, base: 722, perHour: 5.6 };
/** Width of the torch beam in the noon slice, measured across its rays. */
const BEAM_WIDTH = 36;

/** The four days the orbit marks, worked out once: March and September equinoxes, June and December solstices. */
const MARKER_DAYS = equinoxesAndSolstices();
const { perihelionDay: PERIHELION_DAY, aphelionDay: APHELION_DAY } = perihelionAndAphelion();

/** Figures for the facts, worked out from the same formulas as everything else. */
const MURMANSK_POLAR_NIGHT = polarNightDays(cityById('Murmansk').latDeg);
const QUITO_RANGE = dayLengthRange(cityById('Quito').latDeg);
const NUKUS_LATER_MIN = Math.round((cityById('Tashkent').lonDeg - cityById('Nukus').lonDeg) * 4);

/**
 * The torch beam landing round the stick's foot: a band BEAM_WIDTH across,
 * which covers BEAM_WIDTH / sin(h) of ground. Polygon points and the footprint.
 */
function beamGeometry(g) {
  const footprint = BEAM_WIDTH / Math.sin(g.h);
  const half = Math.min(footprint / 2, 600);
  const dx = g.s * Math.cos(g.h) * 700;
  const dy = -Math.sin(g.h) * 700;
  const a = CROSS.gx - half;
  const b = CROSS.gx + half;
  return {
    points: `${a},${CROSS.horizon} ${b},${CROSS.horizon} ${b + dx},${CROSS.horizon + dy} ${a + dx},${CROSS.horizon + dy}`,
    a,
    b,
  };
}

/** Where Earth is drawn on the tilted orbit, from the Sun's ecliptic longitude. */
function orbitPoint(longitudeDeg) {
  const theta = longitudeDeg * RAD;
  return {
    x: ORBIT.x + ORBIT.rx * Math.sin(theta),
    y: ORBIT.y + ORBIT.ry * Math.cos(theta),
    // Nearer the viewer at the front of the ellipse, so drawn a little larger.
    r: 13 + 4 * Math.cos(theta),
  };
}

/**
 * Earth with its day side towards the Sun and its axis tilted.
 *
 * The axis always leans towards the screen's left: the direction of the Sun
 * as seen from the June-solstice position, where the northern hemisphere
 * leans in.
 */
function EarthGlyph({ x, y, r, tiltDeg, highlight = false, faint = false }) {
  const towardsSun = (Math.atan2(ORBIT.y - y, ORBIT.x - x) * 180) / Math.PI;
  const reach = r + 9;
  const ax = Math.sin(tiltDeg * RAD) * reach;
  const ay = Math.cos(tiltDeg * RAD) * reach;
  return (
    <g opacity={faint ? 0.35 : 1}>
      {highlight ? (
        <circle cx={x} cy={y} r={r + 8} fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="4 3" />
      ) : null}
      <circle cx={x} cy={y} r={r} fill="#0f1730" />
      <g transform={`rotate(${towardsSun} ${x} ${y})`}>
        <path d={`M${x} ${y - r} A${r} ${r} 0 0 1 ${x} ${y + r} Z`} fill="url(#season-earth)" />
      </g>
      <line x1={x + ax} y1={y + ay} x2={x - ax} y2={y - ay} stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" />
    </g>
  );
}

/**
 * The noon slice through Tashkent, in viewBox units: where the Sun, the top of
 * the stick and the end of its shadow are. Null when the Sun does not rise.
 */
function noonGeometry(sun) {
  if (sun.altitudeDeg <= 0) return null;
  const s = sun.side === 'south' ? -1 : 1;
  const h = sun.altitudeDeg * RAD;
  const topY = CROSS.horizon - CROSS.stick;
  const length = Math.min(1000, CROSS.stick / Math.tan(h));
  const tipX = CROSS.gx - s * length;
  const room = s < 0 ? CROSS.gx - (CROSS.x0 + 16) : CROSS.x1 - 16 - CROSS.gx;
  const reach = Math.min(170, room / Math.max(Math.cos(h), 1e-6));
  return {
    s,
    h,
    topY,
    tipX,
    tipVisible: tipX > CROSS.x0 + 4 && tipX < CROSS.x1 - 4,
    sunX: CROSS.gx + s * Math.cos(h) * reach,
    sunY: topY - Math.sin(h) * reach,
  };
}

export function SeasonsLab() {
  const { t } = useTranslation();

  // The page opens on today's date: today's sunrise in Tashkent is the first
  // number a reader can check out of the window.
  const [startDay] = useState(() => dayOfYearFor(new Date()));
  const [cityId, setCityId] = useState('Tashkent');
  const [day, setDay] = useState(startDay);
  const [tilt, setTilt] = useState(EARTH_TILT_DEG);
  const [answer, setAnswer] = useState(null);
  const [playing, setPlaying] = useState(false);
  const dayRef = useRef(startDay);
  const city = cityById(cityId);
  const lat = city.latDeg;
  const cityName = t('lab', `seasonCity${city.id}`);

  // Playing advances the date a whole day at a time, so the readouts change
  // at most PLAY_RATE times a second rather than on every frame.
  useEffect(() => {
    if (!playing || typeof requestAnimationFrame !== 'function') return undefined;
    let frame = 0;
    let last = performance.now();
    let position = dayRef.current;
    const step = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      position += PLAY_RATE * dt;
      if (position >= DAYS_IN_YEAR + 1) position -= DAYS_IN_YEAR;
      const whole = Math.floor(position);
      if (whole !== dayRef.current) {
        dayRef.current = whole;
        setDay(whole);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const chooseDay = (value) => {
    setPlaying(false);
    dayRef.current = value;
    setDay(value);
  };

  const formatDate = (dayOfYear) => {
    const { month, day: date } = calendarDate(dayOfYear);
    return t('lab', 'seasonDate', { day: date, month: t('lab', `seasonMonth${month}`) });
  };

  const formatLength = (hours) => {
    if (hours >= 24) return t('lab', 'seasonPolarDay');
    if (hours <= 0) return t('lab', 'seasonPolarNight');
    const minutes = Math.round(hours * 60);
    return t('lab', 'seasonHoursMinutes', { h: Math.floor(minutes / 60), m: minutes % 60 });
  };

  const formatShadow = (metres) =>
    metres === null ? t('lab', 'seasonNoSun') : t('lab', 'seasonMeters', { value: metres.toFixed(2) });

  const formatLat = (value) =>
    t('lab', value >= 0 ? 'seasonLatN' : 'seasonLatS', { value: Math.abs(value).toFixed(value === 0 ? 0 : 2) });

  const declination = declinationDeg(day, tilt);
  const sun = noonSun(lat, declination);
  const length = dayLengthHours(lat, declination);
  const shadow = shadowLengthM(sun.altitudeDeg);
  const geometry = noonGeometry(sun);
  const times = sunTimes(day, city, tilt);
  const sunlight = noonSunlightFraction(sun.altitudeDeg);
  const beam = geometry ? beamGeometry(geometry) : null;
  const isEarth = Math.abs(tilt - EARTH_TILT_DEG) < 0.05;

  // The opposite solstice, for the faint comparison: December's while the Sun
  // is north of the equator, June's while it is south.
  const oppositeDay = declination >= 0 ? MARKER_DAYS[3] : MARKER_DAYS[1];
  const oppositeSun = noonSun(lat, declinationDeg(oppositeDay, tilt));
  const oppositeGeometry = noonGeometry(oppositeSun);

  const monthly = useMemo(() => monthlyDayLengths(lat, tilt), [lat, tilt]);
  const currentMonth = calendarDate(day).month;
  const earthNow = orbitPoint(sunLongitudeDeg(day));
  const distanceMkm = (sunDistanceAu(day) * AU_KM) / 1e6;

  const clockOr = (hours, polarKey) => (hours === null ? t('lab', polarKey) : formatClock(hours));
  const polarKey = times.polar === 'day' ? 'seasonNoSunset' : 'seasonNoSunrise';
  const readouts = [
    { label: t('lab', 'seasonNoonAltitude'), value: `${sun.altitudeDeg.toFixed(1)}°` },
    { label: t('lab', 'seasonDayLength'), value: formatLength(length) },
    { label: t('lab', 'seasonSunrise'), value: clockOr(times.rise, polarKey) },
    { label: t('lab', 'seasonSunset'), value: clockOr(times.set, polarKey) },
    { label: t('lab', 'seasonShadow'), value: formatShadow(shadow) },
    { label: t('lab', 'seasonSunlight'), value: t('lab', 'seasonSunlightValue', { pct: Math.round(sunlight * 100) }) },
    { label: t('lab', 'seasonSeason'), value: t('lab', seasonKeyAt(day, tilt, lat)), wide: true },
  ];

  const pickAnswer = (id) => setAnswer(id);

  const missions = [
    {
      id: 'longest',
      title: t('lab', 'seasonMissionLongest'),
      hint: t('lab', 'seasonMissionLongestHint'),
      done: cityId === 'Tashkent' && isEarth && Math.abs(day - MARKER_DAYS[1]) <= 1,
    },
    {
      id: 'navruz',
      title: t('lab', 'seasonMissionNavruz'),
      hint: t('lab', 'seasonMissionNavruzHint'),
      done: isEarth && Math.abs(day - MARKER_DAYS[0]) <= 1,
    },
    { id: 'flat', title: t('lab', 'seasonMissionFlat'), done: tilt < 0.5 },
    {
      id: 'polar',
      title: t('lab', 'seasonMissionPolar'),
      hint: t('lab', 'seasonMissionPolarHint'),
      done: isEarth && length <= 0,
    },
    { id: 'why', title: t('lab', 'seasonMissionWhy'), done: answer === CORRECT_ANSWER },
  ];

  const mkm = (dayOfYear) => ((sunDistanceAu(dayOfYear) * AU_KM) / 1e6).toFixed(1);
  const facts = [
    {
      text: t('lab', 'seasonFactText', {
        near: formatDate(PERIHELION_DAY),
        nearKm: mkm(PERIHELION_DAY),
        far: formatDate(APHELION_DAY),
        farKm: mkm(APHELION_DAY),
      }),
      source: t('lab', 'seasonFactSource1'),
    },
    { text: t('lab', 'seasonFact2'), source: t('lab', 'seasonFactSource2') },
    { text: t('lab', 'seasonFact3'), source: t('lab', 'seasonFactSource3') },
    { text: t('lab', 'seasonFact4', { days: MURMANSK_POLAR_NIGHT }), source: t('lab', 'seasonFactSource4') },
    { text: t('lab', 'seasonFact5'), source: t('lab', 'seasonFactSource5') },
    {
      text: t('lab', 'seasonFact6', { minutes: Math.max(1, Math.round((QUITO_RANGE.max - QUITO_RANGE.min) * 60)) }),
      source: t('lab', 'seasonFactSource6'),
    },
    { text: t('lab', 'seasonFact7', { minutes: NUKUS_LATER_MIN }), source: t('lab', 'seasonFactSource7') },
    { text: t('lab', 'seasonFact8'), source: t('lab', 'seasonFactSource8') },
  ];

  const cityPresets = CITIES.map((c) => ({ id: c.id, label: t('lab', `seasonCity${c.id}`) }));

  const tiltPresets = [
    [0, t('lab', 'seasonTiltZero')],
    [EARTH_TILT_DEG, t('lab', 'seasonTiltEarth')],
    [90, t('lab', 'seasonTiltNinety')],
  ];

  const renderNoon = (g, { faint = false } = {}) => {
    if (!g) return null;
    const stroke = faint ? '#93c5fd' : '#fbbf24';
    return (
      <g opacity={faint ? 0.55 : 1}>
        <line
          x1={g.sunX}
          y1={g.sunY}
          x2={g.tipX}
          y2={CROSS.horizon}
          stroke={stroke}
          strokeWidth="1.5"
          strokeDasharray={faint ? '5 4' : undefined}
        />
        <line
          x1={CROSS.gx}
          y1={CROSS.horizon + 1}
          x2={g.tipX}
          y2={CROSS.horizon + 1}
          stroke={faint ? '#93c5fd' : '#000000'}
          strokeOpacity={faint ? 0.6 : 1}
          strokeWidth={faint ? 4 : 6}
          strokeDasharray={faint ? '6 4' : undefined}
        />
        {faint ? (
          <circle cx={g.sunX} cy={g.sunY} r="9" fill="#fde68a" fillOpacity="0.6" />
        ) : (
          <>
            <circle cx={g.sunX} cy={g.sunY} r="24" fill="url(#season-glow)" />
            <circle cx={g.sunX} cy={g.sunY} r="12" fill="url(#season-sun)" />
          </>
        )}
      </g>
    );
  };

  const angleLabel = (() => {
    if (!geometry) return null;
    const { s, h, tipX, tipVisible, sunX, sunY } = geometry;
    const text = `${sun.altitudeDeg.toFixed(1)}°`;
    if (!tipVisible) {
      return (
        <text x={sunX} y={sunY - 22} textAnchor="middle" className="fill-amber-300 font-mono" fontSize="16" fontWeight="700">
          {text}
        </text>
      );
    }
    const r = 26;
    return (
      <g>
        <path
          d={`M${tipX + s * r} ${CROSS.horizon} A${r} ${r} 0 0 ${s < 0 ? 1 : 0} ${tipX + s * r * Math.cos(h)} ${CROSS.horizon - r * Math.sin(h)}`}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.5"
        />
        <text
          x={tipX + s * 46 * Math.cos(h / 2)}
          y={CROSS.horizon - 46 * Math.sin(h / 2) + 5}
          textAnchor={s < 0 ? 'end' : 'start'}
          className="fill-amber-300 font-mono"
          fontSize="16"
          fontWeight="700"
        >
          {text}
        </text>
      </g>
    );
  })();

  const markerLabelOffset = [34, 36, -24, 36];

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Sun className="text-orange-400" /> {t('lab', 'seasonTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'seasonSubtitle')}</p>
          </div>

          <LabPresets label={t('lab', 'seasonCities')} presets={cityPresets} activeId={cityId} onPick={setCityId} />

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{t('lab', 'seasonDateLabel')}</span>
              <span className="font-mono text-white">{formatDate(day)}</span>
            </div>
            <input
              type="range"
              min="1"
              max={DAYS_IN_YEAR}
              step="1"
              value={day}
              onChange={(e) => chooseDay(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400"
              aria-label={t('lab', 'seasonDateLabel')}
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              {[0, 3, 6, 9, 11].map((m) => (
                <span key={m}>{t('lab', `seasonMonthShort${m}`)}</span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{t('lab', 'seasonTiltLabel')}</span>
              <span className="font-mono text-white">{tilt.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="0.1"
              value={tilt}
              onChange={(e) => setTilt(parseFloat(e.target.value))}
              className="w-full accent-cyan-400"
              aria-label={t('lab', 'seasonTiltLabel')}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {tiltPresets.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTilt(value)}
                  aria-pressed={Math.abs(tilt - value) < 0.05}
                  className={`min-h-10 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    Math.abs(tilt - value) < 0.05
                      ? 'bg-violet-500/30 border-violet-400 text-white'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {label}
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

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              {t('lab', 'seasonCompare', { date: formatDate(oppositeDay) })}
            </p>
            <p className="text-xs text-gray-200">
              {t('lab', 'seasonCompareValue', {
                alt: oppositeSun.altitudeDeg.toFixed(1),
                length: formatLength(dayLengthHours(lat, declinationDeg(oppositeDay, tilt))),
                shadow: formatShadow(shadowLengthM(oppositeSun.altitudeDeg)),
              })}
            </p>
          </div>

          <LabMissions prefix={MISSION_PREFIX} missions={missions} />

          <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-violet-300">{t('lab', 'seasonQuestionTitle')}</p>
            </div>
            <p className="text-sm text-white mb-3">{t('lab', 'seasonQuestion')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['distance', t('lab', 'seasonAnswerDistance')],
                ['tilt', t('lab', 'seasonAnswerTilt')],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => pickAnswer(id)}
                  aria-pressed={answer === id}
                  className={`min-h-10 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    answer === id
                      ? id === CORRECT_ANSWER
                        ? 'bg-green-500/20 border-green-400 text-green-200'
                        : 'bg-amber-500/20 border-amber-400 text-amber-100'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {answer ? (
              <p
                className={`mt-3 text-xs leading-relaxed ${
                  answer === CORRECT_ANSWER ? 'text-green-300' : 'text-amber-200'
                }`}
              >
                {t('lab', answer === CORRECT_ANSWER ? 'seasonAnswerRight' : 'seasonAnswerWrong')}
              </p>
            ) : null}
          </div>

          <LabExplain
            simple={t('lab', 'seasonExplainSimple')}
            formula={[
              t('lab', 'seasonExplainFormula1'),
              t('lab', 'seasonExplainFormula2'),
              t('lab', 'seasonExplainFormula3'),
              t('lab', 'seasonExplainFormula4'),
            ]}
            details={t('lab', 'seasonExplainDetails')}
          />

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'seasonModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', 'seasonHint')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'seasonViewName')}
        </div>
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <span className="font-mono text-xs text-cyan-200 bg-black/50 px-3 py-1.5 rounded-full">{formatDate(day)}</span>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={t('lab', playing ? 'seasonPause' : 'seasonPlay')}
            className="w-10 h-10 grid place-items-center rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
          role="img"
          aria-label={t('lab', 'seasonChartLabel')}
        >
          <defs>
            <radialGradient id="season-sun">
              <stop offset="0" stopColor="#fffbea" />
              <stop offset="0.6" stopColor="#fde68a" />
              <stop offset="1" stopColor="#f59e0b" />
            </radialGradient>
            <radialGradient id="season-glow">
              <stop offset="0.3" stopColor="#fde68a" stopOpacity="0.45" />
              <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="season-earth" cx="0.4" cy="0.4">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="0.6" stopColor="#2563eb" />
              <stop offset="1" stopColor="#1e3a8a" />
            </radialGradient>
            <linearGradient id="season-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1e3a8a" stopOpacity="0" />
              <stop offset="1" stopColor="#3b82f6" stopOpacity="0.28" />
            </linearGradient>
            <clipPath id="season-clip">
              <rect x={CROSS.x0} y={CROSS.y0} width={CROSS.x1 - CROSS.x0} height={CROSS.ground - CROSS.y0} />
            </clipPath>
          </defs>

          {/* Orbit, from above. */}
          <text x="24" y="78" className="fill-gray-400" fontSize="15" letterSpacing="2">
            {t('lab', 'seasonOrbitTitle').toUpperCase()}
          </text>
          <text x="24" y="98" className="fill-gray-500" fontSize="13">
            {t('lab', 'seasonNotToScale')}
          </text>
          <circle cx={ORBIT.x} cy={ORBIT.y} r="70" fill="url(#season-glow)" />
          <ellipse
            cx={ORBIT.x}
            cy={ORBIT.y}
            rx={ORBIT.rx}
            ry={ORBIT.ry}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeDasharray="4 6"
          />
          <circle cx={ORBIT.x} cy={ORBIT.y} r="28" fill="url(#season-sun)" />
          {MARKER_DAYS.map((markerDay, i) => {
            const p = orbitPoint(i * 90);
            // The two side labels hang inwards so neither runs off the picture.
            const anchor = ['middle', 'end', 'middle', 'start'][i];
            const labelX = p.x + [0, 26, 0, -26][i];
            return (
              <g key={markerDay}>
                <EarthGlyph x={p.x} y={p.y} r={p.r} tiltDeg={tilt} faint />
                <text x={labelX} y={p.y + markerLabelOffset[i]} textAnchor={anchor} className="fill-gray-400" fontSize="15">
                  {formatDate(markerDay)}
                </text>
              </g>
            );
          })}
          <EarthGlyph x={earthNow.x} y={earthNow.y} r={earthNow.r} tiltDeg={tilt} highlight />
          <text x="24" y="470" className="fill-gray-400" fontSize="15">
            {t('lab', 'seasonAxisNote')}
          </text>

          <rect x="24" y="560" width="390" height="120" rx="16" fill="#ffffff" fillOpacity="0.03" stroke="#ffffff" strokeOpacity="0.08" />
          <text x="44" y="598" className="fill-gray-400" fontSize="15" letterSpacing="2">
            {t('lab', 'seasonDistanceLabel').toUpperCase()}
          </text>
          <text x="44" y="648" className="fill-cyan-300 font-mono" fontSize="30" fontWeight="700">
            {t('lab', 'seasonDistanceValue', { value: distanceMkm.toFixed(1) })}
          </text>
          <text x="44" y="670" className="fill-gray-500" fontSize="13">
            {t('lab', 'seasonDistanceRange', { near: mkm(PERIHELION_DAY), far: mkm(APHELION_DAY) })}
          </text>

          {/* The city at noon, south on the left. */}
          <rect x="440" y="24" width="336" height="712" rx="18" fill="#ffffff" fillOpacity="0.03" stroke="#ffffff" strokeOpacity="0.09" />
          <text x="458" y="52" className="fill-white" fontSize="17" fontWeight="700">
            {t('lab', 'seasonCityNoon', { city: cityName })}
          </text>
          <text x="458" y="72" className="fill-gray-400" fontSize="13">
            {t('lab', 'seasonCitySubLat', { lat: formatLat(lat) })}
          </text>
          <rect x={CROSS.x0} y={CROSS.y0} width={CROSS.x1 - CROSS.x0} height={CROSS.horizon - CROSS.y0} fill="url(#season-sky)" />
          <rect x={CROSS.x0} y={CROSS.horizon} width={CROSS.x1 - CROSS.x0} height={CROSS.ground - CROSS.horizon} fill="#120f22" />
          <g clipPath="url(#season-clip)">
            {/* The torch beam: one band of sunlight, spread over 1/sin(h) of ground. */}
            {beam ? (
              <g>
                <polygon points={beam.points} fill="#fde68a" fillOpacity="0.2" />
                <line x1={beam.a} x2={beam.b} y1={CROSS.horizon - 1} y2={CROSS.horizon - 1} stroke="#fde68a" strokeWidth="4" strokeOpacity="0.85" />
              </g>
            ) : null}
            {renderNoon(oppositeGeometry, { faint: true })}
            {renderNoon(geometry)}
          </g>
          {beam ? (
            <text x={CROSS.x1 - 8} y={CROSS.y0 + 22} textAnchor="end" className="fill-amber-300" fontSize="14" fontWeight="700">
              {t('lab', 'seasonBeamLabel', { pct: Math.round(sunlight * 100) })}
            </text>
          ) : null}
          <line x1={CROSS.x0} y1={CROSS.horizon} x2={CROSS.x1} y2={CROSS.horizon} stroke="#ffffff" strokeOpacity="0.35" />
          <line
            x1={CROSS.gx}
            y1={CROSS.horizon}
            x2={CROSS.gx}
            y2={CROSS.horizon - CROSS.stick}
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {angleLabel}
          {!geometry ? (
            <text x={(CROSS.x0 + CROSS.x1) / 2} y="380" textAnchor="middle" className="fill-blue-300" fontSize="16">
              {t('lab', 'seasonBelowHorizon')}
            </text>
          ) : null}
          <text x={CROSS.x0 + 8} y={CROSS.horizon + 26} className="fill-gray-400" fontSize="14">
            {t('lab', 'seasonSouth')}
          </text>
          <text x={CROSS.x1 - 8} y={CROSS.horizon + 26} textAnchor="end" className="fill-gray-400" fontSize="14">
            {t('lab', 'seasonNorth')}
          </text>

          {/* Day length through the year, for the city and the tilt on the slider. */}
          <text x="458" y="590" className="fill-gray-400" fontSize="13" letterSpacing="2">
            {t('lab', 'seasonChartTitleCity', { city: cityName }).toUpperCase()}
          </text>
          <line
            x1={CHART.x0 - 4}
            x2={CHART.x0 + 11 * CHART.step + CHART.bar + 4}
            y1={CHART.base - 12 * CHART.perHour}
            y2={CHART.base - 12 * CHART.perHour}
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeDasharray="3 4"
          />
          {/* Above the line at the left, where January and February stay below it. */}
          <text x={CHART.x0 - 2} y={CHART.base - 12 * CHART.perHour - 5} className="fill-gray-500" fontSize="11">
            {t('lab', 'seasonTwelveHours')}
          </text>
          {monthly.map((hours, month) => {
            const x = CHART.x0 + month * CHART.step;
            const height = Math.max(1, hours * CHART.perHour);
            const on = month === currentMonth;
            return (
              <g key={month}>
                <rect
                  x={x}
                  y={CHART.base - height}
                  width={CHART.bar}
                  height={height}
                  rx="3"
                  fill={on ? '#22d3ee' : '#8b5cf6'}
                  fillOpacity={on ? 1 : 0.45}
                />
                {on ? (
                  <text x={x + CHART.bar / 2} y={CHART.base - height - 6} textAnchor="middle" className="fill-cyan-300 font-mono" fontSize="13" fontWeight="700">
                    {hours.toFixed(1)}
                  </text>
                ) : null}
                <text x={x + CHART.bar / 2} y={CHART.base + 16} textAnchor="middle" className={on ? 'fill-cyan-300' : 'fill-gray-500'} fontSize="11">
                  {t('lab', `seasonMonthShort${month}`)}
                </text>
              </g>
            );
          })}
        </svg>
      </LabViewport>
    </div>
  );
}
