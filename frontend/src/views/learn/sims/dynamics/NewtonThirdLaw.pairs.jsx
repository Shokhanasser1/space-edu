import { useState } from 'react';
import { Apple, ArrowRight, BookOpen, Check, Lightbulb, RotateCcw, Snowflake, X } from 'lucide-react';
import { Btn, Explain, Readout, clamp, fmt, useRafLoop } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, ForceArrow, Panel, Person, ScaleBar, SimScene, Tag, Toolbar, rich, sci } from './NewtonThirdLaw.parts';

/**
 * "Which force is the pair?" - three everyday situations with every force
 * drawn where it acts. A question picks one force; the reader picks its
 * partner and the four conditions of a third-law pair are checked live:
 * equal size, opposite direction, A acts on B while B acts on A (so the two
 * forces sit on different bodies), and the same nature (gravity, elastic,
 * friction). The classic traps are there on purpose: the weight mg and the
 * support force N on a book are equal and opposite, yet both act on the book
 * and differ in nature - they balance, they are not a pair.
 *
 * Arrows are coloured by the nature of the force; the dot at the tail has
 * the colour of the body the force acts on. After the apple question the
 * apple can be let go: the Earth pulls it with 1.96 N and it pulls the Earth
 * with 1.96 N, but a = F/m gives 9.8 m/s² for the apple and 3.3·10⁻²⁵ m/s²
 * for the Earth.
 */

const G = 9.8;
const M_EARTH = 5.97e24; // kg
const M_APPLE = 0.2; // kg
const BOX = { x0: 0, x1: 13, y0: 0, y1: 5 };
const NATURE_COL = { gravity: COL.gravity, elastic: COL.elastic, friction: COL.friction };
const BODY_COL = { apple: '#ef4444', earth: '#65a30d', stem: '#92400e', book: '#2563eb', table: '#a16207', boy: COL.b1, sled: COL.b2, ground: '#64748b' };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const VEC = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
const APPLE_Y0 = 2.7; // apple centre on the branch
const APPLE_R = 0.32;
const GROUND = { apple: 1, book: 0.9, sled: 1 };

const SITS = {
  apple: {
    icon: Apple,
    box: { x0: 1.7, x1: 9.9, y0: 0, y1: 5.2 },
    kF: 1.2 / 1.96,
    unitN: 1,
    forces: [
      { id: 'aG', sym: 'mg', from: 'earth', on: 'apple', nature: 'gravity', F: 1.96, at: [6.5, APPLE_Y0], dir: 'down' },
      { id: 'aT', sym: 'T', from: 'stem', on: 'apple', nature: 'elastic', F: 1.96, at: [6.34, APPLE_Y0 + APPLE_R], dir: 'up', left: true },
      { id: 'aT2', sym: 'T′', from: 'apple', on: 'stem', nature: 'elastic', F: 1.96, at: [6.68, 4.42], dir: 'down' },
      { id: 'aG2', sym: 'F′', from: 'apple', on: 'earth', nature: 'gravity', F: 1.96, at: [7.2, 0.4], dir: 'up' },
    ],
    questions: [{ target: 'aG', options: ['aT', 'aG2', 'aT2'], answer: 'aG2' }],
  },
  book: {
    icon: BookOpen,
    box: { x0: 3.1, x1: 12, y0: 0.1, y1: 4.2 },
    kF: 1.2 / 9.8,
    unitN: 5,
    forces: [
      { id: 'bG', sym: 'mg', from: 'earth', on: 'book', nature: 'gravity', F: 9.8, at: [5.8, 2.85], dir: 'down', left: true },
      { id: 'bN', sym: 'N', from: 'table', on: 'book', nature: 'elastic', F: 9.8, at: [6.6, 2.6], dir: 'up' },
      { id: 'bP', sym: 'P', from: 'book', on: 'table', nature: 'elastic', F: 9.8, at: [7.4, 2.6], dir: 'down' },
      { id: 'bG2', sym: 'F′', from: 'book', on: 'earth', nature: 'gravity', F: 9.8, at: [11.4, 0.35], dir: 'up' },
    ],
    questions: [
      { target: 'bN', options: ['bG', 'bP', 'bG2'], answer: 'bP' },
      { target: 'bG', options: ['bN', 'bG2', 'bP'], answer: 'bG2' },
    ],
  },
  sled: {
    icon: Snowflake,
    box: { x0: 1.9, x1: 9.4, y0: 0.15, y1: 3.9 },
    kF: 1.2 / 60,
    unitN: 30,
    forces: [
      { id: 'sT', sym: 'T', from: 'boy', on: 'sled', nature: 'elastic', F: 60, at: [5.1, 2.3], dir: 'right', link: [5.1, 2.0] },
      { id: 'sT2', sym: 'T′', from: 'sled', on: 'boy', nature: 'elastic', F: 60, at: [6.95, 1.7], dir: 'left', link: [6.95, 2.0] },
      { id: 'sF', sym: 'f₁', from: 'ground', on: 'sled', nature: 'friction', F: 60, at: [3.9, 1.07], dir: 'left' },
      { id: 'sFb', sym: 'f₂', from: 'ground', on: 'boy', nature: 'friction', F: 60, at: [7.15, 1.07], dir: 'right' },
      { id: 'sFb2', sym: 'f₂′', from: 'boy', on: 'ground', nature: 'friction', F: 60, at: [7.15, 0.62], dir: 'left' },
    ],
    questions: [
      { target: 'sT', options: ['sF', 'sT2', 'sFb2'], answer: 'sT2' },
      { target: 'sFb', options: ['sT2', 'sFb2', 'sF'], answer: 'sFb2' },
    ],
  },
};
const ORDER = ['apple', 'book', 'sled'];
const TOTAL = ORDER.reduce((n, s) => n + SITS[s].questions.length, 0);
const byId = (sit, fid) => SITS[sit].forces.find((f) => f.id === fid);

/** The four conditions of a third-law pair, checked for two forces. */
function criteria(a, b) {
  return {
    equal: Math.abs(a.F - b.F) < 1e-9,
    opposite: OPP[a.dir] === b.dir,
    mutual: a.from === b.on && a.on === b.from,
    nature: a.nature === b.nature,
  };
}

export default function PairsSim({ T }) {
  const tx = T.pairs;
  const dec = T.decimal;
  const [sit, setSit] = useState('apple');
  const [qi, setQi] = useState(0);
  const [choice, setChoice] = useState(null);
  const [results, setResults] = useState({});
  const [fall, setFall] = useState({ running: false, t: 0, dropped: false });

  const S = SITS[sit];
  const q = S.questions[qi];
  const target = byId(sit, q.target);
  const chosen = choice ? byId(sit, choice) : null;
  const right = choice === q.answer;
  const qKey = `${sit}-${qi}`;
  const score = Object.values(results).filter(Boolean).length;
  const answered = Object.keys(results).length;

  const fallH = APPLE_Y0 - GROUND.apple - APPLE_R; // m the apple falls
  const tFall = Math.sqrt((2 * fallH) / G);
  useRafLoop(fall.running, (dt) => {
    setFall((p) => {
      if (!p.running) return p;
      const t = p.t + dt;
      return t >= tFall ? { running: false, t: tFall, dropped: true } : { ...p, t };
    });
  });
  const appleY = APPLE_Y0 - 0.5 * G * fall.t * fall.t;
  const appleFree = fall.running || fall.dropped;

  const pickSit = (id) => {
    setSit(id);
    setQi(0);
    setChoice(null);
    setFall({ running: false, t: 0, dropped: false });
  };
  const choose = (id) => {
    setChoice(id);
    if (results[qKey] === undefined) setResults((r) => ({ ...r, [qKey]: id === q.answer }));
  };
  const next = () => {
    if (qi + 1 < S.questions.length) {
      setQi(qi + 1);
      setChoice(null);
    } else pickSit(ORDER[(ORDER.indexOf(sit) + 1) % ORDER.length]);
  };
  const reset = () => {
    setResults((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith(`${sit}-`))));
    setQi(0);
    setChoice(null);
    setFall({ running: false, t: 0, dropped: false });
  };
  const drop = () => setFall({ running: true, t: 0, dropped: false });

  /* ---- explanation */
  const st = tx.sits[sit];
  const qt = st.questions[qi];
  let key = 'ask';
  let text = tx.ask;
  let tone = '#22d3ee';
  if (appleFree) {
    key = 'drop';
    text = tx.dropped(fmt(M_APPLE * G, 2, dec), sci(M_APPLE * G / M_EARTH, dec));
    tone = '#a78bfa';
  } else if (chosen) {
    key = `${qKey}-${choice}`;
    text = right ? qt.right : qt.wrong[choice];
    tone = right ? '#34d399' : '#f87171';
  }
  if (!appleFree && chosen && right && answered === TOTAL) text = `${text} ${tx.allDone(score, TOTAL)}`;

  const legend = [
    { label: tx.legend.gravity, color: COL.gravity, kind: 'arrow' },
    { label: tx.legend.elastic, color: COL.elastic, kind: 'arrow' },
    { label: tx.legend.friction, color: COL.friction, kind: 'arrow' },
  ];
  const crit = chosen ? criteria(target, chosen) : null;
  const isLast = qi + 1 >= S.questions.length;

  /* ---- readout tiles for the situation */
  let tiles;
  if (sit === 'apple')
    tiles = [
      { label: st.tiles[0], symbol: 'mg', value: fmt(M_APPLE * G, 2, dec), unit: T.common.N, accent: COL.gravity, color: COL.gravityText, sub: st.tileSubs[0] },
      { label: st.tiles[1], symbol: 'a', value: appleFree ? fmt(G, 1, dec) : '0', unit: T.ms2, accent: BODY_COL.apple, color: '#fca5a5', sub: st.tileSubs[1] },
      { label: st.tiles[2], symbol: rich(tx.aEarthSym), value: appleFree ? sci(M_APPLE * G / M_EARTH, dec) : '0', unit: T.ms2, accent: BODY_COL.earth, color: '#bef264', sub: st.tileSubs[2] },
    ];
  else if (sit === 'book')
    tiles = [
      { label: st.tiles[0], symbol: 'mg', value: fmt(9.8, 1, dec), unit: T.common.N, accent: COL.gravity, color: COL.gravityText, sub: st.tileSubs[0] },
      { label: st.tiles[1], symbol: 'N', value: fmt(9.8, 1, dec), unit: T.common.N, accent: COL.elastic, color: COL.elasticText, sub: st.tileSubs[1] },
      { label: st.tiles[2], symbol: 'P', value: fmt(9.8, 1, dec), unit: T.common.N, accent: COL.elastic, color: COL.elasticText, sub: st.tileSubs[2] },
    ];
  else
    tiles = [
      { label: st.tiles[0], symbol: 'T', value: '60', unit: T.common.N, accent: COL.elastic, color: COL.elasticText, sub: st.tileSubs[0] },
      { label: st.tiles[1], symbol: 'f₁', value: '60', unit: T.common.N, accent: COL.friction, color: COL.frictionText, sub: st.tileSubs[1] },
      { label: st.tiles[2], symbol: 'f₂', value: '60', unit: T.common.N, accent: COL.friction, color: COL.frictionText, sub: st.tileSubs[2] },
    ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={sit}
        onChange={pickSit}
        options={ORDER.map((s) => {
          const n = SITS[s].questions.length;
          const ok = SITS[s].questions.filter((_, i) => results[`${s}-${i}`] !== undefined).length;
          return { value: s, label: tx.sits[s].name, sub: tx.progress(ok, n), icon: SITS[s].icon };
        })}
      >
        {sit === 'apple' && (
          <Btn variant="primary" icon={Apple} onClick={drop} disabled={!(results['apple-0'] !== undefined && right) || appleFree} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {tx.drop}
          </Btn>
        )}
        <Btn icon={RotateCcw} onClick={reset} className={`min-h-[52px] text-[15px] ${sit === 'apple' ? '' : 'col-span-2'}`}>
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={
          <>
            <span className="font-medium sm:hidden">{tx.chipShort}</span>
            <span className="hidden font-medium sm:inline">{tx.chip}</span>
          </>
        }
        ariaLabel={st.sceneLabel}
        height={(W, narrow) => (narrow ? clamp(W * 0.75, 240, 320) : clamp((W - 40) / ((BOX.x1 - BOX.x0) / (BOX.y1 - BOX.y0)) + 72, 340, 480))}
      >
        {(W, H, narrow) => (
          <PairsDrawing
            W={W}
            H={H}
            narrow={narrow}
            sit={sit}
            target={target.id}
            options={q.options}
            choice={choice}
            right={right}
            appleY={appleY}
            appleFree={appleFree}
            falling={fall.running}
            tx={tx}
            T={T}
          />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={key} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.score} value={`${score} / ${TOTAL}`} accent="#22d3ee" textColor="#a5f3fc" sub={tx.scoreSub(answered, TOTAL)} />
        {tiles.map((tl) => (
          <Readout key={tl.label} label={tl.label} symbol={tl.symbol} value={tl.value} unit={tl.unit} accent={tl.accent} textColor={tl.color} sub={tl.sub} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-3 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.questionN(qi + 1, S.questions.length)}</p>
            <p className="mt-1 text-[15px] leading-snug text-gray-100">
              {tx.question(st.forces[target.id], target.sym)}
            </p>
          </div>
          <div role="group" aria-label={tx.pick} className="grid gap-2">
            {q.options.map((oid) => {
              const f = byId(sit, oid);
              const on = choice === oid;
              const good = on && oid === q.answer;
              const bad = on && oid !== q.answer;
              return (
                <button
                  key={oid}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(oid)}
                  disabled={appleFree}
                  className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:opacity-50 ${
                    good ? 'border-emerald-400/70 bg-emerald-400/10' : bad ? 'border-rose-400/70 bg-rose-400/10' : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.08]'
                  }`}
                >
                  <svg width="26" height="12" aria-hidden="true" className="shrink-0">
                    <line x1="1" y1="6" x2="17" y2="6" stroke={NATURE_COL[f.nature]} strokeWidth="3" />
                    <path d="M25,6 L16,1 L16,11 Z" fill={NATURE_COL[f.nature]} />
                  </svg>
                  <span className="w-9 shrink-0 font-serif text-lg italic text-white">{f.sym}</span>
                  <span className="min-w-0 flex-1 text-sm leading-snug text-gray-200">{st.forces[oid]}</span>
                  {good && <Check size={18} className="shrink-0 text-emerald-300" aria-hidden="true" />}
                  {bad && <X size={18} className="shrink-0 text-rose-300" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          {chosen && right && !appleFree && (
            <Btn variant="primary" icon={ArrowRight} onClick={next} className="w-full sm:w-auto">
              {isLast ? tx.nextSit : tx.next}
            </Btn>
          )}
        </Panel>
        <Panel className="lg:col-span-2">
          <p className="text-sm font-semibold text-gray-200">{tx.criteria.title}</p>
          {crit ? (
            <>
              <p className="mt-1 text-xs text-gray-400">
                <span className="font-serif italic text-gray-200">{target.sym}</span> ↔ <span className="font-serif italic text-gray-200">{chosen.sym}</span>
              </p>
              <ul className="mt-2 space-y-1.5">
                {['equal', 'opposite', 'mutual', 'nature'].map((c) => (
                  <li key={c} className="flex items-start gap-2 rounded-lg bg-black/25 px-2.5 py-2 text-sm leading-snug">
                    {crit[c] ? <Check size={17} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" /> : <X size={17} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />}
                    <span className={crit[c] ? 'text-gray-200' : 'text-gray-400'}>
                      {tx.criteria[c]}
                      <span className="sr-only">{crit[c] ? ` — ${tx.yes}` : ` — ${tx.no}`}</span>
                      {c === 'mutual' && (
                        <span className="block text-xs text-gray-500">{tx.bodiesOf(tx.bodies[target.from], tx.bodies[target.on], tx.bodies[chosen.from], tx.bodies[chosen.on])}</span>
                      )}
                      {c === 'nature' && <span className="block text-xs text-gray-500">{tx.naturesOf(tx.natures[target.nature], tx.natures[chosen.nature])}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={`mt-2 rounded-lg px-2.5 py-2 text-sm font-semibold ${right ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{right ? tx.verdictYes : tx.verdictNo}</p>
            </>
          ) : (
            <p className="mt-2 text-sm leading-snug text-gray-400">{tx.criteria.empty}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function PairsDrawing({ W, H, narrow, sit, target, options, choice, right, appleY, appleFree, falling, tx, T }) {
  const pad = narrow ? { l: 8, r: 8, t: 44, b: 10 } : { l: 20, r: 20, t: 56, b: 14 };
  const S = SITS[sit];
  const view = makeView(S.box, W, H, pad);
  const k = view.k;
  const fs = narrow ? 11 : 13;
  const lx = Math.max(10, view.sx(S.box.x0) + 10);
  const gy = view.sy(GROUND[sit]);
  const P = (x, y) => ({ x: view.sx(x), y: view.sy(y) });

  const forces = S.forces.filter((f) => !(appleFree && (f.id === 'aT' || f.id === 'aT2')));
  const arrows = forces.map((f) => {
    let [x, y] = f.at;
    if (f.id === 'aG') y = appleY;
    const [ux, uy] = VEC[f.dir];
    const len = f.F * S.kF * k;
    const p0 = P(x, y);
    const isTarget = f.id === target;
    const isChoice = f.id === choice;
    const inPlay = isTarget || options.includes(f.id);
    let glow;
    if (isTarget) glow = '#facc15';
    else if (isChoice) glow = right ? '#10b981' : '#f43f5e';
    const opacity = appleFree ? (f.id === 'aG' || f.id === 'aG2' ? 1 : 0.5) : inPlay ? 1 : 0.35;
    const tip = { x: p0.x + ux * len, y: p0.y - uy * len };
    let tag;
    if (uy !== 0) tag = { x: tip.x + (f.left ? -8 : 8), y: tip.y + (uy > 0 ? 10 : 2), anchor: f.left ? 'end' : 'start' };
    else tag = { x: tip.x + ux * 6, y: tip.y + 5, anchor: ux > 0 ? 'start' : 'end' };
    return (
      <g key={f.id} opacity={opacity}>
        {f.link && <line x1={view.sx(f.link[0])} y1={view.sy(f.link[1])} x2={p0.x} y2={p0.y} stroke={BODY_COL[f.on]} strokeWidth="1.5" strokeDasharray="2 3" />}
        <ForceArrow x={p0.x} y={p0.y} dx={ux * len} dy={-uy * len} color={NATURE_COL[f.nature]} dot={BODY_COL[f.on]} glow={glow} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
        {isTarget && <circle cx={p0.x} cy={p0.y} r={narrow ? 7 : 9} fill="#facc15" className="cl-pulse" />}
        <Tag x={tag.x} y={tag.y} text={f.sym} color={NATURE_COL[f.nature]} size={fs + 2} anchor={tag.anchor} />
      </g>
    );
  });

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={28} />
      {sit === 'apple' && <AppleScene view={view} k={k} gy={gy} W={W} H={H} lx={lx} appleY={appleY} appleFree={appleFree} fs={fs} tx={tx} narrow={narrow} />}
      {sit === 'book' && <BookScene view={view} k={k} gy={gy} W={W} H={H} lx={lx} fs={fs} tx={tx} narrow={narrow} />}
      {sit === 'sled' && <SledScene view={view} k={k} gy={gy} W={W} H={H} lx={lx} fs={fs} tx={tx} narrow={narrow} />}
      {arrows}
      {sit === 'apple' && falling && !narrow && (
        <>
          <Tag x={view.sx(6.5) - 0.5 * k} y={view.sy(appleY) + 5} text={`a = ${fmt(G, 1, T.decimal)} ${T.ms2}`} color={BODY_COL.apple} size={fs} anchor="end" italic={false} />
          <Tag x={view.sx(7.2) + 0.35 * k} y={view.sy(1.2)} text={`${tx.aEarthSym} = ${sci((M_APPLE * G) / M_EARTH, T.decimal)} ${T.ms2}`} color="#3f6212" size={fs} anchor="start" italic={false} />
        </>
      )}
      <ScaleBar x={narrow ? W - 14 - S.unitN * S.kF * k : W - 26 - S.unitN * S.kF * k} y={narrow ? 72 : 76} len={S.unitN * S.kF * k} color={COL.ink} text={`${fmt(S.unitN, 0, T.decimal)} ${T.common.N}`} size={narrow ? 10 : 11} />
    </g>
  );
}

function Ground({ W, H, gy, fill, line, label, fs, x }) {
  return (
    <g>
      <rect x={0} y={gy} width={W} height={H - gy} fill={fill} />
      <line x1={0} x2={W} y1={gy} y2={gy} stroke={line} strokeWidth="2" />
      {label && (
        <text x={x} y={Math.min(H - 8, gy + fs + 10)} fontSize={fs} fontWeight="700" fill={line}>
          {label}
        </text>
      )}
    </g>
  );
}

function AppleScene({ view, k, gy, W, H, lx, appleY, appleFree, fs, tx, narrow }) {
  const P = (x, y) => `${view.sx(x).toFixed(1)},${view.sy(y).toFixed(1)}`;
  const ax = view.sx(6.5);
  const ay = view.sy(appleY);
  const r = APPLE_R * k;
  return (
    <g>
      <Ground W={W} H={H} gy={gy} fill="#ecfccb" line="#4d7c0f" label={tx.bodiesCap.earth} fs={fs} x={lx} />
      {/* tree */}
      <path d={`M${P(2.55, 1)} L${P(2.65, 4.4)} L${P(2.95, 4.4)} L${P(3.05, 1)} Z`} fill="#92400e" />
      <path d={`M${P(2.8, 4.25)} Q${P(5.5, 4.75)} ${P(9.6, 4.55)}`} fill="none" stroke="#92400e" strokeWidth={Math.max(4, 0.14 * k)} strokeLinecap="round" />
      {[
        [2.3, 4.5, 0.42],
        [2.9, 4.72, 0.38],
        [3.7, 4.62, 0.32],
        [4.6, 4.78, 0.3],
        [5.4, 4.8, 0.26],
        [7.6, 4.78, 0.28],
        [8.5, 4.74, 0.3],
        [9.3, 4.62, 0.26],
      ].map(([x, y, rr]) => (
        <circle key={x} cx={view.sx(x)} cy={view.sy(y)} r={rr * k} fill="#4ade80" opacity="0.55" />
      ))}
      {/* stem */}
      {!appleFree && <line x1={ax} x2={view.sx(6.5)} y1={ay - r} y2={view.sy(4.55)} stroke="#92400e" strokeWidth={Math.max(2, 0.045 * k)} />}
      {appleFree && <line x1={view.sx(6.5)} x2={view.sx(6.5)} y1={view.sy(4.0)} y2={view.sy(4.55)} stroke="#92400e" strokeWidth={Math.max(2, 0.045 * k)} />}
      {/* apple */}
      <circle cx={ax} cy={ay} r={r} fill={BODY_COL.apple} stroke="#991b1b" strokeWidth="1.5" />
      <ellipse cx={ax - r * 0.35} cy={ay - r * 0.35} rx={r * 0.22} ry={r * 0.14} fill="#fff" opacity="0.55" />
      {!narrow && (
        <>
          {!appleFree && (
            <text x={ax + r + 8} y={ay - r * 0.2} fontSize={fs - 1} fill={COL.muted}>
              {tx.bodiesCap.apple}
            </text>
          )}
          <text x={view.sx(6.78)} y={view.sy(4.0)} fontSize={fs - 1} fill={COL.muted}>
            {tx.bodiesCap.stem}
          </text>
        </>
      )}
    </g>
  );
}

function BookScene({ view, k, gy, W, H, lx, fs, tx, narrow }) {
  const R = (x0, y0, x1, y1, props) => <rect x={view.sx(x0)} y={view.sy(y1)} width={(x1 - x0) * k} height={(y1 - y0) * k} {...props} />;
  return (
    <g>
      <Ground W={W} H={H} gy={gy} fill="#f1f5f9" line="#64748b" label={tx.bodiesCap.earth} fs={fs} x={lx} />
      {/* table */}
      {R(3.9, 0.9, 4.15, 2.42, { fill: '#a16207' })}
      {R(9.35, 0.9, 9.6, 2.42, { fill: '#a16207' })}
      {R(3.5, 2.42, 10, 2.6, { fill: '#ca8a04', stroke: '#854d0e', strokeWidth: 1.5, rx: 3 })}
      {/* book */}
      {R(5.1, 2.6, 7.9, 3.1, { fill: BODY_COL.book, stroke: '#1e3a8a', strokeWidth: 1.5, rx: 3 })}
      {R(5.2, 2.66, 7.8, 2.78, { fill: '#f8fafc' })}
      {!narrow && (
        <>
          <text x={view.sx(8.05)} y={view.sy(2.95)} fontSize={fs - 1} fill={COL.muted}>
            {tx.bodiesCap.book}
          </text>
          <text x={view.sx(8.6)} y={view.sy(2.25)} fontSize={fs - 1} fill={COL.muted}>
            {tx.bodiesCap.table}
          </text>
        </>
      )}
    </g>
  );
}

function SledScene({ view, k, gy, W, H, lx, fs, tx, narrow }) {
  const P = (x, y) => `${view.sx(x).toFixed(1)},${view.sy(y).toFixed(1)}`;
  const h = 2.4 * k;
  return (
    <g>
      <Ground W={W} H={H} gy={gy} fill="#f1f5f9" line="#94a3b8" label={tx.bodiesCap.ground} fs={fs} x={lx} />
      {/* sled with its load */}
      <path d={`M${P(2.6, 1.05)} L${P(5.0, 1.05)} Q${P(5.45, 1.05)} ${P(5.4, 1.45)}`} fill="none" stroke="#475569" strokeWidth={Math.max(2.5, 0.06 * k)} strokeLinecap="round" />
      <line x1={view.sx(3.0)} x2={view.sx(3.0)} y1={view.sy(1.05)} y2={view.sy(1.35)} stroke="#475569" strokeWidth="2" />
      <line x1={view.sx(4.6)} x2={view.sx(4.6)} y1={view.sy(1.05)} y2={view.sy(1.35)} stroke="#475569" strokeWidth="2" />
      <rect x={view.sx(2.6)} y={view.sy(1.48)} width={2.6 * k} height={0.13 * k} fill="#a16207" rx="2" />
      <rect x={view.sx(2.8)} y={view.sy(2.1)} width={2.1 * k} height={0.62 * k} fill={BODY_COL.sled} stroke="#9d174d" strokeWidth="1.5" rx="4" />
      <circle cx={view.sx(5.1)} cy={view.sy(2.0)} r={0.05 * k} fill="#334155" />
      {/* rope */}
      <line x1={view.sx(5.1)} x2={view.sx(6.95)} y1={view.sy(2.0)} y2={view.sy(2.0)} stroke="#78350f" strokeWidth={Math.max(2, 0.04 * k)} />
      <Person fx={view.sx(7.05)} fy={gy} h={h} dir={1} lean={-0.25} hand={{ x: view.sx(6.95), y: view.sy(2.0) }} color={BODY_COL.boy} stride={0.3} />
      {!narrow && (
        <>
          <text x={view.sx(3.85)} y={view.sy(2.3)} textAnchor="middle" fontSize={fs - 1} fill={COL.muted}>
            {tx.bodiesCap.sled}
          </text>
          <text x={view.sx(8.1)} y={view.sy(3.3)} fontSize={fs - 1} fill={COL.muted}>
            {tx.bodiesCap.boy}
          </text>
        </>
      )}
    </g>
  );
}
