import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import { useAuthStore } from './store/auth';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { api, getApiErrorMessage, SESSION_EXPIRED_EVENT } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleRoute from './components/ModuleRoute';
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
  SystemAdminRoute,
  FinanceRoute,
  HRRoute,
  BillingRoute,
  InsuranceRoute,
  RadiologyRoute,
  ROLES,
} from './components/RoleRoute';
import DashboardLayout from './components/DashboardLayout';
import { PageLoader } from './components/PageLoader';

// Lazy-loaded page components (route-based code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PortalLoginPage = lazy(() => import('./pages/portal/PortalLoginPage'));
const PortalDashboardPage = lazy(() => import('./pages/portal/PortalDashboardPage'));
const SystemLoginPage = lazy(() => import('./pages/system/SystemLoginPage'));
const SystemAdminLayout = lazy(() => import('./pages/system/SystemAdminLayout'));
const SystemDashboardPage = lazy(() => import('./pages/system/SystemDashboardPage'));
const SystemUsersPage = lazy(() => import('./pages/system/SystemUsersPage'));
const PlatformSettingsPage = lazy(() => import('./pages/system/SystemSettingsPage'));
const SystemSupportRequestsPage = lazy(() => import('./pages/system/SystemSupportRequestsPage'));
const SystemComplianceCenterPage = lazy(() => import('./pages/system/SystemComplianceCenterPage'));
const SystemDeploymentsPage = lazy(() => import('./pages/system/SystemDeploymentsPage'));
const SystemLeadsPage = lazy(() => import('./pages/system/SystemLeadsPage'));
const SystemDownloadsPage = lazy(() => import('./pages/system/SystemDownloadsPage'));
const SystemLicensesPage = lazy(() => import('./pages/system/SystemLicensesPage'));
const SystemSecurityPage = lazy(() => import('./pages/system/SystemSecurityPage'));
const SystemDocsPage = lazy(() => import('./pages/system/SystemDocsPage'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));
const SupportAccessPage = lazy(() => import('./pages/admin/SupportAccessPage'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizardPage'));
const TenantSetupWizardPage = lazy(() => import('./pages/TenantSetupWizardPage'));
const RegisterOrganizationPage = lazy(() => import('./pages/RegisterOrganizationPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const FirstRunOnboardingPage = lazy(() => import('./pages/Onboarding/FirstRunOnboardingPage'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const PublicLandingPage = lazy(() => import('./pages/Public/PublicLandingPage'));
const TenantManagementPage = lazy(() => import('./pages/admin/TenantManagementPage'));
const BackupManagementPage = lazy(() => import('./pages/admin/BackupManagementPage'));
const TrashRecoveryPage = lazy(() => import('./pages/admin/TrashRecoveryPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const PasswordPoliciesPage = lazy(() => import('./pages/admin/PasswordPoliciesPage'));
const JobMonitorPage = lazy(() => import('./pages/admin/JobMonitorPage'));
const WebhooksPage = lazy(() => import('./pages/admin/WebhooksPage'));
const EmailTemplatesPage = lazy(() => import('./pages/admin/EmailTemplatesPage'));
const SsoConfigPage = lazy(() => import('./pages/admin/SsoConfigPage'));
const EfrisConfigPage = lazy(() => import('./pages/admin/EfrisConfigPage'));
const EmployeeGoalsPage = lazy(() => import('./pages/admin/hr/EmployeeGoalsPage'));
const PIPManagementPage = lazy(() => import('./pages/admin/hr/PIPManagementPage'));
const LetterTemplatesPage = lazy(() => import('./pages/admin/hr/LetterTemplatesPage'));
const OrgChartPage = lazy(() => import('./pages/admin/hr/OrgChartPage'));
const LeaveDashboardPage = lazy(() => import('./pages/admin/hr/LeaveDashboardPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
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
const PatientJourneyPage = lazy(() => import('./pages/PatientJourneyPage'));
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
const PatientTabPage = lazy(() => import('./pages/billing/PatientTabPage'));
const DoctorFeesPage = lazy(() => import('./pages/billing/DoctorFeesPage'));
const ClaimsPage = lazy(() => import('./pages/billing/insurance/ClaimsPage'));
const InsuranceProvidersPage = lazy(() => import('./pages/billing/insurance/ProvidersPage'));
const InsuranceDashboardPage = lazy(() => import('./pages/insurance/InsuranceDashboardPage'));
const RequisitionsPage = lazy(() => import('./pages/billing/procurement/RequisitionsPage'));
const ApprovalDashboardPage = lazy(() => import('./pages/billing/procurement/ApprovalDashboardPage'));
const DirectPOPage = lazy(() => import('./pages/billing/procurement/DirectPOPage'));
const RFQPage = lazy(() => import('./pages/billing/procurement/RFQPage'));
const CompareQuotesPage = lazy(() => import('./pages/billing/procurement/CompareQuotesPage'));
const ApproveQuotationsPage = lazy(() => import('./pages/billing/procurement/ApproveQuotationsPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/billing/procurement/PurchaseOrdersPage'));
const GoodsReceivedPage = lazy(() => import('./pages/billing/procurement/GoodsReceivedPage'));
const InvoiceMatchingPage = lazy(() => import('./pages/billing/procurement/InvoiceMatchingPage'));
const ProcurementTracePage = lazy(() => import('./pages/billing/procurement/ProcurementTracePage'));
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
const TrialBalancePage = lazy(() => import('./pages/billing/finance/TrialBalancePage'));
const EmergencyQueuePage = lazy(() => import('./pages/emergency/EmergencyQueuePage'));
const AmbulanceTrackingPage = lazy(() => import('./pages/emergency/AmbulanceTrackingPage'));
const EmergencyTriagePage = lazy(() => import('./pages/emergency/EmergencyTriagePage'));
const EmergencyBillingPage = lazy(() => import('./pages/emergency/EmergencyBillingPage'));
const LabQueuePage = lazy(() => import('./pages/lab/LabQueuePage'));
const SampleCollectionPage = lazy(() => import('./pages/lab/SampleCollectionPage'));
const ResultsEntryPage = lazy(() => import('./pages/lab/ResultsEntryPage'));
const LabReportsPage = lazy(() => import('./pages/lab/LabReportsPage'));
const LabAnalyticsPage = lazy(() => import('./pages/lab/LabAnalyticsPage'));
const SampleReferralPage = lazy(() => import('./pages/lab/SampleReferralPage'));
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
const POSDashboardPage = lazy(() => import('./pages/pos/POSDashboardPage'));
const POSSalePage = lazy(() => import('./pages/pos/POSSalePage'));
const POSShiftPage = lazy(() => import('./pages/pos/POSShiftPage'));
const POSReportsPage = lazy(() => import('./pages/pos/POSReportsPage'));
const WholesaleCustomersPage = lazy(() => import('./pages/pos/WholesaleCustomersPage'));
const PricingTiersPage = lazy(() => import('./pages/pos/PricingTiersPage'));
const DeliveryTrackingPage = lazy(() => import('./pages/pos/DeliveryTrackingPage'));
const POSReturnsPage = lazy(() => import('./pages/pos/POSReturnsPage'));
const POSReceiptHistoryPage = lazy(() => import('./pages/pos/POSReceiptHistoryPage'));
const POSOfflineSyncPage = lazy(() => import('./pages/pos/POSOfflineSyncPage'));
const AdmissionsPage = lazy(() => import('./pages/ipd/AdmissionsPage'));
const WardsBedsPage = lazy(() => import('./pages/ipd/WardsBedsPage'));
const BedBoardPage = lazy(() => import('./pages/ipd/BedBoardPage'));
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
const StockTransferPage = lazy(() => import('./pages/inventory/StockTransferPage'));
const ReorderSuggestionsPage = lazy(() => import('./pages/inventory/ReorderSuggestionsPage'));
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
const AdminAnalyticsDashboardPage = lazy(() => import('./pages/admin/AdminAnalyticsDashboardPage'));
const UserListPage = lazy(() => import('./pages/admin/users/UserListPage'));
const RolePermissionsPage = lazy(() => import('./pages/admin/users/RolePermissionsPage'));
const UserActivityLogPage = lazy(() => import('./pages/admin/users/UserActivityLogPage'));
const DepartmentAccessPage = lazy(() => import('./pages/admin/users/DepartmentAccessPage'));
const SessionManagementPage = lazy(() => import('./pages/admin/users/SessionManagementPage'));
const BulkUserImportPage = lazy(() => import('./pages/admin/users/BulkUserImportPage'));
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
const HRLettersPage = lazy(() => import('./pages/admin/hr/HRLettersPage'));
const DisciplinaryPage = lazy(() => import('./pages/admin/hr/DisciplinaryPage'));
const OnboardingPage = lazy(() => import('./pages/admin/hr/OnboardingPage'));
const PayrollReportsPage = lazy(() => import('./pages/admin/hr/PayrollReportsPage'));
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
const FacilityModePage = lazy(() => import('./pages/admin/site/FacilityModePage'));
const LicenseSubscriptionPage = lazy(() => import('./pages/admin/site/LicenseSubscriptionPage'));
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
const HMIS105ReportPage = lazy(() => import('./pages/reports/HMIS105ReportPage'));
const DrugDatabasePage = lazy(() => import('./pages/integrations/DrugDatabasePage'));
const LabReferencePage = lazy(() => import('./pages/integrations/LabReferencePage'));
const SMSNotificationsPage = lazy(() => import('./pages/integrations/SMSNotificationsPage'));
const DHIS2SettingsPage = lazy(() => import('./pages/integrations/DHIS2SettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry 401/403 auth errors — let the interceptor handle them
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          return false;
        }
        return failureCount < 1;
      },
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

/**
 * Guard for /login/:slug route.
 * If authenticated and the slug matches the current tenant, redirect to dashboard.
 * If authenticated but slug is for a DIFFERENT tenant, log out first so they can log into the correct org.
 * If not authenticated, show the login page.
 */
function LoginRouteGuard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { slug } = useParams<{ slug: string }>();
  const { logout } = useAuthStore();
  const [pendingSetup, setPendingSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (!slug) { setPendingSetup(false); return; }
    let cancelled = false;
    api.get(`/tenants/public/by-slug/${slug}`)
      .then(res => { if (!cancelled) setPendingSetup((res.data as any)?.isSetupComplete === false); })
      .catch(() => { if (!cancelled) setPendingSetup(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (slug && pendingSetup === null) {
    return <PageLoader />;
  }

  // Tenant needs setup — go straight to wizard, regardless of auth state
  if (slug && pendingSetup) {
    return <Navigate to={`/setup/${slug}`} replace />;
  }

  if (!isAuthenticated) {
    return <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>;
  }

  const currentSlug = localStorage.getItem('glide_tenant_slug');

  if (!slug || slug === currentSlug) {
    return <Navigate to="/" replace />;
  }

  logout();
  return <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>;
}

function AppRoutes() {
  const { isAuthenticated, logout, accessToken, refreshToken, setTokens } = useAuthStore();
  const [setupChecked, setSetupChecked] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(true);

  // Cancel all in-flight queries immediately when session expires
  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.cancelQueries();
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  // Check setup status and validate token on initial app load
  useEffect(() => {
    const checkSetup = async () => {
      // Skip check if on setup or register page
      if (window.location.pathname.startsWith('/setup') || window.location.pathname === '/register') {
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

  // Redirect to setup if not complete (allow tenant setup wizard and system routes through)
  if (!isSetupComplete && !window.location.pathname.startsWith('/setup') && !window.location.pathname.startsWith('/system') && !window.location.pathname.startsWith('/change-password')) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/setup" element={isSetupComplete ? <Navigate to="/" replace /> : <SetupWizardPage />} />
      <Route path="/setup/:slug" element={<TenantSetupWizardPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterOrganizationPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/dashboard" element={<PortalDashboardPage />} />
      <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
      <Route path="/portal/scan/:mrn" element={<Navigate to="/portal/login" replace />} />
      <Route
        path="/system/login"
        element={isAuthenticated ? <Navigate to="/system" replace /> : <SystemLoginPage />}
      />
      <Route
        path="/change-password"
        element={isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/system"
        element={isAuthenticated ? <SystemAdminRoute><SystemAdminLayout /></SystemAdminRoute> : <Navigate to="/system/login" replace />}
      >
        <Route index element={<SystemDashboardPage />} />
        <Route path="tenants" element={<TenantManagementPage />} />
        <Route path="deployments" element={<SystemDeploymentsPage />} />
        <Route path="users" element={<SystemUsersPage />} />
        <Route path="settings" element={<PlatformSettingsPage />} />
        <Route path="support-requests" element={<SystemSupportRequestsPage />} />
        <Route path="leads" element={<SystemLeadsPage />} />
        <Route path="downloads" element={<SystemDownloadsPage />} />
        <Route path="licenses" element={<SystemLicensesPage />} />
        <Route path="compliance" element={<SystemComplianceCenterPage />} />
        <Route path="security" element={<SystemSecurityPage />} />
        <Route path="docs" element={<SystemDocsPage />} />
      </Route>
      <Route
        path="/admin/tenants"
        element={isAuthenticated ? <Navigate to="/system/tenants" replace /> : <Navigate to="/system/login" replace />}
      />
      <Route
        path="/onboarding"
        element={!isSetupComplete ? <FirstRunOnboardingPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/admin"
        element={<AdminDashboard />}
      />
      <Route
        path="/landing"
        element={<PublicLandingPage />}
      />
      <Route
        path="/login/:slug?"
        element={<LoginRouteGuard isAuthenticated={isAuthenticated} />}
      />
      <Route
        path="/"
        element={
          !isSetupComplete ? (
            <FirstRunOnboardingPage />
          ) : isAuthenticated ? (
            (useAuthStore.getState().user as any)?.isSystemAdmin ? (
              <Navigate to="/system" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <PublicLandingPage />
          )
        }
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
                <Route path="/dashboard" element={<SmartDashboardPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                
                {/* Registration - Patient Management */}
                <Route path="/patients/search" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientSearchPage /></ProtectedRoute>} />
                <Route path="/patients/new" element={<ProtectedRoute requiredPermissions={['patients.create']}><PatientRegistrationPage /></ProtectedRoute>} />
                <Route path="/patients/hospital-scheme-enroll" element={<ReceptionistRoute><HospitalSchemeEnrollmentPage /></ReceptionistRoute>} />
                <Route path="/patients/documents" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDocumentsPage /></ProtectedRoute>} />
                <Route path="/patients/history" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientHistoryPage /></ProtectedRoute>} />
                <Route path="/patients/:id/edit" element={<ProtectedRoute requiredPermissions={['patients.update']}><PatientEditPage /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDetailPage /></ProtectedRoute>} />
                <Route path="/patients" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER, ROLES.LAB_TECHNICIAN, ROLES.PHARMACIST, ROLES.RADIOLOGIST, ROLES.ADMIN]}><PatientsPage /></RoleRoute>} />
                
                {/* Registration - Queue & Tokens */}
                <Route path="/opd/token" element={<ReceptionistRoute><OPDTokenPage /></ReceptionistRoute>} />
                <Route path="/doctors/on-duty" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR]}><DoctorsOnDutyPage /></RoleRoute>} />
                <Route path="/queue/monitor" element={<ReceptionistRoute><QueueMonitorPage /></ReceptionistRoute>} />
                <Route path="/queue/call" element={<ReceptionistRoute><CallNextPatientPage /></ReceptionistRoute>} />
                <Route path="/queue/analytics" element={<ReceptionistRoute><QueueAnalyticsPage /></ReceptionistRoute>} />
                <Route path="/queue/journey" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN]}><PatientJourneyPage /></RoleRoute>} />
                <Route path="/queue" element={<ReceptionistRoute><QueueManagementPage /></ReceptionistRoute>} />
                <Route path="/triage" element={<NurseRoute><QueueManagementPage /></NurseRoute>} />
                
                {/* Registration - Channelling/Appointments */}
                <Route path="/appointments/new" element={<ReceptionistRoute><BookAppointmentPage /></ReceptionistRoute>} />
                <Route path="/appointments" element={<ReceptionistRoute><ViewAppointmentsPage /></ReceptionistRoute>} />
                <Route path="/schedules/doctors" element={<ReceptionistRoute><DoctorSchedulesPage /></ReceptionistRoute>} />
                <Route path="/appointments/manage" element={<ReceptionistRoute><ManageAppointmentsPage /></ReceptionistRoute>} />
                
                {/* Registration - Reception Billing */}
                <Route path="/billing/reception/new" element={<ModuleRoute module="billing"><CashierRoute><NewBillPage /></CashierRoute></ModuleRoute>} />
                <Route path="/billing/reception/payment" element={<ModuleRoute module="billing"><CashierRoute><CollectPaymentPage /></CashierRoute></ModuleRoute>} />
                <Route path="/billing/reception/receipt" element={<ModuleRoute module="billing"><CashierRoute><PrintReceiptPage /></CashierRoute></ModuleRoute>} />
                <Route path="/billing/reception/pending" element={<ModuleRoute module="billing"><CashierRoute><PendingPaymentsPage /></CashierRoute></ModuleRoute>} />
                <Route path="/billing/reception/refunds" element={<ModuleRoute module="billing"><CashierRoute><RefundsPage /></CashierRoute></ModuleRoute>} />
                
                {/* Registration - Insurance Desk */}
                <Route path="/insurance/verify" element={<ModuleRoute module="billing"><ReceptionistRoute><VerifyCoveragePage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/insurance/preauth" element={<ModuleRoute module="billing"><ReceptionistRoute><PreAuthorizationPage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/insurance/submit" element={<ModuleRoute module="billing"><ReceptionistRoute><ClaimSubmissionPage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/insurance/cards" element={<ModuleRoute module="billing"><ReceptionistRoute><InsuranceCardsPage /></ReceptionistRoute></ModuleRoute>} />
                
                {/* Registration - Reports */}
                <Route path="/reports/registration/daily" element={<ModuleRoute module="reports"><ReceptionistRoute><RegistrationDailySummaryPage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/reports/registration/patients" element={<ModuleRoute module="reports"><ReceptionistRoute><PatientStatisticsPage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/reports/registration/revenue" element={<ModuleRoute module="reports"><ReceptionistRoute><RegistrationRevenuePage /></ReceptionistRoute></ModuleRoute>} />
                <Route path="/reports/registration/queue" element={<ModuleRoute module="reports"><ReceptionistRoute><QueuePerformancePage /></ReceptionistRoute></ModuleRoute>} />
                
                {/* Nursing - Patient Vitals */}
                <Route path="/nursing/vitals/new" element={<ModuleRoute module="nursing"><NurseRoute><RecordVitalsPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/vitals/history" element={<ModuleRoute module="nursing"><NurseRoute><VitalsHistoryPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/vitals/trends" element={<ModuleRoute module="nursing"><NurseRoute><VitalTrendsPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/vitals/alerts" element={<ModuleRoute module="nursing"><NurseRoute><AbnormalAlertsPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Triage & Assessment */}
                <Route path="/nursing/triage" element={<ModuleRoute module="nursing"><NurseRoute><TriageQueuePage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/assessment" element={<ModuleRoute module="nursing"><NurseRoute><NursingAssessmentPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/pain" element={<ModuleRoute module="nursing"><NurseRoute><PainAssessmentPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/fall-risk" element={<ModuleRoute module="nursing"><NurseRoute><FallRiskPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Medication */}
                <Route path="/nursing/meds/schedule" element={<ModuleRoute module="nursing"><NurseRoute><MedicationSchedulePage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/meds/administer" element={<ModuleRoute module="nursing"><NurseRoute><AdministerMedsPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/meds/chart" element={<ModuleRoute module="nursing"><NurseRoute><MedicationChartPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/meds/allergies" element={<ModuleRoute module="nursing"><NurseRoute><DrugAllergiesPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Wound Care */}
                <Route path="/nursing/wounds/assess" element={<ModuleRoute module="nursing"><NurseRoute><WoundAssessmentPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/wounds/dressing" element={<ModuleRoute module="nursing"><NurseRoute><DressingLogPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/wounds/progress" element={<ModuleRoute module="nursing"><NurseRoute><WoundProgressPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Patient Care */}
                <Route path="/nursing/care-plans" element={<ModuleRoute module="nursing"><NurseRoute><CarePlansPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/notes" element={<ModuleRoute module="nursing"><NurseRoute><NursingNotesPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/handover" element={<ModuleRoute module="nursing"><NurseRoute><ShiftHandoverPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/education" element={<ModuleRoute module="nursing"><NurseRoute><PatientEducationPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Procedures */}
                <Route path="/nursing/procedures/iv" element={<ModuleRoute module="nursing"><NurseRoute><IVCannulationPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/procedures/catheter" element={<ModuleRoute module="nursing"><NurseRoute><CatheterizationPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/procedures/specimen" element={<ModuleRoute module="nursing"><NurseRoute><SpecimenCollectionPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/procedures/log" element={<ModuleRoute module="nursing"><NurseRoute><ProcedureLogPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Monitoring */}
                <Route path="/nursing/monitor" element={<ModuleRoute module="nursing"><NurseRoute><PatientMonitorPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/io" element={<ModuleRoute module="nursing"><NurseRoute><IntakeOutputPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/glucose" element={<ModuleRoute module="nursing"><NurseRoute><BloodSugarPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/observations" element={<ModuleRoute module="nursing"><NurseRoute><ObservationChartPage /></NurseRoute></ModuleRoute>} />
                
                {/* Nursing - Reports */}
                <Route path="/nursing/reports/daily" element={<ModuleRoute module="nursing"><NurseRoute><NursingDailyReportPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/reports/shift" element={<ModuleRoute module="nursing"><NurseRoute><ShiftSummaryPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/reports/incident" element={<ModuleRoute module="nursing"><NurseRoute><IncidentReportPage /></NurseRoute></ModuleRoute>} />
                <Route path="/nursing/reports/workload" element={<ModuleRoute module="nursing"><NurseRoute><WorkloadStatsPage /></NurseRoute></ModuleRoute>} />
                
                {/* Doctors - Dashboard & Queue */}
                <Route path="/doctor" element={<ModuleRoute module="doctors"><DoctorRoute><DoctorDashboardPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/consult" element={<ModuleRoute module="doctors"><DoctorRoute><NewConsultationPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/queue" element={<ModuleRoute module="doctors"><DoctorRoute><WaitingPatientsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/queue/call" element={<ModuleRoute module="doctors"><DoctorRoute><CallNextPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/schedule" element={<ModuleRoute module="doctors"><DoctorRoute><TodaySchedulePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/pending" element={<ModuleRoute module="doctors"><DoctorRoute><PendingReviewsPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Consultation (legacy routes redirect) */}
                <Route path="/encounters/new" element={<ModuleRoute module="doctors"><RoleRoute roles={[ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST]}><NewConsultationPage /></RoleRoute></ModuleRoute>} />
                <Route path="/doctor/consultation/new" element={<ModuleRoute module="doctors"><Navigate to="/doctor/consult" replace /></ModuleRoute>} />
                <Route path="/doctor/soap" element={<ModuleRoute module="doctors"><DoctorRoute><SOAPNotesPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/notes" element={<ModuleRoute module="doctors"><DoctorRoute><ClinicalNotesPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/encounters" element={<ModuleRoute module="doctors"><ClinicalRoute><EncountersPage /></ClinicalRoute></ModuleRoute>} />
                
                {/* Doctors - Diagnosis */}
                <Route path="/doctor/diagnosis/icd" element={<ModuleRoute module="doctors"><DoctorRoute><ICD10CodingPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/diagnosis/differential" element={<ModuleRoute module="doctors"><DoctorRoute><DifferentialDxPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/diagnosis/problems" element={<ModuleRoute module="doctors"><DoctorRoute><ProblemListPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Prescriptions */}
                <Route path="/doctor/prescriptions/new" element={<ModuleRoute module="doctors"><DoctorRoute><WritePrescriptionPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/prescriptions" element={<ModuleRoute module="doctors"><DoctorRoute><PrescriptionHistoryPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/prescriptions/interactions" element={<ModuleRoute module="doctors"><DoctorRoute><DrugInteractionsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/prescriptions/favorites" element={<ModuleRoute module="doctors"><DoctorRoute><FavoriteRxPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Orders */}
                <Route path="/doctor/orders/lab" element={<ModuleRoute module="doctors"><DoctorRoute><LabOrdersPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/orders/radiology" element={<ModuleRoute module="doctors"><DoctorRoute><RadiologyOrdersPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/orders/procedures" element={<ModuleRoute module="doctors"><DoctorRoute><ProcedureOrdersPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/orders/sets" element={<ModuleRoute module="doctors"><DoctorRoute><OrderSetsPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Results Review */}
                <Route path="/doctor/results/lab" element={<ModuleRoute module="doctors"><DoctorRoute><LabResultsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/results/imaging" element={<ModuleRoute module="doctors"><DoctorRoute><ImagingResultsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/results/critical" element={<ModuleRoute module="doctors"><DoctorRoute><CriticalValuesPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Referrals */}
                <Route path="/referrals/new" element={<ModuleRoute module="doctors"><DoctorRoute><NewReferralPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/referrals/sent" element={<ModuleRoute module="doctors"><DoctorRoute><SentReferralsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/referrals/received" element={<ModuleRoute module="doctors"><DoctorRoute><ReferralsPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Certificates */}
                <Route path="/doctor/certificates/medical" element={<ModuleRoute module="doctors"><DoctorRoute><MedicalCertificatePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/certificates/sick-leave" element={<ModuleRoute module="doctors"><DoctorRoute><SickLeavePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/certificates/fitness" element={<ModuleRoute module="doctors"><DoctorRoute><FitnessCertificatePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/certificates/death" element={<ModuleRoute module="doctors"><DoctorRoute><DeathCertificatePage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Medical Report */}
                <Route path="/doctor/report" element={<ModuleRoute module="doctors"><DoctorRoute><MedicalReportPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/doctor/report/insurance" element={<ModuleRoute module="doctors"><DoctorRoute><InsuranceReportPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Doctors - Follow-up */}
                <Route path="/follow-ups/new" element={<ModuleRoute module="doctors"><DoctorRoute><ScheduleFollowUpPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/follow-ups" element={<ModuleRoute module="doctors"><DoctorRoute><FollowUpsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/follow-ups/overdue" element={<ModuleRoute module="doctors"><DoctorRoute><OverdueFollowUpsPage /></DoctorRoute></ModuleRoute>} />
                
                {/* Billing - OPD */}
                <Route path="/billing/opd/new" element={<ModuleRoute module="billing"><BillingRoute><NewOPDBillPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/opd/orders" element={<ModuleRoute module="billing"><BillingRoute><OPDOrderingPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/opd/packages" element={<ModuleRoute module="billing"><BillingRoute><PackageBillingPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/opd/search" element={<ModuleRoute module="billing"><BillingRoute><SearchBillsPage /></BillingRoute></ModuleRoute>} />
                
                {/* Billing - Core */}
                <Route path="/billing/invoices" element={<ModuleRoute module="billing"><BillingRoute><InvoicesPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/invoices/:invoiceId" element={<ModuleRoute module="billing"><BillingRoute><InvoicesPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/payments" element={<ModuleRoute module="billing"><BillingRoute><PaymentsPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/patient-tab" element={<ModuleRoute module="billing"><BillingRoute><PatientTabPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/patient-tab/:patientId" element={<ModuleRoute module="billing"><BillingRoute><PatientTabPage /></BillingRoute></ModuleRoute>} />
                <Route path="/billing/doctor-fees" element={<ModuleRoute module="billing"><BillingRoute><DoctorFeesPage /></BillingRoute></ModuleRoute>} />
                <Route path="/admin/services/doctor-fees" element={<AdminRoute><DoctorFeesPage /></AdminRoute>} />
                
                {/* Billing - Insurance */}
                <Route path="/insurance/claims" element={<ModuleRoute module="billing"><InsuranceRoute><ClaimsPage /></InsuranceRoute></ModuleRoute>} />
                <Route path="/insurance/providers" element={<ModuleRoute module="billing"><InsuranceRoute><InsuranceProvidersPage /></InsuranceRoute></ModuleRoute>} />
                
                {/* Billing - Procurement */}
                <Route path="/procurement/approvals" element={<ModuleRoute module="stores"><AdminRoute><ApprovalDashboardPage /></AdminRoute></ModuleRoute>} />
                <Route path="/procurement/direct-po" element={<ModuleRoute module="stores"><StoreKeeperRoute><DirectPOPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/requisitions" element={<ModuleRoute module="stores"><StoreKeeperRoute><RequisitionsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/rfq" element={<ModuleRoute module="stores"><StoreKeeperRoute><RFQPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/quotes/compare" element={<ModuleRoute module="stores"><StoreKeeperRoute><CompareQuotesPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/quotes/approve" element={<ModuleRoute module="stores"><AdminRoute><ApproveQuotationsPage /></AdminRoute></ModuleRoute>} />
                <Route path="/procurement/orders" element={<ModuleRoute module="stores"><StoreKeeperRoute><PurchaseOrdersPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/grn" element={<ModuleRoute module="stores"><StoreKeeperRoute><GoodsReceivedPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/invoices/match" element={<ModuleRoute module="stores"><AccountantRoute><InvoiceMatchingPage /></AccountantRoute></ModuleRoute>} />
                <Route path="/procurement/trace" element={<ModuleRoute module="stores"><StoreKeeperRoute><ProcurementTracePage /></StoreKeeperRoute></ModuleRoute>} />
                
                {/* Billing - Vendors */}
                <Route path="/procurement/vendors" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorListPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/vendors/contracts" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorContractsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/vendors/ratings" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorRatingsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/vendors/prices" element={<ModuleRoute module="stores"><StoreKeeperRoute><PriceAgreementsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/procurement/vendors/payments" element={<ModuleRoute module="stores"><AccountantRoute><VendorPaymentsPage /></AccountantRoute></ModuleRoute>} />
                
                {/* Billing - Finance */}
                <Route path="/finance/accounts" element={<ModuleRoute module="finance"><FinanceRoute><AccountsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/journals" element={<ModuleRoute module="finance"><FinanceRoute><JournalEntriesPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/expenses" element={<ModuleRoute module="finance"><FinanceRoute><ExpensesPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/revenue" element={<ModuleRoute module="finance"><FinanceRoute><RevenuePage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/reports" element={<ModuleRoute module="finance"><FinanceRoute><FinancialReportsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/cost-centers" element={<ModuleRoute module="finance"><FinanceRoute><CostCentersPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/budgets" element={<ModuleRoute module="finance"><FinanceRoute><BudgetPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/bank-reconciliation" element={<ModuleRoute module="finance"><FinanceRoute><BankReconciliationPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/patient-finance" element={<ModuleRoute module="finance"><FinanceRoute><PatientFinancePage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/petty-cash" element={<ModuleRoute module="finance"><FinanceRoute><PettyCashPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/donor-funds" element={<ModuleRoute module="finance"><FinanceRoute><DonorFundsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/finance/trial-balance" element={<ModuleRoute module="finance"><FinanceRoute><TrialBalancePage /></FinanceRoute></ModuleRoute>} />
                
                {/* Emergency Module */}
                <Route path="/emergency/queue" element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyQueuePage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/emergency/ambulance" element={<ModuleRoute module="emergency"><ClinicalRoute><AmbulanceTrackingPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/emergency/triage" element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyTriagePage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/emergency/billing" element={<ModuleRoute module="emergency"><BillingRoute><EmergencyBillingPage /></BillingRoute></ModuleRoute>} />
                
                {/* Laboratory Module */}
                <Route path="/lab/queue" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabQueuePage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab/samples" element={<ModuleRoute module="diagnostics"><LabTechRoute><SampleCollectionPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab/results" element={<ModuleRoute module="diagnostics"><LabTechRoute><ResultsEntryPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab/reports" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabReportsPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab/analytics" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabAnalyticsPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab/sample-referrals" element={<ModuleRoute module="diagnostics"><LabTechRoute><SampleReferralPage /></LabTechRoute></ModuleRoute>} />
                
                {/* Radiology Module */}
                <Route path="/radiology/queue" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyQueuePage /></RadiologyRoute></ModuleRoute>} />
                <Route path="/radiology/orders" element={<ModuleRoute module="diagnostics"><RadiologyRoute><ImagingOrdersPage /></RadiologyRoute></ModuleRoute>} />
                <Route path="/radiology/results" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyResultsPage /></RadiologyRoute></ModuleRoute>} />
                <Route path="/radiology/analytics" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyAnalyticsPage /></RadiologyRoute></ModuleRoute>} />
                
                {/* Pharmacy - Core */}
                <Route path="/pharmacy/dashboard" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyDashboardPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/dispense" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DispenseMedicationPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/queue" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyQueuePage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/stock" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyStockPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/returns" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyReturnsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/adjustments" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyAdjustmentsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/transfers" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyTransfersPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/analytics" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyAnalyticsPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Transactions */}
                <Route path="/pharmacy/retail" element={<Navigate to="/pharmacy/pos/sale" replace />} />
                <Route path="/pharmacy/wholesale" element={<Navigate to="/pharmacy/pos/wholesale/customers" replace />} />
                <Route path="/pharmacy/inpatient" element={<ModuleRoute module="pharmacy"><PharmacistRoute><InpatientMedsPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Expiry Management */}
                <Route path="/pharmacy/expiry/soon" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiringSoonPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/expired" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiredItemsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/alerts" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiryAlertsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/disposal" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DisposalLogPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/return" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ReturnToSupplierPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/management" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiryManagementPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/controlled-register" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ControlledSubstancesRegisterPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Procurement */}
                <Route path="/pharmacy/requisitions" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyRequisitionsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/rfq" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyRFQPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/quotes/compare" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyCompareQuotesPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/po" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyPOPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/grn" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyGRNPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/invoices/match" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyInvoiceMatchPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/supplier-payments" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacySupplierPaymentsPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Suppliers */}
                <Route path="/pharmacy/suppliers" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacySupplierListPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/suppliers/contracts" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyContractsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/suppliers/ratings" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacySupplierRatingsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/suppliers/prices" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyPriceListsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/supplier-rankings" element={<ModuleRoute module="pharmacy"><PharmacistRoute><SupplierRankingsPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Medication Adherence */}
                <Route path="/pharmacy/adherence" element={<ModuleRoute module="pharmacy"><PharmacistRoute><MedicationAdherencePage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - Drug Labels & Temperature Monitoring */}
                <Route path="/pharmacy/labels" element={<ModuleRoute module="pharmacy"><PharmacistRoute><LabelManagementPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/temperature" element={<ModuleRoute module="pharmacy"><PharmacistRoute><TemperatureMonitoringPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Pharmacy - DUR Reports & Drug DB Sync */}
                <Route path="/pharmacy/dur-reports" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DURReportsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/drug-db-sync" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugDatabaseSyncPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/rx-templates" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PrescriptionTemplatesPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/notifications" element={<ModuleRoute module="pharmacy"><PharmacistRoute><NotificationLogPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* POS Module */}
                <Route path="/pharmacy/pos" element={<ModuleRoute module="pos"><PharmacistRoute><POSDashboardPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/sale" element={<ModuleRoute module="pos"><PharmacistRoute><POSSalePage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/shifts" element={<ModuleRoute module="pos"><PharmacistRoute><POSShiftPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/reports" element={<ModuleRoute module="pos"><PharmacistRoute><POSReportsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/wholesale/customers" element={<ModuleRoute module="pos"><PharmacistRoute><WholesaleCustomersPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/wholesale/tiers" element={<ModuleRoute module="pos"><PharmacistRoute><PricingTiersPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/deliveries" element={<ModuleRoute module="pos"><PharmacistRoute><DeliveryTrackingPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/returns" element={<ModuleRoute module="pos"><PharmacistRoute><POSReturnsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/receipts" element={<ModuleRoute module="pos"><PharmacistRoute><POSReceiptHistoryPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/pos/offline-sync" element={<ModuleRoute module="pos"><PharmacistRoute><POSOfflineSyncPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* IPD Module */}
                <Route path="/ipd/admissions" element={<ModuleRoute module="ipd"><ClinicalRoute><AdmissionsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/ipd/wards" element={<ModuleRoute module="ipd"><ClinicalRoute><WardsBedsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/ipd/bed-board" element={<ModuleRoute module="ipd"><ClinicalRoute><BedBoardPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/ipd/bht" element={<ModuleRoute module="ipd"><ClinicalRoute><BHTIssuePage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/ipd/billing" element={<ModuleRoute module="ipd"><BillingRoute><InpatientBillingPage /></BillingRoute></ModuleRoute>} />
                <Route path="/ipd/nursing" element={<ModuleRoute module="ipd"><NurseRoute><IPDNursingNotesPage /></NurseRoute></ModuleRoute>} />
                <Route path="/ipd/theatre" element={<ModuleRoute module="ipd"><DoctorRoute><IPDTheatrePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/ipd/maternity" element={<ModuleRoute module="ipd"><ClinicalRoute><IPDMaternityPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/ipd/discharge" element={<ModuleRoute module="ipd"><DoctorRoute><IPDDischargePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/ipd/analytics" element={<ModuleRoute module="ipd"><ClinicalRoute><IPDAnalyticsPage /></ClinicalRoute></ModuleRoute>} />
                
                {/* Stores Module */}
                <Route path="/stores/main" element={<ModuleRoute module="stores"><StoreKeeperRoute><MainInventoryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/issue" element={<ModuleRoute module="stores"><StoreKeeperRoute><UnitIssuePage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/transfers" element={<Navigate to="/inventory/transfers" replace />} />
                <Route path="/inventory/transfers" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockTransferPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/inventory/reorder" element={<ModuleRoute module="stores"><StoreKeeperRoute><ReorderSuggestionsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/procurement" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresProcurementPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/suppliers" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresSupplierPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/expiry" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/adjustments" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockAdjustmentsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/stock-take" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockTakePage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/assets" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresAssetRegisterPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/maintenance" element={<ModuleRoute module="stores"><StoreKeeperRoute><MaintenanceSchedulePage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/consumption" element={<ModuleRoute module="stores"><StoreKeeperRoute><ConsumptionReportsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/analytics" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresAnalyticsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/requisitions" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresRequisitionsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/rfq" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresRFQPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/quotes/compare" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresCompareQuotesPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/po" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresPOPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/grn" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresGRNPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/invoices/match" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresInvoiceMatchPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/suppliers/contracts" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresSupplierContractsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/payments" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresPaymentsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/disposal" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresDisposalPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/expiry/soon" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/stores/expiry/expired" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/settings/classifications" element={<ModuleRoute module="stores"><AdminRoute><ItemClassificationsPage /></AdminRoute></ModuleRoute>} />
                
                {/* OPD */}
                <Route path="/encounters/:id" element={<ModuleRoute module="doctors"><ClinicalRoute><EncounterDetailPage /></ClinicalRoute></ModuleRoute>} />
                {/* Clinical */}
                <Route path="/pharmacy" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/cashier" element={<ModuleRoute module="billing"><CashierRoute><CashierPage /></CashierRoute></ModuleRoute>} />
                <Route path="/inventory" element={<ModuleRoute module="stores"><StoreKeeperRoute><InventoryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/lab" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/radiology" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyPage /></RadiologyRoute></ModuleRoute>} />
                <Route path="/wards" element={<ModuleRoute module="ipd"><ClinicalRoute><WardManagementPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/emergency" element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/theatre" element={<ModuleRoute module="ipd"><DoctorRoute><IPDTheatrePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/maternity" element={<ModuleRoute module="ipd"><ClinicalRoute><IPDMaternityPage /></ClinicalRoute></ModuleRoute>} />
                {/* Admin & Finance */}
                <Route path="/hr" element={<ModuleRoute module="hr"><HRRoute><HRPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/staff" element={<ModuleRoute module="hr"><HRRoute><StaffDirectoryPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/departments" element={<ModuleRoute module="hr"><HRRoute><AdminDepartmentsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/designations" element={<ModuleRoute module="hr"><HRRoute><DesignationsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/shifts" element={<ModuleRoute module="hr"><HRRoute><ShiftManagementPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/leave" element={<ModuleRoute module="hr"><HRRoute><LeaveManagementPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/credentials" element={<ModuleRoute module="hr"><HRRoute><CredentialsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/attendance" element={<ModuleRoute module="hr"><HRRoute><AttendancePage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/payroll" element={<ModuleRoute module="hr"><HRRoute><PayrollPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/recruitment" element={<ModuleRoute module="hr"><HRRoute><RecruitmentPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/appraisals" element={<ModuleRoute module="hr"><HRRoute><AppraisalsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/appraisals/:id" element={<ModuleRoute module="hr"><HRRoute><AppraisalDetailPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/training" element={<ModuleRoute module="hr"><HRRoute><TrainingPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/analytics" element={<ModuleRoute module="hr"><HRRoute><HRAnalyticsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/letters" element={<ModuleRoute module="hr"><HRRoute><HRLettersPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/disciplinary" element={<ModuleRoute module="hr"><HRRoute><DisciplinaryPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/onboarding" element={<ModuleRoute module="hr"><HRRoute><OnboardingPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/payroll-reports" element={<ModuleRoute module="hr"><HRRoute><PayrollReportsPage /></HRRoute></ModuleRoute>} />
                <Route path="/hr/my-payslips" element={<ModuleRoute module="hr"><ProtectedRoute><MyPayslipsPage /></ProtectedRoute></ModuleRoute>} />
                <Route path="/hr/my-leave" element={<ModuleRoute module="hr"><ProtectedRoute><MyLeavePage /></ProtectedRoute></ModuleRoute>} />
                <Route path="/hr/my-attendance" element={<ModuleRoute module="hr"><ProtectedRoute><MyAttendancePage /></ProtectedRoute></ModuleRoute>} />
                <Route path="/hr/my-appraisals" element={<ModuleRoute module="hr"><ProtectedRoute><MyAppraisalsPage /></ProtectedRoute></ModuleRoute>} />
                <Route path="/finance" element={<ModuleRoute module="finance"><FinanceRoute><FinancePage /></FinanceRoute></ModuleRoute>} />
                <Route path="/insurance/dashboard" element={<ModuleRoute module="billing"><InsuranceRoute><InsuranceDashboardPage /></InsuranceRoute></ModuleRoute>} />
                <Route path="/insurance" element={<ModuleRoute module="billing"><InsuranceRoute><InsurancePage /></InsuranceRoute></ModuleRoute>} />
                <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
                <Route path="/membership" element={<ModuleRoute module="billing"><AdminRoute><MembershipPage /></AdminRoute></ModuleRoute>} />
                <Route path="/services" element={<AdminRoute><ServicesPage /></AdminRoute>} />
                <Route path="/stores" element={<ModuleRoute module="stores"><StoreKeeperRoute><MainInventoryPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/orders" element={<ModuleRoute module="doctors"><DoctorRoute><OrdersPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/tenants" element={<AdminRoute><TenantsPage /></AdminRoute>} />
                <Route path="/vitals" element={<ModuleRoute module="nursing"><ClinicalRoute><VitalsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/clinical-notes" element={<ModuleRoute module="doctors"><DoctorRoute><ClinicalNotesPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/referrals" element={<ModuleRoute module="doctors"><DoctorRoute><ReferralsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/treatment-plans" element={<ModuleRoute module="doctors"><DoctorRoute><TreatmentPlansPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/discharge" element={<ModuleRoute module="ipd"><DoctorRoute><IPDDischargePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                <Route path="/facilities" element={<AdminRoute><FacilitiesPage /></AdminRoute>} />
                <Route path="/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                
                {/* Admin - Analytics */}
                <Route path="/admin/analytics" element={<AdminRoute><AdminAnalyticsDashboardPage /></AdminRoute>} />

                {/* Admin - User Management */}
                <Route path="/admin/users" element={<AdminRoute><UserListPage /></AdminRoute>} />
                <Route path="/admin/roles" element={<AdminRoute><RolePermissionsPage /></AdminRoute>} />
                <Route path="/admin/users/activity" element={<AdminRoute><UserActivityLogPage /></AdminRoute>} />
                <Route path="/admin/users/departments" element={<AdminRoute><DepartmentAccessPage /></AdminRoute>} />
                <Route path="/admin/users/sessions" element={<AdminRoute><SessionManagementPage /></AdminRoute>} />
                <Route path="/admin/users/bulk-import" element={<AdminRoute><BulkUserImportPage /></AdminRoute>} />
                
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
                <Route path="/admin/lab/tests/:testId" element={<AdminRoute><TestCatalogPage /></AdminRoute>} />
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
                <Route path="/admin/site/facility-mode" element={<AdminRoute><FacilityModePage /></AdminRoute>} />
                <Route path="/admin/site/integrations" element={<AdminRoute><IntegrationsPage /></AdminRoute>} />
                <Route path="/admin/site/license" element={<AdminRoute><LicenseSubscriptionPage /></AdminRoute>} />
                
                {/* Admin - Backups */}
                <Route path="/admin/backups" element={<AdminRoute><BackupManagementPage /></AdminRoute>} />
                <Route path="/admin/trash" element={<AdminRoute><TrashRecoveryPage /></AdminRoute>} />
                <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
                <Route path="/admin/password-policies" element={<AdminRoute><PasswordPoliciesPage /></AdminRoute>} />
                <Route path="/admin/jobs" element={<AdminRoute><JobMonitorPage /></AdminRoute>} />
                <Route path="/admin/integrations/webhooks" element={<AdminRoute><WebhooksPage /></AdminRoute>} />
                <Route path="/admin/integrations/email-templates" element={<AdminRoute><EmailTemplatesPage /></AdminRoute>} />
                <Route path="/admin/integrations/sso" element={<AdminRoute><SsoConfigPage /></AdminRoute>} />
                <Route path="/admin/integrations/efris" element={<AdminRoute><EfrisConfigPage /></AdminRoute>} />
                <Route path="/admin/hr/goals" element={<AdminRoute><EmployeeGoalsPage /></AdminRoute>} />
                <Route path="/admin/hr/pips" element={<AdminRoute><PIPManagementPage /></AdminRoute>} />
                <Route path="/admin/hr/letter-templates" element={<AdminRoute><LetterTemplatesPage /></AdminRoute>} />
                <Route path="/admin/hr/org-chart" element={<AdminRoute><OrgChartPage /></AdminRoute>} />
                <Route path="/admin/hr/leave-dashboard" element={<AdminRoute><LeaveDashboardPage /></AdminRoute>} />
                <Route path="/admin/support-access" element={<AdminRoute><SupportAccessPage /></AdminRoute>} />
                
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
                <Route path="/drug-management/classifications" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugClassificationsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/drug-management/interactions" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugInteractionsDatabasePage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/drug-management/allergy-classes" element={<ModuleRoute module="pharmacy"><PharmacistRoute><AllergyClassesPage /></PharmacistRoute></ModuleRoute>} />
                
                {/* Supplier Finance */}
                <Route path="/supplier-finance/payment-vouchers" element={<ModuleRoute module="finance"><FinanceRoute><SupplierPaymentVouchersPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/supplier-finance/credit-notes" element={<ModuleRoute module="finance"><FinanceRoute><SupplierCreditNotesPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/supplier-finance/ledger" element={<ModuleRoute module="finance"><FinanceRoute><SupplierLedgerPage /></FinanceRoute></ModuleRoute>} />
                
                {/* MDM (Master Data Management) */}
                <Route path="/mdm/versions" element={<AdminRoute><MasterDataVersionsPage /></AdminRoute>} />
                <Route path="/mdm/approvals" element={<AdminRoute><MasterDataApprovalsPage /></AdminRoute>} />
                <Route path="/mdm/rules" element={<AdminRoute><ApprovalRulesPage /></AdminRoute>} />
                
                {/* Lab QC */}
                <Route path="/lab-qc/dashboard" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabQCDashboardPage /></LabTechRoute></ModuleRoute>} />
                <Route path="/lab-qc/consumables" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabConsumablesPage /></LabTechRoute></ModuleRoute>} />
                
                {/* Assets Module */}
                <Route path="/assets" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetRegisterPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/register" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetRegisterPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/allocation" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetAllocationPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/tracking" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetTrackingPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/maintenance" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetMaintenancePage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/depreciation" element={<ModuleRoute module="assets"><FinanceRoute><AssetDepreciationPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/assets/reports" element={<ModuleRoute module="assets"><FinanceRoute><AssetReportsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/assets/transfers" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetTransfersPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/disposal" element={<ModuleRoute module="assets"><StoreKeeperRoute><AssetDisposalPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/assets/categories" element={<ModuleRoute module="assets"><AdminRoute><AssetCategoriesPage /></AdminRoute></ModuleRoute>} />

                {/* Chronic Care Module */}
                <Route path="/chronic-care/dashboard" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicCareDashboardPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/chronic-care/registry" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicRegistryPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/chronic-care/reminders" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicRemindersPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/chronic-care/notifications" element={<ModuleRoute module="chronic-care"><AdminRoute><NotificationSettingsPage /></AdminRoute></ModuleRoute>} />

                {/* Integrations Module */}
                <Route path="/integrations/drugs" element={<ModuleRoute module="integrations"><PharmacistRoute><DrugDatabasePage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/integrations/lab-reference" element={<ModuleRoute module="integrations"><LabTechRoute><LabReferencePage /></LabTechRoute></ModuleRoute>} />
                <Route path="/integrations/sms" element={<ModuleRoute module="integrations"><AdminRoute><SMSNotificationsPage /></AdminRoute></ModuleRoute>} />
                <Route path="/integrations/dhis2" element={<ModuleRoute module="integrations"><AdminRoute><DHIS2SettingsPage /></AdminRoute></ModuleRoute>} />

                {/* Notifications Module */}
                <Route path="/notifications/settings" element={<AdminRoute><NotificationSettingsPage /></AdminRoute>} />
                <Route path="/notifications/templates" element={<AdminRoute><SmsTemplatesPage /></AdminRoute>} />
                <Route path="/notifications/history" element={<AdminRoute><NotificationHistoryPage /></AdminRoute>} />
                <Route path="/notifications/bulk" element={<AdminRoute><BulkSmsPage /></AdminRoute>} />

                {/* Reports Module — restricted by role */}
                <Route path="/reports" element={<ModuleRoute module="reports"><AdminRoute><ReportsDashboardPage /></AdminRoute></ModuleRoute>} />
                <Route path="/reports/patients" element={<ModuleRoute module="reports"><ClinicalRoute><PatientStatisticsReportPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/reports/visits" element={<ModuleRoute module="reports"><ClinicalRoute><VisitReportsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/reports/diseases" element={<ModuleRoute module="reports"><ClinicalRoute><DiseaseStatisticsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/reports/mortality" element={<ModuleRoute module="reports"><ClinicalRoute><MortalityReportsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/reports/revenue" element={<ModuleRoute module="reports"><FinanceRoute><RevenueReportsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/reports/collections" element={<ModuleRoute module="reports"><FinanceRoute><CollectionReportsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/reports/outstanding" element={<ModuleRoute module="reports"><FinanceRoute><OutstandingReportsPage /></FinanceRoute></ModuleRoute>} />
                <Route path="/reports/stock" element={<ModuleRoute module="reports"><StoreKeeperRoute><StockReportsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/reports/expiry" element={<ModuleRoute module="reports"><StoreKeeperRoute><ExpiryReportsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/reports/consumption" element={<ModuleRoute module="reports"><StoreKeeperRoute><InventoryConsumptionReportsPage /></StoreKeeperRoute></ModuleRoute>} />
                <Route path="/reports/hmis-105" element={<ModuleRoute module="reports"><AdminRoute><HMIS105ReportPage /></AdminRoute></ModuleRoute>} />
                
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
