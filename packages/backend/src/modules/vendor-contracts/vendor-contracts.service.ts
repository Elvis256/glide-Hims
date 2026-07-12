import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import {
  VendorContract,
  ContractAmendment,
  ContractStatus,
} from '../../database/entities/vendor-contract.entity';
import {
  CreateVendorContractDto,
  UpdateVendorContractDto,
  CreateAmendmentDto,
  RenewContractDto,
} from './dto/vendor-contract.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class VendorContractsService {
  private readonly logger = new Logger(VendorContractsService.name);

  constructor(
    @InjectRepository(VendorContract) private contractRepo: Repository<VendorContract>,
    @InjectRepository(ContractAmendment) private amendmentRepo: Repository<ContractAmendment>,
  ) {}

  async create(
    dto: CreateVendorContractDto,
    userId: string,
    tenantId?: string,
  ): Promise<VendorContract> {
    const tid = requireTenantId(tenantId);
    const contract = this.contractRepo.create({
      contractNumber: dto.contractNumber,
      supplierId: dto.supplierId,
      facilityId: dto.facilityId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      value: dto.value,
      terms: dto.terms,
      autoRenew: dto.autoRenew || false,
      renewalNoticeDays: dto.renewalNoticeDays || 30,
      notes: dto.notes,
      status: ContractStatus.DRAFT,
      createdById: userId,
      tenantId: tid,
    });

    const saved = await this.contractRepo.save(contract);
    return this.findOne(saved.id, tenantId);
  }

  async findAll(
    facilityId: string,
    options: { status?: ContractStatus; supplierId?: string } = {},
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const qb = this.contractRepo
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.supplier', 'supplier')
      .leftJoinAndSelect('contract.amendments', 'amendments');

    if (facilityId && facilityId.trim() !== '') {
      qb.where('contract.facilityId = :facilityId', { facilityId });
    }

    if (options.status) {
      if (facilityId && facilityId.trim() !== '') {
        qb.andWhere('contract.status = :status', { status: options.status });
      } else {
        qb.where('contract.status = :status', { status: options.status });
      }
    }
    if (options.supplierId) {
      qb.andWhere('contract.supplierId = :supplierId', { supplierId: options.supplierId });
    }
    qb.andWhere('contract.tenant_id = :tenantId', { tenantId: tid });

    return qb.orderBy('contract.endDate', 'ASC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<VendorContract> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const contract = await this.contractRepo.findOne({
      where,
      relations: ['supplier', 'amendments', 'createdBy'],
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(
    id: string,
    dto: UpdateVendorContractDto,
    tenantId?: string,
  ): Promise<VendorContract> {
    const contract = await this.findOne(id, tenantId);

    if (dto.value !== undefined) contract.value = dto.value;
    if (dto.terms !== undefined) contract.terms = dto.terms;
    if (dto.autoRenew !== undefined) contract.autoRenew = dto.autoRenew;
    if (dto.renewalNoticeDays !== undefined) contract.renewalNoticeDays = dto.renewalNoticeDays;
    if (dto.notes !== undefined) contract.notes = dto.notes;
    if (dto.startDate) contract.startDate = new Date(dto.startDate);
    if (dto.endDate) contract.endDate = new Date(dto.endDate);

    await this.contractRepo.save(contract);
    return this.findOne(id, tenantId);
  }

  async activate(id: string, tenantId?: string): Promise<VendorContract> {
    const contract = await this.findOne(id, tenantId);
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Only draft contracts can be activated');
    }
    contract.status = ContractStatus.ACTIVE;
    await this.contractRepo.save(contract);
    return this.findOne(id, tenantId);
  }

  async addAmendment(
    dto: CreateAmendmentDto,
    userId: string,
    tenantId?: string,
  ): Promise<ContractAmendment> {
    const tid = requireTenantId(tenantId);
    const contract = await this.findOne(dto.contractId, tenantId);

    const amendCountWhere1: any = { contractId: dto.contractId };
    amendCountWhere1.tenantId = tid;
    const count = await this.amendmentRepo.count({ where: amendCountWhere1 });

    const amendment = this.amendmentRepo.create({
      contractId: dto.contractId,
      amendmentNumber: count + 1,
      description: dto.description,
      changes: dto.changes,
      effectiveDate: new Date(dto.effectiveDate),
      createdById: userId,
      tenantId: tid,
    });

    const saved = await this.amendmentRepo.save(amendment);

    // Apply changes to contract
    if (dto.changes?.value) contract.value = dto.changes.value.new;
    if (dto.changes?.endDate) contract.endDate = new Date(dto.changes.endDate.new);
    if (dto.changes?.terms) contract.terms = dto.changes.terms.new;
    await this.contractRepo.save(contract);

    return saved;
  }

  async renew(
    id: string,
    dto: RenewContractDto,
    userId: string,
    tenantId?: string,
  ): Promise<VendorContract> {
    const tid = requireTenantId(tenantId);
    const contract = await this.findOne(id, tenantId);
    if (
      ![ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON, ContractStatus.EXPIRED].includes(
        contract.status,
      )
    ) {
      throw new BadRequestException('Only active/expiring/expired contracts can be renewed');
    }

    const amendCountWhere2: any = { contractId: id };
    amendCountWhere2.tenantId = tid;
    const count = await this.amendmentRepo.count({ where: amendCountWhere2 });

    const amendment = this.amendmentRepo.create({
      contractId: id,
      amendmentNumber: count + 1,
      description: dto.notes || 'Contract renewal',
      changes: {
        endDate: { old: contract.endDate, new: dto.newEndDate },
        value: dto.newValue ? { old: contract.value, new: dto.newValue } : undefined,
      },
      effectiveDate: new Date(),
      createdById: userId,
      tenantId: tid,
    });
    await this.amendmentRepo.save(amendment);

    contract.endDate = new Date(dto.newEndDate);
    if (dto.newValue) contract.value = dto.newValue;
    contract.status = ContractStatus.ACTIVE;
    await this.contractRepo.save(contract);

    return this.findOne(id, tenantId);
  }

  async terminate(id: string, reason: string, tenantId?: string): Promise<VendorContract> {
    const contract = await this.findOne(id, tenantId);
    contract.status = ContractStatus.TERMINATED;
    contract.notes = (contract.notes || '') + `\nTerminated: ${reason}`;
    await this.contractRepo.save(contract);
    return this.findOne(id, tenantId);
  }

  async checkExpiringContracts(
    facilityId: string,
    daysAhead: number = 30,
    tenantId?: string,
  ): Promise<VendorContract[]> {
    const tid = requireTenantId(tenantId);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const where: any = {
      facilityId,
      status: ContractStatus.ACTIVE,
      endDate: LessThan(futureDate),
    };
    where.tenantId = tid;

    const contracts = await this.contractRepo.find({
      where,
      relations: ['supplier'],
    });

    // Update status to expiring_soon — transactional batch update
    if (contracts.length > 0) {
      const activeIds = contracts
        .filter((c) => c.status === ContractStatus.ACTIVE)
        .map((c) => c.id);
      if (activeIds.length > 0) {
        await this.contractRepo.update(activeIds, { status: ContractStatus.EXPIRING_SOON });
        // Update in-memory objects to reflect the change
        contracts.forEach((c) => {
          if (c.status === ContractStatus.ACTIVE) c.status = ContractStatus.EXPIRING_SOON;
        });
      }
    }

    return contracts;
  }

  async getStats(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const activeWhere: any = { facilityId, status: ContractStatus.ACTIVE, tenantId: tid };
    const expiringWhere: any = { facilityId, status: ContractStatus.EXPIRING_SOON, tenantId: tid };
    const expiredWhere: any = { facilityId, status: ContractStatus.EXPIRED, tenantId: tid };
    const totalWhere: any = { facilityId, tenantId: tid };

    const [active, expiringSoon, expired, total] = await Promise.all([
      this.contractRepo.count({ where: activeWhere }),
      this.contractRepo.count({ where: expiringWhere }),
      this.contractRepo.count({ where: expiredWhere }),
      this.contractRepo.count({ where: totalWhere }),
    ]);

    const qb = this.contractRepo
      .createQueryBuilder('contract')
      .where('contract.facilityId = :facilityId', { facilityId })
      .andWhere('contract.status = :status', { status: ContractStatus.ACTIVE })
      .andWhere('contract.tenant_id = :tenantId', { tenantId: tid });
    const totalValue = await qb.select('SUM(contract.value)', 'sum').getRawOne();

    return { active, expiringSoon, expired, total, totalActiveValue: totalValue?.sum || 0 };
  }
}
