import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import RoleRoute, { DoctorRoute, NurseRoute, ReceptionistRoute, ClinicalRoute } from '../components/RoleRoute';
import { ROLES } from '../components/RoleRoute';

// Lazy-loaded pages
const DoctorDashboardPage = lazy(() => import('../pages/doctor/DoctorDashboardPage'));
const NewConsultationPage = lazy(() => import('../pages/doctor/NewConsultationPage'));
const WaitingPatientsPage = lazy(() => import('../pages/doctor/queue/WaitingPatientsPage'));
const CallNextPage = lazy(() => import('../pages/doctor/queue/CallNextPage'));
const TodaySchedulePage = lazy(() => import('../pages/doctor/queue/TodaySchedulePage'));
const PendingReviewsPage = lazy(() => import('../pages/doctor/queue/PendingReviewsPage'));
const CriticalResultsPage = lazy(() => import('../pages/doctor/CriticalResultsPage'));
const SOAPNotesPage = lazy(() => import('../pages/doctor/SOAPNotesPage'));
const ClinicalNotesPage = lazy(() => import('../pages/ClinicalNotesPage'));
const EncountersPage = lazy(() => import('../pages/EncountersPage'));
const ICD10CodingPage = lazy(() => import('../pages/doctor/diagnosis/ICD10CodingPage'));
const DifferentialDxPage = lazy(() => import('../pages/doctor/diagnosis/DifferentialDxPage'));
const ProblemListPage = lazy(() => import('../pages/doctor/diagnosis/ProblemListPage'));
const WritePrescriptionPage = lazy(() => import('../pages/doctor/prescriptions/WritePrescriptionPage'));
const PrescriptionHistoryPage = lazy(() => import('../pages/doctor/prescriptions/PrescriptionHistoryPage'));
const DrugInteractionsPage = lazy(() => import('../pages/doctor/prescriptions/DrugInteractionsPage'));
const FavoriteRxPage = lazy(() => import('../pages/doctor/prescriptions/FavoriteRxPage'));
const LabOrdersPage = lazy(() => import('../pages/doctor/orders/LabOrdersPage'));
const RadiologyOrdersPage = lazy(() => import('../pages/doctor/orders/RadiologyOrdersPage'));
const ProcedureOrdersPage = lazy(() => import('../pages/doctor/orders/ProcedureOrdersPage'));
const OrderSetsPage = lazy(() => import('../pages/doctor/orders/OrderSetsPage'));
const LabResultsPage = lazy(() => import('../pages/doctor/results/LabResultsPage'));
const ImagingResultsPage = lazy(() => import('../pages/doctor/results/ImagingResultsPage'));
const CriticalValuesPage = lazy(() => import('../pages/doctor/results/CriticalValuesPage'));
const NewReferralPage = lazy(() => import('../pages/doctor/referrals/NewReferralPage'));
const SentReferralsPage = lazy(() => import('../pages/doctor/referrals/SentReferralsPage'));
const ReferralsPage = lazy(() => import('../pages/ReferralsPage'));
const MedicalCertificatePage = lazy(() => import('../pages/doctor/certificates/MedicalCertificatePage'));
const SickLeavePage = lazy(() => import('../pages/doctor/certificates/SickLeavePage'));
const FitnessCertificatePage = lazy(() => import('../pages/doctor/certificates/FitnessCertificatePage'));
const DeathCertificatePage = lazy(() => import('../pages/doctor/certificates/DeathCertificatePage'));
const MedicalReportPage = lazy(() => import('../pages/doctor/MedicalReportPage'));
const InsuranceReportPage = lazy(() => import('../pages/doctor/InsuranceReportPage'));
const ScheduleFollowUpPage = lazy(() => import('../pages/doctor/followups/ScheduleFollowUpPage'));
const FollowUpsPage = lazy(() => import('../pages/FollowUpsPage'));
const OverdueFollowUpsPage = lazy(() => import('../pages/doctor/followups/OverdueFollowUpsPage'));

export default function DoctorRoutes() {
  return (
    <Routes>
      <Route index element={<ModuleRoute module="doctors"><DoctorRoute><DoctorDashboardPage /></DoctorRoute></ModuleRoute>} />
      <Route path="consult" element={<ModuleRoute module="doctors"><DoctorRoute><NewConsultationPage /></DoctorRoute></ModuleRoute>} />
      <Route path="queue" element={<ModuleRoute module="doctors"><DoctorRoute><WaitingPatientsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="queue/call" element={<ModuleRoute module="doctors"><DoctorRoute><CallNextPage /></DoctorRoute></ModuleRoute>} />
      <Route path="schedule" element={<ModuleRoute module="doctors"><DoctorRoute><TodaySchedulePage /></DoctorRoute></ModuleRoute>} />
      <Route path="pending" element={<ModuleRoute module="doctors"><DoctorRoute><PendingReviewsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="critical-results" element={<ModuleRoute module="doctors"><DoctorRoute><CriticalResultsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="encounters/new" element={<ModuleRoute module="doctors"><RoleRoute roles={[ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST]}><NewConsultationPage /></RoleRoute></ModuleRoute>} />
      <Route path="consultation/new" element={<ModuleRoute module="doctors"><Navigate to="/doctor/consult" replace /></ModuleRoute>} />
      <Route path="soap" element={<ModuleRoute module="doctors"><DoctorRoute><SOAPNotesPage /></DoctorRoute></ModuleRoute>} />
      <Route path="notes" element={<ModuleRoute module="doctors"><DoctorRoute><ClinicalNotesPage /></DoctorRoute></ModuleRoute>} />
      <Route path="encounters" element={<ModuleRoute module="doctors"><ClinicalRoute><EncountersPage /></ClinicalRoute></ModuleRoute>} />
      <Route path="diagnosis/icd" element={<ModuleRoute module="doctors"><DoctorRoute><ICD10CodingPage /></DoctorRoute></ModuleRoute>} />
      <Route path="diagnosis/differential" element={<ModuleRoute module="doctors"><DoctorRoute><DifferentialDxPage /></DoctorRoute></ModuleRoute>} />
      <Route path="diagnosis/problems" element={<ModuleRoute module="doctors"><DoctorRoute><ProblemListPage /></DoctorRoute></ModuleRoute>} />
      <Route path="prescriptions/new" element={<ModuleRoute module="doctors"><DoctorRoute><WritePrescriptionPage /></DoctorRoute></ModuleRoute>} />
      <Route path="prescriptions" element={<ModuleRoute module="doctors"><DoctorRoute><PrescriptionHistoryPage /></DoctorRoute></ModuleRoute>} />
      <Route path="prescriptions/interactions" element={<ModuleRoute module="doctors"><DoctorRoute><DrugInteractionsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="prescriptions/favorites" element={<ModuleRoute module="doctors"><DoctorRoute><FavoriteRxPage /></DoctorRoute></ModuleRoute>} />
      <Route path="orders/lab" element={<ModuleRoute module="doctors"><DoctorRoute><LabOrdersPage /></DoctorRoute></ModuleRoute>} />
      <Route path="orders/radiology" element={<ModuleRoute module="doctors"><DoctorRoute><RadiologyOrdersPage /></DoctorRoute></ModuleRoute>} />
      <Route path="orders/procedures" element={<ModuleRoute module="doctors"><DoctorRoute><ProcedureOrdersPage /></DoctorRoute></ModuleRoute>} />
      <Route path="orders/sets" element={<ModuleRoute module="doctors"><DoctorRoute><OrderSetsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="results/lab" element={<ModuleRoute module="doctors"><DoctorRoute><LabResultsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="results/imaging" element={<ModuleRoute module="doctors"><DoctorRoute><ImagingResultsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="results/critical" element={<ModuleRoute module="doctors"><DoctorRoute><CriticalValuesPage /></DoctorRoute></ModuleRoute>} />
      <Route path="referrals/new" element={<ModuleRoute module="doctors"><DoctorRoute><NewReferralPage /></DoctorRoute></ModuleRoute>} />
      <Route path="referrals/sent" element={<ModuleRoute module="doctors"><DoctorRoute><SentReferralsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="referrals/received" element={<ModuleRoute module="doctors"><DoctorRoute><ReferralsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="certificates/medical" element={<ModuleRoute module="doctors"><DoctorRoute><MedicalCertificatePage /></DoctorRoute></ModuleRoute>} />
      <Route path="certificates/sick-leave" element={<ModuleRoute module="doctors"><DoctorRoute><SickLeavePage /></DoctorRoute></ModuleRoute>} />
      <Route path="certificates/fitness" element={<ModuleRoute module="doctors"><DoctorRoute><FitnessCertificatePage /></DoctorRoute></ModuleRoute>} />
      <Route path="certificates/death" element={<ModuleRoute module="doctors"><DoctorRoute><DeathCertificatePage /></DoctorRoute></ModuleRoute>} />
      <Route path="report" element={<ModuleRoute module="doctors"><DoctorRoute><MedicalReportPage /></DoctorRoute></ModuleRoute>} />
      <Route path="report/insurance" element={<ModuleRoute module="doctors"><DoctorRoute><InsuranceReportPage /></DoctorRoute></ModuleRoute>} />
      <Route path="follow-ups/new" element={<ModuleRoute module="doctors"><DoctorRoute><ScheduleFollowUpPage /></DoctorRoute></ModuleRoute>} />
      <Route path="follow-ups" element={<ModuleRoute module="doctors"><DoctorRoute><FollowUpsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="follow-ups/overdue" element={<ModuleRoute module="doctors"><DoctorRoute><OverdueFollowUpsPage /></DoctorRoute></ModuleRoute>} />
    </Routes>
  );
}
