import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { propagate } from 'satellite.js';
import { simClock, useSolarStore } from '../clock';
import { eqjToEcliptic } from '../ephemeris';
import { ommToSatrec } from '../omm';
import { getRadius, getWorld, setWorld } from '../positions';
import { eclipticToScene } from '../scale';
import { dotTexture } from './dot';

/**
 * Artificial satellites around the Earth: the ISS and the other crewed
 * stations, plus the brightest few hundred objects, propagated with SGP4 from
 * CelesTrak element sets served by our backend (`/api/v1/space/gp/`).
 *
 * The browser never talks to CelesTrak: their policy is one download per
 * update and an error-count firewall, and a classroom is thirty browsers on
 * one IP. Positions are computed in TEME (an Earth-centred inertial frame),
 * rotated into the ecliptic and scaled by the Earth's drawn radius, so they
 * sit correctly over the spinning globe. SGP4 is only good for a few weeks
 * around each element set's epoch; outside ±30 days the layer hides itself
 * and says so.
 */

const GROUPS = [
  { group: 'stations', limit: 40 },
  { group: 'visual', limit: 400 },
];
const EARTH_KM = 6371;
const VALID_DAYS = 30;
const ISS_ID = '25544';

async function loadGroup(cfg) {
  const res = await fetch(`/api/v1/space/gp/?group=${cfg.group}&limit=${cfg.limit}`);
  if (!res.ok) throw new Error(`gp ${cfg.group} ${res.status}`);
  const body = await res.json();
  const out = [];
  for (const omm of body.satellites || []) {
    try {
      const satrec = ommToSatrec(omm);
      if (satrec.error) continue;
      out.push({
        id: String(omm.NORAD_CAT_ID),
        name: omm.OBJECT_NAME,
        satrec,
        epochMs: new Date(omm.EPOCH.endsWith('Z') ? omm.EPOCH : `${omm.EPOCH}Z`).getTime(),
        station: cfg.group === 'stations',
      });
    } catch {
      // A malformed record is CelesTrak's problem, not the page's.
    }
  }
  return out;
}

export default function Satellites({ earth, enabled, onSelect }) {
  const [sats, setSats] = useState([]);
  const pointsRef = useRef();
  const stationsRef = useRef();
  const last = useRef(0);
  const setSatStatus = useSolarStore((s) => s.setSatStatus);
  const sprite = useMemo(() => dotTexture(), []);
  const tmpEqj = [0, 0, 0];
  const tmpEcl = [0, 0, 0];
  const tmpScene = [0, 0, 0];

  useEffect(() => {
    if (!enabled || typeof fetch !== 'function') return undefined;
    let alive = true;
    setSatStatus({ state: 'loading', count: 0 });
    Promise.allSettled(GROUPS.map(loadGroup)).then((results) => {
      if (!alive) return;
      const seen = new Map();
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const s of r.value) if (!seen.has(s.id)) seen.set(s.id, s);
      }
      const list = Array.from(seen.values());
      setSats(list);
      setSatStatus({ state: list.length ? 'ready' : 'error', count: list.length });
    });
    return () => {
      alive = false;
    };
  }, [enabled, setSatStatus]);

  const positions = useMemo(() => new Float32Array(Math.max(sats.length, 1) * 3), [sats]);
  const stationPositions = useMemo(() => new Float32Array(Math.max(sats.filter((s) => s.station).length, 1) * 3), [sats]);
  const stations = useMemo(() => sats.filter((s) => s.station), [sats]);

  useFrame(() => {
    if (!enabled || !sats.length || !pointsRef.current) return;
    const now = performance.now();
    if (now - last.current < 250) return;
    last.current = now;

    const earthPos = getWorld(earth.id);
    if (!earthPos) return;
    const unitsPerKm = getRadius(earth.id) / EARTH_KM;
    const ms = simClock.ms;
    const date = new Date(ms);
    let shown = 0;
    let stationIndex = 0;
    for (let i = 0; i < sats.length; i++) {
      const sat = sats[i];
      const inRange = Math.abs(ms - sat.epochMs) < VALID_DAYS * 86_400_000;
      let x = 1e9, y = 1e9, z = 1e9;
      if (inRange) {
        const pv = propagate(sat.satrec, date);
        if (pv?.position) {
          tmpEqj[0] = pv.position.x;
          tmpEqj[1] = pv.position.y;
          tmpEqj[2] = pv.position.z;
          eqjToEcliptic(tmpEqj, tmpEcl);
          eclipticToScene(tmpEcl, unitsPerKm, tmpScene);
          x = earthPos.x + tmpScene[0];
          y = earthPos.y + tmpScene[1];
          z = earthPos.z + tmpScene[2];
          shown++;
        }
      }
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      if (sat.station) {
        stationPositions[stationIndex * 3] = x;
        stationPositions[stationIndex * 3 + 1] = y;
        stationPositions[stationIndex * 3 + 2] = z;
        stationIndex++;
        if (sat.id === ISS_ID && x < 1e8) setWorld('iss', { x, y, z }, 0);
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (stationsRef.current) stationsRef.current.geometry.attributes.position.needsUpdate = true;
    const { satStatus } = useSolarStore.getState();
    const state = shown ? 'ready' : 'outOfRange';
    if (satStatus.state !== state && satStatus.state !== 'loading') setSatStatus({ state, count: shown });
  });

  if (!enabled || !sats.length) return null;
  return (
    <group>
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={sats.length} array={positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial map={sprite} color="#9fe3ff" size={4} sizeAttenuation={false} transparent opacity={0.9} alphaTest={0.4} depthWrite={false} />
      </points>
      <points
        ref={stationsRef}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          const sat = stations[e.index];
          if (sat) onSelect?.(sat);
        }}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={stations.length} array={stationPositions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial map={sprite} color="#ffd166" size={9} sizeAttenuation={false} transparent opacity={1} alphaTest={0.4} depthWrite={false} />
      </points>
    </group>
  );
}
