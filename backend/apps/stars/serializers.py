from rest_framework import serializers
from .models import Star

class StarSerializer(serializers.ModelSerializer):
    class Meta:
        model = Star
        fields = ['id', 'hip_id', 'name', 'constellation', 'ra', 'dec', 'magnitude', 'distance', 'spectral_type', 'story', 'image_url']
