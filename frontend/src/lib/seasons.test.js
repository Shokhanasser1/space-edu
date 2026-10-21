/**
 * The arithmetic under the Laboratory's seasons module.
 *
 * Each check is a figure a reader can look up for Tashkent or for the
 * calendar: the noon Sun 72 degrees up at the June solstice and 25 at the
 * December one, a fifteen-hour June day and a nine-hour December day, the
 * solstices on 21 June and 21 December 2026, and Earth closest to the Sun in
 * the first days of January.
 */
import { describe, expect, it } from 'vitest';

import {
  AU_KM,
  CITIES,
  EARTH_TILT_DEG,
  TASHKENT_LAT_DEG,
  calendarDate,
  cityById,
  dayLengthHours,
  dayLengthRange,
  dayOfYearFor,
  declinationDeg,
  equationOfTimeMinutes,
  equinoxesAndSolstices,
  formatClock,
  monthlyDayLengths,
  noonSun,
  noonSunlightFraction,
  perihelionAndAphelion,
  polarNightDays,
  seasonKey,
  seasonKeyAt,
  shadowLengthM,
  sunDistanceAu,
  sunTimes,
} from './seasons';

const JUNE_21 = 172;
const DEC_21 = 355;
const MAR_20 = 79;

describe('the calendar of the Sun', () => {
  it('puts the 2026 equinoxes and solstices on their dates', () => {
    // March 20, June 21, September 23, December 21 2026.
    const [march, june, september, december] = equinoxesAndSolstices();
    expect(Math.abs(march - 79)).toBeLessThanOrEqual(1);
    expect(Math.abs(june - 172)).toBeLessThanOrEqual(1);
    expect(Math.abs(september - 266)).toBeLessThanOrEqual(1);
    expect(Math.abs(december - 355)).toBeLessThanOrEqual(1);
  });

  it('gives the full tilt as the declination at the solstices', () => {
    expect(declinationDeg(JUNE_21)).toBeCloseTo(EARTH_TILT_DEG, 1);
    expect(declinationDeg(DEC_21)).toBeCloseTo(-EARTH_TILT_DEG, 1);
    expect(Math.abs(declinationDeg(MAR_20))).toBeLessThan(0.5);
  });

  it('finds Earth closest to the Sun in early January and farthest in early July', () => {
    const { perihelionDay, aphelionDay } = perihelionAndAphelion();
    expect(perihelionDay).toBeGreaterThanOrEqual(2);
    expect(perihelionDay).toBeLessThanOrEqual(5);
    expect(calendarDate(aphelionDay).month).toBe(6);
    expect((sunDistanceAu(perihelionDay) * AU_KM) / 1e6).toBeCloseTo(147.1, 0);
    expect((sunDistanceAu(aphelionDay) * AU_KM) / 1e6).toBeCloseTo(152.1, 0);
  });

  it('turns a day of the year into a date', () => {
    expect(calendarDate(1)).toEqual({ month: 0, day: 1 });
    expect(calendarDate(JUNE_21)).toEqual({ month: 5, day: 21 });
    expect(calendarDate(365)).toEqual({ month: 11, day: 31 });
  });

  it('turns a date into the day of the year, and back', () => {
    expect(dayOfYearFor(new Date(2030, 5, 21))).toBe(JUNE_21);
    expect(dayOfYearFor(new Date(2031, 0, 1))).toBe(1);
    expect(dayOfYearFor(new Date(2028, 1, 29))).toBe(59);
    expect(calendarDate(dayOfYearFor(new Date(2027, 9, 21)))).toEqual({ month: 9, day: 21 });
  });
});

describe('the noon Sun over Tashkent', () => {
  it('stands about 72 degrees up at the June solstice', () => {
    const sun = noonSun(TASHKENT_LAT_DEG, declinationDeg(JUNE_21));
    expect(sun.altitudeDeg).toBeGreaterThan(71.9);
    expect(sun.altitudeDeg).toBeLessThan(72.3);
    expect(sun.side).toBe('south');
  });

  it('stands about 25 degrees up at the December solstice', () => {
    const sun = noonSun(TASHKENT_LAT_DEG, declinationDeg(DEC_21));
    expect(sun.altitudeDeg).toBeGreaterThan(25.1);
    expect(sun.altitudeDeg).toBeLessThan(25.5);
  });

  it('is north of the zenith in the tropics in June', () => {
    const sun = noonSun(10, EARTH_TILT_DEG);
    expect(sun.side).toBe('north');
    expect(sun.altitudeDeg).toBeCloseTo(76.56, 2);
  });

  it('casts a shadow as long as the stick at 45 degrees, and none below the horizon', () => {
    expect(shadowLengthM(45)).toBeCloseTo(1, 9);
    expect(shadowLengthM(-3)).toBeNull();
  });
});

describe('how long the day lasts', () => {
  it('is about fifteen hours in Tashkent in June', () => {
    const hours = dayLengthHours(TASHKENT_LAT_DEG, declinationDeg(JUNE_21));
    expect(hours).toBeGreaterThan(14.9);
    expect(hours).toBeLessThan(15.3);
  });

  it('is about nine hours twelve minutes in Tashkent in December', () => {
    const hours = dayLengthHours(TASHKENT_LAT_DEG, declinationDeg(DEC_21));
    expect(Math.abs(hours - 9.2)).toBeLessThan(10 / 60);
  });

  it('is about twelve hours at the equinox', () => {
    // A few minutes over twelve: refraction lifts the Sun before it rises.
    const hours = dayLengthHours(TASHKENT_LAT_DEG, declinationDeg(MAR_20));
    expect(hours).toBeGreaterThan(12);
    expect(hours).toBeLessThan(12.3);
  });

  it('is the same every day on a planet with no tilt', () => {
    const lengths = monthlyDayLengths(TASHKENT_LAT_DEG, 0);
    for (const hours of lengths) expect(hours).toBeCloseTo(lengths[0], 9);
    expect(lengths[0]).toBeGreaterThan(12);
    expect(lengths[0]).toBeLessThan(12.3);
  });

  it('never ends above the Arctic Circle in June, and never begins in December', () => {
    expect(dayLengthHours(70, declinationDeg(JUNE_21))).toBe(24);
    expect(dayLengthHours(70, declinationDeg(DEC_21))).toBe(0);
  });

  it('survives a 90-degree tilt, where the Sun sits on the pole', () => {
    expect(dayLengthHours(TASHKENT_LAT_DEG, 90)).toBe(24);
    expect(dayLengthHours(TASHKENT_LAT_DEG, -90)).toBe(0);
  });
});

describe('the seasons', () => {
  it('names the northern season by the Sun’s place on the ecliptic', () => {
    expect(seasonKey(JUNE_21 + 5)).toBe('seasonSummer');
    expect(seasonKey(DEC_21 + 5)).toBe('seasonWinter');
    expect(seasonKey(120)).toBe('seasonSpring');
    expect(seasonKey(300)).toBe('seasonAutumn');
  });

  it('has none without a tilt', () => {
    expect(seasonKey(JUNE_21, 0)).toBe('seasonNone');
  });

  it('runs the other way round in the southern hemisphere, and hardly at all on the equator', () => {
    const capeTown = cityById('CapeTown');
    expect(seasonKeyAt(JUNE_21 + 5, EARTH_TILT_DEG, capeTown.latDeg)).toBe('seasonWinter');
    expect(seasonKeyAt(DEC_21 + 5, EARTH_TILT_DEG, capeTown.latDeg)).toBe('seasonSummer');
    expect(seasonKeyAt(120, EARTH_TILT_DEG, capeTown.latDeg)).toBe('seasonAutumn');
    expect(seasonKeyAt(JUNE_21 + 5, EARTH_TILT_DEG, TASHKENT_LAT_DEG)).toBe('seasonSummer');
    expect(seasonKeyAt(JUNE_21, EARTH_TILT_DEG, cityById('Quito').latDeg)).toBe('seasonEquator');
    expect(seasonKeyAt(JUNE_21, 0, capeTown.latDeg)).toBe('seasonNone');
  });

  it('puts the noon Sun in the north for a southern city', () => {
    expect(noonSun(cityById('CapeTown').latDeg, declinationDeg(JUNE_21)).side).toBe('north');
  });
});

describe('the cities', () => {
  it('each have a sensible place and a whole-hour time zone', () => {
    for (const city of CITIES) {
      expect(Math.abs(city.latDeg)).toBeLessThan(90);
      expect(Math.abs(city.lonDeg)).toBeLessThanOrEqual(180);
      expect(Number.isInteger(city.utcOffset)).toBe(true);
    }
    expect(cityById('Tashkent').latDeg).toBe(TASHKENT_LAT_DEG);
    expect(cityById('nowhere')).toBe(CITIES[0]);
  });
});

describe('sunrise and sunset on the clock', () => {
  const minutes = (hours) => hours * 60;

  it('runs a sundial 16 minutes fast in early November and 14 slow in mid-February', () => {
    expect(equationOfTimeMinutes(307)).toBeGreaterThan(16);
    expect(equationOfTimeMinutes(307)).toBeLessThan(17);
    expect(equationOfTimeMinutes(42)).toBeGreaterThan(-14.6);
    expect(equationOfTimeMinutes(42)).toBeLessThan(-13.6);
  });

  it('gives Tashkent a sunrise near 04:50 and a sunset near 20:00 at the June solstice', () => {
    const times = sunTimes(JUNE_21, cityById('Tashkent'));
    expect(Math.abs(minutes(times.rise) - minutes(4 + 50 / 60))).toBeLessThan(6);
    expect(Math.abs(minutes(times.set) - minutes(20))).toBeLessThan(6);
  });

  it('gives Tashkent a sunrise near 07:46 and a sunset near 16:57 at the December solstice', () => {
    const times = sunTimes(DEC_21, cityById('Tashkent'));
    expect(Math.abs(minutes(times.rise) - minutes(7 + 46 / 60))).toBeLessThan(6);
    expect(Math.abs(minutes(times.set) - minutes(16 + 57 / 60))).toBeLessThan(6);
  });

  it('brings the Sun up later in Nukus, nearly ten degrees west on the same clock', () => {
    const tashkent = sunTimes(JUNE_21, cityById('Tashkent'));
    const nukus = sunTimes(JUNE_21, cityById('Nukus'));
    expect(minutes(nukus.noon - tashkent.noon)).toBeCloseTo((69.24 - 59.6) * 4, 6);
  });

  it('has no sunrise in a Murmansk December and no sunset in its June', () => {
    expect(sunTimes(DEC_21, cityById('Murmansk'))).toMatchObject({ polar: 'night', rise: null, set: null });
    expect(sunTimes(JUNE_21, cityById('Murmansk')).polar).toBe('day');
  });

  it('writes a clock time the way a clock does', () => {
    expect(formatClock(4 + 50 / 60)).toBe('04:50');
    expect(formatClock(24.5)).toBe('00:30');
    expect(formatClock(-0.25)).toBe('23:45');
  });
});

describe('what the year looks like in a place', () => {
  it('gives Murmansk about forty days without a sunrise', () => {
    // Polar night there runs from early December to about 11 January.
    const days = polarNightDays(cityById('Murmansk').latDeg);
    expect(days).toBeGreaterThanOrEqual(36);
    expect(days).toBeLessThanOrEqual(44);
    expect(polarNightDays(TASHKENT_LAT_DEG)).toBe(0);
  });

  it('keeps the day in Quito within a couple of minutes of the same length all year', () => {
    const { min, max } = dayLengthRange(cityById('Quito').latDeg);
    expect((max - min) * 60).toBeLessThan(3);
    expect(min).toBeGreaterThan(12);
  });

  it('weakens the noon sunlight as the Sun gets lower', () => {
    expect(noonSunlightFraction(90)).toBeCloseTo(1, 9);
    expect(noonSunlightFraction(30)).toBeCloseTo(0.5, 9);
    expect(noonSunlightFraction(-2)).toBe(0);
  });
});
