import { fmt, niceStep, useElementSize } from './ui';

/**
 * The light "lab paper" working area of the chosen design, and the plumbing
 * a 2D scene needs: fitting a box in metres into the drawing, a metre grid
 * and axis numbers, a legend row and a chip for time speed-up, and a
 * time-series graph for the panel under the scene.
 */

/** Colours used for the same quantity in every simulator. */
export const PALETTE = {
  path: '#7c3aed', // trajectory, distance travelled s
  pathText: '#c4b5fd',
  disp: '#2563eb', // displacement Δr, coordinate x
  dispText: '#93c5fd',
  vel: '#059669', // velocity v
  velText: '#6ee7b7',
  acc: '#ea580c', // acceleration a
  accText: '#fdba74',
  force: '#dc2626',
  time: '#22d3ee',
  second: '#db2777', // a second body / second series
  secondText: '#f9a8d4',
  ink: '#0f172a',
  muted: '#64748b',
  grid: '#e2e8f0',
};

/**
 * Fits the box `b` = { x0, x1, y0, y1 } (world units, y up) into a W×H
 * drawing with padding `pad` = { l, r, t, b }, keeping the aspect ratio.
 * `sx`/`sy` map world → screen, `wx`/`wy` screen → world, `k` is px per unit.
 */
export function makeView(b, W, H, pad = { l: 40, r: 16, t: 40, b: 32 }) {
  const bw = b.x1 - b.x0;
  const bh = b.y1 - b.y0;
  const k = Math.max(0.0001, Math.min((W - pad.l - pad.r) / bw, (H - pad.t - pad.b) / bh));
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const ox = pad.l + (W - pad.l - pad.r) / 2;
  const oy = pad.t + (H - pad.t - pad.b) / 2;
  return {
    k,
    sx: (x) => ox + (x - cx) * k,
    sy: (y) => oy - (y - cy) * k,
    wx: (px) => cx + (px - ox) / k,
    wy: (py) => cy - (py - oy) / k,
  };
}

/**
 * The light working area: a white rounded panel with the legend chips along
 * the top, an optional chip on the right (time speed-up, scale), and the
 * scene `children(width)` drawn to the measured width.
 */
export function Paper({ legend = [], chip, height = 420, children, ariaLabel, className = '' }) {
  const [ref, { width }] = useElementSize();
  const W = Math.max(width, 260);
  return (
    <div ref={ref} className={`cl-scene relative overflow-hidden rounded-2xl bg-white text-slate-900 ${className}`}>
      {(legend.length > 0 || chip) && (
        <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-2 sm:inset-x-3 sm:top-3">
          {legend.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
              {legend.map((l) => (
                <span key={l.label} className="flex items-center gap-1.5">
                  {l.kind === 'arrow' ? (
                    <svg width="18" height="8" aria-hidden="true">
                      <line x1="1" y1="4" x2="12" y2="4" stroke={l.color} strokeWidth="2.5" />
                      <path d="M17,4 L11,1 L11,7 Z" fill={l.color} />
                    </svg>
                  ) : l.kind === 'dash' ? (
                    <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: l.color }} />
                  ) : l.kind === 'dot' ? (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  ) : (
                    <span className="h-1 w-4 rounded" style={{ background: l.color }} />
                  )}
                  {l.label}
                </span>
              ))}
            </div>
          )}
          {chip && (
            <div className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow-sm">
              {chip}
            </div>
          )}
        </div>
      )}
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} className="block">
        {width > 0 && children(W, height)}
      </svg>
    </div>
  );
}

/** Light metre grid over the visible world, with a "nice" step. Returns the step used. */
export function Grid({ view, W, H, minPx = 34, color = PALETTE.grid, strong = '#cbd5e1' }) {
  const step = niceStep(view.k, minPx);
  const x0 = Math.floor(view.wx(0) / step) * step;
  const x1 = view.wx(W);
  const y0 = Math.floor(view.wy(H) / step) * step;
  const y1 = view.wy(0);
  const lines = [];
  for (let x = x0; x <= x1; x += step) {
    lines.push(<line key={`gx${x}`} x1={view.sx(x)} x2={view.sx(x)} y1={0} y2={H} stroke={Math.abs(x) < 1e-9 ? strong : color} strokeWidth={1} />);
  }
  for (let y = y0; y <= y1; y += step) {
    lines.push(<line key={`gy${y}`} x1={0} x2={W} y1={view.sy(y)} y2={view.sy(y)} stroke={Math.abs(y) < 1e-9 ? strong : color} strokeWidth={1} />);
  }
  return <g aria-hidden="true">{lines}</g>;
}

/** Axis numbers along the bottom (x) and left (y) edges, with unit labels. */
export function AxisNumbers({ view, W, H, minPx = 60, xUnit, yUnit, showY = true, decimal = '.', digits = 0 }) {
  const step = niceStep(view.k, minPx);
  const items = [];
  for (let x = Math.ceil(view.wx(28) / step) * step; x <= view.wx(W - 24); x += step) {
    items.push(
      <text key={`ax${x}`} x={view.sx(x)} y={H - 8} textAnchor="middle" fontSize="11" fill={PALETTE.muted}>
        {fmt(x, digits, decimal)}
      </text>,
    );
  }
  if (showY) {
    for (let y = Math.ceil(view.wy(H - 24) / step) * step; y <= view.wy(40); y += step) {
      items.push(
        <text key={`ay${y}`} x={8} y={view.sy(y) + 4} fontSize="11" fill={PALETTE.muted}>
          {fmt(y, digits, decimal)}
        </text>,
      );
    }
  }
  return (
    <g aria-hidden="true">
      {items}
      {xUnit && (
        <text x={W - 8} y={H - 8} textAnchor="end" fontSize="11" fontWeight="600" fill={PALETTE.muted}>
          {xUnit}
        </text>
      )}
      {showY && yUnit && (
        <text x={8} y={18} fontSize="11" fontWeight="600" fill={PALETTE.muted}>
          {yUnit}
        </text>
      )}
    </g>
  );
}

/**
 * A live graph for the dark panel under a scene. `series` = [{ id, label,
 * color, points: [{ x, y }] }]; the axes run from 0 (or `yMin`) to
 * `xMax`/`yMax`. `marker` draws a dashed line at x = marker. `onScrub(x)`,
 * when given, lets the reader click or drag along the graph. `fill` shades
 * the area under a series (e.g. displacement under a v–t line).
 */
export function TimeGraph({
  title,
  series,
  xMax,
  yMax,
  yMin = 0,
  xLabel,
  yLabel,
  marker,
  note,
  height = 200,
  decimal = '.',
  ariaLabel,
  onScrub,
  fill,
  xDigits = 0,
  yDigits = 0,
}) {
  const [ref, { width }] = useElementSize();
  const H = height;
  const pad = { l: 44, r: 14, t: 18, b: 26 };
  const W = Math.max(width, 220);
  const gx = (v) => pad.l + (v / xMax) * (W - pad.l - pad.r);
  const gy = (v) => H - pad.b - ((v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xMax);
  const scrub = (e) => {
    if (!onScrub) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    onScrub(Math.min(xMax, Math.max(0, ((px - pad.l) / (W - pad.l - pad.r)) * xMax)));
  };
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
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={ariaLabel ?? title}
          className={`block overflow-visible ${onScrub ? 'cursor-ew-resize touch-none' : ''}`}
          onPointerDown={(e) => {
            if (!onScrub) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => {
            if (onScrub && e.buttons) scrub(e);
          }}
        >
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={pad.l} x2={W - pad.r} y1={gy(v)} y2={gy(v)} stroke={Math.abs(v) < 1e-9 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'} />
              <text x={pad.l - 6} y={gy(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">
                {fmt(v, yDigits, decimal)}
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
          {fill &&
            series
              .filter((s) => s.id === fill.id && s.points.length > 1)
              .map((s) => (
                <polygon
                  key={`fill-${s.id}`}
                  points={[
                    `${gx(s.points[0].x)},${gy(Math.max(yMin, 0))}`,
                    ...s.points.map((p) => `${gx(p.x)},${gy(p.y)}`),
                    `${gx(s.points[s.points.length - 1].x)},${gy(Math.max(yMin, 0))}`,
                  ].join(' ')}
                  fill={fill.color ?? s.color}
                  opacity={fill.opacity ?? 0.18}
                />
              ))}
          {marker !== undefined && marker > 0 && (
            <line x1={gx(marker)} x2={gx(marker)} y1={pad.t} y2={H - pad.b} stroke="rgba(34,211,238,0.45)" strokeDasharray="3 4" />
          )}
          {series.map((s) => (
            <g key={s.id}>
              <polyline
                points={s.points.map((p) => `${gx(p.x).toFixed(1)},${gy(p.y).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.length > 0 && s.dot !== false && (
                <circle
                  cx={gx(s.points[s.points.length - 1].x)}
                  cy={gy(s.points[s.points.length - 1].y)}
                  r="4"
                  fill={s.color}
                  stroke="#0b0b16"
                  strokeWidth="1.5"
                />
              )}
            </g>
          ))}
        </svg>
      </div>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}
