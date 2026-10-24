import { useTranslation } from '@/hooks/useTranslation';

/**
 * Each simulator keeps its own words in a TEXT table next to its code:
 *
 *   const TEXT = { uz: { ... }, ru: { ... }, en: { ... } };
 *   const T = useSimText(TEXT);
 *
 * and gets the reader's language, Uzbek as the fallback. Units are words too
 * (m / м, s / с) and live in the same table - `UNITS` below has the common
 * ones so a simulator need not repeat them.
 */

export const SIM_LANGS = ['uz', 'ru', 'en'];

/** 'uz' | 'ru' | 'en' for the page's current language. */
export function useSimLang() {
  const { i18n } = useTranslation();
  const code = String(i18n?.language || 'uz').slice(0, 2).toLowerCase();
  return SIM_LANGS.includes(code) ? code : 'uz';
}

/** The simulator's text in the reader's language, with the shared units merged in. */
export function useSimText(table) {
  const lang = useSimLang();
  return { ...UNITS[lang], ...(table[lang] || table.uz), lang };
}

/**
 * Common units and the decimal mark, per language. Uzbek keeps the point, as
 * the chosen lesson-1 design (variant A) does; Russian uses the comma.
 */
export const UNITS = {
  uz: { decimal: '.', m: 'm', s: 's', ms: 'm/s', ms2: 'm/s²', kmh: 'km/soat', km: 'km', h: 'soat', rad: 'rad', rads: 'rad/s', hz: 'Hz', deg: '°' },
  ru: { decimal: ',', m: 'м', s: 'с', ms: 'м/с', ms2: 'м/с²', kmh: 'км/ч', km: 'км', h: 'ч', rad: 'рад', rads: 'рад/с', hz: 'Гц', deg: '°' },
  en: { decimal: '.', m: 'm', s: 's', ms: 'm/s', ms2: 'm/s²', kmh: 'km/h', km: 'km', h: 'h', rad: 'rad', rads: 'rad/s', hz: 'Hz', deg: '°' },
};
