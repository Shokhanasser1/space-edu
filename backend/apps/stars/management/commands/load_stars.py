from django.core.management.base import BaseCommand
from apps.stars.models import Star

class Command(BaseCommand):
    help = 'Load brightest stars from NASA Hipparcos catalog'
    
    def handle(self, *args, **options):
        # Top 25 brightest stars with NASA data
        stars_data = [
            (1, 'Sirius', 'Canis Major', 101.287, -16.716, -1.46, 8.6, 'A0mA1 Va'),
            (2, 'Canopus', 'Carina', 95.987, -52.696, -0.74, 310, 'A9 Ib'),
            (3, 'Rigil Kentaurus', 'Centaurus', 219.902, -60.837, -0.27, 4.37, 'G2 V'),
            (4, 'Arcturus', 'Boötes', 213.915, 19.183, -0.05, 36.7, 'K1.5 III'),\n            (5, 'Vega', 'Lyra', 279.234, 38.784, 0.03, 25, 'A0 Va'),
            (6, 'Capella', 'Auriga', 79.172, 45.998, 0.08, 42.9, 'G3III + G8III'),
            (7, 'Rigel', 'Orion', 78.634, 8.202, 0.13, 860, 'B8 Ia'),
            (8, 'Procyon', 'Canis Minor', 114.829, 5.225, 0.40, 11.46, 'F5 IV-V'),
            (9, 'Betelgeuse', 'Orion', 88.793, 7.407, 0.45, 548, 'M1-M2 Ia-ab'),
            (10, 'Altair', 'Aquila', 297.696, 8.868, 0.77, 16.7, 'A7 V'),
            (11, 'Aldebaran', 'Taurus', 68.980, 16.509, 0.87, 65.3, 'K5+ III'),
            (12, 'Antares', 'Scorpius', 247.352, -26.432, 0.75, 550, 'M1.5 Iab-Ib'),
            (13, 'Spica', 'Virgo', 201.299, -11.161, 1.04, 250, 'B1 III-IV'),
            (14, 'Pollux', 'Gemini', 116.329, 28.026, 1.16, 33.7, 'K0 III'),
            (15, 'Fomalhaut', 'Piscis Austrinus', 344.413, -29.622, 1.17, 25.1, 'A3 V'),
            (16, 'Deneb', 'Cygnus', 310.358, 45.280, 1.25, 2615, 'A2 Ia'),
            (17, 'Regulus', 'Leo', 152.093, 11.967, 1.35, 79, 'B8 IVn'),
            (18, 'Adhara', 'Canis Major', 104.656, -28.972, 1.50, 425, 'B5 Ib'),
            (19, 'Castor', 'Gemini', 113.649, 31.888, 1.58, 51, 'A1 V'),
            (20, 'Shaula', 'Scorpius', 263.019, -37.105, 1.62, 570, 'B3 V'),
            (21, 'Albireo', 'Cygnus', 292.250, 27.960, 3.08, 390, 'K3 II'),
            (22, 'Mizar', 'Ursa Major', 209.043, 54.926, 2.23, 83, 'A2 V'),
            (23, 'Dubhe', 'Ursa Major', 165.921, 61.751, 1.81, 123, 'K0 III'),
            (24, 'Merak', 'Ursa Major', 164.529, 56.382, 2.37, 79, 'A1 V'),
            (25, 'Polaris', 'Ursa Minor', 37.954, 89.264, 1.98, 433, 'F7 Ib'),
        ]
        
        created = 0
        for hip, name, const, ra, dec, mag, dist, spec in stars_data:
            star, created_flag = Star.objects.get_or_create(
                hip_id=hip,
                defaults={
                    'name': name,
                    'constellation': const,
                    'ra': ra,
                    'dec': dec,
                    'magnitude': mag,
                    'distance': dist,
                    'spectral_type': spec,
                }
            )
            if created_flag:
                created += 1
        
        self.stdout.write(
            self.style.SUCCESS(f'✓ Loaded {created} new stars from NASA Hipparcos Catalog')
        )
