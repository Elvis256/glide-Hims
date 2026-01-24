# Glide-HIMS: Enterprise Healthcare Information Management System

**Offline-first, On-premise Primary, Future Cloud-Ready**

Enterprise HMIS/ERP designed for Uganda healthcare facilities with robust offline capabilities, comprehensive clinical workflows, and integrated financial management.

## 🚀 Features (All 10 Phases Complete ✅)

### Platform Core
- ✅ Multi-tenant platform with facility hierarchy
- ✅ Role-based access control (RBAC) with 9 default roles
- ✅ JWT authentication with refresh tokens
- ✅ Comprehensive audit logging
- ✅ 22 permissions across modules

### Clinical Modules
- ✅ **Patient Registration** - MRN generation, demographics, duplicate detection
- ✅ **OPD & Consultation** - Triage, vitals, clinical notes, orders
- ✅ **IPD/Ward Management** - 6 wards, bed allocation, nursing notes
- ✅ **Emergency Department** - 5-level triage, priority queue
- ✅ **Laboratory (LIS)** - 32 tests, sample tracking, result validation
- ✅ **Radiology (RIS)** - 8 modalities, imaging orders, reports
- ✅ **Theatre/Surgery** - 6 operating theatres, scheduling, pre/post-op
- ✅ **Maternity** - ANC registration, labour tracking, delivery records

### Financial & Administrative
- ✅ **Billing & Revenue** - Invoices, payments, receipts
- ✅ **Pharmacy & Dispensing** - Prescriptions, stock management
- ✅ **Inventory** - Purchase orders, GRN, stock tracking
- ✅ **Insurance & Claims** - 12 Uganda providers, pre-auth, claims workflow
- ✅ **Finance & Accounting** - 68 chart of accounts, journal entries, reports
- ✅ **HR & Payroll** - Employee management, attendance, leave

### Analytics & Reporting
- ✅ **Executive Dashboard** - KPIs, trends, revenue metrics
- ✅ **Patient Analytics** - Demographics, registration trends
- ✅ **Clinical Analytics** - Encounters, diagnoses, procedures
- ✅ **Financial Analytics** - Revenue, collections, outstanding
- ✅ **Operational Analytics** - Bed occupancy, lab TAT, LOS

## 🏗️ Architecture

**Monorepo Structure:**
```
glide-hims/
├── packages/
│   ├── backend/          # NestJS API
│   ├── frontend/         # React Web App
│   └── shared/           # Shared types & utilities
├── infrastructure/       # Docker, K8s configs
├── database/            # Migrations & seeds
└── docs/                # Documentation
```

**Technology Stack:**
- **Backend**: Node.js 20 + NestJS 10 + TypeORM
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: PostgreSQL 14+
- **Cache**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Queue**: RabbitMQ 3
- **Monitoring**: Prometheus + Grafana

## 🛠️ Development Setup

### Prerequisites
- Node.js 20 LTS
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 14+ (or use Docker)

### Quick Start

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd glide-hims
pnpm install
```

2. **Start infrastructure (PostgreSQL, Redis, MinIO, RabbitMQ):**
```bash
pnpm docker:dev
```

3. **Run database migrations:**
```bash
pnpm db:migrate
pnpm db:seed
```

4. **Start development servers:**
```bash
pnpm dev
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- API Docs: http://localhost:3000/api/docs

### Environment Variables

Copy `.env.example` files in each package and configure:
```bash
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
```

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [API Documentation](http://localhost:3000/api/docs) (when running)
- [Deployment Guide](docs/deployment.md)
- [Development Guide](docs/development.md)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

## 🚢 Deployment

### On-Premise (Recommended for Phase 0)

```bash
# Build production images
docker-compose -f infrastructure/docker-compose.prod.yml build

# Deploy
docker-compose -f infrastructure/docker-compose.prod.yml up -d
```

See [Deployment Guide](docs/deployment.md) for detailed instructions.

## 🔒 Security

- JWT-based authentication with refresh tokens
- MFA support (TOTP)
- Role-based access control (RBAC)
- Comprehensive audit logging
- PHI data encryption
- TLS/HTTPS required for production

## 📊 Seed Data Included

| Category | Count | Details |
|----------|-------|---------|
| Patients | 10 | Sample patient records |
| Employees | 10 | HR staff records |
| Lab Tests | 32 | CBC, RFT, LFT, Malaria, HIV, etc. |
| Insurance Providers | 12 | NHIS, UAP, Jubilee, AAR, etc. |
| Chart of Accounts | 68 | Full Uganda-compliant COA |
| Radiology Modalities | 8 | X-Ray, CT, MRI, Ultrasound, etc. |
| Wards | 6 | General, Pediatric, Maternity, ICU |
| Operating Theatres | 6 | General, Orthopedic, Obstetric, etc. |

## 📊 Roadmap

### ✅ Completed (January 2026)
- Phase 0: Platform Foundation
- Phase 1: Clinical Core
- Phase 2: IPD/Ward Management
- Phase 3: Lab & Emergency
- Phase 4: Theatre/Surgery
- Phase 5: Maternity
- Phase 6: HR & Payroll
- Phase 7: Finance & Accounting
- Phase 8: Radiology/Imaging
- Phase 9: Insurance & Claims
- Phase 10: Analytics & BI

### 🔄 Next Steps
- Offline Sync MVP
- DHIS2 Integration (MoH reporting)
- Mobile Money Integration
- National ID Validation

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

For issues and support, contact: support@glide-hims.com

---

**Built with ❤️ for Uganda Healthcare**
