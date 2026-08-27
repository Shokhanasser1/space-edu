"""Query-count budgets.

Finding (22 Aug 2026 audit): N+1 was systemic rather than incidental —
`SphereListSerializer` ran two queries per sphere, `ConversationSerializer` ran
three per conversation, `SpheresListView` called `.count()` after
`prefetch_related` (which ignores the prefetch), and `FullProfileView` came to
roughly forty queries for one page.

These tests pin a budget that does not grow with the number of rows. The exact
number matters less than the shape: doubling the data must not double the
queries.
"""
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.chat.models import Conversation, DirectMessage
from apps.courses.models import Problem, Sphere, Topic, TopicLesson


def make_spheres(count=6, topics_each=4, lessons_each=3):
    for s in range(count):
        sphere = Sphere.objects.create(
            slug=f'sphere-{s}', title=f'Soha {s}', title_en=f'Sphere {s}', order=s
        )
        for t in range(topics_each):
            topic = Topic.objects.create(sphere=sphere, title=f'Mavzu {t}', order=t)
            for l in range(lessons_each):
                TopicLesson.objects.create(topic=topic, name=f'Dars {l}', order=l)
        for n in range(2):
            Problem.objects.create(
                sphere=sphere, number=n + 1, question=f'Savol {n}', answer='42'
            )


class SphereListQueryBudgetTests(TestCase):
    """The list serializer exposed topic_count and problem_count as
    `source='topics.count'`, which is one query per sphere per field."""

    def test_sphere_list_does_not_grow_with_the_number_of_spheres(self):
        client = APIClient()

        make_spheres(count=2)
        with self.assertNumQueries(0):
            pass
        small = self._count_queries(client, '/api/v1/courses/spheres/')

        Sphere.objects.all().delete()
        make_spheres(count=12)
        large = self._count_queries(client, '/api/v1/courses/spheres/')

        self.assertEqual(
            small, large,
            f'{small} queries for 2 spheres but {large} for 12 — the count is per row',
        )

    def _count_queries(self, client, url):
        from django.core.cache import cache
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        # Without REDIS_URL the cache is a database table, so the throttle's own
        # bookkeeping shows up in this count — and whether it INSERTs or UPDATEs
        # depends on what earlier tests left behind. Start both measurements
        # from the same place, or this test reports on the cache rather than on
        # the serializer it is about.
        cache.clear()

        with CaptureQueriesContext(connection) as ctx:
            response = client.get(url)
            self.assertEqual(response.status_code, 200)
        return len(ctx)


@override_settings(DM_ENABLED=True)
class ConversationListQueryBudgetTests(TestCase):
    """ConversationSerializer resolved other_user, last_message and unread_count
    with a separate query each, so a list of N conversations cost 3N + 1."""

    def setUp(self):
        self.me = User.objects.create_user(username='me', email='me@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.me)

    def _make(self, n):
        start = User.objects.count()
        for i in range(start, start + n):
            other = User.objects.create_user(
                username=f'peer{i}', email=f'p{i}@e.com', password='x'
            )
            convo = Conversation.objects.create(
                initiator=other, status=Conversation.ACCEPTED,
            )
            convo.participants.add(self.me, other)
            DirectMessage.objects.create(
                conversation=convo, sender=other, content=f'Salom {i}'
            )

    def _count(self):
        from django.core.cache import cache
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        cache.clear()  # see the note in SphereListQueryBudgetTests._count_queries

        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get('/api/v1/chat/dm/conversations/')
            self.assertEqual(r.status_code, 200)
        return len(ctx)

    def test_conversation_list_does_not_grow_per_conversation(self):
        self._make(2)
        small = self._count()

        self._make(10)
        large = self._count()

        self.assertLessEqual(
            large - small, 2,
            f'{small} queries for 2 conversations, {large} for 12 — '
            'each row is fetching its own peer, last message and unread count',
        )


class IndexTests(TestCase):
    """Fields we filter and order by on every request need an index."""

    def test_news_and_event_hot_fields_are_indexed(self):
        from apps.events.models import SpaceEvent
        from apps.news.models import NewsArticle

        expected = {
            NewsArticle: ('published_at', 'category', 'is_published'),
            SpaceEvent: ('event_date', 'event_type', 'is_featured'),
        }
        for model, fields in expected.items():
            indexed = {f.name for f in model._meta.fields if f.db_index}
            for index in model._meta.indexes:
                indexed.update(f.lstrip('-') for f in index.fields)
            for field in fields:
                self.assertIn(
                    field, indexed,
                    f'{model.__name__}.{field} is filtered or ordered on every '
                    f'list request but has no index',
                )


class LeaderboardScaleTests(TestCase):
    """The board is the one public page whose cost grows with the number of
    accounts, and it is the page a class of children all open at once.

    Three things decide what it costs at ten thousand users: whether the rows
    are fetched in one query or one per row, whether the database can find the
    top of the board without sorting the whole table, and whether every caller
    pays for that at all.
    """

    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.client = APIClient()

    def _players(self, count):
        from apps.gamification.models import UserGamificationProfile

        start = User.objects.count()
        users = [
            User(username=f'cadet{i}', email=f'c{i}@e.com', astronaut_name=f'Cadet {i}')
            for i in range(start, start + count)
        ]
        User.objects.bulk_create(users)
        UserGamificationProfile.objects.bulk_create([
            UserGamificationProfile(user=user, xp=(user.id * 37) % 5000 + 1, level=2)
            for user in User.objects.filter(username__startswith='cadet')
            if not UserGamificationProfile.objects.filter(user=user).exists()
        ])

    def _count(self):
        from django.core.cache import cache
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        cache.clear()  # see the note in SphereListQueryBudgetTests._count_queries
        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get('/api/v1/gamification/leaderboard/')
            self.assertEqual(r.status_code, 200)
        return [q['sql'] for q in ctx.captured_queries]

    def test_the_board_costs_the_same_at_twenty_players_and_at_two_hundred(self):
        self._players(20)
        small = self._count()

        self._players(180)
        large = self._count()

        self.assertEqual(
            len(small), len(large),
            f'{len(small)} queries for 20 players but {len(large)} for 200 — '
            'something in the row is fetching its own user',
        )

    def test_a_second_caller_within_the_window_does_not_rebuild_the_board(self):
        """Ten thousand clients polling must not be ten thousand sorts. The
        board is built once per cache window and served from there."""
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self._players(30)
        self._count()  # first call fills the cache

        with CaptureQueriesContext(connection) as ctx:
            r = self.client.get('/api/v1/gamification/leaderboard/')
            self.assertEqual(r.status_code, 200)

        board_queries = [
            q['sql'] for q in ctx.captured_queries
            if 'gamification_usergamificationprofile' in q['sql']
        ]
        self.assertEqual(
            board_queries, [],
            'the second caller within the cache window rebuilt the whole board',
        )

    def test_the_column_the_board_orders_by_is_indexed(self):
        """`ORDER BY xp DESC LIMIT 100` and `COUNT(*) WHERE xp > n` are both run
        on every uncached request. Without an index each is a scan of every
        account on the platform."""
        from apps.gamification.models import UserGamificationProfile

        indexed = {f.name for f in UserGamificationProfile._meta.fields if f.db_index}
        for index in UserGamificationProfile._meta.indexes:
            indexed.update(f.lstrip('-') for f in index.fields)

        self.assertIn('xp', indexed, 'the leaderboard orders and counts on xp')
