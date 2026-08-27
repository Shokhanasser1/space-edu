"""How one question in the pool is written down.

The pool is the product. Everything here exists so that a question cannot be
added in a shape that is wrong on screen — see `seed_challenges.check`, which
refuses to seed a list that breaks any of it.
"""
import hashlib


def for_category(category):
    """A `q(...)` for one category file, so the category is written once."""

    def q(difficulty, seconds, uz, en, ru,
          options_uz, options_en, options_ru, correct,
          why_uz, why_en, why_ru):
        return dict(
            category=category, difficulty=difficulty, time_seconds=seconds,
            question=uz, question_en=en, question_ru=ru,
            options=options_uz, options_en=options_en, options_ru=options_ru,
            correct_answer=correct,
            explanation=why_uz, explanation_en=why_en, explanation_ru=why_ru,
        )

    return q


def spread_answers(questions):
    """Deal the right answers evenly across A, B, C and D.

    Written questions bunch up. Of the first 64 in this pool, 53 had the answer
    under option A and not one had it under D, so a child who never read a
    question and always pressed the first button scored 83% — which is not a
    test of anything. Asking every author to remember to vary it by hand is
    exactly how that happened, so it is done here instead: write the answer
    wherever it reads best and this moves it.

    Round-robin over a digest ordering rather than a hash per question: a hash
    is uniform on average and this has to be even on *this* list, which is
    under a hundred rows. The ordering comes from the Uzbek text, so it is the
    same on every machine and on every re-run — and that is what keeps the seed
    idempotent, since rows are matched on exactly that text.

    Adding a question can therefore move an existing one's answer to another
    letter. Nothing depends on the position: results store a score, and a live
    quiz session is graded from the same row it was served from.
    """
    order = sorted(
        range(len(questions)),
        key=lambda i: hashlib.sha256(questions[i]['question'].encode('utf-8')).digest(),
    )

    spread = [None] * len(questions)
    for rank, index in enumerate(order):
        item = questions[index]
        size = len(item['options'])
        # How far the answer has to travel to land on the position this rank
        # was dealt. All three option lists move together — `correct_answer`
        # indexes into all of them.
        shift = (rank % size - item['correct_answer']) % size

        def rotate(values, shift=shift):
            return values[-shift:] + values[:-shift] if shift else list(values)

        spread[index] = {
            **item,
            'options': rotate(item['options']),
            'options_en': rotate(item['options_en']),
            'options_ru': rotate(item['options_ru']),
            'correct_answer': rank % size,
        }
    return spread
