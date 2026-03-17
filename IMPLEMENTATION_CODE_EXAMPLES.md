# Implementation Code Examples: Auto-Invoice at Token Issuance

## 1. BACKEND: Update Queue Entity

**File**: `packages/backend/src/database/entities/queue.entity.ts`

```typescript
// Add these imports at top
import { PaymentType } from './invoice.entity';

// Add these columns to Queue class (around line 200)
export class Queue extends BaseEntity {
  // ... existing fields ...
  
  // NEW FIELDS FOR BILLING:
  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
    nullable: true,
  })
  paymentType: PaymentType;

  @Column({ name: 'initial_invoice_id', nullable: true })
  initialInvoiceId: string;

  @Column({
    name: 'consultation_fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consultationFeeAmount: number;

  // ... rest of existing fields ...
}
```

---

## 2. BACKEND: Update Queue DTO

**File**: `packages/backend/src/modules/queue-management/dto/queue.dto.ts`

```typescript
// Add imports
import { PaymentType } from '../../../database/entities/invoice.entity';

export class CreateQueueDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsEnum(ServicePoint)
  servicePoint: ServicePoint;

  @IsOptional()
  @IsEnum(QueuePriority)
  priority?: QueuePriority;

  @IsOptional()
  @IsString()
  priorityReason?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assignedDoctorId?: string;

  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  @IsOptional()
  @IsString()
  chiefComplaintAtToken?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patientConditionFlags?: string[];

  // NEW BILLING FIELDS:
  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsUUID()
  insurancePolicyId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFeeAmount?: number;

  @IsOptional()
  @IsBoolean()
  autoCreateInvoice?: boolean = true;
}
```

---

## 3. BACKEND: Update Queue Module

**File**: `packages/backend/src/modules/queue-management/queue-management.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue, QueueDisplay } from '../../database/entities/queue.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { QueueManagementService } from './queue-management.service';
import { QueueManagementController } from './queue-management.controller';
import { BillingModule } from '../billing/billing.module'; // ← ADD THIS

@Module({
  imports: [
    TypeOrmModule.forFeature([Queue, QueueDisplay, Encounter, DoctorDuty, AuditLog, SystemSetting]),
    BillingModule, // ← ADD THIS
  ],
  providers: [QueueManagementService],
  controllers: [QueueManagementController],
  exports: [QueueManagementService],
})
export class QueueManagementModule {}
```

---

## 4. BACKEND: Update Queue Service - Add Invoice Creation

**File**: `packages/backend/src/modules/queue-management/queue-management.service.ts`

### 4.1 Add imports at top

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Like } from 'typeorm';
import { Queue, QueueDisplay, QueueStatus, QueuePriority, ServicePoint, VALID_QUEUE_TRANSITIONS, QUEUE_TO_ENCOUNTER_STATUS } from '../../database/entities/queue.entity';
import { Encounter, EncounterType, EncounterStatus } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { PaymentType, ChargeType } from '../../database/entities/invoice.entity'; // ← ADD
import { BillingService } from '../billing/billing.service'; // ← ADD
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, HoldQueueDto, QueueFilterDto, CreateQueueDisplayDto, ServiceConfigDto } from './dto/queue.dto';
import { AfricasTalkingService } from '../integrations/africas-talking.service';

const SERVICE_CONFIG_KEY = 'queue.serviceConfig';
const DEFAULT_CONSULTATION_FEE = 50000;
```

### 4.2 Inject BillingService in constructor

```typescript
@Injectable()
export class QueueManagementService {
  private readonly logger = new Logger(QueueManagementService.name);

  constructor(
    @InjectRepository(Queue)
    private queueRepository: Repository<Queue>,
    @InjectRepository(QueueDisplay)
    private queueDisplayRepository: Repository<QueueDisplay>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(DoctorDuty)
    private doctorDutyRepository: Repository<DoctorDuty>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    private readonly smsService: AfricasTalkingService,
    private readonly billingService: BillingService, // ← ADD THIS
  ) {}

  // ... rest of constructor ...
}
```

### 4.3 Update addToQueue method

Replace the addToQueue method (around line 89) with this updated version:

```typescript
async addToQueue(dto: CreateQueueDto, userId: string, facilityId: string, tenantId?: string): Promise<Queue> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if patient is already in an active queue for today
  const existingQueue = await this.queueRepository.findOne({
    where: {
      patientId: dto.patientId,
      facilityId,
      queueDate: today,
      status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
      ...(tenantId ? { tenantId } : {}),
    },
    relations: ['patient'],
  });

  if (existingQueue) {
    throw new BadRequestException(
      `Patient ${existingQueue.patient?.fullName || ''} is already in queue with token ${existingQueue.ticketNumber}`,
    );
  }

  // Enforce per-service-point capacity limits
  const config = await this.getServiceConfig(facilityId);
  const capacityLimits: Record<string, number> = config.capacityLimits || {};
  const limit = capacityLimits[dto.servicePoint];
  if (limit) {
    const activeCount = await this.queueRepository.count({
      where: {
        facilityId,
        servicePoint: dto.servicePoint as ServicePoint,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
        queueDate: today,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (activeCount >= limit) {
      throw new BadRequestException(
        `Queue at ${dto.servicePoint} is at capacity (${limit} patients). Please try again later or redirect to another service point.`,
      );
    }
  }

  // Resolve priority from condition flags if not explicitly set
  const resolvedPriority = this.resolvePriority(dto.priority, dto.patientConditionFlags, config);

  const ticketNumber = await this.generateTicketNumber(facilityId, dto.servicePoint as ServicePoint, today, tenantId);
  const sequenceNumber = await this.getNextSequenceNumber(facilityId, dto.servicePoint as ServicePoint, today, tenantId);

  // Create encounter for this visit
  const visitNumber = `VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
  const encounter = this.encounterRepository.create({
    visitNumber,
    patientId: dto.patientId,
    facilityId,
    departmentId: dto.departmentId,
    createdById: userId,
    type: EncounterType.OPD,
    status: EncounterStatus.REGISTERED,
    chiefComplaint: dto.chiefComplaintAtToken || 'OPD Visit',
    queueNumber: sequenceNumber,
    ...(tenantId ? { tenantId } : {}),
  });
  const savedEncounter = await this.encounterRepository.save(encounter);

  // ==================== NEW CODE: CREATE INVOICE ====================
  let initialInvoiceId: string | null = null;
  
  if (dto.autoCreateInvoice !== false) {
    try {
      const consultationFee = dto.consultationFeeAmount || DEFAULT_CONSULTATION_FEE;
      const paymentType = dto.paymentType || PaymentType.CASH;
      
      const invoice = await this.billingService.createInvoice(
        {
          patientId: dto.patientId,
          encounterId: savedEncounter.id,
          items: [
            {
              serviceCode: 'OPD-CONSULT',
              description: 'OPD Consultation',
              chargeType: ChargeType.CONSULTATION,
              quantity: 1,
              unitPrice: consultationFee,
            },
          ],
          paymentType,
          insurancePolicyId: dto.insurancePolicyId,
          notes: `Auto-created at token issuance. Ticket: ${ticketNumber}`,
        },
        userId,
        tenantId,
      );
      
      initialInvoiceId = invoice.id;
      this.logger.log(`Invoice ${invoice.invoiceNumber} auto-created for queue token ${ticketNumber}`);
    } catch (error) {
      this.logger.error(`Failed to auto-create invoice for queue ${ticketNumber}:`, error);
      // Log error but don't fail queue creation (invoice can be created manually later)
    }
  }
  // ==================== END NEW CODE ====================

  const queue = this.queueRepository.create({
    ...dto,
    servicePoint: dto.servicePoint as ServicePoint,
    ticketNumber,
    sequenceNumber,
    queueDate: today,
    facilityId,
    createdById: userId,
    encounterId: savedEncounter.id,
    status: QueueStatus.WAITING,
    priority: resolvedPriority,
    visitType: dto.visitType,
    chiefComplaintAtToken: dto.chiefComplaintAtToken,
    patientConditionFlags: dto.patientConditionFlags,
    // NEW FIELDS:
    paymentType: dto.paymentType,
    initialInvoiceId,
    consultationFeeAmount: dto.consultationFeeAmount || DEFAULT_CONSULTATION_FEE,
    ...(tenantId ? { tenantId } : {}),
  });

  queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(facilityId, dto.servicePoint as ServicePoint, today, tenantId);

  const saved = await this.queueRepository.save(queue);

  if (dto.assignedDoctorId) {
    await this.updateDoctorQueueCount(dto.assignedDoctorId, facilityId, tenantId);
  }

  await this.writeAuditLog(saved.id, 'QUEUE_CREATED', userId, null, QueueStatus.WAITING);

  return this.queueRepository.findOne({
    where: { id: saved.id, ...(tenantId ? { tenantId } : {}) },
    relations: ['patient', 'encounter'],
  }) as Promise<Queue>;
}
```

---

## 5. FRONTEND: Update OPDTokenPage

**File**: `packages/frontend/src/pages/OPDTokenPage.tsx`

### 5.1 Add mapping function (insert around line 200)

```typescript
// Map frontend PaymentType to backend PaymentType enum
function mapPaymentTypeToBackend(frontendType: PaymentType): string {
  const mapping: Record<PaymentType, string> = {
    'cash': 'cash',
    'mobile_money': 'cash',  // Treat mobile money as cash payment method
    'card': 'cash',          // Treat card as cash payment method
    'membership': 'membership',
    'insurance': 'insurance',
    'hospital_scheme': 'corporate',
    'staff': 'corporate',
  };
  return mapping[frontendType] || 'cash';
}
```

### 5.2 Update handleIssueToken function (around line 281)

```typescript
const handleIssueToken = () => {
  if (selectedPatient) {
    // Check if biometric verification is required
    if ((paymentType === 'hospital_scheme' || paymentType === 'staff') && !biometricVerified) {
      toast.error('Biometric verification required for scheme/staff payments');
      return;
    }
    
    setError(null);
    
    const selectedDeptName = departments?.find(d => d.id === selectedDepartment)?.name || '';

    // Determine entry service point from visit type (configurable per facility)
    const entryServicePoint = getEntryServicePoint(visitType, serviceConfig);

    // Resolve priority from condition flags
    const resolvedPriority = getPriorityFromFlags(conditionFlags, serviceConfig) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10;

    // ==================== NEW CODE ====================
    // Determine insurance policy ID if insurance payment
    let insurancePolicyId: string | undefined = undefined;
    if (paymentType === 'insurance' && selectedInsurancePolicy) {
      insurancePolicyId = selectedInsurancePolicy;
    }

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
      
      // NEW BILLING FIELDS:
      paymentType: mapPaymentTypeToBackend(paymentType),
      insurancePolicyId,
      consultationFeeAmount: CONSULTATION_FEE,
      autoCreateInvoice: true,
    };
    // ==================== END NEW CODE ====================
    
    issueTokenMutation.mutate(queueData);
  }
};
```

### 5.3 Update mutation success handler (around line 236)

```typescript
const issueTokenMutation = useMutation({
  mutationFn: async (data: CreateQueueEntryDto) => {
    return queueService.addToQueue(data);
  },
  onSuccess: (token) => {
    setIssuedToken(token);
    setError(null);
    
    // ==================== NEW CODE ====================
    // If invoice was auto-created, fetch and display it
    if (token.initialInvoiceId) {
      billingService.invoices.getById(token.initialInvoiceId)
        .then(invoice => {
          // Store for display on receipt
          localStorage.setItem(`invoice_${token.id}`, JSON.stringify(invoice));
          console.log(`Invoice ${invoice.invoiceNumber} auto-created for token ${token.ticketNumber}`);
          toast.success(`Token issued. Invoice: ${invoice.invoiceNumber}`);
        })
        .catch(err => {
          console.error('Failed to fetch auto-created invoice:', err);
        });
    }
    // ==================== END NEW CODE ====================
    
    queryClient.invalidateQueries({ queryKey: ['queue-today'] });
    queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
  },
  onError: (err: Error & { response?: { data?: { message?: string | string[]; error?: string; statusCode?: number } } }) => {
    // ... existing error handling ...
  },
});
```

### 5.4 Update CreateQueueEntryDto type (if in services/queue.ts)

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
  
  // NEW BILLING FIELDS:
  paymentType?: string;        // 'cash' | 'insurance' | 'corporate' | 'membership'
  insurancePolicyId?: string;
  consultationFeeAmount?: number;
  autoCreateInvoice?: boolean;
}
```

---

## 6. DATABASE MIGRATION

**File**: `packages/backend/src/database/migrations/[timestamp]-add-billing-to-queues.ts`

```typescript
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBillingToQueues1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'queues',
      new TableColumn({
        name: 'payment_type',
        type: 'enum',
        enum: ['cash', 'insurance', 'corporate', 'membership'],
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'queues',
      new TableColumn({
        name: 'initial_invoice_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'queues',
      new TableColumn({
        name: 'consultation_fee_amount',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
      }),
    );

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE queues 
      ADD CONSTRAINT fk_queues_invoices_initial_invoice_id 
      FOREIGN KEY (initial_invoice_id) 
      REFERENCES invoices(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('queues', 'consultation_fee_amount');
    await queryRunner.dropColumn('queues', 'initial_invoice_id');
    await queryRunner.dropColumn('queues', 'payment_type');
  }
}
```

---

## 7. TESTING SCENARIOS

### Test Case 1: Cash Payment Token

```typescript
// Frontend sends:
POST /queue
{
  patientId: 'uuid-1',
  servicePoint: 'consultation',
  visitType: 'new_visit',
  paymentType: 'cash',  // ← NEW
  consultationFeeAmount: 50000,  // ← NEW
  autoCreateInvoice: true,  // ← NEW
}

// Backend should:
1. Create Queue entry with payment_type='cash'
2. Create Encounter with status=REGISTERED
3. Create Invoice with paymentType=CASH, totalAmount=50000
4. Return Queue with initialInvoiceId populated

// Frontend should:
1. Show token: ABC-001
2. Show invoice: INV20240115001
3. Amount: 50000
```

### Test Case 2: Insurance Payment Token

```typescript
// Frontend sends:
POST /queue
{
  patientId: 'uuid-2',
  servicePoint: 'consultation',
  paymentType: 'insurance',  // ← NEW
  insurancePolicyId: 'policy-uuid',  // ← NEW
  consultationFeeAmount: 50000,
  autoCreateInvoice: true,
}

// Backend should:
1. Create Invoice with paymentType=INSURANCE
2. Link to insurancePolicyId
3. Status: PENDING (awaiting insurance clearance)

// Frontend should:
1. Show: "Insurance invoice created - awaiting authorization"
```

### Test Case 3: Auto-Create Disabled

```typescript
// Frontend sends:
POST /queue
{
  patientId: 'uuid-3',
  servicePoint: 'consultation',
  autoCreateInvoice: false,  // ← Explicitly disabled
}

// Backend should:
1. Create Queue entry normally
2. NOT create Invoice
3. initialInvoiceId: null

// Manual invoice creation required later
```

### Test Case 4: Payment Recording

```typescript
// After invoice auto-created, cashier records payment:
POST /billing/payments
{
  invoiceId: 'invoice-uuid-from-queue',
  amount: 50000,
  method: 'cash',  // Can be: cash, card, mobile_money, bank_transfer
}

// Backend should:
1. Lock invoice for update
2. Update: amountPaid=50000, balanceDue=0
3. Set status: PAID
4. Update encounter: status=COMPLETED, endTime=now
5. Send SMS/email notification (non-blocking)

// Frontend should:
1. Show receipt number: RCP20240115001
2. Show: "Payment complete - Encounter completed"
```

---

## 8. VALIDATION & ERROR HANDLING

### New Validations to Add

```typescript
// In QueueManagementService.addToQueue()

// 1. If paymentType='INSURANCE', require insurancePolicyId
if (dto.paymentType === PaymentType.INSURANCE && !dto.insurancePolicyId) {
  throw new BadRequestException('Insurance policy ID required for insurance payment type');
}

// 2. Validate consultationFeeAmount if provided
if (dto.consultationFeeAmount !== undefined && dto.consultationFeeAmount < 0) {
  throw new BadRequestException('Consultation fee cannot be negative');
}

// 3. Validate paymentType enum
if (dto.paymentType && !Object.values(PaymentType).includes(dto.paymentType)) {
  throw new BadRequestException(`Invalid payment type: ${dto.paymentType}`);
}
```

---

## 9. ROLLBACK PROCEDURES

If auto-invoice creation fails or needs to be reverted:

```typescript
// In QueueManagementService, wrap in try-catch:
try {
  const invoice = await this.billingService.createInvoice(...);
  initialInvoiceId = invoice.id;
} catch (error) {
  this.logger.error(`Failed to auto-create invoice: ${error.message}`);
  // Queue creation continues without invoice
  // Operator can manually create invoice later
  // Do NOT fail queue creation
}
```

---

## 10. CONFIGURATION - System Settings (Optional)

Add to facility configuration for customizable defaults:

```typescript
// In facility service config (SystemSetting):
{
  key: 'queue.serviceConfig.{facilityId}',
  value: {
    opdEntryPoint: 'triage',
    capacityLimits: {},
    priorityRules: [...],
    triageDispositions: [...],
    // NEW:
    autoCreateInvoiceAtToken: true,
    defaultConsultationFee: 50000,
    autoInvoicePaymentType: 'cash',
  }
}
```

Access in service:
```typescript
const config = await this.getServiceConfig(facilityId);
const autoCreateInvoice = config.autoCreateInvoiceAtToken ?? true;
const defaultFee = config.defaultConsultationFee ?? 50000;
```

