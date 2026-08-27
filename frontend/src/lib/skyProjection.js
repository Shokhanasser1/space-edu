/**
 * Sky directions to canvas pixels, and back.
 *
 * The sky is the inside of a sphere and a screen is flat, so something has to
 * give. This uses a **stereographic** projection, which is what a planisphere
 * is, what most star charts are, and what Stellarium itself uses at ordinary
 * fields of view. Its useful property here is that it is conformal: a small
 * shape keeps its shape, so the Plough looks like the Plough near the edge of
 * the view and not like a smear. It cannot show the whole sphere at once — the
 * point directly behind you goes to infinity — which is why `visible` exists.
 *
 * Convention, and the thing worth getting right: azimuth is measured from
 * north through east (see `skyPosition.js`), and the view is what you see
 * **looking out** at the sky in the direction of the centre. Face north and
 * east is on your right, exactly as it is if you go outside and do it. Flip
 * that sign and every constellation is mirrored, which looks completely
 * plausible on screen and is useless the moment somebody looks up.
 */

const DEG = Math.PI / 180;

/**
 * Beyond this far from the centre the projection stretches without limit and
 * the numbers stop meaning anything, so those directions are reported as not
 * visible rather than drawn a mile off canvas.
 */
const MAX_ANGLE_FROM_CENTRE_DEG = 150;

/** Radius, in projection units, of a point this many degrees from the centre. */
const radiusFor = (angleDeg) => 2 * Math.tan((angleDeg * DEG) / 2);

/**
 * Pixels per projection unit, chosen so the field of view spans the shorter
 * side of the canvas. Portrait phone or landscape laptop, the child is
 * promised the same amount of sky.
 */
function scaleFor(view, viewport) {
  const half = Math.min(viewport.width, viewport.height) / 2;
  return half / radiusFor(view.fieldOfViewDeg / 2);
}

/** Great-circle angle between two directions, in degrees. */
export function angularSeparationDeg(altitudeA, azimuthA, altitudeB, azimuthB) {
  const cosine =
    Math.sin(altitudeA * DEG) * Math.sin(altitudeB * DEG) +
    Math.cos(altitudeA * DEG) * Math.cos(altitudeB * DEG) *
      Math.cos((azimuthA - azimuthB) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, cosine))) / DEG;
}

/**
 * One direction in the sky to a point on the canvas.
 *
 * `visible: false` means the direction is behind the viewer and `x`/`y` should
 * not be used — callers skip it rather than clamping, because a clamped star
 * is a star drawn somewhere it is not.
 */
export function projectSky(altitudeDeg, azimuthDeg, view, viewport) {
  const phi = altitudeDeg * DEG;
  const phi0 = view.centreAltitudeDeg * DEG;
  const deltaLambda = (azimuthDeg - view.centreAzimuthDeg) * DEG;

  const cosC =
    Math.sin(phi0) * Math.sin(phi) +
    Math.cos(phi0) * Math.cos(phi) * Math.cos(deltaLambda);

  if (cosC <= Math.cos(MAX_ANGLE_FROM_CENTRE_DEG * DEG)) {
    return { x: 0, y: 0, visible: false };
  }

  const k = 2 / (1 + cosC);
  const x = k * Math.cos(phi) * Math.sin(deltaLambda);
  const y = k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(deltaLambda));
  const scale = scaleFor(view, viewport);

  return {
    // Canvas y grows downwards and the sky does not, hence the subtraction.
    x: viewport.width / 2 + x * scale,
    y: viewport.height / 2 - y * scale,
    visible: true,
  };
}

/**
 * A point on the canvas back to a direction in the sky. This is what turns a
 * child's tap into "that one is Vega", so it is a real inverse rather than a
 * near-enough one — `skyProjection.test.js` round-trips it to six decimals.
 */
export function unprojectSky(canvasX, canvasY, view, viewport) {
  const scale = scaleFor(view, viewport);
  const x = (canvasX - viewport.width / 2) / scale;
  const y = (viewport.height / 2 - canvasY) / scale;
  const phi0 = view.centreAltitudeDeg * DEG;

  const rho = Math.hypot(x, y);
  if (rho < 1e-12) {
    return {
      altitudeDeg: view.centreAltitudeDeg,
      azimuthDeg: view.centreAzimuthDeg,
    };
  }

  const c = 2 * Math.atan(rho / 2);
  const altitude = Math.asin(
    Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho,
  );
  const azimuth =
    view.centreAzimuthDeg * DEG +
    Math.atan2(
      x * Math.sin(c),
      rho * Math.cos(phi0) * Math.cos(c) - y * Math.sin(phi0) * Math.sin(c),
    );

  return {
    altitudeDeg: altitude / DEG,
    azimuthDeg: (((azimuth / DEG) % 360) + 360) % 360,
  };
}
