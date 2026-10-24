import { useState } from 'react';
import { Building2, Coins, Lightbulb, Pause, RotateCcw, Timer, TrainFront } from 'lucide-react';

import { Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled, useTween } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { PANEL, PanelTitle, SceneChip, ScenePanel, nf, nfa } from './UniformMotion.parts';

/**
 * "Tushgan tanga": a passenger standing in a moving carriage lets go of a
 * coin. Relative to the carriage it falls straight down; relative to the
 * platform it also keeps the train's velocity V and traces a parabola
 * x = V·t, y = h − g·t²/2. The scene is drawn to true scale (1 m is the same
 * length across and up), so the shape of the curve is real. Strings come
 * from TEXT.coin / TEXT.frames of RelativityOfMotion.jsx.
 */

const G = 9.8;
const SLOW = 10; // the 0.5 s fall is shown 10× slower
const CAR = 24; // m
const PASS = 6; // m, where the passenger stands, from the carriage's rear
const HAND = 0.45; // m, the hand is this far in front of the body
const STROBE = 0.05; // s
const COL = {
  platform: '#d97706',
  train: '#4f46e5',
  person: '#e11d48',
  coin: '#f59e0b',
  coinDark: '#92400e',
  path: PALETTE.path,
};

/** Length of the parabola from 0 to t (distance relative to the platform). */
function arcLength(V, t) {
  if (V < 1e-6) return (G * t * t) / 2;
  const q = Math.sqrt(V * V + G * G * t * t);
  return (t * q) / 2 + ((V * V) / (2 * G)) * Math.asinh((G * t) / V);
}

export default function CoinSim({ T }) {
  const t = T.coin;
  const fr = T.frames;
  const dec = T.decimal;
  const [frame, setFrame] = useState('platform');
  const [V, setV] = useState(20);
  const [h, setH] = useState(1.2);
  const [sim, setSim] = useState({ t: 0, running: false, done: false });
  const [blend, setBlend] = useTween(0);
  const tf = Math.sqrt((2 * h) / G);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt / SLOW;
      if (tt >= tf) return { t: tf, running: false, done: true };
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
    setBlend(f === 'train' ? 1 : 0, 650);
  };
  const change = (setter) => (val) => {
    setter(val);
    setSim(idle);
  };

  const time = Math.min(sim.t, tf);
  const fallen = (G * time * time) / 2;
  const sP = arcLength(V, time);
  // the 0.5 s fall is printed to the millisecond, and x = V·t uses the printed time
  const tR = Math.round(time * 1000) / 1000;
  const dx = V * tR;
  const F2 = (n) => fmt(n, 2, dec);
  const F3 = (n) => fmt(n, 3, dec);
  const A = (n) => nfa(n, 1, dec);

  let key = 'idle';
  if (sim.done) key = V < 0.05 ? 'doneStill' : frame === 'platform' ? 'donePlatform' : 'doneTrain';
  else if (time > 0 || sim.running) key = V < 0.05 ? 'still' : frame === 'platform' ? 'fallPlatform' : 'fallTrain';
  const settled = useSettled(key, 0);
  const ex = t.explain;
  const text = {
    idle: ex.idle,
    still: ex.still,
    fallPlatform: ex.fallPlatform,
    fallTrain: ex.fallTrain,
    donePlatform: ex.donePlatform(F3(tf), fmt(V * tf, 2, dec), fmt(arcLength(V, tf), 2, dec), A(h)),
    doneTrain: ex.doneTrain(A(h), fmt(arcLength(V, tf), 2, dec)),
    doneStill: ex.doneStill(A(h)),
  }[settled];
  const tone = settled.startsWith('done') ? '#34d399' : frame === 'platform' ? '#f59e0b' : '#818cf8';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{fr.label}</p>
          <Segmented
            label={fr.label}
            className="grid-cols-2"
            size="lg"
            value={frame}
            onChange={pickFrame}
            accent={frame === 'platform' ? '#f59e0b' : '#818cf8'}
            options={[
              { value: 'platform', label: fr.platform.name, sub: fr.platform.sub, icon: Building2 },
              { value: 'train', label: fr.train.name, sub: fr.train.sub, icon: TrainFront },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Coins} onClick={toggle} className="md:min-w-[170px] min-h-[52px] text-[15px]">
            {sim.running ? T.common.pause : sim.done ? t.dropAgain : time > 0 ? T.common.resume : t.drop}
          </Btn>
          <Btn icon={RotateCcw} onClick={() => setSim(idle)} disabled={time === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <CoinScene t={t} fr={fr} dec={dec} frame={frame} blend={blend} V={V} h={h} tf={tf} time={time} done={sim.done} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.time} symbol="t" value={F3(time)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={t.timeSub(F3(tf))}>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${(time / tf) * 100}%` }} />
          </div>
        </Readout>
        <Readout label={t.readouts.train} symbol="s′" value={F2(fallen)} unit={T.m} accent="#818cf8" textColor="#a5b4fc" active={frame === 'train'} sub={t.trainSub} />
        <Readout label={t.readouts.platform} symbol="s" value={F2(sP)} unit={T.m} accent="#f59e0b" textColor="#fcd34d" active={frame === 'platform'} sub={t.platformSub(F2(dx))} />
        <Readout label={t.readouts.formula} accent={PALETTE.path} sub={t.formulaSub}>
          <p className="mt-1.5 text-[14px] font-semibold tabular-nums leading-snug text-white">
            x = V·t = {A(V)} · {F3(tR)} = <span className="text-amber-200">{F2(dx)}</span> {T.m}
          </p>
          <p className="mt-1 text-[14px] font-semibold tabular-nums leading-snug text-white">
            y = h − g·t²/2 = <span className="text-violet-200">{F2(h - fallen)}</span> {T.m}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className={`lg:col-span-2 space-y-3 ${PANEL}`}>
          <RangeField id="rel-coin-V" label={t.trainSpeed} symbol="V" min={0} max={30} step={1} value={V} onChange={change(setV)} accent="#818cf8" display={`${A(V)} ${T.ms}`} hint={t.trainHint(A(V * 3.6))} />
          <RangeField id="rel-coin-h" label={t.height} symbol="h" min={0.6} max={1.8} step={0.1} value={h} onChange={change(setH)} accent={PALETTE.path} display={`${fmt(h, 1, dec)} ${T.m}`} hint={t.heightHint(F3(tf))} />
        </div>
        <div className={`lg:col-span-3 ${PANEL}`}>
          <Compare t={t} T={T} V={V} h={h} tf={tf} time={time} frame={frame} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- the two trajectories */

function Compare({ t, T, V, h, tf, time, frame }) {
  const [ref, { width }] = useElementSize();
  const dec = T.decimal;
  const W = Math.max(width, 260);
  const half = (W - 12) / 2;
  const H = 120;
  const span = Math.max(V * tf, 0.4);
  const k = Math.min((half - 30) / span, (H - 40) / h);
  const fallen = (G * time * time) / 2;
  const curve = (dxOn) => {
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i += 1) {
      const tau = (time * i) / n;
      pts.push(`${(dxOn ? V * tau : 0) * k},${((G * tau * tau) / 2) * k}`);
    }
    return pts.join(' ');
  };
  const panel = (x0, which) => {
    const on = frame === which;
    const isP = which === 'platform';
    const ox = x0 + (isP ? 16 : half / 2);
    const oy = 26;
    return (
      <g key={which}>
        <rect x={x0} y={0} width={half} height={H} rx={12} fill={on ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)'} stroke={on ? (isP ? '#f59e0b' : '#818cf8') : 'rgba(255,255,255,0.08)'} />
        <text x={x0 + 10} y={16} fontSize="11" fontWeight="600" fill={isP ? '#fcd34d' : '#a5b4fc'}>
          {isP ? t.compare.platform : t.compare.train}
        </text>
        <line x1={x0 + 8} x2={x0 + half - 8} y1={oy + h * k} y2={oy + h * k} stroke="rgba(255,255,255,0.2)" />
        <g transform={`translate(${ox} ${oy})`}>
          {time > 0 && <polyline points={curve(isP)} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinejoin="round" />}
          <circle cx={(isP ? V * time : 0) * k} cy={fallen * k} r="4" fill={COL.coin} stroke={COL.coinDark} strokeWidth="1.2" />
        </g>
        <text x={x0 + half - 10} y={H - 8} textAnchor="end" fontSize="11" fill="#94a3b8">
          {isP ? `${t.parabolaTag} · s = ${fmt(arcLength(V, time), 2, dec)} ${T.m}` : `${t.lineTag} · s′ = ${fmt(fallen, 2, dec)} ${T.m}`}
        </text>
      </g>
    );
  };
  return (
    <div>
      <PanelTitle>{t.compare.title}</PanelTitle>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.compare.title} className="block">
          {panel(0, 'train')}
          {panel(half + 12, 'platform')}
        </svg>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function CoinScene({ t, fr, dec, frame, blend, V, h, tf, time, done }) {
  const isP = frame === 'platform';
  const legend = [
    { color: COL.path, label: t.legend.traj, kind: 'line' },
    { color: isP ? COL.train : COL.platform, label: t.legend.other, kind: 'dash' },
    { color: COL.coin, label: t.legend.strobe, kind: 'dot' },
  ];
  const chips = (
    <>
      <SceneChip icon={isP ? Building2 : TrainFront} strong tone={isP ? '#d97706' : '#4f46e5'}>
        {fr.chip(fr[frame].name)}
      </SceneChip>
      <SceneChip icon={Timer}>{fr.slowChip(fmt(time, 3, dec), SLOW)}</SceneChip>
    </>
  );
  const geom = (W, narrow) => {
    const viewW = Math.max(narrow ? 11 : 16, V * tf + (narrow ? 3.5 : 6));
    const k = Math.min(W / viewW, 78);
    const top = narrow ? 84 : 62;
    const bottom = narrow ? 56 : 60;
    return { k, top, bottom, H: top + 3.95 * k + bottom };
  };

  return (
    <ScenePanel height={(W, narrow) => geom(W, narrow).H} ariaLabel={t.sceneLabel(fr[frame].who)} legend={legend} chips={chips}>
      {(W, H, narrow) => {
        const { k } = geom(W, narrow);
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const xs = narrow ? 1.4 : 2.6; // where the coin is released, on the platform axis
        const camX0 = blend * V * time;
        const X = (m) => (m - camX0) * k;
        const railY = H - (narrow ? 56 : 60);
        const floorY = railY - 1.0 * k;
        const ceilY = floorY - 2.5 * k;
        const roofY = ceilY - 0.25 * k;
        const Y = (y) => floorY - y * k;
        const platTop = railY + 5;
        const platBot = railY + 19;
        const rear = xs - (PASS + HAND) + V * time;
        const xl = camX0 - 2;
        const xr = camX0 + W / k + 2;
        const yOf = (tau) => h - (G * tau * tau) / 2;
        const coinX = xs + V * time;
        const coinR = clamp(0.075 * k, 3.5, 7);

        /* trajectories: relative to the platform (fixed to the ground) and to the carriage (fixed to the carriage) */
        const n = 48;
        const groundPts = [];
        for (let i = 0; i <= n; i += 1) {
          const tau = (time * i) / n;
          groundPts.push(`${X(xs + V * tau).toFixed(1)},${Y(yOf(tau)).toFixed(1)}`);
        }
        const carPts = `${X(coinX).toFixed(1)},${Y(h).toFixed(1)} ${X(coinX).toFixed(1)},${Y(yOf(time)).toFixed(1)}`;
        const strobes = [];
        for (let tau = 0; tau <= time + 1e-9; tau += STROBE) strobes.push(tau);

        /* scenery */
        const pillars = [];
        for (let i = Math.floor(xl / 4); i <= Math.ceil(xr / 4); i += 1) {
          pillars.push(<rect key={`p${i}`} x={X(i * 4) - 0.12 * k} y={0} width={0.24 * k} height={platTop} fill="#cbd5e1" />);
        }
        const pTicks = [];
        const every = narrow ? 2 : 1;
        for (let i = Math.ceil(xl); i <= Math.floor(xr); i += 1) {
          const tx = X(i);
          pTicks.push(<line key={`pt${i}`} x1={tx} x2={tx} y1={platBot} y2={platBot + (i % every === 0 ? 7 : 4)} stroke="#92400e" strokeOpacity={isP ? 0.9 : 0.45} strokeWidth="1.2" />);
          if (i % every === 0 && tx > 8 && tx < W - 30)
            pTicks.push(
              <text key={`pl${i}`} x={tx} y={platBot + 19} textAnchor="middle" fontSize={fs - 1} fill="#92400e" opacity={isP ? 1 : 0.55} fontWeight={i === 0 ? 700 : 500}>
                {nf(i, 0, dec)}
              </text>,
            );
        }
        const cTicks = [];
        for (let i = 0; i <= CAR; i += 1) {
          const tx = X(rear + i);
          if (tx < -10 || tx > W + 10) continue;
          const major = i % every === 0;
          cTicks.push(<line key={`ct${i}`} x1={tx} x2={tx} y1={ceilY} y2={ceilY + (major ? 7 : 4)} stroke={COL.train} strokeOpacity={isP ? 0.5 : 0.95} strokeWidth="1.2" />);
          if (major && tx > 10 && tx < W - 10)
            cTicks.push(
              <text key={`cl${i}`} x={tx} y={ceilY + 19} textAnchor="middle" fontSize={fs - 1} fill={COL.train} opacity={isP ? 0.55 : 1} fontWeight={i === 0 ? 700 : 500}>
                {i}
              </text>,
            );
        }
        const windows = [];
        for (let wx = 1.0; wx + 1.6 <= CAR - 0.6; wx += 2.45) windows.push(wx);

        /* the passenger, true scale, holding out the coin */
        const pX = X(rear + PASS);
        const ph = 1.75 * k;
        const sw = Math.max(2, ph * 0.06);
        const hipY = floorY - ph * 0.47;
        const shY = floorY - ph * 0.8;
        const handX = X(rear + PASS + HAND);
        const handY = Y(h);

        const atEnd = done;
        const parabolaLabel = time > tf * 0.55 && V > 0.5;

        return (
          <g>
            <defs>
              <linearGradient id="rel-coin-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#eef2ff" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#rel-coin-sky)" />
            {pillars}
            <rect x={0} y={roofY - 0.5 * k} width={W} height={0.14 * k} fill="#cbd5e1" />

            {/* the carriage: translucent far wall, windows, roof, floor, wheels */}
            <rect x={X(rear)} y={roofY} width={CAR * k} height={floorY - roofY} fill="#e0e7ff" fillOpacity="0.62" />
            {windows.map((wx) => (
              <rect key={wx} x={X(rear + wx)} y={ceilY + 0.42 * k} width={1.6 * k} height={0.85 * k} rx={Math.min(6, 0.12 * k)} fill="#fff" fillOpacity="0.55" stroke="#a5b4fc" strokeWidth="1" />
            ))}
            <rect x={X(rear)} y={roofY} width={CAR * k} height={ceilY - roofY} fill="#64748b" />
            <rect x={X(rear)} y={floorY} width={CAR * k} height={0.2 * k} fill="#475569" />
            <rect x={X(rear) + 0.3 * k} y={floorY + 0.2 * k} width={(CAR - 0.6) * k} height={0.32 * k} fill="#334155" />
            {[2.4, 4.0, CAR - 4.0, CAR - 2.4].map((wx) => (
              <circle key={wx} cx={X(rear + wx)} cy={railY - 0.42 * k} r={0.42 * k} fill="#334155" stroke="#0f172a" strokeWidth="1" />
            ))}
            <line x1={X(rear)} x2={X(rear)} y1={roofY} y2={floorY + 0.2 * k} stroke="#334155" strokeWidth="2" />
            <line x1={X(rear + CAR)} x2={X(rear + CAR)} y1={roofY} y2={floorY + 0.2 * k} stroke="#334155" strokeWidth="2" />
            <rect x={X(rear)} y={floorY - 0.06 * k} width={CAR * k} height={0.06 * k} fill={COL.train} fillOpacity="0.5" />
            <g>{cTicks}</g>
            <text x={W - 6} y={ceilY + (narrow ? 34 : 38)} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill={COL.train} opacity={isP ? 0.55 : 1}>
              {t.axisTrain}
            </text>

            {/* rails and platform */}
            <rect x={0} y={railY - 2} width={W} height={4} fill="#475569" />
            <rect x={0} y={platTop} width={W} height={platBot - platTop} fill="#e5e7eb" />
            <rect x={0} y={platTop} width={W} height={3} fill="#facc15" />
            <rect x={0} y={platBot} width={W} height={H - platBot} fill="#f8fafc" />
            <line x1={0} x2={W} y1={platBot} y2={platBot} stroke="#92400e" strokeWidth={isP ? 2 : 1} opacity={isP ? 1 : 0.5} />
            <g>{pTicks}</g>
            <text x={W - 6} y={platBot + (narrow ? 32 : 34)} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#92400e" opacity={isP ? 1 : 0.55}>
              {t.axisPlatform}
            </text>
            {/* where the coin was let go: on the ground, and in the carriage */}
            <path d={`M${X(xs)},${platBot - 1} l-5,-8 l10,0 Z`} fill={COL.platform} opacity={isP ? 1 : 0.6} />
            <path d={`M${X(rear + PASS + HAND)},${ceilY + 1} l-5,8 l10,0 Z`} fill={COL.train} opacity={isP ? 0.6 : 1} />

            {/* the passenger */}
            <g stroke={COL.person} strokeWidth={sw} strokeLinecap="round" fill="none">
              <line x1={pX} y1={hipY} x2={pX - ph * 0.08} y2={floorY} />
              <line x1={pX} y1={hipY} x2={pX + ph * 0.08} y2={floorY} />
              <line x1={pX} y1={hipY} x2={pX} y2={shY - ph * 0.03} />
              <line x1={pX} y1={shY} x2={pX - ph * 0.05} y2={shY + ph * 0.33} strokeOpacity="0.6" />
              <line x1={pX} y1={shY} x2={handX} y2={handY} />
              <circle cx={pX + ph * 0.01} cy={floorY - ph * 0.9} r={ph * 0.1} fill={COL.person} stroke="none" />
            </g>
            {!isP && <circle cx={pX} cy={floorY - ph * 0.6} r={ph * 0.6} fill="none" stroke={COL.train} strokeWidth="2" strokeDasharray="5 4" />}

            {/* the height h */}
            {time === 0 && (
              <g>
                <line x1={handX + 14} x2={handX + 14} y1={handY} y2={floorY} stroke="#64748b" strokeWidth="1.2" />
                <line x1={handX + 9} x2={handX + 19} y1={handY} y2={handY} stroke="#64748b" strokeWidth="1.2" />
                <line x1={handX + 9} x2={handX + 19} y1={floorY} y2={floorY} stroke="#64748b" strokeWidth="1.2" />
                <Pill x={handX + 14 + 34} y={(handY + floorY) / 2} text={t.hTag(fmt(h, 1, dec))} bg="#fff" color="#334155" border="#cbd5e1" size={fs - 1} box={box} />
              </g>
            )}

            {/* trajectories: the chosen one solid, the other dashed */}
            {time > 0 && (
              <g>
                <polyline points={isP ? carPts : groundPts.join(' ')} fill="none" stroke={isP ? COL.train : COL.platform} strokeWidth="2" strokeDasharray="5 4" strokeOpacity="0.85" />
                <polyline points={isP ? groundPts.join(' ') : carPts} fill="none" stroke={COL.path} strokeOpacity="0.2" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={isP ? groundPts.join(' ') : carPts} fill="none" stroke={COL.path} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {strobes.map((tau) => (
                  <circle key={tau.toFixed(2)} cx={isP ? X(xs + V * tau) : X(coinX)} cy={Y(yOf(tau))} r={coinR * 0.7} fill="#fde68a" stroke={COL.coinDark} strokeWidth="1" />
                ))}
              </g>
            )}

            {/* the coin */}
            <circle cx={X(coinX)} cy={Y(yOf(time))} r={coinR} fill={COL.coin} stroke={COL.coinDark} strokeWidth="1.5" />

            {/* labels */}
            {parabolaLabel && (
              <Pill
                x={X(xs + V * time * 0.45)}
                y={Y(yOf(time * 0.45)) - (narrow ? 16 : 22)}
                text={t.parabolaTag}
                bg={isP ? COL.path : '#fff'}
                color={isP ? '#fff' : COL.platform}
                border={isP ? undefined : '#fcd34d'}
                size={fs - 1}
                box={box}
              />
            )}
            {time > tf * 0.55 && (
              <Pill
                x={X(coinX) + (narrow ? 44 : 58)}
                y={Y(h * 0.55)}
                text={t.lineTag}
                bg={!isP ? COL.path : '#fff'}
                color={!isP ? '#fff' : COL.train}
                border={!isP ? undefined : '#c7d2fe'}
                size={fs - 1}
                box={box}
              />
            )}
            {atEnd && isP && V > 0.5 && (
              <g>
                {(() => {
                  const yy = (platTop + platBot) / 2;
                  return (
                    <>
                      <line x1={X(xs)} x2={X(coinX)} y1={yy} y2={yy} stroke={PALETTE.disp} strokeWidth="2.2" />
                      <line x1={X(xs)} x2={X(xs)} y1={yy - 7} y2={yy + 7} stroke={PALETTE.disp} strokeWidth="2.2" />
                      <line x1={X(coinX)} x2={X(coinX)} y1={yy - 7} y2={yy + 7} stroke={PALETTE.disp} strokeWidth="2.2" />
                      <Pill x={(X(xs) + X(coinX)) / 2} y={yy} text={t.dxTag(fmt(V * tf, 2, dec))} bg={PALETTE.disp} size={fs - 1} box={box} />
                    </>
                  );
                })()}
              </g>
            )}
          </g>
        );
      }}
    </ScenePanel>
  );
}
