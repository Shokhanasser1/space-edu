import { useState } from 'react';
import { Lightbulb, ListChecks, Spline, Timer, Trash2, TrendingUp } from 'lucide-react';

import { Arrow, Btn, Explain, Pill, RangeField, Readout, Segmented, fmt, textWidth, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { COL, Cart, Chip, GroupLabel, LabScene, ScaleChip, Track, cartGeom, lineView, niceMax, tickDigits, trim } from './NewtonSecondLaw.parts';

/**
 * Tab 2 of "Newton's second law": the classroom experiment. Two light gates
 * s = 2 m apart; the cart starts from rest at gate A, a stopwatch times it to
 * gate B and a = 2s / t² (from s = at²/2). Each run adds a row to the table
 * and a point to the graph: a(F) with the mass fixed (a straight line
 * through the origin, slope 1/m) or a(m) with the force fixed (a hyperbola;
 * a(1/m) is a straight line, slope F). Several fixed values make several
 * series in their own colours. Real time.
 */

const S_GATE = 2; // m between the light gates
const X_END = 2.5; // m, where the end stop catches the cart
const FIXED_M = [1, 2, 4];
const FIXED_F = [5, 10, 20];
const SERIES_F = [2, 4, 6, 8, 10];
const SERIES_M = [1, 2, 4, 5, 8];
const SERIES_COL = ['#f472b6', '#22d3ee', '#a78bfa'];
const KF_WIDE = 5; // px per newton
const KF_NARROW = 2.6;

const INIT = {
  mode: 'force',
  fixM: 2,
  Fv: 10,
  fixF: 10,
  mv: 2,
  axis: 'm',
  rows: { force: [], mass: [] },
  run: null, // { F, m, t, running, done }
  queue: [],
  wait: 0,
  last: null,
};

const params = (s) => (s.mode === 'force' ? { F: s.Fv, m: s.fixM } : { F: s.fixF, m: s.mv });
const seriesOf = (mode, row) => (mode === 'force' ? row.m : row.F);
const seriesColor = (mode, v) => SERIES_COL[Math.max(0, (mode === 'force' ? FIXED_M : FIXED_F).indexOf(v))];
/** The stopwatch reading at gate B, to the millisecond, as a real stopwatch shows it. */
const gateTime = (a) => Math.round(Math.sqrt((2 * S_GATE) / a) * 1000) / 1000;

function startRun(s) {
  const { F, m } = params(s);
  return { ...s, run: { F, m, t: 0, running: true, done: false } };
}

/** One animation step of the whole lab (pure). */
function step(s, dt) {
  if (s.wait > 0) {
    const wait = s.wait - dt;
    if (wait > 0) return { ...s, wait };
    const [next, ...rest] = s.queue;
    if (next === undefined) return { ...s, wait: 0 };
    const s2 = s.mode === 'force' ? { ...s, Fv: next } : { ...s, mv: next };
    return startRun({ ...s2, queue: rest, wait: 0 });
  }
  const r = s.run;
  if (!r || !r.running) return s;
  const a = r.F / r.m;
  const tEnd = Math.sqrt((2 * X_END) / a);
  const t = Math.min(tEnd, r.t + dt);
  if (t < tEnd - 1e-9) return { ...s, run: { ...r, t } };
  const tg = gateTime(a);
  const row = { F: r.F, m: r.m, t: tg, a: (2 * S_GATE) / (tg * tg) };
  const list = s.rows[s.mode].filter((q) => q.F !== r.F || q.m !== r.m);
  return {
    ...s,
    rows: { ...s.rows, [s.mode]: [...list, row] },
    run: { ...r, t, running: false, done: true },
    wait: s.queue.length ? 0.6 : 0,
    last: row,
  };
}

export default function ExperimentSim({ T }) {
  const L = T.lab;
  const dec = T.decimal;
  const [s, setS] = useState(INIT);
  const { F, m } = params(s);
  const busy = Boolean(s.run?.running) || s.wait > 0;

  useRafLoop(busy, (dt) => setS((p) => step(p, dt)));

  const change = (patch) => setS((p) => ({ ...p, ...patch, run: null, queue: [], wait: 0 }));
  const measure = () => setS((p) => startRun({ ...p, queue: [], wait: 0 }));
  const series = () =>
    setS((p) => {
      const list = p.mode === 'force' ? SERIES_F : SERIES_M;
      const [first, ...rest] = list;
      const p2 = p.mode === 'force' ? { ...p, Fv: first } : { ...p, mv: first };
      return startRun({ ...p2, queue: rest, wait: 0 });
    });
  const clear = () => setS((p) => ({ ...p, rows: { ...p.rows, [p.mode]: [] }, run: null, queue: [], wait: 0, last: null }));

  const rows = s.rows[s.mode];
  const fixedNow = s.mode === 'force' ? s.fixM : s.fixF;
  const current = rows.filter((r) => seriesOf(s.mode, r) === fixedNow);
  const run = s.run;
  const runA = run ? run.F / run.m : F / m;
  const tg = gateTime(runA);
  const shownT = run ? Math.min(run.t, tg) : 0;
  const passedB = run && run.t >= tg - 1e-9;
  const aMeas = passedB ? (2 * S_GATE) / (tg * tg) : null;
  const D = (n) => trim(n, dec, 2);

  /* ---- the pattern (mean of a/F or a·m over the current series) */
  const lawK =
    current.length >= 2
      ? current.reduce((acc, r) => acc + (s.mode === 'force' ? r.a / r.F : r.a * r.m), 0) / current.length
      : null;

  /* ---- explanation */
  let key = s.mode === 'force' ? 'idleForce' : 'idleMass';
  if (run?.running) key = 'measuring';
  else if (current.length >= 3 && run?.done) key = s.mode === 'force' ? 'lawForce' : 'lawMass';
  else if (run?.done) key = 'result';
  const settled = useSettled(key, key === 'measuring' ? 0 : 150);
  const ex = L.explain;
  const text = {
    idleForce: ex.idleForce(D(s.fixM)),
    idleMass: ex.idleMass(D(s.fixF)),
    measuring: ex.measuring,
    result: run ? ex.result(fmt(tg, 3, dec), fmt((2 * S_GATE) / (tg * tg), 2, dec), D(run.F / run.m)) : '',
    lawForce: lawK !== null ? ex.lawForce(fmt(lawK, 2, dec), D(s.fixM)) : '',
    lawMass: lawK !== null ? ex.lawMass(fmt(lawK, 1, dec)) : '',
  }[settled];
  const tone = { idleForce: '#22d3ee', idleMass: '#22d3ee', measuring: '#fbbf24', result: '#fb923c', lawForce: '#34d399', lawMass: '#34d399' }[settled];

  const fixedOpts = (s.mode === 'force' ? FIXED_M : FIXED_F).map((v, i) => ({
    value: v,
    label: s.mode === 'force' ? `${D(v)} ${T.kg}` : `${D(v)} ${T.N}`,
    sub: L.count(rows.filter((r) => seriesOf(s.mode, r) === v).length),
    i,
  }));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{L.modeLabel}</GroupLabel>
          <Segmented
            label={L.modeLabel}
            className="grid-cols-1 sm:grid-cols-2"
            size="lg"
            value={s.mode}
            onChange={(mode) => change({ mode })}
            options={[
              { value: 'force', label: L.modes.force.name, sub: L.modes.force.sub, icon: TrendingUp },
              { value: 'mass', label: L.modes.mass.name, sub: L.modes.mass.sub, icon: Spline },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={Timer} onClick={measure} disabled={busy} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {busy ? L.measuring : L.measure}
          </Btn>
          <Btn icon={ListChecks} onClick={series} disabled={busy} className="min-h-[52px] text-[15px]">
            {L.series}
          </Btn>
        </div>
      </div>

      <GateScene T={T} F={run ? run.F : F} m={run ? run.m : m} t={run ? run.t : 0} shownT={shownT} running={Boolean(run?.running)} />

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={L.readouts.t} symbol="t" value={fmt(shownT, 3, dec)} unit={T.s} accent={COL.time} textColor="#a5f3fc" sub={L.tSub(D(S_GATE))} active={Boolean(run?.running) && !passedB} />
        <Readout
          label={L.readouts.a}
          symbol="a"
          value={aMeas !== null ? fmt(aMeas, 2, dec) : '—'}
          unit={aMeas !== null ? T.ms2 : undefined}
          accent={COL.acc}
          textColor={COL.accText}
          sub={aMeas !== null ? L.aSub(D(S_GATE), fmt(tg, 3, dec)) : 'a = 2s / t²'}
        />
        <Readout
          label={L.readouts.calc}
          symbol="F/m"
          value={D(run ? run.F / run.m : F / m)}
          unit={T.ms2}
          accent={COL.force}
          textColor={COL.f1Text}
          sub={L.calcSub(D(run ? run.F : F), D(run ? run.m : m))}
        />
        <Readout
          label={L.readouts.law}
          accent="#34d399"
          textColor="#6ee7b7"
          value={lawK !== null ? (s.mode === 'force' ? fmt(lawK, 2, dec) : fmt(lawK, 1, dec)) : '—'}
          unit={lawK !== null ? (s.mode === 'force' ? T.invKg : T.N) : undefined}
          sub={
            lawK === null
              ? L.lawWait
              : s.mode === 'force'
                ? `a / F ${L.lawForceSub(D(s.fixM))}`
                : `a · m ${L.lawMassSub(D(s.fixF))}`
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <p className="mb-1.5 text-sm text-gray-300">{s.mode === 'force' ? L.fixedM : L.fixedF}</p>
            <div role="group" aria-label={s.mode === 'force' ? L.fixedM : L.fixedF} className="grid grid-cols-3 gap-1.5">
              {fixedOpts.map((o) => {
                const on = o.value === fixedNow;
                const c = SERIES_COL[o.i];
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => change(s.mode === 'force' ? { fixM: o.value } : { fixF: o.value })}
                    style={on ? { borderColor: `${c}aa`, background: `${c}22` } : undefined}
                    className={`min-h-11 rounded-xl border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:opacity-40 ${
                      on ? 'text-white' : 'border-white/10 bg-white/[0.035] text-gray-300 hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c }} aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-semibold tabular-nums leading-tight">{o.label}</span>
                        <span className="block text-[11px] text-gray-400 tabular-nums">{o.sub}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {s.mode === 'force' ? (
            <RangeField
              id="nsl-lab-F"
              label={L.F}
              symbol="F"
              min={1}
              max={20}
              step={1}
              value={s.Fv}
              disabled={busy}
              onChange={(n) => change({ Fv: n })}
              accent={COL.force}
              display={`${D(s.Fv)} ${T.N}`}
              hint={L.FHint}
            />
          ) : (
            <RangeField
              id="nsl-lab-m"
              label={L.m}
              symbol="m"
              min={1}
              max={8}
              step={0.5}
              value={s.mv}
              disabled={busy}
              onChange={(n) => change({ mv: n })}
              accent={COL.mass}
              display={`${D(s.mv)} ${T.kg}`}
              hint={L.mHint}
            />
          )}
          <ResultTable T={T} mode={s.mode} rows={rows} last={s.last} onClear={clear} busy={busy} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <ResultGraph T={T} mode={s.mode} axis={s.axis} onAxis={(axis) => setS((p) => ({ ...p, axis }))} rows={rows} last={s.last} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function LightGate({ x, top, railY, label, sub, blocked, fs }) {
  return (
    <g>
      <rect x={x - 3} y={top} width={6} height={railY - top + 9} rx={2} fill="#64748b" />
      <rect x={x - 11} y={top - 10} width={22} height={14} rx={3} fill={blocked ? '#f59e0b' : '#334155'} />
      <circle cx={x} cy={top + 1} r={2.4} fill={blocked ? '#fff7ed' : '#f87171'} />
      <line x1={x} x2={x} y1={top + 5} y2={railY - 1} stroke="#ef4444" strokeOpacity={blocked ? 0.25 : 0.75} strokeWidth={1.6} strokeDasharray="4 3" />
      <text x={x} y={top - 16} textAnchor="middle" fontSize={fs + 2} fontWeight="800" fill={COL.ink}>
        {label}
      </text>
      {sub && (
        <text x={x} y={top - 32} textAnchor="middle" fontSize={fs - 1} fill={COL.muted}>
          {sub}
        </text>
      )}
    </g>
  );
}

function GateScene({ T, F, m, t, shownT, running }) {
  const L = T.lab;
  const dec = T.decimal;
  const a = F / m;
  const x = Math.min(X_END, 0.5 * a * t * t);
  const D = (n) => trim(n, dec, 2);
  return (
    <LabScene
      legend={[
        { color: COL.force, label: L.legend.F, kind: 'arrow' },
        { color: '#ef4444', label: L.legend.beam, kind: 'dash' },
        { color: COL.disp, label: L.legend.s, kind: 'line' },
      ]}
      chips={(W, narrow) => (
        <>
          <Chip>{L.chipReal}</Chip>
          <ScaleChip px={10 * (narrow ? KF_NARROW : KF_WIDE)} text={L.scale(10)} />
        </>
      )}
      height={(W, narrow) => (narrow ? 272 : 372)}
      ariaLabel={L.sceneLabel(D(F), D(m), fmt(shownT, 3, dec))}
    >
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const len = narrow ? 64 : 116;
        const kF = narrow ? KF_NARROW : KF_WIDE;
        const padL = len / 2 + (narrow ? 14 : 40);
        const padR = len / 2 + 12 + 20 * kF + (narrow ? 8 : 26);
        const view = lineView(0, X_END, W, padL, padR);
        const railY = H - (narrow ? 50 : 56);
        const g = cartGeom(len, m);
        const cx = view.sx(x);
        const flagTop = railY + g.top - 16;
        const xa = view.sx(0);
        const xb = view.sx(S_GATE);
        const half = (len * 0.04) / view.k;
        const box = { w: W, h: H };
        const fLen = F * kF;
        const hookX = cx + len / 2 + 7;
        const fy = railY + g.midY;
        const fText = L.FTag(D(F));
        const fW = textWidth(fText, fs, 600) + 16;
        const swW = narrow ? 112 : 150;
        const swH = narrow ? 34 : 42;
        const swX = (xa + xb) / 2 - swW / 2;
        const swY = narrow ? 26 : 62;
        const dimY = swY + swH + (narrow ? 22 : 26);
        const gateTop = dimY + 48;
        const sText = L.dist(D(S_GATE));
        return (
          <>
            <g aria-hidden="true">
              {Array.from({ length: Math.ceil(W / 28) + 1 }, (_, i) => (
                <line key={`gv${i}`} x1={i * 28} x2={i * 28} y1={0} y2={railY - 1} stroke={COL.grid} strokeWidth={1} />
              ))}
              {Array.from({ length: Math.ceil(railY / 28) }, (_, i) => (
                <line key={`gh${i}`} x1={0} x2={W} y1={railY - 1 - i * 28} y2={railY - 1 - i * 28} stroke={COL.grid} strokeWidth={1} />
              ))}
            </g>
            <Track view={view} W={W} y={railY} x0={0} x1={X_END} step={0.5} minor={narrow ? 1 : 5} unit={L.axisX} decimal={dec} fs={fs - 1} digits={1} stopAt={X_END + (len / 2 + 2) / view.k} />

            {/* stopwatch */}
            <g>
              <text x={swX + swW / 2} y={swY - 6} textAnchor="middle" fontSize={fs - 1} fill={COL.muted}>
                {L.stopwatch}
              </text>
              <rect x={swX} y={swY} width={swW} height={swH} rx={9} fill="#0f172a" stroke={running ? '#22d3ee' : '#334155'} strokeWidth={2} />
              <text x={swX + swW / 2} y={swY + swH / 2 + (narrow ? 7 : 9)} textAnchor="middle" fontSize={narrow ? 20 : 26} fontWeight="700" fill="#67e8f9" className="tabular-nums">
                {`${fmt(shownT, 3, dec)} ${T.s}`}
              </text>
            </g>

            {/* distance between the gates */}
            <line x1={xa} x2={xa} y1={dimY - 8} y2={gateTop - 40} stroke={COL.disp} strokeOpacity={0.35} strokeWidth={1} />
            <line x1={xb} x2={xb} y1={dimY - 8} y2={gateTop - 40} stroke={COL.disp} strokeOpacity={0.35} strokeWidth={1} />
            <Arrow x1={(xa + xb) / 2} y1={dimY} x2={xa + 1} y2={dimY} color={COL.disp} width={2} head={9} />
            <Arrow x1={(xa + xb) / 2} y1={dimY} x2={xb - 1} y2={dimY} color={COL.disp} width={2} head={9} />
            <Pill x={(xa + xb) / 2} y={dimY} text={sText} bg={COL.disp} size={fs} />

            <LightGate x={xa} top={gateTop} railY={railY} label="A" sub={narrow ? null : L.gate(1)} blocked={Math.abs(x) < half && t > 0 && running} fs={fs} />
            <LightGate x={xb} top={gateTop} railY={railY} label="B" sub={narrow ? null : L.gate(2)} blocked={Math.abs(x - S_GATE) < half} fs={fs} />

            {running && fLen > 2 && <circle cx={hookX} cy={fy} r={8} fill={COL.force} className="cl-pulse" />}
            <Cart cx={cx} y={railY} len={len} mass={m} label={L.massTag(D(m))} rot={cx / (len * 0.1)} fs={narrow ? 10 : 12} />
            {/* flag that cuts the light beams */}
            <line x1={cx} x2={cx} y1={railY + g.top} y2={flagTop} stroke="#334155" strokeWidth={2} />
            <rect x={cx - 1} y={flagTop} width={narrow ? 9 : 12} height={narrow ? 7 : 9} rx={1.5} fill="#f59e0b" />

            {fLen > 2 && (
              <>
                <Arrow x1={hookX} y1={fy} x2={hookX + fLen} y2={fy} color={COL.force} width={narrow ? 3 : 4} head={narrow ? 10 : 13} />
                <Pill x={hookX + Math.max(fLen, fW) / 2} y={fy - (narrow ? 16 : 21)} text={fText} bg={COL.force} size={fs} box={box} />
              </>
            )}
          </>
        );
      }}
    </LabScene>
  );
}

/* ---------------------------------------------------------------- table */

function ResultTable({ T, mode, rows, last, onClear, busy }) {
  const L = T.lab.table;
  const dec = T.decimal;
  const D = (n) => trim(n, dec, 2);
  const sorted = [...rows].sort((p, q) => seriesOf(mode, p) - seriesOf(mode, q) || (mode === 'force' ? p.F - q.F : p.m - q.m));
  return (
    <div className="rounded-xl bg-black/25 p-2.5 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{L.title}</p>
        <button
          type="button"
          onClick={onClear}
          aria-label={T.lab.clear}
          disabled={busy || rows.length === 0}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 disabled:opacity-40"
        >
          <Trash2 size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{T.lab.clear}</span>
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm leading-snug text-gray-500">{L.empty}</p>
      ) : (
        <div className="mt-1 max-h-[268px] overflow-y-auto">
          <table className="w-full text-right text-[13px] tabular-nums">
            <caption className="sr-only">{L.caption}</caption>
            <thead className="sticky top-0 bg-[#141625] text-[11px] text-gray-400">
              <tr>
                <th scope="col" className="py-1 pr-1 text-left font-semibold">
                  {L.n}
                </th>
                <th scope="col" className="py-1 px-1 font-semibold">
                  {L.F}
                </th>
                <th scope="col" className="py-1 px-1 font-semibold">
                  {L.m}
                </th>
                <th scope="col" className="py-1 px-1 font-semibold">
                  {L.t}
                </th>
                <th scope="col" className="py-1 px-1 font-semibold text-orange-300/90">
                  {L.a}
                </th>
                <th scope="col" className="py-1 pl-1 font-semibold text-emerald-300/90">
                  {mode === 'force' ? L.ratio : L.prod}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const isLast = last && last.F === r.F && last.m === r.m;
                return (
                  <tr key={`${r.F}-${r.m}`} className={`border-t border-white/[0.06] ${isLast ? 'bg-white/[0.07]' : ''}`}>
                    <td className="py-1 pr-1 text-left">
                      <span className="inline-flex items-center gap-1.5 text-gray-400">
                        <span className="h-2 w-2 rounded-full" style={{ background: seriesColor(mode, seriesOf(mode, r)) }} aria-hidden="true" />
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-1 px-1 text-gray-200">{D(r.F)}</td>
                    <td className="py-1 px-1 text-gray-200">{D(r.m)}</td>
                    <td className="py-1 px-1 text-gray-300">{fmt(r.t, 3, dec)}</td>
                    <td className="py-1 px-1 font-semibold text-[#fdba74]">{fmt(r.a, 2, dec)}</td>
                    <td className="py-1 pl-1 text-[#6ee7b7]">{mode === 'force' ? fmt(r.a / r.F, 2, dec) : fmt(r.a * r.m, 1, dec)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- graph */

function ResultGraph({ T, mode, axis, onAxis, rows, last }) {
  const L = T.lab.graph;
  const dec = T.decimal;
  const D = (n) => trim(n, dec, 2);
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 260;
  const pad = { l: 44, r: 18, t: 20, b: 28 };
  const inv = mode === 'mass' && axis === 'inv';
  const xOf = (r) => (mode === 'force' ? r.F : inv ? 1 / r.m : r.m);
  const xMax = mode === 'force' ? 20 : inv ? 1 : 8;
  const yMax = niceMax(Math.max(2, ...rows.map((r) => r.a * 1.15)));
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - (v / yMax) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const yDigits = tickDigits(yMax);
  const xDigits = tickDigits(xMax);
  const fixedList = mode === 'force' ? FIXED_M : FIXED_F;

  /* fitted lines: a = k·F, a = c/m or a = c·(1/m), least squares through the origin */
  const fits = fixedList
    .map((v) => {
      const pts = rows.filter((r) => seriesOf(mode, r) === v);
      if (pts.length < 2) return null;
      const color = seriesColor(mode, v);
      const label = mode === 'force' ? L.seriesM(D(v)) : L.seriesF(D(v));
      let path;
      let end;
      if (mode === 'force') {
        const k = pts.reduce((acc, r) => acc + r.F * r.a, 0) / pts.reduce((acc, r) => acc + r.F * r.F, 0);
        const xe = Math.min(xMax, yMax / k);
        path = `M${gx(0)},${gy(0)} L${gx(xe)},${gy(k * xe)}`;
        end = { x: gx(xe), y: gy(k * xe) };
      } else {
        const c = pts.reduce((acc, r) => acc + r.a / r.m, 0) / pts.reduce((acc, r) => acc + 1 / (r.m * r.m), 0);
        if (inv) {
          const xe = Math.min(xMax, yMax / c);
          path = `M${gx(0)},${gy(0)} L${gx(xe)},${gy(c * xe)}`;
          end = { x: gx(xe), y: gy(c * xe) };
        } else {
          const m0 = Math.max(c / yMax, 0.3);
          const seg = [];
          for (let i = 0; i <= 80; i += 1) {
            const mm = m0 + ((xMax - m0) * i) / 80;
            seg.push(`${i ? 'L' : 'M'}${gx(mm).toFixed(1)},${gy(c / mm).toFixed(1)}`);
          }
          path = seg.join(' ');
          end = { x: gx(xMax), y: gy(c / xMax) };
        }
      }
      return { v, color, label, path, end };
    })
    .filter(Boolean);

  const title = mode === 'force' ? L.titleF : inv ? L.titleInv : L.titleM;
  const xLabel = mode === 'force' ? L.xF : inv ? L.xInv : L.xM;
  const present = fixedList.filter((v) => rows.some((r) => seriesOf(mode, r) === v));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-sm font-semibold text-gray-200">{title}</p>
          {present.map((v) => (
            <span key={v} className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: seriesColor(mode, v) }} />
              {mode === 'force' ? L.seriesM(D(v)) : L.seriesF(D(v))}
            </span>
          ))}
        </div>
        {mode === 'mass' && (
          <Segmented
            label={L.axisLabel}
            className="grid-cols-2 w-[148px]"
            value={axis}
            onChange={onAxis}
            options={[
              { value: 'm', label: L.axes.m },
              { value: 'inv', label: L.axes.inv },
            ]}
          />
        )}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${L.label}: ${title}`} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, dec)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <g key={`x${v}`}>
              <line x1={gx(v)} x2={gx(v)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.05)" />
              <text x={gx(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {fmt(v, xDigits, dec)}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.28)" />
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {L.y}
          </text>
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {xLabel}
          </text>
          {fits.map((f) => (
            <g key={`fit${f.v}`}>
              <path d={f.path} fill="none" stroke={f.color} strokeOpacity={0.75} strokeWidth={2} strokeDasharray="7 5" />
            </g>
          ))}
          {rows.map((r) => {
            const isLast = last && last.F === r.F && last.m === r.m;
            const c = seriesColor(mode, seriesOf(mode, r));
            return (
              <g key={`p${r.F}-${r.m}`}>
                {isLast && <circle cx={gx(xOf(r))} cy={gy(r.a)} r={9} fill="none" stroke={c} strokeOpacity={0.6} strokeWidth={2} />}
                <circle cx={gx(xOf(r))} cy={gy(r.a)} r={5} fill={c} stroke="#0b0b16" strokeWidth={1.5} />
              </g>
            );
          })}
          {fits.map((f) => {
            const tw = textWidth(f.label, 11, 600);
            const lx = Math.min(f.end.x - 4, W - pad.r - tw - 2);
            const ly = Math.max(pad.t + 12, f.end.y - 8);
            return (
              <text key={`lab${f.v}`} x={lx} y={ly} textAnchor="start" fontSize="11" fontWeight="600" fill={f.color} stroke="#12131f" strokeWidth={3} paintOrder="stroke">
                {f.label}
              </text>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{mode === 'force' ? L.noteF : L.noteM}</p>
    </div>
  );
}
