"""The question pool, as written text rather than as rows.

One module per category, because that is how the work is divided: whoever is
writing astronomy questions should not be scrolling past the physics ones. The
whole thing used to be one 815-line list inside `seed_challenges.py`, and
adding the explanations to it would have taken that past the 800-line ceiling
in CONTRIBUTING.

`manage.py seed_challenges` loads `QUESTIONS` from here and writes it to
`ChallengeQuestion`, matching on the Uzbek text so re-running updates in place.
"""
from . import astronomy, courses, general, physics, problems
from .builder import spread_answers

QUESTIONS = spread_answers(
    general.QUESTIONS
    + astronomy.QUESTIONS
    + physics.QUESTIONS
    + problems.QUESTIONS
    + courses.QUESTIONS
)

# Uzbek texts an earlier version of the pool seeded and this one no longer
# stands behind. They are switched off rather than deleted, so a finished quiz
# that referenced one still resolves to a row.
RETIRED = [
    # A neutrino star is not a thing; see the neutron star question.
    'Neytrino yulduzi nima?',
    # Marked "Udemy", which is not checkable and changes month to month.
    "Qaysi onlayn platforma dasturlash bo'yicha eng ko'p kurslarga ega?",
    # Marked "MIT". A ranking of prestige is an opinion, and a child who
    # answered Oxford was told they were wrong.
    "Qaysi universitet kosmik injiniring bo'yicha dunyodagi eng nufuzli dasturga ega?",
    # Two spellings, re-seeded under corrected text. Rows are matched on the
    # Uzbek question, so a corrected spelling is a new row and the old one has
    # to be switched off by hand or it stays in the pool alongside it.
    'Saturning halqalari asosan nimadan iborat?',    # Saturnning, with the genitive -ning
    "Jupiterning eng katta yo'ldoshi qaysi?",        # Yupiter, as the rest of the pool spells it
]
