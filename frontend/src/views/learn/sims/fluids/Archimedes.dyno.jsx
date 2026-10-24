import { useState } from 'react';
import { ArrowDown, ArrowUp, Lightbulb } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE } from '../kit/scene';
import {
  COL,
  Calc,
  G,
  LIQUIDS,
  LIQ_SWATCH,
  LiquidFill,
  LiquidGradient,
  Panel,
  PanelTitle,
  PlayButtons,
  RichPill,
  SimScene,
  Tag,
  TimeChip,
  Toolbar,
  makeSwatch,
  rhoText,
  rich,
  richSvg,
  shade,
  ForceArrow,
} from './Archimedes.parts';

/**
 * The dynamometer experiment. A cylinder (base area S = 20 cm², height
 * H = V/S) hangs from a spring balance and is lowered into an overflow
 * vessel filled up to its spout. The reading falls from the weight in air
 * P = mg by Archimedes' force F_A = ρ_l·g·V_sub, which grows while the body
 * goes in and stops changing once it is fully submerged. The liquid pushed
 * out runs through the spout into a cup on a balance: its weight equals F_A.
 * A magnified window shows the pressure forces on the faces (p = ρgh): the
 * bottom face is pushed harder than the top one, F₂ − F₁ = ρ·g·H·S = F_A.
 *
 * Preset: aluminium, 100 cm³, water: m = 270 g, P = 2.65 N in air,
 * F_A = 1000 · 9.8 · 0.0001 = 0.98 N, reading 1.67 N.
 *
 * The liquid level is solved from the liquid's volume and the submerged
 * volume; whatever rises above the spout leaves through it, so after the
 * body is pulled out the level stays below the spout (Reset refills).
 * Real time; lengths in cm.
 */

const S_B = 20; // cm², base area of the cylinder
const R_B = Math.sqrt(S_B / Math.PI); // 2.52 cm
const R_V = 5; // cm, inner radius of the overflow vessel
const A_V = Math.PI * R_V * R_V; // 78.5 cm²
const GLASS = 0.4;
const FLOOR = 0.6; // cm, inner floor above the table
const L_SP = 14; // cm, liquid depth at the spout
const RIM = 17; // cm, inner height of the vessel
const START_GAP = 2.5; // cm, body's bottom above the surface at the start
const CLEAR = 2; // cm, closest the bottom face comes to the floor
const S_MAX = L_SP + START_GAP - CLEAR; // 14.5 cm of lowering
const SPEED = 1.2; // cm/s, automatic lowering
const HOOK_LOW = 18.6; // cm, the hook's height when the body is lowered fully (thread = 16 cm - H)
const ROD = 9; // cm, pointer to hook
const HOUSING = 10; // cm
const SCALE_LEN = 7; // cm of scale on the spring balance
const CUP = { x: 12.6, r: 3, h: 8.2, glass: 0.25, y0: 3.6 };
const A_CUP = Math.PI * CUP.r * CUP.r;
const SPOUT = { x0: R_V + GLASS, x1: R_V + GLASS + 3, drop: 0.9 };
const P_PER_CM = 700; // Pa per cm of arrow in the magnified window
const BOX = { x0: -18, x1: 21, y0: -2.5, y1: 54.5 };
const GRID_PX = 16;

const MATS = {
  al: { rho: 2700, color: '#d3d9e1', edge: '#6b7788' },
  iron: { rho: 7800, color: '#80868f', edge: '#3c4048' },
  copper: { rho: 8900, color: '#d88452', edge: '#8a431e' },
  stone: { rho: 2600, color: '#b3aca6', edge: '#57524c', speckle: true },
};
const MAT_IDS = ['al', 'iron', 'copper', 'stone'];
const MAT_SWATCH = Object.fromEntries(MAT_IDS.map((id) => [id, makeSwatch(MATS[id].color, MATS[id].edge)]));
const LIQ_IDS = ['water', 'sea', 'kerosene'];

/** Scale of the spring balance for a weight P: 0–2, 0–5, 0–10 or 0–20 N. */
const rangeFor = (P) => [2, 5, 10, 20].find((r) => r >= P * 1.04) ?? 20;
const TICKS = { 2: { major: 1, minor: 0.1 }, 5: { major: 1, minor: 0.2 }, 10: { major: 2, minor: 0.5 }, 20: { major: 5, minor: 1 } };
const round2 = (v) => Math.round(v * 100) / 100;

/** Liquid level above the inner floor for liquid volume Vw and the body's bottom at zb (cm). */
function solveLevel(Vw, zb, Hb) {
  if (A_V * zb - Vw >= 0) return Vw / A_V;
  if (A_V * (zb + Hb) - S_B * Hb - Vw >= 0) return (Vw - S_B * zb) / (A_V - S_B);
  return (Vw + S_B * Hb) / A_V;
}

const fresh = () => ({ s: 0, target: 0, dir: 0, lastDir: 1, Vw: A_V * L_SP, L: L_SP, Vcup: 0, Vpend: 0, amp: 0, phase: 0 });
const isActive = (p) => p.dir !== 0 || Math.abs(p.target - p.s) > 0.003 || p.Vpend > 1e-4 || p.amp > 0;

function step(p, dt, Hb) {
  let { target, dir, Vw, Vcup, Vpend, amp, phase } = p;
  if (dir) {
    target = clamp(target + dir * SPEED * dt, 0, S_MAX);
    if ((dir > 0 && target >= S_MAX) || (dir < 0 && target <= 0)) dir = 0;
  }
  const ds = target - p.s;
  const s = Math.abs(ds) < 0.003 ? target : p.s + clamp(ds * (1 - Math.exp(-dt / 0.12)), -30 * dt, 30 * dt);
  const zb = L_SP + START_GAP - s;
  let L = solveLevel(Vw, zb, Hb);
  if (L > L_SP) {
    const excess = Vw + S_B * clamp(L_SP - zb, 0, Hb) - A_V * L_SP;
    Vw -= excess;
    Vpend += excess;
    L = L_SP;
  }
  if (Vpend > 0) {
    const flow = Math.min(Vpend, Math.max(Vpend * (1 - Math.exp(-dt / 0.35)), 6 * dt));
    Vcup += flow;
    Vpend -= flow;
    if (Vpend < 1e-4) {
      Vcup += Vpend;
      Vpend = 0;
    }
  }
  const h = L - zb;
  if (h > -0.3 && h < Hb + 0.3) amp = Math.min(0.35, amp + Math.abs(s - p.s) * 0.9);
  amp *= Math.exp(-dt / 0.6);
  if (amp < 0.004) amp = 0;
  phase += dt * 7;
  return { ...p, target, dir, s, Vw, L, Vcup, Vpend, amp, phase };
}

export default function DynoSim({ T }) {
  const tx = T.dyno;
  const U = T.u;
  const S = T.sym;
  const dec = T.decimal;
  const [mat, setMat] = useState('al');
  const [liq, setLiq] = useState('water');
  const [vol, setVol] = useState(100);
  const [sim, setSim] = useState(fresh);

  const Hb = vol / S_B;
  useRafLoop(isActive(sim), (dt) => setSim((p) => step(p, dt, Hb)));

  /* ---- physics */
  const rhoB = MATS[mat].rho;
  const rhoL = LIQUIDS[liq].rho;
  const zb = L_SP + START_GAP - sim.s; // bottom face above the inner floor, cm
  const h = sim.L - zb; // depth of the bottom face, cm (negative: above the surface)
  const hTop = h - Hb;
  const Vsub = S_B * clamp(h, 0, Hb);
  const m = rhoB * vol * 1e-6;
  const P = m * G;
  const FAfull = rhoL * G * vol * 1e-6;
  const P2 = round2(P);
  const FA2 = round2(rhoL * G * Vsub * 1e-6);
  const F2 = round2(P2 - FA2);
  const Pc2 = round2(rhoL * G * sim.Vcup * 1e-6);
  const range = rangeFor(P);
  const p1 = hTop > 0 ? (rhoL * G * hTop) / 100 : 0;
  const p2 = h > 0 ? (rhoL * G * h) / 100 : 0;
  const f2 = (v) => fmt(v, 2, dec);

  /* ---- controls */
  const atBottom = sim.target >= S_MAX - 1e-6;
  const atTop = sim.target <= 1e-6;
  const nextDir = atBottom ? -1 : atTop ? 1 : sim.lastDir;
  const toggle = () =>
    setSim((p) => {
      if (p.dir) return { ...p, dir: 0 };
      const d = p.target >= S_MAX - 1e-6 ? -1 : p.target <= 1e-6 ? 1 : p.lastDir;
      return { ...p, dir: d, lastDir: d };
    });
  const reset = () => setSim(fresh());
  const pickLiq = (id) => {
    setLiq(id);
    reset();
  };
  const changeVol = (v) => {
    setVol(v);
    reset();
  };
  const drag = (v) => setSim((p) => ({ ...p, target: v, dir: 0, lastDir: v >= p.target ? 1 : -1 }));

  /* ---- words */
  const below = sim.L < L_SP - 0.02;
  let key;
  if (Vsub <= 0.01) key = below && sim.Vcup > 0.5 ? 'out' : 'air';
  else if (below && sim.Vcup > 0.5 && Math.abs(Pc2 - FA2) > 0.004) key = 'mismatch';
  else if (h < Hb - 0.005) key = 'partial';
  else key = hTop > 1 ? 'deeper' : 'full';
  const settled = useSettled(`${key}-${mat}-${liq}-${vol}`, 260);
  const sKey = settled.split('-')[0];
  const ex = tx.explain;
  let text;
  if (sKey === 'air') text = ex.air(fmt(m, 3, dec), f2(P2));
  else if (sKey === 'partial') text = ex.partial(fmt(Vsub, 0, dec), f2(P2), f2(F2), f2(FA2));
  else if (sKey === 'full') text = `${ex.full(f2(P2), f2(F2), f2(FA2), f2(Pc2))} ${ex.liqNote[liq]}`.trim();
  else if (sKey === 'deeper') text = ex.deeper(f2(FA2));
  else if (sKey === 'out') text = ex.out(f2(Pc2));
  else text = ex.mismatch(f2(FA2), f2(Pc2));
  const tone = { air: '#22d3ee', partial: '#fbbf24', full: '#34d399', deeper: '#34d399', out: '#fb923c', mismatch: '#fb923c' }[sKey] ?? '#22d3ee';

  const legend = [
    { label: tx.legend.mg, color: COL.mg, kind: 'arrow' },
    { label: tx.legend.f, color: COL.fel, kind: 'arrow' },
    { label: tx.legend.fa, color: COL.fa, kind: 'arrow' },
    { label: tx.legend.p, color: COL.p, kind: 'arrow' },
    { label: tx.legend.liquid(tx.liquids[liq]), color: LIQUIDS[liq].surface, kind: 'square' },
  ];

  /* ---- calculations */
  const mCup = (rhoL * sim.Vcup) / 1e6;
  const measRows = [
    { sym: 'P', color: COL.mgText, formula: 'mg', subst: `${fmt(m, 3, dec)} ${U.kg} · 9.8 ${U.nkg}`, result: `${f2(P2)} ${U.n}` },
    { sym: 'F_A', color: COL.faText, formula: 'P − F', subst: `${f2(P2)} ${U.n} − ${f2(F2)} ${U.n}`, result: `${f2(FA2)} ${U.n}` },
    {
      sym: 'F_A',
      color: COL.faText,
      formula: `${S.rhoL} g ${S.Vsub}`,
      subst: `${rhoText(rhoL)} ${U.kgm3} · 9.8 ${U.nkg} · ${fmt(Vsub * 1e-6, 6, dec)} ${U.m3}`,
      result: `${f2(FA2)} ${U.n}`,
    },
    { sym: S.Ps, color: COL.volText, formula: `${S.ms} g`, subst: `${fmt(mCup, 3, dec)} ${U.kg} · 9.8 ${U.nkg}`, result: `${f2(Pc2)} ${U.n}` },
  ];
  const p1r = Math.round(p1);
  const p2r = Math.round(p2);
  let pressRows = [];
  if (h > 0 && hTop > 0)
    pressRows = [
      { sym: 'p_1', color: COL.pText, formula: `${S.rhoL} g h_1`, subst: `${rhoText(rhoL)} · 9.8 · ${fmt(hTop / 100, 3, dec)}`, result: `${p1r} ${U.pa}` },
      { sym: 'p_2', color: COL.pText, formula: `${S.rhoL} g h_2`, subst: `${rhoText(rhoL)} · 9.8 · ${fmt(h / 100, 3, dec)}`, result: `${p2r} ${U.pa}` },
      {
        sym: 'F_2 − F_1',
        color: COL.faText,
        formula: '(p_2 − p_1)S',
        subst: `(${p2r} − ${p1r}) ${U.pa} · 0.0020 ${U.m2}`.replace('0.0020', fmt(0.002, 4, dec)),
        result: `${f2(((p2r - p1r) * S_B) / 1e4)} ${U.n}`,
      },
    ];
  else if (h > 0)
    pressRows = [
      { sym: 'p_2', color: COL.pText, formula: `${S.rhoL} g h_2`, subst: `${rhoText(rhoL)} · 9.8 · ${fmt(h / 100, 3, dec)}`, result: `${p2r} ${U.pa}` },
      { sym: 'F_2', color: COL.faText, formula: 'p_2 S', subst: `${p2r} ${U.pa} · ${fmt(0.002, 4, dec)} ${U.m2}`, result: `${f2((p2r * S_B) / 1e4)} ${U.n}` },
    ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.matLabel}
        value={mat}
        onChange={setMat}
        accent="#a78bfa"
        options={MAT_IDS.map((id) => ({ value: id, label: tx.mats[id], sub: `ρ = ${rhoText(MATS[id].rho)} ${U.kgm3}`, icon: MAT_SWATCH[id] }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.dir !== 0}
          label={nextDir > 0 ? tx.lower : tx.raise}
          icon={nextDir > 0 ? ArrowDown : ArrowUp}
          onToggle={toggle}
          onReset={reset}
          resetDisabled={atTop && sim.s < 0.003 && sim.Vcup === 0 && sim.dir === 0}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip text={T.common.realTime} extra={T.common.cell(cellText(W, narrow, T))} />}
        ariaLabel={tx.sceneLabel(tx.mats[mat], vol, tx.liquids[liq], f2(F2), f2(FA2), f2(Pc2))}
        height={sceneHeight}
      >
        {(W, H, narrow) => (
          <DynoDrawing
            W={W}
            H={H}
            narrow={narrow}
            sim={sim}
            mat={mat}
            liq={liq}
            vol={vol}
            Hb={Hb}
            P={P2}
            F={F2}
            FA={FA2}
            Pc={Pc2}
            range={range}
            p1={p1}
            p2={p2}
            T={T}
          />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.P}
          symbol="P"
          value={f2(P2)}
          unit={U.n}
          accent={COL.mg}
          textColor={COL.mgText}
          sub={tx.readouts.Psub(fmt(m * 1000, 0, dec), rhoText(rhoB))}
        />
        <Readout label={tx.readouts.F} symbol="F" value={f2(F2)} unit={U.n} accent={COL.fel} textColor={COL.felText} sub={rich(tx.readouts.Fsub)} />
        <Readout
          label={tx.readouts.FA}
          symbol={rich('F_A')}
          value={f2(FA2)}
          unit={U.n}
          accent={COL.fa}
          textColor={COL.faText}
          active={Vsub > 0.01}
          sub={rich(tx.readouts.FAsub(fmt(Vsub, 0, dec)))}
        />
        <Readout
          label={tx.readouts.Pc}
          symbol={rich(S.Ps)}
          value={f2(Pc2)}
          unit={U.n}
          accent={COL.vol}
          textColor={COL.volText}
          active={Vsub > 0.01 && Math.abs(Pc2 - FA2) < 0.005}
          sub={tx.readouts.Pcsub(fmt(mCup * 1000, 0, dec), fmt(sim.Vcup, 0, dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="space-y-3 lg:col-span-2">
          <div>
            <PanelTitle>{tx.liqLabel}</PanelTitle>
            <Segmented
              label={tx.liqLabel}
              className="grid-cols-3"
              value={liq}
              onChange={pickLiq}
              accent="#38bdf8"
              options={LIQ_IDS.map((id) => ({ value: id, label: tx.liquids[id], sub: `${rhoText(LIQUIDS[id].rho)} ${U.kgm3}`, icon: LIQ_SWATCH[id] }))}
            />
          </div>
          <RangeField
            id="arx-vol"
            label={tx.volume}
            symbol="V"
            min={50}
            max={200}
            step={10}
            value={vol}
            onChange={changeVol}
            accent="#a78bfa"
            display={`${vol} ${U.cm3}`}
            hint={tx.volumeHint(fmt(Hb, 1, dec))}
          />
          <RangeField
            id="arx-depth"
            label={tx.depth}
            min={0}
            max={S_MAX}
            step={0.1}
            value={Math.round(sim.target * 10) / 10}
            onChange={drag}
            accent="#22d3ee"
            display={`${fmt(sim.target, 1, dec)} ${U.cm}`}
            hint={rich(h > 0 ? tx.depthHint(fmt(h, 1, dec)) : tx.depthAir)}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <DepthGraph T={T} P={P2} FAfull={FAfull} Hb={Hb} range={range} h={h} F={F2} FA={FA2} />
        </Panel>
      </div>

      <Panel className="grid gap-4 md:grid-cols-2">
        <Calc title={tx.calc.meas} rows={measRows} note={tx.calc.measNote} />
        {pressRows.length > 0 ? (
          <Calc title={tx.calc.pressure} rows={pressRows} note={hTop > 0 ? tx.calc.pressNote : tx.calc.pressNotePartial} />
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-200">{tx.calc.pressure}</p>
            <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-sm leading-snug text-gray-400">{tx.calc.pressAir}</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------------- layout */

const sceneHeight = (W, narrow) => (narrow ? W * 1.48 + clamp(W * 0.66, 220, 260) : clamp(W * 0.53, 520, 620));

function layout(W, H, narrow) {
  const bw = BOX.x1 - BOX.x0;
  const bh = BOX.y1 - BOX.y0;
  let k;
  let left;
  let base;
  let inset;
  if (narrow) {
    const insetH = clamp(W * 0.66, 220, 260);
    const hExp = H - insetH - 6;
    k = Math.min((W - 16) / bw, (hExp - 40 - 6) / bh);
    left = (W - bw * k) / 2;
    base = hExp - 6;
    inset = { x0: 8, x1: W - 8, y0: hExp + 2, y1: H - 8 };
  } else {
    k = (H - 52 - 8) / bh;
    const insetW = clamp(W * 0.3, 300, 380);
    const gap = clamp(W * 0.05, 30, 80);
    left = Math.max(10, (W - (bw * k + gap + insetW)) / 2);
    base = H - 8;
    const ix0 = left + bw * k + gap;
    inset = { x0: ix0, x1: Math.min(W - 10, ix0 + insetW), y0: 54, y1: H - 14 };
  }
  const sx = (x) => left + (x - BOX.x0) * k;
  const sy = (y) => base - (y - BOX.y0) * k;
  return { k, sx, sy, wx: (px) => BOX.x0 + (px - left) / k, wy: (py) => BOX.y0 + (base - py) / k, inset };
}

function cellText(W, narrow, T) {
  const view = layout(W, Math.round(sceneHeight(W, narrow)), narrow);
  return `${fmt(niceStep(view.k, GRID_PX), 0, T.decimal)} ${T.u.cm}`;
}

/* ------------------------------------------------------------------ scene */

function DynoDrawing({ W, H, narrow, sim, mat, liq, vol, Hb, P, F, FA, Pc, range, p1, p2, T }) {
  const tx = T.dyno;
  const U = T.u;
  const dec = T.decimal;
  const v = layout(W, H, narrow);
  const { k, sx, sy } = v;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const lq = LIQUIDS[liq];
  const M = MATS[mat];
  const f2 = (x) => fmt(x, 2, dec);

  /* body and the chain above it (heights in cm above the table) */
  const yb = FLOOR + L_SP + START_GAP - sim.s;
  const yTop = yb + Hb;
  const yHook = HOOK_LOW + (S_MAX - sim.s);
  const e = (SCALE_LEN * F) / range;
  const yPtr = yHook + ROD;
  const yHt = yPtr + 2 + e; // housing top
  const yArm = yHt + 1.7;
  const { major, minor } = TICKS[range];

  const X = (x) => sx(x);
  const Y = (y) => sy(y);
  const surfY = Y(FLOOR + sim.L);
  const inL = X(-R_V);
  const inR = X(R_V);
  const glass = GLASS * k;
  const rimY = Y(FLOOR + RIM);
  const floorY = Y(FLOOR);
  const tableY = Y(0);
  const amp = sim.amp * k;

  /* scale ticks on the spring balance */
  const ticks = [];
  for (let i = 0; i <= Math.round(range / minor); i += 1) {
    const val = i * minor;
    const y = Y(yHt - 2 - (SCALE_LEN * val) / range);
    const isMajor = Math.abs(val / major - Math.round(val / major)) < 1e-6;
    const half = Math.round(range / minor) % 2 === 0 && i === Math.round(range / minor) / 2;
    const len = isMajor ? 0.7 : half ? 0.5 : 0.35;
    ticks.push(
      <g key={i}>
        <line x1={X(-0.82)} x2={X(-0.82 - len)} y1={y} y2={y} stroke="#334155" strokeWidth={isMajor ? 1.2 : 0.7} />
        <line x1={X(0.82)} x2={X(0.82 + len)} y1={y} y2={y} stroke="#334155" strokeWidth={isMajor ? 1.2 : 0.7} />
        {isMajor && (
          <text x={X(2.05)} y={y + 3} textAnchor="end" fontSize={Math.min(9.5, k * 1.15)} fontWeight="700" fill="#0f172a">
            {fmt(val, 0, dec)}
          </text>
        )}
      </g>,
    );
  }

  /* spring in the slot: zigzag from the housing's cap to the pointer */
  const springTop = Y(yHt - 0.6);
  const ptrY = Y(yPtr);
  const coil = [];
  const turns = 9;
  for (let i = 0; i <= turns * 2; i += 1) {
    const y = springTop + 3 + ((ptrY - 4 - springTop - 3) * i) / (turns * 2);
    const xx = X(0) + (i === 0 || i === turns * 2 ? 0 : (i % 2 ? 1 : -1) * 0.5 * k);
    coil.push(`${xx.toFixed(1)},${y.toFixed(1)}`);
  }

  /* forces on the body */
  const fpx = (6.5 * k) / range;
  const cx = X(0);
  const cy = Y(yb + Hb / 2);
  const off = Math.max(6, 0.35 * k);

  /* stream from the spout into the cup */
  const spoutY0 = Y(FLOOR + L_SP);
  const spX1 = X(SPOUT.x1);
  const spY1 = Y(FLOOR + L_SP - SPOUT.drop);
  const cupLevel = CUP.y0 + CUP.glass + sim.Vcup / A_CUP;
  const streaming = sim.Vpend > 0.02;
  const streamW = clamp(1.4 + sim.Vpend * 0.12, 1.4, 4.2);
  const streamPath = `M${spX1 - 1},${spY1 + 1} Q${spX1 + 0.9 * k},${spY1} ${spX1 + 1.25 * k},${spY1 + 1.3 * k} L${spX1 + 1.4 * k},${Y(cupLevel)}`;

  const bodyLabel = tx.tags.body(tx.mats[mat], vol);
  const full = sim.L - (yb - FLOOR) >= Hb - 0.005;

  return (
    <g>
      <defs>
        <LiquidGradient id="arx-dyn-liq" liq={lq} />
        <linearGradient id="arx-dyn-metal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(M.color, -0.28)} />
          <stop offset="0.32" stopColor={shade(M.color, 0.38)} />
          <stop offset="0.62" stopColor={M.color} />
          <stop offset="1" stopColor={shade(M.color, -0.34)} />
        </linearGradient>
        <linearGradient id="arx-dyn-housing" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#cbd5e1" />
          <stop offset="0.4" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={v} W={W} H={narrow ? v.inset.y0 : H} minPx={GRID_PX} strong={PALETTE.grid} />

      {/* table */}
      <rect x={0} y={tableY} width={W} height={Y(BOX.y0) - tableY + 6} fill="#efe2cd" />
      <line x1={0} x2={W} y1={tableY} y2={tableY} stroke="#b08d5b" strokeWidth="2" />

      {/* stand */}
      <rect x={X(-17.5)} y={Y(1)} width={8.5 * k} height={1 * k} rx={2} fill="#475569" />
      <rect x={X(-14.4)} y={Y(BOX.y1 - 0.4)} width={0.8 * k} height={Y(1) - Y(BOX.y1 - 0.4)} rx={1.5} fill="#94a3b8" stroke="#64748b" />
      <rect x={X(-15.2)} y={Y(yArm + 0.95)} width={2.4 * k} height={1.6 * k} rx={2} fill="#334155" />
      <rect x={X(-12.8)} y={Y(yArm + 0.65)} width={X(0.5) - X(-12.8)} height={0.65 * k} rx={1.5} fill="#64748b" />
      <circle cx={X(0)} cy={Y(yArm - 0.3)} r={0.45 * k} fill="none" stroke="#334155" strokeWidth="2" />

      {/* spring balance */}
      <line x1={X(0)} x2={X(0)} y1={Y(yArm - 0.7)} y2={Y(yHt)} stroke="#334155" strokeWidth="2" />
      <rect x={X(-2.2)} y={Y(yHt)} width={4.4 * k} height={HOUSING * k} rx={0.9 * k} fill="url(#arx-dyn-housing)" stroke="#475569" strokeWidth="1.4" />
      <rect x={X(-0.72)} y={Y(yHt - 0.4)} width={1.44 * k} height={(HOUSING - 0.8) * k} rx={0.4 * k} fill="#334155" />
      <rect x={X(-1.95)} y={Y(yHt - 1.4)} width={1.1 * k} height={(SCALE_LEN + 1.2) * k} fill="#fff" opacity="0.85" />
      <rect x={X(0.85)} y={Y(yHt - 1.4)} width={1.25 * k} height={(SCALE_LEN + 1.2) * k} fill="#fff" opacity="0.85" />
      {ticks}
      <polyline points={coil.join(' ')} fill="none" stroke="#e2e8f0" strokeWidth="1.6" strokeLinejoin="round" />
      <line x1={X(0)} x2={X(0)} y1={springTop} y2={springTop + 3} stroke="#e2e8f0" strokeWidth="1.6" />
      <rect x={X(-1.5)} y={ptrY - 2} width={3 * k} height={4} rx={1.5} fill="#e11d48" stroke="#9f1239" strokeWidth="0.8" />
      <line x1={X(0)} x2={X(0)} y1={ptrY + 2} y2={Y(yHook + 0.5)} stroke="#64748b" strokeWidth="2.6" />
      <path d={`M${X(0)},${Y(yHook + 0.5)} q0,${0.6 * k} ${0.45 * k},${0.6 * k} q${0.45 * k},0 ${0.45 * k},-${0.45 * k}`} fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" />

      {/* thread */}
      <line x1={X(0)} x2={X(0)} y1={Y(yHook)} y2={Y(yTop + 0.35)} stroke="#78350f" strokeWidth="1.3" />

      {/* vessel: back wall, body, liquid in front */}
      <rect x={inL} y={rimY} width={inR - inL} height={floorY - rimY} fill="#f1f5f9" opacity="0.65" />
      <Body x0={X(-R_B)} x1={X(R_B)} yT={Y(yTop)} yB={Y(yb)} k={k} mat={M} />
      <LiquidFill x0={inL} x1={inR} top={surfY} bottom={floorY} liq={lq} gradId="arx-dyn-liq" amp={amp} phase={sim.phase} />
      {yb < FLOOR + sim.L && <BodyOutline x0={X(-R_B)} x1={X(R_B)} yT={Y(yTop)} yB={Y(yb)} k={k} color={M.edge} />}

      {/* glass */}
      <rect x={inL - glass} y={rimY} width={glass} height={floorY - rimY} fill="#cbd5e1" opacity="0.9" />
      <rect x={inR} y={rimY} width={glass} height={spoutY0 - rimY - 0.55 * k} fill="#cbd5e1" opacity="0.9" />
      <rect x={inR} y={spoutY0 + 0.05 * k} width={glass} height={floorY - spoutY0 - 0.05 * k} fill="#cbd5e1" opacity="0.9" />
      <rect x={inL - glass} y={floorY} width={inR - inL + 2 * glass} height={tableY - floorY} fill="#cbd5e1" />
      <line x1={inL - glass} x2={inL - glass} y1={rimY} y2={tableY} stroke="#94a3b8" />
      <line x1={inR + glass} x2={inR + glass} y1={rimY} y2={tableY} stroke="#94a3b8" />
      {/* spout */}
      <path
        d={`M${inR},${spoutY0} L${spX1},${spY1} L${spX1},${spY1 - 0.55 * k} L${inR},${spoutY0 - 0.55 * k} Z`}
        fill="#e2e8f0"
        stroke="#94a3b8"
        strokeWidth="1"
        opacity="0.95"
      />
      {streaming && <line x1={inR} y1={spoutY0 - 1.2} x2={spX1} y2={spY1 - 1.2} stroke={lq.surface} strokeWidth={Math.min(2.4, streamW * 0.6)} strokeOpacity="0.7" />}

      {/* stream */}
      {streaming && (
        <g>
          <path d={streamPath} fill="none" stroke={lq.deep} strokeWidth={streamW} strokeLinecap="round" opacity="0.75" />
          <path
            d={streamPath}
            fill="none"
            stroke="#fff"
            strokeWidth={Math.max(0.8, streamW * 0.35)}
            strokeDasharray="3 6"
            strokeDashoffset={-sim.phase * 9}
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>
      )}

      {/* cup on the balance */}
      <Cup X={X} Y={Y} k={k} level={cupLevel} lq={lq} amp={streaming ? 1.2 : 0} phase={sim.phase} />
      <Balance X={X} Y={Y} k={k} text={`${f2(Pc)} ${U.n}`} />

      {/* forces */}
      <ForceArrow x1={cx - off} y1={cy} x2={cx - off} y2={cy + P * fpx} color={COL.mg} width={3.2} head={10} />
      <Tag x={cx - off - 5} y={cy + P * fpx - 2} text="mg" color={COL.mg} anchor="end" size={narrow ? 12 : 14} />
      {FA > 0.004 && (
        <g>
          <ForceArrow x1={cx + off} y1={cy} x2={cx + off} y2={cy - FA * fpx} color={COL.fa} width={3.2} head={Math.min(10, FA * fpx * 0.6)} />
          <Tag x={cx + off + 5} y={cy - FA * fpx + 10} text="F_A" color={COL.fa} anchor="start" size={narrow ? 12 : 14} />
        </g>
      )}
      <ForceArrow x1={cx} y1={Y(yTop + 0.35)} x2={cx} y2={Y(yTop + 0.35) - F * fpx} color={COL.fel} width={3.2} head={10} />
      <Tag x={cx + 6} y={Y(yTop + 0.35) - F * fpx + 10} text="F" color={COL.fel} anchor="start" size={narrow ? 12 : 14} />

      {/* labels */}
      <RichPill x={X(-2.2) - 8} y={ptrY} anchor="end" text={tx.tags.reading(f2(F))} bg={COL.fel} size={fs} box={box} />
      <text x={X(2.2) + 6} y={Y(yHt) + 12} fontSize={fs - 1} fontWeight="600" fill="#64748b">
        {tx.tags.range(range)}
      </text>
      <RichPill x={inL - glass - 8} y={Math.max(Y(yTop) - 4, rimY - 16)} anchor="end" text={bodyLabel} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs} box={box} />
      {full && <RichPill x={inL - glass - 8} y={Math.max(Y(yTop) - 4, rimY - 16) + fs + 14} anchor="end" text={tx.tags.full} bg={COL.fa} size={fs} box={box} />}
      {!narrow && (
        <g fontSize={11} fill="#7c5a2c" fontWeight="600">
          <text x={X(0)} y={tableY + 15} textAnchor="middle">
            {tx.tags.vessel}
          </text>
          <text x={X(CUP.x)} y={tableY + 15} textAnchor="middle">
            {tx.tags.balance}
          </text>
        </g>
      )}
      {!narrow && (
        <text x={X(CUP.x + CUP.r + CUP.glass) + 6} y={Y(CUP.y0 + CUP.h * 0.75)} fontSize={11} fontWeight="600" fill="#64748b">
          {tx.tags.cup}
        </text>
      )}

      {/* the region shown magnified */}
      <rect
        x={X(-R_B - 0.8)}
        y={Y(Math.max(yTop, FLOOR + sim.L) + 0.9)}
        width={(2 * R_B + 1.6) * k}
        height={Y(yb - 0.8) - Y(Math.max(yTop, FLOOR + sim.L) + 0.9)}
        rx={6}
        fill="none"
        stroke={COL.p}
        strokeOpacity="0.55"
        strokeDasharray="4 4"
      />

      <PressureInset box={v.inset} narrow={narrow} sim={sim} yb={yb} Hb={Hb} liq={liq} M={M} p1={p1} p2={p2} T={T} />
    </g>
  );
}

/** The cylinder seen from the side (slightly from above). */
function Body({ x0, x1, yT, yB, k, mat }) {
  const rx = (x1 - x0) / 2;
  const ry = Math.min(0.42 * k, rx * 0.22);
  const cx = (x0 + x1) / 2;
  return (
    <g>
      <path d={`M${x0},${yT} L${x0},${yB} A${rx},${ry} 0 0 0 ${x1},${yB} L${x1},${yT} Z`} fill="url(#arx-dyn-metal)" stroke={mat.edge} strokeWidth="1.2" />
      <ellipse cx={cx} cy={yT} rx={rx} ry={ry} fill={shade(mat.color, 0.3)} stroke={mat.edge} strokeWidth="1.2" />
      {mat.speckle &&
        [
          [0.25, 0.3],
          [0.6, 0.22],
          [0.42, 0.6],
          [0.75, 0.7],
          [0.2, 0.82],
          [0.55, 0.45],
        ].map(([fx, fy], i) => <circle key={i} cx={x0 + fx * 2 * rx} cy={yT + fy * (yB - yT)} r={Math.max(1, k * 0.13)} fill={shade(mat.color, -0.45)} opacity="0.6" />)}
      <path d={`M${cx - 0.3 * k},${yT - ry * 0.2} q0,-${0.7 * k} ${0.3 * k},-${0.7 * k} q${0.3 * k},0 ${0.3 * k},${0.7 * k}`} fill="none" stroke="#475569" strokeWidth="1.6" />
    </g>
  );
}

function BodyOutline({ x0, x1, yT, yB, k, color }) {
  const rx = (x1 - x0) / 2;
  const ry = Math.min(0.42 * k, rx * 0.22);
  return (
    <path
      d={`M${x0},${yT} L${x0},${yB} A${rx},${ry} 0 0 0 ${x1},${yB} L${x1},${yT} A${rx},${ry} 0 0 0 ${x0},${yT} A${rx},${ry} 0 0 0 ${x1},${yT}`}
      fill="none"
      stroke={color}
      strokeOpacity="0.6"
      strokeWidth="1.2"
      pointerEvents="none"
    />
  );
}

function Cup({ X, Y, k, level, lq, amp, phase }) {
  const x0 = X(CUP.x - CUP.r - CUP.glass);
  const x1 = X(CUP.x + CUP.r + CUP.glass);
  const i0 = X(CUP.x - CUP.r);
  const i1 = X(CUP.x + CUP.r);
  const yB = Y(CUP.y0);
  const yF = Y(CUP.y0 + CUP.glass);
  const yR = Y(CUP.y0 + CUP.h);
  return (
    <g>
      <rect x={i0} y={yR} width={i1 - i0} height={yF - yR} fill="#f8fafc" opacity="0.7" />
      {level > CUP.y0 + CUP.glass + 0.02 && <LiquidFill x0={i0} x1={i1} top={Y(level)} bottom={yF} liq={lq} gradId="arx-dyn-liq" amp={amp} phase={phase} menPx={2} />}
      <path d={`M${x0},${yR} L${x0},${yB} L${x1},${yB} L${x1},${yR} L${i1},${yR} L${i1},${yF} L${i0},${yF} L${i0},${yR} Z`} fill="#cbd5e1" opacity="0.9" stroke="#94a3b8" strokeWidth="0.8" />
      <line x1={i0 + 0.5 * k} x2={i0 + 0.5 * k} y1={yR + 0.8 * k} y2={yF - 0.8 * k} stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function Balance({ X, Y, k, text }) {
  const x0 = X(CUP.x - 4.6);
  const x1 = X(CUP.x + 4.6);
  return (
    <g>
      <rect x={X(CUP.x - 3.8)} y={Y(CUP.y0)} width={7.6 * k} height={0.4 * k} rx={1.5} fill="#94a3b8" />
      <rect x={x0} y={Y(3.2)} width={x1 - x0} height={Y(0) - Y(3.2)} rx={0.6 * k} fill="#e2e8f0" stroke="#64748b" strokeWidth="1.2" />
      <rect x={X(CUP.x - 3.4)} y={Y(2.7)} width={6.8 * k} height={2.1 * k} rx={0.3 * k} fill="#0f172a" />
      <text x={X(CUP.x + 3.1)} y={Y(1.15)} textAnchor="end" fontSize={Math.min(14, 1.45 * k)} fontWeight="700" fill="#4ade80" fontFamily="ui-monospace, monospace">
        {text}
      </text>
    </g>
  );
}

/* ------------------------------------------------------- magnified window */

function PressureInset({ box, narrow, sim, yb, Hb, liq, M, p1, p2, T }) {
  const tx = T.dyno.inset;
  const U = T.u;
  const dec = T.decimal;
  const lq = LIQUIDS[liq];
  const { x0, x1, y0, y1 } = box;
  const head = narrow ? 44 : 52;
  const k2 = (y1 - 10 - (y0 + head)) / (L_SP + 2.5);
  const ys = y0 + head + 2.5 * k2;
  const L = sim.L;
  const yFloor = ys + L * k2;
  const zb = yb - FLOOR;
  const dTop = L - (zb + Hb);
  const dBot = L - zb;
  const yT = ys + dTop * k2;
  const yB = ys + dBot * k2;
  const w = 2 * R_B * k2;
  const icx = x0 + (x1 - x0) * (narrow ? 0.44 : 0.43);
  const bx0 = icx - w / 2;
  const bx1 = icx + w / 2;
  const lenOf = (pa) => (pa / P_PER_CM) * k2;
  const rho = lq.rho;
  const fsT = narrow ? 11 : 12.5;
  const fs = narrow ? 10.5 : 11.5;

  const arrows = [];
  const aw = narrow ? 1.8 : 2.2;
  const ah = narrow ? 6 : 7.5;
  if (dTop > 0.01) {
    const len = lenOf(p1);
    [-0.6, 0, 0.6].forEach((f) => {
      const x = icx + f * (w / 2);
      arrows.push(<Arrow key={`t${f}`} x1={x} y1={yT - len - 1} x2={x} y2={yT - 1} color={COL.p} width={aw} head={Math.min(ah, len * 0.6)} />);
    });
  }
  if (dBot > 0.01) {
    const len = lenOf(p2);
    [-0.6, 0, 0.6].forEach((f) => {
      const x = icx + f * (w / 2);
      arrows.push(<Arrow key={`b${f}`} x1={x} y1={yB + len + 1} x2={x} y2={yB + 1} color={COL.p} width={aw} head={Math.min(ah, len * 0.6)} />);
    });
    const top = Math.max(yT, ys);
    for (let i = 0; i < 3; i += 1) {
      const py = top + ((i + 0.5) / 3) * (yB - top);
      const len = lenOf((rho * G * ((py - ys) / k2)) / 100);
      arrows.push(<Arrow key={`l${i}`} x1={bx0 - len - 1} y1={py} x2={bx0 - 1} y2={py} color={COL.p} width={aw * 0.85} head={Math.min(ah * 0.85, len * 0.6)} />);
      arrows.push(<Arrow key={`r${i}`} x1={bx1 + len + 1} y1={py} x2={bx1 + 1} y2={py} color={COL.p} width={aw * 0.85} head={Math.min(ah * 0.85, len * 0.6)} />);
    }
  }

  /* depth ruler on the left, pressure scale on the right */
  const rulerX = x0 + (narrow ? 20 : 26);
  const marks = [];
  for (let d = 0; d <= L + 1e-6; d += 2) {
    const y = ys + d * k2;
    marks.push(
      <g key={d}>
        <line x1={rulerX} x2={rulerX + 6} y1={y} y2={y} stroke="#64748b" />
        <text x={rulerX - 3} y={y + 3.5} textAnchor="end" fontSize={narrow ? 9 : 10} fill="#64748b">
          {d}
        </text>
      </g>,
    );
  }
  const barX = x1 - (narrow ? 44 : 52);
  const pMarks = [];
  for (let d = 0; d <= L + 1e-6; d += 4) {
    const y = ys + d * k2;
    pMarks.push(
      <g key={d}>
        <line x1={barX + 8} x2={barX + 12} y1={y} y2={y} stroke="#64748b" />
        <text x={barX + 14} y={y + 3.5} fontSize={narrow ? 9 : 10} fill="#64748b">
          {Math.round((rho * G * d) / 100)}
        </text>
      </g>,
    );
  }

  /* depths h₁, h₂ */
  const maxSide = dBot > 0 ? lenOf(p2) : 0;
  const dimX1 = Math.min(bx1 + maxSide + (narrow ? 10 : 16), barX - (narrow ? 26 : 34));
  const dimX2 = dimX1 + (narrow ? 13 : 17);
  const dim = (x, ya, yb2, label) => (
    <g>
      <line x1={x} x2={x} y1={ya} y2={yb2} stroke="#334155" strokeWidth="1" />
      <line x1={x - 3} x2={x + 3} y1={ya} y2={ya} stroke="#334155" />
      <line x1={x - 3} x2={x + 3} y1={yb2} y2={yb2} stroke="#334155" />
      <line x1={bx1 + 2} x2={x + 3} y1={yb2} y2={yb2} stroke="#94a3b8" strokeDasharray="2 3" />
      <Tag x={x + 4} y={(ya + yb2) / 2 + 4} text={label} color="#334155" size={narrow ? 10.5 : 12} anchor="start" />
    </g>
  );

  let summary;
  if (dBot <= 0.01) summary = tx.air;
  else if (dTop <= 0.01) summary = tx.partial(Math.round(p2), fmt((Math.round(p2) * S_B) / 1e4, 2, dec), U.pa, U.n);
  else summary = tx.full(Math.round(p1), Math.round(p2), fmt(((Math.round(p2) - Math.round(p1)) * S_B) / 1e4, 2, dec), U.pa, U.n);

  const clipId = 'arx-dyn-inset';
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect x={x0 + 1} y={y0 + head - 6} width={x1 - x0 - 2} height={y1 - y0 - head + 5} rx={10} />
        </clipPath>
        <linearGradient id="arx-dyn-pbar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lq.fill} />
          <stop offset="1" stopColor={shade(lq.deep, -0.35)} />
        </linearGradient>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={14} fill="#fff" stroke="#cbd5e1" strokeWidth="1.5" />
      <text x={x0 + 14} y={y0 + (narrow ? 17 : 20)} fontSize={fsT} fontWeight="700" fill="#0f172a">
        {tx.title}
      </text>
      <text x={x0 + 14} y={y0 + (narrow ? 34 : 39)} fontSize={fs} fontWeight="600" fill={COL.p}>
        {richSvg(summary, fs)}
      </text>
      <g clipPath={`url(#${clipId})`}>
        <LiquidFill x0={x0 + 1} x1={x1 - 1} top={ys} bottom={Math.min(yFloor, y1)} liq={lq} gradId="arx-dyn-liq" amp={sim.amp * k2 * 0.5} phase={sim.phase} menPx={0} />
        {yFloor < y1 && <rect x={x0} y={yFloor} width={x1 - x0} height={y1 - yFloor} fill="#cbd5e1" />}
        <Body x0={bx0} x1={bx1} yT={yT} yB={yB} k={k2} mat={M} />
        {dBot > 0 && (
          <rect x={bx0} y={Math.max(yT, ys)} width={w} height={yB - Math.max(yT, ys)} fill={lq.fill} opacity={0.32} />
        )}
        {arrows}
        {dTop > 0.01 && <Tag x={bx0 - 6} y={yT - lenOf(p1) / 2} text="p_1" color={COL.p} size={narrow ? 11 : 13} anchor="end" />}
        {dBot > 0.01 && <Tag x={bx0 - 6} y={yB + lenOf(p2) / 2 + 9} text="p_2" color={COL.p} size={narrow ? 11 : 13} anchor="end" />}
        {dTop > 0.01 && dim(dimX1, ys, yT, 'h_1')}
        {dBot > 0.01 && dim(dimX2, ys, yB, 'h_2')}
        <line x1={rulerX + 3} x2={rulerX + 3} y1={ys} y2={Math.min(yFloor, y1)} stroke="#64748b" />
        {marks}
        <rect x={barX} y={ys} width={8} height={Math.max(0, Math.min(yFloor, y1) - ys)} fill="url(#arx-dyn-pbar)" stroke="#94a3b8" strokeWidth="0.8" />
        {pMarks}
      </g>
      <text x={rulerX - 3} y={ys - 7} textAnchor="end" fontSize={narrow ? 9.5 : 10.5} fontWeight="700" fill="#64748b">
        {tx.depth}
      </text>
      <text x={barX + 4} y={ys - 7} textAnchor="middle" fontSize={narrow ? 9.5 : 10.5} fontWeight="700" fill="#64748b">
        {tx.pressure}
      </text>
    </g>
  );
}

/* --------------------------------------------------------------- the graph */

function DepthGraph({ T, P, FAfull, Hb, range, h, F, FA }) {
  const tx = T.dyno.graph;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 232;
  const pad = { l: 40, r: 16, t: 20, b: 30 };
  const XM = L_SP - CLEAR;
  const gx = (x) => pad.l + (x / XM) * (W - pad.l - pad.r);
  const gy = (y) => H - pad.b - (y / range) * (H - pad.t - pad.b);
  const { major } = TICKS[range];
  const hk = Math.min(Hb, XM);
  const Fk = P - (FAfull * hk) / Hb;
  const FAk = (FAfull * hk) / Hb;
  const hc = clamp(h, 0, XM);
  const yTicks = [];
  for (let y = 0; y <= range + 1e-9; y += major) yTicks.push(y);
  const xTicks = [0, 2, 4, 6, 8, 10, 12];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{rich(tx.title)}</p>
        {[
          { id: 'P', color: COL.mgText, label: tx.P, dash: true },
          { id: 'F', color: COL.felText, label: tx.F },
          { id: 'FA', color: COL.faText, label: tx.FA },
        ].map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className={`w-4 ${s.dash ? 'h-0 border-t-2 border-dashed' : 'h-0.5 rounded'}`} style={s.dash ? { borderColor: s.color } : { background: s.color }} />
            <span>{rich(s.label)}</span>
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.label} className="block overflow-visible">
          {yTicks.map((y) => (
            <g key={`y${y}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(y)} y2={gy(y)} stroke={y === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(y) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(y, 0, dec)}
              </text>
            </g>
          ))}
          {xTicks.map((x) => (
            <text key={`x${x}`} x={gx(x)} y={H - 10} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {x}
            </text>
          ))}
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {tx.x}
          </text>
          <text x={pad.l + 6} y={pad.t - 7} fontSize="11" fill="#64748b">
            {tx.y}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {Hb <= XM && (
            <g>
              <line x1={gx(Hb)} x2={gx(Hb)} y1={pad.t} y2={H - pad.b} stroke="rgba(110,231,183,0.55)" strokeDasharray="4 4" />
              <text x={gx(Hb) + (gx(Hb) > W - 120 ? -6 : 6)} y={pad.t + 10} textAnchor={gx(Hb) > W - 120 ? 'end' : 'start'} fontSize="11" fontWeight="600" fill={COL.faText}>
                {richSvg(tx.full(fmt(Hb, 1, dec)), 11)}
              </text>
            </g>
          )}
          <line x1={gx(0)} x2={gx(XM)} y1={gy(P)} y2={gy(P)} stroke={COL.mgText} strokeWidth="2" strokeDasharray="6 5" />
          <polyline points={`${gx(0)},${gy(P)} ${gx(hk)},${gy(Fk)} ${gx(XM)},${gy(Fk)}`} fill="none" stroke={COL.felText} strokeWidth="2.5" strokeLinejoin="round" />
          <polyline points={`${gx(0)},${gy(0)} ${gx(hk)},${gy(FAk)} ${gx(XM)},${gy(FAk)}`} fill="none" stroke={COL.faText} strokeWidth="2.5" strokeLinejoin="round" />
          <line x1={gx(hc)} x2={gx(hc)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          <circle cx={gx(hc)} cy={gy(F)} r="5" fill={COL.felText} stroke="#0b0b16" strokeWidth="1.5" />
          <circle cx={gx(hc)} cy={gy(FA)} r="5" fill={COL.faText} stroke="#0b0b16" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{rich(tx.note)}</p>
    </div>
  );
}
