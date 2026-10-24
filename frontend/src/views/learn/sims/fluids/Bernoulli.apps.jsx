import { useMemo, useState } from 'react';
import { Home, Lightbulb, Plane, Ruler, Sailboat, StickyNote, Timer } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GroupLabel, InfoBox, LabScene, LineGraph, PR, PlayControls, Rich, fmtP, plain, pts } from './Bernoulli.parts';
import { CHORD_UNITS, pressureGrid, wingStreamlines, wingSurface } from './Bernoulli.foil';
import { BoatsLab, PaperLab, RoofLab } from './Bernoulli.pairs';

/**
 * Tab 3 — applications of Bernoulli's law. A mode switch picks the
 * experiment: a wing in a stream (this file), two sheets of paper, two
 * boats and a roof in a storm (Bernoulli.pairs.jsx). All share the play /
 * reset buttons; Reset remounts the experiment with its defaults.
 *
 * Wing: ideal flow past a cambered Joukowski section (Bernoulli.foil.js) of
 * a light plane — wing area S = 16 m², mass 1000 kg (mg = 9.8 kN), chord
 * 1.6 m, air ρ = 1.2 kg/m³. The mean (rms) speeds above and below the wing
 * give Δp = ρ(v_top² − v_bottom²)/2 and the simple estimate F ≈ Δp·S.
 * Preset v = 30 m/s, α = 6°: v_top ≈ 40.4 m/s, v_bottom ≈ 24.7 m/s,
 * Δp ≈ 616 Pa, F ≈ 9.9 kN ≈ mg — level flight.
 */

const RHO_AIR = 1.2;
const G = 9.8;
const S_WING = 16;
const M_PLANE = 1000;
const CHORD_M = 1.6;
const Z_UNIT = CHORD_M / CHORD_UNITS; // metres per airfoil unit
const SLOW = 1 / 50;
const P_SCALE = 600; // Pa at full colour
const DEG = Math.PI / 180;

const MODES = [
  { id: 'wing', icon: Plane },
  { id: 'paper', icon: StickyNote },
  { id: 'boats', icon: Sailboat },
  { id: 'roof', icon: Home },
];

export default function AppsSim({ T }) {
  const t = T.apps;
  const [mode, setMode] = useState('wing');
  const [running, setRunning] = useState(true);
  const [gen, setGen] = useState(0);
  const pick = (m) => {
    setMode(m);
    setRunning(true);
  };
  const reset = () => {
    setGen((g) => g + 1);
    setRunning(true);
  };
  const toolbar = (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      <div className="min-w-0 flex-1">
        <GroupLabel>{t.modesLabel}</GroupLabel>
        <Segmented
          label={t.modesLabel}
          className="grid-cols-2 md:grid-cols-4"
          size="lg"
          value={mode}
          onChange={pick}
          options={MODES.map((m) => ({ value: m.id, label: t.modes[m.id].name, sub: t.modes[m.id].sub, icon: m.icon }))}
        />
      </div>
      <PlayControls labels={T.common} running={running} started onToggle={() => setRunning((r) => !r)} onReset={reset} />
    </div>
  );
  const k = `${mode}-${gen}`;
  return (
    <div className="space-y-3 sm:space-y-4">
      {toolbar}
      {mode === 'wing' && <WingLab key={k} T={T} running={running} />}
      {mode === 'paper' && <PaperLab key={k} T={T} running={running} />}
      {mode === 'boats' && <BoatsLab key={k} T={T} running={running} />}
      {mode === 'roof' && <RoofLab key={k} T={T} running={running} />}
    </div>
  );
}

/* ================================================================== wing */

function WingLab({ T, running }) {
  const t = T.apps.wing;
  const dec = T.decimal;
  const [v, setV] = useState(30);
  const [alpha, setAlpha] = useState(6);
  const [sim, setSim] = useState({ D: 0 });
  useRafLoop(running && v > 0, (dt) => setSim((p) => ({ D: p.D + (v / Z_UNIT) * dt * SLOW })));

  const surf = useMemo(() => wingSurface(alpha * DEG), [alpha]);
  const vTop = surf.vTop * v;
  const vBot = surf.vBot * v;
  const q = (RHO_AIR * v * v) / 2;
  const dp = (RHO_AIR * (vTop * vTop - vBot * vBot)) / 2;
  // the estimate is made from the rounded Δp shown on screen, so 616 · 16 = 9.86 kN checks by hand
  const F = Math.round(dp) * S_WING;
  const mg = M_PLANE * G;

  let key;
  if (v < 1) key = 'still';
  else if (F < 0.95 * mg) key = 'low';
  else if (F <= 1.05 * mg) key = 'level';
  else key = 'lift';
  const shown = useSettled(key, 350);
  const ex = t.explain;
  const base = ex.base(fmt(vTop, 1, dec), fmt(vBot, 1, dec), fmtP(dp));
  const kN = (x) => fmt(x / 1000, 2, dec);
  const text =
    {
      still: ex.still,
      low: `${base} ${ex.low(kN(F), kN(mg))}`,
      level: `${base} ${ex.level(kN(F), kN(mg))}`,
      lift: `${base} ${ex.lift(kN(F), kN(mg))}`,
    }[shown] ?? ex.still;
  const tone = { still: '#94a3b8', low: '#fb923c', level: '#34d399', lift: '#22d3ee' }[shown] ?? '#22d3ee';

  /* pressure along the chord */
  const graph = useMemo(() => {
    const top = surf.profile.filter((_, i) => i % 4 === 0).map((p) => ({ x: p.s * CHORD_M, y: q * (1 - p.vt * p.vt) }));
    const bot = surf.profile.filter((_, i) => i % 4 === 0).map((p) => ({ x: p.s * CHORD_M, y: q * (1 - p.vb * p.vb) }));
    return { top, bot };
  }, [surf, q]);
  const gMin = Math.min(-50, ...graph.top.map((p) => p.y));
  const gMax = Math.max(50, ...graph.bot.map((p) => p.y), ...graph.top.map((p) => p.y));

  return (
    <>
      <WingScene
        T={T}
        v={v}
        alpha={alpha}
        surf={surf}
        D={sim.D}
        F={F}
        mg={mg}
        vTop={vTop}
        vBot={vBot}
        ariaLabel={plain(t.scene.aria(fmt(v, 0, dec), fmt(alpha, 0, dec), fmt(vTop, 1, dec), fmt(vBot, 1, dec), kN(F)))}
      />
      <Explain icon={Lightbulb} id={shown} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.vTop}
          symbol={<Rich>{t.sym.vTop}</Rich>}
          value={fmt(vTop, 1, dec)}
          unit={T.ms}
          accent={PR.low}
          textColor={PR.statText}
          sub={<Rich>{t.sub.vTop}</Rich>}
        />
        <Readout
          label={t.readouts.vBot}
          symbol={<Rich>{t.sym.vBot}</Rich>}
          value={fmt(vBot, 1, dec)}
          unit={T.ms}
          accent={PR.high}
          textColor="#fca5a5"
          sub={<Rich>{t.sub.vBot}</Rich>}
        />
        <Readout label={t.readouts.dp} symbol="Δp" value={fmtP(dp)} unit={T.Pa} accent={PR.dyn} textColor={PR.dynText} sub={<Rich>{t.sub.dp}</Rich>} />
        <Readout
          label={t.readouts.F}
          symbol="F"
          value={kN(F)}
          unit={T.kN}
          accent={PALETTE.force}
          textColor="#fca5a5"
          active={key === 'lift' || key === 'level'}
          sub={<Rich>{t.sub.F(kN(mg))}</Rich>}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="bn-wv"
            label={t.v}
            symbol="v"
            min={0}
            max={60}
            step={1}
            value={v}
            onChange={setV}
            accent={PALETTE.vel}
            display={`${fmt(v, 0, dec)} ${T.ms}`}
            hint={t.vHint(fmt(v * 3.6, 0, dec))}
          />
          <RangeField
            id="bn-wa"
            label={t.alpha}
            symbol="α"
            min={0}
            max={12}
            step={1}
            value={alpha}
            onChange={setAlpha}
            accent="#a78bfa"
            display={`${fmt(alpha, 0, dec)}°`}
            hint={t.alphaHint}
          />
          <InfoBox
            title={t.info.title}
            rows={[
              [t.info.S, `${fmt(S_WING, 0, dec)} ${T.m2}`],
              [t.info.m, `${fmt(M_PLANE, 0, dec)} ${T.kg}`],
              [t.info.mg, `${kN(mg)} ${T.kN}`],
              [t.info.rho, `${fmt(RHO_AIR, 1, dec)} ${T.kgm3}`],
              [t.info.q, `${fmtP(q)} ${T.Pa}`],
            ]}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            title={t.graph.title}
            legend={[
              { label: t.graph.top, color: '#60a5fa' },
              { label: t.graph.bot, color: '#f87171' },
              { label: t.graph.diff, color: PR.dynBar, swatch: true },
            ]}
            series={[
              { id: 'top', color: '#60a5fa', points: graph.top },
              { id: 'bot', color: '#f87171', points: graph.bot },
            ]}
            fills={[{ id: 'd', upper: graph.bot, lower: graph.top, color: PR.dynBar, opacity: 0.2 }]}
            xMax={CHORD_M}
            yMin={gMin * 1.08}
            yMax={gMax * 1.15}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={220}
            decimal={dec}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <FormulaTile
              tag={t.f.dp.tag}
              color={PR.dynText}
              general={t.f.dp.general}
              filled={t.f.dp.filled(fmt(vTop, 2, dec), fmt(vBot, 2, dec), fmtP(dp))}
              ok={v > 0}
            />
            <FormulaTile
              tag={t.f.F.tag}
              color="#fca5a5"
              general={t.f.F.general}
              filled={t.f.F.filled(fmtP(dp), fmt(S_WING, 0, dec), kN(F), F >= 0.95 * mg ? '≥' : '<', kN(mg))}
              ok={F >= 0.95 * mg}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/** Pressure field as a small bitmap (drawn on a canvas, scaled smoothly). */
function usePressureImage(alpha, v, W, H, view) {
  const { k, cx, cy } = view;
  const narrow = W < 560;
  const cols = narrow ? 72 : 128;
  const rows = Math.max(8, Math.round((cols * H) / W));
  const grid = useMemo(() => {
    const box = { x0: (0 - cx) / k, x1: (W - cx) / k, y0: (cy - H) / k, y1: cy / k };
    const g = pressureGrid(alpha * DEG, box, cols, rows);
    // fill the cells inside the wing from their neighbours, so the smooth
    // scaling does not fade the colours along the surface
    for (let pass = 0; pass < 3; pass += 1) {
      const copy = g.slice();
      for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          if (copy[j * cols + i] !== null) continue;
          let s = 0;
          let n = 0;
          for (let dj = -1; dj <= 1; dj += 1) {
            for (let di = -1; di <= 1; di += 1) {
              const ii = i + di;
              const jj = j + dj;
              if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
              const val = copy[jj * cols + ii];
              if (val !== null) {
                s += val;
                n += 1;
              }
            }
          }
          if (n) g[j * cols + i] = s / n;
        }
      }
    }
    return g;
  }, [alpha, cols, rows, W, H, k, cx, cy]);
  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    const cv = document.createElement('canvas');
    cv.width = cols;
    cv.height = rows;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(cols, rows);
    const q = (RHO_AIR * v * v) / 2;
    for (let i = 0; i < cols * rows; i += 1) {
      const cp = grid[i] ?? 0;
      const f = clamp((cp * q) / P_SCALE, -1, 1);
      const a = Math.abs(f);
      const [r, g, b] = f < 0 ? [37, 99, 235] : [220, 38, 38];
      img.data[i * 4] = Math.round(255 + (r - 255) * a);
      img.data[i * 4 + 1] = Math.round(255 + (g - 255) * a);
      img.data[i * 4 + 2] = Math.round(255 + (b - 255) * a);
      img.data[i * 4 + 3] = Math.round(255 * Math.min(0.88, 0.95 * a ** 0.65));
    }
    ctx.putImageData(img, 0, 0);
    try {
      return cv.toDataURL('image/png');
    } catch {
      return null;
    }
  }, [grid, v, cols, rows]);
}

function wingView(W, H) {
  const narrow = W < 560;
  const X = narrow ? 3.2 : 5.0;
  const padX = narrow ? 6 : 14;
  const padT = narrow ? 30 : 56;
  const padB = narrow ? 10 : 14;
  const k = (W - 2 * padX) / (2 * X);
  const cx = W / 2;
  const cy = padT + (H - padT - padB) * 0.56;
  return { narrow, X, k, cx, cy, Yt: cy / k, Yb: (H - cy) / k };
}

function WingScene({ T, v, alpha, surf, D, F, mg, vTop, vBot, ariaLabel }) {
  const t = T.apps.wing;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.p, color: '#ffffff', kind: 'grad' },
    { label: t.legend.lines, color: '#475569', kind: 'line' },
    { label: t.legend.F, color: PALETTE.force, kind: 'arrow' },
    { label: t.legend.mg, color: '#334155', kind: 'dash' },
  ];
  const chips = (
    <>
      {v > 0 && <Chip icon={Timer}>{T.slowChip(SLOW)}</Chip>}
      <Chip icon={Ruler} color="#64748b">
        {t.scene.chord(fmt(CHORD_M, 1, dec))}
      </Chip>
    </>
  );
  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 0.95, 300, 380) : clamp(W * 0.38, 380, 470))}>
      {(W, H) => <WingDrawing T={T} W={W} H={H} v={v} alpha={alpha} surf={surf} D={D} F={F} mg={mg} vTop={vTop} vBot={vBot} dec={dec} t={t} />}
    </LabScene>
  );
}

function WingDrawing({ W, H, v, alpha, surf, D, F, mg, vTop, vBot, dec, t }) {
  const view = useMemo(() => wingView(W, H), [W, H]);
  const { narrow, X, k, cx, cy, Yt, Yb } = view;
  const sx = (x) => cx + x * k;
  const sy = (y) => cy - y * k;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const img = usePressureImage(alpha, v, W, H, view);
  const lines = useMemo(() => {
    const ys = [];
    const step = narrow ? 0.36 : 0.3;
    for (let y = -Yb + 0.12; y < Yt - 0.05; y += step) ys.push(y);
    return wingStreamlines(alpha * DEG, -X - 0.4, X + 0.4, ys);
  }, [alpha, X, Yt, Yb, narrow]);

  /* particles along each streamline, by travel time (U = 1 units) */
  const dTau = 0.5;
  const at = (ln, tau) => {
    const ts = ln.t;
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ts[m] <= tau) lo = m;
      else hi = m;
    }
    const f = clamp((tau - ts[lo]) / (ts[hi] - ts[lo] || 1e-9), 0, 1);
    const a = ln.pts[lo];
    const b = ln.pts[hi];
    return [sx(a.x + (b.x - a.x) * f), sy(a.y + (b.y - a.y) * f)];
  };
  const streaks = [];
  if (v > 0) {
    lines.forEach((ln, j) => {
      const Tt = ln.t[ln.t.length - 1];
      if (Tt <= 0) return;
      const n = Math.floor(Tt / dTau);
      for (let i = 0; i < n; i += 1) {
        const tau = (D + i * dTau + ((j * 0.37) % 1) * dTau) % Tt;
        if (tau < 0.12) continue;
        const p = at(ln, tau);
        const q = at(ln, tau - 0.1);
        streaks.push({ key: `${j}-${i}`, x1: q[0], y1: q[1], x2: p[0], y2: p[1] });
      }
    });
  }

  const outline = surf.outline.map((p) => [sx(p.x), sy(p.y)]);
  const qc = [sx(surf.qc.x), sy(surf.qc.y)];
  const unit = narrow ? 46 : 70; // px for mg
  const lenF = clamp((F / mg) * unit, 0, sy(-Yb) - sy(Yt) - 40);
  // the chord line (LE → TE) for the angle mark
  const te = [sx(Math.cos(-alpha * DEG) * 2.0), sy(Math.sin(-alpha * DEG) * 2.0)];
  const topLabelY = sy(narrow ? 1.25 : 0.85);
  const botLabelY = sy(narrow ? -1.0 : -0.85);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      {/* faint grid, 0.5 airfoil units */}
      <g aria-hidden="true">
        {Array.from({ length: Math.ceil((2 * X + 1) / 0.5) }, (_, i) => -Math.ceil(X / 0.5) * 0.5 + i * 0.5).map((x) => (
          <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke="#eef2f7" />
        ))}
        {Array.from({ length: Math.ceil((Yt + Yb) / 0.5) + 1 }, (_, i) => -Math.floor(Yb / 0.5) * 0.5 + i * 0.5).map((y) => (
          <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} stroke="#eef2f7" />
        ))}
      </g>
      {img && v > 0 && <image href={img} x={0} y={0} width={W} height={H} preserveAspectRatio="none" opacity="0.95" />}

      {/* streamlines */}
      <g opacity="0.42">
        {lines.map((ln) => (
          <polyline key={ln.y0} points={ln.pts.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ')} fill="none" stroke="#334155" strokeWidth={1} />
        ))}
      </g>
      <g>
        {streaks.map((s) => (
          <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#0f172a" strokeOpacity="0.75" strokeWidth={narrow ? 1.6 : 2} strokeLinecap="round" />
        ))}
      </g>

      {/* the wing */}
      <polygon points={pts(outline)} fill="#94a3b8" stroke="#1e293b" strokeWidth={1.6} strokeLinejoin="round" />
      <polyline points={pts(outline.slice(0, Math.round(outline.length * 0.4)))} fill="none" stroke="#e2e8f0" strokeWidth={1.4} opacity="0.8" />

      {/* angle of attack */}
      {alpha > 0 && (
        <g>
          <line x1={te[0]} y1={te[1]} x2={te[0] - (narrow ? 70 : 110)} y2={te[1]} stroke="#7c3aed" strokeWidth={1.2} strokeDasharray="4 3" />
          <line
            x1={te[0]}
            y1={te[1]}
            x2={te[0] - Math.cos(alpha * DEG) * (narrow ? 70 : 110)}
            y2={te[1] - Math.sin(alpha * DEG) * (narrow ? 70 : 110)}
            stroke="#7c3aed"
            strokeWidth={1.2}
            strokeDasharray="2 3"
          />
        </g>
      )}
      <Pill x={te[0] + (narrow ? 26 : 34)} y={te[1] + 2} text={t.scene.alphaTag(fmt(alpha, 0, dec))} bg="#7c3aed" size={fs - 1} box={box} />

      {/* free stream */}
      {v > 0 && (
        <g>
          <Arrow x1={sx(-X) + 10} y1={sy(Yt) + (narrow ? 44 : 74)} x2={sx(-X) + 10 + clamp(v * 1.4, 14, 80)} y2={sy(Yt) + (narrow ? 44 : 74)} color={PALETTE.vel} width={3} head={10} />
          <Pill x={sx(-X) + 10 + clamp(v * 1.4, 14, 80) + 46} y={sy(Yt) + (narrow ? 44 : 74)} text={t.scene.vTag(fmt(v, 0, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
        </g>
      )}

      {/* pressure labels */}
      {v > 0 && (
        <>
          <Pill x={sx(narrow ? 0.6 : 1.7)} y={topLabelY} text={t.scene.top(fmt(vTop, 1, dec))} bg={PR.low} size={fs - 0.5} box={box} />
          <Pill x={sx(narrow ? 0.6 : 1.2)} y={botLabelY} text={t.scene.bot(fmt(vBot, 1, dec))} bg={PR.high} size={fs - 0.5} box={box} />
        </>
      )}

      {/* lift and weight */}
      <g>
        <line x1={qc[0]} y1={qc[1] + 6} x2={qc[0]} y2={qc[1] + unit - 10} stroke="#334155" strokeWidth={2.4} strokeDasharray="5 4" />
        <path d={`M${qc[0]},${qc[1] + unit} L${qc[0] - 6},${qc[1] + unit - 11} L${qc[0] + 6},${qc[1] + unit - 11} Z`} fill="#334155" />
        <Pill x={qc[0] - (narrow ? 44 : 58)} y={qc[1] + unit - 8} text={t.scene.mgTag(fmt(mg / 1000, 2, dec))} bg="#334155" size={fs - 1} box={box} />
        {lenF > 8 && <Arrow x1={qc[0]} y1={qc[1] - 4} x2={qc[0]} y2={qc[1] - 4 - lenF} color={PALETTE.force} width={narrow ? 3.5 : 4.5} head={narrow ? 12 : 15} />}
        {lenF > 8 && (
          <Pill x={qc[0] - (narrow ? 46 : 60)} y={qc[1] - 4 - lenF + 10} text={t.scene.FTag(fmt(F / 1000, 2, dec))} bg={PALETTE.force} size={fs - 0.5} box={box} />
        )}
      </g>

      {/* colour scale */}
      {!narrow && (
        <g transform={`translate(${W - 190} ${H - 34})`}>
          <defs>
            <linearGradient id="bw-scale" x1="0" x2="1">
              <stop offset="0" stopColor="rgb(37,99,235)" stopOpacity="0.85" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="1" stopColor="rgb(220,38,38)" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <rect x={-6} y={-16} width={186} height={44} rx={8} fill="#fff" opacity="0.85" stroke="#e2e8f0" />
          <text x={0} y={-4} fontSize={10.5} fill="#475569" fontWeight="600">
            {t.scene.scale}
          </text>
          <rect x={0} y={2} width={174} height={9} rx={3} fill="url(#bw-scale)" stroke="#cbd5e1" strokeWidth={0.8} />
          {[-P_SCALE, 0, P_SCALE].map((p, i) => (
            <text key={p} x={i * 87} y={24} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={10} fill="#475569">
              {p === 0 ? 'p₀' : `${p > 0 ? '+' : '−'}${fmtP(Math.abs(p))}`}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}
