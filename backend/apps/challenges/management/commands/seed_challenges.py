"""
Seed the ChallengeQuestion pool.
Usage:  python manage.py seed_challenges

The questions themselves live in `apps/challenges/question_pool/`, one module
per category. Every one carries the Uzbek original plus English and Russian for
the question, the answer options and the explanation — `correct_answer` indexes
into all three option lists, so they have to be the same list in three
languages.

Safe to re-run: rows are matched on the Uzbek question text and updated in
place. A text that has been retired is switched off rather than deleted, so a
finished quiz that referenced it still resolves.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.challenges.models import ChallengeQuestion
from apps.challenges.question_pool import LESSON_LINKS, LESSON_OF_QUESTION, QUESTIONS, RETIRED
from apps.courses.models import TopicLesson


def check(questions):
    """Refuse to seed a list that would be wrong on screen."""
    # A lesson link keyed on a text the pool does not hold attaches nothing and
    # complains about nothing, which is this ticket's own failure: a Test button
    # with an empty test behind it. Fail the seed rather than ship that.
    pool_texts = {item['question'] for item in questions}
    unknown = sorted(set(LESSON_OF_QUESTION) - pool_texts)
    if unknown:
        raise CommandError(
            'lesson_links names questions that are not in the pool: '
            + ', '.join(repr(text) for text in unknown)
        )
    # `lesson` is one foreign key, so a question cannot sit under two lessons.
    listed = [text for texts in LESSON_LINKS.values() for text in texts]
    if len(listed) != len(set(listed)):
        duplicated = sorted({t for t in listed if listed.count(t) > 1})
        raise CommandError(
            'a question is attached to more than one lesson: '
            + ', '.join(repr(text) for text in duplicated)
        )

    seen = set()
    for item in questions:
        text = item['question']
        if text in seen:
            raise CommandError(f'Duplicate question text: {text!r}')
        seen.add(text)
        for field in ('question_en', 'question_ru'):
            if not item[field].strip():
                raise CommandError(f'{field} is blank for {text!r}')
        # The explanation is the only part of a question that teaches. A row
        # without one leaves a child who got it wrong with nothing to take
        # away, and a row explained only in Uzbek leaves a Russian reader with
        # nothing — the same defect the option translations fixed on 27 August.
        for field in ('explanation', 'explanation_en', 'explanation_ru'):
            if not item[field].strip():
                raise CommandError(f'{field} is blank for {text!r}')
        n = len(item['options'])
        for field in ('options_en', 'options_ru'):
            if len(item[field]) != n or not all(str(o).strip() for o in item[field]):
                raise CommandError(f'{field} does not line up with options for {text!r}')
        if not 0 <= item['correct_answer'] < n:
            raise CommandError(f'correct_answer out of range for {text!r}')
        if item['time_seconds'] < 10:
            raise CommandError(f'time_seconds is not enough to read {text!r}')

    # `spread_answers` deals the answers across the four positions; this is the
    # check that it ran. Before it existed, 53 of 64 answers sat under option A,
    # none at all under D, and a child who always pressed the first button
    # scored 83% without reading anything.
    for index in range(4):
        share = sum(1 for q in questions if q['correct_answer'] == index) / len(questions)
        if not 0.15 < share < 0.35:
            raise CommandError(
                f'option {"ABCD"[index]} is the answer {share:.0%} of the time — '
                f'guessing one letter should not pass'
            )


class Command(BaseCommand):
    help = 'Populate the ChallengeQuestion pool with quiz questions in Uzbek, English and Russian'

    def _lessons_by_slug(self):
        """The lessons `lesson_links` names, or nothing if the tree is unseeded.

        `docs/TEAM.md` lists `seed_learn_content` before this command, and on a
        database where it has been run a slug that resolves to nothing is an
        authoring mistake — the seed stops rather than quietly leaving a lesson
        with no test. On a database with no lesson tree at all there is nothing
        to attach to and nothing to be wrong about, so the questions still seed
        and the command says which command to run next.
        """
        if not TopicLesson.objects.exists():
            self.stdout.write(self.style.WARNING(
                'No lesson tree in this database, so no question is attached to a '
                'lesson. Run `manage.py seed_learn_content` and then re-run this.'
            ))
            return {}

        found = {
            lesson.slug: lesson
            for lesson in TopicLesson.objects.filter(slug__in=LESSON_LINKS)
        }
        missing = sorted(set(LESSON_LINKS) - set(found))
        if missing:
            raise CommandError(
                'lesson_links names lessons that are not in the tree: '
                + ', '.join(missing)
            )
        return found

    def handle(self, *args, **options):
        check(QUESTIONS)
        self.stdout.write('Seeding challenge questions...')

        lessons = self._lessons_by_slug()

        created_count = 0
        for item in QUESTIONS:
            defaults = {**item, 'is_active': True}
            # The pool carries a slug; the column wants the row. `None` for a
            # question with no lesson, which is also what un-links one that has
            # been taken off a lesson since the last run.
            defaults['lesson'] = lessons.get(item['lesson'])
            _, created = ChallengeQuestion.objects.update_or_create(
                question=item['question'], defaults=defaults,
            )
            if created:
                created_count += 1

        retired = ChallengeQuestion.objects.filter(question__in=RETIRED, is_active=True).update(is_active=False)

        active = ChallengeQuestion.objects.filter(is_active=True)
        total = active.count()
        by_cat = {}
        by_difficulty = {}
        for row in active.values('category', 'difficulty'):
            by_cat[row['category']] = by_cat.get(row['category'], 0) + 1
            by_difficulty[row['difficulty']] = by_difficulty.get(row['difficulty'], 0) + 1

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {created_count} new questions, updated {len(QUESTIONS) - created_count}, '
            f'retired {retired} (active pool: {total})'
        ))
        for cat, cnt in sorted(by_cat.items()):
            self.stdout.write(f'  {cat}: {cnt} questions')

        # The number the ticket is actually about: how many lessons now have a
        # test behind their Test button, and how many still do not.
        attached = active.exclude(lesson=None)
        self.stdout.write(
            f'  attached to lessons: {attached.count()} questions across '
            f'{attached.values("lesson").distinct().count()} of '
            f'{TopicLesson.objects.count()} lessons'
        )
        # The daily challenge takes two medium and two hard a day and tries not
        # to repeat inside a fortnight, so these three numbers are what decide
        # whether it can keep that promise.
        for level in ('easy', 'medium', 'hard'):
            self.stdout.write(f'  {level}: {by_difficulty.get(level, 0)}')
