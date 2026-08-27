"""Leave one account holding each e-mail address, before the constraint lands.

`User.email` has never been unique, so the shared database may hold two accounts
answering to one address. The migration that makes it unique cannot land while
that is true, and finding out by way of a failed migration against the database
eight people share is the wrong way to find out.

    python manage.py dedupe_user_emails --dry-run     # read the report
    python manage.py dedupe_user_emails               # apply it

Idempotent: a second run finds nothing and says so. The keeper is the lowest id
in each group — the account `LoginView` already resolves that address to — so
nobody's sign-in changes. The others keep their username, password and progress
and lose only the address they were sharing.

Run it against the shared database before migrating, and tell whoever owns a
cleared account which address is really theirs.
"""
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.email_dedupe import duplicate_email_groups, resolve_duplicates


class Command(BaseCommand):
    help = 'Clear duplicate e-mail addresses so one address identifies one account.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would change and touch nothing.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        User = get_user_model()

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — nothing will be written.\n'))

        with transaction.atomic():
            resolved = resolve_duplicates(User, dry_run=dry_run)
            if dry_run:
                transaction.set_rollback(True)

        self._report(User, resolved, dry_run)

    def _report(self, User, resolved, dry_run):
        if not resolved:
            self.stdout.write(self.style.SUCCESS(
                'Every e-mail address in this database already belongs to one account.'
            ))
            return

        verb = 'would keep' if dry_run else 'keeps'
        cleared_verb = 'would lose the address' if dry_run else 'lost the address'
        self.stdout.write(f'Addresses held by more than one account: {len(resolved)}\n')

        for group in resolved:
            keeper = User.objects.filter(id=group['keeper']).first()
            self.stdout.write(f"  {group['address']}")
            self.stdout.write(
                f"    {verb}: #{group['keeper']} {keeper.username if keeper else '?'}"
            )
            for pk in group['cleared']:
                other = User.objects.filter(id=pk).first()
                self.stdout.write(self.style.WARNING(
                    f"    {cleared_verb}: #{pk} {other.username if other else '?'}"
                ))

        self.stdout.write(self.style.WARNING(
            '\nNobody is deactivated and nothing is deleted. The accounts above still\n'
            'sign in with their username and password; they no longer have an address,\n'
            'so they cannot reset a password or sign in by e-mail until somebody asks\n'
            'them which address is theirs and sets it.'
        ))

        if dry_run:
            self.stdout.write('\nRe-run without --dry-run to apply.')
        else:
            remaining = duplicate_email_groups(User)
            if remaining:
                raise SystemExit(f'Still duplicated after the run: {sorted(remaining)}')
            self.stdout.write(self.style.SUCCESS('\nOne address, one account.'))
