import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Rocket } from 'lucide-react';
import api from '@/lib/api';
import { retryAfterMinutes } from '@/lib/retryAfter';
import { serverDetail, serverFieldErrors } from '@/lib/serverErrors';

import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/hooks/useTranslation';
import { STEP_FIELDS, STEP_OF_FIELD, validateFields, validateField } from '@/lib/authValidation';
import AuthShell from '@/components/auth/AuthShell';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import PasswordStrength from '@/components/auth/PasswordStrength';
import StepIndicator from '@/components/auth/StepIndicator';

const TOTAL_STEPS = 2;
const EASE = [0.16, 1, 0.3, 1];

// `autoComplete` takes tokens from a fixed list, not our field names. The
// first password box used to be sent as `password`, which is not a token —
// browsers ignored it, and neither offered to generate a password nor to save
// the one that was typed.
const AUTOCOMPLETE = {
  first_name: 'given-name',
  last_name: 'family-name',
  email: 'email',
  date_of_birth: 'bday',
  password: 'new-password',
  password2: 'new-password',
};

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '',
  date_of_birth: '', password: '', password2: '',
};

/**
 * Registration in two steps: who you are, then how you sign in.
 *
 * The request the server sees is the same six-field POST it always was; only
 * the screen is split. Validation here is the cheap subset in
 * lib/authValidation — the server remains the authority and its field errors
 * are shown against the field, on whichever step that field lives.
 */
export default function RegisterView() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const direction = useRef(1);
  const focusRequest = useRef(null);

  const FIELDS = {
    first_name:    { label: t('registerPage', 'firstName'),   type: 'text',     placeholder: 'Alisher' },
    last_name:     { label: t('registerPage', 'lastName'),    type: 'text',     placeholder: 'Navoi' },
    date_of_birth: { label: t('registerPage', 'dob'),         type: 'date',     placeholder: '' },
    email:         { label: t('registerPage', 'email'),       type: 'email',    placeholder: 'cosmonaut@cosmos.uz' },
    password:      { label: t('registerPage', 'securityKey'), type: 'password', placeholder: t('registerPage', 'placeholder8chars') },
    password2:     { label: t('registerPage', 'confirmKey'),  type: 'password', placeholder: t('registerPage', 'repeatKey') },
  };
  const STEP_TITLES = [t('registerPage', 'step1Title'), t('registerPage', 'step2Title')];

  // After a step change (or a server error that sends us back), put the caret
  // where the reader needs it: the first field with an error, else the first
  // field of the step.
  //
  // Called twice on purpose. The effect covers the case where the step's
  // boxes are already in the DOM; `onAnimationComplete` on each step covers
  // the one where they are not — with `AnimatePresence mode="wait"` the new
  // step is only mounted once the old one has slid out, so the effect alone
  // found nothing to focus and the caret stayed on <body>. Seen in a
  // browser on 28 Aug 2026; jsdom mounts at once, so no test had noticed.
  const focusStep = useCallback(() => {
    const wanted = focusRequest.current || STEP_FIELDS[step][0];
    const el = document.getElementById(`reg-${wanted}`);
    if (!el) return;
    focusRequest.current = null;
    const active = document.activeElement;
    if (active === el) return;
    // Never take the caret from a reader who has already placed it: by the
    // time a 0.3 s slide reports it is done, a quick typist is mid-word in
    // the password box, and moving them back to e-mail would send the rest
    // of the word there.
    if (active && active !== document.body && el.form?.contains(active)) return;
    el.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    focusStep();
  }, [focusStep]);

  const translated = (keyed) => Object.fromEntries(
    Object.entries(keyed).map(([field, key]) => [field, t('registerPage', key)]),
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: undefined, detail: undefined }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    if (!form[name]) return; // an untouched box is not yet a mistake
    const key = validateField(name, form);
    if (key) setErrors((er) => ({ ...er, [name]: t('registerPage', key) }));
  };

  const showErrors = (keyed) => {
    const fields = Object.keys(keyed);
    setErrors((er) => ({ ...er, ...translated(keyed) }));
    const el = document.getElementById(`reg-${fields[0]}`);
    if (el) el.focus({ preventScroll: true });
  };

  const goTo = (next, focusField) => {
    direction.current = next > step ? 1 : -1;
    focusRequest.current = focusField || null;
    setStep(next);
  };

  const goNext = () => {
    const keyed = validateFields(STEP_FIELDS[1], form);
    if (Object.keys(keyed).length) {
      showErrors(keyed);
      return;
    }
    goTo(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Caught here rather than at the server, because a round trip to be told
    // the two boxes differ is a round trip nobody needed.
    const keyed = validateFields(STEP_FIELDS[2], form);
    if (Object.keys(keyed).length) {
      showErrors(keyed);
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const { data } = await api.post('/auth/register/', form);
      login(data.user, data.access, data.refresh);
      // Registration sends a code to confirm the address. Nothing is blocked
      // until it is used except writing to other people, so this lands on the
      // home page and the banner in chat does the asking.
      navigate('/');
    } catch (err) {
      const minutes = retryAfterMinutes(err);
      if (minutes !== null) {
        // Not a problem with anything they typed, so no field is marked red.
        setErrors({ detail: t('registerPage', 'tooManyAttempts').replace('{{minutes}}', minutes) });
        return;
      }
      // The server's complaints, each in the reader's language where the
      // sentence is known (lib/serverErrors.js): a field error against its
      // field, a general one in the box below — translated or as the generic
      // fallback, never as the server's English.
      const data = err.response?.data;
      const fieldErrors = serverFieldErrors(t, err, Object.keys(STEP_OF_FIELD));
      const hasGeneral = Boolean(data) && typeof data === 'object'
        && (data.detail !== undefined || data.non_field_errors !== undefined);
      const detail = hasGeneral || !Object.keys(fieldErrors).length
        ? serverDetail(t, err, t('registerPage', 'regFailed'))
        : undefined;
      setErrors({ ...fieldErrors, detail });

      // A complaint about a step-one field has to be seen on step one.
      const backTo = Object.keys(fieldErrors).find((field) => STEP_OF_FIELD[field] === 1);
      if (backTo) goTo(1, backTo);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (name) => {
    const { label, type, placeholder } = FIELDS[name];
    const isPassword = type === 'password';
    const id = `reg-${name}`;
    const error = errors[name];
    return (
      <div key={name} className="flex flex-col gap-2">
        <label htmlFor={id} className="auth-label">{label}</label>
        <div className="relative">
          <input
            id={id}
            name={name}
            type={isPassword && showPass ? 'text' : type}
            autoComplete={AUTOCOMPLETE[name]}
            value={form[name]}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
            className={`auth-input ${isPassword ? 'pr-14' : ''}`}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={t('auth', showPass ? 'hidePassword' : 'showPassword')}
              aria-pressed={showPass}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
              style={{ color: 'var(--auth-text-faint)' }}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
        {name === 'password' && form.password && <PasswordStrength value={form.password} />}
        {error && <p id={`${id}-error`} className="auth-error">{error}</p>}
      </div>
    );
  };

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
      initial: { opacity: 0, x: 28 * direction.current },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -28 * direction.current },
    };

  return (
    <AuthShell
      title={t('registerPage', 'joinTitle')}
      highlight={t('registerPage', 'joinHighlight')}
      subtitle={t('registerPage', 'subtitle')}
      footer={t('registerPage', 'secureEnroll')}
      width={520}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <StepIndicator step={step} total={TOTAL_STEPS} labels={STEP_TITLES} />

        <div className="overflow-hidden -m-1 p-1">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.div key="step-1" {...slide} transition={{ duration: 0.3, ease: EASE }} onAnimationComplete={focusStep} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {renderField('first_name')}
                  {renderField('last_name')}
                  <div className="sm:col-span-2">{renderField('date_of_birth')}</div>
                </div>

                <button type="button" onClick={goNext} className="auth-btn-primary group mt-1">
                  <span className="flex items-center justify-center gap-2">
                    {t('registerPage', 'next')}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>

                <div className="pt-2">
                  <GoogleSignInButton text="signup_with" onDone={() => navigate('/')} />
                </div>
              </motion.div>
            ) : (
              <motion.div key="step-2" {...slide} transition={{ duration: 0.3, ease: EASE }} onAnimationComplete={focusStep} className="flex flex-col gap-5">
                {renderField('email')}
                {renderField('password')}
                {renderField('password2')}

                {errors.detail && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-300 text-xs font-[700] text-center"
                  >
                    {errors.detail}
                  </motion.div>
                )}

                <div className="flex gap-3 mt-1">
                  <button type="button" onClick={() => goTo(1)} className="auth-btn-ghost flex items-center gap-2" aria-label={t('registerPage', 'back')}>
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('registerPage', 'back')}</span>
                  </button>
                  <button type="submit" disabled={loading} className="auth-btn-primary group flex-1">
                    <span className="flex items-center justify-center gap-2">
                      {loading ? (
                        <Loader className="w-4 h-4" />
                      ) : (
                        <>
                          {t('registerPage', 'initProfile')}
                          <Rocket className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {errors.detail && step === 1 && (
          <div role="alert" className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3 text-red-300 text-xs font-[700] text-center">
            {errors.detail}
          </div>
        )}

        <div className="mt-2 pt-6 text-center" style={{ borderTop: '1px solid var(--auth-border)' }}>
          <p className="text-xs font-[600]" style={{ color: 'var(--auth-text-muted)' }}>
            {t('registerPage', 'haveAccount')}{' '}
            <Link to="/login" className="auth-link">{t('registerPage', 'signIn')}</Link>
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
