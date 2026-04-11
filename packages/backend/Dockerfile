# =============================================================================
# Glide HIMS Backend - Production Dockerfile
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:20-alpine AS production

# Add labels
LABEL org.opencontainers.image.title="Glide HIMS Backend"
LABEL org.opencontainers.image.description="Healthcare Information Management System - Backend API"
LABEL org.opencontainers.image.vendor="IT Solutions Uganda"
LABEL org.opencontainers.image.version="1.0.0"

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

WORKDIR /app

# Copy production files from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R nestjs:nodejs /app/uploads /app/logs

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Environment variables (defaults)
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/main.js"]
