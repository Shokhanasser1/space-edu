import { useState, useEffect } from 'react';
import { Camera, Calendar, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * NASA's Astronomy Picture of the Day, as our server last saw it.
 *
 * Two things were wrong with the version this replaces.
 *
 * It authenticated to `api.nasa.gov` from the browser with `DEMO_KEY`, which
 * NASA rate-limits to 30 requests an hour per address. A class opens the page
 * together from one address, so the limit was reached in the first minute of
 * the lesson and nearly every child got the failure path.
 *
 * And the failure path invented a picture: a fixed 2023 photograph of the
 * Carina Nebula, captioned `new Date()` — so a three-year-old image was
 * presented, under the words "Picture of the Day", as today's. That is the
 * kind of wrong that a reader cannot detect, on a page whose whole promise is
 * that what it shows is current.
 *
 * The picture now comes from `GET /space/apod/`, which our server fetches
 * once every twelve hours with our own key and caches. It answers 503 when
 * NASA is unreachable, and this shows that as "no picture yet" — never as a
 * different picture.
 */
export default function NasaApod() {
  const [apod, setApod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let active = true;
    api.get('/space/apod/')
      .then(({ data }) => {
        // `{ fetched_at, stale, data }` — the payload is NASA's own record.
        if (active) setApod(data?.data || null);
      })
      .catch((err) => {
        if (!active) return;
        console.warn('Could not load the picture of the day', err);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-white/40">
        {t('live', 'loadingApod')}
      </div>
    );
  }

  if (failed || !apod?.url) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="text-sm text-white/70">{t('live', 'apodUnavailable')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video overflow-hidden rounded-2xl">
        <img
          src={apod.url}
          alt={apod.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-5 pb-4 pt-6">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-300">
            <Camera className="h-3 w-3" /> {t('live', 'nasaApod')}
          </div>
          <h4 className="text-lg font-extrabold text-white">{apod.title}</h4>
        </div>
      </div>

      {apod.explanation && (
        <p className="line-clamp-3 text-[13px] leading-relaxed text-white/45">
          {apod.explanation}
        </p>
      )}

      {/* NASA's own date for the image, never ours. */}
      <div className="flex items-center gap-2 text-xs text-white/30">
        <Calendar className="h-3 w-3" /> {apod.date}
      </div>
    </div>
  );
}
