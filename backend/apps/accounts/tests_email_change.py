"""Moving an account to another address.

The address is the account's identity now -- it is unique, a password reset goes
to it, and a Google account links by it. So moving it is the most dangerous
ordinary thing a person can do here, and the two ways it goes wrong are a typo
that locks somebody out of their own account, and somebody else at an unattended
keyboard moving it on purpose.
"""
from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from .models import User

VALID_PW = 'Str0ngPassw0rd!x'


def _code_sent_to(address):
    """The code from the message addressed to `address`.

    Not "the last message": a change of address sends two, and the last one out
    is the notice to the address being left, which deliberately carries no code.
    """
    message = next(m for m in reversed(mail.outbox) if m.to == [address])
    return next(w for w in message.body.split() if w.isdigit() and len(w) == 6)


class EmailChangeRequestTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []
        self.user = User.objects.create_user('pilot', email='pilot@example.com', password=VALID_PW)
        self.client.force_authenticate(user=self.user)

    def _ask(self, **over):
        payload = {'new_email': 'new@example.com', 'current_password': VALID_PW}
        payload.update(over)
        return self.client.post('/api/v1/auth/email/change/request/', payload, format='json')

    def test_the_address_does_not_move_yet(self):
        """A typo written straight into `email` locks a child out of their own
        account with nothing left to prove which address was really theirs."""
        r = self._ask()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'pilot@example.com')
        self.assertEqual(self.user.pending_email, 'new@example.com')

    def test_the_code_goes_to_the_new_address(self):
        """That is what proves whoever asked can read mail sent there."""
        self._ask()
        codes = [m for m in mail.outbox if m.to == ['new@example.com']]
        self.assertEqual(len(codes), 1)

    def test_the_old_address_is_told_and_gets_no_code(self):
        """Somebody at an unattended school computer changing the address is how
        an account is taken quietly. This is the message that reaches the person
        it belongs to while they can still do something, and there is nothing in
        it to click or to type in anywhere."""
        self._ask()
        notices = [m for m in mail.outbox if m.to == ['pilot@example.com']]
        self.assertEqual(len(notices), 1)
        self.assertFalse(
            [w for w in notices[0].body.split() if w.isdigit() and len(w) == 6],
            'the notice to the old address must not carry a code',
        )

    def test_the_wrong_current_password_is_refused(self):
        r = self._ask(current_password='not-it')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.pending_email, '')
        self.assertEqual(mail.outbox, [])

    def test_an_address_somebody_else_holds_is_refused(self):
        User.objects.create_user('other', email='taken@example.com', password=VALID_PW)
        r = self._ask(new_email='TAKEN@example.com')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('new_email', r.data)

    def test_the_address_it_already_has_is_refused(self):
        r = self._ask(new_email='PILOT@example.com')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_stranger_cannot_start_one(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self._ask().status_code, status.HTTP_401_UNAUTHORIZED)


class EmailChangeConfirmTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()
        mail.outbox = []
        self.user = User.objects.create_user('pilot', email='pilot@example.com', password=VALID_PW)
        self.client.force_authenticate(user=self.user)
        self.client.post(
            '/api/v1/auth/email/change/request/',
            {'new_email': 'new@example.com', 'current_password': VALID_PW}, format='json',
        )
        self.code = _code_sent_to('new@example.com')

    def _confirm(self, code=None):
        return self.client.post(
            '/api/v1/auth/email/change/confirm/', {'code': code or self.code}, format='json',
        )

    def test_it_moves_the_address_and_marks_it_proved(self):
        r = self._confirm()
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new@example.com')
        self.assertEqual(self.user.pending_email, '')
        self.assertIsNotNone(self.user.email_verified_at)

    def test_a_wrong_code_moves_nothing(self):
        r = self._confirm('000000')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'pilot@example.com')
        self.assertEqual(self.user.pending_email, 'new@example.com')

    def test_confirming_without_having_asked_is_refused(self):
        self.user.pending_email = ''
        self.user.save(update_fields=['pending_email'])
        self.assertEqual(self._confirm().status_code, status.HTTP_400_BAD_REQUEST)

    def test_an_address_taken_while_the_code_was_in_the_post(self):
        """Half an hour passes between the two halves of this. Without the
        second check the unique constraint refuses the save, which is a 500 with
        a debug page rather than an explanation."""
        User.objects.create_user('faster', email='new@example.com', password=VALID_PW)
        r = self._confirm()
        self.assertEqual(r.status_code, status.HTTP_409_CONFLICT)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'pilot@example.com')
        self.assertEqual(self.user.pending_email, '')

    def test_every_other_session_ends(self):
        elsewhere = APIClient().post(
            '/api/v1/auth/login/',
            {'email': 'pilot@example.com', 'password': VALID_PW}, format='json',
        ).data['refresh']

        self._confirm()

        r = self.client.post('/api/v1/auth/token/refresh/', {'refresh': elsewhere}, format='json')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_fresh_pair_comes_back(self):
        r = self._confirm()
        self.assertIn('access', r.data)
        self.assertEqual(r.data['user']['email'], 'new@example.com')

    def test_signing_in_with_the_new_address_works_afterwards(self):
        self._confirm()
        r = APIClient().post(
            '/api/v1/auth/login/',
            {'email': 'new@example.com', 'password': VALID_PW}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_changing_your_mind(self):
        r = self.client.post('/api/v1/auth/email/change/cancel/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertEqual(self.user.pending_email, '')
        self.assertEqual(self.user.email, 'pilot@example.com')

    def test_the_pending_address_is_visible_to_its_owner(self):
        """The profile screen has to be able to say "waiting on new@example.com"
        with a way to cancel, or somebody who mistyped it is stuck looking at an
        account that seems fine and never receives anything."""
        r = self.client.get('/api/v1/auth/me/')
        self.assertEqual(r.data['pending_email'], 'new@example.com')
