import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReferralsService } from './referrals.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CreateReferralDto, AcceptReferralDto, RejectReferralDto, CompleteReferralDto, ReferralFilterDto } from './dto/referral.dto';

@Controller('referrals')
@UseGuards(AuthGuard('jwt'))
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Post()
  @AuthWithPermissions('referrals.create')
  async create(@Body() dto: CreateReferralDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.referralsService.create(dto, req.user.sub, facilityId);
  }

  @Get()
  @AuthWithPermissions('referrals.read')
  async findAll(@Query() filter: ReferralFilterDto, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.referralsService.findAll(filter, facilityId);
  }

  @Get('incoming')
  @AuthWithPermissions('referrals.read')
  async getIncoming(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.referralsService.getIncomingReferrals(facilityId);
  }

  @Get('outgoing')
  @AuthWithPermissions('referrals.read')
  async getOutgoing(@Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.referralsService.getOutgoingReferrals(facilityId);
  }

  @Get('stats')
  @AuthWithPermissions('referrals.read')
  async getStats(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Request() req: any) {
    const facilityId = req.user.facilityId || req.headers['x-facility-id'];
    return this.referralsService.getReferralStats(
      facilityId,
      new Date(fromDate || new Date().setMonth(new Date().getMonth() - 1)),
      new Date(toDate || new Date()),
    );
  }

  @Get('patient/:patientId')
  @AuthWithPermissions('referrals.read')
  async findByPatient(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.referralsService.findByPatient(patientId);
  }

  @Get(':id')
  @AuthWithPermissions('referrals.read')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.referralsService.findOne(id);
  }

  @Post(':id/accept')
  @AuthWithPermissions('referrals.update')
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptReferralDto,
    @Request() req: any,
  ) {
    return this.referralsService.accept(id, dto, req.user.sub);
  }

  @Post(':id/reject')
  @AuthWithPermissions('referrals.update')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReferralDto,
    @Request() req: any,
  ) {
    return this.referralsService.reject(id, dto, req.user.sub);
  }

  @Post(':id/complete')
  @AuthWithPermissions('referrals.update')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteReferralDto,
  ) {
    return this.referralsService.complete(id, dto);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('referrals.update')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.referralsService.cancel(id, reason);
  }
}
