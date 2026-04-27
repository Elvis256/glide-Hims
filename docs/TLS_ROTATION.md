# TLS Material Inventory & Rotation Procedure

Owner: platform / SRE
Last reviewed: 2026-04-27 (after audit + rotation #1)

## 1. Current Posture

| Where it lives | Purpose | Type | CN | Notes |
|---|---|---|---|---|
| Cloudflare edge | TLS to public internet | Cloudflare-managed | `hmisdemo.itsolutionsuganda.com` (Universal SSL) | Terminates client TLS, proxies to origin. We do not manage this key. |
| `/etc/nginx/wildcard.{crt,key}` (origin VM) | TLS between Cloudflare and our nginx | self-signed (RSA-4096, 2-yr) | `CN=*.hmisdemo.itsolutionsuganda.com`, SAN includes apex | Cloudflare proxies in **Full** mode and accepts self-signed origin certs. Origin cert is invisible to end users. |

Cloudflare Universal SSL covers a single subdomain level (`hmisdemo.itsolutionsuganda.com`) but **NOT** sub-subdomains
(e.g. `demo-hospital.hmisdemo.itsolutionsuganda.com`). This is why tenant routing currently uses path-based slugs
(`/login/{slug}`) and not subdomains. To enable real `{slug}.hmisdemo.itsolutionsuganda.com` routing later you must
either:
  - Provision a Cloudflare **Advanced Certificate** for `*.hmisdemo.itsolutionsuganda.com` (paid), OR
  - Greycloud the wildcard DNS record so traffic hits nginx directly with the origin cert (loses Cloudflare proxy).

## 2. What was previously committed to git (history audit)

Two **self-signed development certificates** were briefly tracked in git, then removed by `chore: remove secrets and SSL certs from git tracking` (commit `7607631`).

| Path | First commit | Removed in | CN | Risk |
|---|---|---|---|---|
| `packages/backend/ssl/server.{crt,key}` | `6deca00` | `7607631` | `CN=localhost`, O=Org | LOW. Self-signed, localhost only. Cannot impersonate any real domain. Was always intended for local dev. |
| `packages/frontend/certs/{cert,key}.pem` | `7d29217` | `7607631` | `CN=localhost`, O=Org | LOW. Vite local-HTTPS dev cert. Same reasoning. |

These two key files **are still recoverable from git history** (e.g. `git show 6deca00:packages/backend/ssl/server.key`). Risk
is bounded to "an attacker can MITM a developer's `https://localhost`". They cannot be used against any production
hostname.

The current production wildcard origin cert (`/etc/nginx/wildcard.*`) was created on the host *after* `.gitignore` was
updated, so it has **never** been in any commit. Verified with:

```bash
git log --all --pretty=oneline -- wildcard.crt wildcard.key  # returns no commits
```

## 3. Decision matrix

| Action | Effort | Benefit | Recommended? |
|---|---|---|---|
| Leave the two dev keys in history | none | n/a | ✅ Default. Risk is negligible (localhost-only). |
| `git filter-repo` to scrub history | medium (rewrites SHAs, breaks every clone & open PR) | Removes the dev keys from history | ❌ Not worth it for self-signed localhost certs. Reconsider only if the repo becomes public AND there is a policy requirement. |
| Rotate the current production wildcard origin key | low | Defense-in-depth. New key replaces any operational copy that may have been backed up. | ✅ Done 2026-04-27. |
| Migrate origin cert to Cloudflare Origin CA | low (one-time) | Free, signed by Cloudflare's CA, valid 15 years, perfectly accepted by Cloudflare proxy. Avoids cert-expiry alarms on this VM. | ⏭ Recommended for next maintenance window. |

## 4. Rotation procedure (current self-signed setup)

Done 2026-04-27. Repeat any time the origin key may have leaked, or every ~24 months.

```bash
# 1. Generate a new key + 825-day self-signed cert with SAN
openssl req -x509 -nodes -newkey rsa:4096 -days 825 \
  -subj "/CN=*.hmisdemo.itsolutionsuganda.com" \
  -addext "subjectAltName=DNS:*.hmisdemo.itsolutionsuganda.com,DNS:hmisdemo.itsolutionsuganda.com" \
  -keyout /tmp/wildcard.key.new -out /tmp/wildcard.crt.new

# 2. Back up current cert + install new one with strict permissions
cp /etc/nginx/wildcard.crt /etc/nginx/wildcard.crt.bak.$(date +%Y%m%d)
cp /etc/nginx/wildcard.key /etc/nginx/wildcard.key.bak.$(date +%Y%m%d)
install -m 644 /tmp/wildcard.crt.new /etc/nginx/wildcard.crt
install -m 600 /tmp/wildcard.key.new /etc/nginx/wildcard.key
rm /tmp/wildcard.key.new /tmp/wildcard.crt.new

# 3. Validate + reload nginx (no downtime)
nginx -t && systemctl reload nginx

# 4. Smoke test through Cloudflare
curl -sk -o /dev/null -w "%{http_code}\n" https://hmisdemo.itsolutionsuganda.com/api/v1/health  # expect 200

# 5. Once verified stable for ~24 h, delete the .bak files
rm /etc/nginx/wildcard.{crt,key}.bak.YYYYMMDD
```

## 5. Recommended migration: Cloudflare Origin CA cert

Free, signed by Cloudflare's internal CA, accepted by their proxy with full validation:

1. Cloudflare dashboard → SSL/TLS → **Origin Server** → Create Certificate.
2. Use defaults (RSA-2048 or ECDSA, 15-year validity, hostnames `*.hmisdemo.itsolutionsuganda.com,hmisdemo.itsolutionsuganda.com`).
3. Save the cert as `/etc/nginx/wildcard.crt` and the key as `/etc/nginx/wildcard.key`.
4. Set Cloudflare SSL/TLS encryption mode to **Full (strict)** — Cloudflare will then verify our origin cert.
5. `nginx -t && systemctl reload nginx`.

After this, expiry monitoring becomes nearly a non-issue and we get cryptographic mutual authentication between
Cloudflare's edge and our origin.

## 6. Operational gitignore (reaffirmed)

The repository's `.gitignore` already covers all known cert/key locations. Do not remove these entries:

```
packages/backend/ssl/
packages/frontend/certs/
wildcard.crt
wildcard.key
*.pem
```

If a developer needs local-HTTPS for the frontend, they should generate self-signed certs *outside* the repo
(e.g. with `mkcert` into `~/.local/share/glide-hims-dev/`) and point Vite at them via env vars.

## 7. Inventory of secrets to also rotate if the host is ever assumed compromised

Not TLS-specific, but document for the same blast-radius reasoning:

- `packages/backend/.env` — `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD`. None of these are in git, but they
  live next to the rotated TLS material on disk.
- Postgres password (`postgres` role) — change in `pg_hba.conf` + restart Postgres.
- elvis (system admin) password — change via `/system/login` → forced change-password flow.
- All tenant admin passwords — via `POST /api/v1/users/system-reset-password/:id` as elvis.
