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
        from .emails import send_password_reset_code

        with self.settings(EMAIL_DAILY_LIMIT=3):
            for n in range(5):
                send_password_reset_code(f'pupil{n}@example.com')
        self.assertEqual(len(mail.outbox), 3)

    def test_the_address_is_compared_the_way_accounts_are(self):
        for address in ('Victim@Example.com', 'victim@example.com ', 'VICTIM@EXAMPLE.COM'):
            for _ in range(2):
                send_verification_code(address)
        self.assertEqual(len(mail.outbox), 5)

    def test_a_held_back_code_does_not_replace_the_one_already_sent(self):
        """Issuing the code before the budget check meant the sixth request
        stored a fresh code and mailed nothing, so the code the pupil was
        holding stopped working -- anyone could lock a pupil out by asking
        for codes in their name."""
        from .email_code import VERIFY_EMAIL, check_code

        sent = [send_verification_code('pupil@example.com') for _ in range(5)][-1]
        self.assertIsNone(send_verification_code('pupil@example.com'))
        self.assertTrue(check_code('pupil@example.com', sent, VERIFY_EMAIL))

    def test_a_security_notice_is_never_held_back(self):
        """Filling a person's hourly budget with codes would otherwise silence
        the message telling them their address is being changed."""
        from .emails import send_email_change_notice

        for _ in range(5):
            send_verification_code('owner@example.com')
        with self.settings(EMAIL_DAILY_LIMIT=5):
            send_email_change_notice('owner@example.com', 'thief@example.com')
        self.assertEqual(mail.outbox[-1].to, ['owner@example.com'])
        self.assertIn('thief@example.com', mail.outbox[-1].body)

    def test_new_addresses_cannot_spend_what_sign_ins_and_resets_need(self):
        """Registration mails an address nobody has confirmed, so it is where
        a flood comes from. It gets part of the day; codes for accounts that
        exist keep the rest."""
        from .emails import send_password_reset_code

        with self.settings(EMAIL_DAILY_LIMIT=10):
            for n in range(20):
                send_verification_code(f'new{n}@example.com')
            send_password_reset_code('pupil@example.com')
        self.assertEqual(mail.outbox[-1].to, ['pupil@example.com'])
        self.assertLess(len(mail.outbox), 10)
