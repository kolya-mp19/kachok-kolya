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

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Production node_modules from stage 1
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules ./node_modules
# Built artefacts from stage 2
COPY --from=builder --chown=nextjs:nodejs /app/.next        ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public       ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
