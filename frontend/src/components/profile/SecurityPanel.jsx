import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, MailCheck, MailWarning, X } from 'lucide-react';
import api from '@/lib/api';
import { serverDetail, translateServerMessage } from '@/lib/serverErrors';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * Change your password, and move your account to another address.
 *
 * Its own file rather than another section of ProfileView, which is already
 * past the 800-line ceiling in CONTRIBUTING.md.
 */
export default function SecurityPanel() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setTokens = useAuthStore((s) => s.setTokens);

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <PasswordCard t={t} setTokens={setTokens} />
      <EmailCard t={t} user={user} updateUser={updateUser} setTokens={setTokens} />
    </section>
  );
}

function Card({ icon, title, children }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl p-6 sm:p-7">
      <h3 className="flex items-center gap-2.5 text-[11px] font-[800] uppercase tracking-[0.2em] text-white/40 mb-5">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-[800] text-white/30 uppercase tracking-[0.2em] ml-1">{label}</span>
      <input
        {...props}
        className="bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/20 outline-none focus:border-violet/40 focus:bg-white/[0.06] transition-all text-sm"
      />
    </label>
  );
}

function Submit({ children, ...props }) {
  return (
    <button
      {...props}
      className="relative w-full py-3 rounded-2xl font-[800] text-xs uppercase tracking-widest text-white overflow-hidden active:scale-[0.98] disabled:opacity-40"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-violet to-indigo" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function Message({ tone, children }) {
  if (!children) return null;
  const colour = tone === 'good' ? 'text-violet-pale' : 'text-red-400';
  return <p className={`text-xs font-[700] ${colour}`}>{children}</p>;
}

/**
 * The first readable line of a DRF error body, in the reader's language.
 *
 * The server writes English only; lib/serverErrors.js knows every sentence
 * the accounts API sends and says it in the site's language. A general
 * `detail` (or a `code`) that is not known becomes the fallback rather than
 * an English sentence; a field's own sentence is shown as sent when unknown,
 * because next to the box it is about it still points at the problem.
 */
function firstProblem(t, err, fallback) {
  const data = err.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (data.code || data.detail !== undefined) return serverDetail(t, err, fallback);
  for (const value of Object.values(data)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'string') return translateServerMessage(t, raw) || raw;
  }
  return fallback;
}

function PasswordCard({ t, setTokens }) {
  const [form, setForm] = useState({ current_password: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setDone('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password2) {
      setError(t('profilePage', 'passwordsDoNotMatch'));
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/password/change/', form);
      // Every other session was just revoked, this one included. The pair that
      // comes back is what keeps the page from signing itself out.
      setTokens(data.access, data.refresh);
      setForm({ current_password: '', password: '', password2: '' });
      setDone(t('profilePage', 'passwordChanged'));
    } catch (err) {
      setError(firstProblem(t, err, t('profilePage', 'passwordChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<KeyRound className="w-3.5 h-3.5 text-violet-light" />} title={t('profilePage', 'changePassword')}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={t('profilePage', 'currentPassword')}
          name="current_password" type="password" autoComplete="current-password"
          value={form.current_password} onChange={change}
        />
        <Field
          label={t('profilePage', 'newPassword')}
          name="password" type="password" autoComplete="new-password"
          value={form.password} onChange={change}
        />
        <Field
          label={t('profilePage', 'confirmNewPassword')}
          name="password2" type="password" autoComplete="new-password"
          value={form.password2} onChange={change}
        />
        <Message tone="bad">{error}</Message>
        <Message tone="good">{done}</Message>
        <Submit type="submit" disabled={busy}>{t('profilePage', 'changePassword')}</Submit>
      </form>
    </Card>
  );
}

function EmailCard({ t, user, updateUser, setTokens }) {
  const [form, setForm] = useState({ new_email: '', current_password: '' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const pending = user?.pending_email || '';

  const change = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
    setDone('');
  };

  const ask = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/email/change/request/', form);
      updateUser({ pending_email: data.pending_email });
      setForm({ new_email: '', current_password: '' });
      setDone(t('profilePage', 'emailChangeRequested'));
    } catch (err) {
      setError(firstProblem(t, err, t('profilePage', 'emailChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/email/change/confirm/', { code });
      updateUser(data.user);
      setTokens(data.access, data.refresh);
      setCode('');
      setDone(t('profilePage', 'emailChanged'));
    } catch (err) {
      setError(firstProblem(t, err, t('profilePage', 'emailChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.post('/auth/email/change/cancel/');
      updateUser({ pending_email: '' });
      setDone('');
    } catch (err) {
      setError(firstProblem(t, err, t('profilePage', 'emailChangeFailed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<Mail className="w-3.5 h-3.5 text-violet-light" />} title={t('profilePage', 'changeEmail')}>
      <div className="flex items-center gap-2 mb-5 text-xs font-[600]">
        <span className="text-white/50">{user?.email}</span>
        {user?.email_verified ? (
          <span className="inline-flex items-center gap-1 text-violet-pale">
            <MailCheck className="w-3.5 h-3.5" /> {t('profilePage', 'emailVerified')}
          </span>
        ) : (
          <Link to="/verify-email" className="inline-flex items-center gap-1 text-amber-300 hover:text-white">
            <MailWarning className="w-3.5 h-3.5" /> {t('profilePage', 'verifyNow')}
          </Link>
        )}
      </div>

      {pending ? (
        <form onSubmit={confirm} className="flex flex-col gap-4">
          <p className="text-white/40 text-xs font-[600]">
            {t('profilePage', 'emailPendingNotice')} <span className="text-violet-light">{pending}</span>
          </p>
          <Field
            label={t('verifyEmail', 'codeLabel')}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => { setCode(e.target.value); setError(''); }}
          />
          <Message tone="bad">{error}</Message>
          <Message tone="good">{done}</Message>
          <Submit type="submit" disabled={busy || code.length !== 6}>
            {t('verifyEmail', 'verify')}
          </Submit>
          <button
            type="button" onClick={cancel} disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 text-white/30 hover:text-white/70 text-[10px] font-[800] uppercase tracking-[0.2em] transition-colors"
          >
            <X className="w-3 h-3" /> {t('profilePage', 'cancelEmailChange')}
          </button>
        </form>
      ) : (
        <form onSubmit={ask} className="flex flex-col gap-4">
          <Field
            label={t('profilePage', 'newEmail')}
            name="new_email" type="email" autoComplete="email"
            value={form.new_email} onChange={change}
          />
          <Field
            label={t('profilePage', 'currentPassword')}
            name="current_password" type="password" autoComplete="current-password"
            value={form.current_password} onChange={change}
          />
          <Message tone="bad">{error}</Message>
          <Message tone="good">{done}</Message>
          <Submit type="submit" disabled={busy}>{t('profilePage', 'changeEmail')}</Submit>
        </form>
      )}
    </Card>
  );
}
