# Module 08 — Maternity (ANC · Labour · PNC · EPI)

Reviewed and largely built 2026-07-19 (frontend review Block 8). Full lifecycle
E2E-verified live on tesy, API + browser.

## Overview

One page (`/ipd/maternity`, sidebar "Maternity", clinical roles, module `ipd`)
carries the whole maternal-child journey across five tabs:

```
ANC register (ANC number, EDD from LMP, risk level)
  → ANC visits (vitals, fundal height, FHR, Hb, iron/TT/IPT doses)
  → Admit to labour → PARTOGRAPH (WHO alert/action lines, FHR chart, alerts)
  → Record delivery (mode, blood loss/PPH flag, placenta, perineum)
  → Baby outcome(s) (sex, weight kg, Apgars, vit K/BCG; twins supported)
      → auto-generates the 18-dose Uganda EPI schedule per live birth
  → PNC visits 1–4 (WHO contact schedule; danger signs; EPDS; FP counselling)
  → EPI: due list / defaulters / administer (batch, site, adverse reactions)
```

Backend surface: 27 endpoints under `/maternity` (anc/*, labour/* incl.
partograph, pnc/*, baby/wellness, immunization/*, dashboard). All existed
before this block — the UI did not.

## Tabs & views

### Dashboard
Live stats (active ANC / due within 30 days / high risk / deliveries this
month) + active-labour list; clicking a labour opens its partograph.

### ANC Register
Active registrations (GxPy, gestational age, EDD, risk badge) → detail panel:
- **Record ANC Visit** — full WHO visit form (weight/BP/fundal height/FHR/
  presentation/Hb; proteinuria-oedema flags; iron-folate, TT dose, IPT dose;
  complaints/plan/next visit). ✅
- **View Visit History** — inline list with key values and red flags. ✅
- **Admit to Labour** — GA, dilation, BP, notes → labour record; jumps straight
  into the partograph. ✅
- **Register ANC** (page header) — patient search, LMP (EDD auto-preview),
  G/P, blood group/rhesus, risk level with factors, partner contact. Backend
  blocks a second active pregnancy per patient. ✅

### Labour Ward
Active labours with dilation/status; per row: **Partograph** (slide-over:
WHO alert & action lines, dilation + FHR charts, observation entry with
liquor/moulding/oxytocin, crossing alerts as toasts, observation table) and
**Delivery** (two-step modal: delivery details → babies, repeatable for twins;
PPH warning at ≥500ml; live birth auto-generates the EPI schedule). ✅

### Postnatal
Due list computed from deliveries in the last 6 weeks vs the WHO 24h/day-3/
day-7–14/week-6 contact schedule, showing days postpartum and completed
visits. Record Visit modal: vitals, uterus/lochia/breast checks, **maternal
danger-sign panel** (highlights red + refer prompt), iron/vitamin A, family
planning counselling + method, next visit. ✅

### Immunization (EPI)
Due/Scheduled and Defaulters views (mother's name, vaccine, due date, status
chip). **Administer** modal: batch number, site, adverse-reaction capture.
Status flow scheduled → due → overdue → administered handled server-side. ✅

## Fixes shipped in this block

**P0s:**
1. **The entire redesigned maternity module was unreachable in production.**
   `/ipd/maternity` served a dead shell page (five no-op buttons, a Newborns
   tab hardcoded empty with a false "requires backend" note) while the real
   page — including the flagship partograph — was lazy-imported in App.tsx but
   never routed. Route repointed; shell deleted.
2. **ANC registrations list 500'd on every read** (found live): `lmp_date` is
   a `date` column, which the pg driver returns as a string;
   `calculateGestationalAge` called `.getTime()` on it. Every list/by-id read
   crashed. Fixed to accept Date|string.
3. **ANC registration UI didn't exist** ("form coming soon" placeholder) and
   the detail panel's three actions were dead. Without them nothing else in
   the module could ever be exercised.
4. **No UI existed for delivery, baby outcomes, PNC, or EPI** despite complete
   backend support. All built this block (see tabs above).
5. Birth weight unit drift: backend validates kilograms (0.3–7) — the form now
   captures kg with a low-birth-weight flag (grams would 400).
6. `AntenatalRegistration` frontend type lacked `ancNumber` (real column).

**Verified live (tesy):** ANC2026-00001 → visit at 38wks → labour → 2
partograph observations (analysis "normal", alert line present) → SVD, 250ml →
girl 3.2kg Apgar 8/9 → 18-vaccine EPI schedule (BCG@0, OPV-0@0, OPV/DPT/PCV/
Rota@6wk…) → BCG administered (batch BCG-778) → PNC due day 0 → visit 1
recorded → dashboard: 1 delivery this month. Second registration
(ANC2026-00002, G3P2, medium risk, in labour at 5cm) left active on tesy so
demo pages show content.

## Known gaps (deferred)
- Baby wellness checks (`/maternity/baby/wellness`) have no UI yet (danger-sign
  screening for neonates — natural next addition to the PNC visit flow).
- ANC due-soon list (`/maternity/anc/due-soon`) not surfaced (dashboard shows
  the count only).
- Page still uses manual useEffect loads (pre-dates the useQuery standard);
  works correctly, conversion is cosmetic.
- Maternity billing (delivery fees) is not linked from this page — cashier
  flow covers it.
- `eddDate` in the service type vs `edd` on the entity (page reads `edd`
  correctly; type cleanup pending).
