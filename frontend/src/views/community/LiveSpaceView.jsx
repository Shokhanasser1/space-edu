import { Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity, AlertTriangle, Crosshair, Gauge, PlayCircle, Radar, Search,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { propagate, gstime, eciToGeodetic } from 'satellite.js';
import { ommToSatrec } from '@/solar/omm';
import { useTranslation } from '@/hooks/useTranslation';
import OrbitGlobe from '@/components/live/OrbitGlobe';
import FeaturedSatellites from '@/components/live/FeaturedSatellites';
import UpcomingLaunches from '@/components/live/UpcomingLaunches';
import NasaApod from '@/components/live/NasaApod';

/**
 * The Live page: where things actually are, right now.
 *
 * Two decisions here are worth knowing about.
 *
 * **It draws hundreds of satellites, not thousands.** It used to ask for the
 * `active` group with a limit of 15 000 plus all of Starlink, then run SGP4
 * over every one of them four times a second. That bought a wall of identical
 * red dots which hid the planet behind it, a tab that stopped responding to
 * scrolling, and a warm phone. None of it taught a child anything: 15 000
 * anonymous points is not more information than 200 named ones, it is less.
 *
 * The groups offered instead are ones a person can have a relationship with —
 * the crewed stations, the satellites bright enough to see from your own
 * garden, the weather satellites behind the forecast, the science missions.
 *
 * **There is deliberately no hard-coded element set to fall back on.** There
 * used to be: the ISS sample TLE from satellite.js's own documentation, epoch
 * 20 September 2008, which propagated to 13 006 km from the real station while
 * the panel printed altitude to a tenth of a kilometre and latitude to a
 * hundredth of a degree, refreshed four times a second, under a badge reading
 * "Fallback TLE mode" in English only. An orbit we cannot fetch is an orbit we
 * do not know, and the page says that instead.
 */
const SAT_GROUPS = [
  { group: 'stations', labelKey: 'groupStations', colour: '#5eead4', limit: 60 },
  { group: 'visual', labelKey: 'groupVisual', colour: '#fbbf24', limit: 300 },
  { group: 'weather', labelKey: 'groupWeather', colour: '#60a5fa', limit: 200 },
  { group: 'science', labelKey: 'groupScience', colour: '#c084fc', limit: 200 },
];

const DEFAULT_GROUPS = ['stations', 'visual'];
const LANG_TO_LOCALE = { ENG: 'en', RUS: 'ru', UZB: 'uz' };

/**
 * What an object actually is, from its catalogue name.
 *
 * CelesTrak's `visual` group is "the brightest objects", which is mostly spent
 * Soviet upper stages, and its `stations` group includes debris shed near the
 * ISS. Labelling a Fregat fragment "Space stations" because of the list it
 * arrived in is the same class of mistake as the rest of this page had: the
 * group says where we looked, not what we found.
 *
 * The suffixes are CelesTrak's own conventions: `R/B` for a rocket body, `DEB`
 * for debris.
 */
function objectKindKey(name, groupLabelKey) {
  if (/\bR\/B\b/.test(name)) return 'objectRocketBody';
  if (/\bDEB\b/.test(name)) return 'objectDebris';
  return groupLabelKey;
}

function parseGpGroup(records, cfg) {
  const satellites = [];
  const colour = new THREE.Color(cfg.colour);
  for (const omm of records) {
    if (satellites.length >= cfg.limit) break;
    try {
      const satrec = ommToSatrec(omm);
      if (satrec.error) continue;
      const name = String(omm.OBJECT_NAME || '').replace(/^0\s*/, '');
      satellites.push({
        id: String(omm.NORAD_CAT_ID),
        name,
        group: cfg.group,
        groupLabelKey: cfg.labelKey,
        kindLabelKey: objectKindKey(name, cfg.labelKey),
        epoch: omm.EPOCH || null,
        satrec,
        color: colour,
      });
    } catch {
      // One unparseable record must not cost the other few hundred.
      continue;
    }
  }
  return satellites;
}

/**
 * Element sets come from our own backend (`apps.space`), which fetches each
 * CelesTrak group at most once per refresh and serves it from cache. Thirty
 * browsers in one classroom asking CelesTrak directly is what its usage policy
 * firewalls an address for.
 */
async function loadSatellites(groupNames) {
  const wanted = SAT_GROUPS.filter((cfg) => groupNames.includes(cfg.group));
  const jobs = wanted.map(async (cfg) => {
    const response = await fetch(`/api/v1/space/gp/?group=${cfg.group}&limit=${cfg.limit}`);
    if (!response.ok) throw new Error(`failed ${cfg.group}`);
    const body = await response.json();
    return {
      satellites: parseGpGroup(body.satellites || [], cfg),
      fetchedAt: body.fetched_at || null,
    };
  });

  const settled = await Promise.allSettled(jobs);
  const byId = new Map();
  let fetchedAt = null;
  for (const item of settled) {
    if (item.status !== 'fulfilled') continue;
    if (item.value.fetchedAt) fetchedAt = item.value.fetchedAt;
    for (const sat of item.value.satellites) {
      if (!byId.has(sat.id)) byId.set(sat.id, sat);
    }
  }
  if (!byId.size) throw new Error('no elements');
  return { satellites: Array.from(byId.values()), fetchedAt };
}

/** Where the selected satellite is, and how fast, at this instant. */
function satMetrics(sat) {
  if (!sat?.satrec) return null;
  const now = new Date();
  const pv = propagate(sat.satrec, now);
  if (!pv.position || !pv.velocity) return null;
  const geo = eciToGeodetic(pv.position, gstime(now));
  const speed = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z) * 3600;
  return {
    alt: geo.height.toFixed(1),
    vel: speed.toFixed(0),
    inc: ((sat.satrec.inclo || 0) * (180 / Math.PI)).toFixed(2),
    lat: (geo.latitude * (180 / Math.PI)).toFixed(2),
    lon: (geo.longitude * (180 / Math.PI)).toFixed(2),
  };
}

/**
 * "2 hours ago", in the reader's language, from the browser's own tables.
 *
 * Measured from the element set's own epoch rather than from when we
 * downloaded it: re-downloading a stale element set does not make it fresh,
 * and pretending otherwise is what let a 2008 TLE be shown as a live position.
 */
function useRelativeTime(iso, locale) {
  return useMemo(() => {
    if (!iso) return null;
    const stamped = iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`;
    const seconds = (new Date(stamped).getTime() - Date.now()) / 1000;
    if (Number.isNaN(seconds)) return null;
    let format;
    try {
      format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    } catch {
      format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    }
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(Math.round(seconds), 'second');
  }, [iso, locale]);
}

function MetricRow({ icon: Icon, tint, label, value, unit }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/45">
        <Icon className={`h-3.5 w-3.5 ${tint}`} /> {label}
      </div>
      <div className="font-mono text-sm text-white">
        {value} {unit && <span className="text-[10px] text-white/35">{unit}</span>}
      </div>
    </div>
  );
}

export default function LiveSpaceView() {
  // This page used to award 20 XP on mount — not for watching anything, for
  // the page rendering, once per visit, unbounded. Ticket R2 asked whether to
  // give it a server endpoint; there was nothing to verify server-side, so the
  // award went instead.
  const { t, language } = useTranslation();
  const locale = LANG_TO_LOCALE[language] || 'uz';

  const [activeGroups, setActiveGroups] = useState(DEFAULT_GROUPS);
  const [satellites, setSatellites] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [feedState, setFeedState] = useState('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSatId, setSelectedSatId] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [streamOpen, setStreamOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFeedState('loading');
    loadSatellites(activeGroups)
      .then(({ satellites: rows, fetchedAt: when }) => {
        if (!mounted) return;
        setSatellites(rows);
        setFetchedAt(when);
        setFeedState('ok');
        setSelectedSatId((current) => {
          if (current && rows.some((sat) => sat.id === current)) return current;
          const iss = rows.find((sat) => sat.name.startsWith('ISS'));
          return iss?.id || rows[0]?.id || null;
        });
      })
      .catch((err) => {
        if (!mounted) return;
        // Rule C-10: handled, not swallowed. The badge tells the reader; this
        // is for whoever is looking at a console.
        console.warn('Could not load orbital elements', err);
        setSatellites([]);
        setSelectedSatId(null);
        setFeedState('failed');
      });
    return () => { mounted = false; };
  }, [activeGroups]);

  const selectedSat = useMemo(
    () => satellites.find((sat) => sat.id === selectedSatId) || null,
    [satellites, selectedSatId],
  );

  useEffect(() => {
    if (!selectedSat) {
      setMetrics(null);
      return undefined;
    }
    const refresh = () => setMetrics(satMetrics(selectedSat));
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [selectedSat]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = query
      ? satellites.filter((sat) => sat.name.toLowerCase().includes(query))
      : satellites;
    return rows.slice(0, 400);
  }, [satellites, searchQuery]);

  const measuredAgo = useRelativeTime(selectedSat?.epoch || fetchedAt, locale);

  const toggleGroup = (group) => {
    setActiveGroups((current) => {
      if (current.includes(group)) {
        // Never let the last one off — an empty globe with no explanation
        // looks exactly like a failure.
        return current.length === 1 ? current : current.filter((g) => g !== group);
      }
      return [...current, group];
    });
  };

  const feedBadge = {
    ok: { text: t('liveSpace', 'liveTle'), tone: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-300' },
    failed: { text: t('liveSpace', 'elementsUnavailable'), tone: 'border-amber-300/25 bg-amber-400/10 text-amber-200' },
    loading: { text: t('liveSpace', 'loadingElements'), tone: 'border-white/15 bg-white/5 text-white/60' },
  }[feedState];

  return (
    <div className="min-h-screen bg-[#07070c] pt-16 font-sans text-white selection:bg-cyan-400/30">
      {/* ── The globe ───────────────────────────────────────────────────── */}
      <section className="relative h-[58vh] min-h-[380px] w-full overflow-hidden sm:h-[64vh] lg:h-[calc(100vh-4rem)]">
        <Canvas
          camera={{ position: [0, 1.5, 7.2], fov: 42 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#07070c']} />
          <Stars radius={120} depth={60} count={4000} factor={2.2} saturation={0} fade speed={0.4} />
          <Suspense fallback={null}>
            <OrbitGlobe
              satellites={satellites}
              selectedSatId={selectedSatId}
              onSelect={setSelectedSatId}
            />
          </Suspense>
          <EffectComposer disableNormalPass>
            <Bloom luminanceThreshold={0.25} mipmapBlur intensity={0.9} />
          </EffectComposer>
          <OrbitControls
            enablePan={false} minDistance={3.2} maxDistance={13}
            autoRotate autoRotateSpeed={0.14} dampingFactor={0.05}
          />
        </Canvas>

        {/* `pointer-events-none` so the globe stays draggable behind the
            heading; the chips opt back in. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight drop-shadow-lg sm:text-4xl">
                {t('liveSpace', 'pageTitle')}
              </h1>
              <p className="mt-1 max-w-md text-xs text-white/55 drop-shadow sm:text-sm">
                {t('liveSpace', 'pageSubtitle')}
              </p>
            </div>
            <div className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur-md ${feedBadge.tone}`}>
              {feedBadge.text}
            </div>
          </div>

          <div className="pointer-events-auto mt-4 flex flex-wrap gap-2">
            {SAT_GROUPS.map((cfg) => {
              const on = activeGroups.includes(cfg.group);
              return (
                <button
                  key={cfg.group}
                  type="button"
                  onClick={() => toggleGroup(cfg.group)}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors ${
                    on
                      ? 'border-white/25 bg-white/10 text-white'
                      : 'border-white/10 bg-black/40 text-white/40 hover:text-white/70'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: on ? cfg.colour : 'transparent',
                      border: on ? 'none' : '1px solid rgba(255,255,255,0.3)',
                      boxShadow: on ? `0 0 8px ${cfg.colour}` : 'none',
                    }}
                  />
                  {t('liveSpace', cfg.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {feedState === 'ok' && satellites.length > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-md sm:left-6">
            {t('liveSpace', 'showing')} {satellites.length} {t('liveSpace', 'satellitesWord')}
            {measuredAgo && <> · {t('liveSpace', 'elementsMeasured')} {measuredAgo}</>}
          </div>
        )}
      </section>

      {/* ── Tracker: stacked on a phone, side by side from `lg` ──────────── */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {feedState === 'failed' ? (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="text-sm text-white/70">{t('liveSpace', 'elementsUnavailable')}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
              <div className="border-b border-white/10 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('liveSpace', 'searchSat')}
                    aria-label={t('liveSpace', 'searchSat')}
                    className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 font-mono text-sm text-white placeholder-white/30 transition-colors focus:border-cyan-400/60 focus:outline-none"
                  />
                </div>
              </div>
              <div className="max-h-[320px] space-y-1 overflow-y-auto p-2 lg:max-h-[420px]">
                {filtered.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-white/35">
                    {t('liveSpace', 'noneMatch')}
                  </p>
                ) : filtered.map((sat) => {
                  const on = sat.id === selectedSatId;
                  return (
                    <button
                      key={sat.id}
                      type="button"
                      onClick={() => setSelectedSatId(sat.id)}
                      aria-current={on}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        on
                          ? 'border-cyan-400/40 bg-cyan-400/10'
                          : 'border-transparent hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: on ? '#ffd166' : sat.color.getStyle(),
                          boxShadow: `0 0 10px ${on ? '#ffd166' : sat.color.getStyle()}`,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-mono text-xs font-bold ${on ? 'text-white' : 'text-white/70'}`}>
                          {sat.name}
                        </span>
                        <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-widest text-white/30">
                          {t('liveSpace', sat.kindLabelKey)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {selectedSat && metrics ? (
                <motion.aside
                  key={selectedSat.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative overflow-hidden rounded-2xl border border-cyan-400/25 bg-black/50 p-5 backdrop-blur-2xl"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                    <Crosshair className="h-3 w-3" /> {t('liveSpace', 'targetLocked')}
                  </div>
                  <h2 className="break-words text-xl font-black uppercase tracking-wide">
                    {selectedSat.name}
                  </h2>
                  <p className="mb-4 mt-0.5 text-[11px] text-white/40">
                    NORAD {selectedSat.id} · {t('liveSpace', selectedSat.kindLabelKey)}
                  </p>

                  <div className="space-y-2">
                    <MetricRow
                      icon={Activity} tint="text-violet-300"
                      label={t('liveSpace', 'altitude')} value={metrics.alt} unit="km"
                    />
                    <MetricRow
                      icon={Gauge} tint="text-orange-300"
                      label={t('liveSpace', 'velocity')} value={metrics.vel} unit="km/h"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/[0.06] bg-black/40 p-2.5">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/35">
                          {t('liveSpace', 'inclination')}
                        </div>
                        <div className="font-mono text-sm">{metrics.inc}°</div>
                      </div>
                      <div className="rounded-xl border border-white/[0.06] bg-black/40 p-2.5">
                        <div className="mb-1 text-[9px] font-bold uppercase tracking-widest text-white/35">
                          {t('liveSpace', 'latLon')}
                        </div>
                        <div className="font-mono text-sm">{metrics.lat} / {metrics.lon}</div>
                      </div>
                    </div>
                  </div>

                  {measuredAgo && (
                    <p className="mt-4 flex items-center gap-1.5 border-t border-white/[0.06] pt-3 text-[11px] text-white/35">
                      <Radar className="h-3 w-3" />
                      {t('liveSpace', 'elementsMeasured')} {measuredAgo}
                    </p>
                  )}
                </motion.aside>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/35">
                  {t('liveSpace', 'noneSelected')}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Everything below the tracker ────────────────────────────────── */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 pb-14 sm:px-6">
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">
            {t('liveSpace', 'featuredTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-white/45">
            {t('liveSpace', 'featuredSubtitle')}
          </p>
          <div className="mt-5">
            <FeaturedSatellites />
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-cyan-300">
            {t('liveSpace', 'upcomingMissions')}
          </h3>
          <UpcomingLaunches />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5 xl:col-span-2">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-cyan-300">
              {t('liveSpace', 'nasaLive')}
            </h3>
            {/*
              Click to load, and youtube-nocookie. The embed carried
              `autoplay=1`, so opening this page opened a connection to YouTube
              and set its cookies for every child who arrived, whether or not
              they wanted the video.
            */}
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black/50">
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
                  <span className="text-sm font-bold">{t('liveSpace', 'loadStream')}</span>
                  <span className="max-w-xs text-xs text-white/40">
                    {t('liveSpace', 'streamPrivacy')}
                  </span>
                </button>
              )}
            </div>
            <p className="mt-3 text-[11px] text-white/40">
              {t('liveSpace', 'streamNote')}{' '}
              <a
                href="https://www.nasa.gov/nasatv/"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 underline hover:text-cyan-200"
              >
                nasa.gov/nasatv
              </a>
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl sm:p-5">
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
