import { useState } from 'react';
import { BrickWall, Container, Lightbulb, Package, Timer, Weight, Zap } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Chip, ForceArrow, Formula, G, GroupLabel, HP, LabScene, LiveGraph, PC, PaperGrid, PlayControls, SidePill, SymbolText, niceAxis, pickTimeScale, smart, whole } from './Power.parts';

/**
 * Tab 2 — a tower crane lifts a load at constant speed. The rope pulls with
 * F = mg, so the motor's power N = F·v = mg·v and the lifting speed is
 * v = N/(mg); the time to lift to h is t = h/v = mgh/N and the work
 * A = N·t = mgh goes into the load's potential energy. The N–t graph is a
 * horizontal line and the area under it is the work.
 *
 * Preset: N = 4.9 kW, m = 500 kg (a pallet of bricks), h = 12 m →
 * F = 4900 N, v = 4900 / 4900 = 1.00 m/s, t = 12 s, A = 500·9.8·12 =
 * 58 800 J = 4900 W · 12 s. The same crane lifts 1000 kg at 0.50 m/s and
 * 2000 kg at 0.25 m/s.
 */

const IDLE = { t: 0, running: false, done: false };
const LOADS = [
  { id: 'tools', m: 100, icon: Package },
  { id: 'bricks', m: 500, icon: BrickWall },
  { id: 'block', m: 1000, icon: Container },
  { id: 'slab', m: 2000, icon: Weight },
];
const M_MAX = 2000;
const N_MAX = 15; // kW
const X_HOOK = 10; // m, trolley position on the jib
const B_X0 = 11.8; // building under construction
const B_X1 = 19.6;

export default function CraneSim({ T }) {
  const C = T.crane;
  const dec = T.decimal;
  const [Nkw, setNkw] = useState(4.9);
  const [m, setM] = useState(500);
  const [h, setH] = useState(12);
  const [sim, setSim] = useState(IDLE);

  const N = Nkw * 1000;
  const F = m * G;
  const v = N / F;
  const tTot = h / v;
  const A = m * G * h;
  const k = pickTimeScale(tTot, 14);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(tTot, p.t + dt * k);
      const done = t >= tTot - 1e-9;
      return { t, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const change = (setter) => (val) => {
    setter(val);
    setSim(IDLE);
  };

  const t = Math.min(sim.t, tTot);
  const y = v * t;
  const a = N * t;
  const started = t > 0 || sim.running;
  const loadId = LOADS.find((l) => l.m === m)?.id ?? null;

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started) key = 'lift';
  const settled = useSettled(key, key === 'lift' ? 120 : 0);
  const Jw = (n) => whole(n, dec);
  const vals = {
    N: smart(Nkw, dec),
    Nw: Jw(N),
    F: Jw(F),
    m: fmt(m, 0, dec),
    v: fmt(v, 2, dec),
    h: smart(h, dec),
    t: smart(tTot, dec),
    A: Jw(A),
    v2: fmt(v / 2, 2, dec),
  };
  const text = C.explain[settled](vals);
  const tone = settled === 'done' ? '#34d399' : settled === 'lift' ? '#fbbf24' : '#22d3ee';

  /* ---- graph: N(t), the shaded area is the work */
  const xAx = niceAxis(tTot);
  const yAx = niceAxis(Nkw * 1.3);
  const series = [
    { id: 'plan', label: C.graph.plan, color: 'rgba(252,211,77,0.45)', points: [{ x: 0, y: Nkw }, { x: tTot, y: Nkw }], dash: '4 4', dot: false, width: 1.6 },
    {
      id: 'N',
      label: C.graph.N,
      color: '#fbbf24',
      points: started ? [{ x: 0, y: Nkw }, { x: t, y: Nkw }] : [{ x: 0, y: Nkw }],
      fill: { color: '#2dd4bf', opacity: 0.28 },
    },
  ];
  const notes = t > xAx.max * 0.16 ? [{ x: t / 2, y: Nkw / 2, text: C.graph.area(smart(a / 1000, dec, 1)), color: '#99f6e4' }] : [];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{C.loadsLabel}</GroupLabel>
          <Segmented
            label={C.loadsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={loadId}
            onChange={(id) => change(setM)(LOADS.find((l) => l.id === id).m)}
            options={LOADS.map((l) => ({
              value: l.id,
              label: C.loads[l.id],
              sub: C.loadSub(fmt(l.m, 0, dec), fmt(N / (l.m * G), 2, dec)),
              icon: l.icon,
            }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={t > 0} onToggle={toggle} onReset={reset} />
      </div>

      <CraneScene T={T} h={h} m={m} y={y} v={v} N={N} t={t} k={k} a={a} A={A} running={sim.running} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={C.readouts.v}
          symbol="v"
          value={fmt(v, 2, dec)}
          unit={T.ms}
          accent={PC.v}
          textColor={PC.vText}
          sub={C.readouts.vSub(Jw(N), fmt(m, 0, dec), smart(G, dec))}
        />
        <Readout
          label={C.readouts.t}
          symbol="t"
          value={fmt(t, 1, dec)}
          unit={T.s}
          accent={PC.time}
          textColor={PC.timeText}
          sub={
            <>
              {C.readouts.tSub(fmt(y, 1, dec), smart(h, dec))}
              <br />
              <span className="text-gray-500">{C.readouts.tTot(fmt(tTot, 1, dec))}</span>
            </>
          }
        />
        <Readout
          label={C.readouts.A}
          symbol="A"
          value={Jw(a)}
          unit={T.J}
          accent={PC.A}
          textColor={PC.AText}
          active={sim.done}
          sub={
            <>
              {C.readouts.aSub(Jw(N), fmt(t, 1, dec))}
              <br />
              <span className="text-gray-500">{C.readouts.aEnd(Jw(A))}</span>
            </>
          }
        />
        <Readout label={C.readouts.formula} accent={PC.N}>
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text="N = F·v = mg·v" />
            </p>
            <p className="tabular-nums text-gray-400">
              F = {fmt(m, 0, dec)}·{smart(G, dec)} = <b style={{ color: PC.FText }}>{Jw(F)}</b> {T.N}
            </p>
            <p className="tabular-nums text-gray-400">
              v = {Jw(N)} / {Jw(F)} = <b style={{ color: PC.vText }}>{fmt(v, 2, dec)}</b> {T.ms}
            </p>
            <p className="text-xs text-gray-500">{C.formulaNote}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="pw-cr-n"
            label={C.power}
            symbol="N"
            min={1}
            max={N_MAX}
            step={0.1}
            value={Nkw}
            onChange={change(setNkw)}
            accent={PC.N}
            display={`${smart(Nkw, dec)} ${T.kW}`}
            hint={C.powerHint(smart(N / HP, dec, 1))}
          />
          <RangeField
            id="pw-cr-m"
            label={C.mass}
            symbol="m"
            min={100}
            max={M_MAX}
            step={50}
            value={m}
            onChange={change(setM)}
            accent="#94a3b8"
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={C.massHint(Jw(F))}
          />
          <RangeField
            id="pw-cr-h"
            label={C.height}
            symbol="h"
            min={6}
            max={30}
            step={3}
            value={h}
            onChange={change(setH)}
            accent={PC.Ep}
            display={`${smart(h, dec)} ${T.m}`}
            hint={C.heightHint(Math.round(h / 3))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{C.table.title}</p>
            <ul className="mt-1.5 space-y-1">
              {LOADS.map((l) => {
                const on = l.m === m;
                const vv = N / (l.m * G);
                return (
                  <li key={l.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-[13px] tabular-nums transition-colors ${on ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                    <span>{C.table.row(fmt(l.m, 0, dec), whole(l.m * G, dec))}</span>
                    <span style={{ color: on ? PC.vText : undefined }}>
                      v = {fmt(vv, 2, dec)} {T.ms} · t = {smart(h / vv, dec)} {T.s}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-xs text-gray-500">{C.table.note}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LiveGraph
            title={C.graph.title}
            series={series}
            notes={notes}
            xMax={xAx.max}
            yMax={yAx.max}
            xDigits={xAx.digits}
            yDigits={yAx.digits}
            xLabel={C.graph.t}
            yLabel={C.graph.y}
            marker={t}
            decimal={dec}
            ariaLabel={C.graph.label}
            note={C.graph.note}
            height={250}
          />
        </div>
      </div>
    </div>
  );
}

/* ================================================================ scene */

function loadSize(m) {
  const s = 0.55 * Math.cbrt(m / 100);
  return { w: s * 1.35, h: s * 0.8 };
}

function CraneScene({ T, h, m, y, v, N, t, k, a, A, running, done }) {
  const C = T.crane;
  const dec = T.decimal;
  const F = m * G;
  const yTop = h + 5; // underside of the jib
  const box0 = { x0: -9.2, x1: 20.2, y1: yTop + 4.4 };

  return (
    <LabScene
      legend={[
        { color: PC.F, label: C.legend.F, kind: 'arrow' },
        { color: PC.mg, label: C.legend.mg, kind: 'arrow' },
        { color: PC.v, label: C.legend.v, kind: 'arrow' },
        { color: '#475569', label: C.legend.h, kind: 'dash' },
      ]}
      chips={
        <>
          <Chip icon={Timer}>
            {k === 1 ? C.chipReal : C.chipFast(k)} · t = {fmt(t, 1, dec)} {T.s}
          </Chip>
          <Chip icon={Zap} color={PC.N} strong>
            {C.chipPower(smart(N / 1000, dec))}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? clamp(56 + 26 + box0.y1 * ((W - 20) / (box0.x1 - box0.x0)), 300, 600) : clamp(450 + h * 8, 520, 680))}
      ariaLabel={C.sceneLabel(fmt(m, 0, dec), fmt(y, 1, dec), fmt(v, 2, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const topPad = narrow ? 56 : 76;
        const groundY = H - (narrow ? 26 : 30);
        const worldW = box0.x1 - box0.x0;
        const kH = (groundY - topPad) / box0.y1;
        const panelMin = 330;
        const canPanel = !narrow && W - worldW * kH - 30 >= panelMin;
        const panelW = canPanel ? clamp(W - worldW * kH - 60, panelMin, 560) : 0;
        const leftW = W - panelW;
        const kk = Math.min(kH, (leftW - 20) / worldW);
        const x0 = 10 + Math.max(0, (leftW - 20 - worldW * kk) / 2);
        const sx = (X) => x0 + (X - box0.x0) * kk;
        const sy = (Y) => groundY - Y * kk;
        const cell = kk * (kk >= 14 ? 2 : 4);
        const ls = loadSize(m);
        const lw = Math.max(ls.w * kk, narrow ? 40 : 50);
        const lh = Math.max(ls.h * kk, narrow ? 26 : 32);
        const loadBottom = sy(y);
        const loadTop = loadBottom - lh;
        const lx = sx(X_HOOK);
        const hookY = loadTop - Math.max(0.95 * kk, 16);
        const kF = (narrow ? 90 : 130) / (M_MAX * G);
        const lenF = F * kF;
        const kv = narrow ? 34 : 46;
        const lenV = Math.min(narrow ? 90 : 130, v * kv);
        const drumX = sx(-4.2);
        const drumY = sy(yTop + 1.05);
        const drumR = Math.max(5, 0.55 * kk);
        const drumAng = (y / 0.55) * (180 / Math.PI);

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={leftW} y1={groundY} cell={cell} ax={sx(0)} ay={groundY} />

            {/* height axis */}
            <g aria-hidden="true">
              {Array.from({ length: Math.floor((yTop + 2) / 3) + 1 }, (_, i) => i * 3).map((yy) => (
                <g key={`ax${yy}`}>
                  <line x1={sx(box0.x0) + 2} x2={sx(box0.x0) + 8} y1={sy(yy)} y2={sy(yy)} stroke="#64748b" />
                  {(kk * 3 >= 22 || yy % 6 === 0) && (
                    <text x={sx(box0.x0) + 11} y={sy(yy) + 4} fontSize={fs - 1.5} fill={yy === 0 ? '#0f172a' : '#64748b'} fontWeight={yy === 0 ? 700 : 400}>
                      {yy}
                    </text>
                  )}
                </g>
              ))}
              <text x={sx(box0.x0) + 2} y={sy(yTop + 3.4)} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {C.axisH}
              </text>
            </g>

            <Building sx={sx} sy={sy} kk={kk} h={h} />
            <Crane sx={sx} sy={sy} kk={kk} yTop={yTop} />

            {/* winch drum with the motor */}
            <g aria-hidden="true">
              <rect x={sx(-3.35)} y={sy(yTop + 1.75)} width={1.05 * kk} height={0.95 * kk} rx={3} fill={running ? '#f59e0b' : '#fcd34d'} stroke="#b45309" strokeWidth="1.4" />
              <text x={sx(-2.82)} y={sy(yTop + 1.27) + 4} textAnchor="middle" fontSize={Math.max(8, 0.5 * kk)} fontWeight="800" fill="#78350f">
                M
              </text>
              <circle cx={drumX} cy={drumY} r={drumR} fill="#e2e8f0" stroke="#334155" strokeWidth="1.6" />
              <g transform={`rotate(${(-drumAng).toFixed(1)} ${drumX.toFixed(1)} ${drumY.toFixed(1)})`}>
                {[0, 60, 120].map((d) => (
                  <line
                    key={`sp${d}`}
                    x1={drumX + Math.cos((d * Math.PI) / 180) * drumR}
                    y1={drumY + Math.sin((d * Math.PI) / 180) * drumR}
                    x2={drumX - Math.cos((d * Math.PI) / 180) * drumR}
                    y2={drumY - Math.sin((d * Math.PI) / 180) * drumR}
                    stroke="#334155"
                    strokeWidth="1.3"
                  />
                ))}
              </g>
              {/* hoist rope: drum → along the jib → trolley → hook */}
              <polyline
                points={`${drumX},${drumY - drumR} ${sx(0)},${sy(yTop + 0.25)} ${lx - 3},${sy(yTop + 0.25)}`}
                fill="none"
                stroke="#334155"
                strokeWidth="1.2"
              />
              <line x1={lx - 3} x2={lx - 3} y1={sy(yTop) + 2} y2={hookY} stroke="#334155" strokeWidth="1.3" />
              <line x1={lx + 3} x2={lx + 3} y1={sy(yTop) + 2} y2={hookY} stroke="#334155" strokeWidth="1.3" />
              <rect x={lx - 0.55 * kk} y={sy(yTop) - 1} width={1.1 * kk} height={Math.max(5, 0.45 * kk)} rx={2} fill="#475569" />
              {/* hook block and slings */}
              <rect x={lx - 6} y={hookY - 3} width={12} height={Math.max(8, 0.5 * kk)} rx={2} fill="#f59e0b" stroke="#78350f" strokeWidth="1" />
              <path d={`M${lx},${hookY + Math.max(8, 0.5 * kk) - 3} q4,6 0,9 q-4,0 -4,-3`} fill="none" stroke="#334155" strokeWidth="1.8" />
              <line x1={lx} y1={hookY + Math.max(8, 0.5 * kk) + 5} x2={lx - lw / 2 + 3} y2={loadTop} stroke="#64748b" strokeWidth="1.2" />
              <line x1={lx} y1={hookY + Math.max(8, 0.5 * kk) + 5} x2={lx + lw / 2 - 3} y2={loadTop} stroke="#64748b" strokeWidth="1.2" />
            </g>

            {/* the load */}
            <Load x={lx} top={loadTop} w={lw} h={lh} m={m} />
            <text x={lx} y={loadTop + fs + 1} textAnchor="middle" fontSize={fs - 1.5} fontWeight="800" fill="#fff" stroke="#0f172a" strokeWidth="2.4" paintOrder="stroke">
              {`${fmt(m, 0, dec)} ${T.kg}`}
            </text>

            {/* target height and the climb so far */}
            <line x1={sx(1.2)} x2={sx(B_X1)} y1={sy(h)} y2={sy(h)} stroke="#475569" strokeWidth="1.4" strokeDasharray="6 5" />
            <Pill x={sx(3.6)} y={sy(h)} text={C.hTag(smart(h, dec))} bg="#334155" size={fs} box={box} />
            {y > 0.05 && (
              <g aria-hidden="true">
                <line x1={sx(6.6)} x2={sx(6.6)} y1={groundY} y2={loadBottom} stroke={PC.Ep} strokeWidth="1.6" />
                <line x1={sx(6.6) - 5} x2={sx(6.6) + 5} y1={loadBottom} y2={loadBottom} stroke={PC.Ep} strokeWidth="1.6" />
                <line x1={sx(6.6) - 5} x2={sx(6.6) + 5} y1={groundY} y2={groundY} stroke={PC.Ep} strokeWidth="1.6" />
                {groundY - loadBottom > 36 && (
                  <Pill x={sx(6.6)} y={(groundY + loadBottom) / 2} text={C.yTag(fmt(y, 1, dec))} bg={PC.Ep} size={fs - 1} box={box} />
                )}
              </g>
            )}

            {/* forces and velocity */}
            <ForceArrow x1={lx} y1={loadTop} x2={lx} y2={loadTop - lenF} color={PC.F} width={narrow ? 3 : 3.6} head={narrow ? 10 : 12} />
            <ForceArrow x1={lx} y1={loadTop + lh / 2} x2={lx} y2={loadTop + lh / 2 + lenF} color={PC.mg} width={narrow ? 3 : 3.6} head={narrow ? 10 : 12} />
            <SidePill x={lx + lw / 2} y={loadTop - Math.max(lenF * 0.6, 12)} side={1} gap={6} text={narrow ? C.tag.Fshort(whole(F, dec)) : C.tag.F(whole(F, dec))} bg={PC.F} fs={fs} box={box} />
            <SidePill x={lx + lw / 2} y={loadTop + lh / 2 + Math.max(lenF * 0.7, 14)} side={1} gap={6} text={C.tag.mg(whole(F, dec))} bg={PC.mg} fs={fs} box={box} />
            {(running || (t > 0 && !done)) && lenV > 4 && (
              <>
                <ForceArrow x1={lx - lw / 2 - 12} y1={loadTop + lh} x2={lx - lw / 2 - 12} y2={loadTop + lh - lenV} color={PC.v} width={2.8} head={10} dot={false} />
                <SymbolText x={lx - lw / 2 - 24} y={loadTop + lh - lenV / 2 + 4} color={PC.v} fs={fs + 1} anchor="end">
                  {`v = ${fmt(v, 2, dec)} ${T.ms}`}
                </SymbolText>
              </>
            )}

            {/* ground */}
            <rect x={0} y={groundY} width={leftW} height={H - groundY} fill="#f1f5f9" />
            <line x1={0} x2={leftW} y1={groundY} y2={groundY} stroke="#475569" strokeWidth="1.6" />
            {Array.from({ length: Math.ceil(leftW / 10) }, (_, i) => (
              <line key={`gh${i}`} x1={i * 10} x2={i * 10 - 7} y1={groundY + 1} y2={groundY + 8} stroke="#94a3b8" />
            ))}

            {canPanel && <EnergyPanel T={T} x0={leftW + 10} x1={W - 18} top={topPad + 40} base={groundY - 40} N={N} a={a} A={A} fs={fs} />}
          </>
        );
      }}
    </LabScene>
  );
}

/** Tower crane: lattice mast, jib and counter-jib, tie rods, cabin, counterweight. */
function Crane({ sx, sy, kk, yTop }) {
  const lattice = (xa, xb, ya, yb, cellW) => {
    const out = [];
    const n = Math.max(1, Math.round((xb - xa) / cellW));
    const dw = (xb - xa) / n;
    for (let i = 0; i < n; i += 1) {
      const x1 = xa + i * dw;
      const x2 = x1 + dw;
      out.push(<line key={`d${i}`} x1={sx(x1)} y1={sy(i % 2 ? ya : yb)} x2={sx(x2)} y2={sy(i % 2 ? yb : ya)} stroke="#d97706" strokeWidth="1" />);
    }
    return out;
  };
  const mastCells = [];
  const nm = Math.max(2, Math.round(yTop / 1.5));
  const dh = yTop / nm;
  for (let i = 0; i < nm; i += 1) {
    mastCells.push(<line key={`m${i}`} x1={sx(-0.75)} y1={sy(i * dh)} x2={sx(0.75)} y2={sy((i + 1) * dh)} stroke="#d97706" strokeWidth="1" />);
    mastCells.push(<line key={`mh${i}`} x1={sx(-0.75)} y1={sy(i * dh)} x2={sx(0.75)} y2={sy(i * dh)} stroke="#d97706" strokeWidth="0.8" />);
  }
  const apex = { x: 0, y: yTop + 4 };
  return (
    <g aria-hidden="true">
      {/* foundation */}
      <rect x={sx(-1.6)} y={sy(0) - 0.25 * kk} width={3.2 * kk} height={0.25 * kk + 3} fill="#94a3b8" />
      {/* mast */}
      {mastCells}
      <line x1={sx(-0.75)} x2={sx(-0.75)} y1={sy(0)} y2={sy(yTop)} stroke="#f59e0b" strokeWidth="2.4" />
      <line x1={sx(0.75)} x2={sx(0.75)} y1={sy(0)} y2={sy(yTop)} stroke="#f59e0b" strokeWidth="2.4" />
      {/* tower head and tie rods */}
      <line x1={sx(-0.75)} y1={sy(yTop)} x2={sx(apex.x)} y2={sy(apex.y)} stroke="#f59e0b" strokeWidth="2.2" />
      <line x1={sx(0.75)} y1={sy(yTop)} x2={sx(apex.x)} y2={sy(apex.y)} stroke="#f59e0b" strokeWidth="2.2" />
      <line x1={sx(apex.x)} y1={sy(apex.y)} x2={sx(15.5)} y2={sy(yTop + 1)} stroke="#64748b" strokeWidth="1.2" />
      <line x1={sx(apex.x)} y1={sy(apex.y)} x2={sx(-7.4)} y2={sy(yTop + 0.7)} stroke="#64748b" strokeWidth="1.2" />
      {/* jib */}
      {lattice(0.75, 15.5, yTop, yTop + 1, 1.2)}
      <line x1={sx(0.75)} x2={sx(15.5)} y1={sy(yTop)} y2={sy(yTop)} stroke="#f59e0b" strokeWidth="2.4" />
      <line x1={sx(0.75)} x2={sx(15.5)} y1={sy(yTop + 1)} y2={sy(yTop + 1)} stroke="#f59e0b" strokeWidth="2" />
      <line x1={sx(15.5)} x2={sx(15.5)} y1={sy(yTop)} y2={sy(yTop + 1)} stroke="#f59e0b" strokeWidth="2" />
      {/* counter-jib with the counterweight */}
      {lattice(-7.4, -0.75, yTop, yTop + 0.7, 1.1)}
      <line x1={sx(-7.4)} x2={sx(-0.75)} y1={sy(yTop)} y2={sy(yTop)} stroke="#f59e0b" strokeWidth="2.4" />
      <line x1={sx(-7.4)} x2={sx(-0.75)} y1={sy(yTop + 0.7)} y2={sy(yTop + 0.7)} stroke="#f59e0b" strokeWidth="2" />
      <rect x={sx(-7.3)} y={sy(yTop)} width={1.6 * kk} height={1.9 * kk} rx={2} fill="#64748b" stroke="#334155" />
      <line x1={sx(-7.3)} x2={sx(-5.7)} y1={sy(yTop - 0.95)} y2={sy(yTop - 0.95)} stroke="#334155" />
      {/* cabin */}
      <rect x={sx(0.8)} y={sy(yTop)} width={1.6 * kk} height={1.5 * kk} rx={3} fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      <rect x={sx(1.25)} y={sy(yTop - 0.25)} width={1 * kk} height={0.75 * kk} rx={2} fill="#bae6fd" stroke="#0369a1" strokeWidth="0.8" />
    </g>
  );
}

/** A building under construction, storeys of 3 m up to the delivery height h. */
function Building({ sx, sy, kk, h }) {
  const n = Math.round(h / 3);
  return (
    <g aria-hidden="true">
      <rect x={sx(B_X0)} y={sy(h)} width={(B_X1 - B_X0) * kk} height={h * kk} fill="#f1f5f9" />
      {Array.from({ length: n }, (_, i) => {
        const y0 = i * 3;
        return (
          <g key={`b${i}`}>
            {[0.4, 2.6, 4.8, 7.0].map((dx) => (
              <rect key={`w${dx}`} x={sx(B_X0 + dx)} y={sy(y0 + 2.3)} width={1.3 * kk} height={1.4 * kk} rx={1} fill="#dbeafe" stroke="#cbd5e1" strokeWidth="0.8" />
            ))}
          </g>
        );
      })}
      {Array.from({ length: n + 1 }, (_, i) => (
        <rect key={`s${i}`} x={sx(B_X0 - 0.2)} y={sy(i * 3)} width={(B_X1 - B_X0 + 0.4) * kk} height={Math.max(3, 0.3 * kk)} fill="#94a3b8" />
      ))}
      {[B_X0, (B_X0 + B_X1) / 2, B_X1].map((x) => (
        <rect key={`c${x}`} x={sx(x) - Math.max(1.5, 0.15 * kk)} y={sy(h)} width={Math.max(3, 0.3 * kk)} height={h * kk} fill="#94a3b8" />
      ))}
      {/* rebar sticking out of the top slab: the building is still growing */}
      {[B_X0, (B_X0 + B_X1) / 2, B_X1].map((x) => (
        <line key={`r${x}`} x1={sx(x)} x2={sx(x)} y1={sy(h)} y2={sy(h + 1.1)} stroke="#64748b" strokeWidth="1.4" />
      ))}
    </g>
  );
}

/** A pallet of bricks / concrete block, its size growing with the mass. */
function Load({ x, top, w, h, m }) {
  const rows = Math.max(2, Math.round(h / 9));
  const rh = (h - 4) / rows;
  return (
    <g aria-hidden="true">
      <rect x={x - w / 2} y={top} width={w} height={h - 4} rx={2} fill={m >= 1000 ? '#a8a29e' : '#c2410c'} stroke="#44403c" strokeWidth="1.2" />
      {m < 1000 &&
        Array.from({ length: rows - 1 }, (_, i) => (
          <line key={`r${i}`} x1={x - w / 2} x2={x + w / 2} y1={top + (i + 1) * rh} y2={top + (i + 1) * rh} stroke="#fdba74" strokeWidth="1" />
        ))}
      {m < 1000 &&
        Array.from({ length: rows }, (_, i) =>
          [0.33, 0.66].map((f) => (
            <line
              key={`v${i}-${f}`}
              x1={x - w / 2 + w * (i % 2 ? f - 0.16 : f)}
              x2={x - w / 2 + w * (i % 2 ? f - 0.16 : f)}
              y1={top + i * rh}
              y2={top + (i + 1) * rh}
              stroke="#fdba74"
              strokeWidth="1"
            />
          )),
        )}
      {m >= 1000 && <rect x={x - w / 2 + 3} y={top + 3} width={w - 6} height={Math.max(2, (h - 4) * 0.22)} rx={1} fill="#d6d3d1" />}
      <rect x={x - w / 2 - 2} y={top + h - 4} width={w + 4} height={4} rx={1} fill="#92400e" />
    </g>
  );
}

/** The motor's power on a dial and the work it has done next to the load's potential energy. */
function EnergyPanel({ T, x0, x1, top, base, N, a, A, fs }) {
  const C = T.crane;
  const dec = T.decimal;
  const cx = x0 + (x1 - x0) * 0.28;
  const r = clamp((x1 - x0) * 0.17, 56, 88);
  const cy = top + r + 40;
  const frac = clamp(N / (N_MAX * 1000), 0, 1);
  const ang = Math.PI * (1 - frac);
  const ticks = [0, 3, 6, 9, 12, 15];
  const barsX = x0 + (x1 - x0) * 0.55;
  const bw = clamp((x1 - x0) * 0.09, 30, 46);
  const barTop = top + 46;
  const kE = (base - barTop) / (A * 1.1);
  const bars = [
    { id: 'A', val: a, color: PC.A, text: '#0f766e', label: C.panel.A },
    { id: 'Ep', val: a, color: PC.Ep, text: '#1d4ed8', label: C.panel.Ep },
  ];
  return (
    <g aria-hidden="true">
      <line x1={x0} x2={x0} y1={top - 10} y2={base + 30} stroke="#e2e8f0" strokeWidth="1.5" />
      {/* dial */}
      <text x={cx} y={top + 12} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#334155">
        {C.panel.dial}
      </text>
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`} fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
      <path d={`M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r * Math.cos(ang)},${cy - r * Math.sin(ang)}`} fill="none" stroke={PC.N} strokeWidth="12" strokeLinecap="round" />
      {ticks.map((kw) => {
        const th = Math.PI * (1 - kw / N_MAX);
        return (
          <text key={`tk${kw}`} x={cx + (r + 18) * Math.cos(th)} y={cy - (r + 18) * Math.sin(th) + 4} textAnchor="middle" fontSize={fs - 2} fill="#64748b">
            {kw}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={cx + (r - 16) * Math.cos(ang)} y2={cy - (r - 16) * Math.sin(ang)} stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#0f172a" />
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize={fs + 8} fontWeight="800" fill="#b45309">
        {`${smart(N / 1000, dec)} ${T.kW}`}
      </text>
      <text x={cx} y={cy + 48} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
        {C.panel.perSecond(whole(N, dec), smart(N / HP, dec, 1))}
      </text>

      {/* energy bars */}
      <text x={barsX + bw} y={top + 12} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#334155">
        {C.panel.bars}
      </text>
      <line x1={barsX - 20} x2={barsX + 2 * bw + 44} y1={base} y2={base} stroke="#475569" strokeWidth="1.4" />
      <line x1={barsX - 20} x2={barsX + 2 * bw + 44} y1={base - A * kE} y2={base - A * kE} stroke="#475569" strokeWidth="1.2" strokeDasharray="5 4" />
      <text x={barsX - 20} y={base - A * kE - 7} fontSize={fs - 1} fontWeight="700" fill="#475569">
        {`mgh = ${smart(A / 1000, dec, 1)} ${C.panel.unit}`}
      </text>
      {bars.map((b, i) => {
        const bx = barsX + i * (bw + 24);
        const hh = b.val * kE;
        return (
          <g key={b.id}>
            <rect x={bx} y={base - hh} width={bw} height={hh} rx={4} fill={b.color} opacity="0.9" />
            <text x={bx + bw / 2} y={hh > 26 ? base - hh + 17 : base - hh - 7} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill={hh > 26 ? '#ffffff' : b.text}>
              {smart(b.val / 1000, dec, 1)}
            </text>
            <text x={bx + bw / 2} y={base + 16} textAnchor="middle" fontSize={fs} fontStyle="italic" fontWeight="700" fill={b.text}>
              {b.label}
            </text>
          </g>
        );
      })}
      <text x={barsX + bw + 12} y={base + 32} textAnchor="middle" fontSize={fs - 1.5} fill="#64748b">
        {C.panel.unit}
      </text>
      <text x={(x0 + x1) / 2} y={base + 52} textAnchor="middle" fontSize={fs - 1} fill="#334155">
        {C.panel.law}
      </text>
    </g>
  );
}
