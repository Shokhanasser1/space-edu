import { useRef, useState } from 'react';
import { Lightbulb, Minimize2, Shrink, Square, Thermometer, Timer } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import { COL, CapArrow, Chip, GroupLabel, InfoBox, LabScene, Label, Panel, PlayControls, sci, sig } from './PascalLaw.parts';

/**
 * Tab 3 — where gas pressure comes from. Molecules fly about in a cylinder
 * and bounce off its walls and the piston; every bounce is a small push, and
 * the pushes on the piston are counted. Slide the piston in to halve the
 * volume: the same molecules are twice as crowded, hit the piston about
 * twice as often, and the gauge shows twice the pressure — at constant
 * temperature p·V stays the same (Boyle's law, kept qualitative-plus-numbers).
 *
 *   V₀ = 1.0 L (cylinder 50 cm² × 20 cm), p₀ = 100 kPa, T = 20 °C:
 *   V = 0.5 L → p = 200 kPa; V = 0.25 L → p = 400 kPa; p·V = 100 kPa·L.
 *
 * The model is an ideal gas in 2D: point molecules that do not collide with
 * one another, so each one hits the piston |vₓ|/(2l) times a second and the
 * average hit rate is exactly proportional to 1/V. Bounces keep the speed
 * (the walls keep the temperature: the piston moves slowly). 110 molecules
 * stand for ≈ 2.5·10²² in a real litre of air; their mean speed is drawn
 * ≈ 6 000 times slower than the real ≈ 460 m/s.
 */

const N = 110;
const L0 = 0.2; // m, cylinder length at V₀
const HH = 0.04; // m, inner half-height (Ø 8 cm ≈ 50 cm²)
const AREA_CM2 = 50;
const P0 = 100000; // Pa
const V0 = 1.0; // L
const MEAN_V = 0.075; // m/s on screen
const REAL_V = 460; // m/s, mean speed of air molecules at 20 °C
const PISTON_T = 0.012;
const BOX = { x0: -0.135, x1: 0.325, y0: -0.07, y1: 0.07 };
const GAUGE = { x: -0.077, y: 0, r: 0.047, max: 500000 };
const WINDOW = 6; // s, longest averaging window for the hit rate
const TRAIL = 46;
const PRESETS = [1, 0.5, 0.25];

/** Hits on the piston per second over the last `w` seconds. */
function measuredRate(g, w) {
  let count = 0;
  for (let i = g.hits.length - 1; i >= 0 && g.hits[i] >= g.t - w; i -= 1) count += 1;
  return count / w;
}

function rayleigh(mean) {
  const sigma = mean / Math.sqrt(Math.PI / 2);
  const u = Math.max(1e-6, Math.random());
  return Math.min(3.2 * sigma, sigma * Math.sqrt(-2 * Math.log(u)));
}

function makeGas(l) {
  const xs = new Float64Array(N);
  const ys = new Float64Array(N);
  const vx = new Float64Array(N);
  const vy = new Float64Array(N);
  for (let i = 0; i < N; i += 1) {
    xs[i] = Math.random() * l;
    ys[i] = (Math.random() * 2 - 1) * HH;
    const s = rayleigh(MEAN_V);
    const a = Math.random() * Math.PI * 2;
    vx[i] = s * Math.cos(a);
    vy[i] = s * Math.sin(a);
  }
  return { xs, ys, vx, vy, hits: [], flashes: [], trail: [], t: 0, since: 0 };
}

/** Long-run hit rate on the piston for this gas at length l: Σ|vₓ| / (2l). */
function expectedRate(g, l) {
  let s = 0;
  for (let i = 0; i < N; i += 1) s += Math.abs(g.vx[i]);
  return s / (2 * l);
}

export default function GasSim({ T }) {
  const Gt = T.gas;
  const dec = T.decimal;
  const gas = useRef(null);
  if (!gas.current) gas.current = makeGas(L0);
  const [V, setV] = useState(V0); // target volume, L
  const [l, setL] = useState(L0); // piston position, m
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [, setTick] = useState(0);
  const [points, setPoints] = useState([]); // measured (V, p) pairs
  const lT = (V / V0) * L0;
  const moving = Math.abs(l - lT) > 1e-5;

  useRafLoop(running, (dt) => {
    const g = gas.current;
    let len = l;
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let s = 0; s < n; s += 1) {
      // the piston approaches its target with a short damped motion
      if (Math.abs(len - lT) > 1e-5) {
        const step = clamp((lT - len) * 5 * h, -0.07 * h, 0.07 * h);
        len = Math.abs(lT - len) < 1e-5 ? lT : len + step;
        g.since = g.t;
      }
      g.t += h;
      for (let i = 0; i < N; i += 1) {
        let x = g.xs[i] + g.vx[i] * h;
        let y = g.ys[i] + g.vy[i] * h;
        if (x < 0) {
          x = -x;
          g.vx[i] = Math.abs(g.vx[i]);
        }
        if (x > len) {
          if (g.vx[i] > 0) {
            g.hits.push(g.t);
            g.flashes.push({ y, t: g.t });
            x = Math.max(0, 2 * len - x);
          } else x = len;
          g.vx[i] = -Math.abs(g.vx[i]);
        }
        if (y > HH) {
          y = 2 * HH - y;
          g.vy[i] = -Math.abs(g.vy[i]);
        } else if (y < -HH) {
          y = -2 * HH - y;
          g.vy[i] = Math.abs(g.vy[i]);
        }
        g.xs[i] = x;
        g.ys[i] = y;
      }
    }
    while (g.hits.length && g.hits[0] < g.t - WINDOW) g.hits.shift();
    while (g.flashes.length && g.flashes[0].t < g.t - 0.35) g.flashes.shift();
    g.trail.push([g.xs[0], g.ys[0]]);
    if (g.trail.length > TRAIL) g.trail.shift();
    if (len !== l) setL(len);
    // one measured (V, p) point per volume, refreshed twice a second once the average has run 3 s
    const w = Math.min(WINDOW, g.t - g.since);
    if (Math.abs(len - lT) <= 1e-5 && w >= 3 && g.t - (g.lastPoint ?? 0) > 0.5) {
      g.lastPoint = g.t;
      const r = measuredRate(g, w);
      const v = Math.round((len / L0) * V0 * 100) / 100;
      const pm = (P0 * r) / expectedRate(g, L0);
      setPoints((ps) => [...ps.filter((q) => q.v !== v), { v, p: pm }]);
    }
    setTick((k) => (k + 1) % 1000000);
  });

  /* ---- the measured hit rate since the piston last stopped */
  const g = gas.current;
  const win = Math.min(WINDOW, g.t - g.since);
  const rate = win >= 1 && !moving ? measuredRate(g, win) : null;
  const rate0 = expectedRate(g, L0);
  const pHits = rate !== null ? (P0 * rate) / rate0 : null;
  const Vnow = (l / L0) * V0;
  const p = (P0 * V0) / Vnow;
  const kComp = V0 / Vnow;

  const toggle = () => {
    setStarted(true);
    setRunning((r) => !r);
  };
  const reset = () => {
    gas.current = makeGas(L0);
    setV(V0);
    setL(L0);
    setRunning(false);
    setStarted(false);
    setPoints([]);
  };
  const pickV = (v) => {
    setV(v);
    if (!running) {
      // while the gas is not running the piston is set directly; molecules it passes are put back inside
      const gg = gas.current;
      const nl = (v / V0) * L0;
      for (let i = 0; i < N; i += 1) if (gg.xs[i] > nl) gg.xs[i] = Math.random() * nl;
      gg.since = gg.t;
      setL(nl);
    }
  };

  /* ---- words */
  let key = 'idle';
  if (!started) key = 'idle';
  else if (!running) key = 'paused';
  else if (moving) key = lT < l ? 'squeeze' : 'expand';
  else if (rate === null || win < 2) key = 'counting';
  else key = Math.abs(Vnow - V0) < 0.01 ? 'base' : 'compressed';
  const settled = useSettled(key, key === 'counting' || key === 'squeeze' || key === 'expand' ? 150 : 250);
  const ex = Gt.explain;
  const R1 = (v) => fmt(v, 1, dec);
  const kText = sig(kComp, 2, dec);
  const text = {
    idle: ex.idle,
    paused: ex.paused(sig(p / 1000, 3, dec)),
    squeeze: ex.squeeze,
    expand: ex.expand,
    counting: ex.counting,
    base: ex.base(rate !== null ? R1(rate) : '—', sig(p / 1000, 3, dec)),
    compressed: ex.compressed(kText, rate !== null ? R1(rate) : '—', R1(rate0), rate !== null ? sig(rate / rate0, 2, dec) : '—', sig(p / 1000, 3, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', paused: '#fbbf24', squeeze: '#fb923c', expand: '#60a5fa', counting: '#94a3b8', base: '#22d3ee', compressed: '#34d399' }[settled];

  const preset = PRESETS.find((v) => Math.abs(v - V) < 1e-9) ?? null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{Gt.presetsLabel}</GroupLabel>
          <Segmented
            label={Gt.presetsLabel}
            className="grid-cols-3"
            size="lg"
            value={preset}
            onChange={pickV}
            options={PRESETS.map((v, i) => ({ value: v, label: Gt.presets[i].name, sub: Gt.presets[i].sub, icon: [Square, Minimize2, Shrink][i] }))}
          />
        </div>
        <PlayControls labels={Gt.controls} running={running} done={false} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <GasScene T={T} g={g} l={l} p={p} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={Gt.readouts.V} symbol="V" value={sig(Vnow, 3, dec)} unit={T.L} accent={COL.depth} textColor={COL.depthText} sub={Gt.readouts.Vsub(AREA_CM2, sig(l * 100, 3, dec))} />
        <Readout label={Gt.readouts.p} symbol="p" value={sig(p / 1000, 3, dec)} unit={T.kPa} accent={COL.press} textColor={COL.pressText} sub={Gt.readouts.pSub(sig(Vnow, 3, dec))} active />
        <Readout
          label={Gt.readouts.hits}
          symbol="ν"
          value={rate !== null ? R1(rate) : '…'}
          unit={Gt.perS}
          accent={COL.gas}
          textColor={COL.gasText}
          sub={pHits !== null ? Gt.readouts.hitsSub(sig(pHits / 1000, 3, dec)) : Gt.readouts.hitsWait}
        />
        <Readout label={Gt.readouts.pV} symbol="p·V" value={sig((p / 1000) * Vnow, 3, dec)} unit={T.kPaL} accent="#e2e8f0" sub={Gt.readouts.pVsub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="pl-gasV"
            label={Gt.Vlabel}
            symbol="V"
            min={0.25}
            max={1}
            step={0.05}
            value={V}
            onChange={pickV}
            accent={COL.depth}
            display={`${sig(V, 3, dec)} ${T.L}`}
            hint={Gt.Vhint(sig(P0 * V0 / V / 1000, 3, dec))}
          />
          <InfoBox
            title={Gt.info.title}
            items={[
              [Gt.info.model, `${N}`, '#93c5fd'],
              [Gt.info.real, sci(2.5e22, 2, dec), '#e2e8f0'],
              [Gt.info.speed, `≈ ${REAL_V} ${T.ms}`, '#fdba74'],
            ]}
          >
            <p className="mt-2 text-[11px] leading-snug text-gray-500">{Gt.info.note}</p>
          </InfoBox>
        </Panel>
        <Panel className="lg:col-span-3">
          <PVGraph T={T} v={Vnow} p={p} points={points} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function GasScene({ T, g, l, p }) {
  const Gt = T.gas;
  return (
    <LabScene
      legend={[
        { color: COL.gas, label: Gt.legend.mol, kind: 'dot' },
        { color: COL.press, label: Gt.legend.hit, kind: 'ring' },
        { color: COL.press, label: Gt.legend.p, kind: 'arrow' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip icon={Timer}>{Gt.chip(sig(REAL_V / MEAN_V, 2, T.decimal))}</Chip>
          {!narrow && (
            <Chip icon={Thermometer} color="#f97316">
              {Gt.tChip}
            </Chip>
          )}
        </>
      )}
      height={(W, narrow) => (narrow ? clamp(W * 0.38 + 70, 220, 300) : 420)}
      ariaLabel={Gt.sceneLabel(sig((l / L0) * V0, 3, T.decimal), sig(p / 1000, 3, T.decimal))}
    >
      {(W, H, narrow) => <GasDrawing T={T} W={W} H={H} narrow={narrow} g={g} l={l} p={p} />}
    </LabScene>
  );
}

function GasDrawing({ T, W, H, narrow, g, l, p }) {
  const Gt = T.gas;
  const view = makeView(BOX, W, H, narrow ? { l: 6, r: 6, t: 40, b: 8 } : { l: 18, r: 18, t: 52, b: 14 });
  const k = view.k;
  const rpx = Math.max(narrow ? 2 : 2.6, 0.0017 * k);
  const wall = Math.max(4, 0.004 * k);
  const fs = narrow ? 10 : 12;
  const x0 = view.sx(0) - rpx; // inner face of the bottom (left wall)
  const xP = view.sx(l) + rpx; // inner face of the piston
  const yTop = view.sy(HH) - rpx;
  const yBot = view.sy(-HH) + rpx;
  const kp = (narrow ? 7 : 12) / 100000; // px per Pa
  const Lp = p * kp;

  /* gauge */
  const gx = view.sx(GAUGE.x);
  const gy = view.sy(GAUGE.y);
  const gr = GAUGE.r * k;
  const ang = (v) => ((225 - (270 * v) / GAUGE.max) * Math.PI) / 180;
  const needle = ang(Math.min(p, GAUGE.max * 1.02));

  return (
    <>
      {/* gas, walls, piston */}
      <rect x={x0} y={yTop} width={xP - x0} height={yBot - yTop} fill="#eff6ff" />
      {g.trail.length > 1 && (
        <polyline
          points={g.trail
            .filter(([x]) => x <= l)
            .map(([x, y]) => `${view.sx(x).toFixed(1)},${view.sy(y).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke="#a78bfa"
          strokeOpacity="0.6"
          strokeWidth="1.4"
        />
      )}
      {Array.from({ length: N }, (_, i) => (
        <circle key={i} cx={view.sx(g.xs[i])} cy={view.sy(g.ys[i])} r={rpx} fill={i === 0 ? '#7c3aed' : '#3b82f6'} stroke={i === 0 ? '#4c1d95' : '#1d4ed8'} strokeWidth="0.8" />
      ))}
      {g.flashes.map((f, i) => {
        const age = (g.t - f.t) / 0.35;
        return <circle key={i} cx={xP} cy={view.sy(f.y)} r={rpx + 2 + age * 9} fill="none" stroke={COL.press} strokeWidth={2 * (1 - age) + 0.4} opacity={1 - age} />;
      })}
      <rect x={x0 - wall} y={yTop - wall} width={view.sx(L0 + PISTON_T + 0.01) - x0 + wall} height={wall} fill="#64748b" />
      <rect x={x0 - wall} y={yBot} width={view.sx(L0 + PISTON_T + 0.01) - x0 + wall} height={wall} fill="#64748b" />
      <rect x={x0 - wall} y={yTop - wall} width={wall} height={yBot - yTop + 2 * wall} fill="#64748b" />
      <rect x={xP} y={yTop + 1} width={PISTON_T * k} height={yBot - yTop - 2} rx={2} fill="#334155" />
      <rect x={xP + PISTON_T * k} y={view.sy(0.003)} width={0.085 * k} height={0.006 * k} fill="#94a3b8" stroke="#64748b" strokeWidth="0.8" />
      <rect x={xP + PISTON_T * k + 0.085 * k} y={view.sy(0.03)} width={0.008 * k} height={0.06 * k} rx={3} fill="#475569" />

      {/* pressure arrows on the outside of every wall: equal length */}
      {[0.25, 0.5, 0.75].map((f) => {
        const x = x0 + (xP - x0) * f;
        return (
          <g key={f}>
            <CapArrow x={x} y={yTop - wall - 2} ux={0} uy={-1} len={Lp} cap={narrow ? 26 : 50} color={COL.press} width={narrow ? 1.8 : 2.2} head={narrow ? 6 : 8} />
            <CapArrow x={x} y={yBot + wall + 2} ux={0} uy={1} len={Lp} cap={narrow ? 26 : 50} color={COL.press} width={narrow ? 1.8 : 2.2} head={narrow ? 6 : 8} />
          </g>
        );
      })}
      {[0.55, -0.55].map((f) => (
        <g key={f}>
          <CapArrow x={xP + PISTON_T * k + 2} y={view.sy(f * HH)} ux={1} uy={0} len={Lp} cap={narrow ? 30 : 60} color={COL.press} width={narrow ? 1.8 : 2.2} head={narrow ? 6 : 8} />
          <CapArrow x={x0 - wall - 2} y={view.sy(f * HH)} ux={-1} uy={0} len={Lp} cap={Math.max(8, x0 - wall - 2 - (gx + Math.sqrt(Math.max(0, gr * gr - (f * HH * k) ** 2))) - 6)} color={COL.press} width={narrow ? 1.8 : 2.2} head={narrow ? 6 : 8} />
        </g>
      ))}

      {/* gauge */}
      <rect x={gx + gr - 2} y={gy - 2.5} width={x0 - wall - (gx + gr) + 4} height={5} fill="#94a3b8" />
      <circle cx={gx} cy={gy} r={gr + 4} fill="#475569" />
      <circle cx={gx} cy={gy} r={gr} fill="#ffffff" />
      {Array.from({ length: 11 }, (_, i) => i * 50000).map((v) => {
        const a = ang(v);
        const major = v % 100000 === 0;
        const r1 = gr * (major ? 0.8 : 0.86);
        return (
          <g key={v}>
            <line x1={gx + Math.cos(a) * r1} y1={gy - Math.sin(a) * r1} x2={gx + Math.cos(a) * gr * 0.95} y2={gy - Math.sin(a) * gr * 0.95} stroke="#334155" strokeWidth={major ? 1.8 : 1} />
            {major && gr > 40 && (
              <text x={gx + Math.cos(a) * gr * 0.64} y={gy - Math.sin(a) * gr * 0.64 + 4} textAnchor="middle" fontSize={Math.max(9, gr * 0.12)} fill="#334155">
                {v / 1000}
              </text>
            )}
          </g>
        );
      })}
      <line x1={gx + Math.cos(ang(P0)) * gr * 0.95} y1={gy - Math.sin(ang(P0)) * gr * 0.95} x2={gx + Math.cos(ang(P0)) * gr * 1.04} y2={gy - Math.sin(ang(P0)) * gr * 1.04} stroke={COL.gas} strokeWidth="2.5" />
      <line x1={gx - Math.cos(needle) * gr * 0.15} y1={gy + Math.sin(needle) * gr * 0.15} x2={gx + Math.cos(needle) * gr * 0.8} y2={gy - Math.sin(needle) * gr * 0.8} stroke="#dc2626" strokeWidth={Math.max(2, gr * 0.035)} strokeLinecap="round" />
      <circle cx={gx} cy={gy} r={Math.max(3, gr * 0.07)} fill="#1f2937" />
      {gr > 30 && (
        <text x={gx} y={gy + gr * 0.42} textAnchor="middle" fontSize={Math.max(10, gr * 0.15)} fontWeight="700" fill="#0f172a">
          {`${sig(p / 1000, 3, T.decimal)} ${T.kPa}`}
        </text>
      )}
      <Label x={gx} y={gy + gr + (narrow ? 14 : 20)} color={COL.muted} fs={fs} weight={600}>
        {Gt.gauge}
      </Label>
      <Label x={(x0 + xP) / 2} y={yBot + wall + Math.min(Lp, narrow ? 26 : 50) + (narrow ? 14 : 20)} color={COL.depth} fs={fs}>
        {`V = ${sig((l / L0) * V0, 3, T.decimal)} ${T.L}`}
      </Label>
    </>
  );
}

/* ================================================================= graph */

/** p against V: the hyperbola p = p₀V₀/V, the present state and the points measured from hits. */
function PVGraph({ T, v, p, points }) {
  const Gt = T.gas;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 210;
  const pad = { l: 46, r: 14, t: 20, b: 28 };
  const xMax = 1.1;
  const yMax = 450;
  const gx = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
  const gy = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);
  const curve = [];
  for (let x = 0.22; x <= xMax + 1e-9; x += 0.01) curve.push(`${gx(x).toFixed(1)},${gy((P0 / 1000) * (V0 / x)).toFixed(1)}`);
  const pk = p / 1000;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{Gt.graph.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: '#fdba74' }} /> {Gt.graph.law}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: '#93c5fd' }} /> {Gt.graph.measured}
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={Gt.graph.label(sig(v, 3, T.decimal), sig(pk, 3, T.decimal))} className="block">
          {[0, 100, 200, 300, 400].map((y) => (
            <g key={y}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(y)} y2={gy(y)} stroke={y === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(y) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {y}
              </text>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((x) => (
            <text key={x} x={gx(x)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(x, 2, T.decimal)}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {Gt.graph.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {Gt.graph.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          <polyline points={curve.join(' ')} fill="none" stroke="#fdba74" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x={gx(0)} y={gy(pk)} width={gx(v) - gx(0)} height={gy(0) - gy(pk)} fill="#fdba74" opacity="0.1" />
          <line x1={gx(v)} x2={gx(v)} y1={gy(pk)} y2={gy(0)} stroke="rgba(253,186,116,0.5)" strokeDasharray="3 4" />
          <line x1={gx(0)} x2={gx(v)} y1={gy(pk)} y2={gy(pk)} stroke="rgba(253,186,116,0.5)" strokeDasharray="3 4" />
          {points.map((q) => (
            <circle key={q.v} cx={gx(q.v)} cy={gy(clamp(q.p / 1000, 0, yMax))} r="5" fill="none" stroke="#93c5fd" strokeWidth="2" />
          ))}
          <circle cx={gx(v)} cy={gy(pk)} r="5.5" fill="#fb923c" stroke="#0b0b16" strokeWidth="1.5" />
          <text x={gx(v) + 9} y={gy(pk) - 8} fontSize="11.5" fontWeight="700" fill="#fed7aa">
            {Gt.graph.pv(sig(pk, 3, T.decimal), sig(v, 3, T.decimal), sig(pk * v, 3, T.decimal))}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{Gt.graph.note}</p>
    </div>
  );
}
