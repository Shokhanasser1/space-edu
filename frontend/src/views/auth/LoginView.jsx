import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { retryAfterMinutes } from '@/lib/retryAfter';

import { useAuthStore } from '@/store/useAuthStore';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useTranslation } from '@/hooks/useTranslation';
import AuthShell from '@/components/auth/AuthShell';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';

export default function LoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const syncFromAPI = useGamificationStore((s) => s.syncFromAPI);
  const from = location.state?.from?.pathname || '/';
  // Set by the password-reset screen on its way here, so somebody who just
  // changed their password is told it worked rather than left guessing.
  const notice = location.state?.notice || '';
  const { t } = useTranslation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError(t('loginPage', 'fillAll'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', form);
      login(data.user, data.access, data.refresh);

      try {
        const { data: gam } = await api.get('/gamification/profile/');
        syncFromAPI(gam);
      } catch { /* non-critical */ }

      navigate(from, { replace: true });
    } catch (err) {
      // A rate-limited sign-in is not a wrong password, and saying so matters:
      // the child has done nothing wrong and retrying makes it no better.
      const minutes = retryAfterMinutes(err);
      if (minutes !== null) {
        setError(t('loginPage', 'tooManyAttempts').replace('{{minutes}}', minutes));
      } else {
        setError(err.response?.data?.detail || t('loginPage', 'invalidCreds'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t('loginPage', 'welcomeTitle')}
      highlight={t('loginPage', 'welcomeHighlight')}
      subtitle={t('loginPage', 'subtitle')}
      footer={t('loginPage', 'encrypted')}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {/* Email */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor="login-email" className="auth-label">{t('loginPage', 'emailLabel')}</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="cosmonaut@cosmos.uz"
            aria-invalid={Boolean(error) || undefined}
            className="auth-input"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2.5">
          <label htmlFor="login-password" className="auth-label">{t('loginPage', 'passwordLabel')}</label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPass ? 'text' : 'password'}
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-invalid={Boolean(error) || undefined}
              className="auth-input pr-14"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'hide password' : 'show password'}
              aria-pressed={showPass}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--auth-text-faint)' }}
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {notice && !error && (
          <div
            className="rounded-xl px-4 py-3 text-xs font-[700] text-center"
            style={{ background: 'var(--auth-glow)', border: '1px solid rgba(167,139,250,0.3)', color: 'var(--auth-accent-light)' }}
          >
            {notice}
          </div>
        )}

        {error && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-300 text-xs font-[700] text-center"
          >
            {error}
          </motion.div>
        )}

        <button type="submit" disabled={loading} className="auth-btn-primary group">
          <span className="flex items-center justify-center gap-2">
            {loading ? (
              <Loader className="w-4 h-4" />
            ) : (
              <>
                {t('loginPage', 'launchMission')}
                <Rocket className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </>
            )}
          </span>
        </button>

        <div className="text-center -mt-2">
          <Link to="/forgot-password" className="text-xs font-[700] transition-colors" style={{ color: 'var(--auth-text-muted)' }}>
            {t('loginPage', 'forgotPasswordLink')}
          </Link>
        </div>

        <GoogleSignInButton
          text="signin_with"
          onDone={() => navigate(from, { replace: true })}
        />

        <div className="mt-2 pt-6 text-center" style={{ borderTop: '1px solid var(--auth-border)' }}>
          <p className="text-xs font-[600]" style={{ color: 'var(--auth-text-muted)' }}>
            {t('loginPage', 'newToAcademy')}{' '}
            <Link to="/register" className="auth-link">{t('loginPage', 'initProfile')}</Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}

function Loader({ className }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
