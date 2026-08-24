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

/**
 * Inventory screens at /inventory/*, which is where the sidebar links.
 * Still served under /stores/inventory/* — 14 places link there.
 */
export default function InventoryRoutes() {
  return (
    <Routes>
      <Route path="transfers" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockTransferPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="reorder" element={<ModuleRoute module="stores"><StoreKeeperRoute><ReorderSuggestionsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="adjustments" element={<ModuleRoute module="stores"><StoreKeeperRoute><StockAdjustmentsPage /></StoreKeeperRoute></ModuleRoute>} />
    </Routes>
  );
}
