# CRITICAL AUDIT FINDINGS - CODE LOCATIONS

## File Index & Critical Issues

### 1. billing.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/billing/billing.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 31-53 | **Race condition in invoice number generation** - Two simultaneous requests get same number | CRITICAL | Invoice Controls |
| 93-95 | **VAT optional** - Not enforced, should be mandatory | CRITICAL | Tax Compliance |
| 118-129 | **Revenue recognized at invoice** - Should be at payment (IFRS violation) | CRITICAL | Revenue Recognition |
| 228-230 | **Can add items to partially paid invoice** - Recalculates GL incorrectly | HIGH | Invoice Controls |
| 266-380 | **Payment recording** - Receipt number generation unprotected (race condition) | HIGH | Payment Controls |
| 429-465 | **Void payment** - No GL reversal posted | HIGH | Payment Controls |
| 532-554 | **Cancel invoice** - No GL reversal, leaves revenue on books | CRITICAL | Invoice Controls |
| 556-574 | **Refund invoice** - No GL entry for refund liability | HIGH | Invoice Controls |

### 2. finance.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/finance/finance.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 165-178 | **closePeriod()** - Only sets flag, doesn't lock posting | CRITICAL | Fiscal Period Controls |
| 193-194 | **getFiscalPeriodForDate()** - Bug: LessThanOrEqual for both start AND end | CRITICAL | Fiscal Period Controls |
| 201-207 | **Fiscal period check** - No trial balance verification before close | CRITICAL | Reconciliation |
| 214 | **Balance validation** - Only 0.01 tolerance, rounding issue | MEDIUM | Double-Entry Integrity |
| 308-324 | **postJournalEntry()** - Direct GL balance update, no audit trail | CRITICAL | Audit Trail |
| 301-331 | **Posted entries not immutable** - Can be updated after posting | CRITICAL | Audit Trail |
| 561-602 | **autoPostInvoiceJournal()** - Revenue category hardcoded, not configurable | HIGH | Revenue Recognition |
| 605-645 | **autoPostPatientPaymentJournal()** - No GL reversal on payment void | HIGH | Payment Controls |
| 751-804 | **AR Aging Report** - No subledger reconciliation to GL | HIGH | Reconciliation |
| 928-965 | **SQL injection in getStatutoryReport()** - String interpolation in query | CRITICAL | Tax Compliance |

### 3. finance.controller.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/finance/finance.controller.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 123-128 | **createJournalEntry()** - No maker-checker, same user creates & can post | CRITICAL | Separation of Duties |
| 154-159 | **postJournalEntry()** - Single approval step, no second review | CRITICAL | Separation of Duties |
| 482-495 | **getStatutoryReport()** - VAT report format not URA-compliant | CRITICAL | Tax Compliance |

### 4. billing.controller.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/billing/billing.controller.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 23-28 | **createInvoice()** - User can create | MEDIUM | Separation of Duties |
| 69-78 | **cancelInvoice()** - Same user can cancel (should need approval) | HIGH | Separation of Duties |
| 80-89 | **refundInvoice()** - Same user can refund (should need approval) | HIGH | Separation of Duties |
| 117-122 | **recordPayment()** - No approval step, posts immediately | CRITICAL | Separation of Duties |
| 124-133 | **voidPayment()** - No approval, immediate void | HIGH | Separation of Duties |

### 5. insurance.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/insurance/insurance.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 208-247 | **createClaim()** - No pre-auth limit validation, no policy limit check | CRITICAL | Insurance Claims |
| 249-272 | **addClaimItem()** - No validation that amount is reasonable | HIGH | Insurance Claims |
| 338-371 | **processClaim()** - No reconciliation to invoice | HIGH | Insurance Claims |
| 373-391 | **recordPayment()** - No GL entry, claim paid but invoice not updated | CRITICAL | Insurance Claims |

### 6. supplier-finance.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/supplier-finance/supplier-finance.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 54, 73-74 | **Withholding tax optional** - Should be mandatory 6% | CRITICAL | Tax Compliance |
| 187-192 | **Can modify cheque details after approval** - Control weakness | MEDIUM | Separation of Duties |

### 7. pricing-engine.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/pricing-engine/pricing-engine.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 55-210 | **resolvePrice()** - No pre-auth enforcement, no co-payment calculation | HIGH | Insurance Claims |

### 8. budget.service.ts
**Location**: `/root/glide-Hims/packages/backend/src/modules/finance/budget.service.ts`

| Line(s) | Issue | Severity | Area |
|---------|-------|----------|------|
| 1-100+ | **Entire file** - No budget enforcement in PO/GRN creation | CRITICAL | Budgeting |
| Missing | **No method to check if spending exceeds budget** | CRITICAL | Budgeting |

---

## Database Entity Issues

### chart-of-account.entity.ts
| Issue | Severity | Impact |
|-------|----------|--------|
| `currentBalance` stored directly (not calculated) | CRITICAL | GL can be overridden, balance not verified |
| No `isLocked` flag for immutability | CRITICAL | Posted entries can be modified |

### invoice.entity.ts
| Issue | Severity | Impact |
|-------|----------|--------|
| `invoiceNumber` unique but resets daily | HIGH | Not audit-friendly, gaps in sequence |
| No `gl_reversal_entry_id` link to reversal entry | HIGH | Can't audit GL impact of cancellation |
| No `approved_by_id` for cancellation/refund | CRITICAL | No approval trail |

### journal-entry.entity.ts
| Issue | Severity | Impact |
|-------|----------|--------|
| No `isLocked` flag | CRITICAL | Posted entries not immutable |
| `status` is POSTED but can still be updated | CRITICAL | Reversibility without audit |

### finance-extended.entity.ts
| Line(s) | Issue | Severity |
|---------|-------|----------|
| 59-122 | `BudgetLine.actualAmount` never updated | CRITICAL |
| 220-257 | `PatientCreditNote` - No GL reversal tracking | HIGH |
| 532-566 | `InterFacilityTransaction` - No reconciliation logic | MEDIUM |

---

## Critical Missing Controls

| Control | Location | Why Missing | Impact |
|---------|----------|------------|--------|
| **Maker-Checker** | finance.controller.ts, billing.controller.ts | Not implemented | Fraud enablement |
| **Budget Enforcement** | NO SERVICE exists | Not implemented | Uncontrolled spending |
| **Pre-Auth Validation** | billing.service.ts | Not checked on invoice | Claim denials |
| **GL Reversal** | billing.service.ts | Not posted on cancel | Financial statements wrong |
| **Fiscal Period Lock** | finance.service.ts | Just a flag | Entries post to closed periods |
| **Co-Payment Calc** | NO SERVICE exists | Not implemented | Insurance billing broken |
| **VAT Auto-Apply** | billing.service.ts | Optional field | URA non-compliant |
| **Withholding Tax** | supplier-finance.service.ts | Optional, manual | URA non-compliant |
| **Journal Immutability** | finance.service.ts | No lock flag | Fraud possible |
| **GL Audit Trail** | finance.service.ts | Updates silent | GL override undetected |
| **Subledger Reconciliation** | NO SERVICE exists | Not implemented | GL ≠ subledgers possible |
| **Period-End Checklist** | NO SERVICE exists | Not implemented | Close without validation |

---

## Quick Fix Priority

### 🔴 MUST FIX (This Week) - Blockers
1. **Line**: billing.service.ts:532-554 | **Fix**: Add GL reversal on cancel
2. **Line**: finance.service.ts:165-178 | **Fix**: Lock closed periods
3. **Line**: finance.controller.ts:123-159 | **Fix**: Implement maker-checker
4. **Line**: budget.service.ts | **Fix**: Add enforcement checks

### 🟠 SHOULD FIX (This Month) - Critical
5. **Line**: billing.service.ts:31-53 | **Fix**: Pessimistic locking on invoice numbers
6. **Line**: billing.service.ts:93-95 | **Fix**: Make VAT mandatory
7. **Line**: finance.service.ts:308-324 | **Fix**: Make GL balance immutable
8. **Line**: insurance.service.ts:208-247 | **Fix**: Validate pre-auth limits

### 🟡 SHOULD PLAN (Next Month) - Important
9. **Line**: billing.service.ts:118-129 | **Fix**: Revenue on payment, not invoice
10. **Line**: finance.service.ts:751-804 | **Fix**: Reconcile subledgers
11. **Line**: supplier-finance.service.ts:73 | **Fix**: Mandatory withholding
12. **Line**: Missing | **Fix**: Tax compliance (URA integration)

---

## Testing Recommendations

### High-Risk Areas to Test
1. **Concurrent invoicing** - Multiple simultaneous invoice creations (check for duplicates)
2. **Maker-checker workflow** - Verify entry can't be posted by creator
3. **Budget overspending** - Create PO exceeding budget (should reject)
4. **GL reversals** - Cancel invoice and verify GL reversal posted
5. **Closed period posting** - Try to post to closed period (should reject)
6. **GL manual override** - Attempt to update GL balance directly (should fail)

