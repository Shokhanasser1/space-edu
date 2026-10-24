import { useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Lightbulb, Ruler } from 'lucide-react';

import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import {
  Chip,
  Dial,
  FormulaTile,
  G,
  GroupLabel,
  LIQUIDS,
  LIQ_IDS,
  LabScene,
  LineGraph,
  LiquidGrad,
  P0,
  PC,
  Rich,
  RichPill,
  fmtG,
  niceCeil,
  niceMajor,
  plain,
  surfacePath,
  useSmooth,
} from './HydrostaticPressure.parts';

/**
 * Tab 1 — the depth probe: a membrane pressure sensor (a "manometric box")
 * lowered into a deep tank and read on a dial manometer. The pressure of the
 * liquid column is p = ρgh — only depth and density matter, not where the
 * sensor sits sideways nor which way its membrane faces; the total pressure
 * is p₀ + ρgh. Presets: water 10 m → 98.0 kPa, kerosene 10 m → 78.4 kPa,
 * sea water 10 m → 100.9 kPa, mercury 0.76 m → 101.3 kPa = p₀.
 */

const D = 12; // tank depth, m
const PRESETS = [
  { id: 'water10', liq: 'water', h: 10 },
  { id: 'kero10', liq: 'kerosene', h: 10 },
  { id: 'sea10', liq: 'sea', h: 10 },
  { id: 'hg76', liq: 'mercury', h: 0.76 },
];
const ORIENT = { up: -Math.PI / 2, side: 0, down: Math.PI / 2 };
/** Pressure that draws the longest arrow (sea water at the full depth); mercury is drawn 10× smaller. */
const P_REF = 1030 * G * D;

/** Gauge range for a liquid: the pressure at the bottom rounded up to a nice number (kPa). */
function gaugeRange(rho) {
  const max = niceCeil((rho * G * D) / 1000);
  return { max, major: niceMajor(max) };
}

export default function ProbeSim({ T }) {
  const t = T.probe;
  const dec = T.decimal;
  const [liqId, setLiqId] = useState('water');
  const [h, setH] = useState(10);
  const [fx, setFx] = useState(0.58);
  const [orient, setOrient] = useState('up');
  const [act, setAct] = useState({ k: 'preset' });
  const [wave, setWave] = useState({ amp: 0, ph: 0 });
  const liq = LIQUIDS[liqId];

  useRafLoop(wave.amp > 0.05, (dt) => {
    setWave((w) => ({ amp: w.amp * Math.exp(-dt / 0.7), ph: w.ph + dt * 5 }));
  });
  const kick = () => setWave((w) => ({ ...w, amp: 2.4 }));

  /* ---- physics */
  const ph = liq.rho * G * h; // Pa
  const pTot = P0 + ph;
  const pBottom = liq.rho * G * D;
  const ghDial = useSmooth(ph / 1000, 0.14);
  const gauge = gaugeRange(liq.rho);
  const presetId = PRESETS.find((p) => p.liq === liqId && Math.abs(p.h - h) < 1e-6)?.id ?? null;

  /* ---- actions */
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setLiqId(p.liq);
    setH(p.h);
    setAct({ k: 'preset' });
    kick();
  };
  const pickLiquid = (id) => {
    if (id === liqId) return;
    setLiqId(id);
    setAct({ k: 'liquid' });
    kick();
  };
  const setDepth = (v) => {
    const nv = clamp(Math.round(v * 100) / 100, 0, D);
    if (Math.abs(nv - h) < 1e-9) return;
    setAct({ k: nv > h ? 'deeper' : 'shallower' });
    setH(nv);
    kick();
  };
  const onDrag = (nh, nfx) => {
    const dh = Math.abs(nh - h) > 1e-9;
    const dx = Math.abs(nfx - fx) > 1e-4;
    if (!dh && !dx) return;
    if (dh) setAct({ k: nh > h ? 'deeper' : 'shallower' });
    else setAct({ k: 'side' });
    setH(nh);
    setFx(nfx);
    kick();
  };
  const pickOrient = (o) => {
    setOrient(o);
    setAct({ k: 'orient', o });
  };

  /* ---- explanation */
  const ex = t.explain;
  const kind = h < 0.05 ? 'surface' : act.k === 'orient' || act.k === 'side' ? act.k : presetId ? presetId : act.k === 'preset' ? 'deeper' : act.k;
  const settled = useSettled(`${kind}|${act.o ?? ''}`, 320);
  const sKind = settled.split('|')[0];
  const hS = fmt(h, 2, dec);
  const pS = fmtG(ph / 1000, 1, dec);
  const text =
    {
      surface: ex.surface,
      water10: ex.water10,
      kero10: ex.kero10,
      sea10: ex.sea10,
      hg76: ex.hg76,
      orient: ex.orient(t.gauge.orientTo[orient], pS),
      side: ex.side(hS, pS),
      deeper: ex.deeper(hS, pS),
      shallower: ex.shallower(hS, pS),
      liquid: ex.liquid(T.liquids[liqId].name, fmtG(liq.rho, 0, dec), hS, pS),
    }[sKind] ?? ex.deeper(hS, pS);
  const tone =
    { surface: '#38bdf8', orient: '#a78bfa', side: '#a78bfa', shallower: '#38bdf8', liquid: '#fbbf24' }[sKind] ??
    (sKind in { water10: 1, kero10: 1, sea10: 1, hg76: 1 } ? '#34d399' : '#f87171');

  /* ---- graph */
  const yMax = niceCeil(((P0 + pBottom) / 1000) * 1.04);
  const line = (rho, add) => [
    { x: 0, y: add / 1000 },
    { x: D, y: (add + rho * G * D) / 1000 },
  ];
  const others = LIQ_IDS.filter((id) => id !== liqId).map((id) => ({
    id: `o-${id}`,
    color: LIQUIDS[id].text,
    points: line(LIQUIDS[id].rho, 0),
    dash: '5 5',
    width: 1.6,
    opacity: 0.55,
  }));

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <GroupLabel>{t.presetsLabel}</GroupLabel>
        <Segmented
          label={t.presetsLabel}
          className="grid-cols-2 lg:grid-cols-4"
          size="lg"
          value={presetId}
          onChange={pickPreset}
          accent="#22d3ee"
          options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub }))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ProbeScene
          T={T}
          liqId={liqId}
          h={h}
          fx={fx}
          orient={orient}
          wave={wave}
          ph={ph}
          pBottom={pBottom}
          showHint={act.k === 'preset' && presetId === 'water10'}
          onDrag={onDrag}
          ariaLabel={plain(t.scene.aria(T.liquids[liqId].name, hS, pS, fmtG(pTot / 1000, 1, dec)))}
        />
        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-200">{t.gauge.title}</p>
            <span className="text-xs text-gray-500">
              <Rich>{t.gauge.reads}</Rich>
            </span>
          </div>
          <div className="mx-auto w-full max-w-[220px]">
            <svg viewBox="0 0 200 178" className="block w-full" role="img" aria-label={plain(t.gauge.aria(pS))}>
              <Dial cx={100} cy={96} r={80} value={ghDial} max={gauge.max} major={gauge.major} unit={T.kPa} caption="ρgh" decimal={dec} />
            </svg>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-black/25 px-2 py-2">
              <p className="text-[11px] text-gray-400">
                <Rich>{t.gauge.hydro}</Rich>
              </p>
              <p className="text-lg font-bold tabular-nums" style={{ color: PC.hydroText }}>
                {pS} <span className="text-xs font-medium text-gray-400">{T.kPa}</span>
              </p>
            </div>
            <div className="rounded-xl bg-black/25 px-2 py-2">
              <p className="text-[11px] text-gray-400">
                <Rich>{t.gauge.total}</Rich>
              </p>
              <p className="text-lg font-bold tabular-nums" style={{ color: PC.totalText }}>
                {fmtG(pTot / 1000, 1, dec)} <span className="text-xs font-medium text-gray-400">{T.kPa}</span>
              </p>
            </div>
          </div>
          <div>
            <GroupLabel>{t.gauge.orientLabel}</GroupLabel>
            <Segmented
              label={t.gauge.orientLabel}
              className="grid-cols-3 lg:grid-cols-1"
              value={orient}
              onChange={pickOrient}
              accent="#a78bfa"
              options={[
                { value: 'up', label: t.gauge.orient.up, icon: ArrowUp },
                { value: 'side', label: t.gauge.orient.side, icon: ArrowRight },
                { value: 'down', label: t.gauge.orient.down, icon: ArrowDown },
              ]}
            />
            <p className="mt-1.5 text-xs leading-snug text-gray-500">
              <Rich>{t.gauge.note}</Rich>
            </p>
          </div>
        </div>
      </div>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.h} symbol="h" value={hS} unit={T.m} accent={PC.ink} textColor="#e2e8f0" sub={t.sub.h} />
        <Readout
          label={t.readouts.hydro}
          symbol="ρgh"
          value={pS}
          unit={T.kPa}
          accent={PC.hydro}
          textColor={PC.hydroText}
          active={!!presetId}
          sub={t.sub.hydro(fmtG(ph, 0, dec))}
        />
        <Readout
          label={t.readouts.total}
          symbol={<Rich>p₀ + ρgh</Rich>}
          value={fmtG(pTot / 1000, 1, dec)}
          unit={T.kPa}
          accent={PC.total}
          textColor={PC.totalText}
          sub={t.sub.total(fmt(pTot / P0, 2, dec))}
        />
        <Readout
          label={t.readouts.rho}
          symbol="ρ"
          value={fmtG(liq.rho, 0, dec)}
          unit={T.kgm3}
          accent={liq.chip}
          textColor={liq.text}
          sub={T.liquids[liqId].name}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <div>
            <GroupLabel>{t.liquidLabel}</GroupLabel>
            <Segmented
              label={t.liquidLabel}
              className="grid-cols-2"
              value={liqId}
              onChange={pickLiquid}
              accent={liq.chip}
              options={LIQ_IDS.map((id) => ({ value: id, label: T.liquids[id].name, sub: `ρ = ${fmtG(LIQUIDS[id].rho, 0, dec)} ${T.kgm3}` }))}
            />
          </div>
          <RangeField
            id="hp-depth"
            label={t.depth}
            symbol="h"
            min={0}
            max={D}
            step={0.01}
            value={h}
            onChange={setDepth}
            accent="#94a3b8"
            display={`${hS} ${T.m}`}
            hint={t.depthHint}
          />
          <div className="grid gap-2">
            <FormulaTile
              tag={t.f.hydro.tag}
              color={PC.hydroText}
              general={t.f.hydro.general}
              filled={t.f.hydro.filled(fmtG(liq.rho, 0, dec), hS, fmtG(ph, 0, dec), pS)}
              ok={!!presetId}
            />
            <FormulaTile
              tag={t.f.total.tag}
              color={PC.totalText}
              general={t.f.total.general}
              filled={t.f.total.filled(fmt(P0 / 1000, 1, dec), pS, fmtG(pTot / 1000, 1, dec))}
            />
          </div>
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <LineGraph
            idKey="hp-probe"
            title={t.graph.title}
            legend={[
              { label: t.graph.hydro, color: PC.hydro },
              { label: t.graph.total, color: '#a78bfa' },
              { label: t.graph.others, color: '#94a3b8', dash: true },
            ]}
            series={[
              ...others,
              { id: 'p0', color: PC.atmText, points: line(0, P0), dash: '2 4', width: 1.4, opacity: 0.7 },
              { id: 'hy', color: PC.hydro, points: line(liq.rho, 0) },
              { id: 'tot', color: '#a78bfa', points: line(liq.rho, P0) },
            ]}
            dots={[
              { id: 'dh', x: h, y: ph / 1000, color: PC.hydro },
              { id: 'dt', x: h, y: pTot / 1000, color: '#a78bfa' },
            ]}
            marker={h}
            xMax={D}
            yMax={yMax}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={300}
            decimal={dec}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function ProbeScene({ T, liqId, h, fx, orient, wave, ph, pBottom, showHint, onDrag, ariaLabel }) {
  const t = T.probe;
  const dec = T.decimal;
  const liq = LIQUIDS[liqId];
  const drag = useRef(null);
  const legend = [
    { label: t.legend.hydro, color: PC.hydro, kind: 'arrow' },
    { label: t.legend.atm, color: PC.atm, kind: 'arrow' },
    { label: t.legend.wall, color: PC.hydro, kind: 'dim' },
    { label: T.liquids[liqId].name, color: liq.deep, kind: 'swatch' },
  ];
  const chips = liq.metal ? <Chip icon={Ruler}>{t.scene.scaleChip}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 1.25, 400, 480) : clamp(W * 0.64, 420, 540))}>
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const pad = narrow ? { l: 62, r: 40, t: 48, b: 16 } : { l: 96, r: 56, t: 62, b: 18 };
        const air = narrow ? 70 : 84;
        const bottomM = 0.4;
        const kV = (H - pad.t - air - pad.b) / (D + bottomM);
        const wallM = 0.3;
        const TW = clamp((W - pad.l - pad.r) / kV - 2 * wallM, 6, 22);
        const k = Math.min(kV, (W - pad.l - pad.r) / (TW + 2 * wallM));
        const used = (TW + 2 * wallM) * k;
        const xL = pad.l + (W - pad.l - pad.r - used) / 2 + wallM * k;
        const xR = xL + TW * k;
        const ys = pad.t + air;
        const yB = ys + D * k;
        const wallPx = wallM * k;
        const rimY = ys - 0.7 * k;
        const scale = liq.metal ? 0.1 : 1;
        const Lmax = narrow ? 34 : 50;
        const aLen = (p) => (p / P_REF) * Lmax * scale;
        const xp = xL + fx * TW * k;
        const yp = ys + h * k;
        const rp = narrow ? 9 : 11;
        const gradId = `hp-liq-${liqId}`;

        /* atmospheric arrows over the surface */
        const tubeX = xp - (narrow ? 14 : 18);
        const atm = [];
        const nA = Math.max(4, Math.round((xR - xL) / (narrow ? 46 : 64)));
        for (let i = 0; i < nA; i += 1) {
          const x = xL + ((i + 0.5) * (xR - xL)) / nA;
          if (Math.abs(x - tubeX) < 14) continue;
          atm.push(<Arrow key={`a${i}`} x1={x} y1={ys - (narrow ? 26 : 32)} x2={x} y2={ys - 3} color={PC.atm} width={2.2} head={8} />);
        }

        /* the wall-pressure diagram outside the left wall */
        const wx = xL - wallPx;
        const wall = [];
        const nW = narrow ? 6 : 8;
        for (let i = 1; i <= nW; i += 1) {
          const d = (D * i) / nW;
          const y = ys + d * k - (i === nW ? 2 : 0);
          const L = aLen(liq.rho * G * d);
          if (L > 4) wall.push(<Arrow key={`w${i}`} x1={wx - 1} y1={y} x2={wx - 1 - L} y2={y} color={PC.hydro} width={2} head={7} opacity={0.85} />);
        }
        const Lb = aLen(pBottom);

        /* the probe's arrows (all directions, equal) */
        const L = aLen(ph);
        const arrows = [];
        if (L > 3) {
          for (let i = 0; i < 8; i += 1) {
            const a = (i * Math.PI) / 4;
            const ux = Math.cos(a);
            const uy = Math.sin(a);
            const onMem = Math.abs(Math.atan2(Math.sin(a - ORIENT[orient]), Math.cos(a - ORIENT[orient]))) < 0.1;
            arrows.push(
              <Arrow
                key={`p${i}`}
                x1={xp + ux * (rp + 5 + L)}
                y1={yp + uy * (rp + 5 + L)}
                x2={xp + ux * (rp + 4)}
                y2={yp + uy * (rp + 4)}
                color={PC.hydro}
                width={onMem ? 3 : 2.3}
                head={onMem ? 10 : 8}
                opacity={onMem ? 1 : 0.62}
              />,
            );
          }
        }

        /* membrane on the side it faces */
        const mA = ORIENT[orient];
        const m1 = { x: xp + rp * Math.cos(mA - 1.0), y: yp + rp * Math.sin(mA - 1.0) };
        const m2 = { x: xp + rp * Math.cos(mA + 1.0), y: yp + rp * Math.sin(mA + 1.0) };
        const bulge = Math.min(4, 1 + (ph / P_REF) * 3 * scale);
        const mc = { x: xp + (rp - bulge) * Math.cos(mA), y: yp + (rp - bulge) * Math.sin(mA) };
        /* the tube leaves the box on the side opposite the membrane, then rises */
        const back = mA + Math.PI;
        const tb = { x: xp + rp * Math.cos(back), y: yp + rp * Math.sin(back) };
        const railY = pad.t + 6;
        const tube = `M${tb.x},${tb.y} C${tb.x + 14 * Math.cos(back)},${tb.y + 14 * Math.sin(back)} ${tubeX},${yp - rp - 18} ${tubeX},${Math.max(railY + 10, yp - rp - 30)} L${tubeX},${railY + 6} Q${tubeX},${railY} ${tubeX + 8},${railY} L${W},${railY}`;

        /* depth dimension next to the probe */
        const dimRight = xp + rp + 60 < xR - 10;
        const dimX = dimRight ? xp + rp + (narrow ? 14 : 22) : xp - rp - (narrow ? 14 : 22);

        const onDown = (e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { rect: e.currentTarget.ownerSVGElement.getBoundingClientRect() };
        };
        const onMove = (e) => {
          if (!drag.current) return;
          const rc = drag.current.rect;
          const qx = ((e.clientX - rc.left) / rc.width) * W;
          const qy = ((e.clientY - rc.top) / rc.height) * H;
          const nh = clamp(Math.round(((qy - ys) / k) * 20) / 20, 0, D);
          const nfx = clamp(Math.round(((qx - xL) / (xR - xL)) * 200) / 200, 0.06, 0.94);
          onDrag(nh, nfx);
        };
        const onUp = () => {
          drag.current = null;
        };

        /* ruler on the right */
        const ruler = [];
        for (let d = 0; d <= D + 1e-9; d += 1) {
          const y = ys + d * k;
          const big = d % 2 === 0;
          ruler.push(<line key={`r${d}`} x1={xR + wallPx + 4} x2={xR + wallPx + (big ? 12 : 8)} y1={y} y2={y} stroke="#64748b" strokeWidth={1} />);
          if (big)
            ruler.push(
              <text key={`rt${d}`} x={xR + wallPx + 15} y={y + 4} fontSize={fs - 1} fill="#475569">
                {d}
              </text>,
            );
        }

        return (
          <g>
            <defs>
              <LiquidGrad id={gradId} liq={liq} />
              <pattern id="hp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="#94a3b8" strokeWidth="2" />
              </pattern>
              <linearGradient id="hp-air" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <rect x={0} y={pad.t - 14} width={W} height={ys - pad.t + 14} fill="url(#hp-air)" />

            {/* the rail the probe hangs from and the tube to the manometer */}
            <line x1={0} x2={W} y1={railY} y2={railY} stroke="#cbd5e1" strokeWidth={5} strokeLinecap="round" />

            {/* tank */}
            <rect x={xL} y={ys} width={xR - xL} height={yB - ys} fill={`url(#${gradId})`} />
            {liq.metal && <rect x={xL} y={ys} width={xR - xL} height={yB - ys} fill="#475569" opacity="0.08" />}
            <path d={surfacePath(xL, xR, ys, wave.amp, wave.ph)} fill="none" stroke={liq.edge} strokeWidth={2} />
            <rect x={xL - wallPx} y={rimY} width={wallPx} height={yB - rimY + wallPx} fill="url(#hp-hatch)" stroke="#475569" strokeWidth={1} />
            <rect x={xR} y={rimY} width={wallPx} height={yB - rimY + wallPx} fill="url(#hp-hatch)" stroke="#475569" strokeWidth={1} />
            <rect x={xL - wallPx} y={yB} width={xR - xL + 2 * wallPx} height={wallPx} fill="url(#hp-hatch)" stroke="#475569" strokeWidth={1} />

            {/* atmosphere */}
            {atm}
            <RichPill
              x={xL + (narrow ? 4 : 10)}
              y={ys - (narrow ? 46 : 54)}
              anchor="start"
              text={t.scene.atm(fmt(P0 / 1000, 1, dec))}
              bg={PC.atm}
              size={fs - 1}
              box={box}
            />

            {/* wall pressure diagram */}
            {Lb > 4 && <polygon points={`${wx},${ys} ${wx - Lb},${yB} ${wx},${yB}`} fill={PC.hydro} opacity="0.08" />}
            {Lb > 4 && <line x1={wx} y1={ys} x2={wx - Lb} y2={yB} stroke={PC.hydro} strokeWidth={1.2} strokeDasharray="4 3" opacity="0.7" />}
            {wall}
            <text x={wx - 6} y={yB + wallPx + fs + 4} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill={PC.hydro}>
              {`${fmtG(pBottom / 1000, 1, dec)} ${T.kPa}`}
            </text>
            {/* depth ruler */}
            {ruler}
            <text x={xR + wallPx + 4} y={ys - 8} fontSize={fs - 1} fontWeight="600" fill="#475569">
              {t.scene.depthAxis}
            </text>

            {/* tube and holder */}
            <path d={tube} fill="none" stroke="#1e293b" strokeWidth={narrow ? 2.4 : 3} strokeLinecap="round" />
            <text x={W - 8} y={railY + fs + 6} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#334155">
              {t.scene.tube}
            </text>

            {/* depth of the probe */}
            {h > 0.15 && (
              <g>
                <line x1={dimX} x2={dimX} y1={ys} y2={yp} stroke={PC.ink} strokeWidth={1.5} />
                <line x1={dimX - 5} x2={dimX + 5} y1={ys} y2={ys} stroke={PC.ink} strokeWidth={1.5} />
                <line x1={dimX - 5} x2={dimX + 5} y1={yp} y2={yp} stroke={PC.ink} strokeWidth={1.5} />
                <RichPill
                  x={dimX + (dimRight ? 6 : -6)}
                  y={(ys + yp) / 2}
                  anchor={dimRight ? 'start' : 'end'}
                  text={t.scene.hTag(fmt(h, 2, dec))}
                  bg={PC.ink}
                  size={fs - 1}
                  box={box}
                />
              </g>
            )}

            {/* arrows on the probe */}
            {arrows}

            {/* the probe: a box with a rubber membrane */}
            <circle cx={xp} cy={yp} r={rp} fill="#e2e8f0" stroke="#334155" strokeWidth={1.6} />
            <circle cx={xp} cy={yp} r={rp * 0.35} fill="#94a3b8" />
            <path d={`M${m1.x},${m1.y} Q${mc.x},${mc.y} ${m2.x},${m2.y}`} fill="none" stroke="#0f172a" strokeWidth={3.4} strokeLinecap="round" />

            {/* pressure at the probe */}
            <RichPill
              x={xp}
              y={yp + rp + L + (narrow ? 18 : 22) > yB - 6 ? yp - rp - L - (narrow ? 18 : 22) : yp + rp + L + (narrow ? 18 : 22)}
              text={t.scene.pTag(fmtG(ph / 1000, 1, dec))}
              bg={PC.hydro}
              size={fs - 1}
              box={box}
            />
            {showHint && (
              <RichPill x={xp + (dimRight ? -1 : 1) * (rp + 48)} y={yp - rp - 14} text={t.scene.drag} bg="#0f172a" size={fs - 1} box={box} />
            )}

            {/* drag handle */}
            <circle
              cx={xp}
              cy={yp}
              r={rp + 16}
              fill="transparent"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </g>
        );
      }}
    </LabScene>
  );
}
