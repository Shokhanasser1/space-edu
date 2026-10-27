"""Settings for a server that faces the internet.

base/wsgi.py and base/asgi.py — what gunicorn runs — default to this module;
manage.py defaults to development, which is what a laptop wants. So on a server
an unset DJANGO_SETTINGS_MODULE gets the hardened settings, and the permissive
ones are the ones you have to ask for by name (C-7).

Every rule here has a test in base/tests.py (ProductionSettingsTests). The
module was deleted once, on 24 August 2026, and what it had been guarding left
with it without anything failing.
"""
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import EMAIL_BACKEND, EMAIL_CONFIG_NOTE, MIDDLEWARE, SECRET_KEY

DEBUG = False

# It signs every session and every JWT on the site. A key Django generated for
# a laptop, or one short enough to guess, is the same as no key.
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured(
        'SECRET_KEY is shorter than 50 characters or is a development key. Generate '
        'one with: python -c "import secrets; print(secrets.token_urlsafe(64))"'
    )

# Caddy terminates TLS and turns http into https before a request reaches us
# (deploy/), so the redirect is its job and the scheme comes from its header.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False
# W008 is that redirect. W021 is the HSTS preload list, which is for a domain
# we own outright — not a name under duckdns.org.
SILENCED_SYSTEM_CHECKS = ['security.W008', 'security.W021']
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# /static/ is the admin's CSS and JS; nothing but runserver serves it unasked.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
] + [m for m in MIDDLEWARE if m != 'django.middleware.security.SecurityMiddleware']

# `default` must always be present. base.py only defines STORAGES when R2 is
# configured, and the old version of this dict ended up with `staticfiles`
# alone — every ImageField save raised InvalidStorageError.
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    **globals().get('STORAGES', {}),
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

# Registration, password resets and sign-in codes all leave by e-mail. On a
# laptop the console backend is the safe default; here it is a child waiting
# for a code only the server log can read — so it refuses to start instead.
if EMAIL_CONFIG_NOTE or EMAIL_BACKEND.rsplit('.', 2)[-2] in {'console', 'locmem', 'dummy', 'filebased'}:
    raise ImproperlyConfigured(
        EMAIL_CONFIG_NOTE or
        f'EMAIL_BACKEND is {EMAIL_BACKEND}, which delivers nothing. Set EMAIL_BACKEND to '
        'the SMTP backend with EMAIL_HOST, EMAIL_HOST_USER and EMAIL_HOST_PASSWORD.'
    )

# Django's own console handler only runs while DEBUG is on: without this a 500
# leaves no trace in `docker compose logs`.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}
