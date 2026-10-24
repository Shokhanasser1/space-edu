/**
 * Tab 1 of "Pressure. Pascal's law": the bodies, their supports and the soft
 * grounds they sink into, as data and as SVG.
 *
 *   p = F / S        F — the force pressing on the support (here the weight
 *                    mg of the body, or a finger's push), S — the support area.
 *
 * Every support kind carries its preset (F, S) — checked by hand:
 *   brick 2 kg (F = 2·9.8 = 19.6 N) on 20×10 / 20×5 / 10×5 cm faces:
 *     S = 0.02 / 0.01 / 0.005 m²  →  p = 980 / 1 960 / 3 920 Pa;
 *   person 60 kg (F = 588 N): two boots 2·(20×10 cm) = 0.04 m² → 14 700 Pa,
 *     one boot 0.02 m² → 29 400 Pa, two skis 2·(150×10 cm) = 0.3 m² → 1 960 Pa;
 *   tank 40 t (F = 392 kN) on two tracks 2·(4 m × 0.5 m) = 4 m² → 98 kPa;
 *   car 1.5 t (F = 14.7 kN) on four tyre patches 4·150 cm² = 0.06 m² → 245 kPa;
 *   needle pushed with 2 N: tip 0.01 mm² = 1·10⁻⁸ m² → 2·10⁸ Pa = 200 MPa;
 *     the same 2 N from a fingertip on 1 cm² → 20 kPa.
 *
 * How deep a body sinks is a simple model of soft ground, h = p / k (k in Pa
 * per metre: sand 98 kPa/m, fresh snow 49 kPa/m, mud 1 MPa/m, plasticine
 * 10 MPa/m), so the numbers come out round: the brick sinks 1 / 2 / 4 cm,
 * the person 30 cm in boots and 4 cm on skis, the tank 9.8 cm and the car
 * 24.5 cm, the fingertip 2 mm, and the needle goes right through.
 */

export const GROUNDS = {
  sand: { k: 98000, rim: 0.22, slope: 0.9, front: ['#efd8a6', '#d3ae68'], band: '#f6e8c6', pit: '#c9a25d', edge: '#b48a44', tex: '#b8904c', comp: '#9a6f2c' },
  snow: {
    k: 49000,
    rim: 0,
    slope: 0.1,
    front: ['#fbfdff', '#dbe9f7'],
    band: '#ffffff',
    pit: '#c9dcf0',
    edge: '#9ab6d5',
    tex: '#a9c7e8',
    comp: '#7fa6d4',
    layer: 0.7,
    below: ['#8b6b4a', '#6b4f36'],
  },
  mud: {
    k: 1e6,
    rim: 0.25,
    slope: 0.75,
    front: ['#8f6e4d', '#5e4531'],
    band: '#a6855f',
    pit: '#6e5139',
    edge: '#4a3423',
    tex: '#4a3524',
    comp: '#2e2015',
    layer: 0.5,
    below: ['#7a6a55', '#5f5242'],
  },
  clay: {
    k: 1e7,
    rim: 0.18,
    slope: 0.55,
    front: ['#93d49f', '#5ba96c'],
    band: '#c0e7c6',
    pit: '#5fa06f',
    edge: '#3f8a50',
    tex: null,
    comp: '#2c6a3a',
    layer: 0.025,
    below: ['#cf9c66', '#a8743f'],
  },
};

/** Support kinds: preset force and area, and the slider ranges. */
export const KINDS = {
  wide: { body: 'brick', F: 19.6, S: 0.02, Smin: 0.004, Smax: 0.04, b: 0.1, H: 0.05, hmax: 0.04 },
  side: { body: 'brick', F: 19.6, S: 0.01, Smin: 0.002, Smax: 0.02, b: 0.05, H: 0.1, hmax: 0.08 },
  end: { body: 'brick', F: 19.6, S: 0.005, Smin: 0.002, Smax: 0.02, b: 0.05, H: 0.2, hmax: 0.12 },
  boots: { body: 'person', F: 588, S: 0.04, Smin: 0.008, Smax: 0.12, hmax: 0.68 },
  oneBoot: { body: 'person', F: 588, S: 0.02, Smin: 0.004, Smax: 0.06, hmax: 0.68 },
  skis: { body: 'person', F: 588, S: 0.3, Smin: 0.1, Smax: 0.5, hmax: 0.68 },
  tank: { body: 'vehicle', F: 392000, S: 4, Smin: 1, Smax: 6.5, Fmin: 100000, Fmax: 600000, hmax: 0.45 },
  car: { body: 'vehicle', F: 14700, S: 0.06, Smin: 0.02, Smax: 0.3, Fmin: 5000, Fmax: 40000, hmax: 0.42 },
  tip: { body: 'needle', F: 2, S: 1e-8, Smin: 2e-9, Smax: 1e-6, hmax: 0.025, slit: true },
  finger: { body: 'needle', F: 2, S: 1e-4, Smin: 2e-5, Smax: 4e-4, hmax: 0.016 },
};

/**
 * Bodies: their support kinds, ground, force range, the world box of the
 * scene (metres, y up, ground surface at y = 0), the grid step and the
 * pressure that draws a ~60 px arrow (`pRef`).
 */
export const BODIES = {
  brick: { kinds: ['wide', 'side', 'end'], ground: 'sand', Fmin: 4, Fmax: 80, box: { x0: -0.3, x1: 0.3, y0: -0.125, y1: 0.215 }, cell: 0.05, pRef: 3920, Fref: 19.6 },
  person: { kinds: ['boots', 'oneBoot', 'skis'], ground: 'snow', Fmin: 250, Fmax: 1500, box: { x0: -1.45, x1: 1.45, y0: -1.25, y1: 1.8 }, cell: 0.25, pRef: 36000, Fref: 588, height: 540 },
  vehicle: { kinds: ['tank', 'car'], ground: 'mud', box: { x0: -4.55, x1: 4.55, y0: -1.12, y1: 2.26 }, cell: 1, pRef: 300000, Fref: 392000 },
  needle: { kinds: ['tip', 'finger'], ground: 'clay', Fmin: 0.2, Fmax: 20, box: { x0: -0.045, x1: 0.045, y0: -0.048, y1: 0.06 }, cell: 0.005, pRef: 40000, Fref: 2, height: 480 },
};

/** Force range of a kind (the vehicles each have their own). */
export function forceRange(kind) {
  const K = KINDS[kind];
  const B = BODIES[K.body];
  return [K.Fmin ?? B.Fmin, K.Fmax ?? B.Fmax];
}

/** Depth the body sinks for pressure p: h = p / k, limited by the layer. */
export function sinkDepth(kind, p) {
  const K = KINDS[kind];
  const g = GROUNDS[BODIES[K.body].ground];
  return Math.min(p / g.k, K.hmax);
}

const CAR_WHEEL_X = 1.35; // m, half the wheelbase
const TYRE_R = 0.32; // m
const SOLE_W = 0.1; // m, width of a boot sole and of a ski
const TRACK_W = 0.5; // m, width of a tank track
const PATCH_W = 0.2; // m, width of a tyre contact patch

/** The contact intervals [x0, x1] (world metres) of a support of area S, in side view. */
export function contactsOf(kind, S) {
  switch (kind) {
    case 'wide':
    case 'side':
    case 'end': {
      const l = S / KINDS[kind].b;
      return [[-l / 2, l / 2]];
    }
    case 'boots': {
      const l = S / (2 * SOLE_W);
      const c = Math.max(0.13, l / 2 + 0.03);
      return [
        [-c - l / 2, -c + l / 2],
        [c - l / 2, c + l / 2],
      ];
    }
    case 'oneBoot': {
      const l = S / SOLE_W;
      return [[-l / 2, l / 2]];
    }
    case 'skis': {
      const l = S / (2 * SOLE_W);
      return [[-l / 2, l / 2]];
    }
    case 'tank': {
      const l = S / (2 * TRACK_W);
      return [[-l / 2, l / 2]];
    }
    case 'car': {
      const lp = S / (4 * PATCH_W);
      return [
        [-CAR_WHEEL_X - lp / 2, -CAR_WHEEL_X + lp / 2],
        [CAR_WHEEL_X - lp / 2, CAR_WHEEL_X + lp / 2],
      ];
    }
    default: {
      const d = 2 * Math.sqrt(S / Math.PI);
      return [[-d / 2, d / 2]];
    }
  }
}

/** Half-width of the drawn needle shank (m) — at least 2.2 px. */
export function needleHalf(k) {
  return Math.max(0.00045, 2.2 / k);
}

/** The holes in the ground: the contacts, except the needle, which leaves a hole its shank wide. */
export function holesOf(kind, S, k) {
  if (kind === 'tip') {
    const w = needleHalf(k);
    return [[-w, w]];
  }
  return contactsOf(kind, S);
}

/* ================================================================ ground */

const smooth = (t) => t * t * (3 - 2 * t);

/** Surface height y(x) (world) of a ground with dips of depth h at the given intervals. */
export function surfaceFn(holes, h, g, k, slit = false) {
  const ws = slit ? 1.5 / k : Math.max(g.slope * h, 2 / k);
  const hr = slit ? 0 : g.rim * h;
  return (x) => {
    let y = 0;
    let rim = 0;
    for (const [a, b] of holes) {
      let d = 0;
      if (x >= a && x <= b) d = -h;
      else {
        const dist = x < a ? a - x : x - b;
        if (dist < ws) d = -h * (1 - smooth(dist / ws));
        const rr = Math.abs(dist - ws) / (ws * 0.85);
        if (rr < 1) rim = Math.max(rim, hr * 0.5 * (1 + Math.cos(Math.PI * rr)));
      }
      if (d < y) y = d;
    }
    return y + (h > 0 ? rim * Math.max(0, 1 + y / h) : 0);
  };
}

/** The ground surface as screen points, sampled every 3 px plus the exact hole edges. */
export function surfacePoints(view, W, holes, h, g, slit) {
  const f = surfaceFn(holes, h, g, view.k, slit);
  const xs = [];
  for (let px = -6; px <= W + 6; px += 3) xs.push(view.wx(px));
  for (const [a, b] of holes) xs.push(a, b, a - 1e-6, b + 1e-6);
  xs.sort((p, q) => p - q);
  return xs.map((x) => [view.sx(x), view.sy(f(x))]);
}

/** The receding top surface of the ground (behind the front cut) and the pits' back walls. */
export function GroundBack({ view, W, g, holes, h, band, slit }) {
  const y0 = view.sy(0);
  const ws = slit ? 1.5 / view.k : Math.max(g.slope * h, 2 / view.k);
  return (
    <g aria-hidden="true">
      <polygon points={`${-4},${y0} ${W + 4},${y0} ${W + 4 + band.x},${y0 + band.y} ${-4 + band.x},${y0 + band.y}`} fill={g.band} />
      <line x1={-4 + band.x} y1={y0 + band.y} x2={W + 4} y2={y0 + band.y} stroke={g.edge} strokeOpacity="0.35" strokeWidth="1" />
      {h > 0 &&
        holes.map(([a, b], i) => (
          <rect key={i} x={view.sx(a - ws)} y={y0} width={view.sx(b + ws) - view.sx(a - ws)} height={Math.max(0, view.sy(-h) - y0)} fill={g.pit} />
        ))}
    </g>
  );
}

/** The front cut through the ground, with the dips, a texture, the compacted layer and the layer below. */
export function GroundFront({ view, W, H, g, holes, h, ids, names, slit }) {
  const pts = surfacePoints(view, W, holes, h, g, slit);
  const d = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${W + 6},${H + 4} L-6,${H + 4} Z`;
  const yLayer = g.layer !== undefined ? view.sy(-g.layer) : null;
  const comp = Math.max(h * 0.9, 6 / view.k);
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={ids.front} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g.front[0]} />
          <stop offset="1" stopColor={g.front[1]} />
        </linearGradient>
        <linearGradient id={ids.comp} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={g.comp} stopOpacity="0.5" />
          <stop offset="1" stopColor={g.comp} stopOpacity="0" />
        </linearGradient>
        {g.tex && (
          <pattern id={ids.tex} width="14" height="12" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="1.1" fill={g.tex} opacity="0.55" />
            <circle cx="10" cy="8" r="0.9" fill={g.tex} opacity="0.45" />
            <circle cx="12" cy="2" r="0.6" fill={g.tex} opacity="0.4" />
          </pattern>
        )}
        {g.below && (
          <linearGradient id={ids.below} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={g.below[0]} />
            <stop offset="1" stopColor={g.below[1]} />
          </linearGradient>
        )}
      </defs>
      <path d={d} fill={`url(#${ids.front})`} />
      {g.tex && <path d={d} fill={`url(#${ids.tex})`} />}
      {h > 0 &&
        !slit &&
        holes.map(([a, b], i) => (
          <rect key={i} x={view.sx(a)} y={view.sy(-h)} width={Math.max(1, view.sx(b) - view.sx(a))} height={comp * view.k} fill={`url(#${ids.comp})`} />
        ))}
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={g.edge} strokeWidth="1.6" strokeLinejoin="round" />
      {yLayer !== null && yLayer < H && (
        <>
          <rect x={-4} y={yLayer} width={W + 8} height={H - yLayer + 4} fill={`url(#${ids.below})`} />
          <line x1={-4} x2={W + 4} y1={yLayer} y2={yLayer} stroke="#00000033" strokeWidth="1" />
          {g === GROUNDS.clay &&
            [0.3, 0.55, 0.8].map((f) => (
              <path
                key={f}
                d={`M0,${yLayer + (H - yLayer) * f} C${W * 0.3},${yLayer + (H - yLayer) * (f - 0.08)} ${W * 0.6},${yLayer + (H - yLayer) * (f + 0.08)} ${W},${yLayer + (H - yLayer) * f}`}
                fill="none"
                stroke="#8a5a2b"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
            ))}
        </>
      )}
      {names && (
        <>
          <text x={10} y={(yLayer !== null && yLayer < H ? Math.min(yLayer - 8, view.sy(0) + 22) : view.sy(0) + 22)} fontSize="12" fontWeight="700" fill={g.edge}>
            {names.ground}
          </text>
          {names.below && yLayer !== null && yLayer < H - 14 && (
            <text x={10} y={Math.min(H - 8, yLayer + 18)} fontSize="12" fontWeight="700" fill="#ffffffcc">
              {names.below}
            </text>
          )}
        </>
      )}
    </g>
  );
}

/* ================================================================ bodies */

/** Oblique ("cabinet") offset in px for a depth z (m) into the page. */
export function oblique(z, k) {
  return { x: z * k * 0.5 * Math.cos(0.61), y: -z * k * 0.5 * Math.sin(0.61) };
}

/** The brick's top and right faces (drawn behind the front cut). */
export function BrickBack({ view, l, H, h, b }) {
  const o = oblique(b, view.k);
  const x0 = view.sx(-l / 2);
  const x1 = view.sx(l / 2);
  const yT = view.sy(-h + H);
  const yG = view.sy(0);
  return (
    <g aria-hidden="true">
      <polygon points={`${x0},${yT} ${x1},${yT} ${x1 + o.x},${yT + o.y} ${x0 + o.x},${yT + o.y}`} fill="#de7a57" stroke="#7c2d12" strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points={`${x1},${yT} ${x1 + o.x},${yT + o.y} ${x1 + o.x},${yG + o.y} ${x1},${yG}`} fill="#94391f" stroke="#7c2d12" strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  );
}

/** The brick's front face. */
export function BrickFront({ view, l, H, h, id }) {
  const x0 = view.sx(-l / 2);
  const x1 = view.sx(l / 2);
  const yT = view.sy(-h + H);
  const yB = view.sy(-h);
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8583a" />
          <stop offset="1" stopColor="#a8432a" />
        </linearGradient>
      </defs>
      <rect x={x0} y={yT} width={x1 - x0} height={yB - yT} fill={`url(#${id})`} stroke="#7c2d12" strokeWidth="1.4" />
      <line x1={x0 + 2} x2={x1 - 2} y1={yT + 2} y2={yT + 2} stroke="#f2a07f" strokeOpacity="0.6" strokeWidth="1.2" />
    </g>
  );
}

/** A boot standing at xc with sole length l on base y (world). */
function Boot({ view, xc, l, y, dark }) {
  const P = (x, yy) => `${view.sx(x).toFixed(1)},${view.sy(yy).toFixed(1)}`;
  const col = dark ? '#2b1d14' : '#4a2f1f';
  const shaft = `M${P(xc - 0.065, y + 0.04)} L${P(xc - 0.065, y + 0.22)} L${P(xc + 0.055, y + 0.22)} L${P(xc + 0.055, y + 0.04)} Z`;
  if (l >= 0.12) {
    const toe = Math.min(0.06, l * 0.3);
    const foot = `M${P(xc - l / 2, y)} L${P(xc + l / 2, y)} L${P(xc + l / 2, y + 0.04)} Q${P(xc + l / 2, y + 0.095)} ${P(xc + l / 2 - toe, y + 0.095)} L${P(xc - l / 2 + 0.02, y + 0.095)} Q${P(xc - l / 2, y + 0.095)} ${P(xc - l / 2, y + 0.07)} Z`;
    return (
      <g>
        <path d={shaft} fill={col} />
        <path d={foot} fill={col} />
        <rect x={view.sx(xc - l / 2)} y={view.sy(y + 0.02)} width={view.sx(xc + l / 2) - view.sx(xc - l / 2)} height={0.02 * view.k} fill="#111827" />
      </g>
    );
  }
  // a short sole: the boot stands on a narrow platform like a heel
  const foot = `M${P(xc - 0.075, y + 0.035)} L${P(xc + 0.09, y + 0.035)} Q${P(xc + 0.1, y + 0.09)} ${P(xc + 0.05, y + 0.09)} L${P(xc - 0.065, y + 0.09)} Q${P(xc - 0.08, y + 0.09)} ${P(xc - 0.075, y + 0.035)} Z`;
  return (
    <g>
      <path d={shaft} fill={col} />
      <path d={foot} fill={col} />
      <rect x={view.sx(xc - l / 2)} y={view.sy(y + 0.035)} width={Math.max(1.5, view.sx(xc + l / 2) - view.sx(xc - l / 2))} height={0.035 * view.k} fill="#111827" />
    </g>
  );
}

/** A ski of ground length l at base y, its tip turned up at the front. */
function Ski({ view, l, y, dx = 0, back }) {
  const P = (x, yy) => `${(view.sx(x) + dx).toFixed(1)},${(view.sy(yy) - (back ? 3 : 0)).toFixed(1)}`;
  const t = 0.028;
  const d = `M${P(-l / 2, y)} L${P(l / 2, y)} Q${P(l / 2 + 0.1, y)} ${P(l / 2 + 0.15, y + 0.09)} L${P(l / 2 + 0.13, y + 0.1)} Q${P(l / 2 + 0.08, y + t)} ${P(l / 2, y + t)} L${P(-l / 2 + 0.03, y + t)} Q${P(-l / 2, y + t)} ${P(-l / 2, y)} Z`;
  return <path d={d} fill={back ? '#d97706' : '#fbbf24'} stroke="#92400e" strokeWidth="1.1" strokeLinejoin="round" />;
}

/** A person in winter clothes, side view, standing on boots, one boot or skis. */
export function Person({ view, kind, S, h }) {
  const k = view.k;
  const P = (x, yy) => `${view.sx(x).toFixed(1)},${view.sy(yy).toFixed(1)}`;
  const y0 = -h;
  const onSkis = kind === 'skis';
  const yb = y0 + (onSkis ? 0.028 : 0);
  const hipY = yb + 0.92;
  const shY = yb + 1.42;
  const headY = yb + 1.58;
  const legW = 0.11 * k;
  const armW = 0.075 * k;
  let feet;
  if (kind === 'boots') {
    const [[a1, b1], [a2, b2]] = contactsOf('boots', S);
    const l = b1 - a1;
    feet = [
      { x: (a1 + b1) / 2, l, back: true },
      { x: (a2 + b2) / 2, l },
    ];
  } else if (kind === 'oneBoot') {
    const [[a, b]] = contactsOf('oneBoot', S);
    feet = [{ x: (a + b) / 2, l: b - a }];
  } else {
    feet = [
      { x: -0.07, l: 0.3, back: true },
      { x: 0.07, l: 0.3 },
    ];
  }
  const leg = (x1, y1, x2, y2, back) => (
    <line x1={view.sx(x1)} y1={view.sy(y1)} x2={view.sx(x2)} y2={view.sy(y2)} stroke={back ? '#1e293b' : '#334155'} strokeWidth={legW} strokeLinecap="round" />
  );
  const skiL = onSkis ? contactsOf('skis', S)[0][1] * 2 : 0;
  return (
    <g aria-hidden="true">
      {onSkis && <Ski view={view} l={skiL} y={y0} dx={0.05 * k} back />}
      {/* back arm */}
      {kind === 'oneBoot' ? (
        <line x1={view.sx(-0.02)} y1={view.sy(shY - 0.03)} x2={view.sx(-0.36)} y2={view.sy(shY + 0.02)} stroke="#3730a3" strokeWidth={armW} strokeLinecap="round" />
      ) : (
        <line x1={view.sx(-0.02)} y1={view.sy(shY - 0.03)} x2={view.sx(onSkis ? 0.1 : -0.13)} y2={view.sy(hipY + (onSkis ? 0.12 : 0.02))} stroke="#3730a3" strokeWidth={armW} strokeLinecap="round" />
      )}
      {onSkis && <line x1={view.sx(0.1)} y1={view.sy(hipY + 0.12)} x2={view.sx(-0.42)} y2={view.sy(y0 - 0.03)} stroke="#64748b" strokeWidth={Math.max(1.5, 0.02 * k)} strokeLinecap="round" />}
      {/* legs */}
      {kind === 'oneBoot' ? (
        <>
          <polyline
            points={`${P(-0.03, hipY)} ${P(0.2, hipY - 0.3)} ${P(0.02, hipY - 0.55)}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth={legW}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Boot view={view} xc={0.03} l={0.2} y={hipY - 0.64} dark />
          {leg(0.02, hipY, feet[0].x, yb + 0.1)}
        </>
      ) : (
        feet.map((f, i) => <g key={i}>{leg(f.back ? -0.03 : 0.03, hipY, f.x, yb + 0.1, f.back)}</g>)
      )}
      {feet.map((f, i) => (
        <Boot key={i} view={view} xc={f.x} l={f.l} y={yb} dark={f.back} />
      ))}
      {onSkis && <Ski view={view} l={skiL} y={y0} />}
      {/* torso and jacket */}
      <rect x={view.sx(-0.15)} y={view.sy(shY + 0.05)} width={0.3 * k} height={(shY + 0.05 - (hipY - 0.08)) * k} rx={0.08 * k} fill="#4f46e5" />
      <line x1={view.sx(0.02)} y1={view.sy(shY + 0.02)} x2={view.sx(0.02)} y2={view.sy(hipY - 0.05)} stroke="#3730a3" strokeWidth={Math.max(1, 0.012 * k)} />
      <rect x={view.sx(-0.16)} y={view.sy(hipY + 0.02)} width={0.32 * k} height={0.05 * k} rx={0.02 * k} fill="#1e1b4b" />
      {/* scarf, head, hat */}
      <rect x={view.sx(-0.09)} y={view.sy(shY + 0.09)} width={0.19 * k} height={0.06 * k} rx={0.03 * k} fill="#f59e0b" />
      <circle cx={view.sx(0.01)} cy={view.sy(headY)} r={0.105 * k} fill="#f2c79b" stroke="#c98d5e" strokeWidth="1" />
      <circle cx={view.sx(0.065)} cy={view.sy(headY + 0.015)} r={Math.max(1, 0.012 * k)} fill="#1f2937" />
      <path
        d={`M${P(-0.1, headY + 0.03)} Q${P(-0.11, headY + 0.17)} ${P(0.01, headY + 0.17)} Q${P(0.12, headY + 0.17)} ${P(0.115, headY + 0.03)} Z`}
        fill="#e11d48"
      />
      <rect x={view.sx(-0.11)} y={view.sy(headY + 0.05)} width={0.23 * k} height={0.035 * k} rx={0.015 * k} fill="#be123c" />
      <circle cx={view.sx(0.0)} cy={view.sy(headY + 0.19)} r={0.035 * k} fill="#fff1f2" stroke="#fda4af" strokeWidth="1" />
      {/* front arm */}
      {kind === 'oneBoot' ? (
        <line x1={view.sx(0.03)} y1={view.sy(shY - 0.03)} x2={view.sx(0.38)} y2={view.sy(shY + 0.08)} stroke="#4338ca" strokeWidth={armW} strokeLinecap="round" />
      ) : (
        <line x1={view.sx(0.03)} y1={view.sy(shY - 0.03)} x2={view.sx(onSkis ? 0.24 : 0.1)} y2={view.sy(hipY + (onSkis ? 0.1 : 0.04))} stroke="#4338ca" strokeWidth={armW} strokeLinecap="round" />
      )}
      {onSkis && <line x1={view.sx(0.24)} y1={view.sy(hipY + 0.1)} x2={view.sx(0.5)} y2={view.sy(y0 - 0.03)} stroke="#475569" strokeWidth={Math.max(1.5, 0.02 * k)} strokeLinecap="round" />}
    </g>
  );
}

/** Top of the person's hat (world y). */
export const personTop = (kind, h) => -h + (kind === 'skis' ? 0.028 : 0) + 1.79;

/** A tank, side view, on tracks of ground length l. */
export function Tank({ view, l, h }) {
  const k = view.k;
  const y0 = -h;
  const P = (x, yy) => `${view.sx(x).toFixed(1)},${view.sy(yy).toFixed(1)}`;
  const xr = -l / 2 - 0.42;
  const xf = l / 2 + 0.55;
  const track = `M${P(-l / 2, y0)} L${P(l / 2, y0)} C${P(l / 2 + 0.3, y0)} ${P(xf, y0 + 0.25)} ${P(xf, y0 + 0.5)} C${P(xf, y0 + 0.75)} ${P(xf - 0.15, y0 + 0.9)} ${P(xf - 0.4, y0 + 0.9)} L${P(xr + 0.3, y0 + 0.9)} C${P(xr + 0.05, y0 + 0.9)} ${P(xr, y0 + 0.75)} ${P(xr, y0 + 0.5)} C${P(xr, y0 + 0.25)} ${P(-l / 2 - 0.25, y0)} ${P(-l / 2, y0)} Z`;
  const n = Math.max(2, Math.min(9, Math.round(l / 0.72)));
  const wheels = Array.from({ length: n }, (_, i) => -l / 2 + 0.3 + (n === 1 ? 0 : (i * (l - 0.6)) / (n - 1)));
  const xh0 = Math.min(-3.35, xr - 0.1);
  const xh1 = Math.max(3.5, xf + 0.15);
  return (
    <g aria-hidden="true">
      <path d={track} fill="#3f3f46" stroke="#18181b" strokeWidth="1.4" />
      <path d={track} fill="none" stroke="#a1a1aa" strokeOpacity="0.5" strokeWidth={Math.max(1, 0.05 * k)} strokeDasharray={`${Math.max(1.5, 0.07 * k)} ${Math.max(1.5, 0.1 * k)}`} />
      {wheels.map((x) => (
        <g key={x}>
          <circle cx={view.sx(x)} cy={view.sy(y0 + 0.34)} r={0.29 * k} fill="#52525b" stroke="#27272a" strokeWidth="1.2" />
          <circle cx={view.sx(x)} cy={view.sy(y0 + 0.34)} r={0.09 * k} fill="#a1a1aa" />
        </g>
      ))}
      <circle cx={view.sx(xf - 0.3)} cy={view.sy(y0 + 0.52)} r={0.24 * k} fill="#52525b" stroke="#27272a" strokeWidth="1.2" />
      <circle cx={view.sx(xr + 0.3)} cy={view.sy(y0 + 0.5)} r={0.24 * k} fill="#52525b" stroke="#27272a" strokeWidth="1.2" />
      <polygon
        points={`${P(xh0, y0 + 0.88)} ${P(xh1 - 0.5, y0 + 0.88)} ${P(xh1, y0 + 1.18)} ${P(xh1 - 0.9, y0 + 1.52)} ${P(xh0 + 0.15, y0 + 1.55)} ${P(xh0, y0 + 1.3)}`}
        fill="#5a6b35"
        stroke="#33401c"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <line x1={view.sx(xh0)} y1={view.sy(y0 + 0.95)} x2={view.sx(xh1 - 0.42)} y2={view.sy(y0 + 0.95)} stroke="#3f4b24" strokeWidth={Math.max(1.2, 0.05 * k)} />
      <path
        d={`M${P(-1.5, y0 + 1.55)} L${P(-1.4, y0 + 1.98)} Q${P(-1.3, y0 + 2.18)} ${P(-0.9, y0 + 2.2)} L${P(0.4, y0 + 2.2)} Q${P(0.95, y0 + 2.15)} ${P(1.15, y0 + 1.8)} L${P(1.2, y0 + 1.55)} Z`}
        fill="#6b7d40"
        stroke="#33401c"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x={view.sx(1.0)} y={view.sy(y0 + 1.93)} width={3.3 * k} height={0.12 * k} fill="#4b5a2a" stroke="#33401c" strokeWidth="1" />
      <rect x={view.sx(3.95)} y={view.sy(y0 + 1.96)} width={0.35 * k} height={0.18 * k} fill="#3f4b24" />
      <ellipse cx={view.sx(-0.6)} cy={view.sy(y0 + 2.22)} rx={0.32 * k} ry={0.06 * k} fill="#4b5a2a" />
      <line x1={view.sx(-1.1)} y1={view.sy(y0 + 2.18)} x2={view.sx(-1.35)} y2={view.sy(y0 + 2.9)} stroke="#33401c" strokeWidth="1.2" />
    </g>
  );
}

/** Wheel geometry of the car for a contact patch of length lp: flattening δ and the wheel-centre height. */
export function carWheel(lp, h) {
  const half = Math.min(lp / 2, TYRE_R * 0.95);
  const delta = TYRE_R - Math.sqrt(TYRE_R * TYRE_R - half * half);
  return { delta, yc: -h + TYRE_R - delta, half };
}

/** A small car, side view, on four tyres with contact patches of length lp. */
export function Car({ view, S, h }) {
  const k = view.k;
  const lp = S / (4 * PATCH_W);
  const { yc, half } = carWheel(lp, h);
  const P = (x, dy) => `${view.sx(x).toFixed(1)},${view.sy(yc + dy).toFixed(1)}`;
  const body = `M${P(-2.3, -0.02)} L${P(-2.3, 0.45)} Q${P(-2.28, 0.6)} ${P(-2.05, 0.62)} L${P(-1.15, 0.66)} L${P(-0.62, 1.1)} Q${P(-0.55, 1.14)} ${P(-0.4, 1.14)} L${P(0.55, 1.14)} Q${P(0.72, 1.14)} ${P(0.8, 1.08)} L${P(1.3, 0.66)} L${P(2.05, 0.6)} Q${P(2.33, 0.56)} ${P(2.33, 0.35)} L${P(2.33, -0.02)} Z`;
  const tyre = (xw) => {
    const y = view.sy(-h);
    const r = TYRE_R * k;
    return `M${(view.sx(xw) - half * k).toFixed(1)},${y.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 1 1 ${(view.sx(xw) + half * k).toFixed(1)},${y.toFixed(1)} Z`;
  };
  return (
    <g aria-hidden="true">
      <path d={body} fill="#0e7490" stroke="#164e63" strokeWidth="1.4" strokeLinejoin="round" />
      <polygon points={`${P(-1.02, 0.69)} ${P(-0.58, 1.06)} ${P(-0.08, 1.06)} ${P(-0.08, 0.69)}`} fill="#cfe8f7" stroke="#164e63" strokeWidth="1" />
      <polygon points={`${P(0.02, 0.69)} ${P(0.02, 1.06)} ${P(0.52, 1.06)} ${P(1.12, 0.69)}`} fill="#cfe8f7" stroke="#164e63" strokeWidth="1" />
      <line x1={view.sx(-0.03)} y1={view.sy(yc + 0.66)} x2={view.sx(-0.03)} y2={view.sy(yc + 0.05)} stroke="#164e63" strokeWidth="1" />
      <rect x={view.sx(2.2)} y={view.sy(yc + 0.45)} width={0.12 * k} height={0.08 * k} rx={0.02 * k} fill="#fde68a" />
      <rect x={view.sx(-2.3)} y={view.sy(yc + 0.47)} width={0.08 * k} height={0.09 * k} fill="#ef4444" />
      {[-CAR_WHEEL_X, CAR_WHEEL_X].map((xw) => (
        <g key={xw}>
          <circle cx={view.sx(xw)} cy={view.sy(yc)} r={(TYRE_R + 0.06) * k} fill="#0b1f2a" />
          <path d={tyre(xw)} fill="#1f2937" stroke="#030712" strokeWidth="1.2" />
          <circle cx={view.sx(xw)} cy={view.sy(yc)} r={0.18 * k} fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          <circle cx={view.sx(xw)} cy={view.sy(yc)} r={0.05 * k} fill="#64748b" />
        </g>
      ))}
    </g>
  );
}

/** A sewing needle pushed down by a finger in a thimble. */
export function Needle({ view, S, h, id }) {
  const k = view.k;
  const y0 = -h;
  const w = needleHalf(k);
  const wt = Math.max(Math.sqrt(S / Math.PI), 0.3 / k);
  const len = 0.042;
  const P = (x, yy) => `${view.sx(x).toFixed(1)},${view.sy(yy).toFixed(1)}`;
  const needle = `M${P(-wt, y0)} L${P(wt, y0)} L${P(w, y0 + 0.005)} L${P(w, y0 + len - w)} Q${P(w, y0 + len)} ${P(0, y0 + len)} Q${P(-w, y0 + len)} ${P(-w, y0 + len - w)} L${P(-w, y0 + 0.005)} Z`;
  const yf = y0 + len - 0.001;
  const top = view.wy(-10);
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#94a3b8" />
          <stop offset="0.5" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#64748b" />
        </linearGradient>
      </defs>
      <path d={needle} fill={`url(#${id})`} stroke="#475569" strokeWidth="0.9" strokeLinejoin="round" />
      <rect x={view.sx(-w * 0.35)} y={view.sy(y0 + len - 0.0025)} width={w * 0.7 * k} height={0.004 * k} rx={w * 0.3 * k} fill="#fbfcfe" stroke="#475569" strokeWidth="0.6" />
      {/* finger with a thimble */}
      <rect x={view.sx(-0.0085)} y={view.sy(top)} width={0.017 * k} height={view.sy(yf + 0.011) - view.sy(top)} fill="#f2c79b" stroke="#c98d5e" strokeWidth="1" />
      <path
        d={`M${P(-0.0095, yf + 0.016)} L${P(-0.0095, yf + 0.005)} Q${P(-0.0095, yf)} ${P(0, yf)} Q${P(0.0095, yf)} ${P(0.0095, yf + 0.005)} L${P(0.0095, yf + 0.016)} Z`}
        fill="#cbd5e1"
        stroke="#64748b"
        strokeWidth="1.1"
      />
      {[-0.005, 0, 0.005].map((x) =>
        [0.004, 0.008, 0.012].map((dy) => <circle key={`${x}${dy}`} cx={view.sx(x)} cy={view.sy(yf + dy)} r={Math.max(0.8, 0.0007 * k)} fill="#94a3b8" />),
      )}
    </g>
  );
}

/** A fingertip pressing on the plasticine with a contact of area S. */
export function Finger({ view, S, h }) {
  const k = view.k;
  const y0 = -h;
  const d = 2 * Math.sqrt(S / Math.PI);
  const wf = Math.max(0.016, d + 0.004);
  const P = (x, yy) => `${view.sx(x).toFixed(1)},${view.sy(yy).toFixed(1)}`;
  const top = view.wy(-10);
  const shape = `M${P(-d / 2, y0)} L${P(d / 2, y0)} Q${P(wf / 2, y0)} ${P(wf / 2, y0 + 0.007)} L${P(wf / 2, top)} L${P(-wf / 2, top)} L${P(-wf / 2, y0 + 0.007)} Q${P(-wf / 2, y0)} ${P(-d / 2, y0)} Z`;
  return (
    <g aria-hidden="true">
      <path d={shape} fill="#f2c79b" stroke="#c98d5e" strokeWidth="1.1" strokeLinejoin="round" />
      <path d={`M${P(wf / 2 - 0.0012, y0 + 0.005)} L${P(wf / 2 - 0.0012, y0 + 0.017)}`} stroke="#fbe3e8" strokeWidth={Math.max(2, 0.0022 * k)} strokeLinecap="round" />
      <path d={`M${P(-wf / 2 + 0.002, y0 + 0.027)} Q${P(0, y0 + 0.025)} ${P(wf / 2 - 0.002, y0 + 0.027)}`} fill="none" stroke="#c98d5e" strokeWidth="1" />
    </g>
  );
}

/** Where the F arrow ends (screen point just above the body) for a kind. */
export function forceAnchor(view, kind, S, h) {
  const K = KINDS[kind];
  if (K.body === 'brick') {
    const o = oblique(K.b, view.k);
    return { x: view.sx(0) + o.x / 2, y: view.sy(-h + K.H) + o.y / 2 - 6 };
  }
  if (K.body === 'person') return { x: view.sx(0.01), y: view.sy(personTop(kind, h)) - 6 };
  if (kind === 'tank') return { x: view.sx(-0.3), y: view.sy(-h + 2.22) - 6 };
  if (kind === 'car') {
    const { yc } = carWheel(S / (4 * PATCH_W), h);
    return { x: view.sx(0.05), y: view.sy(yc + 1.14) - 6 };
  }
  if (kind === 'tip') return { x: view.sx(0.0185), y: view.sy(-h + 0.048) };
  const d = 2 * Math.sqrt(S / Math.PI);
  return { x: view.sx(Math.max(0.016, d + 0.004) / 2 + 0.0065), y: view.sy(-h + 0.012) };
}
