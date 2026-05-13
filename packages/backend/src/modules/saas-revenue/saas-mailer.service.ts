import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SaasInvoice, SaasPayment, SaasSubscription, SaasPlan } from './saas.entity';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export type EmailTemplateKey =
  | 'invoice_issued'
  | 'payment_receipt'
  | 'dunning'
  | 'renewal_reminder'
  | 'trial_ending';

export interface EmailTemplate {
  subject: string;
  body: string; // inner HTML; wrapped by mailer
}

export interface EmailTemplateMeta {
  key: EmailTemplateKey;
  label: string;
  description: string;
  variables: string[];
  defaults: EmailTemplate;
}

const TEMPLATE_KEY_PREFIX = 'email_template:';

const VARS_INVOICE  = ['invoiceNumber','planName','amountDue','total','dueDate','currency'];
const VARS_RECEIPT  = ['receiptNumber','invoiceNumber','amount','method','gateway','paidAt','currency'];
const VARS_DUNNING  = ['invoiceNumber','outstanding','daysOverdue','currency'];
const VARS_RENEWAL  = ['planName','amount','renewalDate','daysUntil','currency'];
const VARS_TRIAL    = ['trialEndDate','planName'];

export const EMAIL_TEMPLATES_META: Record<EmailTemplateKey, EmailTemplateMeta> = {
  invoice_issued: {
    key: 'invoice_issued',
    label: 'Invoice issued',
    description: 'Sent when a new invoice is created or manually re-sent.',
    variables: VARS_INVOICE,
    defaults: {
      subject: 'Invoice {{invoiceNumber}} — {{total}} due',
      body: `<p>A new invoice has been issued.</p>
<ul>
  <li><b>Invoice #:</b> {{invoiceNumber}}</li>
  <li><b>Plan:</b> {{planName}}</li>
  <li><b>Amount due:</b> {{amountDue}}</li>
  <li><b>Due:</b> {{dueDate}}</li>
</ul>
<p>Please complete payment to keep your subscription active.</p>`,
    },
  },
  payment_receipt: {
    key: 'payment_receipt',
    label: 'Payment receipt',
    description: 'Sent automatically when a payment is recorded against an invoice.',
    variables: VARS_RECEIPT,
    defaults: {
      subject: 'Receipt — {{amount}} received',
      body: `<p>Thank you — your payment has been received.</p>
<ul>
  <li><b>Receipt:</b> {{receiptNumber}}</li>
  <li><b>Invoice:</b> {{invoiceNumber}}</li>
  <li><b>Amount:</b> {{amount}}</li>
  <li><b>Method:</b> {{gateway}} {{method}}</li>
  <li><b>Date:</b> {{paidAt}}</li>
</ul>`,
    },
  },
  dunning: {
    key: 'dunning',
    label: 'Dunning (overdue)',
    description: 'Sent when a tenant invoice is past due and the dunning cron fires.',
    variables: VARS_DUNNING,
    defaults: {
      subject: 'Action required: invoice {{invoiceNumber}} is overdue',
      body: `<p>Your subscription invoice is <b>{{daysOverdue}} day(s)</b> past due.</p>
<ul>
  <li><b>Invoice:</b> {{invoiceNumber}}</li>
  <li><b>Outstanding:</b> {{outstanding}}</li>
</ul>
<p>Please settle to avoid service interruption. Subscriptions remain past-due for 30 days before being cancelled automatically.</p>`,
    },
  },
  renewal_reminder: {
    key: 'renewal_reminder',
    label: 'Renewal reminder',
    description: 'Sent a few days before a subscription renewal cycle.',
    variables: VARS_RENEWAL,
    defaults: {
      subject: 'Renewal reminder — {{daysUntil}} day(s)',
      body: `<p>Your subscription renews in <b>{{daysUntil}} day(s)</b>.</p>
<ul>
  <li><b>Plan:</b> {{planName}}</li>
  <li><b>Amount:</b> {{amount}}</li>
  <li><b>Renewal date:</b> {{renewalDate}}</li>
</ul>`,
    },
  },
  trial_ending: {
    key: 'trial_ending',
    label: 'Trial ending',
    description: 'Sent when a free trial is about to expire.',
    variables: VARS_TRIAL,
    defaults: {
      subject: 'Your trial is ending soon',
      body: `<p>Your trial of <b>{{planName}}</b> ends on <b>{{trialEndDate}}</b>. Add a payment method to continue without interruption.</p>`,
    },
  },
};

@Injectable()
export class SaasMailerService {
  private readonly logger = new Logger(SaasMailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private from = process.env.SAAS_MAIL_FROM || process.env.SMTP_FROM || 'billing@glidehims.local';

  constructor(private readonly settings: SystemSettingsService) {
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

  // ---------- Template loading & rendering ----------
  async getTemplate(key: EmailTemplateKey): Promise<EmailTemplate> {
    const meta = EMAIL_TEMPLATES_META[key];
    try {
      const row = await this.settings.getByKey(`${TEMPLATE_KEY_PREFIX}${key}`);
      const v = (row?.value || {}) as Partial<EmailTemplate>;
      return {
        subject: v.subject || meta.defaults.subject,
        body: v.body || meta.defaults.body,
      };
    } catch {
      return meta.defaults;
    }
  }

  async setTemplate(key: EmailTemplateKey, t: EmailTemplate) {
    if (!EMAIL_TEMPLATES_META[key]) throw new Error(`Unknown template key: ${key}`);
    return this.settings.upsert(`${TEMPLATE_KEY_PREFIX}${key}`, t, undefined, `SaaS email template: ${key}`);
  }

  async resetTemplate(key: EmailTemplateKey) {
    try { await this.settings.delete(`${TEMPLATE_KEY_PREFIX}${key}`); } catch { /* not set */ }
    return EMAIL_TEMPLATES_META[key].defaults;
  }

  async listTemplates() {
    const out: Array<EmailTemplateMeta & { current: EmailTemplate; isCustom: boolean }> = [];
    for (const meta of Object.values(EMAIL_TEMPLATES_META)) {
      let isCustom = false;
      try { await this.settings.getByKey(`${TEMPLATE_KEY_PREFIX}${meta.key}`); isCustom = true; } catch { /* default */ }
      const current = await this.getTemplate(meta.key);
      out.push({ ...meta, current, isCustom });
    }
    return out;
  }

  renderString(tmpl: string, vars: Record<string, any>): string {
    return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
      const v = vars[k];
      return v === undefined || v === null ? '' : String(v);
    });
  }

  async render(key: EmailTemplateKey, vars: Record<string, any>): Promise<{ subject: string; html: string }> {
    const t = await this.getTemplate(key);
    return {
      subject: this.renderString(t.subject, vars),
      html: this.wrap(EMAIL_TEMPLATES_META[key].label, this.renderString(t.body, vars)),
    };
  }

  // ---------- Helpers ----------
  private fmt(minor: number, currency: string) {
    return `${currency} ${(minor / 100).toLocaleString()}`;
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

  // ---------- Variable builders ----------
  private varsFromInvoice(inv: SaasInvoice, plan?: SaasPlan): Record<string, any> {
    return {
      invoiceNumber: inv.invoiceNumber,
      planName: plan?.name ?? '',
      amountDue: this.fmt(inv.totalMinor - inv.amountPaidMinor, inv.currency),
      total: this.fmt(inv.totalMinor, inv.currency),
      dueDate: new Date(inv.dueAt).toLocaleDateString(),
      currency: inv.currency,
    };
  }

  // ---------- Public send methods ----------
  async sendInvoiceIssued(to: string | null, inv: SaasInvoice, plan?: SaasPlan) {
    const { subject, html } = await this.render('invoice_issued', this.varsFromInvoice(inv, plan));
    return this.send(to, subject, html);
  }

  async sendPaymentReceipt(to: string | null, pay: SaasPayment, inv: SaasInvoice) {
    const vars = {
      receiptNumber: pay.id.slice(0, 8).toUpperCase(),
      invoiceNumber: inv.invoiceNumber,
      amount: this.fmt(pay.amountMinor, pay.currency),
      method: pay.method ? `(${pay.method})` : '',
      gateway: pay.gateway,
      paidAt: new Date(pay.paidAt).toLocaleString(),
      currency: pay.currency,
    };
    const { subject, html } = await this.render('payment_receipt', vars);
    return this.send(to, subject, html);
  }

  async sendDunning(to: string | null, _sub: SaasSubscription, inv: SaasInvoice, daysOverdue: number) {
    const vars = {
      invoiceNumber: inv.invoiceNumber,
      outstanding: this.fmt(inv.totalMinor - inv.amountPaidMinor, inv.currency),
      daysOverdue,
      currency: inv.currency,
    };
    const { subject, html } = await this.render('dunning', vars);
    return this.send(to, subject, html);
  }

  async sendRenewalReminder(to: string | null, sub: SaasSubscription, daysUntil: number) {
    const vars = {
      planName: (sub as any).plan?.name ?? sub.planId,
      amount: this.fmt(sub.unitPriceMinor * sub.seats, sub.currency),
      renewalDate: sub.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString() : '—',
      daysUntil,
      currency: sub.currency,
    };
    const { subject, html } = await this.render('renewal_reminder', vars);
    return this.send(to, subject, html);
  }

  async sendTrialEnding(to: string | null, sub: SaasSubscription) {
    const vars = {
      planName: (sub as any).plan?.name ?? sub.planId,
      trialEndDate: sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : 'soon',
    };
    const { subject, html } = await this.render('trial_ending', vars);
    return this.send(to, subject, html);
  }

  // ---------- Sample data for preview/test ----------
  sampleVarsFor(key: EmailTemplateKey): Record<string, any> {
    switch (key) {
      case 'invoice_issued':
        return { invoiceNumber: 'INV-2026-00042', planName: 'Professional', amountDue: 'UGX 15,000.00', total: 'UGX 15,000.00', dueDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString(), currency: 'UGX' };
      case 'payment_receipt':
        return { receiptNumber: 'A1B2C3D4', invoiceNumber: 'INV-2026-00042', amount: 'UGX 15,000.00', method: '(card)', gateway: 'flutterwave', paidAt: new Date().toLocaleString(), currency: 'UGX' };
      case 'dunning':
        return { invoiceNumber: 'INV-2026-00042', outstanding: 'UGX 15,000.00', daysOverdue: 7, currency: 'UGX' };
      case 'renewal_reminder':
        return { planName: 'Professional', amount: 'UGX 15,000.00', renewalDate: new Date(Date.now() + 5 * 86400000).toLocaleDateString(), daysUntil: 5, currency: 'UGX' };
      case 'trial_ending':
        return { planName: 'Professional', trialEndDate: new Date(Date.now() + 3 * 86400000).toLocaleDateString() };
    }
  }

  async previewTemplate(key: EmailTemplateKey, override?: Partial<EmailTemplate>): Promise<{ subject: string; html: string }> {
    const base = await this.getTemplate(key);
    const t: EmailTemplate = { subject: override?.subject ?? base.subject, body: override?.body ?? base.body };
    const vars = this.sampleVarsFor(key);
    return { subject: this.renderString(t.subject, vars), html: this.wrap(EMAIL_TEMPLATES_META[key].label, this.renderString(t.body, vars)) };
  }

  async sendTest(key: EmailTemplateKey, to: string) {
    const { subject, html } = await this.previewTemplate(key);
    await this.send(to, `[TEST] ${subject}`, html);
    return { ok: true, to };
  }
}
