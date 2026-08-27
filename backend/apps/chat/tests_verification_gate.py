"""An address nobody has proved cannot be used to write to another child.

Confirming an address is what puts something real behind whoever wrote a
message. Without it an account is thirty seconds of typing under any name, which
is the one thing moderation cannot work around: a moderator can delete what was
said and suspend who said it, and both are worth nothing against somebody who
makes another account.

Reading stays open, and so do reporting and blocking. A child must always be
able to report or block, and putting the safety controls behind an e-mail they
may not be able to reach today is the wrong trade in the wrong direction.

The check is on the server. A composer that hides itself is a courtesy; this is
the part that decides.
"""
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import ChatRoom, MessageReport

VALID_PW = 'Str0ngPassw0rd!x'


class RoomWritingTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.room = ChatRoom.objects.create(slug='general', name='General', is_global=True)
        self.unproved = User.objects.create_user(
            'unproved', email='unproved@example.com', password=VALID_PW,
        )
        self.proved = User.objects.create_user(
            'proved', email='proved@example.com', password=VALID_PW,
            email_verified_at=timezone.now(),
        )

    def _post(self, user, content='hello there'):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f'/api/v1/chat/rooms/{self.room.slug}/messages/', {'content': content}, format='json',
        )

    def test_an_unproved_address_cannot_write(self):
        r = self._post(self.unproved)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data.get('code'), 'email_unverified')

    def test_a_proved_one_can(self):
        r = self._post(self.proved)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_confirming_it_is_enough_to_start_writing(self):
        self.assertEqual(self._post(self.unproved).status_code, status.HTTP_403_FORBIDDEN)

        self.unproved.email_verified_at = timezone.now()
        self.unproved.save(update_fields=['email_verified_at'])

        self.assertEqual(self._post(self.unproved).status_code, status.HTTP_201_CREATED)

    def test_reading_is_not_gated(self):
        """A child who cannot write yet is still allowed to be in the room. The
        alternative is an empty screen with no explanation of why."""
        self.client.force_authenticate(user=self.unproved)
        r = self.client.get(f'/api/v1/chat/rooms/{self.room.slug}/messages/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_the_settings_endpoint_says_so_before_the_composer_tries(self):
        """So the client can explain the refusal instead of just showing one."""
        self.client.force_authenticate(user=self.unproved)
        r = self.client.get('/api/v1/chat/settings/')
        self.assertFalse(r.data['email_verified'])
        self.assertFalse(r.data['can_post'])

        self.client.force_authenticate(user=self.proved)
        r = self.client.get('/api/v1/chat/settings/')
        self.assertTrue(r.data['email_verified'])
        self.assertTrue(r.data['can_post'])


class SafetyControlsStayOpenTests(TestCase):
    """Reporting and blocking are not privileges."""

    def setUp(self):
        self.client = APIClient()
        self.room = ChatRoom.objects.create(slug='general', name='General', is_global=True)
        self.unproved = User.objects.create_user(
            'unproved', email='unproved@example.com', password=VALID_PW,
        )
        self.other = User.objects.create_user(
            'other', email='other@example.com', password=VALID_PW,
            email_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.other)
        posted = self.client.post(
            f'/api/v1/chat/rooms/{self.room.slug}/messages/',
            {'content': 'something'}, format='json',
        )
        self.message_id = posted.data['id']
        self.client.force_authenticate(user=self.unproved)

    def test_an_unproved_address_can_still_report(self):
        r = self.client.post(
            '/api/v1/chat/reports/',
            {'message_type': 'room', 'message_id': self.message_id,
             'reason': MessageReport.REASONS[0][0]}, format='json',
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))

    def test_an_unproved_address_can_still_block(self):
        r = self.client.post(
            '/api/v1/chat/blocks/', {'user_id': self.other.id}, format='json',
        )
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))


@override_settings(DM_ENABLED=True)
class DirectMessageTests(TestCase):
    """Unreachable today -- DM_ENABLED is off -- and gated anyway. It has to be
    right on the day the flag is turned on, not the day after."""

    def setUp(self):
        self.client = APIClient()
        self.unproved = User.objects.create_user(
            'unproved', email='unproved@example.com', password=VALID_PW,
        )
        self.other = User.objects.create_user(
            'other', email='other@example.com', password=VALID_PW,
            email_verified_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.unproved)

    def test_an_unproved_address_cannot_open_a_conversation(self):
        r = self.client.post(
            '/api/v1/chat/dm/conversations/start/', {'user_id': self.other.id}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data.get('code'), 'email_unverified')

    def test_it_cannot_write_into_one_either(self):
        """Opened by the other person, so the conversation exists and only the
        writing is refused."""
        self.client.force_authenticate(user=self.other)
        started = self.client.post(
            '/api/v1/chat/dm/conversations/start/', {'user_id': self.unproved.id}, format='json',
        )
        convo_id = started.data['id']

        self.client.force_authenticate(user=self.unproved)
        r = self.client.post(
            f'/api/v1/chat/dm/conversations/{convo_id}/messages/',
            {'content': 'hello there'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data.get('code'), 'email_unverified')


class EveryWritingEndpointIsCoveredTests(TestCase):
    """A fourth way to write, added later without this check, would be a hole
    nobody notices until somebody uses it. This reads the views rather than
    trusting that whoever adds one remembers to come back here."""

    def test_the_set_of_places_a_person_can_write_has_not_grown(self):
        from apps.chat import views

        gated = set()
        for name in dir(views):
            view = getattr(views, name)
            source = getattr(view, '__module__', None)
            if source != 'apps.chat.views' or not hasattr(view, 'post'):
                continue
            import inspect
            try:
                body = inspect.getsource(view.post)
            except (OSError, TypeError):  # pragma: no cover
                continue
            if 'verification_refusal' in body:
                gated.add(name)

        self.assertEqual(
            gated,
            {'RoomMessagesView', 'ConversationStartView', 'ConversationMessagesView'},
            'a view that writes somebody else a message must call '
            'verification_refusal, and a view that does not write one must not '
            '— if this list changed, decide which and say so here',
        )
