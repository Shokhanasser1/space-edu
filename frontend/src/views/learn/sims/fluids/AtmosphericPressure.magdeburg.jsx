import { useState } from 'react';
import { Lightbulb, Pause, RotateCcw, Unplug, Wind, Zap } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  ForceArrow,
  Formula,
  G,
  HORSE,
  HaloText,
  LabScene,
  LiveGraph,
  P0,
  PC,
  PaperGrid,
  pa100,
  seeded,
  whole,
} from './AtmosphericPressure.parts';

/**
 * Tab 3 — the Magdeburg hemispheres. Pumping the air out lowers the
 * pressure inside to p while the air outside still presses with p₀, so the
 * halves are pressed together by F = (p₀ − p)·πR² (only the cross-section
 * πR² counts: the pushes on the curved surface add up to Δp times the area
 * seen along the axis). Teams of horses pull on both ends; assumption shown
 * on screen: one horse pulls steadily with about 1 kN, so n horses on each
 * side stretch the hemispheres with T = n·1 kN. They come apart once T > F.
 *
 * Preset: R = 25 cm → S = π·0.25² = 0.196 m²; with the air pumped out,
 * F = 101 300 · 0.196 ≈ 19 900 N = 19.9 kN (the weight of ≈ 2030 kg), so
 * 8 horses a side (8 kN) fail and at least 20 a side are needed.
 * A suction cup of R = 4 cm: F = 101 300 · π · 0.04² ≈ 509 N.
 */

const IDLE = { pIn: P0, pumping: false, letting: false, phase: 0, pull: 'idle', t: 0, clock: 0, lastF: 0 };
const R_MAX = 0.4;
const F_SCALE_N = 50000; // arrows: this force is drawn `fLen` px long

export default function MagdeburgSim({ T }) {
  const C = T.mag;
  const dec = T.decimal;
  const [R, setR] = useState(0.25);
  const [n, setN] = useState(8);
  const [st, setSt] = useState(IDLE);

  const S = Math.PI * R * R;
  const dp = P0 - st.pIn;
  const F = Math.max(0, dp * S);
  const Tn = n * HORSE;
  const nMin = Math.ceil(F / HORSE - 1e-9);

  useRafLoop(st.pumping || st.letting || st.pull === 'pull' || st.pull === 'strain' || st.pull === 'split', (dt) => {
    setSt((p) => {
      let { pIn, pumping, letting, phase, pull, t, clock, lastF } = p;
      clock += dt;
      if (pumping) {
        pIn *= Math.exp(-1.6 * dt);
        phase += dt / 0.32;
        if (pIn < 50) {
          pIn = 0;
          pumping = false;
        }
      }
      if (letting || pull === 'split') {
        pIn += (P0 - pIn) * (1 - Math.exp(-(pull === 'split' ? 9 : 5) * dt));
        if (P0 - pIn < 20) {
          pIn = P0;
          letting = false;
        }
      }
      if (pull === 'pull') {
        t += dt;
        if (t >= 1) {
          const Fnow = Math.max(0, (P0 - pIn) * Math.PI * R * R);
          lastF = Fnow;
          pull = n * HORSE > Fnow ? 'split' : 'strain';
          t = 0;
        }
      } else if (pull === 'strain') {
        t += dt;
        if (t >= 1.6) {
          pull = 'held';
          t = 0;
        }
      } else if (pull === 'split') {
        t += dt;
        if (t >= 1.3) {
          pull = 'apart';
          t = 0;
        }
      }
      return { pIn, pumping, letting, phase, pull, t, clock, lastF };
    });
  });

  const apart = st.pull === 'split' || st.pull === 'apart';
  const busy = st.pull === 'pull' || st.pull === 'strain' || apart;
  const pump = () => setSt((p) => ({ ...p, pumping: !p.pumping, letting: false, pull: p.pull === 'held' ? 'idle' : p.pull }));
  const letIn = () => setSt((p) => ({ ...p, pumping: false, letting: true, pull: p.pull === 'held' ? 'idle' : p.pull }));
  const pull = () => setSt((p) => ({ ...p, pumping: false, letting: false, pull: 'pull', t: 0 }));
  const reset = () => setSt(IDLE);
  const onR = (v) => {
    setR(v);
    setSt(IDLE);
  };
  const onN = (v) => {
    setN(v);
    setSt((p) => (p.pull === 'held' || p.pull === 'strain' ? { ...p, pull: 'idle', t: 0 } : p));
  };

  /* ---- explanation */
  let key = 'idle';
  if (st.pull === 'pull') key = 'pull';
  else if (st.pull === 'strain' || st.pull === 'held') key = 'held';
  else if (apart) key = st.lastF < 500 ? 'apartEasy' : 'apart';
  else if (st.letting) key = 'letIn';
  else if (st.pumping) key = 'pumping';
  else if (st.pIn === 0) key = 'vacuum';
  else if (st.pIn < P0 - 1) key = 'partial';
  const settled = useSettled(key, key === 'pumping' ? 150 : 60);
  const Fshown = apart || st.pull === 'held' || st.pull === 'strain' ? st.lastF : F;
  const vals = {
    p: fmt(st.pIn / 1000, 1, dec),
    p0: pa100(P0, dec),
    p0k: fmt(P0 / 1000, 1, dec),
    S: fmt(S, 3, dec),
    F: fmt(Fshown / 1000, 1, dec),
    kg: whole(Math.round(Fshown / G / 10) * 10, dec),
    nMin: whole(Math.ceil(Fshown / HORSE - 1e-9), dec),
    n: whole(n, dec),
    T: whole(n, dec),
  };
  const text = C.explain[settled](vals);
  const tone = settled === 'held' ? '#f87171' : settled.startsWith('apart') ? '#34d399' : settled === 'vacuum' ? '#fbbf24' : '#22d3ee';

  /* ---- graph F(R) */
  const curve = (dP) => Array.from({ length: 41 }, (_, i) => ({ x: i, y: (dP * Math.PI * (i / 100) ** 2) / 1000 }));
  const series = [
    { id: 'vac', label: C.graph.vac, color: 'rgba(248,113,113,0.55)', points: curve(P0), dash: '5 4', width: 1.8 },
    { id: 'now', label: C.graph.now, color: '#f87171', points: curve(dp) },
    { id: 'T', label: C.graph.T(whole(n, dec)), color: '#fbbf24', points: [{ x: 0, y: n }, { x: 40, y: n }], dash: '3 4', width: 1.8 },
  ];
  const dots = [{ x: R * 100, y: F / 1000, color: '#f87171', r: 5, label: `${fmt(F / 1000, 1, dec)} ${T.kN}`, anchor: R > 0.3 ? 'end' : 'start', dx: R > 0.3 ? -8 : 8 }];
  const suction = P0 * Math.PI * 0.04 ** 2;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <Btn
          variant={st.pumping ? 'secondary' : 'primary'}
          icon={st.pumping ? Pause : Wind}
          onClick={pump}
          disabled={busy || (st.pIn === 0 && !st.pumping)}
          className="min-h-[52px] text-[15px] lg:min-w-[210px]"
        >
          {st.pumping ? C.btn.pumpStop : C.btn.pump}
        </Btn>
        <Btn icon={Unplug} onClick={letIn} disabled={busy || st.letting || st.pIn >= P0 - 1} className="min-h-[52px] text-[15px]">
          {C.btn.letIn}
        </Btn>
        <Btn variant={!st.pumping && st.pIn < P0 - 1 && !busy ? 'primary' : 'secondary'} icon={Zap} onClick={pull} disabled={busy || st.pumping} className="min-h-[52px] text-[15px] lg:min-w-[170px]">
          {C.btn.pull(whole(n, dec))}
        </Btn>
        <Btn icon={RotateCcw} onClick={reset} disabled={st === IDLE} className="min-h-[52px] text-[15px] lg:ml-auto">
          {T.common.reset}
        </Btn>
      </div>

      <MagdeburgScene T={T} R={R} n={n} st={st} F={F} Tn={Tn} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={C.readouts.S}
          symbol="S"
          value={fmt(S, 3, dec)}
          unit={T.m2}
          accent={PC.h}
          textColor={PC.hText}
          sub={C.readouts.Ssub(whole(R * 100, dec), fmt(R, 2, dec))}
        />
        <Readout
          label={C.readouts.p}
          symbol="p"
          value={fmt(st.pIn / 1000, 1, dec)}
          unit={T.kPa}
          accent={PC.inside}
          textColor={PC.insideText}
          sub={C.readouts.pSub(fmt(P0 / 1000, 1, dec), fmt(dp / 1000, 1, dec))}
        />
        <Readout label={C.readouts.F} symbol="F" value={fmt(F / 1000, 1, dec)} unit={T.kN} accent={PC.F} textColor={PC.FText} active={st.pIn === 0}>
          <div className="mt-auto space-y-0.5 pt-1.5 text-xs leading-snug text-gray-400">
            <p className="text-[13px] text-gray-200">
              <Formula text="F = (p₀ − p)·πR²" />
            </p>
            <p className="tabular-nums">
              {pa100(dp, dec)}·{fmt(S, 3, dec)} ≈ {whole(Math.round(F / 100) * 100, dec)} {T.N}
            </p>
            <p className="tabular-nums text-gray-500">{C.readouts.Fkg(whole(Math.round(F / G / 10) * 10, dec))}</p>
          </div>
        </Readout>
        <Readout
          label={C.readouts.horses}
          symbol="n"
          value={whole(nMin, dec)}
          unit={C.horseUnit(nMin)}
          accent={PC.T}
          textColor={PC.TText}
          active={Tn > F && F > 0}
          sub={
            <>
              {C.readouts.horsesSub(whole(n, dec), whole(n, dec))}
              <br />
              <span style={{ color: Tn > F ? '#6ee7b7' : '#fca5a5' }}>{Tn > F ? C.readouts.enough : C.readouts.notEnough}</span>
            </>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="atm-mag-r"
            label={C.radius}
            symbol="R"
            min={5}
            max={40}
            step={1}
            value={Math.round(R * 100)}
            onChange={(v) => onR(v / 100)}
            accent={PC.h}
            display={`${whole(R * 100, dec)} ${T.cm}`}
            hint={C.radiusHint(fmt(S, 3, dec))}
          />
          <RangeField
            id="atm-mag-n"
            label={C.horses}
            symbol="n"
            min={1}
            max={24}
            step={1}
            value={n}
            onChange={onN}
            accent={PC.T}
            display={`${whole(n, dec)} ${C.horseUnit(n)}`}
            hint={C.horsesHint(whole(n, dec))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-[13px] leading-snug text-gray-300">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{C.daily.title}</p>
            <p className="mt-1.5">{C.daily.cup(fmt(Math.PI * 0.04 ** 2 * 1e4, 1, dec), whole(suction, dec), whole(suction / G, dec))}</p>
            <p className="mt-1 text-gray-400">{C.daily.hand(whole(P0 * 0.01, dec))}</p>
            <p className="mt-1 text-gray-400">{C.daily.straw(fmt(2, 0, dec), whole((2000 / (1000 * G)) * 100, dec))}</p>
            <p className="mt-1 text-gray-400">{C.daily.syringe(fmt(P0 / (1000 * G), 1, dec))}</p>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LiveGraph
            title={C.graph.title}
            series={series}
            dots={dots}
            xMax={40}
            yMax={60}
            xTicks={[0, 10, 20, 30, 40]}
            xLabel={C.graph.x}
            yLabel={C.graph.y}
            marker={R * 100}
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

function MagdeburgScene({ T, R, n, st, F, Tn }) {
  const C = T.mag;
  const dec = T.decimal;
  const apart = st.pull === 'split' || st.pull === 'apart';
  const straining = st.pull === 'pull' || st.pull === 'strain' || st.pull === 'held';

  return (
    <LabScene
      legend={[
        { color: PC.atm, label: C.legend.atm, kind: 'arrow' },
        { color: PC.F, label: C.legend.F, kind: 'arrow' },
        { color: PC.T, label: C.legend.T, kind: 'arrow' },
        { color: PC.inside, label: C.legend.inside, kind: 'dot' },
      ]}
      chips={
        <>
          <Chip icon={Wind} color={PC.inside}>
            {C.chipP(fmt(st.pIn / 1000, 1, dec))}
          </Chip>
          <Chip icon={Zap} color={PC.T} strong>
            {C.chipHorse}
          </Chip>
        </>
      }
      height={(W, narrow) => (narrow ? clamp(W * 0.95, 320, 380) : clamp(W * 0.36, 380, 430))}
      ariaLabel={C.sceneLabel(whole(R * 100, dec), fmt(st.pIn / 1000, 1, dec), fmt(F / 1000, 1, dec), whole(n, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const groundY = H - (narrow ? 26 : 38);
        const cx = W / 2;
        const kR = narrow ? clamp((W - 230) / (2 * R_MAX), 90, 170) : clamp((W - 560) / (2 * R_MAX), 170, 270);
        const r = Math.max(6, R * kR);
        const hs = narrow ? 0.52 : 1; // horse scale
        const harness = 33 * hs;
        const cy = groundY - Math.max(harness, r + 10);
        const fLen = narrow ? 90 : 160; // px for 50 kN
        const sF = fLen / F_SCALE_N;
        const t = st.t;
        const clock = st.clock;

        /* separation */
        const u = st.pull === 'split' ? clamp(t / 1.1, 0, 1) : st.pull === 'apart' ? 1 : 0;
        const ue = 1 - (1 - u) ** 3;
        const sepX = ue * (narrow ? 34 : 70);
        const dropY = u * u * Math.max(0, groundY - 4 - (cy + r));
        const rot = ue * 14;
        const jitter = st.pull === 'strain' ? Math.sin(clock * 55) * 1.3 : 0;

        /* poles and ropes */
        const poleL = { x: cx - r - sepX - 6 - jitter, y: cy + dropY };
        const poleR = { x: cx + r + sepX + 6 + jitter, y: cy + dropY };

        /* teams */
        const lanes = n <= 6 ? 1 : n <= 14 ? 2 : 3;
        const perLane = Math.ceil(n / lanes);
        const horseLen = 68 * hs;
        const gap = narrow ? 30 : 64;
        const sideLen = cx - r - gap - (narrow ? 8 : 18);
        const maxVis = narrow ? 3 : 12;
        const vis = Math.min(perLane, maxVis);
        const lurchMax = narrow ? 14 : 30;
        const spacing = vis > 1 ? Math.min(horseLen * 1.08, (sideLen - horseLen * 1.05 - lurchMax) / (vis - 1)) : 0;
        const lurch = ue * lurchMax;
        const walk = st.pull === 'pull' ? t * 1.4 : st.pull === 'split' ? t * 2.2 : 0;
        const strain = straining ? Math.min(1, st.pull === 'pull' ? t * 2 : 1) : st.pull === 'split' ? 1 - ue : 0;

        const team = (side) => {
          const out = [];
          const ropes = [];
          for (let lane = lanes - 1; lane >= 0; lane -= 1) {
            const count = Math.min(vis, Math.max(0, Math.min(perLane, n - lane * perLane)));
            if (count <= 0) continue;
            const ls = hs * (1 - lane * 0.08);
            const gy = groundY - lane * (narrow ? 7 : 12);
            const color = ['#8b5a2b', '#6f4521', '#a0693a'][lane];
            const x0 = cx + side * (r + gap + horseLen * 0.55 + lurch);
            for (let i = 0; i < count; i += 1) {
              const hx = x0 + side * i * spacing;
              out.push(
                <Horse
                  key={`h${side}-${lane}-${i}`}
                  x={hx}
                  y={gy}
                  s={ls}
                  dir={side}
                  phase={walk + i * 0.27 + lane * 0.13}
                  walking={st.pull === 'pull' || st.pull === 'split'}
                  strain={strain}
                  color={color}
                  dim={lane > 0}
                />,
              );
            }
            const farX = x0 + side * (count - 1) * spacing + side * 14 * ls;
            const pole = side < 0 ? poleL : poleR;
            const hy = gy - 33 * ls;
            const taut = straining || st.pull === 'split';
            const midX = (pole.x + farX) / 2;
            const sag = taut ? 0 : 10;
            ropes.push(
              <path
                key={`rope${side}-${lane}`}
                d={`M${pole.x.toFixed(1)},${pole.y.toFixed(1)} Q${midX.toFixed(1)},${((pole.y + hy) / 2 + sag).toFixed(1)} ${farX.toFixed(1)},${hy.toFixed(1)}`}
                fill="none"
                stroke="#78350f"
                strokeWidth={narrow ? 1.6 : 2.2}
                opacity={u > 0.2 && st.pull !== 'split' ? 0.85 : 1}
              />,
            );
          }
          const badgeX = cx + side * (r + gap + horseLen * 0.55 + lurch + (Math.min(vis, perLane) - 1) * spacing * 0.5);
          return { horses: out, ropes, badgeX };
        };
        const left = team(-1);
        const right = team(1);

        /* air outside and inside */
        const rndOut = seeded(31);
        const outside = [];
        for (let i = 0; i < (narrow ? 34 : 64); i += 1) {
          const x = 10 + rndOut() * (W - 20);
          const y = (narrow ? 50 : 70) + rndOut() * (groundY - (narrow ? 70 : 100));
          if (Math.hypot(x - cx, y - cy) > r + 30) outside.push({ x, y });
        }
        const rndIn = seeded(47);
        const nInAll = clamp(Math.round(40 * (R / 0.25) ** 2), 6, 64);
        const inside = Array.from({ length: nInAll }, () => {
          const a = rndIn() * Math.PI * 2;
          const rr = Math.sqrt(rndIn()) * (r - 6);
          return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
        }).slice(0, Math.round(nInAll * (st.pIn / P0)));

        /* pressure arrows on the surface (outside, pointing in) */
        const pArrows = [];
        if (!apart) {
          for (const deg of [30, 60, 90, 120, 150, 210, 240, 270, 300, 330]) {
            const a = (deg * Math.PI) / 180;
            const ux = Math.cos(a);
            const uy = -Math.sin(a);
            const len = narrow ? 16 : 24;
            const x1 = cx + ux * (r + 3 + len);
            const y1 = cy + uy * (r + 3 + len);
            if (y1 > groundY - 2 || cy + uy * (r + 3) > groundY - 2) continue;
            pArrows.push(<ForceArrow key={`pa${deg}`} x1={x1} y1={y1} x2={cx + ux * (r + 3)} y2={cy + uy * (r + 3)} color={PC.atm} width={narrow ? 1.8 : 2.4} head={narrow ? 6 : 8} />);
          }
        }
        const inLen = Math.min(r * 0.45, narrow ? 14 : 22) * (st.pIn / P0);
        const inArrows = [];
        if (!apart && r > 26 && inLen > 3) {
          for (const deg of [45, 135, 225, 315]) {
            const a = (deg * Math.PI) / 180;
            const ux = Math.cos(a);
            const uy = -Math.sin(a);
            inArrows.push(
              <ForceArrow key={`ia${deg}`} x1={cx + ux * (r - 4 - inLen)} y1={cy + uy * (r - 4 - inLen)} x2={cx + ux * (r - 4)} y2={cy + uy * (r - 4)} color={PC.inside} width={1.8} head={6} />,
            );
          }
        }

        /* the pump on the left, connected while it is in use */
        const pumpOn = !apart && !straining && !(st.pIn === 0 && !st.pumping);
        const valveA = (125 * Math.PI) / 180;
        const valve = { x: cx + Math.cos(valveA) * r, y: cy - Math.sin(valveA) * r };
        const pumpX = Math.max(narrow ? 30 : 60, cx - r - (narrow ? 70 : 150));
        const pumpY = narrow ? 64 : 92;
        const stroke = st.pumping ? 0.5 + 0.5 * Math.sin(st.phase * Math.PI * 2) : 0.2;

        const fArrow = !apart && F > 1 ? Math.max(6, F * sF) : 0;
        const tArrow = straining || st.pull === 'split' ? Math.max(6, Tn * sF) : 0;
        const fY = cy - r - (narrow ? 26 : 38);

        return (
          <>
            <defs>
              <radialGradient id="atm-mag-brass" cx="0.35" cy="0.3" r="0.8">
                <stop offset="0" stopColor="#fde68a" />
                <stop offset="0.45" stopColor="#d4a04c" />
                <stop offset="1" stopColor="#8a5a1c" />
              </radialGradient>
            </defs>
            <rect x={0} y={0} width={W} height={H} fill="#fbfcfe" />
            <PaperGrid x0={0} y0={0} x1={W} y1={groundY} cell={narrow ? 22 : 32} ax={cx} ay={groundY} />

            {/* air */}
            <g aria-hidden="true">
              {outside.map((d, i) => (
                <circle key={`o${i}`} cx={d.x} cy={d.y} r={narrow ? 1.6 : 2} fill={PC.air} opacity="0.4" />
              ))}
            </g>

            {/* ground */}
            <rect x={0} y={groundY} width={W} height={H - groundY} fill="#ecfccb" />
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#65a30d" strokeWidth="1.6" />

            {/* ropes and horses (behind the sphere's ropes stay under it) */}
            <g aria-hidden="true">
              {left.ropes}
              {right.ropes}
              {left.horses}
              {right.horses}
            </g>

            {/* the hemispheres */}
            <g aria-hidden="true">
              <g transform={`translate(${(-sepX - jitter).toFixed(1)} ${dropY.toFixed(1)}) rotate(${(-rot).toFixed(1)} ${cx} ${cy})`}>
                <path d={`M${cx - 2},${cy - r} A${r},${r} 0 0 0 ${cx - 2},${cy + r} Z`} fill="url(#atm-mag-brass)" stroke="#78350f" strokeWidth="1.4" />
                <rect x={cx - 6} y={cy - r - 4} width={5} height={2 * r + 8} rx={2} fill="#b45309" stroke="#78350f" strokeWidth="1" />
                <circle cx={cx - r - 6} cy={cy} r={narrow ? 3.5 : 5} fill="none" stroke="#78350f" strokeWidth="2" />
                {/* stopcock */}
                <line x1={valve.x} y1={valve.y} x2={valve.x - 7} y2={valve.y - 9} stroke="#57534e" strokeWidth="3" strokeLinecap="round" />
                <line
                  x1={valve.x - 7 - (st.pumping || st.letting ? 0 : 5)}
                  y1={valve.y - 9 - (st.pumping || st.letting ? 5 : 0)}
                  x2={valve.x - 7 + (st.pumping || st.letting ? 0 : 5)}
                  y2={valve.y - 9 + (st.pumping || st.letting ? 5 : 0)}
                  stroke={st.pumping || st.letting ? '#16a34a' : '#dc2626'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </g>
              <g transform={`translate(${(sepX + jitter).toFixed(1)} ${dropY.toFixed(1)}) rotate(${rot.toFixed(1)} ${cx} ${cy})`}>
                <path d={`M${cx + 2},${cy - r} A${r},${r} 0 0 1 ${cx + 2},${cy + r} Z`} fill="url(#atm-mag-brass)" stroke="#78350f" strokeWidth="1.4" />
                <rect x={cx + 1} y={cy - r - 4} width={5} height={2 * r + 8} rx={2} fill="#b45309" stroke="#78350f" strokeWidth="1" />
                <circle cx={cx + r + 6} cy={cy} r={narrow ? 3.5 : 5} fill="none" stroke="#78350f" strokeWidth="2" />
              </g>
            </g>

            {/* air inside, the cross-section S = πR² and the radius */}
            {!apart && (
              <g aria-hidden="true">
                <ellipse cx={cx} cy={cy} rx={r * 0.3} ry={r - 1} fill="rgba(220,38,38,0.08)" stroke={PC.F} strokeDasharray="4 3" strokeWidth="1.2" />
                {inside.map((d, i) => (
                  <circle key={`in${i}`} cx={d.x} cy={d.y} r={narrow ? 1.6 : 2.1} fill={PC.inside} opacity="0.85" />
                ))}
                {inArrows}
                {r > 34 && (
                  <>
                    <line x1={cx + 4} y1={cy} x2={cx + r * 0.94} y2={cy + r * 0.34} stroke="#1e3a8a" strokeWidth="1.4" />
                    <circle cx={cx + 4} cy={cy} r={2} fill="#1e3a8a" />
                    <HaloText x={cx + r * 0.5} y={cy + r * 0.17 + fs + 3} fs={fs - 1} color="#1e3a8a">
                      {`R = ${whole(R * 100, dec)} ${T.cm}`}
                    </HaloText>
                    <HaloText x={cx - r * 0.5} y={cy - r * 0.3} fs={fs - 1} color="#b91c1c">
                      {'S = πR²'}
                    </HaloText>
                  </>
                )}
              </g>
            )}
            {pArrows}

            {/* the air's force pressing the halves together, at the joint */}
            {fArrow > 0 && (
              <g>
                <ForceArrow x1={cx - 4 - fArrow} y1={fY} x2={cx - 4} y2={fY} color={PC.F} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <ForceArrow x1={cx + 4 + fArrow} y1={fY} x2={cx + 4} y2={fY} color={PC.F} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <Pill x={cx} y={fY - (narrow ? 15 : 19)} text={C.tag.F(fmt(F / 1000, 1, dec))} bg={PC.F} size={fs} box={box} />
              </g>
            )}

            {/* the horses' pull at both ends */}
            {tArrow > 0 && (
              <g>
                <ForceArrow x1={poleL.x - 2} y1={poleL.y} x2={poleL.x - 2 - tArrow} y2={poleL.y} color={PC.T} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <ForceArrow x1={poleR.x + 2} y1={poleR.y} x2={poleR.x + 2 + tArrow} y2={poleR.y} color={PC.T} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <Pill x={poleR.x + 2 + Math.max(tArrow, 40) / 2} y={poleR.y - (narrow ? 16 : 21)} text={C.tag.T(whole(n, dec))} bg={PC.T} size={fs} box={box} />
              </g>
            )}

            {/* team badges */}
            <Pill x={left.badgeX} y={groundY - (narrow ? 50 : 84) - (lanes - 1) * (narrow ? 7 : 12)} text={C.tag.team(whole(n, dec))} bg="#78350f" size={fs - 1} box={box} />
            <Pill x={right.badgeX} y={groundY - (narrow ? 50 : 84) - (lanes - 1) * (narrow ? 7 : 12)} text={C.tag.team(whole(n, dec))} bg="#78350f" size={fs - 1} box={box} />

            {/* pump and hose */}
            {pumpOn && (
              <g aria-hidden="true">
                <path
                  d={`M${valve.x - 7},${valve.y - 9} C${valve.x - 30},${valve.y - 40} ${pumpX + 50},${pumpY + 60} ${pumpX + 9},${pumpY + 46}`}
                  fill="none"
                  stroke="#475569"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path
                  d={`M${valve.x - 7},${valve.y - 9} C${valve.x - 30},${valve.y - 40} ${pumpX + 50},${pumpY + 60} ${pumpX + 9},${pumpY + 46}`}
                  fill="none"
                  stroke={st.pumping ? '#7dd3fc' : '#94a3b8'}
                  strokeWidth="1.6"
                  strokeDasharray="5 6"
                  strokeDashoffset={(-st.clock * 40).toFixed(1)}
                />
                <rect x={pumpX - 9} y={pumpY} width={18} height={48} rx={3} fill="#cbd5e1" stroke="#475569" strokeWidth="1.3" />
                <rect x={pumpX - 15} y={pumpY + 46} width={30} height={5} rx={2} fill="#64748b" />
                <line x1={pumpX} x2={pumpX} y1={pumpY - 18 + stroke * 16} y2={pumpY + 4} stroke="#334155" strokeWidth="2.4" />
                <line x1={pumpX - 12} x2={pumpX + 12} y1={pumpY - 18 + stroke * 16} y2={pumpY - 18 + stroke * 16} stroke="#334155" strokeWidth="4" strokeLinecap="round" />
                <text x={pumpX + 16} y={pumpY + 20} fontSize={fs - 1} fontWeight="700" fill="#475569">
                  {C.tag.pump}
                </text>
              </g>
            )}

            {/* burst of air when they come apart */}
            {st.pull === 'split' && t < 0.8 && (
              <g aria-hidden="true" opacity={1 - t / 0.8}>
                {[-60, -30, 0, 30, 60, 120, 150, 180, 210, 240].map((d) => {
                  const a = (d * Math.PI) / 180;
                  const r0 = 8 + t * 40;
                  return (
                    <line
                      key={`b${d}`}
                      x1={cx + Math.cos(a) * r0}
                      y1={cy + dropY - Math.sin(a) * r0 * 1.6}
                      x2={cx + Math.cos(a) * (r0 + 14)}
                      y2={cy + dropY - Math.sin(a) * (r0 + 14) * 1.6}
                      stroke={PC.air}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/**
 * A horse in side view facing `dir` (1 right, −1 left), hooves on y, `s`
 * its scale. `phase` drives the legs while `walking`; `strain` (0…1) leans
 * it into the collar with the hind legs pushed back.
 */
function Horse({ x, y, s, dir, phase, walking, strain, color, dim }) {
  const mane = '#3b2410';
  const lean = strain * 6;
  const leg = (bx, off, hind) => {
    const sw = walking ? Math.sin((phase + off) * Math.PI * 2) * 7 : 0;
    const push = hind ? -strain * 7 : strain * 2;
    return <line x1={bx} y1={-25} x2={bx + sw + push} y2={0} stroke={color} strokeWidth="4.2" strokeLinecap="round" />;
  };
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(dir * s).toFixed(3)} ${s.toFixed(3)}) rotate(${lean.toFixed(1)} 18 0)`} opacity={dim ? 0.92 : 1}>
      {leg(-15, 0.5, true)}
      {leg(13, 0, false)}
      <path d="M-20,-34 Q-33,-30 -30,-13" fill="none" stroke={mane} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx={0} cy={-31} rx={22} ry={9.5} fill={color} />
      <path d="M11,-37 L21,-53 L30,-50 L21,-28 Z" fill={color} />
      <path d="M22,-55 L38,-47 Q41,-43 36,-41 L25,-44 Z" fill={color} />
      <path d="M23,-55 L25,-61 L28,-54 Z" fill={color} />
      <path d="M12,-40 L22,-56" stroke={mane} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx={30} cy={-50} r={1.2} fill="#111827" />
      <ellipse cx={16} cy={-35} rx={3.4} ry={7.5} fill="#1f2937" transform="rotate(-25 16 -35)" />
      {leg(-10, 0.0, true)}
      {leg(18, 0.5, false)}
    </g>
  );
}
