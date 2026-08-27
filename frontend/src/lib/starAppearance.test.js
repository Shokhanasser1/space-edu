/**
 * How bright and what colour to draw a star.
 *
 * Half of this is physics and half of it is chart convention, and the split
 * matters enough to be worth testing separately. The colour is derived from
 * the star's measured B-V index and should come out the colour the star
 * actually is — Betelgeuse orange, Rigel blue-white, and a child who has seen
 * both should recognise them. The size is not physics at all: drawing radius
 * in proportion to real brightness would make Sirius about four hundred times
 * the area of a fifth-magnitude star and swallow the constellation it is in.
 */
import { describe, expect, it } from 'vitest';

import {
  colourTemperatureK, starColour, starOpacity, starRadiusPx,
} from './starAppearance';

/** Pull the three channels back out of an `rgb(r, g, b)` string. */
const channels = (css) => css.match(/\d+/g).map(Number);

describe('colour temperature from B-V', () => {
  it('puts Vega where an A0 star belongs', () => {
    // B-V 0.00, published effective temperature about 9600 K. Ballesteros'
    // formula is an approximation, so this is checked to the nearest 1000 K --
    // it decides a colour on a screen, not a stellar model.
    expect(colourTemperatureK(0)).toBeGreaterThan(9000);
    expect(colourTemperatureK(0)).toBeLessThan(11000);
  });

  it('puts Betelgeuse where an M1 supergiant belongs', () => {
    // B-V 1.85, published about 3600 K.
    expect(colourTemperatureK(1.85)).toBeGreaterThan(3000);
    expect(colourTemperatureK(1.85)).toBeLessThan(4000);
  });

  it('gets hotter as the star gets bluer', () => {
    expect(colourTemperatureK(-0.3)).toBeGreaterThan(colourTemperatureK(0.6));
    expect(colourTemperatureK(0.6)).toBeGreaterThan(colourTemperatureK(1.6));
  });
});

describe('the colour drawn on screen', () => {
  it('makes a red giant redder than it is blue', () => {
    const [r, , b] = channels(starColour(1.85));
    expect(r).toBeGreaterThan(b);
  });

  it('makes a hot blue star bluer than it is red', () => {
    const [r, , b] = channels(starColour(-0.3));
    expect(b).toBeGreaterThan(r);
  });

  it('keeps every channel inside 0-255 across the whole real range', () => {
    // B-V runs about -0.4 to +2.0 for naked-eye stars. Helland's fit goes
    // outside the byte range at the ends if it is not clamped, and a canvas
    // given rgb(-12, ...) silently draws nothing.
    for (let bv = -0.5; bv <= 2.5; bv += 0.05) {
      for (const value of channels(starColour(bv))) {
        expect(value, `B-V ${bv.toFixed(2)}`).toBeGreaterThanOrEqual(0);
        expect(value, `B-V ${bv.toFixed(2)}`).toBeLessThanOrEqual(255);
      }
    }
  });

  it('falls back to plain white when a star has no measured colour', () => {
    // A handful of BSC entries have no B-V. White is honest; guessing is not.
    expect(channels(starColour(null))).toEqual([255, 255, 255]);
  });
});

describe('how big to draw it', () => {
  it('draws a brighter star bigger', () => {
    expect(starRadiusPx(-1.46, 5.3)).toBeGreaterThan(starRadiusPx(2, 5.3));
    expect(starRadiusPx(2, 5.3)).toBeGreaterThan(starRadiusPx(5, 5.3));
  });

  it('keeps even the faintest star big enough to be a pixel', () => {
    // Below about half a pixel a canvas arc draws nothing at all, and the
    // faint half of the sky quietly disappears.
    expect(starRadiusPx(5.3, 5.3)).toBeGreaterThanOrEqual(0.5);
  });

  it('does not let Sirius swallow the constellation it is in', () => {
    // Real flux ratio between Sirius and a 5th-magnitude star is about 400:1.
    // Drawn to scale that is a disc you cannot see past, so the ramp is
    // deliberately not physical and this is the check that it stays that way.
    expect(starRadiusPx(-1.46, 5.3)).toBeLessThan(8 * starRadiusPx(5, 5.3));
  });

  it('grows every star as you zoom in', () => {
    expect(starRadiusPx(2, 5.3, 2)).toBeGreaterThan(starRadiusPx(2, 5.3, 1));
  });
});

describe('fading out at the limit of what you can see', () => {
  it('shows a bright star at full strength under any sky', () => {
    expect(starOpacity(1.0, 4)).toBe(1);
  });

  it('hides a star fainter than the sky allows', () => {
    // The point of the light-pollution control: from the middle of Tashkent
    // the fifth-magnitude stars are not there, and pretending otherwise
    // teaches a child their eyes are broken.
    expect(starOpacity(5.2, 4)).toBe(0);
  });

  it('fades rather than cutting off at the boundary', () => {
    // A hard edge makes half the sky pop in and out as the slider moves.
    const justUnder = starOpacity(3.9, 4);
    expect(justUnder).toBeGreaterThan(0);
    expect(justUnder).toBeLessThan(1);
  });
});
