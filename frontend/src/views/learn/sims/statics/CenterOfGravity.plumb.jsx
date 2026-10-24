import { useId, useMemo, useState } from 'react';
import { Check, Circle, Eye, EyeOff, Lightbulb, Map as MapIcon, Pause, PencilLine, Play, RectangleHorizontal, RotateCcw, SkipForward, Spline, Timer, Triangle } from 'lucide-react';

import { Btn, Explain, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import { CC, CgMark, Chip, Eq, ForceArrow, FormulaPanel, GroupLabel, LabScene, Panel, SceneRow, Step, Sym, SvgSym, deg, num, rad } from './CenterOfGravity.parts';
import { SHAPES, SHAPE_IDS, TRI_V, contourPath, intersect } from './CenterOfGravity.shapes';

/**
 * Tab 2 — finding the centre of gravity of a flat plate by hanging it
 * (the plumb-line method). A plate pinned through a hole swings and comes to
 * rest with C straight below the pin: only then does the weight m·g pass
 * through the pin and have no moment about it. A line drawn along the plumb
 * thread therefore goes through C; a second line from another hole crosses
 * the first one at C. The plates' C is the area centroid of the outline
 * (computed exactly, see CenterOfGravity.shapes.js), so the experiment can be
 * checked against geometry: diagonals of the rectangle, medians of the
 * triangle, the two rectangles of the L (x_C = (A₁x₁ + A₂x₂)/(A₁ + A₂)), the
 * centre of the ring. For the ring, the L and the boomerang, C lies outside
 * the material.
 */

const ZETA = 0.22; // damping ratio of the swing (air and the pin)
const MAX_DEV = rad(32); // how far from rest a re-hung plate starts
const MIN_DEV = rad(14);
const SHAPE_ICONS = { blob: MapIcon, rect: RectangleHorizontal, tri: Triangle, L: Spline, ring: Circle, boom: Spline };
const ORDER = ['blob', ...SHAPE_IDS.filter((s) => s !== 'blob')];
const LINE_COLORS = [CC.line1, CC.line2, CC.line3];

const wrap = (a) => {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
};

/** Plate angle at which C hangs straight below hole `i`. */
function eqAngle(shape, i) {
  const [hx, hy] = shape.holes[i];
  return -Math.PI / 2 - Math.atan2(shape.c[1] - hy, shape.c[0] - hx);
}

/** Swing constants for hole `i`: ω₀ (rad/s) of the physical pendulum. */
function omega0(shape, i) {
  const [hx, hy] = shape.holes[i];
  const d = Math.hypot(shape.c[0] - hx, shape.c[1] - hy) / 100; // m
  const k2 = (shape.jc / shape.area) / 1e4 + d * d; // m², radius of gyration about the pin
  return Math.sqrt((9.8 * d) / k2);
}

/** A start angle near rest: the plate is re-hung by hand, then let go. */
function startAngle(shape, i, from) {
  const eq = eqAngle(shape, i);
  const dv = wrap(from - eq);
  const s = dv < 0 ? -1 : 1;
  return eq + s * Math.min(MAX_DEV, Math.max(MIN_DEV, Math.abs(dv)));
}

const fresh = (shape) => ({ hole: 0, th: startAngle(shape, 0, 0), om: 0, phase: 'held', running: false, lines: [], rested: false });

/** World box (cm, pin at the origin) that holds every pose the plate takes in this tab. */
function sceneBox(shape) {
  let x0 = -6;
  let x1 = 6;
  let y0 = -6;
  const pts = [];
  for (const c of shape.contours) for (let i = 0; i < c.length; i += c.length > 40 ? 3 : 1) pts.push(c[i]);
  shape.holes.forEach((h, i) => {
    const eq = eqAngle(shape, i);
    for (let f = -1; f <= 1.0001; f += 0.25) {
      const a = eq + f * (MAX_DEV + rad(3));
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (const [px, py] of pts) {
        const qx = px - h[0];
        const qy = py - h[1];
        const x = qx * ca - qy * sa;
        const y = qx * sa + qy * ca;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
      }
    }
  });
  const half = Math.max(-x0, x1);
  return { x0: -half - 2, x1: half + 2, y0: y0 - 7, y1: 7 };
}

export default function PlumbSim({ T }) {
  const L = T.plumb;
  const dec = T.decimal;
  const [shapeId, setShapeId] = useState('blob');
  const shape = SHAPES[shapeId];
  const [st, setSt] = useState(() => fresh(SHAPES.blob));
  const [showGeo, setShowGeo] = useState(false);

  const eq = eqAngle(shape, st.hole);
  const w0 = omega0(shape, st.hole);

  useRafLoop(st.running, (dt) => {
    setSt((p) => {
      if (!p.running) return p;
      let { th, om } = p;
      let rem = dt;
      while (rem > 1e-9) {
        const h = Math.min(1 / 500, rem);
        rem -= h;
        om += (-w0 * w0 * Math.sin(th - eq) - 2 * ZETA * w0 * om) * h;
        th += om * h;
      }
      if (Math.abs(wrap(th - eq)) < rad(0.3) && Math.abs(om) < 0.06) {
        return { ...p, th: eq, om: 0, running: false, phase: 'rest', rested: true };
      }
      return { ...p, th, om };
    });
  });

  const pickShape = (id) => {
    setShapeId(id);
    setSt(fresh(SHAPES[id]));
    setShowGeo(false);
  };
  const hang = (i) => setSt((p) => ({ ...p, hole: i, th: startAngle(shape, i, p.th), om: 0, phase: 'swing', running: true }));
  const drawLine = () =>
    setSt((p) => {
      if (p.phase !== 'rest' || p.lines.some((l) => l.hole === p.hole)) return p;
      const h = shape.holes[p.hole];
      // the plumb thread is the world's −y axis through the pin; in plate coordinates:
      const d = [-Math.sin(p.th), -Math.cos(p.th)];
      return { ...p, lines: [...p.lines, { hole: p.hole, p: h, d }] };
    });
  const reset = () => setSt(fresh(shape));

  const lineHere = st.lines.some((l) => l.hole === st.hole);
  const nextHole = [0, 1, 2].find((i) => !st.lines.some((l) => l.hole === i) && i !== st.hole);
  const found = st.lines.length >= 2 ? intersect(st.lines[0].p, st.lines[0].d, st.lines[1].p, st.lines[1].d) : null;
  const dev = deg(wrap(st.th - eq));

  /* ---- the one primary action, following the experiment */
  let primary;
  if (st.phase === 'held') primary = { icon: Play, label: L.play.release, on: () => setSt((p) => ({ ...p, phase: 'swing', running: true })) };
  else if (st.phase === 'swing') primary = st.running ? { icon: Pause, label: L.play.pause, on: () => setSt((p) => ({ ...p, running: false })) } : { icon: Play, label: L.play.resume, on: () => setSt((p) => ({ ...p, running: true })) };
  else if (!lineHere) primary = { icon: PencilLine, label: L.play.draw, on: drawLine };
  else if (nextHole !== undefined) primary = { icon: SkipForward, label: L.play.next(nextHole + 1), on: () => hang(nextHole) };
  else primary = { icon: Check, label: L.play.done, on: () => {}, disabled: true };

  /* ---- explanation */
  let key;
  if (st.phase === 'held') key = 'intro';
  else if (st.phase === 'swing') key = 'swing';
  else if (st.lines.length >= 3) key = 'three';
  else if (found && lineHere) key = shape.cInside ? 'found' : 'foundOut';
  else if (!lineHere) key = st.lines.length === 0 ? 'rest1' : 'rest2';
  else key = 'line1';
  const settled = useSettled(key, key === 'swing' ? 200 : 0);
  const ex = L.explain;
  const cTxt = found ? L.coords(fmt(found[0], 1, dec), fmt(found[1], 1, dec)) : '';
  const text = {
    intro: ex.intro,
    swing: ex.swing,
    rest1: ex.rest1,
    line1: ex.line1,
    rest2: ex.rest2,
    found: ex.found(cTxt),
    foundOut: ex.foundOut(cTxt, L.where[shapeId]),
    three: ex.three(cTxt),
  }[settled];
  const tone = { intro: '#22d3ee', swing: '#fb923c', rest1: '#a78bfa', line1: '#a78bfa', rest2: '#a78bfa', found: '#34d399', foundOut: '#fbbf24', three: '#34d399' }[settled];

  const phaseSub = st.phase === 'held' ? L.phase.held : st.phase === 'swing' ? L.phase.swing : L.phase.rest;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.shapesLabel}</GroupLabel>
          <Segmented
            label={L.shapesLabel}
            className="grid-cols-3 md:grid-cols-6"
            size="lg"
            value={shapeId}
            onChange={pickShape}
            options={ORDER.map((id) => ({ value: id, label: L.shapes[id].name, sub: L.shapes[id].sub, icon: SHAPE_ICONS[id] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Btn variant="primary" icon={primary.icon} onClick={primary.on} disabled={primary.disabled} className="xl:min-w-[188px] min-h-[52px] text-[15px]">
            {primary.label}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={st.phase === 'held' && st.lines.length === 0} className="min-h-[52px] text-[15px]">
            {L.play.reset}
          </Btn>
        </div>
      </div>

      <SceneRow
        minH={480}
        renderScene={(fitH) => <PlumbScene T={T} shape={shape} st={st} found={found} showGeo={showGeo} fitH={fitH} onHole={hang} />}
        side={<PlumbMethod T={T} shape={shape} st={st} found={found} showGeo={showGeo} onGeo={() => setShowGeo((v) => !v)} />}
      />

      <Explain icon={Lightbulb} id={`${settled}-${shapeId}`} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.hole} value={`${st.hole + 1}`} accent="#94a3b8" sub={L.linesSub(st.lines.length)} />
        <Readout label={L.readouts.dev} symbol="φ" value={`${num(dev, 1, dec)}°`} accent="#fb923c" textColor="#fed7aa" sub={phaseSub} active={st.running} />
        <Readout label={L.readouts.c} symbol="C" accent={CC.cg} active={!!found} sub={found ? L.cSubFound : L.cSubWait}>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[22px] sm:text-[28px] leading-none font-bold tabular-nums tracking-tight text-amber-200">
              {found ? `${fmt(found[0], 1, dec)}; ${fmt(found[1], 1, dec)}` : '?'}
            </span>
            {found && <span className="text-sm text-gray-400">{T.cm}</span>}
          </div>
        </Readout>
        <Readout label={L.readouts.where} accent={found ? (shape.cInside ? CC.stable : '#f59e0b') : '#64748b'} sub={found ? L.whereSub[shape.cInside ? 'in' : 'out'] : L.cSubWait}>
          <p className={`mt-1.5 text-lg sm:text-xl font-bold leading-tight ${found ? (shape.cInside ? 'text-emerald-300' : 'text-amber-300') : 'text-gray-500'}`}>
            {found ? L.inOut[shape.cInside ? 'in' : 'out'] : '—'}
          </p>
        </Readout>
      </div>

      <Panel className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <GroupLabel>{L.holesLabel}</GroupLabel>
          <Segmented
            label={L.holesLabel}
            className="grid-cols-3"
            value={st.phase === 'held' ? null : st.hole}
            onChange={hang}
            options={[0, 1, 2].map((i) => {
              const ln = st.lines.findIndex((l) => l.hole === i);
              return { value: i, label: L.holeName(i + 1), sub: ln >= 0 ? L.lineDone(ln + 1) : L.lineNone };
            })}
          />
          <p className="mt-2 text-xs leading-snug text-gray-500">{L.holesHint}</p>
        </div>
        <div className="text-sm leading-snug text-gray-300">
          <GroupLabel>{L.whyTitle}</GroupLabel>
          <p>
            <Sym>{L.why}</Sym>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            <Sym>{L.plateInfo(fmt(shape.area, 0, dec))}</Sym>
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ================================================================= scene */

function PlumbScene({ T, shape, st, found, showGeo, fitH, onHole }) {
  const L = T.plumb;
  const gid = useId().replace(/:/g, '');
  const box = useMemo(() => sceneBox(shape), [shape]);

  return (
    <LabScene
      legend={[
        { color: CC.line1, label: L.legend.lines, kind: 'line' },
        { color: '#475569', label: L.legend.thread, kind: 'dash' },
        { color: CC.cg, label: L.legend.cg, kind: 'cg' },
        { color: CC.result, label: L.legend.mg, kind: 'arrow' },
      ]}
      chips={
        <Chip icon={Timer}>
          {L.chipReal}
        </Chip>
      }
      height={(W, narrow) => fitH ?? (narrow ? 400 : 500)}
      ariaLabel={L.sceneLabel(L.shapes[shape.id].name, st.hole + 1, st.lines.length)}
    >
      {(W, H, narrow) => {
        const view = makeView(box, W, H, narrow ? { l: 12, r: 12, t: 54, b: 14 } : { l: 24, r: 24, t: 70, b: 18 });
        const k = view.k;
        const fs = narrow ? 11 : 12.5;
        const ca = Math.cos(st.th);
        const sa = Math.sin(st.th);
        const [hx, hy] = shape.holes[st.hole];
        /* plate point (cm) → screen */
        const map = ([x, y]) => {
          const qx = x - hx;
          const qy = y - hy;
          return [view.sx(qx * ca - qy * sa), view.sy(qx * sa + qy * ca)];
        };
        const pin = [view.sx(0), view.sy(0)];
        const path = contourPath(shape.contours, map);
        const holeR = Math.max(3.5, 0.75 * k);
        const reach = Math.hypot(shape.w, shape.h) + 4;
        const bobY = view.sy(box.y0 + 2.2);

        /* the drawn lines, solid on the plate and dashed beyond it */
        const segs = st.lines.map((ln, i) => {
          const a = map([ln.p[0] - ln.d[0] * reach, ln.p[1] - ln.d[1] * reach]);
          const b = map([ln.p[0] + ln.d[0] * reach, ln.p[1] + ln.d[1] * reach]);
          return { a, b, color: LINE_COLORS[i] };
        });
        const C = found ? map(found) : null;
        const Cgeo = map(shape.c);

        return (
          <g>
            <defs>
              <clipPath id={`${gid}-plate`}>
                <path d={path} clipRule="evenodd" />
              </clipPath>
              <linearGradient id={`${gid}-bob`} x1="0" x2="1">
                <stop offset="0" stopColor="#92400e" />
                <stop offset="0.5" stopColor="#f59e0b" />
                <stop offset="1" stopColor="#78350f" />
              </linearGradient>
            </defs>

            {/* stand */}
            <g aria-hidden="true">
              <rect x={view.sx(box.x0) - 20} y={pin[1] - 9} width={pin[0] - view.sx(box.x0) + 30} height={8} rx={3} fill="#94a3b8" stroke="#64748b" />
              <rect x={view.sx(box.x0) + 2} y={pin[1] - 9} width={9} height={H} fill="#cbd5e1" stroke="#94a3b8" />
            </g>

            {/* the plate */}
            <path d={path} fill={CC.plate} fillRule="evenodd" stroke={CC.plateEdge} strokeWidth="1.6" strokeLinejoin="round" />
            {segs.map((s, i) => (
              <line key={`d${i}`} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={s.color} strokeWidth="1.4" strokeDasharray="4 5" opacity="0.75" />
            ))}
            <g clipPath={`url(#${gid}-plate)`}>
              {segs.map((s, i) => (
                <line key={`s${i}`} x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={s.color} strokeWidth="3" strokeLinecap="round" />
              ))}
            </g>

            {showGeo && <GeoOverlay shape={shape} map={map} k={k} fs={fs} T={T} />}

            {/* holes */}
            {shape.holes.map((h, i) => {
              const [x, y] = map(h);
              const here = i === st.hole;
              const dx = shape.c[0] - h[0];
              const dy = shape.c[1] - h[1];
              const len = Math.hypot(dx, dy) || 1;
              const lp = map([h[0] - (dx / len) * 2.6, h[1] - (dy / len) * 2.6]);
              return (
                <g key={`h${i}`} onClick={() => onHole(i)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r={16} fill="transparent" />
                  <circle cx={x} cy={y} r={holeR} fill="#fbfcfe" stroke="#78350f" strokeWidth="1.4" />
                  {!here && (
                    <text x={lp[0]} y={lp[1] + 4} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#78350f" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                      {i + 1}
                    </text>
                  )}
                </g>
              );
            })}

            {/* plumb line from the same pin */}
            <line x1={pin[0]} y1={pin[1]} x2={pin[0]} y2={bobY - 10} stroke="#475569" strokeWidth="1.3" strokeDasharray={st.phase === 'rest' ? undefined : '5 4'} />
            <path d={`M${pin[0] - 7},${bobY - 10} L${pin[0] + 7},${bobY - 10} L${pin[0]},${bobY + 8} Z`} fill={`url(#${gid}-bob)`} stroke="#78350f" strokeWidth="1" />

            {/* pin */}
            <circle cx={pin[0]} cy={pin[1]} r={5} fill="#1e293b" stroke="#fff" strokeWidth="1.5" />
            <circle cx={pin[0] - 1.4} cy={pin[1] - 1.4} r={1.4} fill="#cbd5e1" />
            <text x={pin[0] + 10} y={pin[1] - 12} fontSize={fs - 1} fontWeight="700" fill="#78350f" stroke="#fff" strokeWidth="3" paintOrder="stroke">
              {L.holeName(st.hole + 1)}
            </text>

            {/* centre of gravity: theory (with the construction) and the crossing of the lines */}
            {showGeo && !C && <CgMark x={Cgeo[0]} y={Cgeo[1]} r={narrow ? 5.5 : 6.5} opacity={0.55} />}
            {C && (
              <>
                <ForceArrow
                  x={C[0]}
                  y={C[1]}
                  dx={0}
                  dy={narrow ? 52 : 70}
                  color={CC.result}
                  width={narrow ? 2.8 : 3.4}
                  head={narrow ? 10 : 12}
                  label="mg"
                  fs={fs}
                  labelAt={{ x: C[0] + 9, y: C[1] + (narrow ? 44 : 60), anchor: 'start' }}
                />
                <CgMark x={C[0]} y={C[1]} r={narrow ? 6 : 7.5} pulse={st.lines.length === 2} />
                <SvgSym x={C[0] - 11} y={C[1] - 9} text="C" color={CC.cg} fs={fs + 1} anchor="end" />
              </>
            )}
            {found && !shape.cInside && (
              <SvgSym x={C[0] + 12} y={C[1] - 10} text={L.outsideTag} color="#b45309" fs={fs - 1} anchor="start" weight={600} />
            )}
            {/* scale bar: 10 cm */}
            <g aria-hidden="true">
              <line x1={W - 16 - 10 * k} x2={W - 16} y1={H - 14} y2={H - 14} stroke="#334155" strokeWidth="2.5" />
              <line x1={W - 16 - 10 * k} x2={W - 16 - 10 * k} y1={H - 19} y2={H - 9} stroke="#334155" strokeWidth="1.5" />
              <line x1={W - 16} x2={W - 16} y1={H - 19} y2={H - 9} stroke="#334155" strokeWidth="1.5" />
              <text x={W - 16 - 5 * k} y={H - 20} textAnchor="middle" fontSize="11" fontWeight="600" fill="#334155">
                {`10 ${T.cm}`}
              </text>
            </g>
          </g>
        );
      }}
    </LabScene>
  );
}

/** The geometric construction that predicts C for each plate. */
function GeoOverlay({ shape, map, k, fs, T }) {
  const L = T.plumb;
  const seg = (p, q, key, color = '#475569', dash = '6 4', w = 1.5) => {
    const a = map(p);
    const b = map(q);
    return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={w} strokeDasharray={dash} />;
  };
  const items = [];
  if (shape.id === 'rect') {
    items.push(seg([0, 0], [32, 20], 'd1'), seg([32, 0], [0, 20], 'd2'));
  } else if (shape.id === 'tri') {
    const V = TRI_V;
    for (let i = 0; i < 3; i += 1) {
      const a = V[(i + 1) % 3];
      const b = V[(i + 2) % 3];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      items.push(seg(V[i], m, `m${i}`));
      const mp = map(m);
      items.push(<circle key={`mp${i}`} cx={mp[0]} cy={mp[1]} r={2.6} fill="#475569" />);
    }
  } else if (shape.id === 'L') {
    shape.parts.forEach((r, i) => {
      const pts = [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
      ].map(map);
      items.push(
        <polygon key={`p${i}`} points={pts.map((p) => p.join(',')).join(' ')} fill={i ? '#0891b2' : '#7c3aed'} fillOpacity="0.1" stroke={i ? '#0891b2' : '#7c3aed'} strokeDasharray="5 4" strokeWidth="1.3" />,
      );
    });
    const c1 = [4, 15];
    const c2 = [19, 4];
    items.push(seg(c1, c2, 'c12', '#475569', '3 3', 1.3));
    [c1, c2].forEach((c, i) => {
      const p = map(c);
      items.push(<CgMark key={`c${i}`} x={p[0]} y={p[1]} r={4.5} color={i ? '#0891b2' : '#7c3aed'} />);
      items.push(<SvgSym key={`ct${i}`} x={p[0] + 8} y={p[1] - 6} text={`C_{${i + 1}}`} color={i ? '#0e7490' : '#6d28d9'} fs={fs - 1} anchor="start" />);
    });
  } else if (shape.id === 'ring') {
    const { cx, cy, R } = shape.circle;
    items.push(seg([cx - R, cy], [cx + R, cy], 'a1'), seg([cx, cy - R], [cx, cy + R], 'a2'));
  } else if (shape.id === 'boom') {
    items.push(seg([shape.axis[0], shape.axis[1]], [shape.axis[0], -2], 'ax'));
  }
  /* the plate's own axes from its lower-left corner, for the coordinates */
  const o = map([0, 0]);
  const ex = map([6, 0]);
  const ey = map([0, 6]);
  return (
    <g pointerEvents="none">
      {items}
      <line x1={o[0]} y1={o[1]} x2={ex[0]} y2={ex[1]} stroke="#0f172a" strokeWidth="1.6" />
      <line x1={o[0]} y1={o[1]} x2={ey[0]} y2={ey[1]} stroke="#0f172a" strokeWidth="1.6" />
      <circle cx={o[0]} cy={o[1]} r={2.5} fill="#0f172a" />
      <SvgSym x={ex[0] + (ex[0] - o[0]) * 0.25} y={ex[1] + (ex[1] - o[1]) * 0.25 + 4} text="x" color="#0f172a" fs={fs} />
      <SvgSym x={ey[0] + (ey[0] - o[0]) * 0.25} y={ey[1] + (ey[1] - o[1]) * 0.25 + 4} text="y" color="#0f172a" fs={fs} />
      {k > 6 && <SvgSym x={o[0]} y={o[1] + fs + 6} text={L.originTag} color="#334155" fs={fs - 2} weight={600} />}
    </g>
  );
}

/* ================================================================ method */

function PlumbMethod({ T, shape, st, found, showGeo, onGeo }) {
  const L = T.plumb;
  const M = L.method;
  const dec = T.decimal;
  const F1 = (n) => fmt(n, 1, dec);
  const c = shape.c;
  const geo = M.geo[shape.id];

  let check;
  if (shape.id === 'rect') check = <Eq sym={geo.sym} nums={geo.nums} result={`(${F1(c[0])}; ${F1(c[1])}) ${T.cm}`} />;
  else if (shape.id === 'tri')
    check = (
      <>
        <Eq sym={geo.sym} />
        <Eq nums={geo.nums} result={`(${F1(c[0])}; ${F1(c[1])}) ${T.cm}`} />
      </>
    );
  else if (shape.id === 'L')
    check = (
      <>
        <Eq nums={geo.parts} />
        <Eq sym="x_{C} = (A_{1}x_{1} + A_{2}x_{2}) / (A_{1} + A_{2})" />
        <Eq nums={`= (240·4 + 176·19) / (240 + 176) = 4304 / 416 =`} result={`${F1(c[0])} ${T.cm}`} />
        <Eq nums={`y_{C} = (240·15 + 176·4) / 416 = 4304 / 416 =`} result={`${F1(c[1])} ${T.cm}`} />
      </>
    );
  else if (shape.id === 'ring') check = <Eq nums={geo.nums} result={`(${F1(c[0])}; ${F1(c[1])}) ${T.cm}`} />;
  else if (shape.id === 'boom') check = <Eq nums={geo.nums} result={`(${F1(c[0])}; ${F1(c[1])}) ${T.cm}`} />;
  else check = <Eq nums={geo.nums} result={`(${F1(c[0])}; ${F1(c[1])}) ${T.cm}`} />;

  return (
    <FormulaPanel title={M.title}>
      <Step n={1} title={M.s1} done={st.rested}>
        {M.s1t}
      </Step>
      <Step n={2} title={M.s2} done={st.lines.length >= 1}>
        <Sym>{M.s2t}</Sym>
      </Step>
      <Step n={3} title={M.s3} done={st.lines.length >= 2}>
        {M.s3t}
      </Step>
      <Step n={4} title={M.s4} done={!!found}>
        {found ? (
          <span className="text-emerald-300">
            <Sym>{M.s4found(fmt(found[0], 1, dec), fmt(found[1], 1, dec))}</Sym>
          </span>
        ) : (
          M.s4t
        )}
      </Step>
      <li className="rounded-xl border border-white/10 bg-black/25 p-3 text-[13px] leading-snug text-gray-300">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{M.checkTitle}</p>
        <p className="mt-1">
          <Sym>{geo.text}</Sym>
        </p>
        {check}
        <Btn icon={showGeo ? EyeOff : Eye} onClick={onGeo} className="mt-2.5 w-full min-h-10" aria-pressed={showGeo}>
          {showGeo ? M.hideGeo : M.showGeo}
        </Btn>
        {!shape.cInside && <p className="mt-2 text-xs text-amber-300/90">{M.outNote}</p>}
      </li>
    </FormulaPanel>
  );
}
