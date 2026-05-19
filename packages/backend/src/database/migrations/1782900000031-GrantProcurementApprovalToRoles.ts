import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill procurement.read + procurement.approve onto the three roles
 * that operationally need to approve procurement documents:
 *
 *   - Department Head     (first level of PR approval workflow)
 *   - Facility Manager    (PO approval at facility level)
 *   - Accountant          (3-way invoice matching + AP approval)
 *
 * Audit gap (verified against live tenant 2026-05-20): the seed only
 * granted these permissions to Super Admin and Administrator, so every
 * existing tenant ends up in a state where ordinary users cannot move
 * a PR -> RFQ -> PO -> match -> paid chain forward without escalating
 * to Super Admin. The seed file is updated in the same commit; this
 * migration brings already-deployed tenants in line.
 *
 * Idempotent: ON CONFLICT DO NOTHING on role_permissions.
 */
export class GrantProcurementApprovalToRoles1782900000031
  implements MigrationInterface
{
  name = 'GrantProcurementApprovalToRoles1782900000031';

  private readonly grants: Array<{ role: string; permission: string }> = [
    { role: 'Department Head', permission: 'procurement.read' },
    { role: 'Department Head', permission: 'procurement.approve' },
    { role: 'Facility Manager', permission: 'procurement.read' },
    { role: 'Facility Manager', permission: 'procurement.approve' },
    { role: 'Accountant', permission: 'procurement.read' },
    { role: 'Accountant', permission: 'procurement.approve' },
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const { role, permission } of this.grants) {
      await q.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r CROSS JOIN permissions p
         WHERE r.name = $1 AND p.code = $2
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [role, permission],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const { role, permission } of this.grants) {
      await q.query(
        `DELETE FROM role_permissions
         WHERE role_id IN (SELECT id FROM roles WHERE name = $1)
           AND permission_id IN (SELECT id FROM permissions WHERE code = $2)`,
        [role, permission],
      );
    }
  }
}
