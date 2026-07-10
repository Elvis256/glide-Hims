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
const AdmissionsPage = lazy(() => import('../pages/ipd/AdmissionsPage'));
const WardsBedsPage = lazy(() => import('../pages/ipd/WardsBedsPage'));
const BedBoardPage = lazy(() => import('../pages/ipd/BedBoardPage'));
const BHTIssuePage = lazy(() => import('../pages/ipd/BHTIssuePage'));
const InpatientBillingPage = lazy(() => import('../pages/ipd/InpatientBillingPage'));
const IPDNursingNotesPage = lazy(() => import('../pages/ipd/IPDNursingNotesPage'));
const IPDTheatrePage = lazy(() => import('../pages/ipd/TheatrePage'));
const IPDMaternityPage = lazy(() => import('../pages/ipd/MaternityPage'));
const IPDDischargePage = lazy(() => import('../pages/ipd/DischargePage'));
const IPDAnalyticsPage = lazy(() => import('../pages/ipd/IPDAnalyticsPage'));

export default function IPDRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/ipd/admissions" replace />} />
      <Route path="admissions" element={<ModuleRoute module="ipd"><ClinicalRoute><AdmissionsPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="wards" element={<ModuleRoute module="ipd"><ClinicalRoute><WardsBedsPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="bed-board" element={<ModuleRoute module="ipd"><ClinicalRoute><BedBoardPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="bht" element={<ModuleRoute module="ipd"><ClinicalRoute><BHTIssuePage /></ClinicalRoute></ModuleRoute>} />
      <Route path="billing" element={<ModuleRoute module="ipd"><BillingRoute><InpatientBillingPage /></BillingRoute></ModuleRoute>} />
      <Route path="nursing" element={<ModuleRoute module="ipd"><NurseRoute><IPDNursingNotesPage /></NurseRoute></ModuleRoute>} />
      <Route path="theatre" element={<ModuleRoute module="ipd"><DoctorRoute><IPDTheatrePage /></DoctorRoute></ModuleRoute>} />
      <Route path="maternity" element={<ModuleRoute module="ipd"><ClinicalRoute><IPDMaternityPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="discharge" element={<ModuleRoute module="ipd"><DoctorRoute><IPDDischargePage /></DoctorRoute></ModuleRoute>} />
      <Route path="analytics" element={<ModuleRoute module="ipd"><ClinicalRoute><IPDAnalyticsPage /></ClinicalRoute></ModuleRoute>} />
    </Routes>
  );
}
