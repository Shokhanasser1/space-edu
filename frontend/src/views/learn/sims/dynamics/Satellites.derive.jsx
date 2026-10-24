import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleDot, Earth, Globe2, Lightbulb, Moon, Pause, Play } from 'lucide-react';
import { Arrow, Btn, Explain, Readout, Segmented, clamp, fmt, groupThousands, useRafLoop } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { TAU, Label, Planet, SatGlyph, SimScene, Tag, TimeChip, labelSize, niceFactor, numt, sciAlways } from './Satellites.parts';

/**
 * The first cosmic speed, step by step. A satellite skimming the surface
 * moves on a circle of radius R; its acceleration v²/R points at the centre
 * and is supplied by gravity alone:
 *   m·v²/R = mg  ⇒  v₁ = √(gR) = √(9.8 · 6.4·10⁶) ≈ 7.9·10³ m/s,
 *   T = 2πR/v₁ ≈ 5.1·10³ s ≈ 85 min.
 * The check of the last step: in 1 s the satellite flies vt = 7.9 km along
 * the tangent and falls gt²/2 = 4.9 m, and over 7.9 km the surface drops by
 * (vt)²/(2R) = 4.9 m as well (because v² = gR) — so its height never changes.
 * School values here: R = 6400 km, g = 9.8 m/s². The same formula for the
 * Moon (g = 1.62, R = 1740 km → 1.68 km/s), Mars (3.7, 3400 km → 3.55 km/s)
 * and Jupiter (24.8, 70 000 km → 41.7 km/s).
 */

const C = PALETTE;
const FORCE = '#dc2626';
const PLANETS = [
  { id: 'earth', g: 9.8, R: 6.4e6, icon: Earth },
  { id: 'moon', g: 1.62, R: 1.74e6, icon: Moon },
  { id: 'mars', g: 3.7, R: 3.4e6, icon: CircleDot },
  { id: 'jupiter', g: 24.8, R: 7.0e7, icon: Globe2 },
].map((p) => {
  const v = Math.sqrt(p.g * p.R);
  const T = (TAU * p.R) / v;
  return { ...p, v, T, scale: niceFactor(T / 10) };
});
const BY_ID = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
const NSTEPS = 5;

export default function DeriveSim({ T }) {
  const tx = T.derive;
  const dec = T.decimal;
  const [pid, setPid] = useState('earth');
  const [step, setStep] = useState(0);
  const [anim, setAnim] = useState({ running: true, phi: 0.35 });
  const p = BY_ID[pid];

  useRafLoop(anim.running, (dt) => {
    setAnim((a) => (a.running ? { ...a, phi: a.phi + (TAU / p.T) * p.scale * dt } : a));
  });

  const name = tx.planets[pid].name;
  const vKm = fmt(p.v / 1000, 1, dec);
  const drop = numt(p.g / 2, dec, 3);
  const Tmin = fmt(p.T / 60, 0, dec);
  const kms = T.common.kms;

  const formulas = [
    ['a = v²/R'],
    ['F = mg'],
    ['ma = F', 'm·v²/R = mg  ⇒  v² = gR'],
    [
      `v₁ = √(gR) = √(${numt(p.g, dec, 3)} ${T.ms2} · ${sciAlways(p.R, dec, 2)} ${T.m})`,
      `v₁ ≈ ${sciAlways(p.v, dec, 2)} ${T.ms} ≈ ${vKm} ${kms}`,
      `T = 2πR/v₁ ≈ ${sciAlways(p.T, dec, 2)} ${T.s} ≈ ${Tmin} ${T.common.min}`,
    ],
    [`vt = ${vKm} ${T.km}`, `gt²/2 = ${drop} ${T.m}`, `(vt)²/(2R) = gR/(2R) = ${drop} ${T.m}`],
  ];
  const steps = tx.steps.map((s, i) => ({ ...s, formulas: formulas[i], short: i === 3 ? formulas[i][1] : formulas[i][formulas[i].length - 1] }));

  const ex = tx.explain;
  const text = [ex[0], ex[1], ex[2], ex[3](name, vKm, Tmin), ex[4](vKm, drop)][step];
  const tones = ['#22d3ee', '#f87171', '#a78bfa', '#34d399', '#fbbf24'];

  const legend = [
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.acc, kind: 'arrow' },
    ...(step >= 1 ? [{ label: tx.legend.F, color: FORCE, kind: 'arrow' }] : []),
    { label: tx.legend.orbit, color: C.path, kind: 'dash' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.presetsLabel}</p>
          <Segmented
            label={tx.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={pid}
            onChange={(id) => setPid(id)}
            options={PLANETS.map((x) => ({
              value: x.id,
              label: tx.planets[x.id].name,
              sub: `g = ${numt(x.g, dec, 3)} · R = ${groupThousands(x.R / 1000)} ${T.km}`,
              icon: x.icon,
            }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-2 xl:flex">
          <Btn icon={anim.running ? Pause : Play} onClick={() => setAnim((a) => ({ ...a, running: !a.running }))} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {anim.running ? T.common.pause : T.common.resume}
          </Btn>
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SimScene
            legend={legend}
            chip={<TimeChip text={T.common.faster(groupThousands(p.scale))} />}
            ariaLabel={tx.sceneLabel(name, vKm, step + 1)}
            height={(W, narrow) => (narrow ? W * 1.02 : clamp(W * 0.82, 440, 540))}
          >
            {(W, H, narrow) => <DeriveDrawing W={W} H={H} narrow={narrow} step={step} phi={anim.phi} p={p} tx={tx} T={T} />}
          </SimScene>
        </div>
        <div className="lg:col-span-2 flex flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.stepsTitle}</p>
            <span className="text-xs tabular-nums text-gray-400">{tx.stepOf(step + 1, NSTEPS)}</span>
          </div>
          <ol className="mt-2 flex-1 space-y-1.5">
            {steps.map((s, i) => (
              <StepItem key={s.title} n={i + 1} state={i < step ? 'done' : i === step ? 'now' : 'next'} s={s} onClick={() => setStep(i)} />
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn icon={ChevronLeft} onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="min-h-[48px]">
              {T.common.prev}
            </Btn>
            <Btn variant="primary" icon={ChevronRight} onClick={() => setStep((s) => Math.min(NSTEPS - 1, s + 1))} disabled={step === NSTEPS - 1} className="min-h-[48px]">
              {T.common.next}
            </Btn>
          </div>
        </div>
      </div>

      <Explain icon={Lightbulb} id={`${step}-${pid}`} tone={tones[step]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.R} symbol="R" value={groupThousands(p.R / 1000)} unit={T.km} accent={C.disp} textColor={C.dispText} sub={`R = ${sciAlways(p.R, dec, 2)} ${T.m}`} />
        <Readout label={tx.readouts.g} symbol="g" value={fmt(p.g, 2, dec)} unit={T.ms2} accent={FORCE} textColor="#fca5a5" sub={tx.readouts.gSub} />
        <Readout
          label={tx.readouts.v1}
          symbol="v₁"
          value={fmt(p.v / 1000, 2, dec)}
          unit={kms}
          accent={C.vel}
          textColor={C.velText}
          active={step >= 3}
          sub={tx.readouts.v1Sub(fmt((Math.SQRT2 * p.v) / 1000, 1, dec))}
        />
        <Readout label={tx.readouts.T} symbol="T" value={Tmin} unit={T.common.min} accent={C.time} textColor="#a5f3fc" sub={tx.readouts.TSub(groupThousands(p.T))} />
      </div>
    </div>
  );
}

function StepItem({ n, state, s, onClick }) {
  const now = state === 'now';
  const done = state === 'done';
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={now ? 'step' : undefined}
        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 min-h-10 ${
          now ? 'border-cyan-300/50 bg-cyan-300/[0.08]' : done ? 'border-white/10 bg-black/20 hover:bg-white/[0.05]' : 'border-white/5 bg-transparent hover:bg-white/[0.04]'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
              now ? 'bg-cyan-300 text-slate-950' : done ? 'bg-emerald-400/20 text-emerald-300' : 'bg-white/[0.06] text-gray-500'
            }`}
          >
            {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : n}
          </span>
          <span className={`text-sm font-semibold ${now ? 'text-white' : done ? 'text-gray-300' : 'text-gray-500'}`}>{s.title}</span>
          {done && <span className="ml-auto truncate pl-2 font-serif text-sm italic text-gray-400">{s.short}</span>}
        </span>
        {now && (
          <span className="mt-2 block space-y-1.5 pl-[34px]">
            {s.formulas.map((f) => (
              <span key={f} className="block rounded-lg bg-black/30 px-2.5 py-1.5 font-serif text-[15px] italic leading-snug text-white tabular-nums">
                {f}
              </span>
            ))}
            <span className="block text-[13px] leading-snug text-gray-300">{s.text}</span>
          </span>
        )}
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------- scene */

function DeriveDrawing({ W, H, narrow, step, phi, p, tx, T }) {
  const dec = T.decimal;
  const fs = narrow ? 11 : 12;
  const bx = { w: W, h: H };
  const top = narrow ? 18 : 48;
  const cx = W / 2;
  const cy = top + (H - top - 24) / 2;
  const avail = (H - top - 24) / 2;
  const Rp = Math.min(W * 0.3, (avail - 14) / 1.3);
  const rho = Rp + Math.max(7, Rp * 0.05);
  const sx = cx + rho * Math.cos(phi);
  const sy = cy - rho * Math.sin(phi);
  const tX = -Math.sin(phi);
  const tY = -Math.cos(phi);
  const iX = -Math.cos(phi);
  const iY = Math.sin(phi);
  const bodyR = narrow ? 11 : 13;
  const La = clamp(rho * 0.55, 52, 92) * 0.62;
  const Lv = clamp(rho * 0.55, 52, 92) * (step === 4 ? 0.55 : 1);
  const off = 7; // a and mg drawn side by side
  const deg = (-phi * 180) / Math.PI;
  const kms = T.common.kms;
  const vKm = fmt(p.v / 1000, 1, dec);

  // step 5: the tangent the body would follow without gravity, and how far the circle falls away from it
  const Lt = clamp(rho * 0.78, 70, 150);
  const ex = sx + tX * Lt;
  const ey = sy + tY * Lt;
  const er = Math.hypot(ex - cx, ey - cy);
  const fx = cx + ((ex - cx) / er) * rho;
  const fy = cy + ((ey - cy) / er) * rho;

  // the radius label sits on the radius, a little to the side
  const mR = rho * 0.3;
  const nX = Math.sin(phi);
  const nY = Math.cos(phi);
  const outX = -iX;
  const outY = -iY;
  const tTag = tx.tangentTag(vKm, T.km);
  const tSz = labelSize(tTag, fs - 1);
  const tOff = 10 + Math.abs(outX) * (tSz.w / 2) + Math.abs(outY) * (tSz.h / 2);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Planet kind={p.id} cx={cx} cy={cy} r={Rp} rot={phi * 0.15} />
      <circle cx={cx} cy={cy} r={rho} fill="none" stroke={C.path} strokeOpacity="0.8" strokeWidth="2" strokeDasharray="6 6" />
      <line x1={cx} y1={cy} x2={sx} y2={sy} stroke={C.ink} strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
      <circle cx={cx} cy={cy} r={3} fill={C.ink} />
      <Tag x={cx + mR * Math.cos(phi) + nX * 14} y={cy - mR * Math.sin(phi) + nY * 14 + 5} text="R" color={C.ink} size={fs + 3} />

      {step === 4 && (
        <g>
          <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#475569" strokeWidth="1.8" strokeDasharray="6 5" />
          <circle cx={ex} cy={ey} r={bodyR * 0.55} fill="#fff" stroke="#475569" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1={ex} y1={ey} x2={fx} y2={fy} stroke="#d97706" strokeWidth="3" strokeLinecap="round" />
          <circle cx={fx} cy={fy} r={4} fill="#d97706" />
          <Label x={(sx + ex) / 2 + outX * tOff} y={(sy + ey) / 2 + outY * tOff} text={tTag} bg="#475569" size={fs - 1} box={bx} />
          <Label x={(ex + fx) / 2 + tX * 52} y={(ey + fy) / 2 + tY * 52} text={tx.dropTag(numt(p.g / 2, dec, 3), T.m)} bg="#d97706" size={fs - 1} box={bx} />
        </g>
      )}

      {/* vectors */}
      <Arrow
        x1={sx + iX * (bodyR + 2) - nX * off}
        y1={sy + iY * (bodyR + 2) - nY * off}
        x2={sx + iX * (bodyR + 2 + La) - nX * off}
        y2={sy + iY * (bodyR + 2 + La) - nY * off}
        color={C.acc}
        width={3.2}
        head={12}
      />
      {step >= 1 && (
        <Arrow
          x1={sx + iX * (bodyR + 2) + nX * off}
          y1={sy + iY * (bodyR + 2) + nY * off}
          x2={sx + iX * (bodyR + 2 + La) + nX * off}
          y2={sy + iY * (bodyR + 2 + La) + nY * off}
          color={FORCE}
          width={3.2}
          head={12}
        />
      )}
      <Arrow x1={sx + tX * (bodyR + 2)} y1={sy + tY * (bodyR + 2)} x2={sx + tX * (bodyR + 2 + Lv)} y2={sy + tY * (bodyR + 2 + Lv)} color={C.vel} width={3.5} head={13} />
      <SatGlyph x={sx} y={sy} deg={deg} s={narrow ? 0.8 : 0.9} />
      <Tag x={sx + tX * (bodyR + 14 + Lv)} y={sy + tY * (bodyR + 14 + Lv) + 5} text="v" color={C.vel} size={fs + 4} />
      <Tag x={sx + iX * (bodyR + La + 14) - nX * (off + 12)} y={sy + iY * (bodyR + La + 14) - nY * (off + 12) + 5} text="a" color={C.acc} size={fs + 4} />
      {step >= 1 && <Tag x={sx + iX * (bodyR + La + 14) + nX * (off + 16)} y={sy + iY * (bodyR + La + 14) + nY * (off + 16) + 5} text="mg" color={FORCE} size={fs + 3} />}

      {step === 2 && <Label x={sx + outX * 40} y={sy + outY * 40} text="m·v²/R = mg" bg={C.ink} size={fs} box={bx} />}
      {step === 3 && <Label x={sx + outX * 40} y={sy + outY * 40} text={`v₁ = √(gR) ≈ ${fmt(p.v / 1000, 1, dec)} ${kms}`} bg="#059669" size={fs} box={bx} />}

      <text x={12} y={H - 10} fontSize={fs - 1} fill={C.muted}>
        {step === 4 ? tx.noScale(vKm, numt(p.g / 2, dec, 3)) : tx.orbitLow}
      </text>
    </g>
  );
}
