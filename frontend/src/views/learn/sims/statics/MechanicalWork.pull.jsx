import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUp, Lightbulb, MoveUpLeft, MoveUpRight } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import {
  AngleArc,
  Chip,
  Crate,
  DarkGraph,
  DispArrow,
  FC,
  ForceArrow,
  ForceScale,
  Formula,
  GroupLabel,
  Ground,
  LabScene,
  Panel,
  PlayControls,
  SvgSym,
  Sym,
  TagPill,
  WC,
  niceCeil,
  num,
  rad,
  sideLabel,
  signKey,
  signed,
} from './MechanicalWork.parts';

/**
 * Tab 1 — the work of a force: a sled pulled by a rope at the angle α to its
 * displacement. Only the component along the motion, F·cosα, does work;
 * F·sinα (across the motion) does none.
 *   A = F·s·cosα   (1 J = 1 N·m)
 * Preset F = 50 N, s = 10 m, α = 60°: A = 50·10·0.5 = 250 J;
 * α = 0° → 500 J, α = 90° → 0, α = 120° → −250 J.
 * The sled moves at a steady 2 m/s (real time); the force's work grows
 * with the distance covered: A(x) = F·cosα·x.
 */

const V = 2; // m/s
const F_MAX = 100;
const S_MIN = 1;
const S_MAX = 15;
const BASE = { F: 50, s: 10 };
const PRESETS = {
  along: { ...BASE, alpha: 0, icon: ArrowRight },
  lesson: { ...BASE, alpha: 60, icon: MoveUpRight },
  perp: { ...BASE, alpha: 90, icon: ArrowUp },
  against: { ...BASE, alpha: 120, icon: MoveUpLeft },
};
const IDLE = { x: 0, running: false, done: false };

function pullPhysics(F, alpha) {
  const c = Math.cos(rad(alpha));
  const sn = Math.sin(rad(alpha));
  const cos = Math.abs(c) < 1e-9 ? 0 : c;
  const sin = Math.abs(sn) < 1e-9 ? 0 : sn;
  return { cos, sin, Fx: F * cos, Fy: F * sin };
}

function angleClass(alpha) {
  if (alpha === 0) return 'along';
  if (alpha < 90) return 'acute';
  if (alpha === 90) return 'perp';
  if (alpha < 180) return 'obtuse';
  return 'opposite';
}

const signColor = (k) => ({ pos: WC.pos, zero: WC.zero, neg: WC.neg })[k];
const signText = (k) => ({ pos: WC.posText, zero: WC.zeroText, neg: WC.negText })[k];

/* ==================================================================== sim */

export default function PullSim({ T }) {
  const L = T.pull;
  const dec = T.decimal;
  const [F, setF] = useState(BASE.F);
  const [s, setS] = useState(BASE.s);
  const [alpha, setAlpha] = useState(60);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);
  const ph = pullPhysics(F, alpha);
  const A = ph.Fx * s;
  const x = sim.x;
  const Anow = ph.Fx * x;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].F === F && PRESETS[k].s === s && PRESETS[k].alpha === alpha) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const nx = Math.min(s, p.x + V * dt);
      const done = nx >= s - 1e-9;
      return { x: nx, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
    setTouched(true);
  };
  const pick = (id) => {
    const p = PRESETS[id];
    setF(p.F);
    setS(p.s);
    setAlpha(p.alpha);
    setSim(IDLE);
    setTouched(true);
  };
  const toggle = () => {
    setTouched(true);
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- explanation */
  const J = (n) => signed(n, 0, dec);
  const F1 = (n) => num(n, 1, dec);
  const cosS = num(ph.cos, 3, dec);
  let key;
  if (F === 0) key = 'zeroF';
  else if (!touched && x === 0 && !sim.running) key = 'intro';
  else if (sim.done) key = `done_${signKey(A)}`;
  else key = angleClass(alpha);
  const settled = useSettled(key, sim.running ? 220 : 120);
  const ex = L.explain;
  const S0 = fmt(s, 0, dec);
  const text = {
    intro: ex.intro,
    zeroF: ex.zeroF,
    along: ex.along(F, S0, J(A)),
    acute: ex.acute(alpha, F, S0, cosS, J(A), F1(ph.Fy)),
    perp: ex.perp(F1(ph.Fy)),
    obtuse: ex.obtuse(alpha, cosS, J(A)),
    opposite: ex.opposite(F, S0, J(A)),
    done_pos: ex.done_pos(S0, J(A)),
    done_zero: ex.done_zero(S0),
    done_neg: ex.done_neg(S0, J(A)),
  }[settled];
  const tone = {
    intro: '#22d3ee',
    zeroF: WC.zero,
    along: WC.posText,
    acute: WC.posText,
    perp: WC.zeroText,
    obtuse: WC.negText,
    opposite: WC.negText,
    done_pos: WC.pos,
    done_zero: WC.zero,
    done_neg: WC.neg,
  }[settled];

  const kNow = signKey(Anow);
  const kAll = signKey(A);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
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
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={x > 0} onToggle={toggle} onReset={reset} />
      </div>

      <PullScene T={T} F={F} s={s} alpha={alpha} ph={ph} x={x} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.A}
          symbol="A"
          value={J(Anow)}
          unit={T.J}
          accent={signColor(kNow)}
          textColor={signText(kNow)}
          sub={L.aSub(J(A))}
          active={sim.running}
        />
        <Readout label={L.readouts.s} symbol="s" value={fmt(x, 1, dec)} unit={T.m} accent={FC.disp} textColor={FC.dispText} sub={L.sSub(S0)}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${clamp(x / s, 0, 1) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.Fx} symbol="F·cosα" value={F1(ph.Fx)} unit={T.N} accent={FC.pull} textColor={FC.pullText} sub={L.FxSub[kAll]} />
        <Readout label={L.readouts.Fy} symbol="F·sinα" value={F1(ph.Fy)} unit={T.N} accent={WC.zero} textColor={WC.zeroText} sub={L.FySub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="space-y-3">
          <RangeField
            id="mw-F"
            label={L.F}
            symbol="F"
            min={0}
            max={F_MAX}
            step={1}
            value={F}
            onChange={change(setF)}
            accent={FC.pull}
            display={`${F} ${T.N}`}
            hint={L.FHint(F1(ph.Fx), F1(ph.Fy))}
          />
          <RangeField
            id="mw-s"
            label={L.s}
            symbol="s"
            min={S_MIN}
            max={S_MAX}
            step={1}
            value={s}
            onChange={change(setS)}
            accent={FC.disp}
            display={`${s} ${T.m}`}
            hint={L.sHint(fmt(V, 0, dec), fmt(s / V, 1, dec))}
          />
          <RangeField
            id="mw-alpha"
            label={L.alpha}
            symbol="α"
            min={0}
            max={180}
            step={1}
            value={alpha}
            onChange={change(setAlpha)}
            accent="#22d3ee"
            display={`${alpha}°`}
            hint={L.alphaHint(cosS)}
          />
          <ZoneList T={T} alpha={alpha} />
        </Panel>
        <SignPanel T={T} F={F} s={s} alpha={alpha} ph={ph} A={A} />
        <Panel>
          <WorkAngleGraph T={T} F={F} s={s} alpha={alpha} A={A} onPick={change(setAlpha)} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function PullScene({ T, F, s, alpha, ph, x, running }) {
  const L = T.pull;
  const dec = T.decimal;
  const S = T.sym;
  const lmaxOf = (narrow, H) => (narrow ? 70 : clamp(H * 0.4, 120, 180));
  const comps = F > 0 && alpha !== 0 && alpha !== 90 && alpha !== 180;
  return (
    <LabScene
      legend={[
        { color: FC.pull, label: L.legend.F, kind: 'arrow' },
        { color: FC.pull, label: L.legend.comp, kind: 'dash' },
        { color: FC.disp, label: L.legend.s, kind: 'arrow' },
        { color: '#94a3b8', label: L.legend.dir, kind: 'dash' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>
            {L.chipReal} · t = {fmt(x / V, 1, dec)} {T.s}
          </Chip>
          <ForceScale kF={lmaxOf(narrow, H) / F_MAX} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => (narrow ? 262 : 430)}
      ariaLabel={L.sceneLabel(F, fmt(s, 0, dec), alpha, signed(ph.Fx * s, 0, dec))}
    >
      {(W, H, narrow) => {
        const lmax = lmaxOf(narrow, H);
        const kF = lmax / F_MAX;
        const pad = narrow ? 50 : Math.max(100, lmax * 0.7);
        const k = Math.min(narrow ? 46 : 74, (W - 2 * pad) / (s + 2));
        const sx = (u) => W / 2 + (u - s / 2) * k;
        const floorY = H - (narrow ? 64 : 82);
        const sy = (v) => floorY - v * k;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };

        /* sled and crate (metres) */
        const runH = 0.26;
        const sledL = 2.4;
        const cw = 1.6;
        const ch = 0.95;
        const c = { x: sx(x), y: sy(runH + ch / 2) };
        const hw = (cw / 2) * k;
        const hh = (ch / 2) * k;

        /* the rope leaves the crate surface in the direction of F */
        const u = { x: ph.cos, y: -ph.sin };
        const tEdge = Math.min(Math.abs(u.x) > 1e-6 ? hw / Math.abs(u.x) : Infinity, Math.abs(u.y) > 1e-6 ? hh / Math.abs(u.y) : Infinity);
        const ropeLen = lmax + 26;
        const r0 = { x: c.x + u.x * tEdge, y: c.y + u.y * tEdge };
        const r1 = { x: c.x + u.x * ropeLen, y: c.y + u.y * ropeLen };

        const Fx = ph.Fx * kF;
        const Fy = ph.Fy * kF;
        const tip = { x: c.x + Fx, y: c.y - Fy };
        const cxTip = { x: c.x + Fx, y: c.y };
        const cosLab = sideLabel(c, cxTip, tip, 13);
        const sinLab = sideLabel(cxTip, tip, c, 10);

        /* ground ruler */
        const step = niceStep(k, narrow ? 34 : 50);
        const ticks = [];
        for (let t0 = 0; sx(t0) <= W - 40; t0 += step) {
          ticks.push(
            <g key={t0}>
              <line x1={sx(t0)} x2={sx(t0)} y1={floorY} y2={floorY + 6} stroke="#475569" strokeWidth="1.2" />
              <text x={sx(t0)} y={floorY + 19} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
                {fmt(t0, Number.isInteger(t0) ? 0 : 1, dec)}
              </text>
            </g>,
          );
        }
        const dispY = floorY + (narrow ? 33 : 38);
        const Anow = ph.Fx * x;
        const kNow = signKey(Anow);

        return (
          <>
            <Ground W={W} y={floorY} depth={H - floorY} fill="#f1f5f9" />
            {ticks}
            <text x={W - 6} y={floorY + 19} textAnchor="end" fontSize={fs - 2} fontWeight="700" fill="#475569">
              x, {T.m}
            </text>

            {/* start and finish */}
            <line x1={sx(0)} x2={sx(0)} y1={floorY - 10} y2={floorY + 2} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
            <line x1={sx(s)} x2={sx(s)} y1={floorY - 18} y2={floorY} stroke="#16a34a" strokeWidth="2.2" />
            {x < s - 0.05 && <Crate x={sx(s) - hw} y={sy(runH + ch)} w={cw * k} h={ch * k} ghost />}

            {/* displacement */}
            <DispArrow x1={sx(0)} x2={sx(x)} y={dispY} label={x > 0.02 ? `s = ${fmt(x, 1, dec)} ${T.m}` : null} fs={fs} box={box} />

            {/* rope and handle */}
            {F > 0 && (
              <>
                <line x1={r0.x} y1={r0.y} x2={r1.x} y2={r1.y} stroke="#a16207" strokeWidth="2.2" />
                <rect x={r1.x - 8} y={r1.y - 4.5} width={16} height={9} rx={3} fill="#a16207" transform={`rotate(${-alpha} ${r1.x} ${r1.y})`} />
              </>
            )}

            {/* sled */}
            {running && <rect x={c.x - hw - 6} y={sy(runH + ch) - 6} width={cw * k + 12} height={ch * k + 12} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
            <path
              d={`M${sx(x - sledL / 2)},${sy(0.03)} L${sx(x + sledL / 2 - 0.22)},${sy(0.03)} Q${sx(x + sledL / 2 + 0.02)},${sy(0.03)} ${sx(x + sledL / 2)},${sy(0.2)}`}
              fill="none"
              stroke="#334155"
              strokeWidth={Math.max(2, 0.05 * k)}
              strokeLinecap="round"
            />
            <line x1={sx(x - 0.7)} x2={sx(x - 0.7)} y1={sy(0.03)} y2={sy(runH)} stroke="#334155" strokeWidth={Math.max(1.5, 0.04 * k)} />
            <line x1={sx(x + 0.7)} x2={sx(x + 0.7)} y1={sy(0.03)} y2={sy(runH)} stroke="#334155" strokeWidth={Math.max(1.5, 0.04 * k)} />
            <rect x={sx(x - sledL / 2 + 0.08)} y={sy(runH) - Math.max(2, 0.05 * k)} width={(sledL - 0.3) * k} height={Math.max(3, 0.07 * k)} rx={2} fill="#92400e" />
            <Crate x={c.x - hw} y={sy(runH + ch)} w={cw * k} h={ch * k} />

            {/* direction of motion and the angle */}
            {F > 0 && (
              <>
                <line x1={c.x} y1={c.y} x2={c.x + Math.max(lmax * 0.62, Math.abs(Fx) + 18)} y2={c.y} stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="5 4" />
                {alpha > 0 && <AngleArc cx={c.x} cy={c.y} r={narrow ? 17 : 26} from={0} to={-rad(alpha)} label="α" color="#0891b2" fs={fs} labelR={narrow ? 27 : 38} />}
              </>
            )}

            {/* F split into F·cosα (along the motion) and F·sinα (across it) */}
            {comps && (
              <>
                <ForceArrow x={c.x} y={c.y} dx={Fx} dy={0} color={FC.pull} width={2.2} head={9} dash="5 4" opacity={0.9} />
                <ForceArrow x={cxTip.x} y={cxTip.y} dx={0} dy={-Fy} color={FC.pull} width={2.2} head={9} dash="5 4" opacity={0.45} />
                {Math.abs(Fx) > 18 && <SvgSym x={cosLab.x} y={cosLab.y + 4} text={S.Fx} color={FC.pull} fs={fs - 1} anchor="middle" weight={700} />}
                {Fy > 22 && (
                  <>
                    <SvgSym x={sinLab.x} y={sinLab.y} text={S.Fy} color={FC.pull} fs={fs - 1} anchor={sinLab.anchor} weight={700} />
                    {!narrow && <SvgSym x={sinLab.x} y={sinLab.y + fs} text={L.noWork} color={WC.zeroInk} fs={fs - 2.5} anchor={sinLab.anchor} weight={600} italic={false} />}
                  </>
                )}
              </>
            )}
            {F > 0 && <ForceArrow x={c.x} y={c.y} dx={Fx} dy={-Fy} color={FC.pull} label={S.F} value={`${F} ${T.N}`} fs={fs} box={box} width={3.4} />}
            <circle cx={c.x} cy={c.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />

            {/* the work done so far, riding over the crate */}
            {x > 0.02 && (
              <TagPill
                x={c.x - (ph.cos >= 0 ? 1 : -1) * (hw + (narrow ? 30 : 46))}
                y={sy(runH + ch) - (narrow ? 14 : 18)}
                text={`A = ${signed(Anow, 0, dec)} ${T.J}`}
                bg={{ pos: WC.posInk, zero: WC.zeroInk, neg: WC.negInk }[kNow]}
                fs={fs - 0.5}
                box={box}
              />
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ============================================================ side panel */

function SignPanel({ T, F, s, alpha, ph, A }) {
  const L = T.pull.side;
  const dec = T.decimal;
  const kA = signKey(A);
  return (
    <Panel>
      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-100">
        <span className="rounded-md border border-white/10 bg-white/10 px-1.5 py-0.5 font-serif text-[13px] italic">A = F·s·cosα</span>
        {L.title}
      </p>
      <div className="mt-3">
        <SignGauge T={T} alpha={alpha} ph={ph} F={F} />
      </div>
      <Formula
        className="mt-3"
        sym="A = F·s·cosα"
        nums={`= ${F} ${T.N} · ${fmt(s, 0, dec)} ${T.m} · ${ph.cos < 0 ? `(${num(ph.cos, 3, dec)})` : num(ph.cos, 3, dec)} =`}
        result={`${signed(A, 0, dec)} ${T.J}`}
        resultColor={{ pos: WC.posText, zero: WC.zeroText, neg: WC.negText }[kA]}
      />
      <p className="mt-2 text-xs text-gray-500">{L.unit}</p>
    </Panel>
  );
}

/** The three cases of the sign of work, the current one lit. */
function ZoneList({ T, alpha }) {
  const L = T.pull.side;
  const zone = alpha < 90 ? 'pos' : alpha === 90 ? 'zero' : 'neg';
  return (
    <ul className="space-y-1.5" aria-label={L.zonesLabel}>
      {['pos', 'zero', 'neg'].map((z) => {
        const on = z === zone;
        const col = { pos: WC.pos, zero: WC.zero, neg: WC.neg }[z];
        return (
          <li
            key={z}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-1.5 text-[13px] transition-colors ${on ? 'text-white' : 'border-white/5 text-gray-400'}`}
            style={on ? { borderColor: `${col}99`, background: `${col}1f` } : undefined}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: col }} aria-hidden="true" />
            <span className="w-[104px] shrink-0 font-serif italic tabular-nums">{L.zones[z].range}</span>
            <span className="leading-snug">{L.zones[z].text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** A protractor: the needle is the force's direction, the right half gives A > 0, the left half A < 0. */
function SignGauge({ T, alpha, ph, F }) {
  const L = T.pull.side.gauge;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 200;
  const cx = W / 2;
  const cy = H - 36;
  const R = Math.min(W / 2 - 42, H - 64);
  const P = (a, r) => ({ x: cx + r * Math.cos(rad(a)), y: cy - r * Math.sin(rad(a)) });
  const sector = (a0, a1, r) => {
    const p0 = P(a0, r);
    const p1 = P(a1, r);
    return `M${cx},${cy} L${p0.x},${p0.y} A${r},${r} 0 0 0 ${p1.x},${p1.y} Z`;
  };
  const nl = R * 0.86;
  const tip = P(alpha, nl);
  const bx = cx + nl * ph.cos;
  const zone = signKey(ph.cos, 3);
  const ink = { pos: WC.posInk, zero: WC.zeroInk, neg: WC.negInk }[zone];
  const barCol = { pos: WC.pos, zero: WC.zero, neg: WC.neg }[zone];
  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-slate-300/70 bg-white">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L.label(alpha, num(ph.cos, 3, dec))} className="cl-scene block select-none">
        <rect width={W} height={H} fill="#fbfcfe" />
        {width > 0 && (
          <>
            <path d={sector(0, 89.2, R)} fill={WC.posPaper} />
            <path d={sector(90.8, 180, R)} fill={WC.negPaper} />
            <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1={cx} y1={cy} x2={cx} y2={cy - R} stroke="#64748b" strokeWidth="1.5" strokeDasharray="4 3" />
            {[0, 30, 60, 90, 120, 150, 180].map((a) => {
              const p0 = P(a, R);
              const p1 = P(a, R + 6);
              return <line key={a} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#64748b" strokeWidth="1.4" />;
            })}
            <text x={cx + R + 8} y={cy - 4} fontSize="11" fill="#64748b">
              0°
            </text>
            <text x={cx - R - 8} y={cy - 4} textAnchor="end" fontSize="11" fill="#64748b">
              180°
            </text>
            <text x={cx} y={cy - R - 10} textAnchor="middle" fontSize="11" fill="#64748b">
              90°
            </text>
            <SvgSym x={P(42, R * 0.6).x} y={P(42, R * 0.6).y} text={L.pos} color={WC.posInk} fs={13} weight={700} italic={false} />
            <SvgSym x={P(138, R * 0.6).x} y={P(138, R * 0.6).y} text={L.neg} color={WC.negInk} fs={13} weight={700} italic={false} />
            <SvgSym x={cx} y={cy - R * 0.78} text={L.zero} color={WC.zeroInk} fs={12} weight={700} italic={false} />

            {/* the displacement axis */}
            <line x1={cx - R} y1={cy} x2={cx + R - 2} y2={cy} stroke={FC.disp} strokeWidth="1.6" />
            <path d={`M${cx + R + 6},${cy} L${cx + R - 5},${cy - 5} L${cx + R - 5},${cy + 5} Z`} fill={FC.disp} />
            <SvgSym x={cx + R + 8} y={cy + 15} text="s" color={FC.disp} fs={13} anchor="start" />

            {/* projection of the needle on the motion: cos α */}
            {F > 0 && (
              <>
                <line x1={tip.x} y1={tip.y} x2={bx} y2={cy} stroke={FC.pull} strokeWidth="1.3" strokeDasharray="3 3" />
                {Math.abs(bx - cx) > 1 && <line x1={cx} y1={cy} x2={bx} y2={cy} stroke={barCol} strokeWidth="6" strokeLinecap="round" />}
                <ForceArrow x={cx} y={cy} dx={tip.x - cx} dy={tip.y - cy} color={FC.pull} label="F" fs={13} width={3} />
              </>
            )}
            <circle cx={cx} cy={cy} r={4} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            <text x={cx} y={cy + 24} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={ink}>
              {L.cos(alpha, num(ph.cos, 3, dec))}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/* ================================================================ graph */

function WorkAngleGraph({ T, F, s, alpha, A, onPick }) {
  const L = T.pull.graph;
  const dec = T.decimal;
  const top = niceCeil(Math.max(F * s, 1));
  const { pos, neg, all } = useMemo(() => {
    const p = [];
    const n = [];
    const a = [];
    for (let d = 0; d <= 180; d += 2) {
      const c = Math.cos(rad(d));
      const v = F * s * (Math.abs(c) < 1e-9 ? 0 : c);
      a.push({ x: d, y: v });
      if (d <= 90) p.push({ x: d, y: v });
      if (d >= 90) n.push({ x: d, y: v });
    }
    return { pos: p, neg: n, all: a };
  }, [F, s]);
  return (
    <DarkGraph
      title={L.title}
      series={[
        { id: 'pos', color: WC.pos, points: pos, line: false },
        { id: 'neg', color: WC.neg, points: neg, line: false },
        { id: 'A', label: L.A, color: '#e2e8f0', points: all, dot: false },
        { id: 'now', label: L.now, color: '#22d3ee', points: [{ x: alpha, y: A }] },
      ]}
      fills={[
        { id: 'pos', color: WC.pos, opacity: 0.22 },
        { id: 'neg', color: WC.neg, opacity: 0.22 },
      ]}
      xMax={180}
      xTicks={[0, 45, 90, 135, 180]}
      yMin={-top}
      yMax={top}
      yTicks={[-top, -top / 2, 0, top / 2, top]}
      xLabel={L.x}
      yLabel={L.y}
      marker={alpha}
      decimal={dec}
      height={286}
      onScrub={(v) => onPick(clamp(Math.round(v), 0, 180))}
      note={L.note}
    />
  );
}
