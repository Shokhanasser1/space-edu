import { useState } from 'react';
import { CircleCheck, CircleQuestionMark, CircleX, Dumbbell, Equal, Hand, Lightbulb, Minus, Moon, Package, Plus, ShoppingBag } from 'lucide-react';

import { Explain, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { makeView } from '../kit/scene';
import {
  Chip,
  Crate,
  DispArrow,
  FC,
  ForceArrow,
  ForceScale,
  G,
  GroupLabel,
  Ground,
  LabScene,
  Panel,
  Person,
  PlayControls,
  RightAngle,
  SceneRow,
  Sym,
  TagPill,
  WC,
  num,
  sci,
  signKey,
  signed,
} from './MechanicalWork.parts';

/**
 * Tab 2 — who does work? Five everyday cases, each with a verdict for its
 * main force (the pupil guesses the sign first):
 *  lift   10 kg lifted 1 m at a steady speed: F = mg = 98 N, α = 0°  → A = +98 J (gravity −98 J)
 *  hold   the same load held still for 5 s: s = 0                     → A = 0, though the arm tires
 *  carry  a 5 kg bag carried 5 m on level ground: F = 49 N up, α = 90° → A = 0
 *  slide  a 10 kg crate slides to rest, μ = 0.25: F_ishq = 24.5 N over s = 4 m, α = 180° → A = −98 J
 *         (v₀ = √(2μgs) = 4.43 m/s, stops after t = v₀/(μg) = 1.81 s; mg and N are ⊥ s → 0)
 *  moon   the Moon's orbit: Earth's pull F ≈ 2.0·10²⁰ N always ⊥ v → A = 0
 *         (F = GMm/r² = 6.674e-11·5.972e24·7.342e22/(3.844e8)² ≈ 1.98e20 N; 2πr ≈ 2.42e9 m; T = 27.3 days)
 */

const M_BOX = 10;
const W_BOX = M_BOX * G; // 98 N
const M_BAG = 5;
const W_BAG = M_BAG * G; // 49 N
const LIFT_H = 1;
const LIFT_T = 2;
const HOLD_T = 5;
const CARRY_S = 5;
const CARRY_T = 4;
const MU = 0.25;
const FR = MU * W_BOX; // 24.5 N
const S_SLIDE = 4;
const DEC = MU * G; // 2.45 m/s²
const V0 = Math.sqrt(2 * DEC * S_SLIDE); // 4.43 m/s
const T_SLIDE = V0 / DEC; // 1.81 s
const MOON_F = (6.674e-11 * 5.972e24 * 7.342e22) / 3.844e8 ** 2; // ≈ 1.98e20 N
const MOON_R = 3.844e8;
const MOON_PATH = 2 * Math.PI * MOON_R; // ≈ 2.42e9 m
const MOON_DAYS = 27.32;
const DAYS_PER_S = 3;
const MOON_T = MOON_DAYS / DAYS_PER_S; // s on screen for one revolution

const SCEN = {
  lift: { icon: Dumbbell, dur: LIFT_T, F: W_BOX, s: LIFT_H, alpha: 0, A: W_BOX * LIFT_H, color: FC.pull },
  hold: { icon: Hand, dur: HOLD_T, F: W_BOX, s: 0, alpha: null, A: 0, color: FC.pull },
  carry: { icon: ShoppingBag, dur: CARRY_T, F: W_BAG, s: CARRY_S, alpha: 90, A: 0, color: FC.pull },
  slide: { icon: Package, dur: T_SLIDE, F: FR, s: S_SLIDE, alpha: 180, A: -FR * S_SLIDE, color: FC.fric },
  moon: { icon: Moon, dur: MOON_T, F: MOON_F, s: MOON_PATH, alpha: 90, A: 0, color: FC.weight },
};
/** The other forces on the body, with their own work (names and symbols come from TEXT). */
const OTHERS = {
  lift: [{ key: 'mg', alpha: 180, A: -W_BOX * LIFT_H }],
  hold: [{ key: 'mg', alpha: null, A: 0 }],
  carry: [{ key: 'mg', alpha: 90, A: 0 }],
  slide: [
    { key: 'mg', alpha: 90, A: 0 },
    { key: 'N', alpha: 90, A: 0 },
  ],
  moon: [],
};
const FORCE_COL = { mg: [FC.weight, FC.weightText], N: [FC.normal, FC.normalText] };
const IDS = Object.keys(SCEN);
const IDLE = { t: 0, running: false, done: false };

/** Displacement (path for the Moon) covered after t seconds of the scene. */
function travelled(id, t) {
  const sc = SCEN[id];
  const p = clamp(t / sc.dur, 0, 1);
  if (id === 'slide') {
    const tt = Math.min(t, T_SLIDE);
    return V0 * tt - (DEC * tt * tt) / 2;
  }
  return sc.s * p;
}

const colOf = (k) => ({ pos: WC.pos, zero: WC.zero, neg: WC.neg })[k];
const textOf = (k) => ({ pos: WC.posText, zero: WC.zeroText, neg: WC.negText })[k];

/* ==================================================================== sim */

export default function WhoSim({ T }) {
  const L = T.who;
  const dec = T.decimal;
  const [id, setId] = useState('lift');
  const [sim, setSim] = useState(IDLE);
  const [guess, setGuess] = useState(null);
  const sc = SCEN[id];

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(sc.dur, p.t + dt);
      const done = t >= sc.dur - 1e-9;
      return { t, running: !done, done };
    });
  });

  const pick = (v) => {
    setId(v);
    setSim(IDLE);
    setGuess(null);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => {
    setSim(IDLE);
    setGuess(null);
  };

  const revealed = guess !== null || sim.done;
  const answer = signKey(sc.A);
  const sNow = travelled(id, sim.t);

  const key = revealed ? `done_${id}` : sim.running ? 'run' : `idle_${id}`;
  const settled = useSettled(key, 120);
  const ex = L.explain;
  const text = settled === 'run' ? ex.run : ex[settled];
  const tone = settled.startsWith('done') ? colOf(answer) : settled === 'run' ? '#fbbf24' : '#22d3ee';

  const fText = id === 'moon' ? sci(sc.F, 1, dec) : num(sc.F, sc.F % 1 ? 1 : 0, dec);
  const sText = id === 'moon' ? sci(sNow, 2, dec) : fmt(sNow, id === 'carry' ? 1 : 2, dec);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.scenLabel}</GroupLabel>
          <Segmented
            label={L.scenLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={id}
            onChange={pick}
            options={IDS.map((k) => ({ value: k, label: L.scen[k].name, sub: L.scen[k].sub, icon: SCEN[k].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        renderScene={(fitH) => <WhoScene T={T} id={id} t={sim.t} running={sim.running} revealed={revealed} fitH={fitH} />}
        side={<VerdictPanel T={T} id={id} guess={guess} onGuess={setGuess} revealed={revealed} done={sim.done} />}
      />

      <Explain icon={Lightbulb} id={`${id}-${settled}`} tone={tone}>
        <Sym>{text}</Sym>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.F} symbol={<Sym>{id === 'slide' ? T.sym.fr : T.sym.F}</Sym>} value={fText} unit={T.N} accent={sc.color} textColor="#fff" sub={L.scen[id].mainName} />
        <Readout
          label={id === 'moon' ? L.readouts.path : L.readouts.s}
          symbol="s"
          value={sText}
          unit={T.m}
          accent={FC.disp}
          textColor={FC.dispText}
          sub={id === 'hold' ? L.sHold : id === 'moon' ? L.sMoon : L.sSub(fmt(sc.s, 0, dec))}
          active={sim.running}
        />
        <Readout label={L.readouts.alpha} symbol="α" value={sc.alpha === null ? '—' : `${sc.alpha}°`} accent="#22d3ee" textColor="#a5f3fc" sub={sc.alpha === null ? L.alphaNone : L.cosSub(num(Math.round(Math.cos((sc.alpha * Math.PI) / 180) * 1000) / 1000, 0, dec))} />
        <Readout
          label={L.readouts.A}
          symbol="A"
          value={revealed ? signed(sc.A, 0, dec) : '?'}
          unit={revealed ? T.J : undefined}
          accent={revealed ? colOf(answer) : '#64748b'}
          textColor={revealed ? textOf(answer) : '#94a3b8'}
          sub={revealed ? L.verdictShort[answer] : L.hidden}
          active={revealed}
        />
      </div>
    </div>
  );
}

/* ============================================================ the verdict */

function VerdictPanel({ T, id, guess, onGuess, revealed }) {
  const L = T.who;
  const dec = T.decimal;
  const sc = SCEN[id];
  const answer = signKey(sc.A);
  const right = guess === answer;
  const N = T.N;
  const fVal = id === 'moon' ? sci(sc.F, 1, dec) : num(sc.F, sc.F % 1 ? 1 : 0, dec);
  const sVal = id === 'moon' ? sci(sc.s, 1, dec) : fmt(sc.s, 0, dec);
  const cos = sc.alpha === null ? null : Math.round(Math.cos((sc.alpha * Math.PI) / 180));
  const cosS = cos === null ? '' : cos < 0 ? `(${num(cos, 0, dec)})` : num(cos, 0, dec);
  const nums = sc.s === 0 ? `= ${fVal} · 0 =` : `= ${fVal} · ${sVal} · ${cosS} =`;
  const others = OTHERS[id];
  return (
    <Panel>
      <p className="text-sm font-semibold text-gray-100">{L.guess.title}</p>
      <p className="mt-0.5 text-[13px] leading-snug text-gray-400">
        <Sym>{L.guess.question(L.scen[id].mainName)}</Sym>
      </p>
      <Segmented
        label={L.guess.title}
        className="mt-2 grid-cols-3"
        value={guess}
        onChange={onGuess}
        accent={guess ? colOf(guess) : '#22d3ee'}
        options={[
          { value: 'pos', label: 'A > 0', sub: L.guess.pos, icon: Plus },
          { value: 'zero', label: 'A = 0', sub: L.guess.zero, icon: Equal },
          { value: 'neg', label: 'A < 0', sub: L.guess.neg, icon: Minus },
        ]}
      />
      {guess && (
        <p className={`mt-2 flex items-center gap-1.5 text-[13px] font-semibold ${right ? 'text-emerald-300' : 'text-rose-300'}`} role="status">
          {right ? <CircleCheck size={16} aria-hidden="true" /> : <CircleX size={16} aria-hidden="true" />}
          {right ? L.guess.right : L.guess.wrong}
        </p>
      )}

      {revealed ? (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: `${colOf(answer)}88`, background: `${colOf(answer)}14` }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">{L.verdictTitle}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tabular-nums" style={{ color: textOf(answer) }}>
                A = {signed(sc.A, 0, dec)} {T.J}
              </span>
              <span className="text-[13px] text-gray-300">{L.verdict[answer]}</span>
            </p>
          </div>
          <ol className="space-y-1 text-[13px] text-gray-300">
            <CheckRow ok n={1} label={L.check.force} value={<Sym>{`${id === 'slide' ? T.sym.fr : T.sym.F} = ${fVal} ${N}`}</Sym>} />
            <CheckRow ok={sc.s > 0} n={2} label={id === 'moon' ? L.check.path : L.check.disp} value={sc.s > 0 ? `s = ${sVal} ${T.m}` : L.check.noDisp} />
            <CheckRow
              ok={sc.alpha !== null && sc.alpha !== 90}
              n={3}
              label={L.check.angle}
              value={sc.alpha === null ? '—' : `α = ${sc.alpha}° → cos α = ${num(cos, 0, dec)}`}
              warn={sc.alpha === 90}
            />
          </ol>
          <div className="rounded-xl bg-black/25 px-3 py-2">
            <p className="font-serif text-[15px] italic text-gray-100">A = F·s·cosα</p>
            <p className="text-[13.5px] tabular-nums text-gray-400">
              <Sym>{nums}</Sym>{' '}
              <b style={{ color: textOf(answer) }}>
                {signed(sc.A, 0, dec)} {sc.A === 0 ? '' : T.J}
              </b>
            </p>
          </div>
          {others.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{L.othersTitle}</p>
              <ul className="mt-1 space-y-1">
                {others.map((o) => {
                  const k = signKey(o.A);
                  const [col, txt] = FORCE_COL[o.key];
                  return (
                    <li key={o.key} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[13px]">
                      <span className="rounded-md border px-1.5 font-serif italic" style={{ borderColor: `${col}88`, background: `${col}22`, color: txt }}>
                        <Sym>{T.sym[o.key]}</Sym>
                      </span>
                      <span className="min-w-0 flex-1 truncate text-gray-400">{L.forceNames[o.key]}</span>
                      <span className="tabular-nums text-gray-500">{o.alpha === null ? 's = 0' : `α = ${o.alpha}°`}</span>
                      <b className="w-16 text-right tabular-nums" style={{ color: textOf(k) }}>
                        {signed(o.A, 0, dec)} {o.A === 0 ? '' : T.J}
                      </b>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-dashed border-white/15 px-3 py-4 text-[13px] text-gray-400">
          <CircleQuestionMark size={20} className="mt-0.5 shrink-0 text-cyan-300" aria-hidden="true" />
          <p className="leading-snug">{L.placeholder}</p>
        </div>
      )}
    </Panel>
  );
}

function CheckRow({ ok, warn, n, label, value }) {
  const col = warn ? '#fbbf24' : ok ? '#34d399' : '#fb7185';
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold" style={{ background: `${col}26`, color: col }} aria-hidden="true">
        {n}
      </span>
      <span className="w-[86px] shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 flex-1 tabular-nums text-gray-100">{value}</span>
    </li>
  );
}

/* ================================================================= scene */

function WhoScene({ T, id, t, running, revealed, fitH }) {
  const L = T.who;
  const dec = T.decimal;
  const S = T.sym;
  const lg = L.legend;
  const legend =
    id === 'moon'
      ? [
          { color: FC.weight, label: lg.grav, kind: 'arrow' },
          { color: FC.vel, label: lg.v, kind: 'arrow' },
          { color: '#7c3aed', label: lg.orbit, kind: 'line' },
        ]
      : id === 'slide'
        ? [
            { color: FC.fric, label: lg.fr, kind: 'arrow' },
            { color: FC.weight, label: lg.mg, kind: 'arrow' },
            { color: FC.normal, label: lg.N, kind: 'arrow' },
            { color: FC.vel, label: lg.v, kind: 'arrow' },
            { color: FC.disp, label: lg.s, kind: 'arrow' },
          ]
        : [
            { color: FC.pull, label: lg.F, kind: 'arrow' },
            { color: FC.weight, label: lg.mg, kind: 'arrow' },
            { color: FC.disp, label: lg.s, kind: 'arrow' },
          ];
  const lmaxOf = (narrow) => (id === 'slide' ? (narrow ? 70 : 124) : id === 'carry' ? (narrow ? 40 : 62) : narrow ? 48 : 76);
  const fScale = id === 'carry' ? W_BAG : W_BOX;
  return (
    <LabScene
      legend={legend}
      chips={(W, narrow) => (
        <>
          {id === 'moon' ? (
            <>
              <Chip>{L.moonTime(fmt(DAYS_PER_S, 0, dec), fmt(Math.min(t, MOON_T) * DAYS_PER_S, 1, dec))}</Chip>
              <Chip icon={null}>{L.notToScale}</Chip>
            </>
          ) : (
            <>
              <Chip>
                {L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
              </Chip>
              <ForceScale kF={lmaxOf(narrow) / fScale} label={T.scale} unit={T.N} decimal={dec} />
            </>
          )}
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? { lift: 330, hold: 330, carry: 250, slide: 300, moon: 330 }[id] : 452)}
      ariaLabel={L.sceneLabel[id]}
    >
      {(W, H, narrow) => {
        const props = { W, H, narrow, t, running, revealed, T, S, dec, lmax: lmaxOf(narrow) };
        if (id === 'lift' || id === 'hold') return <LiftDrawing {...props} hold={id === 'hold'} />;
        if (id === 'carry') return <CarryDrawing {...props} />;
        if (id === 'slide') return <SlideDrawing {...props} />;
        return <MoonDrawing {...props} />;
      }}
    </LabScene>
  );
}

/* ------------------------------------------------------- lift and hold */

function LiftDrawing({ W, H, narrow, t, running, revealed, T, S, dec, lmax, hold }) {
  const L = T.who;
  const view = makeView({ x0: -1.35, x1: 1.95, y0: -0.3, y1: 2.9 }, W, H, { l: 10, r: 10, t: narrow ? 40 : 56, b: 6 });
  const { sx, sy, k } = view;
  const fs = narrow ? 11 : 12.5;
  const box = { w: W, h: H };
  const kF = lmax / W_BOX;
  const p = hold ? 1 : clamp(t / LIFT_T, 0, 1);
  const fatigue = hold ? clamp(t / HOLD_T, 0, 1) : 0;
  const jit = hold && running ? Math.sin(t * 47) * 1.4 * fatigue : 0;
  const bw = 0.6;
  const bh = 0.36;
  const bx = 0.45;
  const yb = 0.95 + LIFT_H * p; // the hands, under the box
  const c = { x: sx(bx), y: sy(yb + bh / 2) + jit };
  const floorY = sy(0);
  const yStart = sy(0.95 + bh / 2);
  const dX = sx(1.02);
  return (
    <>
      <Ground W={W} y={floorY} depth={H - floorY} />
      {!hold && <Crate x={sx(bx - bw / 2)} y={sy(0.95 + bh)} w={bw * k} h={bh * k} ghost />}
      <Person x={sx(0)} y={floorY} k={k} hand={{ x: sx(bx - 0.15), y: sy(yb) + jit }} back={{ x: sx(bx - 0.08), y: sy(yb) + jit }} />
      {running && <rect x={c.x - (bw * k) / 2 - 5} y={c.y - (bh * k) / 2 - 5} width={bw * k + 10} height={bh * k + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
      <Crate x={c.x - (bw * k) / 2} y={c.y - (bh * k) / 2} w={bw * k} h={bh * k} label={`${M_BOX} ${T.kg}`} fs={fs - 2.5} corner />

      <ForceArrow x={c.x} y={c.y} dx={0} dy={-W_BOX * kF} color={FC.pull} label={S.F} fs={fs} box={box} labelAt={{ x: c.x - 8, y: c.y - W_BOX * kF + 4, anchor: 'end' }} />
      <ForceArrow x={c.x} y={c.y} dx={0} dy={W_BOX * kF} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: c.x + 8, y: c.y + W_BOX * kF, anchor: 'start' }} />
      <circle cx={c.x} cy={c.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />

      {/* displacement */}
      {!hold && p > 0.01 && (
        <>
          <line x1={dX - 7} x2={dX + 7} y1={yStart} y2={yStart} stroke={FC.disp} strokeWidth="1.6" />
          <ForceArrow x={dX} y={yStart} dx={0} dy={c.y - yStart} color={FC.disp} width={2.6} head={10} />
          <TagPill x={dX + (narrow ? 34 : 44)} y={(yStart + c.y) / 2} text={`s = ${fmt(LIFT_H * p, 2, dec)} ${T.m}`} bg={FC.disp} fs={fs - 0.5} box={box} />
        </>
      )}
      {hold && <TagPill x={dX + (narrow ? 26 : 34)} y={c.y} text={L.sZeroTag} bg={FC.disp} fs={fs - 0.5} box={box} />}
      {revealed && !hold && <TagPill x={dX + (narrow ? 30 : 44)} y={c.y - W_BOX * kF * 0.75} text={L.tagSame} bg="#0f172a" fs={fs - 1} box={box} />}

      {/* fatigue meter while holding */}
      {hold && (
        <g>
          <text x={sx(1.78)} y={sy(1.95) - 8} textAnchor="middle" fontSize={fs - 1.5} fontWeight="700" fill="#9a3412">
            {L.fatigue}
          </text>
          <rect x={sx(1.78) - 8} y={sy(1.95)} width={16} height={(1.95 - 0.35) * k} rx={8} fill="#ffedd5" stroke="#fdba74" />
          <rect x={sx(1.78) - 8} y={sy(0.35) - fatigue * (1.6 * k)} width={16} height={fatigue * 1.6 * k} rx={8} fill="#f97316" />
        </g>
      )}
    </>
  );
}

/* --------------------------------------------------------------- carry */

function CarryDrawing({ W, H, narrow, t, running, revealed, T, S, dec, lmax }) {
  const L = T.who;
  const view = makeView({ x0: -0.85, x1: 6.35, y0: -0.8, y1: 2.0 }, W, H, { l: 8, r: 8, t: narrow ? 46 : 60, b: 4 });
  const { sx, sy, k } = view;
  const fs = narrow ? 11 : 12.5;
  const box = { w: W, h: H };
  const kF = lmax / W_BAG;
  const px = travelled('carry', t);
  const walk = running || (t > 0 && t < CARRY_T) ? (px / 0.62) * Math.PI : null;
  const floorY = sy(0);
  const hand = { x: sx(px + 0.1), y: sy(0.8) };
  const bw = 0.42;
  const bh = 0.32;
  const c = { x: sx(px + 0.1), y: sy(0.3 + bh / 2) };
  const dispY = floorY + 0.55 * k;
  return (
    <>
      <Ground W={W} y={floorY} depth={H - floorY} />
      <line x1={sx(0.1)} x2={sx(0.1)} y1={floorY - 10} y2={floorY + 2} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1={sx(CARRY_S + 0.1)} x2={sx(CARRY_S + 0.1)} y1={floorY - 16} y2={floorY} stroke="#16a34a" strokeWidth="2.2" />
      <Person x={sx(px)} y={floorY} k={k} hand={hand} walk={walk} />
      {/* bag on its handle */}
      <path d={`M${hand.x - 0.08 * k},${sy(0.62)} Q${hand.x},${hand.y - 0.1 * k} ${hand.x + 0.08 * k},${sy(0.62)}`} fill="none" stroke="#7c2d12" strokeWidth={Math.max(2, 0.025 * k)} />
      <rect x={c.x - (bw * k) / 2} y={sy(0.62)} width={bw * k} height={bh * k} rx={0.06 * k} fill="#fb923c" stroke="#9a3412" strokeWidth="1.8" />
      <text x={c.x} y={c.y + fs * 0.36} textAnchor="middle" fontSize={fs - 2} fontWeight="700" fill="#7c2d12">
        {M_BAG} {T.kg}
      </text>
      <ForceArrow x={c.x} y={c.y} dx={0} dy={-W_BAG * kF} color={FC.pull} label={S.F} fs={fs} box={box} labelAt={{ x: c.x + 8, y: c.y - W_BAG * kF + 6, anchor: 'start' }} />
      <ForceArrow x={c.x} y={c.y} dx={0} dy={W_BAG * kF} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: c.x + 8, y: Math.min(c.y + W_BAG * kF, H - 4), anchor: 'start' }} />
      <circle cx={c.x} cy={c.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
      {revealed && (
        <>
          <line x1={c.x} y1={c.y} x2={c.x + (narrow ? 40 : 60)} y2={c.y} stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="5 4" />
          <RightAngle x={c.x} y={c.y} ax={1} ay={0} bx={0} by={-1} size={narrow ? 9 : 12} color="#0891b2" />
          <TagPill x={c.x + (narrow ? 58 : 84)} y={c.y - (narrow ? 26 : 34)} text={L.tagPerp} bg="#0f172a" fs={fs - 1} box={box} />
        </>
      )}
      <DispArrow x1={sx(0.1)} x2={sx(px + 0.1)} y={dispY} label={px > 0.05 ? `s = ${fmt(px, 1, dec)} ${T.m}` : null} fs={fs} box={box} />
    </>
  );
}

/* --------------------------------------------------------------- slide */

function SlideDrawing({ W, H, narrow, t, running, revealed, T, S, dec, lmax }) {
  const L = T.who;
  const floorY = H - (narrow ? 104 : 158);
  const padL = narrow ? 16 : 40;
  const padR = narrow ? 30 : 70;
  const x0 = -0.6;
  const x1 = 5.0;
  const k = (W - padL - padR) / (x1 - x0);
  const sx = (u) => padL + (u - x0) * k;
  const sy = (v) => floorY - v * k;
  const fs = narrow ? 11 : 12.5;
  const box = { w: W, h: H };
  const kF = lmax / W_BOX;
  const x = travelled('slide', t);
  const v = Math.max(0, V0 - DEC * Math.min(t, T_SLIDE));
  const bw = 0.72;
  const bh = 0.46;
  const c = { x: sx(x), y: sy(bh / 2) };
  const dispY = floorY + (narrow ? 78 : 128);
  return (
    <>
      <Ground W={W} y={floorY} depth={H - floorY} />
      <line x1={sx(0)} x2={sx(0)} y1={floorY - 10} y2={floorY + 2} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="2 2" />
      <line x1={sx(S_SLIDE)} x2={sx(S_SLIDE)} y1={floorY - 16} y2={floorY} stroke="#16a34a" strokeWidth="2.2" />
      {running && <rect x={c.x - (bw * k) / 2 - 5} y={sy(bh) - 5} width={bw * k + 10} height={bh * k + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
      <Crate x={c.x - (bw * k) / 2} y={sy(bh)} w={bw * k} h={bh * k} label={`${M_BOX} ${T.kg}`} fs={fs - 2.5} corner />
      <ForceArrow x={c.x} y={c.y} dx={0} dy={-W_BOX * kF} color={FC.normal} label={S.N} fs={fs} box={box} labelAt={{ x: c.x + 8, y: c.y - W_BOX * kF + 8, anchor: 'start' }} />
      <ForceArrow x={c.x} y={c.y} dx={0} dy={W_BOX * kF} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: c.x + 8, y: c.y + W_BOX * kF, anchor: 'start' }} />
      <circle cx={c.x} cy={c.y} r={3.2} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
      {v > 0.02 && (
        <ForceArrow
          x={c.x + (bw * k) / 2 + 4}
          y={sy(bh * 0.72)}
          dx={v * (narrow ? 9 : 14)}
          dy={0}
          color={FC.vel}
          width={2.75}
          head={10}
          label={S.v}
          value={`${fmt(v, 1, dec)} ${T.ms}`}
          fs={fs - 0.5}
          box={box}
        />
      )}
      {/* friction acts along the floor, against the motion */}
      <ForceArrow
        x={c.x - (bw * k) / 2}
        y={floorY - 4}
        dx={-FR * kF}
        dy={0}
        color={FC.fric}
        width={3.4}
        label={S.fr}
        fs={fs}
        box={box}
        labelAt={{ x: c.x - (bw * k) / 2 - FR * kF - 6, y: floorY - 6, anchor: 'end' }}
      />
      {revealed && <TagPill x={c.x - (narrow ? 40 : 70)} y={sy(bh) - (narrow ? 22 : 30)} text={L.tagOpp} bg="#0f172a" fs={fs - 1} box={box} />}
      <DispArrow x1={sx(0)} x2={sx(x)} y={dispY} label={x > 0.05 ? `s = ${fmt(x, 2, dec)} ${T.m}` : null} fs={fs} box={box} />
    </>
  );
}

/* ---------------------------------------------------------------- moon */

function MoonDrawing({ W, H, narrow, t, running, revealed, T, S }) {
  const L = T.who;
  const top = narrow ? 50 : 66;
  const cx = W / 2;
  const cy = top + (H - top) / 2;
  const Ro = Math.min(W * 0.36, (H - top) / 2 - 18);
  const Re = Ro * 0.24;
  const Rm = Math.max(7, Ro * 0.075);
  const th0 = (-25 * Math.PI) / 180;
  const th = th0 + (2 * Math.PI * Math.min(t, MOON_T)) / MOON_T;
  const m = { x: cx + Ro * Math.cos(th), y: cy - Ro * Math.sin(th) };
  const toE = { x: (cx - m.x) / Ro, y: (cy - m.y) / Ro };
  const vel = { x: -Math.sin(th), y: -Math.cos(th) };
  const fl = Ro * 0.42;
  const vl = Ro * 0.4;
  const fs = narrow ? 11 : 12.5;
  const box = { w: W, h: H };
  const arcPts = [];
  for (let a = th0; a <= th + 1e-6; a += 0.04) arcPts.push(`${(cx + Ro * Math.cos(a)).toFixed(1)},${(cy - Ro * Math.sin(a)).toFixed(1)}`);
  arcPts.push(`${m.x.toFixed(1)},${m.y.toFixed(1)}`);
  return (
    <>
      <circle cx={cx} cy={cy} r={Ro} fill="none" stroke="#94a3b8" strokeWidth="1.4" strokeDasharray="5 6" />
      {arcPts.length > 2 && <polyline points={arcPts.join(' ')} fill="none" stroke="#7c3aed" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Earth */}
      <circle cx={cx} cy={cy} r={Re} fill="#3b82f6" />
      <path
        d={`M${cx - Re * 0.55},${cy - Re * 0.35} q${Re * 0.3},${-Re * 0.35} ${Re * 0.6},${-Re * 0.1} q${Re * 0.15},${Re * 0.3} ${-Re * 0.15},${Re * 0.5} q${-Re * 0.35},${Re * 0.1} ${-Re * 0.45},${-Re * 0.4} Z`}
        fill="#22c55e"
      />
      <path d={`M${cx + Re * 0.15},${cy + Re * 0.2} q${Re * 0.35},${-Re * 0.05} ${Re * 0.5},${Re * 0.3} q${-Re * 0.1},${Re * 0.3} ${-Re * 0.4},${Re * 0.25} Z`} fill="#22c55e" />
      <text x={cx} y={cy + Re + fs + 4} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#1e3a8a" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {L.earth}
      </text>
      {/* the Moon and its forces */}
      {running && <circle cx={m.x} cy={m.y} r={Rm + 7} fill="#7c3aed" className="cl-pulse" />}
      <circle cx={m.x} cy={m.y} r={Rm} fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
      <circle cx={m.x - Rm * 0.3} cy={m.y - Rm * 0.2} r={Rm * 0.22} fill="#94a3b8" />
      <circle cx={m.x + Rm * 0.35} cy={m.y + Rm * 0.25} r={Rm * 0.16} fill="#94a3b8" />
      <ForceArrow x={m.x} y={m.y} dx={toE.x * fl} dy={toE.y * fl} color={FC.weight} label={S.F} fs={fs} box={box} />
      <ForceArrow x={m.x} y={m.y} dx={vel.x * vl} dy={vel.y * vl} color={FC.vel} label={S.v} fs={fs} box={box} width={2.8} />
      {revealed && (
        <>
          <RightAngle x={m.x} y={m.y} ax={toE.x} ay={toE.y} bx={vel.x} by={vel.y} size={narrow ? 10 : 13} color="#0891b2" />
          <TagPill x={cx} y={cy + Re + fs + (narrow ? 26 : 32)} text={L.tagPerpV} bg="#0f172a" fs={fs - 1} box={box} />
        </>
      )}
      <text x={m.x + Rm + 6} y={m.y + Rm + fs + 2} fontSize={fs - 1.5} fontWeight="700" fill="#475569" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {L.moon}
      </text>
    </>
  );
}
