import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const NotificationSettingsPage = lazy(() => import('../pages/chronic-care/NotificationSettingsPage'));
const NotificationHistoryPage = lazy(() => import('../pages/admin/notifications/NotificationHistoryPage'));
const SmsTemplatesPage = lazy(() => import('../pages/admin/notifications/SmsTemplatesPage'));
const BulkSmsPage = lazy(() => import('../pages/admin/notifications/BulkSmsPage'));

export default function NotificationRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/notifications/settings" replace />} />
      <Route path="settings" element={<AdminRoute><NotificationSettingsPage /></AdminRoute>} />
      <Route path="templates" element={<AdminRoute><SmsTemplatesPage /></AdminRoute>} />
      <Route path="history" element={<AdminRoute><NotificationHistoryPage /></AdminRoute>} />
      <Route path="bulk" element={<AdminRoute><BulkSmsPage /></AdminRoute>} />
    
    </Routes>
  );
}
