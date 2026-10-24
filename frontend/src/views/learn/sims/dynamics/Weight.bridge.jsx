import { useMemo, useState } from 'react';
import { Lightbulb, Mountain, Timer, Waves } from 'lucide-react';

import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { TimeGraph } from '../kit/scene';
import { Chip, FC, ForceArrow, Formula, G, GroupLabel, LabScene, PaperGrid, PlayControls, SidePill, newtons, niceAxis, num } from './Weight.parts';

/**
 * Tab 3 — a car of m = 1000 kg drives at a constant speed v over a convex
 * bridge or through a dip of radius R. The road is built of circular arcs
 * that join smoothly (flat → transition → main arc → transition → flat), so
 * the car never jumps. On a curve of signed curvature κ (+ for a dip, − for a
 * hump) the support force is N = m(g·cos φ + κ·v²), and the car presses on
 * the road with P = N. At the top of the bridge P = m(g − v²/R), at the
 * bottom of the dip P = m(g + v²/R). Preset: v = 10 m/s, R = 40 m:
 * v²/R = 2.5 m/s², P_top = 7 300 N, P_bottom = 12 300 N, mg = 9 800 N.
 * The speed is capped so that P stays positive everywhere (the car would
 * leave the road beyond v = √(gR·cos θ)). Strings come from T.bridge.
 */

const CAR_M = 1000; // kg
const THETA = (20 * Math.PI) / 180; // tilt of the road where the arcs meet
const FLAT = 6; // m of flat road before and after
const CAR_L = 4.4; // m
const IDLE = { s: 0, running: false, done: false };
const vCap = (R) => Math.floor(Math.sqrt(G * R * Math.cos(THETA)));

function advance(x, y, phi, k, d) {
  if (Math.abs(k) < 1e-12) return { x: x + d * Math.cos(phi), y: y + d * Math.sin(phi), phi };
  const phi1 = phi + k * d;
  return { x: x + (Math.sin(phi1) - Math.sin(phi)) / k, y: y - (Math.cos(phi1) - Math.cos(phi)) / k, phi: phi1 };
}

function buildRoad(type, R) {
  const sg = type === 'hump' ? 1 : -1;
  const parts = [
    { len: FLAT, k: 0, part: 'flat' },
    { len: R * THETA, k: sg / R, part: 'tr' },
    { len: 2 * R * THETA, k: -sg / R, part: 'main' },
    { len: R * THETA, k: sg / R, part: 'tr' },
    { len: FLAT, k: 0, part: 'flat' },
  ];
  let x = 0;
  let y = 0;
  let phi = 0;
  let s = 0;
  const segs = parts.map((p) => {
    const seg = { ...p, s0: s, x0: x, y0: y, phi0: phi };
    const e = advance(x, y, phi, p.k, p.len);
    x = e.x;
    y = e.y;
    phi = e.phi;
    s += p.len;
    return seg;
  });
  const h = 2 * R * (1 - Math.cos(THETA));
  return { type, R, segs, total: s, xEnd: x, yMax: type === 'hump' ? h : 0, yMin: type === 'hump' ? 0 : -h, h };
}

function roadAt(road, s) {
  const ss = clamp(s, 0, road.total);
  let seg = road.segs[road.segs.length - 1];
  for (const g of road.segs) {
    if (ss < g.s0 + g.len) {
      seg = g;
      break;
    }
  }
  const p = advance(seg.x0, seg.y0, seg.phi0, seg.k, ss - seg.s0);
  return { ...p, k: seg.k, part: seg.part, s: ss };
}

const support = (phi, k, v) => Math.max(0, CAR_M * (G * Math.cos(phi) + k * v * v));

function sampleRoad(road, v) {
  const out = [];
  for (const seg of road.segs) {
    const n = Math.max(2, Math.ceil(seg.len / 0.5));
    for (let j = 0; j <= n; j += 1) {
      const d = (seg.len * j) / n;
      const p = advance(seg.x0, seg.y0, seg.phi0, seg.k, d);
      out.push({ s: seg.s0 + d, x: p.x, y: p.y, phi: p.phi, P: support(p.phi, seg.k, v) });
    }
  }
  return out;
}

export default function BridgeSim({ T }) {
  const B = T.bridge;
  const dec = T.decimal;
  const [type, setType] = useState('hump');
  const [v, setV] = useState(10);
  const [R, setR] = useState(40);
  const [sim, setSim] = useState(IDLE);
  const road = useMemo(() => buildRoad(type, R), [type, R]);
  const samples = useMemo(() => sampleRoad(road, v), [road, v]);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const s = Math.min(road.total, p.s + v * dt);
      const done = s >= road.total - 1e-9;
      return { s, running: !done, done };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...IDLE, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(IDLE);
  const pickType = (id) => {
    setType(id);
    setSim(IDLE);
  };

  const car = roadAt(road, sim.s);
  const P = support(car.phi, car.k, v);
  const mg = CAR_M * G;
  const ac = v * v * Math.abs(car.k);
  const acR = (v * v) / R;
  const Ptop = CAR_M * (G - acR);
  const Pbot = CAR_M * (G + acR);
  const vkr = Math.sqrt(G * R);
  const NN = (n) => newtons(n, dec);
  const F = (n, d = 1) => num(n, d, dec);
  const started = sim.s > 0 || sim.running;

  /* ---- explanation */
  let key = 'idle';
  if (sim.done) key = 'done';
  else if (started) key = car.part === 'flat' ? 'flat' : `${car.part}_${type}`;
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 200);
  const vals = { P: NN(P), mg: NN(mg), ac: F(acR), Ptop: NN(Ptop), Pbot: NN(Pbot), v: fmt(v, 0, dec), R: fmt(R, 0, dec), vkr: F(vkr) };
  const text = settled === 'done' ? B.explain.done[type](vals) : B.explain[settled](vals);
  const tone = { idle: '#22d3ee', flat: '#34d399', main_hump: '#60a5fa', tr_hump: '#fb923c', main_dip: '#fb923c', tr_dip: '#60a5fa', done: '#34d399' }[settled];

  /* ---- graph (P in kN against the horizontal position x) */
  const xAx = niceAxis(road.xEnd);
  const pMax = Math.max(...samples.map((p) => p.P));
  const yAx = niceAxis((Math.max(pMax, mg) * 1.05) / 1000);
  const live = started ? samples.filter((p) => p.s <= sim.s).map((p) => ({ x: p.x, y: p.P / 1000 })) : [];
  live.push({ x: car.x, y: P / 1000 });
  const series = [
    { id: 'plan', label: B.graph.plan, color: 'rgba(196,181,253,0.45)', points: samples.map((p) => ({ x: p.x, y: p.P / 1000 })), dash: '4 4', dot: false },
    { id: 'mg', label: B.graph.mg, color: '#f87171', points: [{ x: 0, y: mg / 1000 }, { x: xAx.max, y: mg / 1000 }], dash: '6 5', dot: false },
    { id: 'P', label: B.graph.P, color: '#a78bfa', points: live },
  ];
  const scrub = (x) => {
    let best = samples[0];
    for (const p of samples) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    setSim({ s: best.s, running: false, done: best.s >= road.total - 1e-9 });
  };

  const vmax = vCap(R);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{B.typeLabel}</GroupLabel>
          <Segmented
            label={B.typeLabel}
            className="grid-cols-1 sm:grid-cols-2"
            size="lg"
            value={type}
            onChange={pickType}
            options={[
              { value: 'hump', label: B.types.hump.name, sub: B.types.hump.sub, icon: Mountain },
              { value: 'dip', label: B.types.dip.name, sub: B.types.dip.sub, icon: Waves },
            ]}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={sim.s > 0} onToggle={toggle} onReset={reset} />
      </div>

      <BridgeScene T={T} road={road} samples={samples} car={car} v={v} P={P} running={sim.running} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={B.readouts.v} symbol="v" value={fmt(v, 0, dec)} unit={T.ms} accent={FC.v} textColor={FC.vText} sub={B.kmh(fmt(v * 3.6, 0, dec))} />
        <Readout
          label={B.readouts.a}
          symbol="a"
          value={F(ac)}
          unit={T.ms2}
          accent={FC.a}
          textColor={FC.aText}
          sub={car.k === 0 ? B.aFlat : car.k < 0 ? B.aDown : B.aUp}
        />
        <Readout
          label={B.readouts.P}
          symbol="P"
          value={NN(P)}
          unit={T.N}
          accent={FC.P}
          textColor={FC.PText}
          active={Math.abs(P - mg) > 5}
          sub={B.pSub(NN(mg), F(P / mg, 2))}
        />
        <Readout label={type === 'hump' ? B.readouts.formulaTop : B.readouts.formulaBottom} accent="#e2e8f0">
          <div className="mt-1.5 space-y-1 text-[13px] leading-snug">
            <p className="text-[15px] text-gray-100">
              <Formula text={type === 'hump' ? B.formula.hump : B.formula.dip} />
            </p>
            <p className="tabular-nums text-gray-400">
              = {groupedMass(dec)} · ({F(G)} {type === 'hump' ? '−' : '+'} {F(acR)}) = <b style={{ color: FC.PText }}>{NN(type === 'hump' ? Ptop : Pbot)}</b> {T.N}
            </p>
            <p className="text-xs text-gray-500">{B.acNote(fmt(v, 0, dec), fmt(R, 0, dec), F(acR))}</p>
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="wt-br-v"
            label={B.speed}
            symbol="v"
            min={2}
            max={vmax}
            step={1}
            value={Math.min(v, vmax)}
            onChange={(n) => {
              setV(n);
              setSim(IDLE);
            }}
            accent={FC.v}
            display={`${fmt(v, 0, dec)} ${T.ms}`}
            hint={B.speedHint(fmt(v * 3.6, 0, dec), fmt(vmax, 0, dec))}
          />
          <RangeField
            id="wt-br-r"
            label={B.radius}
            symbol="R"
            min={20}
            max={80}
            step={10}
            value={R}
            onChange={(n) => {
              setR(n);
              setV((vv) => Math.min(vv, vCap(n)));
              setSim(IDLE);
            }}
            accent="#94a3b8"
            display={`${fmt(R, 0, dec)} ${T.m}`}
            hint={B.radiusHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300">
            <p>
              <span className="font-serif italic text-gray-100">v</span>
              <sub className="text-[0.72em]">{B.krSub}</sub> <span className="font-serif italic text-gray-100">= √(gR)</span> ={' '}
              <b className="tabular-nums text-white">
                {F(vkr)} {T.ms}
              </b>
            </p>
            <p className="mt-1 text-gray-400">{B.krNote}</p>
            <p className="mt-1 text-gray-500">{B.massNote(groupedMass(dec))}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={B.graph.title}
            series={series}
            xMax={xAx.max}
            yMax={yAx.max}
            xDigits={xAx.digits}
            yDigits={yAx.digits}
            xLabel={B.graph.x}
            yLabel={B.graph.y}
            marker={car.x}
            decimal={dec}
            ariaLabel={B.graph.label}
            note={B.graph.note}
            height={250}
            onScrub={scrub}
          />
        </div>
      </div>
    </div>
  );
}

function groupedMass(dec) {
  return newtons(CAR_M, dec);
}

/* ================================================================ scene */

function layoutFor(road, W, narrow) {
  const padX = 12;
  const kFit = (W - 2 * padX) / (road.xEnd + 2);
  const k = Math.max(kFit, narrow ? 12 : 7);
  const Lmax = narrow ? 92 : 130; // px for 2·mg
  const topPad = narrow ? 30 : 56;
  const yTopPx = topPad + Lmax + 30;
  const H = Math.round(yTopPx + (road.yMax - road.yMin) * k + Lmax + 58);
  return { padX, k, Lmax, topPad, yTopPx, H, track: kFit < k };
}

function BridgeScene({ T, road, samples, car, v, P, running }) {
  const B = T.bridge;
  const dec = T.decimal;
  const mg = CAR_M * G;
  const NN = (n) => newtons(n, dec);

  return (
    <LabScene
      legend={[
        { color: FC.mg, label: B.legend.mg, kind: 'arrow' },
        { color: FC.N, label: B.legend.N, kind: 'arrow' },
        { color: FC.P, label: B.legend.P, kind: 'arrow' },
        { color: FC.a, label: B.legend.a, kind: 'arrow' },
        { color: FC.v, label: B.legend.v, kind: 'arrow' },
      ]}
      chips={<Chip icon={Timer}>{B.chipReal}</Chip>}
      height={(W, narrow) => layoutFor(road, W, narrow).H}
      ariaLabel={B.sceneLabel(B.types[road.type].name, NN(P), NN(mg))}
    >
      {(W, H, narrow) => {
        const lay = layoutFor(road, W, narrow);
        const { k, Lmax, yTopPx, padX } = lay;
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const viewW = (W - 2 * padX) / k;
        const x0 = lay.track ? clamp(car.x - viewW / 2, -1, road.xEnd + 1 - viewW) : (road.xEnd - viewW) / 2;
        const sx = (x) => padX + (x - x0) * k;
        const sy = (y) => yTopPx + (road.yMax - y) * k;
        const kF = Lmax / (2 * mg);
        const kA = narrow ? 4 : 5.5;
        const kV = narrow ? 2 : 2.6;
        const gridM = niceStep(k, narrow ? 26 : 30);
        const rulerM = niceStep(k, narrow ? 46 : 60);
        const rulerY = H - 26;

        const pts = samples.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        const yEnd = samples[samples.length - 1].y;
        const earth = `${sx(-2)},${sy(samples[0].y).toFixed(1)} ${pts} ${sx(road.xEnd + 2)},${sy(yEnd).toFixed(1)} ${sx(road.xEnd + 2)},${rulerY - 8} ${sx(-2)},${rulerY - 8}`;

        /* car frame */
        const cx = sx(car.x);
        const cy = sy(car.y);
        const nx = -Math.sin(car.phi);
        const ny = -Math.cos(car.phi);
        const tx = Math.cos(car.phi);
        const ty = -Math.sin(car.phi);
        const com = { x: cx + nx * 0.7 * k, y: cy + ny * 0.7 * k };
        const off = Math.max(10, 0.31 * CAR_L * k);
        const nPt = { x: cx - tx * off, y: cy - ty * off };
        const pPt = { x: cx + tx * off, y: cy + ty * off };
        const lenN = P * kF;
        const aSigned = v * v * car.k; // along the outward normal
        const aBase = { x: com.x + tx * (CAR_L * 0.62 * k + 6), y: com.y + ty * (CAR_L * 0.62 * k + 6) };
        const vBase = { x: com.x + nx * 1.25 * k, y: com.y + ny * 1.25 * k };
        const wArrow = narrow ? 3 : 3.5;
        const head = narrow ? 10 : 12;

        /* railing along the main arc of the bridge */
        const main = road.segs[2];
        const posts = [];
        if (road.type === 'hump') {
          const n = Math.max(2, Math.round(main.len / 2.5));
          for (let j = 0; j <= n; j += 1) {
            const p = advance(main.x0, main.y0, main.phi0, main.k, (main.len * j) / n);
            posts.push({ x: sx(p.x), y: sy(p.y), tx: sx(p.x) - Math.sin(p.phi) * 1.0 * k, ty: sy(p.y) - Math.cos(p.phi) * 1.0 * k });
          }
        }
        const mid = advance(main.x0, main.y0, main.phi0, main.k, main.len / 2);

        const ticks = [];
        for (let x = Math.ceil(x0 / rulerM) * rulerM; x <= x0 + viewW + 1e-9; x += rulerM) ticks.push(x);

        return (
          <>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={W} y1={H} cell={gridM * k} ax={sx(0)} ay={sy(0)} />
            <polygon points={earth} fill="#efe7dc" />
            {road.type === 'hump' && (
              <path
                d={`M${sx(main.x0 + 1)},${sy(0) + 1} Q${sx(mid.x)},${sy(0) - 2 * 0.55 * road.h * k} ${sx(road.segs[3].x0 - 1)},${sy(0) + 1} Z`}
                fill="#bfdbfe"
                opacity="0.8"
              />
            )}
            <polyline points={pts} fill="none" stroke="#334155" strokeWidth={narrow ? 7 : 9} strokeLinejoin="round" transform="translate(0 4)" />
            <polyline points={pts} fill="none" stroke="#f8fafc" strokeWidth="1.3" strokeDasharray="7 8" transform="translate(0 4)" />
            {posts.length > 0 && (
              <g aria-hidden="true">
                {posts.map((p, i) => (
                  <line key={`po${i}`} x1={p.x} y1={p.y} x2={p.tx} y2={p.ty} stroke="#94a3b8" strokeWidth="1.6" />
                ))}
                <polyline points={posts.map((p) => `${p.tx.toFixed(1)},${p.ty.toFixed(1)}`).join(' ')} fill="none" stroke="#94a3b8" strokeWidth="1.8" />
              </g>
            )}
            <Pill
              x={sx(mid.x)}
              y={rulerY - 24}
              text={B.rTag(fmt(road.R, 0, dec))}
              bg="#475569"
              size={fs - 1}
              box={box}
            />

            {/* ruler */}
            <g aria-hidden="true">
              <rect x={0} y={rulerY - 8} width={W} height={H - rulerY + 8} fill="#fbfcfe" />
              <line x1={0} x2={W} y1={rulerY - 8} y2={rulerY - 8} stroke="#94a3b8" />
              {ticks.map((x) => (
                <g key={`rt${x}`}>
                  <line x1={sx(x)} x2={sx(x)} y1={rulerY - 8} y2={rulerY - 2} stroke="#64748b" />
                  {sx(x) < W - 46 && (
                    <text x={sx(x)} y={rulerY + 12} textAnchor="middle" fontSize={fs - 1} fill="#64748b">
                      {fmt(x, 0, dec)}
                    </text>
                  )}
                </g>
              ))}
              <text x={W - 8} y={rulerY + 12} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
                {B.axisX}
              </text>
            </g>

            {/* car */}
            <SideCar x={cx} y={cy} phi={car.phi} k={k} s={car.s} />
            {running && <circle cx={com.x} cy={com.y} r={CAR_L * 0.4 * k} fill="#64748b" className="cl-pulse" opacity="0.2" />}

            {/* forces */}
            <ForceArrow x1={com.x} y1={com.y} x2={com.x} y2={com.y + mg * kF} color={FC.mg} width={wArrow} head={head} />
            <ForceArrow x1={nPt.x} y1={nPt.y} x2={nPt.x + nx * lenN} y2={nPt.y + ny * lenN} color={FC.N} width={wArrow} head={head} />
            <ForceArrow x1={pPt.x} y1={pPt.y} x2={pPt.x - nx * lenN} y2={pPt.y - ny * lenN} color={FC.P} width={wArrow} head={head} />
            {Math.abs(aSigned) > 1e-6 && (
              <ForceArrow
                x1={aBase.x}
                y1={aBase.y}
                x2={aBase.x + nx * aSigned * kA}
                y2={aBase.y + ny * aSigned * kA}
                color={FC.a}
                width={narrow ? 2.6 : 3}
                head={narrow ? 9 : 11}
                dot={false}
              />
            )}
            <ForceArrow x1={vBase.x} y1={vBase.y} x2={vBase.x + tx * v * kV} y2={vBase.y + ty * v * kV} color={FC.v} width={narrow ? 2.4 : 2.8} head={narrow ? 9 : 10} dot={false} />

            <SidePill x={com.x - 4} y={com.y + mg * kF - 4} side={-1} gap={2} text={narrow ? 'mg' : B.tag.mg(NN(mg))} bg={FC.mg} fs={fs} box={box} />
            <SidePill x={nPt.x + nx * lenN - 4} y={nPt.y + ny * lenN + 6} side={-1} gap={2} text={narrow ? 'N' : B.tag.N(NN(P))} bg={FC.N} fs={fs} box={box} />
            <SidePill x={pPt.x - nx * lenN + 4} y={pPt.y - ny * lenN - 4} side={1} gap={2} text={narrow ? 'P' : B.tag.P(NN(P))} bg={FC.P} fs={fs} box={box} />
            {Math.abs(aSigned) > 1e-6 && (
              <SidePill
                x={aBase.x + nx * aSigned * kA + 4}
                y={aBase.y + ny * aSigned * kA + (aSigned > 0 ? -2 : 4)}
                side={1}
                gap={2}
                text={narrow ? 'a' : B.tag.a(num(Math.abs(aSigned), 1, dec))}
                bg={FC.a}
                fs={fs}
                box={box}
              />
            )}
            <text
              x={vBase.x + tx * (v * kV + 10)}
              y={vBase.y + ty * (v * kV + 10) + 4}
              fontSize={fs + 1}
              fontStyle="italic"
              fontWeight="700"
              fill={FC.v}
              stroke="#fff"
              strokeWidth="3"
              paintOrder="stroke"
            >
              v
            </text>
          </>
        );
      }}
    </LabScene>
  );
}

/** A side-view car with its wheels on the road at (x, y), tilted by the road angle. */
function SideCar({ x, y, phi, k, s }) {
  const L = CAR_L * k;
  const u = L / 4.4; // px per metre
  const r = 0.34 * u;
  const rot = (-(phi * 180) / Math.PI).toFixed(2);
  const spin = ((s / 0.34) * 180) / Math.PI;
  const wheel = (wx) => (
    <g transform={`translate(${wx} ${-r})`}>
      <circle r={r} fill="#1e293b" />
      <circle r={r * 0.55} fill="#cbd5e1" />
      <g transform={`rotate(${spin.toFixed(1)})`}>
        <line x1={-r * 0.5} x2={r * 0.5} y1={0} y2={0} stroke="#475569" strokeWidth={Math.max(1, r * 0.16)} />
        <line x1={0} x2={0} y1={-r * 0.5} y2={r * 0.5} stroke="#475569" strokeWidth={Math.max(1, r * 0.16)} />
      </g>
    </g>
  );
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})`} aria-hidden="true">
      <path
        d={`M${-2.2 * u},${-0.42 * u} L${-2.2 * u},${-0.9 * u} Q${-2.15 * u},${-1.0 * u} ${-1.9 * u},${-1.0 * u} L${-1.25 * u},${-1.02 * u} L${-0.75 * u},${-1.48 * u} L${0.55 * u},${-1.48 * u} L${1.15 * u},${-1.02 * u} L${1.95 * u},${-0.95 * u} Q${2.2 * u},${-0.9 * u} ${2.2 * u},${-0.7 * u} L${2.2 * u},${-0.42 * u} Z`}
        fill="#64748b"
        stroke="#1e293b"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d={`M${-1.05 * u},${-1.04 * u} L${-0.68 * u},${-1.38 * u} L${-0.1 * u},${-1.38 * u} L${-0.1 * u},${-1.04 * u} Z`} fill="#bfdbfe" />
      <path d={`M${0.02 * u},${-1.04 * u} L${0.02 * u},${-1.38 * u} L${0.5 * u},${-1.38 * u} L${0.95 * u},${-1.04 * u} Z`} fill="#bfdbfe" />
      <rect x={1.95 * u} y={-0.86 * u} width={0.22 * u} height={0.14 * u} rx={0.05 * u} fill="#fde68a" />
      <rect x={-2.2 * u} y={-0.84 * u} width={0.16 * u} height={0.14 * u} fill="#f87171" />
      {wheel(-1.38 * u)}
      {wheel(1.38 * u)}
    </g>
  );
}
