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

    def __str__(self):
        return self.username
