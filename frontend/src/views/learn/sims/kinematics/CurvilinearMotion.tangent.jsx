import { useMemo, useState } from 'react';
import { Car, CircleDot, Disc3, Lightbulb, Pause, Play, RotateCcw, RotateCw, Scissors, Snowflake } from 'lucide-react';
import { Arrow, Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import { C, CarTop, LabScene, Label, RightAngle, TimeChip, YUnit, buildRoute, headingDeg, routeAt, sampleRoute } from './CurvilinearMotion.parts';

/**
 * Tab 1 - the velocity always points along the tangent to the trajectory.
 *  - puck: a puck on ice tied to a pin by a string goes round a circle; cut
 *    the string and it slides off along the tangent in a straight line;
 *  - road: a car on a winding road; on the straights the direction of the
 *    velocity stays, on the bends it turns (so there is an acceleration);
 *    on ice it slides off along the tangent;
 *  - wheel: sparks leave a grinding wheel along the tangent at the point of
 *    contact and fly in straight lines (time slowed down 100×).
 */

const TONES = { idle: '#22d3ee', spin: '#34d399', straight: '#93c5fd', bend: '#fb923c', released: '#a78bfa', done: '#34d399', end: '#34d399', run: '#fbbf24', moved: '#34d399', flipped: '#34d399', paused: '#22d3ee' };
const MODE_ICONS = { puck: CircleDot, road: Car, wheel: Disc3 };

export default function TangentSim({ t, c }) {
  const [mode, setMode] = useState('puck');
  const modeSel = (
    <div className="min-w-0 flex-1">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.modesLabel}</p>
      <Segmented
        label={t.modesLabel}
        className="grid-cols-1 sm:grid-cols-3"
        size="lg"
        value={mode}
        onChange={setMode}
        options={['puck', 'road', 'wheel'].map((m) => ({ value: m, label: t.modes[m].name, sub: t.modes[m].sub, icon: MODE_ICONS[m] }))}
      />
    </div>
  );
  if (mode === 'road') return <RoadMode key="road" t={t} c={c} modeSel={modeSel} />;
  if (mode === 'wheel') return <WheelMode key="wheel" t={t} c={c} modeSel={modeSel} />;
  return <PuckMode key="puck" t={t} c={c} modeSel={modeSel} />;
}

function Toolbar({ modeSel, c, running, done, started, onToggle, onReset, release }) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
      {modeSel}
      <div className="grid grid-cols-2 gap-2 xl:flex">
        <Btn variant="primary" icon={running ? Pause : Play} onClick={onToggle} className="xl:min-w-[140px] min-h-[52px] text-[15px]">
          {running ? c.common.pause : done ? c.common.again : started ? c.common.resume : c.common.start}
        </Btn>
        <Btn icon={RotateCcw} onClick={onReset} disabled={!started && !running} className="min-h-[52px] text-[15px]">
          {c.common.reset}
        </Btn>
        {release && (
          <Btn icon={release.icon} onClick={release.onClick} disabled={release.disabled} className="col-span-2 xl:col-span-1 min-h-[52px] text-[15px] border-violet-400/40">
            {release.label}
          </Btn>
        )}
      </div>
    </div>
  );
}

/** Graph of the direction of the velocity θ(t) (unwrapped, in degrees). */
function DirectionGraph({ t, samples, tNow, yMin, yMax, decimal, note }) {
  const xMax = Math.max(8, Math.ceil(tNow / 4) * 4);
  return (
    <TimeGraph
      title={t.graph.title}
      series={[{ id: 'th', label: t.graph.series, color: '#34d399', points: samples.length ? samples : [{ x: 0, y: 0 }], dot: samples.length > 0 }]}
      xMax={xMax}
      yMin={yMin}
      yMax={yMax}
      xLabel={t.graph.axisT}
      yLabel={t.graph.axisY}
      marker={tNow}
      decimal={decimal}
      note={note}
      height={190}
    />
  );
}

/* ================================================================= puck */

const PUCK_R = 1.5; // m, string length
const PUCK_FLY = 5.5; // m flown after the cut before the run ends
const PUCK0 = { t: 0, phi: 0, running: false, rel: null, done: false, samples: [] };

function puckState(sim, v) {
  if (sim.rel) {
    const dt = sim.t - sim.rel.t;
    return { x: sim.rel.x + sim.rel.vx * dt, y: sim.rel.y + sim.rel.vy * dt, vx: sim.rel.vx, vy: sim.rel.vy, th: sim.rel.th };
  }
  const p = sim.phi;
  return { x: PUCK_R * Math.cos(p), y: PUCK_R * Math.sin(p), vx: -v * Math.sin(p), vy: v * Math.cos(p), th: (p * 180) / Math.PI + 90 };
}

function PuckMode({ t, c, modeSel }) {
  const dec = c.decimal;
  const tp = t.puck;
  const [v, setV] = useState(3);
  const [sim, setSim] = useState(PUCK0);
  const st = puckState(sim, v);
  const speed = Math.hypot(st.vx, st.vy);

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const tt = p.t + dt;
      const next = p.rel ? { ...p, t: tt } : { ...p, t: tt, phi: p.phi + (v / PUCK_R) * dt };
      const s = puckState(next, v);
      const last = p.samples[p.samples.length - 1];
      const samples = !last || tt - last.x >= 0.05 ? [...p.samples, { x: tt, y: s.th }] : p.samples;
      if (p.rel && Math.hypot(s.x - p.rel.x, s.y - p.rel.y) > PUCK_FLY) return { ...next, samples, running: false, done: true };
      return { ...next, samples };
    });
  });

  const started = sim.t > 0;
  const toggle = () => {
    if (sim.done) setSim({ ...PUCK0, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(PUCK0);
  const cut = () =>
    setSim((p) => {
      const s = puckState(p, v);
      return { ...p, running: true, rel: { t: p.t, x: s.x, y: s.y, vx: s.vx, vy: s.vy, th: s.th, phi: p.phi } };
    });

  let key = 'idle';
  if (sim.done) key = 'done';
  else if (sim.rel) key = 'released';
  else if (started) key = 'spin';
  const settled = useSettled(key, 0);
  const text = { idle: tp.explain.idle, spin: tp.explain.spin(fmt(v, 1, dec)), released: tp.explain.released, done: tp.explain.done }[settled];

  const legend = [
    { kind: 'line', color: C.path, label: t.legend.path },
    { kind: 'arrow', color: C.vel, label: t.legend.vel },
    { kind: 'dash', color: C.vel, label: t.legend.tangent },
    { kind: 'line', color: '#475569', label: tp.legend.string },
  ];
  const thMax = Math.max(360, Math.ceil((st.th + 1) / 360) * 360);

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        modeSel={modeSel}
        c={c}
        running={sim.running}
        done={sim.done}
        started={started}
        onToggle={toggle}
        onReset={reset}
        release={{ icon: Scissors, label: tp.cut, onClick: cut, disabled: !!sim.rel || !started }}
      />

      <LabScene
        legend={legend}
        chip={<TimeChip text={tp.chip(fmt(sim.t, 1, dec))} />}
        height={(W, narrow) => (narrow ? Math.round(W * 0.95) : 440)}
        ariaLabel={tp.sceneLabel(fmt(speed, 1, dec), fmt(headingDeg((st.th * Math.PI) / 180), 0, dec))}
      >
        {(W, H, narrow) => <PuckScene W={W} H={H} narrow={narrow} t={t} c={c} sim={sim} st={st} v={speed} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.speed} symbol="|v|" value={fmt(speed, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.speedSub} />
        <Readout
          label={t.readouts.dir}
          symbol="θ"
          value={fmt(headingDeg((st.th * Math.PI) / 180), 0, dec)}
          unit="°"
          accent="#34d399"
          textColor="#a7f3d0"
          sub={sim.rel ? t.readouts.dirFixed : t.readouts.dirTurns}
        />
        <Readout label={t.readouts.time} symbol="t" value={fmt(sim.t, 1, dec)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.realTime} />
        <Readout label={tp.readouts.state} accent={C.path} active={!!sim.rel} sub={sim.rel ? tp.readouts.cutSub : tp.readouts.circleSub}>
          <p className="mt-1.5 text-lg sm:text-xl font-bold leading-tight" style={{ color: C.pathText }}>
            {sim.rel ? tp.readouts.line : tp.readouts.circle}
          </p>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="cm-puck-v"
            label={tp.speed}
            symbol="v"
            min={1}
            max={5}
            step={0.5}
            value={v}
            onChange={setV}
            accent={C.vel}
            display={`${fmt(v, 1, dec)} ${c.ms}`}
            hint={sim.rel ? tp.speedHintCut : tp.speedHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{t.watch}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-gray-500">
              {tp.tips.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <DirectionGraph t={t} samples={sim.samples} tNow={sim.t} yMin={0} yMax={thMax} decimal={dec} note={tp.graphNote} />
        </div>
      </div>
    </div>
  );
}

function PuckScene({ W, H, narrow, t, c, sim, st, v }) {
  const tp = t.puck;
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const box = narrow ? { x0: -2.5, x1: 2.5, y0: -2.5, y1: 2.5 } : { x0: -5.2, x1: 5.2, y0: -2.3, y1: 2.3 };
  const pad = narrow ? { l: 30, r: 12, t: 40, b: 26 } : { l: 40, r: 16, t: 52, b: 30 };
  const view = useMemo(() => makeView(box, W, H, pad), [W, H, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = view.k;
  const ox = view.sx(0);
  const oy = view.sy(0);
  const px = view.sx(st.x);
  const py = view.sy(st.y);
  const sp = Math.hypot(st.vx, st.vy) || 1;
  const u = { x: st.vx / sp, y: -st.vy / sp }; // screen unit vector of the velocity
  const rP = Math.max(8, 0.14 * k);
  const kv = narrow ? 13 : 20;
  const far = Math.hypot(W, H);

  /* trajectory: the arc travelled (up to one turn) and, after the cut, the straight piece */
  const phiEnd = sim.rel ? sim.rel.phi : sim.phi;
  const phiStart = Math.max(0, phiEnd - Math.PI * 2 * 0.92);
  const arc = [];
  const n = Math.max(2, Math.ceil(((phiEnd - phiStart) * 180) / Math.PI / 3));
  for (let i = 0; i <= n; i += 1) {
    const a = phiStart + ((phiEnd - phiStart) * i) / n;
    arc.push(`${view.sx(PUCK_R * Math.cos(a)).toFixed(1)},${view.sy(PUCK_R * Math.sin(a)).toFixed(1)}`);
  }
  if (sim.rel) arc.push(`${px.toFixed(1)},${py.toFixed(1)}`);

  const relP = sim.rel ? { x: view.sx(sim.rel.x), y: view.sy(sim.rel.y) } : null;
  const tanBase = relP ?? { x: px, y: py };
  const toC = { x: (ox - px) / (Math.hypot(ox - px, oy - py) || 1), y: (oy - py) / (Math.hypot(ox - px, oy - py) || 1) };
  const stubA = sim.rel ? sim.rel.phi : 0;

  return (
    <g>
      <Grid view={view} W={W} H={H} minPx={narrow ? 30 : 38} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 60 : 76} xUnit={t.axisX} decimal={dec} />
      <YUnit text={t.axisY} narrow={narrow} x={view.sx(0)} />

      {/* the circle the string allows */}
      <circle cx={ox} cy={oy} r={PUCK_R * k} fill="none" stroke="#64748b" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="5 6" />

      {/* tangent line through the puck (or through the cut point) */}
      <line
        x1={tanBase.x - u.x * far}
        y1={tanBase.y - u.y * far}
        x2={tanBase.x + u.x * far}
        y2={tanBase.y + u.y * far}
        stroke={C.vel}
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeDasharray="6 6"
      />

      {/* trajectory */}
      {arc.length > 1 && sim.t > 0 && (
        <>
          <polyline points={arc.join(' ')} fill="none" stroke={C.path} strokeOpacity="0.18" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={arc.join(' ')} fill="none" stroke={C.path} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}

      {/* pin and string */}
      {!sim.rel && <line x1={ox} y1={oy} x2={px} y2={py} stroke="#475569" strokeWidth="1.8" />}
      {sim.rel && (
        <line x1={ox} y1={oy} x2={ox + Math.cos(stubA) * 0.3 * k} y2={oy - Math.sin(stubA) * 0.3 * k} stroke="#475569" strokeWidth="1.8" strokeLinecap="round" />
      )}
      <circle cx={ox} cy={oy} r={narrow ? 5 : 6} fill="#fff" stroke={C.ink} strokeWidth="2.5" />
      <circle cx={ox} cy={oy} r={2} fill={C.ink} />
      <Label x={ox} y={oy + (narrow ? 20 : 22)} size={fs - 1} color={C.muted} weight={600}>
        {tp.pin}
      </Label>

      {relP && (
        <g>
          <circle cx={relP.x} cy={relP.y} r="5" fill="#fff" stroke={C.path} strokeWidth="2" />
          <Label x={relP.x} y={relP.y + 20} size={fs - 1} color={C.path}>
            {tp.cutPoint}
          </Label>
        </g>
      )}

      {/* right angle between the string and the velocity */}
      {!sim.rel && sim.t > 0 && <RightAngle x={px} y={py} u={toC} w={u} size={narrow ? 9 : 11} color="#475569" />}

      {/* velocity */}
      <Arrow x1={px + u.x * (rP + 2)} y1={py + u.y * (rP + 2)} x2={px + u.x * (rP + 2 + v * kv)} y2={py + u.y * (rP + 2 + v * kv)} color={C.vel} width={3.2} head={12} />
      <Label x={px + u.x * (rP + 14 + v * kv)} y={py + u.y * (rP + 14 + v * kv) + 4} size={fs + 2} color={C.vel} italic>
        v
      </Label>

      {/* puck */}
      {sim.running && <circle cx={px} cy={py} r={rP + 6} fill={C.path} className="cl-pulse" />}
      <circle cx={px} cy={py} r={rP} fill={C.ink} stroke="#fff" strokeWidth="2.5" />
      <circle cx={px} cy={py} r={rP * 0.45} fill="none" stroke="#475569" strokeWidth="1.5" />

      {!sim.rel && !narrow && (
        <Pill x={(ox + px) / 2 - toC.y * 14} y={(oy + py) / 2 + toC.x * 14} text={tp.rTag(fmt(PUCK_R, 1, dec))} bg="#fff" color="#334155" border="#cbd5e1" size={fs - 1} box={{ w: W, h: H }} />
      )}
    </g>
  );
}

/* ================================================================= road */

/** Direction in degrees in (−180°, 180°], as the θ(t) graph of the road shows it. */
function signedDeg(rad) {
  const d = headingDeg(rad);
  return d > 180 ? d - 360 : d;
}

const ROAD_W = 7; // m
const ROAD_K = 2; // time speed-up
const ROAD_R = 20; // m, radius of every bend
const ROUTE = buildRoute(0, 0, 0, [
  ['L', 12],
  ['A', ROAD_R, 90],
  ['L', 4],
  ['A', ROAD_R, -180],
  ['L', 4],
  ['A', ROAD_R, 90],
  ['L', 12],
]);
const ROUTE_PTS = sampleRoute(ROUTE, 0.5);
const ROUTE_BOX = (() => {
  const xs = ROUTE_PTS.map((p) => p.x);
  const ys = ROUTE_PTS.map((p) => p.y);
  return { x0: Math.min(...xs) - 6, x1: Math.max(...xs) + 6, y0: Math.min(...ys) - 6, y1: Math.max(...ys) + 6 };
})();
const ROAD0 = { t: 0, s: 0, running: false, rel: null, done: false, end: false, samples: [] };

function roadState(sim, v) {
  if (sim.rel) {
    const d = sim.rel.v * (sim.t - sim.rel.t);
    return { x: sim.rel.x + d * Math.cos(sim.rel.h), y: sim.rel.y + d * Math.sin(sim.rel.h), h: sim.rel.h, R: Infinity, speed: sim.rel.v };
  }
  return { ...routeAt(ROUTE, sim.s), speed: v };
}

function RoadMode({ t, c, modeSel }) {
  const dec = c.decimal;
  const tr = t.road;
  const [v, setV] = useState(8);
  const [sim, setSim] = useState(ROAD0);
  const st = roadState(sim, v);
  const bend = Number.isFinite(st.R);
  const acc = bend ? (st.speed * st.speed) / st.R : 0;

  useRafLoop(sim.running, (dtRaw) => {
    setSim((p) => {
      if (!p.running) return p;
      const dt = dtRaw * ROAD_K;
      const tt = p.t + dt;
      let next;
      if (p.rel) {
        next = { ...p, t: tt };
        const s = roadState(next, v);
        const b = ROUTE_BOX;
        if (s.x < b.x0 - 4 || s.x > b.x1 + 4 || s.y < b.y0 - 4 || s.y > b.y1 + 4) next = { ...next, running: false, done: true };
      } else {
        const s = p.s + v * dt;
        next = s >= ROUTE.length ? { ...p, t: tt - (s - ROUTE.length) / v, s: ROUTE.length, running: false, done: true, end: true } : { ...p, t: tt, s };
      }
      const s = roadState(next, v);
      const last = p.samples[p.samples.length - 1];
      const samples = !last || next.t - last.x >= 0.1 || next.done ? [...p.samples, { x: next.t, y: (s.h * 180) / Math.PI }] : p.samples;
      return { ...next, samples };
    });
  });

  const started = sim.t > 0;
  const toggle = () => {
    if (sim.done) setSim({ ...ROAD0, running: true });
    else setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim(ROAD0);
  const release = () =>
    setSim((p) => {
      const s = routeAt(ROUTE, p.s);
      return { ...p, running: true, rel: { t: p.t, x: s.x, y: s.y, h: s.h, v, s: p.s } };
    });

  let key = 'idle';
  if (sim.done) key = sim.end ? 'end' : 'done';
  else if (sim.rel) key = 'released';
  else if (started) key = bend ? 'bend' : 'straight';
  const settled = useSettled(key, key === 'bend' || key === 'straight' ? 250 : 0);
  const text = {
    idle: tr.explain.idle,
    straight: tr.explain.straight,
    bend: tr.explain.bend(fmt(v, 0, dec), fmt(ROAD_R, 0, dec), fmt((v * v) / ROAD_R, 1, dec)),
    released: tr.explain.released,
    done: tr.explain.done,
    end: tr.explain.end,
  }[settled];

  const legend = [
    { kind: 'line', color: C.path, label: t.legend.path },
    { kind: 'arrow', color: C.vel, label: t.legend.vel },
    { kind: 'dash', color: C.vel, label: t.legend.tangent },
    { kind: 'arrow', color: C.acc, label: tr.legend.acc },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        modeSel={modeSel}
        c={c}
        running={sim.running}
        done={sim.done}
        started={started}
        onToggle={toggle}
        onReset={reset}
        release={{ icon: Snowflake, label: tr.release, onClick: release, disabled: !!sim.rel || !started || sim.done }}
      />

      <LabScene
        legend={legend}
        chip={<TimeChip text={tr.chip(ROAD_K, fmt(sim.t, 1, dec))} />}
        height={(W, narrow) => {
          const b = ROUTE_BOX;
          const pad = narrow ? 30 + 12 : 40 + 16;
          const fit = ((W - pad) / (b.x1 - b.x0)) * (b.y1 - b.y0) + (narrow ? 66 : 82);
          return narrow ? Math.max(240, fit) : Math.min(500, Math.max(380, fit));
        }}
        ariaLabel={tr.sceneLabel(fmt(st.speed, 1, dec), fmt(headingDeg(st.h), 0, dec))}
      >
        {(W, H, narrow) => <RoadScene W={W} H={H} narrow={narrow} t={t} c={c} sim={sim} st={st} acc={acc} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.speed} symbol="|v|" value={fmt(st.speed, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.kmh(fmt(st.speed * 3.6, 0, dec))} />
        <Readout
          label={t.readouts.dir}
          symbol="θ"
          value={fmt(signedDeg(st.h), 0, dec)}
          unit="°"
          accent="#34d399"
          textColor="#a7f3d0"
          active={bend && !sim.rel && started}
          sub={bend && !sim.rel ? t.readouts.dirTurns : t.readouts.dirFixed}
        />
        <Readout
          label={tr.readouts.radius}
          symbol="R"
          value={bend && !sim.rel ? fmt(st.R, 0, dec) : '∞'}
          unit={bend && !sim.rel ? c.m : undefined}
          accent={C.path}
          textColor={C.pathText}
          sub={bend && !sim.rel ? tr.readouts.bendSub : tr.readouts.straightSub}
        />
        <Readout
          label={tr.readouts.acc}
          symbol="a"
          value={fmt(sim.rel ? 0 : acc, 1, dec)}
          unit={c.ms2}
          accent={C.acc}
          textColor={C.accText}
          active={acc > 0 && !sim.rel && started}
          sub={tr.readouts.accSub}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="cm-road-v"
            label={tr.speed}
            symbol="v"
            min={4}
            max={14}
            step={1}
            value={v}
            onChange={setV}
            accent={C.vel}
            display={`${fmt(v, 0, dec)} ${c.ms}`}
            hint={t.readouts.kmh(fmt(v * 3.6, 0, dec))}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{t.watch}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 marker:text-gray-500">
              {tr.tips.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <DirectionGraph t={t} samples={sim.samples} tNow={sim.t} yMin={-120} yMax={120} decimal={dec} note={tr.graphNote} />
        </div>
      </div>
    </div>
  );
}

function RoadScene({ W, H, narrow, t, c, sim, st, acc }) {
  const tr = t.road;
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const pad = narrow ? { l: 30, r: 12, t: 40, b: 26 } : { l: 40, r: 16, t: 52, b: 30 };
  const view = useMemo(() => makeView(ROUTE_BOX, W, H, pad), [W, H, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = view.k;
  const roadPts = useMemo(() => ROUTE_PTS.map((p) => `${view.sx(p.x).toFixed(1)},${view.sy(p.y).toFixed(1)}`).join(' '), [view]);
  const sDone = sim.rel ? sim.rel.s : sim.s;
  const trail = sampleRoute(ROUTE, 0.5, Math.max(0.01, sDone)).map((p) => `${view.sx(p.x).toFixed(1)},${view.sy(p.y).toFixed(1)}`);
  const px = view.sx(st.x);
  const py = view.sy(st.y);
  if (sim.t > 0) trail.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  const u = { x: Math.cos(st.h), y: -Math.sin(st.h) };
  const far = Math.hypot(W, H);
  const carLen = Math.max(4.4 * k, narrow ? 22 : 28);
  const carWid = carLen * (1.9 / 4.4);
  const kv = narrow ? 4 : 6;
  const ka = narrow ? 6 : 9;
  const bend = Number.isFinite(st.R) && !sim.rel;
  const cen = bend ? { x: view.sx(st.cx), y: view.sy(st.cy) } : null;
  const toC = cen ? { x: (cen.x - px) / (Math.hypot(cen.x - px, cen.y - py) || 1), y: (cen.y - py) / (Math.hypot(cen.x - px, cen.y - py) || 1) } : null;
  const relP = sim.rel ? { x: view.sx(sim.rel.x), y: view.sy(sim.rel.y) } : null;
  const tanBase = relP ?? { x: px, y: py };
  const vLen = st.speed * kv;

  return (
    <g>
      <Grid view={view} W={W} H={H} minPx={narrow ? 26 : 34} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 56 : 70} xUnit={t.axisX} decimal={dec} />
      <YUnit text={t.axisY} narrow={narrow} x={view.sx(0)} />

      {/* the road */}
      <polyline points={roadPts} fill="none" stroke="#94a3b8" strokeWidth={Math.max(12, ROAD_W * k) + 3} strokeLinejoin="round" strokeLinecap="butt" />
      <polyline points={roadPts} fill="none" stroke={sim.rel ? '#dbeafe' : '#e2e8f0'} strokeWidth={Math.max(12, ROAD_W * k)} strokeLinejoin="round" strokeLinecap="butt" />
      <polyline points={roadPts} fill="none" stroke="#fff" strokeWidth={narrow ? 1.2 : 1.8} strokeDasharray="7 7" />

      {/* trajectory travelled */}
      {sim.t > 0 && trail.length > 1 && <polyline points={trail.join(' ')} fill="none" stroke={C.path} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />}

      {/* tangent through the car (or through the point where it slid off) */}
      <line x1={tanBase.x - u.x * far} y1={tanBase.y - u.y * far} x2={tanBase.x + u.x * far} y2={tanBase.y + u.y * far} stroke={C.vel} strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="6 6" />

      {/* bend: centre, radius, acceleration */}
      {cen && (
        <g>
          <line x1={cen.x} y1={cen.y} x2={px} y2={py} stroke={C.path} strokeOpacity="0.6" strokeWidth="1.4" strokeDasharray="4 4" />
          <circle cx={cen.x} cy={cen.y} r="4" fill="#fff" stroke={C.path} strokeWidth="2" />
          {!narrow && (
            <Pill
              x={(cen.x + px) / 2 - toC.y * 16 * (st.sg || 1)}
              y={(cen.y + py) / 2 + toC.x * 16 * (st.sg || 1)}
              text={tr.rTag(fmt(st.R, 0, dec))}
              bg="#fff"
              color={C.path}
              border="#c4b5fd"
              size={fs - 1}
              box={{ w: W, h: H }}
            />
          )}
        </g>
      )}
      {relP && (
        <g>
          <circle cx={relP.x} cy={relP.y} r="5" fill="#fff" stroke={C.path} strokeWidth="2" />
          <Label x={relP.x} y={relP.y - 12} size={fs - 1} color={C.path}>
            {tr.slidePoint}
          </Label>
        </g>
      )}

      <CarTop x={px} y={py} h={st.h} len={carLen} wid={carWid} />

      {/* arrows */}
      <Arrow x1={px + u.x * carLen * 0.55} y1={py + u.y * carLen * 0.55} x2={px + u.x * (carLen * 0.55 + vLen)} y2={py + u.y * (carLen * 0.55 + vLen)} color={C.vel} width={3.2} head={11} />
      <Label x={px + u.x * (carLen * 0.55 + vLen + 11)} y={py + u.y * (carLen * 0.55 + vLen + 11) + 4} size={fs + 2} color={C.vel} italic>
        v
      </Label>
      {toC && acc > 0 && (
        <>
          <Arrow x1={px} y1={py} x2={px + toC.x * (carWid * 0.6 + acc * ka)} y2={py + toC.y * (carWid * 0.6 + acc * ka)} color={C.acc} width={3} head={10} />
          <Label x={px + toC.x * (carWid * 0.6 + acc * ka + 11)} y={py + toC.y * (carWid * 0.6 + acc * ka + 11) + 4} size={fs + 1} color={C.acc} italic>
            a
          </Label>
        </>
      )}
    </g>
  );
}

/* ================================================================ wheel */

const WHEEL_R = 0.1; // m
const SLOW = 0.01; // time runs 100× slower on screen
const SPARK_RATE = 70; // sparks per screen second
const SPARK_LIFE = 1.7; // screen seconds
const WHEEL0 = { t: 0, ang: 0, running: false, sparks: [], acc: 0, id: 0 };

function WheelMode({ t, c, modeSel }) {
  const dec = c.decimal;
  const tw = t.wheel;
  const [v, setV] = useState(30);
  const [alphaDeg, setAlphaDeg] = useState(300);
  const [dir, setDir] = useState(-1); // -1 clockwise, +1 anticlockwise
  const [hint, setHint] = useState(null);
  const [sim, setSim] = useState(WHEEL0);
  const al = (alphaDeg * Math.PI) / 180;
  const tan = { x: -Math.sin(al) * dir, y: Math.cos(al) * dir }; // world unit vector of the rim velocity at the contact point
  const sparkDeg = headingDeg(Math.atan2(tan.y, tan.x));

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const omega = (v / WHEEL_R) * SLOW; // rad per screen second
      const moved = p.sparks
        .map((s) => ({ ...s, x: s.x + s.vx * dt * SLOW, y: s.y + s.vy * dt * SLOW, age: s.age + dt }))
        .filter((s) => s.age < SPARK_LIFE && Math.abs(s.x) < 0.8 && Math.abs(s.y) < 0.8);
      let acc = p.acc + dt * SPARK_RATE;
      let id = p.id;
      const born = [];
      while (acc >= 1) {
        acc -= 1;
        const j = ((Math.random() - 0.5) * 9 * Math.PI) / 180;
        const sp = v * (0.72 + 0.28 * Math.random());
        const dx = tan.x * Math.cos(j) - tan.y * Math.sin(j);
        const dy = tan.x * Math.sin(j) + tan.y * Math.cos(j);
        const age = Math.random() * dt;
        born.push({ id: (id += 1), x: WHEEL_R * Math.cos(al) + dx * sp * age * SLOW, y: WHEEL_R * Math.sin(al) + dy * sp * age * SLOW, vx: dx * sp, vy: dy * sp, age, hot: Math.random() });
      }
      return { ...p, t: p.t + dt, ang: p.ang + dir * omega * dt, sparks: [...moved, ...born], acc, id };
    });
  });

  const started = sim.t > 0;
  const toggle = () => {
    setHint(null);
    setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => {
    setHint(null);
    setSim(WHEEL0);
  };

  const key = hint ?? (sim.running ? 'run' : started ? 'paused' : 'idle');
  const settled = useSettled(key, 0);
  const text = { idle: tw.explain.idle, run: tw.explain.run, paused: tw.explain.paused, moved: tw.explain.moved, flipped: tw.explain.flipped }[settled];
  const rpm = (v / (2 * Math.PI * WHEEL_R)) * 60;

  const legend = [
    { kind: 'arrow', color: C.vel, label: tw.legend.vel },
    { kind: 'dash', color: C.vel, label: t.legend.tangent },
    { kind: 'dot', color: '#f97316', label: tw.legend.sparks },
    { kind: 'dash', color: '#475569', label: tw.legend.radius },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar modeSel={modeSel} c={c} running={sim.running} done={false} started={started} onToggle={toggle} onReset={reset} />

      <LabScene
        legend={legend}
        chip={<TimeChip text={tw.chip(Math.round(1 / SLOW))} />}
        height={(W, narrow) => (narrow ? Math.round(W * 0.95) : 440)}
        ariaLabel={tw.sceneLabel(fmt(v, 0, dec), fmt(sparkDeg, 0, dec))}
      >
        {(W, H, narrow) => <WheelScene W={W} H={H} narrow={narrow} t={t} c={c} sim={sim} al={al} tan={tan} v={v} dir={dir} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tw.readouts.rim} symbol="v" value={fmt(v, 0, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.kmh(fmt(v * 3.6, 0, dec))} />
        <Readout label={tw.readouts.sparks} symbol="θ" value={fmt(sparkDeg, 0, dec)} unit="°" accent="#f97316" textColor="#fdba74" sub={tw.readouts.sparksSub} />
        <Readout label={tw.readouts.rpm} symbol="n" value={fmt(rpm, 0, dec)} unit={tw.rpmUnit} accent="#94a3b8" sub={tw.readouts.rpmSub(fmt(WHEEL_R * 100, 0, dec))} />
        <Readout label={tw.readouts.slow} value={`×1/${Math.round(1 / SLOW)}`} accent={C.time} textColor="#a5f3fc" sub={tw.readouts.slowSub} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="cm-wheel-a"
            label={tw.contact}
            symbol="α"
            min={0}
            max={355}
            step={5}
            value={alphaDeg}
            onChange={(x) => {
              setAlphaDeg(x);
              setHint('moved');
            }}
            accent="#f97316"
            display={`${fmt(alphaDeg, 0, dec)}°`}
            hint={tw.contactHint}
          />
          <RangeField
            id="cm-wheel-v"
            label={tw.speed}
            symbol="v"
            min={10}
            max={35}
            step={1}
            value={v}
            onChange={setV}
            accent={C.vel}
            display={`${fmt(v, 0, dec)} ${c.ms}`}
            hint={tw.speedHint}
          />
        </div>
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm text-gray-300">{tw.dirLabel}</p>
          <Segmented
            label={tw.dirLabel}
            className="grid-cols-2"
            value={dir}
            onChange={(d) => {
              setDir(d);
              setHint('flipped');
            }}
            accent="#34d399"
            options={[
              { value: -1, label: tw.dirs.cw, icon: RotateCw },
              { value: 1, label: tw.dirs.ccw, icon: RotateCcw },
            ]}
          />
          <p className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">{tw.note}</p>
        </div>
      </div>
    </div>
  );
}

function WheelScene({ W, H, narrow, t, c, sim, al, tan, v, dir }) {
  const tw = t.wheel;
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const box = narrow ? { x0: -0.3, x1: 0.3, y0: -0.3, y1: 0.3 } : { x0: -0.42, x1: 0.42, y0: -0.2, y1: 0.2 };
  const pad = narrow ? { l: 34, r: 12, t: 40, b: 26 } : { l: 44, r: 16, t: 52, b: 30 };
  const view = useMemo(() => makeView(box, W, H, pad), [W, H, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = view.k;
  const ox = view.sx(0);
  const oy = view.sy(0);
  const Rpx = WHEEL_R * k;
  const cp = { x: view.sx(WHEEL_R * Math.cos(al)), y: view.sy(WHEEL_R * Math.sin(al)) };
  const u = { x: tan.x, y: -tan.y }; // screen
  const radial = { x: Math.cos(al), y: -Math.sin(al) };
  const far = Math.hypot(W, H);
  const vLen = (v / 30) * Rpx * 0.85;

  /* the workpiece: a steel bar pressed on the rim along the radius */
  const barIn = WHEEL_R * k;
  const barOut = (WHEEL_R + 0.12) * k;
  const barW = Math.max(10, 0.024 * k);
  const rimArrows = Array.from({ length: 8 }, (_, i) => {
    const a = sim.ang + (i * Math.PI) / 4;
    const p = { x: ox + Math.cos(a) * Rpx, y: oy - Math.sin(a) * Rpx };
    const d = { x: -Math.sin(a) * dir, y: -Math.cos(a) * dir };
    return { p, d, i };
  });
  const arcR = Rpx * 1.22;
  const a0 = (110 * Math.PI) / 180;
  const a1 = (160 * Math.PI) / 180;
  const arcStart = { x: ox + Math.cos(dir > 0 ? a0 : a1) * arcR, y: oy - Math.sin(dir > 0 ? a0 : a1) * arcR };
  const arcEnd = { x: ox + Math.cos(dir > 0 ? a1 : a0) * arcR, y: oy - Math.sin(dir > 0 ? a1 : a0) * arcR };
  const endA = dir > 0 ? a1 : a0;
  const endTan = { x: -Math.sin(endA) * dir, y: -Math.cos(endA) * dir };

  return (
    <g>
      <Grid view={view} W={W} H={H} minPx={narrow ? 28 : 36} />
      <AxisNumbers view={view} W={W} H={H} minPx={narrow ? 56 : 76} xUnit={t.axisX} decimal={dec} digits={2} />
      <YUnit text={t.axisY} narrow={narrow} x={view.sx(0)} />

      {/* tangent at the contact point */}
      <line x1={cp.x - u.x * far} y1={cp.y - u.y * far} x2={cp.x + u.x * far} y2={cp.y + u.y * far} stroke={C.vel} strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="6 6" />

      {/* sparks */}
      {sim.sparks.map((s) => {
        const sx = view.sx(s.x);
        const sy = view.sy(s.y);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        const tail = 6 + (sp / 35) * (narrow ? 10 : 16);
        const f = 1 - s.age / SPARK_LIFE;
        return (
          <g key={s.id} opacity={Math.max(0, f)}>
            <line x1={sx - (s.vx / sp) * tail} y1={sy + (s.vy / sp) * tail} x2={sx} y2={sy} stroke={s.hot > 0.5 ? '#f97316' : '#ea580c'} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx={sx} cy={sy} r="1.8" fill="#facc15" stroke="#ea580c" strokeWidth="0.8" />
          </g>
        );
      })}

      {/* the wheel */}
      <circle cx={ox} cy={oy} r={Rpx} fill="#d6d3d1" stroke="#57534e" strokeWidth="2" />
      <circle cx={ox} cy={oy} r={Rpx * 0.93} fill="none" stroke="#a8a29e" strokeWidth="1" strokeDasharray="2 3" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = sim.ang + (i * Math.PI) / 12;
        const r1 = Rpx * (0.45 + (i % 3) * 0.12);
        return <circle key={i} cx={ox + Math.cos(a) * r1} cy={oy - Math.sin(a) * r1} r={narrow ? 1.4 : 1.8} fill="#78716c" />;
      })}
      <circle cx={ox} cy={oy} r={Rpx * 0.3} fill="#e7e5e4" stroke="#57534e" strokeWidth="1.5" />
      <circle cx={ox} cy={oy} r={Rpx * 0.1} fill="#57534e" />
      <line x1={ox} y1={oy} x2={ox + Math.cos(sim.ang) * Rpx * 0.3} y2={oy - Math.sin(sim.ang) * Rpx * 0.3} stroke="#57534e" strokeWidth="2" />

      {/* spin direction */}
      <path d={`M${arcStart.x},${arcStart.y} A${arcR},${arcR} 0 0 ${dir > 0 ? 0 : 1} ${arcEnd.x},${arcEnd.y}`} fill="none" stroke="#475569" strokeWidth="1.8" />
      <Arrow x1={arcEnd.x - endTan.x * 8} y1={arcEnd.y - endTan.y * 8} x2={arcEnd.x + endTan.x * 2} y2={arcEnd.y + endTan.y * 2} color="#475569" width={1.8} head={9} />

      {/* velocities of points on the rim: all along the tangent */}
      {rimArrows.map((r) => (
        <Arrow key={r.i} x1={r.p.x} y1={r.p.y} x2={r.p.x + r.d.x * Rpx * 0.42} y2={r.p.y + r.d.y * Rpx * 0.42} color={C.vel} width={1.8} head={7} opacity={0.45} />
      ))}

      {/* radius to the contact point and the right angle */}
      <line x1={ox} y1={oy} x2={cp.x} y2={cp.y} stroke="#475569" strokeWidth="1.5" strokeDasharray="4 4" />
      <RightAngle x={cp.x} y={cp.y} u={{ x: -radial.x, y: -radial.y }} w={u} size={narrow ? 8 : 10} color="#334155" />

      {/* the steel bar */}
      <g transform={`translate(${ox} ${oy}) rotate(${(-al * 180) / Math.PI})`}>
        <rect x={barIn} y={-barW / 2} width={barOut - barIn} height={barW} rx={2} fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
        <rect x={barIn + 3} y={-barW / 2 + 2} width={barOut - barIn - 6} height={barW * 0.3} rx={1} fill="#e2e8f0" opacity="0.8" />
      </g>

      {/* velocity at the contact point */}
      <Arrow x1={cp.x} y1={cp.y} x2={cp.x + u.x * vLen} y2={cp.y + u.y * vLen} color={C.vel} width={3.4} head={12} />
      <Label x={cp.x + u.x * (vLen + 12)} y={cp.y + u.y * (vLen + 12) + 4} size={fs + 2} color={C.vel} italic>
        v
      </Label>
      <circle cx={cp.x} cy={cp.y} r="4" fill="#fff" stroke={C.ink} strokeWidth="2" />
      <Label x={ox} y={Math.sin(al) < 0 ? oy - Rpx * 1.33 - 8 : oy + Rpx + (narrow ? 18 : 22)} size={fs - 1} color="#57534e" weight={600}>
        {tw.wheelTag(fmt(WHEEL_R * 100, 0, dec))}
      </Label>
    </g>
  );
}
