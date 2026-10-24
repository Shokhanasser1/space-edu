import { useState } from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';
import { Btn, Explain, Readout, Segmented, clamp, useElementSize, useSettled, useTween } from '../kit/ui';
import { COL, G, Panel, SimScene, sci, numt, useSvgId } from './UniversalGravitation.parts';

/**
 * Why 1/r²: the "gravity lines" leaving m₁ spread over a sphere of area
 * S = 4πr². A square bundle of 16 lines crosses 1 cell at r/2, 2×2 cells at r
 * and 4×4 cells at 2r, so the cell where m₂ sits gets 16, 4 or 1 line(s):
 * twice the distance — four times the area — a quarter of the force. Twice
 * m₁ means twice the lines; twice m₂ means twice as much mass for each line
 * to pull. F/F₀ = (k₁·k₂)/k_r². Example numbers: two people, 60 kg and
 * 50 kg, 1 m apart, F₀ = 2.0·10⁻⁷ N.
 */

const F0 = (G * 60 * 50) / 1; // N
const PHI = (24 * Math.PI) / 180;
const PLANES = [0.5, 1, 2];
const GRID = [0, 1, 2, 3].map((i) => 2 * ((i + 0.5) / 4 - 0.5)); // ray slopes (cells per unit x) of one 4×4 bundle
const SHIFTS = [0, 1 / 8, -1 / 8];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** F/F₀ as an exact fraction: numerator, denominator. */
function ratio(k1, k2, kr) {
  const n = k1 * k2 * (kr === 0.5 ? 4 : 1);
  const d = kr === 2 ? 4 : 1;
  const c = gcd(n, d);
  return [n / c, d / c];
}
const fracText = ([n, d]) => (d === 1 ? `${n}` : `${n}/${d}`);
const krText = (kr) => (kr === 0.5 ? '½' : `${kr}`);

export default function ScalingSim({ T }) {
  const tx = T.scale;
  const dec = T.decimal;
  const [k1, setK1] = useState(1);
  const [k2, setK2] = useState(1);
  const [kr, setKr] = useState(1);
  const [probe, setProbe] = useTween(1);

  const [n, d] = ratio(k1, k2, kr);
  const factor = n / d;
  const density = (16 * k1) / (4 * kr * kr);
  const area = kr * kr;

  /* ---- explanation */
  const changed = [k1 !== 1, k2 !== 1, kr !== 1].filter(Boolean).length;
  let key = 'base';
  if (changed > 1) key = 'combo';
  else if (kr === 2) key = 'r2';
  else if (kr === 0.5) key = 'rHalf';
  else if (k1 !== 1) key = 'm1';
  else if (k2 !== 1) key = 'm2';
  // debounce the whole state, so the explanation changes once per settled choice
  const sig = useSettled(`${key}|${k1}|${k2}|${kr}`, 300);
  const settled = sig.split('|')[0];
  const ex = tx.explain;
  let text;
  if (settled === 'm1') text = ex.m1(k1, 16 * k1);
  else if (settled === 'm2') text = ex.m2(k2);
  else if (settled === 'combo') text = ex.combo(`${k1} · ${k2} / ${krText(kr)}²`, fracText([n, d]));
  else text = ex[settled] ?? ex.base;
  const tone = settled === 'base' ? '#22d3ee' : settled.startsWith('r') ? '#f87171' : settled === 'combo' ? '#facc15' : '#a78bfa';

  const groups = [
    { id: 'm1', label: tx.m1, value: k1, set: setK1, accent: COL.b1, opts: [1, 2, 3].map((k) => ({ value: k, label: `×${k}`, sub: `${60 * k} ${T.kg}` })) },
    { id: 'm2', label: tx.m2, value: k2, set: setK2, accent: COL.b2, opts: [1, 2, 3].map((k) => ({ value: k, label: `×${k}`, sub: `${50 * k} ${T.kg}` })) },
    {
      id: 'r',
      label: tx.r,
      value: kr,
      set: (k) => {
        setKr(k);
        setProbe(k, 650);
      },
      accent: '#22d3ee',
      opts: [0.5, 1, 2].map((k) => ({ value: k, label: `×${krText(k)}`, sub: `${numt(k, dec)} ${T.m}` })),
    },
  ];
  const reset = () => {
    setK1(1);
    setK2(1);
    setKr(1);
    setProbe(1, 650);
  };

  const legend = [
    { label: tx.legend.lines, color: '#7c3aed', kind: 'line' },
    { label: tx.legend.cell, color: COL.b2, kind: 'dot' },
    { label: tx.legend.area, color: '#0284c7', kind: 'dash' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-3">
          {groups.map((gr) => (
            <div key={gr.id}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{gr.label}</p>
              <Segmented label={gr.label} className="grid-cols-3" value={gr.value} onChange={gr.set} accent={gr.accent} options={gr.opts} />
            </div>
          ))}
        </div>
        <Btn icon={RotateCcw} onClick={reset} disabled={changed === 0} className="min-h-[52px] text-[15px]">
          {T.common.reset}
        </Btn>
      </div>

      <SimScene
        legend={legend}
        chip={<span className="font-medium">{tx.chip}</span>}
        ariaLabel={tx.sceneLabel(k1, k2, krText(kr), fracText([n, d]))}
        height={(W, narrow) => (narrow ? clamp(W * 1.05, 330, 420) : 410)}
      >
        {(W, H, narrow) => <Spreading W={W} H={H} narrow={narrow} k1={k1} k2={k2} kr={kr} probe={probe} tx={tx} />}
      </SimScene>

      <Explain icon={Lightbulb} id={sig} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.force} symbol="F/F₀" value={fracText([n, d])} unit="× F₀" accent={COL.force} textColor={COL.forceText} sub={`= ${numt(factor, dec, 3)} · F₀`} active={factor !== 1} />
        <Readout label={tx.readouts.density} symbol="∝ m₁/r²" value={numt(density, dec)} unit={tx.perCell} accent="#7c3aed" textColor="#c4b5fd" sub={tx.readouts.densitySub} />
        <Readout label={tx.readouts.area} symbol="S = 4πr²" value={area === 0.25 ? '1/4' : numt(area, dec)} unit="× S₀" accent="#0284c7" textColor="#7dd3fc" sub={tx.readouts.areaSub(krText(kr))} />
        <Readout label={tx.readouts.example} symbol="F" value={sci(F0 * factor, dec)} unit={T.N} accent="#e2e8f0" sub={tx.readouts.exampleSub(sci(F0, dec))} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-3">
          <Compare factor={factor} frac={fracText([n, d])} tx={tx} />
        </Panel>
        <Panel className="lg:col-span-2">
          <p className="text-sm font-semibold text-gray-200">{tx.rule.title}</p>
          <p className="mt-2 rounded-xl bg-black/25 px-3 py-2.5 font-serif text-lg italic text-white tabular-nums">
            F = F₀ · <span style={{ color: COL.b1Text }}>{k1}</span> · <span style={{ color: COL.b2Text }}>{k2}</span> / <span className="text-cyan-300">{krText(kr)}</span>² ={' '}
            <span className="font-sans font-bold not-italic">F₀ · {fracText([n, d])}</span>
          </p>
          <ul className="mt-2 space-y-1 text-sm leading-snug text-gray-400">
            {tx.rule.items.map((it) => (
              <li key={it}>• {it}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- comparison */

function Compare({ factor, frac, tx }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const room = W - 140;
  const L0 = Math.min(120, room / Math.max(1, factor));
  const LF = L0 * factor;
  const H = 104;
  const arrow = (y, L, color, label, dash) => (
    <g>
      <text x={0} y={y + 5} fontSize="14" fontStyle="italic" fontWeight="700" fill={color}>
        {label}
      </text>
      <line x1={44} y1={y} x2={44 + Math.max(L - 12, 1)} y2={y} stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={dash} />
      <path d={`M${44 + Math.max(L, 8)},${y} l-13,-7 l0,14 Z`} fill={color} />
    </g>
  );
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{tx.compare.title}</p>
      <div ref={ref} className="mt-3 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.compare.aria(frac)} className="block">
          {arrow(26, L0, '#94a3b8', 'F₀')}
          {arrow(76, LF, '#f87171', 'F')}
          <text x={W} y={80} textAnchor="end" fontSize="13" fontWeight="700" fill="#fecaca">
            {`F = ${frac} · F₀`}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{tx.compare.note}</p>
    </div>
  );
}

/* ----------------------------------------------------------- the picture */

function Spreading({ W, H, narrow, k1, k2, kr, probe, tx }) {
  const gid = useSvgId('ugs');
  const ox = narrow ? 30 : 96;
  const Kx = (W - ox - (narrow ? 70 : 160)) / 2.2;
  const Ku = Math.min((H - (narrow ? 112 : 120)) / 5.3, Kx * 0.36);
  const Kw = 0.72 * Ku;
  const cy = H / 2 + (narrow ? 6 : 10);
  const fs = narrow ? 10.5 : 12;
  const P = (x, u, w) => ({ X: ox + x * Kx + w * Kw * Math.cos(PHI), Y: cy - u * Ku - w * Kw * Math.sin(PHI) });
  const quad = (x, u0, u1, w0, w1) => {
    const a = P(x, u0, w0);
    const b = P(x, u1, w0);
    const c = P(x, u1, w1);
    const e = P(x, u0, w1);
    return `M${a.X.toFixed(1)},${a.Y.toFixed(1)} L${b.X.toFixed(1)},${b.Y.toFixed(1)} L${c.X.toFixed(1)},${c.Y.toFixed(1)} L${e.X.toFixed(1)},${e.Y.toFixed(1)} Z`;
  };

  // the rays: k₁ interleaved 4×4 bundles
  const rays = [];
  for (let s = 0; s < k1; s += 1)
    for (const a of GRID) for (const b of GRID) rays.push({ a: a + SHIFTS[s], b: b + SHIFTS[s], s });
  const xEnd = 2.3;
  const apex = P(0, 0, 0);

  // where m₂ sits: the centre of one cell, sliding between the planes
  const along = clamp((probe - 0.5) / 0.5, 0, 1);
  const pu = 0.5 * along;
  const pw = -0.5 * along;
  const pc = P(probe, pu, pw);
  const cellU = probe <= 0.5 ? [-0.5, 0.5] : [0, 1];
  const cellW = probe <= 0.5 ? [-0.5, 0.5] : [-1, 0];
  const onPlane = PLANES.includes(probe);
  const inCell = (u, w) => u > cellU[0] && u < cellU[1] && w > cellW[0] && w < cellW[1];

  const srcR = (narrow ? 9 : 12) * Math.cbrt(k1);
  const probeR = Ku * 0.2 * Math.cbrt(k2);
  const label = { 0.5: 'r/2', 1: 'r', 2: '2r' };
  const areaLabel = { 0.5: 'S₀/4', 1: 'S₀', 2: '4S₀' };

  return (
    <g>
      <style>{`@keyframes ${gid}-flow{to{stroke-dashoffset:-28}}.${gid}-flow{animation:${gid}-flow 1.4s linear infinite}@media (prefers-reduced-motion:reduce){.${gid}-flow{animation:none}}`}</style>
      <defs>
        <radialGradient id={`${gid}-src`} cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#cffafe" />
          <stop offset="100%" stopColor="#0e7490" />
        </radialGradient>
        <radialGradient id={`${gid}-probe`} cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#be185d" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />

      {/* the axis from m₁ */}
      <line x1={apex.X} y1={apex.Y} x2={P(xEnd + 0.1, 0, 0).X} y2={apex.Y} stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="4 5" />

      {/* rays */}
      {rays.map((ry) => {
        const e = P(xEnd, ry.a * xEnd, ry.b * xEnd);
        return <line key={`r${ry.s}${ry.a}${ry.b}`} x1={apex.X} y1={apex.Y} x2={e.X} y2={e.Y} stroke="#7c3aed" strokeOpacity="0.32" strokeWidth="1" />;
      })}
      {rays.map((ry) => {
        const e = P(xEnd, ry.a * xEnd, ry.b * xEnd);
        return (
          <line key={`f${ry.s}${ry.a}${ry.b}`} x1={apex.X} y1={apex.Y} x2={e.X} y2={e.Y} stroke="#a78bfa" strokeOpacity="0.55" strokeWidth="1.4" strokeDasharray="3 11" className={`${gid}-flow`} />
        );
      })}

      {/* planes at r/2, r, 2r with their cells */}
      {PLANES.map((x) => {
        const active = x === kr;
        const lines = [];
        if (x >= 1) {
          for (let v = -x + 1; v <= x - 1; v += 1) {
            const a = P(x, v, -x);
            const b = P(x, v, x);
            const c = P(x, -x, v);
            const e = P(x, x, v);
            lines.push(<line key={`u${v}`} x1={a.X} y1={a.Y} x2={b.X} y2={b.Y} />);
            lines.push(<line key={`w${v}`} x1={c.X} y1={c.Y} x2={e.X} y2={e.Y} />);
          }
        }
        const bottom = P(x, -x, -x);
        const top = P(x, x, x);
        const midX = P(x, 0, 0).X;
        return (
          <g key={x}>
            <path d={quad(x, -x, x, -x, x)} fill={active ? '#e0f2fe' : '#f1f5f9'} fillOpacity={active ? 0.72 : 0.5} stroke={active ? '#0284c7' : '#94a3b8'} strokeWidth={active ? 2 : 1.2} />
            <g stroke={active ? '#38bdf8' : '#cbd5e1'} strokeWidth="1">{lines}</g>
            {active && onPlane && <path d={quad(x, cellU[0], cellU[1], cellW[0], cellW[1])} fill={COL.b2} fillOpacity="0.2" stroke={COL.b2} strokeWidth="2" />}
            {rays.map((ry) => {
              const p = P(x, ry.a * x, ry.b * x);
              const hit = active && onPlane && inCell(ry.a * x, ry.b * x);
              return <circle key={`d${ry.s}${ry.a}${ry.b}`} cx={p.X} cy={p.Y} r={hit ? 3.4 : active ? 2.6 : 1.9} fill={hit ? '#6d28d9' : '#7c3aed'} fillOpacity={hit ? 1 : active ? 0.75 : 0.45} />;
            })}
            <text x={midX} y={bottom.Y + (narrow ? 18 : 22)} textAnchor="middle" fontSize={fs + 2} fontWeight="700" fill={active ? '#0369a1' : COL.muted}>
              {label[x]}
            </text>
            <text x={midX} y={bottom.Y + (narrow ? 32 : 39)} textAnchor="middle" fontSize={fs - 0.5} fill={active ? '#0369a1' : COL.muted}>
              {tx.areaTag(areaLabel[x])}
            </text>
            <text x={midX} y={top.Y - 9} textAnchor="middle" fontSize={fs - 0.5} fontWeight={active ? 700 : 500} fill={active ? '#6d28d9' : '#94a3b8'}>
              {tx.cellTag((16 * k1) / (4 * x * x))}
            </text>
          </g>
        );
      })}

      {/* m₂ */}
      <g pointerEvents="none">
        <circle cx={pc.X} cy={pc.Y} r={probeR} fill={`url(#${gid}-probe)`} stroke="#fff" strokeWidth="1.5" opacity="0.92" />
        <text x={pc.X} y={pc.Y + probeR + fs + 2} textAnchor="middle" fontSize={fs} fontWeight="700" fill={COL.b2} stroke="#fff" strokeWidth="3" paintOrder="stroke">
          {k2 > 1 ? `m₂ ×${k2}` : 'm₂'}
        </text>
      </g>

      {/* m₁ */}
      <circle cx={apex.X} cy={apex.Y} r={srcR} fill={`url(#${gid}-src)`} stroke="#fff" strokeWidth="1.5" />
      <text x={apex.X} y={apex.Y + srcR + fs + 4} textAnchor="middle" fontSize={fs + 1} fontWeight="700" fill="#0e7490" stroke="#fff" strokeWidth="3" paintOrder="stroke">
        {k1 > 1 ? `m₁ ×${k1}` : 'm₁'}
      </text>
      <text x={apex.X} y={apex.Y + srcR + 2 * fs + 8} textAnchor="middle" fontSize={fs - 1} fill={COL.muted}>
        {tx.linesTag(16 * k1)}
      </text>
    </g>
  );
}
