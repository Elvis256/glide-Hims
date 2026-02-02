import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { RolesModule } from './modules/roles/roles.module';
import { PatientsModule } from './modules/patients/patients.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { VitalsModule } from './modules/vitals/vitals.module';
import { ClinicalNotesModule } from './modules/clinical-notes/clinical-notes.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { BillingModule } from './modules/billing/billing.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { IpdModule } from './modules/ipd/ipd.module';
import { LabModule } from './modules/lab/lab.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { SurgeryModule } from './modules/surgery/surgery.module';
import { MaternityModule } from './modules/maternity/maternity.module';
import { HrModule } from './modules/hr/hr.module';
import { FinanceModule } from './modules/finance/finance.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MembershipModule } from './modules/membership/membership.module';
import { ServicesModule } from './modules/services/services.module';
import { StoresModule } from './modules/stores/stores.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
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
import { SupplierReturnsModule } from './modules/supplier-returns/supplier-returns.module';
import { RFQModule } from './modules/rfq/rfq.module';
import { VendorContractsModule } from './modules/vendor-contracts/vendor-contracts.module';
import { VendorRatingsModule } from './modules/vendor-ratings/vendor-ratings.module';
import { PriceAgreementsModule } from './modules/price-agreements/price-agreements.module';
import { InvoiceMatchingModule } from './modules/invoice-matching/invoice-matching.module';
import { ItemClassificationsModule } from './modules/item-classifications/item-classifications.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChronicCareModule } from './modules/chronic-care/chronic-care.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AuditModule } from './common/interceptors/audit.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development', // Only for dev
        logging: configService.get('NODE_ENV') === 'development',
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),

    // Core Modules
    AuditModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    FacilitiesModule,
    RolesModule,
    PatientsModule,

    // Clinical Modules (Phase 1)
    EncountersModule,
    VitalsModule,
    ClinicalNotesModule,
    PrescriptionsModule,
    BillingModule,
    InventoryModule,
    OrdersModule,

    // IPD/Ward Management (Phase 2)
    IpdModule,

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

    // Phase 11: Hospital Workflow Enhancements
    MembershipModule,
    ServicesModule,
    StoresModule,
    PharmacyModule,

    // Phase 12: Supply Chain & Procurement
    SuppliersModule,
    ProcurementModule,

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

    // Phase 17: Pharmacy Expiry & Disposal
    DisposalModule,
    SupplierReturnsModule,

    // Phase 18: RFQ, Vendor Management & Invoice Matching
    RFQModule,
    VendorContractsModule,
    VendorRatingsModule,
    PriceAgreementsModule,
    InvoiceMatchingModule,
    ItemClassificationsModule,

    // Phase 19: Chronic Disease Management & Notifications
    NotificationsModule,
    ChronicCareModule,

    // Phase 20: External API Integrations (openFDA, SMS, LOINC)
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
