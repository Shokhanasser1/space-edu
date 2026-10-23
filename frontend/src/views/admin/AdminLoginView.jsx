import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Shield } from 'lucide-react';
import api from '@/lib/api';
import { retryAfterMinutes } from '@/lib/retryAfter';
import { serverDetail } from '@/lib/serverErrors';

import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import AuthShell from '@/components/auth/AuthShell';

const PANEL = '/admin-panel';

/**
 * The way in to the admin panel.
 *
 * /admin-panel had a guard (StaffRoute) and no door: a member of staff signed in
 * on the pupils' form, landed on the home page, and had to know to type the
 * address. Nothing on the site led there.
 *
 * Same endpoint as the pupils' sign-in — the panel's data is refused by
 * IsAdminUser on the server whatever this screen does, so this is the front
 * door, not the lock. What it adds is the one check that belongs to a door:
 * a valid account that is not staff is not let in. Its tokens are revoked on the
 * spot rather than kept, so a pupil who tries their own password here is not
 * quietly signed in to the site by a screen that told them no.
 */
export default function AdminLoginView() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // Only ever back into the panel. `from` is whatever StaffRoute was guarding,
  // and this screen has no business sending anyone anywhere else.
  const wanted = location.state?.from?.pathname;
  const from = wanted?.startsWith(PANEL) && wanted !== location.pathname ? wanted : PANEL;

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && user?.is_staff) {
    return <Navigate to={from} replace />;
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError(t('adminLogin', 'fillAll'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', form);
      if (!data.user?.is_staff) {
        // Not awaited and not reported: the screen's answer is the same
        // whether the revocation lands or not, and the tokens were never stored.
        api.post('/auth/logout/', { refresh: data.refresh })?.catch?.(() => {});
        setError(t('adminLogin', 'notStaff'));
        return;
      }
      login(data.user, data.access, data.refresh);
      navigate(from, { replace: true });
    } catch (err) {
      const minutes = retryAfterMinutes(err);
      if (minutes !== null) {
        setError(t('loginPage', 'tooManyAttempts', { minutes }));
      } else {
        setError(serverDetail(t, err, t('loginPage', 'invalidCreds')));
      }
    } finally {
      setLoading(false);
    }
  };

  // Somebody is already signed in, and it is not an administrator. Offering the
  // form over the top of their session is how one person's account ends up
  // replaced by another's on a shared computer — the reason GuestRoute exists.
  // Say who is signed in and let them sign out first.
  if (isAuthenticated) {
    const who = user?.email || user?.username || '';
    return (
      <AuthShell
        title={t('adminLogin', 'title')}
        highlight={t('adminLogin', 'highlight')}
        subtitle={t('adminLogin', 'subtitle')}
        footer={t('adminLogin', 'footer')}
      >
        <div className="flex flex-col gap-6 text-center">
          <Shield className="w-10 h-10 mx-auto" style={{ color: 'var(--auth-accent-light)' }} aria-hidden="true" />
          <p role="status" className="text-sm font-[600]" style={{ color: 'var(--auth-text-muted)' }}>
            {t('adminLogin', 'signedInNotStaff', { who })}
          </p>
          <button type="button" onClick={() => logout()} className="auth-btn-primary">
            {t('adminLogin', 'signOutFirst')}
          </button>
          <BackToSite label={t('adminLogin', 'backToSite')} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('adminLogin', 'title')}
      highlight={t('adminLogin', 'highlight')}
      subtitle={t('adminLogin', 'subtitle')}
      footer={t('adminLogin', 'footer')}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <label htmlFor="admin-email" className="auth-label">{t('adminLogin', 'emailLabel')}</label>
          <input
            id="admin-email"
            name="email"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={form.email}
            onChange={handleChange}
            placeholder="admin@uzcosmos.uz"
            aria-invalid={Boolean(error) || undefined}
            className="auth-input"
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <label htmlFor="admin-password" className="auth-label">{t('adminLogin', 'passwordLabel')}</label>
          <div className="relative">
            <input
              id="admin-password"
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
              aria-label={t('auth', showPass ? 'hidePassword' : 'showPassword')}
              aria-pressed={showPass}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'var(--auth-text-faint)' }}
            >
              {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

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

        <button type="submit" disabled={loading} className="auth-btn-primary">
          <span className="flex items-center justify-center gap-2">
            {loading ? <Spinner className="w-4 h-4" /> : (
              <>
                <Shield className="w-4 h-4" aria-hidden="true" />
                {t('adminLogin', 'submit')}
              </>
            )}
          </span>
        </button>

        <div className="mt-2 pt-6 text-center" style={{ borderTop: '1px solid var(--auth-border)' }}>
          <BackToSite label={t('adminLogin', 'backToSite')} />
        </div>
      </form>
    </AuthShell>
  );
}

function BackToSite({ label }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-[700] transition-colors"
      style={{ color: 'var(--auth-text-muted)' }}
    >
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> {label}
    </Link>
  );
}

function Spinner({ className }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
