from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import TrackedSatellite
from .serializers import TrackedSatelliteSerializer


class TrackedSatelliteViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only, and unauthenticated on purpose.

    No authentication class at all rather than `AllowAny`, matching
    `apps.space`: the frontend attaches its JWT to every request, and an
    expired token must not turn the satellite list into a 401 on a page that
    does not require an account. Nothing here belongs to a child — it is the
    published description of a public spacecraft.

    Rows are written by `seed_satellites` and edited in the admin panel; there
    is no write path through the API.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = TrackedSatelliteSerializer
    lookup_field = 'slug'
    # A bare array, like the rest of this API's list endpoints. The set is a
    # curated dozen, not a catalogue of thousands, so there is nothing to
    # page; turning the project default on here would silently empty the
    # client's `.map()`, which is how the admin dashboard's tables once went
    # blank.
    pagination_class = None

    def get_queryset(self):
        qs = TrackedSatellite.objects.all()
        mission_type = self.request.query_params.get('type')
        if mission_type:
            qs = qs.filter(mission_type=mission_type)
        return qs
