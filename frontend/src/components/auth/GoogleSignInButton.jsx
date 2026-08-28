import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { isGoogleEnabled, renderGoogleButton } from '@/lib/googleAuth';
import { serverDetail } from '@/lib/serverErrors';
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
 *
 * The button is rendered once per language, not once per render. `onDone`
 * is an inline arrow in both callers and `t` is a new function every
 * render, and with both in the effect's dependency list the effect re-ran
 * on every keystroke in the form beside it — tearing down and re-rendering
 * Google's iframe, one request to accounts.google.com per character typed,
 * and a console full of "initialize() is called multiple times". Seen in a
 * browser on 28 Aug 2026. Both now live in refs the effect reads through.
 */
const GOOGLE_LOCALE = { ENG: 'en', RUS: 'ru', UZB: 'uz' };

export default function GoogleSignInButton({ text = 'signin_with', onDone }) {
  const container = useRef(null);
  const { t, language } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onDoneRef = useRef(onDone);
  const tRef = useRef(t);
  useEffect(() => {
    onDoneRef.current = onDone;
    tRef.current = t;
  });

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
        onDoneRef.current?.(data);
      } catch (err) {
        // `google_unconfigured` and `google_email_unverified` are codes the
        // server promises; lib/serverErrors.js maps them, and says any
        // `detail` in the reader's language rather than in English.
        const say = tRef.current;
        setError(serverDetail(say, err, say('loginPage', 'googleFailed')));
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    renderGoogleButton(container.current, {
      text,
      locale: GOOGLE_LOCALE[language],
      onCredential: send,
      onError: () => setError(tRef.current('loginPage', 'googleFailed')),
    })
      .then((teardown) => {
        if (cancelled) teardown?.();
        else cleanup = teardown;
      })
      .catch(() => {
        // The script did not load — a blocked host, or no connection. The
        // password form is still there, so this says so quietly rather than
        // taking the screen down with it.
        if (!cancelled) setError(tRef.current('loginPage', 'googleUnavailable'));
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [text, login, language]);

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
