# =============================================================================
# Glide HIMS Frontend - Production Dockerfile
# Multi-stage build with nginx for serving
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments for environment
ARG VITE_API_URL=/api
ARG VITE_APP_NAME="Glide HIMS"

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

# Build the application
RUN pnpm run build

# Stage 2: Production with nginx
FROM nginx:alpine AS production

# Add labels
LABEL org.opencontainers.image.title="Glide HIMS Frontend"
LABEL org.opencontainers.image.description="Healthcare Information Management System - Web Interface"
LABEL org.opencontainers.image.vendor="IT Solutions Uganda"
LABEL org.opencontainers.image.version="1.0.0"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Add runtime config script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx with runtime config
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
