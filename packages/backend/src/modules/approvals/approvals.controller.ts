import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { ApprovalsService, DocumentRef } from './approvals.service';
import { ApprovalsSeederService } from './approvals-seeder.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

interface AuthedRequest {
  user?: {
    id?: string;
    tenantId?: string;
    facilityId?: string;
  };
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function actorFrom(req: AuthedRequest) {
  return {
    userId: req.user?.id || '',
    ipAddress: req.ip,
    userAgent: typeof req.headers?.['user-agent'] === 'string'
      ? (req.headers!['user-agent'] as string)
      : undefined,
  };
}

/**
 * Generic, module-agnostic approvals API. Any module can use these endpoints
 * by passing module + documentType + documentId. The legacy procurement
 * endpoints in ProcurementController and OrgAdminController are now thin
 * aliases that delegate here.
 */
@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly seeder: ApprovalsSeederService,
  ) {}

  // ---- Preview ----
  @Post('preview')
  @AuthWithPermissions('procurement.read')
  preview(@Body() body: any, @Request() req: AuthedRequest) {
    return this.approvals.previewEnriched({
      module: body.module || 'procurement',
      documentType: body.documentType,
      amount: Number(body.amount || 0),
      facilityId: body.facilityId || null,
      departmentId: body.departmentId || null,
      category: body.category || null,
      requesterId: body.requesterId || req.user?.id || '',
      tenantId: req.user?.tenantId || '',
    });
  }

  // ---- Inbox (cross-module pending approvals for the current user) ----
  @Get('inbox')
  @AuthWithPermissions('procurement.read')
  inbox(@Request() req: AuthedRequest) {
    return this.approvals.getInbox(req.user?.id || '', req.user?.tenantId);
  }

  // ---- Read persisted chain ----
  @Get('chain')
  @AuthWithPermissions('procurement.read')
  getChain(
    @Query('module') module: string,
    @Query('documentType') documentType: string,
    @Query('documentId') documentId: string,
    @Request() req: AuthedRequest,
  ) {
    const ref: DocumentRef = { module, documentType, documentId };
    return this.approvals.getChain(ref, req.user?.tenantId);
  }

  // ---- Audit log ----
  @Get('actions')
  @AuthWithPermissions('procurement.read')
  listActions(
    @Query('module') module: string,
    @Query('documentType') documentType: string,
    @Query('documentId') documentId: string,
    @Request() req: AuthedRequest,
  ) {
    return this.approvals.listActions(
      { module, documentType, documentId },
      req.user?.tenantId,
    );
  }

  // ---- Act ----
  @Post('steps/:id/approve')
  @AuthWithPermissions('procurement.manage')
  approve(
    @Param('id') id: string,
    @Body() body: { comment?: string },
    @Request() req: AuthedRequest,
  ) {
    return this.approvals.approveStep(id, actorFrom(req), body?.comment);
  }

  @Post('steps/:id/reject')
  @AuthWithPermissions('procurement.manage')
  reject(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @Request() req: AuthedRequest,
  ) {
    return this.approvals.rejectStep(id, actorFrom(req), body?.comment);
  }

  @Post('recall')
  @AuthWithPermissions('procurement.manage')
  recall(
    @Body() body: { module: string; documentType: string; documentId: string },
    @Request() req: AuthedRequest,
  ) {
    return this.approvals.recall(
      { module: body.module, documentType: body.documentType, documentId: body.documentId },
      actorFrom(req),
    );
  }

  /**
   * Idempotently install the default approval policies for the caller's
   * tenant. Safe to call multiple times — existing policies (matched by
   * name) are skipped.
   */
  @Post('seed-defaults')
  @AuthWithPermissions('system.admin')
  async seedDefaults(@Request() req: AuthedRequest) {
    const tenantId = req.user?.tenantId || '';
    return this.seeder.seedForTenant(tenantId);
  }
}
