import { twoline2satrec } from 'satellite.js';
import { describe, expect, it } from 'vitest';
import { ommToSatrec, ommToTle } from './omm';

/**
 * The ISS on 20 September 2008 — the TLE every SGP4 write-up uses, with
 * valid checksums (7 and 7). The old fallback TLE in LiveSpaceView had been
 * hand-edited to a 2026 epoch and its checksums no longer matched, which is
 * why it is not the fixture here.
 */
const TLE = [
  '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
  '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
];
const OMM = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2008-09-20T12:25:40.104192',
  MEAN_MOTION: 15.72125391,
  ECCENTRICITY: 0.0006703,
  INCLINATION: 51.6416,
  RA_OF_ASC_NODE: 247.4627,
  ARG_OF_PERICENTER: 130.536,
  MEAN_ANOMALY: 325.0288,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 292,
  REV_AT_EPOCH: 56353,
  BSTAR: -0.000011606,
  MEAN_MOTION_DOT: -0.00002182,
  MEAN_MOTION_DDOT: 0,
};

describe('ommToTle', () => {
  it('rebuilds both lines exactly, checksums included', () => {
    const [l1, l2] = ommToTle(OMM);
    expect(l1).toBe(TLE[0]);
    expect(l2).toBe(TLE[1]);
  });

  it('parses to the same satrec as the real TLE', () => {
    const fromOmm = ommToSatrec(OMM);
    const fromTle = twoline2satrec(TLE[0], TLE[1]);
    expect(fromOmm.error).toBe(0);
    for (const field of ['no', 'ecco', 'inclo', 'nodeo', 'argpo', 'mo', 'bstar']) {
      expect(fromOmm[field]).toBeCloseTo(fromTle[field], 8);
    }
    expect(Math.abs(fromOmm.jdsatepoch - fromTle.jdsatepoch)).toBeLessThan(1e-6);
  });

  it('formats zero drag and positive derivatives', () => {
    const [l1] = ommToTle({ ...OMM, BSTAR: 0, MEAN_MOTION_DOT: 0.0001492, MEAN_MOTION_DDOT: 0 });
    expect(l1.slice(33, 43)).toBe(' .00014920');
    expect(l1.slice(53, 61)).toBe(' 00000-0');
    expect(l1).toHaveLength(69);
  });
});
