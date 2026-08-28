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
 * The Apollo 11 ascent, as far as it can be stated from a source.
 *
 * Three points, and the two in the middle are the ones NASA publishes: the
 * first stage burns about two and a half minutes and reaches roughly 61 km
 * (38 miles), and the second stage burns about six minutes more and reaches
 * roughly 185 km (115 miles). Between those points the trace is a straight
 * interpolation and the page says so - it is a reading aid, not a claim about
 * how the altitude actually built up.
 *
 * The run stops at second-stage cutoff. The third stage's burn to parking
 * orbit is described in the Apollo module, where it does not need a duration
 * we cannot source.
 */
export const APOLLO_11_ASCENT = {
  events: [
    { id: 'liftoff', atS: 0, altitudeKm: 0, labelKey: 'apolloEventLiftoff' },
    { id: 'meco', atS: 150, altitudeKm: 61, labelKey: 'apolloEventMeco' },
    { id: 'seco', atS: 510, altitudeKm: 185, labelKey: 'apolloEventSeco' },
  ],
  /** Which stage is pushing, and what it pushes with. Constants, not sliders. */
  stages: [
    {
      untilS: 150,
      partId: 's-ic',
      nameKey: 'apolloSicName',
      thrust: '33,900 kN (7,610,000 lbf)',
      source: SOURCES.stage1,
    },
    {
      untilS: 510,
      partId: 's-ii',
      nameKey: 'apolloSiiName',
      thrust: '4,450 kN (1,000,000 lbf)',
      source: SOURCES.stage2,
    },
  ],
  /** Top of the drawn altitude column, in km. */
  ceilingKm: 200,
};

/** Altitude in km at a simulated time, interpolated between the sourced points. */
export function altitudeKmAt(seconds) {
  const { events } = APOLLO_11_ASCENT;
  if (seconds <= events[0].atS) return events[0].altitudeKm;
  for (let i = 1; i < events.length; i += 1) {
    const previous = events[i - 1];
    const next = events[i];
    if (seconds <= next.atS) {
      const across = (seconds - previous.atS) / (next.atS - previous.atS);
      return previous.altitudeKm + (next.altitudeKm - previous.altitudeKm) * across;
    }
  }
  return events[events.length - 1].altitudeKm;
}

/** The stage burning at a simulated time, or null once the run is over. */
export function stageAt(seconds) {
  return APOLLO_11_ASCENT.stages.find((stage) => seconds < stage.untilS) ?? null;
}

/** How much of the current stage's burn is left, 1 at ignition and 0 at cutoff. */
export function burnRemaining(seconds) {
  const stage = stageAt(seconds);
  if (!stage) return 0;
  const index = APOLLO_11_ASCENT.stages.indexOf(stage);
  const startedAt = index === 0 ? 0 : APOLLO_11_ASCENT.stages[index - 1].untilS;
  return 1 - (seconds - startedAt) / (stage.untilS - startedAt);
}

/** `T+MM:SS` for a simulated flight time in seconds. */
export function missionClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const remainder = String(whole % 60).padStart(2, '0');
  return `T+${minutes}:${remainder}`;
}
