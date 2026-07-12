import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, DataSource } from 'typeorm';
import { Order, OrderType, OrderStatus, OrderPriority } from '../../database/entities/order.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Service } from '../../database/entities/service-category.entity';
import { LabTest } from '../../database/entities/lab-test.entity';
import { LabSample } from '../../database/entities/lab-sample.entity';
import { LabResult, ResultStatus } from '../../database/entities/lab-result.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { BillingService } from '../billing/billing.service';
import {
  ImagingOrder,
  ImagingOrderStatus,
  ImagingPriority,
} from '../../database/entities/imaging-order.entity';
import { ImagingModality } from '../../database/entities/imaging-modality.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { QueueManagementService } from '../queue-management/queue-management.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(LabTest)
    private labTestRepository: Repository<LabTest>,
    @InjectRepository(LabSample)
    private labSampleRepository: Repository<LabSample>,
    @InjectRepository(LabResult)
    private labResultRepository: Repository<LabResult>,
    @InjectRepository(ImagingOrder)
    private imagingOrderRepository: Repository<ImagingOrder>,
    @InjectRepository(ImagingModality)
    private imagingModalityRepository: Repository<ImagingModality>,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    @Inject(forwardRef(() => InAppNotificationsService))
    private inAppNotificationsService: InAppNotificationsService,
    private queueManagementService: QueueManagementService,
    private dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async generateOrderNumber(
    orderType: OrderType,
    tenantId: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const prefix =
      orderType === OrderType.LAB
        ? 'LAB'
        : orderType === OrderType.RADIOLOGY
          ? 'RAD'
          : orderType === OrderType.PHARMACY
            ? 'PHM'
            : 'PRC';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Serialize per tenant/type/day: count-based numbering against a UNIQUE
    // column raced under concurrent ordering (and counted without a tenant
    // filter).
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `order_num_${prefix}${dateStr}_${tenantId}`,
    ]);
    const count = await manager
      .createQueryBuilder(Order, 'order')
      .where('order.orderType = :orderType', { orderType })
      .andWhere('order.orderNumber LIKE :pattern', { pattern: `${prefix}${dateStr}%` })
      .andWhere('order.tenant_id = :tenantId', { tenantId })
      .getCount();

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${dateStr}${seq}`;
  }

  async createOrder(dto: CreateOrderDto, userId: string, tenantId?: string): Promise<Order> {
    const tid = requireTenantId(tenantId);
    // Verify encounter exists and get patient info
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId, tenantId: tid },
      relations: ['patient', 'facility'],
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const savedOrder = await this.orderRepository.manager.transaction(async (manager) => {
      const orderNumber = await this.generateOrderNumber(dto.orderType, tid, manager);

      const order = manager.create(Order, {
        ...dto,
        orderNumber,
        orderedById: userId,
        status: OrderStatus.PENDING,
        priority: dto.priority || OrderPriority.ROUTINE,
        tenantId: tid,
      });

      return manager.save(Order, order);
    });

    this.auditLogService
      .log({
        action: 'CREATE_ORDER',
        entityType: 'Order',
        entityId: savedOrder.id,
        userId,
        tenantId,
        newValue: {
          orderNumber: savedOrder.orderNumber,
          orderType: dto.orderType,
          status: OrderStatus.PENDING,
          encounterId: dto.encounterId,
        },
      })
      .catch(() => {});

    // Auto-create imaging_orders record for radiology orders
    if (dto.orderType === OrderType.RADIOLOGY) {
      await this.createImagingOrderFromGenericOrder(savedOrder, encounter, tenantId);
    }

    // Auto-bill: Look up service prices and add to invoice
    if (dto.testCodes && dto.testCodes.length > 0) {
      try {
        const chargeType =
          dto.orderType === OrderType.LAB
            ? 'lab'
            : dto.orderType === OrderType.RADIOLOGY
              ? 'radiology'
              : dto.orderType === OrderType.PHARMACY
                ? 'pharmacy'
                : 'other';

        for (const testCode of dto.testCodes) {
          // Find service by code to get price, fall back to lab_tests price
          const service = await this.serviceRepository.findOne({
            where: { code: testCode.code, tenantId: tid },
          });

          let unitPrice = service?.basePrice ? Number(service.basePrice) : 0;
          let labTestId: string | undefined;

          if (dto.orderType === OrderType.LAB) {
            const labTest = await this.labTestRepository.findOne({
              where: { code: testCode.code, tenantId: tid },
            });
            if (labTest) {
              labTestId = labTest.id;
              if (unitPrice === 0 && labTest.price) unitPrice = Number(labTest.price);
            }
          }

          await this.billingService.addBillableItem(
            {
              encounterId: dto.encounterId,
              patientId: encounter.patientId,
              serviceCode: testCode.code,
              description: testCode.name,
              quantity: 1,
              unitPrice,
              chargeType,
              referenceType: 'order',
              referenceId: savedOrder.id,
              serviceId: service?.id,
              labTestId,
            },
            userId,
            tenantId,
          );
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-bill order ${savedOrder.orderNumber}: ${err.message}`);
      }
    }

    // Notify relevant department
    try {
      const patientName = encounter.patient?.fullName || 'Patient';
      await this.inAppNotificationsService.notifyNewOrder(
        dto.orderType,
        patientName,
        savedOrder.id,
        encounter.facilityId,
      );
    } catch {
      /* non-critical */
    }

    // Move queue to the appropriate service point
    try {
      const servicePointMap: Record<string, string> = {
        [OrderType.LAB]: 'laboratory',
        [OrderType.RADIOLOGY]: 'radiology',
        [OrderType.PHARMACY]: 'pharmacy',
      };
      const targetPoint = servicePointMap[dto.orderType];
      if (targetPoint) {
        await this.queueManagementService.moveToServicePoint(
          dto.encounterId,
          targetPoint,
          `${dto.orderType} order created`,
          tenantId,
        );
      }
    } catch {
      /* non-critical */
    }

    return savedOrder;
  }

  async findAll(params: {
    orderType?: OrderType;
    status?: OrderStatus;
    encounterId?: string;
    facilityId?: string;
    patientId?: string;
    priority?: OrderPriority;
    orderedById?: string;
    excludeReviewed?: boolean;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    tenantId?: string;
  }) {
    const {
      orderType,
      status,
      encounterId,
      facilityId,
      patientId,
      priority,
      orderedById,
      excludeReviewed,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      tenantId,
    } = params;

    const tid = requireTenantId(tenantId);

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('order.orderedBy', 'orderedBy')
      .leftJoinAndSelect('order.completedBy', 'completedBy')
      .leftJoinAndSelect('order.reviewedBy', 'reviewedBy');

    query.andWhere('order.tenant_id = :tenantId', { tenantId: tid });
    if (orderType) {
      query.andWhere('order.orderType = :orderType', { orderType });
    }
    if (status) {
      query.andWhere('order.status = :status', { status });
    }
    if (encounterId) {
      query.andWhere('order.encounterId = :encounterId', { encounterId });
    }
    if (patientId) {
      query.andWhere('encounter.patientId = :patientId', { patientId });
    }
    if (facilityId) {
      query.andWhere('encounter.facilityId = :facilityId', { facilityId });
    }
    if (priority) {
      query.andWhere('order.priority = :priority', { priority });
    }
    if (orderedById) {
      query.andWhere('order.orderedById = :orderedById', { orderedById });
    }
    if (excludeReviewed) {
      // Hide orders the doctor has already acknowledged via /orders/:id/review
      // Used by dashboards that show "needs my attention" lists.
      query.andWhere('order.reviewedAt IS NULL');
    }
    if (startDate) {
      query.andWhere('order.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      query.andWhere('order.createdAt <= :endDate', { endDate });
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount();

    // For lab orders, fetch associated samples and results
    if (orderType === OrderType.LAB && data.length > 0) {
      const orderIds = data.map((o) => o.id);

      // Fetch samples with results for these orders
      const rawParams: any[] = [orderIds];
      let rawSql = `
        SELECT 
          s.id as sample_id,
          s."orderId" as order_id,
          s."sampleNumber",
          s.status as sample_status,
          r.id as result_id,
          r.parameter,
          r.value,
          r."numericValue",
          r.unit,
          r."referenceMin",
          r."referenceMax",
          r."referenceRange",
          r."abnormalFlag",
          r.status as result_status,
          r."validatedAt",
          r."releasedAt"
        FROM lab_samples s
        LEFT JOIN lab_results r ON r."sampleId" = s.id
        WHERE s."orderId" = ANY($1)`;
      rawSql += ` AND s.tenant_id = $${rawParams.length + 1}`;
      rawParams.push(tid);
      rawSql += `
        ORDER BY s."orderId", r.created_at`;
      const samplesWithResults = await this.dataSource.query(rawSql, rawParams);

      // Group results by order
      const resultsByOrder = new Map<string, any[]>();
      for (const row of samplesWithResults) {
        if (!resultsByOrder.has(row.order_id)) {
          resultsByOrder.set(row.order_id, []);
        }
        if (row.result_id) {
          resultsByOrder.get(row.order_id)!.push({
            id: row.result_id,
            parameter: row.parameter,
            value: row.value,
            numericValue: row.numericValue,
            unit: row.unit,
            referenceMin: row.referenceMin,
            referenceMax: row.referenceMax,
            referenceRange: row.referenceRange,
            abnormalFlag: row.abnormalFlag,
            status: row.result_status,
            validatedAt: row.validatedAt,
            releasedAt: row.releasedAt,
            sampleNumber: row.sampleNumber,
            sampleStatus: row.sample_status,
          });
        }
      }

      // Attach results to orders
      for (const order of data) {
        (order as any).labResults = resultsByOrder.get(order.id) || [];
      }
    }

    return { data, total, page, limit };
  }

  async findById(id: string, tenantId?: string): Promise<Order> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const order = await this.orderRepository.findOne({
      where,
      relations: ['encounter', 'encounter.patient', 'orderedBy', 'completedBy'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<Order[]> {
    const tid = requireTenantId(tenantId);
    return this.orderRepository.find({
      where: { encounterId, tenantId: tid },
      relations: ['orderedBy', 'completedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    userId: string,
    tenantId?: string,
  ): Promise<Order> {
    const order = await this.findById(id, tenantId);

    // Use update() to only modify specific fields, avoiding issues with null relations
    const updateData: Partial<Order> = {};

    if (dto.status) {
      // Guard: lab orders cannot be completed without released results
      if (dto.status === OrderStatus.COMPLETED && order.orderType === OrderType.LAB) {
        await this.assertLabResultsReleased(id, tenantId);
      }

      updateData.status = dto.status;

      if (dto.status === OrderStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.completedById = userId;
      }
    }

    if (dto.assignedTo !== undefined) {
      updateData.assignedTo = dto.assignedTo;
    }

    if (dto.notes) {
      updateData.clinicalNotes = order.clinicalNotes
        ? `${order.clinicalNotes}\n\n[Update]: ${dto.notes}`
        : dto.notes;
    }

    const updateWhere: any = { id };
    updateWhere.tenantId = requireTenantId(tenantId);
    await this.orderRepository.update(updateWhere, updateData);

    this.auditLogService
      .log({
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'Order',
        entityId: id,
        userId,
        tenantId,
        oldValue: { status: order.status },
        newValue: { status: dto.status },
      })
      .catch(() => {});

    return this.findById(id, tenantId);
  }

  async startProcessing(id: string, userId: string, tenantId?: string): Promise<Order> {
    const order = await this.findById(id, tenantId);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in pending status');
    }

    order.status = OrderStatus.IN_PROGRESS;
    return this.orderRepository.save(order);
  }

  async completeOrder(
    id: string,
    resultData: any,
    userId: string,
    tenantId?: string,
  ): Promise<Order> {
    const order = await this.findById(id, tenantId);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order is already completed');
    }

    // Guard: lab orders cannot be completed without released results
    if (order.orderType === OrderType.LAB) {
      await this.assertLabResultsReleased(id, tenantId);
    }

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.completedById = userId;

    // Store results in clinical notes or a dedicated field
    if (resultData) {
      const resultSummary =
        typeof resultData === 'string' ? resultData : JSON.stringify(resultData, null, 2);
      order.clinicalNotes = order.clinicalNotes
        ? `${order.clinicalNotes}\n\n[Results]:\n${resultSummary}`
        : `[Results]:\n${resultSummary}`;
    }

    return this.orderRepository.save(order);
  }

  private async assertLabResultsReleased(orderId: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    const samples = await this.labSampleRepository.find({
      where: { orderId, tenantId: tid },
    });
    if (samples.length === 0) {
      throw new BadRequestException('Cannot complete lab order — no samples found');
    }
    const sampleIds = samples.map((s) => s.id);
    const results = await this.labResultRepository.find({
      where: { sampleId: In(sampleIds), tenantId: tid },
    });
    if (results.length === 0) {
      throw new BadRequestException('Cannot complete lab order — no results have been entered');
    }
    const unreleased = results.filter((r) => r.status !== ResultStatus.RELEASED);
    if (unreleased.length > 0) {
      throw new BadRequestException(
        'Cannot complete lab order — all results must be released first',
      );
    }
  }

  async cancelOrder(id: string, reason: string, userId: string, tenantId?: string): Promise<Order> {
    const order = await this.findById(id, tenantId);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed order');
    }

    // Prevent cancellation if samples have been collected
    const collectedSamples = await this.labSampleRepository.count({
      where: { orderId: id },
    });
    if (collectedSamples > 0) {
      throw new BadRequestException(
        'Cannot cancel order: samples have already been collected. Request lab to handle.',
      );
    }

    const oldStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    order.clinicalNotes = order.clinicalNotes
      ? `${order.clinicalNotes}\n\n[Cancelled]: ${reason}`
      : `[Cancelled]: ${reason}`;

    const saved = await this.orderRepository.save(order);

    this.auditLogService
      .log({
        action: 'CANCEL_ORDER',
        entityType: 'Order',
        entityId: id,
        userId,
        tenantId,
        oldValue: { status: oldStatus },
        newValue: { status: OrderStatus.CANCELLED, reason },
      })
      .catch(() => {});

    return saved;
  }

  async reviewOrder(id: string, userId: string, tenantId?: string): Promise<Order> {
    const tid = requireTenantId(tenantId);
    const order = await this.findById(id, tenantId);

    const reviewWhere: any = { id };
    reviewWhere.tenantId = tid;
    await this.orderRepository.update(reviewWhere, {
      reviewedById: userId,
      reviewedAt: new Date(),
    });

    return this.findById(id, tenantId);
  }

  // ============ QUEUE METHODS ============

  async getLabQueue(facilityId: string, tenantId?: string) {
    return this.findAll({
      orderType: OrderType.LAB,
      facilityId,
      status: OrderStatus.PENDING,
      tenantId,
    });
  }

  async getRadiologyQueue(facilityId: string, tenantId?: string) {
    return this.findAll({
      orderType: OrderType.RADIOLOGY,
      facilityId,
      status: OrderStatus.PENDING,
      tenantId,
    });
  }

  // ============ STATS ============

  async getOrderStats(facilityId: string, orderType?: OrderType, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const today = new Date().toISOString().slice(0, 10);

    const baseQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.encounter', 'encounter')
      .where('encounter.facilityId = :facilityId', { facilityId });

    baseQuery.andWhere('order.tenant_id = :tenantId', { tenantId: tid });
    if (orderType) {
      baseQuery.andWhere('order.orderType = :orderType', { orderType });
    }

    const pending = await baseQuery
      .clone()
      .andWhere('order.status = :status', { status: OrderStatus.PENDING })
      .getCount();

    const inProgress = await baseQuery
      .clone()
      .andWhere('order.status = :status', { status: OrderStatus.IN_PROGRESS })
      .getCount();

    const completedToday = await baseQuery
      .clone()
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('DATE(order.completedAt) = :today', { today })
      .getCount();

    const urgent = await baseQuery
      .clone()
      .andWhere('order.priority = :priority', { priority: OrderPriority.URGENT })
      .andWhere('order.status != :completed', { completed: OrderStatus.COMPLETED })
      .getCount();

    const stat = await baseQuery
      .clone()
      .andWhere('order.priority = :priority', { priority: OrderPriority.STAT })
      .andWhere('order.status != :completed', { completed: OrderStatus.COMPLETED })
      .getCount();

    return {
      pending,
      inProgress,
      completedToday,
      urgent,
      stat,
    };
  }

  // Map test code prefixes to modality types
  private readonly testCodeToModality: Record<string, string> = {
    'IMG-XR': 'xray',
    'IMG-US': 'ultrasound',
    'IMG-CT': 'ct',
    'IMG-MR': 'mri',
    'IMG-MG': 'mammography',
    'IMG-FL': 'fluoroscopy',
    'IMG-DX': 'dexa',
    'IMG-EC': 'echocardiogram',
  };

  private async createImagingOrderFromGenericOrder(
    order: Order,
    encounter: Encounter,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    try {
      const testCodes: Array<{ code: string; name: string }> = order.testCodes || [];
      if (!testCodes.length) return;

      for (const test of testCodes) {
        // Determine modality type from test code prefix
        const prefix = test.code?.substring(0, 6);
        const modalityType = this.testCodeToModality[prefix] || 'xray';

        // Find an available modality of this type for the facility
        // ImagingModality is shared reference data without tenantId — no tenant filter needed
        const modality = await this.imagingModalityRepository.findOne({
          where: {
            facilityId: encounter.facilityId,
            modalityType: modalityType as any,
            isActive: true,
          },
        });

        if (!modality) {
          this.logger.warn(
            `No active ${modalityType} modality found for facility ${encounter.facilityId}`,
          );
          continue;
        }

        // Extract body part from test name (e.g., "Ultrasound (Abdomen)" → "Abdomen")
        const bodyPartMatch = test.name?.match(/\(([^)]+)\)/);
        const bodyPart = bodyPartMatch ? bodyPartMatch[1] : undefined;

        const imagingOrder = this.imagingOrderRepository.create({
          facilityId: encounter.facilityId,
          orderNumber: order.orderNumber,
          patientId: encounter.patientId,
          encounterId: encounter.id,
          modalityId: modality.id,
          studyType: test.name || 'General Study',
          bodyPart,
          clinicalIndication: undefined, // Don't copy triage notes; radiologist fills in
          priority: (order.priority === 'stat'
            ? 'stat'
            : order.priority === 'urgent'
              ? 'urgent'
              : 'routine') as ImagingPriority,
          status: ImagingOrderStatus.ORDERED,
          orderedById: order.orderedById,
          orderedAt: order.createdAt || new Date(),
          tenantId: tid,
        });

        await this.imagingOrderRepository.save(imagingOrder);
        this.logger.log(`Created imaging order for ${test.name} (modality: ${modality.name})`);
      }
    } catch (error) {
      this.logger.error(`Failed to create imaging order: ${error.message}`, error.stack);
    }
  }
}
