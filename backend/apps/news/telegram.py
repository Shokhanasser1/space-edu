"""The Uzcosmos Telegram channel, read on the server and served from our API.

The requirement is "put everything from https://t.me/uzcosmos_official on the
site". What is actually possible, checked rather than assumed:

* **The public web preview works and needs nothing.** ``t.me/s/<channel>`` is
  the read-only HTML view Telegram publishes for any public channel. Fetched
  on 28 August 2026 it returned the last 10 posts of ``uzcosmos_official``
  with their text, their post ids and their timestamps. No token, no account,
  no registration.
* **The Bot API cannot do this at all without the team.** ``getUpdates`` only
  delivers channel posts to a bot that has been added to the channel as an
  administrator, and the channel belongs to the Uzcosmos agency, not to us. It
  would need both a bot token *and* somebody at the agency to add the bot. The
  preview needs neither, so the preview is what this uses. If the team ever
  gets that access, the parser is the only part that would be replaced —
  everything below it already caches, backs off and degrades.

The rule that shapes the rest: **the browser never calls t.me.** Commit
`b8d1ac2` removed the last third-party fetches from the front end, and six
more went from the Live page this week. So the server fetches, caches, and
hands over plain text from our own origin.

Three consequences worth knowing before editing this:

* **Plain text only.** Telegram's markup is turned into text here, so nothing
  the channel writes can put HTML in front of a child. A post's pictures live
  on ``cdn4.telesco.pe``; rendering them would be the browser calling a
  third-party host, which is the thing we do not do. ``has_media`` says a post
  has a picture or a video and the post's own link is how you see it.
* **Scraping a page is brittle by nature.** Telegram can change that markup
  whenever it likes and nothing will tell us. So a parse that finds no posts
  is a *failure*, not an empty channel — it raises, which puts the fetch on
  the same stale-copy-and-back-off path as a network error, and the page then
  says it cannot reach the channel instead of quietly showing nothing.
* **Nothing here is translated.** The channel writes each post in Uzbek and
  Russian already, one under the other. Machine translation of what a child
  reads is exactly what was removed from the Live page in `caa16d0`.

``fetch_cached`` is ``apps.space``'s, deliberately: the caching, the ten-minute
back-off after a failure and the week-old stale copy are the same problem, and
a second copy of that logic is a second thing to get wrong.
"""
import html
import re
from html.parser import HTMLParser

from apps.space.services import fetch_cached

# Hard-coded, not configuration. There is one channel, it is named in the
# ticket, and an environment variable pointing this fetcher at an arbitrary
# host is a hole nobody needs.
CHANNEL = 'uzcosmos_official'
CHANNEL_URL = f'https://t.me/{CHANNEL}'
PREVIEW_URL = f'https://t.me/s/{CHANNEL}'

TELEGRAM_TTL = 30 * 60

# A post is a paragraph or two. 2 000 characters is well past the longest one
# on the channel and still bounded, so one enormous post cannot become the
# whole response.
MAX_POST_CHARS = 2000
MAX_POSTS = 12


class _ChannelPageParser(HTMLParser):
    """Pull post id, text, timestamp and media flag out of a preview page.

    Telegram wraps each post in ``<div class="tgme_widget_message" data-post=
    "<channel>/<id>">``. Everything is found relative to that div and its
    matching close, so a post's fields cannot be attributed to the one after
    it — which is what a flat regex over the page would do the first time the
    markup nests differently.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.posts = []
        self._post = None
        self._depth = 0          # div depth inside the current post
        self._text_depth = 0     # div depth inside the current text block, 0 = not in one
        self._chunks = []

    # -- helpers --------------------------------------------------------
    @staticmethod
    def _classes(attrs):
        return set(dict(attrs).get('class', '').split())

    def _finish_post(self):
        if self._post is not None and self._post['text']:
            self.posts.append(self._post)
        self._post = None
        self._depth = 0
        self._text_depth = 0
        self._chunks = []

    # -- HTMLParser -----------------------------------------------------
    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        classes = self._classes(attrs)

        if tag == 'div' and attr.get('data-post') and self._post is None:
            self._post = {'post': attr['data-post'], 'text': '', 'published_at': '',
                          'has_media': False}
            self._depth = 1
            return

        if self._post is None:
            return

        if tag == 'div':
            self._depth += 1
            if self._text_depth:
                self._text_depth += 1
            elif 'tgme_widget_message_text' in classes:
                # An exact class token, never a substring: a quoted reply is
                # `tgme_widget_message_metatext`, and matching that would file
                # the message being replied to as this post's own text.
                self._text_depth = 1
                self._chunks = []
            return

        if tag == 'br' and self._text_depth:
            self._chunks.append('\n')
            return

        if tag == 'time' and 'datetime' in attr:
            # A video's running time is also a <time>, but carries no
            # datetime; only the post's own date link has one.
            self._post['published_at'] = attr['datetime']
            return

        if classes & {'tgme_widget_message_photo_wrap', 'tgme_widget_message_video',
                      'tgme_widget_message_video_thumb', 'tgme_widget_message_document'}:
            self._post['has_media'] = True

    def handle_endtag(self, tag):
        if self._post is None or tag != 'div':
            return
        if self._text_depth:
            self._text_depth -= 1
            if self._text_depth == 0:
                block = _tidy(''.join(self._chunks))
                self._post['text'] = f"{self._post['text']}\n\n{block}".strip() if self._post['text'] else block
        self._depth -= 1
        if self._depth == 0:
            self._finish_post()

    def handle_data(self, data):
        if self._text_depth:
            self._chunks.append(data)

    def close(self):
        super().close()
        # A page that ends mid-post (truncated download) still yields what it had.
        self._finish_post()


def _tidy(text):
    """Collapse the whitespace Telegram's markup leaves behind."""
    text = html.unescape(text)
    text = text.replace(' ', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_channel_page(page):
    """Posts from a ``t.me/s/<channel>`` page, newest first.

    Raises ``ValueError`` when the page yields nothing. The preview of a live
    channel always has posts, so "no posts" means the markup moved under us and
    must be treated as a failed fetch — not as an empty channel, which would
    put a confident "no news" on the screen while the channel was publishing.
    """
    parser = _ChannelPageParser()
    parser.feed(page)
    parser.close()

    posts = []
    for raw in parser.posts:
        post_id = raw['post'].split('/')[-1]
        if not post_id.isdigit():
            continue
        text = raw['text']
        truncated = len(text) > MAX_POST_CHARS
        posts.append({
            'id': int(post_id),
            'url': f'{CHANNEL_URL}/{post_id}',
            'text': text[:MAX_POST_CHARS].rstrip() if truncated else text,
            'truncated': truncated,
            'published_at': raw['published_at'],
            'has_media': raw['has_media'],
        })

    if not posts:
        raise ValueError('no posts found in the channel preview')

    posts.sort(key=lambda p: p['id'], reverse=True)
    return posts[:MAX_POSTS]


def channel_posts():
    """The cached channel posts. ``UpstreamUnavailable`` when we have none."""
    return fetch_cached(f'news:telegram:{CHANNEL}', PREVIEW_URL, TELEGRAM_TTL,
                        parse_channel_page)
