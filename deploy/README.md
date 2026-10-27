# Deploying UZ COSMOS

One Ubuntu 24.04 server, Docker Compose, everything started by
`deploy/deploy.sh` from a laptop with ssh access. From PowerShell use
`.\deploy\deploy.ps1` with the same arguments — it runs the script in Git Bash,
because a bare `bash` there is WSL, with other ssh keys.

```
internet ──443──> edge Caddy (/opt/edge)        certificates; one file per project in sites/
                     │  network "edge"
                     ▼
                  web: Caddy + the Vite build      security headers, SPA routing  (deploy/web/Caddyfile)
                     │  /api/  /admin/  /static/
                     ▼
                  api: Django under gunicorn  ──>  Neon Postgres (DB_URL), Cloudflare R2, Gmail
                     │
                  redis                            sign-in codes, throttles (memory only)
```

The edge proxy is shared: a second project on the same server joins the `edge`
network and drops its own `sites/<name>.caddy` next to ours.

## First time on a server

1. `cp deploy/deploy.conf.example deploy/deploy.conf` and fill in `HOST` (an
   ssh login with sudo) and `DOMAIN` (an A record pointing at the server).
2. `bash deploy/deploy.sh setup` — Docker, ports 80/443 in ufw, `/opt/edge`
   and `/opt/uzcosmos`. Asks for the sudo password once.
3. `bash deploy/deploy.sh env` — writes `/opt/uzcosmos/.env` from
   `backend/.env`, with a new `SECRET_KEY` and the domain filled into
   `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` and
   `FRONTEND_URL`. Re-running it keeps the server's key.
4. `bash deploy/deploy.sh` — the first release.
5. In Google Cloud Console, add `https://<DOMAIN>` to the OAuth client's
   authorised JavaScript origins, or the Google button refuses to load.

## Every release

```bash
git push origin main
bash deploy/deploy.sh            # origin/main
bash deploy/deploy.sh 1a2b3c4d   # any ref; also how to roll back
```

The release is `git archive` of that commit, so only what is committed travels.
On the server it is built, `migrate` runs, the containers are replaced, and the
five newest releases are kept under `/opt/uzcosmos/releases/`.

## Things that will bite

- **The production settings refuse to start** without a 50-character
  `SECRET_KEY` or with a mail backend that delivers nothing — registration
  needs the e-mail. The reason is in `docker compose logs api`.
- **The Content-Security-Policy is an allow-list** (`deploy/web/Caddyfile`).
  A new script, iframe or `fetch` to another host fails silently until its host
  is added there; the browser console says which.
- **The database is the team's Neon** — the owner's choice on 28 October 2026.
  Every developer with `backend/.env` writes to the same data the site shows,
  and a migration applied from a branch reaches production at once.
- Logs: `cd /opt/uzcosmos/current/deploy && docker compose logs -f api web`.
