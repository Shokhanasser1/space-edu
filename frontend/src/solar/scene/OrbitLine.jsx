import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { helioPositionAU } from '../ephemeris';
import { periodDays } from '../kepler';
import { AU_UNITS, eclipticToScene } from '../scale';

/**
 * A body's path over one revolution, sampled from the same ephemeris that
 * moves it, centred on the year the viewer opened the page. Sampling the real
 * trajectory (rather than drawing an ellipse from mean elements) means the
 * planet sits exactly on its line, and the line is right for the century.
 */

const PERIOD_DAYS = {
  mercury: 87.969, venus: 224.701, earth: 365.256, mars: 686.98, jupiter: 4332.59,
  saturn: 10759.2, uranus: 30688.5, neptune: 60182, pluto: 90560,
};

export function orbitPeriodDays(entry) {
  if (PERIOD_DAYS[entry.id]) return PERIOD_DAYS[entry.id];
  if (entry.orbit) return periodDays(entry.orbit.a);
  return 365.25;
}

export default function OrbitLine({ entry, centreMs, color, selected }) {
  const points = useMemo(() => {
    const period = orbitPeriodDays(entry) * 86_400_000;
    const n = 256;
    const out = [];
    const ecl = [0, 0, 0];
    const scene = [0, 0, 0];
    for (let i = 0; i <= n; i++) {
      const ms = centreMs - period / 2 + (period * i) / n;
      helioPositionAU(entry, ms, ecl);
      eclipticToScene(ecl, AU_UNITS, scene);
      out.push([scene[0], scene[1], scene[2]]);
    }
    return out;
  }, [entry, centreMs]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={selected ? 1.6 : 1}
      transparent
      opacity={selected ? 0.75 : 0.28}
      depthWrite={false}
    />
  );
}
