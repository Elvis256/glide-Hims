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
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CostCenterService } from './cost-center.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('Cost Centers')
@Controller('finance/cost-centers')
export class CostCenterController {
  constructor(private costCenterService: CostCenterService) {}

  @Post()
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Create a cost center' })
  create(@Body() dto: any, @Request() req: any) {
    return this.costCenterService.create(dto, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'List cost centers' })
  findAll(@Query('facilityId') facilityId?: string, @Request() req?: any) {
    return this.costCenterService.findAll(facilityId, req?.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('finance.read')
  @ApiOperation({ summary: 'Get a cost center by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.costCenterService.findOne(id, req?.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Update a cost center' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @Request() req?: any) {
    return this.costCenterService.update(id, dto, req?.user?.tenantId);
  }

  @Patch(':id/deactivate')
  @AuthWithPermissions('finance.manage')
  @ApiOperation({ summary: 'Deactivate a cost center' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req?: any) {
    return this.costCenterService.deactivate(id, req?.user?.tenantId);
  }
}
