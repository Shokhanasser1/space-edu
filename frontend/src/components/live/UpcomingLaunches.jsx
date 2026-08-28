import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Rocket, Clock, MapPin, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * The next launches, or an honest word about why we cannot show them.
 *
 * This component used to answer a failed request with five invented launches —
 * "Falcon 9 — Starlink Group 12-5" from Cape Canaveral, cleared to fly, two
 * days out — drawn in exactly the same rows as the real ones. The countdown
 * came from `Date.now() + 2 days`, so it read "2d" however long you looked at
 * it, and it called the third-party API from the browser, where the per-address
 * rate limit made the invented rows the usual case for a class sharing one
 * connection rather than the rare one.
 *
 * It also put every name through `translate.googleapis.com` on render, which
 * sent our readers' text to an undocumented third-party endpoint and produced
 * things like a machine-translated "Falcon 9" — a proper noun with no
 * translation. Mission and provider names are left alone now; only the words
 * we wrote ourselves are translated.
 *
 * Launches come from `GET /space/launches/`, which our server fetches hourly
 * and caches. It answers 503 when the upstream is unreachable, and that is
 * shown as a failure, not as a manifest.
 */
const MS_PER_DAY = 86400000;

// Launch Library's own status abbreviations. Anything not in this map is shown
// as the API's English `status.name` rather than guessed at.
const STATUS_KEYS = {
  Go: 'statusGo',
  TBC: 'statusTbc',
  TBD: 'statusTbd',
  Success: 'statusSuccess',
};

const STATUS_COLOURS = {
  Go: '#4ade80',
  Success: '#4ade80',
  TBC: '#fbbf24',
};

export default function UpcomingLaunches() {
  const [launches, setLaunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  // The countdown has to move, or "3h 2m" is only true for the instant the
  // page opened. A minute is fine — nothing here is measured in seconds.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/space/launches/')
      .then(({ data }) => {
        if (!active) return;
        // `{ fetched_at, stale, data }`, where `data` is Launch Library's own
        // paginated body.
        const results = data?.data?.results;
        setLaunches(Array.isArray(results) ? results : []);
      })
      .catch((err) => {
        if (!active) return;
        // Rule C-10: handled, not swallowed. The panel reports it to the
        // reader; this is for whoever is looking at a console.
        console.warn('Could not load upcoming launches', err);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const formatCountdown = (dateStr) => {
    const diff = new Date(dateStr).getTime() - now;
    if (Number.isNaN(diff)) return '';
    if (diff < 0) return t('live', 'launched');
    const d = Math.floor(diff / MS_PER_DAY);
    const h = Math.floor((diff % MS_PER_DAY) / 3600000);
    if (d > 0) return `${d}${t('live', 'days_short')} ${h}${t('live', 'hours_short')}`;
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}${t('live', 'hours_short')} ${m}${t('live', 'minutes_short')}`;
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-white/40">
        {t('live', 'loadingLaunches')}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="text-sm text-white/70">{t('live', 'launchesUnavailable')}</div>
      </div>
    );
  }

  if (!launches.length) {
    return (
      <div className="py-10 text-center text-sm text-white/40">
        {t('live', 'noUpcomingLaunches')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {launches.map((launch, i) => {
        const abbrev = launch.status?.abbrev;
        const colour = STATUS_COLOURS[abbrev] || '#94a3b8';
        const statusKey = STATUS_KEYS[abbrev];
        const statusLabel = statusKey ? t('live', statusKey) : launch.status?.name || '';

        return (
          <motion.div
            key={launch.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.35 }}
            className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-4 transition-colors hover:border-violet-400/25 hover:bg-white/[0.06]"
          >
            <div className="min-w-[68px] rounded-xl border border-violet-400/20 bg-violet-500/10 px-2.5 py-2 text-center">
              <Clock className="mx-auto mb-1 h-3.5 w-3.5 text-violet-300" />
              <div className="text-xs font-extrabold tracking-tight text-violet-200">
                {formatCountdown(launch.net)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{launch.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/40">
                {launch.lsp_name && (
                  <span className="flex items-center gap-1">
                    <Rocket className="h-3 w-3 shrink-0" /> {launch.lsp_name}
                  </span>
                )}
                {launch.location && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{launch.location}</span>
                  </span>
                )}
              </div>
            </div>

            {statusLabel && (
              <div
                className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  color: colour,
                  background: `${colour}18`,
                  border: `1px solid ${colour}30`,
                }}
              >
                {statusLabel}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
