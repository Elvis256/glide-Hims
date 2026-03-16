import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { Referral, ReferralStatus } from '../../database/entities/referral.entity';
import { CreateReferralDto, AcceptReferralDto, RejectReferralDto, CompleteReferralDto, ReferralFilterDto } from './dto/referral.dto';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private referralRepository: Repository<Referral>,
  ) {}

  async create(dto: CreateReferralDto, userId: string, facilityId: string, tenantId?: string): Promise<Referral> {
    const referralNumber = await this.generateReferralNumber(facilityId);
    
    // Calculate expiry date (default 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const referral = this.referralRepository.create({
      ...dto,
      referralNumber,
      fromFacilityId: facilityId,
      referredById: userId,
      expiryDate,
      status: ReferralStatus.PENDING,
    });
    if (tenantId) (referral as any).tenantId = tenantId;

    return this.referralRepository.save(referral);
  }

  async findAll(filter: ReferralFilterDto, facilityId: string, tenantId?: string): Promise<Referral[]> {
    const query = this.referralRepository.createQueryBuilder('referral')
      .leftJoinAndSelect('referral.patient', 'patient')
      .leftJoinAndSelect('referral.fromFacility', 'fromFacility')
      .leftJoinAndSelect('referral.toFacility', 'toFacility')
      .leftJoinAndSelect('referral.referredBy', 'referredBy');

    // Filter by facility (either from or to)
    query.andWhere('(referral.from_facility_id = :facilityId OR referral.to_facility_id = :facilityId)', { facilityId });

    if (tenantId) {
      query.andWhere('referral.tenant_id = :tenantId', { tenantId });
    }

    if (filter.status) {
      query.andWhere('referral.status = :status', { status: filter.status });
    }
    if (filter.type) {
      query.andWhere('referral.type = :type', { type: filter.type });
    }
    if (filter.priority) {
      query.andWhere('referral.priority = :priority', { priority: filter.priority });
    }
    if (filter.patientId) {
      query.andWhere('referral.patient_id = :patientId', { patientId: filter.patientId });
    }
    if (filter.fromDate && filter.toDate) {
      query.andWhere('referral.created_at BETWEEN :fromDate AND :toDate', {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      });
    }

    query.orderBy('referral.created_at', 'DESC');

    return query.getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<Referral> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const referral = await this.referralRepository.findOne({
      where,
      relations: ['patient', 'fromFacility', 'toFacility', 'referredBy', 'acceptedBy', 'sourceEncounter', 'destinationEncounter'],
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    return referral;
  }

  async findByPatient(patientId: string, tenantId?: string): Promise<Referral[]> {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;

    return this.referralRepository.find({
      where,
      relations: ['fromFacility', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getIncomingReferrals(facilityId: string, tenantId?: string): Promise<Referral[]> {
    const where: any = { toFacilityId: facilityId, status: ReferralStatus.PENDING };
    if (tenantId) where.tenantId = tenantId;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'fromFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingReferrals(facilityId: string, tenantId?: string): Promise<Referral[]> {
    const where: any = { fromFacilityId: facilityId };
    if (tenantId) where.tenantId = tenantId;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async accept(id: string, dto: AcceptReferralDto, userId: string, tenantId?: string): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('Only pending referrals can be accepted');
    }

    referral.status = ReferralStatus.ACCEPTED;
    referral.acceptedById = userId;
    referral.acceptedAt = new Date();
    
    if (dto.appointmentDate) {
      referral.appointmentDate = new Date(dto.appointmentDate);
    }
    if (dto.appointmentTime) {
      referral.appointmentTime = dto.appointmentTime;
    }
    if (dto.notes) {
      referral.feedbackNotes = dto.notes;
    }

    return this.referralRepository.save(referral);
  }

  async reject(id: string, dto: RejectReferralDto, userId: string, tenantId?: string): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('Only pending referrals can be rejected');
    }

    referral.status = ReferralStatus.REJECTED;
    referral.rejectionReason = dto.rejectionReason;

    return this.referralRepository.save(referral);
  }

  async complete(id: string, dto: CompleteReferralDto, tenantId?: string): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.status !== ReferralStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted referrals can be completed');
    }

    referral.status = ReferralStatus.COMPLETED;
    referral.completedAt = new Date();
    
    if (dto.destinationEncounterId) {
      referral.destinationEncounterId = dto.destinationEncounterId;
    }
    if (dto.feedbackNotes) {
      referral.feedbackNotes = dto.feedbackNotes;
    }

    return this.referralRepository.save(referral);
  }

  async cancel(id: string, reason: string, tenantId?: string): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);

    if (referral.status === ReferralStatus.COMPLETED) {
      throw new BadRequestException('Completed referrals cannot be cancelled');
    }

    referral.status = ReferralStatus.CANCELLED;
    referral.rejectionReason = reason;

    return this.referralRepository.save(referral);
  }

  async checkExpiredReferrals(tenantId?: string): Promise<number> {
    const now = new Date();
    const result = await this.referralRepository.update(
      {
        status: ReferralStatus.PENDING,
        expiryDate: LessThanOrEqual(now),
      },
      { status: ReferralStatus.EXPIRED },
    );

    return result.affected || 0;
  }

  async getReferralStats(facilityId: string, fromDate: Date, toDate: Date, tenantId?: string) {
    const incomingWhere: any = {
      toFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    if (tenantId) incomingWhere.tenantId = tenantId;

    const outgoingWhere: any = {
      fromFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    if (tenantId) outgoingWhere.tenantId = tenantId;

    const completedWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.COMPLETED,
      createdAt: Between(fromDate, toDate),
    };
    if (tenantId) completedWhere.tenantId = tenantId;

    const pendingWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.PENDING,
    };
    if (tenantId) pendingWhere.tenantId = tenantId;

    const incoming = await this.referralRepository.count({ where: incomingWhere });
    const outgoing = await this.referralRepository.count({ where: outgoingWhere });
    const completed = await this.referralRepository.count({ where: completedWhere });
    const pending = await this.referralRepository.count({ where: pendingWhere });

    return { incoming, outgoing, completed, pending };
  }

  private async generateReferralNumber(facilityId: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `REF${year}${month}`;

    const lastReferral = await this.referralRepository
      .createQueryBuilder('referral')
      .where('referral.referral_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('referral.referral_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastReferral) {
      const lastSequence = parseInt(lastReferral.referralNumber.slice(-5), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(5, '0')}`;
  }
}
