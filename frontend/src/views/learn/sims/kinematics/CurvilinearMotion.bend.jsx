import { useMemo, useState } from 'react';
import { Car, CornerUpLeft, Gauge, Lightbulb, Pause, Play, RotateCcw, Spline } from 'lucide-react';
import { Arrow, Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { AxisNumbers, Grid, TimeGraph, makeView } from '../kit/scene';
import { C, CarTop, LabScene, Label, TimeChip, YUnit } from './CurvilinearMotion.parts';

/**
 * Tab 2 - uniform motion round a bend. The speedometer reading does not
 * change, but the direction of the velocity does, so there is an
 * acceleration; it points at the centre of the circle: a = v²/R.
 *
 * The velocity a time Δt earlier (v₁) and now (v₂) are drawn from one point:
 * their difference Δv points at the centre, and Δv/Δt comes out as v²/R.
 * Preset "example" is the lesson's: 10 m/s on a 50 m bend → a = 2 m/s².
 */

const PRESETS = [
  { id: 'example', v: 10, R: 50, icon: Car },
  { id: 'v2', v: 20, R: 50, icon: Gauge },
  { id: 'r2', v: 10, R: 100, icon: Spline },
  { id: 'sharp', v: 10, R: 25, icon: CornerUpLeft },
];
const EX = PRESETS[0];
const DTS = [4, 2, 0.5];
const ROAD_HALF = 4; // m, half the width of the road
const TONES = { idle: '#22d3ee', example: '#34d399', v2: '#fb923c', r2: '#93c5fd', custom: '#fbbf24' };

/** Round axis top whose quarters are round numbers. */
function niceTop(hi) {
  for (const m of [1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100]) if (m * 4 >= hi - 1e-9) return m * 4;
  return Math.ceil(hi / 100) * 100;
}

export default function BendSim({ t, c }) {
  const dec = c.decimal;
  const [rootRef, { width }] = useElementSize();
  const [preset, setPreset] = useState('example');
  const [v, setV] = useState(EX.v);
  const [R, setR] = useState(EX.R);
  const [dtv, setDtv] = useState(2);
  const [touched, setTouched] = useState(false);
  const [sim, setSim] = useState({ t: 0, phi: -Math.PI / 2, running: false });
  const omega = v / R;
  const a = (v * v) / R;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => (p.running ? { ...p, t: p.t + dt, phi: p.phi + omega * dt } : p));
  });

  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setV(p.v);
    setR(p.R);
    setTouched(true);
  };
  const slide = (set) => (x) => {
    set(x);
    setPreset(null);
    setTouched(true);
  };
  const toggle = () => {
    setTouched(true);
    setSim((p) => ({ ...p, running: !p.running }));
  };
  const reset = () => setSim({ t: 0, phi: -Math.PI / 2, running: false });

  /* Δv over Δt */
  const dphi = omega * dtv;
  const dv = 2 * v * Math.sin(dphi / 2);
  const ratio = dv / dtv;

  /* comparison with the lesson's example */
  const kv = v / EX.v;
  const kR = R / EX.R;
  const ka = a / ((EX.v * EX.v) / EX.R);

  const presetHit = PRESETS.find((p) => Math.abs(p.v - v) < 1e-9 && Math.abs(p.R - R) < 1e-9)?.id;
  let key = 'idle';
  if (touched || sim.t > 0) key = presetHit === 'example' || presetHit === 'v2' || presetHit === 'r2' ? presetHit : 'custom';
  const settled = useSettled(key, key === 'custom' ? 250 : 0);
  const ex = t.explain;
  const F1 = (n) => fmt(n, 1, dec);
  const Fv = (n) => fmt(n, Number.isInteger(n) ? 0 : 1, dec);
  const text = {
    idle: ex.idle,
    example: ex.example,
    v2: ex.v2,
    r2: ex.r2,
    custom: ex.custom(Fv(v), fmt(R, 0, dec), F1(a), F1(kv), F1(kR), F1(ka)),
  }[settled];

  const narrowLayout = width > 0 && width < 860;
  const legend = [
    { kind: 'arrow', color: C.vel, label: t.legend.vel },
    { kind: 'arrow', color: C.acc, label: t.legend.acc },
    { kind: 'dash', color: C.acc, label: t.legend.dv },
    { kind: 'line', color: C.path, label: t.legend.path },
  ];
  const yMax = niceTop(Math.max((30 * 30) / R, 4));
  const curve = Array.from({ length: 31 }, (_, i) => ({ x: i, y: (i * i) / R }));

  return (
    <div ref={rootRef} className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{c.common.presets}</p>
          <Segmented
            label={c.common.presets}
            className="grid-cols-2 md:grid-cols-4"
            size="lg"
            value={preset}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={sim.running ? Pause : Play} onClick={toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {sim.running ? c.common.pause : sim.t > 0 ? c.common.resume : c.common.start}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} disabled={sim.t === 0 && !sim.running} className="min-h-[52px] text-[15px]">
            {c.common.reset}
          </Btn>
        </div>
      </div>

      <LabScene
        legend={legend}
        chip={<TimeChip text={t.chip(fmt(sim.t, 1, dec))} />}
        height={(W, narrow) => (narrow ? Math.round(W * 1.0) : 470)}
        ariaLabel={t.sceneLabel(fmt(v, 1, dec), fmt(R, 0, dec), F1(a))}
      >
        {(W, H, narrow) => <BendScene W={W} H={H} narrow={narrow} t={t} c={c} sim={sim} v={v} R={R} dtv={dtv} withDiagram={!narrowLayout && W >= 860} />}
      </LabScene>

      <Explain icon={Lightbulb} id={settled} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.speed} symbol="v" value={fmt(v, 1, dec)} unit={c.ms} accent={C.vel} textColor={C.velText} sub={t.readouts.speedSub(fmt(v * 3.6, 0, dec))} />
        <Readout label={t.readouts.radius} symbol="R" value={fmt(R, 0, dec)} unit={c.m} accent={C.path} textColor={C.pathText} sub={t.readouts.radiusSub} />
        <Readout
          label={t.readouts.acc}
          symbol="a"
          value={F1(a)}
          unit={c.ms2}
          accent={C.acc}
          textColor={C.accText}
          active
          sub={`a = v²/R = ${Fv(v)}² / ${fmt(R, 0, dec)}`}
        />
        <Readout label={t.readouts.compare} value={`×${F1(ka)}`} accent="#e2e8f0" sub={t.readouts.compareSub(F1(kv), F1(kR))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="cm-bend-v"
            label={t.sliders.v}
            symbol="v"
            min={2}
            max={30}
            step={0.5}
            value={v}
            onChange={slide(setV)}
            accent={C.vel}
            display={`${fmt(v, 1, dec)} ${c.ms}`}
            hint={t.sliders.vHint}
          />
          <RangeField
            id="cm-bend-r"
            label={t.sliders.R}
            symbol="R"
            min={10}
            max={150}
            step={5}
            value={R}
            onChange={slide(setR)}
            accent={C.path}
            display={`${fmt(R, 0, dec)} ${c.m}`}
            hint={t.sliders.RHint}
          />
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{t.sliders.dt}</p>
            <Segmented
              label={t.sliders.dt}
              className="grid-cols-3"
              value={dtv}
              onChange={setDtv}
              accent="#fb923c"
              options={DTS.map((d) => ({ value: d, label: `Δt = ${fmt(d, d < 1 ? 1 : 0, dec)} ${c.s}` }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.dvPanel.title(fmt(dtv, dtv < 1 ? 1 : 0, dec))}</p>
          {narrowLayout && (
            <div className="mt-2 overflow-hidden rounded-xl bg-white">
              <DiagramSvg t={t} sim={sim} v={v} R={R} dtv={dtv} dec={dec} />
            </div>
          )}
          <dl className="mt-2 space-y-1.5">
            {[
              [t.dvPanel.speeds, `${fmt(v, 1, dec)} ${c.ms}`, C.velText],
              [t.dvPanel.turn, `${fmt((dphi * 180) / Math.PI, 1, dec)}°`, '#e2e8f0'],
              [t.dvPanel.dv, `${fmt(dv, 2, dec)} ${c.ms}`, C.accText],
              [t.dvPanel.ratio, `${fmt(ratio, 2, dec)} ${c.ms2}`, C.accText],
              [t.dvPanel.formula, `${fmt(a, 2, dec)} ${c.ms2}`, C.accText],
            ].map(([k, val, col]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 rounded-lg bg-black/25 px-3 py-1.5 text-sm">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-mono font-semibold tabular-nums" style={{ color: col }}>
                  {val}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-snug text-gray-500">{t.dvPanel.note}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <TimeGraph
            title={t.graph.title}
            series={[
              { id: 'curve', label: t.graph.curve(fmt(R, 0, dec)), color: '#fb923c', points: curve, dot: false },
              { id: 'now', label: t.graph.now, color: '#fdba74', points: [{ x: v, y: a }] },
              ...(2 * v <= 30 ? [{ id: 'dbl', label: t.graph.dbl, color: '#f472b6', points: [{ x: 2 * v, y: 4 * a }] }] : []),
            ]}
            xMax={30}
            yMax={yMax}
            xLabel={t.graph.axisV}
            yLabel={t.graph.axisA}
            marker={v}
            decimal={dec}
            yDigits={Number.isInteger(yMax / 4) ? 0 : 1}
            xDigits={1}
            note={t.graph.note}
            height={200}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

function BendScene({ W, H, narrow, t, c, sim, v, R, dtv, withDiagram }) {
  const dec = c.decimal;
  const fs = narrow ? 11 : 12;
  const circleW = withDiagram ? Math.round(W * 0.56) : W;
  const half = R + ROAD_HALF + 8;
  const pad = narrow ? { l: 30, r: 12, t: 40, b: 26 } : { l: 44, r: 16, t: 52, b: 30 };
  const view = useMemo(() => makeView({ x0: -half, x1: half, y0: -half, y1: half }, circleW, H, pad), [circleW, H, half, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const k = view.k;
  const ox = view.sx(0);
  const oy = view.sy(0);
  const Rp = R * k;
  const omega = v / R;
  const a = (v * v) / R;
  const phi = sim.phi;
  const phi1 = phi - omega * dtv;
  const pos = (p) => ({ x: ox + Math.cos(p) * Rp, y: oy - Math.sin(p) * Rp });
  const vdir = (p) => ({ x: -Math.sin(p), y: -Math.cos(p) }); // screen direction of the velocity at angle p (anticlockwise motion)
  const P = pos(phi);
  const P1 = pos(phi1);
  const u = vdir(phi);
  const u1 = vdir(phi1);
  const toC = { x: -Math.cos(phi), y: Math.sin(phi) };
  const kv = narrow ? 3 : 4.2;
  const ka = narrow ? 9 : 13;
  const vLen = v * kv;
  const aLen = Math.min(a * ka, Rp * 0.8, narrow ? 120 : 170);
  const carLen = Math.max(4.4 * k, narrow ? 22 : 28);
  const carWid = carLen * (1.9 / 4.4);
  const roadW = Math.max(10, ROAD_HALF * 2 * k);

  /* trail: the last third of a turn */
  const back = Math.min(omega * sim.t, Math.PI * 0.66);
  const trail = [];
  for (let i = 0; i <= 40; i += 1) {
    const p = phi - back + (back * i) / 40;
    const q = pos(p);
    trail.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
  }

  /* Δv drawn at the middle of the arc between the two moments, to scale with v */
  const phiM = phi - (omega * dtv) / 2;
  const PM = pos(phiM);
  const toCM = { x: -Math.cos(phiM), y: Math.sin(phiM) };
  const dvMag = 2 * v * Math.sin((omega * dtv) / 2);
  const dvLen = dvMag * kv;

  return (
    <g>
      <Grid view={view} W={circleW} H={H} minPx={narrow ? 28 : 36} />
      <AxisNumbers view={view} W={circleW} H={H} minPx={narrow ? 56 : 72} xUnit={t.axisX} decimal={dec} />
      <YUnit text={t.axisY} narrow={narrow} x={view.sx(0)} />

      {/* grass, road, centre line */}
      <circle cx={ox} cy={oy} r={Math.max(4, (R - ROAD_HALF) * k)} fill="#dcfce7" opacity="0.8" />
      <circle cx={ox} cy={oy} r={Rp} fill="none" stroke="#94a3b8" strokeWidth={roadW + 3} />
      <circle cx={ox} cy={oy} r={Rp} fill="none" stroke="#e2e8f0" strokeWidth={roadW} />
      <circle cx={ox} cy={oy} r={Rp} fill="none" stroke="#fff" strokeWidth={narrow ? 1.2 : 1.8} strokeDasharray="7 7" />

      {sim.t > 0 && <polyline points={trail.join(' ')} fill="none" stroke={C.path} strokeWidth="3.5" strokeLinecap="round" />}

      {/* centre */}
      <circle cx={ox} cy={oy} r={narrow ? 4 : 5} fill={C.ink} />
      <Label x={ox} y={oy + (narrow ? 18 : 22)} size={fs - 1} color={C.ink}>
        {t.centre}
      </Label>

      {/* radius */}
      <line x1={ox} y1={oy} x2={P.x} y2={P.y} stroke={C.path} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="5 5" />
      <Pill x={ox + (P.x - ox) * 0.32 + toC.y * 16} y={oy + (P.y - oy) * 0.32 - toC.x * 16} text={t.rTag(fmt(R, 0, dec))} bg="#fff" color={C.path} border="#c4b5fd" size={fs - 1} box={{ w: circleW, h: H }} />

      {/* the car a time Δt earlier, with its velocity v₁ */}
      <CarTop x={P1.x} y={P1.y} h={phi1 + Math.PI / 2} len={carLen} wid={carWid} ghost />
      <Arrow x1={P1.x} y1={P1.y} x2={P1.x + u1.x * vLen} y2={P1.y + u1.y * vLen} color={C.vel} width={2.4} head={9} opacity={0.45} />
      <Label x={P1.x + u1.x * (vLen + 12)} y={P1.y + u1.y * (vLen + 12) + 4} size={fs} color="#6ee7b7" italic>
        v₁
      </Label>

      {/* Δv at the middle of the arc, pointing at the centre */}
      {dvLen > 4 && (
        <>
          <Arrow x1={PM.x} y1={PM.y} x2={PM.x + toCM.x * dvLen} y2={PM.y + toCM.y * dvLen} color={C.acc} width={2.4} head={9} dash="5 4" />
          <Label x={PM.x + toCM.x * (dvLen + 14)} y={PM.y + toCM.y * (dvLen + 14) + 4} size={fs} color={C.acc} italic>
            Δv
          </Label>
        </>
      )}

      <CarTop x={P.x} y={P.y} h={phi + Math.PI / 2} len={carLen} wid={carWid} />

      {/* velocity now and the centripetal acceleration */}
      <Arrow x1={P.x + u.x * carLen * 0.5} y1={P.y + u.y * carLen * 0.5} x2={P.x + u.x * (carLen * 0.5 + vLen)} y2={P.y + u.y * (carLen * 0.5 + vLen)} color={C.vel} width={3.4} head={12} />
      <Label x={P.x + u.x * (carLen * 0.5 + vLen + 13)} y={P.y + u.y * (carLen * 0.5 + vLen + 13) + 4} size={fs + 1} color={C.vel} italic>
        v₂
      </Label>
      <Arrow x1={P.x + toC.x * carWid * 0.5} y1={P.y + toC.y * carWid * 0.5} x2={P.x + toC.x * (carWid * 0.5 + aLen)} y2={P.y + toC.y * (carWid * 0.5 + aLen)} color={C.acc} width={3.4} head={12} />
      {narrow ? (
        <Label x={P.x + toC.x * (carWid * 0.5 + aLen * 0.55) - toC.y * 12} y={P.y + toC.y * (carWid * 0.5 + aLen * 0.55) + toC.x * 12 + 4} size={fs + 1} color={C.acc} italic>
          a
        </Label>
      ) : (
        <Pill
          x={P.x + toC.x * (carWid * 0.5 + aLen * 0.55) - toC.y * 26}
          y={P.y + toC.y * (carWid * 0.5 + aLen * 0.55) + toC.x * 26}
          text={t.aTag(fmt(a, 1, dec))}
          bg={C.acc}
          size={fs}
          box={{ w: circleW, h: H }}
        />
      )}

      {withDiagram && <Diagram t={t} x={circleW} y={44} w={W - circleW - 16} h={H - 60} phi={phi} phi1={phi1} v={v} dvMag={dvMag} dec={dec} fs={fs} />}
    </g>
  );
}

/** The velocity vectors v₁ and v₂ drawn from one point, and their difference Δv. */
function Diagram({ t, x, y, w, h, phi, phi1, v, dvMag, dec, fs, compact }) {
  const L = Math.min(w, h) * (compact ? 0.28 : 0.36);
  const O = { x: x + w / 2, y: y + h * (compact ? 0.6 : 0.56) };
  const d2 = { x: -Math.sin(phi), y: -Math.cos(phi) };
  const d1 = { x: -Math.sin(phi1), y: -Math.cos(phi1) };
  const T1 = { x: O.x + d1.x * L, y: O.y + d1.y * L };
  const T2 = { x: O.x + d2.x * L, y: O.y + d2.y * L };
  const phiM = (phi + phi1) / 2;
  const toCM = { x: -Math.cos(phiM), y: Math.sin(phiM) };
  const dM = { x: -Math.sin(phiM), y: -Math.cos(phiM) };
  const big = Math.hypot(T2.x - T1.x, T2.y - T1.y) > 12;
  return (
    <g>
      <rect x={x + 8} y={y} width={w} height={h} rx={14} fill="#fff" stroke="#e2e8f0" />
      <text x={x + 24} y={y + 24} fontSize={fs + 1} fontWeight="700" fill="#334155">
        {t.diagram.title}
      </text>
      <text x={x + 24} y={y + 42} fontSize={fs - 1} fill={C.muted}>
        {t.diagram.sub}
      </text>
      {/* the direction to the centre at the middle moment, for comparison */}
      <line x1={O.x} y1={O.y} x2={O.x + toCM.x * L * 0.9} y2={O.y + toCM.y * L * 0.9} stroke={C.acc} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4" />
      <Label x={O.x + toCM.x * (L * 0.9 + 14)} y={O.y + toCM.y * (L * 0.9 + 14) + 4} size={fs - 2} color="#c2410c" weight={600}>
        {t.diagram.toCentre}
      </Label>
      <Arrow x1={O.x} y1={O.y} x2={T1.x} y2={T1.y} color={C.vel} width={3} head={12} opacity={0.5} />
      <Arrow x1={O.x} y1={O.y} x2={T2.x} y2={T2.y} color={C.vel} width={3.2} head={12} />
      {big && <Arrow x1={T1.x} y1={T1.y} x2={T2.x} y2={T2.y} color={C.acc} width={3} head={11} />}
      <circle cx={O.x} cy={O.y} r="4" fill={C.ink} />
      <Label x={T1.x + d1.x * 16} y={T1.y + d1.y * 16 + 4} size={fs + 1} color="#059669" italic>
        v₁
      </Label>
      <Label x={T2.x + d2.x * 16} y={T2.y + d2.y * 16 + 4} size={fs + 1} color="#059669" italic>
        v₂
      </Label>
      {big && (
        <Label x={(T1.x + T2.x) / 2 + dM.x * 16} y={(T1.y + T2.y) / 2 + dM.y * 16 + 4} size={fs + 1} color={C.acc} italic>
          Δv
        </Label>
      )}
      <text x={x + 24} y={y + h - 16} fontSize={fs - 1} fill="#475569">
        {t.diagram.foot(fmt(v, 1, dec), fmt(dvMag, 2, dec))}
      </text>
    </g>
  );
}

/** The same diagram in a panel of its own (phones and narrow screens). */
function DiagramSvg({ t, sim, v, R, dtv, dec }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 270;
  const omega = v / R;
  const dvMag = 2 * v * Math.sin((omega * dtv) / 2);
  return (
    <div ref={ref} className="cl-scene w-full">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.diagram.title} className="block">
        {width > 0 && <Diagram t={t} x={-8} y={0} w={W} h={H} phi={sim.phi} phi1={sim.phi - omega * dtv} v={v} dvMag={dvMag} dec={dec} fs={11} compact />}
      </svg>
    </div>
  );
}
