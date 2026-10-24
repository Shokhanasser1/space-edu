import { useMemo, useState } from 'react';
import { Feather, Lightbulb, Lock, Weight } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, TimeGraph, makeView } from '../kit/scene';
import {
  Chip,
  Eq,
  FC,
  FbdAxis,
  FbdPaper,
  ForceArrow,
  ForceChips,
  ForceScale,
  G,
  Ground,
  GroupLabel,
  LabScene,
  MethodPanel,
  Panel,
  PlayControls,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  ceil4,
  num,
} from './MultipleForces.parts';

/**
 * Tab 2 — a block on a table pulled by a hanging weight over a pulley. Both
 * bodies move with the same a; Newton's second law for each body:
 *   1: T − μm₁g = m₁a,  N = m₁g;   2: m₂g − T = m₂a
 *   ⇒ a = (m₂ − μm₁)g / (m₁ + m₂),  T = m₁(a + μg) = m₂(g − a);
 * when m₂ ≤ μm₁ the system stays: a = 0, T = m₂g.
 * Preset m₁ = 2 kg, m₂ = 1 kg, μ = 0 → a = 9.8/3 = 3.27 m/s², T = 6.53 N.
 */

const D = 1; // m, the weight's drop to the floor
const SLOW = 4; // time runs 4× slower on screen
const XT = 1.75; // table's right edge
const TABLE_H = 1.45; // table top above the floor
const HS = 0.1; // string height above the table top
const RP = 0.075; // pulley radius
const PX = XT + 0.07; // pulley centre
const PY = HS - RP;
const XS = PX + RP; // the hanging string
const XF0 = XT - 0.2 - D; // block's front at the start
const YW0 = -0.14; // weight's top at the start
const M2_MAX = 4;
const IDLE = { t: 0, running: false, done: false };

const PRESETS = {
  lesson: { m1: 2, m2: 1, mu: 0, icon: Feather },
  friction: { m1: 2, m2: 1, mu: 0.2, icon: Weight },
  rest: { m1: 4, m2: 1, mu: 0.3, icon: Lock },
};

function pulleyPhysics(m1, m2, mu) {
  const N = m1 * G;
  const drive = m2 * G;
  const frMax = mu * N;
  if (drive <= frMax + 1e-9) return { moves: false, a: 0, T: drive, fr: drive, N, frMax };
  const a = ((m2 - mu * m1) * G) / (m1 + m2);
  return { moves: true, a, T: m1 * (a + mu * G), fr: frMax, N, frMax };
}

/* ==================================================================== sim */

export default function PulleySim({ T }) {
  const L = T.pulley;
  const dec = T.decimal;
  const [m1, setM1] = useState(2);
  const [m2, setM2] = useState(1);
  const [mu, setMu] = useState(0);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);
  const ph = pulleyPhysics(m1, m2, mu);
  const tEnd = ph.moves ? Math.sqrt((2 * D) / ph.a) : 0;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].m1 === m1 && PRESETS[k].m2 === m2 && PRESETS[k].mu === mu) ?? null;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt / SLOW);
      const done = t >= tEnd - 1e-9;
      return { t, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
    setTouched(true);
  };
  const pick = (id) => {
    setM1(PRESETS[id].m1);
    setM2(PRESETS[id].m2);
    setMu(PRESETS[id].mu);
    setSim(IDLE);
    setTouched(true);
  };
  const toggle = () => {
    if (!ph.moves) return;
    setTouched(true);
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  const t = sim.t;
  const s = ph.moves ? 0.5 * ph.a * t * t : 0;
  const v = ph.a * t;
  const F2 = (n) => num(n, 2, dec);

  let key;
  if (!ph.moves) key = 'stays';
  else if (sim.done) key = 'done';
  else if (t === 0 && !sim.running && !touched) key = 'intro';
  else if (t > 0 && s >= 0.45 * D) key = 'lessT';
  else key = mu === 0 ? 'smooth' : 'move';
  const settled = useSettled(key, sim.running ? 250 : 0);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    stays: ex.stays(F2(m2 * G), F2(ph.frMax)),
    smooth: ex.smooth(F2(ph.a), F2(ph.T)),
    move: ex.move(F2(ph.a), F2(ph.T)),
    lessT: ex.lessT(F2(ph.T), F2(m2 * G)),
    done: ex.done(fmt(D, 0, dec), F2(tEnd), F2(ph.a * tEnd)),
  }[settled];
  const tone = { intro: '#22d3ee', stays: '#a78bfa', smooth: '#fb923c', move: '#fb923c', lessT: '#22d3ee', done: '#34d399' }[settled];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} disabled={!ph.moves} />
      </div>

      <SceneRow
        renderScene={(fitH) => <PulleyScene T={T} m1={m1} m2={m2} ph={ph} s={s} v={v} t={t} running={sim.running} fitH={fitH} />}
        method={<PulleyMethod T={T} m1={m1} m2={m2} mu={mu} ph={ph} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.a} symbol="a" value={F2(ph.a)} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={ph.moves ? L.aSub : L.aSubRest} active={sim.running} />
        <Readout
          label={L.readouts.T}
          symbol="T"
          value={F2(ph.T)}
          unit={T.N}
          accent={FC.tension}
          textColor={FC.tensionText}
          sub={<Sym>{ph.moves ? L.TSub(F2(m2 * G)) : L.TSubRest}</Sym>}
        />
        <Readout label={L.readouts.v} symbol="v" value={F2(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub} />
        <Readout label={L.readouts.s} symbol="s" value={F2(s)} unit={T.m} accent={PALETTE.path} textColor={PALETTE.pathText} sub={L.sSub(F2(t), fmt(D, 0, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${clamp(s / D, 0, 1) * 100}%` }} />
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="mf-m1"
            label={L.m1}
            symbol={<Sym>m_{1}</Sym>}
            min={0.5}
            max={5}
            step={0.5}
            value={m1}
            onChange={change(setM1)}
            accent="#f59e0b"
            display={`${fmt(m1, 1, dec)} ${T.kg}`}
            hint={<Sym>{L.m1Hint(F2(m1 * G))}</Sym>}
          />
          <RangeField
            id="mf-m2"
            label={L.m2}
            symbol={<Sym>m_{2}</Sym>}
            min={0.1}
            max={M2_MAX}
            step={0.1}
            value={m2}
            onChange={change(setM2)}
            accent={FC.weight}
            display={`${fmt(m2, 1, dec)} ${T.kg}`}
            hint={<Sym>{L.m2Hint(F2(m2 * G))}</Sym>}
          />
          <RangeField
            id="mf-mu2"
            label={L.mu}
            symbol="μ"
            min={0}
            max={0.6}
            step={0.05}
            value={mu}
            onChange={change(setMu)}
            accent={FC.fric}
            display={fmt(mu, 2, dec)}
            hint={<Sym>{L.muHint(F2(ph.frMax))}</Sym>}
          />
          <CompareBars T={T} m2={m2} ph={ph} />
        </Panel>
        <Panel className="lg:col-span-3">
          <PulleyGraph T={T} m1={m1} m2={m2} mu={mu} a={ph.a} onPick={change(setM2)} />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- comparison */

function CompareBars({ T, m2, ph }) {
  const L = T.pulley.compare;
  const dec = T.decimal;
  const drive = m2 * G;
  const top = Math.max(drive, ph.frMax, ph.T, 1e-6);
  const rows = [
    [L.drive, drive, FC.weight],
    [L.T, ph.T, FC.tension],
    [L.fr, ph.frMax, FC.fric],
  ];
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.title}</p>
      <div className="mt-2 space-y-1.5">
        {rows.map(([name, val, col]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[12px] leading-tight text-gray-400">
              <Sym>{name}</Sym>
            </span>
            <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300" style={{ width: `${(val / top) * 100}%`, background: col }} />
            </span>
            <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-gray-200">
              {num(val, 2, dec)} {T.N}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-gray-400">
        <Sym>{ph.moves ? L.move : L.rest}</Sym>
      </p>
    </div>
  );
}

/* ================================================================= scene */

function PulleyScene({ T, m1, m2, ph, s, v, t, running, fitH }) {
  const L = T.pulley;
  const dec = T.decimal;
  const S = T.sym;
  const fMax = Math.max(m1, m2) * G;
  const lmax = (narrow, H) => (narrow ? 50 : clamp(H * 0.15, 72, 100));
  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.w, kind: 'arrow' },
        { color: FC.normal, label: L.legend.N, kind: 'arrow' },
        { color: FC.tension, label: L.legend.T, kind: 'arrow' },
        { color: FC.fric, label: L.legend.fr, kind: 'arrow' },
        { color: FC.vel, label: L.legend.v, kind: 'arrow' },
        { color: FC.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>
            {L.chipSlow} · t = {fmt(t, 2, dec)} {T.s}
          </Chip>
          <ForceScale kF={lmax(narrow, H) / fMax} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? 372 : 452)}
      ariaLabel={L.sceneLabel(num(ph.a, 2, dec), num(ph.T, 2, dec), num(s, 2, dec))}
    >
      {(W, H, narrow) => {
        const pad = narrow ? { l: 16, r: 16, t: 104, b: 28 } : { l: 40, r: 40, t: 118, b: 36 };
        const view = makeView({ x0: -0.1, x1: XS + 0.42, y0: -TABLE_H - 0.02, y1: 0.45 }, W, H, pad);
        const { sx, sy, k } = view;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const kF = lmax(narrow, H) / fMax;

        const b1 = clamp(Math.cbrt(m1 / 2), 0.75, 1.4);
        const bw = 0.36 * b1;
        const bh = 0.22 * b1;
        const xf = XF0 + s;
        const b2 = clamp(Math.cbrt(m2), 0.6, 1.45);
        const ww = 0.17 * b2;
        const wh = 0.2 * b2;
        const yTop = YW0 - s;

        const c1 = { x: sx(xf - bw / 2), y: sy(bh / 2) };
        const c2 = { x: sx(XS), y: sy(yTop - wh / 2) };
        const kv = narrow ? 12 : 16;
        const ka = narrow ? 6 : 8;
        const phi = (s / RP) * (180 / Math.PI);
        const rp = RP * k;

        return (
          <>
            <Grid view={view} W={W} H={H} />
            <Ground W={W} y={sy(-TABLE_H)} depth={H - sy(-TABLE_H)} />

            {/* table */}
            <rect x={sx(0.05)} y={sy(-0.05)} width={0.05 * k} height={(TABLE_H - 0.05) * k} fill="#cbd5e1" stroke="#64748b" strokeWidth="1.2" />
            <rect x={sx(XT - 0.13)} y={sy(-0.05)} width={0.05 * k} height={(TABLE_H - 0.05) * k} fill="#cbd5e1" stroke="#64748b" strokeWidth="1.2" />
            <rect x={sx(0)} y={sy(0)} width={XT * k} height={0.05 * k} rx={2} fill="#e2e8f0" stroke="#475569" strokeWidth="1.6" />

            {/* pulley on its bracket */}
            <path d={`M${sx(XT - 0.02)},${sy(-0.15)} L${sx(XT + 0.015)},${sy(-0.15)} L${sx(PX)},${sy(PY)} L${sx(XT - 0.02)},${sy(0)} Z`} fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
            <g transform={`translate(${sx(PX)} ${sy(PY)}) rotate(${phi.toFixed(1)})`}>
              <circle r={rp} fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
              {[0, 120, 240].map((a) => (
                <line key={a} x1={0} y1={0} x2={rp * 0.8 * Math.cos((a * Math.PI) / 180)} y2={rp * 0.8 * Math.sin((a * Math.PI) / 180)} stroke="#64748b" strokeWidth="1.5" />
              ))}
              <circle r={2.5} fill="#334155" />
            </g>

            {/* string */}
            <path
              d={`M${sx(xf)},${sy(HS)} L${sx(PX)},${sy(HS)} A${rp},${rp} 0 0 1 ${sx(XS)},${sy(PY)} L${sx(XS)},${sy(yTop)}`}
              fill="none"
              stroke="#334155"
              strokeWidth="1.6"
            />

            {/* body 1 */}
            {running && <rect x={sx(xf - bw) - 5} y={sy(bh) - 5} width={bw * k + 10} height={bh * k + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
            <rect x={sx(xf - bw)} y={sy(bh)} width={bw * k} height={bh * k} rx={4} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
            <SvgSym x={sx(xf - bw) + Math.min(16, (bw * k) / 4)} y={sy(bh) + fs + 2} text={S.m1} color="#92400e" fs={fs - 1} halo={false} />

            {/* body 2 */}
            <rect x={sx(XS - ww / 2)} y={sy(yTop)} width={ww * k} height={wh * k} rx={3} fill="#64748b" stroke="#334155" strokeWidth="2" />
            <rect x={sx(XS - ww / 2) + 3} y={sy(yTop) + 3} width={ww * k - 6} height={4} rx={2} fill="#94a3b8" />
            <SvgSym x={sx(XS - ww / 2) + (ww * k) / 4 + 1} y={sy(yTop - wh) - 5} text={S.m2} color="#fff" fs={fs - 2} halo={false} />

            {/* forces on body 1 */}
            <ForceArrow x={c1.x} y={c1.y} dx={0} dy={ph.N * kF} color={FC.weight} label={S.m1g} fs={fs} box={box} labelAt={{ x: c1.x + 8, y: c1.y + ph.N * kF + 4, anchor: 'start' }} />
            <ForceArrow x={c1.x} y={c1.y} dx={0} dy={-ph.N * kF} color={FC.normal} label={S.N} fs={fs} box={box} />
            <circle cx={c1.x} cy={c1.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            {/* tension acts where the string is tied, friction along the table top */}
            <ForceArrow x={sx(xf)} y={sy(HS)} dx={ph.T * kF} dy={0} color={FC.tension} label={S.T} fs={fs} box={box} labelAt={{ x: sx(xf) + ph.T * kF - 2, y: sy(HS) - 9, anchor: 'middle' }} />
            <ForceArrow x={sx(xf - bw / 2)} y={sy(0) + 5} dx={-ph.fr * kF} dy={0} color={FC.fric} label={S.fr} fs={fs} box={box} labelAt={{ x: sx(xf - bw / 2) - ph.fr * kF - 6, y: sy(0) + 20, anchor: 'end' }} />

            {/* forces on body 2 */}
            <ForceArrow x={c2.x} y={c2.y} dx={0} dy={m2 * G * kF} color={FC.weight} label={S.m2g} fs={fs} box={box} labelAt={{ x: c2.x - 8, y: c2.y + m2 * G * kF + 4, anchor: 'end' }} />
            <circle cx={c2.x} cy={c2.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            <ForceArrow x={c2.x} y={sy(yTop)} dx={0} dy={-ph.T * kF} color={FC.tension} label={S.T} fs={fs} box={box} labelAt={{ x: c2.x + 8, y: sy(yTop) - 6, anchor: 'start' }} />

            {/* velocity and acceleration of both bodies */}
            {v > 0.02 && (
              <>
                <ForceArrow x={sx(xf) + 4} y={sy(bh) - 14} dx={v * kv} dy={0} color={FC.vel} width={2.75} head={10} label={S.v} fs={fs} box={box} />
                <ForceArrow x={sx(XS + ww / 2) + 14} y={c2.y} dx={0} dy={v * kv} color={FC.vel} width={2.75} head={10} label={S.v} fs={fs} box={box} />
              </>
            )}
            {ph.a > 0.02 && (
              <>
                <ForceArrow x={sx(xf) + 4} y={sy(bh) - 32} dx={ph.a * ka} dy={0} color={FC.acc} width={2.75} head={10} label={S.a} fs={fs} box={box} />
                <ForceArrow x={sx(XS + ww / 2) + 34} y={c2.y} dx={0} dy={ph.a * ka} color={FC.acc} width={2.75} head={10} label={S.a} fs={fs} box={box} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ======================================================= free-body diagram */

function PulleyFbd({ T, m1, m2, ph }) {
  const L = T.pulley;
  const dec = T.decimal;
  const S = T.sym;
  const F2 = (n) => `${num(n, 2, dec)} ${T.N}`;
  return (
    <FbdPaper title={L.fbd.title} height={250} ariaLabel={L.fbd.label}>
      {(W, H) => {
        const fMax = Math.max(m1, m2) * G;
        const Lm = Math.min(W * 0.2, H * 0.3);
        const kF = Lm / fMax;
        const box = { w: W, h: H };
        const c1 = { x: W * 0.3, y: H * 0.5 };
        const c2 = { x: W * 0.8, y: H * 0.44 };
        const half = 13;
        return (
          <>
            <line x1={W * 0.6} x2={W * 0.6} y1={34} y2={H - 10} stroke="#e2e8f0" strokeWidth="1.5" />
            <text x={W * 0.08} y={H - 10} fontSize="11" fontWeight="700" fill="#64748b">
              {L.fbd.b1}
            </text>
            <text x={W * 0.64} y={H - 10} fontSize="11" fontWeight="700" fill="#64748b">
              {L.fbd.b2}
            </text>

            <rect x={c1.x - half} y={c1.y - half * 0.7} width={half * 2} height={half * 1.4} rx={3} fill="#fdecd2" stroke="#e0b07a" />
            <FbdAxis x={c1.x} y={c1.y} ux={1} uy={0} len={Lm * 1.25} back={0.15} label="x" />
            <FbdAxis x={c1.x} y={c1.y} ux={0} uy={-1} len={Lm * 1.28} back={0.1} label="y" />
            <ForceArrow x={c1.x} y={c1.y} dx={0} dy={ph.N * kF} color={FC.weight} label={S.m1g} value={F2(ph.N)} fs={11.5} box={box} labelAt={{ x: c1.x + 7, y: c1.y + ph.N * kF + 2, anchor: 'start' }} />
            <ForceArrow x={c1.x} y={c1.y} dx={0} dy={-ph.N * kF} color={FC.normal} label={S.N} value={F2(ph.N)} fs={11.5} box={box} labelAt={{ x: c1.x - 7, y: c1.y - ph.N * kF + 4, anchor: 'end' }} />
            <ForceArrow x={c1.x} y={c1.y} dx={ph.T * kF} dy={0} color={FC.tension} label={S.T} value={F2(ph.T)} fs={11.5} box={box} labelAt={{ x: c1.x + 6, y: c1.y - 8, anchor: 'start' }} />
            <ForceArrow x={c1.x} y={c1.y} dx={-ph.fr * kF} dy={0} color={FC.fric} label={S.fr} value={F2(ph.fr)} fs={11.5} box={box} labelAt={{ x: c1.x - 6, y: c1.y + 18, anchor: 'end' }} />
            <circle cx={c1.x} cy={c1.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />

            <rect x={c2.x - half * 0.7} y={c2.y - half} width={half * 1.4} height={half * 2} rx={3} fill="#cbd5e1" stroke="#94a3b8" />
            <FbdAxis x={c2.x + 0} y={c2.y} ux={0} uy={1} len={Lm * 1.3} back={0.1} label="x" />
            <ForceArrow x={c2.x} y={c2.y} dx={0} dy={m2 * G * kF} color={FC.weight} label={S.m2g} value={F2(m2 * G)} fs={11.5} box={box} labelAt={{ x: c2.x - 8, y: c2.y + m2 * G * kF, anchor: 'end' }} />
            <ForceArrow x={c2.x} y={c2.y} dx={0} dy={-ph.T * kF} color={FC.tension} label={S.T} value={F2(ph.T)} fs={11.5} box={box} labelAt={{ x: c2.x - 8, y: c2.y - ph.T * kF + 8, anchor: 'end' }} />
            <circle cx={c2.x} cy={c2.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
          </>
        );
      }}
    </FbdPaper>
  );
}

/* =========================================================== the method */

function PulleyMethod({ T, m1, m2, mu, ph }) {
  const L = T.pulley;
  const M = L.method;
  const S = T.sym;
  const dec = T.decimal;
  const F2 = (n) => num(n, 2, dec);
  const fr = S.fr;
  const N = T.N;
  const m1S = fmt(m1, 1, dec);
  const m2S = fmt(m2, 1, dec);
  const muS = fmt(mu, 2, dec);
  const gS = fmt(G, 1, dec);
  return (
    <MethodPanel title={M.title} fbd={<PulleyFbd T={T} m1={m1} m2={m2} ph={ph} />}>
      <Step n={1} title={M.s1}>
        <ForceChips
          prefix={M.b1}
          items={[
            { sym: S.m1g, color: FC.weight, text: FC.weightText },
            { sym: S.N, color: FC.normal, text: FC.normalText },
            { sym: S.T, color: FC.tension, text: FC.tensionText },
            { sym: fr, color: FC.fric, text: FC.fricText },
          ]}
        />
        <ForceChips
          prefix={M.b2}
          items={[
            { sym: S.m2g, color: FC.weight, text: FC.weightText },
            { sym: S.T, color: FC.tension, text: FC.tensionText },
          ]}
        />
      </Step>
      <Step n={2} title={M.s2}>
        <p className="mt-0.5">{M.axes}</p>
      </Step>
      <Step n={3} title={M.s3}>
        {ph.moves ? (
          <>
            <Eq tag="1 · Ox" sym={`T − ${fr} = m_{1}a`} nums={`T − ${F2(ph.fr)} = ${m1S}·a`} />
            <Eq tag="1 · Oy" sym="N − m_{1}g = 0" nums={`N = ${F2(ph.N)} ${N},  ${fr} = μN = ${F2(ph.fr)} ${N}`} />
            <Eq tag="2 · Ox" sym="m_{2}g − T = m_{2}a" nums={`${F2(m2 * G)} − T = ${m2S}·a`} />
          </>
        ) : (
          <>
            <Eq tag="1 · Ox" sym={`T − ${fr} = 0`} nums={`${fr} = T`} />
            <Eq tag="2 · Ox" sym="m_{2}g − T = 0" nums={`T = ${F2(m2 * G)} ${N}`} />
          </>
        )}
      </Step>
      <Step n={4} title={M.s4}>
        {ph.moves ? (
          <>
            <p className="mt-0.5 text-[12px] text-gray-400">{M.sum}</p>
            <Eq sym="m_{2}g − μm_{1}g = (m_{1} + m_{2})a" />
            <Eq sym="a = (m_{2} − μm_{1})g / (m_{1} + m_{2})" nums={`= (${m2S} − ${muS}·${m1S})·${gS} / (${m1S} + ${m2S}) =`} result={`${F2(ph.a)} ${T.ms2}`} />
            <Eq sym="T = m_{1}(a + μg)" nums={`= ${m1S}·(${F2(ph.a)} + ${muS}·${gS}) =`} result={`${F2(ph.T)} ${N}`} resultColor={FC.tensionText} />
          </>
        ) : (
          <>
            <Eq sym="m_{2}g ≤ μm_{1}g" nums={M.rest(F2(m2 * G), F2(ph.frMax))} />
            <Eq sym="a = 0" nums={M.restT} />
          </>
        )}
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function PulleyGraph({ T, m1, m2, mu, a, onPick }) {
  const L = T.pulley;
  const dec = T.decimal;
  const { pts, yMax } = useMemo(() => {
    const out = [];
    let top = 0;
    for (let i = 0; i <= 80; i += 1) {
      const x = (i / 80) * M2_MAX;
      const y = Math.max(0, ((x - mu * m1) * G) / (m1 + x));
      out.push({ x, y });
      top = Math.max(top, y);
    }
    return { pts: out, yMax: ceil4(top) };
  }, [m1, mu]);
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'a', label: L.graph.a, color: '#fb923c', points: pts, dot: false },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: m2, y: a }] },
      ]}
      xMax={M2_MAX}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={m2}
      decimal={dec}
      height={250}
      onScrub={(x) => onPick(clamp(Math.round(x * 10) / 10, 0.1, M2_MAX))}
      note={mu > 0 ? L.graph.note(fmt(mu * m1, 2, dec)) : L.graph.noteZero}
    />
  );
}
