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
const POSDashboardPage = lazy(() => import('../pages/pos/POSDashboardPage'));
const POSSalePage = lazy(() => import('../pages/pos/POSSalePage'));
const POSShiftPage = lazy(() => import('../pages/pos/POSShiftPage'));
const POSReportsPage = lazy(() => import('../pages/pos/POSReportsPage'));
const WholesaleCustomersPage = lazy(() => import('../pages/pos/WholesaleCustomersPage'));
const PricingTiersPage = lazy(() => import('../pages/pos/PricingTiersPage'));
const DeliveryTrackingPage = lazy(() => import('../pages/pos/DeliveryTrackingPage'));
const POSReturnsPage = lazy(() => import('../pages/pos/POSReturnsPage'));
const POSReceiptHistoryPage = lazy(() => import('../pages/pos/POSReceiptHistoryPage'));
const POSOfflineSyncPage = lazy(() => import('../pages/pos/POSOfflineSyncPage'));

export default function POSRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/pharmacy/pos" replace />} />
      <Route path="pharmacy/pos" element={<ModuleRoute module="pos"><PharmacistRoute><POSDashboardPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/sale" element={<ModuleRoute module="pos"><PharmacistRoute><POSSalePage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/shifts" element={<ModuleRoute module="pos"><PharmacistRoute><POSShiftPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/reports" element={<ModuleRoute module="pos"><PharmacistRoute><POSReportsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/wholesale/customers" element={<ModuleRoute module="pos"><PharmacistRoute><WholesaleCustomersPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/wholesale/tiers" element={<ModuleRoute module="pos"><PharmacistRoute><PricingTiersPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/deliveries" element={<ModuleRoute module="pos"><PharmacistRoute><DeliveryTrackingPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/returns" element={<ModuleRoute module="pos"><PharmacistRoute><POSReturnsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/receipts" element={<ModuleRoute module="pos"><PharmacistRoute><POSReceiptHistoryPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="pharmacy/pos/offline-sync" element={<ModuleRoute module="pos"><PharmacistRoute><POSOfflineSyncPage /></PharmacistRoute></ModuleRoute>} />
    </Routes>
  );
}
