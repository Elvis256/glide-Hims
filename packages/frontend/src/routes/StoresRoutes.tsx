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
const UnitIssuePage = lazy(() => import('../pages/stores/UnitIssuePage'));
const StockTransferPage = lazy(() => import('../pages/inventory/StockTransferPage'));
const ReorderSuggestionsPage = lazy(() => import('../pages/inventory/ReorderSuggestionsPage'));
const StoresExpiryPage = lazy(() => import('../pages/stores/StoresExpiryPage'));
const StockAdjustmentsPage = lazy(() => import('../pages/stores/StockAdjustmentsPage'));
const StockTakePage = lazy(() => import('../pages/stores/StockTakePage'));
const StoresAssetRegisterPage = lazy(() => import('../pages/stores/AssetRegisterPage'));
const MaintenanceSchedulePage = lazy(() => import('../pages/stores/MaintenanceSchedulePage'));
const ConsumptionReportsPage = lazy(() => import('../pages/stores/ConsumptionReportsPage'));
const StoresAnalyticsPage = lazy(() => import('../pages/stores/StoresAnalyticsPage'));
const StoresDisposalPage = lazy(() => import('../pages/stores/StoresDisposalPage'));

export default function StoresRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/inventory" replace />} />
      <Route path="main" element={<Navigate to="/inventory" replace />} />
      <Route path="issue" element={<ModuleRoute module="stores"><StoreKeeperRoute><UnitIssuePage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="transfers" element={<Navigate to="/inventory/transfers" replace />} />
      <Route path="inventory/transfers" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockTransferPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="inventory/reorder" element={<ModuleRoute module="stores"><StoreKeeperRoute><ReorderSuggestionsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="procurement" element={<Navigate to="/procurement/orders" replace />} />
      <Route path="suppliers" element={<Navigate to="/procurement/vendors" replace />} />
      <Route path="expiry" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresExpiryPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="adjustments" element={<Navigate to="/inventory/adjustments" replace />} />
      <Route path="inventory/adjustments" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockAdjustmentsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="stock-take" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockTakePage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="assets" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresAssetRegisterPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="maintenance" element={<ModuleRoute module="stores"><StoreKeeperRoute><MaintenanceSchedulePage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="consumption" element={<ModuleRoute module="stores"><StoreKeeperRoute><ConsumptionReportsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="analytics" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresAnalyticsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="requisitions" element={<Navigate to="/procurement/requisitions" replace />} />
      <Route path="rfq" element={<Navigate to="/procurement/rfq" replace />} />
      <Route path="quotes/compare" element={<Navigate to="/procurement/quotes/compare" replace />} />
      <Route path="po" element={<Navigate to="/procurement/orders" replace />} />
      <Route path="grn" element={<Navigate to="/procurement/grn" replace />} />
      <Route path="invoices/match" element={<Navigate to="/procurement/invoices/match" replace />} />
      <Route path="suppliers/contracts" element={<Navigate to="/procurement/vendors/contracts" replace />} />
      <Route path="payments" element={<Navigate to="/procurement/vendors/payments" replace />} />
      <Route path="disposal" element={<ModuleRoute module="stores"><StoreKeeperRoute><StoresDisposalPage /></StoreKeeperRoute></ModuleRoute>} />
      {/* Expiry redirects (moved from CoreRoutes) */}
      <Route path="expiry/soon" element={<Navigate to="/stores/expiry?filter=soon" replace />} />
      <Route path="expiry/expired" element={<Navigate to="/stores/expiry?filter=expired" replace />} />
    </Routes>
  );
}
