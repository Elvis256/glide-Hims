import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { Employee } from '../../database/entities/employee.entity';
import { Department } from '../../database/entities/department.entity';
import {
  ApprovalDelegation,
  ApproverGroup,
  ApproverGroupMember,
  Position,
  ProcurementApprovalPolicy,
  ProcurementApprovalPolicyStep,
} from '../../database/entities/org-approval.entities';

@Injectable()
export class OrgAdminService {
  constructor(
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
    @InjectRepository(Position) private positionRepo: Repository<Position>,
    @InjectRepository(ApproverGroup) private groupRepo: Repository<ApproverGroup>,
    @InjectRepository(ApproverGroupMember) private memberRepo: Repository<ApproverGroupMember>,
    @InjectRepository(ProcurementApprovalPolicy)
    private policyRepo: Repository<ProcurementApprovalPolicy>,
    @InjectRepository(ProcurementApprovalPolicyStep)
    private stepRepo: Repository<ProcurementApprovalPolicyStep>,
    @InjectRepository(ApprovalDelegation) private delegationRepo: Repository<ApprovalDelegation>,
  ) {}

  // -------- Departments --------
  listDepartments(tenantId: string) {
    return this.deptRepo.find({ where: { tenantId }, order: { name: 'ASC' } as any });
  }

  async setDepartmentHead(id: string, headUserId: string | null, tenantId: string) {
    const dept = await this.deptRepo.findOne({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');
    dept.headUserId = headUserId || null;
    return this.deptRepo.save(dept);
  }

  async setDepartmentParent(id: string, parentId: string | null, tenantId: string) {
    const dept = await this.deptRepo.findOne({ where: { id, tenantId } });
    if (!dept) throw new NotFoundException('Department not found');
    dept.parentId = parentId || undefined;
    return this.deptRepo.save(dept);
  }

  // -------- Employees --------
  listEmployees(tenantId: string) {
    return this.employeeRepo.find({
      where: { tenantId },
      order: { firstName: 'ASC' } as any,
    });
  }

  async setEmployeeManager(id: string, managerId: string | null, tenantId: string) {
    const emp = await this.employeeRepo.findOne({ where: { id, tenantId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (managerId && managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager');
    }
    emp.managerId = managerId || undefined;
    return this.employeeRepo.save(emp);
  }

  async setEmployeePosition(id: string, positionId: string | null, tenantId: string) {
    const emp = await this.employeeRepo.findOne({ where: { id, tenantId } });
    if (!emp) throw new NotFoundException('Employee not found');
    emp.positionId = positionId || undefined;
    return this.employeeRepo.save(emp);
  }

  // -------- Positions --------
  listPositions(tenantId: string) {
    return this.positionRepo.find({
      where: { tenantId },
      order: { rank: 'DESC', name: 'ASC' } as any,
    });
  }

  async createPosition(data: Partial<Position>, tenantId: string) {
    const name = String((data as Record<string, unknown>)?.name || '').trim();
    if (!name) throw new BadRequestException('Position name is required');
    const code = String((data as Record<string, unknown>)?.code || '').trim() || null;
    const rank = Number((data as Record<string, unknown>)?.rank ?? 0) || 0;
    if (code) {
      const dupCode = await this.positionRepo.findOne({
        where: { tenantId, code },
      });
      if (dupCode) throw new BadRequestException(`Position code "${code}" already exists`);
    }
    const dupName = await this.positionRepo.findOne({
      where: { tenantId, name },
    });
    if (dupName) throw new BadRequestException(`Position "${name}" already exists`);
    const p = this.positionRepo.create({
      ...(data as DeepPartial<Position>),
      name,
      code,
      rank,
      tenantId,
    } as DeepPartial<Position>);
    return this.positionRepo.save(p);
  }

  async updatePosition(id: string, data: Partial<Position>, tenantId: string) {
    const p = await this.positionRepo.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Position not found');
    const next: any = { ...data };
    if (next.name !== undefined) {
      next.name = String(next.name || '').trim();
      if (!next.name) throw new BadRequestException('Position name is required');
    }
    if (next.code !== undefined) {
      next.code = String(next.code || '').trim() || null;
    }
    Object.assign(p, next);
    return this.positionRepo.save(p);
  }

  async deletePosition(id: string, tenantId: string) {
    const p = await this.positionRepo.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Position not found');
    await this.positionRepo.remove(p);
    return { ok: true };
  }

  // -------- Approver groups --------
  listGroups(tenantId: string) {
    return this.groupRepo.find({ where: { tenantId }, order: { name: 'ASC' } as any });
  }

  async getGroup(id: string, tenantId: string) {
    const g = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Group not found');
    const members = await this.memberRepo.find({ where: { groupId: id, tenantId } });
    return { ...g, members };
  }

  async createGroup(data: Partial<ApproverGroup> & { memberUserIds?: string[] }, tenantId: string) {
    const { memberUserIds, ...rest } = data;
    const g = this.groupRepo.create({ ...rest, tenantId } as DeepPartial<ApproverGroup>);
    const saved = await this.groupRepo.save(g);
    if (memberUserIds?.length) {
      const rows = memberUserIds.map((uid) =>
        this.memberRepo.create({ groupId: saved.id, userId: uid, tenantId } as DeepPartial<ApproverGroupMember>),
      );
      await this.memberRepo.save(rows);
    }
    return this.getGroup(saved.id, tenantId);
  }

  async updateGroup(
    id: string,
    data: Partial<ApproverGroup> & { memberUserIds?: string[] },
    tenantId: string,
  ) {
    const g = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Group not found');
    const { memberUserIds, ...rest } = data;
    Object.assign(g, rest);
    await this.groupRepo.save(g);
    if (memberUserIds) {
      await this.memberRepo.delete({ groupId: id, tenantId } as any);
      if (memberUserIds.length) {
        const rows = memberUserIds.map((uid) =>
          this.memberRepo.create({ groupId: id, userId: uid, tenantId } as DeepPartial<ApproverGroupMember>),
        );
        await this.memberRepo.save(rows);
      }
    }
    return this.getGroup(id, tenantId);
  }

  async deleteGroup(id: string, tenantId: string) {
    await this.memberRepo.delete({ groupId: id, tenantId } as any);
    const g = await this.groupRepo.findOne({ where: { id, tenantId } });
    if (g) await this.groupRepo.remove(g);
    return { ok: true };
  }

  // -------- Policies + steps --------
  listPolicies(tenantId: string) {
    return this.policyRepo.find({
      where: { tenantId },
      order: { priority: 'DESC', name: 'ASC' } as any,
    });
  }

  async getPolicy(id: string, tenantId: string) {
    const p = await this.policyRepo.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Policy not found');
    const steps = await this.stepRepo.find({
      where: { policyId: id, tenantId },
      order: { stepOrder: 'ASC' } as any,
    });
    return { ...p, steps };
  }

  async createPolicy(
    data: Partial<ProcurementApprovalPolicy> & {
      steps?: Array<Partial<ProcurementApprovalPolicyStep>>;
    },
    tenantId: string,
  ) {
    const { steps = [], ...rest } = data;
    const created = this.policyRepo.create({ ...rest, tenantId } as DeepPartial<ProcurementApprovalPolicy>);
    const p = await this.policyRepo.save(created);
    if (steps.length) {
      const rows = steps.map((s, idx) =>
        this.stepRepo.create({
          ...s,
          policyId: p.id,
          tenantId,
          stepOrder: s.stepOrder ?? idx + 1,
        } as DeepPartial<ProcurementApprovalPolicyStep>),
      );
      await this.stepRepo.save(rows);
    }
    return this.getPolicy(p.id, tenantId);
  }

  async updatePolicy(
    id: string,
    data: Partial<ProcurementApprovalPolicy> & {
      steps?: Array<Partial<ProcurementApprovalPolicyStep>>;
    },
    tenantId: string,
  ) {
    const p = await this.policyRepo.findOne({ where: { id, tenantId } });
    if (!p) throw new NotFoundException('Policy not found');
    const { steps, ...rest } = data;
    Object.assign(p, rest);
    await this.policyRepo.save(p);
    if (steps) {
      await this.stepRepo.delete({ policyId: id, tenantId } as any);
      if (steps.length) {
        const rows = steps.map((s, idx) =>
          this.stepRepo.create({
            ...s,
            policyId: id,
            tenantId,
            stepOrder: s.stepOrder ?? idx + 1,
          } as DeepPartial<ProcurementApprovalPolicyStep>),
        );
        await this.stepRepo.save(rows);
      }
    }
    return this.getPolicy(id, tenantId);
  }

  async deletePolicy(id: string, tenantId: string) {
    await this.stepRepo.delete({ policyId: id, tenantId } as any);
    const p = await this.policyRepo.findOne({ where: { id, tenantId } });
    if (p) await this.policyRepo.remove(p);
    return { ok: true };
  }

  // -------- Delegations --------
  listDelegations(tenantId: string, userId?: string) {
    const where: any = { tenantId };
    if (userId) where.fromUserId = userId;
    return this.delegationRepo.find({ where, order: { validFrom: 'DESC' } as any });
  }

  async createDelegation(data: Partial<ApprovalDelegation>, tenantId: string) {
    const d = this.delegationRepo.create({ ...data, tenantId } as DeepPartial<ApprovalDelegation>);
    return this.delegationRepo.save(d);
  }

  async updateDelegation(id: string, data: Partial<ApprovalDelegation>, tenantId: string) {
    const d = await this.delegationRepo.findOne({ where: { id, tenantId } });
    if (!d) throw new NotFoundException('Delegation not found');
    Object.assign(d, data);
    return this.delegationRepo.save(d);
  }

  async deleteDelegation(id: string, tenantId: string) {
    const d = await this.delegationRepo.findOne({ where: { id, tenantId } });
    if (d) await this.delegationRepo.remove(d);
    return { ok: true };
  }
}
