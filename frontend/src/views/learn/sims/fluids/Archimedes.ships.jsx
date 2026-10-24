import { useState } from 'react';
import { ArrowDownUp, Flame, Lightbulb, PackagePlus, RotateCcw, Ship } from 'lucide-react';
import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import { COL, Calc, G, LIQUIDS, LIQ_SWATCH, LiquidGradient, Panel, PanelTitle, RichPill, SimScene, Tag, TimeChip, Toolbar, intText, num, rich, surfacePath, ForceArrow } from './Archimedes.parts';
import BalloonSim from './Archimedes.balloon';

/**
 * Archimedes' force at work: one tab, three machines.
 *
 *   boat     - a box-shaped barge (20 m × 5 m, hull 2.25 m deep, 30 t empty)
 *              sinks until the water it pushes aside weighs as much as the
 *              barge with its cargo: draft d = m/(ρ·L·B). Its load line is at
 *              1.5 m, so its displacement there is 150 t and it may carry
 *              120 t in a river (124.5 t at sea). Past 195 t (200 t at sea)
 *              the deck goes under and it sinks.
 *   sub      - a submarine of 500 m³ and 450 t floods or blows its ballast
 *              tanks (100 m³ of sea water at most): heavier than 515 t it
 *              dives, lighter it surfaces, at 63 m³ of ballast it hangs.
 *   balloon  - see Archimedes.balloon.jsx.
 */

export default function ShipsSim({ T }) {
  const tx = T.ships;
  const [mode, setMode] = useState('boat');
  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.modeLabel}</p>
        <Segmented
          label={tx.modeLabel}
          className="grid-cols-1 sm:grid-cols-3"
          size="lg"
          value={mode}
          onChange={setMode}
          accent="#22d3ee"
          options={[
            { value: 'boat', label: tx.modes.boat.name, sub: tx.modes.boat.sub, icon: Ship },
            { value: 'sub', label: tx.modes.sub.name, sub: tx.modes.sub.sub, icon: ArrowDownUp },
            { value: 'balloon', label: tx.modes.balloon.name, sub: tx.modes.balloon.sub, icon: Flame },
          ]}
        />
      </div>
      {mode === 'boat' && <BoatSim T={T} />}
      {mode === 'sub' && <SubSim T={T} />}
      {mode === 'balloon' && <BalloonSim T={T} />}
    </div>
  );
}

/* =================================================================== boat */

const BARGE = { L: 20, B: 5, H: 2.25, m0: 30, line: 1.5 }; // m, m, m, t, m
const RIVER_BED = -7; // m
const CARGO_MAX = 220; // t
const BLOCK = { w: 1.95, h: 1.0, per: 9, x0: -7.55 }; // cargo blocks: 9 per layer from x0
const WATER_IDS = ['water', 'sea'];
const BLOCK_COLORS = ['#dc2626', '#2563eb', '#ea580c', '#059669', '#7c3aed', '#0891b2'];

const boatStart = (cargo = 0) => ({ cargo, load: cargo, y: -draftEq(cargo, 1000), v: 0, sunk: false, flood: 0, t: 0, added: {}, active: false, phase: 0 });

function draftEq(cargo, rho) {
  return ((BARGE.m0 + cargo) * 1000) / (rho * BARGE.L * BARGE.B);
}

function boatStep(p, dt, rho) {
  const t = p.t + dt;
  // the cargo goes on block by block, not all at once
  const load = p.load + clamp(p.cargo - p.load, -40 * dt, 40 * dt);
  const M = (BARGE.m0 + load) * 1000;
  let { y, v, sunk, flood } = p;
  if (sunk) {
    // flooded: it goes down to the river bed, slowed by the water
    const target = RIVER_BED;
    v = Math.max(-1.2, v - 0.9 * dt);
    y = Math.max(target, y + v * dt);
    if (y <= target) v = 0;
    flood = Math.min(1, flood + dt * 0.8);
  } else {
    const k = rho * G * BARGE.L * BARGE.B;
    const mEff = M * 1.25;
    const c = 2 * 0.22 * Math.sqrt(k * mEff);
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      const d = clamp(-y, 0, BARGE.H);
      const F = rho * G * BARGE.L * BARGE.B * d - M * G - c * v;
      v += (F / mEff) * h;
      y += v * h;
    }
    if (-y > BARGE.H + 0.02) {
      sunk = true;
      v = Math.min(v, -0.1);
    }
  }
  const settledAfloat = !sunk && load === p.cargo && Math.abs(v) < 0.002 && Math.abs(-y - draftEq(load, rho)) < 0.002;
  const drops = Object.values(p.added).some((t0) => t - t0 < 0.6);
  const settledSunk = sunk && y <= RIVER_BED && flood >= 1;
  return { ...p, load, y: settledAfloat ? -draftEq(load, rho) : y, v: settledAfloat ? 0 : v, sunk, flood, t, phase: p.phase + dt * 2.2, active: !(settledAfloat || settledSunk) || drops };
}

function BoatSim({ T }) {
  const tx = T.ships.boat;
  const U = T.u;
  const S = T.sym;
  const dec = T.decimal;
  const [water, setWater] = useState('water');
  const [sim, setSim] = useState(() => boatStart(0));
  const rho = LIQUIDS[water].rho;
  useRafLoop(sim.active, (dt) => setSim((p) => boatStep(p, dt, rho)));

  const setCargo = (c) =>
    setSim((p) => {
      const added = { ...p.added };
      const nOld = Math.round(p.cargo / 10);
      const nNew = Math.round(c / 10);
      for (let i = nOld; i < nNew; i += 1) added[i] = p.t + (i - nOld) * 0.12;
      for (let i = nNew; i < nOld; i += 1) delete added[i];
      return { ...p, cargo: c, added, active: true };
    });
  const pickWater = (id) => {
    setWater(id);
    setSim((p) => ({ ...p, active: true }));
  };
  const reset = () => setSim(boatStart(0));

  const M = BARGE.m0 + sim.cargo; // t
  const dEq = draftEq(sim.cargo, rho);
  const willSink = dEq > BARGE.H;
  const d = sim.sunk ? BARGE.H : clamp(-sim.y, 0, BARGE.H);
  const Vd = BARGE.L * BARGE.B * d; // m³
  const FA = rho * G * Vd; // N
  const cap = (rho * BARGE.L * BARGE.B * BARGE.line) / 1000 - BARGE.m0; // t
  const limit = (rho * BARGE.L * BARGE.B * BARGE.H) / 1000 - BARGE.m0; // t, deck awash
  const free = cap - sim.cargo;
  const over = dEq > BARGE.line + 1e-9;

  /* words */
  let key;
  if (sim.sunk) key = 'sunk';
  else if (willSink) key = 'sinking';
  else if (sim.cargo === 0) key = 'empty';
  else if (over) key = 'over';
  else if (Math.abs(free) < 1e-6) key = 'line';
  else key = 'loaded';
  const settled = useSettled(`${key}-${water}-${sim.cargo}`, 200);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  const f2 = (v) => fmt(v, 2, dec);
  let text;
  if (sKey === 'empty') text = ex.empty(BARGE.m0, f2(dEq), num((BARGE.m0 * 1000) / rho, dec), intText((BARGE.m0 * 1000 * G) / 1000));
  else if (sKey === 'loaded') text = ex.loaded(sim.cargo, f2(dEq), M, num(free, dec));
  else if (sKey === 'line') text = ex.line(sim.cargo, f2(dEq), M, num(cap, dec));
  else if (sKey === 'over') text = ex.over(f2(dEq), f2(BARGE.H - dEq), num(sim.cargo - cap, dec));
  else if (sKey === 'sinking') text = ex.sinking(M, num((M * 1000) / rho, dec), num(BARGE.L * BARGE.B * BARGE.H, dec), fmt(BARGE.H, 2, dec));
  else text = ex.sunk;
  if (water === 'sea' && (sKey === 'loaded' || sKey === 'line' || sKey === 'over')) text = `${text} ${ex.sea(f2(draftEq(sim.cargo, 1000)), f2(dEq))}`;
  const tone = { empty: '#22d3ee', loaded: '#34d399', line: '#34d399', over: '#fbbf24', sinking: '#f87171', sunk: '#f87171' }[sKey] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.fa, color: COL.fa, kind: 'arrow' },
    { label: tx.legend.line, color: '#dc2626', kind: 'line' },
    { label: tx.legend.water(T.ships.waters[water]), color: LIQUIDS[water].surface, kind: 'square' },
  ];

  const rows = [
    { sym: 'm', color: '#f9a8d4', formula: `${tx.sym.ship} + ${tx.sym.cargo}`, subst: `${BARGE.m0} ${U.t} + ${sim.cargo} ${U.t}`, result: `${M} ${U.t}` },
    { sym: S.Vsub, color: COL.volText, formula: `m / ${S.rhoL}`, subst: `${intText(M * 1000)} ${U.kg} / ${rho} ${U.kgm3}`, result: `${num((M * 1000) / rho, dec)} ${U.m3}` },
    { sym: 'd', color: '#93c5fd', formula: `${S.Vsub} / (L·B)`, subst: `${num((M * 1000) / rho, dec)} ${U.m3} / (20 · 5) ${U.m2}`, result: `${f2(dEq)} ${T.m}` },
    {
      sym: tx.capSym,
      color: COL.faText,
      formula: `${S.rhoL}·L·B·d_max − ${tx.sym.ship}`,
      subst: `${rho} · 20 · 5 · 1.5 − 30 000`.replace('1.5', fmt(1.5, 1, dec)),
      result: `${intText(cap * 1000)} ${U.kg}`,
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.waterLabel}
        value={water}
        onChange={pickWater}
        cols="grid-cols-2"
        accent="#38bdf8"
        options={WATER_IDS.map((id) => ({ value: id, label: T.ships.waters[id], sub: `${LIQUIDS[id].rho} ${U.kgm3}`, icon: LIQ_SWATCH[id] }))}
      >
        <Btn variant="primary" icon={PackagePlus} onClick={() => setCargo(Math.min(CARGO_MAX, sim.cargo + 10))} disabled={sim.sunk || sim.cargo >= CARGO_MAX} className="xl:min-w-[172px] min-h-[52px] text-[15px]">
          {tx.add}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} disabled={sim.cargo === 0 && !sim.sunk} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.realTime} extra={T.common.cell(`1 ${T.m}`)} />}
        ariaLabel={tx.sceneLabel(T.ships.waters[water], sim.cargo, f2(d), sim.sunk)}
        height={(W, narrow) => (narrow ? clamp(W * 0.78, 280, 330) : clamp(W * 0.38, 380, 450))}
      >
        {(W, H, narrow) => <BoatDrawing W={W} H={H} narrow={narrow} sim={sim} water={water} rho={rho} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.draft}
          symbol="d"
          value={f2(sim.sunk ? BARGE.H : -sim.y)}
          unit={T.m}
          accent="#2563eb"
          textColor="#93c5fd"
          sub={sim.sunk ? tx.readouts.sunk : tx.readouts.freeboard(f2(Math.max(0, BARGE.H + sim.y)))}
        />
        <Readout
          label={tx.readouts.fa}
          symbol={rich('F_A')}
          value={intText(FA / 1000)}
          unit={U.kn}
          accent={COL.fa}
          textColor={COL.faText}
          sub={rich(tx.readouts.faSub(intText((M * 1000 * G) / 1000)))}
        />
        <Readout
          label={tx.readouts.displaced}
          symbol={rich(S.Vsub)}
          value={num(Vd, dec)}
          unit={U.m3}
          accent={COL.vol}
          textColor={COL.volText}
          sub={tx.readouts.displacedSub(num((rho * Vd) / 1000, dec))}
        />
        <Readout
          label={tx.readouts.cap}
          value={num(cap, dec)}
          unit={U.t}
          accent={over || sim.sunk ? COL.warn : COL.float}
          textColor={over || sim.sunk ? COL.warnText : COL.floatText}
          active={over || sim.sunk}
          sub={over ? tx.readouts.overSub(num(sim.cargo - cap, dec)) : tx.readouts.freeSub(num(Math.max(0, free), dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <RangeField
            id="arx-cargo"
            label={tx.cargo}
            symbol={rich(tx.sym.cargo)}
            min={0}
            max={CARGO_MAX}
            step={10}
            value={sim.cargo}
            onChange={setCargo}
            disabled={sim.sunk}
            accent="#f472b6"
            display={`${sim.cargo} ${U.t}`}
            hint={tx.cargoHint(num(cap, dec), num(limit, dec))}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <Calc title={tx.calcTitle} rows={rows} note={tx.calcNote(num((rho * BARGE.L * BARGE.B * BARGE.line) / 1000, dec), num(cap, dec))} />
        </Panel>
      </div>
    </div>
  );
}

function BoatDrawing({ W, H, narrow, sim, water, rho, T }) {
  const tx = T.ships.boat;
  const U = T.u;
  const dec = T.decimal;
  const lq = LIQUIDS[water];
  const view = makeView({ x0: -14.5, x1: 14.5, y0: -7.6, y1: 6.6 }, W, H, narrow ? { l: 6, r: 6, t: 34, b: 4 } : { l: 12, r: 12, t: 50, b: 6 });
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10 : 11.5;
  const box = { w: W, h: H };
  const surf = Y(0);
  const yb = sim.y; // keel height
  const keel = Y(yb);
  const deck = Y(yb + BARGE.H);
  const hx0 = X(-BARGE.L / 2);
  const hx1 = X(BARGE.L / 2);
  const bed = Y(RIVER_BED);
  const wave = surfacePath(0, W, surf, narrow ? 1.2 : 2, sim.phase, 0);
  const waterPath = `M0,${H} L${wave.join(' L')} L${W},${H} Z`;
  const M = BARGE.m0 + sim.load;
  const d = sim.sunk ? BARGE.H : clamp(-sim.y, 0, BARGE.H);
  const FA = rho * G * BARGE.L * BARGE.B * d;
  const mg = M * 1000 * G;
  const fpx = (narrow ? 46 : 78) / (1030 * G * BARGE.L * BARGE.B * BARGE.H);

  /* cargo blocks */
  const n = Math.round(sim.cargo / 10);
  const blocks = [];
  for (let i = 0; i < n; i += 1) {
    const layer = Math.floor(i / BLOCK.per);
    const col = i % BLOCK.per;
    const t0 = sim.added[i];
    const age = t0 === undefined ? 1 : clamp((sim.t - t0) / 0.45, 0, 1);
    const lift = (1 - age * age) * 4;
    const x = BLOCK.x0 + col * BLOCK.w;
    const y = yb + BARGE.H + layer * BLOCK.h + lift;
    blocks.push(
      <g key={i} opacity={t0 !== undefined && sim.t < t0 ? 0 : 1}>
        <rect x={X(x + 0.05)} y={Y(y + BLOCK.h)} width={(BLOCK.w - 0.1) * k} height={BLOCK.h * k} rx={1.5} fill={BLOCK_COLORS[i % BLOCK_COLORS.length]} stroke="#1f2937" strokeWidth="0.8" />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={X(x + 0.05 + f * (BLOCK.w - 0.1))} x2={X(x + 0.05 + f * (BLOCK.w - 0.1))} y1={Y(y + BLOCK.h) + 2} y2={Y(y) - 2} stroke="#000" strokeOpacity="0.18" />
        ))}
        {!narrow && (
          <text x={X(x + BLOCK.w / 2)} y={Y(y + BLOCK.h / 2) + 3.5} textAnchor="middle" fontSize={Math.min(10, k * 0.36)} fontWeight="700" fill="#fff">
            {`10 ${U.t}`}
          </text>
        )}
      </g>,
    );
  }

  /* draft marks on the bow */
  const marks = [0.5, 1, 1.5, 2].map((m) => (
    <g key={m}>
      <line x1={hx1 - 0.55 * k} x2={hx1 - 0.15 * k} y1={Y(yb + m)} y2={Y(yb + m)} stroke="#fff" strokeWidth="1.5" />
      <text x={hx1 - 0.65 * k} y={Y(yb + m) + 3.5} textAnchor="end" fontSize={Math.min(9.5, k * 0.33)} fontWeight="700" fill="#fff">
        {fmt(m, 1, dec)}
      </text>
    </g>
  ));

  const cx = X(1.2);
  const cyG = Y(yb + BARGE.H * 0.62);
  const cyB = Y(yb + d / 2);

  return (
    <g>
      <defs>
        <LiquidGradient id="arx-boat-water" liq={lq} />
        <linearGradient id="arx-boat-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e0f2fe" />
          <stop offset="1" stopColor="#f8fafc" />
        </linearGradient>
      </defs>
      <rect width={W} height={surf} fill="url(#arx-boat-sky)" />
      {/* grid over the sky and the water: 1 m */}
      {Array.from({ length: 30 }, (_, i) => i - 15).map((x) => (
        <line key={`gx${x}`} x1={X(x)} x2={X(x)} y1={0} y2={bed} stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />
      ))}
      {Array.from({ length: 15 }, (_, i) => i - 8).map((y) => (
        <line key={`gy${y}`} x1={0} x2={W} y1={Y(y)} y2={Y(y)} stroke="#e2e8f0" strokeWidth="1" opacity="0.7" />
      ))}

      {/* hull, cabin and cargo */}
      <g>
        <path
          d={`M${hx0},${deck} L${hx1},${deck} L${hx1},${keel - 0.25 * k} Q${hx1},${keel} ${hx1 - 0.25 * k},${keel} L${hx0 + 0.25 * k},${keel} Q${hx0},${keel} ${hx0},${keel - 0.25 * k} Z`}
          fill="#334155"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <rect x={hx0} y={deck} width={hx1 - hx0} height={0.22 * k} fill="#b91c1c" />
        <rect x={hx0} y={Y(yb + 0.5)} width={hx1 - hx0} height={Y(yb) - Y(yb + 0.5)} fill="#7f1d1d" opacity="0.65" />
        {marks}
        {/* load line (Plimsoll mark) */}
        <line x1={X(-3)} x2={X(3)} y1={Y(yb + BARGE.line)} y2={Y(yb + BARGE.line)} stroke="#f87171" strokeWidth="2.2" />
        <circle cx={X(0)} cy={Y(yb + BARGE.line)} r={0.42 * k} fill="none" stroke="#f87171" strokeWidth="2" />
        {/* cabin */}
        <rect x={X(-9.9)} y={Y(yb + BARGE.H + 2.3)} width={2.3 * k} height={2.3 * k} rx={2} fill="#f8fafc" stroke="#475569" strokeWidth="1.2" />
        <rect x={X(-9.6)} y={Y(yb + BARGE.H + 1.9)} width={1.7 * k} height={0.6 * k} rx={1} fill="#7dd3fc" />
        <rect x={X(-9.2)} y={Y(yb + BARGE.H + 3.0)} width={0.35 * k} height={0.7 * k} fill="#475569" />
        {blocks}
      </g>

      {/* water in front */}
      <path d={waterPath} fill="url(#arx-boat-water)" opacity={lq.opacity * 0.95} />
      <polyline points={wave.join(' ')} fill="none" stroke={lq.surface} strokeWidth="2" />
      <rect x={0} y={bed} width={W} height={H - bed} fill="#d6c29b" />
      <path d={`M0,${bed} ${Array.from({ length: 12 }, (_, i) => `Q${(W * (i + 0.5)) / 12},${bed - 4} ${(W * (i + 1)) / 12},${bed}`).join(' ')}`} fill="#cdb68a" />

      {/* waterline on the hull and the labels */}
      {!sim.sunk && <line x1={hx0} x2={hx1} y1={surf} y2={surf} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="5 4" />}
      <RichPill x={X(3.4) + 4} y={Y(yb + BARGE.line)} anchor="start" text={tx.tags.line} bg="#fff" color="#b91c1c" border="#fecaca" size={fs - 0.5} box={box} />

      {/* forces */}
      {!sim.sunk && (
        <g>
          <ForceArrow x1={cx - 8} y1={cyG} x2={cx - 8} y2={cyG + mg * fpx} color={COL.mg} width={3.2} head={10} />
          <Tag x={cx - 13} y={cyG + mg * fpx} text="mg" color={COL.mg} anchor="end" size={narrow ? 11 : 13} />
          {FA * fpx > 2 && <ForceArrow x1={cx + 8} y1={cyB} x2={cx + 8} y2={cyB - FA * fpx} color={COL.fa} width={3.2} head={10} />}
          {FA * fpx > 2 && <Tag x={cx + 13} y={cyB - FA * fpx + 10} text="F_A" color={COL.fa} anchor="start" size={narrow ? 11 : 13} />}
        </g>
      )}

      {/* depth labels */}
      {!narrow && (
        <g fontSize="10.5" fill="#64748b">
          <text x={8} y={surf - 5}>
            0
          </text>
          <text x={8} y={bed - 5}>
            {`${fmt(RIVER_BED, 0, dec)} ${T.m}`}
          </text>
        </g>
      )}
      {!narrow && !sim.sunk && (
        <RichPill
          x={hx1 + 10}
          y={(surf + keel) / 2}
          anchor="start"
          text={`d = ${fmt(-sim.y, 2, dec)} ${T.m}`}
          bg="#1d4ed8"
          size={fs}
          box={box}
        />
      )}
      {sim.sunk && <RichPill x={W / 2} y={surf - 22} text={tx.tags.sunk} bg={COL.sink} size={fs + 1} box={box} />}
    </g>
  );
}

/* ============================================================== submarine */

const SUB = { V: 500, L: 30, m0: 450, cap: 100, rho: 1030, bed: 50 };
SUB.D = 2 * Math.sqrt(SUB.V / (Math.PI * SUB.L)); // 4.61 m
const NEUTRAL = SUB.V - (SUB.m0 * 1000) / SUB.rho; // 63.1 m³
const SUB_SPEED = 3; // time sped up
const PUMP = 4; // m³/s of ballast

function hullShare(t) {
  const x = clamp(t, 0, 1);
  const th = 2 * Math.acos(1 - 2 * x);
  return (th - Math.sin(th)) / (2 * Math.PI);
}

/** Keel height (m, negative under the surface) where an empty-tank boat floats. */
function floatKeel(mass) {
  const f = (mass * 1000) / (SUB.rho * SUB.V);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (hullShare(mid) < f) lo = mid;
    else hi = mid;
  }
  return -((lo + hi) / 2) * SUB.D;
}

const subStart = () => ({ ballast: 0, target: 0, y: floatKeel(SUB.m0), v: 0, t: 0, active: false, bubbles: [] });

function subStep(p, dt) {
  const T = dt * SUB_SPEED;
  let { ballast, y, v } = p;
  const dB = p.target - ballast;
  const pumping = Math.abs(dB) > 1e-6;
  ballast += clamp(dB, -PUMP * T, PUMP * T);
  const n = Math.max(1, Math.ceil(T / 0.01));
  const h = T / n;
  for (let i = 0; i < n; i += 1) {
    const M = SUB.m0 * 1000 + SUB.rho * ballast;
    const f = hullShare(-y / SUB.D);
    const FA = SUB.rho * G * SUB.V * f;
    const mEff = M + 0.5 * SUB.rho * SUB.V * f;
    const cLin = f > 0 && f < 1 ? 2 * 0.35 * Math.sqrt(SUB.rho * G * SUB.L * SUB.D * M) : 0;
    const drag = 0.5 * SUB.rho * 1.0 * SUB.L * SUB.D * f * Math.abs(v) * v;
    v += ((FA - M * G - cLin * v - drag) / mEff) * h;
    y += v * h;
    if (y < -SUB.bed) {
      y = -SUB.bed;
      if (v < 0) v = 0;
    }
  }
  // bubbles while the tanks flood (air out of the vents) or are blown
  let bubbles = p.bubbles.map((b) => ({ ...b, y: b.y + b.s * T, x: b.x + Math.sin((p.t + b.ph) * 3) * 0.04 })).filter((b) => b.y < 0.2);
  if (pumping && bubbles.length < 40 && Math.random() < 0.6) {
    const top = dB > 0;
    bubbles = [...bubbles, { x: (Math.random() - 0.5) * SUB.L * 0.7, y: y + (top ? SUB.D : 0), s: 1.2 + Math.random() * 1.2, r: 0.25 + Math.random() * 0.35, ph: Math.random() * 6 }];
  }
  const M = SUB.m0 * 1000 + SUB.rho * ballast;
  const f = hullShare(-y / SUB.D);
  const net = SUB.rho * G * SUB.V * f - M * G;
  const still = !pumping && Math.abs(v) < 0.004 && (Math.abs(net) < 50 || (y <= -SUB.bed && net < 0));
  return { ...p, ballast, y, v: still ? 0 : v, t: p.t + T, bubbles, active: !still || bubbles.length > 0 };
}

function SubSim({ T }) {
  const tx = T.ships.sub;
  const U = T.u;
  const S = T.sym;
  const dec = T.decimal;
  const [sim, setSim] = useState(subStart);
  useRafLoop(sim.active, (dt) => setSim((p) => subStep(p, dt)));

  const setTarget = (v) => setSim((p) => ({ ...p, target: v, active: true }));
  const reset = () => setSim(subStart());
  const choice = sim.target === 0 ? 'empty' : sim.target === SUB.cap ? 'full' : 'neutral';

  const M = SUB.m0 + (SUB.rho * sim.ballast) / 1000; // t
  const f = hullShare(-sim.y / SUB.D);
  const FA = SUB.rho * G * SUB.V * f;
  const mg = M * 1000 * G;
  const depth = -sim.y; // keel depth
  const top = -(sim.y + SUB.D); // depth of the top of the hull
  const onBed = sim.y <= -SUB.bed + 1e-6;
  const pumping = Math.abs(sim.target - sim.ballast) > 1e-6;
  const mn = (v) => fmt(v / 1e6, 2, dec);

  let key;
  if (pumping) key = sim.target > sim.ballast ? 'filling' : 'blowing';
  else if (onBed && sim.v === 0) key = mg > FA + 50 ? 'bottom' : 'bottomEq';
  else if (sim.v < -0.05) key = 'diving';
  else if (sim.v > 0.05) key = 'rising';
  else if (f < 0.999) key = 'surface';
  else key = 'hover';
  const settled = useSettled(`${key}-${choice}`, key === 'diving' || key === 'rising' ? 300 : 200);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  let text;
  if (sKey === 'surface') text = ex.surface(fmt(f * 100, 0, dec), fmt((M * 1000) / SUB.V, 0, dec));
  else if (sKey === 'filling') text = ex.filling(fmt(sim.ballast, 0, dec), fmt(M, 0, dec));
  else if (sKey === 'blowing') text = ex.blowing(fmt(sim.ballast, 0, dec), fmt(M, 0, dec));
  else if (sKey === 'diving') text = ex.diving(mn(mg), mn(FA), fmt(Math.max(0, top), 0, dec));
  else if (sKey === 'rising') text = ex.rising(mn(mg), mn(FA));
  else if (sKey === 'bottom') text = ex.bottom(SUB.bed, mn(mg), mn(FA), mn(Math.max(0, mg - FA)));
  else if (sKey === 'bottomEq') text = ex.bottomEq(SUB.bed, mn(FA));
  else text = ex.hover(fmt(Math.max(0, top), 0, dec), fmt(M, 0, dec), mn(FA));
  const tone = { surface: '#22d3ee', filling: '#fbbf24', blowing: '#fbbf24', diving: '#f87171', rising: '#34d399', bottom: '#f87171', bottomEq: '#34d399', hover: '#34d399' }[sKey] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.fa, color: COL.fa, kind: 'arrow' },
    { label: tx.legend.ballast, color: '#1d4ed8', kind: 'square' },
    { label: tx.legend.water(T.ships.waters.sea), color: LIQUIDS.sea.surface, kind: 'square' },
  ];

  const rows = [
    { sym: 'm', color: '#f9a8d4', formula: `m_0 + ${S.rhoL}·${tx.ballastSym}`, subst: `450 ${U.t} + 1030 · ${fmt(sim.ballast, 1, dec)} ${U.kg}`, result: `${fmt(M, 1, dec)} ${U.t}` },
    { sym: 'F_A', color: COL.faText, formula: `${S.rhoL} g V`, subst: `1030 · 9.8 · 500`, result: `${mn(SUB.rho * G * SUB.V)} ${U.mn}` },
    { sym: tx.neutralSym, color: COL.hoverText, formula: `V − m_0/${S.rhoL}`, subst: `500 − 450 000 / 1030`, result: `${fmt(NEUTRAL, 1, dec)} ${U.m3}` },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.ctrlLabel}
        value={choice}
        onChange={(c) => setTarget(c === 'empty' ? 0 : c === 'full' ? SUB.cap : NEUTRAL)}
        cols="grid-cols-1 sm:grid-cols-3"
        accent="#38bdf8"
        options={[
          { value: 'empty', label: tx.ctrl.empty, sub: tx.ctrl.emptySub },
          { value: 'neutral', label: tx.ctrl.neutral, sub: tx.ctrl.neutralSub(fmt(NEUTRAL, 0, dec)) },
          { value: 'full', label: tx.ctrl.full, sub: tx.ctrl.fullSub(SUB.cap) },
        ]}
      >
        <Btn icon={RotateCcw} onClick={reset} disabled={!sim.active && sim.ballast === 0 && sim.target === 0} className="col-span-2 min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.faster(SUB_SPEED)} extra={T.common.cell(`5 ${T.m}`)} />}
        ariaLabel={tx.sceneLabel(fmt(Math.max(0, top), 0, dec), fmt(sim.ballast, 0, dec), fmt(M, 0, dec))}
        height={(W, narrow) => (narrow ? clamp(W * 1.0, 330, 400) : clamp(W * 0.42, 400, 480))}
      >
        {(W, H, narrow) => <SubDrawing W={W} H={H} narrow={narrow} sim={sim} FA={FA} mg={mg} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.depth}
          symbol="h"
          value={fmt(Math.max(0, top), 1, dec)}
          unit={T.m}
          accent="#0e7490"
          textColor="#67e8f9"
          sub={tx.readouts.depthSub(fmt(depth, 1, dec))}
        />
        <Readout
          label={tx.readouts.mass}
          symbol="m"
          value={fmt(M, 0, dec)}
          unit={U.t}
          accent="#1d4ed8"
          textColor="#93c5fd"
          sub={tx.readouts.massSub(fmt(sim.ballast, 0, dec), SUB.cap)}
        />
        <Readout label={tx.readouts.fa} symbol={rich('F_A')} value={mn(FA)} unit={U.mn} accent={COL.fa} textColor={COL.faText} sub={rich(tx.readouts.faSub(mn(mg)))} />
        <Readout
          label={tx.readouts.state}
          value={tx.states[sKey]}
          accent={tone}
          textColor="#e2e8f0"
          active
          sub={rich(mg > FA + 50 ? tx.readouts.heavier : mg < FA - 50 ? tx.readouts.lighter : tx.readouts.equal)}
        />
      </div>

      <Panel className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-2">
          <PanelTitle>{tx.tankTitle}</PanelTitle>
          <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/10" role="img" aria-label={tx.tankLabel(fmt(sim.ballast, 0, dec), SUB.cap)}>
            <div className="h-full rounded-full bg-sky-500 transition-[width] duration-100" style={{ width: `${(sim.ballast / SUB.cap) * 100}%` }} />
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-gray-400">
            <span className="absolute left-0">0</span>
            <span className="absolute -translate-x-1/2 text-amber-300" style={{ left: `${(NEUTRAL / SUB.cap) * 100}%` }}>
              {`▲ ${fmt(NEUTRAL, 0, dec)}`}
            </span>
            <span className="absolute right-0">{`${SUB.cap} ${U.m3}`}</span>
          </div>
          <p className="mt-2 text-xs leading-snug text-gray-500">{tx.tankNote}</p>
        </div>
        <div className="md:col-span-3">
          <Calc title={tx.calcTitle} rows={rows} note={tx.calcNote} />
        </div>
      </Panel>
    </div>
  );
}

function SubDrawing({ W, H, narrow, sim, FA, mg, T }) {
  const tx = T.ships.sub;
  const U = T.u;
  const dec = T.decimal;
  const lq = LIQUIDS.sea;
  const view = makeView({ x0: -30, x1: 30, y0: -SUB.bed - 2.5, y1: 8 }, W, H, narrow ? { l: 26, r: 6, t: 34, b: 4 } : { l: 40, r: 14, t: 50, b: 6 });
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10 : 11.5;
  const box = { w: W, h: H };
  const surf = Y(0);
  const bed = Y(-SUB.bed);
  const wave = surfacePath(0, W, surf, narrow ? 1 : 1.6, sim.t * 0.6, 0);
  const xl = X(-SUB.L / 2);
  const xr = X(SUB.L / 2);
  const keel = Y(sim.y);
  const topY = Y(sim.y + SUB.D);
  const r = (keel - topY) / 2;
  const cy = (keel + topY) / 2;
  const fill = sim.ballast / SUB.cap;
  const tankW = SUB.L * 0.22 * k;
  const tanks = [X(-SUB.L * 0.36), X(SUB.L * 0.14)];
  const fpx = (narrow ? 38 : 62) / (SUB.rho * G * SUB.V);
  const axX = narrow ? 26 : 40;
  const ticks = [];
  for (let d = 0; d <= SUB.bed; d += 10) {
    ticks.push(
      <g key={d}>
        <line x1={axX} x2={axX + 6} y1={Y(-d)} y2={Y(-d)} stroke="#64748b" />
        <text x={axX - 4} y={Y(-d) + 3.5} textAnchor="end" fontSize={narrow ? 9 : 10.5} fill="#475569">
          {d}
        </text>
      </g>,
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id="arx-sub-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lq.fill} />
          <stop offset="1" stopColor="#0b4f6c" />
        </linearGradient>
        <linearGradient id="arx-sub-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#64748b" />
          <stop offset="0.45" stopColor="#334155" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width={W} height={surf} fill="#e0f2fe" />
      <path d={`M0,${H} L${wave.join(' L')} L${W},${H} Z`} fill="url(#arx-sub-sea)" opacity="0.92" />
      <polyline points={wave.join(' ')} fill="none" stroke={lq.surface} strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => -i * 5).map((y) => (
        <line key={y} x1={axX + 8} x2={W} y1={Y(y)} y2={Y(y)} stroke="#fff" strokeOpacity={y === 0 ? 0 : 0.08} />
      ))}
      {/* sea bed */}
      <path
        d={`M0,${bed} ${Array.from({ length: 10 }, (_, i) => `Q${(W * (i + 0.5)) / 10},${bed - 5 - (i % 3) * 2} ${(W * (i + 1)) / 10},${bed}`).join(' ')} L${W},${H} L0,${H} Z`}
        fill="#c8b48a"
      />
      {[0.12, 0.3, 0.71, 0.88].map((fx, i) => (
        <path key={i} d={`M${W * fx},${bed} q-4,-14 2,-26 q6,-10 0,-20`} fill="none" stroke="#15803d" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
      ))}

      {/* bubbles */}
      {sim.bubbles.map((b, i) => (
        <circle key={i} cx={X(b.x)} cy={Y(b.y)} r={Math.max(1.2, b.r * k)} fill="#fff" fillOpacity="0.35" stroke="#fff" strokeOpacity="0.8" strokeWidth="0.8" />
      ))}

      {/* the boat */}
      <g>
        <rect x={X(4)} y={topY - 2.4 * k} width={5.5 * k} height={2.6 * k} rx={0.9 * k} fill="#334155" stroke="#0f172a" />
        <line x1={X(6)} x2={X(6)} y1={topY - 2.4 * k} y2={topY - 4.2 * k} stroke="#0f172a" strokeWidth="1.5" />
        <rect x={xl} y={topY} width={xr - xl} height={keel - topY} rx={r} fill="url(#arx-sub-hull)" stroke="#0f172a" strokeWidth="1.2" />
        {/* ballast tanks (cut away) */}
        {tanks.map((tx0, i) => (
          <g key={i}>
            <rect x={tx0} y={cy - r * 0.62} width={tankW} height={r * 1.24} rx={3} fill="#e2e8f0" opacity="0.92" />
            <rect x={tx0} y={cy + r * 0.62 - fill * r * 1.24} width={tankW} height={fill * r * 1.24} rx={3} fill="#1d4ed8" opacity="0.85" />
            <rect x={tx0} y={cy - r * 0.62} width={tankW} height={r * 1.24} rx={3} fill="none" stroke="#94a3b8" />
          </g>
        ))}
        <path d={`M${xl - 0.2 * k},${cy} l-${1.1 * k},-${0.9 * k} l0,${1.8 * k} Z`} fill="#475569" />
      </g>

      {/* forces */}
      <ForceArrow x1={X(-1)} y1={cy} x2={X(-1)} y2={cy + mg * fpx} color={COL.mg} width={3.2} head={10} />
      <Tag x={X(-1) - 6} y={cy + mg * fpx} text="mg" color={COL.mg} anchor="end" size={narrow ? 11 : 13} />
      {FA * fpx > 2 && <ForceArrow x1={X(1)} y1={cy} x2={X(1)} y2={cy - FA * fpx} color={COL.fa} width={3.2} head={10} />}
      {FA * fpx > 2 && <Tag x={X(1) + 6} y={cy - FA * fpx + 10} text="F_A" color={COL.fa} anchor="start" size={narrow ? 11 : 13} />}
      {!narrow && (
        <g>
          <RichPill x={xr + 12} y={cy - 12} anchor="start" text={`F_A = ${fmt(FA / 1e6, 2, dec)} ${U.mn}`} bg={COL.fa} size={fs} box={box} />
          <RichPill x={xr + 12} y={cy + 12} anchor="start" text={`mg = ${fmt(mg / 1e6, 2, dec)} ${U.mn}`} bg={COL.mg} size={fs} box={box} />
        </g>
      )}

      {/* depth scale */}
      <line x1={axX + 3} x2={axX + 3} y1={surf} y2={bed} stroke="#64748b" />
      {ticks}
      <text x={axX - 4} y={surf - 8} textAnchor="end" fontSize={narrow ? 9 : 10.5} fontWeight="700" fill="#475569">
        {tx.depthAxis}
      </text>
    </g>
  );
}
