import { useMemo } from 'react';

/**
 * The still that stands in for the 3D sky: a deterministic scatter of stars
 * over the warm-graphite ground, drawn as inline SVG so there is no image to
 * fetch and nothing to fail. Also the first frame under the canvas while the
 * scene loads.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COUNT = 220;

export default function IntroPoster({ className = '' }) {
  const stars = useMemo(() => {
    const rand = mulberry32(20260828);
    return Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      r: 0.08 + rand() * 0.22,
      o: 0.35 + rand() * 0.65,
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{
        background:
          'radial-gradient(70% 55% at 78% 62%, rgba(111,179,255,0.10) 0%, transparent 60%),'
          + 'radial-gradient(45% 40% at 18% 12%, rgba(139,92,246,0.18) 0%, transparent 70%),'
          + 'linear-gradient(180deg, #100d17 0%, #06050b 100%)',
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {stars.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
        ))}
      </svg>
      {/* An Earth limb, low right: the one shape the 3D scene is built around. */}
      <div
        className="absolute rounded-full"
        style={{
          width: '120vmax', height: '120vmax', right: '-70vmax', bottom: '-96vmax',
          background: 'radial-gradient(circle at 30% 20%, #3b8ad9 0%, #1a4a8a 30%, #0b1e3f 60%, #05050b 72%)',
          boxShadow: '0 0 120px 30px rgba(111,179,255,0.18)',
        }}
      />
    </div>
  );
}
