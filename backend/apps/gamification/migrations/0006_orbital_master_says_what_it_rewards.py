"""Make "Orbital Master" say what it is awarded for.

It read "Complete 10 lessons with perfect scores" and has always been awarded
for 10 lessons completed (condition_type 'lessons'), whatever the scores
(audit, 28 October 2026). The text is corrected in seed_badges.py; this does
the same to the row already in the database.
"""
from django.db import migrations


def describe(apps, schema_editor):
    Badge = apps.get_model('gamification', 'Badge')
    Badge.objects.filter(slug='orbital-master').update(
        description_en='Complete 10 lessons.',
        description_uz='10 ta darsni yakunlang.',
        description_ru='Завершите 10 уроков.',
    )


class Migration(migrations.Migration):

    dependencies = [
        ('gamification', '0005_leaderboard_xp_index'),
    ]

    operations = [
        migrations.RunPython(describe, migrations.RunPython.noop),
    ]
