# The site: the Vite build, served by Caddy with the security headers, and the
# API passed through on the same origin. Built from the repository root by
# deploy/compose.yml.

# Debian rather than Alpine: the same libc as CI, so the same native binaries.
FROM node:20-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .

# Read at build time and inlined into the bundle. The client id is public by
# design (frontend/.env.example); empty means no Google button.
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_URL=/api/v1 \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM caddy:2.10-alpine
COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
