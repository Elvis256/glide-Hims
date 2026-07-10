import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

// Lazy-loaded pages
const SystemDashboardPage = lazy(() => import('../pages/system/SystemDashboardPage'));
const TenantManagementPage = lazy(() => import('../pages/admin/TenantManagementPage'));
const SystemDeploymentsPage = lazy(() => import('../pages/system/SystemDeploymentsPage'));
const SystemDeploymentDetailPage = lazy(() => import('../pages/system/SystemDeploymentDetailPage'));
const SystemRolloutsPage = lazy(() => import('../pages/system/SystemRolloutsPage'));
const SystemAuditLogsPage = lazy(() => import('../pages/system/SystemAuditLogsPage'));
const SystemSaasAuditPage = lazy(() => import('../pages/system/SystemSaasAuditPage'));
const SystemUsersPage = lazy(() => import('../pages/system/SystemUsersPage'));
const PlatformSettingsPage = lazy(() => import('../pages/system/SystemSettingsPage'));
const SystemSupportRequestsPage = lazy(() => import('../pages/system/SystemSupportRequestsPage'));
const SystemLeadsPage = lazy(() => import('../pages/system/SystemLeadsPage'));
const SystemDownloadsPage = lazy(() => import('../pages/system/SystemDownloadsPage'));
const SystemLicensesPage = lazy(() => import('../pages/system/SystemLicensesPage'));
const SystemPlansPage = lazy(() => import('../pages/system/SystemPlansPage'));
const SystemSubscriptionsPage = lazy(() => import('../pages/system/SystemSubscriptionsPage'));
const SystemSubscriptionDetailPage = lazy(() => import('../pages/system/SystemSubscriptionDetailPage'));
const SystemQuotationsPage = lazy(() => import('../pages/system/SystemQuotationsPage'));
const SystemQuotationDetailPage = lazy(() => import('../pages/system/SystemQuotationDetailPage'));
const SystemPriceCatalogPage = lazy(() => import('../pages/system/SystemPriceCatalogPage'));
const SystemContractsPage = lazy(() => import('../pages/system/SystemContractsPage'));
const SystemContractDetailPage = lazy(() => import('../pages/system/SystemContractDetailPage'));
const SystemOnboardingsPage = lazy(() => import('../pages/system/SystemOnboardingsPage'));
const SystemOnboardingDetailPage = lazy(() => import('../pages/system/SystemOnboardingDetailPage'));
const SystemClientHealthPage = lazy(() => import('../pages/system/SystemClientHealthPage'));
const SystemSaasInvoicesPage = lazy(() => import('../pages/system/SystemSaasInvoicesPage'));
const SystemInvoiceDetailPage = lazy(() => import('../pages/system/SystemInvoiceDetailPage'));
const SystemBillingSettingsPage = lazy(() => import('../pages/system/SystemBillingSettingsPage'));
const SystemEmailTemplatesPage = lazy(() => import('../pages/system/SystemEmailTemplatesPage'));
const SystemEmailLogsPage = lazy(() => import('../pages/system/SystemEmailLogsPage'));
const SystemDunningRulesPage = lazy(() => import('../pages/system/SystemDunningRulesPage'));
const SystemVatRulesPage = lazy(() => import('../pages/system/SystemVatRulesPage'));
const SystemCurrencyRatesPage = lazy(() => import('../pages/system/SystemCurrencyRatesPage'));
const SystemCouponsPage = lazy(() => import('../pages/system/SystemCouponsPage'));
const SystemRevenuePage = lazy(() => import('../pages/system/SystemRevenuePage'));
const SystemComplianceCenterPage = lazy(() => import('../pages/system/SystemComplianceCenterPage'));
const SystemSecurityPage = lazy(() => import('../pages/system/SystemSecurityPage'));
const SystemDocsPage = lazy(() => import('../pages/system/SystemDocsPage'));

export default function SystemRoutes() {
  return (
    <Routes>
      <Route index element={<SystemDashboardPage />} />
      <Route path="tenants" element={<TenantManagementPage />} />
      <Route path="deployments" element={<SystemDeploymentsPage />} />
      <Route path="deployments/:deploymentId" element={<SystemDeploymentDetailPage />} />
      <Route path="rollouts" element={<SystemRolloutsPage />} />
      <Route path="audit-logs" element={<SystemAuditLogsPage />} />
      <Route path="saas-audit" element={<SystemSaasAuditPage />} />
      <Route path="users" element={<SystemUsersPage />} />
      <Route path="settings" element={<PlatformSettingsPage />} />
      <Route path="support-requests" element={<SystemSupportRequestsPage />} />
      <Route path="leads" element={<SystemLeadsPage />} />
      <Route path="downloads" element={<SystemDownloadsPage />} />
      <Route path="licenses" element={<SystemLicensesPage />} />
      <Route path="plans" element={<SystemPlansPage />} />
      <Route path="subscriptions" element={<SystemSubscriptionsPage />} />
      <Route path="subscriptions/:id" element={<SystemSubscriptionDetailPage />} />
      <Route path="quotations" element={<SystemQuotationsPage />} />
      <Route path="quotations/:id" element={<SystemQuotationDetailPage />} />
      <Route path="price-catalog" element={<SystemPriceCatalogPage />} />
      <Route path="contracts" element={<SystemContractsPage />} />
      <Route path="contracts/:id" element={<SystemContractDetailPage />} />
      <Route path="onboardings" element={<SystemOnboardingsPage />} />
      <Route path="onboardings/:id" element={<SystemOnboardingDetailPage />} />
      <Route path="client-health" element={<SystemClientHealthPage />} />
      <Route path="saas-invoices" element={<SystemSaasInvoicesPage />} />
      <Route path="saas-invoices/:id" element={<SystemInvoiceDetailPage />} />
      <Route path="billing-settings" element={<SystemBillingSettingsPage />} />
      <Route path="email-templates" element={<SystemEmailTemplatesPage />} />
      <Route path="email-logs" element={<SystemEmailLogsPage />} />
      <Route path="dunning-rules" element={<SystemDunningRulesPage />} />
      <Route path="vat-rules" element={<SystemVatRulesPage />} />
      <Route path="currency-rates" element={<SystemCurrencyRatesPage />} />
      <Route path="coupons" element={<SystemCouponsPage />} />
      <Route path="revenue" element={<SystemRevenuePage />} />
      <Route path="compliance" element={<SystemComplianceCenterPage />} />
      <Route path="security" element={<SystemSecurityPage />} />
      <Route path="docs" element={<SystemDocsPage />} />
    </Routes>
  );
}
