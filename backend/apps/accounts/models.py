from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from apps.validators import image_upload_to


class User(AbstractUser):
    class Role(models.TextChoices):
        """What a person is here. Not what they are allowed to do.

        `is_staff` already exists and already means one thing: may reach the
        Django admin and the admin API. Every gate in this project reads it --
        IsAdminUser, AdminWriteOrReadOnly, the report queue, StaffRoute on the
        front end. This is deliberately *not* wired into any of them.

        The two are kept apart on purpose. Repointing those gates at `role` is
        its own piece of work with its own test matrix, and doing it in half the
        places is exactly how the answer key stayed readable in three endpoints
        after being fixed in the fourth. And a role is a label an administrator
        types; if setting it also granted admin access, a mislabelled pupil
        would be an administrator.

        So today `role` grants nothing. The day somebody wires it into a gate,
        they will have to change a test that says a teacher can do nothing a
        student cannot -- which is the point at which to think about it.
        """

        STUDENT = 'student', 'Student'
        TEACHER = 'teacher', 'Teacher'
        ADMIN = 'admin', 'Admin'

    role = models.CharField(
        max_length=10, choices=Role.choices, default=Role.STUDENT, db_index=True
    )
    avatar = models.ImageField(upload_to=image_upload_to('avatars'), blank=True)
    astronaut_name = models.CharField(max_length=50, blank=True)
    bio = models.TextField(max_length=300, blank=True)
    selected_spaceship = models.CharField(max_length=50, default='rocket_basic')
    date_of_birth = models.DateField(null=True, blank=True)

    # When the address was proved, not whether. A timestamp answers "when",
    # survives being set a second time after the address changes, and is worth
    # something in the admin; a boolean answers less for the same column. It is
    # never put in a response -- `email_verified` there is the boolean, because
    # a timestamp tells a reader when a particular child was at a computer and
    # nothing needs to know that.
    email_verified_at = models.DateTimeField(null=True, blank=True)

    # An address asked for but not yet proved. It lives on the row rather than
    # in the cache because the profile screen has to show "waiting on a@b.uz --
    # resend, or cancel", and a cache eviction must not strand somebody halfway
    # through moving their account. `email` itself is not touched until the code
    # comes back: a typo written straight into it would lock a child out of
    # their own account with no way to prove which address was really theirs.
    pending_email = models.EmailField(blank=True)
    language = models.CharField(
        max_length=2,
        choices=[('en', 'ENG'), ('uz', 'UZB'), ('ru', 'RUS')],
        default='en',
    )

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        constraints = [
            # One address, one account -- the thing a password reset and a
            # linked Google account both assume and neither could rely on.
            #
            # `unique=True` on the field would be the obvious way and is wrong
            # twice over. It is case-sensitive on PostgreSQL, so `A@x.uz` and
            # `a@x.uz` would both be allowed while every lookup in this project
            # (`validate_email`, `LoginView`, the sign-in codes) is `iexact` and
            # would still find two. And `email` is `blank=True`, stored as ''
            # rather than NULL, which PostgreSQL treats as an ordinary value --
            # so every superuser created without an address would collide with
            # every other one the moment the constraint landed.
            models.UniqueConstraint(
                Lower('email'),
                condition=~models.Q(email=''),
                name='accounts_user_email_ci_unique',
            ),
        ]

    @property
    def is_email_verified(self):
        return self.email_verified_at is not None

    def __str__(self):
        return self.username


class SocialAccount(models.Model):
    """An account somewhere else that signs in to an account here.

    A table rather than a `google_sub` column on User, for three reasons. The
    provider's id is a credential, and keeping it off the user row means no
    ModelSerializer listing fields can ever put it in a response -- which is the
    exact shape of the finding that once published `correct_answer` and
    children's real names. It keeps what the provider asserted about a child
    away from the child's own profile row. And a second provider later is a row
    here instead of another nullable column and another migration.

    The key is the provider's subject id, never the e-mail address: people
    change the address on their Google account, and following that by silently
    moving which account somebody signs in to is not a thing to do quietly.
    """

    GOOGLE = 'google'
    PROVIDERS = [(GOOGLE, 'Google')]

    provider = models.CharField(max_length=20, choices=PROVIDERS)
    uid = models.CharField(max_length=255)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='social_accounts')
    # What the provider said the address was when the link was made. Kept for
    # the admin to look at when somebody asks why they are in the wrong account,
    # and deliberately not used for anything.
    email_at_link = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # One provider account signs in to one account here...
            models.UniqueConstraint(
                fields=['provider', 'uid'], name='social_provider_uid_unique',
            ),
            # ...and one account here has at most one of each provider, so
            # "which Google account is this" has an answer.
            models.UniqueConstraint(
                fields=['provider', 'user'], name='social_provider_user_unique',
            ),
        ]

    def __str__(self):
        return f'{self.provider}:{self.uid} -> {self.user_id}'
