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
import importlib
from contextlib import contextmanager
from io import StringIO
from unittest.mock import patch

from django.apps import apps as app_registry
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework import status
from rest_framework.test import APIClient

from .email_dedupe import duplicate_email_groups
from .models import User

VALID_PW = 'Str0ngPassw0rd!x'

CONSTRAINT = 'accounts_user_email_ci_unique'

MIGRATION = importlib.import_module('apps.accounts.migrations.0005_user_email_ci_unique')


@contextmanager
def _before_the_constraint():
    """Drop the unique index for the length of a test, and put it back after.

    Two accounts on one address is the state the dedupe command and the
    migration guard were written for, and the only state in which they do
    anything -- so a test has to be able to produce it.

    The index goes, and nothing else. Migrating the app backwards would also
    work and was tried first: it takes the `role` column with it, which the
    model still has, so every create_user() in the suite failed on a column that
    was not there. Twenty errors, none of them in the code being tested.
    """
    constraint = next(c for c in User._meta.constraints if c.name == CONSTRAINT)
    with connection.cursor() as cursor:
        cursor.execute(f'DROP INDEX IF EXISTS {CONSTRAINT}')
    try:
        yield
    finally:
        # Cleared before the index goes back, because several of these tests
        # deliberately end with two accounts on one address, and re-creating a
        # unique index over that fails. Assertions belong inside the block.
        User.objects.all().delete()
        with connection.schema_editor(atomic=False) as editor:
            editor.add_constraint(User, constraint)


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


class SharedAddressTests(TransactionTestCase):
    """The state the shared database may be in, and what is done about it.

    TransactionTestCase because these drop and re-create an index, which is DDL,
    and DDL inside the transaction a TestCase holds open is not something to
    rely on.
    """

    def _shared_address(self):
        """Two accounts on one address, differing only in case."""
        keeper = User.objects.create_user('older', email='shared@example.com', password=VALID_PW)
        loser = User.objects.create_user('newer', email='SHARED@example.com', password=VALID_PW)
        return keeper, loser

    def _run_the_migration_steps(self):
        """The two RunPython steps of 0005, in the order the migration runs them.

        The order is the point. Lower-casing is what makes `shared@` and
        `SHARED@` the same address, and it is also what can *create* a collision
        out of two rows that did not look like one -- so the check has to come
        second. Calling the check alone finds nothing and proves nothing, which
        is how this test was wrong the first time.
        """
        MIGRATION.normalise(app_registry, None)
        MIGRATION.refuse_if_an_address_is_shared(app_registry, None)

    # ── what the migration does when it finds them ───────────────────────
    def test_it_names_the_addresses_instead_of_failing_on_a_key(self):
        """PostgreSQL's own message is "duplicate key value violates unique
        constraint", which says neither which accounts nor what to do about it.
        This migration runs against the database eight people share, so that is
        somebody's afternoon."""
        with _before_the_constraint():
            self._shared_address()

            with self.assertRaises(RuntimeError) as raised:
                self._run_the_migration_steps()

            message = str(raised.exception)
            self.assertIn('shared@example.com', message)
            self.assertIn('older', message)
            self.assertIn('newer', message)
            self.assertIn('dedupe_user_emails', message)

    def test_the_check_is_what_lower_casing_makes_possible(self):
        """Two addresses that differ only in case are one address. Before the
        lower-casing step they group as two, which is why the check runs after
        it and not instead of it."""
        with _before_the_constraint():
            self._shared_address()
            MIGRATION.refuse_if_an_address_is_shared(app_registry, None)  # sees nothing yet

            MIGRATION.normalise(app_registry, None)
            with self.assertRaises(RuntimeError):
                MIGRATION.refuse_if_an_address_is_shared(app_registry, None)

    def test_it_passes_over_a_database_with_nothing_wrong_with_it(self):
        User.objects.create_user('alone', email='Alone@Example.com', password=VALID_PW)
        self._run_the_migration_steps()  # no raise
        self.assertEqual(User.objects.get(username='alone').email, 'alone@example.com')

    # ── what the command does about them ─────────────────────────────────
    def test_it_finds_a_shared_address_whatever_the_case(self):
        with _before_the_constraint():
            self._shared_address()
            self.assertEqual(list(duplicate_email_groups(User)), ['shared@example.com'])

    def test_a_blank_address_is_not_a_duplicate(self):
        """Every superuser created without one holds '', and they are not
        duplicates of each other in any sense that matters."""
        User.objects.create_user('nobody', password=VALID_PW)
        User.objects.create_user('nobody_else', password=VALID_PW)
        self.assertEqual(duplicate_email_groups(User), {})

    def test_the_dry_run_reports_and_writes_nothing(self):
        with _before_the_constraint():
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
        with _before_the_constraint():
            keeper, loser = self._shared_address()
            call_command('dedupe_user_emails', stdout=StringIO())

            keeper.refresh_from_db()
            loser.refresh_from_db()
            self.assertEqual(keeper.email, 'shared@example.com')
            self.assertEqual(loser.email, '')

    def test_nobody_is_deleted_or_locked_out(self):
        """These are children's accounts. The loser keeps its username, its
        password and its progress; it loses an address it was sharing anyway."""
        with _before_the_constraint():
            _, loser = self._shared_address()
            call_command('dedupe_user_emails', stdout=StringIO())

            loser.refresh_from_db()
            self.assertTrue(loser.is_active)
            self.assertTrue(loser.check_password(VALID_PW))
            self.assertEqual(User.objects.count(), 2)

    def test_running_it_twice_is_the_same_as_running_it_once(self):
        with _before_the_constraint():
            self._shared_address()
            call_command('dedupe_user_emails', stdout=StringIO())
            out = StringIO()
            call_command('dedupe_user_emails', stdout=out)
            self.assertIn('already belongs to one account', out.getvalue())

    def test_the_migration_goes_through_once_the_command_has_run(self):
        """The whole point of the command: leave a database 0005 can migrate."""
        with _before_the_constraint():
            self._shared_address()
            call_command('dedupe_user_emails', stdout=StringIO())
            self._run_the_migration_steps()  # no raise
