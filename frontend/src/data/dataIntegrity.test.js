/**
 * Static content data must hold its shape.
 *
 * Findings (22 Aug 2026 audit):
 *  - three topics had no `titleRu`, so the Russian UI silently showed the Uzbek
 *    title — the translation fallback hides this rather than failing;
 *  - `newsData` carried three incompatible shapes across seven entries, and the
 *    checks for it lived here until 28 August 2026. The data is gone with the
 *    News rebuild — the page no longer invents articles when the API is down —
 *    so what replaced those checks is `views/community/newsHonesty.test.jsx`,
 *    which asserts the stronger thing: that no such fallback exists.
 */
import { describe, expect, it } from 'vitest';

import { locations, stars as featuredStars } from './stars';
import { starsByHr } from './skyCatalog';

import { astronomyTopicsData } from './astronomyTopicsData';
import { creativityTopicsData } from './creativityTopicsData';
import { interviewsTopicsData } from './interviewsTopicsData';
import { physicsTopicsData } from './physicsTopicsData';

const TOPIC_SETS = {
  astronomyTopicsData,
  creativityTopicsData,
  interviewsTopicsData,
  physicsTopicsData,
};

describe('topic titles exist in every language', () => {
  for (const [name, topics] of Object.entries(TOPIC_SETS)) {
    it(`${name} has a Russian title for every entry`, () => {
      // These are objects keyed by id, not arrays.
      const list = Array.isArray(topics) ? topics : Object.values(topics ?? {});
      expect(list.length).toBeGreaterThan(0);
      const missing = list.filter((t) => !t.titleRu || !String(t.titleRu).trim());
      expect(
        missing.map((t) => t.title),
        'without titleRu the Russian UI falls back to the Uzbek title',
      ).toEqual([]);
    });

    it(`${name} has unique ids`, () => {
      const list = Array.isArray(topics) ? topics : Object.values(topics ?? {});
      const ids = list.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});

/**
 * The 25 featured stars are hand-written prose with an `hr` field pointing at
 * the generated catalogue. That pointer is the only thing tying a story to a
 * real position, and nothing crashes if it is wrong -- the sky view just
 * highlights a different star, or none. So it is checked here.
 */
describe('the featured stars point at real catalogue entries', () => {
  it('gives every featured star a Harvard Revised number', () => {
    for (const star of featuredStars) {
      expect(Number.isInteger(star.hr), star.id).toBe(true);
    }
  });

  it('finds every one of those numbers in the catalogue', () => {
    for (const star of featuredStars) {
      expect(starsByHr.has(star.hr), `${star.id} (HR ${star.hr})`).toBe(true);
    }
  });

  it('points each one at a star of the name it claims', () => {
    // `name` here is prose -- "Polaris (North Star)" -- so this checks that the
    // catalogue's IAU name is in it, which catches an hr copied from the row
    // above far more reliably than checking the number exists.
    for (const star of featuredStars) {
      const catalogued = starsByHr.get(star.hr);
      expect(catalogued.name, star.id).toBeTruthy();
      expect(
        star.name.toLowerCase().includes(catalogued.name.toLowerCase()),
        `${star.id} says "${star.name}" but HR ${star.hr} is ${catalogued.name}`,
      ).toBe(true);
    }
  });

  it('gives every location a latitude and longitude the sky view can use', () => {
    for (const location of locations) {
      expect(Math.abs(location.lat), location.id).toBeLessThanOrEqual(90);
      expect(Math.abs(location.lon), location.id).toBeLessThanOrEqual(180);
    }
  });
});

/**
 * Factual corrections, and the slugs they must not move.
 *
 * Every slug in the learn tree is derived from a name — a topic's from its
 * English title, a lesson's from the topic slug plus its own name — and
 * `TopicLesson.slug` is what progress and awards key on. That is deliberate
 * (re-ordering a topic must not orphan a row) and it has one sharp edge:
 * correcting a wrong title silently re-slugs it and everything under it, and
 * `seed_learn_content` leaves the old rows behind as unreachable orphans.
 *
 * A curriculum this size will need corrections for years, so the exporter takes
 * an explicit `slug` on a topic or a lesson and uses it in place of the derived
 * one. These pin the corrections made on 28 Aug 2026 together with the slugs
 * they had to keep — if a later edit moves one, this goes red rather than
 * quietly stranding a pupil's progress.
 */
describe('corrected content keeps its slug', () => {
  const fixture = () =>
    import('../../../backend/apps/courses/fixtures/learn_content.json', {
      with: { type: 'json' },
    }).then((m) => m.default);

  const findNode = (tree, slug) => {
    for (const node of tree) {
      if (node.slug === slug) return node;
      const hit = findNode(node.children ?? [], slug);
      if (hit) return hit;
    }
    return null;
  };

  const topics = async () => {
    const data = await fixture();
    return data.spheres.flatMap((s) => s.topics);
  };

  it('keeps the cosmonauts topic slug while the title stops calling Armstrong one', async () => {
    // IAU OAE glossary, "Astronaut": Russian crew are cosmonauts, American crew
    // are astronauts. Armstrong and Aldrin are two of the four lessons here.
    // https://astro4edu.org/resources/glossary/term/23/
    const topic = (await topics()).find((t) => t.slug === 'interviews-cosmonauts');
    expect(topic, 'the slug 25 lesson rows hang off must not move').toBeTruthy();
    expect(topic.title_en).toBe('Astronauts and Cosmonauts');
    expect(findNode(topic.lessons, 'interviews-cosmonauts-neil-armstrong')).toBeTruthy();
  });

  it('keeps the Venus slug while the title stops calling it only the morning star', async () => {
    // NASA, Venus Facts: the ancients "even thinking it was two objects: a
    // morning star and an evening star".
    // https://science.nasa.gov/venus/venus-facts/
    const topic = (await topics()).find((t) => t.slug === 'astronomy-solar-system');
    const node = findNode(topic.lessons, 'astronomy-solar-system-exploration-of-the-morning-star');
    expect(node, 'the slug this lesson had must not move').toBeTruthy();
    expect(node.name).toBe('Exploration of the Morning and Evening Star');
  });

  it('keeps the Titan slug while the title says what the lakes are made of', async () => {
    // NASA, Titan: "rivers, lakes and seas of liquid hydrocarbons like methane
    // and ethane" — not water, at about -180 C.
    // https://science.nasa.gov/saturn/moons/titan/
    const topic = (await topics()).find((t) => t.slug === 'astronomy-solar-system');
    const node = findNode(
      topic.lessons,
      'astronomy-solar-system-titan-a-world-with-liquid-lakes',
    );
    expect(node, 'the slug this lesson had must not move').toBeTruthy();
    expect(node.name).toBe('Titan: Lakes of Liquid Methane and Ethane');
  });
});
