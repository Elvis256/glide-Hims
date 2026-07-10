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
const PharmacyDashboardPage = lazy(() => import('../pages/pharmacy/PharmacyDashboardPage'));
const DispenseMedicationPage = lazy(() => import('../pages/pharmacy/DispenseMedicationPage'));
const PharmacyQueuePage = lazy(() => import('../pages/pharmacy/PharmacyQueuePage'));
const PharmacyStockPage = lazy(() => import('../pages/pharmacy/PharmacyStockPage'));
const PharmacyReturnsPage = lazy(() => import('../pages/pharmacy/ReturnsPage'));
const PharmacyAnalyticsPage = lazy(() => import('../pages/pharmacy/PharmacyAnalyticsPage'));
const InpatientMedsPage = lazy(() => import('../pages/pharmacy/transactions/InpatientMedsPage'));
const MedicationAdherencePage = lazy(() => import('../pages/pharmacy/MedicationAdherencePage'));
const LabelManagementPage = lazy(() => import('../pages/pharmacy/LabelManagementPage'));
const TemperatureMonitoringPage = lazy(() => import('../pages/pharmacy/TemperatureMonitoringPage'));
const DURReportsPage = lazy(() => import('../pages/pharmacy/DURReportsPage'));
const DrugDatabaseSyncPage = lazy(() => import('../pages/pharmacy/DrugDatabaseSyncPage'));
const PrescriptionTemplatesPage = lazy(() => import('../pages/pharmacy/PrescriptionTemplatesPage'));
const NotificationLogPage = lazy(() => import('../pages/pharmacy/NotificationLogPage'));
const ControlledSubstancesRegisterPage = lazy(() => import('../pages/pharmacy/ControlledSubstancesRegisterPage'));
const SupplierRankingsPage = lazy(() => import('../pages/pharmacy/SupplierRankingsPage'));

export default function PharmacyRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/pharmacy/dashboard" replace />} />
      <Route path="dashboard" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyDashboardPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="dispense" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DispenseMedicationPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="queue" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyQueuePage /></PharmacistRoute></ModuleRoute>} />
      <Route path="stock" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyStockPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="returns" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyReturnsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="adjustments" element={<Navigate to="/inventory/adjustments" replace />} />
      <Route path="transfers" element={<Navigate to="/inventory/transfers" replace />} />
      <Route path="analytics" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PharmacyAnalyticsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="retail" element={<Navigate to="/pharmacy/pos/sale" replace />} />
      <Route path="wholesale" element={<Navigate to="/pharmacy/pos/wholesale/customers" replace />} />
      <Route path="inpatient" element={<ModuleRoute module="pharmacy"><PharmacistRoute><InpatientMedsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="adherence" element={<ModuleRoute module="pharmacy"><PharmacistRoute><MedicationAdherencePage /></PharmacistRoute></ModuleRoute>} />
      <Route path="labels" element={<ModuleRoute module="pharmacy"><PharmacistRoute><LabelManagementPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="temperature" element={<ModuleRoute module="pharmacy"><PharmacistRoute><TemperatureMonitoringPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="dur-reports" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DURReportsPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="drug-db-sync" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugDatabaseSyncPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="rx-templates" element={<ModuleRoute module="pharmacy"><PharmacistRoute><PrescriptionTemplatesPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="notifications" element={<ModuleRoute module="pharmacy"><PharmacistRoute><NotificationLogPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="controlled-register" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ControlledSubstancesRegisterPage /></PharmacistRoute></ModuleRoute>} />
      <Route path="supplier-rankings" element={<ModuleRoute module="pharmacy"><PharmacistRoute><SupplierRankingsPage /></PharmacistRoute></ModuleRoute>} />
      {/* Procurement redirects (moved from CoreRoutes) */}
      <Route path="requisitions" element={<Navigate to="/procurement/requisitions" replace />} />
      <Route path="rfq" element={<Navigate to="/procurement/rfq" replace />} />
      <Route path="quotes/compare" element={<Navigate to="/procurement/quotes/compare" replace />} />
      <Route path="po" element={<Navigate to="/procurement/orders" replace />} />
      <Route path="grn" element={<Navigate to="/procurement/grn" replace />} />
      <Route path="invoices/match" element={<Navigate to="/procurement/invoices/match" replace />} />
      <Route path="supplier-payments" element={<Navigate to="/procurement/vendors/payments" replace />} />
      <Route path="suppliers" element={<Navigate to="/procurement/vendors" replace />} />
      <Route path="suppliers/contracts" element={<Navigate to="/procurement/vendors/contracts" replace />} />
      <Route path="suppliers/ratings" element={<Navigate to="/procurement/vendors/ratings" replace />} />
      <Route path="suppliers/prices" element={<Navigate to="/procurement/vendors/prices" replace />} />
    </Routes>
  );
}
