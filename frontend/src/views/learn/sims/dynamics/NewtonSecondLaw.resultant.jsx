import { useRef, useState } from 'react';
import { ArrowLeftRight, ArrowRight, CornerUpRight, Lightbulb, Plus, Scale, Triangle, Video, X } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, textWidth, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { COL, Chip, GroupLabel, LabScene, PlayControls, Rich, ScaleChip, trim } from './NewtonSecondLaw.parts';

/**
 * Tab 3 of "Newton's second law": several forces on a crate on smooth ice,
 * seen from above. The forces add as vectors (parallelogram for two, the
 * polygon rule for any number); the crate accelerates along the resultant,
 * a = F / m, and from rest moves in a straight line along it. Balanced forces
 * (F = 0) leave it at rest. The camera follows the crate so the force arrows
 * always stay in view; the ice grid and the start mark slide away.
 * Presets (m = 10 kg): 30 + 20 → 50 N, a = 5 m/s²; 30 − 20 → 10 N, a = 1;
 * 40 ⊥ 30 → 50 N, a = 5; 30 against 30 → 0; three 30 N forces 120° apart → 0.
 */

const T_RUN = 3; // s, real time
const F_MAX = 50; // N per force
const PRESETS = {
  same: { forces: [{ F: 30, ang: 0 }, { F: 20, ang: 0 }, { F: 0, ang: 180 }], third: false, icon: ArrowRight },
  opposite: { forces: [{ F: 30, ang: 0 }, { F: 20, ang: 180 }, { F: 0, ang: 90 }], third: false, icon: ArrowLeftRight },
  right: { forces: [{ F: 40, ang: 0 }, { F: 30, ang: 90 }, { F: 0, ang: 180 }], third: false, icon: CornerUpRight },
  tug: { forces: [{ F: 30, ang: 0 }, { F: 30, ang: 180 }, { F: 0, ang: 90 }], third: false, icon: Scale },
  three: { forces: [{ F: 30, ang: 90 }, { F: 30, ang: 210 }, { F: 30, ang: 330 }], third: true, icon: Triangle },
};
const FORCE_COL = [COL.f1, COL.f2, COL.f3];
const FORCE_TEXT = [COL.f1Text, COL.f2Text, COL.f3Text];
const SYM = ['F₁', 'F₂', 'F₃'];
const IDLE = { t: 0, running: false, done: false };
const RAD = Math.PI / 180;

/** Normalises an angle to [0, 360). */
const norm = (deg) => ((deg % 360) + 360) % 360;
/** The smaller angle between two directions, 0…180°. */
const between = (p, q) => {
  const d = Math.abs(norm(p) - norm(q));
  return d > 180 ? 360 - d : d;
};

function sumForces(list) {
  let fx = 0;
  let fy = 0;
  for (const f of list) {
    fx += f.F * Math.cos(f.ang * RAD);
    fy += f.F * Math.sin(f.ang * RAD);
  }
  if (Math.abs(fx) < 1e-9) fx = 0;
  if (Math.abs(fy) < 1e-9) fy = 0;
  const F = Math.hypot(fx, fy);
  return { fx, fy, F: F < 1e-6 ? 0 : F, ang: F < 1e-6 ? 0 : norm(Math.atan2(fy, fx) / RAD) };
}

export default function ResultantSim({ T }) {
  const L = T.res;
  const dec = T.decimal;
  const [forces, setForces] = useState(PRESETS.right.forces);
  const [third, setThird] = useState(false);
  const [m, setM] = useState(10);
  const [sim, setSim] = useState(IDLE);
  const [dragK, setDragK] = useState(null);

  const active = forces.map((f, i) => ({ ...f, i })).filter((f) => (f.i < 2 || third) && f.F > 0);
  const res = sumForces(active);
  const a = res.F / m;
  const balanced = res.F === 0 && active.length > 0;
  const preset =
    Object.keys(PRESETS).find((k) => {
      const p = PRESETS[k];
      if (p.third !== third) return false;
      return p.forces.every((f, i) => (i === 2 && !third) || (f.F === forces[i].F && (f.F === 0 || f.ang === forces[i].ang)));
    }) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(T_RUN, p.t + dt);
      const done = t >= T_RUN - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setForces(PRESETS[id].forces.map((f) => ({ ...f })));
    setThird(PRESETS[id].third);
    setSim(IDLE);
  };
  const setForce = (i, patch) => {
    setForces((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    setSim(IDLE);
  };
  const toggleThird = () => {
    if (!third && forces[2].F === 0) setForces((list) => list.map((f, j) => (j === 2 ? { F: 20, ang: 225 } : f)));
    setThird((v) => !v);
    setSim(IDLE);
  };

  const t = sim.t;
  const v = a * t;
  const x = 0.5 * a * t * t;
  const D = (n) => trim(n, dec, 1);
  const deg = (n) => trim(n, dec, 1);

  /* ---- explanation */
  const collinear = active.every((f) => between(f.ang, res.ang) < 1 || between(f.ang, res.ang) > 179);
  let key = 'idle';
  if (balanced || active.length === 0) key = t > 0 ? 'balancedRun' : 'balanced';
  else if (sim.done) key = 'done';
  else if (t > 0) key = collinear ? 'runAlong' : 'runMixed';
  const settled = useSettled(key, key === 'idle' || key === 'balanced' || key === 'done' ? 0 : 200);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    balanced: ex.balanced,
    balancedRun: ex.balancedRun,
    runAlong: ex.runAlong(D(res.F), D(m), trim(a, dec, 2)),
    runMixed: ex.runMixed(D(res.F), D(m), trim(a, dec, 2)),
    done: ex.done(fmt(T_RUN, 0, dec), fmt(a * T_RUN, 1, dec), fmt(0.5 * a * T_RUN * T_RUN, 1, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', balanced: '#34d399', balancedRun: '#34d399', runAlong: '#fb923c', runMixed: '#fb923c', done: '#34d399' }[settled];

  /* ---- how the resultant was found */
  const F = (n) => trim(n, dec, 1);
  let formula = L.formulas.none;
  let filled = 'F = 0';
  if (active.length === 1) {
    formula = L.formulas.one(SYM[active[0].i]);
    filled = `F = ${F(active[0].F)} ${T.N}`;
  } else if (active.length === 2) {
    const [p, q] = active;
    const al = between(p.ang, q.ang);
    const A = SYM[p.i];
    const B = SYM[q.i];
    if (al < 0.5) {
      formula = L.formulas.same(A, B);
      filled = `F = ${F(p.F)} + ${F(q.F)} = ${F(res.F)} ${T.N}`;
    } else if (al > 179.5) {
      formula = L.formulas.opposite(A, B);
      filled = `F = |${F(p.F)} − ${F(q.F)}| = ${F(res.F)} ${T.N}`;
    } else if (Math.abs(al - 90) < 0.5) {
      formula = L.formulas.right(A, B);
      filled = `F = √(${F(p.F)}² + ${F(q.F)}²) = ${F(res.F)} ${T.N}`;
    } else {
      formula = L.formulas.general(A, B);
      filled = `α = ${deg(al)}° ⇒ F = ${F(res.F)} ${T.N}`;
    }
  } else if (active.length === 3) {
    formula = L.formulas.comps;
    filled = `F = √(${F(res.fx)}² + ${F(res.fy)}²) = ${F(res.F)} ${T.N}`;
  }

  const forceList = active.map((f) => `${SYM[f.i]} = ${F(f.F)} ${T.N}, ${deg(f.ang)}°`).join('; ') || '—';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <IceScene
        T={T}
        forces={forces}
        third={third}
        res={res}
        a={a}
        t={t}
        running={sim.running}
        dragK={dragK}
        onDragK={setDragK}
        onForce={setForce}
        ariaLabel={L.sceneLabel(D(res.F), trim(a, dec, 2), forceList)}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.F} symbol="F" value={D(res.F)} unit={T.N} accent="#e2e8f0" sub={res.F > 0 ? L.FSub(deg(res.ang)) : L.FSubZero} />
        <Readout label={L.readouts.a} symbol="a" value={trim(a, dec, 2)} unit={T.ms2} accent={COL.acc} textColor={COL.accText} sub={L.aSub(D(res.F), D(m))} />
        <Readout label={L.readouts.v} symbol="v" value={fmt(v, 1, dec)} unit={T.ms} accent={COL.vel} textColor={COL.velText} sub={L.vSub(fmt(x, 1, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(t / T_RUN) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.formula} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="font-serif italic text-gray-200">
              <Rich>{formula}</Rich>
            </p>
            {active.length >= 2 && <p className="tabular-nums text-gray-400">{L.comps(F(res.fx), F(res.fy))}</p>}
            <p className="tabular-nums text-gray-300">
              <b className="text-white">{filled}</b>
            </p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) =>
              i < 2 || third ? (
                <div key={i} className="rounded-xl bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: FORCE_COL[i] }} aria-hidden="true" />
                      {L.force(i + 1)}
                      <span className="font-serif italic" style={{ color: FORCE_TEXT[i] }}>
                        <Rich>{SYM[i]}</Rich>
                      </span>
                    </p>
                    {i === 2 && (
                      <button
                        type="button"
                        onClick={toggleThird}
                        aria-label={L.thirdRemove}
                        className="grid h-10 w-10 place-items-center rounded-lg text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                      >
                        <X size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <RangeField
                    id={`nsl-res-f${i}`}
                    label={L.mag}
                    min={0}
                    max={F_MAX}
                    step={1}
                    value={forces[i].F}
                    onChange={(n) => setForce(i, { F: n })}
                    accent={FORCE_COL[i]}
                    display={`${F(forces[i].F)} ${T.N}`}
                  />
                  <RangeField
                    id={`nsl-res-a${i}`}
                    label={L.dir}
                    min={0}
                    max={355}
                    step={5}
                    value={forces[i].ang}
                    onChange={(n) => setForce(i, { ang: n })}
                    accent={FORCE_COL[i]}
                    display={`${deg(forces[i].ang)}°`}
                  />
                </div>
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={toggleThird}
                  className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/15 p-3 text-sm font-semibold text-gray-300 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: `${COL.f3}33`, color: COL.f3Text }}>
                    <Plus size={18} aria-hidden="true" />
                  </span>
                  {L.thirdAdd}
                </button>
              ),
            )}
          </div>
          <p className="-mt-1 text-xs text-gray-500">{L.dirHint}</p>
          <RangeField
            id="nsl-res-m"
            label={L.m}
            symbol="m"
            min={2}
            max={20}
            step={1}
            value={m}
            onChange={(n) => {
              setM(n);
              setSim(IDLE);
            }}
            accent={COL.mass}
            display={`${D(m)} ${T.kg}`}
            hint={L.mHint}
          />
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <PolygonDiagram T={T} active={active} res={res} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function IceScene({ T, forces, third, res, a, t, running, dragK, onDragK, onForce, ariaLabel }) {
  const L = T.res;
  const dec = T.decimal;
  const geo = useRef({ cx: 0, cy: 0, kF: 1, W: 1 });
  const drag = useRef(null);
  const x = 0.5 * a * t * t;
  const ux = res.F > 0 ? Math.cos(res.ang * RAD) : 0;
  const uy = res.F > 0 ? Math.sin(res.ang * RAD) : 0;
  const px = ux * x;
  const py = uy * x;
  const v = a * t;
  const shown = forces.map((f, i) => ({ ...f, i })).filter((f) => f.i < 2 || third);
  const activeN = shown.filter((f) => f.F > 0);
  const D = (n) => trim(n, dec, 1);
  const marks = [];
  for (let n = 0; n * 0.5 <= t + 1e-9; n += 1) {
    const s = 0.5 * a * (n * 0.5) ** 2;
    marks.push({ n, x: ux * s, y: uy * s });
  }

  const point = (e) => {
    const svg = e.currentTarget.ownerSVGElement;
    const r = svg.getBoundingClientRect();
    const k = geo.current.W / Math.max(1, r.width);
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
  };
  const onDown = (i) => (e) => {
    if (running) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // a synthetic or already released pointer cannot be captured; dragging still works while over the handle
    }
    drag.current = { i, kF: geo.current.kF };
    onDragK(geo.current.kF);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    const dx = p.x - geo.current.cx;
    const dy = geo.current.cy - p.y;
    const F = clamp(Math.round(Math.hypot(dx, dy) / d.kF), 0, F_MAX);
    const ang = norm(Math.round(Math.atan2(dy, dx) / RAD / 5) * 5);
    onForce(d.i, F > 0 ? { F, ang } : { F });
  };
  const onUp = () => {
    drag.current = null;
    onDragK(null);
  };

  return (
    <LabScene
      legend={[
        { color: COL.f1, label: L.legend.f1, kind: 'arrow' },
        { color: COL.f2, label: L.legend.f2, kind: 'arrow' },
        ...(third ? [{ color: COL.f3, label: L.legend.f3, kind: 'arrow' }] : []),
        { color: COL.res, label: L.legend.res, kind: 'bold' },
        { color: COL.acc, label: L.legend.a, kind: 'arrow' },
        { color: COL.vel, label: L.legend.v, kind: 'arrow' },
        { color: COL.vel, label: L.legend.trail, kind: 'ring' },
      ]}
      chips={(W, narrow) => {
        const kF = dragK ?? forceScale(W, narrow, shown, res);
        return (
          <>
            <Chip>
              {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
            </Chip>
            {!narrow && <Chip icon={Video}>{L.chipCam}</Chip>}
            <ScaleChip px={10 * kF} text={L.scale(10)} color={COL.res} />
          </>
        );
      }}
      height={(W, narrow) => sceneHeight(narrow)}
      ariaLabel={ariaLabel}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const cx = W / 2;
        const cy = sceneCentreY(H, narrow);
        const kF = dragK ?? forceScale(W, narrow, shown, res);
        geo.current = { cx, cy, kF, W };
        const zones = overlayZones(W, narrow);
        const kW = narrow ? 16 : 24; // px per metre of ice
        const box = { w: W, h: H };
        const half = narrow ? 17 : 22;
        const tip = (F, ang, off = 0) => ({
          x: cx + F * kF * Math.cos(ang * RAD) - off * Math.sin(ang * RAD),
          y: cy - F * kF * Math.sin(ang * RAD) - off * Math.cos(ang * RAD),
        });
        const sx = (wx) => cx + (wx - px) * kW;
        const sy = (wy) => cy - (wy - py) * kW;

        /* parallel forces get a small sideways offset so both stay visible */
        const offs = shown.map((f) => {
          const twin = shown.find((g) => g.i !== f.i && g.F > 0 && f.F > 0 && (between(g.ang, f.ang) < 2 || between(g.ang, f.ang) > 178));
          if (!twin) return 0;
          return f.i < twin.i ? -5 : 5;
        });

        /* grid that slides under the crate */
        const lines = [];
        const x0 = Math.floor(px - cx / kW) - 1;
        const x1 = Math.ceil(px + (W - cx) / kW) + 1;
        const y0 = Math.floor(py - (H - cy) / kW) - 1;
        const y1 = Math.ceil(py + cy / kW) + 1;
        for (let gx = x0; gx <= x1; gx += 1) {
          lines.push(<line key={`x${gx}`} x1={sx(gx)} x2={sx(gx)} y1={0} y2={H} stroke={gx % 5 === 0 ? '#bfdbfe' : '#e0efff'} strokeWidth={1} />);
        }
        for (let gy = y0; gy <= y1; gy += 1) {
          lines.push(<line key={`y${gy}`} x1={0} x2={W} y1={sy(gy)} y2={sy(gy)} stroke={gy % 5 === 0 ? '#bfdbfe' : '#e0efff'} strokeWidth={1} />);
        }

        /* labels: placed beyond each tip, nudged sideways if they collide */
        const placed = [];
        const place = (text, ex, ey, ux2, uy2) => {
          const w = textWidth(text, fs, 600) + 16;
          const h = fs + 10;
          const cands = [
            [ex + ux2 * (w / 2 + 6), ey + uy2 * (h / 2 + 4)],
            [ex - uy2 * (h / 2 + 8) + ux2 * 4, ey + ux2 * (h / 2 + 8)],
            [ex + uy2 * (h / 2 + 8) + ux2 * 4, ey - ux2 * (h / 2 + 8)],
            [ex + ux2 * (w / 2 + 6) - uy2 * (h + 6), ey + uy2 * (h / 2 + 4) + ux2 * (h + 6)],
            [ex + ux2 * (w / 2 + 6) + uy2 * (h + 6), ey + uy2 * (h / 2 + 4) - ux2 * (h + 6)],
          ];
          const hits = (c) =>
            placed.some((p) => Math.abs(p.x - c[0]) < (p.w + w) / 2 + 2 && Math.abs(p.y - c[1]) < (p.h + h) / 2 + 1) ||
            Math.hypot(c[0] - cx, c[1] - cy) < half + 12 ||
            (c[1] - h / 2 < zones.legendBottom && c[0] - w / 2 < zones.legendRight) ||
            (c[1] - h / 2 < zones.chipBottom && c[0] + w / 2 > zones.chipX);
          const c = cands.find((q) => !hits(q)) ?? cands[0];
          const pos = { x: clamp(c[0], w / 2 + 4, W - w / 2 - 4), y: clamp(c[1], h / 2 + 4, H - h / 2 - 4), w, h };
          placed.push(pos);
          return pos;
        };

        const resTip = tip(res.F, res.ang);
        const labels = [];
        if (res.F > 0) {
          const p = place(L.resTag(D(res.F)), resTip.x, resTip.y, ux, -uy);
          labels.push(<Pill key="lres" x={p.x} y={p.y} text={L.resTag(D(res.F))} bg={COL.res} size={fs} box={box} />);
        }
        shown.forEach((f, j) => {
          if (f.F <= 0) return;
          const tp = tip(f.F, f.ang, offs[j]);
          const text = L.fTag(['₁', '₂', '₃'][f.i], D(f.F));
          const p = place(text, tp.x, tp.y, Math.cos(f.ang * RAD), -Math.sin(f.ang * RAD));
          labels.push(<Pill key={`l${f.i}`} x={p.x} y={p.y} text={text} bg={FORCE_COL[f.i]} size={fs} box={box} />);
        });

        /* parallelogram and angle for exactly two forces */
        let para = null;
        let arc = null;
        if (activeN.length === 2) {
          const [p, q] = activeN;
          const tp = tip(p.F, p.ang);
          const tq = tip(q.F, q.ang);
          const al = between(p.ang, q.ang);
          if (al > 2 && al < 178) {
            para = (
              <g>
                <line x1={tp.x} y1={tp.y} x2={resTip.x} y2={resTip.y} stroke={FORCE_COL[q.i]} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 5" />
                <line x1={tq.x} y1={tq.y} x2={resTip.x} y2={resTip.y} stroke={FORCE_COL[p.i]} strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="5 5" />
              </g>
            );
            const r = narrow ? 26 : 34;
            let s0 = norm(p.ang);
            let s1 = norm(q.ang);
            if (norm(s1 - s0) > 180) [s0, s1] = [s1, s0];
            const e0 = { x: cx + r * Math.cos(s0 * RAD), y: cy - r * Math.sin(s0 * RAD) };
            const e1 = { x: cx + r * Math.cos(s1 * RAD), y: cy - r * Math.sin(s1 * RAD) };
            const span = norm(s1 - s0);
            const c1 = s0 + 0.22 * span;
            const c2 = s1 - 0.22 * span;
            // the symbol sits on the side of the angle away from the resultant (and from a, v)
            const mid = between(c1, res.ang) >= between(c2, res.ang) ? c1 : c2;
            const square = Math.abs(al - 90) < 0.5;
            const q0 = { x: Math.cos(s0 * RAD), y: -Math.sin(s0 * RAD) };
            const q1 = { x: Math.cos(s1 * RAD), y: -Math.sin(s1 * RAD) };
            const sq = half + (narrow ? 8 : 10);
            arc = (
              <g aria-hidden="true">
                {square ? (
                  <path
                    d={`M${cx + q0.x * sq},${cy + q0.y * sq} L${cx + (q0.x + q1.x) * sq},${cy + (q0.y + q1.y) * sq} L${cx + q1.x * sq},${cy + q1.y * sq}`}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={1.5}
                  />
                ) : (
                  <path d={`M${e0.x},${e0.y} A${r},${r} 0 0 0 ${e1.x},${e1.y}`} fill="none" stroke="#475569" strokeWidth={1.5} />
                )}
                {!square && (
                  <text
                    x={cx + (r + 11) * Math.cos(mid * RAD)}
                    y={cy - (r + 11) * Math.sin(mid * RAD) + 5}
                    textAnchor="middle"
                    fontSize={fs + 2}
                    fontWeight="700"
                    fontStyle="italic"
                    fill="#334155"
                    stroke="#fff"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    α
                  </text>
                )}
              </g>
            );
          }
        }

        /* acceleration and velocity: parallel to F, shifted to the sides */
        const ak = (narrow ? 7 : 11) * Math.min(1, (narrow ? 70 : 120) / Math.max(1e-9, a * (narrow ? 7 : 11)));
        const vk = (narrow ? 4 : 6) * Math.min(1, (narrow ? 70 : 120) / Math.max(1e-9, a * T_RUN * (narrow ? 4 : 6)));
        const nx = -uy;
        const ny = -ux;
        const sideA = 15;
        const startOff = half + 4;
        if (a > 1e-9) {
          const text = L.aTag(trim(a, dec, 2));
          const p = place(text, cx + ux * (startOff + a * ak) + nx * sideA, cy - uy * (startOff + a * ak) + ny * sideA, ux, -uy);
          labels.push(<Pill key="la" x={p.x} y={p.y} text={text} bg={COL.acc} size={fs - 1} box={box} />);
        }

        return (
          <>
            <rect width={W} height={H} fill="#f6faff" />
            <g aria-hidden="true">{lines}</g>

            {/* start mark and the trail */}
            <g>
              <circle cx={sx(0)} cy={sy(0)} r={5} fill="none" stroke={COL.ink} strokeWidth={2} />
              <line x1={sx(0) - 9} x2={sx(0) + 9} y1={sy(0)} y2={sy(0)} stroke={COL.ink} strokeWidth={1.5} />
              <line x1={sx(0)} x2={sx(0)} y1={sy(0) - 9} y2={sy(0) + 9} stroke={COL.ink} strokeWidth={1.5} />
              {x * kW > 30 && (
                <text x={sx(0)} y={sy(0) + 22} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill={COL.muted}>
                  {L.start}
                </text>
              )}
              {x > 0.01 && <line x1={sx(0)} y1={sy(0)} x2={cx} y2={cy} stroke={COL.vel} strokeOpacity={0.35} strokeWidth={2} strokeDasharray="2 5" />}
              {marks.slice(1).map((mk) => (
                <circle key={mk.n} cx={sx(mk.x)} cy={sy(mk.y)} r={4} fill="#fff" stroke={COL.vel} strokeWidth={2} />
              ))}
            </g>

            {/* crate */}
            {running && <circle cx={cx} cy={cy} r={half + 10} fill={COL.acc} className="cl-pulse" opacity={0.2} />}
            <g>
              <rect x={cx - half} y={cy - half} width={half * 2} height={half * 2} rx={4} fill="#d6a15e" stroke="#92592a" strokeWidth={2} />
              <line x1={cx - half + 4} y1={cy - half + 4} x2={cx + half - 4} y2={cy + half - 4} stroke="#92592a" strokeWidth={2} />
              <line x1={cx + half - 4} y1={cy - half + 4} x2={cx - half + 4} y2={cy + half - 4} stroke="#92592a" strokeWidth={2} />
              <rect x={cx - half + 3} y={cy - half + 3} width={half * 2 - 6} height={half * 2 - 6} rx={2} fill="none" stroke="#b9783f" strokeWidth={1.5} />
            </g>

            {para}
            {arc}

            {/* resultant (under the separate forces) */}
            {res.F * kF > 3 && <Arrow x1={cx} y1={cy} x2={resTip.x} y2={resTip.y} color={COL.res} width={narrow ? 5 : 6} head={narrow ? 14 : 17} />}

            {shown.map((f, j) => {
              if (f.F * kF < 3) return null;
              const tp = tip(f.F, f.ang, offs[j]);
              const o = offs[j];
              return (
                <Arrow
                  key={`f${f.i}`}
                  x1={cx - o * Math.sin(f.ang * RAD)}
                  y1={cy - o * Math.cos(f.ang * RAD)}
                  x2={tp.x}
                  y2={tp.y}
                  color={FORCE_COL[f.i]}
                  width={narrow ? 3 : 3.5}
                  head={narrow ? 11 : 13}
                />
              );
            })}
            <circle cx={cx} cy={cy} r={4} fill={COL.ink} stroke="#fff" strokeWidth={1.5} />

            {/* a and v alongside F */}
            {a > 1e-9 && (
              <Arrow
                x1={cx + ux * startOff + nx * sideA}
                y1={cy - uy * startOff + ny * sideA}
                x2={cx + ux * (startOff + a * ak) + nx * sideA}
                y2={cy - uy * (startOff + a * ak) + ny * sideA}
                color={COL.acc}
                width={narrow ? 2.5 : 3}
                head={narrow ? 9 : 11}
              />
            )}
            {v > 0.05 && (
              <Arrow
                x1={cx + ux * startOff - nx * sideA}
                y1={cy - uy * startOff - ny * sideA}
                x2={cx + ux * (startOff + v * vk) - nx * sideA}
                y2={cy - uy * (startOff + v * vk) - ny * sideA}
                color={COL.vel}
                width={narrow ? 2.5 : 3}
                head={narrow ? 9 : 11}
              />
            )}

            {labels}
            {res.F === 0 && activeN.length > 0 && <Pill x={cx} y={cy + half + 20} text={L.zeroTag} bg="#059669" size={fs} box={box} />}

            {/* drag handles */}
            {!running &&
              shown.map((f, j) => {
                if (f.F <= 0) return null;
                const tp = tip(f.F, f.ang, offs[j]);
                return (
                  <g key={`h${f.i}`}>
                    <circle cx={tp.x} cy={tp.y} r={5} fill="#fff" stroke={FORCE_COL[f.i]} strokeWidth={2} pointerEvents="none" />
                    <circle
                      cx={tp.x}
                      cy={tp.y}
                      r={narrow ? 20 : 16}
                      fill="transparent"
                      style={{ touchAction: 'none', cursor: drag.current ? 'grabbing' : 'grab' }}
                      onPointerDown={onDown(f.i)}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onPointerCancel={onUp}
                    />
                  </g>
                );
              })}
            {!running && t === 0 && (
              <text x={12} y={H - 12} fontSize={fs - 1} fill={COL.muted}>
                {L.dragHint}
              </text>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

const SCALE_STEPS = [6, 5, 4, 3.5, 3, 2.5, 2, 1.6, 1.2, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2];

/**
 * Pixels per newton: the largest round scale at which every force tip and the
 * resultant's tip (with room for its label) stay inside the scene around the
 * crate, which sits at the centre. Round steps keep the arrows from creeping
 * while a slider moves.
 */
function forceScale(W, narrow, shown, res) {
  const H = sceneHeight(narrow);
  const cx = W / 2;
  const cy = sceneCentreY(H, narrow);
  const z = overlayZones(W, narrow);
  const roomX = W / 2 - (narrow ? 44 : 96);
  const roomDown = H - cy - (narrow ? 26 : 30);
  const tips = shown.filter((f) => f.F > 0).map((f) => [f.F * Math.cos(f.ang * RAD), f.F * Math.sin(f.ang * RAD)]);
  tips.push([res.fx, res.fy]);
  const fits = (k) =>
    tips.every(([x, y]) => {
      const px = x * k;
      const py = y * k;
      if (Math.abs(px) > roomX) return false;
      if (py <= 0) return -py <= roomDown;
      // under the chips on the right the scene starts lower than under the legend
      const top = cx + px > z.chipX - 60 ? z.chipBottom : z.legendBottom;
      return py <= cy - top - 26;
    });
  const max = narrow ? 3.4 : 6;
  return SCALE_STEPS.find((k) => k <= max && fits(k)) ?? SCALE_STEPS[SCALE_STEPS.length - 1];
}

const sceneHeight = (narrow) => (narrow ? 380 : 440);
const sceneCentreY = (H, narrow) => (narrow ? H / 2 + 24 : H / 2 + 22);

/** The parts of the scene covered by the legend (top left) and the chips (top right). */
function overlayZones(W, narrow) {
  return narrow
    ? { legendBottom: 8, legendRight: 0, chipX: W - 170, chipBottom: 84 }
    : { legendBottom: 50, legendRight: Math.min(W - 320, 620), chipX: W - 300, chipBottom: 126 };
}

/* ---------------------------------------------------------------- polygon */

function PolygonDiagram({ T, active, res }) {
  const L = T.res.poly;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 220);
  const H = 250;
  const pts = [{ x: 0, y: 0 }];
  for (const f of active) {
    const p = pts[pts.length - 1];
    pts.push({ x: p.x + f.F * Math.cos(f.ang * RAD), y: p.y + f.F * Math.sin(f.ang * RAD) });
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const by1 = Math.max(...ys);
  const pad = 34;
  const k = Math.min((W - 2 * pad) / Math.max(bx1 - bx0, 10), (H - 2 * pad) / Math.max(by1 - by0, 10), 4);
  const ox = W / 2 - ((bx0 + bx1) / 2) * k;
  const oy = H / 2 + ((by0 + by1) / 2) * k;
  const S = (p) => ({ x: ox + p.x * k, y: oy - p.y * k });
  const end = pts[pts.length - 1];
  const closed = active.length > 0 && res.F === 0;
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{L.title}</p>
      <div ref={ref} className="mt-2 w-full overflow-hidden rounded-xl bg-white">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.label} className="cl-scene block">
          <g aria-hidden="true">
            {Array.from({ length: Math.ceil(W / 22) + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * 22} x2={i * 22} y1={0} y2={H} stroke={COL.grid} />
            ))}
            {Array.from({ length: Math.ceil(H / 22) + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} x2={W} y1={i * 22} y2={i * 22} stroke={COL.grid} />
            ))}
          </g>
          {res.F > 0 && (
            <Arrow x1={S(pts[0]).x} y1={S(pts[0]).y} x2={S(end).x} y2={S(end).y} color={COL.res} width={4.5} head={14} />
          )}
          {active.map((f, j) => {
            const p = S(pts[j]);
            const q = S(pts[j + 1]);
            const mx = (p.x + q.x) / 2;
            const my = (p.y + q.y) / 2;
            const len = Math.hypot(q.x - p.x, q.y - p.y);
            const nx = len > 0 ? -(q.y - p.y) / len : 0;
            const ny = len > 0 ? (q.x - p.x) / len : 0;
            return (
              <g key={f.i}>
                <Arrow x1={p.x} y1={p.y} x2={q.x} y2={q.y} color={FORCE_COL[f.i]} width={3} head={11} />
                <text x={mx + nx * 14} y={my + ny * 14 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fontStyle="italic" fill={FORCE_COL[f.i]} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {SYM[f.i]}
                </text>
              </g>
            );
          })}
          <circle cx={S(pts[0]).x} cy={S(pts[0]).y} r={4} fill={COL.ink} />
          {res.F > 0 && (
            <Pill
              x={(S(pts[0]).x + S(end).x) / 2 - ((S(end).y - S(pts[0]).y) / Math.max(1, Math.hypot(S(end).x - S(pts[0]).x, S(end).y - S(pts[0]).y))) * 16}
              y={(S(pts[0]).y + S(end).y) / 2 + ((S(end).x - S(pts[0]).x) / Math.max(1, Math.hypot(S(end).x - S(pts[0]).x, S(end).y - S(pts[0]).y))) * 16}
              text={`F = ${trim(res.F, dec, 1)} ${T.N}`}
              bg={COL.res}
              size={12}
              box={{ w: W, h: H }}
            />
          )}
          {closed && <Pill x={W / 2} y={H - 18} text={L.closed} bg="#059669" size={12} box={{ w: W, h: H }} />}
        </svg>
      </div>
      <p className="mt-2 text-xs leading-snug text-gray-500">{L.note}</p>
    </div>
  );
}
