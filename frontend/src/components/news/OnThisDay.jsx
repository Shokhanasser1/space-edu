import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, Award, Cake, Calendar, ChevronLeft, ChevronRight,
  ExternalLink, Flag, HeartCrack, Loader, MapPin, Rocket, Sparkles, Telescope,
} from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormat } from '@/hooks/useFormat';
import { pluralForm } from '@/lib/format';

/**
 * "On this day" — the reason to open the News page on a Tuesday.
 *
 * Everything shown here is a factual claim made to a child, so three rules
 * hold the component together and none of them are decoration:
 *
 * 1. **Every entry shows where it came from.** The source is a link on the
 *    card, not a line in a README. A claim a reader cannot check is a claim
 *    they have to take on trust, and this platform exists partly because too
 *    much of it was taken on trust.
 * 2. **A day nobody has written says so.** The server returns an empty list
 *    and this prints a sentence to that effect in the reader's language. It
 *    never shows yesterday's anniversary under today's heading — under the
 *    word "today", that is not a near miss, it is a false statement.
 * 3. **How much of the year is written is on the screen.** The server sends
 *    its own coverage with every response and it is printed under the day, so
 *    a blank day reads as "not written yet" rather than "nothing happened".
 *
 * The date the page opens on is the server's `timezone.localdate()` — Tashkent
 * time — and not the browser's. A school laptop with a wrong clock, or a
 * reader abroad, gets the same day as the classroom.
 */
const KIND_STYLES = {
  birth:     { icon: Cake,      accent: '#f0abfc' },
  death:     { icon: HeartCrack, accent: '#94a3b8' },
  launch:    { icon: Rocket,    accent: '#fbbf24' },
  landing:   { icon: Flag,      accent: '#5eead4' },
  flight:    { icon: Rocket,    accent: '#fb923c' },
  first:     { icon: Award,     accent: '#a78bfa' },
  loss:      { icon: AlertTriangle, accent: '#f87171' },
  discovery: { icon: Telescope, accent: '#60a5fa' },
  milestone: { icon: Sparkles,  accent: '#c4b5fd' },
};

const FALLBACK_STYLE = KIND_STYLES.milestone;

function useLangSuffix() {
  const { language } = useTranslation();
  return language === 'UZB' ? 'uz' : language === 'RUS' ? 'ru' : 'en';
}

/** "69 years ago", with the plural form Russian actually needs. */
function YearsAgo({ years }) {
  const { t, language } = useTranslation();
  const format = useFormat();
  if (!Number.isFinite(years) || years <= 0) return null;
  const word = t('news', `onThisDay.yearsAgo.${pluralForm(years, language)}`);
  return (
    <span className="text-white/35">
      {format.number(years)} {word}
    </span>
  );
}

function EntryCard({ entry, index }) {
  const { t } = useTranslation();
  const suffix = useLangSuffix();
  const style = KIND_STYLES[entry.kind] || FALLBACK_STYLE;
  const Icon = style.icon;
  const local = entry.region === 'uz' || entry.region === 'central_asia';

  return (
    <motion.li
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.45 }}
      className="relative pl-10 sm:pl-14"
    >
      {/* The rail and its node. Hidden from assistive tech: it is the shape of
          a timeline, not information anybody needs read aloud. */}
      <span aria-hidden className="absolute left-[15px] sm:left-[23px] top-9 bottom-[-28px] w-px bg-white/[0.07]" />
      <span
        aria-hidden
        className="absolute left-0 sm:left-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl"
        style={{ background: `${style.accent}1a`, border: `1px solid ${style.accent}40` }}
      >
        <Icon className="h-4 w-4" style={{ color: style.accent }} />
      </span>

      <div className="pb-8">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-[700] uppercase tracking-wider">
          <span className="text-white tabular-nums" style={{ color: style.accent }}>
            {entry.year}
          </span>
          <span className="text-white/25">{t('news', `onThisDay.kinds.${entry.kind}`)}</span>
          <YearsAgo years={entry.years_ago} />
          {local && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-[2px] text-[9px] text-emerald-300">
              <MapPin className="h-2.5 w-2.5" />
              {t('news', `onThisDay.regions.${entry.region}`)}
            </span>
          )}
        </div>

        <h3 className="text-[17px] font-[800] leading-snug text-white sm:text-lg">
          {entry[`title_${suffix}`]}
        </h3>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/50">
          {entry[`text_${suffix}`]}
        </p>

        <a
          href={entry.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-[700] uppercase tracking-wider text-white/30 transition-colors hover:text-violet-light"
        >
          {t('news', 'onThisDay.source')}: {entry.source}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.li>
  );
}

function DayButton({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:border-white/25 hover:text-white"
    >
      {children}
    </button>
  );
}

export default function OnThisDay() {
  const { t, language } = useTranslation();
  const format = useFormat();
  const [day, setDay] = useState(null);      // null = whatever the server calls today
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api.get('/news/on-this-day/', { params: day ?? {} })
      .then(({ data: body }) => {
        if (active) setData(body);
      })
      .catch((error) => {
        if (!active) return;
        // Never swallowed — rule C-10. One 502 used to log people out.
        console.warn('Could not load the anniversaries for this day', error);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [day]);

  const goTo = useCallback((ref) => {
    if (ref) setDay({ month: ref.month, day: ref.day });
  }, []);

  const heading = data?.date
    // A real date object so the month is written the way the language writes
    // it — "28 avgust", "28 августа", "28 August" — instead of a number the
    // reader has to decode. `T12:00` keeps the day from sliding either way
    // when the browser's zone is behind or ahead of the server's.
    ? format.date(new Date(`${data.date}T12:00:00`), { day: 'numeric', month: 'long' })
    : data
      ? `${data.day}.${String(data.month).padStart(2, '0')}`
      : '';

  return (
    <section
      aria-labelledby="on-this-day-heading"
      className="relative overflow-hidden rounded-[1.75rem] border border-white/10 p-6 sm:p-9"
      style={{
        background:
          'radial-gradient(120% 130% at 12% 0%, rgba(139,92,246,0.16) 0%, rgba(255,255,255,0.02) 45%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-[800] uppercase tracking-[0.28em] text-violet-light">
            <Calendar className="h-3.5 w-3.5" />
            {t('news', 'onThisDay.eyebrow')}
          </p>
          <h2 id="on-this-day-heading" className="text-[clamp(28px,4.5vw,44px)] font-[900] leading-[1.05] tracking-tight text-white">
            {heading}
          </h2>
          <p className="mt-2 max-w-md text-[14px] font-[500] text-white/40">
            {data && !data.is_today
              ? t('news', 'onThisDay.notToday')
              : t('news', 'onThisDay.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <DayButton onClick={() => goTo(data?.previous)} label={t('news', 'onThisDay.previous')}>
            <ChevronLeft className="h-4 w-4" />
          </DayButton>
          {data && !data.is_today && (
            <button
              type="button"
              onClick={() => setDay(null)}
              className="rounded-xl border border-violet/40 bg-violet/15 px-4 py-2 text-[10px] font-[800] uppercase tracking-widest text-violet-light transition-colors hover:bg-violet/25"
            >
              {t('news', 'onThisDay.today')}
            </button>
          )}
          <DayButton onClick={() => goTo(data?.next)} label={t('news', 'onThisDay.next')}>
            <ChevronRight className="h-4 w-4" />
          </DayButton>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-12 text-white/25">
          <Loader className="h-5 w-5 animate-spin" />
          <span className="text-[11px] font-[800] uppercase tracking-widest">
            {t('news', 'onThisDay.loading')}
          </span>
        </div>
      ) : failed ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
          <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-[13px] leading-relaxed text-white/55">
            {t('news', 'onThisDay.failed')}
          </p>
        </div>
      ) : data?.entries?.length ? (
        <AnimatePresence mode="wait">
          <motion.ul
            key={`${data.month}-${data.day}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            {data.entries.map((entry, i) => (
              <EntryCard key={entry.id} entry={entry} index={i} />
            ))}
          </motion.ul>
        </AnimatePresence>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 sm:p-8">
          <p className="text-[15px] font-[700] text-white/70">
            {t('news', 'onThisDay.emptyTitle')}
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/40">
            {t('news', 'onThisDay.emptyBody')}
          </p>
          {data?.next && (
            <button
              type="button"
              onClick={() => goTo(data.next)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-[700] text-white/60 transition-colors hover:text-white"
            >
              {t('news', 'onThisDay.jumpToNext')}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {data?.coverage && (
        <p className="mt-6 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/25">
          {format.number(data.coverage.days_covered)} / {format.number(data.coverage.days_in_year)}{' '}
          {t('news', 'onThisDay.coverage')}
        </p>
      )}
      {/* `language` is read so the heading re-renders when the switcher moves;
          `format` already depends on it, and this keeps that obvious. */}
      <span hidden data-language={language} />
    </section>
  );
}
