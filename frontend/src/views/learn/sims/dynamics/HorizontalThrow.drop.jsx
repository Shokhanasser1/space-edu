import { useState } from 'react';
import { Lightbulb, Split, CircleDot } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import {
  AxisX,
  AxisY,
  Ball,
  COL,
  Chip,
  FormulaTile,
  G,
  GroupLabel,
  Label,
  LabScene,
  PlayControls,
  Rich,
  SceneGrid,
  Soil,
  StrobeRing,
  Sym,
  VelScale,
  VelocityArrows,
  fitView,
  flightTime,
  len,
  niceMax,
  num,
  slowFactor,
  strobeStep,
  tickDigits,
  trim,
} from './HorizontalThrow.parts';

/**
 * "Tashlash va otish": from the same height and at the same moment one ball
 * is simply released (v₀ = 0) and one (or two, with v₀ and 2v₀) is thrown
 * horizontally. Stroboscope marks every Δt sit on common horizontal lines,
 * so at every moment all balls are at the same height y = h − gt²/2, and all
 * land together after t = √(2h/g), whatever v₀ is. Strings come from T.drop.
 */

const IDLE = { t: 0, running: false, done: false };

export default function DropSim({ T }) {
  const L = T.drop;
  const dec = T.decimal;
  const [h, setH] = useState(20);
  const [v0, setV0] = useState(10);
  const [two, setTwo] = useState(false);
  const [sim, setSim] = useState(IDLE);
  const tf = flightTime(h);
  const dt = strobeStep(tf);
  const slow = slowFactor(tf);

  useRafLoop(sim.running, (step) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tf, p.t + step * slow);
      const done = t >= tf - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = Math.min(sim.t, tf);
  const y = Math.max(0, h - 0.5 * G * t * t);
  const vy = G * t;
  const x1 = v0 * t;
  const F = (n, d = 1) => num(n, d, dec);
  const lenD = h < 3 ? 2 : 1;

  let key = 'idle';
  if (sim.done) key = two && v0 > 0 ? 'landed2' : 'landed';
  else if (t > 0 && v0 < 1e-9) key = 'zero';
  else if (t > 0 && !sim.running) key = 'paused';
  else if (t > 0) key = 'flying';
  const settled = useSettled(key, key === 'flying' ? 200 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    zero: ex.zero,
    flying: ex.flying,
    paused: ex.paused,
    landed: ex.landed(fmt(tf, 2, dec), num(v0 * tf, lenD, dec)),
    landed2: ex.landed2(fmt(tf, 2, dec), num(v0 * tf, lenD, dec), num(2 * v0 * tf, lenD, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', zero: '#f472b6', flying: '#a78bfa', paused: '#a78bfa', landed: '#34d399', landed2: '#34d399' }[settled];

  // y(t) of every ball: the same curve, drawn three times on purpose
  const pts = [];
  const n = 48;
  for (let i = 0; i <= n; i += 1) {
    const tt = (t * i) / n;
    pts.push({ x: tt, y: h - 0.5 * G * tt * tt });
  }
  const yMax = niceMax(h);
  const xMax = niceMax(tf);
  const series = [
    { id: 'drop', label: L.graph.drop, color: COL.y, points: pts },
    { id: 't1', label: L.graph.throw1, color: '#a78bfa', points: pts, dash: '7 6' },
  ];
  if (two) series.push({ id: 't2', label: L.graph.throw2, color: COL.thirdText, points: pts, dash: '2 6' });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.ballsLabel}</GroupLabel>
          <Segmented
            label={L.ballsLabel}
            className="grid-cols-2"
            size="lg"
            value={two ? 'two' : 'one'}
            onChange={(id) => {
              setTwo(id === 'two');
              setSim(IDLE);
            }}
            options={[
              { value: 'one', label: L.balls.one.name, sub: L.balls.one.sub, icon: CircleDot },
              { value: 'two', label: L.balls.two.name, sub: L.balls.two.sub, icon: Split },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <DropScene T={T} h={h} v0={v0} two={two} t={t} tf={tf} dt={dt} slow={slow} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(t, 2, dec)} unit={T.s} accent={COL.time} textColor="#a5f3fc" sub={L.tSub(fmt(tf, 2, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / tf) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.y} symbol="y" value={num(y, lenD, dec)} unit={T.m} accent={COL.x} textColor={COL.xText} sub={L.ySub} />
        <Readout label={L.readouts.drop} symbol="v" value={F(vy)} unit={T.ms} accent={COL.y} textColor={COL.yText} sub={<Rich>{L.dropSub(F(vy))}</Rich>} />
        <Readout
          label={L.readouts.throw}
          symbol="v"
          value={F(Math.hypot(v0, vy))}
          unit={T.ms}
          accent={COL.path}
          textColor={COL.pathText}
          sub={<Rich>{L.throwSub(num(x1, lenD, dec), F(vy))}</Rich>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="hd-h"
            label={L.h}
            symbol="h"
            min={2}
            max={45}
            step={1}
            value={h}
            onChange={(v) => {
              setH(v);
              setSim(IDLE);
            }}
            accent={COL.y}
            display={`${fmt(h, 0, dec)} ${T.m}`}
          />
          <RangeField
            id="hd-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={0}
            max={15}
            step={1}
            value={v0}
            onChange={(v) => {
              setV0(v);
              setSim(IDLE);
            }}
            accent={COL.path}
            display={`${fmt(v0, 0, dec)} ${T.ms}`}
            hint={T.common.kmh(fmt(v0 * 3.6, 0, dec))}
          />
          <FormulaTile tag={L.formula.tag} color="#a5f3fc" general="t = √(2h/g)" filled={`= √(2·${fmt(h, 0, dec)} / ${F(G)}) = ${fmt(tf, 2, dec)} ${T.s}`} ok={sim.done} />
          <p className="px-1 text-xs leading-snug text-gray-400">
            <Rich>{L.formula.note}</Rich>
          </p>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={xMax}
            yMax={yMax}
            xLabel={L.graph.t}
            yLabel={L.graph.y}
            marker={t}
            decimal={dec}
            xDigits={tickDigits(xMax)}
            yDigits={tickDigits(yMax)}
            note={L.graph.note}
            ariaLabel={L.graph.label}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function DropScene({ T, h, v0, two, t, tf, dt, slow, running }) {
  const L = T.drop;
  const dec = T.decimal;
  const vMax = two ? 2 * v0 : v0;
  const y = Math.max(0, h - 0.5 * G * t * t);
  const vy = G * t;
  const vyImp = G * tf;
  const landed = t >= tf - 1e-9;
  const N = Math.floor(tf / dt + 1e-9);
  const ticks = [];
  for (let k = 0; k <= N; k += 1) if (k * dt <= t + 1e-9) ticks.push({ k, tk: k * dt, y: h - 0.5 * G * (k * dt) ** 2 });
  const balls = [
    { id: 'drop', vx: 0, color: COL.y, dark: '#9d174d' },
    { id: 't1', vx: v0, color: COL.path, dark: '#4c1d95' },
  ];
  if (two) balls.push({ id: 't2', vx: 2 * v0, color: COL.third, dark: '#134e4a' });
  const chip = `${slow === 1 ? T.common.chipReal : T.common.chipSlow(trim(1 / slow, dec))} · t = ${fmt(t, 2, dec)} ${T.s}`;
  const legend = [
    { color: COL.y, label: L.legend.drop, kind: 'dot' },
    { color: COL.path, label: L.legend.throw1, kind: 'dot' },
  ];
  if (two) legend.push({ color: COL.third, label: L.legend.throw2, kind: 'dot' });
  legend.push({ color: '#64748b', label: L.legend.same, kind: 'dash' }, { color: COL.vel, label: L.legend.v, kind: 'arrow' });

  return (
    <LabScene legend={legend} chips={<Chip>{chip}</Chip>} height={(W, narrow) => (narrow ? 400 : 500)} ariaLabel={L.sceneLabel(fmt(t, 2, dec), len(y, dec))}>
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const r = narrow ? 7 : 9;
        const padT = narrow ? 64 : 96;
        const padB = narrow ? 60 : 78;
        const groundY = H - padB;
        const plotH = groundY - padT;
        const rulerW = narrow ? 30 : 40;
        const gap = 2 * r + 6; // the dropped ball hangs just left of the thrown one
        const standW = narrow ? 30 : 58;
        const X0 = rulerW + standW + gap;
        const padR = narrow ? 14 : 26;
        const vImp = Math.hypot(vMax, vyImp);
        const vk = Math.min((padB - 12) / Math.max(vyImp, 0.1), (0.24 * plotH) / Math.max(vImp, 0.1));
        const right = Math.max(X0 + 80, W - padR - vMax * vk - r - 40);
        const view = fitView({ xMin: 0, xMax: Math.max(vMax * tf, h * 0.3, 0.5), yMax: h, left: X0, right, top: padT, groundY });
        const step = niceStep(view.k, narrow ? 30 : 36);
        const by = (yy) => view.sy(yy) - r;
        const bxOf = (b, tt) => (b.id === 'drop' ? X0 - gap : view.sx(b.vx * tt));
        const topY = by(h);
        const poleX = X0 - gap - (narrow ? 20 : 40);
        const armY = topY - r - 12;
        const py = by(y);
        const box = { w: W, h: H };

        return (
          <>
            <rect width={W} height={H} fill={COL.paper} />
            <SceneGrid view={view} W={W} top={0} step={step} fromPx={rulerW + 2} />
            <Soil W={W} H={H} groundY={groundY} />
            <AxisY view={view} x={rulerW - 4} step={step} top={padT - 12} unit={L.axisY} decimal={dec} fs={fs - 1} />
            <AxisX view={view} W={W} y={H - 9} step={niceStep(view.k, narrow ? 46 : 60)} unit={L.axisX} decimal={dec} fs={fs - 1} />

            {/* lab stand with the release device */}
            <g aria-hidden="true">
              <rect x={poleX - 16} y={groundY - 6} width={32} height={6} rx={2} fill="#475569" />
              <rect x={poleX - 2.5} y={armY - 10} width={5} height={groundY - armY + 4} fill="#64748b" />
              <rect x={poleX} y={armY - 4} width={X0 + r + 6 - poleX} height={6} rx={2} fill="#64748b" />
              <rect x={X0 - gap - r - 3} y={armY + 2} width={gap + 2 * r + 6} height={5} rx={2} fill="#334155" />
              <line x1={X0 - gap} x2={X0 - gap} y1={topY} y2={groundY} stroke={COL.y} strokeOpacity={0.25} strokeDasharray="2 4" />
            </g>

            {/* common horizontal lines through the marks of each moment */}
            {ticks.map((m) => {
              const my = by(m.y);
              const far = Math.max(...balls.map((b) => bxOf(b, m.tk)));
              return (
                <g key={`l${m.k}`}>
                  <line x1={rulerW + 2} x2={far + r + 4} y1={my} y2={my} stroke="#64748b" strokeOpacity={0.55} strokeWidth={1.2} strokeDasharray="5 4" />
                  {m.k > 0 && <Label x={far + r + 8} y={my + 4} text={L.secTag(trim(m.tk, dec))} color={COL.muted} fs={fs - 1} anchor="start" />}
                </g>
              );
            })}

            {/* paths of the thrown balls */}
            {t > 0 &&
              balls
                .filter((b) => b.vx > 0)
                .map((b) => {
                  const pts = [];
                  for (let i = 0; i <= 60; i += 1) {
                    const tt = (t * i) / 60;
                    pts.push(`${bxOf(b, tt).toFixed(1)},${by(h - 0.5 * G * tt * tt).toFixed(1)}`);
                  }
                  return <polyline key={`p${b.id}`} points={pts.join(' ')} fill="none" stroke={b.color} strokeOpacity={0.75} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />;
                })}
            {t > 0 && <line x1={X0 - gap} x2={X0 - gap} y1={topY} y2={py} stroke={COL.y} strokeOpacity={0.75} strokeWidth={3} strokeLinecap="round" />}

            {/* stroboscope marks */}
            {ticks.map((m) =>
              balls.map((b) => <StrobeRing key={`s${m.k}${b.id}`} cx={bxOf(b, m.tk)} cy={by(m.y)} r={r} color={b.dark} opacity={0.5} />),
            )}

            {landed && (
              <Pill
                x={(X0 - gap + Math.max(...balls.map((b) => bxOf(b, tf)))) / 2}
                y={groundY - r * 2 - 22}
                text={`t = ${fmt(tf, 2, dec)} ${T.s}`}
                bg="#059669"
                size={fs}
                box={box}
              />
            )}

            {/* the balls with their velocities */}
            {balls.map((b) => {
              const bx = bxOf(b, t);
              return (
                <g key={b.id}>
                  {running && <circle cx={bx} cy={py} r={r + 6} fill={b.color} className="cl-pulse" opacity="0.28" />}
                  <Ball cx={bx} cy={py} r={r} color={b.color} stroke={b.dark} />
                </g>
              );
            })}
            {t > 0 && vy * vk > 6 && (
              <>
                <Arrow x1={X0 - gap} y1={py + r * 0.4} x2={X0 - gap} y2={py + vy * vk} color={COL.vel} width={3.25} head={11} />
                <Sym x={X0 - gap - 8} y={py + vy * vk} base="v" color={COL.vel} fs={fs + 1} anchor="end" />
              </>
            )}
            {balls
              .filter((b) => b.vx > 0)
              .map((b, i) => (
                <VelocityArrows key={`v${b.id}`} px={bxOf(b, t)} py={py} vx={b.vx} vy={vy} vk={vk} r={r} fs={fs} showComp={i === 0} labels={i === 0} />
              ))}

            <VelScale x={W - padR} y={narrow ? padT + 8 : padT - 28} vk={vk} label={(s) => T.common.vScale(fmt(s, 0, dec))} fs={fs - 1} />
          </>
        );
      }}
    </LabScene>
  );
}
