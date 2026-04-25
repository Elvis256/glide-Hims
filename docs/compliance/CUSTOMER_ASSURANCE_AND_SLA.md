# Customer Assurance and SLA Baseline
## Purpose
Provide a formal baseline for customer-facing security and service assurance commitments.
## Security Assurance Commitments
- Tenant data isolation is enforced by application and database controls.
- Access control follows role-based least privilege.
- Security-sensitive actions are auditable.
- Backup and restore controls are implemented and periodically tested.
## Service Availability Targets
- Target monthly availability: 99.5% for production service.
- Planned maintenance windows are announced in advance.
- Unplanned outages are communicated with status updates and ETA.
## Incident Response Targets
- Priority 1: response within 1 hour.
- Priority 2: response within 4 hours.
- Priority 3: response within 1 business day.
- Priority 4: response within 2 business days.
## Customer Evidence Pack Contents
- Current architecture and control summary.
- CI security scan summary.
- Recent backup and restore evidence.
- Incident management summary (redacted where required).
## Limitations
Formal certifications (SOC2, ISO) require independent external audit and are out of scope of this repository-only implementation.
