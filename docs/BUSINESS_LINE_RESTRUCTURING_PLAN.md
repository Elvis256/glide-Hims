# Business-Line Native Flow Restructuring Plan

## Problem Statement

Pharmacy, dental, and optical business lines currently feel like "hospital minus features" rather than standalone management systems. The root causes:

1. **Generic landing page** — All business types land on the same DashboardPage with hospital-style layout (stats → quick actions → modules grid). Should land on their own domain-specific dashboards.
2. **Sidebar ordering is hospital-first** — Dental/optical/pharmacy sections are buried as subsections. For a dental practice, dental workflows should BE the primary navigation.
3. **Hospital-centric core flow** — The system funnels through Registration → Encounter → Orders → Billing. Each business line has its own natural flow that should be primary.

## What Already Exists (Surprisingly Complete)

| Module | Frontend Pages | Backend APIs | Dashboard Page |
|--------|---------------|-------------|----------------|
| Pharmacy | 37 pages | Full controller + POS | PharmacyDashboardPage (272 LOC) |
| Dental | 8 pages | 19 endpoints | DentalDashboardPage (261 LOC) |
| Optical | 7 pages | 17 endpoints | OpticalDashboardPage (445 LOC) |

The pieces exist — they just need to be wired as PRIMARY flows, not secondary subsections.

## Implementation Plan

### Phase 1: Smart Landing — Business-Specific Dashboards as Home

**DashboardPage.tsx** detects `businessType` and renders the correct dashboard:
- `pharmacy` → PharmacyDashboardPage component
- `dental` → DentalDashboardPage component
- `optical` → OpticalDashboardPage component
- `hospital` → Current generic dashboard (unchanged)

### Phase 2: Sidebar Navigation Reordering by Business Type

Reorder sidebar sections based on `businessType` so core workflows come first:

**Pharmacy**: POS → Pharmacy → Customers → Billing → Stores → Reports → HR → Admin
**Dental**: Dental → Registration → Billing → Reports → HR → Admin
**Optical**: Optical → Clients → POS → Billing → Stores → Reports → HR → Admin
**Hospital**: Unchanged (current order is correct)

### Phase 3: Business Dashboard Enhancement

Ensure each business-specific dashboard is a true native landing:
- **Pharmacy**: Quick Sale/Dispense buttons, queue, stock alerts, recent sales, expiry warnings
- **Dental**: Today's chairs/appointments, quick chart/plan/lab links, recent activity
- **Optical**: Exam schedule, order pipeline, frame stock alerts, recent orders

### Phase 4: Welcome & Branding per Business Type

Each dashboard says the business name, not "Glide-HIMS":
- "Welcome to [Tenant Name] — Pharmacy Management"
- "Welcome to [Tenant Name] — Dental Practice"
- "Welcome to [Tenant Name] — Optical Center"
- "Welcome to [Tenant Name] — Hospital Management" (default)

## Files to Change

| File | Change |
|------|--------|
| `packages/frontend/src/pages/DashboardPage.tsx` | Conditionally render business-specific dashboard components |
| `packages/frontend/src/components/DashboardLayout.tsx` | Sidebar section reordering by businessType priority map |
| `packages/frontend/src/pages/pharmacy/PharmacyDashboardPage.tsx` | Enhance if needed (quick actions, recent activity) |
| `packages/frontend/src/pages/dental/DentalDashboardPage.tsx` | Enhance if needed (today's schedule, quick actions) |
| `packages/frontend/src/pages/optical/OpticalDashboardPage.tsx` | Already solid — minor wiring |

## Native Flow per Business Line

### Pharmacy Flow
```
Customer walks in → Search/Create Customer → Rx Intake or OTC → Dispense → POS Checkout → Done
```

### Dental Flow
```
Patient arrives → Dental Chart → Treatment Plan → Procedure → Lab Order (if needed) → Billing
```

### Optical Flow
```
Client arrives → Eye Exam → Prescription → Frame + Lens Selection → Order → Fitting → Billing
```

### Hospital Flow (unchanged)
```
Patient Registration → Triage → Encounter → Orders (Lab/Rx/Radiology) → Billing → Discharge
```

## Out of Scope (Future)
- Dental/optical-specific appointment booking
- Insurance pre-authorization workflows
- Drug interaction checking for pharmacy
- PDF exports of dental charts / optical prescriptions
- Recall/follow-up management systems
- Consent form digital signatures
