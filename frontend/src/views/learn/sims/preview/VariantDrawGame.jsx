import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'motion/react';
import {
  BookOpen,
  Check,
  CircleDot,
  Clock,
  Crosshair,
  Flag,
  Footprints,
  Hand,
  Lightbulb,
  Magnet,
  MoveUpRight,
  Pause,
  Pencil,
  Play,
  Rabbit,
  Repeat,
  RotateCcw,
  Route,
  Ruler,
  Sparkles,
  Star,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Undo2,
  X,
} from 'lucide-react';
import {
  CELL,
  CHINOR,
  CLOCKS,
  H,
  HOME_ORIGIN,
  SPEEDS,
  W,
  clamp,
  cumulative,
  dist,
  flatten,
  headingAt,
  pointAt,
  snapToGrid,
  toSvgPoints,
  trailTo,
} from './VariantDrawGame.geom';
import { Axes, OriginFlag, ParkMap, Walker } from './VariantDrawGame.map';

/* ------------------------------------------------------------------------ */
/* Every user-facing string lives here so the chosen variant can be moved   */
/* into the locale files later. {L}, {d}, {x1}... are filled in at runtime. */
/* ------------------------------------------------------------------------ */
const UZ = {
  badge: "O'yin · Kinematika",
  title: "O'zing chiz!",
  subtitle:
    "Bog' xaritasida barmoq yoki sichqoncha bilan trayektoriya chizing — qahramon aynan shu chiziq bo'ylab yuradi. Yo'l, ko'chish va koordinatalarni kuzating.",
  starsLabel: 'Yulduzlar',
  allDone: 'Hamma topshiriq 3 yulduzga bajarildi!',
  levels: 'Topshiriqlar',
  level: 'Topshiriq',
  of: '{n}/6',
  starRule: '3 yulduz uchun',
  planned: 'chizilgan',
  noPath: '—',
  diff: 'farq {v} m',
  hint: 'Maslahat',
  hintHide: 'Maslahatni yopish',
  tools: {
    modeGroup: 'Rejim',
    draw: 'Chizish',
    drawTip: 'Trayektoriya chizish rejimi',
    origin: 'Sanoq jismi',
    originTip: "Bayroqni (sanoq jismini) ko'chirish rejimi",
    snap: 'Katak',
    snapTip: "Katakka yopishish: har bosish katak burchagigacha to'g'ri kesma chizadi",
    undo: 'Oxirgi chiziqni bekor qilish',
    clear: 'Trayektoriyani tozalash',
    speedGroup: 'Harakat turi',
    walk: 'Piyoda',
    run: 'Yugurish',
    clock: 'Soat',
    clockTip: "Soat tezligi: simulyatsiyada vaqt haqiqiydan necha marta tez o'tadi. Bosib almashtiring.",
    go: 'Yur!',
    goTip: "Qahramonni trayektoriya bo'ylab yurgizish",
    goDisabled: 'Avval trayektoriya chizing',
    pause: 'Pauza',
    resume: 'Davom',
    again: 'Yana yur',
  },
  hud: {
    path: "Yo'l",
    pathNote: 'faqat ortadi',
    disp: "Ko'chish",
    dispNote: "A dan to'g'ri masofa",
    dispUp: 'ortmoqda',
    dispDown: 'kamaymoqda!',
    coords: 'Koordinata',
    coordsNote: 'bayroqqa nisbatan, m',
    time: 'Vaqt',
    timeNote: 'soat ×{k} tez',
    speed: '{v} m/s',
  },
  map: {
    aria:
      "Bog' xaritasi, 1 katak 5 metr. Trayektoriya chizish uchun sichqoncha yoki barmoqdan foydalaning. Klaviatura: strelkalar kursorni suradi, Enter nuqta qo'shadi, Backspace bekor qiladi.",
    scale: '1 katak = 5 m',
    ten: '10 m',
    origin: 'Sanoq jismi',
    lake: "Ko'l",
    stadium: 'Stadion',
    chinor: 'Chinor',
    fountain: 'Favvora',
    stop: 'Bekat',
    playground: 'Maydoncha',
    street: "Ko'cha",
    xAxis: 'x, m',
    yAxis: 'y, m',
    emptyHint: 'Shu yerga trayektoriya chizing',
    emptySub: 'barmoq yoki sichqoncha bilan · nuqtalarni bosib ham chizish mumkin',
    originHint: "Bayroqni qo'yish uchun xaritani bosing",
    dispLabel: "Ko'chish {d} m",
    dispZero: "Ko'chish = 0",
    pointTitle: 'Qahramon — moddiy nuqta',
    pointText: "Bitta katak 5 m, qahramonning eni esa ≈ 0,5 m. Xarita masshtabida u deyarli nuqta!",
    pointCell: '5 m',
    pointKid: '0,5 m',
  },
  legend: {
    traj: 'Trayektoriya',
    trail: "Bosib o'tilgan yo'l",
    disp: "Ko'chish vektori",
    frame: "Sanoq sistemasi: bayroq + o'qlar + soat",
  },
  glossary: {
    title: "Lug'at",
    items: [
      ['Moddiy nuqta', "o'lchamini hisobga olmasa ham bo'ladigan jism"],
      ['Sanoq sistemasi', "sanoq jismi + koordinata o'qlari + soat"],
      ['Trayektoriya', "jism chizib o'tgan chiziq"],
      ["Yo'l", 'trayektoriya uzunligi — hech qachon kamaymaydi'],
      ["Ko'chish", "boshlang'ich nuqtadan oxirgi nuqtaga yo'nalgan vektor"],
      ['SI birliklari', 'uzunlik — metr (m), vaqt — sekund (s)'],
    ],
  },
  graph: {
    title: "Yo'l va ko'chish grafigi",
    t: 't, s',
    m: 'm',
    empty: '«Yur!» tugmasini bosing — grafik shu yerda chiziladi',
    note: "Yo'l faqat o'sadi. Ko'chish esa qaytganda kamayadi — u hech qachon yo'ldan katta bo'lmaydi.",
  },
  fb: {
    great: 'Ajoyib!',
    good: "Zo'r!",
    ok: 'Bajarildi!',
    fail: 'Hali emas…',
    stats: "Yo'l {L} m · Ko'chish {d} m",
    next: 'Keyingi topshiriq',
    retry: 'Qayta urinish',
    close: 'Yopish',
    starsAria: '{n} / 3 yulduz',
  },
  ch: {
    loop: {
      title: 'Aylanib qaytish',
      goal: "Shunday chizingki, ko'chish 0 m, yo'l esa kamida 60 m bo'lsin.",
      t1: "Ko'chish ≈ 0 m (≤ 3 m)",
      t2: "Yo'l ≥ 60 m",
      star: "ko'chish 0,5 m dan kam — aynan A nuqtaga qayting",
      hint: "A nuqtadan boshlab, aylanib yana A ga qayting. «Katak» yoqilsa, aniq qaytish oson.",
      why: "Boshlanish va oxiri bir nuqtada — ko'chish nolga teng, yo'l esa {L} m. Stadionning 400 m doirasini bir marta yugurganda ham xuddi shunday!",
      f1: "Ko'chish {d} m — A nuqtaga yaqinroq qayting (3 m dan kam).",
      f2: "Yo'l {L} m — kamida 60 m kerak.",
    },
    shortest: {
      title: "Eng qisqa yo'l",
      goal: "Ko'chish 40 m bo'lsin (±2 m), yo'l esa iloji boricha qisqa.",
      t1: "Ko'chish = 40 ± 2 m",
      t2: "Yo'l ≈ ko'chish",
      star: "yo'l ko'chishdan 2% dan ko'p uzun bo'lmasin",
      hint: "«Katak» rejimida ikki nuqtani bosing — ular orasida to'g'ri kesma chiziladi. 40 m = 8 katak.",
      why: "Yo'l {L} m ≥ ko'chish {d} m. Yo'l hech qachon ko'chishdan kichik bo'lmaydi — ular faqat to'g'ri chiziqli harakatda teng.",
      f1: "Ko'chish {d} m — 38 m dan 42 m gacha bo'lishi kerak.",
    },
    exact: {
      title: 'Aniq nishon',
      goal: "Yo'l 100 m, ko'chish esa 50 m bo'lsin (har biri ±5 m).",
      t1: "Yo'l = 100 ± 5 m",
      t2: "Ko'chish = 50 ± 5 m",
      star: 'ikkalasi ham ±1 m aniqlikda',
      hint: "Masalan: to'g'ri chiziq bo'ylab 75 m oldinga yuring, so'ng 25 m orqaga qayting.",
      why: "Yo'l — trayektoriya uzunligi ({L} m), ko'chish — boshidan oxirigacha to'g'ri masofa ({d} m). Bular turli kattaliklar!",
      f1: "Yo'l {L} m — 95…105 m bo'lishi kerak.",
      f2: "Ko'chish {d} m — 45…55 m bo'lishi kerak.",
    },
    straight: {
      title: "To'g'ri chiziq",
      goal: "Yo'l ko'chishga teng bo'lsin. Uzunligi kamida 30 m.",
      t1: "Yo'l ≥ 30 m",
      t2: "Yo'l = ko'chish (≤ 5% farq)",
      star: "deyarli ideal to'g'ri chiziq (farq 0,3% dan kam)",
      hint: "Burilmasdan, bir yo'nalishda harakatlaning. «Katak» rejimida faqat ikki nuqtani bosing.",
      why: "Jism bir yo'nalishda to'g'ri chiziq bo'ylab harakatlansa, yo'l ko'chish moduliga teng: {L} m ≈ {d} m.",
      f1: "Yo'l {L} m — kamida 30 m kerak.",
      f2: "Yo'l {L} m, ko'chish esa {d} m — chiziq egri. Burilmasdan chizing.",
    },
    frame: {
      title: 'Sanoq jismi',
      goal: "Avval yuring, so'ng sanoq jismini (bayroqni) Chinor daraxtiga ko'chiring. Nima o'zgaradi?",
      star: 'savolga birinchi urinishda to‘g‘ri javob bering',
      hint: 'Koordinatalar har doim biror sanoq jismiga nisbatan o‘lchanadi.',
      s1: "Istalgan trayektoriya chizib, yuring (kamida 20 m)",
      s2: "«Sanoq jismi» rejimida bayroqni Chinorga qo'ying",
      s3: 'Savolga javob bering',
      guide: "Endi bayroqni Chinorga ko'chiring",
      switchMode: 'Sanoq jismi rejimi',
      colWhat: 'Oxirgi nuqta',
      colOld: 'Avval',
      colNew: 'Chinordan',
      rowXY: '(x; y), m',
      rowL: "Yo'l, m",
      rowD: "Ko'chish, m",
      question: "Sanoq jismi ko'chganda nima o'zgardi?",
      options: ['Koordinatalar', "Yo'l", "Ko'chish"],
      wrong: "Yo'q — jadvalga qarang: {opt} o'zgarmadi.",
      why: "Koordinatalar sanoq jismiga bog'liq: ({x1}; {y1}) → ({x2}; {y2}). Yo'l ({L} m) va ko'chish ({d} m) esa o'zgarmadi — ular bayroq qayerdaligiga bog'liq emas.",
      short: "Yo'l {L} m — kamida 20 m yuring.",
      already: "Bayroq allaqachon Chinorda edi — uni joyiga qaytardik. Avval yuring, keyin ko'chiring.",
    },
    point: {
      title: 'Moddiy nuqta',
      goal: 'Qaysi holatda jismni moddiy nuqta deb olish mumkin?',
      star: 'birorta ham xato qilmang',
      hint: "Jismning o'lchamini u bosib o'tadigan masofa bilan solishtiring.",
      yes: 'Nuqta',
      no: 'Nuqta emas',
      right: "To'g'ri",
      wrongMark: "Noto'g'ri",
      items: [
        { q: 'Toshkentdan Samarqandga (≈300 km) ketayotgan avtobus', why: '300 km yo‘l oldida 12 m li avtobus — xaritada nuqta.' },
        { q: 'Garajga kirayotgan o‘sha avtobus', why: 'Garaj avtobusdan sal kattaroq — o‘lchamni hisobga olish shart.' },
        { q: "Bog'da 100 m yurgan qahramonimiz", why: '100 m oldida yarim metrli bola juda kichik — shuning uchun uni nuqtadek kuzatdik.' },
        { q: "Tor eshikdan o'tayotgan o'sha qahramon", why: 'Eshik eni bola eniga yaqin — endi o‘lcham muhim.' },
      ],
      why: "Jism moddiy nuqta bo'la oladimi — bu masalaga bog'liq: o'lchami masofalarga nisbatan juda kichik bo'lsa, nuqta deb olamiz.",
    },
  },
};

/* ------------------------------------------------------------------------ */

const tpl = (str, vars = {}) => str.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? `{${key}}`));

/** 12.345 -> "12,3" with a real minus sign; Uzbek uses a decimal comma. */
function fmt(v, digits = 1) {
  const r = Number(v.toFixed(digits));
  if (r === 0) return (0).toFixed(digits).replace('.', ',');
  return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(digits).replace('.', ',')}`;
}

const ratioOf = (L, d) => (d > 0.01 ? L / d : Infinity);

const QUIZ_ANSWERS = [true, false, true, false];

/** Challenges: the rules are code, the words are in UZ.ch[id]. */
const CHALLENGES = [
  {
    id: 'loop',
    icon: Repeat,
    kind: 'path',
    targets: [
      { key: 't1', show: 'd', ok: (L, d) => d <= 3 },
      { key: 't2', show: 'L', ok: (L) => L >= 60 },
    ],
    check: (L, d) => ({
      fails: [d > 3 && 'f1', L < 60 && 'f2'].filter(Boolean),
      stars: d <= 0.5 ? 3 : d <= 1.5 ? 2 : 1,
    }),
  },
  {
    id: 'shortest',
    icon: Target,
    kind: 'path',
    targets: [
      { key: 't1', show: 'd', ok: (L, d) => Math.abs(d - 40) <= 2 },
      { key: 't2', show: 'diff', ok: (L, d) => ratioOf(L, d) <= 1.02, soft: true },
    ],
    check: (L, d) => {
      const r = ratioOf(L, d);
      return { fails: [Math.abs(d - 40) > 2 && 'f1'].filter(Boolean), stars: r <= 1.02 ? 3 : r <= 1.15 ? 2 : 1 };
    },
  },
  {
    id: 'exact',
    icon: Crosshair,
    kind: 'path',
    targets: [
      { key: 't1', show: 'L', ok: (L) => Math.abs(L - 100) <= 5 },
      { key: 't2', show: 'd', ok: (L, d) => Math.abs(d - 50) <= 5 },
    ],
    check: (L, d) => {
      const e = Math.max(Math.abs(L - 100), Math.abs(d - 50));
      return {
        fails: [Math.abs(L - 100) > 5 && 'f1', Math.abs(d - 50) > 5 && 'f2'].filter(Boolean),
        stars: e <= 1 ? 3 : e <= 2.5 ? 2 : 1,
      };
    },
  },
  {
    id: 'straight',
    icon: Ruler,
    kind: 'path',
    targets: [
      { key: 't1', show: 'L', ok: (L) => L >= 30 },
      { key: 't2', show: 'diff', ok: (L, d) => ratioOf(L, d) <= 1.05 },
    ],
    check: (L, d) => {
      const r = ratioOf(L, d);
      return { fails: [L < 30 && 'f1', r > 1.05 && 'f2'].filter(Boolean), stars: r <= 1.003 ? 3 : r <= 1.02 ? 2 : 1 };
    },
  },
  { id: 'frame', icon: Flag, kind: 'frame' },
  { id: 'point', icon: CircleDot, kind: 'quiz' },
];

/* ------------------------------------------------------------------------ */
/* Small presentational pieces                                              */
/* ------------------------------------------------------------------------ */

function MiniStars({ n, size = 'size-3.5' }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={tpl(UZ.fb.starsAria, { n })}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`${size} ${i < n ? 'fill-amber-300 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.55)]' : 'text-white/20'}`}
        />
      ))}
    </span>
  );
}

function StarBurst({ n }) {
  return (
    <div className="flex items-end justify-center gap-2" aria-label={tpl(UZ.fb.starsAria, { n })}>
      {[0, 1, 2].map((i) => {
        const on = i < n;
        return (
          <Motion.span
            key={i}
            className="relative grid place-items-center"
            initial={{ scale: 0, rotate: -70, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ delay: 0.12 + i * 0.16, type: 'spring', stiffness: 380, damping: 14 }}
          >
            <Star
              aria-hidden
              className={`${i === 1 ? 'size-11' : 'size-8'} ${
                on ? 'fill-amber-300 text-amber-200 drop-shadow-[0_0_14px_rgba(252,211,77,0.75)]' : 'fill-white/5 text-white/20'
              }`}
            />
            {on &&
              [0, 1, 2, 3, 4].map((j) => {
                const a = (j / 5) * Math.PI * 2 + i;
                return (
                  <Motion.span
                    key={j}
                    aria-hidden
                    className="absolute size-1.5 rounded-full bg-amber-200"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: Math.cos(a) * 30, y: Math.sin(a) * 30, opacity: 0, scale: 0.3 }}
                    transition={{ delay: 0.3 + i * 0.16, duration: 0.7, ease: 'easeOut' }}
                  />
                );
              })}
          </Motion.span>
        );
      })}
    </div>
  );
}

const TONES = {
  cyan: { box: 'border-cyan-300/25 bg-cyan-400/[0.07]', label: 'text-cyan-200', glow: 'bg-cyan-400/20' },
  amber: { box: 'border-amber-300/25 bg-amber-300/[0.07]', label: 'text-amber-200', glow: 'bg-amber-300/20' },
  violet: { box: 'border-violet-300/25 bg-violet-400/[0.08]', label: 'text-violet-200', glow: 'bg-violet-400/20' },
  emerald: { box: 'border-emerald-300/25 bg-emerald-400/[0.07]', label: 'text-emerald-200', glow: 'bg-emerald-400/20' },
};

function Stat({ tone, icon, label, sym, note, children }) {
  const Icon = icon;
  const t = TONES[tone];
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-2xl border px-3 py-2.5 ${t.box}`}>
      <div aria-hidden className={`pointer-events-none absolute -right-6 -top-6 size-16 rounded-full blur-2xl ${t.glow}`} />
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${t.label}`}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        {sym && <span className="ml-auto font-mono text-[11px] normal-case opacity-70">{sym}</span>}
      </div>
      <div className="mt-0.5 truncate text-[19px] font-bold leading-tight tabular-nums text-white">{children}</div>
      <div className="mt-0.5 truncate text-[11px] text-gray-400">{note}</div>
    </div>
  );
}

function Unit({ children }) {
  return <span className="ml-1 text-xs font-medium text-gray-400">{children}</span>;
}

/** A pill-shaped label drawn in screen pixels inside the metre-based SVG. */
function Pill({ x, y, k, text, color, anchor = 'middle' }) {
  const w = text.length * 6.3 + 14;
  const x0 = anchor === 'start' ? 0 : -w / 2;
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / k})`} pointerEvents="none">
      <rect x={x0} y={-10} width={w} height={20} rx={10} fill="#0a0913" fillOpacity={0.88} stroke={color} strokeOpacity={0.55} />
      <text
        x={x0 + w / 2}
        y={4}
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        fill={color}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    </g>
  );
}

function EndRing({ p, k, letter, color, dark, side }) {
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${1 / k})`} pointerEvents="none">
      <circle r={12.5} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={2.4} />
      <g transform={`translate(${side * 13} -13)`}>
        <circle r={8} fill={color} stroke="#fff" strokeWidth={1.6} />
        <text y={3.8} fontSize={10.5} fontWeight={800} textAnchor="middle" fill={dark}>
          {letter}
        </text>
      </g>
    </g>
  );
}

/** Displacement vector from the start A to the walker, stopping short so the head is not hidden. */
function DispArrow({ a, b, k, label }) {
  const len = dist(a, b);
  if (len < 0.8) return null;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const back = Math.min(len * 0.45, 12 / k);
  const tip = { x: b.x - ux * back, y: b.y - uy * back };
  const hl = Math.min(11 / k, len * 0.45);
  const hw = 6 / k;
  const base = { x: tip.x - ux * hl, y: tip.y - uy * hl };
  const head = `${tip.x},${tip.y} ${base.x - uy * hw},${base.y + ux * hw} ${base.x + uy * hw},${base.y - ux * hw}`;
  const mid = { x: (a.x + tip.x) / 2, y: (a.y + tip.y) / 2 };
  // push the label to the side of the arrow that has more room on the map
  const off = 15 / k;
  const side = mid.y - ux * off < 6 ? -1 : 1;
  const lx = clamp(mid.x + uy * off * side, 12, W - 12);
  const ly = clamp(mid.y - ux * off * side, 5, H - 4);
  const showLabel = len * k > 70;
  return (
    <g pointerEvents="none">
      <line x1={a.x} y1={a.y} x2={base.x} y2={base.y} stroke="#0a0913" strokeOpacity={0.55} strokeWidth={6.5 / k} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={base.x} y2={base.y} stroke="#fbbf24" strokeWidth={3 / k} strokeLinecap="round" />
      <polygon points={head} fill="#fbbf24" stroke="#0a0913" strokeOpacity={0.4} strokeWidth={1 / k} />
      {showLabel && <Pill x={lx} y={ly} k={k} text={label} color="#fcd34d" />}
    </g>
  );
}

function niceCeil(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Path s(t) and displacement |Δr|(t), revealed as the walker goes. */
function Graph({ samples, total, sNow, dNow, speed, started }) {
  const VW = 320;
  const VH = 156;
  const P = { l: 34, r: 12, t: 12, b: 28 };
  const has = samples && total >= 1;
  const tMax = has ? total / speed : 10;
  const yMax = has ? niceCeil(total) : 50;
  const sx = (t) => P.l + (t / tMax) * (VW - P.l - P.r);
  const sy = (v) => VH - P.b - (v / yMax) * (VH - P.t - P.b);
  let shown = [];
  if (has && started) {
    shown = samples.filter((q) => q.s < sNow);
    shown.push({ s: sNow, d: dNow });
  }
  const line = (key) => shown.map((q, i) => `${i ? 'L' : 'M'} ${sx(q.s / speed).toFixed(1)} ${sy(q[key]).toFixed(1)}`).join(' ');
  const last = shown[shown.length - 1];
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" role="img" aria-label={UZ.graph.title}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={VW - P.r} y1={sy(yMax * f)} y2={sy(yMax * f)} stroke="#fff" strokeOpacity={f ? 0.07 : 0.25} />
          <text x={P.l - 6} y={sy(yMax * f) + 3.5} fontSize={10} textAnchor="end" fill="#9ca3af" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmt(yMax * f, 0)}
          </text>
        </g>
      ))}
      <line x1={P.l} x2={P.l} y1={P.t} y2={VH - P.b} stroke="#fff" strokeOpacity={0.25} />
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={sx(tMax * f)} y={VH - P.b + 14} fontSize={10} textAnchor={f === 1 ? 'end' : 'middle'} fill="#9ca3af" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmt(tMax * f, 0)}
        </text>
      ))}
      <text x={VW - P.r} y={VH - 2} fontSize={10} textAnchor="end" fill="#6b7280" fontStyle="italic">
        {UZ.graph.t}
      </text>
      <text x={4} y={P.t - 2} fontSize={10} fill="#6b7280" fontStyle="italic">
        {UZ.graph.m}
      </text>
      {shown.length > 1 ? (
        <>
          <path d={line('s')} fill="none" stroke="#22d3ee" strokeWidth={2.4} strokeLinejoin="round" />
          <path d={line('d')} fill="none" stroke="#fbbf24" strokeWidth={2.4} strokeLinejoin="round" />
          <circle cx={sx(last.s / speed)} cy={sy(last.s)} r={3.6} fill="#22d3ee" stroke="#0a0913" strokeWidth={1.5} />
          <circle cx={sx(last.s / speed)} cy={sy(last.d)} r={3.6} fill="#fbbf24" stroke="#0a0913" strokeWidth={1.5} />
        </>
      ) : (
        <text x={(P.l + VW - P.r) / 2} y={(P.t + VH - P.b) / 2 + 4} fontSize={11} textAnchor="middle" fill="#6b7280">
          {UZ.graph.empty}
        </text>
      )}
    </svg>
  );
}

function Feedback({ fb, onNext, onRetry, onClose, className = '', cardClassName = '' }) {
  const title = fb.ok ? (fb.stars === 3 ? UZ.fb.great : fb.stars === 2 ? UZ.fb.good : UZ.fb.ok) : UZ.fb.fail;
  return (
    <Motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={className}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
          fb.ok ? 'border-amber-300/40 bg-[#14101f]/90 shadow-amber-500/10' : 'border-rose-300/30 bg-[#170d16]/90 shadow-rose-500/10'
        } ${cardClassName}`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full blur-3xl ${fb.ok ? 'bg-amber-400/20' : 'bg-rose-500/15'}`}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={UZ.fb.close}
          title={UZ.fb.close}
          className="absolute right-2 top-2 grid size-10 place-items-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
        <div className="relative flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          {fb.ok ? (
            <StarBurst n={fb.stars} />
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-rose-400/15 text-rose-200">
              <Target className="size-6" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1 pr-6">
            <p className={`text-lg font-extrabold ${fb.ok ? 'text-amber-100' : 'text-rose-100'}`}>{title}</p>
            {fb.stats && <p className="text-xs font-semibold tabular-nums text-gray-400">{fb.stats}</p>}
            {fb.ok ? (
              <p className="mt-1 text-sm leading-snug text-gray-200">{fb.why}</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm leading-snug text-gray-200">
                {fb.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="relative mt-3 flex flex-wrap justify-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onRetry}
            className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-gray-200 hover:bg-white/10"
          >
            <RotateCcw className="mr-1.5 inline size-4 align-[-3px]" aria-hidden />
            {UZ.fb.retry}
          </button>
          {fb.ok && (
            <button
              type="button"
              onClick={onNext}
              className="min-h-10 rounded-xl bg-linear-to-r from-amber-300 to-orange-400 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/25 hover:brightness-110"
            >
              {UZ.fb.next} →
            </button>
          )}
        </div>
      </div>
    </Motion.div>
  );
}

function Segmented({ label, value, onChange, options, disabled, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-2xl border border-white/10 bg-white/[0.04] p-1 ${className}`}>
      {options.map((o) => {
        const Icon = o.icon;
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            title={o.title}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[13px] font-semibold transition-colors disabled:opacity-50 ${
              on ? 'text-slate-950' : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {on && (
              <Motion.span
                layoutId={`seg-${label}`}
                className={`absolute inset-0 rounded-xl ${o.activeClass ?? 'bg-cyan-300'}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <Icon className="relative size-4" aria-hidden />
            <span className="relative">{o.label}</span>
            {o.sub && <span className={`relative hidden text-[11px] font-medium sm:inline ${on ? 'text-slate-800' : 'text-gray-500'}`}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

const GLOSSARY_DOTS = ['bg-pink-400', 'bg-violet-300', 'bg-slate-100', 'bg-cyan-300', 'bg-amber-300', 'bg-emerald-300'];

const toolBtn =
  'flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border px-3 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-35';

/* ------------------------------------------------------------------------ */
/* The game                                                                 */
/* ------------------------------------------------------------------------ */

export default function VariantDrawGame() {
  /* layout: pixels per metre of the map, so labels keep a readable size */
  const mapBoxRef = useRef(null);
  const svgRef = useRef(null);
  const [mapW, setMapW] = useState(720);
  useEffect(() => {
    const el = mapBoxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMapW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = mapW / W;
  const px = (v) => v / k;

  /* game state */
  const [active, setActive] = useState(0);
  const [best, setBest] = useState({});
  const [strokes, setStrokes] = useState([]);
  const [origin, setOrigin] = useState(HOME_ORIGIN);
  const [mode, setMode] = useState('draw');
  const [snap, setSnap] = useState(false);
  const [mover, setMover] = useState('walk');
  const [clockX, setClockX] = useState(10);
  const [status, setStatus] = useState('idle'); // idle | running | paused | done
  const [s, setS] = useState(0);
  const sRef = useRef(0);
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const [fb, setFb] = useState(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [frameRec, setFrameRec] = useState(null);
  const [frameWrong, setFrameWrong] = useState([]);
  const [frameDone, setFrameDone] = useState(false);
  const [quiz, setQuiz] = useState({});
  const [kb, setKb] = useState({ x: 60, y: 40 });
  const [kbOn, setKbOn] = useState(false);

  const ch = CHALLENGES[active];
  const T = UZ.ch[ch.id];

  /* trajectory and physics */
  const pts = useMemo(() => flatten(strokes), [strokes]);
  const cum = useMemo(() => cumulative(pts), [pts]);
  const total = pts.length > 1 ? cum[cum.length - 1] : 0; // path length of the whole drawing, m
  const start = pts[0] ?? null;
  const end = pts[pts.length - 1] ?? null;
  const planD = start && end ? dist(start, end) : 0; // displacement of the whole drawing, m
  const speed = SPEEDS[mover];

  const pos = pts.length ? pointAt(pts, cum, s) : null;
  const dNow = pos ? dist(pos, start) : 0;
  const tNow = s / speed;
  const X = pos ? pos.x - origin.x : 0;
  const Y = pos ? origin.y - pos.y : 0;
  const dBefore = pos && s > 0.5 ? dist(pointAt(pts, cum, s - 0.5), start) : dNow;
  const dTrend = status === 'running' ? (dNow - dBefore > 0.02 ? 'up' : dNow - dBefore < -0.02 ? 'down' : null) : null;
  const trail = useMemo(() => (status === 'idle' ? [] : trailTo(pts, cum, s)), [pts, cum, s, status]);
  const angle = useMemo(() => headingAt(pts, cum, s), [pts, cum, s]);

  const graphSamples = useMemo(() => {
    if (pts.length < 2) return null;
    const out = [];
    const N = 160;
    for (let i = 0; i <= N; i += 1) {
      const si = (total * i) / N;
      out.push({ s: si, d: dist(pointAt(pts, cum, si), pts[0]) });
    }
    return out;
  }, [pts, cum, total]);

  const atChinor = dist(origin, CHINOR) < 0.5;
  const frameStep2 = ch.kind === 'frame' && !!frameRec && atChinor && dist(frameRec.origin, CHINOR) >= 0.5;
  const totalStars = Object.values(best).reduce((a, b) => a + b, 0);

  /* helpers that change state */
  const resetWalk = useCallback(() => {
    sRef.current = 0;
    setS(0);
    setStatus('idle');
  }, []);

  const award = useCallback((id, stars) => setBest((b) => ({ ...b, [id]: Math.max(b[id] ?? 0, stars) })), []);

  const startChallenge = (i) => {
    setActive(i);
    setStrokes([]);
    resetWalk();
    setFb(null);
    setHintOpen(false);
    setPreview(null);
    previewRef.current = null;
    dragRef.current = null;
    setOrigin(HOME_ORIGIN);
    setMode('draw');
    setFrameRec(null);
    setFrameWrong([]);
    setFrameDone(false);
    setQuiz({});
  };

  /** Any edit of the drawing sends the walker back to the start. */
  const beginEdit = () => {
    if (status !== 'idle') resetWalk();
    if (fb?.place === 'map') setFb(null);
  };

  const addPoint = (p) =>
    setStrokes((prev) => {
      const flat = flatten(prev);
      const last = flat[flat.length - 1];
      if ((last && dist(last, p) < 0.05) || flat.length > 3000) return prev;
      return [...prev, [p]];
    });

  const placeOrigin = (p) => {
    const q = dist(p, CHINOR) <= 4.5 ? { ...CHINOR } : snapToGrid(p);
    setOrigin((o) => (o.x === q.x && o.y === q.y ? o : q));
  };

  const undo = () => {
    beginEdit();
    setStrokes((prev) => prev.slice(0, -1));
  };
  const clearAll = () => {
    beginEdit();
    setStrokes([]);
    setPreview(null);
    previewRef.current = null;
  };

  const onGo = () => {
    if (status === 'running') return setStatus('paused');
    if (status === 'paused') return setStatus('running');
    if (total < 1) return undefined;
    if (fb?.place === 'map') setFb(null);
    sRef.current = 0;
    setS(0);
    setStatus('running');
    return undefined;
  };

  /* what happens when the walker reaches the end of the line */
  const finish = () => {
    setStatus('done');
    const L = total;
    const d = planD;
    const vars = { L: fmt(L), d: fmt(d) };
    if (ch.kind === 'path') {
      const { fails, stars } = ch.check(L, d);
      if (fails.length) {
        setFb({ place: 'map', ok: false, lines: fails.map((f) => tpl(T[f], vars)), stats: tpl(UZ.fb.stats, vars) });
      } else {
        award(ch.id, stars);
        setFb({ place: 'map', ok: true, stars, why: tpl(T.why, vars), stats: tpl(UZ.fb.stats, vars) });
      }
    } else if (ch.kind === 'frame') {
      if (L < 20) {
        setFb({ place: 'map', ok: false, lines: [tpl(T.short, vars)] });
      } else if (dist(origin, CHINOR) < 0.5) {
        setOrigin(HOME_ORIGIN);
        setFb({ place: 'map', ok: false, lines: [T.already] });
      } else {
        setFrameRec({ origin: { ...origin }, end: { ...end }, L, d });
        setFrameWrong([]);
        setFrameDone(false);
      }
    }
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  /* the walking loop */
  useEffect(() => {
    if (status !== 'running') return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = Math.min(total, sRef.current + speed * clockX * dt);
      sRef.current = next;
      setS(next);
      if (next >= total) {
        finishRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, total, speed, clockX]);

  /* frame-of-reference question */
  const answerFrame = (i) => {
    if (frameDone || frameWrong.includes(i)) return;
    if (i !== 0) {
      setFrameWrong((w) => [...w, i]);
      return;
    }
    const stars = Math.max(1, 3 - frameWrong.length);
    award('frame', stars);
    setFrameDone(true);
    const oldX = frameRec.end.x - frameRec.origin.x;
    const oldY = frameRec.origin.y - frameRec.end.y;
    const newX = frameRec.end.x - origin.x;
    const newY = origin.y - frameRec.end.y;
    setFb({
      place: 'card',
      ok: true,
      stars,
      why: tpl(T.why, { x1: fmt(oldX), y1: fmt(oldY), x2: fmt(newX), y2: fmt(newY), L: fmt(frameRec.L), d: fmt(frameRec.d) }),
    });
  };

  /* point-mass quiz */
  const answerQuiz = (i, val) => {
    if (quiz[i] !== undefined) return;
    const next = { ...quiz, [i]: val };
    setQuiz(next);
    if (Object.keys(next).length === QUIZ_ANSWERS.length) {
      const mistakes = QUIZ_ANSWERS.filter((a, j) => next[j] !== a).length;
      const stars = mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
      award('point', stars);
      setFb({ place: 'card', ok: true, stars, why: T.why });
    }
  };

  /* pointer drawing */
  const toWorld = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * W, 0, W),
      y: clamp(((e.clientY - r.top) / r.height) * H, 0, H),
    };
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragRef.current && dragRef.current.id !== e.pointerId) return; // a second finger while drawing
    const p = toWorld(e);
    setKbOn(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic or already-released pointers cannot be captured; drawing still works without it
    }
    if (mode === 'origin') {
      dragRef.current = { id: e.pointerId, type: 'origin' };
      placeOrigin(p);
      return;
    }
    if (status === 'running') return;
    beginEdit();
    if (snap) {
      const q = snapToGrid(p);
      setStrokes((prev) => (prev.length ? prev : [[q]]));
      dragRef.current = { id: e.pointerId, type: 'line' };
      previewRef.current = q;
      setPreview(q);
    } else {
      dragRef.current = { id: e.pointerId, type: 'free' };
      setStrokes((prev) => [...prev, [p]]);
    }
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const p = toWorld(e);
    if (drag.type === 'origin') {
      placeOrigin(p);
    } else if (drag.type === 'line') {
      const q = snapToGrid(p);
      const old = previewRef.current;
      if (!old || old.x !== q.x || old.y !== q.y) {
        previewRef.current = q;
        setPreview(q);
      }
    } else {
      const minStep = Math.max(0.3, 5 / k);
      setStrokes((prev) => {
        if (!prev.length) return prev;
        const lastStroke = prev[prev.length - 1];
        const lp = lastStroke[lastStroke.length - 1];
        if (dist(lp, p) < minStep || lastStroke.length > 2500) return prev;
        return [...prev.slice(0, -1), [...lastStroke, p]];
      });
    }
  };

  const onPointerEnd = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // the pointer was never captured (see onPointerDown)
    }
    if (drag.type === 'line') {
      const q = previewRef.current;
      previewRef.current = null;
      setPreview(null);
      if (q) addPoint(q);
    }
  };

  /* keyboard drawing: arrows move a cursor along the grid, Enter drops a point */
  const onKeyDown = (e) => {
    const moves = { ArrowLeft: [-CELL, 0], ArrowRight: [CELL, 0], ArrowUp: [0, -CELL], ArrowDown: [0, CELL] };
    if (moves[e.key]) {
      e.preventDefault();
      setKbOn(true);
      setKb((c) => ({ x: clamp(c.x + moves[e.key][0], 0, W), y: clamp(c.y + moves[e.key][1], 0, H) }));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setKbOn(true);
      if (mode === 'origin') placeOrigin(kb);
      else if (status !== 'running') {
        beginEdit();
        addPoint({ ...kb });
      }
    } else if (e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z')) {
      e.preventDefault();
      undo();
    }
  };

  /* derived view bits */
  const showWalker = !!pos && pts.length > 0;
  const walkerAtEnd = status !== 'idle' && s >= total - 0.01;
  const previewFrom = end;
  const previewLen = preview && previewFrom ? dist(previewFrom, preview) : 0;
  const kbFrom = mode === 'draw' && kbOn && end ? end : null;
  const goLabel =
    status === 'running' ? UZ.tools.pause : status === 'paused' ? UZ.tools.resume : status === 'done' ? UZ.tools.again : UZ.tools.go;
  const GoIcon = status === 'running' ? Pause : status === 'done' ? RotateCcw : Play;
  const canGo = total >= 1;
  const mapFb = fb && fb.place === 'map' ? fb : null;
  const cardFb = fb && fb.place === 'card' ? fb : null;
  const nextChallenge = () => startChallenge((active + 1) % CHALLENGES.length);

  const targetValue = (t) => {
    if (pts.length < 2) return UZ.noPath;
    if (t.show === 'L') return `${fmt(total)} m`;
    if (t.show === 'd') return `${fmt(planD)} m`;
    return tpl(UZ.diff, { v: fmt(total - planD) });
  };

  /* ---------------------------------------------------------------------- */

  const levelGrid = (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={UZ.levels}>
      {CHALLENGES.map((c, i) => {
        const Icon = c.icon;
        const st = best[c.id] ?? 0;
        const on = i === active;
        return (
          <Motion.button
            key={c.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => startChallenge(i)}
            aria-current={on ? 'step' : undefined}
            aria-label={`${UZ.level} ${i + 1}: ${UZ.ch[c.id].title}. ${tpl(UZ.fb.starsAria, { n: st })}`}
            className={`relative flex min-h-[74px] flex-col justify-between rounded-2xl border p-2.5 text-left transition-colors ${
              on
                ? 'border-cyan-300/70 bg-cyan-400/[0.12] shadow-[0_0_26px_-8px_rgba(34,211,238,0.8)]'
                : st === 3
                  ? 'border-amber-300/30 bg-amber-300/[0.06] hover:bg-amber-300/10'
                  : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.08]'
            }`}
          >
            <span className="flex w-full items-center justify-between">
              <span
                className={`grid size-6 place-items-center rounded-lg text-[11px] font-extrabold ${
                  on ? 'bg-cyan-300 text-slate-950' : 'bg-white/10 text-gray-200'
                }`}
              >
                {i + 1}
              </span>
              <Icon aria-hidden className={`size-4 ${on ? 'text-cyan-200' : 'text-gray-400'}`} />
            </span>
            <span className="mt-1.5 text-[12px] font-semibold leading-tight text-gray-100">{UZ.ch[c.id].title}</span>
            <span className="mt-1">
              <MiniStars n={st} size="size-3" />
            </span>
          </Motion.button>
        );
      })}
    </div>
  );

  const pathTask =
    ch.kind === 'path' ? (
      <ul className="mt-3 space-y-1.5">
        {ch.targets.map((t) => {
          const ok = pts.length > 1 && t.ok(total, planD);
          return (
            <li
              key={t.key}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm ${
                ok ? 'border-emerald-300/30 bg-emerald-400/[0.08]' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <span
                className={`grid size-5 shrink-0 place-items-center rounded-full ${
                  ok ? 'bg-emerald-400 text-slate-950' : t.soft ? 'border border-dashed border-white/25' : 'border border-white/25'
                }`}
              >
                {ok && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 font-medium text-gray-100">{T[t.key]}</span>
              <span className="shrink-0 text-xs tabular-nums text-gray-400">
                {UZ.planned}: <span className="font-semibold text-gray-200">{targetValue(t)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    ) : null;

  const frameTask =
    ch.kind === 'frame' ? (
      <div className="mt-3 space-y-3">
        <ol className="space-y-1.5">
          {[
            [T.s1, !!frameRec],
            [T.s2, frameStep2 || frameDone],
            [T.s3, frameDone],
          ].map(([text, done], i) => (
            <li key={text} className="flex items-start gap-2 text-sm">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  done ? 'bg-emerald-400 text-slate-950' : 'border border-white/25 text-gray-400'
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={done ? 'text-gray-400 line-through decoration-white/20' : 'text-gray-100'}>{text}</span>
            </li>
          ))}
        </ol>
        {frameRec && !frameStep2 && !frameDone && mode !== 'origin' && (
          <button
            type="button"
            onClick={() => setMode('origin')}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-400/90 px-3 text-sm font-bold text-slate-950 hover:bg-violet-300"
          >
            <Flag className="size-4" aria-hidden />
            {T.switchMode}
          </button>
        )}
        {(frameStep2 || frameDone) && frameRec && (
          <Motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-white/10 text-xs">
              <table className="w-full tabular-nums">
                <thead className="bg-white/[0.05] text-gray-400">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">{T.colWhat}</th>
                    <th className="px-2 py-1.5 text-right font-semibold">{T.colOld}</th>
                    <th className="px-2 py-1.5 text-right font-semibold">{T.colNew}</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  <tr className="bg-violet-400/[0.08]">
                    <td className="px-2 py-1.5 text-violet-200">{T.rowXY}</td>
                    <td className="px-2 py-1.5 text-right">
                      ({fmt(frameRec.end.x - frameRec.origin.x)}; {fmt(frameRec.origin.y - frameRec.end.y)})
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold text-violet-100">
                      ({fmt(frameRec.end.x - origin.x)}; {fmt(origin.y - frameRec.end.y)})
                    </td>
                  </tr>
                  <tr className="border-t border-white/5">
                    <td className="px-2 py-1.5 text-cyan-200">{T.rowL}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(frameRec.L)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(frameRec.L)}</td>
                  </tr>
                  <tr className="border-t border-white/5">
                    <td className="px-2 py-1.5 text-amber-200">{T.rowD}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(frameRec.d)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(frameRec.d)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{T.question}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {T.options.map((opt, i) => {
                  const wrong = frameWrong.includes(i);
                  const right = frameDone && i === 0;
                  return (
                    <Motion.button
                      key={opt}
                      type="button"
                      onClick={() => answerFrame(i)}
                      animate={wrong ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: 0.35 }}
                      disabled={frameDone}
                      className={`min-h-10 rounded-xl border px-2 text-[13px] font-semibold ${
                        right
                          ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                          : wrong
                            ? 'border-rose-300/40 bg-rose-400/10 text-rose-200 line-through'
                            : 'border-white/15 bg-white/[0.05] text-gray-100 hover:bg-white/10'
                      }`}
                    >
                      {opt}
                    </Motion.button>
                  );
                })}
              </div>
              {frameWrong.length > 0 && !frameDone && (
                <p className="mt-2 text-xs text-rose-200">{tpl(T.wrong, { opt: T.options[frameWrong[frameWrong.length - 1]] })}</p>
              )}
            </div>
          </Motion.div>
        )}
      </div>
    ) : null;

  const quizTask =
    ch.kind === 'quiz' ? (
      <ul className="mt-3 space-y-2">
        {T.items.map((item, i) => {
          const ans = quiz[i];
          const answered = ans !== undefined;
          const correct = answered && ans === QUIZ_ANSWERS[i];
          return (
            <li key={item.q} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-sm font-medium text-gray-100">{item.q}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[true, false].map((val) => {
                  const picked = ans === val;
                  const isRight = QUIZ_ANSWERS[i] === val;
                  return (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => answerQuiz(i, val)}
                      disabled={answered}
                      aria-pressed={picked}
                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-semibold transition-colors ${
                        answered && isRight
                          ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                          : picked
                            ? 'border-rose-300/50 bg-rose-400/15 text-rose-100'
                            : answered
                              ? 'border-white/5 bg-transparent text-gray-500'
                              : 'border-white/15 bg-white/[0.05] text-gray-100 hover:bg-white/10'
                      }`}
                    >
                      {val ? <CircleDot className="size-4" aria-hidden /> : <Hand className="size-4" aria-hidden />}
                      {val ? T.yes : T.no}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence>
                {answered && (
                  <Motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={`mt-1.5 text-xs leading-snug ${correct ? 'text-emerald-200' : 'text-rose-200'}`}
                  >
                    <span className="font-bold">{correct ? T.right : T.wrongMark}.</span> {item.why}
                  </Motion.p>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    ) : null;

  const taskCard = (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {UZ.level} {tpl(UZ.of, { n: active + 1 })}
        </p>
        <MiniStars n={best[ch.id] ?? 0} size="size-4" />
      </div>
      <AnimatePresence mode="wait">
        <Motion.div
          key={ch.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          className="relative"
        >
          <h3 className="mt-1 text-lg font-bold text-white">{T.title}</h3>
          <p className="mt-0.5 text-sm leading-snug text-gray-300">{T.goal}</p>
          {pathTask}
          {frameTask}
          {quizTask}
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-amber-200/90">
            <Sparkles className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{UZ.starRule}:</span> {T.star}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setHintOpen((v) => !v)}
            aria-expanded={hintOpen}
            className="mt-2 flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-gray-300 hover:bg-white/[0.06] hover:text-white"
          >
            <Lightbulb className={`size-4 ${hintOpen ? 'fill-amber-300/40 text-amber-300' : ''}`} aria-hidden />
            {hintOpen ? UZ.hintHide : UZ.hint}
          </button>
          <AnimatePresence>
            {hintOpen && (
              <Motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-xl bg-amber-300/[0.08] px-3 py-2 text-xs leading-snug text-amber-100"
              >
                {T.hint}
              </Motion.p>
            )}
          </AnimatePresence>
        </Motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {cardFb && (
          <Feedback
            key="card-fb"
            fb={cardFb}
            className="mt-3"
            onClose={() => setFb(null)}
            onRetry={() => startChallenge(active)}
            onNext={nextChallenge}
          />
        )}
      </AnimatePresence>
    </div>
  );

  const showFrameGuide = ch.kind === 'frame' && !!frameRec && !frameStep2 && !frameDone;

  const mapBlock = (
    <div className="relative -mx-1.5 sm:mx-0">
      <div
        ref={mapBoxRef}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1f1a] shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)]"
      >
        <svg
          ref={svgRef}
          data-testid="draw-surface"
          viewBox={`0 0 ${W} ${H}`}
          role="application"
          aria-label={UZ.map.aria}
          tabIndex={0}
          className={`absolute inset-0 h-full w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
            mode === 'origin' ? 'cursor-move' : 'cursor-crosshair'
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onKeyDown={onKeyDown}
          onBlur={() => setKbOn(false)}
        >
          <ParkMap k={k} labels={UZ.map} glowChinor={showFrameGuide} />
          <Axes origin={origin} k={k} labels={UZ.map} />
          {ch.kind === 'frame' && frameRec && dist(frameRec.origin, origin) > 0.5 && (
            <OriginFlag x={frameRec.origin.x} y={frameRec.origin.y} k={k} ghost />
          )}

          {/* the drawn trajectory: a dotted "treasure map" line */}
          {pts.length > 1 && (
            <>
              <polyline points={toSvgPoints(pts)} fill="none" stroke="#fff" strokeOpacity={0.2} strokeWidth={px(1.4)} strokeLinejoin="round" />
              <polyline
                points={toSvgPoints(pts)}
                fill="none"
                stroke="#f8fafc"
                strokeOpacity={0.92}
                strokeWidth={px(3.6)}
                strokeDasharray={`0 ${px(8)}`}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* straight-segment preview in grid mode */}
          {preview && previewFrom && previewLen > 0.01 && (
            <g pointerEvents="none">
              <line
                x1={previewFrom.x}
                y1={previewFrom.y}
                x2={preview.x}
                y2={preview.y}
                stroke="#67e8f9"
                strokeWidth={px(2.5)}
                strokeDasharray={`${px(7)} ${px(5)}`}
                strokeLinecap="round"
              />
              <circle cx={preview.x} cy={preview.y} r={px(5)} fill="#67e8f9" />
              <Pill x={(previewFrom.x + preview.x) / 2} y={(previewFrom.y + preview.y) / 2 - px(14)} k={k} text={`${fmt(previewLen)} m`} color="#a5f3fc" />
            </g>
          )}
          {kbFrom && dist(kbFrom, kb) > 0.01 && (
            <line x1={kbFrom.x} y1={kbFrom.y} x2={kb.x} y2={kb.y} stroke="#67e8f9" strokeOpacity={0.7} strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(5)}`} />
          )}

          {/* the walked part: the path length the HUD is counting */}
          {trail.length > 1 && (
            <>
              <polyline points={toSvgPoints(trail)} fill="none" stroke="#22d3ee" strokeOpacity={0.22} strokeWidth={px(11)} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={toSvgPoints(trail)} fill="none" stroke="#67e8f9" strokeWidth={px(3.8)} strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}

          {start && end && pts.length > 1 && !walkerAtEnd && <EndRing p={end} k={k} letter="B" color="#fb7185" dark="#4c0519" side={1} />}
          {start && <EndRing p={start} k={k} letter="A" color="#34d399" dark="#022c22" side={-1} />}

          {pos && start && status !== 'idle' && <DispArrow a={start} b={pos} k={k} label={tpl(UZ.map.dispLabel, { d: fmt(dNow) })} />}
          {pos && start && status === 'done' && dNow < 0.8 && total > 1 && (
            <Pill x={start.x} y={start.y + px(26)} k={k} text={UZ.map.dispZero} color="#fcd34d" />
          )}

          <OriginFlag x={origin.x} y={origin.y} k={k} clockDeg={tNow * 6} label={mapW >= 520 ? UZ.map.origin : null} />

          {showWalker && <Walker x={pos.x} y={pos.y} k={k} angle={angle} phase={(s / 0.75) * Math.PI} moving={status === 'running'} />}
          {showWalker && (
            <Pill
              x={clamp(pos.x + px(16), 0, W - px(100))}
              y={clamp(pos.y - px(24), px(12), H - px(12))}
              k={k}
              anchor="start"
              text={`(${fmt(X)}; ${fmt(Y)})`}
              color="#c4b5fd"
            />
          )}

          {kbOn && (
            <g transform={`translate(${kb.x} ${kb.y}) scale(${1 / k})`} pointerEvents="none">
              <circle r={9} fill="none" stroke="#22d3ee" strokeWidth={2} />
              <path d="M -14 0 H -5 M 5 0 H 14 M 0 -14 V -5 M 0 5 V 14" stroke="#22d3ee" strokeWidth={2} />
            </g>
          )}
        </svg>

        {/* overlays in screen space */}
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-2.5 py-1.5 text-[11px] font-semibold text-gray-200 backdrop-blur">
          <span className="flex flex-col items-center">
            <span className="block h-1.5 border-x-2 border-b-2 border-white/80" style={{ width: 10 * k }} />
            <span className="mt-0.5 leading-none">{UZ.map.ten}</span>
          </span>
          <span className="hidden text-gray-400 sm:inline">{UZ.map.scale}</span>
        </div>

        <AnimatePresence>
          {pts.length === 0 && mode === 'draw' && ch.kind === 'quiz' && (
            <Motion.div
              key="point"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="pointer-events-none absolute inset-0 grid place-items-center p-4"
            >
              <div className="flex max-w-[min(92%,30rem)] items-center gap-3 rounded-2xl border border-pink-300/30 bg-[#140a18]/85 p-3 text-left shadow-xl backdrop-blur sm:gap-4 sm:p-4">
                <svg viewBox="0 0 120 120" className="size-16 shrink-0 sm:size-24" aria-hidden>
                  <rect x="10" y="10" width="100" height="100" rx="4" fill="#0f2c25" stroke="#e2fbf3" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="6 4" />
                  <circle cx="60" cy="60" r="5" fill="#f472b6" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="60" cy="60" r="14" fill="none" stroke="#f472b6" strokeOpacity="0.5" strokeWidth="1.5" />
                  <text x="60" y="104" fontSize="13" fontWeight="700" textAnchor="middle" fill="#e2fbf3" fillOpacity="0.8">{UZ.map.pointCell}</text>
                  <text x="60" y="40" fontSize="12" fontWeight="700" textAnchor="middle" fill="#f9a8d4">{UZ.map.pointKid}</text>
                </svg>
                <span>
                  <span className="block text-sm font-bold text-white">{UZ.map.pointTitle}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-gray-300">{UZ.map.pointText}</span>
                </span>
              </div>
            </Motion.div>
          )}
          {pts.length === 0 && mode === 'draw' && ch.kind !== 'quiz' && (
            <Motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="pointer-events-none absolute inset-0 grid place-items-center p-4"
            >
              <Motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex max-w-[90%] items-center gap-3 rounded-2xl border border-cyan-300/30 bg-[#06121a]/80 px-4 py-3 text-left shadow-xl backdrop-blur"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-300 text-slate-950">
                  <Pencil className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{UZ.map.emptyHint}</span>
                  <span className="block text-xs text-gray-400">{UZ.map.emptySub}</span>
                </span>
              </Motion.div>
            </Motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(mode === 'origin' || showFrameGuide) && (
            <Motion.div
              key={showFrameGuide ? 'guide' : 'origin'}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`absolute left-2 top-2 flex max-w-[calc(100%-7.5rem)] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${
                showFrameGuide ? 'border-amber-300/40 bg-amber-950/70 text-amber-100' : 'border-violet-300/40 bg-violet-950/70 text-violet-100'
              } pointer-events-none`}
            >
              <Flag className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{showFrameGuide ? T.guide : UZ.map.originHint}</span>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {mapFb && (
          <Feedback
            key="map-fb"
            fb={mapFb}
            className="mt-3 sm:pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-4 sm:mt-0 sm:flex sm:justify-center sm:px-4"
            cardClassName="sm:pointer-events-auto sm:w-full sm:max-w-[560px]"
            onClose={() => setFb(null)}
            onRetry={() => startChallenge(active)}
            onNext={nextChallenge}
          />
        )}
      </AnimatePresence>
    </div>
  );

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label={UZ.tools.modeGroup}
        value={mode}
        onChange={(v) => {
          setMode(v);
          setKbOn(false);
        }}
        className="w-full sm:w-auto"
        options={[
          { value: 'draw', icon: Pencil, label: UZ.tools.draw, title: UZ.tools.drawTip },
          { value: 'origin', icon: Flag, label: UZ.tools.origin, title: UZ.tools.originTip, activeClass: 'bg-violet-300' },
        ]}
      />
      <button
        type="button"
        aria-pressed={snap}
        title={UZ.tools.snapTip}
        aria-label={UZ.tools.snapTip}
        onClick={() => setSnap((v) => !v)}
        className={`${toolBtn} ${snap ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]'}`}
      >
        <Magnet className="size-4" aria-hidden />
        {UZ.tools.snap}
        <span className={`ml-0.5 h-4 w-7 rounded-full p-0.5 transition-colors ${snap ? 'bg-cyan-300' : 'bg-white/15'}`} aria-hidden>
          <span className={`block size-3 rounded-full bg-white transition-transform ${snap ? 'translate-x-3' : ''}`} />
        </span>
      </button>
      <button
        type="button"
        onClick={undo}
        disabled={!strokes.length}
        aria-label={UZ.tools.undo}
        title={UZ.tools.undo}
        className={`${toolBtn} border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]`}
      >
        <Undo2 className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={clearAll}
        disabled={!strokes.length}
        aria-label={UZ.tools.clear}
        title={UZ.tools.clear}
        className={`${toolBtn} border-white/10 bg-white/[0.04] text-gray-200 hover:border-rose-300/40 hover:bg-rose-400/10 hover:text-rose-100`}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
      <span className="ml-auto hidden items-center gap-1.5 text-xs text-gray-500 md:flex">
        <Route className="size-3.5" aria-hidden />
        {UZ.legend.traj}: <span className="font-semibold tabular-nums text-gray-300">{fmt(total)} m</span>
      </span>
    </div>
  );

  const hud = (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-live="off">
      <Stat tone="cyan" icon={Route} label={UZ.hud.path} sym="s" note={`↑ ${UZ.hud.pathNote}`}>
        {fmt(s)}
        <Unit>m</Unit>
      </Stat>
      <Stat
        tone="amber"
        icon={MoveUpRight}
        label={UZ.hud.disp}
        sym="|Δr|"
        note={
          dTrend === 'down' ? (
            <span className="font-semibold text-amber-200">
              <TrendingDown className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              {UZ.hud.dispDown}
            </span>
          ) : dTrend === 'up' ? (
            <span>
              <TrendingUp className="mr-1 inline size-3.5 align-[-2px]" aria-hidden />
              {UZ.hud.dispUp}
            </span>
          ) : (
            UZ.hud.dispNote
          )
        }
      >
        {fmt(dNow)}
        <Unit>m</Unit>
      </Stat>
      <Stat tone="violet" icon={Crosshair} label={UZ.hud.coords} sym="(x; y)" note={UZ.hud.coordsNote}>
        <span className="text-[17px]">
          ({fmt(X)}; {fmt(Y)})
        </span>
      </Stat>
      <Stat tone="emerald" icon={Timer} label={UZ.hud.time} sym="t" note={tpl(UZ.hud.timeNote, { k: clockX })}>
        {fmt(tNow)}
        <Unit>s</Unit>
      </Stat>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        label={UZ.tools.speedGroup}
        value={mover}
        onChange={setMover}
        disabled={status === 'running' || status === 'paused'}
        className="min-w-0 flex-1 sm:flex-none"
        options={[
          { value: 'walk', icon: Footprints, label: UZ.tools.walk, sub: tpl(UZ.hud.speed, { v: fmt(SPEEDS.walk) }), activeClass: 'bg-emerald-300' },
          { value: 'run', icon: Rabbit, label: UZ.tools.run, sub: tpl(UZ.hud.speed, { v: fmt(SPEEDS.run, 0) }), activeClass: 'bg-emerald-300' },
        ]}
      />
      <button
        type="button"
        onClick={() => setClockX((c) => CLOCKS[(CLOCKS.indexOf(c) + 1) % CLOCKS.length])}
        title={UZ.tools.clockTip}
        aria-label={`${UZ.tools.clock} ×${clockX}. ${UZ.tools.clockTip}`}
        className={`${toolBtn} border-white/10 bg-white/[0.04] text-gray-200 hover:bg-white/[0.08]`}
      >
        <Clock className="size-4 text-emerald-300" aria-hidden />
        <span className="tabular-nums">×{clockX}</span>
      </button>
      <Motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={onGo}
        disabled={!canGo}
        title={canGo ? UZ.tools.goTip : UZ.tools.goDisabled}
        aria-label={`${goLabel} — ${canGo ? UZ.tools.goTip : UZ.tools.goDisabled}`}
        className={`relative flex min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-7 text-lg font-extrabold tracking-wide transition-[filter,opacity] sm:ml-auto sm:w-auto disabled:cursor-not-allowed disabled:opacity-40 ${
          status === 'running'
            ? 'bg-linear-to-r from-amber-300 to-orange-400 text-slate-950 shadow-[0_10px_30px_-10px_rgba(251,191,36,0.8)]'
            : 'bg-linear-to-r from-emerald-300 via-teal-300 to-cyan-300 text-slate-950 shadow-[0_10px_34px_-10px_rgba(45,212,191,0.9)] hover:brightness-110'
        }`}
      >
        {canGo && status === 'idle' && (
          <Motion.span
            aria-hidden
            className="absolute inset-y-0 -left-1/4 w-1/6 skew-x-[-20deg] bg-white/25"
            animate={{ x: ['0%', '450%'] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}
          />
        )}
        <GoIcon className="relative size-5" aria-hidden fill={status === 'running' ? 'currentColor' : status === 'done' ? 'none' : 'currentColor'} />
        <span className="relative">{goLabel}</span>
      </Motion.button>
    </div>
  );

  const legend = (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-400">
      <li className="flex items-center gap-1.5">
        <svg width="26" height="8" aria-hidden>
          <line x1="3" y1="4" x2="24" y2="4" stroke="#f8fafc" strokeWidth="3" strokeDasharray="0 6" strokeLinecap="round" />
        </svg>
        {UZ.legend.traj}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-1 w-6 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]" aria-hidden />
        {UZ.legend.trail}
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="26" height="10" aria-hidden>
          <line x1="2" y1="5" x2="18" y2="5" stroke="#fbbf24" strokeWidth="2.5" />
          <path d="M 25 5 L 17 1 L 17 9 Z" fill="#fbbf24" />
        </svg>
        {UZ.legend.disp}
      </li>
      <li className="flex items-center gap-1.5">
        <Flag className="size-3.5 text-violet-300" aria-hidden />
        {UZ.legend.frame}
      </li>
    </ul>
  );

  const glossary = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3.5">
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
        <BookOpen className="size-3.5" aria-hidden />
        {UZ.glossary.title}
      </p>
      <dl className="grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {UZ.glossary.items.map(([term, def], i) => (
          <div key={term} className="flex gap-2 text-[11.5px] leading-snug">
            <span className={`mt-[5px] size-2 shrink-0 rounded-full ${GLOSSARY_DOTS[i]}`} aria-hidden />
            <div className="min-w-0">
              <dt className="inline font-bold text-gray-100">{term}</dt>
              <dd className="inline text-gray-400"> — {def}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );

  const graphCard = (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">{UZ.graph.title}</h3>
        <span className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3.5 rounded bg-cyan-300" aria-hidden />
            {UZ.hud.path}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3.5 rounded bg-amber-300" aria-hidden />
            {UZ.hud.disp}
          </span>
        </span>
      </div>
      <div className="mt-2">
        <Graph samples={graphSamples} total={total} sNow={s} dNow={dNow} speed={speed} started={status !== 'idle'} />
      </div>
      <div className="mt-2 space-y-1.5" aria-hidden>
        {[
          ['cyan', UZ.hud.path, s],
          ['amber', UZ.hud.disp, dNow],
        ].map(([tone, label, v]) => (
          <div key={label} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 shrink-0 text-gray-400">{label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className={`block h-full rounded-full ${tone === 'cyan' ? 'bg-cyan-300' : 'bg-amber-300'}`}
                style={{ width: `${total > 0 ? Math.min(100, (v / total) * 100) : 0}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums text-gray-300">{fmt(v)} m</span>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-xs leading-snug text-gray-400">{UZ.graph.note}</p>
    </div>
  );

  return (
    <section
      aria-labelledby="dg-title"
      className="glass relative overflow-hidden rounded-3xl p-3 sm:p-5"
      style={{ background: 'linear-gradient(160deg, rgba(14,24,40,0.85), rgba(10,8,22,0.92) 55%, rgba(22,12,40,0.9))' }}
    >
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 size-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 size-96 rounded-full bg-violet-600/15 blur-3xl" />

      <header className="relative mb-4 flex flex-wrap items-center gap-3">
        <div className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-cyan-300 via-teal-300 to-violet-400 text-slate-950 shadow-[0_8px_30px_-8px_rgba(34,211,238,0.7)]">
          <Pencil className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">{UZ.badge}</p>
          <h2 id="dg-title" className="text-2xl font-extrabold leading-tight text-white sm:text-[28px]">
            {UZ.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2">
          {totalStars === 18 ? (
            <Trophy className="size-6 text-amber-300" aria-hidden />
          ) : (
            <Star className="size-6 fill-amber-300 text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.6)]" aria-hidden />
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/80">{UZ.starsLabel}</p>
            <p className="text-lg font-extrabold leading-none tabular-nums text-amber-100">
              {totalStars}
              <span className="text-sm font-semibold text-amber-200/60"> / 18</span>
            </p>
          </div>
          <div className="hidden h-2 w-20 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden>
            <Motion.div className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-400" animate={{ width: `${(totalStars / 18) * 100}%` }} />
          </div>
        </div>
        <p className="w-full text-sm leading-snug text-gray-400">{totalStars === 18 ? UZ.allDone : UZ.subtitle}</p>
      </header>

      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr]">
        <div className="space-y-3 lg:col-start-2 lg:row-start-1">
          {levelGrid}
          {taskCard}
        </div>
        <div className="min-w-0 space-y-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {toolbar}
          {mapBlock}
          {hud}
          {actions}
          {legend}
          {glossary}
        </div>
        <div className="lg:col-start-2 lg:row-start-2">{graphCard}</div>
      </div>
    </section>
  );
}
