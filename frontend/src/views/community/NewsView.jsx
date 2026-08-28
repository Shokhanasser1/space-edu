import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Loader, Newspaper } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import OnThisDay from '@/components/news/OnThisDay';
import TelegramFeed from '@/components/news/TelegramFeed';
import NewsCard, { categoryLabel } from '@/components/news/NewsCard';

/**
 * The News page, rebuilt around the one thing that makes it worth opening
 * twice: what happened in space on today's date.
 *
 * Three things changed and each is a rule as much as a layout decision.
 *
 * **It no longer invents news.** When `/news/` failed — or simply had nothing
 * in it — this page rendered seven hard-coded "articles" from
 * `src/data/mockData.js`, drawn in exactly the same cards as real ones,
 * complete with stock photographs pulled from `picsum.photos` in the reader's
 * own browser. That is the Live page's bug, in a second place: invented
 * content presented as reporting, plus a third-party host called directly,
 * which is what commit `b8d1ac2` exists to stop. It says it has nothing now.
 *
 * **Nothing on it is hard-coded English any more.** The category chips printed
 * the database value ("exploration") in every language, "Read Full Story" was
 * a string in the JSX, and the Daily Fact panel held ten English sentences
 * that no Uzbek or Russian reader could read. "On this day" replaces that
 * panel with something that changes daily, is sourced, and exists in all three
 * languages.
 *
 * **The anniversaries and the Telegram channel both come from our own API.**
 * The browser makes no request to any third-party host — `apps.news` fetches
 * the channel server-side and hands over plain text.
 */
export default function NewsView() {
  const { t } = useTranslation();
  const [articles, setArticles] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/news/')
      .then(({ data }) => {
        if (!active) return;
        setArticles(Array.isArray(data) ? data : data.results || []);
      })
      .catch((error) => {
        if (!active) return;
        // Never swallowed, and never replaced with something that looks like
        // news — rules C-10 and "the page says what it does not know".
        console.warn('Could not load the news articles', error);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(articles.map((a) => a.category))).sort()],
    [articles],
  );
  const filtered = activeCategory === 'all'
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 pb-24 pt-28 sm:pt-32">
      <div
        aria-hidden
        className="pointer-events-none fixed left-[-10%] top-[-10%] z-0 h-[50%] w-[50%] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-[-10%] right-[-10%] z-0 h-[50%] w-[50%] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <p className="mb-3 text-[11px] font-[800] uppercase tracking-[0.3em] text-neon-blue">
            {t('news', 'dispatch')}
          </p>
          <h1 className="text-[clamp(34px,5vw,56px)] font-[900] leading-[1] tracking-tight text-white">
            {t('news', 'title')}{' '}
            <span className="text-glow-purple text-violet">{t('news', 'titleHighlight')}</span>
          </h1>
          <p className="mt-4 max-w-xl font-[500] text-white/40">{t('news', 'subtitle')}</p>
        </motion.header>

        <div className="mb-12">
          <OnThisDay />
        </div>

        {/* `items-start` matters: without it both columns stretch to the taller
            one, and the Telegram feed is much the taller of the two. */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
          <section aria-labelledby="news-feed-heading">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2
                id="news-feed-heading"
                className="mr-auto text-[11px] font-[800] uppercase tracking-[0.25em] text-white/40"
              >
                {t('news', 'feedTitle')}
              </h2>
            </div>

            {categories.length > 1 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    aria-pressed={activeCategory === category}
                    className={`rounded-full px-4 py-2 text-[10px] font-[800] uppercase tracking-widest transition-all ${
                      activeCategory === category
                        ? 'bg-violet text-white shadow-lg shadow-violet/20'
                        : 'border border-white/5 bg-white/[0.03] text-white/40 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {category === 'all' ? t('news', 'all') : categoryLabel(t, category)}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24">
                <Loader className="h-7 w-7 animate-spin text-violet-light" />
                <p className="text-[10px] font-[800] uppercase tracking-widest text-white/20">
                  {t('news', 'loadingDispatches')}
                </p>
              </div>
            ) : failed ? (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
                <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-[13px] leading-relaxed text-white/55">{t('news', 'feedFailed')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/[0.08] py-20 text-center">
                <Newspaper className="mx-auto mb-4 h-8 w-8 text-white/10" />
                <p className="font-[700] text-white/40">
                  {articles.length === 0 ? t('news', 'noArticlesYet') : t('news', 'noArticles')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {filtered.map((article, i) => (
                  <NewsCard key={article.id} article={article} index={i} />
                ))}
              </div>
            )}
          </section>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <TelegramFeed />
          </aside>
        </div>
      </div>
    </div>
  );
}
