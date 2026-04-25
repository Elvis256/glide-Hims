# Glide HIMS Central Server — Deployment Documentation

**Document version:** 1.0  
**Status:** Production‑ready  
**Owner:** Platform Engineering  
**Last reviewed:** 2026‑04‑25

This is the authoritative deployment, verification, and operational reference for
the dual‑role central server (`hmisdemo.itsolutionsuganda.com`). The hub
simultaneously serves as the multi‑tenant SaaS host for paying tenants **and** as
the update / phone‑home distribution endpoint for hybrid and on‑premise installs.

---

## Table of contents

1. Server role
2. Configuration contract
3. Deployment checklist (Part A)
4. Verification procedures (Part B)
5. Operational runbook
6. Troubleshooting & rollback
7. Document control & sign‑off

---

## 1. Server role

The hub serves three distinct traffic classes on the same hostname:

```text
hmisdemo.itsolutionsuganda.com
├── /login/<slug>           ← paid SaaS tenants (slug‑gated)
├── /system/login           ← platform/system admin (IP‑allowlisted)
├── /api/v1/updates/*       ← update distribution (public, license‑gated downloads)
└── /api/phone-home         ← license heartbeat receiver (public, license‑validated)
```

Two independent roles share infrastructure, but **never share authentication
context**: tenant traffic uses JWT + RLS; update / phone‑home traffic uses
license keys. The verification procedures in §4 prove that boundary holds.

---

## 2. Configuration contract

Authoritative values for `packages/backend/.env` on the hub:

```bash
NODE_ENV=production
DEPLOYMENT_MODE=multi-tenant
MULTI_TENANT=true
PHONE_HOME_ENABLED=false
UPDATE_PACKAGES_DIR=/var/glide-hims/updates

# JWT
JWT_SECRET=<openssl rand -base64 64>
JWT_REFRESH_SECRET=<openssl rand -base64 64>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Crypto / MFA
BCRYPT_ROUNDS=12
MFA_ISSUER=Glide-HIMS

# HTTP / CORS
PORT=3000
API_PREFIX=api/v1
CORS_ORIGINS=https://hmisdemo.itsolutionsuganda.com

# Rate limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Database (RLS-enforcing role, NO BYPASSRLS)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=glide_hims_app
DB_PASSWORD=<rotated>
DB_NAME=glide_hims

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=<rotated>

# Object storage
MINIO_ENDPOINT=<host>
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=<rotated>
MINIO_SECRET_KEY=<rotated>
MINIO_BUCKET=glide-hims

# Logging
LOG_LEVEL=warn
```

### Why each value matters

- `DEPLOYMENT_MODE=multi-tenant` — the only mode in which `auth.service.ts`
  rejects no‑slug logins from non‑system‑admins. Any other value (`on-premise`,
  `standalone`) silently auto‑binds logins to the first active tenant and is
  unsafe on shared infrastructure.
- `MULTI_TENANT=true` — turns on per‑request RLS context.
- `PHONE_HOME_ENABLED=false` — the hub *receives* heartbeats; the cron in
  `phone-home.service.ts` must not emit outbound calls from the hub.
- `UPDATE_PACKAGES_DIR` — directory the update controller streams release
  tarballs from (`glide-hims-<version>.tar.gz`).
- `CORS_ORIGINS` must be explicit; no wildcard.
- DB role must not have `BYPASSRLS` or RLS becomes advisory.

---

## 3. Deployment checklist — Part A

Use top‑to‑bottom; every box must be ticked before the three‑signature sign‑off.

### Phase 0 — Prerequisites

- [ ] DNS `A`/`AAAA` for `hmisdemo.itsolutionsuganda.com` propagated.
- [ ] TLS certificate issued; renewal automation tested.
- [ ] GPG release‑signing keypair generated; private key in HSM/Vault.
- [ ] Office / VPN egress IP range documented for `/system/*` allowlisting.
- [ ] Maintenance window scheduled, customer comms drafted, rollback plan written.
- [ ] Build artefact (`glide-hims-<version>.tar.gz`) and DB schema confirmed compatible.

### Phase 1 — Host & OS hardening

- [ ] Ubuntu LTS, fully patched.
- [ ] Non‑root user `glide-hims`; `sudo` restricted; SSH key‑only.
- [ ] `ufw` enabled: 22 (restricted source), 80, 443 in; default‑deny out except
  DB / SMTP / object store / package mirrors.
- [ ] `fail2ban` jails for SSH and `nginx-limit-req` enabled.
- [ ] Time sync (`chrony` / `systemd-timesyncd`) running.
- [ ] Auto unattended security upgrades enabled.

### Phase 2 — Infrastructure services

- [ ] PostgreSQL 16, listens on `localhost` only, superuser password rotated.
- [ ] DB role `glide_hims_app` created **without** `BYPASSRLS`, `SUPERUSER`, or `CREATEDB`.
- [ ] Redis 7 bound to localhost; `requirepass` set; persistence configured.
- [ ] MinIO/S3 bucket `glide-hims` created with lifecycle + versioning; credentials rotated.
- [ ] (If used) RabbitMQ broker reachable.

### Phase 3 — Database initialisation

- [ ] DB `glide_hims` created and owned by `glide_hims_app`.
- [ ] Migrations applied to head; verify the following are present:
  - [ ] `1774000000000-AddTenantIdToAllTables`
  - [ ] `1775300000000-EnableRowLevelSecurity`
  - [ ] `1775400000000-AddTenantIdForeignKeys`
  - [ ] `1775600000000-AddEnterpriseDeploymentTables`
  - [ ] `1775700000000-CreateBackupsTable`
- [ ] RLS posture verified (§4.1.1).
- [ ] Initial system admin seeded with MFA enabled; default seed creds removed.
- [ ] Logical + physical backup jobs scheduled and a restore drill completed.

### Phase 4 — Application configuration

- [ ] `NODE_ENV=production`
- [ ] `DEPLOYMENT_MODE=multi-tenant`
- [ ] `MULTI_TENANT=true`
- [ ] `PHONE_HOME_ENABLED=false`
- [ ] `UPDATE_PACKAGES_DIR=/var/glide-hims/updates`
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` distinct, ≥64 random chars
- [ ] `JWT_EXPIRES_IN=15m`, `JWT_REFRESH_EXPIRES_IN=7d`
- [ ] `BCRYPT_ROUNDS=12`
- [ ] `CORS_ORIGINS` explicit; no wildcard
- [ ] `RATE_LIMIT_TTL=60`, `RATE_LIMIT_MAX=100`
- [ ] `LOG_LEVEL=warn`
- [ ] File mode `0600`, owner `glide-hims`

### Phase 5 — Update distribution

- [ ] `/var/glide-hims/updates` exists, `root:glide-hims 0750`.
- [ ] First release tarball staged: `glide-hims-<version>.tar.gz` (`0640`).
- [ ] Detached signature `glide-hims-<version>.tar.gz.asc` present.
- [ ] `app_versions` row exists with `version`, `versionCode`, SHA‑256 `checksum`,
  `releaseNotes`, `isLatest=true`.
- [ ] (Optional) CDN mirror configured in `downloadUrl`.
- [ ] Proxy rate limit on `/api/v1/updates/download/*` configured (≤10 req/min/IP).

### Phase 6 — Phone‑home receiver

- [ ] `phone_home_records` and `licenses` tables present.
- [ ] License rows seeded for every contracted customer; `hardwareId` bound after first activation.
- [ ] Revocation workflow tested (`licenseValid:false`, `commands:["lock"]`).
- [ ] Heartbeat audit log retained ≥12 months.

### Phase 7 — Reverse proxy & TLS

- [ ] Nginx/Caddy config validated (`nginx -t`).
- [ ] HTTPS forced; HSTS preload header set; HTTP→HTTPS 301.
- [ ] TLS 1.2+ only; weak ciphers disabled; OCSP stapling.
- [ ] Public locations: `/login`, `/api/v1/auth`, `/api/v1/updates`,
  `/api/phone-home`, `/api/v1/tenants/public`.
- [ ] Allowlisted locations (VPN/office IPs only): `/system/`,
  admin write endpoints under `/api/v1/tenants`, `/api/v1/system-settings`,
  `/api/v1/feature-flags`, `/api/v1/updates/versions` POST/PUT.
- [ ] Login throttle: `limit_req zone=login burst=5 nodelay;` on `/api/v1/auth/login`.
- [ ] Static frontend served with security headers (CSP, X‑Frame‑Options DENY,
  X‑Content‑Type‑Options nosniff, Referrer‑Policy strict‑origin‑when‑cross‑origin).

### Phase 8 — Process management

- [ ] `glide-hims-backend.service` enabled, runs as `glide-hims`, `Restart=on-failure`.
- [ ] `glide-hims-frontend.service` enabled (or static build behind proxy).
- [ ] Internal healthcheck endpoint reachable; external probes blocked at the proxy.
- [ ] Log rotation configured.

### Phase 9 — Identity & access

- [ ] System admin accounts have MFA enforced.
- [ ] No tenant user has `is_system_admin = true`.
- [ ] Default seed creds removed.
- [ ] `support_access_grants` reviewed and time‑boxed.

### Phase 10 — Tenant onboarding readiness

- [ ] `/system` UI tenant‑creation flow tested end‑to‑end.
- [ ] At least one production tenant slug resolved via `GET /api/v1/tenants/public/by-slug/<slug>`.
- [ ] Tenant login (`/login/<slug>`) end‑to‑end successful.
- [ ] Setup wizard finalises tenant state to `isSetupComplete=true`.

### Phase 11 — Observability

- [ ] Centralised logging configured.
- [ ] Metrics scraped: latency, 4xx/5xx, DB pool, Redis hits, login failures, update bandwidth.
- [ ] Alerts:
  - [ ] `Cross-tenant login blocked` > 5/h
  - [ ] `Non-system-admin attempted system login` > 20/h
  - [ ] Update download error rate > 1%
  - [ ] Phone‑home 4xx rate > 10× baseline
  - [ ] `/var/glide-hims/updates` disk usage > 80%
  - [ ] DB pool saturation > 80%
- [ ] Status page + on‑call rota live.

### Phase 12 — Backup & DR

- [ ] DB: daily logical dump + WAL archiving / replica.
- [ ] `/var/glide-hims/updates` backed up off‑host.
- [ ] `.env`, GPG private key, TLS certs in encrypted secrets backup.
- [ ] Restore drill within last 30 days; RTO/RPO documented.

### Phase 13 — Smoke tests

Execute the procedures in §4 before flipping DNS or opening to customers.

### Phase 14 — Go‑live & first 24 hours

- [ ] DNS TTL reduced to 60s pre‑cutover.
- [ ] Traffic cut over; error rates and login success monitored for 1h.
- [ ] Each onboarded tenant manually verified.
- [ ] At least one remote on‑prem client phones home and pulls an update successfully.
- [ ] DNS TTL restored after stability confirmed.
- [ ] Deployment log entry written (date, operator, build, checksum).

### Phase 15 — Recurring

- [ ] Weekly: review tenant‑isolation/log alerts.
- [ ] Weekly: backup integrity test.
- [ ] Monthly: rotate JWT secrets per documented procedure.
- [ ] Monthly: audit `users WHERE is_system_admin = true`.
- [ ] Quarterly: TLS expiry, GPG rotation, CVE scan.
- [ ] Quarterly: DR tabletop.
- [ ] After each release: publish new `app_versions` row, regenerate checksum +
  signature, run dual‑role smoke tests.

---

## 4. Verification procedures — Part B

Set convenience variables once per session before running the suite:

```bash
export HUB=https://hmisdemo.itsolutionsuganda.com
export TENANT_A_SLUG=amani-childrens-clinic
export TENANT_B_SLUG=mulago-hospital
export TENANT_A_USER=alice
export TENANT_A_PASS='<password>'
export TENANT_B_USER=bob
export TENANT_B_PASS='<password>'
export SYSADMIN_USER=ops-admin
export SYSADMIN_PASS='<password>'
export TEST_LICENSE_KEY=<staging-license>
export TEST_HARDWARE_ID=$(cat /etc/machine-id | sha256sum | cut -d' ' -f1)
export RELEASE_VERSION=1.3.0
```

### §4.1 SaaS role

#### §4.1.1 RLS posture

```bash
sudo -u postgres psql -d glide_hims <<'SQL'
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname='glide_hims_app';
SELECT tablename FROM pg_tables
 WHERE schemaname='public' AND rowsecurity=false
   AND tablename IN ('users','patients','encounters','prescriptions',
                     'invoices','appointments','vitals','clinical_notes');
SELECT polname, tablename FROM pg_policies
 WHERE schemaname='public' AND qual::text LIKE '%app.tenant_id%';
SQL
```

Expected: `rolbypassrls = false`; the second query returns 0 rows; the third returns one policy per tenant‑scoped table.

#### §4.1.2 Slug resolution

```bash
curl -sS "$HUB/api/v1/tenants/public/by-slug/$TENANT_A_SLUG" \
  | jq '{id, slug, name, isSetupComplete}'
```

Expected: HTTP 200, `isSetupComplete: true`.

#### §4.1.3 Tenant login (slug path)

```bash
TENANT_A_ID=$(curl -sS $HUB/api/v1/tenants/public/by-slug/$TENANT_A_SLUG | jq -r .id)
TENANT_A_TOKEN=$(curl -sS -X POST "$HUB/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$TENANT_A_USER\",\"password\":\"$TENANT_A_PASS\",\"tenantId\":\"$TENANT_A_ID\"}" \
  | jq -r .accessToken)
echo "$TENANT_A_TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null \
  | jq '{sub, tenantId, isSystemAdmin}'
```

Expected: non‑empty JWT whose `tenantId` claim equals Tenant A's id.

#### §4.1.4 No‑slug login rejected for tenant users

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$HUB/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$TENANT_A_USER\",\"password\":\"$TENANT_A_PASS\"}"
```

Expected: `401`. Audit: `Non-system-admin attempted system login`.

#### §4.1.5 Cross‑tenant login blocked

```bash
TENANT_B_ID=$(curl -sS $HUB/api/v1/tenants/public/by-slug/$TENANT_B_SLUG | jq -r .id)
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$HUB/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$TENANT_A_USER\",\"password\":\"$TENANT_A_PASS\",\"tenantId\":\"$TENANT_B_ID\"}"
```

Expected: `401`. Audit: `Cross-tenant login blocked`.

#### §4.1.6 RLS data isolation

```bash
TENANT_B_TOKEN=$(curl -sS -X POST "$HUB/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$TENANT_B_USER\",\"password\":\"$TENANT_B_PASS\",\"tenantId\":\"$TENANT_B_ID\"}" \
  | jq -r .accessToken)

A=$(curl -sS -H "Authorization: Bearer $TENANT_A_TOKEN" "$HUB/api/v1/patients?limit=5" | jq '[.data[].id] | sort')
B=$(curl -sS -H "Authorization: Bearer $TENANT_B_TOKEN" "$HUB/api/v1/patients?limit=5" | jq '[.data[].id] | sort')
diff <(echo "$A") <(echo "$B") >/dev/null && echo FAIL || echo PASS

A_ID=$(curl -sS -H "Authorization: Bearer $TENANT_A_TOKEN" "$HUB/api/v1/patients?limit=1" | jq -r '.data[0].id')
curl -sS -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $TENANT_B_TOKEN" \
  "$HUB/api/v1/patients/$A_ID"
```

Expected: `PASS`; cross‑tenant fetch returns `404`/`403`, never `200`.

#### §4.1.7 System admin separation

System admin login succeeds without slug; `/system/*` reachable from VPN, blocked from public IPs (proxy returns 403/404 before backend).

### §4.2 Update distribution role

#### §4.2.1 Public update check

```bash
curl -sS "$HUB/api/v1/updates/check?version=1.0.0" | jq
```

Expected: HTTP 200 with `latestVersion`, `checksum`, `downloadUrl`.

#### §4.2.2 Latest release metadata

```bash
curl -sS "$HUB/api/v1/updates/latest" | jq '{version, isMandatory, checksum}'
```

#### §4.2.3 Download with integrity

```bash
HEADERS=$(curl -sSI "$HUB/api/v1/updates/download/$RELEASE_VERSION?license=$TEST_LICENSE_KEY")
SERVED=$(echo "$HEADERS" | awk -F': ' 'tolower($1)=="x-checksum-sha256"{print tolower($2)}' | tr -d '\r\n')
curl -sS -o "/tmp/glide-hims-$RELEASE_VERSION.tar.gz" \
  "$HUB/api/v1/updates/download/$RELEASE_VERSION?license=$TEST_LICENSE_KEY"
LOCAL=$(sha256sum "/tmp/glide-hims-$RELEASE_VERSION.tar.gz" | awk '{print $1}')
[ "$SERVED" = "$LOCAL" ] && echo PASS || echo FAIL
```

#### §4.2.4 GPG signature verification

```bash
gpg --verify "/tmp/glide-hims-$RELEASE_VERSION.tar.gz.asc" \
            "/tmp/glide-hims-$RELEASE_VERSION.tar.gz"
```

Expected: `Good signature from "Glide HIMS Release Signing Key …"`.

#### §4.2.5 Admin endpoints protected

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$HUB/api/v1/updates/versions" \
  -H 'Content-Type: application/json' -d '{}'
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$HUB/api/v1/updates/versions" \
  -H "Authorization: Bearer $TENANT_A_TOKEN" -H 'Content-Type: application/json' -d '{}'
```

Expected: both `401` or `403`.

#### §4.2.6 Rate limit on download

```bash
for i in $(seq 1 30); do
  curl -sS -o /dev/null -w '%{http_code}\n' \
    "$HUB/api/v1/updates/download/$RELEASE_VERSION?license=$TEST_LICENSE_KEY"
done | sort | uniq -c
```

Expected: mix of `200` and `429`.

### §4.3 Phone‑home receiver

#### §4.3.1 Valid heartbeat accepted

```bash
curl -sS -X POST "$HUB/api/phone-home" \
  -H 'Content-Type: application/json' \
  -H "X-Glide-License: $TEST_LICENSE_KEY" \
  -d "$(jq -n --arg lic "$TEST_LICENSE_KEY" --arg hw "$TEST_HARDWARE_ID" '
        { licenseKey: $lic, hardwareId: $hw, appVersion: "1.2.0",
          activeUsers: 5, totalUsers: 12, totalPatients: 250, totalEncounters: 980 }')" | jq
```

Expected: `licenseValid: true`; row inserted in `phone_home_records`.

#### §4.3.2 Hardware ID mismatch flagged

Submit a heartbeat with a fake `hardwareId`. Expected: `licenseValid: false` or `status: "warning"` with a lock command.

#### §4.3.3 Revoked license locked

```bash
sudo -u postgres psql -d glide_hims -c \
  "UPDATE licenses SET status='revoked' WHERE key='$TEST_LICENSE_KEY';"
# Re-submit heartbeat; expect commands:["lock"]
sudo -u postgres psql -d glide_hims -c \
  "UPDATE licenses SET status='active' WHERE key='$TEST_LICENSE_KEY';"
```

#### §4.3.4 Outbound phone‑home disabled on hub

```bash
grep -E '^PHONE_HOME_ENABLED' /root/glide-Hims/packages/backend/.env
sudo journalctl -u glide-hims-backend.service --since '10 min ago' \
  | grep -i 'phone home' || echo 'PASS: no outbound phone-home logs'
```

### §4.4 Dual‑role isolation

- §4.4.1 Update endpoints respond unauthenticated (`/api/v1/updates/check`, `/api/v1/updates/latest`).
- §4.4.2 Tenant API enforces RLS on direct‑ID lookups across tenants.
- §4.4.3 Update download authz is license‑based, not session‑based.
- §4.4.4 Phone‑home flood does not degrade tenant logins (parallel test).
- §4.4.5 Update publish gated to System Admin even when valid license/tenant tokens are present.

### §4.5 Backup & restore

#### §4.5.1 DB logical backup integrity

```bash
LATEST=$(ls -1t /var/backups/glide-hims/db/*.sql.gz | head -1)
gzip -t "$LATEST" && echo gzip-OK || echo gzip-FAIL
sudo -u postgres createdb glide_hims_restore_test
zcat "$LATEST" | sudo -u postgres psql -d glide_hims_restore_test -q
sudo -u postgres psql -d glide_hims_restore_test -c \
  "SELECT (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM tenants) AS tenants,
          (SELECT count(*) FROM patients) AS patients;"
sudo -u postgres dropdb glide_hims_restore_test
```

#### §4.5.2 Update tarball backup integrity

```bash
for f in /var/backups/glide-hims/updates/glide-hims-*.tar.gz; do
  v=$(basename "$f" | sed 's/glide-hims-\(.*\)\.tar\.gz/\1/')
  expected=$(sudo -u postgres psql -d glide_hims -t -A -c \
    "SELECT checksum FROM app_versions WHERE version='$v';")
  actual=$(sha256sum "$f" | awk '{print $1}')
  [ "$expected" = "$actual" ] && echo "PASS $v" || echo "FAIL $v"
done
```

#### §4.5.3 Secrets backup decrypts

```bash
LATEST=$(ls -1t /var/backups/glide-hims/secrets/secrets-*.tar.gz.age | head -1)
age -d -i ~/.config/age/identity.txt "$LATEST" | tar -tzf - >/dev/null \
  && echo PASS || echo FAIL
```

### §4.6 Disaster‑recovery rehearsal

- §4.6.1 Application restore drill on a separate VM; run §4.1.1 and §4.2.1 against it.
  Expected: smoke tests pass within RTO ≤2h, RPO ≤24h.
- §4.6.2 Phone‑home failover: point a staging on‑prem client at the drill host; confirm
  heartbeat acceptance.

### §4.7 Performance baseline

Use `wrk` or `k6` from a clean network path; record baselines for regression tracking.

#### §4.7.1 Tenant login throughput

Target: p99 < 800 ms, ≥200 logins/s, 0 errors.

#### §4.7.2 Update download throughput

Target: p99 < 200 ms on `/api/v1/updates/check`, ≥1 000 req/s, 0 errors.

#### §4.7.3 Phone‑home throughput

Target: p99 < 500 ms, ≥100 req/s sustained until proxy limit.

### §4.8 Security verification

- §4.8.1 TLS configuration scan (`sslyze --regular hmisdemo.itsolutionsuganda.com`):
  TLS 1.2/1.3 only, strong ciphers, HSTS, OCSP stapling, valid chain.
- §4.8.2 Security headers present (HSTS, CSP, X‑Frame‑Options DENY,
  X‑Content‑Type‑Options nosniff, Referrer‑Policy).
- §4.8.3 Authenticated endpoints reject anonymous (`/api/v1/users`,
  `/api/v1/patients`, `/api/v1/encounters`, `/api/v1/system-settings` → 401).
- §4.8.4 Vulnerability scan (`trivy`, `pnpm audit`): zero HIGH/CRITICAL or documented waiver.
- §4.8.5 Secrets not present in logs.

### §4.9 Compliance & auditability

- §4.9.1 Audit trail completeness: every tenant mutation creates an
  `audit_logs` row with `user_id`, `tenant_id`, `entity`, `entity_id`, timestamp.
- §4.9.2 Data retention policy enforced for `phone_home_records`, `login_history`.
- §4.9.3 Encryption at rest for data volumes (LUKS / cloud volume encryption);
  TLS in transit to remote PostgreSQL.

### §4.10 Failure mode rehearsal

- §4.10.1 DB disconnect: backend returns documented degraded response; recovers within 30s after restart.
- §4.10.2 Redis disconnect: login still works; rate limiting falls back to in‑memory.
- §4.10.3 Disk pressure on `/var/glide-hims/updates`: alert fires <5min;
  publish rejected; existing downloads continue.

### §4.11 Documentation completeness

- [ ] §1 Server role diagram
- [ ] §2 Configuration contract `.env` template
- [ ] §3 Deployment checklist (Parts A & B)
- [ ] §4 Verification procedures (this section, all subsections)
- [ ] §5 Operational runbook
- [ ] §6 Troubleshooting & rollback
- [ ] DR plan with RTO/RPO statements
- [ ] Backup schedule & retention policy
- [ ] Incident response playbook with on‑call contacts
- [ ] Change‑management process for `.env` and infrastructure
- [ ] Tenant onboarding SOP
- [ ] Release publishing SOP
- [ ] Customer‑facing licence terms & data‑processing addendum

### §4.12 Final pass criteria

- [ ] §4.1 SaaS role: 7/7 pass
- [ ] §4.2 Update role: 6/6 pass
- [ ] §4.3 Phone‑home role: 4/4 pass
- [ ] §4.4 Dual‑role isolation: 5/5 pass
- [ ] §4.5 Backup & restore: 3/3 pass
- [ ] §4.6 DR rehearsal: 2/2 pass within RTO/RPO
- [ ] §4.7 Performance baseline: 3 baselines recorded and meet targets
- [ ] §4.8 Security verification: 5/5 pass
- [ ] §4.9 Compliance: 3/3 pass
- [ ] §4.10 Failure mode rehearsal: 3/3 pass
- [ ] §4.11 Documentation completeness: 13/13 artefacts version‑controlled

---

## 5. Operational runbook

### 5.1 Publish a new release

```bash
VERSION=1.4.0
TAR=glide-hims-$VERSION.tar.gz

pnpm --filter @glide-hims/backend run build
tar -czf /tmp/$TAR -C /root/glide-Hims/packages/backend dist node_modules package.json
sha256sum /tmp/$TAR > /tmp/$TAR.sha256
gpg --detach-sign --armor /tmp/$TAR

sudo install -o root -g glide-hims -m 0640 /tmp/$TAR     /var/glide-hims/updates/
sudo install -o root -g glide-hims -m 0640 /tmp/$TAR.asc /var/glide-hims/updates/

SYS_TOKEN=$(curl -sS -X POST "$HUB/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$SYSADMIN_USER\",\"password\":\"$SYSADMIN_PASS\"}" | jq -r .accessToken)

curl -sS -X POST "$HUB/api/v1/updates/versions" \
  -H "Authorization: Bearer $SYS_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"version\":\"$VERSION\",\"versionCode\":140,\"checksum\":\"$(awk '{print $1}' /tmp/$TAR.sha256)\",\"isMandatory\":false,\"releaseNotes\":\"…\"}"

curl -sS -X PUT "$HUB/api/v1/updates/versions/$VERSION/set-latest" \
  -H "Authorization: Bearer $SYS_TOKEN"

curl -sS "$HUB/api/v1/updates/check?version=1.0.0" | jq
```

Re‑run §4.2.3 + §4.2.4 to confirm the new tarball downloads and verifies on a remote client.

### 5.2 Onboard a new tenant

1. System admin logs in at `/system/login` (from VPN).
2. Create tenant via `/system/tenants` UI (`name`, `slug`, contact, plan tier).
3. Confirm `GET /api/v1/tenants/public/by-slug/<slug>` returns 200 and `isSetupComplete=false`.
4. Send the customer the URL `https://hmisdemo.itsolutionsuganda.com/setup/<slug>`.
5. Customer completes the setup wizard (seeds initial admin user, flips `isSetupComplete=true`).
6. Verify §4.1.3 succeeds for the new tenant.
7. Add the tenant to monitoring dashboards.

### 5.3 Rotate JWT secrets

1. Generate new values: `openssl rand -base64 64`.
2. Add as `JWT_SECRET_NEXT` / `JWT_REFRESH_SECRET_NEXT`.
3. Restart backend; new tokens use the new secret.
4. Wait for `JWT_REFRESH_EXPIRES_IN` (7 days).
5. Promote `*_NEXT` to primary; remove old.
6. Restart backend.

### 5.4 Lock a compromised license

```bash
sudo -u postgres psql -d glide_hims -c \
  "UPDATE licenses SET status='revoked', revoked_at=now() WHERE key='<lic>';"
```

Next phone‑home returns `licenseValid:false, commands:["lock"]` and the on‑prem client locks itself.

### 5.5 Restore from backup

Follow the DR plan referenced in §4.6. Always restore into a clean host first,
run §4.1 + §4.2 smoke tests there, then promote.

---

## 6. Troubleshooting & rollback

### 6.1 Common failure modes

- **Tenant user gets a working login form at `/`** — `DEPLOYMENT_MODE` is not
  `multi-tenant`. Fix env, restart backend, re‑run §4.1.4 / §4.1.5.
- **Cross‑tenant data visible** — app role has `BYPASSRLS` or RLS not enabled.
  Run §4.1.1; `ALTER ROLE … NOBYPASSRLS;` and re‑run migrations.
- **`/api/v1/updates/check` returns 401** — endpoint accidentally guarded.
  Confirm `@Public()` decorator and remove tenant guard.
- **On‑prem clients fail to phone home** — DNS/TLS or `PHONE_HOME_URL` mismatch
  on client side.
- **Update download corrupts** — tarball overwritten without checksum update.
  Compare `sha256sum` to `app_versions.checksum`; re‑publish.
- **Spike in `Cross-tenant login blocked`** — misconfigured client or attack;
  IP‑block at proxy if attack.
- **`429` on legitimate downloads** — rate limit too tight; adjust proxy
  `limit_req` for `/updates/download`.
- **System admin locked out** — allowlist working as intended; connect via VPN
  or console.

### 6.2 Rollback procedure

```sql
UPDATE app_versions SET is_latest = false WHERE version = '<bad>';
UPDATE app_versions SET is_latest = true  WHERE version = '<prev>';
```

Re‑run §4.2.1–§4.2.3 to confirm the channel; file an incident report with
timeline and root cause.

### 6.3 Emergency lockdown

```bash
sudo systemctl set-environment GLIDE_TENANT_LOGINS_DISABLED=true
sudo systemctl restart glide-hims-backend.service
```

Or, at the proxy: return 503 for `/login/*` and `/api/v1/auth/login` while leaving
`/api/v1/updates` and `/api/phone-home` up.

---

## 7. Document control & sign‑off

### 7.1 Version history

- **1.0** — 2026‑04‑25 — Initial finalised release.

### 7.2 Review cadence

- **Quarterly** review by Engineering, Security, Operations leads.
- **Out‑of‑cycle** review on any of: major architectural change, security
  incident, regulatory update, hosting provider change.

### 7.3 Final sign‑off

The central server is production‑ready when all of the following are true:

- [ ] All Part A deployment checklist items signed off.
- [ ] All §4 verification subsections (§4.1 through §4.11) passed.
- [ ] §4.12 final pass criteria fully ticked.
- [ ] Operational runbook (§5) walked through with the on‑call engineer.
- [ ] Troubleshooting & rollback (§6) walked through with the on‑call engineer.

Authorised signatures:

- [ ] **Engineering owner** ___________________________ date __________
- [ ] **Security reviewer** ___________________________ date __________
- [ ] **Operations owner** ___________________________ date __________
- [ ] **Product / business owner** ____________________ date __________

Once all four signatures are recorded, DNS may be cut over to the central
server, paying tenants may be onboarded, and remote on‑premise clients may be
pointed at the hub for updates and license heartbeats.

---

**End of document.**
