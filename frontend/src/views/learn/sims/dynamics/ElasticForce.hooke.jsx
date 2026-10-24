import { useState } from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';
import { Arrow, Btn, Explain, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { COL, Coil, Defs, G, Hanger, Panel, RichPill, RulerV, SimScene, Stand, Tag, TimeChip, Toolbar, XYGraph, hangerHeight, rich } from './ElasticForce.parts';

/**
 * Hooke's law with a spring hanging from a lab stand. A slotted weight of
 * mass m stretches it until the elastic force balances gravity: kx = mg,
 * so x = mg/k (k = 100 N/m: 200 g → x = 0.0196 m ≈ 2 cm). Every load that
 * comes to rest is written into a table and onto an F–x graph, where the
 * points lie on one straight line through the origin.
 *
 * Beyond the elastic limit (x_e = 6 cm, i.e. 6 N) the coils yield: the
 * extra stretch follows a gentler slope k/2, and a spring loaded there
 * keeps a residual (plastic) elongation x₀ = x_max − F_max/k when unloaded,
 * then behaves elastically from that new length (F = k(x − x₀)).
 *
 * The bouncing on the way to rest is a damped oscillation shown slowed
 * down 2×; if the swing would carry the spring past its limit, the load is
 * lowered gently (critical damping) so the result is the static one.
 */

const K = 100; // N/m
const X_E = 0.06; // m, elastic limit (elongation)
const KP = K / 2; // N/m, slope once the coils yield
const SLOW = 2;
const ZETA = 0.2;
const OVERSHOOT = Math.exp((-Math.PI * ZETA) / Math.sqrt(1 - ZETA * ZETA));
const M_BARE = 0.05; // kg, inertia of the bare spring end (motion only)
const MASSES = [0, 50, 100, 200, 300, 400, 500, 1000]; // g
const L_COIL = 8; // cm, spring with its loops, unloaded

/** Yield state after the largest elongation `xMax`: yield force and residual elongation x₀. */
function yieldOf(xMax) {
  const xm = Math.max(xMax, X_E);
  const Fy = K * X_E + KP * (xm - X_E);
  return { xm, Fy, x0: xm - Fy / K };
}

/** Elastic force at elongation x for a spring whose largest elongation so far was xMax (no state change). */
function forceAt(x, xMax) {
  const { xm, x0 } = yieldOf(xMax);
  if (x > xm) return K * X_E + KP * (x - X_E);
  return K * (x - x0);
}

/** Static rest position for mass m (kg). */
function restOf(m, xMax) {
  const F = m * G;
  const { Fy, x0 } = yieldOf(xMax);
  if (F <= Fy + 1e-12) return { x: x0 + F / K, plastic: false };
  return { x: X_E + (F - K * X_E) / KP, plastic: true };
}

function loadState(p, g) {
  const m = g / 1000;
  const rest = restOf(m, p.xMax);
  const mDyn = Math.max(m, M_BARE);
  let zeta = ZETA;
  let kT = K;
  if (rest.plastic) {
    zeta = 1;
    kT = KP;
  } else if (rest.x + OVERSHOOT * (rest.x - p.x) > yieldOf(p.xMax).xm) zeta = 1;
  return { ...p, g, m, c: 2 * zeta * Math.sqrt(kT * mDyn), running: true };
}

const START = loadState({ g: 0, m: 0, x: 0, v: 0, xMax: 0, c: 0, running: false, points: [] }, 200);

export default function HookeSim({ T }) {
  const tx = T.hooke;
  const u = T.u;
  const dec = T.decimal;
  const [sim, setSim] = useState(START);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const mDyn = Math.max(p.m, M_BARE);
      let xMax = p.xMax;
      let x = p.x;
      let v = p.v;
      const n = Math.max(1, Math.ceil(dt / SLOW / 0.00025));
      const h = dt / SLOW / n;
      for (let i = 0; i < n; i += 1) {
        const F = forceAt(x, xMax);
        if (x > Math.max(xMax, X_E)) xMax = x;
        v += ((p.m * G - F - p.c * v) / mDyn) * h;
        x += v * h;
        const x0 = yieldOf(xMax).x0;
        if (x < x0) {
          x = x0; // a tension spring cannot get shorter than its closed coils
          if (v < 0) v = 0;
        }
      }
      const rest = restOf(p.m, xMax);
      if (Math.abs(x - rest.x) < 5e-5 && Math.abs(v) < 2e-3) {
        const xm = rest.plastic ? Math.max(xMax, rest.x) : xMax;
        const x0 = yieldOf(xm).x0;
        const pt = { g: p.g, F: p.m * G, x: rest.x, x0, plastic: rest.plastic };
        const key = (q) => `${q.g}|${q.x0.toFixed(5)}`;
        const points = [...p.points.filter((q) => key(q) !== key(pt)), pt].sort((a, b) => a.x0 - b.x0 || a.g - b.g);
        return { ...p, x: rest.x, v: 0, xMax: xm, running: false, points };
      }
      return { ...p, x, v, xMax };
    });
  });

  const pick = (g) => setSim((p) => loadState(p, g));
  const reset = () => setSim(loadState({ g: 0, m: 0, x: 0, v: 0, xMax: 0, c: 0, running: false, points: [] }, 0));

  /* ---- derived */
  const ys = yieldOf(sim.xMax);
  const damaged = ys.x0 > 1e-5;
  const F = forceAt(sim.x, sim.xMax);
  const onPlastic = sim.xMax > X_E + 1e-6 && sim.x >= sim.xMax - 1e-5 && sim.m > 0;
  const kMeas = sim.x > 5e-4 && F > 0.005 ? F / sim.x : NaN;
  const lawBroken = damaged || onPlastic;
  const healthy = sim.points.filter((q) => q.x0 < 1e-5 && !q.plastic && q.g > 0);
  const P = sim.m * G;
  const xcm = sim.x * 100;

  /* ---- explanation */
  let key;
  if (sim.running) key = 'moving';
  else if (sim.m === 0) key = damaged ? 'plastic' : 'idle';
  else if (onPlastic) key = 'over';
  else if (damaged) key = 'damaged';
  else if (healthy.length >= 3) key = 'line';
  else key = 'settled';
  const settled = useSettled(`${key}-${sim.g}`, key === 'moving' ? 120 : 0);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  const f2 = (n) => fmt(n, 2, dec);
  let text;
  if (sKey === 'moving') text = ex.moving;
  else if (sKey === 'plastic') text = ex.plastic(f2(ys.x0 * 100));
  else if (sKey === 'over') text = ex.over(f2((P / K) * 100), f2(xcm));
  else if (sKey === 'damaged') text = ex.damaged(f2(ys.x0 * 100), f2(xcm));
  else if (sKey === 'line') text = `${ex.settled(sim.g, f2(P), f2(xcm), fmt(sim.x, 4, dec), fmt(K, 0, dec))} ${ex.line(healthy.length)}`;
  else if (sKey === 'settled') text = ex.settled(sim.g, f2(P), f2(xcm), fmt(sim.x, 4, dec), fmt(K, 0, dec));
  else text = ex.idle;
  const tone = { moving: '#fbbf24', over: '#f87171', plastic: '#fb923c', damaged: '#fb923c', line: '#34d399', settled: '#34d399' }[sKey] ?? '#22d3ee';

  const massText = (g) => (g >= 1000 ? `${fmt(g / 1000, 0, dec)} ${u.kg}` : `${g} ${u.g}`);
  const legend = [
    { label: tx.legend.fel, color: COL.fel, kind: 'arrow' },
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.x, color: COL.x, kind: 'line' },
    { label: tx.legend.limit, color: COL.limit, kind: 'band' },
  ];

  /* ---- graph */
  const fitPts = healthy.filter((q) => q.x > 0);
  const kFit = fitPts.length ? fitPts.reduce((s, q) => s + q.F * q.x, 0) / fitPts.reduce((s, q) => s + q.x * q.x, 0) : K;
  const graphLines = [];
  if (fitPts.length >= 2) {
    graphLines.push({ id: 'fit', pts: [{ x: 0, y: 0 }, { x: X_E * 100, y: kFit * X_E }], color: COL.felText, width: 2.5 });
    graphLines.push({ id: 'fitx', pts: [{ x: X_E * 100, y: kFit * X_E }, { x: 16, y: kFit * 0.16 }], color: COL.felText, width: 1.5, dash: '4 5', opacity: 0.5 });
  }
  if (sim.xMax > X_E + 1e-6) {
    graphLines.push({ id: 'yield', pts: [{ x: X_E * 100, y: K * X_E }, { x: sim.xMax * 100, y: ys.Fy }], color: '#f87171', width: 2, dash: '2 4' });
    graphLines.push({ id: 'unload', pts: [{ x: ys.x0 * 100, y: 0 }, { x: sim.xMax * 100, y: ys.Fy }], color: COL.warnText, width: 2, dash: '2 4' });
  }
  const graphPoints = sim.points.map((q) => ({
    x: q.x * 100,
    y: q.F,
    color: q.plastic ? '#f87171' : q.x0 > 1e-5 ? COL.warnText : COL.felText,
  }));

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.loadLabel}
        cols="grid-cols-4 md:grid-cols-8"
        value={sim.g}
        onChange={pick}
        accent={sim.g >= 1000 ? '#f87171' : '#fbbf24'}
        options={MASSES.map((g) => ({
          value: g,
          label: g === 0 ? tx.none : massText(g),
          sub: `${f2((g / 1000) * G)} ${u.N}`,
        }))}
      >
        <Btn icon={RotateCcw} onClick={reset} className="col-span-2 min-h-[52px] text-[15px] xl:min-w-[150px]">
          {tx.newSpring}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.slower(SLOW)} extra={`k = ${fmt(K, 0, dec)} ${u.Nm}`} />}
        ariaLabel={tx.sceneLabel(sim.g, f2(xcm), f2(F))}
        height={(W, narrow) => (narrow ? clamp(W * 1.5, 470, 580) : clamp(W * 0.48, 450, 530))}
      >
        {(W, H, narrow) => <HookeDrawing W={W} H={H} narrow={narrow} sim={sim} F={F} damaged={damaged} x0={ys.x0} onPlastic={onPlastic} tx={tx} T={T} massText={massText} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.mass} symbol="m" value={sim.g >= 1000 ? fmt(1, 0, dec) : String(sim.g)} unit={sim.g >= 1000 ? u.kg : u.g} accent="#eab308" textColor="#fde68a" sub={rich(tx.readouts.massSub(f2(P)))} />
        <Readout label={tx.readouts.x} symbol="x" value={f2(xcm)} unit={u.cm} accent={COL.x} textColor={COL.xText} sub={tx.readouts.xSub(fmt(sim.x, 4, dec))} />
        <Readout
          label={tx.readouts.fel}
          symbol={rich(T.fel)}
          value={f2(F)}
          unit={u.N}
          accent={COL.fel}
          textColor={COL.felText}
          sub={rich(damaged ? tx.readouts.felSubDamaged : tx.readouts.felSub)}
        />
        <Readout
          label={tx.readouts.k}
          symbol="k"
          value={Number.isFinite(kMeas) ? fmt(kMeas, 0, dec) : '—'}
          unit={u.Nm}
          accent={lawBroken ? '#f87171' : '#a3e635'}
          textColor={lawBroken ? '#fca5a5' : '#d9f99d'}
          active={lawBroken}
          sub={<span className={lawBroken ? 'text-red-300' : ''}>{rich(lawBroken ? tx.readouts.kBad : Number.isFinite(kMeas) ? tx.readouts.kSub : tx.readouts.kIdle)}</span>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <MeasureTable tx={tx} points={sim.points} dec={dec} massText={massText} />
        </Panel>
        <Panel className="lg:col-span-3">
          <XYGraph
            title={tx.graph.title}
            legend={[
              { label: tx.graph.measured, color: COL.felText, kind: 'dot' },
              ...(sim.xMax > X_E + 1e-6 ? [{ label: tx.graph.beyond, color: '#f87171', kind: 'dot' }] : []),
              ...(fitPts.length >= 2 ? [{ label: tx.graph.fit(fmt(kFit, 0, dec)), color: COL.felText, kind: 'line' }] : []),
            ]}
            xMin={0}
            xMax={16}
            yMin={0}
            yMax={10}
            xStep={2}
            yStep={2}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            lines={graphLines}
            points={graphPoints}
            bands={[{ x0: X_E * 100, x1: 16, color: '#f87171' }]}
            vlines={[{ x: X_E * 100, color: '#f87171', label: tx.graph.limit }]}
            marker={{ x: xcm, y: F, color: '#fff' }}
            decimal={dec}
            ariaLabel={tx.graph.label}
            note={tx.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ the table */

function MeasureTable({ tx, points, dec, massText }) {
  const t = tx.table;
  const rows = points.filter((q) => q.g > 0 || q.x0 > 1e-5);
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{t.title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl bg-black/25 px-3 py-3 text-sm text-gray-400">{t.empty}</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl bg-black/25">
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-[11px] tracking-[0.04em] text-gray-500">
                <th className="px-2 py-2 text-left font-medium sm:px-3">{t.m}</th>
                <th className="px-2 py-2 text-right font-medium">{rich(t.F)}</th>
                <th className="px-2 py-2 text-right font-medium">{t.x}</th>
                <th className="px-2 py-2 text-right font-medium sm:px-3">{t.k}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const bad = q.plastic || q.x0 > 1e-5;
                const c = q.plastic ? 'text-red-300' : q.x0 > 1e-5 ? 'text-amber-200' : 'text-gray-100';
                return (
                  <tr key={`${q.g}|${q.x0.toFixed(5)}`} className={`border-t border-white/5 ${c}`}>
                    <td className="px-2 py-1.5 sm:px-3">
                      {massText(q.g)}
                      {bad && <span className="ml-1.5 text-[11px] opacity-80">{q.plastic ? t.over : t.damaged}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmt(q.F, 2, dec)}</td>
                    <td className="px-2 py-1.5 text-right">{fmt(q.x * 100, 2, dec)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold sm:px-3">{q.x > 5e-4 ? fmt(q.F / q.x, 0, dec) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs leading-snug text-gray-500">{t.note}</p>
    </div>
  );
}

/* ------------------------------------------------------------ the scene */

function HookeDrawing({ W, H, narrow, sim, F, damaged, x0, onPlastic, tx, T, massText }) {
  const dec = T.decimal;
  const u = T.u;
  const f2 = (n) => fmt(n, 2, dec);
  const box = { w: W, h: H };
  const fs = narrow ? 11 : 12;

  /* apparatus, to scale: s px per cm */
  const armY = narrow ? 40 : 66;
  const topY = armY + 8;
  const loadRoom = 70;
  const s = clamp((H - topY - loadRoom - 12) / (L_COIL + 14.2), 8, 17);
  const ax = Math.round(narrow ? W * 0.3 : W * 0.2);
  const p0 = topY + L_COIL * s; // pointer of the unloaded spring = 0 of the ruler
  const xcm = sim.x * 100;
  const py = p0 + xcm * s;
  const rulerW = narrow ? 30 : 38;
  const rulerX = ax - (narrow ? 24 : 40) - rulerW;
  const rodX = rulerX - (narrow ? 14 : 30);
  const baseY = H - 16;
  const unit = narrow ? 8 : 9;
  const hh = hangerHeight(sim.g, unit);

  /* free-body inset */
  const fx0 = narrow ? W * 0.635 : W * 0.71;
  const fx1 = W - (narrow ? 8 : 16);
  const fy0 = narrow ? 44 : 56;
  const fy1 = H - 12;
  const fcx = (fx0 + fx1) / 2;
  const bw = narrow ? 24 : 32;
  const bh = narrow ? 15 : 19;
  const topRoom = narrow ? 66 : 78; // title and badge above the F_el arrow
  const fcy = (fy1 - 40 + fy0 + topRoom + bh) / 2;
  const fpx = Math.max(4, (fcy - bh - fy0 - topRoom) / 10); // px per newton, 10 N fits both ways
  const P = sim.m * G;
  const balanced = !sim.running && sim.m > 0;

  /* magnifier (wide screens) */
  const Z = 4;
  const lensR = 84;
  const mx = W * 0.48;
  const my = clamp(py, armY + lensR + 26, H - lensR - 40);

  const lensTicks = [];
  if (!narrow) {
    const span = lensR / (s * Z); // cm visible each way
    for (let mm = Math.floor((xcm - span) * 10); mm <= Math.ceil((xcm + span) * 10); mm += 1) {
      const v = mm / 10;
      if (v < -1) continue;
      const y = my + (v - xcm) * s * Z;
      const isCm = mm % 10 === 0;
      const half = mm % 5 === 0;
      const len = isCm ? 30 : half ? 21 : 12;
      lensTicks.push(<line key={`l${mm}`} x1={mx + 14 - len} x2={mx + 14} y1={y} y2={y} stroke="#78350f" strokeWidth={isCm ? 2 : 1.2} />);
      if (isCm)
        lensTicks.push(
          <text key={`ln${mm}`} x={mx - 34} y={y + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#78350f">
            {fmt(v, 0, dec)}
          </text>,
        );
    }
  }
  const limitY = my + (X_E * 100 - xcm) * s * Z;

  return (
    <g>
      <Defs />
      <defs>
        <clipPath id="ef-lens">
          <circle cx={mx} cy={my} r={lensR} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />

      {!narrow && (
        <g>
          <line x1={rulerX + rulerW / 2 + 9} y1={py - 9} x2={mx - lensR * 0.7} y2={my - lensR * 0.7} stroke="#cbd5e1" strokeWidth="1" />
          <line x1={rulerX + rulerW / 2 + 9} y1={py + 9} x2={mx - lensR * 0.7} y2={my + lensR * 0.7} stroke="#cbd5e1" strokeWidth="1" />
        </g>
      )}
      <Stand rodX={rodX} armY={armY} hookX={ax} baseY={baseY} baseL={narrow ? 14 : 34} baseR={narrow ? 46 : 64} />
      {/* ruler clamps */}
      {[p0 - 0.2 * s, p0 + 13.5 * s].map((y) => (
        <rect key={y} x={rodX - 2} y={y - 4} width={rulerX - rodX + 6} height={8} rx={2} fill="#64748b" />
      ))}
      <RulerV x={rulerX} w={rulerW} y0={p0} s={s} from={-0.6} to={14.6} unit={u.cm} dec={dec} limit={X_E * 100} />

      {/* zero level and the residual length of a damaged spring */}
      <line x1={rulerX + rulerW} x2={ax + 30} y1={p0} y2={p0} stroke="#94a3b8" strokeDasharray="3 3" />
      {damaged && (
        <>
          <line x1={rulerX + rulerW} x2={ax + 30} y1={p0 + x0 * 100 * s} y2={p0 + x0 * 100 * s} stroke={COL.warn} strokeDasharray="4 3" strokeWidth="1.5" />
          <RichPill x={ax + (narrow ? 22 : 34)} y={p0 + x0 * 100 * s} anchor="start" text={tx.x0Tag(f2(x0 * 100))} bg={COL.warn} size={11} box={box} />
        </>
      )}

      {/* spring */}
      <circle cx={ax} cy={topY + 3} r={4} fill="none" stroke={COL.steel} strokeWidth="2.2" />
      <Coil x1={ax} y1={topY + 7} x2={ax} y2={py - 5} turns={13} r={narrow ? 9 : 11} lead={Math.min(10, s * 0.7)} color={damaged ? '#7c4a2a' : COL.steel} />
      <circle cx={ax} cy={py - 2} r={3.5} fill="none" stroke={COL.steel} strokeWidth="2.2" />

      {/* pointer */}
      <line x1={ax - 2} x2={rulerX + rulerW + 6} y1={py} y2={py} stroke={COL.pointer} strokeWidth="2.2" />
      <path d={`M${rulerX + rulerW - 1},${py} l8,-4.5 l0,9 Z`} fill={COL.pointer} />

      {/* load */}
      <Hanger x={ax} y={py} grams={sim.g} unit={unit} width={narrow ? 34 : 44} label={sim.g >= 1000 ? massText(sim.g) : undefined} />
      {sim.g > 0 && sim.g < 1000 && <RichPill x={ax + (narrow ? 22 : 30)} y={py + 16 + hh / 2} anchor="start" text={massText(sim.g)} bg="#fff" color="#713f12" border="#eab308" size={fs} box={box} />}

      {/* elongation bracket */}
      {xcm > 0.25 && (
        <g>
          <Arrow x1={ax + (narrow ? 17 : 22)} y1={p0} x2={ax + (narrow ? 17 : 22)} y2={py} color={COL.x} width={2.4} head={Math.min(9, xcm * s * 0.5)} />
          <line x1={ax + (narrow ? 12 : 16)} x2={ax + (narrow ? 22 : 28)} y1={p0} y2={p0} stroke={COL.x} strokeWidth="2" />
        </g>
      )}
      {xcm > 0.05 && (
        <RichPill x={ax + (narrow ? 22 : 30)} y={Math.max(p0 + 2, (p0 + py) / 2)} anchor="start" text={tx.xTag(f2(xcm))} bg={COL.x} size={fs} box={box} />
      )}

      {onPlastic && <RichPill x={narrow ? 8 : mx} anchor={narrow ? 'start' : 'middle'} y={narrow ? 20 : armY - 6} text={tx.overTag} bg={COL.limit} size={fs} box={box} />}
      {!onPlastic && damaged && sim.m === 0 && <RichPill x={narrow ? 8 : mx} anchor={narrow ? 'start' : 'middle'} y={narrow ? 20 : armY - 6} text={tx.damagedTag} bg={COL.warn} size={fs} box={box} />}

      {/* magnifier */}
      {!narrow && (
        <g>
          <circle cx={rulerX + rulerW / 2} cy={py} r={13} fill="none" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1={mx + lensR * 0.72} y1={my + lensR * 0.72} x2={mx + lensR * 1.12} y2={my + lensR * 1.12} stroke="#334155" strokeWidth="11" strokeLinecap="round" />
          <circle cx={mx} cy={my} r={lensR} fill="#fff" />
          <g clipPath="url(#ef-lens)">
            <rect x={mx - 60} y={my - lensR} width={74} height={lensR * 2} fill="#fef3c7" />
            {limitY < my + lensR && <rect x={mx - 60} y={Math.max(limitY, my - lensR)} width={74} height={my + lensR - Math.max(limitY, my - lensR)} fill={COL.limit} opacity="0.14" />}
            {lensTicks}
            <line x1={mx + 14} x2={mx + 14} y1={my - lensR} y2={my + lensR} stroke="#d97706" />
            <line x1={mx + 8} x2={mx + lensR} y1={my} y2={my} stroke={COL.pointer} strokeWidth="3" />
            <path d={`M${mx + 6},${my} l14,-7 l0,14 Z`} fill={COL.pointer} />
          </g>
          <circle cx={mx} cy={my} r={lensR} fill="none" stroke="#334155" strokeWidth="5" />
          <circle cx={mx} cy={my} r={lensR - 4} fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.5" />
          <text x={mx} y={my - lensR - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569">
            {tx.lens(Z)}
          </text>
          <RichPill x={mx} y={my + lensR + 18} text={tx.reading(f2(xcm))} bg="#fff" color="#0f172a" border="#cbd5e1" size={12} box={box} />
        </g>
      )}

      {/* free-body diagram of the load */}
      <rect x={fx0} y={fy0} width={fx1 - fx0} height={fy1 - fy0} rx={14} fill="#f8fafc" stroke="#cbd5e1" />
      <text x={fcx} y={fy0 + 20} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {narrow ? tx.fbd.short : tx.fbd.title}
      </text>
      {sim.m > 0 ? (
        <g>
          <rect x={fcx - bw} y={fcy - bh} width={bw * 2} height={bh * 2} rx={5} fill="url(#ef-brass)" stroke="#78350f" />
          <text x={fcx - bw - 8} y={fcy + 4} textAnchor="end" fontSize={fs} fontWeight="700" fill="#713f12">
            {massText(sim.g)}
          </text>
          <Arrow x1={fcx} y1={fcy - bh} x2={fcx} y2={fcy - bh - F * fpx} color={COL.fel} width={4} head={13} />
          <Arrow x1={fcx} y1={fcy} x2={fcx} y2={fcy + P * fpx} color={COL.mg} width={4} head={13} />
          <circle cx={fcx} cy={fcy} r={3} fill={COL.mg} />
          <Tag x={fcx - 10} y={fcy - bh - F * fpx + 6} text={T.fel} color={COL.fel} anchor="end" size={narrow ? 13 : 15} />
          <RichPill x={fcx + 10} y={fcy - bh - F * fpx + 1} anchor="start" text={`${f2(F)} ${u.N}`} bg={COL.fel} size={fs - 1} box={box} />
          <Tag x={fcx - 10} y={fcy + P * fpx} text={tx.fbd.mg} color={COL.mg} anchor="end" size={narrow ? 13 : 15} />
          <RichPill x={fcx + 10} y={fcy + P * fpx - 5} anchor="start" text={`${f2(P)} ${u.N}`} bg={COL.mg} size={fs - 1} box={box} />
          <RichPill x={fcx} y={fy0 + 42} text={balanced ? tx.fbd.balanced : tx.fbd.unbalanced} bg={balanced ? '#059669' : '#d97706'} size={fs - 1} box={box} />
        </g>
      ) : (
        <text x={fcx} y={fcy} textAnchor="middle" fontSize={fs} fill="#94a3b8">
          {tx.fbd.empty}
        </text>
      )}
      {/* force scale */}
      <g>
        <line x1={fx0 + 14} x2={fx0 + 14 + fpx} y1={fy1 - 14} y2={fy1 - 14} stroke="#334155" strokeWidth="2" />
        <line x1={fx0 + 14} x2={fx0 + 14} y1={fy1 - 18} y2={fy1 - 10} stroke="#334155" strokeWidth="1.5" />
        <line x1={fx0 + 14 + fpx} x2={fx0 + 14 + fpx} y1={fy1 - 18} y2={fy1 - 10} stroke="#334155" strokeWidth="1.5" />
        <text x={fx0 + 20 + fpx} y={fy1 - 10} fontSize="11" fill="#475569">
          {tx.fbd.scale}
        </text>
      </g>
    </g>
  );
}
