/**
 * Everything the Laboratory states as fact about Apollo, and where each figure
 * came from.
 *
 * This is a teaching product for ten-to-eighteen-year-olds, so a number on the
 * screen is a claim we are making to a child. Two rules hold here:
 *
 * 1. Every figure carries the source it was read from, and the source is shown
 *    on the page next to it — not kept in a comment where nobody checks it.
 * 2. A measurement we could not find a source for is not printed. The stack
 *    below has to be drawn to *some* proportion, so the section boundaries are
 *    modelling numbers; only `heightM`, `diameterM` and the first stage's 42 m
 *    are quoted to the reader, because those are the ones NASA states.
 *
 * The launch simulator next door used to print `7600 * speed` kN of thrust and
 * `100 - speed * 22` per cent of fuel, where `speed` is how fast the animation
 * plays. That is where this file's rules come from: it taught that a rocket
 * pushes harder when you watch it faster.
 */

/** Named once so the same string cannot drift between two stages. */
export const SOURCES = {
  stage1:
    'NASA Science, "Saturn V - Stage 1"; NASA MSFC, "Saturn V Stage I (S-IC) Overview" (NTRS 20090016301)',
  stage2: 'NASA Science, "Saturn V - Stage 2"',
  stage3: 'NASA, "Rocketdyne J-2, Saturn V 2nd and 3rd Stage Engine" (NTRS 20100027318)',
  vehicle: 'NASA, "What Was the Saturn V?"',
  apollo11: 'NASA, Apollo 11 mission overview',
  /** The comparisons a child can picture: a building, elephants, school buses. */
  nasaKids: 'NASA, "What Was the Saturn V? (Grades 5-8)"',
  /** Event times as called on the air-to-ground loop, and the parking orbit. */
  afj: 'NASA, Apollo Flight Journal - Apollo 11, "Launch and Reaching Earth Orbit"',
  /** Altitude and velocity at each event of the real Apollo 11 ascent. */
  as506:
    'NASA MSFC, "Saturn V Launch Vehicle Flight Evaluation Report - AS-506 Apollo 11 Mission" (MPR-SAT-FE-69-9, 1969)',
  tower: 'CTBUH, The Skyscraper Center - Tashkent Tower, 375 m',
};

/** Figures for the vehicle as a whole. Shown above the stage list. */
export const SATURN_V = {
  /** 363 ft. */
  heightM: 110.6,
  /** 33 ft, across the first two stages. */
  diameterM: 10.1,
  facts: [
    { key: 'apolloFactHeight', value: '110.6 m (363 ft)' },
    { key: 'apolloFactDiameter', value: '10.1 m (33 ft)' },
    { key: 'apolloFactFlight', valueKey: 'apolloFactFlightValue' },
  ],
  source: `${SOURCES.vehicle}; ${SOURCES.apollo11}`,
};

/**
 * The stack, bottom to top, in metres above the base of the first stage.
 *
 * `sections` are what gets drawn: each is a truncated cone, so a cylinder is
 * one with two equal radii. They tile the whole 110.6 m with no gap and no
 * overlap, which `labFacts.test.js` checks — the launch simulator next door had
 * its second stage buried 0.6 units inside its first, and nothing noticed.
 */
export const SATURN_V_STACK = [
  {
    id: 's-ic',
    nameKey: 'apolloSicName',
    roleKey: 'apolloSicRole',
    accent: '#ff9a4d',
    sections: [{ fromM: 0, toM: 42, bottomRadiusM: 5.05, topRadiusM: 5.05 }],
    facts: [
      { key: 'apolloFactEngines', value: '5 x Rocketdyne F-1' },
      { key: 'apolloFactThrust', value: '33,900 kN (7,610,000 lbf)' },
      { key: 'apolloFactPropellant', valueKey: 'apolloPropKerolox' },
      { key: 'apolloFactBurn', valueKey: 'apolloBurnSic' },
      { key: 'apolloFactHeight', value: '42 m (138 ft)' },
    ],
    source: SOURCES.stage1,
  },
  {
    id: 's-ii',
    nameKey: 'apolloSiiName',
    roleKey: 'apolloSiiRole',
    accent: '#ffd166',
    sections: [
      { fromM: 42, toM: 66.8, bottomRadiusM: 5.05, topRadiusM: 5.05 },
      { fromM: 66.8, toM: 70, bottomRadiusM: 5.05, topRadiusM: 3.3 },
    ],
    facts: [
      { key: 'apolloFactEngines', value: '5 x Rocketdyne J-2' },
      { key: 'apolloFactThrust', value: '4,450 kN (1,000,000 lbf)' },
      { key: 'apolloFactPropellant', valueKey: 'apolloPropHydrolox' },
      { key: 'apolloFactBurn', valueKey: 'apolloBurnSii' },
    ],
    source: SOURCES.stage2,
  },
  {
    id: 's-ivb',
    nameKey: 'apolloSivbName',
    roleKey: 'apolloSivbRole',
    accent: '#7de3ff',
    sections: [{ fromM: 70, toM: 87.8, bottomRadiusM: 3.3, topRadiusM: 3.3 }],
    facts: [
      { key: 'apolloFactEngines', value: '1 x Rocketdyne J-2' },
      { key: 'apolloFactThrust', value: '890 kN (200,000 lbf)' },
      { key: 'apolloFactPropellant', valueKey: 'apolloPropHydrolox' },
      { key: 'apolloFactBurn', valueKey: 'apolloBurnSivb' },
    ],
    source: SOURCES.stage3,
  },
  {
    id: 'spacecraft',
    nameKey: 'apolloSpacecraftName',
    roleKey: 'apolloSpacecraftRole',
    accent: '#c9d6e6',
    sections: [
      // The adapter, with the Lunar Module folded inside it.
      { fromM: 87.8, toM: 95.5, bottomRadiusM: 3.3, topRadiusM: 1.95 },
      // Service Module.
      { fromM: 95.5, toM: 103, bottomRadiusM: 1.95, topRadiusM: 1.95 },
      // Command Module.
      { fromM: 103, toM: 106.5, bottomRadiusM: 1.95, topRadiusM: 0.6 },
    ],
    facts: [
      { key: 'apolloFactCrew', value: '3' },
      { key: 'apolloFactParts', valueKey: 'apolloSpacecraftParts' },
      { key: 'apolloFactReturns', valueKey: 'apolloSpacecraftReturns' },
    ],
    source: SOURCES.apollo11,
  },
  {
    id: 'les',
    nameKey: 'apolloLesName',
    roleKey: 'apolloLesRole',
    accent: '#ff6b6b',
    sections: [{ fromM: 106.5, toM: 110.6, bottomRadiusM: 0.42, topRadiusM: 0.42 }],
    facts: [{ key: 'apolloFactWhen', valueKey: 'apolloLesJettison' }],
    source: SOURCES.apollo11,
  },
];

/** Every drawn section of the stack, bottom to top. */
export function sections() {
  return SATURN_V_STACK.flatMap((part) =>
    part.sections.map((section) => ({ ...section, partId: part.id, accent: part.accent })),
  );
}

/**
 * A fact turned into two strings for the screen.
 *
 * Facts come in two shapes on purpose. A number with a unit is the same in
 * every language and is stored as written; anything that is a sentence is a
 * locale key, because it has to be readable in Uzbek and Russian too.
 */
export function readFact(fact, t) {
  return {
    label: t('lab', fact.key),
    value: fact.valueKey ? t('lab', fact.valueKey) : fact.value,
  };
}

/**
 * How far each part is pushed apart in the exploded view, in metres.
 *
 * Everything above a part moves with it, so the stack opens up like a drawing
 * rather than passing through itself.
 */
export function explodeOffsetM(partIndex, amount) {
  return partIndex * 6 * amount;
}

/**
 * The Apollo 11 ascent, all the way to Earth orbit, as the flight records give it.
 *
 * Two NASA records, and each is used for what it is good at:
 *
 * - The Apollo Flight Journal gives the moments the crew and Houston called
 *   out: the roll program at 13 s and Max-Q at 1:23, which the engineering
 *   report does not tabulate.
 * - The launch vehicle's flight evaluation report (AS-506) gives, for each
 *   engine and staging event, the time to a tenth of a second and the altitude
 *   and velocity the vehicle had at that moment. Its insertion velocity,
 *   25,567.9 ft/s, is the 25,568 ft/s Armstrong read out on the loop.
 *
 * Values are converted from the report's feet and feet per second and rounded
 * (0.1 km, 1 m/s). Between two events the page joins the points with straight
 * lines and says so: the line is a reading aid, not a measurement.
 *
 * The previous version stopped at second-stage cutoff with three points from
 * NASA's general Saturn V pages, because no source for the third stage's burn
 * had been found. The report is that source: the S-IVB burned 150 s, from
 * 9:09.2 to 11:39.3, and Apollo 11 was in parking orbit at 11:49.3.
 */
export const APOLLO_11_ASCENT = {
  events: [
    { id: 'liftoff', atS: 0, altitudeKm: 0, velocityMs: 0, labelKey: 'apolloEventLiftoff', source: SOURCES.afj },
    { id: 'roll', atS: 13, labelKey: 'launchEventRoll', source: SOURCES.afj },
    { id: 'maxq', atS: 83, labelKey: 'launchEventMaxQ', source: SOURCES.afj },
    { id: 'ceco', atS: 135.2, altitudeKm: 44.4, velocityMs: 1983, labelKey: 'launchEventCeco', source: SOURCES.as506 },
    { id: 'meco', atS: 161.6, altitudeKm: 66.3, velocityMs: 2753, labelKey: 'apolloEventMeco', source: SOURCES.as506 },
    { id: 'staging1', atS: 162.3, altitudeKm: 67.1, velocityMs: 2763, labelKey: 'launchEventStaging1', source: SOURCES.as506 },
    { id: 'tower', atS: 197.9, altitudeKm: 96, velocityMs: 2980, labelKey: 'launchEventTower', source: SOURCES.as506 },
    { id: 's2ceco', atS: 460.6, altitudeKm: 179.3, velocityMs: 5719, labelKey: 'launchEventS2Ceco', source: SOURCES.as506 },
    { id: 'seco', atS: 548.2, altitudeKm: 185.9, velocityMs: 6933, labelKey: 'apolloEventSeco', source: SOURCES.as506 },
    { id: 'staging2', atS: 549.2, altitudeKm: 185.9, velocityMs: 6936, labelKey: 'launchEventStaging2', source: SOURCES.as506 },
    { id: 's4cutoff', atS: 699.3, velocityMs: 7791, labelKey: 'launchEventS4Cutoff', source: SOURCES.as506 },
    { id: 'orbit', atS: 709.3, altitudeKm: 188.3, velocityMs: 7793, labelKey: 'launchEventOrbit', source: SOURCES.as506 },
  ],
  /**
   * Which stage is pushing, from ignition to cutoff, and what it pushes with.
   * The gaps between them are real: the first stage cuts off at 161.6 s and
   * the second lights at 163.0 s. `flame` is what the exhaust looks like:
   * kerosene burns bright orange, hydrogen almost invisibly.
   */
  stages: [
    {
      startS: 0,
      untilS: 161.6,
      partId: 's-ic',
      nameKey: 'apolloSicName',
      thrust: '33,900 kN (7,610,000 lbf)',
      source: SOURCES.stage1,
      flame: 'kerosene',
    },
    {
      startS: 163,
      untilS: 548.2,
      partId: 's-ii',
      nameKey: 'apolloSiiName',
      thrust: '4,450 kN (1,000,000 lbf)',
      source: SOURCES.stage2,
      flame: 'hydrogen',
    },
    {
      startS: 549.2,
      untilS: 699.3,
      partId: 's-ivb',
      nameKey: 'apolloSivbName',
      thrust: '890 kN (200,000 lbf)',
      source: SOURCES.stage3,
      flame: 'hydrogen',
    },
  ],
  /** Top of the drawn altitude column, in km. */
  ceilingKm: 200,
  /** The parking orbit Collins read out at cutoff, in nautical miles. */
  parkingOrbitNmi: [101.4, 103.6],
};

/** When the run ends: Earth parking orbit insertion. */
export const ORBIT_INSERTION_S = APOLLO_11_ASCENT.events.find((e) => e.id === 'orbit').atS;

/** Straight-line reading between the events that carry `field`, held at both ends. */
function profileAt(seconds, field) {
  const points = APOLLO_11_ASCENT.events.filter((event) => event[field] !== undefined);
  if (seconds <= points[0].atS) return points[0][field];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const next = points[i];
    if (seconds <= next.atS) {
      const across = (seconds - previous.atS) / (next.atS - previous.atS);
      return previous[field] + (next[field] - previous[field]) * across;
    }
  }
  return points[points.length - 1][field];
}

/** Altitude in km at a simulated time, interpolated between the sourced points. */
export function altitudeKmAt(seconds) {
  return profileAt(seconds, 'altitudeKm');
}

/** Velocity in m/s at a simulated time, interpolated between the sourced points. */
export function velocityMsAt(seconds) {
  return profileAt(seconds, 'velocityMs');
}

/** The stage burning at a simulated time, or null between stages and after the last. */
export function stageAt(seconds) {
  return APOLLO_11_ASCENT.stages.find((stage) => seconds >= stage.startS && seconds < stage.untilS) ?? null;
}

/** How much of the current stage's burn is left, 1 at ignition and 0 at cutoff. */
export function burnRemaining(seconds) {
  const stage = stageAt(seconds);
  if (!stage) return 0;
  return 1 - (seconds - stage.startS) / (stage.untilS - stage.startS);
}

/** Every event that has happened by `seconds`, in order. */
export function eventsReached(seconds) {
  return APOLLO_11_ASCENT.events.filter((event) => event.atS <= seconds);
}

/** The next event after `seconds`, or null once the vehicle is in orbit. */
export function nextEvent(seconds) {
  return APOLLO_11_ASCENT.events.find((event) => event.atS > seconds) ?? null;
}

/**
 * Things of known height to stand beside the rocket, for a reader who cannot
 * picture 110.6 m. The building and the statue are NASA's own comparisons
 * ("about the height of a 36-story-tall building", "18 meters (60 feet) taller
 * than the Statue of Liberty"); the TV tower is Tashkent's, because a reader
 * here has seen it. The shapes drawn for them are sketches - only the heights
 * are to scale, and the page says so.
 */
export const SIZE_COMPARISONS = [
  { id: 'none', labelKey: 'apolloCompareNone' },
  { id: 'person', labelKey: 'apolloComparePerson', noteKey: 'apolloCompareNotePerson', heightM: 1.8, widthM: 0.5 },
  {
    id: 'building',
    labelKey: 'apolloCompareBuilding',
    noteKey: 'apolloCompareNoteBuilding',
    heightM: 111,
    widthM: 32,
    floors: 36,
    source: SOURCES.nasaKids,
  },
  {
    id: 'liberty',
    labelKey: 'apolloCompareLiberty',
    noteKey: 'apolloCompareNoteLiberty',
    heightM: 93,
    widthM: 30,
    source: SOURCES.nasaKids,
    // CC BY 4.0 asks for this credit wherever the model is shown.
    modelCredit: '3D model "Statue Of Liberty" by gravityjack (Sketchfab), CC BY 4.0',
  },
  {
    id: 'tower',
    labelKey: 'apolloCompareTower',
    noteKey: 'apolloCompareNoteTower',
    heightM: 375,
    widthM: 40,
    source: SOURCES.tower,
    modelCredit: '3D model "Tashkent TV Tower" by qsardor57913 (Sketchfab), CC BY 4.0',
  },
];

/**
 * "Did you know?" for the Saturn V hologram. Each fact is a locale key, and
 * the figures in it are read from the named source.
 */
export const APOLLO_FACTS = [
  { key: 'apolloFactKids1', source: SOURCES.nasaKids },
  { key: 'apolloFactKids2', source: SOURCES.nasaKids },
  { key: 'apolloFactKids3', source: SOURCES.nasaKids },
  { key: 'apolloFactKids4', source: SOURCES.nasaKids },
  { key: 'apolloFactKids5', source: SOURCES.nasaKids },
  { key: 'apolloFactKids6', source: SOURCES.apollo11 },
];

/** "Did you know?" for the launch: what happened on the way up. */
export const LAUNCH_FACTS = [
  { key: 'launchFact1', source: SOURCES.afj },
  { key: 'launchFact2', source: SOURCES.afj },
  { key: 'launchFact3', source: SOURCES.as506 },
  { key: 'launchFact4', source: `${SOURCES.afj}; ${SOURCES.as506}` },
  { key: 'launchFact5', source: SOURCES.afj },
  { key: 'launchFact6', source: SOURCES.as506 },
];

/** `T+MM:SS` for a simulated flight time in seconds. */
export function missionClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const remainder = String(whole % 60).padStart(2, '0');
  return `T+${minutes}:${remainder}`;
}
