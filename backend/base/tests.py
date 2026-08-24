"""Configuration-level regression tests for findings from the 2026-08-22 audit.

These check settings rather than endpoints. They are cheap and they catch the
class of bug that `manage.py check` stays silent about.
"""
import importlib
import os
import sys

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

    def test_anonymous_read_budget_is_realistic(self):
        from django.conf import settings

        rate = settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['anon']
        count, _, period = rate.partition('/')
        self.assertTrue(
            period != 'day' or int(count) >= 1000,
            f'anon rate {rate} is too tight for a public education site',
        )


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


class OriginConfigTests(SimpleTestCase):
    """The outage of 2026-08-23: the front end could not reach the API at all,
    because every cross-origin request was refused before it started. Three
    separate settings can produce that one browser message, and two of them look
    nothing like a CORS problem, so each gets a test."""

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
