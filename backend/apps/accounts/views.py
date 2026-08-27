import logging

from django.contrib.auth import authenticate
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .email_code import VERIFY_EMAIL, verify_and_consume
from .emails import send_sign_in_code, send_verification_code
from .models import User
from .serializers import ProfileSerializer, RegisterSerializer, UserSerializer
from .throttles import (
    CredentialRateThrottle,
    EmailVerifyThrottle,
    LoginIpRateThrottle,
    LoginRateThrottle,
    RegisterDailyRateThrottle,
    RegisterRateThrottle,
    record_credential_failure,
)


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
