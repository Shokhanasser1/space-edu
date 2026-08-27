from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower

from apps.validators import image_upload_to


class User(AbstractUser):
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
