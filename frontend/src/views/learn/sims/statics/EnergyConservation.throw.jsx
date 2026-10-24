import { useMemo, useState } from 'react';
import { Lightbulb, Sigma } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, niceStep, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { G } from './EnergyConservation.geometry';
import { Chip, EN, EnergyBars, FormulaTile, GroupLabel, LabScene, PlayControls, Rich, SpeedPicker, SvgRich, fmtE, niceCeil, plain } from './EnergyConservation.parts';

/**
 * Tab 3 — a ball thrown straight up with speed v₀, seen through energy:
 * at the ground E = E_k = mv₀²/2, at the top E = E_p = mgH, so
 * mv₀²/2 = mgH ⇒ H = v₀²/(2g) (the mass cancels), and at any height
 * v = √(v₀² − 2gh). The scene's right half is an energy–height graph on
 * the same height scale as the ball. Preset v₀ = 14 m/s → H = 10.0 m;
 * m = 0.5 kg → E = 49.0 J. No air resistance.
 */

const PRESETS = [
  { id: 'v98', v0: 9.8 },
  { id: 'v14', v0: 14 },
  { id: 'v196', v0: 19.6 },
];
const HOLD = 2.6;

export default function ThrowSim({ T }) {
  const t = T.thr;
  const dec = T.decimal;
  const [v0, setV0] = useState(14);
  const [m, setM] = useState(0.5);
  const [speed, setSpeed] = useState(0.5);
  const cfg = `${v0}|${m}`;
  const idle = useMemo(() => ({ cfg, t: 0, wall: 0, running: false, done: false, ev: null }), [cfg]);
  const [raw, setSim] = useState(idle);
  const sim = raw.cfg === cfg ? raw : idle;

  const Hmax = (v0 * v0) / (2 * G);
  const tUp = v0 / G;
  const Tf = 2 * tUp;
  const E0 = (m * v0 * v0) / 2;

  useRafLoop(sim.running, (dtReal) => {
    setSim((p0) => {
      const p = p0.cfg === cfg ? p0 : idle;
      if (!p.running) return p;
      let tt = p.t + dtReal * speed;
      const wall = p.wall + dtReal;
      let ev = p.ev;
      let running = true;
      let done = false;
      if (p.t < tUp && tt >= tUp) ev = { k: 'top', wall };
      if (tt >= Tf) {
        tt = Tf;
        running = false;
        done = true;
        ev = { k: 'landed', wall };
      }
      return { ...p, t: tt, wall, running, done, ev };
    });
  });

  const started = sim.t > 0;
  const toggle = () => {
    if (sim.done) setSim({ ...idle, running: true });
    else setSim({ ...sim, running: !sim.running });
  };
  const reset = () => setSim(idle);
  const presetId = PRESETS.find((p) => Math.abs(p.v0 - v0) < 1e-9)?.id ?? null;

  /* ---- physics now */
  const tt = sim.t;
  const h = Math.max(0, v0 * tt - (G * tt * tt) / 2);
  const vy = v0 - G * tt; // + up
  const vAbs = Math.abs(vy);
  const ek = (m * vy * vy) / 2;
  const ep = m * G * h;
  const E = ek + ep;
  const topReached = tt >= tUp - 1e-9;

  /* ---- explanation */
  const ex = t.explain;
  let key = 'idle';
  if (sim.done) key = 'landed';
  else if (started && sim.ev && sim.wall - sim.ev.wall < HOLD) key = `${sim.ev.k}@${Math.round(sim.ev.wall * 10)}`;
  else if (started) key = vy > 0 ? 'rise' : 'fall';
  const shown = useSettled(key, key.includes('@') || key === 'idle' || key === 'landed' ? 0 : 250);
  const base = shown.split('@')[0];
  const E0s = fmtE(E0, dec);
  const text =
    {
      idle: ex.idle(E0s),
      rise: ex.rise(E0s),
      top: ex.top(fmt(Hmax, 1, dec), E0s),
      fall: ex.fall,
      landed: ex.landed(fmt(v0, 1, dec), E0s),
    }[base] ?? ex.idle(E0s);
  const tone = base === 'top' ? '#60a5fa' : base === 'landed' ? '#34d399' : base === 'idle' ? '#22d3ee' : '#a78bfa';

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
  const d = t.derive;
  const V0 = fmt(v0, 1, dec);

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
            onChange={(id) => setV0(PRESETS.find((p) => p.id === id).v0)}
            options={PRESETS.map((p) => ({ value: p.id, label: t.presets[p.id].name, sub: t.presets[p.id].sub }))}
          />
        </div>
        <PlayControls labels={T.common} running={sim.running} done={sim.done} started={started} onToggle={toggle} onReset={reset} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
        <ThrowScene
          T={T}
          v0={v0}
          Hmax={Hmax}
          h={h}
          vy={vy}
          E0={E0}
          ek={ek}
          ep={ep}
          running={sim.running}
          started={started}
          speed={speed}
          ariaLabel={plain(t.scene.aria(V0, fmt(h, 1, dec), fmt(vAbs, 1, dec)))}
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
        <Readout label={t.readouts.t} symbol="t" value={fmt(tt, 2, dec)} unit={T.s} accent={PALETTE.time} textColor="#a5f3fc" sub={<Rich>{t.sub.t(fmt(Tf, 2, dec))}</Rich>} />
        <Readout
          label={t.readouts.h}
          symbol="h"
          value={fmt(h, 2, dec)}
          unit={T.m}
          accent={EN.ep}
          textColor={EN.epText}
          active={base === 'top'}
          sub={t.sub.h(fmt(Hmax, 1, dec))}
        />
        <Readout
          label={t.readouts.v}
          symbol="v"
          value={fmt(vAbs, 1, dec)}
          unit={T.ms}
          accent={PALETTE.vel}
          textColor={PALETTE.velText}
          sub={vy > 1e-9 ? t.sub.vUp : vy < -1e-9 ? t.sub.vDown : t.sub.vZero}
        />
        <Readout label={t.readouts.e} symbol="E" value={fmtE(E, dec)} unit={T.J} accent="#e2e8f0" textColor="#f8fafc" sub={<Rich>{t.sub.e(fmtE(ek, dec), fmtE(ep, dec))}</Rich>} />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField
            id="ec-v0"
            label={t.v0}
            symbol={<Rich>v₀</Rich>}
            min={2}
            max={20}
            step={0.2}
            value={v0}
            onChange={setV0}
            accent={PALETTE.vel}
            display={`${V0} ${T.ms}`}
            hint={t.v0Hint(fmt(v0 * 3.6, 0, dec))}
          />
          <RangeField
            id="ec-tm"
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
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-200">
            <Sigma size={16} className="text-cyan-300" aria-hidden="true" /> {d.title}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <FormulaTile tag={d.s1.tag} color={EN.ekText} general={d.s1.general} filled={d.s1.filled(fmt(m, 1, dec), V0, E0s)} ok={started} />
            <FormulaTile tag={d.s2.tag} color={EN.epText} general={d.s2.general} filled={d.s2.filled(fmt(m, 1, dec), fmt(Hmax, 2, dec), E0s)} ok={topReached} />
            <FormulaTile tag={d.s3.tag} color="#e2e8f0" general={d.s3.general} filled={d.s3.filled(V0, fmt(Hmax, 2, dec))} ok={topReached} />
            <FormulaTile
              tag={d.s4.tag}
              color={PALETTE.velText}
              general={d.s4.general}
              filled={d.s4.filled(V0, fmt(h, 2, dec), fmt(vAbs, 1, dec))}
              ok={started && !sim.done}
            />
          </div>
          <p className="mt-2 text-xs leading-snug text-gray-500">{d.note}</p>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function ThrowScene({ T, v0, Hmax, h, vy, E0, ek, ep, running, started, speed, ariaLabel }) {
  const t = T.thr;
  const dec = T.decimal;
  const legend = [
    { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
    { label: t.legend.mg, color: EN.weight, kind: 'arrow' },
    { label: t.legend.ep, color: EN.ep, kind: 'line' },
    { label: t.legend.ek, color: EN.ek, kind: 'line' },
    { label: t.legend.e, color: EN.totalInk, kind: 'line' },
  ];
  const chips = speed !== 1 ? <Chip>{T.slowChip(speed)}</Chip> : null;

  return (
    <LabScene legend={legend} chips={chips} ariaLabel={ariaLabel} height={(W, narrow) => (narrow ? clamp(W * 0.95, 300, 380) : clamp(W * 0.6, 400, 500))}>
      {(W, H, narrow) => {
        const fs = narrow ? 11 : 12;
        const box = { w: W, h: H };
        const padT = narrow ? 52 : 72;
        const groundY = H - (narrow ? 40 : 44);
        const hTop = niceCeil(Math.max(2, Hmax * 1.12));
        const k = (groundY - padT) / hTop;
        const gy = (m) => groundY - m * k;
        const rulerX = narrow ? 34 : 46;
        const ballX = W * (narrow ? 0.27 : 0.25);
        const gx0 = W * (narrow ? 0.47 : 0.45);
        const gx1 = W - (narrow ? 18 : 30);
        const eMax = E0 * 1.18;
        const gx = (e) => gx0 + (e / eMax) * (gx1 - gx0);
        const step = niceStep(k, 30);
        const ticks = [];
        for (let mm = 0; mm <= hTop + 1e-9; mm += step) ticks.push(mm);
        const r = narrow ? 8 : 10;
        const by = gy(h);
        const vLen = Math.abs(vy) * 0.2 * k;
        const yH = gy(Hmax);
        const eTicks = [0, 0.5, 1].map((f) => f * E0);

        return (
          <g>
            <defs>
              <radialGradient id="ec-ball" cx="35%" cy="35%" r="70%">
                <stop offset="0%" stopColor="#fda4af" />
                <stop offset="100%" stopColor="#be123c" />
              </radialGradient>
            </defs>
            <rect width={W} height={H} fill="#fbfcfe" />
            {ticks.map((mm) => (
              <line key={`g${mm}`} x1={rulerX} x2={W} y1={gy(mm)} y2={gy(mm)} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            {/* height ruler */}
            <line x1={rulerX} x2={rulerX} y1={groundY} y2={padT - 16} stroke="#475569" strokeWidth={1.4} />
            {ticks.map((mm) => (
              <g key={`t${mm}`}>
                <line x1={rulerX - 6} x2={rulerX} y1={gy(mm)} y2={gy(mm)} stroke="#475569" strokeWidth={1.2} />
                <text x={rulerX - 9} y={gy(mm) + 4} textAnchor="end" fontSize={fs - 1} fill="#475569">
                  {fmt(mm, Number.isInteger(Math.round(mm * 1e6) / 1e6) ? 0 : 1, dec)}
                </text>
              </g>
            ))}
            <text x={rulerX + 6} y={padT - 18} fontSize={fs - 1} fontWeight="700" fill="#475569">
              {t.scene.hAxis}
            </text>

            {/* energy–height graph, same height scale */}
            <line x1={gx0} x2={gx0} y1={groundY} y2={padT - 16} stroke="#475569" strokeWidth={1.4} />
            {eTicks.map((e) => (
              <line key={`ev${e}`} x1={gx(e)} x2={gx(e)} y1={padT - 10} y2={groundY} stroke={PALETTE.grid} strokeWidth={1} />
            ))}
            <text x={gx0 + 6} y={padT - 18} fontSize={fs} fontWeight="700" fill={EN.totalInk}>
              {t.scene.graph}
            </text>
            <line x1={gx(0)} y1={gy(0)} x2={gx(E0)} y2={yH} stroke={EN.ep} strokeWidth={2.5} />
            <line x1={gx(E0)} y1={gy(0)} x2={gx(0)} y2={yH} stroke={EN.ek} strokeWidth={2.5} />
            <line x1={gx(E0)} y1={gy(0)} x2={gx(E0)} y2={yH} stroke={EN.totalInk} strokeWidth={2.5} />
            <text x={gx(E0) + 6} y={yH + 4} fontSize={fs - 1} fontWeight="700" fill={EN.totalInk}>
              E
            </text>
            {yH < groundY - 40 && (
              <>
                <text x={gx(E0 * 0.82) + 6} y={gy(Hmax * 0.82) + 4} fontSize={fs - 1} fontWeight="700" fill={EN.ep} fontStyle="italic">
                  <SvgRich text="E_p" fs={fs - 1} />
                </text>
                <text x={gx(E0 * 0.82) + 6} y={gy(Hmax * 0.18) + 4} fontSize={fs - 1} fontWeight="700" fill={EN.ek} fontStyle="italic">
                  <SvgRich text="E_k" fs={fs - 1} />
                </text>
              </>
            )}

            {/* H line */}
            <line x1={rulerX} x2={gx1} y1={yH} y2={yH} stroke="#7c3aed" strokeWidth={1.4} strokeDasharray="7 5" />
            <Pill x={(gx0 + gx(E0)) / 2} y={yH - 14} text={t.scene.HTag(fmt(Hmax, 1, dec))} bg="#7c3aed" size={fs - 1} box={box} />

            {/* present height, carried across */}
            {started && h > 0.01 && <line x1={ballX + r + 4} x2={gx(E0)} y1={by} y2={by} stroke={EN.ep} strokeWidth={1.2} strokeDasharray="3 4" opacity="0.8" />}
            <circle cx={gx(ep)} cy={by} r={5} fill={EN.ep} stroke="#fff" strokeWidth={1.5} />
            <circle cx={gx(ek)} cy={by} r={5} fill={EN.ek} stroke="#fff" strokeWidth={1.5} />
            <circle cx={gx(E0)} cy={by} r={5} fill={EN.totalInk} stroke="#fff" strokeWidth={1.5} />

            {/* path of the ball */}
            <line x1={ballX} x2={ballX} y1={groundY} y2={yH} stroke="#cbd5e1" strokeWidth={1.4} strokeDasharray="2 4" />

            {/* ground */}
            <rect x={0} y={groundY} width={W} height={H - groundY} fill="#ecfccb" />
            <line x1={0} x2={W} y1={groundY} y2={groundY} stroke="#65a30d" strokeWidth={2} />
            <text x={8} y={H - 10} fontSize={fs - 1} fontWeight="700" fill="#3f6212">
              <SvgRich text={t.scene.ground} fs={fs - 1} />
            </text>
            {eTicks.map((e) => (
              <g key={`et${e}`}>
                <line x1={gx(e)} x2={gx(e)} y1={groundY} y2={groundY + 5} stroke="#3f6212" strokeWidth={1.2} />
                <text x={gx(e)} y={groundY + 18} textAnchor="middle" fontSize={fs - 1} fill="#3f6212" fontWeight={e === 0 ? 700 : 500}>
                  {fmtE(e, dec)}
                </text>
              </g>
            ))}
            <text x={gx1} y={groundY + 33} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#3f6212">
              {t.scene.eAxis}
            </text>
            <rect x={ballX - r * 1.7} y={groundY - 3} width={r * 3.4} height={5} rx={2} fill="#475569" />

            {/* ball, its velocity and weight */}
            {running && <circle cx={ballX} cy={by - r} r={r + 6} fill="#be123c" className="cl-pulse" opacity="0.3" />}
            <circle cx={ballX} cy={by - r} r={r} fill="url(#ec-ball)" stroke="#881337" strokeWidth={1} />
            {vLen > 5 && (
              <g>
                <Arrow
                  x1={ballX}
                  y1={by - r + (vy > 0 ? -r - 2 : r + 2)}
                  x2={ballX}
                  y2={by - r + (vy > 0 ? -r - 2 - vLen : r + 2 + vLen)}
                  color={PALETTE.vel}
                  width={3}
                  head={10}
                />
                <text
                  x={ballX - 8}
                  y={by - r + (vy > 0 ? -r - vLen - 2 : r + vLen + 14)}
                  textAnchor="end"
                  fontSize={fs + 1}
                  fontStyle="italic"
                  fontWeight="700"
                  fill={PALETTE.vel}
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  v
                </text>
              </g>
            )}
            <Arrow x1={ballX + r + 8} y1={by - r} x2={ballX + r + 8} y2={by - r + (narrow ? 26 : 34)} color={EN.weight} width={2.5} head={9} />
            <text x={ballX + r + 13} y={by - r + (narrow ? 26 : 32)} fontSize={fs} fontStyle="italic" fontWeight="700" fill={EN.weight} stroke="#fff" strokeWidth={3} paintOrder="stroke">
              {t.scene.mgTag}
            </text>
            {started && vLen > 30 && (
              <Pill x={ballX - (narrow ? 44 : 58)} y={by - r} text={t.scene.vTag(fmt(Math.abs(vy), 1, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
            )}
            {!started && <Pill x={ballX - (narrow ? 44 : 58)} y={by - r - 26} text={t.scene.v0Tag(fmt(v0, 1, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />}
          </g>
        );
      }}
    </LabScene>
  );
}
