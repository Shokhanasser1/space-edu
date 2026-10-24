import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Axis3d,
  BookOpen,
  Bus,
  Camera,
  Clock,
  Footprints,
  Gauge,
  Lightbulb,
  Map as MapIcon,
  MoveRight,
  Pause,
  Percent,
  Play,
  Repeat,
  RotateCcw,
  Rotate3d,
  Route,
  ScanSearch,
  Timer,
  TreeDeciduous,
  Warehouse,
  Building2,
} from 'lucide-react';

import Variant3DCanvas from './Variant3DScene.scene';
import { AB_DIRECT_M, ROAD_LEN_M, TRIP_DISP_M, TRIP_LEN_M, fmt } from './Variant3DScene.world';

/**
 * Variant C - "3D sahna". The lesson's three ideas on a small floating town:
 * path and displacement on a winding road and a 400 m track, the reference
 * frame switched between the ground and the bus, and the material point found
 * by zooming out from a garage to the Tashkent - Samarkand map.
 *
 * Every word the reader sees is in `UZ` below, so localising it later is one
 * object. Numbers inside sentences are filled in from the world's constants.
 */
const UZ = {
  kicker: 'Fizika · Kinematika · 1-dars · 3D sahna',
  title: 'Mexanikaning asosiy tushunchalari',
  subtitle: "Mexanika jismlar qanday harakatlanishini va nima uchun aynan shunday harakatlanishini o'rganadi.",
  modesLabel: 'Tushunchalar',
  modes: { path: "Yo'l va ko'chish", frame: 'Sanoq sistemasi', point: 'Moddiy nuqta' },
  play: 'Boshlash',
  pause: "To'xtatish",
  reset: 'Qayta',
  speed: 'Tezlik',
  routeTitle: "Yo'nalish",
  routes: {
    ab: { label: 'A → B', sub: 'bekatdan bekatga' },
    aba: { label: 'A → B → A', sub: 'borib-qaytish' },
    lap: { label: 'Stadion', sub: '1 aylana · 400 m' },
  },
  frameTitle: 'Kimga nisbatan qaraymiz?',
  frames: { ground: 'Yerga nisbatan', bus: 'Avtobusga nisbatan' },
  frameBadge: { ground: "Kamera yerga bog'langan", bus: 'Kamera avtobus bilan birga yuradi' },
  zoomTitle: 'Masshtab',
  zoomStreet: "Ko'cha",
  zoomMap: 'Xarita',
  presets: { garage: 'Garaj', town: 'Shaharcha', map: 'Toshkent → Samarqand' },
  read: {
    time: 'Vaqt',
    path: "Yo'l",
    disp: "Ko'chish",
    clock: 'Soat',
    body: 'Sanoq jismi',
    coords: 'Koordinatalar, m',
    view: "Ko'rinish kengligi",
    busLen: 'Avtobus uzunligi',
    ratio: "Avtobus / ko'rinish",
  },
  units: { s: 's', m: 'm', km: 'km', h: 'soat', min: 'daq' },
  sym: { t: 't', s: 's', d: '|Δr|' },
  legend: { trail: 'Trayektoriya', trailBack: 'Trayektoriya (qaytish)', arrow: "Ko'chish vektori" },
  hintOrbit: 'Sahnani sichqoncha yoki barmoq bilan aylantiring',
  scale: 'Masshtab',
  labels: {
    A: "A bekat · boshlang'ich nuqta",
    B: 'B bekat',
    start: 'Start = marra',
    chinor: 'Chinor',
    busName: 'Avtobus',
    chinorRef: 'Chinor — sanoq jismi',
    busRef: 'Avtobus — sanoq jismi',
    garage: 'Garaj: 14 m',
    bus: 'Avtobus: 12 m',
    point: 'moddiy nuqta',
    lake: "Aydarko'l",
    cities: { tashkent: 'Toshkent', gulistan: 'Guliston', jizzakh: 'Jizzax', samarkand: 'Samarqand' },
  },
  verdict: {
    no: "Nuqta emas — o'lchami muhim",
    mid: "O'lchami hali seziladi",
    yes: "Moddiy nuqta deb olsa bo'ladi",
  },
  phases: {
    ab_idle: "Boshlash tugmasini bosing: avtobus A bekatdan B bekatga egri yo'l bo'ylab yuradi.",
    ab_out:
      "Ko'k chiziq — trayektoriya, uning uzunligi — yo'l. Sariq strelka — ko'chish: A dan avtobusgacha to'g'ri yo'nalgan vektor. Yo'l egri bo'lgani uchun u ko'chishdan katta.",
    ab_done: (n) =>
      `B bekatga yetdi: yo'l ${n.L} m, ko'chish esa atigi ${n.D} m. Faqat to'g'ri chiziq bo'ylab bir tomonga harakatda yo'l ko'chishga teng bo'ladi.`,
    aba_idle: "Avtobus B bekatga borib, A ga qaytadi. Yo'l va ko'chish qanday o'zgarishini kuzating.",
    aba_out: "Borishda yo'l ham, ko'chish ham ortib boryapti.",
    aba_atB: (n) => `B bekat: avtobus orqaga burilyapti. Soat yuryapti, lekin yo'l ${n.L} m da turibdi — joyida turganda yo'l ortmaydi.`,
    aba_back: "Qaytishda ko'chish kamayyapti, yo'l esa ortishda davom etyapti — yo'l hech qachon kamaymaydi.",
    aba_done: (n) =>
      `Avtobus A ga qaytdi: yo'l = 2 × ${n.L} = ${n.L2} m, ko'chish esa 0 m — boshlang'ich va oxirgi nuqta bir joyda.`,
    lap_idle: "Stadion yugurish yo'lagining 1-yo'lagi roppa-rosa 400 m. Yugurchi bir aylana yuguradi.",
    lap_run1: "Ko'chish ortib boryapti: yugurchi startdan uzoqlashyapti.",
    lap_run2: "Endi ko'chish kamayyapti — yugurchi startga yaqinlashyapti, yo'l esa ortishda davom etyapti.",
    lap_done: "Bir aylana: yo'l 400 m, ko'chish esa 0 m — yugurchi yana start chizig'ida turibdi.",
    frame_ground:
      "Sanoq jismi — chinor daraxti. Unga bog'langan x, y, z o'qlari va soat bilan avtobus qayerda ekanini aytamiz: koordinatalari o'zgaryapti, demak avtobus harakatda.",
    frame_bus:
      "Sanoq jismi — avtobus. O'qlar va kamera avtobus bilan birga yuradi: avtobus tinch turibdi (koordinatalari doim 0), daraxt va uylar esa orqaga siljiydi. Harakat nisbiy!",
    pt_street:
      "Avtobus garajga kiryapti. Uning uzunligi 12 m, garaj esa 14 m — har bir metr muhim. Bu masalada avtobus moddiy nuqta EMAS.",
    pt_street_done:
      "Avtobus garajga sig'di: oldida va orqasida bir metrga yaqin joy qoldi. O'lchamni hisobga olmasdan bu masalani yechib bo'lmaydi.",
    pt_mid: "Uzoqlashgan sari avtobus ko'rinish kengligiga nisbatan kichrayib boryapti — o'lchami tobora ahamiyatsiz.",
    pt_point: "Endi avtobus ko'rinish kengligining 1 foizidan ham kichik — uni bitta nuqta deb olsa bo'ladi.",
    pt_map: (n) =>
      `Toshkent → Samarqand ≈ ${n.P} km. 12 metrlik avtobus bu masofaning atigi 0,004 foizi — xaritada u moddiy nuqta. Boshlash tugmasini bosing.`,
    pt_trip: "Moddiy nuqta yo'l bo'ylab siljiyapti: endi bizni avtobusning o'lchami emas, faqat qayerdaligi qiziqtiradi.",
    pt_tripdone: (n) =>
      `Samarqandga yetdi: yo'l ≈ ${n.P} km, ko'chish ≈ ${n.Dk} km. Bunday masofada avtobusning o'lchami ahamiyatsiz.`,
  },
  concepts: {
    path: [
      { term: 'Trayektoriya', text: "jism chizib o'tgan chiziq." },
      { term: "Yo'l", text: 'shu chiziqning uzunligi. U hech qachon kamaymaydi.' },
      { term: "Ko'chish", text: "boshlang'ich nuqtadan oxirgi nuqtaga yo'nalgan vektor." },
    ],
    frame: [
      { term: 'Sanoq sistemasi', text: "sanoq jismi, unga bog'langan koordinata o'qlari va soat." },
      { term: 'Nega kerak?', text: 'ularsiz "jism qayerda?" degan savolning javobi yo\'q.' },
      { term: 'Nisbiylik', text: 'bir jism bir sanoq sistemasida harakatda, boshqasida tinch bo\'lishi mumkin.' },
    ],
    point: [
      { term: 'Moddiy nuqta', text: "masalaning shartida o'lchamini hisobga olmasa ham bo'ladigan jism." },
      { term: 'Nuqta', text: "Toshkentdan Samarqandga ketayotgan avtobus — xaritada." },
      { term: 'Nuqta emas', text: "garajga kirayotgan o'sha avtobus." },
    ],
  },
  example: {
    term: 'Misol',
    text: "Stadionning 400 metrli doirasi bo'ylab bir marta yugurdingiz: yo'l 400 m, ko'chish esa nolga teng.",
  },
  si: "SI da uzunlik metrda (m), vaqt sekundda (s) o'lchanadi.",
};

const NUM = {
  L: fmt(ROAD_LEN_M),
  L2: fmt(2 * ROAD_LEN_M),
  D: fmt(AB_DIRECT_M),
  P: fmt(TRIP_LEN_M / 1000),
  Dk: fmt(TRIP_DISP_M / 1000),
};

const MODES = [
  { id: 'path', Icon: Route },
  { id: 'frame', Icon: Axis3d },
  { id: 'point', Icon: ScanSearch },
];
const ROUTES = [
  { id: 'ab', Icon: MoveRight },
  { id: 'aba', Icon: Repeat },
  { id: 'lap', Icon: Footprints },
];
const PRESETS = [
  { id: 'garage', z: 0, Icon: Warehouse },
  { id: 'town', z: 0.25, Icon: Building2 },
  { id: 'map', z: 1, Icon: MapIcon },
];

/** A few hundred stars painted with CSS behind the transparent canvas. */
const STAR_FIELD = (() => {
  let s = 7;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const dots = [];
  for (let i = 0; i < 70; i += 1) {
    const size = r() < 0.15 ? 2 : 1;
    const a = (0.35 + r() * 0.6).toFixed(2);
    dots.push(`radial-gradient(${size}px ${size}px at ${(r() * 100).toFixed(1)}% ${(r() * 100).toFixed(1)}%, rgba(255,255,255,${a}) 50%, transparent 51%)`);
  }
  return dots.join(',');
})();
const STAGE_BG = 'radial-gradient(120% 95% at 50% 0%, #22306a 0%, #0e1536 42%, #05060f 100%)';

function Readout({ icon, label, sym, valueRef, tone = 'text-white', barRef, barTone, sub }) {
  const Icon = icon;
  return (
    <div className="min-w-0 sm:py-1">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-gray-400 sm:text-xs sm:text-gray-300">
          <Icon className="hidden h-3.5 w-3.5 shrink-0 text-gray-400 sm:block" aria-hidden />
          <span className="truncate">{label}</span>
          {sym ? <span className="hidden font-mono text-gray-500 sm:inline">{sym}</span> : null}
        </span>
        <span ref={valueRef} className={`truncate font-mono text-[13px] font-bold tabular-nums sm:text-base ${tone}`} />
      </div>
      {sub ? <span ref={sub} className="block truncate font-mono text-[10px] text-gray-400 sm:text-right" /> : null}
      {barRef ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div ref={barRef} className={`h-full rounded-full ${barTone}`} style={{ width: 0 }} />
        </div>
      ) : null}
    </div>
  );
}

function Panel({ className = '', children }) {
  return (
    <div
      className={`pointer-events-none absolute z-30 rounded-2xl border border-white/10 bg-slate-950/70 p-2.5 shadow-xl shadow-black/30 backdrop-blur-md sm:p-3 ${className}`}
    >
      {children}
    </div>
  );
}

function Chip({ active, onClick, icon, label, sub }) {
  const Icon = icon;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-[48px] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors sm:px-3 ${
        active ? 'border-cyan-300/60 bg-cyan-400/10 text-white' : 'border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/10'
      }`}
    >
      <Icon className={`hidden h-4 w-4 shrink-0 sm:block ${active ? 'text-cyan-300' : 'text-gray-400'}`} aria-hidden />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight">{label}</span>
        {sub ? <span className="block text-[11px] leading-tight text-gray-400">{sub}</span> : null}
      </span>
    </button>
  );
}

export default function Variant3DScene() {
  const [mode, setMode] = useState('path');
  const [route, setRoute] = useState('ab');
  const [frame, setFrame] = useState('ground');
  const [zoom, setZoom] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [resetToken, setResetToken] = useState(0);
  const [phaseKey, setPhaseKey] = useState('ab_idle');

  const dom = useRef({});
  const bind = useMemo(() => {
    const cache = {};
    return (k) => {
      if (!cache[k]) {
        cache[k] = (el) => {
          dom.current[k] = el;
        };
      }
      return cache[k];
    };
  }, []);

  const effRoute = mode === 'frame' && route === 'lap' ? 'ab' : route;
  const onPhase = useCallback((k) => setPhaseKey(k), []);
  const onFinish = useCallback(() => setPlaying(false), []);

  const chooseMode = (m) => {
    setPlaying(false);
    setMode(m);
    if (m === 'frame' && route === 'lap') setRoute('ab');
  };
  const chooseRoute = (r) => {
    setPlaying(false);
    setRoute(r);
  };
  const chooseZoom = (z) => {
    if (z < 0.5 !== zoom < 0.5) setPlaying(false);
    setZoom(z);
  };
  const togglePlay = () => {
    if (!playing && mode === 'point' && zoom >= 0.5 && zoom < 0.98) setZoom(1);
    setPlaying((p) => !p);
  };
  const reset = () => {
    setPlaying(false);
    setResetToken((n) => n + 1);
  };

  const raw = UZ.phases[phaseKey];
  const sentence = typeof raw === 'function' ? raw(NUM) : raw || '';
  const pointVerdict = phaseKey.startsWith('pt_street') ? 'no' : phaseKey === 'pt_mid' ? 'mid' : 'yes';
  const onMap = phaseKey === 'pt_map' || phaseKey === 'pt_trip' || phaseKey === 'pt_tripdone';
  const orbitView = mode === 'path' || (mode === 'frame' && frame === 'ground');

  const explanation = (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300">
        <Lightbulb className="h-4 w-4" aria-hidden />
      </span>
      <p className="text-[13px] leading-relaxed text-gray-100 sm:text-sm" aria-live="polite">
        {sentence}
      </p>
    </div>
  );

  return (
    <section className="glass overflow-hidden rounded-3xl text-white">
      {/* Header and the three ideas */}
      <div className="flex flex-col gap-4 px-4 pt-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">{UZ.kicker}</p>
          <h2 className="mt-1 text-xl font-bold sm:text-2xl">{UZ.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{UZ.subtitle}</p>
        </div>
        <div
          role="tablist"
          aria-label={UZ.modesLabel}
          className="grid shrink-0 grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 lg:w-[540px]"
        >
          {MODES.map((m) => {
            const { id, Icon } = m;
            const active = id === mode;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => chooseMode(id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 text-center text-[12px] font-semibold leading-tight transition-colors sm:flex-row sm:gap-2 sm:text-sm ${
                  active ? 'bg-cyan-400/15 text-white ring-1 ring-cyan-300/50' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-300' : ''}`} aria-hidden />
                {UZ.modes[id]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative mt-4 h-[420px] overflow-hidden border-y border-white/10 sm:h-[500px] lg:h-[580px]"
        style={{ background: STAGE_BG }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-80" style={{ backgroundImage: STAR_FIELD }} />
        <div className="absolute inset-0">
          <Variant3DCanvas
            uz={UZ}
            mode={mode}
            route={effRoute}
            frame={frame}
            zoom={zoom}
            playing={playing}
            speed={speed}
            resetToken={resetToken}
            phaseKey={phaseKey}
            onPhase={onPhase}
            onFinish={onFinish}
            dom={dom}
            bind={bind}
          />
        </div>

        {mode === 'path' ? (
          <Panel className="left-2 right-2 top-2 grid grid-cols-3 gap-3 sm:left-3 sm:right-auto sm:top-3 sm:block sm:w-[236px]">
            <Readout icon={Timer} label={UZ.read.time} sym={UZ.sym.t} valueRef={bind('t')} />
            <Readout icon={Route} label={UZ.read.path} sym={UZ.sym.s} valueRef={bind('s')} tone="text-cyan-300" barRef={bind('sBar')} barTone="bg-cyan-400" />
            <Readout icon={MoveRight} label={UZ.read.disp} sym={UZ.sym.d} valueRef={bind('d')} tone="text-amber-300" barRef={bind('dBar')} barTone="bg-amber-400" />
          </Panel>
        ) : null}

        {mode === 'frame' ? (
          <Panel className="left-2 right-2 top-2 sm:left-3 sm:right-auto sm:top-3 sm:w-[300px]">
            <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 sm:text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate">{UZ.read.body}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${frame === 'ground' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-violet-400/15 text-violet-200'}`}>
                  {frame === 'ground' ? UZ.labels.chinor : UZ.labels.busName}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                <span className="hidden sm:inline">{UZ.read.clock}</span>
                <span ref={bind('t')} className="font-mono text-[13px] font-bold tabular-nums text-white sm:text-base" />
              </span>
            </div>
            <table className="mt-1.5 w-full font-mono text-[11px] tabular-nums sm:text-xs">
              <thead>
                <tr className="text-left">
                  <th className="pb-0.5 font-sans text-[10px] font-normal uppercase tracking-wider text-gray-500">{UZ.read.coords}</th>
                  <th className="w-12 font-bold text-rose-400">x</th>
                  <th className="w-9 font-bold text-green-400">y</th>
                  <th className="w-12 font-bold text-blue-400">z</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [UZ.labels.busName, 'b', 'text-violet-200'],
                  [UZ.labels.chinor, 't', 'text-emerald-200'],
                ].map(([name, p, tone]) => (
                  <tr key={p}>
                    <td className={`pr-1 font-sans ${tone}`}>{name}</td>
                    <td ref={bind(`${p}x`)} />
                    <td ref={bind(`${p}y`)} />
                    <td ref={bind(`${p}z`)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ) : null}

        {mode === 'point' ? (
          <Panel className="left-2 right-2 top-2 sm:left-3 sm:right-auto sm:top-3 sm:w-[252px]">
            <div className="grid grid-cols-2 gap-3 sm:block">
              <Readout icon={ScanSearch} label={UZ.read.view} valueRef={bind('view')} />
              <Readout icon={Percent} label={UZ.read.ratio} valueRef={bind('ratio')} tone="text-cyan-200" />
            </div>
            <div className="hidden items-baseline justify-between gap-2 py-1 text-xs text-gray-300 sm:flex">
              <span className="flex items-center gap-1.5">
                <Bus className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                {UZ.read.busLen}
              </span>
              <span className="font-mono text-base font-bold">12 {UZ.units.m}</span>
            </div>
            <div
              className={`mt-1.5 rounded-lg px-2 py-1 text-center text-[11px] font-semibold sm:text-xs ${
                pointVerdict === 'no'
                  ? 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30'
                  : pointVerdict === 'mid'
                    ? 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30'
                    : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30'
              }`}
            >
              {UZ.verdict[pointVerdict]}
            </div>
            {onMap ? (
              <div className="mt-1.5 grid grid-cols-3 gap-3 border-t border-white/10 pt-1.5 sm:block sm:pt-1">
                <Readout icon={Timer} label={UZ.read.time} sym={UZ.sym.t} valueRef={bind('t')} sub={bind('tH')} />
                <Readout icon={Route} label={UZ.read.path} sym={UZ.sym.s} valueRef={bind('s')} tone="text-cyan-300" />
                <Readout icon={MoveRight} label={UZ.read.disp} sym={UZ.sym.d} valueRef={bind('d')} tone="text-amber-300" />
              </div>
            ) : null}
          </Panel>
        ) : null}

        {/* Right-hand helpers */}
        {mode === 'path' ? (
          <div className="pointer-events-none absolute right-3 top-3 z-30 hidden rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-gray-200 backdrop-blur-md sm:block">
            <p className="flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              {UZ.legend.trail}
            </p>
            {route === 'aba' ? (
              <p className="mt-1.5 flex items-center gap-2">
                <span className="h-1 w-6 rounded-full bg-violet-400 shadow-[0_0_8px_#a78bfa]" />
                {UZ.legend.trailBack}
              </p>
            ) : null}
            <p className="mt-1.5 flex items-center gap-2">
              <svg width="24" height="10" viewBox="0 0 24 10" aria-hidden>
                <path d="M1 5h16" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M15 1l7 4-7 4z" fill="#fbbf24" />
              </svg>
              {UZ.legend.arrow}
            </p>
          </div>
        ) : null}
        {mode === 'frame' ? (
          <div className="pointer-events-none absolute right-3 top-3 z-30 hidden items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1.5 text-xs font-semibold text-gray-200 backdrop-blur-md sm:flex">
            <Camera className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
            <span>{UZ.frameBadge[frame]}</span>
          </div>
        ) : null}
        {mode === 'point' ? (
          <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex flex-col items-end gap-1 rounded-xl border border-white/10 bg-slate-950/60 px-2.5 py-1.5 backdrop-blur-md">
            <span ref={bind('scaleLabel')} className="font-mono text-[11px] font-semibold text-gray-100" />
            <span ref={bind('scaleBar')} className="block h-2 border-x-2 border-b-2 border-white/80" style={{ width: 90 }} />
          </div>
        ) : null}
        {orbitView ? (
          <div className="pointer-events-none absolute bottom-3 right-3 z-30 hidden items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[11px] text-gray-300 backdrop-blur-md lg:flex">
            <Rotate3d className="h-3.5 w-3.5" aria-hidden />
            {UZ.hintOrbit}
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-3 left-3 z-30 hidden max-w-[600px] rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 shadow-xl shadow-black/30 backdrop-blur-md lg:block">
          {explanation}
        </div>
      </div>

      {/* Sentence under the canvas on small screens */}
      <div className="border-b border-white/10 bg-slate-950/40 px-4 py-3 lg:hidden">{explanation}</div>

      {/* Controls */}
      <div className="grid gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-end">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {playing ? UZ.pause : UZ.play}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-gray-100 transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {UZ.reset}
          </button>
          <label className="flex h-11 min-w-[200px] flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-gray-300">
            <Gauge className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <span className="shrink-0">{UZ.speed}</span>
            <input
              type="range"
              min={0.5}
              max={8}
              step={0.5}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="h-10 min-w-0 flex-1 cursor-pointer accent-cyan-400"
            />
            <span className="w-10 shrink-0 text-right font-mono text-xs text-white">×{fmt(speed, speed % 1 ? 1 : 0)}</span>
          </label>
        </div>

        {mode === 'path' ? (
          <div>
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">{UZ.routeTitle}</p>
            <div className="grid grid-cols-3 gap-2">
              {ROUTES.map(({ id, Icon }) => (
                <Chip key={id} active={route === id} onClick={() => chooseRoute(id)} icon={Icon} label={UZ.routes[id].label} sub={UZ.routes[id].sub} />
              ))}
            </div>
          </div>
        ) : null}

        {mode === 'frame' ? (
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">{UZ.frameTitle}</p>
              <div className="grid grid-cols-2 gap-2">
                <Chip active={frame === 'ground'} onClick={() => setFrame('ground')} icon={TreeDeciduous} label={UZ.frames.ground} />
                <Chip active={frame === 'bus'} onClick={() => setFrame('bus')} icon={Bus} label={UZ.frames.bus} />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">{UZ.routeTitle}</p>
              <div className="grid grid-cols-2 gap-2">
                {ROUTES.filter((r) => r.id !== 'lap').map(({ id, Icon }) => (
                  <Chip key={id} active={effRoute === id} onClick={() => chooseRoute(id)} icon={Icon} label={UZ.routes[id].label} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {mode === 'point' ? (
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">{UZ.zoomTitle}</p>
            <div className="flex items-center gap-3">
              <span className="w-12 shrink-0 text-xs text-gray-400">{UZ.zoomStreet}</span>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(zoom * 1000)}
                onChange={(e) => chooseZoom(Number(e.target.value) / 1000)}
                aria-label={UZ.zoomTitle}
                className="h-10 min-w-0 flex-1 cursor-pointer accent-cyan-400"
              />
              <span className="w-12 shrink-0 text-right text-xs text-gray-400">{UZ.zoomMap}</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PRESETS.map(({ id, z, Icon }) => (
                <Chip key={id} active={Math.abs(zoom - z) < 0.02} onClick={() => chooseZoom(z)} icon={Icon} label={UZ.presets[id]} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* The lesson's words */}
      <div className="grid gap-2.5 border-t border-white/10 px-4 py-4 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
        {UZ.concepts[mode].map((c) => (
          <p key={c.term} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-gray-300">
            <b className="text-cyan-200">{c.term}</b> — {c.text}
          </p>
        ))}
        <p className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-gray-300">
          <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden />
          <span>
            {mode === 'path' ? (
              <>
                <b className="text-violet-200">{UZ.example.term}:</b> {UZ.example.text}{' '}
              </>
            ) : null}
            {UZ.si}
          </span>
        </p>
      </div>
    </section>
  );
}
