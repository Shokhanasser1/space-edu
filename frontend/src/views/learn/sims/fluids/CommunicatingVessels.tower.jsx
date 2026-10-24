import { useState } from 'react';
import { Building2, Droplets, Lightbulb, Lock, LockOpen } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import { CV, Chip, Dial, G, GroupLabel, LIQ, LabScene, Panel, SceneRow, SurfaceLine, Sym, SymPill, surfacePoints } from './CommunicatingVessels.parts';

/**
 * Tab 4 — a water tower feeding a nine-storey house. The tank, the main under
 * the street and the riser in the house are communicating vessels: with the
 * taps shut the water in the riser stands at the tank's level H; a tap at
 * height h below H has the pressure p = ρg(H − h) and water flows from it;
 * a tap above H stays dry. A pump keeps H constant; pipe friction is left
 * out (ideal case).
 * Floors are 3 m high, taps 1.2 m above each floor: h = 1.2, 4.2 … 25.2 m.
 * Preset H = 20 m → floors 1–7 get water (1st floor: 1000·9.8·18.8 =
 * 184 240 Pa ≈ 184.2 kPa; 7th: 9.8·0.8 = 7.8 kPa); floors 8, 9 do not.
 */

const FLOORS = 9;
const STOREY = 3; // m
const TAP_UP = 1.2; // tap above the floor, m
const tapH = (n) => (n - 1) * STOREY + TAP_UP;
const TANK = { x0: 3, x1: 15, y0: 16, y1: 28 };
const H_MIN = 16.5;
const H_MAX = 27.5;
const PRESETS = [17, 20, 26];
const HOUSE = { x0: 36, x1: 54 };
const RISER_X = 38.4;
const TAP_X = 42.6;
const MAIN_Y = -2;
const RISER_TOP = tapH(FLOORS) + 0.4;
const BOX = { x0: -1.5, x1: 60.5, y0: -4.2, y1: 31.4 };
const RHO = LIQ.water.rho;
const OMEGA = 4;
const ZETA = 0.55;

const pressureAt = (H, n) => Math.max(0, RHO * G * (H - tapH(n)));
const wetFloors = (H) => Array.from({ length: FLOORS }, (_, i) => i + 1).filter((n) => tapH(n) < H - 1e-9);

function step(p, dt, target) {
  let { H, r, rv } = p;
  const n = Math.max(1, Math.ceil(dt * 120));
  const hs = dt / n;
  for (let i = 0; i < n; i += 1) {
    H += (target - H) * (1 - Math.exp(-3.2 * hs));
    if (Math.abs(target - H) < 0.002) H = target;
    const a = OMEGA * OMEGA * (H - r) - 2 * ZETA * OMEGA * rv;
    rv += a * hs;
    r += rv * hs;
  }
  return { H, r, rv, t: p.t + dt };
}

/* ==================================================================== sim */

export default function TowerSim({ T }) {
  const L = T.tower;
  const dec = T.decimal;
  const [target, setTarget] = useState(20);
  const [open, setOpen] = useState(true);
  const [floor, setFloor] = useState(8);
  const [touched, setTouched] = useState(false);
  const [sim, setSim] = useState({ H: 20, r: 20, rv: 0, t: 0 });

  const moving = Math.abs(sim.H - target) > 1e-3 || Math.abs(sim.r - sim.H) > 2e-3 || Math.abs(sim.rv) > 2e-3;
  useRafLoop(moving, (dt) => setSim((p) => step(p, dt, target)));

  const pickH = (v) => {
    setTarget(clamp(Math.round(v * 2) / 2, H_MIN, H_MAX));
    setTouched(true);
  };
  const pickFloor = (n) => {
    setFloor(n);
    setTouched(true);
  };

  const H = sim.H;
  const wet = wetFloors(H);
  const range = wet.length ? L.range(wet[0], wet[wet.length - 1]) : L.none;
  const hTap = tapH(floor);
  const dh = H - hTap;
  const p = pressureAt(H, floor);
  const H1 = (v) => fmt(v, 1, dec);

  /* ---- explanation */
  let key;
  if (moving && Math.abs(sim.H - target) > 0.05) key = 'moving';
  else if (!touched) key = 'intro';
  else if (!open) key = 'closed';
  else key = dh > 0 ? `below-${floor}` : `above-${floor}`;
  const settled = useSettled(key, key === 'moving' ? 0 : 200);
  const ex = L.explain;
  let text;
  if (settled === 'moving') text = ex.moving;
  else if (settled === 'intro') text = ex.intro(H1(H), range, wet.length < FLOORS ? L.range(wet.length + 1, FLOORS) : null);
  else if (settled === 'closed') text = ex.closed(H1(H));
  else if (settled.startsWith('below')) text = ex.below(floor, H1(dh), fmt(G, 1, dec), H1(p / 1000));
  else text = ex.above(floor, H1(-dh));
  const tone = settled === 'moving' ? '#22d3ee' : settled.startsWith('above') ? '#f87171' : settled.startsWith('below') ? '#34d399' : '#60a5fa';

  /* ---- graph p(h) */
  const line = [
    { x: 0, y: (RHO * G * H) / 1000 },
    { x: H, y: 0 },
    { x: 28, y: 0 },
  ];
  const series = [
    { id: 'p', label: L.graph.line, color: CV.pressure, dot: false, points: line },
    { id: 'now', label: L.graph.now(floor), color: '#22d3ee', points: [{ x: hTap, y: p / 1000 }] },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-3"
            size="lg"
            value={target}
            onChange={pickH}
            options={PRESETS.map((v) => {
              const w = wetFloors(v);
              return { value: v, label: L.levelTag(fmt(v, 0, dec)), sub: L.presetSub(w[0], w[w.length - 1]) };
            })}
          />
        </div>
        <Btn icon={open ? Lock : LockOpen} onClick={() => (setOpen((o) => !o), setTouched(true))} className="min-h-[52px] text-[15px] xl:min-w-[220px]">
          {open ? L.closeTaps : L.openTaps}
        </Btn>
      </div>

      <SceneRow
        minH={460}
        maxH={560}
        sideW={330}
        renderScene={(fitH) => <TowerScene T={T} sim={sim} open={open} floor={floor} onFloor={pickFloor} fitH={fitH} />}
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        side={<FloorTable T={T} H={H} floor={floor} onFloor={pickFloor} open={open} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.H} symbol="H" value={H1(H)} unit={T.m} accent={CV.level} textColor={CV.levelText} sub={L.HSub} />
        <Readout label={L.readouts.h} symbol="h" value={H1(hTap)} unit={T.m} accent="#94a3b8" sub={L.hSub(floor)} />
        <Readout
          label={L.readouts.p}
          symbol="p"
          value={dh > 0 ? H1(p / 1000) : '0'}
          unit={T.kPa}
          accent={CV.pressure}
          textColor={CV.pressureText}
          active={dh > 0}
          sub={<Sym>{dh > 0 ? L.pSub(H1(H), H1(hTap)) : L.pNo}</Sym>}
        />
        <Readout label={L.readouts.floors} value={wet.length ? range : '—'} accent="#34d399" textColor="#6ee7b7" sub={L.floorsSub(wet.length, FLOORS)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="cv-tw-h"
            label={L.HLabel}
            symbol="H"
            min={H_MIN}
            max={H_MAX}
            step={0.5}
            value={target}
            onChange={pickH}
            accent="#a78bfa"
            display={`${H1(target)} ${T.m}`}
            hint={L.HHint}
          />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{L.note}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph title={L.graph.title} series={series} xMax={28} yMax={280} xLabel={L.graph.x} yLabel={L.graph.y} decimal={dec} note={L.graph.note} ariaLabel={L.graph.label} height={190} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ floor table */

function FloorTable({ T, H, floor, onFloor, open }) {
  const L = T.tower;
  const dec = T.decimal;
  return (
    <Panel>
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
        <Building2 size={16} className="text-cyan-300" aria-hidden="true" />
        {L.table.title}
      </p>
      <div className="mt-2 grid grid-cols-[3.4rem_1fr_1fr_auto] gap-x-2 px-2 text-[11px] uppercase tracking-[0.08em] text-gray-500">
        <span>{L.table.floor}</span>
        <span>h, {T.m}</span>
        <span>p, {T.kPa}</span>
        <span />
      </div>
      <ul className="mt-1 space-y-1" role="group" aria-label={L.table.title}>
        {Array.from({ length: FLOORS }, (_, i) => FLOORS - i).map((n) => {
          const h = tapH(n);
          const wet = h < H;
          const on = n === floor;
          return (
            <li key={n}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onFloor(n)}
                className={`grid min-h-10 w-full grid-cols-[3.4rem_1fr_1fr_auto] items-center gap-x-2 rounded-lg border px-2 py-1 text-left text-sm tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 ${
                  on ? 'border-cyan-300/60 bg-cyan-400/10 text-white' : 'border-transparent text-gray-300 hover:bg-white/[0.05]'
                }`}
              >
                <span className="font-semibold">{L.floorShort(n)}</span>
                <span>{fmt(h, 1, dec)}</span>
                <span className={wet ? 'text-red-300' : 'text-gray-500'}>{wet ? fmt(pressureAt(H, n) / 1000, 1, dec) : '0'}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    wet ? (open ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-gray-300') : 'bg-red-400/15 text-red-300'
                  }`}
                >
                  {wet ? (open ? L.table.flows : L.table.ready) : L.table.dry}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ================================================================= scene */

const padFor = (narrow) => (narrow ? { l: 26, r: 8, t: 34, b: 18 } : { l: 32, r: 12, t: 50, b: 22 });

function TowerScene({ T, sim, open, floor, onFloor, fitH }) {
  const L = T.tower;
  const wet = wetFloors(sim.H);
  return (
    <LabScene
      ariaLabel={L.sceneLabel(fmt(sim.H, 1, T.decimal), wet.length ? L.range(wet[0], wet[wet.length - 1]) : L.none)}
      legend={[
        { kind: 'box', color: LIQ.water.edge, fill: LIQ.water.fill, label: L.legend.water },
        { kind: 'dash', color: CV.level, label: L.legend.level },
        { kind: 'line', color: CV.pressure, label: L.legend.pressure },
      ]}
      chips={(W, narrow) => (narrow ? null : <Chip icon={Droplets}>{L.idealChip}</Chip>)}
      height={(W, narrow) => fitH ?? clamp(((W - 40) / (BOX.x1 - BOX.x0)) * (BOX.y1 - BOX.y0) + (narrow ? 52 : 72), 300, 560)}
    >
      {(W, H, narrow) => <TowerDrawing T={T} W={W} H={H} narrow={narrow} sim={sim} open={open} floor={floor} onFloor={onFloor} />}
    </LabScene>
  );
}

function TowerDrawing({ T, W, H, narrow, sim, open, floor, onFloor }) {
  const L = T.tower;
  const dec = T.decimal;
  const view = makeView(BOX, W, H, padFor(narrow));
  const { sx, sy, k } = view;
  const fs = narrow ? 9.5 : 11.5;
  const box = { w: W, h: H };
  const water = LIQ.water;
  const level = sim.H;
  const riser = Math.min(sim.r, RISER_TOP);
  const changing = Math.abs(sim.rv) > 0.01;
  const pipeW = Math.max(3.5, k * 0.42);

  const tankSurf = surfacePoints(sx(TANK.x0) + 2, sx(TANK.x1) - 2, sy(level), { men: 1.5, amp: changing ? 1.6 : 0, phase: sim.t * 6 });

  // shaft of the tower (a tapered brick column)
  const shaft = `M${sx(4.6)},${sy(0)} L${sx(6.2)},${sy(TANK.y0)} L${sx(11.8)},${sy(TANK.y0)} L${sx(13.4)},${sy(0)} Z`;
  const bricks = [];
  for (let y = 1; y < TANK.y0; y += 1) {
    const f = y / TANK.y0;
    bricks.push(<line key={y} x1={sx(4.6 + 1.6 * f) + 1} x2={sx(13.4 - 1.6 * f) - 1} y1={sy(y)} y2={sy(y)} stroke="#b45309" strokeOpacity="0.25" strokeWidth="1" />);
  }

  const floors = Array.from({ length: FLOORS }, (_, i) => i + 1);

  return (
    <g>
      <style>{'@keyframes cv-dash{to{stroke-dashoffset:-24}}@media (prefers-reduced-motion:reduce){.cv-flow{animation:none!important}}'}</style>
      <TowerGrid view={view} W={W} axis={L.axisY} />

      {/* ground and soil */}
      <rect x={0} y={sy(0)} width={W} height={H - sy(0)} fill="#efe7da" />
      <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="#a16207" strokeWidth="2" />
      <SoilHatch W={W} y0={sy(0)} y1={H} />

      {/* main under the street and the riser in the tower */}
      <path d={`M${sx(9)},${sy(TANK.y0)} L${sx(9)},${sy(MAIN_Y)} L${sx(RISER_X)},${sy(MAIN_Y)} L${sx(RISER_X)},${sy(RISER_TOP)}`} fill="none" stroke="#475569" strokeWidth={pipeW + 3} strokeLinejoin="round" />
      <path d={`M${sx(9)},${sy(TANK.y0)} L${sx(9)},${sy(MAIN_Y)} L${sx(RISER_X)},${sy(MAIN_Y)} L${sx(RISER_X)},${sy(MAIN_Y)}`} fill="none" stroke="#bfdbfe" strokeWidth={pipeW} strokeLinejoin="round" />

      {/* the tower */}
      <path d={shaft} fill="#f3d9b1" stroke="#92400e" strokeWidth="1.5" strokeLinejoin="round" />
      {bricks}
      <line x1={sx(9)} x2={sx(9)} y1={sy(TANK.y0)} y2={sy(0)} stroke="#475569" strokeWidth={pipeW + 3} />
      <line x1={sx(9)} x2={sx(9)} y1={sy(TANK.y0)} y2={sy(0)} stroke="#bfdbfe" strokeWidth={pipeW} />
      {/* tank: cut away to show the water */}
      <rect x={sx(TANK.x0)} y={sy(TANK.y1)} width={sx(TANK.x1) - sx(TANK.x0)} height={sy(TANK.y0) - sy(TANK.y1)} fill="#f8fafc" />
      <path
        d={`M${sx(TANK.x0) + 2},${sy(TANK.y0)} L${tankSurf.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${sx(TANK.x1) - 2},${sy(TANK.y0)} Z`}
        fill={water.fill}
        fillOpacity={water.opacity}
      />
      <SurfaceLine liq={water} surface={tankSurf} />
      <rect x={sx(TANK.x0)} y={sy(TANK.y1)} width={sx(TANK.x1) - sx(TANK.x0)} height={sy(TANK.y0) - sy(TANK.y1)} fill="none" stroke="#334155" strokeWidth="2.5" />
      <path d={`M${sx(TANK.x0) - 0.4 * k},${sy(TANK.y1)} L${sx(9)},${sy(TANK.y1 + 2.4)} L${sx(TANK.x1) + 0.4 * k},${sy(TANK.y1)} Z`} fill="#94a3b8" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />
      {!narrow && (
        <text x={sx(9)} y={sy(TANK.y1 + 2.4) - 6} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155">
          {L.labels.tower}
        </text>
      )}

      {/* pump that keeps the level */}
      <path d={`M${sx(17.5)},${sy(1.4)} L${sx(17.5)},${sy(TANK.y1 - 1)} L${sx(TANK.x1)},${sy(TANK.y1 - 1)}`} fill="none" stroke="#64748b" strokeWidth={Math.max(2, pipeW * 0.5)} strokeLinejoin="round" />
      <path
        d={`M${sx(17.5)},${sy(1.4)} L${sx(17.5)},${sy(TANK.y1 - 1)} L${sx(TANK.x1)},${sy(TANK.y1 - 1)}`}
        fill="none"
        stroke="#bfdbfe"
        strokeWidth={Math.max(1, pipeW * 0.22)}
        strokeDasharray="6 18"
        className="cv-flow"
        style={{ animation: 'cv-dash 1.6s linear infinite' }}
        strokeLinejoin="round"
      />
      <rect x={sx(16.3)} y={sy(1.6)} width={sx(18.7) - sx(16.3)} height={sy(0) - sy(1.6)} rx="3" fill="#0e7490" stroke="#164e63" strokeWidth="1.2" />
      {!narrow && (
        <text x={sx(17.5)} y={sy(0) + fs + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#475569">
          {L.labels.pump}
        </text>
      )}

      {/* the house */}
      <House sx={sx} sy={sy} k={k} floor={floor} onFloor={onFloor} />

      {/* riser in the house: water up to the level that communicating vessels give */}
      <line x1={sx(RISER_X)} x2={sx(RISER_X)} y1={sy(MAIN_Y)} y2={sy(RISER_TOP)} stroke="#475569" strokeWidth={pipeW + 3} strokeLinecap="round" />
      <line x1={sx(RISER_X)} x2={sx(RISER_X)} y1={sy(MAIN_Y)} y2={sy(RISER_TOP)} stroke="#f8fafc" strokeWidth={pipeW} strokeLinecap="round" />
      <line x1={sx(RISER_X)} x2={sx(RISER_X)} y1={sy(MAIN_Y)} y2={sy(riser)} stroke="#93c5fd" strokeWidth={pipeW} />
      {riser < RISER_TOP - 0.05 && <line x1={sx(RISER_X) - pipeW / 2} x2={sx(RISER_X) + pipeW / 2} y1={sy(riser)} y2={sy(riser)} stroke={water.edge} strokeWidth="2" />}

      {/* taps, streams, gauges */}
      {floors.map((n) => (
        <Tap key={n} n={n} sx={sx} sy={sy} k={k} H={level} riser={riser} open={open} narrow={narrow} sel={n === floor} pipeW={pipeW} fs={fs} dec={dec} T={T} />
      ))}

      {/* the level of the tank carried across */}
      <line x1={sx(TANK.x0) - 4} x2={sx(HOUSE.x1) + 0.8 * k} y1={sy(level)} y2={sy(level)} stroke={CV.level} strokeWidth="1.5" strokeDasharray="7 5" />
      <SymPill x={sx(26)} y={sy(level)} text={L.levelTag(fmt(level, 1, dec))} bg={CV.level} fs={fs} box={box} />
      {!narrow && (
        <text x={sx(24)} y={sy(MAIN_Y) - pipeW - 4} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#78350f">
          {L.labels.main}
        </text>
      )}
    </g>
  );
}

function House({ sx, sy, k, floor, onFloor }) {
  const rows = [];
  for (let n = 1; n <= FLOORS; n += 1) {
    const y0 = (n - 1) * STOREY;
    rows.push(
      <g key={n} onClick={() => onFloor(n)} style={{ cursor: 'pointer' }}>
        <rect
          x={sx(HOUSE.x0)}
          y={sy(y0 + STOREY)}
          width={sx(HOUSE.x1) - sx(HOUSE.x0)}
          height={sy(y0) - sy(y0 + STOREY)}
          fill={n === floor ? '#e0f2fe' : n % 2 ? '#f8fafc' : '#f1f5f9'}
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {[47.5, 51].map((x) => (
          <rect key={x} x={sx(x)} y={sy(y0 + 2.4)} width={2 * k} height={1.4 * k} rx="1.5" fill={n === floor ? '#7dd3fc' : '#bae6fd'} stroke="#64748b" strokeWidth="0.8" />
        ))}
        <text x={sx(HOUSE.x0) - 5} y={sy(y0 + 1.5) + 4} textAnchor="end" fontSize="10.5" fontWeight={n === floor ? 800 : 600} fill={n === floor ? '#0369a1' : '#64748b'}>
          {n}
        </text>
      </g>,
    );
  }
  return (
    <g>
      {rows}
      <rect x={sx(HOUSE.x0)} y={sy(FLOORS * STOREY)} width={sx(HOUSE.x1) - sx(HOUSE.x0)} height={sy(0) - sy(FLOORS * STOREY)} fill="none" stroke="#475569" strokeWidth="2" pointerEvents="none" />
      <rect x={sx(HOUSE.x0) - 0.4 * k} y={sy(FLOORS * STOREY + 0.6)} width={sx(HOUSE.x1) - sx(HOUSE.x0) + 0.8 * k} height={0.6 * k} fill="#64748b" pointerEvents="none" />
    </g>
  );
}

function Tap({ n, sx, sy, k, H, riser, open, narrow, sel, pipeW, fs, dec, T }) {
  const h = tapH(n);
  const wetPipe = riser > h;
  const flows = open && h < H && wetPipe;
  const p = pressureAt(H, n);
  const y = sy(h);
  const xs = sx(TAP_X);
  const sinkY = sy(h - 1.05);
  const v = Math.sqrt(2 * G * Math.max(0, H - h));
  const dur = flows ? clamp(4 / Math.max(v, 0.5), 0.18, 2.5) : 0;
  const width = flows ? clamp(1.4 + Math.sqrt(p / 1000) * 0.32, 1.6, 5.5) : 0;
  return (
    <g pointerEvents="none">
      {/* branch from the riser to the tap */}
      <line x1={sx(RISER_X)} x2={xs} y1={y} y2={y} stroke="#475569" strokeWidth={pipeW * 0.7 + 2} strokeLinecap="round" />
      <line x1={sx(RISER_X)} x2={xs} y1={y} y2={y} stroke={wetPipe ? '#93c5fd' : '#f8fafc'} strokeWidth={pipeW * 0.7} strokeLinecap="round" />
      {/* tap body and spout */}
      <path d={`M${xs},${y - 2} l${0.9 * k},0 l0,${0.6 * k}`} fill="none" stroke="#334155" strokeWidth={Math.max(2.4, k * 0.22)} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs} cy={y - 3.5} r={Math.max(2.2, k * 0.18)} fill={flows ? CV.open : open ? '#94a3b8' : CV.closed} />
      {/* sink */}
      <path d={`M${xs - 0.2 * k},${sinkY} l${0.4 * k},${0.7 * k} l${1.6 * k},0 l${0.4 * k},${-0.7 * k}`} fill="#e2e8f0" stroke="#64748b" strokeWidth="1.2" strokeLinejoin="round" />
      {/* stream */}
      {flows && (
        <>
          <line x1={xs + 0.9 * k} x2={xs + 0.9 * k} y1={y - 2 + 0.6 * k} y2={sinkY + 0.4 * k} stroke={LIQ.water.fill} strokeWidth={width} strokeLinecap="round" />
          <line
            x1={xs + 0.9 * k}
            x2={xs + 0.9 * k}
            y1={y - 2 + 0.6 * k}
            y2={sinkY + 0.4 * k}
            stroke="#fff"
            strokeWidth={Math.max(1, width * 0.35)}
            strokeDasharray="4 8"
            className="cv-flow"
            style={{ animation: `cv-dash ${dur.toFixed(2)}s linear infinite` }}
          />
        </>
      )}
      {open && !flows && h >= H && (
        <text x={xs + 0.9 * k} y={sinkY - 2} textAnchor="middle" fontSize={fs - 1} fontWeight="800" fill={CV.closed}>
          ×
        </text>
      )}
      {/* gauge */}
      {!narrow && <Dial x={sx(45.6)} y={y - 1} r={Math.min(10, k * 0.75)} value={p / 1000} max={280} />}
      {!narrow && (
        <text x={sx(HOUSE.x1) + 0.8 * k} y={y + 4} fontSize={fs - 0.5} fontWeight={sel ? 800 : 600} fill={p > 0 ? CV.pressure : '#94a3b8'}>
          {p > 0 ? `${fmt(p / 1000, 0, dec)} ${T.kPa}` : `0 ${T.kPa}`}
        </text>
      )}
    </g>
  );
}

function TowerGrid({ view, W, axis }) {
  const lines = [];
  const nums = [];
  for (let y = 0; y <= 30; y += 2) {
    lines.push(<line key={`y${y}`} x1={0} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={y % 10 === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" />);
    if (y % 4 === 0) {
      nums.push(
        <text key={`n${y}`} x={6} y={view.sy(y) + 4} fontSize="10.5" fill="#64748b">
          {y}
        </text>,
      );
    }
  }
  for (let x = 0; x <= 58; x += 2) {
    lines.push(<line key={`x${x}`} x1={view.sx(x)} x2={view.sx(x)} y1={0} y2={view.sy(0)} stroke={x % 10 === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" />);
  }
  return (
    <g aria-hidden="true">
      {lines}
      {nums}
      <text x={6} y={view.sy(30) - 8} fontSize="10.5" fontWeight="700" fill="#475569">
        {axis}
      </text>
    </g>
  );
}

function SoilHatch({ W, y0, y1 }) {
  const out = [];
  const d = y1 - y0;
  for (let x = -d; x < W; x += 16) out.push(<line key={x} x1={x} y1={y1} x2={x + d} y2={y0} stroke="#d6c7ad" strokeWidth="1" />);
  return <g aria-hidden="true">{out}</g>;
}

