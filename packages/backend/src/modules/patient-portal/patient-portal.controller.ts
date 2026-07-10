import { Body, Controller, Get, Post, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PatientPortalService } from './patient-portal.service';
import { PatientPortalGuard } from './patient-portal.guard';
import { RequestOtpDto, VerifyOtpDto } from './dto/portal.dto';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

const PORTAL_COOKIE = 'portalToken';
const PORTAL_TTL_SECONDS = 7 * 24 * 60 * 60;

@ApiTags('patient-portal')
@Controller('portal')
export class PatientPortalController {
  constructor(private readonly service: PatientPortalService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a 6-digit OTP to the patient phone' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.service.requestOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify the OTP and receive a patient access token' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, patient } = await this.service.verifyOtp(dto.phone, dto.code);
    // F-04: token is set as an httpOnly cookie so XSS cannot exfiltrate it.
    res.cookie(PORTAL_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/portal',
      maxAge: PORTAL_TTL_SECONDS * 1000,
    });
    return { patient };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear the patient portal session cookie' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(PORTAL_COOKIE, { path: '/api/v1/portal' });
    return { ok: true };
  }

  @UseGuards(PatientPortalGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the logged-in patient profile' })
  me(@Req() req: any) {
    return this.service.getMe(req.patientId, req.ip);
  }

  @UseGuards(PatientPortalGuard)
  @ApiBearerAuth()
  @Get('appointments')
  @ApiOperation({ summary: "List the patient's appointments" })
  appointments(@Req() req: any) {
    return this.service.listAppointments(req.patientId, req.ip);
  }

  @UseGuards(PatientPortalGuard)
  @ApiBearerAuth()
  @Get('invoices')
  @ApiOperation({ summary: "List the patient's invoices" })
  invoices(@Req() req: any) {
    return this.service.listInvoices(req.patientId, req.ip);
  }

  @UseGuards(PatientPortalGuard)
  @ApiBearerAuth()
  @Get('lab-results')
  @ApiOperation({ summary: "List the patient's released lab results" })
  labResults(@Req() req: any) {
    return this.service.listLabResults(req.patientId, req.ip);
  }

  @UseGuards(PatientPortalGuard)
  @ApiBearerAuth()
  @Get('prescriptions')
  @ApiOperation({ summary: "List the patient's prescriptions" })
  prescriptions(@Req() req: any) {
    return this.service.listPrescriptions(req.patientId, req.ip);
  }
}
