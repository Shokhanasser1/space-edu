import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Lightbulb } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import {
  AngleArc,
  Chip,
  DarkGraph,
  FC,
  ForceArrow,
  ForceScale,
  Formula,
  G,
  GroupLabel,
  Ground,
  LabScene,
  Panel,
  PlayControls,
  SvgSym,
  Sym,
  TagPill,
  WC,
  niceCeil,
  num,
  rad,
  signKey,
  signed,
} from './MechanicalWork.parts';

/**
 * Tab 4 — the work of gravity does not depend on the path. Three bodies of
 * the same mass go down (or up) the same height h along three paths, all
 * moved at the same steady speed v = h/2 per second:
 *   straight down (length h):            A = mg·h
 *   a smooth ramp, β = 30° (length 2h):   A = mg·sinβ·l = mg·0.5·2h = mg·h
 *   stairs, 5 steps (length 2.5h):        treads ⊥ mg → 0, risers add mg·Δh → mg·h
 * Preset m = 2 kg, h = 5 m: A = 2·9.8·5 = 98 J on every path (−98 J going up).
 */

const BETA = 30;
const STEPS = 5;
const TREAD = 0.3; // × h
const PATHS = ['drop', 'ramp', 'stairs'];
const PATH_COL = { drop: '#38bdf8', ramp: '#a78bfa', stairs: '#fbbf24' };
const IDLE = { t: 0, running: false, done: false };

/** World geometry for height h: each lane's path from its top start to its bottom end. */
function lanes(h) {
  const run = h / Math.tan(rad(BETA));
  const xd = 0.72 * h;
  const xr = 1.05 * h;
  const xs = xr + run + 0.34 * h;
  const w = TREAD * h;
  const d = h / STEPS;
  const stairs = [{ x: xs, y: h }];
  for (let i = 1; i <= STEPS; i += 1) {
    stairs.push({ x: xs + i * w, y: h - (i - 1) * d });
    stairs.push({ x: xs + i * w, y: h - i * d });
  }
  const mk = (pts) => {
    const cum = [0];
    for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { pts, cum, len: cum[cum.length - 1] };
  };
  return {
    drop: mk([
      { x: xd, y: h },
      { x: xd, y: 0 },
    ]),
    ramp: mk([
      { x: xr, y: h },
      { x: xr + run, y: 0 },
    ]),
    stairs: mk(stairs),
    xd,
    xr,
    run,
    xs,
    w,
    width: xs + STEPS * w + 0.22 * h,
  };
}

/** The point at distance l from the start of a path (with the segment's unit direction). */
function pointAt(path, l) {
  const { pts, cum, len } = path;
  const d = clamp(l, 0, len);
  for (let i = 1; i < pts.length; i += 1) {
    if (d <= cum[i] + 1e-9) {
      const seg = cum[i] - cum[i - 1] || 1;
      const f = (d - cum[i - 1]) / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
        ux: (pts[i].x - pts[i - 1].x) / seg,
        uy: (pts[i].y - pts[i - 1].y) / seg,
        i,
      };
    }
  }
  const n = pts.length - 1;
  return { ...pts[n], ux: 0, uy: -1, i: n };
}

/** Where a body is after covering distance l, going down (from the start) or up (from the end). */
function bodyAt(path, l, dir) {
  if (dir === 'down') return pointAt(path, l);
  const p = pointAt(path, path.len - l);
  return { ...p, ux: -p.ux, uy: -p.uy };
}

const colOf = (k) => ({ pos: WC.pos, zero: WC.zero, neg: WC.neg })[k];
const textOf = (k) => ({ pos: WC.posText, zero: WC.zeroText, neg: WC.negText })[k];

/* ==================================================================== sim */

export default function GravitySim({ T }) {
  const L = T.gravity;
  const dec = T.decimal;
  const [m, setM] = useState(2);
  const [h, setH] = useState(5);
  const [dir, setDir] = useState('down');
  const [sim, setSim] = useState(IDLE);
  const geo = useMemo(() => lanes(h), [h]);
  const v = h / 2;
  const tEnd = geo.stairs.len / v;
  const mg = m * G;
  const mgh = mg * h;
  const lNow = v * sim.t;
  const sgn = dir === 'down' ? 1 : -1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const change = (fn) => (val) => {
    fn(val);
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const work = {};
  for (const id of PATHS) {
    const b = bodyAt(geo[id], Math.min(lNow, geo[id].len), dir);
    work[id] = mg * ((dir === 'down' ? h : 0) - b.y);
  }

  /* ---- explanation */
  const J = (n) => signed(n, 0, dec);
  const finished = PATHS.filter((id) => lNow >= geo[id].len - 1e-9);
  let key;
  if (sim.done) key = `done_${dir}`;
  else if (sim.t === 0 && !sim.running) key = 'intro';
  else if (finished.includes('ramp')) key = 'rampDone';
  else if (finished.includes('drop')) key = 'dropDone';
  else key = `run_${dir}`;
  const settled = useSettled(key, 120);
  const ex = L.explain;
  const H1 = fmt(h, 1, dec);
  const text = {
    intro: ex.intro,
    run_down: ex.run_down(H1),
    run_up: ex.run_up(H1),
    dropDone: ex.dropDone(J(sgn * mgh)),
    rampDone: ex.rampDone(J(sgn * mgh), fmt(geo.ramp.len, 1, dec), fmt(mg * Math.sin(rad(BETA)), 1, dec)),
    done_down: ex.done_down(J(mgh), H1),
    done_up: ex.done_up(J(-mgh), H1),
  }[settled];
  const tone = settled.startsWith('done') ? colOf(dir === 'down' ? 'pos' : 'neg') : settled === 'intro' ? '#22d3ee' : dir === 'down' ? WC.posText : WC.negText;

  const mgS = fmt(mg, 1, dec);
  const minus = dir === 'down' ? '' : '−';
  const derive = {
    drop: `${minus}mg·h = ${minus}${mgS}·${H1}`,
    ramp: `${minus}mg·sinβ·l = ${minus}${mgS}·${num(Math.sin(rad(BETA)), 1, dec)}·${fmt(geo.ramp.len, 1, dec)}`,
    stairs: `${minus}mg·ΣΔh = ${minus}${mgS}·${STEPS}·${fmt(h / STEPS, 1, dec)}`,
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>
            {L.dirLabel} <span className="normal-case tracking-normal text-gray-500">· {L.base(m, H1)}</span>
          </GroupLabel>
          <Segmented
            label={L.dirLabel}
            className="grid-cols-2"
            size="lg"
            value={dir}
            onChange={(d) => {
              setDir(d);
              setSim(IDLE);
            }}
            options={[
              { value: 'down', label: L.dirs.down.name, sub: L.dirs.down.sub, icon: ArrowDown },
              { value: 'up', label: L.dirs.up.name, sub: L.dirs.up.sub, icon: ArrowUp },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <GravityScene T={T} geo={geo} h={h} m={m} dir={dir} lNow={lNow} t={sim.t} v={v} work={work} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {PATHS.map((id) => {
          const k = signKey(work[id]);
          return (
            <Readout
              key={id}
              label={L.lanes[id]}
              symbol={<Sym>{`A_{${L.short[id]}}`}</Sym>}
              value={J(work[id])}
              unit={T.J}
              accent={PATH_COL[id]}
              textColor={textOf(k)}
              sub={
                <>
                  <span className="block font-serif italic text-gray-300">
                    <Sym>{derive[id]}</Sym>
                  </span>
                  {L.lenSub(fmt(geo[id].len, 1, dec))}
                </>
              }
              active={sim.running && lNow < geo[id].len}
            />
          );
        })}
        <Readout label={L.readouts.mgh} symbol={dir === 'down' ? 'mgh' : '−mgh'} value={J(sgn * mgh)} unit={T.J} accent={colOf(dir === 'down' ? 'pos' : 'neg')} textColor="#fff" sub={L.mghSub(m, fmt(mg, 1, dec), H1)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField id="mw-vm" label={L.m} symbol="m" min={1} max={10} step={1} value={m} onChange={change(setM)} accent={FC.weight} display={`${m} ${T.kg}`} hint={L.mHint(fmt(mg, 1, dec))} />
          <RangeField
            id="mw-vh"
            label={L.h}
            symbol="h"
            min={1}
            max={10}
            step={0.5}
            value={h}
            onChange={change(setH)}
            accent="#22d3ee"
            display={`${fmt(h, 1, dec)} ${T.m}`}
            hint={L.hHint(fmt(geo.drop.len, 1, dec), fmt(geo.ramp.len, 1, dec), fmt(geo.stairs.len, 1, dec))}
          />
          <RulePanel T={T} h={h} geo={geo} />
        </Panel>
        <Panel className="lg:col-span-3">
          <PathGraph T={T} geo={geo} mg={mg} h={h} dir={dir} lNow={lNow} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function GravityScene({ T, geo, h, m, dir, lNow, t, v, work, running }) {
  const L = T.gravity;
  const dec = T.decimal;
  const S = T.sym;
  const wk = dir === 'down' ? 'pos' : 'neg';
  const lmaxOf = (narrow) => (narrow ? 26 : 40);
  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.mg, kind: 'arrow' },
        { color: colOf(wk), label: L.legend.work, kind: 'line' },
        { color: '#94a3b8', label: L.legend.none, kind: 'line' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip>
            {L.chipSpeed(fmt(v, 1, dec))} · t = {fmt(t, 1, dec)} {T.s}
          </Chip>
          <ForceScale kF={lmaxOf(narrow) / (m * G)} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => (narrow ? 270 : clamp(W * 0.4, 380, 450))}
      ariaLabel={L.sceneLabel(fmt(h, 1, dec), m, signed(work.drop, 0, dec), signed(work.ramp, 0, dec), signed(work.stairs, 0, dec))}
    >
      {(W, H, narrow) => {
        const top = narrow ? 70 : 152;
        const bottom = narrow ? 52 : 64;
        const view = makeView({ x0: narrow ? -0.18 * h : 0, x1: geo.width, y0: 0, y1: h }, W, H, { l: narrow ? 8 : 14, r: narrow ? 8 : 14, t: top, b: bottom });
        const { sx, sy } = view;
        const fs = narrow ? 10.5 : 12.5;
        const box = { w: W, h: H };
        const floorY = sy(0);
        const bs = narrow ? 13 : 22; // body size, px
        const lmax = lmaxOf(narrow);
        const traceCol = colOf(wk);

        /* height ruler on the left */
        const rx = sx(0.24 * h);
        const ruler = [];
        const step = h <= 2 ? 0.5 : h <= 5 ? 1 : 2;
        for (let y = 0; y <= h + 1e-9; y += step) {
          ruler.push(<line key={`t${y}`} x1={rx - 5} x2={rx} y1={sy(y)} y2={sy(y)} stroke="#475569" strokeWidth="1.2" />);
          if (!narrow || Math.abs(y - h) < 1e-9 || y === 0)
            ruler.push(
              <text key={`n${y}`} x={rx - 8} y={sy(y) + 4} textAnchor="end" fontSize={fs - 2} fill="#64748b">
                {fmt(y, Number.isInteger(y) ? 0 : 1, dec)}
              </text>,
            );
        }

        /* the traced part of a path, coloured where gravity does work */
        const trace = (path) => {
          const out = [];
          const { pts, cum, len } = path;
          const lo = dir === 'down' ? 0 : len - Math.min(lNow, len);
          const hi = dir === 'down' ? Math.min(lNow, len) : len;
          for (let i = 1; i < pts.length; i += 1) {
            const a = Math.max(cum[i - 1], lo);
            const b = Math.min(cum[i], hi);
            if (b - a < 1e-9) continue;
            const p0 = pointAt(path, a);
            const p1 = pointAt(path, b);
            const flat = Math.abs(pts[i].y - pts[i - 1].y) < 1e-9;
            out.push(
              <line
                key={i}
                x1={sx(p0.x)}
                y1={sy(p0.y)}
                x2={sx(p1.x)}
                y2={sy(p1.y)}
                stroke={flat ? '#94a3b8' : traceCol}
                strokeWidth={flat ? 3 : 4.5}
                strokeLinecap="round"
                opacity={flat ? 0.9 : 1}
              />,
            );
          }
          return out;
        };
        const guide = (path) => (
          <polyline points={path.pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke="#94a3b8" strokeWidth="1.3" strokeDasharray="4 5" />
        );

        /*
         * A body on its path, with mg from its centre. The path carries the
         * bottom centre on the ramp and the drop, and the bottom-left corner on
         * the stairs (so the box hugs each riser and never cuts into a step).
         */
        const bodyCentre = (id, bx, by) => {
          if (id === 'ramp') return { x: bx + Math.sin(rad(BETA)) * (bs / 2), y: by - Math.cos(rad(BETA)) * (bs / 2) };
          if (id === 'stairs') return { x: bx + bs / 2, y: by - bs / 2 };
          return { x: bx, y: by - bs / 2 };
        };
        const body = (id) => {
          const path = geo[id];
          const p = bodyAt(path, Math.min(lNow, path.len), dir);
          const tilt = id === 'ramp' ? BETA : 0;
          const c = bodyCentre(id, sx(p.x), sy(p.y));
          const moving = running && lNow < path.len;
          return (
            <g key={`b${id}`}>
              {moving && <rect x={c.x - bs / 2 - 4} y={c.y - bs / 2 - 4} width={bs + 8} height={bs + 8} rx={6} fill="#f59e0b" className="cl-pulse" opacity="0.25" transform={`rotate(${tilt} ${c.x} ${c.y})`} />}
              <rect x={c.x - bs / 2} y={c.y - bs / 2} width={bs} height={bs} rx={3} fill="#fcd9a8" stroke="#b7791f" strokeWidth="1.8" transform={`rotate(${tilt} ${c.x} ${c.y})`} />
              <ForceArrow x={c.x} y={c.y} dx={0} dy={lmax} color={FC.weight} width={narrow ? 2.2 : 2.8} head={narrow ? 7 : 9} label={narrow ? null : S.mg} fs={fs - 1} box={box} labelAt={{ x: c.x + 6, y: c.y + lmax, anchor: 'start' }} />
              <circle cx={c.x} cy={c.y} r={2.4} fill="#0f172a" />
            </g>
          );
        };

        /* structures */
        const crane = (() => {
          const px = sx(geo.xd - 0.2 * h);
          const ax = sx(geo.xd);
          const ay = sy(h) - bs - (narrow ? 12 : 22);
          const b = bodyAt(geo.drop, Math.min(lNow, geo.drop.len), dir);
          const ropeEnd = sy(b.y) - bs;
          return (
            <g>
              <line x1={px} x2={px} y1={floorY} y2={ay} stroke="#64748b" strokeWidth={narrow ? 3 : 4} />
              <line x1={px - 2} x2={ax + 6} y1={ay} y2={ay} stroke="#64748b" strokeWidth={narrow ? 3 : 4} />
              <circle cx={ax} cy={ay + 4} r={narrow ? 3 : 5} fill="#fff" stroke="#475569" strokeWidth="1.6" />
              <line x1={ax} x2={ax} y1={ay + 4} y2={ropeEnd} stroke="#a16207" strokeWidth="1.5" />
            </g>
          );
        })();
        const wedge = `M${sx(geo.xr)},${floorY} L${sx(geo.xr)},${sy(h)} L${sx(geo.xr + geo.run)},${floorY} Z`;
        const stairsPoly = [`${sx(geo.xs)},${floorY}`, ...geo.stairs.pts.map((p) => `${sx(p.x)},${sy(p.y)}`)].join(' ');

        const laneX = { drop: sx(geo.xd), ramp: sx(geo.xr + geo.run / 2), stairs: sx(geo.xs + (STEPS * geo.w) / 2) };
        const titleY = sy(h) - (narrow ? 34 : 46);

        /* ramp: mg split along and across the slope (desktop only) */
        const rampBody = bodyAt(geo.ramp, Math.min(lNow, geo.ramp.len), dir);
        const rc = bodyCentre('ramp', sx(rampBody.x), sy(rampBody.y));
        const sb = Math.sin(rad(BETA));
        const cb = Math.cos(rad(BETA));
        const along = { x: lmax * sb * cb, y: lmax * sb * sb };
        return (
          <>
            <Ground W={W} y={floorY} depth={H - floorY} />
            <line x1={rx} x2={W - 6} y1={sy(h)} y2={sy(h)} stroke="#0891b2" strokeWidth="1.2" strokeDasharray="6 5" opacity="0.7" />
            <line x1={rx} x2={rx} y1={floorY} y2={sy(h)} stroke="#475569" strokeWidth="1.4" />
            {ruler}
            <text x={rx - 8} y={sy(h) - (narrow ? 10 : 14)} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#0e7490">
              h = {fmt(h, 1, dec)} {T.m}
            </text>

            {crane}
            <path d={wedge} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
            <polygon points={stairsPoly} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
            {!narrow && <AngleArc cx={sx(geo.xr + geo.run)} cy={floorY} r={30} from={Math.PI} to={Math.PI + rad(BETA)} label={`β = ${BETA}°`} color="#475569" fs={fs - 1} labelR={62} />}

            {PATHS.map((id) => (
              <g key={`g${id}`}>{guide(geo[id])}</g>
            ))}
            {PATHS.map((id) => (
              <g key={`t${id}`}>{trace(geo[id])}</g>
            ))}

            {!narrow && (
              <>
                <ForceArrow x={rc.x} y={rc.y} dx={along.x} dy={along.y} color={FC.weight} width={1.8} head={7} dash="4 3" opacity={0.8} />
                <ForceArrow x={rc.x} y={rc.y} dx={lmax * cb * sb * -1} dy={lmax * cb * cb} color={FC.weight} width={1.8} head={7} dash="4 3" opacity={0.4} />
                <SvgSym x={rc.x + along.x + 6} y={rc.y + along.y - 4} text={S.mgx} color={FC.weight} fs={fs - 2} anchor="start" weight={600} />
              </>
            )}
            {PATHS.map((id) => body(id))}

            {PATHS.map((id) => (
              <g key={`l${id}`}>
                <TagPill x={laneX[id]} y={titleY} text={narrow ? L.short2[id] : `${L.lanes[id]} · l = ${fmt(geo[id].len, 1, dec)} ${T.m}`} bg={PATH_COL[id]} color="#0f172a" fs={fs - 1} box={box} />
                <TagPill
                  x={laneX[id]}
                  y={floorY + (narrow ? 20 : 26)}
                  text={`A = ${signed(work[id], 0, dec)} ${T.J}`}
                  bg={{ pos: WC.posInk, zero: WC.zeroInk, neg: WC.negInk }[signKey(work[id])]}
                  fs={fs - 0.5}
                  box={box}
                />
              </g>
            ))}
          </>
        );
      }}
    </LabScene>
  );
}

/* ================================================================== rule */

function RulePanel({ T, h, geo }) {
  const L = T.gravity.proof;
  const dec = T.decimal;
  return (
    <div className="space-y-2">
      <Formula sym={L.rule} nums={L.ruleNote} />
      <ul className="space-y-1.5 text-[12.5px] leading-snug text-gray-400">
        {PATHS.map((id) => (
          <li key={id} className="flex gap-2">
            <span className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PATH_COL[id] }} aria-hidden="true" />
            <span>
              <b className="font-semibold text-gray-200">{L.rows[id]}:</b> <Sym>{L.notes[id](fmt(geo.ramp.len, 1, dec), fmt(h, 1, dec))}</Sym>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================ graph */

function PathGraph({ T, geo, mg, h, dir, lNow }) {
  const L = T.gravity.graph;
  const dec = T.decimal;
  const sgn = dir === 'down' ? 1 : -1;
  const top = niceCeil(mg * h);
  const series = useMemo(() => {
    const out = {};
    for (const id of PATHS) {
      const path = geo[id];
      const pts = [];
      const n = id === 'stairs' ? 400 : 60;
      for (let i = 0; i <= n; i += 1) {
        const l = (path.len * i) / n;
        const b = bodyAt(path, l, dir);
        pts.push({ x: l, y: mg * ((dir === 'down' ? h : 0) - b.y) });
      }
      out[id] = pts;
    }
    return out;
  }, [geo, mg, h, dir]);
  const xStep = [0.5, 1, 2, 5, 10].find((st) => geo.stairs.len / st <= 7) ?? 10;
  const xMax = Math.ceil(geo.stairs.len / xStep - 1e-9) * xStep;
  const xTicks = [];
  for (let v = 0; v <= xMax + 1e-9; v += xStep) xTicks.push(v);
  const cut = (pts) => {
    const c = pts.filter((p) => p.x <= lNow + 1e-9);
    return c.length ? c : [pts[0]];
  };
  return (
    <DarkGraph
      title={L.title}
      series={[
        ...PATHS.map((id) => ({ id: `${id}-all`, color: `${PATH_COL[id]}55`, points: series[id], dash: '4 5', dot: false, width: 1.6 })),
        ...PATHS.map((id) => ({ id, label: L.lines[id], color: PATH_COL[id], points: cut(series[id]) })),
      ]}
      xMax={xMax}
      xTicks={xTicks}
      yMin={sgn > 0 ? 0 : -top}
      yMax={sgn > 0 ? top : 0}
      xLabel={L.x}
      yLabel={L.y}
      marker={lNow > 0 ? Math.min(lNow, xMax) : undefined}
      decimal={dec}
      height={300}
      xDigits={xStep < 1 ? 1 : 0}
      note={L.note(signed(sgn * mg * h, 0, dec))}
    />
  );
}
