import { BODIES, BODY_BY_ID, rotationHoursOf } from './catalog';
import { distanceAU, helioPositionAU, lightMinutes } from './ephemeris';
import { upcomingEvents } from './events';

/**
 * Questions the sky itself answers.
 *
 * Every question is generated from the simulation's current date, so the
 * right answer to "which planet is closest to the Earth right now?" changes
 * over the year and cannot be memorised — only read off the scene. Answers
 * are body ids or numbers; the panel turns them into words in the reader's
 * language.
 */

const PLANETS = BODIES.filter((b) => b.kind === 'planet').map((b) => b.id);
const NOT_EARTH = PLANETS.filter((id) => id !== 'earth');
const DWARFS = BODIES.filter((b) => b.kind === 'dwarf').map((b) => b.id);

function shuffle(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick(list, n, rng) {
  return shuffle(list, rng).slice(0, n);
}

/** Four options with the right one somewhere; returns { options, answerIndex }. */
function withDistractors(correct, distractors, rng) {
  const options = shuffle([correct, ...pick(distractors.filter((d) => d !== correct), 3, rng)], rng);
  return { options, answerIndex: options.indexOf(correct) };
}

const GENERATORS = {
  closestPlanet(ms, rng) {
    const earth = helioPositionAU(BODY_BY_ID.get('earth'), ms);
    const byDistance = NOT_EARTH
      .map((id) => ({ id, d: distanceAU(helioPositionAU(BODY_BY_ID.get(id), ms), earth) }))
      .sort((a, b) => a.d - b.d);
    return { kind: 'closestPlanet', answerType: 'body', ...withDistractors(byDistance[0].id, NOT_EARTH, rng) };
  },
  farthest(ms, rng) {
    const ids = pick([...NOT_EARTH, ...DWARFS], 4, rng);
    const r = (id) => Math.hypot(...helioPositionAU(BODY_BY_ID.get(id), ms));
    const correct = ids.reduce((best, id) => (r(id) > r(best) ? id : best), ids[0]);
    const options = ids;
    return { kind: 'farthest', answerType: 'body', options, answerIndex: options.indexOf(correct) };
  },
  lightTime(ms, rng) {
    const body = pick(PLANETS, 1, rng)[0];
    const minutes = (id) => Math.round(lightMinutes(Math.hypot(...helioPositionAU(BODY_BY_ID.get(id), ms))) * 10) / 10;
    const correct = minutes(body);
    const others = PLANETS.filter((id) => id !== body).map(minutes).filter((m) => Math.abs(m - correct) > 0.5);
    const { options, answerIndex } = withDistractors(correct, others, rng);
    return { kind: 'lightTime', answerType: 'minutes', params: { body }, options, answerIndex };
  },
  nextOpposition(ms, rng) {
    const next = upcomingEvents(ms).find((e) => e.key === 'opposition');
    if (!next) return null;
    return { kind: 'nextOpposition', answerType: 'body', ...withDistractors(next.body, ['mars', 'jupiter', 'saturn', 'venus'], rng) };
  },
  longestDay(ms, rng) {
    const ids = pick(PLANETS, 4, rng);
    const hours = (id) => Math.abs(rotationHoursOf(BODY_BY_ID.get(id)));
    const correct = ids.reduce((best, id) => (hours(id) > hours(best) ? id : best), ids[0]);
    return { kind: 'longestDay', answerType: 'body', options: ids, answerIndex: ids.indexOf(correct) };
  },
  retrograde(ms, rng) {
    const prograde = PLANETS.filter((id) => rotationHoursOf(BODY_BY_ID.get(id)) > 0);
    const correct = rng() < 0.5 ? 'venus' : 'uranus';
    return { kind: 'retrograde', answerType: 'body', ...withDistractors(correct, prograde, rng) };
  },
  daysToFullMoon(ms, rng) {
    const full = upcomingEvents(ms).find((e) => e.key === 'fullMoon');
    if (!full) return null;
    const correct = Math.max(0, Math.round((full.ms - ms) / 86_400_000));
    const candidates = [correct + 7, correct + 14, Math.max(0, correct - 7), correct + 21, Math.max(0, correct - 14)]
      .filter((v, i, arr) => v !== correct && arr.indexOf(v) === i);
    const { options, answerIndex } = withDistractors(correct, candidates, rng);
    return { kind: 'daysToFullMoon', answerType: 'days', options, answerIndex };
  },
};

export const QUESTION_KINDS = Object.keys(GENERATORS);

/**
 * @param {number} ms — simulation time
 * @param {number} count — questions per round
 * @param {() => number} rng — injectable for tests
 */
export function makeQuiz(ms, count = 5, rng = Math.random) {
  const kinds = shuffle(QUESTION_KINDS, rng);
  const out = [];
  for (const kind of kinds) {
    if (out.length >= count) break;
    const q = GENERATORS[kind](ms, rng);
    if (q && q.options.length === 4 && q.answerIndex >= 0) out.push(q);
  }
  return out;
}

const BEST_KEY = 'uz-cosmos-solar-quiz-best';

export function readBest() {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export function writeBest(score) {
  try {
    if (score > readBest()) localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode or storage disabled: the score is still shown, just not kept.
  }
}
