from datetime import date

from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.permissions import AdminWriteOrReadOnly
from apps.space.services import UpstreamUnavailable

from . import anniversaries, telegram
from .models import NewsArticle
from .serializers import NewsArticleSerializer, NewsArticleWriteSerializer


class NewsArticleViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminWriteOrReadOnly]

    def get_queryset(self):
        qs = NewsArticle.objects.all()
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            qs = qs.filter(is_published=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__iexact=category)
        return qs

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return NewsArticleWriteSerializer
        return NewsArticleSerializer


class PublicNewsView(APIView):
    """Open, with authentication switched off rather than merely permitted.

    Same reasoning as ``apps.space.views.SpaceView``: the front end attaches
    its JWT to every request, and an expired token must not turn the News page
    into a 401 for a child who left the tab open overnight.
    """
    permission_classes = [AllowAny]
    authentication_classes = []


def _exists_in_year(year, month, day):
    try:
        date(year, month, day)
    except ValueError:
        return False
    return True


class DayQuerySerializer(serializers.Serializer):
    """``?month=&day=``, both optional, both bounded.

    A serializer rather than ``int()`` — rule C-4. Out-of-range and
    non-numeric input is a 400 with a message, never a 500. The pair is
    checked against a real calendar too, so 31 February is refused rather than
    answering "nothing happened on that day", which would be a claim about a
    day that does not exist.
    """
    month = serializers.IntegerField(min_value=1, max_value=12, required=False)
    day = serializers.IntegerField(min_value=1, max_value=31, required=False)

    def validate(self, attrs):
        if ('month' in attrs) != ('day' in attrs):
            raise serializers.ValidationError('month and day must be given together')
        if 'month' in attrs and not anniversaries.is_real_day(attrs['month'], attrs['day']):
            raise serializers.ValidationError('that day does not fall in that month')
        return attrs


def _day_ref(day):
    return None if day is None else {'month': day[0], 'day': day[1]}


class OnThisDayView(PublicNewsView):
    """What happened on this day in space history.

    The default day is ``timezone.localdate()``, never the server's date. The
    server runs on UTC and ``TIME_ZONE`` is Asia/Tashkent, so a child opening
    the page at nine in the evening would otherwise be shown yesterday's
    anniversaries — the same five-hour hole that was breaking streaks before
    the second audit pass.

    A day nobody has written yet answers with an empty ``entries`` list and
    the neighbouring written days, and the page says so. It never falls back
    to another day's events: under a heading reading "today", an event from
    the 27th is a false claim about the 28th.
    """

    def get(self, request):
        query = DayQuerySerializer(data=request.query_params)
        if not query.is_valid():
            return Response(query.errors, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        month = query.validated_data.get('month', today.month)
        day = query.validated_data.get('day', today.day)
        previous, following = anniversaries.neighbours(month, day)

        response = Response({
            'month': month,
            'day': day,
            'is_today': (month, day) == (today.month, today.day),
            # A date in the year we are actually in, so the page can print
            # "28 August" in the reader's language without inventing a year.
            # None on 29 February in a common year — there is no such date to
            # hand out, and the page has the month and day regardless.
            'date': date(today.year, month, day).isoformat()
            if _exists_in_year(today.year, month, day) else None,
            'entries': anniversaries.for_day(month, day, today),
            'previous': _day_ref(previous),
            'next': _day_ref(following),
            'coverage': anniversaries.coverage(),
        })
        # Short: this changes at local midnight and a classroom should share
        # one copy of it, but nobody should be shown yesterday for long.
        response['Cache-Control'] = 'public, max-age=600'
        return response


class TelegramView(PublicNewsView):
    """The Uzcosmos channel, fetched by us and served from our own origin.

    503 when we cannot reach it and have no copy — see ``telegram.py``. The
    page then says the channel could not be reached and offers the link, which
    is the honest shape; an empty list would say the agency has posted nothing.
    """

    def get(self, request):
        try:
            got = telegram.channel_posts()
        except UpstreamUnavailable:
            response = Response(
                {'detail': 'channel unavailable', 'channel_url': telegram.CHANNEL_URL},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
            response['Cache-Control'] = 'no-store'
            return response

        response = Response({
            'channel': telegram.CHANNEL,
            'channel_url': telegram.CHANNEL_URL,
            'fetched_at': got.fetched_at,
            'stale': got.stale,
            'posts': got.value,
        })
        response['Cache-Control'] = 'public, max-age=300'
        return response
