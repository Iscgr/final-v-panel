# MarFaNet Financial Management System - Multi-stage Dockerfile
# Optimized for production deployment

FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    bash \
    curl \
    openssl \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build stage
FROM base AS builder

# Install dev dependencies for build
RUN npm ci

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S marfanet -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    bash \
    curl \
    openssl \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy built application
COPY --from=builder --chown=marfanet:nodejs /app/dist ./dist
COPY --from=builder --chown=marfanet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=marfanet:nodejs /app/package*.json ./
COPY --from=builder --chown=marfanet:nodejs /app/shared ./shared

# Copy necessary config files
COPY --from=builder --chown=marfanet:nodejs /app/drizzle.config.ts ./

# Create necessary directories
RUN mkdir -p /app/logs && \
    chown -R marfanet:nodejs /app

# Switch to non-root user
USER marfanet

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD curl -fsS http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]