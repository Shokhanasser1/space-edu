"""Throttles for credential endpoints.

`AnonRateThrottle` is the wrong base class here. Its `get_cache_key` returns
`None` as soon as `request.user.is_authenticated`, and a `None` key means
"no limit". Because `throttle_classes` *replaces* the default list, an attacker
who registered one throwaway account and sent their own bearer token got
unlimited password and sign-in-code guesses.

These throttles always key on the client identity, logged in or not. DRF derives
that identity through `NUM_PROXIES`, which base.py pins.

**And they count the right thing.** The first version counted every request to
`/auth/login/`, successful ones included, keyed on the caller's address alone.
A school is one public address: the eleventh child to sign in that hour got
HTTP 429, and so did everybody after them, having done nothing wrong. Sign-ins
that work are not the thing being defended against — wrong guesses are. So the
login throttles record a hit only when the credentials turn out to be wrong,
and they key on the account as well as the address, so one child's typo cannot
spend their classmates' budget.
"""
from rest_framework.throttling import SimpleRateThrottle


def credential_identifier(request):
    """The account a request is trying to reach, however it was addressed.

    Must agree with what `LoginView` looks up, or the two would count different
    things.
    """
    data = request.data if isinstance(getattr(request, 'data', None), dict) else {}
    raw = data.get('email') or data.get('username') or ''
    return str(raw).strip().lower()


class _AlwaysOnRateThrottle(SimpleRateThrottle):
    """Rate-limits every caller, authenticated or anonymous."""

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class _FailureOnlyRateThrottle(SimpleRateThrottle):
    """Checks the budget on the way in; spends it only if the view says to.

    `SimpleRateThrottle.allow_request` records a hit for every request that
    passes. That is right for something whose cost is the request itself — an
    e-mail sent, an account created — and wrong for a password check, where the
    cost is only incurred by the ones that guess wrong.

    The view calls `record_credential_failure(request)` once it knows.
    """

    def allow_request(self, request, view):
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        self.history = self.cache.get(self.key, [])
        self.now = self.timer()
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()

        if len(self.history) >= self.num_requests:
            # Deliberately does not extend the window. Hammering a locked-out
            # bucket should not keep pushing the unlock further away.
            return self.throttle_failure()

        pending = getattr(request, '_credential_throttles', None)
        if pending is None:
            pending = []
            request._credential_throttles = pending
        pending.append(self)
        return True

    def record_failure(self):
        self.history.insert(0, self.now)
        self.cache.set(self.key, self.history, self.duration)


def record_credential_failure(request):
    """Spend one attempt on every failure-only throttle that let this through."""
    for throttle in getattr(request, '_credential_throttles', ()):
        throttle.record_failure()


class LoginRateThrottle(_FailureOnlyRateThrottle):
    """Wrong guesses against one account from one address.

    This is the limit that stops a password being guessed. Keyed on the pair, so
    an attacker cannot lock a victim out of their own account by burning the
    budget from somewhere else, and a classroom behind one address gets one
    bucket per child rather than one between them.
    """

    scope = 'login'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{self.get_ident(request)}|{credential_identifier(request)}',
        }


class LoginIpRateThrottle(_FailureOnlyRateThrottle):
    """Wrong guesses from one address, whatever account they are aimed at.

    Without this, spraying one password across a list of addresses would get a
    fresh bucket per account. Set well above what a room full of people
    mistyping their own passwords produces.
    """

    scope = 'login_ip'

    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class RegisterRateThrottle(_AlwaysOnRateThrottle):
    """Burst limit on account creation.

    Every attempt counts here, unlike login: what is being limited is accounts
    being made, and a successful one is exactly that. Scripted creation is a
    burst; a class signing up together is not.
    """

    scope = 'register'


class RegisterDailyRateThrottle(_AlwaysOnRateThrottle):
    """Daily ceiling on account creation from one address.

    The burst limit alone would let a script run all night at its pace. This
    number has to clear a whole school onboarding in a day, so it cannot be
    small; see the note in base.py before lowering it.
    """

    scope = 'register_day'


class CredentialRateThrottle(_AlwaysOnRateThrottle):
    """Sign-in-code request and verify.

    Every request counts, including the ones that work: each one sends an
    e-mail, and that is the cost being bounded. Keyed on the client *and* the
    target address, so hammering one account from many addresses and one
    address against many accounts are both bounded.
    """

    scope = 'login'

    def get_cache_key(self, request, view):
        email = ''
        if hasattr(request, 'data') and isinstance(request.data, dict):
            email = str(request.data.get('email') or '').strip().lower()
        return self.cache_format % {
            'scope': self.scope,
            'ident': f'{self.get_ident(request)}|{email}',
        }
