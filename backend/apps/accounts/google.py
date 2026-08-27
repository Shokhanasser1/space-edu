"""Turning a Google ID token into an account here.

Two functions, deliberately apart. `verify_google_id_token` is the only place
the library is called and the only thing that touches the network, so it is the
one seam a test replaces -- no test in this suite reaches Google. Everything
that decides which account somebody lands in is in `resolve_google_user`, which
takes a dictionary and can be exercised exhaustively.

The flow is the ID-token one, not the authorisation-code one. The browser gets a
signed assertion from Google and posts it here; there is no client secret
anywhere in it, which is why the client id is safe in the public bundle and why
there is no secret in this repository that could leak.
"""
import logging

from django.conf import settings
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .models import SocialAccount, User
from .serializers import RegisterSerializer
from .tokens import revoke_refresh_tokens

logger = logging.getLogger(__name__)

GOOGLE_ISSUERS = ('accounts.google.com', 'https://accounts.google.com')


class GoogleNotConfigured(Exception):
    """No client id, so there is nothing to check the token against."""


class GoogleRefused(Exception):
    """The token is fine and we are still not signing this person in."""

    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code
        self.detail = detail


def verify_google_id_token(credential):
    """Check the signature, the expiry and who the token was minted for.

    Raises GoogleNotConfigured, or ValueError for anything the library rejects.

    **The audience check is the whole of the security here.** Passing
    `audience=None` disables it, and google-auth accepts that silently -- which
    would turn this endpoint into "any Google ID token minted for any
    application on the internet signs you in as whatever address it names". So
    an unset client id refuses before the library is called, rather than
    reaching a permissive branch nobody asked for (C-7).
    """
    client_id = (getattr(settings, 'GOOGLE_CLIENT_ID', '') or '').strip()
    if not client_id:
        raise GoogleNotConfigured()

    claims = id_token.verify_oauth2_token(
        credential, google_requests.Request(), audience=client_id
    )

    # verify_oauth2_token checks signature, exp and aud. It does not check iss.
    if claims.get('iss') not in GOOGLE_ISSUERS:
        raise ValueError(f'unexpected issuer: {claims.get("iss")!r}')

    return claims


def _single_user_for_email(email):
    """The one account holding that address, or None.

    After migration 0005 there cannot be two. If there ever are, this refuses
    rather than picking -- guessing which child's account to hand somebody is
    not a thing to do on a best-effort basis.
    """
    matches = list(User.objects.filter(email__iexact=email).order_by('id')[:2])
    if len(matches) > 1:
        logger.error('Two accounts hold %s; refusing to choose between them.', email)
        raise GoogleRefused(
            'ambiguous_account',
            'More than one account uses that address. Ask us to sort it out.',
        )
    return matches[0] if matches else None


def resolve_google_user(claims):
    """claims -> (user, created, password_reset_required).

    Raises GoogleRefused with a reason when the answer is "not this person".
    """
    if claims.get('email_verified') is not True:
        # Google has not proved the address either, and every branch below keys
        # on it. An address nobody has proved must not match an account, and an
        # account created from one becomes a match for somebody else later.
        raise GoogleRefused(
            'google_email_unverified',
            'Google has not confirmed that address. Confirm it with Google first.',
        )

    email = (claims.get('email') or '').strip().lower()
    sub = (claims.get('sub') or '').strip()
    if not email or not sub:
        raise GoogleRefused('incomplete_token', 'That sign-in did not carry enough to use.')

    link = SocialAccount.objects.filter(
        provider=SocialAccount.GOOGLE, uid=sub
    ).select_related('user').first()

    if link is not None:
        if not link.user.is_active:
            # The password path goes through authenticate(), which checks this.
            # The e-mail code path did not, once, and a banned account got a
            # successful sign-in out of it.
            raise GoogleRefused('inactive', 'That account is not available.')
        link.last_used_at = timezone.now()
        link.save(update_fields=['last_used_at'])
        # The address on the Google account may have changed since. It is not
        # copied over: an account's address here is its identity, and moving it
        # because a provider moved theirs is something the person should do
        # themselves, knowingly.
        return link.user, False, False

    existing = _single_user_for_email(email)

    if existing is None:
        user = _create_from_google(claims, email)
        SocialAccount.objects.create(
            provider=SocialAccount.GOOGLE, uid=sub, user=user, email_at_link=email,
            last_used_at=timezone.now(),
        )
        return user, True, False

    if not existing.is_active:
        raise GoogleRefused('inactive', 'That account is not available.')

    # Linking to an account that already holds the address. Safe *because* of
    # the email_verified check above: Google has proved the address and controls
    # the proof.
    #
    # One case is not safe, and it is the one an attacker uses. Registration
    # hands out tokens immediately and asks for no confirmation, so anybody can
    # make an account on a victim's address and wait. When the victim later
    # signs in with Google, they land in the attacker's account -- and the
    # attacker still knows its password.
    #
    # So an account we have never had proof of is linked and *emptied of its
    # password*: whoever set it can no longer sign in with it, and the person
    # Google vouched for is asked to set a new one. It costs a legitimate child
    # one password reset and costs an attacker the account. Refusing instead
    # would leave the victim with no way in at all.
    password_reset_required = False
    if existing.email_verified_at is None:
        if existing.has_usable_password():
            existing.set_unusable_password()
            password_reset_required = True
        existing.email_verified_at = timezone.now()
        existing.save(update_fields=['password', 'email_verified_at'])
        revoked = revoke_refresh_tokens(existing)
        logger.warning(
            'Google linked to unconfirmed account %s; password cleared, %s tokens revoked',
            existing.pk, revoked,
        )

    SocialAccount.objects.create(
        provider=SocialAccount.GOOGLE, uid=sub, user=existing, email_at_link=email,
        last_used_at=timezone.now(),
    )
    return existing, False, password_reset_required


def _create_from_google(claims, email):
    """A new account, with as little of Google's copy of a child as possible.

    `given_name` and `family_name` fill first and last name because those are
    what registration asks for anyway and what chat already shows.

    `picture` is not fetched and not stored, and its URL is not kept either.
    Avatars here live in a bucket that is public and unsigned, so copying one
    would publish a photograph of a child that they did not choose to upload, to
    anyone who guesses the URL. `name` adds nothing over the two parts. If a
    future reader is tempted to "complete" this: that is the C-11 decision, and
    it was made deliberately.

    `date_of_birth` stays empty. Registration requires it and Google does not
    give it, so the client asks afterwards rather than inventing one.
    """
    user = User.objects.create_user(
        username=RegisterSerializer._generate_username(email),
        email=email,
        first_name=(claims.get('given_name') or '')[:150],
        last_name=(claims.get('family_name') or '')[:150],
        role=User.Role.STUDENT,
        email_verified_at=timezone.now(),
    )
    user.set_unusable_password()
    user.save(update_fields=['password'])

    # The same two profiles registration creates. Without them the first page
    # the new account lands on has nothing to read.
    from apps.gamification.models import UserGamificationProfile
    UserGamificationProfile.objects.get_or_create(user=user)
    try:
        from apps.challenges.models import UserStreak
        UserStreak.objects.get_or_create(user=user)
    except Exception:
        logger.exception('Could not create a streak row for new Google account %s', user.pk)

    return user
