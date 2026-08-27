from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


# ──────────────────────────────────────────────────────────────────────────────
#  CHALLENGE QUESTION  —  quiz question pool for daily challenges AND quiz/tests
# ──────────────────────────────────────────────────────────────────────────────
class ChallengeQuestion(models.Model):
    CATEGORIES = [
        ('physics', 'Physics'),
        ('astronomy', 'Astronomy'),
        ('problems', 'Problems'),
        ('courses', 'Online Courses'),
        ('general', 'General Space'),
    ]
    DIFFICULTIES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]

    category = models.CharField(max_length=20, choices=CATEGORIES, default='general')
    difficulty = models.CharField(max_length=10, choices=DIFFICULTIES, default='medium')
    lesson = models.ForeignKey(
        'courses.TopicLesson',
        on_delete=models.SET_NULL, null=True, blank=True, related_name='questions',
        help_text='Attach this question to one lesson. Empty means it is only in '
                  'the category pool.',
    )
    question = models.TextField(help_text='Question text (Uzbek)')
    question_en = models.TextField(blank=True, default='')
    question_ru = models.TextField(blank=True, default='')
    options = models.JSONField(help_text='List of 4 answer options')
    # Same order as `options`, or empty — `correct_answer` indexes into all
    # three. A translation that does not line up is ignored by the client.
    options_en = models.JSONField(blank=True, default=list, help_text='Answer options in English, same order')
    options_ru = models.JSONField(blank=True, default=list, help_text='Answer options in Russian, same order')
    correct_answer = models.PositiveSmallIntegerField(help_text='0-based index of correct option')
    explanation = models.TextField(blank=True, default='', help_text='Why this answer is correct (Uzbek)')
    # Translated for the same reason the options are: an explanation is the one
    # part of a question that has to be *read*, and a Russian child handed the
    # Uzbek paragraph learns nothing from getting it wrong.
    explanation_en = models.TextField(blank=True, default='')
    explanation_ru = models.TextField(blank=True, default='')
    time_seconds = models.PositiveIntegerField(
        default=60,
        help_text='Working time for this one question, in seconds. Sized to the '
                  'question: a calculation needs more than a name.',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'difficulty']
        verbose_name = 'Challenge Question'

    def __str__(self):
        return f'[{self.category}/{self.difficulty}] {self.question[:60]}'


# ──────────────────────────────────────────────────────────────────────────────
#  DAILY CHALLENGE  —  auto-generated set of questions for a specific date
# ──────────────────────────────────────────────────────────────────────────────
class DailyChallenge(models.Model):
    date = models.DateField(unique=True)
    questions = models.ManyToManyField(ChallengeQuestion, related_name='daily_challenges')
    question_count = models.PositiveSmallIntegerField(default=5)
    time_limit = models.PositiveSmallIntegerField(default=15, help_text='Seconds per question')
    xp_per_correct = models.PositiveIntegerField(default=50)
    xp_completion_bonus = models.PositiveIntegerField(default=100)
    fuel_reward = models.PositiveIntegerField(default=20, help_text='Fuel reward for completing')
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'Daily Challenge'

    def __str__(self):
        return f'Challenge {self.date}'

    # How far back the pick looks before it is willing to ask something again.
    # A fortnight of daily challenges without a repeat is the promise; the pool
    # has to be deep enough to keep it, and `fill_questions` falls back rather
    # than serving a short day when it is not.
    RECENT_DAYS = 14

    # Shares of a day by difficulty, in the order easy, medium, hard. The
    # five-question day these were written for is 1 / 2 / 2, and a longer one
    # keeps the same shape instead of padding with the easy questions there
    # happen to be most of.
    MIX = (0.2, 0.4, 0.4)

    def fill_questions(self):
        """Choose this challenge's questions from the active pool.

        Two rules, both of which the old inline version broke. The day holds
        `question_count` questions — that field was editable in the admin and
        read nowhere. And it prefers questions the last `RECENT_DAYS` days have
        not already asked: with twelve hard questions and two a day, a child
        doing this every morning met the same ones about every sixth day, which
        stops being a test and becomes a memory game.
        """
        # `random`, not `secrets`: nothing is protected by which questions come
        # up — CONTRIBUTING C-8 draws that line at codes and tokens.
        import random

        wanted = max(1, self.question_count)
        pool = list(ChallengeQuestion.objects.filter(is_active=True))
        if not pool:
            return

        recent = set(
            ChallengeQuestion.objects
            .filter(
                daily_challenges__date__gte=self.date - timezone.timedelta(days=self.RECENT_DAYS),
                daily_challenges__date__lt=self.date,
            )
            .values_list('id', flat=True)
        )

        def take(candidates, count, already):
            """`count` questions, unseen ones first, never one twice.

            Falling back to recently-asked questions matters: a pool too thin
            to fill a fresh day must still fill the day. A short one is a
            broken screen, and the child did not choose the pool size.
            """
            if count <= 0:
                return []
            free = [q for q in candidates if q not in already]
            fresh = [q for q in free if q.id not in recent]
            stale = [q for q in free if q.id in recent]
            random.shuffle(fresh)
            random.shuffle(stale)
            return (fresh + stale)[:count]

        easy_share, medium_share, _ = self.MIX
        easy_n = max(1, round(wanted * easy_share))
        medium_n = round(wanted * medium_share)
        hard_n = max(0, wanted - easy_n - medium_n)

        by_difficulty = {
            level: [q for q in pool if q.difficulty == level]
            for level in ('easy', 'medium', 'hard')
        }

        selected = []
        for level, count in (('easy', easy_n), ('medium', medium_n), ('hard', hard_n)):
            selected += take(by_difficulty[level], count, selected)

        # A difficulty band too small to meet its share leaves the day short.
        # Top it up from everything else rather than hand out four questions.
        if len(selected) < wanted:
            selected += take(pool, wanted - len(selected), selected)

        self.questions.set(selected)

    @classmethod
    def get_or_create_today(cls):
        """Today's challenge, generated from the pool if nobody made one.

        No scheduler and no command to remember: the first request of the day
        makes the day. The questions are chosen when the row is created *and*
        whenever the row has none — a fresh install answers its first visitor
        before anyone has run `seed_challenges`, and that day used to stay
        blank for good because the pick only ever ran on the create.
        """
        # localdate, not now().date(): the server runs on UTC and the site on
        # Asia/Tashkent, so the naive version rolled the day over at 05:00 local
        # and filed an evening attempt under yesterday.
        today = timezone.localdate()
        challenge, _ = cls.objects.get_or_create(date=today)

        if not challenge.questions.exists():
            challenge.fill_questions()

        return challenge


# ──────────────────────────────────────────────────────────────────────────────
#  USER CHALLENGE RESULT  —  tracks each user's daily challenge attempts
# ──────────────────────────────────────────────────────────────────────────────
class UserChallengeResult(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_results',
    )
    challenge = models.ForeignKey(DailyChallenge, on_delete=models.CASCADE, related_name='results')
    score = models.PositiveSmallIntegerField(default=0, help_text='Number of correct answers')
    total = models.PositiveSmallIntegerField(default=5)
    xp_earned = models.PositiveIntegerField(default=0)
    fuel_earned = models.PositiveIntegerField(default=0)
    time_taken = models.PositiveIntegerField(default=0, help_text='Total seconds taken')
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'challenge')
        ordering = ['-completed_at']
        verbose_name = 'Challenge Result'

    def __str__(self):
        return f'{self.user.username} — {self.challenge.date} ({self.score}/{self.total})'


# ──────────────────────────────────────────────────────────────────────────────
#  STREAK  —  consecutive daily challenge completions
# ──────────────────────────────────────────────────────────────────────────────
class UserStreak(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_streak',
    )
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_completed = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'User Streak'

    def __str__(self):
        return f'{self.user.username}: {self.current_streak} days'

    @property
    def live_streak(self):
        """The streak as it stands today, not as it stood when it was written.

        `update_streak()` only runs when a challenge is submitted, so the stored
        number keeps whatever it reached until the next submission. A child who
        held a seven-day streak and then missed Thursday was still told "7" on
        Friday, and on Saturday, and it only became 1 the moment they played
        again — the app congratulating them for a streak they had already lost.

        The column stays as it is: it is the history `update_streak()` reads to
        decide whether today continues yesterday. This is the answer to the
        different question the screen actually asks.
        """
        if self.last_completed is None:
            return 0
        today = timezone.localdate()
        # Yesterday still counts: today is not over, and they can still keep it.
        if self.last_completed >= today - timezone.timedelta(days=1):
            return self.current_streak
        return 0

    def update_streak(self):
        """Call after completing today's challenge.

        Read-modify-write on a loaded instance, exactly like the profile streak:
        two submissions arriving together both saw the day unclaimed and both
        incremented from the same starting value, so one increment was lost.
        The decision and the write now happen under one row lock.
        """
        today = timezone.localdate()
        with transaction.atomic():
            locked = UserStreak.objects.select_for_update().get(pk=self.pk)
            if locked.last_completed == today:
                self.refresh_from_db(
                    fields=['current_streak', 'longest_streak', 'last_completed']
                )
                return

            yesterday = today - timezone.timedelta(days=1)
            locked.current_streak = (
                locked.current_streak + 1 if locked.last_completed == yesterday else 1
            )
            locked.longest_streak = max(locked.longest_streak, locked.current_streak)
            locked.last_completed = today
            locked.save(
                update_fields=['current_streak', 'longest_streak', 'last_completed']
            )

        self.refresh_from_db(fields=['current_streak', 'longest_streak', 'last_completed'])


# ══════════════════════════════════════════════════════════════════════════════
#  QUIZ / TEST SESSION — full quiz attempts (separate from daily challenge)
# ══════════════════════════════════════════════════════════════════════════════
class QuizSession(models.Model):
    """A full quiz/test attempt by a user in a specific category."""
    QUIZ_CATEGORIES = [
        ('physics', 'Physics'),
        ('astronomy', 'Astronomy'),
        ('problems', 'Problems'),
        ('courses', 'Online Courses'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='quiz_sessions',
        null=True, blank=True,  # allow anonymous
    )
    category = models.CharField(max_length=20, choices=QUIZ_CATEGORIES)
    questions = models.ManyToManyField(ChallengeQuestion, related_name='quiz_sessions')
    score = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    percentage = models.FloatField(default=0.0)
    time_taken = models.PositiveIntegerField(default=0, help_text='Total seconds')
    xp_earned = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Quiz Session'

    def __str__(self):
        user_str = self.user.username if self.user else 'anon'
        return f'{user_str} — {self.category} ({self.score}/{self.total})'


class QuizAnswer(models.Model):
    """Individual answer within a quiz session."""
    session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(ChallengeQuestion, on_delete=models.CASCADE)
    selected_answer = models.IntegerField(help_text='0-based index selected by user')
    is_correct = models.BooleanField(default=False)
    time_spent = models.PositiveIntegerField(default=0, help_text='Seconds spent on this question')

    class Meta:
        ordering = ['id']
        verbose_name = 'Quiz Answer'

    def __str__(self):
        return f'Q{self.question_id}: {"correct" if self.is_correct else "wrong"}'

