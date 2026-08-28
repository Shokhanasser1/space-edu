/**
 * Fifth-pass findings on the lesson screen, 24 Aug 2026, both found by opening
 * it in a browser with a real lesson in the database.
 *
 * jsdom applies no media queries and this view reaches deep into the learn
 * tree, so these read the source. That is weaker than a render, and it is the
 * part that a revert would silently undo — the behaviour itself was checked at
 * 390px and 1440px against a running server.
 */
import { describe, expect, it } from 'vitest';

const source = async () =>
  import('./UniversalLessonView.jsx?raw').then((m) => m.default);

describe('the lesson body', () => {
  it('is rendered at all', async () => {
    // TopicLesson.content went from the model through the serializer to the
    // adapter and stopped. An administrator could write a lesson, save it, open
    // the page and find their work nowhere on it.
    //
    // The body picks its language through `lessonText` from 28 Aug 2026 — the
    // field it reads is `lesson.content` / `contentEn` / `contentRu` rather than
    // `lesson.content` alone. `LessonTextLanguage.test.jsx` renders the view and
    // checks all three; this stays as the cheap guard that the call is there.
    const src = await source();
    expect(src).toMatch(/LessonBody/);
    expect(src).toMatch(/lessonText\(lesson, i18n\.language\)/);
  });

  it('still says something when a lesson has no text yet', async () => {
    // Most of the 144 physics lessons are a title and a video. An empty page
    // would be worse than the generic line it replaced.
    expect(await source()).toMatch(/lessonDescription/);
  });
});

describe('the two-column layout', () => {
  it('collapses to one column on a phone', async () => {
    // It was an inline `gridTemplateColumns: '1fr 350px'`, and an inline style
    // cannot carry a media query. At 390px the second column ran from 315px to
    // 665px — off the right edge — and it holds "finish lesson", the button
    // that awards the XP. A pupil on a phone could not complete a lesson.
    const src = await source();
    expect(src).toMatch(/grid-cols-1/);
    expect(src).toMatch(/lg:grid-cols-\[1fr_350px\]/);
  });

  it('does not pin a column width in an inline style', async () => {
    // The comment above the layout quotes the old code, which is the point of
    // the comment — strip comments before looking for the real thing.
    const code = (await source())
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const inlineGrids = code.match(/gridTemplateColumns:\s*'[^']*'/g) || [];
    expect(inlineGrids).toEqual([]);
  });
});
