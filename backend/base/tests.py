"""Configuration-level regression tests for findings from the 2026-08-22 audit.

These check settings rather than endpoints. They are cheap and they catch the
class of bug that `manage.py check` stays silent about.
"""
import importlib
import os
import sys

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase
from django.test.utils import override_settings


class StorageConfigTests(SimpleTestCase):
    """Finding: base.py only defines STORAGES when Cloudflare R2 is configured,
    and the settings module that layered on top of it rebuilt the dict as
    {**globals().get('STORAGES', {}), 'staticfiles': ...}. Without R2 that left
    no 'default' key, so every ImageField save raised InvalidStorageError.
    manage.py check passed, so it stayed silent until the first avatar upload.

    Anything added above base.py — a deployment profile, most likely — has to
    keep the 'default' alias, which is what these two check."""

    def test_default_storage_alias_is_always_configured(self):
        from django.conf import settings

        self.assertIn('default', settings.STORAGES)

    def test_default_storage_resolves(self):
        from django.core.files.storage import default_storage

        self.assertIsNotNone(default_storage)


class CacheConfigTests(SimpleTestCase):
    """Finding: CACHES was never set, so Django fell back to per-process
    LocMemCache, while any real server runs more than one worker. Sign-in codes
    stored by one worker were invisible to the other, throttle counters were
    per-worker, and cache.delete() on verify only cleared the local copy, leaving
    the code replayable for its full TTL."""

    def test_cache_backend_is_shared_across_processes(self):
        from django.conf import settings

        backend = settings.CACHES['default']['BACKEND']
        self.assertNotIn(
            'locmem', backend.lower(),
            'LocMemCache is per-process; sign-in codes and throttles break with >1 worker',
        )


class ThrottleConfigTests(SimpleTestCase):
    """Findings: NUM_PROXIES unset made throttling bypassable via a spoofed
    X-Forwarded-For; and anon 100/day applied to every public read endpoint, so a
    logged-out visitor hit 429 after a dozen page views."""

    def test_num_proxies_is_pinned(self):
        from rest_framework.settings import api_settings

        self.assertIsNotNone(
            api_settings.NUM_PROXIES,
            'unset NUM_PROXIES makes DRF key the throttle on client-supplied X-Forwarded-For',
        )


class TestDatabaseIsolationTests(SimpleTestCase):
    """The team shares one database (docs/TEAM.md). The test runner must not.

    Django's runner CREATEs and DROPs a database of its own. Pointed at the
    shared Postgres that is two problems at once: it needs rights nobody should
    hand a laptop, and two people running the suite at the same time collide on
    the same `test_` database — the second drops the first one's mid-run.

    This test passing at all is part of the evidence: it runs with whatever
    DB_URL the developer has set, and it is still on SQLite.
    """

    def test_a_test_run_is_on_sqlite_whatever_db_url_says(self):
        from django.conf import settings

        self.assertIn(
            'sqlite', settings.DATABASES['default']['ENGINE'],
            'a test run reached a database that is not SQLite — check the '
            '_running_tests guard in base/settings/base.py before running '
            'anything else',
        )

    def test_the_guard_is_still_in_the_settings(self):
        """Deleting it would not fail anything until the day somebody with
        DB_URL set runs the suite, and by then it has already happened."""
        from pathlib import Path as _Path

        source = (_Path(__file__).resolve().parent / 'settings' / 'base.py').read_text(encoding='utf-8')
        self.assertIn('_running_tests', source)
        self.assertIn('PYTEST_CURRENT_TEST', source)


class R2ValuePastingTests(SimpleTestCase):
    """The two values Cloudflare shows on an R2 bucket page, pasted as they
    appear there, used to be wrong in two different ways — and neither failed
    loudly.

    "S3 API" already ends in the bucket name, and boto3 appends the bucket
    itself, so the pasted one arrived twice and every upload 404'd. "Public URL"
    is used as a *host*, written into f'https://{value}/', so pasting the scheme
    with it produced https://https://pub-... — uploads kept working and only the
    pictures broke, which no test would have caught.

    Whoever pastes these is copying out of a dashboard, not reading base.py.
    """

    def _fns(self):
        from base.settings.base import _r2_endpoint, _r2_host

        return _r2_host, _r2_endpoint

    def test_the_public_url_survives_being_pasted_with_its_scheme(self):
        host, _ = self._fns()
        for pasted in ('https://pub-abc123.r2.dev', 'pub-abc123.r2.dev',
                       'https://pub-abc123.r2.dev/', ' https://pub-abc123.r2.dev '):
            with self.subTest(pasted=pasted):
                self.assertEqual(host(pasted), 'pub-abc123.r2.dev')

    def test_a_custom_domain_over_http_is_still_a_host(self):
        host, _ = self._fns()
        self.assertEqual(host('http://cdn.uzcosmos.uz/'), 'cdn.uzcosmos.uz')

    def test_an_empty_public_url_stays_empty_so_the_fallback_runs(self):
        host, _ = self._fns()
        for blank in ('', '   ', None):
            self.assertEqual(host(blank), '')

    def test_the_endpoint_loses_a_bucket_name_that_came_with_it(self):
        _, endpoint = self._fns()
        account = 'https://abc.r2.cloudflarestorage.com'
        for pasted in (f'{account}/uzcosmos-media', f'{account}/uzcosmos-media/', account):
            with self.subTest(pasted=pasted):
                self.assertEqual(endpoint(pasted, 'uzcosmos-media'), account)

    def test_a_bucket_name_inside_the_account_id_is_not_stripped(self):
        """Only a trailing /<bucket> goes. The name appearing elsewhere in the
        host must survive, or the endpoint is silently mangled."""
        _, endpoint = self._fns()
        self.assertEqual(
            endpoint('https://media.r2.cloudflarestorage.com', 'media'),
            'https://media.r2.cloudflarestorage.com',
        )


class ThrottleSizingTests(SimpleTestCase):
    """Fourth-pass finding, 24 August 2026.

    A school reaches this API from one public address, so every address-keyed
    limit is shared by the whole building. Sizing one of those for a person
    locks the building — which is what `login` at 10/hour, `register` at 20/day,
    `anon` at 2000/day and `problem_check` at 60/hour each did in turn, to real
    pupils, while stopping no attacker who had more than one address.

    The rule these encode: **keyed on the account, size it for a person; keyed
    on the address, size it for a machine.**
    """

    PERIOD_SECONDS = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}

    # Keyed on the caller's address, so shared by everyone behind it.
    ADDRESS_KEYED = ('anon', 'problem_check_anon', 'register', 'google')

    def _rates(self):
        from django.conf import settings

        return settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']

    def _per_minute(self, rate):
        count, _, period = rate.partition('/')
        return int(count) * 60 / self.PERIOD_SECONDS[period[0]]

    def test_address_keyed_limits_clear_a_room_full_of_children(self):
        """Thirty pupils, each costing a few requests a minute, is the ordinary
        case and must be nowhere near any of these."""
        for scope in self.ADDRESS_KEYED:
            with self.subTest(scope=scope):
                per_minute = self._per_minute(self._rates()[scope])
                self.assertGreaterEqual(
                    per_minute, 60,
                    f"{scope} allows {per_minute:.0f}/min from one address, which a "
                    f"single class exceeds; size address-keyed limits for a machine",
                )

    def test_no_limit_keeps_a_day_of_history_in_the_cache(self):
        """DRF stores one timestamp per request for the length of the window, in
        a single cache entry. `user` at 10000/day was a list of up to ten
        thousand floats per pupil, read and rewritten on every request — against
        a database-backed cache, which is what runs without REDIS_URL."""
        for scope, rate in self._rates().items():
            with self.subTest(scope=scope):
                count = int(rate.partition('/')[0])
                self.assertLessEqual(
                    count, 500,
                    f'{scope} = {rate} keeps up to {count} timestamps per key in the cache',
                )

    def test_the_limits_that_bound_an_attacker_are_still_there(self):
        """The point is not that limits went away. Guessing one account, and
        spraying one password across many, both stay bounded."""
        rates = self._rates()
        self.assertLessEqual(self._per_minute(rates['login']), 60)
        self.assertLessEqual(self._per_minute(rates['login_ip']), 120)


class JwtConfigTests(SimpleTestCase):
    """The frontend interceptor must persist the rotated refresh token; if
    rotation is on and blacklisting is on, dropping it logs every user out."""

    def test_rotation_and_blacklisting_are_configured_together(self):
        from django.conf import settings

        jwt = settings.SIMPLE_JWT
        if jwt.get('ROTATE_REFRESH_TOKENS'):
            self.assertTrue(
                jwt.get('BLACKLIST_AFTER_ROTATION'),
                'rotation without blacklisting leaves old refresh tokens valid',
            )


class PublicSurfaceTests(TestCase):
    """Finding: cosmic-silk-road.html shipped in frontend/public/ as a second,
    unmaintained auth surface. It forged a local session on any failed login and
    took its API base from a ?api= query parameter, so a link on the real domain
    could post a child's password to an arbitrary host."""

    def test_the_duplicate_auth_page_is_gone(self):
        from pathlib import Path

        repo = Path(__file__).resolve().parent.parent.parent
        served = repo / 'frontend' / 'public' / 'cosmic-silk-road.html'
        self.assertFalse(
            served.exists(),
            'anything under frontend/public/ is served verbatim at the site root; '
            'this page forged a session on any failed login and took its API base '
            'from a ?api= query parameter',
        )


class SettingsReloadMixin:
    """Re-import base.settings with some environment variables set.

    Settings are read once at import, so override_settings cannot exercise the
    code that reads them — which is where these bugs live.
    """

    def _reload_settings(self, **env):
        original = {name: os.environ.get(name) for name in env}
        os.environ.update({name: value for name, value in env.items()})
        try:
            for name in [m for m in sys.modules if m.startswith('base.settings')]:
                sys.modules.pop(name, None)
            return importlib.import_module('base.settings')
        finally:
            for name, value in original.items():
                if value is None:
                    os.environ.pop(name, None)
                else:
                    os.environ[name] = value
            for name in [m for m in sys.modules if m.startswith('base.settings')]:
                sys.modules.pop(name, None)
            importlib.import_module('base.settings')


class OriginConfigTests(SettingsReloadMixin, SimpleTestCase):
    """The outage of 2026-08-23: the front end could not reach the API at all,
    because every cross-origin request was refused before it started. Three
    separate settings can produce that one browser message, and two of them look
    nothing like a CORS problem, so each gets a test."""

    def test_a_space_after_the_comma_does_not_silently_void_an_origin(self):
        """These lists are typed in by hand. Plain .split(',') kept the space,
        so the second origin never matched and the symptom was
        indistinguishable from not having set it at all."""
        settings = self._reload_settings(
            CORS_ALLOWED_ORIGINS='https://a.example, https://b.example',
            ALLOWED_HOSTS='a.example, b.example',
        )
        self.assertIn('https://b.example', settings.CORS_ALLOWED_ORIGINS)
        self.assertIn('b.example', settings.ALLOWED_HOSTS)

    def test_an_empty_entry_from_a_trailing_comma_is_dropped(self):
        settings = self._reload_settings(CORS_ALLOWED_ORIGINS='https://a.example,')
        self.assertEqual(settings.CORS_ALLOWED_ORIGINS, ['https://a.example'])

    def test_a_disallowed_host_is_the_error_that_looks_like_a_cors_error(self):
        """Django rejects a disallowed Host before CORS middleware ever runs, so
        a missing ALLOWED_HOSTS entry surfaces in the browser as a missing
        Access-Control-Allow-Origin header — pointing at the wrong setting.
        Whatever host the API ends up on has to be listed here by hand."""
        settings = self._reload_settings(ALLOWED_HOSTS='localhost')
        self.assertNotIn('api.example', settings.ALLOWED_HOSTS)

    def test_csrf_falls_back_to_the_cors_front_ends(self):
        settings = self._reload_settings(
            CORS_ALLOWED_ORIGINS='https://front.example',
            CSRF_TRUSTED_ORIGINS='',
        )
        self.assertIn('https://front.example', settings.CSRF_TRUSTED_ORIGINS)

    def test_preview_origins_are_not_opened_up_by_default(self):
        """A regex broad enough to match your own preview builds also matches
        every other page hosted on the same domain. It stays opt-in."""
        settings = self._reload_settings(CORS_ALLOWED_ORIGINS='https://a.example')
        self.assertEqual(settings.CORS_ALLOWED_ORIGIN_REGEXES, [])


class EmailConfigTests(SettingsReloadMixin, SimpleTestCase):
    """E-mail used to be two hard-coded lines in settings/development.py — the
    module that overrides everything else. Setting EMAIL_BACKEND in .env did
    nothing at all, and nothing said so, which is the same shape as the
    fail-open settings bug: a value you believe you set and never did.

    Address confirmation and password reset are only worth having if the message
    leaves the building, so how it leaves is configuration now, and a
    half-configured mail server refuses to start rather than losing mail."""

    SMTP = 'django.core.mail.backends.smtp.EmailBackend'

    def test_nothing_configured_prints_to_the_console_and_delivers_nothing(self):
        """The safe default, and the one a laptop wants. C-7: the permissive
        branch is the one you have to ask for by name."""
        settings = self._reload_settings(EMAIL_BACKEND='', EMAIL_HOST='')
        self.assertIn('console', settings.EMAIL_BACKEND)

    def test_a_blank_line_in_env_means_not_set_and_not_broken(self):
        """Every template line in .env.example is `NAME=` with nothing after it,
        so the variable exists and is empty. decouple returns '' for that, not
        the default — which would leave EMAIL_BACKEND set to no backend at all
        and EMAIL_PORT crashing int('') at import. A value whose right-hand side
        somebody deleted has to land where one they never typed lands."""
        settings = self._reload_settings(
            EMAIL_BACKEND='', EMAIL_HOST='  ', EMAIL_PORT='',
            EMAIL_USE_TLS='', DEFAULT_FROM_EMAIL='', FRONTEND_URL='',
        )
        self.assertIn('console', settings.EMAIL_BACKEND)
        self.assertEqual(settings.EMAIL_PORT, 587)
        self.assertTrue(settings.EMAIL_USE_TLS)
        self.assertEqual(settings.DEFAULT_FROM_EMAIL, 'noreply@localhost')
        self.assertEqual(settings.FRONTEND_URL, '')

    def test_smtp_without_a_host_refuses_to_start(self):
        """A mail backend with nowhere to send is not a safe default. It is a
        silent failure for every code this system issues."""
        with self.assertRaises(ImproperlyConfigured):
            self._reload_settings(EMAIL_BACKEND=self.SMTP, EMAIL_HOST='')

    def test_tls_and_ssl_together_refuse_to_start(self):
        """Django raises deep inside the send otherwise, once, at the moment a
        child is waiting for a code."""
        with self.assertRaises(ImproperlyConfigured):
            self._reload_settings(
                EMAIL_BACKEND=self.SMTP, EMAIL_HOST='smtp.example',
                EMAIL_USE_TLS='true', EMAIL_USE_SSL='true',
            )

    def test_an_account_with_no_password_prints_instead_of_losing_the_message(self):
        """The state this repository is actually in: the mailbox is named in
        .env.team, the app password is held by one person, and the other seven
        have it blank. Left as SMTP that is the worst outcome available — the
        server refuses every message, send_mail(fail_silently=True) swallows the
        refusal, and a child waits for a code that was never going to arrive."""
        settings = self._reload_settings(
            EMAIL_BACKEND=self.SMTP,
            EMAIL_HOST='smtp.gmail.com',
            EMAIL_HOST_USER='someone@example.com',
            EMAIL_HOST_PASSWORD='',
        )
        self.assertIn('console', settings.EMAIL_BACKEND)
        self.assertIn('EMAIL_HOST_PASSWORD', settings.EMAIL_CONFIG_NOTE)

    def test_a_complete_account_is_left_alone(self):
        settings = self._reload_settings(
            EMAIL_BACKEND=self.SMTP,
            EMAIL_HOST='smtp.gmail.com',
            EMAIL_HOST_USER='someone@example.com',
            EMAIL_HOST_PASSWORD='sixteenletters00',
        )
        self.assertEqual(settings.EMAIL_BACKEND, self.SMTP)
        self.assertEqual(settings.EMAIL_CONFIG_NOTE, '')

    def test_a_real_mail_server_is_an_environment_change_and_nothing_else(self):
        """The whole point of this commit: no code changes to start sending."""
        settings = self._reload_settings(
            EMAIL_BACKEND=self.SMTP,
            EMAIL_HOST='smtp.example',
            EMAIL_PORT='587',
            EMAIL_HOST_USER='someone@example.com',
            EMAIL_HOST_PASSWORD='not-a-real-password',
            DEFAULT_FROM_EMAIL='UZ COSMOS <someone@example.com>',
        )
        self.assertEqual(settings.EMAIL_BACKEND, self.SMTP)
        self.assertEqual(settings.EMAIL_HOST, 'smtp.example')
        self.assertEqual(settings.EMAIL_PORT, 587)
        self.assertEqual(settings.DEFAULT_FROM_EMAIL, 'UZ COSMOS <someone@example.com>')

    def test_a_mail_server_that_stops_answering_releases_the_worker(self):
        """send_mail runs inside the request that asked for the code. Without a
        timeout, a server that accepts the connection and then goes quiet holds
        a worker until the client gives up."""
        settings = self._reload_settings(EMAIL_BACKEND='', EMAIL_HOST='')
        self.assertIsNotNone(settings.EMAIL_TIMEOUT)
        self.assertLessEqual(settings.EMAIL_TIMEOUT, 30)


class FrontendLinkTests(SimpleTestCase):
    """A link inside a message to a child is the one place a wrong URL is worst,
    so frontend_link refuses more than it accepts and returns '' rather than
    raising: the message still goes, carrying the code that proves anything.

    FRONTEND_URL is typed by hand on every machine, which makes a typo a matter
    of when. Each of these is a typo somebody will make."""

    def test_unset_is_a_valid_answer_and_means_no_link(self):
        from apps.links import frontend_link

        with override_settings(FRONTEND_URL=''):
            self.assertEqual(frontend_link('verify-email'), '')

    def test_a_url_with_no_scheme_is_not_a_url(self):
        """'localhost:3000' parses as scheme 'localhost'. Guessing http:// for
        it is how a message ends up with a relative path in a mail client."""
        from apps.links import frontend_link

        with override_settings(FRONTEND_URL='localhost:3000',
                               CORS_ALLOWED_ORIGINS=['http://localhost:3000']):
            self.assertEqual(frontend_link('verify-email'), '')

    def test_a_host_we_never_heard_of_is_refused(self):
        """This is the rule that stops a hostile or mistyped value being mailed
        out over our name."""
        from apps.links import frontend_link

        with override_settings(FRONTEND_URL='https://not-ours.example',
                               CORS_ALLOWED_ORIGINS=['http://localhost:3000']):
            self.assertEqual(frontend_link('verify-email'), '')

    def test_one_of_our_own_front_ends_is_allowed(self):
        from apps.links import frontend_link

        with override_settings(FRONTEND_URL='http://localhost:3000/',
                               CORS_ALLOWED_ORIGINS=['http://localhost:3000']):
            self.assertEqual(frontend_link('/verify-email'), 'http://localhost:3000/verify-email')
            self.assertEqual(frontend_link(), 'http://localhost:3000')
