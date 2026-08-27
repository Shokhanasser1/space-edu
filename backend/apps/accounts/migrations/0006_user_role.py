"""What a person is, recorded next to what they may do.

Everyone becomes a student, which is what registration produces and what every
account here has been until now. The exception is the accounts that already
carry `is_staff`: they are administrators in fact, and leaving them labelled
students would make the new field wrong on the day it arrived.

That is the only place the two are connected. `role` is not wired into any
permission check and setting it grants nothing -- see the docstring on
User.Role for why.
"""
from django.db import migrations, models


def label_the_administrators(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    User.objects.filter(is_staff=True).update(role='admin')


def back_to_students(apps, schema_editor):
    """Reversing drops the column anyway; this keeps the pair symmetrical."""
    User = apps.get_model('accounts', 'User')
    User.objects.update(role='student')


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_user_email_ci_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[('student', 'Student'), ('teacher', 'Teacher'), ('admin', 'Admin')],
                db_index=True, default='student', max_length=10,
            ),
        ),
        migrations.RunPython(label_the_administrators, back_to_students),
    ]
