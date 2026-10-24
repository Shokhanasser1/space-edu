import { useState } from 'react';
import { Earth, Lightbulb, Moon, Sun, Users } from 'lucide-react';
import { Explain, RangeField, Readout, clamp, groupThousands, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import {
  COL,
  G,
  g,
  Calc,
  Dimension,
  ForceArrow,
  Panel,
  Person,
  Planet,
  PlayButtons,
  ScaleChip,
  SimScene,
  Tag,
  Toolbar,
  durationParts,
  niceNum,
  niceScale,
  num,
  numt,
  sci,
  useSvgId,
} from './UniversalGravitation.parts';
import ForceGraph, { forceAxis } from './UniversalGravitation.graph';

/**
 * Two bodies attract each other with F = G·m₁·m₂ / r². Four presets set the
 * scale (two people 1 m apart, you and the Earth, the Earth and the Moon, the
 * Sun and the Earth); sliders change m₁, m₂ and r within it. The two force
 * arrows are always equal and opposite (F₁₂ = F₂₁), the readouts show the
 * different accelerations a = F/m, and the F(r) graph marks r/2, r, 2r, 3r.
 * "Release" lets the bodies fall towards each other from rest (only their
 * mutual attraction acts): r(t) comes from the exact radial free-fall law,
 * time is sped up (the chip says how much).
 *
 * Checked: people 60 kg + 50 kg, 1 m → 2.0·10⁻⁷ N; you 60 kg on the Earth
 * (5.97·10²⁴ kg, R = 6370 km) → 589 N ≈ mg = 588 N, a = 9.81 m/s²; Earth–Moon
 * (7.35·10²² kg, 384 000 km) → 1.98·10²⁰ N; Sun–Earth (1.99·10³⁰ kg,
 * 150 mln km) → 3.52·10²² N.
 */

const R_EARTH = 6.37e6;
const R_MOON = 1.737e6;
const R_SUN = 6.96e8;

const PRESETS = [
  {
    id: 'people',
    icon: Users,
    unit: 'm',
    toSI: 1,
    arrowL0: 70,
    bodies: [
      { kind: 'person', name: 'person1', color: COL.b1, m: { min: 20, max: 150, step: 1, exp: 0, def: 60 }, rTrue: 0.25, hint: 'person' },
      { kind: 'person', name: 'person2', color: COL.b2, m: { min: 20, max: 150, step: 1, exp: 0, def: 50 }, rTrue: 0.25, hint: 'person' },
    ],
    r: { min: 0.6, max: 5, step: 0.05, def: 1 },
    box: { x0: -0.7, x1: 5.5, y0: -1.3, y1: 1.15 },
    graphMax: 5,
  },
  {
    id: 'youEarth',
    icon: Earth,
    unit: 'km',
    toSI: 1e3,
    arrowL0: 80,
    bodies: [
      { kind: 'earthTrue', name: 'earth', color: '#2563eb', m: { min: 1, max: 12, step: 0.01, exp: 24, def: 5.97 }, rTrue: R_EARTH, hint: 'earth' },
      { kind: 'personBig', name: 'you', color: COL.b2, m: { min: 20, max: 150, step: 1, exp: 0, def: 60 }, rTrue: 0, hint: 'person' },
    ],
    r: { min: 6370, max: 31850, step: 10, def: 6370 },
    box: { x0: -7000, x1: 34000, y0: -6600, y1: 6600 },
    graphMax: 32000,
  },
  {
    id: 'earthMoon',
    icon: Moon,
    unit: 'km',
    toSI: 1e3,
    arrowL0: 90,
    bodies: [
      { kind: 'earth', name: 'earth', color: '#2563eb', m: { min: 1, max: 12, step: 0.01, exp: 24, def: 5.97 }, rTrue: R_EARTH, hint: 'earth' },
      { kind: 'moon', name: 'moon', color: '#64748b', m: { min: 1, max: 15, step: 0.01, exp: 22, def: 7.35 }, rTrue: R_MOON, hint: 'moon' },
    ],
    r: { min: 100000, max: 800000, step: 1000, def: 384000 },
    box: { x0: -60000, x1: 860000, y0: -90000, y1: 90000 },
    graphMax: 800000,
  },
  {
    id: 'sunEarth',
    icon: Sun,
    unit: 'mkm',
    toSI: 1e9,
    arrowL0: 90,
    bodies: [
      { kind: 'sun', name: 'sun', color: '#f59e0b', m: { min: 0.5, max: 4, step: 0.01, exp: 30, def: 1.99 }, rTrue: R_SUN, hint: 'sun' },
      { kind: 'earthTiny', name: 'earth', color: '#2563eb', m: { min: 1, max: 12, step: 0.01, exp: 24, def: 5.97 }, rTrue: R_EARTH, hint: 'earth' },
    ],
    r: { min: 50, max: 300, step: 1, def: 150 },
    box: { x0: -40, x1: 330, y0: -40, y1: 40 },
    graphMax: 300,
  },
];
const BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
const IDLE = { phase: 'idle', t: 0, r0: 0, rStop: 0, tStop: 0, scale: 1 };
const SCREEN_FALL = 7; // s on screen for a whole fall

/* ---------------------------------------------------------------- physics */

const massOf = (body, v) => v * 10 ** body.m.exp;
const force = (m1, m2, rSI) => (G * m1 * m2) / (rSI * rSI);

/** Time to fall from rest from r0 to rc (SI) under the mutual attraction of total mass M. */
function fallTime(r0, rc, M) {
  const tau = Math.sqrt((r0 * r0 * r0) / (2 * G * M));
  const x = clamp(rc / r0, 0, 1);
  return tau * (Math.sqrt(x * (1 - x)) + Math.acos(Math.sqrt(x)));
}

/** Distance after time t of the fall (inverse of fallTime by bisection). */
function distanceAt(t, r0, rc, M) {
  const tau = Math.sqrt((r0 * r0 * r0) / (2 * G * M));
  let lo = clamp(rc / r0, 0, 1);
  let hi = 1;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    const tm = tau * (Math.sqrt(mid * (1 - mid)) + Math.acos(Math.sqrt(mid)));
    if (tm > t) lo = mid;
    else hi = mid;
  }
  return r0 * ((lo + hi) / 2);
}

/* ----------------------------------------------------------------- layout */

function layout(preset, W) {
  const narrow = W < 560;
  const H = narrow ? Math.round(clamp(W * 0.82, 270, 360)) : 420;
  const pad = narrow ? { l: 12, r: 12, t: 46, b: 30 } : { l: 30, r: 30, t: 56, b: 34 };
  return { narrow, H, view: makeView(preset.box, W, H, pad) };
}

const round = (R) => ({ R, top: R, bottom: R });

/** Drawn size of a body in px: R = radius along the line of centres, top / bottom = vertical extent. */
function drawn(body, preset, k, narrow) {
  switch (body.kind) {
    case 'person':
      return { R: 0.25 * k, top: 0.79 * k, bottom: 0.95 * k };
    case 'personBig': {
      const len = narrow ? 40 : 56;
      return { R: 0, len, kp: len / 1.74, top: 9, bottom: 9 };
    }
    case 'earthTrue': {
      const R = (body.rTrue / preset.toSI) * k;
      return { R, top: R, bottom: R, huge: true };
    }
    case 'earth':
      return round(narrow ? 17 : 26);
    case 'moon':
      return round(narrow ? 7 : 10);
    case 'sun':
      return round(narrow ? 30 : 44);
    default:
      return round(narrow ? 8 : 12);
  }
}

/** Distance (display units) at which the bodies touch — on screen or in reality, whichever is larger. */
function contactDistance(preset, k, narrow) {
  const [b1, b2] = preset.bodies;
  const real = (b1.rTrue + b2.rTrue) / preset.toSI;
  const screen = (drawn(b1, preset, k, narrow).R + drawn(b2, preset, k, narrow).R) / k;
  return Math.max(real, screen);
}

/* -------------------------------------------------------------- simulator */

export default function PairSim({ T }) {
  const tx = T.pair;
  const dec = T.decimal;
  const [presetId, setPresetId] = useState('people');
  const preset = BY_ID[presetId];
  const [b1, b2] = preset.bodies;
  const [v1, setV1] = useState(b1.m.def);
  const [v2, setV2] = useState(b2.m.def);
  const [rD, setRD] = useState(preset.r.def);
  const [last, setLast] = useState(null);
  const [sim, setSim] = useState(IDLE);
  const [wrapRef, { width }] = useElementSize();

  const W = Math.max(width, 260);
  const { narrow, view } = layout(preset, W);
  const rc = contactDistance(preset, view.k, narrow);
  const m1 = massOf(b1, v1);
  const m2 = massOf(b2, v2);
  const M = m1 + m2;
  const toSI = preset.toSI;

  useRafLoop(sim.phase === 'run', (dt) => {
    setSim((p) => {
      if (p.phase !== 'run') return p;
      const t = p.t + dt * p.scale;
      if (t >= p.tStop) return { ...p, t: p.tStop, phase: 'done' };
      return { ...p, t };
    });
  });

  const pickPreset = (id) => {
    const p = BY_ID[id];
    setPresetId(id);
    setV1(p.bodies[0].m.def);
    setV2(p.bodies[1].m.def);
    setRD(p.r.def);
    setLast(null);
    setSim(IDLE);
  };
  const change = (setter, which) => (x) => {
    setter(x);
    setLast(which);
    setSim(IDLE);
  };

  const canRelease = rD > rc * 1.002;
  const toggle = () => {
    if (sim.phase === 'run') setSim((p) => ({ ...p, phase: 'pause' }));
    else if (sim.phase === 'pause') setSim((p) => ({ ...p, phase: 'run' }));
    else {
      const tStop = fallTime(rD * toSI, rc * toSI, M);
      setSim({ phase: 'run', t: 0, r0: rD, rStop: rc, tStop, scale: niceScale(tStop / SCREEN_FALL) });
    }
  };
  const reset = () => setSim(IDLE);

  /* ---- state of the fall */
  const started = sim.phase !== 'idle';
  const r = started ? (sim.phase === 'done' ? sim.rStop : distanceAt(sim.t, sim.r0 * toSI, sim.rStop * toSI, M) / toSI) : rD;
  const xc = started ? (m2 / M) * sim.r0 : 0;
  const x1 = started ? xc - (m2 / M) * r : 0;
  const x2 = started ? xc + (m1 / M) * r : rD;
  const x1s = 0;
  const x2s = started ? sim.r0 : rD;

  const rSI = r * toSI;
  const F = force(m1, m2, rSI);
  const a1 = F / m1;
  const a2 = F / m2;
  const F0 = force(massOf(b1, b1.m.def), massOf(b2, b2.m.def), preset.r.def * toSI);
  const isDefault = v1 === b1.m.def && v2 === b2.m.def && Math.abs(rD - preset.r.def) < 1e-9;

  /* ---- explanation */
  const ratio = last === 'r' ? rD / preset.r.def : last === 'm1' ? v1 / b1.m.def : last === 'm2' ? v2 / b2.m.def : 1;
  let key;
  if (sim.phase === 'run' || sim.phase === 'pause') key = 'fall';
  else if (sim.phase === 'done') key = 'done';
  else if (isDefault) key = 'intro';
  else if (last && Math.abs(ratio - 1) > 0.004) key = `${last}${ratio > 1 ? 'Up' : 'Down'}`;
  else key = 'custom';
  const settled = useSettled(key, key === 'intro' || key === 'fall' || key === 'done' ? 0 : 260);
  const ex = tx.explain;
  const S = (x) => sci(x, dec);
  const k3 = (x) => numt(x, dec, 3);
  const distText = (dSI) => {
    if (dSI < 0.01) return `${sci(dSI, dec, 2)} ${T.m}`;
    if (dSI < 1000) return `${numt(dSI, dec, 2)} ${T.m}`;
    if (dSI < 1e9) return `${num(dSI / 1e3, dec)} ${T.km}`;
    return `${num(dSI / 1e9, dec)} ${T.mkm}`;
  };
  const dur = (t) => {
    const d = durationParts(t, T, dec);
    return `${d.v} ${d.u}`;
  };
  let text;
  if (settled === 'intro') {
    if (presetId === 'people') text = ex.intro.people(S(F), `${num(F / g * 1e6, dec, 1)} ${T.mg}`);
    else if (presetId === 'youEarth') text = ex.intro.youEarth(numt(F, dec, 3), numt(m2 * g, dec, 3));
    else if (presetId === 'earthMoon') text = ex.intro.earthMoon(S(F), numt(m1 / m2, dec, 2));
    else text = ex.intro.sunEarth(S(F));
  } else if (settled === 'rUp' || settled === 'rDown') {
    const k = settled === 'rUp' ? rD / preset.r.def : preset.r.def / rD;
    text = ex[settled](k3(k), k3(k * k), S(F));
  } else if (settled === 'm1Up' || settled === 'm1Down' || settled === 'm2Up' || settled === 'm2Down') {
    const body = settled.startsWith('m1') ? b1 : b2;
    const k = settled.startsWith('m1') ? v1 / b1.m.def : v2 / b2.m.def;
    text = settled.endsWith('Up') ? ex.mUp(tx.massLabel[body.name], k3(k), S(F)) : ex.mDown(tx.massLabel[body.name], k3(1 / k), S(F));
  } else if (settled === 'fall') text = ex.fall;
  else if (settled === 'done') {
    const d1 = (m2 / M) * (sim.r0 - sim.rStop) * toSI;
    const d2 = (m1 / M) * (sim.r0 - sim.rStop) * toSI;
    text = ex.done(dur(sim.tStop), `${tx.names[b1.name]} — ${distText(d1)}`, `${tx.names[b2.name]} — ${distText(d2)}`) + ex.doneNote[presetId];
  } else text = ex.custom(S(F));
  if (settled === 'intro' && presetId === 'youEarth' && !canRelease) text += ` ${ex.touchHint}`;
  const tone = settled === 'done' ? '#34d399' : settled === 'fall' ? '#fb923c' : settled.startsWith('r') ? '#f87171' : settled.startsWith('m') ? '#a78bfa' : '#22d3ee';

  /* ---- scale chip and legend */
  const defGap = preset.r.def * view.k + (b2.kind === 'personBig' ? 0.95 * drawn(b2, preset, view.k, narrow).kp : 0);
  const L0 = Math.min(preset.arrowL0 * (narrow ? 0.72 : 1), 0.6 * defGap); // default arrow, never broken at the preset distance
  const fScale = L0 / F0; // px per newton in this scene
  const Fs = niceNum(40 / fScale);
  const centrePx = Math.abs(view.sx(x2) - view.sx(x1));
  const clamped = F * fScale > 0.92 * centrePx;
  const legend = [
    { label: tx.legend.force, color: COL.force, kind: 'arrow' },
    { label: tx.legend.r, color: COL.ink, kind: 'line' },
    ...(started ? [{ label: tx.legend.start, color: '#94a3b8', kind: 'dash' }] : []),
    ...(clamped ? [{ label: tx.legend.broken, color: COL.force, kind: 'break' }] : []),
  ];
  const chip = (
    <ScaleChip
      time={started ? T.common.faster(groupThousands(sim.scale)) : null}
      forceBar={{ px: Fs * fScale, text: `${S(Fs)} ${T.N}` }}
    />
  );

  /* ---- graph */
  const xStart = (b1.rTrue + b2.rTrue) / toSI;
  const fAt = (x) => force(m1, m2, x * toSI);
  const fDef = (x) => force(massOf(b1, b1.m.def), massOf(b2, b2.m.def), x * toSI);
  const axis = forceAxis(Math.min(fDef(Math.max(xStart, 1e-9)), 4.6 * F0) * 1.05);
  const massesChanged = v1 !== b1.m.def || v2 !== b2.m.def;
  const unitWord = T[preset.unit];

  /* ---- time readout */
  const tMeet = canRelease ? fallTime(rD * toSI, rc * toSI, M) : 0;
  const tileTime = started ? durationParts(sim.t, T, dec) : canRelease ? durationParts(tMeet, T, dec) : null;

  const massField = (body, value, setter, which, sym, accent) => (
    <RangeField
      id={`ug-${which}`}
      label={tx.massLabel[body.name]}
      symbol={sym}
      min={body.m.min}
      max={body.m.max}
      step={body.m.step}
      value={value}
      onChange={change(setter, which)}
      accent={accent}
      display={`${S(massOf(body, value))} ${T.kg}`}
      hint={tx.hints[body.hint]}
    />
  );
  const rHint = presetId === 'youEarth' ? tx.rHint.youEarth(num(rD - 6370, dec)) : tx.rHint[presetId];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={presetId}
        onChange={pickPreset}
        options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.phase === 'run'}
          started={sim.phase === 'pause'}
          done={sim.phase === 'done'}
          onToggle={toggle}
          onReset={reset}
          playLabel={tx.release}
          disabled={!canRelease && sim.phase === 'idle'}
        />
      </Toolbar>

      <div ref={wrapRef}>
        <SimScene
          legend={legend}
          chip={chip}
          ariaLabel={tx.sceneLabel(tx.names[b1.name], tx.names[b2.name], `${numt(r, dec)} ${unitWord}`, `${S(F)} ${T.N}`)}
          height={(w) => layout(preset, w).H}
        >
          {(w, h, nar) => (
            <PairDrawing
              W={w}
              H={h}
              narrow={nar}
              preset={preset}
              view={layout(preset, w).view}
              pos={[x1, x2]}
              start={[x1s, x2s]}
              started={started}
              r={r}
              F={F}
              fScale={fScale}
              masses={[m1, m2]}
              T={T}
            />
          )}
        </SimScene>
      </div>

      <Explain icon={Lightbulb} id={`${presetId}-${settled}`} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.F} symbol="F" value={S(F)} unit={T.N} accent={COL.force} textColor={COL.forceText} sub={tx.readouts.Fsub} active={started} />
        <Readout label={tx.aLabel[b1.name]} symbol="a₁" value={S(a1)} unit={T.ms2} accent={COL.b1} textColor={COL.b1Text} sub="a₁ = F / m₁" />
        <Readout label={tx.aLabel[b2.name]} symbol="a₂" value={S(a2)} unit={T.ms2} accent={COL.b2} textColor={COL.b2Text} sub="a₂ = F / m₂" />
        <Readout
          label={started ? tx.readouts.time : tx.readouts.meet}
          symbol="t"
          value={tileTime ? tileTime.v : '—'}
          unit={tileTime ? tileTime.u : undefined}
          accent="#22d3ee"
          textColor="#a5f3fc"
          sub={started ? tx.readouts.timeSub(dur(sim.tStop)) : canRelease ? tx.readouts.meetSub : tx.readouts.touching}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          {massField(b1, v1, setV1, 'm1', 'm₁', COL.b1)}
          {massField(b2, v2, setV2, 'm2', 'm₂', COL.b2)}
          <RangeField
            id="ug-r"
            label={tx.dist}
            symbol="r"
            min={preset.r.min}
            max={preset.r.max}
            step={preset.r.step}
            value={rD}
            onChange={change(setRD, 'r')}
            accent="#22d3ee"
            display={`${numt(rD, dec)} ${unitWord}`}
            hint={rHint}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <ForceGraph
            title={tx.graph.title}
            force={fAt}
            ghost={massesChanged ? fDef : null}
            xStart={xStart}
            xMax={preset.graphMax}
            axis={axis}
            r={r}
            labels={{ curve: tx.graph.curve, ghost: tx.graph.ghost }}
            xLabel={`r, ${unitWord}`}
            yLabel={(p) => `F, ${p}${T.N}`}
            note={tx.graph.note}
            dec={dec}
            ariaLabel={tx.graph.aria}
          />
        </Panel>
      </div>

      <Panel>
        <Calc
          title={T.common.calc}
          rows={[
            {
              sym: 'F',
              color: COL.forceText,
              formula: 'G·m₁·m₂ / r²',
              subst: `${S(G)} · ${S(m1)} · ${S(m2)} / (${S(rSI)})²`,
              result: `${S(F)} ${T.N}`,
            },
            { sym: 'a₁', color: COL.b1Text, formula: 'F / m₁', subst: `${S(F)} / ${S(m1)}`, result: `${S(a1)} ${T.ms2}` },
            { sym: 'a₂', color: COL.b2Text, formula: 'F / m₂', subst: `${S(F)} / ${S(m2)}`, result: `${S(a2)} ${T.ms2}` },
          ]}
          note={tx.calcNote}
        />
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function Body({ body, preset, x, cy, view, narrow, id, opacity = 1 }) {
  const d = drawn(body, preset, view.k, narrow);
  const cx = view.sx(x);
  if (body.kind === 'person') return <Person cx={cx} cy={cy} k={view.k} color={body.color} opacity={opacity} />;
  if (body.kind === 'personBig') return <Person cx={cx + 0.95 * d.kp} cy={cy} k={d.kp} color={body.color} rot={90} opacity={opacity} />;
  const kind = body.kind === 'earthTrue' || body.kind === 'earthTiny' ? 'earth' : body.kind;
  return <Planet kind={kind} cx={cx} cy={cy} r={d.R} id={id} opacity={opacity} />;
}

function PairDrawing({ W, H, narrow, preset, view, pos, start, started, r, F, fScale, masses, T }) {
  const tx = T.pair;
  const dec = T.decimal;
  const gid = useSvgId('ug');
  const fs = narrow ? 11 : 12;
  const box = { w: W, h: H };
  const cy = view.sy(0);
  const [b1, b2] = preset.bodies;
  const d1 = drawn(b1, preset, view.k, narrow);
  const d2 = drawn(b2, preset, view.k, narrow);

  // centres of mass on screen (the big lying person: 0.95 of the drawn scale from the feet)
  const c1 = view.sx(pos[0]);
  const c2 = view.sx(pos[1]) + (b2.kind === 'personBig' ? 0.95 * d2.kp : 0);
  const gap = Math.max(0, c2 - c1);
  const len = F * fScale;
  const maxLen = 0.92 * gap;
  const off = narrow ? 7 : 9;

  // labels above the bodies, the F pill above them, the dimension line below
  const tops = [d1, d2].filter((d) => !d.huge).map((d) => d.top);
  const bottoms = [d1, d2].filter((d) => !d.huge).map((d) => d.bottom);
  const nameY = (d) => (d.huge ? cy - 34 : cy - d.top - (narrow ? 12 : 16));
  const fY = clamp(cy - Math.max(...tops) - (narrow ? 38 : 46), narrow ? 16 : 62, cy - 40);
  const dimY = clamp(cy + Math.max(24, ...bottoms) + (narrow ? 22 : 30), cy + 40, H - (narrow ? 30 : 36));

  // axis numbers along the bottom (display units: m, km or million km)
  const step = niceStep(view.k, narrow ? 62 : 80);
  const ticks = [];
  for (let x = Math.ceil(view.wx(24) / step) * step; x <= view.wx(W - (narrow ? 44 : 64)); x += step) ticks.push(x);

  // name pills above the bodies; when they would overlap, push them apart around the midpoint
  const pill = (body, d, x, mass) => {
    const cx = view.sx(x) + (body.kind === 'personBig' ? 0.95 * d.kp : 0);
    const txt = `${tx.names[body.name]} · ${sci(mass, dec)} ${T.kg}`;
    return { cx, txt, w: txt.length * (fs - 1) * 0.56 + 16, y: nameY(d) };
  };
  const pills = [pill(b1, d1, pos[0], masses[0]), pill(b2, d2, pos[1], masses[1])];
  pills.forEach((p) => {
    p.left = clamp(p.cx - p.w / 2, 4, W - p.w - 4);
  });
  const [pa, pb] = pills;
  if (Math.abs(pa.y - pb.y) < fs + 10 && pa.left + pa.w + 4 > pb.left) {
    const mid = (pa.cx + pb.cx) / 2;
    pa.left = clamp(mid - 3 - pa.w, 4, W - pa.w - 4);
    pb.left = clamp(mid + 3, 4, W - pb.w - 4);
    if (pa.left + pa.w + 4 > pb.left) pb.y = pa.y - fs - 14;
  }
  const fYp = Math.max(narrow ? 14 : 58, Math.min(fY, pa.y - fs - 16, pb.y - fs - 16));
  const label = (p) => (
    <g pointerEvents="none">
      <rect x={p.left} y={p.y - (fs + 9) / 2} width={p.w} height={fs + 9} rx={(fs + 9) / 2} fill="#fff" stroke="#cbd5e1" />
      <text x={p.left + p.w / 2} y={p.y + fs * 0.33} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill={COL.ink}>
        {p.txt}
      </text>
    </g>
  );

  const fText = `F = ${sci(F, dec)} ${T.N}`;
  const fW = fText.length * fs * 0.56 + 18;
  const fLeft = clamp((c1 + c2) / 2 - fW / 2, 4, W - fW - 4);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 22 : 28} />
      <rect x={0} y={H - 22} width={W} height={22} fill="#fbfcfe" opacity="0.9" />
      {ticks.map((x) => (
        <text key={x} x={view.sx(x)} y={H - 8} textAnchor="middle" fontSize={fs - 1} fill={Math.abs(x) < 1e-9 ? COL.ink : COL.muted} fontWeight={Math.abs(x) < 1e-9 ? 700 : 400}>
          {numt(x, dec).replace('-', '−')}
        </text>
      ))}
      <text x={W - 8} y={H - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {T[preset.unit]}
      </text>

      {/* where the bodies started */}
      {started && (
        <g>
          <Body body={b1} preset={preset} x={start[0]} cy={cy} view={view} narrow={narrow} id={`${gid}-s1`} opacity={0.18} />
          <Body body={b2} preset={preset} x={start[1]} cy={cy} view={view} narrow={narrow} id={`${gid}-s2`} opacity={0.18} />
          <line x1={view.sx(start[0])} x2={c1} y1={cy} y2={cy} stroke={COL.b1} strokeWidth="2" strokeDasharray="4 4" />
          <line x1={view.sx(start[1]) + (b2.kind === 'personBig' ? 0.95 * d2.kp : 0)} x2={c2} y1={cy} y2={cy} stroke={COL.b2} strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}

      <Body body={b1} preset={preset} x={pos[0]} cy={cy} view={view} narrow={narrow} id={`${gid}-1`} />
      <Body body={b2} preset={preset} x={pos[1]} cy={cy} view={view} narrow={narrow} id={`${gid}-2`} />

      {/* the pair of equal and opposite forces (drawn a little apart so they never overlap) */}
      <ForceArrow x1={c1} y1={cy - off} ux={1} uy={0} len={len} maxLen={maxLen} width={narrow ? 3 : 3.5} head={narrow ? 11 : 13} />
      <ForceArrow x1={c2} y1={cy + off} ux={-1} uy={0} len={len} maxLen={maxLen} width={narrow ? 3 : 3.5} head={narrow ? 11 : 13} />
      <Tag x={c1 + Math.max(7, Math.min(len, maxLen)) + 4} y={cy - off - 8} text="F₁₂" color={COL.force} size={fs + 2} anchor="start" />
      <Tag x={c2 - Math.max(7, Math.min(len, maxLen)) - 4} y={cy + off + 20} text="F₂₁" color={COL.force} size={fs + 2} anchor="end" />

      <Dimension x1={c1} x2={c2} y={dimY} text={`r = ${numt(r, dec)} ${T[preset.unit]}`} size={fs} box={box} />

      {label(pa)}
      {label(pb)}

      <g pointerEvents="none">
        <rect x={fLeft} y={fYp - (fs + 11) / 2} width={fW} height={fs + 11} rx={(fs + 11) / 2} fill={COL.force} />
        <text x={fLeft + fW / 2} y={fYp + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff">
          {fText}
        </text>
      </g>

      <text x={narrow ? 8 : 12} y={H - 28} fontSize={fs - 1} fill={COL.muted}>
        {tx.notes[preset.id]}
      </text>
    </g>
  );
}
