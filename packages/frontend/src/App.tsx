import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/auth';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import ProtectedRoute from './components/ProtectedRoute';
import {
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
} from './components/RoleRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PatientsPage from './pages/PatientsPage';
import PatientSearchPage from './pages/PatientSearchPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import PatientDocumentsPage from './pages/PatientDocumentsPage';
import PatientHistoryPage from './pages/PatientHistoryPage';
import PatientDetailPage from './pages/PatientDetailPage';
import PatientEditPage from './pages/PatientEditPage';
import OPDTokenPage from './pages/OPDTokenPage';
import QueueMonitorPage from './pages/QueueMonitorPage';
import CallNextPatientPage from './pages/CallNextPatientPage';
import QueueAnalyticsPage from './pages/QueueAnalyticsPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import ViewAppointmentsPage from './pages/ViewAppointmentsPage';
import DoctorSchedulesPage from './pages/DoctorSchedulesPage';
import ManageAppointmentsPage from './pages/ManageAppointmentsPage';
import NewBillPage from './pages/NewBillPage';
import CollectPaymentPage from './pages/CollectPaymentPage';
import PrintReceiptPage from './pages/PrintReceiptPage';
import PendingPaymentsPage from './pages/PendingPaymentsPage';
import RefundsPage from './pages/RefundsPage';
import VerifyCoveragePage from './pages/VerifyCoveragePage';
import PreAuthorizationPage from './pages/PreAuthorizationPage';
import ClaimSubmissionPage from './pages/ClaimSubmissionPage';
import InsuranceCardsPage from './pages/InsuranceCardsPage';
import RegistrationDailySummaryPage from './pages/RegistrationDailySummaryPage';
import PatientStatisticsPage from './pages/PatientStatisticsPage';
import RegistrationRevenuePage from './pages/RegistrationRevenuePage';
import QueuePerformancePage from './pages/QueuePerformancePage';
import FacilitiesPage from './pages/FacilitiesPage';
import RolesPage from './pages/RolesPage';
import EncountersPage from './pages/EncountersPage';
import EncounterDetailPage from './pages/EncounterDetailPage';
import PharmacyPage from './pages/PharmacyPage';
import CashierPage from './pages/CashierPage';
import InventoryPage from './pages/InventoryPage';
import LabPage from './pages/LabPage';
import RadiologyPage from './pages/RadiologyPage';
import WardManagementPage from './pages/WardManagementPage';
import EmergencyPage from './pages/EmergencyPage';
import TheatrePage from './pages/TheatrePage';
import MaternityPage from './pages/MaternityPage';
import HRPage from './pages/HRPage';
import FinancePage from './pages/FinancePage';
import InsurancePage from './pages/InsurancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import MembershipPage from './pages/MembershipPage';
import ServicesPage from './pages/ServicesPage';
import StoresPage from './pages/StoresPage';
import OrdersPage from './pages/OrdersPage';
import TenantsPage from './pages/TenantsPage';
import VitalsPage from './pages/VitalsPage';
import ClinicalNotesPage from './pages/ClinicalNotesPage';
import NotFoundPage from './pages/NotFoundPage';
import MyPayslipsPage from './pages/hr/MyPayslipsPage';
import QueueManagementPage from './pages/QueueManagementPage';
import ReferralsPage from './pages/ReferralsPage';
import FollowUpsPage from './pages/FollowUpsPage';
import TreatmentPlansPage from './pages/TreatmentPlansPage';
import DischargePage from './pages/DischargePage';

// Nursing Module Pages
import RecordVitalsPage from './pages/nursing/RecordVitalsPage';
import VitalsHistoryPage from './pages/nursing/VitalsHistoryPage';
import VitalTrendsPage from './pages/nursing/VitalTrendsPage';
import AbnormalAlertsPage from './pages/nursing/AbnormalAlertsPage';
import TriageQueuePage from './pages/nursing/TriageQueuePage';
import NursingAssessmentPage from './pages/nursing/NursingAssessmentPage';
import PainAssessmentPage from './pages/nursing/PainAssessmentPage';
import FallRiskPage from './pages/nursing/FallRiskPage';
import MedicationSchedulePage from './pages/nursing/MedicationSchedulePage';
import AdministerMedsPage from './pages/nursing/AdministerMedsPage';
import MedicationChartPage from './pages/nursing/MedicationChartPage';
import DrugAllergiesPage from './pages/nursing/DrugAllergiesPage';
import WoundAssessmentPage from './pages/nursing/WoundAssessmentPage';
import DressingLogPage from './pages/nursing/DressingLogPage';
import WoundProgressPage from './pages/nursing/WoundProgressPage';
import CarePlansPage from './pages/nursing/CarePlansPage';
import NursingNotesPage from './pages/nursing/NursingNotesPage';
import ShiftHandoverPage from './pages/nursing/ShiftHandoverPage';
import PatientEducationPage from './pages/nursing/PatientEducationPage';
import IVCannulationPage from './pages/nursing/IVCannulationPage';
import CatheterizationPage from './pages/nursing/CatheterizationPage';
import SpecimenCollectionPage from './pages/nursing/SpecimenCollectionPage';
import ProcedureLogPage from './pages/nursing/ProcedureLogPage';
import PatientMonitorPage from './pages/nursing/PatientMonitorPage';
import IntakeOutputPage from './pages/nursing/IntakeOutputPage';
import BloodSugarPage from './pages/nursing/BloodSugarPage';
import ObservationChartPage from './pages/nursing/ObservationChartPage';
import NursingDailyReportPage from './pages/nursing/NursingDailyReportPage';
import ShiftSummaryPage from './pages/nursing/ShiftSummaryPage';
import IncidentReportPage from './pages/nursing/IncidentReportPage';
import WorkloadStatsPage from './pages/nursing/WorkloadStatsPage';

// Doctors Module Pages
import WaitingPatientsPage from './pages/doctor/queue/WaitingPatientsPage';
import CallNextPage from './pages/doctor/queue/CallNextPage';
import TodaySchedulePage from './pages/doctor/queue/TodaySchedulePage';
import PendingReviewsPage from './pages/doctor/queue/PendingReviewsPage';
import NewConsultationPage from './pages/doctor/NewConsultationPage';
import SOAPNotesPage from './pages/doctor/SOAPNotesPage';
import ICD10CodingPage from './pages/doctor/diagnosis/ICD10CodingPage';
import DifferentialDxPage from './pages/doctor/diagnosis/DifferentialDxPage';
import ProblemListPage from './pages/doctor/diagnosis/ProblemListPage';
import WritePrescriptionPage from './pages/doctor/prescriptions/WritePrescriptionPage';
import PrescriptionHistoryPage from './pages/doctor/prescriptions/PrescriptionHistoryPage';
import DrugInteractionsPage from './pages/doctor/prescriptions/DrugInteractionsPage';
import FavoriteRxPage from './pages/doctor/prescriptions/FavoriteRxPage';
import LabOrdersPage from './pages/doctor/orders/LabOrdersPage';
import RadiologyOrdersPage from './pages/doctor/orders/RadiologyOrdersPage';
import ProcedureOrdersPage from './pages/doctor/orders/ProcedureOrdersPage';
import OrderSetsPage from './pages/doctor/orders/OrderSetsPage';
import LabResultsPage from './pages/doctor/results/LabResultsPage';
import ImagingResultsPage from './pages/doctor/results/ImagingResultsPage';
import CriticalValuesPage from './pages/doctor/results/CriticalValuesPage';
import NewReferralPage from './pages/doctor/referrals/NewReferralPage';
import SentReferralsPage from './pages/doctor/referrals/SentReferralsPage';
import MedicalCertificatePage from './pages/doctor/certificates/MedicalCertificatePage';
import SickLeavePage from './pages/doctor/certificates/SickLeavePage';
import FitnessCertificatePage from './pages/doctor/certificates/FitnessCertificatePage';
import DeathCertificatePage from './pages/doctor/certificates/DeathCertificatePage';
import ScheduleFollowUpPage from './pages/doctor/followups/ScheduleFollowUpPage';
import OverdueFollowUpsPage from './pages/doctor/followups/OverdueFollowUpsPage';

// Billing Module Pages
import NewOPDBillPage from './pages/billing/opd/NewOPDBillPage';
import OPDOrderingPage from './pages/billing/opd/OPDOrderingPage';
import PackageBillingPage from './pages/billing/opd/PackageBillingPage';
import SearchBillsPage from './pages/billing/opd/SearchBillsPage';
import InvoicesPage from './pages/billing/InvoicesPage';
import PaymentsPage from './pages/billing/PaymentsPage';
import ClaimsPage from './pages/billing/insurance/ClaimsPage';
import InsuranceProvidersPage from './pages/billing/insurance/ProvidersPage';
import RequisitionsPage from './pages/billing/procurement/RequisitionsPage';
import RFQPage from './pages/billing/procurement/RFQPage';
import CompareQuotesPage from './pages/billing/procurement/CompareQuotesPage';
import ApproveQuotationsPage from './pages/billing/procurement/ApproveQuotationsPage';
import PurchaseOrdersPage from './pages/billing/procurement/PurchaseOrdersPage';
import GoodsReceivedPage from './pages/billing/procurement/GoodsReceivedPage';
import InvoiceMatchingPage from './pages/billing/procurement/InvoiceMatchingPage';
import VendorListPage from './pages/billing/vendors/VendorListPage';
import VendorContractsPage from './pages/billing/vendors/VendorContractsPage';
import VendorRatingsPage from './pages/billing/vendors/VendorRatingsPage';
import PriceAgreementsPage from './pages/billing/vendors/PriceAgreementsPage';
import VendorPaymentsPage from './pages/billing/vendors/VendorPaymentsPage';
import AccountsPage from './pages/billing/finance/AccountsPage';
import JournalEntriesPage from './pages/billing/finance/JournalEntriesPage';
import ExpensesPage from './pages/billing/finance/ExpensesPage';
import RevenuePage from './pages/billing/finance/RevenuePage';
import FinancialReportsPage from './pages/billing/finance/FinancialReportsPage';

// Emergency Module Pages
import EmergencyQueuePage from './pages/emergency/EmergencyQueuePage';
import AmbulanceTrackingPage from './pages/emergency/AmbulanceTrackingPage';
import EmergencyTriagePage from './pages/emergency/EmergencyTriagePage';
import EmergencyBillingPage from './pages/emergency/EmergencyBillingPage';

// Laboratory Module Pages
import LabQueuePage from './pages/lab/LabQueuePage';
import SampleCollectionPage from './pages/lab/SampleCollectionPage';
import ResultsEntryPage from './pages/lab/ResultsEntryPage';
import LabReportsPage from './pages/lab/LabReportsPage';
import LabAnalyticsPage from './pages/lab/LabAnalyticsPage';

// Radiology Module Pages
import RadiologyQueuePage from './pages/radiology/RadiologyQueuePage';
import ImagingOrdersPage from './pages/radiology/ImagingOrdersPage';
import RadiologyResultsPage from './pages/radiology/RadiologyResultsPage';
import RadiologyAnalyticsPage from './pages/radiology/RadiologyAnalyticsPage';

// Pharmacy Module Pages
import DispenseMedicationPage from './pages/pharmacy/DispenseMedicationPage';
import PharmacyQueuePage from './pages/pharmacy/PharmacyQueuePage';
import PharmacyStockPage from './pages/pharmacy/PharmacyStockPage';
import PharmacyReturnsPage from './pages/pharmacy/ReturnsPage';
import PharmacyAdjustmentsPage from './pages/pharmacy/AdjustmentsPage';
import PharmacyAnalyticsPage from './pages/pharmacy/PharmacyAnalyticsPage';
import RetailSalesPage from './pages/pharmacy/transactions/RetailSalesPage';
import WholesalePage from './pages/pharmacy/transactions/WholesalePage';
import InpatientMedsPage from './pages/pharmacy/transactions/InpatientMedsPage';
import ExpiringSoonPage from './pages/pharmacy/expiry/ExpiringSoonPage';
import ExpiredItemsPage from './pages/pharmacy/expiry/ExpiredItemsPage';
import ExpiryAlertsPage from './pages/pharmacy/expiry/ExpiryAlertsPage';
import DisposalLogPage from './pages/pharmacy/expiry/DisposalLogPage';
import ReturnToSupplierPage from './pages/pharmacy/expiry/ReturnToSupplierPage';
import PharmacyRequisitionsPage from './pages/pharmacy/procurement/PharmacyRequisitionsPage';
import PharmacyRFQPage from './pages/pharmacy/procurement/PharmacyRFQPage';
import PharmacyCompareQuotesPage from './pages/pharmacy/procurement/PharmacyCompareQuotesPage';
import PharmacyPOPage from './pages/pharmacy/procurement/PharmacyPOPage';
import PharmacyGRNPage from './pages/pharmacy/procurement/PharmacyGRNPage';
import PharmacyInvoiceMatchPage from './pages/pharmacy/procurement/PharmacyInvoiceMatchPage';
import PharmacySupplierPaymentsPage from './pages/pharmacy/procurement/SupplierPaymentsPage';
import PharmacySupplierListPage from './pages/pharmacy/suppliers/PharmacySupplierListPage';
import PharmacyContractsPage from './pages/pharmacy/suppliers/PharmacyContractsPage';
import PharmacySupplierRatingsPage from './pages/pharmacy/suppliers/PharmacySupplierRatingsPage';
import PharmacyPriceListsPage from './pages/pharmacy/suppliers/PharmacyPriceListsPage';

// IPD Module Pages
import AdmissionsPage from './pages/ipd/AdmissionsPage';
import WardsBedsPage from './pages/ipd/WardsBedsPage';
import BHTIssuePage from './pages/ipd/BHTIssuePage';
import InpatientBillingPage from './pages/ipd/InpatientBillingPage';
import IPDNursingNotesPage from './pages/ipd/IPDNursingNotesPage';
import IPDTheatrePage from './pages/ipd/TheatrePage';
import IPDMaternityPage from './pages/ipd/MaternityPage';
import IPDDischargePage from './pages/ipd/DischargePage';
import IPDAnalyticsPage from './pages/ipd/IPDAnalyticsPage';

// Stores Module Pages
import MainInventoryPage from './pages/stores/MainInventoryPage';
import UnitIssuePage from './pages/stores/UnitIssuePage';
import StoreTransfersPage from './pages/stores/StoreTransfersPage';
import StoresProcurementPage from './pages/stores/StoresProcurementPage';
import StoresSupplierPage from './pages/stores/StoresSupplierPage';
import StoresExpiryPage from './pages/stores/StoresExpiryPage';
import StockAdjustmentsPage from './pages/stores/StockAdjustmentsPage';
import StockTakePage from './pages/stores/StockTakePage';
import StoresAssetRegisterPage from './pages/stores/AssetRegisterPage';
import MaintenanceSchedulePage from './pages/stores/MaintenanceSchedulePage';
import ConsumptionReportsPage from './pages/stores/ConsumptionReportsPage';
import StoresAnalyticsPage from './pages/stores/StoresAnalyticsPage';
import StoresRequisitionsPage from './pages/stores/StoresRequisitionsPage';
import StoresRFQPage from './pages/stores/StoresRFQPage';
import StoresCompareQuotesPage from './pages/stores/StoresCompareQuotesPage';
import StoresPOPage from './pages/stores/StoresPOPage';
import StoresGRNPage from './pages/stores/StoresGRNPage';
import StoresInvoiceMatchPage from './pages/stores/StoresInvoiceMatchPage';
import StoresSupplierContractsPage from './pages/stores/StoresSupplierContractsPage';
import StoresPaymentsPage from './pages/stores/StoresPaymentsPage';
import StoresDisposalPage from './pages/stores/StoresDisposalPage';
import ItemClassificationsPage from './pages/settings/ItemClassificationsPage';

// Admin - User Management
import UserListPage from './pages/admin/users/UserListPage';
import RolePermissionsPage from './pages/admin/users/RolePermissionsPage';
import UserActivityLogPage from './pages/admin/users/UserActivityLogPage';
import DepartmentAccessPage from './pages/admin/users/DepartmentAccessPage';
import SessionManagementPage from './pages/admin/users/SessionManagementPage';

// Admin - Services Management
import ServiceCatalogPage from './pages/admin/services/ServiceCatalogPage';
import PricingManagementPage from './pages/admin/services/PricingManagementPage';
import ServicePackagesPage from './pages/admin/services/ServicePackagesPage';
import DiscountSchemesPage from './pages/admin/services/DiscountSchemesPage';
import TaxConfigurationPage from './pages/admin/services/TaxConfigurationPage';

// Admin - HR Management
import StaffDirectoryPage from './pages/admin/hr/StaffDirectoryPage';
import AdminDepartmentsPage from './pages/admin/hr/DepartmentsPage';
import DesignationsPage from './pages/admin/hr/DesignationsPage';
import ShiftManagementPage from './pages/admin/hr/ShiftManagementPage';
import LeaveManagementPage from './pages/admin/hr/LeaveManagementPage';
import CredentialsPage from './pages/admin/hr/CredentialsPage';
import AttendancePage from './pages/admin/hr/AttendancePage';
import PayrollPage from './pages/admin/hr/PayrollPage';
import RecruitmentPage from './pages/admin/hr/RecruitmentPage';
import AppraisalsPage from './pages/admin/hr/AppraisalsPage';
import TrainingPage from './pages/admin/hr/TrainingPage';
import HRAnalyticsPage from './pages/admin/hr/HRAnalyticsPage';

// Admin - Lab Services
import TestCatalogPage from './pages/admin/lab/TestCatalogPage';
import LabEquipmentPage from './pages/admin/lab/LabEquipmentPage';
import ReagentsInventoryPage from './pages/admin/lab/ReagentsInventoryPage';
import LabPanelsPage from './pages/admin/lab/LabPanelsPage';

// Admin - Procurement Settings
import ApprovalWorkflowPage from './pages/admin/procurement/ApprovalWorkflowPage';
import BudgetManagementPage from './pages/admin/procurement/BudgetManagementPage';
import ProcurementPoliciesPage from './pages/admin/procurement/ProcurementPoliciesPage';
import ItemCategoriesPage from './pages/admin/procurement/ItemCategoriesPage';

// Admin - Inventory/Pharmacy Settings
import StoreLocationsPage from './pages/admin/inventory/StoreLocationsPage';
import ItemMasterPage from './pages/admin/inventory/ItemMasterPage';
import DrugFormularyPage from './pages/admin/inventory/DrugFormularyPage';
import DrugCategoriesPage from './pages/admin/inventory/DrugCategoriesPage';
import UnitOfMeasurePage from './pages/admin/inventory/UnitOfMeasurePage';
import ExpiryPoliciesPage from './pages/admin/inventory/ExpiryPoliciesPage';

// Admin - Site/Institution
import InstitutionProfilePage from './pages/admin/site/InstitutionProfilePage';
import BranchesPage from './pages/admin/site/BranchesPage';
import BuildingsFloorsPage from './pages/admin/site/BuildingsFloorsPage';
import SystemSettingsPage from './pages/admin/site/SystemSettingsPage';
import IntegrationsPage from './pages/admin/site/IntegrationsPage';

// Admin - Membership
import MembershipPlansPage from './pages/admin/membership/MembershipPlansPage';
import MembershipBenefitsPage from './pages/admin/membership/MembershipBenefitsPage';
import CorporatePlansPage from './pages/admin/membership/CorporatePlansPage';
import MembershipRulesPage from './pages/admin/membership/MembershipRulesPage';

// Admin - Finance Settings
import CurrenciesPage from './pages/admin/finance/CurrenciesPage';
import ExchangeRatesPage from './pages/admin/finance/ExchangeRatesPage';
import PaymentMethodsPage from './pages/admin/finance/PaymentMethodsPage';

// Sync Module Pages
import SyncStatusPage from './pages/sync/SyncStatusPage';
import OfflineQueuePage from './pages/sync/OfflineQueuePage';
import ConflictResolutionPage from './pages/sync/ConflictResolutionPage';

// Providers Module Pages
import ProviderDirectoryPage from './pages/providers/ProviderDirectoryPage';
import ProviderCredentialsPage from './pages/providers/ProviderCredentialsPage';

// Drug Management Pages
import DrugClassificationsPage from './pages/drug-management/DrugClassificationsPage';
import DrugInteractionsDatabasePage from './pages/drug-management/DrugInteractionsDatabasePage';
import AllergyClassesPage from './pages/drug-management/AllergyClassesPage';

// Supplier Finance Pages
import SupplierPaymentVouchersPage from './pages/supplier-finance/SupplierPaymentVouchersPage';
import SupplierCreditNotesPage from './pages/supplier-finance/SupplierCreditNotesPage';
import SupplierLedgerPage from './pages/supplier-finance/SupplierLedgerPage';

// MDM (Master Data Management) Pages
import MasterDataVersionsPage from './pages/mdm/MasterDataVersionsPage';
import MasterDataApprovalsPage from './pages/mdm/MasterDataApprovalsPage';
import ApprovalRulesPage from './pages/mdm/ApprovalRulesPage';

// Lab QC Pages
import LabQCDashboardPage from './pages/lab-qc/LabQCDashboardPage';
import LabConsumablesPage from './pages/lab-qc/LabConsumablesPage';

// Assets Pages
import AssetDepreciationPage from './pages/assets/AssetDepreciationPage';
import AssetTransfersPage from './pages/assets/AssetTransfersPage';
import AssetDisposalPage from './pages/assets/AssetDisposalPage';
import AssetRegisterPage from './pages/assets/AssetRegisterPage';
import AssetMaintenancePage from './pages/assets/AssetMaintenancePage';
import AssetReportsPage from './pages/assets/AssetReportsPage';
import AssetAllocationPage from './pages/assets/AssetAllocationPage';
import AssetTrackingPage from './pages/assets/AssetTrackingPage';
import AssetCategoriesPage from './pages/admin/AssetCategoriesPage';

// Chronic Care Pages
import ChronicCareDashboardPage from './pages/chronic-care/ChronicCareDashboardPage';
import ChronicRegistryPage from './pages/chronic-care/ChronicRegistryPage';
import ChronicRemindersPage from './pages/chronic-care/ChronicRemindersPage';
import NotificationSettingsPage from './pages/chronic-care/NotificationSettingsPage';

// Notification Pages
import NotificationHistoryPage from './pages/admin/notifications/NotificationHistoryPage';
import SmsTemplatesPage from './pages/admin/notifications/SmsTemplatesPage';
import BulkSmsPage from './pages/admin/notifications/BulkSmsPage';

// Reports Module Pages
import ReportsDashboardPage from './pages/reports/ReportsDashboardPage';
import PatientStatisticsReportPage from './pages/reports/PatientStatisticsReportPage';
import VisitReportsPage from './pages/reports/VisitReportsPage';
import DiseaseStatisticsPage from './pages/reports/DiseaseStatisticsPage';
import MortalityReportsPage from './pages/reports/MortalityReportsPage';
import RevenueReportsPage from './pages/reports/RevenueReportsPage';
import CollectionReportsPage from './pages/reports/CollectionReportsPage';
import OutstandingReportsPage from './pages/reports/OutstandingReportsPage';
import StockReportsPage from './pages/reports/StockReportsPage';
import ExpiryReportsPage from './pages/reports/ExpiryReportsPage';
import InventoryConsumptionReportsPage from './pages/reports/ConsumptionReportsPage';

// Integrations
import DrugDatabasePage from './pages/integrations/DrugDatabasePage';
import LabReferencePage from './pages/integrations/LabReferencePage';
import SMSNotificationsPage from './pages/integrations/SMSNotificationsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                
                {/* Registration - Patient Management */}
                <Route path="/patients/search" element={<ReceptionistRoute><PatientSearchPage /></ReceptionistRoute>} />
                <Route path="/patients/new" element={<ReceptionistRoute><PatientRegistrationPage /></ReceptionistRoute>} />
                <Route path="/patients/documents" element={<ReceptionistRoute><PatientDocumentsPage /></ReceptionistRoute>} />
                <Route path="/patients/history" element={<ReceptionistRoute><PatientHistoryPage /></ReceptionistRoute>} />
                <Route path="/patients/:id/edit" element={<ReceptionistRoute><PatientEditPage /></ReceptionistRoute>} />
                <Route path="/patients/:id" element={<ReceptionistRoute><PatientDetailPage /></ReceptionistRoute>} />
                <Route path="/patients" element={<ReceptionistRoute><PatientsPage /></ReceptionistRoute>} />
                
                {/* Registration - Queue & Tokens */}
                <Route path="/opd/token" element={<ReceptionistRoute><OPDTokenPage /></ReceptionistRoute>} />
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
                
                {/* Doctors - My Queue */}
                <Route path="/doctor/queue" element={<DoctorRoute><WaitingPatientsPage /></DoctorRoute>} />
                <Route path="/doctor/queue/call" element={<DoctorRoute><CallNextPage /></DoctorRoute>} />
                <Route path="/doctor/schedule" element={<DoctorRoute><TodaySchedulePage /></DoctorRoute>} />
                <Route path="/doctor/pending" element={<DoctorRoute><PendingReviewsPage /></DoctorRoute>} />
                
                {/* Doctors - Consultation */}
                <Route path="/encounters/new" element={<DoctorRoute><NewConsultationPage /></DoctorRoute>} />
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
                <Route path="/radiology/queue" element={<LabTechRoute><RadiologyQueuePage /></LabTechRoute>} />
                <Route path="/radiology/orders" element={<LabTechRoute><ImagingOrdersPage /></LabTechRoute>} />
                <Route path="/radiology/results" element={<LabTechRoute><RadiologyResultsPage /></LabTechRoute>} />
                <Route path="/radiology/analytics" element={<LabTechRoute><RadiologyAnalyticsPage /></LabTechRoute>} />
                
                {/* Pharmacy - Core */}
                <Route path="/pharmacy/dispense" element={<PharmacistRoute><DispenseMedicationPage /></PharmacistRoute>} />
                <Route path="/pharmacy/queue" element={<PharmacistRoute><PharmacyQueuePage /></PharmacistRoute>} />
                <Route path="/pharmacy/stock" element={<PharmacistRoute><PharmacyStockPage /></PharmacistRoute>} />
                <Route path="/pharmacy/returns" element={<PharmacistRoute><PharmacyReturnsPage /></PharmacistRoute>} />
                <Route path="/pharmacy/adjustments" element={<PharmacistRoute><PharmacyAdjustmentsPage /></PharmacistRoute>} />
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
                <Route path="/radiology" element={<LabTechRoute><RadiologyPage /></LabTechRoute>} />
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
                <Route path="/hr/training" element={<HRRoute><TrainingPage /></HRRoute>} />
                <Route path="/hr/analytics" element={<HRRoute><HRAnalyticsPage /></HRRoute>} />
                <Route path="/hr/my-payslips" element={<MyPayslipsPage />} />
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
                
                {/* Admin - HR Management */}
                <Route path="/admin/hr/staff" element={<HRRoute><StaffDirectoryPage /></HRRoute>} />
                <Route path="/admin/hr/departments" element={<HRRoute><AdminDepartmentsPage /></HRRoute>} />
                <Route path="/admin/hr/designations" element={<HRRoute><DesignationsPage /></HRRoute>} />
                <Route path="/admin/hr/shifts" element={<HRRoute><ShiftManagementPage /></HRRoute>} />
                <Route path="/admin/hr/leave" element={<HRRoute><LeaveManagementPage /></HRRoute>} />
                <Route path="/admin/hr/credentials" element={<HRRoute><CredentialsPage /></HRRoute>} />
                
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
                <Route path="/integrations/drugs" element={<ProtectedRoute><DrugDatabasePage /></ProtectedRoute>} />
                <Route path="/integrations/lab-reference" element={<ProtectedRoute><LabReferencePage /></ProtectedRoute>} />
                <Route path="/integrations/sms" element={<AdminRoute><SMSNotificationsPage /></AdminRoute>} />

                {/* Notifications Module */}
                <Route path="/notifications/settings" element={<AdminRoute><NotificationSettingsPage /></AdminRoute>} />
                <Route path="/notifications/templates" element={<AdminRoute><SmsTemplatesPage /></AdminRoute>} />
                <Route path="/notifications/history" element={<AdminRoute><NotificationHistoryPage /></AdminRoute>} />
                <Route path="/notifications/bulk" element={<AdminRoute><BulkSmsPage /></AdminRoute>} />

                {/* Reports Module */}
                <Route path="/reports" element={<ProtectedRoute><ReportsDashboardPage /></ProtectedRoute>} />
                <Route path="/reports/patients" element={<ProtectedRoute><PatientStatisticsReportPage /></ProtectedRoute>} />
                <Route path="/reports/visits" element={<ProtectedRoute><VisitReportsPage /></ProtectedRoute>} />
                <Route path="/reports/diseases" element={<ProtectedRoute><DiseaseStatisticsPage /></ProtectedRoute>} />
                <Route path="/reports/mortality" element={<ProtectedRoute><MortalityReportsPage /></ProtectedRoute>} />
                <Route path="/reports/revenue" element={<ProtectedRoute><RevenueReportsPage /></ProtectedRoute>} />
                <Route path="/reports/collections" element={<ProtectedRoute><CollectionReportsPage /></ProtectedRoute>} />
                <Route path="/reports/outstanding" element={<ProtectedRoute><OutstandingReportsPage /></ProtectedRoute>} />
                <Route path="/reports/stock" element={<ProtectedRoute><StockReportsPage /></ProtectedRoute>} />
                <Route path="/reports/expiry" element={<ProtectedRoute><ExpiryReportsPage /></ProtectedRoute>} />
                <Route path="/reports/consumption" element={<ProtectedRoute><InventoryConsumptionReportsPage /></ProtectedRoute>} />
                
                {/* 404 Catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
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
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton />
      <BrowserRouter>
        <SessionTimeoutWrapper>
          <AppRoutes />
        </SessionTimeoutWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
