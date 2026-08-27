import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  ConflictResolutionEngine,
  ConflictResolutionStrategy,
} from '../conflict-resolution.service';
import { ChangeSet } from '../../../database/entities/changeset.entity';

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Two changesets on one entity, opposing operations, under a second apart. */
const conflictingPair = (tenantId: string, entity: string, at: string) => [
  {
    id: `${entity}-1`,
    tenantId,
    entity,
    operation: 'update',
    createdAt: new Date(at),
    metadata: null as any,
  },
  {
    id: `${entity}-2`,
    tenantId,
    entity,
    operation: 'delete',
    createdAt: new Date(new Date(at).getTime() + 300),
    metadata: null as any,
  },
];

describe('ConflictResolutionEngine — the system-admin conflicts queue', () => {
  let engine: ConflictResolutionEngine;

  const mockChangesetRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn((rows) => Promise.resolve(rows)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConflictResolutionEngine,
        { provide: getRepositoryToken(ChangeSet), useValue: mockChangesetRepository },
      ],
    }).compile();
    engine = module.get<ConflictResolutionEngine>(ConflictResolutionEngine);
  });

  describe('getUnresolvedConflicts', () => {
    it('lists a conflicting pair that nobody has resolved', async () => {
      const rows = conflictingPair(TENANT_A, 'drug_catalog', '2026-08-26T10:00:00.000Z');
      mockChangesetRepository.find.mockResolvedValue(rows);

      const out = await engine.getUnresolvedConflicts(TENANT_A);

      expect(out).toHaveLength(1);
      expect(out[0].local.entity).toBe('drug_catalog');
    });

    it('drops a pair once it has been resolved, so the queue can empty', async () => {
      // detectConflicts is purely structural — it re-reports a resolved pair
      // forever. Before this filter the operator resolved a conflict and it was
      // still in the list on the next refresh.
      const rows = conflictingPair(TENANT_A, 'drug_catalog', '2026-08-26T10:00:00.000Z');
      rows[0].metadata = { conflictResolution: ConflictResolutionStrategy.KEEP_LOCAL };
      mockChangesetRepository.find.mockResolvedValue(rows);

      await expect(engine.getUnresolvedConflicts(TENANT_A)).resolves.toHaveLength(0);
    });

    it('keeps an unrelated unresolved pair visible while another is resolved', async () => {
      const resolved = conflictingPair(TENANT_A, 'drug_catalog', '2026-08-26T10:00:00.000Z');
      resolved[0].metadata = { conflictResolution: ConflictResolutionStrategy.MERGE };
      const open = conflictingPair(TENANT_A, 'tariff_catalog', '2026-08-26T12:00:00.000Z');
      mockChangesetRepository.find.mockResolvedValue([...resolved, ...open]);

      const out = await engine.getUnresolvedConflicts(TENANT_A);

      expect(out).toHaveLength(1);
      expect(out[0].local.entity).toBe('tariff_catalog');
    });
  });

  describe('resolveConflict', () => {
    it('looks both changesets up within the caller tenant', async () => {
      mockChangesetRepository.findOne.mockResolvedValue({ id: 'x', metadata: null });

      await engine.resolveConflict(
        TENANT_A,
        'local-1',
        'remote-1',
        ConflictResolutionStrategy.KEEP_LOCAL,
        'why',
      );

      expect(mockChangesetRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'local-1', tenantId: TENANT_A },
      });
      expect(mockChangesetRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'remote-1', tenantId: TENANT_A },
      });
    });

    it('refuses another tenant’s changeset rather than stamping it', async () => {
      mockChangesetRepository.findOne.mockResolvedValue(null);

      await expect(
        engine.resolveConflict(
          TENANT_A,
          'someone-elses-local',
          'someone-elses-remote',
          ConflictResolutionStrategy.MERGE,
          'why',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockChangesetRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('autoResolveConflicts', () => {
    it('resolves nothing, because detectConflicts only ever returns high severity', async () => {
      // Documenting a dead branch rather than hiding it: detectConflicts pushes
      // a conflict only when isConflict is true, and severity is 'high' exactly
      // when isConflict is true. autoResolveConflicts acts on severity 'low', so
      // its loop body is unreachable and it always reports autoResolved: 0.
      // This is why the endpoint is not exposed over HTTP.
      mockChangesetRepository.find.mockResolvedValue(
        conflictingPair(TENANT_A, 'drug_catalog', '2026-08-26T10:00:00.000Z'),
      );

      const out = await engine.autoResolveConflicts(TENANT_A);

      expect(out.detected).toBe(1);
      expect(out.autoResolved).toBe(0);
      expect(out.remaining).toBe(1);
      expect(mockChangesetRepository.save).not.toHaveBeenCalled();
    });
  });
});
