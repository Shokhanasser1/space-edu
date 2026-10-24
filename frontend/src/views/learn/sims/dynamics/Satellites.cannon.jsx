import { useMemo, useState } from 'react';
import { ArrowDownRight, Egg, Eraser, Lightbulb, Orbit, Pause, Play, Rocket, TrendingDown } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, groupThousands, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, TimeGraph, makeView } from '../kit/scene';
import { GM, R_E, R_KM, Caption, Label, Panel, Planet, SimScene, Tag, TimeChip, durationText, kmText, labelSize, sciAlways, stepText } from './Satellites.parts';
import { H0, R0, V1, V2, flight, stateAt } from './Satellites.flight';

/**
 * Newton's cannon. A body is fired horizontally from an imagined mountain
 * with no air; the only force is the Earth's gravity. Below 7.9 km/s it
 * falls back (further the faster it goes), at 7.9 km/s it circles the Earth,
 * between 7.9 and 11.2 km/s the orbit is an ellipse, at 11.2 km/s and above
 * it leaves for good. The flight is a numerical integration of a = −GM·r/r³
 * (see Satellites.flight.js); earlier shots stay on the paper, faded, as in
 * Newton's own drawing.
 */

const C = PALETTE;
const PRESETS = [
  { id: 'near', v: 6, icon: ArrowDownRight },
  { id: 'far', v: 7.8, icon: TrendingDown },
  { id: 'circle', v: 7.9, icon: Orbit },
  { id: 'ellipse', v: 9.5, icon: Egg },
  { id: 'escape', v: 11.2, icon: Rocket },
];
const EARTH_BOX = { x0: -1.12 * R_KM, x1: 1.12 * R_KM, y0: -1.08 * R_KM, y1: 1.18 * R_KM };
const IDLE = { shot: null, t: 0, running: false, done: false };
const TONE = {
  idle: '#22d3ee',
  fall: '#fb7185',
  land: '#fb7185',
  circle: '#a78bfa',
  ellipseFly: '#a78bfa',
  ellipse: '#a78bfa',
  away: '#a78bfa',
  escapeFly: '#34d399',
  escape: '#34d399',
};
const OLD = '#a78bfa';
const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const lerpBox = (a, b, u) => ({
  x0: a.x0 + (b.x0 - a.x0) * u,
  x1: a.x1 + (b.x1 - a.x1) * u,
  y0: a.y0 + (b.y0 - a.y0) * u,
  y1: a.y1 + (b.y1 - a.y1) * u,
});

export default function CannonSim({ T }) {
  const tx = T.cannon;
  const dec = T.decimal;
  const units = { s: T.s, min: T.common.min, h: T.h, day: T.common.day };
  const [v0, setV0] = useState(6);
  const [sim, setSim] = useState(IDLE);
  const [traces, setTraces] = useState([]);
  const [cam, setCam] = useState({ from: EARTH_BOX, to: EARTH_BOX, p: 1 });

  useRafLoop(sim.running || cam.p < 1, (dt) => {
    if (cam.p < 1) setCam((c) => ({ ...c, p: Math.min(1, c.p + dt / 0.8) }));
    setSim((p) => {
      if (!p.running || !p.shot) return p;
      const t = p.t + dt * p.shot.scale;
      if (p.shot.closed) return { ...p, t };
      if (t >= p.shot.duration) return { ...p, t: p.shot.duration, running: false, done: true };
      return { ...p, t };
    });
  });

  const box = lerpBox(cam.from, cam.to, ease(cam.p));
  const shot = sim.shot;

  const fire = (vKms) => {
    const f = flight(vKms * 1000);
    setTraces((tr) => {
      const keep = tr.filter((x) => x.v0 !== f.v0);
      if (shot && shot.v0 !== f.v0) keep.push(shot);
      return keep.slice(-5);
    });
    setSim({ shot: f, t: 0, running: true, done: false });
    setCam({ from: box, to: f.box, p: 0 });
  };
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setV0(p.v);
    fire(p.v);
  };
  const togglePause = () => setSim((p) => (p.shot && !p.done ? { ...p, running: !p.running } : p));
  const clear = () => {
    setTraces([]);
    setSim(IDLE);
    setCam({ from: box, to: EARTH_BOX, p: 0 });
  };

  /* ---- the body now */
  const lapDone = !!shot && shot.closed && sim.t >= shot.duration;
  const tt = shot ? (shot.closed ? sim.t % shot.duration : sim.t) : 0;
  const st = shot ? stateAt(shot, tt) : { x: 0, y: R0, vx: v0 * 1000, vy: 0, i: 0 };
  const r = Math.hypot(st.x, st.y);
  const speed = Math.hypot(st.vx, st.vy);
  const gHere = GM / (r * r);
  const alt = Math.max(0, r - R_E);

  /* ---- explanation */
  let key = 'idle';
  if (shot) {
    const k = shot.kind;
    if (k === 'land') key = sim.done ? 'land' : 'fall';
    else if (k === 'circle') key = lapDone || sim.t > shot.duration * 0.5 ? 'circle' : 'fall';
    else if (k === 'ellipse') key = lapDone || sim.t > shot.duration * 0.55 ? 'ellipse' : 'ellipseFly';
    else if (k === 'away') key = sim.done ? 'away' : 'ellipseFly';
    else key = sim.done ? 'escape' : 'escapeFly';
  }
  const settled = useSettled(key, 0);
  const ex = tx.explain;
  const vShot = shot ? shot.v0 / 1000 : v0;
  const vS = fmt(vShot, 1, dec);
  const apoText = shot && Number.isFinite(shot.apo) ? groupThousands((shot.apo - R_E) / 1000) : '';
  const perText = shot && Number.isFinite(shot.period) ? durationText(shot.period, units, dec) : '';
  const text = {
    idle: ex.idle,
    fall: ex.fall,
    land: shot ? ex.land(groupThousands(shot.landArc / 1000), vS) : '',
    circle: ex.circle(perText),
    ellipseFly: ex.ellipseFly,
    ellipse: ex.ellipse(apoText, perText),
    away: ex.away(apoText, perText),
    escapeFly: ex.escapeFly,
    escape: ex.escape(vS),
  }[settled];

  /* ---- outcome tile */
  const final = ['land', 'circle', 'ellipse', 'away', 'escape'].includes(key);
  let outName = tx.outcome.none;
  let outSub = tx.outcome.idleSub;
  if (shot && !final) {
    outName = tx.outcome.wait;
    outSub = tx.outcome.waitSub;
  } else if (shot) {
    outName = tx.outcome[key];
    outSub = {
      land: tx.outSub.land(groupThousands(shot.landArc / 1000)),
      circle: tx.outSub.circle(perText),
      ellipse: tx.outSub.ellipse(apoText, perText),
      away: tx.outSub.away(apoText, perText),
      escape: tx.outSub.escape,
    }[key];
  }

  /* ---- graph */
  const g = shot?.graph;
  const tUnit = g ? g.div : 1;
  const graphPts = g ? (lapDone ? g.pts : g.pts.filter((p) => p.x <= tt / tUnit + 1e-9).concat([{ x: tt / tUnit, y: alt / 1000 }])) : [];
  const xLabel = g ? tx.graph.x[g.unit] : tx.graph.x.s;

  const chipText = shot ? T.common.faster(groupThousands(shot.scale)) : tx.noAir;
  const legend = [
    { label: tx.legend.path, color: C.path, kind: 'line' },
    { label: tx.legend.old, color: OLD, kind: 'dash' },
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.acc, kind: 'arrow' },
  ];
  const presetValue = PRESETS.find((p) => Math.abs(p.v - v0) < 1e-6)?.id ?? null;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.presetsLabel}</p>
          <Segmented
            label={tx.presetsLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={presetValue}
            onChange={pickPreset}
            accent="#a78bfa"
            options={PRESETS.map((p) => ({ value: p.id, label: `${fmt(p.v, 1, dec)} ${T.common.kms}`, sub: tx.presets[p.id], icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 xl:flex">
          <Btn variant="primary" icon={Rocket} onClick={() => fire(v0)} className="min-h-[52px] text-[15px] xl:min-w-[132px]">
            {T.common.fire}
          </Btn>
          <Btn icon={sim.running ? Pause : Play} onClick={togglePause} disabled={!shot || sim.done} className="min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : T.common.resume}
          </Btn>
          <Btn icon={Eraser} onClick={clear} disabled={!shot && traces.length === 0} className="min-h-[52px] text-[15px]">
            {T.common.clear}
          </Btn>
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={<TimeChip text={chipText} />}
        ariaLabel={tx.sceneLabel(vS, kmText(alt / 1000, dec), final ? outName : '')}
        height={(W, narrow) => (narrow ? W * 1.08 : clamp(W * 0.5, 440, 560))}
      >
        {(W, H, narrow) => (
          <CannonDrawing W={W} H={H} narrow={narrow} box={box} shot={shot} st={st} lapDone={lapDone} done={sim.done} running={sim.running} traces={traces} tx={tx} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={TONE[settled]}>
        {text}
      </Explain>

      {/* readouts */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.v0}
          symbol="v₀"
          value={fmt(vShot, 1, dec)}
          unit={T.common.kms}
          accent="#a78bfa"
          textColor={C.pathText}
          sub={tx.readouts.v0Sub(fmt((vShot * 1000) / V1, 2, dec))}
        />
        <Readout label={tx.readouts.h} symbol="h" value={kmText(alt / 1000, dec)} unit={T.km} accent={C.disp} textColor={C.dispText} sub={tx.readouts.hSub(groupThousands(r / 1000))} />
        <Readout
          label={tx.readouts.v}
          symbol="v"
          value={fmt(speed / 1000, 2, dec)}
          unit={T.common.kms}
          accent={C.vel}
          textColor={C.velText}
          sub={tx.readouts.vSub(fmt(gHere, gHere < 1 ? 2 : 1, dec))}
        />
        <Readout label={tx.readouts.out} accent={TONE[settled]} active={final}>
          <p className="mt-1.5 text-lg sm:text-xl font-bold leading-tight text-white">{outName}</p>
          <p className="mt-auto pt-1.5 text-xs leading-snug text-gray-400 tabular-nums">{outSub}</p>
        </Readout>
      </div>

      {/* controls + graph */}
      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="space-y-3 lg:col-span-2">
          <RangeField
            id="sat-cannon-v0"
            label={tx.v0}
            symbol="v₀"
            min={1}
            max={12}
            step={0.1}
            value={v0}
            onChange={setV0}
            accent="#a78bfa"
            display={`${fmt(v0, 1, dec)} ${T.common.kms}`}
            hint={tx.v0Hint}
          />
          <SpeedScale v0={v0} shots={[...traces, ...(shot ? [shot] : [])]} tx={tx} T={T} />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[14px] leading-relaxed tabular-nums">
            <p>
              <span className="font-serif italic text-violet-200">v₁</span> <span className="text-gray-500">=</span>{' '}
              <span className="font-serif italic text-gray-200">√(GM/r₀)</span> <span className="text-gray-500">=</span>{' '}
              <span className="text-gray-300">√({sciAlways(GM, dec, 4)} / {sciAlways(R0, dec, 4)})</span> <span className="text-gray-500">≈</span>{' '}
              <span className="font-semibold text-white">
                {fmt(V1 / 1000, 1, dec)} {T.common.kms}
              </span>
            </p>
            <p>
              <span className="font-serif italic text-emerald-200">v₂</span> <span className="text-gray-500">=</span>{' '}
              <span className="font-serif italic text-gray-200">√(2GM/r₀) = √2·v₁</span> <span className="text-gray-500">≈</span>{' '}
              <span className="font-semibold text-white">
                {fmt(V2 / 1000, 1, dec)} {T.common.kms}
              </span>
            </p>
            <p className="mt-1 text-xs leading-snug text-gray-500">{tx.calcNote(groupThousands(R_KM), fmt(H0 / 1000, 0, dec))}</p>
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={tx.graph.title}
            series={[{ id: 'h', label: tx.graph.series, color: '#a78bfa', points: graphPts }]}
            xMax={g ? g.xMax : 1}
            yMax={g ? g.yMax : 20}
            xLabel={xLabel}
            yLabel={tx.graph.y}
            marker={g && lapDone ? tt / tUnit : undefined}
            decimal={dec}
            xDigits={g && g.xMax < 10 ? 1 : 0}
            yDigits={g && g.yMax < 10 ? 1 : 0}
            note={!shot ? tx.graph.idle : tx.graph.note[shot.kind]}
            ariaLabel={tx.graph.aria}
            height={236}
          />
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- speed scale */

function SpeedScale({ v0, shots, tx, T }) {
  const dec = T.decimal;
  const MAX = 12;
  const pct = (v) => clamp((v / MAX) * 100, 0, 100);
  const zones = [
    { id: 'fall', from: 0, to: V1 / 1000, color: '#fb7185' },
    { id: 'ellipse', from: V1 / 1000, to: V2 / 1000, color: '#8b5cf6' },
    { id: 'escape', from: V2 / 1000, to: MAX, color: '#10b981' },
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Caption>{tx.scale.title}</Caption>
      </div>
      <div className="relative mt-6 h-3">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {zones.map((z) => (
            <span key={z.id} style={{ width: `${pct(z.to) - pct(z.from)}%`, background: z.color, opacity: 0.85 }} />
          ))}
        </div>
        {[
          [V1 / 1000, 'v₁'],
          [V2 / 1000, 'v₂'],
        ].map(([v, s]) => (
          <span key={s} className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-gray-200" style={{ left: `${pct(v)}%` }}>
            {s} = {fmt(v, 1, dec)}
          </span>
        ))}
        {[V1 / 1000, V2 / 1000].map((v) => (
          <span key={v} className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded bg-white" style={{ left: `${pct(v)}%` }} />
        ))}
        {shots.map((s) => (
          <span
            key={s.v0}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900 bg-white/80"
            style={{ left: `${pct(s.v0 / 1000)}%` }}
          />
        ))}
        <span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-violet-400 bg-white shadow"
          style={{ left: `${pct(v0)}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[10px] text-gray-500 tabular-nums">
        {[0, 2, 4, 6, 8, 10, 12].map((v) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: `${pct(v)}%` }}>
            {v}
          </span>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
        {zones.map((z) => (
          <li key={z.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
            {tx.scale[z.id]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-slate-900 bg-white/80" />
          {tx.scale.shots}
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/**
 * World (metres) → screen. The summit is only 15.8 km high, far too small to
 * see next to the Earth, so the first 15.8 km above the ground are stretched
 * to M pixels; everything higher is drawn to scale, shifted out by M px.
 */
function makeMapper(cx, cy, k, Rp, M) {
  const h0 = H0 / 1000;
  const mapR = (rKm) => {
    if (rKm <= R_KM) return rKm * k;
    const a = rKm - R_KM;
    return a < h0 ? Rp + (M * a) / h0 : Rp + M + (a - h0) * k;
  };
  return (x, y) => {
    const rKm = Math.hypot(x, y) / 1000;
    if (rKm < 1e-6) return [cx, cy];
    const s = mapR(rKm) / rKm / 1000;
    return [cx + x * s, cy - y * s];
  };
}

function polyline(pts, P, upto = pts.length - 1, extra = null) {
  const out = [];
  for (let i = 0; i <= upto && i < pts.length; i += 1) {
    const [a, b] = P(pts[i].x, pts[i].y);
    out.push(`${a.toFixed(1)},${b.toFixed(1)}`);
  }
  if (extra) {
    const [a, b] = P(extra.x, extra.y);
    out.push(`${a.toFixed(1)},${b.toFixed(1)}`);
  }
  return out.join(' ');
}

/** Where a shot's label goes: its landing point, or the far end of its orbit, or where it left the view. */
function labelPoint(s) {
  if (s.ended === 'orbit') {
    let best = s.pts[0];
    for (const p of s.pts) if (p.y < best.y) best = p;
    return best;
  }
  return s.pts[s.pts.length - 1];
}

function CannonDrawing({ W, H, narrow, box, shot, st, lapDone, done, running, traces, tx, T }) {
  const dec = T.decimal;
  const pad = narrow ? { l: 12, r: 12, t: 46, b: 30 } : { l: 24, r: 24, t: 58, b: 34 };
  const view = makeView(box, W, H, pad);
  const k = view.k;
  const cx = view.sx(0);
  const cy = view.sy(0);
  const Rp = R_KM * k;
  const M = clamp(Rp * 0.12, 5, 24);
  const fs = narrow ? 11 : 12;
  const bx = { w: W, h: H };
  const P = makeMapper(cx, cy, k, Rp, M);

  const oldPaths = useMemo(() => {
    const mapper = makeMapper(cx, cy, k, Rp, M);
    return traces.map((s) => ({ s, d: polyline(s.pts, mapper) }));
  }, [traces, cx, cy, k, Rp, M]);

  /* labels of earlier shots, skipping any that would sit on another */
  const placed = [];
  const fits = (x, y, w, h) => {
    const okBox = x - w / 2 > 2 && x + w / 2 < W - 2 && y - h / 2 > 2 && y + h / 2 < H - 2;
    if (!okBox) return false;
    for (const q of placed) if (Math.abs(q.x - x) < (q.w + w) / 2 + 2 && Math.abs(q.y - y) < (q.h + h) / 2 + 1) return false;
    placed.push({ x, y, w, h });
    return true;
  };
  const oldLabels = [];
  for (const { s } of [...oldPaths].reverse()) {
    const lp = labelPoint(s);
    const [lx, ly] = P(lp.x, lp.y);
    const rr = Math.hypot(lx - cx, ly - cy) || 1;
    const text = `${fmt(s.v0 / 1000, 1, dec)} ${T.common.kms}`;
    const sz = labelSize(text, fs - 1);
    const off = s.ended === 'land' ? 16 + sz.w * 0.3 : 16;
    const x = lx + ((lx - cx) / rr) * off;
    const y = ly + ((ly - cy) / rr) * off;
    if (fits(x, y, sz.w, sz.h)) oldLabels.push({ key: s.v0, x, y, text });
  }

  /* current flight */
  const trail = shot ? (lapDone ? polyline(shot.pts, P) : polyline(shot.pts, P, st.i, st)) : '';
  const [px, py] = P(st.x, st.y);
  const speed = Math.hypot(st.vx, st.vy);
  const rNow = Math.hypot(st.x, st.y);
  const gNow = GM / (rNow * rNow);
  const vScale = narrow ? 5.5 : 7; // px per km/s
  const aScale = narrow ? 4 : 5; // px per m/s²
  const ux = speed > 0 ? st.vx / speed : 1;
  const uy = speed > 0 ? -st.vy / speed : 0;
  const ix = -st.x / rNow;
  const iy = st.y / rNow;
  const Lv = (speed / 1000) * vScale;
  const La = gNow * aScale;
  const ballR = narrow ? 4.5 : 5.5;
  const flying = !!shot && !done;
  const showBall = !!shot;

  /* mountain and cannon on top of the Earth (angle 90°) */
  const s = clamp(M / 22, 0.45, 1);
  const peakY = cy - Rp - M + 6 * s;
  const alpha = (M * 0.85) / Rp;
  const baseL = [cx - Rp * Math.sin(alpha), cy - Rp * Math.cos(alpha)];
  const baseR = [cx + Rp * Math.sin(alpha), cy - Rp * Math.cos(alpha)];
  const muzzle = [cx, cy - Rp - M];

  const step = niceStep(k, narrow ? 26 : 32);
  const cellText = T.common.cell(`${stepText(step, dec)} ${T.km}`);

  /* landing mark */
  let landMark = null;
  if (shot && done && shot.kind === 'land') {
    const e = shot.pts[shot.pts.length - 1];
    const [lx, ly] = P(e.x, e.y);
    const rr = Math.hypot(lx - cx, ly - cy) || 1;
    landMark = { x: lx, y: ly, tx: lx + ((lx - cx) / rr) * 22, ty: ly + ((ly - cy) / rr) * 22 - 2, text: `${groupThousands(shot.landArc / 1000)} ${T.km}` };
  }

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 26 : 32} />
      <Planet kind="earth" cx={cx} cy={cy} r={Rp} rot={0.35} />
      {Rp > 34 && <Tag x={cx} y={cy + 5} text={tx.earth} color="#1e3a8a" size={fs + 2} italic={false} />}

      {/* earlier shots */}
      {oldPaths.map(({ s: sh, d }) => (
        <polyline key={sh.v0} points={d} fill="none" stroke={OLD} strokeOpacity="0.55" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
      ))}
      {oldLabels.map((l) => (
        <Label key={l.key} x={l.x} y={l.y} text={l.text} bg="#fff" color="#5b21b6" border="#c4b5fd" size={fs - 1} box={bx} />
      ))}

      {/* mountain + cannon */}
      <path d={`M${baseL[0]},${baseL[1]} L${cx},${peakY} L${baseR[0]},${baseR[1]} Z`} fill="#a8a29e" stroke="#57534e" strokeWidth="1.2" strokeLinejoin="round" />
      <path
        d={`M${cx - (cx - baseL[0]) * 0.32},${peakY + (baseL[1] - peakY) * 0.32} L${cx},${peakY} L${cx + (baseR[0] - cx) * 0.32},${peakY + (baseR[1] - peakY) * 0.32} Z`}
        fill="#fff"
        stroke="#57534e"
        strokeWidth="0.8"
      />
      <g transform={`translate(${muzzle[0]} ${muzzle[1]}) scale(${s})`}>
        <rect x={-15} y={-2.8} width={15} height={5.6} rx={1.6} fill="#334155" stroke="#0f172a" strokeWidth="0.8" />
        <circle cx={-9} cy={4} r={3.4} fill="#78350f" stroke="#0f172a" strokeWidth="0.8" />
      </g>

      {/* current trajectory */}
      {trail && (
        <>
          <polyline points={trail} fill="none" stroke={C.path} strokeOpacity="0.16" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={trail} fill="none" stroke={C.path} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      {landMark && (
        <>
          <g stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round">
            <line x1={landMark.x - 5} y1={landMark.y - 5} x2={landMark.x + 5} y2={landMark.y + 5} />
            <line x1={landMark.x - 5} y1={landMark.y + 5} x2={landMark.x + 5} y2={landMark.y - 5} />
          </g>
          <Label x={landMark.tx} y={landMark.ty} text={landMark.text} bg="#e11d48" size={fs - 1} box={bx} />
        </>
      )}

      {/* vectors and the body */}
      {showBall && flying && (
        <>
          <Arrow x1={px + ix * (ballR + 2)} y1={py + iy * (ballR + 2)} x2={px + ix * (ballR + 2 + La)} y2={py + iy * (ballR + 2 + La)} color={C.acc} width={3} head={11} />
          <Arrow x1={px + ux * (ballR + 2)} y1={py + uy * (ballR + 2)} x2={px + ux * (ballR + 2 + Lv)} y2={py + uy * (ballR + 2 + Lv)} color={C.vel} width={3} head={11} />
          {Lv > 16 && <Tag x={px + ux * (ballR + 13 + Lv)} y={py + uy * (ballR + 13 + Lv) + 5} text="v" color={C.vel} size={fs + 3} />}
          {La > 14 && <Tag x={px + ix * (ballR + La) - ux * 13} y={py + iy * (ballR + La) - uy * 13 + 5} text="a" color={C.acc} size={fs + 3} />}
        </>
      )}
      {showBall && (
        <g>
          {running && <circle cx={px} cy={py} r={ballR + 6} fill={C.path} className="cl-pulse" />}
          <circle cx={px} cy={py} r={ballR} fill={C.ink} stroke="#fff" strokeWidth="2" />
        </g>
      )}
      {shot && shot.ended === 'away' && done && (
        <Label x={px} y={py - 20} text={shot.kind === 'escape' ? tx.leaves : tx.offView} bg={shot.kind === 'escape' ? '#059669' : '#7c3aed'} size={fs - 1} box={bx} />
      )}
      {!shot && <Label x={muzzle[0]} y={muzzle[1] - 26} text={tx.cannon} bg={C.ink} size={fs - 1} box={bx} />}

      <text x={12} y={H - 12} fontSize={fs - 1} fill={C.muted}>
        {narrow ? tx.mountainShort : tx.mountain(fmt(H0 / 1000, 0, dec))}
      </text>
      <text x={W - 12} y={H - 12} textAnchor="end" fontSize={fs - 1} fill={C.muted}>
        {cellText}
      </text>
    </g>
  );
}

