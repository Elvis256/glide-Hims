import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { PettyCashService } from './petty-cash.service';
import {
  CreatePettyCashFundDto,
  RecordTransactionDto,
  ReplenishFundDto,
  FundStatementQueryDto,
} from './dto/petty-cash.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Petty Cash')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('finance')
@Controller('finance/petty-cash')
export class PettyCashController {
  constructor(private readonly pettyCashService: PettyCashService) {}

  @Post('funds')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a petty cash fund' })
  async createFund(@Body() dto: CreatePettyCashFundDto, @Request() req: any) {
    return this.pettyCashService.createFund(dto, req.user?.tenantId);
  }

  @Get('funds')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List petty cash funds' })
  @ApiQuery({ name: 'facilityId', required: false })
  async findAllFunds(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.pettyCashService.findAllFunds(facilityId, req.user?.tenantId);
  }

  @Get('funds/:id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get petty cash fund with recent transactions' })
  async findFund(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.pettyCashService.findFund(id, req.user?.tenantId);
  }

  @Post('funds/:id/transactions')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Record a petty cash transaction' })
  async recordTransaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordTransactionDto,
    @Request() req: any,
  ) {
    return this.pettyCashService.recordTransaction(id, dto, req.user?.tenantId, req.user?.id);
  }

  @Post('funds/:id/replenish')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Replenish a petty cash fund' })
  async replenish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplenishFundDto,
    @Request() req: any,
  ) {
    return this.pettyCashService.replenish(id, dto.amount, dto.approvedById, req.user?.tenantId);
  }

  @Get('funds/:id/statement')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get petty cash fund statement with running balance' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getFundStatement(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    return this.pettyCashService.getFundStatement(id, startDate, endDate, req.user?.tenantId);
  }
}
