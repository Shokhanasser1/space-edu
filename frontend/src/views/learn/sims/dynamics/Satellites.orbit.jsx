import { useState } from 'react';
import { Lightbulb, Moon, Mountain, Navigation, Pause, Play, RotateCcw, Satellite, SatelliteDish } from 'lucide-react';
import { Arrow, Btn, Explain, RangeField, Readout, Segmented, clamp, fmt, groupThousands, niceStep, useElementSize, useRafLoop } from '../kit/ui';
import { Grid, PALETTE, makeView } from '../kit/scene';
import {
  GM,
  G_SURF,
  R_E,
  R_KM,
  SIDEREAL_DAY,
  TAU,
  Calc,
  Label,
  Panel,
  Planet,
  SatGlyph,
  SimScene,
  Tag,
  TimeChip,
  duration,
  durationText,
  kmText,
  labelSize,
  niceFactor,
  num,
  sciAlways,
  stepText,
} from './Satellites.parts';

/**
 * The orbit calculator. Gravity supplies the centripetal acceleration of a
 * satellite on a circular orbit of radius r = R + h:
 *   m·v²/r = G·M·m/r²  ⇒  v = √(GM/r) = √(g₀R²/(R + h)),  T = 2πr/v,
 *   g(h) = GM/r².
 * The Earth (R = 6371 km) and the orbit are drawn to scale, seen from above
 * the North Pole; the Earth turns once a sidereal day at the same speed-up as
 * the satellite, so a geostationary satellite visibly keeps pace with it.
 * Checked: ISS h = 400 km → v = 7.67 km/s, T = 92.4 min, g = 8.69 m/s²;
 * GPS 20 200 km → 3.87 km/s, 11.97 h; GEO 35 786 km → 3.07 km/s, 23.93 h;
 * Moon r = 384 400 km → 1.02 km/s, 27.4 days.
 */

const C = PALETTE;
const R_MAX = 3.844e8;
const LOGSPAN = Math.log(R_MAX / R_E);
const sOf = (h) => Math.round((1000 * Math.log((R_E + h) / R_E)) / LOGSPAN);
const hOf = (s) => R_E * Math.exp((s / 1000) * LOGSPAN) - R_E;
const PRESETS = [
  { id: 'surface', h: 0, icon: Mountain, tone: '#22d3ee' },
  { id: 'iss', h: 400e3, icon: Satellite, tone: '#a78bfa' },
  { id: 'gps', h: 20200e3, icon: Navigation, tone: '#60a5fa' },
  { id: 'geo', h: 35786e3, icon: SatelliteDish, tone: '#34d399' },
  { id: 'moon', h: R_MAX - R_E, icon: Moon, tone: '#cbd5e1' },
];
const START = Math.PI / 2;

export default function OrbitSim({ T }) {
  const tx = T.orbit;
  const dec = T.decimal;
  const units = { s: T.s, min: T.common.min, h: T.h, day: T.common.day };
  const [h, setH] = useState(400e3);
  const [preset, setPreset] = useState('iss');
  const [anim, setAnim] = useState({ running: true, phi: 0, rot: 0 });

  const r = R_E + h;
  const v = Math.sqrt(GM / r);
  const per = (TAU * r) / v;
  const g = GM / (r * r);
  const scale = niceFactor(per / 8);

  useRafLoop(anim.running, (dt) => {
    setAnim((p) => (p.running ? { ...p, phi: p.phi + (TAU / per) * scale * dt, rot: p.rot + (TAU / SIDEREAL_DAY) * scale * dt } : p));
  });

  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    setH(p.h);
    setAnim((a) => ({ ...a, phi: 0, rot: 0 }));
  };
  const onSlider = (s) => {
    const match = PRESETS.find((p) => sOf(p.h) === s);
    if (match) {
      setPreset(match.id);
      setH(match.h);
    } else {
      setPreset(null);
      setH(hOf(s));
    }
  };
  const toggle = () => setAnim((a) => ({ ...a, running: !a.running }));
  const reset = () => setAnim({ running: false, phi: 0, rot: 0 });

  const hKm = h / 1000;
  const rKm = r / 1000;
  const vK = fmt(v / 1000, 2, dec);
  const perT = durationText(per, units, dec);
  const perD = duration(per, units, dec);
  const ex = tx.explain;
  const key = preset ?? 'custom';
  const text = {
    surface: ex.surface(vK, perT),
    iss: ex.iss(vK, perT, fmt(86400 / per, 1, dec), fmt(g, 1, dec)),
    gps: ex.gps(vK, perT),
    geo: ex.geo(perT),
    moon: ex.moon(vK, perT),
    custom: ex.custom(kmText(hKm, dec), vK, perT),
  }[key];
  const tone = PRESETS.find((p) => p.id === preset)?.tone ?? '#22d3ee';

  const legend = [
    { label: tx.legend.orbit, color: C.path, kind: 'dash' },
    { label: tx.legend.v, color: C.vel, kind: 'arrow' },
    { label: tx.legend.a, color: C.acc, kind: 'arrow' },
    { label: tx.legend.r, color: C.disp, kind: 'line' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{tx.presetsLabel}</p>
          <Segmented
            label={tx.presetsLabel}
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            size="lg"
            value={preset}
            onChange={pick}
            options={PRESETS.map((p) => ({ value: p.id, label: tx.presets[p.id].name, sub: tx.presets[p.id].sub, icon: p.icon }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 xl:flex">
          <Btn variant="primary" icon={anim.running ? Pause : Play} onClick={toggle} className="xl:min-w-[148px] min-h-[52px] text-[15px]">
            {anim.running ? T.common.pause : T.common.resume}
          </Btn>
          <Btn icon={RotateCcw} onClick={reset} className="min-h-[52px] text-[15px]">
            {T.common.reset}
          </Btn>
        </div>
      </div>

      <SimScene
        legend={legend}
        chip={<TimeChip text={T.common.faster(groupThousands(scale))} />}
        ariaLabel={tx.sceneLabel(kmText(hKm, dec), vK, perT)}
        height={(W, narrow) => (narrow ? W * 1.0 : clamp(W * 0.44, 420, 500))}
      >
        {(W, H, narrow) => <OrbitDrawing W={W} H={H} narrow={narrow} r={r} h={h} preset={preset} phi={START + anim.phi} rot={anim.rot} tx={tx} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={key} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={tx.readouts.v} symbol="v" value={vK} unit={T.common.kms} accent={C.vel} textColor={C.velText} sub={tx.readouts.vSub(groupThousands(v * 3.6))} />
        <Readout
          label={tx.readouts.T}
          symbol="T"
          value={perD.value}
          unit={perD.unit}
          accent={C.time}
          textColor="#a5f3fc"
          sub={per < 1.5 * 86400 ? tx.readouts.perDay(fmt(86400 / per, 1, dec)) : `= ${groupThousands(per)} ${T.s}`}
        />
        <Readout
          label={tx.readouts.g}
          symbol="g"
          value={num(g, dec, 3)}
          unit={T.ms2}
          accent={C.acc}
          textColor={C.accText}
          sub={tx.readouts.gSub(num((100 * g) / G_SURF, dec, 2))}
        />
        <Readout
          label={tx.readouts.r}
          symbol="r"
          value={groupThousands(rKm)}
          unit={T.km}
          accent={C.disp}
          textColor={C.dispText}
          sub={tx.readouts.rSub(kmText(hKm, dec), fmt(r / R_E, 2, dec))}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="space-y-3 lg:col-span-2">
          <RangeField
            id="sat-orbit-h"
            label={tx.h}
            symbol="h"
            min={0}
            max={1000}
            step={1}
            value={sOf(h)}
            onChange={onSlider}
            accent={C.disp}
            display={`${kmText(hKm, dec)} ${T.km}`}
            valueText={`${kmText(hKm, dec)} ${T.km}`}
            hint={tx.hHint}
          />
          <Calc
            title={tx.calc.title}
            rows={[
              { sym: 'r', color: C.dispText, formula: 'R + h', subst: `${groupThousands(R_KM)} + ${kmText(hKm, dec)}`, result: `${groupThousands(rKm)} ${T.km}` },
              {
                sym: 'v',
                color: C.velText,
                formula: '√(GM/r)',
                subst: `√(${sciAlways(GM, dec, 4)} / ${sciAlways(r, dec, 4)})`,
                result: `${groupThousands(v)} ${T.ms} = ${vK} ${T.common.kms}`,
                approx: true,
              },
              {
                sym: 'T',
                color: '#a5f3fc',
                formula: '2πr/v',
                subst: `2π · ${sciAlways(r, dec, 4)} / ${groupThousands(v)}`,
                result: per >= 120 ? `${groupThousands(per)} ${T.s} = ${perT}` : `${groupThousands(per)} ${T.s}`,
                approx: true,
              },
              { sym: 'g', color: C.accText, formula: 'GM/r²', subst: null, result: `${num(g, dec, 3)} ${T.ms2}`, approx: true },
            ]}
            note={tx.calc.note}
          />
        </Panel>
        <Panel className="lg:col-span-3">
          <SpeedCurve r={r} preset={preset} onPick={(rr) => onSlider(clamp(sOf(rr - R_E), 0, 1000))} tx={tx} T={T} />
        </Panel>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- scene */

function OrbitDrawing({ W, H, narrow, r, h, preset, phi, rot, tx, T }) {
  const dec = T.decimal;
  const rKm = r / 1000;
  const E = Math.max(rKm * 1.17, R_KM * 1.42);
  const pad = narrow ? { l: 12, r: 12, t: 46, b: 30 } : { l: 24, r: 24, t: 56, b: 34 };
  const view = makeView({ x0: -E, x1: E, y0: -E, y1: E }, W, H, pad);
  const k = view.k;
  const cx = view.sx(0);
  const cy = view.sy(0);
  const Rp = R_KM * k;
  const rho = rKm * k;
  const fs = narrow ? 11 : 12;
  const bx = { w: W, h: H };
  const sx = cx + rho * Math.cos(phi);
  const sy = cy - rho * Math.sin(phi);
  const tX = -Math.sin(phi);
  const tY = -Math.cos(phi);
  const iX = -Math.cos(phi);
  const iY = Math.sin(phi);
  const isMoon = preset === 'moon';
  const bodyR = isMoon ? Math.max(1737 * k, narrow ? 7 : 9) : 13;
  const L = narrow ? 60 : 80;
  const vLen = L * clamp(Math.sqrt(GM / r) / 7910, 0.25, 1);
  const deg = (-phi * 180) / Math.PI;
  const step = niceStep(k, narrow ? 26 : 32);
  const cellText = T.common.cell(`${stepText(step, dec)} ${T.km}`);

  // observer on the equator, carried round by the Earth's rotation
  const obsA = START + rot;
  const ox = cx + Rp * Math.cos(obsA);
  const oy = cy - Rp * Math.sin(obsA);
  const hPx = rho - Rp;
  const nameText = isMoon ? tx.moonName : preset === 'iss' ? tx.iss : preset === 'gps' ? tx.gps : preset === 'geo' ? tx.geoSat : tx.sat;
  // label of r along the radius, on the side away from the arrows
  const midR = hPx > 26 ? Rp + hPx * 0.5 : rho * 0.5;
  const nX = Math.sin(phi);
  const nY = Math.cos(phi);
  const rText = hPx > 26 ? tx.hTag(kmText(h / 1000, dec)) : tx.rTag(groupThousands(rKm));
  const rSz = labelSize(rText, fs - 1);
  const rOff = 10 + Math.abs(nX) * (rSz.w / 2) + Math.abs(nY) * (rSz.h / 2);

  return (
    <g>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 26 : 32} />
      <Planet kind="earth" cx={cx} cy={cy} r={Rp} rot={rot} />
      {Rp > 5 && Rp <= 14 && <Tag x={cx} y={cy + Rp + fs + 4} text={tx.earth} color="#1e3a8a" size={fs} italic={false} />}
      {Rp > 14 && Rp <= 40 && <Tag x={cx} y={cy + Rp + fs + 6} text={tx.earth} color="#1e3a8a" size={fs} italic={false} />}
      {Rp <= 5 && <Label x={cx + 30} y={cy + 18} text={tx.earth} bg="#fff" color="#1e3a8a" border="#93c5fd" size={fs - 1} box={bx} />}
      {Rp > 40 && <Tag x={cx} y={cy + 5} text={tx.earth} color="#1e3a8a" size={fs + 2} italic={false} />}
      {Rp > 12 && (
        <g>
          <circle cx={ox} cy={oy} r={4} fill="#e11d48" stroke="#fff" strokeWidth="1.5" />
          {preset === 'geo' && <line x1={ox} y1={oy} x2={sx} y2={sy} stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3 4" opacity="0.7" />}
        </g>
      )}

      {/* orbit and radius */}
      <circle cx={cx} cy={cy} r={rho} fill="none" stroke={C.path} strokeOpacity="0.75" strokeWidth="2" strokeDasharray="6 6" />
      <line x1={cx} y1={cy} x2={sx} y2={sy} stroke={C.disp} strokeWidth="2" opacity="0.8" />
      <circle cx={cx} cy={cy} r={2.5} fill={C.ink} />
      {hPx > 26 && (
        <line x1={cx + Rp * Math.cos(phi)} y1={cy - Rp * Math.sin(phi)} x2={sx} y2={sy} stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
      )}
      {rho > 90 && (
        <Label
          x={cx + midR * Math.cos(phi) - nX * rOff}
          y={cy - midR * Math.sin(phi) - nY * rOff}
          text={rText}
          bg="#fff"
          color="#1d4ed8"
          border="#93c5fd"
          size={fs - 1}
          box={bx}
        />
      )}

      {/* vectors */}
      <Arrow x1={sx + iX * (bodyR + 2)} y1={sy + iY * (bodyR + 2)} x2={sx + iX * (bodyR + 2 + L * 0.7)} y2={sy + iY * (bodyR + 2 + L * 0.7)} color={C.acc} width={3.2} head={12} />
      <Arrow x1={sx + tX * (bodyR + 2)} y1={sy + tY * (bodyR + 2)} x2={sx + tX * (bodyR + 2 + vLen)} y2={sy + tY * (bodyR + 2 + vLen)} color={C.vel} width={3.2} head={12} />
      <Tag x={sx + tX * (bodyR + 14 + vLen)} y={sy + tY * (bodyR + 14 + vLen) + 5} text="v" color={C.vel} size={fs + 3} />
      <Tag x={sx + iX * (bodyR + L * 0.7) - tX * 14} y={sy + iY * (bodyR + L * 0.7) - tY * 14 + 5} text="a" color={C.acc} size={fs + 3} />

      {/* the satellite */}
      {isMoon ? (
        <g>
          <circle cx={sx} cy={sy} r={bodyR} fill="#e5e7eb" stroke="#64748b" strokeWidth="1.5" />
          <circle cx={sx - bodyR * 0.3} cy={sy - bodyR * 0.2} r={bodyR * 0.22} fill="#cbd5e1" />
          <circle cx={sx + bodyR * 0.3} cy={sy + bodyR * 0.3} r={bodyR * 0.16} fill="#cbd5e1" />
        </g>
      ) : (
        <SatGlyph x={sx} y={sy} deg={deg} s={narrow ? 0.85 : 1} />
      )}
      <Label x={sx - iX * (bodyR + 20) - tX * 34} y={sy - iY * (bodyR + 20) - tY * 34} text={nameText} bg="#fff" color={C.ink} border="#cbd5e1" size={fs - 1} box={bx} />
      {preset === 'geo' && Rp > 12 && (
        <Label x={sx - iX * (bodyR + 22) + tX * 40} y={sy - iY * (bodyR + 22) + tY * 40} text={tx.together} bg="#e11d48" size={fs - 1} box={bx} />
      )}

      <text x={12} y={H - 12} fontSize={fs - 1} fill={C.muted}>
        {narrow ? tx.dirOnlyShort : tx.dirOnly}
      </text>
      <text x={W - 12} y={H - 12} textAnchor="end" fontSize={fs - 1} fill={C.muted}>
        {cellText}
      </text>
    </g>
  );
}

/* ------------------------------------------------------- v(r) graph */

function SpeedCurve({ r, preset, onPick, tx, T }) {
  const dec = T.decimal;
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 240);
  const H = 300;
  const pad = { l: 40, r: 16, t: 34, b: 30 };
  const L0 = Math.log(R_E);
  const L1 = Math.log(R_MAX);
  const gx = (rr) => pad.l + ((Math.log(rr) - L0) / (L1 - L0)) * (W - pad.l - pad.r);
  const gy = (vk) => H - pad.b - (vk / 8) * (H - pad.t - pad.b);
  const vAt = (rr) => Math.sqrt(GM / rr) / 1000;
  const curve = [];
  for (let i = 0; i <= 120; i += 1) {
    const rr = Math.exp(L0 + (i / 120) * (L1 - L0));
    curve.push(`${gx(rr).toFixed(1)},${gy(vAt(rr)).toFixed(1)}`);
  }
  const xTicks = [10e6, 20e6, 50e6, 100e6, 200e6];
  const pick = (e) => {
    const b = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - b.left) / b.width) * W;
    const f = clamp((px - pad.l) / (W - pad.l - pad.r), 0, 1);
    onPick(Math.exp(L0 + f * (L1 - L0)));
  };
  const cur = { x: gx(r), y: gy(vAt(r)) };
  const dots = PRESETS.map((p) => ({ ...p, x: gx(R_E + p.h), y: gy(vAt(R_E + p.h)) }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{tx.graph.title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: '#34d399' }} /> v = √(GM/r)
        </span>
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={tx.graph.aria}
          className="block cursor-ew-resize touch-none overflow-visible"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) pick(e);
          }}
        >
          {[0, 2, 4, 6, 8].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {v}
              </text>
            </g>
          ))}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {xTicks.map((rr) => (
            <g key={rr}>
              <line x1={gx(rr)} x2={gx(rr)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.06)" />
              <text x={gx(rr)} y={H - 10} textAnchor="middle" fontSize="11" fill="#94a3b8">
                {groupThousands(rr / 1e6)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 10} textAnchor="middle" fontSize="11" fill="#94a3b8">
            {fmt(R_E / 1e6, 1, dec)}
          </text>
          <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
            {tx.graph.x}
          </text>
          <text x={4} y={14} fontSize="11" fill="#64748b">
            {tx.graph.y}
          </text>
          <polyline points={curve.join(' ')} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" />
          {dots.map((d) => (
            <g key={d.id}>
              <circle cx={d.x} cy={d.y} r={preset === d.id ? 5 : 3.5} fill={d.tone} stroke="#0b0b16" strokeWidth="1.5" />
              <text
                x={d.id === 'surface' ? d.x + 8 : d.id === 'moon' ? d.x - 6 : d.id === 'iss' ? d.x + 4 : d.x + 6}
                y={d.id === 'surface' ? d.y - 6 : d.id === 'iss' ? d.y + 20 : d.y - 9}
                textAnchor={d.id === 'moon' ? 'end' : 'start'}
                fontSize="11"
                fontWeight="600"
                fill={preset === d.id ? '#fff' : '#94a3b8'}
              >
                {tx.presets[d.id].short}
              </text>
            </g>
          ))}
          <line x1={cur.x} x2={cur.x} y1={cur.y} y2={H - pad.b} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />
          <line x1={pad.l} x2={cur.x} y1={cur.y} y2={cur.y} stroke="rgba(34,211,238,0.5)" strokeDasharray="3 4" />
          <circle cx={cur.x} cy={cur.y} r="6" fill="#22d3ee" stroke="#0b0b16" strokeWidth="2" />
        </svg>
      </div>
      <p className="mt-1 text-xs text-gray-500">{tx.graph.note}</p>
    </div>
  );
}
