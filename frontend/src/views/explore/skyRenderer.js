/**
 * Drawing the sky onto a 2D canvas.
 *
 * Kept out of the React component on purpose: everything here is a plain
 * function taking a context and a description of the scene, so it can be
 * tested by handing it a context that writes down what it was asked to do.
 * jsdom has no canvas and the project's stub does nothing, so this is the only
 * way the drawing gets checked at all.
 *
 * Why 2D canvas rather than three.js, which the project already has:
 *
 *   - Labels. Star and constellation names have to render in Latin and in
 *     Cyrillic. `fillText` does that with the system font and no new asset;
 *     drei's text needs an SDF atlas that does not cover Cyrillic.
 *   - No WebGL context to lose. This app's most fragile surface has been WebGL
 *     twice already (SpaceLabView taking the whole site down, Earth3D needing
 *     a still-image fallback), the home page already spends a context, and the
 *     child this is for is on a cheap Android phone in a classroom.
 *   - It can be tested. See above.
 *   - Nothing here needs a third dimension. The sky is a sphere seen from
 *     inside, which is a projection problem, not a scene-graph one.
 */
import { horizontalFromEquatorial } from '@/lib/skyPosition';
import { projectSky } from '@/lib/skyProjection';
import { starColour, starOpacity, starRadiusPx } from '@/lib/starAppearance';

/** Only stars this bright get their name written next to them. */
const LABEL_BRIGHTER_THAN = 2.6;

/** A tap this far from a star's centre still counts as hitting it, in pixels. */
const TAP_RADIUS_PX = 22;

/**
 * Catalogue positions into this observer's sky. Pulled out of the draw because
 * it only changes when the time or the place does, not when the child drags
 * the view around — 2319 stars at 60fps is wasted work otherwise.
 */
export function skyPositionsFor(stars, latitudeDeg, localSiderealDeg) {
  return stars.map((star) => {
    const { altitudeDeg, azimuthDeg } = horizontalFromEquatorial(
      star.ra, star.dec, latitudeDeg, localSiderealDeg,
    );
    return { ...star, altitudeDeg, azimuthDeg };
  });
}

function paintBackground(ctx, viewport) {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, '#050211');
  gradient.addColorStop(0.65, '#0a0620');
  gradient.addColorStop(1, '#140a2b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

/**
 * The horizon, and the four directions along it. Without these the sky is a
 * pretty picture; with them a child can stand in a yard, face the letter, and
 * find the thing.
 */
function drawHorizon(ctx, view, viewport, cardinals) {
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let drawing = false;
  for (let azimuth = 0; azimuth <= 360; azimuth += 1) {
    const p = projectSky(0, azimuth, view, viewport);
    if (!p.visible) { drawing = false; continue; }
    if (drawing) ctx.lineTo(p.x, p.y);
    else { ctx.moveTo(p.x, p.y); drawing = true; }
  }
  ctx.stroke();

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(196, 181, 253, 0.95)';
  for (const [azimuth, key] of [[0, 'n'], [90, 'e'], [180, 's'], [270, 'w']]) {
    const p = projectSky(0, azimuth, view, viewport);
    if (!p.visible) continue;
    if (p.x < 0 || p.x > viewport.width || p.y < 0 || p.y > viewport.height) continue;
    ctx.fillText(cardinals[key], p.x, p.y - 10);
  }
  ctx.restore();
}

/**
 * Constellation lines. A link is drawn only when both of its stars are above
 * the horizon — half of Orion is often up and half is not, and joining them
 * anyway runs a stick figure through the ground.
 */
function drawFigures(ctx, figures, view, viewport) {
  ctx.save();
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.34)';
  ctx.lineWidth = 1;
  for (const figure of figures) {
    for (const [from, to] of figure.links) {
      if (from.altitudeDeg < 0 || to.altitudeDeg < 0) continue;
      const a = projectSky(from.altitudeDeg, from.azimuthDeg, view, viewport);
      const b = projectSky(to.altitudeDeg, to.azimuthDeg, view, viewport);
      if (!a.visible || !b.visible) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function zoomFor(view) {
  return 120 / Math.max(1, view.fieldOfViewDeg);
}

/**
 * Everything visible, in one pass. Returns nothing; the caller owns the canvas.
 *
 * `labelFor` is how a name reaches the screen — the renderer never reads
 * `star.name` itself, because the catalogue's names are English and the child
 * may not be.
 */
export function drawSky(ctx, scene) {
  const {
    viewport, view, stars, figures, limitingMagnitude,
    showFigures, labelFor, cardinals, highlightHr,
  } = scene;

  paintBackground(ctx, viewport);
  if (showFigures) drawFigures(ctx, figures, view, viewport);
  drawHorizon(ctx, view, viewport, cardinals);

  const zoom = zoomFor(view);
  const labels = [];

  for (const star of stars) {
    if (star.altitudeDeg < 0) continue;
    const opacity = starOpacity(star.vmag, limitingMagnitude);
    if (opacity <= 0) continue;
    const p = projectSky(star.altitudeDeg, star.azimuthDeg, view, viewport);
    if (!p.visible) continue;
    if (p.x < -20 || p.x > viewport.width + 20 || p.y < -20 || p.y > viewport.height + 20) continue;

    const radius = starRadiusPx(star.vmag, limitingMagnitude, zoom);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = starColour(star.bv);
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (star.hr === highlightHr) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(10, radius + 8), 0, Math.PI * 2);
      ctx.stroke();
    }

    const label = labelFor(star);
    if (label && (star.vmag <= LABEL_BRIGHTER_THAN || star.hr === highlightHr)) {
      labels.push({ label, x: p.x, y: p.y, radius, highlighted: star.hr === highlightHr });
    }
  }
  ctx.globalAlpha = 1;

  // Labels last, so a faint star never draws over a name.
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (const { label, x, y, radius, highlighted } of labels) {
    ctx.fillStyle = highlighted ? '#e9d5ff' : 'rgba(226, 232, 240, 0.82)';
    ctx.fillText(label, x + radius + 6, y + 4);
  }
}

/**
 * Which star is under a tap, if any. Brightest wins a tie: a fingertip over
 * Mizar covers Alcor as well, and the one the child meant is the one they can
 * actually see.
 */
export function starAt(canvasX, canvasY, stars, view, viewport) {
  let best = null;
  let bestDistance = TAP_RADIUS_PX;

  for (const star of stars) {
    if (star.altitudeDeg < 0) continue;
    const p = projectSky(star.altitudeDeg, star.azimuthDeg, view, viewport);
    if (!p.visible) continue;
    const distance = Math.hypot(p.x - canvasX, p.y - canvasY);
    if (distance > bestDistance) continue;
    if (best && distance > 4 && star.vmag > best.vmag) continue;
    best = star;
    bestDistance = Math.min(bestDistance, Math.max(distance, 4));
  }
  return best;
}
