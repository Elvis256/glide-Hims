import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const LabQCDashboardPage = lazy(() => import('../pages/lab-qc/LabQCDashboardPage'));
const LabConsumablesPage = lazy(() => import('../pages/lab-qc/LabConsumablesPage'));

export default function LabQCRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/lab-qc/dashboard" replace />} />
      <Route path="dashboard" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabQCDashboardPage /></LabTechRoute></ModuleRoute>} />
      <Route path="consumables" element={<ModuleRoute module="diagnostics"><LabTechRoute><LabConsumablesPage /></LabTechRoute></ModuleRoute>} />
    
    </Routes>
  );
}
