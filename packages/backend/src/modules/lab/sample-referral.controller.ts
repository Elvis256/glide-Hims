import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { SampleReferralService } from './sample-referral.service';
import {
  CreateSampleReferralDto,
  UpdateStageDto,
  RejectReferralDto,
  SampleReferralQueryDto,
  TATStatsQueryDto,
} from './dto/sample-referral.dto';
import { RequireModule } from '../auth/decorators/module.decorator';
import { ModuleGuard } from '../auth/guards/module.guard';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Lab Sample Referrals')
@ApiBearerAuth()
@UseGuards(ModuleGuard)
@RequireModule('diagnostics')
@Controller('lab/sample-referrals')
export class SampleReferralController {
  constructor(private readonly sampleReferralService: SampleReferralService) {}

  @Post()
  @AuthWithPermissions('lab.create')
  @ApiOperation({ summary: 'Create a sample referral' })
  create(@Body() dto: CreateSampleReferralDto, @Request() req: any) {
    return this.sampleReferralService.create(dto, req.user.id, req.user?.tenantId);
  }

  @Get()
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'List sample referrals' })
  @ApiQuery({ name: 'stage', required: false })
  @ApiQuery({ name: 'direction', required: false, enum: ['incoming', 'outgoing'] })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'priority', required: false, enum: ['STAT', 'URGENT', 'ROUTINE'] })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query() query: SampleReferralQueryDto, @Request() req: any) {
    const facilityId = query.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    return this.sampleReferralService.findAll(req.user?.tenantId, facilityId, query);
  }

  @Get('dashboard')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get referral dashboard stats' })
  getDashboard(@Request() req: any) {
    const facilityId = req.headers['x-facility-id'] || req.user?.facilityId;
    return this.sampleReferralService.getDashboard(req.user?.tenantId, facilityId);
  }

  @Get('tat-stats')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get TAT analytics' })
  @ApiQuery({ name: 'facilityId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  getTATStats(@Query() query: TATStatsQueryDto, @Request() req: any) {
    const facilityId = query.facilityId || req.headers['x-facility-id'] || req.user?.facilityId;
    return this.sampleReferralService.getTATStats(req.user?.tenantId, facilityId, query);
  }

  @Get(':id')
  @AuthWithPermissions('lab.read')
  @ApiOperation({ summary: 'Get a sample referral by ID' })
  findOne(@Param('id') id: string, @Request() req: any) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid referral ID format');
    }
    return this.sampleReferralService.findOne(id, req.user?.tenantId);
  }

  @Patch(':id/stage')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Advance referral stage' })
  updateStage(@Param('id') id: string, @Body() dto: UpdateStageDto, @Request() req: any) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid referral ID format');
    }
    return this.sampleReferralService.updateStage(id, dto, req.user.id, req.user?.tenantId);
  }

  @Patch(':id/reject')
  @AuthWithPermissions('lab.update')
  @ApiOperation({ summary: 'Reject a sample referral' })
  reject(@Param('id') id: string, @Body() dto: RejectReferralDto, @Request() req: any) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('Invalid referral ID format');
    }
    return this.sampleReferralService.reject(id, dto, req.user.id, req.user?.tenantId);
  }
}
