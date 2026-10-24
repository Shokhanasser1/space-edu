import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Hand, Lightbulb } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import { C, Chip, G, GroupLabel, Label, LabScene, PlayControls, Person, Vec, personGeometry } from './Weightlessness.parts';

/**
 * Tab 3 — a plastic bottle with a hole near the bottom. Held in the hand,
 * water presses on the walls (p = ρgh) and pours out at v = √(2gh). Thrown
 * up or simply let go, the bottle and the water move with the same
 * acceleration g: p = ρ(g − a)h = 0, the jet stops — on the way up as well
 * as on the way down. Caught again, it pours. Air resistance is neglected.
 */

const RHO = 1000; // kg/m³
const R_OUT = 0.035; // m, bottle radius (7 cm across)
const R_IN = 0.0305; // m — inner cross-section 29 cm² holds 0.5 L at 17 cm
const BODY_H = 0.2; // m
const HOLE_Y = 0.02; // m above the bottom
const HOLE_R = 0.002; // m (4 mm hole)
const H_PERSON = 1.7;
const SLOW = 0.2; // screen time runs 5× slower
const AFTER = 0.5; // s of pouring after the catch / landing
const HOLD_T = 1; // s for the "just hold it" case
const STOOL_Y = 0.6; // m, seat of the stool the dropped bottle lands on
const DT_EMIT = 0.005; // s between water parcels
const HAND_Q = personGeometry('hold').armF[2];
const HAND = { x: HAND_Q.x * H_PERSON, y: HAND_Q.y * H_PERSON };
const FEET_X = -HAND.x - R_OUT - 0.02; // the thrower stands so the palm touches the bottle
const B0 = { x: 0, y: HAND.y - 0.06 }; // bottom centre of the bottle in the hand

const MODES = [
  { id: 'hold', icon: Hand },
  { id: 'up', icon: ArrowUpFromLine },
  { id: 'drop', icon: ArrowDownToLine },
];

const jetSpeed = (gEff, h) => Math.sqrt(Math.max(0, 2 * gEff * h));
/** Mass of the water in the bottle for a level h above the hole (≈ 0.5 kg at 15 cm). */
const waterMass = (h) => RHO * Math.PI * R_IN * R_IN * (HOLE_Y + h);

/** Flight of the bottle: time in the air, landing height, and the position/velocity at time t. */
function flight(mode, v0) {
  if (mode === 'hold') return { T: 0, yEnd: B0.y };
  if (mode === 'up') return { T: (2 * v0) / G, yEnd: B0.y };
  return { T: Math.sqrt((2 * (B0.y - STOOL_Y)) / G), yEnd: STOOL_Y };
}
function bottleAt(mode, v0, t) {
  const f = flight(mode, v0);
  const u = mode === 'up' ? v0 : 0;
  if (mode === 'hold' || t <= 0) return { x: B0.x, y: B0.y, vy: 0, air: false };
  if (t >= f.T) return { x: B0.x, y: f.yEnd, vy: 0, air: false };
  return { x: B0.x, y: B0.y + u * t - 0.5 * G * t * t, vy: u - G * t, air: true };
}

/** The steady jet from a resting bottle, as water parcels (age τ since leaving the hole). */
function steadyJet(bx, by, h) {
  const v = jetSpeed(G, h);
  const hx = bx + R_OUT;
  const hy = by + HOLE_Y;
  const out = [];
  for (let tau = 0; ; tau += DT_EMIT) {
    const y = hy - 0.5 * G * tau * tau;
    if (y < 0) break;
    out.push({ x: hx + v * tau, y, vx: v, vy: -G * tau, seg: 0 });
  }
  return out.reverse(); // oldest first
}

const fresh = (h) => ({ t: 0, running: false, done: false, h, drops: steadyJet(B0.x, B0.y, h), splash: [], emitAcc: 0, samples: [{ x: 0, y: jetSpeed(G, h) }] });

export default function BottleSim({ T }) {
  const L = T.bottle;
  const dec = T.decimal;
  const [mode, setMode] = useState('up');
  const [v0, setV0] = useState(3);
  const [h0, setH0] = useState(0.15);
  const [sim, setSim] = useState(() => fresh(0.15));
  const f = flight(mode, v0);
  const tEnd = mode === 'hold' ? HOLD_T : f.T + AFTER;
  const started = sim.running || sim.t > 0;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const step = Math.min(dt * SLOW, tEnd - p.t);
      const t = p.t + step;
      const b = bottleAt(mode, v0, t);
      // move the water already in the air (exact free fall over the step)
      const moved = [];
      const splash = p.splash.filter((q) => t - q.t < 0.12);
      for (const d of p.drops) {
        const y = d.y + d.vy * step - 0.5 * G * step * step;
        if (y <= 0) {
          splash.push({ x: d.x + d.vx * step, t });
          continue;
        }
        moved.push({ ...d, x: d.x + d.vx * step, y, vy: d.vy - G * step });
      }
      // a resting bottle keeps pouring; a flying one does not
      let { h, emitAcc } = p;
      const seg = mode === 'hold' ? 0 : 1; // water poured after the catch is a new jet
      if (!b.air) {
        emitAcc += step;
        const v = jetSpeed(G, h);
        while (emitAcc >= DT_EMIT) {
          emitAcc -= DT_EMIT;
          const age = emitAcc;
          moved.push({ x: b.x + R_OUT + v * age, y: b.y + HOLE_Y - 0.5 * G * age * age, vx: v, vy: -G * age, seg });
        }
        // the level sinks as water leaves: A_bottle · dh = A_hole · v · dt
        h = Math.max(0, h - ((HOLE_R / R_IN) ** 2) * v * step);
      } else {
        emitAcc = 0;
      }
      const vj = b.air ? 0 : jetSpeed(G, h);
      const last = p.samples[p.samples.length - 1];
      const done = t >= tEnd - 1e-9;
      const samples =
        Math.abs(vj - last.y) > 1e-6 || t - last.x > tEnd / 120 || done ? [...p.samples, ...(Math.abs(vj - last.y) > 0.05 ? [{ x: t, y: last.y }] : []), { x: t, y: vj }] : p.samples;
      return { ...p, t, running: !done, done, h, drops: moved, splash, emitAcc, samples };
    });
  });

  const resetTo = (hh = h0) => setSim(fresh(hh));
  const toggle = () => {
    if (sim.done) setSim({ ...fresh(h0), running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };

  const b = bottleAt(mode, v0, sim.t);
  const air = b.air;
  const gEff = air ? 0 : G;
  const h = sim.h;
  const p = RHO * gEff * h;
  const vj = jetSpeed(gEff, h);
  const mw = waterMass(h);
  const Pw = mw * gEff;
  const F1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);

  let key = 'idle';
  if (sim.done) key = mode === 'hold' ? 'doneHold' : 'done';
  else if (started) {
    // decided by the flight clock, so the very first frame (t = 0) already counts as "thrown"
    if (mode === 'hold') key = 'hold';
    else if (sim.t < f.T) key = mode === 'up' && sim.t < v0 / G ? 'rising' : 'falling';
    else key = 'caught';
  }
  const settled = useSettled(key, 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(F2(jetSpeed(G, h0)), fmt(RHO * G * h0, 0, dec)),
    hold: ex.hold(F2(vj), fmt(p, 0, dec)),
    rising: ex.rising,
    falling: mode === 'drop' ? ex.dropping : ex.falling,
    caught: mode === 'drop' ? ex.landed : ex.caught,
    done: ex.done(F2(f.T)),
    doneHold: ex.doneHold,
  }[settled];
  const tone = { idle: '#22d3ee', hold: '#38bdf8', rising: '#f472b6', falling: '#f472b6', caught: '#38bdf8', done: '#34d399', doneHold: '#34d399' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.modesLabel}</GroupLabel>
          <Segmented
            label={L.modesLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={mode}
            onChange={(id) => {
              setMode(id);
              resetTo();
            }}
            accent="#38bdf8"
            options={MODES.map((m) => ({ value: m.id, label: L.modes[m.id].name, sub: m.id === 'up' ? L.modes.up.sub(F1(v0)) : L.modes[m.id].sub, icon: m.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={() => resetTo()} />
      </div>

      <BottleScene T={T} mode={mode} sim={sim} b={b} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.a} symbol="a" value={F1(air ? G : 0)} unit={T.ms2} accent={C.acc} textColor={C.accText} sub={air ? L.readouts.aAir : L.readouts.aHand} />
        <Readout label={L.readouts.P} symbol="P" value={F1(Pw)} unit={T.common.N} accent={C.P} textColor={C.PText} active={air} sub={L.readouts.Psub(F2(mw))} />
        <Readout label={L.readouts.p} symbol="p" value={fmt(p, 0, dec)} unit={T.common.Pa} accent="#0891b2" textColor="#67e8f9" sub={L.readouts.pSub(fmt(h * 100, 1, dec))} />
        <Readout label={L.readouts.v} symbol="v" value={F2(vj)} unit={T.ms} accent={C.water} textColor={C.waterText} active={!air && started} sub={air ? L.readouts.vAir : L.readouts.vHand} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wl-bottle-v0"
            label={L.v0Slider}
            symbol="v₀"
            min={1}
            max={4}
            step={0.5}
            value={v0}
            disabled={mode !== 'up'}
            onChange={(n) => {
              setV0(n);
              resetTo();
            }}
            accent={C.vel}
            display={`${F1(v0)} ${T.ms}`}
            hint={mode === 'up' ? L.v0Hint(F2((2 * v0) / G), F2((v0 * v0) / (2 * G))) : L.v0Off}
          />
          <RangeField
            id="wl-bottle-h"
            label={L.hSlider}
            symbol="h"
            min={5}
            max={15}
            step={1}
            value={Math.round(h0 * 100)}
            onChange={(n) => {
              setH0(n / 100);
              resetTo(n / 100);
            }}
            accent={C.water}
            display={`${fmt(h0 * 100, 0, dec)} ${T.common.cm}`}
            hint={L.hHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-relaxed">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.formulaTitle}</p>
            <p className="mt-1 tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">p = ρ(g − a)h</span> = {groupRho(dec)} · ({F1(G)} − {F1(air ? G : 0)}) · {F2(h)} ={' '}
              <b className="text-[#67e8f9]">{fmt(p, 0, dec)}</b> {T.common.Pa}
            </p>
            <p className="tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">v = √(2(g − a)h)</span> = <b style={{ color: C.waterText }}>{F2(vj)}</b> {T.ms}
            </p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[{ id: 'v', label: L.graph.v, color: '#38bdf8', points: sim.samples }]}
            fill={{ id: 'v', color: '#38bdf8', opacity: 0.18 }}
            xMax={Math.ceil(tEnd / 0.4 - 1e-9) * 0.4}
            yMax={2}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            marker={sim.t}
            xDigits={1}
            yDigits={1}
            decimal={dec}
            note={mode === 'hold' ? L.graph.noteHold : L.graph.note(F2(f.T))}
            ariaLabel={L.graph.label}
          />
        </div>
      </div>
    </div>
  );
}

function groupRho(dec) {
  return fmt(RHO, 0, dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* --------------------------------------------------------------- scene */

function BottleShape({ x, y, k, level, gEff, showHoleJet }) {
  // (x, y) = screen point of the bottom centre; k px per metre
  const w = R_OUT * k;
  const bodyH = BODY_H * k;
  const neck = 0.017 * k;
  const top = y - bodyH;
  const d = [
    `M${x - w},${y - 2}`,
    `Q${x - w},${y} ${x - w + 2},${y}`,
    `L${x + w - 2},${y}`,
    `Q${x + w},${y} ${x + w},${y - 2}`,
    `L${x + w},${top + w * 0.9}`,
    `Q${x + w},${top} ${x + neck},${top - w * 0.55}`,
    `L${x + neck},${top - w * 1.2}`,
    `L${x - neck},${top - w * 1.2}`,
    `L${x - neck},${top - w * 0.55}`,
    `Q${x - w},${top} ${x - w},${top + w * 0.9}`,
    'Z',
  ].join(' ');
  const wl = y - level * k;
  return (
    <g>
      <rect x={x - w + 1.5} y={wl} width={2 * w - 3} height={y - wl - 1.5} fill="#7dd3fc" opacity={0.85} />
      <line x1={x - w + 1.5} x2={x + w - 1.5} y1={wl} y2={wl} stroke="#0284c7" strokeWidth={1.2} />
      <path d={d} fill="#e0f2fe" fillOpacity={0.25} stroke="#0369a1" strokeWidth={1.4} />
      <rect x={x - neck - 1.5} y={top - w * 1.2 - Math.max(3, 0.012 * k)} width={2 * neck + 3} height={Math.max(3, 0.012 * k)} rx={1} fill="#2563eb" />
      <circle cx={x + w} cy={y - HOLE_Y * k} r={Math.max(1.6, HOLE_R * k * 1.4)} fill={gEff > 0 && showHoleJet ? '#0284c7' : '#0f172a'} />
    </g>
  );
}

function BottleScene({ T, mode, sim, b }) {
  const L = T.bottle;
  const dec = T.decimal;
  const air = b.air;
  const gEff = air ? 0 : G;
  const level = HOLE_Y + sim.h;
  const box = { x0: -0.95, x1: 1.45, y0: 0, y1: 2.35 };

  return (
    <LabScene
      legend={[
        { color: C.water, label: L.legend.jet, kind: 'line' },
        { color: '#0891b2', label: L.legend.p, kind: 'arrow' },
        { color: C.vel, label: L.legend.v, kind: 'arrow' },
        { color: C.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={
        <>
          <Chip>
            {L.slowChip} · t = {fmt(sim.t, 2, dec)} {T.s}
          </Chip>
          {air && (
            <Chip icon={ArrowDownToLine} color="#db2777" strong>
              {L.freeChip}
            </Chip>
          )}
        </>
      }
      height={(W, narrow) => (narrow ? Math.round(W * 0.95) + 210 : 470)}
      ariaLabel={L.sceneLabel(fmt(jetSpeed(gEff, sim.h), 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const top = narrow ? 46 : 58;
        const worldW = narrow ? W : Math.min(W * 0.5, 620);
        const worldH = narrow ? Math.round(W * 0.95) : H;
        const view = makeView(box, worldW, worldH, { l: 30, r: 12, t: top, b: 26 });
        const k = view.k;
        const bx = view.sx(b.x);
        const by = view.sy(b.y);
        const segs = {};
        for (const d of sim.drops) (segs[d.seg] ??= []).push(d);
        const handPerson = { x: view.sx(FEET_X), y: view.sy(0) };

        /* close-up of the bottle with the pressure arrows */
        const cu = narrow
          ? { x: 10, y: worldH + 4, w: W - 20, h: H - worldH - 14 }
          : { x: worldW + 18, y: top, w: W - worldW - 34, h: H - top - 18 };
        const kc = Math.min((cu.h - 70) / (BODY_H + 0.06), (cu.w * 0.36) / (2 * R_OUT));
        const cbx = cu.x + cu.w * (narrow ? 0.3 : 0.34);
        const cby = cu.y + cu.h - 26;
        const pScale = (narrow ? 26 : 40) / (RHO * G * 0.15); // px per pascal (max p ↔ 40 px)
        const wl = level;
        const arrows = [];
        if (gEff > 0) {
          // pressure on the walls grows with depth below the surface: p = ρ(g − a)·depth
          for (let i = 0; i < 5; i += 1) {
            const yy = (wl * (i + 0.5)) / 5; // height above the bottom
            const len = RHO * gEff * (wl - yy) * pScale;
            if (len < 3) continue;
            const sy = cby - yy * kc;
            arrows.push({ key: `L${i}`, x: cbx - R_IN * kc, y: sy, dx: -len });
            arrows.push({ key: `R${i}`, x: cbx + R_IN * kc, y: sy, dx: len });
          }
        }
        const pBottom = RHO * gEff * wl;
        const vjNow = jetSpeed(gEff, sim.h);

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <g>
              <Grid view={view} W={worldW} H={worldH} />
              <AxisNumbers view={view} W={worldW} H={worldH} xUnit={L.axisX} yUnit={L.axisY} decimal={dec} digits={1} minPx={narrow ? 70 : 90} />
            </g>
            {/* floor */}
            <rect x={0} y={view.sy(0)} width={worldW} height={4} fill="#57534e" />
            {/* stool for the "let go" case */}
            {mode === 'drop' && (
              <g>
                <rect x={view.sx(-0.06)} y={view.sy(STOOL_Y)} width={0.12 * k} height={0.035 * k} rx={2} fill="#a16207" />
                <line x1={view.sx(-0.04)} x2={view.sx(-0.1)} y1={view.sy(STOOL_Y - 0.03)} y2={view.sy(0)} stroke="#854d0e" strokeWidth={3} />
                <line x1={view.sx(0.0)} x2={view.sx(0.06)} y1={view.sy(STOOL_Y - 0.03)} y2={view.sy(0)} stroke="#854d0e" strokeWidth={3} />
              </g>
            )}
            {/* splashes on the floor */}
            {sim.splash.slice(-30).map((s, i) => (
              <ellipse key={`sp${i}`} cx={view.sx(s.x)} cy={view.sy(0) - 1} rx={5} ry={1.6} fill="#38bdf8" opacity={0.35} />
            ))}
            {/* the thrower */}
            <Person x={handPerson.x} y={handPerson.y} h={H_PERSON * k} pose="hold" shirt="#f59e0b" />
            {/* the flight path */}
            {mode === 'up' && sim.t > 0 && (
              <line x1={bx + 0.07 * k} x2={bx + 0.07 * k} y1={view.sy(B0.y)} y2={Math.min(by, view.sy(B0.y))} stroke="#7c3aed" strokeWidth={2} strokeDasharray="4 4" />
            )}
            {/* water in the air */}
            {Object.entries(segs).map(([s, ds]) =>
              ds.length > 1 ? (
                <polyline
                  key={`j${s}`}
                  points={ds.map((d) => `${view.sx(d.x).toFixed(1)},${view.sy(d.y).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke={C.water}
                  strokeWidth={narrow ? 2.2 : 2.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ) : (
                ds.map((d, i) => <circle key={`d${s}${i}`} cx={view.sx(d.x)} cy={view.sy(d.y)} r={1.8} fill={C.water} />)
              ),
            )}
            {/* the bottle */}
            <BottleShape x={bx} y={by} k={k} level={level} gEff={gEff} showHoleJet />
            {/* v and a on the bottle */}
            {air && Math.abs(b.vy) > 0.05 && (
              <Vec x={bx - 0.09 * k} y={by - 0.12 * k} dx={0} dy={-b.vy * (narrow ? 12 : 16)} color={C.vel} label="v" place="left" size={fs} width={3} head={10} />
            )}
            {air && (
              <Vec x={bx + 0.1 * k} y={by - 0.12 * k} dx={0} dy={G * (narrow ? 3.2 : 4.2)} color={C.acc} label={L.tags.a} place="right" size={fs} width={3} head={10} />
            )}
            {!air && sim.drops.length > 0 && !narrow && (
              <Label x={view.sx(B0.x + R_OUT) + 30} y={view.sy(b.y) + 4} anchor="start" size={fs - 1} color={C.water} weight={600}>
                {L.tags.jet(fmt(vjNow, 2, dec))}
              </Label>
            )}
            {air && (
              <Pill x={bx + 0.12 * k + 70} y={by - 0.3 * k} text={L.tags.noJet} bg="#db2777" size={fs - 1} box={{ w: worldW, h: worldH }} />
            )}

            {/* ================= close-up */}
            <rect x={cu.x} y={cu.y} width={cu.w} height={cu.h} rx={16} fill="#f8fafc" stroke="#cbd5e1" />
            <Label x={cu.x + 14} y={cu.y + 20} anchor="start" size={fs} color="#334155" halo="#f8fafc">
              {L.closeTag}
            </Label>
            <BottleShape x={cbx} y={cby} k={kc} level={level} gEff={gEff} showHoleJet={false} />
            {arrows.map((a) => (
              <g key={a.key}>
                <line x1={a.x} x2={a.x + a.dx - Math.sign(a.dx) * 6} y1={a.y} y2={a.y} stroke="#0891b2" strokeWidth={2.4} />
                <path d={`M${a.x + a.dx},${a.y} l${-Math.sign(a.dx) * 8},-4.5 l0,9 Z`} fill="#0891b2" />
              </g>
            ))}
            {gEff > 0 && pBottom * pScale > 3 && (
              <g>
                <line x1={cbx} x2={cbx} y1={cby} y2={cby + pBottom * pScale * 0.5 - 6} stroke="#0891b2" strokeWidth={2.4} />
                <path d={`M${cbx},${cby + pBottom * pScale * 0.5} l-4.5,-8 l9,0 Z`} fill="#0891b2" />
              </g>
            )}
            {/* a short jet stub from the hole */}
            {gEff > 0 && (
              <path
                d={`M${cbx + R_OUT * kc},${cby - HOLE_Y * kc} q${vjNow * 30},0 ${vjNow * 46},${18}`}
                fill="none"
                stroke={C.water}
                strokeWidth={3}
                strokeLinecap="round"
              />
            )}
            {(() => {
              const tx = cu.x + cu.w * (narrow ? 0.56 : 0.6);
              const lines = gEff > 0 ? L.close.on(fmt(RHO * G * sim.h, 0, dec), fmt(vjNow, 2, dec), fmt(waterMass(sim.h) * G, 1, dec)) : L.close.off;
              return lines.map((ln, i) => (
                <text key={i} x={tx} y={cu.y + (narrow ? 44 : 64) + i * (fs + 9)} fontSize={fs} fill={i === 0 ? '#0f172a' : '#475569'} fontWeight={i === 0 ? 700 : 400}>
                  {ln}
                </text>
              ));
            })()}
            <Label x={cbx} y={cby + 18} size={fs - 1} color={gEff > 0 ? '#0891b2' : '#be185d'} weight={600} halo="#f8fafc">
              {gEff > 0 ? L.close.pTag : L.close.zeroTag}
            </Label>
          </>
        );
      }}
    </LabScene>
  );
}
