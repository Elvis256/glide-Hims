# HIMS Billing & Queue: Quick Reference Guide

## CURRENT DATA FLOW (Token → No Auto-Invoice)

```
1. Frontend selects: Patient + Department + Doctor + Condition Flags + PAYMENT TYPE
                     ↓
2. Frontend: POST /queue (CreateQueueDto)
   Does NOT include: paymentType, insurancePolicyId, consultationFee
                     ↓
3. Backend: QueueManagementService.addToQueue()
   - Creates: Queue (status: WAITING)
   - Creates: Encounter (status: REGISTERED)
   - Returns: QueueEntry
                     ↓
4. Frontend: Token printed, patient sent to service point
                     ↓
5. ⚠️ LATER (after consultation):
   Frontend/Backend must manually POST /billing/invoices to create invoice
```

---

## WHAT'S IN EACH ENTITY

### INVOICE (invoice.entity.ts)
```
✅ Links to: Encounter, Patient, User(createdBy), Payments, InvoiceItems
✅ Tracks: status (draft/pending/paid/cancelled/refunded), payment amounts, balance due
✅ Supports: paymentType (cash/insurance/corporate/membership), insurancePolicyId
⚠️ Created: Manually via POST /billing/invoices (currently not auto at token time)
```

### QUEUE (queue.entity.ts)
```
✅ Links to: Encounter, Patient, Facility, Department, User(createdBy, servingUser, assignedDoctor)
✅ Tracks: ticketNumber, sequenceNumber, status (waiting/called/in_service/completed)
✅ Stores: visitType, chiefComplaintAtToken, patientConditionFlags, priority
⚠️ Does NOT have: paymentType, invoiceId, consultationFee, billingStatus
```

### ENCOUNTER (encounter.entity.ts)
```
✅ Links to: Patient, Facility, Department, InsurancePolicy, User(attendingProvider, createdBy)
✅ Tracks: status (registered/triage/waiting/in_consultation/pending_payment/completed)
✅ Stores: payerType (cash/insurance/corporate)
✅ Status flow: REGISTERED → IN_CONSULTATION → PENDING_PAYMENT (when invoice created)
✅ Terminal: COMPLETED (when invoice fully paid) or CANCELLED
```

---

## PAYMENT TYPE MAPPING

### Frontend Selection (OPDTokenPage.tsx)
```typescript
type PaymentType = 'cash' | 'mobile_money' | 'card' | 'membership' 
                   | 'insurance' | 'hospital_scheme' | 'staff'
```

### Backend Invoice PaymentType (invoice.entity.ts)
```typescript
enum PaymentType {
  CASH = 'cash',
  INSURANCE = 'insurance',
  CORPORATE = 'corporate',
  MEMBERSHIP = 'membership'
}
```

### Payment Method (PaymentMethod - how money actually received)
```typescript
enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  INSURANCE = 'insurance',
  CHEQUE = 'cheque'
}
```

**Note**: Frontend paymentType ≠ Backend PaymentType. "mobile_money" frontend → "cash" backend (unless using MPESA integration).

---

## KEY SERVICES & METHODS

### BillingService (billing.service.ts)
```
createInvoice(dto, userId, tenantId)
  → Generates invoice#, calculates totals, creates items
  → If encounterId: sets encounter.status = PENDING_PAYMENT
  → Returns: Invoice with items, payments, relations

recordPayment(dto, userId, tenantId)
  → Uses pessimistic write lock on Invoice
  → Updates: amountPaid, balanceDue, status (PARTIALLY_PAID | PAID)
  → If PAID + encounterId: sets encounter.status = COMPLETED, endTime = now()
  → Sends SMS/email (non-blocking)
  → Returns: Payment with receipt#
```

### QueueManagementService (queue-management.service.ts)
```
addToQueue(dto, userId, facilityId, tenantId)
  → Checks: patient not already in active queue today
  → Enforces: capacity limits per service point
  → Resolves: priority from condition flags + facility config
  → Creates: Encounter (type: OPD, status: REGISTERED, visitNumber auto-generated)
  → Creates: Queue (status: WAITING, ticketNumber auto-generated)
  → Returns: Queue with patient, encounter relations
  
⚠️ Currently does NOT create invoice
```

---

## API ENDPOINTS SUMMARY

### Billing
```
POST   /billing/invoices                    → Create invoice
GET    /billing/invoices                    → List invoices (filter, paginate)
GET    /billing/invoices/:id                → Get invoice by ID
GET    /billing/invoices/number/:invoiceNumber  → Get by invoice number
POST   /billing/invoices/:id/items          → Add item to invoice
POST   /billing/payments                    → Record payment
GET    /billing/payments                    → List payments
GET    /billing/payments/:id                → Get payment/receipt
PATCH  /billing/invoices/:id/cancel         → Cancel invoice
PATCH  /billing/invoices/:id/refund         → Refund invoice
PATCH  /billing/payments/:id/void           → Void payment
```

### Queue
```
POST   /queue                        → Issue token (addToQueue)
GET    /queue                        → List queue entries
GET    /queue/:id                    → Get queue entry
GET    /queue/waiting/:servicePoint  → Get waiting patients
GET    /queue/stats                  → Get statistics
POST   /queue/:id/call               → Call patient
POST   /queue/:id/start-service      → Mark IN_SERVICE
POST   /queue/:id/complete           → Mark COMPLETED
POST   /queue/:id/transfer           → Transfer to next service
POST   /queue/:id/cancel             → Cancel queue entry
```

---

## IMPLEMENTATION CHECKLIST FOR AUTO-INVOICE AT TOKEN

### Backend
- [ ] Add `paymentType: PaymentType` to Queue entity
- [ ] Add `initialInvoiceId: string` to Queue entity  
- [ ] Add `consultationFeeAmount: decimal` to Queue entity
- [ ] Add `paymentType` param to CreateQueueDto
- [ ] Add `insurancePolicyId` param to CreateQueueDto
- [ ] Add `consultationFeeAmount` param to CreateQueueDto
- [ ] Add `autoCreateInvoice` param to CreateQueueDto (default: true)
- [ ] Inject BillingService into QueueManagementService
- [ ] Modify `addToQueue()` to call `billingService.createInvoice()` after Encounter creation
- [ ] Import BillingModule in queue-management.module.ts
- [ ] Create database migration to add 3 columns to queues table

### Frontend
- [ ] Update CreateQueueEntryDto interface to include billing fields
- [ ] Modify `handleIssueToken()` to map paymentType to backend enum
- [ ] Pass paymentType, insurancePolicyId to queueData
- [ ] In `issueTokenMutation.onSuccess()`: fetch and display auto-created invoice
- [ ] Add consultation fee amount to queueData
- [ ] Show invoice number on token receipt/printout

### Testing
- [ ] Create queue entry with cash payment → verify invoice created with CASH type
- [ ] Create queue entry with insurance → verify insurancePolicyId linked
- [ ] Record payment on auto-created invoice → verify encounter.status = COMPLETED
- [ ] Verify ticketNumber and visit info in invoice notes
- [ ] Test biometric verification flow (scheme/staff payments)

---

## CRITICAL DECISIONS

1. **Auto-create or manual?** 
   - Proposed: Auto-create with `autoCreateInvoice` flag (default true)
   - Allows opt-out for special cases

2. **Default consultation fee?**
   - Source: `CONSULTATION_FEE` from services API (~50000)
   - Can be overridden per facility via `consultationFeeAmount` param

3. **When to charge additional services?**
   - Not at token issuance
   - After services rendered during consultation
   - Additional items added via POST /billing/invoices/:id/items

4. **Payment collection?**
   - Not at token issuance (no payment recorded)
   - Invoice status: PENDING
   - Patient can pay immediately or later at cashier
   - POST /billing/payments records payment and updates status

5. **Insurance verification?**
   - If paymentType = INSURANCE:
     - insurancePolicyId passed at token time
     - Could add pre-auth validation here
     - Currently not implemented

---

## POTENTIAL ISSUES & MITIGATION

| Issue | Risk | Mitigation |
|-------|------|-----------|
| Invoice created but patient doesn't complete visit | Bad debt | Track abandoned queue entries, offer refunds |
| Multiple invoices created if token issued twice | Data corruption | Unique constraint on queue.ticketNumber, check existing active queue |
| Consultation fee not set in facility config | Missing charges | Default 50000, admin can override via system settings |
| Payment type not mapped correctly | Wrong invoice type | Use enum mapping table, validate PaymentType |
| Encounter becomes COMPLETED prematurely | Lost discharge notes | Only complete when invoice fully PAID (not at token) |
| Race condition on payment recording | Double-payment | Use pessimistic write lock (already in place) |

---

## FILE LOCATIONS - KEY FILES

```
Backend Modules:
  packages/backend/src/modules/billing/
    - billing.service.ts (29 KB) ← Core logic
    - billing.controller.ts (5 KB) ← All endpoints
    - billing.dto.ts (4 KB) ← Request/response models
    - billing.module.ts

  packages/backend/src/modules/queue-management/
    - queue-management.service.ts (35 KB) ← Token issuance here
    - queue-management.controller.ts (7 KB) ← API endpoints
    - dto/queue.dto.ts (5 KB) ← Request models
    - queue-management.module.ts

Database Entities:
  packages/backend/src/database/entities/
    - invoice.entity.ts (Invoice, InvoiceItem, Payment classes)
    - queue.entity.ts (Queue, QueueDisplay, statuses, transitions)
    - encounter.entity.ts (Encounter with status workflow)

Frontend:
  packages/frontend/src/
    - pages/OPDTokenPage.tsx (1400+ lines) ← Payment type selection
    - services/billing.ts (230 lines) ← Invoice API calls
    - services/queue.ts ← Queue API calls
```

---

## QUICK COMMAND REFERENCE

```bash
# Find relevant code
grep -rn "paymentType" packages/backend/src/
grep -rn "createInvoice" packages/backend/src/modules/billing/
grep -rn "addToQueue" packages/backend/src/modules/queue-management/
grep -rn "handleIssueToken" packages/frontend/src/

# Check entity relationships
grep -A 5 "ManyToOne.*Invoice\|OneToMany.*Payment" packages/backend/src/database/entities/

# View invoice creation logic
head -150 packages/backend/src/modules/billing/billing.service.ts | tail -80

# View token issuance logic
head -185 packages/backend/src/modules/queue-management/queue-management.service.ts | tail -100
```

