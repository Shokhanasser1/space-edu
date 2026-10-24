import { useMemo, useRef, useState } from 'react';
import { ArrowUpToLine, Flame, Lightbulb, Mountain, RotateCw, Spline } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useRafLoop } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { G, SHAPES, TRACK_TOP, TRACK_W, buildTrack, stepCart } from './EnergyConservation.geometry';
import {
  Chip,
  EN,
  EnergyBars,
  EnergyGraph,
  FormulaTile,
  GroupLabel,
  LabScene,
  PlayControls,
  Rich,
  SpeedPicker,
  SvgRich,
  ToggleChip,
  fmtE,
  niceCeil,
  plain,
  schedule,
} from './EnergyConservation.parts';

/**
 * Tab 1 — the "skate park": a cart released from rest at height h₀ rolls on
 * a track (U-ramp, hill, loop, step). Without friction E = E_k + E_p stays
 * at E₀ = mgh₀, the speed at the bottom is v = √(2gh₀) whatever the mass and
 * the shape (preset h₀ = 5 m → 9.9 m/s), and the cart never rises above h₀.
 * With friction (μ) the total falls and the lost part becomes heat Q.
 */

const PRESETS = [
  { id: 'u', icon: Spline },
  { id: 'hill', icon: Mountain },
  { id: 'loop', icon: RotateCw },
  { id: 'step', icon: ArrowUpToLine },
];
const BOX = { x0: -0.35, x1: TRACK_W + 0.35, y0: -0.6, y1: TRACK_TOP + 0.6 };
const TRACE_DT = 0.02; // s of simulated time between graph samples
const TRACE_MAX = 1600;

export default function TrackSim({ T }) {
  const t = T.track;
  const dec = T.decimal;
  const [preset, setPreset] = useState('u');
  const [shape, setShape] = useState(SHAPES.u.def);
  const [h0, setH0] = useState(5);
  const [m, setM] = useState(50);
  const [friction, setFriction] = useState(false);
  const [mu, setMu] = useState(0.03);
  const [speed, setSpeed] = useState(0.5);
  const muEff = friction ? mu : 0;

  const track = useMemo(() => buildTrack(preset, shape), [preset, shape]);
  const s0 = useMemo(() => track.sAtHeight(h0), [track, h0]);
  const cfg = `${preset}|${shape}|${h0}|${m}|${muEff}`;
  const idle = useMemo(
    () => ({ cfg, s: s0, v: 0, t: 0, wall: 0, running: false, done: false, msg: null, trace: [], lastSample: -1 }),
    [cfg, s0],
  );
  const [raw, setSim] = useState(idle);
  const sim = raw.cfg === cfg ? raw : idle;
  const E0 = m * G * h0;

  useRafLoop(sim.running, (dtReal) => {
    setSim((p0) => {
      const p = p0.cfg === cfg ? p0 : idle;
      if (!p.running) return p;
      const dt = dtReal * speed;
      const yPrev = track.y(p.s);
      const xPrev = track.x(p.s);
      const next = stepCart(track, { s: p.s, v: p.v }, dt, { mu: muEff, h0 });
      const tt = p.t + dt;
      const wall = p.wall + dtReal;
      const y = track.y(next.s);
      const x = track.x(next.s);
      const v = next.v;
      // events worth a sentence
      let event = null;
      const mark = (k, yy = y) => {
        let kk = k;
        if (k === 'turn' && !friction && preset === 'hill' && shape > h0 && x > 4 && x < 10) kk = 'blocked';
        else if (k === 'turn' && !friction && preset === 'loop' && h0 < 2 * shape && x > 4.2 && x < 9.6) kk = 'loopFail';
        else if ((k === 'turn' || k === 'bottom') && friction) kk = `${k}Fr`;
        event = { k: kk, y: yy, v: Math.abs(v), q: E0 - m * (G * y + (v * v) / 2) };
      };
      // the highest point lies between two frames: where the remaining E_k would be spent
      if (!next.stopped && p.v !== 0 && Math.sign(v) !== Math.sign(p.v)) mark('turn', y + (v * v) / (2 * G));
      else if (yPrev > 0.03 && y <= 0.03) mark('bottom');
      else if (preset === 'hill' && (xPrev - 7) * (x - 7) <= 0 && y > shape - 0.1 && xPrev !== x) mark('hillTop');
      else if (preset === 'loop' && yPrev < 2 * shape - 0.03 && y >= 2 * shape - 0.03) mark('loopTop');
      else if (preset === 'step' && x > 7 && x < 10 && !(xPrev > 7 && xPrev < 10) && Math.abs(y - shape) < 0.05) mark('plateau');
      const phase = { k: (v * Math.sin(track.th(next.s)) < 0 ? 'down' : 'up') + (friction ? 'Fr' : '') };
      const msg = schedule(p.msg, { wall, event, phase, final: next.stopped ? { k: 'stopped' } : null });
      let { trace, lastSample } = p;
      if (tt - lastSample >= TRACE_DT || next.stopped) {
        const ek = (m * v * v) / 2;
        const ep = m * G * y;
        trace = [...(trace.length >= TRACE_MAX ? trace.slice(trace.length - TRACE_MAX + 1) : trace), { x, ek, ep, e: ek + ep, q: E0 - ek - ep }];
        lastSample = tt;
      }
      return { ...p, s: next.s, v: next.stopped ? 0 : v, t: tt, wall, running: !next.stopped, done: next.stopped, msg, trace, lastSample };
    });
  });

  const toggle = () => {
    if (sim.done) setSim({ ...idle, running: true });
    else setSim({ ...sim, running: !sim.running });
  };
  const reset = () => setSim(idle);
  const pickPreset = (id) => {
    setPreset(id);
    setShape(SHAPES[id].def);
  };

  /* ---- derived physics */
  const y = track.y(sim.s);
  const x = track.x(sim.s);
  const th = track.th(sim.s);
  const v = sim.v;
  const ek = (m * v * v) / 2;
  const ep = m * G * y;
  const E = ek + ep;
  const Q = Math.max(0, E0 - E);
  const vmax = Math.sqrt(2 * G * h0);
  const started = sim.t > 0;

  /* ---- explanation */
  const ex = t.explain;
  const S1 = (n) => fmt(n, 1, dec);
  const msg = started ? sim.msg : null;
  const shown = msg ? `${msg.k}@${Math.round(msg.wall * 10)}` : 'idle';
  const base = msg ? msg.k : 'idle';
  const evd = msg ?? { y: 0, v: 0, q: 0 };
  const E0s = fmtE(E0, dec);
  const textOf = {
    idle: ex.idle,
    down: ex.down(E0s),
    up: ex.up(E0s),
    downFr: ex.downFr(E0s),
    upFr: ex.upFr(E0s),
    bottom: ex.bottom(fmt(h0, 1, dec), S1(vmax)),
    bottomFr: ex.bottomFr(S1(evd.v), S1(vmax), fmtE(evd.q, dec)),
    turn: ex.turn(fmt(evd.y, 2, dec), fmt(h0, 1, dec)),
    turnFr: ex.turnFr(fmt(evd.y, 2, dec), fmt(h0, 1, dec), fmtE(evd.q, dec)),
    blocked: ex.blocked(fmt(shape, 1, dec), fmt(h0, 1, dec)),
    hillTop: ex.hillTop(fmt(shape, 1, dec), S1(Math.sqrt(Math.max(0, 2 * G * (h0 - shape))))),
    loopTop: ex.loopTop(fmt(2 * shape, 1, dec), S1(Math.sqrt(Math.max(0, 2 * G * (h0 - 2 * shape))))),
    loopFail: ex.loopFail(fmt(2 * shape, 1, dec), fmt(h0, 1, dec)),
    plateau: ex.plateau(fmt(shape, 1, dec), S1(Math.sqrt(Math.max(0, 2 * G * (h0 - shape))))),
    stopped: ex.stopped(fmtE(Q, dec), E0s),
  };
  const text = textOf[base] ?? ex.idle;
  const tone = base.endsWith('Fr') || base === 'stopped' ? '#fb923c' : base === 'bottom' ? '#34d399' : base === 'turn' || base === 'blocked' || base === 'loopFail' ? '#60a5fa' : base === 'idle' ? '#22d3ee' : '#a78bfa';

  /* ---- graph */
  const theory = useMemo(() => {
    const ptsEp = [];
    const ptsEk = [];
    const stride = Math.max(1, Math.floor(track.n / 700));
    for (let k = 0; k < track.n; k += stride) {
      const epk = m * G * track.Y[k];
      ptsEp.push({ x: track.X[k], y: epk });
      ptsEk.push(E0 - epk >= 0 ? { x: track.X[k], y: E0 - epk } : null);
    }
    return { ptsEp, ptsEk };
  }, [track, m, E0]);
  const yMaxG = niceCeil(E0 * 1.25);
  const series = [
    { id: 'thEp', color: EN.epBar, points: theory.ptsEp, dash: '4 5', width: 1.5, opacity: 0.55 },
    { id: 'thEk', color: EN.ekBar, points: theory.ptsEk, dash: '4 5', width: 1.5, opacity: 0.45 },
    { id: 'e0', color: '#f8fafc', points: [{ x: 0, y: E0 }, { x: TRACK_W, y: E0 }], dash: '6 5', width: 1.2, opacity: 0.6 },
    { id: 'ep', color: EN.epBar, points: sim.trace.map((p) => ({ x: p.x, y: p.ep })) },
    { id: 'ek', color: EN.ekBar, points: sim.trace.map((p) => ({ x: p.x, y: p.ek })) },
    { id: 'e', color: '#f8fafc', points: sim.trace.map((p) => ({ x: p.x, y: p.e })) },
    ...(friction ? [{ id: 'q', color: EN.heatBar, points: sim.trace.map((p) => ({ x: p.x, y: p.q })) }] : []),
  ];
  const dots = [
    { id: 'dep', x, y: ep, color: EN.epBar },
    { id: 'dek', x, y: ek, color: EN.ekBar },
    { id: 'de', x, y: E, color: '#f8fafc' },
    ...(friction ? [{ id: 'dq', x, y: Q, color: EN.heatBar }] : []),
  ];

  const bars = [
    { id: 'ep', sym: 'E_p', value: ep, color: EN.epBar, textColor: EN.epText },
    { id: 'ek', sym: 'E_k', value: ek, color: EN.ekBar, textColor: EN.ekText },
    ...(friction ? [{ id: 'q', sym: 'Q', value: Q, color: EN.heatBar, textColor: EN.heatText }] : []),
    {
      id: 'e',
      sym: 'E',
      value: E,
      textColor: '#f8fafc',
      stack: [
        { value: ep, color: EN.epBar },
        { value: ek, color: EN.ekBar },
      ],
    },
  ];

  const presetName = t.presets[preset].name;
  const shapeDef = SHAPES[preset];
  const shapeT = t.shape[preset];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{t.presetsLabel}</GroupLabel>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pickPreset}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      {/* scene + energy bars */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
        <TrackScene
          T={T}
          track={track}
          preset={preset}
          shape={shape}
          sim={sim}
          h0={h0}
          s0={s0}
          x={x}
          y={y}
          th={th}
          v={v}
          friction={friction}
          mu={mu}
          speed={speed}
          canDrag={!sim.running}
          onDragH0={(h) => setH0(h)}
          ariaLabel={plain(t.scene.aria(presetName, fmt(y, 2, dec), fmt(Math.abs(v), 1, dec), fmtE(ek, dec), fmtE(ep, dec)))}
        />
        <EnergyBars
          title={T.energy.title}
          bars={bars}
          e0={E0}
          e0Label={T.energy.e0(E0s)}
          unit={T.energy.unit}
          decimal={dec}
          note={friction ? T.energy.noteFr : T.energy.note}
          ariaLabel={plain(T.energy.aria(fmtE(ep, dec), fmtE(ek, dec), fmtE(E, dec)))}
        />
      </div>

      <Explain icon={base.endsWith('Fr') || base === 'stopped' ? Flame : Lightbulb} id={shown} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      {/* readouts */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.v}
          symbol="v"
          value={fmt(Math.abs(v), 1, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={t.sub.v(fmt(Math.abs(v) * 3.6, 0, dec))}
        />
        <Readout
          label={t.readouts.h}
          symbol="h"
          value={fmt(y, 2, dec)}
          unit={T.m}
          accent={EN.ep}
          textColor={EN.epText}
          sub={<Rich>{t.sub.h(fmt(h0, 1, dec))}</Rich>}
        />
        <Readout
          label={t.readouts.e}
          symbol="E"
          value={fmtE(E, dec)}
          unit={T.J}
          accent="#e2e8f0"
          textColor="#f8fafc"
          sub={<Rich>{t.sub.e(fmtE(ek, dec), fmtE(ep, dec))}</Rich>}
        />
        {friction ? (
          <Readout
            label={t.readouts.q}
            symbol="Q"
            value={fmtE(Q, dec)}
            unit={T.J}
            accent={EN.heat}
            textColor={EN.heatText}
            active={Q > 0.5}
            sub={<Rich>{t.sub.q(fmt((Q / E0) * 100, 0, dec))}</Rich>}
          />
        ) : (
          <Readout
            label={t.readouts.vmax}
            symbol={
              <>
                v<sub className="text-[0.7em]">max</sub>
              </>
            }
            value={fmt(vmax, 1, dec)}
            unit={T.ms}
            accent={PALETTE.vel}
            textColor={PALETTE.velText}
            active={base === 'bottom'}
            sub={<Rich>{t.sub.vmax}</Rich>}
          />
        )}
      </div>

      {/* controls + graph */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ec-h0"
            label={t.h0}
            symbol={<Rich>h₀</Rich>}
            min={1}
            max={6.5}
            step={0.1}
            value={h0}
            onChange={setH0}
            accent={EN.epBar}
            display={`${fmt(h0, 1, dec)} ${T.m}`}
            hint={t.h0Hint}
          />
          <RangeField
            id="ec-shape"
            label={shapeT.label}
            symbol={<Rich>{shapeT.sym}</Rich>}
            min={shapeDef.min}
            max={shapeDef.max}
            step={shapeDef.step}
            value={shape}
            onChange={setShape}
            accent="#a78bfa"
            display={`${fmt(shape, 1, dec)} ${T.m}`}
            hint={shapeT.hint}
          />
          <RangeField
            id="ec-mass"
            label={t.mass}
            symbol="m"
            min={20}
            max={100}
            step={5}
            value={m}
            onChange={setM}
            accent={EN.body}
            display={`${fmt(m, 0, dec)} ${T.kg}`}
            hint={t.massHint}
          />
          <ToggleChip label={t.friction.label} sub={t.friction.sub} on={friction} onChange={setFriction} accent="#fb923c" />
          {friction && (
            <RangeField
              id="ec-mu"
              label={t.friction.mu}
              symbol="μ"
              min={0.01}
              max={0.1}
              step={0.01}
              value={mu}
              onChange={setMu}
              accent="#fb923c"
              display={fmt(mu, 2, dec)}
            />
          )}
          <SpeedPicker label={T.speedLabel} value={speed} onChange={setSpeed} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyGraph
            title={t.graph.title}
            legend={[
              { label: T.energy.ep, color: EN.epBar },
              { label: T.energy.ek, color: EN.ekBar },
              { label: T.energy.e, color: '#f8fafc' },
              ...(friction ? [{ label: T.energy.q, color: EN.heatBar }] : []),
              { label: t.graph.theory, color: '#94a3b8', dash: true },
            ]}
            series={series}
            dots={dots}
            xMin={0}
            xMax={TRACK_W}
            yMax={yMaxG}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={250}
            decimal={dec}
            marker={x}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <FormulaTile tag={t.f.e0.tag} color="#e2e8f0" general={t.f.e0.general} filled={t.f.e0.filled(fmt(m, 0, dec), fmt(h0, 1, dec), E0s)} ok={started} />
            <FormulaTile
              tag={t.f.vmax.tag}
              color={PALETTE.velText}
              general={t.f.vmax.general}
              filled={t.f.vmax.filled(fmt(h0, 1, dec), S1(vmax))}
              ok={base === 'bottom'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function TrackScene({ T, track, preset, shape, sim, h0, s0, x, y, th, v, friction, mu, speed, canDrag, onDragH0, ariaLabel }) {
  const t = T.track;
  const dec = T.decimal;
  const drag = useRef(null);

  const legend = [
    { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: t.legend.h, color: EN.ep, kind: 'dim' },
    { label: t.legend.h0, color: EN.totalInk, kind: 'dash' },
    { label: t.legend.zero, color: '#64748b', kind: 'line' },
  ];
  const chips = (
    <>
      {speed !== 1 && <Chip>{T.slowChip(speed)}</Chip>}
      {friction && (
        <Chip icon={Flame} color="#ea580c">
          {t.chipFr(fmt(mu, 2, dec))}
        </Chip>
      )}
    </>
  );

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 0.72, 250, 330) : clamp(W * 0.6, 380, 500))}>
      {(W, H, narrow) => {
        const pad = narrow ? { l: 30, r: 10, t: 46, b: 26 } : { l: 40, r: 18, t: 62, b: 30 };
        const view = makeView(BOX, W, H, pad);
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const k = view.k;
        const yStep = [1, 2, 5].find((st) => st * k >= (narrow ? 30 : 40)) ?? 5;
        const xStep = [1, 2, 5].find((st) => st * k >= (narrow ? 36 : 54)) ?? 5;
        const xTicks = [];
        for (let xx = 0; xx <= TRACK_W + 1e-9; xx += xStep) xTicks.push(xx);
        const yTicks = [];
        for (let yy = 0; yy <= TRACK_TOP + 1e-9; yy += yStep) if (view.sy(yy) > pad.t + 22) yTicks.push(yy);
        // lower envelope (fill under the track — the loop stands on the flat)
        const bins = new Map();
        for (let i = 0; i < track.n; i += 2) {
          const b = Math.round(track.X[i] / 0.05);
          const prev = bins.get(b);
          if (prev === undefined || track.Y[i] < prev) bins.set(b, track.Y[i]);
        }
        const env = [...bins.entries()].sort((a, b) => a[0] - b[0]);
        const fillPts = [
          `${view.sx(0)},${view.sy(0)}`,
          ...env.map(([b, yy]) => `${view.sx(b * 0.05).toFixed(1)},${view.sy(yy).toFixed(1)}`),
          `${view.sx(TRACK_W)},${view.sy(0)}`,
        ].join(' ');
        const stride = Math.max(1, Math.floor(track.n / Math.max(300, (track.L * k) / 2)));
        const railPts = [];
        for (let i = 0; i < track.n; i += stride) railPts.push(`${view.sx(track.X[i]).toFixed(1)},${view.sy(track.Y[i]).toFixed(1)}`);
        railPts.push(`${view.sx(track.X[track.n - 1]).toFixed(1)},${view.sy(track.Y[track.n - 1]).toFixed(1)}`);
        const rail = railPts.join(' ');

        // cart
        const px = view.sx(x);
        const py = view.sy(y);
        const deg = (-th * 180) / Math.PI;
        const cs = narrow ? 0.72 : 1;
        const nx = -Math.sin(th);
        const ny = Math.cos(th); // world normal (towards the cart)
        const cx = px + nx * 15 * cs;
        const cy = py - ny * 15 * cs;
        const dir = Math.sign(v) || 1;
        const vLen = Math.abs(v) * 0.24 * k;
        const tx = Math.cos(th) * dir;
        const ty = -Math.sin(th) * dir;

        // start point and h₀ line
        const sx0 = view.sx(track.x(s0));
        const sy0 = view.sy(track.y(s0));
        const yH0 = view.sy(h0);
        const yZero = view.sy(0);

        const onDown = (e) => {
          if (!canDrag) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { rect: e.currentTarget.ownerSVGElement.getBoundingClientRect() };
        };
        const onMove = (e) => {
          if (!drag.current) return;
          const r = drag.current.rect;
          const pyx = ((e.clientY - r.top) / r.height) * H;
          const hh = Math.round(clamp(view.wy(pyx), 1, 6.5) * 10) / 10;
          onDragH0(hh);
        };
        const onUp = () => {
          drag.current = null;
        };

        const showDim = y > 0.15;
        const dimX = px + (narrow ? -14 : -20) * (Math.cos(th) >= 0 ? 1 : -1);
        const idleNow = !sim.running && sim.t === 0;

        return (
          <g>
            <defs>
              <linearGradient id="ec-cart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#be185d" />
              </linearGradient>
              <linearGradient id="ec-ramp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Grid view={view} W={W} H={H} minPx={narrow ? 22 : 30} />
            {/* ground below the zero level */}
            <rect x={0} y={yZero} width={W} height={H - yZero} fill="#f1f5f9" />
            <polygon points={fillPts} fill="url(#ec-ramp)" opacity="0.75" />
            <line x1={0} x2={W} y1={yZero} y2={yZero} stroke="#64748b" strokeWidth={1.6} />
            {!narrow && (
              <text x={W - 10} y={yZero + 15} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#475569">
                <SvgRich text={t.scene.zero} fs={fs - 1} />
              </text>
            )}
            {xTicks.map((xx) => (
              <text key={`xl${xx}`} x={view.sx(xx)} y={H - 8} textAnchor="middle" fontSize={fs - 1} fill={PALETTE.muted}>
                {fmt(xx, 0, dec)}
              </text>
            ))}
            <text x={W - 8} y={H - 8} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill={PALETTE.muted}>
              {t.scene.xAxis}
            </text>
            {yTicks.map((yy) => (
              <text key={`yl${yy}`} x={8} y={view.sy(yy) + 4} fontSize={fs - 1} fill={PALETTE.muted}>
                {fmt(yy, 0, dec)}
              </text>
            ))}
            <text x={8} y={view.sy(yTicks[yTicks.length - 1]) - 14} fontSize={fs - 1} fontWeight="600" fill={PALETTE.muted}>
              {t.scene.yAxis}
            </text>

            {/* shape markers */}
            {preset === 'hill' && <Dim view={view} x={7} y0={0} y1={shape} color="#7c3aed" label={t.scene.hillTag(fmt(shape, 1, dec))} fs={fs} side={1} box={box} />}
            {preset === 'loop' && (
              <Dim view={view} x={track.meta.loop.cx + shape + 0.35} y0={0} y1={2 * shape} color="#7c3aed" label={t.scene.loopTag(fmt(2 * shape, 1, dec))} fs={fs} side={1} box={box} />
            )}
            {preset === 'step' && <Dim view={view} x={8.5} y0={0} y1={shape} color="#7c3aed" label={t.scene.stepTag(fmt(shape, 1, dec))} fs={fs} side={1} box={box} />}

            {/* rail */}
            <polyline points={rail} fill="none" stroke="#1e293b" strokeWidth={narrow ? 4 : 5} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={rail} fill="none" stroke="#94a3b8" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />

            {/* start level h₀ — the cart never rises above it */}
            <line x1={pad.l - 6} x2={W - 6} y1={yH0} y2={yH0} stroke={EN.totalInk} strokeWidth={1.4} strokeDasharray="7 5" opacity="0.8" />
            <Pill x={view.sx(9)} y={yH0 - 13} text={t.scene.h0Tag(fmt(h0, 1, dec))} bg={EN.totalInk} size={fs} box={box} />

            {/* start marker */}
            {!idleNow && (
              <g opacity="0.55">
                <circle cx={sx0} cy={sy0} r={5} fill="#fff" stroke={EN.totalInk} strokeWidth={2} />
                <circle cx={sx0} cy={sy0} r={1.8} fill={EN.totalInk} />
              </g>
            )}

            {/* height of the cart above the zero level */}
            {showDim && (
              <g>
                <line x1={dimX} x2={dimX} y1={yZero} y2={py} stroke={EN.ep} strokeWidth={2} />
                <line x1={dimX - 5} x2={dimX + 5} y1={yZero} y2={yZero} stroke={EN.ep} strokeWidth={2} />
                <line x1={dimX - 5} x2={dimX + 5} y1={py} y2={py} stroke={EN.ep} strokeWidth={2} />
                {yZero - py > 34 && (
                  <Pill x={dimX + (dimX < px ? -40 : 40) * (narrow ? 0.85 : 1)} y={(yZero + py) / 2} text={t.scene.hTag(fmt(y, 1, dec))} bg={EN.ep} size={fs - 1} box={box} />
                )}
              </g>
            )}

            {/* velocity */}
            {vLen > 6 && (
              <g>
                <Arrow x1={cx + tx * 18 * cs} y1={cy + ty * 18 * cs} x2={cx + tx * (18 * cs + vLen)} y2={cy + ty * (18 * cs + vLen)} color={PALETTE.vel} width={3} head={11} />
                {vLen > 30 && (
                  <Pill x={cx + tx * (18 * cs + vLen + 34)} y={cy + ty * (18 * cs + vLen + 34) - 4} text={t.scene.vTag(fmt(Math.abs(v), 1, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
                )}
              </g>
            )}

            {/* cart: wheels on the rail, body on the cart side of it */}
            <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${cs})`}>
              {sim.running && <circle cx={0} cy={-15} r={22} fill={EN.body} className="cl-pulse" opacity="0.25" />}
              <rect x={-16} y={-25} width={32} height={15} rx={5} fill="url(#ec-cart)" stroke="#831843" strokeWidth={1.2} />
              <rect x={-10} y={-22} width={9} height={6} rx={1.5} fill="#fdf2f8" opacity="0.85" />
              <circle cx={6} cy={-29} r={4.5} fill="#fde68a" stroke="#92400e" strokeWidth={1} />
              <circle cx={-9} cy={-5} r={5} fill="#334155" stroke="#0f172a" strokeWidth={1.2} />
              <circle cx={9} cy={-5} r={5} fill="#334155" stroke="#0f172a" strokeWidth={1.2} />
              <circle cx={-9} cy={-5} r={1.6} fill="#e2e8f0" />
              <circle cx={9} cy={-5} r={1.6} fill="#e2e8f0" />
            </g>

            {/* drag handle */}
            {canDrag && (
              <g>
                <circle
                  cx={cx}
                  cy={cy}
                  r={narrow ? 24 : 28}
                  fill="transparent"
                  style={{ cursor: 'ns-resize', touchAction: 'none' }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                />
                {idleNow && <Pill x={cx + (narrow ? 44 : 54)} y={cy - 18} text={t.scene.drag} bg="#0f172a" size={fs - 1} box={box} />}
              </g>
            )}
          </g>
        );
      }}
    </LabScene>
  );
}

/** A vertical dimension line from y0 to y1 (m) at world x, with a label. */
function Dim({ view, x, y0, y1, color, label, fs, side = 1, box }) {
  const X = view.sx(x);
  const A = view.sy(y0);
  const B = view.sy(y1);
  return (
    <g opacity="0.9">
      <line x1={X} x2={X} y1={A} y2={B} stroke={color} strokeWidth={1.5} strokeDasharray="3 3" />
      <line x1={X - 5} x2={X + 5} y1={B} y2={B} stroke={color} strokeWidth={1.5} />
      <line x1={X - 5} x2={X + 5} y1={A} y2={A} stroke={color} strokeWidth={1.5} />
      <Pill x={X + side * 38} y={(A + B) / 2} text={label} bg={color} size={fs - 1} box={box} />
    </g>
  );
}
