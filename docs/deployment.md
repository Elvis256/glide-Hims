# Glide-HIMS Deployment Guide

## Quick Start (Development)

### Prerequisites
- Node.js 20 LTS
- PostgreSQL 14+
- pnpm 8+ (`npm install -g pnpm`)

### 1. Clone and Install
```bash
git clone <repository-url>
cd glide-hims
pnpm install
```

### 2. Database Setup
```bash
# Create PostgreSQL database
sudo -u postgres psql
CREATE USER glide_hims WITH PASSWORD 'your_password';
CREATE DATABASE glide_hims OWNER glide_hims;
GRANT ALL PRIVILEGES ON DATABASE glide_hims TO glide_hims;
\q
```

### 3. Configure Environment
```bash
cd packages/backend
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Run Migrations and Seed Data
```bash
cd packages/backend
npm run dev  # First run creates tables via TypeORM sync

# In another terminal, run seeds:
npx ts-node src/database/seeds/seed.ts
npx ts-node src/database/seeds/seed-clinical.ts
npx ts-node src/database/seeds/seed-lab.ts
npx ts-node src/database/seeds/seed-hr.ts
npx ts-node src/database/seeds/seed-finance.ts
npx ts-node src/database/seeds/seed-radiology.ts
npx ts-node src/database/seeds/seed-insurance.ts
```

### 5. Start Development Servers
```bash
# Terminal 1 - Backend
cd packages/backend && npm run dev

# Terminal 2 - Frontend
cd packages/frontend && pnpm run dev --host
```

Access:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- API Docs: http://localhost:3000/api/docs
- Login: `admin` / `Admin@123`

---

## Production Deployment (Docker)

### Prerequisites
- Docker 24+
- Docker Compose 2+
- 4GB RAM minimum (8GB recommended)
- 50GB disk space

### 1. Create Production Environment
```bash
# Create deployment directory
mkdir -p /opt/glide-hims
cd /opt/glide-hims

# Copy project files
git clone <repository-url> .
```

### 2. Configure Production Environment
```bash
cd packages/backend
cp .env.example .env

# Edit .env with production values:
# - Strong JWT secrets (64+ chars)
# - Secure database password
# - NODE_ENV=production
# - Your actual domain in CORS_ORIGINS
```

### 3. Docker Compose Production

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgres:14-alpine
    container_name: glide-hims-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: glide_hims
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: glide_hims
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - glide-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U glide_hims"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: glide-hims-redis
    restart: unless-stopped
    networks:
      - glide-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./packages/backend
      dockerfile: Dockerfile
    container_name: glide-hims-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USERNAME=glide_hims
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=glide_hims
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - glide-network

  frontend:
    build:
      context: ./packages/frontend
      dockerfile: Dockerfile
    container_name: glide-hims-web
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - glide-network
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro

volumes:
  pgdata:

networks:
  glide-network:
    driver: bridge
```

### 4. Create Backend Dockerfile
```dockerfile
# packages/backend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 5. Create Frontend Dockerfile
```dockerfile
# packages/frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
```

### 6. Deploy
```bash
# Create .env file with secrets
cat > .env << 'EOL'
DB_PASSWORD=your_secure_database_password
JWT_SECRET=your_64_char_jwt_secret_here
JWT_REFRESH_SECRET=your_64_char_refresh_secret_here
EOL

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Run seeds (first deployment only)
docker exec -it glide-hims-api npm run seed
```

---

## Security Checklist

### Before Going Live
- [ ] Change default admin password
- [ ] Generate strong JWT secrets (64+ chars)
- [ ] Configure HTTPS with valid SSL certificate
- [ ] Set up firewall (only ports 80, 443 open)
- [ ] Configure database backups
- [ ] Enable PostgreSQL SSL
- [ ] Review CORS origins
- [ ] Set NODE_ENV=production

### Recommended
- [ ] Set up log aggregation
- [ ] Configure monitoring (Prometheus/Grafana)
- [ ] Implement backup verification
- [ ] Document disaster recovery procedure

---

## Backup & Restore

### Database Backup
```bash
# Manual backup
docker exec glide-hims-db pg_dump -U glide_hims glide_hims > backup_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
0 2 * * * docker exec glide-hims-db pg_dump -U glide_hims glide_hims | gzip > /backups/glide_hims_$(date +\%Y\%m\%d).sql.gz
```

### Database Restore
```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop backend

# Restore
cat backup.sql | docker exec -i glide-hims-db psql -U glide_hims glide_hims

# Restart
docker-compose -f docker-compose.prod.yml start backend
```

---

## Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check logs
docker logs glide-hims-api

# Verify database connection
docker exec -it glide-hims-api npm run db:test
```

**Database connection refused:**
```bash
# Check PostgreSQL is running
docker logs glide-hims-db

# Verify credentials in .env
```

**Frontend shows blank page:**
```bash
# Check if API is accessible
curl http://localhost:3000/api/v1/health

# Check browser console for errors
```

### Health Check Endpoints
- Backend: `GET /api/v1/health`
- API Docs: `GET /api/docs`

---

## Support

For issues, contact: support@glide-hims.com

---

**Last Updated:** January 2026
