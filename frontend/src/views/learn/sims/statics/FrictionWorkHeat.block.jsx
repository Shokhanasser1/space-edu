import { useState } from 'react';
import { BrickWall, Grid3x3, Lightbulb, Ruler as RulerIcon, Snowflake, TreePine } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, niceStep, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import {
  BalanceLine,
  Chip,
  ENERGY,
  ENERGY_INK,
  ENERGY_TEXT,
  EqBand,
  EnergyBars,
  EnergyGraph,
  EnergyPanel,
  FORCE,
  FORCE_TEXT,
  FormulaTile,
  G,
  GroupLabel,
  HEAT,
  HeatTrail,
  InfoBox,
  LabScene,
  PaperGrid,
  PlayControls,
  Rich,
  Ruler,
  ScaleBar,
  Thermometer,
  VecArrow,
  WorkList,
  eDigits,
  hash01,
  lineView,
  mix,
  niceMax,
  round,
  rulerStep,
  tickDigits,
  trim,
} from './FrictionWorkHeat.parts';

/**
 * Tab 1 — a block given a push slides along a floor and stops. Friction
 * F = μmg points against the motion, so its work is negative:
 * A = −F·s. The kinetic energy falls by exactly that amount and the same
 * amount appears as heat: Q = −A = μmg·s, while E_k + Q stays equal to the
 * initial E_k. Whatever the floor, all of E_k becomes heat in the end —
 * only the distance changes. Preset (wooden floor): m = 2 kg, v₀ = 4 m/s,
 * μ = 0.2 → E = 16 J, F = 3.92 N, a = 1.96 m/s², t = 2.04 s, s = 4.08 m.
 * Strings come from T.block.
 */

const SURFACES = {
  ice: { mu: 0.05, icon: Snowflake },
  wood: { mu: 0.2, icon: TreePine },
  concrete: { mu: 0.4, icon: BrickWall },
  carpet: { mu: 0.6, icon: Grid3x3 },
};
const IDLE = { t: 0, running: false, done: false };

export default function BlockSim({ T }) {
  const L = T.block;
  const dec = T.decimal;
  const fr = T.sym.fr;
  const [surf, setSurf] = useState('wood');
  const [v0, setV0] = useState(4);
  const [m, setM] = useState(2);
  const [sim, setSim] = useState(IDLE);

  const mu = SURFACES[surf].mu;
  const a = mu * G;
  const F = mu * m * G;
  const tStop = v0 / a;
  const sStop = (v0 * v0) / (2 * a);
  const E0 = (m * v0 * v0) / 2;
  const speedUp = tStop > 8 ? Math.ceil(tStop / 6) : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tStop, p.t + dt * speedUp);
      const done = t >= tStop - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const sliding = t > 0 && !sim.done;
  const v = sim.done ? 0 : Math.max(0, v0 - a * t);
  const x = sim.done ? sStop : Math.min(sStop, v0 * t - 0.5 * a * t * t);
  const Ek = (m * v * v) / 2;
  const Q = sim.done ? E0 : F * x;
  const ed = eDigits(E0);
  const E = (n) => round(n, ed, dec);
  const D = (n) => trim(n, dec);
  const Ff = (n) => trim(n, dec, 2);
  const S = (n) => round(n, 2, dec);

  /* explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t > 0) key = t < 0.5 * tStop ? 'slide' : 'micro';
  const settled = useSettled(key, key === 'slide' || key === 'micro' ? 300 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(E(E0)),
    slide: ex.slide(Ff(F), fr),
    micro: ex.micro,
    done: `${ex.done(S(sStop), Ff(F), E(E0), fr)}${ex.tail[surf]}`,
  }[settled];
  const tone = { idle: '#22d3ee', slide: '#f87171', micro: '#fb923c', done: '#34d399' }[settled];

  const xTop = niceMax(sStop);
  const yTop = niceMax(E0 * 1.08);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.surfaceLabel}</GroupLabel>
          <Segmented
            label={L.surfaceLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={surf}
            onChange={change(setSurf)}
            options={Object.keys(SURFACES).map((id) => ({ value: id, label: L.surfaces[id].name, sub: L.surfaces[id].sub, icon: SURFACES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <BlockScene
          T={T}
          surf={surf}
          m={m}
          F={F}
          t={t}
          x={x}
          v={v}
          Q={Q}
          E0={E0}
          sStop={sStop}
          sliding={sliding}
          speedUp={speedUp}
          footer={
            <EqBand
              title={L.band}
              terms={[
                { sym: `E_{${T.sym.k}0}`, value: `${E(E0)} ${T.J}`, color: ENERGY_INK.tot },
                { op: '=' },
                { sym: `E_{${T.sym.k}}`, value: `${E(Ek)} ${T.J}`, color: ENERGY_INK.k },
                { op: '+' },
                { sym: 'Q', value: `${E(Q)} ${T.J}`, color: ENERGY_INK.q },
              ]}
              extra={`Q = F_{${fr}} · s = ${Ff(F)} · ${S(x)} = ${E(Q)} ${T.J}`}
            />
          }
        />
        <EnergyPanel title={L.panel.title} unit={T.J}>
          <EnergyBars
            items={[
              { id: 'k', label: `E_{${T.sym.k}}`, value: Ek, color: ENERGY.k, text: ENERGY_TEXT.k },
              { id: 'q', label: 'Q', value: Q, color: ENERGY.q, text: ENERGY_TEXT.q },
            ]}
            stack={['k', 'q']}
            total={E0}
            max={E0 * 1.2}
            digits={ed}
            decimal={dec}
            stackLabel={`E_{${T.sym.k}} + Q`}
            ariaLabel={L.panel.aria(E(Ek), E(Q), E(E0))}
          />
          <BalanceLine>
            <Rich>{`E_{${T.sym.k}} + Q = ${E(Ek)} + ${E(Q)} = ${E(E0)} ${T.J}`}</Rich>
            <span className="text-gray-500"> · {L.panel.constant}</span>
          </BalanceLine>
          <WorkList
            title={L.panel.works}
            rows={[
              { id: 'mg', sym: 'mg', color: FORCE_TEXT.mg, value: `A = 0`, note: L.panel.perp },
              { id: 'N', sym: 'N', color: FORCE_TEXT.N, value: `A = 0`, note: L.panel.perp },
              { id: 'fr', sym: `F_{${fr}}`, color: FORCE_TEXT.fr, value: `A = ${E(-Q)} ${T.J}`, note: L.panel.against },
            ]}
          />
          <p className="text-[12px] leading-snug tabular-nums text-gray-400">
            <Rich>{L.panel.law(E(Ek - E0), fr)}</Rich>
          </p>
        </EnergyPanel>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.Ek}
          symbol={<Rich>{`E_{${T.sym.k}}`}</Rich>}
          value={E(Ek)}
          unit={T.J}
          accent={ENERGY.k}
          textColor={ENERGY_TEXT.k}
          sub={L.EkSub(fmt(v, 2, dec))}
        />
        <Readout label={L.readouts.Q} symbol="Q" value={E(Q)} unit={T.J} accent={ENERGY.q} textColor={ENERGY_TEXT.q} sub={<Rich>{L.QSub(fr)}</Rich>} active={sim.done} />
        <Readout
          label={L.readouts.A}
          symbol={<Rich>{`A_{${fr}}`}</Rich>}
          value={E(-Q)}
          unit={T.J}
          accent={FORCE.fr}
          textColor={FORCE_TEXT.fr}
          sub={<Rich>{L.ASub(Ff(F), fr)}</Rich>}
        />
        <Readout label={L.readouts.s} symbol="s" value={fmt(x, 2, dec)} unit={T.m} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={L.sSub(S(sStop))} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {sim.done && <p className="text-xs font-semibold text-emerald-300">✓ {L.allHeat}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={FORCE_TEXT.fr}
            general={`F_{${fr}} = μN = μmg`}
            filled={`= ${D(mu)} · ${D(m)} · ${D(G)}`}
            result={`F_{${fr}} = ${Ff(F)} ${T.N}`}
          />
          <FormulaTile
            tag={L.f2}
            color={FORCE_TEXT.fr}
            general={`A_{${fr}} = −F_{${fr}} · s`}
            filled={`= −${Ff(F)} · ${S(x)}`}
            result={`A_{${fr}} = ${E(-Q)} ${T.J}`}
            note={L.f2note}
          />
          <FormulaTile
            tag={L.f3}
            color={ENERGY_TEXT.q}
            general={`Q = −A_{${fr}} = μmg · s`}
            filled={`= E_{${T.sym.k}0} − E_{${T.sym.k}} = ${E(E0)} − ${E(Ek)}`}
            result={`Q = ${E(Q)} ${T.J}`}
            ok={sim.done}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="fwh-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={1}
            max={8}
            step={0.5}
            value={v0}
            onChange={change(setV0)}
            accent={PALETTE.vel}
            display={`${fmt(v0, 1, dec)} ${T.ms}`}
            hint={L.v0Hint(fmt(v0 * 3.6, 1, dec))}
          />
          <RangeField
            id="fwh-m"
            label={L.m}
            symbol="m"
            min={1}
            max={5}
            step={0.5}
            value={m}
            onChange={change(setM)}
            accent={FORCE_TEXT.mg}
            display={`${fmt(m, 1, dec)} ${T.kg}`}
            hint={L.mHint(E(E0))}
          />
          <InfoBox
            title={L.info.title}
            items={[
              ['a = μg', `${D(a)} ${T.ms2}`, PALETTE.accText],
              [L.info.t, `${round(tStop, 2, dec)} ${T.s}`, '#a5f3fc'],
              [L.info.perM, `${Ff(F)} ${T.J}`, ENERGY_TEXT.q],
            ]}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyGraph
            title={L.graph.title}
            series={[
              { id: 'k', label: `E_{${T.sym.k}}`, color: ENERGY_TEXT.k, plan: [{ x: 0, y: E0 }, { x: sStop, y: 0 }], live: [{ x: 0, y: E0 }, { x, y: Ek }] },
              { id: 'q', label: 'Q', color: ENERGY_TEXT.q, plan: [{ x: 0, y: 0 }, { x: sStop, y: E0 }], live: [{ x: 0, y: 0 }, { x, y: Q }] },
              { id: 'tot', label: `E_{${T.sym.k}} + Q`, color: ENERGY_TEXT.tot, dash: true, plan: [{ x: 0, y: E0 }, { x: xTop, y: E0 }] },
            ]}
            xMax={xTop}
            yMax={yTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={x}
            note={L.graph.note(Ff(F), fr)}
            decimal={dec}
            xDigits={tickDigits(xTop)}
            yDigits={tickDigits(yTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

const FLOOR = {
  ice: { fill: '#dbeafe', edge: '#60a5fa', micro: '#bfdbfe', dot: '#93c5fd' },
  wood: { fill: '#f0dcbc', edge: '#a87a45', micro: '#e8c89a', dot: '#b07d43' },
  concrete: { fill: '#a8adb5', edge: '#4b5563', micro: '#9ca3af', dot: '#6b7280' },
  carpet: { fill: '#9f1239', edge: '#4c0519', micro: '#be123c', dot: '#881337' },
};

/** A strip of floor seen from the side, its surface at y, `depth` px thick. */
function Floor({ x0 = 0, x1, y, depth, kind }) {
  const g = FLOOR[kind];
  const span = x1 - x0;
  const items = [];
  if (kind === 'wood') {
    for (let px = x0 + 24; px < x1; px += 64) {
      items.push(<line key={`a${px}`} x1={px} x2={px} y1={y + 1} y2={y + depth / 2} stroke={g.edge} strokeOpacity={0.45} />);
      items.push(<line key={`b${px}`} x1={px + 32} x2={px + 32} y1={y + depth / 2} y2={y + depth} stroke={g.edge} strokeOpacity={0.45} />);
    }
    items.push(<line key="mid" x1={x0} x2={x1} y1={y + depth / 2} y2={y + depth / 2} stroke={g.edge} strokeOpacity={0.3} />);
  } else if (kind === 'ice') {
    for (let px = x0 + 12; px < x1; px += 46) {
      items.push(<line key={`i${px}`} x1={px} x2={px + 16} y1={y + depth - 3} y2={y + 3} stroke="#fff" strokeWidth={1.6} strokeOpacity={0.9} />);
    }
    items.push(<rect key="hl" x={x0} y={y} width={span} height={2} fill="#fff" opacity="0.8" />);
  } else if (kind === 'concrete') {
    const n = Math.floor(span / 6);
    for (let i = 0; i < n; i += 1) {
      items.push(<circle key={`s${i}`} cx={x0 + hash01(i * 1.7) * span} cy={y + 2 + hash01(i * 3.1 + 2) * (depth - 4)} r={0.8 + hash01(i + 5) * 0.9} fill="#6b7280" />);
    }
  } else if (kind === 'carpet') {
    for (let px = x0 + 2; px < x1; px += 4) {
      items.push(<line key={`f${px}`} x1={px} x2={px + (hash01(px) - 0.5) * 2} y1={y + 2} y2={y - 2} stroke="#e11d48" strokeWidth={1.3} />);
    }
  }
  return (
    <g aria-hidden="true">
      <rect x={x0} y={y} width={span} height={depth} fill={g.fill} />
      {items}
      <line x1={x0} x2={x1} y1={y} y2={y} stroke={g.edge} strokeWidth={1.6} />
      <line x1={x0} x2={x1} y1={y + depth} y2={y + depth} stroke={g.edge} strokeOpacity={0.5} />
    </g>
  );
}

/** The wooden block (side view); (x, y) is its top-left corner. */
function WoodBlock({ x, y, w, h, label, fs }) {
  return (
    <g>
      <rect x={x + 2} y={y + 3} width={w} height={h} rx={3} fill="#0f172a" opacity="0.12" />
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#e7b77d" stroke="#9a6531" strokeWidth={1.3} />
      <g fill="none" stroke="#c98e4f" strokeWidth={1.1} opacity={0.9}>
        <path d={`M${x + 4},${y + h * 0.3} q${w * 0.25},${-h * 0.12} ${w * 0.5},0 t${w * 0.46},0`} />
        <path d={`M${x + 4},${y + h * 0.72} q${w * 0.3},${h * 0.1} ${w * 0.55},0 t${w * 0.4},0`} />
      </g>
      {label && (
        <text x={x + w / 2} y={y + h / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#5b3a17">
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * The contact of block and floor "under a magnifier": two rough surfaces
 * whose bumps catch on each other, and the particles of both bodies, which
 * jiggle harder and turn from blue to red as heat Q is released.
 */
function MicroView({ cx, cy, r, heat, shift, kind, title, sliding, fs }) {
  const P = r * 0.36;
  const A = r * 0.13;
  const tri = (u) => 1 - Math.abs(2 * (u - Math.floor(u)) - 1);
  const top = [];
  const bot = [];
  for (let px = cx - r - P; px <= cx + r + P; px += P / 4) {
    top.push(`${px.toFixed(1)},${(cy - 3 + A * tri((px - cx - shift) / P + 0.5)).toFixed(1)}`);
    bot.push(`${px.toFixed(1)},${(cy + 3 - A * tri((px - cx) / P)).toFixed(1)}`);
  }
  const dotR = Math.max(2, r * 0.065);
  const col = mix('#3b82f6', '#ef4444', heat);
  const sp = r * 0.34;
  const dots = [];
  [
    [-0.68, true],
    [-0.36, true],
    [0.4, false],
    [0.72, false],
  ].forEach(([fy, moves], row) => {
    const y = cy + fy * r;
    const n = Math.ceil((2 * r) / sp) + 1;
    for (let i = 0; i < n; i += 1) {
      const off = row % 2 ? sp / 2 : 0;
      let px = cx - r + ((i * sp + off + (moves ? shift : 0)) % (2 * r) + 2 * r) % (2 * r);
      if (Math.hypot(px - cx, y - cy) > r - dotR - 3) continue;
      px = Number(px.toFixed(1));
      const id = row * 40 + i;
      dots.push(
        <circle
          key={id}
          cx={px}
          cy={y}
          r={dotR}
          fill={col}
          className="fwh-jig"
          style={{ '--a': (0.5 + 3.4 * heat).toFixed(2), '--d': `${(0.95 - 0.6 * heat).toFixed(2)}s`, animationDelay: `${(-hash01(id) * 0.9).toFixed(2)}s` }}
        />,
      );
    }
  });
  const g = FLOOR[kind];
  return (
    <g>
      <defs>
        <clipPath id="fwh-micro-clip">
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      <circle cx={cx} cy={cy} r={r + 5} fill="#fff" stroke="#cbd5e1" strokeWidth={1} />
      <g clipPath="url(#fwh-micro-clip)">
        <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill="#f8fafc" />
        <polygon points={`${cx - r - P},${cy - r} ${cx + r + P},${cy - r} ${top.reverse().join(' ')}`} fill="#e7b77d" />
        <polygon points={`${cx - r - P},${cy + r} ${cx + r + P},${cy + r} ${bot.reverse().join(' ')}`} fill={g.micro} />
        <rect x={cx - r} y={cy - A + 1} width={2 * r} height={2 * A - 2} fill={HEAT} opacity={0.4 * heat} className={sliding ? 'fwh-glow' : undefined} />
        {dots}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={2} />
      <text x={cx} y={cy - r - 10} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
        {title}
      </text>
    </g>
  );
}

/** Vertical layout shared by the height callback and the drawing. */
function layout(narrow) {
  const bw = narrow ? 50 : 72;
  const bh = narrow ? 28 : 40;
  const Lmax = narrow ? 40 : 58; // px of the weight mg
  const r = narrow ? 32 : 46;
  const yF = narrow ? 150 : 252;
  const groundD = narrow ? 12 : 16;
  const rulerY = Math.max(yF - bh / 2 + Lmax + 12, yF + groundD + 16);
  return { bw, bh, Lmax, r, yF, groundD, rulerY, H: rulerY + 30 };
}

function BlockScene({ T, surf, m, F, t, x, v, Q, E0, sStop, sliding, speedUp, footer }) {
  const L = T.block;
  const dec = T.decimal;
  const fr = T.sym.fr;
  const mg = m * G;
  const kFor = (narrow) => layout(narrow).Lmax / mg;
  const qTop = niceMax(E0);

  return (
    <LabScene
      legend={[
        { color: FORCE.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FORCE.N, label: L.legend.N, kind: 'arrow' },
        { color: FORCE.fr, label: L.legend.fr, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: HEAT, label: L.legend.heat, kind: 'heat' },
      ]}
      chips={(W, narrow) => {
        const kF = kFor(narrow);
        const scaleN = niceStep(kF, narrow ? 20 : 26);
        return (
          <>
            <Chip>
              {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
            </Chip>
            <Chip icon={RulerIcon} color={FORCE.mg}>
              <ScaleBar px={scaleN * kF} label={L.scaleLabel(trim(scaleN, dec))} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => layout(narrow).H}
      footer={footer}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), fmt(x, 2, dec), fmt(v, 2, dec), round(Q, 1, dec))}
    >
      {(W, H, narrow) => {
        const { bw, bh, r, yF, groundD, rulerY } = layout(narrow);
        const fs = narrow ? 11 : 13;
        const kF = kFor(narrow);
        const kv = narrow ? 5 : 7.5;
        const padL = bw + (narrow ? 12 : 24);
        const padR = narrow ? 16 : 24;
        const view = lineView(0, sStop * (narrow ? 1.3 : 1.25), W, padL, padR);
        const step = rulerStep(view, narrow ? 46 : 64);
        const ox = view.sx(0);
        const front = view.sx(x);
        const back = front - bw;
        const cxB = front - bw / 2;
        const stopX = view.sx(sStop);
        const box = { w: W, h: H };
        const heatLevel = Math.min(1, 0.06 + F / 12);
        const heat = Math.min(1, Math.sqrt(Q / 24));
        /* magnifier: right under the chips on wide screens, top-left on phones (legend sits below) */
        const mcx = narrow ? 16 + r : W - 122;
        const mcy = narrow ? 30 + r : 156;
        const thX = narrow ? mcx + r + 20 : W - 46;
        const thTop = narrow ? 34 : mcy - r + 10;
        const thH = narrow ? 50 : 2 * r - 22;
        const contactX = cxB;
        const dxC = contactX - mcx;
        const dyC = yF - mcy;
        const dC = Math.hypot(dxC, dyC);
        const stopText = L.stopTag(round(sStop, 2, dec));
        const stopW = textWidth(stopText, fs - 1, 600) + 16;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={rulerY - 4} step={step} rowPx={narrow ? 24 : 28} />
            {/* start line and the stopping point s = v₀²/(2μg) */}
            <line x1={ox} x2={ox} y1={yF - bh - 22} y2={rulerY} stroke={PALETTE.ink} strokeWidth={1.6} strokeDasharray="4 4" opacity={0.7} />
            <line x1={stopX} x2={stopX} y1={yF - bh - 22} y2={rulerY} stroke={PALETTE.disp} strokeWidth={1.8} strokeDasharray="6 4" />
            <Floor x0={0} x1={W} y={yF} depth={groundD} kind={surf} />
            {/* the floor warmed along the path: Q per metre = F_ishq */}
            {x > 0.001 && <HeatTrail x1={ox - bw + 3} y1={yF + 1.5} x2={front - 3} y2={yF + 1.5} level={heatLevel} width={narrow ? 3 : 4} spacing={narrow ? 26 : 34} />}
            <WoodBlock x={back} y={yF - bh} w={bw} h={bh} />
            <text x={back + 1} y={yF - bh - 6} fontSize={fs - 1} fontWeight="700" fill="#5b3a17" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
              {L.massTag(fmt(m, 1, dec))}
            </text>
            {Q > 0.01 && <rect x={back + 2} y={yF - 3} width={bw - 4} height={3} rx={1.5} fill={HEAT} opacity={0.35 + 0.5 * heatLevel} />}
            {/* forces: weight from the centre, normal force and friction at the contact */}
            <VecArrow x={cxB - 7} y={yF - bh / 2} dx={0} dy={mg * kF} color={FORCE.mg} main="mg" fs={fs} place="left" />
            <VecArrow x={cxB + 7} y={yF} dx={0} dy={-mg * kF} color={FORCE.N} main="N" fs={fs} place="right" />
            {sliding && <VecArrow x={back} y={yF - 4} dx={-F * kF} dy={0} color={FORCE.fr} main="F" sub={fr} fs={fs} place="left" />}
            {v > 0.01 && <VecArrow x={front + 3} y={yF - bh / 2} dx={v * kv} dy={0} color={PALETTE.vel} main="v" fs={fs} place="right" width={2.8} />}
            {/* magnifier and heat meter */}
            {dC > r + 12 && (
              <line
                x1={mcx + (dxC / dC) * (r + 5)}
                y1={mcy + (dyC / dC) * (r + 5)}
                x2={contactX}
                y2={yF - 2}
                stroke="#334155"
                strokeOpacity={0.45}
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
            )}
            <MicroView cx={mcx} cy={mcy} r={r} heat={heat} shift={x * 60} kind={surf} title={L.micro} sliding={sliding} fs={narrow ? 10 : 11} />
            <Thermometer x={thX} top={thTop} h={thH} value={Q} min={0} max={qTop} step={qTop / 2} unit={L.qUnit} decimal={dec} fs={narrow ? 9 : 10} tubeW={narrow ? 8 : 10} />
            <Pill x={stopX + 8 + stopW / 2} y={yF + groundD + (rulerY - yF - groundD) / 2} text={stopText} bg={PALETTE.disp} size={fs - 1} box={box} />
            {/* ruler with the distance covered */}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
            {x > 0.001 && <line x1={ox} x2={front} y1={rulerY - 4} y2={rulerY - 4} stroke={PALETTE.disp} strokeWidth={3} strokeLinecap="round" />}
            <path d={`M${front},${rulerY - 1} l-5,-8 l10,0 Z`} fill={PALETTE.disp} />
          </>
        );
      }}
    </LabScene>
  );
}

