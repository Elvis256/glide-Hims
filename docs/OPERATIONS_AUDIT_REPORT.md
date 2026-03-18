# Glide-HIMS Comprehensive Operations Audit

## Pharmacy, Finance, Stores & Supply Chain — Standards Compliance Assessment

> **Audit Date**: March 2026  
> **Scope**: Pharmacy dispensing, financial controls, inventory/stores, procurement, supplier management  
> **Standards Referenced**: WHO GDPI, ISMP, IFRS/IAS, Uganda NDA, Uganda URA, SOX-like controls, GMP  
> **Verdict**: 🔴 **NOT PRODUCTION-READY** — Critical gaps across all domains

---

## Executive Summary

| Domain | Rating | Verdict |
|--------|--------|---------|
| **Pharmacy & Dispensing** | **2.5/10** | 🔴 Critical — Medication safety controls absent |
| **Finance & Billing** | **3.5/10** | 🔴 Critical — No maker-checker, GL overridable, IFRS gaps |
| **Stores & Inventory** | **2.5/10** | 🔴 Critical — Race conditions, no cycle counts, no WMS |
| **Procurement** | **2.5/10** | 🔴 Critical — No segregation of duties, no budget enforcement |
| **Concurrency & Data Integrity** | **3.0/10** | 🔴 Critical — 6 race conditions, 3 without transactions |
| **OVERALL SYSTEM** | **2.8/10** | 🔴 **FAIL — Requires major remediation** |

### What Works Well
- ✅ Multi-tenant isolation architecture (tenantId filtering)
- ✅ Soft-delete infrastructure on all entities
- ✅ Comprehensive entity modeling (132 entities, good coverage)
- ✅ Drug classification system with WHO ATC codes
- ✅ FEFO algorithm exists (as advisory)
- ✅ Chart of accounts with hierarchical structure
- ✅ Stock ledger as immutable audit trail concept
- ✅ Temperature monitoring infrastructure
- ✅ Prescription → Dispensation → ControlledSubstanceLog chain exists

### What Is Critically Missing
- ❌ Segregation of duties (no maker-checker anywhere)
- ❌ Pessimistic locking on stock/GL operations (race conditions)
- ❌ Medication safety checks (5-rights, interactions, allergies)
- ❌ Fiscal period locking
- ❌ Budget enforcement
- ❌ Batch recall workflow
- ❌ Warehouse bin locations
- ❌ Cycle counting
- ❌ URA tax compliance (VAT optional, no EFD)

---

## PART 1: PHARMACY & DISPENSING AUDIT

### 1.1 Medication Safety (ISMP/WHO) — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Barcode verification at dispense | ISMP | ❌ MISSING | `pharmacy.service.ts:89-109` — accepts itemId without scan verification |
| 5-Rights check (patient/drug/dose/route/time) | WHO | ❌ MISSING | `prescriptions.service.ts:308-349` — zero enforcement |
| Tall-man lettering for LASA drugs | ISMP | ❌ MISSING | `lookAlikeSoundAlike` flag stored but never used in labels or UI |
| Double-verification for high-alert meds | ISMP | ❌ MISSING | `highAlert` flag ignored during dispensing; only Schedule I-II trigger logs |
| Drug interaction check before dispense | WHO | ❌ MISSING | `checkInteractions()` exists in drug-management but **never called** from dispensing |
| Allergy cross-reactivity check | ISMP | ❌ MISSING | `checkAllergyRisk()` exists but **never invoked** in dispensing workflow |
| Dose limit validation (maxSingleDose/maxDailyDose) | WHO | ❌ MISSING | Fields exist in `drug-classification.entity.ts:147-151` but never validated |
| Duplicate therapy detection | ISMP | ❌ MISSING | No check for same drug prescribed to same patient |
| Pregnancy category warnings | FDA/WHO | ❌ MISSING | `pregnancyCategory` stored but not enforced |
| Patient counseling acknowledgment | ISMP | ⚠️ OPTIONAL | `counselingProvided` is optional boolean, never required |
| Pharmacist verification before release | ISMP | ❌ MISSING | Any user with `pharmacy.update` can complete sales |

**Critical Finding**: The drug interaction checking system and allergy checking system are **fully built but completely disconnected** from the dispensing workflow. They are orphaned code — never invoked when a pharmacist actually dispenses medication.

### 1.2 Controlled Substance Tracking (DEA/NDA Uganda) — Rating: 3/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Perpetual inventory with running balance | DEA/NDA | ⚠️ PARTIAL | Exists but vulnerable to race condition — concurrent dispenses read same `previousBalance` |
| Witness verification before transfer | DEA | ❌ NOT ENFORCED | `addWitness()` is retroactive — can add witness days later |
| Manual override protection | DEA | ❌ MISSING | Stock adjustments bypass controlled substance logs entirely |
| Destruction records linked to logs | DEA | ❌ MISSING | Disposal tracked separately, no link to `ControlledSubstanceLog` |
| Schedule-based access controls | NDA | ⚠️ PARTIAL | Only Schedule I-II trigger controlled logging; III-V bypass |
| Physical count reconciliation | DEA | ❌ MISSING | No cycle counting for controlled substances |

**Critical Finding**: A pharmacy staff member can manually "adjust" controlled substance stock downward via `inventory.service.ts:198-230` without creating any controlled substance log entry, completely bypassing the chain of custody.

### 1.3 Dispensing Workflow — Rating: 2/10 🔴

**Standard Workflow (ISMP/WHO)**:
```
Rx Entry → Clinical Check → Pharmacist Verify → Pick/Label → 
Final Check → Patient Counsel → Release
```

**Actual Workflow (Current System)**:
```
Rx Entry → Dispense → Done
```

**Missing Steps**:
1. ❌ No clinical screening (interactions, allergies, dose limits)
2. ❌ No pharmacist verification gate
3. ❌ No pick confirmation against FEFO
4. ❌ No independent final check
5. ❌ No mandatory patient counseling
6. ❌ No release confirmation

### 1.4 Stock Management in Pharmacy — Rating: 4/10 🟠

| Control | Status | Detail |
|---------|--------|--------|
| Negative stock prevention | ❌ RACE CONDITION | `pharmacy.service.ts:192-210` — findOne without lock; concurrent sales can overdraw |
| Stock adjustment approval | ❌ NOT GATED | Any user with `inventory.update` can adjust freely |
| Batch recall support | ❌ MISSING | No mechanism to flag/isolate recalled batches |
| FEFO enforcement | ⚠️ ADVISORY ONLY | FEFO allocation is a preview; dispenser can ignore and pick any batch |
| Expiry block on dispense | ❌ MISSING | Expired items can still be dispensed — no validation |

### 1.5 Temperature Monitoring — Rating: 3/10 🔴

| Control | Status | Gap |
|---------|--------|-----|
| Excursion → affected batches link | ❌ MISSING | `temperature_logs` has no batch/item reference |
| Automated alert escalation | ❌ MISSING | Alerts sit passively; no email/SMS/escalation |
| Continuous monitoring enforcement | ❌ MISSING | No alert when sensor goes offline |
| Remediation documentation | ❌ MISSING | Alert acknowledgment has no action/evidence fields |

### 1.6 Drug Labels — Rating: 6/10 🟡

| Control | Status | Detail |
|---------|--------|--------|
| Multi-language support | ✅ YES | English + Luganda with translation system |
| LASA tall-man lettering | ❌ MISSING | Flag exists, not used in labels |
| Auxiliary warnings | ⚠️ PARTIAL | Basic label data; no pictograms or warning icons |
| Template system | ✅ YES | Customizable templates per language |

---

## PART 2: FINANCE & BILLING AUDIT

### 2.1 Double-Entry Integrity (IFRS) — Rating: 6/10 🟡

| Control | Status | Detail |
|---------|--------|--------|
| Balanced debit/credit entries | ✅ YES | Each transaction creates matching DR/CR |
| Pre-posting balance validation | ⚠️ WEAK | Basic check exists but rounding errors possible |
| GL balance real-time update | ✅ YES | `ChartOfAccount.currentBalance` updated on every post |
| GL balance can be manually overridden | ❌ VULNERABILITY | `currentBalance` is a writable field — no protection |

### 2.2 Fiscal Period Controls — Rating: 3/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Period-end close procedure | IFRS | ⚠️ EXISTS | `FiscalPeriod` entity with OPEN/CLOSED status |
| Entries blocked in closed periods | IFRS | ❌ NOT ENFORCED | `finance.service.ts:165-207` — no period status check before posting |
| Adjusting entries in closed period | IFRS | ❌ MISSING | No adjusting entry type that bypasses period lock |
| Year-end closing procedure | IFRS | ❌ MISSING | No retained earnings calculation or closing entries |

### 2.3 Separation of Duties (SOX-like) — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Maker-checker on journal entries | SOX | ❌ MISSING | Single user creates AND posts journal entries |
| Invoice creator ≠ approver | SOX | ❌ NOT ENFORCED | No validation that `createdBy ≠ approvedBy` |
| Payment authorization | SOX | ❌ MISSING | Any user with `billing.create` records payments |
| GL access controls | SOX | ❌ WEAK | No segregation between entry creation and posting |
| Authorization matrix | SOX | ❌ MISSING | No monetary thresholds for approval levels |

**Critical Finding**: A single user can create a fake invoice, post the GL entry, and record a payment — completely undetected. There is no four-eyes principle anywhere in the financial workflow.

### 2.4 Revenue Recognition — Rating: 3/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Revenue timing | IFRS 15 | ❌ NON-COMPLIANT | Revenue recognized at invoice creation, not performance obligation |
| Deferred revenue | IFRS 15 | ❌ MISSING | No deferred revenue account or mechanism |
| Accruals support | IFRS | ❌ MISSING | No accrual entries or reversal mechanism |
| Revenue by performance obligation | IFRS 15 | ❌ MISSING | All revenue posted immediately |

### 2.5 Tax Compliance (Uganda URA) — Rating: 2/10 🔴

| Control | Requirement | Status | Gap |
|---------|-------------|--------|-----|
| VAT calculation (18%) | URA | ❌ OPTIONAL | `billing.service.ts:93-95` — tax is optional, should be mandatory |
| Withholding tax | URA | ❌ MISSING | No auto-calculation on supplier payments |
| EFD (Electronic Fiscal Device) integration | URA | ❌ MISSING | No fiscal receipt generation |
| TIN validation | URA | ❌ MISSING | No validation of supplier/patient TIN format |
| Statutory report format | URA | ❌ NON-STANDARD | Reports exist but not in URA-required format |

### 2.6 Invoice & Payment Controls — Rating: 4/10 🟠

| Control | Status | Gap |
|---------|--------|-----|
| Sequential invoice numbering | ⚠️ RACE CONDITION | `INV{YYYYMMDD}{seq}` — concurrent creation can produce duplicates |
| Invoice voiding (not deletion) | ✅ YES | Cancellation supported with status change |
| GL reversal on cancellation | ❌ MISSING | Invoice cancelled but revenue stays on books |
| Pessimistic lock on payments | ✅ YES | `billing.service.ts:272` uses pessimistic_write ✓ |
| Duplicate payment prevention | ❌ WEAK | No UNIQUE constraint on `transactionReference` |
| Overpayment handling | ❌ MISSING | No change calculation or credit balance |
| Credit notes linked to invoice | ⚠️ PARTIAL | Credit notes exist but loosely linked |

### 2.7 Insurance Claims — Rating: 4/10 🟠

| Control | Status | Gap |
|---------|--------|-----|
| Pre-auth limit enforcement at billing | ❌ NOT ENFORCED | Invoice can exceed pre-auth amount |
| Policy limit validation | ❌ MISSING | No check against annual/per-visit limits |
| Co-payment auto-calculation | ❌ MISSING | Must be manually entered |
| Claim amount validation | ⚠️ PARTIAL | Basic validation, no cross-check against schedule |

### 2.8 Financial Reporting — Rating: 5/10 🟠

| Report | Status | Gap |
|--------|--------|-----|
| Trial Balance | ✅ EXISTS | Queries `currentBalance` directly |
| Income Statement | ✅ EXISTS | Revenue - Expenses |
| Balance Sheet | ✅ EXISTS | Assets = Liabilities + Equity |
| Cash Flow | ✅ EXISTS | Operating, Investing, Financing |
| AR Aging | ✅ EXISTS | Current through 90+ days |
| Bank Reconciliation | ❌ MISSING | No bank statement import or matching |
| Inter-facility reconciliation | ❌ MISSING | No elimination entries for consolidated reporting |
| Multi-currency | ❌ MISSING | Single currency only |

---

## PART 3: STORES & INVENTORY AUDIT

### 3.1 Stock Accuracy — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Cycle counting | WHO/GDPI | ❌ MISSING | No cycle count entity, workflow, or variance reporting |
| Physical count reconciliation | GDPI | ❌ MISSING | No count sheets, no variance investigation |
| Negative stock prevention | GMP | ❌ RACE CONDITION | Concurrent operations can produce negative balances |
| Adjustment approval gate | SOX | ❌ MISSING | Any `inventory.update` user can adjust freely |
| Adjustment reason validation | GDPI | ❌ WEAK | Free-text reason; no predefined codes or approval |
| Perpetual inventory verification | GDPI | ⚠️ PARTIAL | Perpetual only; no periodic verification against physical |

### 3.2 Batch/Lot Traceability — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| GRN → Stock → Dispense → Patient trace | GMP | ❌ BROKEN | No end-to-end batch trace through all modules |
| Batch recall workflow | GMP | ❌ MISSING | No recall entity, no affected-patient identification |
| Batch isolation/quarantine | GMP | ⚠️ PARTIAL | ExpiryAlert supports quarantine; no recall quarantine |
| Lot tracking for lab reagents | GMP | ✅ YES | `ReagentLot` with consumption tracking |

### 3.3 Inventory Valuation — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Costing method (FIFO/LIFO/WAC) | IFRS/IAS 2 | ❌ MISSING | No standardized costing method; `unitCost` overwritten on each GRN |
| Revaluation adjustments | IAS 2 | ❌ MISSING | No revaluation entries when costs change |
| COGS calculation | IAS 2 | ❌ MISSING | No systematic COGS tracking |
| Consistent cross-module costing | IAS 2 | ❌ INCONSISTENT | Disposal uses `unitValue`, procurement uses `unitCost`, returns use `unitValue` |

### 3.4 Warehouse Management — Rating: 1/10 🔴

| Feature | Status |
|---------|--------|
| Bin/shelf/rack locations | ❌ MISSING |
| Put-away logic | ❌ MISSING |
| Pick list generation | ❌ MISSING |
| Goods-in staging area | ❌ MISSING |
| Storage condition validation | ❌ MISSING — field exists, not enforced |
| Barcode/RFID scanning | ❌ MISSING |

### 3.5 Transfer Controls — Rating: 4/10 🟠

| Control | Status | Gap |
|---------|--------|-----|
| Approval before dispatch | ⚠️ EXISTS | But no transaction protection — race condition |
| Goods-in-transit accounting | ❌ MISSING | No GIT account; source debited and destination credited simultaneously |
| Dispatch ≠ Receive verification | ⚠️ PARTIAL | `quantityDispatched` vs `quantityReceived` fields exist but no variance report |
| Cross-facility balance integrity | ❌ VULNERABLE | Transfer operations not atomic; partial failure possible |

### 3.6 Expiry Management — Rating: 3/10 🔴

| Control | Status | Gap |
|---------|--------|-----|
| FEFO enforcement at dispense | ❌ NOT ENFORCED | Advisory only; pharmacist can ignore |
| Auto-quarantine near-expiry | ❌ MISSING | Manual quarantine only |
| Expired stock block on dispense | ❌ MISSING | No validation preventing expired stock from being sold |
| Return-before-expiry workflow | ❌ MISSING | No auto-flagging for supplier return opportunity |

---

## PART 4: PROCUREMENT AUDIT

### 4.1 Segregation of Duties — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Requester ≠ Approver | GDPI | ❌ NOT ENFORCED | `procurement.service.ts:170-197` — no check that `requestedById ≠ approverId` |
| PO Creator ≠ PO Approver | GDPI | ❌ NOT ENFORCED | Same user can create and approve PO |
| GRN Receiver ≠ PO Creator | GDPI | ❌ NOT ENFORCED | No cross-validation |
| Spending limit thresholds | GDPI | ❌ MISSING | No monetary approval tiers |
| Supplier status validation | GDPI | ❌ MISSING | POs can be created for suspended/inactive suppliers |

### 4.2 RFQ Process — Rating: 2/10 🔴

| Control | Standard | Status | Gap |
|---------|----------|--------|-----|
| Minimum 3 quotations | GDPI | ❌ NOT ENFORCED | `rfq.service.ts:138` — allows sending to 1 vendor |
| Sealed bid evaluation | GDPI | ❌ MISSING | All quotations visible with supplier names |
| Bid evaluation matrix | GDPI | ❌ MISSING | Selection based on `totalAmount ASC` only — price-only |
| Minimum response threshold | GDPI | ❌ MISSING | Can close RFQ with 1 response |

### 4.3 Goods Receipt — Rating: 3/10 🔴

| Control | Status | Gap |
|---------|--------|-----|
| Mandatory inspection | ❌ NOT ENFORCED | Can skip inspection: DRAFT → APPROVED directly |
| QA quarantine hold | ❌ MISSING | No quarantine status before stock posting |
| Short/overshipment handling | ❌ MISSING | No variance alerts or back-order creation |
| GRN posting atomicity | ❌ NO TRANSACTION | `postGoodsReceipt()` lacks `dataSource.transaction()` — partial posting possible |
| 3-way match integration | ❌ NOT INTEGRATED | Match module exists separately, not enforced before GRN approval |

### 4.4 Disposal Compliance (NDA Uganda) — Rating: 3/10 🔴

| Control | NDA Requirement | Status | Gap |
|---------|-----------------|--------|-----|
| Two-witness verification | MANDATORY | ❌ SINGLE WITNESS | `disposal.entity.ts:61` — one `witness` string field |
| Destruction committee | MANDATORY | ❌ MISSING | No committee entity/workflow |
| Disposal certificate mandatory | MANDATORY | ❌ OPTIONAL | `certificateNumber` is nullable |
| Licensed disposal contractor | MANDATORY | ❌ NOT TRACKED | No contractor entity or license verification |
| Controlled substance destruction link | NDA | ❌ MISSING | Disposal not linked to controlled substance logs |

### 4.5 Supplier Returns — Rating: 4/10 🟠

| Control | Status | Gap |
|---------|--------|-----|
| Return authorization workflow | ✅ EXISTS | PENDING → AUTHORIZED → SHIPPED → COMPLETED |
| Stock deduction on authorize | ✅ YES | Deducted at authorization step |
| Credit note tracking | ✅ YES | Expected vs actual credit tracked |
| Auto-trigger on near-expiry | ❌ MISSING | No integration with expiry management |
| Return linked to original GRN | ❌ MISSING | No traceability to original receipt |

---

## PART 5: CONCURRENCY & DATA INTEGRITY AUDIT

### 5.1 Critical Race Conditions — Rating: 3/10 🔴

| # | Module | Issue | Severity | Transaction? | Locking? |
|---|--------|-------|----------|--------------|----------|
| 1 | **Inventory** `deductStock()` | findOne→check→save without lock | 🔴 CRITICAL | ❌ NO | ❌ NO |
| 2 | **Pharmacy** `completeSale()` | Transaction but no pessimistic lock on StockBalance | 🔴 HIGH | ✅ YES | ❌ NO |
| 3 | **Procurement** `postGoodsReceipt()` | Multi-step save without transaction | 🔴 CRITICAL | ❌ NO | ❌ NO |
| 4 | **Finance** `postJournalEntry()` | GL balance update without lock | 🔴 HIGH | ❌ NO | ❌ NO |
| 5 | **Stores** `approveTransfer()` | Stock deduction without transaction | 🔴 HIGH | ❌ NO | ❌ NO |
| 6 | **Billing** `recordPayment()` | No UNIQUE on transactionReference | 🟠 MEDIUM | ✅ YES | ✅ YES |

**Only one module (Prescriptions `dispenseBatch`) properly uses pessimistic locking.**

### 5.2 Data Integrity Risks

| Risk | Impact | Location |
|------|--------|----------|
| Double GRN posting | Duplicate stock entries, inflated inventory | `procurement.service.ts:610-700` |
| Double sale completion | Negative stock, phantom revenue | `pharmacy.service.ts:172-250` |
| GL balance corruption | Trial balance won't balance | `finance.service.ts:301-331` |
| Transfer double-approval | Stock deducted twice from source | `stores.service.ts:147-207` |
| Controlled substance log gap | Running balance desynchronized | `prescriptions.service.ts:566-575` |

### 5.3 Positive Findings

| Module | Good Practice |
|--------|---------------|
| Prescriptions `dispenseBatch()` | ✅ Uses pessimistic_write lock on StockBalance |
| Billing `recordPayment()` | ✅ Uses pessimistic_write lock on Invoice |
| Inventory `receiveStock()` | ✅ Uses `dataSource.transaction()` |
| Inventory `transferStock()` | ✅ Uses `dataSource.transaction()` |
| All raw SQL | ✅ Parameterized queries ($1, $2) — no injection |
| All endpoints | ✅ Protected with `@AuthWithPermissions()` |

---

## PART 6: SCORECARD & RECOMMENDATIONS

### Overall Ratings by Standard

| Standard/Framework | Compliance | Rating |
|-------------------|------------|--------|
| WHO GDPI (Good Distribution Practice) | 15% | 1.5/10 |
| ISMP Medication Safety | 10% | 1.0/10 |
| IFRS/IAS Financial Reporting | 30% | 3.0/10 |
| Uganda NDA Pharmaceutical | 20% | 2.0/10 |
| Uganda URA Tax Compliance | 15% | 1.5/10 |
| SOX-like Internal Controls | 15% | 1.5/10 |
| GMP Traceability | 20% | 2.0/10 |
| Data Integrity (ACID) | 35% | 3.5/10 |

### Priority Remediation Roadmap

#### 🔴 Phase 1: CRITICAL (Must fix before any production use)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | **Add pessimistic locking** to inventory.deductStock, pharmacy.completeSale, procurement.postGoodsReceipt, finance.postJournalEntry, stores.approveTransfer | 2 weeks | Prevents all race conditions |
| 2 | **Wrap GRN posting and transfer operations in transactions** | 1 week | Prevents partial state corruption |
| 3 | **Enforce segregation of duties** — requester ≠ approver on PR, PO, GRN, journal entries | 2 weeks | Prevents internal fraud |
| 4 | **Block posting to closed fiscal periods** | 3 days | Financial integrity |
| 5 | **Make GL currentBalance computed/immutable** (or add version check) | 1 week | Prevents balance tampering |
| 6 | **Add GL reversal on invoice cancellation** | 1 week | Correct financial statements |
| 7 | **Wire drug interaction + allergy checks into dispensing** | 2 weeks | Patient safety |

#### 🟠 Phase 2: HIGH PRIORITY (Fix within 3 months)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 8 | Enforce FEFO at dispensing (validate batch is next-to-expire) | 1 week | Reduce expired stock |
| 9 | Make VAT mandatory (18% URA) with configurable exemptions | 1 week | Tax compliance |
| 10 | Add maker-checker workflow for journal entries | 2 weeks | Financial controls |
| 11 | Enforce minimum 3 quotations on RFQ | 2 days | Procurement compliance |
| 12 | Block POs to suspended/inactive suppliers | 2 days | Supplier governance |
| 13 | Add batch recall workflow (flag batch → find affected patients) | 2 weeks | GMP traceability |
| 14 | Add cycle counting module | 2 weeks | Stock accuracy |
| 15 | Implement 2-witness disposal with mandatory certificate | 1 week | NDA compliance |
| 16 | Block dispensing of expired stock | 3 days | Patient safety |
| 17 | Enforce dose limit validation against maxSingleDose/maxDailyDose | 1 week | Medication safety |
| 18 | Add spending threshold approvals (monetary tiers) | 2 weeks | Financial governance |

#### 🟡 Phase 3: IMPORTANT (Fix within 6 months)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 19 | Implement FIFO/weighted average costing method | 3 weeks | IAS 2 compliance |
| 20 | Add warehouse bin/shelf location tracking | 3 weeks | Warehouse efficiency |
| 21 | Add bank reconciliation module | 2 weeks | Cash management |
| 22 | Implement EFD (Electronic Fiscal Device) integration | 4 weeks | URA compliance |
| 23 | Add temperature excursion → batch linkage | 1 week | Cold chain management |
| 24 | Implement barcode scanning at dispensing | 3 weeks | Medication safety |
| 25 | Add ABC/XYZ analysis and dead stock reports | 2 weeks | Inventory optimization |
| 26 | Add bid evaluation matrix (weighted scoring) | 2 weeks | Fair procurement |
| 27 | Link disposal records to controlled substance logs | 1 week | DEA/NDA compliance |
| 28 | Add pharmacist verification gate before release | 1 week | Dispensing safety |

---

## Detailed Module Scorecards

### Pharmacy Module Scorecard

| Capability | Score | Notes |
|------------|-------|-------|
| POS sales (OTC/Rx) | 7/10 | Good multi-type sale support |
| FEFO algorithm | 5/10 | Exists as advisory; not enforced |
| Expiry management | 4/10 | Manual quarantine only |
| Drug labels | 6/10 | Multi-language; missing LASA formatting |
| Temperature monitoring | 3/10 | Infrastructure exists; no batch linkage or escalation |
| Controlled substances | 3/10 | Log exists; witness optional, adjustments bypass |
| Clinical safety checks | 1/10 | Built but not wired into workflow |
| Dispensing workflow | 2/10 | Missing 5 of 7 standard steps |
| **AVERAGE** | **3.1/10** | |

### Finance Module Scorecard

| Capability | Score | Notes |
|------------|-------|-------|
| Double-entry posting | 6/10 | Works; rounding edge cases |
| Chart of accounts | 7/10 | Hierarchical, auto-updated |
| Financial reports | 5/10 | 8 reports; no bank reconciliation |
| Invoice lifecycle | 4/10 | Race condition on numbering; no GL reversal on cancel |
| Payment processing | 5/10 | Pessimistic lock ✓; no duplicate reference prevention |
| Fiscal periods | 3/10 | Entity exists; not enforced |
| Separation of duties | 2/10 | No maker-checker anywhere |
| Tax compliance | 2/10 | VAT optional; no EFD; no withholding tax |
| Insurance claims | 4/10 | Workflow exists; pre-auth not enforced |
| Pricing engine | 6/10 | Multi-layered discounts; good design |
| Supplier finance | 5/10 | 3-way match exists; not integrated |
| **AVERAGE** | **4.1/10** | |

### Stores & Procurement Scorecard

| Capability | Score | Notes |
|------------|-------|-------|
| Purchase requests | 4/10 | Exists; no segregation enforcement |
| Purchase orders | 4/10 | Exists; no budget limits, no supplier validation |
| RFQ process | 2/10 | No min quotations, no evaluation matrix |
| Goods receipt | 3/10 | No mandatory QA; no transaction on posting |
| Stock transfers | 4/10 | Workflow exists; no GIT accounting, no atomicity |
| Supplier management | 3/10 | Basic CRUD; no blacklist enforcement |
| Vendor contracts | 5/10 | Good lifecycle; amendments tracked |
| Vendor ratings | 5/10 | 4-dimension; auto-summary |
| Price agreements | 5/10 | Volume discounts; best-price API |
| Disposal | 3/10 | Exists; NDA non-compliant |
| Returns | 4/10 | Good workflow; no expiry auto-trigger |
| Cycle counting | 0/10 | Completely missing |
| Warehouse (WMS) | 0/10 | Completely missing |
| **AVERAGE** | **3.2/10** | |

---

## Conclusion

The Glide-HIMS system has **comprehensive entity coverage** (132 entities, 67 modules) and demonstrates strong architectural foundations (multi-tenant, soft-delete, audit trails). However, it suffers from **critical operational control gaps**:

1. **Safety-critical code exists but is disconnected** — drug interactions, allergies, dose limits are built but never invoked during dispensing
2. **No four-eyes principle anywhere** — single users can create, approve, and execute financial transactions
3. **6 race conditions** in stock/financial operations — concurrent operations can corrupt data
4. **Regulatory non-compliance** — Uganda NDA disposal requirements and URA tax requirements not met

**The system is suitable for DEMO/DEV use only.** Production deployment requires the Phase 1 fixes (estimated 8-10 weeks of development) at minimum, with Phase 2 (3 months) needed for regulatory compliance.

---

*This audit was performed through static code analysis of 3,600+ lines across 14+ backend modules. A dynamic penetration test and load test are recommended before production deployment.*
