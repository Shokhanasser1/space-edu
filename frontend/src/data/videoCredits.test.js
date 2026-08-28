/**
 * A video the platform did not make must say who did.
 *
 * The lesson videos filled in on 28 Aug 2026 are Khan Academy's, in Uzbek.
 * `TopicLesson` has no field for a channel, so the credit is this checked-in
 * map — which means the map and the fixture can drift, and the failure mode of
 * that drift is a third party's lesson playing under this platform's name with
 * nothing on the page saying otherwise. That is the thing PR #14 was undoing.
 * So: every `video_url` the fixture ships is checked against the map here.
 */
import { describe, expect, it } from 'vitest';

import { VIDEO_CREDITS, videoCredit, videoIdFrom } from './videoCredits';

const fixture = () =>
  import('../../../backend/apps/courses/fixtures/learn_content.json', {
    with: { type: 'json' },
  }).then((m) => m.default);

const videoUrls = async () => {
  const data = await fixture();
  const out = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.video_url) out.push([node.slug, node.video_url]);
      walk(node.children ?? []);
    }
  };
  for (const sphere of data.spheres) for (const topic of sphere.topics) walk(topic.lessons);
  return out;
};

describe('every video the fixture plays can be credited', () => {
  it('ships at least one, so this file is not passing on an empty list', async () => {
    expect((await videoUrls()).length).toBeGreaterThan(0);
  });

  it('has a channel and a title for every video_url in the fixture', async () => {
    const uncredited = (await videoUrls())
      .filter(([, url]) => !videoCredit(url))
      .map(([slug, url]) => `${slug} -> ${url}`);

    expect(
      uncredited,
      'a lesson video with no credit plays under this platform\'s name',
    ).toEqual([]);
  });

  it('gives every entry both the channel and the video\'s own title', () => {
    for (const [id, credit] of Object.entries(VIDEO_CREDITS)) {
      expect(credit.channel, id).toBeTruthy();
      // The title is what makes an id checkable by hand against the real video.
      expect(credit.title, id).toBeTruthy();
    }
  });
});

describe('reading the id out of a lesson url', () => {
  it('reads an embed url, with or without the query the player adds', () => {
    expect(videoIdFrom('https://www.youtube.com/embed/l6k62nsjfFo')).toBe('l6k62nsjfFo');
    expect(videoIdFrom('https://www.youtube.com/embed/l6k62nsjfFo?rel=0')).toBe('l6k62nsjfFo');
  });

  it('reads a watch url too, because the fixture may hold either', () => {
    expect(videoIdFrom('https://www.youtube.com/watch?v=l6k62nsjfFo')).toBe('l6k62nsjfFo');
  });

  it('reads nothing out of an empty slot', () => {
    expect(videoIdFrom('')).toBeNull();
    expect(videoIdFrom(undefined)).toBeNull();
  });
});

describe('a video the map does not know', () => {
  it('is credited to nobody rather than to the wrong channel', () => {
    expect(videoCredit('https://www.youtube.com/embed/zzzzzzzzzzz')).toBeNull();
    expect(videoCredit('')).toBeNull();
  });
});
