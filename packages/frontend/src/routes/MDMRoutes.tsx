import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const MasterDataVersionsPage = lazy(() => import('../pages/mdm/MasterDataVersionsPage'));
const MasterDataApprovalsPage = lazy(() => import('../pages/mdm/MasterDataApprovalsPage'));
const ApprovalRulesPage = lazy(() => import('../pages/mdm/ApprovalRulesPage'));

export default function MDMRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/mdm/versions" replace />} />
      <Route path="versions" element={<AdminRoute><MasterDataVersionsPage /></AdminRoute>} />
      <Route path="approvals" element={<AdminRoute><MasterDataApprovalsPage /></AdminRoute>} />
      <Route path="rules" element={<AdminRoute><ApprovalRulesPage /></AdminRoute>} />
    
    </Routes>
  );
}
