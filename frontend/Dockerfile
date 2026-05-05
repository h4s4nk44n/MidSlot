# syntax=docker/dockerfile:1.7
# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:20-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_* envs are inlined into the client bundle at build time, so the
# API URL must be passed as a build arg — runtime env vars cannot change it.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
 && addgroup -S app \
 && adduser -S -G app app

# `output: "standalone"` produces a self-contained server bundle that already
# includes a minimal node_modules tree — no need to ship the full deps.
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static

USER app

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["node", "server.js"]
