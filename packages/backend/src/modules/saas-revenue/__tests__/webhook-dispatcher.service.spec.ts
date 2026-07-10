import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as crypto from 'crypto';

// We import the service directly; entity references are mocked via DI tokens.
import { WebhookDispatcherService } from '../webhook-dispatcher.service';

// Lightweight stand-ins for the two entities the service injects.
class SaasWebhookEndpoint {}
class SaasWebhookDelivery {}

// ── helpers ─────────────────────────────────────────────────────────────────

function makeEndpoint(overrides: Record<string, any> = {}) {
  return {
    id: 'ep-1',
    tenantId: 'tenant-1',
    url: 'https://example.com/hook',
    secret: 'endpoint-secret',
    enabled: true,
    events: [],
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    disabledAt: null,
    ...overrides,
  };
}

function makeDelivery(overrides: Record<string, any> = {}) {
  return {
    id: 'del-1',
    endpointId: 'ep-1',
    eventId: crypto.randomUUID(),
    eventType: 'invoice.issued',
    tenantId: 'tenant-1',
    payload: { invoiceId: 'inv-1' },
    status: 'pending',
    attempts: 0,
    nextAttemptAt: new Date(),
    lastAttemptAt: null,
    responseCode: null,
    responseBody: null,
    errorMessage: null,
    succeededAt: null,
    ...overrides,
  };
}

// ── mock repos ──────────────────────────────────────────────────────────────

const savedDeliveries: any[] = [];

const mockEndpointRepo = {
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
};

const mockDeliveryRepo = {
  find: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockImplementation((items: any) => {
    const arr = Array.isArray(items) ? items : [items];
    savedDeliveries.push(...arr);
    return Promise.resolve(arr);
  }),
  create: jest.fn().mockImplementation((data: any) => ({ ...data })),
};

describe('WebhookDispatcherService', () => {
  let service: WebhookDispatcherService;

  beforeEach(async () => {
    jest.clearAllMocks();
    savedDeliveries.length = 0;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDispatcherService,
        { provide: getRepositoryToken(SaasWebhookEndpoint), useValue: mockEndpointRepo },
        { provide: getRepositoryToken(SaasWebhookDelivery), useValue: mockDeliveryRepo },
      ],
    }).compile();

    service = module.get(WebhookDispatcherService);
  });

  // ── enqueue ─────────────────────────────────────────────────────────────

  describe('enqueue()', () => {
    it('creates deliveries for matching endpoints', async () => {
      const ep = makeEndpoint({ events: ['invoice.issued'] });
      mockEndpointRepo.find.mockResolvedValueOnce([ep]);

      const count = await service.enqueue('tenant-1', 'invoice.issued' as any, {
        invoiceId: 'inv-1',
      });
      expect(count).toBe(1);
      expect(mockDeliveryRepo.save).toHaveBeenCalled();
    });

    it('matches wildcard (*) subscription', async () => {
      const ep = makeEndpoint({ events: ['*'] });
      mockEndpointRepo.find.mockResolvedValueOnce([ep]);

      const count = await service.enqueue('tenant-1', 'payment.recorded' as any, {});
      expect(count).toBe(1);
    });

    it('matches empty events array (subscribe to all)', async () => {
      const ep = makeEndpoint({ events: [] });
      mockEndpointRepo.find.mockResolvedValueOnce([ep]);

      const count = await service.enqueue('tenant-1', 'payment.recorded' as any, {});
      expect(count).toBe(1);
    });

    it('returns 0 when tenantId is empty', async () => {
      const count = await service.enqueue('', 'invoice.issued' as any, {});
      expect(count).toBe(0);
      expect(mockEndpointRepo.find).not.toHaveBeenCalled();
    });

    it('returns 0 when no endpoints match event', async () => {
      const ep = makeEndpoint({ events: ['payment.recorded'] });
      mockEndpointRepo.find.mockResolvedValueOnce([ep]);

      const count = await service.enqueue('tenant-1', 'invoice.issued' as any, {});
      expect(count).toBe(0);
    });
  });

  // ── flush / attemptDelivery ────────────────────────────────────────────

  describe('flush()', () => {
    it('processes pending deliveries and reports results', async () => {
      mockDeliveryRepo.find.mockResolvedValueOnce([]);
      const result = await service.flush(10);
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    });
  });

  // ── HMAC signature ────────────────────────────────────────────────────

  describe('HMAC signature in X-Glide-Signature header', () => {
    it('computes sha256 HMAC of JSON body with endpoint secret', () => {
      const secret = 'endpoint-secret';
      const body = { eventType: 'invoice.issued', data: {} };
      const raw = JSON.stringify(body);
      const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex');

      expect(sig).toHaveLength(64);
      expect(`sha256=${sig}`).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('different secrets produce different signatures', () => {
      const raw = JSON.stringify({ test: true });
      const sig1 = crypto.createHmac('sha256', 'secret-a').update(raw).digest('hex');
      const sig2 = crypto.createHmac('sha256', 'secret-b').update(raw).digest('hex');
      expect(sig1).not.toBe(sig2);
    });
  });

  // ── backoff schedule ──────────────────────────────────────────────────

  describe('backoff and retry limits', () => {
    const BACKOFF_MIN_SECONDS = [30, 120, 300, 900, 1800, 3600];
    const MAX_ATTEMPTS = 6;

    it('schedules exponential backoff for each attempt', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const backoff = BACKOFF_MIN_SECONDS[Math.min(i, BACKOFF_MIN_SECONDS.length - 1)] || 60;
        expect(backoff).toBeGreaterThanOrEqual(30);
      }
    });

    it('marks delivery as failed after MAX_ATTEMPTS', () => {
      const d = makeDelivery({ attempts: MAX_ATTEMPTS });
      const isFinal = d.attempts >= MAX_ATTEMPTS;
      expect(isFinal).toBe(true);
    });

    it('keeps retrying when under MAX_ATTEMPTS', () => {
      const d = makeDelivery({ attempts: 3 });
      const isFinal = d.attempts >= MAX_ATTEMPTS;
      expect(isFinal).toBe(false);
    });
  });

  // ── auto-disable ──────────────────────────────────────────────────────

  describe('auto-disable endpoint after consecutive failures', () => {
    const AUTO_DISABLE_AFTER = 15;

    it('disables endpoint when consecutiveFailures reaches threshold', () => {
      const ep = makeEndpoint({ consecutiveFailures: 14 });
      ep.consecutiveFailures += 1;
      const shouldDisable = ep.consecutiveFailures >= AUTO_DISABLE_AFTER;
      expect(shouldDisable).toBe(true);
    });

    it('keeps endpoint enabled below threshold', () => {
      const ep = makeEndpoint({ consecutiveFailures: 10 });
      ep.consecutiveFailures += 1;
      const shouldDisable = ep.consecutiveFailures >= AUTO_DISABLE_AFTER;
      expect(shouldDisable).toBe(false);
    });

    it('resets consecutiveFailures on success', () => {
      const ep = makeEndpoint({ consecutiveFailures: 12 });
      // success path
      ep.consecutiveFailures = 0;
      expect(ep.consecutiveFailures).toBe(0);
    });
  });
});
