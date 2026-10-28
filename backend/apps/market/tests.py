"""Regression tests for findings from the 2026-08-22 audit."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User

from .models import MarketItem, UserInventory


def _item(slug='ship', cost_fuel=50, **over):
    data = dict(
        slug=slug,
        title_en='Ship', title_uz='Kema', title_ru='Корабль',
        description_en='d', description_uz='d', description_ru='d',
        item_type='spaceship', price=1000, cost_fuel=cost_fuel,
    )
    data.update(over)
    return MarketItem.objects.create(**data)


class QueryParamValidationTests(TestCase):
    """Finding: int()/float() were applied to raw query params with no guard, so
    ?min_price=abc raised ValueError -> 500 on an anonymous request. Under the
    settings-fail-open bug this also rendered Django's debug page with SECRET_KEY."""

    def setUp(self):
        _item()
        self.anon = APIClient()

    def test_non_numeric_min_price_is_a_400_not_a_500(self):
        r = self.anon.get('/api/v1/market/items/?min_price=abc')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_integer_max_fuel_is_a_400_not_a_500(self):
        r = self.anon.get('/api/v1/market/items/?max_fuel=1.5')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_numeric_min_rating_is_a_400_not_a_500(self):
        r = self.anon.get('/api/v1/market/items/?min_rating=xyz')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_out_of_range_price_does_not_500(self):
        r = self.anon.get('/api/v1/market/items/?min_price=99999999999999999999')
        self.assertLess(r.status_code, 500)

    def test_valid_filters_still_work(self):
        r = self.anon.get('/api/v1/market/items/?min_price=10&max_price=5000')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


class ReviewRatingTests(TestCase):
    """Finding: ItemReview.rating was a PositiveSmallIntegerField documented as
    '1-5 stars' with no validator, and the write serializer passed it through, so
    an owner could set the public rating_avg to 32767."""

    def setUp(self):
        self.item = _item()
        # Confirmed: a review is written to other people, and that needs a
        # confirmed address now (ReviewModerationTests).
        self.user = User.objects.create_user(
            username='alice', email='a@e.com', password='x', email_verified_at=timezone.now(),
        )
        UserInventory.objects.create(user=self.user, item=self.item)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _review(self, rating):
        return self.client.post(
            f'/api/v1/market/items/{self.item.slug}/review/', {'rating': rating}, format='json'
        )

    def test_rating_above_five_is_rejected(self):
        self.assertEqual(self._review(32767).status_code, status.HTTP_400_BAD_REQUEST)
        self.item.refresh_from_db()
        self.assertEqual(self.item.rating_avg, 0.0)

    def test_rating_of_zero_is_rejected(self):
        self.assertEqual(self._review(0).status_code, status.HTTP_400_BAD_REQUEST)

    def test_valid_rating_is_accepted_and_cached(self):
        r = self._review(4)
        self.assertIn(r.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.item.refresh_from_db()
        self.assertEqual(self.item.rating_avg, 4.0)
        self.assertEqual(self.item.rating_count, 1)

    def test_deleting_a_review_recomputes_the_cached_rating(self):
        """Finding: rating_avg was only recomputed in save(), so a deleted review
        kept dragging the public average."""
        from .models import ItemReview

        self._review(1)
        ItemReview.objects.filter(user=self.user, item=self.item).delete()
        self.item.refresh_from_db()
        self.assertEqual(self.item.rating_count, 0)
        self.assertEqual(self.item.rating_avg, 0.0)


class PurchaseTests(TestCase):
    """Finding: PurchaseView read the balance outside the lock and incremented
    sold_count with a read-modify-write."""

    def setUp(self):
        self.item = _item(cost_fuel=80)
        self.other = _item(slug='ship2', cost_fuel=80)
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        profile = self.user.gamification
        profile.fuel = 100
        profile.save(update_fields=['fuel'])
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_cannot_overspend_across_two_items(self):
        first = self.client.post(
            '/api/v1/market/purchase/', {'item_slug': 'ship'}, format='json'
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self.client.post(
            '/api/v1/market/purchase/', {'item_slug': 'ship2'}, format='json'
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(UserInventory.objects.filter(user=self.user).count(), 1)

    def test_sold_count_increments(self):
        self.client.post('/api/v1/market/purchase/', {'item_slug': 'ship'}, format='json')
        self.item.refresh_from_db()
        self.assertEqual(self.item.sold_count, 1)


class PurchaseRaceTests(TestCase):
    """Audit, 21 October 2026: two buyers at once.

    The stock check ran on the item as first read, outside any lock, so two
    buyers of the last one both passed it. And a double click passed the
    "already own it" check twice, reached the unique constraint, and answered
    500 -- the transaction rolled back, but the child saw an error.
    """

    def setUp(self):
        self.item = _item(cost_fuel=10, stock=1)
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.user.gamification.fuel = 100
        self.user.gamification.save(update_fields=['fuel'])
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _buy(self):
        return self.client.post('/api/v1/market/purchase/', {'item_slug': 'ship'}, format='json')

    def _fuel(self):
        self.user.gamification.refresh_from_db()
        return self.user.gamification.fuel

    def test_the_last_one_is_not_sold_twice(self):
        from unittest.mock import patch

        stale = MarketItem.objects.get(pk=self.item.pk)  # read before the other buyer
        MarketItem.objects.filter(pk=self.item.pk).update(sold_count=1)  # the other buyer
        with patch.object(MarketItem.objects, 'get', return_value=stale):
            r = self._buy()

        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.item.refresh_from_db()
        self.assertEqual(self.item.sold_count, 1)
        self.assertEqual(self._fuel(), 100)

    def test_a_double_click_is_a_400_and_charges_once(self):
        from unittest.mock import patch

        self.item.stock = 0  # unlimited
        self.item.save(update_fields=['stock'])
        self.assertEqual(self._buy().status_code, status.HTTP_201_CREATED)
        # The second click's ownership check ran before the first committed.
        with patch.object(UserInventory.objects, 'filter', return_value=UserInventory.objects.none()):
            r = self._buy()

        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self._fuel(), 90)


class ReviewModerationTests(TestCase):
    """Audit, 21 October 2026: reviews were a public write channel with none of
    chat's floor. No confirmed address, no profanity screen, a chat suspension
    did not apply, and anybody could read them with the author's username --
    the local part of their e-mail."""

    def setUp(self):
        self.item = _item()
        self.user = User.objects.create_user(
            username='aziza.karimova2013', email='aziza.karimova2013@e.com', password='x',
            email_verified_at=timezone.now(),
        )
        UserInventory.objects.create(user=self.user, item=self.item)
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _review(self, comment='Juda yaxshi kema!', rating=5):
        return self.client.post(
            f'/api/v1/market/items/{self.item.slug}/review/',
            {'rating': rating, 'comment': comment}, format='json',
        )

    def test_an_unconfirmed_address_cannot_review(self):
        self.user.email_verified_at = None
        self.user.save(update_fields=['email_verified_at'])
        r = self._review()
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data.get('code'), 'email_unverified')

    def test_profanity_is_refused(self):
        from .models import ItemReview

        r = self._review(comment='fuck you')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(ItemReview.objects.exists())

    def test_a_chat_suspension_applies(self):
        from apps.chat.models import ChatSuspension

        staff = User.objects.create_user(username='mod', email='m@e.com', password='x', is_staff=True)
        ChatSuspension.objects.create(
            user=self.user, until=timezone.now() + timezone.timedelta(days=3),
            reason='bullying', created_by=staff,
        )
        r = self._review()
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(r.data.get('code'), 'suspended')

    def test_the_public_list_does_not_print_the_username(self):
        self._review()
        r = APIClient().get(f'/api/v1/market/items/{self.item.slug}/reviews/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotIn('aziza.karimova2013', str(r.data))
        self.assertEqual(r.data[0]['display_name'], None)


class ExternalProductTests(TestCase):
    """A product with an `external_url` is a real thing another shop sells for
    money — a book at Asaxiy, a rocket kit at Estes. Fuel is what a child earns
    by finishing lessons, and it buys nothing at those shops.

    So the purchase endpoint has to refuse the trade itself. Hiding the button
    in MarketView is not the protection: a stale tab, a replayed request or the
    next person to write a client all reach this endpoint directly, and the
    child who loses their fuel and receives nothing has no way to get it back.
    """

    def setUp(self):
        self.real = _item(
            slug='carl-sagan-cosmos',
            item_type='book',
            cost_fuel=0,
            price=0,
            external_url='https://asaxiy.uz/product/carl-sagan-cosmos',
            merchant='Asaxiy',
        )
        self.virtual = _item(slug='ship', cost_fuel=50)
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.profile = self.user.gamification
        self.profile.fuel = 500
        self.profile.save(update_fields=['fuel'])
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _buy(self, slug):
        return self.client.post('/api/v1/market/purchase/', {'item_slug': slug}, format='json')

    def test_a_real_product_cannot_be_bought_with_fuel(self):
        response = self._buy(self.real.slug)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(UserInventory.objects.filter(user=self.user, item=self.real).exists())

    def test_the_refusal_leaves_the_balance_alone(self):
        """cost_fuel is 0 on these rows, so a debit would be invisible in the
        balance. Assert it anyway: the day somebody types a fuel price into a
        real product, this is the test that says what happens next."""
        self._buy(self.real.slug)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 500)

    def test_the_refusal_is_not_counted_as_a_sale(self):
        self._buy(self.real.slug)
        self.real.refresh_from_db()
        self.assertEqual(self.real.sold_count, 0)

    def test_the_refusal_says_where_the_product_is_actually_sold(self):
        """A child who somehow reaches this has to be told what to do instead."""
        response = self._buy(self.real.slug)
        self.assertIn('Asaxiy', response.data['detail'])
        self.assertEqual(response.data['external_url'], self.real.external_url)

    def test_a_real_product_with_a_fuel_price_is_still_refused(self):
        """The guard is on `external_url`, not on cost_fuel being zero — a typo
        in the admin panel must not turn a real product into a fuel purchase."""
        self.real.cost_fuel = 10
        self.real.save(update_fields=['cost_fuel'])
        self.assertEqual(self._buy(self.real.slug).status_code, status.HTTP_400_BAD_REQUEST)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 500)

    def test_a_virtual_item_is_still_sold_for_fuel(self):
        response = self._buy(self.virtual.slug)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.profile.refresh_from_db()
        self.assertEqual(self.profile.fuel, 450)

    def test_the_catalogue_says_which_products_are_real(self):
        """The front end decides between a fuel button and a link out of these
        fields, so they belong in the anonymous list response."""
        response = APIClient().get('/api/v1/market/items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_slug = {row['slug']: row for row in response.data['results']}

        real = by_slug[self.real.slug]
        self.assertTrue(real['is_external'])
        self.assertEqual(real['external_url'], 'https://asaxiy.uz/product/carl-sagan-cosmos')
        self.assertEqual(real['merchant'], 'Asaxiy')

        self.assertFalse(by_slug[self.virtual.slug]['is_external'])


class ExternalProductDataTests(TestCase):
    """Half-filled real products mislead: the reader cannot tell whether 59.99
    is dollars or soums, and a fuel price on a real product renders a button
    that can only ever fail. `clean()` catches both in the admin panel, which is
    where the product data is actually typed in."""

    def _clean(self, **over):
        fields = dict(slug='kit', item_type='model_kit', cost_fuel=0)
        fields.update(over)
        _item(**fields).full_clean(exclude=['image'])

    def test_a_shop_price_without_a_currency_is_rejected(self):
        with self.assertRaises(DjangoValidationError) as caught:
            self._clean(external_url='https://estesrockets.com/', external_price='59.99')
        self.assertIn('currency', caught.exception.message_dict)

    def test_a_shop_price_on_a_virtual_item_is_rejected(self):
        with self.assertRaises(DjangoValidationError) as caught:
            self._clean(external_price='59.99', currency='USD')
        self.assertIn('external_price', caught.exception.message_dict)

    def test_a_fuel_price_on_a_real_product_is_rejected(self):
        with self.assertRaises(DjangoValidationError) as caught:
            self._clean(external_url='https://estesrockets.com/', cost_fuel=25)
        self.assertIn('cost_fuel', caught.exception.message_dict)

    def test_a_real_product_priced_in_dollars_is_accepted(self):
        self._clean(
            external_url='https://estesrockets.com/',
            merchant='Estes Rockets',
            external_price='59.99',
            currency='USD',
        )

    def test_a_real_product_with_no_price_yet_is_accepted(self):
        """The normal state of these rows until somebody checks the shop."""
        self._clean(external_url='https://estesrockets.com/', merchant='Estes Rockets')


class ExternalProductAdminApiTests(TestCase):
    """The same rules, through the other door.

    `MarketItem.clean()` is run by the admin panel's form. The admin API is a
    DRF serializer, and DRF does not call `Model.clean()` — so every row the
    panel refused could still be created over HTTP, and which rules applied
    depended on which screen the staff member happened to use. These are the
    three combinations `ExternalProductDataTests` rejects, sent as requests.
    """

    def setUp(self):
        self.staff = User.objects.create_user(
            username='admin', email='admin@e.com', password='x', is_staff=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def _post(self, **over):
        body = dict(
            slug='probe', title_en='X', title_uz='X', title_ru='X',
            description_en='x', description_uz='x', description_ru='x',
            item_type='book', price=0, cost_fuel=0,
        )
        body.update(over)
        return self.client.post('/api/v1/market/items/', body, format='json')

    def test_a_real_product_with_a_fuel_price_is_refused(self):
        response = self._post(
            cost_fuel=500,
            external_url='https://asaxiy.uz/product/carl-sagan-cosmos',
            merchant='Asaxiy',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cost_fuel', response.data)
        self.assertFalse(MarketItem.objects.filter(slug='probe').exists())

    def test_a_shop_price_without_a_currency_is_refused(self):
        response = self._post(
            external_url='https://asaxiy.uz/product/carl-sagan-cosmos',
            merchant='Asaxiy',
            external_price='59.99',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('currency', response.data)

    def test_a_shop_price_on_a_virtual_item_is_refused(self):
        response = self._post(cost_fuel=100, external_price='10.00', currency='USD')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('external_price', response.data)

    def test_a_well_formed_real_product_is_still_accepted(self):
        response = self._post(
            external_url='https://estesrockets.com/',
            merchant='Estes Rockets',
            external_price='59.99',
            currency='USD',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_a_well_formed_virtual_item_is_still_accepted(self):
        response = self._post(cost_fuel=250)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_patching_one_field_still_reads_the_whole_row(self):
        """A PATCH sends what changed; the rule needs what the row will become."""
        _item(slug='kit', item_type='model_kit', cost_fuel=0,
              external_url='https://estesrockets.com/', merchant='Estes Rockets')

        response = self.client.patch(
            '/api/v1/market/items/kit/', {'cost_fuel': 300}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cost_fuel', response.data)


class BoostsAreNotSoldTests(TestCase):
    """Audit, 28 October 2026: "Double XP — 7 days" cost 200 fuel and
    "Fuel Refill +500" promised 500 fuel, and nothing on the server reads a
    boost -- a pupil paid and nothing happened. They stay off sale until a
    boost actually does something."""

    def test_the_seed_leaves_every_boost_off_sale(self):
        from django.core.management import call_command

        call_command('seed_market', verbosity=0)
        boosts = MarketItem.objects.filter(item_type='boost')
        self.assertTrue(boosts.exists())
        self.assertFalse(boosts.filter(is_active=True).exists())

    def test_a_boost_cannot_be_bought(self):
        from django.core.management import call_command

        from apps.accounts.models import User

        call_command('seed_market', verbosity=0)
        pupil = User.objects.create_user(username='p', email='p@x.uz', password='Str0ngPassw0rd!x')
        # Plenty of fuel, so a refusal is about the boost and not the balance.
        from apps.gamification.models import UserGamificationProfile
        UserGamificationProfile.objects.update_or_create(user=pupil, defaults={'fuel': 10000})
        client = APIClient()
        client.force_authenticate(pupil)
        r = client.post('/api/v1/market/purchase/', {'item_slug': 'double-xp-7d'}, format='json')
        self.assertNotEqual(r.status_code, status.HTTP_200_OK)
        self.assertNotEqual(r.status_code, status.HTTP_201_CREATED)


class FuelDiscountTests(TestCase):
    """Audit, 28 October 2026: a sale was a soum-price decoration. The card
    said "-25%" and the purchase took the full fuel price, and the badge
    stayed up after the sale had ended. A sale now lowers the fuel price
    while it runs, on the server and on the card alike."""

    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='a@e.com', password='x')
        self.user.gamification.fuel = 1000
        self.user.gamification.save(update_fields=['fuel'])
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _buy(self, item):
        self.client.post('/api/v1/market/purchase/', {'item_slug': item.slug}, format='json')
        self.user.gamification.refresh_from_db()
        return 1000 - self.user.gamification.fuel

    def test_a_running_sale_takes_the_reduced_price(self):
        item = _item(cost_fuel=200, discount_percent=25,
                     discount_end=timezone.now() + timezone.timedelta(days=1))
        self.assertEqual(self._buy(item), 150)

    def test_a_finished_sale_takes_the_full_price(self):
        item = _item(cost_fuel=200, discount_percent=25,
                     discount_end=timezone.now() - timezone.timedelta(days=1))
        self.assertEqual(self._buy(item), 200)

    def test_the_card_is_sent_the_price_the_purchase_will_take(self):
        _item(cost_fuel=200, discount_percent=25,
              discount_end=timezone.now() + timezone.timedelta(days=1))
        rows = self.client.get('/api/v1/market/items/').data
        rows = rows['results'] if isinstance(rows, dict) else rows
        self.assertEqual(rows[0]['effective_cost_fuel'], 150)
