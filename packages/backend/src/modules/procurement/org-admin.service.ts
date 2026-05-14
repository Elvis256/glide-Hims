import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(ProcurementApprovalPolicy) private policyRepo: Repository<ProcurementApprovalPolicy>,
    @InjectRepository(ProcurementApprovalPolicyStep) private stepRepo: Repository<ProcurementApprovalPolicyStep>,
    @InjectRepository(ApprovalDelegation) private delegationRepo: Repository<ApprovalDelegation>,
  ) {}

  // -------- Departments --------
  listDepartments(tenantId: string) {
    return this.deptRepo.find({ where: { tenantId } as any, order: { name: 'ASC' } as any });
  }

  async setDepartmentHead(id: string, headUserId: string | null, tenantId: string) {
    const dept = await this.deptRepo.findOne({ where: { id, tenantId } as any });
    if (!dept) throw new NotFoundException('Department not found');
    (dept as any).headUserId = headUserId || null;
    return this.deptRepo.save(dept);
  }

  async setDepartmentParent(id: string, parentId: string | null, tenantId: string) {
    const dept = await this.deptRepo.findOne({ where: { id, tenantId } as any });
    if (!dept) throw new NotFoundException('Department not found');
    (dept as any).parentId = parentId || null;
    return this.deptRepo.save(dept);
  }

  // -------- Employees --------
  listEmployees(tenantId: string) {
    return this.employeeRepo.find({
      where: { tenantId } as any,
      order: { firstName: 'ASC' } as any,
    });
  }

  async setEmployeeManager(id: string, managerId: string | null, tenantId: string) {
    const emp = await this.employeeRepo.findOne({ where: { id, tenantId } as any });
    if (!emp) throw new NotFoundException('Employee not found');
    if (managerId && managerId === id) {
      throw new BadRequestException('An employee cannot be their own manager');
    }
    emp.managerId = managerId || undefined;
    return this.employeeRepo.save(emp);
  }

  async setEmployeePosition(id: string, positionId: string | null, tenantId: string) {
    const emp = await this.employeeRepo.findOne({ where: { id, tenantId } as any });
    if (!emp) throw new NotFoundException('Employee not found');
    emp.positionId = positionId || undefined;
    return this.employeeRepo.save(emp);
  }

  // -------- Positions --------
  listPositions(tenantId: string) {
    return this.positionRepo.find({
      where: { tenantId } as any,
      order: { rank: 'DESC', name: 'ASC' } as any,
    });
  }

  async createPosition(data: Partial<Position>, tenantId: string) {
    const name = String((data as any)?.name || '').trim();
    if (!name) throw new BadRequestException('Position name is required');
    const code = String((data as any)?.code || '').trim() || null;
    const rank = Number((data as any)?.rank ?? 0) || 0;
    if (code) {
      const dupCode = await this.positionRepo.findOne({
        where: { tenantId, code } as any,
      });
      if (dupCode) throw new BadRequestException(`Position code "${code}" already exists`);
    }
    const dupName = await this.positionRepo.findOne({
      where: { tenantId, name } as any,
    });
    if (dupName) throw new BadRequestException(`Position "${name}" already exists`);
    const p = this.positionRepo.create({
      ...(data as any),
      name,
      code,
      rank,
      tenantId,
    } as any);
    return this.positionRepo.save(p as any);
  }

  async updatePosition(id: string, data: Partial<Position>, tenantId: string) {
    const p = await this.positionRepo.findOne({ where: { id, tenantId } as any });
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
    const p = await this.positionRepo.findOne({ where: { id, tenantId } as any });
    if (!p) throw new NotFoundException('Position not found');
    await this.positionRepo.remove(p);
    return { ok: true };
  }

  // -------- Approver groups --------
  listGroups(tenantId: string) {
    return this.groupRepo.find({ where: { tenantId } as any, order: { name: 'ASC' } as any });
  }

  async getGroup(id: string, tenantId: string) {
    const g = await this.groupRepo.findOne({ where: { id, tenantId } as any });
    if (!g) throw new NotFoundException('Group not found');
    const members = await this.memberRepo.find({ where: { groupId: id, tenantId } as any });
    return { ...g, members };
  }

  async createGroup(data: Partial<ApproverGroup> & { memberUserIds?: string[] }, tenantId: string) {
    const { memberUserIds, ...rest } = data;
    const g = this.groupRepo.create({ ...rest, tenantId } as any);
    const saved: any = await this.groupRepo.save(g as any);
    if (memberUserIds?.length) {
      const rows = memberUserIds.map((uid) =>
        this.memberRepo.create({ groupId: saved.id, userId: uid, tenantId } as any),
      );
      await this.memberRepo.save(rows as any);
    }
    return this.getGroup(saved.id, tenantId);
  }

  async updateGroup(id: string, data: Partial<ApproverGroup> & { memberUserIds?: string[] }, tenantId: string) {
    const g = await this.groupRepo.findOne({ where: { id, tenantId } as any });
    if (!g) throw new NotFoundException('Group not found');
    const { memberUserIds, ...rest } = data;
    Object.assign(g, rest);
    await this.groupRepo.save(g);
    if (memberUserIds) {
      await this.memberRepo.delete({ groupId: id, tenantId } as any);
      if (memberUserIds.length) {
        const rows = memberUserIds.map((uid) =>
          this.memberRepo.create({ groupId: id, userId: uid, tenantId } as any),
        );
        await this.memberRepo.save(rows as any);
      }
    }
    return this.getGroup(id, tenantId);
  }

  async deleteGroup(id: string, tenantId: string) {
    await this.memberRepo.delete({ groupId: id, tenantId } as any);
    const g = await this.groupRepo.findOne({ where: { id, tenantId } as any });
    if (g) await this.groupRepo.remove(g);
    return { ok: true };
  }

  // -------- Policies + steps --------
  listPolicies(tenantId: string) {
    return this.policyRepo.find({
      where: { tenantId } as any,
      order: { priority: 'DESC', name: 'ASC' } as any,
    });
  }

  async getPolicy(id: string, tenantId: string) {
    const p = await this.policyRepo.findOne({ where: { id, tenantId } as any });
    if (!p) throw new NotFoundException('Policy not found');
    const steps = await this.stepRepo.find({
      where: { policyId: id, tenantId } as any,
      order: { stepOrder: 'ASC' } as any,
    });
    return { ...p, steps };
  }

  async createPolicy(
    data: Partial<ProcurementApprovalPolicy> & { steps?: Array<Partial<ProcurementApprovalPolicyStep>> },
    tenantId: string,
  ) {
    const { steps = [], ...rest } = data;
    const created = this.policyRepo.create({ ...rest, tenantId } as any);
    const p: any = await this.policyRepo.save(created as any);
    if (steps.length) {
      const rows = steps.map((s, idx) =>
        this.stepRepo.create({
          ...s,
          policyId: p.id,
          tenantId,
          stepOrder: s.stepOrder ?? idx + 1,
        } as any),
      );
      await this.stepRepo.save(rows as any);
    }
    return this.getPolicy(p.id, tenantId);
  }

  async updatePolicy(
    id: string,
    data: Partial<ProcurementApprovalPolicy> & { steps?: Array<Partial<ProcurementApprovalPolicyStep>> },
    tenantId: string,
  ) {
    const p = await this.policyRepo.findOne({ where: { id, tenantId } as any });
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
          } as any),
        );
        await this.stepRepo.save(rows as any);
      }
    }
    return this.getPolicy(id, tenantId);
  }

  async deletePolicy(id: string, tenantId: string) {
    await this.stepRepo.delete({ policyId: id, tenantId } as any);
    const p = await this.policyRepo.findOne({ where: { id, tenantId } as any });
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
    const d = this.delegationRepo.create({ ...data, tenantId } as any);
    return this.delegationRepo.save(d as any);
  }

  async updateDelegation(id: string, data: Partial<ApprovalDelegation>, tenantId: string) {
    const d = await this.delegationRepo.findOne({ where: { id, tenantId } as any });
    if (!d) throw new NotFoundException('Delegation not found');
    Object.assign(d, data);
    return this.delegationRepo.save(d);
  }

  async deleteDelegation(id: string, tenantId: string) {
    const d = await this.delegationRepo.findOne({ where: { id, tenantId } as any });
    if (d) await this.delegationRepo.remove(d);
    return { ok: true };
  }
}
