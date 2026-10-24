import { useId } from 'react';

import { fmt, useElementSize } from '../kit/ui';
import { num } from './Acceleration.parts';

/**
 * An x–t graph for the dark panel: each series has its whole planned line
 * (dashed, faint) and the part already travelled (solid). `meet` = { t, x }
 * marks where the lines cross, with guide lines to both axes; it lights up
 * once `reached` is true. Axis numbers come from `xMax` (time) and
 * `yMin`…`yMax` (coordinate).
 */
export default function XTGraph({ title, series, xMax, yMin, yMax, t, meet, reached, xLabel, yLabel, note, decimal = '.', ariaLabel, meetLabel, height = 230, xDigits = 0, yDigits = 0 }) {
  const [ref, { width }] = useElementSize();
  const clipId = `xt-${useId().replace(/:/g, '')}`;
  const W = Math.max(width, 240);
  const H = height;
  const pad = { l: 46, r: 16, t: 18, b: 26 };
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const line = (pts) => pts.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ');
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {title && <p className="text-sm font-semibold text-gray-200">{title}</p>}
        {series.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-0.5 w-4 rounded" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="mt-2 w-full">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel ?? title} className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={pad.l} y={pad.t - 2} width={W - pad.l - pad.r} height={H - pad.t - pad.b + 4} />
            </clipPath>
          </defs>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {num(v, yDigits, decimal)}
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={`x${v}`} x={gx(v)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">
              {fmt(v, xDigits, decimal)}
            </text>
          ))}
          {xLabel && (
            <text x={W - pad.r} y={H - pad.b - 6} textAnchor="end" fontSize="11" fill="#64748b">
              {xLabel}
            </text>
          )}
          {yLabel && (
            <text x={pad.l + 6} y={pad.t - 6} fontSize="11" fill="#64748b">
              {yLabel}
            </text>
          )}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.2)" />
          {t > 0 && <line x1={gx(t)} x2={gx(t)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />}
          <g clipPath={`url(#${clipId})`}>
            {series.map((s) => (
              <polyline key={`p${s.id}`} points={line(s.plan)} fill="none" stroke={s.color} strokeOpacity="0.4" strokeWidth="1.6" strokeDasharray="4 5" />
            ))}
            {series.map((s) =>
              s.live.length > 1 ? <polyline key={`l${s.id}`} points={line(s.live)} fill="none" stroke={s.color} strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" /> : null,
            )}
          </g>
          {meet && (
            <g opacity={reached ? 1 : 0.55}>
              <line x1={gx(meet.t)} x2={gx(meet.t)} y1={gy(meet.x)} y2={H - pad.b} stroke="#fbbf24" strokeDasharray="3 3" strokeWidth={1.2} />
              <line x1={pad.l} x2={gx(meet.t)} y1={gy(meet.x)} y2={gy(meet.x)} stroke="#fbbf24" strokeDasharray="3 3" strokeWidth={1.2} />
              <circle cx={gx(meet.t)} cy={gy(meet.x)} r={reached ? 7 : 5} fill={reached ? '#fbbf24' : 'none'} stroke="#fbbf24" strokeWidth={2} />
              {meetLabel && (
                <text
                  x={gx(meet.t) + (gx(meet.t) > W * 0.7 ? -10 : 10)}
                  y={gy(meet.x) - 10}
                  textAnchor={gx(meet.t) > W * 0.7 ? 'end' : 'start'}
                  fontSize="12"
                  fontWeight="700"
                  fill="#fde68a"
                  stroke="#0b0b16"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {meetLabel}
                </text>
              )}
            </g>
          )}
          {series.map((s) =>
            s.live.length > 0 ? (
              <circle key={`d${s.id}`} cx={gx(s.live[s.live.length - 1].x)} cy={gy(s.live[s.live.length - 1].y)} r="4" fill={s.color} stroke="#0b0b16" strokeWidth="1.5" />
            ) : null,
          )}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}
