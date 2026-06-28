#!/bin/bash
# Fix script for hybrid deployment container issues
set -e

cd /opt/glide-hims

echo "==> Creating uploads directory..."
mkdir -p uploads/patient-documents

echo "==> Creating frontend nginx config..."
cat > frontend-nginx.conf << 'NGINX'
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    sendfile on;
    keepalive_timeout 65;
    server {
        listen 8080;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;
        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml;
        location /health { return 200 "healthy\n"; add_header Content-Type text/plain; }
        location / { try_files $uri $uri/ /index.html; }
        location ~ /\. { deny all; }
    }
}
NGINX

echo "==> Updating docker-compose.hybrid.yml..."
cat > docker-compose.hybrid.yml << 'COMPOSE'
services:
  postgres:
    image: postgres:15-alpine
    container_name: glide-hims-postgres
    shm_size: '512m'
    environment:
      POSTGRES_DB: glide_hims
      POSTGRES_USER: ${DB_USER:-hims_admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-ChangeMeInProduction}
    command: >
      postgres
      -c max_connections=500
      -c shared_buffers=256MB
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./deployment/standalone/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-hims_admin}"]
      interval: 10s
      timeout: 5s
      start_period: 30s
      retries: 5
    networks:
      - glide-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: glide-hims-redis
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-ChangeMeInProduction}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - glide-network
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    container_name: glide-hims-backend
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_USERNAME: ${DB_USER:-hims_admin}
      DB_PASSWORD: ${DB_PASSWORD:-ChangeMeInProduction}
      DB_NAME: glide_hims
      DATABASE_URL: postgresql://${DB_USER:-hims_admin}:${DB_PASSWORD:-ChangeMeInProduction}@postgres:5432/glide_hims
      REDIS_URL: redis://:${REDIS_PASSWORD:-ChangeMeInProduction}@redis:6379
      REDIS_PASSWORD: ${REDIS_PASSWORD:-ChangeMeInProduction}
      JWT_SECRET: ${JWT_SECRET:-change-me-in-production-with-32-char-min}
      JWT_EXPIRES_IN: 24h
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-${REFRESH_TOKEN_SECRET:-change-me-in-production-with-32-char-min}}
      REFRESH_TOKEN_EXPIRES_IN: 7d
      MFA_ENCRYPTION_KEY: ${MFA_ENCRYPTION_KEY:-}
      PII_ENCRYPTION_KEY: ${PII_ENCRYPTION_KEY:-}
      PII_HASH_KEY: ${PII_HASH_KEY:-}
      LOG_LEVEL: info
      CORS_ORIGINS: http://localhost:8080,https://${DOMAIN_NAME}
      API_URL: https://${DOMAIN_NAME}/api
      FRONTEND_URL: https://${DOMAIN_NAME}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - glide-network
    restart: unless-stopped
    volumes:
      - ./packages/backend/logs:/app/logs
      - ./uploads:/app/packages/backend/uploads

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    container_name: glide-hims-frontend
    environment:
      VITE_API_URL: https://${DOMAIN_NAME}/api
      VITE_API_TIMEOUT: 30000
    ports:
      - "8080:8080"
    volumes:
      - ./frontend-nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    networks:
      - glide-network
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: glide-hims-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - glide-network
    restart: unless-stopped

networks:
  glide-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
COMPOSE

echo "==> Stopping containers..."
docker compose -f docker-compose.hybrid.yml down 2>/dev/null || true

echo "==> Starting containers..."
docker compose -f docker-compose.hybrid.yml up -d

echo "==> Done! Checking status in 10 seconds..."
sleep 10
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
