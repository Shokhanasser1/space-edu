"""The messages this system sends to a person, in one place.

Every one of them carries a six-digit code and says what it is for. They are
short on purpose: the reader is a ten-to-eighteen-year-old looking for a number.

**Written in all three languages, one under the other.** The site is at exact
locale parity in `en`, `uz` and `ru` because most of its users do not read
English, and a code they cannot understand the instructions for is a code they
do not use. There is no locale machinery on this side -- Django's translation
framework is not set up and a table of strings in Python would be a second
translation system beside `src/locales` -- so the message simply says the same
three sentences three times. It costs four lines and locks nobody out.

Sending never raises. A message that fails to leave must not take a
registration, a password change or a sign-in attempt down with it -- but it is
logged, loudly, because "the child never got the code" is otherwise invisible.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

from apps.links import frontend_link

from .email_code import CHANGE_EMAIL, LOGIN, PASSWORD_RESET, TTL, VERIFY_EMAIL, store_code

logger = logging.getLogger(__name__)


def _deliver(subject, body, recipient):
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None) or 'noreply@localhost',
            recipient_list=[recipient],
            fail_silently=True,
        )
    except Exception:
        logger.exception('Could not send "%s"', subject)


def _send_code(email, purpose, subject, lines_uz, lines_en, lines_ru, path=''):
    """Issue a code for `purpose`, mail it, and return it.

    The return value is for the caller's logging, never for a response body: a
    code echoed back to whoever asked for it proves nothing about who they are.
    That was a real finding -- `dev_code` in the sign-in response, under a DEBUG
    flag that defaulted to on, was a two-request takeover of any account.
    """
    code = store_code(email, purpose)
    minutes = TTL[purpose] // 60

    body = [
        lines_uz.format(code=code, minutes=minutes),
        '',
        lines_en.format(code=code, minutes=minutes),
        '',
        lines_ru.format(code=code, minutes=minutes),
    ]

    link = frontend_link(path) if path else ''
    if link:
        body += ['', link]

    body += ['', '— UZ COSMOS']
    _deliver(subject, '\n'.join(body), email)

    if settings.DEBUG:
        # Developer convenience without a response-body leak.
        logger.warning('DEV %s code for %s: %s', purpose, email, code)

    return code


def send_sign_in_code(email):
    return _send_code(
        email, LOGIN, 'UZ COSMOS — sign-in code',
        'Kirish kodingiz: {code}\nKod {minutes} daqiqa amal qiladi.',
        'Your sign-in code: {code}\nIt is good for {minutes} minutes.',
        'Ваш код для входа: {code}\nДействует {minutes} минут.',
    )


def send_verification_code(email):
    return _send_code(
        email, VERIFY_EMAIL, 'UZ COSMOS — confirm your e-mail address',
        'Pochtangizni tasdiqlash kodi: {code}\nKod {minutes} daqiqa amal qiladi.',
        'Your confirmation code: {code}\nIt is good for {minutes} minutes.',
        'Код для подтверждения почты: {code}\nДействует {minutes} минут.',
        path='verify-email',
    )


def send_password_reset_code(email):
    return _send_code(
        email, PASSWORD_RESET, 'UZ COSMOS — new password',
        'Yangi parol o‘rnatish kodi: {code}\nKod {minutes} daqiqa amal qiladi.\n'
        'Agar buni siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring.',
        'Your code for setting a new password: {code}\nIt is good for {minutes} minutes.\n'
        'If you did not ask for this, ignore this message.',
        'Код для смены пароля: {code}\nДействует {minutes} минут.\n'
        'Если вы этого не запрашивали, просто не отвечайте на это письмо.',
        path='forgot-password',
    )


def send_email_change_code(new_email):
    return _send_code(
        new_email, CHANGE_EMAIL, 'UZ COSMOS — confirm this address',
        'Ushbu manzilni hisobingizga bog‘lash kodi: {code}\nKod {minutes} daqiqa amal qiladi.',
        'Your code for attaching this address to your account: {code}\n'
        'It is good for {minutes} minutes.',
        'Код для привязки этого адреса к аккаунту: {code}\nДействует {minutes} минут.',
    )


def send_email_change_notice(old_email, new_email):
    """To the address being left, with no code in it.

    Somebody at an unattended keyboard changing the address on an account is how
    it is taken quietly, and the person it belongs to would otherwise find out
    when they could no longer sign in. This is the message that tells them while
    they can still do something about it, and it is deliberately not actionable
    by clicking anything.
    """
    body = '\n'.join([
        f'Hisobingiz manzilini {new_email} ga o‘zgartirish so‘raldi. '
        'Agar bu siz bo‘lmasangiz, darhol parolingizni o‘zgartiring.',
        '',
        f'Somebody asked to change the address on your account to {new_email}. '
        'If that was not you, change your password now.',
        '',
        f'Запрошена смена адреса аккаунта на {new_email}. '
        'Если это были не вы — немедленно смените пароль.',
        '',
        '— UZ COSMOS',
    ])
    _deliver('UZ COSMOS — your address is being changed', body, old_email)
