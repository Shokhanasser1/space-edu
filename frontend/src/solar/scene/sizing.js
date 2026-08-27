/**
 * Never let a body vanish into a sub-pixel speck.
 *
 * From the overview the Earth is 1 unit wide 170 units away: two pixels.
 * NASA Eyes draws an icon in that case; we scale the sphere itself up so it
 * covers at least `minPx` pixels, keeping its shading and phase. The scale
 * fades back to 1 as the camera approaches, so a planet you fly to is drawn
 * at its catalogue size by the time it matters.
 *
 * @returns the multiplier to apply to the body's drawn radius
 */
export function minSizeScale(radius, distance, camera, viewportHeight, minPx) {
  if (!camera || !viewportHeight) return 1;
  const focal = viewportHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);
  const px = radius * (focal / Math.max(distance, 1e-6));
  if (px >= minPx) return 1;
  return Math.min(minPx / Math.max(px, 1e-6), 400);
}

export const PLANET_MIN_PX = 4.5;
export const MOON_MIN_PX = 2.2;
/** A moon is only drawn once its planet is this big on screen. */
export const MOON_PARENT_MIN_PX = 26;
