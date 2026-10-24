import { useMemo, useState } from 'react';
import { Droplets, Lightbulb, RotateCcw, Timer } from 'lucide-react';

import { Arrow, Btn, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GLASS, GroupLabel, InfoBox, LabScene, LineGraph, PR, Rich, SpeedPicker, WATER, fmtP, makePipe, pipeOutline, plain, pts } from './Bernoulli.parts';

/**
 * Tab 1 — the Venturi tube. A tank whose level is kept at H = 50 cm above
 * the axis feeds a horizontal glass pipe with a narrowing; a tap at the far
 * end sets the speed v₁ in the wide part. Open manometer tubes stand on the
 * pipe. For an ideal liquid Bernoulli's law along the pipe reads
 *   p + ρv²/2 = ρgH = const  (gauge pressures),
 * so a tube's column h = p/(ρg) = H − v²/(2g) is the tank level minus the
 * "dynamic" part v²/(2g) (drawn orange above each column).
 * Continuity gives v₂ = v₁·S₁/S₂. Preset S₁ = 10 cm², S₂ = 5 cm², v₁ = 1 m/s:
 * v₂ = 2 m/s, Δp = 1000·(4 − 1)/2 = 1500 Pa, Δh = 1500/(1000·9.8) = 15.3 cm
 * (h₁ = 44.9 cm, h₂ = 29.6 cm). When v₂²/(2g) > H the throat is below
 * atmospheric pressure and the open tube sucks air in (the atomizer idea).
 */

const RHO = 1000;
const G = 9.8;
const H_TANK = 0.5; // m
const S1 = 10; // cm²
const PRESETS = [
  { id: 'main', v1: 1, s2: 5 },
  { id: 'equal', v1: 1, s2: 10 },
  { id: 'suck', v1: 1.5, s2: 4 },
];
const TUBES = [
  { id: '1', f: 0.15, label: '1', main: true },
  { id: 'a', f: 0.35 },
  { id: '2', f: 0.5, label: '2', main: true },
  { id: 'b', f: 0.65 },
  { id: '3', f: 0.85, label: '3', main: true },
];
const SPEEDS = [1, 0.25, 0.1];
const Y_MIN = -18; // cm
const Y_MAX = 66;
const TUBE_TOP = 63;

function layout(W) {
  const narrow = W < 560;
  const H = Math.round(narrow ? clamp(W * 1.02, 340, 430) : clamp(W * 0.44, 430, 520));
  const pad = narrow ? { l: 30, r: 8, t: 46, b: 8 } : { l: 46, r: 14, t: 74, b: 12 };
  const k = (H - pad.t - pad.b) / (Y_MAX - Y_MIN);
  const worldW = (W - pad.l - pad.r) / k;
  const tankW = narrow ? 14 : clamp(worldW * 0.1, 18, 26);
  const outW = narrow ? 12 : 18;
  const Lp = (worldW - tankW - outW) / 100;
  return { narrow, W, H, pad, k, tankW, outW, Lp, R1: narrow ? 12 : 21 };
}

function buildPipe(Lp, s2) {
  const a = S1 * 1e-4;
  const b = s2 * 1e-4;
  return makePipe(
    [
      { len: 0.3 * Lp, S0: a, S1: a },
      { len: 0.1 * Lp, S0: a, S1: b },
      { len: 0.2 * Lp, S0: b, S1: b },
      { len: 0.1 * Lp, S0: b, S1: a },
      { len: 0.3 * Lp, S0: a, S1: a },
    ],
    a,
  );
}

const initSim = () => ({ v: 0, clock: 0, t: 0, cols: TUBES.map(() => ({ h: H_TANK * 100, u: 0 })) });

export default function VenturiSim({ T }) {
  const t = T.ven;
  const dec = T.decimal;
  const [v1, setV1] = useState(1);
  const [s2, setS2] = useState(5);
  const [open, setOpen] = useState(true);
  const [speed, setSpeed] = useState(0.25);
  const [sim, setSim] = useState(initSim);
  const [wrapRef, { width }] = useElementSize();
  const lay = useMemo(() => layout(Math.max(width, 280)), [width]);
  const pipe = useMemo(() => buildPipe(lay.Lp, s2), [lay.Lp, s2]);

  const target = open ? v1 : 0;
  const goals = TUBES.map((tb) => {
    const vi = (target * S1 * 1e-4) / pipe.S(tb.f * lay.Lp);
    return Math.max(0, (H_TANK - (vi * vi) / (2 * G)) * 100);
  });
  const settled = Math.abs(sim.v - target) < 1e-3 && sim.cols.every((c, i) => Math.abs(c.u) < 0.05 && Math.abs(c.h - goals[i]) < 0.05);

  useRafLoop(open || !settled, (dt) => {
    setSim((p) => {
      const dts = dt * speed;
      const tg = open ? v1 : 0;
      let v = tg + (p.v - tg) * Math.exp(-dts / 0.3);
      if (Math.abs(v - tg) < 0.004) v = tg;
      const Q = v * S1 * 1e-4;
      const cols = p.cols.map((c, i) => {
        const vi = Q / pipe.S(TUBES[i].f * lay.Lp);
        const goal = Math.max(0, (H_TANK - (vi * vi) / (2 * G)) * 100);
        const w = 11;
        const z = 0.72;
        let { h, u } = c;
        const n = Math.max(1, Math.ceil(dts / 0.008));
        const hh = dts / n;
        for (let j = 0; j < n; j += 1) {
          u += (w * w * (goal - h) - 2 * z * w * u) * hh;
          h += u * hh;
        }
        if (h < 0) {
          h = 0;
          u = 0;
        }
        return { h, u };
      });
      return { v, clock: p.clock + Q * dts, t: p.t + dts, cols };
    });
  });

  /* ---- physics now (instantaneous inlet speed) */
  const va = sim.v;
  const vb = (va * S1) / s2;
  const dp = (RHO * (vb * vb - va * va)) / 2;
  const dh = dp / (RHO * G);
  const h1 = H_TANK - (va * va) / (2 * G);
  const h2 = H_TANK - (vb * vb) / (2 * G);
  const Q = va * S1 * 1e-4;
  const suck = h2 < 0;
  const ratio = S1 / s2;

  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setV1(p.v1);
    setS2(p.s2);
    setOpen(true);
  };
  const presetId = PRESETS.find((p) => Math.abs(p.v1 - v1) < 1e-9 && Math.abs(p.s2 - s2) < 1e-9)?.id ?? null;
  const reset = () => {
    setV1(1);
    setS2(5);
    setOpen(true);
    setSim(initSim());
  };

  /* ---- explanation */
  let key;
  if (!open) key = sim.v < 0.02 ? 'closed' : 'closing';
  else if (sim.v < v1 * 0.9) key = 'opening';
  else if ((((v1 * S1) / s2) ** 2) / (2 * G) > H_TANK) key = 'suck';
  else if (s2 >= S1 - 1e-9) key = 'equal';
  else key = 'flow';
  const shown = useSettled(key, 350);
  const ex = t.explain;
  const tv1 = v1;
  const tv2 = (v1 * S1) / s2;
  const tdp = (RHO * (tv2 * tv2 - tv1 * tv1)) / 2;
  const text =
    {
      closed: ex.closed(fmt(H_TANK * 100, 0, dec)),
      closing: ex.closing,
      opening: ex.opening,
      equal: ex.equal(fmt(tv1, 1, dec), fmt((H_TANK - (tv1 * tv1) / (2 * G)) * 100, 1, dec), fmt(((tv1 * tv1) / (2 * G)) * 100, 1, dec)),
      flow: ex.flow(fmt(ratio, ratio % 1 ? 1 : 0, dec), fmt(tv2, 2, dec), fmtP(tdp), fmt((tdp / (RHO * G)) * 100, 1, dec)),
      suck: ex.suck(fmt(tv2, 2, dec), fmtP(RHO * G * H_TANK - (RHO * tv2 * tv2) / 2)),
    }[shown] ?? ex.opening;
  const tone = { closed: '#94a3b8', closing: '#94a3b8', opening: '#22d3ee', equal: '#a78bfa', flow: '#34d399', suck: '#fb923c' }[shown] ?? '#22d3ee';

  /* ---- graph along the pipe */
  const graph = useMemo(() => {
    const st = [];
    const dy = [];
    const tot = [];
    const n = 120;
    for (let i = 0; i <= n; i += 1) {
      const x = (lay.Lp * i) / n;
      const vi = Q / pipe.S(x);
      const pd = (RHO * vi * vi) / 2;
      st.push({ x, y: RHO * G * H_TANK - pd });
      dy.push({ x, y: pd });
      tot.push({ x, y: RHO * G * H_TANK });
    }
    return { st, dy, tot };
  }, [Q, pipe, lay.Lp]);
  const yMinG = Math.min(0, ...graph.st.map((p) => p.y)) - (suck ? 400 : 0);

  const tubes = lay.narrow ? TUBES.filter((x) => x.main) : TUBES;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{t.presetsLabel}</GroupLabel>
          <Segmented
            label={t.presetsLabel}
            className="grid-cols-1 sm:grid-cols-3"
            size="lg"
            value={presetId}
            onChange={pickPreset}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn
            variant="primary"
            icon={Droplets}
            onClick={() => setOpen((o) => !o)}
            aria-pressed={open}
            className="xl:min-w-[172px] min-h-[52px] gap-1.5 px-3 text-[13px] sm:gap-2 sm:px-4 sm:text-[15px] whitespace-nowrap [&_svg]:shrink-0"
          >
            {open ? t.tapClose : t.tapOpen}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <div ref={wrapRef}>
        <VenturiScene
          T={T}
          lay={lay}
          pipe={pipe}
          sim={sim}
          s2={s2}
          open={open}
          speed={speed}
          tubes={tubes}
          suck={suck}
          onTap={() => setOpen((o) => !o)}
          ariaLabel={plain(t.scene.aria(fmt(va, 2, dec), fmt(vb, 2, dec), fmt(h1 * 100, 1, dec), fmt(Math.max(h2, 0) * 100, 1, dec)))}
        />
      </div>

      <Explain icon={Lightbulb} id={shown} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.v1}
          symbol={<Rich>v₁</Rich>}
          value={fmt(va, 2, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={<Rich>{t.sub.v1(fmt(S1, 0, dec), fmt(Q * 1000, 2, dec))}</Rich>}
        />
        <Readout
          label={t.readouts.v2}
          symbol={<Rich>v₂</Rich>}
          value={fmt(vb, 2, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          active={key === 'flow' || key === 'suck'}
          sub={<Rich>{t.sub.v2(fmt(s2, 1, dec), fmt(ratio, ratio % 1 ? 2 : 0, dec))}</Rich>}
        />
        <Readout
          label={t.readouts.dp}
          symbol={<Rich>p₁ − p₂</Rich>}
          value={fmtP(dp)}
          unit={T.Pa}
          accent={PR.dyn}
          textColor={PR.dynText}
          sub={<Rich>{t.sub.dp}</Rich>}
        />
        <Readout
          label={t.readouts.dh}
          symbol="Δh"
          value={fmt(dh * 100, 1, dec)}
          unit={T.cm}
          accent={PR.stat}
          textColor={PR.statText}
          sub={<Rich>{suck ? t.sub.dhSuck(fmt(h1 * 100, 1, dec)) : t.sub.dh(fmt(h1 * 100, 1, dec), fmt(h2 * 100, 1, dec))}</Rich>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="bn-v1"
            label={t.v1}
            symbol={<Rich>v₁</Rich>}
            min={0.1}
            max={1.5}
            step={0.1}
            value={v1}
            onChange={(v) => {
              setV1(v);
              setOpen(true);
            }}
            accent={PALETTE.vel}
            display={`${fmt(v1, 1, dec)} ${T.ms}`}
            hint={<Rich>{t.v1Hint(fmt(v1 * S1 * 0.1, 2, dec))}</Rich>}
          />
          <RangeField
            id="bn-s2"
            label={t.s2}
            symbol={<Rich>S₂</Rich>}
            min={3}
            max={10}
            step={0.5}
            value={s2}
            onChange={setS2}
            accent="#38bdf8"
            display={`${fmt(s2, 1, dec)} ${T.cm2}`}
            hint={<Rich>{t.s2Hint(fmt(2 * Math.sqrt(s2 / Math.PI), 2, dec), fmt(2 * Math.sqrt(S1 / Math.PI), 2, dec))}</Rich>}
          />
          <SpeedPicker label={T.speedLabel} value={speed} onChange={setSpeed} options={SPEEDS.map((v) => ({ value: v, label: T.speedOpt[v] }))} />
          <InfoBox
            title={t.info.title}
            rows={[
              [t.info.tank, `${fmt(H_TANK * 100, 0, dec)} ${T.cm}`, '#e5e7eb'],
              [t.info.total, `${fmtP(RHO * G * H_TANK)} ${T.Pa}`, '#f8fafc'],
              [t.info.p1, `${fmtP(RHO * G * h1)} ${T.Pa}`, PR.statText],
              [t.info.p2, `${fmtP(RHO * G * h2)} ${T.Pa}`, suck ? '#fb923c' : PR.statText],
            ]}
          />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            title={t.graph.title}
            legend={[
              { label: t.graph.stat, color: PR.statBar },
              { label: t.graph.dyn, color: PR.dynBar },
              { label: t.graph.total, color: '#f8fafc', dash: true },
            ]}
            series={[
              { id: 'tot', color: '#f8fafc', points: graph.tot, dash: '6 4', width: 2 },
              { id: 'dyn', color: PR.dynBar, points: graph.dy },
              { id: 'st', color: PR.statBar, points: graph.st },
            ]}
            fills={[{ id: 'f', upper: graph.tot, lower: graph.st, color: PR.dynBar, opacity: 0.16 }]}
            markers={TUBES.filter((x) => x.main).map((x) => ({ x: x.f * lay.Lp, label: x.label }))}
            dots={[
              { id: 'd1', x: 0.15 * lay.Lp, y: RHO * G * h1, color: PR.statBar },
              { id: 'd2', x: 0.5 * lay.Lp, y: RHO * G * h2, color: PR.statBar },
            ]}
            xMax={lay.Lp}
            yMin={yMinG}
            yMax={5600}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={230}
            decimal={dec}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <FormulaTile
              tag={t.f.cont.tag}
              color={PALETTE.velText}
              general={t.f.cont.general}
              filled={t.f.cont.filled(fmt(va, 2, dec), fmt(S1, 0, dec), fmt(s2, 1, dec), fmt(vb, 2, dec))}
              ok={key === 'flow' || key === 'suck' || key === 'equal'}
            />
            <FormulaTile
              tag={t.f.bern.tag}
              color={PR.dynText}
              general={t.f.bern.general}
              filled={t.f.bern.filled(fmt(vb, 2, dec), fmt(va, 2, dec), fmtP(dp))}
              ok={key === 'flow' || key === 'suck'}
            />
            <FormulaTile
              tag={t.f.dh.tag}
              color={PR.statText}
              general={t.f.dh.general}
              filled={t.f.dh.filled(fmtP(dp), fmt(dh, 3, dec), fmt(dh * 100, 1, dec))}
              ok={key === 'flow'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function VenturiScene({ T, lay, pipe, sim, s2, open, speed, tubes, suck, onTap, ariaLabel }) {
  const t = T.ven;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.water, color: WATER.edge, kind: 'water' },
    { label: t.legend.stat, color: PR.stat, kind: 'line' },
    { label: t.legend.dyn, color: PR.dyn, kind: 'swatch' },
    { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: t.legend.total, color: PR.totalInk, kind: 'dash' },
  ];
  const chips = speed !== 1 ? <Chip icon={Timer}>{T.slowChip(speed)}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={lay.H}>
      {(W, H) => {
        const { narrow, pad, k, tankW, Lp, R1 } = lay;
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const sx = (xcm) => pad.l + xcm * k;
        const sy = (ycm) => H - pad.b - (ycm - Y_MIN) * k;
        const view = { k, sx, sy, wx: (p) => (p - pad.l) / k, wy: (p) => Y_MIN + (H - pad.b - p) / k };
        const px = (xm) => sx(tankW + xm * 100);
        const ay = sy(0);
        const Rp = (xm) => pipe.rRel(xm) * R1;
        const Q = sim.v * S1 * 1e-4;
        const flowing = sim.v > 0.01;
        const Hc = H_TANK * 100;

        /* pipe outline */
        const ol = pipeOutline(pipe, px, () => ay, 0, R1);
        const top = ol.top.map(([x, y]) => [x, y]);
        const bot = ol.bot;
        // outlet piece: straight on to the valve and an elbow down
        const xEnd = px(Lp);
        const xValve = xEnd + (narrow ? 14 : 22);
        const xElbow = xValve + (narrow ? 16 : 26);
        const yOut = sy(-12);
        const water = `${pts(top)} ${pts(bot.slice().reverse())}`;

        /* particles */
        const lines = narrow ? [-0.6, 0, 0.6] : [-0.72, -0.36, 0, 0.36, 0.72];
        const spacingPx = narrow ? 26 : 30;
        const nPer = Math.max(6, Math.round((Lp * 100 * k) / spacingPx));
        const dV = pipe.Vtot / nPer;
        const parts = [];
        lines.forEach((f, j) => {
          for (let i = 0; i < nPer; i += 1) {
            let V = (sim.clock + (i + ((j * 0.37) % 1)) * dV) % pipe.Vtot;
            if (V < 0) V += pipe.Vtot;
            const x = pipe.xOfV(V);
            const vl = Q / pipe.S(x);
            parts.push({ key: `${j}-${i}`, x: px(x), y: ay + f * Rp(x), l: clamp(vl * (narrow ? 6 : 8), 0, 26) });
          }
        });

        /* suction bubbles (throat → outlet) */
        const bubbles = [];
        if (suck && flowing) {
          const xT = 0.5 * Lp;
          const V0 = pipe.V(xT);
          const span = pipe.Vtot - V0;
          for (let i = 0; i < 9; i += 1) {
            const V = V0 + ((sim.clock * 1.0 + (i * span) / 9) % span);
            const x = pipe.xOfV(V);
            bubbles.push({ key: `b${i}`, x: px(x), y: ay - Rp(x) * (0.55 + 0.25 * Math.sin(i * 2.1)), r: 2 + (i % 3) });
          }
        }

        /* valve and outlet stream */
        const vJet = Math.sqrt(2 * G * H_TANK);
        const jetRel = flowing ? Math.sqrt(clamp((sim.v * 1) / vJet, 0, 1)) : 0;
        const ripple = flowing ? 1.2 : 0;
        const surfY = sy(Hc);
        const tankL = sx(0);
        const tankR = sx(tankW);
        const tankBot = sy(-15);
        const tankTop = sy(58);
        const wave = [];
        for (let i = 0; i <= 24; i += 1) {
          const x = tankL + ((tankR - tankL) * i) / 24;
          wave.push([x, surfY + ripple * Math.sin(i * 0.9 - sim.t * 9)]);
        }

        /* Δh dimension between tube 1 and tube 2 */
        const c1 = sim.cols[0];
        const c2 = sim.cols[2];
        const x1 = px(TUBES[0].f * Lp);
        const x2 = px(TUBES[2].f * Lp);
        const tw = narrow ? 7 : 9;
        const showDh = !suck && c1.h - c2.h > 1.5;

        return (
          <g>
            <defs>
              <linearGradient id="bn-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={WATER.mid} stopOpacity="0.85" />
                <stop offset="0.5" stopColor={WATER.fill} stopOpacity="0.75" />
                <stop offset="1" stopColor={WATER.mid} stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="bn-tank" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={WATER.fill} stopOpacity="0.8" />
                <stop offset="1" stopColor={WATER.mid} stopOpacity="0.9" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Grid view={view} W={W} H={H} minPx={narrow ? 22 : 24} />

            {/* ruler: column heights from the pipe axis */}
            <g aria-hidden="true">
              <rect x={0} y={0} width={pad.l - 6} height={H} fill="#fbfcfe" opacity="0.92" />
              {[0, 10, 20, 30, 40, 50, 60].map((v) => (
                <g key={v}>
                  <line x1={pad.l - 10} x2={pad.l - 4} y1={sy(v)} y2={sy(v)} stroke="#94a3b8" />
                  <text x={pad.l - 13} y={sy(v) + 4} textAnchor="end" fontSize={fs - 1} fill={v === 0 ? '#0f172a' : PALETTE.muted} fontWeight={v === 0 ? 700 : 400}>
                    {v}
                  </text>
                </g>
              ))}
              <text x={4} y={sy(TUBE_TOP + 1.5)} fontSize={fs - 1} fontWeight="700" fill="#475569">
                {t.scene.hAxis}
              </text>
            </g>

            {/* constant total-pressure line from the tank surface */}
            <line x1={tankR} x2={W - 6} y1={surfY} y2={surfY} stroke={PR.totalInk} strokeWidth={1.4} strokeDasharray="7 5" opacity="0.8" />

            {/* tank */}
            <rect x={tankL} y={tankTop} width={tankR - tankL} height={tankBot - tankTop} fill={GLASS.fill} />
            <polygon points={`${pts(wave)} ${tankR},${tankBot} ${tankL},${tankBot}`} fill="url(#bn-tank)" />
            <polyline points={pts(wave)} fill="none" stroke={WATER.ink} strokeWidth={1.4} />
            <path d={`M${tankL},${tankTop} L${tankL},${tankBot} L${tankR},${tankBot} L${tankR},${ay + R1}`} fill="none" stroke={GLASS.stroke} strokeWidth={2.4} />
            <line x1={tankR} x2={tankR} y1={ay - R1} y2={tankTop} stroke={GLASS.stroke} strokeWidth={2.4} />
            {/* inflow tap that keeps the level */}
            <path d={`M${tankL - 2},${sy(61)} L${tankL + (tankR - tankL) * 0.38},${sy(61)} L${tankL + (tankR - tankL) * 0.38},${sy(58.5)}`} fill="none" stroke="#475569" strokeWidth={narrow ? 4 : 5} strokeLinejoin="round" />
            {flowing && (
              <line
                x1={tankL + (tankR - tankL) * 0.38}
                x2={tankL + (tankR - tankL) * 0.38}
                y1={sy(58.4)}
                y2={surfY}
                stroke={WATER.deep}
                strokeWidth={narrow ? 2.5 : 3.2}
                strokeDasharray="5 4"
                strokeDashoffset={-sim.t * 220}
              />
            )}
            {!narrow && <Pill x={(tankL + tankR) / 2} y={sy(54)} text={t.scene.tank} bg={WATER.ink} size={fs - 1} box={box} />}
            <Pill x={(tankL + tankR) / 2 + (narrow ? 2 : 0)} y={(surfY + ay) / 2} text={t.scene.hTank(fmt(Hc, 0, dec))} bg={PR.totalInk} size={fs - 1} box={box} />

            {/* pipe water and walls */}
            <polygon points={water} fill="url(#bn-water)" />
            <rect x={xEnd} y={ay - R1} width={xElbow - xEnd} height={2 * R1} fill="url(#bn-water)" />
            <rect x={xElbow - R1} y={ay} width={2 * R1} height={yOut - ay} fill={WATER.mid} fillOpacity="0.8" />

            {/* particles */}
            {flowing && (
              <g>
                {parts.map((p) => (
                  <g key={p.key}>
                    {p.l > 3 && <line x1={p.x - p.l} x2={p.x} y1={p.y} y2={p.y} stroke="#fff" strokeOpacity="0.7" strokeWidth={1.6} strokeLinecap="round" />}
                    <circle cx={p.x} cy={p.y} r={narrow ? 1.9 : 2.4} fill="#fff" stroke={WATER.edge} strokeWidth={0.6} />
                  </g>
                ))}
                {bubbles.map((b) => (
                  <circle key={b.key} cx={b.x} cy={b.y} r={b.r} fill="#fff" fillOpacity="0.85" stroke="#64748b" strokeWidth={0.8} />
                ))}
              </g>
            )}

            <polyline points={pts(top)} fill="none" stroke="#334155" strokeWidth={2.2} />
            <polyline points={pts(bot)} fill="none" stroke="#334155" strokeWidth={2.2} />
            <polyline points={pts(top.map(([x, y]) => [x, y + 3]))} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth={1.2} />
            <path
              d={`M${xEnd},${ay - R1} L${xElbow + R1},${ay - R1} L${xElbow + R1},${yOut} M${xEnd},${ay + R1} L${xElbow - R1},${ay + R1} L${xElbow - R1},${yOut}`}
              fill="none"
              stroke="#334155"
              strokeWidth={2.2}
            />
            {/* outlet stream into the drain */}
            {flowing && (
              <line
                x1={xElbow}
                x2={xElbow}
                y1={yOut}
                y2={sy(-17)}
                stroke={WATER.deep}
                strokeWidth={Math.max(2, 2 * R1 * 0.8 * jetRel)}
                strokeDasharray="7 3"
                strokeDashoffset={-sim.t * 300}
                opacity="0.85"
              />
            )}
            <path d={`M${xElbow - R1 * 2},${sy(-15)} L${xElbow - R1 * 1.6},${H - 2} L${xElbow + R1 * 1.6},${H - 2} L${xElbow + R1 * 2},${sy(-15)}`} fill={WATER.fill} fillOpacity="0.6" stroke={GLASS.stroke} strokeWidth={1.6} />

            {/* tap (valve) — click to open or close */}
            <g style={{ cursor: 'pointer' }} onClick={onTap} aria-hidden="true">
              <rect x={xValve - R1 * 0.7} y={ay - R1 * 1.25} width={R1 * 1.4} height={R1 * 2.5} rx={4} fill="#e2e8f0" stroke="#334155" strokeWidth={2} />
              <line x1={xValve} y1={ay - R1 * 1.25} x2={xValve} y2={ay - R1 * 1.9} stroke="#334155" strokeWidth={3} />
              {open ? (
                <line x1={xValve - R1 * 1.2} y1={ay - R1 * 1.95} x2={xValve + R1 * 1.2} y2={ay - R1 * 1.95} stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
              ) : (
                <line x1={xValve} y1={ay - R1 * 1.95} x2={xValve} y2={ay - R1 * 3.1} stroke="#dc2626" strokeWidth={4} strokeLinecap="round" />
              )}
              <circle cx={xValve} cy={ay - R1 * 1.95} r={3.5} fill="#334155" />
            </g>
            {!narrow && <Pill x={xValve} y={ay + R1 + 16} text={open ? t.scene.tapOpen : t.scene.tapClosed} bg={open ? '#059669' : '#64748b'} size={fs - 1} box={box} />}

            {/* manometer tubes */}
            {tubes.map((tb) => {
              const i = TUBES.indexOf(tb);
              const xm = tb.f * Lp;
              const xc = px(xm);
              const base = ay - Rp(xm);
              const topY = sy(TUBE_TOP);
              const h = sim.cols[i].h;
              const hy = Math.min(base, sy(h));
              const dynTop = surfY;
              const showDyn = Hc - h > 0.4;
              const empty = h <= 0.05 && suck && tb.id === '2';
              return (
                <g key={tb.id}>
                  <rect x={xc - tw / 2} y={topY} width={tw} height={base - topY} fill={GLASS.fill} />
                  {showDyn && (
                    <rect x={xc - tw / 2} y={dynTop} width={tw} height={Math.max(0, hy - dynTop)} fill={PR.dynBar} fillOpacity="0.32" />
                  )}
                  {!empty && <rect x={xc - tw / 2} y={hy} width={tw} height={base - hy + 1} fill={WATER.mid} />}
                  {!empty && (
                    <path d={`M${xc - tw / 2},${hy - 1.5} Q${xc},${hy + 2.5} ${xc + tw / 2},${hy - 1.5}`} fill="none" stroke={WATER.ink} strokeWidth={1.4} />
                  )}
                  {showDyn && <line x1={xc + tw / 2 + 3} x2={xc + tw / 2 + 3} y1={dynTop} y2={hy} stroke={PR.dyn} strokeWidth={2} />}
                  <line x1={xc - tw / 2} x2={xc - tw / 2} y1={topY} y2={base} stroke={GLASS.stroke} strokeWidth={1.6} />
                  <line x1={xc + tw / 2} x2={xc + tw / 2} y1={topY} y2={base} stroke={GLASS.stroke} strokeWidth={1.6} />
                  {empty &&
                    [0, 1, 2, 3].map((j) => {
                      const L = base - topY;
                      const yb = topY + ((sim.t * 260 + (j * L) / 4) % L);
                      return <circle key={j} cx={xc} cy={yb} r={tw * 0.28} fill="#fff" stroke="#64748b" strokeWidth={0.8} />;
                    })}
                  {tb.label && (
                    <g>
                      <circle cx={xc} cy={topY - 11} r={9} fill="#0f172a" />
                      <text x={xc} y={topY - 7} textAnchor="middle" fontSize={11} fontWeight="700" fill="#fff">
                        {tb.label}
                      </text>
                    </g>
                  )}
                  {showDyn && tb.main && tb.id !== '3' && hy - dynTop > 30 && !narrow && (
                    <Pill x={xc - tw / 2 - 28} y={dynTop - 12} text={t.scene.dynTag} bg={PR.dyn} size={fs - 1.5} box={box} />
                  )}
                </g>
              );
            })}

            {/* h labels */}
            {!narrow && (
              <>
                <Pill x={x1 - 44} y={sy(sim.cols[0].h)} text={t.scene.hTag('₁', fmt(sim.cols[0].h, 1, dec))} bg={PR.stat} size={fs - 1} box={box} />
                {!suck && <Pill x={x2 - 44} y={sy(sim.cols[2].h)} text={t.scene.hTag('₂', fmt(sim.cols[2].h, 1, dec))} bg={PR.stat} size={fs - 1} box={box} />}
              </>
            )}

            {/* Δh */}
            {showDh && (
              <g>
                <line x1={x1 + tw / 2 + 2} x2={x2 + tw / 2 + 14} y1={sy(c1.h)} y2={sy(c1.h)} stroke={PR.stat} strokeWidth={1.2} strokeDasharray="4 3" />
                <line x1={x2 + tw / 2 + 12} x2={x2 + tw / 2 + 12} y1={sy(c1.h)} y2={sy(c2.h)} stroke={PR.stat} strokeWidth={1.8} />
                <line x1={x2 + tw / 2 + 7} x2={x2 + tw / 2 + 17} y1={sy(c1.h)} y2={sy(c1.h)} stroke={PR.stat} strokeWidth={1.8} />
                <line x1={x2 + tw / 2 + 7} x2={x2 + tw / 2 + 17} y1={sy(c2.h)} y2={sy(c2.h)} stroke={PR.stat} strokeWidth={1.8} />
                <Pill
                  x={x2 + tw / 2 + (narrow ? 40 : 54)}
                  y={(sy(c1.h) + sy(c2.h)) / 2}
                  text={t.scene.dhTag(fmt(c1.h - c2.h, 1, dec))}
                  bg={PR.stat}
                  size={fs - 0.5}
                  box={box}
                />
              </g>
            )}
            {suck && flowing && (
              <Pill x={x2 + (narrow ? 0 : 60)} y={sy(18)} text={t.scene.suckTag} bg="#ea580c" size={fs - 0.5} box={box} />
            )}

            {/* velocity arrows */}
            {flowing &&
              [
                { xm: TUBES[0].f * Lp, v: sim.v, sub: '₁' },
                { xm: 0.5 * Lp, v: (sim.v * S1) / s2, sub: '₂' },
              ].map((a) => {
                const len = clamp(a.v * (narrow ? 16 : 26), 0, (narrow ? 0.16 : 0.18) * Lp * 100 * k);
                const xc = px(a.xm);
                return (
                  <g key={a.sub}>
                    <Arrow x1={xc - len / 2} y1={ay} x2={xc + len / 2} y2={ay} color={PALETTE.vel} width={narrow ? 2.6 : 3.2} head={narrow ? 9 : 11} />
                    <Pill
                      x={xc + (narrow ? (a.sub === '₁' ? -12 : 14) : 0)}
                      y={ay + Rp(a.xm) + (narrow ? 12 : 15)}
                      text={t.scene.vTag(a.sub, fmt(a.v, narrow ? 1 : 2, dec))}
                      bg={PALETTE.vel}
                      size={fs - 1}
                      box={box}
                    />
                  </g>
                );
              })}

            {/* the pipe is drawn thicker than the height scale */}
            <text x={tankR + 10} y={H - 7} fontSize={fs - 1.5} fontStyle="italic" fill={PALETTE.muted}>
              {t.scene.thick}
            </text>

            {/* constant line label */}
            <Pill x={W - (narrow ? 70 : 96)} y={surfY - 12} text={t.scene.constTag} bg={PR.totalInk} size={fs - 1} box={box} />
            {!narrow && (
              <Pill x={px(0.5 * Lp)} y={ay + Rp(0.5 * Lp) + 40} text={t.scene.sTag(fmt(S1, 0, dec), fmt(s2, 1, dec))} bg="#0f172a" size={fs - 1} box={box} />
            )}
          </g>
        );
      }}
    </LabScene>
  );
}
