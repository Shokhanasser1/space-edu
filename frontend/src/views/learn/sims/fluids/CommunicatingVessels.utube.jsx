import { useState } from 'react';
import { Droplets, FlaskConical, Lightbulb, Pipette } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import {
  CV,
  Eq,
  FormulaPanel,
  G,
  GridCm,
  GroupLabel,
  LIQ,
  LabScene,
  Panel,
  PressureArrow,
  Ruler,
  SceneRow,
  Step,
  SurfaceLine,
  Sym,
  SymPill,
  big,
  surfacePoints,
} from './CommunicatingVessels.parts';

/**
 * Tab 2 — a U-tube with two liquids that do not mix. The heavier liquid
 * (density ρ₂) fills the bend; a column h₁ of the lighter one (ρ₁) is poured
 * into the right arm. At rest the pressure is the same at the level of the
 * interface in both arms (A and B), so ρ₁gh₁ = ρ₂gh₂, where h₂ is the height
 * of the heavier liquid in the left arm above that level.
 *
 * Model (cm): the interface goes down by z in the right arm and the heavier
 * liquid rises by z in the left one, so h₂ = 2z and at rest z = ρ₁h₁ / (2ρ₂).
 * The column oscillates about that: z'' = ω²(z_eq − z) − 2ζωz',
 * ω² = 2ρ₂g / (ρ₂L₂ + ρ₁h₁) (L₂ — length of the heavier column), ζ = 0.22.
 * Presets: 10 cm of kerosene (800) over water → h₂ = 8 cm (784 Pa on both
 * sides); 10 cm of oil (900) → 9 cm; 13.6 cm of water over mercury → 1 cm
 * (1 332.8 Pa).
 */

const Y0 = 12; // level of the heavier liquid with nothing poured, cm
const ARM_TOP = 30;
const R_IN = 5.6; // bend radii, cm (arm centre-lines at x = ±7, bore 2.8 cm)
const R_OUT = 8.4;
const L2 = (2 * Y0 + Math.PI * 7) / 100; // heavier column length, m
const ZETA = 0.22;
const POUR_SPEED = 2.5; // cm of column per second
const DRAW_SPEED = 4;
const H1_MAX = 16;
const BOX = { x0: -21, x1: 23, y0: -9.8, y1: 35.2 };

const PAIRS = {
  kerosene: { light: 'kerosene', heavy: 'water', preset: 10, graph: '#facc15' },
  oil: { light: 'oil', heavy: 'water', preset: 10, graph: '#f97316' },
  mercury: { light: 'water', heavy: 'mercury', preset: 13.6, graph: '#cbd5e1' },
};
const PAIR_IDS = ['kerosene', 'oil', 'mercury'];

const zEq = (pair, h1) => (LIQ[PAIRS[pair].light].rho * h1) / (2 * LIQ[PAIRS[pair].heavy].rho);

function settledAt(pair, h1) {
  return { h1, z: zEq(pair, h1), vz: 0, t: 0, calm: 10 };
}

function step(p, dt, pair, target) {
  const rho1 = LIQ[PAIRS[pair].light].rho;
  const rho2 = LIQ[PAIRS[pair].heavy].rho;
  let { h1, z, vz } = p;
  const n = Math.max(1, Math.ceil(dt * 240));
  const hs = dt / n;
  for (let i = 0; i < n; i += 1) {
    if (h1 < target) h1 = Math.min(target, h1 + POUR_SPEED * hs);
    else if (h1 > target) h1 = Math.max(target, h1 - DRAW_SPEED * hs);
    const w2 = (2 * rho2 * G) / (rho2 * L2 + (rho1 * h1) / 100);
    const w = Math.sqrt(w2);
    const a = w2 * ((rho1 * h1) / (2 * rho2) - z) - 2 * ZETA * w * vz;
    vz += a * hs;
    z += vz * hs;
  }
  const still = h1 === target && Math.abs(vz) < 0.02 && Math.abs(z - zEq(pair, h1)) < 0.01;
  return { h1, z, vz, t: p.t + dt, calm: still ? p.calm + dt : 0 };
}

/* ==================================================================== sim */

export default function UTubeSim({ T }) {
  const L = T.utube;
  const dec = T.decimal;
  const [pair, setPair] = useState('kerosene');
  const [target, setTarget] = useState(PAIRS.kerosene.preset);
  const [sim, setSim] = useState(() => settledAt('kerosene', PAIRS.kerosene.preset));
  const [touched, setTouched] = useState(false);
  const P = PAIRS[pair];
  const light = LIQ[P.light];
  const heavy = LIQ[P.heavy];
  const names = L.pairs[pair];

  const active = sim.h1 !== target || sim.calm < 1.2;
  useRafLoop(active, (dt) => setSim((p) => step(p, dt, pair, target)));

  const pickPair = (id) => {
    setPair(id);
    setTouched(true);
    setSim({ h1: 0, z: 0, vz: 0, t: 0, calm: 0 });
    setTarget(PAIRS[id].preset);
  };
  const setH1 = (v) => {
    setTouched(true);
    setTarget(Math.round(v * 10) / 10);
    setSim((p) => ({ ...p, calm: 0 }));
  };

  /* ---- live values */
  const h1 = sim.h1;
  const h2 = 2 * sim.z;
  const h2eq = 2 * zEq(pair, h1);
  const pB = light.rho * G * (h1 / 100);
  const pA = heavy.rho * G * (h2 / 100);
  const still = sim.calm > 0.2 && sim.h1 === target;
  const C1 = (v) => fmt(v, 1, dec);
  const ratio = light.rho > 0 ? heavy.rho / light.rho : 0;

  /* ---- explanation */
  let key;
  if (sim.h1 < target - 1e-9) key = 'pouring';
  else if (sim.h1 > target + 1e-9) key = 'drawing';
  else if (!still) key = 'moving';
  else if (h1 < 0.05) key = 'empty';
  else key = pair === 'mercury' ? 'settledHg' : 'settled';
  const settled = useSettled(key, key === 'moving' ? 400 : 150);
  const ex = L.explain;
  const text = {
    pouring: ex.pouring(names),
    drawing: ex.drawing(names),
    moving: ex.moving,
    empty: ex.empty(names),
    settled: ex.settled(names, C1(h1), C1(h2), fmt(ratio, 2, dec)),
    settledHg: ex.settledHg(C1(h1), C1(h2)),
  }[settled];
  const tone = { pouring: '#fbbf24', drawing: '#fbbf24', moving: '#22d3ee', empty: '#22d3ee', settled: '#34d399', settledHg: '#34d399' }[settled];

  /* ---- graph: h₂ against h₁ for the three pairs */
  const series = [
    { id: 'same', label: L.graph.same, color: '#64748b', dash: '4 5', dot: false, points: [{ x: 0, y: 0 }, { x: H1_MAX, y: H1_MAX }] },
    ...PAIR_IDS.map((id) => ({
      id,
      label: L.pairs[id].name,
      color: PAIRS[id].graph,
      dot: false,
      points: [
        { x: 0, y: 0 },
        { x: H1_MAX, y: 2 * zEq(id, H1_MAX) },
      ],
    })),
    { id: 'now', label: L.graph.now, color: '#22d3ee', points: [{ x: h1, y: Math.max(0, h2) }] },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.pairsLabel}</GroupLabel>
          <Segmented
            label={L.pairsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={pair}
            onChange={pickPair}
            accent={PAIRS[pair].graph}
            options={PAIR_IDS.map((id) => ({ value: id, label: L.pairs[id].name, sub: L.pairs[id].sub, icon: FlaskConical }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Droplets} onClick={() => setH1(P.preset)} disabled={target === P.preset && sim.h1 === P.preset} className="xl:min-w-[168px] min-h-[52px] text-[15px]">
            {L.preset(fmt(P.preset, 1, dec))}
          </Btn>
          <Btn icon={Pipette} onClick={() => setH1(0)} disabled={target === 0 && sim.h1 === 0} className="min-h-[52px] text-[15px]">
            {L.empty}
          </Btn>
        </div>
      </div>

      <SceneRow
        minH={500}
        maxH={580}
        renderScene={(fitH) => <UTubeScene T={T} pair={pair} sim={sim} target={target} fitH={fitH} />}
        under={
          <Explain icon={Lightbulb} id={`${settled}-${pair}`} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        side={
          <FormulaPanel formula="ρ_{1}h_{1} = ρ_{2}h_{2}" title={L.steps.title}>
            <Step n={1} title={L.steps.b}>
              <Eq sym="p_{B} = ρ_{1}·g·h_{1}" nums={`= ${big(light.rho, 0, dec)} · ${fmt(G, 1, dec)} · ${fmt(h1 / 100, 3, dec)} =`} result={`${big(pB, 1, dec)} ${T.Pa}`} resultColor={CV.pressureText} />
            </Step>
            <Step n={2} title={L.steps.a}>
              <Eq sym="p_{A} = ρ_{2}·g·h_{2}" nums={`= ${big(heavy.rho, 0, dec)} · ${fmt(G, 1, dec)} · ${fmt(h2 / 100, 3, dec)} =`} result={`${big(pA, 1, dec)} ${T.Pa}`} resultColor={CV.pressureText} />
            </Step>
            <Step n={3} title={L.steps.eq}>
              <Eq sym="h_{2} = ρ_{1}·h_{1} / ρ_{2}" nums={`= ${big(light.rho, 0, dec)} · ${C1(h1)} / ${big(heavy.rho, 0, dec)} =`} result={`${C1(h2eq)} ${T.cm}`} resultColor={heavy === LIQ.mercury ? '#e2e8f0' : '#93c5fd'} />
              <p className="mt-1.5 text-gray-400">
                <Sym>{L.steps.ratio(fmt(ratio, 2, dec))}</Sym>
              </p>
            </Step>
            <li className="rounded-xl bg-black/25 px-3 py-2 text-xs leading-snug text-gray-400">
              <Sym>{L.steps.note}</Sym>
            </li>
          </FormulaPanel>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.h1} symbol={<Sym>{'h_{1}'}</Sym>} value={C1(h1)} unit={T.cm} accent={light.dot} textColor={light.text} sub={<Sym>{L.h1Sub(names.lightCap, big(light.rho, 0, dec))}</Sym>} />
        <Readout label={L.readouts.h2} symbol={<Sym>{'h_{2}'}</Sym>} value={C1(Math.max(0, h2))} unit={T.cm} accent={heavy.dot} textColor={heavy.text} sub={<Sym>{L.h2Sub(names.heavyCap, big(heavy.rho, 0, dec))}</Sym>} />
        <Readout
          label={L.readouts.p}
          symbol="p"
          value={big(pB, 0, dec)}
          unit={T.Pa}
          accent={CV.pressure}
          textColor={CV.pressureText}
          active={still && h1 > 0}
          sub={<Sym>{Math.abs(pA - pB) < 0.5 ? L.pEqual : L.pDiff(big(pA, 0, dec))}</Sym>}
        />
        <Readout
          label={L.readouts.ratio}
          symbol={
            <Sym>
              {'h_{1} : h_{2}'}
            </Sym>
          }
          value={h2 > 0.05 ? fmt(h1 / h2, 2, dec) : '—'}
          accent="#22d3ee"
          textColor="#a5f3fc"
          sub={<Sym>{L.ratioSub(fmt(ratio, 2, dec))}</Sym>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="cv-u-h1"
            label={L.h1Label(names.light)}
            symbol={<Sym>{'h_{1}'}</Sym>}
            min={0}
            max={H1_MAX}
            step={0.2}
            value={target}
            onChange={setH1}
            accent={light.dot}
            display={`${C1(target)} ${T.cm}`}
            hint={L.h1Hint(C1(2 * zEq(pair, target)), names)}
          />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">
            <Sym>{touched ? L.tip : L.tipStart}</Sym>
          </p>
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={L.graph.title}
            series={series}
            xMax={H1_MAX}
            yMax={H1_MAX}
            xLabel={L.graph.x}
            yLabel={L.graph.y}
            decimal={dec}
            note={L.graph.note}
            ariaLabel={L.graph.label}
            height={190}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

const padFor = (narrow) => (narrow ? { l: 8, r: 8, t: 12, b: 10 } : { l: 12, r: 12, t: 46, b: 12 });

function UTubeScene({ T, pair, sim, target, fitH }) {
  const L = T.utube;
  const P = PAIRS[pair];
  const light = LIQ[P.light];
  const heavy = LIQ[P.heavy];
  const names = L.pairs[pair];
  const kPfor = (k) => (0.2 * (BOX.y1 - BOX.y0) * k) / (light.rho * G * (H1_MAX / 100));
  return (
    <LabScene
      ariaLabel={L.sceneLabel(names.light, fmt(sim.h1, 1, T.decimal), names.heavy, fmt(2 * sim.z, 1, T.decimal))}
      legend={[
        { kind: 'box', color: light.edge, fill: light.fill, label: L.legend.light(names.light, big(light.rho, 0, T.decimal)) },
        { kind: 'box', color: heavy.edge, fill: heavy === LIQ.mercury ? '#cbd5e1' : heavy.fill, label: L.legend.heavy(names.heavy, big(heavy.rho, 0, T.decimal)) },
        { kind: 'down', color: CV.pressure, label: L.legend.pressure },
        { kind: 'dash', color: CV.level, label: L.legend.level },
      ]}
      height={(W, narrow) => fitH ?? clamp(((W - 20) / (BOX.x1 - BOX.x0)) * (BOX.y1 - BOX.y0) + (narrow ? 24 : 60), 340, 580)}
    >
      {(W, H, narrow) => <UTubeDrawing T={T} W={W} H={H} narrow={narrow} pair={pair} sim={sim} target={target} kPfor={kPfor} />}
    </LabScene>
  );
}

function UTubeDrawing({ T, W, H, narrow, pair, sim, target, kPfor }) {
  const L = T.utube;
  const dec = T.decimal;
  const P = PAIRS[pair];
  const light = LIQ[P.light];
  const heavy = LIQ[P.heavy];
  const view = makeView(BOX, W, H, padFor(narrow));
  const { sx, sy, k } = view;
  const fs = narrow ? 10 : 12;
  const box = { w: W, h: H };
  const kP = kPfor(k);

  const yI = Y0 - sim.z; // interface (right arm)
  const yL = Y0 + sim.z; // heavier liquid, left arm
  const yT = yI + sim.h1; // top of the lighter liquid
  const h2 = 2 * sim.z;
  const pouring = sim.h1 < target - 1e-9;
  const drawing = sim.h1 > target + 1e-9;
  const phase = sim.t * 8;
  const ampL = clamp(Math.abs(sim.vz) * 1.2, 0, 2.2);
  const ampR = clamp(Math.abs(sim.vz) * 1.2, 0, 2.2) + (pouring ? 1.2 : 0);
  const men = clamp(k * 0.32, 1.5, 3.5);

  const xa = sx(-R_OUT);
  const xb = sx(-R_IN);
  const xc = sx(R_IN);
  const xd = sx(R_OUT);
  const y0 = sy(0);
  const ro = R_OUT * k;
  const ri = R_IN * k;

  // heavier liquid: left surface → down the left inner wall → inner bend → up the right inner wall → interface → down the right outer wall → outer bend
  const surfL = surfacePoints(xa, xb, sy(yL), { men: heavy.meniscus * men, amp: ampL, phase });
  const hasLight = sim.h1 > 0.02;
  const iface = hasLight ? null : surfacePoints(xc, xd, sy(yI), { men: heavy.meniscus * men, amp: ampR, phase: phase + 2 });
  const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
  const heavyD = [
    `M${pts(surfL)}`,
    `L${xb},${y0}`,
    `A${ri},${ri} 0 0 0 ${xc},${y0}`,
    iface ? `L${pts(iface)}` : `L${xc},${sy(yI)} L${xd},${sy(yI)}`,
    `L${xd},${y0}`,
    `A${ro},${ro} 0 0 1 ${xa},${y0}`,
    'Z',
  ].join(' ');
  const surfT = surfacePoints(xc, xd, sy(yT), { men: light.meniscus * men, amp: ampR, phase: phase + 2 });
  const lightD = `M${xc},${sy(yI)} L${pts(surfT)} L${xd},${sy(yI)} Z`;

  // glass
  const top = sy(ARM_TOP);
  const glassOuter = `M${xa},${top} L${xa},${y0} A${ro},${ro} 0 0 0 ${xd},${y0} L${xd},${top}`;
  const glassInner = `M${xb},${top} L${xb},${y0} A${ri},${ri} 0 0 0 ${xc},${y0} L${xc},${top}`;
  const channel = `${glassOuter} L${xc},${top} L${xc},${y0} A${ri},${ri} 0 0 0 ${xb},${y0} L${xb},${top} Z`;

  // pressure arrows at A and B (equal pressure → equal arrows at rest)
  const pB = light.rho * G * (sim.h1 / 100);
  const pA = heavy.rho * G * (h2 / 100);
  const xA = sx(-7);
  const xB = sx(7);
  const yIs = sy(yI);
  const lenA = pA * kP;
  const lenB = pB * kP;

  // rulers zeroed at the interface level, one against each arm
  const RL = 18; // ruler length, cm
  const rulerL = xa - 4;
  const rulerR = xd + 4;
  const heavyBar = heavy === LIQ.mercury ? '#64748b' : heavy.edge;
  const eq = Math.abs(pA - pB) < 0.5;

  return (
    <g>
      <GridCm view={view} W={W} H={H} />

      {/* stand */}
      <rect x={sx(-1.2)} y={sy(-R_OUT)} width={sx(1.2) - sx(-1.2)} height={sy(BOX.y0 + 0.6) - sy(-R_OUT)} fill="#cbd5e1" />
      <rect x={sx(-6)} y={sy(BOX.y0 + 0.6)} width={sx(6) - sx(-6)} height={Math.max(3, k * 0.5)} rx="2" fill="#94a3b8" />

      {/* glass channel and the liquids */}
      <path d={channel} fill="url(#cv-glass)" />
      <path d={heavyD} fill={heavy.fill} fillOpacity={heavy.opacity} />
      {hasLight && <path d={lightD} fill={light.fill} fillOpacity={light.opacity} />}
      <SurfaceLine liq={heavy} surface={surfL} />
      {iface && <SurfaceLine liq={heavy} surface={iface} />}
      {hasLight && (
        <>
          <line x1={xc} x2={xd} y1={yIs} y2={yIs} stroke={heavy.edge} strokeWidth="1.8" />
          <SurfaceLine liq={light} surface={surfT} />
        </>
      )}
      <path d={glassOuter} fill="none" stroke={CV.glass} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={glassInner} fill="none" stroke={CV.glass} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={`M${xa + 2.6},${sy(ARM_TOP - 2)} L${xa + 2.6},${sy(ARM_TOP * 0.45)}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M${xc + 2.6},${sy(ARM_TOP - 2)} L${xc + 2.6},${sy(ARM_TOP * 0.45)}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />

      {/* the rulers, zero at the level of the interface */}
      <Ruler x={rulerL} yBottom={yIs} k={k} from={0} to={RL} minor={1} major={narrow ? 10 : 5} side={-1} fs={fs - 1} decimal={dec} />
      <Ruler x={rulerR} yBottom={yIs} k={k} from={0} to={RL} minor={1} major={narrow ? 10 : 5} side={1} fs={fs - 1} decimal={dec} />
      <text x={rulerL} y={sy(yI + RL) - 10} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {L.rulerUnit}
      </text>
      {h2 > 0.02 && <line x1={rulerL - 1.5} x2={rulerL - 1.5} y1={yIs} y2={sy(yL)} stroke={heavyBar} strokeWidth="4" strokeLinecap="round" opacity="0.85" />}
      {hasLight && <line x1={rulerR + 1.5} x2={rulerR + 1.5} y1={yIs} y2={sy(yT)} stroke={light.edge} strokeWidth="4" strokeLinecap="round" opacity="0.85" />}
      {h2 > 0.02 && <line x1={rulerL} x2={xa} y1={sy(yL)} y2={sy(yL)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 3" />}
      {hasLight && <line x1={xd} x2={rulerR} y1={sy(yT)} y2={sy(yT)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 3" />}
      {hasLight && (
        <>
          <SymPill x={rulerL - (narrow ? 26 : 34)} y={sy(yL)} anchor="end" text={`h_{2} = ${fmt(Math.max(0, h2), 1, dec)} ${T.cm}`} bg="#fff" color={heavyBar} border={heavyBar} fs={fs} box={box} />
          <SymPill x={rulerR + (narrow ? 26 : 34)} y={sy(yT)} anchor="start" text={`h_{1} = ${fmt(sim.h1, 1, dec)} ${T.cm}`} bg="#fff" color={light.edge} border={light.edge} fs={fs} box={box} />
        </>
      )}

      {/* the level of the interface, A and B, the pressure there */}
      {hasLight && (
        <g pointerEvents="none">
          <line x1={rulerL} x2={rulerR} y1={yIs} y2={yIs} stroke={CV.level} strokeWidth="1.5" strokeDasharray="6 5" />
          <PressureArrow x1={xA} y1={yIs - lenA - 1} x2={xA} y2={yIs - 1} width={narrow ? 2.2 : 2.8} head={narrow ? 7 : 9} />
          <PressureArrow x1={xB} y1={yIs - lenB - 1} x2={xB} y2={yIs - 1} width={narrow ? 2.2 : 2.8} head={narrow ? 7 : 9} />
          <circle cx={xA} cy={yIs} r="3.6" fill="#fff" stroke={CV.ink} strokeWidth="1.8" />
          <circle cx={xB} cy={yIs} r="3.6" fill="#fff" stroke={CV.ink} strokeWidth="1.8" />
          <text x={xb + 5} y={yIs + fs + 4} fontSize={fs + 1} fontWeight="800" fill={CV.ink}>
            A
          </text>
          <text x={xc - 5} y={yIs + fs + 4} textAnchor="end" fontSize={fs + 1} fontWeight="800" fill={CV.ink}>
            B
          </text>
          <SymPill
            x={sx(0)}
            y={yIs - (narrow ? 14 : 18)}
            text={eq ? (narrow ? 'p_{A} = p_{B}' : `p_{A} = p_{B} = ${big(pB, 0, dec)} ${T.Pa}`) : 'p_{A} ≠ p_{B}'}
            bg={eq ? CV.pressure : '#fff'}
            color={eq ? '#fff' : CV.pressure}
            border={eq ? undefined : CV.pressure}
            fs={fs}
            box={box}
          />
        </g>
      )}

      {/* funnel on the right arm, the bottle, the pipette */}
      <Funnel sx={sx} sy={sy} k={k} />
      {!drawing && <Bottle sx={sx} sy={sy} k={k} liq={light} pouring={pouring} />}
      {pouring && <Stream sx={sx} sy={sy} k={k} liq={light} yTo={yT} t={sim.t} />}
      {drawing && <PipetteDraw sx={sx} sy={sy} k={k} liq={light} yTo={yT} t={sim.t} />}
    </g>
  );
}

function Funnel({ sx, sy, k }) {
  const x0 = sx(7);
  const yA = sy(ARM_TOP - 1.5);
  const yB = sy(ARM_TOP + 0.5);
  const yC = sy(ARM_TOP + 3);
  const w1 = 0.9 * k;
  const w2 = 3 * k;
  return (
    <g pointerEvents="none">
      <path d={`M${x0 - w1},${yB} L${x0 - w2},${yC} L${x0 + w2},${yC} L${x0 + w1},${yB} Z`} fill="url(#cv-glass)" />
      <path d={`M${x0 - w1},${yA} L${x0 - w1},${yB} L${x0 - w2},${yC} M${x0 + w1},${yA} L${x0 + w1},${yB} L${x0 + w2},${yC}`} fill="none" stroke={CV.glassDark} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}

/** A small flask beside the funnel; it tips while pouring. */
function Bottle({ sx, sy, k, liq, pouring }) {
  const s = clamp(k / 10, 0.55, 1.2);
  const x = sx(10.6);
  const y = sy(ARM_TOP + 3.4);
  const rot = pouring ? -38 : -6;
  return (
    <g pointerEvents="none" style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot}deg) scale(${s.toFixed(3)})`, transition: 'transform 0.4s ease' }}>
      {/* the neck points left (to the funnel); the body is to the right */}
      <path d="M0,-3.5 L12,-3.5 L16,-11 L40,-11 Q44,-11 44,-7 L44,7 Q44,11 40,11 L16,11 L12,3.5 L0,3.5 Z" fill="#f8fafc" stroke="#475569" strokeWidth="1.7" strokeLinejoin="round" />
      <path d={`M${pouring ? 13 : 24},-10 L40,-10 Q43,-10 43,-7 L43,7 Q43,10 40,10 L${pouring ? 13 : 24},10 Z`} fill={liq.fill} fillOpacity={Math.min(1, liq.opacity + 0.2)} />
      <rect x="-2" y="-4.5" width="3" height="9" rx="1" fill="#e2e8f0" stroke="#475569" strokeWidth="1.2" />
    </g>
  );
}

function Stream({ sx, sy, k, liq, yTo, t }) {
  const x = sx(7);
  const w = clamp(k * 0.3, 2, 3.4);
  const d = `M${sx(10.4)},${sy(ARM_TOP + 2.9)} Q${sx(8.2)},${sy(ARM_TOP + 2.6)} ${x},${sy(ARM_TOP + 0.6)} L${x},${sy(yTo)}`;
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke={liq.fill} strokeOpacity="0.95" strokeWidth={w} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth={w * 0.4} strokeDasharray="3 7" strokeDashoffset={-t * 80} strokeLinecap="round" />
    </g>
  );
}

/** A pipette dipping into the right arm, drawing the lighter liquid out. */
function PipetteDraw({ sx, sy, k, liq, yTo, t }) {
  const x = sx(7);
  const w = clamp(k * 0.22, 1.6, 2.6);
  const yTip = sy(yTo - 0.6);
  const yTop = sy(ARM_TOP + 2.4);
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={yTop} y2={yTip} stroke="#475569" strokeWidth={w + 2.4} strokeLinecap="round" />
      <line x1={x} x2={x} y1={yTop} y2={yTip} stroke="#f8fafc" strokeWidth={w} strokeLinecap="round" />
      <line x1={x} x2={x} y1={yTop} y2={yTip} stroke={liq.fill} strokeWidth={w} strokeDasharray="4 5" strokeDashoffset={t * 60} />
      <ellipse cx={x} cy={yTop - 8} rx={5.5} ry={8.5} fill="#f87171" stroke="#b91c1c" strokeWidth="1.4" />
    </g>
  );
}
