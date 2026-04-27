# syntax=docker/dockerfile:1.6
# Glide-HIMS standalone (on-premise) image — pnpm workspace build.
# Build context = repo root.

# ---------- Stage 1: install all workspace deps ----------
FROM node:20-bookworm-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/backend/package.json              packages/backend/package.json
COPY packages/frontend/package.json             packages/frontend/package.json
RUN pnpm install --frozen-lockfile --filter=backend... --filter=frontend...

# ---------- Stage 2: build backend + frontend ----------
FROM deps AS build
WORKDIR /repo
COPY packages ./packages
COPY tsconfig*.json ./
ENV VITE_DEPLOYMENT_MODE=on-premise
RUN pnpm -C packages/backend run build \
 && pnpm -C packages/frontend run build

# ---------- Stage 3: production deps only ----------
FROM deps AS prod-deps
WORKDIR /repo
RUN pnpm install --frozen-lockfile --prod --filter=backend... \
 && pnpm prune --prod || true

# ---------- Stage 4: runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    DEPLOYMENT_MODE=on-premise \
    PORT=3000 \
    TZ=Africa/Kampala
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Preserve full pnpm workspace structure so symlinks resolve correctly.
COPY --from=prod-deps  /repo/node_modules                      ./node_modules
COPY --from=prod-deps  /repo/packages/backend/node_modules     ./packages/backend/node_modules
COPY --from=build      /repo/packages/backend/dist             ./packages/backend/dist
COPY --from=build      /repo/packages/backend/package.json     ./packages/backend/package.json
COPY --from=build      /repo/pnpm-workspace.yaml               ./pnpm-workspace.yaml
COPY --from=build      /repo/package.json                      ./package.json
# Frontend bundle served as static fallback by the backend
COPY --from=build      /repo/packages/frontend/dist            ./public

COPY deployment/standalone/entrypoint.sh        /usr/local/bin/glide-entrypoint
COPY deployment/standalone/bootstrap.js         /app/bootstrap.js
COPY deployment/standalone/bootstrap-schema.sql /app/bootstrap-schema.sql
RUN chmod +x /usr/local/bin/glide-entrypoint

VOLUME ["/app/uploads", "/app/backups", "/app/logs"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fsS http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/glide-entrypoint"]
CMD []
