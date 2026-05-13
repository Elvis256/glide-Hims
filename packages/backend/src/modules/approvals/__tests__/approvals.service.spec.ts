import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException } from '@nestjs/common';
import { ApprovalsService } from '../approvals.service';
import {
  ProcurementApprovalChain,
  ApprovalChainStatus,
} from '../../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction } from '../../../database/entities/approval-action.entity';
import { OrgApprovalResolverService } from '../../procurement/org-approval-resolver.service';

/**
 * Unit tests for the cross-cutting Approvals engine. Focus is on the
 * authorisation matrix (named / group / permission / role) and the SLA
 * escalation contract — those are the bits that, if regressed, would
 * break every consumer module silently.
 */
describe('ApprovalsService', () => {
  let service: ApprovalsService;
  let chainRepo: any;
  let actionRepo: any;
  let dataSource: any;
  let events: EventEmitter2;

  const baseStep = (overrides: Partial<ProcurementApprovalChain> = {}) =>
    ({
      id: 'step-1',
      tenantId: 't1',
      module: 'procurement',
      documentType: 'PO',
      documentId: 'doc-1',
      approvalLevel: 1,
      requiredRole: 'manager',
      status: ApprovalChainStatus.PENDING,
      approverId: undefined,
      groupId: undefined,
      escalatedAt: undefined,
      ...overrides,
    }) as unknown as ProcurementApprovalChain;

  beforeEach(async () => {
    chainRepo = {
      save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    actionRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { query: jest.fn().mockResolvedValue([]) };
    events = new EventEmitter2();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalsService,
        { provide: getRepositoryToken(ProcurementApprovalChain), useValue: chainRepo },
        { provide: getRepositoryToken(ApprovalAction), useValue: actionRepo },
        { provide: OrgApprovalResolverService, useValue: { resolveStepsWithMetadata: jest.fn(), enrichSteps: jest.fn() } },
        { provide: EventEmitter2, useValue: events },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(ApprovalsService);
  });

  describe('assertCanAct', () => {
    it('allows the named approver', async () => {
      const step = baseStep({ approverId: 'user-A' });
      await expect(service.assertCanAct(step, 'user-A')).resolves.toBeUndefined();
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('allows a member of the assigned group', async () => {
      const step = baseStep({ groupId: 'grp-1' });
      dataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      await expect(service.assertCanAct(step, 'user-B')).resolves.toBeUndefined();
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('approver_group_members'),
        ['grp-1', 'user-B'],
      );
    });

    it('allows by permission code via permission:<code>', async () => {
      const step = baseStep({ requiredRole: 'permission:procurement.approve' });
      // direct permission lookup hits first
      dataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      await expect(service.assertCanAct(step, 'user-C')).resolves.toBeUndefined();
    });

    it('allows by role name via role:<name>', async () => {
      const step = baseStep({ requiredRole: 'role:CFO' });
      dataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      await expect(service.assertCanAct(step, 'user-D')).resolves.toBeUndefined();
    });

    it('rejects unrelated users', async () => {
      const step = baseStep({ approverId: 'someone-else', requiredRole: 'manager' });
      await expect(service.assertCanAct(step, 'user-X')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects when no actor', async () => {
      await expect(service.assertCanAct(baseStep(), '')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('escalate', () => {
    it('stamps escalatedAt, records action and emits approval.step.escalated', async () => {
      const step = baseStep();
      const heard: any[] = [];
      events.on('approval.step.escalated', (e) => heard.push(e));

      const result = await service.escalate(step, 'user-target');

      expect(result.escalatedAt).toBeInstanceOf(Date);
      expect(chainRepo.save).toHaveBeenCalledWith(step);
      expect(actionRepo.save).toHaveBeenCalled();
      expect(actionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'escalate', chainId: 'step-1' }),
      );
      expect(heard).toHaveLength(1);
      expect(heard[0]).toMatchObject({
        chainStepId: 'step-1',
        escalateToUserId: 'user-target',
        documentRef: { module: 'procurement', documentType: 'PO', documentId: 'doc-1' },
      });
    });

    it('is idempotent: second call is a no-op', async () => {
      const step = baseStep({ escalatedAt: new Date('2026-05-13T20:00:00Z') });
      const heard: any[] = [];
      events.on('approval.step.escalated', (e) => heard.push(e));

      await service.escalate(step);

      expect(chainRepo.save).not.toHaveBeenCalled();
      expect(actionRepo.save).not.toHaveBeenCalled();
      expect(heard).toHaveLength(0);
    });

    it('skips non-pending steps', async () => {
      const step = baseStep({ status: ApprovalChainStatus.APPROVED });
      await service.escalate(step);
      expect(chainRepo.save).not.toHaveBeenCalled();
    });
  });
});
