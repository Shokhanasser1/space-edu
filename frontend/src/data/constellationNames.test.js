/**
 * Constellation names, and the rule about when to translate one.
 *
 * The sky view draws all 88 figures, so all 88 need a name a child can read.
 * Latin is the fallback rather than English because Latin is what Uzbek
 * astronomy writing uses, and because inventing an Uzbek name for Camelopardalis
 * would be making something up on a page whose whole point is that it does not.
 */
import { describe, expect, it } from 'vitest';

import { IAU_LATIN, constellationName } from './constellationNames';
import { figures, stars } from './skyCatalog';
import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

/** A stand-in for the real `t`, reading one locale file directly. */
const translator = (locale) => (section, key) =>
  key.split('.').reduce((node, part) => node?.[part], locale[section]) ?? `${section}.${key}`;

describe('every constellation the catalogue mentions has a name', () => {
  it('covers all 88', () => {
    expect(Object.keys(IAU_LATIN)).toHaveLength(88);
  });

  it('names every figure that gets drawn', () => {
    for (const figure of figures) {
      expect(IAU_LATIN[figure.abbreviation], figure.abbreviation).toBeTruthy();
    }
  });

  it('names the constellation of every star in the catalogue', () => {
    // Tap any star and it says which constellation it is in, so every
    // abbreviation in the star list needs an entry too -- not only the 88 with
    // figures.
    for (const abbreviation of new Set(stars.map((s) => s.constellation))) {
      if (!abbreviation) continue;
      expect(IAU_LATIN[abbreviation], abbreviation).toBeTruthy();
    }
  });
});

describe('choosing which name to show', () => {
  it('prefers the reader’s own language when there is one', () => {
    expect(constellationName('UMa', translator(ru))).toBe('Большая Медведица');
    expect(constellationName('UMa', translator(uz))).toBe('Yetti Qaroqchi');
    expect(constellationName('UMa', translator(en))).toBe('The Great Bear');
  });

  it('falls back to Latin, not to English, when a language has no name', () => {
    // Camelopardalis is deliberately untranslated in all three. A Russian
    // reader gets the Latin name rather than an English sentence.
    expect(constellationName('Cam', translator(ru))).toBe('Camelopardalis');
    expect(constellationName('Cam', translator(uz))).toBe('Camelopardalis');
  });

  it('gives back nothing for a star with no constellation', () => {
    expect(constellationName(null, translator(en))).toBeNull();
  });
});

describe('the translated names keep parity with each other', () => {
  const keysOf = (locale) => Object.keys(locale.skyView.constellations ?? {});

  it('translates the same constellations in all three languages', () => {
    // check-locales already enforces this globally; this says why it matters
    // here — a half-translated set means a Russian child sees Cyrillic for
    // Orion and Latin for Taurus in the same sentence.
    expect(keysOf(uz)).toEqual(keysOf(en));
    expect(keysOf(ru)).toEqual(keysOf(en));
  });

  it('only claims names for constellations that exist', () => {
    for (const abbreviation of keysOf(en)) {
      expect(IAU_LATIN[abbreviation], abbreviation).toBeTruthy();
    }
  });
});
