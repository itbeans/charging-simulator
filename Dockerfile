# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Copy package manifests first for layer cache efficiency
COPY package.json package-lock.json ./

# Install ALL dependencies (devDeps required for TypeScript compiler)
RUN npm ci

# Copy TypeScript source
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript → dist/
RUN npm run build

# Remove devDependencies; keep only production deps for the runtime image
RUN npm prune --omit=dev

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner

ENV NODE_ENV=production

WORKDIR /app

# Copy compiled JavaScript output from builder
COPY --from=builder /build/dist ./dist

# Copy pruned production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules

# Bake in config.example.json as config.json.
# loadConfig() requires this file to exist at startup; it exits with code 1 if missing.
# All sensitive values (serverUrl, idTag) are overridden at runtime via env vars
# injected by Cloud Run from Secret Manager.
# Non-sensitive fields (vendor, model, connectors, intervals) come from this file
# and serve as production defaults — update config.example.json to change them.
COPY config.example.json ./config.json

# Run as a non-root user for security
RUN addgroup --system --gid 1001 simulator \
 && adduser  --system --uid 1001 --ingroup simulator simulator \
 && chown -R simulator:simulator /app

USER simulator

# Default command is 'boot' (long-running daemon).
# Override CMD in Cloud Run Jobs to run: session | multi | fleet
ENTRYPOINT ["node", "dist/index.js"]
CMD ["boot"]
