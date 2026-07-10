import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { AdminRoute, ClinicalRoute, FinanceRoute, LabTechRoute, PharmacistRoute } from '../components/RoleRoute';

const SupplierPaymentVouchersPage = lazy(() => import('../pages/supplier-finance/SupplierPaymentVouchersPage'));
const SupplierCreditNotesPage = lazy(() => import('../pages/supplier-finance/SupplierCreditNotesPage'));
const SupplierLedgerPage = lazy(() => import('../pages/supplier-finance/SupplierLedgerPage'));

export default function SupplierFinanceRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/supplier-finance/payment-vouchers" replace />} />
      <Route path="payment-vouchers" element={<ModuleRoute module="finance"><FinanceRoute><SupplierPaymentVouchersPage /></FinanceRoute></ModuleRoute>} />
      <Route path="credit-notes" element={<ModuleRoute module="finance"><FinanceRoute><SupplierCreditNotesPage /></FinanceRoute></ModuleRoute>} />
      <Route path="ledger" element={<ModuleRoute module="finance"><FinanceRoute><SupplierLedgerPage /></FinanceRoute></ModuleRoute>} />
    
    </Routes>
  );
}
