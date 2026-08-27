/**
 * 27 Aug 2026: a Russian page showed a Russian question over four Uzbek
 * answers. The question had `question_ru`; the options had nothing.
 */
import { describe, expect, it } from 'vitest';

import { questionOptions, questionText } from './questionText';

const q = {
  question: 'Tezlik nima?', question_en: 'What is velocity?', question_ru: 'Что такое скорость?',
  options: ['a', 'b', 'c', 'd'],
  options_en: ['a-en', 'b-en', 'c-en', 'd-en'],
  options_ru: ['a-ru', 'b-ru', 'c-ru', 'd-ru'],
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
