# Security Architecture and Application Controls
## Scope
This document defines mandatory security architecture and application controls for Glide-HIMS production and pre-production environments.
## Control Objectives
- Protect confidentiality, integrity, and availability of patient and operational data.
- Enforce tenant isolation across all data access paths.
- Detect and prevent unauthorized access and risky changes.
## Architecture Controls
### Identity and Access Management
- Authentication is JWT-based with refresh token rotation.
- MFA is required for privileged access in production.
- Role-based access control (RBAC) applies least-privilege permissions per user role.
- System-admin access must be separately monitored from tenant-admin access.
### Tenant Isolation
- Tenant scoping is mandatory on all tenant-owned entities.
- Database-level isolation control uses tenant_id filters and row-level security where configured.
- Cross-tenant access is prohibited except for audited system-admin workflows.
### API and Session Security
- Rate limiting is enforced for login and high-risk endpoints.
- Account lockout is enforced after repeated failed login attempts.
- Session timeout and token rotation must be active in production.
- Security headers are enforced via backend middleware and reverse proxy.
### Data Security
- Backups must be encrypted at rest and integrity-verified with checksums.
- TLS is mandatory for all production client and API traffic.
- Secrets must never be committed and must be managed via environment-secure mechanisms.
### Auditability
- Security-sensitive actions are written to audit logs.
- Emergency/support access must be time-bounded and auditable.
## Minimum Evidence Required per Release
- Passing CI security workflow output artifacts.
- Dependency vulnerability scan results.
- Secret scanning result.
- Audit-log verification sample from staging or production.
- Backup and restore test evidence for the current period.
## Ownership
- Engineering Lead: technical control implementation.
- Security Owner: control review and evidence signoff.
- Operations Owner: production enforcement and incident escalation.
