import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, ExternalLink, Image, Loader, Send } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { useFormat } from '@/hooks/useFormat';

/**
 * The Uzcosmos channel, as our own server read it.
 *
 * **This component never talks to Telegram.** It asks `/news/telegram/`, and
 * the backend does the fetching, the caching and the parsing — the rule commit
 * `b8d1ac2` established and the Live page was swept for this week. Two things
 * follow from it that are visible here:
 *
 * * **The text is plain text.** The server strips the markup, so nothing the
 *   channel publishes can put HTML in front of a child, and React renders it
 *   as a string. `whitespace-pre-line` is what keeps the paragraphs.
 * * **There are no pictures.** A post's photographs live on `cdn4.telesco.pe`,
 *   and putting them in an `<img>` would be every reader's browser calling a
 *   third-party host. `has_media` says a post has one and the post's own link
 *   is how you look at it.
 *
 * Nothing is translated. The channel already writes each post in Uzbek and
 * Russian, one under the other, and machine translation of what a child reads
 * is exactly what was removed from the Live page in `caa16d0`.
 */
function Post({ post, index }) {
  const { t } = useTranslation();
  const format = useFormat();

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 5) * 0.05, duration: 0.4 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors hover:border-white/15"
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] font-[700] uppercase tracking-wider text-white/30">
        <Send className="h-3 w-3 text-sky-400/70" />
        {post.published_at && <time dateTime={post.published_at}>{format.dateTime(post.published_at)}</time>}
        {post.has_media && (
          <span className="ml-auto inline-flex items-center gap-1 text-white/25" title={t('news', 'telegram.hasMedia')}>
            <Image className="h-3 w-3" aria-hidden />
            <span className="sr-only">{t('news', 'telegram.hasMedia')}</span>
          </span>
        )}
      </div>

      {/* Clamped to six lines. The channel writes each post twice, in Uzbek and
          then in Russian, so a single post runs to about 1 500 characters —
          nine of them made this column 12 000 pixels tall, which stretched the
          news grid beside it into an empty black field several screens deep.
          The clamp is visual only: the whole text is in the DOM, and the link
          below opens the post itself. */}
      <p className="line-clamp-6 whitespace-pre-line text-[13.5px] leading-relaxed text-white/60">
        {post.text}
        {post.truncated && <span className="text-white/25">…</span>}
      </p>

      <a
        href={post.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-[800] uppercase tracking-wider text-white/30 transition-colors hover:text-sky-300"
      >
        {t('news', 'telegram.openPost')}
        <ExternalLink className="h-3 w-3" />
      </a>
    </motion.li>
  );
}

export default function TelegramFeed() {
  const { t } = useTranslation();
  const format = useFormat();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [channelUrl, setChannelUrl] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/news/telegram/')
      .then(({ data }) => {
        if (!active) return;
        setFeed(data);
        setChannelUrl(data.channel_url || '');
      })
      .catch((error) => {
        if (!active) return;
        console.warn('Could not read the Telegram channel', error);
        // A 503 still carries the channel link, which is the one useful thing
        // we can offer when we cannot read it ourselves.
        setChannelUrl(error?.response?.data?.channel_url || '');
        setFeed(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <section aria-labelledby="telegram-heading" className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6">
      <div className="mb-5">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-[800] uppercase tracking-[0.25em] text-sky-400">
          <Send className="h-3.5 w-3.5" />
          {t('news', 'telegram.eyebrow')}
        </p>
        <h2 id="telegram-heading" className="text-xl font-[800] leading-tight text-white">
          {t('news', 'telegram.title')}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/40">
          {t('news', 'telegram.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-8 text-white/25">
          <Loader className="h-4 w-4 animate-spin" />
          <span className="text-[10px] font-[800] uppercase tracking-widest">
            {t('news', 'telegram.loading')}
          </span>
        </div>
      ) : feed?.posts?.length ? (
        <>
          {feed.stale && (
            <p className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-white/35">
              {t('news', 'telegram.stale')}
              {feed.fetched_at && ` (${format.dateTime(feed.fetched_at)})`}
            </p>
          )}
          <ul className="flex flex-col gap-4">
            {feed.posts.map((post, i) => (
              <Post key={post.id} post={post} index={i} />
            ))}
          </ul>
        </>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
          <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-[13px] leading-relaxed text-white/55">
            {t('news', 'telegram.unavailable')}
          </p>
        </div>
      )}

      {channelUrl && (
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/[0.08] px-4 py-2.5 text-[11px] font-[800] uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-400/15"
        >
          {t('news', 'telegram.openChannel')}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  );
}
