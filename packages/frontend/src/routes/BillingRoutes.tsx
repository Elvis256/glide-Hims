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

export default function BillingRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/billing/invoices" replace />} />
      <Route path="opd/new" element={<ModuleRoute module="billing"><BillingRoute><NewOPDBillPage /></BillingRoute></ModuleRoute>} />
      <Route path="opd/orders" element={<ModuleRoute module="billing"><BillingRoute><OPDOrderingPage /></BillingRoute></ModuleRoute>} />
      <Route path="opd/packages" element={<ModuleRoute module="billing"><BillingRoute><PackageBillingPage /></BillingRoute></ModuleRoute>} />
      <Route path="opd/search" element={<ModuleRoute module="billing"><BillingRoute><SearchBillsPage /></BillingRoute></ModuleRoute>} />
      <Route path="invoices" element={<ModuleRoute module="billing"><BillingRoute><InvoicesPage /></BillingRoute></ModuleRoute>} />
      <Route path="invoices/:invoiceId" element={<ModuleRoute module="billing"><BillingRoute><InvoicesPage /></BillingRoute></ModuleRoute>} />
      <Route path="payments" element={<ModuleRoute module="billing"><BillingRoute><PaymentsPage /></BillingRoute></ModuleRoute>} />
      <Route path="patient-tab" element={<ModuleRoute module="billing"><BillingRoute><PatientTabPage /></BillingRoute></ModuleRoute>} />
      <Route path="patient-tab/:patientId" element={<ModuleRoute module="billing"><BillingRoute><PatientTabPage /></BillingRoute></ModuleRoute>} />
      <Route path="doctor-fees" element={<ModuleRoute module="billing"><BillingRoute><DoctorFeesPage /></BillingRoute></ModuleRoute>} />
      <Route path="admin/services/doctor-fees" element={<AdminRoute><DoctorFeesPage /></AdminRoute>} />
      <Route path="admin/audit-log" element={<AdminRoute><AuditLogViewerPage /></AdminRoute>} />
      <Route path="insurance/claims" element={<ModuleRoute module="billing"><InsuranceRoute><ClaimsPage /></InsuranceRoute></ModuleRoute>} />
      <Route path="insurance/providers" element={<ModuleRoute module="billing"><InsuranceRoute><InsuranceProvidersPage /></InsuranceRoute></ModuleRoute>} />
      <Route path="procurement/approvals" element={<ModuleRoute module="stores"><AdminRoute><ApprovalDashboardPage /></AdminRoute></ModuleRoute>} />
      <Route path="procurement/direct-po" element={<ModuleRoute module="stores"><StoreKeeperRoute><DirectPOPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/requisitions" element={<ModuleRoute module="stores"><StoreKeeperRoute><RequisitionsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/rfq" element={<ModuleRoute module="stores"><StoreKeeperRoute><RFQPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/quotes/compare" element={<ModuleRoute module="stores"><StoreKeeperRoute><CompareQuotesPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/quotes/approve" element={<ModuleRoute module="stores"><AdminRoute><ApproveQuotationsPage /></AdminRoute></ModuleRoute>} />
      <Route path="procurement/orders" element={<ModuleRoute module="stores"><StoreKeeperRoute><PurchaseOrdersPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/grn" element={<ModuleRoute module="stores"><StoreKeeperRoute><GoodsReceivedPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/invoices/match" element={<ModuleRoute module="stores"><AccountantRoute><InvoiceMatchingPage /></AccountantRoute></ModuleRoute>} />
      <Route path="procurement/trace" element={<ModuleRoute module="stores"><StoreKeeperRoute><ProcurementTracePage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/gl-integration" element={<ModuleRoute module="stores"><AccountantRoute><ProcurementGLIntegrationPage /></AccountantRoute></ModuleRoute>} />
      <Route path="procurement/analytics" element={<ModuleRoute module="stores"><StoreKeeperRoute><ProcurementAnalyticsDashboard /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/vendors" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorListPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/vendors/contracts" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorContractsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/vendors/ratings" element={<ModuleRoute module="stores"><StoreKeeperRoute><VendorRatingsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/vendors/prices" element={<ModuleRoute module="stores"><StoreKeeperRoute><PriceAgreementsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement/vendors/payments" element={<ModuleRoute module="stores"><AccountantRoute><VendorPaymentsPage /></AccountantRoute></ModuleRoute>} />
      <Route path="finance/accounts" element={<ModuleRoute module="finance"><FinanceRoute><AccountsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/journals" element={<ModuleRoute module="finance"><FinanceRoute><JournalEntriesPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/expenses" element={<ModuleRoute module="finance"><FinanceRoute><ExpensesPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/revenue" element={<ModuleRoute module="finance"><FinanceRoute><RevenuePage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/reports" element={<ModuleRoute module="finance"><FinanceRoute><FinancialReportsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/cost-centers" element={<ModuleRoute module="finance"><FinanceRoute><CostCentersPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/budgets" element={<ModuleRoute module="finance"><FinanceRoute><BudgetPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/bank-reconciliation" element={<ModuleRoute module="finance"><FinanceRoute><BankReconciliationPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/patient-finance" element={<ModuleRoute module="finance"><FinanceRoute><PatientFinancePage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/petty-cash" element={<ModuleRoute module="finance"><FinanceRoute><PettyCashPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/donor-funds" element={<ModuleRoute module="finance"><FinanceRoute><DonorFundsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/trial-balance" element={<ModuleRoute module="finance"><FinanceRoute><TrialBalancePage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/gl-trends" element={<ModuleRoute module="finance"><FinanceRoute><GLTrendAnalysisPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/revenue-dashboard" element={<ModuleRoute module="finance"><FinanceRoute><RevenueDashboardPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/budget-vs-actual" element={<ModuleRoute module="finance"><FinanceRoute><BudgetVsActualPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/custom-reports" element={<ModuleRoute module="finance"><FinanceRoute><CustomReportBuilderPage /></FinanceRoute></ModuleRoute>} />
      <Route path="finance/dashboard" element={<ModuleRoute module="finance"><FinanceRoute><FinanceDashboard /></FinanceRoute></ModuleRoute>} />
    </Routes>
  );
}
