/**
 * One source for the /learn tree.
 *
 * ADR 0001, step 4. The content used to live only in `src/data/*TopicsData.js`,
 * so editing a lesson meant a deploy and the admin panel's three content tabs
 * changed nothing anyone could see. The screens now read the API and fall back
 * to the static file when it is unreachable, which keeps the site up on a
 * backend outage and lets subjects move over one at a time.
 *
 * The API tree is reshaped into the exact shape the screens already consume, so
 * migrating a screen is a changed import rather than a rewrite:
 *
 *   depth 1  ->  { lessons: [{ name, slug }] }                      physics
 *   depth 2  ->  { lessons: [{ name, slug, subLessons: [...] }] }   astronomy, creativity
 *   depth 3  ->  { sections: [{ name, lessons: [...] }] }           interviews
 *
 * Depth is read off the content rather than configured per subject, so a topic
 * that gains sub-lessons in the admin panel starts rendering them.
 */
import api from '@/lib/api';

import { astronomyTopicsData } from '@/data/astronomyTopicsData';
import { creativityTopicsData } from '@/data/creativityTopicsData';
import { interviewsTopicsData } from '@/data/interviewsTopicsData';
import { physicsTopicsData } from '@/data/physicsTopicsData';

/** Used until a subject's content is authored in the panel rather than the repo. */
export const STATIC_TOPICS = {
  astronomy: astronomyTopicsData,
  creativity: creativityTopicsData,
  interviews: interviewsTopicsData,
  physics: physicsTopicsData,
};

export const SUBJECTS = Object.keys(STATIC_TOPICS);

const depthOf = (nodes) =>
  nodes?.length ? 1 + Math.max(...nodes.map((n) => depthOf(n.children))) : 0;

const toSubLesson = (node) => ({
  name: node.name,
  // The translated names, dropped here until 28 Aug 2026 — the journey
  // `content` made until 24 August, one field over. `TopicLesson.name_en` and
  // `name_ru` are editable in the panel and sent by the serializer, and this
  // function read only `name`, so a lesson list stayed in Uzbek on an English
  // or Russian page however carefully it had been translated. Falling back to
  // the base name is the rule `adaptTopic` already uses for the titles.
  nameEn: node.name_en || node.name,
  nameRu: node.name_ru || node.name,
  slug: node.slug,
  videoUrl: node.video_url || '',
  // The lesson's own text. Dropped here until 24 Aug 2026, which is why an
  // administrator could write a lesson in the panel, save it, open the page and
  // find nothing on it — the field went all the way from the model through the
  // serializer to this function and stopped.
  //
  // Three languages since 28 Aug 2026. `content` is the Uzbek original and the
  // fallback for the other two, exactly as `name` is for `nameEn`/`nameRu`.
  content: node.content || '',
  contentEn: node.content_en || '',
  contentRu: node.content_ru || '',
});

/**
 * A lesson's name in the reader's language.
 *
 * Takes an ISO code — 'en', 'ru' or 'uz' — which is what `i18n.language` gives
 * you. Handing it the store's 'ENG'/'RUS'/'UZB' returns the base name and says
 * nothing about it, so convert with `langCode()` from `lib/questionText.js`
 * first if that is what you are holding.
 *
 * A lesson is either an object from the API or a bare string from the static
 * file, and every screen that draws a lesson row meets both shapes.
 */
export function lessonName(lesson, lang) {
  if (typeof lesson === 'string') return lesson;
  if (!lesson) return '';
  if (lang === 'en') return lesson.nameEn || lesson.name || '';
  if (lang === 'ru') return lesson.nameRu || lesson.name || '';
  return lesson.name || '';
}

/**
 * A lesson's body in the reader's language, falling back to the Uzbek original.
 *
 * Same contract as `lessonName` above — an ISO code, and a lesson that may be a
 * bare string from the static file, which has no body at all.
 *
 * The fallback is deliberate and it is not the same choice as showing an
 * untranslated title. A lesson whose Russian half is still outstanding shows
 * the Uzbek text, which a pupil in Uzbekistan can read; showing nothing would
 * put them back on the blank page this branch exists to remove.
 */
export function lessonText(lesson, lang) {
  if (!lesson || typeof lesson !== 'object') return '';
  if (lang === 'en') return lesson.contentEn || lesson.content || '';
  if (lang === 'ru') return lesson.contentRu || lesson.content || '';
  return lesson.content || '';
}

const toLesson = (node) => {
  const lesson = toSubLesson(node);
  if (node.children?.length) lesson.subLessons = node.children.map(toSubLesson);
  return lesson;
};

/** One API topic -> the legacy object the screens read. */
export function adaptTopic(topic) {
  const base = {
    id: topic.order,
    slug: topic.slug,
    title: topic.title,
    titleEn: topic.title_en || topic.title,
    titleRu: topic.title_ru || topic.title,
    color: topic.color,
  };

  const roots = topic.lessons ?? [];
  if (depthOf(roots) >= 3) {
    return {
      ...base,
      sections: roots.map((section) => ({
        name: section.name,
        nameEn: section.name_en || section.name,
        nameRu: section.name_ru || section.name,
        slug: section.slug,
        lessons: (section.children ?? []).map(toLesson),
      })),
    };
  }
  return { ...base, lessons: roots.map(toLesson) };
}

/**
 * Keyed by the numeric id the routes use, so `/learn/astronomy/2` keeps working
 * and `Object.values()` still yields each topic exactly once — both are what the
 * screens already do with the static files.
 */
export function adaptTree(tree) {
  const out = {};
  for (const topic of tree.topics ?? []) {
    const adapted = adaptTopic(topic);
    out[adapted.id] = adapted;
  }
  return out;
}

/**
 * Where the "Test" button on a lesson row goes.
 *
 * A lesson from the API carries a slug, and `/quiz/:category?lesson=<slug>`
 * runs the questions attached to that one lesson. A lesson from the static
 * file is a bare string with nothing to attach to, so the button opens the
 * subject's whole pool instead of a page that says "not found".
 */
export function quizPath(subject, lesson) {
  const slug = typeof lesson === 'object' ? lesson?.slug : null;
  return slug ? `/quiz/${subject}?lesson=${encodeURIComponent(slug)}` : `/quiz/${subject}`;
}

/** For links that want a slug rather than a position. */
export function findBySlug(topics, slug) {
  return Object.values(topics ?? {}).find((topic) => topic.slug === slug) ?? null;
}

export async function fetchSubjectTopics(subject) {
  const { data } = await api.get(`/courses/spheres/${subject}/tree/`);
  const adapted = adaptTree(data);
  // An empty sphere is not content, it is a sphere nobody has filled in yet.
  // Falling back beats rendering a blank subject page.
  if (!Object.keys(adapted).length) return null;
  return adapted;
}

/**
 * Walk a topic to the node at a route path, and return its slug.
 *
 * Completing a lesson has to name a row the server knows. The routes address
 * content by position (`/learn/:subject/:topicId/sub/:subIdx/lesson/:lessonIdx`),
 * which is what the static files offered; this is the bridge between the two
 * until the routes themselves are slug-based.
 */
export function slugAtPath(topic, { subIdx, lessonIdx, partIdx } = {}) {
  if (!topic) return null;
  const asIndex = (value) => (value === undefined || value === null ? null : parseInt(value, 10));

  const items = topic.sections
    ? topic.sections.flatMap((section) => section.lessons)
    : (topic.lessons ?? []);

  const parentIdx = asIndex(subIdx) ?? asIndex(lessonIdx);
  const parent = parentIdx === null ? null : items[parentIdx];
  if (!parent) return null;

  if (!parent.subLessons) return parent.slug ?? null;

  const childIdx = asIndex(partIdx) ?? (subIdx !== undefined ? asIndex(lessonIdx) : 0) ?? 0;
  return parent.subLessons[childIdx]?.slug ?? null;
}
