/**
 * The arithmetic under the Laboratory's Moon module.
 *
 * Checked against what a reader can look up or see for themselves: no Moon at
 * new moon, half a Moon at the quarters, a whole one at full; the eclipses of
 * 7 September 2025 (total lunar) and 6 February 2027 (annular solar) are where
 * every almanac puts them; and the node geometry says "eclipse possible" in
 * the months those eclipses happened and not in a month without one.
 */
import { describe, expect, it } from 'vitest';

import {
  NODE_STEP_PER_MONTH_DEG,
  SIDEREAL_MONTH_DAYS,
  SYNODIC_MONTH_DAYS,
  daysToFull,
  daysToNew,
  distanceFromNodeDeg,
  eclipseNow,
  eclipsesThisMonth,
  illuminatedFraction,
  isWaxing,
  moonAgeAt,
  moonLatitudeDeg,
  moonStateAt,
  nextEclipses,
  nextUmbralLunarEclipse,
  phaseCenterAge,
  phaseKey,
  sunNodeAngleAtNewMoon,
  visibilityKey,
  wrap360,
} from './moonPhases';

describe('the phase cycle', () => {
  it('shows no Moon at new moon and a whole one at full', () => {
    expect(illuminatedFraction(0)).toBeCloseTo(0, 9);
    expect(illuminatedFraction(SYNODIC_MONTH_DAYS / 2)).toBeCloseTo(1, 9);
  });

  it('shows half a Moon at both quarters', () => {
    expect(illuminatedFraction(SYNODIC_MONTH_DAYS / 4)).toBeCloseTo(0.5, 9);
    expect(illuminatedFraction((3 * SYNODIC_MONTH_DAYS) / 4)).toBeCloseTo(0.5, 9);
  });

  it('names the phases in order through the month', () => {
    expect(phaseKey(0)).toBe('moonPhaseNew');
    expect(phaseKey(3.7)).toBe('moonPhaseWaxingCrescent');
    expect(phaseKey(7.38)).toBe('moonPhaseFirstQuarter');
    expect(phaseKey(11)).toBe('moonPhaseWaxingGibbous');
    expect(phaseKey(14.77)).toBe('moonPhaseFull');
    expect(phaseKey(18.5)).toBe('moonPhaseWaningGibbous');
    expect(phaseKey(22.15)).toBe('moonPhaseLastQuarter');
    expect(phaseKey(25.8)).toBe('moonPhaseWaningCrescent');
    expect(phaseKey(29.3)).toBe('moonPhaseNew');
    for (let i = 0; i < 8; i += 1) expect(phaseKey(phaseCenterAge(i))).toBe(
      ['moonPhaseNew', 'moonPhaseWaxingCrescent', 'moonPhaseFirstQuarter', 'moonPhaseWaxingGibbous',
        'moonPhaseFull', 'moonPhaseWaningGibbous', 'moonPhaseLastQuarter', 'moonPhaseWaningCrescent'][i],
    );
  });

  it('waxes for the first half and wanes for the second', () => {
    expect(isWaxing(5)).toBe(true);
    expect(isWaxing(20)).toBe(false);
  });

  it('counts down to full and new', () => {
    expect(daysToFull(10)).toBeCloseTo(SYNODIC_MONTH_DAYS / 2 - 10, 9);
    expect(daysToFull(20)).toBeCloseTo(SYNODIC_MONTH_DAYS - 20 + SYNODIC_MONTH_DAYS / 2, 9);
    expect(daysToNew(20)).toBeCloseTo(SYNODIC_MONTH_DAYS - 20, 9);
  });

  it('makes the phase month about 2.2 days longer than one trip among the stars', () => {
    expect(SYNODIC_MONTH_DAYS - SIDEREAL_MONTH_DAYS).toBeGreaterThan(2.1);
    expect(SYNODIC_MONTH_DAYS - SIDEREAL_MONTH_DAYS).toBeLessThan(2.3);
  });
});

describe('when the Moon can be seen', () => {
  it('follows its angle from the Sun', () => {
    expect(visibilityKey(0.3)).toBe('moonSeeNone');
    expect(visibilityKey(29.3)).toBe('moonSeeNone');
    // First quarter is high at sunset; full rises as the Sun sets; last quarter is a morning Moon.
    expect(visibilityKey(SYNODIC_MONTH_DAYS / 4)).toBe('moonSeeEvening');
    expect(visibilityKey(10)).toBe('moonSeeEveningNight');
    expect(visibilityKey(SYNODIC_MONTH_DAYS / 2)).toBe('moonSeeAllNight');
    expect(visibilityKey(18.5)).toBe('moonSeeNightMorning');
    expect(visibilityKey((3 * SYNODIC_MONTH_DAYS) / 4)).toBe('moonSeeMorning');
  });
});

describe('the tilted orbit', () => {
  it('moves the Sun about 30.7 degrees against the nodes each month', () => {
    expect(NODE_STEP_PER_MONTH_DEG).toBeGreaterThan(30.6);
    expect(NODE_STEP_PER_MONTH_DEG).toBeLessThan(30.8);
  });

  it('never takes the Moon more than the inclination from the ecliptic', () => {
    for (let age = 0; age < SYNODIC_MONTH_DAYS; age += 0.5) {
      expect(Math.abs(moonLatitudeDeg(40, age))).toBeLessThanOrEqual(5.145 + 1e-9);
    }
    expect(moonLatitudeDeg(0, 0)).toBeCloseTo(0, 9);
  });

  it('measures distance to the nearer node', () => {
    expect(distanceFromNodeDeg(10)).toBe(10);
    expect(distanceFromNodeDeg(175)).toBe(5);
    expect(distanceFromNodeDeg(350)).toBe(10);
  });

  it('allows eclipses only near a node, and every month if the orbit were flat', () => {
    // The Sun moves about 15 degrees against the node between new and full, so
    // a lunation that starts 6 degrees before a node has both, 9 degrees after.
    expect(eclipsesThisMonth(354)).toEqual({ solar: true, lunar: true });
    // Starting 5 degrees past it, the full moon is 20 degrees out: solar only.
    expect(eclipsesThisMonth(5)).toEqual({ solar: true, lunar: false });
    expect(eclipsesThisMonth(90)).toEqual({ solar: false, lunar: false });
    expect(eclipsesThisMonth(90, 0)).toEqual({ solar: true, lunar: true });
    expect(eclipseNow(0.2, 354)).toBe('solar');
    expect(eclipseNow(SYNODIC_MONTH_DAYS / 2, 354)).toBe('lunar');
    expect(eclipseNow(7, 354)).toBeNull();
  });

  it('judges the last day of a lunation by the coming new moon, not the last one', () => {
    // The lunation began 28.7 degrees from a node — no eclipse then — but a
    // month of drift later the next new moon falls 2 degrees from it.
    const sigma = wrap360(2 - NODE_STEP_PER_MONTH_DEG);
    expect(eclipsesThisMonth(sigma).solar).toBe(false);
    expect(eclipseNow(SYNODIC_MONTH_DAYS - 0.3, sigma)).toBe('solar');
    expect(eclipseNow(SYNODIC_MONTH_DAYS - 0.3, 90)).toBeNull();
  });
});

describe('real dates, from astronomy-engine', () => {
  it('finds the total lunar eclipse of 7 September 2025', () => {
    const { lunar } = nextEclipses(new Date('2025-08-25T00:00:00Z'));
    expect(lunar.kind).toBe('total');
    expect(lunar.date.toISOString().slice(0, 10)).toBe('2025-09-07');
  });

  it('finds the annular solar eclipse of 6 February 2027', () => {
    const { solar } = nextEclipses(new Date('2027-01-01T00:00:00Z'));
    expect(solar.kind).toBe('annular');
    expect(solar.date.toISOString().slice(0, 10)).toBe('2027-02-06');
  });

  it('gives the Moon its real age', () => {
    // Full moon of 7 September 2025 (the eclipse above): about half a month old.
    const age = moonAgeAt(new Date('2025-09-07T18:00:00Z'));
    expect(Math.abs(age - SYNODIC_MONTH_DAYS / 2)).toBeLessThan(0.5);
  });

  it('skips faint penumbral eclipses when asked for one that reaches the umbra', () => {
    // After 21 October 2026 come three penumbral eclipses (20 Feb, 18 Jul and
    // 17 Aug 2027); the first partial one is on 12 January 2028.
    const next = nextUmbralLunarEclipse(new Date('2026-10-21T00:00:00Z'));
    expect(next.kind).toBe('partial');
    expect(next.date.toISOString().slice(0, 10)).toBe('2028-01-12');
  });

  it('shows every real eclipse as one, whether the Moon is a day old or a day short of new', () => {
    // 8 April 2024 falls at age 29.53: the state rolls over to the coming lunation.
    for (const iso of ['2024-04-08T18:17:00Z', '2027-02-06T16:00:00Z']) {
      const state = moonStateAt(new Date(iso));
      expect(state.age).toBeLessThan(1);
      expect(eclipseNow(state.age, state.sigma)).toBe('solar');
    }
    const lunar = moonStateAt(new Date('2025-09-07T18:12:00Z'));
    expect(eclipseNow(lunar.age, lunar.sigma)).toBe('lunar');
  });

  it('puts the Sun near a node in eclipse months and not otherwise', () => {
    const eclipseMonth = sunNodeAngleAtNewMoon(new Date('2025-09-07T18:00:00Z'));
    expect(eclipsesThisMonth(eclipseMonth).lunar).toBe(true);
    const solarMonth = sunNodeAngleAtNewMoon(new Date('2027-02-06T16:00:00Z'));
    expect(eclipsesThisMonth(solarMonth).solar).toBe(true);
    // Mid-way between the two eclipse seasons of 2025: no eclipse of either kind.
    const quiet = sunNodeAngleAtNewMoon(new Date('2025-12-05T00:00:00Z'));
    expect(eclipsesThisMonth(quiet)).toEqual({ solar: false, lunar: false });
  });
});
