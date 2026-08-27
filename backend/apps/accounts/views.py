import logging

from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .email_code import CHANGE_EMAIL, PASSWORD_RESET, VERIFY_EMAIL, verify_and_consume
from .emails import (
    send_email_change_code,
    send_email_change_notice,
    send_password_reset_code,
    send_sign_in_code,
    send_verification_code,
)
from .google import (
    GoogleNotConfigured,
    GoogleRefused,
    resolve_google_user,
    verify_google_id_token,
)
from .models import User
from .serializers import (
    EmailChangeConfirmSerializer,
    EmailChangeRequestSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileSerializer,
    RegisterSerializer,
    UserSerializer,
    check_new_password,
)
from .throttles import (
    CredentialRateThrottle,
    EmailChangeThrottle,
    EmailVerifyThrottle,
    GoogleAuthThrottle,
    LoginIpRateThrottle,
    LoginRateThrottle,
    PasswordChangeThrottle,
    PasswordResetThrottle,
    RegisterDailyRateThrottle,
    RegisterRateThrottle,
    record_credential_failure,
)
from .tokens import revoke_refresh_tokens


logger = logging.getLogger(__name__)


def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]
    # Own scope: sharing the login bucket meant a burst of signups locked
    # legitimate users out of signing in. Two of them: a burst limit that a
    # script trips and a class does not, and a daily ceiling that a script
    # running all night trips and a school onboarding does not.
    throttle_classes = [RegisterRateThrottle, RegisterDailyRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            # Its own savepoint: catching an IntegrityError without one leaves
            # the surrounding transaction broken, so the next query raises
            # TransactionManagementError instead of this returning a 400.
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            # `validate_email` is a filter().exists(), which two requests
            # arriving together both pass; the database constraint is what
            # actually decides. Losing that race is a caller's mistake and a
            # 400, not a 500 with a debug page attached (C-4).
            logger.info('Registration lost the race for an address that now exists.')
            return Response(
                {'email': ['This email is already registered.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The account exists either way: a mail server that is down must not
        # cost somebody the registration they just completed, and the code can
        # be asked for again. Logged rather than swallowed, because "the child
        # never got the code" is otherwise invisible (C-10).
        try:
            send_verification_code(user.email)
        except Exception:
            logger.exception('Registered %s but could not send a confirmation code', user.pk)

        return Response(
            {
                'user': UserSerializer(user, context={'request': request}).data,
                **_get_tokens(user),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    # Both count wrong guesses only. A sign-in that works costs nothing, which
    # is what stops a shared school address locking its own pupils out after
    # ten of them have signed in. See apps/accounts/throttles.py.
    throttle_classes = [LoginRateThrottle, LoginIpRateThrottle]

    def post(self, request):
        raw_id = request.data.get('email') or request.data.get('username') or ''
        identifier = str(raw_id).strip() if raw_id is not None else ''
        raw_pw = request.data.get('password', '')
        password = str(raw_pw) if raw_pw is not None else ''

        if not identifier or not password:
            return Response(
                {'detail': 'Email and password are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Try direct authenticate (works if identifier is username)
        user = authenticate(request, username=identifier, password=password)

        # Fallback: look up by email, then authenticate with username
        if user is None:
            found = User.objects.filter(email__iexact=identifier).order_by('id').first()
            if found is not None:
                user = authenticate(request, username=found.username, password=password)

        if user is None:
            # The only path that spends the budget.
            record_credential_failure(request)
            return Response(
                {'detail': 'Invalid credentials.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **_get_tokens(user),
        })


class LogoutView(APIView):
    """POST { refresh } — end the session by blacklisting the refresh token.

    Deliberately open. The refresh token *is* the credential being revoked, and
    it is presented in the body; demanding a live access token on top of it does
    not protect anything, because anyone holding the refresh token already has
    the account. What it did instead was make the common case unrevokable:

    - the access token lasts 8 hours and the refresh token 7 days, so a tab left
      open overnight sends an expired access token and got 401 here — the
      session then stayed alive for the rest of the week;
    - the browser's own sign-out raced itself. `useAuthStore.logout()` cleared
      the tokens synchronously and the interceptor read them later, so the
      request went out with no Authorization header at all and every single
      sign-out landed here as 401.

    Both were reproduced against a running server on 24 August 2026. On a shared
    school computer that is the whole point of the button not working.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RefreshToken(refresh_token).blacklist()
        except Exception:
            # Already blacklisted, expired or malformed. Nothing to revoke, and
            # saying which would tell a caller whether a token was ever real.
            return Response(
                {'detail': 'Token is invalid, expired, or already blacklisted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    http_method_names = ['get', 'patch']

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return ProfileSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(instance, context={'request': request}).data)


class DeleteAccountView(APIView):
    def delete(self, request):
        request.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EmailLoginCodeRequestView(APIView):
    """POST { email } — mails a 6-digit sign-in code.

    Always answers 200 with the same body. The old version replied 404
    'No account for this email', which turned this into an account-enumeration
    oracle, and echoed the code as `dev_code` whenever DEBUG was on — which, with
    the settings module failing open to development, meant a two-request takeover
    of any account.
    """
    permission_classes = [AllowAny]
    throttle_classes = [CredentialRateThrottle]

    GENERIC_DETAIL = 'If an account exists for that address, a sign-in code has been sent.'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        if not email or '@' not in email:
            return Response({'detail': 'Valid email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            send_sign_in_code(email)

        return Response({'detail': self.GENERIC_DETAIL}, status=status.HTTP_200_OK)


class EmailLoginCodeVerifyView(APIView):
    """POST { email, code } — validates the 6-digit code and returns JWT + user."""
    permission_classes = [AllowAny]
    throttle_classes = [CredentialRateThrottle]

    INVALID = 'Invalid or expired code.'

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        code = (request.data.get('code') or '').strip()
        if not email or not code:
            return Response(
                {'detail': 'Email and code are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(code) != 6 or not code.isdigit():
            return Response({'detail': 'Code must be 6 digits.'}, status=status.HTTP_400_BAD_REQUEST)

        if not verify_and_consume(email, code):
            return Response({'detail': self.INVALID}, status=status.HTTP_401_UNAUTHORIZED)

        # The password path goes through authenticate(), which checks is_active.
        # This path did not, so a banned account still got a "successful login".
        user = User.objects.filter(email__iexact=email, is_active=True).order_by('id').first()
        if user is None:
            return Response({'detail': self.INVALID}, status=status.HTTP_401_UNAUTHORIZED)

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **_get_tokens(user),
        })


class EmailVerifyRequestView(APIView):
    """POST — mails a fresh confirmation code to the caller's own address.

    Nothing is taken from the body: the address is whatever the account holds.
    Letting a caller name one would make this a way to send our mail to any
    address in the world, signed with our name.
    """

    throttle_classes = [EmailVerifyThrottle]

    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response({'detail': 'This address is already confirmed.'})
        if not user.email:
            return Response(
                {'detail': 'This account has no e-mail address to confirm.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        send_verification_code(user.email)
        return Response({'detail': 'A confirmation code has been sent.'})


class EmailVerifyConfirmView(APIView):
    """POST { code } — proves the caller can read mail sent to their address."""

    throttle_classes = [EmailVerifyThrottle]

    INVALID = 'That code is wrong or has expired.'

    def post(self, request):
        user = request.user
        code = str(request.data.get('code') or '').strip()

        if len(code) != 6 or not code.isdigit():
            return Response(
                {'detail': 'Code must be 6 digits.'}, status=status.HTTP_400_BAD_REQUEST
            )

        if user.is_email_verified:
            return Response(UserSerializer(user, context={'request': request}).data)

        if not verify_and_consume(user.email, code, VERIFY_EMAIL):
            # 400 and not 401, deliberately. The caller is signed in; the code is
            # what is wrong. A 401 here would send the front end's interceptor
            # off to refresh a perfectly good token and then sign the child out
            # for mistyping a digit.
            return Response({'detail': self.INVALID}, status=status.HTTP_400_BAD_REQUEST)

        user.email_verified_at = timezone.now()
        user.save(update_fields=['email_verified_at'])
        return Response(UserSerializer(user, context={'request': request}).data)


class PasswordResetRequestView(APIView):
    """POST { email } — mails a code that can set a new password.

    Answers the same 200 whether or not there is an account, exactly as the
    sign-in code endpoint does. Anything else is a list of which children have
    accounts here, readable by anybody who can type addresses.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    GENERIC_DETAIL = 'If an account exists for that address, a code has been sent.'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user is not None:
            send_password_reset_code(user.email)

        return Response({'detail': self.GENERIC_DETAIL})


class PasswordResetConfirmView(APIView):
    """POST { email, code, password, password2 } — set a new password.

    No tokens come back. The code arrived by e-mail, and there is already an
    endpoint that turns an e-mailed code into a session; a second door into the
    same room is one more than is needed. Whoever just set the password can sign
    in with it.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    INVALID = 'That code is wrong or has expired.'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = User.objects.filter(email__iexact=data['email'], is_active=True).first()
        if user is None or not verify_and_consume(data['email'], data['code'], PASSWORD_RESET):
            # One message for "no such account" and "wrong code", because
            # telling them apart is the enumeration oracle again.
            return Response({'detail': self.INVALID}, status=status.HTTP_401_UNAUTHORIZED)

        check_new_password(data['password'], data['password2'], user=user)
        user.set_password(data['password'])
        user.save(update_fields=['password'])

        revoked = revoke_refresh_tokens(user)
        logger.info('Password reset for user %s; %s refresh tokens revoked', user.pk, revoked)

        return Response({'detail': 'Your password has been changed. You can sign in with it now.'})


class PasswordChangeView(APIView):
    """POST { current_password, password, password2 } — change it from inside.

    A fresh token pair comes back, because everything else this account had open
    has just been revoked and that would otherwise include the tab doing the
    changing.
    """

    throttle_classes = [PasswordChangeThrottle]

    def post(self, request):
        user = request.user
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # An account can have no usable password for two reasons, and only one
        # of them is harmless. One: it arrived through Google and never had one.
        # Two: `rotate_leaked_credentials` took it away, which is what this
        # project does when a password is known to have leaked.
        #
        # Letting either set a new password on the strength of a bearer token
        # alone reopens the second. That command blacklists every refresh token
        # and clears every session, but an access token cannot be revoked and
        # lives eight hours (apps/accounts/tokens.py) -- so for those eight
        # hours whoever held the leaked account could have set a password of
        # their own and kept it for good.
        #
        # So there is no password-free path through here. Setting a first
        # password goes through the reset flow, which sends a code to the
        # address on the account and therefore asks for something a stolen token
        # does not carry.
        if not user.has_usable_password():
            return Response(
                {
                    'detail': 'This account has no password yet. Ask for a code at '
                              '/auth/password/reset/request/ and set one with it.',
                    'code': 'no_password_set',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(data.get('current_password') or ''):
            return Response(
                {'current_password': ['That is not your current password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        check_new_password(data['password'], data['password2'], user=user)
        user.set_password(data['password'])
        user.save(update_fields=['password'])

        revoked = revoke_refresh_tokens(user)
        logger.info('Password changed for user %s; %s refresh tokens revoked', user.pk, revoked)

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **_get_tokens(user),
        })


class EmailChangeRequestView(APIView):
    """POST { new_email, current_password } — start moving the account.

    `email` does not move yet. A typo written straight into it locks a child out
    of their own account with nothing left to prove which address was theirs, so
    the new one waits in `pending_email` until a code sent *to it* comes back.
    """

    throttle_classes = [EmailChangeThrottle]

    def post(self, request):
        user = request.user
        serializer = EmailChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        new_email = data['new_email'].strip().lower()

        # An unattended tab on a school computer must not be able to move the
        # identity of the account it is signed in to, and neither must a bearer
        # token that outlived the credential it came from. Both are the same
        # hole: something that proves possession of a session, presented instead
        # of something that proves possession of the account.
        #
        # An account with no usable password cannot pass that test at all, so it
        # is sent to set one first -- through the reset flow, which proves the
        # address rather than the session.
        if not user.has_usable_password():
            return Response(
                {
                    'detail': 'Set a password on this account before moving its address. '
                              'Ask for a code at /auth/password/reset/request/.',
                    'code': 'no_password_set',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(data.get('current_password') or ''):
            return Response(
                {'current_password': ['That is not your current password.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_email == (user.email or '').lower():
            return Response(
                {'new_email': ['That is already the address on this account.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
            return Response(
                {'new_email': ['That address already belongs to an account.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.pending_email = new_email
        user.save(update_fields=['pending_email'])

        send_email_change_code(new_email)
        if user.email:
            # To the address being left, with no code in it and nothing to
            # click. Somebody finding out their address is being moved while
            # they can still do something about it is the whole of this message.
            send_email_change_notice(user.email, new_email)

        return Response({'pending_email': new_email})


class EmailChangeConfirmView(APIView):
    """POST { code } — finish moving the account to the address that got the code."""

    throttle_classes = [EmailChangeThrottle]

    INVALID = 'That code is wrong or has expired.'

    def post(self, request):
        user = request.user
        serializer = EmailChangeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not user.pending_email:
            return Response(
                {'detail': 'No address change was asked for.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not verify_and_consume(
            user.pending_email, serializer.validated_data['code'], CHANGE_EMAIL
        ):
            return Response({'detail': self.INVALID}, status=status.HTTP_400_BAD_REQUEST)

        # Checked again here and not only at request time: somebody may have
        # registered that address in the half hour since, and the constraint
        # would refuse this with a 500 rather than an explanation.
        if User.objects.filter(email__iexact=user.pending_email).exclude(pk=user.pk).exists():
            user.pending_email = ''
            user.save(update_fields=['pending_email'])
            return Response(
                {'detail': 'That address was taken while you were confirming it.'},
                status=status.HTTP_409_CONFLICT,
            )

        user.email = user.pending_email
        user.pending_email = ''
        user.email_verified_at = timezone.now()
        user.save(update_fields=['email', 'pending_email', 'email_verified_at'])

        revoked = revoke_refresh_tokens(user)
        logger.info('Address changed for user %s; %s refresh tokens revoked', user.pk, revoked)

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **_get_tokens(user),
        })


class EmailChangeCancelView(APIView):
    """POST — forget an address change that was started and not finished."""

    throttle_classes = [EmailChangeThrottle]

    def post(self, request):
        user = request.user
        if user.pending_email:
            user.pending_email = ''
            user.save(update_fields=['pending_email'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class GoogleAuthView(APIView):
    """POST { credential } — sign in with the ID token Google's button returned.

    The same response shape as `LoginView`, plus three flags the client acts on:
    whether the account was just created, whether it has to set a password
    before it can do anything else, and whether its profile is still missing
    what registration would have asked for.
    """

    permission_classes = [AllowAny]
    throttle_classes = [GoogleAuthThrottle]

    def post(self, request):
        credential = str(request.data.get('credential') or '').strip()
        if not credential:
            return Response(
                {'detail': 'No sign-in was received from Google.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claims = verify_google_id_token(credential)
        except GoogleNotConfigured:
            return Response(
                {
                    'detail': 'Signing in with Google is not set up on this server.',
                    'code': 'google_unconfigured',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            # Everything google-auth rejects arrives as this: a bad signature, an
            # expired token, one minted for somebody else's application. The
            # reason is logged and not returned -- and the credential itself is
            # never logged, because it is a bearer token until it expires.
            logger.warning('Google sign-in refused: %s', exc)
            return Response(
                {'detail': 'That Google sign-in could not be verified.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user, created, password_reset_required = resolve_google_user(claims)
        except GoogleRefused as refusal:
            return Response(
                {'detail': refusal.detail, 'code': refusal.code},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            **_get_tokens(user),
            'created': created,
            'password_reset_required': password_reset_required,
            'profile_complete': user.date_of_birth is not None,
        })
