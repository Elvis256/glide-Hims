import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { ImagingModality, ModalityType } from '../../database/entities/imaging-modality.entity';
import { ImagingOrder, ImagingOrderStatus, ImagingPriority } from '../../database/entities/imaging-order.entity';
import { ImagingResult, FindingCategory } from '../../database/entities/imaging-result.entity';
import {
  CreateModalityDto,
  CreateImagingOrderDto,
  ScheduleImagingDto,
  PerformImagingDto,
  CreateImagingResultDto,
} from './dto/radiology.dto';

@Injectable()
export class RadiologyService {
  constructor(
    @InjectRepository(ImagingModality)
    private modalityRepo: Repository<ImagingModality>,
    @InjectRepository(ImagingOrder)
    private orderRepo: Repository<ImagingOrder>,
    @InjectRepository(ImagingResult)
    private resultRepo: Repository<ImagingResult>,
  ) {}

  // ============ MODALITIES ============

  async createModality(dto: CreateModalityDto): Promise<ImagingModality> {
    const modality = this.modalityRepo.create({
      facilityId: dto.facilityId,
      name: dto.name,
      modalityType: dto.modalityType,
      manufacturer: dto.manufacturer,
      model: dto.model,
      location: dto.location,
      isActive: true,
      isAvailable: true,
    });
    return this.modalityRepo.save(modality);
  }

  async getModalities(facilityId: string, options: { type?: ModalityType; active?: boolean }) {
    const where: any = { facilityId };
    if (options.type) where.modalityType = options.type;
    if (options.active !== undefined) where.isActive = options.active;

    return this.modalityRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  // ============ ORDERS ============

  private async generateOrderNumber(facilityId: string): Promise<string> {
    const count = await this.orderRepo.count({ where: { facilityId } });
    const date = new Date();
    return `IMG${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createOrder(dto: CreateImagingOrderDto, userId: string): Promise<ImagingOrder> {
    const orderNumber = await this.generateOrderNumber(dto.facilityId);

    const order = this.orderRepo.create({
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
    });

    return this.orderRepo.save(order);
  }

  async getOrder(id: string): Promise<ImagingOrder> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['patient', 'modality', 'orderedBy', 'performedBy'],
    });
    if (!order) throw new NotFoundException('Imaging order not found');
    return order;
  }

  async getOrders(facilityId: string, options: {
    status?: ImagingOrderStatus;
    modalityId?: string;
    patientId?: string;
    date?: string;
    priority?: ImagingPriority;
  }) {
    const qb = this.orderRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.patient', 'patient')
      .leftJoinAndSelect('order.modality', 'modality')
      .leftJoinAndSelect('order.orderedBy', 'orderedBy')
      .where('order.facilityId = :facilityId', { facilityId });

    if (options.status) {
      qb.andWhere('order.status = :status', { status: options.status });
    }
    if (options.modalityId) {
      qb.andWhere('order.modalityId = :modalityId', { modalityId: options.modalityId });
    }
    if (options.patientId) {
      qb.andWhere('order.patientId = :patientId', { patientId: options.patientId });
    }
    if (options.priority) {
      qb.andWhere('order.priority = :priority', { priority: options.priority });
    }
    if (options.date) {
      const start = new Date(options.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(options.date);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('order.orderedAt BETWEEN :start AND :end', { start, end });
    }

    return qb.orderBy('order.orderedAt', 'DESC').getMany();
  }

  async getWorklist(facilityId: string): Promise<ImagingOrder[]> {
    return this.orderRepo.find({
      where: {
        facilityId,
        status: In([ImagingOrderStatus.ORDERED, ImagingOrderStatus.SCHEDULED, ImagingOrderStatus.IN_PROGRESS]),
      },
      relations: ['patient', 'modality', 'orderedBy'],
      order: {
        priority: 'ASC', // STAT first
        orderedAt: 'ASC',
      },
    });
  }

  async scheduleOrder(id: string, dto: ScheduleImagingDto): Promise<ImagingOrder> {
    const order = await this.getOrder(id);

    if (order.status !== ImagingOrderStatus.ORDERED) {
      throw new BadRequestException('Order must be in ORDERED status to schedule');
    }

    order.scheduledAt = new Date(dto.scheduledAt);
    order.status = ImagingOrderStatus.SCHEDULED;

    return this.orderRepo.save(order);
  }

  async startImaging(id: string, userId: string): Promise<ImagingOrder> {
    const order = await this.getOrder(id);

    if (![ImagingOrderStatus.ORDERED, ImagingOrderStatus.SCHEDULED].includes(order.status)) {
      throw new BadRequestException('Order cannot be started from current status');
    }

    order.status = ImagingOrderStatus.IN_PROGRESS;
    order.performedById = userId;

    return this.orderRepo.save(order);
  }

  async completeImaging(id: string, dto: PerformImagingDto, userId: string): Promise<ImagingOrder> {
    const order = await this.getOrder(id);

    if (order.status !== ImagingOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('Order must be in progress to complete');
    }

    order.status = ImagingOrderStatus.COMPLETED;
    order.performedById = userId;
    order.performedAt = new Date();
    if (dto.technologistNotes) order.technologistNotes = dto.technologistNotes;
    if (dto.accessionNumber) order.accessionNumber = dto.accessionNumber;
    order.imageCount = dto.imageCount || 0;

    return this.orderRepo.save(order);
  }

  async cancelOrder(id: string): Promise<ImagingOrder> {
    const order = await this.getOrder(id);

    if (order.status === ImagingOrderStatus.REPORTED) {
      throw new BadRequestException('Cannot cancel a reported order');
    }

    order.status = ImagingOrderStatus.CANCELLED;
    return this.orderRepo.save(order);
  }

  // ============ RESULTS ============

  async createResult(dto: CreateImagingResultDto, userId: string): Promise<ImagingResult> {
    const order = await this.getOrder(dto.imagingOrderId);

    if (order.status !== ImagingOrderStatus.COMPLETED) {
      throw new BadRequestException('Order must be completed before reporting');
    }

    const existing = await this.resultRepo.findOne({ where: { imagingOrderId: dto.imagingOrderId } });
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
    });

    await this.resultRepo.save(result);

    // Update order status
    order.status = ImagingOrderStatus.REPORTED;
    await this.orderRepo.save(order);

    return result;
  }

  async getResult(orderId: string): Promise<ImagingResult | null> {
    return this.resultRepo.findOne({
      where: { imagingOrderId: orderId },
      relations: ['reportedBy', 'verifiedBy'],
    });
  }

  async getResultsForReview(facilityId: string): Promise<ImagingOrder[]> {
    return this.orderRepo.find({
      where: { facilityId, status: ImagingOrderStatus.COMPLETED },
      relations: ['patient', 'modality', 'performedBy'],
      order: { performedAt: 'ASC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalModalities,
      pendingOrders,
      todayOrders,
      completedPendingReport,
      reportedToday,
    ] = await Promise.all([
      this.modalityRepo.count({ where: { facilityId, isActive: true } }),
      this.orderRepo.count({
        where: {
          facilityId,
          status: In([ImagingOrderStatus.ORDERED, ImagingOrderStatus.SCHEDULED]),
        },
      }),
      this.orderRepo.count({
        where: {
          facilityId,
          orderedAt: Between(today, tomorrow),
        },
      }),
      this.orderRepo.count({
        where: { facilityId, status: ImagingOrderStatus.COMPLETED },
      }),
      this.orderRepo.count({
        where: {
          facilityId,
          status: ImagingOrderStatus.REPORTED,
          orderedAt: Between(today, tomorrow),
        },
      }),
    ]);

    // Get orders by modality type
    const ordersByModality = await this.orderRepo
      .createQueryBuilder('order')
      .select('modality.modalityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .leftJoin('order.modality', 'modality')
      .where('order.facilityId = :facilityId', { facilityId })
      .andWhere('order.orderedAt BETWEEN :today AND :tomorrow', { today, tomorrow })
      .groupBy('modality.modalityType')
      .getRawMany();

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

  async getTurnaroundStats(facilityId: string, startDate: string, endDate: string) {
    const orders = await this.orderRepo.find({
      where: {
        facilityId,
        status: ImagingOrderStatus.REPORTED,
        orderedAt: Between(new Date(startDate), new Date(endDate)),
      },
    });

    if (orders.length === 0) {
      return { avgOrderToComplete: 0, avgCompleteToReport: 0, totalOrders: 0 };
    }

    let totalOrderToComplete = 0;
    let totalCompleteToReport = 0;
    let countWithPerformed = 0;

    for (const order of orders) {
      if (order.performedAt) {
        const orderToComplete = (order.performedAt.getTime() - order.orderedAt.getTime()) / (1000 * 60); // minutes
        totalOrderToComplete += orderToComplete;
        countWithPerformed++;
      }
    }

    return {
      avgOrderToComplete: countWithPerformed > 0 ? Math.round(totalOrderToComplete / countWithPerformed) : 0,
      totalOrders: orders.length,
    };
  }
}
