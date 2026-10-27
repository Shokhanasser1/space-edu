"""Take the boosts off sale.

Nothing on the server reads a boost: "Double XP — 7 days" cost 200 fuel and
did nothing, "Fuel Refill +500" added no fuel (audit, 28 October 2026). The
seed now creates them inactive; this does the same to the rows already in the
database. Reversing it does not put them back on sale -- that should happen
in the change that makes them work.
"""
from django.db import migrations


def take_off_sale(apps, schema_editor):
    MarketItem = apps.get_model('market', 'MarketItem')
    MarketItem.objects.filter(item_type='boost').update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('market', '0006_external_products'),
    ]

    operations = [
        migrations.RunPython(take_off_sale, migrations.RunPython.noop),
    ]
