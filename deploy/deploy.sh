#!/usr/bin/env bash
# Deploys UZ COSMOS to the server named in deploy/deploy.conf. From the
# repository root, in Git Bash or any POSIX shell with ssh:
#
#   bash deploy/deploy.sh setup    once per server; asks for the sudo password
#   bash deploy/deploy.sh env      writes the server's secrets from backend/.env
#   bash deploy/deploy.sh [REF]    releases REF, default origin/main
#
# See deploy/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

conf=deploy/deploy.conf
[ -f "$conf" ] || { echo "Copy deploy/deploy.conf.example to $conf and fill it in." >&2; exit 1; }
. "./$conf"
: "${HOST:?HOST is missing from $conf}" "${DOMAIN:?DOMAIN is missing from $conf}"

ROOT=/opt/uzcosmos

case "${1:-}" in
setup)
  scp deploy/server-setup.sh "$HOST:/tmp/uzcosmos-server-setup.sh"
  ssh -t "$HOST" 'sudo bash /tmp/uzcosmos-server-setup.sh "$(whoami)"; rm -f /tmp/uzcosmos-server-setup.sh'
  ;;

env)
  src=backend/.env
  # Values that must differ on the server -- above all DB_URL, so the site
  # does not run on the database credentials every developer holds. Optional
  # and git-ignored (.env.*); what it sets wins over backend/.env.
  prod=backend/.env.production
  [ -f "$src" ] || { echo "No $src to copy from." >&2; exit 1; }
  vars() { if [ -f "$1" ]; then tr -d '\r' < "$1" | grep -E '^[A-Za-z_][A-Za-z0-9_]*='; fi; true; }
  # Compose would read ${...} inside a value as a variable and substitute it.
  if { vars "$src"; vars "$prod"; } | cut -d= -f2- | grep -q '\$'; then
    echo "A value in $src or $prod contains \$, which compose would substitute. Change it first." >&2
    exit 1
  fi
  server_only='SECRET_KEY|DEBUG|ALLOWED_HOSTS|CORS_ALLOWED_ORIGINS|CORS_ALLOWED_ORIGIN_REGEXES|CSRF_TRUSTED_ORIGINS|FRONTEND_URL|REDIS_URL|TEST_DB_URL|NUM_PROXIES|DJANGO_SETTINGS_MODULE'
  overridden="$(vars "$prod" | cut -d= -f1 | paste -sd'|' -)"
  # Everything from the laptop's file except what has to differ on a server.
  # The values go file -> ssh -> file; none of them is printed.
  {
    echo "# Written by deploy/deploy.sh env from backend/.env (+ .env.production), $(date -u +%F). Edit there and re-run."
    # `|| true`: grep -v with nothing left to print exits 1, and under set -e
    # that would end this block before the lines below are written.
    vars "$src" | grep -vE "^($server_only${overridden:+|$overridden})=" || true
    vars "$prod" | grep -vE "^($server_only)=" || true
    echo "SECRET_KEY=$(python -c 'import secrets; print(secrets.token_urlsafe(64))' | tr -d '\r')"
    echo "ALLOWED_HOSTS=$DOMAIN"
    echo "CORS_ALLOWED_ORIGINS=https://$DOMAIN"
    echo "CSRF_TRUSTED_ORIGINS=https://$DOMAIN"
    echo "FRONTEND_URL=https://$DOMAIN"
  } | ssh "$HOST" "set -e; umask 077; cd $ROOT; cat > .env.new
    # Keep the key the server already signs with: a new one signs everybody out.
    if grep -q '^SECRET_KEY=.' .env 2>/dev/null; then
      grep -v '^SECRET_KEY=' .env.new > .env.tmp; grep '^SECRET_KEY=' .env >> .env.tmp; mv .env.tmp .env.new
    fi
    mv .env.new .env
    echo \"$ROOT/.env: \$(grep -c '^[A-Z]' .env) settings. A running site picks them up on the next deploy.\""
  ;;

*)
  ref="${1:-origin/main}"
  git fetch --quiet origin
  sha="$(git rev-parse --short=12 "$ref^{commit}")"
  echo "Releasing $ref ($sha) to $HOST as https://$DOMAIN"
  # Only what is committed at that ref travels: no .env, no node_modules, no local edits.
  git archive --format=tar "$sha" | ssh "$HOST" "set -e; d=$ROOT/releases/$sha; rm -rf \$d; mkdir -p \$d; tar -x -C \$d"
  ssh "$HOST" "bash $ROOT/releases/$sha/deploy/remote-release.sh '$DOMAIN'"
  for path in / /api/v1/news/on-this-day/; do
    curl -sS -o /dev/null --retry 5 --retry-all-errors --retry-delay 3 \
      -w "%{http_code}  https://$DOMAIN$path\n" "https://$DOMAIN$path"
  done
  ;;
esac
