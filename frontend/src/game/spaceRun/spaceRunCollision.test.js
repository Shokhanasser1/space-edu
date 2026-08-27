/**
 * The rule the game is named for.
 *
 * Space Run shipped with a 100-point health pool and meteors that took 65–95
 * of it, so the ship shrugged off the first rock it flew into and the coins it
 * collected healed the damage back. The brief is that contact ends the run, so
 * these tests pin the rule down: one strike is fatal unless a shield is
 * standing, and the grace window a spent shield opens cannot be spent twice.
 *
 * The collision itself lives inside a `useFrame` closure in the scene, which
 * jsdom cannot render — hence the pure module here, plus a source check that
 * the scene still wires each outcome to the right consequence.
 */
import { describe, expect, it } from 'vitest';

import sceneSource from './SpaceRunScene.jsx?raw';
import { SHIELD_SAVE_INVULN, resolveMeteorStrike } from './spaceRunCollision';

describe('a meteor strike', () => {
  it('ends the run when nothing is protecting the ship', () => {
    expect(resolveMeteorStrike({ shield: 0, invuln: 0 })).toBe('fatal');
  });

  it('is absorbed while a shield is standing', () => {
    expect(resolveMeteorStrike({ shield: 100, invuln: 0 })).toBe('absorbed');
  });

  it('is absorbed by any shield at all, not just a full one', () => {
    expect(resolveMeteorStrike({ shield: 1, invuln: 0 })).toBe('absorbed');
  });

  it('passes through harmlessly inside the grace window', () => {
    expect(resolveMeteorStrike({ shield: 0, invuln: 0.4 })).toBe('ignored');
  });

  it('opens a grace window long enough to clear a cluster', () => {
    // Meteors spawn at z ≈ −46 and close at 13–39 u/s, so the tail of a
    // three-rock cluster arrives well inside a window this wide.
    expect(SHIELD_SAVE_INVULN).toBeGreaterThan(1);
  });
});

describe('the sequence a cluster produces', () => {
  /** Mirrors the three lines the scene runs per strike. */
  function strike(ship) {
    const outcome = resolveMeteorStrike(ship);
    if (outcome === 'absorbed') return { ...ship, shield: 0, invuln: SHIELD_SAVE_INVULN };
    if (outcome === 'fatal') return { ...ship, alive: false };
    return ship;
  }

  it('spends the whole shield on one rock and survives the next', () => {
    let ship = { alive: true, shield: 100, invuln: 0 };

    ship = strike(ship);
    expect(ship.shield).toBe(0);
    expect(ship.alive).toBe(true);

    ship = strike(ship); // second rock of the same cluster
    expect(ship.alive).toBe(true);
  });

  it('kills once the grace window has run out', () => {
    let ship = strike({ alive: true, shield: 100, invuln: 0 });
    ship = { ...ship, invuln: 0 }; // window elapsed
    expect(strike(ship).alive).toBe(false);
  });

  it('kills on the very first rock of an unshielded run', () => {
    expect(strike({ alive: true, shield: 0, invuln: 0 }).alive).toBe(false);
  });
});

describe('the scene keeps no health pool', () => {
  it('spawns meteors without a damage value', () => {
    expect(sceneSource).not.toMatch(/\.damage\s*=/);
  });

  it('never subtracts from a health total', () => {
    expect(sceneSource).not.toMatch(/healthRef/);
  });

  it('does not let coins heal the ship', () => {
    expect(sceneSource).not.toMatch(/health.*\+.*special/i);
  });

  it('routes the fatal outcome straight to game over', () => {
    expect(sceneSource).toMatch(/strike === "fatal"[\s\S]{0,120}gameOver: true/);
  });

  it('spends the shield whole on an absorbed outcome', () => {
    expect(sceneSource).toMatch(
      /strike === "absorbed"[\s\S]{0,120}shieldRef\.current = 0;[\s\S]{0,120}SHIELD_SAVE_INVULN/,
    );
  });
});
