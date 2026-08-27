import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { isGoogleEnabled, renderGoogleButton } from '@/lib/googleAuth';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * "Continue with Google", or nothing at all.
 *
 * Renders null when VITE_GOOGLE_CLIENT_ID is unset — which is how CI builds and
 * how anybody who has not set one up runs it. Nothing is injected, no request is
 * made, and the password form beside it is unaffected.
 *
 * `text` is Google's own wording key: 'signin_with' on the sign-in screen,
 * 'signup_with' on registration.
 */
export default function GoogleSignInButton({ text = 'signin_with', onDone }) {
  const container = useRef(null);
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isGoogleEnabled() || !container.current) return undefined;

    let cancelled = false;
    let cleanup;

    const send = async (credential) => {
      setBusy(true);
      setError('');
      try {
        const { data } = await api.post('/auth/google/', { credential });
        login(data.user, data.access, data.refresh);
        onDone?.(data);
      } catch (err) {
        const code = err.response?.data?.code;
        if (code === 'google_unconfigured') setError(t('loginPage', 'googleUnavailable'));
        else if (code === 'google_email_unverified') setError(t('loginPage', 'googleEmailUnverified'));
        else setError(err.response?.data?.detail || t('loginPage', 'googleFailed'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    renderGoogleButton(container.current, {
      text,
      onCredential: send,
      onError: () => setError(t('loginPage', 'googleFailed')),
    })
      .then((teardown) => {
        if (cancelled) teardown?.();
        else cleanup = teardown;
      })
      .catch(() => {
        // The script did not load — a blocked host, or no connection. The
        // password form is still there, so this says so quietly rather than
        // taking the screen down with it.
        if (!cancelled) setError(t('loginPage', 'googleUnavailable'));
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [text, login, onDone, t]);

  if (!isGoogleEnabled()) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-[9px] font-[800] uppercase tracking-[0.3em] text-white/20">
          {t('auth', 'orContinueWith')}
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div
        ref={container}
        aria-busy={busy}
        className={`flex justify-center ${busy ? 'opacity-50 pointer-events-none' : ''}`}
      />

      {error && (
        <p className="text-red-400 text-xs font-[700] text-center">{error}</p>
      )}
    </div>
  );
}
