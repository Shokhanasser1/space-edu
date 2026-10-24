import { useState } from 'react';
import { ArrowDownToLine, Lightbulb } from 'lucide-react';
import { Explain, RangeField, Readout, Segmented, clamp, fmt, niceStep, useElementSize, useRafLoop, useSettled } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { COL, CUBE_DEPTH, Cube, G, LIQUIDS, LIQ_SWATCH, MATERIALS, MAT_SWATCH, Panel, PanelTitle, PlayButtons, RichPill, SimScene, TimeChip, Toolbar, massText, numt, pillWidth, rhoText, rich } from './MassDensity.parts';

/**
 * Float or sink: a cube of a chosen material is let go just above a liquid.
 * It floats when its density is smaller than the liquid's, ρ < ρ_liquid,
 * with the share ρ/ρ_liquid of its volume under the surface (ice in water:
 * 0.9); otherwise it sinks. The size of the cube does not matter.
 *
 * The motion is integrated with weight mg, the push of the liquid ρ_l·g·V_under
 * and a drag that lets it settle; the liquid level rises by V_under / A of
 * the tank. Time is slowed down three times (the chip says so).
 */

const BODIES = ['cork', 'oak', 'ice', 'plexi', 'glass', 'al', 'iron', 'copper', 'lead', 'gold'];
const LIQS = ['water', 'sea', 'oil', 'kerosene', 'mercury'];
const TANK = { x0: -26, x1: 26, h: 31, wall: 1.2 }; // cm
const H0 = 0.21; // m, liquid depth before the body goes in
const A_TANK = 0.52 * 0.3; // m², tank floor (52 cm × 30 cm)
const HOLD = 0.03; // m, the body is held this far above the surface
const TIME_SCALE = 1 / 3;
const BODY_X = 5; // cm, the cube hangs right of centre, leaving room for the liquid's label
const boxFor = (narrow) => ({ x0: narrow ? -29 : -36, x1: narrow ? 29 : 36, y0: -3, y1: 41 });
const padFor = (narrow) => (narrow ? { l: 6, r: 6, t: 38, b: 8 } : { l: 18, r: 18, t: 56, b: 12 });
const sceneHeight = (W, narrow) => (narrow ? W * 0.9 : clamp(W * 0.36, 360, 440));
const gridMinPx = (narrow) => (narrow ? 16 : 30);

/** How deep the cube's bottom (y, m) is under the surface, and where the surface is, with the level rise. */
function under(y, a, a2) {
  const d = clamp((H0 - y) / (1 - a2 / A_TANK), 0, a);
  return { d, L: H0 + (a2 * d) / A_TANK };
}

const idleState = (a) => ({ y: H0 + HOLD, v: 0, t: 0, running: false, done: false, started: false, a });

export default function FloatSim({ T }) {
  const tx = T.float;
  const U = T.u;
  const dec = T.decimal;
  const [body, setBody] = useState('ice');
  const [liq, setLiq] = useState('water');
  const [acm, setAcm] = useState(10);
  const [sim, setSim] = useState(() => idleState(0.1));

  const rb = MATERIALS[body].rho;
  const rl = LIQUIDS[liq].rho;
  const a = acm / 100;
  const a2 = a * a;
  const m = rb * a * a2;
  const floats = rb < rl - 1e-9;
  const frac = Math.min(1, rb / rl);
  const dEq = a * frac;
  const yEq = H0 + (a2 * dEq) / A_TANK - dEq;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      let { y, v, t } = p;
      const total = dt * TIME_SCALE;
      const n = Math.min(40, Math.max(1, Math.ceil(total / 0.0008)));
      const h = total / n;
      const kEff = rl * G * a2;
      for (let i = 0; i < n; i += 1) {
        const { d } = under(y, a, a2);
        const mEff = m + 0.3 * rl * a2 * d;
        const c = Math.sqrt(kEff * mEff) * Math.min(1, (2 * d) / a);
        const fq = d > 0 ? -0.5 * 1.05 * rl * a2 * Math.abs(v) * v : 0;
        const F = -m * G + rl * G * a2 * d - c * v + fq;
        v += (F / mEff) * h;
        y += v * h;
        if (y <= 0) {
          y = 0;
          if (v < 0) v = 0;
        }
      }
      t += total;
      let done = false;
      if (floats && Math.abs(v) < 0.002 && Math.abs(y - yEq) < 0.0008) {
        y = yEq;
        v = 0;
        done = true;
      } else if (!floats && y <= 0 && v === 0) done = true;
      if (t > 30) done = true;
      return done ? { ...p, y, v: 0, t, running: false, done: true } : { ...p, y, v, t };
    });
  });

  const reset = (size = a) => setSim(idleState(size));
  const toggle = () =>
    setSim((p) => {
      if (p.done) return { ...idleState(a), running: true, started: true };
      return { ...p, running: !p.running, started: true };
    });
  const pickBody = (id) => {
    setBody(id);
    reset();
  };
  const pickLiq = (id) => {
    setLiq(id);
    reset();
  };
  const changeSize = (v) => {
    setAcm(v);
    reset(v / 100);
  };

  // a size change resets the state with the new edge; until then use the state's edge
  const aNow = sim.a;
  const { d, L } = under(sim.y, aNow, aNow * aNow);
  const share = d / aNow;

  /* ---- words */
  const name = tx.bodies[body];
  const lq = tx.liquids[liq];
  let key = 'idle';
  if (sim.done) key = floats ? 'float' : 'sink';
  else if (sim.started) key = 'moving';
  const settledKey = useSettled(`${key}-${body}-${liq}`, key === 'moving' ? 150 : 0);
  const ex = tx.explain;
  let text;
  if (key === 'float') {
    text = ex.float(name, lq.loc, rhoText(rb), rhoText(rl), fmt(frac, 2, dec), fmt(frac * 100, 0, dec));
    if (body === 'ice' && (liq === 'water' || liq === 'sea')) text = `${text} ${ex.iceberg}`;
    else if (rb > 2000) text = `${text} ${ex.metal}`;
  } else if (key === 'sink') {
    text = ex.sink(name, lq.loc, rhoText(rb), rhoText(rl));
    if (rb < 1000) text = `${text} ${ex.wouldFloat}`;
  } else if (key === 'moving') text = ex.moving(rhoText(rb), rhoText(rl));
  else text = ex.idle(name, rhoText(rb), lq.name, rhoText(rl));
  const tone = key === 'float' ? '#34d399' : key === 'sink' ? '#f87171' : '#22d3ee';

  const legend = [
    { label: tx.legend.liquid(lq.name), color: LIQUIDS[liq].surface, kind: 'square' },
    { label: tx.legend.under, color: COL.float, kind: 'line' },
    { label: tx.legend.above, color: '#64748b', kind: 'line' },
  ];

  const verdictOf = (id) => {
    const r = MATERIALS[id].rho;
    return r < rl ? `${tx.floatsShort} ${fmt((r / rl) * 100, 0, dec)}%` : tx.sinksShort;
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.liquidLabel}
        value={liq}
        onChange={pickLiq}
        cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        accent="#38bdf8"
        options={LIQS.map((id) => ({ value: id, label: tx.liquids[id].name, sub: `${rhoText(LIQUIDS[id].rho)} ${U.kgm3}`, icon: LIQ_SWATCH[id] }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.running}
          started={sim.started}
          done={sim.done}
          onToggle={toggle}
          onReset={() => reset()}
          startLabel={tx.drop}
          againLabel={tx.again}
          startIcon={ArrowDownToLine}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => <TimeChip text={T.common.slower(3)} extra={T.common.cell(cellText(W, narrow, T))} />}
        ariaLabel={tx.sceneLabel(name, rhoText(rb), lq.name, rhoText(rl), fmt(share * 100, 0, dec))}
        height={sceneHeight}
      >
        {(W, H, narrow) => (
          <TankDrawing W={W} H={H} narrow={narrow} sim={sim} a={aNow} d={d} L={L} body={body} liq={liq} floats={floats} T={T} />
        )}
      </SimScene>

      <Explain icon={Lightbulb} id={settledKey} tone={tone}>
        {rich(text)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.body}
          symbol={rich(tx.sym.body)}
          value={rhoText(rb)}
          unit={U.kgm3}
          accent={MATERIALS[body].edge}
          textColor={COL.rhoText}
          sub={`${numt(rb / 1000, dec)} ${U.gcm3} · m = ${massText(m, U, dec)}`}
        />
        <Readout
          label={tx.readouts.liquid}
          symbol={rich(tx.sym.liquid)}
          value={rhoText(rl)}
          unit={U.kgm3}
          accent={LIQUIDS[liq].surface}
          textColor={COL.liquidText}
          sub={`${numt(rl / 1000, dec)} ${U.gcm3}`}
        />
        <Readout
          label={tx.readouts.result}
          value={sim.done ? (floats ? tx.floats : tx.sinks) : '?'}
          accent={sim.done ? (floats ? COL.float : COL.sink) : '#94a3b8'}
          textColor={sim.done ? (floats ? COL.floatText : COL.sinkText) : '#e2e8f0'}
          sub={sim.done ? rich(floats ? tx.readouts.lessSub : tx.readouts.moreSub) : tx.readouts.guess}
          active={sim.done}
        />
        <Readout
          label={tx.readouts.share}
          value={fmt(share * 100, 0, dec)}
          unit="%"
          accent={COL.float}
          textColor={COL.floatText}
          sub={sim.done && floats ? rich(tx.readouts.shareSub(fmt(frac, 2, dec))) : tx.readouts.shareHint}
        />
      </div>

      <Panel>
        <PanelTitle>{tx.bodyLabel}</PanelTitle>
        <Segmented
          label={tx.bodyLabel}
          className="grid-cols-2 sm:grid-cols-5"
          value={body}
          onChange={pickBody}
          accent="#a78bfa"
          options={BODIES.map((id) => ({ value: id, label: tx.bodies[id], sub: `${rhoText(MATERIALS[id].rho)} · ${verdictOf(id)}`, icon: MAT_SWATCH[id] }))}
        />
      </Panel>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2">
          <RangeField id="md-cube" label={tx.size} symbol="a" min={4} max={12} step={1} value={acm} onChange={changeSize} accent="#a78bfa" display={`${acm} ${U.cm}`} hint={tx.sizeHint} />
        </Panel>
        <Panel className="lg:col-span-3">
          <DensityRuler T={T} body={body} liq={liq} />
        </Panel>
      </div>
    </div>
  );
}

function cellText(W, narrow, T) {
  const view = makeView(boxFor(narrow), W, Math.round(sceneHeight(W, narrow)), padFor(narrow));
  return `${numt(niceStep(view.k, gridMinPx(narrow)), T.decimal)} ${T.u.cm}`;
}

/* ----------------------------------------------------------------- scene */

function TankDrawing({ W, H, narrow, sim, a, d, L, body, liq, floats, T }) {
  const tx = T.float;
  const dec = T.decimal;
  const view = makeView(boxFor(narrow), W, H, padFor(narrow));
  const k = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const lq = LIQUIDS[liq];
  const acm = a * 100;
  const s = acm * k;
  const wCube = s * (1 + CUBE_DEPTH.dx);
  const left = X(BODY_X) - wCube / 2;
  const bottom = Y(sim.y * 100);
  const surf = Y(L * 100);
  const inL = X(TANK.x0);
  const inR = X(TANK.x1);
  const floor = Y(0);
  const wall = TANK.wall * k;
  const rim = Y(TANK.h);
  const settled = sim.done;
  const share = d / a;

  // brackets beside the cube once it has settled
  const bx = left + wCube + (narrow ? 8 : 12);
  const topY = bottom - s;
  const underPct = `${fmt(share * 100, 0, dec)}%`;
  const abovePct = `${fmt((1 - share) * 100, 0, dec)}%`;
  const bracket = (y0, y1, color) => (
    <g>
      <line x1={bx} x2={bx} y1={y0} y2={y1} stroke={color} strokeWidth="2" />
      <line x1={bx - 4} x2={bx + 4} y1={y0} y2={y0} stroke={color} strokeWidth="2" />
      <line x1={bx - 4} x2={bx + 4} y1={y1} y2={y1} stroke={color} strokeWidth="2" />
    </g>
  );
  const underLabel = tx.underTag(underPct);
  const aboveLabel = tx.aboveTag(abovePct);
  let yU = (bottom + surf) / 2;
  let yA = (surf + topY) / 2;
  if (yU - yA < 24) {
    const mid = (yU + yA) / 2;
    yU = mid + 12;
    yA = mid - 12;
  }
  const pillX = (txt) => bx + 8 + pillWidth(txt, fs) / 2;

  const bodyInfo = tx.bodyTag(tx.bodies[body], rhoText(MATERIALS[body].rho));
  const liqInfo = tx.liqTag(tx.liquids[liq].name, rhoText(lq.rho));

  return (
    <g>
      <defs>
        <linearGradient id="md-liquid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lq.fill} />
          <stop offset="1" stopColor={lq.deep} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={gridMinPx(narrow)} strong={PALETTE.grid} />

      {/* table */}
      <rect x={0} y={floor + wall} width={W} height={H - floor - wall} fill="#efe2cd" />
      <line x1={0} x2={W} y1={floor + wall} y2={floor + wall} stroke="#b08d5b" strokeWidth="2" />

      {/* back wall of the tank */}
      <rect x={inL} y={rim} width={inR - inL} height={floor - rim} fill="#f1f5f9" opacity="0.6" />

      {/* holder and string */}
      {!sim.started && (
        <g>
          <line x1={left + wCube / 2} x2={left + wCube / 2} y1={0} y2={topY - s * CUBE_DEPTH.dy * 0.5} stroke="#78350f" strokeWidth="1.6" />
          <circle cx={left + wCube / 2} cy={topY - s * CUBE_DEPTH.dy * 0.5} r="2.5" fill="#78350f" />
        </g>
      )}

      <Cube x={left} y={bottom} s={s} mat={body} />

      {/* liquid in front of the cube */}
      <rect x={inL} y={surf} width={inR - inL} height={floor - surf} fill="url(#md-liquid)" opacity={lq.opacity} />
      <line x1={inL} x2={inR} y1={surf} y2={surf} stroke={lq.surface} strokeWidth="2" />
      <line x1={inL} x2={inR} y1={surf + 3} y2={surf + 3} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
      {sim.y * 100 < L * 100 && <CubeOutline x={left} y={bottom} s={s} color={MATERIALS[body].edge} />}

      {/* glass */}
      <rect x={inL - wall} y={rim} width={wall} height={floor - rim + wall} fill="#cbd5e1" opacity="0.85" />
      <rect x={inR} y={rim} width={wall} height={floor - rim + wall} fill="#cbd5e1" opacity="0.85" />
      <rect x={inL - wall} y={floor} width={inR - inL + 2 * wall} height={wall} fill="#cbd5e1" />
      <line x1={inL - wall} x2={inL - wall} y1={rim} y2={floor + wall} stroke="#94a3b8" />
      <line x1={inR + wall} x2={inR + wall} y1={rim} y2={floor + wall} stroke="#94a3b8" />

      {/* labels */}
      <RichPill x={inL + 8 + pillWidth(liqInfo, fs) / 2} y={floor - (narrow ? 14 : 18)} text={liqInfo} bg={lq.surface} size={fs} box={box} />
      <RichPill x={inL + 4 + pillWidth(bodyInfo, fs) / 2} y={rim - (narrow ? 16 : 22)} text={bodyInfo} bg="#fff" color="#0f172a" border="#cbd5e1" size={fs} box={box} />

      {settled && floats && (
        <g>
          {bracket(bottom, surf, COL.float)}
          {surf - topY > 2 && bracket(surf, topY, '#64748b')}
          <line x1={left - 6} x2={bx} y1={surf} y2={surf} stroke={lq.surface} strokeWidth="1.5" strokeDasharray="4 3" />
          <RichPill x={pillX(underLabel)} y={yU} text={underLabel} bg={COL.float} size={fs} box={box} />
          <RichPill x={pillX(aboveLabel)} y={yA} text={aboveLabel} bg="#64748b" size={fs} box={box} />
        </g>
      )}
      {settled && !floats && <RichPill x={left + wCube / 2} y={topY - s * CUBE_DEPTH.dy - (narrow ? 14 : 18)} text={tx.sunkTag} bg={COL.sink} size={fs} box={box} />}
    </g>
  );
}

/** The cube's edges, drawn faintly over the liquid so its shape stays readable under the surface. */
function CubeOutline({ x, y, s, color }) {
  const dx = s * CUBE_DEPTH.dx;
  const dy = s * CUBE_DEPTH.dy;
  return (
    <path
      d={`M${x},${y} L${x + s},${y} L${x + s + dx},${y - dy} L${x + s + dx},${y - s - dy} L${x + dx},${y - s - dy} L${x},${y - s} Z M${x + s},${y} L${x + s},${y - s} L${x},${y - s} M${x + s},${y - s} L${x + s + dx},${y - s - dy}`}
      fill="none"
      stroke={color}
      strokeOpacity="0.55"
      strokeWidth="1.2"
      strokeLinejoin="round"
      pointerEvents="none"
    />
  );
}

/* ----------------------------------------------------------- density ruler */

function DensityRuler({ T, body, liq }) {
  const tx = T.float;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 112;
  const pad = { l: 14, r: 14 };
  const lo = 2; // log10(100)
  const hi = Math.log10(30000);
  const gx = (r) => pad.l + ((Math.log10(r) - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const rb = MATERIALS[body].rho;
  const rl = LIQUIDS[liq].rho;
  const xl = gx(rl);
  const xb = gx(rb);
  const barY = 40;
  const barH = 20;
  const bodyTag = tx.ruler.body(rhoText(rb));
  const liqTag = tx.ruler.liquid(rhoText(rl));
  return (
    <div>
      <p className="text-sm font-semibold text-gray-200">{tx.ruler.title}</p>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tx.ruler.label(rhoText(rb), rhoText(rl))} className="block overflow-visible">
          <rect x={pad.l} y={barY} width={xl - pad.l} height={barH} rx="4" fill={COL.float} opacity="0.85" />
          <rect x={xl} y={barY} width={W - pad.r - xl} height={barH} rx="4" fill={COL.sink} opacity="0.85" />
          {xl - pad.l > 64 && (
            <text x={(pad.l + xl) / 2} y={barY + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {tx.ruler.floats}
            </text>
          )}
          {W - pad.r - xl > 64 && (
            <text x={(xl + W - pad.r) / 2} y={barY + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
              {tx.ruler.sinks}
            </text>
          )}
          {BODIES.map((id) => (
            <line key={id} x1={gx(MATERIALS[id].rho)} x2={gx(MATERIALS[id].rho)} y1={barY + barH - 6} y2={barY + barH} stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
          ))}
          {[100, 1000, 10000].map((r) => (
            <g key={r}>
              <line x1={gx(r)} x2={gx(r)} y1={barY + barH} y2={barY + barH + 5} stroke="#64748b" />
              <text x={gx(r)} y={H - 4} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {rhoText(r)}
              </text>
            </g>
          ))}
          <line x1={xl} x2={xl} y1={barY - 6} y2={barY + barH + 18} stroke="#93c5fd" strokeWidth="2.5" />
          <text x={clamp(xl, 40, W - 40)} y={barY + barH + 30} textAnchor="middle" fontSize="11" fontWeight="600" fill="#93c5fd">
            {liqTag}
          </text>
          <path d={`M${xb},${barY - 2} l-7,-11 l14,0 Z`} fill="#c4b5fd" stroke="#0b0b16" strokeWidth="1" />
          <text x={clamp(xb, 40, W - 40)} y={barY - 18} textAnchor="middle" fontSize="11" fontWeight="600" fill="#c4b5fd">
            {bodyTag}
          </text>
        </svg>
      </div>
      <p className="mt-1 text-xs leading-snug text-gray-500">{tx.ruler.note}</p>
    </div>
  );
}
