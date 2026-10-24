import { useEffect, useState } from 'react';
import { Lightbulb, Timer } from 'lucide-react';
import { Arrow, Explain, Pill, RangeField, Readout, clamp, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, PALETTE, makeView } from '../kit/scene';
import { Calc, Panel, PlayButtons, SimScene, TAU, Tag, TimeChip, Toolbar, arcD, num } from './CentripetalAcceleration.parts';

/**
 * A point on a merry-go-round seen from above. The reader sets the radius R
 * and either the period T or the frequency n; the scene shows the velocity
 * (tangent) and the centripetal acceleration (to the centre) and a stopwatch
 * counts whole turns so that T = t/N can be read off. Real time.
 *
 *   n = 1/T,  ω = 2π/T = 2πn,  v = ωR = 2πR/T,  a = v²/R = ω²R
 */

const PLATFORM = 5.3; // m, radius of the turning platform
const BOX = { x0: -6, x1: 6, y0: -6, y1: 6 };
const IDLE = { running: false, phi: 0, t: 0, tw: 0 };
const C = { ...PALETTE, accent: '#fb923c' };

export default function DiscSim({ T }) {
  const tx = T.disc;
  const dec = T.decimal;
  const [mode, setMode] = useState('T');
  const [R, setR] = useState(3);
  const [period, setPeriod] = useState(6);
  const [sim, setSim] = useState(IDLE);
  const [hint, setHint] = useState(null);

  useEffect(() => {
    if (!hint) return undefined;
    const id = setTimeout(() => setHint(null), 5500);
    return () => clearTimeout(id);
  }, [hint]);

  const omega = TAU / period;
  const nu = 1 / period;
  const v = omega * R;
  const a = omega * omega * R;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? { ...p, phi: p.phi + omega * dt, t: p.t + dt, tw: p.tw + dt } : p));
  });

  const N = Math.floor(sim.tw / period + 1e-9);
  const started = sim.t > 0;
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => setSim(IDLE);
  const pushHint = (key) => setHint((h) => ({ key, id: (h?.id ?? 0) + 1 }));
  const changeR = (r) => {
    setR(r);
    pushHint('R');
  };
  const changePeriod = (p) => {
    if (Math.abs(p - period) < 1e-9) return;
    pushHint(p < period ? 'faster' : 'slower');
    setPeriod(p);
    // the stopwatch measures the new period from now on
    setSim((s) => ({ ...s, tw: 0 }));
  };

  /* ---- explanation */
  let key = 'idle';
  if (hint) key = hint.key;
  else if (started) key = N >= 1 && sim.tw - N * period < 2.4 ? 'turn' : 'run';
  const settled = useSettled(key, key === 'turn' || key === 'idle' ? 0 : 250);
  const F1 = (n) => fmt(n, 1, dec);
  const ex = tx.explain;
  const text = {
    idle: ex.idle,
    run: ex.run(F1(period), num(nu, dec, 2)),
    turn: ex.turn(Math.max(N, 1), F1(Math.max(N, 1) * period), F1(period)),
    R: ex.R(F1(R), num(v, dec), num(a, dec)),
    faster: ex.faster(F1(period), num(a, dec)),
    slower: ex.slower(F1(period), num(a, dec)),
  }[settled];
  const tone = { idle: '#22d3ee', run: '#22d3ee', turn: '#34d399', R: '#a78bfa', faster: C.accent, slower: C.accent }[settled];

  const rpm = nu * 60;
  const calcRows =
    mode === 'T'
      ? [{ sym: 'n', color: '#a5f3fc', formula: '1/T', subst: `1 / ${F1(period)} ${T.s}`, result: `${num(nu, dec)} ${T.hz}` }]
      : [{ sym: 'T', color: '#a5f3fc', formula: '1/n', subst: `1 / ${num(nu, dec)} ${T.hz}`, result: `${F1(period)} ${T.s}` }];
  calcRows.push(
    mode === 'T'
      ? { sym: 'ω', color: '#fde68a', formula: '2π/T', subst: `2 · ${fmt(3.14, 2, dec)} / ${F1(period)} ${T.s}`, result: `${num(omega, dec)} ${T.rads}` }
      : { sym: 'ω', color: '#fde68a', formula: '2πn', subst: `2 · ${fmt(3.14, 2, dec)} · ${num(nu, dec)} ${T.hz}`, result: `${num(omega, dec)} ${T.rads}` },
    { sym: 'v', color: C.velText, formula: 'ωR', subst: `${num(omega, dec)} ${T.rads} · ${F1(R)} ${T.m}`, result: `${num(v, dec)} ${T.ms}` },
    { sym: 'a', color: C.accText, formula: 'v²/R', subst: `(${num(v, dec)} ${T.ms})² / ${F1(R)} ${T.m}`, result: `${num(a, dec)} ${T.ms2}` },
    { sym: 'a', color: C.accText, formula: 'ω²R', subst: `(${num(omega, dec)} ${T.rads})² · ${F1(R)} ${T.m}`, result: `${num(a, dec)} ${T.ms2}` },
  );

  const legend = [
    { label: tx.legend.path, color: C.path, kind: 'dash' },
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.acc, kind: 'arrow' },
    { label: tx.legend.phi, color: '#0891b2', kind: 'line' },
  ];

  const watch = (
    <div className="space-y-0.5 tabular-nums">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif italic">t</span>
        <span className="font-semibold">
          {F1(sim.tw)} {T.s}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span>
          {tx.watch.turns} <span className="font-serif italic">N</span>
        </span>
        <span className="font-semibold">{N}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.givenLabel}
        value={mode}
        onChange={setMode}
        cols="grid-cols-2"
        options={[
          { value: 'T', label: tx.given.T.name, sub: tx.given.T.sub },
          { value: 'nu', label: tx.given.nu.name, sub: tx.given.nu.sub },
        ]}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.realTime} extra={T.common.cell(`1 ${T.m}`)} />}
        ariaLabel={tx.sceneLabel(F1(R), F1(period), num(v, dec), num(a, dec))}
        height={(W, narrow) => (narrow ? W * 0.98 : clamp(W * 0.42, 420, 500))}
        overlay={
          <div className="pointer-events-none absolute bottom-3 right-3 hidden w-[232px] rounded-xl border border-slate-200 bg-white/95 p-3 text-[13px] text-slate-700 shadow-sm md:block">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              <Timer size={14} className="text-cyan-600" aria-hidden="true" /> {tx.watch.title}
            </p>
            <StopwatchFace t={sim.tw} />
            {watch}
            <p className="clear-both mt-1 border-t border-slate-200 pt-1 text-[12px] font-semibold text-cyan-700 tabular-nums">
              {N >= 1 ? tx.watch.measured(F1(N * period), N, F1(period)) : tx.watch.wait}
            </p>
          </div>
        }
      >
        {(W, H, narrow) => (
          <DiscDrawing W={W} H={H} narrow={narrow} R={R} phi={sim.phi} v={v} a={a} running={sim.running} tx={tx} dec={dec} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.T} symbol="T" value={F1(period)} unit={T.s} accent={C.time} textColor="#a5f3fc" sub={tx.readouts.nuSub(num(nu, dec), num(rpm, dec))} />
        <Readout label={tx.readouts.omega} symbol="ω" value={num(omega, dec)} unit={T.rads} accent="#facc15" textColor="#fde68a" sub={tx.readouts.omegaSub} />
        <Readout label={tx.readouts.v} symbol="v" value={num(v, dec)} unit={T.ms} accent={C.vel} textColor={C.velText} sub={tx.readouts.vSub(num(v * 3.6, dec))} />
        <Readout label={tx.readouts.a} symbol="a" value={num(a, dec)} unit={T.ms2} accent={C.acc} textColor={C.accText} sub={tx.readouts.aSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          {mode === 'T' ? (
            <RangeField
              id="cen-period"
              label={tx.T}
              symbol="T"
              min={2}
              max={12}
              step={0.5}
              value={period}
              onChange={changePeriod}
              accent="#22d3ee"
              display={`${F1(period)} ${T.s}`}
              hint={tx.tHint(num(rpm, dec))}
            />
          ) : (
            <RangeField
              id="cen-nu"
              label={tx.nu}
              symbol="n"
              min={0.08}
              max={0.5}
              step={0.01}
              value={Math.round(nu * 100) / 100}
              onChange={(n) => changePeriod(1 / n)}
              accent="#22d3ee"
              display={`${fmt(nu, 2, dec)} ${T.hz}`}
              hint={tx.tHint(num(rpm, dec))}
            />
          )}
          <RangeField
            id="cen-radius"
            label={tx.R}
            symbol="R"
            min={0.5}
            max={5}
            step={0.1}
            value={R}
            onChange={changeR}
            accent="#a78bfa"
            display={`${F1(R)} ${T.m}`}
            hint={tx.rHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-300">
            {tx.perTurn(fmt(TAU * R, 1, dec), F1(period))}
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm text-gray-200 md:hidden">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              <Timer size={13} aria-hidden="true" /> {tx.watch.title}
            </p>
            {watch}
            <p className="mt-1 text-[13px] font-semibold text-cyan-300 tabular-nums">{N >= 1 ? tx.watch.measured(F1(N * period), N, F1(period)) : tx.watch.wait}</p>
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <Calc title={tx.calc.title} rows={calcRows} note={tx.calc.note} />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function StopwatchFace({ t }) {
  const a = ((t % 60) / 60) * TAU;
  return (
    <svg width="64" height="64" viewBox="-32 -32 64 64" className="float-right -mt-1 ml-2" aria-hidden="true">
      <rect x="-4" y="-31" width="8" height="5" rx="1.5" fill="#94a3b8" />
      <circle r="25" fill="#fff" stroke="#0f172a" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const b = (i / 12) * TAU;
        return <line key={i} x1={Math.sin(b) * 19} y1={-Math.cos(b) * 19} x2={Math.sin(b) * 23} y2={-Math.cos(b) * 23} stroke="#64748b" strokeWidth={i % 3 ? 1 : 1.8} />;
      })}
      <line x1="0" y1="0" x2={Math.sin(a) * 20} y2={-Math.cos(a) * 20} stroke="#0891b2" strokeWidth="2" strokeLinecap="round" />
      <circle r="2.2" fill="#0f172a" />
    </svg>
  );
}

function DiscDrawing({ W, H, narrow, R, phi, v, a, running, tx, dec }) {
  const pad = narrow ? { l: 26, r: 12, t: 44, b: 26 } : { l: 40, r: 40, t: 60, b: 30 };
  const view = makeView(BOX, W, H, pad);
  const cx = view.sx(0);
  const cy = view.sy(0);
  const k = view.k;
  const Rd = PLATFORM * k;
  const Rp = R * k;
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const axisStep = k > 24 ? 2 : 5;
  const axisPx = axisStep * k * 0.99;

  // the turning platform
  const rot = (-phi * 180) / Math.PI;
  const sectors = [];
  const n = 12;
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    sectors.push(
      <path
        key={i}
        d={`M${cx},${cy} L${cx + Rd * Math.cos(a0)},${cy - Rd * Math.sin(a0)} A${Rd},${Rd} 0 0 0 ${cx + Rd * Math.cos(a1)},${cy - Rd * Math.sin(a1)} Z`}
        fill={i % 2 ? '#fef3c7' : '#e0f2fe'}
        stroke="#ffffff"
        strokeWidth="1.5"
      />,
    );
  }
  const seats = Array.from({ length: 6 }, (_, i) => {
    const b = (i / 6) * TAU + TAU / 24;
    return <circle key={i} cx={cx + (PLATFORM - 0.55) * k * Math.cos(b)} cy={cy - (PLATFORM - 0.55) * k * Math.sin(b)} r={Math.max(3, 0.22 * k)} fill="#cbd5e1" />;
  });

  // the point
  const px = cx + Rp * Math.cos(phi);
  const py = cy - Rp * Math.sin(phi);
  const tX = -Math.sin(phi); // screen tangent (counter-clockwise motion)
  const tY = -Math.cos(phi);
  const iX = -Math.cos(phi); // screen direction to the centre
  const iY = Math.sin(phi);
  const rP = narrow ? 8 : 9;
  const Lv = Math.min(v * (Rd / 8), 1.45 * Rd);
  const LaFull = a * (Rd / 14);
  const La = Math.min(LaFull, Math.max(0, Rp - rP - 8));
  const wrap = phi % TAU;
  const trail = Math.min(phi, 1.3);

  // labels
  const vTip = { x: px + tX * (rP + 3 + Lv), y: py + tY * (rP + 3 + Lv) };
  const vOff = 16 + Math.abs(tX) * 40;
  const vLabel = { x: vTip.x + tX * vOff - iX * 6, y: vTip.y + tY * vOff - iY * 6 };
  const aMid = { x: px + iX * (rP + 2 + La * 0.55), y: py + iY * (rP + 2 + La * 0.55) };
  const aText = tx.aTag(num(a, dec));
  const aOff = 12 + Math.abs(tX) * (textWidth(aText, fs) / 2 + 4) + Math.abs(tY) * 6;
  const aLabel = { x: aMid.x - tX * aOff, y: aMid.y - tY * aOff };
  const rMid = { x: cx + (px - cx) * 0.5, y: cy + (py - cy) * 0.5 };
  const rOff = 14 + Math.abs(tX) * 30;
  const rLabel = { x: rMid.x + tX * rOff, y: rMid.y + tY * rOff };

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={22} />
      <AxisNumbers view={view} W={W} H={H} minPx={axisPx} xUnit={narrow ? null : 'x, m'} decimal={dec} />

      {/* platform (turns with the point) */}
      <circle cx={cx} cy={cy} r={Rd + 5} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
      <g transform={`rotate(${rot.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`}>
        {sectors}
        {seats}
      </g>
      <circle cx={cx} cy={cy} r={Rd} fill="none" stroke="#94a3b8" strokeWidth="2.5" />

      {/* ground-fixed start ray and the angle turned */}
      <line x1={cx} y1={cy} x2={cx + Rd + 10} y2={cy} stroke="#0891b2" strokeWidth="1.2" strokeDasharray="3 4" opacity="0.8" />
      {wrap > 0.02 && <path d={arcD(cx, cy, Math.max(16, Math.min(Rp * 0.35, 34)), 0, wrap)} fill="none" stroke="#0891b2" strokeWidth="2.5" />}

      {/* trajectory */}
      <circle cx={cx} cy={cy} r={Rp} fill="none" stroke={C.path} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="6 6" />
      {trail > 0.02 && <path d={arcD(cx, cy, Rp, phi - trail, phi)} fill="none" stroke={C.path} strokeWidth="4" strokeLinecap="round" opacity="0.85" />}

      {/* radius */}
      <line x1={cx} y1={cy} x2={px} y2={py} stroke={C.ink} strokeWidth="1.6" />
      <circle cx={cx} cy={cy} r={narrow ? 5 : 6} fill="#fff" stroke={C.ink} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={2} fill={C.ink} />
      <Tag x={cx - Math.cos(phi) * 16} y={cy + Math.sin(phi) * 16 + 5} text="O" color={C.ink} size={fs + 1} italic={false} />

      {/* acceleration and velocity */}
      {La > 4 && <Arrow x1={px + iX * (rP + 2)} y1={py + iY * (rP + 2)} x2={px + iX * (rP + 2 + La)} y2={py + iY * (rP + 2 + La)} color={C.acc} width={3.5} head={narrow ? 11 : 13} />}
      <Arrow x1={px + tX * (rP + 3)} y1={py + tY * (rP + 3)} x2={vTip.x} y2={vTip.y} color={C.vel} width={3.5} head={narrow ? 11 : 13} />

      {/* the point */}
      {running && <circle cx={px} cy={py} r={rP + 6} fill={C.path} className="cl-pulse" />}
      <circle cx={px} cy={py} r={rP} fill={C.ink} stroke="#fff" strokeWidth="2.5" />

      {/* labels */}
      <Pill x={rLabel.x} y={rLabel.y} text={tx.rTag(fmt(R, 1, dec))} bg="#fff" color={C.ink} border="#cbd5e1" size={fs} box={box} />
      <Pill x={vLabel.x} y={vLabel.y} text={tx.vTag(num(v, dec))} bg={C.vel} size={fs} box={box} />
      {La > 4 && <Pill x={aLabel.x} y={aLabel.y} text={aText} bg={C.acc} size={fs} box={box} />}
    </g>
  );
}
