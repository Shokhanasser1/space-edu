import { useMemo, useState } from 'react';
import { Lightbulb, MoveUpRight, Package, Sparkles, TrendingUp } from 'lucide-react';

import { Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import {
  AngleArc,
  BarEquation,
  Chip,
  DimLine,
  EC,
  Eq,
  EtaBar,
  FC,
  FikPanel,
  FlowPaper,
  ForceArrow,
  ForceScale,
  G,
  Ground,
  GroupLabel,
  LabScene,
  Panel,
  PlayControls,
  SankeyFlow,
  SceneRow,
  Step,
  Sym,
  SvgSym,
  deg,
  rad,
} from './Efficiency.parts';

/**
 * Tab 1 — pushing a crate up an inclined plane with friction, at constant
 * speed (so its kinetic energy does not change):
 *   F = mg(sinα + μcosα), sinα = h / l
 *   useful work  A_f = mgh          (the crate's E_p)
 *   total work   A_t = F·l
 *   heat         Q = μmg·cosα · l   (A_t = A_f + Q)
 *   η = A_f / A_t = sinα / (sinα + μcosα) — does not depend on m.
 * Preset m = 20 kg, h = 1 m, l = 4 m, μ = 0.1:
 *   sinα = 0.25, cosα = 0.9682, F = 196·0.3468 = 67.98 N,
 *   A_f = 196 J, A_t = 271.9 J, Q = 75.9 J, η = 72.1 %;
 *   gain in force mg/F = 2.88, loss in distance l/h = 4, η = 2.88 / 4.
 */

const SPEED = 0.8; // m/s along the ramp, real time
const H_MIN = 0.2;
const H_MAX = 2;
const L_MIN = 1;
const L_MAX = 6;
const MAX_SIN = 0.8; // α ≤ 53°
const IDLE = { p: 0, running: false, done: false };

const PRESETS = {
  lesson: { m: 20, h: 1, l: 4, mu: 0.1, icon: Package },
  ideal: { m: 20, h: 1, l: 4, mu: 0, icon: Sparkles },
  gentle: { m: 20, h: 0.5, l: 5, mu: 0.1, icon: TrendingUp },
  steep: { m: 20, h: 2, l: 4, mu: 0.1, icon: MoveUpRight },
};

/** Everything about the ramp that does not change while the crate moves. */
function rampPhysics(m, h, l, mu) {
  const sa = h / l;
  const ca = Math.sqrt(1 - sa * sa);
  const mg = m * G;
  const N = mg * ca;
  const fr = mu * N;
  const F = mg * sa + fr;
  const Af = mg * h;
  const At = F * l;
  const Q = fr * l;
  return { sa, ca, alpha: deg(Math.asin(sa)), mg, N, fr, F, Af, At, Q, eta: Af / At };
}

/* ==================================================================== sim */

export default function InclineSim({ T }) {
  const L = T.incline;
  const dec = T.decimal;
  const [m, setM] = useState(20);
  const [h, setH] = useState(1);
  const [l, setL] = useState(4);
  const [mu, setMu] = useState(0.1);
  const [sim, setSim] = useState(IDLE);
  const [touched, setTouched] = useState(false);

  const ph = useMemo(() => rampPhysics(m, h, l, mu), [m, h, l, mu]);
  const preset = Object.keys(PRESETS).find((k) => {
    const p = PRESETS[k];
    return p.m === m && p.h === h && p.l === l && p.mu === mu;
  });

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const np = Math.min(1, p.p + (dt * SPEED) / l);
      const done = np >= 1 - 1e-9;
      return { p: done ? 1 : np, running: !done, done };
    });
  });

  const change = (fn) => (v) => {
    fn(v);
    setSim(IDLE);
    setTouched(true);
  };
  const changeH = change((v) => setH(clamp(Math.round(v * 10) / 10, H_MIN, Math.min(H_MAX, MAX_SIN * l))));
  const changeL = change((v) => {
    setL(v);
    setH((hh) => Math.min(hh, Math.floor(MAX_SIN * v * 10 + 1e-9) / 10));
  });
  const pick = (id) => {
    const p = PRESETS[id];
    setM(p.m);
    setH(p.h);
    setL(p.l);
    setMu(p.mu);
    setSim(IDLE);
    setTouched(true);
  };
  const toggle = () => {
    setTouched(true);
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);

  /* ---- live values */
  const s = sim.p * l;
  const t = s / SPEED;
  const hNow = sim.p * h;
  const AfNow = ph.mg * hNow;
  const AtNow = ph.F * s;
  const QNow = ph.fr * s;
  const ideal = mu === 0;
  const E1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const P1 = (n) => fmt(n * 100, 1, dec);
  const gainF = ph.mg / ph.F;
  const lossS = l / h;

  /* ---- explanation */
  let key;
  if (sim.done) key = ideal ? 'doneIdeal' : 'done';
  else if (sim.p > 0) key = ideal ? 'movingIdeal' : 'moving';
  else if (!touched) key = 'intro';
  else if (ideal) key = 'ideal';
  else if (ph.alpha <= 8) key = 'gentle';
  else if (ph.alpha >= 25) key = 'steep';
  else key = 'setup';
  const settled = useSettled(key, sim.running ? 250 : 0);
  const ex = L.explain;
  const text = {
    intro: ex.intro,
    setup: ex.setup(F2(ph.F), F2(gainF), fmt(lossS, 2, dec), P1(ph.eta)),
    gentle: ex.gentle(F2(ph.F), P1(ph.eta)),
    steep: ex.steep(F2(ph.F), P1(ph.eta)),
    ideal: ex.ideal(F2(ph.F), fmt(lossS, 2, dec)),
    moving: ex.moving(E1(AfNow), E1(QNow)),
    movingIdeal: ex.movingIdeal(E1(AfNow)),
    done: ex.done(E1(ph.Af), E1(ph.At), P1(ph.eta), E1(ph.Q)),
    doneIdeal: ex.doneIdeal(E1(ph.Af)),
  }[settled];
  const tone = {
    intro: '#22d3ee',
    setup: '#22d3ee',
    gentle: '#fb923c',
    steep: '#60a5fa',
    ideal: '#a78bfa',
    moving: '#fb923c',
    movingIdeal: '#60a5fa',
    done: '#34d399',
    doneIdeal: '#34d399',
  }[settled];

  const hMaxNow = Math.min(H_MAX, Math.floor(MAX_SIN * l * 10 + 1e-9) / 10);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.presetsLabel}</GroupLabel>
          <Segmented
            label={L.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={Object.keys(PRESETS).map((id) => ({ value: id, label: L.presets[id].name, sub: L.presets[id].sub, icon: PRESETS[id].icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.p > 0} onToggle={toggle} onReset={reset} />
      </div>

      <SceneRow
        under={
          <Explain icon={Lightbulb} id={settled} tone={tone}>
            <Sym>{text}</Sym>
          </Explain>
        }
        renderScene={(fitH) => (
          <InclineScene T={T} m={m} h={h} l={l} mu={mu} ph={ph} p={sim.p} t={t} running={sim.running} AfNow={AfNow} AtNow={AtNow} QNow={QNow} fitH={fitH} />
        )}
        side={<InclineFik T={T} m={m} h={h} l={l} mu={mu} ph={ph} flowing={sim.running} phase={t} />}
      />


      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={L.readouts.F}
          symbol="F"
          value={F2(ph.F)}
          unit={T.N}
          accent={FC.pull}
          textColor={FC.pullText}
          sub={<Sym>{L.FSub(E1(ph.mg), F2(gainF))}</Sym>}
        />
        <Readout
          label={L.readouts.Af}
          symbol={<Sym>{T.sym.Af}</Sym>}
          value={E1(AfNow)}
          unit={T.J}
          accent={EC.useful}
          textColor={EC.usefulText}
          active={sim.running}
          sub={L.AfSub(F2(hNow), fmt(h, 1, dec), E1(ph.Af))}
        />
        <Readout
          label={L.readouts.At}
          symbol={<Sym>{T.sym.At}</Sym>}
          value={E1(AtNow)}
          unit={T.J}
          accent={EC.inputBar}
          textColor={EC.inputText}
          active={sim.running}
          sub={L.AtSub(F2(s), fmt(l, 1, dec), E1(ph.At))}
        />
        <Readout label={L.readouts.eta} symbol="η" value={P1(ph.eta)} unit="%" accent="#22d3ee" textColor="#a5f3fc" sub={<Sym>{L.etaSub}</Sym>}>
          <EtaBar eta={ph.eta} />
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="eff-in-h"
            label={L.h}
            symbol="h"
            min={H_MIN}
            max={H_MAX}
            step={0.1}
            value={h}
            onChange={changeH}
            accent={EC.usefulBar}
            display={`${fmt(h, 1, dec)} ${T.m}`}
            hint={h >= hMaxNow - 1e-9 && hMaxNow < H_MAX ? L.hHintMax(fmt(hMaxNow, 1, dec)) : L.hHint(fmt(ph.sa, 3, dec), fmt(ph.alpha, 1, dec))}
          />
          <RangeField
            id="eff-in-l"
            label={L.l}
            symbol="l"
            min={L_MIN}
            max={L_MAX}
            step={0.5}
            value={l}
            onChange={changeL}
            accent={FC.pull}
            display={`${fmt(l, 1, dec)} ${T.m}`}
            hint={L.lHint(fmt(lossS, 2, dec))}
          />
          <RangeField
            id="eff-in-mu"
            label={L.mu}
            symbol="μ"
            min={0}
            max={0.5}
            step={0.05}
            value={mu}
            onChange={change(setMu)}
            accent={EC.heatBar}
            display={fmt(mu, 2, dec)}
            hint={mu > 0 ? <Sym>{L.muHint(F2(ph.fr))}</Sym> : L.muHintZero}
          />
          <RangeField
            id="eff-in-m"
            label={L.m}
            symbol="m"
            min={5}
            max={50}
            step={1}
            value={m}
            onChange={change(setM)}
            accent={FC.weight}
            display={`${m} ${T.kg}`}
            hint={L.mHint}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <InclineGraph T={T} mu={mu} alpha={ph.alpha} eta={ph.eta} fRatio={ph.F / ph.mg} onPick={(a) => changeH(l * Math.sin(rad(a)))} />
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================= scene */

function InclineScene({ T, m, h, l, mu, ph, p, t, running, AfNow, AtNow, QNow, fitH }) {
  const L = T.incline;
  const S = T.sym;
  const dec = T.decimal;
  const b = l * ph.ca;
  const lmg = (narrow, H) => (narrow ? 46 : clamp(H * 0.15, 62, 92));

  return (
    <LabScene
      legend={[
        { color: FC.weight, label: L.legend.mg, kind: 'arrow' },
        { color: FC.normal, label: L.legend.N, kind: 'arrow' },
        { color: FC.pull, label: L.legend.F, kind: 'arrow' },
        { color: FC.fric, label: L.legend.fr, kind: 'arrow' },
        { color: FC.vel, label: L.legend.v, kind: 'arrow' },
      ]}
      chips={(W, narrow, H) => (
        <>
          <Chip>{narrow ? L.chipShort(fmt(t, 2, dec)) : L.chip(fmt(t, 2, dec), fmt(SPEED, 1, dec))}</Chip>
          <ForceScale kF={lmg(narrow, H) / ph.mg} label={T.scale} unit={T.N} decimal={dec} />
        </>
      )}
      height={(W, narrow) => fitH ?? (narrow ? 340 : 470)}
      ariaLabel={L.sceneLabel(m, fmt(h, 1, dec), fmt(l, 1, dec), fmt(mu, 2, dec), fmt(ph.eta * 100, 1, dec))}
    >
      {(W, H, narrow) => {
        const Lmg = lmg(narrow, H);
        const pad = narrow ? { l: 30, r: 12, t: 16, b: 30 } : { l: 46, r: 18, t: 16, b: 36 };
        const platW = 0.75;
        // fit the ramp (and its h dimension) across the width; the sky fills the rest of the height
        const x0 = -0.45;
        const x1 = Math.max(b + platW + (narrow ? 0.8 : 1.0), 4.2);
        const kx = (W - pad.l - pad.r) / (x1 - x0);
        const view = makeView({ x0, x1, y0: 0, y1: Math.max(h + 0.9, (H - pad.t - pad.b) / kx) }, W, H, pad);
        const k = view.k;
        const fs = narrow ? 11 : 12.5;
        const box = { w: W, h: H };
        const ca = ph.ca;
        const sa = ph.sa;
        const uS = { x: ca, y: -sa }; // screen, up the slope
        const nS = { x: -sa, y: -ca }; // screen, out of the slope
        const P = (u) => ({ x: view.sx(u * ca), y: view.sy(u * sa) });

        /* the crate: a material point moving the whole slope; drawn from its base centre */
        const sc = clamp(Math.cbrt(m / 20), 0.75, 1.3);
        const cw = 0.5 * sc;
        const chh = 0.36 * sc;
        const uVis = cw / 2 + p * Math.max(0, l - cw);
        const base = P(uVis);
        const c = { x: base.x + (nS.x * chh * k) / 2, y: base.y + (nS.y * chh * k) / 2 };

        /* forces, to scale */
        const kF = Lmg / ph.mg;
        const A0 = P(0);
        const Atop = P(l);
        const C0 = { x: view.sx(b), y: view.sy(0) };
        const xDim = b + platW + 0.32;
        const groundY = view.sy(0);
        const hNowWorld = p * h;

        /* ruler ticks along the slope, every metre */
        const ticks = [];
        for (let u = 1; u < l - 0.25; u += 1) {
          const q = P(u);
          ticks.push(
            <g key={u}>
              <line x1={q.x} y1={q.y} x2={q.x - nS.x * 7} y2={q.y - nS.y * 7} stroke="#64748b" strokeWidth="1.2" />
              {!narrow && (
                <text x={q.x - nS.x * 17} y={q.y - nS.y * 17 + 4} textAnchor="middle" fontSize={fs - 2.5} fill="#94a3b8">
                  {u}
                </text>
              )}
            </g>,
          );
        }
        // the l dimension runs parallel to the slope, above the crate's path
        const lOff = Math.max(chh * k + (narrow ? 30 : 44), (chh * k) / 2 + Lmg + (narrow ? 32 : 40));
        const l1 = { x: A0.x + nS.x * lOff, y: A0.y + nS.y * lOff };
        const l2 = { x: Atop.x + nS.x * lOff, y: Atop.y + nS.y * lOff };

        const barsW = narrow ? 140 : 200;
        const barsH = narrow ? 150 : clamp(H * 0.36, 176, 270);
        const barsX = narrow ? 8 : 14;
        const barsY = narrow ? 8 : 84;

        return (
          <>
            <Grid view={view} W={W} H={H} />
            <AxisNumbers view={view} W={W} H={H} yUnit={L.axisY} xUnit={L.axisX} decimal={dec} />
            <Ground W={W} y={groundY} depth={H - groundY} />

            {/* the platform the crate is lifted onto, and the ramp */}
            <rect x={C0.x} y={view.sy(h)} width={platW * k} height={h * k} fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
            <line x1={C0.x + 4} x2={C0.x + platW * k - 4} y1={view.sy(h) + 6} y2={view.sy(h) + 6} stroke="#94a3b8" strokeWidth="1.2" />
            <polygon points={`${A0.x},${A0.y} ${Atop.x},${Atop.y} ${C0.x},${C0.y}`} fill="#e2e8f0" stroke="#475569" strokeWidth="2" strokeLinejoin="round" />
            <path d={`M${C0.x - 10},${C0.y} L${C0.x - 10},${C0.y - 10} L${C0.x},${C0.y - 10}`} fill="none" stroke="#64748b" strokeWidth="1.2" />
            {ticks}
            <AngleArc cx={A0.x} cy={A0.y} r={narrow ? 30 : 44} from={0} to={-rad(ph.alpha)} color="#0f172a" />
            <text
              x={A0.x + (narrow ? 22 : 30)}
              y={A0.y + fs + 6}
              fontSize={fs - 1}
              fontWeight="700"
              fill="#0f172a"
              stroke="#f1f5f9"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {L.alphaTag(fmt(ph.alpha, 1, dec))}
            </text>

            {/* dimensions: the height h (useful) and the slope length l (where F acts) */}
            <DimLine p1={{ x: view.sx(xDim), y: groundY }} p2={{ x: view.sx(xDim), y: view.sy(h) }} color={EC.useful} label={L.hTag(fmt(h, 1, dec))} fs={fs - 1} box={box} labelOffset={narrow ? -30 : 36} />
            <line x1={C0.x + platW * k} x2={view.sx(xDim) + 6} y1={view.sy(h)} y2={view.sy(h)} stroke={EC.useful} strokeWidth="1" strokeDasharray="3 3" />
            <line x1={A0.x} y1={A0.y} x2={l1.x} y2={l1.y} stroke={FC.pull} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <line x1={Atop.x} y1={Atop.y} x2={l2.x} y2={l2.y} stroke={FC.pull} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            <DimLine p1={l1} p2={l2} color={FC.pull} label={L.lTag(fmt(l, 1, dec))} fs={fs - 1} box={box} />

            {/* the height gained so far */}
            {p > 0 && (
              <>
                <line x1={base.x} x2={view.sx(xDim)} y1={view.sy(hNowWorld)} y2={view.sy(hNowWorld)} stroke={EC.useful} strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />
                <circle cx={view.sx(xDim)} cy={view.sy(hNowWorld)} r={3.5} fill={EC.useful} />
              </>
            )}

            {/* the crate */}
            <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) rotate(${(-ph.alpha).toFixed(2)})`}>
              {running && <rect x={(-cw * k) / 2 - 5} y={(-chh * k) / 2 - 5} width={cw * k + 10} height={chh * k + 10} rx={8} fill="#f59e0b" className="cl-pulse" opacity="0.25" />}
              <rect x={(-cw * k) / 2} y={(-chh * k) / 2} width={cw * k} height={chh * k} rx={3} fill="#fcd9a8" stroke="#b7791f" strokeWidth="2" />
              <line x1={(-cw * k) / 2 + 3} x2={(cw * k) / 2 - 3} y1={(-chh * k) / 2 + 3} y2={(chh * k) / 2 - 3} stroke="#e0b07a" strokeWidth="1.2" />
              <line x1={(-cw * k) / 2 + 3} x2={(cw * k) / 2 - 3} y1={(chh * k) / 2 - 3} y2={(-chh * k) / 2 + 3} stroke="#e0b07a" strokeWidth="1.2" />
              {cw * k > 52 && (
                <text x={(-cw * k) / 2 + 4} y={(-chh * k) / 2 + fs - 2} fontSize={fs - 3} fontWeight="700" fill="#92400e">
                  {m} {T.kg}
                </text>
              )}
            </g>

            {/* forces: mg, N, the push F up the slope, friction along the contact */}
            <ForceArrow x={c.x} y={c.y} dx={0} dy={Lmg} color={FC.weight} label={S.mg} fs={fs} box={box} labelAt={{ x: c.x + 8, y: c.y + Lmg + 2, anchor: 'start' }} />
            <ForceArrow x={c.x} y={c.y} dx={nS.x * ph.N * kF} dy={nS.y * ph.N * kF} color={FC.normal} label={S.N} fs={fs} box={box} />
            <ForceArrow x={c.x} y={c.y} dx={uS.x * ph.F * kF} dy={uS.y * ph.F * kF} color={FC.pull} label={S.F} fs={fs} box={box} />
            {ph.fr > 0 && (
              <ForceArrow
                x={base.x + nS.x * -5}
                y={base.y + nS.y * -5}
                dx={-uS.x * ph.fr * kF}
                dy={-uS.y * ph.fr * kF}
                color={FC.fric}
                label={S.fr}
                fs={fs}
                box={box}
              />
            )}
            <circle cx={c.x} cy={c.y} r={3.5} fill="#0f172a" stroke="#fff" strokeWidth="1.5" />
            {running && (
              <ForceArrow
                x={c.x + nS.x * (chh * k * 0.5 + 14) - (uS.x * cw * k) / 2}
                y={c.y + nS.y * (chh * k * 0.5 + 14) - (uS.y * cw * k) / 2}
                dx={uS.x * (narrow ? 26 : 36)}
                dy={uS.y * (narrow ? 26 : 36)}
                color={FC.vel}
                width={2.6}
                head={9}
                label={S.v}
                fs={fs}
                box={box}
              />
            )}

            {/* live bar equation  A_t = A_f + Q */}
            <BarEquation
              x={barsX}
              y={barsY}
              w={barsW}
              h={barsH}
              full={ph.At}
              title={L.barsTitle}
              fs={narrow ? 10 : 11}
              box={box}
              valueText={(v) => fmt(v, 1, dec)}
              cols={[
                { sym: S.At, value: AtNow, ghost: ph.At, color: EC.input, parts: [{ value: AtNow, color: EC.inputBar }] },
                { sym: S.Af, value: AfNow, ghost: ph.Af, color: EC.useful, parts: [{ value: AfNow, color: EC.usefulBar }] },
                { sym: S.Q, value: QNow, ghost: ph.Q, color: EC.heat, parts: [{ value: QNow, color: EC.heatBar }] },
              ]}
            />
          </>
        );
      }}
    </LabScene>
  );
}

/* ============================================================ FIK panel */

function InclineFik({ T, m, h, l, mu, ph, flowing, phase }) {
  const L = T.incline;
  const M = L.method;
  const S = T.sym;
  const dec = T.decimal;
  const E1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const P1 = (n) => fmt(n * 100, 1, dec);
  const gS = fmt(G, 1, dec);
  const hS = fmt(h, h % 1 ? 1 : 0, dec);
  const lS = fmt(l, l % 1 ? 1 : 0, dec);
  const gain = ph.mg / ph.F;
  const loss = l / h;
  const ideal = mu === 0;

  return (
    <FikPanel
      formula={M.formula}
      title={M.title}
      flow={
        <FlowPaper title={M.flowTitle} height={196} ariaLabel={M.flowLabel(E1(ph.At), E1(ph.Af), E1(ph.Q))}>
          {(W, H) => (
            <>
              <SvgSym x={12} y={44} text={S.At} value={`${E1(ph.At)} ${T.J}`} color="#334155" fs={12} anchor="start" halo={false} />
              <SankeyFlow
                box={{ x: 12, y: 54, w: W - 20, h: H - 64 }}
                total={ph.At}
                labelW={Math.min(150, W * 0.44)}
                flowing={flowing}
                phase={phase}
                items={[
                  { id: 'use', label: M.flowUseful, value: ph.Af, color: EC.useful, fill: EC.usefulBar, valueText: `${E1(ph.Af)} ${T.J} · ${P1(ph.eta)} %` },
                  { id: 'heat', label: M.flowHeat, value: ph.Q, color: EC.heat, fill: EC.heatBar, valueText: `${E1(ph.Q)} ${T.J} · ${P1(1 - ph.eta)} %` },
                ]}
              />
            </>
          )}
        </FlowPaper>
      }
    >
      <Step n={1} title={M.s1}>
        <Eq sym={`${S.Af} = mgh`} nums={`= ${m}·${gS}·${hS} =`} result={`${E1(ph.Af)} ${T.J}`} resultColor={EC.usefulText} />
      </Step>
      <Step n={2} title={M.s2}>
        <Eq sym="F = mg(sinα + μcosα)" nums={`= ${E1(ph.mg)}·(${fmt(ph.sa, 3, dec)} + ${fmt(mu, 2, dec)}·${fmt(ph.ca, 3, dec)}) = ${F2(ph.F)} ${T.N}`} />
        <Eq sym={`${S.At} = F·l`} nums={`= ${F2(ph.F)}·${lS} =`} result={`${E1(ph.At)} ${T.J}`} resultColor={EC.inputText} />
      </Step>
      <Step n={3} title={M.s3}>
        <Eq sym={`η = ${S.Af} / ${S.At} · 100 %`} nums={`= ${E1(ph.Af)} / ${E1(ph.At)} · 100 % =`} result={`${P1(ph.eta)} %`} resultColor="#a5f3fc" />
      </Step>
      <Step n={4} title={M.s4}>
        <p className="mt-0.5 tabular-nums">{M.gold(F2(gain), fmt(loss, 2, dec))}</p>
        <p className="mt-0.5 text-gray-400">{ideal ? M.goldIdeal : M.goldNote}</p>
      </Step>
    </FikPanel>
  );
}

/* ================================================================ graph */

function InclineGraph({ T, mu, alpha, eta, fRatio, onPick }) {
  const L = T.incline;
  const dec = T.decimal;
  const { etaPts, fPts, yMax } = useMemo(() => {
    const e = [];
    const f = [];
    let top = 100;
    for (let a = 0; a <= 60; a += 1) {
      const s = Math.sin(rad(a));
      const c = Math.cos(rad(a));
      e.push({ x: a, y: s + mu * c > 0 ? (100 * s) / (s + mu * c) : 0 });
      const fr = 100 * (s + mu * c);
      f.push({ x: a, y: fr });
      top = Math.max(top, fr);
    }
    return { etaPts: e, fPts: f, yMax: Math.ceil(top / 20 - 1e-9) * 20 };
  }, [mu]);
  return (
    <TimeGraph
      title={L.graph.title}
      series={[
        { id: 'eta', label: L.graph.eta, color: '#60a5fa', points: etaPts, dot: false },
        { id: 'f', label: L.graph.force, color: '#f472b6', points: fPts, dash: '6 5', dot: false },
        { id: 'nowF', label: L.graph.nowF, color: '#fbcfe8', points: [{ x: alpha, y: fRatio * 100 }] },
        { id: 'now', label: L.graph.now, color: '#ffffff', points: [{ x: alpha, y: eta * 100 }] },
      ]}
      xMax={60}
      yMax={yMax}
      xLabel={L.graph.x}
      yLabel={L.graph.y}
      marker={alpha}
      decimal={dec}
      height={262}
      onScrub={(x) => onPick(clamp(x, 1, 60))}
      note={mu > 0 ? L.graph.note : L.graph.noteIdeal}
    />
  );
}

