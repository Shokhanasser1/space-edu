"""Regression tests for findings from the 2026-08-22 audit."""
from collections import Counter

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import ChallengeQuestion, DailyChallenge, QuizSession


def _question(i=0, category='physics', difficulty='easy', correct=1):
    return ChallengeQuestion.objects.create(
        category=category,
        difficulty=difficulty,
        question=f'Savol {i}',
        options=['a', 'b', 'c', 'd'],
        correct_answer=correct,
    )


class AnswerKeyExposureTests(TestCase):
    """Finding: ChallengeQuestionViewSet served ChallengeQuestionFullSerializer
    (which carries correct_answer) under AdminWriteOrReadOnly, so an anonymous
    GET returned the whole answer key."""

    def setUp(self):
        cache.clear()
        self.q = _question()
        self.anon = APIClient()

    def _payload_rows(self, response):
        data = response.data
        return data['results'] if isinstance(data, dict) and 'results' in data else data

    def test_anonymous_listing_hides_correct_answer(self):
        r = self.anon.get('/api/v1/challenges/questions/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for row in self._payload_rows(r):
            self.assertNotIn('correct_answer', row)

    def test_authenticated_non_staff_listing_hides_correct_answer(self):
        user = User.objects.create_user(username='pupil', email='p@e.com', password='x')
        c = APIClient()
        c.force_authenticate(user)
        r = c.get('/api/v1/challenges/questions/')
        for row in self._payload_rows(r):
            self.assertNotIn('correct_answer', row)

    def test_staff_listing_still_shows_correct_answer(self):
        staff = User.objects.create_user(
            username='teacher', email='t@e.com', password='x', is_staff=True
        )
        c = APIClient()
        c.force_authenticate(staff)
        r = c.get('/api/v1/challenges/questions/')
        rows = self._payload_rows(r)
        self.assertTrue(rows)
        self.assertIn('correct_answer', rows[0])

    def test_public_category_endpoint_hides_correct_answer(self):
        r = self.anon.get('/api/v1/challenges/quiz/physics/questions/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for row in r.data['questions']:
            self.assertNotIn('correct_answer', row)


class QuizScoringTests(TestCase):
    """Findings: QuizSubmitView never de-duplicated question_id, so repeating one
    correct answer inflated the score past `total` (1000% observed); the answers
    list had no max_length, making a single request an unbounded DB write."""

    def setUp(self):
        cache.clear()
        self.questions = [_question(i) for i in range(5)]
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'category': 'physics', 'count': 5}, format='json'
        )
        self.session_id = r.data['session_id']
        self.qids = [q['id'] for q in r.data['questions']]

    def _submit(self, answers, client=None):
        return (client or self.client).post(
            f'/api/v1/challenges/quiz/{self.session_id}/submit/',
            {'answers': answers},
            format='json',
        )

    def test_duplicate_question_ids_cannot_inflate_the_score(self):
        dup = [{'question_id': self.qids[0], 'selected': 1} for _ in range(50)]
        r = self._submit(dup)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertLessEqual(r.data['score'], r.data['total'])
        self.assertLessEqual(r.data['percentage'], 100)

    def test_answers_list_is_length_capped(self):
        flood = [{'question_id': self.qids[0], 'selected': 1} for _ in range(5000)]
        r = self._submit(flood)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_correct_answer_sent_as_a_string_still_counts(self):
        """Finding: `q.correct_answer == selected` compared int to str, so a
        client sending "1" instead of 1 scored zero on every question."""
        answers = [{'question_id': q, 'selected': '1'} for q in self.qids]
        r = self._submit(answers)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['score'], len(self.qids))

    def test_selected_out_of_range_is_rejected(self):
        r = self._submit([{'question_id': self.qids[0], 'selected': 99}])
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_xp_award_recomputes_the_level(self):
        """Finding: quiz XP was written with profile.xp += n, bypassing add_xp(),
        so the stored level never moved."""
        import math

        answers = [{'question_id': q, 'selected': 1} for q in self.qids]
        self._submit(answers)
        profile = self.user.gamification
        profile.refresh_from_db()
        expected = math.floor(math.sqrt(profile.xp / 100)) + 1
        self.assertEqual(profile.level, expected)


class QuizOwnershipTests(TestCase):
    """Finding: QuizResultView and QuizSubmitView were AllowAny and took
    session_id straight from the URL, so sequential IDs exposed and let anyone
    close another student's session."""

    def setUp(self):
        cache.clear()
        [_question(i) for i in range(5)]
        self.alice = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.bob = User.objects.create_user(username='bob', email='b@e.com', password='x')

        self.alice_client = APIClient()
        self.alice_client.force_authenticate(self.alice)
        r = self.alice_client.post(
            '/api/v1/challenges/quiz/start/', {'category': 'physics', 'count': 5}, format='json'
        )
        self.session_id = r.data['session_id']
        self.qids = [q['id'] for q in r.data['questions']]

        self.bob_client = APIClient()
        self.bob_client.force_authenticate(self.bob)

    def test_another_user_cannot_read_the_session_result(self):
        r = self.bob_client.get(f'/api/v1/challenges/quiz/{self.session_id}/result/')
        self.assertIn(r.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

    def test_anonymous_cannot_read_the_session_result(self):
        r = APIClient().get(f'/api/v1/challenges/quiz/{self.session_id}/result/')
        self.assertIn(
            r.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_another_user_cannot_submit_into_the_session(self):
        r = self.bob_client.post(
            f'/api/v1/challenges/quiz/{self.session_id}/submit/',
            {'answers': [{'question_id': self.qids[0], 'selected': 1}]},
            format='json',
        )
        self.assertIn(r.status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))
        self.assertFalse(QuizSession.objects.get(id=self.session_id).is_completed)

    def test_the_owner_can_read_and_submit(self):
        submit = self.alice_client.post(
            f'/api/v1/challenges/quiz/{self.session_id}/submit/',
            {'answers': [{'question_id': self.qids[0], 'selected': 1}]},
            format='json',
        )
        self.assertEqual(submit.status_code, status.HTTP_200_OK)
        result = self.alice_client.get(f'/api/v1/challenges/quiz/{self.session_id}/result/')
        self.assertEqual(result.status_code, status.HTTP_200_OK)


class DailyChallengeTests(TestCase):
    """Findings: the daily submit had the same duplicate-answer inflation, ran one
    DB query per submitted element, and its history endpoint counted a slice."""

    def setUp(self):
        cache.clear()
        self.questions = [_question(i) for i in range(6)]
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_duplicate_answers_cannot_inflate_the_daily_score(self):
        challenge = DailyChallenge.get_or_create_today()
        qid = challenge.questions.first().id
        r = self.client.post(
            '/api/v1/challenges/submit/',
            {'answers': [{'question_id': qid, 'selected': 1} for _ in range(200)]},
            format='json',
        )
        self.assertIn(r.status_code, (status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST))
        if r.status_code == status.HTTP_201_CREATED:
            result = r.data['result']
            self.assertLessEqual(result['score'], result['total'])

    def test_history_total_is_not_capped_by_the_display_slice(self):
        self.client.post(
            '/api/v1/challenges/submit/',
            {'answers': [{'question_id': self.questions[0].id, 'selected': 1}]},
            format='json',
        )
        r = self.client.get('/api/v1/challenges/history/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        from .models import UserChallengeResult

        self.assertEqual(
            r.data['total_challenges'], UserChallengeResult.objects.filter(user=self.user).count()
        )

    def test_today_endpoint_does_not_create_rows_on_a_get(self):
        """A GET must be safe. get_or_create_today() wrote a DailyChallenge row."""
        APIClient().get('/api/v1/challenges/today/')
        before = DailyChallenge.objects.count()
        APIClient().get('/api/v1/challenges/today/')
        self.assertEqual(DailyChallenge.objects.count(), before)


class LessonQuizTests(TestCase):
    """ADR 0001, step 5: a question can belong to one lesson, and a quiz can be
    started for that lesson rather than for a whole subject.

    `courses.QuizQuestion` was the alternative — a second question model with no
    readers, no admin and no submit flow. This bank already has all three."""

    def setUp(self):
        from apps.courses.models import Sphere, Topic, TopicLesson

        self.client = APIClient()
        sphere = Sphere.objects.create(slug='physics', title='Fizika', title_en='Physics')
        topic = Topic.objects.create(sphere=sphere, slug='physics-kinematics', title='Kinematika')
        self.lesson = TopicLesson.objects.create(
            topic=topic, slug='kin-one', name='Straight-line motion',
        )
        self.other_lesson = TopicLesson.objects.create(
            topic=topic, slug='kin-two', name='Relativity of motion',
        )

        self.attached = ChallengeQuestion.objects.create(
            category='physics', difficulty='easy', lesson=self.lesson,
            question='Tezlik nima?', options=['a', 'b', 'c', 'd'], correct_answer=1,
        )
        # In the category pool but attached to nothing.
        ChallengeQuestion.objects.create(
            category='physics', difficulty='easy',
            question='Loose question', options=['a', 'b', 'c', 'd'], correct_answer=0,
        )

    def test_a_lesson_quiz_only_draws_that_lesson_s_questions(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'lesson': 'kin-one', 'count': 10}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(r.data['total'], 1)
        self.assertEqual(r.data['questions'][0]['id'], self.attached.id)

    def test_it_still_hides_the_answer_key(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'lesson': 'kin-one'}, format='json',
        )
        for question in r.data['questions']:
            self.assertNotIn('correct_answer', question)
            self.assertNotIn('explanation', question)

    def test_a_lesson_with_no_questions_says_so_rather_than_serving_the_category(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'lesson': 'kin-two'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_an_unknown_lesson_is_404_not_500(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'lesson': 'nope'}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_neither_a_category_nor_a_lesson_is_a_400(self):
        r = self.client.post('/api/v1/challenges/quiz/start/', {}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_a_category_quiz_still_works_and_ignores_the_lesson_link(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'category': 'physics', 'count': 10}, format='json',
        )
        self.assertEqual(r.data['total'], 2)

    def test_deleting_a_lesson_keeps_its_questions_in_the_category_pool(self):
        self.lesson.delete()
        self.attached.refresh_from_db()
        self.assertIsNone(self.attached.lesson)
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'category': 'physics', 'count': 10}, format='json',
        )
        self.assertEqual(r.data['total'], 2)

    def test_the_lesson_tree_reports_whether_a_lesson_has_a_quiz(self):
        r = self.client.get('/api/v1/courses/spheres/physics/tree/')
        counts = {
            node['slug']: node['question_count']
            for topic in r.data['topics'] for node in topic['lessons']
        }
        self.assertEqual(counts['kin-one'], 1)
        self.assertEqual(counts['kin-two'], 0)


class DailyChallengeConcurrencyTests(TestCase):
    """Second-pass findings, 22 Aug 2026."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='dc', email='dc@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        for i in range(5):
            _question(i, difficulty=['easy', 'medium', 'medium', 'hard', 'hard'][i])
        self.challenge = DailyChallenge.get_or_create_today()

    def _submit(self):
        answers = [
            {'question_id': q.id, 'selected': q.correct_answer}
            for q in self.challenge.questions.all()
        ]
        return self.client.post(
            '/api/v1/challenges/submit/', {'answers': answers, 'time_taken': 30}, format='json',
        )

    def test_a_first_submission_is_accepted(self):
        self.assertEqual(self._submit().status_code, status.HTTP_201_CREATED)

    def test_a_second_submission_is_refused(self):
        self._submit()
        self.assertEqual(self._submit().status_code, status.HTTP_400_BAD_REQUEST)

    def test_losing_the_race_gives_400_not_500(self):
        """The `exists()` check is not the guard — two submissions arriving
        together both pass it, and `unique_together` catches the second. That
        used to surface as an unhandled IntegrityError."""
        from unittest.mock import patch

        from apps.challenges.models import UserChallengeResult

        self._submit()
        # Re-run with the pre-flight check blinded, which is what the loser of
        # the race sees.
        with patch.object(
            UserChallengeResult.objects.__class__, 'filter',
            side_effect=lambda *a, **k: UserChallengeResult.objects.none(),
        ):
            response = self._submit()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_the_challenge_day_is_the_users_day(self):
        import inspect

        from apps.challenges import models as challenge_models

        source = inspect.getsource(challenge_models.DailyChallenge.get_or_create_today)
        self.assertIn('timezone.localdate()', source)


class UserStreakTests(TestCase):
    """`update_streak` was a read-modify-write on a loaded instance."""

    def setUp(self):
        from apps.challenges.models import UserStreak

        self.user = User.objects.create_user(username='st', email='st@e.com', password='x')
        self.streak = UserStreak.objects.create(user=self.user)
        self.UserStreak = UserStreak

    def test_a_first_completion_starts_the_streak(self):
        self.streak.update_streak()
        self.streak.refresh_from_db()
        self.assertEqual(self.streak.current_streak, 1)
        self.assertEqual(self.streak.longest_streak, 1)

    def test_a_second_call_the_same_day_does_nothing(self):
        self.streak.update_streak()
        self.streak.update_streak()
        self.streak.refresh_from_db()
        self.assertEqual(self.streak.current_streak, 1)

    def test_it_is_atomic_against_a_stale_copy(self):
        stale = self.UserStreak.objects.get(pk=self.streak.pk)
        self.streak.update_streak()
        stale.update_streak()

        self.streak.refresh_from_db()
        self.assertEqual(self.streak.current_streak, 1, 'the day was counted twice')

    def test_a_consecutive_day_extends_it(self):
        self.streak.last_completed = timezone.localdate() - timezone.timedelta(days=1)
        self.streak.current_streak = 3
        self.streak.save()

        self.streak.update_streak()
        self.streak.refresh_from_db()
        self.assertEqual(self.streak.current_streak, 4)
        self.assertEqual(self.streak.longest_streak, 4)

    def test_a_missed_day_resets_it_but_keeps_the_record(self):
        self.streak.last_completed = timezone.localdate() - timezone.timedelta(days=4)
        self.streak.current_streak = 7
        self.streak.longest_streak = 7
        self.streak.save()

        self.streak.update_streak()
        self.streak.refresh_from_db()
        self.assertEqual(self.streak.current_streak, 1)
        self.assertEqual(self.streak.longest_streak, 7)


class QuestionTranslationTests(TestCase):
    """27 Aug 2026: the seed had Uzbek-only questions, and the model had no
    room for translated answer options at all — so a Russian page could show
    a Russian question over four Uzbek answers."""

    def setUp(self):
        cache.clear()
        self.q = ChallengeQuestion.objects.create(
            category='physics', difficulty='easy',
            question='Tezlik nima?', question_en='What is velocity?',
            question_ru='Что такое скорость?',
            options=['a', 'b', 'c', 'd'],
            options_en=['a-en', 'b-en', 'c-en', 'd-en'],
            options_ru=['a-ru', 'b-ru', 'c-ru', 'd-ru'],
            correct_answer=1,
        )
        self.client = APIClient()

    def test_the_quiz_payload_carries_the_translated_options(self):
        r = self.client.post(
            '/api/v1/challenges/quiz/start/', {'category': 'physics', 'count': 5}, format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        question = r.data['questions'][0]
        self.assertEqual(question['options_en'], ['a-en', 'b-en', 'c-en', 'd-en'])
        self.assertEqual(question['options_ru'], ['a-ru', 'b-ru', 'c-ru', 'd-ru'])
        self.assertNotIn('correct_answer', question)

    def test_translations_are_optional_and_default_to_empty(self):
        q = ChallengeQuestion.objects.create(
            category='physics', question='Savol', options=['a', 'b'], correct_answer=0,
        )
        self.assertEqual(q.options_en, [])
        self.assertEqual(q.options_ru, [])


class SeedTranslationTests(TestCase):
    """The seed is the only content the pool has; every row it writes must
    read in all three languages, with the answers under the same letters."""

    def test_every_seeded_question_is_translated_and_lines_up(self):
        from io import StringIO

        from django.core.management import call_command

        call_command('seed_challenges', stdout=StringIO())
        rows = ChallengeQuestion.objects.filter(is_active=True)
        self.assertGreaterEqual(rows.count(), 60)
        for row in rows:
            with self.subTest(question=row.question):
                self.assertTrue(row.question_en.strip())
                self.assertTrue(row.question_ru.strip())
                self.assertEqual(len(row.options_en), len(row.options))
                self.assertEqual(len(row.options_ru), len(row.options))
                self.assertTrue(0 <= row.correct_answer < len(row.options))

    def test_the_seed_is_idempotent(self):
        from io import StringIO

        from django.core.management import call_command

        call_command('seed_challenges', stdout=StringIO())
        first = ChallengeQuestion.objects.count()
        call_command('seed_challenges', stdout=StringIO())
        self.assertEqual(ChallengeQuestion.objects.count(), first)


class DailyChallengeContentTests(TestCase):
    """Doc item 9, "Daily challange": the day has to exist with real questions
    in it, hold as many as it says it holds, and not be a repeat of yesterday.

    Three findings, all of them a child would meet on an ordinary morning:
    a day generated before anyone ran `seed_challenges` was empty for good;
    `question_count` was a field nothing read; and the pick had no memory, so
    the twelve hard questions came round about every sixth day."""

    def setUp(self):
        cache.clear()
        for i in range(8):
            _question(i, difficulty='easy')
        for i in range(8, 20):
            _question(i, difficulty='medium')
        for i in range(20, 32):
            _question(i, difficulty='hard')

    def test_a_day_generated_before_the_pool_was_seeded_fills_itself_later(self):
        """The first visitor to a fresh install creates the row. Seeding
        afterwards used to leave that whole day blank, because the questions
        were only chosen on the create."""
        ChallengeQuestion.objects.update(is_active=False)
        empty = DailyChallenge.get_or_create_today()
        self.assertEqual(empty.questions.count(), 0, 'nothing to choose from yet')

        ChallengeQuestion.objects.update(is_active=True)
        filled = DailyChallenge.get_or_create_today()
        self.assertEqual(filled.pk, empty.pk, 'still the same day')
        self.assertEqual(filled.questions.count(), 5)

    def test_it_serves_as_many_questions_as_question_count_asks_for(self):
        """`question_count` is editable in the admin and was read nowhere —
        the pick hardcoded five in four separate places."""
        DailyChallenge.objects.create(date=timezone.localdate(), question_count=8)
        challenge = DailyChallenge.get_or_create_today()
        self.assertEqual(challenge.questions.count(), 8)

    def test_yesterday_s_questions_are_not_asked_again_today(self):
        yesterday = DailyChallenge.objects.create(
            date=timezone.localdate() - timezone.timedelta(days=1)
        )
        yesterday.fill_questions()
        seen = set(yesterday.questions.values_list('id', flat=True))
        self.assertEqual(len(seen), 5)

        today = DailyChallenge.get_or_create_today()
        self.assertFalse(
            seen & set(today.questions.values_list('id', flat=True)),
            'the same question two mornings running',
        )

    def test_a_pool_too_small_to_avoid_repeats_still_fills_the_day(self):
        """Preferring unseen questions must never leave a day short. With six
        questions in the pool and five a day, day two has to repeat — and it
        has to be five questions, not one."""
        ChallengeQuestion.objects.all().delete()
        for i in range(6):
            _question(i, difficulty='medium')
        yesterday = DailyChallenge.objects.create(
            date=timezone.localdate() - timezone.timedelta(days=1)
        )
        yesterday.fill_questions()

        today = DailyChallenge.get_or_create_today()
        self.assertEqual(today.questions.count(), 5)

    def test_a_longer_day_stays_mostly_medium_and_hard(self):
        """"Bolani test qilib sinash" — a day of easy questions is not a
        challenge. The five-question mix is one easy, two medium, two hard;
        a longer day has to keep those proportions rather than pad with the
        easy ones it has most of."""
        DailyChallenge.objects.create(date=timezone.localdate(), question_count=10)
        challenge = DailyChallenge.get_or_create_today()
        counts = Counter(challenge.questions.values_list('difficulty', flat=True))
        self.assertEqual(counts['easy'], 2)
        self.assertEqual(counts['medium'], 4)
        self.assertEqual(counts['hard'], 4)


class ChallengeReviewTests(TestCase):
    """A wrong answer has to teach something. The submit response carried a
    map of correct indices and nothing else — no text, so the screen could
    only say "you got 3 of 5" and the child left knowing exactly what they
    knew when they arrived."""

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='rev', email='rev@e.com', password='x')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.q = ChallengeQuestion.objects.create(
            category='astronomy', difficulty='easy',
            question='Qaysi sayyora Qizil sayyora deb ataladi?',
            question_en='Which planet is known as the Red Planet?',
            question_ru='Какую планету называют Красной планетой?',
            options=['Venera', 'Mars', 'Yupiter', 'Saturn'],
            options_en=['Venus', 'Mars', 'Jupiter', 'Saturn'],
            options_ru=['Венера', 'Марс', 'Юпитер', 'Сатурн'],
            correct_answer=1,
            explanation='Mars temir oksidiga boy chang bilan qoplangan.',
            explanation_en='Mars is covered in dust rich in iron oxide.',
            explanation_ru='Марс покрыт пылью, богатой оксидом железа.',
        )
        self.challenge = DailyChallenge.get_or_create_today()

    def _submit(self, selected):
        return self.client.post(
            '/api/v1/challenges/submit/',
            {'answers': [{'question_id': self.q.id, 'selected': selected}], 'time_taken': 9},
            format='json',
        )

    def test_a_wrong_answer_comes_back_explained_in_all_three_languages(self):
        response = self._submit(0)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        entry = response.data['review'][0]
        self.assertEqual(entry['id'], self.q.id)
        self.assertEqual(entry['selected'], 0)
        self.assertFalse(entry['is_correct'])
        self.assertEqual(entry['correct_answer'], 1)
        self.assertEqual(entry['explanation'], 'Mars temir oksidiga boy chang bilan qoplangan.')
        self.assertEqual(entry['explanation_en'], 'Mars is covered in dust rich in iron oxide.')
        self.assertEqual(entry['explanation_ru'], 'Марс покрыт пылью, богатой оксидом железа.')

    def test_a_question_left_blank_is_reviewed_too(self):
        """Running out of time sends -1, and those are the ones most worth
        explaining. They were missing from the response entirely."""
        response = self._submit(-1)
        entry = response.data['review'][0]
        self.assertEqual(entry['selected'], -1)
        self.assertFalse(entry['is_correct'])
        self.assertTrue(entry['explanation_en'])

    def test_the_explanation_does_not_reach_the_child_before_they_answer(self):
        """It names the answer. It belongs in the submit response and nowhere
        that runs before it — the same rule that keeps `correct_answer` out."""
        response = APIClient().get('/api/v1/challenges/today/')
        question = response.data['questions'][0]
        self.assertNotIn('explanation', question)
        self.assertNotIn('explanation_en', question)
        self.assertNotIn('correct_answer', question)


class SeedExplanationTests(TestCase):
    """The pool is the product. Every row has to say *why*, in the reader's
    language, and there have to be enough of the hard ones that a fortnight
    is not the same five questions three times over."""

    @classmethod
    def setUpTestData(cls):
        from io import StringIO

        from django.core.management import call_command

        call_command('seed_challenges', stdout=StringIO())

    def test_every_seeded_question_explains_its_answer_in_three_languages(self):
        for row in ChallengeQuestion.objects.filter(is_active=True):
            with self.subTest(question=row.question):
                self.assertTrue(row.explanation.strip(), 'no Uzbek explanation')
                self.assertTrue(row.explanation_en.strip(), 'no English explanation')
                self.assertTrue(row.explanation_ru.strip(), 'no Russian explanation')

    def test_there_are_enough_hard_questions_for_a_fortnight(self):
        """Two hard a day for fourteen days is twenty-eight. Twelve in the pool
        meant every hard question came round twice a fortnight."""
        hard = ChallengeQuestion.objects.filter(is_active=True, difficulty='hard').count()
        medium = ChallengeQuestion.objects.filter(is_active=True, difficulty='medium').count()
        self.assertGreaterEqual(hard, 28, 'fourteen days of two hard questions')
        self.assertGreaterEqual(medium, 28, 'fourteen days of two medium questions')

    def test_pressing_the_first_button_every_time_does_not_pass(self):
        """The sharpest finding of the lot, and the cheapest to miss: 53 of the
        64 seeded questions had their answer under option A and not one had it
        under D, so a child who never read a question and always pressed the
        first button scored 83%. That is not a test of anything."""
        rows = list(ChallengeQuestion.objects.filter(is_active=True))
        self.assertGreaterEqual(len(rows), 60)

        for index in range(4):
            share = sum(1 for r in rows if r.correct_answer == index) / len(rows)
            with self.subTest(option='ABCD'[index]):
                self.assertGreater(share, 0.15, 'this option is almost never the answer')
                self.assertLess(share, 0.35, 'guessing this option every time passes')

    def test_time_is_sized_to_the_question(self):
        """The daily challenge ran one hardcoded 15-second clock for every
        question, including "the first half at 60 km/h, the second at 40 —
        find the average speed". It reads `time_seconds` now, so the seed has
        to set it: a calculation needs working time, and naming the Red Planet
        does not need a minute."""
        calculations = ChallengeQuestion.objects.filter(is_active=True, category='problems')
        recall = ChallengeQuestion.objects.filter(
            is_active=True, difficulty='easy',
        ).exclude(category='problems')
        self.assertTrue(calculations.exists() and recall.exists())

        for row in calculations:
            with self.subTest(calculation=row.question):
                self.assertGreaterEqual(row.time_seconds, 60, 'no working time')

        # Every row used to carry the 60-second default, so this comparison was
        # 60 < 60 and could not hold however the pool was written.
        self.assertLess(
            max(r.time_seconds for r in recall),
            min(r.time_seconds for r in calculations),
            'naming the Red Planet is given as long as a two-step calculation',
        )
