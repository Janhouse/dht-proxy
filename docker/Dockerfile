FROM oven/bun:1-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the app
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p /app/public && bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/.next/BUILD_ID ./.next/BUILD_ID
COPY --from=builder /app/drizzle ./drizzle

RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

LABEL org.opencontainers.image.title="DHT Proxy"
LABEL org.opencontainers.image.description="Privacy-preserving BitTorrent peer relay — crawls DHT and trackers, relays peers to downstream clients without exposing their IPs"
LABEL org.opencontainers.image.source="https://github.com/Janhouse/dht-proxy"
LABEL org.opencontainers.image.vendor="Janhouse"

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=3s --timeout=5s --retries=3 --start-period=2s \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["bun", "--bun", "server.js"]
