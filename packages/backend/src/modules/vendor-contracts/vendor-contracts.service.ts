import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { VendorContract, ContractAmendment, ContractStatus } from '../../database/entities/vendor-contract.entity';
import { CreateVendorContractDto, UpdateVendorContractDto, CreateAmendmentDto, RenewContractDto } from './dto/vendor-contract.dto';

@Injectable()
export class VendorContractsService {
  private readonly logger = new Logger(VendorContractsService.name);

  constructor(
    @InjectRepository(VendorContract) private contractRepo: Repository<VendorContract>,
    @InjectRepository(ContractAmendment) private amendmentRepo: Repository<ContractAmendment>,
  ) {}

  async create(dto: CreateVendorContractDto, userId: string): Promise<VendorContract> {
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
    });

    const saved = await this.contractRepo.save(contract);
    return this.findOne(saved.id);
  }

  async findAll(facilityId: string, options: { status?: ContractStatus; supplierId?: string } = {}) {
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

    return qb.orderBy('contract.endDate', 'ASC').getMany();
  }

  async findOne(id: string): Promise<VendorContract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['supplier', 'amendments', 'createdBy'],
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: UpdateVendorContractDto): Promise<VendorContract> {
    const contract = await this.findOne(id);
    
    if (dto.value !== undefined) contract.value = dto.value;
    if (dto.terms !== undefined) contract.terms = dto.terms;
    if (dto.autoRenew !== undefined) contract.autoRenew = dto.autoRenew;
    if (dto.renewalNoticeDays !== undefined) contract.renewalNoticeDays = dto.renewalNoticeDays;
    if (dto.notes !== undefined) contract.notes = dto.notes;
    if (dto.startDate) contract.startDate = new Date(dto.startDate);
    if (dto.endDate) contract.endDate = new Date(dto.endDate);

    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async activate(id: string): Promise<VendorContract> {
    const contract = await this.findOne(id);
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('Only draft contracts can be activated');
    }
    contract.status = ContractStatus.ACTIVE;
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async addAmendment(dto: CreateAmendmentDto, userId: string): Promise<ContractAmendment> {
    const contract = await this.findOne(dto.contractId);
    
    const count = await this.amendmentRepo.count({ where: { contractId: dto.contractId } });
    
    const amendment = this.amendmentRepo.create({
      contractId: dto.contractId,
      amendmentNumber: count + 1,
      description: dto.description,
      changes: dto.changes,
      effectiveDate: new Date(dto.effectiveDate),
      createdById: userId,
    });

    const saved = await this.amendmentRepo.save(amendment);

    // Apply changes to contract
    if (dto.changes?.value) contract.value = dto.changes.value.new;
    if (dto.changes?.endDate) contract.endDate = new Date(dto.changes.endDate.new);
    if (dto.changes?.terms) contract.terms = dto.changes.terms.new;
    await this.contractRepo.save(contract);

    return saved;
  }

  async renew(id: string, dto: RenewContractDto, userId: string): Promise<VendorContract> {
    const contract = await this.findOne(id);
    if (![ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON, ContractStatus.EXPIRED].includes(contract.status)) {
      throw new BadRequestException('Only active/expiring/expired contracts can be renewed');
    }

    const count = await this.amendmentRepo.count({ where: { contractId: id } });
    
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
    });
    await this.amendmentRepo.save(amendment);

    contract.endDate = new Date(dto.newEndDate);
    if (dto.newValue) contract.value = dto.newValue;
    contract.status = ContractStatus.ACTIVE;
    await this.contractRepo.save(contract);

    return this.findOne(id);
  }

  async terminate(id: string, reason: string): Promise<VendorContract> {
    const contract = await this.findOne(id);
    contract.status = ContractStatus.TERMINATED;
    contract.notes = (contract.notes || '') + `\nTerminated: ${reason}`;
    await this.contractRepo.save(contract);
    return this.findOne(id);
  }

  async checkExpiringContracts(facilityId: string, daysAhead: number = 30): Promise<VendorContract[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const contracts = await this.contractRepo.find({
      where: {
        facilityId,
        status: ContractStatus.ACTIVE,
        endDate: LessThan(futureDate),
      },
      relations: ['supplier'],
    });

    // Update status to expiring_soon
    for (const contract of contracts) {
      if (contract.status === ContractStatus.ACTIVE) {
        contract.status = ContractStatus.EXPIRING_SOON;
        await this.contractRepo.save(contract);
      }
    }

    return contracts;
  }

  async getStats(facilityId: string) {
    const [active, expiringSoon, expired, total] = await Promise.all([
      this.contractRepo.count({ where: { facilityId, status: ContractStatus.ACTIVE } }),
      this.contractRepo.count({ where: { facilityId, status: ContractStatus.EXPIRING_SOON } }),
      this.contractRepo.count({ where: { facilityId, status: ContractStatus.EXPIRED } }),
      this.contractRepo.count({ where: { facilityId } }),
    ]);

    const totalValue = await this.contractRepo
      .createQueryBuilder('contract')
      .where('contract.facilityId = :facilityId', { facilityId })
      .andWhere('contract.status = :status', { status: ContractStatus.ACTIVE })
      .select('SUM(contract.value)', 'sum')
      .getRawOne();

    return { active, expiringSoon, expired, total, totalActiveValue: totalValue?.sum || 0 };
  }
}
