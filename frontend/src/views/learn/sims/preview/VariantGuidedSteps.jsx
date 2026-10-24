import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  Bike,
  Bus,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  Compass,
  Earth,
  Hand,
  Lightbulb,
  ListChecks,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  Target,
  TrainFront,
  Trophy,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/**
 * Variant D - "Qadam-baqadam" (step by step).
 *
 * A guided explorable for physics lesson 1.1 "Basic concepts in mechanics":
 * one small interactive per concept (material point, frame of reference,
 * trajectory / path / displacement) and a short check at the end. Every
 * number on screen is computed from the same SI model that draws the scene,
 * so what the learner reads is what they see.
 *
 * Prototype: Uzbek only. Every user-facing string lives in `UZ` so the chosen
 * variant can be moved to the locale files without hunting through the JSX.
 */

/* ------------------------------------------------------------------ strings */

const UZ = {
  card: 'Mexanikaning asosiy tushunchalari: qadam-baqadam interaktiv dars',
  kicker: 'Qadam-baqadam',
  lessonTag: 'Fizika · Kinematika · 1-dars',
  stepOf: (n, total) => `${n}-qadam / ${total}`,
  doneOf: (n, total) => `${n}/${total} qadam bajarildi`,
  doneMark: 'bajarildi',
  stepsNav: 'Dars qadamlari',
  back: 'Orqaga',
  next: 'Davom etish',
  restartAll: 'Boshidan boshlash',
  finish: 'Yakunlash',
  finishQuizFirst: 'Savollarga javob bering',
  nextTask: 'Keyingi topshiriq:',
  stepComplete: 'Qadam bajarildi — davom eting!',
  allComplete: "Dars yakunlandi. Barakalla!",
  tasks: 'Topshiriqlar',
  yes: 'Ha',
  no: "Yo'q",
  correct: "To'g'ri!",
  incorrect: 'Unchalik emas.',
  play: 'Ijro etish',
  pause: "To'xtatish",
  reset: 'Boshiga qaytarish',
  steps: [
    {
      short: 'Moddiy nuqta',
      title: 'Moddiy nuqta',
      def: "**Moddiy nuqta** — masalaning shartida o'lchamini hisobga olmasa ham bo'ladigan jism. Bitta avtobus — ikki xil masala.",
    },
    {
      short: 'Sanoq sistemasi',
      title: 'Sanoq sistemasi',
      def: "**Sanoq sistemasi** — sanoq jismi, unga bog'langan koordinata o'qlari va soat. Ularsiz «jism qayerda?» degan savolning javobi yo'q.",
    },
    {
      short: "Yo'l va ko'chish",
      title: "Trayektoriya, yo'l va ko'chish",
      def: "**Trayektoriya** — jism chizib o'tgan chiziq. **Yo'l** — shu chiziqning uzunligi, u hech qachon kamaymaydi. **Ko'chish** — boshlang'ich nuqtadan oxirgi nuqtaga yo'nalgan vektor.",
    },
    {
      short: 'Tekshiruv',
      title: 'Tekshiruv',
      def: "To'rtta qisqa savol. Javob berishingiz bilan izohini ko'rasiz, oxirida — natija.",
    },
  ],

  s1: {
    zoomLabel: 'Masshtab',
    zoomValue: (d) => `Kadr kengligi ${d}`,
    presets: { street: "Ko'cha", city: 'Shahar', country: 'Mamlakat' },
    presetsLabel: 'Tayyor masshtablar',
    frame: 'Kadr',
    topView: "Yuqoridan ko'rinish",
    scene: (d) => `Avtobus garajga orqasi bilan kirmoqda, yuqoridan ko'rinish. Kadr kengligi ${d}.`,
    bus: 'Avtobus',
    busPoint: 'Avtobus = nuqta',
    busLen: '12 m',
    gate: '3,4 m',
    garage: 'GARAJ',
    cityName: 'Samarqand',
    stop: 'Bekat · 750 m',
    cities: { tashkent: 'Toshkent', jizzakh: 'Jizzax', guliston: 'Guliston', samarkand: 'Samarqand' },
    route: "≈ 300 km yo'l",
    ratioTitle: 'Avtobus masofaga nisbatan qancha?',
    ratio: (p) => `Avtobus uzunligi (12 m) — kadr kengligining ${p} %`,
    ratioMin: "O'lchami muhim",
    ratioMax: 'Arzimas',
    verdicts: {
      no: {
        badge: 'Nuqta emas',
        text: "Darvoza kengligi 3,4 m, avtobusning eni 2,55 m — har tomonda atigi 0,4 m bo'shliq. 12 metrlik avtobusni garajga kiritishda uning o'lchami hal qiluvchi.",
      },
      depends: {
        badge: "Masalaga bog'liq",
        text: "Shahar xaritasida avtobus kichrayib qoldi. Bekatgacha yuzlab metr bo'lsa, uning 12 metrini hisobga olish yoki olmaslik savolning o'ziga bog'liq.",
      },
      yes: {
        badge: 'Moddiy nuqta',
        text: "Toshkent–Samarqand yo'li ≈ 300 km. Avtobusning 12 m uzunligi bu masofaning atigi 0,004 % i. Yo'l vaqtini hisoblashda avtobusni nuqta deb olsa bo'ladi.",
      },
    },
    rule: "Qoida: jismning o'lchami masaladagi masofalardan juda kichik bo'lsa, uni moddiy nuqta deb olamiz.",
    quizTitle: "Nuqta deb olsa bo'ladimi?",
    prompts: [
      {
        id: 'plane',
        text: 'Samolyot Toshkentdan Moskvaga uchmoqda (≈ 2 800 km). Parvoz vaqtini hisoblaymiz.',
        answer: 'yes',
        why: "≈ 70 m li samolyot 2 800 km masofadan 40 000 marta kichik — uni nuqta deb olsa bo'ladi.",
      },
      {
        id: 'wardrobe',
        text: 'Shkafni xona eshigidan olib o\'tmoqchimiz.',
        answer: 'no',
        why: "Shkafning eni eshik kengligi bilan deyarli bir xil — aynan o'lchami muhim.",
      },
      {
        id: 'earth',
        text: "Yer o'z o'qi atrofida aylanadi, kun va tun almashinadi.",
        answer: 'no',
        why: "Kun-tunni tushuntirish uchun Yerning o'lchami va shakli kerak. Lekin Quyosh atrofidagi yo'lida (150 mln km) Yerni nuqta deb olsa bo'ladi!",
      },
    ],
    tasks: ["Masshtabni «Mamlakat»gacha uzoqlashtiring", (n) => `Uchta vaziyatga javob bering (${n}/3)`],
  },

  s2: {
    pick: 'Sanoq jismini tanlang',
    frames: {
      earth: {
        name: 'Yer',
        shape: 'Parabola, oldinga',
        text: "Yerda turgan kuzatuvchi uchun to'p yuqoriga ham, oldinga ham uchadi — poyezd bilan birga 4 m/s tezlikda. Trayektoriya — oldinga cho'zilgan parabola.",
      },
      train: {
        name: 'Poyezd',
        shape: 'Tik chiziq',
        text: "Vagondagi yo'lovchi uchun to'p tik yuqoriga ko'tarilib, o'sha qo'lga qaytib tushadi. Poyezd sanoq sistemasida trayektoriya — tik chiziq.",
      },
      bike: {
        name: 'Velosipedchi',
        shape: 'Parabola, orqaga',
        text: "Velosipedchi poyezddan tezroq — 6 m/s. Uning uchun poyezd ham, to'p ham orqaga 2 m/s tezlikda suriladi. Trayektoriya — orqaga egilgan parabola.",
      },
    },
    slow: 'Sekin ×0,5',
    rethrow: 'Qayta otish',
    scene: (name) => `Ketayotgan poyezd ichida yo'lovchi to'pni tik yuqoriga otadi. Sanoq jismi: ${name}.`,
    readouts: "To'p shu sanoq sistemasida",
    who: 'Kim qanday harakatlanadi?',
    whoNote: 'gorizontal tezlik',
    rest: 'tinch turadi',
    refBody: 'sanoq jismi',
    compareTitle: "Bitta to'p — uchta trayektoriya",
    key: "Uchala kuzatuvchi bitta to'pni kuzatadi, lekin uning koordinatalari, tezligi va trayektoriyasi har xil. Shuning uchun avval sanoq sistemasini tanlaymiz.",
    trainLabel: 'POYEZD',
    bikeLabel: 'Velosipedchi',
    tasks: [(n) => `Uchala sanoq jismini sinab ko'ring (${n}/3)`],
  },

  s3: {
    routePick: "Yo'nalishni tanlang",
    routes: { oval: 'Stadion: 400 m doira', line: "Borib-qaytish: 2 × 200 m" },
    routeShort: { oval: 'Stadion doirasi', line: "To'g'ri yo'l, borib-qaytish" },
    routeTabs: { oval: 'Stadion · 400 m', line: 'Borib-qaytish' },
    time: 'Vaqt',
    path: "Yo'l",
    disp: "Ko'chish",
    pathNote: 'faqat ortadi',
    dispNote: 'start → hozir',
    timeSlider: 'Vaqt',
    timeValue: (t) => `Vaqt ${t} sekund`,
    speedNote: '5 m/s · ×8 tez',
    dragHint: 'Yuguruvchini suring',
    start: 'START · MARRA',
    turn: 'Burilish',
    jumps: [
      { f: 0.25, label: '¼' },
      { f: 0.5, label: '½' },
      { f: 0.75, label: '¾' },
      { f: 1, label: 'Marra' },
    ],
    jumpAria: (label) => `Vaqtni ${label} qismga o'tkazish`,
    chartTitle: "Yo'l va ko'chish vaqt bo'yicha",
    chartAria: "Yo'l va ko'chish modulining vaqtga bog'liqlik grafigi. Bosib vaqtni tanlash mumkin.",
    pathLegend: "yo'l",
    dispLegend: "ko'chish",
    rule: "Har doim: yo'l ≥ ko'chish moduli.",
    si: "SI da uzunlik metrda (m), vaqt sekundda (s) o'lchanadi.",
    scene: (route) => `${route}: yuguruvchi, uning trayektoriyasi va ko'chish strelkasi.`,
    msgs: {
      start: "Yugurish hali boshlanmadi: yo'l ham, ko'chish ham 0 m. ▶ tugmasini bosing yoki yuguruvchini suring.",
      ovalGrow: "Sariq chiziq — trayektoriya, uning uzunligi — yo'l. Zangori strelka — ko'chish: startdan hozirgi nuqtagacha to'g'ri chiziq. Egri yo'lda yo'l doim ko'chishdan uzun.",
      ovalFar: (d) => `Siz startdan eng uzoq nuqtadasiz: ko'chish eng katta, ≈ ${d} m. Yo'l esa allaqachon 200 m dan oshdi.`,
      ovalShrink: "Ko'chish kamaymoqda — siz startga yaqinlashyapsiz. Yo'l esa ortishda davom etadi: u hech qachon kamaymaydi.",
      ovalEnd: "Marra! Yo'l 400 m, ko'chish 0 m: boshlang'ich va oxirgi nuqta bir joyda.",
      lineOut: "To'g'ri chiziq bo'ylab bir tomonga yugurganda yo'l va ko'chish moduli teng. Faqat shu holatda!",
      lineTurn: "Burilish nuqtasi: yo'l = ko'chish = 200 m. Endi orqaga qaytamiz.",
      lineBack: "Orqaga qaytyapsiz: ko'chish kamaymoqda, yo'l esa ortib bormoqda.",
      lineEnd: "Startga qaytdingiz: yo'l 400 m, ko'chish 0 m — xuddi stadion doirasidagi kabi!",
    },
    tasks: ['Stadionda marragacha yuguring', "«Borib-qaytish» yo'lini ham oxirigacha sinang"],
  },

  s4: {
    qOf: (n, total) => `Savol ${n} / ${total}`,
    nextQ: 'Keyingi savol',
    seeResult: "Natijani ko'rish",
    resultTitle: 'Natija',
    scoreAria: (n, total) => `${total} savoldan ${n} tasiga to'g'ri javob`,
    msgs: {
      perfect: "Ajoyib! Barcha tushunchalarni o'zlashtirdingiz.",
      good: "Juda yaxshi! Xato qilgan savolingizni yana bir ko'rib chiqing.",
      retry: 'Yomon emas. Qadamlarga qaytib, interaktivlarni yana sinab ko\'ring.',
    },
    review: 'Javoblaringiz',
    retryQuiz: 'Qayta urinish',
    task: 'Barcha savollarga javob bering',
    figure: {
      north: '30 m',
      east: '40 m',
      start: 'Start',
      compass: 'Shimol',
      laps: "Stadion doirasi bo'ylab ikki aylana",
      lapsPath: "yo'l = 800 m",
      lapsDisp: "ko'chish = 0 m",
      garage: 'Garaj',
      map: 'Xarita',
      route: '≈ 300 km',
      busAria: "Chapda garajga kirayotgan avtobus, o'ngda xaritadagi yo'l",
      trainAria: "Poyezd vagonida o'tirgan yo'lovchi va yerda turgan kuzatuvchi",
      trainRel: '0 m/s',
      groundRel: '20 m/s',
    },
    questions: [
      {
        short: "Ikki aylana: yo'l va ko'chish",
        figure: 'laps',
        q: "Stadionning 400 metrli doirasini ikki marta aylanib chiqdingiz. Yo'l va ko'chish qancha?",
        options: ["Yo'l 400 m, ko'chish 0 m", "Yo'l 800 m, ko'chish 800 m", "Yo'l 800 m, ko'chish 0 m", "Yo'l 0 m, ko'chish 800 m"],
        correct: 2,
        hints: { 0: "Har bir aylana yo'lga yana 400 m qo'shadi.", 1: "Startga qaytdingiz — ko'chish strelkasining uzunligi nol." },
        explain: "Yo'l har aylanada qo'shiladi: 2 × 400 m = 800 m. Oxirgi nuqta start bilan bir joyda, shuning uchun ko'chish 0 m.",
      },
      {
        short: 'Avtobus qachon nuqta?',
        figure: 'bus',
        q: 'Qaysi masalada avtobusni moddiy nuqta deb olish mumkin?',
        options: [
          'Avtobus garajga orqasi bilan kirayotganda',
          "Avtobus tor ko'chada burilayotganda",
          'Yo\'lovchilar eshikdan chiqayotganda',
          "Toshkentdan Samarqandga necha soatda yetishini hisoblashda",
        ],
        correct: 3,
        explain: "≈ 300 km yonida avtobusning 12 metri arzimas. Garaj, tor ko'cha va eshik masalalarida esa uning o'lchami hal qiluvchi.",
      },
      {
        short: "Yo'lovchining tezligi",
        figure: 'train',
        q: "Poyezd 20 m/s tezlikda ketyapti. Vagonda o'tirgan yo'lovchining tezligi qancha?",
        options: [
          'Poyezdga nisbatan 0 m/s, Yerga nisbatan 20 m/s',
          'Har qanday sanoq sistemasida 20 m/s',
          'Har qanday sanoq sistemasida 0 m/s',
          'Poyezdga nisbatan 20 m/s, Yerga nisbatan 0 m/s',
        ],
        correct: 0,
        hints: { 1: "Tezlik sanoq sistemasiga bog'liq — «har qanday» bo'lishi mumkin emas.", 2: "Tezlik sanoq sistemasiga bog'liq — «har qanday» bo'lishi mumkin emas." },
        explain: "Poyezdga nisbatan yo'lovchi tinch turadi. Yerga nisbatan esa poyezd bilan birga 20 m/s tezlikda harakatlanadi.",
      },
      {
        short: 'Shimolga, keyin sharqqa',
        q: "Bola 30 m shimolga, keyin 40 m sharqqa yurdi. Uning ko'chishi moduli qancha?",
        figure: 'walk',
        options: ['70 m', '50 m', '10 m', '0 m'],
        correct: 1,
        hints: { 0: "70 m — bu yo'l, ko'chish emas." },
        explain: "Ko'chish — startdan oxirgi nuqtaga to'g'ri strelka: √(30² + 40²) = 50 m. Yo'l esa 30 + 40 = 70 m.",
      },
    ],
  },
};

/* ------------------------------------------------------------------ helpers */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Uzbek number format: decimal comma, unicode minus, spaced thousands. */
function fmt(value, digits = 0) {
  let s = Number(value).toFixed(digits);
  if (Number(s) === 0) s = (0).toFixed(digits);
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  const [int, frac] = s.split('.');
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return `${neg ? '−' : ''}${grouped}${frac ? `,${frac}` : ''}`;
}

function fmtDist(m) {
  if (m < 1000) return `${fmt(m)} m`;
  if (m < 10000) return `${fmt(m / 1000, 1)} km`;
  return `${fmt(m / 1000)} km`;
}

function fmtPct(p) {
  if (p >= 10) return fmt(p);
  if (p >= 1) return fmt(p, 1);
  return fmt(p, Math.min(6, Math.ceil(-Math.log10(p)) + 1));
}

/** `**bold**` inside a UZ string becomes <strong>. */
function Rich({ text }) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 ? (
      <strong key={i} className="font-semibold text-white">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function useElementWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Runs `callback(dtSeconds, now)` every animation frame while `active`. */
function useAnimationFrame(callback, active) {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cb.current(dt, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

function useSvgId() {
  return `vgs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

/* ------------------------------------------------------------- shared bits */

const CSS = `
.vgs-range{-webkit-appearance:none;appearance:none;width:100%;height:40px;background:transparent;cursor:pointer;touch-action:pan-y}
.vgs-range:focus{outline:none}
.vgs-range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(to right,var(--c) 0,var(--c) var(--p),rgba(255,255,255,.13) var(--p),rgba(255,255,255,.13) 100%)}
.vgs-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:24px;height:24px;margin-top:-9px;border-radius:50%;background:#fff;border:5px solid var(--c);box-shadow:0 2px 10px rgba(0,0,0,.55);transition:transform .15s}
.vgs-range:active::-webkit-slider-thumb{transform:scale(1.12)}
.vgs-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 6px rgba(255,255,255,.22)}
.vgs-range::-moz-range-track{height:6px;border-radius:999px;background:rgba(255,255,255,.13)}
.vgs-range::-moz-range-progress{height:6px;border-radius:999px;background:var(--c)}
.vgs-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:5px solid var(--c)}
.vgs-ping{transform-box:fill-box;transform-origin:center;animation:vgs-ping 1.8s ease-out infinite}
@keyframes vgs-ping{from{transform:scale(1);opacity:.8}to{transform:scale(3.2);opacity:0}}
.vgs-t{paint-order:stroke;stroke:#07060f;stroke-width:3.5px;stroke-linejoin:round}
@media (prefers-reduced-motion:reduce){.vgs-ping{animation:none;opacity:.35}}
`;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70';
const BTN = `inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${FOCUS} disabled:cursor-not-allowed disabled:opacity-40`;
const BTN_GHOST = `${BTN} border border-white/10 bg-white/5 text-gray-100 hover:bg-white/10`;
const BTN_PRIMARY = `${BTN} bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.28)]`;
const BTN_ICON = `grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gray-100 transition-colors hover:bg-white/10 ${FOCUS}`;
const PANEL = 'rounded-2xl border border-white/10 bg-white/[0.03]';
const STAGE = 'relative overflow-hidden rounded-2xl border border-white/10 bg-[#07060f]';
const CHIP = 'pointer-events-none absolute flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] font-medium text-gray-200 backdrop-blur-sm';

const TONES = {
  rose: { box: 'border-rose-400/35 bg-rose-500/[0.07]', text: 'text-rose-300' },
  amber: { box: 'border-amber-300/35 bg-amber-400/[0.07]', text: 'text-amber-300' },
  emerald: { box: 'border-emerald-400/35 bg-emerald-400/[0.07]', text: 'text-emerald-300' },
  cyan: { box: 'border-cyan-300/30 bg-cyan-400/[0.06]', text: 'text-cyan-300' },
  violet: { box: 'border-violet-300/30 bg-violet-400/[0.07]', text: 'text-violet-300' },
};

function Range({ value, min, max, step, onChange, label, valueText, color = '#22d3ee' }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="vgs-range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      aria-valuetext={valueText}
      style={{ '--p': `${p}%`, '--c': color }}
    />
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-2xl border border-white/10 bg-black/25 p-1">
      {options.map((o) => {
        const active = o.id === value;
        const { Icon } = o;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`relative flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors sm:px-3 ${FOCUS} ${
              active ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
            }`}
            style={active && o.color ? { boxShadow: `inset 0 0 0 1px ${o.color}80` } : undefined}
          >
            {Icon && <Icon size={17} aria-hidden style={{ color: active && o.color ? o.color : undefined }} className="hidden shrink-0 sm:block" />}
            {o.short ? (
              <>
                <span className="truncate sm:hidden">{o.short}</span>
                <span className="hidden truncate sm:inline">{o.label}</span>
              </>
            ) : (
              <span className="truncate">{o.label}</span>
            )}
            {o.badge}
          </button>
        );
      })}
    </div>
  );
}

function TaskList({ items }) {
  return (
    <div className={`${PANEL} p-4`}>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <ListChecks size={14} aria-hidden /> {UZ.tasks}
      </p>
      <ul className="mt-2.5 space-y-2">
        {items.map((it) => (
          <li key={it.key} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                it.done ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/25'
              }`}
            >
              {it.done && <Check size={12} strokeWidth={3.5} aria-hidden />}
            </span>
            <span className={it.done ? 'text-gray-400' : 'text-gray-200'}>
              {it.text}
              {it.done && <span className="sr-only"> — {UZ.doneMark}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Explain({ tone = 'cyan', icon: Icon = Lightbulb, title, children }) {
  const t = TONES[tone];
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${t.box}`} aria-live="polite">
      {title && (
        <p className={`mb-1.5 flex items-center gap-2 text-sm font-bold ${t.text}`}>
          <Icon size={17} aria-hidden /> {title}
        </p>
      )}
      <div className="flex gap-2.5 text-sm leading-relaxed text-gray-200">
        {!title && <Icon size={17} aria-hidden className={`mt-0.5 shrink-0 ${t.text}`} />}
        <p>{children}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, unit, color, note }) {
  return (
    <div className={`${PANEL} min-w-0 px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {label}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-xl font-bold tabular-nums text-white sm:text-2xl">
        {value}
        <span className="ml-1 text-sm font-medium text-gray-400">{unit}</span>
      </div>
      {note && <div className="truncate text-[11px] text-gray-500">{note}</div>}
    </div>
  );
}

/* ====================================================== step 1: material point */

const BUS_L = 12;
const BUS_W = 2.55;
const W_MIN = 40; // frame width at street scale, m
const W_MAX = 560000; // frame width at country scale, m
const MAP_CENTER = [98000, -92000]; // m (east, -north) from the garage in Samarkand
const BUS_LOOP = 16; // s
const PRESETS = [
  { id: 'street', z: 0 },
  { id: 'city', z: 0.45 },
  { id: 'country', z: 1 },
];
// Schematic map, km east / km north of Samarkand (from real coordinates).
const CITIES_KM = [
  { id: 'samarkand', p: [0, 0], dx: 10, dy: 18, anchor: 'start' },
  { id: 'jizzakh', p: [73.7, 51.2], dx: -9, dy: -8, anchor: 'end' },
  { id: 'guliston', p: [153, 92.8], dx: 10, dy: 4, anchor: 'start' },
  { id: 'tashkent', p: [196, 183.8], dx: 10, dy: -6, anchor: 'start', capital: true },
];
const ROAD_KM = [[0, 0], [20, 14], [45, 30], [73.7, 51.2], [100, 60], [128, 74], [153, 92.8], [168, 125], [182, 155], [196, 183.8]];
const RIVERS_KM = [
  [[70, -20], [40, -10], [15, 4], [-10, 9], [-50, 20], [-100, 36], [-160, 52]],
  [[262, 72], [228, 60], [195, 63], [172, 104], [152, 143], [118, 178], [86, 214], [58, 252]],
];
const PEAKS_KM = [[52, 4], [76, 12], [100, 7], [124, 20], [146, 30], [-26, 90], [2, 97], [28, 92]];
const CITY_GRID = Array.from({ length: 25 }, (_, i) => (i - 12) * 400);
// City blocks between the streets: a fixed pseudo-random pattern of buildings and parks.
const CITY_BLOCKS = [];
for (let i = -12; i < 12; i += 1) {
  for (let j = -12; j < 12; j += 1) {
    const nearDepot = (i === -1 || i === 0) && (j === -1 || j === 0);
    const h = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 13;
    if (!nearDepot && h < 6) CITY_BLOCKS.push([i * 400, j * 400 + 12, h === 0 ? 'park' : 'built']);
  }
}
const km = ([e, n]) => [e * 1000, -n * 1000];

function busRearAt(t) {
  if (t < 1.5) return -4;
  if (t < 9.5) return lerp(-4, 15.4, ease((t - 1.5) / 8));
  if (t < 11.5) return 15.4;
  return lerp(15.4, -4, ease((t - 11.5) / 4.5));
}

function PointScene({ w, H, z, busT }) {
  const id = useSvgId();
  const Wm = W_MIN * (W_MAX / W_MIN) ** z;
  const s = w / Wm;
  const tt = (Wm - W_MIN) / (W_MAX - W_MIN);
  const cx = tt * MAP_CENTER[0];
  const cy = tt * MAP_CENTER[1];
  const X = (x) => w / 2 + (x - cx) * s;
  const Y = (y) => H / 2 + (y - cy) * s;
  const box = (x0, y0, x1, y1, props) => (
    <rect x={X(x0)} y={Y(y0)} width={Math.max(0, (x1 - x0) * s)} height={Math.max(0, (y1 - y0) * s)} {...props} />
  );
  const pts = (list) =>
    list
      .map((p) => {
        const [x, y] = km(p);
        return `${X(x).toFixed(1)},${Y(y).toFixed(1)}`;
      })
      .join(' ');

  const lw = Math.log10(Wm);
  const streetOp = 1 - clamp01((lw - 2.1) / 0.7);
  const cityOp = clamp01((lw - 2.2) / 0.6) * (1 - clamp01((lw - 4.0) / 0.6));
  const mapOp = clamp01((lw - 4.0) / 0.6);

  const xr = busRearAt(busT);
  const reversing = busT >= 1.5 && busT < 9.5;
  const forward = busT >= 11.5;
  const Lpx = BUS_L * s;
  const detailOp = clamp01((Lpx - 5) / 10);
  const dotOp = 1 - clamp01((Lpx - 12) / 10);
  const bx0 = xr - BUS_L;
  const by0 = -BUS_W / 2;
  const busCx = X(xr - BUS_L / 2);
  const busCy = Y(0);

  // Scale bar: 1-2-5 steps, 55..110 px long.
  const target = 110 / s;
  const pow = 10 ** Math.floor(Math.log10(target));
  const len = (target / pow >= 5 ? 5 : target / pow >= 2 ? 2 : 1) * pow;
  const barPx = len * s;

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="absolute inset-0 block" role="img" aria-label={UZ.s1.scene(fmtDist(Wm))}>
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#120f24" />
          <stop offset="100%" stopColor="#07060f" />
        </radialGradient>
        <linearGradient id={`${id}rev`} x1="0" x2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={w} height={H} fill={`url(#${id}bg)`} />

      {/* ---- country map ---- */}
      {mapOp > 0.01 && (
        <g opacity={mapOp}>
          {[66, 67, 68, 69, 70].map((lon) => {
            const x = X((lon - 66.975) * 85 * 1000);
            return <line key={`lon${lon}`} x1={x} x2={x} y1={0} y2={H} stroke="#a5b4fc" strokeOpacity="0.07" strokeDasharray="2 6" />;
          })}
          {[39, 40, 41, 42].map((lat) => {
            const y = Y(-(lat - 39.654) * 111 * 1000);
            return <line key={`lat${lat}`} x1={0} x2={w} y1={y} y2={y} stroke="#a5b4fc" strokeOpacity="0.07" strokeDasharray="2 6" />;
          })}
          {RIVERS_KM.map((r, i) => (
            <polyline key={`river${i}`} points={pts(r)} fill="none" stroke="#38bdf8" strokeOpacity="0.32" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {PEAKS_KM.map((p, i) => {
            const [x, y] = km(p);
            const px = X(x);
            const py = Y(y);
            return <path key={`peak${i}`} d={`M${px - 8},${py + 5} L${px},${py - 6} L${px + 8},${py + 5} Z`} fill="#221d38" stroke="#3f3866" strokeWidth="1" />;
          })}
          <polyline points={pts(ROAD_KM)} fill="none" stroke="#fbbf24" strokeOpacity="0.25" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${id}glow)`} />
          <polyline points={pts(ROAD_KM)} fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="10 5" />
          {(() => {
            const [x, y] = km([116, 64]);
            return (
              <text x={X(x) + 10} y={Y(y) + 20} className="vgs-t" fill="#fcd34d" fontSize="12" fontWeight="600">
                {UZ.s1.route}
              </text>
            );
          })()}
          {CITIES_KM.map((c) => {
            const [x, y] = km(c.p);
            const px = X(x);
            const py = Y(y);
            return (
              <g key={c.id}>
                {c.capital && <circle cx={px} cy={py} r="8" fill="none" stroke="#e5e7eb" strokeOpacity="0.5" />}
                <circle cx={px} cy={py} r={c.capital ? 4.5 : 3.5} fill="#e5e7eb" />
                <text x={px + c.dx} y={py + c.dy} textAnchor={c.anchor} className="vgs-t" fill="#e5e7eb" fontSize={c.capital ? 13 : 12} fontWeight={c.capital ? 700 : 500}>
                  {UZ.s1.cities[c.id]}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* ---- city streets ---- */}
      {cityOp > 0.01 && (
        <g opacity={cityOp}>
          {CITY_BLOCKS.map(([x0, y0, kind]) => (
            <g key={`blk${x0}_${y0}`}>
              {box(x0 + 45, y0 + 45, x0 + 355, y0 + 355, {
                rx: 18 * s,
                fill: kind === 'park' ? '#0f2a1d' : '#1a1630',
                stroke: kind === 'park' ? '#1d5238' : '#2b2550',
              })}
            </g>
          ))}
          <polyline
            points={`${X(-6)},${Y(0)} ${X(-6)},${Y(12)} ${X(-750)},${Y(12)}`}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeOpacity="0.85"
          />
          <circle cx={X(-750)} cy={Y(12)} r="6" fill="#fbbf24" stroke="#07060f" strokeWidth="2" />
          <text x={X(-750)} y={Y(12) + 22} textAnchor="middle" className="vgs-t" fill="#fde68a" fontSize="12" fontWeight="700">
            {UZ.s1.stop}
          </text>
          {CITY_GRID.map((g) => (
            <line key={`v${g}`} x1={X(g)} x2={X(g)} y1={Y(-5000)} y2={Y(5000)} stroke="#8b7fd6" strokeOpacity={g % 1600 === 0 ? 0.32 : 0.13} strokeWidth={g % 1600 === 0 ? 2 : 1} />
          ))}
          {CITY_GRID.map((g) => (
            <line key={`h${g}`} x1={X(-5000)} x2={X(5000)} y1={Y(g + 12)} y2={Y(g + 12)} stroke="#8b7fd6" strokeOpacity={g % 1600 === 0 ? 0.32 : 0.13} strokeWidth={g % 1600 === 0 ? 2 : 1} />
          ))}
          <text x={X(860)} y={Y(-620)} className="vgs-t" fill="#c4b5fd" fontSize="13" fontWeight="700" letterSpacing="2">
            {UZ.s1.cityName.toUpperCase()}
          </text>
        </g>
      )}

      {/* ---- street: depot yard and garage ---- */}
      {streetOp > 0.01 && (
        <g opacity={streetOp}>
          {box(-90, -45, 60, 7.6, { rx: 4 * s, fill: '#0b1a14' })}
          {box(-400, 7.6, 400, 9, { fill: '#2a2640' })}
          {box(-400, 9, 400, 16, { fill: '#1c1930' })}
          {box(-400, 16, 400, 17.4, { fill: '#2a2640' })}
          <line x1={X(-400)} x2={X(400)} y1={Y(12.5)} y2={Y(12.5)} stroke="#fff" strokeOpacity="0.3" strokeWidth={Math.max(1, 0.15 * s)} strokeDasharray={`${3 * s} ${3 * s}`} />
          {box(-60, -14, 2, 7.6, { fill: '#16142a' })}
          {box(2, -14, 30, -8.8, { fill: '#16142a' })}
          {box(-12, 7.6, 2, 9, { fill: '#16142a' })}
          <line x1={X(-40)} x2={X(2)} y1={Y(0)} y2={Y(0)} stroke="#fbbf24" strokeOpacity="0.3" strokeWidth={Math.max(1, 0.12 * s)} strokeDasharray={`${1.2 * s} ${0.9 * s}`} />
          {[-19, -16.4, -13.8, -11.2, -8.6, -6].map((x) => (
            <line key={`park${x}`} x1={X(x)} x2={X(x)} y1={Y(-14)} y2={Y(-7.4)} stroke="#fff" strokeOpacity="0.22" strokeWidth={Math.max(1, 0.12 * s)} />
          ))}
          {[
            [-17.65, '#3b4a63'],
            [-12.45, '#5b3a8c'],
            [-7.25, '#1f5f5b'],
          ].map(([x, c]) => (
            <g key={`car${x}`}>
              {box(x - 0.95, -12.3, x + 0.95, -7.9, { rx: 0.45 * s, fill: c })}
              {box(x - 0.75, -9.4, x + 0.75, -8.5, { rx: 0.2 * s, fill: '#a5f3fc', opacity: 0.35 })}
            </g>
          ))}
          {[[-2.4, -11.2, 1.7], [21.2, -6.5, 2.2], [21.6, 1.2, 1.8], [-26, -10, 2.4], [-24, 4, 2.0], [22, -12.5, 1.6]].map(([x, y, r]) => (
            <g key={`tree${x}`}>
              <circle cx={X(x)} cy={Y(y)} r={r * s} fill="#123d2a" />
              <circle cx={X(x - r * 0.25)} cy={Y(y - r * 0.25)} r={r * 0.55 * s} fill="#1b5a3c" />
            </g>
          ))}
          {/* garage floor and walls */}
          {box(2, -8.8, 18, 3.0, { fill: '#1d1932' })}
          {box(17.6, -8.8, 18, 3.0, { fill: '#4c4470' })}
          {box(2, -8.8, 18, -8.4, { fill: '#4c4470' })}
          {box(2, 2.6, 18, 3.0, { fill: '#4c4470' })}
          {box(2, -3.0, 17.6, -2.6, { fill: '#4c4470' })}
          {box(2, -2.6, 2.4, -1.7, { fill: '#6b62a0' })}
          {box(2, 1.7, 2.4, 2.6, { fill: '#6b62a0' })}
          {box(2, -8.4, 2.4, -7.4, { fill: '#6b62a0' })}
          {box(2, -4.0, 2.4, -3.0, { fill: '#6b62a0' })}
          {/* a second bus already parked */}
          {box(4.9, -7.0, 16.9, -4.45, { rx: 0.45 * s, fill: '#3c3561' })}
          {box(6.2, -6.7, 16.5, -4.75, { rx: 0.3 * s, fill: '#463e70' })}
          {s > 7 && (
            <text x={X(10)} y={Y(-9.6)} textAnchor="middle" fill="#a59bd8" fontSize="11" fontWeight="700" letterSpacing="3">
              {UZ.s1.garage}
            </text>
          )}
        </g>
      )}

      {/* ---- our bus, drawn to scale ---- */}
      {detailOp > 0.01 && (
        <g opacity={detailOp}>
          {reversing && box(xr, -1.1, xr + 2.6, 1.1, { fill: `url(#${id}rev)` })}
          {box(bx0, by0, xr, -by0, { rx: 0.45 * s, fill: '#f59e0b' })}
          {box(bx0 + 1.3, by0 + 0.28, xr - 0.4, -by0 - 0.28, { rx: 0.3 * s, fill: '#fbbf24' })}
          {box(bx0 + 0.12, by0 + 0.2, bx0 + 1.0, -by0 - 0.2, { rx: 0.25 * s, fill: '#a5f3fc', opacity: 0.9 })}
          {box(bx0 + 3.2, -0.65, bx0 + 5.4, 0.65, { rx: 0.2 * s, fill: '#d97706' })}
          {box(bx0 + 7.6, -0.5, bx0 + 9.0, 0.5, { rx: 0.2 * s, fill: '#d97706' })}
          {box(bx0 + 0.45, by0 - 0.28, bx0 + 0.8, by0, { fill: '#f59e0b' })}
          {box(bx0 + 0.45, -by0, bx0 + 0.8, -by0 + 0.28, { fill: '#f59e0b' })}
          {box(xr - 0.2, by0 + 0.12, xr, by0 + 0.62, { fill: reversing ? '#fb7185' : '#9f1239' })}
          {box(xr - 0.2, -by0 - 0.62, xr, -by0 - 0.12, { fill: reversing ? '#fb7185' : '#9f1239' })}
          {forward && box(bx0, by0 + 0.15, bx0 + 0.16, by0 + 0.6, { fill: '#fef9c3' })}
          {forward && box(bx0, -by0 - 0.6, bx0 + 0.16, -by0 - 0.15, { fill: '#fef9c3' })}
        </g>
      )}

      {/* ---- dimensions: what makes size matter here ---- */}
      {detailOp > 0.5 && Lpx > 70 && (
        <g opacity={streetOp} fontSize="11" fontWeight="700">
          <line x1={X(bx0)} x2={X(xr)} y1={Y(by0 - 0.9)} y2={Y(by0 - 0.9)} stroke="#fde68a" strokeWidth="1.2" />
          <line x1={X(bx0)} x2={X(bx0)} y1={Y(by0 - 1.3)} y2={Y(by0 - 0.5)} stroke="#fde68a" strokeWidth="1.2" />
          <line x1={X(xr)} x2={X(xr)} y1={Y(by0 - 1.3)} y2={Y(by0 - 0.5)} stroke="#fde68a" strokeWidth="1.2" />
          <text x={X(xr - BUS_L / 2)} y={Y(by0 - 0.9) - 5} textAnchor="middle" className="vgs-t" fill="#fde68a">
            {`${UZ.s1.bus} · ${UZ.s1.busLen}`}
          </text>
          <line x1={X(1.2)} x2={X(1.2)} y1={Y(-1.7)} y2={Y(1.7)} stroke="#c4b5fd" strokeWidth="1.2" />
          <line x1={X(0.8)} x2={X(1.6)} y1={Y(-1.7)} y2={Y(-1.7)} stroke="#c4b5fd" strokeWidth="1.2" />
          <line x1={X(0.8)} x2={X(1.6)} y1={Y(1.7)} y2={Y(1.7)} stroke="#c4b5fd" strokeWidth="1.2" />
          <text x={X(1.2)} y={Y(1.7) + 15} textAnchor="middle" className="vgs-t" fill="#c4b5fd">
            {UZ.s1.gate}
          </text>
        </g>
      )}

      {/* ---- the same bus as a point ---- */}
      {dotOp > 0.01 && (
        <g opacity={dotOp}>
          <circle cx={busCx} cy={busCy} r="5" className="vgs-ping" fill="none" stroke="#22d3ee" strokeWidth="2" />
          <circle cx={busCx} cy={busCy} r="5.5" fill="#22d3ee" stroke="#07060f" strokeWidth="2" />
          <text x={busCx - 12} y={busCy - 12} textAnchor="end" className="vgs-t" fill="#67e8f9" fontSize="12" fontWeight="700">
            {UZ.s1.busPoint}
          </text>
        </g>
      )}

      {/* ---- scale bar ---- */}
      <g transform={`translate(14 ${H - 16})`}>
        <line x1="0" x2={barPx} y1="0" y2="0" stroke="#e5e7eb" strokeWidth="2" />
        <line x1="0" x2="0" y1="-5" y2="3" stroke="#e5e7eb" strokeWidth="2" />
        <line x1={barPx} x2={barPx} y1="-5" y2="3" stroke="#e5e7eb" strokeWidth="2" />
        <text x={barPx + 8} y="4" className="vgs-t" fill="#e5e7eb" fontSize="11" fontWeight="600">
          {fmtDist(len)}
        </text>
      </g>
    </svg>
  );
}

function PointPrompts({ answers, onAnswer }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <h4 id={headingId} className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-white">
        <Target size={16} className="text-cyan-300" aria-hidden /> {UZ.s1.quizTitle}
      </h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {UZ.s1.prompts.map((p) => {
          const a = answers[p.id];
          const answered = a != null;
          const ok = a === p.answer;
          return (
            <div
              key={p.id}
              className={`flex flex-col rounded-2xl border p-4 transition-colors ${
                !answered ? 'border-white/10 bg-white/[0.03]' : ok ? 'border-emerald-400/40 bg-emerald-400/[0.06]' : 'border-rose-400/40 bg-rose-400/[0.06]'
              }`}
            >
              <p className="text-sm font-medium leading-snug text-gray-100">{p.text}</p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
                {['yes', 'no'].map((opt) => {
                  const picked = a === opt;
                  const isRight = opt === p.answer;
                  let cls = 'border-white/15 bg-white/5 text-gray-100 hover:bg-white/10 hover:border-white/25';
                  if (answered) {
                    cls = isRight
                      ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-200'
                      : picked
                        ? 'border-rose-400/60 bg-rose-400/15 text-rose-200'
                        : 'border-white/10 text-gray-500';
                  }
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={answered}
                      aria-pressed={picked}
                      onClick={() => onAnswer(p.id, opt)}
                      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors disabled:cursor-default ${FOCUS} ${cls}`}
                    >
                      {answered && isRight && <Check size={15} strokeWidth={3} aria-hidden />}
                      {opt === 'yes' ? UZ.yes : UZ.no}
                    </button>
                  );
                })}
              </div>
              <AnimatePresence initial={false}>
                {answered && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden text-[13px] leading-snug text-gray-300"
                    role="status"
                  >
                    <span className="flex gap-2 pt-3">
                      {ok ? (
                        <CircleCheck size={16} className="mt-px shrink-0 text-emerald-300" aria-hidden />
                      ) : (
                        <CircleX size={16} className="mt-px shrink-0 text-rose-300" aria-hidden />
                      )}
                      <span>
                        <strong className={ok ? 'text-emerald-300' : 'text-rose-300'}>{ok ? UZ.correct : UZ.incorrect}</strong> {p.why}
                      </span>
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StepPoint({ data, setData, tasks, reduce }) {
  const [boxRef, w] = useElementWidth(640);
  const H = w < 520 ? 300 : 380;
  const [z, setZ] = useState(0);
  const [busT, setBusT] = useState(reduce ? 6 : 0);
  const tween = useRef(null);
  const [tweening, setTweening] = useState(false);

  const Wm = W_MIN * (W_MAX / W_MIN) ** z;
  const streetVisible = Math.log10(Wm) < 2.8;

  useAnimationFrame((dt) => setBusT((b) => (b + dt) % BUS_LOOP), streetVisible && !reduce);
  useAnimationFrame((_dt, now) => {
    const tw = tween.current;
    if (!tw) return;
    if (tw.start == null) tw.start = now;
    const p = clamp01((now - tw.start) / 1100);
    setZ(lerp(tw.from, tw.to, ease(p)));
    if (p >= 1) {
      tween.current = null;
      setTweening(false);
    }
  }, tweening);

  useEffect(() => {
    if (z >= 0.95 && !data.zoomedOut) setData((d) => ({ ...d, zoomedOut: true }));
  }, [z, data.zoomedOut, setData]);

  const goPreset = (target) => {
    if (reduce) {
      tween.current = null;
      setTweening(false);
      setZ(target);
      return;
    }
    tween.current = { from: z, to: target, start: null };
    setTweening(true);
  };
  const onSlide = (v) => {
    tween.current = null;
    setTweening(false);
    setZ(v / 1000);
  };

  const pct = (100 * BUS_L) / Wm;
  const verdict = pct >= 5 ? 'no' : pct >= 0.05 ? 'depends' : 'yes';
  const vMeta = {
    no: { tone: 'rose', Icon: CircleX },
    depends: { tone: 'amber', Icon: Lightbulb },
    yes: { tone: 'emerald', Icon: CircleCheck },
  }[verdict];
  const meter = clamp01((2 - Math.log10(pct)) / 5);
  const scaleName = z < 0.25 ? 'street' : z < 0.75 ? 'city' : 'country';
  const ScaleIcon = { street: Bus, city: MapPin, country: Route }[scaleName];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div ref={boxRef} className={STAGE} style={{ height: H }}>
            <PointScene w={w} H={H} z={z} busT={busT} />
            <div className={`${CHIP} left-3 top-3`}>
              <ScaleIcon size={13} className="text-cyan-300" aria-hidden />
              {UZ.s1.presets[scaleName]}
            </div>
            <div className={`${CHIP} right-3 top-3 tabular-nums`}>
              {UZ.s1.frame}: {fmtDist(Wm)}
            </div>
            <div className={`${CHIP} bottom-3 right-3 hidden text-gray-400 sm:flex`}>{UZ.s1.topView}</div>
          </div>
          <div className={`${PANEL} p-3 sm:p-4`}>
            <div className="flex items-center gap-3">
              <ZoomIn size={18} className="shrink-0 text-cyan-300" aria-hidden />
              <Range
                value={Math.round(z * 1000)}
                min={0}
                max={1000}
                step={1}
                onChange={onSlide}
                label={UZ.s1.zoomLabel}
                valueText={UZ.s1.zoomValue(fmtDist(Wm))}
              />
              <ZoomOut size={18} className="shrink-0 text-cyan-300" aria-hidden />
            </div>
            <div className="mt-2">
              <Segmented
                label={UZ.s1.presetsLabel}
                value={scaleName}
                onChange={(pid) => goPreset(PRESETS.find((p) => p.id === pid).z)}
                options={PRESETS.map((p) => ({ id: p.id, label: UZ.s1.presets[p.id], Icon: { street: Bus, city: MapPin, country: Route }[p.id] }))}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Explain tone={vMeta.tone} icon={vMeta.Icon} title={UZ.s1.verdicts[verdict].badge}>
            {UZ.s1.verdicts[verdict].text}
          </Explain>
          <div className={`${PANEL} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s1.ratioTitle}</p>
            <p className="mt-1.5 text-sm tabular-nums text-gray-200">{UZ.s1.ratio(fmtPct(pct))}</p>
            <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-rose-500/80 via-amber-400/80 to-emerald-400/80" aria-hidden>
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#07060f] shadow"
                style={{ left: `${meter * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-gray-500" aria-hidden>
              <span>{UZ.s1.ratioMin}</span>
              <span>{UZ.s1.ratioMax}</span>
            </div>
          </div>
          <p className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.06] px-4 py-3 text-sm leading-relaxed text-violet-100">{UZ.s1.rule}</p>
          <TaskList items={tasks} />
        </div>
      </div>
      <PointPrompts answers={data.answers} onAnswer={(pid, opt) => setData((d) => ({ ...d, answers: { ...d.answers, [pid]: opt } }))} />
    </div>
  );
}

/* =================================================== step 2: frame of reference */

const VT = 4; // train, m/s relative to the ground
const VC = 6; // cyclist, m/s relative to the ground
const U0 = 5; // ball thrown straight up in the train, m/s
const GRAV = 9.8;
const TF = (2 * U0) / GRAV; // flight time, s
const HAND = 2.2; // hand height above the rails, m
const SLOWMO = 0.5;
const HOLD0 = 0.45;
const HOLD1 = 1.1;
const FRAMES = [
  { id: 'earth', v: 0, color: '#34d399', Icon: Earth },
  { id: 'train', v: VT, color: '#a78bfa', Icon: TrainFront },
  { id: 'bike', v: VC, color: '#fbbf24', Icon: Bike },
];

function trajectoryPoints(vx, upTo, map, n = 36) {
  const out = [];
  for (let i = 0; i <= n; i += 1) {
    const t = (upTo * i) / n;
    const [x, y] = map(vx * t, U0 * t - (GRAV * t * t) / 2);
    out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return out.join(' ');
}

function FramesScene({ w, k, Y0, H, oX, frame, tc, inFlight }) {
  const id = useSvgId();
  const vF = frame.v;
  const shift = vF * tc;
  const sx = (xE) => oX + (xE - shift) * k;
  const sy = (y) => Y0 - y * k;
  const oY = sy(HAND);
  const xT = VT * tc;
  const xC = VC * tc;
  const lo = shift - oX / k - 3;
  const hi = shift + (w - oX) / k + 3;
  const every = (step, offset = 0) => {
    const out = [];
    for (let i = Math.floor((lo - offset) / step); i <= Math.ceil((hi - offset) / step); i += 1) out.push(i * step + offset);
    return out;
  };
  const rectPath = (x, y, wm, hm) => `M${sx(x)},${sy(y + hm)}h${wm * k}v${hm * k}h${-wm * k}Z`;
  const windows = (x0) => [0, 1, 2, 3, 4].map((j) => rectPath(x0 + 1.1 + j * 2.3, 2.15, 1.3, 0.8)).join('');
  const cy0 = -0.9; // the cyclist's road runs in front of (below) the track
  const color = frame.color;
  const vxF = VT - vF;
  const ballX = vxF * tc;
  const ballY = U0 * tc - (GRAV * tc * tc) / 2;
  const vy = inFlight ? U0 - GRAV * tc : 0;
  const ballR = Math.max(6, 0.13 * k);
  const toScreen = (fx, fy) => [oX + fx * k, oY - fy * k];
  const spokes = (cxm, cym, r, dist) => {
    const a = dist / r;
    return [0, Math.PI / 2].map((off) => {
      const ca = Math.cos(a + off) * r * k;
      const sa = Math.sin(a + off) * r * k;
      return (
        <line key={off} x1={sx(cxm) - ca} y1={sy(cym) + sa} x2={sx(cxm) + ca} y2={sy(cym) - sa} stroke="#8c84b0" strokeWidth="1.2" />
      );
    });
  };
  const xTicks = [];
  const tickStep = w < 520 ? 2 : 1;
  for (let n = Math.ceil((14 - oX) / k); n <= Math.floor((w - 34 - oX) / k); n += 1) if (n % tickStep === 0 && n !== 0) xTicks.push(n);
  const dots = [];
  for (let t = 0; t <= tc + 1e-9; t += 0.1) dots.push(toScreen(vxF * t, U0 * t - (GRAV * t * t) / 2));

  const car = (i) => {
    const x0 = xT - 6.2 + i * 13.2;
    const x1 = x0 + 12.5;
    const main = i === 0;
    return (
      <g key={`car${i}`}>
        <path d={rectPath(x0, 0.6, 12.5, 3.3) + windows(x0)} fillRule="evenodd" fill="#2c2650" stroke="#4b4378" strokeWidth="1" />
        <rect x={sx(x0)} y={sy(4.02)} width={12.5 * k} height={0.14 * k} rx={0.07 * k} fill="#4b4378" />
        {main && (
          <>
            <path d={rectPath(x0 + 0.5, 1.1, 11.5, 2.5) + windows(x0)} fillRule="evenodd" fill="#15122a" stroke="#6d5fae" strokeOpacity="0.6" strokeWidth="1" />
            {[0, 1, 2, 3, 4].map((j) => (
              <rect key={j} x={sx(x0 + 1.15 + j * 2.3)} y={sy(1.6)} width={1.2 * k} height={0.5 * k} rx={0.08 * k} fill="#2a2448" />
            ))}
            <rect x={sx(x0 + 0.5)} y={sy(1.1)} width={11.5 * k} height={0.1 * k} fill="#5b4f96" />
            <text x={sx(xT + 1.4)} y={sy(0.72)} fill="#a59bd8" fontSize={Math.max(9, 0.24 * k)} fontWeight="700" letterSpacing="2">
              {UZ.s2.trainLabel}
            </text>
          </>
        )}
        {[x0 + 2.4, x1 - 2.4].map((b) => (
          <g key={b}>
            <rect x={sx(b - 1.5)} y={sy(0.72)} width={3 * k} height={0.22 * k} rx={0.08 * k} fill="#1f1b38" />
            {[b - 0.9, b + 0.9].map((wx) => (
              <g key={wx}>
                <circle cx={sx(wx)} cy={sy(0.42)} r={0.42 * k} fill="#1a1730" stroke="#6b6390" strokeWidth="1.5" />
                {spokes(wx, 0.42, 0.42, xT)}
              </g>
            ))}
          </g>
        ))}
      </g>
    );
  };

  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="absolute inset-0 block" role="img" aria-label={UZ.s2.scene(UZ.s2.frames[frame.id].name)}>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c0a1f" />
          <stop offset="100%" stopColor="#1a1638" />
        </linearGradient>
        <radialGradient id={`${id}halo`}>
          <stop offset="0%" stopColor={FRAMES[2].color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={FRAMES[2].color} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <marker id={`${id}arrowAxis`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
        <marker id={`${id}arrowV`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#f0f9ff" />
        </marker>
      </defs>
      <rect width={w} height={H} fill={`url(#${id}sky)`} />

      {/* far side: trees and catenary poles (seen above the roof and through the windows) */}
      {every(11, 5).map((x) => (
        <g key={`tree${x}`}>
          <line x1={sx(x)} x2={sx(x)} y1={sy(0)} y2={sy(2.4)} stroke="#3b2f2a" strokeWidth={0.16 * k} />
          <circle cx={sx(x)} cy={sy(2.95)} r={0.85 * k} fill="#143826" />
          <circle cx={sx(x - 0.25)} cy={sy(3.15)} r={0.45 * k} fill="#1d5238" />
        </g>
      ))}
      {every(7, 3.2).map((x) => (
        <g key={`pole${x}`}>
          <line x1={sx(x)} x2={sx(x)} y1={sy(0)} y2={0} stroke="#4b4470" strokeWidth={Math.max(2, 0.1 * k)} />
          <line x1={sx(x)} x2={sx(x) + 0.9 * k} y1={sy(4.55)} y2={sy(4.55)} stroke="#4b4470" strokeWidth="2" />
        </g>
      ))}
      <line x1="0" x2={w} y1={sy(4.5)} y2={sy(4.5)} stroke="#4b4470" strokeWidth="1" />

      {/* ground: ballast and rail, a verge with km posts, the near road */}
      <rect x="0" y={sy(0)} width={w} height={H - sy(0)} fill="#0f0d1a" />
      <rect x="0" y={sy(0)} width={w} height={0.3 * k} fill="#241f36" />
      {every(0.9).map((x) => (
        <rect key={`sl${x.toFixed(2)}`} x={sx(x) - 0.11 * k} y={sy(0.02)} width={0.22 * k} height={0.13 * k} fill="#4a4260" />
      ))}
      <line x1="0" x2={w} y1={sy(0.04)} y2={sy(0.04)} stroke="#8c84b0" strokeWidth="2" />
      {every(8, -2).map((x) => (
        <g key={`post${x}`}>
          <rect x={sx(x) - 0.07 * k} y={sy(-0.5)} width={0.14 * k} height={0.42 * k} fill="#d1d5db" />
          <rect x={sx(x) - 0.07 * k} y={sy(-0.5)} width={0.14 * k} height={0.1 * k} fill="#f43f5e" />
        </g>
      ))}
      <rect x="0" y={sy(-1.15)} width={w} height={H - sy(-1.15)} fill="#191628" />
      <line x1="0" x2={w} y1={sy(-1.15)} y2={sy(-1.15)} stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5" />
      {every(3).map((x) => (
        <line key={`rd${x}`} x1={sx(x)} x2={sx(x + 1.5)} y1={sy(-2.36)} y2={sy(-2.36)} stroke="#fff" strokeOpacity="0.18" strokeWidth="2" />
      ))}
      {frame.id === 'earth' && (
        <>
          <rect x="0" y={sy(0)} width={w} height={H - sy(0)} fill={color} opacity="0.06" />
          <line x1="0" x2={w} y1={sy(0)} y2={sy(0)} stroke={color} strokeWidth="2.5" opacity="0.75" filter={`url(#${id}glow)`} />
          <circle cx={sx(0)} cy={sy(0.04)} r="4.5" fill={color} stroke="#07060f" strokeWidth="1.5" />
        </>
      )}

      {/* the train, the thrower */}
      {[-1, 1, 0].map((i) => car(i))}
      {frame.id === 'train' && (
        <rect
          x={sx(xT - 6.2)}
          y={sy(3.9)}
          width={12.5 * k}
          height={3.3 * k}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          rx="3"
          opacity="0.9"
          filter={`url(#${id}glow)`}
        />
      )}
      <g stroke="#ede9fe" strokeWidth={Math.max(2.5, 0.12 * k)} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline points={`${sx(xT - 0.48)},${sy(1.12)} ${sx(xT - 0.36)},${sy(1.9)} ${sx(xT - 0.2)},${sy(1.12)}`} />
        <line x1={sx(xT - 0.36)} y1={sy(1.9)} x2={sx(xT - 0.36)} y2={sy(2.5)} />
        <polyline points={`${sx(xT - 0.36)},${sy(2.45)} ${sx(xT - 0.16)},${sy(2.15)} ${sx(xT)},${sy(HAND)}`} />
        <polyline points={`${sx(xT - 0.36)},${sy(2.45)} ${sx(xT - 0.55)},${sy(2.0)}`} />
      </g>
      <circle cx={sx(xT - 0.36)} cy={sy(2.72)} r={0.19 * k} fill="#ede9fe" />

      {/* the cyclist on the near road */}
      {frame.id === 'bike' && <circle cx={sx(xC)} cy={sy(cy0 - 0.4)} r={1.3 * k} fill={`url(#${id}halo)`} />}
      <g stroke="#fcd34d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx={sx(xC - 0.5)} cy={sy(cy0 - 1.0)} r={0.33 * k} stroke="#a8a29e" />
        <circle cx={sx(xC + 0.5)} cy={sy(cy0 - 1.0)} r={0.33 * k} stroke="#a8a29e" />
        <polyline
          points={[
            [xC - 0.5, -1.0],
            [xC - 0.02, -0.98],
            [xC + 0.5, -1.0],
            [xC + 0.36, -0.4],
            [xC - 0.2, -0.45],
            [xC - 0.02, -0.98],
          ]
            .map(([x, y]) => `${sx(x)},${sy(cy0 + y)}`)
            .join(' ')}
        />
      </g>
      {spokes(xC - 0.5, cy0 - 1.0, 0.33, xC)}
      {spokes(xC + 0.5, cy0 - 1.0, 0.33, xC)}
      <g stroke="#fde68a" strokeWidth={Math.max(2.5, 0.11 * k)} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <polyline points={`${sx(xC - 0.22)},${sy(cy0 - 0.4)} ${sx(xC + 0.06)},${sy(cy0 + 0.22)} ${sx(xC + 0.36)},${sy(cy0 - 0.36)}`} />
        <polyline points={`${sx(xC - 0.22)},${sy(cy0 - 0.4)} ${sx(xC + 0.14)},${sy(cy0 - 0.62)} ${sx(xC - 0.02)},${sy(cy0 - 0.98)}`} />
      </g>
      <circle cx={sx(xC + 0.12)} cy={sy(cy0 + 0.43)} r={0.16 * k} fill="#fde68a" />
      <text x={sx(xC - 0.95)} y={sy(cy0 - 1.0) + 4} textAnchor="end" className="vgs-t" fill="#fde68a" fontSize="11" fontWeight="600">
        {UZ.s2.bikeLabel}
      </text>

      {/* the frame: axes fixed to the chosen body */}
      {frame.id !== 'train' && (
        <line
          x1={oX}
          x2={oX}
          y1={frame.id === 'bike' ? sy(cy0 + 0.62) : sy(0.04) - 4}
          y2={oY}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="3 4"
          opacity="0.75"
        />
      )}
      <g opacity="0.95">
        <line x1="10" x2={w - 12} y1={oY} y2={oY} stroke={color} strokeWidth="1.6" markerEnd={`url(#${id}arrowAxis)`} />
        <line x1={oX} x2={oX} y1={oY + 0.35 * k} y2={oY - 1.75 * k} stroke={color} strokeWidth="1.6" markerEnd={`url(#${id}arrowAxis)`} />
        {xTicks.map((n) => (
          <g key={`xt${n}`}>
            <line x1={oX + n * k} x2={oX + n * k} y1={oY - 4} y2={oY + 4} stroke={color} strokeWidth="1.4" />
            <text x={oX + n * k} y={oY + 16} textAnchor="middle" className="vgs-t" fill={color} fontSize="10.5" fontWeight="600">
              {fmt(n)}
            </text>
          </g>
        ))}
        {[0.5, 1, 1.5].map((n) => (
          <g key={`yt${n}`}>
            <line x1={oX - 4} x2={oX + 4} y1={oY - n * k} y2={oY - n * k} stroke={color} strokeWidth="1.4" />
            <text x={vxF < 0 ? oX + 7 : oX - 7} y={oY - n * k + 4} textAnchor={vxF < 0 ? 'start' : 'end'} className="vgs-t" fill={color} fontSize="10.5" fontWeight="600">
              {fmt(n, n % 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        <text x={w - 14} y={oY - 8} textAnchor="end" className="vgs-t" fill={color} fontSize="11" fontWeight="700">
          x, m
        </text>
        <text x={vxF < 0 ? oX + 30 : oX + 9} y={oY - 1.62 * k} className="vgs-t" fill={color} fontSize="11" fontWeight="700">
          y, m
        </text>
        <text x={oX - 7} y={oY + 16} textAnchor="end" className="vgs-t" fill={color} fontSize="11" fontWeight="700">
          O
        </text>
      </g>

      {/* trajectory in this frame, a stroboscope dot every 0.1 s */}
      <polyline points={trajectoryPoints(vxF, tc, toScreen)} fill="none" stroke="#22d3ee" strokeOpacity="0.55" strokeWidth="2" />
      {dots.map(([x, y], i) => (
        <circle key={`d${i}`} cx={x} cy={y} r="2.6" fill="#67e8f9" opacity="0.8" />
      ))}

      {/* the ball and its velocity in this frame */}
      {(() => {
        const [bx, by] = toScreen(ballX, ballY);
        const vs = 0.22 * k;
        const showV = inFlight && Math.hypot(vxF, vy) > 0.3;
        return (
          <g>
            {showV && (
              <>
                <line x1={bx} y1={by} x2={bx + vxF * vs} y2={by - vy * vs} stroke="#f0f9ff" strokeWidth="2" markerEnd={`url(#${id}arrowV)`} />
                <text x={bx + vxF * vs + 6} y={by - vy * vs - 4} className="vgs-t" fill="#f0f9ff" fontSize="12" fontWeight="700" fontStyle="italic">
                  v
                </text>
              </>
            )}
            <circle cx={bx} cy={by} r={ballR + 4} fill="#22d3ee" opacity="0.2" />
            <circle cx={bx} cy={by} r={ballR} fill="#22d3ee" stroke="#ecfeff" strokeWidth="1.5" />
            <circle cx={bx - ballR * 0.3} cy={by - ballR * 0.3} r={ballR * 0.3} fill="#ecfeff" opacity="0.8" />
          </g>
        );
      })()}
    </svg>
  );
}

function MiniTrajectory({ frame, active }) {
  const vx = VT - frame.v;
  const map = (x, y) => [10 + ((x + 2.6) / 7.2) * 100, 46 - (y / 1.4) * 36];
  const [ox, oy] = map(0, 0);
  return (
    <svg viewBox="0 0 120 54" className="h-14 w-full" aria-hidden>
      <line x1="4" x2="116" y1={oy} y2={oy} stroke="#ffffff" strokeOpacity="0.15" />
      <line x1={ox} x2={ox} y1={oy} y2="6" stroke="#ffffff" strokeOpacity="0.15" />
      <polyline points={trajectoryPoints(vx, TF, map, 30)} fill="none" stroke={frame.color} strokeWidth={active ? 2.5 : 2} strokeOpacity={active ? 1 : 0.7} strokeLinecap="round" />
      <circle cx={ox} cy={oy} r="2.5" fill={frame.color} />
    </svg>
  );
}

function StepFrames({ data, setData, tasks, reduce }) {
  const [boxRef, w] = useElementWidth(640);
  const narrow = w < 520;
  const k = w / (narrow ? 8.6 : 12);
  const Y0 = Math.round(46 + 4.05 * k);
  const H = Math.round(Y0 + 2.5 * k + 2);
  const oX = w * (narrow ? 0.34 : 0.36);
  const [frameId, setFrameId] = useState('earth');
  const [playing, setPlaying] = useState(!reduce);
  const [ts, setTs] = useState(reduce ? TF + 0.01 : -HOLD0);

  useAnimationFrame(
    (dt) =>
      setTs((p) => {
        const n = p + dt * SLOWMO;
        return n > TF + HOLD1 ? -HOLD0 : n;
      }),
    playing,
  );

  const frame = FRAMES.find((f) => f.id === frameId);
  const tc = clamp(ts, 0, TF);
  const inFlight = ts > 0 && ts < TF;
  const vx = VT - frame.v;
  const bx = vx * tc;
  const by = U0 * tc - (GRAV * tc * tc) / 2;
  const vy = inFlight ? U0 - GRAV * tc : 0;

  const pick = (fid) => {
    setFrameId(fid);
    setData((d) => (d.visited.includes(fid) ? d : { ...d, visited: [...d.visited, fid] }));
  };
  const rethrow = () => {
    setTs(-0.15);
    setPlaying(true);
  };

  const bodies = [
    { id: 'earth', v: -frame.v, Icon: Earth },
    { id: 'train', v: VT - frame.v, Icon: TrainFront },
    { id: 'bike', v: VC - frame.v, Icon: Bike },
  ];
  const readouts = [
    { key: 'x', label: 'x', value: fmt(bx, 2), unit: 'm' },
    { key: 'y', label: 'y', value: fmt(by, 2), unit: 'm' },
    {
      key: 'vx',
      label: (
        <>
          v<sub className="text-[10px]">x</sub>
        </>
      ),
      value: fmt(vx, 1),
      unit: 'm/s',
    },
    {
      key: 'vy',
      label: (
        <>
          v<sub className="text-[10px]">y</sub>
        </>
      ),
      value: fmt(vy, 1),
      unit: 'm/s',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s2.pick}</p>
            <Segmented
              label={UZ.s2.pick}
              value={frameId}
              onChange={pick}
              options={FRAMES.map((f) => ({ id: f.id, label: UZ.s2.frames[f.id].name, Icon: f.Icon, color: f.color }))}
            />
          </div>
          <div ref={boxRef} className={STAGE} style={{ height: H }}>
            <FramesScene w={w} k={k} Y0={Y0} H={H} oX={oX} frame={frame} tc={tc} inFlight={inFlight} />
            <div className={`${CHIP} left-3 top-3`} style={{ borderColor: `${frame.color}66` }}>
              <Anchor size={13} style={{ color: frame.color }} aria-hidden />
              <span>{UZ.s2.frames[frameId].name}</span>
              <span className="text-gray-500">·</span>
              <Clock size={13} style={{ color: frame.color }} aria-hidden />
              <span className="tabular-nums">t = {fmt(tc, 2)} s</span>
            </div>
            <div className={`${CHIP} right-3 top-3 text-gray-400`}>{UZ.s2.slow}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={BTN_ICON} onClick={() => setPlaying((p) => !p)} aria-label={playing ? UZ.pause : UZ.play}>
              {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            </button>
            <button type="button" className={BTN_GHOST} onClick={rethrow}>
              <RotateCcw size={16} aria-hidden /> {UZ.s2.rethrow}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <Explain tone="violet" icon={frame.Icon} title={`${UZ.s2.frames[frameId].name}: ${UZ.s2.frames[frameId].shape.toLowerCase()}`}>
            {UZ.s2.frames[frameId].text}
          </Explain>
          <div className={`${PANEL} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s2.readouts}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {readouts.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1.5">
                  <dt className="text-sm italic text-gray-400">{r.label}</dt>
                  <dd className="text-base font-bold tabular-nums text-white">
                    {r.value} <span className="text-xs font-medium text-gray-400">{r.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className={`${PANEL} p-4`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {UZ.s2.who} <span className="normal-case tracking-normal text-gray-500">({UZ.s2.whoNote})</span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {bodies.map((b) => {
                const isRef = b.id === frameId;
                const f = FRAMES.find((ff) => ff.id === b.id);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 text-gray-200">
                      <b.Icon size={16} style={{ color: f.color }} aria-hidden />
                      {UZ.s2.frames[b.id].name}
                      {isRef && (
                        <span className="rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wide" style={{ color: f.color, background: `${f.color}1f` }}>
                          {UZ.s2.refBody}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 font-semibold tabular-nums text-white">
                      {Math.abs(b.v) < 1e-9 ? (
                        <span className="text-gray-400">{UZ.s2.rest}</span>
                      ) : (
                        <>
                          {b.v > 0 ? <ArrowRight size={15} className="text-gray-400" aria-hidden /> : <ArrowLeft size={15} className="text-gray-400" aria-hidden />}
                          {fmt(Math.abs(b.v))} m/s
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <TaskList items={tasks} />
        </div>
      </div>

      <section className={`${PANEL} p-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="md:w-64 md:shrink-0">
            <h4 className="text-sm font-semibold text-white">{UZ.s2.compareTitle}</h4>
            <p className="mt-1 text-[13px] leading-snug text-gray-400">{UZ.s2.key}</p>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            {FRAMES.map((f) => {
              const active = f.id === frameId;
              const seen = data.visited.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(f.id)}
                  aria-pressed={active}
                  className={`relative rounded-xl border p-2 text-left transition-colors ${FOCUS} ${active ? 'bg-white/[0.07]' : 'border-white/10 hover:bg-white/5'}`}
                  style={active ? { borderColor: `${f.color}99` } : undefined}
                >
                  <MiniTrajectory frame={f} active={active} />
                  <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-100">
                    <f.Icon size={13} style={{ color: f.color }} aria-hidden className="hidden shrink-0 sm:block" />
                    <span className="break-words">{UZ.s2.frames[f.id].name}</span>
                  </span>
                  <span className="block text-[11px] leading-tight text-gray-400">{seen ? UZ.s2.frames[f.id].shape : '?'}</span>
                  {seen && (
                    <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-slate-950">
                      <Check size={10} strokeWidth={3.5} aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ============================================ step 3: path versus displacement */

const LAP_L = 84.39; // straight, m
const LAP_R = 36.8; // radius of the lane-1 measuring line, m
const LAP = 2 * LAP_L + 2 * Math.PI * LAP_R; // 400.0 m
const ARC = Math.PI * LAP_R;
const RUN_T = 80; // s at 5 m/s
const SPEEDUP = 8;
const LINE_LEN = 200;
const TRACK_OUT = 7.4; // lane-1 line to the outer edge, m
const OVAL_HALF_W = LAP_L / 2 + LAP_R + TRACK_OUT;
const OVAL_HALF_H = LAP_R + TRACK_OUT;

/** Point on the lane-1 line, s metres after the finish line, running anticlockwise. */
function ovalPoint(s) {
  let r = clamp(s, 0, LAP);
  if (r >= LAP) r = 0;
  if (r < ARC) {
    const th = Math.PI / 2 - r / LAP_R;
    return [LAP_L / 2 + LAP_R * Math.cos(th), LAP_R * Math.sin(th)];
  }
  r -= ARC;
  if (r < LAP_L) return [LAP_L / 2 - r, -LAP_R];
  r -= LAP_L;
  if (r < ARC) {
    const th = -Math.PI / 2 - r / LAP_R;
    return [-LAP_L / 2 + LAP_R * Math.cos(th), LAP_R * Math.sin(th)];
  }
  r -= ARC;
  return [-LAP_L / 2 + r, LAP_R];
}

function ovalNearest(x, y) {
  if (x > LAP_L / 2) return clamp(LAP_R * (Math.PI / 2 - Math.atan2(y, x - LAP_L / 2)), 0, ARC);
  if (x < -LAP_L / 2) {
    let th = Math.atan2(y, x + LAP_L / 2);
    if (th > 0) th -= 2 * Math.PI;
    return ARC + LAP_L + clamp(LAP_R * (-Math.PI / 2 - th), 0, ARC);
  }
  if (y < 0) return ARC + (LAP_L / 2 - x);
  return 2 * ARC + LAP_L + (x + LAP_L / 2);
}

const P_START = ovalPoint(0);
const ovalDisp = (s) => {
  const [x, y] = ovalPoint(s);
  return Math.hypot(x - P_START[0], y - P_START[1]);
};
const ROUTES = {
  oval: { pathAt: (t) => (LAP * t) / RUN_T, dispAt: (t) => ovalDisp((LAP * t) / RUN_T) },
  line: {
    pathAt: (t) => 5 * t,
    dispAt: (t) => {
      const s = 5 * t;
      return s <= LINE_LEN ? s : 2 * LINE_LEN - s;
    },
  },
};
const SAMPLES = Object.fromEntries(
  Object.entries(ROUTES).map(([key, r]) => [key, Array.from({ length: 161 }, (_, i) => [i / 2, r.pathAt(i / 2), r.dispAt(i / 2)])]),
);
const OVAL_MAX = (() => {
  let best = { d: 0, s: 0 };
  for (let s = 0; s <= LAP; s += 0.25) {
    const d = ovalDisp(s);
    if (d > best.d) best = { d, s };
  }
  return best;
})();

function phaseOf(route, t) {
  const r = ROUTES[route];
  const s = r.pathAt(t);
  if (s < 0.5) return 'start';
  if (t >= RUN_T - 1e-6) return route === 'oval' ? 'ovalEnd' : 'lineEnd';
  if (route === 'line') {
    if (Math.abs(s - LINE_LEN) < 3) return 'lineTurn';
    return s < LINE_LEN ? 'lineOut' : 'lineBack';
  }
  if (Math.abs(s - OVAL_MAX.s) < 14) return 'ovalFar';
  return s > OVAL_MAX.s ? 'ovalShrink' : 'ovalGrow';
}

function TrackScene({ route, t, w, H, k, onScrubStart, onScrubMove, onScrubEnd, playing }) {
  const id = useSvgId();
  const cxS = w / 2;
  const cyS = 22 + OVAL_HALF_H * k;
  const SX = (x) => cxS + x * k;
  const SY = (y) => cyS + y * k;
  const s = ROUTES[route].pathAt(t);
  const d = ROUTES[route].dispAt(t);

  const stadium = (r) => {
    const a = SX(LAP_L / 2);
    const b = SX(-LAP_L / 2);
    const top = SY(-r);
    const bot = SY(r);
    const rr = r * k;
    return `M${a},${bot} A${rr},${rr} 0 0 0 ${a},${top} L${b},${top} A${rr},${rr} 0 0 0 ${b},${bot} Z`;
  };

  // Line route geometry (screen px).
  const lx0 = 30;
  const kL = (w - 60) / LINE_LEN;
  const LX = (m) => lx0 + m * kL;
  const ly = H / 2 + 6;

  let runner;
  let start;
  let trace;
  if (route === 'oval') {
    const [rx, ry] = ovalPoint(s);
    runner = [SX(rx), SY(ry)];
    start = [SX(P_START[0]), SY(P_START[1])];
    const n = Math.max(2, Math.ceil(s / 2));
    const p = [];
    for (let i = 0; i <= n; i += 1) {
      const [x, y] = ovalPoint(Math.min(s, (s * i) / n) - (i === n && s >= LAP ? 1e-6 : 0));
      p.push(`${SX(x).toFixed(1)},${SY(y).toFixed(1)}`);
    }
    if (s >= LAP - 1e-6) p.push(`${start[0].toFixed(1)},${start[1].toFixed(1)}`);
    trace = <polyline points={p.join(' ')} fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />;
  } else {
    const out = Math.min(s, LINE_LEN);
    const back = s > LINE_LEN ? 2 * LINE_LEN - s : null;
    runner = back == null ? [LX(out), ly - 5] : [LX(back), ly + 5];
    start = [LX(0), ly];
    trace = (
      <g fill="none" stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
        <line x1={LX(0)} x2={LX(out)} y1={ly - 5} y2={ly - 5} />
        {back != null && (
          <>
            <path d={`M${LX(LINE_LEN)},${ly - 5} A5,5 0 0 1 ${LX(LINE_LEN)},${ly + 5}`} />
            <line x1={LX(LINE_LEN)} x2={LX(back)} y1={ly + 5} y2={ly + 5} />
          </>
        )}
      </g>
    );
  }

  const toLocal = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const hit = (e) => {
    const [px, py] = toLocal(e);
    if (route === 'oval') {
      const sN = ovalNearest((px - cxS) / k, (py - cyS) / k);
      const [qx, qy] = ovalPoint(sN);
      if (Math.hypot(SX(qx) - px, SY(qy) - py) > 36) return null;
      return { kind: 'oval', s: sN };
    }
    if (Math.abs(py - ly) > 44) return null;
    return { kind: 'line', m: clamp((px - lx0) / kL, 0, LINE_LEN), lower: py > ly };
  };

  const ticks =
    route === 'oval'
      ? [100, 200, 300].map((m) => {
          const [x, y] = ovalPoint(m);
          const [x1, y1] = ovalPoint(m + 0.5);
          const [x0, y0] = ovalPoint(m - 0.5);
          const tx = x1 - x0;
          const ty = y1 - y0;
          const tl = Math.hypot(tx, ty);
          const nx = -ty / tl;
          const ny = tx / tl;
          // Labels sit on the grass, just inside the curb, so the corners stay free.
          const off = -(0.3 * k + 10);
          const lx = SX(x) + nx * off;
          const lyy = SY(y) + ny * off;
          return {
            m,
            a: [SX(x) - nx * 0.3 * k, SY(y) - ny * 0.3 * k],
            b: [SX(x) + nx * TRACK_OUT * k, SY(y) + ny * TRACK_OUT * k],
            l: [lx, lyy + 4],
            anchor: nx > 0.3 ? 'end' : nx < -0.3 ? 'start' : 'middle',
          };
        })
      : [];

  // Displacement arrow + label.
  let disp = null;
  if (d > 0.8) {
    if (route === 'oval') {
      const [ax, ay] = start;
      const [bx, by] = runner;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const side = ny > 0 ? -1 : 1;
      disp = (
        <g>
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#22d3ee" strokeWidth="2.6" markerEnd={`url(#${id}arr)`} />
          {len > 40 && (
            <text x={mx + nx * 14 * side} y={my + ny * 14 * side + 4} textAnchor="middle" className="vgs-t" fill="#a5f3fc" fontSize="12" fontWeight="700">
              {fmt(d)} m
            </text>
          )}
        </g>
      );
    } else {
      const yA = ly - 34;
      disp = (
        <g>
          <line x1={LX(0)} y1={yA} x2={LX(d)} y2={yA} stroke="#22d3ee" strokeWidth="2.6" markerEnd={`url(#${id}arr)`} />
          {d * kL > 40 && (
            <text x={LX(d / 2)} y={yA - 8} textAnchor="middle" className="vgs-t" fill="#a5f3fc" fontSize="12" fontWeight="700">
              {fmt(d)} m
            </text>
          )}
        </g>
      );
    }
  }

  return (
    <svg
      width={w}
      height={H}
      viewBox={`0 0 ${w} ${H}`}
      className="absolute inset-0 block select-none"
      role="img"
      aria-label={UZ.s3.scene(UZ.s3.routeShort[route])}
      onPointerDown={(e) => {
        const h = hit(e);
        if (!h) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onScrubStart(h);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
        const [px, py] = toLocal(e);
        if (route === 'oval') onScrubMove({ kind: 'oval', s: ovalNearest((px - cxS) / k, (py - cyS) / k) });
        else onScrubMove({ kind: 'line', m: clamp((px - lx0) / kL, 0, LINE_LEN), lower: py > ly });
      }}
      onPointerUp={onScrubEnd}
      onPointerCancel={onScrubEnd}
    >
      <defs>
        <radialGradient id={`${id}bg`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#11101f" />
          <stop offset="100%" stopColor="#07060f" />
        </radialGradient>
        <marker id={`${id}arr`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#22d3ee" />
        </marker>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      <rect width={w} height={H} fill={`url(#${id}bg)`} />

      {route === 'oval' ? (
        <g>
          <path d={stadium(LAP_R - 0.3)} fill="#0e2a1d" />
          <g fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="1">
            <rect x={SX(-50)} y={SY(-32)} width={100 * k} height={64 * k} />
            <line x1={SX(0)} x2={SX(0)} y1={SY(-32)} y2={SY(32)} />
            <circle cx={SX(0)} cy={SY(0)} r={9.15 * k} />
            <rect x={SX(-50)} y={SY(-20.15)} width={16.5 * k} height={40.3 * k} />
            <rect x={SX(33.5)} y={SY(-20.15)} width={16.5 * k} height={40.3 * k} />
          </g>
          <path d={stadium(LAP_R - 0.3 + 7.32) + stadium(LAP_R - 0.3)} fillRule="evenodd" fill="#7c2d12" fillOpacity="0.62" />
          {[1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={stadium(LAP_R - 0.3 + i * 1.22)} fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1" />
          ))}
          <path d={stadium(LAP_R)} fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" strokeDasharray="3 5" />
          <line x1={SX(LAP_L / 2)} x2={SX(LAP_L / 2)} y1={SY(LAP_R - 0.3)} y2={SY(LAP_R - 0.3 + 7.32)} stroke="#fff" strokeWidth="2.5" />
          <text x={SX(LAP_L / 2) - 8} y={SY(LAP_R - 0.3) - 8} textAnchor="end" className="vgs-t" fill="#e5e7eb" fontSize="10.5" fontWeight="700" letterSpacing="1.5">
            {UZ.s3.start}
          </text>
          {ticks.map((tk) => (
            <g key={tk.m}>
              <line x1={tk.a[0]} y1={tk.a[1]} x2={tk.b[0]} y2={tk.b[1]} stroke="#fff" strokeOpacity="0.45" strokeWidth="1.5" />
              <text x={tk.l[0]} y={tk.l[1]} textAnchor={tk.anchor} className="vgs-t" fill="#9ca3af" fontSize="11" fontWeight="600">
                {tk.m} m
              </text>
            </g>
          ))}
        </g>
      ) : (
        <g>
          <rect x="0" y="0" width={w} height={H} fill="#0a1812" />
          {Array.from({ length: Math.ceil(w / 46) }, (_, i) => i).map((i) => {
            const trees = [
              [16 + i * 46 + ((i * 37) % 15) - 7, ly - 58 - ((i * 53) % 19), 10 + ((i * 29) % 7)],
              [39 + i * 46 + ((i * 23) % 13) - 6, ly + 58 + ((i * 41) % 17), 9 + ((i * 31) % 8)],
            ];
            return (
              <g key={`pt${i}`}>
                {trees.map(([x, y, r]) => (
                  <g key={y}>
                    <ellipse cx={x + 3} cy={y + r * 0.7} rx={r} ry={r * 0.45} fill="#000" opacity="0.25" />
                    <circle cx={x} cy={y} r={r} fill="#14432d" />
                    <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.5} fill="#1f6343" />
                  </g>
                ))}
              </g>
            );
          })}
          <rect x={LX(0) - 12} y={ly - 16} width={LINE_LEN * kL + 24} height={32} rx={10} fill="#7c2d12" fillOpacity="0.62" />
          <line x1={LX(0) - 6} x2={LX(LINE_LEN) + 6} y1={ly} y2={ly} stroke="#fff" strokeOpacity="0.14" strokeDasharray="4 6" />
          {[0, 50, 100, 150, 200].map((m) => (
            <g key={m}>
              <line x1={LX(m)} x2={LX(m)} y1={ly + 16} y2={ly + 22} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
              <text x={LX(m)} y={ly + 35} textAnchor="middle" className="vgs-t" fill="#9ca3af" fontSize="11" fontWeight="600">
                {m} m
              </text>
            </g>
          ))}
          <text x={LX(LINE_LEN)} y={ly - 22} textAnchor="end" className="vgs-t" fill="#e5e7eb" fontSize="10.5" fontWeight="700" letterSpacing="1">
            {UZ.s3.turn.toUpperCase()}
          </text>
        </g>
      )}

      {/* trajectory (traced), displacement (arrow), start, runner */}
      <g opacity="0.45" filter={`url(#${id}glow)`}>
        {trace}
      </g>
      {trace}
      {disp}
      <g transform={`translate(${start[0]} ${start[1]})`}>
        <line x1="0" x2="0" y1="0" y2="-18" stroke="#34d399" strokeWidth="2" />
        <path d="M0,-18 L11,-14 L0,-10 Z" fill="#34d399" />
        <circle r="3.5" fill="#34d399" />
      </g>
      <g>
        {playing && <circle cx={runner[0]} cy={runner[1]} r="7" fill="none" stroke="#fff" strokeWidth="2" className="vgs-ping" />}
        <circle cx={runner[0]} cy={runner[1]} r="8" fill="#fff" stroke="#fbbf24" strokeWidth="3.5" />
        <circle cx={runner[0]} cy={runner[1]} r="22" fill="transparent" style={{ cursor: 'grab', touchAction: 'none' }} />
      </g>
    </svg>
  );
}

function PathChart({ route, t, onScrub }) {
  const [ref, w] = useElementWidth(360);
  const H = 156;
  const mL = 40;
  const mR = 16;
  const mT = 12;
  const mB = 26;
  const iw = Math.max(10, w - mL - mR);
  const ih = H - mT - mB;
  const xs = (tt) => mL + (tt / RUN_T) * iw;
  const ys = (v) => mT + ih - (v / 400) * ih;
  const r = ROUTES[route];
  const pts = [...SAMPLES[route].filter((p) => p[0] < t), [t, r.pathAt(t), r.dispAt(t)]];
  const poly = (idx) => pts.map((p) => `${xs(p[0]).toFixed(1)},${ys(p[idx]).toFixed(1)}`).join(' ');
  const cx = xs(t);
  const yS = ys(r.pathAt(t));
  const yD = ys(r.dispAt(t));
  let lS = yS;
  let lD = yD;
  if (Math.abs(lD - lS) < 14) {
    const m = (lS + lD) / 2;
    lS = m - 7;
    lD = m + 7;
  }
  const right = cx > w - 78;
  const lx = right ? cx - 9 : cx + 9;
  const scrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onScrub(clamp((e.clientX - rect.left - mL) / iw, 0, 1) * RUN_T);
  };
  return (
    <div ref={ref}>
      <svg
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        className="block w-full cursor-crosshair select-none"
        role="img"
        aria-label={UZ.s3.chartAria}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          scrub(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) scrub(e);
        }}
      >
        {[0, 100, 200, 300, 400].map((v) => (
          <g key={v}>
            <line x1={mL} x2={mL + iw} y1={ys(v)} y2={ys(v)} stroke="#fff" strokeOpacity={v === 0 ? 0.25 : 0.07} />
            <text x={mL - 6} y={ys(v) + 3.5} textAnchor="end" fill="#9ca3af" fontSize="10">
              {v === 400 ? '400 m' : v}
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80].map((tt) => (
          <text key={tt} x={xs(tt)} y={H - 9} textAnchor={tt === 80 ? 'end' : 'middle'} dx={tt === 80 ? 6 : 0} fill="#9ca3af" fontSize="10">
            {tt === 80 ? '80 s' : tt}
          </text>
        ))}
        <line x1={cx} x2={cx} y1={mT} y2={mT + ih} stroke="#fff" strokeOpacity="0.3" strokeDasharray="3 3" />
        <polyline points={poly(1)} fill="none" stroke="#d97706" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={poly(2)} fill="none" stroke="#0aa2c2" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={cx} cy={yS} r="4.5" fill="#d97706" stroke="#0b0a14" strokeWidth="2" />
        <circle cx={cx} cy={yD} r="4.5" fill="#0aa2c2" stroke="#0b0a14" strokeWidth="2" />
        <text x={lx} y={lS + 3.5} textAnchor={right ? 'end' : 'start'} className="vgs-t" fill="#e5e7eb" fontSize="10.5" fontWeight="600">
          {UZ.s3.pathLegend}
        </text>
        <text x={lx} y={lD + 3.5} textAnchor={right ? 'end' : 'start'} className="vgs-t" fill="#e5e7eb" fontSize="10.5" fontWeight="600">
          {UZ.s3.dispLegend}
        </text>
      </svg>
    </div>
  );
}

function StepPath({ setData, tasks, reduce }) {
  const [boxRef, w] = useElementWidth(640);
  const kW = (w - 24) / (2 * OVAL_HALF_W);
  const H = Math.min(380, Math.round(2 * OVAL_HALF_H * kW + 48));
  const k = Math.min(kW, (H - 48) / (2 * OVAL_HALF_H));
  const [route, setRoute] = useState('oval');
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!reduce);
  const tRef = useRef(t);
  tRef.current = t;

  useAnimationFrame((dt) => setT((p) => Math.min(RUN_T, p + dt * SPEEDUP)), playing);
  useEffect(() => {
    if (playing && t >= RUN_T) setPlaying(false);
  }, [playing, t]);
  useEffect(() => {
    if (t >= RUN_T - 1e-6) setData((d) => (d[route] ? d : { ...d, [route]: true }));
  }, [t, route, setData]);

  const togglePlay = () => {
    if (playing) setPlaying(false);
    else {
      if (t >= RUN_T) setT(0);
      setPlaying(true);
    }
  };
  const chooseRoute = (r) => {
    setRoute(r);
    setT(0);
    setPlaying(!reduce);
  };
  const timeFromHit = (h, dragging) => {
    const prevS = ROUTES[route].pathAt(tRef.current);
    if (h.kind === 'oval') {
      let sN = h.s;
      if (dragging) {
        if (prevS > 0.75 * LAP && sN < 0.25 * LAP) sN = LAP;
        else if (prevS < 0.25 * LAP && sN > 0.75 * LAP) sN = 0;
      }
      return (sN / LAP) * RUN_T;
    }
    const going = h.m;
    const coming = 2 * LINE_LEN - h.m;
    let sN;
    if (dragging) sN = Math.abs(going - prevS) <= Math.abs(coming - prevS) ? going : coming;
    else sN = h.lower ? coming : going;
    return sN / 5;
  };

  const s = ROUTES[route].pathAt(t);
  const d = ROUTES[route].dispAt(t);
  const phase = phaseOf(route, t);
  const msg = UZ.s3.msgs[phase];
  const tone = phase === 'ovalEnd' || phase === 'lineEnd' ? 'emerald' : phase === 'start' ? 'violet' : 'cyan';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s3.routePick}</p>
          <Segmented
            label={UZ.s3.routePick}
            value={route}
            onChange={chooseRoute}
            options={[
              { id: 'oval', label: UZ.s3.routes.oval, short: UZ.s3.routeTabs.oval, Icon: Target },
              { id: 'line', label: UZ.s3.routes.line, short: UZ.s3.routeTabs.line, Icon: Route },
            ]}
          />
        </div>
        <div ref={boxRef} className={STAGE} style={{ height: H }}>
          <TrackScene
            route={route}
            t={t}
            w={w}
            H={H}
            k={k}
            playing={playing}
            onScrubStart={(h) => {
              setPlaying(false);
              setT(timeFromHit(h, false));
            }}
            onScrubMove={(h) => setT(timeFromHit(h, true))}
            onScrubEnd={() => {}}
          />
          <div className={`${CHIP} bottom-2.5 left-2.5 text-gray-400`}>{UZ.s3.speedNote}</div>
          <div className={`${CHIP} bottom-2.5 right-2.5 hidden text-gray-400 sm:flex`}>
            <Hand size={13} aria-hidden /> {UZ.s3.dragHint}
          </div>
        </div>
        <div className={`${PANEL} space-y-2 p-3 sm:p-4`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" className={BTN_ICON} onClick={togglePlay} aria-label={playing ? UZ.pause : UZ.play}>
              {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
            </button>
            <button
              type="button"
              className={BTN_ICON}
              onClick={() => {
                setPlaying(false);
                setT(0);
              }}
              aria-label={UZ.reset}
            >
              <RotateCcw size={17} aria-hidden />
            </button>
            <Range
              value={t}
              min={0}
              max={RUN_T}
              step={0.1}
              color="#fbbf24"
              onChange={(v) => {
                setPlaying(false);
                setT(v);
              }}
              label={UZ.s3.timeSlider}
              valueText={UZ.s3.timeValue(fmt(t, 1))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {UZ.s3.jumps.map((j) => {
              const active = Math.abs(t - j.f * RUN_T) < 0.05;
              return (
                <button
                  key={j.label}
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setT(j.f * RUN_T);
                  }}
                  aria-label={UZ.s3.jumpAria(j.label)}
                  className={`min-h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold transition-colors ${FOCUS} ${
                    active ? 'border-amber-300/60 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                  }`}
                >
                  {j.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={UZ.s3.time} value={fmt(t, 1)} unit="s" color="#e5e7eb" />
          <Stat label={UZ.s3.path} value={fmt(s)} unit="m" color="#fbbf24" note={UZ.s3.pathNote} />
          <Stat label={UZ.s3.disp} value={fmt(d)} unit="m" color="#22d3ee" note={UZ.s3.dispNote} />
        </div>
        <Explain tone={tone} icon={phase === 'ovalEnd' || phase === 'lineEnd' ? Trophy : Lightbulb}>
          {typeof msg === 'function' ? msg(fmt(OVAL_MAX.d)) : msg}
        </Explain>
        <div className={`${PANEL} p-4`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s3.chartTitle}</p>
            <div className="flex items-center gap-3 text-[11px] text-gray-300" aria-hidden>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-[#d97706]" /> {UZ.s3.pathLegend}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-[#0aa2c2]" /> {UZ.s3.dispLegend}
              </span>
            </div>
          </div>
          <PathChart
            route={route}
            t={t}
            onScrub={(v) => {
              setPlaying(false);
              setT(v);
            }}
          />
        </div>
        <div className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.06] px-4 py-3 text-sm leading-relaxed text-violet-100">
          <p className="font-semibold">{UZ.s3.rule}</p>
          <p className="mt-0.5 text-[13px] text-violet-200/80">{UZ.s3.si}</p>
        </div>
        <TaskList items={tasks} />
      </div>
    </div>
  );
}

/* ================================================================ step 4: quiz */

function QuizFigure({ kind, revealed }) {
  const id = useSvgId();
  const f = UZ.s4.figure;
  const arrow = (name, fill) => (
    <marker id={`${id}${name}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={fill} />
    </marker>
  );
  const reveal = (children) =>
    revealed && (
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {children}
      </motion.g>
    );
  const common = { viewBox: kind === 'laps' ? '22 14 196 120' : '0 0 240 150', className: 'mx-auto block h-32 w-full max-w-[280px] sm:h-36' };

  if (kind === 'laps') {
    const track = 'M160,116 A42,42 0 0 0 160,32 L80,32 A42,42 0 0 0 80,116 Z';
    return (
      <svg {...common} role="img" aria-label={f.laps}>
        <defs>{arrow('a', '#fbbf24')}</defs>
        <path d="M160,116 A42,42 0 0 0 160,32 L80,32 A42,42 0 0 0 80,116 Z" fill="#0e2a1d" />
        <path d={track} fill="none" stroke="#7c2d12" strokeOpacity="0.75" strokeWidth="16" />
        <path d="M160,108 A34,34 0 0 0 160,40 L80,40 A34,34 0 0 0 80,108 L150,108" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="6 4" markerEnd={`url(#${id}a)`} />
        <path d="M160,124 A50,50 0 0 0 160,24 L80,24 A50,50 0 0 0 80,124 L150,124" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="6 4" markerEnd={`url(#${id}a)`} />
        <line x1="160" x2="160" y1="106" y2="126" stroke="#fff" strokeWidth="2.5" />
        <path d="M160,104 L160,88 L171,92 L160,96" fill="#34d399" stroke="#34d399" strokeWidth="1.5" />
        {!revealed && (
          <text x="120" y="82" textAnchor="middle" fill="#fde68a" fontSize="22" fontWeight="800">
            × 2
          </text>
        )}
        {reveal(
          <>
            <text x="120" y="70" textAnchor="middle" fill="#fcd34d" fontSize="12" fontWeight="700">
              {f.lapsPath}
            </text>
            <text x="120" y="90" textAnchor="middle" fill="#67e8f9" fontSize="12" fontWeight="700">
              {f.lapsDisp}
            </text>
          </>,
        )}
      </svg>
    );
  }

  if (kind === 'bus') {
    return (
      <svg {...common} role="img" aria-label={f.busAria}>
        <rect x="6" y="18" width="104" height="104" rx="12" fill="#0f0d1c" stroke={revealed ? '#fb7185' : '#2e2950'} />
        <rect x="58" y="34" width="44" height="72" fill="#1d1932" stroke="#6b62a0" strokeWidth="3" />
        <rect x="56" y="58" width="6" height="24" fill="#0f0d1c" />
        <rect x="18" y="61" width="52" height="18" rx="4" fill="#f59e0b" />
        <rect x="19" y="63" width="6" height="14" rx="2" fill="#a5f3fc" />
        <rect x="32" y="66" width="10" height="8" rx="1.5" fill="#d97706" />
        <text x="58" y="138" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600">
          {f.garage}
        </text>
        <rect x="130" y="18" width="104" height="104" rx="12" fill="#0f0d1c" stroke={revealed ? '#34d399' : '#2e2950'} />
        <polyline points="146,108 162,92 178,84 196,64 210,50 218,32" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 3" />
        <circle cx="146" cy="108" r="3.5" fill="#e5e7eb" />
        <circle cx="218" cy="32" r="4" fill="#e5e7eb" />
        <circle cx="180" cy="82" r="4.5" fill="#22d3ee" stroke="#07060f" strokeWidth="1.5" />
        <text x="198" y="96" fill="#fcd34d" fontSize="10" fontWeight="600">
          {f.route}
        </text>
        <text x="182" y="138" textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600">
          {f.map}
        </text>
        {reveal(
          <>
            <circle cx="104" cy="24" r="9" fill="#fb7185" />
            <path d="M100,20 L108,28 M108,20 L100,28" stroke="#07060f" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="228" cy="24" r="9" fill="#34d399" />
            <path d="M223.5,24 L227,27.5 L232.5,20.5" fill="none" stroke="#07060f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>,
        )}
      </svg>
    );
  }

  if (kind === 'train') {
    return (
      <svg {...common} role="img" aria-label={f.trainAria}>
        <defs>{arrow('t', '#fbbf24')}</defs>
        <line x1="0" x2="240" y1="122" y2="122" stroke="#8c84b0" strokeWidth="2" />
        <rect x="70" y="52" width="160" height="62" rx="6" fill="#2c2650" stroke="#4b4378" />
        {[0, 1, 2, 3].map((j) => (
          <rect key={j} x={82 + j * 37} y="62" width="26" height="20" rx="3" fill="#15122a" stroke="#4b4378" />
        ))}
        {[94, 206].map((x) => (
          <circle key={x} cx={x} cy="116" r="7" fill="#1a1730" stroke="#6b6390" strokeWidth="1.5" />
        ))}
        <rect x="122" y="84" width="6" height="22" rx="2" fill="#4b4378" />
        <rect x="122" y="98" width="22" height="6" rx="2" fill="#4b4378" />
        <circle cx="132" cy="68" r="5" fill="#ede9fe" />
        <path d="M132,74 L132,86 L142,86 L142,98" fill="none" stroke="#ede9fe" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="88" x2="196" y1="38" y2="38" stroke="#fbbf24" strokeWidth="2.5" markerEnd={`url(#${id}t)`} />
        <text x="96" y="30" fill="#fcd34d" fontSize="12" fontWeight="700">
          20 m/s
        </text>
        <circle cx="28" cy="84" r="5" fill="#a7f3d0" />
        <path d="M28,90 L28,106 M28,106 L22,120 M28,106 L34,120 M28,96 L20,102 M28,96 L36,102" stroke="#a7f3d0" strokeWidth="2.5" strokeLinecap="round" />
        {reveal(
          <>
            <rect x="150" y="88" width="58" height="18" rx="9" fill="#a78bfa" fillOpacity="0.2" stroke="#a78bfa" />
            <text x="179" y="101" textAnchor="middle" fill="#ddd6fe" fontSize="11" fontWeight="700">
              {f.trainRel}
            </text>
            <rect x="2" y="56" width="54" height="18" rx="9" fill="#34d399" fillOpacity="0.18" stroke="#34d399" />
            <text x="29" y="69" textAnchor="middle" fill="#a7f3d0" fontSize="11" fontWeight="700">
              {f.groundRel}
            </text>
          </>,
        )}
      </svg>
    );
  }

  // 'walk': 30 m north, then 40 m east.
  const S = [44, 128];
  const N = [44, 50];
  const E = [148, 50];
  return (
    <svg {...common} role="img" aria-label={`${f.north} ↑, ${f.east} →`}>
      <defs>
        {arrow('a', '#fbbf24')}
        {arrow('c', '#22d3ee')}
        {arrow('g', '#9ca3af')}
      </defs>
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`gx${i}`} x1={18 + i * 26} x2={18 + i * 26} y1="10" y2="140" stroke="#fff" strokeOpacity="0.05" />
      ))}
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`gy${i}`} x1="10" x2="230" y1={24 + i * 26} y2={24 + i * 26} stroke="#fff" strokeOpacity="0.05" />
      ))}
      <polyline points={`${S} ${N}`} fill="none" stroke="#fbbf24" strokeWidth="3" markerEnd={`url(#${id}a)`} />
      <polyline points={`${N} ${E}`} fill="none" stroke="#fbbf24" strokeWidth="3" markerEnd={`url(#${id}a)`} />
      <text x={S[0] - 8} y="92" textAnchor="end" fill="#fcd34d" fontSize="12" fontWeight="700">
        {f.north}
      </text>
      <text x="96" y="40" textAnchor="middle" fill="#fcd34d" fontSize="12" fontWeight="700">
        {f.east}
      </text>
      {reveal(
        <>
          <line x1={S[0]} y1={S[1]} x2={E[0] - 3} y2={E[1] + 3} stroke="#22d3ee" strokeWidth="3" markerEnd={`url(#${id}c)`} />
          <text x="108" y="104" fill="#67e8f9" fontSize="13" fontWeight="800">
            50 m
          </text>
        </>,
      )}
      <circle cx={S[0]} cy={S[1]} r="4.5" fill="#34d399" />
      <text x={S[0] + 8} y={S[1] + 4} fill="#a7f3d0" fontSize="11">
        {f.start}
      </text>
      <g transform="translate(210 112)">
        <line x1="0" x2="0" y1="14" y2="-12" stroke="#9ca3af" strokeWidth="1.5" markerEnd={`url(#${id}g)`} />
        <text x="0" y="28" textAnchor="middle" fill="#9ca3af" fontSize="10">
          {f.compass}
        </text>
      </g>
    </svg>
  );
}

function ScoreRing({ score, total }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = score / total;
  return (
    <div className="relative mx-auto h-36 w-36" role="img" aria-label={UZ.s4.scoreAria(score, total)}>
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="10" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={frac === 1 ? '#34d399' : frac >= 0.5 ? '#22d3ee' : '#fbbf24'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <Trophy size={20} className="mx-auto text-amber-300" aria-hidden />
          <p className="mt-0.5 text-3xl font-bold tabular-nums text-white">
            {score}
            <span className="text-lg text-gray-400">/{total}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function StepQuiz({ data, setData, reduce }) {
  const qs = UZ.s4.questions;
  const { answers, index, showResult } = data;
  const q = qs[index];
  const chosen = answers[index];
  const answered = chosen != null;
  const score = qs.reduce((n, qq, i) => n + (answers[i] === qq.correct ? 1 : 0), 0);
  const choose = (i) => {
    if (answered) return;
    setData((d) => ({ ...d, answers: { ...d.answers, [d.index]: i } }));
  };
  const next = () => setData((d) => (d.index < qs.length - 1 ? { ...d, index: d.index + 1 } : { ...d, showResult: true }));
  const retry = () => setData({ answers: {}, index: 0, showResult: false });

  if (showResult) {
    const msg = score === qs.length ? UZ.s4.msgs.perfect : score >= qs.length - 1 ? UZ.s4.msgs.good : UZ.s4.msgs.retry;
    return (
      <motion.div initial={{ opacity: 0, y: reduce ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} className={`${PANEL} mx-auto max-w-4xl p-5 sm:p-7`}>
        <div className="grid items-center gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <ScoreRing score={score} total={qs.length} />
          <div>
            <h4 className="text-xl font-bold text-white">{UZ.s4.resultTitle}</h4>
            <p className="mt-1 text-sm text-gray-300" aria-live="polite">
              {msg}
            </p>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s4.review}</p>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {qs.map((qq, i) => {
                const ok = answers[i] === qq.correct;
                return (
                  <li key={qq.short} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${ok ? 'border-emerald-400/25 bg-emerald-400/[0.05]' : 'border-rose-400/25 bg-rose-400/[0.05]'}`}>
                    {ok ? <CircleCheck size={16} className="shrink-0 text-emerald-300" aria-hidden /> : <CircleX size={16} className="shrink-0 text-rose-300" aria-hidden />}
                    <span className="text-gray-200">{qq.short}</span>
                    <span className="sr-only">{ok ? UZ.correct : UZ.incorrect}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className={BTN_GHOST} onClick={retry}>
                <RotateCcw size={16} aria-hidden /> {UZ.s4.retryQuiz}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const ok = chosen === q.correct;
  const hint = answered && !ok ? q.hints?.[chosen] : null;
  return (
    <div className={`${PANEL} mx-auto max-w-4xl p-4 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{UZ.s4.qOf(index + 1, qs.length)}</span>
        <div className="flex gap-1.5" aria-hidden>
          {qs.map((qq, i) => {
            const a = answers[i];
            const cls = a == null ? (i === index ? 'bg-cyan-300/70' : 'bg-white/15') : a === qq.correct ? 'bg-emerald-400' : 'bg-rose-400';
            return <span key={qq.short} className={`h-1.5 w-7 rounded-full transition-colors sm:w-10 ${cls}`} />;
          })}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          initial={{ opacity: 0, x: reduce ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : -24 }}
          transition={{ duration: 0.22 }}
        >
          <h4 className="mt-3 text-lg font-semibold leading-snug text-white sm:text-xl">{q.q}</h4>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_270px] md:items-center">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3 md:order-2">
              <QuizFigure kind={q.figure} revealed={answered} />
            </div>
          <div className="grid gap-2 md:order-1">
            {q.options.map((opt, i) => {
              const isRight = i === q.correct;
              const picked = chosen === i;
              let cls = 'border-white/12 bg-white/[0.04] hover:border-cyan-300/40 hover:bg-cyan-400/[0.06]';
              let badge = 'border-white/20 text-gray-300';
              if (answered) {
                if (isRight) {
                  cls = 'border-emerald-400/60 bg-emerald-400/[0.1]';
                  badge = 'border-emerald-400 bg-emerald-400 text-slate-950';
                } else if (picked) {
                  cls = 'border-rose-400/60 bg-rose-400/[0.1]';
                  badge = 'border-rose-400 bg-rose-400 text-slate-950';
                } else {
                  cls = 'border-white/5 bg-transparent opacity-55';
                }
              }
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  aria-pressed={picked}
                  onClick={() => choose(i)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm text-gray-100 transition-colors disabled:cursor-default ${FOCUS} ${cls}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-xs font-bold ${badge}`}>
                    {answered && isRight ? <Check size={14} strokeWidth={3} aria-hidden /> : answered && picked ? <span aria-hidden>✕</span> : String.fromCharCode(65 + i)}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          </div>
          <AnimatePresence initial={false}>
            {answered && (
              <motion.div initial={{ opacity: 0, y: reduce ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${ok ? TONES.emerald.box : TONES.rose.box}`} role="status">
                  <p className={`flex items-center gap-2 font-bold ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {ok ? <CircleCheck size={17} aria-hidden /> : <CircleX size={17} aria-hidden />}
                    {ok ? UZ.correct : UZ.incorrect}
                  </p>
                  {hint && <p className="mt-1.5 text-gray-100">{hint}</p>}
                  <p className="mt-1.5 text-gray-300">{q.explain}</p>
                </div>
                <div className="flex justify-end">
                  <button type="button" className={BTN_PRIMARY} onClick={next}>
                    {index < qs.length - 1 ? UZ.s4.nextQ : UZ.s4.seeResult} <ArrowRight size={16} aria-hidden />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ===================================================================== shell */

const STEP_ICONS = [Bus, Compass, Route, ListChecks];
const INITIAL = {
  s1: { zoomedOut: false, answers: {} },
  s2: { visited: ['earth'] },
  s3: { oval: false, line: false },
  s4: { answers: {}, index: 0, showResult: false },
};

export default function VariantGuidedSteps() {
  const reduce = useReducedMotion();
  const cardRef = useRef(null);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [s1, setS1] = useState(INITIAL.s1);
  const [s2, setS2] = useState(INITIAL.s2);
  const [s3, setS3] = useState(INITIAL.s3);
  const [s4, setS4] = useState(INITIAL.s4);

  const answered1 = Object.keys(s1.answers).length;
  const tasks = [
    [
      { key: 'zoom', text: UZ.s1.tasks[0], done: s1.zoomedOut },
      { key: 'prompts', text: UZ.s1.tasks[1](answered1), done: answered1 === UZ.s1.prompts.length },
    ],
    [{ key: 'frames', text: UZ.s2.tasks[0](s2.visited.length), done: s2.visited.length === FRAMES.length }],
    [
      { key: 'oval', text: UZ.s3.tasks[0], done: s3.oval },
      { key: 'line', text: UZ.s3.tasks[1], done: s3.line },
    ],
    [{ key: 'quiz', text: UZ.s4.task, done: s4.showResult }],
  ];
  const done = tasks.map((list) => list.every((it) => it.done));
  const doneCount = done.filter(Boolean).length;
  const pending = tasks[step].find((it) => !it.done);

  const go = (n) => {
    if (n < 0 || n >= UZ.steps.length || n === step) return;
    setDir(n > step ? 1 : -1);
    setStep(n);
    const el = cardRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top;
      if (top < 0) window.scrollTo({ top: window.scrollY + top - 88, behavior: reduce ? 'auto' : 'smooth' });
    }
  };
  const restartAll = () => {
    setS1(INITIAL.s1);
    setS2(INITIAL.s2);
    setS3(INITIAL.s3);
    setS4(INITIAL.s4);
    go(0);
  };

  const variants = {
    enter: (d) => ({ opacity: 0, x: reduce ? 0 : d * 44 }),
    center: { opacity: 1, x: 0 },
    exit: (d) => ({ opacity: 0, x: reduce ? 0 : d * -44 }),
  };
  const StepIcon = STEP_ICONS[step];
  const meta = UZ.steps[step];
  const last = step === UZ.steps.length - 1;

  return (
    <section ref={cardRef} aria-label={UZ.card} className="glass relative overflow-hidden rounded-3xl">
      <style>{CSS}</style>
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-cyan-400/[0.07] blur-3xl" />

      <div className="relative space-y-5 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 font-semibold text-cyan-200">
              <Sparkles size={13} aria-hidden /> {UZ.kicker}
            </span>
            <span className="text-gray-400">{UZ.lessonTag}</span>
          </div>
          <span className="text-xs tabular-nums text-gray-400">{UZ.doneOf(doneCount, UZ.steps.length)}</span>
        </div>

        <nav aria-label={UZ.stepsNav}>
          <div className="relative">
            <div aria-hidden className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 -translate-y-1/2 rounded-full bg-white/10" />
            <motion.div
              aria-hidden
              className="absolute left-[12.5%] top-5 h-0.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
              initial={false}
              animate={{ width: `${(step / (UZ.steps.length - 1)) * 75}%` }}
              transition={{ duration: reduce ? 0 : 0.45, ease: 'easeOut' }}
            />
            <ol className="relative grid grid-cols-4">
              {UZ.steps.map((st, i) => {
                const active = i === step;
                const isDone = done[i];
                let circle = 'border-white/15 bg-[#0c0b16] text-gray-400 group-hover:border-white/35 group-hover:text-gray-200';
                if (active) circle = 'border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.45)]';
                else if (isDone) circle = 'border-emerald-400/70 bg-[#0d2a22] text-emerald-300';
                else if (i < step) circle = 'border-cyan-300/50 bg-[#0c0b16] text-cyan-200';
                return (
                  <li key={st.short} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => go(i)}
                      aria-current={active ? 'step' : undefined}
                      className={`group flex min-h-10 flex-col items-center gap-1.5 rounded-xl px-1 pb-1 ${FOCUS}`}
                    >
                      <span className={`grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-bold transition-colors ${circle}`}>
                        {isDone && !active ? <Check size={17} strokeWidth={3} aria-hidden /> : i + 1}
                      </span>
                      <span className={`text-center text-[11px] leading-tight sm:text-xs ${active ? 'font-semibold text-white' : 'text-gray-400'}`}>
                        {st.short}
                        {isDone && <span className="sr-only"> — {UZ.doneMark}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </nav>

        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-300">
                <StepIcon size={22} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">{UZ.stepOf(step + 1, UZ.steps.length)}</p>
                <h3 className="text-xl font-bold text-white sm:text-2xl">{meta.title}</h3>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-300">
                  <Rich text={meta.def} />
                </p>
              </div>
            </div>
            {step === 0 && <StepPoint data={s1} setData={setS1} tasks={tasks[0]} reduce={reduce} />}
            {step === 1 && <StepFrames data={s2} setData={setS2} tasks={tasks[1]} reduce={reduce} />}
            {step === 2 && <StepPath setData={setS3} tasks={tasks[2]} reduce={reduce} />}
            {step === 3 && <StepQuiz data={s4} setData={setS4} reduce={reduce} />}
          </motion.div>
        </AnimatePresence>

        <div className="border-t border-white/10 pt-4">
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
            <button type="button" className={`${BTN_GHOST} sm:order-1`} onClick={() => go(step - 1)} disabled={step === 0}>
              <ArrowLeft size={16} aria-hidden /> {UZ.back}
            </button>
            <p className="order-first col-span-2 flex items-center justify-center gap-2 text-center text-xs text-gray-400 sm:order-2 sm:flex-1" aria-live="polite">
              {pending ? (
                <>
                  <Target size={14} className="shrink-0 text-cyan-300" aria-hidden />
                  <span>
                    <span className="text-gray-500">{UZ.nextTask}</span> {pending.text}
                  </span>
                </>
              ) : (
                <>
                  <CircleCheck size={14} className="shrink-0 text-emerald-300" aria-hidden />
                  <span className="text-emerald-200/90">{last ? UZ.allComplete : UZ.stepComplete}</span>
                </>
              )}
            </p>
            {!last ? (
              <button type="button" className={`${BTN_PRIMARY} sm:order-3`} onClick={() => go(step + 1)}>
                {UZ.next} <ArrowRight size={16} aria-hidden />
              </button>
            ) : s4.showResult ? (
              <button type="button" className={`${BTN_PRIMARY} sm:order-3`} onClick={restartAll}>
                <RotateCcw size={16} aria-hidden /> {UZ.restartAll}
              </button>
            ) : (
              <button type="button" className={`${BTN_PRIMARY} sm:order-3`} disabled title={UZ.finishQuizFirst}>
                <Check size={16} aria-hidden /> {UZ.finish}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
