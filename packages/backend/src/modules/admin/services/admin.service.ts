import { Injectable } from '@nestjs/common';
import { TenantService } from '../../tenants/services';
import { Tenant } from '../../tenants/entities';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';

@Injectable()
export class AdminService {
  constructor(private tenantService: TenantService) {}

  async createTenant(data: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.createTenant({
      name: data.name,
      slug: data.slug,
      subdomain: data.subdomain,
      description: data.description,
      billing_plan: data.billing_plan || 'free',
      configuration: data.configuration || {},
      branding: data.branding || {},
      status: 'active',
    });
  }

  async getAllTenants(limit = 50, offset = 0) {
    return this.tenantService.getAllTenants(limit, offset);
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.tenantService.findById(id);
  }

  async updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant | null> {
    return this.tenantService.updateTenant(id, data);
  }

  async suspendTenant(id: string): Promise<Tenant | null> {
    return this.tenantService.suspendTenant(id);
  }

  async activateTenant(id: string): Promise<Tenant | null> {
    return this.tenantService.activateTenant(id);
  }

  async deleteTenant(id: string): Promise<void> {
    return this.tenantService.deleteTenant(id);
  }

  async getSystemMetrics() {
    const [tenants, count] = await this.tenantService.getAllTenants(10000, 0);
    
    return {
      total_tenants: count,
      active_tenants: tenants.filter(t => t.status === 'active').length,
      suspended_tenants: tenants.filter(t => t.status === 'suspended').length,
      total_users: tenants.reduce((sum, t) => sum + t.user_count, 0),
      total_deployments: tenants.reduce((sum, t) => sum + t.deployment_count, 0),
      tenants,
    };
  }
}
