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
from apps.challenges.question_pool import QUESTIONS, RETIRED


def check(questions):
    """Refuse to seed a list that would be wrong on screen."""
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

    def handle(self, *args, **options):
        check(QUESTIONS)
        self.stdout.write('Seeding challenge questions...')

        created_count = 0
        for item in QUESTIONS:
            _, created = ChallengeQuestion.objects.update_or_create(
                question=item['question'], defaults={**item, 'is_active': True},
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
        # The daily challenge takes two medium and two hard a day and tries not
        # to repeat inside a fortnight, so these three numbers are what decide
        # whether it can keep that promise.
        for level in ('easy', 'medium', 'hard'):
            self.stdout.write(f'  {level}: {by_difficulty.get(level, 0)}')
