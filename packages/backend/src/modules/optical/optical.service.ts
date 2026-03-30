import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  EyeExam,
  OpticalPrescription,
  ContactLensPrescription,
  Frame,
  LensProduct,
  SpectacleOrder,
  VisualFieldTest,
} from '../../database/entities/optical.entity';
import {
  CreateEyeExamDto,
  CreateOpticalPrescriptionDto,
  CreateContactLensPrescriptionDto,
  CreateFrameDto,
  UpdateFrameDto,
  CreateLensProductDto,
  UpdateLensProductDto,
  CreateSpectacleOrderDto,
  UpdateOrderStatusDto,
  CreateVisualFieldTestDto,
} from './optical.dto';

@Injectable()
export class OpticalService {
  private readonly logger = new Logger(OpticalService.name);

  constructor(
    @InjectRepository(EyeExam)
    private examRepo: Repository<EyeExam>,
    @InjectRepository(OpticalPrescription)
    private prescriptionRepo: Repository<OpticalPrescription>,
    @InjectRepository(ContactLensPrescription)
    private contactLensRepo: Repository<ContactLensPrescription>,
    @InjectRepository(Frame)
    private frameRepo: Repository<Frame>,
    @InjectRepository(LensProduct)
    private lensRepo: Repository<LensProduct>,
    @InjectRepository(SpectacleOrder)
    private orderRepo: Repository<SpectacleOrder>,
    @InjectRepository(VisualFieldTest)
    private vfRepo: Repository<VisualFieldTest>,
    private dataSource: DataSource,
  ) {}

  // ============ EYE EXAMS ============

  async createExam(
    dto: CreateEyeExamDto,
    examinerId: string,
    tenantId: string,
  ): Promise<EyeExam> {
    const exam = this.examRepo.create({
      ...dto,
      examinerId,
      tenantId,
    });
    return this.examRepo.save(exam);
  }

  async findPatientExams(
    patientId: string,
    tenantId: string,
  ): Promise<EyeExam[]> {
    return this.examRepo.find({
      where: { patientId, tenantId },
      relations: ['examiner'],
      order: { examDate: 'DESC' },
    });
  }

  async getExam(id: string, tenantId: string): Promise<EyeExam> {
    const exam = await this.examRepo.findOne({
      where: { id, tenantId },
      relations: ['patient', 'examiner', 'prescriptions'],
    });
    if (!exam) {
      throw new NotFoundException('Eye exam not found');
    }
    return exam;
  }

  // ============ PRESCRIPTIONS ============

  async createPrescription(
    dto: CreateOpticalPrescriptionDto,
    prescriberId: string,
    tenantId: string,
  ): Promise<OpticalPrescription> {
    // If linking to an exam, verify it exists and belongs to this tenant
    if (dto.examId) {
      const exam = await this.examRepo.findOne({
        where: { id: dto.examId, tenantId },
      });
      if (!exam) {
        throw new NotFoundException('Eye exam not found');
      }
    }

    // Supersede any existing active prescriptions of the same type
    await this.prescriptionRepo.update(
      { patientId: dto.patientId, prescriptionType: dto.prescriptionType, status: 'active', tenantId },
      { status: 'superseded' },
    );

    const prescription = this.prescriptionRepo.create({
      ...dto,
      prescriberId,
      tenantId,
    });
    return this.prescriptionRepo.save(prescription);
  }

  async findPatientPrescriptions(
    patientId: string,
    tenantId: string,
  ): Promise<OpticalPrescription[]> {
    return this.prescriptionRepo.find({
      where: { patientId, tenantId },
      relations: ['prescriber'],
      order: { prescriptionDate: 'DESC' },
    });
  }

  async getActivePrescription(
    patientId: string,
    tenantId: string,
  ): Promise<OpticalPrescription | null> {
    return this.prescriptionRepo.findOne({
      where: { patientId, tenantId, status: 'active' },
      relations: ['prescriber', 'contactLensPrescriptions'],
      order: { prescriptionDate: 'DESC' },
    });
  }

  async createContactLensPrescription(
    dto: CreateContactLensPrescriptionDto,
    tenantId: string,
  ): Promise<ContactLensPrescription> {
    const prescription = await this.prescriptionRepo.findOne({
      where: { id: dto.prescriptionId, tenantId },
    });
    if (!prescription) {
      throw new NotFoundException('Optical prescription not found');
    }
    if (prescription.prescriptionType !== 'contact_lens') {
      throw new BadRequestException('Prescription must be of type contact_lens');
    }

    const cl = this.contactLensRepo.create({
      ...dto,
      tenantId,
    });
    return this.contactLensRepo.save(cl);
  }

  // ============ FRAMES ============

  async createFrame(
    dto: CreateFrameDto,
    tenantId: string,
  ): Promise<Frame> {
    const frame = this.frameRepo.create({
      ...dto,
      tenantId,
    });
    return this.frameRepo.save(frame);
  }

  async findAllFrames(
    tenantId: string,
    filters?: { brand?: string; material?: string; gender?: string; frameType?: string },
  ): Promise<Frame[]> {
    const qb = this.frameRepo.createQueryBuilder('frame')
      .where('frame.tenantId = :tenantId', { tenantId })
      .andWhere('frame.isActive = :active', { active: true });

    if (filters?.brand) {
      qb.andWhere('frame.brand ILIKE :brand', { brand: `%${filters.brand}%` });
    }
    if (filters?.material) {
      qb.andWhere('frame.material = :material', { material: filters.material });
    }
    if (filters?.gender) {
      qb.andWhere('frame.gender = :gender', { gender: filters.gender });
    }
    if (filters?.frameType) {
      qb.andWhere('frame.frameType = :frameType', { frameType: filters.frameType });
    }

    qb.orderBy('frame.brand', 'ASC').addOrderBy('frame.model', 'ASC');
    return qb.getMany();
  }

  async updateFrame(
    id: string,
    dto: UpdateFrameDto,
    tenantId: string,
  ): Promise<Frame> {
    const frame = await this.frameRepo.findOne({
      where: { id, tenantId },
    });
    if (!frame) {
      throw new NotFoundException('Frame not found');
    }
    Object.assign(frame, dto);
    return this.frameRepo.save(frame);
  }

  async adjustFrameStock(
    id: string,
    delta: number,
    tenantId: string,
  ): Promise<Frame> {
    const frame = await this.frameRepo.findOne({
      where: { id, tenantId },
    });
    if (!frame) {
      throw new NotFoundException('Frame not found');
    }
    frame.currentStock = Math.max(0, frame.currentStock + delta);
    return this.frameRepo.save(frame);
  }

  // ============ LENSES ============

  async createLensProduct(
    dto: CreateLensProductDto,
    tenantId: string,
  ): Promise<LensProduct> {
    const lens = this.lensRepo.create({
      ...dto,
      tenantId,
    });
    return this.lensRepo.save(lens);
  }

  async findAllLenses(
    tenantId: string,
    filters?: { lensType?: string; material?: string },
  ): Promise<LensProduct[]> {
    const qb = this.lensRepo.createQueryBuilder('lens')
      .where('lens.tenantId = :tenantId', { tenantId })
      .andWhere('lens.isActive = :active', { active: true });

    if (filters?.lensType) {
      qb.andWhere('lens.lensType = :lensType', { lensType: filters.lensType });
    }
    if (filters?.material) {
      qb.andWhere('lens.material = :material', { material: filters.material });
    }

    qb.orderBy('lens.name', 'ASC');
    return qb.getMany();
  }

  async updateLensProduct(
    id: string,
    dto: UpdateLensProductDto,
    tenantId: string,
  ): Promise<LensProduct> {
    const lens = await this.lensRepo.findOne({
      where: { id, tenantId },
    });
    if (!lens) {
      throw new NotFoundException('Lens product not found');
    }
    Object.assign(lens, dto);
    return this.lensRepo.save(lens);
  }

  // ============ ORDERS ============

  async createOrder(
    dto: CreateSpectacleOrderDto,
    tenantId: string,
  ): Promise<SpectacleOrder> {
    return this.dataSource.transaction(async (manager) => {
      // Verify prescription exists
      const prescription = await manager.findOne(OpticalPrescription, {
        where: { id: dto.prescriptionId, tenantId },
      });
      if (!prescription) {
        throw new NotFoundException('Prescription not found');
      }

      // Auto-generate order number
      const count = await manager.count(SpectacleOrder, { where: { tenantId } });
      const orderNumber = `OPT-${String(count + 1).padStart(6, '0')}`;

      // Calculate total
      const framePrice = dto.framePrice || 0;
      const lensPrice = dto.lensPrice || 0;
      const coatingPrice = dto.coatingPrice || 0;
      const fittingCharge = dto.fittingCharge || 0;
      const discount = dto.discount || 0;
      const totalAmount = framePrice + lensPrice + coatingPrice + fittingCharge - discount;

      // Decrement frame stock if frame selected
      if (dto.frameId) {
        const frame = await manager.findOne(Frame, {
          where: { id: dto.frameId, tenantId },
        });
        if (!frame) {
          throw new NotFoundException('Frame not found');
        }
        if (frame.currentStock <= 0) {
          throw new BadRequestException('Frame out of stock');
        }
        frame.currentStock -= 1;
        await manager.save(Frame, frame);
      }

      // Decrement lens stock if lens selected
      if (dto.lensId) {
        const lens = await manager.findOne(LensProduct, {
          where: { id: dto.lensId, tenantId },
        });
        if (!lens) {
          throw new NotFoundException('Lens product not found');
        }
        if (lens.currentStock <= 0) {
          throw new BadRequestException('Lens product out of stock');
        }
        lens.currentStock -= 1;
        await manager.save(LensProduct, lens);
      }

      const order = manager.create(SpectacleOrder, {
        ...dto,
        orderNumber,
        totalAmount,
        tenantId,
      });
      return manager.save(SpectacleOrder, order);
    });
  }

  async findAllOrders(
    tenantId: string,
    status?: string,
  ): Promise<SpectacleOrder[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }
    return this.orderRepo.find({
      where,
      relations: ['patient', 'prescription', 'frame', 'lens'],
      order: { orderDate: 'DESC' },
    });
  }

  async findPatientOrders(
    patientId: string,
    tenantId: string,
  ): Promise<SpectacleOrder[]> {
    return this.orderRepo.find({
      where: { patientId, tenantId },
      relations: ['prescription', 'frame', 'lens'],
      order: { orderDate: 'DESC' },
    });
  }

  async updateOrderStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    tenantId: string,
  ): Promise<SpectacleOrder> {
    const order = await this.orderRepo.findOne({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = dto.status;
    if (dto.notes) {
      order.notes = dto.notes;
    }
    if (dto.status === 'delivered') {
      order.deliveredAt = new Date();
    }
    return this.orderRepo.save(order);
  }

  async getOrderStats(tenantId: string): Promise<Record<string, any>> {
    const statuses = ['ordered', 'in_lab', 'lens_cutting', 'fitting', 'quality_check', 'ready', 'delivered', 'returned'];
    const counts: Record<string, number> = {};

    for (const status of statuses) {
      counts[status] = await this.orderRepo.count({
        where: { tenantId, status },
      });
    }

    const totalRevenue = await this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'total')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.status = :status', { status: 'delivered' })
      .getRawOne();

    return {
      statusCounts: counts,
      totalDeliveredRevenue: Number(totalRevenue?.total || 0),
    };
  }

  // ============ VISUAL FIELD TESTS ============

  async createTest(
    dto: CreateVisualFieldTestDto,
    examinerId: string,
    tenantId: string,
  ): Promise<VisualFieldTest> {
    const test = this.vfRepo.create({
      ...dto,
      examinerId,
      tenantId,
    });
    return this.vfRepo.save(test);
  }

  async findPatientTests(
    patientId: string,
    tenantId: string,
    eye?: string,
  ): Promise<VisualFieldTest[]> {
    const where: any = { patientId, tenantId };
    if (eye) {
      where.eye = eye;
    }
    return this.vfRepo.find({
      where,
      relations: ['examiner'],
      order: { testDate: 'DESC' },
    });
  }

  async getTest(id: string, tenantId: string): Promise<VisualFieldTest> {
    const test = await this.vfRepo.findOne({
      where: { id, tenantId },
      relations: ['patient', 'examiner'],
    });
    if (!test) {
      throw new NotFoundException('Visual field test not found');
    }
    return test;
  }

  async compareTests(
    patientId: string,
    eye: string,
    tenantId: string,
  ): Promise<VisualFieldTest[]> {
    return this.vfRepo.find({
      where: { patientId, eye, tenantId },
      relations: ['examiner'],
      order: { testDate: 'DESC' },
      take: 2,
    });
  }
}
