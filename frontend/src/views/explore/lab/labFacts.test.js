/**
 * The Apollo figures, and the shape of the stack that is drawn from them.
 *
 * Pure data and pure functions, so this is an ordinary unit test rather than
 * the source-shape kind the scenes need. Two things are being protected:
 *
 * - Nothing is printed to a child without a source beside it. The launch
 *   simulator used to show `7600 * speed` kN of thrust, where `speed` is the
 *   animation rate; that is the class of claim this stops.
 * - The stack tiles its own height. The other rocket in the lab had its second
 *   stage buried 0.575 units inside its first and its engine bell below the
 *   pad, because nothing ever added the sections up.
 */
import { describe, expect, it } from 'vitest';

import {
  APOLLO_11_ASCENT,
  SATURN_V,
  SATURN_V_STACK,
  SOURCES,
  altitudeKmAt,
  burnRemaining,
  explodeOffsetM,
  missionClock,
  readFact,
  sections,
  stageAt,
} from './labFacts';

describe('every figure names where it came from', () => {
  it('the vehicle itself does', () => {
    expect(SATURN_V.source).toMatch(/NASA/);
    expect(SATURN_V.facts.length).toBeGreaterThan(0);
  });

  it.each(SATURN_V_STACK.map((part) => [part.id, part]))('%s does', (_id, part) => {
    expect(part.source, 'a part with facts and no source').toMatch(/NASA/);
    expect(part.facts.length).toBeGreaterThan(0);
  });

  it('every source is one of the named ones, so two stages cannot drift apart', () => {
    const known = Object.values(SOURCES);
    for (const part of SATURN_V_STACK) {
      expect(known, `${part.id}`).toContain(part.source);
    }
  });

  it('a fact is either a written value or a locale key, never both and never neither', () => {
    const facts = [...SATURN_V.facts, ...SATURN_V_STACK.flatMap((p) => p.facts)];
    for (const fact of facts) {
      const written = fact.value !== undefined;
      const translated = fact.valueKey !== undefined;
      expect(written !== translated, `${fact.key}: ${JSON.stringify(fact)}`).toBe(true);
    }
  });

  it('no figure is a formula in disguise', () => {
    // Numbers are read from a source and written down. If one is ever computed
    // from a UI control again, it stops being a fact.
    const written = SATURN_V_STACK.flatMap((p) => p.facts)
      .map((f) => f.value)
      .filter(Boolean);
    expect(written.length).toBeGreaterThan(5);
    for (const value of written) expect(typeof value).toBe('string');
  });
});

describe('the drawn stack matches the height it claims', () => {
  const drawn = sections();

  it('starts at the bottom of the first stage', () => {
    expect(drawn[0].fromM).toBe(0);
  });

  it('ends at the height the page prints', () => {
    expect(drawn[drawn.length - 1].toM).toBe(SATURN_V.heightM);
    expect(SATURN_V.facts.find((f) => f.key === 'apolloFactHeight').value).toContain(
      String(SATURN_V.heightM),
    );
  });

  it('has no gap and no overlap between sections', () => {
    const seams = [];
    for (let i = 1; i < drawn.length; i += 1) {
      if (drawn[i].fromM !== drawn[i - 1].toM) {
        seams.push(`${drawn[i - 1].partId} ends ${drawn[i - 1].toM}, ${drawn[i].partId} starts ${drawn[i].fromM}`);
      }
    }
    expect(seams).toEqual([]);
  });

  it('every section has height and is never inside out', () => {
    for (const section of drawn) {
      expect(section.toM, section.partId).toBeGreaterThan(section.fromM);
      expect(section.bottomRadiusM, section.partId).toBeGreaterThan(0);
      expect(section.topRadiusM, section.partId).toBeGreaterThan(0);
    }
  });

  it('is no wider than the diameter it prints', () => {
    const widest = Math.max(...drawn.flatMap((s) => [s.bottomRadiusM, s.topRadiusM]));
    expect(widest * 2).toBeLessThanOrEqual(SATURN_V.diameterM);
  });

  it('never has a part overhanging the one below it', () => {
    // A section that starts wider than the thing under it ends leaves the hull
    // jutting out into nothing. Narrower is fine and real - the escape tower is
    // a thin lattice standing on the Command Module's nose.
    for (let i = 1; i < drawn.length; i += 1) {
      expect(
        drawn[i].bottomRadiusM,
        `${drawn[i - 1].partId} -> ${drawn[i].partId} overhangs`,
      ).toBeLessThanOrEqual(drawn[i - 1].topRadiusM + 1e-9);
    }
  });
});

describe('reading a fact', () => {
  const t = (section, key) => `${section}:${key}`;

  it('translates the label', () => {
    expect(readFact({ key: 'apolloFactThrust', value: '890 kN' }, t).label).toBe(
      'lab:apolloFactThrust',
    );
  });

  it('leaves a written figure exactly as it was written', () => {
    expect(readFact({ key: 'apolloFactThrust', value: '890 kN' }, t).value).toBe('890 kN');
  });

  it('translates a value that is a sentence', () => {
    expect(readFact({ key: 'apolloFactBurn', valueKey: 'apolloBurnSic' }, t).value).toBe(
      'lab:apolloBurnSic',
    );
  });
});

describe('the exploded view', () => {
  it('leaves the stack alone when it is closed', () => {
    for (let i = 0; i < SATURN_V_STACK.length; i += 1) {
      expect(explodeOffsetM(i, 0)).toBe(0);
    }
  });

  it('never pulls a part below the one under it', () => {
    for (let i = 1; i < SATURN_V_STACK.length; i += 1) {
      expect(explodeOffsetM(i, 1)).toBeGreaterThan(explodeOffsetM(i - 1, 1));
    }
  });
});

describe('the ascent, read off the profile rather than off a slider', () => {
  it('every event sits at or after the one before it, and higher', () => {
    const { events } = APOLLO_11_ASCENT;
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i].atS).toBeGreaterThan(events[i - 1].atS);
      expect(events[i].altitudeKm).toBeGreaterThan(events[i - 1].altitudeKm);
    }
  });

  it('the drawn column is tall enough to hold the whole profile', () => {
    const highest = Math.max(...APOLLO_11_ASCENT.events.map((e) => e.altitudeKm));
    expect(APOLLO_11_ASCENT.ceilingKm).toBeGreaterThanOrEqual(highest);
  });

  it('altitude passes exactly through the sourced points', () => {
    for (const event of APOLLO_11_ASCENT.events) {
      expect(altitudeKmAt(event.atS), event.id).toBeCloseTo(event.altitudeKm, 6);
    }
  });

  it('altitude never goes backwards and never leaves the ground early', () => {
    let previous = -1;
    for (let s = 0; s <= 600; s += 5) {
      const altitude = altitudeKmAt(s);
      expect(altitude).toBeGreaterThanOrEqual(previous);
      previous = altitude;
    }
    expect(altitudeKmAt(0)).toBe(0);
    expect(altitudeKmAt(-10)).toBe(0);
  });

  it('holds at the last sourced altitude rather than extrapolating past it', () => {
    // The third stage's burn is not in the profile because we have no source
    // for its length; the trace must stop, not invent a continuation.
    const last = APOLLO_11_ASCENT.events[APOLLO_11_ASCENT.events.length - 1];
    expect(altitudeKmAt(last.atS + 500)).toBe(last.altitudeKm);
  });

  it('names the stage that is actually burning', () => {
    expect(stageAt(0).partId).toBe('s-ic');
    expect(stageAt(149).partId).toBe('s-ic');
    expect(stageAt(150).partId).toBe('s-ii');
    expect(stageAt(509).partId).toBe('s-ii');
    expect(stageAt(510)).toBeNull();
  });

  it('quotes each stage the thrust the stack data quotes', () => {
    // One vehicle, one set of numbers. A stage that disagrees with itself
    // between two screens is the bug this stops.
    for (const stage of APOLLO_11_ASCENT.stages) {
      const part = SATURN_V_STACK.find((p) => p.id === stage.partId);
      const thrust = part.facts.find((f) => f.key === 'apolloFactThrust');
      expect(stage.thrust, stage.partId).toBe(thrust.value);
      expect(stage.source, stage.partId).toBe(part.source);
    }
  });

  it('counts a stage burn down from full to empty', () => {
    expect(burnRemaining(0)).toBeCloseTo(1, 6);
    expect(burnRemaining(75)).toBeCloseTo(0.5, 6);
    expect(burnRemaining(150)).toBeCloseTo(1, 6);
    expect(burnRemaining(330)).toBeCloseTo(0.5, 6);
    expect(burnRemaining(510)).toBe(0);
    expect(burnRemaining(9999)).toBe(0);
  });

  it('the mission clock reads the way a launch commentary does', () => {
    expect(missionClock(0)).toBe('T+00:00');
    expect(missionClock(9.9)).toBe('T+00:09');
    expect(missionClock(150)).toBe('T+02:30');
    expect(missionClock(510)).toBe('T+08:30');
    expect(missionClock(-5)).toBe('T+00:00');
  });
});
