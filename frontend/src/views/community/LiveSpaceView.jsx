import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Satellite, Gauge, Crosshair, Search, Activity, PlayCircle } from 'lucide-react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Line } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { propagate, gstime, eciToEcf, eciToGeodetic } from 'satellite.js';
import { ommToSatrec } from '@/solar/omm';
import { useTranslation } from '@/hooks/useTranslation';
import FeaturedSatellites from '@/components/live/FeaturedSatellites';
import UpcomingLaunches from '@/components/live/UpcomingLaunches';
import NasaApod from '@/components/live/NasaApod';

const EARTH_RADIUS = 2;
const EARTH_KM = 6371;

const TLE_SOURCES = [
  { group: 'stations', type: 'ISS', limit: 500 },
  { group: 'starlink', type: 'Starlink', limit: 12000 },
  { group: 'active', type: 'LEO', limit: 15000 },
];

function parseGpGroup(records, cfg) {
  const satellites = [];
  for (const omm of records) {
    if (satellites.length >= cfg.limit) break;
    try {
      const satrec = ommToSatrec(omm);
      if (satrec.error) continue;
      const name = String(omm.OBJECT_NAME || '').replace(/^0\s*/, '');
      const low = name.toLowerCase();
      const type = cfg.type === 'LEO'
        ? (low.includes('geo') ? 'GEO' : low.includes('meo') ? 'MEO' : 'LEO')
        : cfg.type;
      satellites.push({
        id: String(omm.NORAD_CAT_ID),
        name,
        type,
        satrec,
        color: new THREE.Color('#ff2d6a'),
      });
    } catch {
      // ignore broken records
    }
  }
  return satellites;
}

/**
 * Element sets come from our own backend (`apps.space`), which fetches each
 * CelesTrak group at most once per update and serves it from cache. Thirty
 * browsers in one classroom asking CelesTrak directly is exactly what their
 * usage policy firewalls.
 */
async function loadRealSatellites() {
  const jobs = TLE_SOURCES.map(async (cfg) => {
    const url = `/api/v1/space/gp/?group=${cfg.group}&limit=${cfg.limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`failed ${cfg.group}`);
    const body = await response.json();
    return parseGpGroup(body.satellites || [], cfg);
  });

  const settled = await Promise.allSettled(jobs);
  const all = [];
  for (const item of settled) {
    if (item.status === 'fulfilled') all.push(...item.value);
  }
  if (!all.length) throw new Error('no tle');
  const uniq = new Map();
  for (const sat of all) {
    if (!uniq.has(sat.id)) uniq.set(sat.id, sat);
  }
  return Array.from(uniq.values());
}

// There is deliberately no hard-coded element set to fall back on.
//
// There used to be. Most recently it was the ISS sample TLE that ships in
// satellite.js's own documentation, epoch 20 September 2008 — 6 551 days
// before this was written. Propagated to today it puts the station 13 006 km
// from where it is, which is very nearly the far side of the planet, while
// the panel reported altitude to a tenth of a kilometre and latitude to a
// hundredth of a degree, refreshed every 700 ms, under a badge reading
// "Fallback TLE mode" in English only.
//
// An orbit we cannot fetch is an orbit we do not know. The page now says
// that, in the reader's own language, and draws nothing.

function RealEarth() {
  const earthRef = useRef(null);
  const cloudRef = useRef(null);
  const [dayMap, bumpMap, specMap, nightMap, cloudMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth_atmos_2048.jpg',
    '/textures/earth_normal_2048.jpg',
    '/textures/earth_specular_2048.jpg',
    '/textures/earth_lights_2048.png',
    '/textures/earth_clouds_1024.png',
  ]);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.03;
    if (cloudRef.current) cloudRef.current.rotation.y += delta * 0.037;
  });

  return (
    <group>
      <group ref={earthRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          <meshPhongMaterial
            map={dayMap}
            bumpMap={bumpMap}
            bumpScale={0.03}
            specularMap={specMap}
            specular={new THREE.Color('#445577')}
            shininess={20}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS * 1.0015, 96, 96]} />
          <meshBasicMaterial
            map={nightMap}
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh ref={cloudRef}>
        <sphereGeometry args={[EARTH_RADIUS * 1.01, 96, 96]} />
        <meshPhongMaterial map={cloudMap} transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[EARTH_RADIUS * 1.03, 64, 64]} />
        <meshBasicMaterial
          color="#3ba8ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function SelectedDirectionTrail({ sat }) {
  const markerRef = useRef(null);
  const points = useMemo(() => {
    const trail = [];
    const base = new Date();
    for (let i = 0; i <= 24; i++) {
      const dt = new Date(base.getTime() + i * 45 * 1000);
      const pv = propagate(sat.satrec, dt);
      if (!pv.position) continue;
      const gmstValue = gstime(dt);
      const ecf = eciToEcf(pv.position, gmstValue);
      trail.push(
        new THREE.Vector3(
          (ecf.x / EARTH_KM) * EARTH_RADIUS,
          (ecf.z / EARTH_KM) * EARTH_RADIUS,
          (ecf.y / EARTH_KM) * EARTH_RADIUS,
        ),
      );
    }
    return trail;
  }, [sat]);

  useFrame(() => {
    if (!markerRef.current) return;
    const now = new Date();
    const pv = propagate(sat.satrec, now);
    if (!pv.position) return;
    const gmstValue = gstime(now);
    const ecf = eciToEcf(pv.position, gmstValue);
    markerRef.current.position.set(
      (ecf.x / EARTH_KM) * EARTH_RADIUS,
      (ecf.z / EARTH_KM) * EARTH_RADIUS,
      (ecf.y / EARTH_KM) * EARTH_RADIUS,
    );
  });

  if (points.length < 3) return null;
  return (
    <group>
      <Line points={points} color="#ffe45c" opacity={0.95} transparent lineWidth={2.2} />
      <group ref={markerRef}>
        <mesh>
          <sphereGeometry args={[0.048, 18, 18]} />
          <meshBasicMaterial color="#ffe45c" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshBasicMaterial color="#ffe45c" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function EarthAndSatellites({ satellites, selectedSatId, onSelect }) {
  const pointsRef = useRef(null);
  const glowRef = useRef(null);
  const hitRef = useRef(null);
  const surfaceRef = useRef(null);
  const surfaceHitRef = useRef(null);
  const lastRefreshRef = useRef(0);
  const dotSprite = useMemo(() => {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const center = size / 2;
    const radius = size * 0.36;
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  const positions = useMemo(() => new Float32Array(satellites.length * 3), [satellites]);
  const surfacePositions = useMemo(() => new Float32Array(satellites.length * 3), [satellites]);
  const colors = useMemo(() => {
    const out = new Float32Array(satellites.length * 3);
    for (let i = 0; i < satellites.length; i++) {
      const c = satellites[i].id === selectedSatId ? new THREE.Color('#ffe45c') : satellites[i].color;
      out[i * 3] = c.r;
      out[i * 3 + 1] = c.g;
      out[i * 3 + 2] = c.b;
    }
    return out;
  }, [satellites, selectedSatId]);

  useFrame(() => {
    const nowMs = performance.now();
    if (nowMs - lastRefreshRef.current < 260) return;
    lastRefreshRef.current = nowMs;
    if (!pointsRef.current || !satellites.length) return;

    const now = new Date();
    const gmstValue = gstime(now);
    const core = pointsRef.current.geometry.attributes.position.array;
    const glow = glowRef.current?.geometry.attributes.position.array;
    const hit = hitRef.current?.geometry.attributes.position.array;
    const surface = surfaceRef.current?.geometry.attributes.position.array;
    const surfaceHit = surfaceHitRef.current?.geometry.attributes.position.array;

    for (let i = 0; i < satellites.length; i++) {
      const pv = propagate(satellites[i].satrec, now);
      if (!pv.position) continue;
      const ecf = eciToEcf(pv.position, gmstValue);
      const geo = eciToGeodetic(pv.position, gmstValue);
      const x = (ecf.x / EARTH_KM) * EARTH_RADIUS;
      const y = (ecf.z / EARTH_KM) * EARTH_RADIUS;
      const z = (ecf.y / EARTH_KM) * EARTH_RADIUS;
      core[i * 3] = x;
      core[i * 3 + 1] = y;
      core[i * 3 + 2] = z;
      if (glow) {
        glow[i * 3] = x;
        glow[i * 3 + 1] = y;
        glow[i * 3 + 2] = z;
      }
      if (hit) {
        hit[i * 3] = x;
        hit[i * 3 + 1] = y;
        hit[i * 3 + 2] = z;
      }
      if (surface || surfaceHit) {
        const cosLat = Math.cos(geo.latitude);
        const sx = EARTH_RADIUS * 1.002 * cosLat * Math.cos(geo.longitude);
        const sy = EARTH_RADIUS * 1.002 * Math.sin(geo.latitude);
        const sz = EARTH_RADIUS * 1.002 * cosLat * Math.sin(geo.longitude);
        if (surface) {
          surface[i * 3] = sx;
          surface[i * 3 + 1] = sy;
          surface[i * 3 + 2] = sz;
        }
        if (surfaceHit) {
          surfaceHit[i * 3] = sx;
          surfaceHit[i * 3 + 1] = sy;
          surfaceHit[i * 3 + 2] = sz;
        }
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    if (glowRef.current) glowRef.current.geometry.attributes.position.needsUpdate = true;
    if (hitRef.current) hitRef.current.geometry.attributes.position.needsUpdate = true;
    if (surfaceRef.current) surfaceRef.current.geometry.attributes.position.needsUpdate = true;
    if (surfaceHitRef.current) surfaceHitRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const selectedSat = useMemo(
    () => satellites.find((sat) => sat.id === selectedSatId),
    [satellites, selectedSatId],
  );

  return (
    <group>
      <RealEarth />

      {satellites.length > 0 && (
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={satellites.length} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={satellites.length} array={colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial map={dotSprite} alphaTest={0.5} size={0.018} vertexColors transparent opacity={0.85} sizeAttenuation depthWrite={false} />
        </points>
      )}

      {satellites.length > 0 && (
        <points ref={surfaceRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={satellites.length} array={surfacePositions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={satellites.length} array={colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial map={dotSprite} alphaTest={0.5} size={0.017} vertexColors transparent opacity={0.96} sizeAttenuation depthWrite={false} />
        </points>
      )}

      {satellites.length > 0 && (
        <points ref={glowRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={satellites.length} array={positions} itemSize={3} />
            <bufferAttribute attach="attributes-color" count={satellites.length} array={colors} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial map={dotSprite} alphaTest={0.35} size={0.042} vertexColors transparent opacity={0.9} sizeAttenuation blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
      )}

      {satellites.length > 0 && (
        <points
          ref={surfaceHitRef}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (typeof event.index === 'number') {
              const sat = satellites[event.index];
              if (sat) onSelect(sat.id);
            }
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={satellites.length} array={surfacePositions} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.12} transparent opacity={0} sizeAttenuation depthWrite={false} />
        </points>
      )}

      {satellites.length > 0 && (
        <points
          ref={hitRef}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (typeof event.index === 'number') {
              const sat = satellites[event.index];
              if (sat) onSelect(sat.id);
            }
          }}
        >
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={satellites.length} array={positions} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial size={0.15} transparent opacity={0} sizeAttenuation depthWrite={false} />
        </points>
      )}

      {selectedSat && <SelectedDirectionTrail sat={selectedSat} />}

      <ambientLight intensity={0.14} />
      <directionalLight position={[8, 3, -6]} intensity={1.6} color="#ffecc7" />
      <directionalLight position={[-7, -2, 7]} intensity={0.28} color="#7799ff" />
    </group>
  );
}

function getSatMetrics(sat) {
  if (!sat?.satrec) return null;
  const now = new Date();
  const pv = propagate(sat.satrec, now);
  if (!pv.position || !pv.velocity) return null;
  const gmstValue = gstime(now);
  const geo = eciToGeodetic(pv.position, gmstValue);
  const speed = Math.sqrt(pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2) * 3600;
  return {
    alt: geo.height.toFixed(1),
    vel: speed.toFixed(0),
    inc: ((sat.satrec.inclo || 0) * (180 / Math.PI)).toFixed(2),
    lat: (geo.latitude * (180 / Math.PI)).toFixed(2),
    lon: (geo.longitude * (180 / Math.PI)).toFixed(2),
  };
}

async function fetchSatCatalogDetails(noradId) {
  if (!noradId) return null;
  try {
    const response = await fetch(`https://celestrak.org/satcat/records.php?CATNR=${noradId}&FORMAT=JSON`);
    if (!response.ok) return null;
    const data = await response.json();
    return Array.isArray(data) ? data[0] || null : null;
  } catch {
    return null;
  }
}

export default function LiveSpaceView() {
  // This used to award 20 XP here, on mount. Not for watching anything —
  // for the page rendering, once per visit, unbounded. Ticket R2 asked whether
  // to give it a server endpoint; there is nothing to verify server-side, so
  // the award went instead.
  const { t } = useTranslation();
  const [satellites, setSatellites] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSatId, setSelectedSatId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [feedState, setFeedState] = useState('loading');
  const [satCatalog, setSatCatalog] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [streamOpen, setStreamOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadRealSatellites()
      .then((data) => {
        if (!mounted) return;
        setSatellites(data);
        const iss = data.find((sat) => sat.type === 'ISS');
        setSelectedSatId(iss?.id || data[0]?.id || null);
        setFeedState('ok');
      })
      .catch((err) => {
        if (!mounted) return;
        // Rule C-10: handled, not swallowed. The badge reports it to the
        // reader; this is for whoever is looking at a console.
        console.warn('Could not load orbital elements', err);
        setSatellites([]);
        setSelectedSatId(null);
        setFeedState('failed');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredSats = useMemo(() => {
    if (!searchQuery) return satellites.slice(0, 800);
    return satellites.filter((sat) => sat.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [satellites, searchQuery]);

  const selectedSat = useMemo(
    () => satellites.find((sat) => sat.id === selectedSatId),
    [satellites, selectedSatId],
  );

  useEffect(() => {
    if (!selectedSat) return;
    const refresh = () => setMetrics(getSatMetrics(selectedSat));
    refresh();
    const timer = setInterval(refresh, 700);
    return () => clearInterval(timer);
  }, [selectedSat]);

  useEffect(() => {
    if (!selectedSat?.id) {
      setSatCatalog(null);
      return;
    }
    let active = true;
    setCatalogLoading(true);
    fetchSatCatalogDetails(selectedSat.id)
      .then((details) => {
        if (!active) return;
        setSatCatalog(details);
      })
      .finally(() => {
        if (!active) return;
        setCatalogLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSat?.id]);

  return (
    <div className="min-h-screen bg-[#020205] text-white font-sans selection:bg-neon-blue/30 pt-16">
      <section className="relative h-[calc(100vh-4rem)] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 1.5, 7.2], fov: 42 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
            <color attach="background" args={['#010103']} />
            <Stars radius={120} depth={60} count={7000} factor={2.2} saturation={0} fade speed={0.45} />
            <Suspense fallback={null}>
              <EarthAndSatellites satellites={satellites} selectedSatId={selectedSatId} onSelect={setSelectedSatId} />
            </Suspense>
            <EffectComposer disableNormalPass>
              <Bloom luminanceThreshold={0.15} mipmapBlur intensity={1.4} />
            </EffectComposer>
            <OrbitControls enablePan panSpeed={0.5} minDistance={3.2} maxDistance={13} autoRotate autoRotateSpeed={0.16} dampingFactor={0.05} />
          </Canvas>
        </div>

        <div className="absolute inset-0 pt-20 pb-4 px-4 sm:px-6 z-10 pointer-events-none flex flex-col justify-between">
          <div className="h-2" />
          <div className="flex justify-between items-end flex-1 my-4 gap-4">
            <div className="w-full max-w-sm pointer-events-auto flex flex-col gap-4">
              <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[10px] uppercase tracking-widest text-cyan-300 backdrop-blur-md">
                {feedState === 'ok' ? t('liveSpace', 'liveTle')
                  : feedState === 'failed' ? t('liveSpace', 'elementsUnavailable')
                    : t('liveSpace', 'loadingElements')}
              </div>

              <AnimatePresence mode="popLayout">
                {selectedSat && metrics && (
                  <motion.div
                    key="target-info"
                    initial={{ opacity: 0, x: -20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="backdrop-blur-2xl bg-black/60 border border-neon-blue/30 rounded-2xl p-5 shadow-[0_0_40px_rgba(0,240,255,0.15)] relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-blue to-transparent" />
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-[10px] text-neon-blue font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                          <Crosshair className="w-3 h-3" /> Target Locked
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-wider truncate max-w-[200px]">{selectedSat.name}</h3>
                      </div>
                      <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                        <Satellite className="w-5 h-5 text-gray-300" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="bg-black/50 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                          <Activity className="w-3.5 h-3.5 text-neon-purple" /> Altitude
                        </div>
                        <div className="font-mono text-sm text-white">
                          {metrics.alt} <span className="text-gray-500 text-[10px]">km</span>
                        </div>
                      </div>
                      <div className="bg-black/50 p-3 rounded-xl border border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-gray-400 text-[11px] font-bold uppercase tracking-widest">
                          <Gauge className="w-3.5 h-3.5 text-orange-400" /> Velocity
                        </div>
                        <div className="font-mono text-sm text-white">
                          {metrics.vel} <span className="text-gray-500 text-[10px]">km/h</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 flex flex-col">
                          <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1">Inclination</span>
                          <span className="font-mono text-sm text-white">{metrics.inc} deg</span>
                        </div>
                        <div className="bg-black/50 p-2.5 rounded-xl border border-white/5 flex flex-col">
                          <span className="text-gray-500 text-[9px] font-bold uppercase tracking-widest mb-1">Lat / Lon</span>
                          <span className="font-mono text-sm text-white">{metrics.lat} / {metrics.lon}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="backdrop-blur-xl bg-black/50 border border-white/10 rounded-2xl flex flex-col h-[350px] shadow-2xl">
                <div className="p-4 border-b border-white/10">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search constellation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl py-3 px-4 pl-11 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors font-mono"
                    />
                    <Search className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {filteredSats.map((sat) => (
                    <button
                      key={sat.id}
                      onClick={() => setSelectedSatId(sat.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${selectedSatId === sat.id
                        ? 'bg-neon-blue/20 border border-neon-blue/50 shadow-[0_0_15px_rgba(0,240,255,0.15)]'
                        : 'bg-transparent border border-transparent hover:bg-white/5'
                        }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: selectedSatId === sat.id ? '#ffe45c' : sat.color.getStyle(),
                          boxShadow: `0 0 10px ${selectedSatId === sat.id ? '#ffe45c' : sat.color.getStyle()}`,
                        }}
                      />
                      <div className="truncate flex-grow">
                        <div className={`font-mono text-xs font-bold truncate transition-colors ${selectedSatId === sat.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                          {sat.name}
                        </div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{sat.type}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="hidden lg:block w-72 pointer-events-auto">
              <div className="backdrop-blur-xl bg-black/55 border border-white/10 rounded-2xl p-4 shadow-2xl">
                <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-bold mb-3">Satellite Details</div>
                {selectedSat ? (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Identity</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-300">
                        <span className="text-gray-500">Name</span><span className="text-right truncate">{selectedSat.name}</span>
                        <span className="text-gray-500">NORAD</span><span className="text-right">{selectedSat.id}</span>
                        <span className="text-gray-500">Type</span><span className="text-right">{selectedSat.type}</span>
                        <span className="text-gray-500">Object</span><span className="text-right">{satCatalog?.OBJECT_TYPE || 'Unknown'}</span>
                        <span className="text-gray-500">Country</span><span className="text-right">{satCatalog?.OWNER || 'Unknown'}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Orbital Telemetry</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-300">
                        <span className="text-gray-500">Altitude</span><span className="text-right">{metrics?.alt || '--'} km</span>
                        <span className="text-gray-500">Velocity</span><span className="text-right">{metrics?.vel || '--'} km/h</span>
                        <span className="text-gray-500">Inclination</span><span className="text-right">{metrics?.inc || '--'} deg</span>
                        <span className="text-gray-500">Latitude</span><span className="text-right">{metrics?.lat || '--'}</span>
                        <span className="text-gray-500">Longitude</span><span className="text-right">{metrics?.lon || '--'}</span>
                        <span className="text-gray-500">Eccentricity</span><span className="text-right">{selectedSat.satrec?.ecco?.toFixed?.(6) || '--'}</span>
                        <span className="text-gray-500">Period</span><span className="text-right">{selectedSat.satrec?.no ? (1440 / (selectedSat.satrec.no * 1440 / (2 * Math.PI))).toFixed(1) : '--'} min</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-2">Launch + Mission</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-300">
                        <span className="text-gray-500">Intl Desig.</span><span className="text-right">{satCatalog?.OBJECT_ID || 'Unknown'}</span>
                        <span className="text-gray-500">Launch Date</span><span className="text-right">{satCatalog?.LAUNCH_DATE || 'Unknown'}</span>
                        <span className="text-gray-500">Launch Site</span><span className="text-right">{satCatalog?.LAUNCH_SITE || 'Unknown'}</span>
                        <span className="text-gray-500">Status</span><span className="text-right">{satCatalog?.OPS_STATUS_CODE || 'Unknown'}</span>
                        <span className="text-gray-500">Apogee</span><span className="text-right">{satCatalog?.APOGEE ? `${satCatalog.APOGEE} km` : 'Unknown'}</span>
                        <span className="text-gray-500">Perigee</span><span className="text-right">{satCatalog?.PERIGEE ? `${satCatalog.PERIGEE} km` : 'Unknown'}</span>
                      </div>
                    </div>
                    {catalogLoading && <div className="text-[11px] text-gray-500">Loading extended catalog info...</div>}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">Select a red satellite point to view full details.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 px-4 sm:px-6 py-8 space-y-6 bg-gradient-to-b from-[#020205] to-black">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {t('liveSpace', 'featuredTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            {t('liveSpace', 'featuredSubtitle')}
          </p>
          <div className="mt-5">
            <FeaturedSatellites />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-cyan-300">
            {t('liveSpace', 'upcomingMissions')}
          </h3>
          <UpcomingLaunches />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-cyan-300">
              {t('liveSpace', 'nasaLive')}
            </h3>
            {/*
              Click to load, and youtube-nocookie. The embed used to carry
              `autoplay=1`, so opening this page opened a connection to
              YouTube and set its cookies for every child who arrived,
              whether or not they wanted the video. Nothing reaches a third
              party now until somebody asks for it.
            */}
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/60">
              {streamOpen ? (
                <iframe
                  src="https://www.youtube-nocookie.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1"
                  title={t('liveSpace', 'nasaLive')}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setStreamOpen(true)}
                  className="group flex h-full w-full flex-col items-center justify-center gap-3 px-4 text-center transition-colors hover:bg-white/[0.03]"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 transition-colors group-hover:bg-cyan-400/20">
                    <PlayCircle className="h-7 w-7 text-cyan-300" />
                  </span>
                  <span className="text-sm font-bold text-white">
                    {t('liveSpace', 'loadStream')}
                  </span>
                  <span className="max-w-xs text-xs text-white/40">
                    {t('liveSpace', 'streamPrivacy')}
                  </span>
                </button>
              )}
            </div>
            <div className="mt-3 text-[11px] text-white/40">
              {t('liveSpace', 'streamNote')}{' '}
              <a
                href="https://www.nasa.gov/nasatv/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                nasa.gov/nasatv
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl sm:p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-cyan-300">
              {t('liveSpace', 'nasaApod')}
            </h3>
            <NasaApod />
          </div>
        </div>
      </section>
    </div>
  );
}

