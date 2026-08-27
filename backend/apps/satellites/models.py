from django.db import models


class TrackedSatellite(models.Model):
    """A satellite the Live page introduces by name, with sourced mission facts.

    This is deliberately **not** where orbital elements live. `apps.space`
    fetches those from CelesTrak, caches them and serves them from
    `/space/gp/`, and the page joins the two on `norad_id`. Storing a TLE here
    as well would mean two copies with different ages and no way to tell which
    one the page drew.

    What this holds is the part CelesTrak does not: what the thing is for, who
    built it, and where we read that. Every populated field on every row traces
    to `source_url`.

    A row with `norad_id = None` is the case this app was written for. A
    satellite can be confirmed in orbit by its own government and still have no
    published element set — Samarkand-2028 is exactly that — and the honest
    rendering is its mission facts with no dot on the globe. Blank fields are
    shown as a translated "not announced yet", which is a true statement about
    what has been published; hiding them would imply there was nothing to know.
    """

    MISSION_TYPES = [
        ('station',       'Crewed station'),
        ('earth_obs',     'Earth observation'),
        ('weather',       'Weather'),
        ('science',       'Science'),
        ('navigation',    'Navigation'),
        ('communication', 'Communication'),
    ]

    slug = models.SlugField(max_length=60, unique=True)

    # The catalogue name, e.g. "ISS (ZARYA)" — what `/space/gp/` calls it, so a
    # human can see why a row did or did not match. Not translated: it is an
    # identifier, not prose.
    catalog_name = models.CharField(max_length=100)

    # Null until somebody publishes one. Unique so two rows cannot claim the
    # same object; null rows do not collide in either SQLite or PostgreSQL, so
    # any number of un-catalogued satellites can sit alongside each other.
    norad_id = models.PositiveIntegerField(
        null=True, blank=True, unique=True,
        help_text='Leave empty until a catalogue number is actually published. '
                  'The page joins to the live element feed on this.')

    name_en = models.CharField(max_length=120)
    name_uz = models.CharField(max_length=120)
    name_ru = models.CharField(max_length=120)
    description_en = models.TextField(blank=True)
    description_uz = models.TextField(blank=True)
    description_ru = models.TextField(blank=True)

    mission_type = models.CharField(max_length=20, choices=MISSION_TYPES)
    operator = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=80, blank=True)

    # Each of these may be blank, and blank means "no source has published it"
    # — never zero, never a guess.
    launch_date = models.DateField(null=True, blank=True)
    launch_site = models.CharField(max_length=160, blank=True)
    launch_vehicle = models.CharField(max_length=120, blank=True)

    # Where the facts above came from, shown on the card as a link so a curious
    # child — or the next developer — can check the claim.
    source_url = models.URLField(blank=True)
    source_name = models.CharField(max_length=120, blank=True)

    is_featured = models.BooleanField(
        default=False, help_text='Pinned to the top of the Live page list')

    class Meta:
        ordering = ['-is_featured', 'catalog_name']
        verbose_name = 'Tracked satellite'
        indexes = [
            models.Index(fields=['-is_featured', 'catalog_name'],
                         name='sat_featured_name_idx'),
        ]

    def __str__(self):
        return f'{self.catalog_name} ({self.norad_id or "no catalogue number"})'

    @property
    def is_trackable(self):
        """Whether the page can expect to find this in the live element feed."""
        return self.norad_id is not None
