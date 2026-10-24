import { useState } from 'react';
import { Check, Hand, Lightbulb, X } from 'lucide-react';
import { Arrow, Explain, RangeField, Readout, Segmented, clamp, fmt, useRafLoop, useSettled } from '../kit/ui';
import { Grid, makeView } from '../kit/scene';
import { COL, G, Panel, PanelTitle, PlayButtons, RichPill, SimScene, Tag, TimeChip, Toolbar, numt, sfmt } from './MomentumConservation.parts';

/**
 * Newton's cradle: five equal steel balls (r = 3.1 cm, m = 1 kg) on strings
 * l = 0.2 m long. k balls are lifted by h and let go; at the bottom they
 * have v = √(2gh). Equal masses colliding elastically pass the velocity on,
 * so exactly k balls fly out on the far side with the same v - the only
 * outcome that keeps both the momentum k·m·v and the kinetic energy k·mv²/2.
 * With plasticine between the balls the impact is perfectly inelastic: all
 * five move off together at v′ = k·v/5 (momentum kept, energy partly lost).
 *
 * The swing is the exact pendulum φ″ = −(g/l)·sin φ (RK4); the impact is
 * instant and happens when the swinging group passes φ = 0. Strings are
 * massless, air resistance neglected. Time runs 2× slower.
 */

const N = 5;
const R = 0.031; // m
const LEN = 0.2; // m, pivot to ball centre
const MASS = 1; // kg
const TS = 0.5;
const T_MAX = 24; // s of sim time, then it stops
const PULSE = 0.09; // s: how long the impact glow runs through the row
const BOX = { x0: -0.4, x1: 0.4, y0: -0.1, y1: LEN + 0.035 };
const X0 = (i) => (i - (N - 1) / 2) * 2 * R;

const COUNTS = [1, 2, 3];

const thetaOf = (h) => Math.acos(1 - h / LEN);

/** Members of the swinging group. */
function members(side, k) {
  if (side === 'all') return [0, 1, 2, 3, 4];
  if (side === 'L') return Array.from({ length: k }, (_, i) => i);
  return Array.from({ length: k }, (_, i) => N - k + i);
}

function rk4(phi, om, h) {
  const f = (p) => -(G / LEN) * Math.sin(p);
  const k1p = om;
  const k1o = f(phi);
  const k2p = om + (h / 2) * k1o;
  const k2o = f(phi + (h / 2) * k1p);
  const k3p = om + (h / 2) * k2o;
  const k3o = f(phi + (h / 2) * k2p);
  const k4p = om + h * k3o;
  const k4o = f(phi + h * k3p);
  return [phi + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p), om + (h / 6) * (k1o + 2 * k2o + 2 * k3o + k4o)];
}

const initial = (h) => ({ t: 0, side: 'L', phi: -thetaOf(h), om: 0, hits: 0, lastHit: -1, hitDir: 1, running: false, done: false });

export default function CradleSim({ T }) {
  const tx = T.cradle;
  const U = T.u;
  const dec = T.decimal;
  const [k, setK] = useState(1);
  const [hcm, setHcm] = useState(5);
  const [steel, setSteel] = useState(true);
  const h = hcm / 100;
  const [sim, setSim] = useState(() => initial(0.05));
  const started = sim.t > 0 || sim.running;

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      let { t, side, phi, om, hits, lastHit, hitDir } = p;
      const total = dt * TS;
      const nSub = Math.max(1, Math.ceil(total / (1 / 900)));
      const hs = total / nSub;
      for (let i = 0; i < nSub; i += 1) {
        [phi, om] = rk4(phi, om, hs);
        t += hs;
        if (side === 'L' && phi > 0 && om > 0) {
          hits += 1;
          lastHit = t;
          hitDir = 1;
          if (steel) side = 'R';
          else {
            side = 'all';
            om *= k / N;
            phi = 0;
          }
        } else if (side === 'R' && phi < 0 && om < 0) {
          hits += 1;
          lastHit = t;
          hitDir = -1;
          side = 'L';
        }
      }
      if (t >= T_MAX) return { ...p, t, side, phi, om, hits, lastHit, hitDir, running: false, done: true };
      return { ...p, t, side, phi, om, hits, lastHit, hitDir };
    });
  });

  const reset = (hh = h) => setSim(initial(hh));
  const toggle = () => setSim((p) => (p.done ? { ...initial(h), running: true } : { ...p, running: !p.running }));
  const pickK = (v) => {
    setK(v);
    reset();
  };
  const changeH = (v) => {
    setHcm(v);
    reset(v / 100);
  };
  const pickMat = (v) => {
    setSteel(v === 'steel');
    reset();
  };

  /* ---- physics numbers */
  const v0 = Math.sqrt(2 * G * h);
  const p0 = k * MASS * v0;
  const E0 = 0.5 * k * MASS * v0 * v0;
  const vOutInel = (k * v0) / N;
  const hOutInel = (vOutInel * vOutInel) / (2 * G);
  const lostPct = (1 - k / N) * 100;
  const theta = thetaOf(h);
  const speed = Math.abs(sim.om) * LEN;
  const nMoving = sim.side === 'all' ? N : k;

  /* ---- words */
  let key = 'idle';
  if (sim.hits === 0 && started) key = 'fall';
  else if (sim.hits > 0) {
    if (!steel) key = 'inelastic';
    else if (sim.hits >= 3) key = 'again';
    else key = `out${k}`;
  }
  const settled = useSettled(key, 0);
  const ex = tx.explain;
  const v2 = fmt(v0, 2, dec);
  let text;
  if (settled === 'fall') text = ex.fall(k, fmt(p0, 2, dec));
  else if (settled === 'out1') text = ex.out1(v2, fmt(p0, 2, dec));
  else if (settled === 'out2') text = ex.out2(v2, fmt(p0, 2, dec));
  else if (settled === 'out3') text = ex.out3(v2, fmt(p0, 2, dec));
  else if (settled === 'again') text = ex.again(k);
  else if (settled === 'inelastic') text = ex.inelastic(k, fmt(vOutInel, 2, dec), fmt(p0, 2, dec), fmt(lostPct, 0, dec), numt(hOutInel * 100, dec));
  else text = ex.idle(k, numt(hcm, dec), v2);
  const tone = settled === 'idle' ? '#22d3ee' : settled === 'fall' ? '#a78bfa' : settled === 'inelastic' ? '#fb923c' : '#34d399';

  const legend = [
    { label: tx.legend.vel, color: COL.vel, kind: 'arrow' },
    { label: tx.legend.h, color: '#7c3aed', kind: 'dash' },
    { label: tx.legend.path, color: '#94a3b8', kind: 'dash' },
  ];

  /* ---- hypotheses: n balls fly out at v′ = k·v/n */
  const rows = [1, 2, 3, 4, 5].map((n) => {
    const vn = (k * v0) / n;
    const En = 0.5 * n * MASS * vn * vn;
    return { n, vn, pn: n * MASS * vn, En, ok: steel ? n === k : n === N, real: steel ? n === k : n === N };
  });

  return (
    <div className="space-y-3 sm:space-y-4">
      <Toolbar
        label={tx.countLabel}
        value={k}
        onChange={pickK}
        cols="grid-cols-3"
        accent="#a78bfa"
        options={COUNTS.map((n) => ({ value: n, label: tx.count(n), sub: tx.countSub(n) }))}
      >
        <PlayButtons
          common={T.common}
          running={sim.running}
          started={started}
          done={sim.done}
          onToggle={toggle}
          onReset={() => reset()}
          startLabel={tx.release}
          startIcon={Hand}
        />
      </Toolbar>

      <SimScene
        legend={legend}
        chip={(W, narrow) => (
          <TimeChip text={narrow ? T.common.slowShort(2) : T.common.slow(2)} extra={sim.hits > 0 ? tx.hitsChip(sim.hits) : null} />
        )}
        ariaLabel={tx.sceneLabel(k, numt(hcm, dec), fmt(v0, 2, dec), sim.hits)}
        height={(W, narrow) => (narrow ? clamp(W * 0.62, 220, 320) : clamp(W * 0.36, 360, 430))}
      >
        {(W, H, narrow) => <CradleDrawing W={W} H={H} narrow={narrow} sim={sim} k={k} h={h} steel={steel} theta={theta} T={T} />}
      </SimScene>

      <Explain icon={Lightbulb} id={settled} tone={tone}>
        {text}
      </Explain>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Readout
          label={tx.readouts.v}
          symbol="v"
          value={fmt(v0, 2, dec)}
          unit={T.ms}
          accent={COL.vel}
          textColor={COL.velText}
          sub={tx.readouts.vSub(numt(h, dec), fmt(speed, 2, dec))}
          active={started}
        />
        <Readout
          label={tx.readouts.pIn}
          symbol="p"
          value={fmt(p0, 2, dec)}
          unit={U.kgms}
          accent={COL.b1}
          textColor={COL.b1Text}
          sub={tx.readouts.pInSub(k, numt(MASS, dec), fmt(v0, 2, dec))}
          active={started && sim.hits === 0}
        />
        <Readout
          label={tx.readouts.pOut}
          symbol="p′"
          value={sim.hits > 0 ? fmt(p0, 2, dec) : '—'}
          unit={sim.hits > 0 ? U.kgms : undefined}
          accent={COL.b2}
          textColor={COL.b2Text}
          sub={
            sim.hits === 0
              ? tx.readouts.pOutWait
              : steel
                ? tx.readouts.pOutSteel(k, fmt(v0, 2, dec))
                : tx.readouts.pOutClay(N, fmt(vOutInel, 2, dec))
          }
          active={sim.hits > 0}
        />
        <Readout
          label={tx.readouts.ek}
          symbol="Eₖ"
          value={sim.hits > 0 && !steel ? fmt(0.5 * N * MASS * vOutInel ** 2, 2, dec) : fmt(E0, 2, dec)}
          unit={U.J}
          accent={COL.ek}
          textColor={COL.ekText}
          sub={sim.hits > 0 ? (steel ? tx.readouts.ekKept(fmt(E0, 2, dec)) : tx.readouts.ekLost(fmt(E0, 2, dec), fmt(lostPct, 0, dec))) : tx.readouts.ekSub(nMoving)}
          active={sim.hits > 0}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel className="lg:col-span-2 space-y-3">
          <RangeField
            id="mc-h"
            label={tx.h}
            symbol="h"
            min={1}
            max={8}
            step={0.5}
            value={hcm}
            onChange={changeH}
            accent="#a78bfa"
            display={`${numt(hcm, dec)} ${U.cm}`}
            hint={tx.hHint(fmt((theta * 180) / Math.PI, 0, dec), fmt(v0, 2, dec))}
          />
          <div>
            <PanelTitle>{tx.matLabel}</PanelTitle>
            <Segmented
              label={tx.matLabel}
              className="grid-cols-2"
              value={steel ? 'steel' : 'clay'}
              onChange={pickMat}
              accent={steel ? '#94a3b8' : '#fb923c'}
              options={[
                { value: 'steel', label: tx.mats.steel.name, sub: tx.mats.steel.sub },
                { value: 'clay', label: tx.mats.clay.name, sub: tx.mats.clay.sub },
              ]}
            />
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2.5 text-sm leading-snug text-gray-300">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">{tx.info.title}</p>
            <p className="mt-1">{tx.info.text(numt(R * 100, dec), numt(MASS, dec), numt(LEN * 100, dec))}</p>
          </div>
        </Panel>
        <Panel className="lg:col-span-3">
          <p className="text-sm font-semibold text-gray-200">{tx.why.title(k)}</p>
          <p className="mt-1 text-xs leading-snug text-gray-500">{tx.why.lead(k, fmt(p0, 2, dec), fmt(E0, 2, dec))}</p>
          <div className="mt-2 overflow-x-auto rounded-xl bg-black/25">
            <table className="w-full min-w-[440px] text-sm tabular-nums">
              <caption className="sr-only">{tx.why.title(k)}</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-gray-500">
                  <th className="px-3 py-2 font-medium">{tx.why.cols.n}</th>
                  <th className="px-2 py-2 font-medium">v′, {T.ms}</th>
                  <th className="px-2 py-2 font-medium">p′, {U.kgms}</th>
                  <th className="px-2 py-2 font-medium">Eₖ′, {U.J}</th>
                  <th className="px-3 py-2 font-medium">{tx.why.cols.verdict}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pOk = true;
                  const eRel = r.En / E0;
                  const eOk = Math.abs(eRel - 1) < 1e-9;
                  return (
                    <tr key={r.n} className={`border-t border-white/5 ${r.real ? 'bg-emerald-400/[0.08] text-white' : 'text-gray-300'}`}>
                      <td className="px-3 py-1.5 font-semibold">{tx.why.balls(r.n)}</td>
                      <td className="px-2 py-1.5">{fmt(r.vn, 2, dec)}</td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          {fmt(r.pn, 2, dec)} {pOk && <Check size={14} aria-label={tx.why.yes} />}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center gap-1 ${eOk ? 'text-emerald-300' : eRel > 1 ? 'text-red-300' : 'text-amber-200'}`}>
                          {fmt(r.En, 2, dec)}
                          {eOk ? <Check size={14} aria-label={tx.why.yes} /> : <X size={14} aria-label={tx.why.no} />}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-xs leading-snug">
                        {r.real ? (
                          <span className="font-semibold text-emerald-300">{steel ? tx.why.real : tx.why.realClay}</span>
                        ) : eRel > 1 ? (
                          <span className="text-red-300/90">{tx.why.tooMuch(fmt(eRel, 1, dec))}</span>
                        ) : (
                          <span className="text-amber-200/90">{steel ? tx.why.tooLittle : tx.why.tooLittleClay}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-snug text-gray-500">{steel ? tx.why.note : tx.why.noteClay}</p>
        </Panel>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- scene */

function CradleDrawing({ W, H, narrow, sim, k, h, steel, theta, T }) {
  const tx = T.cradle;
  const U = T.u;
  const dec = T.decimal;
  const pad = narrow ? { l: 8, r: 8, t: 40, b: 10 } : { l: 20, r: 20, t: 54, b: 14 };
  const view = makeView(BOX, W, H, pad);
  const kpx = view.k;
  const X = view.sx;
  const Y = view.sy;
  const fs = narrow ? 10.5 : 12;
  const box = { w: W, h: H };
  const rpx = R * kpx;
  const group = members(sim.side, k);
  const pos = Array.from({ length: N }, (_, i) => {
    if (!group.includes(i)) return { x: X0(i), y: 0, moving: false };
    return { x: X0(i) + LEN * Math.sin(sim.phi), y: LEN * (1 - Math.cos(sim.phi)), moving: true };
  });
  const pivotY = LEN;
  const baseY = -R - 0.045;
  const postX = 0.36;

  // impact glow running through the row
  const since = sim.lastHit >= 0 ? sim.t - sim.lastHit : 99;
  const glow = (i) => {
    if (since > PULSE) return 0;
    const s = since / PULSE; // 0..1
    const idx = sim.hitDir > 0 ? i : N - 1 - i;
    return clamp(1 - Math.abs(s * (N - 1) - idx) * 0.9, 0, 1);
  };

  // the lifted group's height mark (shown before release)
  const showH = !sim.running && sim.t === 0;
  const lead = pos[0];
  const arcPts = (i, a0, a1) => {
    const pts = [];
    for (let j = 0; j <= 24; j += 1) {
      const a = a0 + ((a1 - a0) * j) / 24;
      pts.push(`${X(X0(i) + LEN * Math.sin(a)).toFixed(1)},${Y(LEN * (1 - Math.cos(a))).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const speed = Math.abs(sim.om) * LEN;
  const kV = narrow ? 34 : 70; // px per m/s
  const lastMover = sim.side === 'R' ? N - 1 : sim.side === 'L' ? 0 : sim.om > 0 ? N - 1 : 0;
  const showV = (sim.running || sim.t > 0) && speed > 0.04;

  return (
    <g>
      <defs>
        <radialGradient id="mc-steel" cx="35%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#cbd5e1" />
          <stop offset="80%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#334155" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#fbfcfe" />
      <Grid view={view} W={W} H={H} minPx={narrow ? 16 : 24} />

      {/* frame */}
      <rect x={X(-postX - 0.03)} y={Y(baseY)} width={(2 * postX + 0.06) * kpx} height={Math.max(6, 0.03 * kpx)} rx="4" fill="#334155" />
      {[-1, 1].map((s) => (
        <rect key={s} x={X(s * postX) - Math.max(2, 0.006 * kpx)} y={Y(pivotY + 0.012)} width={Math.max(4, 0.012 * kpx)} height={Y(baseY) - Y(pivotY + 0.012)} rx="2" fill="#475569" />
      ))}
      <rect x={X(-postX - 0.01)} y={Y(pivotY + 0.018)} width={(2 * postX + 0.02) * kpx} height={Math.max(5, 0.012 * kpx)} rx="3" fill="#475569" />

      {/* swing paths */}
      <polyline points={arcPts(0, -theta, 0)} fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />
      <polyline points={arcPts(N - 1, 0, theta)} fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="4 5" />

      {/* height mark */}
      {showH && (
        <g>
          <line x1={X(lead.x) - rpx - 6} x2={X(X0(N - 1)) + rpx + 10} y1={Y(0)} y2={Y(0)} stroke="#7c3aed" strokeWidth="1.3" strokeDasharray="5 4" />
          <line x1={X(lead.x) - rpx - 30} x2={X(lead.x) + rpx + 8} y1={Y(lead.y)} y2={Y(lead.y)} stroke="#7c3aed" strokeWidth="1.3" strokeDasharray="5 4" />
          <Arrow x1={X(lead.x) - rpx - 22} y1={Y(0)} x2={X(lead.x) - rpx - 22} y2={Y(lead.y) + 1} color="#7c3aed" width={1.8} head={7} />
          <RichPill x={X(lead.x) - rpx - 22} y={(Y(0) + Y(lead.y)) / 2} text={tx.hTag(numt(h * 100, dec), U.cm)} bg="#7c3aed" size={fs} box={box} />
        </g>
      )}

      {/* strings */}
      {pos.map((p, i) => (
        <line key={`s${i}`} x1={X(X0(i))} y1={Y(pivotY)} x2={X(p.x)} y2={Y(p.y)} stroke="#334155" strokeWidth={narrow ? 1 : 1.4} />
      ))}

      {/* plasticine dabs between the balls */}
      {!steel &&
        [0, 1, 2, 3].map((i) => {
          const a = pos[i];
          const b = pos[i + 1];
          const gap = Math.hypot(b.x - a.x, b.y - a.y);
          if (gap > 2 * R + 0.004) return null;
          return <ellipse key={`c${i}`} cx={X((a.x + b.x) / 2)} cy={Y((a.y + b.y) / 2)} rx={Math.max(2, 0.006 * kpx)} ry={Math.max(3, 0.012 * kpx)} fill="#ea580c" stroke="#9a3412" strokeWidth="0.8" />;
        })}

      {/* balls */}
      {pos.map((p, i) => {
        const g = glow(i);
        return (
          <g key={`b${i}`}>
            {g > 0.02 && <circle cx={X(p.x)} cy={Y(p.y)} r={rpx + 4 + 6 * g} fill="#fbbf24" opacity={0.55 * g} />}
            <circle cx={X(p.x)} cy={Y(p.y)} r={rpx} fill="url(#mc-steel)" stroke="#1e293b" strokeWidth="1" />
            {rpx > 11 && (
              <text x={X(p.x)} y={Y(p.y) + fs * 0.38} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#0f172a" opacity="0.75">
                {i + 1}
              </text>
            )}
          </g>
        );
      })}

      {/* velocity of the moving group */}
      {showV &&
        group.map((i) => {
          const p = pos[i];
          const dirX = Math.cos(sim.phi) * Math.sign(sim.om);
          const dirY = Math.sin(sim.phi) * Math.sign(sim.om);
          const len = speed * kV;
          const cx = X(p.x);
          const cy = Y(p.y) - rpx - (narrow ? 8 : 12);
          return <Arrow key={`v${i}`} x1={cx} y1={cy} x2={cx + dirX * len} y2={cy - dirY * len} color={COL.vel} width={narrow ? 2 : 2.8} head={narrow ? 7 : 10} />;
        })}
      {showV && (
        <RichPill
          x={X(pos[lastMover].x) + (lastMover === 0 ? -1 : 1) * (narrow ? 26 : 44)}
          y={Y(pos[lastMover].y) - rpx - (narrow ? 28 : 40)}
          text={tx.vTag(fmt(speed, 2, dec), T.ms)}
          bg={COL.vel}
          size={fs}
          box={box}
        />
      )}

      {/* impact flash */}
      {since < PULSE * 1.6 && (
        <Tag x={X(sim.hitDir > 0 ? X0(k - 1) + R : X0(N - k) - R)} y={Y(R + 0.02)} text={tx.click} color="#d97706" size={fs + 1} italic={false} weight={800} />
      )}

      {sim.side === 'all' && sim.hits > 0 && <RichPill x={X(0)} y={Y(baseY) - (narrow ? 14 : 18)} text={tx.together(sfmt((k * Math.sqrt(2 * G * h)) / N, 2, dec), T.ms)} bg="#ea580c" size={fs} box={box} />}
    </g>
  );
}
