/**
 * The life of a star, checked against figures a reader can look up.
 *
 * The Sun lives about ten billion years on the main sequence, a 2 M☉ star
 * about one billion, a 15 M☉ star about ten million and a 60 M☉ star a few
 * million; a red dwarf outlives the present universe many times over. The Sun
 * ends as a white dwarf, not a black hole — the one thing the old module got
 * wrong for every star it drew.
 */
import { describe, expect, it } from 'vitest';

import {
  CLASS_COLOUR,
  MASS_RANGE,
  UNIVERSE_AGE_YEARS,
  fateOf,
  lifeStages,
  mainSequenceLifetimeYears,
  mainSequenceLuminosity,
  massFromSlider,
  outlivesUniverse,
  simpleLifetimeYears,
  sliderFromMass,
  spectralClass,
  splitYears,
} from './stellarEvolution';

const between = (value, lo, hi) => {
  expect(value).toBeGreaterThanOrEqual(lo);
  expect(value).toBeLessThanOrEqual(hi);
};

describe('main-sequence lifetime', () => {
  it('gives the Sun about ten billion years', () => {
    between(mainSequenceLifetimeYears(1), 9e9, 12e9);
  });

  it('matches the usual figures across the mass range', () => {
    between(mainSequenceLifetimeYears(2), 0.8e9, 1.5e9);
    between(mainSequenceLifetimeYears(5), 80e6, 130e6);
    between(mainSequenceLifetimeYears(15), 9e6, 15e6);
    between(mainSequenceLifetimeYears(30), 4e6, 8e6);
    between(mainSequenceLifetimeYears(60), 3e6, 5e6);
  });

  it('gives a red dwarf like Proxima Centauri over a trillion years', () => {
    expect(mainSequenceLifetimeYears(0.12)).toBeGreaterThan(1e12);
  });

  it('always shortens as the star gets heavier', () => {
    let previous = Infinity;
    for (let m = MASS_RANGE.min; m <= MASS_RANGE.max; m *= 1.1) {
      const t = mainSequenceLifetimeYears(m);
      expect(t).toBeLessThan(previous);
      previous = t;
    }
  });

  it('agrees with the classroom rule near the Sun and not for the heaviest stars', () => {
    const near = mainSequenceLifetimeYears(1) / simpleLifetimeYears(1);
    between(near, 0.8, 1.25);
    // The rule makes a 30 M☉ star die about three times too young.
    expect(mainSequenceLifetimeYears(30) / simpleLifetimeYears(30)).toBeGreaterThan(2);
  });
});

describe('what the star looks like on the main sequence', () => {
  it('puts the Sun at one solar luminosity, class G', () => {
    expect(mainSequenceLuminosity(1)).toBeCloseTo(1, 9);
    expect(spectralClass(1)).toBe('G');
  });

  it('makes a red dwarf dim and red, a heavy star bright and blue', () => {
    expect(mainSequenceLuminosity(0.12)).toBeLessThan(0.01);
    expect(spectralClass(0.12)).toBe('M');
    expect(mainSequenceLuminosity(15)).toBeGreaterThan(1e4);
    expect(spectralClass(15)).toBe('B');
    expect(spectralClass(30)).toBe('O');
  });

  it('has a colour for every class', () => {
    for (const cls of ['O', 'B', 'A', 'F', 'G', 'K', 'M']) expect(CLASS_COLOUR[cls]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('how it ends', () => {
  it('turns the Sun into a white dwarf through a red giant and a planetary nebula', () => {
    expect(fateOf(1)).toBe('whiteDwarf');
    expect(lifeStages(1)).toEqual(['nebula', 'mainSequence', 'redGiant', 'planetaryNebula', 'whiteDwarf']);
  });

  it('never makes the Sun a black hole', () => {
    expect(lifeStages(1)).not.toContain('blackHole');
    expect(lifeStages(1)).not.toContain('supernova');
  });

  it('makes a massive star a neutron star and a very massive one a black hole', () => {
    expect(lifeStages(15)).toEqual(['nebula', 'mainSequence', 'redSupergiant', 'supernova', 'neutronStar']);
    expect(lifeStages(30).at(-1)).toBe('blackHole');
  });

  it('lets a red dwarf skip the giant stages', () => {
    expect(lifeStages(0.12)).toEqual(['nebula', 'mainSequence', 'whiteDwarf']);
  });

  it('knows which stars no one has seen die yet', () => {
    expect(outlivesUniverse(0.12)).toBe(true);
    expect(outlivesUniverse(0.8)).toBe(true);
    expect(outlivesUniverse(1)).toBe(false);
    expect(mainSequenceLifetimeYears(1)).toBeLessThan(UNIVERSE_AGE_YEARS);
  });
});

describe('the helpers the page uses', () => {
  it('writes durations with two significant figures', () => {
    expect(splitYears(1.1e10)).toEqual({ value: '11', unit: 'Billion' });
    expect(splitYears(1.234e7)).toEqual({ value: '12', unit: 'Million' });
    expect(splitYears(2.67e12)).toEqual({ value: '2.7', unit: 'Trillion' });
    expect(splitYears(5.8e6)).toEqual({ value: '5.8', unit: 'Million' });
  });

  it('maps the slider logarithmically and back', () => {
    expect(massFromSlider(0)).toBeCloseTo(MASS_RANGE.min, 9);
    expect(massFromSlider(1)).toBeCloseTo(MASS_RANGE.max, 9);
    expect(massFromSlider(sliderFromMass(1))).toBeCloseTo(1, 9);
  });
});
