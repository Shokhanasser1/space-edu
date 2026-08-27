"""One e-mail address, one account.

`User.email` was never unique. `RegisterSerializer.validate_email` looks like it
enforces that and does not: it is a `filter().exists()`, which two requests
arriving together both pass. `LoginView` has always known, resolving an address
with `.order_by('id').first()` because there might be more than one row.

Survivable for a sign-in, fatal for a password reset sent to an address or a
Google account linked by one -- both are account takeover if two accounts answer
to the same address. These lock down the constraint that makes it true, the
refusal that keeps the shared database from finding out the hard way, and the
400 that would otherwise have become a 500.
"""
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient

from .email_dedupe import duplicate_email_groups
from .models import User

VALID_PW = 'Str0ngPassw0rd!x'

BEFORE = '0004_image_upload_paths'
AFTER = '0005_user_email_ci_unique'


class EmailUniquenessTests(TestCase):
    """The constraint itself, and the two ways the obvious version of it --
    `unique=True` on the field -- would have been wrong."""

    def test_the_same_address_in_another_case_is_the_same_address(self):
        """`unique=True` is case-sensitive on PostgreSQL, so it would have
        allowed this while every lookup in the project is `iexact` and would
        still have found two accounts."""
        User.objects.create_user('first', email='pupil@example.com', password=VALID_PW)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user('second', email='PUPIL@example.com', password=VALID_PW)

    def test_accounts_with_no_address_do_not_collide_with_each_other(self):
        """`email` is blank=True, stored as '' rather than NULL, and PostgreSQL
        treats '' as an ordinary value. Without the condition, every superuser
        created without an address would collide with every other one."""
        User.objects.create_user('nobody', password=VALID_PW)
        User.objects.create_user('nobody_else', password=VALID_PW)
        self.assertEqual(User.objects.filter(email='').count(), 2)

    def test_an_address_can_still_move_between_accounts(self):
        """Changing your address to one nobody holds has to keep working."""
        user = User.objects.create_user('mover', email='old@example.com', password=VALID_PW)
        user.email = 'new@example.com'
        user.save(update_fields=['email'])
        self.assertEqual(User.objects.get(pk=user.pk).email, 'new@example.com')


class RegistrationRaceTests(TestCase):
    """Finding: `validate_email` is a filter().exists(), so two registrations
    for one address arriving together both pass it. Before the constraint the
    second one succeeded and there were two accounts; with the constraint and
    without the handler it is an IntegrityError -- a 500, which under DEBUG
    renders the debug page and SECRET_KEY with it."""

    def setUp(self):
        self.client = APIClient()

    def _payload(self, **over):
        data = {
            'first_name': 'Aziz', 'last_name': 'Karimov',
            'email': 'racer@example.com', 'date_of_birth': '2010-01-01',
            'password': VALID_PW, 'password2': VALID_PW,
        }
        data.update(over)
        return data

    def test_losing_the_race_is_a_400_and_not_a_500(self):
        User.objects.create_user('already', email='racer@example.com', password=VALID_PW)
        # Standing in for the other request having committed between the check
        # and the insert. That window is the whole of the race and cannot be
        # timed reliably, so the check is removed instead of being lost.
        with patch('apps.accounts.serializers.RegisterSerializer.validate_email',
                   side_effect=lambda value: value):
            r = self.client.post('/api/v1/auth/register/', self._payload(), format='json')

        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', r.data)
        self.assertEqual(User.objects.filter(email__iexact='racer@example.com').count(), 1)

    def test_the_friendly_check_still_answers_first(self):
        """The serializer message is the one a person reads; the handler above
        is the net under it, not a replacement. DRF cannot derive a validator
        from a UniqueConstraint with expressions, so deleting validate_email
        would turn every duplicate into the terse version."""
        self.client.post('/api/v1/auth/register/', self._payload(), format='json')
        r = self.client.post('/api/v1/auth/register/', self._payload(email='RACER@example.com'),
                             format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', r.data)


class SharedAddressMigrationTests(TransactionTestCase):
    """The state the shared database may actually be in, and what 0005 does
    about it.

    These migrate the accounts app back to before the constraint, because that
    is the only state in which two accounts can hold one address -- and the only
    state the migration and the dedupe command will ever meet. TransactionTestCase
    because migrating is DDL, and DDL inside the transaction a TestCase holds
    open is not something to rely on.
    """

    def _migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([('accounts', target)])

    def setUp(self):
        self._migrate(BEFORE)

    def tearDown(self):
        User.objects.all().delete()
        self._migrate(AFTER)

    def _shared_address(self):
        """Two accounts on one address, differing only in case."""
        keeper = User.objects.create_user('older', email='shared@example.com', password=VALID_PW)
        loser = User.objects.create_user('newer', email='SHARED@example.com', password=VALID_PW)
        return keeper, loser

    # ── the migration ────────────────────────────────────────────────────
    def test_the_migration_names_the_addresses_instead_of_failing_on_a_key(self):
        """PostgreSQL's own message is "duplicate key value violates unique
        constraint", which says neither which accounts nor what to do about it.
        Against the database eight people share, that is somebody's afternoon."""
        self._shared_address()

        with self.assertRaises(RuntimeError) as raised:
            self._migrate(AFTER)

        message = str(raised.exception)
        self.assertIn('shared@example.com', message)
        self.assertIn('older', message)
        self.assertIn('newer', message)
        self.assertIn('dedupe_user_emails', message)

    def test_a_refused_migration_changes_nothing(self):
        """It lower-cases every address before it checks, because that step can
        create a collision of its own. If the check then refuses, the
        lower-casing has to go back with it -- otherwise a failed migration has
        quietly edited people's addresses."""
        _, loser = self._shared_address()

        with self.assertRaises(RuntimeError):
            self._migrate(AFTER)

        loser.refresh_from_db()
        self.assertEqual(loser.email, 'SHARED@example.com')

    def test_it_migrates_once_the_addresses_are_resolved(self):
        self._shared_address()
        call_command('dedupe_user_emails', stdout=StringIO())
        self._migrate(AFTER)  # no raise
        self.assertEqual(duplicate_email_groups(User), {})

    def test_a_database_with_nothing_wrong_with_it_just_migrates(self):
        User.objects.create_user('alone', email='Alone@example.com', password=VALID_PW)
        self._migrate(AFTER)
        self.assertEqual(User.objects.get(username='alone').email, 'alone@example.com')

    # ── the command ──────────────────────────────────────────────────────
    def test_it_finds_a_shared_address_whatever_the_case(self):
        self._shared_address()
        groups = duplicate_email_groups(User)
        self.assertEqual(list(groups), ['shared@example.com'])

    def test_a_blank_address_is_not_a_duplicate(self):
        User.objects.create_user('nobody', password=VALID_PW)
        User.objects.create_user('nobody_else', password=VALID_PW)
        self.assertEqual(duplicate_email_groups(User), {})

    def test_the_dry_run_reports_and_writes_nothing(self):
        _, loser = self._shared_address()
        out = StringIO()
        call_command('dedupe_user_emails', '--dry-run', stdout=out)

        self.assertIn('shared@example.com', out.getvalue())
        self.assertIn('newer', out.getvalue())
        loser.refresh_from_db()
        self.assertEqual(loser.email, 'SHARED@example.com')

    def test_the_account_that_already_signs_in_keeps_the_address(self):
        """The keeper is the lowest id, which is the row LoginView's
        `.order_by('id').first()` resolves that address to today. Anything else
        moves somebody's identity without telling them."""
        keeper, loser = self._shared_address()
        call_command('dedupe_user_emails', stdout=StringIO())

        keeper.refresh_from_db()
        loser.refresh_from_db()
        self.assertEqual(keeper.email, 'shared@example.com')
        self.assertEqual(loser.email, '')

    def test_nobody_is_deleted_or_locked_out(self):
        """These are children's accounts. The loser keeps its username, its
        password and its progress; it loses an address it was sharing anyway."""
        _, loser = self._shared_address()
        call_command('dedupe_user_emails', stdout=StringIO())

        loser.refresh_from_db()
        self.assertTrue(loser.is_active)
        self.assertTrue(loser.check_password(VALID_PW))
        self.assertEqual(User.objects.count(), 2)

    def test_running_it_twice_is_the_same_as_running_it_once(self):
        self._shared_address()
        call_command('dedupe_user_emails', stdout=StringIO())
        out = StringIO()
        call_command('dedupe_user_emails', stdout=out)
        self.assertIn('already belongs to one account', out.getvalue())
