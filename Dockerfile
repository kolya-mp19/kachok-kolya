# ─── Stage 1: production dependencies only ────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# ─── Stage 2: full build ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Copy all source files needed for the build
COPY . .
RUN npm run build

# ─── Stage 3: lean production image ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Bind to all interfaces so Docker port mapping works correctly
ENV HOSTNAME=0.0.0.0
# Suppress npm's "new version available" notice — noise in production logs
ENV NO_UPDATE_NOTIFIER=1

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output: server.js lands at /app/server.js and brings its own trimmed .next/
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static client assets (JS/CSS chunks) live outside standalone — must be copied separately
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

# Full node_modules from builder (includes devDependencies).
# drizzle-kit is a devDep and must be present at runtime to run migrations on startup.
# This overwrites the trimmed node_modules that standalone copied above.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules     ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json     ./package.json

# Migrations folder and drizzle config — read by drizzle-kit migrate at container start
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

# Startup script: runs migrations then execs node server.js
COPY --chown=nextjs:nodejs scripts/ ./scripts/
RUN sed -i 's/\r//' scripts/start.sh && chmod +x scripts/start.sh

USER nextjs

EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
