import { useMemo, useState } from 'react';
import { ArrowRight, ChevronsUp, Lightbulb, MoveUpRight, Target } from 'lucide-react';

import { Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import {
  AngleArc,
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
  deg,
  num,
  rad,
  sideLabel,
} from './MultipleForces.parts';

/**
 * Tab 3 — a crate pulled by a rope at an angle β on a horizontal floor.
 *   Oy: N + F·sinβ − mg = 0  ⇒  N = mg − F·sinβ  (lifting the rope unloads the floor)
 *   Ox: F·cosβ − μN = m·a   ⇒  a = (F·cosβ − μN)/m
 * The best angle maximises F·cosβ + μF·sinβ: tanβ = μ.
 * Preset m = 10 kg, F = 50 N, μ = 0.3, β = 30°: N = 98 − 25 = 73 N,
 * F_ishq = 21.9 N, a = (43.30 − 21.90)/10 = 2.14 m/s²; β = 0 gives 2.06 m/s²,
 * β ≈ 17° (tanβ = μ) gives 2.28 m/s², β = 60° only 0.86 m/s².
 */

const D = 3; // m travelled along the floor
const X0 = 0.7; // crate centre at the start
const X_L = -0.1;
const X_R = 4.75;
const BETA_MAX = 80;
const IDLE = { t: 0, running: false, done: false };

const BASE = { m: 10, F: 50, mu: 0.3 };
const PRESETS = {
  flat: { ...BASE, beta: 0, icon: ArrowRight },
  lesson: { ...BASE, beta: 30, icon: MoveUpRight },
  best: { ...BASE, beta: 17, icon: Target },
  steep: { ...BASE, beta: 60, icon: ChevronsUp },
};

function anglePhysics(m, F, beta, mu) {
  const sb = Math.sin(rad(beta));
  const cb = Math.cos(rad(beta));
  const mg = m * G;
  const Fx = F * cb;
  const Fy = F * sb;
  const N = mg - Fy;
  if (N <= 1e-9) return { lift: true, moves: false, mg, Fx, Fy, N: 0, fr: 0, frMax: 0, a: 0, sb, cb };
  const frMax = mu * N;
  if (Fx <= frMax + 1e-9) return { lift: false, moves: false, mg, Fx, Fy, N, fr: Fx, frMax, a: 0, sb, cb };
  return { lift: false, moves: true, mg, Fx, Fy, N, fr: frMax, frMax, a: (Fx - frMax) / m, sb, cb };
}

/* ==================================================================== sim */

export default function AngleSim({ T }) {
  const L = T.angle;
  const dec = T.decimal;
  const [m, setM] = useState(BASE.m);
  const [F, setF] = useState(BASE.F);
  const [mu, setMu] = useState(BASE.mu);
  const [beta, setBeta] = useState(30);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);
  const ph = anglePhysics(m, F, beta, mu);
  const tEnd = ph.moves ? Math.sqrt((2 * D) / ph.a) : 0;
  const preset = Object.keys(PRESETS).find((k) => PRESETS[k].m === m && PRESETS[k].F === F && PRESETS[k].mu === mu && PRESETS[k].beta === beta) ?? null;
  const betaOpt = deg(Math.atan(mu));
  const opt = anglePhysics(m, F, betaOpt, mu);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tEnd, p.t + dt);
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
    const p = PRESETS[id];
    setM(p.m);
    setF(p.F);
    setMu(p.mu);
    setBeta(p.beta);
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
  const s = 0.5 * ph.a * t * t;
  const v = ph.a * t;
  const F2 = (n) => num(n, 2, dec);

  let key;
  if (ph.lift) key = 'lift';
  else if (!ph.moves) key = 'stays';
  else if (sim.done) key = 'done';
  else if (t === 0 && !sim.running && !touched) key = 'intro';
  else if (beta === 0) key = 'flat';
  else if (Math.abs(beta - betaOpt) <= 1.5) key = 'best';
  else if (beta >= betaOpt + 25) key = 'steep';
  else key = 'move';
  const settled = useSettled(key, sim.running ? 250 : 120);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    lift: ex.lift,
    stays: ex.stays(F2(ph.Fx), F2(ph.frMax)),
    done: ex.done(fmt(D, 0, dec), F2(tEnd), F2(ph.a * tEnd)),
    flat: ex.flat(F2(ph.N), F2(ph.fr), F2(ph.a)),
    best: ex.best(fmt(betaOpt, 1, dec), F2(ph.a)),
    steep: ex.steep(F2(ph.Fx), F2(ph.a)),
    move: ex.move(F2(ph.N), F2(ph.fr), F2(ph.a)),
  }[settled];
  const tone = { intro: '#22d3ee', lift: '#f87171', stays: '#a78bfa', done: '#34d399', flat: '#fb923c', best: '#34d399', steep: '#f472b6', move: '#fb923c' }[settled];

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
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} disabled={!ph.moves} />
      </div>

      <SceneRow
        renderScene={(fitH) => <AngleScene T={T} m={m} F={F} beta={beta} ph={ph} s={s} v={v} t={t} running={sim.running} fitH={fitH} />}
        method={<AngleMethod T={T} m={m} F={F} beta={beta} mu={mu} ph={ph} betaOpt={betaOpt} />}
      />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={F2(ph.a)}
          unit={T.ms2}
          accent={PALETTE.acc}
          textColor={PALETTE.accText}
          sub={ph.lift ? L.aSubLift : ph.moves ? L.aSub : L.aSubRest}
          active={sim.running}
        />
        <Readout label={L.readouts.N} symbol="N" value={F2(ph.N)} unit={T.N} accent={FC.normal} textColor={FC.normalText} sub={beta === 0 ? L.NSubFlat : L.NSub(F2(ph.mg))} />
        <Readout
          label={L.readouts.fr}
          symbol={<Sym>{T.sym.fr}</Sym>}
          value={F2(ph.fr)}
          unit={T.N}
          accent={FC.fric}
          textColor={FC.fricText}
          sub={<Sym>{ph.moves ? L.frSub : L.frSubRest}</Sym>}
        />
        <Readout label={L.readouts.v} symbol="v" value={F2(v)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(F2(s), F2(t))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-violet-400" style={{ width: `${clamp(s / D, 0, 1) * 100}%` }} />
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="mf-F"
            label={L.F}
            symbol="F"
            min={0}
            max={100}
            step={1}
            value={F}
            onChange={change(setF)}
            accent={FC.pull}
            display={`${F} ${T.N}`}
            hint={L.FHint(F2(ph.Fx), F2(ph.Fy))}
          />
          <RangeField
            id="mf-beta"
            label={L.beta}
            symbol="β"
            min={0}
            max={BETA_MAX}
            step={1}
            value={beta}
            onChange={change(setBeta)}
            accent="#22d3ee"
            display={`${beta}°`}
            hint={L.betaHint(fmt(Math.tan(rad(beta)), 3, dec))}
          />
          <RangeField
            id="mf-mu3"
            label={L.mu}
            symbol="μ"
            min={0}
            max={0.8}
            step={0.05}
            value={mu}
            onChange={change(setMu)}
            accent={FC.fric}
            display={fmt(mu, 2, dec)}
            hint={L.muHint(F2(mu * m * G))}
          />
          <RangeField
            id="mf-m3"
            label={L.m}
            symbol="m"
            min={2}
            max={20}
            step={1}
            value={m}
            onChange={change(setM)}
            accent={FC.weight}
            display={`${m} ${T.kg}`}
            hint={L.mHint(F2(m * G))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.info.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [L.info.opt, `${fmt(betaOpt, 1, dec)}°`, '#a5f3fc'],
                [L.info.amax, opt.moves ? `${F2(opt.a)} ${T.ms2}` : '—', PALETTE.accText],
                [L.info.now, `${F2(ph.a)} ${T.ms2}`, '#e2e8f0'],
              ].map(([k, val, c]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
                    {val}
                  </dd>
                </div>
              ))}
            </dl>
            <Btn icon={Target} onClick={() => change(setBeta)(Math.round(betaOpt))} disabled={beta === Math.round(betaOpt)} className="mt-2.5 w-full">
              {L.bestBtn(Math.round(betaOpt))}
            </Btn>
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <AngleGraph T={T} m={m} F={F} mu={mu} beta={beta} a={ph.a} betaOpt={betaOpt} aOpt={opt.a} onPick={change(setBeta)} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function AngleScene({ T, m, F, beta, ph, s, v, t, running, fitH }) {
  const L = T.angle;
  const dec = T.decimal;
  const S = T.sym;
  const fMax = Math.max(ph.mg, F, 1);
  const lmax = (narrow, H) => (narrow ? 72 : clamp(H * 0.27, 104, 190));
  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.mg, kind: 'arrow' },
        { color: FC.normal, label: L.legend.N, kind: 'arrow' },
        { color: FC.pull, label: L.legend.F, kind: 'arrow' },
        { color: FC.pull, label: L.legend.comp, kind: 'dash' },
        { color: FC.fric, label: L.legend.fr, kind: 'arrow' },
        { color: FC.vel, label: L.legend.v, kind: 'arrow' },
        { color: FC.acc, label: L.legend.a, kind: 'arrow' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>
            {L.chipReal} · t = {fmt(t, 2, dec)} {T.s}
          </Chip>
          <ForceScale kF={lmax(narrow, H) / fMax} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? 340 : 452)}
      ariaLabel={L.sceneLabel(beta, num(ph.N, 2, dec), num(ph.a, 2, dec))}
    >
      {(W, H, narrow) => {
        const padL = narrow ? 12 : 30;
        const padR = narrow ? 12 : 30;
        const k = (W - padL - padR) / (X_R - X_L);
        const floorY = H - (narrow ? 104 : Math.max(128, lmax(narrow, H) + 44));
        const sx = (x) => padL + (x - X_L) * k;
        const sy = (y) => floorY - y * k;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const kF = lmax(narrow, H) / fMax;

        const bs = clamp(Math.cbrt(m / 10), 0.7, 1.3);
        const bw = 0.8 * bs;
        const bh = 0.5 * bs;
        const x = X0 + s;
        const c = { x: sx(x), y: sy(bh / 2) };
        const front = { x: sx(x + bw / 2), y: c.y };
        const dir = { x: ph.cb, y: -ph.sb };
        const ropeLen = 3 * k;
        const handle = 1.05 * k;

        const Fx = ph.Fx * kF;
        const Fy = ph.Fy * kF;
        const fTip = { x: c.x + Fx, y: c.y - Fy };
        const cxTip = { x: c.x + Fx, y: c.y };
        const cosLab = sideLabel(c, cxTip, fTip, 12);
        const sinLab = sideLabel(cxTip, fTip, c, 10);

        /* floor ruler */
        const step = niceStep(k, narrow ? 40 : 60);
        const ticks = [];
        for (let u = 0; u <= X_R; u += step) {
          ticks.push(
            <g key={u}>
              <line x1={sx(u)} x2={sx(u)} y1={floorY} y2={floorY + 6} stroke="#475569" strokeWidth="1.2" />
              <text x={sx(u)} y={floorY + 32} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
                {fmt(u, Number.isInteger(u) ? 0 : 1, dec)}
              </text>
            </g>,
          );
        }
        const kv = narrow ? 8 : 12;
        const ka = narrow ? 8 : 12;
        const kinY = floorY + (narrow ? 52 : 60);
        const showComp = beta >= 2 && F > 0;

        return (
          <>
            <Ground W={W} y={floorY} depth={H - floorY} />
            {ticks}
            <text x={W - 6} y={floorY + 32} textAnchor="end" fontSize={fs - 2} fontWeight="700" fill="#475569">
              x, {T.m}
            </text>
            <line x1={sx(X0)} x2={sx(X0)} y1={floorY - 8} y2={floorY + 2} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
            <line x1={sx(X0 + D)} x2={sx(X0 + D)} y1={floorY - 16} y2={floorY} stroke="#16a34a" strokeWidth="2" />

            {/* rope and handle */}
            <line x1={front.x} y1={front.y} x2={front.x + dir.x * ropeLen} y2={front.y + dir.y * ropeLen} stroke="#a16207" strokeWidth="2" />
            <rect
              x={front.x + dir.x * handle - 7}
              y={front.y + dir.y * handle - 4}
              width={14}
              height={8}
              rx={3}
              fill="#a16207"
              transform={`rotate(${-beta} ${front.x + dir.x * handle} ${front.y + dir.y * handle})`}
            />

            {/* crate */}
            {running && <rect x={sx(x - bw / 2) - 5} y={sy(bh) - 5} width={bw * k + 10} height={bh * k + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
            <rect x={sx(x - bw / 2)} y={sy(bh)} width={bw * k} height={bh * k} rx={4} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
            <line x1={sx(x - bw / 2) + 4} x2={sx(x + bw / 2) - 4} y1={sy(bh * 0.66)} y2={sy(bh * 0.66)} stroke="#e0b07a" strokeWidth="1.2" />
            <line x1={sx(x - bw / 2) + 4} x2={sx(x + bw / 2) - 4} y1={sy(bh * 0.33)} y2={sy(bh * 0.33)} stroke="#e0b07a" strokeWidth="1.2" />
            <text x={sx(x - bw / 2) + 6} y={sy(bh) + fs} fontSize={fs - 2} fontWeight="700" fill="#92400e">
              {m} {T.kg}
            </text>

            {/* F split into F·cosβ and F·sinβ (head to tail) */}
            {showComp && (
              <>
                <ForceArrow x={c.x} y={c.y} dx={Fx} dy={0} color={FC.pull} width={2} head={9} dash="5 4" opacity={0.8} />
                <ForceArrow x={cxTip.x} y={cxTip.y} dx={0} dy={-Fy} color={FC.pull} width={2} head={9} dash="5 4" opacity={0.8} />
                {Fx > 30 && <SvgSym x={cosLab.x} y={cosLab.y + 4} text={S.Fx} color={FC.pull} fs={fs - 1.5} anchor="middle" weight={600} />}
                {Fy > 22 && <SvgSym x={sinLab.x} y={sinLab.y} text={S.Fy} color={FC.pull} fs={fs - 1.5} anchor={sinLab.anchor} weight={600} />}
                <AngleArc cx={c.x} cy={c.y} r={narrow ? 18 : 26} from={0} to={-rad(beta)} label="β" color={FC.pull} fs={fs} labelR={narrow ? 28 : 38} />
              </>
            )}
            <ForceArrow x={c.x} y={c.y} dx={0} dy={ph.mg * kF} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: c.x + 9, y: c.y + ph.mg * kF + 2, anchor: 'start' }} />
            <ForceArrow x={c.x} y={c.y} dx={0} dy={-ph.N * kF} color={FC.normal} label={S.N} fs={fs} box={box} />
            <ForceArrow x={c.x} y={c.y} dx={Fx} dy={-Fy} color={FC.pull} label={S.F} fs={fs} box={box} />
            <circle cx={c.x} cy={c.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            {/* friction acts along the floor, under the crate */}
            <ForceArrow x={c.x} y={floorY + 7} dx={-ph.fr * kF} dy={0} color={FC.fric} label={S.fr} fs={fs} box={box} labelAt={{ x: c.x - ph.fr * kF - 6, y: floorY + 12, anchor: 'end' }} />

            {/* velocity and acceleration, drawn in the floor band ahead of the crate */}
            {v > 0.02 && <ForceArrow x={sx(x + bw / 2)} y={kinY} dx={v * kv} dy={0} color={FC.vel} width={2.75} head={10} label={S.v} fs={fs} box={box} />}
            {ph.a > 0.02 && <ForceArrow x={sx(x + bw / 2)} y={kinY + 20} dx={ph.a * ka} dy={0} color={FC.acc} width={2.75} head={10} label={S.a} fs={fs} box={box} />}
          </>
        );
      }}
    </LabScene>
  );
}

/* ======================================================= free-body diagram */

function AngleFbd({ T, F, beta, ph }) {
  const L = T.angle;
  const dec = T.decimal;
  const S = T.sym;
  const F2 = (n) => `${num(n, 2, dec)} ${T.N}`;
  return (
    <FbdPaper title={L.fbd.title} height={250} ariaLabel={L.fbd.label(beta)}>
      {(W, H) => {
        const c = { x: W * 0.46, y: H * 0.54 };
        const fMax = Math.max(ph.mg, F, 1);
        const Lm = Math.min(W * 0.28, H * 0.36);
        const kF = Lm / fMax;
        const box = { w: W, h: H };
        const Fx = ph.Fx * kF;
        const Fy = ph.Fy * kF;
        const fTip = { x: c.x + Fx, y: c.y - Fy };
        const cxTip = { x: c.x + Fx, y: c.y };
        const sinLab = sideLabel(cxTip, fTip, c, 9);
        const half = 14;
        const comp = beta >= 2 && F > 0;
        return (
          <>
            <line x1={c.x - 120} x2={c.x + 120} y1={c.y + half * 0.7} y2={c.y + half * 0.7} stroke="#cbd5e1" strokeWidth="2" />
            <rect x={c.x - half} y={c.y - half * 0.7} width={half * 2} height={half * 1.4} rx={3} fill="#fdecd2" stroke="#e0b07a" />
            <FbdAxis x={c.x} y={c.y} ux={1} uy={0} len={Lm * 1.3} back={0.7} label="x" />
            <FbdAxis x={c.x} y={c.y} ux={0} uy={-1} len={Lm * 1.25} back={0.15} label="y" />
            {comp && (
              <>
                <ForceArrow x={c.x} y={c.y} dx={Fx} dy={0} color={FC.pull} width={1.8} head={8} dash="4 3" opacity={0.85} />
                <ForceArrow x={cxTip.x} y={cxTip.y} dx={0} dy={-Fy} color={FC.pull} width={1.8} head={8} dash="4 3" opacity={0.85} />
                {Fy > 20 && <SvgSym x={sinLab.x} y={sinLab.y} text={S.Fy} color={FC.pull} fs={11} anchor={sinLab.anchor} weight={600} />}
                {Fx > 30 && <SvgSym x={c.x + Fx / 2} y={c.y + 16} text={S.Fx} color={FC.pull} fs={11} weight={600} />}
                <AngleArc cx={c.x} cy={c.y} r={22} from={0} to={-rad(beta)} label="β" color={FC.pull} fs={12} labelR={33} />
              </>
            )}
            <ForceArrow x={c.x} y={c.y} dx={0} dy={ph.mg * kF} color={FC.weight} label={S.mg} value={F2(ph.mg)} fs={11.5} box={box} labelAt={{ x: c.x + 7, y: c.y + ph.mg * kF + 2, anchor: 'start' }} />
            <ForceArrow x={c.x} y={c.y} dx={0} dy={-ph.N * kF} color={FC.normal} label={S.N} value={F2(ph.N)} fs={11.5} box={box} labelAt={{ x: c.x - 7, y: c.y - ph.N * kF + 4, anchor: 'end' }} />
            <ForceArrow x={c.x} y={c.y} dx={Fx} dy={-Fy} color={FC.pull} label={S.F} value={F2(F)} fs={11.5} box={box} />
            <ForceArrow x={c.x} y={c.y} dx={-ph.fr * kF} dy={0} color={FC.fric} label={S.fr} value={F2(ph.fr)} fs={11.5} box={box} labelAt={{ x: c.x - ph.fr * kF - 6, y: c.y - 8, anchor: 'end' }} />
            <circle cx={c.x} cy={c.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
          </>
        );
      }}
    </FbdPaper>
  );
}

/* =========================================================== the method */

function AngleMethod({ T, m, F, beta, mu, ph, betaOpt }) {
  const L = T.angle;
  const M = L.method;
  const S = T.sym;
  const dec = T.decimal;
  const F2 = (n) => num(n, 2, dec);
  const fr = S.fr;
  const N = T.N;
  const sinS = fmt(ph.sb, 3, dec);
  const cosS = fmt(ph.cb, 3, dec);
  const muS = fmt(mu, 2, dec);
  return (
    <MethodPanel title={M.title} fbd={<AngleFbd T={T} F={F} beta={beta} ph={ph} />}>
      <Step n={1} title={M.s1}>
        <ForceChips
          items={[
            { sym: S.mg, color: FC.weight, text: FC.weightText },
            { sym: S.N, color: FC.normal, text: FC.normalText },
            { sym: S.F, color: FC.pull, text: FC.pullText },
            { sym: fr, color: FC.fric, text: FC.fricText },
          ]}
        />
      </Step>
      <Step n={2} title={M.s2}>
        <p className="mt-0.5">{M.axes}</p>
      </Step>
      <Step n={3} title={M.s3}>
        <Eq tag="Oy" sym="N + F·sinβ − mg = 0" nums={`N = ${F2(ph.mg)} − ${F}·${sinS} = ${F2(ph.mg - ph.Fy)} ${N}`} />
        {!ph.lift && <Eq tag="Ox" sym={ph.moves ? `F·cosβ − ${fr} = m·a` : `F·cosβ − ${fr} = 0`} nums={ph.moves ? `${F}·${cosS} − ${F2(ph.fr)} = ${m}·a` : `${fr} = ${F2(ph.Fx)} ${N}`} />}
        {ph.moves && <Eq tag="" sym={`${fr} = μN`} nums={`= ${muS}·${F2(ph.N)} = ${F2(ph.fr)} ${N}`} />}
      </Step>
      <Step n={4} title={M.s4}>
        {ph.lift && <p className="mt-0.5 text-[13px] text-rose-300">{M.lift}</p>}
        {!ph.lift && !ph.moves && <Eq sym="a = 0" nums={M.restCheck(F2(ph.Fx), F2(ph.frMax))} />}
        {ph.moves && <Eq sym="a = (F·cosβ − μN) / m" nums={`= (${F2(ph.Fx)} − ${F2(ph.fr)}) / ${m} =`} result={`${F2(ph.a)} ${T.ms2}`} />}
        <p className="mt-1.5 text-[12px] text-gray-400">
          <Sym>{M.best(fmt(betaOpt, 1, dec))}</Sym>
        </p>
      </Step>
    </MethodPanel>
  );
}

/* ================================================================ graph */

function AngleGraph({ T, m, F, mu, beta, a, betaOpt, aOpt, onPick }) {
  const L = T.angle;
  const dec = T.decimal;
  const { pts, yMax } = useMemo(() => {
    const out = [];
    let top = 0;
    for (let x = 0; x <= BETA_MAX; x += 1) {
      const p = anglePhysics(m, F, x, mu);
      if (p.lift) break;
      out.push({ x, y: p.a });
      top = Math.max(top, p.a);
    }
    return { pts: out, yMax: ceil4(top) };
  }, [m, F, mu]);
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'a', label: L.graph.a, color: '#fb923c', points: pts, dot: false },
        { id: 'best', label: L.graph.best, color: '#34d399', points: aOpt > 0 ? [{ x: betaOpt, y: aOpt }] : [] },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: beta, y: a }] },
      ]}
      xMax={BETA_MAX}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={beta}
      decimal={dec}
      height={300}
      onScrub={(x) => onPick(clamp(Math.round(x), 0, BETA_MAX))}
      note={L.graph.note(fmt(betaOpt, 1, dec))}
    />
  );
}
