import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { OrdersService } from '../orders.service';
import { Order, OrderType, OrderStatus } from '../../../database/entities/order.entity';
import { Encounter } from '../../../database/entities/encounter.entity';
import { Service } from '../../../database/entities/service-category.entity';
import { LabTest } from '../../../database/entities/lab-test.entity';
import { LabSample } from '../../../database/entities/lab-sample.entity';
import { LabResult } from '../../../database/entities/lab-result.entity';
import { ImagingOrder } from '../../../database/entities/imaging-order.entity';
import { ImagingModality } from '../../../database/entities/imaging-modality.entity';
import { BillingService } from '../../billing/billing.service';
import { InAppNotificationsService } from '../../in-app-notifications/in-app-notifications.service';
import { QueueManagementService } from '../../queue-management/queue-management.service';
import { AuditLogService } from '../../../common/interceptors/audit-log.service';

/**
 * The order lifecycle had three doors — updateStatus, completeOrder and
 * cancelOrder — each enforcing different rules, so the weakest one decided
 * what was actually possible.
 */

const uuid = (tag: string) => `00000000-0000-0000-0000-${tag.padStart(12, '0')}`;
const TENANT_ID = uuid('tenant1');
const USER_ID = uuid('user1');
const ORDER_ID = uuid('order1');

const repo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  save: jest.fn((e: any) => Promise.resolve(e)),
  update: jest.fn().mockResolvedValue(undefined),
  createQueryBuilder: jest.fn(),
  manager: { transaction: jest.fn() },
});

describe('OrdersService order status transitions', () => {
  let service: OrdersService;
  let orderRepo: ReturnType<typeof repo>;
  let labSampleRepo: ReturnType<typeof repo>;
  let labResultRepo: ReturnType<typeof repo>;

  beforeEach(async () => {
    orderRepo = repo();
    labSampleRepo = repo();
    labResultRepo = repo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Encounter), useValue: repo() },
        { provide: getRepositoryToken(Service), useValue: repo() },
        { provide: getRepositoryToken(LabTest), useValue: repo() },
        { provide: getRepositoryToken(LabSample), useValue: labSampleRepo },
        { provide: getRepositoryToken(LabResult), useValue: labResultRepo },
        { provide: getRepositoryToken(ImagingOrder), useValue: repo() },
        { provide: getRepositoryToken(ImagingModality), useValue: repo() },
        { provide: BillingService, useValue: { addBillableItem: jest.fn() } },
        { provide: InAppNotificationsService, useValue: { notifyNewOrder: jest.fn() } },
        { provide: QueueManagementService, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  const orderIn = (status: OrderStatus, orderType = OrderType.RADIOLOGY) => {
    orderRepo.findOne.mockResolvedValue({
      id: ORDER_ID,
      status,
      orderType,
      clinicalNotes: null,
      tenantId: TENANT_ID,
    });
  };

  describe('updateStatus', () => {
    it('refuses to complete an order that was cancelled', async () => {
      orderIn(OrderStatus.CANCELLED);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.COMPLETED } as any,
          USER_ID,
          TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to put a completed order back into the queue', async () => {
      orderIn(OrderStatus.COMPLETED);

      await expect(
        service.updateStatus(ORDER_ID, { status: OrderStatus.PENDING } as any, USER_ID, TENANT_ID),
      ).rejects.toThrow(/Cannot transition/);
    });

    it('refuses to cancel an order whose samples are already in the lab', async () => {
      // cancelOrder enforced this; updateStatus was the way around it.
      orderIn(OrderStatus.IN_PROGRESS, OrderType.LAB);
      labSampleRepo.count.mockResolvedValue(1);

      await expect(
        service.updateStatus(
          ORDER_ID,
          { status: OrderStatus.CANCELLED } as any,
          USER_ID,
          TENANT_ID,
        ),
      ).rejects.toThrow(/samples have already been collected/);
    });

    it('allows the ordinary step from pending into progress', async () => {
      orderIn(OrderStatus.PENDING);

      await service.updateStatus(
        ORDER_ID,
        { status: OrderStatus.IN_PROGRESS } as any,
        USER_ID,
        TENANT_ID,
      );

      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: ORDER_ID }),
        expect.objectContaining({ status: OrderStatus.IN_PROGRESS }),
      );
    });

    it('still allows a note-only update with no status change', async () => {
      orderIn(OrderStatus.IN_PROGRESS);

      await service.updateStatus(ORDER_ID, { notes: 'chased porter' } as any, USER_ID, TENANT_ID);

      expect(orderRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: ORDER_ID }),
        expect.objectContaining({ clinicalNotes: 'chased porter' }),
      );
    });
  });

  describe('completeOrder', () => {
    it('refuses a cancelled radiology order', async () => {
      // Only lab orders were refused here, and only by accident: a cancelled
      // lab order has no samples, so the results check rejected it. Radiology
      // skips that check and went straight through.
      orderIn(OrderStatus.CANCELLED, OrderType.RADIOLOGY);

      await expect(
        service.completeOrder(ORDER_ID, null, USER_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('completes an order that is in progress', async () => {
      orderIn(OrderStatus.IN_PROGRESS, OrderType.RADIOLOGY);

      const result = await service.completeOrder(ORDER_ID, null, USER_ID, TENANT_ID);

      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.completedById).toBe(USER_ID);
    });
  });

  describe('cancelOrder', () => {
    it('scopes the sample check to the tenant', async () => {
      orderIn(OrderStatus.PENDING, OrderType.LAB);

      await service.cancelOrder(ORDER_ID, 'ordered in error', USER_ID, TENANT_ID);

      expect(labSampleRepo.count).toHaveBeenCalledWith({
        where: { orderId: ORDER_ID, tenantId: TENANT_ID },
      });
    });
  });
});
