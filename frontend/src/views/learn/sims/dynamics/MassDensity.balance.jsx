import { useState } from 'react';
import { Box, Lightbulb, Scale } from 'lucide-react';
import { Explain, RangeField, Readout, Segmented, clamp, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { COL, CUBE_DEPTH, Calc, Cube, MATERIALS, MAT_SWATCH, Panel, PanelTitle, RichPill, SimScene, TimeChip, massText, numt, rhoText } from './MassDensity.parts';

/**
 * Density ρ = m/V on a two-pan balance. Two cubes of chosen materials:
 *   equal volumes (edge a, V = a³) — the denser one is heavier, m = ρV;
 *   equal masses — the balance stays level, but the less dense cube is
 *   bigger, V = m/ρ.
 * The beam settles with a damped swing towards an angle that grows with the
 * mass difference (a balance whose centre of mass is below the pivot).
 * The m–V graph shows each material as a straight line whose slope is ρ.
 */

const MATS = ['cork', 'oak', 'ice', 'water', 'glass', 'al', 'iron', 'copper', 'lead', 'gold'];
const PIV = { x: 0, y: 16.5 }; // cm
const ARM = 24; // cm, pans' posts from the pivot
const BEAM = 30;
const PAN_DY = 6;
const PAN_W = 28;
const TH_MAX = (6 * Math.PI) / 180;
const W0 = 5.5; // rad/s, the beam's swing
const ZETA = 0.32;
const boxFor = (mode, narrow) => ({ x0: narrow ? -40 : -46, x1: narrow ? 40 : 46, y0: -3, y1: mode === 'vol' ? 39 : 49 });
const padFor = (narrow) => (narrow ? { l: 6, r: 6, t: 38, b: 8 } : { l: 18, r: 18, t: 56, b: 12 });
const sceneHeight = (W, narrow) => (narrow ? W * 0.86 : clamp(W * 0.36, 360, 440));
const gridMinPx = (narrow) => (narrow ? 16 : 30);

/** 0.001, 0.000125 m³ from cm³. */
function m3Text(vcm3, dec) {
  const s = String(Number((vcm3 * 1e-6).toPrecision(3)));
  return s.includes('e') ? (vcm3 * 1e-6).toFixed(9).replace(/0+$/, '').replace('.', dec) : s.replace('.', dec);
}

/** A round tick step (1, 2, 2.5, 5 × 10ⁿ) giving about four steps up to v, and the axis end it implies. */
function niceAxis(v) {
  const raw = Math.max(v, 1e-9) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = 10 * p;
  for (const m of [1, 2, 2.5, 5]) {
    if (m * p >= raw) {
      step = m * p;
      break;
    }
  }
  return { step, max: Math.ceil(v / step - 1e-9) * step };
}

export default function BalanceSim({ T }) {
  const tx = T.density;
  const U = T.u;
  const dec = T.decimal;
  const [mode, setMode] = useState('vol');
  const [a, setA] = useState(10); // cm
  const [mKg, setMKg] = useState(1);
  const [left, setLeft] = useState('al');
  const [right, setRight] = useState('iron');
  const [beam, setBeam] = useState({ th: 0, om: 0 });

  const r1 = MATERIALS[left].rho;
  const r2 = MATERIALS[right].rho;
  const vol = mode === 'vol';
  const V1 = vol ? a ** 3 : (mKg / r1) * 1e6; // cm³
  const V2 = vol ? a ** 3 : (mKg / r2) * 1e6;
  const m1 = vol ? r1 * V1 * 1e-6 : mKg; // kg
  const m2 = vol ? r2 * V2 * 1e-6 : mKg;
  const target = TH_MAX * Math.tanh((8 * (m2 - m1)) / (m1 + m2));
  const moving = Math.abs(beam.th - target) > 1e-4 || Math.abs(beam.om) > 1e-3;

  useRafLoop(moving, (dt) => {
    setBeam((b) => {
      let { th, om } = b;
      const n = 4;
      const h = dt / n;
      for (let i = 0; i < n; i += 1) {
        const acc = -W0 * W0 * (th - target) - 2 * ZETA * W0 * om;
        om += acc * h;
        th += om * h;
      }
      if (Math.abs(th - target) < 1e-4 && Math.abs(om) < 1e-3) return { th: target, om: 0 };
      return { th, om };
    });
  });

  /* ---- words */
  const name = (id) => tx.mats[id];
  const mass = (kg) => massText(kg, U, dec);
  const cm3 = (v) => `${numt(v, dec)} ${U.cm3}`;
  const same = left === right;
  const heavier = m2 > m1 * 1.0005 ? 'right' : m1 > m2 * 1.0005 ? 'left' : 'none';
  let key;
  if (vol) key = same ? 'volSame' : 'volDiff';
  else key = same ? 'massSame' : 'massDiff';
  const settledKey = useSettled(`${key}-${left}-${right}-${mode}`, 250);
  const ex = tx.explain;
  let text;
  if (key === 'volDiff') {
    const hr = heavier === 'right';
    text = ex.volDiff(cm3(V1), hr ? tx.sides.right : tx.sides.left, hr ? name(right) : name(left), rhoText(hr ? r2 : r1), numt(Math.max(m1, m2) / Math.min(m1, m2), dec));
  } else if (key === 'massDiff') {
    const bigLeft = V1 > V2;
    text = ex.massDiff(mass(mKg), bigLeft ? tx.sides.left : tx.sides.right, bigLeft ? name(left) : name(right), numt(Math.max(V1, V2) / Math.min(V1, V2), dec));
  } else text = vol ? ex.volSame : ex.massSame;
  const pair = [left, right];
  if (vol && a === 10 && pair.includes('water')) text = `${text} ${ex.litre}`;
  if (pair.includes('water') && pair.includes('ice')) text = `${text} ${ex.iceWater}`;
  const tone = key.endsWith('Same') || !vol ? '#34d399' : '#fbbf24';

  const legend = [
    { label: tx.legend.mass, color: COL.mass, kind: 'dot' },
    { label: tx.legend.vol, color: COL.vol, kind: 'dot' },
    { label: tx.legend.pointer, color: '#0f172a', kind: 'line' },
  ];

  const verdict = heavier === 'none' ? tx.verdict.level : heavier === 'right' ? tx.verdict.right : tx.verdict.left;
  const g1 = r1 / 1000;
  const g2 = r2 / 1000;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.modeLabel}</p>
          <Segmented
            label={tx.modeLabel}
            className="grid-cols-2"
            size="lg"
            value={mode}
            onChange={setMode}
            accent="#a78bfa"
            options={[
              { value: 'vol', label: tx.modes.vol.name, sub: tx.modes.vol.sub, icon: Box },
              { value: 'mass', label: tx.modes.mass.name, sub: tx.modes.mass.sub, icon: Scale },
            ]}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 pb-1.5 pt-2 xl:w-[400px]">
          {vol ? (
            <RangeField
              id="md-edge"
              label={tx.edge}
              symbol="a"
              min={1}
              max={10}
              step={1}
              value={a}
              onChange={setA}
              accent={COL.vol}
              display={`${a} ${U.cm}`}
              hint={tx.edgeHint(cm3(a ** 3), m3Text(a ** 3, dec))}
            />
          ) : (
            <RangeField
              id="md-mass"
              label={tx.mass}
              symbol="m"
              min={0.1}
              max={2}
              step={0.1}
              value={mKg}
              onChange={setMKg}
              accent={COL.mass}
              display={mass(mKg)}
              hint={tx.massHint}
            />
          )}
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip extra={T.common.cell(cellText(W, narrow, mode, T))} />}
        ariaLabel={tx.sceneLabel(name(left), mass(m1), cm3(V1), name(right), mass(m2), cm3(V2), verdict)}
        height={sceneHeight}
      >
        {(W, H, narrow) => (
          <BalanceDrawing W={W} H={H} narrow={narrow} mode={mode} th={beam.th} mats={[left, right]} edges={[Math.cbrt(V1), Math.cbrt(V2)]} masses={[m1, m2]} vols={[V1, V2]} verdict={verdict} heavier={heavier} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settledKey} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={`${tx.sides.leftShort} · ${name(left)}`}
          symbol="ρ₁"
          value={rhoText(r1)}
          unit={U.kgm3}
          accent={MATERIALS[left].edge}
          textColor={COL.rhoText}
          sub={`m₁ = ${mass(m1)} · V₁ = ${cm3(V1)}`}
        />
        <Readout
          label={`${tx.sides.rightShort} · ${name(right)}`}
          symbol="ρ₂"
          value={rhoText(r2)}
          unit={U.kgm3}
          accent={MATERIALS[right].edge}
          textColor={COL.rhoText}
          sub={`m₂ = ${mass(m2)} · V₂ = ${cm3(V2)}`}
        />
        {vol ? (
          <Readout label={tx.readouts.massRatio} symbol="m₂/m₁" value={numt(m2 / m1, dec)} accent={COL.mass} textColor={COL.massText} sub={tx.readouts.massRatioSub} />
        ) : (
          <Readout label={tx.readouts.volRatio} symbol="V₁/V₂" value={numt(V1 / V2, dec)} accent={COL.vol} textColor={COL.volText} sub={tx.readouts.volRatioSub} />
        )}
        <Readout
          label={tx.readouts.balance}
          symbol="Δm"
          value={heavier === 'none' ? '0' : mass(Math.abs(m2 - m1)).split(' ')[0]}
          unit={heavier === 'none' ? U.kg : mass(Math.abs(m2 - m1)).split(' ')[1]}
          accent={heavier === 'none' ? COL.float : '#f59e0b'}
          textColor={heavier === 'none' ? COL.floatText : '#fde68a'}
          sub={verdict}
        />
      </div>

      <Panel className="space-y-3">
        {[
          [tx.pickLeft, left, setLeft],
          [tx.pickRight, right, setRight],
        ].map(([title, value, set]) => (
          <div key={title}>
            <PanelTitle>{title}</PanelTitle>
            <Segmented
              label={title}
              className="grid-cols-2 sm:grid-cols-5"
              value={value}
              onChange={set}
              accent="#a78bfa"
              options={MATS.map((id) => ({ value: id, label: name(id), sub: `${rhoText(MATERIALS[id].rho)} ${U.kgm3}`, icon: MAT_SWATCH[id] }))}
            />
          </div>
        ))}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <Calc
            title={tx.calc.title}
            rows={[
              {
                sym: 'ρ_1',
                color: COL.rhoText,
                formula: 'm_1/V_1',
                subst: `${numt(m1 * 1000, dec)} ${U.g} / ${cm3(V1)}`,
                result: `${numt(g1, dec)} ${U.gcm3} = ${rhoText(r1)} ${U.kgm3}`,
              },
              {
                sym: 'ρ_2',
                color: COL.rhoText,
                formula: 'm_2/V_2',
                subst: `${numt(m2 * 1000, dec)} ${U.g} / ${cm3(V2)}`,
                result: `${numt(g2, dec)} ${U.gcm3} = ${rhoText(r2)} ${U.kgm3}`,
              },
              vol
                ? { sym: 'm_2/m_1', color: COL.massText, formula: 'ρ_2/ρ_1', subst: `${rhoText(r2)} / ${rhoText(r1)}`, result: numt(r2 / r1, dec) }
                : { sym: 'V_1/V_2', color: COL.volText, formula: 'ρ_2/ρ_1', subst: `${rhoText(r2)} / ${rhoText(r1)}`, result: numt(r2 / r1, dec) },
            ]}
            note={tx.calc.note}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <MVGraph T={T} mats={[left, right]} masses={[m1, m2]} vols={[V1, V2]} mode={mode} />
        </Panel>
      </div>
    </div>
  );
}

/** "5 cm": the grid step the drawing uses at this width. */
function cellText(W, narrow, mode, T) {
  const view = makeView(boxFor(mode, narrow), W, Math.round(sceneHeight(W, narrow)), padFor(narrow));
  return `${numt(niceStep(view.k, gridMinPx(narrow)), T.decimal)} ${T.u.cm}`;
}

/* ----------------------------------------------------------------- scene */

function BalanceDrawing({ W, H, narrow, mode, th, mats, edges, masses, vols, verdict, heavier, T }) {
  const tx = T.density;
  const U = T.u;
  const dec = T.decimal;
  const view = makeView(boxFor(mode, narrow), W, H, padFor(narrow));
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const px = X(PIV.x);
  const py = Y(PIV.y);
  const deg = (th * 180) / Math.PI;
  const tableTop = Y(0);

  const pans = [-1, 1].map((s) => {
    const ax = s * ARM * Math.cos(th);
    const ay = PIV.y - s * ARM * Math.sin(th);
    return { s, ax, ay, top: ay + PAN_DY };
  });

  // pointer scale
  const R = 15;
  const ticks = [];
  for (let d = -15; d <= 15; d += 3) {
    const r0 = d === 0 ? R - 0.4 : R + 0.2;
    const r1 = R + 1.6;
    const t = (d * Math.PI) / 180;
    ticks.push(
      <line key={d} x1={X(r0 * Math.sin(t))} y1={Y(PIV.y + r0 * Math.cos(t))} x2={X(r1 * Math.sin(t))} y2={Y(PIV.y + r1 * Math.cos(t))} stroke={d === 0 ? '#0f172a' : '#94a3b8'} strokeWidth={d === 0 ? 2 : 1.2} />,
    );
  }
  const tipR = R + 0.8;
  const tip = { x: X(tipR * Math.sin(th)), y: Y(PIV.y + tipR * Math.cos(th)) };
  const sectorR = R + 2.6;
  const innerR = R - 1.4;
  const sa = (-18 * Math.PI) / 180;
  const sb = (18 * Math.PI) / 180;
  const P = (r, t) => `${X(r * Math.sin(t)).toFixed(1)},${Y(PIV.y + r * Math.cos(t)).toFixed(1)}`;
  const sector = `M${P(innerR, sa)} L${P(sectorR, sa)} A${sectorR * k},${sectorR * k} 0 0 1 ${P(sectorR, sb)} L${P(innerR, sb)} A${innerR * k},${innerR * k} 0 0 0 ${P(innerR, sa)} Z`;

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={gridMinPx(narrow)} strong={PALETTE.grid} />

      {/* table */}
      <rect x={0} y={tableTop} width={W} height={H - tableTop} fill="#efe2cd" />
      <line x1={0} x2={W} y1={tableTop} y2={tableTop} stroke="#b08d5b" strokeWidth="2" />

      {/* scale behind the pointer */}
      <path d={sector} fill="#fff" stroke="#94a3b8" strokeWidth="1.2" />
      {ticks}

      {/* base and pillar */}
      <path d={`M${X(-19)},${Y(0)} L${X(19)},${Y(0)} L${X(16)},${Y(2.6)} L${X(-16)},${Y(2.6)} Z`} fill="#475569" />
      <rect x={X(-1.4)} y={Y(PIV.y)} width={2.8 * k} height={(PIV.y - 2.6) * k} fill="#64748b" />

      {/* posts and pans */}
      {pans.map((p) => (
        <g key={p.s}>
          <rect x={X(p.ax - 0.7)} y={Y(p.top - 1.3)} width={1.4 * k} height={(PAN_DY - 1.3) * k} fill="#64748b" />
          <path d={`M${X(p.ax - PAN_W / 2)},${Y(p.top)} L${X(p.ax + PAN_W / 2)},${Y(p.top)} L${X(p.ax + PAN_W / 2 - 3)},${Y(p.top - 1.5)} L${X(p.ax - PAN_W / 2 + 3)},${Y(p.top - 1.5)} Z`} fill="#94a3b8" stroke="#64748b" />
          <line x1={X(p.ax - PAN_W / 2)} x2={X(p.ax + PAN_W / 2)} y1={Y(p.top)} y2={Y(p.top)} stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}

      {/* beam */}
      <g transform={`rotate(${deg.toFixed(2)} ${px.toFixed(1)} ${py.toFixed(1)})`}>
        <rect x={X(-BEAM)} y={Y(PIV.y + 0.75)} width={2 * BEAM * k} height={1.5 * k} rx={0.75 * k} fill="#334155" />
        {[-20, -10, 10, 20].map((x) => (
          <line key={x} x1={X(x)} x2={X(x)} y1={Y(PIV.y + 0.75)} y2={Y(PIV.y - 0.75)} stroke="#64748b" strokeWidth="1" />
        ))}
        <line x1={px} y1={py} x2={px} y2={Y(PIV.y + tipR)} stroke="#0f172a" strokeWidth={narrow ? 1.6 : 2.2} strokeLinecap="round" />
      </g>
      <circle cx={tip.x} cy={tip.y} r={narrow ? 2.5 : 3.5} fill="#dc2626" />
      <circle cx={px} cy={py} r={Math.max(3, 1.2 * k)} fill="#e2e8f0" stroke="#334155" strokeWidth="2" />

      {/* cubes */}
      {pans.map((p, i) => {
        const s = edges[i] * k;
        const w = s * (1 + CUBE_DEPTH.dx);
        return <Cube key={mats[i] + i} x={X(p.ax) - w / 2} y={Y(p.top) - 1} s={s} mat={mats[i]} />;
      })}

      {/* labels under each pan */}
      {pans.map((p, i) => {
        const x = X(p.s * ARM);
        const y0 = Y(PIV.y - BEAM * Math.sin(TH_MAX)) + (narrow ? 14 : 20);
        const step = narrow ? 22 : 27;
        const rows = narrow
          ? [
              [tx.mTag(i + 1, massText(masses[i], U, dec)), COL.mass],
              [tx.vTag(i + 1, `${numt(vols[i], dec)} ${U.cm3}`), COL.vol],
            ]
          : [
              [tx.mats[mats[i]], null],
              [tx.mTag(i + 1, massText(masses[i], U, dec)), COL.mass],
              [tx.vTag(i + 1, `${numt(vols[i], dec)} ${U.cm3}`), COL.vol],
            ];
        return (
          <g key={`l${i}`}>
            {rows.map(([txt, bg], j) => (
              <RichPill key={j} x={x} y={y0 + j * step} text={txt} bg={bg ?? '#fff'} color={bg ? '#fff' : '#0f172a'} border={bg ? undefined : '#cbd5e1'} size={fs} box={box} />
            ))}
          </g>
        );
      })}

      {!narrow && (
        <RichPill
          x={px}
          y={Y(PIV.y + sectorR) - 16}
          text={verdict}
          bg={heavier === 'none' ? COL.float : '#d97706'}
          size={fs}
          box={box}
        />
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ graph */

function MVGraph({ T, mats, masses, vols, mode }) {
  const tx = T.density;
  const U = T.u;
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const H = 220;
  const W = Math.max(width, 240);
  const pad = { l: 46, r: 16, t: 20, b: 28 };
  const xAx = niceAxis(Math.max(...vols) * 1.15);
  const xMax = xAx.max;
  const big = Math.max(...masses) * 1.15 >= 1;
  const yUnit = big ? 1 : 0.001; // kg or g on the axis
  const yAx = niceAxis((Math.max(...masses) * 1.15) / yUnit);
  const yMax = yAx.max;
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (m) => H - pad.b - (m / yUnit / yMax) * (H - pad.t - pad.b);
  const xTicks = Array.from({ length: Math.round(xMax / xAx.step) + 1 }, (_, i) => i * xAx.step);
  const yTicks = Array.from({ length: Math.round(yMax / yAx.step) + 1 }, (_, i) => i * yAx.step);
  const colors = ['#c4b5fd', '#f9a8d4'];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{tx.graph.title}</p>
        {mats.map((m, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-0.5 w-4 rounded" style={{ background: colors[i] }} /> {tx.mats[m]} · ρ = {rhoText(MATERIALS[m].rho)}
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.graph.label} className="block overflow-visible">
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v * yUnit)} y2={gy(v * yUnit)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v * yUnit) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {numt(v, dec)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {numt(v, dec)}
            </text>
          ))}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.28)" />
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {`V, ${U.cm3}`}
          </text>
          <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
            {`m, ${big ? U.kg : U.g}`}
          </text>
          {mats.map((m, i) => {
            const rho = MATERIALS[m].rho;
            const vEnd = Math.min(xMax, (yMax * yUnit) / (rho * 1e-6));
            const mEnd = rho * vEnd * 1e-6;
            const cx = gx(vols[i]);
            const cy = gy(masses[i]);
            return (
              <g key={i}>
                <line x1={gx(0)} y1={gy(0)} x2={gx(vEnd)} y2={gy(mEnd)} stroke={colors[i]} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={i === 1 && mats[0] === mats[1] ? '6 5' : undefined} />
                <line x1={cx} x2={cx} y1={cy} y2={gy(0)} stroke={colors[i]} strokeOpacity="0.45" strokeDasharray="3 4" />
                <line x1={gx(0)} x2={cx} y1={cy} y2={cy} stroke={colors[i]} strokeOpacity="0.45" strokeDasharray="3 4" />
                <circle cx={cx} cy={cy} r="5" fill={colors[i]} stroke="#0b0b16" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{mode === 'vol' ? tx.graph.noteVol : tx.graph.noteMass}</p>
    </div>
  );
}
