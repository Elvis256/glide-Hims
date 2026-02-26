import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In, DataSource } from 'typeorm';
import { Order, OrderType, OrderStatus, OrderPriority } from '../../database/entities/order.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Service } from '../../database/entities/service-category.entity';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { BillingService } from '../billing/billing.service';
import { ImagingOrder, ImagingOrderStatus, ImagingPriority } from '../../database/entities/imaging-order.entity';
import { ImagingModality } from '../../database/entities/imaging-modality.entity';

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
    @InjectRepository(ImagingOrder)
    private imagingOrderRepository: Repository<ImagingOrder>,
    @InjectRepository(ImagingModality)
    private imagingModalityRepository: Repository<ImagingModality>,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    private dataSource: DataSource,
  ) {}

  private async generateOrderNumber(orderType: OrderType): Promise<string> {
    const prefix = orderType === OrderType.LAB ? 'LAB' : 
                   orderType === OrderType.RADIOLOGY ? 'RAD' :
                   orderType === OrderType.PHARMACY ? 'PHM' : 'PRC';
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Count orders of this type created today using LIKE pattern match
    const count = await this.orderRepository
      .createQueryBuilder('order')
      .where('order.orderType = :orderType', { orderType })
      .andWhere('order.orderNumber LIKE :pattern', { pattern: `${prefix}${dateStr}%` })
      .getCount();

    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${dateStr}${seq}`;
  }

  async createOrder(dto: CreateOrderDto, userId: string): Promise<Order> {
    // Verify encounter exists and get patient info
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId },
      relations: ['patient'],
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const orderNumber = await this.generateOrderNumber(dto.orderType);

    const order = this.orderRepository.create({
      ...dto,
      orderNumber,
      orderedById: userId,
      status: OrderStatus.PENDING,
      priority: dto.priority || OrderPriority.ROUTINE,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Auto-create imaging_orders record for radiology orders
    if (dto.orderType === OrderType.RADIOLOGY) {
      await this.createImagingOrderFromGenericOrder(savedOrder, encounter);
    }

    // Auto-bill: Look up service prices and add to invoice
    if (dto.testCodes && dto.testCodes.length > 0) {
      for (const testCode of dto.testCodes) {
        // Find service by code to get price
        const service = await this.serviceRepository.findOne({
          where: { code: testCode.code },
        });

        const unitPrice = service?.basePrice ? Number(service.basePrice) : 0;

        if (unitPrice > 0) {
          await this.billingService.addBillableItem({
            encounterId: dto.encounterId,
            patientId: encounter.patientId,
            serviceCode: testCode.code,
            description: testCode.name,
            quantity: 1,
            unitPrice,
            referenceType: 'order',
            referenceId: savedOrder.id,
          }, userId);
        }
      }
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
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      orderType,
      status,
      encounterId,
      facilityId,
      patientId,
      priority,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;

    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('order.orderedBy', 'orderedBy')
      .leftJoinAndSelect('order.completedBy', 'completedBy')
      .leftJoinAndSelect('order.reviewedBy', 'reviewedBy');

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
      const orderIds = data.map(o => o.id);
      
      // Fetch samples with results for these orders
      const samplesWithResults = await this.dataSource.query(`
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
        WHERE s."orderId" = ANY($1)
        ORDER BY s."orderId", r.created_at
      `, [orderIds]);

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

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['encounter', 'encounter.patient', 'orderedBy', 'completedBy'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findByEncounter(encounterId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { encounterId },
      relations: ['orderedBy', 'completedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, userId: string): Promise<Order> {
    const order = await this.findById(id);

    // Use update() to only modify specific fields, avoiding issues with null relations
    const updateData: Partial<Order> = {};

    if (dto.status) {
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

    await this.orderRepository.update(id, updateData);
    return this.findById(id);
  }

  async startProcessing(id: string, userId: string): Promise<Order> {
    const order = await this.findById(id);
    
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in pending status');
    }

    order.status = OrderStatus.IN_PROGRESS;
    return this.orderRepository.save(order);
  }

  async completeOrder(id: string, resultData: any, userId: string): Promise<Order> {
    const order = await this.findById(id);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Order is already completed');
    }

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.completedById = userId;

    // Store results in clinical notes or a dedicated field
    if (resultData) {
      const resultSummary = typeof resultData === 'string' 
        ? resultData 
        : JSON.stringify(resultData, null, 2);
      order.clinicalNotes = order.clinicalNotes
        ? `${order.clinicalNotes}\n\n[Results]:\n${resultSummary}`
        : `[Results]:\n${resultSummary}`;
    }

    return this.orderRepository.save(order);
  }

  async cancelOrder(id: string, reason: string, userId: string): Promise<Order> {
    const order = await this.findById(id);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed order');
    }

    order.status = OrderStatus.CANCELLED;
    order.clinicalNotes = order.clinicalNotes
      ? `${order.clinicalNotes}\n\n[Cancelled]: ${reason}`
      : `[Cancelled]: ${reason}`;

    return this.orderRepository.save(order);
  }

  async reviewOrder(id: string, userId: string): Promise<Order> {
    const order = await this.findById(id);

    await this.orderRepository.update(id, {
      reviewedById: userId,
      reviewedAt: new Date(),
    });

    return this.findById(id);
  }

  // ============ QUEUE METHODS ============

  async getLabQueue(facilityId: string) {
    return this.findAll({
      orderType: OrderType.LAB,
      facilityId,
      status: OrderStatus.PENDING,
    });
  }

  async getRadiologyQueue(facilityId: string) {
    return this.findAll({
      orderType: OrderType.RADIOLOGY,
      facilityId,
      status: OrderStatus.PENDING,
    });
  }

  // ============ STATS ============

  async getOrderStats(facilityId: string, orderType?: OrderType) {
    const today = new Date().toISOString().slice(0, 10);

    const baseQuery = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.encounter', 'encounter')
      .where('encounter.facilityId = :facilityId', { facilityId });

    if (orderType) {
      baseQuery.andWhere('order.orderType = :orderType', { orderType });
    }

    const pending = await baseQuery.clone()
      .andWhere('order.status = :status', { status: OrderStatus.PENDING })
      .getCount();

    const inProgress = await baseQuery.clone()
      .andWhere('order.status = :status', { status: OrderStatus.IN_PROGRESS })
      .getCount();

    const completedToday = await baseQuery.clone()
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('DATE(order.completedAt) = :today', { today })
      .getCount();

    const urgent = await baseQuery.clone()
      .andWhere('order.priority = :priority', { priority: OrderPriority.URGENT })
      .andWhere('order.status != :completed', { completed: OrderStatus.COMPLETED })
      .getCount();

    const stat = await baseQuery.clone()
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

  private async createImagingOrderFromGenericOrder(order: Order, encounter: Encounter): Promise<void> {
    try {
      const testCodes: Array<{ code: string; name: string }> = order.testCodes || [];
      if (!testCodes.length) return;

      for (const test of testCodes) {
        // Determine modality type from test code prefix
        const prefix = test.code?.substring(0, 6);
        const modalityType = this.testCodeToModality[prefix] || 'xray';

        // Find an available modality of this type for the facility
        const modality = await this.imagingModalityRepository.findOne({
          where: { facilityId: encounter.facilityId, modalityType: modalityType as any, isActive: true },
        });

        if (!modality) {
          this.logger.warn(`No active ${modalityType} modality found for facility ${encounter.facilityId}`);
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
          priority: (order.priority === 'stat' ? 'stat' : order.priority === 'urgent' ? 'urgent' : 'routine') as ImagingPriority,
          status: ImagingOrderStatus.ORDERED,
          orderedById: order.orderedById,
          orderedAt: order.createdAt || new Date(),
        });

        await this.imagingOrderRepository.save(imagingOrder);
        this.logger.log(`Created imaging order for ${test.name} (modality: ${modality.name})`);
      }
    } catch (error) {
      this.logger.error(`Failed to create imaging order: ${error.message}`, error.stack);
    }
  }
}
