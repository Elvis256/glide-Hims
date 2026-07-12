import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual } from 'typeorm';
import { Referral, ReferralStatus } from '../../database/entities/referral.entity';
import {
  CreateReferralDto,
  AcceptReferralDto,
  RejectReferralDto,
  CompleteReferralDto,
  ReferralFilterDto,
} from './dto/referral.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private referralRepository: Repository<Referral>,
  ) {}

  async create(
    dto: CreateReferralDto,
    userId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<Referral> {
    const tid = requireTenantId(tenantId);

    // Calculate expiry date (default 30 days)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    // Serialize number generation per tenant/month: MAX+1 with no lock (and
    // no tenant filter) raced under concurrent creates.
    return this.referralRepository.manager.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `referral_num_${tid}`,
      ]);
      const referralNumber = await this.generateReferralNumber(tid, manager);

      const referral = manager.create(Referral, {
        ...dto,
        referralNumber,
        fromFacilityId: facilityId,
        referredById: userId,
        expiryDate,
        status: ReferralStatus.PENDING,
        tenantId: tid,
      });

      return manager.save(Referral, referral);
    });
  }

  async findAll(
    filter: ReferralFilterDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const query = this.referralRepository
      .createQueryBuilder('referral')
      .leftJoinAndSelect('referral.patient', 'patient')
      .leftJoinAndSelect('referral.fromFacility', 'fromFacility')
      .leftJoinAndSelect('referral.toFacility', 'toFacility')
      .leftJoinAndSelect('referral.referredBy', 'referredBy');

    // Filter by facility (either from or to)
    query.andWhere(
      '(referral.from_facility_id = :facilityId OR referral.to_facility_id = :facilityId)',
      { facilityId },
    );

    query.andWhere('referral.tenant_id = :tenantId', { tenantId: tid });

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
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const referral = await this.referralRepository.findOne({
      where,
      relations: [
        'patient',
        'fromFacility',
        'toFacility',
        'referredBy',
        'acceptedBy',
        'sourceEncounter',
        'destinationEncounter',
      ],
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    return referral;
  }

  async findByPatient(patientId: string, tenantId?: string): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { patientId };
    where.tenantId = tid;

    return this.referralRepository.find({
      where,
      relations: ['fromFacility', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getIncomingReferrals(facilityId: string, tenantId?: string): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { toFacilityId: facilityId, status: ReferralStatus.PENDING };
    where.tenantId = tid;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'fromFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getOutgoingReferrals(facilityId: string, tenantId?: string): Promise<Referral[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { fromFacilityId: facilityId };
    where.tenantId = tid;

    return this.referralRepository.find({
      where,
      relations: ['patient', 'toFacility', 'referredBy'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Receiving-side actions (accept/reject/complete) must come from the
   * facility the referral is addressed to; cancel must come from either end.
   * Without this, any user in a multi-facility tenant could act on another
   * facility's referrals.
   */
  private assertFacilitySide(
    referral: Referral,
    facilityId: string | undefined,
    side: 'to' | 'from' | 'either',
  ): void {
    if (!facilityId) return; // single-facility deployments have no context to check
    const isTo = referral.toFacilityId === facilityId;
    const isFrom = referral.fromFacilityId === facilityId;
    const ok = side === 'to' ? isTo : side === 'from' ? isFrom : isTo || isFrom;
    if (!ok) {
      throw new BadRequestException(
        `This referral is not addressed ${side === 'to' ? 'to' : 'from'} your facility`,
      );
    }
  }

  async accept(
    id: string,
    dto: AcceptReferralDto,
    userId: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

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

  async reject(
    id: string,
    dto: RejectReferralDto,
    userId: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('Only pending referrals can be rejected');
    }

    referral.status = ReferralStatus.REJECTED;
    referral.rejectionReason = dto.rejectionReason;

    return this.referralRepository.save(referral);
  }

  async complete(
    id: string,
    dto: CompleteReferralDto,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'to');

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

  async cancel(
    id: string,
    reason: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<Referral> {
    const referral = await this.findOne(id, tenantId);
    this.assertFacilitySide(referral, facilityId, 'either');

    if (referral.status === ReferralStatus.COMPLETED) {
      throw new BadRequestException('Completed referrals cannot be cancelled');
    }

    referral.status = ReferralStatus.CANCELLED;
    referral.rejectionReason = reason;

    return this.referralRepository.save(referral);
  }

  async checkExpiredReferrals(tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const now = new Date();
    const where: any = {
      status: ReferralStatus.PENDING,
      expiryDate: LessThanOrEqual(now),
    };
    where.tenantId = tid;
    const result = await this.referralRepository.update(where, { status: ReferralStatus.EXPIRED });

    return result.affected || 0;
  }

  async getReferralStats(facilityId: string, fromDate: Date, toDate: Date, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const incomingWhere: any = {
      toFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    incomingWhere.tenantId = tid;

    const outgoingWhere: any = {
      fromFacilityId: facilityId,
      createdAt: Between(fromDate, toDate),
    };
    outgoingWhere.tenantId = tid;

    const completedWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.COMPLETED,
      createdAt: Between(fromDate, toDate),
    };
    completedWhere.tenantId = tid;

    const pendingWhere: any = {
      toFacilityId: facilityId,
      status: ReferralStatus.PENDING,
    };
    pendingWhere.tenantId = tid;

    const incoming = await this.referralRepository.count({ where: incomingWhere });
    const outgoing = await this.referralRepository.count({ where: outgoingWhere });
    const completed = await this.referralRepository.count({ where: completedWhere });
    const pending = await this.referralRepository.count({ where: pendingWhere });

    return { incoming, outgoing, completed, pending };
  }

  private async generateReferralNumber(
    tenantId: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `REF${year}${month}`;

    const lastReferral = await manager
      .createQueryBuilder(Referral, 'referral')
      .where('referral.referral_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('referral.tenant_id = :tenantId', { tenantId })
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
