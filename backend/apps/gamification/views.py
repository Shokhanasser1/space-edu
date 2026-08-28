
from django.db.models import Avg, Count, Max, Sum
from django.utils.cache import patch_vary_headers
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .full_profile import FullProfileView
from django.db import transaction
from rest_framework.permissions import IsAuthenticated

from .leaderboard import (
    BOARD_SIZE, BOARD_TTL_SECONDS, MIN_QUIZZES_RANKED,
    assign_ranks, cached_board, rank_for_xp,
)
from .models import Badge, UserBadge, UserGamificationProfile, RewardProduct, UserRewardPurchase
from .serializers import (
    BadgeSerializer,
    GamificationProfileSerializer,
    RewardProductSerializer,
    UserBadgeSerializer,
    UserRewardPurchaseSerializer,
)


class GamificationProfileView(generics.RetrieveAPIView):
    serializer_class = GamificationProfileSerializer

    def get_object(self):
        profile, _ = UserGamificationProfile.objects.get_or_create(user=self.request.user)
        return profile


class LeaderboardView(APIView):
    """GET /gamification/leaderboard/ — the public XP board, and your place on it.

    The board is the same for everybody, so it is built once every
    `BOARD_TTL_SECONDS` and served from the cache to every caller in between;
    the two numbers that are yours alone — your place and your XP — are read per
    request, from indexed counts. That is what makes a table refreshed by
    polling affordable with ten thousand children on it: the poll rate decides
    how much serialising the web workers do, not how much work the database
    does.

    Every place printed here comes from `rank_for_xp`, which the profile page
    calls too. It used to be the row's position in the list, which is a
    different number as soon as two players are level.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        page = cached_board()

        # `request.user.gamification` raises when the row is missing, which the
        # view used to answer with `except Exception: pass` — banned by C-10,
        # and it left the caller unable to tell "not ranked yet" from "the
        # server broke". Ask a question that has an answer.
        profile = None
        if request.user.is_authenticated:
            profile = UserGamificationProfile.objects.filter(user=request.user).first()
        my_id = profile.id if profile else None

        payload = {
            # `is_you` is added here rather than baked into the cached row: the
            # rows are shared by every caller and this one field is not.
            'leaderboard': [
                {**row, 'is_you': profile_id == my_id}
                for profile_id, row in page['board']
            ],
            'total_players': page['total_players'],
            'board_size': BOARD_SIZE,
            # The refresh interval is the server's to set — it is the cache
            # window, and it is what the polling costs. Sending it means it can
            # be turned down under load without shipping a new front end.
            'poll_after_seconds': BOARD_TTL_SECONDS,
        }

        if request.user.is_authenticated:
            payload['my_rank'] = rank_for_xp(profile.xp) if profile else None
            payload['my_xp'] = profile.xp if profile else 0
            payload['my_level'] = profile.level if profile else 1

        response = Response(payload)
        if request.user.is_authenticated:
            # Carries this child's own place. Not for a shared cache, and not
            # for the disk either.
            response['Cache-Control'] = 'private, no-store'
        else:
            # The anonymous board is public and already stale by up to the cache
            # window, so a proxy holding it for the same window costs nothing in
            # freshness and takes the poll traffic off the application entirely.
            response['Cache-Control'] = f'public, max-age={BOARD_TTL_SECONDS}'
        patch_vary_headers(response, ('Authorization',))
        return response


#
# REMOVED: GamificationGrantView (POST /gamification/grant/).
#
# It accepted arbitrary `xp` and `fuel` from the client with no check that the
# user had done anything to earn them — one request produced level 101 and
# enough currency to buy out the store. There is no safe way to validate this
# endpoint, because the client is not a trustworthy source for "how much did
# this person earn"; the whole shape is wrong.
#
# Rewards are now issued only by the server, at the point where it can see the
# work: LessonCompleteView, QuizSubmitView, SubmitChallengeView, StreakUpdateView
# and MissionClaimView. A client reports *what happened* ("finished lesson X",
# "answered question Y with Z") and the server decides what it is worth.
#


class UserBadgesView(generics.ListAPIView):
    serializer_class = UserBadgeSerializer
    pagination_class = None

    def get_queryset(self):
        return UserBadge.objects.filter(user=self.request.user).select_related('badge')


class AllBadgesView(generics.ListAPIView):
    """Endpoint to return ALL available badges"""
    serializer_class = BadgeSerializer
    pagination_class = None
    queryset = Badge.objects.all()


class StreakUpdateView(APIView):
    """POST /gamification/streak/ — claim today's streak and its bonus.

    The decision and the write happen inside one row lock; see
    `UserGamificationProfile.claim_daily_streak`.
    """

    def post(self, request):
        profile, _ = UserGamificationProfile.objects.get_or_create(user=request.user)
        streak, fuel_bonus = profile.claim_daily_streak()
        return Response({
            'streak': streak,
            'updated': bool(fuel_bonus),
            'fuel_bonus': fuel_bonus,
        })


class QuizLeaderboardView(APIView):
    """GET /gamification/leaderboard/quiz/ — the board ranked on accuracy.

    The XP board rewards how much a child has done; this one rewards how well,
    which is the number a platform that exists to teach should be able to show.
    It is worth having only if it is honest, and it was not: it ranked on
    `Avg('percentage')` with nothing under it, so one lucky quiz at 100% stood
    above fifty at 96, and the child who had done the work was told they were
    second. `MIN_QUIZZES_RANKED` is the floor and `leaderboard.py` argues it.

    Everything else here is `leaderboard.py`'s rule rather than this view's own:
    the same competition ranking (`assign_ranks`), the same board length
    (`BOARD_SIZE`, it was 50 for no reason), ties sharing a place, and a stable
    order under them. Two boards on one platform that place the same tied
    children differently is exactly what that module was written to stop.

    `AllowAny`, like the XP board, and it publishes the same single field about
    a child — the handle they chose. See `LeaderboardEntrySerializer` for why
    that list is three fields long and not five (C-11).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        from apps.challenges.models import QuizSession

        category = request.query_params.get('category')

        qs = QuizSession.objects.filter(is_completed=True, user__isnull=False)
        if category:
            qs = qs.filter(category=category)

        # Was Sum('percentage') / Count('id') labelled `best_pct`: that is a mean,
        # not a best, and on PostgreSQL integer division truncated it. Also stop
        # publishing usernames here — see LeaderboardEntrySerializer.
        #
        # The floor is applied after the annotation and inside the same category
        # filter, so "five quizzes" means five of the quizzes being ranked. A
        # count taken across every category would put a child on the physics
        # board for astronomy practice.
        leaders = (
            qs.values('user__id', 'user__username', 'user__astronaut_name')
            .annotate(
                avg_pct=Avg('percentage'),
                best_pct=Max('percentage'),
                total_quizzes=Count('id'),
                total_xp=Sum('xp_earned'),
            )
            .filter(total_quizzes__gte=MIN_QUIZZES_RANKED)
            # `user__id` under the average for the same reason the XP board
            # orders by `id` under `-xp`: it is not meaningful, only stable, and
            # without it two equal children swap places between two requests.
            .order_by('-avg_pct', 'user__id')
        )

        my_id = request.user.id if request.user.is_authenticated else None
        rows = [
            {
                'display_name': (entry['user__astronaut_name'] or '').strip()
                or entry['user__username'],
                'avg_percentage': round(entry['avg_pct'] or 0, 1),
                'best_percentage': round(entry['best_pct'] or 0, 1),
                'total_quizzes': entry['total_quizzes'],
                'total_xp': entry['total_xp'] or 0,
                'is_you': entry['user__id'] == my_id,
            }
            for entry in leaders[:BOARD_SIZE]
        ]

        return Response({
            'category': category or 'all',
            'leaderboard': [
                {'rank': rank, **row}
                # Ranked on the figure the row prints, not the float behind it:
                # see `assign_ranks`.
                for rank, row in assign_ranks(rows, lambda r: r['avg_percentage'])
            ],
            # Everybody who has taken enough quizzes to be ranked, not everybody
            # who has taken one — the same distinction `player_queryset()` draws
            # between a sign-up and a player.
            'total_players': leaders.count(),
            'board_size': BOARD_SIZE,
            # A child who is not on this board is owed the reason as a number
            # they can act on, not a blank page.
            'min_quizzes': MIN_QUIZZES_RANKED,
        })


# ──────────────────────────────────────────────────────────────────────────────
#  REWARDS STORE
# ──────────────────────────────────────────────────────────────────────────────
class RewardProductListView(generics.ListAPIView):
    """Public: list all active reward products."""
    serializer_class = RewardProductSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = RewardProduct.objects.filter(is_active=True)
        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)
        return qs


class UserRewardPurchaseListView(generics.ListAPIView):
    """List rewards purchased by the current user."""
    serializer_class = UserRewardPurchaseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return UserRewardPurchase.objects.filter(user=self.request.user).select_related('product')


class RewardPurchaseView(APIView):
    """Purchase a reward product — deducts fuel from gamification profile."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        slug = request.data.get('slug')
        if not slug:
            return Response({'detail': 'Product slug is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = RewardProduct.objects.get(slug=slug, is_active=True)
        except RewardProduct.DoesNotExist:
            return Response({'detail': 'Product not found.'}, status=status.HTTP_404_NOT_FOUND)

        if UserRewardPurchase.objects.filter(user=request.user, product=product).exists():
            return Response({'detail': 'You already own this reward.'}, status=status.HTTP_400_BAD_REQUEST)

        profile, _ = UserGamificationProfile.objects.get_or_create(user=request.user)

        # spend_fuel() re-reads the balance under a row lock and returns False if
        # it is short. Checking first and debiting afterwards let two concurrent
        # purchases of different products both pass on the same balance.
        with transaction.atomic():
            if not profile.spend_fuel(product.cost):
                return Response(
                    {'detail': f'Not enough coins. Need {product.cost}, have {profile.fuel}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            purchase = UserRewardPurchase.objects.create(user=request.user, product=product)

        return Response({
            'purchase': UserRewardPurchaseSerializer(purchase).data,
            'fuel': profile.fuel,
        }, status=status.HTTP_201_CREATED)


def mission_progress(user, mission):
    """How far this user has actually got on this mission.

    The claim endpoint used to pay out without consulting this at all, so a
    mission reading "Complete 5 lessons" handed over its reward to somebody who
    had completed none.
    """
    from apps.market.models import UserInventory
    from apps.progress.models import UserLessonProgress

    if mission.mission_type == 'streak':
        profile, _ = UserGamificationProfile.objects.get_or_create(user=user)
        # The run as it stands today, not the stored column: "three days
        # running" was claimable four days after the run ended, because nothing
        # lowers that column on a day nobody plays.
        return profile.live_streak
    if mission.mission_type == 'lesson':
        return UserLessonProgress.objects.filter(user=user).count()
    if mission.mission_type == 'mastery':
        return UserLessonProgress.objects.filter(user=user, is_mastered=True).count()
    if mission.mission_type == 'inventory':
        return UserInventory.objects.filter(user=user).count()
    # 'custom' has no machine-checkable definition, so it cannot be self-claimed.
    return None


class MissionClaimView(APIView):
    """Claim a mission reward, once the mission has actually been completed."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.utils import timezone

        from .models import Mission, UserMission

        mission_id = request.data.get('mission_id')
        if not mission_id:
            return Response({'detail': 'mission_id is required.'}, status=400)

        try:
            mission = Mission.objects.get(id=int(mission_id), is_active=True)
        except (Mission.DoesNotExist, TypeError, ValueError):
            return Response({'detail': 'Mission not found.'}, status=404)

        progress = mission_progress(request.user, mission)
        if progress is None:
            return Response(
                {'detail': 'This mission is awarded by a mentor, not self-claimed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if progress < mission.target_value:
            return Response(
                {
                    'detail': 'Mission not completed yet.',
                    'progress': progress,
                    'target': mission.target_value,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.localdate()
        with transaction.atomic():
            user_mission, _ = UserMission.objects.select_for_update().get_or_create(
                user=request.user, mission=mission
            )
            if mission.is_daily:
                if user_mission.last_claimed_date == today:
                    return Response({'detail': 'Already claimed today.'}, status=400)
                user_mission.last_claimed_date = today
                user_mission.is_completed = True
            else:
                if user_mission.is_completed:
                    return Response({'detail': 'Already claimed.'}, status=400)
                user_mission.is_completed = True
            user_mission.save()

        profile, _ = UserGamificationProfile.objects.get_or_create(user=request.user)
        profile.add_xp(mission.reward_xp)
        profile.add_fuel(mission.reward_fuel)

        return Response({
            'success': True,
            'xp_earned': mission.reward_xp,
            'fuel_earned': mission.reward_fuel,
            'current_xp': profile.xp,
            'current_fuel': profile.fuel,
        })
