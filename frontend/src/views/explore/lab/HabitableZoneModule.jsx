import { useMemo, useRef, useState } from 'react';
import { Earth } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  SOLAR_PLANETS,
  STAR_TYPES,
  SYSTEMS,
  equilibriumTemperatureK,
  habitableZone,
  isExtrapolated,
  starlight,
  viewSpanAu,
  waterState,
} from '@/lib/habitableZone';

/**
 * Habitable zone: where round a star a planet can keep liquid water.
 *
 * The reader picks a star — a real system (the Sun, Proxima Centauri,
 * TRAPPIST-1, Kepler-452) or a typical star of each class — and moves a planet
 * out from it, by dragging the planet or with the slider, and the panel says
 * what its water would do and why: how much starlight it gets compared with
 * Earth. The point is that the zone is not a fixed distance. Round a dim red
 * dwarf it shrinks to a few hundredths of an au, and TRAPPIST-1's seven
 * planets fit inside it and around it with room to spare.
 *
 * Missions replace the old two-star XP: boil an ocean, find the zone, find it
 * round every class of star, visit the nearest known exoplanet, and find which
 * TRAPPIST-1 planets are in the zone. A real system's planets reveal their
 * state only once visited, so the last one is a search, not a reading.
 *
 * The prediction comes first and the comparison of the four typical zones is
 * held back until it has been answered, because the comparison is the answer.
 * The temperature is the equilibrium temperature — no greenhouse — and the
 * page says so. Distances along the axis are to scale; the star and planet
 * sizes are not, and the picture says that too. No WebGL: this is a diagram.
 */

const CLASS_ORDER = ['M', 'K', 'G', 'F'];
const SYSTEM_ORDER = ['sun', 'proxima', 'trappist1', 'kepler452'];
const CORRECT_PREDICTION = 'closer';
const STATE_KEYS = { hot: 'hzResultHot', liquid: 'hzResultLiquid', frozen: 'hzResultCold' };
const WHY_KEYS = { hot: 'hzWhyHot', liquid: 'hzWhyLiquid', frozen: 'hzWhyCold' };
const STATE_COLOURS = { hot: '#fdba74', liquid: '#86efac', frozen: '#93c5fd' };
const STAR_NAME_KEYS = { M: 'hzStarM', K: 'hzStarK', G: 'hzStarG', F: 'hzStarF' };
const SYSTEM_NAME_KEYS = {
  sun: 'hzSysSun',
  proxima: 'hzSysProxima',
  trappist1: 'hzSysTrappist',
  kepler452: 'hzSysKepler452',
};
const SOLAR_NAME_KEYS = { venus: 'hzVenus', earth: 'hzEarth', mars: 'hzMars' };
const SOLAR_COLOURS = { venus: '#fcd34d', earth: '#60a5fa', mars: '#f87171' };

/** Where round its orbit each real planet is drawn, degrees from the axis. */
const PLANET_ANGLES = {
  sun: { venus: -45, earth: 38, mars: 18 },
  proxima: { b: -32 },
  trappist1: { b: -55, c: 42, d: -32, e: 26, f: -20, g: 14, h: -11 },
  kepler452: { b: -36 },
};

/** The TRAPPIST-1 planets this model puts in the zone (e, f and g). */
const TRAPPIST_IN_ZONE = (() => {
  const s = SYSTEMS.trappist1;
  const z = habitableZone(s.teff, s.luminosity);
  return s.planets.filter((p) => waterState(p.au, z) === 'liquid').map((p) => p.key);
})();

/** Drawing geometry, in viewBox units. */
const VIEW_W = 800;
const VIEW_H = 720;
const STAR = { x: 64, y: 330 };
const AXIS_END = 750;
const RULER_Y = 640;
/** Common scale for the comparison inset, au. */
const COMPARE_SPAN = 3;

function decimalsFor(span) {
  if (span <= 0.15) return 4;
  if (span <= 0.5) return 3;
  return 2;
}

/** Starlight as a short number: 0.0035, 0.66, 1.9, 12. */
function formatFlux(value) {
  if (value >= 10) return value.toFixed(0);
  if (value >= 0.1) return value.toFixed(2);
  return value.toPrecision(2);
}

const addOnce = (list, item) => (list.includes(item) ? list : [...list, item]);

export function HabitableZoneLab() {
  const { t } = useTranslation();

  const [systemId, setSystemId] = useState('sun');
  const [starType, setStarType] = useState('G');
  const [distance, setDistance] = useState(1);
  const [prediction, setPrediction] = useState(null);
  const [settled, setSettled] = useState([]);
  const [placedClasses, setPlacedClasses] = useState([]);
  const [visited, setVisited] = useState([]);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef(null);

  const system = systemId ? SYSTEMS[systemId] : null;
  const star = system ?? STAR_TYPES[starType];
  const starClass = system ? system.starClass : starType;
  const zone = useMemo(() => habitableZone(star.teff, star.luminosity), [star]);
  const span = viewSpanAu(zone);
  const pxPerAu = (AXIS_END - STAR.x) / span;
  const auToX = (au) => STAR.x + au * pxPerAu;
  const minDistance = span * 0.04;
  const places = decimalsFor(span);

  const state = waterState(distance, zone);
  const temperatureK = equilibriumTemperatureK(star.luminosity, distance);
  const temperatureC = Math.round(temperatureK - 273.15);
  const flux = starlight(star.luminosity, distance);

  const allZones = useMemo(
    () => CLASS_ORDER.map((type) => ({ type, ...habitableZone(STAR_TYPES[type].teff, STAR_TYPES[type].luminosity) })),
    [],
  );

  const systemName = (id) => t('lab', SYSTEM_NAME_KEYS[id]);
  const planetName = (id, key) =>
    id === 'sun' ? t('lab', SOLAR_NAME_KEYS[key]) : t('lab', 'hzPlanetName', { system: systemName(id), key });

  // A placement counts once the reader lets go: a planet dragged straight
  // through the zone and out the other side has not been placed in it.
  const settle = (au) => {
    const where = waterState(au, zone);
    setSettled((list) => addOnce(list, where));
    if (where === 'liquid') setPlacedClasses((list) => addOnce(list, starClass));
  };

  const chooseStar = (type) => {
    setSystemId(null);
    setStarType(type);
    // The planet stays where it was, if it still fits on the new axis: the
    // same orbit round a different star is the comparison worth seeing.
    const z = habitableZone(STAR_TYPES[type].teff, STAR_TYPES[type].luminosity);
    const s = viewSpanAu(z);
    setDistance((d) => Math.min(s, Math.max(s * 0.04, d)));
  };

  const chooseSystem = (id) => {
    const next = SYSTEMS[id];
    setSystemId(id);
    setDistance(next.planets.find((p) => p.key === next.home).au);
  };

  const visit = (planet) => {
    setDistance(planet.au);
    setVisited((list) => addOnce(list, `${systemId}:${planet.key}`));
    settle(planet.au);
  };

  const pointerAu = (event) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const { x, y } = point.matrixTransform(ctm.inverse());
    return { au: Math.min(span, Math.max(minDistance, (x - STAR.x) / pxPerAu)), y };
  };

  const onPointerDown = (event) => {
    const hit = pointerAu(event);
    if (!hit || Math.abs(hit.y - STAR.y) > 70) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    setDistance(hit.au);
  };
  const onPointerMove = (event) => {
    if (!dragging) return;
    const hit = pointerAu(event);
    if (hit) setDistance(hit.au);
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    settle(distance);
  };

  const ticks = useMemo(() => {
    const step = span / 5;
    return Array.from({ length: 6 }, (_, i) => i * step);
  }, [span]);

  const planetX = auToX(distance);
  const cardX = Math.min(VIEW_W - 216, Math.max(110, planetX - 100));
  const hotMid = (STAR.x + auToX(zone.inner)) / 2;
  const zoneMid = (auToX(zone.inner) + auToX(zone.outer)) / 2;
  const coldMid = (auToX(zone.outer) + AXIS_END) / 2;
  const zoneText = t('lab', 'hzZoneValue', { inner: zone.inner.toFixed(places), outer: zone.outer.toFixed(places) });
  const placedCount = CLASS_ORDER.filter((c) => placedClasses.includes(c)).length;

  const readouts = [
    { label: t('lab', 'hzZone'), value: zoneText },
    { label: t('lab', 'hzStarlight'), value: t('lab', 'hzStarlightValue', { value: formatFlux(flux) }) },
    { label: t('lab', 'hzTemperature'), value: t('lab', 'hzTempValue', { c: temperatureC, k: Math.round(temperatureK) }) },
    { label: t('lab', 'hzResult'), value: t('lab', STATE_KEYS[state]), colour: STATE_COLOURS[state] },
  ];

  const missions = [
    { id: 'zone', title: t('lab', 'hzMissionZone'), done: settled.includes('liquid') },
    { id: 'boil', title: t('lab', 'hzMissionBoil'), done: settled.includes('hot') },
    {
      id: 'proxima',
      title: t('lab', 'hzMissionProxima'),
      hint: t('lab', 'hzMissionProximaHint'),
      done: visited.includes('proxima:b'),
    },
    {
      id: 'types',
      title: t('lab', 'hzMissionTypes'),
      hint: t('lab', 'hzMissionTypesHint', { n: placedCount }),
      done: placedCount === CLASS_ORDER.length,
    },
    {
      id: 'trappist',
      title: t('lab', 'hzMissionTrappist'),
      hint: t('lab', 'hzMissionTrappistHint'),
      done: TRAPPIST_IN_ZONE.every((key) => visited.includes(`trappist1:${key}`)),
    },
  ];

  const facts = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    text: t('lab', `hzFact${n}`),
    source: t('lab', `hzFactSource${n}`),
  }));

  const starInfo = system
    ? t('lab', 'hzSystemInfo', { name: systemName(systemId), teff: star.teff, lum: star.luminosity })
    : t('lab', 'hzStarInfo', { name: t('lab', STAR_NAME_KEYS[starType]), teff: star.teff, lum: star.luminosity });

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          <div>
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Earth className="text-green-400" /> {t('lab', 'hzTitle')}
            </h3>
            <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'hzSubtitle')}</p>
          </div>

          <LabPresets
            label={t('lab', 'hzSystemsLabel')}
            presets={SYSTEM_ORDER.map((id) => ({ id, label: systemName(id) }))}
            activeId={systemId}
            onPick={chooseSystem}
          />

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t('lab', 'hzStarType')}</label>
            <div className="grid grid-cols-4 gap-2">
              {CLASS_ORDER.map((type) => (
                <button
                  key={type}
                  onClick={() => chooseStar(type)}
                  aria-pressed={!system && starType === type}
                  aria-label={t('lab', STAR_NAME_KEYS[type])}
                  className={`min-h-[40px] py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    !system && starType === type
                      ? 'bg-neon-blue text-space-900 font-bold'
                      : 'bg-space-800 text-gray-400 hover:bg-space-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAR_TYPES[type].colour }} />
                  {type}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">{starInfo}</p>
            {isExtrapolated(star.teff) ? (
              <p className="mt-2 text-xs leading-relaxed text-amber-200">
                {t('lab', 'hzExtrapolated', { name: systemName(systemId), teff: star.teff })}
              </p>
            ) : null}
          </div>

          {system ? (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{t('lab', 'hzPlanetsLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {system.planets.map((planet) => {
                  const seen = visited.includes(`${systemId}:${planet.key}`);
                  const where = waterState(planet.au, zone);
                  return (
                    <button
                      key={planet.key}
                      onClick={() => visit(planet)}
                      aria-label={t('lab', 'hzVisitPlanet', { name: planetName(systemId, planet.key) })}
                      className="flex items-center gap-1.5 min-h-[40px] md:min-h-[32px] px-3 py-1.5 rounded-full text-xs border bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: seen ? STATE_COLOURS[where] : '#6b7280' }}
                        aria-hidden="true"
                      />
                      {planetName(systemId, planet.key)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-500">{t('lab', 'hzPlanetsHint')}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{t('lab', 'hzDistance')}</span>
              <span className="font-mono text-white">{t('lab', 'hzAu', { value: distance.toFixed(places) })}</span>
            </div>
            <input
              type="range"
              min={minDistance}
              max={span}
              step={span / 500}
              value={distance}
              onChange={(e) => setDistance(parseFloat(e.target.value))}
              onPointerUp={(e) => settle(parseFloat(e.currentTarget.value))}
              onKeyUp={(e) => settle(parseFloat(e.currentTarget.value))}
              className="w-full h-6 accent-cyan-400"
              aria-label={t('lab', 'hzDistance')}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">{t('lab', 'hzWater')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['frozen', 'hzWaterIce'],
                ['liquid', 'hzWaterLiquid'],
                ['hot', 'hzWaterSteam'],
              ].map(([id, key]) => (
                <span
                  key={id}
                  className={`py-2 rounded-lg text-sm text-center ${
                    state === id ? 'font-bold text-space-900' : 'bg-space-800 text-gray-500'
                  }`}
                  style={state === id ? { backgroundColor: STATE_COLOURS[id] } : undefined}
                >
                  {t('lab', key)}
                </span>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
            {readouts.map((readout) => (
              <div key={readout.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
                <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{readout.label}</dt>
                <dd className="font-mono text-xs text-cyan-300" style={readout.colour ? { color: readout.colour } : undefined}>
                  {readout.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed" style={{ color: STATE_COLOURS[state] }}>
            {t('lab', WHY_KEYS[state], { flux: formatFlux(flux) })}
          </p>

          <div className="rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-indigo-500/5 p-4">
            <p className="text-[11px] uppercase tracking-wider text-violet-300 mb-2">{t('lab', 'hzPredictTitle')}</p>
            <p className="text-sm text-white mb-3">{t('lab', 'hzPredictQuestion')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['closer', 'hzPredictCloser'],
                ['farther', 'hzPredictFarther'],
                ['same', 'hzPredictSame'],
              ].map(([id, key]) => (
                <button
                  key={id}
                  onClick={() => setPrediction(id)}
                  aria-pressed={prediction === id}
                  className={`min-h-[40px] md:min-h-[32px] px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    prediction === id
                      ? id === CORRECT_PREDICTION
                        ? 'bg-green-500/20 border-green-400 text-green-200'
                        : 'bg-amber-500/20 border-amber-400 text-amber-100'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {t('lab', key)}
                </button>
              ))}
            </div>
            {prediction ? (
              <p className={`mt-3 text-xs leading-relaxed ${prediction === CORRECT_PREDICTION ? 'text-green-300' : 'text-amber-200'}`}>
                {t('lab', prediction === CORRECT_PREDICTION ? 'hzPredictRight' : 'hzPredictWrong')}
              </p>
            ) : null}
          </div>

          <LabMissions prefix="lab_habitable_" missions={missions} />

          <LabExplain
            simple={t('lab', 'hzExplainSimple')}
            formula={[t('lab', 'hzExplainFormula1'), t('lab', 'hzExplainFormula2')]}
            details={t('lab', 'hzExplainDetails')}
          />

          <p className="text-xs leading-relaxed text-gray-400">{t('lab', 'hzGreenhouseNote')}</p>

          <LabFacts facts={facts} />

          <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'hzModelNote')}</p>
        </div>
      </div>

      <LabViewport hint={t('lab', 'hzHint')}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {t('lab', 'hzViewName')}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)] touch-none select-none"
          role="img"
          aria-label={t('lab', 'hzChartLabel')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ cursor: dragging ? 'grabbing' : 'default' }}
        >
          <defs>
            <radialGradient id="hz-hot" cx={STAR.x} cy={STAR.y} r={Math.max(1, zone.inner * pxPerAu)} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#fb923c" stopOpacity="0.34" />
              <stop offset="1" stopColor="#f97316" stopOpacity="0.12" />
            </radialGradient>
            <radialGradient id="hz-glow">
              <stop offset="0.3" stopColor={star.colour} stopOpacity="0.55" />
              <stop offset="1" stopColor={star.colour} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hz-planet" cx="0.35" cy="0.35">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="0.6" stopColor="#2563eb" />
              <stop offset="1" stopColor="#1e3a8a" />
            </radialGradient>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="#38bdf8" fillOpacity="0.07" />
          <circle cx={STAR.x} cy={STAR.y} r={zone.outer * pxPerAu} fill="#4ade80" fillOpacity="0.14" />
          <circle cx={STAR.x} cy={STAR.y} r={zone.inner * pxPerAu} fill="url(#hz-hot)" />
          <circle cx={STAR.x} cy={STAR.y} r={zone.outer * pxPerAu} fill="none" stroke="#4ade80" strokeOpacity="0.5" strokeDasharray="6 6" />
          <circle cx={STAR.x} cy={STAR.y} r={zone.inner * pxPerAu} fill="none" stroke="#fb923c" strokeOpacity="0.5" strokeDasharray="6 6" />
          <line x1={STAR.x} x2={AXIS_END} y1={STAR.y} y2={STAR.y} stroke="#ffffff" strokeOpacity="0.12" />

          {/* The real system's planets, on their real orbits. */}
          {system
            ? system.planets.map((planet) => {
                const angle = (PLANET_ANGLES[systemId][planet.key] ?? 0) * (Math.PI / 180);
                const r = planet.au * pxPerAu;
                const x = STAR.x + r * Math.cos(angle);
                const y = STAR.y + r * Math.sin(angle);
                const seen = visited.includes(`${systemId}:${planet.key}`);
                const where = waterState(planet.au, zone);
                const solar = systemId === 'sun' ? SOLAR_PLANETS.find((p) => p.key === planet.key) : null;
                const label = solar
                  ? t('lab', 'hzPlanetTemp', { name: planetName('sun', planet.key), temp: solar.surfaceC })
                  : planet.key;
                return (
                  <g key={planet.key}>
                    <circle cx={STAR.x} cy={STAR.y} r={r} fill="none" stroke="#ffffff" strokeOpacity="0.12" />
                    <circle
                      cx={x}
                      cy={y}
                      r="7"
                      fill={solar ? SOLAR_COLOURS[planet.key] : seen ? STATE_COLOURS[where] : '#e5e7eb'}
                    />
                    <text x={x + 12} y={y - 4} fontSize="16" className={solar ? 'fill-gray-200' : 'fill-white'} fontWeight={solar ? '400' : '700'}>
                      {label}
                    </text>
                    {planet.key === 'mars' ? (
                      <text x={x + 12} y={y + 15} className="fill-gray-400" fontSize="14">
                        {t('lab', 'hzMarsNote')}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}

          <circle cx={STAR.x} cy={STAR.y} r="70" fill="url(#hz-glow)" />
          <circle cx={STAR.x} cy={STAR.y} r="26" fill={star.colour} />
          <text x={STAR.x} y={STAR.y + 54} textAnchor="middle" className="fill-white" fontSize="16">
            {system ? systemName(systemId) : t('lab', 'hzStarShort', { type: starType })}
          </text>

          {/* The reader's planet, on the axis, with what it would be like there. */}
          <rect x={cardX} y={STAR.y - 112} width="206" height="70" rx="12" fill="#030208" fillOpacity="0.8" stroke={STATE_COLOURS[state]} strokeOpacity="0.6" />
          <text x={cardX + 14} y={STAR.y - 89} className="fill-gray-400" fontSize="14">
            {t('lab', 'hzYourPlanet')}
          </text>
          <text x={cardX + 14} y={STAR.y - 70} className="fill-white" fontSize="16" fontWeight="700">
            {t('lab', 'hzAu', { value: distance.toFixed(places) })} · {t('lab', 'hzTempValue', { c: temperatureC, k: Math.round(temperatureK) })}
          </text>
          <text x={cardX + 14} y={STAR.y - 52} fontSize="14" style={{ fill: STATE_COLOURS[state] }}>
            {t('lab', STATE_KEYS[state])}
          </text>
          <circle cx={planetX} cy={STAR.y} r="22" fill="none" stroke={STATE_COLOURS[state]} strokeWidth="1.5" strokeDasharray="4 3" />
          <circle cx={planetX} cy={STAR.y} r="11" fill="url(#hz-planet)" style={{ cursor: 'grab' }} />
          <path
            d={`M${planetX - 30} ${STAR.y - 7} l-8 7 l8 7 M${planetX + 30} ${STAR.y - 7} l8 7 l-8 7`}
            fill="none"
            stroke={STATE_COLOURS[state]}
            strokeWidth="2"
            strokeLinecap="round"
          />

          <g textAnchor="middle" fontSize="16" fontWeight="700">
            <text x={hotMid} y={RULER_Y - 46} style={{ fill: STATE_COLOURS.hot }}>{t('lab', 'hzBandHot')}</text>
            <text x={zoneMid} y={RULER_Y - 46} style={{ fill: STATE_COLOURS.liquid }}>{t('lab', 'hzBandZone')}</text>
            <text x={coldMid} y={RULER_Y - 46} style={{ fill: STATE_COLOURS.frozen }}>{t('lab', 'hzBandCold')}</text>
          </g>
          <g textAnchor="middle" fontSize="14" className="fill-gray-400">
            <text x={hotMid} y={RULER_Y - 27}>{t('lab', 'hzBandHotSub')}</text>
            <text x={zoneMid} y={RULER_Y - 27}>{t('lab', 'hzBandZoneSub')}</text>
            <text x={coldMid} y={RULER_Y - 27}>{t('lab', 'hzBandColdSub')}</text>
          </g>
          <line x1={STAR.x} x2={AXIS_END} y1={RULER_Y} y2={RULER_Y} stroke="#ffffff" strokeOpacity="0.35" />
          {ticks.map((au) => (
            <g key={au}>
              <line x1={auToX(au)} x2={auToX(au)} y1={RULER_Y - 5} y2={RULER_Y + 5} stroke="#ffffff" strokeOpacity="0.35" />
              <text x={auToX(au)} y={RULER_Y + 24} textAnchor="middle" className="fill-gray-400" fontSize="14">
                {Number(au.toFixed(places))}
              </text>
            </g>
          ))}
          <text x={(STAR.x + AXIS_END) / 2} y={RULER_Y + 50} textAnchor="middle" className="fill-gray-400" fontSize="15">
            {t('lab', 'hzAxis')}
          </text>

          {/* Sizes are drawn for visibility; distances are true. Say so on the picture. */}
          <text x="24" y="96" className="fill-amber-200" fontSize="14">
            {t('lab', 'hzScaleNote')}
          </text>

          {/* The comparison is the answer to the prediction, so it waits for one. */}
          {prediction ? (
            <g>
              <rect x="534" y="14" width="252" height="186" rx="14" fill="#030208" fillOpacity="0.85" stroke="#ffffff" strokeOpacity="0.12" />
              <text x="550" y="40" className="fill-gray-300" fontSize="14" fontWeight="700">
                {t('lab', 'hzCompareTitle')}
              </text>
              {allZones.map((z, i) => {
                const y = 66 + i * 28;
                const x0 = 580;
                const px = 190 / COMPARE_SPAN;
                return (
                  <g key={z.type}>
                    <circle cx="556" cy={y} r="5" fill={STAR_TYPES[z.type].colour} />
                    <text x="566" y={y + 5} className="fill-white" fontSize="14" fontWeight={z.type === starClass ? '700' : '400'}>
                      {z.type}
                    </text>
                    <line x1={x0} x2={x0 + 190} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.15" />
                    <rect x={x0 + z.inner * px} y={y - 5} width={Math.max(2, (z.outer - z.inner) * px)} height="10" rx="3" fill="#4ade80" fillOpacity="0.75" />
                  </g>
                );
              })}
              {[0, 1, 2, 3].map((au) => (
                <text key={au} x={580 + (au * 190) / COMPARE_SPAN} y="190" textAnchor="middle" className="fill-gray-500" fontSize="12">
                  {au === COMPARE_SPAN ? t('lab', 'hzAu', { value: au }) : au}
                </text>
              ))}
            </g>
          ) : null}
        </svg>
      </LabViewport>
    </div>
  );
}
