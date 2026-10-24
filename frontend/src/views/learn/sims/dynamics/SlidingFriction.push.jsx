import { useState } from 'react';
import { CloudRain, Lightbulb, Ruler as RulerIcon, Snowflake, Sun, TreePine } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, fmt, niceStep, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE, TimeGraph } from '../kit/scene';
import {
  Block,
  Chip,
  FORCE,
  FORCE_TEXT,
  FormulaTile,
  G,
  Ground,
  GroupLabel,
  LabScene,
  PaperGrid,
  PlayControls,
  Rich,
  Ruler,
  ScaleBar,
  VecArrow,
  lineView,
  niceMax,
  round,
  rulerStep,
  tickDigits,
  trim,
} from './SlidingFriction.parts';

/**
 * Tab 1 — a pushed block slides and stops. Two blocks get the same v₀ on
 * the same surface: block 1 has mass m, block 2 is two such blocks stacked
 * (2m). Friction F = μmg points against the velocity; on block 2 it is twice
 * as large, but so is the mass, so both decelerate with a = μg and stop after
 * s = v₀²/(2μg). Preset: wood on wood, μ = 0.25, v₀ = 5 m/s →
 * a = 2.45 m/s², t = 2.04 s, s = 5.10 m. Strings come from T.push.
 */

export const SURFACES = {
  wood: { mu: 0.25, block: 'wood', ground: 'wood', icon: TreePine },
  dry: { mu: 0.7, block: 'rubber', ground: 'dry', icon: Sun },
  wet: { mu: 0.4, block: 'rubber', ground: 'wet', icon: CloudRain },
  ice: { mu: 0.02, block: 'steel', ground: 'ice', icon: Snowflake },
};
const IDLE = { t: 0, running: false, done: false };
const STROBE = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];

export default function PushSim({ T }) {
  const L = T.push;
  const dec = T.decimal;
  const [surf, setSurf] = useState('wood');
  const [v0, setV0] = useState(5);
  const [m, setM] = useState(2);
  const [sim, setSim] = useState(IDLE);

  const mu = SURFACES[surf].mu;
  const a = mu * G;
  const tStop = v0 / a;
  const sStop = (v0 * v0) / (2 * a);
  const speedUp = tStop > 8 ? Math.ceil(tStop / 6) : 1;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tStop, p.t + dt * speedUp);
      const done = t >= tStop - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (n) => {
    setter(n);
    setSim(IDLE);
  };

  const t = sim.t;
  const sliding = !sim.done;
  const v = Math.max(0, v0 - a * t);
  const x = Math.min(sStop, v0 * t - 0.5 * a * t * t);
  const F1 = mu * m * G;
  const F2 = 2 * F1;
  const S = (n) => round(n, n < 10 ? 2 : 1, dec);
  const D = (n) => trim(n, dec);
  const Ff = (n) => trim(n, dec, 2);

  /* explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (t > 0) key = t < 0.45 * tStop ? 'slide' : 'speed';
  const settled = useSettled(key, key === 'slide' || key === 'speed' ? 300 : 0);
  const ex = L.explain;
  const text = {
    idle: ex.idle,
    slide: ex.slide(Ff(F1), Ff(F2), D(a)),
    speed: ex.speed,
    done: `${ex.done(S(sStop))}${ex.tail[surf]}`,
  }[settled];
  const tone = { idle: '#22d3ee', slide: '#f87171', speed: '#fb923c', done: '#34d399' }[settled];

  const vTop = niceMax(v0);
  const tTop = niceMax(tStop);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.surfaceLabel}</GroupLabel>
          <Segmented
            label={L.surfaceLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={surf}
            onChange={change(setSurf)}
            options={Object.keys(SURFACES).map((id) => ({ value: id, label: L.surfaces[id].name, sub: L.surfaces[id].sub, icon: SURFACES[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <PushScene T={T} surf={surf} m={m} v0={v0} t={t} x={x} v={v} a={a} sStop={sStop} tStop={tStop} sliding={sliding} speedUp={speedUp} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.F}
          symbol={<Rich>{`F_{${T.sym.fr}}`}</Rich>}
          value={Ff(sliding ? F1 : 0)}
          unit={T.N}
          accent={FORCE.fr}
          textColor={FORCE_TEXT.fr}
          sub={sliding ? L.FSub(Ff(F2)) : L.FStop}
        />
        <Readout label={L.readouts.a} symbol="a" value={sliding ? D(a) : '0'} unit={T.ms2} accent={PALETTE.acc} textColor={PALETTE.accText} sub={L.aSub} />
        <Readout label={L.readouts.v} symbol="v" value={fmt(v, 2, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={L.vSub(round(tStop, 2, dec))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(v / v0) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={L.readouts.s} symbol="s" value={fmt(x, 2, dec)} unit={T.m} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={L.sSub(S(sStop))} active={sim.done} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-200">{L.formulasTitle}</p>
          {sim.done && <p className="text-xs font-semibold text-emerald-300">✓ {L.sameBoth}</p>}
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-3">
          <FormulaTile
            tag={L.f1}
            color={FORCE_TEXT.fr}
            general={`F_{${T.sym.fr}} = μN = μmg`}
            filled={`= ${D(mu)} · ${D(m)} · ${D(G)}`}
            result={`F_{${T.sym.fr}} = ${Ff(F1)} ${T.N}`}
          />
          <FormulaTile tag={L.f2} color={PALETTE.accText} general={`a = F_{${T.sym.fr}} / m = μg`} filled={`= ${D(mu)} · ${D(G)}`} result={`a = ${D(a)} ${T.ms2}`} />
          <FormulaTile
            tag={L.f3}
            color={PALETTE.dispText}
            general="s = v₀² / (2a) = v₀² / (2μg)"
            filled={`= ${D(v0)}² / (2 · ${D(a)})`}
            result={`s = ${S(sStop)} ${T.m}`}
            ok={sim.done}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="slfr-v0"
            label={L.v0}
            symbol={<Rich>v₀</Rich>}
            min={1}
            max={10}
            step={0.5}
            value={v0}
            onChange={change(setV0)}
            accent={PALETTE.vel}
            display={`${fmt(v0, 1, dec)} ${T.ms}`}
            hint={L.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="slfr-m"
            label={L.m}
            symbol="m"
            min={1}
            max={10}
            step={1}
            value={m}
            onChange={change(setM)}
            accent={FORCE_TEXT.mg}
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={L.mHint(fmt(2 * m, 0, dec))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{L.info.title}</p>
            <dl className="mt-1.5 grid grid-cols-3 gap-2 text-center">
              {[
                [L.info.N1, `${Ff(m * G)} ${T.N}`, FORCE_TEXT.N],
                [L.info.N2, `${Ff(2 * m * G)} ${T.N}`, FORCE_TEXT.N],
                [L.info.F2, `${Ff(F2)} ${T.N}`, FORCE_TEXT.fr],
              ].map(([k, val, c]) => (
                <div key={k}>
                  <dt className="text-[11px] leading-tight text-gray-500">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold tabular-nums" style={{ color: c }}>
                    {val}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={L.graph.title}
            series={[
              { id: 'plan', label: L.graph.plan, color: '#475569', points: [{ x: 0, y: v0 }, { x: tStop, y: 0 }], dash: '4 5', dot: false },
              { id: 'live', label: L.graph.live, color: '#6ee7b7', points: [{ x: 0, y: v0 }, { x: t, y: v }] },
            ]}
            fill={{ id: 'live', color: '#60a5fa', opacity: 0.28 }}
            xMax={tTop}
            yMax={vTop}
            xLabel={L.graph.t}
            yLabel={L.graph.v}
            marker={t}
            note={L.graph.note(D(a))}
            decimal={dec}
            xDigits={tickDigits(tTop)}
            yDigits={tickDigits(vTop)}
            height={220}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

/** Vertical layout of the two lanes, shared by the height callback and the drawing. */
function layout(narrow) {
  const bw = narrow ? 44 : 70;
  const bh = narrow ? 20 : 30;
  const Lmax = narrow ? 56 : 84; // px of the largest force, block 2's weight 2mg
  const top = narrow ? 76 : 62;
  const groundD = narrow ? 10 : 14;
  const yA = top + 22 + Math.max(bh, Lmax / 2);
  const mgATip = yA - bh / 2 + Lmax / 2;
  const yB = mgATip + 18 + Lmax + (narrow ? 8 : 14);
  const mgBTip = yB - bh + Lmax;
  const rulerY = Math.max(mgBTip + 14, yB + groundD + 18) + 6;
  return { bw, bh, Lmax, top, groundD, yA, yB, mgATip, rulerY, H: rulerY + 30 };
}

function PushScene({ T, surf, m, v0, t, x, v, a, sStop, tStop, sliding, speedUp }) {
  const L = T.push;
  const dec = T.decimal;
  const def = SURFACES[surf];
  const mu = def.mu;
  const dt = STROBE.find((d) => tStop / d <= 10) ?? 10;
  const fr = T.sym.fr;

  /* force scale: block 2's weight 2mg gets Lmax px; the chip shows a round value */
  const kFor = (narrow) => layout(narrow).Lmax / (2 * m * G);

  return (
    <LabScene
      legend={[
        { color: FORCE.mg, label: L.legend.mg, kind: 'arrow' },
        { color: FORCE.N, label: L.legend.N, kind: 'arrow' },
        { color: FORCE.fr, label: L.legend.fr, kind: 'arrow' },
        { color: PALETTE.vel, label: L.legend.v, kind: 'arrow' },
        { color: PALETTE.acc, label: L.legend.a, kind: 'arrow' },
        { color: '#64748b', label: L.legend.ghost(trim(dt, dec)), kind: 'ghost' },
      ]}
      chips={(W, narrow) => {
        const kF = kFor(narrow);
        const scaleN = niceStep(kF, narrow ? 20 : 26);
        return (
          <>
            <Chip>
              {speedUp > 1 ? L.chipFast(speedUp) : L.chipReal} · t = {fmt(t, 1, dec)} {T.s}
            </Chip>
            <Chip icon={RulerIcon} color={FORCE.mg}>
              <ScaleBar px={scaleN * kF} label={L.scaleLabel(trim(scaleN, dec))} />
            </Chip>
          </>
        );
      }}
      height={(W, narrow) => layout(narrow).H}
      ariaLabel={L.sceneLabel(fmt(t, 1, dec), fmt(x, 2, dec), fmt(v, 2, dec))}
    >
      {(W, H, narrow) => {
        const lay = layout(narrow);
        const { bw, bh, Lmax, groundD, yA, yB, mgATip, rulerY } = lay;
        const fs = narrow ? 11 : 13;
        const kF = kFor(narrow); // px per newton in this drawing
        const kv = narrow ? 5 : 7.5; // px per m/s
        const ka = narrow ? 5.5 : 8; // px per m/s²
        const padL = bw + (narrow ? 14 : 26);
        const padR = narrow ? 18 : 28;
        const view = lineView(0, sStop * (narrow ? 1.32 : 1.2), W, padL, padR);
        const step = rulerStep(view, narrow ? 46 : 64);
        const ox = view.sx(0);
        const front = view.sx(x);
        const stopX = view.sx(sStop);
        const box = { w: W, h: H };

        const ghosts = [];
        for (let k = 1; k * dt < Math.min(t, tStop) - 1e-9; k += 1) {
          const tk = k * dt;
          ghosts.push(view.sx(v0 * tk - 0.5 * a * tk * tk));
        }

        /** one lane: the floor, ghost outlines, the block (or stack) and its arrows */
        const lane = (yF, stack, seed) => {
          const hTot = bh * stack;
          const back = front - bw;
          const cx = front - bw / 2;
          const yTop = yF - hTot;
          const W1 = stack * m * G; // weight = normal force of this block
          const Ffr = sliding ? mu * W1 : 0;
          return (
            <g key={`lane${stack}`}>
              <Ground x0={0} x1={W} y={yF} depth={groundD} kind={def.ground} seed={seed} />
              {ghosts.map((gx, i) => (
                <Block key={i} x={gx - bw} y={yTop} w={bw} h={hTot} kind={def.block} ghost />
              ))}
              {Array.from({ length: stack }, (_, i) => (
                <Block key={`b${i}`} x={back} y={yF - bh * (i + 1)} w={bw} h={bh} kind={def.block} />
              ))}
              {/* weight from the centre, normal force from the contact surface */}
              <VecArrow x={cx - 6} y={yF - hTot / 2} dx={0} dy={W1 * kF} color={FORCE.mg} main="mg" fs={fs} place="right" />
              <VecArrow x={cx + 6} y={yF} dx={0} dy={-W1 * kF} color={FORCE.N} main="N" fs={fs} place="right" />
              {/* friction at the contact surface, against the velocity */}
              {sliding && <VecArrow x={back} y={yF - 3} dx={-Ffr * kF} dy={0} color={FORCE.fr} main="F" sub={fr} fs={fs} place="left" />}
              {sliding && a * ka >= 1 && <VecArrow x={cx} y={yTop - 9} dx={-a * ka} dy={0} color={PALETTE.acc} main="a" fs={fs} place="left" width={2.6} />}
              {v > 0.01 && <VecArrow x={front + 3} y={yF - hTot / 2} dx={v * kv} dy={0} color={PALETTE.vel} main="v" fs={fs} place="right" width={2.8} />}
            </g>
          );
        };

        const stopText = L.stopTag(round(sStop, sStop < 10 ? 2 : 1, dec));
        const stopW = textWidth(stopText, fs - 1, 600) + 16;
        const gapY = (mgATip + 16 + (yB - Lmax)) / 2;
        const stopRight = stopX + 8 + stopW < W - 4;

        return (
          <>
            <rect width={W} height={H} fill="#fbfcfe" />
            <PaperGrid view={view} W={W} top={0} bottom={rulerY - 4} step={step} rowPx={narrow ? 24 : 28} />
            {/* start line and the predicted stopping point */}
            <line x1={ox} x2={ox} y1={yA - bh - 18} y2={rulerY} stroke={PALETTE.ink} strokeWidth={1.6} strokeDasharray="4 4" opacity={0.7} />
            <line x1={stopX} x2={stopX} y1={yA - bh - 18} y2={rulerY} stroke={PALETTE.disp} strokeWidth={1.8} strokeDasharray="6 4" />
            {lane(yA, 1, 1)}
            {lane(yB, 2, 2)}
            {[
              [yA, L.tag1(fmt(m, 0, dec))],
              [yB, L.tag2(fmt(2 * m, 0, dec))],
            ].map(([yy, tg]) => (
              <text key={tg} x={W - 8} y={yy - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#334155" stroke="#fbfcfe" strokeWidth={3} paintOrder="stroke">
                {tg}
              </text>
            ))}
            <Pill x={stopRight ? stopX + 8 + stopW / 2 : stopX - 8 - stopW / 2} y={gapY} text={stopText} bg={PALETTE.disp} size={fs - 1} box={box} />
            {/* ruler with the distance covered */}
            <rect x={0} y={rulerY - 1} width={W} height={H - rulerY + 1} fill="#f8fafc" />
            <Ruler view={view} W={W} y={rulerY} step={step} unit={L.axisX} decimal={dec} fs={narrow ? 10 : 11} />
            {x > 0.001 && <line x1={ox} x2={front} y1={rulerY - 4} y2={rulerY - 4} stroke={PALETTE.disp} strokeWidth={3} strokeLinecap="round" />}
            <path d={`M${front},${rulerY - 1} l-5,-8 l10,0 Z`} fill={PALETTE.disp} />
          </>
        );
      }}
    </LabScene>
  );
}
