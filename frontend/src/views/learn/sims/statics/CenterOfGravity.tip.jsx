import { useId, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Ban, Box, Bus, Landmark, Lightbulb, Package, Timer } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, groupThousands, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import {
  AngleArc,
  CC,
  CgMark,
  Chip,
  Eq,
  ForceArrow,
  FormulaPanel,
  G,
  Ground,
  GroupLabel,
  LabScene,
  Panel,
  PlayControls,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  deg,
  num,
  rad,
  svgPoint,
} from './CenterOfGravity.parts';

/**
 * Tab 3 — stability of a body on a support base. Tilted about the edge of
 * its base, a body falls back while the vertical through its centre of
 * gravity C still crosses the base, and tips over once that vertical passes
 * the edge. The critical tilt is
 *   tg α_c = (b/2) / h      (b — width of the base, h — height of C),
 * so a load on top (C higher) makes the body tip sooner and a load at the
 * bottom makes it steadier. Released, the body turns about the edge under
 * the moment of its weight (I about the edge from the body and load shapes),
 * rolling onto the next corner when it touches the ground.
 * Presets: crate 0.6 × 0.8 m → tg α_c = 0.30/0.40 = 0.75, α_c = 36.9°;
 * with 20 kg on top h = (20·0.40 + 20·0.90)/40 = 0.65 m → α_c = 24.8°;
 * bus (front view) base 2.0 m, h = 1.0 m → α_c = 45°; the Leaning Tower of
 * Pisa as a uniform 16 × 56 m block → α_c = 15.9° (it leans about 4°).
 */

const BODIES = {
  box: {
    b: 0.6,
    H: 0.8,
    M: 20, // kg
    h0: 0.4,
    Icm: (M) => (M * (0.6 ** 2 + 0.8 ** 2)) / 12,
    pts: [
      [0.3, 0],
      [-0.3, 0],
      [0.3, 0.8],
      [-0.3, 0.8],
    ],
    load: { unit: 1, max: 40, step: 5, w: 0.4, h: 0.2, top: 0.9, bottom: 0.1 },
    speed: 1,
    yMin: 0.2,
    yMax: 1,
    yDigits: 1,
    view: { x0: -0.55, x1: 1.45, y0: -0.12, y1: 1.18 },
  },
  bus: {
    b: 2.0,
    H: 3.0,
    M: 10000,
    h0: 1.0,
    Icm: (M) => (M * (2.5 ** 2 + 2.65 ** 2)) / 12,
    pts: [
      [1.0, 0],
      [-1.0, 0],
      [1.25, 0.35],
      [-1.25, 0.35],
      [1.25, 3.0],
      [-1.25, 3.0],
    ],
    load: { unit: 1000, max: 5, step: 0.5, w: 1.8, h: 0.5, top: 3.25, bottom: 0.65 },
    speed: 1,
    yMin: 0.5,
    yMax: 2.5,
    yDigits: 1,
    view: { x0: -2.1, x1: 5.0, y0: -0.4, y1: 4.2 },
  },
  tower: {
    b: 16,
    H: 56,
    M: 14.5e6,
    h0: 28,
    Icm: (M) => (M * (16 ** 2 + 56 ** 2)) / 12,
    pts: [
      [8, 0],
      [-8, 0],
      [8, 56],
      [-8, 56],
    ],
    load: null,
    speed: 4,
    yMin: 10,
    yMax: 30,
    yDigits: 0,
    view: { x0: -14, x1: 68, y0: -3, y1: 62 },
  },
};

const PRESETS = {
  box: { body: 'box', load: 'none', m: 20, tilt: 20, icon: Box },
  boxTop: { body: 'box', load: 'top', m: 20, tilt: 30, icon: Package },
  bus: { body: 'bus', load: 'none', m: 2.5, tilt: 40, icon: Bus },
  tower: { body: 'tower', load: 'none', m: 0, tilt: 4, icon: Landmark },
};

/** Body + load: masses, C, moment of inertia about C, contact points, critical angle. */
function config(bodyId, loadPos, mIn) {
  const B = BODIES[bodyId];
  const hasLoad = !!B.load && loadPos !== 'none' && mIn > 0;
  const m = hasLoad ? mIn * B.load.unit : 0;
  const hl = hasLoad ? B.load[loadPos] : 0;
  const Mt = B.M + m;
  const h = (B.M * B.h0 + m * hl) / Mt;
  let Icm = B.Icm(B.M) + B.M * (B.h0 - h) ** 2;
  if (hasLoad) Icm += (m * (B.load.w ** 2 + B.load.h ** 2)) / 12 + m * (hl - h) ** 2;
  const pts = [...B.pts];
  if (hasLoad && loadPos === 'top') {
    const top = hl + B.load.h / 2;
    pts.push([B.load.w / 2, top], [-B.load.w / 2, top]);
  }
  const ac = Math.atan(B.b / 2 / h);
  // the steepest hand-held tilt before another corner would dig into the ground
  let maxTilt = 60;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i][0] - B.b / 2;
    const bb = pts[i][1];
    if (a > 1e-9) maxTilt = Math.min(maxTilt, Math.floor(deg(Math.atan(bb / a))) - 1);
  }
  return { B, bodyId, hasLoad, loadPos: hasLoad ? loadPos : 'none', m, hl, Mt, h, Icm, pts, ac, maxTilt, c: [0, h] };
}

const held = (tilt, B) => ({ th: rad(tilt), om: 0, pi: 0, px: B.b / 2, running: false, done: null, started: false });

/** One step of the rigid body rocking on the ground about its contact corner. */
function stepTip(p, cfg, dt) {
  let { th, om, pi, px } = p;
  const { pts, c, Mt, Icm } = cfg;
  let rem = dt;
  while (rem > 1e-9) {
    const h = Math.min(1 / 1000, rem);
    rem -= h;
    const pv = pts[pi];
    const rx = c[0] - pv[0];
    const ry = c[1] - pv[1];
    const cs = Math.cos(th);
    const sn = Math.sin(th);
    const dx = rx * cs + ry * sn;
    om += ((Mt * G * dx) / (Icm + Mt * (rx * rx + ry * ry))) * h;
    th += om * h;
    const c2 = Math.cos(th);
    const s2 = Math.sin(th);
    let low = -1;
    let lowY = -1e-9;
    for (let j = 0; j < pts.length; j += 1) {
      if (j === pi) continue;
      const y = -(pts[j][0] - pv[0]) * s2 + (pts[j][1] - pv[1]) * c2;
      if (y < lowY) {
        lowY = y;
        low = j;
      }
    }
    if (low >= 0) {
      const a = pts[low][0] - pv[0];
      const b = pts[low][1] - pv[1];
      const nx = px + a * c2 + b * s2;
      const cx = px + rx * c2 + ry * s2;
      if ((cx - Math.min(px, nx)) * (cx - Math.max(px, nx)) <= 0) {
        // C is above the new face: the body settles on it
        const ths = Math.abs(a) < 1e-9 ? Math.PI / 2 : Math.atan(b / a);
        const back = ths < 0.01;
        return back ? { ...p, ...held(0, cfg.B), started: true, done: 'back' } : { ...p, th: ths, om: 0, pi, px, running: false, done: 'over' };
      }
      pi = low;
      px = nx;
      om *= 0.6;
    }
  }
  return { ...p, th, om, pi, px };
}

/** Pose → world: point q of the body (m) for the state p. */
function poseMap(p, cfg) {
  const pv = cfg.pts[p.pi];
  const cs = Math.cos(p.th);
  const sn = Math.sin(p.th);
  return ([x, y]) => {
    const a = x - pv[0];
    const b = y - pv[1];
    return [p.px + a * cs + b * sn, -a * sn + b * cs];
  };
}

export default function TipSim({ T }) {
  const L = T.tip;
  const dec = T.decimal;
  const [bodyId, setBodyId] = useState('box');
  const [loadPos, setLoadPos] = useState('none');
  const [mLoad, setMLoad] = useState(20);
  const [tilt, setTilt] = useState(20);
  const [sim, setSim] = useState(() => held(20, BODIES.box));

  const cfg = config(bodyId, loadPos, mLoad);
  const B = cfg.B;
  const preset =
    Object.keys(PRESETS).find((k) => {
      const p = PRESETS[k];
      return p.body === bodyId && p.load === loadPos && (p.load === 'none' || p.m === mLoad) && p.tilt === tilt;
    }) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? stepTip(p, cfg, dt * B.speed) : p));
  });

  const apply = (body, load, m, t) => {
    const c = config(body, load, m);
    const tt = clamp(t, 0, c.maxTilt);
    setBodyId(body);
    setLoadPos(load);
    setMLoad(m);
    setTilt(tt);
    setSim(held(tt, BODIES[body]));
  };
  const pick = (id) => {
    const p = PRESETS[id];
    apply(p.body, p.load, p.m, p.tilt);
  };
  const pickBody = (id) => {
    const keep = BODIES[id].load ? loadPos : 'none';
    const m = id === bodyId ? mLoad : id === 'bus' ? 2.5 : 20;
    apply(id, keep, m, id === 'tower' ? 4 : id === 'bus' ? 40 : 20);
  };
  const toggle = () => {
    if (sim.done || !sim.started) {
      const start = held(tilt, B);
      if (Math.abs(start.th - cfg.ac) < rad(0.3)) setSim({ ...start, started: true, done: 'edge' });
      else if (tilt === 0) setSim({ ...start, started: true, done: 'back' });
      else setSim({ ...start, started: true, running: true });
    } else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(held(tilt, B));

  /* ---- numbers */
  const unitL = bodyId === 'tower' ? 1 : 2;
  const FL = (n) => fmt(n, unitL, dec);
  const A1 = (n) => fmt(n, 1, dec);
  const thDeg = deg(sim.th);
  const tilted = sim.pi === 0;
  const margin = tilted && sim.done !== 'over' ? (B.b / 2) * Math.cos(sim.th) - cfg.h * Math.sin(sim.th) : null;
  const willTip = tilt > deg(cfg.ac) + 0.3;
  const edge = Math.abs(tilt - deg(cfg.ac)) <= 0.3;
  const bodyName = L.bodies[bodyId].name;

  /* ---- explanation */
  let key;
  if (sim.done === 'over') key = 'over';
  else if (sim.done === 'back') key = 'back';
  else if (sim.done === 'edge') key = 'edge';
  else if (sim.started) key = willTip ? 'tipping' : 'returning';
  else if (edge) key = 'heldEdge';
  else if (bodyId === 'tower' && !willTip) key = 'tower';
  else if (willTip) key = 'heldOver';
  else key = cfg.loadPos === 'top' ? 'heldTop' : cfg.loadPos === 'bottom' ? 'heldBottom' : 'held';
  const settled = useSettled(key, key.startsWith('held') ? 250 : 0);
  const ex = L.explain;
  const aTxt = A1(tilt);
  const acTxt = A1(deg(cfg.ac));
  const ac0 = A1(deg(Math.atan(B.b / 2 / B.h0)));
  const text = {
    held: ex.held(bodyName, aTxt, acTxt),
    heldTop: ex.heldTop(ac0, acTxt),
    heldBottom: ex.heldBottom(ac0, acTxt),
    heldOver: ex.heldOver(aTxt, acTxt),
    heldEdge: ex.heldEdge(acTxt),
    tower: ex.tower(aTxt, acTxt, FL(margin ?? 0)),
    returning: ex.returning,
    tipping: ex.tipping,
    back: ex.back(aTxt, acTxt),
    over: ex.over(aTxt, acTxt),
    edge: ex.edge,
  }[settled];
  const tone = {
    held: '#34d399',
    heldTop: '#fbbf24',
    heldBottom: '#34d399',
    heldOver: '#f87171',
    heldEdge: '#fbbf24',
    tower: '#34d399',
    returning: '#34d399',
    tipping: '#fb923c',
    back: '#34d399',
    over: '#f87171',
    edge: '#fbbf24',
  }[settled];

  const loadUnit = bodyId === 'bus' ? T.t : T.kg;
  const mText = (v) => `${fmt(v, Number.isInteger(v) ? 0 : 1, dec)} ${loadUnit}`;
  const status = sim.done ? L.state[sim.done] : sim.started ? L.state[willTip ? 'tipping' : 'returning'] : L.state[edge ? 'edge' : willTip ? 'willTip' : 'willReturn'];

  /* ---- graph: height of C against the tilt */
  const curve = (h) => {
    const pts = [];
    for (let a = 0; a <= 60; a += 1) pts.push({ x: a, y: (B.b / 2) * Math.sin(rad(a)) + h * Math.cos(rad(a)) });
    return pts;
  };
  const series = [{ id: 'cur', label: L.graph.cur, color: '#fbbf24', points: curve(cfg.h), dot: false }];
  if (cfg.hasLoad) series.push({ id: 'empty', label: L.graph.empty, color: '#94a3b8', points: curve(B.h0), dash: '5 5', dot: false });
  const acDeg = deg(cfg.ac);
  series.push({
    id: 'ac',
    label: L.graph.ac,
    color: '#f97316',
    points: [
      { x: acDeg, y: B.yMin },
      { x: acDeg, y: Math.hypot(B.b / 2, cfg.h) },
    ],
    dash: '3 4',
    dot: false,
  });
  if (tilted && thDeg <= 60) series.push({ id: 'now', label: L.graph.now, color: '#22d3ee', points: [{ x: thDeg, y: (B.b / 2) * Math.sin(sim.th) + cfg.h * Math.cos(sim.th) }] });

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={L.play} running={sim.running} done={!!sim.done} started={sim.started} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        renderScene={(fitH) => (
          <TipScene
            T={T}
            cfg={cfg}
            sim={sim}
            fitH={fitH}
            mText={mText}
            onTilt={(v) => {
              setTilt(v);
              setSim(held(v, B));
            }}
          />
        )}
        side={<TipFormula T={T} cfg={cfg} tilt={tilt} mText={mText} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.alpha} symbol="α" value={`${A1(thDeg)}°`} accent="#22d3ee" textColor="#a5f3fc" sub={status} active={sim.running} />
        <Readout
          label={L.readouts.alphaC}
          symbol={<Sym>{'α_{c}'}</Sym>}
          value={`${acTxt}°`}
          accent="#fbbf24"
          textColor="#fde68a"
          sub={L.acSub(FL(B.b / 2), FL(cfg.h), fmt(B.b / 2 / cfg.h, 3, dec))}
        />
        <Readout label={L.readouts.h} symbol="h" value={FL(cfg.h)} unit={T.m} accent={CC.cg} textColor="#e2e8f0" sub={cfg.hasLoad ? L.hSub(FL(B.h0)) : L.hSubNone} />
        <Readout
          label={L.readouts.margin}
          symbol="Δ"
          value={margin === null ? '—' : num(margin, unitL, dec)}
          unit={margin === null ? undefined : T.m}
          accent={margin === null ? '#64748b' : margin >= 0 ? CC.stable : CC.tip}
          textColor={margin === null ? '#94a3b8' : margin >= 0 ? CC.stableText : CC.tipText}
          sub={margin === null ? L.marginNone : margin >= 0 ? L.marginIn : L.marginOut}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <div>
            <GroupLabel>{L.bodyLabel}</GroupLabel>
            <Segmented
              label={L.bodyLabel}
              className="grid-cols-3"
              value={bodyId}
              onChange={pickBody}
              options={[
                { value: 'box', label: L.bodies.box.name, sub: L.bodies.box.sub, icon: Box },
                { value: 'bus', label: L.bodies.bus.name, sub: L.bodies.bus.sub, icon: Bus },
                { value: 'tower', label: L.bodies.tower.name, sub: L.bodies.tower.sub, icon: Landmark },
              ]}
            />
          </div>
          <div>
            <GroupLabel>{L.loadLabel}</GroupLabel>
            <Segmented
              label={L.loadLabel}
              className="grid-cols-3"
              value={B.load ? loadPos : 'none'}
              disabled={!B.load}
              onChange={(v) => apply(bodyId, v, mLoad, tilt)}
              options={[
                { value: 'none', label: L.loads.none, icon: Ban },
                { value: 'bottom', label: L.loads.bottom, icon: ArrowDownToLine },
                { value: 'top', label: L.loads.top, icon: ArrowUpToLine },
              ]}
            />
            {!B.load && <p className="mt-1.5 text-xs text-gray-500">{L.towerNoLoad}</p>}
          </div>
          {B.load && (
            <RangeField
              id="cog-mload"
              label={L.loadMass}
              symbol="m"
              min={B.load.step}
              max={B.load.max}
              step={B.load.step}
              value={mLoad}
              onChange={(v) => apply(bodyId, loadPos, v, tilt)}
              accent="#b45309"
              display={mText(mLoad)}
              hint={L.loadHint(mText(B.M / B.load.unit))}
              disabled={loadPos === 'none'}
            />
          )}
          <RangeField
            id="cog-tilt"
            label={L.tilt}
            symbol="α"
            min={0}
            max={cfg.maxTilt}
            step={0.5}
            value={tilt}
            onChange={(v) => apply(bodyId, loadPos, mLoad, v)}
            accent="#22d3ee"
            display={`${A1(tilt)}°`}
            hint={L.tiltHint}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={60}
            yMax={B.yMax}
            yMin={B.yMin}
            xLabel={L.graph.x}
            yLabel={L.graph.y(T.m)}
            marker={thDeg > 0.05 ? Math.min(60, thDeg) : undefined}
            decimal={dec}
            yDigits={B.yDigits}
            height={220}
            note={L.graph.note(acTxt)}
            ariaLabel={L.graph.aria}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

/** Decimals needed to print multiples of a grid step (0.25 → 2). */
function stepDigits(step) {
  if (step >= 1 - 1e-9) return 0;
  return Math.abs(step * 10 - Math.round(step * 10)) < 1e-9 ? 1 : 2;
}

function forceText(T, F, dec) {
  if (F >= 1e6) return `${fmt(F / 1e6, 0, dec)} ${T.MN}`;
  if (F >= 1e4) return `${fmt(F / 1e3, 0, dec)} ${T.kN}`;
  return `${fmt(F, 0, dec)} ${T.N}`;
}

function TipScene({ T, cfg, sim, fitH, mText, onTilt }) {
  const L = T.tip;
  const dec = T.decimal;
  const gid = useId().replace(/:/g, '');
  const drag = useRef(null);
  const B = cfg.B;
  const tilted = sim.pi === 0;
  const holdPose = !sim.started || sim.done === 'edge';

  return (
    <LabScene
      legend={[
        { color: CC.stable, label: L.legend.base, kind: 'line' },
        { color: CC.result, label: L.legend.mg, kind: 'arrow' },
        { color: CC.cg, label: L.legend.cg, kind: 'cg' },
        { color: '#475569', label: L.legend.vertical, kind: 'dash' },
        { color: '#94a3b8', label: L.legend.ghost, kind: 'dash' },
      ]}
      chips={<Chip icon={Timer}>{B.speed > 1 ? L.chipFast(B.speed) : L.chipReal}</Chip>}
      height={(W, narrow) => fitH ?? (narrow ? 340 : 452)}
      ariaLabel={L.sceneLabel(L.bodies[cfg.bodyId].name, fmt(deg(sim.th), 1, dec), fmt(deg(cfg.ac), 1, dec))}
    >
      {(W, H, narrow) => {
        const view = makeView(B.view, W, H, narrow ? { l: 26, r: 12, t: 56, b: 26 } : { l: 34, r: 20, t: 84, b: 30 });
        const k = view.k;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const map = poseMap(sim, cfg);
        const S = (q) => {
          const [x, y] = map(q);
          return [view.sx(x), view.sy(y)];
        };
        const pv = cfg.pts[sim.pi];
        const P = [view.sx(sim.px), view.sy(0)];
        const C = S(cfg.c);
        const inside = tilted ? (B.b / 2) * Math.cos(sim.th) - cfg.h * Math.sin(sim.th) >= -1e-9 : sim.done !== 'over';
        const baseCol = inside ? CC.stable : CC.tip;
        const groundY = view.sy(0);
        const Fg = cfg.Mt * G;
        const fLen = narrow ? 50 : 72;

        /* body drawn in its own frame, turned about the contact corner */
        const lx = (x) => (x - pv[0]) * k;
        const ly = (y) => -(y - pv[1]) * k;
        const bodyTf = `translate(${P[0].toFixed(1)} ${P[1].toFixed(1)}) rotate(${deg(sim.th).toFixed(3)})`;

        /* the ghost at the critical angle, about the base edge */
        const gTf = `translate(${view.sx(B.b / 2).toFixed(1)} ${groundY.toFixed(1)}) rotate(${deg(cfg.ac).toFixed(3)})`;
        const glx = (x) => (x - B.b / 2) * k;
        const gly = (y) => -y * k;
        const gC = [view.sx(B.b / 2), groundY - Math.hypot(B.b / 2, cfg.h) * k];

        /* tilt by dragging the body */
        const onDown = (e) => {
          if (sim.running) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // the pointer is already gone: dragging still works without capture
          }
          const q = svgPoint(e, e.currentTarget);
          drag.current = { a0: Math.atan2(-(q.y - groundY), q.x - view.sx(B.b / 2)), t0: deg(sim.pi === 0 ? sim.th : 0) };
        };
        const onMove = (e) => {
          if (!drag.current) return;
          const q = svgPoint(e, e.currentTarget);
          const a = Math.atan2(-(q.y - groundY), q.x - view.sx(B.b / 2));
          const t = clamp(Math.round((drag.current.t0 + deg(drag.current.a0 - a)) * 2) / 2, 0, cfg.maxTilt);
          onTilt(t);
        };
        const onUp = () => {
          drag.current = null;
        };

        /* base and its shadow on the ground */
        const bl = S([-B.b / 2, 0]);
        const br = S([B.b / 2, 0]);

        const load = cfg.hasLoad ? { y: cfg.hl, w: B.load.w, h: B.load.h } : null;
        const Cb = S([0, B.h0]);
        const Cl = cfg.hasLoad ? S([0, cfg.hl]) : null;

        return (
          <g>
            <Grid view={view} W={W} H={H} />
            <AxisNumbers view={view} W={W} H={H} xUnit={T.m} decimal={dec} digits={stepDigits(niceStep(k, 60))} />
            <Ground W={W} y={groundY} depth={Math.max(10, H - groundY)} />

            {/* shadow of the base on the ground */}
            {tilted && sim.done !== 'over' && (
              <rect x={Math.min(bl[0], br[0])} y={groundY} width={Math.abs(br[0] - bl[0])} height={7} fill={baseCol} opacity="0.28" />
            )}

            {/* the body */}
            <g transform={bodyTf} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ cursor: sim.running ? 'default' : 'grab', touchAction: 'none' }}>
              <BodyArt B={B} cfg={cfg} lx={lx} ly={ly} k={k} gid={gid} load={load} mText={mText} fs={fs} T={T} />
              <line x1={lx(-B.b / 2)} y1={ly(0)} x2={lx(B.b / 2)} y2={ly(0)} stroke={baseCol} strokeWidth={narrow ? 4 : 5} strokeLinecap="round" />
            </g>

            {/* the ghost outline at the critical tilt */}
            {holdPose && tilted && (
              <g opacity="0.75" pointerEvents="none">
                <g transform={gTf}>
                  <BodyOutline B={B} cfg={cfg} lx={glx} ly={gly} />
                </g>
                <line x1={gC[0]} y1={groundY} x2={gC[0]} y2={gC[1]} stroke="#94a3b8" strokeWidth="1.3" strokeDasharray="2 4" />
                <CgMark x={gC[0]} y={gC[1]} r={narrow ? 4 : 5} color="#94a3b8" />
                <SvgSym
                  x={C[0] > gC[0] ? gC[0] - 8 : gC[0] + 8}
                  y={(groundY + gC[1]) / 2}
                  text="α_{c}"
                  value={`${fmt(deg(cfg.ac), 1, dec)}°`}
                  color="#64748b"
                  fs={fs - 1}
                  anchor={C[0] > gC[0] ? 'end' : 'start'}
                />
              </g>
            )}

            {/* angle of tilt at the edge */}
            {tilted && sim.th > rad(1) && (
              <AngleArc cx={P[0]} cy={P[1]} r={narrow ? 26 : 36} from={Math.PI} to={Math.PI + sim.th} label={`α = ${fmt(deg(sim.th), 1, dec)}°`} color="#0e7490" fs={fs - 1} labelR={narrow ? 58 : 84} />
            )}

            {/* the vertical through C and the weight */}
            <line x1={C[0]} y1={C[1]} x2={C[0]} y2={groundY} stroke="#475569" strokeWidth="1.4" strokeDasharray="5 4" />
            <circle cx={C[0]} cy={groundY} r={4.5} fill={baseCol} stroke="#fff" strokeWidth="1.5" />
            {Cl && (
              <g pointerEvents="none">
                <line x1={Cb[0]} y1={Cb[1]} x2={Cl[0]} y2={Cl[1]} stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" />
                <CgMark x={Cb[0]} y={Cb[1]} r={4} color="#64748b" />
                <CgMark x={Cl[0]} y={Cl[1]} r={4} color="#b45309" />
              </g>
            )}
            <ForceArrow
              x={C[0]}
              y={C[1]}
              dx={0}
              dy={fLen}
              color={CC.result}
              width={narrow ? 3 : 3.6}
              head={narrow ? 10 : 12}
              label={cfg.hasLoad ? '(M+m)g' : 'Mg'}
              value={forceText(T, Fg, dec)}
              fs={fs}
              box={box}
              labelAt={{ x: C[0] + 9, y: C[1] + fLen * 0.62, anchor: 'start' }}
            />
            <CgMark x={C[0]} y={C[1]} r={narrow ? 6 : 7.5} />
            <SvgSym x={C[0] - 10} y={C[1] - 9} text="C" color={CC.cg} fs={fs + 1} anchor="end" />
          </g>
        );
      }}
    </LabScene>
  );
}

/** A dashed outline of the body (for the ghost at the critical angle). */
function BodyOutline({ B, cfg, lx, ly }) {
  const r = (x0, y0, x1, y1) => (
    <rect x={lx(x0)} y={ly(y1)} width={lx(x1) - lx(x0)} height={ly(y0) - ly(y1)} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="5 4" />
  );
  return (
    <g>
      {cfg.bodyId === 'bus' ? (
        <>
          {r(-1.25, 0.35, 1.25, 3.0)}
          {r(0.68, 0, 1.0, 0.35)}
          {r(-1.0, 0, -0.68, 0.35)}
        </>
      ) : (
        r(-B.b / 2, 0, B.b / 2, B.H)
      )}
      {cfg.hasLoad && cfg.loadPos === 'top' && r(-B.load.w / 2, cfg.hl - B.load.h / 2, B.load.w / 2, cfg.hl + B.load.h / 2)}
    </g>
  );
}

/** The crate, the bus (front view) or the Leaning Tower, with the load. */
function BodyArt({ B, cfg, lx, ly, k, gid, load, mText, fs, T }) {
  const rect = (x0, y0, x1, y1, props) => <rect x={lx(x0)} y={ly(y1)} width={lx(x1) - lx(x0)} height={ly(y0) - ly(y1)} {...props} />;
  const loadBox =
    load &&
    (cfg.loadPos === 'top' ? (
      <g>
        {rect(-load.w / 2, load.y - load.h / 2, load.w / 2, load.y + load.h / 2, { fill: '#92400e', stroke: '#451a03', strokeWidth: 1.3, rx: 3 })}
        {rect(-load.w / 2 + load.w * 0.18, load.y - load.h / 2, -load.w / 2 + load.w * 0.26, load.y + load.h / 2, { fill: '#451a03', opacity: 0.45 })}
        {rect(load.w / 2 - load.w * 0.26, load.y - load.h / 2, load.w / 2 - load.w * 0.18, load.y + load.h / 2, { fill: '#451a03', opacity: 0.45 })}
        {load.h * k > 13 && (
          <text x={lx(load.w * 0.22)} y={ly(load.y + load.h * 0.18)} textAnchor="middle" fontSize={Math.min(fs, load.h * k * 0.42)} fontWeight="700" fill="#fff7ed">
            {mText(cfg.m / B.load.unit)}
          </text>
        )}
      </g>
    ) : (
      <g>
        {rect(-load.w / 2, load.y - load.h / 2, load.w / 2, load.y + load.h / 2, { fill: '#92400e', fillOpacity: 0.35, stroke: '#78350f', strokeWidth: 1.3, strokeDasharray: '4 3', rx: 3 })}
        {load.h * k > 13 && (
          <text x={lx(load.w * 0.22)} y={ly(load.y + load.h * 0.18)} textAnchor="middle" fontSize={Math.min(fs, load.h * k * 0.42)} fontWeight="700" fill="#78350f">
            {mText(cfg.m / B.load.unit)}
          </text>
        )}
      </g>
    ));

  if (cfg.bodyId === 'box') {
    return (
      <g>
        {rect(-0.3, 0, 0.3, 0.8, { fill: '#f0cf96', stroke: '#9a6b2f', strokeWidth: 1.6, rx: 2 })}
        {[0.2667, 0.5333].map((y) => (
          <line key={y} x1={lx(-0.3)} x2={lx(0.3)} y1={ly(y)} y2={ly(y)} stroke="#b98a4b" strokeWidth="1.2" />
        ))}
        {rect(-0.3, 0, -0.25, 0.8, { fill: '#c99a5b', opacity: 0.6 })}
        {rect(0.25, 0, 0.3, 0.8, { fill: '#c99a5b', opacity: 0.6 })}
        <text x={lx(0)} y={ly(0.11)} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#7c4a12">
          {`${fmt(B.M, 0)} ${T.kg}`}
        </text>
        {loadBox}
      </g>
    );
  }

  if (cfg.bodyId === 'bus') {
    return (
      <g>
        {rect(0.68, 0, 1.0, 0.9, { fill: '#1f2937', rx: 4 })}
        {rect(-1.0, 0, -0.68, 0.9, { fill: '#1f2937', rx: 4 })}
        {rect(-1.25, 0.35, 1.25, 3.0, { fill: '#facc15', stroke: '#a16207', strokeWidth: 1.6, rx: 0.22 * k })}
        {rect(-1.05, 1.55, 1.05, 2.72, { fill: '#bae6fd', stroke: '#0f172a', strokeWidth: 1.2, rx: 0.08 * k })}
        <line x1={lx(0)} x2={lx(0)} y1={ly(1.55)} y2={ly(2.72)} stroke="#0f172a" strokeWidth="1.2" />
        {rect(-0.7, 2.77, 0.7, 2.94, { fill: '#0f172a', rx: 2 })}
        <text x={lx(0)} y={ly(2.855) + Math.min(4, 0.06 * k)} textAnchor="middle" fontSize={Math.max(7, Math.min(fs - 1, 0.13 * k))} fontWeight="700" fill="#fbbf24">
          {`${fmt(B.M / 1000, 0)} ${T.t}`}
        </text>
        {rect(-0.55, 0.62, 0.55, 1.0, { fill: '#334155', rx: 2 })}
        <circle cx={lx(-0.88)} cy={ly(0.82)} r={0.13 * k} fill="#fff" stroke="#64748b" />
        <circle cx={lx(0.88)} cy={ly(0.82)} r={0.13 * k} fill="#fff" stroke="#64748b" />
        {rect(-1.25, 0.35, 1.25, 0.5, { fill: '#475569', rx: 2 })}
        {rect(-1.42, 2.05, -1.28, 2.45, { fill: '#0f172a', rx: 2 })}
        {rect(1.28, 2.05, 1.42, 2.45, { fill: '#0f172a', rx: 2 })}
        {loadBox}
      </g>
    );
  }

  /* the Leaning Tower of Pisa: a cylinder of arcades with a belfry */
  const floors = [];
  const storeys = [11, 17.4, 23.8, 30.2, 36.6, 43];
  storeys.forEach((y0, i) => {
    const y1 = i < storeys.length - 1 ? storeys[i + 1] : 47.4;
    floors.push(<line key={`f${i}`} x1={lx(-8)} x2={lx(8)} y1={ly(y0)} y2={ly(y0)} stroke="#a8a29e" strokeWidth="1.4" />);
    for (let j = 0; j < 6; j += 1) {
      const x0 = -8 + 0.45 + j * (15.1 / 6);
      const w = 15.1 / 6 - 0.9;
      const top = y1 - 1.2;
      floors.push(
        <path
          key={`a${i}-${j}`}
          d={`M${lx(x0)},${ly(y0 + 0.4)} V${ly(top - w / 2)} A${(w / 2) * k},${(w / 2) * k} 0 0 1 ${lx(x0 + w)},${ly(top - w / 2)} V${ly(y0 + 0.4)}`}
          fill="#d6cfbd"
          stroke="#a8a29e"
          strokeWidth="0.8"
        />,
      );
    }
  });
  return (
    <g>
      <defs>
        <linearGradient id={`${gid}-marble`} x1="0" x2="1">
          <stop offset="0" stopColor="#e7e1d1" />
          <stop offset="0.5" stopColor="#faf7ef" />
          <stop offset="1" stopColor="#d9d2bf" />
        </linearGradient>
      </defs>
      {rect(-8, 0, 8, 47.4, { fill: `url(#${gid}-marble)`, stroke: '#a8a29e', strokeWidth: 1.4 })}
      {rect(-6, 47.4, 6, 56, { fill: `url(#${gid}-marble)`, stroke: '#a8a29e', strokeWidth: 1.4 })}
      {[0, 1, 2, 3, 4].map((j) => {
        const x0 = -6 + 0.6 + j * 2.36;
        const w = 1.3;
        return (
          <path
            key={`b${j}`}
            d={`M${lx(x0)},${ly(48.2)} V${ly(54.4 - w / 2)} A${(w / 2) * k},${(w / 2) * k} 0 0 1 ${lx(x0 + w)},${ly(54.4 - w / 2)} V${ly(48.2)}`}
            fill="#57534e"
            opacity="0.55"
          />
        );
      })}
      {[2.5, 5, 7.5, 10].map((y) => (
        <line key={`s${y}`} x1={lx(-8)} x2={lx(8)} y1={ly(y)} y2={ly(y)} stroke="#d6d3d1" strokeWidth="0.8" />
      ))}
      {floors}
      {rect(-1.4, 0, 1.4, 5, { fill: '#78716c', rx: 0.6 * k })}
    </g>
  );
}

/* =============================================================== formulas */

function TipFormula({ T, cfg, tilt, mText }) {
  const L = T.tip;
  const f = L.formula;
  const dec = T.decimal;
  const B = cfg.B;
  const d = cfg.bodyId === 'tower' ? 1 : 2;
  const FL = (n) => fmt(n, d, dec);
  const A1 = (n) => fmt(n, 1, dec);
  const acD = deg(cfg.ac);
  const tips = tilt > acD + 0.3;
  const edge = Math.abs(tilt - acD) <= 0.3;
  const Mt = (v) => (B.load ? mText(v / B.load.unit) : `${groupThousands(v / 1000)} ${T.t}`);
  return (
    <FormulaPanel badge={f.badge} title={f.title}>
      <Step n={1} title={f.s1}>
        <p className="tabular-nums text-gray-300">
          <Sym>{f.base(FL(B.b), FL(B.b / 2))}</Sym>
        </p>
        <p className="tabular-nums text-gray-300">
          <Sym>{f.h0(FL(B.h0), Mt(B.M))}</Sym>
        </p>
      </Step>
      <Step n={2} title={f.s2}>
        {cfg.hasLoad ? (
          <>
            <Eq sym="h = (M·h_{0} + m·h_{y}) / (M + m)" />
            <Eq
              nums={`= (${Mt(B.M).split(' ')[0]}·${FL(B.h0)} + ${Mt(cfg.m).split(' ')[0]}·${FL(cfg.hl)}) / (${Mt(B.M).split(' ')[0]} + ${Mt(cfg.m).split(' ')[0]}) =`}
              result={`${FL(cfg.h)} ${T.m}`}
            />
            <p className="mt-1 text-xs text-gray-500">{cfg.loadPos === 'top' ? f.upNote : f.downNote}</p>
          </>
        ) : (
          <p className="text-gray-400">
            <Sym>{f.noLoad(FL(cfg.h))}</Sym>
          </p>
        )}
      </Step>
      <Step n={3} title={f.s3}>
        <Eq sym={f.tanSym} nums={`= ${FL(B.b / 2)} / ${FL(cfg.h)} = ${fmt(B.b / 2 / cfg.h, 3, dec)}`} />
        <Eq nums="α_{c} =" result={`${A1(acD)}°`} />
      </Step>
      <Step n={4} title={f.s4} done={!tips}>
        <p className={edge ? 'text-amber-300' : tips ? 'text-rose-300' : 'text-emerald-300'}>
          <Sym>{edge ? f.edge(A1(tilt), A1(acD)) : tips ? f.tips(A1(tilt), A1(acD)) : f.stays(A1(tilt), A1(acD))}</Sym>
        </p>
        <p className="mt-1 text-xs text-gray-500">{f.rule}</p>
      </Step>
    </FormulaPanel>
  );
}
