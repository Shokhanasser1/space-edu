import { CircleCheck, CircleHelp, CircleX, Lightbulb, ZoomIn, ZoomOut } from 'lucide-react';
import { Explain, Pill, RangeField, Readout, Segmented, clamp, fmt, groupThousands, niceStep, useElementSize, useTween } from './VariantClassicLab.ui';

/**
 * "Moddiy nuqta": one bus, seen at every scale from the whole Tashkent –
 * Samarkand road down to the garage gate. On the map it is a dot; at the
 * gate its size decides whether it fits. World units are metres, with the
 * middle garage gate at the origin (x east, y north). The map is schematic
 * but to scale: the cities are placed by their real latitude and longitude.
 */

const BUS = { len: 12, w: 2.55, cx: 0, cy: -10 };
const GATE_W = 3.6;
const W_MAX = 520000; // m
const W_MIN = 50; // m
const LN_MAX = Math.log(W_MAX);
const LN_MIN = Math.log(W_MIN);
const zToW = (z) => Math.exp(LN_MAX + (LN_MIN - LN_MAX) * z);
const wToZ = (w) => (LN_MAX - Math.log(w)) / (LN_MAX - LN_MIN);

const KM = 1000;
const SAMARKAND = { x: -3 * KM, y: -2.5 * KM, r: 6.5 * KM };
const TASHKENT = { x: 193 * KM, y: 181.5 * KM, r: 13 * KM };
const JIZZAKH = { x: 71 * KM, y: 49.5 * KM, r: 3 * KM };
const GULISTAN = { x: 151 * KM, y: 90.5 * KM, r: 2.5 * KM };
const ROAD = [
  [70, -95],
  [1800, 400],
  [27 * KM, 15.5 * KM],
  [JIZZAKH.x, JIZZAKH.y],
  [107 * KM, 59.5 * KM],
  [GULISTAN.x, GULISTAN.y],
  [172 * KM, 137.5 * KM],
  [TASHKENT.x, TASHKENT.y],
];
const ROAD_LEN = ROAD.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - ROAD[i][0], p[1] - ROAD[i][1]), 0);
const MID = { x: (SAMARKAND.x + TASHKENT.x) / 2, y: (SAMARKAND.y + TASHKENT.y) / 2 };
const FOCUS = { x: 0, y: -6 };

const PRESET_W = { map: W_MAX, city: 24 * KM, street: 700, garage: 60 };

/** 1 when w <= a, 0 when w >= b, log-interpolated between. */
function fadeBelow(w, a, b) {
  if (w <= a) return 1;
  if (w >= b) return 0;
  return 1 - (Math.log(w) - Math.log(a)) / (Math.log(b) - Math.log(a));
}

function hash(i) {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function fmtLen(m, decimal) {
  if (m >= 10 * KM) return `${groupThousands(m / KM)} km`;
  if (m >= KM) return `${fmt(m / KM, 1, decimal)} km`;
  return `${groupThousands(m)} m`;
}

export default function PointSim({ t, decimal }) {
  const [wrapRef, { width: sceneW }] = useElementSize();
  const [z, setZ] = useTween(0);
  const Wv = zToW(z);
  const N = Wv / BUS.len;
  const verdict = N >= 150 ? 'point' : N < 12 ? 'body' : 'maybe';
  const nTxt = groupThousands(N);
  const activePreset = Object.entries(PRESET_W).find(([, w]) => Math.abs(wToZ(w) - z) < 0.004)?.[0] ?? null;
  const tones = { point: '#34d399', maybe: '#fbbf24', body: '#fb7185' };
  const VIcon = { point: CircleCheck, maybe: CircleHelp, body: CircleX }[verdict];

  return (
    <div ref={wrapRef} className="space-y-3 sm:space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{t.presetsLabel}</p>
        <Segmented
          label={t.presetsLabel}
          className="grid-cols-2 md:grid-cols-4"
          size="lg"
          value={activePreset}
          onChange={(id) => setZ(wToZ(PRESET_W[id]), 1100)}
          options={t.presets.map((p) => ({ value: p.id, label: p.label, sub: p.sub }))}
        />
      </div>

      <PointScene t={t} Wv={Wv} decimal={decimal} />

      <Explain icon={Lightbulb} id={verdict} tone={tones[verdict]}>
        {verdict === 'body' ? t.explain.body : verdict === 'maybe' ? t.explain.maybe(nTxt) : t.explain.point(nTxt)}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.viewWidth} value={fmtLen(Wv, decimal).split(' ')[0]} unit={fmtLen(Wv, decimal).split(' ')[1]} accent="#22d3ee" textColor="#a5f3fc" />
        <Readout label={t.ratio} value={`1 : ${nTxt}`} accent="#a78bfa" textColor="#c4b5fd" sub={t.busL(fmt(BUS.len, 0, decimal))} />
        <PixelReadout t={t} Wv={Wv} sceneW={sceneW} decimal={decimal} />
        <Readout label={t.verdict} accent={tones[verdict]} active>
          <div className="mt-1.5 flex items-center gap-2">
            <VIcon size={26} style={{ color: tones[verdict] }} aria-hidden="true" />
            <span className="text-lg sm:text-xl font-bold leading-tight" style={{ color: tones[verdict] }}>
              {t.verdicts[verdict]}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{t.verdictSub[verdict]}</p>
        </Readout>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <ZoomOut size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
          <div className="flex-1">
            <RangeField
              id="cl-zoom"
              label={t.zoom}
              min={0}
              max={1}
              step={0.001}
              value={z}
              onChange={(nz) => setZ(nz)}
              accent="#22d3ee"
              display={fmtLen(Wv, decimal)}
              valueText={fmtLen(Wv, decimal)}
              hint={t.zoomHint}
            />
          </div>
          <ZoomIn size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function PixelReadout({ t, Wv, sceneW, decimal }) {
  const px = (BUS.len / Wv) * Math.max(sceneW, 280);
  return (
    <Readout
      label={t.onScreen}
      value={px < 0.1 ? fmt(px, 3, decimal) : px < 10 ? fmt(px, 1, decimal) : fmt(px, 0, decimal)}
      unit="px"
      accent="#fb7185"
      textColor="#fda4af"
      sub={t.busW(fmt(BUS.w, 2, decimal))}
    />
  );
}

/* ----------------------------------------------------------------- scene */

function PointScene({ t, Wv, decimal }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 280);
  const narrow = W < 560;
  const H = narrow ? Math.round(W * 0.95) : Math.round(clamp(W * 0.46, 320, 500));
  const fs = narrow ? 11 : 12;
  const k = W / Wv;
  // camera: centred between the cities on the map, on the bus at street scale
  const f = clamp((Math.log(Wv) - Math.log(30 * KM)) / (Math.log(W_MAX) - Math.log(30 * KM)), 0, 1);
  const e = f * f * (3 - 2 * f);
  const cx = FOCUS.x + (MID.x - FOCUS.x) * e;
  const cy = FOCUS.y + (MID.y - FOCUS.y) * e;
  const sx = (x) => W / 2 + (x - cx) * k;
  const sy = (y) => H / 2 - (y - cy) * k;
  const halfWm = W / 2 / k;
  const halfHm = H / 2 / k;
  const vis = { x0: cx - halfWm, x1: cx + halfWm, y0: cy - halfHm, y1: cy + halfHm };
  const box = { w: W, h: H };

  const cityA = 1 - fadeBelow(Wv, 3 * KM, 12 * KM); // the city disc tint fades as its streets appear
  const streetsA = fadeBelow(Wv, 60 * KM, 140 * KM) * (1 - fadeBelow(Wv, 250, 600) * 0.6);
  const localA = fadeBelow(Wv, 2.2 * KM, 4.5 * KM);
  const yardA = fadeBelow(Wv, 900, 2.4 * KM);
  const labelsA = 1 - fadeBelow(Wv, 6 * KM, 14 * KM);

  // city street grid around Samarkand
  const streets = [];
  if (streetsA > 0.01) {
    const step = Wv > 30 * KM ? 1500 : 500;
    const ext = SAMARKAND.r;
    for (let gx = Math.ceil((Math.max(vis.x0, SAMARKAND.x - ext) - SAMARKAND.x) / step); SAMARKAND.x + gx * step <= Math.min(vis.x1, SAMARKAND.x + ext); gx += 1) {
      const x = SAMARKAND.x + gx * step;
      const half = Math.sqrt(Math.max(0, ext * ext - (x - SAMARKAND.x) ** 2));
      const major = gx % 3 === 0;
      streets.push(<line key={`cx${gx}`} x1={sx(x)} x2={sx(x)} y1={sy(SAMARKAND.y - half)} y2={sy(SAMARKAND.y + half)} stroke="#cbd5e1" strokeWidth={major ? 2.2 : 1.1} />);
    }
    for (let gy = Math.ceil((Math.max(vis.y0, SAMARKAND.y - ext) - SAMARKAND.y) / step); SAMARKAND.y + gy * step <= Math.min(vis.y1, SAMARKAND.y + ext); gy += 1) {
      const y = SAMARKAND.y + gy * step;
      const half = Math.sqrt(Math.max(0, ext * ext - (y - SAMARKAND.y) ** 2));
      const major = gy % 3 === 0;
      streets.push(<line key={`cy${gy}`} x1={sx(SAMARKAND.x - half)} x2={sx(SAMARKAND.x + half)} y1={sy(y)} y2={sy(y)} stroke="#cbd5e1" strokeWidth={major ? 2.2 : 1.1} />);
    }
  }

  // local blocks around the bus station
  const blocks = [];
  if (localA > 0.01) {
    const step = 150;
    for (let i = -8; i <= 8; i += 1) {
      for (let j = -8; j <= 8; j += 1) {
        const bx = i * step - 60;
        const by = j * step - 40;
        if (bx + step < vis.x0 || bx > vis.x1 || by + step < vis.y0 || by > vis.y1) continue;
        if (i >= -1 && i <= 1 && j >= -1 && j <= 0) continue; // the station yard
        const id = (i + 20) * 50 + j + 20;
        const pad = 14;
        const park = hash(id) > 0.86;
        blocks.push(
          <rect
            key={`b${id}`}
            x={sx(bx + pad)}
            y={sy(by + step - pad)}
            width={(step - 2 * pad) * k}
            height={(step - 2 * pad) * k}
            rx={Math.min(6, 4 * k)}
            fill={park ? '#d9f0d3' : '#e8ecf2'}
            stroke={park ? '#bbe3b2' : '#d5dce6'}
          />,
        );
      }
    }
  }

  const roadPts = ROAD.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  const roadW = Math.max(2.5, 14 * k);
  const busPx = BUS.len * k;
  const bodyA = clamp((busPx - 12) / 18, 0, 1);
  const dotA = 1 - bodyA;
  const bx = sx(BUS.cx);
  const by = sy(BUS.cy);
  const annotA = fadeBelow(Wv, 90, 160);

  // scale bar
  const barM = niceStep(k, narrow ? 70 : 110);
  const barPx = barM * k;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-300/70 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div ref={ref} className="w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t.sceneLabel(fmtLen(Wv, decimal))} className="cl-scene block select-none">
          <rect width={W} height={H} fill="#f6f5ef" />
          <Graticule W={W} H={H} k={k} sx={sx} sy={sy} vis={vis} />

          {/* cities */}
          {[SAMARKAND, TASHKENT, JIZZAKH, GULISTAN].map((c, i) => (
            <circle key={i} cx={sx(c.x)} cy={sy(c.y)} r={Math.max(3, c.r * k)} fill="#e7e5dc" stroke="#d6d3c4" strokeWidth={1} opacity={i === 0 ? Math.max(cityA, 0.35) : 1} />
          ))}
          <g opacity={streetsA}>{streets}</g>
          <g opacity={localA}>{blocks}</g>

          {/* the M39 road */}
          <polyline points={roadPts} fill="none" stroke="#b45309" strokeOpacity="0.35" strokeWidth={roadW + 3} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={roadPts} fill="none" stroke="#f59e0b" strokeWidth={roadW} strokeLinejoin="round" strokeLinecap="round" />
          {labelsA > 0.02 && (
            <g opacity={labelsA}>
              {[
                [TASHKENT, t.cities.tashkent, 1],
                [SAMARKAND, t.cities.samarkand, 1],
                [JIZZAKH, t.cities.jizzakh, 0],
                [GULISTAN, t.cities.gulistan, 0],
              ].map(([c, name, big]) => (
                <g key={name}>
                  <circle cx={sx(c.x)} cy={sy(c.y)} r={big ? 5 : 3.5} fill="#334155" stroke="#fff" strokeWidth={1.5} />
                  <text x={sx(c.x) + (big ? 10 : 8)} y={sy(c.y) + 4} fontSize={big ? fs + 2 : fs} fontWeight={big ? 700 : 500} fill="#1e293b" stroke="#f6f5ef" strokeWidth={3} paintOrder="stroke">
                    {name}
                  </text>
                </g>
              ))}
              <Pill
                x={sx((JIZZAKH.x + GULISTAN.x) / 2) + 6}
                y={sy((JIZZAKH.y + GULISTAN.y) / 2) + 22}
                text={`${t.road} · ≈ ${groupThousands(Math.round(ROAD_LEN / 10000) * 10)} km`}
                bg="#fff"
                color="#92400e"
                border="#fcd34d"
                size={fs - 1}
                box={box}
              />
            </g>
          )}

          {/* bus station yard and garage */}
          {yardA > 0.01 && (
            <g opacity={yardA}>
              <rect x={sx(-75)} y={sy(0)} width={150 * k} height={85 * k} fill="#dfe3ea" />
              <rect x={sx(-75)} y={sy(-87)} width={1400 * k} height={16 * k} fill="#cfd5de" />
              {Array.from({ length: 6 }, (_, i) => (
                <g key={`bay${i}`}>
                  <line x1={sx(-70 + i * 6)} x2={sx(-70 + i * 6)} y1={sy(-24)} y2={sy(-40)} stroke="#fff" strokeWidth={Math.max(1, 0.15 * k)} />
                  {i < 5 && i !== 2 && <rect x={sx(-70 + i * 6 + 1.7)} y={sy(-25)} width={BUS.w * k} height={BUS.len * k} rx={Math.min(4, 0.4 * k)} fill="#94a3b8" stroke="#64748b" strokeWidth={0.8} />}
                </g>
              ))}
              {/* passenger terminal */}
              <rect x={sx(28)} y={sy(-40)} width={42 * k} height={26 * k} rx={Math.min(6, k)} fill="#c7d2fe" stroke="#818cf8" />
              <text x={sx(49)} y={sy(-53) + 4} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#3730a3" opacity={fadeBelow(Wv, 500, 1200)}>
                {t.station}
              </text>
              {/* garage */}
              <rect x={sx(-24)} y={sy(20)} width={48 * k} height={20 * k} fill="#cbd5e1" stroke="#475569" strokeWidth={Math.max(1, 0.25 * k)} />
              {[-12, 0, 12].map((gx) => (
                <g key={`gate${gx}`}>
                  {/* the opening, its posts, and a painted entry lane on the asphalt */}
                  <rect x={sx(gx - GATE_W / 2)} y={sy(0.6)} width={GATE_W * k} height={Math.max(3, 1.4 * k)} fill="#f8fafc" />
                  <rect x={sx(gx - GATE_W / 2) - Math.max(2, 0.25 * k)} y={sy(0.8)} width={Math.max(2, 0.25 * k)} height={Math.max(4, 1.6 * k)} fill="#334155" />
                  <rect x={sx(gx + GATE_W / 2)} y={sy(0.8)} width={Math.max(2, 0.25 * k)} height={Math.max(4, 1.6 * k)} fill="#334155" />
                  <line x1={sx(gx - GATE_W / 2)} x2={sx(gx - GATE_W / 2)} y1={sy(-1)} y2={sy(-26)} stroke="#fff" strokeWidth={Math.max(1, 0.15 * k)} strokeDasharray={`${1.5 * k} ${1.2 * k}`} />
                  <line x1={sx(gx + GATE_W / 2)} x2={sx(gx + GATE_W / 2)} y1={sy(-1)} y2={sy(-26)} stroke="#fff" strokeWidth={Math.max(1, 0.15 * k)} strokeDasharray={`${1.5 * k} ${1.2 * k}`} />
                  {gx !== 0 && (
                    <path
                      d={`M${sx(gx)},${sy(-4)} L${sx(gx - 0.9)},${sy(-6)} L${sx(gx - 0.35)},${sy(-6)} L${sx(gx - 0.35)},${sy(-9)} L${sx(gx + 0.35)},${sy(-9)} L${sx(gx + 0.35)},${sy(-6)} L${sx(gx + 0.9)},${sy(-6)} Z`}
                      fill="#fff"
                      opacity="0.8"
                    />
                  )}
                </g>
              ))}
              <text x={sx(0)} y={sy(2.2) - 2} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#334155" opacity={fadeBelow(Wv, 400, 1000)} dy={-fs - 4}>
                {t.garage}
              </text>
            </g>
          )}

          {/* the bus: a body when it is big enough on screen, a point when it is not */}
          {bodyA > 0 && (
            <g opacity={bodyA}>
              <rect x={bx - (BUS.w / 2) * k} y={by - (BUS.len / 2) * k} width={BUS.w * k} height={BUS.len * k} rx={Math.min(8, 0.5 * k)} fill="#e11d48" stroke="#9f1239" strokeWidth={1.5} />
              <rect x={bx - (BUS.w / 2) * k + 0.25 * k} y={by - (BUS.len / 2) * k + 0.4 * k} width={(BUS.w - 0.5) * k} height={1.1 * k} rx={Math.min(4, 0.3 * k)} fill="#fecdd3" />
              {Array.from({ length: 4 }, (_, i) => (
                <rect key={i} x={bx - 0.35 * k} y={by - (BUS.len / 2) * k + (2.4 + i * 2.3) * k} width={0.7 * k} height={1.5 * k} rx={1} fill="#fff" opacity="0.6" />
              ))}
            </g>
          )}
          {dotA > 0 && (
            <g opacity={dotA}>
              <circle cx={bx} cy={by} r={14} fill="#e11d48" opacity="0.15" className="cl-pulse" />
              <circle cx={bx} cy={by} r={6} fill="#e11d48" stroke="#fff" strokeWidth={2.5} />
              <Pill x={bx - 44} y={by - 26} text={t.busPoint} bg="#e11d48" size={fs} box={box} />
            </g>
          )}

          {/* dimensions at the gate */}
          {annotA > 0.02 && (
            <g opacity={annotA}>
              <Dim x1={sx(-GATE_W / 2)} x2={sx(GATE_W / 2)} y={sy(0) - 14} text={t.gate(fmt(GATE_W, 1, decimal))} color="#334155" fs={fs} up />
              <Dim x1={bx - (BUS.w / 2) * k} x2={bx + (BUS.w / 2) * k} y={by + (BUS.len / 2) * k + 16} text={t.busW(fmt(BUS.w, 2, decimal))} color="#be123c" fs={fs} />
              <text x={bx + (BUS.w / 2) * k + 10} y={by + 4} fontSize={fs} fontWeight="600" fill="#be123c">
                {t.busL(fmt(BUS.len, 0, decimal))}
              </text>
            </g>
          )}

          {/* scale bar */}
          <g transform={`translate(${W - barPx - 92} ${H - 22})`}>
            <rect x={-8} y={-16} width={barPx + 16 + 70} height={30} rx={8} fill="#fff" opacity="0.9" />
            <line x1={0} x2={barPx} y1={0} y2={0} stroke="#0f172a" strokeWidth={3} />
            <line x1={0} x2={0} y1={-5} y2={5} stroke="#0f172a" strokeWidth={2} />
            <line x1={barPx} x2={barPx} y1={-5} y2={5} stroke="#0f172a" strokeWidth={2} />
            <text x={barPx + 8} y={4} fontSize={fs} fontWeight="600" fill="#0f172a">
              {fmtLen(barM, decimal)}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function Dim({ x1, x2, y, text, color, fs, up }) {
  const ty = up ? y - 8 : y + fs + 6;
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={1.4} />
      <line x1={x1} x2={x1} y1={y - 5} y2={y + 5} stroke={color} strokeWidth={1.4} />
      <line x1={x2} x2={x2} y1={y - 5} y2={y + 5} stroke={color} strokeWidth={1.4} />
      <text x={(x1 + x2) / 2} y={ty} textAnchor="middle" fontSize={fs} fontWeight="700" fill={color} stroke="#fff" strokeWidth={3} paintOrder="stroke">
        {text}
      </text>
    </g>
  );
}

function Graticule({ W, H, k, sx, sy, vis }) {
  const step = niceStep(k, 90);
  const lines = [];
  for (let i = Math.ceil(vis.x0 / step); i * step <= vis.x1; i += 1) lines.push(<line key={`x${i}`} x1={sx(i * step)} x2={sx(i * step)} y1={0} y2={H} />);
  for (let j = Math.ceil(vis.y0 / step); j * step <= vis.y1; j += 1) lines.push(<line key={`y${j}`} x1={0} x2={W} y1={sy(j * step)} y2={sy(j * step)} />);
  return (
    <g stroke="#e7e4d8" strokeWidth={1} pointerEvents="none">
      {lines}
    </g>
  );
}
