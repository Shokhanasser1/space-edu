"""Settings entry point: local development.

This package is what manage.py loads, so a laptop gets DEBUG, open CORS and
mail printed to the console. A server does not come through here: base/wsgi.py
and base/asgi.py default to `base.settings.production`, the hardened module.

That split is how this fails *closed* (rule C-7 in CONTRIBUTING.md): an unset
DJANGO_SETTINGS_MODULE on a server gets the safe settings, and the permissive
ones have to be asked for by name. The earlier form — one switch in here, read
from DJANGO_ENV — booted development on a typo or an unset variable, which
meant DEBUG on, CORS open to everyone, and the e-mail sign-in code returned in
the response body.
"""
from .development import *  # noqa: F401,F403
