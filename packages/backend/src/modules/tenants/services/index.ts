import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Tenant } from '../entities';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async createTenant(data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenantRepository.create(data);
    return this.tenantRepository.save(tenant);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { slug, status: 'active', deleted_at: IsNull() },
    });
  }

  async findBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { subdomain, status: 'active', deleted_at: IsNull() },
    });
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.tenantRepository.findOne({
      where: { id, status: 'active', deleted_at: IsNull() },
    });
  }

  async getAllTenants(limit = 100, offset = 0): Promise<[Tenant[], number]> {
    return this.tenantRepository.findAndCount({
      where: { deleted_at: IsNull() },
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
    });
  }

  async updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant | null> {
    await this.tenantRepository.update(id, data);
    return this.findById(id);
  }

  async suspendTenant(id: string): Promise<Tenant | null> {
    return this.updateTenant(id, { status: 'suspended' });
  }

  async activateTenant(id: string): Promise<Tenant | null> {
    return this.updateTenant(id, { status: 'active' });
  }

  async deleteTenant(id: string): Promise<void> {
    await this.tenantRepository.update(id, {
      deleted_at: new Date(),
      status: 'archived',
    });
  }

  async getTenantStats(id: string): Promise<any> {
    const tenant = await this.findById(id);
    if (!tenant) return null;

    return {
      id: tenant.id,
      name: tenant.name,
      users: tenant.user_count,
      deployments: tenant.deployment_count,
      plan: tenant.billing_plan,
      status: tenant.status,
      created_at: tenant.created_at,
    };
  }
}
