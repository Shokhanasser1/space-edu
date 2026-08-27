"""Tests for the space-data proxy.

Everything upstream is mocked at ``services._http_get``. The cache is swapped
for LocMemCache so nothing here needs the ``django_cache`` table, and the
tests are SimpleTestCase on purpose: these endpoints must never touch the
database, and SimpleTestCase fails the moment one does.

The point of most of these is the failure path. A proxy that keeps calling
CelesTrak while it is returning errors is the thing that gets a school's
address firewalled, so "does not go upstream again" is asserted, not assumed.
"""
import json
import os
import urllib.error
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from . import services
from .services import parse_horizons

HORIZONS_FIXTURE = """API VERSION: 1.2
API SOURCE: NASA/JPL Horizons API

*******************************************************************************
Ephemeris / API_USER Thu Aug 27 00:00:00 2026 Pasadena, USA      / Horizons
*******************************************************************************
JDTDB, Calendar Date (TDB), X, Y, Z,
*******************************************************************************
$$SOE
2461279.500000000, A.D. 2026-Aug-27 00:00:00.0000,  9.034253769074524E-01, -4.525304755406013E-01,  2.230128718714825E-05,
2461280.500000000, A.D. 2026-Aug-28 00:00:00.0000,  9.107180919797239E-01, -4.371542545240849E-01,  2.068543539315852E-05,
$$EOE
*******************************************************************************
"""

HORIZONS_ERROR = "No matching record found for -12345. Check the spelling.\n"

GP_RECORDS = [
    {'OBJECT_NAME': 'ISS (ZARYA)', 'NORAD_CAT_ID': 25544, 'MEAN_MOTION': 15.49},
    {'OBJECT_NAME': 'CSS (TIANHE)', 'NORAD_CAT_ID': 48274, 'MEAN_MOTION': 15.61},
    {'OBJECT_NAME': 'ISS (NAUKA)', 'NORAD_CAT_ID': 49044, 'MEAN_MOTION': 15.49},
    {'OBJECT_NAME': 'FREGAT DEB', 'NORAD_CAT_ID': 39024, 'MEAN_MOTION': 15.49},
    {'OBJECT_NAME': 'CREW DRAGON', 'NORAD_CAT_ID': 60000, 'MEAN_MOTION': 15.49},
]
GP_JSON = json.dumps(GP_RECORDS)

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def _http_error(url='https://celestrak.org/x'):
    return urllib.error.HTTPError(url, 403, 'Forbidden', {}, None)


@override_settings(CACHES=LOCMEM)
class SpaceProxyTestCase(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()


class GpWhitelistTests(SpaceProxyTestCase):
    def test_unknown_group_is_rejected_before_going_upstream(self):
        with patch('apps.space.services._http_get') as http:
            r = self.client.get('/api/v1/space/gp/', {'group': 'military'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('detail', r.json())
        http.assert_not_called()

    def test_missing_group_is_rejected(self):
        with patch('apps.space.services._http_get') as http:
            r = self.client.get('/api/v1/space/gp/')
        self.assertEqual(r.status_code, 400)
        http.assert_not_called()

    def test_bad_limit_is_rejected(self):
        with patch('apps.space.services._http_get') as http:
            for bad in ('0', '-1', 'ten', '20001'):
                with self.subTest(limit=bad):
                    r = self.client.get('/api/v1/space/gp/', {'group': 'stations', 'limit': bad})
                    self.assertEqual(r.status_code, 400)
        http.assert_not_called()


class GpCachingTests(SpaceProxyTestCase):
    def test_successful_fetch_is_cached(self):
        with patch('apps.space.services._http_get', return_value=GP_JSON) as http:
            first = self.client.get('/api/v1/space/gp/', {'group': 'stations'})
            second = self.client.get('/api/v1/space/gp/', {'group': 'stations'})

        self.assertEqual(first.status_code, 200)
        body = first.json()
        self.assertEqual(body['group'], 'stations')
        self.assertEqual(body['count'], len(GP_RECORDS))
        self.assertEqual(body['satellites'], GP_RECORDS)
        self.assertFalse(body['stale'])
        self.assertTrue(body['fetched_at'].endswith('Z'))
        self.assertEqual(first['Cache-Control'], 'public, max-age=300')

        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json(), body)
        self.assertEqual(http.call_count, 1, 'second request must be served from cache')
        (url,), _ = http.call_args
        self.assertEqual(
            url, 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json'
        )

    def test_limit_truncates_the_response_but_not_the_cache(self):
        with patch('apps.space.services._http_get', return_value=GP_JSON) as http:
            limited = self.client.get('/api/v1/space/gp/', {'group': 'stations', 'limit': 2})
            full = self.client.get('/api/v1/space/gp/', {'group': 'stations'})

        self.assertEqual(limited.status_code, 200)
        self.assertEqual(limited.json()['count'], 2)
        self.assertEqual(limited.json()['satellites'], GP_RECORDS[:2])
        self.assertEqual(full.json()['count'], len(GP_RECORDS))
        self.assertEqual(http.call_count, 1)

    def test_upstream_failure_serves_the_stale_copy(self):
        with patch('apps.space.services._http_get', return_value=GP_JSON):
            self.client.get('/api/v1/space/gp/', {'group': 'stations'})
        # The fresh copy expires; the week-long one stays.
        cache.delete('space:gp:stations')

        with patch('apps.space.services._http_get', side_effect=_http_error()) as http:
            r = self.client.get('/api/v1/space/gp/', {'group': 'stations'})

        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['stale'])
        self.assertEqual(r.json()['satellites'], GP_RECORDS)
        self.assertEqual(http.call_count, 1)

    def test_upstream_failure_without_a_copy_is_503_and_backs_off(self):
        with patch('apps.space.services._http_get', side_effect=_http_error()) as http:
            first = self.client.get('/api/v1/space/gp/', {'group': 'stations'})
            second = self.client.get('/api/v1/space/gp/', {'group': 'stations'})

        self.assertEqual(first.status_code, 503)
        self.assertEqual(first.json(), {'detail': 'upstream unavailable'})
        self.assertEqual(second.status_code, 503)
        self.assertEqual(
            http.call_count, 1, 'a failed key must not be retried inside the back-off window'
        )
        self.assertIsNotNone(cache.get('space:gp:stations:failed'))

    def test_timeout_and_garbage_count_as_failures(self):
        for effect in (TimeoutError('timed out'), urllib.error.URLError('dns'), None):
            cache.clear()
            with self.subTest(effect=effect):
                kwargs = {'side_effect': effect} if effect else {'return_value': 'Invalid query'}
                with patch('apps.space.services._http_get', **kwargs):
                    r = self.client.get('/api/v1/space/gp/', {'group': 'stations'})
                self.assertEqual(r.status_code, 503)


class EphemerisTests(SpaceProxyTestCase):
    def test_unknown_body_is_rejected(self):
        with patch('apps.space.services._http_get') as http:
            for bad in ('-12345', '', '399; DROP', "'-31'"):
                with self.subTest(body=bad):
                    r = self.client.get('/api/v1/space/ephemeris/', {'body': bad})
                    self.assertEqual(r.status_code, 400)
        http.assert_not_called()

    def test_days_out_of_range_is_rejected(self):
        with patch('apps.space.services._http_get') as http:
            for bad in ('0', '121', 'soon'):
                with self.subTest(days=bad):
                    r = self.client.get('/api/v1/space/ephemeris/', {'body': '-31', 'days': bad})
                    self.assertEqual(r.status_code, 400)
        http.assert_not_called()

    def test_parse_horizons_fixture(self):
        samples = parse_horizons(HORIZONS_FIXTURE)
        self.assertEqual(len(samples), 2)
        self.assertEqual(
            samples[0],
            [2461279.5, 9.034253769074524e-01, -4.525304755406013e-01, 2.230128718714825e-05],
        )
        self.assertEqual(
            samples[1],
            [2461280.5, 9.107180919797239e-01, -4.371542545240849e-01, 2.068543539315852e-05],
        )
        for sample in samples:
            self.assertTrue(all(isinstance(v, float) for v in sample))

    def test_parse_horizons_rejects_an_error_page(self):
        with self.assertRaises(ValueError):
            parse_horizons(HORIZONS_ERROR)

    def test_endpoint_shape_and_url(self):
        with patch('apps.space.services._http_get', return_value=HORIZONS_FIXTURE) as http:
            r = self.client.get('/api/v1/space/ephemeris/', {'body': '-31'})
            again = self.client.get('/api/v1/space/ephemeris/', {'body': '-31', 'days': 30})

        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body['body'], '-31')
        self.assertEqual(body['name'], 'Voyager 1')
        self.assertEqual(body['frame'], 'heliocentric ecliptic J2000')
        self.assertEqual(body['units'], {'position': 'au', 'time': 'jd'})
        self.assertFalse(body['stale'])
        self.assertEqual(len(body['samples']), 2)
        self.assertEqual(body['samples'][0][0], 2461279.5)
        self.assertEqual(r['Cache-Control'], 'public, max-age=3600')

        self.assertEqual(again.status_code, 200)
        self.assertEqual(http.call_count, 1, 'same body, same days, same day: one upstream call')
        (url,), _ = http.call_args
        self.assertTrue(url.startswith('https://ssd.jpl.nasa.gov/api/horizons.api?format=text&'))
        self.assertIn('COMMAND=%27-31%27', url)
        self.assertIn('EPHEM_TYPE=%27VECTORS%27', url)
        self.assertIn('CENTER=%27500%4010%27', url)
        self.assertIn('STEP_SIZE=%276h%27', url)
        self.assertIn('START_TIME=%27', url)
        self.assertIn('STOP_TIME=%27', url)

    def test_horizons_error_page_is_503(self):
        with patch('apps.space.services._http_get', return_value=HORIZONS_ERROR):
            r = self.client.get('/api/v1/space/ephemeris/', {'body': '-202'})
        self.assertEqual(r.status_code, 503)


class LaunchesTests(SpaceProxyTestCase):
    def test_passthrough(self):
        payload = {'count': 1, 'results': [{'name': 'Falcon 9 | Starlink'}]}
        with patch('apps.space.services._http_get', return_value=json.dumps(payload)) as http:
            r = self.client.get('/api/v1/space/launches/')
            self.client.get('/api/v1/space/launches/')

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['data'], payload)
        self.assertFalse(r.json()['stale'])
        self.assertEqual(r['Cache-Control'], 'public, max-age=300')
        self.assertEqual(http.call_count, 1)
        self.assertEqual(http.call_args[0][0], services.LAUNCHES_URL)


class ApodTests(SpaceProxyTestCase):
    def test_key_reaches_nasa_but_never_the_client_or_the_cache(self):
        payload = {'title': 'Pillars of Creation', 'url': 'https://apod.nasa.gov/x.jpg'}
        with patch.dict(os.environ, {'NASA_API_KEY': 'sekrit-key-42'}):
            with patch('apps.space.services._http_get', return_value=json.dumps(payload)) as http:
                r = self.client.get('/api/v1/space/apod/')

        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['data'], payload)
        self.assertEqual(r['Cache-Control'], 'public, max-age=3600')
        self.assertNotIn('sekrit-key-42', r.content.decode())
        self.assertIn('api_key=sekrit-key-42', http.call_args[0][0])
        self.assertIsNotNone(cache.get('space:apod'))
        self.assertIsNone(cache.get('space:apod:sekrit-key-42'))

    def test_falls_back_to_demo_key(self):
        env = {k: v for k, v in os.environ.items() if k != 'NASA_API_KEY'}
        with patch.dict(os.environ, env, clear=True):
            with patch('apps.space.services._http_get', return_value='{}') as http:
                r = self.client.get('/api/v1/space/apod/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('api_key=DEMO_KEY', http.call_args[0][0])
