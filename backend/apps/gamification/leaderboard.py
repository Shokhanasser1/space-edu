"""What the board ranks, and what it costs to ask.

Two views answer the same questions — the board itself and the profile page's
"you are #N of M" — and they used to answer them with their own copy of the
query. That is how a child could be told they were second on their profile and
shown third on the board: the profile counted how many people were ahead of
them, the board counted rows in an array, and nothing made the two agree.

Everything either view needs to know about ranking is here, once.
"""
from django.core.cache import cache

from .models import UserGamificationProfile
from .serializers import LeaderboardEntrySerializer

# Places on the public board. Past this a player is told their own place
# instead of being shown a row that is not there.
BOARD_SIZE = 100

# How long a built board is reused for, and how long the browser is told to
# wait before asking again — one number, because it is one decision. The board
# is a live table refreshed by polling, so this is the dial that decides what
# ten thousand clients cost: whatever they ask for, the database builds the
# board twice a minute. Turn it up if a class of children ever makes the
# request rate hurt; nothing but this line has to change.
BOARD_TTL_SECONDS = 30

# Bump the version when the shape of a cached row changes, so a deploy does not
# serve rows built by the previous code for the length of the window.
_CACHE_KEY = 'gamification:leaderboard:v1'


def player_queryset():
    """The accounts that have actually played.

    A gamification row is created for every account at registration, so counting
    rows counts sign-ups. Ranking them all meant a child who had never earned a
    point was placed among ten thousand players — and, before anyone had scored
    anything, was told they were first.
    """
    return UserGamificationProfile.objects.filter(xp__gt=0)


def rank_for_xp(xp):
    """Standard competition ranking, or None for somebody who has not played.

    1-1-1-4, not 1-2-3-4: three players on 500 points are all first and the next
    is fourth. Both the board and the profile page call this, because those two
    disagreeing about a child's own number is worse than showing no number.
    """
    if xp <= 0:
        return None
    return player_queryset().filter(xp__gt=xp).count() + 1


def player_count():
    return player_queryset().count()


def build_board():
    """The top of the board, ranked, with each row's profile id beside it.

    The ids never reach a response. They are kept so that a caller's own row can
    be marked in a board that every caller shares — matching on the display name
    instead put the highlight on both children when two of them had picked the
    same astronaut name.
    """
    profiles = list(
        player_queryset()
        .select_related('user')
        # `-xp` alone leaves ties in whatever order the database happens to
        # return, which is free to differ between two requests a second apart —
        # on a table that now refreshes itself, that is rows swapping places for
        # no reason. `id` is not meaningful, only stable, which is all the
        # ordering has to be: the place itself is `rank`, and ties share it.
        .order_by('-xp', 'id')[:BOARD_SIZE]
    )

    # The serializer decides what a row may contain. It is deliberately three
    # fields on a platform for 10-to-18-year-olds; read its docstring before
    # adding a fourth.
    rows = LeaderboardEntrySerializer(profiles, many=True).data

    board = []
    rank = 0
    previous_xp = None
    for position, (profile, row) in enumerate(zip(profiles, rows), start=1):
        if profile.xp != previous_xp:
            # Exact rather than approximate: this page starts at first place, so
            # the number of players ahead of a row is the number of rows above
            # it, and no second query is needed to find it out.
            rank = position
            previous_xp = profile.xp
        board.append((profile.id, {'rank': rank, **row}))

    return {'board': board, 'total_players': player_count()}


def cached_board():
    """The board as served: built at most once per `BOARD_TTL_SECONDS`."""
    payload = cache.get(_CACHE_KEY)
    if payload is None:
        payload = build_board()
        cache.set(_CACHE_KEY, payload, BOARD_TTL_SECONDS)
    return payload
