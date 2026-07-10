import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, StoreKeeperRoute, AssetsRoute } from '../components/RoleRoute';

const ReportsDashboardPage = lazy(() => import('../pages/reports/ReportsDashboardPage'));
const PatientStatisticsReportPage = lazy(() => import('../pages/reports/PatientStatisticsReportPage'));
const VisitReportsPage = lazy(() => import('../pages/reports/VisitReportsPage'));
const DiseaseStatisticsPage = lazy(() => import('../pages/reports/DiseaseStatisticsPage'));
const MortalityReportsPage = lazy(() => import('../pages/reports/MortalityReportsPage'));
const RevenueReportsPage = lazy(() => import('../pages/reports/RevenueReportsPage'));
const CollectionReportsPage = lazy(() => import('../pages/reports/CollectionReportsPage'));
const OutstandingReportsPage = lazy(() => import('../pages/reports/OutstandingReportsPage'));
const StockReportsPage = lazy(() => import('../pages/reports/StockReportsPage'));
const ExpiryReportsPage = lazy(() => import('../pages/reports/ExpiryReportsPage'));
const InventoryConsumptionReportsPage = lazy(() => import('../pages/reports/ConsumptionReportsPage'));
const HMIS105ReportPage = lazy(() => import('../pages/reports/HMIS105ReportPage'));
const StatutoryReportsPage = lazy(() => import('../pages/reports/StatutoryReportsPage'));

export default function ReportRoutes() {
  return (
    <Routes>

      <Route index element={<ModuleRoute module="reports"><AdminRoute><ReportsDashboardPage /></AdminRoute></ModuleRoute>} />
      <Route path="patients" element={<ModuleRoute module="reports"><ClinicalRoute><PatientStatisticsReportPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="visits" element={<ModuleRoute module="reports"><ClinicalRoute><VisitReportsPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="diseases" element={<ModuleRoute module="reports"><ClinicalRoute><DiseaseStatisticsPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="mortality" element={<ModuleRoute module="reports"><ClinicalRoute><MortalityReportsPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="revenue" element={<ModuleRoute module="reports"><FinanceRoute><RevenueReportsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="collections" element={<ModuleRoute module="reports"><FinanceRoute><CollectionReportsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="outstanding" element={<ModuleRoute module="reports"><FinanceRoute><OutstandingReportsPage /></FinanceRoute></ModuleRoute>} />
      <Route path="stock" element={<ModuleRoute module="reports"><StoreKeeperRoute><StockReportsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="expiry" element={<ModuleRoute module="reports"><StoreKeeperRoute><ExpiryReportsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="consumption" element={<ModuleRoute module="reports"><StoreKeeperRoute><InventoryConsumptionReportsPage /></StoreKeeperRoute></ModuleRoute>} />
      <Route path="hmis-105" element={<ModuleRoute module="reports"><AdminRoute><HMIS105ReportPage /></AdminRoute></ModuleRoute>} />
      <Route path="statutory" element={<ModuleRoute module="reports"><AdminRoute><StatutoryReportsPage /></AdminRoute></ModuleRoute>} />
    
    </Routes>
  );
}
