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
const RadiologyPage = lazy(() => import('../pages/RadiologyPage'));
const RadiologyQueuePage = lazy(() => import('../pages/radiology/RadiologyQueuePage'));
const ImagingOrdersPage = lazy(() => import('../pages/radiology/ImagingOrdersPage'));
const RadiologyResultsPage = lazy(() => import('../pages/radiology/RadiologyResultsPage'));
const RadiologyAnalyticsPage = lazy(() => import('../pages/radiology/RadiologyAnalyticsPage'));
const CriticalResultsReadOnlyPage = lazy(() => import('../components/CriticalResultsReadOnlyPage'));

export default function RadiologyRoutes() {
  return (
    <Routes>
      <Route index element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyPage /></RadiologyRoute></ModuleRoute>} />
      <Route path="queue" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyQueuePage /></RadiologyRoute></ModuleRoute>} />
      <Route path="orders" element={<ModuleRoute module="diagnostics"><RadiologyRoute><ImagingOrdersPage /></RadiologyRoute></ModuleRoute>} />
      <Route path="results" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyResultsPage /></RadiologyRoute></ModuleRoute>} />
      <Route path="analytics" element={<ModuleRoute module="diagnostics"><RadiologyRoute><RadiologyAnalyticsPage /></RadiologyRoute></ModuleRoute>} />
      <Route path="critical-results" element={<ModuleRoute module="diagnostics"><RadiologyRoute><CriticalResultsReadOnlyPage resourceType="radiology" /></RadiologyRoute></ModuleRoute>} />
    </Routes>
  );
}
