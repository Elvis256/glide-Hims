import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import ProtectedRoute from '../components/ProtectedRoute';
import { HRRoute } from '../components/RoleRoute';

const HRPage = lazy(() => import('../pages/HRPage'));
const MyPayslipsPage = lazy(() => import('../pages/hr/MyPayslipsPage'));
const MyLeavePage = lazy(() => import('../pages/hr/MyLeavePage'));
const MyAttendancePage = lazy(() => import('../pages/hr/MyAttendancePage'));
const MyAppraisalsPage = lazy(() => import('../pages/hr/MyAppraisalsPage'));
const StaffDirectoryPage = lazy(() => import('../pages/admin/hr/StaffDirectoryPage'));
const AdminDepartmentsPage = lazy(() => import('../pages/admin/hr/DepartmentsPage'));
const DesignationsPage = lazy(() => import('../pages/admin/hr/DesignationsPage'));
const ShiftManagementPage = lazy(() => import('../pages/admin/hr/ShiftManagementPage'));
const LeaveManagementPage = lazy(() => import('../pages/admin/hr/LeaveManagementPage'));
const CredentialsPage = lazy(() => import('../pages/admin/hr/CredentialsPage'));
const AttendancePage = lazy(() => import('../pages/admin/hr/AttendancePage'));
const PayrollPage = lazy(() => import('../pages/admin/hr/PayrollPage'));
const RecruitmentPage = lazy(() => import('../pages/admin/hr/RecruitmentPage'));
const AppraisalsPage = lazy(() => import('../pages/admin/hr/AppraisalsPage'));
const AppraisalDetailPage = lazy(() => import('../pages/admin/hr/AppraisalDetailPage'));
const TrainingPage = lazy(() => import('../pages/admin/hr/TrainingPage'));
const HRAnalyticsPage = lazy(() => import('../pages/admin/hr/HRAnalyticsPage'));
const HRLettersPage = lazy(() => import('../pages/admin/hr/HRLettersPage'));
const DisciplinaryPage = lazy(() => import('../pages/admin/hr/DisciplinaryPage'));
const OnboardingPage = lazy(() => import('../pages/admin/hr/OnboardingPage'));
const PayrollReportsPage = lazy(() => import('../pages/admin/hr/PayrollReportsPage'));

export default function HRRoutes() {
  return (
    <Routes>
      <Route index element={<ModuleRoute module="hr"><HRRoute><HRPage /></HRRoute></ModuleRoute>} />
      <Route path="staff" element={<ModuleRoute module="hr"><HRRoute><StaffDirectoryPage /></HRRoute></ModuleRoute>} />
      <Route path="departments" element={<ModuleRoute module="hr"><HRRoute><AdminDepartmentsPage /></HRRoute></ModuleRoute>} />
      <Route path="designations" element={<ModuleRoute module="hr"><HRRoute><DesignationsPage /></HRRoute></ModuleRoute>} />
      <Route path="shifts" element={<ModuleRoute module="hr"><HRRoute><ShiftManagementPage /></HRRoute></ModuleRoute>} />
      <Route path="leave" element={<ModuleRoute module="hr"><HRRoute><LeaveManagementPage /></HRRoute></ModuleRoute>} />
      <Route path="credentials" element={<ModuleRoute module="hr"><HRRoute><CredentialsPage /></HRRoute></ModuleRoute>} />
      <Route path="attendance" element={<ModuleRoute module="hr"><HRRoute><AttendancePage /></HRRoute></ModuleRoute>} />
      <Route path="payroll" element={<ModuleRoute module="hr"><HRRoute><PayrollPage /></HRRoute></ModuleRoute>} />
      <Route path="recruitment" element={<ModuleRoute module="hr"><HRRoute><RecruitmentPage /></HRRoute></ModuleRoute>} />
      <Route path="appraisals" element={<ModuleRoute module="hr"><HRRoute><AppraisalsPage /></HRRoute></ModuleRoute>} />
      <Route path="appraisals/:id" element={<ModuleRoute module="hr"><HRRoute><AppraisalDetailPage /></HRRoute></ModuleRoute>} />
      <Route path="training" element={<ModuleRoute module="hr"><HRRoute><TrainingPage /></HRRoute></ModuleRoute>} />
      <Route path="analytics" element={<ModuleRoute module="hr"><HRRoute><HRAnalyticsPage /></HRRoute></ModuleRoute>} />
      <Route path="letters" element={<ModuleRoute module="hr"><HRRoute><HRLettersPage /></HRRoute></ModuleRoute>} />
      <Route path="disciplinary" element={<ModuleRoute module="hr"><HRRoute><DisciplinaryPage /></HRRoute></ModuleRoute>} />
      <Route path="onboarding" element={<ModuleRoute module="hr"><HRRoute><OnboardingPage /></HRRoute></ModuleRoute>} />
      <Route path="payroll-reports" element={<ModuleRoute module="hr"><HRRoute><PayrollReportsPage /></HRRoute></ModuleRoute>} />
      <Route path="my-payslips" element={<ModuleRoute module="hr"><ProtectedRoute><MyPayslipsPage /></ProtectedRoute></ModuleRoute>} />
      <Route path="my-leave" element={<ModuleRoute module="hr"><ProtectedRoute><MyLeavePage /></ProtectedRoute></ModuleRoute>} />
      <Route path="my-attendance" element={<ModuleRoute module="hr"><ProtectedRoute><MyAttendancePage /></ProtectedRoute></ModuleRoute>} />
      <Route path="my-appraisals" element={<ModuleRoute module="hr"><ProtectedRoute><MyAppraisalsPage /></ProtectedRoute></ModuleRoute>} />
    </Routes>
  );
}
