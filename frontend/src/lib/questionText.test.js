/**
 * 27 Aug 2026: a Russian page showed a Russian question over four Uzbek
 * answers. The question had `question_ru`; the options had nothing.
 */
import { describe, expect, it } from 'vitest';

import { explanationText, langCode, questionOptions, questionText } from './questionText';

const q = {
  question: 'Tezlik nima?', question_en: 'What is velocity?', question_ru: 'Что такое скорость?',
  options: ['a', 'b', 'c', 'd'],
  options_en: ['a-en', 'b-en', 'c-en', 'd-en'],
  options_ru: ['a-ru', 'b-ru', 'c-ru', 'd-ru'],
  explanation: 'Tezlik — yo\'lning vaqtga nisbati.',
  explanation_en: 'Velocity is distance over time.',
  explanation_ru: 'Скорость — это путь, делённый на время.',
};

describe('questionText', () => {
  it('reads the question in the reader language, Uzbek otherwise', () => {
    expect(questionText(q, 'ru')).toBe('Что такое скорость?');
    expect(questionText(q, 'en')).toBe('What is velocity?');
    expect(questionText(q, 'uz')).toBe('Tezlik nima?');
    expect(questionText({ ...q, question_ru: '' }, 'ru')).toBe('Tezlik nima?');
    expect(questionText(null, 'ru')).toBe('');
  });
});

describe('questionOptions', () => {
  it('reads the options in the reader language, in the same order', () => {
    expect(questionOptions(q, 'ru')).toEqual(['a-ru', 'b-ru', 'c-ru', 'd-ru']);
    expect(questionOptions(q, 'en')).toEqual(['a-en', 'b-en', 'c-en', 'd-en']);
    expect(questionOptions(q, 'uz')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('falls back to the originals when the translation is missing or does not line up', () => {
    // `correct_answer` is an index: a shorter or partly blank translation
    // would move the right answer under another letter.
    expect(questionOptions({ ...q, options_ru: [] }, 'ru')).toEqual(['a', 'b', 'c', 'd']);
    expect(questionOptions({ ...q, options_ru: ['x', 'y', 'z'] }, 'ru')).toEqual(['a', 'b', 'c', 'd']);
    expect(questionOptions({ ...q, options_ru: ['x', '', 'z', 'w'] }, 'ru')).toEqual(['a', 'b', 'c', 'd']);
    expect(questionOptions({ ...q, options_ru: undefined }, 'ru')).toEqual(['a', 'b', 'c', 'd']);
    expect(questionOptions({ options: 'not a list' }, 'ru')).toEqual([]);
  });
});

describe('explanationText', () => {
  it('reads the explanation in the reader language, Uzbek otherwise', () => {
    expect(explanationText(q, 'ru')).toBe('Скорость — это путь, делённый на время.');
    expect(explanationText(q, 'en')).toBe('Velocity is distance over time.');
    expect(explanationText(q, 'uz')).toBe("Tezlik — yo'lning vaqtga nisbati.");
    expect(explanationText({ ...q, explanation_en: '' }, 'en')).toBe("Tezlik — yo'lning vaqtga nisbati.");
    expect(explanationText(null, 'en')).toBe('');
  });
});

describe('langCode', () => {
  /*
   * The daily challenge passed the store value straight in. 'ENG' is not a key
   * of the suffix table, so every lookup missed and every question rendered in
   * Uzbek — on an English page, the day after the translations shipped.
   */
  it('turns the store language into the ISO code the helpers want', () => {
    expect(langCode('ENG')).toBe('en');
    expect(langCode('RUS')).toBe('ru');
    expect(langCode('UZB')).toBe('uz');
  });

  it('falls back to Uzbek for anything it does not know', () => {
    expect(langCode(undefined)).toBe('uz');
    expect(langCode('en')).toBe('uz');
  });
});
