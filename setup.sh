#!/bin/bash
# Glide-HIMS Quick Setup Script
set -e

echo "============================================"
echo "  Glide-HIMS Setup Script"
echo "============================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL client is required"; exit 1; }

# Install pnpm if not present
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Setup backend environment
if [ ! -f packages/backend/.env ]; then
    echo "⚙️  Creating backend .env from example..."
    cp packages/backend/.env.example packages/backend/.env
    echo "⚠️  Please edit packages/backend/.env with your database credentials"
fi

# Database setup reminder
echo ""
echo "============================================"
echo "  Database Setup (if not done)"
echo "============================================"
echo "Run these SQL commands as postgres user:"
echo ""
echo "  CREATE USER glide_hims WITH PASSWORD 'your_password';"
echo "  CREATE DATABASE glide_hims OWNER glide_hims;"
echo "  GRANT ALL PRIVILEGES ON DATABASE glide_hims TO glide_hims;"
echo ""

# Start instructions
echo "============================================"
echo "  Start Development Servers"
echo "============================================"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd packages/backend && npm run dev"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd packages/frontend && pnpm run dev --host"
echo ""
echo "Terminal 3 - Run Seed Scripts (first time only):"
echo "  cd packages/backend"
echo "  npx ts-node src/database/seeds/seed.ts"
echo "  npx ts-node src/database/seeds/seed-clinical.ts"
echo "  npx ts-node src/database/seeds/seed-lab.ts"
echo "  npx ts-node src/database/seeds/seed-hr.ts"
echo "  npx ts-node src/database/seeds/seed-finance.ts"
echo "  npx ts-node src/database/seeds/seed-radiology.ts"
echo "  npx ts-node src/database/seeds/seed-insurance.ts"
echo ""
echo "============================================"
echo "  Access Points"
echo "============================================"
echo "  Frontend:  http://localhost:5173"
echo "  API:       http://localhost:3000/api/v1"
echo "  API Docs:  http://localhost:3000/api/docs"
echo "  Login:     admin / Admin@123"
echo "============================================"
