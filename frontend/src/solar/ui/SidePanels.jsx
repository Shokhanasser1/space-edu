import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BODIES, MOONS } from '../catalog';
import { useSolarStore } from '../clock';
import { upcomingEvents } from '../events';
import { formatDateTime } from './format';

/** Pick a body from a list — the answer to "the planets are four pixels wide". */
export function BodyList({ t, names, selectedId, onSelect }) {
  const groups = useMemo(
    () => [
      { key: 'star', items: BODIES.filter((b) => b.kind === 'star') },
      { key: 'planets', items: BODIES.filter((b) => b.kind === 'planet') },
      { key: 'dwarfs', items: BODIES.filter((b) => b.kind === 'dwarf') },
    ],
    [],
  );
  const selected = selectedId && (BODIES.find((b) => b.id === selectedId) || MOONS.find((m) => m.id === selectedId));
  const parentId = selected?.parent || selected?.id;
  const moons = parentId ? MOONS.filter((m) => m.parent === parentId) : [];

  return (
    <nav aria-label={t('bodies')} className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      {groups.map((g) => (
        <div key={g.key} className="mb-2 last:mb-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{t(g.key)}</div>
          <div className="flex flex-wrap gap-1">
            {g.items.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelect(b.id)}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors ${
                  selectedId === b.id ? 'bg-white/20 text-white' : 'bg-white/5 text-white/75 hover:bg-white/12'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
                {names[b.id]}
              </button>
            ))}
          </div>
        </div>
      ))}
      {moons.length > 0 && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/45">
            {t('moons')} · {names[parentId]}
          </div>
          <div className="flex flex-wrap gap-1">
            {moons.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                  selectedId === m.id ? 'bg-white/20 text-white' : 'bg-white/5 text-white/70 hover:bg-white/12'
                }`}
              >
                {names[m.id]}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

const LAYERS = ['orbits', 'labels', 'asteroids', 'stars', 'satellites', 'spacecraft'];

export function LayersPanel({ t }) {
  const { layers, scaleMode, satStatus, craftStatus } = useSolarStore(
    useShallow((s) => ({ layers: s.layers, scaleMode: s.scaleMode, satStatus: s.satStatus, craftStatus: s.craftStatus })),
  );
  const { setLayer, setScaleMode } = useSolarStore.getState();

  const satText = {
    loading: t('satStatus.loading'),
    ready: t('satStatus.ready').replace('{n}', String(satStatus.count)),
    error: t('satStatus.error'),
    outOfRange: t('satStatus.outOfRange'),
  }[satStatus.state];
  const craftText = { loading: t('craftStatus.loading'), error: t('craftStatus.error') }[craftStatus];

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('layers.title')}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-1">
        {LAYERS.map((name) => (
          <label key={name} className="flex cursor-pointer items-center gap-2 text-[12px] text-white/80">
            <input type="checkbox" checked={layers[name]} onChange={(e) => setLayer(name, e.target.checked)} className="accent-[#8b5cf6]" />
            {t(`layers.${name}`)}
          </label>
        ))}
        <label className="flex cursor-pointer items-center gap-2 text-[12px] text-white/80">
          <input type="checkbox" checked={scaleMode === 'true'} onChange={(e) => setScaleMode(e.target.checked ? 'true' : 'visual')} className="accent-[#00e5ff]" />
          {t('layers.trueScale')}
        </label>
      </div>
      {scaleMode === 'true' && <p className="mt-2 text-[11px] leading-snug text-neon-blue/90">{t('layers.scaleNote')}</p>}
      {layers.satellites && satText && <p className={`mt-2 text-[11px] ${satStatus.state === 'ready' ? 'text-white/60' : 'text-amber-300'}`}>{satText}</p>}
      {layers.spacecraft && craftText && <p className="mt-1 text-[11px] text-amber-300">{craftText}</p>}
    </div>
  );
}

export function EventsPanel({ t, names, onJump }) {
  const epochMs = useSolarStore((s) => s.epochMs);
  // Recompute when the clock moves by more than a day; searches cost a few ms.
  const day = Math.floor(epochMs / 86_400_000);
  const events = useMemo(() => upcomingEvents(day * 86_400_000), [day]);

  const label = (e) => {
    if (e.key === 'opposition') return `${names[e.body]}: ${t('events.opposition')}`;
    const kind = e.kind ? ` (${t(`events.kinds.${e.kind}`) || e.kind})` : '';
    return `${t(`events.${e.key}`)}${kind}`;
  };

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/45">{t('events.title')}</div>
      <ul className="space-y-1">
        {events.slice(0, 6).map((e) => (
          <li key={`${e.key}-${e.body || ''}-${e.ms}`}>
            <button
              type="button"
              onClick={() => onJump(e)}
              className="flex w-full items-baseline justify-between gap-2 rounded-md px-1.5 py-0.5 text-left text-[12px] text-white/80 transition-colors hover:bg-white/10"
              title={t('events.jump')}
            >
              <span className="truncate">{label(e)}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-neon-blue">{formatDateTime(e.ms).date}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
