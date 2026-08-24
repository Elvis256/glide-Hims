import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import RoleRoute, { 
  DoctorRoute, NurseRoute, ReceptionistRoute, ClinicalRoute, 
  PharmacistRoute, LabTechRoute, CashierRoute, StoreKeeperRoute, 
  AccountantRoute, AdminRoute, SystemAdminRoute, FinanceRoute, 
  HRRoute, BillingRoute, InsuranceRoute, RadiologyRoute, AssetsRoute 
} from '../components/RoleRoute';
import { ROLES } from '../components/RoleRoute';

// Lazy-loaded pages
const NewOPDBillPage = lazy(() => import('../pages/billing/opd/NewOPDBillPage'));
const OPDOrderingPage = lazy(() => import('../pages/billing/opd/OPDOrderingPage'));
const PackageBillingPage = lazy(() => import('../pages/billing/opd/PackageBillingPage'));
const SearchBillsPage = lazy(() => import('../pages/billing/opd/SearchBillsPage'));
const InvoicesPage = lazy(() => import('../pages/billing/InvoicesPage'));
const RefundsPage = lazy(() => import('../pages/RefundsPage'));
const PaymentsPage = lazy(() => import('../pages/billing/PaymentsPage'));
const PatientTabPage = lazy(() => import('../pages/billing/PatientTabPage'));
const DoctorFeesPage = lazy(() => import('../pages/billing/DoctorFeesPage'));
const AuditLogViewerPage = lazy(() => import('../pages/admin/AuditLogViewerPage'));
const ClaimsPage = lazy(() => import('../pages/billing/insurance/ClaimsPage'));
const InsuranceProvidersPage = lazy(() => import('../pages/billing/insurance/ProvidersPage'));
const ApprovalDashboardPage = lazy(() => import('../pages/billing/procurement/ApprovalDashboardPage'));
const DirectPOPage = lazy(() => import('../pages/billing/procurement/DirectPOPage'));
const RequisitionsPage = lazy(() => import('../pages/billing/procurement/RequisitionsPage'));
const RFQPage = lazy(() => import('../pages/billing/procurement/RFQPage'));
const CompareQuotesPage = lazy(() => import('../pages/billing/procurement/CompareQuotesPage'));
const ApproveQuotationsPage = lazy(() => import('../pages/billing/procurement/ApproveQuotationsPage'));
const PurchaseOrdersPage = lazy(() => import('../pages/billing/procurement/PurchaseOrdersPage'));
const GoodsReceivedPage = lazy(() => import('../pages/billing/procurement/GoodsReceivedPage'));
const InvoiceMatchingPage = lazy(() => import('../pages/billing/procurement/InvoiceMatchingPage'));
const ProcurementTracePage = lazy(() => import('../pages/billing/procurement/ProcurementTracePage'));
const ProcurementGLIntegrationPage = lazy(() => import('../pages/procurement/ProcurementGLIntegrationPage'));
const ProcurementAnalyticsDashboard = lazy(() => import('../pages/procurement/ProcurementAnalyticsDashboard'));
const VendorListPage = lazy(() => import('../pages/billing/vendors/VendorListPage'));
const VendorContractsPage = lazy(() => import('../pages/billing/vendors/VendorContractsPage'));
const VendorRatingsPage = lazy(() => import('../pages/billing/vendors/VendorRatingsPage'));
const PriceAgreementsPage = lazy(() => import('../pages/billing/vendors/PriceAgreementsPage'));
const VendorPaymentsPage = lazy(() => import('../pages/billing/vendors/VendorPaymentsPage'));
const AccountsPage = lazy(() => import('../pages/billing/finance/AccountsPage'));
const JournalEntriesPage = lazy(() => import('../pages/billing/finance/JournalEntriesPage'));
const ExpensesPage = lazy(() => import('../pages/billing/finance/ExpensesPage'));
const RevenuePage = lazy(() => import('../pages/billing/finance/RevenuePage'));
const FinancialReportsPage = lazy(() => import('../pages/billing/finance/FinancialReportsPage'));
const CostCentersPage = lazy(() => import('../pages/billing/finance/CostCentersPage'));
const BudgetPage = lazy(() => import('../pages/billing/finance/BudgetPage'));
const BankReconciliationPage = lazy(() => import('../pages/billing/finance/BankReconciliationPage'));
const PatientFinancePage = lazy(() => import('../pages/billing/finance/PatientFinancePage'));
const PettyCashPage = lazy(() => import('../pages/billing/finance/PettyCashPage'));
const DonorFundsPage = lazy(() => import('../pages/billing/finance/DonorFundsPage'));
const TrialBalancePage = lazy(() => import('../pages/billing/finance/TrialBalancePage'));
const GLTrendAnalysisPage = lazy(() => import('../pages/billing/finance/GLTrendAnalysisPage'));
const RevenueDashboardPage = lazy(() => import('../pages/billing/finance/RevenueDashboardPage'));
const BudgetVsActualPage = lazy(() => import('../pages/billing/finance/BudgetVsActualPage'));
const CustomReportBuilderPage = lazy(() => import('../pages/billing/finance/CustomReportBuilderPage'));
const FinanceDashboard = lazy(() => import('../pages/billing/finance/FinanceDashboard'));

/**
 * Finance screens, mounted at /finance/*.
 *
 * Same cause as ProcurementRoutes: defined under BillingRoutes, linked from the
 * sidebar as /finance/*, so all 11 Finance menu items opened a blank page.
 */
export default function FinanceRoutes() {
  return (
    <Routes>
      <Route path="accounts" element={<ModuleRoute module="finance"><FinanceRoute><AccountsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="journals" element={<ModuleRoute module="finance"><FinanceRoute><JournalEntriesPage /></FinanceRoute></ModuleRoute>} />
      <Route path="expenses" element={<ModuleRoute module="finance"><FinanceRoute><ExpensesPage /></FinanceRoute></ModuleRoute>} />
      <Route path="revenue" element={<ModuleRoute module="finance"><FinanceRoute><RevenuePage /></FinanceRoute></ModuleRoute>} />
      <Route path="reports" element={<ModuleRoute module="finance"><FinanceRoute><FinancialReportsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="cost-centers" element={<ModuleRoute module="finance"><FinanceRoute><CostCentersPage /></FinanceRoute></ModuleRoute>} />
      <Route path="budgets" element={<ModuleRoute module="finance"><FinanceRoute><BudgetPage /></FinanceRoute></ModuleRoute>} />
      <Route path="bank-reconciliation" element={<ModuleRoute module="finance"><FinanceRoute><BankReconciliationPage /></FinanceRoute></ModuleRoute>} />
      <Route path="patient-finance" element={<ModuleRoute module="finance"><FinanceRoute><PatientFinancePage /></FinanceRoute></ModuleRoute>} />
      <Route path="petty-cash" element={<ModuleRoute module="finance"><FinanceRoute><PettyCashPage /></FinanceRoute></ModuleRoute>} />
      <Route path="donor-funds" element={<ModuleRoute module="finance"><FinanceRoute><DonorFundsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="trial-balance" element={<ModuleRoute module="finance"><FinanceRoute><TrialBalancePage /></FinanceRoute></ModuleRoute>} />
      <Route path="gl-trends" element={<ModuleRoute module="finance"><FinanceRoute><GLTrendAnalysisPage /></FinanceRoute></ModuleRoute>} />
      <Route path="revenue-dashboard" element={<ModuleRoute module="finance"><FinanceRoute><RevenueDashboardPage /></FinanceRoute></ModuleRoute>} />
      <Route path="budget-vs-actual" element={<ModuleRoute module="finance"><FinanceRoute><BudgetVsActualPage /></FinanceRoute></ModuleRoute>} />
      <Route path="custom-reports" element={<ModuleRoute module="finance"><FinanceRoute><CustomReportBuilderPage /></FinanceRoute></ModuleRoute>} />
      <Route path="dashboard" element={<ModuleRoute module="finance"><FinanceRoute><FinanceDashboard /></FinanceRoute></ModuleRoute>} />
    </Routes>
  );
}
