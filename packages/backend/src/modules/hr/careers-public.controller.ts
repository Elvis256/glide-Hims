import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { HrService } from './hr.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateJobApplicationDto } from './dto/hr.dto';
import { withTenant } from '../../common/context/tenant-context';

@ApiTags('Careers (Public)')
@Controller('careers')
export class CareersPublicController {
  constructor(
    private readonly hrService: HrService,
    private readonly tenantsService: TenantsService,
  ) {}

  /**
   * Public careers endpoints require an explicit tenant context
   * (slug or UUID). Without it we would either leak postings across
   * tenants or return a global pool, neither of which a hospital
   * recruiting site should expose. Slug comes from the public login
   * URL the recruiter publishes (e.g., /careers?tenant=tesy).
   */
  private async resolveTenantId(tenantSlug?: string, tenantId?: string): Promise<string> {
    if (tenantId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
        throw new BadRequestException('Invalid tenantId');
      }
      return tenantId;
    }
    if (!tenantSlug) {
      throw new BadRequestException('tenantSlug or tenantId is required');
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug) || tenantSlug.length < 3) {
      throw new BadRequestException('Invalid tenant slug');
    }
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant.id;
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('jobs')
  @ApiOperation({ summary: 'List published job postings (public, tenant-scoped)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'facilityId', required: false })
  async listJobs(
    @Query('tenantSlug') tenantSlug?: string,
    @Query('tenantId') tenantId?: string,
    @Query('facilityId') facilityId?: string,
  ) {
    const resolvedTenantId = await this.resolveTenantId(tenantSlug, tenantId);
    return withTenant(resolvedTenantId, () =>
      this.hrService.getPublishedJobs(facilityId, resolvedTenantId),
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job posting details (public, tenant-scoped)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async getJob(
    @Param('id') id: string,
    @Query('tenantSlug') tenantSlug?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = await this.resolveTenantId(tenantSlug, tenantId);
    return withTenant(resolvedTenantId, () =>
      this.hrService.getPublishedJobById(id, resolvedTenantId),
    );
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('jobs/:id/apply')
  @ApiOperation({ summary: 'Submit a job application (public, tenant-scoped)' })
  @ApiQuery({ name: 'tenantSlug', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async apply(
    @Param('id') id: string,
    @Body() dto: CreateJobApplicationDto,
    @Query('tenantSlug') tenantSlug?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const resolvedTenantId = await this.resolveTenantId(tenantSlug, tenantId);
    return withTenant(resolvedTenantId, () =>
      this.hrService.createJobApplication({ ...dto, jobPostingId: id }, resolvedTenantId),
    );
  }
}
