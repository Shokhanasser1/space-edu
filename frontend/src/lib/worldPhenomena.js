/**
 * Three real processes on three real worlds, for the Laboratory's "worlds in
 * action" module — each with the one piece of physics that explains it.
 *
 * The module used to offer "meteor shower", "volcanic eruption" and "dust
 * storm" all on the Earth, which turned the whole planet red or orange: none
 * of it happens like that here. Each process now lives where it really does.
 *
 * **Meteor showers on Earth.** Debris from a comet (or, for the Geminids, an
 * asteroid) that the Earth crosses at the same time every year. Parent bodies,
 * peak dates, zenithal hourly rates and entry speeds are those of the
 * International Meteor Organization's shower calendar and NASA; peak dates
 * move by a day or so from year to year, and the page says "around". The
 * energy of a grain is just E = ½ m v².
 *
 * **Dust storms on Mars.** Dust is measured by optical depth τ, and the direct
 * sunbeam reaching the ground falls off as e^-τ (the Beer–Lambert law). A
 * clear Martian day is around τ 0.5; on 10 June 2018 the global storm reached
 * τ 10.8 over the Opportunity rover, which fell silent that day (NASA/JPL).
 * Scattered light adds a little to the direct beam, so e^-τ is a floor.
 *
 * **Volcanoes on Io.** No air and a weak pull, so what a vent throws up goes
 * high: a ballistic plume rises h = v² / 2g. Io's surface gravity is
 * 1.796 m/s² and its radius 1 821.6 km (NASA Io fact sheet); Pele's plume,
 * launched at about 1 km/s, stands about 300 km tall. The Earth figure for the
 * same speed ignores air resistance, and the page says that too.
 */

/** Standard gravity, m/s². */
export const EARTH_GRAVITY = 9.81;

/** Io: surface gravity m/s², mean radius km (NASA). */
export const IO = { gravity: 1.796, radiusKm: 1821.6 };

/** Optical depths worth a mark on the slider. */
export const MARS_TAU = { clear: 0.5, opportunity: 10.8, min: 0.2, max: 11 };

/** Energy per gram of TNT, J (the standard convention). */
export const TNT_J_PER_GRAM = 4184;

/**
 * The showers the module offers, ordered by date. `peak` is [month, day] of
 * the usual peak; `zhr` the zenithal hourly rate; `speedKms` the speed at
 * which the meteoroids hit the atmosphere.
 */
export const METEOR_SHOWERS = [
  { id: 'etaAquariids', parent: '1P/Halley', peak: [5, 6], zhr: 50, speedKms: 66 },
  { id: 'perseids', parent: '109P/Swift–Tuttle', peak: [8, 12], zhr: 100, speedKms: 59 },
  { id: 'orionids', parent: '1P/Halley', peak: [10, 21], zhr: 20, speedKms: 66 },
  { id: 'leonids', parent: '55P/Tempel–Tuttle', peak: [11, 17], zhr: 15, speedKms: 71 },
  { id: 'geminids', parent: '3200 Phaethon', peak: [12, 14], zhr: 150, speedKms: 35 },
];

const DAY_MS = 86400000;

/**
 * The next peak of `shower` on or after the day `now` falls in, and how many
 * whole days away it is (0 means tonight).
 */
export function nextPeak(shower, now = new Date()) {
  const [month, day] = shower.peak;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let peak = new Date(now.getFullYear(), month - 1, day);
  if (peak < today) peak = new Date(now.getFullYear() + 1, month - 1, day);
  return { date: peak, days: Math.round((peak - today) / DAY_MS) };
}

/** The id of the shower whose peak comes soonest after `now`. */
export function soonestShower(now = new Date(), showers = METEOR_SHOWERS) {
  let best = showers[0];
  let bestDays = Infinity;
  for (const shower of showers) {
    const { days } = nextPeak(shower, now);
    if (days < bestDays) {
      best = shower;
      bestDays = days;
    }
  }
  return best.id;
}

/** The id of the fastest shower. */
export function fastestShower(showers = METEOR_SHOWERS) {
  return showers.reduce((a, b) => (b.speedKms > a.speedKms ? b : a)).id;
}

/** Kinetic energy, J, of a grain of `grams` at `speedKms`. */
export function grainEnergyJ(grams, speedKms) {
  const v = speedKms * 1000;
  return 0.5 * (grams / 1000) * v * v;
}

/** Fraction of the direct sunbeam that reaches the ground through optical depth τ. */
export function directSunlight(tau) {
  return Math.exp(-tau);
}

/** Height, km, a ballistic plume reaches when launched straight up at `speedMs`. */
export function plumeHeightKm(speedMs, gravity = IO.gravity) {
  return (speedMs * speedMs) / (2 * gravity) / 1000;
}

/** Launch speed, m/s, needed to reach `heightKm` — the inverse of `plumeHeightKm`. */
export function speedForHeightMs(heightKm, gravity = IO.gravity) {
  return Math.sqrt(2 * gravity * heightKm * 1000);
}
