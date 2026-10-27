#!/usr/bin/env bash
# Runs on the server, from inside a freshly unpacked release, as the deploy user
# (who is in the docker group, so no sudo). Called by deploy/deploy.sh:
#   bash /opt/uzcosmos/releases/<sha>/deploy/remote-release.sh <domain>
set -euo pipefail

DOMAIN="${1:?usage: remote-release.sh <domain>}"
RELEASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT=/opt/uzcosmos
EDGE=/opt/edge

[ -f "$ROOT/.env" ] || { echo "No $ROOT/.env yet. Run: bash deploy/deploy.sh env" >&2; exit 1; }

# The shared proxy is installed once and then left alone: other projects' files
# sit beside ours in sites/, and whoever runs the server may have changed it.
if [ ! -f "$EDGE/compose.yml" ]; then
  cp "$RELEASE_DIR/deploy/edge/compose.yml" "$RELEASE_DIR/deploy/edge/Caddyfile" "$EDGE/"
fi
mkdir -p "$EDGE/sites"
docker compose -f "$EDGE/compose.yml" up -d   # also creates the `edge` network

# Docker applies ip_range only when it creates a network. If `edge` was made
# some other way, a container started without a fixed address could take the
# edge's or the site's, and the site would trust or proxy to the wrong one.
range="$(docker network inspect edge --format '{{range .IPAM.Config}}{{.IPRange}}{{end}}')"
if [ "$range" != "10.200.0.128/25" ]; then
  echo "The edge network hands out fixed addresses to anyone (IPRange '$range')." >&2
  echo "Recreate it: stop every stack on it, docker network rm edge, deploy again." >&2
  exit 1
fi

cd "$RELEASE_DIR/deploy"
ln -sfn "$ROOT/.env" .env

docker compose build
# The database is the team's Neon (docs/HANDOVER.md), so this is usually a no-op:
# whoever wrote a migration has already applied it there.
docker compose run --rm --no-deps api python manage.py migrate --noinput
docker compose up -d --remove-orphans

site="$EDGE/sites/uzcosmos.caddy"
sed "s/__DOMAIN__/$DOMAIN/" "$RELEASE_DIR/deploy/edge/uzcosmos.caddy" > "$site.new"
if cmp -s "$site.new" "$site"; then
  rm "$site.new"
else
  mv "$site.new" "$site"
  docker compose -f "$EDGE/compose.yml" exec -T caddy caddy reload --config /etc/caddy/Caddyfile
fi

ln -sfn "$RELEASE_DIR" "$ROOT/current"

# The five newest releases stay, for `deploy.sh <older sha>`.
ls -1dt "$ROOT"/releases/*/ | tail -n +6 | xargs -r rm -rf
docker image prune -f > /dev/null
docker compose ps
