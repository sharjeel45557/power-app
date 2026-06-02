# syntax=docker/dockerfile:1
#
# Production image for an app built on the power-app framework.
# Multi-stage: build everything with full deps, then ship a slim runtime with
# production dependencies + built artifacts only. The single image serves both
# the JSON API and the React SPA, and runs DB migrations on boot.
#
#   docker build -t power-app:latest .
#   docker run -p 8080:8080 --env-file .env power-app:latest
#
# See docs/deployment-docker.md.

# ---- builder: install all deps and build every package ----
FROM node:22-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Manifests first, so `pnpm install` is cached unless dependencies change.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/cli/package.json ./packages/cli/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Source + build (core, connectors, web SPA, server bundle).
COPY . .
RUN pnpm build

# ---- runner: production-only deps + built artifacts ----
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Recreate the workspace with production dependencies only.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json ./packages/core/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/cli/package.json ./packages/cli/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --prod --frozen-lockfile

# Built output (server resolves ../migrations and ../../web/dist relative to its dist).
COPY --from=builder /repo/packages/core/dist ./packages/core/dist
COPY --from=builder /repo/packages/connectors/dist ./packages/connectors/dist
COPY --from=builder /repo/apps/server/dist ./apps/server/dist
COPY --from=builder /repo/apps/server/migrations ./apps/server/migrations
COPY --from=builder /repo/apps/web/dist ./apps/web/dist

ENV PORT=8080
EXPOSE 8080
USER node

# Liveness probe matching the app's /healthz endpoint (Node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Boots the Fastify host: runs pending migrations, then serves API + SPA.
CMD ["node", "apps/server/dist/index.js"]
