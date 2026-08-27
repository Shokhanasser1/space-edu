"""Links that go inside an e-mail.

A message from us to a child is the worst possible place to put a URL we are not
certain about, so this refuses more than it accepts. Every rejection returns an
empty string rather than raising: the message still goes out, carrying the code
that actually proves anything, and only the convenience link is missing. The
failure mode is "no link", never "no e-mail" and never "a link to somebody
else's host".

FRONTEND_URL has to be typed into a file by hand on every machine, which makes a
typo a matter of when rather than if — the same reasoning that produced the
_csv() helper next to it in settings.
"""
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings


def _known_origins():
    """The front ends this project admits to having.

    CORS_ALLOWED_ORIGINS is that list already, maintained by hand and checked by
    OriginConfigTests. Reusing it means a new front end is added in one place,
    and a FRONTEND_URL pointing anywhere else stands out as the mistake it is.
    """
    return {origin.rstrip('/') for origin in settings.CORS_ALLOWED_ORIGINS if '://' in origin}


def frontend_link(path=''):
    """An absolute URL to `path` on the front end, or '' if we cannot be sure.

    Empty, scheme-less, or aimed at a host that is not one of ours -> ''.
    """
    base = (getattr(settings, 'FRONTEND_URL', '') or '').strip().rstrip('/')
    if not base:
        return ''

    parts = urlsplit(base)
    if parts.scheme not in ('http', 'https') or not parts.netloc:
        # "localhost:3000" parses as scheme "localhost", path "3000". A link
        # without a scheme is not a link, and guessing one is how a message ends
        # up pointing at a relative path in somebody's mail client.
        return ''

    origin = urlunsplit((parts.scheme, parts.netloc, '', '', ''))
    if origin not in _known_origins():
        return ''

    return f'{origin}/{path.lstrip("/")}' if path else origin
