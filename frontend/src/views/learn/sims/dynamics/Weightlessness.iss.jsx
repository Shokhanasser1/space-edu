import { useState } from 'react';
import { Lightbulb, Magnet, Unlink } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, groupThousands, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { C, Chip, G, GroupLabel, Label, LabScene, PlayControls, Person, Vec } from './Weightlessness.parts';

/**
 * Tab 2 — the ISS. The station orbits at height h (400 km by default) where
 * g_h = g·R²/(R+h)² ≈ 8.7 m/s² — 89 % of the surface value. It moves at
 * v = √(g_h·(R+h)) ≈ 7.66 km/s and keeps "falling" around the Earth; the
 * astronaut inside falls with the same acceleration, so the floor does not
 * press on her: P = 0 while mg ≠ 0. The thought experiment "what if gravity
 * were really zero?" sends the station off along the tangent.
 */

const R_E = 6371; // km
const GM = (G / 1000) * R_E * R_E; // km³/s² from g·R²
const SPEED = 400; // screen time ×400
const M_ASTRO = 70; // kg
const BOX = 9300; // km, half-size of the drawn world
const TH0 = 2.25; // rad, where the station starts
const IDLE = { t: 0, th: TH0, running: false, free: null, gone: false };

const gAt = (h) => G * (R_E / (R_E + h)) ** 2; // m/s²
const vAt = (h) => Math.sqrt(GM / (R_E + h)); // km/s
const periodAt = (h) => (2 * Math.PI * (R_E + h)) / vAt(h); // s

export default function IssSim({ T }) {
  const L = T.iss;
  const dec = T.decimal;
  const [h, setH] = useState(400);
  const [grav, setGrav] = useState(true);
  const [sim, setSim] = useState(IDLE);
  const r = R_E + h;
  const v = vAt(h);
  const gh = gAt(h);
  const period = periodAt(h);
  const started = sim.running || sim.t > 0;

  const startFree = (th) => {
    const x = r * Math.cos(th);
    const y = r * Math.sin(th);
    return { x, y, x0: x, y0: y, vx: -v * Math.sin(th), vy: v * Math.cos(th) };
  };

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const dts = dt * SPEED;
      if (!grav) {
        const f = p.free ?? startFree(p.th);
        const nf = { ...f, x: f.x + f.vx * dts, y: f.y + f.vy * dts };
        const gone = Math.max(Math.abs(nf.x), Math.abs(nf.y)) > BOX * 1.15;
        return { ...p, t: p.t + dts, free: nf, running: !gone, gone };
      }
      return { ...p, t: p.t + dts, th: p.th + (v / r) * dts };
    });
  });

  const toggle = () => {
    if (sim.gone) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickGrav = (on) => {
    setGrav(on);
    setSim((p) => (on ? { ...p, free: null, gone: false } : { ...p, free: p.free ?? (p.t > 0 ? startFree(p.th) : null) }));
  };

  const drop1 = 0.5 * gh; // m fallen below the straight line in 1 s
  const F1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);

  let key = 'idle';
  if (sim.gone) key = 'gone';
  else if (!grav && started) key = 'free';
  else if (!grav) key = 'freeIdle';
  else if (started) key = (sim.t / period) % 1 < 0.5 ? 'orbit' : 'astro';
  const settled = useSettled(key, key === 'orbit' || key === 'astro' ? 250 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle(groupThousands(h)),
    orbit: ex.orbit(F2(v), F1(drop1)),
    astro: ex.astro(F1(gh)),
    free: ex.free(F2(v)),
    freeIdle: ex.freeIdle,
    gone: ex.gone,
  }[settled];
  const tone = { idle: '#22d3ee', orbit: '#fb923c', astro: '#f472b6', free: '#34d399', freeIdle: '#94a3b8', gone: '#f87171' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.gravLabel}</GroupLabel>
          <Segmented
            label={L.gravLabel}
            className="grid-cols-1 sm:grid-cols-2"
            size="lg"
            value={grav}
            onChange={pickGrav}
            accent={grav ? '#fb923c' : '#34d399'}
            options={[
              { value: true, label: L.grav.on.name, sub: L.grav.on.sub, icon: Magnet },
              { value: false, label: L.grav.off.name, sub: L.grav.off.sub, icon: Unlink },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.gone} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <IssScene T={T} h={h} grav={grav} sim={sim} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.g}
          symbol="gₕ"
          value={grav ? F2(gh) : '0'}
          unit={T.ms2}
          accent={C.acc}
          textColor={C.accText}
          sub={grav ? L.readouts.gSub(fmt((gh / G) * 100, 0, dec)) : L.readouts.gOff}
        />
        <Readout label={L.readouts.v} symbol="v" value={F2(v)} unit={T.common.kms} accent={C.vel} textColor={C.velText} sub={L.readouts.vSub(groupThousands(Math.round((v * 3600) / 100) * 100))} />
        <Readout
          label={L.readouts.T}
          symbol="T"
          value={F1(period / 60)}
          unit={T.common.min}
          accent={C.time}
          textColor="#a5f3fc"
          sub={L.readouts.TSub(F1(86400 / period))}
        />
        <Readout label={L.readouts.astro(M_ASTRO)} accent={C.P}>
          <div className="mt-1.5 space-y-0.5 tabular-nums">
            <p className="text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: C.mgText }}>
              mg = {grav ? fmt(M_ASTRO * gh, 0, dec) : '0'} <span className="text-sm font-normal text-gray-400">{T.common.N}</span>
            </p>
            <p className="text-[19px] sm:text-[22px] font-bold leading-tight" style={{ color: C.PText }}>
              P = 0 <span className="text-sm font-normal text-gray-400">{T.common.N}</span>
            </p>
          </div>
          <p className="mt-auto pt-1.5 text-xs text-gray-400 tabular-nums leading-snug">{L.readouts.astroSub(fmt(M_ASTRO * G, 0, dec))}</p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wl-iss-h"
            label={L.hSlider}
            symbol="h"
            min={200}
            max={2000}
            step={10}
            value={h}
            onChange={(n) => {
              setH(n);
              setSim(IDLE);
            }}
            accent={PALETTE.path}
            display={`${groupThousands(h)} ${T.km}`}
            hint={L.hHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-relaxed">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.formulaTitle}</p>
            <p className="mt-1 tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">gₕ = g · R² / (R + h)²</span> = {F1(G)} · ({groupThousands(R_E)} / {groupThousands(r)})² ={' '}
              <b style={{ color: C.accText }}>{F2(gh)}</b> {T.ms2}
            </p>
            <p className="tabular-nums text-gray-300">
              <span className="font-serif italic text-gray-100">v = √(gₕ · (R + h))</span> = <b style={{ color: C.velText }}>{F2(v)}</b> {T.common.kms}
            </p>
            <p className="tabular-nums text-gray-300">{L.oneSecond(F2(v), F1(drop1))}</p>
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.compare.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [L.compare.surface, fmt(G, 2, dec)],
                [L.compare.iss, fmt(gAt(400), 2, dec)],
                [L.compare.moon, fmt(G * (R_E / 384400) ** 2, 4, dec)],
              ].map(([k, val]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: C.accText }}>
                    {val} <span className="text-[11px] font-normal text-gray-500">{T.ms2}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-xs leading-snug text-gray-500">{L.compare.note}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <GGraph T={T} h={h} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- graph */

const G_CURVE = Array.from({ length: 41 }, (_, i) => ({ x: i * 50, y: gAt(i * 50) }));

function GGraph({ T, h }) {
  const L = T.iss.graph;
  return (
    <TimeGraph
      title={L.title}
      series={[
        { id: 'g', label: L.g, color: '#fb923c', dot: false, points: G_CURVE },
        { id: 'now', label: L.now, color: '#fdba74', points: [{ x: h, y: gAt(h) }] },
      ]}
      xMax={2000}
      yMax={10}
      xLabel={L.x}
      yLabel={L.y}
      marker={h}
      decimal={T.decimal}
      yDigits={1}
      note={L.note(fmt(100 - (gAt(400) / G) * 100, 0, T.decimal))}
      ariaLabel={L.label}
    />
  );
}

/* --------------------------------------------------------------- scene */

const CONTINENTS = [
  // polar blobs: [angle (rad), radius fraction] around the disc, drawn as smooth closed paths
  [
    [0.2, 0.55],
    [0.55, 0.78],
    [0.95, 0.7],
    [1.2, 0.45],
    [0.8, 0.3],
    [0.35, 0.33],
  ],
  [
    [2.3, 0.62],
    [2.75, 0.85],
    [3.3, 0.72],
    [3.55, 0.4],
    [3.0, 0.25],
    [2.5, 0.35],
  ],
  [
    [4.4, 0.5],
    [4.9, 0.8],
    [5.5, 0.62],
    [5.6, 0.3],
    [5.0, 0.18],
  ],
];

function blobPath(pts, cx, cy, R, rot) {
  const xy = pts.map(([a, f]) => [cx + Math.cos(a + rot) * f * R, cy - Math.sin(a + rot) * f * R]);
  const n = xy.length;
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const p0 = xy[i];
    const p1 = xy[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    d += i === 0 ? `M${mx.toFixed(1)},${my.toFixed(1)}` : '';
    const p2 = xy[(i + 2) % n];
    const nx = (p1[0] + p2[0]) / 2;
    const ny = (p1[1] + p2[1]) / 2;
    d += ` Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${nx.toFixed(1)},${ny.toFixed(1)}`;
  }
  return `${d} Z`;
}

function IssIcon({ x, y, angle, s = 1 }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${s})`}>
      <line x1={-15} x2={15} y1={0} y2={0} stroke="#475569" strokeWidth={2.2} />
      {[-13, -8, 8, 13].map((px) => (
        <rect key={px} x={px - 2} y={-11} width={4} height={22} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth={0.6} />
      ))}
      <rect x={-5} y={-3.2} width={10} height={6.4} rx={2.5} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
    </g>
  );
}

function IssScene({ T, h, grav, sim }) {
  const L = T.iss;
  const dec = T.decimal;
  const r = R_E + h;
  const v = vAt(h);
  const gh = gAt(h);
  const free = sim.free;
  const pos = free ? { x: free.x, y: free.y } : { x: r * Math.cos(sim.th), y: r * Math.sin(sim.th) };
  const vel = free ? { x: free.vx, y: free.vy } : { x: -v * Math.sin(sim.th), y: v * Math.cos(sim.th) };
  const minutes = sim.t / 60;

  return (
    <LabScene
      legend={[
        { color: PALETTE.path, label: L.legend.orbit, kind: 'line' },
        { color: C.vel, label: L.legend.v, kind: 'arrow' },
        { color: C.acc, label: L.legend.a, kind: 'arrow' },
        { color: C.mg, label: L.legend.mg, kind: 'arrow' },
        { color: C.vel, label: L.legend.straight, kind: 'dash' },
      ]}
      chips={
        <>
          <Chip>
            {L.speedChip(SPEED)} · t = {fmt(minutes, 0, dec)} {T.common.min}
          </Chip>
          {!grav && (
            <Chip icon={Unlink} color="#059669" strong>
              {L.thoughtChip}
            </Chip>
          )}
        </>
      }
      height={(W, narrow) => (narrow ? W + 236 : 480)}
      ariaLabel={L.sceneLabel(groupThousands(h), fmt(gh, 1, dec), fmt(v, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const top = narrow ? 48 : 60;
        const bottom = 14;
        const EW = narrow ? W : Math.min(W * 0.55, H - top - bottom + 120);
        const EH = narrow ? W - 10 : H - top - bottom;
        const cx = EW / 2 + (narrow ? 0 : 8);
        const cy = top + EH / 2 - (narrow ? 4 : 0);
        const k = (Math.min(EW - 24, EH) / 2) / BOX;
        const sx = (x) => cx + x * k;
        const sy = (y) => cy - y * k;
        const R = R_E * k;
        const rot = (sim.t / 86164) * 2 * Math.PI;
        const px = sx(pos.x);
        const py = sy(pos.y);
        const vs = narrow ? 7 : 9; // px per km/s
        const as = narrow ? 5.5 : 7; // px per m/s²
        const vlen = Math.hypot(vel.x, vel.y);
        const ux = vel.x / vlen;
        const uy = vel.y / vlen;
        const dist = Math.hypot(pos.x, pos.y);
        const angle = (Math.atan2(-uy, ux) * 180) / Math.PI;
        const grid = 2000;
        const gridLines = [];
        for (let g = -8000; g <= 8000; g += grid) {
          gridLines.push(<line key={`gx${g}`} x1={sx(g)} x2={sx(g)} y1={top - 8} y2={top + EH} stroke={g === 0 ? '#cbd5e1' : '#eef2f7'} />);
          gridLines.push(<line key={`gy${g}`} x1={Math.max(0, cx - EW / 2)} x2={cx + EW / 2} y1={sy(g)} y2={sy(g)} stroke={g === 0 ? '#cbd5e1' : '#eef2f7'} />);
        }
        // trail: the arc flown in the last quarter orbit, or the straight flight
        const trail = [];
        if (!free && sim.t > 0) {
          const span = Math.min(sim.th - TH0, Math.PI * 0.6);
          for (let i = 0; i <= 40; i += 1) {
            const a = sim.th - span + (span * i) / 40;
            trail.push(`${sx(r * Math.cos(a)).toFixed(1)},${sy(r * Math.sin(a)).toFixed(1)}`);
          }
        }
        const lineEnd = BOX * 2.2;

        /* inset: inside the station */
        const ins = narrow
          ? { x: 10, y: top + EH + 6, w: W - 20, h: H - (top + EH + 6) - 10 }
          : { x: EW + 26, y: top + 4, w: W - EW - 42, h: H - top - 22 };
        const port = { x: ins.x + ins.w * 0.84, y: ins.y + ins.h * 0.5, r: Math.min(ins.h * 0.16, ins.w * 0.09, 34) };
        const astroH = Math.min(ins.h * 0.5, ins.w * 0.32, 160);
        const sway = Math.sin(sim.t / 260) * 0.6;
        const ax = ins.x + ins.w * (narrow ? 0.4 : 0.44) + sway * 6;
        const hipY = ins.y + ins.h * 0.47 + Math.cos(sim.t / 330) * 4; // the astronaut's centre (hip)
        const ay = hipY + 0.5 * astroH;
        const band = Math.max(18, ins.h * 0.1);
        const kF = narrow ? 0.085 : 0.11; // px per newton in the inset
        const mgA = grav ? M_ASTRO * gh : 0;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <g aria-hidden="true">{gridLines}</g>
            <defs>
              <radialGradient id="wl-earth" cx="38%" cy="35%" r="75%">
                <stop offset="0" stopColor="#60a5fa" />
                <stop offset="0.7" stopColor="#2563eb" />
                <stop offset="1" stopColor="#1e3a8a" />
              </radialGradient>
              <clipPath id="wl-earth-clip">
                <circle cx={cx} cy={cy} r={R} />
              </clipPath>
              <clipPath id="wl-iss-view">
                <rect x={0} y={top - 10} width={EW + (narrow ? 0 : 16)} height={EH + 14} />
              </clipPath>
              <clipPath id="wl-iss-port">
                <circle cx={port.x} cy={port.y} r={port.r} />
              </clipPath>
              <clipPath id="wl-iss-inset">
                <rect x={ins.x} y={ins.y} width={ins.w} height={ins.h} rx={16} />
              </clipPath>
            </defs>

            <g clipPath="url(#wl-iss-view)">
              {/* atmosphere and Earth */}
              <circle cx={cx} cy={cy} r={R + 4} fill="#bfdbfe" opacity="0.7" />
              <circle cx={cx} cy={cy} r={R} fill="url(#wl-earth)" />
              <g clipPath="url(#wl-earth-clip)" opacity="0.9">
                {CONTINENTS.map((c, i) => (
                  <path key={i} d={blobPath(c, cx, cy, R, rot)} fill="#4ade80" stroke="#16a34a" strokeWidth={1} opacity="0.85" />
                ))}
              </g>
              <Label x={cx} y={cy + R * 0.55} size={fs + 1} color="#eff6ff" halo="#1e3a8a">
                {L.earth}
              </Label>
              {/* centre and radius */}
              <circle cx={cx} cy={cy} r={2.5} fill="#eff6ff" />

              {/* the orbit */}
              <circle cx={cx} cy={cy} r={r * k} fill="none" stroke={PALETTE.path} strokeOpacity={free ? 0.3 : 0.55} strokeWidth={1.6} strokeDasharray="6 6" />
              {trail.length > 1 && <polyline points={trail.join(' ')} fill="none" stroke={PALETTE.path} strokeWidth={3.5} strokeLinecap="round" />}
              {free && <line x1={sx(free.x0)} y1={sy(free.y0)} x2={px} y2={py} stroke={PALETTE.path} strokeWidth={3.5} strokeLinecap="round" />}

              {/* the straight line it would follow without gravity */}
              {grav && (
                <line x1={px} y1={py} x2={px + ux * lineEnd * k} y2={py - uy * lineEnd * k} stroke={C.vel} strokeOpacity="0.5" strokeWidth={1.5} strokeDasharray="5 5" />
              )}

              {/* height tag */}
              {!free && (
                <>
                  <line x1={sx(R_E * Math.cos(sim.th))} y1={sy(R_E * Math.sin(sim.th))} x2={px} y2={py} stroke="#334155" strokeWidth={1.2} />
                </>
              )}

              {/* vectors */}
              {grav && dist > 1 && (
                <Vec
                  x={px}
                  y={py}
                  dx={(-pos.x / dist) * gAt(dist - R_E) * as}
                  dy={(pos.y / dist) * gAt(dist - R_E) * as}
                  color={C.acc}
                  size={fs}
                  width={3}
                  head={10}
                />
              )}
              {grav && dist > 1 && (
                <Pill
                  x={px - (pos.x / dist) * (gAt(dist - R_E) * as + (narrow ? 20 : 26))}
                  y={py + (pos.y / dist) * (gAt(dist - R_E) * as + (narrow ? 14 : 18))}
                  text={L.tags.a}
                  bg={C.acc}
                  size={fs - 1}
                />
              )}
              <Vec x={px} y={py} dx={ux * vlen * vs} dy={-uy * vlen * vs} color={C.vel} label="v" size={fs + 1} width={3} head={10} gap={6} />
              <IssIcon x={px} y={py} angle={angle} s={narrow ? 0.85 : 1} />
              {!free && (
                <Pill
                  x={px + (pos.x / dist) * (narrow ? 30 : 38)}
                  y={py - (pos.y / dist) * (narrow ? 26 : 32)}
                  text={L.tags.iss(groupThousands(h))}
                  bg={C.ink}
                  size={fs - 1}
                  box={{ w: EW, h: H }}
                />
              )}
              {sim.running && <circle cx={px} cy={py} r={14} fill={PALETTE.path} className="cl-pulse" opacity="0.3" />}

              {/* km scale bar */}
              <g transform={`translate(${narrow ? 12 : 18} ${top + EH - 8})`}>
                <line x1={0} x2={2000 * k} y1={0} y2={0} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
                <line x1={0} x2={0} y1={-5} y2={5} stroke={C.ink} strokeWidth={1.5} />
                <line x1={2000 * k} x2={2000 * k} y1={-5} y2={5} stroke={C.ink} strokeWidth={1.5} />
                <text x={2000 * k + 8} y={4} fontSize={fs - 1} fill="#475569">
                  {L.kmScale(groupThousands(2000))}
                </text>
              </g>
              {!narrow && (
                <text x={EW - 6} y={top + EH - 4} textAnchor="end" fontSize={fs - 1} fill="#94a3b8">
                  {L.notToScale}
                </text>
              )}
            </g>

            {/* ================= inset: inside the station */}
            <g>
              <rect x={ins.x} y={ins.y} width={ins.w} height={ins.h} rx={16} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
              <g clipPath="url(#wl-iss-inset)">
                {/* module: racks along the ceiling and the floor, handrails */}
                {[ins.y + 26, ins.y + ins.h - 26 - band].map((y0, j) => {
                  const nr = Math.max(3, Math.floor(ins.w / 70));
                  const rw = (ins.w - 20) / nr;
                  return (
                    <g key={`band${j}`}>
                      <rect x={ins.x} y={y0} width={ins.w} height={band} fill="#cbd5e1" />
                      {Array.from({ length: nr }, (_, i) => i).map((i) => (
                        <g key={`rk${j}${i}`}>
                          <rect x={ins.x + 10 + i * rw} y={y0 + 3} width={rw - 8} height={band - 6} rx={3} fill="#e2e8f0" stroke="#94a3b8" />
                          <circle cx={ins.x + 18 + i * rw} cy={y0 + band / 2} r={2} fill={['#22c55e', '#f59e0b', '#38bdf8'][i % 3]} />
                        </g>
                      ))}
                      <line
                        x1={ins.x + 8}
                        x2={ins.x + ins.w - 8}
                        y1={j === 0 ? y0 + band + 4 : y0 - 4}
                        y2={j === 0 ? y0 + band + 4 : y0 - 4}
                        stroke="#facc15"
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    </g>
                  );
                })}
                {/* porthole with the Earth below */}
                <circle cx={port.x} cy={port.y} r={port.r} fill="#0f172a" />
                <circle cx={port.x} cy={port.y + port.r * 2.6} r={port.r * 2.15} fill="#3b82f6" clipPath="url(#wl-iss-port)" />
                <circle cx={port.x} cy={port.y} r={port.r} fill="none" stroke="#64748b" strokeWidth={4} />
                {/* floating things */}
                <circle cx={ins.x + ins.w * 0.66 + Math.sin(sim.t / 200) * 5} cy={ins.y + ins.h * 0.32 + Math.cos(sim.t / 240) * 4} r={7} fill="#7dd3fc" stroke="#0284c7" />
                <g transform={`translate(${ins.x + ins.w * 0.18} ${ins.y + ins.h * 0.3}) rotate(${(sim.t / 20) % 360})`}>
                  <rect x={-11} y={-2} width={22} height={4} rx={2} fill="#f97316" />
                </g>
                <Person x={ax} y={ay} h={astroH} pose="float" grounded={false} facing={1} shirt="#7c3aed" rotate={-58 + sway * 12} />
              </g>
              <Label x={ins.x + 16} y={ins.y + 18} anchor="start" size={fs} color="#334155" weight={700} halo="#f1f5f9">
                {L.insideTag}
              </Label>
              {grav ? (
                <>
                  <Vec x={ax} y={hipY} dx={0} dy={mgA * kF} color={C.mg} label={L.tags.mg(fmt(mgA, 0, dec))} place="left" size={fs} width={3} head={10} />
                  <Vec x={ax + astroH * 0.55} y={hipY - astroH * 0.1} dx={0} dy={gh * as} color={C.acc} label={L.tags.a} place="right" size={fs} width={2.6} head={9} />
                  <Pill x={ins.x + ins.w * 0.5} y={ins.y + ins.h - 15} text={L.tags.NP0} bg={C.P} size={fs - 1} />
                  <Label x={ins.x + ins.w - 14} y={ins.y + ins.h - 34 - band} anchor="end" size={fs - 1} color="#64748b" weight={600} halo="#f1f5f9">
                    {L.toEarth}
                  </Label>
                </>
              ) : (
                <Pill x={ins.x + ins.w * 0.5} y={ins.y + ins.h - 15} text={L.tags.noForce} bg="#059669" size={fs - 1} />
              )}
            </g>
          </>
        );
      }}
    </LabScene>
  );
}
