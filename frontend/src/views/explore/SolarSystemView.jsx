import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useProgress } from '@react-three/drei';
import { Globe2, Home, Layers, List } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { BODIES, MOONS, SPACECRAFT } from '@/solar/catalog';
import { useSolarStore } from '@/solar/clock';
import LabelLayer from '@/solar/scene/LabelLayer';
import SolarScene from '@/solar/scene/SolarScene';
import InfoPanel, { SatellitePanel } from '@/solar/ui/InfoPanel';
import QuizPanel from '@/solar/ui/QuizPanel';
import { BodyList, EventsPanel, LayersPanel } from '@/solar/ui/SidePanels';
import TimeBar from '@/solar/ui/TimeBar';

/**
 * The Solar System, live.
 *
 * Everything that moves lives in `@/solar` and never touches React state per
 * frame; this file is the chrome around it: the clock bar, the body list, the
 * layer toggles, the facts panel, and the keyboard (Esc closes the panel,
 * then flies home).
 */

const UNIT_KEYS = ['km', 'au', 'mkm', 'min', 'h', 'd', 'years', 'days'];

/** three r163+ needs WebGL 2; a school PC on a 2015 driver may not have it. */
function hasWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

export default function SolarSystemView() {
  const { t: translate } = useTranslation();
  const t = useCallback((key) => translate('explore', `solar.${key}`), [translate]);
  const selectedId = useSolarStore((s) => s.selectedId);
  const layers = useSolarStore((s) => s.layers);
  const { setSelected, requestHome } = useSolarStore.getState();
  const [selectedSat, setSelectedSat] = useState(null);
  const [drawer, setDrawer] = useState(null); // 'bodies' | 'layers' | null (mobile)
  const { active, progress } = useProgress();
  const [webgl] = useState(() => (typeof document === 'undefined' ? true : hasWebGL2()));

  const names = useMemo(() => {
    const out = {};
    for (const b of [...BODIES, ...MOONS]) out[b.id] = translate('explore', `bodies.${b.id}`);
    for (const c of SPACECRAFT) out[c.id] = c.name;
    out.iss = translate('explore', 'bodies.iss');
    return out;
  }, [translate]);
  const labelEntries = useMemo(() => {
    const list = BODIES.map((b) => ({ id: b.id, kind: b.kind, color: b.color }));
    for (const m of MOONS) list.push({ id: m.id, kind: 'moon', parent: m.parent, color: m.color });
    if (layers.satellites) list.push({ id: 'iss', kind: 'satellite', parent: 'earth', color: '#ffd166' });
    if (layers.spacecraft) for (const c of SPACECRAFT) list.push({ id: c.id, kind: 'spacecraft', color: c.color });
    return list;
  }, [layers.satellites, layers.spacecraft]);
  const units = useMemo(() => Object.fromEntries(UNIT_KEYS.map((k) => [k, t(`units.${k}`)])), [t]);

  const select = useCallback((id) => {
    setSelectedSat(null);
    setSelected(id);
    setDrawer(null);
  }, [setSelected]);

  const selectSatellite = useCallback((sat) => {
    setSelected(null);
    setSelectedSat(sat);
  }, [setSelected]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (selectedSat) setSelectedSat(null);
      else if (selectedId) setSelected(null);
      else requestHome();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedSat, setSelected, requestHome]);

  const jumpToEvent = useCallback((event) => {
    const { setDate, setPlaying, setSpeed } = useSolarStore.getState();
    setDate(event.ms);
    setSpeed('hour');
    setPlaying(true);
    if (event.body) select(event.body);
  }, [select]);

  const loading = active && progress < 100;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#02030a] font-sans">
      <div className="absolute inset-0 z-0">
        {webgl ? (
          <SolarScene onSelect={select} onSelectSatellite={selectSatellite} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">{t('noWebGL')}</div>
        )}
        <LabelLayer entries={labelEntries} names={names} selectedId={selectedId} onSelect={select} visible={layers.labels} />
      </div>

      {/* Title */}
      <div className="pointer-events-none absolute left-4 top-20 z-10 max-w-md md:left-6">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-white drop-shadow-md md:text-3xl">
          <Globe2 className="h-6 w-6 text-neon-purple" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="mt-1 hidden max-w-sm text-[11px] leading-snug text-white/55 lg:block">{t('subtitle')}</p>
      </div>

      {/* Overview + Esc */}
      <div className="absolute right-4 top-20 z-10 flex items-center gap-2 md:right-6">
        <button
          type="button"
          onClick={() => { setSelectedSat(null); requestHome(); }}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-white/85 backdrop-blur-md transition-colors hover:bg-white/15"
          title={t('escHint')}
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          {t('overview')}
        </button>
        <button type="button" onClick={() => setDrawer(drawer === 'bodies' ? null : 'bodies')} className="pointer-events-auto rounded-full border border-white/10 bg-black/50 p-2 text-white/85 backdrop-blur-md md:hidden" aria-label={t('bodies')}>
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setDrawer(drawer === 'layers' ? null : 'layers')} className="pointer-events-auto rounded-full border border-white/10 bg-black/50 p-2 text-white/85 backdrop-blur-md md:hidden" aria-label={t('layers.title')}>
          <Layers className="h-4 w-4" />
        </button>
      </div>

      {/* Left column (desktop) */}
      <div className="pointer-events-none absolute bottom-28 left-4 top-44 z-10 hidden w-64 flex-col gap-2 overflow-y-auto md:flex md:left-6 [scrollbar-width:none]">
        <BodyList t={t} names={names} selectedId={selectedId} onSelect={select} />
        <LayersPanel t={t} />
        <EventsPanel t={t} names={names} onJump={jumpToEvent} />
        <QuizPanel t={t} names={names} onSelectBody={select} />
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="absolute inset-x-2 top-32 z-20 max-h-[50vh] overflow-y-auto md:hidden">
          {drawer === 'bodies' ? (
            <div className="space-y-2">
              <BodyList t={t} names={names} selectedId={selectedId} onSelect={select} />
              <EventsPanel t={t} names={names} onJump={jumpToEvent} />
              <QuizPanel t={t} names={names} onSelectBody={select} />
            </div>
          ) : (
            <LayersPanel t={t} />
          )}
        </div>
      )}

      {/* Facts */}
      <div className="pointer-events-none absolute inset-x-2 bottom-28 z-20 md:inset-x-auto md:right-6 md:top-32 md:w-80">
        <AnimatePresence mode="wait">
          {selectedSat && (
            <SatellitePanel key={`sat-${selectedSat.id}`} sat={selectedSat} t={t} units={units} onClose={() => setSelectedSat(null)} />
          )}
          {!selectedSat && selectedId && (
            <InfoPanel key={selectedId} id={selectedId} t={t} names={names} units={units} onClose={() => setSelected(null)} onSelect={select} />
          )}
        </AnimatePresence>
      </div>

      {/* Clock */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-2">
        <TimeBar t={t} />
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center bg-black/40 pb-40">
          <div className="w-64">
            <div className="mb-1 text-center text-[11px] uppercase tracking-widest text-white/60">{t('loading')}</div>
            <div className="h-1 w-full overflow-hidden rounded bg-white/10">
              <div className="h-full bg-neon-blue transition-[width]" style={{ width: `${Math.round(progress)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
