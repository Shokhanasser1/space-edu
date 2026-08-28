"""Regression tests for findings from the 2026-08-22 audit."""
import math

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.challenges.models import QuizSession

from .leaderboard import BOARD_SIZE, MIN_QUIZZES_RANKED
from .models import Mission, RewardProduct, UserGamificationProfile, UserRewardPurchase


class XpFaucetTests(TestCase):
    """Finding: POST /gamification/grant/ accepted any xp/fuel with no check that
    the user had done anything — one request produced level 101. The endpoint was
    client-authoritative by design, so it is removed rather than validated."""

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_client_cannot_grant_itself_xp(self):
        r = self.client.post(
            '/api/v1/gamification/grant/', {'xp': 1_000_000, 'fuel': 1000}, format='json'
        )
        self.assertIn(
            r.status_code,
            (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED,
             status.HTTP_403_FORBIDDEN, status.HTTP_410_GONE),
        )
        profile = UserGamificationProfile.objects.get(user=self.user)
        self.assertEqual(profile.xp, 0)
        self.assertEqual(profile.level, 1)


class MissionClaimTests(TestCase):
    """Finding: MissionClaimView never compared progress against
    mission.target_value, so 'Complete 5 lessons' paid out at zero lessons."""

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.mission = Mission.objects.create(
            slug='five-lessons',
            title_en='Complete 5 lessons',
            description_en='x',
            mission_type='lesson',
            target_value=5,
            reward_xp=500,
            reward_fuel=100,
        )

    def test_claiming_an_unearned_mission_is_rejected(self):
        r = self.client.post(
            '/api/v1/gamification/missions/claim/', {'mission_id': self.mission.id}, format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        profile = UserGamificationProfile.objects.get(user=self.user)
        self.assertEqual(profile.xp, 0)
        self.assertEqual(profile.fuel, 100)  # starting balance, unchanged

    def test_claiming_an_earned_mission_pays_out_once(self):
        from apps.courses.models import Sphere, Topic, TopicLesson
        from apps.progress.models import UserLessonProgress

        sphere = Sphere.objects.create(slug='physics', title='Fizika', title_en='Physics')
        topic = Topic.objects.create(sphere=sphere, slug='physics-kinematics', title='Kinematika')
        for i in range(5):
            lesson = TopicLesson.objects.create(
                topic=topic, slug=f'physics-kinematics-l{i}', order=i, name=f'L{i}',
            )
            UserLessonProgress.objects.create(user=self.user, lesson=lesson, score=100)

        first = self.client.post(
            '/api/v1/gamification/missions/claim/', {'mission_id': self.mission.id}, format='json'
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        second = self.client.post(
            '/api/v1/gamification/missions/claim/', {'mission_id': self.mission.id}, format='json'
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)


class ProfileArithmeticTests(TestCase):
    """Findings: add_xp/add_fuel/spend_fuel were read-modify-write on a loaded
    instance, so concurrent writes lost updates; and several call sites wrote
    profile.xp directly, skipping the level recompute."""

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.profile = UserGamificationProfile.objects.get(user=self.user)

    def test_add_xp_recomputes_the_level(self):
        self.profile.add_xp(450)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.level, math.floor(math.sqrt(450 / 100)) + 1)

    def test_add_xp_is_atomic_against_a_stale_copy(self):
        stale = UserGamificationProfile.objects.get(pk=self.profile.pk)
        self.profile.add_xp(100)
        stale.add_xp(100)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.xp, 200, 'a stale in-memory copy overwrote a concurrent add')

    def test_spend_fuel_refuses_to_go_negative(self):
        self.profile.fuel = 30
        self.profile.save(update_fields=['fuel'])
        self.assertFalse(self.profile.spend_fuel(50))
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 30)

    def test_add_fuel_respects_the_cap(self):
        self.profile.add_fuel(5000)
        self.profile.refresh_from_db()
        self.assertLessEqual(self.profile.fuel, 1000)


class RewardPurchaseTests(TestCase):
    """Finding: the balance check and the debit were not serialised, so two
    concurrent purchases of different products both passed the check."""

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        profile = UserGamificationProfile.objects.get(user=self.user)
        profile.fuel = 100
        profile.save(update_fields=['fuel'])
        self.cheap = RewardProduct.objects.create(
            slug='a', title_en='A', description_en='d', cost=80
        )
        self.other = RewardProduct.objects.create(
            slug='b', title_en='B', description_en='d', cost=80
        )

    def test_cannot_buy_beyond_the_balance(self):
        first = self.client.post('/api/v1/gamification/rewards/buy/', {'slug': 'a'}, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post('/api/v1/gamification/rewards/buy/', {'slug': 'b'}, format='json')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(UserRewardPurchase.objects.filter(user=self.user).count(), 1)
        profile = UserGamificationProfile.objects.get(user=self.user)
        self.assertEqual(profile.fuel, 20)

    def test_buying_the_same_reward_twice_is_rejected(self):
        self.client.post('/api/v1/gamification/rewards/buy/', {'slug': 'a'}, format='json')
        again = self.client.post('/api/v1/gamification/rewards/buy/', {'slug': 'a'}, format='json')
        self.assertEqual(again.status_code, status.HTTP_400_BAD_REQUEST)


class LeaderboardPrivacyTests(TestCase):
    """Finding: the public leaderboard exposed first_name, last_name and the
    R2 avatar URL of children, plus a username derived from the email local part."""

    def setUp(self):
        user = User.objects.create_user(
            username='aziz.karimov',
            email='aziz.karimov@example.com',
            password='x',
            first_name='Aziz',
            last_name='Karimov',
        )
        UserGamificationProfile.objects.filter(user=user).update(xp=500)

    def test_anonymous_leaderboard_does_not_expose_real_names(self):
        cache.clear()  # the board is cached across callers
        r = APIClient().get('/api/v1/gamification/leaderboard/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        body = str(r.data)
        self.assertNotIn('Aziz', body)
        self.assertNotIn('Karimov', body)

    def test_a_row_carries_these_fields_and_no_others(self):
        """Pinned as an exact set, not a subset. The board and the browser have
        already drifted apart once (commit cbc4c6e), and the way a real name
        comes back is somebody adding one more convenient field."""
        cache.clear()
        r = APIClient().get('/api/v1/gamification/leaderboard/')
        for row in r.data['leaderboard']:
            self.assertEqual(set(row), {'rank', 'display_name', 'xp', 'level', 'is_you'})


class DailyStreakClaimTests(TestCase):
    """Findings from the second pass, 22 Aug 2026.

    `StreakUpdateView` read `last_play_date`, decided, and only then wrote, with
    nothing holding the row in between — so it was the one award path the first
    audit's row-lock sweep missed. It also used `date.today()`, which on a UTC
    server is not the date in Asia/Tashkent.
    """

    def setUp(self):
        self.user = User.objects.create_user(username='streaker', email='s@e.com', password='x')
        self.profile = UserGamificationProfile.objects.get(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_claiming_pays_the_bonus_and_starts_the_streak(self):
        r = self.client.post('/api/v1/gamification/streak/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['streak'], 1)
        self.assertEqual(r.data['fuel_bonus'], 10)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 110)

    def test_claiming_twice_in_a_day_pays_once(self):
        self.client.post('/api/v1/gamification/streak/')
        second = self.client.post('/api/v1/gamification/streak/')
        self.assertEqual(second.data['fuel_bonus'], 0)
        self.assertFalse(second.data['updated'])
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 110)

    def test_the_bonus_is_atomic_against_a_stale_copy(self):
        """Two requests that both read the row before either wrote used to pay
        the bonus twice and lose one of the two streak increments."""
        stale = UserGamificationProfile.objects.get(pk=self.profile.pk)

        self.profile.claim_daily_streak()
        streak, awarded = stale.claim_daily_streak()

        self.assertEqual(awarded, 0)
        self.assertEqual(streak, 1)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 110)
        self.assertEqual(self.profile.streak, 1)

    def test_a_consecutive_day_extends_the_streak(self):
        yesterday = timezone.localdate() - timezone.timedelta(days=1)
        self.profile.claim_daily_streak(today=yesterday)
        streak, awarded = self.profile.claim_daily_streak()
        self.assertEqual(streak, 2)
        self.assertEqual(awarded, 10)

    def test_a_missed_day_resets_the_streak(self):
        long_ago = timezone.localdate() - timezone.timedelta(days=5)
        self.profile.claim_daily_streak(today=long_ago)
        streak, _ = self.profile.claim_daily_streak()
        self.assertEqual(streak, 1)

    def test_the_bonus_respects_the_fuel_cap(self):
        UserGamificationProfile.objects.filter(pk=self.profile.pk).update(
            fuel=UserGamificationProfile.FUEL_CAP,
        )
        self.profile.refresh_from_db()
        self.profile.claim_daily_streak()
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, UserGamificationProfile.FUEL_CAP)

    def test_the_day_is_the_users_day_not_the_servers(self):
        """The site runs on Asia/Tashkent and the server on UTC, so between
        local midnight and 05:00 `date.today()` still says yesterday."""
        import datetime
        import inspect

        from apps.gamification import models as gamification_models

        source = inspect.getsource(gamification_models.UserGamificationProfile.claim_daily_streak)
        self.assertIn('timezone.localdate()', source)
        self.assertNotIn('date.today()', source.split('"""')[-1])

        # And the two really do differ for a Tashkent evening.
        tashkent_evening = datetime.datetime(2026, 8, 22, 23, 30, tzinfo=datetime.timezone.utc)
        with self.settings(TIME_ZONE='Asia/Tashkent'):
            self.assertNotEqual(
                timezone.localdate(tashkent_evening), tashkent_evening.date(),
            )


class LeaderboardAccuracyTests(TestCase):
    """What the board ranks, and whether it says the same thing as the profile.

    The board sorted by XP and let the browser count the rows, so the number a
    child saw next to their name was a position in an array, not a rank. Two of
    the three problems that follows from that are visible without any data at
    all:

      - tied players were given different places, silently and in whatever
        order the database happened to return them, while `my_rank` — and the
        rank on the profile page, computed the same way — said they were level;
      - every account has a gamification row from the moment it is created, so
        `total_players` was the number of registrations, and a child who had
        never earned a point was ranked among them.

    The third needs a full board: past place 100 the browser appended a row
    built from its own locally-stored XP and sorted it in, so a player ranked
    four thousandth was shown sitting just under the last visible name.
    """

    def setUp(self):
        cache.clear()  # the board is cached; see apps/gamification/leaderboard.py

    def _player(self, name, xp):
        user = User.objects.create_user(
            username=name, email=f'{name}@e.com', password='x', astronaut_name=name,
        )
        UserGamificationProfile.objects.filter(user=user).update(
            xp=xp, level=UserGamificationProfile.level_for_xp(xp),
        )
        # Creating the profile caches it on the User instance, so `user.gamification`
        # here would still read the XP it was created with. A request loads its own
        # user; so does this.
        return User.objects.get(pk=user.pk)

    def _board(self, user=None):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        response = client.get('/api/v1/gamification/leaderboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_tied_players_share_one_place(self):
        for name in ('ayaz', 'bek', 'dilnoza'):
            self._player(name, 500)

        rows = self._board()['leaderboard']
        self.assertEqual([row['rank'] for row in rows], [1, 1, 1])

    def test_a_tied_players_place_is_the_one_their_profile_shows(self):
        """A board that disagrees with the child's own profile page is worse
        than no board. Both numbers now come from the same helper."""
        users = [self._player(name, 500) for name in ('ayaz', 'bek', 'dilnoza')]
        self._player('chempion', 900)

        for user in users:
            board = self._board(user)
            profile = APIClient()
            profile.force_authenticate(user)
            full = profile.get('/api/v1/gamification/profile/full/')
            self.assertEqual(full.status_code, status.HTTP_200_OK)

            self.assertEqual(board['my_rank'], 2, f'{user.username} on the board')
            self.assertEqual(full.data['leaderboard']['rank'], board['my_rank'])
            self.assertEqual(full.data['leaderboard']['total_players'], board['total_players'])

            # And the place printed beside their name is that same number. It
            # used to be the row's position in the array, so of three tied
            # players one was shown second and one third while every profile
            # page said second.
            mine = [row for row in board['leaderboard'] if row['is_you']]
            self.assertEqual([row['rank'] for row in mine], [board['my_rank']])

    def test_an_account_that_never_played_is_not_a_player(self):
        self._player('ayaz', 500)
        self._player('bek', 300)
        lurker = self._player('kuzatuvchi', 0)

        board = self._board(lurker)
        self.assertEqual(board['total_players'], 2, 'registrations are not players')
        self.assertEqual(
            [row['display_name'] for row in board['leaderboard']], ['ayaz', 'bek'],
        )
        self.assertIsNone(board['my_rank'], 'nobody is ranked for having signed up')

    def test_your_own_place_is_yours_even_when_you_are_off_the_board(self):
        for i in range(105):
            self._player(f'player{i:03d}', 10_000 - i)
        last = User.objects.get(username='player104')

        board = self._board(last)
        self.assertEqual(len(board['leaderboard']), 100)
        self.assertEqual(board['my_rank'], 105)
        self.assertEqual(board['my_xp'], 10_000 - 104)
        self.assertNotIn('player104', [row['display_name'] for row in board['leaderboard']])

    def test_the_board_marks_your_row_and_not_your_namesake(self):
        """Two children may choose the same astronaut name, and the row carries
        nothing else to tell them apart — so the browser cannot work out which
        one is you and used to highlight both."""
        first = self._player('nebula', 500)
        second = User.objects.create_user(
            username='nebula2', email='n2@e.com', password='x', astronaut_name='nebula',
        )
        UserGamificationProfile.objects.filter(user=second).update(xp=400, level=3)
        second = User.objects.get(pk=second.pk)

        board = self._board(first)['leaderboard']
        self.assertEqual([row['is_you'] for row in board], [True, False])

        cache.clear()
        board = self._board(second)['leaderboard']
        self.assertEqual([row['is_you'] for row in board], [False, True])

    def test_a_cached_board_does_not_hand_you_someone_elses_highlight(self):
        """The rows are cached and shared by every caller; `is_you` is not."""
        first = self._player('ayaz', 500)
        second = self._player('bek', 400)

        self._board(first)                       # fills the cache
        board = self._board(second)['leaderboard']  # served from it
        self.assertEqual([row['is_you'] for row in board], [False, True])

    def test_a_caller_with_no_gamification_row_gets_an_answer_not_a_swallowed_error(self):
        """The view wrapped the whole block in `except Exception: pass`, which
        is banned (C-10) and left the caller unable to tell "unranked" from
        "the server broke"."""
        self._player('bek', 500)
        user = self._player('ayaz', 400)
        UserGamificationProfile.objects.filter(user=user).delete()

        board = self._board(user)
        self.assertEqual([row['display_name'] for row in board['leaderboard']], ['bek'])
        self.assertIn('my_rank', board)
        self.assertIsNone(board['my_rank'])

    def test_the_board_tells_the_client_how_often_it_is_worth_asking_again(self):
        """The poll interval is the server's decision, not the browser's: it is
        what the cache lifetime is, and it is what 10 000 clients cost."""
        board = self._board()
        self.assertGreaterEqual(board['poll_after_seconds'], 1)


class StaleStreakTests(TestCase):
    """A streak that cannot be broken is not a streak.

    `claim_daily_streak()` is correct and row-locked on the day a child plays,
    but it is the only thing that ever writes the column — so nothing lowers it
    on the days they do not. A child who held seven days and then stopped was
    still told "7" on the fourth day of having played nothing, because the
    stored number is only ever read back out.

    `UserStreak.live_streak` in the challenges app already answers this for the
    daily-challenge streak. The same read on the gamification profile was left
    behind, and the profile page falls back to it — so the fixed half was being
    overwritten on screen by the half that was not.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username='gulnora', email='g@e.com', password='x',
        )
        self.profile = UserGamificationProfile.objects.get(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _played(self, days_ago, streak=7):
        """Put the row where a child who stopped playing `days_ago` leaves it."""
        UserGamificationProfile.objects.filter(pk=self.profile.pk).update(
            streak=streak,
            last_play_date=timezone.localdate() - timezone.timedelta(days=days_ago),
        )
        self.profile.refresh_from_db()

    def _served_streak(self):
        response = self.client.get('/api/v1/gamification/profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['streak']

    def test_a_streak_with_a_gap_reads_as_broken(self):
        """The bug, exactly: last played four days ago, still told seven."""
        self._played(days_ago=4)
        self.assertEqual(self._served_streak(), 0)

    def test_playing_today_keeps_the_streak(self):
        self._played(days_ago=0)
        self.assertEqual(self._served_streak(), 7)

    def test_yesterday_still_counts_because_today_is_not_over(self):
        """They can still keep it by playing before midnight."""
        self._played(days_ago=1)
        self.assertEqual(self._served_streak(), 7)

    def test_the_day_after_that_is_a_missed_day(self):
        self._played(days_ago=2)
        self.assertEqual(self._served_streak(), 0)

    def test_a_child_who_has_never_played_has_no_streak(self):
        UserGamificationProfile.objects.filter(pk=self.profile.pk).update(
            streak=3, last_play_date=None,
        )
        self.assertEqual(self._served_streak(), 0)

    def test_the_full_profile_says_the_same_number(self):
        """Two endpoints serving one column must not disagree about it."""
        self._played(days_ago=4)
        response = self.client.get('/api/v1/gamification/profile/full/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['gamification']['streak'], 0)
        self.assertEqual(response.data['daily_challenges']['current_streak'], 0)

    def test_the_column_still_holds_what_the_run_reached(self):
        """The stored value is history — `claim_daily_streak` reads it to decide
        whether today continues yesterday. Only the *answer* changes."""
        self._played(days_ago=4)
        self._served_streak()
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.streak, 7)

    def test_a_broken_run_starts_again_at_one_when_they_come_back(self):
        self._played(days_ago=4)
        streak, _ = self.profile.claim_daily_streak()
        self.assertEqual(streak, 1)
        self.assertEqual(self._served_streak(), 1)

    def test_a_streak_badge_is_not_awarded_on_a_streak_that_is_over(self):
        """A badge is permanent. Awarding one off a column nothing lowers means
        a child keeps "7-day streak" for a run that ended five days ago."""
        from .models import Badge
        from .services import check_and_award_badges

        Badge.objects.create(
            slug='streak-7', title_en='Orbit Master', description_en='7-day streak',
            icon='UZ', condition_type='streak', condition_value=7,
        )
        self._played(days_ago=5)
        awarded = check_and_award_badges(self.user, self.profile, lesson_count=0)
        self.assertEqual(awarded, [])

        self._played(days_ago=0)
        self.assertEqual(
            check_and_award_badges(self.user, self.profile, lesson_count=0),
            ['streak-7'],
        )

    def test_a_streak_mission_is_not_paid_out_on_a_streak_that_is_over(self):
        """The same lie, but it costs XP: the reward for a three-day run was
        claimable four days after the run ended."""
        mission = Mission.objects.create(
            slug='three-days', title_en='Three days running', description_en='x',
            mission_type='streak', target_value=3, reward_xp=300, reward_fuel=50,
        )
        self._played(days_ago=4)
        response = self.client.post(
            '/api/v1/gamification/missions/claim/',
            {'mission_id': mission.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['progress'], 0)


class QuizLeaderboardTests(TestCase):
    """One lucky quiz used to beat fifty near-perfect ones.

    The board ranked on `Avg('percentage')` with nothing under it, so a child
    who took one quiz and happened to score 100% sat above a child who had
    taken fifty and averaged 96. It also printed no place at all, ordered ties
    arbitrarily and cut at a size of its own — all three of which the XP board
    settled in `leaderboard.py`. Two boards on one platform answering the same
    question by different rules is the finding that file was written for.
    """

    def setUp(self):
        self.client = APIClient()

    def _player(self, name, *, attempts, pct, category='physics'):
        user = User.objects.create_user(
            username=name, email=f'{name}@e.com', password='x', astronaut_name=name,
        )
        for _ in range(attempts):
            QuizSession.objects.create(
                user=user, category=category, score=1, total=1,
                percentage=pct, is_completed=True,
            )
        return user

    def _board(self, user=None, **params):
        client = APIClient()
        if user is not None:
            client.force_authenticate(user)
        response = client.get('/api/v1/gamification/leaderboard/quiz/', params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def test_one_lucky_attempt_does_not_outrank_fifty_near_perfect_ones(self):
        self._player('omadli', attempts=1, pct=100.0)
        self._player('mehnatkash', attempts=50, pct=96.0)

        names = [row['display_name'] for row in self._board()['leaderboard']]
        self.assertEqual(names[0], 'mehnatkash')
        self.assertNotIn('omadli', names)

    def test_a_child_below_the_floor_is_not_on_the_board_at_all(self):
        self._player('boshlovchi', attempts=MIN_QUIZZES_RANKED - 1, pct=100.0)
        board = self._board()
        self.assertEqual(board['leaderboard'], [])
        self.assertEqual(board['total_players'], 0)

    def test_the_floor_is_published_so_the_page_can_say_what_it_is(self):
        """A child who is not on the board is owed the reason, in a number."""
        board = self._board()
        self.assertEqual(board['min_quizzes'], MIN_QUIZZES_RANKED)

    def test_reaching_the_floor_puts_you_on_the_board(self):
        self._player('yetdi', attempts=MIN_QUIZZES_RANKED, pct=80.0)
        board = self._board()
        self.assertEqual([r['display_name'] for r in board['leaderboard']], ['yetdi'])
        self.assertEqual(board['total_players'], 1)

    def test_tied_players_share_one_place(self):
        """1-1-1-4, the same rule `rank_for_xp` uses — see leaderboard.py."""
        for name in ('ayaz', 'bek', 'dilnoza'):
            self._player(name, attempts=MIN_QUIZZES_RANKED, pct=90.0)
        self._player('quyi', attempts=MIN_QUIZZES_RANKED, pct=50.0)

        rows = self._board()['leaderboard']
        self.assertEqual([row['rank'] for row in rows], [1, 1, 1, 4])

    def test_the_board_marks_your_own_row(self):
        me = self._player('men', attempts=MIN_QUIZZES_RANKED, pct=70.0)
        self._player('boshqa', attempts=MIN_QUIZZES_RANKED, pct=90.0)
        rows = self._board(me)['leaderboard']
        self.assertEqual([row['is_you'] for row in rows], [False, True])

    def test_the_board_is_no_longer_than_the_xp_board(self):
        self.assertEqual(len(self._board()['leaderboard']), 0)
        self.assertEqual(self._board()['board_size'], BOARD_SIZE)

    def test_the_floor_is_counted_within_the_category_being_asked_about(self):
        """Filtering by category and then ranking on an average built from
        every category would rank a physics board on astronomy attempts."""
        user = self._player('aralash', attempts=MIN_QUIZZES_RANKED, pct=100.0,
                            category='astronomy')
        QuizSession.objects.create(
            user=user, category='physics', score=1, total=1,
            percentage=100.0, is_completed=True,
        )
        self.assertEqual(self._board(category='physics')['leaderboard'], [])
        self.assertEqual(
            [r['display_name'] for r in self._board(category='astronomy')['leaderboard']],
            ['aralash'],
        )

    def test_an_unfinished_quiz_does_not_count_towards_the_floor(self):
        user = self._player('tugatmagan', attempts=MIN_QUIZZES_RANKED - 1, pct=100.0)
        QuizSession.objects.create(
            user=user, category='physics', score=0, total=1,
            percentage=0.0, is_completed=False,
        )
        self.assertEqual(self._board()['leaderboard'], [])
