from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'astronaut_name', 'language', 'is_staff', 'date_joined')
    list_filter = ('role', 'language', 'is_staff', 'is_active')
    search_fields = ('username', 'email', 'astronaut_name')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile', {'fields': ('avatar', 'astronaut_name', 'bio', 'selected_spaceship', 'language')}),
        ('Role', {
            'fields': ('role',),
            'description': (
                'What this person is. It grants nothing on its own — the admin '
                'panel and every staff-only endpoint read the "Staff status" box '
                'above, not this. Marking somebody an administrator here does '
                'not let them in anywhere.'
            ),
        }),
    )
