import { useMemo, useState } from 'react';
import { Lightbulb, MoveHorizontal, Timer } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, GLASS, GroupLabel, InfoBox, LabScene, PlayControls, Rich, SpeedPicker, WATER, makePipe, pipeOutline, plain, pts } from './Bernoulli.parts';

/**
 * Tab 2 — continuity. A pump pushes a fixed volume flow Q through a pipe
 * with a wide part A (6 cm²), a narrow part B (2 cm²), a medium part C
 * (4 cm²) and a nozzle at the end; the pipe axis is h = 0.5 m above the
 * floor. The liquid is incompressible, so every cross-section passes the
 * same volume per second: Q = S·v = const, i.e. S₁v₁ = S₂v₂. Shaded slices
 * of equal volume (ΔV = 30 cm³) are long where the pipe is narrow and short
 * where it is wide (l = ΔV/S). The jet leaves the nozzle horizontally at
 * v = Q/S_nozzle and lands at L = v·√(2h/g).
 * Preset Q = 0.6 L/s: v_A = 1.0 m/s, v_B = 3.0 m/s, v_C = 1.5 m/s; nozzle
 * 1 cm² → 6.0 m/s, t = √(2·0.5/9.8) = 0.32 s, L = 1.92 m; without the nozzle
 * (4 cm²) 1.5 m/s and only 0.48 m.
 */

const G = 9.8;
const HP = 0.5; // m, pipe axis above the floor
const SA = 6;
const SB = 2;
const SC = 4;
const DV = 30e-6; // m³ per shaded slice
const PRESETS = [
  { id: 'main', q: 0.6, sn: 1 },
  { id: 'open', q: 0.6, sn: 4 },
  { id: 'low', q: 0.3, sn: 1 },
];
const SPEEDS = [1, 0.25, 0.1];
const FR = [0.28, 0.08, 0.22, 0.08, 0.22, 0.12]; // A, cone, B, cone, C, nozzle

function layout(W) {
  const narrow = W < 560;
  const pad = narrow ? { l: 8, r: 8, t: 40, b: 26 } : { l: 18, r: 18, t: 62, b: 30 };
  const yTop = 0.78;
  const yBot = -0.02;
  const pumpW = narrow ? 0.12 : 0.18;
  const LpMin = narrow ? 1.1 : 1.6;
  const jetW = narrow ? 0.95 : 2.1;
  const Hd = narrow ? 300 : clamp(W * 0.36, 330, 420);
  let k = (Hd - pad.t - pad.b) / (yTop - yBot);
  let worldW = (W - pad.l - pad.r) / k;
  if (worldW < pumpW + LpMin + jetW) {
    k = (W - pad.l - pad.r) / (pumpW + LpMin + jetW);
    worldW = pumpW + LpMin + jetW;
  }
  const Lp = Math.min(worldW - pumpW - jetW, 1.6);
  const H = Math.round(pad.t + pad.b + (yTop - yBot) * k);
  const x0 = pad.l + (W - pad.l - pad.r - (pumpW + Lp + jetW) * k) / 2 + pumpW * k; // screen x of the pipe inlet
  return { narrow, W, H, pad, k, pumpW, Lp, jetW, x0, yBot, R: narrow ? 10 : 17 };
}

function buildPipe(Lp, sn) {
  const s = (v) => v * 1e-4;
  const L = FR.map((f) => f * Lp);
  return makePipe(
    [
      { len: L[0], S0: s(SA), S1: s(SA) },
      { len: L[1], S0: s(SA), S1: s(SB) },
      { len: L[2], S0: s(SB), S1: s(SB) },
      { len: L[3], S0: s(SB), S1: s(SC) },
      { len: L[4], S0: s(SC), S1: s(SC) },
      { len: L[5], S0: s(SC), S1: s(sn) },
    ],
    s(SA),
  );
}

const initSim = () => ({ running: true, clock: 0, t: 0, jet: [], acc: 0 });

export default function ContinuitySim({ T }) {
  const t = T.cont;
  const dec = T.decimal;
  const [q, setQ] = useState(0.6); // L/s
  const [sn, setSn] = useState(1); // cm²
  const [speed, setSpeed] = useState(0.25);
  const [sim, setSim] = useState(initSim);
  const [wrapRef, { width }] = useElementSize();
  const lay = useMemo(() => layout(Math.max(width, 280)), [width]);
  const pipe = useMemo(() => buildPipe(lay.Lp, sn), [lay.Lp, sn]);

  const Q = q * 1e-3; // m³/s
  const vA = Q / (SA * 1e-4);
  const vB = Q / (SB * 1e-4);
  const vC = Q / (SC * 1e-4);
  const vN = Q / (sn * 1e-4);
  const tFall = Math.sqrt((2 * HP) / G);
  const L = vN * tFall;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const dts = dt * speed;
      const tt = p.t + dts;
      let acc = p.acc + dts;
      let jet = p.jet.filter((j) => {
        const tau = tt - j.te;
        return HP - (G * tau * tau) / 2 > -0.005;
      });
      const step = 0.004;
      if (acc >= step) {
        const add = [];
        while (acc >= step) {
          acc -= step;
          add.push({ te: tt - acc, ve: vN });
        }
        jet = [...jet, ...add];
      }
      return { ...p, clock: p.clock + Q * dts, t: tt, jet, acc };
    });
  });

  const started = sim.t > 0;
  const toggle = () => setSim((p) => ({ ...p, running: !p.running }));
  const reset = () => {
    setQ(0.6);
    setSn(1);
    setSim(initSim());
  };
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setQ(p.q);
    setSn(p.sn);
  };
  const presetId = PRESETS.find((p) => Math.abs(p.q - q) < 1e-9 && Math.abs(p.sn - sn) < 1e-9)?.id ?? null;

  /* ---- explanation */
  let key;
  if (!sim.running) key = 'paused';
  else if (sn >= SC - 1e-9) key = 'noNozzle';
  else key = 'nozzle';
  const shown = useSettled(key, 350);
  const ex = t.explain;
  const text =
    {
      paused: ex.paused(fmt(DV * 1e6, 0, dec), fmt((DV / (SA * 1e-4)) * 100, 1, dec), fmt((DV / (SB * 1e-4)) * 100, 1, dec)),
      noNozzle: ex.noNozzle(fmt(vC, 2, dec), fmt(L, 2, dec)),
      nozzle: ex.nozzle(fmt(SA / SB, 0, dec), fmt(vB, 2, dec), fmt(DV * 1e6, 0, dec), fmt(vN, 2, dec), fmt(L, 2, dec)),
    }[shown] ?? ex.nozzle(fmt(SA / SB, 0, dec), fmt(vB, 2, dec), fmt(DV * 1e6, 0, dec), fmt(vN, 2, dec), fmt(L, 2, dec));
  const tone = { paused: '#94a3b8', noNozzle: '#a78bfa', nozzle: '#34d399' }[shown] ?? '#22d3ee';

  const rows = [
    { id: 'A', S: SA, v: vA },
    { id: 'B', S: SB, v: vB },
    { id: 'C', S: SC, v: vC },
    { id: 'N', S: sn, v: vN },
  ];

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
        <PlayControls labels={T.common} running={sim.running} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <div ref={wrapRef}>
        <ContinuityScene
          T={T}
          lay={lay}
          pipe={pipe}
          sim={sim}
          q={q}
          sn={sn}
          vN={vN}
          L={L}
          speed={speed}
          ariaLabel={plain(t.scene.aria(fmt(q, 2, dec), fmt(vA, 2, dec), fmt(vB, 2, dec), fmt(vN, 2, dec), fmt(L, 2, dec)))}
        />
      </div>

      <Explain icon={Lightbulb} id={shown} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.q} symbol="Q" value={fmt(q, 2, dec)} unit={T.Ls} accent="#38bdf8" textColor="#7dd3fc" sub={<Rich>{t.sub.q}</Rich>} />
        <Readout
          label={t.readouts.vB}
          symbol={<Rich>v_B</Rich>}
          value={fmt(vB, 2, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={<Rich>{t.sub.vB(fmt(SB, 0, dec), fmt(vA, 2, dec))}</Rich>}
        />
        <Readout
          label={t.readouts.vN}
          symbol="v"
          value={fmt(vN, 2, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          active={key === 'nozzle'}
          sub={<Rich>{t.sub.vN(fmt(sn, 2, dec))}</Rich>}
        />
        <Readout
          label={t.readouts.L}
          symbol="L"
          value={fmt(L, 2, dec)}
          unit={T.m}
          accent={PALETTE.path}
          textColor={PALETTE.pathText}
          active={key === 'nozzle'}
          sub={<Rich>{t.sub.L(fmt(tFall, 2, dec))}</Rich>}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="bn-q"
            label={t.q}
            symbol="Q"
            min={0.1}
            max={0.6}
            step={0.05}
            value={q}
            onChange={setQ}
            accent="#38bdf8"
            display={`${fmt(q, 2, dec)} ${T.Ls}`}
            hint={<Rich>{t.qHint(fmt(q * 60, 0, dec))}</Rich>}
          />
          <RangeField
            id="bn-sn"
            label={t.sn}
            symbol={<Rich>{t.snSym}</Rich>}
            min={1}
            max={4}
            step={0.25}
            value={sn}
            onChange={setSn}
            accent={PALETTE.path}
            display={`${fmt(sn, 2, dec)} ${T.cm2}`}
            hint={<Rich>{sn >= SC - 1e-9 ? t.snHintOff : t.snHint}</Rich>}
          />
          <SpeedPicker label={T.speedLabel} value={speed} onChange={setSpeed} options={SPEEDS.map((v) => ({ value: v, label: T.speedOpt[v] }))} />
          <InfoBox
            title={t.info.title}
            rows={[
              [t.info.h, `${fmt(HP, 1, dec)} ${T.m}`],
              [t.info.dv, `${fmt(DV * 1e6, 0, dec)} ${T.cm3}`],
              [t.info.dt, `${fmt(DV / Q, 3, dec)} ${T.s}`],
            ]}
          />
        </div>
        <div className="lg:col-span-3 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.table.title}</p>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="bg-black/30 text-[11px] uppercase tracking-[0.08em] text-gray-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t.table.sec}</th>
                  <th className="px-3 py-2 font-semibold">
                    S, {T.cm2}
                  </th>
                  <th className="px-3 py-2 font-semibold">v, {T.ms}</th>
                  <th className="px-3 py-2 font-semibold">
                    Q = S·v, {T.Ls}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-semibold text-gray-200">{t.table.names[r.id]}</td>
                    <td className="px-3 py-2 text-gray-300">{fmt(r.S, r.S % 1 ? 2 : 0, dec)}</td>
                    <td className="px-3 py-2" style={{ color: PALETTE.velText }}>
                      {fmt(r.v, 2, dec)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-sky-300">{fmt(r.S * 1e-4 * r.v * 1000, 2, dec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-snug text-gray-500">
            <Rich>{t.table.note}</Rich>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormulaTile
              tag={t.f.cont.tag}
              color="#7dd3fc"
              general={t.f.cont.general}
              filled={t.f.cont.filled(fmt(SA, 0, dec), fmt(vA, 2, dec), fmt(SB, 0, dec), fmt(vB, 2, dec), fmt(q, 2, dec))}
              ok
            />
            <FormulaTile
              tag={t.f.jet.tag}
              color={PALETTE.pathText}
              general={t.f.jet.general}
              filled={t.f.jet.filled(fmt(tFall, 2, dec), fmt(vN, 2, dec), fmt(L, 2, dec))}
              ok={key === 'nozzle'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function ContinuityScene({ T, lay, pipe, sim, q, sn, vN, L, speed, ariaLabel }) {
  const t = T.cont;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.water, color: WATER.edge, kind: 'water' },
    { label: t.legend.band(fmt(DV * 1e6, 0, dec)), color: WATER.band, kind: 'swatch' },
    { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: t.legend.jet, color: PALETTE.path, kind: 'dash' },
  ];
  const chips = (
    <>
      {speed !== 1 && <Chip icon={Timer}>{T.slowChip(speed)}</Chip>}
      <Chip icon={MoveHorizontal} color="#64748b" className="hidden sm:flex">
        {t.scene.thick}
      </Chip>
    </>
  );

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={lay.H}>
      {(W, H) => {
        const { narrow, pad, k, pumpW, Lp, x0, yBot, R } = lay;
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const sx = (xm) => x0 + xm * k;
        const sy = (ym) => H - pad.b - (ym - yBot) * k;
        const ay = sy(HP);
        const floor = sy(0);
        const Q = q * 1e-3;
        const Rp = (xm) => pipe.rRel(xm) * R;
        const ol = pipeOutline(pipe, sx, () => ay, 0, R);
        const water = `${pts(ol.top)} ${pts(ol.bot.slice().reverse())}`;
        const ends = [];
        FR.reduce((a, f) => {
          ends.push(a + f * Lp);
          return a + f * Lp;
        }, 0);
        const secs = [
          { id: 'A', a: 0, b: ends[0], S: SA },
          { id: 'B', a: ends[1], b: ends[2], S: SB },
          { id: 'C', a: ends[3], b: ends[4], S: SC },
        ];
        const xN = sx(Lp);

        /* equal-volume slices */
        const bands = [];
        const phase = sim.clock % (2 * DV);
        for (let Va = phase - 2 * DV; Va < pipe.Vtot; Va += 2 * DV) {
          const a = Math.max(0, Va);
          const b = Math.min(pipe.Vtot, Va + DV);
          if (b <= a) continue;
          const xa = pipe.xOfV(a);
          const xb = pipe.xOfV(b);
          const n = Math.max(2, Math.ceil(((xb - xa) * k) / 6));
          const up = [];
          const dn = [];
          for (let i = 0; i <= n; i += 1) {
            const x = xa + ((xb - xa) * i) / n;
            up.push([sx(x), ay - Rp(x)]);
            dn.push([sx(x), ay + Rp(x)]);
          }
          bands.push(`${pts(up)} ${pts(dn.reverse())}`);
        }

        /* particles */
        const lines = narrow ? [-0.5, 0.5] : [-0.62, 0, 0.62];
        const dVp = SA * 1e-4 * ((narrow ? 22 : 26) / k);
        const nPer = Math.max(4, Math.floor(pipe.Vtot / dVp));
        const step = pipe.Vtot / nPer;
        const parts = [];
        lines.forEach((f, j) => {
          for (let i = 0; i < nPer; i += 1) {
            let V = (sim.clock + (i + ((j * 0.41) % 1)) * step) % pipe.Vtot;
            if (V < 0) V += pipe.Vtot;
            const x = pipe.xOfV(V);
            parts.push({ key: `${j}-${i}`, x: sx(x), y: ay + f * Rp(x) });
          }
        });

        /* jet: parcels in flight, newest at the nozzle */
        const jp = [[xN, ay]];
        for (let i = sim.jet.length - 1; i >= 0; i -= 1) {
          const j = sim.jet[i];
          const tau = sim.t - j.te;
          const yy = Math.max(0, HP - (G * tau * tau) / 2);
          jp.push([sx(Lp + j.ve * tau), sy(yy)]);
        }
        const landed = sim.jet.length > 0 && HP - (G * (sim.t - sim.jet[0].te) ** 2) / 2 < 0.02;
        const landX = landed ? jp[jp.length - 1][0] : null;
        const rN = Rp(Lp);
        const xL = sx(Lp + L);
        const xRight = W - pad.r;

        /* pump impeller angle follows the pumped volume */
        const ang = ((sim.clock * 4e3) % (2 * Math.PI)) * (180 / Math.PI);
        const pumpX = sx(-pumpW);
        const pw = pumpW * k;
        const ph = Math.min(pw * 1.2, (floor - ay) * 1.6 + R);

        const arrowK = (0.85 * ((ends[2] - ends[1]) * k)) / 3;

        return (
          <g>
            <defs>
              <linearGradient id="bc-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={WATER.mid} stopOpacity="0.85" />
                <stop offset="0.5" stopColor={WATER.fill} stopOpacity="0.75" />
                <stop offset="1" stopColor={WATER.mid} stopOpacity="0.9" />
              </linearGradient>
              <pattern id="bc-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* light 10 cm grid */}
            <g aria-hidden="true">
              {Array.from({ length: Math.ceil(W / (k / 10)) + 2 }, (_, i) => {
                const x = sx((Math.floor((-x0 / k) * 10) + i) / 10);
                return x > 0 && x < W ? <line key={`gx${i}`} x1={x} x2={x} y1={0} y2={floor} stroke="#eef2f7" /> : null;
              })}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`gy${i}`} x1={0} x2={W} y1={sy(i * 0.1)} y2={sy(i * 0.1)} stroke="#eef2f7" />
              ))}
            </g>

            {/* floor and the ruler from the nozzle */}
            <rect x={0} y={floor} width={W} height={H - floor} fill="url(#bc-hatch)" />
            <line x1={0} x2={W} y1={floor} y2={floor} stroke="#64748b" strokeWidth={1.6} />
            {Array.from({ length: 12 }, (_, i) => i * 0.25)
              .filter((d) => sx(Lp + d) < xRight - 4)
              .map((d) => (
                <g key={`r${d}`}>
                  <line x1={sx(Lp + d)} x2={sx(Lp + d)} y1={floor} y2={floor + (d % 0.5 === 0 ? 7 : 4)} stroke="#475569" />
                  {d % 0.5 === 0 && (
                    <text x={sx(Lp + d)} y={floor + 18} textAnchor="middle" fontSize={fs - 1} fill="#475569">
                      {fmt(d, d % 1 ? 1 : 0, dec)}
                    </text>
                  )}
                </g>
              ))}
            <text x={xRight} y={floor + 18} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.scene.xAxis}
            </text>

            {/* stands */}
            {[0.12, 0.62].map((f) => (
              <g key={f}>
                <rect x={sx(f * Lp) - 3} y={ay + Rp(f * Lp)} width={6} height={floor - ay - Rp(f * Lp)} fill="#94a3b8" />
                <rect x={sx(f * Lp) - 12} y={floor - 4} width={24} height={4} fill="#64748b" />
              </g>
            ))}

            {/* pump */}
            <g>
              <rect x={pumpX} y={ay - ph / 2} width={pw - 2} height={ph} rx={6} fill="#e2e8f0" stroke="#334155" strokeWidth={2} />
              <circle cx={pumpX + pw / 2 - 1} cy={ay} r={Math.min(pw, ph) * 0.32} fill="#fff" stroke="#334155" strokeWidth={1.6} />
              <g transform={`translate(${pumpX + pw / 2 - 1} ${ay}) rotate(${ang.toFixed(1)})`}>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <line
                    key={a}
                    x1={0}
                    y1={0}
                    x2={Math.cos((a * Math.PI) / 180) * Math.min(pw, ph) * 0.28}
                    y2={Math.sin((a * Math.PI) / 180) * Math.min(pw, ph) * 0.28}
                    stroke={WATER.edge}
                    strokeWidth={2}
                  />
                ))}
              </g>
              <text x={pumpX + pw / 2} y={ay - ph / 2 - 6} textAnchor="middle" fontSize={fs - 1} fontWeight="700" fill="#334155">
                {t.scene.pump}
              </text>
            </g>

            {/* pipe water, slices, particles, walls */}
            <polygon points={water} fill="url(#bc-water)" />
            {bands.map((b, i) => (
              <polygon key={i} points={b} fill={WATER.band} fillOpacity="0.45" />
            ))}
            {parts.map((p) => (
              <circle key={p.key} cx={p.x} cy={p.y} r={narrow ? 1.7 : 2.2} fill="#fff" fillOpacity="0.9" />
            ))}
            <polyline points={pts(ol.top)} fill="none" stroke="#334155" strokeWidth={2.2} />
            <polyline points={pts(ol.bot)} fill="none" stroke="#334155" strokeWidth={2.2} />
            <line x1={sx(0)} x2={sx(0)} y1={ay - R} y2={ay + R} stroke="#334155" strokeWidth={2.2} />

            {/* jet */}
            {jp.length > 1 && (
              <g>
                <polyline points={pts(jp)} fill="none" stroke={WATER.mid} strokeOpacity="0.85" strokeWidth={Math.max(3, 2 * rN)} strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pts(jp)} fill="none" stroke={WATER.edge} strokeWidth={1.2} strokeDasharray="6 5" strokeDashoffset={sim.t * -900} opacity="0.7" />
              </g>
            )}
            {landX !== null && landX < xRight && (
              <g stroke={WATER.edge} strokeWidth={1.6} fill="none" strokeLinecap="round">
                <path d={`M${landX - 12},${floor - 2} Q${landX - 6},${floor - 12} ${landX - 2},${floor - 2}`} />
                <path d={`M${landX + 2},${floor - 2} Q${landX + 7},${floor - 14} ${landX + 13},${floor - 2}`} />
                <ellipse cx={landX} cy={floor - 1} rx={14} ry={2.5} fill={WATER.fill} stroke="none" />
              </g>
            )}

            {/* range L on the floor */}
            <g>
              <line x1={xN} x2={Math.min(xL, xRight - 2)} y1={floor - 14} y2={floor - 14} stroke={PALETTE.path} strokeWidth={1.6} strokeDasharray="5 4" />
              <line x1={xN} x2={xN} y1={floor - 20} y2={floor - 8} stroke={PALETTE.path} strokeWidth={1.6} />
              {xL < xRight && <line x1={xL} x2={xL} y1={floor - 20} y2={floor - 8} stroke={PALETTE.path} strokeWidth={1.6} />}
              <Pill
                x={clamp((xN + Math.min(xL, xRight)) / 2, xN + 40, xRight - 50)}
                y={floor - 28}
                text={xL < xRight ? t.scene.LTag(fmt(L, 2, dec)) : t.scene.LTagFar(fmt(L, 2, dec))}
                bg={PALETTE.path}
                size={fs - 0.5}
                box={box}
              />
            </g>
            {/* height h */}
            <g>
              <line x1={xN + 10} x2={xN + 10} y1={ay} y2={floor} stroke="#475569" strokeWidth={1.2} strokeDasharray="3 3" />
              {!narrow && <Pill x={xN + 46} y={(ay + floor) / 2 + 10} text={t.scene.hTag(fmt(HP, 1, dec))} bg="#475569" size={fs - 1} box={box} />}
            </g>

            {/* sections: letters, S, v arrows and Q */}
            {secs.map((s) => {
              const xm = (s.a + s.b) / 2;
              const xc = sx(xm);
              const v = Q / (s.S * 1e-4);
              const r = Rp(xm);
              const len = clamp(v * arrowK, 0, (s.b - s.a) * k * 0.9);
              return (
                <g key={s.id}>
                  <line x1={sx(s.a) + 2} x2={sx(s.a) + 2} y1={ay - r - 6} y2={ay + r + 6} stroke="#94a3b8" strokeDasharray="2 3" />
                  <line x1={sx(s.b) - 2} x2={sx(s.b) - 2} y1={ay - r - 6} y2={ay + r + 6} stroke="#94a3b8" strokeDasharray="2 3" />
                  {len > 6 && <Arrow x1={xc - len / 2} y1={ay} x2={xc + len / 2} y2={ay} color={PALETTE.vel} width={narrow ? 2.2 : 3} head={narrow ? 8 : 10} />}
                  <circle cx={xc} cy={ay - r - (narrow ? 13 : 16)} r={narrow ? 8 : 10} fill="#0f172a" />
                  <text x={xc} y={ay - r - (narrow ? 9.5 : 12)} textAnchor="middle" fontSize={narrow ? 10 : 12} fontWeight="700" fill="#fff">
                    {s.id}
                  </text>
                  {!narrow && <Pill x={xc} y={ay - r - 42} text={t.scene.STag(fmt(s.S, 0, dec))} bg="#0f172a" size={fs - 1} box={box} />}
                  {!narrow && <Pill x={xc} y={ay + r + 17} text={t.scene.vTag(fmt(v, 2, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />}
                  {!narrow && <Pill x={xc} y={ay + r + 43} text={t.scene.QTag(fmt(q, 2, dec))} bg="#0284c7" size={fs - 1} box={box} />}
                </g>
              );
            })}
            {/* nozzle */}
            {!narrow && <Pill x={xN + 52} y={ay - 46} text={sn >= SC - 1e-9 ? t.scene.noNozzle : t.scene.nozzleTag(fmt(sn, 2, dec))} bg={PALETTE.path} size={fs - 1} box={box} />}
            <Pill
              x={xN + (narrow ? 30 : 44)}
              y={ay - (narrow ? 16 : 18)}
              text={t.scene.vTag(fmt(vN, narrow ? 1 : 2, dec))}
              bg={PALETTE.vel}
              size={fs - 1}
              box={box}
            />
            <circle cx={xN} cy={ay} r={2.5} fill={GLASS.stroke} />
          </g>
        );
      }}
    </LabScene>
  );
}
