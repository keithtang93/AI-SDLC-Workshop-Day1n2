# ---- Stage 1: Build the application ----
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
# Copy package.json only (no lockfile) so npm resolves platform-native
# bindings (e.g. @tailwindcss/oxide-linux-x64-musl) fresh for Alpine
COPY package.json ./
RUN npm install
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 2: Production image ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy better-sqlite3 native addon and its dependencies (required at runtime)
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Copy optional native addon helpers if they exist
RUN --mount=from=builder,source=/app,target=/builder \
    for pkg in node-addon-api prebuild-install public; do \
      if [ -d "/builder/node_modules/$pkg" ]; then \
        cp -r "/builder/node_modules/$pkg" "./node_modules/$pkg"; \
      fi; \
    done; \
    if [ -d "/builder/public" ]; then \
      cp -r /builder/public ./public; \
    fi

# Create data directory for SQLite persistence (mount a volume here)
RUN mkdir -p /data && chown nextjs:nodejs /data


EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
