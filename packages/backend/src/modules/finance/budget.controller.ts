import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CreateBudgetDto, CreateBudgetLineDto, UpdateBudgetLineDto } from './dto/finance.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Budgets')
@UseGuards(ModuleGuard)
@RequireModule('finance')
@Controller('finance/budgets')
export class BudgetController {
  constructor(private budgetService: BudgetService) {}

  @Post()
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a budget' })
  create(@Body() dto: CreateBudgetDto, @Request() req: any) {
    return this.budgetService.create(dto as any, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List budgets' })
  findAll(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.budgetService.findAll(facilityId, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get a budget by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.budgetService.findOne(id, req?.user?.tenantId);
  }

  @Post(':id/lines')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Add a line to a budget' })
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBudgetLineDto,
    @Request() req?: any,
  ) {
    return this.budgetService.addLine(id, dto as any, req?.user?.tenantId);
  }

  @Patch('lines/:lineId')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update a budget line' })
  updateLine(
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateBudgetLineDto,
    @Request() req?: any,
  ) {
    return this.budgetService.updateLine(lineId, dto as any, req?.user?.tenantId);
  }

  @Patch(':id/approve')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Approve a budget' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.budgetService.approve(id, req.user.id, req.user?.tenantId);
  }

  @Get(':id/vs-actual')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Budget vs actual comparison' })
  budgetVsActual(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.budgetService.getBudgetVsActual(id, req?.user?.tenantId);
  }
}
