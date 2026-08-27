import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { MailCheck, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { retryAfterMinutes } from '@/lib/retryAfter';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Type the code from the message, and the address is confirmed.
 *
 * Nothing is blocked while it is not — lessons, games and the leaderboard all
 * work — except writing to another child. The screen says which, so it reads as
 * a step rather than a wall.
 */
export default function VerifyEmailView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user?.email_verified) navigate('/profile', { replace: true });
  }, [user?.email_verified, navigate]);

  const problem = (err, fallback) => {
    const minutes = retryAfterMinutes(err);
    if (minutes !== null) {
      return t('verifyEmail', 'tooManyAttempts').replace('{{minutes}}', minutes);
    }
    return err.response?.data?.detail || fallback;
  };

  const resend = async () => {
    setSending(true);
    setError('');
    try {
      await api.post('/auth/email/verify/request/');
      setNotice(t('verifyEmail', 'resent'));
    } catch (err) {
      setError(problem(err, t('verifyEmail', 'failed')));
    } finally {
      setSending(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/email/verify/confirm/', { code });
      updateUser(data);
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(problem(err, t('verifyEmail', 'invalidCode')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="fixed top-1/4 -left-40 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'rgba(139,92,246,0.06)' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 p-2 px-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-xl mb-6">
            <MailCheck className="w-4 h-4 text-violet-light" />
            <span className="text-[10px] font-[800] uppercase tracking-[0.2em] text-white/40">
              {t('verifyEmail', 'title')}
            </span>
          </div>
          <h1 className="text-3xl font-[900] tracking-tight">{t('verifyEmail', 'subtitle')}</h1>
          {user?.email && (
            <p className="text-white/40 text-sm font-[600] mt-3">
              {t('verifyEmail', 'sentTo')} <span className="text-violet-light">{user.email}</span>
            </p>
          )}
        </div>

        <GlassCard accent="#8b5cf6" className="!p-8 sm:!p-10 shadow-2xl">
          <form onSubmit={confirm} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">
                {t('verifyEmail', 'codeLabel')}
              </label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(''); }}
                placeholder="123456"
                className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-lg tracking-[0.5em] text-center font-[800]"
              />
            </div>

            {notice && (
              <p className="text-violet-pale text-xs font-[700] text-center">{notice}</p>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-[700] text-center"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="group relative w-full py-4 rounded-2xl font-[800] text-sm uppercase tracking-widest text-white overflow-hidden transition-all active:scale-[0.98] disabled:opacity-40"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet to-indigo" />
              <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {t('verifyEmail', 'verify')} <MailCheck className="w-4 h-4" />
              </span>
            </button>

            <button
              type="button"
              onClick={resend}
              disabled={sending}
              className="text-violet-light hover:text-white text-xs font-[800] transition-colors disabled:opacity-40"
            >
              {t('verifyEmail', 'resend')}
            </button>
          </form>
        </GlassCard>

        <div className="mt-12 flex items-center justify-center gap-2 text-white/10 uppercase text-[9px] font-[800] tracking-[0.4em]">
          <ShieldCheck className="w-3 h-3" /> {t('loginPage', 'encrypted')}
        </div>
      </motion.div>
    </div>
  );
}
