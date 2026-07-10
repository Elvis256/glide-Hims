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
const AdminAnalyticsDashboardPage = lazy(() => import('../pages/admin/AdminAnalyticsDashboardPage'));
const UserListPage = lazy(() => import('../pages/admin/users/UserListPage'));
const RolePermissionsPage = lazy(() => import('../pages/admin/users/RolePermissionsPage'));
const UserActivityLogPage = lazy(() => import('../pages/admin/users/UserActivityLogPage'));
const DepartmentAccessPage = lazy(() => import('../pages/admin/users/DepartmentAccessPage'));
const SessionManagementPage = lazy(() => import('../pages/admin/users/SessionManagementPage'));
const BulkUserImportPage = lazy(() => import('../pages/admin/users/BulkUserImportPage'));
const ServiceCatalogPage = lazy(() => import('../pages/admin/services/ServiceCatalogPage'));
const PricingManagementPage = lazy(() => import('../pages/admin/services/PricingManagementPage'));
const ServicePackagesPage = lazy(() => import('../pages/admin/services/ServicePackagesPage'));
const DiscountSchemesPage = lazy(() => import('../pages/admin/services/DiscountSchemesPage'));
const TaxConfigurationPage = lazy(() => import('../pages/admin/services/TaxConfigurationPage'));
const InsurancePriceListsPage = lazy(() => import('../pages/admin/pricing/InsurancePriceListsPage'));
const TestCatalogPage = lazy(() => import('../pages/admin/lab/TestCatalogPage'));
const LabEquipmentPage = lazy(() => import('../pages/admin/lab/LabEquipmentPage'));
const ReagentsInventoryPage = lazy(() => import('../pages/admin/lab/ReagentsInventoryPage'));
const LabPanelsPage = lazy(() => import('../pages/admin/lab/LabPanelsPage'));
const ApprovalWorkflowPage = lazy(() => import('../pages/admin/procurement/ApprovalWorkflowPage'));
const OrgApprovalAdminPage = lazy(() => import('../pages/admin/procurement/OrgApprovalAdminPage'));
const HROrganisationPage = lazy(() => import('../pages/admin/hr/HROrganisationPage'));
const BudgetManagementPage = lazy(() => import('../pages/admin/procurement/BudgetManagementPage'));
const ProcurementPoliciesPage = lazy(() => import('../pages/admin/procurement/ProcurementPoliciesPage'));
const ItemCategoriesPage = lazy(() => import('../pages/admin/procurement/ItemCategoriesPage'));
const StoreLocationsPage = lazy(() => import('../pages/admin/inventory/StoreLocationsPage'));
const ItemMasterPage = lazy(() => import('../pages/admin/inventory/ItemMasterPage'));
const DrugFormularyPage = lazy(() => import('../pages/admin/inventory/DrugFormularyPage'));
const DrugCategoriesPage = lazy(() => import('../pages/admin/inventory/DrugCategoriesPage'));
const UnitOfMeasurePage = lazy(() => import('../pages/admin/inventory/UnitOfMeasurePage'));
const ExpiryPoliciesPage = lazy(() => import('../pages/admin/inventory/ExpiryPoliciesPage'));
const InstitutionProfilePage = lazy(() => import('../pages/admin/site/InstitutionProfilePage'));
const BranchesPage = lazy(() => import('../pages/admin/site/BranchesPage'));
const BuildingsFloorsPage = lazy(() => import('../pages/admin/site/BuildingsFloorsPage'));
const SystemSettingsPage = lazy(() => import('../pages/admin/site/SystemSettingsPage'));
const FacilityModePage = lazy(() => import('../pages/admin/site/FacilityModePage'));
const IntegrationsPage = lazy(() => import('../pages/admin/site/IntegrationsPage'));
const LicenseSubscriptionPage = lazy(() => import('../pages/admin/site/LicenseSubscriptionPage'));
const BackupManagementPage = lazy(() => import('../pages/admin/BackupManagementPage'));
const TrashRecoveryPage = lazy(() => import('../pages/admin/TrashRecoveryPage'));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage'));
const PasswordPoliciesPage = lazy(() => import('../pages/admin/PasswordPoliciesPage'));
const JobMonitorPage = lazy(() => import('../pages/admin/JobMonitorPage'));
const WebhooksPage = lazy(() => import('../pages/admin/WebhooksPage'));
const EmailTemplatesPage = lazy(() => import('../pages/admin/EmailTemplatesPage'));
const SsoConfigPage = lazy(() => import('../pages/admin/SsoConfigPage'));
const EfrisConfigPage = lazy(() => import('../pages/admin/EfrisConfigPage'));
const EmployeeGoalsPage = lazy(() => import('../pages/admin/hr/EmployeeGoalsPage'));
const PIPManagementPage = lazy(() => import('../pages/admin/hr/PIPManagementPage'));
const LetterTemplatesPage = lazy(() => import('../pages/admin/hr/LetterTemplatesPage'));
const OrgChartPage = lazy(() => import('../pages/admin/hr/OrgChartPage'));
const LeaveDashboardPage = lazy(() => import('../pages/admin/hr/LeaveDashboardPage'));
const SupportAccessPage = lazy(() => import('../pages/admin/SupportAccessPage'));
const MembershipPlansPage = lazy(() => import('../pages/admin/membership/MembershipPlansPage'));
const MembershipBenefitsPage = lazy(() => import('../pages/admin/membership/MembershipBenefitsPage'));
const CorporatePlansPage = lazy(() => import('../pages/admin/membership/CorporatePlansPage'));
const MembershipRulesPage = lazy(() => import('../pages/admin/membership/MembershipRulesPage'));
const CurrenciesPage = lazy(() => import('../pages/admin/finance/CurrenciesPage'));
const ExchangeRatesPage = lazy(() => import('../pages/admin/finance/ExchangeRatesPage'));
const PaymentMethodsPage = lazy(() => import('../pages/admin/finance/PaymentMethodsPage'));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/admin/analytics" replace />} />
      <Route path="analytics" element={<AdminRoute><AdminAnalyticsDashboardPage /></AdminRoute>} />
      <Route path="users" element={<AdminRoute><UserListPage /></AdminRoute>} />
      <Route path="roles" element={<AdminRoute><RolePermissionsPage /></AdminRoute>} />
      <Route path="users/activity" element={<AdminRoute><UserActivityLogPage /></AdminRoute>} />
      <Route path="users/departments" element={<AdminRoute><DepartmentAccessPage /></AdminRoute>} />
      <Route path="users/sessions" element={<AdminRoute><SessionManagementPage /></AdminRoute>} />
      <Route path="users/bulk-import" element={<AdminRoute><BulkUserImportPage /></AdminRoute>} />
      <Route path="services" element={<AdminRoute><ServiceCatalogPage /></AdminRoute>} />
      <Route path="services/pricing" element={<AdminRoute><PricingManagementPage /></AdminRoute>} />
      <Route path="services/packages" element={<AdminRoute><ServicePackagesPage /></AdminRoute>} />
      <Route path="services/discounts" element={<AdminRoute><DiscountSchemesPage /></AdminRoute>} />
      <Route path="services/tax" element={<AdminRoute><TaxConfigurationPage /></AdminRoute>} />
      <Route path="pricing/insurance" element={<AdminRoute><InsurancePriceListsPage /></AdminRoute>} />
      <Route path="hr/staff" element={<Navigate to="/hr/staff" replace />} />
      <Route path="hr/departments" element={<Navigate to="/hr/departments" replace />} />
      <Route path="hr/designations" element={<Navigate to="/hr/designations" replace />} />
      <Route path="hr/shifts" element={<Navigate to="/hr/shifts" replace />} />
      <Route path="hr/leave" element={<Navigate to="/hr/leave" replace />} />
      <Route path="hr/credentials" element={<Navigate to="/hr/credentials" replace />} />
      <Route path="hr/attendance" element={<Navigate to="/hr/attendance" replace />} />
      <Route path="hr/payroll" element={<Navigate to="/hr/payroll" replace />} />
      <Route path="hr/recruitment" element={<Navigate to="/hr/recruitment" replace />} />
      <Route path="hr/appraisals" element={<Navigate to="/hr/appraisals" replace />} />
      <Route path="hr/training" element={<Navigate to="/hr/training" replace />} />
      <Route path="hr/analytics" element={<Navigate to="/hr/analytics" replace />} />
      <Route path="lab/tests" element={<AdminRoute><TestCatalogPage /></AdminRoute>} />
      <Route path="lab/tests/:testId" element={<AdminRoute><TestCatalogPage /></AdminRoute>} />
      <Route path="lab/equipment" element={<AdminRoute><LabEquipmentPage /></AdminRoute>} />
      <Route path="lab/reagents" element={<AdminRoute><ReagentsInventoryPage /></AdminRoute>} />
      <Route path="lab/panels" element={<AdminRoute><LabPanelsPage /></AdminRoute>} />
      <Route path="procurement/approvals" element={<AdminRoute><ApprovalWorkflowPage /></AdminRoute>} />
      <Route path="procurement/org-approvals" element={<AdminRoute><OrgApprovalAdminPage /></AdminRoute>} />
      <Route path="hr/organisation" element={<AdminRoute><HROrganisationPage /></AdminRoute>} />
      <Route path="procurement/budgets" element={<AdminRoute><BudgetManagementPage /></AdminRoute>} />
      <Route path="procurement/policies" element={<AdminRoute><ProcurementPoliciesPage /></AdminRoute>} />
      <Route path="procurement/categories" element={<AdminRoute><ItemCategoriesPage /></AdminRoute>} />
      <Route path="stores/locations" element={<AdminRoute><StoreLocationsPage /></AdminRoute>} />
      <Route path="stores/items" element={<AdminRoute><ItemMasterPage /></AdminRoute>} />
      <Route path="pharmacy/formulary" element={<AdminRoute><DrugFormularyPage /></AdminRoute>} />
      <Route path="pharmacy/categories" element={<AdminRoute><DrugCategoriesPage /></AdminRoute>} />
      <Route path="inventory/units" element={<AdminRoute><UnitOfMeasurePage /></AdminRoute>} />
      <Route path="inventory/expiry" element={<AdminRoute><ExpiryPoliciesPage /></AdminRoute>} />
      <Route path="inventory/items" element={<AdminRoute><ItemMasterPage /></AdminRoute>} />
      <Route path="inventory/locations" element={<AdminRoute><StoreLocationsPage /></AdminRoute>} />
      <Route path="site/profile" element={<AdminRoute><InstitutionProfilePage /></AdminRoute>} />
      <Route path="site/branches" element={<AdminRoute><BranchesPage /></AdminRoute>} />
      <Route path="site/buildings" element={<AdminRoute><BuildingsFloorsPage /></AdminRoute>} />
      <Route path="site/settings" element={<AdminRoute><SystemSettingsPage /></AdminRoute>} />
      <Route path="site/facility-mode" element={<AdminRoute><FacilityModePage /></AdminRoute>} />
      <Route path="site/integrations" element={<AdminRoute><IntegrationsPage /></AdminRoute>} />
      <Route path="site/license" element={<AdminRoute><LicenseSubscriptionPage /></AdminRoute>} />
      <Route path="backups" element={<AdminRoute><BackupManagementPage /></AdminRoute>} />
      <Route path="trash" element={<AdminRoute><TrashRecoveryPage /></AdminRoute>} />
      <Route path="audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
      <Route path="password-policies" element={<AdminRoute><PasswordPoliciesPage /></AdminRoute>} />
      <Route path="jobs" element={<AdminRoute><JobMonitorPage /></AdminRoute>} />
      <Route path="integrations/webhooks" element={<AdminRoute><WebhooksPage /></AdminRoute>} />
      <Route path="integrations/email-templates" element={<AdminRoute><EmailTemplatesPage /></AdminRoute>} />
      <Route path="integrations/sso" element={<AdminRoute><SsoConfigPage /></AdminRoute>} />
      <Route path="integrations/efris" element={<AdminRoute><EfrisConfigPage /></AdminRoute>} />
      <Route path="hr/goals" element={<AdminRoute><EmployeeGoalsPage /></AdminRoute>} />
      <Route path="hr/pips" element={<AdminRoute><PIPManagementPage /></AdminRoute>} />
      <Route path="hr/letter-templates" element={<AdminRoute><LetterTemplatesPage /></AdminRoute>} />
      <Route path="hr/org-chart" element={<AdminRoute><OrgChartPage /></AdminRoute>} />
      <Route path="hr/leave-dashboard" element={<AdminRoute><LeaveDashboardPage /></AdminRoute>} />
      <Route path="support-access" element={<AdminRoute><SupportAccessPage /></AdminRoute>} />
      <Route path="membership/plans" element={<AdminRoute><MembershipPlansPage /></AdminRoute>} />
      <Route path="membership/benefits" element={<AdminRoute><MembershipBenefitsPage /></AdminRoute>} />
      <Route path="membership/corporate" element={<AdminRoute><CorporatePlansPage /></AdminRoute>} />
      <Route path="membership/rules" element={<AdminRoute><MembershipRulesPage /></AdminRoute>} />
      <Route path="finance/currencies" element={<FinanceRoute><CurrenciesPage /></FinanceRoute>} />
      <Route path="finance/exchange-rates" element={<FinanceRoute><ExchangeRatesPage /></FinanceRoute>} />
      <Route path="finance/payment-methods" element={<FinanceRoute><PaymentMethodsPage /></FinanceRoute>} />
    </Routes>
  );
}
