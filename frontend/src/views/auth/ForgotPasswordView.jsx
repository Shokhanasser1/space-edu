import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { retryAfterMinutes } from '@/lib/retryAfter';
import { serverDetail, serverFieldErrors } from '@/lib/serverErrors';
import { useTranslation } from '@/hooks/useTranslation';
import GlassCard from '@/components/ui/GlassCard';

/**
 * Two steps on one screen: ask for a code, then use it.
 *
 * The first step's answer is deliberately the same whether or not there is an
 * account — the server sends it that way, and repeating it here rather than
 * saying "we sent it to you" keeps the screen from leaking what the API refuses
 * to.
 */
export default function ForgotPasswordView() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState('ask');
  const [form, setForm] = useState({ email: '', code: '', password: '', password2: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const problem = (err, fallback) => {
    const minutes = retryAfterMinutes(err);
    if (minutes !== null) {
      return t('forgotPassword', 'tooManyAttempts').replace('{{minutes}}', minutes);
    }
    // In the reader's language, or the fallback — never the server's English
    // (see lib/serverErrors.js). A complaint about the password comes first:
    // it is the one thing on this screen they can fix by retyping.
    const { password } = serverFieldErrors(t, err, ['password']);
    return password || serverDetail(t, err, fallback);
  };

  const askForCode = async (e) => {
    e.preventDefault();
    if (!form.email) return;
    setLoading(true);
    try {
      await api.post('/auth/password/reset/request/', { email: form.email });
      setNotice(t('forgotPassword', 'codeSentGeneric'));
      setStep('confirm');
    } catch (err) {
      setError(problem(err, t('forgotPassword', 'failed')));
    } finally {
      setLoading(false);
    }
  };

  const setNewPassword = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) {
      setError(t('forgotPassword', 'passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password/reset/confirm/', {
        email: form.email,
        code: form.code,
        password: form.password,
        password2: form.password2,
      });
      navigate('/login', { state: { notice: t('forgotPassword', 'success') } });
    } catch (err) {
      setError(problem(err, t('forgotPassword', 'invalidCode')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="fixed top-1/4 -left-40 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'rgba(139,92,246,0.06)' }} />
      <div className="fixed bottom-0 -right-40 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: 'rgba(0,229,255,0.03)' }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[440px] relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 p-2 px-4 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-xl mb-6">
            <KeyRound className="w-4 h-4 text-violet-light" />
            <span className="text-[10px] font-[800] uppercase tracking-[0.2em] text-white/40">
              {t('auth', 'resetPassword')}
            </span>
          </div>
          <h1 className="text-4xl font-[900] tracking-tight">
            {t('forgotPassword', 'title')}{' '}
            <span className="text-glow-purple text-violet">{t('forgotPassword', 'titleHighlight')}</span>
          </h1>
          <p className="text-white/30 text-sm font-[500] mt-3">{t('forgotPassword', 'subtitle')}</p>
        </div>

        <GlassCard accent="#8b5cf6" className="!p-8 sm:!p-10 shadow-2xl">
          {step === 'ask' ? (
            <form onSubmit={askForCode} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <label htmlFor="reset-email" className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">
                  {t('forgotPassword', 'emailLabel')}
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={change}
                  placeholder="cosmonaut@cosmos.uz"
                  className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-sm"
                />
              </div>

              {error && <Banner tone="bad">{error}</Banner>}

              <SubmitButton loading={loading} label={t('forgotPassword', 'sendCode')} />
            </form>
          ) : (
            <form onSubmit={setNewPassword} className="flex flex-col gap-6">
              {notice && <Banner tone="good">{notice}</Banner>}

              <div className="flex flex-col gap-2.5">
                <label htmlFor="reset-code" className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">
                  {t('forgotPassword', 'codeLabel')}
                </label>
                <input
                  id="reset-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={form.code}
                  onChange={change}
                  placeholder="123456"
                  className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-sm tracking-[0.4em] text-center font-[800]"
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <label htmlFor="reset-password" className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">
                  {t('forgotPassword', 'newPasswordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="reset-password"
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={change}
                    placeholder="••••••••"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 pr-14 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={t('auth', showPass ? 'hidePassword' : 'showPassword')}
                    aria-pressed={showPass}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/60 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label htmlFor="reset-password2" className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">
                  {t('forgotPassword', 'confirmPasswordLabel')}
                </label>
                <input
                  id="reset-password2"
                  name="password2"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password2}
                  onChange={change}
                  placeholder="••••••••"
                  className="bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-sm"
                />
              </div>

              {error && <Banner tone="bad">{error}</Banner>}

              <SubmitButton loading={loading} label={t('forgotPassword', 'submit')} />
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <Link to="/login" className="text-violet-light hover:text-white text-xs font-[800] transition-colors">
              {t('auth', 'backToLogin')}
            </Link>
          </div>
        </GlassCard>

        <div className="mt-12 flex items-center justify-center gap-2 text-white/10 uppercase text-[9px] font-[800] tracking-[0.4em]">
          <ShieldCheck className="w-3 h-3" /> {t('loginPage', 'encrypted')}
        </div>
      </motion.div>
    </div>
  );
}

function Banner({ tone, children }) {
  const styles = tone === 'good'
    ? 'bg-violet/10 border-violet/20 text-violet-pale'
    : 'bg-red-500/10 border-red-500/20 text-red-400';
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={`border rounded-xl px-4 py-3 text-xs font-[700] text-center ${styles}`}
    >
      {children}
    </motion.div>
  );
}

function SubmitButton({ loading, label }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group relative w-full py-4 rounded-2xl font-[800] text-sm uppercase tracking-widest text-white overflow-hidden transition-all active:scale-[0.98]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-violet to-indigo opacity-100 group-hover:opacity-90 transition-opacity" />
      <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]" />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <>{label} <KeyRound className="w-4 h-4" /></>
        )}
      </span>
    </button>
  );
}
