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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto, UpdateEncounterDto, UpdateStatusDto, EncounterQueryDto } from './encounters.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Encounters')
@ApiBearerAuth()
@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  @Auth()
  @ApiOperation({ summary: 'Create new encounter/visit' })
  create(@Body() dto: CreateEncounterDto, @Request() req: any) {
    return this.encountersService.create(dto, req.user.id);
  }

  @Get()
  @Auth()
  @ApiOperation({ summary: 'List encounters with filters' })
  findAll(@Query() query: EncounterQueryDto) {
    return this.encountersService.findAll(query);
  }

  @Get('queue')
  @Auth()
  @ApiOperation({ summary: 'Get today\'s patient queue' })
  getQueue(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.encountersService.getQueue(facilityId, departmentId);
  }

  @Get('stats/today')
  @Auth()
  @ApiOperation({ summary: 'Get today\'s encounter statistics' })
  getTodayStats(@Query('facilityId', ParseUUIDPipe) facilityId: string) {
    return this.encountersService.getTodayStats(facilityId);
  }

  @Get('visit/:visitNumber')
  @Auth()
  @ApiOperation({ summary: 'Get encounter by visit number' })
  findByVisitNumber(@Param('visitNumber') visitNumber: string) {
    return this.encountersService.findByVisitNumber(visitNumber);
  }

  @Get(':id')
  @Auth()
  @ApiOperation({ summary: 'Get encounter by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.encountersService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  @ApiOperation({ summary: 'Update encounter' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterDto,
  ) {
    return this.encountersService.update(id, dto);
  }

  @Patch(':id/status')
  @Auth()
  @ApiOperation({ summary: 'Update encounter status' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.encountersService.updateStatus(id, dto.status, dto.providerId);
  }

  @Delete(':id')
  @Auth('Admin', 'Super Admin')
  @ApiOperation({ summary: 'Delete encounter' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.encountersService.delete(id);
  }
}
