"""
WSGI config for base project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# A server gets the hardened settings unless it names others: base/settings/production.py.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'base.settings.production')

application = get_wsgi_application()
