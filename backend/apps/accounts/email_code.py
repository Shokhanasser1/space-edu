"""Short-lived 6-digit codes sent to an e-mail address (cache-backed).

Four things use this now: signing in without a password, confirming an address,
resetting a forgotten password, and moving an account to a new address. All four
prove the same thing -- that whoever is asking can read mail sent to that
address -- so they share one mechanism rather than growing four.

Three things matter here and all three were wrong at some point:

* The code must come from a cryptographic source. `random.randint` is a Mersenne
  Twister whose internal state is recoverable from a handful of observed outputs,
  so an attacker who could see a few of their own codes could predict someone
  else's.
* The cache must be shared between worker processes. With the old per-process
  LocMemCache, `cache.delete` on verify only cleared the copy in the worker that
  handled the request, leaving the code replayable for its full TTL in the other.
  base.py now configures Redis (or the database) instead.
* **A code proves one thing, not any thing.** The purpose is part of the cache
  key, so a code mailed out to confirm an address cannot be presented at the
  passwordless sign-in endpoint to obtain a token pair, and a password-reset code
  cannot be used to approve a change of address. Sharing one namespace between
  purposes would turn the weakest flow into a way into all of them.
"""
import hmac
import secrets

from django.core.cache import cache

PREFIX = 'email_code:'
ATTEMPT_PREFIX = 'email_code_attempts:'
MAX_ATTEMPTS = 5

LOGIN = 'login'
VERIFY_EMAIL = 'verify_email'
PASSWORD_RESET = 'password_reset'
CHANGE_EMAIL = 'change_email'

# How long each kind of code is worth something. Signing in is a person waiting
# at a keyboard; confirming an address or changing one is something people come
# back to after finding the message, so those get longer.
TTL = {
    LOGIN: 600,             # 10 minutes
    VERIFY_EMAIL: 1800,     # 30 minutes
    PASSWORD_RESET: 900,    # 15 minutes
    CHANGE_EMAIL: 1800,     # 30 minutes
}


def _address(email: str) -> str:
    return (email or '').strip().lower()


def _key(email: str, purpose: str) -> str:
    return f'{PREFIX}{purpose}:{_address(email)}'


def _attempt_key(email: str, purpose: str) -> str:
    return f'{ATTEMPT_PREFIX}{purpose}:{_address(email)}'


def store_code(email: str, purpose: str = LOGIN) -> str:
    ttl = TTL[purpose]
    code = f'{secrets.randbelow(1_000_000):06d}'
    cache.set(_key(email, purpose), code, ttl)
    cache.set(_attempt_key(email, purpose), 0, ttl)
    return code


def check_code(email: str, submitted: str, purpose: str = LOGIN) -> bool:
    """Whether `submitted` is the live code for `purpose`, without spending it.

    Wrong guesses are counted; after MAX_ATTEMPTS the code is discarded so the
    caller has to request a new one. Comparison is constant-time.

    For a caller that still has something to refuse after the code is proved --
    a password reset, whose new password can fail the validators. Spending the
    code first meant a child who retyped a better password was told the code had
    expired. Everybody else wants `verify_and_consume`.
    """
    key = _key(email, purpose)
    stored = cache.get(key)
    if not stored or not submitted:
        return False

    attempt_key = _attempt_key(email, purpose)
    attempts = cache.get(attempt_key) or 0
    if attempts >= MAX_ATTEMPTS:
        discard_code(email, purpose)
        return False

    if not hmac.compare_digest(str(stored), str(submitted).strip()):
        cache.set(attempt_key, attempts + 1, TTL[purpose])
        return False

    return True


def discard_code(email: str, purpose: str = LOGIN) -> None:
    cache.delete(_key(email, purpose))
    cache.delete(_attempt_key(email, purpose))


def verify_and_consume(email: str, submitted: str, purpose: str = LOGIN) -> bool:
    """Return True exactly once per issued code, and only for its own purpose."""
    if not check_code(email, submitted, purpose):
        return False
    discard_code(email, purpose)
    return True


def cancel_address_change(user) -> bool:
    """Forget a half-finished move of the address, and the code that finishes it.

    Called wherever the password changes hands. Confirming a move needs only a
    code sent to the *new* address, which whoever started the move chose -- so a
    move left pending survives a password reset, and an access token (eight
    hours, not revocable) could still finish it and mint a fresh token pair.

    Does not save; returns whether `pending_email` needs to be.
    """
    if not user.pending_email:
        return False
    discard_code(user.pending_email, CHANGE_EMAIL)
    user.pending_email = ''
    return True
