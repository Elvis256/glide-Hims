import { Repository, SelectQueryBuilder, FindManyOptions, FindOneOptions } from 'typeorm';
import { BaseEntity } from '../entities/base.entity';

/**
 * TenantAwareRepository - Base class for repositories that enforce tenant isolation
 * All queries automatically filter by the current tenant
 */
export abstract class TenantAwareRepository<T extends BaseEntity> extends Repository<T> {
  /**
   * The tenant ID for the current context
   */
  protected currentTenantId: string;

  /**
   * Set the current tenant context for queries
   */
  setTenantContext(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  /**
   * Get the current tenant ID
   */
  getTenantContext(): string {
    if (!this.currentTenantId) {
      throw new Error('Tenant context not set. Call setTenantContext() first.');
    }
    return this.currentTenantId;
  }

  /**
   * Create a query builder with tenant isolation applied
   */
  createTenantAwareQueryBuilder(alias: string = this.metadata.tableName): SelectQueryBuilder<T> {
    return this.createQueryBuilder(alias).where(`${alias}.tenant_id = :tenantId`, {
      tenantId: this.getTenantContext(),
    });
  }

  /**
   * Find all records for current tenant
   */
  findAllForTenant(options?: FindManyOptions<T>): Promise<T[]> {
    const qb = this.createTenantAwareQueryBuilder();
    if (options?.where) {
      // Additional where conditions can be applied
      Object.entries(options.where).forEach(([key, value]) => {
        qb.andWhere(`${this.metadata.tableName}.${key} = :${key}`, { [key]: value });
      });
    }
    if (options?.order) {
      Object.entries(options.order).forEach(([key, direction]) => {
        qb.orderBy(key, direction as 'ASC' | 'DESC');
      });
    }
    if (options?.take) {
      qb.take(options.take);
    }
    if (options?.skip) {
      qb.skip(options.skip);
    }
    return qb.getMany();
  }

  /**
   * Find one record for current tenant by ID
   */
  findOneByIdForTenant(id: string, options?: FindOneOptions<T>): Promise<T | null> {
    const qb = this.createTenantAwareQueryBuilder();
    qb.andWhere(`${this.metadata.tableName}.id = :id`, { id });
    if (options?.relations && Array.isArray(options.relations)) {
      (options.relations as string[]).forEach((relation: string) => {
        qb.leftJoinAndSelect(`${this.metadata.tableName}.${relation}`, relation);
      });
    }
    return qb.getOne();
  }

  /**
   * Count records for current tenant
   */
  countForTenant(options?: FindManyOptions<T>): Promise<number> {
    const qb = this.createTenantAwareQueryBuilder();
    if (options?.where) {
      Object.entries(options.where).forEach(([key, value]) => {
        qb.andWhere(`${this.metadata.tableName}.${key} = :${key}`, { [key]: value });
      });
    }
    return qb.getCount();
  }

  /**
   * Delete records for current tenant
   */
  deleteForTenant(criteria: Partial<T>): Promise<void> {
    const qb = this.createTenantAwareQueryBuilder();
    Object.entries(criteria).forEach(([key, value]) => {
      qb.andWhere(`${this.metadata.tableName}.${key} = :${key}`, { [key]: value });
    });
    return qb
      .delete()
      .execute()
      .then(() => void 0);
  }

  /**
   * Verify that a record belongs to the current tenant before operating on it
   * Throws error if record is not found or belongs to a different tenant
   */
  async verifyTenantOwnership(id: string): Promise<T> {
    const record = await this.findOneByIdForTenant(id);
    if (!record) {
      throw new Error(
        `Record with ID ${id} not found or does not belong to tenant ${this.getTenantContext()}`,
      );
    }
    return record;
  }
}
