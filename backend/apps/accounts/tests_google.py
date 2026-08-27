"""Signing in with Google, and the several ways that could hand over an account.

Nothing here reaches Google. `verify_google_id_token` is the one function that
touches the network and it is patched, which is the reason the module is split
in two: everything that decides *which account somebody lands in* takes a
dictionary and can be pushed at from every angle.
"""
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import SocialAccount, User

VALID_PW = 'Str0ngPassw0rd!x'

CLAIMS = {
    'iss': 'https://accounts.google.com',
    'sub': '1234567890',
    'email': 'pupil@example.com',
    'email_verified': True,
    'given_name': 'Aziz',
    'family_name': 'Karimov',
    'picture': 'https://lh3.googleusercontent.com/a/some-child-photo',
    'name': 'Aziz Karimov',
}


def claims(**over):
    data = dict(CLAIMS)
    data.update(over)
    return data


@override_settings(GOOGLE_CLIENT_ID='test-client-id.apps.googleusercontent.com')
class GoogleSignInTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _sign_in(self, with_claims=None):
        with patch('apps.accounts.views.verify_google_id_token',
                   return_value=with_claims or claims()):
            return self.client.post(
                '/api/v1/auth/google/', {'credential': 'a.signed.token'}, format='json',
            )

    # ── a new person ─────────────────────────────────────────────────────
    def test_an_unknown_address_gets_an_account(self):
        r = self._sign_in()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['created'])
        self.assertIn('access', r.data)

        user = User.objects.get(email='pupil@example.com')
        self.assertEqual(user.first_name, 'Aziz')
        self.assertEqual(user.role, User.Role.STUDENT)
        self.assertIsNotNone(user.email_verified_at)

    def test_the_new_account_has_no_password_to_guess(self):
        self._sign_in()
        self.assertFalse(User.objects.get(email='pupil@example.com').has_usable_password())

    def test_it_does_not_take_the_child_s_photograph(self):
        """Avatars here live in a bucket that is public and unsigned, so copying
        one publishes a picture of a child that they did not choose to upload,
        to anyone who guesses the URL. The URL is not stored either."""
        r = self._sign_in()
        user = User.objects.get(email='pupil@example.com')
        self.assertFalse(user.avatar)
        self.assertNotIn('googleusercontent', str(r.data))

    def test_it_says_the_profile_is_not_finished(self):
        """Registration asks for a date of birth and Google does not give one,
        so the client has to ask rather than the server inventing one."""
        r = self._sign_in()
        self.assertFalse(r.data['profile_complete'])
        self.assertIsNone(User.objects.get(email='pupil@example.com').date_of_birth)

    def test_it_can_play_and_learn_immediately(self):
        """The two profile rows registration creates are created here too, or
        the first page the account lands on has nothing to read."""
        self._sign_in()
        user = User.objects.get(email='pupil@example.com')
        self.assertTrue(hasattr(user, 'gamification'))

    # ── the same person again ────────────────────────────────────────────
    def test_signing_in_twice_does_not_make_two_accounts(self):
        first = self._sign_in()
        second = self._sign_in()
        self.assertEqual(User.objects.filter(email='pupil@example.com').count(), 1)
        self.assertFalse(second.data['created'])
        self.assertEqual(first.data['user']['id'], second.data['user']['id'])

    def test_it_is_the_google_id_that_identifies_them_not_the_address(self):
        """People change the address on their Google account. Following that by
        moving which account they sign in to is not a thing to do quietly."""
        self._sign_in()
        user = User.objects.get(email='pupil@example.com')

        r = self._sign_in(claims(email='moved@example.com'))
        self.assertEqual(r.data['user']['id'], user.pk)
        user.refresh_from_db()
        self.assertEqual(user.email, 'pupil@example.com')

    def test_a_suspended_account_does_not_come_back_through_google(self):
        self._sign_in()
        User.objects.filter(email='pupil@example.com').update(is_active=False)
        r = self._sign_in()
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── somebody who already has an account here ─────────────────────────
    def test_it_links_to_a_confirmed_account_and_leaves_it_alone(self):
        existing = User.objects.create_user(
            'aziz', email='pupil@example.com', password=VALID_PW,
            email_verified_at=timezone.now(),
        )
        r = self._sign_in()

        self.assertEqual(r.data['user']['id'], existing.pk)
        self.assertFalse(r.data['created'])
        self.assertFalse(r.data['password_reset_required'])
        existing.refresh_from_db()
        self.assertTrue(existing.check_password(VALID_PW))

    def test_an_account_made_on_somebody_else_s_address_loses_its_password(self):
        """The attack this is for: registration hands out tokens immediately and
        confirms nothing, so anybody can make an account on a victim's address
        and wait. When the victim signs in with Google they land in that
        account -- and whoever made it still knows the password.

        Google has proved the address; the account has proved nothing. So the
        account is linked and its password cleared. That costs a real child one
        password reset and costs an attacker the account. Refusing instead would
        leave the victim with no way in at all."""
        squatter = User.objects.create_user(
            'squatter', email='pupil@example.com', password=VALID_PW,
        )
        self.assertIsNone(squatter.email_verified_at)

        r = self._sign_in()

        self.assertEqual(r.data['user']['id'], squatter.pk)
        self.assertTrue(r.data['password_reset_required'])
        squatter.refresh_from_db()
        self.assertFalse(squatter.check_password(VALID_PW))
        self.assertFalse(squatter.has_usable_password())
        self.assertIsNotNone(squatter.email_verified_at)

    def test_the_squatter_s_open_sessions_end_with_it(self):
        squatter = User.objects.create_user(
            'squatter', email='pupil@example.com', password=VALID_PW,
        )
        refresh = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'pupil@example.com', 'password': VALID_PW}, format='json',
        ).data['refresh']

        self._sign_in()

        r = self.client.post('/api/v1/auth/token/refresh/', {'refresh': refresh}, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIsNotNone(squatter)

    # ── tokens we will not accept ────────────────────────────────────────
    def test_an_address_google_has_not_confirmed_is_refused(self):
        """Every branch above keys on the address. One Google has not proved
        must not match an account -- and an account created from one becomes a
        match for somebody else later."""
        r = self._sign_in(claims(email_verified=False))
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(r.data['code'], 'google_email_unverified')
        self.assertEqual(User.objects.count(), 0)

    def test_a_token_the_library_rejects_is_refused(self):
        with patch('apps.accounts.views.verify_google_id_token',
                   side_effect=ValueError('Token has wrong audience')):
            r = self.client.post(
                '/api/v1/auth/google/', {'credential': 'a.forged.token'}, format='json',
            )
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(User.objects.count(), 0)

    def test_an_empty_body_is_a_400_and_not_a_crash(self):
        r = self.client.post('/api/v1/auth/google/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_reason_a_token_was_rejected_does_not_come_back(self):
        with patch('apps.accounts.views.verify_google_id_token',
                   side_effect=ValueError('Token used too late, 1500 > 1400')):
            r = self.client.post(
                '/api/v1/auth/google/', {'credential': 'x'}, format='json',
            )
        self.assertNotIn('1500', str(r.data))


class GoogleIsNotConfiguredTests(TestCase):
    """Without a client id there is nothing to check a token against.

    google-auth accepts `audience=None` without complaint, and it means "do not
    check who this was minted for" -- which would turn this endpoint into "any
    Google token for any application on the internet signs you in as whatever
    address it names". So an empty setting refuses before the library is
    reached, rather than falling through to the permissive branch (C-7).
    """

    @override_settings(GOOGLE_CLIENT_ID='')
    def test_it_refuses_and_says_why(self):
        r = APIClient().post('/api/v1/auth/google/', {'credential': 'x'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(r.data['code'], 'google_unconfigured')

    @override_settings(GOOGLE_CLIENT_ID='   ')
    def test_whitespace_is_not_a_client_id(self):
        r = APIClient().post('/api/v1/auth/google/', {'credential': 'x'}, format='json')
        self.assertEqual(r.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    @override_settings(GOOGLE_CLIENT_ID='')
    def test_the_library_is_never_reached(self):
        with patch('google.oauth2.id_token.verify_oauth2_token') as library:
            APIClient().post('/api/v1/auth/google/', {'credential': 'x'}, format='json')
        library.assert_not_called()


@override_settings(GOOGLE_CLIENT_ID='test-client-id.apps.googleusercontent.com')
class IssuerTests(TestCase):
    """verify_oauth2_token checks the signature, the expiry and the audience.
    It does not check who issued the token, so that is checked here."""

    def test_a_token_from_somewhere_else_is_refused(self):
        from .google import verify_google_id_token

        with patch('google.oauth2.id_token.verify_oauth2_token',
                   return_value=claims(iss='https://accounts.example.com')):
            with self.assertRaises(ValueError):
                verify_google_id_token('x')

    def test_both_spellings_google_uses_are_accepted(self):
        from .google import verify_google_id_token

        for issuer in ('accounts.google.com', 'https://accounts.google.com'):
            with self.subTest(iss=issuer):
                with patch('google.oauth2.id_token.verify_oauth2_token',
                           return_value=claims(iss=issuer)):
                    self.assertEqual(verify_google_id_token('x')['iss'], issuer)


@override_settings(GOOGLE_CLIENT_ID='test-client-id.apps.googleusercontent.com')
class TwoAccountsOnOneAddressTests(TestCase):
    """Impossible since migration 0005, and refused rather than guessed at.

    Picking one of two children's accounts to hand somebody is not a thing to do
    on a best-effort basis, and `.order_by('id').first()` -- which is what the
    rest of this project still does for a sign-in -- would do exactly that.
    """

    def test_it_refuses_to_choose(self):
        from .google import GoogleRefused, resolve_google_user

        with patch('apps.accounts.google.User.objects.filter') as query:
            query.return_value.order_by.return_value.__getitem__.return_value = [
                object(), object(),
            ]
            with self.assertRaises(GoogleRefused) as refusal:
                resolve_google_user(claims())
        self.assertEqual(refusal.exception.code, 'ambiguous_account')


@override_settings(GOOGLE_CLIENT_ID='test-client-id.apps.googleusercontent.com')
class OneGoogleAccountOneAccountHereTests(TestCase):
    def test_the_same_google_id_cannot_be_linked_twice(self):
        from django.db import IntegrityError, transaction

        first = User.objects.create_user('a', email='a@example.com', password=VALID_PW)
        second = User.objects.create_user('b', email='b@example.com', password=VALID_PW)
        SocialAccount.objects.create(provider=SocialAccount.GOOGLE, uid='1', user=first)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SocialAccount.objects.create(
                    provider=SocialAccount.GOOGLE, uid='1', user=second,
                )

    def test_one_account_here_has_at_most_one_google_account(self):
        from django.db import IntegrityError, transaction

        user = User.objects.create_user('a', email='a@example.com', password=VALID_PW)
        SocialAccount.objects.create(provider=SocialAccount.GOOGLE, uid='1', user=user)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SocialAccount.objects.create(
                    provider=SocialAccount.GOOGLE, uid='2', user=user,
                )
