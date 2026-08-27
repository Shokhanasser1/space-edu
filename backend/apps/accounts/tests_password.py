"""Getting back into an account, and changing the way in.

Until now there was no way to do either. No reset, no change, no endpoint that
set a password at all: `ProfileSerializer` does not accept one and
`UserSerializer` is read-only throughout. A child who forgot their password had
lost the account, and the only recovery anywhere was the passwordless sign-in
code, which nothing in the front end called.
"""
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .email_code import LOGIN, PASSWORD_RESET, store_code
from .models import User

VALID_PW = 'Str0ngPassw0rd!x'
NEW_PW = 'An0therG00dOne!42'


def _code_from_the_last_message():
    return next(w for w in mail.outbox[-1].body.split() if w.isdigit() and len(w) == 6)


class PasswordResetRequestTests(TestCase):
    """The half that anybody can call."""

    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []
        User.objects.create_user('pilot', email='pilot@example.com', password=VALID_PW)

    def test_an_account_gets_a_code(self):
        r = self.client.post(
            '/api/v1/auth/password/reset/request/',
            {'email': 'pilot@example.com'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_an_address_nobody_uses_gets_the_same_answer_and_no_mail(self):
        """The reply must not say whether there is an account, or this is a list
        of which children have accounts here, readable by anyone with a keyboard."""
        known = self.client.post(
            '/api/v1/auth/password/reset/request/',
            {'email': 'pilot@example.com'}, format='json',
        )
        mail.outbox = []
        unknown = self.client.post(
            '/api/v1/auth/password/reset/request/',
            {'email': 'nobody@example.com'}, format='json',
        )
        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.data, unknown.data)
        self.assertEqual(mail.outbox, [])

    def test_something_that_is_not_an_address_is_a_400(self):
        r = self.client.post(
            '/api/v1/auth/password/reset/request/', {'email': 'not-an-address'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []
        self.user = User.objects.create_user('pilot', email='pilot@example.com', password=VALID_PW)

    def _ask(self):
        self.client.post(
            '/api/v1/auth/password/reset/request/',
            {'email': 'pilot@example.com'}, format='json',
        )
        return _code_from_the_last_message()

    def _confirm(self, code, password=NEW_PW, password2=None):
        return self.client.post(
            '/api/v1/auth/password/reset/confirm/',
            {'email': 'pilot@example.com', 'code': code,
             'password': password, 'password2': password2 or password},
            format='json',
        )

    def test_the_code_sets_the_password(self):
        r = self._confirm(self._ask())
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PW))
        self.assertFalse(self.user.check_password(VALID_PW))

    def test_no_tokens_come_back(self):
        """The code arrived by e-mail and there is already an endpoint that
        turns an e-mailed code into a session. Two doors into one room is one
        more than is needed."""
        r = self._confirm(self._ask())
        self.assertNotIn('access', r.data)
        self.assertNotIn('refresh', r.data)

    def test_a_wrong_code_changes_nothing(self):
        self._ask()
        r = self._confirm('000000')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(VALID_PW))

    def test_a_code_works_once(self):
        code = self._ask()
        self._confirm(code)
        self.assertEqual(self._confirm(code).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_an_unknown_address_is_refused_the_same_way_as_a_wrong_code(self):
        code = store_code('nobody@example.com', PASSWORD_RESET)
        r = self.client.post(
            '/api/v1/auth/password/reset/confirm/',
            {'email': 'nobody@example.com', 'code': code,
             'password': NEW_PW, 'password2': NEW_PW},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_sign_in_code_is_not_a_reset_code(self):
        store_code('pilot@example.com', LOGIN)
        # The sign-in code exists but the reset namespace is empty, so nothing
        # can be confirmed with it.
        r = self._confirm('123456')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_the_new_password_goes_through_the_same_rules_as_registration(self):
        code = self._ask()
        r = self._confirm(code, password='12345678')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', r.data)

    def test_two_different_new_passwords_are_refused(self):
        r = self._confirm(self._ask(), password=NEW_PW, password2='SomethingElse!99')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_everything_that_was_signed_in_is_signed_out(self):
        """A password reset that leaves whoever caused it still signed in has
        not done the one thing it is for. It caps them at the remaining life of
        their access token, which is as far as blacklisting refresh tokens can
        go -- see apps/accounts/tokens.py."""
        signed_in = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'pilot@example.com', 'password': VALID_PW}, format='json',
        )
        refresh = signed_in.data['refresh']

        self._confirm(self._ask())

        r = self.client.post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)


class PasswordChangeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        self.user = User.objects.create_user('pilot', email='pilot@example.com', password=VALID_PW)
        self.client.force_authenticate(user=self.user)

    def _change(self, **over):
        payload = {'current_password': VALID_PW, 'password': NEW_PW, 'password2': NEW_PW}
        payload.update(over)
        return self.client.post('/api/v1/auth/password/change/', payload, format='json')

    def test_it_changes_the_password(self):
        r = self._change()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PW))

    def test_the_wrong_current_password_is_refused(self):
        r = self._change(current_password='not-it')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('current_password', r.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(VALID_PW))

    def test_a_missing_current_password_is_refused(self):
        r = self.client.post(
            '/api/v1/auth/password/change/',
            {'password': NEW_PW, 'password2': NEW_PW}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_fresh_pair_comes_back_so_the_tab_doing_this_survives(self):
        r = self._change()
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)

        check = self.client.post(
            '/api/v1/auth/token/refresh/', {'refresh': r.data['refresh']}, format='json',
        )
        self.assertEqual(check.status_code, status.HTTP_200_OK)

    def test_every_other_session_ends(self):
        elsewhere = APIClient().post(
            '/api/v1/auth/login/',
            {'email': 'pilot@example.com', 'password': VALID_PW}, format='json',
        ).data['refresh']

        self._change()

        r = self.client.post('/api/v1/auth/token/refresh/', {'refresh': elsewhere}, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_password_that_is_the_address_is_refused(self):
        """UserAttributeSimilarityValidator is in AUTH_PASSWORD_VALIDATORS and
        does nothing unless the user is passed to it. Registration cannot pass
        one -- there is no account yet -- but everything here can."""
        r = self._change(password='pilot@example.com', password2='pilot@example.com')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', r.data)

    def test_an_account_with_no_password_is_sent_to_prove_its_address(self):
        """A bearer token is not enough to set a first password.

        An account has no usable password for one of two reasons, and only one
        is harmless: it arrived through Google, or `rotate_leaked_credentials`
        took the password away because it had leaked. That command blacklists
        every refresh token and clears every session, but an access token cannot
        be revoked and lives eight hours -- so a password-free path through here
        would have handed a leaked account back to whoever held one, permanently,
        for those eight hours.
        """
        self.user.set_unusable_password()
        self.user.save(update_fields=['password'])

        r = self.client.post(
            '/api/v1/auth/password/change/',
            {'password': NEW_PW, 'password2': NEW_PW}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(r.data.get('code'), 'no_password_set')
        self.user.refresh_from_db()
        self.assertFalse(self.user.has_usable_password())

    def test_the_way_it_does_get_a_first_password(self):
        """Through the reset flow, which sends a code to the address on the
        account -- something a stolen token does not carry."""
        self.user.set_unusable_password()
        self.user.save(update_fields=['password'])
        mail.outbox = []

        self.client.post(
            '/api/v1/auth/password/reset/request/',
            {'email': 'pilot@example.com'}, format='json',
        )
        code = _code_from_the_last_message()
        r = self.client.post(
            '/api/v1/auth/password/reset/confirm/',
            {'email': 'pilot@example.com', 'code': code,
             'password': NEW_PW, 'password2': NEW_PW},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PW))

    def test_a_stranger_cannot_call_it(self):
        self.client.force_authenticate(user=None)
        r = self._change()
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
