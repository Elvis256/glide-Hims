import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SaasInvoice, SaasPayment, SaasSubscription, SaasPlan } from './saas.entity';

@Injectable()
export class SaasMailerService {
  private readonly logger = new Logger(SaasMailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = process.env.SAAS_MAIL_FROM || process.env.SMTP_FROM || 'billing@glidehims.local';

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      this.logger.log(`SMTP transport ready via ${host}`);
    } else {
      this.logger.warn('SMTP not configured (SMTP_HOST missing) — emails will be logged to console only');
    }
  }

  private fmt(minor: number, currency: string) {
    return `${currency} ${(minor / 100).toLocaleString()}`;
  }

  private async send(to: string | null | undefined, subject: string, html: string) {
    if (!to) {
      this.logger.warn(`Skipping email "${subject}" — no recipient`);
      return;
    }
    if (!this.transporter) {
      this.logger.log(`[MAIL→${to}] ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Sent "${subject}" to ${to}`);
    } catch (e: any) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${e.message}`);
    }
  }

  private wrap(title: string, body: string) {
    return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f5f7fa;padding:20px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px;color:#111;">${title}</h2>
        <div style="color:#374151;line-height:1.55;font-size:14px;">${body}</div>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
        <div style="font-size:12px;color:#6b7280;">Glide-HIMS Billing · ${new Date().getFullYear()}</div>
      </div></body></html>`;
  }

  sendInvoiceIssued(to: string | null, inv: SaasInvoice, plan?: SaasPlan) {
    const body = `
      <p>A new invoice has been issued.</p>
      <ul>
        <li><b>Invoice #:</b> ${inv.invoiceNumber}</li>
        ${plan ? `<li><b>Plan:</b> ${plan.name}</li>` : ''}
        <li><b>Amount due:</b> ${this.fmt(inv.totalMinor - inv.amountPaidMinor, inv.currency)}</li>
        <li><b>Due:</b> ${new Date(inv.dueAt).toLocaleDateString()}</li>
      </ul>
      <p>Please complete payment to keep your subscription active.</p>`;
    return this.send(to, `Invoice ${inv.invoiceNumber} — ${this.fmt(inv.totalMinor, inv.currency)} due`, this.wrap('Invoice issued', body));
  }

  sendPaymentReceipt(to: string | null, pay: SaasPayment, inv: SaasInvoice) {
    const body = `
      <p>Thank you — your payment has been received.</p>
      <ul>
        <li><b>Receipt:</b> ${pay.id.slice(0, 8).toUpperCase()}</li>
        <li><b>Invoice:</b> ${inv.invoiceNumber}</li>
        <li><b>Amount:</b> ${this.fmt(pay.amountMinor, pay.currency)}</li>
        <li><b>Method:</b> ${pay.gateway}${pay.method ? ` (${pay.method})` : ''}</li>
        <li><b>Date:</b> ${new Date(pay.paidAt).toLocaleString()}</li>
      </ul>`;
    return this.send(to, `Receipt — ${this.fmt(pay.amountMinor, pay.currency)} received`, this.wrap('Payment received', body));
  }

  sendDunning(to: string | null, sub: SaasSubscription, inv: SaasInvoice, daysOverdue: number) {
    const body = `
      <p>Your subscription invoice is <b>${daysOverdue} day(s)</b> past due.</p>
      <ul>
        <li><b>Invoice:</b> ${inv.invoiceNumber}</li>
        <li><b>Outstanding:</b> ${this.fmt(inv.totalMinor - inv.amountPaidMinor, inv.currency)}</li>
      </ul>
      <p>Please settle to avoid service interruption. Subscriptions remain past-due for 30 days before being cancelled automatically.</p>`;
    return this.send(to, `Action required: invoice ${inv.invoiceNumber} is overdue`, this.wrap('Payment overdue', body));
  }

  sendRenewalReminder(to: string | null, sub: SaasSubscription, daysUntil: number) {
    const body = `
      <p>Your subscription renews in <b>${daysUntil} day(s)</b>.</p>
      <ul>
        <li><b>Plan:</b> ${(sub as any).plan?.name ?? sub.planId}</li>
        <li><b>Amount:</b> ${this.fmt(sub.unitPriceMinor * sub.seats, sub.currency)}</li>
        <li><b>Renewal date:</b> ${sub.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString() : '—'}</li>
      </ul>`;
    return this.send(to, `Renewal reminder — ${daysUntil} day(s)`, this.wrap('Upcoming renewal', body));
  }

  sendTrialEnding(to: string | null, sub: SaasSubscription) {
    const body = `<p>Your trial ends on <b>${sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : 'soon'}</b>. Add a payment method to continue without interruption.</p>`;
    return this.send(to, 'Your trial is ending soon', this.wrap('Trial ending', body));
  }
}
