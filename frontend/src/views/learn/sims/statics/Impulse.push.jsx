import { useMemo, useState } from 'react';
import { BookOpen, Lightbulb, RectangleHorizontal, Ruler as RulerIcon, Spline, Triangle } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, fmt, useRafLoop } from '../kit/ui';
import {
  COL,
  Cart,
  Chip,
  FormulaTile,
  GroupLabel,
  InfoBox,
  LabScene,
  Panel,
  PaperGrid,
  PlayControls,
  PulseGraph,
  Rich,
  Ruler,
  ScaleBar,
  VecArrow,
  cartGeom,
  lineView,
  niceMax,
  niceRange,
  niceUnit,
  pickNice,
  trim,
} from './Impulse.parts';

/**
 * Tab 2 — Newton's second law in momentum form, F·Δt = Δp = mv₂ − mv₁.
 * A cart on a frictionless rail gets a push of average force F for a time
 * Δt. The push can be constant, a triangle (peak 2F) or a smooth half-sine
 * (peak πF/2): the area under F(t) is F·Δt in every case, so Δp is the same.
 * Preset (the lesson's example): F = 20 N for 0.5 s on 2 kg from rest →
 * F·Δt = 10 N·s, Δp = 10 kg·m/s, Δv = 5 m/s. Strings come from T.push.
 */

export const SHAPES = {
  rect: { icon: RectangleHorizontal, peak: 1 },
  tri: { icon: Triangle, peak: 2 },
  sine: { icon: Spline, peak: Math.PI / 2 },
};

/** Force at time s after the push began (zero outside 0…D). Every shape has area Fa·D. */
export function pulse(shape, Fa, D, s) {
  if (s < 0 || s > D) return 0;
  if (shape === 'rect') return Fa;
  if (shape === 'tri') return 2 * Fa * (1 - Math.abs((2 * s) / D - 1));
  return (Math.PI / 2) * Fa * Math.sin((Math.PI * s) / D);
}

/** Impulse of the force so far, J(s) = ∫₀ˢ F dt. */
export function impulseSoFar(shape, Fa, D, s) {
  if (s <= 0) return 0;
  if (s >= D) return Fa * D;
  if (shape === 'rect') return Fa * s;
  if (shape === 'tri') return s <= D / 2 ? (2 * Fa * s * s) / D : Fa * D - (2 * Fa * (D - s) ** 2) / D;
  return ((Fa * D) / 2) * (1 - Math.cos((Math.PI * s) / D));
}

/** ∫₀ˢ J dt — the extra displacement times the mass, for the cart's position. */
function impulseIntegral(shape, Fa, D, s) {
  if (s <= 0) return 0;
  const sc = Math.min(s, D);
  let I;
  if (shape === 'rect') I = (Fa * sc * sc) / 2;
  else if (shape === 'tri') {
    const h = D / 2;
    I = sc <= h ? (2 * Fa * sc ** 3) / (3 * D) : (Fa * D * D) / 12 + Fa * D * (sc - h) + ((2 * Fa) / (3 * D)) * ((D - sc) ** 3 - h ** 3);
  } else I = ((Fa * D) / 2) * (sc - (D / Math.PI) * Math.sin((Math.PI * sc) / D));
  if (s > D) I += Fa * D * (s - D);
  return I;
}

/** The whole run for the current settings. */
function plan(shape, F, D, m, v1) {
  const tEnd = niceMax(3 * D);
  const t0 = tEnd / 4;
  const slow = pickNice(5 / tEnd, [1, 2, 4, 5, 10, 20, 25]);
  const xAt = (t) => v1 * t + impulseIntegral(shape, F, D, t - t0) / m;
  let lo = 0;
  let hi = 0;
  for (let i = 0; i <= 80; i += 1) {
    const x = xAt((tEnd * i) / 80);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return { tEnd, t0, slow, xAt, lo, hi, v2: v1 + (F * D) / m };
}

const IDLE = { t: 0, running: false, done: false };

export default function PushSim({ T }) {
  const L = T.push;
  const dec = T.decimal;
  const [shape, setShape] = useState('rect');
  const [F, setF] = useState(20);
  const [D, setD] = useState(0.5);
  const [m, setM] = useState(2);
  const [v1, setV1] = useState(0);
  const [sim, setSim] = useState(IDLE);

  const run = useMemo(() => plan(shape, F, D, m, v1), [shape, F, D, m, v1]);
  const { tEnd, t0, slow, v2 } = run;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt / slow);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const preset = () => {
    setShape('rect');
    setF(20);
    setD(0.5);
    setM(2);
    setV1(0);
    setSim(IDLE);
  };
  const isPreset = shape === 'rect' && F === 20 && D === 0.5 && m === 2 && v1 === 0;
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const tau = t - t0;
  const J = impulseSoFar(shape, F, D, tau);
  const vNow = v1 + J / m;
  const p1 = m * v1;
  const p2 = m * v2;
  const pNow = m * vNow;
  const FD = F * D;
  const dv = FD / m;
  const peak = SHAPES[shape].peak * F;
  const Tr = (n, k = 2) => trim(n, dec, k);

  /* explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t > 0) {
    if (tau < 0) key = Math.abs(v1) < 1e-9 ? 'rest' : 'coast';
    else if (tau <= D) key = v1 < 0 ? (vNow < 0 ? 'brake' : 'reverse') : 'push';
    else key = 'after';
  }
  // the phases follow one another in time and never flip back, so no debounce is needed
  const settled = key;
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    rest: ex.rest,
    coast: ex.coast(Tr(p1)),
    push: shape === 'rect' ? ex.pushRect(Tr(F)) : ex.pushShape,
    brake: ex.brake,
    reverse: ex.reverse,
    after: ex.after(Tr(p2)),
    done: `${ex.done(Tr(FD), Tr(dv), Tr(v2))}${shape === 'rect' ? '' : ex.doneShape(Tr(peak, 1), Tr(F))}`,
  }[settled];
  const tone = { idle: '#22d3ee', rest: '#94a3b8', coast: '#a5b4fc', push: '#f87171', brake: '#fb923c', reverse: '#f472b6', after: '#a5b4fc', done: '#34d399' }[settled];

  /* graphs */
  const fPts = (sh, until = tEnd) => {
    const u = Math.min(until, tEnd);
    const pts = [{ x: 0, y: 0 }];
    if (u <= t0) {
      pts.push({ x: u, y: 0 });
      return pts;
    }
    pts.push({ x: t0, y: 0 });
    const sEnd = Math.min(D, u - t0);
    const n = sh === 'rect' ? 1 : 48;
    for (let i = 0; i <= n; i += 1) {
      const s = (D * i) / n;
      if (s > sEnd) break;
      pts.push({ x: t0 + s, y: pulse(sh, F, D, s) });
    }
    pts.push({ x: t0 + sEnd, y: pulse(sh, F, D, sEnd) });
    if (u - t0 >= D) {
      pts.push({ x: t0 + D, y: 0 });
      pts.push({ x: u, y: 0 });
    }
    return pts;
  };
  const pPts = (until) => {
    const u = Math.min(until, tEnd);
    const pts = [{ x: 0, y: p1 }];
    if (u > t0) {
      pts.push({ x: t0, y: p1 });
      const n = shape === 'rect' ? 1 : 48;
      for (let i = 1; i <= n; i += 1) {
        const s = (D * i) / n;
        if (t0 + s > u) break;
        pts.push({ x: t0 + s, y: p1 + impulseSoFar(shape, F, D, s) });
      }
    }
    pts.push({ x: u, y: p1 + impulseSoFar(shape, F, D, u - t0) });
    return pts;
  };
  const fTop = niceMax(2 * F);
  const pRange = niceRange(Math.min(p1, p2), Math.max(p1, p2));
  const others = Object.keys(SHAPES).filter((k) => k !== shape);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.shapeLabel}</GroupLabel>
          <Segmented
            label={L.shapeLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={shape}
            onChange={change(setShape)}
            accent="#f87171"
            options={Object.keys(SHAPES).map((id) => ({ value: id, label: L.shapes[id].name, sub: L.shapes[id].sub, icon: SHAPES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <PushScene T={T} run={run} shape={shape} F={F} D={D} m={m} v1={v1} t={t} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.J} symbol="F·Δt" value={fmt(J, 2, dec)} unit={T.Ns} accent={COL.F} textColor={COL.FText} sub={L.JSub(Tr(FD))} active={tau > 0 && tau < D} />
        <Readout label={L.readouts.dp} symbol="Δp" value={fmt(pNow - p1, 2, dec).replace('-', '−')} unit={T.pu} accent={COL.dp} textColor={COL.dpText} sub={L.dpSub} active={tau > 0 && tau < D} />
        <Readout label={L.readouts.v} symbol="v" value={fmt(vNow, 2, dec).replace('-', '−')} unit={T.ms} accent={COL.v} textColor={COL.vText} sub={L.vSub(Tr(v1), Tr(v2))} />
        <Readout label={L.readouts.p} symbol="p" value={fmt(pNow, 2, dec).replace('-', '−')} unit={T.pu} accent={COL.p} textColor={COL.pText} sub={L.pSub(Tr(p1), Tr(p2))} active={sim.done} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {sim.done && <p className="text-xs font-semibold text-emerald-300">✓ {L.equal}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={COL.FText}
            general={shape === 'rect' ? 'F · Δt' : `F_{${T.sym.avg}} · Δt`}
            filled={`= ${Tr(F)} ${T.N} · ${Tr(D)} ${T.s}`}
            result={`F·Δt = ${Tr(FD)} ${T.Ns}`}
          />
          <FormulaTile tag={L.f2} color={COL.dpText} general="Δp = F · Δt   ⇒   Δv = F · Δt / m" filled={`Δv = ${Tr(FD)} / ${Tr(m)}`} result={`Δv = ${Tr(dv)} ${T.ms}`} />
          <FormulaTile
            tag={L.f3}
            color={COL.pText}
            general="v₂ = v₁ + Δv,   p₂ = m · v₂"
            filled={`v₂ = ${Tr(v1)} + ${Tr(dv)} = ${Tr(v2)} ${T.ms}`}
            result={`p₂ = ${Tr(p2)} ${T.pu}`}
            ok={sim.done}
          />
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="imp-F"
            label={shape === 'rect' ? L.F : L.Favg}
            symbol={shape === 'rect' ? 'F' : <Rich>{`F_{${T.sym.avg}}`}</Rich>}
            min={2}
            max={40}
            step={1}
            value={F}
            onChange={change(setF)}
            accent={COL.F}
            display={`${Tr(F)} ${T.N}`}
            hint={shape === 'rect' ? L.FHintRect : L.FHint(Tr(peak, 1))}
          />
          <RangeField
            id="imp-dt"
            label={L.dt}
            symbol="Δt"
            min={0.1}
            max={1}
            step={0.1}
            value={D}
            onChange={change(setD)}
            accent="#22d3ee"
            display={`${Tr(D)} ${T.s}`}
            hint={L.dtHint}
          />
          <RangeField id="imp-m2" label={L.m} symbol="m" min={1} max={5} step={0.5} value={m} onChange={change(setM)} accent="#94a3b8" display={`${Tr(m)} ${T.kg}`} />
          <RangeField
            id="imp-v1"
            label={L.v1}
            symbol={<Rich>v₁</Rich>}
            min={-5}
            max={5}
            step={0.5}
            value={v1}
            onChange={change(setV1)}
            accent={COL.v}
            display={`${Tr(v1)} ${T.ms}`}
            hint={L.v1Hint}
          />
          <InfoBox
            title={L.info.title}
            items={[
              [L.info.peak, `${Tr(peak, 1)} ${T.N}`, COL.FText],
              [L.info.dv, `${Tr(dv)} ${T.ms}`, COL.vText],
              [L.info.s, `${Tr(v1 * D + (F * D * D) / (2 * m))} ${T.m}`, '#93c5fd'],
            ]}
          />
          <Btn icon={BookOpen} onClick={preset} disabled={isPreset} className="w-full">
            {L.preset}
          </Btn>
        </Panel>
        <Panel className="lg:col-span-3 space-y-4">
          <PulseGraph
            title={L.graphF.title}
            legend={[
              { color: COL.F, label: L.graphF.live, kind: 'line' },
              { color: COL.F, label: L.graphF.area, kind: 'area' },
              { color: '#94a3b8', label: L.graphF.other, kind: 'dash' },
            ]}
            series={[
              ...others.map((k) => ({ id: k, color: '#94a3b8', points: fPts(k), dash: '5 4', width: 1.8, opacity: 0.75 })),
              { id: 'full', color: COL.F, points: fPts(shape), width: 2, opacity: t > 0 ? 0.45 : 1, fill: t > 0 ? undefined : COL.F, fillOpacity: 0.2 },
              ...(t > 0 ? [{ id: 'live', color: COL.F, points: fPts(shape, t), fill: COL.F, fillOpacity: 0.32 }] : []),
            ]}
            xMax={tEnd}
            yMax={fTop}
            xLabel={L.graphF.t}
            yLabel={L.graphF.y}
            marker={t}
            labels={[{ x: t0 + D / 2, y: Math.min(F, fTop) * 0.45, text: L.graphF.areaTag(Tr(FD)), color: '#fecaca' }]}
            decimal={dec}
            height={180}
            note={L.graphF.note}
          />
          <PulseGraph
            title={L.graphP.title}
            legend={[{ color: COL.pText, label: L.graphP.live, kind: 'line' }]}
            series={[
              { id: 'plan', color: '#475569', points: pPts(tEnd), dash: '4 5', width: 1.8 },
              ...(t > 0 ? [{ id: 'live', color: COL.pText, points: pPts(t), dot: true }] : []),
            ]}
            xMax={tEnd}
            yMin={pRange.min}
            yMax={pRange.max}
            yStep={pRange.step}
            xLabel={L.graphP.t}
            yLabel={L.graphP.y}
            marker={t}
            threshold={Math.abs(p1) > 1e-9 ? { y: p1, label: L.graphP.p1, color: '#94a3b8' } : undefined}
            brackets={tau >= D ? [{ x: t0 + D + (tEnd - t0 - D) * 0.25, y1: p1, y2: p2, color: COL.dpText, label: `Δp = ${Tr(p2 - p1)}` }] : []}
            decimal={dec}
            height={170}
            note={L.graphP.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function PushScene({ T, run, shape, F, D, m, v1, t }) {
  const L = T.push;
  const dec = T.decimal;
  const { t0, slow, xAt, lo, hi, v2 } = run;
  const tau = t - t0;
  const Fnow = pulse(shape, F, D, tau);
  const J = impulseSoFar(shape, F, D, tau);
  const p1 = m * v1;
  const pNow = m * (v1 + J / m);
  const pMax = Math.max(Math.abs(p1), Math.abs(m * v2), 0.5);
  const pScale = niceMax(pMax, 1);
  const kFor = (narrow) => (narrow ? 1.4 : 2.3); // px per newton
  const pLenMax = (narrow) => (narrow ? 70 : 150);

  return (
    <LabScene
      legend={[
        { color: COL.F, label: L.legend.F, kind: 'arrow' },
        { color: COL.p, label: L.legend.p, kind: 'arrow' },
        { color: COL.p, label: L.legend.p1, kind: 'dasharrow' },
        { color: COL.dp, label: L.legend.dp, kind: 'arrow' },
        { color: '#fca5a5', label: L.legend.zone, kind: 'area' },
      ]}
      chips={(W, narrow) => {
        const kF = kFor(narrow);
        const kp = pLenMax(narrow) / pScale;
        const uF = niceUnit(kF, narrow ? 22 : 30);
        const up = niceUnit(kp, narrow ? 22 : 30);
        return (
          <>
            <Chip strong={tau > 0 && tau < D}>
              {slow > 1 ? L.chipSlow(slow) : L.chipReal} · t = {fmt(t, 2, dec)} {T.s}
            </Chip>
            <Chip icon={RulerIcon} color={COL.F}>
              <ScaleBar px={uF * kF} label={`${trim(uF, dec)} ${T.N}`} color={COL.F} />
              <span className="text-slate-300">·</span>
              <ScaleBar px={up * kp} label={`${trim(up, dec)} ${T.pu}`} color={COL.p} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => (narrow ? 270 : 300)}
      ariaLabel={L.sceneLabel(fmt(t, 2, dec), fmt(v1 + J / m, 2, dec), fmt(pNow, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 13;
        const len = narrow ? 70 : 96;
        const rulerY = H - 30;
        const railY = rulerY - 14;
        const span = Math.max(hi - lo, 1);
        const kp = pLenMax(narrow) / pScale;
        const p2 = m * v2;
        const padL = len / 2 + (narrow ? 12 : 20) + Math.max(0, -p1, -p2) * kp + (Math.min(p1, p2) < 0 ? 30 : 0);
        const padR = len / 2 + (narrow ? 12 : 20) + Math.max(0, p1, p2) * kp + (narrow ? 22 : 30);
        const view = lineView(lo - span * 0.04, lo + span * 1.04, W, padL, padR);
        const step = niceUnit(view.k, narrow ? 46 : 64);
        const x = xAt(t);
        const cx = view.sx(x);
        const g = cartGeom(len, m);
        const kF = kFor(narrow);
        const cartTop = railY + g.top;
        const yF = cartTop - 9;
        const yRow2 = cartTop - (narrow ? 32 : 36);
        const yRow1 = yRow2 - (narrow ? 24 : 28);
        const pushing = tau > 0 && tau < D;
        const zoneA = view.sx(xAt(t0));
        const zoneB = view.sx(xAt(Math.min(t, t0 + D)));
        const rot = (cx / (len * 0.1)) % (Math.PI * 2);
        const side = (val) => (val >= 0 ? 'right' : 'left');
        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={railY} step={step} rowPx={narrow ? 24 : 28} />
            {/* rail and the stretch where the force acted */}
            <rect x={0} y={railY} width={W} height={7} fill="#cbd5e1" />
            <line x1={0} x2={W} y1={railY} y2={railY} stroke="#475569" strokeWidth={1.6} />
            {tau > 0 && zoneB - zoneA !== 0 && (
              <rect x={Math.min(zoneA, zoneB)} y={railY - 3} width={Math.abs(zoneB - zoneA)} height={10} fill="#fca5a5" opacity={0.75} rx={2} />
            )}
            <line x1={view.sx(0)} x2={view.sx(0)} y1={railY - 8} y2={rulerY} stroke="#0f172a" strokeWidth={1.4} strokeDasharray="3 3" opacity={0.6} />

            <Cart cx={cx} y={railY} len={len} mass={m} label={`${trim(m, dec)} ${T.kg}`} rot={rot} fs={narrow ? 10 : 12} />

            {/* the force, from the back face where it is applied */}
            {pushing && Fnow * kF > 1 && (
              <g>
                <line x1={cx - len / 2 + 2} x2={cx - len / 2 + 2} y1={yF} y2={railY + g.bodyTop + 2} stroke={COL.F} strokeWidth={1.4} strokeDasharray="2 2" />
                <VecArrow x={cx - len / 2 + 2} y={yF} dx={Fnow * kF} dy={0} color={COL.F} main="F" fs={fs} width={3.6} place="right" />
              </g>
            )}

            {/* momentum: p₁ + Δp = p (head to tail) above, the current p below */}
            {tau > 0 && (
              <g>
                <VecArrow x={cx} y={yRow1} dx={p1 * kp} dy={0} color={COL.p} main={Math.abs(p1) > 1e-9 ? 'p' : ''} sub="1" fs={fs - 1} width={2.4} dash="5 4" opacity={0.75} place="above" />
                {Math.abs(p1) < 1e-9 && <circle cx={cx} cy={yRow1} r={3} fill={COL.p} opacity={0.7} />}
                <VecArrow x={cx + p1 * kp} y={yRow1} dx={(pNow - p1) * kp} dy={0} color={COL.dp} main="Δp" fs={fs - 1} width={3} place={side(pNow - p1)} />
              </g>
            )}
            <VecArrow x={cx} y={yRow2} dx={pNow * kp} dy={0} color={COL.p} main="p" sub={tau >= D ? '2' : tau <= 0 ? '1' : ''} fs={fs} width={3.4} place={side(pNow)} />

            {/* ruler */}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
            <path d={`M${cx},${rulerY - 1} l-5,-8 l10,0 Z`} fill={COL.p} />
          </>
        );
      }}
    </LabScene>
  );
}
