/**
 * The arithmetic under the Laboratory's H-R diagram.
 *
 * The axes run backwards and logarithmically, which is easy to get wrong in
 * one place and not the other; the catalogue is thirteen sets of numbers typed
 * by hand. The checks below hold both to things a reader can verify: the Sun
 * sits at 5772 K and one solar luminosity, a hotter star is further left, and
 * every star obeys the Stefan-Boltzmann law with the radius it is given.
 */
import { describe, expect, it } from 'vitest';

import {
  AXES,
  CLASS_MARKS,
  PLACEMENT_TOLERANCE,
  QUESTIONS,
  STARS,
  STAR_GROUPS,
  SUN_PATH,
  SUN_TEFF_K,
  backgroundStars,
  fractionToLum,
  fractionToTemp,
  judgePlacement,
  lightBandKey,
  lumToFraction,
  peakWavelengthNm,
  spectralClass,
  starGroup,
  starRadiusPx,
  stefanBoltzmannLuminosity,
  tempToFraction,
} from './hrDiagram';

const star = (id) => STARS.find((s) => s.id === id);

describe('the axes', () => {
  it('put hot stars on the left and bright stars at the top', () => {
    expect(tempToFraction(AXES.hotK)).toBeCloseTo(0, 12);
    expect(tempToFraction(AXES.coolK)).toBeCloseTo(1, 12);
    expect(lumToFraction(AXES.brightL)).toBeCloseTo(0, 12);
    expect(lumToFraction(AXES.dimL)).toBeCloseTo(1, 12);
    expect(tempToFraction(20000)).toBeLessThan(tempToFraction(3000));
    expect(lumToFraction(1000)).toBeLessThan(lumToFraction(0.01));
  });

  it('are logarithmic: every factor of ten in luminosity is the same height', () => {
    const step = lumToFraction(1) - lumToFraction(10);
    expect(lumToFraction(1000) - lumToFraction(10000)).toBeCloseTo(step, 12);
    expect(step).toBeCloseTo(0.1, 12);
  });

  it('invert exactly, so a tap reads back the temperature and luminosity under it', () => {
    for (const t of [3000, 5772, 25000]) expect(fractionToTemp(tempToFraction(t))).toBeCloseTo(t, 6);
    for (const l of [0.001, 1, 120000]) expect(fractionToLum(lumToFraction(l)) / l).toBeCloseTo(1, 9);
  });

  it('place the Sun at 5772 K and one solar luminosity', () => {
    const sun = star('sun');
    expect(sun.teffK).toBe(SUN_TEFF_K);
    expect(sun.lum).toBe(1);
    expect(lumToFraction(sun.lum)).toBeCloseTo(0.6, 12);
    expect(fractionToTemp(tempToFraction(sun.teffK))).toBeCloseTo(5772, 6);
  });
});

describe('the catalogue', () => {
  it('fits on the page', () => {
    for (const s of STARS) {
      expect(tempToFraction(s.teffK), s.id).toBeGreaterThan(0);
      expect(tempToFraction(s.teffK), s.id).toBeLessThan(1);
      expect(lumToFraction(s.lum), s.id).toBeGreaterThan(0);
      expect(lumToFraction(s.lum), s.id).toBeLessThan(1);
    }
  });

  it('obeys Stefan-Boltzmann for every star, to within 30 per cent', () => {
    // L = R^2 (T / 5772)^4 in solar units. A digit typed wrong in a radius or
    // a temperature breaks this by far more than 30 per cent.
    for (const s of STARS) {
      const ratio = stefanBoltzmannLuminosity(s.radius, s.teffK) / s.lum;
      expect(ratio, s.id).toBeGreaterThan(1 / 1.3);
      expect(ratio, s.id).toBeLessThan(1.3);
    }
  });

  it('gives the Sun exactly one solar luminosity from one radius and 5772 K', () => {
    expect(stefanBoltzmannLuminosity(1, 5772)).toBe(1);
  });

  it('agrees with its own spectral types', () => {
    // White dwarfs are class D whatever their temperature; everything else
    // should fall in the Harvard class its spectral type starts with.
    for (const s of STARS.filter((x) => !x.spectral.startsWith('D'))) {
      expect(spectralClass(s.teffK), s.id).toBe(s.spectral[0]);
    }
  });

  it('has a unique id and locale key for every star', () => {
    expect(new Set(STARS.map((s) => s.id)).size).toBe(STARS.length);
    expect(new Set(STARS.map((s) => s.nameKey)).size).toBe(STARS.length);
  });

  it('draws a white dwarf smaller than the Sun and the Sun smaller than a supergiant', () => {
    expect(starRadiusPx(star('siriusB').radius)).toBeLessThan(starRadiusPx(1));
    expect(starRadiusPx(1)).toBeLessThan(starRadiusPx(star('betelgeuse').radius));
  });
});

describe('spectral classes', () => {
  it('follow the Harvard boundaries', () => {
    expect(spectralClass(35000)).toBe('O');
    expect(spectralClass(12000)).toBe('B');
    expect(spectralClass(9000)).toBe('A');
    expect(spectralClass(6500)).toBe('F');
    expect(spectralClass(5772)).toBe('G');
    expect(spectralClass(4500)).toBe('K');
    expect(spectralClass(3000)).toBe('M');
  });

  it('put each letter on the bar inside its own class', () => {
    for (const mark of CLASS_MARKS) expect(spectralClass(mark.teffK)).toBe(mark.letter);
  });
});

describe('judging a placement', () => {
  const sirius = star('siriusA');

  it('accepts the exact spot and a near miss', () => {
    expect(judgePlacement(sirius, sirius.teffK, sirius.lum).correct).toBe(true);
    expect(judgePlacement(sirius, sirius.teffK * 1.1, sirius.lum * 2).correct).toBe(true);
  });

  it('refuses a tap outside the tolerance on either axis', () => {
    const tooHot = sirius.teffK * 10 ** (PLACEMENT_TOLERANCE.logT * 1.2);
    expect(judgePlacement(sirius, tooHot, sirius.lum).correct).toBe(false);
    const tooBright = sirius.lum * 10 ** (PLACEMENT_TOLERANCE.logL * 1.2);
    expect(judgePlacement(sirius, sirius.teffK, tooBright).correct).toBe(false);
  });

  it('says which way to move', () => {
    // Tapped at 20 000 K and 1000 Lsun: Sirius A is cooler and dimmer.
    expect(judgePlacement(sirius, 20000, 1000).hints).toEqual(['hrHintCooler', 'hrHintDimmer']);
    // Tapped at 5000 K and 0.1 Lsun: it is hotter and brighter.
    expect(judgePlacement(sirius, 5000, 0.1).hints).toEqual(['hrHintHotter', 'hrHintBrighter']);
  });

  it('always gives at least one hint when the answer is wrong', () => {
    for (let fx = 0; fx <= 1; fx += 0.05) {
      for (let fy = 0; fy <= 1; fy += 0.05) {
        const verdict = judgePlacement(sirius, fractionToTemp(fx), fractionToLum(fy));
        if (!verdict.correct) expect(verdict.hints.length).toBeGreaterThan(0);
        else expect(verdict.hints).toEqual([]);
      }
    }
  });

  it('can tell every pair of catalogue stars apart, bar one pair of real twins', () => {
    // If two stars sat inside each other's tolerance, one tap would be right
    // for both. That is only allowed where it is the truth: Sirius A and Vega
    // are both A-type main-sequence stars a few hundred kelvin and a factor of
    // 1.6 in brightness apart, and sharing a spot on the diagram is the lesson.
    const twins = new Set(['siriusA:vega', 'vega:siriusA']);
    for (const a of STARS) {
      for (const b of STARS) {
        if (a === b || twins.has(`${a.id}:${b.id}`)) continue;
        expect(judgePlacement(a, b.teffK, b.lum).correct, `${a.id} vs ${b.id}`).toBe(false);
      }
    }
  });
});

describe("the background and the Sun's path", () => {
  it('is the same background on every render', () => {
    expect(backgroundStars()).toEqual(backgroundStars());
  });

  it("starts the Sun's path at the Sun and ends it as a white dwarf below it", () => {
    expect(SUN_PATH[0]).toMatchObject({ teffK: 5772, lum: 1, mark: 'now' });
    const end = SUN_PATH[SUN_PATH.length - 1];
    expect(end.mark).toBe('dwarf');
    expect(end.lum).toBeLessThan(0.1);
    expect(end.teffK).toBeGreaterThan(5772);
    expect(SUN_PATH.find((p) => p.mark === 'giant').lum).toBeGreaterThan(1000);
  });
});

describe('the colour of starlight', () => {
  it('puts the Sun at 502 nm, in the middle of what eyes see', () => {
    expect(peakWavelengthNm(5772)).toBeCloseTo(502, 0);
    expect(lightBandKey(peakWavelengthNm(5772))).toBe('hrBandVisible');
  });

  it('puts a cool red supergiant in the infrared and a white dwarf in the ultraviolet', () => {
    expect(lightBandKey(peakWavelengthNm(star('betelgeuse').teffK))).toBe('hrBandIr');
    expect(lightBandKey(peakWavelengthNm(star('siriusB').teffK))).toBe('hrBandUv');
  });

  it('is shorter for a hotter star', () => {
    expect(peakWavelengthNm(10000)).toBeLessThan(peakWavelengthNm(3000));
  });
});

describe('distances and stories', () => {
  it('gives every star a distance and a story', () => {
    for (const s of STARS) {
      expect(s.distanceLy, s.id).toBeGreaterThan(0);
      expect(s.storyKey, s.id).toMatch(/^hrStory/);
    }
    expect(new Set(STARS.map((s) => s.storyKey)).size).toBe(STARS.length);
  });

  it('puts the Sun about 8.3 light-minutes away', () => {
    const minutes = star('sun').distanceLy * 365.25 * 24 * 60;
    expect(minutes).toBeGreaterThan(8.2);
    expect(minutes).toBeLessThan(8.4);
  });

  it('keeps Sirius A and B at one distance: they orbit each other', () => {
    expect(star('siriusA').distanceLy).toBe(star('siriusB').distanceLy);
  });
});

describe('groups and questions', () => {
  it('puts every star in one of the four groups, and every group has a star', () => {
    for (const s of STARS) expect(STAR_GROUPS, s.id).toContain(starGroup(s));
    for (const g of STAR_GROUPS) expect(STARS.some((s) => starGroup(s) === g), g).toBe(true);
  });

  it('counts a red dwarf as a main-sequence star', () => {
    expect(starGroup(star('proxima'))).toBe('main');
  });

  it('answers each question with the extreme of the whole catalogue', () => {
    const others = STARS.filter((s) => s.id !== 'sun');
    const biggest = [...STARS].sort((a, b) => b.radius - a.radius)[0];
    const hottest = [...STARS].sort((a, b) => b.teffK - a.teffK)[0];
    const nearest = [...others].sort((a, b) => a.distanceLy - b.distanceLy)[0];
    const answer = (id) => QUESTIONS.find((q) => q.id === id).answer;
    expect(answer('biggest')).toBe(biggest.id);
    expect(answer('hottest')).toBe(hottest.id);
    expect(answer('nearest')).toBe(nearest.id);
  });

  it('offers the answer among four real catalogue stars', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      for (const id of q.options) expect(star(id), `${q.id}: ${id}`).toBeTruthy();
    }
  });

  it('can explain a wrong pick with the number the question is about', () => {
    for (const q of QUESTIONS) {
      for (const id of q.options) expect(typeof star(id)[q.measure], `${q.id}: ${id}`).toBe('number');
    }
  });
});
