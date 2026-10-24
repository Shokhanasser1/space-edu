import { useState } from 'react';
import { Lightbulb, Ruler as RulerIcon, Snowflake, Sparkles, Spline, TreePine } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, PALETTE, makeView } from '../kit/scene';
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
  PlayControls,
  Rich,
  ScaleBar,
  VecArrow,
  WorkList,
  eDigits,
  niceMax,
  round,
  tickDigits,
  trim,
} from './FrictionWorkHeat.parts';

/**
 * Tab 2 — a child slides down a playground slide with friction. The slide
 * is a 3 : 4 : 5 triangle (sin α = 0.6, cos α = 0.8, α ≈ 36.9°): height h,
 * base d = 4h/3, length L = 5h/3. Gravity does positive work mg(h − y),
 * friction F = μmg·cos α does negative work −F·l, so the mechanical
 * energy falls: E₂ − E₁ = A_ishq, and the loss is heat Q. At the bottom
 * v = √(2g(h − μd)) < √(2gh). A faded "ghost" child slides without friction.
 * Preset: m = 20 kg, h = 3 m, μ = 0.25 → E_p = 588 J, F = 39.2 N,
 * Q = 196 J, E_k = 392 J, v = 6.26 m/s (frictionless 7.67 m/s), a = 3.92 m/s².
 * Shown at half speed. Strings come from T.slide.
 */

const SIN = 0.6;
const COS = 0.8;
const MASS = 20;
const SLOW = 0.5;
const SLIDE_PRESETS = [
  { id: 'none', mu: 0, icon: Sparkles },
  { id: 'ice', mu: 0.1, icon: Snowflake },
  { id: 'plastic', mu: 0.25, icon: Spline },
  { id: 'rough', mu: 0.5, icon: TreePine },
];
const IDLE = { t: 0, running: false, done: false };

export default function SlideSim({ T }) {
  const L = T.slide;
  const dec = T.decimal;
  const fr = T.sym.fr;
  const [mu, setMu] = useState(0.25);
  const [h, setH] = useState(3);
  const [sim, setSim] = useState(IDLE);

  const m = MASS;
  const Lx = (5 * h) / 3;
  const d = (4 * h) / 3;
  const a = G * (SIN - mu * COS);
  const tEnd = Math.sqrt((2 * Lx) / a);
  const E0 = m * G * h;
  const F = mu * m * G * COS;
  const QEnd = F * Lx;
  const vEnd = Math.sqrt(2 * G * (h - mu * d));
  const vIdeal = Math.sqrt(2 * G * h);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt * SLOW);
      const done = t >= tEnd - 1e-9;
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
  const l = sim.done ? Lx : Math.min(Lx, 0.5 * a * t * t);
  const v = sim.done ? vEnd : a * t;
  const lGhost = Math.min(Lx, 0.5 * G * SIN * t * t);
  const y = h - l * SIN;
  const Ep = m * G * y;
  const Q = F * l;
  const Ek = Math.max(0, E0 - Ep - Q);
  const Ag = E0 - Ep;
  const ed = eDigits(E0);
  const E = (n) => round(n, ed, dec);
  const D = (n) => trim(n, dec);
  const V = (n) => round(n, 2, dec);
  const M = (n) => round(n, 2, dec);

  /* explanation */
  const ideal = mu < 1e-9;
  let key = 'idle';
  if (sim.done) key = ideal ? 'doneIdeal' : 'done';
  else if (t > 0) key = ideal ? 'slideIdeal' : t < 0.45 * tEnd ? 'slide' : 'ghost';
  const settled = useSettled(key, key.startsWith('slide') || key === 'ghost' ? 300 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(E(E0)),
    slide: ex.slide(fr),
    slideIdeal: ex.slideIdeal,
    ghost: ex.ghost,
    done: ex.done(V(vEnd), V(vIdeal), E(QEnd), fmt((QEnd / E0) * 100, 0, dec), fr),
    doneIdeal: ex.doneIdeal(V(vIdeal)),
  }[settled];
  const tone = { idle: '#22d3ee', slide: '#60a5fa', slideIdeal: '#60a5fa', ghost: '#fb923c', done: '#34d399', doneIdeal: '#34d399' }[settled];

  const xTop = niceMax(Lx);
  const yTop = niceMax(E0 * 1.04);
  const sym = T.sym;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={SLIDE_PRESETS.find((p) => Math.abs(p.mu - mu) < 1e-9)?.id}
            onChange={(id) => change(setMu)(SLIDE_PRESETS.find((p) => p.id === id).mu)}
            options={SLIDE_PRESETS.map((p) => ({ value: p.id, label: L.presets[p.id].name, sub: L.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <SlideScene
          T={T}
          mu={mu}
          h={h}
          t={t}
          l={l}
          lGhost={lGhost}
          v={v}
          y={y}
          F={F}
          footer={
            <EqBand
              title={L.band}
              terms={[
                { sym: 'mgh', value: `${E(E0)} ${T.J}`, color: ENERGY_INK.tot },
                { op: '=' },
                { sym: `E_{${sym.p}}`, value: E(Ep), color: ENERGY_INK.p },
                { op: '+' },
                { sym: `E_{${sym.k}}`, value: E(Ek), color: ENERGY_INK.k },
                { op: '+' },
                { sym: 'Q', value: E(Q), color: ENERGY_INK.q },
              ]}
              extra={L.bandExtra(E(Ep + Ek), fr)}
            />
          }
        />
        <EnergyPanel title={L.panel.title} unit={T.J}>
          <EnergyBars
            items={[
              { id: 'p', label: `E_{${sym.p}}`, value: Ep, color: ENERGY.p, text: ENERGY_TEXT.p },
              { id: 'k', label: `E_{${sym.k}}`, value: Ek, color: ENERGY.k, text: ENERGY_TEXT.k },
              { id: 'q', label: 'Q', value: Q, color: ENERGY.q, text: ENERGY_TEXT.q },
            ]}
            stack={['p', 'k', 'q']}
            total={E0}
            max={E0 * 1.2}
            digits={ed}
            decimal={dec}
            stackLabel={`E_{${sym.p}}+E_{${sym.k}}+Q`}
            ariaLabel={L.panel.aria(E(Ep), E(Ek), E(Q), E(E0))}
          />
          <BalanceLine>
            <Rich>{`E_{${sym.p}} + E_{${sym.k}} + Q = ${E(Ep)} + ${E(Ek)} + ${E(Q)} = ${E(E0)} ${T.J}`}</Rich>
            <span className="text-gray-500"> · {L.panel.constant}</span>
          </BalanceLine>
          <WorkList
            title={L.panel.works}
            rows={[
              { id: 'mg', sym: 'mg', color: FORCE_TEXT.mg, value: `A = ${Ag > 0.0005 ? '+' : ''}${E(Ag)} ${T.J}`, note: L.panel.down },
              { id: 'N', sym: 'N', color: FORCE_TEXT.N, value: 'A = 0', note: L.panel.perp },
              { id: 'fr', sym: `F_{${fr}}`, color: FORCE_TEXT.fr, value: `A = ${E(-Q)} ${T.J}`, note: L.panel.against },
            ]}
          />
          <p className="text-[12px] leading-snug tabular-nums text-gray-400">
            <Rich>{L.panel.law(E(Ep + Ek), E(E0), E(-Q), fr)}</Rich>
          </p>
        </EnergyPanel>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.Ep} symbol={<Rich>{`E_{${sym.p}}`}</Rich>} value={E(Ep)} unit={T.J} accent={ENERGY.p} textColor={ENERGY_TEXT.p} sub={<Rich>{L.EpSub(M(y))}</Rich>} />
        <Readout label={L.readouts.Ek} symbol={<Rich>{`E_{${sym.k}}`}</Rich>} value={E(Ek)} unit={T.J} accent={ENERGY.k} textColor={ENERGY_TEXT.k} sub={L.EkSub(V(v))} />
        <Readout label={L.readouts.Q} symbol="Q" value={E(Q)} unit={T.J} accent={ENERGY.q} textColor={ENERGY_TEXT.q} sub={<Rich>{L.QSub(E(-Q), fr)}</Rich>} />
        <Readout
          label={L.readouts.vEnd}
          symbol="v"
          value={sim.done ? V(vEnd) : '—'}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={L.vEndSub(V(vEnd), V(vIdeal))}
          active={sim.done}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {sim.done && <p className="text-xs font-semibold text-emerald-300">✓ {L.checked}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={FORCE_TEXT.mg}
            general={`A_{mg} = mg(h − y) = E_{${sym.p}1} − E_{${sym.p}2}`}
            filled={`= ${m} · ${D(G)} · (${D(h)} − ${M(y)})`}
            result={`A_{mg} = ${E(Ag)} ${T.J}`}
          />
          <FormulaTile
            tag={L.f2}
            color={FORCE_TEXT.fr}
            general={`A_{${fr}} = −μmg·cosα · l`}
            filled={`= −${D(mu)} · ${m} · ${D(G)} · ${D(COS)} · ${M(l)}`}
            result={`A_{${fr}} = ${E(-Q)} ${T.J}`}
            note={L.f2note}
          />
          <FormulaTile
            tag={L.f3}
            color={PALETTE.velText}
            general="v = √(2g(h − μd))"
            filled={`= √(2 · ${D(G)} · (${D(h)} − ${D(mu)} · ${trim(d, dec, 2)}))`}
            result={`v = ${V(vEnd)} ${T.ms}`}
            ok={sim.done}
            note={L.f3note(V(vIdeal))}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="fwh-mu"
            label={L.mu}
            symbol="μ"
            min={0}
            max={0.6}
            step={0.05}
            value={mu}
            onChange={change(setMu)}
            accent={FORCE_TEXT.fr}
            display={fmt(mu, 2, dec)}
            hint={L.muHint}
          />
          <RangeField
            id="fwh-h"
            label={L.h}
            symbol="h"
            min={1}
            max={5}
            step={0.5}
            value={h}
            onChange={change(setH)}
            accent={PALETTE.dispText}
            display={`${fmt(h, 1, dec)} ${T.m}`}
            hint={L.hHint(trim(d, dec, 2), trim(Lx, dec, 2))}
          />
          <InfoBox
            title={L.info.title}
            items={[
              ['m', `${m} ${T.kg}`, FORCE_TEXT.mg],
              ['α', `≈ ${fmt(36.87, 1, dec)}°`, '#e2e8f0'],
              ['a = g(sinα − μcosα)', `${round(a, 2, dec)} ${T.ms2}`, PALETTE.accText],
            ]}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyGraph
            title={L.graph.title}
            series={[
              { id: 'p', label: `E_{${sym.p}}`, color: ENERGY_TEXT.p, plan: [{ x: 0, y: E0 }, { x: Lx, y: 0 }], live: [{ x: 0, y: E0 }, { x: l, y: Ep }] },
              { id: 'k', label: `E_{${sym.k}}`, color: ENERGY_TEXT.k, plan: [{ x: 0, y: 0 }, { x: Lx, y: E0 - QEnd }], live: [{ x: 0, y: 0 }, { x: l, y: Ek }] },
              { id: 'q', label: 'Q', color: ENERGY_TEXT.q, plan: [{ x: 0, y: 0 }, { x: Lx, y: QEnd }], live: [{ x: 0, y: 0 }, { x: l, y: Q }] },
              { id: 'tot', label: `E_{${sym.p}} + E_{${sym.k}} + Q`, color: ENERGY_TEXT.tot, dash: true, plan: [{ x: 0, y: E0 }, { x: xTop, y: E0 }] },
            ]}
            xMax={xTop}
            yMax={yTop}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={l}
            note={L.graph.note}
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

/** The world box shown: it zooms with the slide's height so the child stays readable (the axes keep the true metres). */
const boxFor = (h) => ({ x0: -3.4, x1: (4 * h) / 3 + 2, y0: -1.05, y1: h + 1.3 });
const PAD_WIDE = { l: 40, r: 16, t: 64, b: 30 };
const PAD_NARROW = { l: 30, r: 10, t: 40, b: 26 };

function sceneSize(W, narrow) {
  return Math.round(narrow ? clamp(W * 0.82, 250, 330) : 400);
}

/** A child sitting on the slide; (x, y) is the seat on the surface, `ang` the slope in degrees, `s` px per design unit. */
function Kid({ x, y, ang, s, ghost }) {
  const c = ghost
    ? { legs: '#94a3b8', shoe: '#94a3b8', shirt: '#cbd5e1', skin: '#e2e8f0', hair: '#94a3b8' }
    : { legs: '#1d4ed8', shoe: '#111827', shirt: '#ef4444', skin: '#f2c18d', hair: '#3f2a14' };
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${ang}) scale(${s.toFixed(3)})`} opacity={ghost ? 0.55 : 1}>
      <rect x={-2} y={-9} width={27} height={8} rx={4} fill={c.legs} stroke={ghost ? '#64748b' : 'none'} strokeDasharray={ghost ? '2 2' : undefined} />
      <rect x={23} y={-13} width={7} height={12} rx={3} fill={c.shoe} />
      <g transform="rotate(-14)">
        <rect x={-7} y={-33} width={14} height={27} rx={6} fill={c.shirt} stroke={ghost ? '#64748b' : 'none'} strokeDasharray={ghost ? '2 2' : undefined} />
      </g>
      <circle cx={-6} cy={-41} r={8} fill={c.skin} stroke={ghost ? '#64748b' : 'none'} strokeDasharray={ghost ? '2 2' : undefined} />
      <path d="M-14,-42 a8,8 0 0 1 16,0 q-8,-4 -16,0 Z" fill={c.hair} />
      <path d="M-4,-27 L12,-14" stroke={c.shirt} strokeWidth={5} strokeLinecap="round" />
      <circle cx={13} cy={-13} r={2.6} fill={c.skin} />
    </g>
  );
}

/** A dimension line with arrowheads at both ends. */
function Dim({ x1, y1, x2, y2, color = '#334155' }) {
  return (
    <g>
      <Arrow x1={(x1 + x2) / 2} y1={(y1 + y2) / 2} x2={x1} y2={y1} color={color} width={1.4} head={7} />
      <Arrow x1={(x1 + x2) / 2} y1={(y1 + y2) / 2} x2={x2} y2={y2} color={color} width={1.4} head={7} />
    </g>
  );
}

function SlideScene({ T, mu, h, t, l, lGhost, v, y, F, footer }) {
  const L = T.slide;
  const dec = T.decimal;
  const fr = T.sym.fr;
  const mg = MASS * G;
  const N = mg * COS;
  const d = (4 * h) / 3;
  const Lx = (5 * h) / 3;
  const kFor = (narrow) => (narrow ? 44 : 70) / mg;

  return (
    <LabScene
      legend={[
        { color: FORCE.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FORCE.N, label: L.legend.N, kind: 'arrow' },
        { color: FORCE.fr, label: L.legend.fr, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: HEAT, label: L.legend.heat, kind: 'heat' },
        ...(mu > 0 ? [{ color: '#64748b', label: L.legend.ghost, kind: 'ghost' }] : []),
      ]}
      chips={(W, narrow) => {
        const kF = kFor(narrow);
        const scaleN = niceStep(kF, narrow ? 20 : 26);
        return (
          <>
            <Chip>
              {L.chipSlow} · t = {fmt(t, 2, dec)} {T.s}
            </Chip>
            <Chip icon={RulerIcon} color={FORCE.mg}>
              <ScaleBar px={scaleN * kF} label={L.scaleLabel(trim(scaleN, dec))} />
            </Chip>
          </>
        );
      }}
      height={sceneSize}
      footer={footer}
      ariaLabel={L.sceneLabel(fmt(h, 1, dec), fmt(mu, 2, dec), fmt(y, 2, dec), fmt(v, 2, dec))}
    >
      {(W, H, narrow) => {
        const pad = narrow ? PAD_NARROW : PAD_WIDE;
        const view = makeView(boxFor(h), W, H, pad);
        const { sx, sy, k } = view;
        const fs = narrow ? 11 : 13;
        const fsS = narrow ? 10 : 12;
        const box = { w: W, h: H };
        const kF = kFor(narrow);
        const kv = narrow ? 4 : 6;
        const kidS = (0.95 * k) / 46;
        const ang = (Math.atan2(SIN, COS) * 180) / Math.PI;
        /* world → screen for a point l metres down the slope */
        const onSlope = (s) => ({ x: sx(s * COS), y: sy(h - s * SIN) });
        const P = onSlope(l);
        const PG = onSlope(lGhost);
        const top = onSlope(0);
        const bot = onSlope(Lx);
        const slideW = Math.max(5, 0.13 * k);
        const nrm = { x: SIN, y: -COS }; // outward normal on screen (up-right)
        const dn = { x: COS, y: SIN }; // down the slope on screen
        const rot = (lx, ly) => ({ x: P.x + kidS * (COS * lx - SIN * ly), y: P.y + kidS * (SIN * lx + COS * ly) });
        const com = rot(2, -18);
        const feet = rot(31, -6);
        const moving = t > 0 && l < Lx - 1e-6;
        const rails = [-0.95, -0.5];
        const rungs = [];
        for (let yy = 0.35; yy < h - 0.05; yy += 0.35) rungs.push(yy);
        const wall = 0.24 * k;
        const hatch = [];
        for (let px = 0; px < W + 20; px += 10) hatch.push(<line key={px} x1={px} y1={sy(0) + 1} x2={px - 9} y2={sy(-0.32)} stroke="#cbd5e1" strokeWidth={1} />);
        const midL = onSlope(Lx * 0.3);
        const arcR = narrow ? 20 : 30;
        const showGhost = mu > 0 && t > 0;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Grid view={view} W={W} H={H} />
            {/* ground */}
            <rect x={0} y={sy(0)} width={W} height={sy(-0.32) - sy(0)} fill="#f1f5f9" />
            <g aria-hidden="true">{hatch}</g>
            <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="#475569" strokeWidth={1.6} />
            {/* ladder and platform */}
            {rails.map((rx) => (
              <line key={rx} x1={sx(rx)} x2={sx(rx)} y1={sy(0)} y2={sy(h + 0.9)} stroke="#64748b" strokeWidth={Math.max(2.5, 0.06 * k)} strokeLinecap="round" />
            ))}
            {rungs.map((yy) => (
              <line key={yy} x1={sx(rails[0])} x2={sx(rails[1])} y1={sy(yy)} y2={sy(yy)} stroke="#94a3b8" strokeWidth={Math.max(2, 0.04 * k)} />
            ))}
            <line x1={sx(-0.95)} x2={sx(0.05)} y1={sy(h)} y2={sy(h)} stroke="#475569" strokeWidth={Math.max(3, 0.08 * k)} strokeLinecap="round" />
            <line x1={sx(-0.95)} x2={sx(0)} y1={sy(h + 0.6)} y2={sy(h + 0.6)} stroke="#94a3b8" strokeWidth={Math.max(2, 0.04 * k)} />
            {/* supports */}
            <line x1={sx(0)} x2={sx(0)} y1={sy(0)} y2={sy(h)} stroke="#94a3b8" strokeWidth={Math.max(2.5, 0.06 * k)} />
            <line x1={sx(d / 2)} x2={sx(d / 2)} y1={sy(0)} y2={sy(h / 2)} stroke="#94a3b8" strokeWidth={Math.max(2.5, 0.06 * k)} />
            {/* the slide: side wall, then the running surface */}
            <line x1={top.x + nrm.x * wall} y1={top.y + nrm.y * wall} x2={bot.x + nrm.x * wall} y2={bot.y + nrm.y * wall} stroke="#fcd34d" strokeWidth={2} />
            {[0.2, 0.5, 0.8].map((f) => {
              const q = onSlope(Lx * f);
              return <line key={f} x1={q.x} y1={q.y} x2={q.x + nrm.x * wall} y2={q.y + nrm.y * wall} stroke="#fcd34d" strokeWidth={2} />;
            })}
            <line x1={top.x} y1={top.y + slideW / 2} x2={bot.x} y2={bot.y + slideW / 2} stroke="#b45309" strokeWidth={slideW} strokeLinecap="round" />
            <line x1={top.x} y1={top.y} x2={bot.x} y2={bot.y} stroke="#f59e0b" strokeWidth={slideW * 0.8} strokeLinecap="round" />
            <rect x={sx(d) + 4} y={sy(0) - Math.max(4, 0.12 * k)} width={Math.max(30, 1.1 * k)} height={Math.max(4, 0.12 * k)} rx={2} fill="#38bdf8" />
            {/* the warmed slide surface behind the child */}
            {mu > 0 && l > 0.001 && (
              <HeatTrail x1={top.x} y1={top.y - 1} x2={P.x - dn.x * 4} y2={P.y - dn.y * 4 - 1} level={Math.min(1, 0.1 + mu / 0.5)} width={narrow ? 3 : 4} spacing={narrow ? 24 : 32} />
            )}
            {/* dimensions: height h, base d, length L, angle α */}
            <Dim x1={sx(-1.7)} y1={sy(0)} x2={sx(-1.7)} y2={sy(h)} />
            <line x1={sx(-1.85)} x2={sx(-0.95)} y1={sy(h)} y2={sy(h)} stroke="#334155" strokeOpacity={0.5} strokeDasharray="3 3" />
            <Dim x1={sx(0)} y1={sy(-0.66)} x2={sx(d)} y2={sy(-0.66)} />
            <line x1={sx(d)} x2={sx(d)} y1={sy(0)} y2={sy(-0.8)} stroke="#334155" strokeOpacity={0.5} strokeDasharray="3 3" />
            <line x1={sx(0)} x2={sx(0)} y1={sy(0)} y2={sy(-0.8)} stroke="#334155" strokeOpacity={0.5} strokeDasharray="3 3" />
            <Pill x={sx(d / 2)} y={sy(-0.66)} text={L.dTag(trim(d, dec, 2))} bg="#334155" size={fsS} box={box} />
            <Pill x={midL.x - nrm.x * (slideW + (narrow ? 12 : 16))} y={midL.y - nrm.y * (slideW + (narrow ? 12 : 16))} text={L.LTag(trim(Lx, dec, 2))} bg="#b45309" size={fsS} box={box} />
            <path
              d={`M${bot.x - arcR},${bot.y} A${arcR},${arcR} 0 0 1 ${bot.x - arcR * COS},${bot.y - arcR * SIN}`}
              fill="none"
              stroke="#334155"
              strokeWidth={1.4}
            />
            <text x={bot.x - (arcR + 10) * 0.95} y={bot.y - (arcR + 10) * 0.32 + 4} textAnchor="middle" fontSize={fsS} fontStyle="italic" fontWeight="700" fill="#334155">
              α
            </text>
            {/* the child's height y (E_p = mgy) */}
            {t > 0 && y > 0.05 && (
              <g>
                <line x1={sx(-1.7)} x2={P.x} y1={P.y} y2={P.y} stroke={PALETTE.disp} strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="4 4" />
                <text x={P.x - 14} y={P.y + fsS + 5} textAnchor="end" fontSize={fsS} fontWeight="700" fill={PALETTE.disp} stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                  {L.yTag(round(y, 2, dec))}
                </text>
              </g>
            )}
            <Pill x={sx(-1.7)} y={sy(h / 2)} text={L.hTag(trim(h, dec, 2))} bg={PALETTE.disp} size={fsS} box={box} />
            {/* ghost: the same slide without friction */}
            {showGhost && <Kid x={PG.x} y={PG.y} ang={ang} s={kidS} ghost />}
            <Kid x={P.x} y={P.y} ang={ang} s={kidS} />
            {/* forces and velocity */}
            <VecArrow x={com.x} y={com.y} dx={0} dy={mg * kF} color={FORCE.mg} main="mg" fs={fs} place="left" />
            <VecArrow x={P.x} y={P.y} dx={nrm.x * N * kF} dy={nrm.y * N * kF} color={FORCE.N} main="N" fs={fs} place="right" />
            {moving && mu > 0 && <VecArrow x={P.x} y={P.y} dx={-dn.x * F * kF} dy={-dn.y * F * kF} color={FORCE.fr} main="F" sub={fr} fs={fs} place="left" />}
            {v > 0.01 && moving && <VecArrow x={feet.x} y={feet.y} dx={dn.x * v * kv} dy={dn.y * v * kv} color={PALETTE.vel} main="v" fs={fs} place="right" width={2.8} />}
            <AxisNumbers view={view} W={W} H={H} xUnit={L.axisX} yUnit={L.axisY} decimal={dec} />
          </>
        );
      }}
    </LabScene>
  );
}
