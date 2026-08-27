"""Finding the accounts that share an e-mail address, and picking one.

`User.email` has never been unique. The check that looks unique —
`RegisterSerializer.validate_email` — is a `filter().exists()`, which two
requests arriving together both pass. Everything downstream already knows:
`LoginView` resolves an address with `.order_by('id').first()`, and so does the
e-mail sign-in code path. It works, in the sense that it always picks the same
row, and it means "an address identifies an account" is not true here.

That has to become true before an address can decide anything — a password reset
sent to it, or a Google account linked by it. Both are account takeover if two
accounts answer to one address.

So this is the step before the constraint: find the collisions, and resolve them
by hand with a report, rather than discovering them as a failed migration
against the database eight people share.

**The loser keeps their account.** It keeps its username, its password, its
progress and its ability to sign in; it loses the address, which it was sharing
anyway. Deactivating it as well would satisfy the same constraint and lock a
child out of their own work to do it, so this does not. The report names them so
somebody can ask which address is really theirs.
"""
from collections import defaultdict

from django.db.models.functions import Lower


def duplicate_email_groups(User):
    """{lowered address: [ids, oldest first]} for every address held twice.

    Case-insensitive, because that is what every lookup in this project already
    is, and blank addresses are excluded — `AbstractUser.email` is `blank=True`,
    stored as '' rather than NULL, and every superuser created without one holds
    that value. They are not duplicates of each other in any sense that matters.
    """
    rows = (
        User.objects.exclude(email='')
        .annotate(lowered=Lower('email'))
        .values_list('lowered', 'id')
        .order_by('lowered', 'id')
    )
    groups = defaultdict(list)
    for lowered, pk in rows:
        groups[lowered].append(pk)
    return {address: ids for address, ids in groups.items() if len(ids) > 1}


def resolve_duplicates(User, dry_run=True):
    """Leave one account holding each address. Returns what was (or would be) done.

    The keeper is the lowest id — the row `LoginView.order_by('id').first()`
    already resolves that address to today, so signing in continues to reach the
    same account it reached yesterday. Anything else silently moves somebody's
    identity.

    Returns [{'address': str, 'keeper': int, 'cleared': [int, ...]}, ...].
    """
    resolved = []
    for address, ids in sorted(duplicate_email_groups(User).items()):
        keeper, losers = ids[0], ids[1:]
        resolved.append({'address': address, 'keeper': keeper, 'cleared': losers})
        if not dry_run:
            User.objects.filter(id__in=losers).update(email='')
    return resolved
