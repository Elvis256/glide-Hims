# Module 05 — Pharmacy

Frontend review, Block 5 of the registration→admin campaign. Covers the
pharmacist-facing pharmacy module: the dispense worklist and 5-step dispense
wizard, controlled-substance register, stock/returns/inpatient, cold-chain,
labels, DUR/analytics, notifications, drug-database sync, and the
drug-management admin pages.

**tsc gate:** frontend 0 / backend 0 (cold). **Verification:** line-by-line
read of all pages against the hunt list + backend entities/DTOs (two review
agents + direct verification); browser E2E on tesy (Dan login) — all 17 pages
render crash-free and `/pharmacy` redirects to the dashboard. Data-driven E2E
was limited: tesy has ~no pharmacy data (0 prescriptions, 0 sales, 0 drug
classifications, 3 drug items), so empty lists are legitimate; the critical
extractions were code-verified against the backend instead.

## Routes & reachability

| Route | Page | Guard | Notes |
|---|---|---|---|
| `/pharmacy` | — | — | Redirects to `/pharmacy/dashboard` |
| `/pharmacy/dashboard` | PharmacyDashboardPage | PharmacistRoute · pharmacy | KPIs + quick actions |
| `/pharmacy/queue` | PharmacyQueuePage | PharmacistRoute | Dispense worklist |
| `/pharmacy/dispense` | DispenseMedicationPage | PharmacistRoute | 5-step dispense wizard |
| `/pharmacy/stock` | PharmacyStockPage | PharmacistRoute | Inventory + adjust |
| `/pharmacy/returns` | ReturnsPage | PharmacistRoute | Returns tracking |
| `/pharmacy/inpatient` | InpatientMedsPage | PharmacistRoute | Ward meds (mostly mock) |
| `/pharmacy/analytics` | PharmacyAnalyticsPage | PharmacistRoute | Sales/profit KPIs |
| `/pharmacy/adherence` | MedicationAdherencePage | PharmacistRoute | Per-patient adherence |
| `/pharmacy/labels` | LabelManagementPage | PharmacistRoute | Multilingual Rx labels |
| `/pharmacy/temperature` | TemperatureMonitoringPage | PharmacistRoute | Cold-chain |
| `/pharmacy/dur-reports` | DURReportsPage | PharmacistRoute | Drug-utilisation review |
| `/pharmacy/drug-db-sync` | DrugDatabaseSyncPage | PharmacistRoute | OpenFDA sync |
| `/pharmacy/rx-templates` | PrescriptionTemplatesPage | PharmacistRoute | Rx templates |
| `/pharmacy/notifications` | NotificationLogPage | PharmacistRoute | SMS log |
| `/pharmacy/controlled-register` | ControlledSubstancesRegisterPage | PharmacistRoute | Legal register |
| `/pharmacy/supplier-rankings` | SupplierRankingsPage | PharmacistRoute | Supplier scorecards |
| `/drug-management/interactions` | DrugInteractionsDatabasePage | PharmacistRoute | **Unlinked; fantasy shape** |
| `/drug-management/allergy-classes` | AllergyClassesPage | PharmacistRoute | **Unlinked; fantasy shape** |
| `/pharmacy/retail·wholesale·adjustments·transfers·po·grn·…` | — | — | Redirect to POS/inventory/procurement (other blocks) |

**Medication-safety enforcement is server-side and fail-closed at prescription
CREATE** (`prescriptions.service.ts:186` throws unless `safetyOverride`) and
again in `dispenseBatch`/`dispenseItem` (DDI via `drug_interactions`, allergy
via `patient_allergies`, dose-range, drug-disease). The pharmacist's dispense
screen shows *secondary advisory* signals; a gap there degrades the warning UX
but does not open the safety gate.

---

## Findings (this block)

### P1 — fixed
- **False "HIGH-ALERT" on every classified drug** (DispenseMedicationPage). The
  page fetched `/drug-management/classifications` with `{type:'high-alert'}`, an
  ignored param, so it flagged *every* medication as high-alert (alarm fatigue).
  Now uses the dedicated `/classifications/high-alert` endpoint.
- **Backend safety-block reason hidden from the pharmacist.** `onError` showed
  the generic axios "status code 400", so a dispense blocked for
  "ALLERGY (severe): …" surfaced only as "Failed to dispense". Now shows the
  real reason via `getApiErrorMessage` (×3 mutations).
- **Allergy banner read a different source than enforcement.** The red allergy
  banner read the jsonb `patient.allergies` summary column; enforcement reads
  the structured `patient_allergies` table. The banner could be blank while the
  patient genuinely has allergies (false reassurance). Now queries
  `/patients/:id/allergies` (the enforcement source) and merges both.
- **Analytics decimal-as-string.** Sale/item decimals arrive as strings, so the
  sales chart and trend arrows did `0 + "100" → "0100"` → NaN. Number()-coerced.

### Crash-proofed (latent P0) — fixed defensively; full fix flagged
- **DrugInteractionsDatabasePage & AllergyClassesPage** are built on fantasy
  shapes (`drug1Name`/`commonAllergens`/`severity` UPPERCASE… — none exist) and
  white-screen the moment a row exists. Empty on every current tenant, unlinked
  (URL-only). Guarded the reads so they degrade to a blank list. Full fix =
  real columns (`drugAId`/`drugBId`, `className`/`relatedDrugs`), a backend
  drug-name join, DELETE routes, and controlled create forms — a rewrite.

### Flagged — needs backend / a human decision (unapplied)
- **Unbound create/edit forms** on all three drug-management admin pages
  (Classifications, Allergy Classes, Interactions): every field is
  uncontrolled `defaultValue` and Save posts `{}` → 400/no-op. Nothing typed is
  sent. DrugClassifications *display* is correct; only its create/edit is broken.
- **InpatientMedsPage is a mock shell** — Dose Schedule / Medication Orders /
  Controlled tabs are hardcoded `[]` (only Ward Stock is live); the Issue-to-Ward
  modal's qty buttons and submit have no handler. A real
  `GET /pharmacy/controlled/register` exists and is unused.
- **ReturnsPage** reconstructs returns by regex-parsing the stock-movement
  `reason` string (the "notes-as-backend" antipattern); Approve/Reject/Process
  are toast-only dead buttons; refund uses cost not sell price.
- **Controlled-register running balance goes negative** (backend seeds at 0 and
  subtracts each dispense) — it shows net-dispensed, not physical stock. Confirm
  with the client whether a legal register should show physical balance.
- Lower: dispense `?encounter=` param from the queue is never consumed (lands on
  empty search); controlled-register witness/double-check require typing a raw
  UUID (backend identity-guards it, but poor UX); templates "Apply" outside a
  prescribing screen is a no-op; PharmacyStock category filter is a fixed list
  vs free-text item categories; `topMedications` in Analytics is inert
  (`findAllSales` doesn't join items).

### Verified correct (no action)
`/prescriptions/queue` returns a bare array and the backend flattens
`encounter.patient` to a top-level `patient` (no envelope-flatten, no
blank-patient); `getPending` normalizes with `Array.isArray`; controlled
register `{data,total}` → `asList`; DUR summary/patterns/trends/prescriber field
names match the backend projections; `PrescriptionStatus` uses
`partially_dispensed`; DispenseBatchDto/UpdateStatusDto accept every key the
frontend sends; Temperature, Labels, SupplierRankings, DrugDatabaseSync,
NotificationLog, MedicationAdherence, PharmacyDashboard all verified sound.

---

## Element tables & functional map

### PharmacyQueuePage — `/pharmacy/queue` (`pharmacy.update`)
*Functions:* pharmacist worklist. *Processes:* status machine
pending→dispensing→ready→collected via `/prescriptions/:id/status` (dispense
itself happens on the Dispense page); integrations — returned-from-billing
(`/encounters?status=return_to_pharmacy`), return-to-doctor, call-next (shared
`queue` service point `pharmacy` + TTS). *Inputs:* prescription queue, encounter
list. *Outputs:* status transitions, SMS notify, TTS.

| Element | Handler | Effect | State |
|---|---|---|---|
| Billing link · Refresh · Call Next | Link / refetch / callNext+TTS | Nav / reload / announce | 🔎 |
| Status·Priority·Search filters | state | Client filter (In-Progress incl. partially_dispensed) | ✅ |
| Row click / Call / To Doctor | drawer / TTS / return modal | Detail / announce / return | 🔎 |
| Start · Ready&Notify · Collected | updateStatus (+SMS) | Advance status | 🔎 |
| Returned "Dispense" | accept + nav `?encounter=` | Set pending_pharmacy; **param not consumed** | ❌ P2 |
| Return-to-Doctor modal | PATCH /encounters/:id/return-to-doctor | Return encounter | 🔎 |

### DispenseMedicationPage — `/pharmacy/dispense` (`pharmacy.read`)
*Functions:* 5-step wizard search→verify→pick(FEFO)→check→dispense. *Processes:*
POST `/prescriptions/dispense` runs the centralised fail-closed safety gate,
auto-logs controlled substances (witness for Sched I/II), reserves/decrements
stock, derives number/price. *Inputs:* prescription, inventory, batch stock,
high-alert list, structured allergies. *Outputs:* dispensation records,
controlled-log rows, labels, bill items, cashier hand-off.

| Element | Handler | Effect | State |
|---|---|---|---|
| Search / URL `?prescription=` auto-select | query / effect | Load Rx | 🔎 |
| Allergy banner | structured `/patients/:id/allergies` + jsonb | Real allergy warning | ✅ (was ⚠ jsonb-only) |
| HIGH-ALERT badge | `/classifications/high-alert` | High-alert-only flag | ✅ (was ❌ all-drugs) |
| Verify→pick (FEFO auto-allocate) · batch picker (expired/quarantined disabled) | state / batch-stock | Advance / choose batch | 🔎 |
| Pick/Pick All · Edit item · Remove item (confirmDialog) · Print label · OOS/External | mutations / print | Item ops (undispensed only) | 🔎 (edit/remove errors now surfaced) |
| Check/Check All · Counseling · Dispense N | mutations → POST /dispense | Server safety-check; block reason surfaced | 🔎 (was ❌ reason hidden) |
| Success: Cashier / Dispense Next / Dashboard | navigate | Nav | 🔎 |

### ControlledSubstancesRegisterPage — `/pharmacy/controlled-register` (`pharmacy.read`; witness/check `pharmacy.update`)
*Functions:* legal ledger. *Processes:* rows from `controlled_substance_logs`;
witness + double-check are post-dispense maker-checker steps, identity-guarded
server-side (no self-witness, tenant-scoped, active-user). *Outputs:* CSV
export, attestations.

| Element | Handler | Effect | State |
|---|---|---|---|
| Export CSV · Search/Schedule/Date filters | handleExport / state | Download / filter | 🔎 |
| Register rows · "Needs attention" highlight | asList | Sched I/II missing witness→red | 🔎 |
| Witness / Double-Check modals → Confirm | POST /controlled/:id/witness·double-check | Attest (backend blocks self/wrong-tenant) | 🔎 (UUID free-text — P2) |

### PharmacyDashboardPage — `/pharmacy/dashboard` (`pharmacy.read`)
| Element | Handler | State |
|---|---|---|
| 4 KPI cards (30s poll) · stat badges · recent-activity | getKPIs | 🔎 |
| Quick actions (Queue/Alerts/New Sale/DUR) | navigate (all targets exist) | ✅ |

### PharmacyStockPage — `/pharmacy/stock` (`inventory.read`)
| Element | Handler | State |
|---|---|---|
| Search/Category/Section · Low-stock/Expiring toggles | query/client filter | ✅ (category filter misses free-text — P2) |
| Add/Remove stock → Adjust modal Save · View History · Reorder | movements.adjust / query / nav | 🔎 |

### ReturnsPage — `/pharmacy/returns` (`pharmacy.read`)
| Element | Handler | State |
|---|---|---|
| New Return → submit | movements.adjust (reason-string encoded) | ⚠️ notes-as-backend |
| Rows | regex-parsed movements | ⚠️ fragile |
| Approve/Reject/Process | toast only | 💀 dead |
| Return-to-Supplier link · View Details | nav / modal | ✅ |

### InpatientMedsPage — `/pharmacy/inpatient` (`pharmacy.read`)
| Element | Handler | State |
|---|---|---|
| Ward select/search · Ward Stock tab | inventory | ✅ |
| Dose Schedule / Medication Orders / Controlled tabs | hardcoded `[]` | 💀 mock |
| Issue-to-Ward modal (qty ±, submit) | no handler | 💀 |

### PharmacyAnalyticsPage — `/pharmacy/analytics` (`pharmacy.read`)
| Element | Handler | State |
|---|---|---|
| Section/time-range · KPI cards · Sales chart · trend arrows | queries (Number-coerced) | ✅ (was NaN) |
| Revenue-by-category · Top-meds-by-profit · financial tiles | profit/summary | 🔎 (top-meds via profitData; salesHistory.items inert) |

### TemperatureMonitoringPage · LabelManagementPage · SupplierRankingsPage · MedicationAdherencePage · NotificationLogPage · DrugDatabaseSyncPage
All verified sound — correct service shapes, `invalidateQueries`, loading/empty/
error states, valid nav. (Temperature: sensor+alert polls, ack, record-reading.
Labels: template/translation CRUD + generate-by-item. Suppliers: sortable
scorecards. Adherence: per-patient summary + taken/skip. Notifications: filtered
log + resend-failed. Sync: OpenFDA status/logs polls + trigger jobs.)

### DURReportsPage — `/pharmacy/dur-reports`
| Element | Handler | State |
|---|---|---|
| 5 summary cards · date filters · 3 tabs (Prescribing/Therapeutic/Prescriber) | DUR endpoints (real projections) | 🔎 |

### PrescriptionTemplatesPage — `/pharmacy/rx-templates`
| Element | Handler | State |
|---|---|---|
| New/Edit/Delete (confirmDialog, owner-only) · scope/condition filters · items | CRUD mutations | 🔎 |
| Apply (chip/card) | /templates/:id/apply | 🔎 (no insert target outside a prescribing screen — P2) |

### DrugClassificationsPage — `/drug-management/…` (`pharmacy.read/create/update`)
| Element | Handler | State |
|---|---|---|
| List + stats + filters (real columns, lowercase enums) | classifications.list | ✅ display |
| Add/Edit modal Save | `mutate({})` unbound | ❌ no-op/400 |

### DrugInteractionsDatabasePage · AllergyClassesPage — `/drug-management/…` (unlinked)
| Element | Handler | State |
|---|---|---|
| List / stats / severity filter | fantasy fields | ❌ blank (crash-proofed; was white-screen on data) |
| Add / Edit / Delete | unbound `{}` / DELETE(no route) | ❌ 400 / 404 |

### ScanToDispense (component — not routed)
| Element | Handler | State |
|---|---|---|
| Barcode lookup / qty / clear | `/inventory/items` (envelope-normalized) · no checkout | 💀 dead component |

---

*State legend:* ✅ works · 🔎 code-verified only · ❌ broken · 💀 dead/placeholder
· 🔒 UI unguarded vs backend permission · ⚠️ fragile/known limitation.
