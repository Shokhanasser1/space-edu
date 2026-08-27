/**
 * A quiz question in the reader's language.
 *
 * The API sends the Uzbek original in `question` / `options` / `explanation`
 * and the translations beside them as `question_en`, `question_ru`,
 * `options_en`, `options_ru`, `explanation_en`, `explanation_ru`. Uzbek is the
 * fallback for anything left blank.
 *
 * The `lang` these take is an ISO code — 'en', 'ru' or 'uz'. The store speaks
 * 'ENG' / 'RUS' / 'UZB', and handing one of those straight in is a silent miss
 * that falls all the way back to Uzbek. That is exactly what the daily
 * challenge did for a day: an English page, translated questions in the
 * payload, and Uzbek on the screen. Convert with `langCode()`.
 */

const SUFFIX = { en: '_en', ru: '_ru' };

const ISO = { ENG: 'en', RUS: 'ru', UZB: 'uz' };

/** The store's language ('ENG' / 'RUS' / 'UZB') as the ISO code these want. */
export function langCode(storeLanguage) {
  return ISO[storeLanguage] || 'uz';
}

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

/**
 * Why the right answer is the right answer, in the reader's language.
 *
 * Only ever present on the submit response — the server keeps it out of
 * anything a child can read before they have answered, because it names the
 * answer in the course of teaching it.
 */
export function explanationText(question, lang) {
  if (!question) return '';
  const suffix = SUFFIX[lang];
  return (suffix && question[`explanation${suffix}`]) || question.explanation || '';
}
