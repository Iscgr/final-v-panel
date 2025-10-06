# MarFaNet Financial Management System - Multi-stage Dockerfile
# Optimized for production deployment with a unified build process

# ==============================================================================
# Stage 1: Builder
# This stage installs all dependencies, builds the client and server.
# ==============================================================================
FROM node:20-alpine AS builder

# Install bash for build scripts
RUN apk add --no-cache bash

WORKDIR /app

# Copy all necessary configuration and source files
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./
COPY fix-imports.sh ./
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY types/ ./types/
COPY start-server.cjs ./

# Remove lock file to ensure a fresh dependency tree, then install
RUN rm -f package-lock.json && npm install --legacy-peer-deps

# Run the unified build script and validate build artifacts exist
RUN npm run build \
    && test -d dist/public \
    && test -f dist/server/index.js \
    && npm prune --omit=dev

# ==============================================================================
# Stage 2: Production
# This stage creates the final, lean image for production.
# ==============================================================================
FROM node:20-alpine AS production

RUN apk add --no-cache postgresql-client curl

ENV NODE_ENV=production

RUN addgroup -S nodejs && adduser -S marfanet -G nodejs

WORKDIR /app

COPY --from=builder --chown=marfanet:nodejs /app .

USER marfanet

EXPOSE 3000

CMD ["npm", "run", "start:prod"]