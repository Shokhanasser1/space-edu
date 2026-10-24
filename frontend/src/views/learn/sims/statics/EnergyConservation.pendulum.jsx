import { useMemo, useRef, useState } from 'react';
import { Lightbulb } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import { G } from './EnergyConservation.geometry';
import { Chip, EN, EnergyBars, EnergyGraph, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, SpeedPicker, SvgRich, fmtE, niceCeil, plain, schedule } from './EnergyConservation.parts';

/**
 * Tab 2 — the pendulum: a bob on a string of length L released from rest at
 * angle α₀ rises h₀ = L(1 − cos α₀) above its lowest point. At the ends all
 * its energy is potential (E_p = mgh₀), at the bottom all kinetic, so
 * v_max = √(2gh₀). The motion is integrated exactly (θ'' = −(g/L)·sin θ, no
 * small-angle approximation). Preset L = 2 m, α₀ = 60° → h₀ = 1.00 m,
 * v = 4.43 m/s; m = 0.5 kg → E = 4.90 J.
 */

const PIV = 0; // the pivot is the origin of the picture; the bob hangs at y = −L
const DEG = Math.PI / 180;
const PRESETS = [
  { id: 'main', L: 2, a: 60 },
  { id: 'short', L: 1, a: 60 },
  { id: 'long', L: 3, a: Math.acos(1 - 0.5 / 3) / DEG }, // h₀ = 0.5 m, like the 1 m pendulum
];

function stepPend(state, dt, L, th0) {
  let { th, w } = state;
  const n = Math.max(1, Math.ceil(dt / 0.002));
  const h = dt / n;
  const f = (x) => -(G / L) * Math.sin(x);
  for (let i = 0; i < n; i += 1) {
    const k1t = w;
    const k1w = f(th);
    const k2t = w + (h / 2) * k1w;
    const k2w = f(th + (h / 2) * k1t);
    const k3t = w + (h / 2) * k2w;
    const k3w = f(th + (h / 2) * k2t);
    const k4t = w + h * k3w;
    const k4w = f(th + h * k3t);
    th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    // keep the energy exact: ω² = 2g(cos θ − cos θ₀)/L
    const w2 = (2 * G * (Math.cos(th) - Math.cos(th0))) / L;
    if (w2 > 1e-4) w = Math.sign(w || -th) * Math.sqrt(w2);
  }
  return { th, w };
}

export default function PendulumSim({ T }) {
  const t = T.pend;
  const dec = T.decimal;
  const [L, setL] = useState(2);
  const [alpha, setAlpha] = useState(60);
  const [side, setSide] = useState(-1);
  const [m, setM] = useState(0.5);
  const [speed, setSpeed] = useState(1);
  const th0 = side * alpha * DEG;
  const cfg = `${L}|${alpha}|${side}|${m}`;
  const idle = useMemo(() => ({ cfg, th: th0, w: 0, t: 0, wall: 0, running: false, msg: null }), [cfg, th0]);
  const [raw, setSim] = useState(idle);
  const sim = raw.cfg === cfg ? raw : idle;

  const h0 = L * (1 - Math.cos(alpha * DEG));
  const vmax = Math.sqrt(2 * G * h0);
  const E0 = m * G * h0;

  useRafLoop(sim.running, (dtReal) => {
    setSim((p0) => {
      const p = p0.cfg === cfg ? p0 : idle;
      if (!p.running) return p;
      const next = stepPend(p, dtReal * speed, L, th0);
      const wall = p.wall + dtReal;
      let event = null;
      if (Math.sign(next.th) !== Math.sign(p.th) && p.th !== 0) event = { k: 'bottom' };
      else if (p.w !== 0 && Math.sign(next.w) !== Math.sign(p.w)) event = { k: 'end', h: L * (1 - Math.cos(next.th)) + (L * next.w) ** 2 / (2 * G) };
      const phase = { k: next.th * next.w < 0 ? 'down' : 'up' };
      const msg = schedule(p.msg, { wall, event, phase });
      return { ...p, th: next.th, w: next.w, t: p.t + dtReal * speed, wall, msg };
    });
  });

  const started = sim.t > 0;
  const toggle = () => setSim({ ...sim, running: !sim.running });
  const reset = () => setSim(idle);
  const pickPreset = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setL(p.L);
    setAlpha(p.a);
    setSide(-1);
  };
  const presetId = PRESETS.find((p) => Math.abs(p.L - L) < 1e-9 && Math.abs(p.a - alpha) < 1e-6)?.id ?? null;

  /* ---- physics now */
  const th = sim.th;
  const h = L * (1 - Math.cos(th));
  const vNow = L * Math.abs(sim.w);
  const ek = (m * vNow * vNow) / 2;
  const ep = m * G * h;
  const E = ek + ep;

  /* ---- explanation */
  const ex = t.explain;
  const msg = started ? sim.msg : null;
  const shown = msg ? `${msg.k}@${Math.round(msg.wall * 10)}` : 'idle';
  const base = msg ? msg.k : 'idle';
  const E0s = fmtE(E0, dec);
  const text =
    {
      idle: ex.idle,
      down: ex.down(E0s),
      up: ex.up(fmt(h0, 2, dec)),
      bottom: ex.bottom(E0s, fmt(h0, 2, dec), fmt(vmax, 2, dec)),
      end: ex.end(E0s, fmt(msg?.h ?? h0, 2, dec)),
    }[base] ?? ex.idle;
  const tone = base === 'bottom' ? '#34d399' : base === 'end' ? '#60a5fa' : base === 'idle' ? '#22d3ee' : '#a78bfa';

  /* ---- graph: energy against the sideways position x = L·sin θ */
  const xr = Math.max(0.2, L * Math.sin(alpha * DEG)) * 1.08;
  const theory = useMemo(() => {
    const ptsEp = [];
    const ptsEk = [];
    const xa = L * Math.sin(alpha * DEG);
    for (let i = 0; i <= 120; i += 1) {
      const xx = -xa + (2 * xa * i) / 120;
      const epx = m * G * (L - Math.sqrt(Math.max(0, L * L - xx * xx)));
      ptsEp.push({ x: xx, y: epx });
      ptsEk.push({ x: xx, y: Math.max(0, E0 - epx) });
    }
    return { ptsEp, ptsEk };
  }, [L, alpha, m, E0]);
  const xNow = L * Math.sin(th);
  const yMaxG = niceCeil(E0 * 1.2);

  const bars = [
    { id: 'ep', sym: 'E_p', value: ep, color: EN.epBar, textColor: EN.epText },
    { id: 'ek', sym: 'E_k', value: ek, color: EN.ekBar, textColor: EN.ekText },
    {
      id: 'e',
      sym: 'E',
      value: E,
      textColor: '#f8fafc',
      stack: [
        { value: ep, color: EN.epBar },
        { value: ek, color: EN.ekBar },
      ],
    },
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
        <PlayControls labels={T.common} running={sim.running} done={false} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
        <PendulumScene
          T={T}
          L={L}
          alpha={alpha}
          side={side}
          th={th}
          w={sim.w}
          h={h}
          h0={h0}
          m={m}
          vNow={vNow}
          running={sim.running}
          idleNow={!started}
          speed={speed}
          onDrag={(a, sd) => {
            setAlpha(a);
            setSide(sd);
          }}
          ariaLabel={plain(t.scene.aria(fmt(Math.abs(th) / DEG, 0, dec), fmt(h, 2, dec), fmt(vNow, 2, dec)))}
        />
        <EnergyBars
          title={T.energy.title}
          bars={bars}
          e0={E0}
          e0Label={T.energy.e0(E0s)}
          unit={T.energy.unit}
          decimal={dec}
          note={T.energy.note}
          ariaLabel={plain(T.energy.aria(fmtE(ep, dec), fmtE(ek, dec), fmtE(E, dec)))}
        />
      </div>

      <Explain icon={Lightbulb} id={shown} tone={tone}>
        <Rich>{text}</Rich>
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={t.readouts.theta}
          symbol="θ"
          value={`${fmt(th / DEG, 0, dec).replace('-', '−')}°`}
          accent="#a78bfa"
          textColor="#c4b5fd"
          sub={<Rich>{t.sub.theta(fmt(alpha, alpha % 1 ? 1 : 0, dec))}</Rich>}
        />
        <Readout label={t.readouts.h} symbol="h" value={fmt(h, 2, dec)} unit={T.m} accent={EN.ep} textColor={EN.epText} sub={<Rich>{t.sub.h(fmt(h0, 2, dec))}</Rich>} />
        <Readout
          label={t.readouts.v}
          symbol="v"
          value={fmt(vNow, 2, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          active={base === 'bottom'}
          sub={<Rich>{t.sub.v(fmt(vmax, 2, dec))}</Rich>}
        />
        <Readout label={t.readouts.e} symbol="E" value={fmtE(E, dec)} unit={T.J} accent="#e2e8f0" textColor="#f8fafc" sub={<Rich>{t.sub.e(fmtE(ek, dec), fmtE(ep, dec))}</Rich>} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ec-len"
            label={t.L}
            symbol="L"
            min={0.5}
            max={3}
            step={0.1}
            value={L}
            onChange={setL}
            accent="#a78bfa"
            display={`${fmt(L, 1, dec)} ${T.m}`}
          />
          <RangeField
            id="ec-alpha"
            label={t.alpha}
            symbol={<Rich>α₀</Rich>}
            min={5}
            max={80}
            step={1}
            value={alpha}
            onChange={setAlpha}
            accent="#a78bfa"
            display={`${fmt(alpha, alpha % 1 ? 1 : 0, dec)}°`}
            hint={t.alphaHint}
          />
          <RangeField
            id="ec-pm"
            label={t.mass}
            symbol="m"
            min={0.1}
            max={2}
            step={0.1}
            value={m}
            onChange={setM}
            accent={EN.body}
            display={`${fmt(m, 1, dec)} ${T.kg}`}
            hint={t.massHint}
          />
          <SpeedPicker label={T.speedLabel} value={speed} onChange={setSpeed} />
        </div>
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <EnergyGraph
            title={t.graph.title}
            legend={[
              { label: T.energy.ep, color: EN.epBar },
              { label: T.energy.ek, color: EN.ekBar },
              { label: T.energy.e, color: '#f8fafc' },
            ]}
            series={[
              { id: 'e0', color: '#f8fafc', points: [{ x: -xr, y: E0 }, { x: xr, y: E0 }], width: 2 },
              { id: 'ep', color: EN.epBar, points: theory.ptsEp },
              { id: 'ek', color: EN.ekBar, points: theory.ptsEk },
            ]}
            dots={[
              { id: 'dep', x: xNow, y: ep, color: EN.epBar },
              { id: 'dek', x: xNow, y: ek, color: EN.ekBar },
              { id: 'de', x: xNow, y: E, color: '#f8fafc' },
            ]}
            xMin={-xr}
            xMax={xr}
            yMax={yMaxG}
            xLabel={t.graph.x}
            yLabel={t.graph.y}
            height={250}
            decimal={dec}
            marker={xNow}
            note={t.graph.note}
            ariaLabel={t.graph.aria}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <FormulaTile
              tag={t.f.h0.tag}
              color={EN.epText}
              general={t.f.h0.general}
              filled={t.f.h0.filled(fmt(L, 1, dec), fmt(alpha, alpha % 1 ? 1 : 0, dec), fmt(h0, 2, dec))}
              ok
            />
            <FormulaTile
              tag={t.f.vmax.tag}
              color={PALETTE.velText}
              general={t.f.vmax.general}
              filled={t.f.vmax.filled(fmt(h0, 2, dec), fmt(vmax, 2, dec))}
              ok={base === 'bottom'}
            />
            <FormulaTile tag={t.f.e.tag} color="#e2e8f0" general={t.f.e.general} filled={t.f.e.filled(fmt(m, 1, dec), fmt(h0, 2, dec), E0s)} ok={base === 'end'} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function PendulumScene({ T, L, alpha, side, th, w, h, h0, m, vNow, running, idleNow, speed, onDrag, ariaLabel }) {
  const t = T.pend;
  const dec = T.decimal;
  const drag = useRef(null);
  const legend = [
    { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: t.legend.h, color: EN.ep, kind: 'dim' },
    { label: t.legend.arc, color: '#7c3aed', kind: 'dash' },
    { label: t.legend.zero, color: '#64748b', kind: 'dash' },
  ];
  const chips = speed !== 1 ? <Chip>{T.slowChip(speed)}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 0.8, 260, 340) : clamp(W * 0.6, 380, 500))}>
      {(W, H, narrow) => {
        const pad = narrow ? { l: 12, r: 12, t: 46, b: 22 } : { l: 20, r: 20, t: 62, b: 26 };
        // the box follows the string, so a short or a long pendulum both fill the paper
        const half = Math.max(L * 1.12 + 0.25, 1.1);
        const view = makeView({ x0: -half, x1: half, y0: PIV - L - 0.22 * L - 0.18, y1: PIV + 0.1 * L + 0.18 }, W, H, pad);
        const k = view.k;
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const minPx = narrow ? 22 : 30;
        const cell = niceStep(k, minPx);
        const sup = clamp(0.4 * L * k, 46, 110);
        const pvx = view.sx(0);
        const pvy = view.sy(PIV);
        const Lp = L * k;
        const P = (a) => ({ x: pvx + Lp * Math.sin(a), y: pvy + Lp * Math.cos(a) });
        const a0 = alpha * DEG;
        const left = P(-a0);
        const right = P(a0);
        const bob = P(th);
        const yLow = pvy + Lp;
        const yH0 = yLow - h0 * k;
        const r = (narrow ? 8 : 11) + 6 * Math.cbrt(m / 2);
        const rel = P(side * a0);
        // velocity (tangent), screen coordinates
        const dirx = Math.cos(th) * Math.sign(w || 0);
        const diry = -Math.sin(th) * Math.sign(w || 0);
        const vLen = vNow * 0.22 * k;
        // angle arc
        const ar = narrow ? 26 : 36;
        const arcEnd = { x: pvx + ar * Math.sin(th), y: pvy + ar * Math.cos(th) };
        const dimSide = side;
        const dimX = rel.x + dimSide * (r + (narrow ? 12 : 18));

        const onDown = (e) => {
          if (running) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { rect: e.currentTarget.ownerSVGElement.getBoundingClientRect() };
        };
        const onMove = (e) => {
          if (!drag.current) return;
          const rc = drag.current.rect;
          const qx = ((e.clientX - rc.left) / rc.width) * W;
          const qy = ((e.clientY - rc.top) / rc.height) * H;
          const ang = Math.atan2(qx - pvx, Math.max(1, qy - pvy)) / DEG;
          const sd = ang < 0 ? -1 : 1;
          onDrag(Math.round(clamp(Math.abs(ang), 5, 80)), sd);
        };
        const onUp = () => {
          drag.current = null;
        };

        return (
          <g>
            <defs>
              <radialGradient id="ec-bob" cx="35%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#f9a8d4" />
                <stop offset="100%" stopColor="#be185d" />
              </radialGradient>
              <pattern id="ec-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            <Grid view={view} W={W} H={H} minPx={minPx} />
            <text x={10} y={H - 8} fontSize={fs - 1} fill={PALETTE.muted}>
              {t.scene.cell(fmt(cell, cell >= 1 ? 0 : Number.isInteger(Math.round(cell * 1000) / 100) ? 1 : 2, dec))}
            </text>

            {/* support */}
            <rect x={pvx - sup} y={pvy - 16} width={2 * sup} height={16} fill="url(#ec-hatch)" stroke="#64748b" strokeWidth={1} />
            <line x1={pvx - sup} x2={pvx + sup} y1={pvy} y2={pvy} stroke="#334155" strokeWidth={2.5} />

            {/* zero level and the start level */}
            <line x1={0} x2={W} y1={yLow} y2={yLow} stroke="#64748b" strokeWidth={1.4} strokeDasharray="6 5" />
            <text x={W - 10} y={yLow + 15} textAnchor="end" fontSize={fs - 1} fontWeight="600" fill="#475569">
              <SvgRich text={t.scene.zero} fs={fs - 1} />
            </text>
            <line x1={left.x - 30} x2={right.x + 30} y1={yH0} y2={yH0} stroke={EN.totalInk} strokeWidth={1.3} strokeDasharray="7 5" opacity="0.75" />

            {/* swing arc and the vertical */}
            <path
              d={`M${left.x},${left.y} A${Lp},${Lp} 0 0 0 ${right.x},${right.y}`}
              fill="none"
              stroke="#7c3aed"
              strokeWidth={2}
              strokeDasharray="5 6"
              opacity="0.7"
            />
            <line x1={pvx} x2={pvx} y1={pvy} y2={yLow + 6} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 4" />

            {/* ghost bobs at both ends */}
            {[left, right].map((g, i) => (
              <circle key={i} cx={g.x} cy={g.y} r={r} fill="#fff" fillOpacity="0.6" stroke="#be185d" strokeOpacity="0.5" strokeWidth={1.5} strokeDasharray="3 2" />
            ))}

            {/* h₀ on the release side */}
            <g>
              <line x1={dimX} x2={dimX} y1={yLow} y2={yH0} stroke={EN.totalInk} strokeWidth={1.5} />
              <line x1={dimX - 5} x2={dimX + 5} y1={yLow} y2={yLow} stroke={EN.totalInk} strokeWidth={1.5} />
              <line x1={dimX - 5} x2={dimX + 5} y1={yH0} y2={yH0} stroke={EN.totalInk} strokeWidth={1.5} />
              <Pill x={dimX + dimSide * (narrow ? 40 : 50)} y={yH0 - (yLow - yH0 < 30 ? 14 : -(yLow - yH0) / 2)} text={t.scene.h0Tag(fmt(h0, 2, dec))} bg={EN.totalInk} size={fs - 1} box={box} />
            </g>

            {/* angle */}
            {Math.abs(th) > 2 * DEG && (
              <g>
                <path d={`M${pvx},${pvy + ar} A${ar},${ar} 0 0 ${th > 0 ? 0 : 1} ${arcEnd.x},${arcEnd.y}`} fill="none" stroke="#7c3aed" strokeWidth={1.6} />
                <text
                  x={pvx + (ar + 14) * Math.sin(th / 2)}
                  y={pvy + (ar + 14) * Math.cos(th / 2) + 4}
                  textAnchor="middle"
                  fontSize={fs}
                  fontStyle="italic"
                  fontWeight="700"
                  fill="#6d28d9"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  θ
                </text>
              </g>
            )}

            {/* string and bob */}
            <line x1={pvx} y1={pvy} x2={bob.x} y2={bob.y} stroke="#334155" strokeWidth={1.8} />
            <circle cx={pvx} cy={pvy} r={3.5} fill="#334155" />

            {/* height of the bob */}
            {h > 0.02 && (
              <g>
                <line x1={bob.x} x2={bob.x} y1={bob.y + r} y2={yLow} stroke={EN.ep} strokeWidth={2} />
                <line x1={bob.x - 5} x2={bob.x + 5} y1={yLow} y2={yLow} stroke={EN.ep} strokeWidth={2} />
                {(yLow - bob.y) > 40 && (
                  <Pill
                    x={bob.x + (th < 0 ? 1 : -1) * (narrow ? 36 : 44)}
                    y={(bob.y + r + yLow) / 2}
                    text={t.scene.hTag(fmt(h, 2, dec))}
                    bg={EN.ep}
                    size={fs - 1}
                    box={box}
                  />
                )}
              </g>
            )}

            {running && <circle cx={bob.x} cy={bob.y} r={r + 6} fill={EN.body} className="cl-pulse" opacity="0.25" />}
            <circle cx={bob.x} cy={bob.y} r={r} fill="url(#ec-bob)" stroke="#831843" strokeWidth={1} />

            {/* velocity */}
            {vLen > 6 && (
              <g>
                <Arrow x1={bob.x + dirx * (r + 2)} y1={bob.y + diry * (r + 2)} x2={bob.x + dirx * (r + 2 + vLen)} y2={bob.y + diry * (r + 2 + vLen)} color={PALETTE.vel} width={3} head={11} />
                {vLen > 30 && (
                  <Pill
                    x={bob.x + dirx * (r + vLen + 40)}
                    y={bob.y + diry * (r + vLen + 40) + 12}
                    text={t.scene.vTag(fmt(vNow, 2, dec))}
                    bg={PALETTE.vel}
                    size={fs - 1}
                    box={box}
                  />
                )}
              </g>
            )}

            {/* drag handle */}
            {!running && (
              <g>
                <circle
                  cx={bob.x}
                  cy={bob.y}
                  r={r + 14}
                  fill="transparent"
                  style={{ cursor: 'grab', touchAction: 'none' }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                />
                {idleNow && <Pill x={bob.x + side * -1 * (narrow ? 40 : 50)} y={bob.y - r - 14} text={t.scene.drag} bg="#0f172a" size={fs - 1} box={box} />}
              </g>
            )}
          </g>
        );
      }}
    </LabScene>
  );
}
