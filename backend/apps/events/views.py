from rest_framework import viewsets
from rest_framework.exceptions import ValidationError

from apps.permissions import AdminWriteOrReadOnly

from .models import SpaceEvent
from .serializers import SpaceEventSerializer, SpaceEventWriteSerializer


class SpaceEventViewSet(viewsets.ModelViewSet):
    permission_classes = [AdminWriteOrReadOnly]

    def get_queryset(self):
        qs = SpaceEvent.objects.all()
        event_type = self.request.query_params.get('type')
        if event_type:
            qs = qs.filter(event_type=event_type)
        year = self.request.query_params.get('year')
        if year:
            # Straight into the filter, `abc` raised ValueError and `99999` an
            # out-of-range date: a 500 for anybody, signed in or not.
            if not year.isdigit() or not 1 <= int(year) <= 9999:
                raise ValidationError({'year': 'Expected a year, such as 1961.'})
            qs = qs.filter(event_date__year=int(year))
        featured = self.request.query_params.get('featured')
        if featured == 'true':
            qs = qs.filter(is_featured=True)
        historical = self.request.query_params.get('historical')
        if historical == 'true':
            qs = qs.filter(is_historical=True)
        return qs

    def get_serializer_class(self):
        if self.request.method in ('POST', 'PUT', 'PATCH'):
            return SpaceEventWriteSerializer
        return SpaceEventSerializer
