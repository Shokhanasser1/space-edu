import { lazy } from 'react';

/**
 * Which lessons have a laboratory of their own.
 *
 * A lesson row's "Lab" button opens `/learn/<subject>/<topic>/lesson/<n>/lab`
 * when its lesson is listed here, and the general laboratory (`/lab`) when it
 * is not - so a lesson whose simulators are not built yet still sends the
 * pupil somewhere real.
 *
 * A lesson is matched by its slug, or - for the lessons that are still bare
 * titles in the static file, which have no slug until the API serves them -
 * by its English name.
 *
 * The first physics lesson keeps the four simulator styles that were offered
 * (the user wants that page kept); the design chosen there, variant A, is the
 * one every other lesson's simulators follow (`kit/`).
 */
/** The content export's slug rule (scripts/export-learn-content.mjs), for titles with no slug yet. */
function slugify(text) {
  return (
    String(text)
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .replace(/['\u2019]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 90) || 'item'
  );
}

const LABS = [
  {
    slug: 'physics-kinematics-basic-concepts-in-mechanics',
    load: () => import('./SimPreviewView').then((m) => ({ default: m.SimVariants })),
  },
  { slug: 'physics-kinematics-straight-line-uniform-motion', load: () => import('./kinematics/UniformMotion') },
  {
    slug: 'physics-kinematics-graphical-representation-of-straight-line-uniform-motion',
    load: () => import('./kinematics/UniformMotionGraphs'),
  },
  { slug: 'physics-kinematics-relativity-of-motion', load: () => import('./kinematics/RelativityOfMotion') },
  { slug: 'physics-kinematics-non-uniform-motion', load: () => import('./kinematics/NonUniformMotion') },
  {
    slug: 'physics-kinematics-uniformly-accelerated-motion-acceleration-instantaneous-velocity',
    load: () => import('./kinematics/Acceleration'),
  },
  {
    slug: 'physics-kinematics-displacement-in-uniformly-accelerated-motion',
    load: () => import('./kinematics/AcceleratedDisplacement'),
  },
  { slug: 'physics-kinematics-motion-of-two-bodies', load: () => import('./kinematics/TwoBodies') },
  {
    slug: 'physics-kinematics-graphical-representation-of-uniformly-accelerated-motion',
    load: () => import('./kinematics/AcceleratedGraphs'),
  },
  { slug: 'physics-kinematics-curvilinear-motion', load: () => import('./kinematics/CurvilinearMotion') },
  {
    slug: 'physics-kinematics-acceleration-in-curvilinear-motion',
    names: ['Acceleration in curvilinear motion'],
    load: () => import('./kinematics/CentripetalAcceleration'),
  },
  {
    slug: 'physics-kinematics-transmission-of-rotational-motion',
    names: ['Transmission of rotational motion'],
    load: () => import('./kinematics/RotationTransmission'),
  },
  {
    slug: 'physics-kinematics-non-uniform-circular-motion',
    names: ['Non-uniform circular motion'],
    load: () => import('./kinematics/NonUniformCircular'),
  },

  // Dynamics: bare titles in the static file, so matched by name, and by the
  // slug the content export derives from that name.
  ...[
    ["Force. Newton's first law", () => import('./dynamics/NewtonFirstLaw')],
    ['Mass. Density', () => import('./dynamics/MassDensity')],
    ["Newton's second law", () => import('./dynamics/NewtonSecondLaw')],
    ["Newton's third law", () => import('./dynamics/NewtonThirdLaw')],
    ['Law of universal gravitation', () => import('./dynamics/UniversalGravitation')],
    ['Gravity', () => import('./dynamics/Gravity')],
    ['Elastic force', () => import('./dynamics/ElasticForce')],
    ['Weight', () => import('./dynamics/Weight')],
    ['Weightlessness', () => import('./dynamics/Weightlessness')],
    ['Vertical motion of a body under gravity', () => import('./dynamics/VerticalMotion')],
    ['Motion of a body thrown horizontally', () => import('./dynamics/HorizontalThrow')],
    ['Motion of a body thrown at an angle to the horizon', () => import('./dynamics/AngledThrow')],
    ['Artificial satellites of the Earth', () => import('./dynamics/Satellites')],
    ['Friction force. Static friction', () => import('./dynamics/StaticFriction')],
    ['Sliding friction force', () => import('./dynamics/SlidingFriction')],
    ['Motion under the action of multiple forces', () => import('./dynamics/MultipleForces')],
  ].map(([name, load]) => ({ slug: `physics-dynamics-${slugify(name)}`, names: [name], load })),
].map((entry) => ({ ...entry, Component: lazy(entry.load) }));

const BY_SLUG = new Map(LABS.map((e) => [e.slug, e.Component]));
const BY_NAME = new Map(LABS.flatMap((e) => (e.names ?? []).map((n) => [n.toLowerCase(), e.Component])));

/** Every lesson slug that has a laboratory (for tests and tooling). */
export const LESSON_LAB_SLUGS = LABS.map((e) => e.slug);

/** The laboratory component for a lesson, or null when it has none yet. */
export function lessonLab(lesson) {
  if (!lesson) return null;
  if (typeof lesson === 'object' && lesson.slug && BY_SLUG.has(lesson.slug)) return BY_SLUG.get(lesson.slug);
  const names = typeof lesson === 'string' ? [lesson] : [lesson.nameEn, lesson.name];
  for (const name of names) {
    if (name && BY_NAME.has(String(name).toLowerCase())) return BY_NAME.get(String(name).toLowerCase());
  }
  return null;
}

/** Where a lesson row's "Lab" button goes. */
export function lessonLabPath(subject, topicId, lessonIdx, lesson) {
  return lessonLab(lesson) ? `/learn/${subject}/${topicId}/lesson/${lessonIdx}/lab` : '/lab';
}
