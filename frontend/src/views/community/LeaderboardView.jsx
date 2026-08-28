import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Star, Crown, Shield, Target } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import GlassCard from '@/components/ui/GlassCard';
import { useFormat } from '@/hooks/useFormat';

const RANK_STYLES = {
  0: { bg: 'from-amber-500/20 to-amber-400/5',  text: 'text-amber-400',  glow: 'shadow-[0_0_30px_rgba(251,191,36,0.2)]',   icon: <Crown className="w-6 h-6 text-amber-400" /> },
  1: { bg: 'from-slate-400/15 to-slate-300/4',  text: 'text-slate-300',  glow: 'shadow-[0_0_20px_rgba(203,213,225,0.15)]', icon: <Trophy className="w-6 h-6 text-slate-300" /> },
  2: { bg: 'from-amber-700/15 to-amber-600/4',  text: 'text-amber-600',  glow: 'shadow-[0_0_20px_rgba(180,83,9,0.15)]',    icon: <Trophy className="w-6 h-6 text-amber-600" /> },
};

// Only until the first response arrives carrying the server's own number.
const DEFAULT_POLL_SECONDS = 30;

export default function LeaderboardView() {
  const fmt = useFormat();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pollSeconds, setPollSeconds] = useState(DEFAULT_POLL_SECONDS);
  // Two boards, one page. XP says how much a child has done; accuracy says how
  // well, which is the number a platform that exists to teach should be able to
  // show. The accuracy board only ranks children who have finished
  // `min_quizzes` — the server sends that number so this page can say it rather
  // than leave a child staring at a list they are not on. See
  // apps/gamification/leaderboard.py.
  const [mode, setMode] = useState('xp');
  const [quizBoard, setQuizBoard] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFailed, setQuizFailed] = useState(false);

  const load = useCallback(() => {
    return api.get('/gamification/leaderboard/')
      .then(({ data }) => {
        setBoard(data);
        setFailed(false);
        // How often it is worth asking is the server's decision — it is the
        // lifetime of the board it caches. Reading it here means the rate can
        // be turned down under load without shipping a new front end.
        if (Number.isFinite(data?.poll_after_seconds)) setPollSeconds(data.poll_after_seconds);
      })
      // Not an empty catch (C-10). A board that silently stays blank reads as
      // "nobody is playing", which is what this page said after one 502.
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadQuiz = useCallback(() => {
    setQuizLoading(true);
    return api.get('/gamification/leaderboard/quiz/')
      .then(({ data }) => { setQuizBoard(data); setQuizFailed(false); })
      // Not an empty catch (C-10): a board that silently stays blank reads as
      // "nobody has taken a quiz", which is a different claim from "we could
      // not ask".
      .catch(() => setQuizFailed(true))
      .finally(() => setQuizLoading(false));
  }, []);

  // Fetched when the tab is opened, not on mount: most readers never open it,
  // and it is an aggregate over every quiz session on the platform.
  useEffect(() => {
    if (mode === 'quiz' && quizBoard === null && !quizLoading && !quizFailed) loadQuiz();
  }, [mode, quizBoard, quizLoading, quizFailed, loadQuiz]);

  // A few seconds of this client's own, so ten thousand browsers do not all
  // arrive on the tick the cached board expires on.
  const jitterMs = useMemo(() => Math.floor(Math.random() * 4000), []);

  useEffect(() => {
    const tick = () => {
      // A page left open in a background tab is not being read. Browsers slow
      // these timers down by themselves; this stops them.
      if (document.visibilityState === 'hidden') return;
      // Nor is a board the reader has switched away from.
      if (mode !== 'xp') return;
      load();
    };
    const timer = setInterval(tick, pollSeconds * 1000 + jitterMs);
    return () => clearInterval(timer);
  }, [load, pollSeconds, jitterMs, mode]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  // Everything below is the server's answer. This view used to append a row
  // built out of the browser's own persisted XP whenever it could not find
  // itself in the list, sort it in, and print the array index beside it — so a
  // player ranked five thousandth appeared just under the last visible name,
  // carrying whatever number localStorage happened to hold. `my_rank` and
  // `my_xp` were in the response the whole time.
  const rows = Array.isArray(board?.leaderboard) ? board.leaderboard : [];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const quizRows = Array.isArray(quizBoard?.leaderboard) ? quizBoard.leaderboard : [];
  const minQuizzes = quizBoard?.min_quizzes ?? null;

  const myRank = board?.my_rank ?? null;
  const myXp = board?.my_xp ?? null;
  const totalPlayers = board?.total_players ?? 0;

  return (
    <div className="relative min-h-screen pt-32 pb-24 px-4 overflow-hidden">
      {/* Decorative ambient glows */}
      <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(0,229,255,0.03) 0%, transparent 70%)' }} />

      <div className="max-w-3xl mx-auto relative z-10">

        <div className="text-center mb-16">
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-8 relative"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
            <div className="absolute inset-0 rounded-3xl blur-[10px] bg-violet/20 animate-pulse" />
            <Trophy className="w-10 h-10 text-violet relative z-10" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-[clamp(32px,6vw,56px)] font-[900] tracking-tight mb-4">
            {t('leaderboard', 'title')} <span className="text-glow-purple text-violet">{t('leaderboard', 'titleHighlight')}</span>
          </motion.h1>
          <p className="text-white/40 text-[16px] font-[500] max-w-sm mx-auto leading-relaxed">
            {t('leaderboard', mode === 'quiz' ? 'quizSubtitle' : 'subtitle')}
          </p>
        </div>

        <div role="tablist" className="flex items-center justify-center gap-2 mb-10">
          {[
            { key: 'xp', label: t('leaderboard', 'boardXp'), Icon: Star },
            { key: 'quiz', label: t('leaderboard', 'boardQuiz'), Icon: Target },
          ].map(({ key, label, Icon }) => (
            <button key={key} type="button" role="tab" id={`board-tab-${key}`}
              aria-selected={mode === key} aria-controls="board-panel"
              onClick={() => setMode(key)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-[800] uppercase tracking-widest transition-all border ${
                mode === key
                  ? 'bg-violet/15 border-violet/40 text-violet-light shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                  : 'bg-white/[0.02] border-white/5 text-white/30 hover:text-white/60 hover:bg-white/5'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* One panel, because the two boards are two answers to the same
            question and a reader is looking at one of them. A `tablist` with
            nothing labelled as its panel is worse than no roles at all. */}
        <div id="board-panel" role="tabpanel" aria-labelledby={`board-tab-${mode}`}>
        {mode === 'quiz' ? (
          quizLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
              <p className="text-[10px] font-[800] uppercase tracking-widest text-white/20">{t('leaderboard', 'syncing')}</p>
            </div>
          ) : quizFailed ? (
            <div className="text-center text-white/30 py-20 font-[700] italic">{t('leaderboard', 'loadFailed')}</div>
          ) : (
            <>
              {quizRows.length === 0 ? (
                <div className="text-center text-white/30 py-20 font-[700] italic">{t('leaderboard', 'noQuizPioneers')}</div>
              ) : (
                <GlassCard delay={0.2} className="overflow-hidden !p-0">
                  <div className="grid grid-cols-12 gap-2 px-8 py-5 border-b border-white/5 bg-white/[0.02] text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em]">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-5">{t('leaderboard', 'explorer')}</div>
                    <div className="col-span-3 text-center">{t('leaderboard', 'quizzesTaken')}</div>
                    <div className="col-span-3 text-right">{t('leaderboard', 'accuracy')}</div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {quizRows.map((u, i) => (
                      <div key={`${u.display_name}-${i}`}
                        aria-current={u.is_you ? 'true' : undefined}
                        className={`grid grid-cols-12 gap-2 px-8 py-5 items-center transition-all ${u.is_you ? 'bg-violet/10 border-l-4 border-violet shadow-inner' : 'hover:bg-white/[0.02]'}`}>
                        {/* The server's place, not the row's position: children
                            level on accuracy share one, exactly as they do on
                            the XP board. */}
                        <div className="col-span-1 text-center text-xs font-[800] text-white/20">{u.rank}</div>
                        <div className="col-span-5 flex items-center gap-4">
                          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.display_name || '')}`}
                            className="w-10 h-10 rounded-xl border border-white/5 shadow-lg shrink-0" alt={u.display_name} />
                          <p className={`text-sm font-[800] ${u.is_you ? 'text-violet-light' : 'text-white'}`}>{u.display_name}</p>
                        </div>
                        <div className="col-span-3 text-center text-[11px] font-[800] text-white/40">{fmt.number(u.total_quizzes)}</div>
                        <div className="col-span-3 text-right text-sm font-[900] text-white tracking-tight">{fmt.number(u.avg_percentage)}%</div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
              {/* A child who is not on this board is owed the reason, not a
                  blank. The number is the server's — it is the floor the
                  ranking actually applies. */}
              {minQuizzes != null && (
                <p className="mt-6 text-center text-[11px] font-[700] text-white/30 leading-relaxed">
                  {t('leaderboard', 'minQuizzes').replace('{count}', fmt.number(minQuizzes))}
                </p>
              )}
            </>
          )
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-violet/30 border-t-violet rounded-full animate-spin" />
            <p className="text-[10px] font-[800] uppercase tracking-widest text-white/20">{t('leaderboard', 'syncing')}</p>
          </div>
        ) : failed && rows.length === 0 ? (
          <div className="text-center text-white/30 py-20 font-[700] italic">{t('leaderboard', 'loadFailed')}</div>
        ) : rows.length === 0 ? (
          // This was `all.length < 3`, and it only ever passed because the
          // duplicate row for the signed-in user padded the count. With that
          // gone, two real players fell under the threshold and everyone was
          // told "be the first". The podium below already renders a blank
          // plinth for a missing place, so one player is a fine leaderboard.
          <div className="text-center text-white/30 py-20 font-[700] italic">{t('leaderboard', 'noPioneers')}</div>
        ) : (
          <>
            {/* Podium */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="grid grid-cols-3 gap-4 mb-12 items-end">
              {[top3[1], top3[0], top3[2]].map((u, podiumIdx) => {
                if (!u) return <div key={podiumIdx} />;
                const place = podiumIdx === 1 ? 0 : podiumIdx === 0 ? 1 : 2;
                const style = RANK_STYLES[place];
                const heights = ['h-32', 'h-44', 'h-28'];
                return (
                  <div key={`${u.display_name}-${podiumIdx}`} aria-current={u.is_you ? 'true' : undefined}
                    className="flex flex-col items-center gap-4 group">
                    <div className="relative">
                      <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.display_name || '')}`}
                        className="w-14 h-14 rounded-2xl border-2 border-white/10 shadow-2xl relative z-10 object-cover" alt={u.display_name} />
                      <div className="absolute inset-0 rounded-2xl bg-violet/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <span className={`text-[11px] font-[800] truncate max-w-full text-center uppercase tracking-wider ${style.text}`}>{u.display_name}</span>
                    <div className={`w-full rounded-2xl bg-gradient-to-b ${style.bg} border border-white/5 flex flex-col items-center justify-end pb-4 transition-all hover:scale-[1.02] ${heights[podiumIdx]} ${style.glow}`}>
                      <div className="mb-auto pt-4">{style.icon}</div>
                      {/* The server's place, not the plinth's. Players level on
                          XP share one, and their profile pages say the same. */}
                      <span className={`text-sm font-[900] ${style.text}`}>#{u.rank}</span>
                      <span className="text-[9px] font-[700] text-white/40 uppercase tracking-widest mt-1">{fmt.number(u.xp)} {t('leaderboard', 'xpPoints')}</span>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Rankings List — places 4 and below. With three players or
                fewer they are all on the podium, and this would be a table
                header with nothing under it. */}
            {rest.length > 0 && (
            <GlassCard delay={0.3} className="overflow-hidden !p-0">
              <div className="grid grid-cols-12 gap-2 px-8 py-5 border-b border-white/5 bg-white/[0.02] text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em]">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-6">{t('leaderboard', 'explorer')}</div>
                <div className="col-span-2 text-center">{t('leaderboard', 'level')}</div>
                <div className="col-span-3 text-right">{t('leaderboard', 'experience')}</div>
              </div>
              <div className="divide-y divide-white/5">
                {rest.map((u, i) => (
                  <motion.div key={`${u.display_name}-${i}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i + 0.4 }}
                    aria-current={u.is_you ? 'true' : undefined}
                    className={`grid grid-cols-12 gap-2 px-8 py-5 items-center transition-all ${u.is_you ? 'bg-violet/10 border-l-4 border-violet shadow-inner' : 'hover:bg-white/[0.02]'}`}>
                    <div className="col-span-1 text-center text-xs font-[800] text-white/20">{u.rank}</div>
                    <div className="col-span-6 flex items-center gap-4">
                      <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(u.display_name || '')}`}
                        className="w-10 h-10 rounded-xl border border-white/5 shadow-lg shrink-0" alt={u.display_name} />
                      <div>
                        <p className={`text-sm font-[800] ${u.is_you ? 'text-violet-light' : 'text-white'}`}>{u.display_name}</p>
                      </div>
                    </div>
                    <div className="col-span-2 text-center">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet/10 border border-violet/20 text-[11px] font-[800] text-violet-light">
                        <Star className="w-3.5 h-3.5" />{u.level}
                      </span>
                    </div>
                    <div className="col-span-3 text-right">
                      <p className="text-sm font-[900] text-white tracking-tight">{fmt.number(u.xp)}</p>
                      <p className="text-[9px] font-[800] text-white/20 uppercase tracking-widest">{t('leaderboard', 'xpPoints')}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-violet-light/40" />
                  <span className="text-[10px] font-[800] text-white/20 uppercase tracking-[0.3em]">{t('leaderboard', 'secureProtocol')}</span>
                </div>
              </div>
            </GlassCard>
            )}

            {/* Your own place. The board is the first hundred; almost every
                player is below it, and what they were shown down there was an
                array index attached to a row this page had invented. */}
            {user && (
              <GlassCard delay={0.4} className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <span className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.25em]">
                  {t('leaderboard', 'yourPlace')}
                </span>
                {myRank != null ? (
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-[900] text-violet-light tracking-tight">#{fmt.number(myRank)}</span>
                    <span className="text-[11px] font-[700] text-white/30">
                      {t('leaderboard', 'ofPlayers').replace('{count}', fmt.number(totalPlayers))}
                    </span>
                    {myXp != null && (
                      <span className="text-[11px] font-[700] text-white/30">
                        {fmt.number(myXp)} {t('leaderboard', 'xpPoints')}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] font-[700] text-white/40 italic">
                    {t('leaderboard', 'notRankedYet')}
                  </span>
                )}
              </GlassCard>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
