import { describe, expect, it } from 'vitest';
import { BODY_BY_ID } from './catalog';
import { distanceAU, helioPositionAU } from './ephemeris';
import { QUESTION_KINDS, makeQuiz } from './quiz';

const T0 = Date.UTC(2026, 7, 27);

/** A deterministic generator so a round is reproducible. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('makeQuiz', () => {
  it('builds five distinct questions with four options and a valid answer', () => {
    const quiz = makeQuiz(T0, 5, seeded(7));
    expect(quiz).toHaveLength(5);
    expect(new Set(quiz.map((q) => q.kind)).size).toBe(5);
    for (const q of quiz) {
      expect(QUESTION_KINDS).toContain(q.kind);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
    }
  });

  it('names the planet that really is closest to the Earth', () => {
    let q = null;
    for (let seed = 1; seed < 40 && !q; seed++) q = makeQuiz(T0, 7, seeded(seed)).find((x) => x.kind === 'closestPlanet');
    expect(q).toBeTruthy();
    const earth = helioPositionAU(BODY_BY_ID.get('earth'), T0);
    const d = (id) => distanceAU(helioPositionAU(BODY_BY_ID.get(id), T0), earth);
    const answer = q.options[q.answerIndex];
    for (const id of q.options) expect(d(answer)).toBeLessThanOrEqual(d(id));
  });

  it('only ever calls Venus or Uranus a backwards spinner', () => {
    for (let seed = 1; seed < 20; seed++) {
      const q = makeQuiz(T0, 7, seeded(seed)).find((x) => x.kind === 'retrograde');
      if (!q) continue;
      expect(['venus', 'uranus']).toContain(q.options[q.answerIndex]);
      for (const id of q.options) if (id !== q.options[q.answerIndex]) expect(['venus', 'uranus']).not.toContain(id);
    }
  });

  it('is reproducible for the same seed and date', () => {
    expect(makeQuiz(T0, 5, seeded(3))).toEqual(makeQuiz(T0, 5, seeded(3)));
  });
});
