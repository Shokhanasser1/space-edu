import os
import sys
from pathlib import Path
from datetime import timedelta

from decouple import config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
def _csv(name, default=''):
    """Comma-separated environment variable to a clean list.

    `.split(',')` alone leaves the space in "a.com, b.com" attached to the second
    entry, so it silently never matches. Every list below is typed into a
    dashboard by hand, which makes that a matter of when rather than if.
    """
    return [item.strip() for item in config(name, default=default).split(',') if item.strip()]


def _text(name, default=''):
    """Environment variable, where blank means "not set".

    Every template line in .env.example is `NAME=` with nothing after it, so the
    variable exists and is empty — which decouple returns as '', not as the
    default. For a list that is harmless; for a class path or a port it is the
    difference between the safe default and a setting that is present, empty and
    broken. A value someone deleted the right-hand side of has to land in the
    same place as one they never typed.
    """
    return (config(name, default='') or '').strip() or default


def _int(name, default):
    raw = _text(name)
    return int(raw) if raw else default


def _flag(name, default):
    raw = _text(name).lower()
    if not raw:
        return default
    return raw in ('1', 'true', 'yes', 'on', 'y', 't')


ALLOWED_HOSTS = _csv('ALLOWED_HOSTS', default='localhost,127.0.0.1')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'apps.accounts',
    'apps.gamification',
    'apps.courses',
    'apps.progress',
    'apps.market',
    'apps.chat',
    'apps.news',
    'apps.events',
    'apps.challenges',
    'apps.admin_api',
    'apps.ai',
    'apps.space',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'base.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'base.wsgi.application'

AUTH_USER_MODEL = 'accounts.User'

import dj_database_url

# DB_URL takes priority; DATABASE_URL is the name most hosts inject on their own.
# Unset, this falls through to a SQLite file on this machine. With a team, it
# points at the database everybody shares — see docs/TEAM.md.
_db_url = (
    config('DB_URL', default=None)
    or config('DATABASE_URL', default=None)
    or f'sqlite:///{BASE_DIR / "db.sqlite3"}'
)

# ── Tests never touch the shared database ────────────────────────────────────
# Django's test runner CREATEs and DROPs a database of its own. Against a shared
# Postgres that is two problems at once: it needs rights nobody should hand a
# developer laptop, and two people running the suite at the same time collide on
# the same `test_` database — the second one drops the first one's out from
# under it, mid-run.
#
# So a test run is pinned to SQLite whatever DB_URL says. This is not a
# convenience: without it the first thing a new developer does after setting
# DB_URL is run the tests, against the database the whole team is using.
_running_tests = (
    sys.argv[1:2] == ['test']
    or os.environ.get('PYTEST_CURRENT_TEST') is not None
    or os.path.basename(sys.argv[0] or '').startswith('pytest')
)
if _running_tests:
    _db_url = f'sqlite:///{BASE_DIR / "db.sqlite3"}'

DATABASES = {
    'default': dj_database_url.parse(_db_url, conn_max_age=600)
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = config('TIME_ZONE', default='Asia/Tashkent')
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

# --- Cloudflare R2 Media Storage ---
# Both of the values Cloudflare shows on a bucket page are easy to paste in a
# form this used to accept silently and then get wrong:
#
#   "S3 API"     https://<account>.r2.cloudflarestorage.com/<bucket>
#                The bucket is already on the end. boto3 wants the account
#                endpoint alone and appends the bucket itself, so a pasted
#                bucket name arrives twice and every upload 404s.
#
#   "Public URL" https://pub-<hash>.r2.dev
#                This one is used as a *host*: the code writes
#                f'https://{value}/'. Paste the scheme with it and every image
#                URL becomes https://https://pub-... — which no test catches,
#                because uploading still works. Only the pictures break.
#
# Both are now normalised rather than trusted, because the person pasting them
# is copying out of a dashboard, not reading this file.
def _r2_host(value):
    """A bare host: no scheme, no trailing slash."""
    return (value or '').strip().removeprefix('https://').removeprefix('http://').rstrip('/')


def _r2_endpoint(value, bucket):
    """The account endpoint, with the bucket removed if it was pasted along."""
    endpoint = (value or '').strip().rstrip('/')
    if bucket and endpoint.endswith(f'/{bucket}'):
        endpoint = endpoint[: -len(f'/{bucket}')]
    return endpoint


_r2_key = config('CLOUDFLARE_R2_ACCESS_KEY_ID', default=None)

if _r2_key:
    STORAGES = {
        'default': {'BACKEND': 'base.storage_backends.R2MediaStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    }
    AWS_ACCESS_KEY_ID = _r2_key
    AWS_SECRET_ACCESS_KEY = config('CLOUDFLARE_R2_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = config('CLOUDFLARE_R2_BUCKET_NAME')
    AWS_S3_ENDPOINT_URL = _r2_endpoint(config('CLOUDFLARE_R2_ENDPOINT'), AWS_STORAGE_BUCKET_NAME)
    AWS_S3_REGION_NAME = 'auto'
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_QUERYSTRING_AUTH = False

    _r2_custom = _r2_host(config('CLOUDFLARE_R2_CUSTOM_DOMAIN', default=''))
    if _r2_custom:
        AWS_S3_CUSTOM_DOMAIN = _r2_custom
        MEDIA_URL = f'https://{_r2_custom}/'
    else:
        # The S3 endpoint is not public: without a public URL the rows save and
        # the pictures 401. Cloudflare calls it "Public URL" on the bucket page.
        MEDIA_URL = f'{AWS_S3_ENDPOINT_URL}/{AWS_STORAGE_BUCKET_NAME}/'
else:
    MEDIA_URL = '/media/'
    MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Cache ─────────────────────────────────────────────────────────────────────
# Must be shared across processes: any real server runs more than one worker,
# and both the e-mail sign-in codes and the DRF throttle counters live here.
# The Django default (LocMemCache) is per-process, which made codes vanish about
# half the time and left a verified code replayable in the worker that did not
# consume it.
_redis_url = config('REDIS_URL', default=None)
if _redis_url:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _redis_url,
        }
    }
else:
    # No Redis configured — fall back to the database table rather than local
    # memory, so behaviour stays correct with more than one worker.
    # Requires: python manage.py createcachetable
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.db.DatabaseCache',
            'LOCATION': 'django_cache',
        }
    }

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # How many reverse proxies sit in front of us. One is right for a single
    # terminating proxy; set it to what actually stands in front.
    # Leaving this unset makes DRF key throttles on the whole client-supplied
    # X-Forwarded-For header, which a caller can rotate to defeat every limit.
    'NUM_PROXIES': config('NUM_PROXIES', default=1, cast=int),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # ── How these are sized ───────────────────────────────────────────────
        # A school reaches this API from one public address. So a limit keyed on
        # the address is shared by everyone in the building, and one sized for a
        # person locks the building. Two rules follow, and every number below
        # obeys them:
        #
        #   Keyed on the account  -> size it for a person.
        #   Keyed on the address  -> size it for a machine. It cannot honestly
        #                            do more, and pretending otherwise is what
        #                            locked out real pupils twice.
        #
        # Windows are short on purpose as well. DRF keeps one timestamp per
        # request in the cache for the length of the window, so `10000/day` is a
        # list of up to ten thousand floats per pupil, read and rewritten on
        # every request — against a database-backed cache, which is what runs
        # without REDIS_URL.

        # Anonymous, keyed on address: a flood guard, not a quota. Far above a
        # room full of children, far below a runaway client or a scraper.
        # Was 2000/day, which a class browsing the catalogue spent by the
        # afternoon, after which the public site simply stopped for them.
        'anon': '120/sec',
        # Signed in, keyed on account, so this one is a person's budget.
        'user': '240/min',

        # Login: wrong guesses only, and see apps/accounts/throttles.py for why
        # that distinction is the whole point. `login` is per address *and*
        # account, so it is really a per-account budget; `login_ip` is the
        # address-level ceiling that stops one password being sprayed across a
        # list of accounts.
        'login': '10/hour',
        'login_ip': '120/hour',

        # Registration counts every attempt, because an account created is the
        # cost. Per-address, so machine-sized: a class told to sign up right now
        # passes, a script sitting on the endpoint does not.
        'register': '60/min',
        'register_day': '300/day',

        # Confirming an address, keyed on the account rather than the address it
        # is asked from -- so a classroom confirming together is thirty separate
        # budgets, not one shared. Person-sized: somebody who mistypes the code
        # and asks for another has room to, somebody working through six-digit
        # numbers does not. The code itself dies after five wrong guesses, so
        # this is the outer bound rather than the only one.
        'email_verify': '20/hour',

        # Nobody is signed in for a password reset, so it is keyed on the pair
        # (address it came from, account it is aimed at) the way the sign-in
        # codes are. Every request sends an e-mail or guesses six digits.
        'password_reset': '20/hour',

        # These two are keyed on the account. A person changes their password
        # or their address a handful of times in a lifetime; the room is for
        # mistyping, not for working through possibilities.
        'password_change': '20/hour',
        'email_change': '10/hour',

        # Google sign-in. Address-keyed and therefore machine-sized, and every
        # request counts because every one of them verifies a signature.
        'google': '60/min',

        'ai': '40/hour',

        # Chat is keyed on the account. Set for a classroom, not a newsroom:
        # a burst is fine, a flood is not.
        'chat': '20/min',
        'dm': '20/min',
        'report': '30/hour',

        # Grading is server-side, so the answers no longer ship to the browser,
        # but the set can still be walked one submission at a time. Signed in,
        # that is a person's budget. Anonymous — the problem set has never been
        # behind a login — it is address-keyed and therefore machine-sized.
        'problem_check': '60/hour',
        'problem_check_anon': '120/min',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = _csv('CORS_ALLOWED_ORIGINS', default='http://localhost:3000')

# Hosts that give every preview build its own subdomain are the reason this
# exists, and the reason it stays empty by default: a regex broad enough to
# match your own previews also matches every other page on that host.
CORS_ALLOWED_ORIGIN_REGEXES = _csv('CORS_ALLOWED_ORIGIN_REGEXES')

# Django checks Origin on every unsafe request from an HTTPS page, whether or
# not CORS is involved. Without this, signing in to /admin/ from behind any
# HTTPS proxy fails with "CSRF verification failed" and no other clue. Defaults
# to the CORS list because in practice they are the same set of front ends.
CSRF_TRUSTED_ORIGINS = _csv('CSRF_TRUSTED_ORIGINS') or [
    origin for origin in CORS_ALLOWED_ORIGINS if '://' in origin
]

# ── Sending e-mail ────────────────────────────────────────────────────────────
# Sign-in codes, address confirmation and password resets all leave through
# here. It used to be two hard-coded lines in settings/development.py, which
# meant "switch to a real mail server" was a code change in the module that
# overrides everything else — the same shape as the fail-open settings bug.
#
# Unset, it prints the message to the server log and delivers nothing. That is
# the safe default and it is what a laptop wants (C-7: the permissive branch is
# the one you ask for by name). Naming an SMTP backend without a host, on the
# other hand, is not a safe default — it is a mail server that silently fails —
# so that refuses to start instead.
EMAIL_BACKEND = _text('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = _text('EMAIL_HOST')
EMAIL_PORT = _int('EMAIL_PORT', 587)
EMAIL_HOST_USER = _text('EMAIL_HOST_USER')
# Stripped, unlike a password normally would be: this one is copied out of a
# Google dialog that prints it as four groups of four, so a stray space or
# newline on the end is the likeliest thing in the file. Gmail accepts the
# spaces between the groups, so those are left exactly as pasted.
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='').strip()
EMAIL_USE_TLS = _flag('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = _flag('EMAIL_USE_SSL', False)
DEFAULT_FROM_EMAIL = _text('DEFAULT_FROM_EMAIL', 'noreply@localhost')

# A code is mailed from inside the request that asked for it, so a mail server
# that stops answering would otherwise hold a worker until the client gave up.
EMAIL_TIMEOUT = _int('EMAIL_TIMEOUT', 10)

if 'smtp' in EMAIL_BACKEND and not EMAIL_HOST:
    raise ImproperlyConfigured(
        'EMAIL_BACKEND is set to SMTP but EMAIL_HOST is empty. Set EMAIL_HOST, '
        'EMAIL_HOST_USER and EMAIL_HOST_PASSWORD, or leave EMAIL_BACKEND unset '
        'to print messages to the console.'
    )
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured('EMAIL_USE_TLS and EMAIL_USE_SSL are mutually exclusive.')

# A named account with no password to log in with is not a mail server, it is a
# silent failure: every send is refused by the server, send_mail(fail_silently)
# swallows the refusal, and the child waiting for a code never learns anything
# went wrong. Half-configured falls back to the console, where the message is at
# least still readable — the same reasoning as the unset case, one step along.
#
# It stays a fallback rather than a hard stop because eight people share this
# repository and only one of them holds the mailbox password; refusing to boot
# would take the other seven's servers down with it.
EMAIL_CONFIG_NOTE = ''
if 'smtp' in EMAIL_BACKEND and EMAIL_HOST_USER and not EMAIL_HOST_PASSWORD:
    EMAIL_CONFIG_NOTE = (
        f'EMAIL_HOST_PASSWORD is empty, so nothing can be sent as {EMAIL_HOST_USER} '
        f'through {EMAIL_HOST}. Messages are being printed to the console instead. '
        f'Set an app password to deliver them.'
    )
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Where the front end lives, for the convenience links inside those messages.
# Empty is a valid answer and the default one: a code works without a link, and
# a link we are not sure about is the worst thing to put in a message to a
# child. `apps.links.frontend_link` refuses anything that is not one of our own
# front ends — see the reasoning there.
FRONTEND_URL = _text('FRONTEND_URL').rstrip('/')

# ── Sign in with Google ───────────────────────────────────────────────────────
# The OAuth *client id*, which is public by design -- it is in the page source of
# every site that offers this. There is no client secret in this flow at all: the
# browser receives a signed assertion from Google and the server checks the
# signature, so nothing here is a credential.
#
# Empty means the endpoint refuses. That is not a nicety: the audience check is
# the only thing standing between "a token minted for us" and "any Google token
# for any application", and google-auth accepts audience=None without complaint.
GOOGLE_CLIENT_ID = _text('GOOGLE_OAUTH_CLIENT_ID')

# ── Direct messages ───────────────────────────────────────────────────────────
# Off by default, and deliberately so. The product is used by 10-to-18-year-olds
# and private messaging between minors is the single largest thing on this
# system that can go wrong. The moderation floor is now in place — screening,
# reporting, blocking, moderator deletion, rate limits and a consent step before
# a stranger's second message — but nobody has yet reviewed the feature as a
# whole against the duty of care it implies. Turn it on deliberately, with
# DM_ENABLED=true, when that review has happened. See ticket B1.
DM_ENABLED = config('DM_ENABLED', default=False, cast=bool)
