"""Tests for the News page's two new sources: anniversaries and Telegram.

Neither endpoint touches the database, so both suites are ``SimpleTestCase``
— which fails the moment one of them starts to.

Most of what is here is about **not being wrong**. An "on this day" feature is
a series of factual claims made to children, so the dataset is checked as data
(every entry dated, sourced, and written in all three languages) as hard as
the endpoint is checked as code. The Telegram half is checked mostly on its
failure paths, for the same reason ``apps.space`` is: a scraper that keeps
hammering an upstream that is refusing it, or that quietly answers "no news"
when its parse breaks, is worse than one that is simply down.
"""
import datetime
import json
import re
import urllib.error
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import anniversaries, telegram

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

ON_THIS_DAY = '/api/v1/news/on-this-day/'
TELEGRAM = '/api/v1/news/telegram/'


# ─────────────────────────────────────────────────────────────────────────────
# The dataset
# ─────────────────────────────────────────────────────────────────────────────

class AnniversaryDataTests(SimpleTestCase):
    """The data file is the feature. These are the rules it has to hold.

    A wrong birthday for a cosmonaut on a children's platform is the exact
    class of error this project is trying to remove, so every one of these is
    about a claim being checkable rather than about the code around it.
    """

    def test_there_is_actually_a_dataset(self):
        self.assertGreater(len(anniversaries.ENTRIES), 100)
        self.assertGreater(len(anniversaries.FILLED_DAYS), 100)

    def test_every_entry_has_every_field_and_none_of_them_are_blank(self):
        for entry in anniversaries.ENTRIES:
            for field in anniversaries.REQUIRED_FIELDS:
                with self.subTest(entry=entry.get('id'), field=field):
                    self.assertIn(field, entry)
                    value = entry[field]
                    if isinstance(value, str):
                        self.assertTrue(value.strip(), f'{field} is blank')

    def test_ids_are_unique(self):
        ids = [e['id'] for e in anniversaries.ENTRIES]
        duplicates = {i for i in ids if ids.count(i) > 1}
        self.assertEqual(duplicates, set())

    def test_every_date_is_a_real_one(self):
        this_year = timezone.localdate().year
        for entry in anniversaries.ENTRIES:
            with self.subTest(entry=entry['id']):
                # Raises rather than returning a bad date: 31 April is not a
                # typo we can correct, it is a claim we cannot publish.
                datetime.date(2024, entry['month'], entry['day'])
                self.assertGreaterEqual(entry['year'], 900)
                self.assertLessEqual(
                    entry['year'], this_year,
                    'an anniversary cannot be in the future',
                )

    def test_kinds_and_regions_are_from_the_known_sets(self):
        for entry in anniversaries.ENTRIES:
            with self.subTest(entry=entry['id']):
                self.assertIn(entry['kind'], anniversaries.KINDS)
                self.assertIn(entry['region'], anniversaries.REGIONS)

    def test_every_entry_names_a_source_you_can_open(self):
        for entry in anniversaries.ENTRIES:
            with self.subTest(entry=entry['id']):
                self.assertTrue(
                    entry['source_url'].startswith('https://'),
                    f"{entry['id']} has no https source",
                )
                self.assertNotIn(' ', entry['source_url'])

    def test_nothing_is_left_in_english_in_the_other_two_languages(self):
        """An untranslated body is the failure mode locale parity cannot see.

        Titles are exempt — "Samarkand-2028" is the same string in all three,
        and forcing it to differ would mean inventing a translation of a name.
        """
        for entry in anniversaries.ENTRIES:
            with self.subTest(entry=entry['id']):
                self.assertNotEqual(entry['text_uz'], entry['text_en'])
                self.assertNotEqual(entry['text_ru'], entry['text_en'])

    def test_the_uzbek_text_is_written_in_the_uzbek_alphabet(self):
        """A Cyrillic letter in an Uzbek field is a slip of the keyboard.

        Not a hypothetical: writing this dataset produced "Oy modulига" and
        "vertolyotникidan", both of which look almost right at a glance and
        are unreadable to the reader they are for. Uzbek on this site is
        written in Latin script throughout — the locale files are, too.
        """
        cyrillic = re.compile(r'[Ѐ-ӿ]')
        for entry in anniversaries.ENTRIES:
            for field in ('title_uz', 'text_uz'):
                found = cyrillic.findall(entry[field])
                with self.subTest(entry=entry['id'], field=field):
                    self.assertEqual(found, [], f'Cyrillic letters in {field}')

    def test_the_russian_text_is_written_in_the_russian_alphabet(self):
        # The mirror of the check above: a Russian body with no Cyrillic in it
        # at all is an untranslated stub that locale parity cannot see.
        cyrillic = re.compile(r'[Ѐ-ӿ]')
        for entry in anniversaries.ENTRIES:
            with self.subTest(entry=entry['id']):
                self.assertTrue(cyrillic.search(entry['text_ru']),
                                'text_ru has no Cyrillic in it')

    def test_uzbek_and_central_asian_history_is_actually_represented(self):
        """The reason this platform exists, held as a number.

        Soviet and American material is the easy half to fill, and a dataset
        left to drift becomes all of one and none of the other.
        """
        local = [e for e in anniversaries.ENTRIES if e['region'] in ('uz', 'central_asia')]
        self.assertGreaterEqual(len(local), 20)
        self.assertGreaterEqual(
            len([e for e in local if e['region'] == 'uz']), 10,
            'Uzbekistan itself, not only its neighbours',
        )

    def test_local_entries_are_listed_first_within_a_day(self):
        for (month, day), entries in anniversaries.INDEX.items():
            ranks = [{'uz': 0, 'central_asia': 1}.get(e['region'], 2) for e in entries]
            with self.subTest(month=month, day=day):
                self.assertEqual(ranks, sorted(ranks))


class AnniversaryLookupTests(SimpleTestCase):
    def test_a_day_nobody_wrote_returns_nothing_rather_than_the_day_before(self):
        empty = next(
            (m, d)
            for m in range(1, 13)
            for d in range(1, 29)
            if (m, d) not in anniversaries.INDEX
        ) if len(anniversaries.FILLED_DAYS) < 336 else None
        if empty is None:
            self.skipTest('every day is written; nothing to check')
        self.assertEqual(anniversaries.for_day(*empty), [])

    def test_years_ago_counts_from_the_day_asked_about(self):
        entry = anniversaries.ENTRIES[0]
        got = anniversaries.for_day(entry['month'], entry['day'],
                                    datetime.date(2026, 1, 1))
        found = next(e for e in got if e['id'] == entry['id'])
        self.assertEqual(found['years_ago'], 2026 - entry['year'])

    def test_an_event_from_this_year_is_never_a_negative_number_of_years_ago(self):
        for entry in anniversaries.ENTRIES:
            got = anniversaries.for_day(entry['month'], entry['day'],
                                        datetime.date(2000, 1, 1))
            for found in got:
                self.assertGreaterEqual(found['years_ago'], 0)

    def test_neighbours_never_point_at_the_day_you_are_standing_on(self):
        for month, day in anniversaries.FILLED_DAYS[:40]:
            previous, following = anniversaries.neighbours(month, day)
            with self.subTest(month=month, day=day):
                self.assertNotEqual(previous, (month, day))
                self.assertNotEqual(following, (month, day))

    def test_neighbours_wrap_the_year_rather_than_running_out(self):
        first = anniversaries.FILLED_DAYS[0]
        last = anniversaries.FILLED_DAYS[-1]
        self.assertEqual(anniversaries.neighbours(*first)[0], last)
        self.assertEqual(anniversaries.neighbours(*last)[1], first)


# ─────────────────────────────────────────────────────────────────────────────
# The endpoint
# ─────────────────────────────────────────────────────────────────────────────

@override_settings(CACHES=LOCMEM)
class OnThisDayEndpointTests(SimpleTestCase):
    # LocMem for the same reason `apps.space` uses it: DRF's `anon` throttle
    # reads the cache on every request, and without `REDIS_URL` that cache is
    # the database — which a SimpleTestCase is right to refuse.
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def test_the_route_is_not_swallowed_by_the_article_detail_route(self):
        """`news/<pk>/` matches any non-slash string, "on-this-day" included.

        The viewset is registered at the empty prefix, so the only thing
        keeping this a 200 rather than a 404 from `get_object()` is that the
        named path is listed first in `urls.py`.
        """
        response = self.client.get(ON_THIS_DAY)
        self.assertEqual(response.status_code, 200)
        self.assertIn('entries', response.json())

    def test_the_day_is_the_students_day_not_the_servers(self):
        """Asia/Tashkent is UTC+5, so an evening here is tomorrow in UTC terms.

        20:00 UTC on 28 August is 01:00 on the 29th in Tashkent. A child
        opening the page then must be shown the 29th. `date.today()` or
        `timezone.now().date()` in the view both fail this — which is the
        same five-hour hole that was filing evening study under yesterday.
        """
        evening = datetime.datetime(2026, 8, 28, 20, 0, tzinfo=datetime.timezone.utc)
        with patch('django.utils.timezone.now', return_value=evening):
            body = self.client.get(ON_THIS_DAY).json()
        self.assertEqual((body['month'], body['day']), (8, 29))
        self.assertTrue(body['is_today'])

    def test_a_specific_day_can_be_asked_for(self):
        body = self.client.get(ON_THIS_DAY, {'month': 8, 'day': 5}).json()
        self.assertEqual((body['month'], body['day']), (8, 5))
        ids = [e['id'] for e in body['entries']]
        self.assertIn('samarkand-2028-launch', ids)

    def test_rubbish_input_is_400_not_500(self):
        for params in ({'month': 13, 'day': 1}, {'month': 0, 'day': 1},
                       {'month': 1, 'day': 0}, {'month': 1, 'day': 32},
                       {'month': 'august', 'day': 5}, {'month': 2, 'day': 31},
                       {'month': 4, 'day': 31}, {'month': 8}, {'day': 5},
                       {'month': -1, 'day': -1}):
            with self.subTest(params=params):
                response = self.client.get(ON_THIS_DAY, params)
                self.assertEqual(response.status_code, 400, response.content[:200])

    def test_the_29th_of_february_is_a_day_you_may_ask_about(self):
        response = self.client.get(ON_THIS_DAY, {'month': 2, 'day': 29})
        self.assertEqual(response.status_code, 200)
        # There is no 29 February in 2026, so there is no date to hand out —
        # and saying so beats printing 1 March under a leap-day heading.
        common_year = datetime.datetime(2026, 6, 1, 9, 0, tzinfo=datetime.timezone.utc)
        with patch('django.utils.timezone.now', return_value=common_year):
            body = self.client.get(ON_THIS_DAY, {'month': 2, 'day': 29}).json()
        self.assertIsNone(body['date'])
        self.assertEqual((body['month'], body['day']), (2, 29))

    def test_an_empty_day_says_so_and_offers_a_way_out(self):
        empty = next(
            ((m, d) for m in range(1, 13) for d in range(1, 29)
             if (m, d) not in anniversaries.INDEX),
            None,
        )
        if empty is None:
            self.skipTest('every day is written; nothing to check')
        body = self.client.get(ON_THIS_DAY, {'month': empty[0], 'day': empty[1]}).json()
        self.assertEqual(body['entries'], [])
        self.assertIsNotNone(body['previous'])
        self.assertIsNotNone(body['next'])
        self.assertNotEqual((body['previous']['month'], body['previous']['day']), empty)

    def test_every_response_publishes_how_much_of_the_year_is_written(self):
        body = self.client.get(ON_THIS_DAY).json()
        self.assertEqual(body['coverage']['days_in_year'], 366)
        self.assertEqual(body['coverage']['days_covered'], len(anniversaries.FILLED_DAYS))
        self.assertEqual(body['coverage']['entries'], len(anniversaries.ENTRIES))

    def test_entries_carry_their_source_all_the_way_to_the_browser(self):
        body = self.client.get(ON_THIS_DAY, {'month': 8, 'day': 5}).json()
        self.assertTrue(body['entries'])
        for entry in body['entries']:
            self.assertTrue(entry['source'])
            self.assertTrue(entry['source_url'].startswith('https://'))
            self.assertIn('years_ago', entry)

    def test_a_classroom_shares_one_copy(self):
        response = self.client.get(ON_THIS_DAY)
        self.assertEqual(response['Cache-Control'], 'public, max-age=600')

    def test_an_expired_token_does_not_turn_the_page_into_a_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION='Bearer not-a-real-token')
        self.assertEqual(client.get(ON_THIS_DAY).status_code, 200)


# ─────────────────────────────────────────────────────────────────────────────
# Telegram
# ─────────────────────────────────────────────────────────────────────────────

# Trimmed from a real https://t.me/s/uzcosmos_official page fetched on
# 28 August 2026, keeping every structural feature the parser depends on:
# nested divs around the text, <br> line breaks, a <tg-emoji> wrapping a <b>,
# a link, a media wrapper, a <time> with no datetime (a video's running time)
# ahead of the <time> that actually dates the post, a quoted reply whose class
# is `_metatext`, and a media-only post carrying no text at all.
CHANNEL_PAGE = """<!DOCTYPE html><html><body>
<main>
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message js-widget_message" data-post="uzcosmos_official/2701">
    <div class="tgme_widget_message_bubble">
      <a class="tgme_widget_message_reply" href="https://t.me/uzcosmos_official/2699">
        <div class="tgme_widget_message_metatext js-message_reply_text">Avvalgi post matni</div>
      </a>
      <div class="tgme_widget_message_video_player">
        <i class="tgme_widget_message_video_thumb"></i>
        <time class="message_video_duration">0:24</time>
      </div>
      <div class="tgme_widget_message_text js-message_text" dir="auto">Uzcosmos jamoasi Fizika-texnika institutiga tashrif buyurdi.<br/><br/>———<br/><br/>Команда Uzcosmos посетила Физико-технический институт.<br/><br/><tg-emoji emoji-id="5319160079465857105"><i class="emoji"><b>\U0001f4f1</b></i></tg-emoji> <a href="https://www.instagram.com/uzcosmos.uz" target="_blank">Instagram</a></div>
      <div class="tgme_widget_message_footer">
        <div class="tgme_widget_message_info">
          <span class="tgme_widget_message_views">888</span>
          <a class="tgme_widget_message_date" href="https://t.me/uzcosmos_official/2701"><time datetime="2026-08-18T10:39:43+00:00" class="time">10:39</time></a>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message js-widget_message" data-post="uzcosmos_official/2702">
    <div class="tgme_widget_message_bubble">
      <div class="tgme_widget_message_photo_wrap" style="background-image:url('https://cdn4.telesco.pe/file/secret.jpg')"></div>
      <div class="tgme_widget_message_footer">
        <a class="tgme_widget_message_date" href="https://t.me/uzcosmos_official/2702"><time datetime="2026-08-19T12:22:11+00:00" class="time">12:22</time></a>
      </div>
    </div>
  </div>
</div>
<div class="tgme_widget_message_wrap js-widget_message_wrap">
  <div class="tgme_widget_message js-widget_message" data-post="uzcosmos_official/2703">
    <div class="tgme_widget_message_bubble">
      <div class="tgme_widget_message_text js-message_text" dir="auto">Samarqand-2028 birinchi suratini yubordi.<br/>Самарканд-2028 прислал первый снимок.</div>
      <div class="tgme_widget_message_footer">
        <a class="tgme_widget_message_date" href="https://t.me/uzcosmos_official/2703"><time datetime="2026-08-20T07:39:06+00:00" class="time">07:39</time></a>
      </div>
    </div>
  </div>
</div>
</main>
</body></html>"""

EMPTY_PAGE = '<!DOCTYPE html><html><body><main><div class="tgme_channel_info"></div></main></body></html>'


def _http_error():
    return urllib.error.HTTPError('https://t.me/s/uzcosmos_official', 429,
                                  'Too Many Requests', {}, None)


@override_settings(CACHES=LOCMEM)
class TelegramParserTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_reads_the_posts_newest_first(self):
        posts = telegram.parse_channel_page(CHANNEL_PAGE)
        self.assertEqual([p['id'] for p in posts], [2703, 2701])

    def test_a_post_carries_its_text_date_link_and_media_flag(self):
        first = telegram.parse_channel_page(CHANNEL_PAGE)[1]
        self.assertEqual(first['id'], 2701)
        self.assertEqual(first['url'], 'https://t.me/uzcosmos_official/2701')
        self.assertEqual(first['published_at'], '2026-08-18T10:39:43+00:00')
        self.assertTrue(first['has_media'])
        self.assertFalse(first['truncated'])
        self.assertIn('Fizika-texnika institutiga', first['text'])
        self.assertIn('Физико-технический институт', first['text'])
        self.assertIn('Instagram', first['text'])
        self.assertIn('📱', first['text'])

    def test_line_breaks_survive_as_line_breaks(self):
        first = telegram.parse_channel_page(CHANNEL_PAGE)[1]
        self.assertIn('\n', first['text'])
        self.assertNotIn('<br', first['text'])

    def test_a_quoted_reply_is_not_filed_as_this_posts_text(self):
        first = telegram.parse_channel_page(CHANNEL_PAGE)[1]
        self.assertNotIn('Avvalgi post matni', first['text'])

    def test_a_post_with_no_text_is_left_out(self):
        ids = [p['id'] for p in telegram.parse_channel_page(CHANNEL_PAGE)]
        self.assertNotIn(2702, ids, 'a picture with no caption has nothing to read')

    def test_no_markup_and_no_third_party_asset_reaches_the_browser(self):
        """A post's pictures live on telesco.pe and stay there.

        Rendering them would be the browser calling a third-party host — the
        exact thing commit b8d1ac2 removed — and the raw markup would be HTML
        written by somebody outside this project, on a page children read.
        """
        for post in telegram.parse_channel_page(CHANNEL_PAGE):
            self.assertNotIn('<', post['text'])
            self.assertNotIn('telesco.pe', post['text'])
            self.assertNotIn('cdn4', post['text'])

    def test_a_page_with_no_posts_is_a_failure_not_an_empty_channel(self):
        """Telegram can change this markup whenever it likes.

        Answering "no news" when the parse broke would be a confident claim
        that the agency has published nothing. It has to look like a failure,
        so that the stale copy and the back-off both apply.
        """
        with self.assertRaises(ValueError):
            telegram.parse_channel_page(EMPTY_PAGE)

    def test_one_enormous_post_cannot_become_the_whole_response(self):
        long_text = 'a' * (telegram.MAX_POST_CHARS + 500)
        page = CHANNEL_PAGE.replace('Samarqand-2028 birinchi suratini yubordi.', long_text)
        post = telegram.parse_channel_page(page)[0]
        self.assertTrue(post['truncated'])
        self.assertLessEqual(len(post['text']), telegram.MAX_POST_CHARS)


@override_settings(CACHES=LOCMEM)
class TelegramEndpointTests(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def test_serves_the_channel_and_fetches_it_once(self):
        with patch('apps.space.services._http_get', return_value=CHANNEL_PAGE) as http:
            first = self.client.get(TELEGRAM)
            second = self.client.get(TELEGRAM)

        self.assertEqual(first.status_code, 200)
        body = first.json()
        self.assertEqual(body['channel'], 'uzcosmos_official')
        self.assertEqual(body['channel_url'], 'https://t.me/uzcosmos_official')
        self.assertFalse(body['stale'])
        self.assertEqual([p['id'] for p in body['posts']], [2703, 2701])
        self.assertEqual(first['Cache-Control'], 'public, max-age=300')

        self.assertEqual(second.json(), body)
        self.assertEqual(http.call_count, 1, 'the second request must be served from cache')
        self.assertEqual(http.call_args[0][0], 'https://t.me/s/uzcosmos_official')

    def test_when_the_channel_is_unreachable_we_serve_the_copy_we_have(self):
        with patch('apps.space.services._http_get', return_value=CHANNEL_PAGE):
            self.client.get(TELEGRAM)
        cache.delete('news:telegram:uzcosmos_official')

        with patch('apps.space.services._http_get', side_effect=_http_error()):
            response = self.client.get(TELEGRAM)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['stale'])
        self.assertEqual([p['id'] for p in response.json()['posts']], [2703, 2701])

    def test_with_no_copy_at_all_it_says_so_and_stops_asking(self):
        """Retrying an upstream that is refusing us is how an address gets banned."""
        with patch('apps.space.services._http_get', side_effect=_http_error()) as http:
            first = self.client.get(TELEGRAM)
            second = self.client.get(TELEGRAM)

        self.assertEqual(first.status_code, 503)
        self.assertEqual(first.json()['detail'], 'channel unavailable')
        self.assertEqual(first.json()['channel_url'], 'https://t.me/uzcosmos_official')
        self.assertEqual(first['Cache-Control'], 'no-store')
        self.assertEqual(second.status_code, 503)
        self.assertEqual(http.call_count, 1)

    def test_broken_markup_is_treated_as_being_down(self):
        for body in (EMPTY_PAGE, '', 'not html at all'):
            cache.clear()
            with self.subTest(body=body[:20]):
                with patch('apps.space.services._http_get', return_value=body):
                    self.assertEqual(self.client.get(TELEGRAM).status_code, 503)

    def test_a_timeout_is_not_a_500(self):
        with patch('apps.space.services._http_get', side_effect=TimeoutError('slow')):
            self.assertEqual(self.client.get(TELEGRAM).status_code, 503)

    def test_the_response_is_json_a_browser_can_render_as_text(self):
        with patch('apps.space.services._http_get', return_value=CHANNEL_PAGE):
            raw = self.client.get(TELEGRAM).content.decode()
        self.assertNotIn('telesco.pe', raw)
        self.assertNotIn('<div', json.dumps(json.loads(raw)['posts']))
