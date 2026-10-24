import { useElementSize } from '../kit/ui';
import { COL, niceNum, num, numt, sup, useSvgId } from './UniversalGravitation.parts';

/**
 * The F(r) graph of the two-body simulator: the inverse-square curve for the
 * current masses, a faint dashed copy for the preset masses, and marks at
 * r/2, r, 2r, 3r that read 4F, F, F/4, F/9.
 *
 *   force(rDisplay) → newtons; xStart = where the curve begins (the bodies
 *   touch), xMax = right end of the axis (display units), yMax / pow from
 *   `forceAxis`, r = current distance (display units).
 */

/** y axis for forces around F0: a nice top and the power of ten for the tick labels. */
export function forceAxis(topF) {
  const step = niceNum(topF / 4);
  const yMax = Math.ceil(topF / step - 1e-9) * step;
  const pow = Math.floor(Math.log10(step) + 1e-9);
  return { yMax, step, pow: pow >= -1 && pow <= 3 ? 0 : pow };
}

export default function ForceGraph({ title, force, ghost, xStart, xMax, axis, r, labels, xLabel, yLabel, note, dec, ariaLabel }) {
  const [ref, { width }] = useElementSize();
  const clipId = useSvgId('ugf');
  const H = 240;
  const W = Math.max(width, 240);
  const pad = { l: 44, r: 16, t: 22, b: 42 };
  const { yMax, step, pow } = axis;
  const gx = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
  const gy = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

  const curve = (fn) => {
    const pts = [];
    const n = 220;
    for (let i = 0; i <= n; i += 1) {
      const s = i / n;
      const x = xStart + (xMax - xStart) * s * s;
      const y = Math.min(fn(x), yMax * 3);
      pts.push(`${gx(x).toFixed(1)},${gy(y).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  const F = force(r);
  const marks = [
    { x: r / 2, y: 4 * F, lab: '4F', xl: 'r/2' },
    { x: r, y: F, lab: 'F', xl: 'r', main: true },
    { x: 2 * r, y: F / 4, lab: 'F/4', xl: '2r' },
    { x: 3 * r, y: F / 9, lab: 'F/9', xl: '3r' },
  ].filter((m) => m.x >= xStart * 0.999 && m.x <= xMax && m.y <= yMax);

  const xStep = niceNum(xMax / 5);
  const xTicks = [];
  for (let x = 0; x <= xMax + 1e-9; x += xStep) xTicks.push(x);
  const yTicks = [];
  for (let y = 0; y <= yMax + 1e-12 * yMax; y += step) yTicks.push(y);
  const yText = (y) => (pow === 0 ? num(y, dec) : numt(y / 10 ** pow, dec, 3));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-gray-200">{title}</p>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="h-0.5 w-4 rounded" style={{ background: '#f87171' }} /> {labels.curve}
        </span>
        {ghost && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-0 w-4 border-t-2 border-dashed border-gray-500" /> {labels.ghost}
          </span>
        )}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.l} y={pad.t - 6} width={W - pad.l - pad.r + 2} height={H - pad.t - pad.b + 6} />
            </clipPath>
          </defs>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={v === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {yText(v)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {numt(v, dec)}
            </text>
          ))}
          <text x={W - pad.r} y={pad.t - 8} textAnchor="end" fontSize="11" fill="#64748b">
            {xLabel}
          </text>
          <text x={pad.l + 6} y={pad.t - 8} fontSize="11" fill="#64748b">
            {pow === 0 ? yLabel('') : yLabel(`10${sup(pow)} `)}
          </text>
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />

          <g clipPath={`url(#${clipId})`}>
            {ghost && <polyline points={curve(ghost)} fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="5 5" />}
            <polyline points={curve(force)} fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {marks.map((m) => (
              <g key={m.xl}>
                <line x1={gx(m.x)} x2={gx(m.x)} y1={gy(m.y)} y2={H - pad.b} stroke={m.main ? 'rgba(34,211,238,0.55)' : 'rgba(255,255,255,0.25)'} strokeDasharray="3 4" />
                <line x1={pad.l} x2={gx(m.x)} y1={gy(m.y)} y2={gy(m.y)} stroke={m.main ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.14)'} strokeDasharray="3 4" />
              </g>
            ))}
          </g>
          {marks.map((m) => (
            <g key={`p${m.xl}`}>
              <circle cx={gx(m.x)} cy={gy(m.y)} r={m.main ? 5.5 : 4.5} fill={m.main ? COL.force : '#0b0b16'} stroke={m.main ? '#fff' : '#f87171'} strokeWidth="2" />
              <text
                x={gx(m.x) > W - pad.r - 40 ? gx(m.x) - 8 : gx(m.x) + 8}
                y={gy(m.y) - 8}
                textAnchor={gx(m.x) > W - pad.r - 40 ? 'end' : 'start'}
                fontSize="12"
                fontWeight="700"
                fill={m.main ? '#fecaca' : '#fca5a5'}
              >
                {m.lab}
              </text>
              <text x={gx(m.x)} y={H - pad.b + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill={m.main ? '#67e8f9' : '#cbd5e1'}>
                {m.xl}
              </text>
            </g>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs leading-snug text-gray-500">{note}</p>}
    </div>
  );
}
