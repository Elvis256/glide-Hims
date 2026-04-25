import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipScheme, PatientMembership } from '../../database/entities/membership.entity';
import {
  CreateMembershipSchemeDto,
  UpdateMembershipSchemeDto,
  CreatePatientMembershipDto,
  UpdatePatientMembershipDto,
} from './membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(MembershipScheme)
    private schemeRepo: Repository<MembershipScheme>,
    @InjectRepository(PatientMembership)
    private membershipRepo: Repository<PatientMembership>,
  ) {}

  // Schemes
  async createScheme(dto: CreateMembershipSchemeDto, tenantId?: string) {
    const where: any = { code: dto.code };
    if (tenantId) where.tenantId = tenantId;
    const exists = await this.schemeRepo.findOne({ where });
    if (exists) throw new ConflictException('Scheme code already exists');
    const scheme = this.schemeRepo.create({
      ...dto,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.schemeRepo.save(scheme);
  }

  async findAllSchemes(facilityId?: string, tenantId?: string) {
    const query = this.schemeRepo.createQueryBuilder('s').where('s.isActive = true');
    if (facilityId)
      query.andWhere('(s.facilityId = :facilityId OR s.facilityId IS NULL)', { facilityId });
    if (tenantId) {
      query.andWhere('s.tenant_id = :tenantId', { tenantId });
    }
    return query.orderBy('s.name', 'ASC').getMany();
  }

  async findScheme(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const scheme = await this.schemeRepo.findOne({ where });
    if (!scheme) throw new NotFoundException('Scheme not found');
    return scheme;
  }

  async updateScheme(id: string, dto: UpdateMembershipSchemeDto, tenantId?: string) {
    const scheme = await this.findScheme(id, tenantId);
    Object.assign(scheme, dto);
    return this.schemeRepo.save(scheme);
  }

  // Patient Memberships
  async createMembership(dto: CreatePatientMembershipDto, tenantId?: string) {
    const scheme = await this.findScheme(dto.schemeId, tenantId);
    const membershipNumber = `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const endDate =
      dto.endDate ||
      new Date(new Date(dto.startDate).getTime() + scheme.validDays * 24 * 60 * 60 * 1000);

    const membership = this.membershipRepo.create({
      ...dto,
      membershipNumber,
      endDate,
      status: 'active',
      ...(tenantId ? { tenantId } : {}),
    });
    return this.membershipRepo.save(membership);
  }

  async findPatientMemberships(patientId: string, tenantId?: string) {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;
    return this.membershipRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveMembership(patientId: string, tenantId?: string) {
    const where: any = { patientId, status: 'active' };
    if (tenantId) where.tenantId = tenantId;
    return this.membershipRepo.findOne({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async updateMembership(id: string, dto: UpdatePatientMembershipDto, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const membership = await this.membershipRepo.findOne({ where });
    if (!membership) throw new NotFoundException('Membership not found');
    Object.assign(membership, dto);
    return this.membershipRepo.save(membership);
  }

  async getPatientDiscount(patientId: string, tenantId?: string): Promise<number> {
    const membership = await this.findActiveMembership(patientId, tenantId);
    if (!membership) return 0;
    const scheme = await this.findScheme(membership.schemeId, tenantId);
    return Number(scheme.discountPercent) || 0;
  }

  async findAllMemberships(planId?: string, status?: string, tenantId?: string) {
    const qb = this.membershipRepo.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');
    if (planId) qb.andWhere('m.schemeId = :planId', { planId });
    if (status) qb.andWhere('m.status = :status', { status });
    if (tenantId) qb.andWhere('m.tenant_id = :tenantId', { tenantId });
    return qb.getMany();
  }
}
