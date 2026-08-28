/**
 * The catalogue is generated, so this is not checking anybody's typing. It is
 * checking the two things that would go wrong silently:
 *
 *   1. The tuple field order in the JSON drifting out of step with the reader
 *      that decodes it. Nothing crashes when that happens — you get a sky with
 *      declinations in the magnitude column, which renders perfectly happily
 *      and is completely wrong.
 *   2. A figure link pointing at a star that is not in the file, which draws a
 *      constellation line to nowhere.
 *
 * It also holds the rule the generator exists to enforce: every number here
 * came from a catalogue, so every number here has to be a plausible one. A
 * declination of 130 degrees means something upstream invented it.
 */
import { describe, expect, it } from 'vitest';

import raw from './skyCatalog.json';
import {
  catalogueEquinox,
  catalogueSources,
  figures,
  magnitudeLimit,
  stars,
  starsByHr,
} from './skyCatalog';

describe('the star catalogue', () => {
  it('has enough stars to look like a sky', () => {
    expect(stars.length).toBeGreaterThan(2000);
  });

  it('gives every star a right ascension inside the circle', () => {
    for (const star of stars) {
      expect(Number.isFinite(star.ra), `HR ${star.hr}`).toBe(true);
      expect(star.ra, `HR ${star.hr}`).toBeGreaterThanOrEqual(0);
      expect(star.ra, `HR ${star.hr}`).toBeLessThan(360);
    }
  });

  it('gives every star a declination between the poles', () => {
    for (const star of stars) {
      expect(star.dec, `HR ${star.hr}`).toBeGreaterThanOrEqual(-90);
      expect(star.dec, `HR ${star.hr}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps every star at or brighter than the stated magnitude limit', () => {
    for (const star of stars) {
      expect(star.vmag, `HR ${star.hr}`).toBeLessThanOrEqual(magnitudeLimit);
    }
  });

  it('has one record per Harvard Revised number', () => {
    expect(starsByHr.size).toBe(stars.length);
  });

  it('says which equinox the coordinates are for', () => {
    // A position without an equinox is not a position. J2000 is what the sky
    // view assumes when it converts to altitude and azimuth.
    expect(catalogueEquinox).toBe('J2000.0');
  });

  it('names a real catalogue for every kind of number in it', () => {
    // The rule the whole feature turns on: nothing here was made up, and the
    // file says where each part came from.
    for (const key of ['positions', 'parallaxes', 'names', 'figures']) {
      expect(catalogueSources[key], key).toBeTruthy();
    }
    expect(catalogueSources.positions).toMatch(/Bright Star Catalogue/);
    expect(catalogueSources.parallaxes).toMatch(/Hipparcos/);
  });
});

describe('stars we quote facts about', () => {
  const named = stars.filter((s) => s.name);

  it('includes the ones a child has heard of, in their real places', () => {
    // Bright Star Catalogue J2000 positions. If the decode ever shifts a
    // column, these are the first things to go wrong and the easiest to check
    // against any star atlas.
    const byName = new Map(named.map((s) => [s.name, s]));
    const sirius = byName.get('Sirius');
    expect(sirius.ra).toBeCloseTo(101.2871, 3);
    expect(sirius.dec).toBeCloseTo(-16.7161, 3);
    expect(sirius.vmag).toBeCloseTo(-1.46, 2);
    expect(sirius.constellation).toBe('CMa');

    const polaris = byName.get('Polaris');
    expect(polaris.dec).toBeGreaterThan(89);
    expect(polaris.constellation).toBe('UMi');
  });

  it('quotes no distance at all where the parallax was too poor to trust', () => {
    // Betelgeuse's Hipparcos parallax is 7.63 +/- 1.64 mas, a 21% error, which
    // is anywhere from 500 to 700 light years. The generator refuses to write
    // a number for it, and that refusal is the feature.
    const betelgeuse = named.find((s) => s.name === 'Betelgeuse');
    expect(betelgeuse).toBeTruthy();
    expect(betelgeuse.distanceLy).toBeNull();
  });

  it('keeps every distance it does quote a positive, finite number', () => {
    for (const star of stars) {
      if (star.distanceLy === null) continue;
      expect(star.distanceLy, `HR ${star.hr}`).toBeGreaterThan(0);
      expect(Number.isFinite(star.distanceLy), `HR ${star.hr}`).toBe(true);
    }
  });

  it('turns Bayer abbreviations into the Greek a child sees on a chart', () => {
    const vega = stars.find((s) => s.name === 'Vega');
    expect(vega.greek).toBe('α');
  });
});

describe('constellation figures', () => {
  it('draws all 88 of them', () => {
    expect(figures.length).toBe(88);
  });

  it('joins only stars that are actually in the file', () => {
    // Read the raw JSON, not the decoded figures. The reader filters dangling
    // links out, so asserting on its output would be asserting that filter
    // works — which it does, and which tells us nothing about the file. Caught
    // by mutation: adding [999999, 2061] to Orion left the decoded version
    // green.
    for (const [abbreviation, links] of Object.entries(raw.figures)) {
      for (const [fromHr, toHr] of links) {
        expect(starsByHr.has(fromHr), `${abbreviation} link from HR ${fromHr}`).toBe(true);
        expect(starsByHr.has(toHr), `${abbreviation} link to HR ${toHr}`).toBe(true);
      }
    }
  });

  it('loses no link between the file and what gets drawn', () => {
    const inFile = Object.values(raw.figures).reduce((n, links) => n + links.length, 0);
    const drawn = figures.reduce((n, f) => n + f.links.length, 0);
    expect(drawn).toBe(inFile);
  });

  it('gives every figure at least one line to draw', () => {
    for (const figure of figures) {
      expect(figure.links.length, figure.abbreviation).toBeGreaterThan(0);
    }
  });

  it('has Orion joined up the way Orion is joined up', () => {
    const orion = figures.find((f) => f.abbreviation === 'Ori');
    const names = new Set(
      orion.links.flat().map((s) => s.name).filter(Boolean),
    );
    for (const expected of ['Betelgeuse', 'Rigel', 'Bellatrix', 'Alnilam']) {
      expect(names.has(expected), `Orion should include ${expected}`).toBe(true);
    }
  });
});
