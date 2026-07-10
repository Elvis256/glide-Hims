import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, DataSource } from 'typeorm';
import { ImagingModality, ModalityType } from '../../database/entities/imaging-modality.entity';
import {
  ImagingOrder,
  ImagingOrderStatus,
  ImagingPriority,
} from '../../database/entities/imaging-order.entity';
import { ImagingResult, FindingCategory } from '../../database/entities/imaging-result.entity';
import {
  CreateModalityDto,
  CreateImagingOrderDto,
  ScheduleImagingDto,
  PerformImagingDto,
  CreateImagingResultDto,
} from './dto/radiology.dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FinanceService } from '../finance/finance.service';
import { CriticalResultsService } from '../critical-results/critical-results.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

@Injectable()
export class RadiologyService {
  private readonly logger = new Logger(RadiologyService.name);

  constructor(
    @InjectRepository(ImagingModality)
    private modalityRepo: Repository<ImagingModality>,
    @InjectRepository(ImagingOrder)
    private orderRepo: Repository<ImagingOrder>,
    @InjectRepository(ImagingResult)
    private resultRepo: Repository<ImagingResult>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => InAppNotificationsService))
    private inAppNotificationsService: InAppNotificationsService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    private criticalResultsService: CriticalResultsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ============ MODALITIES ============

  async createModality(dto: CreateModalityDto, tenantId?: string): Promise<ImagingModality> {
    const modality = this.modalityRepo.create({
      facilityId: dto.facilityId,
      name: dto.name,
      modalityType: dto.modalityType,
      manufacturer: dto.manufacturer,
      model: dto.model,
      location: dto.location,
      isActive: true,
      isAvailable: true,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.modalityRepo.save(modality);
  }

  async getModalities(
    facilityId: string,
    options: { type?: ModalityType; active?: boolean },
    tenantId?: string,
  ) {
    const where: any = { facilityId };
    if (options.type) where.modalityType = options.type;
    if (options.active !== undefined) where.isActive = options.active;
    if (tenantId) where.tenantId = tenantId;

    return this.modalityRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  // ============ ORDERS ============

  async createOrder(
    dto: CreateImagingOrderDto,
    userId: string,
    tenantId?: string,
  ): Promise<ImagingOrder> {
    return this.dataSource.transaction(async (manager) => {
      // Generate order number with pessimistic lock
      const date = new Date();
      const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Count this month's orders with lock to prevent race conditions
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const count = await manager
        .createQueryBuilder(ImagingOrder, 'imgOrder')
        .setLock('pessimistic_write')
        .where('imgOrder.facilityId = :facilityId', { facilityId: dto.facilityId })
        .andWhere('imgOrder.createdAt >= :start AND imgOrder.createdAt < :end', {
          start: monthStart,
          end: monthEnd,
        })
        .getCount();

      const orderNumber = `IMG${yearMonth}${String(count + 1).padStart(5, '0')}`;

      const order = manager.create(ImagingOrder, {
        orderNumber,
        facilityId: dto.facilityId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        modalityId: dto.modalityId,
        studyType: dto.studyType,
        bodyPart: dto.bodyPart,
        clinicalHistory: dto.clinicalHistory,
        clinicalIndication: dto.clinicalIndication,
        priority: dto.priority || ImagingPriority.ROUTINE,
        status: ImagingOrderStatus.ORDERED,
        orderedById: userId,
        orderedAt: new Date(),
        ...(tenantId ? { tenantId } : {}),
      });

      const savedOrder = await manager.save(order);

      this.logger.log(
        `Imaging order created: ${orderNumber} for patient ${dto.patientId} by user ${userId}`,
      );

      this.auditLogService
        .log({
          action: 'CREATE_IMAGING_ORDER',
          entityType: 'ImagingOrder',
          entityId: savedOrder.id,
          userId,
          tenantId,
          newValue: {
            orderNumber,
            studyType: dto.studyType,
            patientId: dto.patientId,
            status: ImagingOrderStatus.ORDERED,
          },
        })
        .catch(() => {});

      return savedOrder;
    });
  }

  async getOrder(id: string, tenantId?: string): Promise<ImagingOrder> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const order = await this.orderRepo.findOne({
      where,
      relations: ['patient', 'modality', 'orderedBy', 'performedBy'],
    });
    if (!order) throw new NotFoundException('Imaging order not found');
    return order;
  }

  async getOrders(
    facilityId: string,
    options: {
      status?: ImagingOrderStatus;
      modalityId?: string;
      patientId?: string;
      date?: string;
      priority?: ImagingPriority;
    },
    tenantId?: string,
  ) {
    const qb = this.orderRepo
      .createQueryBuilder('imgOrder')
      .leftJoinAndSelect('imgOrder.patient', 'patient')
      .leftJoinAndSelect('imgOrder.modality', 'modality')
      .leftJoinAndSelect('imgOrder.orderedBy', 'orderedBy')
      .where('imgOrder.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      qb.andWhere('imgOrder.tenantId = :tenantId', { tenantId });
    }

    if (options.status) {
      qb.andWhere('imgOrder.status = :status', { status: options.status });
    }
    if (options.modalityId) {
      qb.andWhere('imgOrder.modalityId = :modalityId', { modalityId: options.modalityId });
    }
    if (options.patientId) {
      qb.andWhere('imgOrder.patientId = :patientId', { patientId: options.patientId });
    }
    if (options.priority) {
      qb.andWhere('imgOrder.priority = :priority', { priority: options.priority });
    }
    if (options.date) {
      const start = new Date(options.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(options.date);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('imgOrder.orderedAt BETWEEN :start AND :end', { start, end });
    }

    return qb.orderBy('imgOrder.orderedAt', 'DESC').getMany();
  }

  async getWorklist(facilityId: string, tenantId?: string): Promise<ImagingOrder[]> {
    const where: any = {
      facilityId,
      status: In([
        ImagingOrderStatus.ORDERED,
        ImagingOrderStatus.SCHEDULED,
        ImagingOrderStatus.IN_PROGRESS,
      ]),
    };
    if (tenantId) where.tenantId = tenantId;
    return this.orderRepo.find({
      where,
      relations: ['patient', 'modality', 'orderedBy'],
      order: {
        priority: 'ASC', // STAT first
        orderedAt: 'ASC',
      },
    });
  }

  async scheduleOrder(
    id: string,
    dto: ScheduleImagingDto,
    tenantId?: string,
  ): Promise<ImagingOrder> {
    const order = await this.getOrder(id, tenantId);

    if (order.status !== ImagingOrderStatus.ORDERED) {
      throw new BadRequestException('Order must be in ORDERED status to schedule');
    }

    order.scheduledAt = new Date(dto.scheduledAt);
    const oldStatus = order.status;
    order.status = ImagingOrderStatus.SCHEDULED;

    const saved = await this.orderRepo.save(order);

    this.auditLogService
      .log({
        action: 'SCHEDULE_IMAGING',
        entityType: 'ImagingOrder',
        entityId: id,
        tenantId,
        oldValue: { status: oldStatus },
        newValue: { status: ImagingOrderStatus.SCHEDULED, scheduledAt: dto.scheduledAt },
      })
      .catch(() => {});

    return saved;
  }

  async startImaging(id: string, userId: string, tenantId?: string): Promise<ImagingOrder> {
    const order = await this.getOrder(id, tenantId);

    if (![ImagingOrderStatus.ORDERED, ImagingOrderStatus.SCHEDULED].includes(order.status)) {
      throw new BadRequestException('Order cannot be started from current status');
    }

    order.status = ImagingOrderStatus.IN_PROGRESS;
    order.performedById = userId;

    const oldStatus = order.status;
    const savedOrder = await this.orderRepo.save(order);
    this.logger.log(`Imaging started: ${order.orderNumber} by user ${userId}`);

    this.auditLogService
      .log({
        action: 'START_IMAGING',
        entityType: 'ImagingOrder',
        entityId: id,
        userId,
        tenantId,
        oldValue: { status: oldStatus },
        newValue: { status: ImagingOrderStatus.IN_PROGRESS },
      })
      .catch(() => {});

    return savedOrder;
  }

  async completeImaging(
    id: string,
    dto: PerformImagingDto,
    userId: string,
    tenantId?: string,
  ): Promise<ImagingOrder> {
    const order = await this.getOrder(id, tenantId);

    if (order.status !== ImagingOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Order must be in progress to complete');
    }

    order.status = ImagingOrderStatus.COMPLETED;
    order.performedById = userId;
    order.performedAt = new Date();
    if (dto.technologistNotes) order.technologistNotes = dto.technologistNotes;
    if (dto.accessionNumber) order.accessionNumber = dto.accessionNumber;
    order.imageCount = dto.imageCount || 0;

    const savedOrder = await this.orderRepo.save(order);
    this.logger.log(
      `Imaging completed: ${order.orderNumber} by user ${userId}, images: ${order.imageCount}`,
    );

    this.auditLogService
      .log({
        action: 'COMPLETE_IMAGING',
        entityType: 'ImagingOrder',
        entityId: id,
        userId,
        tenantId,
        oldValue: { status: ImagingOrderStatus.IN_PROGRESS },
        newValue: { status: ImagingOrderStatus.COMPLETED, imageCount: order.imageCount },
      })
      .catch(() => {});

    return savedOrder;
  }

  async cancelOrder(id: string, userId?: string, tenantId?: string): Promise<ImagingOrder> {
    const order = await this.getOrder(id, tenantId);

    if (order.status === ImagingOrderStatus.REPORTED) {
      throw new BadRequestException('Cannot cancel a reported order');
    }

    order.status = ImagingOrderStatus.CANCELLED;
    const savedOrder = await this.orderRepo.save(order);
    this.logger.warn(
      `Imaging order cancelled: ${order.orderNumber} by user ${userId || 'unknown'}`,
    );
    return savedOrder;
  }

  // ============ RESULTS ============

  async createResult(
    dto: CreateImagingResultDto,
    userId: string,
    tenantId?: string,
  ): Promise<ImagingResult> {
    const order = await this.getOrder(dto.imagingOrderId, tenantId);

    if (order.status !== ImagingOrderStatus.COMPLETED) {
      throw new BadRequestException('Order must be completed before reporting');
    }

    const existing = await this.resultRepo.findOne({
      where: { imagingOrderId: dto.imagingOrderId, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) {
      throw new BadRequestException('Result already exists for this order');
    }

    const result = this.resultRepo.create({
      imagingOrderId: dto.imagingOrderId,
      findings: dto.findings,
      impression: dto.impression,
      recommendations: dto.recommendations,
      findingCategory: dto.findingCategory || FindingCategory.NORMAL,
      isCritical: dto.isCritical || false,
      reportedById: userId,
      reportedAt: new Date(),
      ...(tenantId ? { tenantId } : {}),
    });

    await this.resultRepo.save(result);

    // Update order status
    order.status = ImagingOrderStatus.REPORTED;
    await this.orderRepo.save(order);

    this.logger.log(
      `Imaging result created for order ${order.orderNumber} by user ${userId}${dto.isCritical ? ' [CRITICAL]' : ''}`,
    );

    this.auditLogService
      .log({
        action: 'CREATE_IMAGING_RESULT',
        entityType: 'ImagingResult',
        entityId: result.id,
        userId,
        tenantId,
        newValue: {
          orderId: order.id,
          isCritical: dto.isCritical,
          findingCategory: dto.findingCategory,
        },
      })
      .catch(() => {});

    // Auto-post GL entry: DR Accounts Receivable, CR Radiology Revenue
    if (order.facilityId) {
      const amount = Number(order.price || 0);
      if (amount > 0) {
        this.financeService
          .autoPostRadiologyJournal(
            {
              facilityId: order.facilityId,
              orderNumber: order.orderNumber || order.id,
              amount,
              userId: 'system',
            },
            tenantId,
          )
          .catch((err) =>
            this.logger.warn(`GL auto-post failed for radiology ${order.id}: ${err.message}`),
          );
      } else {
        this.logger.debug(
          `GL auto-post skipped for radiology order ${order.orderNumber}: no price set`,
        );
      }
    }

    // Notify ordering doctor
    try {
      const fullOrder = await this.orderRepo.findOne({
        where: { id: dto.imagingOrderId, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'facility'],
      });
      if (order.orderedById) {
        await this.inAppNotificationsService.notifyRadiologyResultReady(
          order.orderedById,
          fullOrder?.patient?.fullName || 'Patient',
          order.studyType || 'Imaging',
          order.id,
          order.facilityId,
          tenantId,
        );
      }

      // Notify patient via SMS (fire-and-forget; suppressed for critical findings to avoid alarm)
      const patient = fullOrder?.patient;
      if (patient && order.facilityId && !dto.isCritical) {
        const fname = String(patient.fullName || 'patient').split(' ')[0];
        const facName = fullOrder?.facility?.name || 'the facility';
        const study = order.studyType || 'imaging';
        const msg =
          `Hello ${fname}, your ${study} results from ${facName} are ready. ` +
          `Please contact the facility or check your patient portal.`;
        this.notificationsService
          .sendSmsToPatient({ patient, facilityId: order.facilityId, message: msg, tenantId })
          .catch((e) => this.logger.warn(`Patient radiology-ready SMS failed: ${e.message}`));
      }
    } catch (e) {
      this.logger.warn(`Failed to send radiology notification: ${e.message}`);
    }

    // Closed-loop critical-result acknowledgement (radiology)
    try {
      const isCrit = dto.isCritical || dto.findingCategory === FindingCategory.CRITICAL;
      const isAbnormal = dto.findingCategory === FindingCategory.ABNORMAL;
      if ((isCrit || isAbnormal) && order.orderedById) {
        await this.criticalResultsService.flag({
          resourceType: 'radiology',
          resourceId: result.id,
          orderId: order.id,
          patientId: order.patientId,
          encounterId: order.encounterId,
          severity: isCrit ? 'critical' : 'abnormal',
          summary:
            `${order.studyType || 'Imaging'}: ${dto.impression || dto.findings || 'Critical finding'}`.slice(
              0,
              500,
            ),
          flaggedById: userId,
          assignedToId: order.orderedById,
          tenantId,
        });
        if (isCrit) {
          result.criticalNotified = true;
          result.criticalNotifiedAt = new Date();
          await this.resultRepo.save(result);
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to flag critical radiology result: ${e.message}`);
    }

    return result;
  }

  async getResult(orderId: string, tenantId?: string): Promise<ImagingResult | null> {
    return this.resultRepo.findOne({
      where: { imagingOrderId: orderId, ...(tenantId ? { tenantId } : {}) },
      relations: ['reportedBy', 'verifiedBy'],
    });
  }

  async getResultsForReview(facilityId: string, tenantId?: string): Promise<ImagingOrder[]> {
    return this.orderRepo.find({
      where: {
        facilityId,
        status: ImagingOrderStatus.COMPLETED,
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['patient', 'modality', 'performedBy'],
      order: { performedAt: 'ASC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string, tenantId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tenantFilter = tenantId ? { tenantId } : {};

    const [totalModalities, pendingOrders, todayOrders, completedPendingReport, reportedToday] =
      await Promise.all([
        this.modalityRepo.count({ where: { facilityId, isActive: true, ...tenantFilter } }),
        this.orderRepo.count({
          where: {
            facilityId,
            status: In([ImagingOrderStatus.ORDERED, ImagingOrderStatus.SCHEDULED]),
            ...tenantFilter,
          },
        }),
        this.orderRepo.count({
          where: {
            facilityId,
            orderedAt: Between(today, tomorrow),
            ...tenantFilter,
          },
        }),
        this.orderRepo.count({
          where: { facilityId, status: ImagingOrderStatus.COMPLETED, ...tenantFilter },
        }),
        this.orderRepo.count({
          where: {
            facilityId,
            status: ImagingOrderStatus.REPORTED,
            orderedAt: Between(today, tomorrow),
            ...tenantFilter,
          },
        }),
      ]);

    // Get orders by modality type
    const ordersByModalityQb = this.orderRepo
      .createQueryBuilder('imgOrder')
      .select('modality.modalityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('imgOrder.modality', 'modality')
      .where('imgOrder.facilityId = :facilityId', { facilityId })
      .andWhere('imgOrder.orderedAt BETWEEN :today AND :tomorrow', { today, tomorrow });

    if (tenantId) {
      ordersByModalityQb.andWhere('imgOrder.tenantId = :tenantId', { tenantId });
    }

    const ordersByModality = await ordersByModalityQb.groupBy('modality.modalityType').getRawMany();

    return {
      totalModalities,
      pendingOrders,
      todayOrders,
      completedPendingReport,
      reportedToday,
      ordersByModality,
    };
  }

  // ============ TURNAROUND TIME ============

  async getTurnaroundStats(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    const orders = await this.orderRepo.find({
      where: {
        facilityId,
        status: ImagingOrderStatus.REPORTED,
        orderedAt: Between(new Date(startDate), new Date(endDate)),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (orders.length === 0) {
      return { avgOrderToComplete: 0, avgCompleteToReport: 0, totalOrders: 0 };
    }

    let totalOrderToComplete = 0;
    const totalCompleteToReport = 0;
    let countWithPerformed = 0;

    for (const order of orders) {
      if (order.performedAt) {
        const orderToComplete =
          (order.performedAt.getTime() - order.orderedAt.getTime()) / (1000 * 60); // minutes
        totalOrderToComplete += orderToComplete;
        countWithPerformed++;
      }
    }

    return {
      avgOrderToComplete:
        countWithPerformed > 0 ? Math.round(totalOrderToComplete / countWithPerformed) : 0,
      totalOrders: orders.length,
    };
  }
}
