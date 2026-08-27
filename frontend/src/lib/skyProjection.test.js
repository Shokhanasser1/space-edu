/**
 * Turning "40 degrees up, 120 degrees round" into a pixel.
 *
 * The projection is the half of the sky view that cannot be checked by looking
 * at it: a star drawn in the wrong place still looks like a star, and a whole
 * sky that is subtly mirrored looks entirely convincing until a child takes it
 * outside and every constellation is backwards. So the properties are pinned
 * here instead — most importantly that east is on the right when you face
 * north, which is the one that decides mirrored or not.
 */
import { describe, expect, it } from 'vitest';

import { angularSeparationDeg, projectSky, unprojectSky } from './skyProjection';

const VIEWPORT = { width: 800, height: 600 };
const facingNorth = { centreAltitudeDeg: 30, centreAzimuthDeg: 0, fieldOfViewDeg: 90 };

describe('the centre of the view', () => {
  it('lands in the middle of the canvas', () => {
    const p = projectSky(30, 0, facingNorth, VIEWPORT);
    expect(p.x).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(300, 6);
    expect(p.visible).toBe(true);
  });

  it('stays in the middle wherever the view is pointed', () => {
    const view = { centreAltitudeDeg: 70, centreAzimuthDeg: 217, fieldOfViewDeg: 45 };
    const p = projectSky(70, 217, view, VIEWPORT);
    expect(p.x).toBeCloseTo(400, 6);
    expect(p.y).toBeCloseTo(300, 6);
  });
});

describe('which way round the sky is', () => {
  it('puts east on the right when you face north', () => {
    // Face north, look at something to the north-east: it is on your right.
    // If this ever flips, every constellation on screen is mirrored and the
    // view is useless for actually finding anything.
    const p = projectSky(30, 45, facingNorth, VIEWPORT);
    expect(p.x).toBeGreaterThan(400);
  });

  it('puts west on the left when you face north', () => {
    const p = projectSky(30, 315, facingNorth, VIEWPORT);
    expect(p.x).toBeLessThan(400);
  });

  it('puts higher up nearer the top of the canvas', () => {
    // Canvas y grows downwards; the sky does not.
    const higher = projectSky(60, 0, facingNorth, VIEWPORT);
    const lower = projectSky(10, 0, facingNorth, VIEWPORT);
    expect(higher.y).toBeLessThan(lower.y);
  });

  it('keeps east on the right after the view turns round to face south', () => {
    const facingSouth = { centreAltitudeDeg: 30, centreAzimuthDeg: 180, fieldOfViewDeg: 90 };
    // Facing south, east (90) is now on your left and west (270) on your right.
    expect(projectSky(30, 90, facingSouth, VIEWPORT).x).toBeLessThan(400);
    expect(projectSky(30, 270, facingSouth, VIEWPORT).x).toBeGreaterThan(400);
  });
});

describe('field of view', () => {
  it('places the edge of the field at the edge of the shorter side', () => {
    // 90-degree field, so 45 degrees from centre is the edge. The canvas is
    // 800x600, so the shorter side is 600 and the edge is 300px from centre.
    const p = projectSky(30 + 45, 0, facingNorth, VIEWPORT);
    expect(300 - p.y).toBeCloseTo(300, 3);
  });

  it('spreads the same star further out as you zoom in', () => {
    const wide = projectSky(40, 0, { ...facingNorth, fieldOfViewDeg: 120 }, VIEWPORT);
    const narrow = projectSky(40, 0, { ...facingNorth, fieldOfViewDeg: 30 }, VIEWPORT);
    expect(Math.abs(300 - narrow.y)).toBeGreaterThan(Math.abs(300 - wide.y));
  });
});

describe('what is behind you', () => {
  it('marks a star on the far side of the sky as not visible', () => {
    // Facing north at 30 degrees up, the opposite point of the sphere is due
    // south and 30 degrees below the horizon. Stereographic sends it to
    // infinity, so it has to be culled rather than drawn at a huge coordinate.
    const p = projectSky(-30, 180, facingNorth, VIEWPORT);
    expect(p.visible).toBe(false);
  });

  it('marks a star just off the edge of a wide view as still projectable', () => {
    const p = projectSky(30, 60, facingNorth, VIEWPORT);
    expect(p.visible).toBe(true);
    expect(Number.isFinite(p.x)).toBe(true);
  });
});

describe('reading a tap back off the canvas', () => {
  it('gives back the direction it was handed, for a spread of positions', () => {
    // A child taps a star to find out what it is, so the inverse has to be the
    // real inverse and not an approximation that drifts at the edges.
    // All well inside the projectable range; a direction behind the viewer has
    // no pixel to be tapped on, and is covered by the culling test above.
    for (const [alt, az] of [[30, 0], [55, 40], [5, 330], [70, 150], [-10, 25]]) {
      const p = projectSky(alt, az, facingNorth, VIEWPORT);
      expect(p.visible, `${alt},${az} should be projectable`).toBe(true);
      const back = unprojectSky(p.x, p.y, facingNorth, VIEWPORT);
      expect(back.altitudeDeg, `altitude of ${alt},${az}`).toBeCloseTo(alt, 6);
      expect(((back.azimuthDeg - az + 540) % 360) - 180, `azimuth of ${alt},${az}`)
        .toBeCloseTo(0, 6);
    }
  });

  it('returns the view centre for the middle of the canvas', () => {
    const back = unprojectSky(400, 300, facingNorth, VIEWPORT);
    expect(back.altitudeDeg).toBeCloseTo(30, 6);
    expect(back.azimuthDeg).toBeCloseTo(0, 6);
  });
});

describe('angular separation', () => {
  it('is zero for a direction and itself', () => {
    expect(angularSeparationDeg(41, 200, 41, 200)).toBeCloseTo(0, 6);
  });

  it('is the difference in altitude for two points on the same bearing', () => {
    expect(angularSeparationDeg(20, 90, 50, 90)).toBeCloseTo(30, 6);
  });

  it('is 90 degrees from the zenith to anywhere on the horizon', () => {
    expect(angularSeparationDeg(90, 0, 0, 137)).toBeCloseTo(90, 6);
  });
});
