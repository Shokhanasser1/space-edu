import { useMemo, useState } from 'react';
import { Eraser, Layers, Lightbulb, Send } from 'lucide-react';
import { Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useRafLoop, useSettled } from '../kit/ui';
import { Ball, C, DEG, DarkGraph, Field, G, LabScene, Launcher, TimeChip, fieldView, fitHeight, flight, niceTop, parabolaPts, posAt } from './AngledThrow.parts';

/**
 * Tab 2 - the angle explorer. The same v₀, several angles; every trajectory
 * stays on the paper. 45° flies farthest (sin2α = 1, L = v₀²/g), and the
 * complementary angles α and 90° − α land at the same point, the higher one
 * later. A graph of L(α) (and H(α)) sits under the scene.
 *
 * With v₀ = 20 m/s: 15°/75° → 20.4 m, 30°/60° → 35.3 m, 45° → 40.8 m.
 */

const ANGLES = [15, 30, 45, 60, 75];
const MAX_SHOTS = 8;
const PAIR = { 15: ['#0891b2', '#67e8f9'], 30: ['#db2777', '#f9a8d4'], 45: ['#7c3aed', '#c4b5fd'] };
const OTHER = [
  ['#d97706', '#fcd34d'],
  ['#0f766e', '#5eead4'],
  ['#4f46e5', '#a5b4fc'],
  ['#be123c', '#fda4af'],
  ['#4d7c0f', '#bef264'],
];
/** Paper colour and dark-panel colour of a shot; complementary angles share a colour. */
function shotColor(a) {
  const m = Math.min(a, 90 - a);
  return PAIR[m] ?? OTHER[m % OTHER.length];
}
const shotDash = (a) => (a > 45 ? '9 6' : undefined);
const PAD_N = { l: 34, r: 12, t: 44, b: 34 };
const PAD_W = { l: 46, r: 24, t: 66, b: 38 };
const TONES = { idle: '#22d3ee', flying: '#a78bfa', all: '#34d399', max: '#c4b5fd', pair: '#f9a8d4', single: '#93c5fd' };

export default function AnglesSim({ t, c }) {
  const dec = c.decimal;
  const [v0, setV0] = useState(20);
  const [sel, setSel] = useState(45);
  const [shots, setShots] = useState([]);
  const [last, setLast] = useState(null);
  const [batch, setBatch] = useState(false);

  const flights = useMemo(() => shots.map((s) => flight(v0, s.a)), [shots, v0]);
  const flying = shots.some((s, i) => s.t < flights[i].T);

  useRafLoop(flying, (dt) => {
    setShots((ss) => ss.map((s) => ({ ...s, t: Math.min(s.t + dt, flight(v0, s.a).T) })));
  });

  const fire = (a) => {
    setShots((ss) => [...ss.filter((s) => s.a !== a), { id: `${a}-${Date.now()}`, a, t: 0 }].slice(-MAX_SHOTS));
    setLast(a);
    setBatch(false);
  };
  const fireAll = () => {
    setShots(ANGLES.map((a) => ({ id: `${a}-${Date.now()}`, a, t: 0 })));
    setLast(null);
    setBatch(true);
  };
  const clear = () => {
    setShots([]);
    setLast(null);
    setBatch(false);
  };
  const changeV0 = (x) => {
    setV0(x);
    // the kept throws are redrawn, already landed, for the new speed
    setShots((ss) => ss.map((s) => ({ ...s, t: 1e9 })));
  };

  const F1 = (n) => fmt(n, 1, dec);
  const F2 = (n) => fmt(n, 2, dec);
  const fs = flight(v0, sel);
  const fc = flight(v0, 90 - sel);
  const Lmax = (v0 * v0) / G;
  const landedAt = (a) => {
    const i = shots.findIndex((s) => s.a === a);
    return i >= 0 && shots[i].t >= flights[i].T - 1e-9;
  };

  /* ---- explanation */
  let key = 'idle';
  if (shots.length) {
    if (flying) key = 'flying';
    else if (batch && ANGLES.every(landedAt)) key = 'all';
    else if (last === 45 && landedAt(45)) key = 'max';
    else if (last !== null && landedAt(last) && last !== 45 && landedAt(90 - last)) key = 'pair';
    else if (last !== null && landedAt(last)) key = 'single';
    else key = 'all';
  }
  const settled = useSettled(key, key === 'flying' ? 0 : 200);
  const ex = t.explain;
  let text = ex.idle(fmt(v0, 0, dec));
  if (settled === 'flying') {
    const fl = shots.filter((s, i) => s.t < flights[i].T);
    text = fl.length > 1 ? ex.race(F2(flight(v0, Math.min(...fl.map((s) => s.a))).T), F2(flight(v0, Math.max(...fl.map((s) => s.a))).T)) : ex.one(fl[0]?.a ?? sel);
  } else if (settled === 'all') text = ex.all(F1(Lmax), F1(flight(v0, 15).L), F1(flight(v0, 30).L));
  else if (settled === 'max') text = ex.max(F1(Lmax), fmt(v0, 0, dec));
  else if (settled === 'pair' && last !== null) {
    const lo = Math.min(last, 90 - last);
    const hi = 90 - lo;
    const fl = flight(v0, lo);
    const fh = flight(v0, hi);
    text = ex.pair(lo, hi, F1(fl.L), 2 * lo, 180 - 2 * lo, F1(fl.H), F1(fh.H), F2(fl.T), F2(fh.T));
  } else if (settled === 'single' && last !== null) {
    const f1 = flight(v0, last);
    text = ex.single(last, F1(f1.L), F1(f1.H), F2(f1.T), 90 - last);
  }

  const tNow = shots.reduce((m, s, i) => Math.max(m, Math.min(s.t, flights[i].T)), 0);
  const legend = [
    { kind: 'line', color: C.ink, label: t.legend.low },
    { kind: 'dash', color: C.ink, label: t.legend.high },
    { kind: 'dash', color: C.preview, label: t.legend.preview },
    { kind: 'dot', color: C.disp, label: t.legend.landing },
  ];

  const sorted = shots.map((s, i) => ({ ...s, f: flights[i] })).sort((a, b) => a.a - b.a);
  // one scale for every throw at this v₀: the 45° range across, the highest throw shown up
  const xMax = (1.08 * v0 * v0) / G;
  const yMax = 1.1 * Math.max(flight(v0, 75).H, fs.H, ...flights.map((f) => f.H));
  const yTop = niceTop(Lmax);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.anglesLabel}</p>
          <Segmented
            label={t.anglesLabel}
            className="grid-cols-5"
            size="lg"
            value={sel}
            onChange={setSel}
            accent="#a78bfa"
            options={ANGLES.map((a) => ({ value: a, label: `${a}°`, sub: t.chipSub(F1(flight(v0, a).L)) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Send} onClick={() => fire(sel)} className="col-span-2 xl:min-w-[136px] min-h-[52px] text-[15px]">
            {t.fire(sel)}
          </Btn>
          <Btn icon={Layers} onClick={fireAll} className="min-h-[52px] text-[15px]">
            {t.fireAll}
          </Btn>
          <Btn icon={Eraser} onClick={clear} disabled={!shots.length} className="min-h-[52px] text-[15px]">
            {t.clear}
          </Btn>
        </div>
      </div>

      <LabScene
        legend={legend}
        chip={<TimeChip text={c.common.realTime(F2(tNow))} />}
        height={(W, narrow) => (narrow ? fitHeight(W, xMax, yMax, PAD_N, 240, W * 1.1) : fitHeight(W, xMax, yMax, PAD_W, 360, 520))}
        ariaLabel={t.sceneLabel(fmt(v0, 0, dec), sorted.map((s) => `${s.a}° — ${F1(s.f.L)}`).join(', ') || '—')}
      >
        {(W, H, narrow) => <AnglesScene W={W} H={H} narrow={narrow} t={t} c={c} v0={v0} sel={sel} shots={sorted} xMax={xMax} yMax={yMax} />}
      </LabScene>

      <Explain icon={Lightbulb} id={`${settled}-${last}-${v0}`} tone={TONES[settled]}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.L(sel)}
          symbol="L"
          value={F1(fs.L)}
          unit={c.m}
          accent={C.disp}
          textColor={C.dispText}
          active={sel === 45}
          sub={`${fmt(v0, 0, dec)}² · sin ${2 * sel}° / ${fmt(G, 1, dec)}`}
        />
        <Readout label={t.readouts.H(sel)} symbol="H" value={F1(fs.H)} unit={c.m} accent={C.path} textColor={C.pathText} sub={t.readouts.Hsub(90 - sel, F1(fc.H))} />
        <Readout label={t.readouts.T(sel)} symbol="T" value={F2(fs.T)} unit={c.s} accent={C.time} textColor="#a5f3fc" sub={t.readouts.Tsub(90 - sel, F2(fc.T))} />
        <Readout label={t.readouts.pair} symbol="90° − α" value={`${90 - sel}°`} accent={shotColor(sel)[0]} textColor={shotColor(sel)[1]} sub={t.readouts.pairSub(F1(fc.L))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="at-angles-v0"
            label={c.common.v0}
            symbol="v₀"
            min={10}
            max={30}
            step={1}
            value={v0}
            onChange={changeV0}
            accent={C.vel}
            display={`${fmt(v0, 0, dec)} ${c.ms}`}
            hint={t.v0Hint(F1(Lmax))}
          />
          <RangeField
            id="at-angles-alpha"
            label={c.common.alpha}
            symbol="α"
            min={5}
            max={85}
            step={1}
            value={sel}
            onChange={setSel}
            accent="#a78bfa"
            display={`${sel}°`}
            hint={t.alphaHint}
          />
          <div className="rounded-xl bg-black/25 px-3 py-2.5">
            <p className="font-mono text-[13px] text-gray-200">L = v₀² · sin2α / g</p>
            <p className="mt-1 text-xs leading-snug text-gray-400">{t.whyPair}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <p className="text-sm font-semibold text-gray-200">{t.table.title}</p>
          {sorted.length === 0 ? (
            <p className="mt-3 text-sm leading-snug text-gray-500">{t.table.empty}</p>
          ) : (
            <table className="mt-2 w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 pr-2 font-medium">α</th>
                  <th className="py-1 pr-2 text-right font-medium">T, {c.s}</th>
                  <th className="py-1 pr-2 text-right font-medium">H, {c.m}</th>
                  <th className="py-1 text-right font-medium">L, {c.m}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const [col, light] = shotColor(s.a);
                  const best = Math.abs(s.f.L - Lmax) < 1e-6;
                  const air = s.t < s.f.T;
                  return (
                    <tr key={s.id} className={`border-t border-white/5 ${best ? 'bg-violet-400/10' : ''}`}>
                      <td className="py-1.5 pr-2">
                        <span className="flex items-center gap-2">
                          <svg width="18" height="8" aria-hidden="true">
                            <line x1="1" y1="4" x2="17" y2="4" stroke={col} strokeWidth="3" strokeDasharray={s.a > 45 ? '5 3' : undefined} />
                          </svg>
                          <span className="font-semibold" style={{ color: light }}>
                            {s.a}°
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right text-gray-300">{F2(s.f.T)}</td>
                      <td className="py-1.5 pr-2 text-right text-gray-300">{F1(s.f.H)}</td>
                      <td className="py-1.5 text-right font-semibold text-white">{air ? <span className="text-gray-500">{t.table.flying}</span> : F1(s.f.L)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs leading-snug text-gray-500">{t.table.note}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <DarkGraph
            title={t.graph.title}
            legend={[
              { color: C.dispText, label: t.graph.L },
              { color: C.pathText, label: t.graph.H, dash: true },
            ]}
            xMax={90}
            xTicks={[0, 15, 30, 45, 60, 75, 90]}
            yMax={yTop}
            xLabel={t.graph.axisA}
            yLabel={t.graph.axisY}
            dec={dec}
            yDigits={Number.isInteger(yTop / 4) ? 0 : 1}
            ariaLabel={t.graph.aria(F1(Lmax))}
            onScrub={(x) => setSel(Math.min(85, Math.max(5, Math.round(x))))}
            note={t.graph.note}
            height={220}
          >
            {(gx, gy) => {
              const Lp = [];
              const Hp = [];
              for (let a = 0; a <= 90; a += 1.5) {
                const f = flight(v0, a);
                Lp.push(`${gx(a).toFixed(1)},${gy(f.L).toFixed(1)}`);
                Hp.push(`${gx(a).toFixed(1)},${gy(f.H).toFixed(1)}`);
              }
              const pairs = sorted.filter((s) => s.a < 45 && sorted.some((o) => o.a === 90 - s.a));
              return (
                <>
                  <polyline points={Hp.join(' ')} fill="none" stroke={C.pathText} strokeWidth="2" strokeDasharray="5 4" opacity="0.8" />
                  <polyline points={Lp.join(' ')} fill="none" stroke={C.dispText} strokeWidth="2.5" strokeLinejoin="round" />
                  <line x1={gx(45)} x2={gx(45)} y1={gy(Lmax)} y2={gy(0)} stroke="rgba(196,181,253,0.35)" strokeDasharray="2 4" />
                  <text x={gx(45)} y={gy(Lmax) - 6} textAnchor="middle" fontSize="11" fill="#c4b5fd">
                    {t.graph.max}
                  </text>
                  {pairs.map((s) => (
                    <line key={`p${s.a}`} x1={gx(s.a)} x2={gx(90 - s.a)} y1={gy(s.f.L)} y2={gy(s.f.L)} stroke={shotColor(s.a)[1]} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
                  ))}
                  <line x1={gx(sel)} x2={gx(sel)} y1={gy(yTop)} y2={gy(0)} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />
                  {sorted.map((s) => (
                    <circle key={s.id} cx={gx(s.a)} cy={gy(s.f.L)} r="5" fill={shotColor(s.a)[1]} stroke="#0b0b16" strokeWidth="1.5" />
                  ))}
                  <circle cx={gx(sel)} cy={gy(fs.L)} r="3.5" fill="#fff" stroke="#22d3ee" strokeWidth="2" />
                </>
              );
            }}
          </DarkGraph>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scene */

function AnglesScene({ W, H, narrow, t, c, v0, sel, shots, xMax, yMax }) {
  const dec = c.decimal;
  const pad = narrow ? PAD_N : PAD_W;
  const view = useMemo(() => fieldView(W, H, xMax, yMax, pad), [W, H, xMax, yMax, narrow]); // eslint-disable-line react-hooks/exhaustive-deps
  const fs = narrow ? 10.5 : 12;
  const gy = view.sy(0);
  const box = { w: W, h: H };
  const fsel = flight(v0, sel);
  const hasSel = shots.some((s) => s.a === sel);

  /* landing labels: angles that land at the same point share one label, stacked when they crowd */
  const groups = [];
  for (const s of shots) {
    if (s.t < s.f.T - 1e-9) continue;
    const g = groups.find((x) => Math.abs(x.L - s.f.L) < 0.05);
    if (g) g.angles.push(s.a);
    else groups.push({ L: s.f.L, angles: [s.a] });
  }
  groups.sort((a, b) => a.L - b.L);
  // the "α = …" label by the launcher counts as taken, so landing labels stack above it
  const la = (sel / 2) * DEG;
  const lr = narrow ? 48 : 64;
  const aw = textWidth(`α = ${sel}°`, fs, 700);
  const placed = [{ x: view.sx(0) + lr * Math.cos(la) + 6 + aw / 2, w: aw + 6, row: 0 }];
  for (const g of groups) {
    const text = t.landTag(g.angles.map((a) => `${a}°`).join(' · '), fmt(g.L, 1, dec));
    const w = textWidth(text, fs, 600) + 16;
    const x = view.sx(g.L);
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(p.x - x) < (p.w + w) / 2 + 4)) row += 1;
    placed.push({ ...g, text, w, x, row, color: g.angles.length > 1 ? shotColor(g.angles[0])[0] : shotColor(g.angles[0])[0] });
  }

  return (
    <g>
      <Field view={view} W={W} H={H} narrow={narrow} xUnit={c.common.axisX} yUnit={c.common.axisY} dec={dec} yUnitAt={narrow ? 26 : 62} />

      {/* where the selected angle would go */}
      {!hasSel && <polyline points={parabolaPts(view, fsel, 0, fsel.T, 80)} fill="none" stroke={C.preview} strokeWidth="1.5" strokeDasharray="5 6" />}

      {/* the maximum range */}
      <line x1={view.sx((v0 * v0) / G)} x2={view.sx((v0 * v0) / G)} y1={gy - 4} y2={gy + 6} stroke={C.path} strokeWidth="2" />

      {shots.map((s) => {
        const [col] = shotColor(s.a);
        const tt = Math.min(s.t, s.f.T);
        const landed = tt >= s.f.T - 1e-9;
        const p = posAt(s.f, tt);
        return (
          <g key={s.id}>
            {tt > 0 && (
              <polyline
                points={parabolaPts(view, s.f, 0, tt, Math.max(6, Math.round((80 * tt) / s.f.T)))}
                fill="none"
                stroke={col}
                strokeWidth={s.a === 45 ? 3.5 : 2.75}
                strokeDasharray={shotDash(s.a)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {landed ? (
              <circle cx={view.sx(s.f.L)} cy={gy} r={narrow ? 4 : 5} fill={col} stroke="#fff" strokeWidth="1.5" />
            ) : (
              <Ball x={view.sx(p.x)} y={view.sy(Math.max(0, p.y))} r={narrow ? 4.5 : 5.5} color={col} />
            )}
          </g>
        );
      })}

      {placed.filter((p) => p.text).map((p) => (
        <Pill key={p.text} x={p.x} y={gy - 20 - p.row * 25} text={p.text} bg={p.color} size={fs} box={box} />
      ))}

      <Launcher view={view} alpha={sel} narrow={narrow} arcLabel={`α = ${sel}°`} />
    </g>
  );
}
