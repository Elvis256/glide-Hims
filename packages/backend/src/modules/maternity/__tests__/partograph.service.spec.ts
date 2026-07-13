import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PartographService } from '../partograph.service';
import { PartographObservation } from '../../../database/entities/partograph-observation.entity';
import { LabourRecord, LabourStatus } from '../../../database/entities/labour-record.entity';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';

// Anchor the labour 12 h in the past so observation timestamps are never
// rejected as "in the future"
const T0 = new Date(Date.now() - 12 * 3_600_000);
const hoursAfter = (h: number) => new Date(T0.getTime() + h * 3_600_000);

const obs = (observedAt: Date, dilation: number | null, fhr: number | null = 140) => ({
  id: `obs-${observedAt.toISOString()}`,
  labourRecordId: 'labour-1',
  observedAt,
  cervicalDilationCm: dilation,
  fetalHeartRate: fhr,
});

describe('PartographService', () => {
  let service: PartographService;
  let obsRepo: Record<string, jest.Mock>;
  let labourRepo: Record<string, jest.Mock>;
  let notifications: Record<string, jest.Mock>;
  let priorObservations: any[];

  const labour = {
    id: 'labour-1',
    labourNumber: 'LBR20260713-0001',
    status: LabourStatus.FIRST_STAGE,
    facilityId: 'facility-1',
  };

  beforeEach(async () => {
    priorObservations = [];
    obsRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };
    labourRepo = { findOne: jest.fn().mockResolvedValue({ ...labour }) };
    notifications = {
      getUserIdsByRole: jest.fn().mockResolvedValue(['nurse-1']),
      notifyMany: jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      transaction: jest.fn(async (cb: any) => {
        const manager = {
          findOne: jest.fn((entity: any) =>
            entity === LabourRecord ? Promise.resolve({ ...labour }) : Promise.resolve(null),
          ),
          find: jest.fn(() => Promise.resolve(priorObservations)),
          create: jest.fn((_e: any, data: any) => ({ id: 'obs-new', ...data })),
          save: jest.fn((entityOrData: any) => Promise.resolve(entityOrData)),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartographService,
        { provide: getRepositoryToken(PartographObservation), useValue: obsRepo },
        { provide: getRepositoryToken(LabourRecord), useValue: labourRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: InAppNotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(PartographService);
    // Sanity: the optional notifications dependency must be injected in tests
    expect((service as any).inAppNotifications).toBeTruthy();
  });

  it('rejects out-of-range values before writing', async () => {
    await expect(
      service.recordObservation(
        'labour-1',
        { cervicalDilationCm: 14 },
        'user-1',
        'tenant-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('reports latent phase while dilation stays below 4 cm', async () => {
    priorObservations = [obs(T0, 2)];
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: hoursAfter(2).toISOString(), cervicalDilationCm: 3 },
      'user-1',
      'tenant-1',
    );
    expect(result.progressStatus).toBe('latent_phase');
    expect(result.alerts).toHaveLength(0);
  });

  it('reports normal progress at ≥1 cm/hour', async () => {
    priorObservations = [obs(T0, 4)];
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: hoursAfter(3).toISOString(), cervicalDilationCm: 8 },
      'user-1',
      'tenant-1',
    );
    expect(result.progressStatus).toBe('normal');
    expect(notifications.notifyMany).not.toHaveBeenCalled();
  });

  it('fires an alert-line breach once when progress lags the 1 cm/hour line', async () => {
    priorObservations = [obs(T0, 4)];
    // 3 h later: expected ≥7 cm, actual 5 cm → alert line crossed (action
    // line at 3 h is still 4 cm, so not yet an action breach)
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: hoursAfter(3).toISOString(), cervicalDilationCm: 5 },
      'user-1',
      'tenant-1',
    );
    expect(result.progressStatus).toBe('alert_line_crossed');
    expect(result.alerts.join(' ')).toMatch(/ALERT line/);
    expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
  });

  it('escalates to the action line 4 hours behind the alert line', async () => {
    priorObservations = [obs(T0, 4), obs(hoursAfter(3), 5)];
    // 6 h after active start: action line expects ≥6 cm, actual 5 cm
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: hoursAfter(6).toISOString(), cervicalDilationCm: 5 },
      'user-1',
      'tenant-1',
    );
    expect(result.progressStatus).toBe('action_line_crossed');
    expect(result.alerts.join(' ')).toMatch(/ACTION line/);
  });

  it('does not re-alert while the breach state is unchanged', async () => {
    // Already breached at the previous observation → same status now
    priorObservations = [obs(T0, 4), obs(hoursAfter(3), 5)];
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: hoursAfter(3.5).toISOString(), cervicalDilationCm: 5 },
      'user-1',
      'tenant-1',
    );
    expect(result.progressStatus).toBe('alert_line_crossed');
    expect(result.alerts).toHaveLength(0);
    expect(notifications.notifyMany).not.toHaveBeenCalled();
  });

  it('flags abnormal fetal heart rate and notifies', async () => {
    priorObservations = [];
    const result = await service.recordObservation(
      'labour-1',
      { observedAt: T0.toISOString(), fetalHeartRate: 96 },
      'user-1',
      'tenant-1',
    );
    expect(result.fhrAbnormal).toBe(true);
    expect(result.alerts.join(' ')).toMatch(/fetal heart rate/i);
    expect(notifications.notifyMany).toHaveBeenCalledTimes(1);
  });
});
