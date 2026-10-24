import { memo } from 'react';
import { CELL, CHINOR, H, W } from './VariantDrawGame.geom';

/**
 * Drawing pieces for the park map. Everything is in metres (the SVG viewBox is
 * the park), except things that must stay a readable size on screen - labels,
 * the walker, the flag - which take `k` (screen pixels per metre) and divide
 * their pixel sizes by it.
 */

const TREES = [
  [8, 16, 3], [16, 13.5, 2.4], [25, 17, 3.1], [6, 29, 2.7], [17, 31, 2.3], [29, 31.5, 2.5],
  [49, 29, 2.7], [80, 22, 2.8], [101, 20, 3.1], [113, 15.5, 2.7], [115, 29, 2.4],
  [113, 70, 3], [101, 73, 2.5], [84, 73, 2.9], [71, 66, 2.6], [46, 73, 2.5], [49, 56, 2.3],
  [74, 50, 2.1], [116, 51, 2.4], [3, 46, 2.2], [36, 77, 2.2],
];

const LAMPS = [[20, 37.5], [42, 43.5], [80, 36], [101, 37], [63.5, 22], [56.5, 58]];
const FLOWERS = [
  [76, 30, '#f472b6'], [77.5, 31.2, '#facc15'], [75, 31.6, '#c084fc'], [78.3, 29.4, '#f472b6'],
  [43, 48, '#facc15'], [44.6, 49.2, '#f472b6'], [42.2, 49.6, '#c084fc'], [45.3, 47.4, '#38bdf8'],
  [97, 66, '#f472b6'], [98.4, 67, '#facc15'], [96, 67.3, '#c084fc'],
];

const WALKS = [
  'M 0 41 C 18 37, 40 44, 60 40 S 98 35, 120 41',
  'M 60 10.5 C 61.5 20, 58 30, 60 40 S 62.5 66, 57 80',
  'M 0 77 C 14 76, 30 75, 42 71 S 53 52, 60 40',
];

const POND = 'M 80 47 C 81 39, 97 37, 105 42 S 110 58, 99 62 S 79 59, 80 47 Z';

function Label({ x, y, k, children, size = 10.5, opacity = 0.62, anchor = 'middle' }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size / k}
      fontWeight={600}
      textAnchor={anchor}
      fill="#ffffff"
      fillOpacity={opacity}
      stroke="#04110d"
      strokeOpacity={0.7}
      strokeWidth={3 / k}
      paintOrder="stroke"
      style={{ letterSpacing: `${0.4 / k}px` }}
    >
      {children}
    </text>
  );
}

function Tree({ x, y, r, big = false }) {
  return (
    <g>
      <circle cx={x + r * 0.28} cy={y + r * 0.34} r={r} fill="#000" opacity={0.35} />
      <circle cx={x} cy={y} r={r} fill={big ? 'url(#dg-chinor)' : 'url(#dg-tree)'} />
      {big && (
        <>
          <circle cx={x - r * 0.38} cy={y - r * 0.12} r={r * 0.42} fill="#3d9a5f" opacity={0.55} />
          <circle cx={x + r * 0.32} cy={y + r * 0.3} r={r * 0.38} fill="#1f6b43" opacity={0.6} />
          <circle cx={x + r * 0.2} cy={y - r * 0.42} r={r * 0.3} fill="#57b97a" opacity={0.45} />
        </>
      )}
      <circle cx={x - r * 0.32} cy={y - r * 0.34} r={r * 0.32} fill="#8ee6a9" opacity={0.16} />
    </g>
  );
}

/** The static park: grass, street with a bus, walkways, pond, mini stadium, trees and the metre grid. */
export const ParkMap = memo(function ParkMap({ k, labels, glowChinor }) {
  const px = (v) => v / k;
  return (
    <g>
      <defs>
        <radialGradient id="dg-grass" cx="50%" cy="58%" r="78%">
          <stop offset="0" stopColor="#163f33" />
          <stop offset="0.65" stopColor="#0f2c25" />
          <stop offset="1" stopColor="#08191a" />
        </radialGradient>
        <radialGradient id="dg-water" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#11507a" />
          <stop offset="1" stopColor="#0a2c48" />
        </radialGradient>
        <radialGradient id="dg-tree" cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#3faa6b" />
          <stop offset="1" stopColor="#17573a" />
        </radialGradient>
        <radialGradient id="dg-chinor" cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#4cc07d" />
          <stop offset="1" stopColor="#145a36" />
        </radialGradient>
        <radialGradient id="dg-lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dg-vignette" cx="50%" cy="50%" r="72%">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <pattern id="dg-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="#e2fbf3" strokeOpacity={0.085} strokeWidth={px(1)} />
        </pattern>
      </defs>

      {/* grass */}
      <rect x={0} y={0} width={W} height={H} fill="url(#dg-grass)" />
      {[[20, 22, 9, 5], [88, 26, 10, 6], [36, 60, 8, 4], [104, 74, 9, 4], [70, 76, 7, 3]].map(([x, y, rx, ry]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill="#1c4d3c" opacity={0.35} />
      ))}

      {/* street along the top, with a bus at the stop */}
      <rect x={0} y={0} width={W} height={8} fill="#15141d" />
      <line x1={0} y1={4} x2={W} y2={4} stroke="#fbbf24" strokeOpacity={0.5} strokeWidth={px(1.6)} strokeDasharray="3 2.4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={55.6 + i * 1.8} y={0.6} width={0.9} height={6.8} fill="#fff" opacity={0.18} />
      ))}
      <rect x={0} y={8} width={W} height={2.2} fill="#2a2938" />
      <line x1={0} y1={10.6} x2={W} y2={10.6} stroke="#14532d" strokeWidth={0.9} strokeLinecap="round" />
      <g transform="translate(66 1.4)">
        <rect x={0} y={0} width={13} height={4.6} rx={0.9} fill="#f59e0b" />
        <rect x={0.6} y={0.55} width={11.8} height={3.5} rx={0.6} fill="#fbbf24" />
        {[1.2, 3.6, 6, 8.4].map((x) => (
          <rect key={x} x={x} y={0.8} width={1.8} height={0.7} rx={0.2} fill="#1e293b" opacity={0.75} />
        ))}
        <rect x={11.3} y={0.9} width={1.2} height={2.8} rx={0.3} fill="#0f172a" opacity={0.8} />
      </g>
      <rect x={88} y={8.5} width={6} height={1.3} rx={0.4} fill="#64748b" />
      <Label x={91} y={13.6} k={k} size={9.5}>{labels.stop}</Label>
      <Label x={30} y={5.4} k={k} size={9.5} anchor="start" opacity={0.45}>{labels.street}</Label>

      {/* walkways */}
      {WALKS.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="#0b1f18" strokeOpacity={0.6} strokeWidth={4.2} strokeLinecap="round" />
          <path d={d} fill="none" stroke="#d9bd84" strokeOpacity={0.22} strokeWidth={3.2} strokeLinecap="round" />
        </g>
      ))}
      <ellipse cx={93} cy={50} rx={17.5} ry={14} fill="none" stroke="#d9bd84" strokeOpacity={0.16} strokeWidth={2.2} />

      {/* pond */}
      <path d={POND} fill="url(#dg-water)" stroke="#38bdf8" strokeOpacity={0.4} strokeWidth={px(1.6)} />
      <ellipse cx={92} cy={49} rx={7} ry={3.6} fill="none" stroke="#7dd3fc" strokeOpacity={0.14} strokeWidth={px(1.2)} />
      <ellipse cx={96} cy={54} rx={4} ry={1.8} fill="none" stroke="#7dd3fc" strokeOpacity={0.12} strokeWidth={px(1.2)} />
      {[[86, 55, 1.3], [88.6, 57, 0.9], [102, 46, 1.1]].map(([x, y, r]) => (
        <path key={x} d={`M ${x} ${y} m ${r} 0 A ${r} ${r} 0 1 1 ${x + r * 0.3} ${y - r * 0.95} L ${x} ${y} Z`} fill="#22c55e" opacity={0.6} />
      ))}
      <g transform="translate(98.5 50.5)">
        <ellipse rx={1.1} ry={0.7} fill="#f8fafc" opacity={0.9} />
        <circle cx={0.9} cy={-0.35} r={0.45} fill="#f8fafc" />
        <path d="M 1.3 -0.4 l 0.6 0.1 l -0.6 0.2 Z" fill="#fb923c" />
      </g>
      <rect x={77.6} y={48.6} width={4} height={2.4} rx={0.3} fill="#7c4a24" opacity={0.85} />
      <Label x={93} y={45.5} k={k}>{labels.lake}</Label>

      {/* mini stadium */}
      <rect x={6} y={48} width={36} height={20} rx={10} fill="#8a3324" opacity={0.92} />
      <rect x={7.3} y={49.3} width={33.4} height={17.4} rx={8.7} fill="none" stroke="#fff" strokeOpacity={0.32} strokeWidth={px(1)} />
      <rect x={8.6} y={50.6} width={30.8} height={14.8} rx={7.4} fill="none" stroke="#fff" strokeOpacity={0.32} strokeWidth={px(1)} />
      <rect x={10} y={52} width={28} height={12} rx={6} fill="#167a3e" />
      <line x1={24} y1={52} x2={24} y2={64} stroke="#fff" strokeOpacity={0.35} strokeWidth={px(1)} />
      <circle cx={24} cy={58} r={2.2} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={px(1)} />
      <Label x={24} y={61.6} k={k} opacity={0.7}>{labels.stadium}</Label>

      {/* playground */}
      <rect x={34} y={14} width={14} height={11} rx={2} fill="#b45309" fillOpacity={0.3} stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={px(1)} />
      <rect x={36} y={16} width={2} height={6} rx={0.6} fill="#f87171" opacity={0.75} />
      <circle cx={44} cy={19.5} r={2} fill="none" stroke="#38bdf8" strokeOpacity={0.7} strokeWidth={0.5} />
      <line x1={40} y1={16} x2={40} y2={23} stroke="#e2e8f0" strokeOpacity={0.5} strokeWidth={0.35} />
      <Label x={41} y={28.4} k={k} size={9.5}>{labels.playground}</Label>

      {/* fountain */}
      <circle cx={60} cy={40} r={4.8} fill="#334155" />
      <circle cx={60} cy={40} r={3.7} fill="#0e7490" />
      <circle cx={60} cy={40} r={2.4} fill="none" stroke="#67e8f9" strokeOpacity={0.5} strokeWidth={px(1.2)} />
      <circle cx={60} cy={40} r={0.9} fill="#a5f3fc" />
      <Label x={60} y={47.6} k={k} size={9.5}>{labels.fountain}</Label>

      {/* benches and flowers */}
      {[[52.5, 44.5, 0], [66, 34.2, 0], [86, 39.2, 0], [24, 44.5, 0]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={3} height={0.9} rx={0.25} fill="#a16207" opacity={0.85} />
      ))}
      {FLOWERS.map(([x, y, c]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={0.55} fill={c} opacity={0.85} />
      ))}

      {/* trees */}
      {TREES.map(([x, y, r]) => (
        <Tree key={`${x}-${y}`} x={x} y={y} r={r} />
      ))}
      {glowChinor && (
        <circle cx={CHINOR.x} cy={CHINOR.y} r={8} fill="#fbbf24" fillOpacity={0.12} stroke="#fbbf24" strokeWidth={px(2)} strokeDasharray={`${px(6)} ${px(4)}`} className="animate-pulse" />
      )}
      <Tree x={CHINOR.x} y={CHINOR.y} r={5.4} big />
      <Label x={CHINOR.x} y={CHINOR.y + 8.6} k={k} opacity={glowChinor ? 0.95 : 0.7}>{labels.chinor}</Label>

      {/* lamps (it is evening in the park) */}
      {LAMPS.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={3.2} fill="url(#dg-lamp)" />
          <circle cx={x} cy={y} r={0.45} fill="#fef3c7" />
        </g>
      ))}

      {/* the metre grid sits on top of everything, like tracing paper */}
      <rect x={0} y={0} width={W} height={H} fill="url(#dg-grid)" />
      <rect x={0} y={0} width={W} height={H} fill="url(#dg-vignette)" />
    </g>
  );
});

/** The coordinate axes of the chosen frame, with a tick every 10 m. */
export function Axes({ origin, k, labels }) {
  const px = (v) => v / k;
  const color = '#c4b5fd';
  const ticksX = [];
  for (let n = -12; n <= 12; n += 1) {
    const x = origin.x + n * 10;
    if (n !== 0 && x > 1.5 && x < W - 4) ticksX.push({ x, n: n * 10 });
  }
  const ticksY = [];
  for (let n = -8; n <= 8; n += 1) {
    const y = origin.y - n * 10;
    if (n !== 0 && y > 4 && y < H - 1.5) ticksY.push({ y, n: n * 10 });
  }
  const below = origin.y < H - 5; // room for x labels under the axis?
  const left = origin.x > 6; // room for y labels left of the axis?
  const fs = Math.max(8.5, Math.min(10.5, k * 1.6));
  const textProps = {
    fontSize: px(fs),
    fill: color,
    fillOpacity: 0.9,
    stroke: '#05140f',
    strokeWidth: px(3),
    paintOrder: 'stroke',
    fontWeight: 600,
    style: { fontVariantNumeric: 'tabular-nums' },
  };
  const ah = px(8);
  return (
    <g pointerEvents="none">
      <line x1={0} y1={origin.y} x2={W - px(2)} y2={origin.y} stroke={color} strokeOpacity={0.75} strokeWidth={px(1.6)} />
      <line x1={origin.x} y1={H} x2={origin.x} y2={px(2)} stroke={color} strokeOpacity={0.75} strokeWidth={px(1.6)} />
      <path d={`M ${W - px(1)} ${origin.y} l ${-ah} ${-ah * 0.5} l 0 ${ah} Z`} fill={color} />
      <path d={`M ${origin.x} ${px(1)} l ${-ah * 0.5} ${ah} l ${ah} 0 Z`} fill={color} />
      {ticksX.map((t) => (
        <g key={`x${t.n}`}>
          <line x1={t.x} y1={origin.y - px(4)} x2={t.x} y2={origin.y + px(4)} stroke={color} strokeWidth={px(1.4)} />
          <text {...textProps} x={t.x} y={below ? origin.y + px(fs + 5) : origin.y - px(7)} textAnchor="middle">
            {t.n < 0 ? `−${-t.n}` : t.n}
          </text>
        </g>
      ))}
      {ticksY.map((t) => (
        <g key={`y${t.n}`}>
          <line x1={origin.x - px(4)} y1={t.y} x2={origin.x + px(4)} y2={t.y} stroke={color} strokeWidth={px(1.4)} />
          <text {...textProps} x={left ? origin.x - px(7) : origin.x + px(7)} y={t.y + px(fs * 0.35)} textAnchor={left ? 'end' : 'start'}>
            {t.n < 0 ? `−${-t.n}` : t.n}
          </text>
        </g>
      ))}
      <text {...textProps} x={W - px(4)} y={below ? origin.y - px(8) : origin.y + px(fs + 6)} textAnchor="end" fontStyle="italic">
        {labels.xAxis}
      </text>
      <text {...textProps} x={origin.x + px(left ? 8 : -8)} y={px(fs + 4)} textAnchor={left ? 'start' : 'end'} fontStyle="italic">
        {labels.yAxis}
      </text>
    </g>
  );
}

/** The reference body: a flag with a little clock (a frame of reference is body + axes + clock). */
export function OriginFlag({ x, y, k, clockDeg = 0, label, ghost = false }) {
  const s = 1 / k;
  if (ghost) {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`} opacity={0.4} pointerEvents="none">
        <line x1={0} y1={0} x2={0} y2={-24} stroke="#e9d5ff" strokeWidth={2} strokeDasharray="3 3" />
        <path d="M 0 -24 L 14 -19.5 L 0 -15 Z" fill="none" stroke="#c4b5fd" strokeWidth={1.5} />
        <circle r={3.5} fill="none" stroke="#c4b5fd" strokeWidth={1.5} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <circle r={10} fill="#8b5cf6" opacity={0.22} />
      <line x1={0} y1={0} x2={0} y2={-26} stroke="#f5f3ff" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M 1 -26 L 17 -21 L 1 -16 Z" fill="#a78bfa" stroke="#ede9fe" strokeWidth={1} strokeLinejoin="round" />
      <circle r={4} fill="#f5f3ff" stroke="#7c3aed" strokeWidth={2} />
      <text x={-7} y={13} fontSize={11} fontWeight={800} fill="#ede9fe" stroke="#1e1b4b" strokeWidth={3} paintOrder="stroke" textAnchor="end">
        O
      </text>
      <g transform="translate(-15 -12)">
        <circle r={6.5} fill="#1e1b4b" stroke="#c4b5fd" strokeWidth={1.5} />
        <line x1={0} y1={0} x2={0} y2={-4.4} stroke="#fde68a" strokeWidth={1.5} strokeLinecap="round" transform={`rotate(${clockDeg})`} />
        <circle r={1} fill="#fde68a" />
      </g>
      {label && (
        <text x={4} y={-33} fontSize={10.5} fontWeight={700} fill="#ddd6fe" stroke="#140b2e" strokeWidth={3} paintOrder="stroke">
          {label}
        </text>
      )}
    </g>
  );
}

/** The walker seen from above: cap, shoulders, backpack and stepping feet. */
export function Walker({ x, y, k, angle, phase, moving }) {
  const s = (k < 4 ? 1.05 : 1.35) / k;
  const step = moving ? Math.sin(phase) * 4 : 0;
  const bob = moving ? 1 + Math.abs(Math.sin(phase)) * 0.05 : 1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <circle r={moving ? 17 : 15} fill="#22d3ee" opacity={moving ? 0.16 : 0.1} />
      <g transform={`rotate(${angle}) scale(${bob})`}>
        <ellipse cx={2} cy={2.5} rx={9} ry={10} fill="#000" opacity={0.35} />
        <ellipse cx={2 + step} cy={-4.2} rx={3.2} ry={2} fill="#1e293b" />
        <ellipse cx={2 - step} cy={4.2} rx={3.2} ry={2} fill="#1e293b" />
        <rect x={-8.5} y={-5} width={5} height={10} rx={2} fill="#7c3aed" />
        <ellipse cx={0} cy={0} rx={6.5} ry={9} fill="#f472b6" stroke="#fff" strokeOpacity={0.7} strokeWidth={1} />
        <circle cx={0.6} cy={0} r={5} fill="#fcd7b0" />
        <path d="M -4.4 -2.4 A 5 5 0 0 1 4.4 -2.4 L 4.4 2.4 A 5 5 0 0 1 -4.4 2.4 Z" fill="#22d3ee" />
        <path d="M 4.2 -3.6 Q 9 0 4.2 3.6 Z" fill="#0891b2" />
        <circle cx={-1} cy={0} r={1.2} fill="#ecfeff" opacity={0.8} />
      </g>
    </g>
  );
}
