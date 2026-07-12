import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Row-Level Security — Phase 2 (all remaining tenant-scoped tables).
 *
 * Extends the Phase 1 pilot (migration 1782900000062) to the full tenant
 * clinical/operational domain: 254 tables with a strict tenant policy,
 * plus `services` with a read policy that also exposes global catalog rows
 * (tenant_id IS NULL) while keeping writes tenant-scoped.
 *
 * Deliberately EXCLUDED (see Phase 3):
 * - Platform catalog (NULL tenant legitimate): users, roles, permissions,
 *   role_permissions, user_roles, user_permissions, sessions, refresh_tokens,
 *   login_history, password_history, audit_logs, system_settings,
 *   support_access_*, tenants, system_admin_*, system_metrics,
 *   admin_audit_log, compliance_evidence
 * - Platform-admin domain (system admins manage these through normal
 *   endpoints today; they get explicit system-context endpoints in Phase 3):
 *   saas_contracts, licenses, client_onboardings, onboarding_tasks,
 *   deployments, deployment_reports, backups, backup_schedules,
 *   feature_flags, webhook_delivery_logs, tenant_feature_modules
 *
 * NOTE: any NEW tenant-scoped table added after this migration must enable
 * RLS + policy in its own migration.
 */
export class RlsPhase21782900000063 implements MigrationInterface {
  name = 'RlsPhase21782900000063';

  private static readonly STRICT_TABLES = [
    'admissions',
    'alert_rules',
    'antenatal_registrations',
    'antenatal_visits',
    'api_keys',
    'appointments',
    'approval_actions',
    'approval_delegations',
    'approval_requests',
    'approver_group_members',
    'approver_groups',
    'asset_allocations',
    'asset_categories',
    'asset_depreciations',
    'asset_disposals',
    'asset_location_history',
    'asset_maintenances',
    'asset_transfer_approvals',
    'asset_transfers',
    'attendance_records',
    'baby_wellness_checks',
    'bank_reconciliation_items',
    'bank_reconciliations',
    'batch_recall_actions',
    'batch_recalls',
    'batch_stock_balances',
    'bed_transfers',
    'beds',
    'billing_points',
    'biometric_data',
    'budget_lines',
    'budget_reservations',
    'budgets',
    'cashier_sessions',
    'change_sets',
    'chart_of_accounts',
    'claim_items',
    'client_health_scores',
    'clinical_notes',
    'common_drug_translations',
    'compliance_records',
    'contract_amendments',
    'controlled_substance_logs',
    'cost_centers',
    'critical_result_alerts',
    'cycle_count_items',
    'cycle_counts',
    'delegations',
    'deliveries',
    'delivery_outcomes',
    'departments',
    'deposit_applications',
    'diagnoses',
    'discharge_summaries',
    'disciplinary_actions',
    'discount_applications',
    'dispensations',
    'disposal_records',
    'doctor_duties',
    'doctor_fee_profiles',
    'donor_funds',
    'drug_allergy_classes',
    'drug_classifications',
    'drug_disease_interactions',
    'drug_interaction_overrides',
    'drug_interactions',
    'drug_label_templates',
    'drug_sync_logs',
    'efris_configs',
    'efris_documents',
    'emergency_cases',
    'employee_goals',
    'employees',
    'encounters',
    'equipment_calibrations',
    'equipment_maintenances',
    'expiry_alert_configs',
    'expiry_alert_history',
    'expiry_alerts',
    'facilities',
    'facility_budgets',
    'facility_configs',
    'facility_modules',
    'finance_approval_chains',
    'finance_audit_log',
    'fiscal_periods',
    'fixed_assets',
    'follow_ups',
    'gl_reconciliation_items',
    'gl_reconciliation_status',
    'goods_receipt_items',
    'goods_receipt_notes',
    'group_permissions',
    'held_sales',
    'hr_letter_templates',
    'imaging_modalities',
    'imaging_orders',
    'imaging_results',
    'immunization_schedules',
    'in_app_notifications',
    'insurance_claims',
    'insurance_policies',
    'insurance_price_lists',
    'insurance_providers',
    'interfacility_transactions',
    'invoice_match_items',
    'invoice_matches',
    'item_brands',
    'item_categories',
    'item_formulations',
    'item_strengths',
    'item_subcategories',
    'item_tag_assignments',
    'item_tags',
    'item_units',
    'items',
    'job_applications',
    'job_postings',
    'journal_entries',
    'journal_entry_lines',
    'lab_equipment',
    'lab_reagents',
    'lab_results',
    'lab_samples',
    'lab_tests',
    'labour_records',
    'leave_requests',
    'master_data_approval_rules',
    'master_data_versions',
    'medication_adherence_records',
    'medication_administrations',
    'medication_reconciliation_items',
    'medication_reconciliations',
    'membership_schemes',
    'notification_configs',
    'nursing_notes',
    'orders',
    'outbox_events',
    'password_policies',
    'patient_active_medications',
    'patient_allergies',
    'patient_chronic_conditions',
    'patient_credit_notes',
    'patient_deposits',
    'patient_memberships',
    'patient_merges',
    'patient_problems',
    'patient_reminders',
    'payroll_runs',
    'payslips',
    'performance_appraisals',
    'performance_improvement_plans',
    'permission_groups',
    'petty_cash_funds',
    'petty_cash_transactions',
    'pharmacy_return_items',
    'pharmacy_returns',
    'pharmacy_sale_items',
    'pharmacy_sales',
    'pos_cash_drawer_events',
    'pos_mobile_money_transactions',
    'pos_payment_splits',
    'pos_quick_keys',
    'pos_registers',
    'pos_shifts',
    'pos_z_reports',
    'positions',
    'postnatal_visits',
    'pre_authorizations',
    'prescription_items',
    'prescription_safety_overrides',
    'prescription_templates',
    'prescriptions',
    'price_agreements',
    'pricing_rules',
    'pricing_tiers',
    'procurement_approval_chains',
    'procurement_approval_policies',
    'procurement_approval_policy_steps',
    'procurement_approval_thresholds',
    'providers',
    'purchase_order_items',
    'purchase_orders',
    'purchase_request_items',
    'purchase_requests',
    'qc_levey_jennings_data',
    'qc_materials',
    'qc_results',
    'queue_displays',
    'queues',
    'quotation_approvals',
    'reagent_consumptions',
    'reagent_lots',
    'receipt_reprints',
    'referrals',
    'replication_logs',
    'retail_customers',
    'rfq_items',
    'rfq_vendors',
    'rfqs',
    'role_permission_groups',
    'rx_notification_logs',
    'salary_history',
    'sample_referrals',
    'service_categories',
    'service_consumables',
    'service_packages',
    'service_prices',
    'shift_definitions',
    'shift_swap_requests',
    'sms_templates',
    'staff_documents',
    'staff_rosters',
    'stock_balances',
    'stock_ledger',
    'stock_transfer_items',
    'stock_transfers',
    'storage_conditions',
    'stores',
    'supplier_credit_note_items',
    'supplier_credit_notes',
    'supplier_payment_items',
    'supplier_payments',
    'supplier_return_items',
    'supplier_returns',
    'suppliers',
    'surgery_cases',
    'surgery_consumables',
    'sync_conflicts',
    'sync_queue',
    'system_alerts',
    'tax_exemptions',
    'tax_rates',
    'temperature_logs',
    'temperature_sensors',
    'theatres',
    'training_enrollments',
    'training_programs',
    'treatment_plans',
    'triage_assessments',
    'units',
    'usage_alert',
    'usage_meter_aggregate',
    'usage_meter_event',
    'usage_quota',
    'vendor_contracts',
    'vendor_quotation_items',
    'vendor_quotations',
    'vendor_rating_summaries',
    'vendor_ratings',
    'vitals',
    'waivers',
    'wards',
    'wholesale_customers',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Two HR tables were created with varchar tenant_id (both empty in every
    // known deployment) — normalize to uuid so the policy comparison works.
    await queryRunner.query(
      `ALTER TABLE "disciplinary_actions" ALTER COLUMN "tenant_id" TYPE uuid USING tenant_id::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "salary_history" ALTER COLUMN "tenant_id" TYPE uuid USING tenant_id::uuid`,
    );

    const tenantMatch = `
      current_setting('app.tenant', true) = 'system'
      OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
    `;

    for (const table of RlsPhase21782900000063.STRICT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING (${tenantMatch})
        WITH CHECK (${tenantMatch})
      `);
    }

    // services: shared catalog — global rows (tenant_id IS NULL) are readable
    // by every tenant, but writes/deletes stay strictly tenant-scoped so a
    // tenant can neither create nor modify nor delete global catalog entries.
    await queryRunner.query(`ALTER TABLE "services" ENABLE ROW LEVEL SECURITY`);
    for (const p of ['tenant_isolation', 'tenant_read', 'tenant_insert', 'tenant_update', 'tenant_delete']) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${p}" ON "services"`);
    }
    await queryRunner.query(`
      CREATE POLICY "tenant_read" ON "services" FOR SELECT
      USING (
        current_setting('app.tenant', true) = 'system'
        OR tenant_id IS NULL
        OR tenant_id = (SELECT NULLIF(current_setting('app.tenant', true), '')::uuid)
      )
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_insert" ON "services" FOR INSERT
      WITH CHECK (${tenantMatch})
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_update" ON "services" FOR UPDATE
      USING (${tenantMatch}) WITH CHECK (${tenantMatch})
    `);
    await queryRunner.query(`
      CREATE POLICY "tenant_delete" ON "services" FOR DELETE
      USING (${tenantMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of RlsPhase21782900000063.STRICT_TABLES) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    for (const p of ['tenant_read', 'tenant_insert', 'tenant_update', 'tenant_delete']) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${p}" ON "services"`);
    }
    await queryRunner.query(`ALTER TABLE "services" DISABLE ROW LEVEL SECURITY`);
  }
}
