import { useState } from 'react';

import { Pill, clamp, useRafLoop } from '../kit/ui';
import { PALETTE } from '../kit/scene';
import { Vehicle, nf } from './UniformMotion.parts';

/**
 * What the two graph simulators of "Tekis harakatning grafik tasviri" share:
 * a straight track from −20 m to 100 m with a cart on it, the 8-second run
 * (real time) that stops early if the cart reaches the end of the track, and
 * scrubbing - dragging along a graph moves the cart to that moment.
 */

export const X_MIN = -20;
export const X_MAX = 100;
export const T_END = 8;
export const CART = '#f59e0b';

/** The moment the run ends: 8 s, or earlier when the cart reaches an end of the track. */
export function endTime(x0, v) {
  if (v > 1e-9) return Math.min(T_END, (X_MAX - x0) / v);
  if (v < -1e-9) return Math.min(T_END, (X_MIN - x0) / v);
  return T_END;
}

/** Run state: time t, the furthest time reached tMax, play / pause / restart / scrub. */
export function useRun(x0, v) {
  const tEnd = endTime(x0, v);
  const [sim, setSim] = useState({ t: 0, tMax: 0, running: false });

  useRafLoop(sim.running, (dt) => {
    setSim((p) => {
      if (!p.running) return p;
      const t = Math.min(p.t + dt, tEnd);
      return { t, tMax: Math.max(p.tMax, t), running: t < tEnd - 1e-9 };
    });
  });

  const atEnd = sim.t >= tEnd - 1e-9;
  return {
    ...sim,
    tEnd,
    done: sim.tMax >= tEnd - 1e-9,
    atEnd,
    toggle: () => {
      if (sim.running) setSim((p) => ({ ...p, running: false }));
      else if (atEnd) setSim({ t: 0, tMax: 0, running: true });
      else setSim((p) => ({ ...p, running: true }));
    },
    reset: () => setSim({ t: 0, tMax: 0, running: false }),
    scrub: (tt) => {
      const t = clamp(tt, 0, tEnd);
      setSim((p) => ({ t, tMax: Math.max(p.tMax, t), running: false }));
    },
  };
}

/** Which label the play button shows. */
export function playLabel(run, common) {
  if (run.running) return common.pause;
  if (run.atEnd) return common.again;
  return run.t > 0 ? common.resume : common.start;
}

/**
 * The track drawn across the scene at rail height `y`: ruler (x, m), the
 * start mark x₀, the cart at x with its velocity arrow and coordinate tag.
 * `X` maps metres to px. Returns an SVG group.
 */
export function Track({ X, y, narrow, x0, x, xLabel = x, v, moving, labels, dec, W, H }) {
  const fs = narrow ? 11 : 12;
  const len = narrow ? 46 : 62;
  const cartH = len * 0.44;
  const box = { w: W, h: H };
  const ticks = [];
  for (let m = X_MIN; m <= X_MAX; m += 5) ticks.push(m);
  const every = narrow ? 20 : 10;
  const facing = v < 0 ? -1 : 1;
  const velLen = Math.abs(v) * (narrow ? 4.2 : 6);
  const cx = X(x);
  return (
    <g>
      <rect x={X(X_MIN) - 12} y={y} width={X(X_MAX) - X(X_MIN) + 24} height={4} rx={2} fill="#475569" />
      {ticks.map((m) => {
        const major = m % every === 0;
        return (
          <g key={m}>
            <line x1={X(m)} x2={X(m)} y1={y + 4} y2={y + (m % 10 === 0 ? 11 : 8)} stroke="#64748b" strokeWidth={m % 10 === 0 ? 1.3 : 1} />
            {major && (
              <text x={X(m)} y={y + 24} textAnchor="middle" fontSize={fs - 1} fill={m === 0 ? PALETTE.ink : '#64748b'} fontWeight={m === 0 ? 700 : 400}>
                {nf(m, 0, dec)}
              </text>
            )}
          </g>
        );
      })}
      <text x={W - 4} y={y - 8} textAnchor="end" fontSize={fs - 1} fontWeight="700" fill="#475569">
        {labels.axis}
      </text>

      {/* start mark */}
      <path d={`M${X(x0)},${y + 1} L${X(x0) - 5},${y + 10} L${X(x0) + 5},${y + 10} Z`} fill={PALETTE.ink} />

      {/* cart, its point and its coordinate */}
      <Vehicle kind="cart" x={cx} y={y} len={len} color={CART} facing={facing} />
      <circle cx={cx} cy={y + 2} r={4.2} fill={PALETTE.disp} stroke="#fff" strokeWidth="1.6" />
      <Pill x={cx} y={y - cartH - (narrow ? 16 : 20)} text={labels.xTag(nf(xLabel, 1, dec))} bg={PALETTE.disp} size={fs} box={box} />
      {moving && velLen > 3 && (
        <g>
          <line
            x1={cx + facing * (len / 2 + 3)}
            x2={cx + facing * (len / 2 + 3 + velLen - 8)}
            y1={y - cartH * 0.55}
            y2={y - cartH * 0.55}
            stroke={PALETTE.vel}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={`M${cx + facing * (len / 2 + 3 + velLen)},${y - cartH * 0.55} l${-facing * 10},-5 l0,10 Z`}
            fill={PALETTE.vel}
          />
        </g>
      )}
    </g>
  );
}

/** Metres → px for the track, with the given side paddings. */
export function trackScale(W, padL, padR) {
  return (m) => padL + ((m - X_MIN) / (X_MAX - X_MIN)) * (W - padL - padR);
}
