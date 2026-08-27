/**
 * spaceRunCollision.js
 * ─────────────────────────────────────────────────────────────────────────────
 * The single rule that decides whether a Space Run continues, kept out of the
 * scene so it can be tested without WebGL.
 *
 * A meteor is lethal on contact. The shield is the one exception: it is spent
 * whole to survive a single strike and leaves the ship briefly untouchable, so
 * the rest of a cluster arriving in the same handful of frames cannot cash in
 * that one save two or three times over.
 */

/** Seconds of grace a spent shield buys. */
export const SHIELD_SAVE_INVULN = 1.4;

/**
 * @param {object}  ship
 * @param {number}  ship.shield  — shield charge, 0 when there is none
 * @param {number}  ship.invuln  — seconds of grace left from an earlier save
 * @returns {'ignored'|'absorbed'|'fatal'}
 *   `ignored`  — inside the grace window; the rock breaks up, nothing changes
 *   `absorbed` — the shield is spent whole and the grace window opens
 *   `fatal`    — the run ends here
 */
export function resolveMeteorStrike({ shield, invuln }) {
  if (invuln > 0) return 'ignored';
  if (shield > 0) return 'absorbed';
  return 'fatal';
}
