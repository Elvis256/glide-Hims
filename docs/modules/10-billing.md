# Module 10 — Billing & Insurance

Reviewed 2026-07-19 (frontend review Block 10 — the largest block: cashier,
invoices, payments, refunds, OPD billing, packages, doctor fees, and the full
insurance desk). Key flows E2E-verified live on tesy (API + browser).

## Overview

Revenue flows:

```
NEW BILL (OPD, server-priced preview w/ tax·discount·insurance contract prices)
  → INVOICE (per-tenant numbers INV…; statuses draft/pending/partially_paid/
     paid/cancelled/refunded/written_off; 18% default tax)
  → CASHIER (POS: worklist of unpaid, item edit, insurance-aware due,
     cash change, receipts RCP…; return patient to doctor/pharmacy/lab)
  → PAYMENTS ledger (all methods; receipts; void w/ reason)
  → REFUNDS (full-invoice, reason required, segregation of duties: creator
     cannot refund own invoice)

INSURANCE DESK
  provider → policy (member no., limits, copay) → VERIFY coverage
  → PRE-AUTH (auth type, diagnosis, justification → PA… numbers)
  → CLAIMS: draft (from encounter or manual) → items → submit → approve/
     reject (segregation: submitter cannot process) → payment; claim PDF,
     payer batch CSV; denial/status reports
```

## Sidebar (was broken, now real)
Every "Reception Billing" and "Insurance Desk" link previously **404'd** —
pages existed but were never routed. Now: New Bill → `/billing/opd/new`,
Collect Payment → `/cashier`, Print Receipt → `/billing/payments`, Pending
Payments → `/billing/invoices`, Refunds → `/billing/reception/refunds` (new
route), Verify Coverage → `/insurance/verify`, Pre-Auth → `/insurance/preauth`,
Insurance Cards → `/insurance/cards` (all newly routed), Claim Submission &
Claims → `/billing/insurance/claims`, Providers → `/billing/insurance/providers`.
Deleted as redundant: NewBillPage (inferior duplicate of NewOPDBillPage),
ClaimSubmissionPage (subset of ClaimsPage).

## Page status after this block

| Page | Verdict |
|---|---|
| CashierPage (`/cashier`) | ✅ Excellent (rebuilt POS). Live E2E: pay 354,000 cash → receipt RCP202607190001 on screen. No changes needed. |
| InvoicesPage | ✅ Fixed: "Partial" filter sent invalid enum (silent empty list) → `partially_paid`; printed invoices hardcoded Tax/Discount `UGX 0` while totals include 18% tax (**every printed invoice was internally inconsistent**) → real amounts; cancel gated on 3-char reason; dead bulk Send-Reminders/Export removed. |
| PaymentsPage | ✅ Fixed: **every non-cash payment 400'd** — the client dropped the typed reference (key mismatch `referenceNumber` vs `reference`); "Clear filters" sent empty dates → whole list 400'd silently; void had no error feedback; refs now display from real `transactionReference`. |
| PatientTabPage | ✅ Clean as found. |
| RefundsPage (new route) | ✅ Rebuilt honest: removed fake "amount" field (endpoint refunds the full invoice), fake approval-workflow fiction, hardcoded stats; searches paid invoices by number/name; server errors surfaced. Backend refund itself 500'd (see below). |
| VerifyCoveragePage (new route) | ✅ Fixed first-click-always-fails race; policy picker added; live UI E2E: verified Jubilee policy, limit 5,000,000 / copay 10% shown on first click. |
| PreAuthorizationPage (new route) | ✅ Form rebuilt to the real DTO (**every submit 400'd before** — payload had 3 forbidden fields and lacked 5 required ones); list showed blank auth numbers/fields (fantasy names) and "Approved: UGX 0.00" on pending rows (decimal-string truthiness). Live: PA2026070001 renders. |
| InsuranceCardsPage (new route) | ✅ Register rebuilt (**always 400 before**: startDate/endDate/principalName forbidden, effectiveDate/expiryDate missing, memberNumber required); raw-UUID Patient/Provider inputs → patient search + provider dropdown; fake Dependents/View/Update removed. |
| InsurancePage (`/insurance` hub) | ✅ 9 nav buttons 404'd → repointed; policies/claims/pre-auth tabs rendered fantasy fields (every policy "Unlimited", every claim UGX 0, blank auth numbers) → real entity fields. |
| ClaimsPage | ✅ Worst page fixed: manual New Claim **always 400** (wrong DTO) → real draft-claim form; Reject **always 400** (wrong shape) → ProcessClaimDto; Resubmit removed (backend allows submit from draft only); **patient column showed the insurer's name** → real patient+MRN; all amounts showed 0 (`totalClaimed` mapping); provider filter sent the NAME as a uuid (500 → empty list, and killed the payer batch CSV) → id-valued options; `in_review` enum; fabricated status-history timestamps and decorative upload dropzone removed; facility race on hard refresh fixed (reactive hook + query gate). Live: 6 claims with real names/amounts. |
| ProvidersPage | ✅ onError toasts added; payment-terms readback fixed (`paymentTermsDays`); phantom notes/isActive controls removed (no backend fields). |
| NewOPDBillPage | ✅ Best billing page. Fixed: dead back arrow; fake "Save Draft" (wrote localStorage nothing reads) removed; invented default copay 20% → 0. |
| OPDOrderingPage | ✅ Recent-orders panel permanently empty (double-envelope) fixed; orders no longer silently attach to a CLOSED encounter (fallback removed — guard now shows). |
| PackageBillingPage | ✅ Was incapable of its job (apply modal unreachable, no patient picker, would-be payload rejected). Now: Apply → patient search → one-line invoice at package price → cashier. Fake template modal removed; category filter wired. |
| SearchBillsPage | ✅ Refund/cancel now require a typed reason (audit was "requested by user" for everything); server errors surfaced. |
| DoctorFeesPage | ✅ Doctor column was blank on every row (firstName/lastName on a fullName-only User) → fixed; confirmDialog. |

## Backend fixes (found live)
- **Invoice refund 500'd on every call** — pessimistic lock combined with
  outer-joined relations (5th member of the FOR-UPDATE bug class). Fixed
  lock-bare-row-then-load pattern, and the same latent bug in **void payment,
  payment refund, asset transfer approvals ×2, and HR shift-swap approval**
  (all would have 500'd on first use). After the fix the refund endpoint
  correctly enforces segregation of duties (invoice creator cannot refund).
- Claims processing verified: item requires `itemType` + `serviceDate`
  (client types fixed); approve/reject enforce submitter≠processor.

## Client (services/) shape repairs
`insurance.ts`: CreatePolicyDto, CreatePreAuthDto, CreateClaimDto,
CreateClaimItemDto, Claim, PreAuth all rewritten to entity/DTO truth;
reject → ProcessClaimDto; recordPayment → paidAmount/paymentReference;
facility fallback to auth store (nothing ever set the sessionStorage key).
`billing.ts`: payments.record reference-key fix (+notes).

## E2E artifacts on tesy
Provider "Jubilee Health Uganda" (JUB), policy JUB-2026-0001 (verified, 5M
limit, 10% copay), pre-auth PA2026070001 (MRI lumbar spine, pending), claims
CLM2026070001–0006 (mix of draft/submitted with real items) — demo-ready.

## Known gaps (deferred)
- No pagination on invoice/payment/bill lists (20/50-row caps skew summary
  cards on busy sites) — needs a shared paginated-list pass.
- Claims: add-item UI not yet exposed on the claims page (items come from
  create-from-encounter; manual drafts need the item modal next).
- SearchBills "OPD" scope label is cosmetic (backend ignores `type` filter);
  card/mobile-money payment filters can never match payer-type data.
- Approve/reject of claims and refunds need a second user in tests
  (segregation of duties correctly blocks the single-user E2E).
- Fantasy insurance fields on `services/patients.ts` still mislead consumers
  (PatientsPage/OPDToken badges) — coordinated sweep pending since Block 3.5.
