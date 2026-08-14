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

/**
 * Referral screens at /referrals/*, which is where the sidebar links.
 * Still served under /doctor/referrals/* for existing links.
 */
export default function ReferralsRoutes() {
  return (
    <Routes>
      <Route path="new" element={<ModuleRoute module="doctors"><DoctorRoute><NewReferralPage /></DoctorRoute></ModuleRoute>} />
      <Route path="sent" element={<ModuleRoute module="doctors"><DoctorRoute><SentReferralsPage /></DoctorRoute></ModuleRoute>} />
      <Route path="received" element={<ModuleRoute module="doctors"><DoctorRoute><ReferralsPage /></DoctorRoute></ModuleRoute>} />
    </Routes>
  );
}
