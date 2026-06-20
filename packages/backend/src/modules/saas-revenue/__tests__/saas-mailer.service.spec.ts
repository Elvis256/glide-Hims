import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SaasMailerService } from '../saas-mailer.service';
import { SaasEmailLog } from '../saas.entity';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

const mockSettingsService = {
  getByKey: jest.fn().mockRejectedValue(new Error('Not found')),
  getAll: jest.fn().mockResolvedValue([]),
  upsert: jest.fn().mockResolvedValue({}),
  getByPrefix: jest.fn().mockResolvedValue([]),
};

const mockEmailLogRepo = {
  create: jest.fn((d: any) => ({ ...d })),
  save: jest.fn().mockResolvedValue({}),
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
};

describe('SaasMailerService', () => {
  let service: SaasMailerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Ensure no SMTP so we get console-only delivery path
    delete process.env.SMTP_HOST;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasMailerService,
        { provide: SystemSettingsService, useValue: mockSettingsService },
        { provide: getRepositoryToken(SaasEmailLog), useValue: mockEmailLogRepo },
      ],
    }).compile();

    service = module.get(SaasMailerService);
  });

  // ── renderString ──────────────────────────────────────────────────────

  describe('renderString()', () => {
    it('replaces known variables', () => {
      const result = service.renderString('Hello {{name}}, your plan is {{plan}}.', {
        name: 'Alice',
        plan: 'Pro',
      });
      expect(result).toBe('Hello Alice, your plan is Pro.');
    });

    it('replaces unknown variables with empty string', () => {
      const result = service.renderString('Hello {{name}}, {{missing}} here.', {
        name: 'Bob',
      });
      expect(result).toBe('Hello Bob,  here.');
    });

    it('handles null values as empty string', () => {
      const result = service.renderString('Value: {{val}}', { val: null });
      expect(result).toBe('Value: ');
    });

    it('handles undefined values as empty string', () => {
      const result = service.renderString('Value: {{val}}', {});
      expect(result).toBe('Value: ');
    });

    it('converts numbers to string', () => {
      const result = service.renderString('Amount: {{amount}}', { amount: 42 });
      expect(result).toBe('Amount: 42');
    });

    it('handles template with whitespace around variable names', () => {
      const result = service.renderString('Hi {{ name }}!', { name: 'Carol' });
      expect(result).toBe('Hi Carol!');
    });

    it('returns template as-is when no variables present', () => {
      const result = service.renderString('No vars here.', { name: 'ignored' });
      expect(result).toBe('No vars here.');
    });
  });

  // ── template rendering ────────────────────────────────────────────────

  describe('template rendering', () => {
    it('renders invoice_issued template without error', async () => {
      const vars = service.sampleVarsFor('invoice_issued' as any);
      const result = await service.render('invoice_issued' as any, vars);
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(result.subject.length).toBeGreaterThan(0);
    });

    it('renders payment_receipt template without error', async () => {
      const vars = service.sampleVarsFor('payment_receipt' as any);
      const result = await service.render('payment_receipt' as any, vars);
      expect(result.subject.length).toBeGreaterThan(0);
    });

    it('renders dunning template without error', async () => {
      const vars = service.sampleVarsFor('dunning' as any);
      const result = await service.render('dunning' as any, vars);
      expect(result.subject.length).toBeGreaterThan(0);
    });

    it('renders renewal_reminder template without error', async () => {
      const vars = service.sampleVarsFor('renewal_reminder' as any);
      const result = await service.render('renewal_reminder' as any, vars);
      expect(result.subject.length).toBeGreaterThan(0);
    });

    it('renders trial_ending template without error', async () => {
      const vars = service.sampleVarsFor('trial_ending' as any);
      const result = await service.render('trial_ending' as any, vars);
      expect(result.subject.length).toBeGreaterThan(0);
    });
  });

  // ── send behaviour ────────────────────────────────────────────────────

  describe('send behaviour without SMTP', () => {
    it('logs to console and persists when no SMTP configured', async () => {
      const mockInvoice = {
        id: 'inv-1',
        invoiceNumber: 'INV-2026-00001',
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        subtotalMinor: 10000,
        discountMinor: 0,
        taxMinor: 1800,
        totalMinor: 11800,
        amountPaidMinor: 0,
        currency: 'UGX',
        dueAt: new Date(),
        lines: [{ description: 'Test', quantity: 1, unitPriceMinor: 10000, amountMinor: 10000 }],
      } as any;

      await service.sendInvoiceIssued('test@example.com', mockInvoice);
      // Should have persisted email log
      expect(mockEmailLogRepo.save).toHaveBeenCalled();
    });

    it('records skipped for null recipient', async () => {
      const mockInvoice = {
        id: 'inv-2',
        invoiceNumber: 'INV-2026-00002',
        subscriptionId: 'sub-1',
        tenantId: 'tenant-1',
        subtotalMinor: 5000,
        discountMinor: 0,
        taxMinor: 900,
        totalMinor: 5900,
        amountPaidMinor: 0,
        currency: 'UGX',
        dueAt: new Date(),
        lines: [],
      } as any;

      await service.sendInvoiceIssued(null, mockInvoice);
      // Should have called save (to persist skipped log)
      expect(mockEmailLogRepo.save).toHaveBeenCalled();
    });
  });
});
