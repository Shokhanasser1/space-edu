"""Ending sessions that are already open.

**Read the limitation before relying on this.** Access tokens live thirty
minutes (`SIMPLE_JWT.ACCESS_TOKEN_LIFETIME`; eight hours until October 2026) and
cannot be revoked at all -- they are verified by signature, and nothing is
looked up. Blacklisting the refresh tokens means no new access token can be
minted, which caps whoever is holding one at the rest of its thirty minutes. It
does not throw them out now.

That is a real gap and it is deliberate to leave it here rather than paper over
it: closing it needs a claim on the token that is checked against the account on
every request, which is a change to how every endpoint authenticates. Until
that exists, nothing in this file should be described as "signs the attacker
out", because it does not.

Extracted from `rotate_leaked_credentials`, which had the only copy and now
calls this one.
"""
import logging

from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

logger = logging.getLogger(__name__)


class RefreshSerializer(TokenRefreshSerializer):
    """SimpleJWT's refresh, with a deleted account answered as a 401.

    Its `validate` looks the account up with `.get()`, so a refresh token that
    outlived its account -- deleted by its owner, or from the admin panel --
    raised DoesNotExist: a 500, with a debug page while DEBUG defaults to on.
    Wired in by SIMPLE_JWT['TOKEN_REFRESH_SERIALIZER'].
    """

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except get_user_model().DoesNotExist:
            raise AuthenticationFailed(
                'No active account found for the given token.', 'no_active_account',
            )


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
