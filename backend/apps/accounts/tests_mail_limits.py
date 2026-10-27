"""Audit, 28 October 2026: one address could make the site send mail to
anyone at volume -- five throwaway accounts produced 205 messages to 55
arbitrary recipients, every response a 200. The project's Gmail account stops
sending for a day once it passes its daily cap, and after that every sign-in
code and password reset fails silently. So every message counts against a
budget per recipient and a budget per day, below Gmail's."""
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings

from .emails import send_verification_code


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class MailBudgetTests(TestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_one_address_gets_five_messages_an_hour_and_no_more(self):
        for _ in range(8):
            send_verification_code('victim@example.com')
        self.assertEqual(len(mail.outbox), 5)

    def test_other_addresses_are_not_held_up_by_one(self):
        for _ in range(8):
            send_verification_code('victim@example.com')
        send_verification_code('pupil@example.com')
        self.assertEqual(mail.outbox[-1].to, ['pupil@example.com'])

    def test_the_whole_site_stops_short_of_the_mail_providers_cap(self):
        with self.settings(EMAIL_DAILY_LIMIT=3):
            for n in range(5):
                send_verification_code(f'pupil{n}@example.com')
        self.assertEqual(len(mail.outbox), 3)

    def test_the_address_is_compared_the_way_accounts_are(self):
        for address in ('Victim@Example.com', 'victim@example.com ', 'VICTIM@EXAMPLE.COM'):
            for _ in range(2):
                send_verification_code(address)
        self.assertEqual(len(mail.outbox), 5)
