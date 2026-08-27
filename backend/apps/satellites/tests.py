"""A satellite can be real, in orbit, and still have no orbit we can draw.

Samarkand-2028 is that case. Uzbekistan's Ministry of Digital Technologies
announced it, four independent outlets reported the 5 August 2026 launch, and
it sent back a picture of Athens within hours — and CelesTrak has no element
set for it under any of the names it might carry. The three objects catalogued
from that launch are unnamed and attributed to the PRC, so none of them can be
claimed as this satellite.

The temptation in that situation is to put *something* in the orbit fields so
the card looks finished. These tests exist to make that fail loudly. A
fabricated element set does not read as missing data to a child; it reads as a
satellite, moving, in the wrong place, on a page we told them to trust.
"""
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.satellites.models import TrackedSatellite


class SeedTests(TestCase):
    def setUp(self):
        call_command('seed_satellites', verbosity=0)

    def test_samarkand_2028_exists(self):
        sat = TrackedSatellite.objects.get(slug='samarkand-2028')
        self.assertEqual(sat.name_uz, 'Samarqand-2028')
        self.assertEqual(sat.name_ru, 'Самарканд-2028')

    def test_samarkand_2028_has_no_invented_catalogue_number(self):
        """The one that matters. No published NORAD id means none stored, and
        `is_trackable` false, so the page draws no dot rather than a wrong one."""
        sat = TrackedSatellite.objects.get(slug='samarkand-2028')
        self.assertIsNone(sat.norad_id)
        self.assertFalse(sat.is_trackable)

    def test_samarkand_2028_keeps_the_facts_that_were_published(self):
        """Not knowing the orbit is not a reason to know nothing. The launch
        date, the partners and the country are all on the record."""
        sat = TrackedSatellite.objects.get(slug='samarkand-2028')
        self.assertEqual(str(sat.launch_date), '2026-08-05')
        self.assertIn('STAR.VISION', sat.operator)
        self.assertIn('Uzbekcosmos', sat.operator)
        self.assertEqual(sat.country, 'Uzbekistan')
        self.assertTrue(sat.source_url.startswith('https://gov.uz/'))

    def test_samarkand_2028_leaves_the_unpublished_fields_empty(self):
        """No Uzbek source names the launch vehicle. Gunter's Space Page and
        NASASpaceflight both record a Jielong-3 Y12 carrying two "Oriental
        Smart Eye" satellites that day, which is very probably this launch, but
        neither names Samarkand-2028 — so it is inference, and inference does
        not go on the page. An empty field renders as "not announced yet"."""
        sat = TrackedSatellite.objects.get(slug='samarkand-2028')
        self.assertEqual(sat.launch_vehicle, '')

    def test_every_seeded_satellite_is_described_in_three_languages(self):
        for sat in TrackedSatellite.objects.all():
            with self.subTest(satellite=sat.slug):
                for field in ('name_en', 'name_uz', 'name_ru',
                              'description_en', 'description_uz', 'description_ru'):
                    self.assertTrue(getattr(sat, field).strip(),
                                    f'{sat.slug}.{field} is empty')

    def test_every_seeded_satellite_names_where_its_facts_came_from(self):
        for sat in TrackedSatellite.objects.all():
            with self.subTest(satellite=sat.slug):
                self.assertTrue(sat.source_url, f'{sat.slug} cites no source')
                self.assertTrue(sat.source_name, f'{sat.slug} names no source')

    def test_seeding_twice_updates_rather_than_duplicates(self):
        before = TrackedSatellite.objects.count()
        call_command('seed_satellites', verbosity=0)
        self.assertEqual(TrackedSatellite.objects.count(), before)


class SatelliteApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        call_command('seed_satellites', verbosity=0)

    def test_anonymous_readers_can_list_them(self):
        """The Live page does not require an account, and an expired token must
        not turn the satellite list into a 401 — same reasoning as apps.space."""
        response = self.client.get(reverse('satellite-list'))
        self.assertEqual(response.status_code, 200)

    def test_the_response_shape_is_what_the_page_reads(self):
        """cbc4c6e was the leaderboard reading fields the API had stopped
        sending. These are the names the Live page reads; renaming one means
        changing the page in the same commit."""
        response = self.client.get(reverse('satellite-list'))
        row = next(r for r in response.data if r['slug'] == 'samarkand-2028')
        for field in ('slug', 'catalog_name', 'norad_id', 'is_trackable',
                      'name_en', 'name_uz', 'name_ru',
                      'description_en', 'description_uz', 'description_ru',
                      'mission_type', 'operator', 'country',
                      'launch_date', 'launch_site', 'launch_vehicle',
                      'source_url', 'source_name', 'is_featured'):
            self.assertIn(field, row)

    def test_an_unpublished_field_arrives_as_empty_not_as_a_placeholder(self):
        """The page turns empty into a translated "not announced yet". If the
        API ever sent the string "Unknown" instead, that English word would
        reach a Russian and an Uzbek reader untranslated."""
        response = self.client.get(reverse('satellite-list'))
        row = next(r for r in response.data if r['slug'] == 'samarkand-2028')
        self.assertEqual(row['launch_vehicle'], '')
        self.assertIsNone(row['norad_id'])
        self.assertFalse(row['is_trackable'])

    def test_a_satellite_can_be_fetched_on_its_own(self):
        response = self.client.get(
            reverse('satellite-detail', kwargs={'slug': 'samarkand-2028'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['name_uz'], 'Samarqand-2028')

    def test_the_list_can_be_filtered_by_mission(self):
        response = self.client.get(reverse('satellite-list'), {'type': 'station'})
        slugs = {row['slug'] for row in response.data}
        self.assertIn('iss', slugs)
        self.assertNotIn('samarkand-2028', slugs)

    def test_the_list_is_a_bare_array(self):
        """Two contracts the admin panel already depends on, and the same one
        here: turning DRF pagination on would empty every caller's `.map()`."""
        response = self.client.get(reverse('satellite-list'))
        self.assertIsInstance(response.data, list)
