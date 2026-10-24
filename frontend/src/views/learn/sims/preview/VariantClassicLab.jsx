import { memo, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  BookOpen,
  CircleDashed,
  FlaskConical,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Route,
  School,
  Timer,
  TrainFront,
  ZoomIn,
} from 'lucide-react';
import {
  Arrow,
  Btn,
  Explain,
  LAB_CSS,
  Pill,
  RangeField,
  Readout,
  Segmented,
  clamp,
  fmt,
  niceStep,
  useElementSize,
  useRafLoop,
  useSettled,
} from './VariantClassicLab.ui';
import { SCHOOL, SHUTTLE, STADIUM, ZIGZAG, maxDisplacement, positionAt, sampleRoute } from './VariantClassicLab.geometry';
import FrameSim from './VariantClassicLab.frame';
import PointSim from './VariantClassicLab.point';

/* =========================================================================
 * Every user-facing string of this variant lives here, so the chosen design
 * can be moved into the locale files in one go.
 * ========================================================================= */
const UZ = {
  decimal: '.',
  card: {
    eyebrow: 'Virtual laboratoriya · Kinematika',
    title: 'Mexanikaning asosiy tushunchalari',
    tabsLabel: 'Simulyatorni tanlang',
    tabs: [
      { id: 'path', label: "Yo'l va ko'chish", sub: 'Asosiy tajriba' },
      { id: 'frame', label: 'Sanoq sistemasi', sub: 'Poyezd va perron' },
      { id: 'point', label: 'Moddiy nuqta', sub: 'Masshtab' },
    ],
  },
  common: {
    start: 'Boshlash',
    pause: "To'xtatish",
    resume: 'Davom etish',
    again: 'Yana boshlash',
    reset: 'Qayta',
    m: 'm',
    s: 's',
    ms: 'm/s',
  },
  facts: {
    title: 'Eslab qoling',
    items: [
      { term: 'Trayektoriya', text: "jism chizib o'tgan chiziq." },
      { term: "Yo'l s", text: 'trayektoriya uzunligi; skalyar kattalik, hech qachon kamaymaydi.' },
      { term: "Ko'chish Δr", text: "boshlang'ich nuqtadan oxirgi nuqtaga yo'nalgan vektor; |Δr| ≤ s." },
      { term: 'SI birliklari', text: 'uzunlik — metr (m), vaqt — sekund (s).' },
    ],
  },
  path: {
    routesLabel: 'Marshrut',
    routes: {
      stadium: { name: 'Stadion aylanasi', sub: '400 m · yopiq doira' },
      shuttle: { name: 'Borib-qaytish', sub: "50 m borib, 50 m qaytish" },
      school: { name: 'Maktabdan uyga', sub: "L-shakl · 400 m + 300 m" },
      zigzag: { name: 'Ilon izi', sub: '8 × 25 m zigzag' },
    },
    legend: {
      trajectory: "trayektoriya (uzunligi — yo'l s)",
      displacement: "ko'chish Δr",
      velocity: 'tezlik v',
      planned: 'rejadagi marshrut',
      cell: (c) => `1 katak = ${c} m`,
    },
    timeChip: (k) => `Vaqt ×${k} tezlashtirilgan`,
    sceneLabel: (name, s, d) => `Yuqoridan ko'rinish, ${name}. Yo'l ${s} metr, ko'chish ${d} metr.`,
    pathTag: (s) => `yo'l s = ${s} m`,
    dispTag: (d) => `ko'chish |Δr| = ${d} m`,
    dispZero: '|Δr| = 0',
    start: 'Start (O)',
    startShort: 'O',
    finish: 'Finish',
    axisX: 'x, m',
    axisY: 'y, m',
    school: 'Maktab',
    home: 'Uy',
    turn: 'Burilish',
    track: (n) => `${n} m`,
    readouts: { time: 'Vaqt', path: "Yo'l", disp: "Ko'chish", compare: 'Taqqoslash' },
    lapOf: (i, n) => `${i}-doira (jami ${n})`,
    tripOf: (i, n) => `${i}-qatnov (jami ${n})`,
    routeLen: (L) => `Marshrut ${L} m`,
    components: (dx, dy) => `Δx = ${dx} m · Δy = ${dy} m`,
    ratio: (r) => `|Δr| : s = ${r}`,
    ratioIdle: '|Δr| : s = —',
    alwaysLess: 'Har doim |Δr| ≤ s',
    timeSub: (k, real) => `Haqiqiy vaqt · ekranda ${real} s (×${k})`,
    barPath: "yo'l",
    barDisp: "ko'chish",
    speed: 'Yugurish tezligi',
    speedHint: (kmh) => `≈ ${kmh} km/soat · piyoda ≈ 1.5 m/s · yugurish ≈ 5 m/s`,
    laps: 'Doiralar soni',
    trips: 'Borib-kelishlar soni',
    times: (n) => `${n} marta`,
    info: {
      title: 'Marshrut haqida',
      length: 'Bir martalik yo‘l',
      final: "Oxirgi ko'chish",
      max: "Eng katta ko'chish",
    },
    graph: {
      title: 'Grafik: s(t) va |Δr|(t)',
      note: "Yo'l grafigi faqat ko'tariladi, ko'chish grafigi esa pasayishi ham mumkin.",
      t: 't, s',
      y: 's, |Δr|, m',
      label: "Yo'l va ko'chishning vaqtga bog'liqlik grafigi",
    },
    explain: {
      idle: "«Boshlash»ni bosing. Binafsha chiziq — jism chizadigan trayektoriya, uning uzunligi — yo'l. Ko'k strelka — startdan hozirgi joyga yo'nalgan ko'chish.",
      straight: "To'g'ri chiziq bo'ylab bir tomonga harakatda yo'l ko'chishga teng: s = |Δr|.",
      growing: "Trayektoriya egildi yoki sindi — endi yo'l ko'chishdan uzun: |Δr| < s.",
      shrinking: "Yo'l hech qachon kamaymaydi, ko'chish esa kamayishi mumkin: hozir siz startga yaqinlashyapsiz.",
      lapClosed: (n, s) => `${n}-doira yopildi: ko'chish yana 0 ga tushdi, yo'l esa ${s} m ga yetdi.`,
      doneZero: (s) => `Yo'l ${s} m, ko'chish 0 m: siz boshlagan joyingizga qaytdingiz.`,
      doneSchool: (s, d) =>
        `Yo'l ${s} m, ko'chish ${d} m: ko'chish — maktabdan uyga to'g'ri yo'nalgan vektor, u binolar ustidan «qush uchgandek» o'tadi.`,
      doneZigzag: (s, d, k) => `Yo'l ${s} m, ko'chish atigi ${d} m: ilon izi bo'ylab yurganda yo'l ko'chishdan ${k} marta uzun.`,
    },
  },
  frame: {
    frameLabel: 'Sanoq jismi',
    frames: {
      platform: { name: 'Perron', sub: 'Yer bilan bog‘langan' },
      train: { name: 'Poyezd', sub: 'Vagon bilan bog‘langan' },
    },
    dirLabel: "Yo'lovchi vagon ichida yuradi",
    dirs: { fwd: 'Oldinga', back: 'Orqaga' },
    trainSpeed: 'Poyezd tezligi',
    walkSpeed: "Yo'lovchi tezligi (vagonga nisbatan)",
    kmh: (v) => `≈ ${v} km/soat`,
    walkHint: 'Odatdagi yurish ≈ 1.2–1.5 m/s',
    trainHint: (v) => `≈ ${v} km/soat — poyezd perrondan endi jo'nab ketmoqda`,
    chip: (name) => `Sanoq jismi: ${name}`,
    chipSub: "Kamera, o'q va soat shu jismga bog'langan",
    axisPlatform: 'x, m (perron)',
    axisTrain: "x′, m (vagon)",
    clock: 'soat',
    passenger: "yo'lovchi",
    legendV: "yo'lovchining tezligi (tanlangan sistemada)",
    legendMarks: "har 1 s dagi o'rni — trayektoriya",
    vTag: (v) => `v = ${v} m/s`,
    vpTag: (v) => `v′ = ${v} m/s`,
    VTag: (v) => `poyezd ${v} m/s`,
    platformTag: (v) => `perron ${v} m/s`,
    xTag: (x) => `x = ${x} m`,
    xpTag: (x) => `x′ = ${x} m`,
    readouts: {
      time: 'Vaqt',
      timeSub: 'Ikkala soat bir xil ko‘rsatadi',
      platform: 'Perronga nisbatan',
      train: 'Vagonga nisbatan',
      path: (s) => `Trayektoriya uzunligi ${s} m`,
    },
    sceneLabel: (frame) => `Yon tomondan ko'rinish. Sanoq jismi: ${frame}.`,
    explain: {
      idle: "Sanoq jismini tanlang — perron yoki poyezd — va «Boshlash»ni bosing. Kamera, koordinata o'qi va soat tanlangan jismga bog'lanadi.",
      still: (u) => `Poyezd turibdi: perronga ham, vagonga ham nisbatan yo'lovchining tezligi bir xil — ${u} m/s.`,
      zero: "Qiziq holat: yo'lovchi vagonda orqaga yuryapti, perronga nisbatan esa joyida turibdi (v = 0).",
      fwd: (v) => `Perrondan qaraganda yo'lovchi ${v} m/s tezlikda ketmoqda: poyezd uni olib ketyapti, u esa vagonda yana oldinga yuryapti.`,
      backFwd: (v) => `Yo'lovchi vagonda orqaga yursa ham, perronga nisbatan oldinga ketyapti (${v} m/s): poyezd uni tezroq olib ketmoqda.`,
      backBack: (v) => `Yo'lovchi poyezddan tezroq orqaga yuryapti — perronga nisbatan ham orqaga, ${v} m/s tezlikda.`,
      train: (u, V) => `Vagondagi kuzatuvchi uchun yo'lovchi atigi ${u} m/s tezlikda yuryapti, perron esa ${V} m/s tezlikda orqaga «suzib» ketmoqda.`,
      trainRest: (V) => `Yo'lovchi vagonga nisbatan tinch turibdi (v′ = 0), perronga nisbatan esa ${V} m/s tezlikda harakatlanmoqda. Tinchlik ham nisbiy!`,
      done: (t) => `Ikkala soat ham t = ${t} s ni ko'rsatyapti, lekin o'rin, tezlik va trayektoriya har xil. Sanoq sistemasisiz «jism qayerda?» savoliga javob yo'q.`,
    },
  },
  point: {
    zoom: 'Masshtab',
    zoomHint: "Chapda — butun xarita, o'ngda — garaj darvozasi",
    presetsLabel: 'Tayyor masshtablar',
    presets: [
      { id: 'map', label: 'Xarita', sub: 'Toshkent → Samarqand' },
      { id: 'city', label: 'Shahar', sub: 'Samarqand' },
      { id: 'street', label: 'Avtovokzal', sub: 'Hovli' },
      { id: 'garage', label: 'Garaj', sub: 'Darvoza oldida' },
    ],
    cities: { tashkent: 'Toshkent', samarkand: 'Samarqand', jizzakh: 'Jizzax', gulistan: 'Guliston' },
    road: 'M39 avtoyo‘li',
    station: 'Avtovokzal',
    garage: 'Garaj',
    bus: 'avtobus',
    busPoint: 'avtobus = nuqta',
    gate: (w) => `darvoza ${w} m`,
    busW: (w) => `eni ${w} m`,
    busL: (l) => `uzunligi ${l} m`,
    viewWidth: 'Ko‘rinish kengligi',
    onScreen: 'Avtobus ekranda',
    ratio: "Masofa : o'lcham",
    verdict: 'Xulosa',
    verdicts: { point: 'Moddiy nuqta', maybe: 'Masalaga bog‘liq', body: 'Nuqta emas' },
    verdictSub: {
      point: "O'lchamni hisobga olmasa bo'ladi",
      maybe: "Savolga qarab hal qilinadi",
      body: "O'lcham javobga ta'sir qiladi",
    },
    sceneLabel: (w) => `Yuqoridan ko'rinish, ekran kengligi ${w}.`,
    explain: {
      point: (n) =>
        `Ko'rinayotgan masofa avtobus uzunligidan ${n} marta katta. «Samarqandga qachon yetadi?» degan savolga avtobusning o'lchami ta'sir qilmaydi — uni moddiy nuqta deb olamiz.`,
      maybe: (n) =>
        `Masofa avtobusdan atigi ${n} marta katta. Bekatgacha yo'lni so'rasak — nuqta, qaysi joyga sig'ishini so'rasak — nuqta emas. Hammasi masalaning shartiga bog'liq.`,
      body: "Garajga kirayotgan avtobus nuqta emas: darvoza eni 3.6 m, avtobus eni 2.55 m. O'lchamni hisobga olmasak, u darvozaga sig'adimi — bilib bo'lmaydi.",
    },
  },
};

/* ------------------------------------------------------------- palette */
const C = {
  path: '#7c3aed',
  pathText: '#c4b5fd',
  disp: '#2563eb',
  dispText: '#93c5fd',
  vel: '#059669',
  velText: '#6ee7b7',
  time: '#22d3ee',
  ink: '#0f172a',
};

/* ================================================================= card */

const TAB_ICONS = { path: Route, frame: TrainFront, point: ZoomIn };

export default function VariantClassicLab() {
  const [tab, setTab] = useState('path');
  const tabRefs = useRef({});
  const tabs = UZ.card.tabs;

  const onTabKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="glass rounded-3xl p-3 sm:p-5 lg:p-6 text-gray-100 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]" aria-labelledby="cl-title">
      <style>{LAB_CSS}</style>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 border border-white/10">
            <FlaskConical size={22} className="text-cyan-300" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-300/90">{UZ.card.eyebrow}</p>
            <h2 id="cl-title" className="text-lg sm:text-xl font-bold leading-tight">
              {UZ.card.title}
            </h2>
          </div>
        </div>

        <div role="tablist" aria-label={UZ.card.tabsLabel} className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
          {tabs.map((tb, i) => {
            const Icon = TAB_ICONS[tb.id];
            const on = tab === tb.id;
            return (
              <button
                key={tb.id}
                ref={(el) => {
                  tabRefs.current[tb.id] = el;
                }}
                role="tab"
                id={`cl-tab-${tb.id}`}
                aria-selected={on}
                aria-controls={`cl-panel-${tb.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setTab(tb.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-center transition-colors sm:flex-row sm:gap-2 sm:px-3.5 sm:text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                  on ? 'bg-white/[0.12] text-white shadow-inner' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.05]'
                }`}
              >
                <Icon size={17} className={on ? 'text-cyan-300' : ''} aria-hidden="true" />
                <span className="leading-tight">
                  <span className="block text-xs sm:text-sm font-semibold">{tb.label}</span>
                  <span className="hidden sm:block text-[11px] text-gray-500">{tb.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="mt-4 sm:mt-5" role="tabpanel" id={`cl-panel-${tab}`} aria-labelledby={`cl-tab-${tab}`}>
        {tab === 'path' && <PathSim key="path" />}
        {tab === 'frame' && <FrameSim key="frame" t={UZ.frame} common={UZ.common} decimal={UZ.decimal} />}
        {tab === 'point' && <PointSim key="point" t={UZ.point} decimal={UZ.decimal} />}
      </div>

      <footer className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-3 sm:p-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          <BookOpen size={14} aria-hidden="true" /> {UZ.facts.title}
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {UZ.facts.items.map((f) => (
            <div key={f.term} className="text-sm leading-snug">
              <dt className="inline font-semibold text-white">{f.term}</dt> <dd className="inline text-gray-400">— {f.text}</dd>
            </div>
          ))}
        </dl>
      </footer>
    </section>
  );
}

/* ====================================================== path vs displacement */

const ROUTES = [
  { id: 'stadium', icon: CircleDashed, geo: STADIUM, v0: 5, timeScale: 10, repeat: 'laps', labelSide: -1 },
  { id: 'shuttle', icon: ArrowLeftRight, geo: SHUTTLE, v0: 3, timeScale: 4, repeat: 'trips', labelSide: 1, traceOffset: 8 },
  { id: 'school', icon: School, geo: SCHOOL, v0: 1.5, timeScale: 30, repeat: null, labelSide: -1, gridOnTop: true },
  { id: 'zigzag', icon: Activity, geo: ZIGZAG, v0: 2, timeScale: 8, repeat: null, labelSide: -1, gridOnTop: true },
].map((r) => {
  const end = positionAt(r.geo.route, r.geo.route.length);
  return { ...r, finalD: Math.hypot(end.x, end.y), maxD: maxDisplacement(r.geo.route) };
});
const ROUTE_BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

const IDLE = { s: 0, t: 0, running: false, done: false, samples: [{ t: 0, s: 0, d: 0 }] };
const PAD_NARROW = { l: 30, r: 14, t: 44, b: 30 };
const PAD_WIDE = { l: 44, r: 24, t: 58, b: 36 };

function makeView(b, W, H, pad) {
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const k = Math.max(0.01, Math.min((W - pad.l - pad.r) / bw, (H - pad.t - pad.b) / bh));
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const ox = pad.l + (W - pad.l - pad.r) / 2;
  const oy = pad.t + (H - pad.t - pad.b) / 2;
  return {
    k,
    sx: (x) => ox + (x - cx) * k,
    sy: (y) => oy - (y - cy) * k,
    wx: (px) => cx + (px - ox) / k,
    wy: (py) => cy - (py - oy) / k,
  };
}

function PathSim() {
  const t = UZ.path;
  const dec = UZ.decimal;
  const [routeId, setRouteId] = useState('stadium');
  const def = ROUTE_BY_ID[routeId];
  const route = def.geo.route;
  const [reps, setReps] = useState(1);
  const [speed, setSpeed] = useState(def.v0);
  const [sim, setSim] = useState(IDLE);
  const nReps = def.repeat ? reps : 1;
  const total = route.length * nReps;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const v = speed;
      const dts = dt * def.timeScale;
      let s = p.s + v * dts;
      let tt = p.t + dts;
      let running = true;
      let done = false;
      if (s >= total - 1e-6) {
        tt = p.t + (total - p.s) / v;
        s = total;
        running = false;
        done = true;
      }
      const pos = positionAt(route, s);
      const d = Math.hypot(pos.x, pos.y);
      const last = p.samples[p.samples.length - 1];
      const samples = done || s - last.s >= total / 260 ? [...p.samples, { t: tt, s, d }] : p.samples;
      return { s, t: tt, running, done, samples };
    });
  });

  const pickRoute = (id) => {
    setRouteId(id);
    setSpeed(ROUTE_BY_ID[id].v0);
    setReps(1);
    setSim(IDLE);
  };
  const pickReps = (n) => {
    setReps(n);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- derived physics */
  const pos = positionAt(route, sim.s);
  const d = Math.hypot(pos.x, pos.y);
  const L = route.length;
  const lapIndex = sim.s <= 0 ? 1 : Math.min(nReps, Math.floor((sim.s - 1e-6) / L) + 1);
  const sInLap = sim.s - (lapIndex - 1) * L;
  const dRate = d > 1e-6 ? (pos.tx * pos.x + pos.ty * pos.y) / d : 1;

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) {
    if (sim.done && d < 0.05) key = 'doneZero';
    else key = routeId === 'school' ? 'doneSchool' : 'doneZigzag';
  } else if (sim.s > 0) {
    if (nReps > 1 && lapIndex > 1 && sInLap < 0.2 * L) key = `lap${lapIndex - 1}`;
    else if (sim.s - d < 0.02 + 0.002 * sim.s) key = 'straight';
    else if (dRate < -0.03) key = 'shrinking';
    else key = 'growing';
  }
  const settledKey = useSettled(key, key.startsWith('done') || key.startsWith('lap') || key === 'idle' ? 0 : 350);
  const ex = t.explain;
  const S = (n) => fmt(n, 0, dec);
  let text;
  if (settledKey === 'doneZero') text = ex.doneZero(S(sim.s));
  else if (settledKey === 'doneSchool') text = ex.doneSchool(S(sim.s), S(d));
  else if (settledKey === 'doneZigzag') text = ex.doneZigzag(S(sim.s), S(d), fmt(sim.s / Math.max(d, 1e-6), 1, dec));
  else if (settledKey.startsWith('lap')) {
    const n = Number(settledKey.slice(3));
    text = ex.lapClosed(n, S(n * L));
  } else text = ex[settledKey] ?? ex.idle;
  const tone = settledKey.startsWith('done') ? '#34d399' : settledKey === 'shrinking' ? '#60a5fa' : settledKey === 'growing' ? '#a78bfa' : '#22d3ee';

  /* ---- timing */
  const tEstimate = sim.t + (total - sim.s) / speed;
  const routeName = t.routes[routeId].name;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.routesLabel}</p>
          <Segmented
            label={t.routesLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={routeId}
            onChange={pickRoute}
            options={ROUTES.map((r) => ({ value: r.id, label: t.routes[r.id].name, sub: t.routes[r.id].sub, icon: r.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? UZ.common.pause : sim.done ? UZ.common.again : sim.s > 0 ? UZ.common.resume : UZ.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.s === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {UZ.common.reset}
          </Btn>
        </div>
      </div>

      {/* scene */}
      <PathScene
        def={def}
        sim={sim}
        pos={pos}
        d={d}
        speed={speed}
        lapIndex={lapIndex}
        sInLap={sInLap}
        nReps={nReps}
        ariaLabel={t.sceneLabel(routeName, fmt(sim.s, 1, dec), fmt(d, 1, dec))}
      />

      <Explain icon={Lightbulb} id={settledKey} tone={tone}>
        {text}
      </Explain>

      {/* readouts */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.path}
          symbol="s"
          value={fmt(sim.s, 1, dec)}
          unit="m"
          accent={C.path}
          textColor={C.pathText}
          sub={def.repeat && nReps > 1 ? (def.repeat === 'laps' ? t.lapOf(lapIndex, nReps) : t.tripOf(lapIndex, nReps)) : t.routeLen(S(total))}
        />
        <Readout
          label={t.readouts.disp}
          symbol="|Δr|"
          value={fmt(d, 1, dec)}
          unit="m"
          accent={C.disp}
          textColor={C.dispText}
          sub={t.components(fmt(pos.x, 1, dec), fmt(pos.y, 1, dec))}
        />
        <Readout
          label={t.readouts.time}
          symbol="t"
          value={fmt(sim.t, 1, dec)}
          unit="s"
          accent={C.time}
          textColor="#a5f3fc"
          sub={t.timeSub(def.timeScale, fmt(sim.t / def.timeScale, 1, dec))}
        />
        <Readout label={t.readouts.compare} accent="#e2e8f0">
          <CompareBars s={sim.s} d={d} total={total} />
        </Readout>
      </div>

      {/* controls + graph */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="cl-speed"
            label={t.speed}
            symbol="v"
            min={1}
            max={8}
            step={0.5}
            value={speed}
            onChange={setSpeed}
            accent={C.vel}
            display={`${fmt(speed, 1, dec)} m/s`}
            hint={t.speedHint(fmt(speed * 3.6, 0, dec))}
          />
          {def.repeat && (
            <div>
              <p className="mb-1.5 text-sm text-gray-300">{def.repeat === 'laps' ? t.laps : t.trips}</p>
              <Segmented
                label={def.repeat === 'laps' ? t.laps : t.trips}
                className="grid-cols-3"
                value={reps}
                onChange={pickReps}
                accent="#a78bfa"
                options={[1, 2, 3].map((n) => ({ value: n, label: t.times(n), sub: `${S(n * L)} m` }))}
              />
            </div>
          )}
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{t.info.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [t.info.length, `${S(L)} m`, C.pathText],
                [t.info.final, `${S(def.finalD)} m`, C.dispText],
                [t.info.max, `${fmt(def.maxD, 1, dec)} m`, C.dispText],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <PathGraph samples={sim.samples} tNow={sim.t} tMax={Math.max(tEstimate, 1)} sMax={total} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ comparison */

function CompareBars({ s, d, total }) {
  const t = UZ.path;
  const ps = clamp(s / total, 0, 1) * 100;
  const pd = clamp(d / total, 0, 1) * 100;
  return (
    <div className="mt-2 space-y-1.5">
      {[
        [t.barPath, ps, C.path],
        [t.barDisp, pd, C.disp],
      ].map(([name, pct, col]) => (
        <div key={name} className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[11px] text-gray-400">{name}</span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: col }} />
          </span>
        </div>
      ))}
      <p className="pt-0.5 text-xs tabular-nums text-gray-300">{s > 0.05 ? t.ratio(fmt(d / s, 2, UZ.decimal)) : t.ratioIdle}</p>
      <p className="text-[11px] text-gray-500">{t.alwaysLess}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- graph */

function PathGraph({ samples, tNow, tMax, sMax }) {
  const t = UZ.path;
  const [ref, { width }] = useElementSize();
  const H = 196;
  const pad = { l: 40, r: 12, t: 18, b: 24 };
  const W = Math.max(width, 200);
  const gx = (v) => pad.l + (v / tMax) * (W - pad.l - pad.r);
  const gy = (m) => H - pad.b - (m / sMax) * (H - pad.t - pad.b);
  const ptsS = samples.map((p) => `${gx(p.t).toFixed(1)},${gy(p.s).toFixed(1)}`).join(' ');
  const ptsD = samples.map((p) => `${gx(p.t).toFixed(1)},${gy(p.d).toFixed(1)}`).join(' ');
  const last = samples[samples.length - 1];
  const yTicks = [0, 0.5, 1].map((f) => f * sMax);
  const xTicks = [0, 0.5, 1].map((f) => f * tMax);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{t.graph.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: '#a78bfa' }} /> s(t)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: '#60a5fa' }} /> |Δr|(t)
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.graph.label} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke="rgba(255,255,255,0.08)" />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, 0)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(v, 0)}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {t.graph.t}
          </text>
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {t.graph.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {tNow > 0 && <line x1={gx(tNow)} x2={gx(tNow)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.35)" strokeDasharray="3 4" />}
          <polyline points={ptsS} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={ptsD} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {last && last.t > 0 && (
            <>
              <circle cx={gx(last.t)} cy={gy(last.s)} r="4" fill="#a78bfa" stroke="#0b0b16" strokeWidth="1.5" />
              <circle cx={gx(last.t)} cy={gy(last.d)} r="4" fill="#60a5fa" stroke="#0b0b16" strokeWidth="1.5" />
            </>
          )}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{t.graph.note}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function PathScene({ def, sim, pos, d, speed, lapIndex, sInLap, nReps, ariaLabel }) {
  const t = UZ.path;
  const dec = UZ.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 280);
  const narrow = W < 560;
  const pad = narrow ? PAD_NARROW : PAD_WIDE;
  // the scene height follows the route's shape, so wide routes leave no empty band
  const b = def.geo.bounds;
  const fitH = (W - pad.l - pad.r) / ((b.x1 - b.x0) / (b.y1 - b.y0)) + pad.t + pad.b;
  const H = Math.round(narrow ? clamp(fitH, W * 0.62, W * 1.0) : clamp(fitH, 340, 540));
  const view = useMemo(() => makeView(def.geo.bounds, W, H, pad), [def, W, H, pad]);
  const route = def.geo.route;
  const L = route.length;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };

  /* screen samples of one pass, with an optional sideways offset for the trace */
  const samples = useMemo(() => {
    const n = Math.min(1600, Math.max(200, Math.round((L * view.k) / 2)));
    return sampleRoute(route, n).map((p) => {
      const off = def.traceOffset ?? 0;
      return { s: p.s, x: view.sx(p.x) - p.ty * off, y: view.sy(p.y) - p.tx * off, tx: p.tx, ty: p.ty };
    });
  }, [route, view, L, def.traceOffset]);

  const plannedPts = useMemo(() => {
    const n = Math.min(800, Math.max(120, Math.round((L * view.k) / 4)));
    return sampleRoute(route, n)
      .map((p) => `${view.sx(p.x).toFixed(1)},${view.sy(p.y).toFixed(1)}`)
      .join(' ');
  }, [route, view, L]);

  const fullLapDone = sim.s >= L - 1e-6 && (lapIndex > 1 || sim.s >= L - 1e-6);
  const sTrace = fullLapDone && lapIndex > 1 ? sInLap : Math.min(sim.s, L);
  const tracePts = [];
  for (const p of samples) {
    if (p.s > sTrace) break;
    tracePts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  }
  const off = def.traceOffset ?? 0;
  const px = view.sx(pos.x);
  const py = view.sy(pos.y);
  if (sim.s > 0) tracePts.push(`${(px - pos.ty * off).toFixed(1)},${(py - pos.tx * off).toFixed(1)}`);
  const fullPts = fullLapDone ? samples.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') : null;

  const ox = view.sx(0);
  const oy = view.sy(0);
  const angle = (Math.atan2(-pos.ty, pos.tx) * 180) / Math.PI;
  const runR = narrow ? 7 : 8.5;

  /* labels */
  const showPathLabel = sim.s * view.k > 46;
  const sMid = fullLapDone ? L / 2 : sTrace / 2;
  const mid = positionAt(route, Math.max(sMid, 0.0001));
  const side = def.labelSide * (narrow ? 17 : 20);
  const pathLabel = { x: view.sx(mid.x) - mid.ty * (side + off * Math.sign(side)), y: view.sy(mid.y) - mid.tx * (side + off * Math.sign(side)) };
  if (def.id === 'shuttle') {
    pathLabel.x = view.sx(Math.min(sTrace, 50) / 2);
    pathLabel.y = view.sy(1.6) - (narrow ? 16 : 20);
  }
  if (def.id === 'zigzag' && sTrace > 25) pathLabel.y = view.sy(24) - (narrow ? 20 : 24);

  const ax = px - ox;
  const ay = py - oy;
  const alen = Math.hypot(ax, ay);
  const showDisp = d > 0.05 && alen > runR + 4;
  const ux = alen > 0 ? ax / alen : 1;
  const uy = alen > 0 ? ay / alen : 0;
  let dispLabel = null;
  if (showDisp && alen > 54) {
    const mx = ox + ax * 0.5;
    const my = oy + ay * 0.5;
    const nx = -uy;
    const ny = ux;
    const o = narrow ? 16 : 18;
    const c1 = { x: mx + nx * o, y: my + ny * o };
    const c2 = { x: mx - nx * o, y: my - ny * o };
    const dist = (a) => Math.hypot(a.x - pathLabel.x, a.y - pathLabel.y);
    dispLabel = !showPathLabel || dist(c1) >= dist(c2) ? c1 : c2;
    if (def.id === 'shuttle') dispLabel = { x: mx, y: view.sy(-1.6) + (narrow ? 42 : 48) };
  }

  const cell = niceStep(view.k, narrow ? 22 : 28);
  const moving = sim.s > 0 && !sim.done;
  const velLen = speed * (narrow ? 5 : 6.5);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="cl-scene block select-none">
          <defs>
            <radialGradient id="cl-vignette" cx="50%" cy="45%" r="75%">
              <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.55" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="#fbfcfe" />
          <GridLines view={view} W={W} H={H} cell={cell} />
          {def.id === 'stadium' && <StadiumDecor view={view} fs={fs} narrow={narrow} />}
          {def.id === 'shuttle' && <ShuttleDecor view={view} fs={fs} narrow={narrow} />}
          {def.id === 'school' && <SchoolDecor view={view} fs={fs} narrow={narrow} />}
          {def.id === 'zigzag' && <ZigzagDecor view={view} fs={fs} />}
          {def.gridOnTop && <GridLines view={view} W={W} H={H} cell={cell} overlay />}
          <rect width={W} height={H} fill="url(#cl-vignette)" pointerEvents="none" />
          <GridLabels view={view} W={W} H={H} padL={pad.l} padT={pad.t} cell={cell} fs={fs} />

          {/* planned route */}
          <polyline points={plannedPts} fill="none" stroke="#64748b" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 6" />

          {/* trajectory (path) */}
          {fullPts && <polyline points={fullPts} fill="none" stroke={C.path} strokeOpacity="0.45" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
          {tracePts.length > 1 && (
            <>
              <polyline points={tracePts.join(' ')} fill="none" stroke={C.path} strokeOpacity="0.18" strokeWidth="11" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={tracePts.join(' ')} fill="none" stroke={C.path} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}

          {/* start marker */}
          <circle cx={ox} cy={oy} r={narrow ? 5 : 6} fill="#fff" stroke={C.ink} strokeWidth="2.5" />
          <circle cx={ox} cy={oy} r={2} fill={C.ink} />

          {/* displacement */}
          {showDisp && (
            <Arrow x1={ox} y1={oy} x2={px - ux * (runR + 2)} y2={py - uy * (runR + 2)} color={C.disp} width={narrow ? 3 : 3.5} head={narrow ? 11 : 14} />
          )}

          {/* velocity */}
          {moving && (
            <Arrow
              x1={px + Math.cos((angle * Math.PI) / 180) * (runR + 3)}
              y1={py + Math.sin((angle * Math.PI) / 180) * (runR + 3)}
              x2={px + Math.cos((angle * Math.PI) / 180) * (runR + 3 + velLen)}
              y2={py + Math.sin((angle * Math.PI) / 180) * (runR + 3 + velLen)}
              color={C.vel}
              width={2.75}
              head={10}
            />
          )}

          {/* runner */}
          <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
            {sim.running && <circle r={runR + 6} fill={C.path} className="cl-pulse" />}
            <circle r={runR} fill={C.ink} stroke="#fff" strokeWidth="2.5" />
            <path d={`M${runR * 0.62},0 L${-runR * 0.42},${-runR * 0.5} L${-runR * 0.18},0 L${-runR * 0.42},${runR * 0.5} Z`} fill="#fff" />
          </g>

          {/* labels */}
          {showPathLabel && <Pill x={pathLabel.x} y={pathLabel.y} text={t.pathTag(fmt(sim.s, 1, dec))} bg={C.path} size={fs} box={box} />}
          {dispLabel && <Pill x={dispLabel.x} y={dispLabel.y} text={t.dispTag(fmt(d, 1, dec))} bg={C.disp} size={fs} box={box} />}
          {sim.s > 0 && d <= 0.05 && <Pill x={ox} y={oy - 22} text={t.dispZero} bg={C.disp} size={fs} box={box} />}
          {moving && velLen > 18 && (
            <text
              x={px + Math.cos((angle * Math.PI) / 180) * (runR + 12 + velLen)}
              y={py + Math.sin((angle * Math.PI) / 180) * (runR + 12 + velLen) + 4}
              textAnchor="middle"
              fontSize={fs + 1}
              fontStyle="italic"
              fontWeight="700"
              fill={C.vel}
              stroke="#fff"
              strokeWidth="3"
              paintOrder="stroke"
            >
              v
            </text>
          )}
          {sim.s === 0 && <Pill x={ox} y={oy + (narrow ? 20 : 24)} text={narrow ? t.startShort : t.start} bg={C.ink} size={fs} box={box} />}
        </svg>
      </div>

      {/* overlays */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <ul className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[12px] text-slate-600 shadow-sm backdrop-blur">
          <LegendItem color={C.path} label={t.legend.trajectory} kind="line" />
          <LegendItem color={C.disp} label={t.legend.displacement} kind="arrow" />
          <LegendItem color={C.vel} label={t.legend.velocity} kind="arrow" />
          <LegendItem color="#64748b" label={t.legend.planned} kind="dash" />
          <li className="text-slate-400">·</li>
          <li className="tabular-nums">{t.legend.cell(fmt(cell, Number.isInteger(cell) ? 0 : 1, dec))}</li>
        </ul>
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] sm:text-[12px] font-medium text-slate-600 shadow-sm">
            <Timer size={14} className="text-cyan-600" aria-hidden="true" />
            {t.timeChip(def.timeScale)}
          </span>
          {nReps > 1 && sim.s > 0 && (
            <span className="rounded-lg bg-violet-600 px-2 py-1 text-[11px] sm:text-[12px] font-semibold text-white shadow">
              {def.repeat === 'laps' ? t.lapOf(lapIndex, nReps) : t.tripOf(lapIndex, nReps)}
            </span>
          )}
        </div>
      </div>
      <ul className="flex sm:hidden flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <LegendItem color={C.path} label={t.legend.trajectory} kind="line" />
        <LegendItem color={C.disp} label={t.legend.displacement} kind="arrow" />
        <LegendItem color={C.vel} label={t.legend.velocity} kind="arrow" />
        <li className="tabular-nums">{t.legend.cell(fmt(cell, Number.isInteger(cell) ? 0 : 1, dec))}</li>
      </ul>
    </div>
  );
}

function LegendItem({ color, label, kind }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="20" height="10" aria-hidden="true">
        {kind === 'dash' ? (
          <line x1="1" y1="5" x2="19" y2="5" stroke={color} strokeWidth="1.6" strokeDasharray="4 3" />
        ) : (
          <line x1="1" y1="5" x2={kind === 'arrow' ? 13 : 19} y2="5" stroke={color} strokeWidth="3" strokeLinecap="round" />
        )}
        {kind === 'arrow' && <path d="M19,5 L12,1 L12,9 Z" fill={color} />}
      </svg>
      <span>{label}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ grid */

function gridTicks(view, W, H, cell) {
  return {
    xs: Array.from({ length: Math.max(0, Math.floor(view.wx(W) / cell) - Math.ceil(view.wx(0) / cell) + 1) }, (_, n) => Math.ceil(view.wx(0) / cell) + n),
    ys: Array.from({ length: Math.max(0, Math.floor(view.wy(0) / cell) - Math.ceil(view.wy(H) / cell) + 1) }, (_, n) => Math.ceil(view.wy(H) / cell) + n),
  };
}

/** Metre grid. `overlay` draws faint lines on top of the scenery (for maps where the decor is opaque). */
const GridLines = memo(function GridLines({ view, W, H, cell, overlay }) {
  const { xs, ys } = gridTicks(view, W, H, cell);
  const minor = overlay ? 'rgba(100,116,139,0.16)' : '#e2e8f0';
  const axis = overlay ? 'rgba(71,85,105,0.55)' : '#94a3b8';
  return (
    <g pointerEvents="none">
      {xs.map((i) => (
        <line key={`gx${i}`} x1={view.sx(i * cell)} x2={view.sx(i * cell)} y1={0} y2={H} stroke={i === 0 ? axis : minor} strokeWidth={i === 0 ? 1.2 : 1} />
      ))}
      {ys.map((j) => (
        <line key={`gy${j}`} x1={0} x2={W} y1={view.sy(j * cell)} y2={view.sy(j * cell)} stroke={j === 0 ? axis : minor} strokeWidth={j === 0 ? 1.2 : 1} />
      ))}
    </g>
  );
});

/** Axis numbers along the bottom and left edges, drawn above the scenery. */
const GridLabels = memo(function GridLabels({ view, W, H, padL, padT, cell, fs }) {
  const t = UZ.path;
  const { xs, ys } = gridTicks(view, W, H, cell);
  const every = Math.max(1, Math.ceil((fs * 4.2) / (cell * view.k)));
  return (
    <g pointerEvents="none">
      <rect x={0} y={H - 22} width={W} height={22} fill="#fbfcfe" opacity="0.9" />
      <rect x={0} y={0} width={padL - 8} height={H - 22} fill="#fbfcfe" opacity="0.9" />
      {xs
        .filter((i) => i % every === 0 && view.sx(i * cell) > padL - 10 && view.sx(i * cell) < W - 40)
        .map((i) => (
          <text key={`lx${i}`} x={view.sx(i * cell)} y={H - 8} textAnchor="middle" fontSize={fs - 1} fill={i === 0 ? '#0f172a' : '#64748b'} fontWeight={i === 0 ? 700 : 400}>
            {fmt(i * cell, Number.isInteger(i * cell) ? 0 : 1)}
          </text>
        ))}
      {ys
        .filter((j) => j % every === 0 && view.sy(j * cell) > padT + 4 && view.sy(j * cell) < H - 26)
        .map((j) => (
          <text key={`ly${j}`} x={6} y={view.sy(j * cell) + 4} fontSize={fs - 1} fill={j === 0 ? '#0f172a' : '#64748b'} fontWeight={j === 0 ? 700 : 400}>
            {fmt(j * cell, Number.isInteger(j * cell) ? 0 : 1)}
          </text>
        ))}
      <text x={W - 8} y={H - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {t.axisX}
      </text>
      <text x={6} y={padT - 6} fontSize={fs - 1} fontWeight="700" fill="#475569">
        {t.axisY}
      </text>
    </g>
  );
});

/* ---------------------------------------------------------------- decor */

function stadiumPath(view, r) {
  const { Ls, R } = STADIUM;
  const rp = r * view.k;
  return [
    `M${view.sx(0)},${view.sy(R - r)}`,
    `L${view.sx(Ls)},${view.sy(R - r)}`,
    `A${rp},${rp} 0 0 0 ${view.sx(Ls)},${view.sy(R + r)}`,
    `L${view.sx(0)},${view.sy(R + r)}`,
    `A${rp},${rp} 0 0 0 ${view.sx(0)},${view.sy(R - r)}`,
    'Z',
  ].join(' ');
}

const StadiumDecor = memo(function StadiumDecor({ view, fs, narrow }) {
  const { Ls, R, kerb, laneW, lanes, route } = STADIUM;
  const t = UZ.path;
  const k = view.k;
  const width = laneW * lanes;
  const cx = Ls / 2;
  const P = (x, y) => `${view.sx(cx + x)},${view.sy(R + y)}`;
  const rect = (x0, y0, x1, y1) => `M${P(x0, y0)} L${P(x1, y0)} L${P(x1, y1)} L${P(x0, y1)} Z`;
  const marks = [100, 200, 300].map((s) => {
    const p = positionAt(route, s);
    const nx = p.ty;
    const ny = -p.tx;
    return { s, x: view.sx(p.x + nx * (width + 6)), y: view.sy(p.y + ny * (width + 6)), x0: view.sx(p.x - nx * 0.3), y0: view.sy(p.y - ny * 0.3), x1: view.sx(p.x + nx * (width - 0.3)), y1: view.sy(p.y + ny * (width - 0.3)) };
  });
  return (
    <g>
      <path d={stadiumPath(view, kerb + width / 2)} fill="none" stroke="#e7a08a" strokeWidth={width * k} />
      <path d={stadiumPath(view, kerb)} fill="#dcefd9" stroke="#9ca3af" strokeWidth={1} />
      {Array.from({ length: lanes + 1 }, (_, i) => (
        <path key={i} d={stadiumPath(view, kerb + i * laneW)} fill="none" stroke="#fff" strokeOpacity={i === 0 || i === lanes ? 0.95 : 0.7} strokeWidth={i === 0 || i === lanes ? 1.5 : 1} />
      ))}
      {/* football pitch */}
      <g fill="none" stroke="#fff" strokeWidth={1.3} strokeOpacity="0.95">
        <path d={rect(-52.5, -34, 52.5, 34)} />
        <line x1={view.sx(cx)} x2={view.sx(cx)} y1={view.sy(R - 34)} y2={view.sy(R + 34)} />
        <circle cx={view.sx(cx)} cy={view.sy(R)} r={9.15 * k} />
        <path d={rect(-52.5, -20.16, -36, 20.16)} />
        <path d={rect(36, -20.16, 52.5, 20.16)} />
        <path d={rect(-52.5, -9.16, -47, 9.16)} />
        <path d={rect(47, -9.16, 52.5, 9.16)} />
      </g>
      {/* start / finish line across all lanes */}
      <line x1={view.sx(0)} x2={view.sx(0)} y1={view.sy(0.3)} y2={view.sy(-width + 0.3)} stroke="#fff" strokeWidth={3} />
      <line x1={view.sx(0)} x2={view.sx(0)} y1={view.sy(0.3)} y2={view.sy(-width + 0.3)} stroke={C.ink} strokeWidth={1} strokeDasharray="2 2" />
      {!narrow &&
        marks.map((m) => (
          <g key={m.s}>
            <line x1={m.x0} y1={m.y0} x2={m.x1} y2={m.y1} stroke="#fff" strokeWidth={2} />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#9a3412">
              {t.track(m.s)}
            </text>
          </g>
        ))}
    </g>
  );
});

const ShuttleDecor = memo(function ShuttleDecor({ view, fs, narrow }) {
  const t = UZ.path;
  const ticks = [];
  for (let x = 0; x <= 50; x += 5) {
    const major = x % 10 === 0;
    ticks.push(
      <g key={x}>
        <line x1={view.sx(x)} x2={view.sx(x)} y1={view.sy(-1.6)} y2={view.sy(-1.6) + (major ? 9 : 5)} stroke="#475569" strokeWidth={major ? 1.5 : 1} />
        {major && (
          <text x={view.sx(x)} y={view.sy(-1.6) + 22} textAnchor="middle" fontSize={fs} fontWeight="600" fill="#334155">
            {x} m
          </text>
        )}
      </g>,
    );
  }
  return (
    <g>
      <rect x={view.sx(-3)} y={view.sy(1.6)} width={56 * view.k} height={3.2 * view.k} rx={4} fill="#f3c9b8" />
      <line x1={view.sx(-3)} x2={view.sx(53)} y1={view.sy(1.6)} y2={view.sy(1.6)} stroke="#fff" strokeWidth={2} />
      <line x1={view.sx(-3)} x2={view.sx(53)} y1={view.sy(-1.6)} y2={view.sy(-1.6)} stroke="#fff" strokeWidth={2} />
      {ticks}
      {/* turn cone at 50 m */}
      <g transform={`translate(${view.sx(50)} ${view.sy(0)})`}>
        <circle r={narrow ? 6 : 8} fill="#f97316" stroke="#fff" strokeWidth={2} transform={`translate(${narrow ? 12 : 16} 0)`} />
        <circle r={narrow ? 2 : 3} fill="#fff" transform={`translate(${narrow ? 12 : 16} 0)`} />
      </g>
      <text x={view.sx(50) + (narrow ? 12 : 16)} y={view.sy(1.6) - 10} textAnchor="middle" fontSize={fs} fontWeight="600" fill="#c2410c">
        {t.turn}
      </text>
    </g>
  );
});

function hash(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const SchoolDecor = memo(function SchoolDecor({ view, fs, narrow }) {
  const t = UZ.path;
  const { streetsX, streetsY, streetW } = SCHOOL;
  const k = view.k;
  const half = streetW / 2;
  const blocks = [];
  for (let i = 0; i < streetsX.length - 1; i += 1) {
    for (let j = 0; j < streetsY.length - 1; j += 1) {
      const x0 = streetsX[i] + half + 6;
      const x1 = streetsX[i + 1] - half - 6;
      const y0 = streetsY[j] + half + 6;
      const y1 = streetsY[j + 1] - half - 6;
      const id = i * 10 + j;
      const park = id === 12 || id === 31;
      if (park) {
        blocks.push(<rect key={`p${id}`} x={view.sx(x0)} y={view.sy(y1)} width={(x1 - x0) * k} height={(y1 - y0) * k} rx={6} fill="#d9f0d3" />);
        for (let n = 0; n < 9; n += 1) {
          const tx = x0 + 12 + hash(id * 31 + n) * (x1 - x0 - 24);
          const ty = y0 + 12 + hash(id * 17 + n * 7) * (y1 - y0 - 24);
          blocks.push(<circle key={`t${id}-${n}`} cx={view.sx(tx)} cy={view.sy(ty)} r={Math.max(3, 7 * k)} fill="#86c98a" opacity="0.85" />);
        }
        continue;
      }
      const split = hash(id) > 0.45;
      const parts = split
        ? [
            [x0, y0, (x0 + x1) / 2 - 4, y1],
            [(x0 + x1) / 2 + 4, y0, x1, (y0 + y1) / 2 + 10],
            [(x0 + x1) / 2 + 4, (y0 + y1) / 2 + 18, x1, y1],
          ]
        : [
            [x0, y0, x1, (y0 + y1) / 2 - 4],
            [x0, (y0 + y1) / 2 + 4, x1, y1],
          ];
      parts.forEach(([a, b, c, e], n) =>
        blocks.push(<rect key={`b${id}-${n}`} x={view.sx(a)} y={view.sy(e)} width={Math.max(0, (c - a) * k)} height={Math.max(0, (e - b) * k)} rx={3} fill="#e2e8f0" stroke="#cbd5e1" />),
      );
    }
  }
  const school = { x0: -60, x1: 40, y0: -62, y1: -14 };
  const home = { x0: 414, x1: 452, y0: 280, y1: 318 };
  return (
    <g>
      {/* streets */}
      {streetsY.map((y) => (
        <rect key={`sy${y}`} x={view.sx(-400)} y={view.sy(y + half)} width={1400 * k} height={streetW * k} fill="#f1f5f9" />
      ))}
      {streetsX.map((x) => (
        <rect key={`sx${x}`} x={view.sx(x - half)} y={view.sy(900)} width={streetW * k} height={1800 * k} fill="#f1f5f9" />
      ))}
      {blocks}
      {/* school */}
      <rect x={view.sx(school.x0)} y={view.sy(school.y1)} width={(school.x1 - school.x0) * k} height={(school.y1 - school.y0) * k} rx={4} fill="#fde68a" stroke="#d97706" />
      <text x={view.sx((school.x0 + school.x1) / 2)} y={view.sy((school.y0 + school.y1) / 2) + 4} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#92400e">
        {t.school}
      </text>
      {/* home */}
      <rect x={view.sx(home.x0)} y={view.sy(home.y1)} width={(home.x1 - home.x0) * k} height={(home.y1 - home.y0) * k} rx={4} fill="#bbf7d0" stroke="#16a34a" />
      <text
        x={view.sx(narrow ? home.x0 - 4 : home.x1 + 6)}
        y={view.sy((home.y0 + home.y1) / 2) + 4}
        textAnchor={narrow ? 'end' : 'start'}
        fontSize={fs}
        fontWeight="700"
        fill="#166534"
        dy={narrow ? -18 : 0}
      >
        {t.home}
      </text>
      <circle cx={view.sx(400)} cy={view.sy(300)} r={narrow ? 4 : 5} fill="#16a34a" stroke="#fff" strokeWidth={2} />
    </g>
  );
});

const ZigzagDecor = memo(function ZigzagDecor({ view, fs }) {
  const t = UZ.path;
  const k = view.k;
  const { vertices } = ZIGZAG;
  return (
    <g>
      <rect x={view.sx(-4)} y={view.sy(28)} width={64 * k} height={33 * k} rx={8} fill="#e7f5e3" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={view.sx(-4 + i * 8)} y={view.sy(28)} width={4 * k} height={33 * k} fill="#dcefd6" />
      ))}
      {vertices.slice(1, -1).map(([x, y]) => (
        <g key={`${x},${y}`} transform={`translate(${view.sx(x)} ${view.sy(y)})`}>
          <circle r={Math.max(4, 0.9 * k)} fill="#f97316" stroke="#fff" strokeWidth={2} />
          <circle r={Math.max(1.5, 0.3 * k)} fill="#fff" />
        </g>
      ))}
      <line x1={view.sx(56)} x2={view.sx(56)} y1={view.sy(-3.5)} y2={view.sy(3.5)} stroke={C.ink} strokeWidth={3} strokeDasharray="3 3" />
      <text x={view.sx(56)} y={view.sy(-3.5) + fs + 4} textAnchor="middle" fontSize={fs} fontWeight="700" fill={C.ink}>
        {t.finish}
      </text>
    </g>
  );
});
