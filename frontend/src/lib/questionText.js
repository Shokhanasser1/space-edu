/**
 * A quiz question in the reader's language.
 *
 * The API sends the Uzbek original in `question` / `options` and the
 * translations beside it as `question_en`, `question_ru`, `options_en`,
 * `options_ru`. Uzbek is the fallback for anything left blank.
 */

const SUFFIX = { en: '_en', ru: '_ru' };

export function questionText(question, lang) {
  if (!question) return '';
  const suffix = SUFFIX[lang];
  return (suffix && question[`question${suffix}`]) || question.question || '';
}

/**
 * `correct_answer` is an index into `options`, so a translation is only
 * usable when it is the same list in another language: same length, every
 * entry filled. Anything else and the originals are shown instead.
 */
export function questionOptions(question, lang) {
  const original = Array.isArray(question?.options) ? question.options : [];
  const suffix = SUFFIX[lang];
  const translated = suffix ? question?.[`options${suffix}`] : null;
  const usable =
    Array.isArray(translated) &&
    translated.length === original.length &&
    translated.every((option) => String(option ?? '').trim());
  return usable ? translated : original;
}
