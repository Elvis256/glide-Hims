import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Put, Query, RawBodyRequest, Req, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { SaasRevenueService } from './saas-revenue.service';
import {
  CreatePlanDto, UpdatePlanDto, CreateSubscriptionDto, ChangePlanDto, RecordPaymentDto, CreateCouponDto,
  ConvertLeadDto, InitCheckoutDto,
} from './dtos';

function ensureAdmin(req: any) {
  if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
}
function ensureTenant(req: any): string {
  const tid = req.user?.tenantId;
  if (!tid) throw new ForbiddenException('Tenant context required');
  return tid;
}

@Controller('saas-revenue')
export class SaasRevenueController {
  constructor(private readonly svc: SaasRevenueService) {}

  // ---------- Plans ----------
  @Get('plans')
  listPlans(@Req() req: any, @Query('includeInactive') inc?: string) {
    // Plans are partially public (pricing page), but admin sees all.
    const includeInactive = inc === 'true' && !!req.user?.isSystemAdmin;
    return this.svc.listPlans(includeInactive);
  }

  @Get('plans/:id')
  getPlan(@Param('id') id: string) { return this.svc.getPlan(id); }

  @Post('plans')
  createPlan(@Req() req: any, @Body() dto: CreatePlanDto) { ensureAdmin(req); return this.svc.createPlan(dto); }

  @Put('plans/:id')
  updatePlan(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePlanDto) { ensureAdmin(req); return this.svc.updatePlan(id, dto); }

  @Delete('plans/:id')
  deletePlan(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.deletePlan(id); }

  // ---------- Coupons ----------
  @Get('coupons')
  listCoupons(@Req() req: any) { ensureAdmin(req); return this.svc.listCoupons(); }

  @Post('coupons')
  createCoupon(@Req() req: any, @Body() dto: CreateCouponDto) { ensureAdmin(req); return this.svc.createCoupon(dto); }

  @Delete('coupons/:id')
  deleteCoupon(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.deleteCoupon(id); }

  // ---------- Subscriptions ----------
  @Get('subscriptions')
  listSubs(@Req() req: any, @Query('status') status?: string, @Query('tenantId') tenantId?: string) {
    ensureAdmin(req); return this.svc.listSubscriptions({ status, tenantId });
  }

  @Get('subscriptions/:id')
  getSub(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.getSubscription(id); }

  @Post('subscriptions')
  createSub(@Req() req: any, @Body() dto: CreateSubscriptionDto) { ensureAdmin(req); return this.svc.createSubscription(dto, req.user?.id); }

  @Post('subscriptions/:id/change-plan')
  changePlan(@Req() req: any, @Param('id') id: string, @Body() dto: ChangePlanDto) { ensureAdmin(req); return this.svc.changePlan(id, dto, req.user?.id); }

  @Post('subscriptions/:id/cancel')
  cancel(@Req() req: any, @Param('id') id: string, @Body() body: { atPeriodEnd?: boolean; reason?: string }) {
    ensureAdmin(req); return this.svc.cancelSubscription(id, body?.atPeriodEnd ?? true, body?.reason, req.user?.id);
  }

  @Post('subscriptions/:id/pause')
  pause(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.pauseSubscription(id, req.user?.id); }

  @Post('subscriptions/:id/resume')
  resume(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.resumeSubscription(id, req.user?.id); }

  @Post('subscriptions/:id/sync-license')
  syncLicense(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.syncLicenseFromSubscription(id).then(() => ({ ok: true })); }

  // ---------- Invoices ----------
  @Get('invoices')
  listInv(@Req() req: any, @Query('status') status?: string, @Query('tenantId') tenantId?: string, @Query('subscriptionId') sId?: string) {
    ensureAdmin(req); return this.svc.listInvoices({ status, tenantId, subscriptionId: sId });
  }

  @Get('invoices/:id')
  getInv(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.getInvoice(id); }

  @Post('invoices/:id/payments')
  recordPayment(@Req() req: any, @Param('id') id: string, @Body() dto: RecordPaymentDto) {
    ensureAdmin(req); return this.svc.recordPayment(id, dto, req.user?.id);
  }

  @Post('invoices/:id/void')
  voidInv(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.voidInvoice(id, req.user?.id); }

  @Get('invoices/:id/print')
  async printInv(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    ensureAdmin(req);
    const html = await this.svc.renderInvoiceHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  // ---------- Vendor billing identity (system-wide settings) ----------
  @Get('billing-settings')
  getBillingSettings(@Req() req: any) { ensureAdmin(req); return this.svc.getVendorBilling(); }

  @Put('billing-settings')
  updateBillingSettings(@Req() req: any, @Body() dto: any) { ensureAdmin(req); return this.svc.updateVendorBilling(dto || {}); }

  // ---------- Revenue dashboard ----------
  @Get('revenue/dashboard')
  dashboard(@Req() req: any) { ensureAdmin(req); return this.svc.getRevenueDashboard(); }

  // ---------- Cron triggers (admin manual run) ----------
  @Post('cron/run')
  manualCron(@Req() req: any) { ensureAdmin(req); return this.svc.renewalTick().then(() => ({ ok: true })); }

  // ---------- Public pricing (no auth) ----------
  @Public()
  @Get('public/plans')
  publicPlans() { return this.svc.listPublicPlans(); }

  // ---------- Lead conversion ----------
  @Post('leads/:leadId/convert')
  convertLead(@Req() req: any, @Param('leadId') leadId: string, @Body() dto: ConvertLeadDto) {
    ensureAdmin(req);
    return this.svc.convertLead(leadId, dto, req.user?.id);
  }

  // ---------- Tenant self-serve billing portal ----------
  @Get('portal/me')
  myBilling(@Req() req: any) {
    if (req.user?.isSystemAdmin && req.query?.tenantId) return this.svc.getMyBilling(String(req.query.tenantId));
    return this.svc.getMyBilling(ensureTenant(req));
  }

  @Post('portal/checkout')
  myCheckout(@Req() req: any, @Body() dto: InitCheckoutDto) {
    const tenantId = req.user?.isSystemAdmin ? undefined : ensureTenant(req);
    const redirectUrl = dto.redirectUrl || `${process.env.PUBLIC_BASE_URL || ''}/billing-portal/return`;
    return this.svc.initCheckout(dto.invoiceId, { redirectUrl, customerEmail: dto.customerEmail, customerName: dto.customerName }, tenantId);
  }

  // ---------- Webhook (public, signature-verified) ----------
  @Public()
  @Post('webhooks/flutterwave')
  async flwWebhook(@Req() req: RawBodyRequest<any>, @Headers('verif-hash') signature?: string) {
    const raw = (req as any).rawBody?.toString('utf8') || JSON.stringify(req.body || {});
    return this.svc.handleFlutterwaveWebhook(raw, signature);
  }
}
