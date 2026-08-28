import { motion } from 'motion/react';
import { Calendar, ExternalLink, Newspaper } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormat } from '@/hooks/useFormat';

/**
 * One published article.
 *
 * The category is a translated word now. It used to be `{article.category}` —
 * the database value — so a Russian or Uzbek reader got "exploration" in the
 * filter row and on every card, on a page that is otherwise fully translated.
 * An unknown category falls back to the raw value rather than to a blank chip:
 * a word in the wrong language is a nuisance, an empty chip is a bug nobody
 * can see the cause of.
 */
export const CATEGORY_COLORS = {
  discovery:   { text: 'text-yellow-400',   bg: 'bg-yellow-400/10',   border: 'border-yellow-400/30' },
  technology:  { text: 'text-neon-blue',    bg: 'bg-neon-blue/10',    border: 'border-neon-blue/30' },
  exploration: { text: 'text-green-400',    bg: 'bg-green-400/10',    border: 'border-green-400/30' },
  local:       { text: 'text-violet-light', bg: 'bg-violet/10',       border: 'border-violet/30' },
  science:     { text: 'text-pink-400',     bg: 'bg-pink-400/10',     border: 'border-pink-400/30' },
  mission:     { text: 'text-orange-400',   bg: 'bg-orange-400/10',   border: 'border-orange-400/30' },
  milestone:   { text: 'text-teal-300',     bg: 'bg-teal-300/10',     border: 'border-teal-300/30' },
};

const KNOWN_CATEGORIES = Object.keys(CATEGORY_COLORS);

export function categoryLabel(t, category) {
  return KNOWN_CATEGORIES.includes(category)
    ? t('news', `categories.${category}`)
    : category;
}

export default function NewsCard({ article, index }) {
  const { t, language } = useTranslation();
  const format = useFormat();
  const suffix = language === 'UZB' ? 'uz' : language === 'RUS' ? 'ru' : 'en';

  const colour = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.science;
  const title = article[`title_${suffix}`] || article.title_en;
  const summary = article[`summary_${suffix}`] || article.summary_en;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 6) * 0.05, duration: 0.45 }}
      className="group flex flex-col overflow-hidden rounded-[1.4rem] border border-white/[0.07] bg-white/[0.02] transition-all duration-500 hover:-translate-y-1 hover:border-white/15"
    >
      <div className="relative h-40 shrink-0 overflow-hidden bg-white/[0.03]">
        {article.image_url ? (
          <img
            src={article.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Newspaper className="h-10 w-10 text-white/[0.06]" />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span
          className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-[9px] font-[800] uppercase tracking-widest ${colour.text} ${colour.bg} ${colour.border}`}
        >
          {categoryLabel(t, article.category)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-[600] text-white/30">
          <Calendar className="h-3.5 w-3.5" />
          {format.date(article.published_at, { year: 'numeric', month: 'short', day: 'numeric' })}
          {article.source && <span className="ml-auto truncate text-white/20">{article.source}</span>}
        </div>

        <h3 className="mb-2 line-clamp-2 text-[17px] font-[800] leading-snug text-white transition-colors group-hover:text-violet-light">
          {title}
        </h3>
        <p className="line-clamp-3 flex-1 text-[13px] leading-relaxed text-white/40">{summary}</p>

        {article.source_url && (
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 border-t border-white/5 pt-4 text-[10px] font-[800] uppercase tracking-wider text-white/30 transition-colors hover:text-violet-light"
          >
            {t('news', 'readFull')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </motion.article>
  );
}
