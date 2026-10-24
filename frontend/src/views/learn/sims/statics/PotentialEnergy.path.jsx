import { useState } from 'react';
import { CornerRightDown, Footprints, Gauge, Layers, Lightbulb, Spline, TrendingDown } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  DimLine,
  EC,
  ForceArrow,
  Formula,
  G,
  GroupLabel,
  Ground,
  HaloText,
  InfoBox,
  LabScene,
  PaperGrid,
  PlayControls,
  RichPill,
  niceAxis,
  plain,
  rich,
  richSvg,
  smart,
} from './PotentialEnergy.parts';

/**
 * Tab 3 — the work of gravity does not depend on the path. A ball is taken
 * from A (h₁ = 6 m) to B (h₂ = 1 m) along four routes: across then straight
 * down, a straight ramp (s = 9.43 m, α = 32°), stairs of five 1 m steps, or a
 * curved slide that first dips to the ground and climbs back up to B. On
 * every route the counter ends at A = mg(h₁ − h₂) = 1 · 9.8 · 5 = 49 J
 * (= −ΔE_p): horizontal parts add nothing (mg ⊥ displacement), going up
 * subtracts. "All" runs the four at once. The speed is arbitrary (each route
 * takes 6 s on screen); work does not depend on it. Strings come from T.path.
 */

const H1 = 6;
const H2 = 1;
const T_RUN = 6; // s on screen per route
const R_BALL = 0.2; // m
const IDLE = { t: 0, running: false, done: false };

function bezier(P, t) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]);
}
const CURVE = [
  [0, 6],
  [0.15, 1.2],
  [4.6, -1.6],
  [8, 1],
];

function build(pts) {
  let s = 0;
  const out = pts.map(([x, y], i) => {
    if (i > 0) s += Math.hypot(x - pts[i - 1][0], y - pts[i - 1][1]);
    return { x, y, s };
  });
  return { pts: out, L: s };
}

const ROUTES = [
  {
    id: 'drop',
    icon: CornerRightDown,
    color: '#7c3aed',
    light: '#c4b5fd',
    ...build([
      [0, 6],
      [8, 6],
      [8, 1],
    ]),
  },
  {
    id: 'ramp',
    icon: TrendingDown,
    color: '#0891b2',
    light: '#67e8f9',
    ...build([
      [0, 6],
      [8, 1],
    ]),
  },
  {
    id: 'stairs',
    icon: Footprints,
    color: '#db2777',
    light: '#f9a8d4',
    ...build([
      [0, 6],
      [0, 5],
      [1.6, 5],
      [1.6, 4],
      [3.2, 4],
      [3.2, 3],
      [4.8, 3],
      [4.8, 2],
      [6.4, 2],
      [6.4, 1],
      [8, 1],
    ]),
  },
  {
    id: 'curve',
    icon: Spline,
    color: '#65a30d',
    light: '#bef264',
    ...build(Array.from({ length: 241 }, (_, i) => bezier(CURVE, i / 240))),
  },
];
const BY_ID = Object.fromEntries(ROUTES.map((r) => [r.id, r]));
const CURVE_MIN = Math.min(...BY_ID.curve.pts.map((p) => p.y));

/** Point, tangent and height on a route at path length s. */
function at(route, s) {
  const pts = route.pts;
  const ss = clamp(s, 0, route.L);
  let i = 1;
  while (i < pts.length - 1 && pts[i].s < ss) i += 1;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = Math.max(1e-9, b.s - a.s);
  const f = clamp((ss - a.s) / seg, 0, 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx: (b.x - a.x) / seg, ty: (b.y - a.y) / seg, s: ss };
}

const TONES = { idle: '#22d3ee', down: '#fbbf24', flat: '#94a3b8', up: '#60a5fa', done: '#34d399', allIdle: '#22d3ee', allRun: '#fbbf24', allDone: '#34d399' };

export default function PathSim({ T }) {
  const P = T.path;
  const dec = T.decimal;
  const [routeId, setRouteId] = useState('ramp');
  const [m, setM] = useState(1);
  const [sim, setSim] = useState(IDLE);
  const [tried, setTried] = useState({});

  const all = routeId === 'all';
  const active = all ? ROUTES : [BY_ID[routeId]];

  useRafLoop(sim.running, (dt) => {
    const t = Math.min(T_RUN, sim.t + dt);
    const done = t >= T_RUN - 1e-9;
    setSim({ t, running: !done, done });
    if (done) setTried((tr) => ({ ...tr, ...Object.fromEntries(active.map((r) => [r.id, true])) }));
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pick = (id) => {
    setRouteId(id);
    setSim(IDLE);
  };

  const mg = m * G;
  const Afinal = mg * (H1 - H2);
  const frac = sim.t / T_RUN;
  const states = active.map((r) => {
    const p = at(r, frac * r.L);
    return { r, p, A: mg * (H1 - p.y) };
  });
  const cur = states[0];
  const allTried = ROUTES.every((r) => tried[r.id]);
  const S = (n) => smart(n, dec);

  /* ---- explanation */
  let key;
  if (all) key = sim.done ? 'allDone' : sim.t > 0 ? 'allRun' : 'allIdle';
  else if (sim.done) key = 'done';
  else if (sim.t > 0) {
    const ty = cur.p.ty;
    key = ty < -0.04 ? 'down' : ty > 0.04 ? 'up' : 'flat';
  } else key = 'idle';
  const settled = useSettled(key, key === 'down' || key === 'up' || key === 'flat' ? 200 : 0);
  const ramp = BY_ID.ramp;
  const vals = {
    A: S(Afinal),
    mg: S(mg),
    m: S(m),
    g: fmt(G, 1, dec),
    L: fmt(ramp.L, 2, dec),
    cos: fmt((H1 - H2) / ramp.L, 2, dec),
    step: S(mg * 1),
    Amax: S(mg * (H1 - CURVE_MIN)),
    more: allTried ? P.explain.allSame(S(Afinal)) : P.explain.tryMore,
  };
  let text;
  if (settled === 'done') text = P.explain.done[routeId](vals);
  else text = P.explain[settled](vals);
  const tone = TONES[settled] ?? '#22d3ee';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{P.routesLabel}</GroupLabel>
          <Segmented
            label={P.routesLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={routeId}
            onChange={pick}
            options={[
              ...ROUTES.map((r) => ({ value: r.id, label: P.routes[r.id].name, sub: P.routes[r.id].sub, icon: r.icon })),
              { value: 'all', label: P.routes.all.name, sub: P.routes.all.sub, icon: Layers },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <PathScene T={T} states={states} all={all} m={m} running={sim.running} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      {all ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {states.map(({ r, p, A }) => (
            <Readout
              key={r.id}
              label={P.routes[r.id].name}
              symbol="A"
              value={fmt(A, 1, dec)}
              unit={T.J}
              accent={r.color}
              textColor={r.light}
              active={sim.done}
              sub={P.sOf(fmt(p.s, 1, dec), fmt(r.L, 1, dec))}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <Readout label={P.readouts.h} symbol="h" value={fmt(cur.p.y, 2, dec)} unit={T.m} accent={EC.ep} textColor="#bfdbfe" sub={rich(P.hSub(S(H1), S(H2)))} />
          <Readout
            label={P.readouts.s}
            symbol="s"
            value={fmt(cur.p.s, 2, dec)}
            unit={T.m}
            accent={cur.r.color}
            textColor={cur.r.light}
            sub={P.lenSub(fmt(cur.r.L, 2, dec))}
          />
          <Readout
            label={P.readouts.A}
            symbol="A"
            value={fmt(cur.A, 1, dec)}
            unit={T.J}
            accent={EC.work}
            textColor={EC.workText}
            active={sim.done}
            sub={rich(P.aSub)}
          />
          <Readout label={P.readouts.formula} accent="#e2e8f0">
            <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
              <p className="text-[16px] text-gray-100">
                <Formula text="A = mg(h₁ − h₂) = −ΔE_p" />
              </p>
              <p className="tabular-nums text-gray-400">
                = {S(m)} · {fmt(G, 1, dec)} · ({S(H1)} − {S(H2)}) = <b style={{ color: EC.workText }}>{S(Afinal)}</b> {T.J}
              </p>
              <p className="text-xs text-gray-500">{P.formulaNote}</p>
            </div>
          </Readout>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pe-path-m"
            label={P.mass}
            symbol="m"
            min={0.5}
            max={5}
            step={0.5}
            value={m}
            onChange={setM}
            accent={EC.mg}
            display={`${S(m)} ${T.kg}`}
            hint={P.massHint(S(mg))}
          />
          <InfoBox title={P.results.title}>
            <ul className="space-y-1">
              {ROUTES.map((r) => {
                const on = !all && r.id === routeId;
                return (
                  <li key={r.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 tabular-nums ${on ? 'bg-white/10 text-white' : ''}`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                      <span className="truncate">{P.routes[r.id].name}</span>
                    </span>
                    <span className="shrink-0 text-gray-400">
                      s = {fmt(r.L, 2, dec)} {T.m}
                    </span>
                    <span className="w-20 shrink-0 text-right font-semibold" style={{ color: tried[r.id] ? EC.workText : '#64748b' }}>
                      {tried[r.id] ? `${S(Afinal)} ${T.J}` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-gray-400">{allTried ? P.results.allSame(S(Afinal)) : P.results.hint}</p>
          </InfoBox>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <WorkGraph P={P} T={T} mg={mg} frac={frac} activeIds={active.map((r) => r.id)} tried={tried} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

const WX0 = -2.0;
const WX0_N = -0.7;
const WX1 = 10.6;
const WORLD_TOP = 7.4;

function PathScene({ T, states, all, m, running, done }) {
  const P = T.path;
  const dec = T.decimal;
  const mg = m * G;
  const one = !all ? states[0] : null;

  return (
    <LabScene
      legend={[
        { color: EC.mg, label: P.legend.mg, kind: 'arrow' },
        { color: '#334155', label: P.legend.dir, kind: 'arrow' },
        { color: EC.work, label: P.legend.A, kind: 'arrow' },
        { color: EC.ep, label: P.legend.ep, kind: 'bar' },
      ]}
      chips={<Chip icon={Gauge}>{P.chip}</Chip>}
      height={(W, narrow) => {
        if (!narrow) return 480;
        const k = (W - 30 - 8) / (WX1 - WX0_N);
        return clamp(40 + 26 + WORLD_TOP * k, 240, 360);
      }}
      ariaLabel={plain(one ? P.sceneLabel(P.routes[one.r.id].name, fmt(one.p.y, 1, dec), fmt(one.A, 1, dec)) : P.sceneLabelAll)}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const topPad = narrow ? 40 : 62;
        const groundY = H - (narrow ? 26 : 32);
        const axisW = narrow ? 30 : 44;
        const panelW = narrow ? 0 : Math.round(clamp(W * 0.22, 200, 260));
        const sceneR = W - panelW;
        const wx0 = narrow ? WX0_N : WX0;
        const k = Math.min((sceneR - axisW - 8) / (WX1 - wx0), (groundY - topPad) / WORLD_TOP);
        const ox = axisW + (sceneR - axisW - (WX1 - wx0) * k) / 2 - wx0 * k;
        const sx = (xm) => ox + xm * k;
        const sy = (ym) => groundY - ym * k;
        const box = { w: sceneR, h: H };
        const rB = Math.max(6, R_BALL * k);
        const pathD = (r) => r.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        const activeIds = states.map((s) => s.r.id);
        const stairsOn = activeIds.length === 1 && activeIds[0] === 'stairs';
        const curveOn = activeIds.includes('curve');

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={sceneR} y1={groundY} cell={0.5 * k} ax={sx(0)} ay={groundY} />

            {/* tower under A and pedestal under B */}
            <g aria-hidden="true">
              <rect x={sx(-1.4)} y={sy(H1)} width={1.4 * k} height={H1 * k} fill="#f1f5f9" stroke="#94a3b8" />
              {Array.from({ length: 6 }, (_, i) => (
                <path
                  key={`tw${i}`}
                  d={`M${sx(-1.4)},${sy(i)} L${sx(0)},${sy(i + 1)} M${sx(0)},${sy(i)} L${sx(-1.4)},${sy(i + 1)}`}
                  stroke="#cbd5e1"
                  strokeWidth="1"
                />
              ))}
              <rect x={sx(-1.55)} y={sy(H1) - 3} width={1.7 * k} height={4} fill="#64748b" />
              <rect x={sx(8)} y={sy(H2)} width={1.8 * k} height={H2 * k} fill="#e2e8f0" stroke="#94a3b8" />
              <rect x={sx(8)} y={sy(H2) - 2} width={1.8 * k} height={3} fill="#64748b" />
            </g>
            {stairsOn && (
              <path
                d={`${pathD(BY_ID.stairs)} L${sx(8)},${sy(0)} L${sx(0)},${sy(0)} Z`}
                fill="#fce7f3"
                stroke="none"
                opacity="0.9"
                aria-hidden="true"
              />
            )}
            {curveOn &&
              Array.from({ length: 9 }, (_, i) => {
                const p = at(BY_ID.curve, ((i + 1) / 10) * BY_ID.curve.L);
                return p.y > 0.15 ? <line key={`cp${i}`} x1={sx(p.x)} x2={sx(p.x)} y1={sy(p.y)} y2={sy(0)} stroke="#a3a3a3" strokeWidth="1.2" aria-hidden="true" /> : null;
              })}

            {/* heights h₁, h₂ */}
            <g aria-hidden="true">
              <line x1={axisW} x2={sx(-1.4)} y1={sy(H1)} y2={sy(H1)} stroke="#64748b" strokeOpacity="0.5" strokeDasharray="3 4" />
              <line x1={axisW} x2={sx(8)} y1={sy(H2)} y2={sy(H2)} stroke="#64748b" strokeOpacity="0.5" strokeDasharray="3 4" />
            </g>

            {/* the four routes */}
            {ROUTES.map((r) => {
              const on = activeIds.includes(r.id);
              return (
                <path
                  key={r.id}
                  d={pathD(r)}
                  fill="none"
                  stroke={r.color}
                  strokeWidth={on ? (all ? 3.2 : 4) : 2}
                  strokeOpacity={on ? 1 : 0.28}
                  strokeDasharray={on ? undefined : '5 5'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Δh = h₁ − h₂ */}
            {!narrow && (
              <>
                <DimLine x={sx(10.15)} y1={sy(H1)} y2={sy(H2)} color={EC.work} />
                <line x1={sx(8.2)} x2={sx(10.3)} y1={sy(H1)} y2={sy(H1)} stroke={EC.work} strokeOpacity="0.45" strokeDasharray="3 3" />
                <RichPill x={sx(10.15) - 8} y={(sy(H1) + sy(H2)) / 2} anchor="end" text={P.dhTag(smart(H1 - H2, dec))} bg="#ffffff" color="#b45309" border={EC.work} size={fs} box={box} />
              </>
            )}

            {/* points A and B */}
            <RichPill x={sx(0) - 6} y={sy(H1) - 16} anchor="end" text={P.aTag(smart(H1, dec))} bg={EC.ink} size={fs} box={box} />
            <RichPill x={sx(8.9)} y={sy(H2) + (narrow ? 14 : 18)} text={P.bTag(smart(H2, dec))} bg={EC.ink} size={fs} box={box} />

            {/* balls */}
            {states.map(({ r, p, A }) => {
              const bx = sx(p.x);
              const by = sy(p.y);
              const moving = running && p.s > 0 && p.s < r.L;
              return (
                <g key={`b${r.id}`}>
                  {moving && !all && <circle cx={bx} cy={by} r={rB + 6} fill={r.color} className="cl-pulse" />}
                  {!all && (
                    <>
                      <ForceArrow x1={bx} y1={by} x2={bx} y2={by + (narrow ? 30 : 42)} color={EC.mg} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 11} />
                      <HaloText x={bx + 7} y={by + (narrow ? 30 : 40)} size={fs} italic fill={EC.mg}>
                        mg
                      </HaloText>
                      {p.s < r.L - 1e-6 && (
                        <Arrow
                          x1={bx + p.tx * (rB + 3)}
                          y1={by - p.ty * (rB + 3)}
                          x2={bx + p.tx * (rB + (narrow ? 22 : 30))}
                          y2={by - p.ty * (rB + (narrow ? 22 : 30))}
                          color="#334155"
                          width={2.2}
                          head={8}
                        />
                      )}
                    </>
                  )}
                  <circle cx={bx} cy={by} r={rB} fill={r.color} stroke="#ffffff" strokeWidth="2" />
                  <circle cx={bx - rB * 0.35} cy={by - rB * 0.35} r={rB * 0.3} fill="#ffffff" opacity="0.45" />
                  {!all && p.s > 0 && (
                    <RichPill x={bx + rB + 8} y={by - rB - 12} anchor="start" text={P.aCounter(fmt(A, 1, dec))} bg={EC.work} size={fs} box={box} />
                  )}
                </g>
              );
            })}

            {all && done && <RichPill x={sx(8)} y={sy(H2) - rB - 16} text={P.allAtB(fmt(mg * (H1 - H2), 1, dec))} bg={EC.work} size={fs} box={box} />}

            <Ground x0={0} x1={sceneR} y={groundY} depth={H - groundY} />

            {/* h axis */}
            <g aria-hidden="true">
              <rect x={0} y={topPad - 20} width={axisW - 2} height={groundY - topPad + 20} fill="#fbfcfe" opacity="0.9" />
              <line x1={axisW - 2} x2={axisW - 2} y1={sy(7)} y2={groundY} stroke="#94a3b8" />
              {Array.from({ length: 8 }, (_, i) => (
                <g key={`ax${i}`}>
                  <line x1={axisW - 7} x2={axisW - 2} y1={sy(i)} y2={sy(i)} stroke="#64748b" />
                  <text x={axisW - 9} y={sy(i) + 4} textAnchor="end" fontSize={fs - 1} fill={i === H1 || i === H2 ? EC.ink : EC.muted} fontWeight={i === H1 || i === H2 ? 800 : 400}>
                    {i}
                  </text>
                </g>
              ))}
              <text x={4} y={sy(7) - 10} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {P.axisH}
              </text>
            </g>

            {!narrow && <EnergyColumn P={P} T={T} x0={sceneR} x1={W} top={topPad} sy={sy} groundY={groundY} states={states} all={all} done={done} mg={mg} fs={fs} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** E_p of the ball on the scene's metre scale (1 m ↔ mg J), with the work A = −ΔE_p as a bracket from A's level. */
function EnergyColumn({ P, T, x0, x1, top, sy, groundY, states, all, done, mg, fs }) {
  const dec = T.decimal;
  const axisX = x0 + 50;
  const yA = sy(H1);
  const bw = all ? 14 : 40;
  const gap = all ? 6 : 0;
  const barsX = axisX + 18;
  const brX = barsX + (all ? 4 * bw + 3 * gap : bw) + 18;
  const one = states[0];
  const yNow = sy(one.p.y);
  return (
    <g aria-hidden="true">
      <rect x={x0} y={0} width={x1 - x0} height={groundY + 40} fill="#f8fafc" opacity="0.75" />
      <line x1={x0} x2={x0} y1={10} y2={groundY + 26} stroke="#cbd5e1" strokeDasharray="4 5" />
      <text x={(x0 + x1) / 2} y={top + 8} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
        {richSvg(P.column.title, fs)}
      </text>
      <line x1={axisX} x2={axisX} y1={sy(7)} y2={groundY} stroke="#94a3b8" />
      {Array.from({ length: 8 }, (_, i) => (
        <g key={`c${i}`}>
          <line x1={axisX - 5} x2={axisX} y1={sy(i)} y2={sy(i)} stroke="#64748b" />
          <text x={axisX - 7} y={sy(i) + 4} textAnchor="end" fontSize={fs - 2} fill={EC.muted}>
            {smart(mg * i, dec)}
          </text>
        </g>
      ))}
      <text x={axisX - 7} y={sy(7) - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {T.J}
      </text>
      <line x1={axisX} x2={x1 - 8} y1={yA} y2={yA} stroke="#64748b" strokeOpacity="0.5" strokeDasharray="3 4" />
      {states.map(({ r, p }, i) => {
        const yT = sy(p.y);
        return <rect key={r.id} x={barsX + i * (bw + gap)} y={yT} width={bw} height={Math.max(0, groundY - yT)} rx={3} fill={all ? r.color : EC.ep} opacity="0.85" />;
      })}
      {!all && (
        <text x={barsX + bw / 2} y={yNow - 7} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#1d4ed8">
          {fmt(mg * one.p.y, 1, dec)}
        </text>
      )}
      <text x={barsX + (all ? 2 * bw + 1.5 * gap : bw / 2)} y={groundY + 17} textAnchor="middle" fontSize={fs + 1} fontStyle="italic" fontWeight="700" fill="#1d4ed8">
        E
        <tspan fontSize={(fs + 1) * 0.72} dy={(fs + 1) * 0.28}>
          p
        </tspan>
      </text>
      {/* A = −ΔE_p */}
      {(!all || done) && Math.abs(yNow - yA) > 2 && (
        <>
          <line x1={brX - 5} x2={brX + 5} y1={yA} y2={yA} stroke={EC.work} strokeWidth="2" />
          <line x1={brX} x2={brX} y1={yA} y2={yNow} stroke={EC.work} strokeWidth="2.6" />
          <line x1={brX - 5} x2={brX + 5} y1={yNow} y2={yNow} stroke={EC.work} strokeWidth="2" />
          <RichPill x={brX + 6} y={(yA + yNow) / 2} anchor="start" text={P.column.A(fmt(mg * (H1 - one.p.y), 1, dec))} bg={EC.work} size={fs - 1} box={{ w: x1 - 2, h: groundY }} />
        </>
      )}
    </g>
  );
}

/* ----------------------------------------------------------------- graph */

/** A(s) for every route: faint full curves, bold progress of the running ones, the level mg(h₁ − h₂). */
function WorkGraph({ P, T, mg, frac, activeIds, tried }) {
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const H = 236;
  const pad = { l: 44, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const xMax = 14;
  const yAx = niceAxis(mg * H1);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yAx.max) * (H - pad.t - pad.b);
  const line = (pts) => pts.map((p) => `${gx(p.s).toFixed(1)},${gy(mg * (H1 - p.y)).toFixed(1)}`).join(' ');
  const yTicks = [0, 1, 2, 3, 4].map((i) => i * yAx.step);
  const xTicks = [0, 2, 4, 6, 8, 10, 12, 14];
  const Af = mg * (H1 - H2);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{P.graph.title}</p>
        {ROUTES.map((r) => (
          <span key={r.id} className={`flex items-center gap-1.5 text-xs ${activeIds.includes(r.id) ? 'text-gray-200' : 'text-gray-500'}`}>
            <span className="h-0.5 w-4 rounded" style={{ background: r.light }} /> {P.routes[r.id].name}
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={P.graph.label} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yAx.digits, dec)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {v}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {P.graph.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {P.graph.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {/* the level every route ends on */}
          <line x1={pad.l} x2={W - pad.r} y1={gy(Af)} y2={gy(Af)} stroke={EC.workText} strokeOpacity="0.7" strokeDasharray="6 5" />
          <text x={W - pad.r} y={gy(Af) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill={EC.workText}>
            {P.graph.level(smart(Af, dec))}
          </text>
          {ROUTES.map((r) => (
            <polyline key={`f${r.id}`} points={line(r.pts)} fill="none" stroke={r.light} strokeOpacity={tried[r.id] ? 0.55 : 0.22} strokeWidth="1.6" strokeDasharray="4 4" />
          ))}
          {ROUTES.filter((r) => activeIds.includes(r.id)).map((r) => {
            const sNow = frac * r.L;
            const pts = r.pts.filter((p) => p.s < sNow);
            const end = at(r, sNow);
            pts.push({ s: sNow, y: end.y });
            return (
              <g key={`p${r.id}`}>
                <polyline points={line(pts)} fill="none" stroke={r.light} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={gx(sNow)} cy={gy(mg * (H1 - end.y))} r="4" fill={r.light} stroke="#0b0b16" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{rich(P.graph.note)}</p>
    </div>
  );
}
