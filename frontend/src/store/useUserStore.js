import { create } from "zustand";
import { persist } from "zustand/middleware";

function normalizeLanguage(lang) {
  const value = String(lang || "").trim().toUpperCase();
  if (value === "UZ" || value === "UZB") return "UZB";
  if (value === "RU" || value === "RUS") return "RUS";
  if (value === "EN" || value === "ENG") return "ENG";
  return detectBrowserLanguage();
}

function detectBrowserLanguage() {
  try {
    const lang = (navigator.language || '').toLowerCase();
    if (lang.startsWith('uz')) return 'UZB';
    if (lang.startsWith('ru')) return 'RUS';
  } catch {
    // SSR / no navigator
  }
  return 'ENG';
}

export const useUserStore = create()(
  persist(
    (set) => ({
      completedLessons: [],
      quizScores: {},
      achievements: [],
      astronautName: "",
      spaceship: "Explorer I",
      language: detectBrowserLanguage(),

      setLanguage:      (lang)       => set({ language: normalizeLanguage(lang) }),
      setAstronautName: (name)       => set({ astronautName: name }),
      setSpaceship:     (spaceship)  => set({ spaceship }),

      completeLesson: (lessonId) =>
        set((s) => ({
          completedLessons: s.completedLessons.includes(lessonId)
            ? s.completedLessons
            : [...s.completedLessons, lessonId],
        })),

      saveQuizScore: (quizId, score) =>
        set((s) => ({ quizScores: { ...s.quizScores, [quizId]: score } })),

      unlockAchievement: (id) =>
        set((s) => ({
          achievements: s.achievements.includes(id)
            ? s.achievements
            : [...s.achievements, id],
        })),

      // Called when a session starts or ends, to make sure one pupil's work is
      // never shown to the next. `language` is deliberately *not* in here: it is
      // a preference, not somebody's progress, and resetting it to 'ENG' meant
      // a child who chose Uzbek or Russian, filled in the sign-up form in it and
      // pressed the button was answered by an English site — every sign-in and
      // every sign-out, on a product for Uzbek schoolchildren whose default
      // should never have been English in the first place.
      resetProgress: () =>
        set({ completedLessons: [], quizScores: {}, achievements: [], astronautName: "" }),
    }),
    { name: "uz-cosmos-storage" },
  ),
);

/**
 * `<html lang>` follows the site language.
 *
 * index.html used to read `localStorage["i18nextLng"]` — a key nothing here
 * ever wrote — so the attribute stayed "en" on a Russian or Uzbek page.
 * Screen readers pick their voice by it, browsers offer translation by it,
 * and CSS `:lang()` and hyphenation read it; on every page it named the
 * wrong language. Found in a browser, 28 Aug 2026.
 */
const HTML_LANG = { ENG: "en", RUS: "ru", UZB: "uz" };

export function mirrorLanguageToDocument(language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = HTML_LANG[language] || "en";
}

mirrorLanguageToDocument(useUserStore.getState().language);
useUserStore.subscribe((state, previous) => {
  if (state.language !== previous.language) mirrorLanguageToDocument(state.language);
});
