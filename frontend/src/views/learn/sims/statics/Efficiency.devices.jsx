/**
 * Small SVG drawings of the six devices of the "Machines" tab (electric
 * motor, petrol car, incandescent and LED bulbs, a cyclist, a solar panel),
 * drawn in a 100 × 100 box centred on (0, 0) and scaled to `size` px. When
 * `on`, they come alive with `phase` (seconds): the shaft and the wheels
 * turn, the filament glows, sunrays run. No words inside.
 */

const TAU = Math.PI * 2;

function Spokes({ r, angle, color = '#9ca3af', n = 4, width = 1.6 }) {
  return (
    <g transform={`rotate(${((angle * 180) / Math.PI).toFixed(1)})`}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * TAU;
        return <line key={i} x1={0} y1={0} x2={r * Math.cos(a)} y2={r * Math.sin(a)} stroke={color} strokeWidth={width} strokeLinecap="round" />;
      })}
    </g>
  );
}

/** Wavy "heat" lines rising from (x, y). */
function HeatWaves({ x, y, n = 3, gap = 8, h = 16, color = '#f97316', phase = 0, opacity = 0.85 }) {
  return (
    <g opacity={opacity} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const x0 = x + (i - (n - 1) / 2) * gap;
        const lift = ((phase * 10 + i * 5) % 6) - 3;
        const y0 = y - lift;
        return <path key={i} d={`M${x0},${y0} q3,${-h / 4} 0,${-h / 2} q-3,${-h / 4} 0,${-h / 2}`} />;
      })}
    </g>
  );
}

function Motor({ phase, on }) {
  const ang = on ? phase * 9 : 0;
  return (
    <g>
      <rect x={-40} y={26} width={74} height={7} rx={2} fill="#475569" />
      <rect x={-30} y={20} width={8} height={8} fill="#64748b" />
      <rect x={6} y={20} width={8} height={8} fill="#64748b" />
      <rect x={-36} y={-24} width={56} height={46} rx={9} fill="#94a3b8" stroke="#334155" strokeWidth="2" />
      {[-28, -22, -16, -10, -4, 2, 8, 14].map((x) => (
        <line key={x} x1={x} x2={x} y1={-19} y2={17} stroke="#64748b" strokeWidth="1.4" />
      ))}
      <rect x={20} y={-18} width={9} height={34} rx={3} fill="#64748b" stroke="#334155" strokeWidth="1.5" />
      <rect x={29} y={-3} width={14} height={6} fill="#475569" />
      <g transform="translate(44 0)">
        <circle r={9} fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
        <Spokes r={7} angle={ang} color="#475569" n={3} />
        <circle r={1.8} fill="#334155" />
      </g>
      <path d="M-36,8 C-44,10 -46,22 -48,34" fill="none" stroke="#1f2937" strokeWidth="2.4" strokeLinecap="round" />
      <rect x={-51} y={33} width={7} height={6} rx={1.5} fill="#1f2937" />
      <path d="M-11,-13 L-17,1 L-10,1 L-14,13 L-3,-3 L-10,-3 L-6,-13 Z" fill={on ? '#facc15' : '#e2e8f0'} stroke="#334155" strokeWidth="1" />
      {on && <HeatWaves x={-8} y={-28} n={2} gap={12} h={14} phase={phase} opacity={0.5} />}
    </g>
  );
}

function CarDrawing({ phase, on }) {
  const ang = on ? phase * 10 : 0;
  const puff = (i) => {
    const p = on ? (phase * 0.9 + i / 3) % 1 : 0;
    return { x: -50 - p * 14, y: 8 - p * 10, r: 2.5 + p * 4.5, o: on ? 0.55 * (1 - p) : 0 };
  };
  return (
    <g>
      {[0, 1, 2].map((i) => {
        const q = puff(i);
        return <circle key={i} cx={q.x} cy={q.y} r={q.r} fill="#94a3b8" opacity={q.o} />;
      })}
      <rect x={-49} y={7} width={6} height={3} fill="#475569" />
      <path
        d="M-46,12 L-46,0 Q-45,-7 -35,-9 L-22,-11 L-11,-23 Q-9,-25 -6,-25 L17,-25 Q20,-25 22,-23 L32,-11 L41,-9 Q48,-7 48,1 L48,12 Z"
        fill="#3b82f6"
        stroke="#1e3a8a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M-8,-21 L4,-21 L4,-12 L-16,-12 Z" fill="#dbeafe" stroke="#1e3a8a" strokeWidth="1.2" />
      <path d="M8,-21 L17,-21 L26,-12 L8,-12 Z" fill="#dbeafe" stroke="#1e3a8a" strokeWidth="1.2" />
      <rect x={42} y={-5} width={6} height={4} rx={1.5} fill="#fde68a" />
      <line x1={-2} x2={4} y1={-4} y2={-4} stroke="#1e3a8a" strokeWidth="1.5" />
      {[-26, 30].map((x) => (
        <g key={x} transform={`translate(${x} 13)`}>
          <circle r={11} fill="#1f2937" />
          <circle r={6} fill="#cbd5e1" />
          <Spokes r={5.5} angle={ang} color="#475569" n={5} width={1.4} />
          <circle r={1.6} fill="#334155" />
        </g>
      ))}
      <line x1={-50} x2={52} y1={25} y2={25} stroke="#94a3b8" strokeWidth="1.5" />
      {on && <HeatWaves x={-2} y={-30} n={3} gap={9} h={13} phase={phase} opacity={0.55} />}
    </g>
  );
}

function Bulb({ phase, on, led }) {
  const glow = on ? 0.8 + 0.08 * Math.sin(phase * 7) : 0;
  const id = led ? 'eff-led-glow' : 'eff-bulb-glow';
  const lightColor = led ? '#fef9c3' : '#fde68a';
  return (
    <g>
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={led ? '#fffbeb' : '#fdba74'} stopOpacity="0.95" />
          <stop offset="55%" stopColor={led ? '#fde68a' : '#fb923c'} stopOpacity="0.35" />
          <stop offset="100%" stopColor={led ? '#fde68a' : '#f97316'} stopOpacity="0" />
        </radialGradient>
      </defs>
      {on && <circle cx={0} cy={-12} r={led ? 46 : 42} fill={`url(#${id})`} opacity={glow} />}
      {on &&
        Array.from({ length: led ? 10 : 5 }, (_, i) => {
          const a = -Math.PI / 2 + ((i - (led ? 4.5 : 2)) / (led ? 10 : 5)) * Math.PI * 1.25;
          return (
            <line
              key={i}
              x1={Math.cos(a) * 31}
              y1={-12 + Math.sin(a) * 31}
              x2={Math.cos(a) * (led ? 43 : 37)}
              y2={-12 + Math.sin(a) * (led ? 43 : 37)}
              stroke="#eab308"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      <path
        d="M-12,12 C-12,4 -26,-2 -26,-14 A26,26 0 1 1 26,-14 C26,-2 12,4 12,12 Z"
        fill={on ? lightColor : '#f8fafc'}
        fillOpacity={on ? 0.95 : 0.9}
        stroke="#94a3b8"
        strokeWidth="2"
      />
      {led ? (
        <>
          <rect x={-10} y={-6} width={20} height={6} rx={1.5} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          {[-6, -1, 4].map((x) => (
            <rect key={x} x={x} y={-5} width={3} height={3} fill={on ? '#fffbeb' : '#fef08a'} stroke="#ca8a04" strokeWidth="0.6" />
          ))}
          <path d="M-13,12 L13,12 L10,30 L-10,30 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
          {[-6, -2, 2, 6].map((x) => (
            <line key={x} x1={x} x2={x * 0.8} y1={14} y2={28} stroke="#94a3b8" strokeWidth="1.2" />
          ))}
          <rect x={-7} y={30} width={14} height={7} rx={2} fill="#94a3b8" />
        </>
      ) : (
        <>
          <line x1={-6} y1={10} x2={-8} y2={-10} stroke="#64748b" strokeWidth="1.2" />
          <line x1={6} y1={10} x2={8} y2={-10} stroke="#64748b" strokeWidth="1.2" />
          <polyline
            points="-8,-10 -5,-15 -2,-10 1,-15 4,-10 7,-15 8,-10"
            fill="none"
            stroke={on ? '#f97316' : '#64748b'}
            strokeWidth={on ? 2.2 : 1.6}
            strokeLinejoin="round"
          />
          <rect x={-12} y={12} width={24} height={18} rx={2} fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
          {[16, 21, 26].map((y) => (
            <line key={y} x1={-12} x2={12} y1={y} y2={y + 2} stroke="#94a3b8" strokeWidth="1.2" />
          ))}
          <path d="M-6,30 L6,30 L3,37 L-3,37 Z" fill="#475569" />
        </>
      )}
      {on && <HeatWaves x={led ? 22 : 0} y={led ? 2 : -42} n={led ? 1 : 4} gap={9} h={16} phase={phase} opacity={led ? 0.5 : 0.9} color="#ef4444" />}
    </g>
  );
}

function Cyclist({ phase, on }) {
  const ang = on ? phase * 6 : 0.6;
  const bb = { x: -2, y: 22 };
  const crank = 8;
  const pedal = { x: bb.x + crank * Math.cos(ang), y: bb.y + crank * Math.sin(ang) };
  const pedal2 = { x: bb.x - crank * Math.cos(ang), y: bb.y - crank * Math.sin(ang) };
  const hip = { x: -9, y: -6 };
  const knee = (p) => {
    const L1 = 16.5;
    const dx = p.x - hip.x;
    const dy = p.y - hip.y;
    const d = Math.min(Math.hypot(dx, dy), 2 * L1 - 0.5);
    const mx = hip.x + dx / 2;
    const my = hip.y + dy / 2;
    const h = Math.sqrt(Math.max(0, L1 * L1 - (d / 2) ** 2));
    const len = Math.hypot(dx, dy) || 1;
    return { x: mx + (-dy / len) * -h, y: my + (dx / len) * -h };
  };
  const k1 = knee(pedal);
  const k2 = knee(pedal2);
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1={-50} x2={50} y1={39} y2={39} stroke="#94a3b8" strokeWidth="1.5" />
      {[-27, 27].map((x) => (
        <g key={x} transform={`translate(${x} 23)`}>
          <circle r={15.5} fill="none" stroke="#334155" strokeWidth="3" />
          <Spokes r={14} angle={ang} color="#94a3b8" n={6} width={1} />
          <circle r={2} fill="#334155" />
        </g>
      ))}
      {/* the leg behind */}
      <polyline points={`${hip.x},${hip.y} ${k2.x},${k2.y} ${pedal2.x},${pedal2.y}`} fill="none" stroke="#64748b" strokeWidth="4" />
      {/* frame */}
      <polyline points={`-27,23 ${bb.x},${bb.y} -9,-2 -27,23`} fill="none" stroke="#dc2626" strokeWidth="2.6" />
      <polyline points={`-9,-2 17,-4 ${bb.x},${bb.y}`} fill="none" stroke="#dc2626" strokeWidth="2.6" />
      <line x1={17} y1={-4} x2={27} y2={23} stroke="#dc2626" strokeWidth="2.6" />
      <line x1={15} y1={-9} x2={21} y2={-9} stroke="#334155" strokeWidth="2.6" />
      <line x1={-14} y1={-4} x2={-5} y2={-4} stroke="#334155" strokeWidth="3" />
      <line x1={bb.x} y1={bb.y} x2={pedal.x} y2={pedal.y} stroke="#334155" strokeWidth="2" />
      {/* rider */}
      <line x1={hip.x} y1={hip.y} x2={6} y2={-24} stroke="#ef4444" strokeWidth="7" />
      <circle cx={12} cy={-33} r={6} fill="#f1c27d" stroke="#b07a3b" strokeWidth="1.2" />
      <path d="M6,-39 Q12,-44 18,-38" fill="none" stroke="#1f2937" strokeWidth="3" />
      <polyline points="6,-23 14,-15 18,-9" fill="none" stroke="#f1c27d" strokeWidth="3.4" />
      <polyline points={`${hip.x},${hip.y} ${k1.x},${k1.y} ${pedal.x},${pedal.y}`} fill="none" stroke="#1e3a8a" strokeWidth="4.4" />
      {on && <HeatWaves x={6} y={-44} n={3} gap={8} h={12} phase={phase} opacity={0.8} color="#ef4444" />}
    </g>
  );
}

function Solar({ phase, on }) {
  const panel = [
    [-30, -4],
    [32, -16],
    [40, 14],
    [-22, 26],
  ];
  const lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const lines = [];
  for (let i = 1; i < 4; i += 1) {
    const f = i / 4;
    const p1 = lerp(panel[0], panel[1], f);
    const p2 = lerp(panel[3], panel[2], f);
    lines.push(<line key={`a${i}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#93c5fd" strokeWidth="1" />);
  }
  for (let i = 1; i < 3; i += 1) {
    const f = i / 3;
    const p1 = lerp(panel[0], panel[3], f);
    const p2 = lerp(panel[1], panel[2], f);
    lines.push(<line key={`b${i}`} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke="#93c5fd" strokeWidth="1" />);
  }
  const sun = { x: -34, y: -36 };
  const spin = on ? phase * 0.6 : 0;
  return (
    <g>
      <g transform={`translate(${sun.x} ${sun.y}) rotate(${((spin * 180) / Math.PI).toFixed(1)})`}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * TAU;
          return <line key={i} x1={Math.cos(a) * 12} y1={Math.sin(a) * 12} x2={Math.cos(a) * 17} y2={Math.sin(a) * 17} stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />;
        })}
        <circle r={9} fill="#facc15" stroke="#f59e0b" strokeWidth="1.5" />
      </g>
      {[
        [-20, -2],
        [2, -6],
        [22, -10],
      ].map(([x, y], i) => (
        <line
          key={i}
          x1={sun.x + 10}
          y1={sun.y + 8}
          x2={x}
          y2={y + 6}
          stroke="#eab308"
          strokeWidth="1.6"
          strokeDasharray="3 4"
          strokeDashoffset={on ? -((phase * 18) % 7) : 0}
          opacity={on ? 0.9 : 0.35}
        />
      ))}
      <line x1={9} y1={20} x2={9} y2={38} stroke="#475569" strokeWidth="3" />
      <line x1={-4} y1={39} x2={22} y2={39} stroke="#475569" strokeWidth="3" strokeLinecap="round" />
      <polygon points={panel.map((p) => p.join(',')).join(' ')} fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="2" strokeLinejoin="round" />
      {lines}
      <polygon points={`${panel[0].join(',')} ${lerp(panel[0], panel[1], 0.25).join(',')} ${lerp(panel[3], panel[2], 0.25).join(',')} ${panel[3].join(',')}`} fill="#ffffff" opacity="0.08" />
      <path d="M40,14 C46,18 46,28 40,34" fill="none" stroke="#1f2937" strokeWidth="2" />
      {on && <HeatWaves x={12} y={-18} n={3} gap={9} h={12} phase={phase} opacity={0.7} />}
    </g>
  );
}

export default function DeviceArt({ id, cx, cy, size, phase = 0, on = false }) {
  const k = size / 100;
  return (
    <g transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${k.toFixed(3)})`} aria-hidden="true">
      {id === 'motor' && <Motor phase={phase} on={on} />}
      {id === 'car' && <CarDrawing phase={phase} on={on} />}
      {id === 'bulb' && <Bulb phase={phase} on={on} />}
      {id === 'led' && <Bulb phase={phase} on={on} led />}
      {id === 'human' && <Cyclist phase={phase} on={on} />}
      {id === 'solar' && <Solar phase={phase} on={on} />}
    </g>
  );
}
