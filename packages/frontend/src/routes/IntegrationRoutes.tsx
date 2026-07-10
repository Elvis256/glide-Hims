import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const DrugDatabasePage = lazy(() => import('../pages/integrations/DrugDatabasePage'));
const LabReferencePage = lazy(() => import('../pages/integrations/LabReferencePage'));
const SMSNotificationsPage = lazy(() => import('../pages/integrations/SMSNotificationsPage'));
const DHIS2SettingsPage = lazy(() => import('../pages/integrations/DHIS2SettingsPage'));

export default function IntegrationRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/integrations/drugs" replace />} />
      <Route path="drugs" element={<ModuleRoute module="integrations"><PharmacistRoute><DrugDatabasePage /></PharmacistRoute></ModuleRoute>} />
      <Route path="lab-reference" element={<ModuleRoute module="integrations"><LabTechRoute><LabReferencePage /></LabTechRoute></ModuleRoute>} />
      <Route path="sms" element={<ModuleRoute module="integrations"><AdminRoute><SMSNotificationsPage /></AdminRoute></ModuleRoute>} />
      <Route path="dhis2" element={<ModuleRoute module="integrations"><AdminRoute><DHIS2SettingsPage /></AdminRoute></ModuleRoute>} />
    
    </Routes>
  );
}
