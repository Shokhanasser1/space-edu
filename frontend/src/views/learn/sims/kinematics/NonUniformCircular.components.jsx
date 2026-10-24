import { useState } from 'react';
import { CircleDot, Lightbulb, MoveRight, Rocket, TrendingDown, Triangle } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Calc, Panel, PlayButtons, RichPill, SimScene, Tag, TimeChip, Toolbar, arcD, num, rich, richSvg } from './NonUniformCircular.parts';
import { COL, betaDeg } from './NonUniformCircular.track';

/**
 * One moment of the motion: speed v, tangential acceleration a_τ and the
 * radius of curvature R (up to R → ∞, a straight line). The point is kept at
 * the top of its trajectory (the camera rides along), the components are
 * drawn at it, and the right triangle a_τ + a_n = a is drawn large on the
 * side: a = √(a_τ² + a_n²), tg β = a_n/a_τ with β the angle between a and v.
 * "Motion" lets v change at the rate a_τ, so the triangle can be watched as
 * the speed grows or falls, and paused at any moment.
 */

const R_LIST = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300, 500, Infinity];
const VCAP = 15;
const CASES = [
  { id: 'general', icon: Triangle, v: 10, at: 2, ri: 5 },
  { id: 'uniform', icon: CircleDot, v: 10, at: 0, ri: 5 },
  { id: 'line', icon: MoveRight, v: 10, at: 2, ri: 13 },
  { id: 'start', icon: Rocket, v: 0, at: 2, ri: 5 },
  { id: 'brake', icon: TrendingDown, v: 10, at: -2, ri: 5 },
];
const Y_NICE = [2, 4, 8, 12, 16, 20, 24, 32, 40];

export default function ComponentsSim({ T }) {
  const tx = T.components;
  const dec = T.decimal;
  const [caseId, setCaseId] = useState('general');
  const [v, setV] = useState(10);
  const [at, setAt] = useState(2);
  const [ri, setRi] = useState(5);
  const [sim, setSim] = useState({ running: false, s: 0, t: 0 });
  const R = R_LIST[ri];
  const inf = !Number.isFinite(R);

  useRafLoop(sim.running, (dt) => {
    const vn = clamp(v + at * dt, 0, VCAP);
    setV(vn);
    const stop = (at < 0 && vn <= 0) || (at > 0 && vn >= VCAP) || Math.abs(at) < 1e-9;
    setSim((p) => ({ running: p.running && !(stop && Math.abs(at) > 1e-9), s: p.s + ((v + vn) / 2) * dt, t: p.t + dt }));
  });

  const pickCase = (id) => {
    const c = CASES.find((x) => x.id === id);
    setCaseId(id);
    setV(c.v);
    setAt(c.at);
    setRi(c.ri);
    setSim((p) => ({ ...p, running: false, t: 0 }));
  };
  const custom = (setter) => (x) => {
    setter(x);
    setCaseId(null);
  };
  const toggle = () => {
    if (sim.running) setSim((p) => ({ ...p, running: false }));
    else {
      if (at < 0 && v <= 0) setV(VCAP);
      if (at > 0 && v >= VCAP) setV(0);
      setSim((p) => ({ ...p, running: true }));
    }
  };
  const reset = () => (caseId ? pickCase(caseId) : setSim((p) => ({ ...p, running: false, t: 0 })));

  const an = inf ? 0 : (v * v) / R;
  const a = Math.hypot(at, an);
  const beta = betaDeg(at, an);
  const B = beta === null ? '—' : fmt(beta, 0, dec);
  const Rtxt = inf ? '∞' : `${R} ${T.m}`;
  const atSq = at < 0 ? `(${fmt(at, 1, dec)})` : fmt(at, 1, dec);

  /* ---- explanation */
  let key = 'general';
  if (a < 1e-9) key = 'zero';
  else if (inf && Math.abs(at) > 1e-9) key = 'line';
  else if (v < 1e-9) key = 'start';
  else if (Math.abs(at) < 1e-9) key = 'uniform';
  else if (at < 0) key = 'brake';
  const settled = useSettled(key, 200);
  const ex = tx.explain;
  const text = {
    general: ex.general(B),
    brake: ex.brake(B),
    uniform: ex.uniform(num(an, dec)),
    line: ex.line(fmt(at, 1, dec)),
    start: ex.start(fmt(at, 1, dec)),
    zero: ex.zero,
  }[settled];
  const tone = { general: '#60a5fa', brake: '#f472b6', uniform: '#34d399', line: '#a78bfa', start: COL.atText, zero: '#94a3b8' }[settled];

  /* ---- graph: a_τ, a_n and a against v */
  const pts = (f) => Array.from({ length: 61 }, (_, i) => ({ x: (i / 60) * VCAP, y: f((i / 60) * VCAP) }));
  const anOf = (u) => (inf ? 0 : (u * u) / R);
  const aTop = Math.hypot(at, anOf(VCAP));
  const yMax = Y_NICE.find((n) => n >= aTop * 1.05) ?? 40;

  let betaSub = tx.readouts.betaSub.none;
  if (beta !== null) {
    if (beta < 0.5) betaSub = tx.readouts.betaSub.along;
    else if (Math.abs(beta - 90) < 0.5) betaSub = tx.readouts.betaSub.right;
    else betaSub = beta < 90 ? tx.readouts.betaSub.fwd : tx.readouts.betaSub.back;
  }

  const calcRows = [
    {
      sym: 'a_n',
      color: COL.anText,
      formula: 'v²/R',
      subst: inf ? `(${fmt(v, 1, dec)} ${T.ms})² / ∞` : `(${fmt(v, 1, dec)} ${T.ms})² / ${R} ${T.m}`,
      result: `${num(an, dec)} ${T.ms2}`,
    },
    { sym: 'a', color: COL.aText, formula: '√(a_τ² + a_n²)', subst: `√(${atSq}² + ${num(an, dec)}²)`, result: `${num(a, dec)} ${T.ms2}` },
  ];
  if (beta !== null && Math.abs(at) > 1e-9 && an > 1e-9)
    calcRows.push({ sym: `${tx.calc.tg} β`, color: '#e2e8f0', formula: 'a_n/a_τ', subst: `${num(an, dec)} / ${fmt(at, 1, dec)}`, result: `${num(an / at, dec)} → β = ${B}°` });

  const legend = [
    { label: tx.legend.v, color: COL.v, kind: 'arrow' },
    { label: tx.legend.at, color: COL.at, kind: 'arrow' },
    { label: tx.legend.an, color: COL.an, kind: 'arrow' },
    { label: tx.legend.a, color: COL.a, kind: 'arrow' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.casesLabel}
        value={caseId}
        onChange={pickCase}
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        options={CASES.map((c) => ({ value: c.id, label: rich(tx.cases[c.id].name), sub: rich(tx.cases[c.id].sub), icon: c.icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={sim.t > 0} onToggle={toggle} onReset={reset} playLabel={sim.running ? undefined : tx.play} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.realTime} />}
        ariaLabel={tx.sceneLabel(fmt(at, 1, dec), num(an, dec), num(a, dec))}
        height={(W, narrow) => (narrow ? W * 1.55 : clamp(W * 0.42, 420, 500))}
      >
        {(W, H, narrow) => <ComponentsDrawing W={W} H={H} narrow={narrow} v={v} at={at} an={an} a={a} beta={beta} R={R} s={sim.s} tx={tx} dec={dec} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.at} symbol={rich('a_τ')} value={fmt(at, 1, dec)} unit={T.ms2} accent={COL.at} textColor={COL.atText} sub={tx.readouts.atSub} />
        <Readout label={tx.readouts.an} symbol={rich('a_n')} value={num(an, dec)} unit={T.ms2} accent={COL.an} textColor={COL.anText} sub={tx.readouts.anSub} />
        <Readout label={tx.readouts.a} symbol="a" value={num(a, dec)} unit={T.ms2} accent={COL.a} textColor={COL.aText} sub={rich(tx.readouts.aSub)} />
        <Readout label={tx.readouts.beta} symbol="β" value={B} unit={beta === null ? '' : '°'} accent="#94a3b8" textColor="#e2e8f0" sub={betaSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="cmp-v"
            label={tx.v}
            symbol="v"
            min={0}
            max={VCAP}
            step={0.5}
            value={v}
            onChange={custom((x) => {
              setV(x);
              setSim((p) => ({ ...p, running: false }));
            })}
            accent={COL.v}
            display={`${fmt(v, 1, dec)} ${T.ms}`}
          />
          <RangeField
            id="cmp-at"
            label={tx.at}
            symbol={rich('a_τ')}
            min={-4}
            max={4}
            step={0.1}
            value={at}
            onChange={custom(setAt)}
            accent={COL.at}
            display={`${at > 0 ? '+' : ''}${fmt(at, 1, dec)} ${T.ms2}`}
            valueText={`${fmt(at, 1, dec)} ${T.ms2}`}
          />
          <RangeField
            id="cmp-r"
            label={tx.R}
            symbol="R"
            min={0}
            max={R_LIST.length - 1}
            step={1}
            value={ri}
            onChange={custom(setRi)}
            accent="#a78bfa"
            display={Rtxt}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={rich(tx.graph.title(Rtxt, fmt(at, 1, dec)))}
            ariaLabel={tx.graph.title(Rtxt, fmt(at, 1, dec)).replace(/_/g, '')}
            series={[
              { id: 'at', label: <span>{rich('|a_τ|')}</span>, color: '#60a5fa', points: pts(() => Math.abs(at)), dot: false, dash: '6 5' },
              { id: 'an', label: <span>{rich('a_n')}</span>, color: '#f472b6', points: pts(anOf), dot: false },
              { id: 'a', label: 'a', color: '#fb923c', points: pts((u) => Math.hypot(at, anOf(u))), dot: false },
              { id: 'now', label: `v = ${fmt(v, 1, dec)} ${T.ms}`, color: '#22d3ee', points: [{ x: v, y: a }] },
            ]}
            xMax={VCAP}
            yMax={yMax}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            marker={v}
            decimal={dec}
            yDigits={yMax / 4 < 1 ? 1 : 0}
            onScrub={(x) => {
              setSim((p) => ({ ...p, running: false }));
              setCaseId(null);
              setV(Math.round(x * 2) / 2);
            }}
            note={rich(tx.graph.note)}
          />
          <div className="mt-3">
            <Calc title={tx.calc.title} rows={calcRows} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function ComponentsDrawing({ W, H, narrow, v, at, an, a, beta, R, s, tx, dec, T }) {
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const inf = !Number.isFinite(R);

  /* trajectory view: the point sits at the top of its path */
  const Lw = narrow ? W : W * 0.56;
  const Hc = narrow ? W * 0.8 : H;
  const P = { x: Lw * 0.5, y: narrow ? Hc * 0.36 : Hc * 0.36 };
  const k = (0.5 * Hc) / 40; // px per metre on the path
  const Rp = inf ? Infinity : R * k;
  const ticks = [];
  const step = 5;
  const off = ((s % step) + step) % step;
  for (let j = -40; j <= 40; j += 1) {
    const sig = j * step - off;
    let x;
    let y;
    let nx;
    let ny;
    if (inf) {
      x = P.x + sig * k;
      y = P.y;
      nx = 0;
      ny = 1;
    } else {
      const th = sig / R;
      if (Math.abs(th) > Math.PI) continue;
      x = P.x + Rp * Math.sin(th);
      y = P.y + Rp * (1 - Math.cos(th));
      nx = -Math.sin(th);
      ny = Math.cos(th);
    }
    if (x < -10 || x > Lw + 10 || y > Hc + 10) continue;
    ticks.push(<line key={j} x1={x - nx * 6} y1={y - ny * 6} x2={x + nx * 6} y2={y + ny * 6} stroke="#a78bfa" strokeWidth="1.5" />);
  }
  const centreVisible = !inf && P.y + Rp < Hc - 24;

  const kV = (0.36 * Lw) / VCAP;
  const Lv = v * kV;
  const kA = (0.3 * Hc) / Math.max(6, a);
  const Lt = at * kA;
  const Ln = an * kA;
  const tip = { x: P.x + Lt, y: P.y + Ln };

  /* triangle box */
  const bx = narrow ? 12 : Lw + 6;
  const by = narrow ? Hc + 6 : 64;
  const bw = narrow ? W - 24 : W - Lw - 20;
  const bh = narrow ? H - Hc - 18 : H - by - 18;
  const sT = Math.min((bw - 110) / Math.max(Math.abs(at), 0.3), (bh - 130) / Math.max(an, 0.3), narrow ? 50 : 85);
  const Q = { x: bx + 52 + (at < 0 ? Math.abs(at) * sT : 0), y: by + 74 };
  const A1 = { x: Q.x + at * sT, y: Q.y };
  const C1 = { x: A1.x, y: Q.y + an * sT };
  const bAng = beta === null ? 0 : (beta * Math.PI) / 180;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      {Array.from({ length: Math.ceil(W / 26) + 1 }, (_, i) => (
        <line key={`gx${i}`} x1={i * 26} x2={i * 26} y1={0} y2={H} stroke={PALETTE.grid} />
      ))}
      {Array.from({ length: Math.ceil(H / 26) + 1 }, (_, i) => (
        <line key={`gy${i}`} x1={0} x2={W} y1={i * 26} y2={i * 26} stroke={PALETTE.grid} />
      ))}

      {/* trajectory */}
      {inf ? (
        <line x1={0} x2={Lw} y1={P.y} y2={P.y} stroke={PALETTE.path} strokeWidth="2.5" />
      ) : (
        <circle cx={P.x} cy={P.y + Rp} r={Rp} fill="none" stroke={PALETTE.path} strokeWidth="2.5" />
      )}
      {ticks}
      {centreVisible ? (
        <g>
          <line x1={P.x} y1={P.y} x2={P.x} y2={P.y + Rp} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4" />
          <circle cx={P.x} cy={P.y + Rp} r={4} fill="#0f172a" />
          <Tag x={P.x + 10} y={P.y + Rp + 5} text="O" color="#0f172a" size={fs} italic={false} anchor="start" />
          <RichPill x={P.x + 46} y={P.y + Rp * 0.62} text={`R = ${R} ${T.m}`} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs - 1} box={{ w: Lw, h: Hc }} />
        </g>
      ) : (
        <g>
          <line x1={P.x} y1={P.y + 8} x2={P.x} y2={Hc - 30} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4" />
          <text x={P.x} y={Hc - 12} textAnchor="middle" fontSize={fs} fill="#475569">
            {inf ? tx.noCentre : `↓ ${tx.toCentre(R)}`}
          </text>
        </g>
      )}

      {/* the components at the point */}
      {Math.abs(Lt) > 3 && Ln > 3 && (
        <g stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4">
          <line x1={P.x + Lt} y1={P.y} x2={tip.x} y2={tip.y} />
          <line x1={P.x} y1={P.y + Ln} x2={tip.x} y2={tip.y} />
        </g>
      )}
      {Lv > 4 && <Arrow x1={P.x} y1={P.y} x2={P.x + Lv} y2={P.y} color={COL.v} width={3.4} head={12} />}
      {Math.abs(Lt) > 4 && <Arrow x1={P.x} y1={P.y} x2={P.x + Lt} y2={P.y} color={COL.at} width={3} head={11} opacity={0.9} />}
      {Ln > 4 && <Arrow x1={P.x} y1={P.y} x2={P.x} y2={P.y + Ln} color={COL.an} width={3} head={11} />}
      {a > 1e-9 && <Arrow x1={P.x} y1={P.y} x2={tip.x} y2={tip.y} color={COL.a} width={4} head={13} />}
      <circle cx={P.x} cy={P.y} r={7} fill="#0f172a" stroke="#fff" strokeWidth="2" />
      {Lv > 4 && <Tag x={P.x + Lv + 12} y={P.y - 8} text="v" color={COL.v} size={fs + 3} />}
      {Math.abs(Lt) > 16 && <Tag x={P.x + Lt + (Lt > 0 ? -4 : 4)} y={P.y - 12} text="a_τ" color={COL.at} size={fs + 2} anchor={Lt > 0 ? 'end' : 'start'} />}
      {Ln > 16 && <Tag x={P.x - 10} y={P.y + Ln} text="a_n" color={COL.an} size={fs + 2} anchor="end" />}
      {a > 1e-9 && <Tag x={tip.x + (at >= 0 ? 12 : -12)} y={tip.y + 16} text="a" color={COL.a} size={fs + 3} />}

      {/* the triangle, large */}
      <rect x={bx} y={by} width={bw} height={bh} rx="14" fill="#ffffff" stroke="#e2e8f0" />
      <text x={bx + 14} y={by + 24} fontSize={fs + 1} fontWeight="700" fill="#0f172a">
        {tx.triangle}
      </text>
      {a < 1e-9 ? (
        <text x={bx + bw / 2} y={by + bh / 2} textAnchor="middle" fontSize={fs + 6} fontWeight="700" fill="#94a3b8">
          {tx.zero}
        </text>
      ) : (
        <g>
          <line x1={Q.x} y1={Q.y} x2={Q.x + Math.max(60, Math.abs(at) * sT + 30)} y2={Q.y} stroke={COL.v} strokeWidth="1.5" strokeDasharray="5 4" opacity="0.8" />
          <Tag x={Q.x + Math.max(60, Math.abs(at) * sT + 30) + 10} y={Q.y + 5} text="v" color={COL.v} size={fs + 2} anchor="start" />
          {Math.abs(at) > 1e-9 && an > 1e-9 && (
            <path d={`M${A1.x - Math.sign(at) * 10},${A1.y} L${A1.x - Math.sign(at) * 10},${A1.y + 10} L${A1.x},${A1.y + 10}`} fill="none" stroke="#0f172a" strokeWidth="1.2" />
          )}
          {beta !== null && beta > 1 && <path d={arcD(Q.x, Q.y, 30, 0, -bAng)} fill="none" stroke="#475569" strokeWidth="1.6" />}
          {beta !== null && beta > 8 && (
            <Tag x={Q.x + 44 * Math.cos(bAng / 2)} y={Q.y + 44 * Math.sin(bAng / 2) + 5} text="β" color="#334155" size={fs + 1} />
          )}
          {Math.abs(at) > 1e-9 && <Arrow x1={Q.x} y1={Q.y} x2={A1.x} y2={A1.y} color={COL.at} width={3.5} head={13} />}
          {an > 1e-9 && <Arrow x1={A1.x} y1={A1.y} x2={C1.x} y2={C1.y} color={COL.an} width={3.5} head={13} />}
          <Arrow x1={Q.x} y1={Q.y} x2={C1.x} y2={C1.y} color={COL.a} width={4.5} head={15} />
          <circle cx={Q.x} cy={Q.y} r={3.5} fill="#0f172a" />
          {Math.abs(at) > 1e-9 && (
            <RichPill x={(Q.x + A1.x) / 2} y={Q.y - 18} text={`a_τ = ${fmt(at, 1, dec)}`} bg={COL.at} size={fs} box={box} />
          )}
          {an > 1e-9 && (
            <RichPill x={A1.x + (at >= 0 ? 52 : -52)} y={(A1.y + C1.y) / 2} text={`a_n = ${num(an, dec)}`} bg={COL.an} size={fs} box={box} />
          )}
          <RichPill
            x={(Q.x + C1.x) / 2 + (at >= 0 ? -44 : 44)}
            y={(Q.y + C1.y) / 2 + 18}
            text={`a = ${num(a, dec)}`}
            bg={COL.a}
            size={fs}
            box={box}
          />
          <text x={bx + 14} y={by + bh - 16} fontSize={fs} fontWeight="600" fill="#c2410c">
            {richSvg(tx.formula(at < 0 ? `(${fmt(at, 1, dec)})` : fmt(at, 1, dec), num(an, dec), num(a, dec)), fs)}
          </text>
        </g>
      )}
    </g>
  );
}
