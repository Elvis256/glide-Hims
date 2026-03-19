import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useAuthStore } from './store/auth';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { getApiErrorMessage } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute, {
  DoctorRoute,
  NurseRoute,
  ClinicalRoute,
  PharmacistRoute,
  LabTechRoute,
  ReceptionistRoute,
  CashierRoute,
  StoreKeeperRoute,
  AccountantRoute,
  AdminRoute,
  FinanceRoute,
  HRRoute,
  BillingRoute,
  RadiologyRoute,
  ROLES,
} from './components/RoleRoute';
import DashboardLayout from './components/DashboardLayout';
import { PageLoader } from './components/PageLoader';

// Lazy-loaded page components (route-based code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizardPage'));
const RegisterOrganizationPage = lazy(() => import('./pages/RegisterOrganizationPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SmartDashboardPage = lazy(() => import('./pages/SmartDashboardPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const PatientSearchPage = lazy(() => import('./pages/PatientSearchPage'));
const PatientRegistrationPage = lazy(() => import('./pages/PatientRegistrationPage'));
const HospitalSchemeEnrollmentPage = lazy(() => import('./pages/HospitalSchemeEnrollmentPage'));
const PatientDocumentsPage = lazy(() => import('./pages/PatientDocumentsPage'));
const PatientHistoryPage = lazy(() => import('./pages/PatientHistoryPage'));
const PatientDetailPage = lazy(() => import('./pages/PatientDetailPage'));
const PatientEditPage = lazy(() => import('./pages/PatientEditPage'));
const OPDTokenPage = lazy(() => import('./pages/OPDTokenPage'));
const QueueMonitorPage = lazy(() => import('./pages/QueueMonitorPage'));
const CallNextPatientPage = lazy(() => import('./pages/CallNextPatientPage'));
const QueueAnalyticsPage = lazy(() => import('./pages/QueueAnalyticsPage'));
const BookAppointmentPage = lazy(() => import('./pages/BookAppointmentPage'));
const ViewAppointmentsPage = lazy(() => import('./pages/ViewAppointmentsPage'));
const DoctorSchedulesPage = lazy(() => import('./pages/DoctorSchedulesPage'));
const ManageAppointmentsPage = lazy(() => import('./pages/ManageAppointmentsPage'));
const NewBillPage = lazy(() => import('./pages/NewBillPage'));
const CollectPaymentPage = lazy(() => import('./pages/CollectPaymentPage'));
const PrintReceiptPage = lazy(() => import('./pages/PrintReceiptPage'));
const PendingPaymentsPage = lazy(() => import('./pages/PendingPaymentsPage'));
const RefundsPage = lazy(() => import('./pages/RefundsPage'));
const VerifyCoveragePage = lazy(() => import('./pages/VerifyCoveragePage'));
const PreAuthorizationPage = lazy(() => import('./pages/PreAuthorizationPage'));
const ClaimSubmissionPage = lazy(() => import('./pages/ClaimSubmissionPage'));
const InsuranceCardsPage = lazy(() => import('./pages/InsuranceCardsPage'));
const RegistrationDailySummaryPage = lazy(() => import('./pages/RegistrationDailySummaryPage'));
const PatientStatisticsPage = lazy(() => import('./pages/PatientStatisticsPage'));
const RegistrationRevenuePage = lazy(() => import('./pages/RegistrationRevenuePage'));
const QueuePerformancePage = lazy(() => import('./pages/QueuePerformancePage'));
const FacilitiesPage = lazy(() => import('./pages/FacilitiesPage'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const EncountersPage = lazy(() => import('./pages/EncountersPage'));
const EncounterDetailPage = lazy(() => import('./pages/EncounterDetailPage'));
const PharmacyPage = lazy(() => import('./pages/PharmacyPage'));
const CashierPage = lazy(() => import('./pages/CashierPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const LabPage = lazy(() => import('./pages/LabPage'));
const RadiologyPage = lazy(() => import('./pages/RadiologyPage'));
const WardManagementPage = lazy(() => import('./pages/WardManagementPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const TheatrePage = lazy(() => import('./pages/TheatrePage'));
const MaternityPage = lazy(() => import('./pages/MaternityPage'));
const HRPage = lazy(() => import('./pages/HRPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const InsurancePage = lazy(() => import('./pages/InsurancePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const VitalsPage = lazy(() => import('./pages/VitalsPage'));
const ClinicalNotesPage = lazy(() => import('./pages/ClinicalNotesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const MyPayslipsPage = lazy(() => import('./pages/hr/MyPayslipsPage'));
const MyLeavePage = lazy(() => import('./pages/hr/MyLeavePage'));
const MyAttendancePage = lazy(() => import('./pages/hr/MyAttendancePage'));
const MyAppraisalsPage = lazy(() => import('./pages/hr/MyAppraisalsPage'));
const QueueManagementPage = lazy(() => import('./pages/QueueManagementPage'));
const ReferralsPage = lazy(() => import('./pages/ReferralsPage'));
const FollowUpsPage = lazy(() => import('./pages/FollowUpsPage'));
const TreatmentPlansPage = lazy(() => import('./pages/TreatmentPlansPage'));
const DischargePage = lazy(() => import('./pages/DischargePage'));
const DoctorsOnDutyPage = lazy(() => import('./pages/DoctorsOnDutyPage'));
const RecordVitalsPage = lazy(() => import('./pages/nursing/RecordVitalsPage'));
const VitalsHistoryPage = lazy(() => import('./pages/nursing/VitalsHistoryPage'));
const VitalTrendsPage = lazy(() => import('./pages/nursing/VitalTrendsPage'));
const AbnormalAlertsPage = lazy(() => import('./pages/nursing/AbnormalAlertsPage'));
const TriageQueuePage = lazy(() => import('./pages/nursing/TriageQueuePage'));
const NursingAssessmentPage = lazy(() => import('./pages/nursing/NursingAssessmentPage'));
const PainAssessmentPage = lazy(() => import('./pages/nursing/PainAssessmentPage'));
const FallRiskPage = lazy(() => import('./pages/nursing/FallRiskPage'));
const MedicationSchedulePage = lazy(() => import('./pages/nursing/MedicationSchedulePage'));
const AdministerMedsPage = lazy(() => import('./pages/nursing/AdministerMedsPage'));
const MedicationChartPage = lazy(() => import('./pages/nursing/MedicationChartPage'));
const DrugAllergiesPage = lazy(() => import('./pages/nursing/DrugAllergiesPage'));
const WoundAssessmentPage = lazy(() => import('./pages/nursing/WoundAssessmentPage'));
const DressingLogPage = lazy(() => import('./pages/nursing/DressingLogPage'));
const WoundProgressPage = lazy(() => import('./pages/nursing/WoundProgressPage'));
const CarePlansPage = lazy(() => import('./pages/nursing/CarePlansPage'));
const NursingNotesPage = lazy(() => import('./pages/nursing/NursingNotesPage'));
const ShiftHandoverPage = lazy(() => import('./pages/nursing/ShiftHandoverPage'));
const PatientEducationPage = lazy(() => import('./pages/nursing/PatientEducationPage'));
const IVCannulationPage = lazy(() => import('./pages/nursing/IVCannulationPage'));
const CatheterizationPage = lazy(() => import('./pages/nursing/CatheterizationPage'));
const SpecimenCollectionPage = lazy(() => import('./pages/nursing/SpecimenCollectionPage'));
const ProcedureLogPage = lazy(() => import('./pages/nursing/ProcedureLogPage'));
const PatientMonitorPage = lazy(() => import('./pages/nursing/PatientMonitorPage'));
const IntakeOutputPage = lazy(() => import('./pages/nursing/IntakeOutputPage'));
const BloodSugarPage = lazy(() => import('./pages/nursing/BloodSugarPage'));
const ObservationChartPage = lazy(() => import('./pages/nursing/ObservationChartPage'));
const NursingDailyReportPage = lazy(() => import('./pages/nursing/NursingDailyReportPage'));
const ShiftSummaryPage = lazy(() => import('./pages/nursing/ShiftSummaryPage'));
const IncidentReportPage = lazy(() => import('./pages/nursing/IncidentReportPage'));
const WorkloadStatsPage = lazy(() => import('./pages/nursing/WorkloadStatsPage'));
const DoctorDashboardPage = lazy(() => import('./pages/doctor/DoctorDashboardPage'));
const WaitingPatientsPage = lazy(() => import('./pages/doctor/queue/WaitingPatientsPage'));
const CallNextPage = lazy(() => import('./pages/doctor/queue/CallNextPage'));
const TodaySchedulePage = lazy(() => import('./pages/doctor/queue/TodaySchedulePage'));
const PendingReviewsPage = lazy(() => import('./pages/doctor/queue/PendingReviewsPage'));
const NewConsultationPage = lazy(() => import('./pages/doctor/NewConsultationPage'));
const SOAPNotesPage = lazy(() => import('./pages/doctor/SOAPNotesPage'));
const ICD10CodingPage = lazy(() => import('./pages/doctor/diagnosis/ICD10CodingPage'));
const DifferentialDxPage = lazy(() => import('./pages/doctor/diagnosis/DifferentialDxPage'));
const ProblemListPage = lazy(() => import('./pages/doctor/diagnosis/ProblemListPage'));
const WritePrescriptionPage = lazy(() => import('./pages/doctor/prescriptions/WritePrescriptionPage'));
const PrescriptionHistoryPage = lazy(() => import('./pages/doctor/prescriptions/PrescriptionHistoryPage'));
const DrugInteractionsPage = lazy(() => import('./pages/doctor/prescriptions/DrugInteractionsPage'));
const FavoriteRxPage = lazy(() => import('./pages/doctor/prescriptions/FavoriteRxPage'));
const LabOrdersPage = lazy(() => import('./pages/doctor/orders/LabOrdersPage'));
const RadiologyOrdersPage = lazy(() => import('./pages/doctor/orders/RadiologyOrdersPage'));
const ProcedureOrdersPage = lazy(() => import('./pages/doctor/orders/ProcedureOrdersPage'));
const OrderSetsPage = lazy(() => import('./pages/doctor/orders/OrderSetsPage'));
const LabResultsPage = lazy(() => import('./pages/doctor/results/LabResultsPage'));
const ImagingResultsPage = lazy(() => import('./pages/doctor/results/ImagingResultsPage'));
const CriticalValuesPage = lazy(() => import('./pages/doctor/results/CriticalValuesPage'));
const NewReferralPage = lazy(() => import('./pages/doctor/referrals/NewReferralPage'));
const SentReferralsPage = lazy(() => import('./pages/doctor/referrals/SentReferralsPage'));
const MedicalCertificatePage = lazy(() => import('./pages/doctor/certificates/MedicalCertificatePage'));
const SickLeavePage = lazy(() => import('./pages/doctor/certificates/SickLeavePage'));
const FitnessCertificatePage = lazy(() => import('./pages/doctor/certificates/FitnessCertificatePage'));
const DeathCertificatePage = lazy(() => import('./pages/doctor/certificates/DeathCertificatePage'));
const MedicalReportPage = lazy(() => import('./pages/doctor/MedicalReportPage'));
const InsuranceReportPage = lazy(() => import('./pages/doctor/InsuranceReportPage'));
const ScheduleFollowUpPage = lazy(() => import('./pages/doctor/followups/ScheduleFollowUpPage'));
const OverdueFollowUpsPage = lazy(() => import('./pages/doctor/followups/OverdueFollowUpsPage'));
const NewOPDBillPage = lazy(() => import('./pages/billing/opd/NewOPDBillPage'));
const OPDOrderingPage = lazy(() => import('./pages/billing/opd/OPDOrderingPage'));
const PackageBillingPage = lazy(() => import('./pages/billing/opd/PackageBillingPage'));
const SearchBillsPage = lazy(() => import('./pages/billing/opd/SearchBillsPage'));
const InvoicesPage = lazy(() => import('./pages/billing/InvoicesPage'));
const PaymentsPage = lazy(() => import('./pages/billing/PaymentsPage'));
const ClaimsPage = lazy(() => import('./pages/billing/insurance/ClaimsPage'));
const InsuranceProvidersPage = lazy(() => import('./pages/billing/insurance/ProvidersPage'));
const RequisitionsPage = lazy(() => import('./pages/billing/procurement/RequisitionsPage'));
const RFQPage = lazy(() => import('./pages/billing/procurement/RFQPage'));
const CompareQuotesPage = lazy(() => import('./pages/billing/procurement/CompareQuotesPage'));
const ApproveQuotationsPage = lazy(() => import('./pages/billing/procurement/ApproveQuotationsPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/billing/procurement/PurchaseOrdersPage'));
const GoodsReceivedPage = lazy(() => import('./pages/billing/procurement/GoodsReceivedPage'));
const InvoiceMatchingPage = lazy(() => import('./pages/billing/procurement/InvoiceMatchingPage'));
const VendorListPage = lazy(() => import('./pages/billing/vendors/VendorListPage'));
const VendorContractsPage = lazy(() => import('./pages/billing/vendors/VendorContractsPage'));
const VendorRatingsPage = lazy(() => import('./pages/billing/vendors/VendorRatingsPage'));
const PriceAgreementsPage = lazy(() => import('./pages/billing/vendors/PriceAgreementsPage'));
const VendorPaymentsPage = lazy(() => import('./pages/billing/vendors/VendorPaymentsPage'));
const AccountsPage = lazy(() => import('./pages/billing/finance/AccountsPage'));
const JournalEntriesPage = lazy(() => import('./pages/billing/finance/JournalEntriesPage'));
const ExpensesPage = lazy(() => import('./pages/billing/finance/ExpensesPage'));
const RevenuePage = lazy(() => import('./pages/billing/finance/RevenuePage'));
const FinancialReportsPage = lazy(() => import('./pages/billing/finance/FinancialReportsPage'));
const CostCentersPage = lazy(() => import('./pages/billing/finance/CostCentersPage'));
const BudgetPage = lazy(() => import('./pages/billing/finance/BudgetPage'));
const BankReconciliationPage = lazy(() => import('./pages/billing/finance/BankReconciliationPage'));
const PatientFinancePage = lazy(() => import('./pages/billing/finance/PatientFinancePage'));
const PettyCashPage = lazy(() => import('./pages/billing/finance/PettyCashPage'));
const DonorFundsPage = lazy(() => import('./pages/billing/finance/DonorFundsPage'));
const EmergencyQueuePage = lazy(() => import('./pages/emergency/EmergencyQueuePage'));
const AmbulanceTrackingPage = lazy(() => import('./pages/emergency/AmbulanceTrackingPage'));
const EmergencyTriagePage = lazy(() => import('./pages/emergency/EmergencyTriagePage'));
const EmergencyBillingPage = lazy(() => import('./pages/emergency/EmergencyBillingPage'));
const LabQueuePage = lazy(() => import('./pages/lab/LabQueuePage'));
const SampleCollectionPage = lazy(() => import('./pages/lab/SampleCollectionPage'));
const ResultsEntryPage = lazy(() => import('./pages/lab/ResultsEntryPage'));
const LabReportsPage = lazy(() => import('./pages/lab/LabReportsPage'));
const LabAnalyticsPage = lazy(() => import('./pages/lab/LabAnalyticsPage'));
const RadiologyQueuePage = lazy(() => import('./pages/radiology/RadiologyQueuePage'));
const ImagingOrdersPage = lazy(() => import('./pages/radiology/ImagingOrdersPage'));
const RadiologyResultsPage = lazy(() => import('./pages/radiology/RadiologyResultsPage'));
const RadiologyAnalyticsPage = lazy(() => import('./pages/radiology/RadiologyAnalyticsPage'));
const DispenseMedicationPage = lazy(() => import('./pages/pharmacy/DispenseMedicationPage'));
const PharmacyQueuePage = lazy(() => import('./pages/pharmacy/PharmacyQueuePage'));
const PharmacyStockPage = lazy(() => import('./pages/pharmacy/PharmacyStockPage'));
const PharmacyReturnsPage = lazy(() => import('./pages/pharmacy/ReturnsPage'));
const PharmacyAdjustmentsPage = lazy(() => import('./pages/pharmacy/AdjustmentsPage'));
const PharmacyTransfersPage = lazy(() => import('./pages/pharmacy/PharmacyTransfersPage'));
const PharmacyAnalyticsPage = lazy(() => import('./pages/pharmacy/PharmacyAnalyticsPage'));
const RetailSalesPage = lazy(() => import('./pages/pharmacy/transactions/RetailSalesPage'));
const WholesalePage = lazy(() => import('./pages/pharmacy/transactions/WholesalePage'));
const InpatientMedsPage = lazy(() => import('./pages/pharmacy/transactions/InpatientMedsPage'));
const ExpiringSoonPage = lazy(() => import('./pages/pharmacy/expiry/ExpiringSoonPage'));
const ExpiredItemsPage = lazy(() => import('./pages/pharmacy/expiry/ExpiredItemsPage'));
const ExpiryAlertsPage = lazy(() => import('./pages/pharmacy/expiry/ExpiryAlertsPage'));
const DisposalLogPage = lazy(() => import('./pages/pharmacy/expiry/DisposalLogPage'));
const ReturnToSupplierPage = lazy(() => import('./pages/pharmacy/expiry/ReturnToSupplierPage'));
const ControlledSubstancesRegisterPage = lazy(() => import('./pages/pharmacy/ControlledSubstancesRegisterPage'));
const PharmacyRequisitionsPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyRequisitionsPage'));
const PharmacyRFQPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyRFQPage'));
const PharmacyCompareQuotesPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyCompareQuotesPage'));
const PharmacyPOPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyPOPage'));
const PharmacyGRNPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyGRNPage'));
const PharmacyInvoiceMatchPage = lazy(() => import('./pages/pharmacy/procurement/PharmacyInvoiceMatchPage'));
const PharmacySupplierPaymentsPage = lazy(() => import('./pages/pharmacy/procurement/SupplierPaymentsPage'));
const PharmacySupplierListPage = lazy(() => import('./pages/pharmacy/suppliers/PharmacySupplierListPage'));
const PharmacyContractsPage = lazy(() => import('./pages/pharmacy/suppliers/PharmacyContractsPage'));
const PharmacySupplierRatingsPage = lazy(() => import('./pages/pharmacy/suppliers/PharmacySupplierRatingsPage'));
const PharmacyPriceListsPage = lazy(() => import('./pages/pharmacy/suppliers/PharmacyPriceListsPage'));
const ExpiryManagementPage = lazy(() => import('./pages/pharmacy/ExpiryManagementPage'));
const MedicationAdherencePage = lazy(() => import('./pages/pharmacy/MedicationAdherencePage'));
const SupplierRankingsPage = lazy(() => import('./pages/pharmacy/SupplierRankingsPage'));
const PharmacyDashboardPage = lazy(() => import('./pages/pharmacy/PharmacyDashboardPage'));
const LabelManagementPage = lazy(() => import('./pages/pharmacy/LabelManagementPage'));
const TemperatureMonitoringPage = lazy(() => import('./pages/pharmacy/TemperatureMonitoringPage'));
const DURReportsPage = lazy(() => import('./pages/pharmacy/DURReportsPage'));
const DrugDatabaseSyncPage = lazy(() => import('./pages/pharmacy/DrugDatabaseSyncPage'));
const PrescriptionTemplatesPage = lazy(() => import('./pages/pharmacy/PrescriptionTemplatesPage'));
const NotificationLogPage = lazy(() => import('./pages/pharmacy/NotificationLogPage'));
const AdmissionsPage = lazy(() => import('./pages/ipd/AdmissionsPage'));
const WardsBedsPage = lazy(() => import('./pages/ipd/WardsBedsPage'));
const BHTIssuePage = lazy(() => import('./pages/ipd/BHTIssuePage'));
const InpatientBillingPage = lazy(() => import('./pages/ipd/InpatientBillingPage'));
const IPDNursingNotesPage = lazy(() => import('./pages/ipd/IPDNursingNotesPage'));
const IPDTheatrePage = lazy(() => import('./pages/ipd/TheatrePage'));
const IPDMaternityPage = lazy(() => import('./pages/ipd/MaternityPage'));
const IPDDischargePage = lazy(() => import('./pages/ipd/DischargePage'));
const IPDAnalyticsPage = lazy(() => import('./pages/ipd/IPDAnalyticsPage'));
const MainInventoryPage = lazy(() => import('./pages/stores/MainInventoryPage'));
const UnitIssuePage = lazy(() => import('./pages/stores/UnitIssuePage'));
const StoreTransfersPage = lazy(() => import('./pages/stores/StoreTransfersPage'));
const StoresProcurementPage = lazy(() => import('./pages/stores/StoresProcurementPage'));
const StoresSupplierPage = lazy(() => import('./pages/stores/StoresSupplierPage'));
const StoresExpiryPage = lazy(() => import('./pages/stores/StoresExpiryPage'));
const StockAdjustmentsPage = lazy(() => import('./pages/stores/StockAdjustmentsPage'));
const StockTakePage = lazy(() => import('./pages/stores/StockTakePage'));
const StoresAssetRegisterPage = lazy(() => import('./pages/stores/AssetRegisterPage'));
const MaintenanceSchedulePage = lazy(() => import('./pages/stores/MaintenanceSchedulePage'));
const ConsumptionReportsPage = lazy(() => import('./pages/stores/ConsumptionReportsPage'));
const StoresAnalyticsPage = lazy(() => import('./pages/stores/StoresAnalyticsPage'));
const StoresRequisitionsPage = lazy(() => import('./pages/stores/StoresRequisitionsPage'));
const StoresRFQPage = lazy(() => import('./pages/stores/StoresRFQPage'));
const StoresCompareQuotesPage = lazy(() => import('./pages/stores/StoresCompareQuotesPage'));
const StoresPOPage = lazy(() => import('./pages/stores/StoresPOPage'));
const StoresGRNPage = lazy(() => import('./pages/stores/StoresGRNPage'));
const StoresInvoiceMatchPage = lazy(() => import('./pages/stores/StoresInvoiceMatchPage'));
const StoresSupplierContractsPage = lazy(() => import('./pages/stores/StoresSupplierContractsPage'));
const StoresPaymentsPage = lazy(() => import('./pages/stores/StoresPaymentsPage'));
const StoresDisposalPage = lazy(() => import('./pages/stores/StoresDisposalPage'));
const ItemClassificationsPage = lazy(() => import('./pages/settings/ItemClassificationsPage'));
const UserListPage = lazy(() => import('./pages/admin/users/UserListPage'));
const RolePermissionsPage = lazy(() => import('./pages/admin/users/RolePermissionsPage'));
const UserActivityLogPage = lazy(() => import('./pages/admin/users/UserActivityLogPage'));
const DepartmentAccessPage = lazy(() => import('./pages/admin/users/DepartmentAccessPage'));
const SessionManagementPage = lazy(() => import('./pages/admin/users/SessionManagementPage'));
const ServiceCatalogPage = lazy(() => import('./pages/admin/services/ServiceCatalogPage'));
const PricingManagementPage = lazy(() => import('./pages/admin/services/PricingManagementPage'));
const ServicePackagesPage = lazy(() => import('./pages/admin/services/ServicePackagesPage'));
const DiscountSchemesPage = lazy(() => import('./pages/admin/services/DiscountSchemesPage'));
const TaxConfigurationPage = lazy(() => import('./pages/admin/services/TaxConfigurationPage'));
const InsurancePriceListsPage = lazy(() => import('./pages/admin/pricing/InsurancePriceListsPage'));
const StaffDirectoryPage = lazy(() => import('./pages/admin/hr/StaffDirectoryPage'));
const AdminDepartmentsPage = lazy(() => import('./pages/admin/hr/DepartmentsPage'));
const DesignationsPage = lazy(() => import('./pages/admin/hr/DesignationsPage'));
const ShiftManagementPage = lazy(() => import('./pages/admin/hr/ShiftManagementPage'));
const LeaveManagementPage = lazy(() => import('./pages/admin/hr/LeaveManagementPage'));
const CredentialsPage = lazy(() => import('./pages/admin/hr/CredentialsPage'));
const AttendancePage = lazy(() => import('./pages/admin/hr/AttendancePage'));
const PayrollPage = lazy(() => import('./pages/admin/hr/PayrollPage'));
const RecruitmentPage = lazy(() => import('./pages/admin/hr/RecruitmentPage'));
const AppraisalsPage = lazy(() => import('./pages/admin/hr/AppraisalsPage'));
const AppraisalDetailPage = lazy(() => import('./pages/admin/hr/AppraisalDetailPage'));
const TrainingPage = lazy(() => import('./pages/admin/hr/TrainingPage'));
const HRAnalyticsPage = lazy(() => import('./pages/admin/hr/HRAnalyticsPage'));
const TestCatalogPage = lazy(() => import('./pages/admin/lab/TestCatalogPage'));
const LabEquipmentPage = lazy(() => import('./pages/admin/lab/LabEquipmentPage'));
const ReagentsInventoryPage = lazy(() => import('./pages/admin/lab/ReagentsInventoryPage'));
const LabPanelsPage = lazy(() => import('./pages/admin/lab/LabPanelsPage'));
const ApprovalWorkflowPage = lazy(() => import('./pages/admin/procurement/ApprovalWorkflowPage'));
const BudgetManagementPage = lazy(() => import('./pages/admin/procurement/BudgetManagementPage'));
const ProcurementPoliciesPage = lazy(() => import('./pages/admin/procurement/ProcurementPoliciesPage'));
const ItemCategoriesPage = lazy(() => import('./pages/admin/procurement/ItemCategoriesPage'));
const StoreLocationsPage = lazy(() => import('./pages/admin/inventory/StoreLocationsPage'));
const ItemMasterPage = lazy(() => import('./pages/admin/inventory/ItemMasterPage'));
const DrugFormularyPage = lazy(() => import('./pages/admin/inventory/DrugFormularyPage'));
const DrugCategoriesPage = lazy(() => import('./pages/admin/inventory/DrugCategoriesPage'));
const UnitOfMeasurePage = lazy(() => import('./pages/admin/inventory/UnitOfMeasurePage'));
const ExpiryPoliciesPage = lazy(() => import('./pages/admin/inventory/ExpiryPoliciesPage'));
const InstitutionProfilePage = lazy(() => import('./pages/admin/site/InstitutionProfilePage'));
const BranchesPage = lazy(() => import('./pages/admin/site/BranchesPage'));
const BuildingsFloorsPage = lazy(() => import('./pages/admin/site/BuildingsFloorsPage'));
const SystemSettingsPage = lazy(() => import('./pages/admin/site/SystemSettingsPage'));
const IntegrationsPage = lazy(() => import('./pages/admin/site/IntegrationsPage'));
const MembershipPlansPage = lazy(() => import('./pages/admin/membership/MembershipPlansPage'));
const MembershipBenefitsPage = lazy(() => import('./pages/admin/membership/MembershipBenefitsPage'));
const CorporatePlansPage = lazy(() => import('./pages/admin/membership/CorporatePlansPage'));
const MembershipRulesPage = lazy(() => import('./pages/admin/membership/MembershipRulesPage'));
const CurrenciesPage = lazy(() => import('./pages/admin/finance/CurrenciesPage'));
const ExchangeRatesPage = lazy(() => import('./pages/admin/finance/ExchangeRatesPage'));
const PaymentMethodsPage = lazy(() => import('./pages/admin/finance/PaymentMethodsPage'));
const SyncStatusPage = lazy(() => import('./pages/sync/SyncStatusPage'));
const OfflineQueuePage = lazy(() => import('./pages/sync/OfflineQueuePage'));
const ConflictResolutionPage = lazy(() => import('./pages/sync/ConflictResolutionPage'));
const ProviderDirectoryPage = lazy(() => import('./pages/providers/ProviderDirectoryPage'));
const ProviderCredentialsPage = lazy(() => import('./pages/providers/ProviderCredentialsPage'));
const DrugClassificationsPage = lazy(() => import('./pages/drug-management/DrugClassificationsPage'));
const DrugInteractionsDatabasePage = lazy(() => import('./pages/drug-management/DrugInteractionsDatabasePage'));
const AllergyClassesPage = lazy(() => import('./pages/drug-management/AllergyClassesPage'));
const SupplierPaymentVouchersPage = lazy(() => import('./pages/supplier-finance/SupplierPaymentVouchersPage'));
const SupplierCreditNotesPage = lazy(() => import('./pages/supplier-finance/SupplierCreditNotesPage'));
const SupplierLedgerPage = lazy(() => import('./pages/supplier-finance/SupplierLedgerPage'));
const MasterDataVersionsPage = lazy(() => import('./pages/mdm/MasterDataVersionsPage'));
const MasterDataApprovalsPage = lazy(() => import('./pages/mdm/MasterDataApprovalsPage'));
const ApprovalRulesPage = lazy(() => import('./pages/mdm/ApprovalRulesPage'));
const LabQCDashboardPage = lazy(() => import('./pages/lab-qc/LabQCDashboardPage'));
const LabConsumablesPage = lazy(() => import('./pages/lab-qc/LabConsumablesPage'));
const AssetDepreciationPage = lazy(() => import('./pages/assets/AssetDepreciationPage'));
const AssetTransfersPage = lazy(() => import('./pages/assets/AssetTransfersPage'));
const AssetDisposalPage = lazy(() => import('./pages/assets/AssetDisposalPage'));
const AssetRegisterPage = lazy(() => import('./pages/assets/AssetRegisterPage'));
const AssetMaintenancePage = lazy(() => import('./pages/assets/AssetMaintenancePage'));
const AssetReportsPage = lazy(() => import('./pages/assets/AssetReportsPage'));
const AssetAllocationPage = lazy(() => import('./pages/assets/AssetAllocationPage'));
const AssetTrackingPage = lazy(() => import('./pages/assets/AssetTrackingPage'));
const AssetCategoriesPage = lazy(() => import('./pages/admin/AssetCategoriesPage'));
const ChronicCareDashboardPage = lazy(() => import('./pages/chronic-care/ChronicCareDashboardPage'));
const ChronicRegistryPage = lazy(() => import('./pages/chronic-care/ChronicRegistryPage'));
const ChronicRemindersPage = lazy(() => import('./pages/chronic-care/ChronicRemindersPage'));
const NotificationSettingsPage = lazy(() => import('./pages/chronic-care/NotificationSettingsPage'));
const NotificationHistoryPage = lazy(() => import('./pages/admin/notifications/NotificationHistoryPage'));
const SmsTemplatesPage = lazy(() => import('./pages/admin/notifications/SmsTemplatesPage'));
const BulkSmsPage = lazy(() => import('./pages/admin/notifications/BulkSmsPage'));
const ReportsDashboardPage = lazy(() => import('./pages/reports/ReportsDashboardPage'));
const PatientStatisticsReportPage = lazy(() => import('./pages/reports/PatientStatisticsReportPage'));
const VisitReportsPage = lazy(() => import('./pages/reports/VisitReportsPage'));
const DiseaseStatisticsPage = lazy(() => import('./pages/reports/DiseaseStatisticsPage'));
const MortalityReportsPage = lazy(() => import('./pages/reports/MortalityReportsPage'));
const RevenueReportsPage = lazy(() => import('./pages/reports/RevenueReportsPage'));
const CollectionReportsPage = lazy(() => import('./pages/reports/CollectionReportsPage'));
const OutstandingReportsPage = lazy(() => import('./pages/reports/OutstandingReportsPage'));
const StockReportsPage = lazy(() => import('./pages/reports/StockReportsPage'));
const ExpiryReportsPage = lazy(() => import('./pages/reports/ExpiryReportsPage'));
const InventoryConsumptionReportsPage = lazy(() => import('./pages/reports/ConsumptionReportsPage'));
const DrugDatabasePage = lazy(() => import('./pages/integrations/DrugDatabasePage'));
const LabReferencePage = lazy(() => import('./pages/integrations/LabReferencePage'));
const SMSNotificationsPage = lazy(() => import('./pages/integrations/SMSNotificationsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // Global error handler for mutations - shows toast with user-friendly message
        toast.error(getApiErrorMessage(error));
      },
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, logout, accessToken, refreshToken, setTokens } = useAuthStore();
  const [setupChecked, setSetupChecked] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(true);

  // Check setup status and validate token on initial app load
  useEffect(() => {
    const checkSetup = async () => {
      // Skip check if on setup or register page
      if (window.location.pathname === '/setup' || window.location.pathname === '/register') {
        setSetupChecked(true);
        return;
      }

      // If user is authenticated, validate token or refresh it
      if (isAuthenticated && accessToken && refreshToken) {
        try {
          // Validate token and fetch accessible modules
          const { authService } = await import('./services/auth');
          await authService.getProfile();
          
          // Fetch accessible modules from /auth/me
          try {
            const meData = await authService.getMe();
            const { useAuthStore } = await import('./store/auth');
            useAuthStore.getState().updateFromMe(meData);
          } catch {
            // Non-critical: navigation will fall back to role-based filtering
          }
          
          console.log('[App] Token valid, setup complete');
        } catch (err) {
          console.log('[App] Token expired, attempting refresh...');
          try {
            // Token expired, try to refresh
            const { authService } = await import('./services/auth');
            const tokens = await authService.refreshToken(refreshToken);
            setTokens(tokens.accessToken, tokens.refreshToken);
            console.log('[App] Token refreshed successfully');

            // Re-validate with new token and load user profile
            try {
              await authService.getProfile();
              const meData = await authService.getMe();
              const { useAuthStore } = await import('./store/auth');
              useAuthStore.getState().updateFromMe(meData);
              console.log('[App] Profile reloaded after refresh');
            } catch {
              // Profile fetch failed even with new token — non-critical
            }
          } catch (refreshErr) {
            console.error('[App] Token refresh failed, logging out');
            logout();
          }
        }
        setIsSetupComplete(true);
        setSetupChecked(true);
        return;
      }
      
      try {
        const status = await import('./services/setup').then(m => m.setupService.getStatus());
        console.log('[App] Setup status:', status);
        setIsSetupComplete(status.isSetupComplete);
        
        // If setup not complete, clear any stale auth
        if (!status.isSetupComplete) {
          console.log('[App] Setup not complete, clearing auth');
          logout();
        }
      } catch (err) {
        console.error('[App] Setup check error:', err);
        // Assume complete if check fails
        setIsSetupComplete(true);
      }
      setSetupChecked(true);
    };
    checkSetup();
  }, []); // Run only once on mount

  // Show loading while checking setup
  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to setup if not complete
  if (!isSetupComplete && window.location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/setup" element={<SetupWizardPage />} />
      <Route path="/register" element={<RegisterOrganizationPage />} />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ErrorBoundary level="route">
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<SmartDashboardPage />} />
                
                {/* Registration - Patient Management */}
                <Route path="/patients/search" element={<ReceptionistRoute><PatientSearchPage /></ReceptionistRoute>} />
                <Route path="/patients/new" element={<ReceptionistRoute><PatientRegistrationPage /></ReceptionistRoute>} />
                <Route path="/patients/hospital-scheme-enroll" element={<ReceptionistRoute><HospitalSchemeEnrollmentPage /></ReceptionistRoute>} />
                <Route path="/patients/documents" element={<ReceptionistRoute><PatientDocumentsPage /></ReceptionistRoute>} />
                <Route path="/patients/history" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER]}><PatientHistoryPage /></RoleRoute>} />
                <Route path="/patients/:id/edit" element={<ReceptionistRoute><PatientEditPage /></ReceptionistRoute>} />
                <Route path="/patients/:id" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER, ROLES.LAB_TECHNICIAN, ROLES.PHARMACIST, ROLES.RADIOLOGIST, ROLES.ADMIN]}><PatientDetailPage /></RoleRoute>} />
                <Route path="/patients" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER, ROLES.LAB_TECHNICIAN, ROLES.PHARMACIST, ROLES.RADIOLOGIST, ROLES.ADMIN]}><PatientsPage /></RoleRoute>} />
                
                {/* Registration - Queue & Tokens */}
                <Route path="/opd/token" element={<ReceptionistRoute><OPDTokenPage /></ReceptionistRoute>} />
                <Route path="/doctors/on-duty" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR]}><DoctorsOnDutyPage /></RoleRoute>} />
                <Route path="/queue/monitor" element={<ReceptionistRoute><QueueMonitorPage /></ReceptionistRoute>} />
                <Route path="/queue/call" element={<ReceptionistRoute><CallNextPatientPage /></ReceptionistRoute>} />
                <Route path="/queue/analytics" element={<ReceptionistRoute><QueueAnalyticsPage /></ReceptionistRoute>} />
                <Route path="/queue" element={<ReceptionistRoute><QueueManagementPage /></ReceptionistRoute>} />
                <Route path="/triage" element={<NurseRoute><QueueManagementPage /></NurseRoute>} />
                
                {/* Registration - Channelling/Appointments */}
                <Route path="/appointments/new" element={<ReceptionistRoute><BookAppointmentPage /></ReceptionistRoute>} />
                <Route path="/appointments" element={<ReceptionistRoute><ViewAppointmentsPage /></ReceptionistRoute>} />
                <Route path="/schedules/doctors" element={<ReceptionistRoute><DoctorSchedulesPage /></ReceptionistRoute>} />
                <Route path="/appointments/manage" element={<ReceptionistRoute><ManageAppointmentsPage /></ReceptionistRoute>} />
                
                {/* Registration - Reception Billing */}
                <Route path="/billing/reception/new" element={<CashierRoute><NewBillPage /></CashierRoute>} />
                <Route path="/billing/reception/payment" element={<CashierRoute><CollectPaymentPage /></CashierRoute>} />
                <Route path="/billing/reception/receipt" element={<CashierRoute><PrintReceiptPage /></CashierRoute>} />
                <Route path="/billing/reception/pending" element={<CashierRoute><PendingPaymentsPage /></CashierRoute>} />
                <Route path="/billing/reception/refunds" element={<CashierRoute><RefundsPage /></CashierRoute>} />
                
                {/* Registration - Insurance Desk */}
                <Route path="/insurance/verify" element={<ReceptionistRoute><VerifyCoveragePage /></ReceptionistRoute>} />
                <Route path="/insurance/preauth" element={<ReceptionistRoute><PreAuthorizationPage /></ReceptionistRoute>} />
                <Route path="/insurance/submit" element={<ReceptionistRoute><ClaimSubmissionPage /></ReceptionistRoute>} />
                <Route path="/insurance/cards" element={<ReceptionistRoute><InsuranceCardsPage /></ReceptionistRoute>} />
                
                {/* Registration - Reports */}
                <Route path="/reports/registration/daily" element={<ReceptionistRoute><RegistrationDailySummaryPage /></ReceptionistRoute>} />
                <Route path="/reports/registration/patients" element={<ReceptionistRoute><PatientStatisticsPage /></ReceptionistRoute>} />
                <Route path="/reports/registration/revenue" element={<ReceptionistRoute><RegistrationRevenuePage /></ReceptionistRoute>} />
                <Route path="/reports/registration/queue" element={<ReceptionistRoute><QueuePerformancePage /></ReceptionistRoute>} />
                
                {/* Nursing - Patient Vitals */}
                <Route path="/nursing/vitals/new" element={<NurseRoute><RecordVitalsPage /></NurseRoute>} />
                <Route path="/nursing/vitals/history" element={<NurseRoute><VitalsHistoryPage /></NurseRoute>} />
                <Route path="/nursing/vitals/trends" element={<NurseRoute><VitalTrendsPage /></NurseRoute>} />
                <Route path="/nursing/vitals/alerts" element={<NurseRoute><AbnormalAlertsPage /></NurseRoute>} />
                
                {/* Nursing - Triage & Assessment */}
                <Route path="/nursing/triage" element={<NurseRoute><TriageQueuePage /></NurseRoute>} />
                <Route path="/nursing/assessment" element={<NurseRoute><NursingAssessmentPage /></NurseRoute>} />
                <Route path="/nursing/pain" element={<NurseRoute><PainAssessmentPage /></NurseRoute>} />
                <Route path="/nursing/fall-risk" element={<NurseRoute><FallRiskPage /></NurseRoute>} />
                
                {/* Nursing - Medication */}
                <Route path="/nursing/meds/schedule" element={<NurseRoute><MedicationSchedulePage /></NurseRoute>} />
                <Route path="/nursing/meds/administer" element={<NurseRoute><AdministerMedsPage /></NurseRoute>} />
                <Route path="/nursing/meds/chart" element={<NurseRoute><MedicationChartPage /></NurseRoute>} />
                <Route path="/nursing/meds/allergies" element={<NurseRoute><DrugAllergiesPage /></NurseRoute>} />
                
                {/* Nursing - Wound Care */}
                <Route path="/nursing/wounds/assess" element={<NurseRoute><WoundAssessmentPage /></NurseRoute>} />
                <Route path="/nursing/wounds/dressing" element={<NurseRoute><DressingLogPage /></NurseRoute>} />
                <Route path="/nursing/wounds/progress" element={<NurseRoute><WoundProgressPage /></NurseRoute>} />
                
                {/* Nursing - Patient Care */}
                <Route path="/nursing/care-plans" element={<NurseRoute><CarePlansPage /></NurseRoute>} />
                <Route path="/nursing/notes" element={<NurseRoute><NursingNotesPage /></NurseRoute>} />
                <Route path="/nursing/handover" element={<NurseRoute><ShiftHandoverPage /></NurseRoute>} />
                <Route path="/nursing/education" element={<NurseRoute><PatientEducationPage /></NurseRoute>} />
                
                {/* Nursing - Procedures */}
                <Route path="/nursing/procedures/iv" element={<NurseRoute><IVCannulationPage /></NurseRoute>} />
                <Route path="/nursing/procedures/catheter" element={<NurseRoute><CatheterizationPage /></NurseRoute>} />
                <Route path="/nursing/procedures/specimen" element={<NurseRoute><SpecimenCollectionPage /></NurseRoute>} />
                <Route path="/nursing/procedures/log" element={<NurseRoute><ProcedureLogPage /></NurseRoute>} />
                
                {/* Nursing - Monitoring */}
                <Route path="/nursing/monitor" element={<NurseRoute><PatientMonitorPage /></NurseRoute>} />
                <Route path="/nursing/io" element={<NurseRoute><IntakeOutputPage /></NurseRoute>} />
                <Route path="/nursing/glucose" element={<NurseRoute><BloodSugarPage /></NurseRoute>} />
                <Route path="/nursing/observations" element={<NurseRoute><ObservationChartPage /></NurseRoute>} />
                
                {/* Nursing - Reports */}
                <Route path="/nursing/reports/daily" element={<NurseRoute><NursingDailyReportPage /></NurseRoute>} />
                <Route path="/nursing/reports/shift" element={<NurseRoute><ShiftSummaryPage /></NurseRoute>} />
                <Route path="/nursing/reports/incident" element={<NurseRoute><IncidentReportPage /></NurseRoute>} />
                <Route path="/nursing/reports/workload" element={<NurseRoute><WorkloadStatsPage /></NurseRoute>} />
                
                {/* Doctors - Dashboard & Queue */}
                <Route path="/doctor" element={<DoctorRoute><DoctorDashboardPage /></DoctorRoute>} />
                <Route path="/doctor/consult" element={<DoctorRoute><NewConsultationPage /></DoctorRoute>} />
                <Route path="/doctor/queue" element={<DoctorRoute><WaitingPatientsPage /></DoctorRoute>} />
                <Route path="/doctor/queue/call" element={<DoctorRoute><CallNextPage /></DoctorRoute>} />
                <Route path="/doctor/schedule" element={<DoctorRoute><TodaySchedulePage /></DoctorRoute>} />
                <Route path="/doctor/pending" element={<DoctorRoute><PendingReviewsPage /></DoctorRoute>} />
                
                {/* Doctors - Consultation (legacy routes redirect) */}
                <Route path="/encounters/new" element={<RoleRoute roles={[ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST]}><NewConsultationPage /></RoleRoute>} />
                <Route path="/doctor/consultation/new" element={<Navigate to="/doctor/consult" replace />} />
                <Route path="/doctor/soap" element={<DoctorRoute><SOAPNotesPage /></DoctorRoute>} />
                <Route path="/doctor/notes" element={<DoctorRoute><ClinicalNotesPage /></DoctorRoute>} />
                <Route path="/encounters" element={<ClinicalRoute><EncountersPage /></ClinicalRoute>} />
                
                {/* Doctors - Diagnosis */}
                <Route path="/doctor/diagnosis/icd" element={<DoctorRoute><ICD10CodingPage /></DoctorRoute>} />
                <Route path="/doctor/diagnosis/differential" element={<DoctorRoute><DifferentialDxPage /></DoctorRoute>} />
                <Route path="/doctor/diagnosis/problems" element={<DoctorRoute><ProblemListPage /></DoctorRoute>} />
                
                {/* Doctors - Prescriptions */}
                <Route path="/doctor/prescriptions/new" element={<DoctorRoute><WritePrescriptionPage /></DoctorRoute>} />
                <Route path="/doctor/prescriptions" element={<DoctorRoute><PrescriptionHistoryPage /></DoctorRoute>} />
                <Route path="/doctor/prescriptions/interactions" element={<DoctorRoute><DrugInteractionsPage /></DoctorRoute>} />
                <Route path="/doctor/prescriptions/favorites" element={<DoctorRoute><FavoriteRxPage /></DoctorRoute>} />
                
                {/* Doctors - Orders */}
                <Route path="/doctor/orders/lab" element={<DoctorRoute><LabOrdersPage /></DoctorRoute>} />
                <Route path="/doctor/orders/radiology" element={<DoctorRoute><RadiologyOrdersPage /></DoctorRoute>} />
                <Route path="/doctor/orders/procedures" element={<DoctorRoute><ProcedureOrdersPage /></DoctorRoute>} />
                <Route path="/doctor/orders/sets" element={<DoctorRoute><OrderSetsPage /></DoctorRoute>} />
                
                {/* Doctors - Results Review */}
                <Route path="/doctor/results/lab" element={<DoctorRoute><LabResultsPage /></DoctorRoute>} />
                <Route path="/doctor/results/imaging" element={<DoctorRoute><ImagingResultsPage /></DoctorRoute>} />
                <Route path="/doctor/results/critical" element={<DoctorRoute><CriticalValuesPage /></DoctorRoute>} />
                
                {/* Doctors - Referrals */}
                <Route path="/referrals/new" element={<DoctorRoute><NewReferralPage /></DoctorRoute>} />
                <Route path="/referrals/sent" element={<DoctorRoute><SentReferralsPage /></DoctorRoute>} />
                <Route path="/referrals/received" element={<DoctorRoute><ReferralsPage /></DoctorRoute>} />
                
                {/* Doctors - Certificates */}
                <Route path="/doctor/certificates/medical" element={<DoctorRoute><MedicalCertificatePage /></DoctorRoute>} />
                <Route path="/doctor/certificates/sick-leave" element={<DoctorRoute><SickLeavePage /></DoctorRoute>} />
                <Route path="/doctor/certificates/fitness" element={<DoctorRoute><FitnessCertificatePage /></DoctorRoute>} />
                <Route path="/doctor/certificates/death" element={<DoctorRoute><DeathCertificatePage /></DoctorRoute>} />
                
                {/* Doctors - Medical Report */}
                <Route path="/doctor/report" element={<DoctorRoute><MedicalReportPage /></DoctorRoute>} />
                <Route path="/doctor/report/insurance" element={<DoctorRoute><InsuranceReportPage /></DoctorRoute>} />
                
                {/* Doctors - Follow-up */}
                <Route path="/follow-ups/new" element={<DoctorRoute><ScheduleFollowUpPage /></DoctorRoute>} />
                <Route path="/follow-ups" element={<DoctorRoute><FollowUpsPage /></DoctorRoute>} />
                <Route path="/follow-ups/overdue" element={<DoctorRoute><OverdueFollowUpsPage /></DoctorRoute>} />
                
                {/* Billing - OPD */}
                <Route path="/billing/opd/new" element={<BillingRoute><NewOPDBillPage /></BillingRoute>} />
                <Route path="/billing/opd/orders" element={<BillingRoute><OPDOrderingPage /></BillingRoute>} />
                <Route path="/billing/opd/packages" element={<BillingRoute><PackageBillingPage /></BillingRoute>} />
                <Route path="/billing/opd/search" element={<BillingRoute><SearchBillsPage /></BillingRoute>} />
                
                {/* Billing - Core */}
                <Route path="/billing/invoices" element={<BillingRoute><InvoicesPage /></BillingRoute>} />
                <Route path="/billing/payments" element={<BillingRoute><PaymentsPage /></BillingRoute>} />
                
                {/* Billing - Insurance */}
                <Route path="/insurance/claims" element={<BillingRoute><ClaimsPage /></BillingRoute>} />
                <Route path="/insurance/providers" element={<BillingRoute><InsuranceProvidersPage /></BillingRoute>} />
                
                {/* Billing - Procurement */}
                <Route path="/procurement/requisitions" element={<StoreKeeperRoute><RequisitionsPage /></StoreKeeperRoute>} />
                <Route path="/procurement/rfq" element={<StoreKeeperRoute><RFQPage /></StoreKeeperRoute>} />
                <Route path="/procurement/quotes/compare" element={<StoreKeeperRoute><CompareQuotesPage /></StoreKeeperRoute>} />
                <Route path="/procurement/quotes/approve" element={<AdminRoute><ApproveQuotationsPage /></AdminRoute>} />
                <Route path="/procurement/orders" element={<StoreKeeperRoute><PurchaseOrdersPage /></StoreKeeperRoute>} />
                <Route path="/procurement/grn" element={<StoreKeeperRoute><GoodsReceivedPage /></StoreKeeperRoute>} />
                <Route path="/procurement/invoices/match" element={<AccountantRoute><InvoiceMatchingPage /></AccountantRoute>} />
                
                {/* Billing - Vendors */}
                <Route path="/procurement/vendors" element={<StoreKeeperRoute><VendorListPage /></StoreKeeperRoute>} />
                <Route path="/procurement/vendors/contracts" element={<StoreKeeperRoute><VendorContractsPage /></StoreKeeperRoute>} />
                <Route path="/procurement/vendors/ratings" element={<StoreKeeperRoute><VendorRatingsPage /></StoreKeeperRoute>} />
                <Route path="/procurement/vendors/prices" element={<StoreKeeperRoute><PriceAgreementsPage /></StoreKeeperRoute>} />
                <Route path="/procurement/vendors/payments" element={<AccountantRoute><VendorPaymentsPage /></AccountantRoute>} />
                
                {/* Billing - Finance */}
                <Route path="/finance/accounts" element={<FinanceRoute><AccountsPage /></FinanceRoute>} />
                <Route path="/finance/journals" element={<FinanceRoute><JournalEntriesPage /></FinanceRoute>} />
                <Route path="/finance/expenses" element={<FinanceRoute><ExpensesPage /></FinanceRoute>} />
                <Route path="/finance/revenue" element={<FinanceRoute><RevenuePage /></FinanceRoute>} />
                <Route path="/finance/reports" element={<FinanceRoute><FinancialReportsPage /></FinanceRoute>} />
                <Route path="/finance/cost-centers" element={<FinanceRoute><CostCentersPage /></FinanceRoute>} />
                <Route path="/finance/budgets" element={<FinanceRoute><BudgetPage /></FinanceRoute>} />
                <Route path="/finance/bank-reconciliation" element={<FinanceRoute><BankReconciliationPage /></FinanceRoute>} />
                <Route path="/finance/patient-finance" element={<FinanceRoute><PatientFinancePage /></FinanceRoute>} />
                <Route path="/finance/petty-cash" element={<FinanceRoute><PettyCashPage /></FinanceRoute>} />
                <Route path="/finance/donor-funds" element={<FinanceRoute><DonorFundsPage /></FinanceRoute>} />
                
                {/* Emergency Module */}
                <Route path="/emergency/queue" element={<ClinicalRoute><EmergencyQueuePage /></ClinicalRoute>} />
                <Route path="/emergency/ambulance" element={<ClinicalRoute><AmbulanceTrackingPage /></ClinicalRoute>} />
                <Route path="/emergency/triage" element={<ClinicalRoute><EmergencyTriagePage /></ClinicalRoute>} />
                <Route path="/emergency/billing" element={<BillingRoute><EmergencyBillingPage /></BillingRoute>} />
                
                {/* Laboratory Module */}
                <Route path="/lab/queue" element={<LabTechRoute><LabQueuePage /></LabTechRoute>} />
                <Route path="/lab/samples" element={<LabTechRoute><SampleCollectionPage /></LabTechRoute>} />
                <Route path="/lab/results" element={<LabTechRoute><ResultsEntryPage /></LabTechRoute>} />
                <Route path="/lab/reports" element={<LabTechRoute><LabReportsPage /></LabTechRoute>} />
                <Route path="/lab/analytics" element={<LabTechRoute><LabAnalyticsPage /></LabTechRoute>} />
                
                {/* Radiology Module */}
                <Route path="/radiology/queue" element={<RadiologyRoute><RadiologyQueuePage /></RadiologyRoute>} />
                <Route path="/radiology/orders" element={<RadiologyRoute><ImagingOrdersPage /></RadiologyRoute>} />
                <Route path="/radiology/results" element={<RadiologyRoute><RadiologyResultsPage /></RadiologyRoute>} />
                <Route path="/radiology/analytics" element={<RadiologyRoute><RadiologyAnalyticsPage /></RadiologyRoute>} />
                
                {/* Pharmacy - Core */}
                <Route path="/pharmacy/dashboard" element={<PharmacistRoute><PharmacyDashboardPage /></PharmacistRoute>} />
                <Route path="/pharmacy/dispense" element={<PharmacistRoute><DispenseMedicationPage /></PharmacistRoute>} />
                <Route path="/pharmacy/queue" element={<PharmacistRoute><PharmacyQueuePage /></PharmacistRoute>} />
                <Route path="/pharmacy/stock" element={<PharmacistRoute><PharmacyStockPage /></PharmacistRoute>} />
                <Route path="/pharmacy/returns" element={<PharmacistRoute><PharmacyReturnsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/adjustments" element={<PharmacistRoute><PharmacyAdjustmentsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/transfers" element={<PharmacistRoute><PharmacyTransfersPage /></PharmacistRoute>} />
                <Route path="/pharmacy/analytics" element={<PharmacistRoute><PharmacyAnalyticsPage /></PharmacistRoute>} />
                
                {/* Pharmacy - Transactions */}
                <Route path="/pharmacy/retail" element={<PharmacistRoute><RetailSalesPage /></PharmacistRoute>} />
                <Route path="/pharmacy/wholesale" element={<PharmacistRoute><WholesalePage /></PharmacistRoute>} />
                <Route path="/pharmacy/inpatient" element={<PharmacistRoute><InpatientMedsPage /></PharmacistRoute>} />
                
                {/* Pharmacy - Expiry Management */}
                <Route path="/pharmacy/expiry/soon" element={<PharmacistRoute><ExpiringSoonPage /></PharmacistRoute>} />
                <Route path="/pharmacy/expiry/expired" element={<PharmacistRoute><ExpiredItemsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/expiry/alerts" element={<PharmacistRoute><ExpiryAlertsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/expiry/disposal" element={<PharmacistRoute><DisposalLogPage /></PharmacistRoute>} />
                <Route path="/pharmacy/expiry/return" element={<PharmacistRoute><ReturnToSupplierPage /></PharmacistRoute>} />
                <Route path="/pharmacy/expiry/management" element={<PharmacistRoute><ExpiryManagementPage /></PharmacistRoute>} />
                <Route path="/pharmacy/controlled-register" element={<PharmacistRoute><ControlledSubstancesRegisterPage /></PharmacistRoute>} />
                
                {/* Pharmacy - Procurement */}
                <Route path="/pharmacy/requisitions" element={<PharmacistRoute><PharmacyRequisitionsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/rfq" element={<PharmacistRoute><PharmacyRFQPage /></PharmacistRoute>} />
                <Route path="/pharmacy/quotes/compare" element={<PharmacistRoute><PharmacyCompareQuotesPage /></PharmacistRoute>} />
                <Route path="/pharmacy/po" element={<PharmacistRoute><PharmacyPOPage /></PharmacistRoute>} />
                <Route path="/pharmacy/grn" element={<PharmacistRoute><PharmacyGRNPage /></PharmacistRoute>} />
                <Route path="/pharmacy/invoices/match" element={<PharmacistRoute><PharmacyInvoiceMatchPage /></PharmacistRoute>} />
                <Route path="/pharmacy/supplier-payments" element={<PharmacistRoute><PharmacySupplierPaymentsPage /></PharmacistRoute>} />
                
                {/* Pharmacy - Suppliers */}
                <Route path="/pharmacy/suppliers" element={<PharmacistRoute><PharmacySupplierListPage /></PharmacistRoute>} />
                <Route path="/pharmacy/suppliers/contracts" element={<PharmacistRoute><PharmacyContractsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/suppliers/ratings" element={<PharmacistRoute><PharmacySupplierRatingsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/suppliers/prices" element={<PharmacistRoute><PharmacyPriceListsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/supplier-rankings" element={<PharmacistRoute><SupplierRankingsPage /></PharmacistRoute>} />
                
                {/* Pharmacy - Medication Adherence */}
                <Route path="/pharmacy/adherence" element={<PharmacistRoute><MedicationAdherencePage /></PharmacistRoute>} />
                
                {/* Pharmacy - Drug Labels & Temperature Monitoring */}
                <Route path="/pharmacy/labels" element={<PharmacistRoute><LabelManagementPage /></PharmacistRoute>} />
                <Route path="/pharmacy/temperature" element={<PharmacistRoute><TemperatureMonitoringPage /></PharmacistRoute>} />
                
                {/* Pharmacy - DUR Reports & Drug DB Sync */}
                <Route path="/pharmacy/dur-reports" element={<PharmacistRoute><DURReportsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/drug-db-sync" element={<PharmacistRoute><DrugDatabaseSyncPage /></PharmacistRoute>} />
                <Route path="/pharmacy/rx-templates" element={<PharmacistRoute><PrescriptionTemplatesPage /></PharmacistRoute>} />
                <Route path="/pharmacy/notifications" element={<PharmacistRoute><NotificationLogPage /></PharmacistRoute>} />
                
                {/* IPD Module */}
                <Route path="/ipd/admissions" element={<ClinicalRoute><AdmissionsPage /></ClinicalRoute>} />
                <Route path="/ipd/wards" element={<ClinicalRoute><WardsBedsPage /></ClinicalRoute>} />
                <Route path="/ipd/bht" element={<ClinicalRoute><BHTIssuePage /></ClinicalRoute>} />
                <Route path="/ipd/billing" element={<BillingRoute><InpatientBillingPage /></BillingRoute>} />
                <Route path="/ipd/nursing" element={<NurseRoute><IPDNursingNotesPage /></NurseRoute>} />
                <Route path="/ipd/theatre" element={<DoctorRoute><IPDTheatrePage /></DoctorRoute>} />
                <Route path="/ipd/maternity" element={<ClinicalRoute><IPDMaternityPage /></ClinicalRoute>} />
                <Route path="/ipd/discharge" element={<DoctorRoute><IPDDischargePage /></DoctorRoute>} />
                <Route path="/ipd/analytics" element={<ClinicalRoute><IPDAnalyticsPage /></ClinicalRoute>} />
                
                {/* Stores Module */}
                <Route path="/stores/main" element={<StoreKeeperRoute><MainInventoryPage /></StoreKeeperRoute>} />
                <Route path="/stores/issue" element={<StoreKeeperRoute><UnitIssuePage /></StoreKeeperRoute>} />
                <Route path="/stores/transfers" element={<StoreKeeperRoute><StoreTransfersPage /></StoreKeeperRoute>} />
                <Route path="/stores/procurement" element={<StoreKeeperRoute><StoresProcurementPage /></StoreKeeperRoute>} />
                <Route path="/stores/suppliers" element={<StoreKeeperRoute><StoresSupplierPage /></StoreKeeperRoute>} />
                <Route path="/stores/expiry" element={<StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute>} />
                <Route path="/stores/adjustments" element={<StoreKeeperRoute><StockAdjustmentsPage /></StoreKeeperRoute>} />
                <Route path="/stores/stock-take" element={<StoreKeeperRoute><StockTakePage /></StoreKeeperRoute>} />
                <Route path="/stores/assets" element={<StoreKeeperRoute><StoresAssetRegisterPage /></StoreKeeperRoute>} />
                <Route path="/stores/maintenance" element={<StoreKeeperRoute><MaintenanceSchedulePage /></StoreKeeperRoute>} />
                <Route path="/stores/consumption" element={<StoreKeeperRoute><ConsumptionReportsPage /></StoreKeeperRoute>} />
                <Route path="/stores/analytics" element={<StoreKeeperRoute><StoresAnalyticsPage /></StoreKeeperRoute>} />
                <Route path="/stores/requisitions" element={<StoreKeeperRoute><StoresRequisitionsPage /></StoreKeeperRoute>} />
                <Route path="/stores/rfq" element={<StoreKeeperRoute><StoresRFQPage /></StoreKeeperRoute>} />
                <Route path="/stores/quotes/compare" element={<StoreKeeperRoute><StoresCompareQuotesPage /></StoreKeeperRoute>} />
                <Route path="/stores/po" element={<StoreKeeperRoute><StoresPOPage /></StoreKeeperRoute>} />
                <Route path="/stores/grn" element={<StoreKeeperRoute><StoresGRNPage /></StoreKeeperRoute>} />
                <Route path="/stores/invoices/match" element={<StoreKeeperRoute><StoresInvoiceMatchPage /></StoreKeeperRoute>} />
                <Route path="/stores/suppliers/contracts" element={<StoreKeeperRoute><StoresSupplierContractsPage /></StoreKeeperRoute>} />
                <Route path="/stores/payments" element={<StoreKeeperRoute><StoresPaymentsPage /></StoreKeeperRoute>} />
                <Route path="/stores/disposal" element={<StoreKeeperRoute><StoresDisposalPage /></StoreKeeperRoute>} />
                <Route path="/stores/expiry/soon" element={<StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute>} />
                <Route path="/stores/expiry/expired" element={<StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute>} />
                <Route path="/settings/classifications" element={<AdminRoute><ItemClassificationsPage /></AdminRoute>} />
                
                {/* OPD */}
                <Route path="/encounters/:id" element={<ClinicalRoute><EncounterDetailPage /></ClinicalRoute>} />
                {/* Clinical */}
                <Route path="/pharmacy" element={<PharmacistRoute><PharmacyPage /></PharmacistRoute>} />
                <Route path="/cashier" element={<CashierRoute><CashierPage /></CashierRoute>} />
                <Route path="/inventory" element={<StoreKeeperRoute><InventoryPage /></StoreKeeperRoute>} />
                <Route path="/lab" element={<LabTechRoute><LabPage /></LabTechRoute>} />
                <Route path="/radiology" element={<RadiologyRoute><RadiologyPage /></RadiologyRoute>} />
                <Route path="/wards" element={<ClinicalRoute><WardManagementPage /></ClinicalRoute>} />
                <Route path="/emergency" element={<ClinicalRoute><EmergencyPage /></ClinicalRoute>} />
                <Route path="/theatre" element={<DoctorRoute><IPDTheatrePage /></DoctorRoute>} />
                <Route path="/maternity" element={<ClinicalRoute><IPDMaternityPage /></ClinicalRoute>} />
                {/* Admin & Finance */}
                <Route path="/hr" element={<HRRoute><HRPage /></HRRoute>} />
                <Route path="/hr/staff" element={<HRRoute><StaffDirectoryPage /></HRRoute>} />
                <Route path="/hr/departments" element={<HRRoute><AdminDepartmentsPage /></HRRoute>} />
                <Route path="/hr/designations" element={<HRRoute><DesignationsPage /></HRRoute>} />
                <Route path="/hr/shifts" element={<HRRoute><ShiftManagementPage /></HRRoute>} />
                <Route path="/hr/leave" element={<HRRoute><LeaveManagementPage /></HRRoute>} />
                <Route path="/hr/credentials" element={<HRRoute><CredentialsPage /></HRRoute>} />
                <Route path="/hr/attendance" element={<HRRoute><AttendancePage /></HRRoute>} />
                <Route path="/hr/payroll" element={<HRRoute><PayrollPage /></HRRoute>} />
                <Route path="/hr/recruitment" element={<HRRoute><RecruitmentPage /></HRRoute>} />
                <Route path="/hr/appraisals" element={<HRRoute><AppraisalsPage /></HRRoute>} />
                <Route path="/hr/appraisals/:id" element={<HRRoute><AppraisalDetailPage /></HRRoute>} />
                <Route path="/hr/training" element={<HRRoute><TrainingPage /></HRRoute>} />
                <Route path="/hr/analytics" element={<HRRoute><HRAnalyticsPage /></HRRoute>} />
                <Route path="/hr/my-payslips" element={<ProtectedRoute><MyPayslipsPage /></ProtectedRoute>} />
                <Route path="/hr/my-leave" element={<ProtectedRoute><MyLeavePage /></ProtectedRoute>} />
                <Route path="/hr/my-attendance" element={<ProtectedRoute><MyAttendancePage /></ProtectedRoute>} />
                <Route path="/hr/my-appraisals" element={<ProtectedRoute><MyAppraisalsPage /></ProtectedRoute>} />
                <Route path="/finance" element={<FinanceRoute><FinancePage /></FinanceRoute>} />
                <Route path="/insurance" element={<BillingRoute><InsurancePage /></BillingRoute>} />
                <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
                <Route path="/membership" element={<AdminRoute><MembershipPage /></AdminRoute>} />
                <Route path="/services" element={<AdminRoute><ServicesPage /></AdminRoute>} />
                <Route path="/stores" element={<StoreKeeperRoute><MainInventoryPage /></StoreKeeperRoute>} />
                <Route path="/orders" element={<DoctorRoute><OrdersPage /></DoctorRoute>} />
                <Route path="/tenants" element={<AdminRoute><TenantsPage /></AdminRoute>} />
                <Route path="/vitals" element={<ClinicalRoute><VitalsPage /></ClinicalRoute>} />
                <Route path="/clinical-notes" element={<DoctorRoute><ClinicalNotesPage /></DoctorRoute>} />
                <Route path="/referrals" element={<DoctorRoute><ReferralsPage /></DoctorRoute>} />
                <Route path="/treatment-plans" element={<DoctorRoute><TreatmentPlansPage /></DoctorRoute>} />
                <Route path="/discharge" element={<DoctorRoute><IPDDischargePage /></DoctorRoute>} />
                <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                <Route path="/facilities" element={<AdminRoute><FacilitiesPage /></AdminRoute>} />
                <Route path="/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                
                {/* Admin - User Management */}
                <Route path="/admin/users" element={<AdminRoute><UserListPage /></AdminRoute>} />
                <Route path="/admin/roles" element={<AdminRoute><RolePermissionsPage /></AdminRoute>} />
                <Route path="/admin/users/activity" element={<AdminRoute><UserActivityLogPage /></AdminRoute>} />
                <Route path="/admin/users/departments" element={<AdminRoute><DepartmentAccessPage /></AdminRoute>} />
                <Route path="/admin/users/sessions" element={<AdminRoute><SessionManagementPage /></AdminRoute>} />
                
                {/* Admin - Services Management */}
                <Route path="/admin/services" element={<AdminRoute><ServiceCatalogPage /></AdminRoute>} />
                <Route path="/admin/services/pricing" element={<AdminRoute><PricingManagementPage /></AdminRoute>} />
                <Route path="/admin/services/packages" element={<AdminRoute><ServicePackagesPage /></AdminRoute>} />
                <Route path="/admin/services/discounts" element={<AdminRoute><DiscountSchemesPage /></AdminRoute>} />
                <Route path="/admin/services/tax" element={<AdminRoute><TaxConfigurationPage /></AdminRoute>} />
                
                {/* Admin - Insurance Pricing */}
                <Route path="/admin/pricing/insurance" element={<AdminRoute><InsurancePriceListsPage /></AdminRoute>} />
                
                {/* Admin - HR Management (aliases for /hr routes above) */}
                <Route path="/admin/hr/staff" element={<Navigate to="/hr/staff" replace />} />
                <Route path="/admin/hr/departments" element={<Navigate to="/hr/departments" replace />} />
                <Route path="/admin/hr/designations" element={<Navigate to="/hr/designations" replace />} />
                <Route path="/admin/hr/shifts" element={<Navigate to="/hr/shifts" replace />} />
                <Route path="/admin/hr/leave" element={<Navigate to="/hr/leave" replace />} />
                <Route path="/admin/hr/credentials" element={<Navigate to="/hr/credentials" replace />} />
                <Route path="/admin/hr/attendance" element={<Navigate to="/hr/attendance" replace />} />
                <Route path="/admin/hr/payroll" element={<Navigate to="/hr/payroll" replace />} />
                <Route path="/admin/hr/recruitment" element={<Navigate to="/hr/recruitment" replace />} />
                <Route path="/admin/hr/appraisals" element={<Navigate to="/hr/appraisals" replace />} />
                <Route path="/admin/hr/training" element={<Navigate to="/hr/training" replace />} />
                <Route path="/admin/hr/analytics" element={<Navigate to="/hr/analytics" replace />} />
                
                {/* Admin - Lab Services */}
                <Route path="/admin/lab/tests" element={<AdminRoute><TestCatalogPage /></AdminRoute>} />
                <Route path="/admin/lab/equipment" element={<AdminRoute><LabEquipmentPage /></AdminRoute>} />
                <Route path="/admin/lab/reagents" element={<AdminRoute><ReagentsInventoryPage /></AdminRoute>} />
                <Route path="/admin/lab/panels" element={<AdminRoute><LabPanelsPage /></AdminRoute>} />
                
                {/* Admin - Procurement Settings */}
                <Route path="/admin/procurement/approvals" element={<AdminRoute><ApprovalWorkflowPage /></AdminRoute>} />
                <Route path="/admin/procurement/budgets" element={<AdminRoute><BudgetManagementPage /></AdminRoute>} />
                <Route path="/admin/procurement/policies" element={<AdminRoute><ProcurementPoliciesPage /></AdminRoute>} />
                <Route path="/admin/procurement/categories" element={<AdminRoute><ItemCategoriesPage /></AdminRoute>} />
                
                {/* Admin - Inventory/Pharmacy Settings */}
                <Route path="/admin/stores/locations" element={<AdminRoute><StoreLocationsPage /></AdminRoute>} />
                <Route path="/admin/stores/items" element={<AdminRoute><ItemMasterPage /></AdminRoute>} />
                <Route path="/admin/pharmacy/formulary" element={<AdminRoute><DrugFormularyPage /></AdminRoute>} />
                <Route path="/admin/pharmacy/categories" element={<AdminRoute><DrugCategoriesPage /></AdminRoute>} />
                <Route path="/admin/inventory/units" element={<AdminRoute><UnitOfMeasurePage /></AdminRoute>} />
                <Route path="/admin/inventory/expiry" element={<AdminRoute><ExpiryPoliciesPage /></AdminRoute>} />
                <Route path="/admin/inventory/items" element={<AdminRoute><ItemMasterPage /></AdminRoute>} />
                <Route path="/admin/inventory/locations" element={<AdminRoute><StoreLocationsPage /></AdminRoute>} />
                
                {/* Admin - Site/Institution */}
                <Route path="/admin/site/profile" element={<AdminRoute><InstitutionProfilePage /></AdminRoute>} />
                <Route path="/admin/site/branches" element={<AdminRoute><BranchesPage /></AdminRoute>} />
                <Route path="/admin/site/buildings" element={<AdminRoute><BuildingsFloorsPage /></AdminRoute>} />
                <Route path="/admin/site/settings" element={<AdminRoute><SystemSettingsPage /></AdminRoute>} />
                <Route path="/admin/site/integrations" element={<AdminRoute><IntegrationsPage /></AdminRoute>} />
                
                {/* Admin - Membership */}
                <Route path="/admin/membership/plans" element={<AdminRoute><MembershipPlansPage /></AdminRoute>} />
                <Route path="/admin/membership/benefits" element={<AdminRoute><MembershipBenefitsPage /></AdminRoute>} />
                <Route path="/admin/membership/corporate" element={<AdminRoute><CorporatePlansPage /></AdminRoute>} />
                <Route path="/admin/membership/rules" element={<AdminRoute><MembershipRulesPage /></AdminRoute>} />
                
                {/* Admin - Finance Settings */}
                <Route path="/admin/finance/currencies" element={<FinanceRoute><CurrenciesPage /></FinanceRoute>} />
                <Route path="/admin/finance/exchange-rates" element={<FinanceRoute><ExchangeRatesPage /></FinanceRoute>} />
                <Route path="/admin/finance/payment-methods" element={<FinanceRoute><PaymentMethodsPage /></FinanceRoute>} />
                
                {/* Sync Module */}
                <Route path="/sync/status" element={<AdminRoute><SyncStatusPage /></AdminRoute>} />
                <Route path="/sync/queue" element={<AdminRoute><OfflineQueuePage /></AdminRoute>} />
                <Route path="/sync/conflicts" element={<AdminRoute><ConflictResolutionPage /></AdminRoute>} />
                
                {/* Providers Module */}
                <Route path="/providers/directory" element={<AdminRoute><ProviderDirectoryPage /></AdminRoute>} />
                <Route path="/providers/credentials" element={<AdminRoute><ProviderCredentialsPage /></AdminRoute>} />
                
                {/* Drug Management */}
                <Route path="/drug-management/classifications" element={<PharmacistRoute><DrugClassificationsPage /></PharmacistRoute>} />
                <Route path="/drug-management/interactions" element={<PharmacistRoute><DrugInteractionsDatabasePage /></PharmacistRoute>} />
                <Route path="/drug-management/allergy-classes" element={<PharmacistRoute><AllergyClassesPage /></PharmacistRoute>} />
                
                {/* Supplier Finance */}
                <Route path="/supplier-finance/payment-vouchers" element={<FinanceRoute><SupplierPaymentVouchersPage /></FinanceRoute>} />
                <Route path="/supplier-finance/credit-notes" element={<FinanceRoute><SupplierCreditNotesPage /></FinanceRoute>} />
                <Route path="/supplier-finance/ledger" element={<FinanceRoute><SupplierLedgerPage /></FinanceRoute>} />
                
                {/* MDM (Master Data Management) */}
                <Route path="/mdm/versions" element={<AdminRoute><MasterDataVersionsPage /></AdminRoute>} />
                <Route path="/mdm/approvals" element={<AdminRoute><MasterDataApprovalsPage /></AdminRoute>} />
                <Route path="/mdm/rules" element={<AdminRoute><ApprovalRulesPage /></AdminRoute>} />
                
                {/* Lab QC */}
                <Route path="/lab-qc/dashboard" element={<LabTechRoute><LabQCDashboardPage /></LabTechRoute>} />
                <Route path="/lab-qc/consumables" element={<LabTechRoute><LabConsumablesPage /></LabTechRoute>} />
                
                {/* Assets Module */}
                <Route path="/assets" element={<StoreKeeperRoute><AssetRegisterPage /></StoreKeeperRoute>} />
                <Route path="/assets/register" element={<StoreKeeperRoute><AssetRegisterPage /></StoreKeeperRoute>} />
                <Route path="/assets/allocation" element={<StoreKeeperRoute><AssetAllocationPage /></StoreKeeperRoute>} />
                <Route path="/assets/tracking" element={<StoreKeeperRoute><AssetTrackingPage /></StoreKeeperRoute>} />
                <Route path="/assets/maintenance" element={<StoreKeeperRoute><AssetMaintenancePage /></StoreKeeperRoute>} />
                <Route path="/assets/depreciation" element={<FinanceRoute><AssetDepreciationPage /></FinanceRoute>} />
                <Route path="/assets/reports" element={<FinanceRoute><AssetReportsPage /></FinanceRoute>} />
                <Route path="/assets/transfers" element={<StoreKeeperRoute><AssetTransfersPage /></StoreKeeperRoute>} />
                <Route path="/assets/disposal" element={<StoreKeeperRoute><AssetDisposalPage /></StoreKeeperRoute>} />
                <Route path="/assets/categories" element={<AdminRoute><AssetCategoriesPage /></AdminRoute>} />
                
                {/* Chronic Care Module */}
                <Route path="/chronic-care/dashboard" element={<ClinicalRoute><ChronicCareDashboardPage /></ClinicalRoute>} />
                <Route path="/chronic-care/registry" element={<ClinicalRoute><ChronicRegistryPage /></ClinicalRoute>} />
                <Route path="/chronic-care/reminders" element={<ClinicalRoute><ChronicRemindersPage /></ClinicalRoute>} />
                <Route path="/chronic-care/notifications" element={<AdminRoute><NotificationSettingsPage /></AdminRoute>} />

                {/* Integrations Module */}
                <Route path="/integrations/drugs" element={<PharmacistRoute><DrugDatabasePage /></PharmacistRoute>} />
                <Route path="/integrations/lab-reference" element={<LabTechRoute><LabReferencePage /></LabTechRoute>} />
                <Route path="/integrations/sms" element={<AdminRoute><SMSNotificationsPage /></AdminRoute>} />

                {/* Notifications Module */}
                <Route path="/notifications/settings" element={<AdminRoute><NotificationSettingsPage /></AdminRoute>} />
                <Route path="/notifications/templates" element={<AdminRoute><SmsTemplatesPage /></AdminRoute>} />
                <Route path="/notifications/history" element={<AdminRoute><NotificationHistoryPage /></AdminRoute>} />
                <Route path="/notifications/bulk" element={<AdminRoute><BulkSmsPage /></AdminRoute>} />

                {/* Reports Module — restricted by role */}
                <Route path="/reports" element={<AdminRoute><ReportsDashboardPage /></AdminRoute>} />
                <Route path="/reports/patients" element={<ClinicalRoute><PatientStatisticsReportPage /></ClinicalRoute>} />
                <Route path="/reports/visits" element={<ClinicalRoute><VisitReportsPage /></ClinicalRoute>} />
                <Route path="/reports/diseases" element={<ClinicalRoute><DiseaseStatisticsPage /></ClinicalRoute>} />
                <Route path="/reports/mortality" element={<ClinicalRoute><MortalityReportsPage /></ClinicalRoute>} />
                <Route path="/reports/revenue" element={<FinanceRoute><RevenueReportsPage /></FinanceRoute>} />
                <Route path="/reports/collections" element={<FinanceRoute><CollectionReportsPage /></FinanceRoute>} />
                <Route path="/reports/outstanding" element={<FinanceRoute><OutstandingReportsPage /></FinanceRoute>} />
                <Route path="/reports/stock" element={<StoreKeeperRoute><StockReportsPage /></StoreKeeperRoute>} />
                <Route path="/reports/expiry" element={<StoreKeeperRoute><ExpiryReportsPage /></StoreKeeperRoute>} />
                <Route path="/reports/consumption" element={<StoreKeeperRoute><InventoryConsumptionReportsPage /></StoreKeeperRoute>} />
                
                {/* 404 Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
  );
}

// Session timeout wrapper component
function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    warningBeforeMs: 5 * 60 * 1000, // 5 minutes warning
    onWarning: () => {
      // Could show a modal warning here
      console.warn('[SESSION] Your session will expire in 5 minutes due to inactivity');
    },
  });
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary level="global">
      <QueryClientProvider client={queryClient}>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <SessionTimeoutWrapper>
            <AppRoutes />
          </SessionTimeoutWrapper>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
