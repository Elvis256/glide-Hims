import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipScheme, PatientMembership } from '../../database/entities/membership.entity';
import { CreateMembershipSchemeDto, UpdateMembershipSchemeDto, CreatePatientMembershipDto, UpdatePatientMembershipDto } from './membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(MembershipScheme)
    private schemeRepo: Repository<MembershipScheme>,
    @InjectRepository(PatientMembership)
    private membershipRepo: Repository<PatientMembership>,
  ) {}

  // Schemes
  async createScheme(dto: CreateMembershipSchemeDto) {
    const exists = await this.schemeRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Scheme code already exists');
    const scheme = this.schemeRepo.create(dto);
    return this.schemeRepo.save(scheme);
  }

  async findAllSchemes(facilityId?: string) {
    const query = this.schemeRepo.createQueryBuilder('s').where('s.isActive = true');
    if (facilityId) query.andWhere('(s.facilityId = :facilityId OR s.facilityId IS NULL)', { facilityId });
    return query.orderBy('s.name', 'ASC').getMany();
  }

  async findScheme(id: string) {
    const scheme = await this.schemeRepo.findOne({ where: { id } });
    if (!scheme) throw new NotFoundException('Scheme not found');
    return scheme;
  }

  async updateScheme(id: string, dto: UpdateMembershipSchemeDto) {
    const scheme = await this.findScheme(id);
    Object.assign(scheme, dto);
    return this.schemeRepo.save(scheme);
  }

  // Patient Memberships
  async createMembership(dto: CreatePatientMembershipDto) {
    const scheme = await this.findScheme(dto.schemeId);
    const membershipNumber = `MEM-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const endDate = dto.endDate || new Date(new Date(dto.startDate).getTime() + scheme.validDays * 24 * 60 * 60 * 1000);
    
    const membership = this.membershipRepo.create({
      ...dto,
      membershipNumber,
      endDate,
      status: 'active',
    });
    return this.membershipRepo.save(membership);
  }

  async findPatientMemberships(patientId: string) {
    return this.membershipRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveMembership(patientId: string) {
    return this.membershipRepo.findOne({
      where: { patientId, status: 'active' },
      order: { createdAt: 'DESC' },
    });
  }

  async updateMembership(id: string, dto: UpdatePatientMembershipDto) {
    const membership = await this.membershipRepo.findOne({ where: { id } });
    if (!membership) throw new NotFoundException('Membership not found');
    Object.assign(membership, dto);
    return this.membershipRepo.save(membership);
  }

  async getPatientDiscount(patientId: string): Promise<number> {
    const membership = await this.findActiveMembership(patientId);
    if (!membership) return 0;
    const scheme = await this.findScheme(membership.schemeId);
    return Number(scheme.discountPercent) || 0;
  }
}
