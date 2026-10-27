# The API: Django under gunicorn. Built from the repository root by
# deploy/compose.yml.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=base.settings.production

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .

# collectstatic loads the production settings, which refuse to start without a
# real key and a mail server. Neither is used to copy files, so the build gets
# placeholders; the running container gets the real values from deploy/.env.
RUN SECRET_KEY=build-only-placeholder-it-signs-nothing-0123456789abcdef \
    EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend \
    EMAIL_HOST=build.invalid \
    python manage.py collectstatic --noinput

RUN useradd --system --uid 10001 app
USER app

EXPOSE 8000
# Threads, because a request can wait on Gmail, Gemini or a space API for
# seconds; a sync worker would be held for all of it.
CMD ["gunicorn", "base.wsgi", "--bind", "0.0.0.0:8000", \
     "--workers", "3", "--threads", "4", "--timeout", "60", \
     "--access-logfile", "-"]
