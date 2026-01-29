import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import ProtectedRoute from './components/ProtectedRoute';
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
import AssetRegisterPage from './pages/stores/AssetRegisterPage';
import MaintenanceSchedulePage from './pages/stores/MaintenanceSchedulePage';
import ConsumptionReportsPage from './pages/stores/ConsumptionReportsPage';
import StoresAnalyticsPage from './pages/stores/StoresAnalyticsPage';

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
                <Route path="/patients/search" element={<PatientSearchPage />} />
                <Route path="/patients/new" element={<PatientRegistrationPage />} />
                <Route path="/patients/documents" element={<PatientDocumentsPage />} />
                <Route path="/patients/history" element={<PatientHistoryPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                
                {/* Registration - Queue & Tokens */}
                <Route path="/opd/token" element={<OPDTokenPage />} />
                <Route path="/queue/monitor" element={<QueueMonitorPage />} />
                <Route path="/queue/call" element={<CallNextPatientPage />} />
                <Route path="/queue/analytics" element={<QueueAnalyticsPage />} />
                <Route path="/queue" element={<QueueManagementPage />} />
                <Route path="/triage" element={<QueueManagementPage />} />
                
                {/* Registration - Channelling/Appointments */}
                <Route path="/appointments/new" element={<BookAppointmentPage />} />
                <Route path="/appointments" element={<ViewAppointmentsPage />} />
                <Route path="/schedules/doctors" element={<DoctorSchedulesPage />} />
                <Route path="/appointments/manage" element={<ManageAppointmentsPage />} />
                
                {/* Registration - Reception Billing */}
                <Route path="/billing/reception/new" element={<NewBillPage />} />
                <Route path="/billing/reception/payment" element={<CollectPaymentPage />} />
                <Route path="/billing/reception/receipt" element={<PrintReceiptPage />} />
                <Route path="/billing/reception/pending" element={<PendingPaymentsPage />} />
                <Route path="/billing/reception/refunds" element={<RefundsPage />} />
                
                {/* Registration - Insurance Desk */}
                <Route path="/insurance/verify" element={<VerifyCoveragePage />} />
                <Route path="/insurance/preauth" element={<PreAuthorizationPage />} />
                <Route path="/insurance/submit" element={<ClaimSubmissionPage />} />
                <Route path="/insurance/cards" element={<InsuranceCardsPage />} />
                
                {/* Registration - Reports */}
                <Route path="/reports/registration/daily" element={<RegistrationDailySummaryPage />} />
                <Route path="/reports/registration/patients" element={<PatientStatisticsPage />} />
                <Route path="/reports/registration/revenue" element={<RegistrationRevenuePage />} />
                <Route path="/reports/registration/queue" element={<QueuePerformancePage />} />
                
                {/* Nursing - Patient Vitals */}
                <Route path="/nursing/vitals/new" element={<RecordVitalsPage />} />
                <Route path="/nursing/vitals/history" element={<VitalsHistoryPage />} />
                <Route path="/nursing/vitals/trends" element={<VitalTrendsPage />} />
                <Route path="/nursing/vitals/alerts" element={<AbnormalAlertsPage />} />
                
                {/* Nursing - Triage & Assessment */}
                <Route path="/nursing/triage" element={<TriageQueuePage />} />
                <Route path="/nursing/assessment" element={<NursingAssessmentPage />} />
                <Route path="/nursing/pain" element={<PainAssessmentPage />} />
                <Route path="/nursing/fall-risk" element={<FallRiskPage />} />
                
                {/* Nursing - Medication */}
                <Route path="/nursing/meds/schedule" element={<MedicationSchedulePage />} />
                <Route path="/nursing/meds/administer" element={<AdministerMedsPage />} />
                <Route path="/nursing/meds/chart" element={<MedicationChartPage />} />
                <Route path="/nursing/meds/allergies" element={<DrugAllergiesPage />} />
                
                {/* Nursing - Wound Care */}
                <Route path="/nursing/wounds/assess" element={<WoundAssessmentPage />} />
                <Route path="/nursing/wounds/dressing" element={<DressingLogPage />} />
                <Route path="/nursing/wounds/progress" element={<WoundProgressPage />} />
                
                {/* Nursing - Patient Care */}
                <Route path="/nursing/care-plans" element={<CarePlansPage />} />
                <Route path="/nursing/notes" element={<NursingNotesPage />} />
                <Route path="/nursing/handover" element={<ShiftHandoverPage />} />
                <Route path="/nursing/education" element={<PatientEducationPage />} />
                
                {/* Nursing - Procedures */}
                <Route path="/nursing/procedures/iv" element={<IVCannulationPage />} />
                <Route path="/nursing/procedures/catheter" element={<CatheterizationPage />} />
                <Route path="/nursing/procedures/specimen" element={<SpecimenCollectionPage />} />
                <Route path="/nursing/procedures/log" element={<ProcedureLogPage />} />
                
                {/* Nursing - Monitoring */}
                <Route path="/nursing/monitor" element={<PatientMonitorPage />} />
                <Route path="/nursing/io" element={<IntakeOutputPage />} />
                <Route path="/nursing/glucose" element={<BloodSugarPage />} />
                <Route path="/nursing/observations" element={<ObservationChartPage />} />
                
                {/* Nursing - Reports */}
                <Route path="/nursing/reports/daily" element={<NursingDailyReportPage />} />
                <Route path="/nursing/reports/shift" element={<ShiftSummaryPage />} />
                <Route path="/nursing/reports/incident" element={<IncidentReportPage />} />
                <Route path="/nursing/reports/workload" element={<WorkloadStatsPage />} />
                
                {/* Doctors - My Queue */}
                <Route path="/doctor/queue" element={<WaitingPatientsPage />} />
                <Route path="/doctor/queue/call" element={<CallNextPage />} />
                <Route path="/doctor/schedule" element={<TodaySchedulePage />} />
                <Route path="/doctor/pending" element={<PendingReviewsPage />} />
                
                {/* Doctors - Consultation */}
                <Route path="/encounters/new" element={<NewConsultationPage />} />
                <Route path="/doctor/soap" element={<SOAPNotesPage />} />
                <Route path="/doctor/notes" element={<ClinicalNotesPage />} />
                <Route path="/encounters" element={<EncountersPage />} />
                
                {/* Doctors - Diagnosis */}
                <Route path="/doctor/diagnosis/icd" element={<ICD10CodingPage />} />
                <Route path="/doctor/diagnosis/differential" element={<DifferentialDxPage />} />
                <Route path="/doctor/diagnosis/problems" element={<ProblemListPage />} />
                
                {/* Doctors - Prescriptions */}
                <Route path="/doctor/prescriptions/new" element={<WritePrescriptionPage />} />
                <Route path="/doctor/prescriptions" element={<PrescriptionHistoryPage />} />
                <Route path="/doctor/prescriptions/interactions" element={<DrugInteractionsPage />} />
                <Route path="/doctor/prescriptions/favorites" element={<FavoriteRxPage />} />
                
                {/* Doctors - Orders */}
                <Route path="/doctor/orders/lab" element={<LabOrdersPage />} />
                <Route path="/doctor/orders/radiology" element={<RadiologyOrdersPage />} />
                <Route path="/doctor/orders/procedures" element={<ProcedureOrdersPage />} />
                <Route path="/doctor/orders/sets" element={<OrderSetsPage />} />
                
                {/* Doctors - Results Review */}
                <Route path="/doctor/results/lab" element={<LabResultsPage />} />
                <Route path="/doctor/results/imaging" element={<ImagingResultsPage />} />
                <Route path="/doctor/results/critical" element={<CriticalValuesPage />} />
                
                {/* Doctors - Referrals */}
                <Route path="/referrals/new" element={<NewReferralPage />} />
                <Route path="/referrals/sent" element={<SentReferralsPage />} />
                <Route path="/referrals/received" element={<ReferralsPage />} />
                
                {/* Doctors - Certificates */}
                <Route path="/doctor/certificates/medical" element={<MedicalCertificatePage />} />
                <Route path="/doctor/certificates/sick-leave" element={<SickLeavePage />} />
                <Route path="/doctor/certificates/fitness" element={<FitnessCertificatePage />} />
                <Route path="/doctor/certificates/death" element={<DeathCertificatePage />} />
                
                {/* Doctors - Follow-up */}
                <Route path="/follow-ups/new" element={<ScheduleFollowUpPage />} />
                <Route path="/follow-ups" element={<FollowUpsPage />} />
                <Route path="/follow-ups/overdue" element={<OverdueFollowUpsPage />} />
                
                {/* Billing - OPD */}
                <Route path="/billing/opd/new" element={<NewOPDBillPage />} />
                <Route path="/billing/opd/orders" element={<OPDOrderingPage />} />
                <Route path="/billing/opd/packages" element={<PackageBillingPage />} />
                <Route path="/billing/opd/search" element={<SearchBillsPage />} />
                
                {/* Billing - Core */}
                <Route path="/billing/invoices" element={<InvoicesPage />} />
                <Route path="/billing/payments" element={<PaymentsPage />} />
                
                {/* Billing - Insurance */}
                <Route path="/insurance/claims" element={<ClaimsPage />} />
                <Route path="/insurance/providers" element={<InsuranceProvidersPage />} />
                
                {/* Billing - Procurement */}
                <Route path="/procurement/requisitions" element={<RequisitionsPage />} />
                <Route path="/procurement/rfq" element={<RFQPage />} />
                <Route path="/procurement/quotes/compare" element={<CompareQuotesPage />} />
                <Route path="/procurement/quotes/approve" element={<ApproveQuotationsPage />} />
                <Route path="/procurement/orders" element={<PurchaseOrdersPage />} />
                <Route path="/procurement/grn" element={<GoodsReceivedPage />} />
                <Route path="/procurement/invoices/match" element={<InvoiceMatchingPage />} />
                
                {/* Billing - Vendors */}
                <Route path="/procurement/vendors" element={<VendorListPage />} />
                <Route path="/procurement/vendors/contracts" element={<VendorContractsPage />} />
                <Route path="/procurement/vendors/ratings" element={<VendorRatingsPage />} />
                <Route path="/procurement/vendors/prices" element={<PriceAgreementsPage />} />
                <Route path="/procurement/vendors/payments" element={<VendorPaymentsPage />} />
                
                {/* Billing - Finance */}
                <Route path="/finance/accounts" element={<AccountsPage />} />
                <Route path="/finance/journals" element={<JournalEntriesPage />} />
                <Route path="/finance/expenses" element={<ExpensesPage />} />
                <Route path="/finance/revenue" element={<RevenuePage />} />
                <Route path="/finance/reports" element={<FinancialReportsPage />} />
                
                {/* Emergency Module */}
                <Route path="/emergency/queue" element={<EmergencyQueuePage />} />
                <Route path="/emergency/ambulance" element={<AmbulanceTrackingPage />} />
                <Route path="/emergency/triage" element={<EmergencyTriagePage />} />
                <Route path="/emergency/billing" element={<EmergencyBillingPage />} />
                
                {/* Laboratory Module */}
                <Route path="/lab/queue" element={<LabQueuePage />} />
                <Route path="/lab/samples" element={<SampleCollectionPage />} />
                <Route path="/lab/results" element={<ResultsEntryPage />} />
                <Route path="/lab/reports" element={<LabReportsPage />} />
                <Route path="/lab/analytics" element={<LabAnalyticsPage />} />
                
                {/* Radiology Module */}
                <Route path="/radiology/queue" element={<RadiologyQueuePage />} />
                <Route path="/radiology/orders" element={<ImagingOrdersPage />} />
                <Route path="/radiology/results" element={<RadiologyResultsPage />} />
                <Route path="/radiology/analytics" element={<RadiologyAnalyticsPage />} />
                
                {/* Pharmacy - Core */}
                <Route path="/pharmacy/dispense" element={<DispenseMedicationPage />} />
                <Route path="/pharmacy/queue" element={<PharmacyQueuePage />} />
                <Route path="/pharmacy/stock" element={<PharmacyStockPage />} />
                <Route path="/pharmacy/returns" element={<PharmacyReturnsPage />} />
                <Route path="/pharmacy/adjustments" element={<PharmacyAdjustmentsPage />} />
                <Route path="/pharmacy/analytics" element={<PharmacyAnalyticsPage />} />
                
                {/* Pharmacy - Transactions */}
                <Route path="/pharmacy/retail" element={<RetailSalesPage />} />
                <Route path="/pharmacy/wholesale" element={<WholesalePage />} />
                <Route path="/pharmacy/inpatient" element={<InpatientMedsPage />} />
                
                {/* Pharmacy - Expiry Management */}
                <Route path="/pharmacy/expiry/soon" element={<ExpiringSoonPage />} />
                <Route path="/pharmacy/expiry/expired" element={<ExpiredItemsPage />} />
                <Route path="/pharmacy/expiry/alerts" element={<ExpiryAlertsPage />} />
                <Route path="/pharmacy/expiry/disposal" element={<DisposalLogPage />} />
                <Route path="/pharmacy/expiry/return" element={<ReturnToSupplierPage />} />
                
                {/* Pharmacy - Procurement */}
                <Route path="/pharmacy/requisitions" element={<PharmacyRequisitionsPage />} />
                <Route path="/pharmacy/rfq" element={<PharmacyRFQPage />} />
                <Route path="/pharmacy/quotes/compare" element={<PharmacyCompareQuotesPage />} />
                <Route path="/pharmacy/po" element={<PharmacyPOPage />} />
                <Route path="/pharmacy/grn" element={<PharmacyGRNPage />} />
                <Route path="/pharmacy/invoices/match" element={<PharmacyInvoiceMatchPage />} />
                <Route path="/pharmacy/supplier-payments" element={<PharmacySupplierPaymentsPage />} />
                
                {/* Pharmacy - Suppliers */}
                <Route path="/pharmacy/suppliers" element={<PharmacySupplierListPage />} />
                <Route path="/pharmacy/suppliers/contracts" element={<PharmacyContractsPage />} />
                <Route path="/pharmacy/suppliers/ratings" element={<PharmacySupplierRatingsPage />} />
                <Route path="/pharmacy/suppliers/prices" element={<PharmacyPriceListsPage />} />
                
                {/* IPD Module */}
                <Route path="/ipd/admissions" element={<AdmissionsPage />} />
                <Route path="/ipd/wards" element={<WardsBedsPage />} />
                <Route path="/ipd/bht" element={<BHTIssuePage />} />
                <Route path="/ipd/billing" element={<InpatientBillingPage />} />
                <Route path="/ipd/nursing" element={<IPDNursingNotesPage />} />
                <Route path="/ipd/theatre" element={<IPDTheatrePage />} />
                <Route path="/ipd/maternity" element={<IPDMaternityPage />} />
                <Route path="/ipd/discharge" element={<IPDDischargePage />} />
                <Route path="/ipd/analytics" element={<IPDAnalyticsPage />} />
                
                {/* Stores Module */}
                <Route path="/stores/main" element={<MainInventoryPage />} />
                <Route path="/stores/issue" element={<UnitIssuePage />} />
                <Route path="/stores/transfers" element={<StoreTransfersPage />} />
                <Route path="/stores/procurement" element={<StoresProcurementPage />} />
                <Route path="/stores/suppliers" element={<StoresSupplierPage />} />
                <Route path="/stores/expiry" element={<StoresExpiryPage />} />
                <Route path="/stores/adjustments" element={<StockAdjustmentsPage />} />
                <Route path="/stores/stock-take" element={<StockTakePage />} />
                <Route path="/stores/assets" element={<AssetRegisterPage />} />
                <Route path="/stores/maintenance" element={<MaintenanceSchedulePage />} />
                <Route path="/stores/consumption" element={<ConsumptionReportsPage />} />
                <Route path="/stores/analytics" element={<StoresAnalyticsPage />} />
                
                {/* OPD */}
                <Route path="/encounters/:id" element={<EncounterDetailPage />} />
                {/* Clinical */}
                <Route path="/pharmacy" element={<PharmacyPage />} />
                <Route path="/cashier" element={<CashierPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/lab" element={<LabPage />} />
                <Route path="/radiology" element={<RadiologyPage />} />
                <Route path="/wards" element={<WardManagementPage />} />
                <Route path="/emergency" element={<EmergencyPage />} />
                <Route path="/theatre" element={<IPDTheatrePage />} />
                <Route path="/maternity" element={<IPDMaternityPage />} />
                {/* Admin & Finance */}
                <Route path="/hr" element={<HRPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/insurance" element={<InsurancePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/membership" element={<MembershipPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/stores" element={<MainInventoryPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/vitals" element={<VitalsPage />} />
                <Route path="/clinical-notes" element={<ClinicalNotesPage />} />
                <Route path="/referrals" element={<ReferralsPage />} />
                <Route path="/treatment-plans" element={<TreatmentPlansPage />} />
                <Route path="/discharge" element={<IPDDischargePage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/facilities" element={<FacilitiesPage />} />
                <Route path="/roles" element={<RolesPage />} />
                
                {/* Admin - User Management */}
                <Route path="/admin/users" element={<UserListPage />} />
                <Route path="/admin/roles" element={<RolePermissionsPage />} />
                <Route path="/admin/users/activity" element={<UserActivityLogPage />} />
                <Route path="/admin/users/departments" element={<DepartmentAccessPage />} />
                <Route path="/admin/users/sessions" element={<SessionManagementPage />} />
                
                {/* Admin - Services Management */}
                <Route path="/admin/services" element={<ServiceCatalogPage />} />
                <Route path="/admin/services/pricing" element={<PricingManagementPage />} />
                <Route path="/admin/services/packages" element={<ServicePackagesPage />} />
                <Route path="/admin/services/discounts" element={<DiscountSchemesPage />} />
                <Route path="/admin/services/tax" element={<TaxConfigurationPage />} />
                
                {/* Admin - HR Management */}
                <Route path="/admin/hr/staff" element={<StaffDirectoryPage />} />
                <Route path="/admin/hr/departments" element={<AdminDepartmentsPage />} />
                <Route path="/admin/hr/designations" element={<DesignationsPage />} />
                <Route path="/admin/hr/shifts" element={<ShiftManagementPage />} />
                <Route path="/admin/hr/leave" element={<LeaveManagementPage />} />
                <Route path="/admin/hr/credentials" element={<CredentialsPage />} />
                
                {/* Admin - Lab Services */}
                <Route path="/admin/lab/tests" element={<TestCatalogPage />} />
                <Route path="/admin/lab/equipment" element={<LabEquipmentPage />} />
                <Route path="/admin/lab/reagents" element={<ReagentsInventoryPage />} />
                <Route path="/admin/lab/panels" element={<LabPanelsPage />} />
                
                {/* Admin - Procurement Settings */}
                <Route path="/admin/procurement/approvals" element={<ApprovalWorkflowPage />} />
                <Route path="/admin/procurement/budgets" element={<BudgetManagementPage />} />
                <Route path="/admin/procurement/policies" element={<ProcurementPoliciesPage />} />
                <Route path="/admin/procurement/categories" element={<ItemCategoriesPage />} />
                
                {/* Admin - Inventory/Pharmacy Settings */}
                <Route path="/admin/stores/locations" element={<StoreLocationsPage />} />
                <Route path="/admin/stores/items" element={<ItemMasterPage />} />
                <Route path="/admin/pharmacy/formulary" element={<DrugFormularyPage />} />
                <Route path="/admin/pharmacy/categories" element={<DrugCategoriesPage />} />
                <Route path="/admin/inventory/units" element={<UnitOfMeasurePage />} />
                <Route path="/admin/inventory/expiry" element={<ExpiryPoliciesPage />} />
                
                {/* Admin - Site/Institution */}
                <Route path="/admin/site/profile" element={<InstitutionProfilePage />} />
                <Route path="/admin/site/branches" element={<BranchesPage />} />
                <Route path="/admin/site/buildings" element={<BuildingsFloorsPage />} />
                <Route path="/admin/site/settings" element={<SystemSettingsPage />} />
                <Route path="/admin/site/integrations" element={<IntegrationsPage />} />
                
                {/* Admin - Membership */}
                <Route path="/admin/membership/plans" element={<MembershipPlansPage />} />
                <Route path="/admin/membership/benefits" element={<MembershipBenefitsPage />} />
                <Route path="/admin/membership/corporate" element={<CorporatePlansPage />} />
                <Route path="/admin/membership/rules" element={<MembershipRulesPage />} />
                
                {/* Admin - Finance Settings */}
                <Route path="/admin/finance/currencies" element={<CurrenciesPage />} />
                <Route path="/admin/finance/exchange-rates" element={<ExchangeRatesPage />} />
                <Route path="/admin/finance/payment-methods" element={<PaymentMethodsPage />} />
                
                {/* Sync Module */}
                <Route path="/sync/status" element={<SyncStatusPage />} />
                <Route path="/sync/queue" element={<OfflineQueuePage />} />
                <Route path="/sync/conflicts" element={<ConflictResolutionPage />} />
                
                {/* Providers Module */}
                <Route path="/providers/directory" element={<ProviderDirectoryPage />} />
                <Route path="/providers/credentials" element={<ProviderCredentialsPage />} />
                
                {/* Drug Management */}
                <Route path="/drug-management/classifications" element={<DrugClassificationsPage />} />
                <Route path="/drug-management/interactions" element={<DrugInteractionsDatabasePage />} />
                <Route path="/drug-management/allergy-classes" element={<AllergyClassesPage />} />
                
                {/* Supplier Finance */}
                <Route path="/supplier-finance/payment-vouchers" element={<SupplierPaymentVouchersPage />} />
                <Route path="/supplier-finance/credit-notes" element={<SupplierCreditNotesPage />} />
                <Route path="/supplier-finance/ledger" element={<SupplierLedgerPage />} />
                
                {/* MDM (Master Data Management) */}
                <Route path="/mdm/versions" element={<MasterDataVersionsPage />} />
                <Route path="/mdm/approvals" element={<MasterDataApprovalsPage />} />
                <Route path="/mdm/rules" element={<ApprovalRulesPage />} />
                
                {/* Lab QC */}
                <Route path="/lab-qc/dashboard" element={<LabQCDashboardPage />} />
                <Route path="/lab-qc/consumables" element={<LabConsumablesPage />} />
                
                {/* Assets Module */}
                <Route path="/assets/depreciation" element={<AssetDepreciationPage />} />
                <Route path="/assets/transfers" element={<AssetTransfersPage />} />
                <Route path="/assets/disposal" element={<AssetDisposalPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
