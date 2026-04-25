# Secure SDLC and CI/CD Controls
## Purpose
Define mandatory secure software development lifecycle controls and CI/CD gate requirements.
## Branch and Change Controls
- All changes to protected branches must be merged through pull requests.
- Minimum one reviewer approval is required for code changes.
- Direct pushes to protected branches are disallowed.
- Change records must include risk, rollback plan, and validation notes.
## CI/CD Gate Controls
The following checks are mandatory before merge:
- Backend tests pass.
- Frontend lint passes.
- Dependency vulnerability scan passes configured threshold.
- Secret scanning completes with no verified leaks.
- Build verification completes for backend and frontend.
## Release Controls
- Production release must reference immutable commit SHA.
- Database-impacting changes require migration and rollback plan.
- Release evidence must be archived in `compliance/evidence/releases/`.
## Developer Security Requirements
- No secrets or credentials in source code.
- No insecure cryptography in application code.
- New endpoints must include authorization and audit consideration.
- High-risk modules require security review in PR notes.
## Exceptions
Any gate bypass requires:
- documented business justification,
- risk acceptance by service owner,
- expiry date for exception,
- tracking issue for remediation.
