"""Proving that an e-mail address belongs to the person holding the account.

`docs/HANDOVER.md` named this the next thing to do: the code machinery existed
and was tested, nothing called it, and registration asked for an address without
ever checking one. An unproved address is worth nothing -- a password cannot be
reset to it, a Google account cannot be linked by it, and a child cannot be
reached through it.

The rule that runs through all of these: a code proves one thing, not any thing.
"""
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .email_code import LOGIN, VERIFY_EMAIL, store_code
from .models import User

VALID_PW = 'Str0ngPassw0rd!x'


def _register_payload(**over):
    data = {
        'first_name': 'Aziz', 'last_name': 'Karimov',
        'email': 'aziz@example.com', 'date_of_birth': '2010-01-01',
        'password': VALID_PW, 'password2': VALID_PW,
    }
    data.update(over)
    return data


class RegistrationSendsACodeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []

    def test_registering_sends_one(self):
        r = self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['aziz@example.com'])

    def test_a_new_account_is_not_confirmed_yet(self):
        r = self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        self.assertFalse(r.data['user']['email_verified'])
        self.assertIsNone(User.objects.get(email='aziz@example.com').email_verified_at)

    def test_the_code_is_never_in_the_response(self):
        """`dev_code` in a response body, under a DEBUG flag that defaulted to
        on, was a two-request takeover of any account. It does not come back in
        another shape."""
        with override_settings(DEBUG=True):
            r = self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        code = mail.outbox[0].body
        self.assertNotIn('dev_code', str(r.data))
        for digits in [w for w in code.split() if w.isdigit() and len(w) == 6]:
            self.assertNotIn(digits, str(r.data))

    def test_a_mail_server_that_is_down_does_not_cost_somebody_their_account(self):
        with override_settings(EMAIL_BACKEND='apps.accounts.tests_verification.BrokenBackend'):
            r = self.client.post('/api/v1/auth/register/', _register_payload(), format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email='aziz@example.com').exists())


class BrokenBackend:
    """A mail backend that cannot send, for the test above."""

    def __init__(self, *args, **kwargs):
        pass

    def send_messages(self, messages):
        raise RuntimeError('the mail server is not answering')

    def open(self):
        raise RuntimeError('the mail server is not answering')

    def close(self):
        pass


class ConfirmAddressTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []
        self.user = User.objects.create_user(
            'pilot', email='pilot@example.com', password=VALID_PW,
        )
        self.client.force_authenticate(user=self.user)

    def _code_from_the_message(self):
        return next(w for w in mail.outbox[-1].body.split() if w.isdigit() and len(w) == 6)

    def test_asking_for_a_code_and_using_it(self):
        r = self.client.post('/api/v1/auth/email/verify/request/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        r = self.client.post(
            '/api/v1/auth/email/verify/confirm/',
            {'code': self._code_from_the_message()}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['email_verified'])

        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.email_verified_at)

    def test_the_response_carries_the_answer_and_not_the_hour_of_it(self):
        """A timestamp says when a particular child was at a computer. Nothing
        needs that, so the response carries the boolean (C-11)."""
        r = self.client.get('/api/v1/auth/me/')
        self.assertIn('email_verified', r.data)
        self.assertNotIn('email_verified_at', r.data)

    def test_a_wrong_code_is_refused_without_signing_anybody_out(self):
        """400 and not 401. The caller is signed in; the code is what is wrong.
        A 401 sends the front end's interceptor off to refresh a good token and
        then signs the child out for mistyping a digit."""
        self.client.post('/api/v1/auth/email/verify/request/')
        r = self.client.post(
            '/api/v1/auth/email/verify/confirm/', {'code': '000000'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.email_verified_at)

    def test_a_code_works_once(self):
        self.client.post('/api/v1/auth/email/verify/request/')
        code = self._code_from_the_message()
        self.client.post('/api/v1/auth/email/verify/confirm/', {'code': code}, format='json')

        self.user.email_verified_at = None
        self.user.save(update_fields=['email_verified_at'])
        r = self.client.post(
            '/api/v1/auth/email/verify/confirm/', {'code': code}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_something_that_is_not_six_digits_is_refused_before_anything_else(self):
        for wrong in ('', '12345', '1234567', 'abcdef', '12 34 56'):
            with self.subTest(code=wrong):
                r = self.client.post(
                    '/api/v1/auth/email/verify/confirm/', {'code': wrong}, format='json',
                )
                self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_address_is_the_account_s_own_and_not_the_caller_s_choice(self):
        """Otherwise this is a way to send mail signed with our name to any
        address in the world."""
        self.client.post(
            '/api/v1/auth/email/verify/request/',
            {'email': 'somebody.else@example.com'}, format='json',
        )
        self.assertEqual(mail.outbox[-1].to, ['pilot@example.com'])

    def test_asking_again_when_it_is_already_done_sends_nothing(self):
        self.client.post('/api/v1/auth/email/verify/request/')
        self.client.post(
            '/api/v1/auth/email/verify/confirm/',
            {'code': self._code_from_the_message()}, format='json',
        )
        before = len(mail.outbox)
        r = self.client.post('/api/v1/auth/email/verify/request/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), before)

    def test_signing_out_of_it_entirely(self):
        self.client.force_authenticate(user=None)
        r = self.client.post('/api/v1/auth/email/verify/request/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class CodesAreNotInterchangeableTests(TestCase):
    """The purpose is part of the cache key, and this is why.

    A code mailed out to confirm an address must not be presentable at the
    passwordless sign-in endpoint to obtain a token pair, and a sign-in code
    must not confirm an address. One shared namespace would make the weakest
    flow a way into all of them.
    """

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = User.objects.create_user(
            'pilot', email='pilot@example.com', password=VALID_PW,
        )

    def test_a_confirmation_code_does_not_sign_anybody_in(self):
        code = store_code('pilot@example.com', VERIFY_EMAIL)
        r = self.client.post(
            '/api/v1/auth/email-code/verify/',
            {'email': 'pilot@example.com', 'code': code}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', r.data)

    def test_a_sign_in_code_does_not_confirm_an_address(self):
        code = store_code('pilot@example.com', LOGIN)
        self.client.force_authenticate(user=self.user)
        r = self.client.post(
            '/api/v1/auth/email/verify/confirm/', {'code': code}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.email_verified_at)

    def test_the_old_sign_in_flow_still_works(self):
        """Generalising the module must not have moved the thing that was
        already there."""
        r = self.client.post(
            '/api/v1/auth/email-code/request/',
            {'email': 'pilot@example.com'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        code = next(w for w in mail.outbox[-1].body.split() if w.isdigit() and len(w) == 6)
        r = self.client.post(
            '/api/v1/auth/email-code/verify/',
            {'email': 'pilot@example.com', 'code': code}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('access', r.data)
