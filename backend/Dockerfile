# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Single-container build: the API server also serves the built SPA from the same
# origin (see backend/src/app.ts, which resolves ../../frontend/dist). One
# image, one process, no CORS — matching how it runs in production.
#
# The relative layout below is load-bearing: app.ts locates the frontend at
# <backend>/../frontend/dist, so the directory tree must keep its two levels.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build the frontend ─────────────────────────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend

# Dependencies first so a source-only change reuses this layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# VITE_API_URL is intentionally not set: the SPA then talks to "/api"
# same-origin, which is exactly what the single-server setup provides.
RUN npm run build

# ── Stage 2: production backend dependencies ────────────────────────────────
FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
# tsx is a *runtime* dependency, not a dev one: this project is ESM with
# extensionless imports, which plain `tsc` output cannot resolve, so the server
# is executed through tsx in production as well as development. That keeps the
# production runtime byte-identical to the one the test suite exercises.
RUN npm ci --omit=dev && npm install --no-save tsx

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
# The working directory is the backend package itself, not /app: node resolves
# `--import tsx` from the CWD, and multer stages uploads into
# path.join(process.cwd(), "temp") — so this directory must be the one holding
# node_modules, or both break.
WORKDIR /app/backend

# tini reaps zombies and forwards signals, so SIGTERM reaches node and the
# graceful path in index.ts actually runs.
RUN apk add --no-cache tini

ENV NODE_ENV=production
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./package.json
# src/ only: tests, scripts and the TS sources for tests have no business in
# the shipped image.
COPY backend/src ./src

# app.ts resolves the SPA at <backend>/../frontend/dist, which keeps working
# from this CWD because it is derived from import.meta.url, not the CWD.
COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

# Run unprivileged. node:alpine ships a `node` user (uid 1000).
RUN chown -R node:node /app
USER node

EXPOSE 5000

# /health/live has no dependencies on purpose, so a database blip cannot cause
# the orchestrator to kill a healthy process. Readiness lives at /health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx", "src/index.ts"]