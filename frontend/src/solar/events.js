import {
  Body,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  SearchMoonPhase,
  SearchRelativeLongitude,
} from 'astronomy-engine';

/**
 * The next few things worth jumping the clock to.
 *
 * Every one of these is a real prediction from astronomy-engine, so a class
 * can set the date to the next lunar eclipse and watch the Moon slide into
 * the Earth's shadow, or to Mars' next opposition and see why it is the best
 * night to look. Oppositions are found as the moment the planet and the Earth
 * share a heliocentric longitude (relative longitude 0°).
 */

const OPPOSITION_BODIES = [
  ['mars', Body.Mars],
  ['jupiter', Body.Jupiter],
  ['saturn', Body.Saturn],
];

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function upcomingEvents(ms) {
  const start = new Date(ms);
  const events = [];

  const full = safe(() => SearchMoonPhase(180, start, 40));
  if (full) events.push({ key: 'fullMoon', ms: full.date.getTime() });
  const newMoon = safe(() => SearchMoonPhase(0, start, 40));
  if (newMoon) events.push({ key: 'newMoon', ms: newMoon.date.getTime() });

  const lunar = safe(() => SearchLunarEclipse(start));
  if (lunar) events.push({ key: 'lunarEclipse', kind: lunar.kind, ms: lunar.peak.date.getTime(), body: 'moon' });
  const solar = safe(() => SearchGlobalSolarEclipse(start));
  if (solar) events.push({ key: 'solarEclipse', kind: solar.kind, ms: solar.peak.date.getTime(), body: 'earth' });

  for (const [id, body] of OPPOSITION_BODIES) {
    const t = safe(() => SearchRelativeLongitude(body, 0, start));
    if (t) events.push({ key: 'opposition', body: id, ms: t.date.getTime() });
  }

  return events.sort((a, b) => a.ms - b.ms);
}
