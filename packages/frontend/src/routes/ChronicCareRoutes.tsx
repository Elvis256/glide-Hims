import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const ChronicCareDashboardPage = lazy(() => import('../pages/chronic-care/ChronicCareDashboardPage'));
const ChronicRegistryPage = lazy(() => import('../pages/chronic-care/ChronicRegistryPage'));
const ChronicRemindersPage = lazy(() => import('../pages/chronic-care/ChronicRemindersPage'));
const NotificationSettingsPage = lazy(() => import('../pages/chronic-care/NotificationSettingsPage'));

export default function ChronicCareRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/chronic-care/dashboard" replace />} />
      <Route path="dashboard" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicCareDashboardPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="registry" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicRegistryPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="reminders" element={<ModuleRoute module="chronic-care"><ClinicalRoute><ChronicRemindersPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="notifications" element={<ModuleRoute module="chronic-care"><AdminRoute><NotificationSettingsPage /></AdminRoute></ModuleRoute>} />
    
    </Routes>
  );
}
