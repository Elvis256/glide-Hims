import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, Param, Post, Put, Query, RawBodyRequest, Req, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { SaasRevenueService } from './saas-revenue.service';
import { SaasMailerService, EMAIL_TEMPLATES_META, EmailTemplateKey } from './saas-mailer.service';
import {
  CreatePlanDto, UpdatePlanDto, CreateSubscriptionDto, ChangePlanDto, RecordPaymentDto, CreateCouponDto, UpdateCouponDto,
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
  constructor(
    private readonly svc: SaasRevenueService,
    private readonly mailer: SaasMailerService,
  ) {}

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

  @Put('coupons/:id')
  updateCoupon(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCouponDto) {
    ensureAdmin(req); return this.svc.updateCoupon(id, dto as any);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.deleteCoupon(id); }

  @Get('coupons/:id/redemptions')
  couponRedemptions(@Req() req: any, @Param('id') id: string) {
    ensureAdmin(req); return this.svc.listCouponRedemptions(id);
  }

  @Public()
  @Get('public/coupons/preview')
  previewCoupon(
    @Query('code') code: string,
    @Query('planId') planId?: string,
    @Query('billingInterval') billingInterval?: 'monthly' | 'annual',
    @Query('seats') seats?: string,
  ) {
    if (!code?.trim()) return { valid: false, reason: 'Coupon code required' };
    return this.svc.previewCoupon(code.trim(), planId, billingInterval || 'monthly', seats ? parseInt(seats, 10) : 1);
  }

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

  @Post('subscriptions/:id/sync-price')
  syncPrice(@Req() req: any, @Param('id') id: string) { ensureAdmin(req); return this.svc.syncSubscriptionPrice(id, req.user?.id); }

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

  @Post('payments/:id/refund')
  refundPayment(@Req() req: any, @Param('id') id: string, @Body() dto: { amountMinor?: number; reason?: string }) {
    ensureAdmin(req);
    return this.svc.refundPayment(id, dto || {}, req.user?.id);
  }

  @Post('invoices/:id/send-email')
  sendInv(@Req() req: any, @Param('id') id: string, @Body() body: { to?: string }) {
    ensureAdmin(req);
    return this.svc.sendInvoiceEmail(id, body?.to);
  }

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

  // ---------- Dunning rules (system-wide) ----------
  @Get('dunning-rules')
  getDunningRules(@Req() req: any) { ensureAdmin(req); return this.svc.getDunningRules(); }

  @Put('dunning-rules')
  updateDunningRules(@Req() req: any, @Body() dto: any) { ensureAdmin(req); return this.svc.updateDunningRules(dto || {}); }

  // ---------- VAT / tax rules (system-wide) ----------
  @Get('vat-rules')
  getVatRules(@Req() req: any) { ensureAdmin(req); return this.svc.getVatSettings(); }

  @Put('vat-rules')
  updateVatRules(@Req() req: any, @Body() dto: any) { ensureAdmin(req); return this.svc.updateVatSettings(dto || {}); }

  // ---------- Email templates ----------
  // All endpoints accept an optional `tenantId` query param to act on a
  // tenant-scoped override; omit for the global system template.
  @Get('email-templates')
  listEmailTemplates(@Req() req: any, @Query('tenantId') tenantId?: string) {
    ensureAdmin(req);
    return this.mailer.listTemplates(tenantId);
  }

  @Get('email-templates/:key')
  async getEmailTemplate(@Req() req: any, @Param('key') key: string, @Query('tenantId') tenantId?: string) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    const meta = EMAIL_TEMPLATES_META[key as EmailTemplateKey];
    const current = await this.mailer.getTemplate(key as EmailTemplateKey, tenantId);
    const history = await this.mailer.getTemplateHistory(key as EmailTemplateKey, tenantId);
    const storedHere = await this.mailer.getStoredTemplate(key as EmailTemplateKey, tenantId);
    return { ...meta, current, history, hasOverride: !!storedHere, scope: tenantId ? 'tenant' : 'global' };
  }

  @Put('email-templates/:key')
  async putEmailTemplate(
    @Req() req: any,
    @Param('key') key: string,
    @Body() body: { subject: string; body: string },
    @Query('tenantId') tenantId?: string,
  ) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    if (!body?.subject?.trim() || !body?.body?.trim()) throw new ForbiddenException('subject and body are required');
    await this.mailer.setTemplate(
      key as EmailTemplateKey,
      { subject: body.subject, body: body.body },
      { tenantId, actorId: req.user?.id },
    );
    return { ok: true };
  }

  @Delete('email-templates/:key')
  async resetEmailTemplate(@Req() req: any, @Param('key') key: string, @Query('tenantId') tenantId?: string) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    const defaults = await this.mailer.resetTemplate(key as EmailTemplateKey, tenantId);
    return { ok: true, defaults };
  }

  @Post('email-templates/:key/revert')
  async revertEmailTemplate(
    @Req() req: any,
    @Param('key') key: string,
    @Body() body: { versionIndex: number },
    @Query('tenantId') tenantId?: string,
  ) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    if (typeof body?.versionIndex !== 'number' || body.versionIndex < 0) throw new ForbiddenException('versionIndex required');
    await this.mailer.revertTemplate(key as EmailTemplateKey, body.versionIndex, { tenantId, actorId: req.user?.id });
    return { ok: true };
  }

  @Post('email-templates/:key/preview')
  async previewEmailTemplate(
    @Req() req: any,
    @Param('key') key: string,
    @Body() body: { subject?: string; body?: string },
    @Query('tenantId') tenantId?: string,
  ) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    return this.mailer.previewTemplate(key as EmailTemplateKey, body, tenantId);
  }

  @Post('email-templates/:key/test')
  async testEmailTemplate(
    @Req() req: any,
    @Param('key') key: string,
    @Body() body: { to: string },
    @Query('tenantId') tenantId?: string,
  ) {
    ensureAdmin(req);
    if (!(key in EMAIL_TEMPLATES_META)) throw new ForbiddenException('Unknown template');
    if (!body?.to?.trim()) throw new ForbiddenException('Recipient `to` is required');
    return this.mailer.sendTest(key as EmailTemplateKey, body.to.trim(), tenantId);
  }

  // ---------- Email send log ----------
  @Get('email-logs')
  listEmailLogs(
    @Req() req: any,
    @Query('tenantId') tenantId?: string,
    @Query('templateKey') templateKey?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    ensureAdmin(req);
    return this.mailer.listEmailLogs({
      tenantId,
      templateKey,
      status,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('email-logs/stats')
  emailLogStats(@Req() req: any, @Query('tenantId') tenantId?: string) {
    ensureAdmin(req);
    return this.mailer.emailLogStats(tenantId);
  }

  @Get('email-logs/:id')
  async getEmailLog(@Req() req: any, @Param('id') id: string) {
    ensureAdmin(req);
    const row = await this.mailer.getEmailLog(id);
    if (!row) throw new ForbiddenException('Not found');
    return row;
  }

  // ---------- Revenue dashboard ----------
  @Get('revenue/dashboard')
  dashboard(@Req() req: any) { ensureAdmin(req); return this.svc.getRevenueDashboard(); }

  @Get('revenue/plans/:planId')
  planAnalytics(@Req() req: any, @Param('planId') planId: string) {
    ensureAdmin(req); return this.svc.getPlanAnalytics(planId);
  }

  // ---------- Cron triggers (admin manual run) ----------
  @Post('cron/run')
  manualCron(@Req() req: any) { ensureAdmin(req); return this.svc.renewalTick().then(() => ({ ok: true })); }

  // ---------- Public pricing (no auth) ----------
  @Public()
  @Get('public/plans')
  publicPlans(@Query('currency') currency?: string) {
    return currency ? this.svc.listPublicPlansLocalized(currency) : this.svc.listPublicPlans();
  }

  // ---------- Currency / FX rates (system-wide) ----------
  @Public()
  @Get('public/currency-rates')
  getPublicCurrencyRates() { return this.svc.getCurrencyRates(); }

  @Get('currency-rates')
  getCurrencyRates(@Req() req: any) { ensureAdmin(req); return this.svc.getCurrencyRates(); }

  @Put('currency-rates')
  updateCurrencyRates(@Req() req: any, @Body() dto: any) { ensureAdmin(req); return this.svc.updateCurrencyRates(dto || {}); }

  @Post('currency-rates/refresh')
  refreshCurrencyRates(@Req() req: any, @Body() dto: any) {
    ensureAdmin(req);
    return this.svc.refreshCurrencyRatesFromProvider({ providerUrl: dto?.providerUrl });
  }

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

  @Get('portal/invoices/:id/print')
  async myInvoicePrint(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const tenantId = req.user?.isSystemAdmin ? undefined : ensureTenant(req);
    const html = await this.svc.renderInvoiceHtml(id, tenantId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('portal/invoices')
  myInvoices(@Req() req: any, @Query('status') status?: string) {
    const tenantId = req.user?.isSystemAdmin && req.query?.tenantId ? String(req.query.tenantId) : ensureTenant(req);
    return this.svc.listMyInvoices(tenantId, status);
  }

  @Get('portal/invoices/:id')
  myInvoice(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.isSystemAdmin ? undefined : ensureTenant(req);
    return tenantId ? this.svc.getMyInvoice(tenantId, id) : this.svc.getInvoice(id);
  }

  @Get('portal/invoices/:id/pdf')
  async myInvoicePdf(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const tenantId = req.user?.isSystemAdmin ? undefined : ensureTenant(req);
    const inv = await this.svc.getInvoice(id);
    if (tenantId && inv.tenantId !== tenantId) throw new ForbiddenException('Invoice does not belong to your tenant');
    const buf = await this.svc.renderInvoicePdf(id, tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}.pdf"`);
    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }

  @Get('portal/payment-methods')
  myPaymentMethods(@Req() req: any) {
    const tenantId = req.user?.isSystemAdmin && req.query?.tenantId ? String(req.query.tenantId) : ensureTenant(req);
    return this.svc.listMyPaymentMethods(tenantId);
  }

  @Post('portal/payment-methods')
  myAddPaymentMethod(@Req() req: any, @Body() dto: any) {
    const tenantId = req.user?.isSystemAdmin && req.body?.tenantId ? String(req.body.tenantId) : ensureTenant(req);
    return this.svc.addMyPaymentMethod(tenantId, dto || {});
  }

  @Put('portal/payment-methods/:id/default')
  mySetDefaultPaymentMethod(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.isSystemAdmin && req.query?.tenantId ? String(req.query.tenantId) : ensureTenant(req);
    return this.svc.setDefaultPaymentMethod(tenantId, id);
  }

  @Delete('portal/payment-methods/:id')
  myDeletePaymentMethod(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.isSystemAdmin && req.query?.tenantId ? String(req.query.tenantId) : ensureTenant(req);
    return this.svc.deleteMyPaymentMethod(tenantId, id);
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
