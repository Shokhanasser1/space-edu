/**
 * Every Kinematics, Dynamics, Statics and fluids lesson has a laboratory behind its "Lab"
 * button - written lessons by their slugs, bare titles by their names (and
 * the slug the content export will give them) - and a lesson without one
 * still goes to the general laboratory.
 */
import { describe, expect, it } from 'vitest';

import { physicsTopicsData } from '@/data/physicsTopicsData';
import { lessonLab, lessonLabPath } from './registry';

describe('the lesson laboratories', () => {
  it('cover all thirteen Kinematics lessons, as the static file lists them', () => {
    const lessons = physicsTopicsData[1].lessons;
    expect(lessons).toHaveLength(13);
    lessons.forEach((lesson, i) => {
      expect(lessonLab(lesson), `lesson ${i}`).not.toBeNull();
      expect(lessonLabPath('physics', 1, i, lesson)).toBe(`/learn/physics/1/lesson/${i}/lab`);
    });
  });

  it('cover all sixteen Dynamics lessons', () => {
    const lessons = physicsTopicsData[2].lessons;
    expect(lessons).toHaveLength(16);
    lessons.forEach((lesson, i) => {
      expect(lessonLab(lesson), `lesson ${i}`).not.toBeNull();
    });
    // The slug the content export gives a bare title.
    expect(lessonLab({ name: 'Kuch', slug: 'physics-dynamics-force-newtons-first-law' })).not.toBeNull();
  });

  it('cover all twelve Statics lessons', () => {
    const lessons = physicsTopicsData[3].lessons;
    expect(lessons).toHaveLength(12);
    lessons.forEach((lesson, i) => {
      expect(lessonLab(lesson), `lesson ${i}`).not.toBeNull();
    });
    expect(lessonLab({ name: 'Quvvat', slug: 'physics-statics-power' })).not.toBeNull();
  });

  it('cover all seven lessons on fluids and gases', () => {
    const lessons = physicsTopicsData[4].lessons;
    expect(lessons).toHaveLength(7);
    lessons.forEach((lesson, i) => {
      expect(lessonLab(lesson), `lesson ${i}`).not.toBeNull();
    });
    expect(
      lessonLab({ name: 'Arximed kuchi', slug: 'physics-mechanics-of-fluids-and-gases-archimedes-force' }),
    ).not.toBeNull();
  });

  it('match a lesson the API serves by its slug', () => {
    expect(lessonLab({ name: 'Aylanma harakat', slug: 'physics-kinematics-transmission-of-rotational-motion' })).not.toBeNull();
  });

  it('send a lesson with no laboratory yet to the general one', () => {
    const lesson = physicsTopicsData[5].lessons[0];
    expect(lessonLab(lesson)).toBeNull();
    expect(lessonLabPath('physics', 5, 0, lesson)).toBe('/lab');
  });
});
