/**
 * Client-side checks for the registration form.
 *
 * These are for the person typing, not for safety: the server runs Django's
 * validators on every request regardless, and is the only authority. What is
 * here is the cheap subset that saves a round trip — a blank box, a date in
 * the future, a password of eight digits — phrased as translation keys in
 * `registerPage` so the screen can say it in the reader's language.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Which step of the wizard shows which field. */
export const STEP_OF_FIELD = {
  first_name: 1,
  last_name: 1,
  date_of_birth: 1,
  email: 2,
  password: 2,
  password2: 2,
};

export const STEP_FIELDS = {
  1: ['first_name', 'last_name', 'date_of_birth'],
  2: ['email', 'password', 'password2'],
};

export function validateName(value) {
  return String(value ?? '').trim() ? null : 'required';
}

export function validateEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'required';
  return EMAIL_RE.test(v) ? null : 'invalidEmail';
}

/**
 * @param {string} value  yyyy-mm-dd, as a date input gives it.
 * @param {Date} [today]
 */
export function validateDob(value, today = new Date()) {
  if (!value) return 'required';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'dobInvalid';
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date >= midnight) return 'dobFuture';
  if (today.getFullYear() - date.getFullYear() > 120) return 'dobInvalid';
  return null;
}

export function validatePassword(value) {
  const v = String(value ?? '');
  if (!v) return 'required';
  // Mirrors the two Django validators a child hits most: MinimumLength(8)
  // and NumericPassword. The common-password list stays on the server.
  if (v.length < 8) return 'tooShort';
  if (/^\d+$/.test(v)) return 'allDigits';
  return null;
}

export function validatePassword2(value, password) {
  if (!value) return 'required';
  return value === password ? null : 'passwordsDoNotMatch';
}

/** One field against the whole form. Returns a `registerPage` key or null. */
export function validateField(name, form) {
  switch (name) {
    case 'first_name':
    case 'last_name':
      return validateName(form[name]);
    case 'email':
      return validateEmail(form.email);
    case 'date_of_birth':
      return validateDob(form.date_of_birth);
    case 'password':
      return validatePassword(form.password);
    case 'password2':
      return validatePassword2(form.password2, form.password);
    default:
      return null;
  }
}

/** `{ field: key }` for every field in `fields` that fails; empty when all pass. */
export function validateFields(fields, form) {
  const errors = {};
  for (const name of fields) {
    const key = validateField(name, form);
    if (key) errors[name] = key;
  }
  return errors;
}

/**
 * 0 (empty) to 4 (strong). Deliberately simple and explainable to a
 * ten-year-old: longer is better, mixing letters with digits or symbols is
 * better, and eight digits on their own are weak however many there are.
 */
export function scorePassword(password) {
  const pw = String(password ?? '');
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  const hasLetter = /\p{L}/u.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^\p{L}\d]/u.test(pw);
  const mixedCase = /\p{Ll}/u.test(pw) && /\p{Lu}/u.test(pw);
  const classes = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes < 2) return 1;
  if (pw.length >= 14 && (mixedCase || hasSymbol)) return 4;
  if (pw.length >= 12 || (mixedCase && hasSymbol)) return 3;
  return 2;
}
