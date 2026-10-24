import { useState } from 'react';
import { Car, CircleDot, Crosshair, Footprints, Lightbulb, MoveLeft, MoveRight, Ruler as RulerIcon, Volleyball } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, groupThousands, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import {
  COL,
  Chip,
  FormulaTile,
  GroupLabel,
  InfoBox,
  LabScene,
  Panel,
  PaperGrid,
  PlayControls,
  Rich,
  Ruler,
  ScaleBar,
  VecArrow,
  lineView,
  niceMax,
  niceUnit,
  pickNice,
  smart,
  trim,
} from './Impulse.parts';

/**
 * Tab 1 — the momentum of a body p = m·v. Five everyday bodies (a 9 g bullet
 * at 400 m/s, a 58 g tennis ball at 50 m/s, a 0.43 kg football at 25 m/s, a
 * 1000 kg car at 20 m/s and a 60 kg walker at 1.5 m/s) or the reader's own
 * m and v (log sliders). The body moves across the lab paper with its v and
 * p arrows — the same direction, p is a vector — and the dark panel compares
 * all momenta on a logarithmic bar chart. Strings come from T.mom.
 */

export const BODIES = [
  { id: 'bullet', m: 0.009, v: 400, icon: Crosshair },
  { id: 'tennis', m: 0.058, v: 50, icon: CircleDot },
  { id: 'football', m: 0.43, v: 25, icon: Volleyball },
  { id: 'car', m: 1000, v: 20, icon: Car },
  { id: 'walker', m: 60, v: 1.5, icon: Footprints },
];
const BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b]));

const M_MIN = 0.005;
const M_MAX = 2000;
const V_MIN = 0.5;
const V_MAX = 500;
const STEPS = 1000;
const toU = (x, lo, hi) => Math.round((Math.log(x / lo) / Math.log(hi / lo)) * STEPS);
const fromU = (u, lo, hi) => Number((lo * (hi / lo) ** (u / STEPS)).toPrecision(2));
const sig = (n, k = 3) => (n === 0 ? 0 : Number(n.toPrecision(k)));

/** Drawn size of each body at full scale (px) and whether it rests on the ground. */
const SIZE = {
  bullet: { w: 34, h: 12, ground: false },
  tennis: { w: 24, h: 24, ground: false },
  football: { w: 32, h: 32, ground: false },
  car: { w: 104, h: 44, ground: true },
  walker: { w: 30, h: 60, ground: true },
  custom: { w: 46, h: 34, ground: true },
};

export default function MomentumSim({ T }) {
  const L = T.mom;
  const dec = T.decimal;
  const [body, setBody] = useState('bullet');
  const [m, setM] = useState(BY_ID.bullet.m);
  const [v, setV] = useState(BY_ID.bullet.v);
  const [dir, setDir] = useState(1);
  const [run, setRun] = useState({ f: 0.3, running: false, started: false, phase: 0 });

  const p = m * v * dir;
  const pAbs = m * v;

  /* the paper shows `span` metres; fast bodies are slowed down so a crossing takes ~3 s */
  const span = clamp(niceMax(v * 3, 1), 2, 200);
  const realCross = span / v;
  const slow = realCross < 2 ? pickNice(3 / realCross, [2, 5, 10, 20, 50]) : 1;

  useRafLoop(run.running, (dt) => {
    setRun((r) => {
      if (!r.running) return r;
      let f = r.f + (dir * v * dt) / (slow * span);
      if (f > 1.1) f -= 1.2;
      if (f < -0.1) f += 1.2;
      return { ...r, f, phase: r.phase + (dt * v) / slow };
    });
  });

  const toggle = () => setRun((r) => ({ ...r, running: !r.running, started: true }));
  const reset = () => setRun({ f: dir > 0 ? 0.3 : 0.7, running: false, started: false, phase: 0 });
  const pickBody = (id) => {
    setBody(id);
    setM(BY_ID[id].m);
    setV(BY_ID[id].v);
    if (!run.started) setRun((r) => ({ ...r, f: dir > 0 ? 0.3 : 0.7 }));
  };
  const pickDir = (d) => {
    setDir(d);
    if (!run.started) setRun((r) => ({ ...r, f: d > 0 ? 0.3 : 0.7 }));
  };
  const onM = (u) => {
    const nm = fromU(u, M_MIN, M_MAX);
    setM(nm);
    setBody(BODIES.find((b) => b.m === nm && b.v === v)?.id ?? 'custom');
  };
  const onV = (u) => {
    const nv = fromU(u, V_MIN, V_MAX);
    setV(nv);
    setBody(BODIES.find((b) => b.m === m && b.v === nv)?.id ?? 'custom');
  };

  const S = (n) => smart(n, dec);
  const massText = (mm) => (mm < 0.1 ? `${trim(mm * 1000, dec, 1)} ${T.g}` : `${S(mm)} ${T.kg}`);
  const name = L.bodies[body].name;

  /* explanation */
  const key = dir < 0 ? 'left' : body;
  const settled = useSettled(key, 250);
  const ex = L.explain;
  const text =
    settled === 'left'
      ? ex.left(S(p))
      : settled === 'custom'
        ? ex.custom(massText(m), S(v), S(pAbs))
        : ex[settled] ?? ex.custom(massText(m), S(v), S(pAbs));
  const tone = { bullet: '#fbbf24', tennis: '#a3e635', football: '#e2e8f0', car: '#60a5fa', walker: '#34d399', custom: '#a5b4fc', left: '#f9a8d4' }[settled] ?? '#22d3ee';

  const rows = [
    ...BODIES.map((b) => ({ id: b.id, m: b.m, v: b.v })),
    ...(body === 'custom' ? [{ id: 'custom', m, v }] : []),
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.bodiesLabel}</GroupLabel>
          <Segmented
            label={L.bodiesLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={body}
            onChange={pickBody}
            accent="#818cf8"
            options={BODIES.map((b) => ({ value: b.id, label: L.bodies[b.id].name, sub: L.bodies[b.id].sub, icon: b.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={run.running} done={false} started={run.started} onToggle={toggle} onReset={reset} startLabel={L.move} />
      </div>

      <MomentumScene T={T} body={body} f={run.f} phase={run.phase} running={run.running} v={v} p={p} dir={dir} span={span} slow={slow} name={name} massText={massText(m)} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.m} symbol="m" value={massText(m).split(' ')[0]} unit={massText(m).split(' ')[1]} accent="#94a3b8" sub={L.mSub} />
        <Readout
          label={L.readouts.v}
          symbol={<Rich>vₓ</Rich>}
          value={S(v * dir)}
          unit={T.ms}
          accent={COL.v}
          textColor={COL.vText}
          sub={L.vSub(S(sig(v * 3.6)))}
        />
        <Readout label={L.readouts.p} symbol={<Rich>pₓ</Rich>} value={S(p)} unit={T.pu} accent={COL.p} textColor={COL.pText} sub={L.pSub} active />
        <Readout label={L.readouts.F} symbol="F" value={S(sig(pAbs))} unit={T.N} accent={COL.F} textColor={COL.FText} sub={L.FSub} />
      </div>

      <Panel>
        <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={COL.pText}
            general="p = m · v"
            filled={`= ${trim(m, dec, 3)} ${T.kg} · ${S(v)} ${T.ms}`}
            result={`p = ${S(pAbs)} ${T.pu}`}
          />
          <FormulaTile tag={L.f2} color={COL.vText} general="p ↑↑ v" filled={L.f2filled} result={dir > 0 ? L.f2right : L.f2left} />
          <FormulaTile tag={L.f3} color="#cbd5e1" general={L.f3general} filled={L.f3filled} result={`1 ${T.pu} = 1 ${T.Ns}`} />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="imp-m"
            label={L.mLabel}
            symbol="m"
            min={0}
            max={STEPS}
            step={1}
            value={toU(m, M_MIN, M_MAX)}
            onChange={onM}
            accent="#94a3b8"
            display={massText(m)}
            hint={L.mHint}
          />
          <RangeField
            id="imp-v"
            label={L.vLabel}
            symbol="v"
            min={0}
            max={STEPS}
            step={1}
            value={toU(v, V_MIN, V_MAX)}
            onChange={onV}
            accent={COL.v}
            display={`${S(v)} ${T.ms}`}
            hint={L.vHint}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{L.dirLabel}</p>
            <Segmented
              label={L.dirLabel}
              className="grid-cols-2"
              value={dir}
              onChange={pickDir}
              accent="#f472b6"
              options={[
                { value: 1, label: L.dirs.right.name, sub: L.dirs.right.sub, icon: MoveRight },
                { value: -1, label: L.dirs.left.name, sub: L.dirs.left.sub, icon: MoveLeft },
              ]}
            />
          </div>
          <InfoBox
            title={L.same.title}
            items={[
              [L.same.walker, `${S(sig(pAbs / 60))} ${T.ms}`, COL.vText],
              [L.same.car, `${S(sig(pAbs / 1000))} ${T.ms}`, COL.vText],
              [L.same.tennis, `${S(sig(pAbs / 0.058))} ${T.ms}`, COL.vText],
            ]}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <MomentumBars T={T} rows={rows} selected={body} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ bars */

function decadeText(k, dec) {
  return k < 0 ? trim(10 ** k, dec, 4) : groupThousands(10 ** k);
}

function MomentumBars({ T, rows, selected }) {
  const L = T.mom;
  const dec = T.decimal;
  const ps = rows.map((r) => r.m * r.v);
  const lo = Math.min(-1, Math.floor(Math.log10(Math.min(...ps))));
  const hi = Math.max(5, Math.ceil(Math.log10(Math.max(...ps))));
  const pct = (val) => clamp(((Math.log10(val) - lo) / (hi - lo)) * 100, 1.5, 100);
  const decades = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const massText = (mm) => (mm < 0.1 ? `${trim(mm * 1000, dec, 1)} ${T.g}` : `${smart(mm, dec)} ${T.kg}`);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{L.bars.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-4 rounded-sm" style={{ background: COL.p }} /> p = m·v, {T.pu}
        </span>
      </div>
      <div className="mt-3 space-y-2" role="list" aria-label={L.bars.title}>
        {rows.map((r) => {
          const val = r.m * r.v;
          const w = pct(val);
          const on = r.id === selected;
          const inside = w > 68;
          return (
            <div key={r.id} role="listitem" className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[9.5rem_1fr] items-center gap-2">
              <div className="min-w-0 text-xs leading-tight">
                <span className={`block truncate font-semibold ${on ? 'text-white' : 'text-gray-300'}`}>{L.bodies[r.id].name}</span>
                <span className="block truncate text-[11px] tabular-nums text-gray-500">
                  {massText(r.m)} · {smart(r.v, dec)} {T.ms}
                </span>
              </div>
              <div className={`relative h-8 rounded-md ${on ? 'bg-white/[0.07] ring-1 ring-indigo-300/40' : 'bg-white/[0.03]'}`}>
                {decades.map((k) => (
                  <span key={k} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${((k - lo) / (hi - lo)) * 100}%` }} aria-hidden="true" />
                ))}
                <span
                  className="absolute inset-y-1 left-0 rounded transition-[width] duration-300"
                  style={{ width: `${w}%`, background: on ? 'linear-gradient(90deg,#4f46e5,#818cf8)' : 'rgba(99,102,241,0.55)' }}
                  aria-hidden="true"
                />
                <span
                  className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold tabular-nums ${inside ? 'text-white' : on ? 'text-indigo-100' : 'text-gray-300'}`}
                  style={inside ? { right: `${100 - w + 1.2}%` } : { left: `calc(${w}% + 6px)` }}
                >
                  {smart(val, dec)}
                </span>
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[9.5rem_1fr] gap-2 pt-0.5" aria-hidden="true">
          <span className="text-[11px] text-gray-500">{T.pu}</span>
          <div className="relative h-4">
            {decades.map((k, i) => (
              <span
                key={k}
                className={`absolute whitespace-nowrap text-[10px] tabular-nums text-gray-500 ${i === decades.length - 1 ? '-translate-x-full' : i === 0 ? '' : '-translate-x-1/2'} ${i % 2 === 1 && i !== decades.length - 1 ? 'hidden sm:inline' : ''}`}
                style={{ left: `${((k - lo) / (hi - lo)) * 100}%` }}
              >
                {decadeText(k, dec)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-snug text-gray-500">{L.bars.note}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

/** A schematic body seen from the side, centred at (0, 0), facing +x. */
function BodyGlyph({ id, phase }) {
  if (id === 'bullet') {
    return (
      <g>
        <path d="M-17,-5 L4,-5 C11,-5 15,-2.5 17,0 C15,2.5 11,5 4,5 L-17,5 Z" fill="url(#imp-copper)" stroke="#7c2d12" strokeWidth="1" />
        <rect x="-17" y="-6" width="7" height="12" rx="1.2" fill="#b45309" stroke="#78350f" strokeWidth="0.8" />
        <path d="M-9,-3.2 L6,-3.2" stroke="#fde68a" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </g>
    );
  }
  if (id === 'tennis') {
    return (
      <g>
        <circle r="12" fill="#d9f04a" stroke="#8a9a1b" strokeWidth="1.2" />
        <path d="M-9,-8 C-3.5,-3 -3.5,3 -9,8" fill="none" stroke="#fff" strokeWidth="1.8" />
        <path d="M9,-8 C3.5,-3 3.5,3 9,8" fill="none" stroke="#fff" strokeWidth="1.8" />
      </g>
    );
  }
  if (id === 'football') {
    const pent = (r, a0) =>
      Array.from({ length: 5 }, (_, i) => {
        const a = a0 + (i * 2 * Math.PI) / 5;
        return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
    return (
      <g>
        <circle r="16" fill="#fff" stroke="#334155" strokeWidth="1.3" />
        <polygon points={pent(5.5, -Math.PI / 2)} fill="#1e293b" />
        {Array.from({ length: 5 }, (_, i) => {
          const a = -Math.PI / 2 + Math.PI / 5 + (i * 2 * Math.PI) / 5;
          return (
            <g key={i} transform={`translate(${(12.5 * Math.cos(a)).toFixed(2)} ${(12.5 * Math.sin(a)).toFixed(2)})`}>
              <polygon points={pent(3.4, a + Math.PI)} fill="#1e293b" />
            </g>
          );
        })}
        <circle r="16" fill="none" stroke="#334155" strokeWidth="1.3" />
      </g>
    );
  }
  if (id === 'car') {
    return (
      <g>
        <path
          d="M-52,12 L-52,0 Q-51,-8 -41,-9 L-25,-10 L-13,-21 Q-9,-24 -2,-24 L21,-24 Q27,-24 31,-19 L40,-10 L47,-9 Q52,-8 52,0 L52,12 Z"
          fill="#334155"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <path d="M-10,-19 Q-7,-21 -2,-21 L9,-21 L9,-11 L-21,-11 Z" fill="#bae6fd" />
        <path d="M12,-21 L20,-21 Q25,-21 28,-17 L34,-11 L12,-11 Z" fill="#bae6fd" />
        <rect x="45" y="-5" width="7" height="4" rx="1.5" fill="#fde68a" />
        <rect x="-52" y="-4" width="5" height="4" rx="1.5" fill="#fca5a5" />
        <line x1="-48" y1="2" x2="48" y2="2" stroke="#64748b" strokeWidth="1" />
        {[-31, 31].map((wx) => (
          <g key={wx} transform={`translate(${wx} 12) rotate(${((phase * 60) % 360).toFixed(1)})`}>
            <circle r="9" fill="#111827" />
            <circle r="4.2" fill="#cbd5e1" />
            <line x1="-6.5" x2="6.5" y1="0" y2="0" stroke="#64748b" strokeWidth="1.6" />
          </g>
        ))}
      </g>
    );
  }
  if (id === 'walker') {
    const a = Math.sin(phase * 3.2) * 0.42;
    const leg = (s) => `M0,4 L${(Math.sin(s * a) * 26).toFixed(1)},${(4 + Math.cos(s * a) * 26).toFixed(1)}`;
    const arm = (s) => `M0,-14 L${(Math.sin(-s * a) * 18).toFixed(1)},${(-14 + Math.cos(s * a) * 18).toFixed(1)}`;
    return (
      <g stroke="#334155" strokeWidth="4.2" strokeLinecap="round" fill="none">
        <path d={leg(-1)} stroke="#475569" />
        <path d={arm(-1)} stroke="#475569" />
        <path d="M0,-17 L0,4" />
        <path d={leg(1)} />
        <path d={arm(1)} />
        <circle cx="1.5" cy="-23" r="6.2" fill="#334155" stroke="none" />
      </g>
    );
  }
  return (
    <g>
      <rect x="-23" y="-17" width="46" height="34" rx="4" fill="url(#imp-block)" stroke="#475569" strokeWidth="1.3" />
      <rect x="-20" y="-14" width="40" height="5" rx="2" fill="#fff" opacity="0.55" />
      <text x="0" y="6" textAnchor="middle" fontSize="14" fontStyle="italic" fontWeight="700" fill="#1e293b">
        m
      </text>
    </g>
  );
}

function MomentumScene({ T, body, f, phase, running, v, p, dir, span, slow, name, massText }) {
  const L = T.mom;
  const dec = T.decimal;
  const S = (n) => smart(n, dec);
  const vScale = niceMax(v, 1);
  const pScale = niceMax(Math.abs(p), 1);
  const maxLen = (narrow) => (narrow ? 110 : 180);

  return (
    <LabScene
      legend={[
        { color: COL.v, label: L.legend.v, kind: 'arrow' },
        { color: COL.p, label: L.legend.p, kind: 'arrow' },
      ]}
      chips={(W, narrow) => {
        const kv = maxLen(narrow) / vScale;
        const kp = maxLen(narrow) / pScale;
        const uv = niceUnit(kv, narrow ? 26 : 34);
        const up = niceUnit(kp, narrow ? 26 : 34);
        return (
          <>
            <Chip>{slow > 1 ? L.chipSlow(slow) : L.chipReal}</Chip>
            <Chip icon={RulerIcon} color={COL.p}>
              <ScaleBar px={uv * kv} label={`${S(uv)} ${T.ms}`} color={COL.v} />
              <span className="text-slate-300">·</span>
              <ScaleBar px={up * kp} label={`${S(up)} ${T.pu}`} color={COL.p} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 250 : 290)}
      ariaLabel={L.sceneLabel(name, massText, S(v * dir), S(p))}
    >
      {(W, H, narrow) => {
        const s = narrow ? 0.78 : 1;
        const fs = narrow ? 11 : 13;
        const rulerY = H - 30;
        const groundY = rulerY - 10;
        const view = lineView(0, span, W, 14, 14);
        const step = niceUnit(view.k, narrow ? 52 : 70);
        const sz = SIZE[body];
        const cx = view.sx(f * span);
        const cy = sz.ground ? groundY - (sz.h * s) / 2 : groundY - (narrow ? 52 : 70) - (sz.h * s) / 2;
        const top = cy - (sz.h * s) / 2;
        const len = maxLen(narrow);
        const vLen = (len * v) / vScale;
        const pLen = (len * Math.abs(p)) / pScale;
        const yV = top - 14;
        const yP = top - (narrow ? 38 : 44);
        const box = { w: W, h: H };
        const tagV = L.vTag(S(v * dir));
        const tagP = L.pTag(S(p));
        return (
          <>
            <defs>
              <linearGradient id="imp-copper" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#fbbf6a" />
                <stop offset="0.55" stopColor="#d97706" />
                <stop offset="1" stopColor="#9a3412" />
              </linearGradient>
              <linearGradient id="imp-block" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#e2e8f0" />
                <stop offset="1" stopColor="#94a3b8" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={groundY} step={step} rowPx={narrow ? 24 : 28} />
            {/* ground */}
            <rect x={0} y={groundY} width={W} height={rulerY - groundY} fill="#e2e8f0" />
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#64748b" strokeWidth={1.6} />
            {/* motion streaks */}
            {running &&
              [0, 1, 2].map((i) => {
                const yy = cy - (sz.h * s) / 3 + i * ((sz.h * s) / 3);
                const x0 = cx - dir * ((sz.w * s) / 2 + 6 + i * 4);
                return <line key={i} x1={x0} x2={x0 - dir * (18 + i * 6)} y1={yy} y2={yy} stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" opacity={0.7 - i * 0.15} />;
              })}
            <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(dir * s).toFixed(3)} ${s.toFixed(3)})`}>
              <BodyGlyph id={body} phase={phase} />
            </g>
            {/* arrows: velocity and momentum point the same way */}
            <VecArrow x={cx} y={yV} dx={dir * vLen} dy={0} color={COL.v} width={narrow ? 2.6 : 3} />
            <VecArrow x={cx} y={yP} dx={dir * pLen} dy={0} color={COL.p} width={narrow ? 3 : 3.6} />
            <circle cx={cx} cy={yV} r={2.6} fill={COL.v} />
            <circle cx={cx} cy={yP} r={2.8} fill={COL.p} />
            <Pill
              x={cx + dir * (vLen + 12) + (dir * (textWidth(tagV, fs - 1, 600) + 16)) / 2}
              y={yV}
              text={tagV}
              bg={COL.v}
              size={fs - 1}
              box={box}
            />
            <Pill
              x={cx + dir * (pLen + 12) + (dir * (textWidth(tagP, fs - 1, 600) + 16)) / 2}
              y={yP}
              text={tagP}
              bg={COL.p}
              size={fs - 1}
              box={box}
            />
            <text
              x={cx}
              y={sz.ground ? groundY - sz.h * s - (narrow ? 66 : 76) : top - (narrow ? 64 : 72)}
              textAnchor="middle"
              fontSize={fs - 1}
              fontWeight="700"
              fill={PALETTE.ink}
              stroke="#fbfcfe"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {`${name} · m = ${massText}`}
            </text>
            {/* ruler */}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
          </>
        );
      }}
    </LabScene>
  );
}
