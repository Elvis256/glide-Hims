import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import {
  PerformanceImprovementPlan,
  PipStatus,
} from '../../database/entities/performance-improvement-plan.entity';
import { EmployeeGoal, GoalStatus } from '../../database/entities/employee-goal.entity';
import { LetterTemplate, LetterTemplateType } from '../../database/entities/letter-template.entity';
import { Employee } from '../../database/entities/employee.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@ApiTags('HR - PIP / Goals / Letters')
@ApiBearerAuth()
@RequireModule('hr')
@Controller('hr')
export class HrExtrasController {
  constructor(
    @InjectRepository(PerformanceImprovementPlan)
    private pipRepo: Repository<PerformanceImprovementPlan>,
    @InjectRepository(EmployeeGoal)
    private goalRepo: Repository<EmployeeGoal>,
    @InjectRepository(LetterTemplate)
    private letterRepo: Repository<LetterTemplate>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
  ) {}

  // ============ PIPs ============
  @Post('pips')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create PIP' })
  async createPip(@Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const pip = this.pipRepo.create({
      ...dto,
      tenantId: tid,
    });
    return this.pipRepo.save(pip);
  }

  @Get('pips')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List PIPs' })
  async listPips(
    @Query('facilityId') facilityId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: PipStatus,
    @Request() req?: any,
  ) {
    const tid = requireTenantId(req?.user?.tenantId);
    const where: any = { facilityId, tenantId: tid };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    return this.pipRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  @Patch('pips/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update PIP' })
  async updatePip(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const pip = await this.pipRepo.findOne({ where });
    if (!pip) throw new NotFoundException('PIP not found');
    Object.assign(pip, dto);
    return this.pipRepo.save(pip);
  }

  @Delete('pips/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete PIP' })
  async deletePip(@Param('id') id: string, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const pip = await this.pipRepo.findOne({ where });
    if (!pip) throw new NotFoundException('PIP not found');
    await this.pipRepo.softRemove(pip);
    return { success: true };
  }

  // ============ GOALS / OKRs ============
  @Post('goals')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create employee goal' })
  async createGoal(@Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const goal = this.goalRepo.create({
      ...dto,
      tenantId: tid,
    });
    return this.goalRepo.save(goal);
  }

  @Get('goals')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List employee goals' })
  async listGoals(
    @Query('facilityId') facilityId: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: GoalStatus,
    @Request() req?: any,
  ) {
    const tid = requireTenantId(req?.user?.tenantId);
    const where: any = { facilityId, tenantId: tid };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    return this.goalRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  @Get('my-goals')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: "List current user's goals" })
  async myGoals(@Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const emp = await this.employeeRepo.findOne({ where: { userId: req.user.id } });
    if (!emp) return [];
    const where: any = { employeeId: emp.id, tenantId: tid };
    return this.goalRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  @Patch('goals/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update goal' })
  async updateGoal(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const goal = await this.goalRepo.findOne({ where });
    if (!goal) throw new NotFoundException('Goal not found');
    Object.assign(goal, dto);
    return this.goalRepo.save(goal);
  }

  @Delete('goals/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete goal' })
  async deleteGoal(@Param('id') id: string, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const goal = await this.goalRepo.findOne({ where });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.goalRepo.remove(goal);
    return { success: true };
  }

  // ============ LETTER TEMPLATES ============
  @Post('letter-templates')
  @AuthWithPermissions('hr.create')
  @ApiOperation({ summary: 'Create letter template' })
  async createLetter(@Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const tpl = this.letterRepo.create({ ...dto, tenantId: tid });
    return this.letterRepo.save(tpl);
  }

  @Get('letter-templates')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'List letter templates' })
  async listLetters(@Query('type') type?: LetterTemplateType, @Request() req?: any) {
    const tid = requireTenantId(req?.user?.tenantId);
    const where: any = { tenantId: tid };
    if (type) where.type = type;
    return this.letterRepo.find({ where, order: { name: 'ASC' } });
  }

  @Patch('letter-templates/:id')
  @AuthWithPermissions('hr.update')
  @ApiOperation({ summary: 'Update letter template' })
  async updateLetter(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const tpl = await this.letterRepo.findOne({ where });
    if (!tpl) throw new NotFoundException('Template not found');
    Object.assign(tpl, dto);
    return this.letterRepo.save(tpl);
  }

  @Delete('letter-templates/:id')
  @AuthWithPermissions('hr.delete')
  @ApiOperation({ summary: 'Delete letter template' })
  async deleteLetter(@Param('id') id: string, @Request() req: any) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const tpl = await this.letterRepo.findOne({ where });
    if (!tpl) throw new NotFoundException('Template not found');
    await this.letterRepo.remove(tpl);
    return { success: true };
  }

  @Post('letter-templates/:id/render')
  @AuthWithPermissions('hr.read')
  @ApiOperation({ summary: 'Render letter against employee data (returns text)' })
  async renderLetter(
    @Param('id') id: string,
    @Body() body: { employeeId?: string; variables?: Record<string, any> },
    @Request() req: any,
    @Res() res: any,
  ) {
    const tid = requireTenantId(req.user?.tenantId);
    const where: any = { id, tenantId: tid };
    const tpl = await this.letterRepo.findOne({ where });
    if (!tpl) throw new NotFoundException('Template not found');

    const ctx: Record<string, any> = { ...(body.variables || {}) };
    if (body.employeeId) {
      const emp = await this.employeeRepo.findOne({
        where: {
          id: body.employeeId,
          tenantId: tid,
        },
      });
      if (emp) ctx.employee = emp;
    }
    const render = (s: string) =>
      s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
        const parts = k.split('.');
        let cur: any = ctx;
        for (const p of parts) cur = cur?.[p];
        return cur == null ? '' : String(cur);
      });
    const subject = render(tpl.subject);
    const bodyOut = render(tpl.body);
    res.json({ subject, body: bodyOut });
  }
}
