"""Bodies and query strings the views never expected must be a 400, not a 500.

Audit, 21 October 2026. Every view here reads its JSON body as an object --
`request.data.get(...)`, `request.data.items()` -- and a body that was a JSON
array, a string or `null` raised AttributeError: a 500, with a debug page while
DEBUG defaults to on. The same for a `year` that was not a number. Each of
these is one request anybody can send.
"""
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User


class NonObjectBodyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='pupil', email='p@e.com', password='x', email_verified_at=timezone.now(),
        )
        self.staff = User.objects.create_superuser(username='owner', email='o@e.com', password='x')
        self.anon = APIClient()
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.admin = APIClient()
        self.admin.force_authenticate(self.staff)

    def _post(self, client, url, body):
        return client.post(url, body, format='json')

    def test_every_object_reading_endpoint_refuses_an_array(self):
        cases = [
            (self.anon, 'post', '/api/v1/auth/login/'),
            (self.anon, 'post', '/api/v1/auth/logout/'),
            (self.anon, 'post', '/api/v1/auth/email-code/request/'),
            (self.client, 'post', '/api/v1/gamification/rewards/buy/'),
            (self.client, 'post', '/api/v1/gamification/missions/claim/'),
            (self.client, 'post', '/api/v1/chat/blocks/'),
            (self.admin, 'patch', f'/api/v1/admin-panel/users/{self.user.pk}/'),
        ]
        for client, method, url in cases:
            # Raw, because the test client turns None into an empty body rather
            # than the JSON `null` a caller can send.
            for raw in ('["x"]', '"x"', 'null', '42'):
                with self.subTest(url=url, body=raw):
                    r = client.generic(method.upper(), url, raw, content_type='application/json')
                    self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, r.content[:200])

    def test_an_object_body_still_works(self):
        r = self.anon.post(
            '/api/v1/auth/login/', {'email': 'p@e.com', 'password': 'x'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)


class EventYearTests(TestCase):
    def test_a_year_that_is_not_a_number_is_a_400(self):
        for year in ('abc', '99999', '0', '-5'):
            with self.subTest(year=year):
                r = APIClient().get('/api/v1/events/', {'year': year})
                self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_real_year_still_filters(self):
        r = APIClient().get('/api/v1/events/', {'year': '1961'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
