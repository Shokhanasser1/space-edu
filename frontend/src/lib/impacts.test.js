/**
 * The arithmetic under the Laboratory's crater module.
 *
 * Checked against figures a reader can look up: a megaton is 4.184e15 J, a
 * 50 m iron sphere weighs about half a million tonnes, and the case that made
 * Meteor Crater (about 1.2 km) comes out in the right range from the Collins,
 * Melosh & Marcus scaling law — about 1.5 km, which is what the page reports.
 */
import { describe, expect, it } from 'vitest';

import {
  BODIES,
  GIANT_CRATER_M,
  GOOD_GUESS_FACTOR,
  IMPACT_PRESETS,
  JOULES_PER_MEGATON,
  METEOR_CRATER,
  TASHKENT_WIDTH_M,
  craterDepthAt,
  finalCrater,
  guessFactor,
  impactorMass,
  kineticEnergy,
  megatons,
  sameImpactor,
  simulateImpact,
  transientCraterDiameter,
} from './impacts';

const meteor = simulateImpact(METEOR_CRATER);

describe('energy', () => {
  it('weighs a 50 m iron sphere at about 5.1e8 kg', () => {
    expect(impactorMass(50, 7800)).toBeCloseTo(7800 * (Math.PI / 6) * 125000, 3);
    expect(impactorMass(50, 7800) / 1e8).toBeCloseTo(5.105, 2);
  });

  it('is one half m v squared', () => {
    expect(kineticEnergy(2, 1)).toBeCloseTo(1e6, 6);
  });

  it('converts to TNT at 4.184e15 J per megaton', () => {
    expect(megatons(JOULES_PER_MEGATON)).toBe(1);
    expect(megatons(4.184e12)).toBeCloseTo(0.001, 12);
  });

  it('gives the Meteor Crater impactor about ten megatons', () => {
    expect(meteor.megatons).toBeGreaterThan(9);
    expect(meteor.megatons).toBeLessThan(11);
  });
});

describe('crater size', () => {
  it('puts the Meteor Crater case between 1 and 2 km, as a simple crater', () => {
    expect(meteor.diameterM).toBeGreaterThan(1000);
    expect(meteor.diameterM).toBeLessThan(2000);
    expect(meteor.complex).toBe(false);
  });

  it('is within a factor of 1.5 of the real Meteor Crater', () => {
    expect(guessFactor(meteor.diameterM, METEOR_CRATER.realDiameterM)).toBeLessThan(1.5);
  });

  it('grows with speed and with the impactor', () => {
    const slow = transientCraterDiameter({ ...METEOR_CRATER, speedKms: 12 });
    const fast = transientCraterDiameter({ ...METEOR_CRATER, speedKms: 30 });
    expect(fast).toBeGreaterThan(slow);
    expect(transientCraterDiameter({ ...METEOR_CRATER, diameterM: 100 })).toBeGreaterThan(
      transientCraterDiameter(METEOR_CRATER),
    );
    expect(transientCraterDiameter({ ...METEOR_CRATER, composition: 'ice' })).toBeLessThan(
      transientCraterDiameter(METEOR_CRATER),
    );
  });

  it('is bigger on the Moon, where gravity is weaker', () => {
    const earth = transientCraterDiameter(METEOR_CRATER);
    const moon = transientCraterDiameter({ ...METEOR_CRATER, body: 'moon' });
    expect(moon).toBeGreaterThan(earth * 1.4);
  });

  it('is biggest for a vertical impact', () => {
    const steep = transientCraterDiameter({ ...METEOR_CRATER, angleDeg: 90 });
    const shallow = transientCraterDiameter({ ...METEOR_CRATER, angleDeg: 20 });
    expect(steep).toBeGreaterThan(shallow);
  });
});

describe('simple and complex craters', () => {
  it('turns complex above 3.2 km on Earth', () => {
    const justBelow = 3199 / 1.25;
    const justAbove = 3201 / 1.25;
    expect(finalCrater(justBelow, 'earth')).toEqual({ diameterM: 3199, complex: false });
    expect(finalCrater(justAbove, 'earth').complex).toBe(true);
  });

  it('turns complex only above about 15 km on the Moon', () => {
    expect(finalCrater(5000, 'moon').complex).toBe(false);
    expect(finalCrater(13000, 'moon').complex).toBe(true);
    expect(BODIES.moon.transitionDiameterM).toBe(15000);
  });

  it('uses a complex formula that does not depend on the unit of length', () => {
    const metres = finalCrater(4000, 'earth').diameterM;
    const kilometres = (1.17 * 4 ** 1.13) / 3.2 ** 0.13;
    expect(metres / 1000).toBeCloseTo(kilometres, 9);
  });
});

describe('guesses and drawing', () => {
  it('measures a guess as a factor either way', () => {
    expect(guessFactor(300, 1200)).toBe(4);
    expect(guessFactor(1200, 300)).toBe(4);
    expect(GOOD_GUESS_FACTOR).toBe(1.5);
  });

  it('draws a simple crater one fifth as deep as it is wide, with a raised rim', () => {
    expect(craterDepthAt(0, 1000, false)).toBeCloseTo(200, 0);
    expect(craterDepthAt(500, 1000, false)).toBeLessThan(0);
    expect(Math.abs(craterDepthAt(3000, 1000, false))).toBeLessThan(1e-6);
  });

  it('draws a complex crater shallower, with a central peak', () => {
    const centre = craterDepthAt(0, 20000, true);
    const floor = craterDepthAt(0.4 * 10000, 20000, true);
    expect(floor).toBeGreaterThan(centre);
    expect(floor / 20000).toBeLessThan(0.1);
  });
});

describe('the famous-impact presets', () => {
  it('gives Chelyabinsk about half a megaton, as measured (about 500 kt)', () => {
    const chelyabinsk = simulateImpact(IMPACT_PRESETS.chelyabinsk);
    expect(chelyabinsk.megatons).toBeGreaterThan(0.35);
    expect(chelyabinsk.megatons).toBeLessThan(0.65);
    expect(IMPACT_PRESETS.chelyabinsk.realDiameterM).toBeNull();
  });

  it('makes Chicxulub a complex crater over 100 km, short of the real 180 km', () => {
    const chicxulub = simulateImpact(IMPACT_PRESETS.chicxulub);
    expect(chicxulub.complex).toBe(true);
    expect(chicxulub.diameterM).toBeGreaterThan(GIANT_CRATER_M);
    expect(chicxulub.diameterM).toBeLessThan(IMPACT_PRESETS.chicxulub.realDiameterM);
  });

  it('moves the Meteor Crater rock to the Moon and gets a bigger hole', () => {
    expect(sameImpactor(IMPACT_PRESETS.moon, METEOR_CRATER)).toBe(true);
    expect(simulateImpact(IMPACT_PRESETS.moon).diameterM).toBeGreaterThan(meteor.diameterM);
  });

  it('only offers speeds a body can actually be hit at', () => {
    for (const preset of Object.values(IMPACT_PRESETS)) {
      expect(preset.speedKms).toBeGreaterThanOrEqual(BODIES[preset.body].minSpeedKms);
    }
  });
});

describe('the Tashkent yardstick', () => {
  it('is a circle the size of the city, about 20.6 km wide', () => {
    expect(TASHKENT_WIDTH_M / 1000).toBeGreaterThan(20);
    expect(TASHKENT_WIDTH_M / 1000).toBeLessThan(21);
  });
});

describe('the same asteroid', () => {
  it('ignores the target but not the asteroid', () => {
    expect(sameImpactor(METEOR_CRATER, { ...METEOR_CRATER, body: 'moon' })).toBe(true);
    expect(sameImpactor(METEOR_CRATER, { ...METEOR_CRATER, speedKms: 13 })).toBe(false);
    expect(sameImpactor(METEOR_CRATER, { ...METEOR_CRATER, composition: 'stone' })).toBe(false);
  });
});
