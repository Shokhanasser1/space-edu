""""On this day" — the anniversaries the News page opens with.

The dataset is ``data/anniversaries.json`` and the rules around it are the
whole point of this module, so read them before adding a line to that file.

**Nothing in it may be invented.** Every entry is a birth, a launch, a landing
or a loss that happened on a real, checked date, and every entry names the
source it was checked against. An anniversary is not decoration: a child is
being told that Vladimir Dzhanibekov was born today, and a platform that gets
that wrong is doing the opposite of what it exists for. Where a date could not
be confirmed, the entry is not here — an absent day is honest and a wrong one
is not.

**A day with no entry says so.** ``for_day`` returns an empty list and the page
prints a translated sentence saying we have not written that day yet. It never
falls back to a neighbouring day: an event shown under today's heading is a
claim that it happened today. ``neighbours`` exists so a reader can *walk* to a
day we have written, and the page shows that day's own date when they do.

**Coverage is published, not implied.** ``coverage()`` goes into every
response, so the page can say how many days of the year are actually written
rather than leaving a reader to infer it from a blank.

**Local history comes first.** Within one day, entries from Uzbekistan and
Central Asia are listed before the rest. This is a platform for Uzbek
schoolchildren, and the Soviet and American material will always be the easier
half to fill. Ordering is the only thumb on the scale — every entry still
carries its own year, so nothing is presented as more recent or more important
than it is.
"""
import json
from datetime import date
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent / 'data' / 'anniversaries.json'

# Every field an entry must have. Held here rather than in the tests so that
# the loader and the test that guards it cannot drift apart.
REQUIRED_FIELDS = (
    'id', 'month', 'day', 'year', 'kind', 'region',
    'title_en', 'title_uz', 'title_ru',
    'text_en', 'text_uz', 'text_ru',
    'source', 'source_url',
)

KINDS = frozenset({
    'birth',      # somebody was born
    'death',      # somebody died
    'launch',     # something left the ground
    'landing',    # something arrived somewhere
    'flight',     # a crewed flight, counted from its launch
    'first',      # the first time anyone did it
    'loss',       # a crew or a mission was lost
    'discovery',  # something was found out
    'milestone',  # anything else worth a date
})

REGIONS = frozenset({
    'uz',            # Uzbekistan, or a person born in what is now Uzbekistan
    'central_asia',  # the rest of Central Asia, Baikonur included
    'world',
})

# Any leap year: 29 February is a real anniversary and 31 February is not.
_LEAP_YEAR = 2024


def _load():
    with DATA_FILE.open(encoding='utf-8') as fh:
        return json.load(fh)['entries']


def _region_rank(entry):
    return {'uz': 0, 'central_asia': 1}.get(entry['region'], 2)


def _build_index(entries):
    index = {}
    for entry in entries:
        index.setdefault((entry['month'], entry['day']), []).append(entry)
    for day in index.values():
        day.sort(key=lambda e: (_region_rank(e), e['year'], e['id']))
    return index


ENTRIES = _load()
INDEX = _build_index(ENTRIES)
FILLED_DAYS = sorted(INDEX)


def is_real_day(month, day):
    """Is ``month``/``day`` a day that exists in some year?"""
    try:
        date(_LEAP_YEAR, month, day)
    except ValueError:
        return False
    return True


def for_day(month, day, today=None):
    """The entries for one day of the year, local ones first, then oldest first.

    ``years_ago`` is added against ``today`` so the page can say "69 years ago"
    without the browser doing the arithmetic in the wrong time zone. An entry
    whose year is still ahead of ``today`` — the dataset holds this year's own
    events — gets ``years_ago: 0`` rather than a negative number.
    """
    today = today or date.today()
    entries = []
    for entry in INDEX.get((month, day), ()):
        entries.append({**entry, 'years_ago': max(today.year - entry['year'], 0)})
    return entries


def neighbours(month, day):
    """The nearest written day before and after this one, wrapping the year.

    Both are always a *different* day from the one asked for, so "next" on a
    day we have written moves forward instead of sitting still. ``None`` when
    the dataset holds nothing at all.
    """
    if not FILLED_DAYS:
        return None, None
    others = [d for d in FILLED_DAYS if d != (month, day)]
    if not others:
        return None, None
    earlier = [d for d in others if d < (month, day)]
    later = [d for d in others if d > (month, day)]
    previous = earlier[-1] if earlier else others[-1]
    following = later[0] if later else others[0]
    return previous, following


def coverage():
    """How much of the year is written, in the response rather than in a README."""
    return {
        'days_covered': len(FILLED_DAYS),
        'days_in_year': 366,
        'entries': len(ENTRIES),
    }
