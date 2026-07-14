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
import ProtectedRoute from '../components/ProtectedRoute';

// Lazy-loaded pages
const PatientSearchPage = lazy(() => import('../pages/PatientSearchPage'));
const PatientRegistrationPage = lazy(() => import('../pages/PatientRegistrationPage'));
const HospitalSchemeEnrollmentPage = lazy(() => import('../pages/HospitalSchemeEnrollmentPage'));
const PatientDocumentsPage = lazy(() => import('../pages/PatientDocumentsPage'));
const PatientHistoryPage = lazy(() => import('../pages/PatientHistoryPage'));
const PatientEditPage = lazy(() => import('../pages/PatientEditPage'));
const PatientDetailPage = lazy(() => import('../pages/PatientDetailPage'));
const PatientsPage = lazy(() => import('../pages/PatientsPage'));
const OPDTokenPage = lazy(() => import('../pages/OPDTokenPage'));
const DoctorsOnDutyPage = lazy(() => import('../pages/DoctorsOnDutyPage'));
const QueueMonitorPage = lazy(() => import('../pages/QueueMonitorPage'));
const CallNextPatientPage = lazy(() => import('../pages/CallNextPatientPage'));
const QueueAnalyticsPage = lazy(() => import('../pages/QueueAnalyticsPage'));
const PatientJourneyPage = lazy(() => import('../pages/PatientJourneyPage'));
const QueueManagementPage = lazy(() => import('../pages/QueueManagementPage'));
const BookAppointmentPage = lazy(() => import('../pages/BookAppointmentPage'));
const ViewAppointmentsPage = lazy(() => import('../pages/ViewAppointmentsPage'));
const DoctorSchedulesPage = lazy(() => import('../pages/DoctorSchedulesPage'));
const ManageAppointmentsPage = lazy(() => import('../pages/ManageAppointmentsPage'));
const NewBillPage = lazy(() => import('../pages/NewBillPage'));
// CollectPayment + PendingPayments consolidated into the POS-style CashierPage
const CashierPage = lazy(() => import('../pages/CashierPage'));
const PrintReceiptPage = lazy(() => import('../pages/PrintReceiptPage'));
const RefundsPage = lazy(() => import('../pages/RefundsPage'));
const VerifyCoveragePage = lazy(() => import('../pages/VerifyCoveragePage'));
const PreAuthorizationPage = lazy(() => import('../pages/PreAuthorizationPage'));
const ClaimSubmissionPage = lazy(() => import('../pages/ClaimSubmissionPage'));
const InsuranceCardsPage = lazy(() => import('../pages/InsuranceCardsPage'));
const RegistrationDailySummaryPage = lazy(() => import('../pages/RegistrationDailySummaryPage'));
const PatientStatisticsPage = lazy(() => import('../pages/PatientStatisticsPage'));
const RegistrationRevenuePage = lazy(() => import('../pages/RegistrationRevenuePage'));
const QueuePerformancePage = lazy(() => import('../pages/QueuePerformancePage'));

export default function RegistrationRoutes() {
  return (
    <Routes>
      <Route path="patients/search" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientSearchPage /></ProtectedRoute>} />
      <Route path="patients/new" element={<ProtectedRoute requiredPermissions={['patients.create']}><PatientRegistrationPage /></ProtectedRoute>} />
      <Route path="patients/hospital-scheme-enroll" element={<ReceptionistRoute><HospitalSchemeEnrollmentPage /></ReceptionistRoute>} />
      <Route path="patients/documents" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDocumentsPage /></ProtectedRoute>} />
      <Route path="patients/history" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientHistoryPage /></ProtectedRoute>} />
      <Route path="patients/:id/edit" element={<ProtectedRoute requiredPermissions={['patients.update']}><PatientEditPage /></ProtectedRoute>} />
      <Route path="patients/:id" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDetailPage /></ProtectedRoute>} />
      <Route path="patients" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER, ROLES.LAB_TECHNICIAN, ROLES.PHARMACIST, ROLES.RADIOLOGIST, ROLES.ADMIN]}><PatientsPage /></RoleRoute>} />
      <Route path="opd/token" element={<ReceptionistRoute><OPDTokenPage /></ReceptionistRoute>} />
      <Route path="doctors/on-duty" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR]}><DoctorsOnDutyPage /></RoleRoute>} />
      <Route path="queue/monitor" element={<ReceptionistRoute><QueueMonitorPage /></ReceptionistRoute>} />
      <Route path="queue/call" element={<ReceptionistRoute><CallNextPatientPage /></ReceptionistRoute>} />
      <Route path="queue/analytics" element={<ReceptionistRoute><QueueAnalyticsPage /></ReceptionistRoute>} />
      <Route path="queue/journey" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN]}><PatientJourneyPage /></RoleRoute>} />
      <Route path="queue" element={<ReceptionistRoute><QueueManagementPage /></ReceptionistRoute>} />
      <Route path="triage" element={<NurseRoute><QueueManagementPage /></NurseRoute>} />
      <Route path="appointments/new" element={<ReceptionistRoute><BookAppointmentPage /></ReceptionistRoute>} />
      <Route path="appointments" element={<ReceptionistRoute><ViewAppointmentsPage /></ReceptionistRoute>} />
      <Route path="schedules/doctors" element={<ReceptionistRoute><DoctorSchedulesPage /></ReceptionistRoute>} />
      <Route path="appointments/manage" element={<ReceptionistRoute><ManageAppointmentsPage /></ReceptionistRoute>} />
      <Route path="billing/reception/new" element={<ModuleRoute module="billing"><CashierRoute><NewBillPage /></CashierRoute></ModuleRoute>} />
      <Route path="billing/reception/payment" element={<ModuleRoute module="billing"><CashierRoute><CashierPage /></CashierRoute></ModuleRoute>} />
      <Route path="billing/reception/receipt" element={<ModuleRoute module="billing"><CashierRoute><PrintReceiptPage /></CashierRoute></ModuleRoute>} />
      <Route path="billing/reception/pending" element={<ModuleRoute module="billing"><CashierRoute><CashierPage /></CashierRoute></ModuleRoute>} />
      <Route path="billing/reception/refunds" element={<ModuleRoute module="billing"><CashierRoute><RefundsPage /></CashierRoute></ModuleRoute>} />
      <Route path="insurance/verify" element={<ModuleRoute module="billing"><ReceptionistRoute><VerifyCoveragePage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="insurance/preauth" element={<ModuleRoute module="billing"><ReceptionistRoute><PreAuthorizationPage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="insurance/submit" element={<ModuleRoute module="billing"><ReceptionistRoute><ClaimSubmissionPage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="insurance/cards" element={<ModuleRoute module="billing"><ReceptionistRoute><InsuranceCardsPage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="reports/registration/daily" element={<ModuleRoute module="reports"><ReceptionistRoute><RegistrationDailySummaryPage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="reports/registration/patients" element={<ModuleRoute module="reports"><ReceptionistRoute><PatientStatisticsPage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="reports/registration/revenue" element={<ModuleRoute module="reports"><ReceptionistRoute><RegistrationRevenuePage /></ReceptionistRoute></ModuleRoute>} />
      <Route path="reports/registration/queue" element={<ModuleRoute module="reports"><ReceptionistRoute><QueuePerformancePage /></ReceptionistRoute></ModuleRoute>} />
    </Routes>
  );
}
