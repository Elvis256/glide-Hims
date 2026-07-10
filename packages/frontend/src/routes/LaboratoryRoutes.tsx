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
const LabQueuePage = lazy(() => import('../pages/lab/LabQueuePage'));
const SampleCollectionPage = lazy(() => import('../pages/lab/SampleCollectionPage'));
const ResultsEntryPage = lazy(() => import('../pages/lab/ResultsEntryPage'));
const LabReportsPage = lazy(() => import('../pages/lab/LabReportsPage'));
const LabAnalyticsPage = lazy(() => import('../pages/lab/LabAnalyticsPage'));
const SampleReferralPage = lazy(() => import('../pages/lab/SampleReferralPage'));
const CriticalResultsReadOnlyPage = lazy(() => import('../components/CriticalResultsReadOnlyPage'));
const LabPage = lazy(() => import('../pages/LabPage'));

export default function LaboratoryRoutes() {
  return (
    <Routes>
      <Route index element={<ModuleRoute module="diagnostics"><LabTechRoute><LabPage /></LabTechRoute></ModuleRoute>} />
      <Route path="queue" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabQueuePage /></LabTechRoute></ModuleRoute>} />
      <Route path="samples" element={<ModuleRoute module="diagnostics"><LabTechRoute><SampleCollectionPage /></LabTechRoute></ModuleRoute>} />
      <Route path="results" element={<ModuleRoute module="diagnostics"><LabTechRoute><ResultsEntryPage /></LabTechRoute></ModuleRoute>} />
      <Route path="reports" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabReportsPage /></LabTechRoute></ModuleRoute>} />
      <Route path="analytics" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabAnalyticsPage /></LabTechRoute></ModuleRoute>} />
      <Route path="sample-referrals" element={<ModuleRoute module="diagnostics"><LabTechRoute><SampleReferralPage /></LabTechRoute></ModuleRoute>} />
      <Route path="critical-results" element={<ModuleRoute module="diagnostics"><LabTechRoute><CriticalResultsReadOnlyPage resourceType="lab" /></LabTechRoute></ModuleRoute>} />
    </Routes>
  );
}
