"""Caching proxy for the external space-data APIs.

Browsers never call CelesTrak, JPL Horizons, Launch Library or NASA directly.
School networks block them, and every upstream counts its rate limit per
public address — which for a school is one address shared by every classroom.
So the backend fetches once and everyone reads the copy.

Two rules shape this module:

* One download per data update. CelesTrak's policy (since 2026-03-26) is a
  single download per data refresh, and it firewalls an address after 50 HTTP
  errors in two hours. A proxy that goes back upstream on every failed request
  is exactly what gets a school banned, so after a failure we mark the key and
  stop trying for ten minutes.
* Stale beats empty. A copy is kept for a week alongside the fresh one and is
  served with ``stale: true`` when upstream is down. A TLE from yesterday still
  draws an orbit; a 503 draws nothing.

The whole HTTP surface is ``_http_get`` so tests can replace it with one patch.
Only the standard library is used — ``requests`` is not installed here.
"""
import json
import logging
import os
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import quote

from django.core.cache import cache

logger = logging.getLogger(__name__)

USER_AGENT = 'uzcosmos-space-edu/1.0 (+https://github.com/Shokhanasser1/space-edu)'
UPSTREAM_TIMEOUT = 20
# The 'active' GP group is ~11 000 records of JSON; give it room, but not
# unbounded room, since the body is held in memory and then in the cache.
MAX_RESPONSE_BYTES = 32_000_000
FAILURE_BACKOFF = 10 * 60
STALE_TTL = 7 * 24 * 3600

GP_GROUPS = frozenset({
    'stations', 'visual', 'active', 'starlink', 'oneweb', 'gps-ops', 'galileo',
    'glo-ops', 'beidou', 'weather', 'science', 'geo', 'noaa', 'iridium-NEXT',
})
GP_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json'
GP_TTL = 2 * 3600
GP_MAX_LIMIT = 20000

HORIZONS_BODIES = {
    '-31': 'Voyager 1',
    '-32': 'Voyager 2',
    '-98': 'New Horizons',
    '-170': 'JWST',
    '-96': 'Parker Solar Probe',
    '-61': 'Juno',
    '-74': 'Mars Reconnaissance Orbiter',
    '-202': 'MAVEN',
    '399': 'Earth',
    '499': 'Mars',
}
HORIZONS_ENDPOINT = 'https://ssd.jpl.nasa.gov/api/horizons.api'
EPHEMERIS_TTL = 24 * 3600
EPHEMERIS_DEFAULT_DAYS = 30
EPHEMERIS_MAX_DAYS = 120

LAUNCHES_URL = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=8&mode=list'
LAUNCHES_TTL = 3600

APOD_URL = 'https://api.nasa.gov/planetary/apod?api_key={key}'
APOD_TTL = 12 * 3600


class UpstreamUnavailable(Exception):
    """Upstream failed (or is in its back-off window) and there is no stale copy."""


@dataclass(frozen=True)
class Fetched:
    value: Any
    fetched_at: str
    stale: bool


def _http_get(url: str) -> str:
    """The one real network call. Patched out in tests."""
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
        body = resp.read(MAX_RESPONSE_BYTES + 1)
    if len(body) > MAX_RESPONSE_BYTES:
        raise ValueError('upstream response too large')
    return body.decode('utf-8')


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _stale_or_raise(stale_key: str) -> Fetched:
    entry = cache.get(stale_key)
    if entry is None:
        raise UpstreamUnavailable(stale_key)
    return Fetched(entry['value'], entry['fetched_at'], True)


def fetch_cached(key: str, url: str, ttl: int, parse: Callable[[str], Any],
                 stale_ttl: int = STALE_TTL) -> Fetched:
    """Return the cached value for ``key``, fetching and parsing ``url`` if needed.

    Failure of any kind — HTTP error, connection error, timeout, a body that
    does not parse — falls back to the week-old copy under ``key + ':stale'``
    and marks ``key + ':failed'`` so nothing goes upstream again for ten
    minutes. With neither a copy nor a working upstream, UpstreamUnavailable.
    """
    fresh = cache.get(key)
    if fresh is not None:
        return Fetched(fresh['value'], fresh['fetched_at'], False)

    stale_key = key + ':stale'
    failed_key = key + ':failed'
    if cache.get(failed_key) is not None:
        return _stale_or_raise(stale_key)

    try:
        value = parse(_http_get(url))
    except Exception as exc:  # noqa: BLE001 — whatever upstream does wrong is a miss, never a 500
        logger.warning('space upstream failed for %s: %s', key, exc)
        cache.set(failed_key, True, FAILURE_BACKOFF)
        return _stale_or_raise(stale_key)

    entry = {'value': value, 'fetched_at': _now_iso()}
    cache.set(key, entry, ttl)
    cache.set(stale_key, entry, stale_ttl)
    return Fetched(value, entry['fetched_at'], False)


# ── CelesTrak GP ─────────────────────────────────────────────────────────────

def _parse_json_list(text: str) -> list:
    data = json.loads(text)
    if not isinstance(data, list):
        # CelesTrak answers a bad query with a plain-text message, not JSON.
        raise ValueError('expected a JSON array of OMM records')
    return data


def gp(group: str) -> Fetched:
    return fetch_cached(
        f'space:gp:{group}',
        GP_URL.format(group=quote(group, safe='')),
        GP_TTL,
        _parse_json_list,
    )


# ── JPL Horizons ─────────────────────────────────────────────────────────────

def horizons_url(body: str, start: str, stop: str) -> str:
    params = [
        ('format', 'text'),
        ('COMMAND', f"'{body}'"),
        ('OBJ_DATA', "'NO'"),
        ('MAKE_EPHEM', "'YES'"),
        ('EPHEM_TYPE', "'VECTORS'"),
        ('CENTER', "'500@10'"),
        ('REF_PLANE', "'ECLIPTIC'"),
        ('REF_SYSTEM', "'ICRF'"),
        ('OUT_UNITS', "'AU-D'"),
        ('VEC_TABLE', "'1'"),
        ('VEC_LABELS', "'NO'"),
        ('CSV_FORMAT', "'YES'"),
        ('START_TIME', f"'{start}'"),
        ('STOP_TIME', f"'{stop}'"),
        ('STEP_SIZE', "'6h'"),
    ]
    return HORIZONS_ENDPOINT + '?' + '&'.join(f'{k}={quote(v, safe="")}' for k, v in params)


def parse_horizons(text: str) -> list:
    """Lines between $$SOE and $$EOE, ``jd, date, x, y, z,`` -> ``[jd, x, y, z]``.

    No $$SOE means Horizons answered with an error message (unknown body,
    dates outside the trajectory) rather than an ephemeris; that is a failure,
    so the stale fallback and the back-off apply.
    """
    samples = []
    inside = False
    for raw in text.splitlines():
        line = raw.strip()
        if line == '$$SOE':
            inside = True
            continue
        if line == '$$EOE':
            break
        if not inside or not line:
            continue
        fields = [f.strip() for f in line.split(',')]
        if len(fields) < 5:
            raise ValueError(f'unexpected Horizons row: {line[:80]}')
        samples.append([float(fields[0]), float(fields[2]), float(fields[3]), float(fields[4])])
    if not inside:
        raise ValueError('no $$SOE block in Horizons response')
    if not samples:
        raise ValueError('empty ephemeris')
    return samples


def ephemeris(body: str, days: int) -> Fetched:
    # Date only, never time of day: every request in a day must share one copy.
    today = datetime.now(timezone.utc).date()
    start = (today - timedelta(days=1)).isoformat()
    stop = (today + timedelta(days=days)).isoformat()
    return fetch_cached(
        f'space:ephemeris:{body}:{days}:{today.isoformat()}',
        horizons_url(body, start, stop),
        EPHEMERIS_TTL,
        parse_horizons,
    )


# ── Launch Library, NASA APOD ────────────────────────────────────────────────

def launches() -> Fetched:
    return fetch_cached('space:launches', LAUNCHES_URL, LAUNCHES_TTL, json.loads)


def apod() -> Fetched:
    # The key rides in the URL only; the cache key and the response never see it.
    key = os.environ.get('NASA_API_KEY') or 'DEMO_KEY'
    return fetch_cached('space:apod', APOD_URL.format(key=quote(key, safe='')), APOD_TTL, json.loads)
