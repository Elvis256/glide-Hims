import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DonorFundService } from './donor-fund.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import {
  CreateDonorFundDto,
  RecordDonorExpenseDto,
  CreateInterFacilityTransactionDto,
  ApproveInterFacilityDto,
  SettleInterFacilityDto,
} from './dto/finance.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

@ApiTags('Donor Funds')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('finance')
@Controller('finance/donor-funds')
export class DonorFundController {
  constructor(private readonly donorFundService: DonorFundService) {}

  // ============ DONOR FUNDS ============

  @Post()
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a donor fund' })
  async createDonorFund(@Body() body: CreateDonorFundDto, @Request() req: any) {
    return this.donorFundService.createDonorFund(body as any, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List donor funds' })
  @ApiQuery({ name: 'facilityId', required: false })
  async findAllDonorFunds(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.donorFundService.findAllDonorFunds(facilityId, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get a donor fund by ID' })
  async findOneDonorFund(@Param('id') id: string, @Request() req: any) {
    return this.donorFundService.findOneDonorFund(id, req.user?.tenantId);
  }

  @Post(':id/expense')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Record an expense against a donor fund' })
  async recordDonorExpense(
    @Param('id') id: string,
    @Body() body: RecordDonorExpenseDto,
    @Request() req: any,
  ) {
    return this.donorFundService.recordDonorExpense(
      id,
      body.amount,
      body.description,
      body.userId ?? req.user?.id,
      req.user?.tenantId,
    );
  }

  // ============ INTER-FACILITY TRANSACTIONS ============

  @Post('inter-facility')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create an inter-facility transaction' })
  async createInterFacilityTransaction(
    @Body() body: CreateInterFacilityTransactionDto,
    @Request() req: any,
  ) {
    return this.donorFundService.createInterFacilityTransaction(
      {
        fromFacilityId: body.fromFacilityId,
        toFacilityId: body.toFacilityId,
        amount: body.amount,
        description: body.description ?? '',
        referenceNumber: body.referenceNumber ?? '',
        initiatedById: body.initiatedById ?? req.user?.id,
      },
      req.user?.tenantId,
    );
  }

  @Get('inter-facility')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List inter-facility transactions' })
  @ApiQuery({ name: 'facilityId', required: false })
  async findAllInterFacility(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.donorFundService.findAllInterFacility(facilityId, req?.user?.tenantId);
  }

  @Patch('inter-facility/:id/approve')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Approve an inter-facility transaction' })
  async approveInterFacility(
    @Param('id') id: string,
    @Body() body: ApproveInterFacilityDto,
    @Request() req: any,
  ) {
    return this.donorFundService.approveInterFacility(
      id,
      body.userId ?? req.user?.id,
      req.user?.tenantId,
    );
  }

  @Patch('inter-facility/:id/settle')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Settle an inter-facility transaction' })
  async settleInterFacility(
    @Param('id') id: string,
    @Body() body: SettleInterFacilityDto,
    @Request() req: any,
  ) {
    return this.donorFundService.settleInterFacility(
      id,
      body.userId ?? req.user?.id,
      req.user?.tenantId,
    );
  }
}
