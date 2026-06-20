FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (root + frontend package.json needed for pnpm workspace install)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source
COPY packages/frontend ./packages/frontend

# Build
WORKDIR /app/packages/frontend
RUN pnpm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy nginx config (server block goes into conf.d; remove default)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/glide-hims.conf

# Copy built frontend
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

# Set permissions for nginx user (already exists in nginx:alpine)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
