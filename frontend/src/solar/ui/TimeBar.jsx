import { useShallow } from 'zustand/react/shallow';
import { Pause, Play, Rewind, FastForward, CalendarDays } from 'lucide-react';
import { MAX_MS, MIN_MS, SPEEDS, useSolarStore } from '../clock';
import { formatDateTime, toDateInputValue } from './format';

/**
 * The clock controls. Reads the store's 10 Hz mirror of the simulation time;
 * writes go straight to the clock singleton through the store's actions.
 */
export default function TimeBar({ t }) {
  const { epochMs, playing, speedKey, direction, atEdge } = useSolarStore(
    useShallow((s) => ({ epochMs: s.epochMs, playing: s.playing, speedKey: s.speedKey, direction: s.direction, atEdge: s.atEdge })),
  );
  const { togglePlaying, setSpeed, setDirection, setDate, goLive } = useSolarStore.getState();
  const { date, time } = formatDateTime(epochMs);
  const isLive = speedKey === 'live' && direction > 0 && Math.abs(epochMs - Date.now()) < 120_000;

  const onDate = (e) => {
    const v = e.target.value;
    if (!v) return;
    const ms = Date.parse(`${v}T12:00:00Z`);
    if (Number.isFinite(ms)) setDate(ms);
  };

  return (
    <div className="pointer-events-auto flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-white/10 bg-black/55 px-4 py-2.5 shadow-2xl backdrop-blur-md">
      <label className="flex items-center gap-2 font-mono text-sm tabular-nums text-white">
        <CalendarDays className="h-4 w-4 text-white/50" aria-hidden="true" />
        <input
          type="date"
          value={toDateInputValue(epochMs)}
          min={toDateInputValue(MIN_MS)}
          max={toDateInputValue(MAX_MS)}
          onChange={onDate}
          aria-label={t('date')}
          className="w-[8.6rem] rounded bg-transparent px-1 text-neon-blue outline-none [color-scheme:dark] focus:ring-1 focus:ring-white/40"
        />
        <span className="text-white/60">{time}</span>
        <span className="sr-only">{date}</span>
      </label>

      <div className="hidden h-6 w-px bg-white/10 sm:block" />

      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setDirection(-1)} aria-label={t('reverse')} className={`rounded-full p-1.5 transition-colors ${direction < 0 ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <Rewind className="h-4 w-4" />
        </button>
        <button type="button" onClick={togglePlaying} aria-label={playing ? t('pause') : t('play')} className="rounded-full border border-neon-purple/40 bg-neon-purple/20 p-2.5 text-white transition-colors hover:bg-neon-purple/40">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
        </button>
        <button type="button" onClick={() => setDirection(1)} aria-label={t('forward')} className={`rounded-full p-1.5 transition-colors ${direction > 0 ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10'}`}>
          <FastForward className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden h-6 w-px bg-white/10 sm:block" />

      <div className="flex flex-wrap items-center justify-center gap-1" role="group" aria-label={t('speedLabel')}>
        {SPEEDS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSpeed(s.key)}
            className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              speedKey === s.key ? 'bg-neon-blue/90 text-black' : 'bg-white/5 text-white/65 hover:bg-white/15'
            }`}
          >
            {t(`speed.${s.key}`)}
          </button>
        ))}
        <button
          type="button"
          onClick={goLive}
          className={`ml-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            isLive ? 'bg-neon-green/80 text-black' : 'bg-white/5 text-white/65 hover:bg-white/15'
          }`}
        >
          {t('today')}
        </button>
      </div>

      {atEdge && (
        <div className="basis-full text-center text-[11px] text-amber-300">{t('atEdge')}</div>
      )}
    </div>
  );
}
