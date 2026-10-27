#!/usr/bin/env bash
# Once per server, as root: Docker, the web ports, and the directories the
# deploy user writes to. Run by `bash deploy/deploy.sh setup`.
set -euo pipefail

DEPLOY_USER="${1:?usage: server-setup.sh <deploy user>}"

# Ubuntu's own packages: no third-party apt repository to trust and keep up.
apt-get update -q
apt-get install -y -q docker.io docker-compose-v2
systemctl enable --now docker

# Root-equivalent, and what lets every later deploy run without sudo.
usermod -aG docker "$DEPLOY_USER"

ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp

install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" /opt/edge /opt/edge/sites /opt/uzcosmos /opt/uzcosmos/releases

echo "Done: $(docker --version); $DEPLOY_USER is in the docker group from the next login."
