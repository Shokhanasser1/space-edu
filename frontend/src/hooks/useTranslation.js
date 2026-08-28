import { useUserStore } from '@/store/useUserStore';
import { translations } from '@/i18n/translations';

/** `{name}` and `{{name}}` become `vars.name`; an unknown name is left as is. */
export function interpolate(text, vars) {
  if (!vars || typeof text !== 'string') return text;
  return text.replace(/\{\{?\s*(\w+)\s*\}?\}/g, (match, name) => (
    name in vars ? String(vars[name]) : match
  ));
}

export function useTranslation() {
  const { language } = useUserStore();

  // `vars` fills `{name}` / `{{name}}` placeholders in the string. It was
  // accepted and ignored: CreativityTopicView passed `{ name }` and a child
  // read "Изучите инженерные и дизайнерские принципы {name}." on screen.
  const t = (section, key, vars) => {
    const langData = translations[language] || translations.ENG;
    const sectionData = langData[section];
    
    if (!sectionData) return `${section}.${key}`;

    const getNested = (obj, path) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    // An empty string is a translation, not a missing one. `if (value)` treated
    // the two the same, so `loginPage.welcomeHighlight: ""` — deliberately
    // empty, because Russian says "С возвращением" in one word where English
    // splits "Welcome Back" across two — fell through to the English half and
    // the sign-in screen read "С возвращением Back".
    const value = getNested(sectionData, key);
    if (value !== undefined && value !== null) return interpolate(value, vars);

    // Fallback to English
    const fallbackSection = translations.ENG[section];
    if (fallbackSection) {
      const fallbackValue = getNested(fallbackSection, key);
      if (fallbackValue !== undefined && fallbackValue !== null) return interpolate(fallbackValue, vars);
    }

    return `${section}.${key}`;
  };

  // i18n.language returns ISO codes ('en', 'ru', 'uz') for compatibility
  const LANG_ISO = { ENG: 'en', RUS: 'ru', UZB: 'uz' };
  const i18n = { language: LANG_ISO[language] || 'uz' };

  return { t, language, i18n };
}
