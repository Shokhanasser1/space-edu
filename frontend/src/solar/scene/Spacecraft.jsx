import { useEffect, useMemo, useRef, useState } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { SPACECRAFT } from '../catalog';
import { msToJd, simClock, useSolarStore } from '../clock';
import { setWorld } from '../positions';
import { AU_UNITS, eclipticToScene } from '../scale';
import { dotTexture } from './dot';

/**
 * Deep-space probes on their real trajectories.
 *
 * JPL Horizons knows where Voyager 1 is to the kilometre; our backend asks it
 * once a day for a window of positions (`/api/v1/space/ephemeris/`) and the
 * page interpolates. Outside the fetched window the marker hides rather than
 * guess — a probe drawn in the wrong place is worse than no probe.
 */

function interpolate(samples, jd, out) {
  const n = samples.length;
  if (!n || jd < samples[0][0] || jd > samples[n - 1][0]) return false;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= jd) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const t = hi === lo ? 0 : (jd - a[0]) / (b[0] - a[0]);
  out[0] = a[1] + (b[1] - a[1]) * t;
  out[1] = a[2] + (b[2] - a[2]) * t;
  out[2] = a[3] + (b[3] - a[3]) * t;
  return true;
}

function Probe({ craft, track }) {
  const groupRef = useRef();
  const ecl = useMemo(() => [0, 0, 0], []);
  const scene = useMemo(() => [0, 0, 0], []);
  const trail = useMemo(
    () => track.samples.map((s) => {
      eclipticToScene([s[1], s[2], s[3]], AU_UNITS, scene);
      return [scene[0], scene[1], scene[2]];
    }),
    [track, scene],
  );

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const ok = interpolate(track.samples, msToJd(simClock.ms), ecl);
    g.visible = ok;
    if (!ok) return;
    eclipticToScene(ecl, AU_UNITS, scene);
    g.position.set(scene[0], scene[1], scene[2]);
    setWorld(craft.id, g.position, 0);
  });

  return (
    <group>
      {trail.length > 1 && <Line points={trail} color={craft.color} lineWidth={1} transparent opacity={0.45} depthWrite={false} />}
      <group ref={groupRef}>
        <sprite scale={[0.022, 0.022, 1]}>
          <spriteMaterial map={dotTexture()} color={craft.color} sizeAttenuation={false} depthWrite={false} transparent toneMapped={false} />
        </sprite>
      </group>
    </group>
  );
}

export default function Spacecraft({ enabled }) {
  const [tracks, setTracks] = useState({});
  const setCraftStatus = useSolarStore((s) => s.setCraftStatus);

  useEffect(() => {
    if (!enabled || typeof fetch !== 'function') return undefined;
    let alive = true;
    setCraftStatus('loading');
    // One probe at a time: six simultaneous Horizons queries from every
    // browser is a burst JPL does not need, and the backend caches each for a day.
    (async () => {
      const next = {};
      for (const c of SPACECRAFT) {
        try {
          const r = await fetch(`/api/v1/space/ephemeris/?body=${encodeURIComponent(c.id)}&days=60`);
          if (!r.ok) continue;
          const body = await r.json();
          if (body?.samples?.length > 1) next[c.id] = body;
        } catch {
          // Skip the probe; the layer shows what it could get.
        }
        if (!alive) return;
      }
      setTracks(next);
      setCraftStatus(Object.keys(next).length ? 'ready' : 'error');
    })();
    return () => {
      alive = false;
    };
  }, [enabled, setCraftStatus]);

  if (!enabled) return null;
  return (
    <group>
      {SPACECRAFT.filter((c) => tracks[c.id]).map((c) => (
        <Probe key={c.id} craft={c} track={tracks[c.id]} />
      ))}
    </group>
  );
}
