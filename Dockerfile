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

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

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

# Install required system dependencies
RUN apk add --no-cache postgresql-client curl

# Explicit environment to ensure server/index.ts تشخیص محیط را production در نظر بگیرد
ENV NODE_ENV=production

# Create a non-root user and necessary directories first
RUN addgroup -S nodejs && adduser -S marfanet -G nodejs && \
    mkdir -p /app/logs && \
    chown -R marfanet:nodejs /app/logs && \
    mkdir -p /app/uploads && \
    chown -R marfanet:nodejs /app/uploads

# Switch to the non-root user
USER marfanet
WORKDIR /app

# Copy artifacts from the builder stage
COPY --from=builder --chown=marfanet:nodejs /app/dist ./dist
# Client assets already reside inside dist/public (vite.config.ts)
COPY --from=builder --chown=marfanet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=marfanet:nodejs /app/package.json .
COPY --from=builder --chown=marfanet:nodejs /app/start-server.cjs .

# Expose the application port
EXPOSE 3000

# Set the command to run the application
CMD ["node", "start-server.cjs"]