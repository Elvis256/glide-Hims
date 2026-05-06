import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';
import { OrgAdminService } from './org-admin.service';
import { OrgApprovalResolverService } from './org-approval-resolver.service';

@UseGuards(ModuleGuard)
@RequireModule('procurement')
@Controller('org-admin')
export class OrgAdminController {
  constructor(
    private readonly orgAdmin: OrgAdminService,
    private readonly resolver: OrgApprovalResolverService,
  ) {}

  // -------- Departments --------
  @Get('departments')
  @AuthWithPermissions('procurement.read')
  listDepartments(@Request() req: any) {
    return this.orgAdmin.listDepartments(req.user?.tenantId);
  }

  @Put('departments/:id/head')
  @AuthWithPermissions('procurement.manage')
  setDepartmentHead(@Param('id') id: string, @Body() body: { headUserId: string | null }, @Request() req: any) {
    return this.orgAdmin.setDepartmentHead(id, body.headUserId, req.user?.tenantId);
  }

  @Put('departments/:id/parent')
  @AuthWithPermissions('procurement.manage')
  setDepartmentParent(@Param('id') id: string, @Body() body: { parentId: string | null }, @Request() req: any) {
    return this.orgAdmin.setDepartmentParent(id, body.parentId, req.user?.tenantId);
  }

  // -------- Employees --------
  @Get('employees')
  @AuthWithPermissions('procurement.read')
  listEmployees(@Request() req: any) {
    return this.orgAdmin.listEmployees(req.user?.tenantId);
  }

  @Put('employees/:id/manager')
  @AuthWithPermissions('procurement.manage')
  setEmployeeManager(@Param('id') id: string, @Body() body: { managerId: string | null }, @Request() req: any) {
    return this.orgAdmin.setEmployeeManager(id, body.managerId, req.user?.tenantId);
  }

  @Put('employees/:id/position')
  @AuthWithPermissions('procurement.manage')
  setEmployeePosition(@Param('id') id: string, @Body() body: { positionId: string | null }, @Request() req: any) {
    return this.orgAdmin.setEmployeePosition(id, body.positionId, req.user?.tenantId);
  }

  // -------- Positions --------
  @Get('positions')
  @AuthWithPermissions('procurement.read')
  listPositions(@Request() req: any) {
    return this.orgAdmin.listPositions(req.user?.tenantId);
  }

  @Post('positions')
  @AuthWithPermissions('procurement.manage')
  createPosition(@Body() body: any, @Request() req: any) {
    return this.orgAdmin.createPosition(body, req.user?.tenantId);
  }

  @Put('positions/:id')
  @AuthWithPermissions('procurement.manage')
  updatePosition(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.orgAdmin.updatePosition(id, body, req.user?.tenantId);
  }

  @Delete('positions/:id')
  @AuthWithPermissions('procurement.manage')
  deletePosition(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.deletePosition(id, req.user?.tenantId);
  }

  // -------- Approver groups --------
  @Get('groups')
  @AuthWithPermissions('procurement.read')
  listGroups(@Request() req: any) {
    return this.orgAdmin.listGroups(req.user?.tenantId);
  }

  @Get('groups/:id')
  @AuthWithPermissions('procurement.read')
  getGroup(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.getGroup(id, req.user?.tenantId);
  }

  @Post('groups')
  @AuthWithPermissions('procurement.manage')
  createGroup(@Body() body: any, @Request() req: any) {
    return this.orgAdmin.createGroup(body, req.user?.tenantId);
  }

  @Put('groups/:id')
  @AuthWithPermissions('procurement.manage')
  updateGroup(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.orgAdmin.updateGroup(id, body, req.user?.tenantId);
  }

  @Delete('groups/:id')
  @AuthWithPermissions('procurement.manage')
  deleteGroup(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.deleteGroup(id, req.user?.tenantId);
  }

  // -------- Approval policies --------
  @Get('policies')
  @AuthWithPermissions('procurement.read')
  listPolicies(@Request() req: any) {
    return this.orgAdmin.listPolicies(req.user?.tenantId);
  }

  @Get('policies/:id')
  @AuthWithPermissions('procurement.read')
  getPolicy(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.getPolicy(id, req.user?.tenantId);
  }

  @Post('policies')
  @AuthWithPermissions('procurement.manage')
  createPolicy(@Body() body: any, @Request() req: any) {
    return this.orgAdmin.createPolicy(body, req.user?.tenantId);
  }

  @Put('policies/:id')
  @AuthWithPermissions('procurement.manage')
  updatePolicy(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.orgAdmin.updatePolicy(id, body, req.user?.tenantId);
  }

  @Delete('policies/:id')
  @AuthWithPermissions('procurement.manage')
  deletePolicy(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.deletePolicy(id, req.user?.tenantId);
  }

  // -------- Delegations --------
  @Get('delegations')
  @AuthWithPermissions('procurement.read')
  listDelegations(@Request() req: any, @Query('userId') userId?: string) {
    return this.orgAdmin.listDelegations(req.user?.tenantId, userId);
  }

  @Post('delegations')
  @AuthWithPermissions('procurement.manage')
  createDelegation(@Body() body: any, @Request() req: any) {
    return this.orgAdmin.createDelegation(body, req.user?.tenantId);
  }

  @Put('delegations/:id')
  @AuthWithPermissions('procurement.manage')
  updateDelegation(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.orgAdmin.updateDelegation(id, body, req.user?.tenantId);
  }

  @Delete('delegations/:id')
  @AuthWithPermissions('procurement.manage')
  deleteDelegation(@Param('id') id: string, @Request() req: any) {
    return this.orgAdmin.deleteDelegation(id, req.user?.tenantId);
  }

  // -------- Preview / debug --------
  @Post('approval/preview')
  @AuthWithPermissions('procurement.read')
  previewApprovalChain(@Body() body: any, @Request() req: any) {
    return this.resolver.resolveSteps({
      documentId: 'preview',
      documentType: body.documentType,
      amount: Number(body.amount || 0),
      facilityId: body.facilityId || null,
      departmentId: body.departmentId || null,
      category: body.category || null,
      requesterId: body.requesterId || req.user?.id,
      tenantId: req.user?.tenantId,
    });
  }
}
