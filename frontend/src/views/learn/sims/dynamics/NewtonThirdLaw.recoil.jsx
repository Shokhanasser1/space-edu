import { useState } from 'react';
import { Bomb, Lightbulb, Rocket, Sailboat } from 'lucide-react';
import { Explain, RangeField, Readout, clamp, fmt, groupThousands, useRafLoop } from '../kit/ui';
import { AxisNumbers, Grid, makeView } from '../kit/scene';
import { COL, Calc, ForceArrow, Panel, Person, PlayButtons, RichPill, ScaleBar, SimScene, Tag, TimeChip, Toolbar, fmtt, numt, shoulderOf } from './NewtonThirdLaw.parts';

/**
 * Recoil and jet propulsion: one body pushes another, and the other pushes
 * back just as hard.
 *
 *   boat   - a boy (m) jumps from a boat (M) with speed v. For Δt = 0.3 s
 *            the boat pushes the boy forward with F = m·v/Δt and the boy
 *            pushes the boat back with the same F, so the boat leaves with
 *            V = F·Δt/M = m·v/M (water resistance neglected).
 *   cannon - the powder gas pushes the shell (m) forward and the cannon (M)
 *            back with the same force while the shell runs along the 1 m
 *            barrel (uniformly accelerated: Δt = 2L/v): V = m·v/M.
 *   rocket - a spacecraft in space throws gas back: μ kg every second at
 *            speed u. The rocket pushes the gas with F = μ·u, the gas pushes
 *            the rocket forward with the same F, a = F/M (M falls slowly as
 *            the fuel burns; V = u·ln(M₀/M) exactly). The engine runs 10 s.
 *
 * The short pushes are shown slowed down (the chip says by how much), then
 * the motion goes on in real time.
 */

const G = 9.8;
const BARREL = 1; // m, the shell's run along the barrel
const BURN = 10; // s, rocket engine burn
const BOAT_DT = 0.3; // s, the boy's push
const BOY_X0 = 0.3; // m, the boy's feet from the middle of the boat
const BOY_VY = 3.2; // m/s, upward part of the jump (only for the arc)
const DECK = 0.12; // m, the boy's feet above the water while on the boat

const SCEN = {
  boat: {
    kind: 'pulse',
    icon: Sailboat,
    def: { mA: 50, mB: 100, v: 3 },
    ranges: { mA: [30, 70, 5], mB: [80, 300, 10], v: [1.5, 3.5, 0.5] },
    tEnd: 3.6,
    box: { x0: -7.5, x1: 5, y0: -0.9, y1: 2.6 },
    mPerN: 1.4 / 500,
    scaleN: 250,
  },
  cannon: {
    kind: 'pulse',
    icon: Bomb,
    def: { mA: 5, mB: 500, v: 200 },
    ranges: { mA: [2, 10, 1], mB: [400, 2000, 50], v: [100, 300, 25] },
    tEnd: 3,
    box: { x0: -6, x1: 6.5, y0: -0.5, y1: 3 },
    mPerN: 1 / 100000,
    scaleN: 50000,
  },
  rocket: {
    kind: 'jet',
    icon: Rocket,
    def: { mA: 0.5, mB: 2000, v: 2000 },
    ranges: { mA: [0.1, 1, 0.1], mB: [1000, 4000, 100], v: [1000, 3000, 100] },
    tEnd: 14,
    mPerN: 1.5 / 1000,
    scaleN: 500,
  },
};
const ORDER = ['boat', 'cannon', 'rocket'];
const ASPECT = 12.5 / 3.5; // every scenario's world box has this width : height
const IDLE = { running: false, t: 0, done: false };

/** Thousands grouped from 1000 up, about three significant digits below. */
function bigNum(x, dec) {
  return Math.abs(x) >= 1000 ? groupThousands(x) : numt(x, dec, 3);
}

/** Push of constant force for dt, then uniform motion. */
function travel(a, t, dt) {
  if (t <= dt) return { s: 0.5 * a * t * t, v: a * t };
  return { s: 0.5 * a * dt * dt + a * dt * (t - dt), v: a * dt };
}

function pulseOf(id, p) {
  const dt = id === 'cannon' ? (2 * BARREL) / p.v : BOAT_DT;
  const F = (p.mA * p.v) / dt;
  return { dt, F, aA: F / p.mA, aB: F / p.mB, V: (p.mA * p.v) / p.mB, slow: 1.5 / dt };
}

/** Rocket: speed and distance after t s (mass M₀ − μt while the engine runs). */
function rocketAt(p, t) {
  const { mA: mu, mB: M0, v: u } = p;
  const tb = Math.min(t, BURN);
  const M = M0 - mu * tb;
  const V = u * Math.log(M0 / M);
  const X = u * (tb + (M / mu) * Math.log(M / M0));
  return { M, V, X: X + V * Math.max(0, t - BURN), a: t < BURN ? (mu * u) / M : 0, burning: t < BURN };
}

/** Boy of the boat scene: feet position and phase at time t. */
function boyAt(p, pu, t) {
  const sA = travel(pu.aA, Math.min(t, pu.dt), pu.dt).s;
  const xRel = BOY_X0 + sA;
  if (t <= pu.dt) return { x: xRel, y: DECK, phase: 'push' };
  const tauLand = (BOY_VY + Math.sqrt(BOY_VY * BOY_VY + 2 * G * DECK)) / G;
  const tau = t - pu.dt;
  if (tau < tauLand) return { x: xRel + p.v * tau, y: DECK + BOY_VY * tau - 0.5 * G * tau * tau, phase: 'fly' };
  const xl = xRel + p.v * tauLand;
  const after = tau - tauLand;
  return { x: xl + p.v * 0.3 * (1 - Math.exp(-after / 0.3)), y: -1, phase: 'swim', xl, since: after };
}

export default function RecoilSim({ T }) {
  const tx = T.recoil;
  const dec = T.decimal;
  const [id, setId] = useState('boat');
  const [p, setP] = useState(SCEN.boat.def);
  const [sim, setSim] = useState(IDLE);
  const sc = SCEN[id];
  const st = tx.sc[id];
  const pu = sc.kind === 'pulse' ? pulseOf(id, p) : null;
  const started = sim.t > 0;

  useRafLoop(sim.running, (dt) => {
    setSim((q) => {
      if (!q.running) return q;
      let t = q.t;
      let rem = dt;
      if (pu && t < pu.dt) {
        const need = (pu.dt - t) * pu.slow;
        if (rem < need) {
          t += rem / pu.slow;
          rem = 0;
        } else {
          t = pu.dt;
          rem -= need;
        }
      }
      t += rem;
      let done = t >= sc.tEnd;
      if (pu) {
        const sB = travel(pu.aB, t, pu.dt).s;
        const back = id === 'boat' ? 1.3 : 1.1;
        if (-sB - back < sc.box.x0 + 0.2) done = true;
      }
      return done ? { running: false, t: Math.min(t, sc.tEnd), done: true } : { ...q, t };
    });
  });

  const pick = (nid) => {
    setId(nid);
    setP(SCEN[nid].def);
    setSim(IDLE);
  };
  const set = (k) => (v) => {
    setP((q) => ({ ...q, [k]: v }));
    setSim(IDLE);
  };
  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((q) => ({ ...q, running: !q.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- numbers */
  const N = T.common.N;
  const kN = T.common.kN;
  const big = (x) => bigNum(x, dec);
  const forceText = (F) => (F >= 10000 ? `${fmtt(F / 1000, 1, dec)} ${kN}` : `${big(F)} ${N}`);
  let F;
  let vA;
  let vB;
  let rk = null;
  if (pu) {
    F = pu.F;
    vA = travel(pu.aA, sim.t, pu.dt).v;
    vB = travel(pu.aB, sim.t, pu.dt).v;
  } else {
    rk = rocketAt(p, sim.t);
    F = p.mA * p.v;
    vA = p.v;
    vB = rk.V;
  }
  const acting = started && (pu ? sim.t < pu.dt : rk.burning);

  /* ---- explanation */
  let key = 'idle';
  if (started) key = acting ? 'act' : 'after';
  const ex = st.explain;
  let text = ex.idle;
  if (key === 'act') {
    if (id === 'boat') text = ex.act(forceText(F));
    else if (id === 'cannon') text = ex.act(forceText(F), fmt(travel(pu.aB, sim.t, pu.dt).s * 100, 1, dec));
    else text = ex.act(forceText(F), fmtt(rk.a, 2, dec));
  } else if (key === 'after') {
    if (pu) text = ex.after(fmtt(p.v, 1, dec), fmt(pu.V, 2, dec), fmtt(p.mB / p.mA, 1, dec));
    else text = ex.after(fmt(rk.V, 1, dec));
  }
  const tone = key === 'act' ? '#f87171' : key === 'after' ? '#34d399' : '#22d3ee';

  let chip = T.common.realTime;
  let chipShort = chip;
  if (pu && (!started || sim.t < pu.dt)) {
    chip = T.common.slowed(st.phase, groupThousands(Math.round(pu.slow)));
    chipShort = T.common.slowedShort(groupThousands(Math.round(pu.slow)));
  }

  const legend = [
    { label: tx.legend.force, color: COL.force, kind: 'arrow' },
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
    { label: st.legendA, color: COL.b1, kind: 'dot' },
    { label: st.legendB, color: COL.b2, kind: 'dot' },
  ];

  /* ---- worked numbers */
  const f2 = (x) => numt(x, dec, 3);
  let rows;
  if (pu) {
    rows = [
      { sym: 'F', color: COL.forceText, formula: 'm·v / Δt', subst: `${f2(p.mA)} · ${f2(p.v)} / ${f2(pu.dt)}`, result: forceText(F) },
      { sym: 'a_m', color: COL.b1Text, formula: 'F / m', subst: `${big(F)} / ${f2(p.mA)}`, result: `${big(pu.aA)} ${T.ms2}` },
      { sym: 'a_M', color: COL.b2Text, formula: 'F / M', subst: `${big(F)} / ${big(p.mB)}`, result: `${f2(pu.aB)} ${T.ms2}` },
      { sym: 'V', color: COL.velText, formula: 'a_M·Δt = m·v / M', subst: `${f2(p.mA)} · ${f2(p.v)} / ${big(p.mB)}`, result: `${f2(pu.V)} ${T.ms}` },
    ];
    if (id === 'cannon') rows.unshift({ sym: 'Δt', color: '#a5f3fc', formula: '2L / v', subst: `2 · ${BARREL} / ${f2(p.v)}`, result: `${f2(pu.dt)} ${T.s}` });
  } else {
    const a0 = F / p.mB;
    rows = [
      { sym: 'F', color: COL.forceText, formula: 'μ·u', subst: `${f2(p.mA)} · ${big(p.v)}`, result: `${big(F)} ${N}` },
      { sym: 'a', color: COL.accText, formula: 'F / M₀', subst: `${big(F)} / ${big(p.mB)}`, result: `${f2(a0)} ${T.ms2}` },
      { sym: 'V', color: COL.velText, formula: `a·t`, subst: `${f2(a0)} · ${BURN}`, result: `${f2(a0 * BURN)} ${T.ms}`, approx: true },
    ];
  }

  const sl = st.sliders;
  const unitsOf = { mA: sc.kind === 'jet' ? tx.kgs : T.common.kg, mB: T.common.kg, v: T.ms };
  const symOf = sc.kind === 'jet' ? { mA: 'μ', mB: 'M₀', v: 'u' } : { mA: 'm', mB: 'M', v: 'v' };
  const accents = { mA: COL.b1, mB: COL.b2, v: COL.vel };
  const digits = (k) => (sc.ranges[k][2] < 1 ? 1 : 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.presetsLabel}
        value={id}
        onChange={pick}
        options={ORDER.map((k) => ({ value: k, label: tx.sc[k].name, sub: tx.sc[k].sub, icon: SCEN[k].icon }))}
      >
        <PlayButtons common={T.common} running={sim.running} started={started} done={sim.done} onToggle={toggle} onReset={reset} />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={<TimeChip text={chip} short={chipShort} />}
        ariaLabel={st.sceneLabel(forceText(F), fmt(vB, 2, dec))}
        height={(W, narrow) => clamp((W - (narrow ? 16 : 40)) / ASPECT + (narrow ? 60 : 80), narrow ? 220 : 330, 500)}
      >
        {(W, H, narrow) =>
          id === 'boat' ? (
            <BoatDrawing W={W} H={H} narrow={narrow} p={p} pu={pu} t={sim.t} F={F} forceText={forceText} st={st} tx={tx} T={T} />
          ) : id === 'cannon' ? (
            <CannonDrawing W={W} H={H} narrow={narrow} p={p} pu={pu} t={sim.t} F={F} forceText={forceText} st={st} tx={tx} T={T} />
          ) : (
            <RocketDrawing W={W} H={H} narrow={narrow} p={p} rk={rk} t={sim.t} F={F} forceText={forceText} st={st} tx={tx} T={T} />
          )
        }
      </SimScene>

      <Explain icon={Lightbulb} id={`${id}-${key}`} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.force}
          symbol="F"
          value={F >= 10000 ? fmtt(F / 1000, 1, dec) : big(F)}
          unit={F >= 10000 ? kN : N}
          accent={COL.force}
          textColor={COL.forceText}
          active={acting}
          sub={pu ? tx.readouts.forceSub(fmtt(pu.dt, 3, dec)) : tx.readouts.forceJet}
        />
        <Readout
          label={st.speedA}
          symbol={pu ? 'v' : 'u'}
          value={pu ? fmt(vA, vA >= 50 ? 0 : 2, dec) : big(vA)}
          unit={T.ms}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={pu ? tx.readouts.subA(numt(p.mA, dec), big(pu.aA)) : tx.readouts.subGas(fmtt(p.mA, 1, dec))}
        />
        <Readout
          label={st.speedB}
          symbol="V"
          value={fmt(vB, 2, dec)}
          unit={T.ms}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={pu ? tx.readouts.subB(big(p.mB), numt(pu.aB, dec)) : tx.readouts.subB(fmt(rk.M, 1, dec), fmtt(rk.a, 3, dec))}
        />
        {pu ? (
          <Readout
            label={tx.readouts.ratio}
            symbol="V : v"
            value={numt(p.mA / p.mB, dec, 2)}
            accent={COL.vel}
            textColor={COL.velText}
            sub={tx.readouts.ratioSub(numt(p.mA, dec), big(p.mB), big(F * pu.dt))}
          />
        ) : (
          <Readout label={tx.readouts.time} symbol="t" value={fmt(Math.min(sim.t, BURN), 1, dec)} unit={T.s} accent="#22d3ee" textColor="#a5f3fc" active={acting} sub={tx.readouts.timeSub(BURN)} />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          {['mA', 'mB', 'v'].map((k) => (
            <RangeField
              key={`${id}-${k}`}
              id={`n3-${id}-${k}`}
              label={sl[k]}
              symbol={symOf[k]}
              min={sc.ranges[k][0]}
              max={sc.ranges[k][1]}
              step={sc.ranges[k][2]}
              value={p[k]}
              onChange={set(k)}
              accent={accents[k]}
              display={`${digits(k) ? fmt(p[k], 1, dec) : big(p[k])} ${unitsOf[k]}`}
            />
          ))}
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-xs leading-snug text-gray-400">{st.hint}</p>
        </Panel>
        <Panel className="lg:col-span-3">
          <Calc title={tx.calcTitle} rows={rows} note={st.calcNote} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================ scenes */

function sceneSetup(W, H, narrow, box) {
  const pad = narrow ? { l: 8, r: 8, t: 44, b: 22 } : { l: 20, r: 20, t: 56, b: 26 };
  const view = makeView(box, W, H, pad);
  return { view, k: view.k, fs: narrow ? 10.5 : 12, bx: { w: W, h: H } };
}

/** Value label of a force: a pill on wide screens, the bare symbol on a phone. */
function ForceLabel({ narrow, x, y, sym, text, box, fs, anchor = 'middle' }) {
  if (narrow) return <Tag x={x} y={y + 4} text={sym} color={COL.force} size={fs + 1} anchor={anchor} />;
  return <RichPill x={x} y={y} text={text} bg={COL.force} size={fs} box={box} />;
}

/* ---------------------------------------------------------------- boat */

function BoatDrawing({ W, H, narrow, p, pu, t, F, forceText, st, tx, T }) {
  const sc = SCEN.boat;
  const dec = T.decimal;
  const { view, k, fs, bx } = sceneSetup(W, H, narrow, sc.box);
  const wy = view.sy(0);
  const sB = travel(pu.aB, t, pu.dt);
  const xc = -sB.s;
  const boy = boyAt(p, pu, t);
  const h = (1.35 + (0.3 * (p.mA - 30)) / 40) * k;
  const pushing = t > 0 && t < pu.dt;
  const kF = sc.mPerN * k;
  const kV = 0.55 * k;
  const S = (x, y) => `${view.sx(x).toFixed(1)},${view.sy(y).toFixed(1)}`;
  const hull = [S(xc - 1.3, 0.38), S(xc + 1.38, 0.38), S(xc + 0.95, -0.24), S(xc - 1.12, -0.24)].join(' ');
  const stripe = [S(xc - 1.26, 0.3), S(xc + 1.32, 0.3), S(xc + 1.27, 0.22), S(xc - 1.23, 0.22)].join(' ');

  // the boy's pose
  let crouch = 0.15;
  let lean = -0.05;
  const bfx = view.sx(boy.x);
  const bfy = view.sy(boy.y);
  const f = clamp(t / pu.dt, 0, 1);
  if (boy.phase === 'push' && t > 0) {
    crouch = 0.5 - 0.45 * f;
    lean = -0.38;
  } else if (boy.phase === 'fly') {
    crouch = 0.4;
    lean = -0.18;
  }
  const sh = shoulderOf({ fx: bfx, fy: bfy, h, dir: 1, lean, crouch });
  let hand = null;
  if (boy.phase === 'push' && t > 0) hand = { x: sh.x + 0.3 * h * f, y: sh.y + 0.32 * h - 0.4 * h * f };
  else if (boy.phase === 'fly') hand = { x: sh.x + 0.3 * h, y: sh.y - 0.1 * h };
  const hipH = 0.47 * h * (1 - 0.32 * crouch);
  const torso = { x: bfx + Math.sin(-lean) * (hipH + 0.15 * h), y: bfy - Math.cos(lean) * (hipH + 0.15 * h) };
  const lenF = F * kF;
  const deckY = view.sy(0.38);

  // ripples
  const waves = [];
  for (let x = Math.floor(sc.box.x0); x < sc.box.x1; x += 0.8) waves.push(`M${view.sx(x)},${wy} q${0.2 * k},${-0.06 * k} ${0.4 * k},0 t${0.4 * k},0`);
  const splash = boy.phase === 'swim' && boy.since < 0.7;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} />
      <AxisNumbers view={view} W={W} H={H} xUnit={T.common.axisX} showY={false} decimal={dec} />
      {/* start mark */}
      <line x1={view.sx(0)} x2={view.sx(0)} y1={wy} y2={view.sy(2.3)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />

      {/* boy (behind the near side of the boat) */}
      {boy.phase === 'swim' ? (
        <g>
          <circle cx={bfx} cy={wy - 0.16 * k} r={0.11 * k} fill="#f6d3b3" stroke="#1e293b" strokeWidth="1" />
          <path d={`M${bfx - 0.2 * k},${wy} q${0.2 * k},${-0.12 * k} ${0.4 * k},0`} fill={COL.b1} />
        </g>
      ) : (
        <Person fx={bfx} fy={bfy} h={h} dir={1} lean={lean} crouch={crouch} hand={hand} color={COL.b1} stride={boy.phase === 'fly' ? 0.1 : 0.2} />
      )}

      {/* boat */}
      <polygon points={hull} fill="#a16207" stroke="#713f12" strokeWidth="2" strokeLinejoin="round" />
      <polygon points={stripe} fill={COL.b2} />
      <line x1={view.sx(xc - 1.3)} x2={view.sx(xc + 1.38)} y1={deckY} y2={deckY} stroke="#713f12" strokeWidth="3" strokeLinecap="round" />
      {!narrow && <RichPill x={view.sx(xc - 0.75)} y={view.sy(0.68)} text={tx.massTag('M', bigNum(p.mB, dec))} bg="#fff" color={COL.b2} border="#fbcfe8" size={fs} box={bx} />}

      {/* water in front */}
      <rect x={0} y={wy} width={W} height={H - wy} fill="#bfdbfe" fillOpacity="0.55" />
      <path d={waves.join(' ')} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      {splash && (
        <g opacity={1 - boy.since / 0.7}>
          {[0.3, 0.55, 0.8].map((r0) => (
            <ellipse key={r0} cx={view.sx(boy.xl)} cy={wy} rx={(r0 + boy.since) * 0.6 * k} ry={(r0 + boy.since) * 0.14 * k} fill="none" stroke="#3b82f6" strokeWidth="2" />
          ))}
        </g>
      )}

      {!narrow && boy.phase !== 'swim' && <RichPill x={bfx} y={bfy - h - 0.25 * k} text={tx.massTag('m', numt(p.mA, dec))} bg="#fff" color={COL.b1} border="#bfdbfe" size={fs} box={bx} />}

      {/* the pair of forces */}
      {pushing && (
        <>
          <ForceArrow x={torso.x} y={torso.y} dx={lenF} dy={0} color={COL.force} dot={COL.b1} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceArrow x={bfx} y={deckY} dx={-lenF} dy={0} color={COL.force} dot={COL.b2} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceLabel narrow={narrow} x={narrow ? torso.x + lenF + 4 : torso.x + lenF / 2 + 10} y={torso.y - (narrow ? 0 : 18)} sym="F" anchor="start" text={`${st.forceA} · ${forceText(F)}`} box={bx} fs={fs} />
          <ForceLabel narrow={narrow} x={narrow ? bfx - lenF - 4 : bfx - lenF / 2} y={narrow ? deckY : view.sy(-0.5)} sym="F′" anchor="end" text={`${st.forceB} · ${forceText(F)}`} box={bx} fs={fs} />
        </>
      )}

      {/* velocities */}
      {t > 0 && boy.phase !== 'swim' && (
        <>
          <ForceArrow x={bfx} y={view.sy(2.3)} dx={travel(pu.aA, t, pu.dt).v * kV} dy={0} color={COL.vel} width={3} head={10} />
          {!narrow && <RichPill x={bfx + (travel(pu.aA, t, pu.dt).v * kV) / 2} y={view.sy(2.3) - 16} text={tx.vTag('v', fmt(travel(pu.aA, t, pu.dt).v, 2, dec))} bg={COL.vel} size={fs} box={bx} />}
        </>
      )}
      {t > 0 && sB.v * kV > 4 && (
        <>
          <ForceArrow x={view.sx(xc)} y={view.sy(1.2)} dx={-sB.v * kV} dy={0} color={COL.vel} width={3} head={10} />
          {narrow ? (
            <Tag x={view.sx(xc) - sB.v * kV - 4} y={view.sy(1.2) + 4} text="V" color={COL.vel} size={fs + 1} anchor="end" />
          ) : (
            <RichPill x={view.sx(xc) - (sB.v * kV) / 2} y={view.sy(1.2) - 16} text={tx.vTag('V', fmt(sB.v, 2, dec))} bg={COL.vel} size={fs} box={bx} />
          )}
        </>
      )}

      <ScaleBar x={narrow ? 14 : 26} y={H - 40} len={sc.scaleN * kF} color={COL.force} text={`${sc.scaleN} ${T.common.N}`} size={narrow ? 10 : 11} />
    </g>
  );
}

/* -------------------------------------------------------------- cannon */

function CannonDrawing({ W, H, narrow, p, pu, t, F, forceText, st, tx, T }) {
  const sc = SCEN.cannon;
  const dec = T.decimal;
  const { view, k, fs, bx } = sceneSetup(W, H, narrow, sc.box);
  const gy = view.sy(0);
  const sB = travel(pu.aB, t, pu.dt);
  const sA = travel(pu.aA, t, pu.dt);
  const xc = -sB.s;
  const ay = 1; // barrel axis
  const xb = xc - 0.45; // breech
  const xm = xc + 0.92; // muzzle
  const xs = -0.08 + sA.s; // shell centre
  const inBarrel = t < pu.dt;
  const firing = t > 0 && inBarrel;
  const kF = sc.mPerN * k;
  const kV = 0.6 * k;
  const lenF = F * kF;
  const rWheel = 0.5;
  const wheelDeg = ((xc / rWheel) * 180) / Math.PI;
  const tOut = t - pu.dt; // real seconds since the shell left
  const Y = view.sy(ay);
  const bore = 0.1 * k;
  const outer = 0.21 * k;

  const spokes = [];
  for (let i = 0; i < 8; i += 1) {
    const b = (i / 8) * Math.PI * 2;
    spokes.push(<line key={i} x1={0} y1={0} x2={Math.cos(b) * rWheel * k * 0.88} y2={Math.sin(b) * rWheel * k * 0.88} stroke="#78350f" strokeWidth={Math.max(1.5, 0.035 * k)} />);
  }

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} />
      <rect x={0} y={gy} width={W} height={H - gy} fill="#ecfccb" />
      <line x1={0} x2={W} y1={gy} y2={gy} stroke="#84cc16" strokeWidth="2" />
      <AxisNumbers view={view} W={W} H={H} xUnit={T.common.axisX} showY={false} decimal={dec} />
      <line x1={view.sx(0)} x2={view.sx(0)} y1={gy} y2={view.sy(2.6)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />

      {/* trail and carriage */}
      <polygon
        points={[
          [xc + 0.25, 0.75],
          [xc - 0.15, 0.85],
          [xc - 1.1, 0.08],
          [xc - 1.05, 0],
        ]
          .map(([x, y]) => `${view.sx(x)},${view.sy(y)}`)
          .join(' ')}
        fill="#92400e"
        stroke="#713f12"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <g transform={`translate(${view.sx(xc + 0.15)} ${view.sy(rWheel)}) rotate(${wheelDeg.toFixed(1)})`}>
        <circle r={rWheel * k} fill="none" stroke="#78350f" strokeWidth={Math.max(3, 0.07 * k)} />
        {spokes}
        <circle r={0.07 * k} fill="#451a03" />
      </g>
      {/* barrel: a cut-away so the shell can be seen inside */}
      <rect x={view.sx(xb)} y={Y - outer} width={(xm - xb) * k} height={outer * 2} rx={outer * 0.6} fill="#334155" />
      <rect x={view.sx(xb + 0.12)} y={Y - bore} width={(xm - xb - 0.12) * k + 2} height={bore * 2} fill="#e2e8f0" />
      <rect x={view.sx(xb + 0.18)} y={Y - outer} width={0.1 * k} height={outer * 2} fill={COL.b2} />
      {firing && <rect x={view.sx(xb + 0.12)} y={Y - bore} width={Math.max(0, (xs - 0.12 - (xb + 0.12)) * k)} height={bore * 2} fill="#fde68a" />}
      {inBarrel && <rect x={view.sx(xs - 0.12)} y={Y - bore * 0.92} width={0.26 * k} height={bore * 1.84} rx={bore * 0.9} fill={COL.b1} />}
      {!narrow && (
        <text x={view.sx(xc - 0.6)} y={view.sy(1.95)} textAnchor="middle" fontSize={fs} fontWeight="700" fill={COL.b2}>
          {tx.massTag('M', bigNum(p.mB, dec))}
        </text>
      )}

      {/* flash and smoke after the shot */}
      {!inBarrel && tOut < 1.4 && (
        <g opacity={clamp(1 - tOut / 1.4, 0, 1)}>
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={view.sx(0.95 + 0.25 * i + tOut * 0.5)} cy={view.sy(ay + 0.1 * i + tOut * 0.25)} r={(0.15 + 0.12 * i + tOut * 0.35) * k} fill="#cbd5e1" opacity="0.7" />
          ))}
          {tOut < 0.12 && <circle cx={view.sx(1.05)} cy={Y} r={0.35 * k} fill="#fbbf24" opacity="0.9" />}
        </g>
      )}
      {/* the shell in flight: too fast to follow, so only its streak */}
      {!inBarrel && tOut < 0.3 && (
        <g opacity={1 - tOut / 0.3}>
          <line x1={view.sx(1)} x2={W} y1={Y} y2={Y} stroke={COL.b1} strokeWidth={bore} strokeLinecap="round" opacity="0.35" />
        </g>
      )}
      {t === 0 && !narrow && <RichPill x={view.sx(-0.08)} y={Y - outer - 18} text={tx.massTag('m', numt(p.mA, dec))} bg="#fff" color={COL.b1} border="#bfdbfe" size={fs} box={bx} />}
      {firing && !narrow && <RichPill x={view.sx(xs)} y={Y - outer - 48} text={tx.vTag('v', fmt(sA.v, 0, dec))} bg={COL.vel} size={fs} box={bx} />}
      {t > 0 && !inBarrel && (
        <RichPill x={W - 10} y={Y - outer - 18} text={tx.shellGone(fmt(sA.v, 0, dec))} bg={COL.b1} size={fs} box={bx} />
      )}

      {/* the forces while the gas pushes */}
      {firing && (
        <>
          <ForceArrow x={view.sx(xs)} y={Y} dx={lenF} dy={0} color={COL.force} dot={COL.b1} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceArrow x={view.sx(xb + 0.12)} y={Y} dx={-lenF} dy={0} color={COL.force} dot={COL.b2} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceLabel narrow={narrow} x={narrow ? view.sx(xs) + lenF + 4 : view.sx(xs) + lenF / 2 + 20} y={Y - outer - (narrow ? 10 : 20)} sym="F" anchor="start" text={`${st.forceA} · ${forceText(F)}`} box={bx} fs={fs} />
          <ForceLabel narrow={narrow} x={narrow ? view.sx(xb + 0.12) - lenF - 4 : view.sx(xb + 0.12) - lenF / 2} y={Y - outer - (narrow ? 10 : 20)} sym="F′" anchor="end" text={`${st.forceB} · ${forceText(F)}`} box={bx} fs={fs} />
        </>
      )}

      {/* recoil velocity */}
      {t > 0 && sB.v * kV > 4 && (
        <>
          <ForceArrow x={view.sx(xc)} y={view.sy(2.15)} dx={-sB.v * kV} dy={0} color={COL.vel} width={3} head={10} />
          {narrow ? (
            <Tag x={view.sx(xc) - sB.v * kV - 4} y={view.sy(2.15) + 4} text="V" color={COL.vel} size={fs + 1} anchor="end" />
          ) : (
            <RichPill x={view.sx(xc) - (sB.v * kV) / 2} y={view.sy(2.15) - 16} text={tx.vTag('V', fmt(sB.v, 2, dec))} bg={COL.vel} size={fs} box={bx} />
          )}
        </>
      )}

      <ScaleBar x={narrow ? 14 : 26} y={H - 40} len={sc.scaleN * kF} color={COL.force} text={`${fmtt(sc.scaleN / 1000, 0, dec)} ${T.common.kN}`} size={narrow ? 10 : 11} />
    </g>
  );
}

/* -------------------------------------------------------------- rocket */

function RocketDrawing({ W, H, narrow, p, rk, t, F, forceText, st, tx, T }) {
  const sc = SCEN.rocket;
  const dec = T.decimal;
  const xR = rk.X;
  const box = { x0: xR - 12.5, x1: xR + 7.5, y0: -2.8, y1: 2.8 };
  const { view, k, fs, bx } = sceneSetup(W, H, narrow, box);
  const burning = t > 0 && rk.burning;
  const kF = sc.mPerN * k;
  const kV = 0.2 * k;
  const lenF = F * kF;
  const S = (x, y) => `${view.sx(x).toFixed(1)},${view.sy(y).toFixed(1)}`;
  const cy = view.sy(0);
  const r = 0.5;
  const exitX = xR - 2.75;

  // the plume and the gas puffs (drawn in the rocket's frame; real gas is far faster)
  const flick = 1 + 0.08 * Math.sin(t * 47) + 0.05 * Math.sin(t * 83);
  const Lp = (1.6 + 2.6 * p.mA) * flick;
  const puffs = [];
  if (t > 0) {
    const t1 = Math.min(t, BURN);
    for (let i = Math.max(0, Math.floor((t - 0.9) / 0.06)); i * 0.06 <= t1; i += 1) {
      const age = t - i * 0.06;
      if (age < 0 || age > 0.9) continue;
      const wob = Math.sin(i * 12.9898) * 0.35;
      puffs.push(<circle key={i} cx={view.sx(exitX - 1 - 14 * age)} cy={view.sy(wob * (0.4 + age))} r={(0.12 + 0.45 * age) * k} fill="#93c5fd" opacity={0.5 * (1 - age / 0.9)} />);
    }
  }

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} />
      <AxisNumbers view={view} W={W} H={H} xUnit={T.common.axisX} showY={false} decimal={dec} />
      {view.sx(0) > 0 && view.sx(0) < W && (
        <g>
          <line x1={view.sx(0)} x2={view.sx(0)} y1={view.sy(-2.2)} y2={view.sy(2.2)} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />
          {!narrow && (
            <text x={view.sx(0) + 6} y={view.sy(2.2) + 4} fontSize={11} fill={COL.muted}>
              {tx.start}
            </text>
          )}
        </g>
      )}

      {puffs}
      {burning && (
        <g>
          <polygon points={[S(exitX, 0.4), S(exitX - Lp, 0.15), S(exitX - Lp - 0.4, 0), S(exitX - Lp, -0.15), S(exitX, -0.4)].join(' ')} fill="#bfdbfe" />
          <polygon points={[S(exitX, 0.24), S(exitX - Lp * 0.6, 0.06), S(exitX - Lp * 0.6, -0.06), S(exitX, -0.24)].join(' ')} fill="#eff6ff" />
        </g>
      )}

      {/* rocket */}
      <polygon points={[S(xR - 2.2, 0.3), S(xR - 2.75, 0.42), S(xR - 2.75, -0.42), S(xR - 2.2, -0.3)].join(' ')} fill="#64748b" />
      <polygon points={[S(xR - 1.5, r), S(xR - 2.3, 1.05), S(xR - 2.3, r)].join(' ')} fill={COL.b2} />
      <polygon points={[S(xR - 1.5, -r), S(xR - 2.3, -1.05), S(xR - 2.3, -r)].join(' ')} fill={COL.b2} />
      <path
        d={`M${S(xR - 2.25, r)} L${S(xR + 1.5, r)} Q${S(xR + 2.6, r * 0.75)} ${S(xR + 2.95, 0)} Q${S(xR + 2.6, -r * 0.75)} ${S(xR + 1.5, -r)} L${S(xR - 2.25, -r)} Z`}
        fill="#f8fafc"
        stroke="#475569"
        strokeWidth="2"
      />
      <rect x={view.sx(xR - 1.2)} y={view.sy(r)} width={0.22 * k} height={2 * r * k} fill={COL.b2} />
      <circle cx={view.sx(xR + 1.05)} cy={cy} r={0.2 * k} fill="#bae6fd" stroke="#475569" strokeWidth="1.5" />
      {!narrow && <RichPill x={view.sx(xR + 0.4)} y={view.sy(-r) + 18} text={tx.massTag('M', fmt(rk.M, 1, dec))} bg="#fff" color={COL.b2} border="#fbcfe8" size={fs} box={bx} />}

      {/* the pair: gas → rocket and rocket → gas */}
      {burning && (
        <>
          <ForceArrow x={view.sx(xR - 2.2)} y={cy} dx={lenF} dy={0} color={COL.force} dot={COL.b2} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceArrow x={view.sx(exitX)} y={cy} dx={-lenF} dy={0} color={COL.force} dot={COL.b1} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
          <ForceLabel narrow={narrow} x={narrow ? view.sx(xR - 2.2) + lenF + 4 : view.sx(xR - 1)} y={narrow ? cy : view.sy(r) - 34} sym="F" anchor="start" text={`${st.forceB} · ${forceText(F)}`} box={bx} fs={fs} />
          <ForceLabel narrow={narrow} x={narrow ? view.sx(exitX) - lenF - 4 : view.sx(exitX) - lenF / 2} y={narrow ? cy - 14 : view.sy(-0.62) + 12} sym="F′" anchor="end" text={`${st.forceA} · ${forceText(F)}`} box={bx} fs={fs} />
        </>
      )}

      {/* speed */}
      {t > 0 && rk.V * kV > 4 && (
        <>
          <ForceArrow x={view.sx(xR)} y={view.sy(1.75)} dx={rk.V * kV} dy={0} color={COL.vel} width={3} head={10} />
          {narrow ? (
            <Tag x={view.sx(xR) + rk.V * kV + 4} y={view.sy(1.75) + 4} text="V" color={COL.vel} size={fs + 1} anchor="start" />
          ) : (
            <RichPill x={view.sx(xR) + (rk.V * kV) / 2} y={view.sy(1.75) - 16} text={tx.vTag('V', fmt(rk.V, 2, dec))} bg={COL.vel} size={fs} box={bx} />
          )}
        </>
      )}

      <ScaleBar x={narrow ? 14 : 26} y={H - 40} len={sc.scaleN * kF} color={COL.force} text={`${sc.scaleN} ${T.common.N}`} size={narrow ? 10 : 11} />
    </g>
  );
}
