/**
 * What a star should look like on the canvas.
 *
 * Two different kinds of thing live here and it is worth saying which is
 * which, because they are drawn on the same screen and only one of them is a
 * measurement.
 *
 * **The colour is real.** It comes from the star's B-V index, which is in the
 * Bright Star Catalogue for almost every entry, via Ballesteros' colour-index
 * to effective-temperature relation (F.J. Ballesteros, "New insights into
 * black bodies", EPL 97, 34008, 2012) and then the standard piecewise fit of
 * the Planckian locus to sRGB. Betelgeuse comes out orange and Rigel comes out
 * blue-white because they are, and a child who has looked at Orion can see
 * that on the screen.
 *
 * **The size is not real.** Sirius is about four hundred times brighter than a
 * fifth-magnitude star; drawn to scale it would be a disc you cannot see past
 * and Canis Major would be behind it. Every star chart ever printed uses a
 * compressed ramp instead, and so does this. It is a convention for reading,
 * not a claim about the sky.
 */

/**
 * Effective temperature in kelvin from the B-V colour index. Ballesteros 2012,
 * good to a few per cent across the range naked-eye stars occupy, which is far
 * better than a screen can show.
 */
export function colourTemperatureK(bv) {
  const b = 0.92 * bv;
  return 4600 * (1 / (b + 1.7) + 1 / (b + 0.62));
}

const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Blackbody temperature to sRGB, the piecewise fit to the Planckian locus that
 * everything from planetarium software to photo editors uses. Outside roughly
 * 1000-40000 K the polynomials leave the byte range, hence the clamp: a canvas
 * handed `rgb(-12, ...)` draws nothing at all and the star silently vanishes.
 */
function temperatureToRgb(kelvin) {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;

  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * (t - 60) ** -0.0755148492;
  let b;
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  return [clampByte(r), clampByte(g), clampByte(b)];
}

/**
 * The CSS colour for a star of this B-V. A few BSC entries have no measured
 * colour; those are drawn white, which is honest, rather than given a guess.
 */
export function starColour(bv) {
  if (bv === null || bv === undefined || !Number.isFinite(bv)) return 'rgb(255, 255, 255)';
  const [r, g, b] = temperatureToRgb(colourTemperatureK(bv));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Radius in pixels. Linear in magnitude — one step of magnitude is one step of
 * radius — which compresses a 400:1 brightness range into about 6:1 of size.
 * `zoom` is 1 at the widest field and grows as the child zooms in, so a
 * close-up sky has bigger stars rather than the same specks further apart.
 */
export function starRadiusPx(vmag, limitingMagnitude, zoom = 1) {
  const stepsBrighterThanFaintest = limitingMagnitude - vmag;
  const radius = 0.6 + 0.42 * Math.max(0, stepsBrighterThanFaintest);
  return radius * (0.75 + 0.25 * Math.min(4, zoom));
}

/**
 * How much of the star to draw, given how dark the sky is where the child is
 * standing. Stars fade out over the last magnitude rather than switching off,
 * because a hard edge makes half the sky pop in and out as the slider moves.
 */
export function starOpacity(vmag, limitingMagnitude) {
  const headroom = limitingMagnitude - vmag;
  if (headroom >= 1) return 1;
  if (headroom <= 0) return 0;
  return headroom;
}
