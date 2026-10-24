import { useMemo, useState } from 'react';
import { Lightbulb, RotateCcw, Ruler } from 'lucide-react';

import { Arrow, Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  Dial,
  G,
  GroupLabel,
  LIQUIDS,
  LIQ_IDS,
  LabScene,
  LiquidGrad,
  PC,
  Rich,
  RichPill,
  SvgRich,
  ToggleChip,
  fmtG,
  niceCeil,
  niceMajor,
  plain,
  surfacePath,
} from './HydrostaticPressure.parts';

/**
 * Tab 2 — the hydrostatic paradox (Pascal's vases): three vessels with the
 * same bottom area S = 100 cm² — a cylinder, one that flares out and one
 * that narrows to a thin neck — filled to the same height h. The pressure on
 * the bottom p = ρgh and the force F = pS are the same in all three, though
 * the weights of the liquid differ. With water and h = 30 cm:
 * p = 2940 Pa, F = 29.4 N; weights 29.4 N, 86.5 N and 9.55 N. The slanted
 * walls explain it: liquid presses on every wall at right angles, so a wall
 * that leans out carries part of the weight, and one that leans in pushes
 * the liquid down.
 */

const S = 0.01; // bottom area, m² (100 cm²)
const R0 = Math.sqrt(S / Math.PI); // 0.0564 m
const HV = 0.45; // vessel height, m
const RT = 0.17; // top radius of the flaring vessel
const RN = 0.018; // neck radius of the narrowing vessel
const YN = 0.18; // where the neck starts
const VESSELS = [
  { id: 'cyl', r: () => R0, dr: () => 0 },
  { id: 'wide', r: (y) => R0 + ((RT - R0) * y) / HV, dr: () => (RT - R0) / HV },
  { id: 'narrow', r: (y) => (y < YN ? R0 - ((R0 - RN) * y) / YN : RN), dr: (y) => (y < YN ? -(R0 - RN) / YN : 0) },
];
const FILL_RATE = 0.1; // m/s the level rises while pouring
/** Pressure that draws the longest arrow (sea water at the brim); mercury is drawn 10× smaller. */
const P_REF = 1030 * G * HV;

/** A force in newtons with sensible precision (9.55 · 29.4 · 151 · 2253). */
const fN = (F, dec) => fmtG(F, F < 10 ? 2 : F < 100 ? 1 : 0, dec);

/** Volume of liquid up to height h in vessel v (solid of revolution), m³. */
function volume(v, h) {
  const n = 90;
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const y = ((i + 0.5) * h) / n;
    s += Math.PI * v.r(y) ** 2;
  }
  return (s * h) / n;
}

export default function ParadoxSim({ T }) {
  const t = T.paradox;
  const dec = T.decimal;
  const [liqId, setLiqId] = useState('water');
  const [target, setTarget] = useState(0.3);
  const [level, setLevel] = useState(0);
  const [walls, setWalls] = useState(false);
  const [act, setAct] = useState({ k: 'fill' });
  const [ph, setPh] = useState(0);
  const liq = LIQUIDS[liqId];
  const moving = Math.abs(level - target) > 1e-4;
  const filling = level < target - 1e-4;

  useRafLoop(moving, (dt) => {
    setPh((p) => p + dt * 6);
    setLevel((l) => {
      if (l < target) return Math.min(target, l + FILL_RATE * dt);
      const nl = l + (target - l) * (1 - Math.exp(-dt / 0.22));
      return Math.abs(nl - target) < 1e-4 ? target : nl;
    });
  });

  /* ---- physics (at the settled height; the scene shows the live level) */
  const h = target;
  const p = liq.rho * G * h;
  const F = p * S;
  const weights = useMemo(() => VESSELS.map((v) => liq.rho * G * volume(v, h)), [liq.rho, h]);
  const liveP = liq.rho * G * level;
  const liveW = VESSELS.map((v) => liq.rho * G * volume(v, level));

  /* ---- actions */
  const refill = () => {
    setLevel(0);
    setAct({ k: 'fill' });
  };
  const pickLiquid = (id) => {
    if (id === liqId) return;
    setLiqId(id);
    setAct({ k: 'liquid' });
  };
  const changeH = (v) => {
    setTarget(v);
    setAct({ k: 'height' });
  };
  const toggleWalls = (on) => {
    setWalls(on);
    setAct({ k: on ? 'walls' : 'paradox' });
  };

  /* ---- explanation */
  const ex = t.explain;
  const kind = filling ? 'fill' : act.k === 'fill' ? 'paradox' : act.k;
  const settled = useSettled(kind, 350);
  const hS = fmt(h * 100, 0, dec);
  const pS = fmtG(p, 0, dec);
  const FS = { v: fN(F, dec), u: T.N };
  const W = weights.map((w) => fN(w, dec));
  const text =
    {
      fill: ex.fill,
      paradox: ex.paradox(hS, pS, FS.v, W[0], W[1], W[2]),
      walls: ex.walls,
      height: ex.height(hS, pS, FS.v),
      liquid: ex.liquid(T.liquids[liqId].name, fmtG(liq.rho, 0, dec), pS, FS.v),
    }[settled] ?? ex.paradox(hS, pS, FS.v, W[0], W[1], W[2]);
  const tone = { fill: '#38bdf8', walls: '#a78bfa', height: '#f87171', liquid: '#fbbf24' }[settled] ?? '#34d399';

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <GroupLabel>{t.liquidLabel}</GroupLabel>
          <Segmented
            label={t.liquidLabel}
            className="grid-cols-2 sm:grid-cols-4"
            size="lg"
            value={liqId}
            onChange={pickLiquid}
            accent={liq.chip}
            options={LIQ_IDS.map((id) => ({ value: id, label: T.liquids[id].name, sub: `ρ = ${fmtG(LIQUIDS[id].rho, 0, dec)} ${T.kgm3}` }))}
          />
        </div>
        <Btn variant="primary" icon={RotateCcw} onClick={refill} disabled={filling} className="xl:min-w-[180px] min-h-[52px] text-[15px]">
          {t.refill}
        </Btn>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ParadoxScene
          T={T}
          liqId={liqId}
          level={level}
          filling={filling}
          walls={walls}
          ph={ph}
          liveP={liveP}
          liveW={liveW}
          ariaLabel={plain(t.scene.aria(fmt(level * 100, 0, dec), fmtG(liveP, 0, dec), fN(liveP * S, dec), ...liveW.map((w) => fN(w, dec))))}
        />
        <BarPanel T={T} F={liveP * S} weights={liveW} />
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.h} symbol="h" value={hS} unit={T.cm} accent={PC.ink} textColor="#e2e8f0" sub={t.sub.h} />
        <Readout label={t.readouts.p} symbol="p" value={pS} unit={T.Pa} accent={PC.hydro} textColor={PC.hydroText} sub={t.sub.p} active={!filling} />
        <Readout label={t.readouts.F} symbol="F" value={FS.v} unit={FS.u} accent={PC.hydro} textColor={PC.hydroText} sub={t.sub.F} active={!filling} />
        <Readout label={t.readouts.P} symbol="P" accent={PC.weight} sub={t.sub.P}>
          <div className="mt-1.5 grid gap-x-2 gap-y-0.5 sm:grid-cols-3">
            {weights.map((w, i) => (
              <div key={VESSELS[i].id} className="flex min-w-0 items-baseline gap-1.5 sm:block">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">{i + 1}</p>
                <p className="text-lg sm:text-xl font-bold tabular-nums leading-tight whitespace-nowrap" style={{ color: PC.weightText }}>
                  {fN(w, dec)} <span className="text-xs font-medium text-gray-400">{T.N}</span>
                </p>
              </div>
            ))}
          </div>
        </Readout>
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="hp-par-h"
            label={t.height}
            symbol="h"
            min={0.05}
            max={0.42}
            step={0.01}
            value={target}
            onChange={changeH}
            accent="#94a3b8"
            display={`${hS} ${T.cm}`}
            hint={t.heightHint}
          />
          <ToggleChip label={t.walls.label} sub={t.walls.sub} on={walls} onChange={toggleWalls} accent="#a78bfa" />
        </div>
        <div className="lg:col-span-3 grid gap-2 sm:grid-cols-3">
          {VESSELS.map((v, i) => {
            const m = weights[i] / G;
            return (
              <div key={v.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">
                  {i + 1} · {t.vessels[v.id].name}
                </p>
                <p className="mt-1 text-xs leading-snug text-gray-400">{t.vessels[v.id].note}</p>
                <p className="mt-2 text-[13px] tabular-nums text-gray-300">
                  <Rich>{t.vesselLine.m(fmt(m, m < 10 ? 2 : 1, dec))}</Rich>
                </p>
                <p className="text-[13px] tabular-nums" style={{ color: PC.weightText }}>
                  <Rich>{t.vesselLine.P(fN(weights[i], dec), T.N)}</Rich>
                </p>
                <p className="text-[13px] tabular-nums" style={{ color: PC.hydroText }}>
                  <Rich>{t.vesselLine.F(FS.v, FS.u)}</Rich>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ bar panel */

function BarPanel({ T, F, weights }) {
  const t = T.paradox.bars;
  const dec = T.decimal;
  const [ref, { width, height }] = useElementSize();
  const Wd = Math.max(width, 200);
  const Hd = Math.max(height, 230);
  const pad = { l: 34, r: 6, t: 26, b: 30 };
  const yMax = niceCeil(Math.max(F, ...weights, 1) * 1.1);
  const gy = (v) => Hd - pad.b - (v / yMax) * (Hd - pad.t - pad.b);
  const slot = (Wd - pad.l - pad.r) / 3;
  const bw = Math.min(26, slot * 0.3);
  const ticks = [0, 0.5, 1].map((f) => f * yMax);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
      <p className="text-sm font-semibold text-gray-200">{t.title}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PC.hydro }} aria-hidden="true" />
          <Rich>{t.F}</Rich>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PC.weight }} aria-hidden="true" />
          <Rich>{t.P}</Rich>
        </span>
      </div>
      <div ref={ref} className="relative mt-1 w-full flex-1" style={{ minHeight: 230 }}>
        {width > 0 && (
          <svg width={Wd} height={Hd} viewBox={`0 0 ${Wd} ${Hd}`} role="img" aria-label={plain(t.aria)} className="absolute inset-0 block overflow-visible">
            {ticks.map((v) => (
              <g key={v}>
                <line x1={pad.l} x2={Wd - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'} />
                <text x={pad.l - 5} y={gy(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                  {fmtG(v, v < 10 && v > 0 ? 1 : 0, dec)}
                </text>
              </g>
            ))}
            <text x={pad.l} y={12} fontSize="10" fill="#64748b">
              {t.unit}
            </text>
            {/* the common bottom force line */}
            {F > 0 && <line x1={pad.l} x2={Wd - pad.r} y1={gy(F)} y2={gy(F)} stroke={PC.hydro} strokeDasharray="5 4" strokeWidth={1.2} opacity="0.8" />}
            {weights.map((w, i) => {
              const cx = pad.l + slot * (i + 0.5);
              return (
                <g key={i}>
                  <rect x={cx - bw - 2} y={gy(F)} width={bw} height={Math.max(0, gy(0) - gy(F))} rx={3} fill={PC.hydro} />
                  <rect x={cx + 2} y={gy(w)} width={bw} height={Math.max(0, gy(0) - gy(w))} rx={3} fill={PC.weight} />
                  <text x={cx + 2 + bw / 2} y={gy(w) - 5} textAnchor="middle" fontSize="10.5" fontWeight="700" fill={PC.weightText}>
                    {fN(w, dec)}
                  </text>
                  <text x={cx} y={Hd - 10} textAnchor="middle" fontSize="12" fontWeight="700" fill="#e2e8f0">
                    {i + 1}
                  </text>
                </g>
              );
            })}
            {F > 0 && (
              <text x={Wd - pad.r} y={gy(F) - 5} textAnchor="end" fontSize="10.5" fontWeight="700" fill={PC.hydroText}>
                {`F = ${fN(F, dec)}`}
              </text>
            )}
          </svg>
        )}
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">
        <Rich>{t.note}</Rich>
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function ParadoxScene({ T, liqId, level, filling, walls, ph, liveP, liveW, ariaLabel }) {
  const t = T.paradox;
  const dec = T.decimal;
  const liq = LIQUIDS[liqId];
  const legend = [
    { label: t.legend.bottom, color: PC.hydro, kind: 'arrow' },
    ...(walls ? [{ label: t.legend.walls, color: '#7c3aed', kind: 'arrow' }] : []),
    { label: t.legend.level, color: PC.ink, kind: 'dash' },
    { label: t.legend.weight, color: PC.weight, kind: 'dot' },
  ];
  const chips = liq.metal ? <Chip icon={Ruler}>{t.scene.scaleChip}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 1.0, 330, 400) : clamp(W * 0.6, 400, 500))}>
      {(W, H, narrow) => {
        const fs = narrow ? 10.5 : 12;
        const box = { w: W, h: H };
        const pad = narrow ? { l: 10, r: 10, t: 48, b: 10 } : { l: 24, r: 24, t: 66, b: 14 };
        const rg = narrow ? 17 : 27;
        const below = 2 * rg + (narrow ? 34 : 40);
        const slotW = (W - pad.l - pad.r) / 3;
        const kV = (H - pad.t - pad.b - below) / (HV + 0.1);
        const kHz = (slotW - (narrow ? 10 : 30)) / (2 * RT);
        const k = Math.min(kV, kHz);
        const yBase = H - pad.b - below;
        const sy = (y) => yBase - y * k;
        const Lmax = Math.min(0.3 * k, narrow ? 34 : 62);
        const aLen = (pp) => (pp / P_REF) * Lmax * (liq.metal ? 0.1 : 1);
        const levelY = sy(level);
        const gradId = `hp-par-${liqId}`;
        const benchH = Math.max(6, 0.025 * k);
        const dialMax = niceCeil(liq.rho * G * 0.42 * S * 1.02);

        const vessel = (v, i) => {
          const cx = pad.l + slotW * (i + 0.5);
          const n = 40;
          const right = [];
          const left = [];
          for (let j = 0; j <= n; j += 1) {
            const y = (HV * j) / n;
            right.push(`${(cx + v.r(y) * k).toFixed(1)},${sy(y).toFixed(1)}`);
            left.push(`${(cx - v.r(y) * k).toFixed(1)},${sy(y).toFixed(1)}`);
          }
          const outline = `M${left.reverse().join(' L')} L${right.join(' L')}`;
          /* liquid polygon up to the level */
          const liqPts = [];
          const steps = Math.max(2, Math.ceil((level / HV) * n));
          for (let j = 0; j <= steps; j += 1) {
            const y = (level * j) / steps;
            liqPts.push(`${(cx + v.r(y) * k).toFixed(1)},${sy(y).toFixed(1)}`);
          }
          for (let j = steps; j >= 0; j -= 1) {
            const y = (level * j) / steps;
            liqPts.push(`${(cx - v.r(y) * k).toFixed(1)},${sy(y).toFixed(1)}`);
          }
          const rTop = v.r(level);
          const rRim = v.r(HV);

          /* bottom arrows: equal in all three vessels */
          const Lb = aLen(liveP);
          const bottom = [];
          if (Lb > 3 && level > 0.004) {
            for (const f of [-0.55, 0, 0.55]) {
              const x = cx + f * R0 * k;
              bottom.push(<Arrow key={`b${f}`} x1={x} y1={yBase - 2 - Lb} x2={x} y2={yBase - 2} color={PC.hydro} width={narrow ? 2 : 2.6} head={narrow ? 7 : 9} />);
            }
          }

          /* wall arrows: the force on the wall, drawn outside it at right angles, growing with depth */
          const wallArrows = [];
          if (walls && level > 0.03) {
            const step = 0.065;
            for (let y = 0.035; y < level - 0.01; y += step) {
              const L = aLen(liq.rho * G * (level - y));
              if (L < 4) continue;
              const r = v.r(y);
              const d = v.dr(y);
              const nl = Math.hypot(1, d);
              for (const side of [-1, 1]) {
                // outward normal in world units (y up): (side, −r'), on screen y flips
                const nx = side / nl;
                const ny = -d / nl;
                const hx = cx + side * r * k;
                const hy = sy(y);
                const gap = narrow ? 3 : 4;
                wallArrows.push(
                  <Arrow
                    key={`w${side}${y.toFixed(3)}`}
                    x1={hx + nx * gap}
                    y1={hy - ny * gap}
                    x2={hx + nx * (gap + L)}
                    y2={hy - ny * (gap + L)}
                    color="#7c3aed"
                    width={narrow ? 1.6 : 2}
                    head={narrow ? 6 : 7}
                    opacity={0.9}
                  />,
                );
              }
            }
          }

          /* pour stream while filling: its width follows the flow rate */
          const area = Math.PI * rTop * rTop;
          const sw = clamp(Math.sqrt(area / S) * (narrow ? 3 : 4.5), 1.2, narrow ? 9 : 14);
          const Fl = fN(liveP * S, dec);
          const gx = cx;
          const gyC = yBase + benchH + rg + 6;

          return (
            <g key={v.id}>
              {/* stream */}
              {filling && (
                <g>
                  <line x1={cx} x2={cx} y1={pad.t - 20} y2={levelY} stroke={liq.metal ? '#94a3b8' : liq.deep} strokeWidth={sw} strokeLinecap="round" opacity="0.75" />
                  <line
                    x1={cx}
                    x2={cx}
                    y1={pad.t - 20}
                    y2={levelY}
                    stroke="#fff"
                    strokeWidth={Math.max(1, sw * 0.3)}
                    strokeDasharray="6 10"
                    strokeDashoffset={-ph * 30}
                    opacity="0.6"
                  />
                </g>
              )}
              {/* liquid */}
              {level > 0.001 && <polygon points={liqPts.join(' ')} fill={`url(#${gradId})`} />}
              {level > 0.001 && (
                <path d={surfacePath(cx - rTop * k, cx + rTop * k, levelY, filling ? 1.6 : 0, ph, 30)} fill="none" stroke={liq.edge} strokeWidth={2} />
              )}
              {/* glass */}
              <path d={outline} fill="none" stroke="#475569" strokeWidth={narrow ? 2 : 2.6} strokeLinejoin="round" />
              <path d={outline} fill="none" stroke="#ffffff" strokeWidth={1} opacity="0.5" transform="translate(1.5,0)" />
              <line x1={cx - rRim * k - 3} x2={cx - rRim * k + 1} y1={sy(HV)} y2={sy(HV)} stroke="#475569" strokeWidth={2} />
              <line x1={cx + rRim * k - 1} x2={cx + rRim * k + 3} y1={sy(HV)} y2={sy(HV)} stroke="#475569" strokeWidth={2} />
              {/* membrane bottom */}
              <line x1={cx - R0 * k} x2={cx + R0 * k} y1={yBase} y2={yBase} stroke="#0f172a" strokeWidth={3} />
              {wallArrows}
              {bottom}
              {/* weight of the liquid */}
              <RichPill x={cx} y={sy(HV) - (narrow ? 14 : 18)} text={t.scene.weightTag(fN(liveW[i], dec), T.N)} bg={PC.weight} size={fs - 1} box={box} />
              {/* gauge under the bottom */}
              <rect x={cx - rg - 6} y={yBase + benchH} width={2 * rg + 12} height={rg * 2 + 10} rx={6} fill="#e2e8f0" stroke="#94a3b8" />
              <Dial cx={gx} cy={gyC} r={rg} value={liveP * S} max={dialMax} major={niceMajor(dialMax)} labels={false} color={PC.hydro} decimal={dec} />
              <text x={cx} y={gyC + rg + (narrow ? 20 : 24)} textAnchor="middle" fontSize={fs} fontWeight="700" fill={PC.hydro}>
                <SvgRich text={t.scene.forceTag(Fl, T.N)} fs={fs} />
              </text>
              <text x={cx} y={sy(HV) - (narrow ? 30 : 38)} textAnchor="middle" fontSize={fs - 0.5} fontWeight="700" fill="#334155">
                {`${i + 1} · ${t.vessels[v.id].short}`}
              </text>
            </g>
          );
        };

        return (
          <g>
            <defs>
              <LiquidGrad id={gradId} liq={liq} />
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {/* bench */}
            <rect x={pad.l} y={yBase} width={W - pad.l - pad.r} height={benchH} rx={2} fill="#64748b" />
            {VESSELS.map(vessel)}
            {/* the common level */}
            {level > 0.004 && (
              <g>
                <line x1={pad.l} x2={W - pad.r} y1={levelY} y2={levelY} stroke={PC.ink} strokeWidth={1.2} strokeDasharray="6 5" opacity="0.8" />
                <RichPill
                  x={pad.l + 4}
                  y={levelY - (narrow ? 12 : 14)}
                  anchor="start"
                  text={t.scene.hTag(fmt(level * 100, 0, dec))}
                  bg={PC.ink}
                  size={fs - 1}
                  box={box}
                />
              </g>
            )}
          </g>
        );
      }}
    </LabScene>
  );
}
