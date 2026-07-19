# Module 11 — Pharmacy POS (Retail Counter)

Reviewed 2026-07-19 (frontend review Block 11). Full retail money path
E2E-verified live on tesy (API + browser): shift open → cash & MoMo sales →
complete → void (manager PIN) → return/refund → x-report → shift close →
z-report, plus hold/recall, drawer events, quick keys and GL postings.

## Overview

```
REGISTER (pos_registers: name + storeId — created inline on Shift page)
  → SHIFT (open w/ opening float → cash/momo/card running totals →
     close w/ counted cash → expectedBalance/cashDifference → Z-report, immutable)
  → SALE (/pharmacy/sales, saleChannel retail_pos — REQUIRES open shift +
     posShiftId/posRegisterId; store-scoped stock; per-line disc % +
     cart disc % [>10% or >50k UGX ⇒ manager PIN]; cash / MoMo [initiate→
     poll status→cancel] / patient-linked)
  → COMPLETE (batch/expiry enforcement fail-closed; stock deducted;
     shift totals via pos_payment_splits; GL: DR Cash / CR Revenue)
  → VOID (manager PIN + reason; restock; GL reversal) — blocked once returns exist
  → RETURN (per-line qty vs already-returned; restockable flag; refund method;
     credit note print; negative shift split vs ORIGINAL sale; GL reversal)
OFFLINE (IndexedDB queue → sync worker create+complete w/ idempotent
  serverSaleId resume; error queue w/ retry / audited discard)
WHOLESALE (customers w/ tier enum standard|silver|gold|platinum; pricing
  tiers create+list; deliveries sale+customer → address → status chain)
```

## The block's headline finds (all were silently broken in prod)

1. **Whole POS module unreachable** (bug class #3, 3rd hit): App mounted
   `POSRoutes` at `/pos/*` while every sidebar link and internal path is
   `/pharmacy/pos/...` — swallowed by `/pharmacy/*`. Every POS menu item
   rendered an empty page. Fix: mount at `/pharmacy/pos/*` (out-ranks
   `/pharmacy/*`), relative child paths, `/pos/*` → redirect.
2. **Seven retail tables missing `deleted_at`** (bug class #8, new): entities
   declare `@DeleteDateColumn` but tables were created without the column —
   every read of held sales / returns / quick keys / reprints / retail
   customers 500'd. Migration 82 adds them.
3. **`pos.*` permission codes never seeded** (bug class #9, new): all 14 codes
   used by `@AuthWithPermissions` were absent from the permissions catalog —
   POS was Super-Admin-only by accident; no role could ever be granted access.
   Migration 82 seeds them (module `pos`).
4. **Every sale completion 500'd**: `completeSale` raw-queried
   `pharmacy_stores` — a table that doesn't exist (real name `stores`).
5. **GL never posted for any pharmacy sale**: `createJournalEntry` called
   `getFiscalPeriodForDate` without tenantId → `requireTenantId` threw →
   fell into create-fiscal-year → "already exists" → journal skipped. Voids/
   returns additionally violated the debit-XOR-credit check (negative
   amounts) — now posted with swapped sides.
6. **Returns rolled back silently**: shift split insert FK'd the RETURN id
   into `pos_payment_splits.sale_id` (FK → pharmacy_sales); the caught error
   still aborted the Postgres txn → return vanished, endpoint 404'd. Split
   now attributed (negative) to the original sale.
7. **Restock wrote `createdById: 'system'` into a uuid column** → void AND
   return both 500'd (same latent bug fixed in surgery consumable deletion).
8. **POS product grid had no stock**: it read `/inventory` (404→[]) and after
   pointing at `/inventory/items` the rows carry NO stock fields → every item
   "out of stock", add-to-cart blocked. Now uses store-scoped
   `/stores/inventory?storeId=` (currentStock/availableStock + prices), which
   also gained `isSellable` items (was drugs-only — masks/sundries invisible).
9. **Fantasy shift shape on 3 pages** (bug class #6): Shift/Dashboard/Reports
   read `totalCash/totalMobileMoney/salesCount/cashierName/registerName` —
   none exist. Shared `mapShift()` (`src/pages/pos/shiftUtils.ts`) maps the
   real entity (cashSales/mobileMoneySales/cardSales/transactionCount/
   expectedBalance + register.name/cashier.fullName relations).

## Page status after this block

| Route (under /pharmacy/pos) | Page | State |
|---|---|---|
| `` (index) | POSDashboardPage | ✅ live shift tiles (mapped fields), recent sales, low-stock |
| `/sale` | POSSalePage | ✅ full register (see element table) |
| `/shifts` | POSShiftPage | ✅ register select + inline register/store create, open/close w/ expected-cash preview, history, compliance tools (drawer events, X/Z) |
| `/reports` | POSReportsPage | ✅ closed-shift aggregates, client-side date filter (backend has none), payment-method split, cash-difference, per-cashier table |
| `/returns` | POSReturnsPage | ✅ recent-sales list w/ client-side search → sale-detail fetch → per-line qty/restockable → refund → printable credit note (names, not UUIDs) |
| `/receipts` | POSReceiptHistoryPage | ✅ (reprint perm `pos.receipt.reprint`) |
| `/offline-sync` | POSOfflineSyncPage | ✅ pending/error queues, retry (storeId fixed), audited discard (IndexedDB 0/1 flag) |
| `/deliveries` | DeliveryTrackingPage | ✅ rebuilt to real DTO: sale picker + wholesale-customer picker + address/driver/vehicle/scheduledAt; rows flatten sale/customer relations; status chain |
| `/wholesale/customers` | WholesaleCustomersPage | ✅ PATCH (was PUT→404), tier enum standard/silver/gold/platinum (was premium/vip→400), status active/inactive |
| `/wholesale/tiers` | PricingTiersPage | ✅ create+list; Edit/Delete removed (no backend endpoints); real `status` field; formatCurrency |

## POSSalePage element map (1800-line register)

| Element | Behaviour |
|---|---|
| Product grid | `/stores/inventory?storeId&search` — store stock, retail→selling→cost price fallback; out-of-stock gate on real numbers |
| Quick keys | `/pos/quick-keys` per register; tap fetches `/stores/inventory/:id` and adds to cart |
| Cart line disc % | now REAL: reduces line total, sent as `discountPercent` per item; "Line discounts" row in summary |
| Cart disc % | >10% or >50,000 UGX ⇒ manager-PIN modal → `POST /pos/verify-manager-pin` (new endpoint; was a dead `/pos/discounts saleId:'pending'` call) |
| Complete Sale (F5) | gated: open shift + store required (backend enforces posShiftId/posRegisterId for retail_pos); payload matches CreatePharmacySaleDto exactly |
| MoMo | create sale → initiate (phone/provider) → status poll → cancel; confirmed E2E |
| Hold / Recall | park cart w/ name+reason → recall restores cart (E2E) |
| Void (toolbar) | was UNREACHABLE (modal existed, no trigger) + asked to type a sale UUID — now toolbar button + picker of recent sales; manager PIN + reason |
| Scan Rx | prescription code → item selection → cart (+ patient link) |
| Link Patient | patient search → recent purchases panel; patientId on sale |
| DDI override | manager PIN via real endpoint (was `/auth/verify-manager-pin` = 404) |
| Offline | saves DTO-valid payload (storeId incl., no amountPaid) to IndexedDB; sync worker recomputes due amount on complete |

## Permissions (migration 82)
`pos.read/manage/shift/sale.hold/sale.void/return.create/return.read/
discount.line/drawer.manage/quickkey.manage/customer.read/patient.link/
receipt.reprint` + `wholesale.manage`. Sidebar items already reference these
codes. NOTE: cashiers also need `stores.read` (product grid) and
`pharmacy.*` sale perms.

## P1s / deferred
- Store create 500s on duplicate code (unhandled unique violation).
- `voidSale` does not subtract from shift running totals (X-report over-states
  cash after a void; Z-report unaffected by design?—verify in Block 12 finance).
- MoMo modal close w/o payment leaves the sale pending (no cancel-sale endpoint).
- Quick keys are register-scoped; keys created without registerId don't show.
- Tier-model schism: `pricing_tiers` table vs customer `pricingTier` enum —
  needs a design decision (tiers page creates rows nothing consumes).
- Stock adjustments create batch-less balances that expiry-tracked items can
  never dispense (correct fail-closed behavior; UX should push goods-receipt).
- `/auth/me` module gating uses license/enabled_modules mapping — `pos` must
  be in the tenant's `enabled_modules` (added for tesy) AND any active
  license's module list, else the sidebar shows a lock screen.
