import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import { NurseRoute } from '../components/RoleRoute';

// Lazy-loaded pages
const RecordVitalsPage = lazy(() => import('../pages/nursing/RecordVitalsPage'));
const VitalsHistoryPage = lazy(() => import('../pages/nursing/VitalsHistoryPage'));
const VitalTrendsPage = lazy(() => import('../pages/nursing/VitalTrendsPage'));
const AbnormalAlertsPage = lazy(() => import('../pages/nursing/AbnormalAlertsPage'));
const TriageQueuePage = lazy(() => import('../pages/nursing/TriageQueuePage'));
const NursingAssessmentPage = lazy(() => import('../pages/nursing/NursingAssessmentPage'));
const PainAssessmentPage = lazy(() => import('../pages/nursing/PainAssessmentPage'));
const FallRiskPage = lazy(() => import('../pages/nursing/FallRiskPage'));
const MedicationSchedulePage = lazy(() => import('../pages/nursing/MedicationSchedulePage'));
const AdministerMedsPage = lazy(() => import('../pages/nursing/AdministerMedsPage'));
const MedicationChartPage = lazy(() => import('../pages/nursing/MedicationChartPage'));
const DrugAllergiesPage = lazy(() => import('../pages/nursing/DrugAllergiesPage'));
const WoundAssessmentPage = lazy(() => import('../pages/nursing/WoundAssessmentPage'));
const DressingLogPage = lazy(() => import('../pages/nursing/DressingLogPage'));
const WoundProgressPage = lazy(() => import('../pages/nursing/WoundProgressPage'));
const CarePlansPage = lazy(() => import('../pages/nursing/CarePlansPage'));
const NursingNotesPage = lazy(() => import('../pages/nursing/NursingNotesPage'));
const ShiftHandoverPage = lazy(() => import('../pages/nursing/ShiftHandoverPage'));
const PatientEducationPage = lazy(() => import('../pages/nursing/PatientEducationPage'));
const IVCannulationPage = lazy(() => import('../pages/nursing/IVCannulationPage'));
const CatheterizationPage = lazy(() => import('../pages/nursing/CatheterizationPage'));
const SpecimenCollectionPage = lazy(() => import('../pages/nursing/SpecimenCollectionPage'));
const ProcedureLogPage = lazy(() => import('../pages/nursing/ProcedureLogPage'));
const PatientMonitorPage = lazy(() => import('../pages/nursing/PatientMonitorPage'));
const IntakeOutputPage = lazy(() => import('../pages/nursing/IntakeOutputPage'));
const BloodSugarPage = lazy(() => import('../pages/nursing/BloodSugarPage'));
const ObservationChartPage = lazy(() => import('../pages/nursing/ObservationChartPage'));
const NursingDailyReportPage = lazy(() => import('../pages/nursing/NursingDailyReportPage'));
const ShiftSummaryPage = lazy(() => import('../pages/nursing/ShiftSummaryPage'));
const IncidentReportPage = lazy(() => import('../pages/nursing/IncidentReportPage'));
const WorkloadStatsPage = lazy(() => import('../pages/nursing/WorkloadStatsPage'));

export default function NursingRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/nursing/vitals/new" replace />} />
      <Route path="vitals/new" element={<ModuleRoute module="nursing"><NurseRoute><RecordVitalsPage /></NurseRoute></ModuleRoute>} />
      <Route path="vitals/history" element={<ModuleRoute module="nursing"><NurseRoute><VitalsHistoryPage /></NurseRoute></ModuleRoute>} />
      <Route path="vitals/trends" element={<ModuleRoute module="nursing"><NurseRoute><VitalTrendsPage /></NurseRoute></ModuleRoute>} />
      <Route path="vitals/alerts" element={<ModuleRoute module="nursing"><NurseRoute><AbnormalAlertsPage /></NurseRoute></ModuleRoute>} />
      <Route path="triage" element={<ModuleRoute module="nursing"><NurseRoute><TriageQueuePage /></NurseRoute></ModuleRoute>} />
      <Route path="assessment" element={<ModuleRoute module="nursing"><NurseRoute><NursingAssessmentPage /></NurseRoute></ModuleRoute>} />
      <Route path="pain" element={<ModuleRoute module="nursing"><NurseRoute><PainAssessmentPage /></NurseRoute></ModuleRoute>} />
      <Route path="fall-risk" element={<ModuleRoute module="nursing"><NurseRoute><FallRiskPage /></NurseRoute></ModuleRoute>} />
      <Route path="meds/schedule" element={<ModuleRoute module="nursing"><NurseRoute><MedicationSchedulePage /></NurseRoute></ModuleRoute>} />
      <Route path="meds/administer" element={<ModuleRoute module="nursing"><NurseRoute><AdministerMedsPage /></NurseRoute></ModuleRoute>} />
      <Route path="meds/chart" element={<ModuleRoute module="nursing"><NurseRoute><MedicationChartPage /></NurseRoute></ModuleRoute>} />
      <Route path="meds/allergies" element={<ModuleRoute module="nursing"><NurseRoute><DrugAllergiesPage /></NurseRoute></ModuleRoute>} />
      <Route path="wounds/assess" element={<ModuleRoute module="nursing"><NurseRoute><WoundAssessmentPage /></NurseRoute></ModuleRoute>} />
      <Route path="wounds/dressing" element={<ModuleRoute module="nursing"><NurseRoute><DressingLogPage /></NurseRoute></ModuleRoute>} />
      <Route path="wounds/progress" element={<ModuleRoute module="nursing"><NurseRoute><WoundProgressPage /></NurseRoute></ModuleRoute>} />
      <Route path="care-plans" element={<ModuleRoute module="nursing"><NurseRoute><CarePlansPage /></NurseRoute></ModuleRoute>} />
      <Route path="notes" element={<ModuleRoute module="nursing"><NurseRoute><NursingNotesPage /></NurseRoute></ModuleRoute>} />
      <Route path="handover" element={<ModuleRoute module="nursing"><NurseRoute><ShiftHandoverPage /></NurseRoute></ModuleRoute>} />
      <Route path="education" element={<ModuleRoute module="nursing"><NurseRoute><PatientEducationPage /></NurseRoute></ModuleRoute>} />
      <Route path="procedures/iv" element={<ModuleRoute module="nursing"><NurseRoute><IVCannulationPage /></NurseRoute></ModuleRoute>} />
      <Route path="procedures/catheter" element={<ModuleRoute module="nursing"><NurseRoute><CatheterizationPage /></NurseRoute></ModuleRoute>} />
      <Route path="procedures/specimen" element={<ModuleRoute module="nursing"><NurseRoute><SpecimenCollectionPage /></NurseRoute></ModuleRoute>} />
      <Route path="procedures/log" element={<ModuleRoute module="nursing"><NurseRoute><ProcedureLogPage /></NurseRoute></ModuleRoute>} />
      <Route path="monitor" element={<ModuleRoute module="nursing"><NurseRoute><PatientMonitorPage /></NurseRoute></ModuleRoute>} />
      <Route path="io" element={<ModuleRoute module="nursing"><NurseRoute><IntakeOutputPage /></NurseRoute></ModuleRoute>} />
      <Route path="glucose" element={<ModuleRoute module="nursing"><NurseRoute><BloodSugarPage /></NurseRoute></ModuleRoute>} />
      <Route path="observations" element={<ModuleRoute module="nursing"><NurseRoute><ObservationChartPage /></NurseRoute></ModuleRoute>} />
      <Route path="reports/daily" element={<ModuleRoute module="nursing"><NurseRoute><NursingDailyReportPage /></NurseRoute></ModuleRoute>} />
      <Route path="reports/shift" element={<ModuleRoute module="nursing"><NurseRoute><ShiftSummaryPage /></NurseRoute></ModuleRoute>} />
      <Route path="reports/incident" element={<ModuleRoute module="nursing"><NurseRoute><IncidentReportPage /></NurseRoute></ModuleRoute>} />
      <Route path="reports/workload" element={<ModuleRoute module="nursing"><NurseRoute><WorkloadStatsPage /></NurseRoute></ModuleRoute>} />
    </Routes>
  );
}
