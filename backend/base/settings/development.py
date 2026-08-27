from .base import *
from decouple import config

DEBUG = config('DEBUG', default=True, cast=bool)

# E-mail is configured in base.py from the environment now, and defaults to the
# console backend there. It used to be pinned here, which meant the module that
# overrides everything else decided how mail was sent — so setting EMAIL_BACKEND
# in .env did nothing at all, silently.

CORS_ALLOW_ALL_ORIGINS = True
