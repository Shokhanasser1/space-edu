import { useState } from 'react';
import { Lightbulb, Pause, Play, RotateCcw, Sailboat, Timer, Trees } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useElementSize, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { PANEL, PanelTitle, SceneChip, ScenePanel, nf, nfa } from './UniformMotion.parts';

/**
 * "Daryodan suzish": a boat crosses a 60 m river. Relative to the water it
 * moves with velocity u (pointing where its bow points); the water moves
 * with the current w; relative to the bank the boat moves with v = u + w -
 * vector addition at right angles (or at any heading). The observer is
 * either on the bank or on a raft drifting with the water. Seen from above,
 * x downstream, y across. Strings come from TEXT.river of RelativityOfMotion.jsx.
 */

const D = 60; // m, river width
const FAST = 2; // time runs 2× faster on screen
const COL = {
  u: PALETTE.second,
  uText: PALETTE.secondText,
  w: '#0284c7',
  wText: '#7dd3fc',
  v: PALETTE.vel,
  vText: PALETTE.velText,
  path: PALETTE.path,
  bank: '#d97706',
  water: '#0284c7',
};

function hash(i) {
  const s = Math.sin(i * 57.31 + 3.7) * 43758.5453;
  return s - Math.floor(s);
}

export default function RiverSim({ T }) {
  const t = T.river;
  const dec = T.decimal;
  const [frame, setFrame] = useState('bank');
  const [u, setU] = useState(3);
  const [w, setW] = useState(1.5);
  const [ang, setAng] = useState(0);
  const [sim, setSim] = useState({ t: 0, running: false, done: false });
  const [blend, setBlend] = useTween(0);

  const a = (ang * Math.PI) / 180;
  const ux = u * Math.sin(a);
  const uy = u * Math.cos(a);
  const vx = ux + w;
  const vy = uy;
  const vMag = Math.hypot(vx, vy);
  const tEnd = D / uy;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt * FAST;
      if (tt >= tEnd) return { t: tEnd, running: false, done: true };
      return { ...p, t: tt };
    });
  });

  const idle = { t: 0, running: false, done: false };
  const toggle = () => {
    if (sim.done) setSim({ ...idle, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const pickFrame = (f) => {
    setFrame(f);
    setBlend(f === 'water' ? 1 : 0, 650);
  };
  const change = (setter) => (val) => {
    setter(val);
    setSim(idle);
  };

  const time = Math.min(sim.t, tEnd);
  const A = (n) => nfa(n, 1, dec);
  const F = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const drift = vx * tEnd;

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (time > 0 || sim.running) {
    if (w < 0.05) key = 'noCurrent';
    else if (Math.abs(vx) < 0.05) key = 'straight';
    else key = frame;
  }
  const settled = useSettled(key, key === 'idle' || key === 'done' ? 0 : 300);
  const ex = t.explain;
  const text = {
    idle: ex.idle,
    bank: ex.bank(F2(vMag)),
    water: ex.water,
    straight: ex.straight(A(Math.abs(ang))),
    noCurrent: ex.noCurrent,
    done: ex.done(F(tEnd), nf(drift, 1, dec), F(u * tEnd), F(vMag * tEnd)),
  }[settled];
  const tone = settled === 'done' ? '#34d399' : frame === 'bank' ? '#f59e0b' : '#38bdf8';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{T.frames.label}</p>
          <Segmented
            label={T.frames.label}
            className="grid-cols-2"
            size="lg"
            value={frame}
            onChange={pickFrame}
            accent={frame === 'bank' ? '#f59e0b' : '#38bdf8'}
            options={[
              { value: 'bank', label: t.frames.bank.name, sub: t.frames.bank.sub, icon: Trees },
              { value: 'water', label: t.frames.water.name, sub: t.frames.water.sub, icon: Sailboat },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="md:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : sim.done ? T.common.again : time > 0 ? T.common.resume : T.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={() => setSim(idle)} disabled={time === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <RiverScene t={t} T={T} frame={frame} blend={blend} u={u} w={w} a={a} time={time} tEnd={tEnd} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.v} symbol="v" value={F2(vMag)} unit={T.ms} accent={COL.v} textColor={COL.vText} active={frame === 'bank'} sub={t.vSub} />
        <Readout label={t.readouts.time} symbol="t" value={F(tEnd)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={t.timeSub(A(D), F2(uy))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / tEnd) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={t.readouts.drift} symbol="s" value={nf(drift, 1, dec)} unit={T.m} accent={PALETTE.disp} textColor={PALETTE.dispText} sub={t.driftSub(F2(vx), F(tEnd))} />
        <Readout label={t.readouts.formula} accent="#e2e8f0">
          <p className="mt-1.5 text-lg font-semibold tracking-wide text-gray-300">{t.formula}</p>
          <p className="mt-1 text-[14px] font-semibold tabular-nums leading-snug text-white">
            {Math.abs(ang) < 1e-9 ? t.formulaPerp(A(u), A(w), F2(vMag)) : t.formulaGen(F2(vx), F2(vy), F2(vMag))}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField id="rel-r-u" label={t.boat} symbol="u" min={1} max={5} step={0.1} value={u} onChange={change(setU)} accent="#f472b6" display={`${A(u)} ${T.ms}`} />
          <RangeField id="rel-r-w" label={t.current} symbol="w" min={0} max={3} step={0.1} value={w} onChange={change(setW)} accent="#38bdf8" display={`${A(w)} ${T.ms}`} />
          <RangeField id="rel-r-a" label={t.angle} symbol="α" min={-60} max={60} step={5} value={ang} onChange={change(setAng)} accent="#e2e8f0" display={t.deg(nf(ang, 0, dec))} hint={t.angleHint} />
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <Triangle t={t} dec={dec} ux={ux} uy={uy} w={w} vx={vx} vy={vy} frame={frame} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------- the vector triangle */

function Triangle({ t, dec, ux, uy, w, vx, vy, frame }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  const H = 200;
  const A = (n) => fmt(n, 2, dec);
  const minX = Math.min(0, ux, vx);
  const maxX = Math.max(0, ux, vx);
  const s = Math.min((W - 170) / Math.max(maxX - minX, 0.5), (H - 40) / Math.max(uy, 0.5));
  const ox = 20 + (W - 170 - (maxX - minX) * s) / 2 - minX * s;
  const oy = H - 18;
  const P = (x, y) => [ox + x * s, oy - y * s];
  const [x0, y0] = P(0, 0);
  const [x1, y1] = P(ux, uy);
  const [x2, y2] = P(vx, vy);
  const arrow = (ax, ay, bx, by, color, bold, dim) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 2) return null;
    const ex = dx / len;
    const ey = dy / len;
    const hh = Math.min(13, len * 0.6);
    return (
      <g opacity={dim ? 0.35 : 1}>
        <line x1={ax} y1={ay} x2={bx - ex * (hh - 1)} y2={by - ey * (hh - 1)} stroke={color} strokeWidth={bold ? 5 : 3.5} strokeLinecap="round" />
        <path d={`M${bx},${by} L${bx - ex * hh - ey * hh * 0.55},${by - ey * hh + ex * hh * 0.55} L${bx - ex * hh + ey * hh * 0.55},${by - ey * hh - ex * hh * 0.55} Z`} fill={color} />
      </g>
    );
  };
  const water = frame === 'water';
  return (
    <div>
      <PanelTitle>{t.triTitle}</PanelTitle>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.uTag(A(Math.hypot(ux, uy)))}, ${t.wTag(A(w))}, ${t.vTag(A(Math.hypot(vx, vy)))}`} className="block overflow-visible">
          <line x1={x0} x2={x0} y1={oy} y2={14} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
          <line x1={14} x2={W - 150} y1={oy} y2={oy} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 4" />
          {arrow(x0, y0, x1, y1, '#f472b6', water)}
          {arrow(x1, y1, x2, y2, '#38bdf8', false, water)}
          {arrow(x0, y0, x2, y2, '#34d399', !water, water)}
          <text x={(x0 + x1) / 2 - 8} y={(y0 + y1) / 2} textAnchor="end" fontSize="12" fontWeight="700" fill={COL.uText}>
            u
          </text>
          <text x={(x1 + x2) / 2} y={y1 - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill={COL.wText} opacity={water ? 0.4 : 1}>
            w
          </text>
          <text x={(x0 + x2) / 2 + 10} y={(y0 + y2) / 2 + 14} fontSize="12" fontWeight="700" fill={COL.vText} opacity={water ? 0.4 : 1}>
            v
          </text>
          <g transform={`translate(${W - 140} 26)`}>
            {[
              [t.uTag(A(Math.hypot(ux, uy))), COL.uText, false],
              [t.wTag(A(w)), COL.wText, water],
              [t.vTag(A(Math.hypot(vx, vy))), COL.vText, water],
            ].map(([label, color, dim], i) => (
              <text key={label} x={0} y={i * 24} fontSize="13" fontWeight="600" fill={color} opacity={dim ? 0.4 : 1}>
                {label}
              </text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function RiverScene({ t, T, frame, blend, u, w, a, time, tEnd, done }) {
  const dec = T.decimal;
  const ux = u * Math.sin(a);
  const uy = u * Math.cos(a);
  const vx = ux + w;
  const isBank = frame === 'bank';
  const legend = [
    { color: COL.u, label: t.legend.u, kind: 'arrow' },
    { color: COL.w, label: t.legend.w, kind: 'arrow' },
    { color: COL.v, label: t.legend.v, kind: 'arrow' },
    { color: COL.path, label: t.legend.traj, kind: 'line' },
  ];
  const chips = (
    <>
      <SceneChip icon={isBank ? Trees : Sailboat} strong tone={isBank ? '#d97706' : '#0284c7'}>
        {T.frames.chip(t.frames[frame].name)}
      </SceneChip>
      <SceneChip icon={Timer}>{t.fastChip(fmt(time, 1, dec), FAST)}</SceneChip>
    </>
  );

  return (
    <ScenePanel height={(W, narrow) => (narrow ? 440 : 520)} ariaLabel={t.sceneLabel(t.frames[frame].who)} legend={legend} chips={chips}>
      {(W, H, narrow) => {
        const top = narrow ? 84 : 64;
        const bottom = 16;
        const k = (H - top - bottom) / (D + 16);
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const spanBank = [Math.min(0, vx * tEnd), Math.max(0, vx * tEnd)];
        const spanWater = [Math.min(0, ux * tEnd), Math.max(0, ux * tEnd)];
        const cBank = (spanBank[0] + spanBank[1]) / 2;
        const cWater = (spanWater[0] + spanWater[1]) / 2 + w * time;
        const cx = cBank * (1 - blend) + cWater * blend;
        const X = (x) => W / 2 + (x - cx) * k;
        const Y = (y) => H - bottom - (y + 8) * k;
        const xl = cx - W / (2 * k) - 10;
        const xr = cx + W / (2 * k) + 10;

        const bx = vx * time; // boat, bank frame
        const by = uy * time;
        const aK = narrow ? 11 : 15; // px per m/s
        const bpx = X(bx);
        const bpy = Y(by);
        const uEnd = [bpx + ux * aK, bpy - uy * aK];
        const vEnd = [bpx + vx * aK, bpy - uy * aK];
        const heading = (Math.atan2(ux, uy) * 180) / Math.PI; // degrees from straight across
        const boatL = narrow ? 22 : 30;

        /* ripples move with the water; trees stay with the ground */
        const ripples = [];
        const rStep = 9;
        for (let i = Math.floor((xl - w * time) / rStep); i <= Math.ceil((xr - w * time) / rStep); i += 1) {
          for (let j = 0; j < 6; j += 1) {
            const xw = i * rStep + hash(i * 7 + j) * rStep + w * time;
            const yw = 5 + j * 10 + hash(i + j * 13) * 4;
            ripples.push(
              <path key={`r${i}_${j}`} d={`M${X(xw) - 6},${Y(yw)} q3,-3 6,0 t6,0`} fill="none" stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round" />,
            );
          }
        }
        const trees = [];
        for (let i = Math.floor(xl / 6); i <= Math.ceil(xr / 6); i += 1) {
          for (const side of [-1, 1]) {
            if (hash(i * 3 + side) < 0.45) continue;
            const yy = side < 0 ? -5.8 - hash(i + 5) * 1.6 : D + 2.5 + hash(i + 9) * 4;
            const r = (1.1 + hash(i * 11 + side) * 0.8) * k;
            trees.push(<circle key={`t${i}${side}`} cx={X(i * 6 + hash(i) * 3)} cy={Y(yy)} r={r} fill={hash(i + side) > 0.5 ? '#4ade80' : '#22c55e'} fillOpacity="0.75" />);
          }
        }
        const bankTicks = [];
        const step = narrow ? 20 : 10;
        for (let i = Math.ceil(xl / step) * step; i <= xr; i += step) {
          const tx = X(i);
          bankTicks.push(
            <g key={`bt${i}`}>
              <line x1={tx} x2={tx} y1={Y(0)} y2={Y(0) + 6} stroke="#78350f" strokeOpacity="0.8" />
              {tx > 16 && tx < W - 16 && (
                <text x={tx} y={Y(0) + 18} textAnchor="middle" fontSize={fs - 1} fill="#78350f" fontWeight={i === 0 ? 700 : 500} stroke="#dcfce7" strokeWidth="3" paintOrder="stroke">
                  {nf(i, 0, dec)}
                </text>
              )}
            </g>,
          );
        }

        /* trajectories: bank frame from the pier; water frame from a point drifting with the water */
        const bankLine = { x1: X(0), y1: Y(0), x2: bpx, y2: bpy };
        const waterLine = { x1: X(w * time), y1: Y(0), x2: bpx, y2: bpy };
        const chosen = isBank ? bankLine : waterLine;
        const other = isBank ? waterLine : bankLine;
        const raftX = 18 + w * time;
        const raftY = D * 0.28;
        const driftX = vx * tEnd;

        return (
          <g>
            <rect width={W} height={H} fill="#f0fdf4" />
            {/* banks */}
            <rect x={0} y={0} width={W} height={Y(D)} fill="#dcfce7" />
            <rect x={0} y={Y(0)} width={W} height={H - Y(0)} fill="#dcfce7" />
            {trees}
            {/* water */}
            <rect x={0} y={Y(D)} width={W} height={Y(0) - Y(D)} fill="#e0f2fe" />
            <line x1={0} x2={W} y1={Y(D)} y2={Y(D)} stroke="#a16207" strokeOpacity="0.5" strokeWidth="2" />
            <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="#a16207" strokeOpacity="0.5" strokeWidth="2" />
            {ripples}
            {bankTicks}
            <text x={W - 8} y={Y(0) + (narrow ? 32 : 34)} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#78350f" stroke="#dcfce7" strokeWidth="3" paintOrder="stroke">
              x, {T.m}
            </text>
            {/* width of the river */}
            <g>
              <line x1={X(-6)} x2={X(-6)} y1={Y(0)} y2={Y(D)} stroke="#475569" strokeWidth="1.2" strokeDasharray="4 3" />
              <Pill x={X(-6)} y={Y(D / 2)} text={t.width(A0(D, dec))} bg="#fff" color="#334155" border="#cbd5e1" size={fs - 1} box={box} />
            </g>
            {/* the pier and the point straight across */}
            <rect x={X(0) - 0.9 * k} y={Y(0)} width={1.8 * k} height={4 * k} fill="#a16207" />
            <circle cx={X(0)} cy={Y(D)} r={4} fill="none" stroke="#475569" strokeWidth="1.5" />
            <line x1={X(0)} x2={X(0)} y1={Y(0)} y2={Y(D)} stroke="#475569" strokeOpacity="0.3" strokeDasharray="2 5" />

            {/* the raft, drifting with the water */}
            <g>
              <rect x={X(raftX) - 2.2 * k} y={Y(raftY) - 1.1 * k} width={4.4 * k} height={2.2 * k} rx={2} fill="#b45309" />
              {[0.7, 0, -0.7].map((d) => (
                <line key={d} x1={X(raftX) - 2.2 * k} x2={X(raftX) + 2.2 * k} y1={Y(raftY + d)} y2={Y(raftY + d)} stroke="#78350f" strokeWidth="1" />
              ))}
              {!isBank && <circle cx={X(raftX)} cy={Y(raftY)} r={3.4 * k} fill="none" stroke={COL.water} strokeWidth="2" strokeDasharray="4 3" />}
              <text x={X(raftX)} y={Y(raftY) + 2.2 * k + 12} textAnchor="middle" fontSize={fs - 1} fontWeight="600" fill="#78350f" stroke="#e0f2fe" strokeWidth="3" paintOrder="stroke">
                {t.raft}
              </text>
            </g>
            {/* the bank observer's spot */}
            {isBank && <circle cx={X(0)} cy={Y(-5)} r={2.6 * k} fill="none" stroke={COL.bank} strokeWidth="2" strokeDasharray="4 3" />}
            <circle cx={X(0)} cy={Y(-5)} r={1.1 * k} fill={COL.bank} />

            {/* trajectories */}
            {time > 0 && (
              <g>
                <line {...other} stroke={isBank ? COL.water : COL.bank} strokeWidth="2" strokeDasharray="6 5" strokeOpacity="0.8" />
                <line {...chosen} stroke={COL.path} strokeOpacity="0.2" strokeWidth="9" strokeLinecap="round" />
                <line {...chosen} stroke={COL.path} strokeWidth="3" strokeLinecap="round" />
              </g>
            )}

            {/* drift along the far bank */}
            {done && Math.abs(driftX) > 0.5 && (
              <g>
                <line x1={X(0)} x2={X(driftX)} y1={Y(D) - 12} y2={Y(D) - 12} stroke={PALETTE.disp} strokeWidth="2" />
                <line x1={X(0)} x2={X(0)} y1={Y(D) - 18} y2={Y(D) - 6} stroke={PALETTE.disp} strokeWidth="2" />
                <line x1={X(driftX)} x2={X(driftX)} y1={Y(D) - 18} y2={Y(D) - 6} stroke={PALETTE.disp} strokeWidth="2" />
                <Pill x={(X(0) + X(driftX)) / 2} y={Y(D) - 12} text={t.driftTag(nf(driftX, 1, dec))} bg={PALETTE.disp} size={fs - 1} box={box} />
              </g>
            )}

            {/* the boat, pointing where its bow points */}
            <g transform={`translate(${bpx.toFixed(1)} ${bpy.toFixed(1)}) rotate(${heading.toFixed(1)})`}>
              <path
                d={`M0,${-boatL / 2} C${boatL * 0.28},${-boatL * 0.2} ${boatL * 0.24},${boatL * 0.42} ${boatL * 0.16},${boatL / 2} L${-boatL * 0.16},${boatL / 2} C${-boatL * 0.24},${boatL * 0.42} ${-boatL * 0.28},${-boatL * 0.2} 0,${-boatL / 2} Z`}
                fill="#fff7ed"
                stroke="#9a3412"
                strokeWidth="1.6"
              />
              <line x1={-boatL * 0.18} x2={boatL * 0.18} y1={boatL * 0.12} y2={boatL * 0.12} stroke="#9a3412" strokeWidth="1.4" />
            </g>

            {/* velocity vectors at the boat: u, then w from its tip, and the sum v */}
            <VArrow x1={bpx} y1={bpy} x2={uEnd[0]} y2={uEnd[1]} color={COL.u} width={isBank ? 3 : 4} />
            <VArrow x1={uEnd[0]} y1={uEnd[1]} x2={vEnd[0]} y2={vEnd[1]} color={COL.w} width={3} opacity={isBank ? 1 : 0.35} />
            <VArrow x1={bpx} y1={bpy} x2={vEnd[0]} y2={vEnd[1]} color={COL.v} width={isBank ? 4 : 3} opacity={isBank ? 1 : 0.35} />
            {!done && (
              <>
                <Pill x={uEnd[0] - 36} y={uEnd[1] - 14} text={t.uTag(nfa(u, 1, dec))} bg={COL.u} size={fs - 1} box={box} />
                {isBank && <Pill x={vEnd[0] + 40} y={vEnd[1] + 4} text={t.vTag(fmt(Math.hypot(vx, uy), 2, dec))} bg={COL.v} size={fs - 1} box={box} />}
              </>
            )}
            {/* the current, drawn on the near bank side */}
            <VArrow x1={W - (narrow ? 70 : 110)} y1={Y(4)} x2={W - (narrow ? 70 : 110) + w * aK} y2={Y(4)} color={COL.w} width={3} opacity={isBank ? 1 : 0.4} />
            {w > 0.05 && <Pill x={W - (narrow ? 70 : 110) + w * aK / 2} y={Y(4) - 16} text={t.wTag(nfa(w, 1, dec))} bg="#fff" color={COL.w} border="#bae6fd" size={fs - 1} box={box} />}
          </g>
        );
      }}
    </ScenePanel>
  );
}

function A0(n, dec) {
  return fmt(n, 0, dec);
}

function VArrow({ x1, y1, x2, y2, color, width = 3, opacity = 1 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return null;
  const ex = dx / len;
  const ey = dy / len;
  const h = Math.min(11, len * 0.6);
  return (
    <g opacity={opacity}>
      <line x1={x1} y1={y1} x2={x2 - ex * (h - 1)} y2={y2 - ey * (h - 1)} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={`M${x2},${y2} L${x2 - ex * h - ey * h * 0.55},${y2 - ey * h + ex * h * 0.55} L${x2 - ex * h + ey * h * 0.55},${y2 - ey * h - ex * h * 0.55} Z`} fill={color} />
    </g>
  );
}
