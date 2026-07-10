import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';

export interface WitnessOptions {
  witnessId: string;
  actorUserId: string;
  tenantId?: string;
  /** Lower-cased role-name fragments any of which the witness must hold. */
  allowedRoleFragments?: string[];
  /** Optional context for error message (e.g. "controlled-substance dispense"). */
  context?: string;
}

const DEFAULT_WITNESS_ROLES = ['pharmacist', 'doctor', 'physician', 'nurse'];

@Injectable()
export class IdentityGuardService {
  private readonly logger = new Logger(IdentityGuardService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserRole) private readonly userRoles: Repository<UserRole>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
  ) {}

  /** Returns the user if active and tenant-matched, else throws. */
  async assertActiveUserInTenant(userId: string, tenantId?: string): Promise<User> {
    if (!userId) throw new ForbiddenException('User id required');
    const where: any = { id: userId };
    if (tenantId) where.tenantId = tenantId;
    const user = await this.users.findOne({ where });
    if (!user) throw new NotFoundException('User not found in this tenant');
    if (user.status && user.status !== 'active') {
      throw new ForbiddenException('User account is not active');
    }
    return user;
  }

  /** Returns lower-cased role names for a user (tenant-aware). */
  async getUserRoleNames(userId: string, tenantId?: string): Promise<string[]> {
    const links = await this.userRoles.find({
      where: { userId, ...(tenantId ? { tenantId } : {}) } as any,
      relations: ['role'],
    });
    return links.map((l) => l.role?.name?.toLowerCase()).filter((n): n is string => Boolean(n));
  }

  async userHasAnyRole(userId: string, fragments: string[], tenantId?: string): Promise<boolean> {
    const names = await this.getUserRoleNames(userId, tenantId);
    return names.some((n) => fragments.some((f) => n.includes(f)));
  }

  /**
   * Verifies a witness is a real, active user in the tenant, distinct from
   * the actor, and holds at least one role from `allowedRoleFragments`
   * (defaults to clinical roles eligible to witness controlled-substance acts).
   * Throws ForbiddenException with code WITNESS_INVALID otherwise.
   */
  async assertWitness(opts: WitnessOptions): Promise<User> {
    const fragments = (
      opts.allowedRoleFragments?.length ? opts.allowedRoleFragments : DEFAULT_WITNESS_ROLES
    ).map((s) => s.toLowerCase());
    const ctx = opts.context ? ` for ${opts.context}` : '';

    if (!opts.witnessId) {
      throw new ForbiddenException({
        code: 'WITNESS_REQUIRED',
        message: `A witness is required${ctx}.`,
      });
    }
    if (opts.witnessId === opts.actorUserId) {
      throw new ForbiddenException({
        code: 'WITNESS_INVALID',
        message: `Witness must be a different user than the actor${ctx}.`,
      });
    }

    const witness = await this.users.findOne({
      where: { id: opts.witnessId, ...(opts.tenantId ? { tenantId: opts.tenantId } : {}) } as any,
    });
    if (!witness) {
      throw new ForbiddenException({
        code: 'WITNESS_INVALID',
        message: `Witness user not found in this tenant${ctx}.`,
      });
    }
    if (witness.status && witness.status !== 'active') {
      throw new ForbiddenException({
        code: 'WITNESS_INVALID',
        message: `Witness account is not active${ctx}.`,
      });
    }

    const ok = await this.userHasAnyRole(opts.witnessId, fragments, opts.tenantId);
    if (!ok) {
      throw new ForbiddenException({
        code: 'WITNESS_INVALID',
        message: `Witness does not hold an eligible clinical role${ctx}.`,
      });
    }
    return witness;
  }

  /** Verifies an encounter can be assigned to providerId (must be a doctor in tenant). */
  async assertAssignableProvider(providerId: string, tenantId?: string): Promise<User> {
    const user = await this.assertActiveUserInTenant(providerId, tenantId);
    const ok = await this.userHasAnyRole(providerId, ['doctor', 'physician'], tenantId);
    if (!ok) {
      throw new ForbiddenException({
        code: 'INVALID_ASSIGNEE',
        message: 'Assignee must hold a doctor/physician role.',
      });
    }
    return user;
  }
}
