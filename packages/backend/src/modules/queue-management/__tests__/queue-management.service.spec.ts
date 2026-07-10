import { BadRequestException } from '@nestjs/common';
import { QueueManagementService } from '../queue-management.service';
import { QueuePriority, QueueStatus, ServicePoint } from '../../../database/entities/queue.entity';

function createService() {
  const queueRepository = {
    findOne: jest.fn(),
    count: jest.fn(),
  } as any;

  const queueDisplayRepository = {} as any;
  const encounterRepository = {
    findOne: jest.fn().mockResolvedValue(null),
  } as any;
  const doctorDutyRepository = {
    findOne: jest.fn(),
  } as any;
  const auditLogRepository = {} as any;
  const systemSettingRepository = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([{ key: 'billing.mode', value: 'pre_pay' }]),
  } as any;
  const invoiceRepository = {} as any;
  const invoiceItemRepository = {} as any;
  const serviceRepository = {} as any;
  const departmentRepository = {
    findOne: jest.fn(),
  } as any;
  const smsService = {} as any;
  const doctorFeesService = {} as any;
  const inAppNotifications = {} as any;
  const dataSource = {} as any;

  const service = new QueueManagementService(
    queueRepository,
    queueDisplayRepository,
    encounterRepository,
    doctorDutyRepository,
    auditLogRepository,
    systemSettingRepository,
    invoiceRepository,
    invoiceItemRepository,
    serviceRepository,
    departmentRepository,
    smsService,
    doctorFeesService,
    inAppNotifications,
    dataSource,
  );

  return {
    service,
    queueRepository,
    doctorDutyRepository,
    departmentRepository,
  };
}

describe('QueueManagementService.validateQueueRequest', () => {
  const baseDto = {
    patientId: '11111111-1111-1111-1111-111111111111',
    servicePoint: ServicePoint.CONSULTATION,
    departmentId: '22222222-2222-2222-2222-222222222222',
    visitType: 'new_visit',
    paymentType: 'cash',
    patientConditionFlags: [],
  };

  it('throws when selected department is invalid for facility', async () => {
    const { service, departmentRepository } = createService();
    departmentRepository.findOne.mockResolvedValue(null);

    await expect(
      service.validateQueueRequest(baseDto as any, 'facility-1', 'tenant-1'),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.validateQueueRequest(baseDto as any, 'facility-1', 'tenant-1'),
    ).rejects.toThrow('Selected department is invalid for this facility');
  });

  it('throws when selected department is not active', async () => {
    const { service, departmentRepository } = createService();
    departmentRepository.findOne.mockResolvedValue({
      id: baseDto.departmentId,
      name: 'Laboratory',
      status: 'inactive',
    });

    await expect(
      service.validateQueueRequest(baseDto as any, 'facility-1', 'tenant-1'),
    ).rejects.toThrow('Please select an active department');
  });

  it('throws when assigned doctor is off duty', async () => {
    const { service, departmentRepository, doctorDutyRepository } = createService();
    departmentRepository.findOne.mockResolvedValue({
      id: baseDto.departmentId,
      name: 'Outpatient',
      status: 'active',
    });
    doctorDutyRepository.findOne.mockResolvedValue({
      doctorId: '33333333-3333-3333-3333-333333333333',
      status: 'off_duty',
    });

    await expect(
      service.validateQueueRequest(
        {
          ...baseDto,
          assignedDoctorId: '33333333-3333-3333-3333-333333333333',
        } as any,
        'facility-1',
        'tenant-1',
      ),
    ).rejects.toThrow('Selected doctor is not currently checked in');
  });

  it('throws when patient already has active queue token', async () => {
    const { service, departmentRepository, queueRepository } = createService();
    departmentRepository.findOne.mockResolvedValue({
      id: baseDto.departmentId,
      name: 'Outpatient',
      status: 'active',
    });
    queueRepository.findOne.mockResolvedValue({
      ticketNumber: 'C001',
      patient: { fullName: 'Jane Doe' },
    });

    await expect(
      service.validateQueueRequest(baseDto as any, 'facility-1', 'tenant-1'),
    ).rejects.toThrow('already in queue with token C001');
  });

  it('throws when service point is at capacity', async () => {
    const { service, departmentRepository, queueRepository } = createService();
    departmentRepository.findOne.mockResolvedValue({
      id: baseDto.departmentId,
      name: 'Outpatient',
      status: 'active',
    });
    queueRepository.findOne.mockResolvedValue(null);
    queueRepository.count.mockResolvedValue(5);

    jest.spyOn(service, 'getServiceConfig').mockResolvedValue({
      capacityLimits: {
        [ServicePoint.CONSULTATION]: 5,
      },
      priorityRules: [],
    } as any);

    await expect(
      service.validateQueueRequest(baseDto as any, 'facility-1', 'tenant-1'),
    ).rejects.toThrow('is at capacity (5 patients)');
  });

  it('returns computed validation result when request is valid', async () => {
    const { service, departmentRepository, queueRepository } = createService();
    departmentRepository.findOne.mockResolvedValue({
      id: baseDto.departmentId,
      name: 'Outpatient',
      status: 'active',
    });
    queueRepository.findOne.mockResolvedValue(null);
    queueRepository.count.mockResolvedValue(2);

    jest.spyOn(service, 'getServiceConfig').mockResolvedValue({
      capacityLimits: {
        [ServicePoint.CONSULTATION]: 10,
      },
      priorityRules: [{ condition: 'elderly', priority: 4 }],
    } as any);

    const result = await service.validateQueueRequest(
      { ...baseDto, patientConditionFlags: ['elderly'] } as any,
      'facility-1',
      'tenant-1',
    );

    expect(result.valid).toBe(true);
    expect(result.resolvedPriority).toBe(QueuePriority.ELDERLY);
    expect(result.requiresPayment).toBe(true);
    expect(result.initialQueueStatus).toBe(QueueStatus.PENDING_PAYMENT);
    expect(result.servicePointCapacityLimit).toBe(10);
  });
});
