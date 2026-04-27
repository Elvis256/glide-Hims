# Glide-HIMS Hybrid Deployment Guide

This guide covers deploying Glide-HIMS on customer infrastructure (AWS, Azure, On-Premises)
with updates and support managed from the super server.

## Quick Start

1. Run installer: `./install-hybrid.sh`
2. Answer configuration prompts
3. Services start automatically
4. Access: https://your-domain.com

## Key Features

✅ Customer-hosted infrastructure
✅ Isolated database (privacy/compliance)  
✅ Automatic updates from super server
✅ Enterprise support included
✅ All Docker-based for easy deployment

## Configuration Files

- `.env` - Environment configuration (auto-generated)
- `docker-compose.hybrid.yml` - Multi-container orchestration
- `nginx.hybrid.conf` - Reverse proxy configuration
- `packages/backend/Dockerfile` - Backend build
- `packages/frontend/Dockerfile` - Frontend build

## Management Commands

View logs:      `docker-compose -f docker-compose.hybrid.yml logs -f`
Stop services:  `docker-compose -f docker-compose.hybrid.yml stop`
Start services: `docker-compose -f docker-compose.hybrid.yml start`
Restart:        `docker-compose -f docker-compose.hybrid.yml restart`
Check status:   `docker-compose -f docker-compose.hybrid.yml ps`

## Backup & Recovery

Automated daily backups at 2 AM UTC (30-day retention)

Manual backup:
```bash
docker-compose -f docker-compose.hybrid.yml exec -T postgres pg_dump \
  -U hims_admin glide_hims | gzip > backup_$(date +%Y%m%d).sql.gz
```

## License Validation

```bash
curl -X POST https://your-domain.com/api/v1/admin/licenses/validate \
  -H "Content-Type: application/json" \
  -d '{"license_key":"GLI-HYB-XXXXXX"}'
```

## Support

Email: support@itsolutionsuganda.com
Hours: Monday-Friday 9 AM - 5 PM EAT
Response: < 4 hours for critical issues

Version: 1.0.0
