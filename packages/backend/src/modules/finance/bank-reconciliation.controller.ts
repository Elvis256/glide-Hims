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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { BankReconciliationService } from './bank-reconciliation.service';
import {
  CreateBankReconciliationDto,
  AddStatementItemsDto,
  ManualMatchDto,
} from './dto/bank-reconciliation.dto';

@ApiTags('Bank Reconciliation')
@ApiBearerAuth()
@Controller('finance/bank-reconciliation')
export class BankReconciliationController {
  constructor(private readonly bankReconService: BankReconciliationService) {}

  @Post()
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a new bank reconciliation' })
  async create(@Body() dto: CreateBankReconciliationDto, @Request() req: any) {
    return this.bankReconService.create(dto, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List bank reconciliations' })
  @ApiQuery({ name: 'facilityId', required: false })
  async findAll(@Query('facilityId') facilityId: string, @Request() req: any) {
    return this.bankReconService.findAll(facilityId, req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get bank reconciliation with items' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.bankReconService.findOne(id, req.user?.tenantId);
  }

  @Post(':id/statement-items')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Add bank statement items to reconciliation' })
  async addStatementItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStatementItemsDto,
    @Request() req: any,
  ) {
    return this.bankReconService.addStatementItems(id, dto.items, req.user?.tenantId);
  }

  @Post(':id/auto-match')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Auto-match statement items to journal entries' })
  async autoMatch(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.bankReconService.autoMatch(id, req.user?.tenantId);
  }

  @Patch('items/:itemId/match')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Manually match an item to a journal entry' })
  async manualMatch(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ManualMatchDto,
    @Request() req: any,
  ) {
    return this.bankReconService.manualMatch(itemId, dto.journalEntryId, req.user?.tenantId);
  }

  @Patch(':id/complete')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Complete a bank reconciliation' })
  async complete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.bankReconService.complete(id, req.user?.tenantId);
  }

  @Get(':id/summary')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get reconciliation summary (matched/unmatched/discrepancy)' })
  async getSummary(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.bankReconService.getSummary(id, req.user?.tenantId);
  }
}
