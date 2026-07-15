import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { FacilityGuard } from './modules/auth/guards/facility.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { SystemDocsModule } from './modules/system-docs/system-docs.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { RolesModule } from './modules/roles/roles.module';
import { PatientsModule } from './modules/patients/patients.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { VitalsModule } from './modules/vitals/vitals.module';
import { ClinicalNotesModule } from './modules/clinical-notes/clinical-notes.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { AllergiesModule } from './modules/allergies/allergies.module';
import { CriticalResultsModule } from './modules/critical-results/critical-results.module';
import { BillingModule } from './modules/billing/billing.module';
import { DoctorFeesModule } from './modules/doctor-fees/doctor-fees.module';
import { PaymentGatewayModule } from './modules/payment-gateway/payment-gateway.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { IpdModule } from './modules/ipd/ipd.module';
import { NursingModule } from './modules/nursing/nursing.module';
import { LabModule } from './modules/lab/lab.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { SurgeryModule } from './modules/surgery/surgery.module';
import { MaternityModule } from './modules/maternity/maternity.module';
import { HrModule } from './modules/hr/hr.module';
import { FinanceModule } from './modules/finance/finance.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MembershipModule } from './modules/membership/membership.module';
import { ServicesModule } from './modules/services/services.module';
import { StoresModule } from './modules/stores/stores.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { PosModule } from './modules/pos/pos.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { SyncModule } from './modules/sync/sync.module';
import { DiagnosesModule } from './modules/diagnoses/diagnoses.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { ProvidersModule } from './modules/providers/providers.module';
import { CacheModule } from './modules/cache/cache.module';
import { MdmModule } from './modules/mdm/mdm.module';
import { AssetsModule } from './modules/assets/assets.module';
import { LabSuppliesModule } from './modules/lab-supplies/lab-supplies.module';
import { DrugManagementModule } from './modules/drug-management/drug-management.module';
import { SupplierFinanceModule } from './modules/supplier-finance/supplier-finance.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { TreatmentPlansModule } from './modules/treatment-plans/treatment-plans.module';
import { FollowUpsModule } from './modules/follow-ups/follow-ups.module';
import { DischargeModule } from './modules/discharge/discharge.module';
import { QueueManagementModule } from './modules/queue-management/queue-management.module';
import { DisposalModule } from './modules/disposal/disposal.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { SupplierReturnsModule } from './modules/supplier-returns/supplier-returns.module';
import { StockTransferModule } from './modules/stock-transfer/stock-transfer.module';
import { DoctorDutyModule } from './modules/doctor-duty/doctor-duty.module';
import { RFQModule } from './modules/rfq/rfq.module';
import { VendorContractsModule } from './modules/vendor-contracts/vendor-contracts.module';
import { VendorRatingsModule } from './modules/vendor-ratings/vendor-ratings.module';
import { PriceAgreementsModule } from './modules/price-agreements/price-agreements.module';
import { InvoiceMatchingModule } from './modules/invoice-matching/invoice-matching.module';
import { ItemClassificationsModule } from './modules/item-classifications/item-classifications.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientPortalModule } from './modules/patient-portal/patient-portal.module';
import { ChronicCareModule } from './modules/chronic-care/chronic-care.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PricingEngineModule } from './modules/pricing-engine/pricing-engine.module';
import { SetupModule } from './modules/setup/setup.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { BiometricsModule } from './modules/biometrics/biometrics.module';
import { AuditModule } from './common/interceptors/audit.module';
import { IdentityGuardModule } from './common/services/identity-guard.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { InAppNotificationsModule } from './modules/in-app-notifications/in-app-notifications.module';
import { LeadsModule } from './modules/leads/leads.module';
import { SaasRevenueModule } from './modules/saas-revenue/saas-revenue.module';
import { DownloadsModule } from './modules/downloads/downloads.module';
import { HealthModule } from './modules/health/health.module';
import { TenantModule } from './common/middleware/tenant.module';
import { AdminModule } from './modules/admin/admin.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { AdherenceModule } from './modules/adherence/adherence.module';
import { ScheduledTasksModule } from './modules/scheduled-tasks/scheduled-tasks.module';
import { SupportAccessModule } from './modules/support-access/support-access.module';
import { LicensingModule } from './modules/licensing/licensing.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { UpdatesModule } from './modules/updates/updates.module';
import { ExportModule } from './modules/export/export.module';
import { BackupModule } from './modules/backup/backup.module';
import { DeploymentsModule } from './modules/deployments/deployment.module';
import { EfrisModule } from './modules/efris/efris.module';
import { getDatabaseConfig } from './config/database.factory';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
    }),

    // Event emitter (used for SaleCompleted, EFRIS submission requested, etc.)
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),

    // Rate Limiting (global)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_TTL', 60) * 1000,
            limit: configService.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
      }),
      inject: [ConfigService],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const config = getDatabaseConfig(false);
        return {
          ...config,
          synchronize: configService.get('TYPEORM_SYNCHRONIZE') === 'true' || config.synchronize,
          migrationsRun: configService.get('TYPEORM_MIGRATIONS_RUN') === 'true',
        };
      },
      inject: [ConfigService],
    }),

    // Core Modules
    AuditModule,
    IdentityGuardModule,
    TenantModule,
    HealthModule,
    SetupModule,
    SystemSettingsModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    SystemDocsModule,
    AdminModule,
    ComplianceModule,
    FacilitiesModule,
    RolesModule,
    PatientsModule,

    // Clinical Modules (Phase 1)
    EncountersModule,
    VitalsModule,
    ClinicalNotesModule,
    PrescriptionsModule,
    AllergiesModule,
    CriticalResultsModule,
    BillingModule,
    DoctorFeesModule,
    PaymentGatewayModule,
    InventoryModule,
    CatalogModule,
    OrdersModule,

    // IPD/Ward Management (Phase 2)
    IpdModule,

    // Nursing Documentation (Phase 2b)
    NursingModule,

    // Laboratory (Phase 3)
    LabModule,

    // Emergency Department (Phase 3)
    EmergencyModule,

    // Surgery/Theatre (Phase 4)
    SurgeryModule,

    // Maternity/Antenatal (Phase 5)
    MaternityModule,

    // HR & Payroll (Phase 6)
    HrModule,

    // Finance & Accounting (Phase 7)
    FinanceModule,

    // Radiology/Imaging (Phase 8)
    RadiologyModule,

    // Insurance & Claims (Phase 9)
    InsuranceModule,

    // Analytics & BI (Phase 10)
    AnalyticsModule,
    ReportsModule,

    // Phase 11: Hospital Workflow Enhancements
    MembershipModule,
    ServicesModule,
    StoresModule,
    PharmacyModule,
    PosModule,
    EfrisModule,

    // Phase 12: Supply Chain & Procurement
    SuppliersModule,
    ProcurementModule,
    ApprovalsModule,

    // Phase 13: Offline Sync
    SyncModule,

    // Phase 14: Additional MDM & Infrastructure
    DiagnosesModule,
    ProblemsModule,
    ProvidersModule,
    CacheModule.forRoot(),
    MdmModule,

    // Phase 15: Advanced Business Features
    AssetsModule,
    LabSuppliesModule,
    DrugManagementModule,
    SupplierFinanceModule,

    // Phase 16: Patient Journey Enhancements
    ReferralsModule,
    TreatmentPlansModule,
    FollowUpsModule,
    DischargeModule,
    QueueManagementModule,
    DoctorDutyModule,

    // Phase 17: Pharmacy Expiry & Disposal
    DisposalModule,
    SupplierReturnsModule,
    StockTransferModule,

    // Phase 18: RFQ, Vendor Management & Invoice Matching
    RFQModule,
    VendorContractsModule,
    VendorRatingsModule,
    PriceAgreementsModule,
    InvoiceMatchingModule,
    ItemClassificationsModule,

    // Phase 19: Chronic Disease Management & Notifications
    NotificationsModule,
    PatientPortalModule,
    ChronicCareModule,

    // Phase 20: External API Integrations (openFDA, SMS, LOINC)
    IntegrationsModule,

    // Phase 21: Pricing Engine
    PricingEngineModule,

    // Appointments
    AppointmentsModule,
    SchedulesModule,

    // Biometrics (SecuGen fingerprint verification)
    BiometricsModule,

    // Real-time In-App Notifications
    InAppNotificationsModule,
    LeadsModule,
    SaasRevenueModule,
    DownloadsModule,

    // Phase 22: Medication Adherence Tracking
    AdherenceModule,

    // Task Scheduling
    ScheduleModule.forRoot(),
    ScheduledTasksModule,

    // Support Access (tiered system admin access)
    SupportAccessModule,

    // Enterprise Deployment Features
    LicensingModule,
    FeatureFlagsModule,
    UpdatesModule,

    // Data Export
    ExportModule,

    // Backup & Restore
    BackupModule,

    // Multi-Tenant SaaS Super Server
    DeploymentsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FacilityGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
