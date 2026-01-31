import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  Request,
} from '@nestjs/common';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { DisposalService } from './disposal.service';
import { CreateDisposalDto, UpdateDisposalDto, DisposalQueryDto } from './disposal.dto';

@Controller('disposal')
export class DisposalController {
  constructor(private readonly disposalService: DisposalService) {}

  @Post()
  @AuthWithPermissions('disposal.create')
  async create(@Body() dto: CreateDisposalDto, @Request() req: any) {
    return this.disposalService.create(dto, req.user.id);
  }

  @Get()
  @AuthWithPermissions('disposal.read')
  async findAll(@Query() query: DisposalQueryDto) {
    return this.disposalService.findAll(query);
  }

  @Get('facility/:facilityId')
  @AuthWithPermissions('disposal.read')
  async findByFacility(@Param('facilityId') facilityId: string) {
    return this.disposalService.findByFacility(facilityId);
  }

  @Get('stats/:facilityId')
  @AuthWithPermissions('disposal.read')
  async getStats(
    @Param('facilityId') facilityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.disposalService.getStats(
      facilityId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('summary/:facilityId')
  @AuthWithPermissions('disposal.read')
  async getSummary(@Param('facilityId') facilityId: string) {
    return this.disposalService.getSummary(facilityId);
  }

  @Get(':id')
  @AuthWithPermissions('disposal.read')
  async findOne(@Param('id') id: string) {
    return this.disposalService.findOne(id);
  }

  @Put(':id')
  @AuthWithPermissions('disposal.update')
  async update(@Param('id') id: string, @Body() dto: UpdateDisposalDto) {
    return this.disposalService.update(id, dto);
  }

  @Put(':id/approve')
  @AuthWithPermissions('disposal.approve')
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.disposalService.approve(id, req.user.id);
  }
}
