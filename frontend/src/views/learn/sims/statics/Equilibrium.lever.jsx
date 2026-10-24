import { useState } from 'react';
import { ArrowDownLeft, Dumbbell, Grid3x3, Lightbulb, Scale, Sparkles, Equal } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import {
  Chip,
  DimLine,
  Eq,
  ForceArrow,
  ForceChips,
  ForceScale,
  G,
  GroupLabel,
  InfoBox,
  LabScene,
  MethodPanel,
  MomentArc,
  Panel,
  PaperGrid,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  ceil4,
  num,
  rad,
  symWidth,
} from './Equilibrium.parts';

/**
 * Tab 1 — a lever (richag) on a stand: one load hangs on each arm.
 *   ΣM = 0 about the axis O:  F₁·d₁ = F₂·d₂   (M₁ anticlockwise, M₂ clockwise)
 *   ΣF = 0:                    N = F₁ + F₂    (the beam's weight is neglected)
 * When the moments differ the beam turns until its end rests on a stop
 * (6°); the stop then takes R = |M₁ − M₂|·cos6° / 1.28 m and N drops by R·cos6°.
 * Preset: 20 N at 0.5 m balances 10 N at 1.0 m (10 N·m = 10 N·m, N = 30 N).
 * The golden rule: turned by φ, the arms' ends travel s = d·φ, so the side
 * with the smaller force moves d₂/d₁ = F₁/F₂ times farther.
 */

const COL = {
  f1: '#dc2626',
  f1Text: '#fca5a5',
  f2: '#7c3aed',
  f2Text: '#c4b5fd',
  N: '#2563eb',
  NText: '#93c5fd',
  R: '#0f766e',
  RText: '#5eead4',
  ok: '#059669',
  okText: '#6ee7b7',
  warn: '#d97706',
};

const HALF = 1.32; // m, half the beam
const POS_MAX = 1.2; // m, the farthest hole
const STOP_L = 1.28; // m, where the stops touch the beam (along it)
const TH_STOP = rad(6);
const PIV_Y = 1.15; // m, the axis above the table
const BEAM_T = 0.06; // m
const STRING = 0.36; // m
const HANGER = 0.05; // m
const DISC_H = 0.034; // m
const DISC_W = 0.15; // m
const DISC_N = 5; // N per slotted weight
const I_BEAM = (1.5 * (2 * HALF) ** 2) / 12; // kg·m², a 1.5 kg beam
const GHOST = rad(15);
const POST_X = STOP_L * Math.cos(TH_STOP) - (BEAM_T / 2) * Math.sin(TH_STOP);
const POST_TOP = PIV_Y - STOP_L * Math.sin(TH_STOP) - (BEAM_T / 2) * Math.cos(TH_STOP);
const BOX = { x0: -1.48, x1: 1.48, y0: -0.16, y1: 1.64 };

const PRESETS = {
  lesson: { F1: 20, d1: 0.5, F2: 10, d2: 1.0, icon: Scale },
  equal: { F1: 15, d1: 0.6, F2: 15, d2: 0.6, icon: Equal },
  gain: { F1: 40, d1: 0.3, F2: 10, d2: 1.2, icon: Dumbbell },
  tilt: { F1: 20, d1: 0.6, F2: 10, d2: 1.0, icon: ArrowDownLeft },
};

const r1 = (v) => Math.round(v * 10) / 10;

/** Statics of the lever for the given loads (level arms). */
function leverPhysics(F1, d1, F2, d2) {
  const M1 = F1 * d1;
  const M2 = F2 * d2;
  const dM = M1 - M2; // anticlockwise positive
  const balanced = Math.abs(dM) < 1e-6;
  const R = balanced ? 0 : (Math.abs(dM) * Math.cos(TH_STOP)) / STOP_L;
  const Ry = R * Math.cos(TH_STOP);
  return { M1, M2, dM, balanced, R, Ry, N: F1 + F2 - Ry, side: balanced ? 0 : Math.sign(dM) };
}

/* ==================================================================== sim */

export default function LeverSim({ T }) {
  const L = T.lever;
  const dec = T.decimal;
  const [F1, setF1] = useState(20);
  const [d1, setD1] = useState(0.5);
  const [F2, setF2] = useState(10);
  const [d2, setD2] = useState(1.0);
  const [beam, setBeam] = useState({ th: 0, om: 0 });
  const [ghost, setGhost] = useState(false);
  const [touched, setTouched] = useState(false);
  const ph = leverPhysics(F1, d1, F2, d2);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].F1 === F1 && PRESETS[k].d1 === d1 && PRESETS[k].F2 === F2 && PRESETS[k].d2 === d2) ?? null;

  const resting = !ph.balanced && Math.abs(Math.abs(beam.th) - TH_STOP) < 1e-9 && Math.sign(beam.th) === ph.side && beam.om === 0;
  const settledLevel = ph.balanced && beam.th === 0 && beam.om === 0;
  const moving = !(resting || settledLevel);

  useRafLoop(moving, (dt) => {
    setBeam((b) => {
      let { th, om } = b;
      const I = (F1 / G) * d1 * d1 + (F2 / G) * d2 * d2 + I_BEAM;
      const n = 6;
      const h = dt / n;
      for (let i = 0; i < n; i += 1) {
        // a balanced school lever settles level (its own centre of mass sits just under the axis)
        const acc = ph.balanced ? -10 * th - 2 * 0.6 * Math.sqrt(10) * om : (ph.dM * Math.cos(th)) / I - 1.4 * om;
        om += acc * h;
        th += om * h;
        if (th > TH_STOP) {
          th = TH_STOP;
          om = om > 0 ? -om * 0.22 : om;
        } else if (th < -TH_STOP) {
          th = -TH_STOP;
          om = om < 0 ? -om * 0.22 : om;
        }
      }
      if (ph.balanced && Math.abs(th) < 2e-4 && Math.abs(om) < 2e-3) return { th: 0, om: 0 };
      if (!ph.balanced && Math.abs(Math.abs(th) - TH_STOP) < 1e-6 && Math.sign(th) === ph.side && Math.abs(om) < 0.06) return { th: ph.side * TH_STOP, om: 0 };
      return { th, om };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setTouched(true);
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setF1(p.F1);
    setD1(p.d1);
    setF2(p.F2);
    setD2(p.d2);
    setTouched(true);
  };

  /* ---- words */
  const N1 = (v) => fmt(v, 1, dec);
  const D2 = (v) => fmt(v, 2, dec);
  const needD2 = ph.M1 / F2;
  const needF2 = ph.M2 > 0 ? ph.M1 / d2 : 0;
  const needD1 = ph.M2 / F1;
  const needF1 = ph.M2 / d1;
  const gainK = F1 >= F2 ? F1 / F2 : F2 / F1;
  const small = F1 >= F2 ? 2 : 1; // which side carries the smaller force
  const sBig = Math.min(d1, d2) * GHOST * 100;
  const sSmall = Math.max(d1, d2) * GHOST * 100;
  // a hint the sliders can reach: an arm on the 0.1 m grid, or a load in 5 N steps
  const onGrid = (v) => v >= 0.1 - 1e-9 && v <= POS_MAX + 1e-9 && Math.abs(v * 10 - Math.round(v * 10)) < 1e-6;
  const inSteps = (v) => v >= 5 - 1e-9 && v <= 50 + 1e-9 && Math.abs(v / 5 - Math.round(v / 5)) < 1e-6;
  const fixText = (side) => {
    if (side > 0) {
      if (onGrid(needD2)) return L.fix.d2(D2(needD2));
      if (inSteps(needF2)) return L.fix.F2(fmt(needF2, 0, dec));
      return L.fix.prod2(N1(ph.M1));
    }
    if (onGrid(needD1)) return L.fix.d1(D2(needD1));
    if (inSteps(needF1)) return L.fix.F1(fmt(needF1, 0, dec));
    return L.fix.prod1(N1(ph.M2));
  };

  let key;
  if (!ph.balanced) key = ph.side > 0 ? 'ccw' : 'cw';
  else if (ghost) key = F1 === F2 ? 'goldenEqual' : 'golden';
  else if (!touched && preset === 'lesson') key = 'intro';
  else if (F1 === F2) key = 'equal';
  else if (gainK >= 3 - 1e-9) key = 'gain';
  else key = 'balanced';
  const settled = useSettled(`${key}|${F1}|${d1}|${F2}|${d2}`, 260);
  const sKey = settled.split('|')[0];
  const ex = L.explain;
  const text = {
    intro: ex.intro(N1(ph.M1), N1(ph.M2), N1(F1 + F2)),
    balanced: ex.balanced(F1, D2(d1), F2, D2(d2), N1(ph.M1), fmt(F1 / F2, 2, dec)),
    equal: ex.equal(F1, D2(d1)),
    gain: ex.gain(fmt(gainK, gainK % 1 ? 1 : 0, dec)),
    golden: ex.golden(small === 2 ? 'F_{2}' : 'F_{1}', fmt(sSmall, 1, dec), fmt(sBig, 1, dec), fmt(gainK, gainK % 1 ? 1 : 0, dec)),
    goldenEqual: ex.goldenEqual(fmt(sBig, 1, dec)),
    ccw: ex.ccw(N1(ph.M1), N1(ph.M2), fixText(1)),
    cw: ex.cw(N1(ph.M1), N1(ph.M2), fixText(-1)),
  }[sKey];
  const tone = { intro: '#22d3ee', balanced: '#34d399', equal: '#34d399', gain: '#34d399', golden: '#fbbf24', goldenEqual: '#fbbf24', ccw: '#f87171', cw: '#a78bfa' }[sKey];

  const verdict = ph.balanced ? L.verdict.ok : ph.side > 0 ? L.verdict.ccw : L.verdict.cw;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <Btn
          icon={Sparkles}
          aria-pressed={ghost}
          onClick={() => {
            setGhost((g) => !g);
            setTouched(true);
          }}
          disabled={!ph.balanced}
          style={ghost && ph.balanced ? { borderColor: 'rgba(252,211,77,0.7)', background: 'rgba(251,191,36,0.16)', color: '#fef3c7' } : undefined}
          className="min-h-[52px] text-[15px] xl:min-w-[190px]"
        >
          {L.goldenBtn}
        </Btn>
      </div>

      <SceneRow
        renderScene={(fitH) => <LeverScene T={T} F1={F1} d1={d1} F2={F2} d2={d2} th={beam.th} ph={ph} resting={resting} ghost={ghost && ph.balanced} verdict={verdict} fitH={fitH} />}
        method={<LeverMethod T={T} F1={F1} d1={d1} F2={F2} d2={d2} ph={ph} resting={resting} fixText={ph.balanced ? null : fixText(ph.side)} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.M1}
          symbol={<Sym>{'M_{1}'}</Sym>}
          value={N1(ph.M1)}
          unit={T.Nm}
          accent={COL.f1}
          textColor={COL.f1Text}
          sub={<Sym>{L.readouts.M1Sub(F1, D2(d1))}</Sym>}
          active={ph.side > 0}
        />
        <Readout
          label={L.readouts.M2}
          symbol={<Sym>{'M_{2}'}</Sym>}
          value={N1(ph.M2)}
          unit={T.Nm}
          accent={COL.f2}
          textColor={COL.f2Text}
          sub={<Sym>{L.readouts.M2Sub(F2, D2(d2))}</Sym>}
          active={ph.side < 0}
        />
        <Readout
          label={L.readouts.N}
          symbol="N"
          value={N1(ph.N)}
          unit={T.N}
          accent={COL.N}
          textColor={COL.NText}
          sub={<Sym>{ph.balanced ? L.readouts.NSub(F1, F2) : L.readouts.NSubStop(N1(ph.R))}</Sym>}
        />
        <Readout
          label={L.readouts.sum}
          symbol="ΣM"
          value={num(ph.dM, 1, dec)}
          unit={T.Nm}
          accent={ph.balanced ? COL.ok : COL.warn}
          textColor={ph.balanced ? COL.okText : '#fde68a'}
          sub={verdict}
          active={ph.balanced}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-2">
          <RangeField id="eq-F1" label={L.F1} symbol="F₁" min={5} max={50} step={5} value={F1} onChange={change(setF1)} accent={COL.f1} display={`${F1} ${T.N}`} hint={L.Fhint(F1 / DISC_N)} />
          <RangeField id="eq-d1" label={L.d1} symbol="d₁" min={0.1} max={POS_MAX} step={0.1} value={d1} onChange={change((v) => setD1(r1(v)))} accent={COL.f1} display={`${D2(d1)} ${T.m}`} />
          <RangeField id="eq-F2" label={L.F2} symbol="F₂" min={5} max={50} step={5} value={F2} onChange={change(setF2)} accent={COL.f2} display={`${F2} ${T.N}`} hint={L.Fhint(F2 / DISC_N)} />
          <RangeField id="eq-d2" label={L.d2} symbol="d₂" min={0.1} max={POS_MAX} step={0.1} value={d2} onChange={change((v) => setD2(r1(v)))} accent={COL.f2} display={`${D2(d2)} ${T.m}`} />
          <InfoBox
            title={L.info.title}
            items={[
              [L.info.force, ph.balanced ? L.info.times(fmt(gainK, 2, dec)) : '—', '#fde68a'],
              [L.info.path, ph.balanced ? L.info.times(fmt(Math.max(d1, d2) / Math.min(d1, d2), 2, dec)) : '—', '#a5f3fc'],
              [L.info.work, ph.balanced ? `${fmt(sBig, 1, dec)} / ${fmt(sSmall, 1, dec)} ${T.cm}` : '—', '#e2e8f0'],
            ]}
          >
            <p className="mt-2 text-[11px] leading-snug text-gray-500">{ph.balanced ? L.info.note : L.info.noteOff}</p>
          </InfoBox>
        </Panel>
        <Panel className="lg:col-span-3">
          <LeverGraph T={T} F1={F1} d1={d1} F2={F2} d2={d2} ph={ph} onPick={(x) => change(setD2)(clamp(r1(x), 0.1, POS_MAX))} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function LeverScene({ T, F1, d1, F2, d2, th, ph, resting, ghost, verdict, fitH }) {
  const L = T.lever;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: COL.f1, label: L.legend.F1, kind: 'arrow' },
        { color: COL.f2, label: L.legend.F2, kind: 'arrow' },
        { color: COL.N, label: L.legend.N, kind: 'arrow' },
        { color: '#475569', label: L.legend.M, kind: 'arc' },
        { color: '#475569', label: L.legend.d, kind: 'dim' },
      ]}
      chips={(W, narrow, H) => {
        const view = leverView(W, H, narrow);
        const kF = forceScale(view, F1 + F2);
        return (
          <>
            {!narrow && (
              <Chip icon={Grid3x3} color="#64748b">
                {L.cell(fmt(0.1, 1, dec))}
              </Chip>
            )}
            <ForceScale kF={kF} label={T.scale} unit={T.N} decimal={dec} />
          </>
        );
      }}
      height={(W, narrow) => fitH ?? (narrow ? Math.max(236, W * 0.7) : 452)}
      ariaLabel={L.sceneLabel(F1, fmt(d1, 2, dec), F2, fmt(d2, 2, dec), fmt(ph.M1, 1, dec), fmt(ph.M2, 1, dec), verdict)}
    >
      {(W, H, narrow) => <LeverDrawing T={T} W={W} H={H} narrow={narrow} F1={F1} d1={d1} F2={F2} d2={d2} th={th} ph={ph} resting={resting} ghost={ghost} verdict={verdict} />}
    </LabScene>
  );
}

function leverView(W, H, narrow) {
  return makeView(BOX, W, H, narrow ? { l: 6, r: 6, t: 40, b: 4 } : { l: 12, r: 12, t: 58, b: 8 });
}

/** px per newton: the support reaction (the largest force) gets 0.32 m. */
function forceScale(view, Nmax) {
  return (0.32 * view.k) / Math.max(Nmax, 1);
}

function LeverDrawing({ T, W, H, narrow, F1, d1, F2, d2, th, ph, resting, ghost, verdict }) {
  const L = T.lever;
  const dec = T.decimal;
  const view = leverView(W, H, narrow);
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12.5;
  const box = { w: W, h: H };
  const kF = forceScale(view, F1 + F2);
  const px = X(0);
  const py = Y(PIV_Y);
  const c = Math.cos(th);
  const s = Math.sin(th);
  /** a point `u` along the beam, `v` across it (world), as screen coordinates */
  const onBeam = (u, v = 0) => ({ x: X(u * c - v * s), y: Y(PIV_Y + u * s + v * c) });
  const tableY = Y(0);
  const beamDeg = (-th * 180) / Math.PI;

  const loads = [
    { side: -1, F: F1, d: d1, col: COL.f1, sym: 'F_{1}', dSym: 'd_{1}' },
    { side: 1, F: F2, d: d2, col: COL.f2, sym: 'F_{2}', dSym: 'd_{2}' },
  ].map((l) => {
    const a = onBeam(l.side * l.d, 0);
    const strBottom = a.y + STRING * k;
    return { ...l, a, strBottom, n: Math.round(l.F / DISC_N) };
  });

  /* moment arcs: their sweep compares M₁ with M₂ */
  const Mref = Math.max(ph.M1, ph.M2, 1e-9);
  const rA = clamp(0.3 * k, 24, 62);
  const sweepMax = rad(68);
  const top = -Math.PI / 2;
  const gap = rad(9);

  /* ruler numbers along the beam (desktop) */
  const marks = [];
  for (let i = -12; i <= 12; i += 1) {
    const u = i / 10;
    const hole = onBeam(u, 0);
    marks.push(<circle key={`h${i}`} cx={hole.x} cy={hole.y} r={Math.max(1.3, 0.011 * k)} fill={i === 0 ? 'none' : '#f8fafc'} stroke="#475569" strokeWidth="0.8" />);
    if (!narrow && i !== 0 && i % 2 === 0) {
      const p = onBeam(u, BEAM_T / 2 + 0.035);
      marks.push(
        <text key={`n${i}`} x={p.x} y={p.y} textAnchor="middle" fontSize={fs - 3} fill="#64748b" transform={`rotate(${beamDeg.toFixed(2)} ${p.x} ${p.y})`}>
          {fmt(Math.abs(u), 1, dec)}
        </text>,
      );
    }
  }

  /* a dimension line for each arm, horizontal: the perpendicular from the axis to the vertical line of action.
     It runs between the force arrows' tips and the hooks. */
  const dimY = Y(PIV_Y - 0.375);

  /* golden rule ghost */
  const gTh = (F1 >= F2 ? -1 : 1) * GHOST;
  const gc = Math.cos(gTh);
  const gs = Math.sin(gTh);
  const onGhost = (u, v = 0) => ({ x: X(u * gc - v * gs), y: Y(PIV_Y + u * gs + v * gc) });

  return (
    <g>
      <PaperGrid view={view} W={W} H={H} step={narrow ? 0.2 : 0.1} />

      {/* table */}
      <rect x={0} y={tableY} width={W} height={H - tableY} fill="#efe2cd" />
      <line x1={0} x2={W} y1={tableY} y2={tableY} stroke="#b08d5b" strokeWidth="2" />

      {/* stops under the beam ends */}
      {[-1, 1].map((sd) => (
        <g key={`stop${sd}`} aria-hidden="true">
          <rect x={X(sd * POST_X) - 0.016 * k} y={Y(POST_TOP - 0.03)} width={0.032 * k} height={Y(0) - Y(POST_TOP - 0.03)} fill="#cbd5e1" stroke="#94a3b8" />
          <rect x={X(sd * POST_X) - 0.024 * k} y={Y(POST_TOP)} width={0.048 * k} height={0.03 * k} rx={0.008 * k} fill="#334155" />
          <rect x={X(sd * POST_X) - 0.07 * k} y={Y(0.025)} width={0.14 * k} height={0.025 * k} fill="#94a3b8" />
        </g>
      ))}

      {/* stand */}
      <g aria-hidden="true">
        <rect x={X(-0.25)} y={Y(0.035)} width={0.5 * k} height={0.035 * k} rx={0.01 * k} fill="#475569" />
        <rect x={X(-0.02)} y={Y(PIV_Y - 0.12)} width={0.04 * k} height={(PIV_Y - 0.12 - 0.035) * k} fill="#64748b" />
        <path d={`M${X(-0.075)},${Y(PIV_Y - 0.13)} L${X(0.075)},${Y(PIV_Y - 0.13)} L${X(0.03)},${Y(PIV_Y + 0.02)} L${X(-0.03)},${Y(PIV_Y + 0.02)} Z`} fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
      </g>

      {/* the vertical through the axis */}
      <line x1={px} x2={px} y1={Y(PIV_Y + 0.1)} y2={dimY + 10} stroke="#64748b" strokeWidth="1.2" strokeDasharray="4 4" />

      {/* golden rule: the beam turned by 15° */}
      {ghost && (
        <g opacity="0.85">
          <g transform={`rotate(${((-gTh * 180) / Math.PI).toFixed(2)} ${px} ${py})`}>
            <rect x={X(-HALF)} y={Y(PIV_Y + BEAM_T / 2)} width={2 * HALF * k} height={BEAM_T * k} rx={3} fill="none" stroke="#d97706" strokeWidth="1.6" strokeDasharray="6 4" />
          </g>
          {loads.map((l) => {
            const from = l.side < 0 ? Math.PI : 0;
            const g = onGhost(l.side * l.d);
            const rise = l.side * gTh > 0; // this end goes up
            const sCm = l.d * GHOST * 100;
            return (
              <g key={`g${l.side}`}>
                <MomentArc cx={px} cy={py} r={l.d * k} from={from} sweep={-gTh} color="#d97706" width={2.4} head={8} />
                <circle cx={g.x} cy={g.y} r={3.5} fill="#d97706" />
                <SvgSym
                  x={g.x + l.side * 8}
                  y={g.y + (rise ? -10 : fs + 6)}
                  text={l.side < 0 ? 's_{1}' : 's_{2}'}
                  value={`${fmt(sCm, 1, dec)} ${T.cm}`}
                  color="#b45309"
                  fs={fs - 0.5}
                  anchor={l.side < 0 ? 'end' : 'start'}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* lever-arm dimension lines */}
      {loads.map((l) => {
        const xEnd = l.a.x;
        const lenPx = Math.abs(xEnd - px);
        const lab = `${fmt(l.d, 2, dec)} ${T.m}`;
        const fits = lenPx > symWidth(l.dSym, lab, fs - 0.5) + 10;
        return (
          <g key={`dim${l.side}`}>
            <line x1={xEnd} x2={xEnd} y1={dimY - 6} y2={dimY + 6} stroke={l.col} strokeWidth="1" opacity="0.5" />
            <DimLine
              x1={px}
              y1={dimY}
              x2={xEnd}
              y2={dimY}
              color={l.col}
              width={2}
              label={l.dSym}
              fs={fs - 0.5}
              side={l.side < 0 ? -1 : 1}
              box={box}
              value={fits ? lab : undefined}
              labelAt={{ x: (px + xEnd) / 2, y: dimY + fs + 4, anchor: 'middle' }}
            />
          </g>
        );
      })}

      {/* strings and slotted weights */}
      {loads.map((l) => (
        <WeightStack key={`w${l.side}`} x={l.a.x} y={l.a.y} bottom={l.strBottom} n={l.n} k={k} color={l.col} />
      ))}

      {/* the beam */}
      <g transform={`rotate(${beamDeg.toFixed(2)} ${px} ${py})`}>
        <rect x={X(-HALF)} y={Y(PIV_Y + BEAM_T / 2)} width={2 * HALF * k} height={BEAM_T * k} rx={Math.min(4, 0.02 * k)} fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
        <rect x={X(-HALF)} y={Y(PIV_Y + BEAM_T / 2)} width={2 * HALF * k} height={BEAM_T * k * 0.35} rx={Math.min(4, 0.02 * k)} fill="#e2e8f0" />
      </g>
      {marks}
      <circle cx={px} cy={py} r={Math.max(4, 0.026 * k)} fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
      <circle cx={px} cy={py} r={1.8} fill="#0f172a" />
      {!narrow && (
        <text x={px - 0.05 * k} y={py + 0.11 * k} textAnchor="end" fontSize={fs - 1} fontWeight="700" fontStyle="italic" fill="#0f172a" stroke="#fff" strokeWidth="3" paintOrder="stroke">
          O
        </text>
      )}

      {/* forces */}
      {loads.map((l) => (
        <ForceArrow
          key={`f${l.side}`}
          x={l.a.x}
          y={l.a.y}
          dx={0}
          dy={l.F * kF}
          color={l.col}
          label={l.sym}
          value={`${l.F} ${T.N}`}
          fs={fs}
          box={box}
          labelAt={{ x: l.a.x + l.side * 9, y: l.a.y + l.F * kF - 2, anchor: l.side < 0 ? 'end' : 'start' }}
        />
      ))}
      <ForceArrow x={px} y={py - 4} dx={0} dy={-ph.N * kF} color={COL.N} label="N" value={`${fmt(ph.N, ph.balanced ? 0 : 1, dec)} ${T.N}`} fs={fs} box={box} />
      {resting && ph.R > 0 && (
        (() => {
          const side = -ph.side; // the lowered end: left when M₁ wins
          const cpt = onBeam(side * STOP_L, -BEAM_T / 2);
          const nx = -s;
          const ny = c;
          const len = ph.R * kF;
          return (
            <ForceArrow
              x={cpt.x - nx * len}
              y={cpt.y + ny * len}
              dx={nx * len}
              dy={-ny * len}
              color={COL.R}
              label="R"
              value={`${fmt(ph.R, 1, dec)} ${T.N}`}
              fs={fs - 0.5}
              width={2.6}
              head={9}
              box={box}
              labelAt={{ x: cpt.x + side * 10, y: cpt.y + 0.12 * k + fs, anchor: side < 0 ? 'end' : 'start' }}
            />
          );
        })()
      )}

      {/* moments about O */}
      <MomentArc
        cx={px}
        cy={py}
        r={rA}
        from={top - gap}
        sweep={-sweepMax * (ph.M1 / Mref)}
        color={COL.f1}
        width={narrow ? 2.6 : 3.2}
        head={narrow ? 9 : 11}
        label="M_{1}"
        value={`${fmt(ph.M1, 1, dec)} ${T.Nm}`}
        fs={fs}
        box={box}
        labelAt={{ x: px - rA * 0.62 - 8, y: py - rA * 0.95, anchor: 'end' }}
      />
      <MomentArc
        cx={px}
        cy={py}
        r={rA}
        from={top + gap}
        sweep={sweepMax * (ph.M2 / Mref)}
        color={COL.f2}
        width={narrow ? 2.6 : 3.2}
        head={narrow ? 9 : 11}
        label="M_{2}"
        value={`${fmt(ph.M2, 1, dec)} ${T.Nm}`}
        fs={fs}
        box={box}
        labelAt={{ x: px + rA * 0.62 + 8, y: py - rA * 0.95, anchor: 'start' }}
      />

      {/* verdict on the table */}
      {!narrow && <Pill x={px + 0.62 * k} y={(tableY + H) / 2} text={verdict} bg={ph.balanced ? COL.ok : COL.warn} size={fs - 1} box={box} />}
    </g>
  );
}

/** A string from (x, y) down to `bottom`, a hook, and `n` slotted 5 N weights. */
function WeightStack({ x, y, bottom, n, k, color }) {
  const w = DISC_W * k;
  const dh = DISC_H * k;
  const hang = HANGER * k;
  const discs = [];
  for (let i = 0; i < n; i += 1) {
    const top = bottom + hang + i * dh;
    discs.push(
      <g key={i}>
        <rect x={x - w / 2} y={top} width={w} height={Math.max(1.5, dh - 0.6)} rx={Math.min(2.5, dh * 0.4)} fill={i % 2 ? '#64748b' : '#475569'} stroke="#1e293b" strokeWidth="0.6" />
        <rect x={x - w / 2 + 1} y={top + 0.6} width={w - 2} height={Math.max(0.6, dh * 0.22)} rx={1} fill="#94a3b8" opacity="0.55" />
      </g>,
    );
  }
  return (
    <g aria-hidden="true">
      <line x1={x} y1={y} x2={x} y2={bottom} stroke="#334155" strokeWidth="1.4" />
      <path d={`M${x},${bottom} q${-0.02 * k},${hang * 0.4} 0,${hang * 0.7}`} fill="none" stroke="#334155" strokeWidth="1.6" />
      <line x1={x} y1={bottom + hang * 0.6} x2={x} y2={bottom + hang + n * dh + 2} stroke="#1e293b" strokeWidth={Math.max(1.5, 0.012 * k)} />
      {discs}
      <rect x={x - w / 2 - 1} y={bottom + hang + n * dh} width={w + 2} height={Math.max(2, 0.01 * k)} rx={1} fill={color} />
    </g>
  );
}

/* =========================================================== the method */

function LeverMethod({ T, F1, d1, F2, d2, ph, resting, fixText }) {
  const L = T.lever;
  const M = L.method;
  const dec = T.decimal;
  const D2 = (v) => fmt(v, 2, dec);
  const N1 = (v) => fmt(v, 1, dec);
  const N = T.N;
  return (
    <MethodPanel badge="ΣF = 0 · ΣM = 0" title={M.title}>
      <Step n={1} title={M.s1}>
        <ForceChips
          items={[
            { sym: 'F_{1}', color: COL.f1, text: COL.f1Text },
            { sym: 'F_{2}', color: COL.f2, text: COL.f2Text },
            { sym: 'N', color: COL.N, text: COL.NText },
            ...(resting ? [{ sym: 'R', color: COL.R, text: COL.RText }] : []),
          ]}
        />
        <p className="mt-1 text-[12px] text-gray-400">{M.weightless}</p>
      </Step>
      <Step n={2} title={M.s2}>
        {resting ? (
          <Eq sym="N + R_{y} − F_{1} − F_{2} = 0" nums={`N = ${F1} + ${F2} − ${N1(ph.Ry)} =`} result={`${N1(ph.N)} ${N}`} resultColor={COL.NText} />
        ) : (
          <Eq sym="N − F_{1} − F_{2} = 0" nums={`N = ${F1} + ${F2} =`} result={`${fmt(ph.N, 0, dec)} ${N}`} resultColor={COL.NText} />
        )}
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym="M_{1} − M_{2} = F_{1}d_{1} − F_{2}d_{2}" />
        <p className="tabular-nums text-gray-400">
          {`${F1}·${D2(d1)} − ${F2}·${D2(d2)} = ${N1(ph.M1)} − ${N1(ph.M2)} = `}
          <b style={{ color: ph.balanced ? COL.okText : '#fde68a' }}>
            {ph.balanced ? M.zero : `${num(ph.dM, 1, dec)} ${T.Nm} ≠ 0`}
          </b>
        </p>
        {resting && (
          <p className="mt-1 text-[12px] text-gray-400">
            <Sym>{M.stop(N1(ph.R))}</Sym>
          </p>
        )}
      </Step>
      <Step n={4} title={M.s4}>
        <Eq sym="F_{1} / F_{2} = d_{2} / d_{1}" nums={`${F1} / ${F2} = ${fmt(F1 / F2, 2, dec)};  ${D2(d2)} / ${D2(d1)} = ${fmt(d2 / d1, 2, dec)}`} />
        <p className="mt-1 text-[12.5px]" style={{ color: ph.balanced ? COL.okText : '#fde68a' }}>
          <Sym>{ph.balanced ? M.ruleOk : fixText}</Sym>
        </p>
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function LeverGraph({ T, F1, d1, F2, d2, ph, onPick }) {
  const L = T.lever;
  const dec = T.decimal;
  const yMax = ceil4(Math.max(ph.M1, F2 * POS_MAX) * 1.05);
  const xb = ph.M1 / F2;
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'm1', label: L.graph.m1, color: COL.f1Text, points: [{ x: 0, y: ph.M1 }, { x: POS_MAX, y: ph.M1 }], dot: false, dash: '6 5' },
        { id: 'm2', label: L.graph.m2, color: COL.f2Text, points: [{ x: 0, y: 0 }, { x: POS_MAX, y: F2 * POS_MAX }], dot: false },
        { id: 'bal', label: L.graph.bal, color: '#34d399', points: xb <= POS_MAX + 1e-9 ? [{ x: xb, y: ph.M1 }] : [] },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: d2, y: ph.M2 }] },
      ]}
      xMax={POS_MAX}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={d2}
      decimal={dec}
      xDigits={1}
      height={286}
      ariaLabel={L.graph.label(F1, fmt(d1, 2, dec), F2)}
      onScrub={onPick}
      note={xb <= POS_MAX + 1e-9 ? L.graph.note(fmt(xb, 2, dec)) : L.graph.noteNo(fmt(xb, 2, dec))}
    />
  );
}
