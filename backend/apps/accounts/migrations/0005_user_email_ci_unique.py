"""One e-mail address identifies one account.

Until now it did not, and the code knew: `LoginView` resolves an address with
`.order_by('id').first()` because there might be more than one row. That is
survivable for a sign-in and fatal for anything that treats an address as proof
of who someone is -- a password reset sent to it, or a Google account linked by
it. Both are account takeover if two accounts answer to one address.

Three steps, in this order and for this reason:

1. Lower-case every address, because the constraint is on `LOWER(email)` and
   every lookup in this project is already `iexact`. This is also capable of
   *creating* a collision -- `A@x.uz` and `a@x.uz` are two rows until now -- so
   it has to happen before the check, not after.
2. Refuse, loudly and by name, if any address is still held twice. PostgreSQL's
   own message for this is "duplicate key value violates unique constraint",
   which does not say which accounts or what to do; against the database eight
   people share, that is somebody's afternoon.
3. Add the constraint.

The check is written out here rather than imported from `apps.accounts` on
purpose: a migration has to keep meaning the same thing years after the code it
was written beside has moved on.
"""
from collections import defaultdict

import django.db.models.functions.text
from django.db import migrations, models
from django.db.models.functions import Lower


def normalise(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.exclude(email='').update(email=Lower('email'))


def refuse_if_an_address_is_shared(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    groups = defaultdict(list)
    for address, username in User.objects.exclude(email='').values_list('email', 'username'):
        groups[address].append(username)

    shared = {address: names for address, names in groups.items() if len(names) > 1}
    if not shared:
        return

    lines = '\n'.join(f'    {address}: {", ".join(sorted(names))}' for address, names in sorted(shared.items()))
    raise RuntimeError(
        'These e-mail addresses are held by more than one account, so an address '
        'cannot yet identify an account:\n\n'
        f'{lines}\n\n'
        'Nothing has been changed. Resolve them first -- the command reports before '
        'it writes, keeps the account each address already signs in to, and deletes '
        'nobody:\n\n'
        '    python manage.py dedupe_user_emails --dry-run\n'
        '    python manage.py dedupe_user_emails\n'
    )


def leave_them_as_they_are(apps, schema_editor):
    """Reversing this cannot un-lower an address, and should not try."""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_image_upload_paths'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(normalise, leave_them_as_they_are),
        migrations.RunPython(refuse_if_an_address_is_shared, leave_them_as_they_are),
        migrations.AddConstraint(
            model_name='user',
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower('email'),
                condition=models.Q(('email', ''), _negated=True),
                name='accounts_user_email_ci_unique',
            ),
        ),
    ]
