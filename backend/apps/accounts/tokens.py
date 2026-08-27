"""Ending sessions that are already open.

**Read the limitation before relying on this.** Access tokens live eight hours
(`SIMPLE_JWT.ACCESS_TOKEN_LIFETIME`) and cannot be revoked at all -- they are
verified by signature, and nothing is looked up. Blacklisting the refresh tokens
means no new access token can be minted, which caps whoever is holding one at
eight more hours. It does not throw them out now.

That is a real gap and it is deliberate to leave it here rather than paper over
it: closing it needs a claim on the token that is checked against the account on
every request, which is a change to how every endpoint authenticates. Until
that exists, nothing in this file should be described as "signs the attacker
out", because it does not.

Extracted from `rotate_leaked_credentials`, which had the only copy and now
calls this one.
"""
import logging

logger = logging.getLogger(__name__)


def revoke_refresh_tokens(user=None):
    """Blacklist every outstanding refresh token, for one account or for all.

    Returns how many were blacklisted. Already-blacklisted tokens are skipped,
    so calling this twice reports honestly rather than claiming work it did not
    do.
    """
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken, OutstandingToken,
        )
    except ImportError:  # pragma: no cover — the app is in INSTALLED_APPS
        logger.warning('Token blacklist app is not installed; nothing was revoked.')
        return 0

    outstanding = OutstandingToken.objects.exclude(
        id__in=BlacklistedToken.objects.values_list('token_id', flat=True)
    )
    if user is not None:
        outstanding = outstanding.filter(user=user)

    tokens = list(outstanding)
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in tokens],
        ignore_conflicts=True,
    )
    return len(tokens)
