# HIMS Billing & Queue Management Architecture Analysis

## 1. BILLING MODULE ARCHITECTURE

### 1.1 Core Files Location
- **Service**: `/root/glide-Hims/packages/backend/src/modules/billing/billing.service.ts` (29.1 KB)
- **Controller**: `/root/glide-Hims/packages/backend/src/modules/billing/billing.controller.ts`
- **DTOs**: `/root/glide-Hims/packages/backend/src/modules/billing/billing.dto.ts`
- **Entities**: 
  - Invoice: `/root/glide-Hims/packages/backend/src/database/entities/invoice.entity.ts`
  - Payment: Same file as Invoice

### 1.2 Invoice Entity Structure
```typescript
// Key Fields:
- invoiceNumber: string (unique, indexed)
- status: InvoiceStatus (enum: draft, pending, partially_paid, paid, cancelled, refunded)
- subtotal: decimal(12,2)
- taxAmount: decimal(12,2)
- discountAmount: decimal(12,2)
- totalAmount: decimal(12,2)
- amountPaid: decimal(12,2) - default 0
- balanceDue: decimal(12,2) - calculated field
- paymentType: PaymentType (enum: cash, insurance, corporate, membership)
- insurancePolicyId: string (nullable)
- dueDate: date (nullable)
- notes: text (nullable)

// Relationships:
- patient: Patient (ManyToOne)
- patientId: string
- encounter: Encounter (ManyToOne, nullable)
- encounterId: string (nullable)
- createdBy: User (ManyToOne)
- items: InvoiceItem[] (OneToMany cascade)
- payments: Payment[] (OneToMany)
```

### 1.3 Payment Entity Structure
```typescript
- receiptNumber: string (unique, indexed)
- amount: decimal(12,2)
- method: PaymentMethod (enum: cash, card, mobile_money, bank_transfer, insurance, cheque)
- status: PaymentStatus (enum: pending, completed, failed, refunded, voided)
- transactionReference: string (nullable)
- notes: text (nullable)
- paidAt: timestamptz (default CURRENT_TIMESTAMP)
- invoice: Invoice (ManyToOne)
- invoiceId: string
- receivedBy: User (ManyToOne)
- receivedById: string
```

### 1.4 Invoice Item Entity Structure
```typescript
- serviceCode: string
- description: string
- chargeType: ChargeType (enum: consultation, procedure, lab, radiology, pharmacy, bed, nursing, other)
- quantity: decimal(8,2) - default 1
- unitPrice: decimal(10,2)
- amount: decimal(12,2) - calculated: quantity * unitPrice
- discountPercent: decimal(5,2)
- taxPercent: decimal(5,2)
- referenceType: string (nullable) - source type (e.g., 'order', 'prescription')
- referenceId: string (nullable) - source ID
- invoice: Invoice (ManyToOne)
```

### 1.5 CreateInvoiceDto (What Frontend/Backend Sends)
```typescript
{
  patientId: string (UUID, required)
  encounterId?: string (UUID, optional)
  items: Array<{
    serviceCode: string (required)
    description: string (required)
    chargeType?: ChargeType (default: OTHER)
    quantity: number (required, min 0.01)
    unitPrice: number (required, min 0)
    discountPercent?: number (optional, min 0)
    referenceType?: string (optional) - e.g., "order", "prescription"
    referenceId?: string (optional) - ID from source system
  }> (required)
  taxPercent?: number (optional)
  discountAmount?: number (optional, min 0)
  notes?: string (optional)
  dueDate?: ISO string (optional)
  paymentType?: PaymentType (optional, default: CASH)
  insurancePolicyId?: UUID (optional)
}
```

### 1.6 CreatePaymentDto (What Frontend Sends for Payment Recording)
```typescript
{
  invoiceId: string (UUID, required)
  amount: number (required, min 0.01)
  method: PaymentMethod (required, enum)
  transactionReference?: string (optional)
  notes?: string (optional)
}
```

### 1.7 Billing Service: Key Methods

#### `createInvoice(dto, userId, tenantId)`
- **Location**: Line 76
- **Workflow**:
  1. Generates unique invoice number with pattern `INV{YYYYMMDD}{sequence}`
  2. Calculates line items amounts (quantity × unitPrice)
  3. Calculates totals: subtotal, taxAmount, discountAmount, totalAmount
  4. Sets balanceDue = totalAmount (initially unpaid)
  5. Creates invoice with status = PENDING
  6. **If encounterId provided**: Updates encounter status from PENDING_PHARMACY → PENDING_PAYMENT
  7. Returns full invoice object with items and relationships loaded

#### `recordPayment(dto, userId, tenantId)`
- **Location**: Line 253
- **Uses pessimistic write lock** on Invoice row to prevent concurrent payment race conditions
- **Workflow**:
  1. Locks invoice for update
  2. Validates: invoice exists, not already paid, amount ≤ balanceDue
  3. Generates receipt number with pattern `RCP{YYYYMMDD}{sequence}`
  4. Creates Payment record
  5. Updates invoice:
     - amountPaid += dto.amount
     - balanceDue = totalAmount - amountPaid
     - status: PARTIALLY_PAID (if balanceDue > 0) or PAID (if balanceDue ≤ 0)
  6. **If invoice fully paid AND encounterId exists**: Updates encounter status → COMPLETED, sets endTime
  7. Sends SMS/email notification (non-blocking) after full payment
  8. Returns Payment object

#### `findAll(query, tenantId)`
- **Location**: Line 128
- Supports filtering by: status, patientId, encounterId, dateFrom, dateTo, search (name/MRN/invoice#), patientMrn
- Pagination: default page=1, limit=20
- Returns: `{ data: Invoice[], total: number }`

#### Other Methods
- `findInvoice(id, tenantId)` - Get by ID with relations
- `findByInvoiceNumber(invoiceNumber, tenantId)` - Get by invoice number
- `addItem(invoiceId, dto, tenantId)` - Add item and recalculate
- `cancelInvoice(id, reason, tenantId)` - Set status = CANCELLED
- `refundInvoice(id, reason, tenantId)` - Set status = REFUNDED
- `getPaymentsByInvoice(id, tenantId)` - Get all payments for invoice
- `listPayments(filters, tenantId)` - List payments with filters
- `voidPayment(id, reason, tenantId)` - Set payment status = VOIDED
- `getDailyRevenue(date, tenantId)` - Revenue dashboard data
- `getRevenueDashboard(facilityId, period, tenantId)` - Daily/weekly/monthly trends

### 1.8 Billing Controller: All Endpoints

| Endpoint | Method | DTO/Params | Auth | Purpose |
|----------|--------|-----------|------|---------|
| `/billing/invoices` | POST | CreateInvoiceDto | billing.create | Create invoice |
| `/billing/invoices` | GET | InvoiceQueryDto | billing.read | List invoices with filters |
| `/billing/invoices/pending` | GET | - | billing.read | Get pending invoices (cashier queue) |
| `/billing/invoices/number/:invoiceNumber` | GET | - | billing.read | Find invoice by number |
| `/billing/invoices/:id` | GET | - | billing.read | Find invoice by ID |
| `/billing/invoices/:id/items` | POST | AddInvoiceItemDto | billing.update | Add item to invoice |
| `/billing/invoices/:id/cancel` | PATCH | { reason? } | billing.update | Cancel invoice |
| `/billing/invoices/:id/refund` | PATCH | { reason? } | billing.update | Refund invoice |
| `/billing/invoices/:id/payments` | GET | - | billing.read | Get payments for invoice |
| `/billing/payments` | GET | startDate?, endDate?, method? | billing.read | List all payments |
| `/billing/payments/:id` | GET | - | billing.read | Get single payment/receipt |
| `/billing/payments` | POST | CreatePaymentDto | billing.create | Record payment |
| `/billing/payments/:id/void` | PATCH | { reason } | billing.update | Void a payment |
| `/billing/revenue/daily` | GET | date? | billing.read | Daily revenue summary |
| `/billing/revenue/dashboard` | GET | facilityId, period? | billing.read | Revenue dashboard with trends |

---

## 2. QUEUE MANAGEMENT MODULE ARCHITECTURE

### 2.1 Core Files Location
- **Service**: `/root/glide-Hims/packages/backend/src/modules/queue-management/queue-management.service.ts` (35.8 KB)
- **Controller**: `/root/glide-Hims/packages/backend/src/modules/queue-management/queue-management.controller.ts`
- **DTOs**: `/root/glide-Hims/packages/backend/src/modules/queue-management/dto/queue.dto.ts`
- **Entity**: `/root/glide-Hims/packages/backend/src/database/entities/queue.entity.ts`

### 2.2 Queue Entity Structure
```typescript
// Queue Status State Machine:
QueueStatus enum: WAITING, CALLED, IN_SERVICE, COMPLETED, SKIPPED, NO_SHOW, TRANSFERRED, CANCELLED

// Valid Transitions:
WAITING → [CALLED, IN_SERVICE, TRANSFERRED, SKIPPED, CANCELLED]
CALLED → [IN_SERVICE, NO_SHOW, SKIPPED, CANCELLED, TRANSFERRED]
IN_SERVICE → [COMPLETED, TRANSFERRED, CANCELLED]
COMPLETED → [] (terminal)
SKIPPED → [WAITING, CANCELLED]
NO_SHOW → [WAITING, CANCELLED]
TRANSFERRED → [WAITING]
CANCELLED → [] (terminal)

// Key Fields:
- ticketNumber: string
- queueDate: date
- servicePoint: ServicePoint (enum: registration, triage, consultation, laboratory, radiology, pharmacy, billing, cashier, injection, dressing, vitals, records, ipd, emergency, theatre, physiotherapy, dental, optical, nutrition, counselling)
- status: QueueStatus (default: WAITING)
- priority: QueuePriority (enum: emergency=1, urgent=2, vip=3, elderly=4, disabled=5, pregnant=6, pediatric=7, routine=10)
- priorityReason: string (nullable)
- sequenceNumber: number
- estimatedWaitMinutes: number (nullable)
- actualWaitMinutes: number (nullable)
- serviceDurationMinutes: number (nullable)
- calledAt: timestamptz (nullable)
- serviceStartedAt: timestamptz (nullable)
- serviceEndedAt: timestamptz (nullable)
- callCount: number
- counterNumber: string (nullable)
- roomNumber: string (nullable)
- notes: text (nullable)
- skipReason: text (nullable)
- transferReason: text (nullable)
- nextServicePoint: varchar (nullable)
- visitType: varchar(50) (nullable) - determines routing at token issuance
- chiefComplaintAtToken: text (nullable) - captured at reception (before triage)
- patientConditionFlags: jsonb (nullable) - array of strings (e.g., elderly, pregnant, wheelchair)
- onHold: boolean (default: false)
- holdReason: text (nullable)
- holdStartedAt: timestamptz (nullable)
- previousServicePoint: varchar (nullable)
- previousQueueId: string (nullable)

// Relationships:
- patient: Patient (ManyToOne, eager: true)
- patientId: string
- encounter: Encounter (ManyToOne, nullable)
- encounterId: string (nullable)
- facility: Facility (ManyToOne)
- facilityId: string
- department: Department (ManyToOne, nullable)
- departmentId: string (nullable)
- servingUser: User (ManyToOne, nullable)
- servingUserId: string (nullable)
- createdBy: User (ManyToOne)
- createdById: string
- assignedDoctor: User (ManyToOne, nullable)
- assignedDoctorId: string (nullable)
```

**⚠️ IMPORTANT**: Queue entity does NOT have any payment/billing-related fields. No `paymentType`, no `invoiceId`, no billing status.

### 2.3 CreateQueueDto (What Frontend Sends at Token Issuance)
```typescript
{
  patientId: string (UUID, required)
  encounterId?: string (UUID, optional)
  servicePoint: ServicePoint (required)
  priority?: QueuePriority (optional)
  priorityReason?: string (optional)
  departmentId?: UUID (optional)
  notes?: string (optional)
  assignedDoctorId?: UUID (optional)
  visitType?: VisitType (optional) - determines routing
    // VisitType enum: new_visit, follow_up, procedure_only, lab_collection, pharmacy_pickup, emergency, referral, review
  chiefComplaintAtToken?: string (optional) - captured at reception
  patientConditionFlags?: string[] (optional) - e.g., ['elderly', 'pregnant', 'wheelchair', 'child', 'appears_unwell']
}
```

**⚠️ CRITICAL**: CreateQueueDto does NOT have paymentType, paymentMethod, insurancePolicy, or any other billing data!

### 2.4 Queue Management Service: Key Methods

#### `addToQueue(dto, userId, facilityId, tenantId)` - **Token Issuance**
- **Location**: Line 89
- **Workflow**:
  1. Checks if patient already in active queue today (WAITING, CALLED, IN_SERVICE) → Error if exists
  2. **Enforces capacity limits per service point** from facility config
  3. **Resolves priority from condition flags** if not explicitly set (using facility config rules)
  4. Generates unique ticketNumber with facility/service point prefix
  5. Generates sequenceNumber for the day at that service point
  6. **Creates Encounter automatically**:
     - type: OPD
     - status: REGISTERED
     - visitNumber: `VN-{YYYYMMDD}-{timestamp}`
     - chiefComplaint: from dto or 'OPD Visit'
     - queueNumber: sequenceNumber
  7. Creates Queue entry with status = WAITING
  8. Calculates estimatedWaitMinutes using smart wait time calculation
  9. Updates doctor queue count if assignedDoctorId provided
  10. Writes audit log
  11. Returns Queue with patient and encounter relations

#### Other Queue Methods
- `getQueue(filter, facilityId, tenantId)` - List queues with patient/encounter relations
- `getWaitingQueue(servicePoint, facilityId, tenantId)` - Active waiting patients at service point
- `getStats(facilityId, servicePoint, tenantId)` - Queue statistics
- `callNext(dto, userId, facilityId, tenantId)` - Call next patient
- `callPatient(id, userId, facilityId, tenantId)` - Call specific patient
- `startService(id, userId, tenantId)` - Mark as IN_SERVICE
- `completeService(id, userId, tenantId)` - Mark as COMPLETED
- `transferToNextService(id, dto, userId, tenantId)` - Transfer to next service point
- `skipPatient(id, dto, userId, tenantId)` - Skip patient
- `markNoShow(id, userId, tenantId)` - Mark as NO_SHOW
- `cancelFromQueue(id, reason, userId, tenantId)` - Cancel queue entry
- `holdQueue(id, dto, userId, tenantId)` - Hold queue entry
- `getServiceConfig(facilityId, tenantId)` - Get facility service configuration
- `upsertServiceConfig(facilityId, dto, tenantId)` - Update facility configuration

### 2.5 Queue Controller: All Endpoints

| Endpoint | Method | DTO/Params | Auth | Purpose |
|----------|--------|-----------|------|---------|
| `/queue` | POST | CreateQueueDto | queue.create | **Issue Token** (addToQueue) |
| `/queue` | GET | QueueFilterDto | queue.read | Get queue list |
| `/queue/waiting/:servicePoint` | GET | - | queue.read | Get waiting queue |
| `/queue/stats` | GET | servicePoint? | queue.read | Get queue statistics |
| `/queue/service-config` | GET | - | queue.read | Get facility service config |
| `/queue/service-config` | PUT | ServiceConfigDto | queue.create | Update service config |
| `/queue/patient/:patientId` | GET | - | queue.read | Get patient queue status |
| `/queue/:id` | GET | - | queue.read | Get queue entry by ID |
| `/queue/:id/audit-log` | GET | - | queue.read | Get queue audit log |
| `/queue/call-next` | POST | CallNextDto | queue.update | Call next patient |
| `/queue/:id/call` | POST | - | queue.update | Call specific patient |
| `/queue/:id/recall` | POST | - | queue.update | Recall patient |
| `/queue/:id/start-service` | POST | - | queue.update | Start service |
| `/queue/:id/complete` | POST | - | queue.update | Complete service |
| `/queue/:id/transfer` | POST | TransferQueueDto | queue.update | Transfer to next service |
| `/queue/:id/skip` | POST | SkipQueueDto | queue.update | Skip patient |
| `/queue/:id/no-show` | POST | - | queue.update | Mark no-show |
| `/queue/:id/cancel` | POST | { reason } | queue.delete | Cancel queue entry |
| `/queue/:id/requeue` | POST | - | queue.update | Requeue patient |
| `/queue/:id/hold` | POST | HoldQueueDto | queue.update | Hold queue entry |
| `/queue/:id/unhold` | POST | - | queue.update | Unhold queue entry |
| `/queue/displays` | POST | CreateQueueDisplayDto | queue.create | Create display |
| `/queue/displays` | GET | - | queue.read | Get displays |
| `/queue/displays/:displayCode/queue` | GET | - | queue.read | Get display queue |

---

## 3. ENCOUNTER ENTITY - BILLING & QUEUE INTEGRATION POINT

### 3.1 Location
`/root/glide-Hims/packages/backend/src/database/entities/encounter.entity.ts`

### 3.2 Key Fields Related to Billing/Queue
```typescript
// Encounter Status enum:
REGISTERED = 'registered'          // Initial state after token issuance
TRIAGE = 'triage'                  // After triage
WAITING = 'waiting'                // Waiting for consultation
IN_CONSULTATION = 'in_consultation'
PENDING_LAB = 'pending_lab'
PENDING_PHARMACY = 'pending_pharmacy'
PENDING_PAYMENT = 'pending_payment' // ⚠️ Set when invoice created
RETURN_TO_DOCTOR = 'return_to_doctor'
RETURN_TO_PHARMACY = 'return_to_pharmacy'
ADMITTED = 'admitted'
DISCHARGED = 'discharged'
COMPLETED = 'completed'            // ⚠️ Set when invoice fully paid
CANCELLED = 'cancelled'

// Encounter Payer Type:
PayerType enum: CASH, INSURANCE, CORPORATE

// Key Billing-Related Fields:
- payerType: PayerType (default: CASH)
- insurancePolicyId: string (nullable)

// Relationships:
- insurancePolicy: InsurancePolicy (ManyToOne, nullable)
- patient: Patient
- facility: Facility
- department: Department (nullable)
- attendingProvider: User (nullable)
```

### 3.3 Status Transitions in Payment Flow
```
REGISTERED 
  ↓ (from queue addToQueue)
TRIAGE / WAITING / IN_CONSULTATION
  ↓ (after services rendered)
PENDING_PHARMACY (if prescription issued)
  ↓ (when invoice created)
PENDING_PAYMENT ← ⚠️ Created by billing.service.createInvoice()
  ↓ (when invoice fully paid)
COMPLETED ← ⚠️ Set by billing.service.recordPayment()
```

---

## 4. FRONTEND: OPD TOKEN PAGE

### 4.1 Location
`/root/glide-Hims/packages/frontend/src/pages/OPDTokenPage.tsx` (1400+ lines)

### 4.2 Payment Type State Management
```typescript
// Enhanced payment types (frontend only, NOT sent to queue backend):
type PaymentType = 'cash' | 'mobile_money' | 'card' | 'membership' | 'insurance' | 'hospital_scheme' | 'staff'

// State:
const [paymentType, setPaymentType] = useState<PaymentType>('cash');
const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'mtn' | 'airtel'>('mtn');
const [cardType, setCardType] = useState<'visa' | 'mastercard'>('visa');
const [insurance, setInsurance] = useState({ provider: '', policyNumber: '', expiryDate: '' });
const [membership, setMembership] = useState({ cardNumber: '', balance: 0 });
const [staffId, setStaffId] = useState('');
```

### 4.3 handleIssueToken Function
- **Location**: Line 281
- **Data Sent to Backend**: CreateQueueDto (NOT payment data)
  ```typescript
  const queueData: CreateQueueEntryDto = {
    patientId: selectedPatient.id,
    servicePoint: entryServicePoint,
    priority: resolvedPriority,
    priorityReason: conditionFlags.length > 0 ? conditionFlags.join(', ') : undefined,
    departmentId: selectedDepartment || undefined,
    visitType,
    chiefComplaintAtToken: chiefComplaint.trim() || undefined,
    patientConditionFlags: conditionFlags.length > 0 ? conditionFlags : undefined,
    notes: selectedDoctor !== 'any' 
      ? `Preferred doctor: ${availableDoctors.find(d => d.id === selectedDoctor)?.name || 'Assigned doctor'}. Department: ${selectedDeptName}`
      : `Department: ${selectedDeptName}`,
    assignedDoctorId: selectedDoctor !== 'any' ? selectedDoctor : undefined,
  };
  issueTokenMutation.mutate(queueData);
  ```

⚠️ **CRITICAL FINDING**: Payment type selected on frontend is NOT sent to backend at token issuance!

### 4.4 Token Issuance Mutation (Line 232)
```typescript
const issueTokenMutation = useMutation({
  mutationFn: async (data: CreateQueueEntryDto) => {
    return queueService.addToQueue(data);  // Calls POST /queue
  },
  onSuccess: (token) => {
    setIssuedToken(token);  // Queue entry returned
    setError(null);
    // Invalidates cache but does NOT create invoice
    queryClient.invalidateQueries({ queryKey: ['queue-today'] });
    queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
  },
  onError: (err) => {
    // Error handling
  },
});
```

**⚠️ No invoice creation happens after successful token issuance.**

### 4.5 Biometric Verification (for scheme/staff payments)
- Required for `hospital_scheme` and `staff` payment types
- Handled via `biometricsService.checkEnrollment()` and `biometricsService.checkStaffCoverage()`
- Must complete before token issuance (blocked if paymentType is scheme/staff and biometricVerified = false)

---

## 5. FRONTEND BILLING SERVICE

### 5.1 Location
`/root/glide-Hims/packages/frontend/src/services/billing.ts`

### 5.2 Available Methods
```typescript
billingService.invoices = {
  list(params): { data: Invoice[], total: number }
  getPending(): Invoice[]
  getByNumber(invoiceNumber): Invoice
  getById(id): Invoice
  create(data: CreateInvoiceDto): Invoice        // POST /billing/invoices
  addItem(invoiceId, item: AddInvoiceItemDto): InvoiceItem
  getPayments(invoiceId): Payment[]
  cancel(invoiceId, reason?): Invoice
  refund(invoiceId, reason?): Invoice
}

billingService.payments = {
  list(params): Payment[]
  record(invoiceId, data: CreatePaymentDto): Payment  // POST /billing/payments
  getById(paymentId): Payment & { invoice?: Invoice }
  void(paymentId, reason): Payment
}

billingService.revenue = {
  getDaily(date?): DailyRevenue
  getDashboard(facilityId, period?): object
}
```

**Method Signature for Creating Invoice from Frontend**:
```typescript
const response = await api.post('/billing/invoices', {
  patientId: string,
  encounterId?: string,
  items: [{
    serviceCode: string,
    description: string,
    quantity: number,
    unitPrice: number,
    discountPercent?: number,
  }],
  taxPercent?: number,
  notes?: string,
  paymentType?: PaymentType,  // ← Can pass from OPD page
  insurancePolicyId?: string,
});
```

---

## 6. KEY FINDINGS & ARCHITECTURAL GAPS

### 6.1 ✅ What Exists
1. **Separation of Concerns**: Queue and Billing are separate modules
2. **Encounter Linking**: Invoices can link to encounters via encounterId
3. **Status Synchronization**: 
   - `encounter.status` → PENDING_PAYMENT when invoice created
   - `encounter.status` → COMPLETED when invoice fully paid
4. **Payment Locking**: Pessimistic write lock prevents concurrent payment race conditions
5. **Transaction Safety**: Invoice creation and payment recording use database transactions
6. **Audit Logging**: Queue operations are logged
7. **Flexible Charge Types**: InvoiceItem supports multiple charge types (consultation, lab, etc.)

### 6.2 ❌ Critical Gaps: Auto-Create Invoice at Token Issuance

**Current Workflow**:
```
Patient arrives
    ↓
Frontend: Select patient, department, doctor, visit type, PAYMENT TYPE
    ↓
Frontend: handleIssueToken() → POST /queue (CreateQueueDto)
    ↓
Backend: queueService.addToQueue()
    ├─ Creates Queue entry (status: WAITING)
    ├─ Creates Encounter (status: REGISTERED)
    └─ Returns QueueEntry
    ↓
Frontend: Token issued, printed
    ↓
⚠️ NO INVOICE CREATED YET
    ↓
[Later, after consultation]
    ↓
Frontend/Backend: Manually create invoice via POST /billing/invoices
    ↓
Patient pays at cashier
```

**What's Missing**:
1. **No automatic invoice creation at token issuance**
2. **Payment type selected on frontend is not stored** on queue or encounter
3. **No linkage between token payment selection and invoice paymentType**
4. **No initial consultation fee charge** when token is issued
5. **No queue status for "pending_payment"** - only encounter has this

### 6.3 Data Flow Gaps
```
Frontend Payment Type Selection:
  'cash' → Not sent to backend
  'insurance' → Not sent to backend
  'hospital_scheme' → Not sent to backend
  'staff' → Not sent to backend
  etc.
  
⚠️ This information is lost when token is issued!
```

---

## 7. REQUIRED CHANGES FOR AUTO-CREATE INVOICE AT TOKEN ISSUANCE

To implement "auto-create invoice when token is issued", you need to:

### 7.1 Backend Changes Required

#### 1. Update Queue Entity (queue.entity.ts)
- **Add field**: `paymentType: PaymentType` → For referencing selected payment type
- **Add field**: `initialInvoiceId?: string` → Link to auto-created invoice
- **Add field**: `consultationFeeAmount: decimal` → Store the consultation fee charged

#### 2. Update CreateQueueDto (queue.dto.ts)
- **Add field**: `paymentType: PaymentType` (optional) → Accept from frontend
- **Add field**: `consultationFeeAmount?: number` (optional) → Allow override of default fee
- **Add field**: `insurancePolicyId?: string` (optional) → For insurance payments
- **Add field**: `autoCreateInvoice?: boolean = true` (optional) → Control behavior

#### 3. Update Queue Controller (queue-management.controller.ts)
- No changes needed if accepting paymentType in CreateQueueDto

#### 4. Update QueueManagementService.addToQueue()
- **After creating Encounter, add logic**:
  ```typescript
  // Around line 153 (after savedEncounter)
  let initialInvoice: Invoice | null = null;
  
  if (dto.autoCreateInvoice !== false) {
    initialInvoice = await this.billingService.createInvoice(
      {
        patientId: dto.patientId,
        encounterId: savedEncounter.id,
        items: [
          {
            serviceCode: 'OPD-CONSULT-FEE',
            description: 'OPD Consultation Fee',
            chargeType: ChargeType.CONSULTATION,
            quantity: 1,
            unitPrice: dto.consultationFeeAmount || 50000, // Default from config
          },
        ],
        paymentType: dto.paymentType || PaymentType.CASH,
        insurancePolicyId: dto.insurancePolicyId,
        notes: `Auto-created at token issuance. Token: ${ticketNumber}`,
      },
      userId,
      tenantId
    );
  }
  
  // Then update queue creation (line 154):
  const queue = this.queueRepository.create({
    ...dto,
    // ... existing fields ...
    paymentType: dto.paymentType || PaymentType.CASH,
    initialInvoiceId: initialInvoice?.id,
    consultationFeeAmount: dto.consultationFeeAmount || 50000,
    ...(tenantId ? { tenantId } : {}),
  });
  ```

#### 5. Inject BillingService into QueueManagementService
```typescript
constructor(
  // ... existing injections ...
  @InjectRepository(Queue)
  private queueRepository: Repository<Queue>,
  private readonly billingService: BillingService,  // ← ADD THIS
  // ... rest of injections ...
)
```

#### 6. Add/Import Enums and Types
```typescript
import { PaymentType, ChargeType } from '../../database/entities/invoice.entity';
import { BillingService } from '../billing/billing.service';
```

### 7.2 Frontend Changes Required

#### 1. Update OPDTokenPage.tsx handleIssueToken()
```typescript
const handleIssueToken = () => {
  if (selectedPatient) {
    // ... existing validation ...
    
    const queueData: CreateQueueEntryDto = {
      patientId: selectedPatient.id,
      servicePoint: entryServicePoint,
      priority: resolvedPriority,
      // ... existing fields ...
      
      // ← ADD PAYMENT DATA:
      paymentType: mapPaymentTypeToEnum(paymentType),  // 'cash' → PaymentType.CASH
      insurancePolicyId: paymentType === 'insurance' ? selectedInsurancePolicy : undefined,
      consultationFeeAmount: CONSULTATION_FEE, // Already available
      autoCreateInvoice: true, // Enable auto-creation
    };
    
    issueTokenMutation.mutate(queueData);
  }
};

// Helper function to map frontend PaymentType to backend PaymentType enum
function mapPaymentTypeToEnum(frontendType: PaymentType): PaymentType {
  const mapping: Record<PaymentType, PaymentType> = {
    'cash': PaymentType.CASH,
    'mobile_money': PaymentType.CASH,  // Treat as cash payment method
    'card': PaymentType.CASH,
    'membership': PaymentType.MEMBERSHIP,
    'insurance': PaymentType.INSURANCE,
    'hospital_scheme': PaymentType.CORPORATE,
    'staff': PaymentType.CORPORATE,
  };
  return mapping[frontendType] || PaymentType.CASH;
}
```

#### 2. Update CreateQueueDto Type (OPDTokenPage.tsx or services/queue.ts)
```typescript
export interface CreateQueueEntryDto {
  patientId: string;
  encounterId?: string;
  servicePoint: ServicePoint;
  priority?: QueuePriority;
  priorityReason?: string;
  departmentId?: string;
  notes?: string;
  assignedDoctorId?: string;
  visitType?: VisitType;
  chiefComplaintAtToken?: string;
  patientConditionFlags?: string[];
  
  // ← ADD BILLING FIELDS:
  paymentType?: PaymentType;
  insurancePolicyId?: string;
  consultationFeeAmount?: number;
  autoCreateInvoice?: boolean;
}
```

#### 3. After Token Success, Show Invoice
```typescript
onSuccess: (queueData) => {
  setIssuedToken(queueData);
  
  // ← ADD: If invoice auto-created, fetch and display it
  if (queueData.initialInvoiceId) {
    billingService.invoices.getById(queueData.initialInvoiceId)
      .then(invoice => {
        // Show invoice on receipt/printout
        setIssuedInvoice(invoice);
        toast.success(`Token issued. Invoice: ${invoice.invoiceNumber}`);
      });
  }
  
  setError(null);
  queryClient.invalidateQueries({ queryKey: ['queue-today'] });
  queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
},
```

### 7.3 Database Migration
Create migration to add fields to `queues` table:
```sql
ALTER TABLE queues ADD COLUMN payment_type VARCHAR(50);
ALTER TABLE queues ADD COLUMN initial_invoice_id UUID;
ALTER TABLE queues ADD COLUMN consultation_fee_amount DECIMAL(10,2);
ALTER TABLE queues ADD CONSTRAINT fk_queues_invoices 
  FOREIGN KEY (initial_invoice_id) REFERENCES invoices(id);
```

### 7.4 Module Dependency
Update `queue-management.module.ts`:
```typescript
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, QueueDisplay, Encounter, DoctorDuty, AuditLog, SystemSetting]),
    BillingModule,  // ← ADD THIS
    // ... other imports ...
  ],
  // ...
})
export class QueueManagementModule {}
```

---

## 8. IMPLEMENTATION SUMMARY TABLE

| Component | File | Change Type | Action |
|-----------|------|-------------|--------|
| Queue Entity | queue.entity.ts | ADD | 3 fields: paymentType, initialInvoiceId, consultationFeeAmount |
| Queue DTO | queue.dto.ts | ADD | 3 fields: paymentType, insurancePolicyId, consultationFeeAmount, autoCreateInvoice |
| Queue Service | queue-management.service.ts | MODIFY | Add invoice creation logic in addToQueue() method |
| Queue Service | queue-management.service.ts | INJECT | Add BillingService dependency |
| Queue Module | queue-management.module.ts | IMPORT | Import BillingModule |
| OPD Page | OPDTokenPage.tsx | MODIFY | Pass paymentType to handleIssueToken() |
| OPD Page | OPDTokenPage.tsx | ADD | mapPaymentTypeToEnum() helper |
| OPD Page | OPDTokenPage.tsx | MODIFY | Handle invoice in onSuccess callback |
| Database | migration file | CREATE | Add 3 columns to queues table |

---

## 9. ADVANTAGES OF AUTO-INVOICE AT TOKEN ISSUANCE

1. **Immediate Payment Processing**: Patient payment captured at entry, not at exit
2. **Consultation Fee Collection**: Ensures baseline fee is charged upfront
3. **Insurance Pre-Authorization**: Can validate insurance coverage before consultation
4. **Payment Plan Integration**: Multiple payment methods supported at token level
5. **Audit Trail**: Invoice linked to queue ticket and encounter for full traceability
6. **Reconciliation**: Encounter completion automatically triggered when invoice paid
7. **Reporting**: Revenue can be tracked from token issuance, not just payment
8. **Reduced Bad Debt**: Payment commitment made earlier in patient journey

