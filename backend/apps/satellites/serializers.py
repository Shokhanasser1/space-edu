from rest_framework import serializers

from .models import TrackedSatellite


class TrackedSatelliteSerializer(serializers.ModelSerializer):
    """What the Live page is allowed to know about a satellite.

    The field list is pinned by a test. Ticket cbc4c6e was the leaderboard
    rendering blanks for a week because the API had quietly stopped sending
    fields the client still read, and the same mistake here would put
    "Unknown" against every row on a page whose entire point is that the
    things on it are true. Add fields freely; rename or remove one only
    together with the client code that reads it.
    """

    is_trackable = serializers.BooleanField(read_only=True)

    class Meta:
        model = TrackedSatellite
        fields = (
            'slug', 'catalog_name', 'norad_id', 'is_trackable',
            'name_en', 'name_uz', 'name_ru',
            'description_en', 'description_uz', 'description_ru',
            'mission_type', 'operator', 'country',
            'launch_date', 'launch_site', 'launch_vehicle',
            'source_url', 'source_name', 'is_featured',
        )
