import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ContractService } from './contract.service';

@ApiTags('SaaS Contracts')
@Controller('saas-revenue/contracts')
export class ContractController {
  constructor(private readonly service: ContractService) {}

  private assertAdmin(req: any) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
  }

  @Get()
  @ApiOperation({ summary: 'List contracts' })
  async list(@Req() req: any, @Query('status') status?: string) {
    this.assertAdmin(req);
    return this.service.listContracts({ status });
  }

  @Post()
  @ApiOperation({ summary: 'Create a contract' })
  async create(@Req() req: any, @Body() dto: any) {
    this.assertAdmin(req);
    return this.service.createContract(dto, req.user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a contract' })
  async get(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.getContract(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contract' })
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    this.assertAdmin(req);
    return this.service.updateContract(id, dto);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a contract' })
  async activate(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.activateContract(id);
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Terminate a contract' })
  async terminate(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.terminateContract(id);
  }

  @Post('from-quotation/:quotationId')
  @ApiOperation({ summary: 'Create contract from a quotation' })
  async fromQuotation(@Req() req: any, @Param('quotationId') quotationId: string) {
    this.assertAdmin(req);
    return this.service.createContractFromQuotation(quotationId, req.user?.id);
  }

  @Get(':id/html')
  @ApiOperation({ summary: 'Print-ready HTML contract' })
  async html(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    this.assertAdmin(req);
    const html = await this.service.renderContractHtml(id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }
}
