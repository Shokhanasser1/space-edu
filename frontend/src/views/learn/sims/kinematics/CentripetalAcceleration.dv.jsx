import { useState } from 'react';
import { Bike, CarFront, FerrisWheel, Lightbulb } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import { Panel, PlayButtons, RichPill, SimScene, Tag, Toolbar, arcD, num, richSvg } from './CentripetalAcceleration.parts';

/**
 * Why the acceleration of uniform circular motion points at the centre.
 * Two positions A and B a time Δt apart; the velocities there have the same
 * size v but differ in direction by Δφ = ωΔt = vΔt/R. Put tail to tail they
 * give |Δv| = 2v·sin(Δφ/2), and Δv points along the radius through the
 * middle of the arc. The average acceleration |Δv|/Δt tends to v²/R as
 * Δt → 0 - the lesson's car (10 m/s on a 50 m bend, a = 2 m/s²) is preset 1.
 */

const PRESETS = [
  { id: 'car', icon: CarFront, v: 10, R: 50, dt: 2 },
  { id: 'track', icon: Bike, v: 15, R: 25, dt: 1 },
  { id: 'carousel', icon: FerrisWheel, v: 3, R: 3, dt: 1 },
];
const BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
const NICE = [0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 2.4, 3.2, 4];
const C = { ...PALETTE, vB: '#10b981', dv: '#ea580c', ghost: '#fb923c' };

/** Largest "nice" number not above x. */
function niceFloor(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  let best = 0.4 * p;
  for (const m of NICE) if (m * p <= x + 1e-9) best = m * p;
  for (const m of NICE) if (m * p * 10 <= x + 1e-9) best = Math.max(best, m * p * 10);
  return best;
}
/** Smallest "nice" number not below x. */
function niceCeil(x) {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [...NICE.map((n) => n * p), ...NICE.map((n) => n * p * 10)]) if (m >= x - 1e-9) return m;
  return 10 * p;
}
function decimalsFor(step) {
  for (let d = 0; d <= 4; d += 1) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  return 4;
}

function limits(v, R) {
  const maxDt = niceFloor((0.8 * Math.PI * R) / v); // Δφ ≤ 144°
  return { maxDt, minDt: maxDt / 400 };
}

export default function DeltaVSim({ T }) {
  const tx = T.dv;
  const dec = T.decimal;
  const [presetId, setPresetId] = useState('car');
  const preset = BY_ID[presetId];
  const [v, setV] = useState(preset.v);
  const [R, setR] = useState(preset.R);
  const [dt, setDt] = useState(preset.dt);
  const [shrinking, setShrinking] = useState(false);
  const { maxDt, minDt } = limits(v, R);
  const dtc = clamp(dt, minDt, maxDt);

  useRafLoop(shrinking, (f) => {
    const n = Math.max(minDt, dtc * Math.exp(-1.15 * f));
    setDt(n);
    if (n <= minDt * 1.0001) setShrinking(false);
  });

  const pick = (id) => {
    const p = BY_ID[id];
    setPresetId(id);
    setV(p.v);
    setR(p.R);
    setDt(p.dt);
    setShrinking(false);
  };
  const toggle = () => {
    if (shrinking) {
      setShrinking(false);
      return;
    }
    if (dtc <= minDt * 1.01) setDt(maxDt);
    setShrinking(true);
  };
  const reset = () => {
    setShrinking(false);
    setDt(preset.dt);
  };

  /* ---- physics */
  const omega = v / R;
  const dphi = omega * dtc; // rad
  const dv = 2 * v * Math.sin(dphi / 2);
  const aAvg = dv / dtc;
  const aC = (v * v) / R;
  const diff = 1 - aAvg / aC;
  const deg = (dphi * 180) / Math.PI;

  let key = 'mid';
  if (diff > 0.03) key = 'big';
  else if (diff <= 0.002) key = 'small';
  const settled = useSettled(key, 250);
  const ex = tx.explain;
  const text = {
    big: ex.big(num(dtc, dec), fmt(deg, 1, dec), num(aAvg, dec), num(aC, dec)),
    mid: ex.mid(num(aAvg, dec, 4), num(aC, dec, 4)),
    small: ex.small(num(aC, dec)),
  }[settled];
  const tone = { big: '#fb923c', mid: '#facc15', small: '#34d399' }[settled];

  /* ---- slider in log scale */
  const span = Math.log(maxDt / minDt);
  const u = Math.log(dtc / minDt) / span;

  /* ---- graph */
  const yMax = niceCeil(aC * 1.12);
  const yDigits = decimalsFor(yMax / 4);
  const xDigits = decimalsFor(maxDt / 4);
  const curve = [];
  for (let i = 0; i <= 120; i += 1) {
    const x = minDt + (i / 120) * (maxDt - minDt);
    const p = (v * x) / R;
    curve.push({ x, y: (2 * v * Math.sin(p / 2)) / x });
  }

  const legend = [
    { label: tx.legend.path, color: C.path, kind: 'line' },
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.dv, kind: 'arrow' },
    { label: tx.legend.limit, color: C.ghost, kind: 'dash' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={presetId}
        onChange={pick}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons
          common={T.common}
          running={shrinking}
          started={Math.abs(dtc - preset.dt) > 1e-6}
          onToggle={toggle}
          onReset={reset}
          playLabel={tx.shrink}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        ariaLabel={tx.sceneLabel(num(dtc, dec), fmt(deg, 1, dec), num(aAvg, dec))}
        height={(W, narrow) => (narrow ? W * 1.7 : clamp(W * 0.45, 450, 520))}
      >
        {(W, H, narrow) => <DvDrawing W={W} H={H} narrow={narrow} dphi={dphi} dv={dv} v={v} aAvg={aAvg} aC={aC} tx={tx} dec={dec} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.phi} symbol="Δφ" value={fmt(deg, deg < 10 ? 2 : 1, dec)} unit="°" accent="#0891b2" textColor="#a5f3fc" sub={tx.readouts.phiSub(num(dphi, dec))} />
        <Readout label={tx.readouts.dv} symbol="|Δv|" value={num(dv, dec)} unit={T.ms} accent={C.dv} textColor={C.accText} sub={tx.readouts.dvSub} />
        <Readout label={tx.readouts.avg} symbol="Δv/Δt" value={num(aAvg, dec, 4)} unit={T.ms2} accent={C.dv} textColor={C.accText} sub={tx.readouts.avgSub} />
        <Readout
          label={tx.readouts.limit}
          symbol="v²/R"
          value={num(aC, dec, 4)}
          unit={T.ms2}
          accent={C.ghost}
          textColor="#fed7aa"
          sub={tx.readouts.limitSub(fmt(diff * 100, diff < 0.01 ? 2 : 1, dec))}
          active={settled === 'small'}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="dv-dt"
            label={tx.dt}
            symbol="Δt"
            min={0}
            max={1}
            step={0.001}
            value={u}
            onChange={(x) => {
              setShrinking(false);
              setDt(minDt * Math.exp(x * span));
            }}
            accent="#22d3ee"
            display={`${num(dtc, dec)} ${T.s}`}
            hint={tx.dtHint(fmt(deg, 1, dec))}
          />
          <RangeField
            id="dv-v"
            label={tx.v}
            symbol="v"
            min={2}
            max={20}
            step={0.5}
            value={v}
            onChange={(x) => {
              setShrinking(false);
              setV(x);
            }}
            accent={C.vel}
            display={`${fmt(v, 1, dec)} ${T.ms}`}
          />
          <RangeField
            id="dv-r"
            label={tx.R}
            symbol="R"
            min={2}
            max={100}
            step={1}
            value={R}
            onChange={(x) => {
              setShrinking(false);
              setR(x);
            }}
            accent="#a78bfa"
            display={`${fmt(R, 0, dec)} ${T.m}`}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <TimeGraph
            title={tx.graph.title}
            series={[
              { id: 'avg', label: tx.graph.series, color: '#fb923c', points: curve, dot: false },
              { id: 'lim', label: tx.graph.limit, color: '#fde68a', points: [{ x: 0, y: aC }, { x: maxDt, y: aC }], dash: '6 5', dot: false },
              { id: 'now', label: `Δt = ${num(dtc, dec)} ${T.s}`, color: '#22d3ee', points: [{ x: dtc, y: aAvg }] },
            ]}
            xMax={maxDt}
            yMax={yMax}
            xLabel={tx.graph.x}
            yLabel={tx.graph.y}
            marker={dtc}
            decimal={dec}
            xDigits={xDigits}
            yDigits={yDigits}
            onScrub={(x) => {
              setShrinking(false);
              setDt(clamp(x, minDt, maxDt));
            }}
            note={tx.graph.note}
          />
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function DvDrawing({ W, H, narrow, dphi, dv, v, aAvg, aC, tx, dec }) {
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const h = dphi / 2;

  /* circle region */
  const Lw = narrow ? W : W * 0.58;
  const Hc = narrow ? W * 1.02 : H;
  const top = narrow ? 70 : 100;
  const Rpx = Math.max(60, Math.min(Lw / 2 - (narrow ? 30 : 60), (Hc - top - (narrow ? 20 : 34)) / 2));
  const cx = Lw / 2 + (narrow ? 0 : 10);
  const cy = top + Rpx + 6;
  const P = (ang) => ({ x: cx + Rpx * Math.cos(ang), y: cy - Rpx * Math.sin(ang) });
  const aA = Math.PI / 2 + h;
  const aB = Math.PI / 2 - h;
  const A = P(aA);
  const B = P(aB);
  const M = P(Math.PI / 2);
  // clockwise motion: velocity at world angle θ is (sin θ, −cos θ); on screen (sin θ, cos θ)
  const vDir = (ang) => ({ x: Math.sin(ang), y: Math.cos(ang) });
  const Lv = Rpx * 0.5;
  const dA = vDir(aA);
  const dB = vDir(aB);
  const Lc = Rpx * 0.55;
  const La = Lc * (aAvg / aC);
  const arcR = Math.max(18, Math.min(Rpx * 0.2, 40));
  const close = Math.hypot(A.x - B.x, A.y - B.y) < 30;

  /* triangle inset */
  const ix0 = narrow ? 12 : Lw + 4;
  const iy0 = narrow ? Hc + 4 : 64;
  const iw = narrow ? W - 24 : W - Lw - 20;
  const ih = narrow ? H - Hc - 16 : H - iy0 - 18;
  const Q = { x: ix0 + (narrow ? 26 : 34), y: iy0 + ih * 0.47 };
  const Lt = Math.max(40, Math.min(iw - (narrow ? 70 : 90), h > 1e-6 ? (ih - 120) / (2 * Math.sin(h)) : 1e9));
  const tA = { x: Q.x + Lt * Math.cos(h), y: Q.y - Lt * Math.sin(h) };
  const tB = { x: Q.x + Lt * Math.cos(h), y: Q.y + Lt * Math.sin(h) };
  const qArc = Math.min(46, Lt * 0.3);
  const dvLen = tB.y - tA.y;
  const tiny = dvLen < 28;
  const mag = tiny && dvLen > 0.01 ? Math.round(46 / dvLen) : 1;
  const mx = tA.x - 14;
  const my = Q.y + 34;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      {/* faint grid in the circle region */}
      <g aria-hidden="true">
        {Array.from({ length: Math.ceil(W / 28) + 1 }, (_, i) => (
          <line key={`gx${i}`} x1={i * 28} x2={i * 28} y1={0} y2={H} stroke={C.grid} strokeWidth="1" />
        ))}
        {Array.from({ length: Math.ceil(H / 28) + 1 }, (_, i) => (
          <line key={`gy${i}`} x1={0} x2={W} y1={i * 28} y2={i * 28} stroke={C.grid} strokeWidth="1" />
        ))}
      </g>

      {/* trajectory and the path covered in Δt */}
      <circle cx={cx} cy={cy} r={Rpx} fill="#f8fafc" fillOpacity="0.7" stroke={C.path} strokeOpacity="0.6" strokeWidth="2" strokeDasharray="6 6" />
      <path d={arcD(cx, cy, Rpx, aA, aB)} fill="none" stroke={C.path} strokeWidth="4.5" strokeLinecap="round" />

      {/* radii and the angle between them */}
      <line x1={cx} y1={cy} x2={A.x} y2={A.y} stroke="#94a3b8" strokeWidth="1.4" />
      <line x1={cx} y1={cy} x2={B.x} y2={B.y} stroke="#94a3b8" strokeWidth="1.4" />
      <line x1={cx} y1={cy} x2={M.x} y2={M.y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 4" />
      <path d={arcD(cx, cy, arcR, aB, aA)} fill="none" stroke="#0891b2" strokeWidth="2.2" />
      <RichPill x={cx + (narrow ? 50 : 60)} y={cy - 6} text={tx.phiTag(fmt((dphi * 180) / Math.PI, dphi < 0.1745 ? 2 : 1, dec))} bg="#fff" color="#0e7490" border="#a5f3fc" size={fs} box={box} />
      <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={C.ink} strokeWidth="2.2" />
      <Tag x={cx} y={cy + 22} text={tx.O} color={C.ink} size={fs + 1} italic={false} />

      {/* average acceleration at the middle of the arc, and its limit */}
      <Arrow x1={M.x} y1={M.y + 2} x2={M.x} y2={M.y + 2 + Lc} color={C.ghost} width={2} head={11} opacity={0.45} dash="5 4" />
      <Arrow x1={M.x} y1={M.y + 2} x2={M.x} y2={M.y + 2 + La} color={C.dv} width={3.5} head={narrow ? 11 : 13} />
      <RichPill x={M.x - (narrow ? 64 : 84)} y={M.y + 2 + La * 0.6} text={tx.aTag(num(aAvg, dec))} bg={C.dv} size={fs} box={box} />
      <RichPill x={M.x + (narrow ? 50 : 58)} y={M.y + 2 + Lc} text={tx.limitTag(num(aC, dec))} bg="#fff" color="#c2410c" border="#fdba74" size={fs - 1} box={box} />

      {/* velocities at A and B */}
      <Arrow x1={B.x} y1={B.y} x2={B.x + dB.x * Lv} y2={B.y + dB.y * Lv} color={C.vB} width={3.2} head={12} />
      <Arrow x1={A.x} y1={A.y} x2={A.x + dA.x * Lv} y2={A.y + dA.y * Lv} color={C.vel} width={3.2} head={12} />
      <Tag x={A.x + dA.x * Lv - 2} y={A.y + dA.y * Lv - 10} text="v_A" color={C.vel} size={fs + 2} anchor="end" />
      <Tag x={B.x + dB.x * Lv + 6} y={B.y + dB.y * Lv + 16} text="v_B" color="#047857" size={fs + 2} anchor="start" />

      {/* points */}
      <circle cx={A.x} cy={A.y} r={6} fill={C.ink} stroke="#fff" strokeWidth="2" />
      <circle cx={B.x} cy={B.y} r={6} fill={C.ink} stroke="#fff" strokeWidth="2" />
      <Tag x={A.x - 8 - (close ? 10 : 0)} y={A.y + 24} text={`${tx.A} (${tx.tA})`} color={C.ink} size={fs} italic={false} anchor="end" />
      <Tag x={B.x + 8 + (close ? 10 : 0)} y={B.y + 24} text={`${tx.B} (${tx.tB})`} color={C.ink} size={fs} italic={false} anchor="start" />

      {/* velocity triangle */}
      <rect x={ix0} y={iy0} width={iw} height={ih} rx="14" fill="#ffffff" stroke="#e2e8f0" />
      <text x={ix0 + 14} y={iy0 + 22} fontSize={fs + 1} fontWeight="700" fill={C.ink}>
        {tx.triangle}
      </text>
      <text x={ix0 + 14} y={iy0 + 40} fontSize={fs - 1} fill={C.muted}>
        {richSvg(tx.triangleNote, fs - 1)}
      </text>
      <path d={arcD(Q.x, Q.y, qArc, -h, h)} fill="none" stroke="#0891b2" strokeWidth="2" />
      {h > 0.06 && <Tag x={Q.x + qArc + 12} y={Q.y + 4} text="Δφ" color="#0e7490" size={fs} anchor="start" />}
      <Arrow x1={Q.x} y1={Q.y} x2={tB.x} y2={tB.y} color={C.vB} width={3.2} head={13} />
      <Arrow x1={Q.x} y1={Q.y} x2={tA.x} y2={tA.y} color={C.vel} width={3.2} head={13} />
      <Arrow x1={tA.x} y1={tA.y} x2={tB.x} y2={tB.y} color={C.dv} width={3.2} head={Math.min(13, Math.max(6, (tB.y - tA.y) * 0.6))} />
      <circle cx={Q.x} cy={Q.y} r={3.5} fill={C.ink} />
      <Tag x={tA.x - 8} y={tA.y - 10} text="v_A" color={C.vel} size={fs + 2} anchor="end" />
      <Tag x={tB.x - 8} y={tB.y + 20} text="v_B" color="#047857" size={fs + 2} anchor="end" />
      {!tiny && <Tag x={tA.x + 12} y={(tA.y + tB.y) / 2 + 5} text="Δv" color={C.dv} size={fs + 2} anchor="start" />}
      {tiny && (
        <g>
          <circle cx={tA.x} cy={Q.y} r={15} fill="none" stroke={C.dv} strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1={tA.x} y1={Q.y + 15} x2={mx} y2={my - 2} stroke={C.dv} strokeWidth="1" strokeDasharray="2 3" />
          <line x1={mx - 34} y1={my} x2={mx + 12} y2={my} stroke={C.vel} strokeWidth="2" />
          <path d={`M${mx - 9},${my} L${mx - 9},${my + 9} L${mx},${my + 9}`} fill="none" stroke={C.ink} strokeWidth="1.2" />
          <Arrow x1={mx} y1={my} x2={mx} y2={my + 46} color={C.dv} width={3} head={11} />
          <Tag x={mx - 14} y={my + 34} text={`Δv ×${mag}`} color={C.dv} size={fs + 1} anchor="end" />
        </g>
      )}
      <text x={ix0 + 14} y={iy0 + ih - 34} fontSize={fs} fill="#047857" fontWeight="600">
        {richSvg(tx.same(num(v, dec)), fs)}
      </text>
      <text x={ix0 + 14} y={iy0 + ih - 14} fontSize={fs} fill="#c2410c" fontWeight="600">
        {tx.dvLine(num(dv, dec))}
      </text>
    </g>
  );
}
