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
const EmergencyPage = lazy(() => import('../pages/EmergencyPage'));
const EmergencyQueuePage = lazy(() => import('../pages/emergency/EmergencyQueuePage'));
const AmbulanceTrackingPage = lazy(() => import('../pages/emergency/AmbulanceTrackingPage'));
const EmergencyTriagePage = lazy(() => import('../pages/emergency/EmergencyTriagePage'));
const EmergencyBillingPage = lazy(() => import('../pages/emergency/EmergencyBillingPage'));

export default function EmergencyRoutes() {
  return (
    <Routes>
      <Route index element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="queue" element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyQueuePage /></ClinicalRoute></ModuleRoute>} />
      <Route path="ambulance" element={<ModuleRoute module="emergency"><ClinicalRoute><AmbulanceTrackingPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="triage" element={<ModuleRoute module="emergency"><ClinicalRoute><EmergencyTriagePage /></ClinicalRoute></ModuleRoute>} />
      <Route path="billing" element={<ModuleRoute module="emergency"><BillingRoute><EmergencyBillingPage /></BillingRoute></ModuleRoute>} />
    </Routes>
  );
}
