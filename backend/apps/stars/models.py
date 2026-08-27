from django.db import models

class Star(models.Model):
    """NASA Hipparcos Catalog Stars"""
    hip_id = models.IntegerField(unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, db_index=True)
    constellation = models.CharField(max_length=100, db_index=True)
    
    # Celestial coordinates (degrees)
    ra = models.FloatField()  # Right Ascension
    dec = models.FloatField()  # Declination
    
    # Physical properties
    magnitude = models.FloatField()  # Apparent brightness
    distance = models.FloatField(null=True, blank=True)  # Light years
    spectral_type = models.CharField(max_length=50, blank=True)
    
    # Metadata
    story = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['magnitude']
        indexes = [
            models.Index(fields=['ra', 'dec']),
            models.Index(fields=['constellation']),
            models.Index(fields=['magnitude']),
        ]
        verbose_name_plural = "Stars"
    
    def __str__(self):
        return f"{self.name} ({self.constellation})" if self.name else f"HIP {self.hip_id}"
