"""Read-only, unauthenticated endpoints in front of ``services``.

No authentication at all, not just AllowAny: the frontend attaches its JWT to
every request, and an expired token must not turn an orbit view into a 401.
The ``Cache-Control`` header is there so thirty browsers in one classroom
share the school proxy's copy instead of each asking us; the numbers are
shorter than the server-side TTLs so a refreshed copy reaches them within
minutes.
"""
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .services import UpstreamUnavailable


def _bad_request(detail):
    return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)


def _respond(max_age, build):
    try:
        payload = build()
    except UpstreamUnavailable:
        resp = Response(
            {'detail': 'upstream unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
        resp['Cache-Control'] = 'no-store'
        return resp
    resp = Response(payload)
    resp['Cache-Control'] = f'public, max-age={max_age}'
    return resp


def _int_param(request, name, default, low, high):
    """Parse ``?name=`` as an int in [low, high]; returns (value, error)."""
    raw = request.query_params.get(name)
    if raw is None or raw == '':
        return default, None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, f'{name} must be an integer'
    if not low <= value <= high:
        return None, f'{name} must be between {low} and {high}'
    return value, None


class SpaceView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []


class GpView(SpaceView):
    def get(self, request):
        group = request.query_params.get('group', '')
        if group not in services.GP_GROUPS:
            return _bad_request('group must be one of: ' + ', '.join(sorted(services.GP_GROUPS)))
        limit, error = _int_param(request, 'limit', None, 1, services.GP_MAX_LIMIT)
        if error:
            return _bad_request(error)

        def build():
            got = services.gp(group)
            satellites = got.value if limit is None else got.value[:limit]
            return {
                'group': group,
                'fetched_at': got.fetched_at,
                'stale': got.stale,
                'count': len(satellites),
                'satellites': satellites,
            }

        return _respond(300, build)


class EphemerisView(SpaceView):
    def get(self, request):
        body = request.query_params.get('body', '')
        if body not in services.HORIZONS_BODIES:
            return _bad_request('body must be one of: ' + ', '.join(services.HORIZONS_BODIES))
        days, error = _int_param(
            request, 'days', services.EPHEMERIS_DEFAULT_DAYS, 1, services.EPHEMERIS_MAX_DAYS
        )
        if error:
            return _bad_request(error)

        def build():
            got = services.ephemeris(body, days)
            return {
                'body': body,
                'name': services.HORIZONS_BODIES[body],
                'frame': 'heliocentric ecliptic J2000',
                'units': {'position': 'au', 'time': 'jd'},
                'fetched_at': got.fetched_at,
                'stale': got.stale,
                'samples': got.value,
            }

        return _respond(3600, build)


class LaunchesView(SpaceView):
    def get(self, request):
        def build():
            got = services.launches()
            return {'fetched_at': got.fetched_at, 'stale': got.stale, 'data': got.value}

        return _respond(300, build)


class ApodView(SpaceView):
    def get(self, request):
        def build():
            got = services.apod()
            return {'fetched_at': got.fetched_at, 'stale': got.stale, 'data': got.value}

        return _respond(3600, build)
