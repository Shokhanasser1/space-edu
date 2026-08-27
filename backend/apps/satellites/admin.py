from django.contrib import admin

from .models import TrackedSatellite


@admin.register(TrackedSatellite)
class TrackedSatelliteAdmin(admin.ModelAdmin):
    list_display = ('catalog_name', 'norad_id', 'mission_type', 'country',
                    'launch_date', 'is_featured')
    list_filter = ('mission_type', 'is_featured', 'country')
    search_fields = ('catalog_name', 'name_en', 'name_uz', 'name_ru', 'norad_id')
    list_editable = ('is_featured',)
    prepopulated_fields = {'slug': ('catalog_name',)}
    fieldsets = (
        ('Identity', {
            'fields': ('slug', 'catalog_name', 'norad_id', 'is_featured'),
            'description': 'Leave the NORAD number empty until one is actually '
                           'published. The page joins to the live element feed '
                           'on it, and a wrong number draws the wrong orbit.',
        }),
        ('Names and description', {
            'fields': ('name_en', 'name_uz', 'name_ru',
                       'description_en', 'description_uz', 'description_ru'),
        }),
        ('Mission', {
            'fields': ('mission_type', 'operator', 'country',
                       'launch_date', 'launch_site', 'launch_vehicle'),
            'description': 'Anything left blank is shown to the reader as "not '
                           'announced yet", in their own language. That is the '
                           'right answer when nobody has published it — do not '
                           'fill a field in to make the card look complete.',
        }),
        ('Source', {
            'fields': ('source_url', 'source_name'),
            'description': 'Where the facts above were read. Shown on the card.',
        }),
    )
