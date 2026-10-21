import { useRef, useState } from 'react';
import { Landmark } from 'lucide-react';

import { useTranslation } from '@/hooks/useTranslation';
import { LabViewport } from './LabCanvas';
import { LabExplain, LabFacts, LabMissions, LabPresets } from './LabKit';
import {
  CITIES,
  EARTH_MEAN_CIRCUMFERENCE_KM,
  EARTH_MEAN_RADIUS_KM,
  ERATOSTHENES_ANGLE_DEG,
  OBLIQUITY_DEG,
  STADION_M,
  SUN_ANGULAR_DIAMETER_DEG,
  SYENE_ALEXANDRIA_STADIA,
  VIEWPOINTS,
  arcminuteSensitivity,
  dipAngleDeg,
  eratosthenes,
  fromSolsticeAltitudes,
  horizonDistanceKm,
  radiusFromDip,
  relativeError,
  shadowAngleDeg,
  shadowLength,
  solsticeAltitudes,
  stadiaToKm,
} from '@/lib/earthMeasure';

/**
 * The observatory: measure the Earth the way Biruni, Eratosthenes and Ulugh
 * Beg's astronomers did, and compare the answer with theirs.
 *
 * Three tabs, each a short guided experiment with the same shape — three
 * numbered steps, a measurement the reader makes themselves, a Check button
 * that judges *their* number, and missions that remember what they reached:
 *
 * - **Biruni's method.** The reader is not told the dip of the horizon; they
 *   find it, by turning the sight line until the horizon sits on the
 *   crosshair of a magnified eyepiece. The radius is worked out from *their*
 *   angle, so a careless sighting gives a wrong Earth — by a surprising
 *   margin, because R goes as 1 / alpha^2. Real places to stand (the Tashkent
 *   TV Tower, Big Chimgan, Everest) turn that into the method's real lesson:
 *   the higher you stand, the less one arcminute costs.
 * - **Eratosthenes.** The reader reads where the shadow of a 1 m stick in
 *   Alexandria ends, on a magnified ruler with the fuzzy edge a real
 *   half-degree Sun casts. The angle, and the Earth, come from that reading
 *   and from a distance in stadia whose length nobody knows for certain — so
 *   the two stadion lengths historians argue between are both offered.
 * - **Ulugh Beg's meridian arc.** The reader reads the noon Sun off the scale
 *   on the two solstices; tilt and latitude come out of their two readings —
 *   in Samarkand, or with the instrument carried to another Uzbek city.
 *
 * The Earth drawings are schematic and their angles enlarged — a one-degree
 * dip is invisible at true scale, and the page says how invisible. Every
 * number comes from `lib/earthMeasure.js`, which names its sources.
 */

const MISSION_PREFIX = 'lab_biruni_';
const RADIUS_TOLERANCE = 0.02;
const PEAK_MIN_KM = 3;
const PEAK_TOLERANCE = 0.01;
const CIRCUMFERENCE_TOLERANCE = 0.05;
const SEXTANT_TOLERANCE_DEG = 0.3;
const HOME_CITY = 'samarkand';

const VIEW_W = 800;
const VIEW_H = 760;
const DEG = Math.PI / 180;

/** Named once, shown on the page under each fact. */
const SOURCES = {
  mactutor: 'MacTutor History of Mathematics (St Andrews)',
  mactutorIugg: 'MacTutor History of Mathematics (St Andrews); IUGG mean radius',
  iau: 'IAU Gazetteer of Planetary Nomenclature',
  iauMpc: 'IAU Gazetteer of Planetary Nomenclature; Minor Planet Center',
  britannica: 'Encyclopaedia Britannica',
  cleomedes: 'Cleomedes, Caelestia 1.7',
  stadion: 'Cleomedes, Caelestia 1.7; modern estimates of the stadion',
  au: 'IAU 2012 Resolution B2 (the astronomical unit)',
  dsb: 'Dictionary of Scientific Biography (Ulugh Beg)',
  geometry: 'd = sqrt(h (2R + h)), refraction ignored',
  formula: 'R = h cos(a) / (1 - cos(a)), computed in this module',
};

const PLACE_KEYS = {
  tower: 'biruniPlaceTower',
  burj: 'biruniPlaceBurj',
  chimgan: 'biruniPlaceChimgan',
  everest: 'biruniPlaceEverest',
};

const CITY_KEYS = {
  samarkand: 'biruniCitySamarkand',
  tashkent: 'biruniCityTashkent',
  bukhara: 'biruniCityBukhara',
  nukus: 'biruniCityNukus',
  termez: 'biruniCityTermez',
};

/** 12 345 rather than 12345 or 12,345: the space reads the same in every locale. */
function formatKm(km) {
  return Math.round(km).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A distance that may be small: one decimal below 10 km. */
function formatDistance(km) {
  return km < 10 ? km.toFixed(1) : formatKm(km);
}

/** 787.5 stays 787.5 and 925 stays 925: a stadia distance is shown as it was set. */
function formatStadiaKm(km) {
  return Number.isInteger(km) ? formatKm(km) : km.toFixed(1);
}

function formatSignedPercent(fraction, places = 1) {
  const pct = fraction * 100;
  return `${pct > 0 ? '+' : ''}${pct.toFixed(places)}`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * All five missions, whichever tab is open. Each tab passes the live flags it
 * owns; missions reached on another tab stay ticked because the store
 * remembers them.
 */
function observatoryMissions(t, flags) {
  return [
    { id: 'radius', title: t('lab', 'biruniMissionRadius'), hint: t('lab', 'biruniMissionRadiusHint'), done: Boolean(flags.radius) },
    { id: 'peak', title: t('lab', 'biruniMissionPeak'), hint: t('lab', 'biruniMissionPeakHint'), done: Boolean(flags.peak) },
    {
      id: 'circumference',
      title: t('lab', 'biruniMissionCircumference'),
      hint: t('lab', 'biruniMissionCircumferenceHint'),
      done: Boolean(flags.circumference),
    },
    { id: 'tilt', title: t('lab', 'biruniMissionTilt'), hint: t('lab', 'biruniMissionTiltHint'), done: Boolean(flags.tilt) },
    { id: 'city', title: t('lab', 'biruniMissionCity'), hint: t('lab', 'biruniMissionCityHint'), done: Boolean(flags.city) },
  ];
}

/** A fixed scatter of faint stars for the sky behind the Earth drawings. */
const STARS = (() => {
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 40 }, () => ({ x: next() * VIEW_W, y: next() * 330, r: 0.6 + next() * 1.1, o: 0.25 + next() * 0.5 }));
})();

export function BiruniObservatoryLab() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('method');

  const header = (
    <>
      <div>
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Landmark className="text-amber-300 shrink-0" /> {t('lab', 'biruniTitle')}
        </h3>
        <p className="text-sm leading-relaxed text-gray-400">{t('lab', 'biruniSubtitle')}</p>
      </div>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {[
          ['method', t('lab', 'biruniTabMethod')],
          ['eratosthenes', t('lab', 'biruniTabEratosthenes')],
          ['sextant', t('lab', 'biruniTabSextant')],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[44px] px-1 py-2 rounded-lg text-xs leading-tight transition-colors ${
              tab === id ? 'bg-neon-blue text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );

  if (tab === 'eratosthenes') return <EratosthenesTab header={header} />;
  if (tab === 'sextant') return <SextantTab header={header} />;
  return <MethodTab header={header} />;
}

/** The two-column frame every tab sits in. */
function Shell({ header, chip, hint, view, children }) {
  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
      <div className="w-full md:w-1/3 space-y-5 md:overflow-y-auto">
        <div className="glass p-6 rounded-2xl space-y-5">
          {header}
          {children}
        </div>
      </div>
      <LabViewport hint={hint}>
        <div className="absolute top-4 left-4 z-10 text-[10px] uppercase tracking-widest text-violet-200 bg-violet-500/15 border border-violet-400/30 px-3 py-1.5 rounded-full">
          {chip}
        </div>
        {view}
      </LabViewport>
    </div>
  );
}

/** Three numbered steps: what to do, in order, for a reader who has never done it. */
function Steps({ items }) {
  return (
    <ol className="space-y-1.5">
      {items.map((text, i) => (
        <li key={text} className="flex gap-2 text-xs text-gray-300">
          <span className="w-5 h-5 shrink-0 grid place-items-center rounded-full bg-amber-400/15 border border-amber-400/40 text-[10px] font-bold text-amber-200">
            {i + 1}
          </span>
          <span className="leading-5">{text}</span>
        </li>
      ))}
    </ol>
  );
}

function RangeRow({ label, value, children }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-gray-400">
        <span>{label}</span>
        <span className="font-mono text-white text-right">{value}</span>
      </div>
      {children}
    </div>
  );
}

function StepButtons({ steps, onStep, label }) {
  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {steps.map(([text, delta]) => (
        <button
          key={text}
          onClick={() => onStep(delta)}
          className="flex-1 min-h-[40px] py-2 rounded-lg text-xs font-mono bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Readouts({ items }) {
  return (
    <dl className="grid grid-cols-2 gap-2 pt-4 border-t border-white/10">
      {items.map((r) => (
        <div key={r.label} className="rounded-xl border border-white/10 bg-black/30 p-2.5">
          <dt className="text-[10px] text-gray-500 uppercase tracking-wider">{r.label}</dt>
          <dd className="font-mono text-xs text-cyan-300">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CheckButton({ label, onCheck }) {
  return (
    <button
      onClick={onCheck}
      className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-500 shadow-[0_0_22px_rgba(124,58,237,0.45)] hover:brightness-110"
    >
      {label}
    </button>
  );
}

function Verdict({ verdict }) {
  if (!verdict) return null;
  return (
    <p
      role="status"
      className={`rounded-2xl border p-4 text-sm leading-relaxed ${
        verdict.ok ? 'border-green-400/40 bg-green-500/10 text-green-100' : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
      }`}
    >
      {verdict.text}
    </p>
  );
}

function SkyStars() {
  return (
    <g aria-hidden="true">
      {STARS.map((s) => (
        <circle key={`${s.x.toFixed(1)}-${s.y.toFixed(1)}`} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" opacity={s.o} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------------ */
/* Biruni's method                                                          */
/* ------------------------------------------------------------------------ */

/** The drawing's own Earth: exaggerated so a one-degree dip can be seen. */
const M = { cx: 330, surfaceY: 330, r: 880 };
const EYE = { x: 668, y: 118, r: 82, pxPerArcmin: 12 };
const KNOB_DISTANCE = 230;
const DRAG_DEG_PER_UNIT = 0.002;
const MAX_HEIGHT_KM = 9;
const MAX_DIP_DEG = 3.5;

/** Drawn height of the summit: a square root, so Everest fits and a tower still shows. */
const summitPx = (heightKm) => 28 + 60 * Math.sqrt(heightKm);

function methodGeometry(heightKm, alphaDeg, trueAlphaDeg) {
  const hPx = summitPx(heightKm);
  const S = { x: M.cx, y: M.surfaceY - hPx };
  const O = { x: M.cx, y: M.surfaceY + M.r };
  const drawnDip = Math.acos(M.r / (M.r + hPx));
  // The reader's angle is drawn at the same exaggeration as the true one, so
  // the line touches the drawn horizon exactly when it touches the real one.
  const phi = alphaDeg * DEG * (drawnDip / (trueAlphaDeg * DEG));
  const d = { x: Math.cos(phi), y: Math.sin(phi) };
  const fx = S.x - O.x;
  const fy = S.y - O.y;
  const b = 2 * (fx * d.x + fy * d.y);
  const c = fx * fx + fy * fy - M.r * M.r;
  const disc = b * b - 4 * c;
  let hit = null;
  if (disc >= 0) {
    const tHit = (-b - Math.sqrt(disc)) / 2;
    if (tHit > 0) hit = { x: S.x + tHit * d.x, y: S.y + tHit * d.y };
  }
  const end = hit ?? { x: S.x + 600 * d.x, y: S.y + 600 * d.y };
  const T = { x: O.x + M.r * Math.sin(drawnDip), y: O.y - M.r * Math.cos(drawnDip) };
  const knob = { x: S.x + KNOB_DISTANCE * d.x, y: S.y + KNOB_DISTANCE * d.y };
  return { S, O, T, d, phi, hit, end, knob, hPx };
}

/** The summit: a mountain with snow when it is high, or a tower, or a stepped spire. */
function Summit({ kind, S, groundAt }) {
  const base = groundAt(M.cx);
  if (kind === 'tower') {
    const pod = S.y + (base - S.y) * 0.32;
    return (
      <g>
        <path d={`M${M.cx - 11} ${base} L${M.cx - 3} ${S.y + 22} L${M.cx + 3} ${S.y + 22} L${M.cx + 11} ${base} Z`} fill="url(#biruni-tower)" />
        <line x1={M.cx} y1={S.y + 22} x2={M.cx} y2={S.y} stroke="#e5e7eb" strokeWidth="2" />
        <ellipse cx={M.cx} cy={pod} rx="13" ry="6" fill="#e5e7eb" />
        <ellipse cx={M.cx} cy={pod} rx="13" ry="2" fill="#67e8f9" fillOpacity="0.6" />
      </g>
    );
  }
  if (kind === 'spire') {
    const h = base - S.y;
    const steps = [16, 12, 8, 5, 2];
    let path = `M${M.cx - steps[0]} ${base}`;
    steps.forEach((w, i) => {
      const y = base - (h * (i + 1)) / (steps.length + 0.6);
      path += ` L${M.cx - w} ${y} L${M.cx - (steps[i + 1] ?? 0.6)} ${y}`;
    });
    path += ` L${M.cx} ${S.y}`;
    const right = `M${M.cx + steps[0]} ${base}` + steps.map((w, i) => {
      const y = base - (h * (i + 1)) / (steps.length + 0.6);
      return ` L${M.cx + w} ${y} L${M.cx + (steps[i + 1] ?? 0.6)} ${y}`;
    }).join('') + ` L${M.cx} ${S.y}`;
    return (
      <g fill="url(#biruni-tower)">
        <path d={`${path} L${M.cx} ${base} Z`} />
        <path d={`${right} L${M.cx} ${base} Z`} />
      </g>
    );
  }
  const hPx = base - S.y;
  const half = 40 + hPx * 0.45;
  const snow = hPx > 110;
  const snowY = S.y + hPx * 0.28;
  const snowHalf = half * 0.28;
  return (
    <g>
      <path d={`M${M.cx - half} ${groundAt(M.cx - half)} L${S.x} ${S.y} L${M.cx + half} ${groundAt(M.cx + half)} Z`} fill="url(#biruni-mountain)" />
      {snow ? (
        <path
          d={`M${S.x - snowHalf} ${snowY} L${S.x} ${S.y} L${S.x + snowHalf} ${snowY} L${S.x + snowHalf * 0.4} ${snowY - 6} L${S.x} ${snowY + 4} L${S.x - snowHalf * 0.45} ${snowY - 5} Z`}
          fill="#f8fafc"
          fillOpacity="0.9"
        />
      ) : null}
    </g>
  );
}

function MethodTab({ header }) {
  const { t } = useTranslation();
  const [heightKm, setHeightKm] = useState(1);
  const [alphaDeg, setAlphaDeg] = useState(0.5);
  const [verdict, setVerdict] = useState(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const trueAlpha = dipAngleDeg(heightKm);
  const readerRadius = radiusFromDip(heightKm, alphaDeg);
  const error = Number.isFinite(readerRadius) ? relativeError(readerRadius, EARTH_MEAN_RADIUS_KM) : null;
  const sensitivity = Math.abs(arcminuteSensitivity(heightKm, trueAlpha));
  const offArcmin = (alphaDeg - trueAlpha) * 60;
  const onHorizon = Math.abs(offArcmin) < 0.15;
  const horizonKm = horizonDistanceKm(heightKm);
  const viewpoint = VIEWPOINTS.find((v) => Math.abs(v.heightKm - heightKm) < 1e-9) ?? null;
  // The mountain at true scale, on this drawing's 880-unit Earth.
  const truePx = (heightKm / EARTH_MEAN_RADIUS_KM) * M.r;

  const g = methodGeometry(heightKm, alphaDeg, trueAlpha);

  const changeAlpha = (next) => {
    setAlphaDeg(clamp(next, 0, MAX_DIP_DEG));
    setVerdict(null);
  };
  const changeHeight = (next) => {
    setHeightKm(clamp(next, 0.1, MAX_HEIGHT_KM));
    setVerdict(null);
  };
  const pickViewpoint = (id) => {
    const place = VIEWPOINTS.find((v) => v.id === id);
    if (place) changeHeight(place.heightKm);
  };

  const toView = (event) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!ctm) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    return p.matrixTransform(ctm.inverse());
  };
  const startDrag = (event) => {
    const p = toView(event);
    if (!p) return;
    dragRef.current = { y: p.y, alpha: alphaDeg };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };
  const drag = (event) => {
    if (!dragRef.current) return;
    const p = toView(event);
    if (p) changeAlpha(dragRef.current.alpha + (p.y - dragRef.current.y) * DRAG_DEG_PER_UNIT);
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  // A wrong answer says which way it is wrong, and why: a radius too big
  // means the angle was too small, and the sight line missed the Earth.
  const check = () => {
    const ok = error !== null && Math.abs(error) <= RADIUS_TOLERANCE;
    let text;
    if (error === null) {
      text = t('lab', 'biruniResultNoDip');
    } else if (ok) {
      text = t('lab', 'biruniResultOk', { pct: formatSignedPercent(error) });
      if (heightKm >= PEAK_MIN_KM && Math.abs(error) > PEAK_TOLERANCE) text += ` ${t('lab', 'biruniResultPeakHint')}`;
    } else {
      text = t('lab', error > 0 ? 'biruniResultOffBig' : 'biruniResultOffSmall', { pct: (Math.abs(error) * 100).toFixed(1) });
    }
    setVerdict({ ok, error, heightKm, text });
  };

  const flags = {
    radius: verdict?.ok,
    peak: verdict?.ok && verdict.heightKm >= PEAK_MIN_KM && Math.abs(verdict.error) <= PEAK_TOLERANCE,
  };

  const eyeStatus = onHorizon ? 'On' : offArcmin > 0 ? 'Above' : 'Below';
  const horizonY = EYE.y + clamp(-offArcmin * EYE.pxPerArcmin, -EYE.r - 10, EYE.r + 10);
  const arcEnd = { x: g.S.x + 90 * Math.cos(g.phi), y: g.S.y + 90 * Math.sin(g.phi) };
  const toO = { x: (g.O.x - g.T.x) / M.r, y: (g.O.y - g.T.y) / M.r };
  const toS = (() => {
    const dx = g.S.x - g.T.x;
    const dy = g.S.y - g.T.y;
    const len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len };
  })();
  const groundAt = (x) => g.O.y - Math.sqrt(M.r * M.r - (x - M.cx) ** 2);
  const kind = viewpoint?.kind ?? 'mountain';
  const summitHalf = kind === 'mountain' ? 40 + g.hPx * 0.45 : 18;

  const trueScale = (
    <p className="absolute left-4 bottom-14 z-10 max-w-[70%] rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] leading-snug text-gray-300">
      {t('lab', 'biruniTrueScale', { px: truePx < 1 ? truePx.toFixed(2) : truePx.toFixed(1) })}
    </p>
  );

  const view = (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
      role="img"
      aria-label={t('lab', 'biruniViewMethodLabel')}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <defs>
        <radialGradient id="biruni-earth" cx={g.O.x} cy={g.O.y} r={M.r} gradientUnits="userSpaceOnUse">
          <stop offset="0.8" stopColor="#1e1b4b" />
          <stop offset="0.97" stopColor="#312e81" />
          <stop offset="1" stopColor="#4338ca" />
        </radialGradient>
        <linearGradient id="biruni-mountain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="biruni-tower" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.5" stopColor="#e2e8f0" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="biruni-eye-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1a3a" />
          <stop offset="1" stopColor="#3b5ba5" />
        </linearGradient>
        <clipPath id="biruni-eye-clip">
          <circle cx={EYE.x} cy={EYE.y} r={EYE.r} />
        </clipPath>
      </defs>

      <SkyStars />
      {/* A thin glow of air over the Earth's edge. */}
      <circle cx={g.O.x} cy={g.O.y} r={M.r + 7} fill="none" stroke="#38bdf8" strokeOpacity="0.18" strokeWidth="12" />
      <circle cx={g.O.x} cy={g.O.y} r={M.r} fill="url(#biruni-earth)" stroke="#818cf8" strokeOpacity="0.6" strokeWidth="1.5" />
      <Summit kind={kind} S={g.S} groundAt={groundAt} />
      {viewpoint ? (
        <text x={g.S.x} y={g.S.y - 30} textAnchor="middle" className="fill-amber-200" fontSize="16" fontWeight="700">
          {t('lab', PLACE_KEYS[viewpoint.id])}
        </text>
      ) : null}

      <line x1={g.S.x} y1={g.S.y} x2={g.S.x} y2={VIEW_H} stroke="#c4b5fd" strokeOpacity="0.7" strokeDasharray="6 5" />
      <line x1={g.T.x} y1={g.T.y} x2={g.T.x + toO.x * 900} y2={g.T.y + toO.y * 900} stroke="#c4b5fd" strokeOpacity="0.7" strokeDasharray="6 5" />
      <path
        d={`M${g.T.x + toS.x * 13} ${g.T.y + toS.y * 13} L${g.T.x + (toS.x + toO.x) * 13} ${g.T.y + (toS.y + toO.y) * 13} L${g.T.x + toO.x * 13} ${g.T.y + toO.y * 13}`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.6"
      />
      <circle cx={g.T.x} cy={g.T.y} r={onHorizon ? 9 : 4} fill={onHorizon ? 'none' : '#67e8f9'} stroke={onHorizon ? '#4ade80' : 'none'} strokeWidth="2.5" />

      <line x1={g.S.x} y1={g.S.y} x2={VIEW_W - 20} y2={g.S.y} stroke="#ffffff" strokeOpacity="0.3" strokeDasharray="4 5" />
      <line x1={g.S.x} y1={g.S.y} x2={g.end.x} y2={g.end.y} stroke="#67e8f9" strokeWidth="2.5" />
      {g.hit && !onHorizon ? (
        <path
          d={`M${g.hit.x - 8} ${g.hit.y - 8} L${g.hit.x + 8} ${g.hit.y + 8} M${g.hit.x + 8} ${g.hit.y - 8} L${g.hit.x - 8} ${g.hit.y + 8}`}
          stroke="#f87171"
          strokeWidth="3"
        />
      ) : null}
      <path d={`M${g.S.x + 90} ${g.S.y} A90 90 0 0 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
      <text x={g.S.x + 100} y={g.S.y + 20} className="fill-amber-300" fontSize="20" fontWeight="700">
        {t('lab', 'biruniLabelAlpha')}
      </text>

      <circle cx={g.S.x} cy={g.S.y - 13} r="5" fill="#ffffff" />
      <line x1={g.S.x} y1={g.S.y - 8} x2={g.S.x} y2={g.S.y} stroke="#ffffff" strokeWidth="2" />

      <g onPointerDown={startDrag} style={{ cursor: 'ns-resize', touchAction: 'none' }}>
        {/* An invisible ring around the handle: a finger-sized target on a phone, where the drawing is shrunk. */}
        <circle cx={g.knob.x} cy={g.knob.y} r="46" fill="transparent" />
        <circle cx={g.knob.x} cy={g.knob.y} r="26" fill="#22d3ee" fillOpacity="0.12" />
        <circle cx={g.knob.x} cy={g.knob.y} r="11" fill="#22d3ee" stroke="#ffffff" strokeWidth="2" />
        <text x={g.knob.x} y={g.knob.y - 32} textAnchor="middle" className="fill-cyan-200" fontSize="15">
          {t('lab', 'biruniDragHandle')}
        </text>
      </g>

      <text x={M.cx - summitHalf - 10} y={(g.S.y + M.surfaceY) / 2 + 8} textAnchor="end" className="fill-white" fontSize="20" fontWeight="700">
        {t('lab', 'biruniLabelH')}
      </text>
      <text x={M.cx - 14} y={560} textAnchor="end" className="fill-violet-300" fontSize="20" fontWeight="700">
        {t('lab', 'biruniLabelR')}
      </text>
      <text x={g.T.x + toO.x * 220 + 14} y={g.T.y + toO.y * 220} className="fill-violet-300" fontSize="20" fontWeight="700">
        {t('lab', 'biruniLabelR')}
      </text>
      <text x={Math.min(g.T.x, 690)} y={g.T.y + 38} textAnchor="middle" className="fill-cyan-300" fontSize="15">
        {t('lab', 'biruniLabelHorizonKm', { km: formatDistance(horizonKm) })}
      </text>
      <text x={M.cx + 120} y={VIEW_H - 14} textAnchor="middle" className="fill-gray-400" fontSize="15">
        {t('lab', 'biruniLabelCenter')}
      </text>
      <g>
        <circle cx={EYE.x} cy={EYE.y} r={EYE.r + 6} fill="#030208" stroke="#fcd34d" strokeOpacity="0.7" strokeWidth="2" />
        <g clipPath="url(#biruni-eye-clip)">
          <rect x={EYE.x - EYE.r} y={EYE.y - EYE.r} width={EYE.r * 2} height={EYE.r * 2} fill="url(#biruni-eye-sky)" />
          <rect x={EYE.x - EYE.r} y={horizonY} width={EYE.r * 2} height={EYE.r * 2 + 20} fill="#1e1b4b" />
          <line x1={EYE.x - EYE.r} x2={EYE.x + EYE.r} y1={horizonY} y2={horizonY} stroke="#c4b5fd" strokeWidth="1.5" />
          {[-3, -2, -1, 1, 2, 3].map((m) => (
            <line
              key={m}
              x1={EYE.x - 6}
              x2={EYE.x + 6}
              y1={EYE.y + m * EYE.pxPerArcmin}
              y2={EYE.y + m * EYE.pxPerArcmin}
              stroke="#fcd34d"
              strokeOpacity="0.7"
            />
          ))}
          <line x1={EYE.x - EYE.r} x2={EYE.x + EYE.r} y1={EYE.y} y2={EYE.y} stroke="#fcd34d" strokeWidth="1.5" />
          <line x1={EYE.x} x2={EYE.x} y1={EYE.y - EYE.r} y2={EYE.y + EYE.r} stroke="#fcd34d" strokeOpacity="0.5" />
        </g>
        <text x={EYE.x} y={EYE.y - EYE.r - 16} textAnchor="middle" className="fill-gray-300" fontSize="15">
          {t('lab', 'biruniLabelEyepiece')}
        </text>
        <text
          x={EYE.x}
          y={EYE.y + EYE.r + 30}
          textAnchor="middle"
          className={onHorizon ? 'fill-green-300' : 'fill-amber-200'}
          fontSize="16"
          fontWeight="700"
        >
          {t('lab', `biruniEye${eyeStatus}Short`)}
        </text>
      </g>
    </svg>
  );

  const readouts = [
    { label: t('lab', 'biruniReadAlpha'), value: t('lab', 'biruniAngleValue', { deg: alphaDeg.toFixed(3), min: (alphaDeg * 60).toFixed(1) }) },
    { label: t('lab', 'biruniReadRadius'), value: error === null ? '—' : t('lab', 'biruniKmValue', { km: formatKm(readerRadius) }) },
    { label: t('lab', 'biruniReadError'), value: error === null ? '—' : t('lab', 'biruniPercentValue', { pct: formatSignedPercent(error) }) },
    { label: t('lab', 'biruniReadHorizon'), value: t('lab', 'biruniKmValue', { km: formatDistance(horizonKm) }) },
  ];

  const facts = [
    { text: t('lab', 'biruniFactBorn'), source: SOURCES.mactutor },
    { text: t('lab', 'biruniFactResult'), source: SOURCES.mactutorIugg },
    { text: t('lab', 'biruniFactHorizon'), source: SOURCES.geometry },
    { text: t('lab', 'biruniFactHeight'), source: SOURCES.formula },
    { text: t('lab', 'biruniFactCrater'), source: SOURCES.iau },
  ];

  return (
    <Shell
      header={header}
      chip={t('lab', 'biruniViewMethod')}
      hint={t('lab', 'biruniHintMethod')}
      view={(
        <>
          {view}
          {trueScale}
        </>
      )}
    >
      <Steps items={[t('lab', 'biruniStepMethod1'), t('lab', 'biruniStepMethod2'), t('lab', 'biruniStepMethod3')]} />

      <LabPresets
        label={t('lab', 'biruniPlacesLabel')}
        presets={VIEWPOINTS.map((v) => ({
          id: v.id,
          label: t('lab', 'biruniPlaceChip', { name: t('lab', PLACE_KEYS[v.id]), m: formatKm(v.heightKm * 1000) }),
        }))}
        activeId={viewpoint?.id ?? null}
        onPick={pickViewpoint}
      />

      <RangeRow label={t('lab', 'biruniHeight')} value={t('lab', 'biruniMetresValue', { m: formatKm(heightKm * 1000) })}>
        <input
          type="range"
          min="0.1"
          max={MAX_HEIGHT_KM}
          step="0.001"
          value={heightKm}
          onChange={(e) => changeHeight(parseFloat(e.target.value))}
          className="w-full h-10 accent-cyan-400"
          aria-label={t('lab', 'biruniHeight')}
        />
      </RangeRow>

      <RangeRow
        label={t('lab', 'biruniDip')}
        value={t('lab', 'biruniAngleValue', { deg: alphaDeg.toFixed(3), min: (alphaDeg * 60).toFixed(1) })}
      >
        <input
          type="range"
          min="0"
          max={MAX_DIP_DEG}
          step="0.001"
          value={alphaDeg}
          onChange={(e) => changeAlpha(parseFloat(e.target.value))}
          className="w-full h-10 accent-cyan-400"
          aria-label={t('lab', 'biruniDip')}
        />
        <StepButtons
          label={t('lab', 'biruniFineLabel')}
          onStep={(delta) => changeAlpha(alphaDeg + delta)}
          steps={[
            [t('lab', 'biruniStepDown1'), -1 / 60],
            [t('lab', 'biruniStepDown01'), -0.1 / 60],
            [t('lab', 'biruniStepUp01'), 0.1 / 60],
            [t('lab', 'biruniStepUp1'), 1 / 60],
          ]}
        />
      </RangeRow>

      <p className={`text-xs leading-relaxed ${onHorizon ? 'text-green-300' : 'text-amber-200'}`}>
        {t('lab', `biruniEye${eyeStatus}`)}
      </p>

      <Readouts items={readouts} />
      <p className="text-xs leading-relaxed text-gray-400">
        {t('lab', 'biruniSensitivityNote', { pct: (sensitivity * 100).toFixed(1) })}
      </p>

      <CheckButton label={t('lab', 'biruniCheck')} onCheck={check} />
      <Verdict verdict={verdict} />

      <LabMissions prefix={MISSION_PREFIX} missions={observatoryMissions(t, flags)} />
      <LabExplain
        simple={t('lab', 'biruniExplainMethod')}
        formula={[t('lab', 'biruniFormulaMethod1'), t('lab', 'biruniFormulaMethod2')]}
        details={t('lab', 'biruniExplainMethodMore')}
      />
      <LabFacts facts={facts} />
      <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'biruniNoteMethod')}</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------------ */
/* Eratosthenes                                                              */
/* ------------------------------------------------------------------------ */

const E = { x: 240, y: 560, r: 210, exaggeration: 3 };
const STICK_CM = 100;
/** Where the shadow of the 1 m stick ends with the Sun 7.2 degrees from the zenith: 12.63 cm. */
const TRUE_SHADOW_CM = shadowLength(STICK_CM, ERATOSTHENES_ANGLE_DEG);
/** The Sun is half a degree wide, so the tip of the shadow is a blur this long. */
const PENUMBRA = {
  from: shadowLength(STICK_CM, ERATOSTHENES_ANGLE_DEG - SUN_ANGULAR_DIAMETER_DEG / 2),
  to: shadowLength(STICK_CM, ERATOSTHENES_ANGLE_DEG + SUN_ANGULAR_DIAMETER_DEG / 2),
};
const MAX_SHADOW_CM = 25;
/** A reading inside the blurry edge counts as a good shadow: half its width either way. */
const SHADOW_SLACK_CM = (PENUMBRA.to - PENUMBRA.from) / 2;
/** The stick at true scale in the inset: 100 cm = 230 units. */
const STICK = { x: 560, ground: 455, px: 230 };
const RULER = { x0: 482, x1: 776, y0: 520, y1: 664, cx: 629, pxPerCm: 42 };

const STADION_PRESETS = [
  { id: 'egyptian', metres: STADION_M.egyptian, key: 'biruniStadionEgyptian' },
  { id: 'attic', metres: STADION_M.attic, key: 'biruniStadionAttic' },
];

function EratosthenesTab({ header }) {
  const { t } = useTranslation();
  const [shadowCm, setShadowCm] = useState(0);
  const [distanceKm, setDistanceKm] = useState(stadiaToKm(SYENE_ALEXANDRIA_STADIA, STADION_M.egyptian));
  const [verdict, setVerdict] = useState(null);

  const angle = shadowCm > 0 ? shadowAngleDeg(shadowCm, STICK_CM) : null;
  const result = angle ? eratosthenes(angle, distanceKm) : null;
  const error = result ? relativeError(result.circumferenceKm, EARTH_MEAN_CIRCUMFERENCE_KM) : null;
  const stadion = STADION_PRESETS.find((p) => Math.abs(stadiaToKm(SYENE_ALEXANDRIA_STADIA, p.metres) - distanceKm) < 1e-9) ?? null;

  const changeShadow = (next) => {
    setShadowCm(clamp(Math.round(next * 100) / 100, 0, MAX_SHADOW_CM));
    setVerdict(null);
  };
  const changeDistance = (next) => {
    setDistanceKm(next);
    setVerdict(null);
  };

  // Off by more than 5 %: blame the shadow if it was read outside its blurry
  // edge, otherwise the distance — and say which way each one pushes the Earth.
  const check = () => {
    if (!result) {
      setVerdict({ ok: false, text: t('lab', 'biruniEraNeedShadow') });
      return;
    }
    const ok = Math.abs(error) <= CIRCUMFERENCE_TOLERANCE;
    const vars = { km: formatKm(result.circumferenceKm), pct: formatSignedPercent(error) };
    const shadowOff = shadowCm - TRUE_SHADOW_CM;
    let key = 'biruniEraOk';
    if (!ok && Math.abs(shadowOff) > SHADOW_SLACK_CM) key = shadowOff < 0 ? 'biruniEraOffShort' : 'biruniEraOffLong';
    else if (!ok) key = error > 0 ? 'biruniEraOffFar' : 'biruniEraOffNear';
    setVerdict({ ok, text: t('lab', key, vars) });
  };

  // The Earth drawing: the true angle, enlarged three times, and labelled
  // theta rather than 7.2 — the number is what the reader is measuring.
  const theta = ERATOSTHENES_ANGLE_DEG * E.exaggeration * DEG;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const A = { x: E.x - E.r * sin, y: E.y - E.r * cos };
  const G = { x: E.x - (E.r + 60) * sin, y: E.y - (E.r + 60) * cos };
  const shadowTipEarth = { x: G.x, y: E.y - Math.sqrt(E.r * E.r - (G.x - E.x) ** 2) };
  const syene = { x: E.x, y: E.y - E.r };
  const arcR = E.r + 26;
  const half = theta / 2;
  const surfaceAt = (x) => (Math.abs(x - E.x) < E.r ? E.y - Math.sqrt(E.r * E.r - (x - E.x) ** 2) : VIEW_H);

  // The inset: the Alexandria stick and its shadow at true scale.
  const top = { x: STICK.x, y: STICK.ground - STICK.px };
  const tipX = STICK.x + (TRUE_SHADOW_CM / STICK_CM) * STICK.px;
  const rayDir = { x: Math.sin(ERATOSTHENES_ANGLE_DEG * DEG), y: Math.cos(ERATOSTHENES_ANGLE_DEG * DEG) };
  const rulerX = (cm) => RULER.cx + (cm - shadowCm) * RULER.pxPerCm;
  const rulerTicks = [];
  for (let mm = Math.max(0, Math.ceil((shadowCm - 3.6) * 10)); mm <= (shadowCm + 3.6) * 10; mm += 1) rulerTicks.push(mm);

  const view = (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
      role="img"
      aria-label={t('lab', 'biruniViewEratosthenesLabel')}
    >
      <defs>
        <radialGradient id="biruni-era-earth" cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="0.7" stopColor="#1e3a8a" />
          <stop offset="1" stopColor="#172554" />
        </radialGradient>
        <marker id="biruni-ray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#fbbf24" />
        </marker>
        <linearGradient id="biruni-penumbra" x1="0" x2="1">
          <stop offset="0" stopColor="#0b0a1a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0b0a1a" stopOpacity="0" />
        </linearGradient>
        <clipPath id="biruni-ruler-clip">
          <rect x={RULER.x0 + 8} y={RULER.y0 + 28} width={RULER.x1 - RULER.x0 - 16} height="84" />
        </clipPath>
      </defs>

      <SkyStars />
      <circle cx="90" cy="96" r="26" fill="#fde68a" />
      <circle cx="90" cy="96" r="40" fill="#fbbf24" fillOpacity="0.18" />
      <text x="128" y="102" className="fill-amber-300" fontSize="15">
        {t('lab', 'biruniSunRays')}
      </text>
      {[60, G.x, E.x, 330, 400].map((x) => (
        <line
          key={x}
          x1={x}
          y1={150}
          x2={x}
          y2={surfaceAt(x) - 4}
          stroke="#fbbf24"
          strokeOpacity={x === G.x || x === E.x ? 0.85 : 0.3}
          strokeWidth={x === G.x || x === E.x ? 2 : 1.2}
          markerEnd="url(#biruni-ray)"
        />
      ))}

      <circle cx={E.x} cy={E.y} r={E.r} fill="url(#biruni-era-earth)" stroke="#60a5fa" strokeOpacity="0.5" />
      <line x1={E.x} y1={E.y} x2={syene.x} y2={syene.y} stroke="#c4b5fd" strokeDasharray="6 5" />
      <line x1={E.x} y1={E.y} x2={A.x} y2={A.y} stroke="#c4b5fd" strokeDasharray="6 5" />
      <path d={`M${E.x} ${E.y - 60} A60 60 0 0 0 ${E.x - 60 * sin} ${E.y - 60 * cos}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
      <text x={E.x - 76 * Math.sin(half) - 4} y={E.y - 76 * Math.cos(half)} textAnchor="end" className="fill-amber-300" fontSize="20" fontWeight="700">
        {t('lab', 'biruniLabelTheta')}
      </text>

      <line x1={syene.x} y1={syene.y} x2={syene.x} y2={syene.y - 60} stroke="#ffffff" strokeWidth="3" />
      <text x={syene.x + 10} y={syene.y - 40} className="fill-white" fontSize="16" fontWeight="700">
        {t('lab', 'biruniSyene')}
      </text>
      <text x={syene.x + 10} y={syene.y - 20} className="fill-gray-400" fontSize="14">
        {t('lab', 'biruniNoShadow')}
      </text>

      <line x1={A.x} y1={A.y} x2={G.x} y2={G.y} stroke="#ffffff" strokeWidth="3" />
      <line x1={A.x} y1={A.y} x2={shadowTipEarth.x} y2={shadowTipEarth.y} stroke="#000000" strokeWidth="6" strokeLinecap="round" />
      <path d={`M${G.x} ${G.y + 36} A36 36 0 0 0 ${G.x + 36 * sin} ${G.y + 36 * cos}`} fill="none" stroke="#fbbf24" strokeWidth="2" />
      <text x={G.x - 12} y={G.y - 8} textAnchor="end" className="fill-white" fontSize="16" fontWeight="700">
        {t('lab', 'biruniAlexandria')}
      </text>

      <path
        d={`M${E.x - arcR * sin} ${E.y - arcR * cos} A${arcR} ${arcR} 0 0 1 ${E.x} ${E.y - arcR}`}
        fill="none"
        stroke="#67e8f9"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <text x={E.x + 18} y={E.y - arcR - 52} className="fill-cyan-300 font-mono" fontSize="15" fontWeight="700">
        {t('lab', 'biruniKmValue', { km: formatStadiaKm(distanceKm) })}
      </text>

      {/* The inset: Alexandria at noon, the stick and its shadow to scale. */}
      <rect x="470" y="150" width="314" height="530" rx="18" fill="#030208" fillOpacity="0.7" stroke="#ffffff" strokeOpacity="0.1" />
      <text x="488" y="180" className="fill-gray-300" fontSize="15" fontWeight="700">
        {t('lab', 'biruniInsetTitle')}
      </text>
      {[-70, -35, 0].map((dx) => (
        <line
          key={dx}
          x1={top.x + dx - rayDir.x * 40}
          y1={top.y - rayDir.y * 40}
          x2={top.x + dx + rayDir.x * (STICK.px + 2)}
          y2={STICK.ground + (dx === 0 ? 0 : -2)}
          stroke="#fbbf24"
          strokeOpacity={dx === 0 ? 0.85 : 0.3}
          strokeWidth={dx === 0 ? 1.8 : 1}
        />
      ))}
      <line x1="488" y1={STICK.ground} x2="768" y2={STICK.ground} stroke="#a16207" strokeWidth="2" />
      <line x1={STICK.x} y1={STICK.ground} x2={tipX} y2={STICK.ground} stroke="#000000" strokeWidth="7" strokeLinecap="round" />
      <line x1={top.x} y1={top.y} x2={STICK.x} y2={STICK.ground} stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
      <text x={STICK.x - 12} y={(top.y + STICK.ground) / 2} textAnchor="end" className="fill-white" fontSize="15">
        {t('lab', 'biruniStickLabel')}
      </text>
      <path
        d={`M${top.x} ${top.y + 40} A40 40 0 0 0 ${top.x + 40 * rayDir.x} ${top.y + 40 * rayDir.y}`}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
      />
      <text x={top.x + 22} y={top.y + 62} className="fill-amber-300" fontSize="16" fontWeight="700">
        {t('lab', 'biruniLabelTheta')}
      </text>
      <text x={(STICK.x + tipX) / 2} y={STICK.ground + 26} textAnchor="middle" className="fill-gray-400" fontSize="14">
        {t('lab', 'biruniShadowWord')}
      </text>

      <rect x={RULER.x0} y={RULER.y0} width={RULER.x1 - RULER.x0} height={RULER.y1 - RULER.y0} rx="14" fill="#0f172a" stroke="#ffffff" strokeOpacity="0.12" />
      <text x={RULER.x0 + 14} y={RULER.y0 + 20} className="fill-gray-300" fontSize="13">
        {t('lab', 'biruniRulerTitle')}
      </text>
      <g clipPath="url(#biruni-ruler-clip)">
        <rect x={RULER.x0} y={RULER.y0 + 28} width={RULER.x1 - RULER.x0} height="84" fill="#fef3c7" fillOpacity="0.9" />
        <rect
          x={rulerX(0)}
          y={RULER.y0 + 28}
          width={Math.max(0, rulerX(PENUMBRA.from) - rulerX(0))}
          height="84"
          fill="#0b0a1a"
          fillOpacity="0.95"
        />
        <rect
          x={rulerX(PENUMBRA.from)}
          y={RULER.y0 + 28}
          width={rulerX(PENUMBRA.to) - rulerX(PENUMBRA.from)}
          height="84"
          fill="url(#biruni-penumbra)"
        />
        {rulerTicks.map((mm) => {
          const cm = mm / 10;
          const x = rulerX(cm);
          const major = mm % 10 === 0;
          const middle = mm % 5 === 0;
          return (
            <g key={mm}>
              <line x1={x} x2={x} y1={RULER.y0 + 28} y2={RULER.y0 + 28 + (major ? 26 : middle ? 17 : 10)} stroke="#a16207" strokeWidth={major ? 1.6 : 1} />
              {major ? (
                <text x={x} y={RULER.y0 + 74} textAnchor="middle" className="fill-amber-900 font-mono" fontSize="14" fontWeight="700">
                  {cm}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={RULER.cx} x2={RULER.cx} y1={RULER.y0 + 28} y2={RULER.y0 + 112} stroke="#0891b2" strokeWidth="3" />
      </g>
    </svg>
  );

  const facts = [
    { text: t('lab', 'biruniFactEratosthenes'), source: SOURCES.britannica },
    { text: t('lab', 'biruniFactSyene'), source: SOURCES.britannica },
    { text: t('lab', 'biruniFactCleomedes'), source: SOURCES.cleomedes },
    { text: t('lab', 'biruniFactStadion'), source: SOURCES.stadion },
    { text: t('lab', 'biruniFactParallel'), source: SOURCES.au },
  ];

  return (
    <Shell header={header} chip={t('lab', 'biruniViewEratosthenes')} hint={t('lab', 'biruniHintEratosthenes')} view={view}>
      <Steps items={[t('lab', 'biruniStepEra1'), t('lab', 'biruniStepEra2'), t('lab', 'biruniStepEra3')]} />

      <RangeRow label={t('lab', 'biruniShadowReading')} value={t('lab', 'biruniCmValue', { cm: shadowCm.toFixed(2) })}>
        <input
          type="range"
          min="0"
          max={MAX_SHADOW_CM}
          step="0.01"
          value={shadowCm}
          onChange={(e) => changeShadow(parseFloat(e.target.value))}
          className="w-full h-10 accent-cyan-400"
          aria-label={t('lab', 'biruniShadowReading')}
        />
        <StepButtons
          label={t('lab', 'biruniFineLabel')}
          onStep={(delta) => changeShadow(shadowCm + delta)}
          steps={[
            [t('lab', 'biruniStepDownCm'), -1],
            [t('lab', 'biruniStepDownMm'), -0.1],
            [t('lab', 'biruniStepUpMm'), 0.1],
            [t('lab', 'biruniStepUpCm'), 1],
          ]}
        />
      </RangeRow>
      <p className="text-xs leading-relaxed text-gray-400">{t('lab', 'biruniRulerHint')}</p>

      <LabPresets
        label={t('lab', 'biruniStadionLabel')}
        presets={STADION_PRESETS.map((p) => ({ id: p.id, label: t('lab', p.key) }))}
        activeId={stadion?.id ?? null}
        onPick={(id) => {
          const preset = STADION_PRESETS.find((p) => p.id === id);
          if (preset) changeDistance(stadiaToKm(SYENE_ALEXANDRIA_STADIA, preset.metres));
        }}
      />
      <RangeRow label={t('lab', 'biruniDistance')} value={t('lab', 'biruniKmValue', { km: formatStadiaKm(distanceKm) })}>
        <input
          type="range"
          min="600"
          max="1000"
          step="0.5"
          value={distanceKm}
          onChange={(e) => changeDistance(parseFloat(e.target.value))}
          className="w-full h-10 accent-cyan-400"
          aria-label={t('lab', 'biruniDistance')}
        />
      </RangeRow>

      <Readouts
        items={[
          { label: t('lab', 'biruniReadTheta'), value: angle ? t('lab', 'biruniDegValue', { deg: angle.toFixed(2) }) : '—' },
          { label: t('lab', 'biruniFraction'), value: angle ? t('lab', 'biruniFractionValue', { n: (360 / angle).toFixed(1) }) : '—' },
          { label: t('lab', 'biruniCircumference'), value: result ? t('lab', 'biruniKmValue', { km: formatKm(result.circumferenceKm) }) : '—' },
          { label: t('lab', 'biruniRadius'), value: result ? t('lab', 'biruniKmValue', { km: formatKm(result.radiusKm) }) : '—' },
          { label: t('lab', 'biruniReadError'), value: error === null ? '—' : t('lab', 'biruniPercentValue', { pct: formatSignedPercent(error) }) },
          { label: t('lab', 'biruniReadToday'), value: t('lab', 'biruniKmValue', { km: formatKm(EARTH_MEAN_CIRCUMFERENCE_KM) }) },
        ]}
      />

      <CheckButton label={t('lab', 'biruniCheck')} onCheck={check} />
      <Verdict verdict={verdict} />

      <LabMissions prefix={MISSION_PREFIX} missions={observatoryMissions(t, { circumference: verdict?.ok })} />
      <LabExplain
        simple={t('lab', 'biruniExplainEra')}
        formula={[t('lab', 'biruniFormulaEra1'), t('lab', 'biruniFormulaEra2'), t('lab', 'biruniFormulaEra3')]}
        details={t('lab', 'biruniExplainEraMore')}
      />
      <LabFacts facts={facts} />
      <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'biruniNoteEratosthenes')}</p>
    </Shell>
  );
}

/* ------------------------------------------------------------------------ */
/* Ulugh Beg's meridian arc                                                  */
/* ------------------------------------------------------------------------ */

const SEXTANT_OFF_KEYS = {
  summer: { low: 'biruniSextantOffSummerLow', high: 'biruniSextantOffSummerHigh' },
  winter: { low: 'biruniSextantOffWinterLow', high: 'biruniSextantOffWinterHigh' },
};

/** The aperture sits low enough that a high summer Sun is still drawn inside the frame. */
const ARC = { cx: 150, cy: 150, r: 480 };
const SUN_TOP_Y = 72;
const LOUPE = { x0: 430, x1: 784, y0: 580, y1: 742, cx: 607, pxPerDeg: 100 };

function onArc(altitudeDeg, radius) {
  return { x: ARC.cx + radius * Math.cos(altitudeDeg * DEG), y: ARC.cy + radius * Math.sin(altitudeDeg * DEG) };
}

function SextantTab({ header }) {
  const { t } = useTranslation();
  const [cityId, setCityId] = useState(HOME_CITY);
  const [season, setSeason] = useState('summer');
  const [pointer, setPointer] = useState(50);
  const [readings, setReadings] = useState({ summer: null, winter: null });
  const [verdict, setVerdict] = useState(null);

  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  const cityName = t('lab', CITY_KEYS[city.id]);
  const truth = solsticeAltitudes(city.latitudeDeg, OBLIQUITY_DEG);
  const sunAlt = truth[season];
  const derived = readings.summer !== null && readings.winter !== null
    ? fromSolsticeAltitudes(readings.summer, readings.winter)
    : null;

  const movePointer = (next) => setPointer(clamp(Math.round(next * 100) / 100, 0, 90));
  const pickCity = (id) => {
    setCityId(id);
    setReadings({ summer: null, winter: null });
    setVerdict(null);
  };
  const record = () => {
    setReadings((r) => ({ ...r, [season]: pointer }));
    setVerdict(null);
  };
  const check = () => {
    if (!derived) {
      setVerdict({ ok: false, text: t('lab', 'biruniSextantNeedBoth') });
      return;
    }
    const vars = { tilt: derived.tiltDeg.toFixed(2), lat: derived.latitudeDeg.toFixed(2), city: cityName };
    const ok =
      Math.abs(derived.tiltDeg - OBLIQUITY_DEG) <= SEXTANT_TOLERANCE_DEG &&
      Math.abs(derived.latitudeDeg - city.latitudeDeg) <= SEXTANT_TOLERANCE_DEG;
    if (ok) {
      setVerdict({ ok, city: city.id, text: t('lab', 'biruniSextantOk', vars) });
      return;
    }
    // Name the reading that is further off, and which way to move it.
    const offSummer = readings.summer - truth.summer;
    const offWinter = readings.winter - truth.winter;
    const which = Math.abs(offSummer) >= Math.abs(offWinter) ? 'summer' : 'winter';
    const off = which === 'summer' ? offSummer : offWinter;
    setVerdict({ ok, city: city.id, text: t('lab', SEXTANT_OFF_KEYS[which][off < 0 ? 'low' : 'high'], vars) });
  };

  const flags = {
    tilt: verdict?.ok && verdict.city === HOME_CITY,
    city: verdict?.ok && verdict.city !== HOME_CITY,
  };

  const spot = onArc(sunAlt, ARC.r - 2);
  // Along the same ray, but never above the top of the frame.
  const sunDistance = Math.min(150, (ARC.cy - SUN_TOP_Y) / Math.sin(sunAlt * DEG));
  const sun = { x: ARC.cx - sunDistance * Math.cos(sunAlt * DEG), y: ARC.cy - sunDistance * Math.sin(sunAlt * DEG) };
  const pIn = onArc(pointer, ARC.r - 34);
  const pOut = onArc(pointer, ARC.r + 4);
  const ticks = [];
  for (let a = 0; a <= 90; a += 5) ticks.push(a);
  const loupeTicks = [];
  for (let v = Math.ceil((pointer - 1.8) * 10); v <= (pointer + 1.8) * 10; v += 1) loupeTicks.push(v / 10);
  const loupeX = (alt) => LOUPE.cx + (alt - pointer) * LOUPE.pxPerDeg;
  const sunHalf = (SUN_ANGULAR_DIAMETER_DEG / 2) * LOUPE.pxPerDeg;

  const view = (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-x-0 top-0 w-full h-[calc(100%-2.75rem)]"
      role="img"
      aria-label={t('lab', 'biruniViewSextantLabel')}
    >
      <defs>
        <linearGradient id="biruni-sunband" x1="0" x2="1">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fde68a" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#fffbea" stopOpacity="1" />
          <stop offset="0.75" stopColor="#fde68a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="biruni-spot">
          <stop offset="0" stopColor="#fffbea" />
          <stop offset="0.5" stopColor="#fde68a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <clipPath id="biruni-loupe-clip">
          <rect x={LOUPE.x0 + 10} y={LOUPE.y0 + 30} width={LOUPE.x1 - LOUPE.x0 - 20} height="80" />
        </clipPath>
      </defs>

      <text x={VIEW_W - 24} y="48" textAnchor="end" className="fill-amber-200" fontSize="17" fontWeight="700">
        {t('lab', 'biruniCityAt', { city: cityName })}
      </text>
      <line x1="20" y1={ARC.cy} x2={VIEW_W - 20} y2={ARC.cy} stroke="#ffffff" strokeOpacity="0.15" strokeDasharray="4 6" />
      <text x="24" y={ARC.cy - 12} className="fill-gray-400" fontSize="15">{t('lab', 'biruniSouth')}</text>
      <text x={VIEW_W - 24} y={ARC.cy - 12} textAnchor="end" className="fill-gray-400" fontSize="15">{t('lab', 'biruniNorth')}</text>

      <path
        d={`M${ARC.cx} ${ARC.cy + ARC.r} A${ARC.r} ${ARC.r} 0 0 0 ${ARC.cx + ARC.r} ${ARC.cy} L${ARC.cx + ARC.r - 30} ${ARC.cy} A${ARC.r - 30} ${ARC.r - 30} 0 0 1 ${ARC.cx} ${ARC.cy + ARC.r - 30} Z`}
        fill="#fbbf24"
        fillOpacity="0.08"
        stroke="#fcd34d"
        strokeOpacity="0.5"
      />
      {ticks.map((a) => {
        const outer = onArc(a, ARC.r);
        const inner = onArc(a, ARC.r - (a % 10 === 0 ? 20 : 11));
        const label = onArc(a, ARC.r + 26);
        return (
          <g key={a}>
            <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="#fcd34d" strokeOpacity="0.8" />
            {a % 10 === 0 ? (
              <text x={label.x} y={label.y + 5} textAnchor="middle" className="fill-gray-400" fontSize="14">
                {t('lab', 'biruniDegValue', { deg: a })}
              </text>
            ) : null}
          </g>
        );
      })}

      <line x1={sun.x} y1={sun.y} x2={spot.x} y2={spot.y} stroke="#fbbf24" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="8 6" />
      <circle cx={sun.x} cy={sun.y} r="22" fill="#fde68a" />
      <circle cx={sun.x} cy={sun.y} r="34" fill="#fbbf24" fillOpacity="0.2" />
      <circle cx={ARC.cx} cy={ARC.cy} r="7" fill="#030208" stroke="#fcd34d" strokeWidth="2" />
      <text x={ARC.cx + 14} y={ARC.cy + 26} className="fill-gray-300" fontSize="15">{t('lab', 'biruniAperture')}</text>
      <circle cx={spot.x} cy={spot.y} r="14" fill="url(#biruni-spot)" />

      <line x1={pIn.x} y1={pIn.y} x2={pOut.x} y2={pOut.y} stroke="#22d3ee" strokeWidth="3" />
      <circle cx={pIn.x} cy={pIn.y} r="6" fill="#22d3ee" />

      <rect x={LOUPE.x0} y={LOUPE.y0} width={LOUPE.x1 - LOUPE.x0} height={LOUPE.y1 - LOUPE.y0} rx="16" fill="#030208" fillOpacity="0.85" stroke="#ffffff" strokeOpacity="0.12" />
      <text x={LOUPE.x0 + 16} y={LOUPE.y0 + 22} className="fill-gray-300" fontSize="14">{t('lab', 'biruniLoupe')}</text>
      <g clipPath="url(#biruni-loupe-clip)">
        <rect x={loupeX(sunAlt) - sunHalf} y={LOUPE.y0 + 30} width={sunHalf * 2} height="80" fill="url(#biruni-sunband)" />
        {loupeTicks.map((v) => {
          const major = Math.abs(v * 2 - Math.round(v * 2)) < 1e-6;
          const x = loupeX(v);
          return (
            <g key={v}>
              <line x1={x} x2={x} y1={LOUPE.y0 + 30} y2={LOUPE.y0 + 30 + (major ? 26 : 13)} stroke="#fcd34d" strokeOpacity="0.85" />
              {major ? (
                <text x={x} y={LOUPE.y0 + 76} textAnchor="middle" className="fill-gray-300 font-mono" fontSize="14">
                  {v.toFixed(1)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={LOUPE.cx} x2={LOUPE.cx} y1={LOUPE.y0 + 30} y2={LOUPE.y0 + 110} stroke="#22d3ee" strokeWidth="2.5" />
      </g>
      <text x={LOUPE.cx} y={LOUPE.y1 - 14} textAnchor="middle" className="fill-gray-400" fontSize="14">
        {t('lab', 'biruniSunWidth')}
      </text>
    </svg>
  );

  const show = (v) => (v === null ? '—' : t('lab', 'biruniDegValue', { deg: v.toFixed(2) }));
  const facts = [
    { text: t('lab', 'biruniFactUlughBeg'), source: SOURCES.britannica },
    { text: t('lab', 'biruniFactObservatory'), source: SOURCES.dsb },
    { text: t('lab', 'biruniFactVyatkin'), source: SOURCES.dsb },
    { text: t('lab', 'biruniFactCatalogue'), source: SOURCES.mactutor },
    { text: t('lab', 'biruniFactUlughBegNames'), source: SOURCES.iauMpc },
  ];

  return (
    <Shell header={header} chip={t('lab', 'biruniViewSextant')} hint={t('lab', 'biruniHintSextant')} view={view}>
      <Steps items={[t('lab', 'biruniStepSextant1'), t('lab', 'biruniStepSextant2'), t('lab', 'biruniStepSextant3')]} />

      <LabPresets
        label={t('lab', 'biruniCityLabel')}
        presets={CITIES.map((c) => ({ id: c.id, label: t('lab', CITY_KEYS[c.id]) }))}
        activeId={city.id}
        onPick={pickCity}
      />

      <div className="grid grid-cols-2 gap-2">
        {[
          ['summer', t('lab', 'biruniSummer')],
          ['winter', t('lab', 'biruniWinter')],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSeason(id)}
            aria-pressed={season === id}
            className={`min-h-[44px] py-2 rounded-lg text-xs leading-tight transition-colors ${
              season === id ? 'bg-amber-400 text-space-900 font-bold' : 'bg-space-800 text-gray-400 hover:bg-space-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <RangeRow label={t('lab', 'biruniPointer')} value={t('lab', 'biruniDegValue', { deg: pointer.toFixed(2) })}>
        <input
          type="range"
          min="0"
          max="90"
          step="0.05"
          value={pointer}
          onChange={(e) => movePointer(parseFloat(e.target.value))}
          className="w-full h-10 accent-cyan-400"
          aria-label={t('lab', 'biruniPointer')}
        />
        <StepButtons
          label={t('lab', 'biruniFineLabel')}
          onStep={(delta) => movePointer(pointer + delta)}
          steps={[
            [t('lab', 'biruniStepDownDeg'), -0.5],
            [t('lab', 'biruniStepDownFine'), -0.05],
            [t('lab', 'biruniStepUpFine'), 0.05],
            [t('lab', 'biruniStepUpDeg'), 0.5],
          ]}
        />
      </RangeRow>

      <button
        onClick={record}
        className="w-full min-h-[44px] py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/15 text-gray-100 hover:bg-white/10"
      >
        {t('lab', 'biruniRecord')}
      </button>

      <Readouts
        items={[
          { label: t('lab', 'biruniReadingSummer'), value: show(readings.summer) },
          { label: t('lab', 'biruniReadingWinter'), value: show(readings.winter) },
          { label: t('lab', 'biruniTilt'), value: derived ? show(derived.tiltDeg) : '—' },
          { label: t('lab', 'biruniLatitude'), value: derived ? show(derived.latitudeDeg) : '—' },
        ]}
      />

      <CheckButton label={t('lab', 'biruniCheck')} onCheck={check} />
      <Verdict verdict={verdict} />

      <LabMissions prefix={MISSION_PREFIX} missions={observatoryMissions(t, flags)} />
      <LabExplain
        simple={t('lab', 'biruniExplainSextant')}
        formula={[t('lab', 'biruniFormulaSextant1'), t('lab', 'biruniFormulaSextant2')]}
        details={t('lab', 'biruniExplainSextantMore')}
      />
      <LabFacts facts={facts} />
      <p className="text-[10px] leading-relaxed text-gray-500">{t('lab', 'biruniNoteSextant')}</p>
    </Shell>
  );
}
