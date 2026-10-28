"""Space events: the list the calendar reads."""
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import SpaceEvent


def _event(slug_day, **over):
    fields = dict(
        title_en=f'E{slug_day}', title_uz=f'E{slug_day}', title_ru=f'E{slug_day}',
        description_en='d', description_uz='d', description_ru='d',
        event_date=timezone.localdate() + timezone.timedelta(days=slug_day),
        event_type=SpaceEvent.EVENT_TYPES[0][0],
    )
    fields.update(over)
    return SpaceEvent.objects.create(**fields)


class UpcomingEventsTests(TestCase):
    """Audit, 28 October 2026: the calendar read page one of /events/, which
    is twenty rows oldest first, and kept the upcoming ones -- so once the
    table held more than twenty past events the calendar showed nothing to
    come. `?upcoming=true` asks for exactly what it shows."""

    def test_only_events_still_to_come_nearest_first(self):
        for day in range(-30, 0):
            _event(day)
        _event(5)
        _event(1)
        _event(3, is_historical=True)

        rows = APIClient().get('/api/v1/events/?upcoming=true').data
        rows = rows['results'] if isinstance(rows, dict) else rows

        self.assertEqual([r['title_en'] for r in rows], ['E1', 'E5'])
