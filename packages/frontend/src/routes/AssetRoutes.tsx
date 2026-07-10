import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, StoreKeeperRoute, AssetsRoute } from '../components/RoleRoute';

const AssetRegisterPage = lazy(() => import('../pages/assets/AssetRegisterPage'));
const AssetAllocationPage = lazy(() => import('../pages/assets/AssetAllocationPage'));
const AssetTrackingPage = lazy(() => import('../pages/assets/AssetTrackingPage'));
const AssetMaintenancePage = lazy(() => import('../pages/assets/AssetMaintenancePage'));
const AssetDepreciationPage = lazy(() => import('../pages/assets/AssetDepreciationPage'));
const AssetReportsPage = lazy(() => import('../pages/assets/AssetReportsPage'));
const AssetTransfersPage = lazy(() => import('../pages/assets/AssetTransfersPage'));
const AssetDisposalPage = lazy(() => import('../pages/assets/AssetDisposalPage'));
const AssetCategoriesPage = lazy(() => import('../pages/admin/AssetCategoriesPage'));

export default function AssetRoutes() {
  return (
    <Routes>

      <Route index element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.read']}><AssetRegisterPage /></AssetsRoute></ModuleRoute>} />
      <Route path="register" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.read']}><AssetRegisterPage /></AssetsRoute></ModuleRoute>} />
      <Route path="allocation" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.allocation.request', 'assets.allocation.approve', 'assets.allocation.issue', 'assets.allocation.return', 'assets.audit.read']}><AssetAllocationPage /></AssetsRoute></ModuleRoute>} />
      <Route path="tracking" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.read']}><AssetTrackingPage /></AssetsRoute></ModuleRoute>} />
      <Route path="maintenance" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.maintenance.record', 'assets.calibration.record', 'assets.read']}><AssetMaintenancePage /></AssetsRoute></ModuleRoute>} />
      <Route path="depreciation" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.depreciation.run', 'assets.reports.read']}><AssetDepreciationPage /></AssetsRoute></ModuleRoute>} />
      <Route path="reports" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.reports.read']}><AssetReportsPage /></AssetsRoute></ModuleRoute>} />
      <Route path="transfers" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.transfer.initiate', 'assets.transfer.approve', 'assets.transfer.approve.origin', 'assets.transfer.approve.receiving', 'assets.transfer.approve.store', 'assets.transfer.complete', 'assets.audit.read']}><AssetTransfersPage /></AssetsRoute></ModuleRoute>} />
      <Route path="disposal" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.disposal.request', 'assets.disposal.biomed_review', 'assets.disposal.committee', 'assets.disposal.complete', 'assets.audit.read']}><AssetDisposalPage /></AssetsRoute></ModuleRoute>} />
      <Route path="categories" element={<ModuleRoute module="assets"><AssetsRoute perms={['assets.categories.manage']}><AssetCategoriesPage /></AssetsRoute></ModuleRoute>} />
    
    </Routes>
  );
}
