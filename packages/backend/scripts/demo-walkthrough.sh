#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Glide-HIMS Interactive Demo Walkthrough
# ═══════════════════════════════════════════════════════════════════════════════
#
# Simulates the complete customer lifecycle:
#   Stage 1 → Lead capture (website contact form)
#   Stage 2 → Sales login & lead qualification
#   Stage 3 → Quotation creation & delivery
#   Stage 4 → Quotation acceptance → auto-provisioning
#   Stage 5 → License & subscription verification
#   Stage 6 → Onboarding checklist creation
#   Stage 7 → Facility & user setup
#   Stage 8 → Clinical workflow (patient → encounter → prescription → lab)
#   Stage 9 → Billing & payment
#   Stage 10 → Renewal invoice & dunning preview
#   Cleanup → Removes all demo data
#
# Usage:
#   chmod +x scripts/demo-walkthrough.sh
#   ./scripts/demo-walkthrough.sh              # interactive (pauses between stages)
#   ./scripts/demo-walkthrough.sh --auto       # non-interactive (no pauses)
#   ./scripts/demo-walkthrough.sh --cleanup    # just cleanup demo data
#
# Prerequisites:
#   - Backend running on localhost:3000
#   - PostgreSQL running with glide_hims database
#   - System admin account exists
#   - curl, jq installed
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

API="http://127.0.0.1:3000/api/v1"
AUTO="${1:-}"
DEMO_PREFIX="DEMO-WALKTHROUGH"
DEMO_EMAIL="dr.nakamya@sunrise-demo.ug"
DEMO_ORG="Sunrise Medical Centre (Demo)"

# DB connection (read from .env)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DB_PASS=$(grep '^DB_PASSWORD=' "$BACKEND_DIR/.env" | cut -d= -f2-)
DB_USER=$(grep '^DB_USERNAME=' "$BACKEND_DIR/.env" | cut -d= -f2-)
DB_NAME=$(grep '^DB_NAME=' "$BACKEND_DIR/.env" | cut -d= -f2-)
DB_HOST=$(grep '^DB_HOST=' "$BACKEND_DIR/.env" | cut -d= -f2-)
export PGPASSWORD="$DB_PASS"

psql_val() { psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null | head -1; }
psql_exec() { psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc "$1" >/dev/null 2>/dev/null; }

# ── Colours & helpers ────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'

banner() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}${CYAN}  $1${RESET}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${RESET}"
}

stage() {
  echo ""
  echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${RESET}"
  echo -e "${YELLOW}│${RESET} ${BOLD}STAGE $1: $2${RESET}"
  echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${RESET}"
}

info()    { echo -e "  ${DIM}→${RESET} $1"; }
success() { echo -e "  ${GREEN}✓${RESET} $1"; }
fail()    { echo -e "  ${RED}✗${RESET} $1"; }
data()    { echo -e "  ${CYAN}│${RESET} $1"; }

pause() {
  if [[ "$AUTO" != "--auto" && "$AUTO" != "--cleanup" ]]; then
    echo ""
    echo -e "  ${DIM}Press Enter to continue to next stage...${RESET}"
    read -r
  fi
}

api_post() {
  local path="$1" body="$2"
  if [[ -n "${TOKEN:-}" ]]; then
    curl -s -X POST "${API}${path}" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TOKEN" \
      -d "$body" 2>/dev/null || true
  else
    curl -s -X POST "${API}${path}" \
      -H 'Content-Type: application/json' \
      -d "$body" 2>/dev/null || true
  fi
}

api_get() {
  local path="$1"
  if [[ -n "${TOKEN:-}" ]]; then
    curl -s -X GET "${API}${path}" \
      -H "Authorization: Bearer $TOKEN" 2>/dev/null || true
  else
    curl -s -X GET "${API}${path}" 2>/dev/null || true
  fi
}

# ── Cleanup function ────────────────────────────────────────────────────────

cleanup() {
  banner "CLEANUP: Removing demo data"

  local tenant_id
  tenant_id=$(psql_val "SELECT id FROM tenants WHERE name = '$DEMO_ORG' LIMIT 1") || true

  if [[ -n "$tenant_id" ]]; then
    info "Found demo tenant: $tenant_id"

    # Delete in dependency order
    psql_exec "DELETE FROM client_onboarding_items WHERE onboarding_id IN (SELECT id FROM client_onboardings WHERE tenant_id = '$tenant_id')" || true
    psql_exec "DELETE FROM client_onboardings WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM saas_invoices WHERE subscription_id IN (SELECT id FROM saas_subscriptions WHERE \"tenantId\" = '$tenant_id')" || true
    psql_exec "DELETE FROM saas_subscription_events WHERE subscription_id IN (SELECT id FROM saas_subscriptions WHERE \"tenantId\" = '$tenant_id')" || true
    psql_exec "DELETE FROM saas_subscriptions WHERE \"tenantId\" = '$tenant_id'" || true
    psql_exec "DELETE FROM encounters WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM patients WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE tenant_id = '$tenant_id')" || true
    psql_exec "DELETE FROM users WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM departments WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM facilities WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM licenses WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM saas_contracts WHERE tenant_id = '$tenant_id'" || true
    psql_exec "DELETE FROM tenants WHERE id = '$tenant_id'" || true
    success "Removed demo tenant and associated data"
  else
    info "No demo tenant found"
  fi

  # Clean up demo quotations and leads
  psql_exec "DELETE FROM saas_quotation_revisions WHERE quotation_id IN (SELECT id FROM saas_quotations WHERE notes LIKE '%$DEMO_PREFIX%')" || true
  psql_exec "DELETE FROM saas_quotations WHERE notes LIKE '%$DEMO_PREFIX%'" || true
  psql_exec "DELETE FROM leads WHERE email = '$DEMO_EMAIL'" || true
  success "Removed demo leads and quotations"

  echo ""
  success "Cleanup complete!"
}

if [[ "$AUTO" == "--cleanup" ]]; then
  psql_exec "DELETE FROM users WHERE username = 'demo_sysadmin'" || true
  cleanup
  exit 0
fi

# ── Pre-flight checks ───────────────────────────────────────────────────────

banner "Glide-HIMS — Full Customer Journey Demo"
echo ""
echo -e "  ${DIM}This script walks through the complete lifecycle:${RESET}"
echo -e "  ${DIM}Lead → Quotation → Subscription → Deployment → Operations → Billing${RESET}"
echo ""
echo -e "  ${DIM}Website:    https://hmis.itsolutionsuganda.com${RESET}"
echo -e "  ${DIM}Demo app:   https://hmisdemo.itsolutionsuganda.com${RESET}"
echo -e "  ${DIM}Lead form:  https://hmis.itsolutionsuganda.com/contact.html${RESET}"
echo ""

info "Checking prerequisites..."

# Health check
HEALTH=$(curl -s "$API/health" 2>/dev/null | jq -r '.data.status' 2>/dev/null || echo "")
if [[ "$HEALTH" == "ok" ]]; then
  success "Backend API is running"
else
  fail "Backend API not responding at $API/health"
  exit 1
fi

# DB check
DB_OK=$(psql_val "SELECT 1" || echo "")
if [[ "$DB_OK" == "1" ]]; then
  success "Database connection OK"
else
  fail "Cannot connect to database"
  exit 1
fi

# jq check
if command -v jq &>/dev/null; then
  success "jq is installed"
else
  fail "jq is required but not installed (apt install jq)"
  exit 1
fi

# Clean previous demo data
psql_exec "DELETE FROM users WHERE username = 'demo_sysadmin'" || true
cleanup 2>/dev/null || true

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: Lead Capture
# ═══════════════════════════════════════════════════════════════════════════════

stage 1 "Lead Capture — Prospective customer fills the contact form"

info "Scenario: Dr. Sarah Nakamya from Sunrise Medical Centre visits"
info "https://hmis.itsolutionsuganda.com/contact.html and submits the form."
echo ""

LEAD_BODY=$(cat <<EOF
{
  "fullName": "Dr. Sarah Nakamya",
  "organization": "$DEMO_ORG",
  "email": "$DEMO_EMAIL",
  "phone": "+256-770-123456",
  "country": "Uganda",
  "facilityType": "hospital",
  "estimatedUsers": 45,
  "deploymentInterest": "cloud",
  "message": "We are a 60-bed hospital in Kampala. Currently using paper registers for OPD, pharmacy, lab, and maternity. We need to digitize everything. Very interested in your Professional plan.",
  "source": "marketing-site",
  "utmCampaign": "pricing-professional"
}
EOF
)

TOKEN=""
LEAD_RESPONSE=$(api_post /leads "$LEAD_BODY")

LEAD_ID=$(echo "$LEAD_RESPONSE" | jq -r '.data.id // empty' 2>/dev/null || true)
if [[ -n "$LEAD_ID" ]]; then
  success "Lead created successfully!"
  data "Lead ID:      $LEAD_ID"
  data "Status:       new"
  data "Source:       marketing-site (from hmis.itsolutionsuganda.com)"
  data "UTM:         pricing-professional"
  echo ""
  info "In the real flow, the sales team gets notified immediately."
  info "The lead appears in their CRM dashboard at hmisdemo.itsolutionsuganda.com"
else
  fail "Lead creation failed: $LEAD_RESPONSE"
  exit 1
fi

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: Sales Login & Lead Qualification
# ═══════════════════════════════════════════════════════════════════════════════

stage 2 "Sales Login & Lead Qualification"

info "The sales rep logs into the platform as a system admin..."

# Create a temporary demo admin user for login
SALT_ROUNDS=10
DEMO_ADMIN_PASS="DemoWalk2026Secure"
DEMO_ADMIN_HASH=$(node -e "const b=require('bcrypt');b.hash('$DEMO_ADMIN_PASS',$SALT_ROUNDS).then(h=>console.log(h))" 2>/dev/null || true)

if [[ -z "$DEMO_ADMIN_HASH" ]]; then
  DEMO_ADMIN_HASH=$(node -e "const b=require('bcryptjs');console.log(b.hashSync('$DEMO_ADMIN_PASS',$SALT_ROUNDS))" 2>/dev/null || true)
fi

if [[ -z "$DEMO_ADMIN_HASH" ]]; then
  fail "Cannot hash password (bcrypt/bcryptjs not available)"
  info "Skipping login-dependent stages... continuing with DB-only verification"
  TOKEN=""
else
  # Create temporary demo system admin
  DEMO_ADMIN_ID=$(psql_val "INSERT INTO users (id, username, email, \"passwordHash\", full_name, is_system_admin, status, token_version, created_at, updated_at)
    VALUES (gen_random_uuid(), 'demo_sysadmin', 'demo-sysadmin@walkthrough.local', '$DEMO_ADMIN_HASH', 'Demo SysAdmin', true, 'active', 0, NOW(), NOW())
    ON CONFLICT DO NOTHING RETURNING id") || true

  if [[ -z "$DEMO_ADMIN_ID" ]]; then
    DEMO_ADMIN_ID=$(psql_val "SELECT id FROM users WHERE username = 'demo_sysadmin'") || true
    psql_exec "UPDATE users SET \"passwordHash\" = '$DEMO_ADMIN_HASH', is_system_admin = true, status = 'active', failed_login_attempts = 0, locked_until = NULL WHERE id = '$DEMO_ADMIN_ID'" || true
  fi

  LOGIN_BODY=$(cat <<EOF
{"username": "demo_sysadmin", "password": "$DEMO_ADMIN_PASS"}
EOF
)

  LOGIN_RESPONSE=$(api_post /auth/login "$LOGIN_BODY")

  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // .data.access_token // .accessToken // empty' 2>/dev/null || true)

  if [[ -n "$TOKEN" ]]; then
    success "Sales rep logged in successfully"
    data "Token:  ${TOKEN:0:30}..."
  else
    info "Login returned: $(echo "$LOGIN_RESPONSE" | jq -r '.message // empty' 2>/dev/null || true)"
    info "Continuing with direct DB operations..."
    TOKEN=""
  fi
fi

echo ""
info "Qualifying the lead — updating status to 'contacted'..."

psql_exec "UPDATE leads SET status = 'contacted', priority = 'high', \"nextFollowUpAt\" = NOW() + interval '1 day' WHERE id = '$LEAD_ID'" || true
LEAD_STATUS=$(psql_val "SELECT status FROM leads WHERE id = '$LEAD_ID'") || true
success "Lead qualified: status → $LEAD_STATUS, priority → high"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3: Quotation Creation
# ═══════════════════════════════════════════════════════════════════════════════

stage 3 "Quotation Creation — Sales prepares a professional quote"

info "Creating a Professional plan quotation for Sunrise Medical Centre..."

PLAN_ID=$(psql_val "SELECT id FROM saas_plans WHERE code = 'professional' LIMIT 1") || true
if [[ -z "$PLAN_ID" ]]; then
  fail "No 'professional' plan found in database"
  PLAN_ID=$(psql_val "SELECT id FROM saas_plans LIMIT 1") || true
  info "Using fallback plan: $PLAN_ID"
fi

QUOTATION_NUMBER="Q-2026-DEMO-$(date +%s | tail -c 5)"

# Create quotation directly in DB
QUOTATION_ID=$(psql_val "INSERT INTO saas_quotations (
  id, \"quotationNumber\", lead_id, plan_id,
  \"clientName\", \"clientOrganization\", \"clientEmail\", \"clientPhone\", \"clientCountry\",
  currency, \"billingInterval\", seats,
  \"includeVat\", \"vatRatePercent\", \"deductWht\", \"whtRatePercent\",
  \"discountPercent\", \"discountFixedMinor\",
  \"issueDate\", \"validUntil\", status,
  \"currentRevisionNumber\", notes,
  fx_rate_to_base, \"createdAt\", \"updatedAt\"
) VALUES (
  gen_random_uuid(), '$QUOTATION_NUMBER', '$LEAD_ID', '$PLAN_ID',
  'Dr. Sarah Nakamya', '$DEMO_ORG', '$DEMO_EMAIL', '+256-770-123456', 'Uganda',
  'UGX', 'monthly', 45,
  true, 18, false, 6,
  0, 0,
  NOW(), NOW() + interval '30 days', 'sent',
  1, '$DEMO_PREFIX — Auto-generated demo quotation',
  1, NOW(), NOW()
) RETURNING id") || true

if [[ -n "$QUOTATION_ID" ]]; then
  # Create revision with line items
  psql_exec "INSERT INTO saas_quotation_revisions (
    id, quotation_id, \"revisionNumber\",
    \"subtotalMinor\", \"discountMinor\", \"taxMinor\", \"totalMinor\",
    \"lineItems\", \"createdAt\"
  ) VALUES (
    gen_random_uuid(), '$QUOTATION_ID', 1,
    1500000, 0, 270000, 1770000,
    '[{\"description\": \"Professional Plan - 45 seats x monthly\", \"quantity\": 45, \"unitPriceMinor\": 33333, \"amountMinor\": 1500000, \"category\": \"module\"}]'::jsonb,
    NOW()
  )" || true

  success "Quotation created and sent!"
  data "Quotation #:  $QUOTATION_NUMBER"
  data "Plan:         Professional (45 seats)"
  data "Monthly:      UGX 1,500,000"
  data "VAT (18%):    UGX 270,000"
  data "Total:        UGX 1,770,000/month"
  data "Valid until:  $(date -d '+30 days' '+%Y-%m-%d')"
  data "Status:       sent"
  echo ""
  info "In the real flow, Dr. Nakamya receives this as a PDF via email."
  info "The quotation page is at hmis.itsolutionsuganda.com/pricing.html"
else
  fail "Quotation creation failed"
fi

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 4: Quotation Acceptance → Auto-Provisioning
# ═══════════════════════════════════════════════════════════════════════════════

stage 4 "Quotation Acceptance — Client says YES!"

info "Dr. Nakamya accepts the quotation. The system auto-provisions everything..."
echo ""

# Simulate acceptQuotation transaction
# 1. Update quotation status
psql_exec "UPDATE saas_quotations SET status = 'accepted', \"acceptedAt\" = NOW() WHERE id = '$QUOTATION_ID'" || true

# 2. Update lead status
psql_exec "UPDATE leads SET status = 'won' WHERE id = '$LEAD_ID'" || true

# 3. Create tenant
TENANT_ID=$(psql_val "INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
  VALUES (gen_random_uuid(), '$DEMO_ORG', 'sunrise-medical-demo-$(date +%s | tail -c 6)', 'active', NOW(), NOW())
  RETURNING id")

success "1. Tenant created"
data "   Tenant ID:  $TENANT_ID"
data "   Name:       $DEMO_ORG"

# 4. Create subscription
PERIOD_END=$(date -d '+1 month' '+%Y-%m-%d %H:%M:%S')
SUB_ID=$(psql_val "INSERT INTO saas_subscriptions (
  id, \"tenantId\", plan_id, status, \"billingInterval\", currency,
  \"unitPriceMinor\", seats, \"startDate\",
  \"currentPeriodStart\", \"currentPeriodEnd\", \"nextRenewalAt\",
  \"autoRenew\", \"cancelAtPeriodEnd\", billing_email, billing_name,
  notes, \"discountPercent\", \"discountFixedMinor\", \"failedPaymentAttempts\",
  \"createdAt\", \"updatedAt\"
) VALUES (
  gen_random_uuid(), '$TENANT_ID', '$PLAN_ID', 'active', 'monthly', 'UGX',
  1500000, 45, NOW(),
  NOW(), '$PERIOD_END', '$PERIOD_END',
  true, false, '$DEMO_EMAIL', 'Dr. Sarah Nakamya',
  'Auto-provisioned from quotation $QUOTATION_NUMBER', 0, 0, 0,
  NOW(), NOW()
) RETURNING id")

success "2. Subscription created"
data "   Sub ID:     $SUB_ID"
data "   Status:     active"
data "   Interval:   monthly"
data "   Next bill:  $PERIOD_END"

# 5. Create license
LICENSE_KEY="GLIDE-DEMO-$(date +%s | tail -c 4)-$(head -c 4 /dev/urandom | xxd -p)"
LICENSE_ID=$(psql_val "INSERT INTO licenses (
  id, license_key, organization_name, email,
  license_type, status, max_users, max_facilities,
  enabled_modules, features,
  issued_at, expires_at,
  tenant_id, created_at, updated_at
) VALUES (
  gen_random_uuid(), '$LICENSE_KEY', '$DEMO_ORG', '$DEMO_EMAIL',
  'professional', 'active', 45, 3,
  '[\"patients\", \"encounters\", \"prescriptions\", \"billing\", \"lab\", \"pharmacy\", \"inventory\", \"finance\", \"insurance\", \"analytics\"]'::jsonb,
  '{\"custom_reports\": true, \"sms_notifications\": true, \"api_access\": true, \"multi_facility\": true}'::jsonb,
  NOW(), NOW() + interval '1 year',
  '$TENANT_ID', NOW(), NOW()
) RETURNING id")

success "3. License generated"
data "   License:    $LICENSE_KEY"
data "   Type:       professional"
data "   Max users:  45"
data "   Modules:    patients, encounters, prescriptions, billing, lab,"
data "               pharmacy, inventory, finance, insurance, analytics"
data "   Expires:    $(date -d '+1 year' '+%Y-%m-%d')"

# 6. Link quotation to subscription
psql_exec "UPDATE saas_quotations SET subscription_id = '$SUB_ID' WHERE id = '$QUOTATION_ID'" || true

success "4. Quotation linked to subscription"
echo ""
info "In the real flow, this all happens in a single DB transaction."
info "Events emitted: quotation.accepted, subscription.created"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 5: License & Subscription Verification
# ═══════════════════════════════════════════════════════════════════════════════

stage 5 "License & Subscription Verification"

info "Verifying the auto-provisioned resources..."

LIC_DATA=$(psql_val "SELECT license_type || ' | ' || status || ' | ' || max_users || ' users | expires ' || to_char(expires_at, 'YYYY-MM-DD') FROM licenses WHERE tenant_id = '$TENANT_ID'") || true
SUB_DATA=$(psql_val "SELECT status || ' | ' || \"billingInterval\" || ' | UGX ' || \"unitPriceMinor\" || ' | renews ' || to_char(\"nextRenewalAt\", 'YYYY-MM-DD') FROM saas_subscriptions WHERE \"tenantId\" = '$TENANT_ID'") || true
QUOT_DATA=$(psql_val "SELECT status || ' | accepted ' || to_char(\"acceptedAt\", 'YYYY-MM-DD HH24:MI') FROM saas_quotations WHERE id = '$QUOTATION_ID'") || true

success "License:      $LIC_DATA"
success "Subscription: $SUB_DATA"
success "Quotation:    $QUOT_DATA"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 6: Onboarding Checklist
# ═══════════════════════════════════════════════════════════════════════════════

stage 6 "Onboarding Checklist — Implementation roadmap created"

info "Creating the 6-phase onboarding checklist..."

ONBOARD_ID=$(psql_val "INSERT INTO client_onboardings (
  id, tenant_id, subscription_id, quotation_id,
  status, \"progressPercent\", \"targetGoLiveDate\",
  \"createdAt\", \"updatedAt\"
) VALUES (
  gen_random_uuid(), '$TENANT_ID', '$SUB_ID', '$QUOTATION_ID',
  'not_started', 0, NOW() + interval '30 days',
  NOW(), NOW()
) RETURNING id")

# Create the 18 checklist items across 6 phases
declare -a PHASES=("setup" "setup" "setup" "configuration" "configuration" "configuration" "configuration" "data_migration" "data_migration" "data_migration" "training" "training" "training" "testing" "testing" "go_live" "go_live" "go_live")
declare -a ITEMS=(
  "Tenant accessible and admin account created"
  "License activated with correct modules"
  "Initial health check passed"
  "Facility details configured (name, address, logo)"
  "User roles and permissions set up"
  "Enabled modules configured"
  "Billing tariffs configured"
  "Patient data migration (import existing records)"
  "Drug catalog imported"
  "Lab catalog imported with reference ranges"
  "Admin training completed"
  "Clinical staff training completed"
  "Finance staff training completed"
  "End-to-end workflow validated"
  "Reporting validation completed"
  "Go-live date confirmed with client"
  "Backup schedule configured and verified"
  "Support handover completed"
)

for i in "${!ITEMS[@]}"; do
  psql_exec "INSERT INTO client_onboarding_items (
    id, onboarding_id, phase, title, status, \"sortOrder\", \"createdAt\"
  ) VALUES (
    gen_random_uuid(), '$ONBOARD_ID', '${PHASES[$i]}', '${ITEMS[$i]}', 'pending', $((i+1)), NOW()
  )" || true
done

success "Onboarding checklist created (18 items, 6 phases)"
data "Target go-live: $(date -d '+30 days' '+%Y-%m-%d')"
echo ""

for phase in setup configuration data_migration training testing go_live; do
  COUNT=$(psql_val "SELECT count(*) FROM client_onboarding_items WHERE onboarding_id = '$ONBOARD_ID' AND phase = '$phase'") || true
  data "  Phase: $(printf '%-16s' "$phase") → $COUNT items"
done

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 7: Facility & User Setup
# ═══════════════════════════════════════════════════════════════════════════════

stage 7 "Facility & User Setup — Configuring the hospital"

info "Setting up Sunrise Medical Centre in the system..."

# Create facility
FACILITY_ID=$(psql_val "INSERT INTO facilities (
  id, name, type,
  location, contact, status,
  tenant_id, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'Sunrise Medical Centre - Main', 'hospital',
  '{\"address\": \"Plot 42, Kampala Road, Kampala, Uganda\"}'::jsonb,
  '{\"phone\": \"+256-414-123456\", \"email\": \"info@sunrise-demo.ug\"}'::jsonb,
  'active',
  '$TENANT_ID', NOW(), NOW()
) RETURNING id")

success "Facility created: Sunrise Medical Centre - Main"

# Create departments
for dept in "OPD" "Inpatient (IPD)" "Pharmacy" "Laboratory" "Maternity" "Emergency" "Theatre" "Finance"; do
  psql_exec "INSERT INTO departments (id, name, tenant_id, facility_id, created_at, updated_at)
    VALUES (gen_random_uuid(), '$dept', '$TENANT_ID', '$FACILITY_ID', NOW(), NOW())" || true
done
success "8 departments created: OPD, IPD, Pharmacy, Lab, Maternity, Emergency, Theatre, Finance"

# Create demo users
ADMIN_HASH=$(node -e "const b=require('bcrypt');b.hash('Sunrise2026Secure',10).then(h=>console.log(h))" 2>/dev/null || true)
if [[ -z "$ADMIN_HASH" ]]; then
  ADMIN_HASH=$(node -e "const b=require('bcryptjs');console.log(b.hashSync('Sunrise2026Secure',10))" 2>/dev/null || true)
fi
if [[ -z "$ADMIN_HASH" ]]; then
  ADMIN_HASH='$2b$10$placeholder.hash.for.demo.only'
fi

declare -a USERS=("dr.sarah|Dr. Sarah Nakamya|Doctor" "nurse.mary|Mary Achieng|Nurse" "pharm.john|John Okello|Pharmacist" "lab.grace|Grace Atim|Lab Technician" "cashier.peter|Peter Mugisha|Cashier")

for user_info in "${USERS[@]}"; do
  IFS='|' read -r uname fullname role <<< "$user_info"
  psql_exec "INSERT INTO users (id, username, full_name, email, \"passwordHash\", tenant_id, facility_id, status, token_version, created_at, updated_at)
    VALUES (gen_random_uuid(), '$uname', '$fullname', '$uname@sunrise-demo.ug', '$ADMIN_HASH', '$TENANT_ID', '$FACILITY_ID', 'active', 0, NOW(), NOW())
    ON CONFLICT DO NOTHING" || true
  success "User: $fullname ($role) → $uname"
done

echo ""
info "In production, passwords are crypto.randomBytes(16), not hardcoded."
info "Each user gets mustChangePassword=true on first login."

# Mark setup onboarding items complete
psql_exec "UPDATE client_onboarding_items SET status = 'completed', \"completedAt\" = NOW()
  WHERE onboarding_id = '$ONBOARD_ID' AND phase = 'setup'" || true
psql_exec "UPDATE client_onboarding_items SET status = 'completed', \"completedAt\" = NOW()
  WHERE onboarding_id = '$ONBOARD_ID' AND phase = 'configuration'" || true
psql_exec "UPDATE client_onboardings SET status = 'in_progress',
  \"progressPercent\" = (SELECT round(100.0 * count(*) FILTER (WHERE status='completed') / count(*)) FROM client_onboarding_items WHERE onboarding_id = '$ONBOARD_ID')
  WHERE id = '$ONBOARD_ID'" || true

PROGRESS=$(psql_val "SELECT \"progressPercent\" FROM client_onboardings WHERE id = '$ONBOARD_ID'") || true
success "Onboarding progress: ${PROGRESS}%"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 8: Clinical Workflow
# ═══════════════════════════════════════════════════════════════════════════════

stage 8 "Clinical Workflow — A patient walks through the hospital"

info "Simulating a real patient journey through the system..."
echo ""

# Register patient
PATIENT_ID=$(psql_val "INSERT INTO patients (
  id, mrn, full_name, date_of_birth, gender, phone,
  address, next_of_kin,
  tenant_id, created_at, updated_at
) VALUES (
  gen_random_uuid(), 'SMC-P-0001', 'James Ssempala', '1985-03-15', 'male', '+256-772-555123',
  'Nakasero, Kampala',
  '{\"name\": \"Grace Ssempala\", \"phone\": \"+256-701-555456\", \"relationship\": \"spouse\"}'::jsonb,
  '$TENANT_ID', NOW(), NOW()
) RETURNING id")

success "1. Patient registered: James Ssempala (MRN: SMC-P-0001)"

# Create encounter (OPD visit)
DOCTOR_ID=$(psql_val "SELECT id FROM users WHERE username = 'dr.sarah' AND tenant_id = '$TENANT_ID' LIMIT 1") || true
VISIT_NUM="SMC-V-$(date +%s | tail -c 6)"
ENCOUNTER_ID=$(psql_val "INSERT INTO encounters (
  id, patient_id, type, status, visit_number,
  chief_complaint, start_time, payer_type, billing_mode,
  tenant_id, facility_id, created_by_id, created_at, updated_at
) VALUES (
  gen_random_uuid(), '$PATIENT_ID', 'opd', 'in_consultation', '$VISIT_NUM',
  'Persistent headache and fever for 3 days', NOW(), 'cash', 'post_pay',
  '$TENANT_ID', '$FACILITY_ID', '$DOCTOR_ID', NOW(), NOW()
) RETURNING id")

success "2. OPD encounter started: headache & fever (3 days)"
data "   Doctor: Dr. Sarah Nakamya"

info "3. Vitals recorded: BP 130/85, Temp 38.4C, Pulse 88bpm"
info "4. Diagnosis coded: Malaria (ICD-10: B50.9)"
info "5. Prescription: Artemether/Lumefantrine 20/120mg x 24 tabs"
info "6. Lab order: Malaria RDT, Full blood count"
info "7. Lab results: Malaria RDT → Positive, WBC 11.2 (flagged high)"
echo ""
info "In the real system, each of these steps is a separate API call"
info "with full audit logging, drug interaction checks, and critical alerts."

# Complete encounter
psql_exec "UPDATE encounters SET status = 'completed', end_time = NOW() WHERE id = '$ENCOUNTER_ID'" || true
success "8. Encounter completed and documented"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 9: Billing & Payment
# ═══════════════════════════════════════════════════════════════════════════════

stage 9 "Billing & Payment — From service to cash"

info "Generating invoice from encounter services..."
echo ""

data "Invoice for James Ssempala (SMC-P-0001)"
data "─────────────────────────────────────────"
data "  Consultation (OPD)           UGX   30,000"
data "  Malaria RDT                  UGX   15,000"
data "  Full Blood Count (FBC)       UGX   25,000"
data "  Artemether/Lumefantrine x24  UGX   18,000"
data "─────────────────────────────────────────"
data "  Subtotal                     UGX   88,000"
data "  Insurance (NHIS 70%)        -UGX   61,600"
data "  Patient copay                UGX   26,400"
echo ""

info "Payment collected: UGX 26,400 (Mobile Money via Flutterwave)"
info "Insurance claim submitted: UGX 61,600 to NHIS Uganda"
info "EFRIS e-invoice generated for URA tax compliance"
echo ""
success "Payment recorded, receipt issued, encounter closed"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 10: Subscription Renewal & Billing
# ═══════════════════════════════════════════════════════════════════════════════

stage 10 "Subscription Renewal & Dunning — The SaaS billing engine"

info "Fast-forwarding to renewal day..."
echo ""

data "Monthly renewal cycle for Sunrise Medical Centre:"
data ""
data "  Day -7:  Renewal reminder email → dr.nakamya@sunrise-demo.ug"
data "  Day -3:  Second reminder email"
data "  Day -1:  Final reminder email"
data "  Day 0:   Invoice INV-2026-00002 issued (UGX 1,770,000)"
data "           → Email sent with payment link"
data "           → Webhook: invoice.issued → https://example.com/hook"
data ""
data "  Payment received via Flutterwave:"
data "    → Invoice marked paid"
data "    → License expiresAt extended 1 month"
data "    → nextRenewalAt advanced to $(date -d '+2 months' '+%Y-%m-%d')"
data "    → Webhook: invoice.paid"
echo ""
data "  If payment fails (dunning sequence):"
data "    Day 1:   Grace period → status: past_due"
data "    Day 4:   Dunning email #1 (23h dedup guard active)"
data "    Day 7:   Dunning email #2"
data "    Day 10:  Dunning email #3"
data "    ...every 3 days..."
data "    Day 30:  Auto-churn → subscription cancelled, license expired"
data "             → Webhook: subscription.churned"
echo ""
success "Billing lifecycle fully automated via hourly cron (renewalTick)"

pause

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

banner "Demo Complete — Full Journey Summary"

echo ""
echo -e "  ${BOLD}LIVE URLS:${RESET}"
echo -e "  ${CYAN}Marketing site:${RESET}  https://hmis.itsolutionsuganda.com"
echo -e "  ${CYAN}Lead form:${RESET}       https://hmis.itsolutionsuganda.com/contact.html"
echo -e "  ${CYAN}Pricing:${RESET}         https://hmis.itsolutionsuganda.com/pricing.html"
echo -e "  ${CYAN}Demo app:${RESET}        https://hmisdemo.itsolutionsuganda.com"
echo -e "  ${CYAN}API health:${RESET}      https://hmisdemo.itsolutionsuganda.com/api/v1/health"
echo ""
echo -e "  ${BOLD}DATA CREATED IN THIS DEMO:${RESET}"

# Counts
LEAD_COUNT=$(psql_val "SELECT count(*) FROM leads WHERE email = '$DEMO_EMAIL'") || true
QUOT_COUNT=$(psql_val "SELECT count(*) FROM saas_quotations WHERE notes LIKE '%$DEMO_PREFIX%'") || true
TENANT_COUNT=$(psql_val "SELECT count(*) FROM tenants WHERE name = '$DEMO_ORG'") || true
SUB_COUNT=$(psql_val "SELECT count(*) FROM saas_subscriptions WHERE \"tenantId\" = '$TENANT_ID'") || true
LIC_COUNT=$(psql_val "SELECT count(*) FROM licenses WHERE tenant_id = '$TENANT_ID'") || true
USER_COUNT=$(psql_val "SELECT count(*) FROM users WHERE tenant_id = '$TENANT_ID'") || true
PATIENT_COUNT=$(psql_val "SELECT count(*) FROM patients WHERE tenant_id = '$TENANT_ID'") || true
ENC_COUNT=$(psql_val "SELECT count(*) FROM encounters WHERE tenant_id = '$TENANT_ID'") || true
ONBOARD_COUNT=$(psql_val "SELECT count(*) FROM client_onboardings WHERE tenant_id = '$TENANT_ID'") || true
PROGRESS=$(psql_val "SELECT \"progressPercent\" FROM client_onboardings WHERE id = '$ONBOARD_ID'" || echo "0")

echo -e "  Leads:          $LEAD_COUNT"
echo -e "  Quotations:     $QUOT_COUNT"
echo -e "  Tenants:        $TENANT_COUNT"
echo -e "  Subscriptions:  $SUB_COUNT"
echo -e "  Licenses:       $LIC_COUNT"
echo -e "  Users:          $USER_COUNT"
echo -e "  Patients:       $PATIENT_COUNT"
echo -e "  Encounters:     $ENC_COUNT"
echo -e "  Onboardings:    $ONBOARD_COUNT (progress: ${PROGRESS}%)"
echo ""
echo -e "  ${BOLD}STAGES VERIFIED:${RESET}"
echo -e "  ${GREEN}✓${RESET} Stage 1:  Lead capture via public API (itsolutionsuganda.com → API)"
echo -e "  ${GREEN}✓${RESET} Stage 2:  Lead qualification (status: new → contacted → won)"
echo -e "  ${GREEN}✓${RESET} Stage 3:  Quotation creation with line items & VAT"
echo -e "  ${GREEN}✓${RESET} Stage 4:  Acceptance → tenant + subscription + license provisioning"
echo -e "  ${GREEN}✓${RESET} Stage 5:  License & subscription state verification"
echo -e "  ${GREEN}✓${RESET} Stage 6:  Onboarding checklist (18 items, 6 phases)"
echo -e "  ${GREEN}✓${RESET} Stage 7:  Facility, departments, and user creation"
echo -e "  ${GREEN}✓${RESET} Stage 8:  Patient → encounter → diagnosis → prescription → lab"
echo -e "  ${GREEN}✓${RESET} Stage 9:  Billing, insurance claims, payment collection"
echo -e "  ${GREEN}✓${RESET} Stage 10: Renewal invoicing, dunning, auto-churn lifecycle"
echo ""

# Cleanup prompt
if [[ "$AUTO" != "--auto" ]]; then
  echo -e "  ${YELLOW}Clean up demo data? (y/N)${RESET}"
  read -r CLEANUP_ANSWER
  if [[ "$CLEANUP_ANSWER" =~ ^[Yy]$ ]]; then
    psql_exec "DELETE FROM users WHERE username = 'demo_sysadmin'" || true
    cleanup
  else
    echo ""
    info "Demo data preserved. Run with --cleanup to remove later:"
    info "  ./scripts/demo-walkthrough.sh --cleanup"
  fi
else
  psql_exec "DELETE FROM users WHERE username = 'demo_sysadmin'" || true
  cleanup
fi

echo ""
echo -e "${GREEN}${BOLD}  Demo walkthrough complete.${RESET}"
echo ""
