import { useState } from 'react';
import { ChevronsLeftRight, Lightbulb, Scale3d, Triangle, TriangleRight } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useSettled } from '../kit/ui';
import { TimeGraph, makeView } from '../kit/scene';
import {
  AngleArc,
  Eq,
  FbdAxis,
  FbdPaper,
  ForceArrow,
  ForceChips,
  ForceScale,
  G,
  GroupLabel,
  LabScene,
  MethodPanel,
  Panel,
  PaperGrid,
  SceneRow,
  Step,
  Sym,
  rad,
} from './Equilibrium.parts';

/**
 * Tab 3 — the first condition, ΣF = 0, with vectors: a sign hangs from a ring
 * held by two ropes at angles α₁ and α₂ to the vertical.
 *   Ox:  T₂·sinα₂ − T₁·sinα₁ = 0
 *   Oy:  T₁·cosα₁ + T₂·cosα₂ − mg = 0
 *   ⇒   T₁ = mg·sinα₂ / sin(α₁+α₂),   T₂ = mg·sinα₁ / sin(α₁+α₂)
 * The three forces drawn head to tail close into a triangle.
 * Presets (m = 5 kg, mg = 49 N): 30°/30° → T = 28.3 N each; 60°/60° → T = 49 N
 * = mg; 30°/60° → T₁ = 42.4 N, T₂ = 24.5 N; 80°/80° → T = 141 N > the 100 N
 * the cord can hold.
 */

const COL = {
  T1: '#0891b2',
  T1Text: '#67e8f9',
  T2: '#7c3aed',
  T2Text: '#c4b5fd',
  mg: '#dc2626',
  mgText: '#fca5a5',
  rope: '#92400e',
  ok: '#059669',
  okText: '#6ee7b7',
};

const H_CEIL = 0.55; // m, the frame's top bar above the ring
const X_POST = 1.2; // m, the frame's posts
const CORD = 0.16; // m, from the ring down to the sign
const SIGN_W = 0.9;
const SIGN_H = 0.42;
const ROPE_MAX = 100; // N, what the thin cord holds
const A_MAX = 80;
const BOX = { x0: -1.32, x1: 1.32, y0: -1.02, y1: 0.68 };

const PRESETS = {
  sym30: { m: 5, a1: 30, a2: 30, icon: Triangle },
  sym60: { m: 5, a1: 60, a2: 60, icon: Scale3d },
  asym: { m: 5, a1: 30, a2: 60, icon: TriangleRight },
  taut: { m: 5, a1: 80, a2: 80, icon: ChevronsLeftRight },
};

function signPhysics(m, a1, a2) {
  const mg = m * G;
  const s1 = Math.sin(rad(a1));
  const s2 = Math.sin(rad(a2));
  const c1 = Math.cos(rad(a1));
  const c2 = Math.cos(rad(a2));
  const s12 = Math.sin(rad(a1 + a2));
  // both ropes vertical: the split is not fixed by statics; by symmetry each takes half
  const T1 = s12 < 1e-9 ? mg / 2 : (mg * s2) / s12;
  const T2 = s12 < 1e-9 ? mg / 2 : (mg * s1) / s12;
  return { mg, s1, s2, c1, c2, s12, T1, T2, sum: T1 + T2, over: Math.max(T1, T2) > ROPE_MAX };
}

/* ==================================================================== sim */

export default function SignSim({ T }) {
  const L = T.sign;
  const dec = T.decimal;
  const [m, setM] = useState(5);
  const [a1, setA1] = useState(30);
  const [a2, setA2] = useState(30);
  const [touched, setTouched] = useState(false);
  const ph = signPhysics(m, a1, a2);
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].m === m && PRESETS[k].a1 === a1 && PRESETS[k].a2 === a2) ?? null;

  const change = (fn) => (v) => {
    fn(v);
    setTouched(true);
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setM(p.m);
    setA1(p.a1);
    setA2(p.a2);
    setTouched(true);
  };

  const F1 = (v) => fmt(v, 1, dec);
  let key;
  if (ph.over) key = 'over';
  else if (!touched && preset === 'sym30') key = 'intro';
  else if (a1 === 0 && a2 === 0) key = 'vertical';
  else if (a1 === 0 || a2 === 0) key = 'oneVertical';
  else if (a1 === a2 && a1 === 60) key = 'sixty';
  else if (a1 === a2) key = 'sym';
  else key = 'asym';
  const settled = useSettled(`${key}|${m}|${a1}|${a2}`, 220);
  const sKey = settled.split('|')[0];
  const ex = L.explain;
  const text = {
    intro: ex.intro(F1(ph.T1), F1(ph.mg), F1(ph.sum)),
    over: ex.over(F1(Math.max(ph.T1, ph.T2)), ROPE_MAX),
    vertical: ex.vertical(F1(ph.mg / 2)),
    oneVertical: ex.oneVertical(a1 === 0 ? 'T_{1}' : 'T_{2}', a1 === 0 ? 'T_{2}' : 'T_{1}', F1(ph.mg)),
    sixty: ex.sixty(F1(ph.T1)),
    sym: ex.sym(a1, F1(ph.T1), F1(ph.mg)),
    asym: ex.asym(a1 < a2 ? 'T_{1}' : 'T_{2}', F1(Math.max(ph.T1, ph.T2)), F1(Math.min(ph.T1, ph.T2))),
  }[sKey];
  const tone = { intro: '#22d3ee', over: '#f87171', vertical: '#34d399', oneVertical: '#fbbf24', sixty: '#34d399', sym: '#34d399', asym: '#a78bfa' }[sKey];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <GroupLabel>
          {L.presetsLabel} <span className="normal-case tracking-normal text-gray-500">· {L.presetsBase}</span>
        </GroupLabel>
        <Segmented
          label={L.presetsLabel}
          className="grid-cols-2 md:grid-cols-4"
          size="lg"
          value={preset}
          onChange={pick}
          options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
        />
      </div>

      <SceneRow renderScene={(fitH) => <SignScene T={T} m={m} a1={a1} a2={a2} ph={ph} fitH={fitH} />} method={<SignMethod T={T} ph={ph} />} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.T1} symbol={<Sym>{'T_{1}'}</Sym>} value={F1(ph.T1)} unit={T.N} accent={COL.T1} textColor={COL.T1Text} sub={<Sym>{L.readouts.Tsub(a1, '1')}</Sym>} active={ph.T1 > ROPE_MAX} />
        <Readout label={L.readouts.T2} symbol={<Sym>{'T_{2}'}</Sym>} value={F1(ph.T2)} unit={T.N} accent={COL.T2} textColor={COL.T2Text} sub={<Sym>{L.readouts.Tsub(a2, '2')}</Sym>} active={ph.T2 > ROPE_MAX} />
        <Readout label={L.readouts.mg} symbol="mg" value={F1(ph.mg)} unit={T.N} accent={COL.mg} textColor={COL.mgText} sub={L.readouts.mgSub(fmt(m, 1, dec))} />
        <Readout label={L.readouts.vec} symbol={<Sym>{'|T_{1}+T_{2}|'}</Sym>} value={F1(ph.mg)} unit={T.N} accent={COL.ok} textColor={COL.okText} sub={<Sym>{L.readouts.vecSub(F1(ph.sum))}</Sym>} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-2">
          <RangeField id="eq-m" label={L.m} symbol="m" min={1} max={10} step={0.5} value={m} onChange={change(setM)} accent={COL.mg} display={`${fmt(m, 1, dec)} ${T.kg}`} hint={L.mHint(F1(ph.mg))} />
          <RangeField id="eq-a1" label={L.a1} symbol="α₁" min={0} max={A_MAX} step={1} value={a1} onChange={change(setA1)} accent={COL.T1} display={`${a1}°`} />
          <RangeField id="eq-a2" label={L.a2} symbol="α₂" min={0} max={A_MAX} step={1} value={a2} onChange={change(setA2)} accent={COL.T2} display={`${a2}°`} />
          <p className="pt-1 text-xs leading-snug text-gray-500">{L.ropeNote(ROPE_MAX)}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <SignGraph T={T} m={m} a1={a1} a2={a2} ph={ph} onPick={(x) => {
            const v = clamp(Math.round(x), 0, A_MAX);
            setA1(v);
            setA2(v);
            setTouched(true);
          }} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function signView(W, H, narrow) {
  return makeView(BOX, W, H, narrow ? { l: 6, r: 6, t: 40, b: 6 } : { l: 12, r: 12, t: 58, b: 10 });
}

function forceK(view, ph) {
  return (0.5 * view.k) / Math.max(ph.T1, ph.T2, ph.mg, 1);
}

/** Where a rope from the ring (0, 0) along direction (ux, uy) meets the frame. */
function anchorOf(ux, uy) {
  const tTop = uy > 1e-9 ? H_CEIL / uy : Infinity;
  const tSide = Math.abs(ux) > 1e-9 ? (X_POST - 0.04) / Math.abs(ux) : Infinity;
  const t = Math.min(tTop, tSide);
  return { x: ux * t, y: uy * t, side: tSide < tTop };
}

function SignScene({ T, m, a1, a2, ph, fitH }) {
  const L = T.sign;
  const dec = T.decimal;
  return (
    <LabScene
      legend={[
        { color: COL.T1, label: L.legend.T1, kind: 'arrow' },
        { color: COL.T2, label: L.legend.T2, kind: 'arrow' },
        { color: COL.mg, label: L.legend.mg, kind: 'arrow' },
      ]}
      chips={(W, narrow, H) => <ForceScale kF={forceK(signView(W, H, narrow), ph)} label={T.scale} unit={T.N} decimal={dec} />}
      height={(W, narrow) => fitH ?? (narrow ? Math.max(270, W * 0.72) : 452)}
      ariaLabel={L.sceneLabel(fmt(m, 1, dec), a1, a2, fmt(ph.T1, 1, dec), fmt(ph.T2, 1, dec))}
    >
      {(W, H, narrow) => <SignDrawing T={T} W={W} H={H} narrow={narrow} a1={a1} a2={a2} ph={ph} />}
    </LabScene>
  );
}

function SignDrawing({ T, W, H, narrow, a1, a2, ph }) {
  const L = T.sign;
  const dec = T.decimal;
  const view = signView(W, H, narrow);
  const { k } = view;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12.5;
  const box = { w: W, h: H };
  const kF = forceK(view, ph);
  const ring = { x: X(0), y: Y(0) };
  const u1 = { x: -Math.sin(rad(a1)), y: Math.cos(rad(a1)) };
  const u2 = { x: Math.sin(rad(a2)), y: Math.cos(rad(a2)) };
  const A1 = anchorOf(u1.x, u1.y);
  const A2 = anchorOf(u2.x, u2.y);
  const signTop = -(0.03 + CORD);
  const signC = signTop - SIGN_H / 2;
  const ropeCol = (T_) => (T_ > ROPE_MAX ? '#dc2626' : COL.rope);

  const hook = (A) => (
    <g>
      <circle cx={X(A.x)} cy={Y(A.y)} r={Math.max(3, 0.018 * k)} fill="#f8fafc" stroke="#334155" strokeWidth="1.6" />
    </g>
  );

  return (
    <g>
      <PaperGrid view={view} W={W} H={H} step={narrow ? 0.2 : 0.1} />

      {/* the frame */}
      <rect x={X(-X_POST - 0.04)} y={Y(H_CEIL + 0.07)} width={(2 * X_POST + 0.08) * k} height={0.07 * k} fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
      {[-1, 1].map((s) => (
        <rect key={s} x={X(s * X_POST) - (s > 0 ? 0 : 0.04 * k)} y={Y(H_CEIL)} width={0.04 * k} height={(H_CEIL - BOX.y0 + 0.1) * k} fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
      ))}

      {/* vertical through the ring */}
      <line x1={ring.x} x2={ring.x} y1={Y(0.42)} y2={ring.y} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 4" />

      {/* ropes */}
      <line x1={ring.x} y1={ring.y} x2={X(A1.x)} y2={Y(A1.y)} stroke={ropeCol(ph.T1)} strokeWidth={narrow ? 2 : 2.6} />
      <line x1={ring.x} y1={ring.y} x2={X(A2.x)} y2={Y(A2.y)} stroke={ropeCol(ph.T2)} strokeWidth={narrow ? 2 : 2.6} />
      {hook(A1)}
      {hook(A2)}

      {/* the cord and the sign */}
      <line x1={ring.x} y1={ring.y} x2={ring.x} y2={Y(signTop)} stroke={COL.rope} strokeWidth="2" />
      <rect x={X(-SIGN_W / 2)} y={Y(signTop)} width={SIGN_W * k} height={SIGN_H * k} rx={0.03 * k} fill="#fef3c7" stroke="#92400e" strokeWidth="2" />
      <rect x={X(-SIGN_W / 2 + 0.03)} y={Y(signTop - 0.03)} width={(SIGN_W - 0.06) * k} height={(SIGN_H - 0.06) * k} rx={0.02 * k} fill="none" stroke="#d97706" strokeWidth="1.2" />
      <text x={X(0)} y={Y(signTop - 0.135)} textAnchor="middle" fontSize={Math.max(9, 0.11 * k)} fontWeight="800" letterSpacing="0.1em" fill="#92400e">
        {L.signText}
      </text>
      <circle cx={ring.x} cy={Y(signTop)} r={Math.max(2, 0.012 * k)} fill="#0f172a" />

      {/* angles at the ring */}
      {a1 > 0 && <AngleArc cx={ring.x} cy={ring.y} r={narrow ? 22 : 34} from={-Math.PI / 2} to={-Math.PI / 2 - rad(a1)} label="α_{1}" color={COL.T1} fs={fs} labelR={narrow ? 33 : 48} />}
      {a2 > 0 && <AngleArc cx={ring.x} cy={ring.y} r={narrow ? 22 : 34} from={-Math.PI / 2} to={-Math.PI / 2 + rad(a2)} label="α_{2}" color={COL.T2} fs={fs} labelR={narrow ? 33 : 48} />}

      {/* forces */}
      <ForceArrow x={ring.x} y={ring.y} dx={u1.x * ph.T1 * kF} dy={-u1.y * ph.T1 * kF} color={COL.T1} label="T_{1}" value={`${fmt(ph.T1, 1, dec)} ${T.N}`} fs={fs} box={box} />
      <ForceArrow x={ring.x} y={ring.y} dx={u2.x * ph.T2 * kF} dy={-u2.y * ph.T2 * kF} color={COL.T2} label="T_{2}" value={`${fmt(ph.T2, 1, dec)} ${T.N}`} fs={fs} box={box} />
      <ForceArrow
        x={X(0)}
        y={Y(signC)}
        dx={0}
        dy={ph.mg * kF}
        color={COL.mg}
        label="mg"
        value={`${fmt(ph.mg, 1, dec)} ${T.N}`}
        fs={fs}
        box={box}
        labelAt={{ x: X(0) + 9, y: Math.max(Y(signC) + ph.mg * kF + 2, Y(signTop - SIGN_H) + fs + 4), anchor: 'start' }}
      />
      <circle cx={X(0)} cy={Y(signC)} r={3.5} fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx={ring.x} cy={ring.y} r={Math.max(4, 0.026 * k)} fill="#f8fafc" stroke="#0f172a" strokeWidth="2.2" />

      {ph.over && <Pill x={X(0)} y={Y(0.36)} text={L.overTag(ROPE_MAX)} bg="#dc2626" size={fs - 0.5} box={box} />}
    </g>
  );
}

/* =========================================================== the method */

function SignFbd({ T, ph }) {
  const L = T.sign;
  return (
    <FbdPaper title={L.fbd.title} height={236} ariaLabel={L.fbd.label}>
      {(W, H) => {
        const fs = 11;
        const left = { x: W * 0.3, y: H * 0.5 };
        const Lm = Math.min(W * 0.2, H * 0.34);
        const kF = Lm / Math.max(ph.T1, ph.T2, ph.mg, 1);
        const box = { w: W, h: H };
        const v1 = { x: -ph.s1 * ph.T1 * kF, y: -ph.c1 * ph.T1 * kF };
        const v2 = { x: ph.s2 * ph.T2 * kF, y: -ph.c2 * ph.T2 * kF };
        const vg = { x: 0, y: ph.mg * kF };
        /* the triangle: T₁ then T₂ then mg, head to tail, back to the start — centred in the right half */
        const q1 = v1;
        const q2 = { x: v1.x + v2.x, y: v1.y + v2.y };
        const bx0 = Math.min(0, q1.x, q2.x);
        const bx1 = Math.max(0, q1.x, q2.x);
        const by0 = Math.min(0, q1.y, q2.y);
        const by1 = Math.max(0, q1.y, q2.y);
        const t0 = { x: W * 0.74 - (bx0 + bx1) / 2, y: H * 0.56 - (by0 + by1) / 2 };
        const t1 = { x: t0.x + q1.x, y: t0.y + q1.y };
        const t2 = { x: t0.x + q2.x, y: t0.y + q2.y };
        return (
          <>
            <FbdAxis x={left.x} y={left.y} ux={1} uy={0} len={Lm * 1.25} back={1.1} label="x" fs={fs} />
            <FbdAxis x={left.x} y={left.y} ux={0} uy={-1} len={Lm * 1.2} back={0.2} label="y" fs={fs} />
            <ForceArrow x={left.x} y={left.y} dx={v1.x} dy={v1.y} color={COL.T1} label="T_{1}" fs={fs + 0.5} box={box} width={2.6} head={9} />
            <ForceArrow x={left.x} y={left.y} dx={v2.x} dy={v2.y} color={COL.T2} label="T_{2}" fs={fs + 0.5} box={box} width={2.6} head={9} />
            <ForceArrow x={left.x} y={left.y} dx={vg.x} dy={vg.y} color={COL.mg} label="mg" fs={fs + 0.5} box={box} width={2.6} head={9} />
            <circle cx={left.x} cy={left.y} r={4} fill="#f8fafc" stroke="#0f172a" strokeWidth="1.8" />
            <text x={W * 0.74} y={22} textAnchor="middle" fontSize={fs} fontWeight="600" fill="#475569">
              {L.fbd.triangle}
            </text>
            <ForceArrow x={t0.x} y={t0.y} dx={v1.x} dy={v1.y} color={COL.T1} width={2.4} head={8} />
            <ForceArrow x={t1.x} y={t1.y} dx={v2.x} dy={v2.y} color={COL.T2} width={2.4} head={8} />
            <ForceArrow x={t2.x} y={t2.y} dx={vg.x} dy={vg.y} color={COL.mg} width={2.4} head={8} />
            <circle cx={t0.x} cy={t0.y} r={3} fill="#0f172a" />
            <text x={t0.x + 8} y={t0.y + 14} fontSize={fs - 0.5} fill="#059669" fontWeight="700">
              {`ΣF = 0`}
            </text>
            <text x={W - 8} y={H - 8} textAnchor="end" fontSize={fs - 1.5} fill="#94a3b8">
              {L.fbd.closed}
            </text>
          </>
        );
      }}
    </FbdPaper>
  );
}

function SignMethod({ T, ph }) {
  const L = T.sign;
  const M = L.method;
  const dec = T.decimal;
  const F1 = (v) => fmt(v, 1, dec);
  const f3 = (v) => fmt(v, 3, dec);
  return (
    <MethodPanel badge="ΣF = 0" title={M.title} top={<SignFbd T={T} ph={ph} />}>
      <Step n={1} title={M.s1}>
        <ForceChips
          items={[
            { sym: 'T_{1}', color: COL.T1, text: COL.T1Text },
            { sym: 'T_{2}', color: COL.T2, text: COL.T2Text },
            { sym: 'mg', color: COL.mg, text: COL.mgText },
          ]}
        />
      </Step>
      <Step n={2} title={M.s2}>
        <Eq tag="Ox" sym="T_{2}·sinα_{2} − T_{1}·sinα_{1} = 0" nums={`${F1(ph.T2)}·${f3(ph.s2)} − ${F1(ph.T1)}·${f3(ph.s1)} = 0`} />
        <Eq tag="Oy" sym="T_{1}·cosα_{1} + T_{2}·cosα_{2} − mg = 0" nums={`${F1(ph.T1)}·${f3(ph.c1)} + ${F1(ph.T2)}·${f3(ph.c2)} − ${F1(ph.mg)} = 0`} />
      </Step>
      <Step n={3} title={M.s3}>
        {ph.s12 < 1e-9 ? (
          <p className="mt-0.5">
            <Sym>{M.vertical(F1(ph.mg / 2))}</Sym>
          </p>
        ) : (
          <>
            <Eq sym="T_{1} = mg·sinα_{2} / sin(α_{1}+α_{2})" nums={`= ${F1(ph.mg)}·${f3(ph.s2)} / ${f3(ph.s12)} =`} result={`${F1(ph.T1)} ${T.N}`} resultColor={COL.T1Text} />
            <Eq sym="T_{2} = mg·sinα_{1} / sin(α_{1}+α_{2})" nums={`= ${F1(ph.mg)}·${f3(ph.s1)} / ${f3(ph.s12)} =`} result={`${F1(ph.T2)} ${T.N}`} resultColor={COL.T2Text} />
          </>
        )}
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function SignGraph({ T, m, a1, a2, ph, onPick }) {
  const L = T.sign;
  const dec = T.decimal;
  const pts = [];
  for (let x = 0; x <= A_MAX; x += 1) pts.push({ x, y: ph.mg / (2 * Math.cos(rad(x))) });
  const yMax = Math.max(160, Math.ceil(pts[pts.length - 1].y / 40) * 40);
  const sym = a1 === a2;
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 't', label: L.graph.t, color: '#67e8f9', points: pts, dot: false },
        { id: 'lim', label: L.graph.lim(ROPE_MAX), color: '#f87171', points: [{ x: 0, y: ROPE_MAX }, { x: A_MAX, y: ROPE_MAX }], dot: false, dash: '6 5' },
        { id: 'mg', label: L.graph.mg, color: '#fca5a5', points: [{ x: 0, y: ph.mg }, { x: A_MAX, y: ph.mg }], dot: false, dash: '2 4' },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: sym ? [{ x: a1, y: ph.T1 }] : [] },
      ]}
      xMax={A_MAX}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={sym ? a1 : undefined}
      decimal={dec}
      height={286}
      ariaLabel={L.graph.label(fmt(m, 1, dec))}
      onScrub={onPick}
      note={sym ? L.graph.note : L.graph.noteAsym}
    />
  );
}
