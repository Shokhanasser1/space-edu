import { useMemo, useState } from 'react';
import { Lightbulb, Timer } from 'lucide-react';

import { Arrow, Explain, Pill, RangeField, Readout, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Chip, FormulaTile, InfoBox, LabScene, PR, Rich, WATER, fmtP, makeProfile, plain, pts } from './Bernoulli.parts';

/**
 * Tab 3, the other experiments: where a fluid flows faster its pressure is
 * lower, and the still fluid outside pushes things into the fast stream.
 *  - two sheets of paper: blowing at v between them leaves p = p₀ − ρv²/2
 *    inside (air ρ = 1.2 kg/m³; v = 8 m/s → Δp = 38.4 Pa, 0.04 % of p₀) and
 *    the sheets come together;
 *  - two boats side by side in a river: the water between them is squeezed
 *    into a narrower channel and speeds up. Simple continuity estimate (all
 *    the water between the bows passes the gap): v_gap = v·(b + B)/b; with
 *    v = 1.5 m/s, b = 3 m, B = 2 m → 2.5 m/s, Δp = 1000·(2.5² − 1.5²)/2 =
 *    2000 Pa, and the boats drift together;
 *  - a roof in a storm: wind at v over the roof, still air inside; simple
 *    estimate Δp ≈ ρv²/2, F ≈ Δp·S with S = 100 m², roof m = 3000 kg
 *    (mg = 29.4 kN): v = 20 m/s → 240 Pa, 24 kN — the roof holds; above
 *    v ≈ 22 m/s (80 km/h) F > mg and an unfastened roof is lifted.
 */

const RHO_AIR = 1.2;
const RHO_W = 1000;
const G = 9.8;
const P0 = 101300;

/* ================================================================= paper */

const GAP = 5; // cm between the sheets at the top
const SHEET = 30; // cm
const SLOW_P = 1 / 40;

export function PaperLab({ T, running }) {
  const t = T.apps.paper;
  const dec = T.decimal;
  const [v, setV] = useState(8);
  const [sim, setSim] = useState({ D: 0, d: 0, u: 0 });
  const dp = (RHO_AIR * v * v) / 2;
  const dMax = GAP / 2 - 0.35;
  const goal = dMax * (1 - Math.exp(-dp / 22));
  const settled = Math.abs(sim.d - goal) < 0.005 && Math.abs(sim.u) < 0.005;
  useRafLoop(running && (v > 0 || !settled), (dt) =>
    setSim((p) => {
      const w = 7;
      const z = 0.55;
      let { d, u } = p;
      const n = Math.max(1, Math.ceil(dt / 0.01));
      for (let i = 0; i < n; i += 1) {
        u += (w * w * (goal - d) - 2 * z * w * u) * (dt / n);
        d += u * (dt / n);
      }
      return { D: p.D + v * 100 * dt * SLOW_P, d: clamp(d, -0.2, dMax), u };
    }),
  );

  const key = v < 0.5 ? 'still' : 'blow';
  const shown = useSettled(key, 300);
  const ex = t.explain;
  const text = shown === 'still' ? ex.still : ex.blow(fmt(v, 1, dec), fmt(dp, 1, dec), fmt((dp / P0) * 100, 3, dec));

  return (
    <>
      <LabScene
        legend={[
          { label: t.legend.air, color: '#64748b', kind: 'line' },
          { label: t.legend.push, color: PALETTE.force, kind: 'arrow' },
        ]}
        chips={v > 0 ? <Chip icon={Timer}>{t.scene.slow(fmt(1 / SLOW_P, 0, dec))}</Chip> : null}
        ariaLabel={plain(t.scene.aria(fmt(v, 1, dec), fmt(dp, 1, dec)))}
        height={(W, narrow) => (narrow ? clamp(W * 1.0, 320, 400) : clamp(W * 0.4, 420, 480))}
      >
        {(W, H, narrow) => {
          const padT = narrow ? 34 : 50;
          const padB = 10;
          const yMin = 4;
          const yMax = 54;
          const k = (H - padT - padB) / (yMax - yMin);
          // oblique view: the sheets (21 cm wide) go back, up and to the left
          const DEP = 21;
          const ox = -0.62 * DEP;
          const oy = 0.3 * DEP;
          const sx = (x) => W / 2 + (x - ox / 2) * k;
          const sy = (y) => H - padB - (y - yMin) * k;
          const fs = narrow ? 10.5 : 12;
          const box = { w: W, h: H };
          const yTop = 40;
          const sheetX = (side, s) => side * (GAP / 2 - sim.d * s * s);
          const edge = (side, f) => {
            const p = [];
            for (let i = 0; i <= 24; i += 1) {
              const s = i / 24;
              p.push([sx(sheetX(side, s) + ox * f), sy(yTop - SHEET * s + oy * f)]);
            }
            return p;
          };
          const sheet = (side) => {
            const front = edge(side, 0);
            const back = edge(side, 1);
            return { front, back, poly: `${pts(front)} ${pts(back.slice().reverse())}` };
          };
          const L = sheet(-1);
          const R = sheet(1);
          // air particles: down the gap (two depths), then fanning out under the sheets
          const parts = [];
          if (v > 0) {
            const fr = narrow ? [-0.5, 0, 0.5] : [-0.62, -0.2, 0.2, 0.62];
            const len = 38;
            [0.15, 0.45, 0.75].forEach((dz, dj) => {
              fr.forEach((f, j) => {
                for (let i = 0; i < 8; i += 1) {
                  const dist = (sim.D + i * (len / 8) + j * 1.7 + dj * 2.3) % len;
                  const y = 42 - dist;
                  const s = clamp((yTop - y) / SHEET, 0, 1);
                  const half = GAP / 2 - sim.d * s * s - 0.3;
                  const spread = y < yTop - SHEET ? (yTop - SHEET - y) * 1.6 : 0;
                  const x = f * half + Math.sign(f || (j % 2 ? 1 : -1)) * spread;
                  parts.push({
                    key: `${dj}-${j}-${i}`,
                    x: sx(x + ox * dz),
                    y: sy(y + oy * dz),
                    o: y < yTop - SHEET ? clamp(1 - spread / 10, 0, 1) : 1,
                  });
                }
              });
            });
          }
          const aLen = clamp(dp * 0.55, 0, narrow ? 34 : 46);
          // the far sheet is pushed on its far (back) part, the near sheet on its front part
          const arrows = (side) =>
            [0.25, 0.5, 0.75, 0.95].map((s) => {
              const f = side < 0 ? 0.88 : 0.12;
              const x = sx(sheetX(side, s) + ox * f);
              const y = sy(yTop - SHEET * s + oy * f);
              return <Arrow key={`${side}-${s}`} x1={x + side * (aLen + 6)} y1={y} x2={x + side * 4} y2={y} color={PALETTE.force} width={2.6} head={9} />;
            });
          return (
            <g>
              <rect width={W} height={H} fill="#fbfcfe" />
              <g aria-hidden="true">
                {Array.from({ length: Math.ceil(W / k / 2) + 2 }, (_, i) => (i - Math.ceil(W / k / 4)) * 2).map((x) => (
                  <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke="#eef2f7" />
                ))}
                {Array.from({ length: 28 }, (_, i) => i * 2).map((y) => (
                  <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} stroke="#eef2f7" />
                ))}
              </g>
              {/* left sheet (seen from outside), the air, then the right sheet in front */}
              <polygon points={L.poly} fill="#ffffff" fillOpacity="0.95" stroke="#94a3b8" strokeWidth={1.4} strokeLinejoin="round" />
              <line x1={L.front[0][0]} y1={L.front[0][1]} x2={L.back[0][0]} y2={L.back[0][1]} stroke="#334155" strokeWidth={4} strokeLinecap="round" />
              {aLen > 4 && arrows(-1)}
              {parts.map((p) => (
                <line key={p.key} x1={p.x} x2={p.x} y1={p.y - 6} y2={p.y} stroke="#475569" strokeOpacity={0.8 * p.o} strokeWidth={1.8} strokeLinecap="round" />
              ))}
              <polygon points={R.poly} fill="#f8fafc" fillOpacity="0.6" stroke="#94a3b8" strokeWidth={1.4} strokeLinejoin="round" />
              <line x1={R.front[0][0]} y1={R.front[0][1]} x2={R.back[0][0]} y2={R.back[0][1]} stroke="#334155" strokeWidth={4} strokeLinecap="round" />
              {aLen > 4 && arrows(1)}
              {/* straw above the gap */}
              <rect x={sx(ox * 0.4) - 0.6 * k} y={sy(53)} width={1.2 * k} height={(53 - 42.5 - oy * 0.4) * k} fill="#fde68a" stroke="#b45309" strokeWidth={1.2} />
              {!narrow && <Pill x={sx(ox * 0.4) + 64} y={sy(49)} text={t.scene.straw} bg="#b45309" size={fs - 1} box={box} />}
              <Pill x={sx(-GAP / 2 + ox) - (narrow ? 22 : 56)} y={sy(26)} text={t.scene.p0} bg="#334155" size={fs - 0.5} box={box} />
              <Pill x={sx(GAP / 2) + (narrow ? 46 : 80)} y={sy(26)} text={t.scene.p0} bg="#334155" size={fs - 0.5} box={box} />
              <Pill x={sx(ox * 0.3)} y={sy(5)} text={v > 0 ? t.scene.inside(fmt(dp, 1, dec)) : t.scene.insideStill} bg={PR.low} size={fs - 0.5} box={box} />
            </g>
          );
        }}
      </LabScene>
      <Explain icon={Lightbulb} id={shown} tone={shown === 'still' ? '#94a3b8' : '#34d399'}>
        <Rich>{text}</Rich>
      </Explain>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <Readout label={t.readouts.v} symbol="v" value={fmt(v, 1, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={<Rich>{t.sub.v}</Rich>} />
        <Readout label={t.readouts.dp} symbol="Δp" value={fmt(dp, 1, dec)} unit={T.Pa} accent={PR.dyn} textColor={PR.dynText} active={v > 0} sub={<Rich>{t.sub.dp}</Rich>} />
        <Readout
          label={t.readouts.pct}
          symbol={<Rich>Δp/p₀</Rich>}
          value={fmt((dp / P0) * 100, 3, dec)}
          unit="%"
          accent="#94a3b8"
          className="col-span-2 lg:col-span-1"
          sub={<Rich>{t.sub.pct(fmtP(P0))}</Rich>}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField id="bn-pv" label={t.v} symbol="v" min={0} max={15} step={0.5} value={v} onChange={setV} accent={PALETTE.vel} display={`${fmt(v, 1, dec)} ${T.ms}`} hint={t.vHint} />
          <InfoBox
            title={t.info.title}
            rows={[
              [t.info.rho, `${fmt(RHO_AIR, 1, dec)} ${T.kgm3}`],
              [t.info.p0, `${fmtP(P0)} ${T.Pa}`],
              [t.info.gap, `${fmt(GAP, 0, dec)} ${T.cm}`],
            ]}
          />
        </div>
        <div className="lg:col-span-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile tag={t.f.dp.tag} color={PR.dynText} general={t.f.dp.general} filled={t.f.dp.filled(fmt(v, 1, dec), fmt(dp, 1, dec))} ok={v > 0} />
          <FormulaTile tag={t.f.why.tag} color="#93c5fd" general={t.f.why.general} filled={t.f.why.filled} />
          <p className="text-xs leading-snug text-gray-500">
            <Rich>{t.note}</Rich>
          </p>
        </div>
      </div>
    </>
  );
}

/* ================================================================= boats */

const BEAM = 2; // m
const LB = 7; // m
const BOW = 21.5; // x of the bow tips
const XL = 50; // m, length of river the particles cover
const GAP_MIN = 0.6;

function halfWidth(xl) {
  if (xl <= 0 || xl >= LB) return 0;
  const bow = 2.6;
  if (xl < bow) return (BEAM / 2) * (1 - (1 - xl / bow) ** 2);
  if (xl > LB - 0.8) return (BEAM / 2) * (1 - 0.3 * ((xl - (LB - 0.8)) / 0.8) ** 2);
  return BEAM / 2;
}

export function BoatsLab({ T, running }) {
  const t = T.apps.boats;
  const dec = T.decimal;
  const [v, setV] = useState(1.5);
  const [b0, setB0] = useState(3);
  const [sim, setSim] = useState({ gap: 3, u: 0, D: 0, Vc: 0, touched: false });
  const gap = sim.gap;
  const vGap = (v * (gap + BEAM)) / gap;
  const dp = (RHO_W * (vGap * vGap - v * v)) / 2;
  useRafLoop(running && (v > 0 || Math.abs(sim.u) > 1e-4), (dt) =>
    setSim((p) => {
      const vg = (v * (p.gap + BEAM)) / p.gap;
      const d = (RHO_W * (vg * vg - v * v)) / 2;
      let u = p.u + (1e-4 * d - 0.6 * p.u) * dt;
      let g = p.gap - u * dt;
      let touched = p.touched;
      if (g <= GAP_MIN) {
        g = GAP_MIN;
        u = 0;
        touched = true;
      }
      return { gap: g, u, D: p.D + v * dt, Vc: p.Vc + v * (p.gap + BEAM) * dt, touched };
    }),
  );
  const changeGap = (b) => {
    setB0(b);
    setSim((p) => ({ ...p, gap: b, u: 0, touched: false }));
  };

  let key = 'moving';
  if (sim.touched) key = 'touched';
  else if (v < 0.05) key = 'still';
  const shown = useSettled(key, 300);
  const ex = t.explain;
  const text = { still: ex.still, moving: ex.moving(fmt(vGap, 1, dec), fmtP(dp)), touched: ex.touched }[shown] ?? ex.still;

  const channel = useMemo(() => makeProfile((x) => gap + BEAM - 2 * halfWidth(x - BOW), XL, 1, 260), [gap]);

  return (
    <>
      <LabScene
        legend={[
          { label: t.legend.water, color: WATER.edge, kind: 'water' },
          { label: t.legend.push, color: PALETTE.force, kind: 'arrow' },
          { label: t.legend.v, color: PALETTE.vel, kind: 'arrow' },
        ]}
        chips={<Chip icon={Timer}>{t.scene.top}</Chip>}
        ariaLabel={plain(t.scene.aria(fmt(v, 1, dec), fmt(gap, 1, dec), fmt(vGap, 1, dec)))}
        height={(W, narrow) => (narrow ? clamp(W * 0.9, 290, 360) : clamp(W * 0.34, 340, 420))}
      >
        {(W, H, narrow) => {
          const padT = narrow ? 30 : 52;
          const padB = 8;
          const Yh = 7;
          const k = Math.min((H - padT - padB) / (2 * Yh), W / 26);
          const cx = W / 2;
          const cy = padT + (H - padT - padB) / 2;
          const sx = (x) => cx + (x - (BOW + LB / 2)) * k;
          const xLeft = BOW + LB / 2 - W / 2 / k;
          const sy = (y) => cy - y * k;
          const fs = narrow ? 10.5 : 12;
          const box = { w: W, h: H };
          const yc = gap / 2 + BEAM / 2;
          const hull = (side) => {
            const up = [];
            const dn = [];
            for (let i = 0; i <= 40; i += 1) {
              const xl = (LB * i) / 40;
              const hw = halfWidth(xl) || (i === 40 ? (BEAM / 2) * 0.7 : 0);
              up.push([sx(BOW + xl), sy(side * yc + hw)]);
              dn.push([sx(BOW + xl), sy(side * yc - hw)]);
            }
            return `${pts(up)} ${pts(dn.reverse())}`;
          };
          // particles in the gap (channel flux) and outside (free stream)
          const gapParts = [];
          if (v > 0) {
            const n = 30;
            const dV = channel.Vtot / n;
            [-0.55, 0, 0.55].forEach((f, j) => {
              for (let i = 0; i < n; i += 1) {
                const V = (sim.Vc + (i + j * 0.33) * dV) % channel.Vtot;
                const x = channel.xOfV(V);
                const w = gap + BEAM - 2 * halfWidth(x - BOW);
                const xb = channel.xOfV(Math.max(0, V - 0.35 * (gap + BEAM)));
                gapParts.push({ key: `g${j}-${i}`, x1: sx(xb), x2: sx(x), y: sy((f * w) / 2) });
              }
            });
          }
          const outParts = [];
          if (v > 0) {
            [1, -1].forEach((side) => {
              [0.9, 2.4, 4.0].forEach((off, j) => {
                const y0 = side * (gap / 2 + BEAM + off);
                if (Math.abs(y0) > Yh - 0.3) return;
                for (let i = 0; i < 22; i += 1) {
                  const x = (sim.D + i * (XL / 22) + j * 0.9) % XL;
                  const bump = halfWidth(x - BOW) / (BEAM / 2);
                  const y = y0 + side * bump * (0.45 / (j + 1));
                  outParts.push({ key: `o${side}${j}-${i}`, x1: sx(x - 0.35), x2: sx(x), y: sy(y) });
                }
              });
            });
          }
          const aLen = clamp(dp / 55, 0, narrow ? 30 : 42);
          return (
            <g>
              <rect width={W} height={H} fill={WATER.fill} fillOpacity="0.55" />
              {/* banks */}
              <rect x={0} y={0} width={W} height={Math.max(0, sy(Yh))} fill="#fde68a" opacity="0.7" />
              <rect x={0} y={sy(-Yh)} width={W} height={Math.max(0, H - sy(-Yh))} fill="#fde68a" opacity="0.7" />
              {outParts.map((p) => (
                <line key={p.key} x1={p.x1} x2={p.x2} y1={p.y} y2={p.y} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeOpacity="0.9" />
              ))}
              {gapParts.map((p) => (
                <line key={p.key} x1={p.x1} x2={p.x2} y1={p.y} y2={p.y} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              ))}
              {/* boats */}
              {[1, -1].map((side) => (
                <g key={side}>
                  <polygon points={hull(side)} fill="#fef3c7" stroke="#92400e" strokeWidth={1.8} strokeLinejoin="round" />
                  {[2.9, 4.8].map((xl) => (
                    <line key={xl} x1={sx(BOW + xl)} x2={sx(BOW + xl)} y1={sy(side * yc + BEAM * 0.42)} y2={sy(side * yc - BEAM * 0.42)} stroke="#b45309" strokeWidth={2} />
                  ))}
                </g>
              ))}
              {/* the push of the outer water */}
              {aLen > 4 &&
                [1, -1].map((side) =>
                  [2.3, 3.8, 5.3].map((xl) => {
                    const yEdge = sy(side * (yc + halfWidth(xl)));
                    return (
                      <Arrow
                        key={`${side}-${xl}`}
                        x1={sx(BOW + xl)}
                        y1={yEdge - side * (aLen + 5)}
                        x2={sx(BOW + xl)}
                        y2={yEdge - side * 3}
                        color={PALETTE.force}
                        width={2.6}
                        head={9}
                      />
                    );
                  }),
                )}
              {/* flow labels */}
              {v > 0 && (
                <g>
                  <Arrow x1={sx(xLeft) + 12} y1={sy(0)} x2={sx(xLeft) + 12 + clamp(v * 22, 12, 60)} y2={sy(0)} color={PALETTE.vel} width={3} head={10} />
                  <Pill x={sx(xLeft) + 12 + clamp(v * 22, 12, 60) + (narrow ? 34 : 44)} y={sy(0) - 16} text={t.scene.vTag(fmt(v, 1, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
                  <Pill x={sx(BOW + LB / 2)} y={sy(0)} text={t.scene.gapTag(fmt(vGap, 1, dec))} bg={PR.low} size={fs - 1} box={box} />
                </g>
              )}
              {!narrow && (
                <>
                  <Pill x={sx(BOW + LB / 2)} y={sy(yc + BEAM / 2) - aLen - 22} text={t.scene.p0} bg="#334155" size={fs - 1} box={box} />
                  <Pill x={sx(BOW + LB / 2)} y={sy(-yc - BEAM / 2) + aLen + 22} text={t.scene.p0} bg="#334155" size={fs - 1} box={box} />
                </>
              )}
              {/* gap */}
              <g>
                <line x1={sx(BOW + LB + 0.7)} x2={sx(BOW + LB + 0.7)} y1={sy(gap / 2)} y2={sy(-gap / 2)} stroke="#0f172a" strokeWidth={1.4} />
                <line x1={sx(BOW + LB + 0.4)} x2={sx(BOW + LB + 1)} y1={sy(gap / 2)} y2={sy(gap / 2)} stroke="#0f172a" strokeWidth={1.4} />
                <line x1={sx(BOW + LB + 0.4)} x2={sx(BOW + LB + 1)} y1={sy(-gap / 2)} y2={sy(-gap / 2)} stroke="#0f172a" strokeWidth={1.4} />
                <Pill x={sx(BOW + LB + 0.7) + (narrow ? 30 : 40)} y={sy(0)} text={t.scene.bTag(fmt(gap, 1, dec))} bg="#0f172a" size={fs - 1} box={box} />
              </g>
            </g>
          );
        }}
      </LabScene>
      <Explain icon={Lightbulb} id={shown} tone={{ still: '#94a3b8', moving: '#34d399', touched: '#fb923c' }[shown] ?? '#22d3ee'}>
        <Rich>{text}</Rich>
      </Explain>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout label={t.readouts.v} symbol="v" value={fmt(v, 1, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={<Rich>{t.sub.v}</Rich>} />
        <Readout
          label={t.readouts.vGap}
          symbol={<Rich>{t.sym.vGap}</Rich>}
          value={fmt(vGap, 1, dec)}
          unit={T.ms}
          accent={PR.low}
          textColor={PR.statText}
          active={v > 0}
          sub={<Rich>{t.sub.vGap}</Rich>}
        />
        <Readout label={t.readouts.dp} symbol="Δp" value={fmtP(dp)} unit={T.Pa} accent={PR.dyn} textColor={PR.dynText} sub={<Rich>{t.sub.dp}</Rich>} />
        <Readout label={t.readouts.b} symbol="b" value={fmt(gap, 1, dec)} unit={T.m} accent="#e2e8f0" sub={<Rich>{t.sub.b(fmt(b0, 1, dec))}</Rich>} />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField id="bn-bv" label={t.v} symbol="v" min={0} max={2} step={0.1} value={v} onChange={setV} accent={PALETTE.vel} display={`${fmt(v, 1, dec)} ${T.ms}`} />
          <RangeField id="bn-bb" label={t.b} symbol="b" min={2} max={6} step={0.5} value={b0} onChange={changeGap} accent="#e2e8f0" display={`${fmt(b0, 1, dec)} ${T.m}`} hint={t.bHint(fmt(BEAM, 0, dec))} />
        </div>
        <div className="lg:col-span-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile tag={t.f.cont.tag} color="#7dd3fc" general={t.f.cont.general} filled={t.f.cont.filled(fmt(v, 1, dec), fmt(gap, 2, dec), fmt(BEAM, 0, dec), fmt(vGap, 2, dec))} ok={v > 0} />
          <FormulaTile tag={t.f.dp.tag} color={PR.dynText} general={t.f.dp.general} filled={t.f.dp.filled(fmt(vGap, 2, dec), fmt(v, 1, dec), fmtP(dp))} ok={v > 0} />
          <p className="text-xs leading-snug text-gray-500">
            <Rich>{t.note}</Rich>
          </p>
        </div>
      </div>
    </>
  );
}

/* ================================================================== roof */

const S_ROOF = 100;
const M_ROOF = 3000;
const SLOW_R = 1 / 10;
const Y_CAP = 14;
const HX0 = 7;
const HX1 = 17;

const smooth = (u) => {
  const c = clamp(u, 0, 1);
  return c * c * (3 - 2 * c);
};
/** Height of the house (walls 3 m, ridge 5 m) with the gentle rise of the air before and after it. */
function obstacle(x) {
  if (x < HX0 - 3) return 0;
  if (x < HX0) return 3 * smooth((x - (HX0 - 3)) / 3);
  if (x <= HX1) return 3 + 2 * (1 - Math.abs(x - 12) / 5);
  if (x < HX1 + 4) return 3 * (1 - smooth((x - HX1) / 4));
  return 0;
}

export function RoofLab({ T, running }) {
  const t = T.apps.roof;
  const dec = T.decimal;
  const [v, setV] = useState(20);
  const [sim, setSim] = useState({ Vc: 0, lift: 0, lu: 0 });
  const dp = (RHO_AIR * v * v) / 2;
  const F = dp * S_ROOF;
  const mg = M_ROOF * G;
  const field = useMemo(() => makeProfile((x) => Y_CAP - obstacle(x - 14), 54, 1, 400), []);
  useRafLoop(running && (v > 0 || sim.lift > 0), (dt) =>
    setSim((p) => {
      const dts = dt * SLOW_R;
      const f = (RHO_AIR * v * v * S_ROOF) / 2;
      let a = (f - M_ROOF * G) / M_ROOF;
      if (p.lift <= 0 && a < 0) a = 0;
      let lu = p.lu + a * dts;
      lu *= Math.exp(-dts * 2);
      let lift = p.lift + lu * dts;
      if (lift <= 0) {
        lift = 0;
        lu = Math.max(0, lu);
      }
      if (lift >= 1.2) {
        lift = 1.2;
        lu = Math.min(0, lu);
      }
      return { Vc: p.Vc + v * Y_CAP * dts, lift, lu };
    }),
  );

  let key;
  if (v < 1) key = 'calm';
  else if (F < mg) key = 'hold';
  else key = 'lift';
  const shown = useSettled(key, 350);
  const ex = t.explain;
  const kN = (x) => fmt(x / 1000, 1, dec);
  const text = { calm: ex.calm, hold: ex.hold(fmtP(dp), kN(F), kN(mg)), lift: ex.lift(fmtP(dp), kN(F), kN(mg)) }[shown] ?? ex.calm;

  return (
    <>
      <LabScene
        legend={[
          { label: t.legend.wind, color: '#475569', kind: 'line' },
          { label: t.legend.push, color: PALETTE.force, kind: 'arrow' },
          { label: t.legend.mg, color: '#334155', kind: 'dash' },
        ]}
        chips={v > 0 ? <Chip icon={Timer}>{T.slowChip(SLOW_R)}</Chip> : null}
        ariaLabel={plain(t.scene.aria(fmt(v, 0, dec), kN(F), kN(mg)))}
        height={(W, narrow) => (narrow ? clamp(W * 0.85, 280, 340) : clamp(W * 0.34, 340, 420))}
      >
        {(W, H, narrow) => {
          const padT = narrow ? 30 : 54;
          const padB = 8;
          const yMin = -0.7;
          const yMax = 10.2;
          const k = Math.min((H - padT - padB) / (yMax - yMin), W / 24);
          const sx = (x) => W / 2 + (x - 12) * k;
          const sy = (y) => H - padB - (y - yMin) * k;
          const fs = narrow ? 10.5 : 12;
          const box = { w: W, h: H };
          const x0w = 12 - W / 2 / k;
          // wind particles along lifted streamlines
          const streaks = [];
          const lines = [];
          [0.8, 1.9, 3.2, 4.6, 6.2, 8.0, 9.7].forEach((y0, j) => {
            const yAt = (x) => y0 + obstacle(x) * (1 - y0 / Y_CAP);
            const pl = [];
            for (let i = 0; i <= 80; i += 1) {
              const x = x0w - 1 + ((W / k + 2) * i) / 80;
              pl.push([sx(x), sy(yAt(x))]);
            }
            lines.push(pl);
            if (v > 0) {
              const n = 14;
              const dV = field.Vtot / n;
              for (let i = 0; i < n; i += 1) {
                const V = (sim.Vc + (i + j * 0.29) * dV) % field.Vtot;
                const x = field.xOfV(V) - 14;
                const xb = field.xOfV(Math.max(0, V - 0.5 * Y_CAP)) - 14;
                streaks.push({ key: `${j}-${i}`, x1: sx(xb), y1: sy(yAt(xb)), x2: sx(x), y2: sy(yAt(x)) });
              }
            }
          });
          const lift = sim.lift;
          const tilt = -lift * 7;
          const rc = [sx(12), sy(4 + lift)];
          const aLen = clamp(dp / 9, 0, narrow ? 34 : 48);
          const unit = narrow ? 34 : 44;
          const lenF = clamp((F / mg) * unit, 0, unit * 2.2);
          return (
            <g>
              <rect width={W} height={H} fill="#f0f9ff" />
              <g aria-hidden="true">
                {Array.from({ length: Math.ceil(W / k) + 2 }, (_, i) => Math.floor(x0w) + i).map((x) => (
                  <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={sy(0)} stroke="#e0f2fe" />
                ))}
                {Array.from({ length: 11 }, (_, i) => i).map((y) => (
                  <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} stroke="#e0f2fe" />
                ))}
              </g>
              <g opacity="0.35">
                {lines.map((pl, i) => (
                  <polyline key={i} points={pts(pl)} fill="none" stroke="#475569" strokeWidth={1} />
                ))}
              </g>
              {streaks.map((s) => (
                <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#334155" strokeOpacity="0.8" strokeWidth={narrow ? 1.6 : 2} strokeLinecap="round" />
              ))}
              {/* ground */}
              <rect x={0} y={sy(0)} width={W} height={H - sy(0)} fill="#86efac" opacity="0.7" />
              <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} stroke="#15803d" strokeWidth={2} />
              {/* house */}
              <rect x={sx(HX0)} y={sy(3)} width={(HX1 - HX0) * k} height={3 * k} fill="#fde68a" stroke="#92400e" strokeWidth={1.6} />
              <rect x={sx(11.2)} y={sy(2.1)} width={1.6 * k} height={2.1 * k} fill="#b45309" />
              <rect x={sx(8.2)} y={sy(2.3)} width={1.6 * k} height={1.2 * k} fill="#bae6fd" stroke="#92400e" />
              <rect x={sx(14.2)} y={sy(2.3)} width={1.6 * k} height={1.2 * k} fill="#bae6fd" stroke="#92400e" />
              {!narrow && <Pill x={sx(9)} y={sy(0.55)} text={t.scene.inside} bg="#334155" size={fs - 1} box={box} />}
              {/* roof (lifted and tilted when F > mg) */}
              <g transform={`rotate(${tilt.toFixed(2)} ${rc[0].toFixed(1)} ${rc[1].toFixed(1)})`}>
                <polygon
                  points={pts([
                    [sx(HX0 - 0.5), sy(3 + lift)],
                    [sx(12), sy(5 + lift)],
                    [sx(HX1 + 0.5), sy(3 + lift)],
                    [sx(HX1 + 0.5), sy(2.7 + lift)],
                    [sx(12), sy(4.7 + lift)],
                    [sx(HX0 - 0.5), sy(2.7 + lift)],
                  ])}
                  fill="#b91c1c"
                  stroke="#7f1d1d"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                />
                {aLen > 4 &&
                  [8, 10, 14, 16].map((x) => {
                    const yRoof = 2.7 + 2 * (1 - Math.abs(x - 12) / 5) - 0.3 + lift;
                    return <Arrow key={x} x1={sx(x)} y1={sy(yRoof) + aLen + 4} x2={sx(x)} y2={sy(yRoof) + 2} color={PALETTE.force} width={2.6} head={9} />;
                  })}
              </g>
              {/* F and mg */}
              <line x1={rc[0]} y1={rc[1] + 4} x2={rc[0]} y2={rc[1] + unit - 9} stroke="#334155" strokeWidth={2.4} strokeDasharray="5 4" />
              <path d={`M${rc[0]},${rc[1] + unit} L${rc[0] - 6},${rc[1] + unit - 11} L${rc[0] + 6},${rc[1] + unit - 11} Z`} fill="#334155" />
              {lenF > 8 && <Arrow x1={rc[0]} y1={rc[1] - 6} x2={rc[0]} y2={rc[1] - 6 - lenF} color={PALETTE.force} width={4.5} head={15} />}
              {lenF > 8 && <Pill x={rc[0] + (narrow ? 52 : 70)} y={rc[1] - 6 - lenF + 10} text={t.scene.FTag(kN(F))} bg={PALETTE.force} size={fs - 0.5} box={box} />}
              <Pill x={rc[0] + (narrow ? 46 : 58)} y={rc[1] + unit * 0.45} text={t.scene.mgTag(kN(mg))} bg="#334155" size={fs - 1} box={box} />
              {v > 0 && (
                <g>
                  <Arrow x1={sx(x0w) + 12} y1={sy(7.2)} x2={sx(x0w) + 12 + clamp(v * 2, 14, 80)} y2={sy(7.2)} color={PALETTE.vel} width={3} head={10} />
                  <Pill x={sx(x0w) + 12 + clamp(v * 2, 14, 80) + (narrow ? 40 : 52)} y={sy(7.2)} text={t.scene.vTag(fmt(v, 0, dec))} bg={PALETTE.vel} size={fs - 1} box={box} />
                  {!narrow && <Pill x={sx(12) + 150} y={sy(6.2)} text={t.scene.above(fmtP(dp))} bg={PR.low} size={fs - 1} box={box} />}
                </g>
              )}
              {lift > 0.05 && <Pill x={sx(12) - (narrow ? 80 : 140)} y={sy(5.4 + lift)} text={t.scene.lifting} bg="#ea580c" size={fs} box={box} />}
            </g>
          );
        }}
      </LabScene>
      <Explain icon={Lightbulb} id={shown} tone={{ calm: '#94a3b8', hold: '#34d399', lift: '#fb923c' }[shown] ?? '#22d3ee'}>
        <Rich>{text}</Rich>
      </Explain>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <Readout label={t.readouts.v} symbol="v" value={fmt(v, 0, dec)} unit={T.ms} accent={PALETTE.vel} textColor={PALETTE.velText} sub={<Rich>{t.sub.v(fmt(v * 3.6, 0, dec))}</Rich>} />
        <Readout label={t.readouts.dp} symbol="Δp" value={fmtP(dp)} unit={T.Pa} accent={PR.dyn} textColor={PR.dynText} sub={<Rich>{t.sub.dp}</Rich>} />
        <Readout
          label={t.readouts.F}
          symbol="F"
          value={kN(F)}
          unit={T.kN}
          accent={PALETTE.force}
          textColor="#fca5a5"
          active={F >= mg}
          className="col-span-2 lg:col-span-1"
          sub={<Rich>{t.sub.F(kN(mg))}</Rich>}
        />
      </div>
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <RangeField id="bn-rv" label={t.v} symbol="v" min={0} max={40} step={1} value={v} onChange={setV} accent={PALETTE.vel} display={`${fmt(v, 0, dec)} ${T.ms}`} hint={t.vHint(fmt(v * 3.6, 0, dec))} />
          <InfoBox
            title={t.info.title}
            rows={[
              [t.info.S, `${fmt(S_ROOF, 0, dec)} ${T.m2}`],
              [t.info.m, `${fmtP(M_ROOF)} ${T.kg}`],
              [t.info.mg, `${kN(mg)} ${T.kN}`],
              [t.info.vc, `${fmt(Math.sqrt((2 * mg) / (RHO_AIR * S_ROOF)), 1, dec)} ${T.ms}`],
            ]}
          />
        </div>
        <div className="lg:col-span-3 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4">
          <FormulaTile tag={t.f.dp.tag} color={PR.dynText} general={t.f.dp.general} filled={t.f.dp.filled(fmt(v, 0, dec), fmtP(dp))} ok={v > 0} />
          <FormulaTile tag={t.f.F.tag} color="#fca5a5" general={t.f.F.general} filled={t.f.F.filled(fmtP(dp), fmt(S_ROOF, 0, dec), kN(F), F >= mg ? '>' : '<', kN(mg))} ok={F >= mg} />
          <p className="text-xs leading-snug text-gray-500">
            <Rich>{t.note}</Rich>
          </p>
        </div>
      </div>
    </>
  );
}
