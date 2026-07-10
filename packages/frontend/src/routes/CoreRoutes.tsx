import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ModuleRoute from '../components/ModuleRoute';
import RoleRoute, {
  AdminRoute, ClinicalRoute, FinanceRoute,
  PharmacistRoute, DoctorRoute, NurseRoute, CashierRoute,
  StoreKeeperRoute, InsuranceRoute, ReceptionistRoute
} from '../components/RoleRoute';
import { ROLES } from '../components/RoleRoute';
import ProtectedRoute from '../components/ProtectedRoute';

const HRRoutes = lazy(() => import('./HRRoutes'));
const EncounterDetailPage = lazy(() => import('../pages/EncounterDetailPage'));
const EncountersPage = lazy(() => import('../pages/EncountersPage'));
const PatientsPage = lazy(() => import('../pages/PatientsPage'));
const PatientSearchPage = lazy(() => import('../pages/PatientSearchPage'));
const PatientRegistrationPage = lazy(() => import('../pages/PatientRegistrationPage'));
const PatientDocumentsPage = lazy(() => import('../pages/PatientDocumentsPage'));
const PatientHistoryPage = lazy(() => import('../pages/PatientHistoryPage'));
const PatientEditPage = lazy(() => import('../pages/PatientEditPage'));
const PatientDetailPage = lazy(() => import('../pages/PatientDetailPage'));
const HospitalSchemeEnrollmentPage = lazy(() => import('../pages/HospitalSchemeEnrollmentPage'));
const OPDTokenPage = lazy(() => import('../pages/OPDTokenPage'));
const QueueManagementPage = lazy(() => import('../pages/QueueManagementPage'));
const QueueMonitorPage = lazy(() => import('../pages/QueueMonitorPage'));
const CallNextPatientPage = lazy(() => import('../pages/CallNextPatientPage'));
const QueueAnalyticsPage = lazy(() => import('../pages/QueueAnalyticsPage'));
const PatientJourneyPage = lazy(() => import('../pages/PatientJourneyPage'));
const DoctorsOnDutyPage = lazy(() => import('../pages/DoctorsOnDutyPage'));
const BookAppointmentPage = lazy(() => import('../pages/BookAppointmentPage'));
const ViewAppointmentsPage = lazy(() => import('../pages/ViewAppointmentsPage'));
const DoctorSchedulesPage = lazy(() => import('../pages/DoctorSchedulesPage'));
const ManageAppointmentsPage = lazy(() => import('../pages/ManageAppointmentsPage'));
const InventoryPage = lazy(() => import('../pages/InventoryPage'));
const InsuranceDashboardPage = lazy(() => import('../pages/insurance/InsuranceDashboardPage'));
const InsurancePage = lazy(() => import('../pages/InsurancePage'));
const MembershipPage = lazy(() => import('../pages/MembershipPage'));
const TenantsPage = lazy(() => import('../pages/TenantsPage'));
const ClinicalNotesPage = lazy(() => import('../pages/ClinicalNotesPage'));
const ReferralsPage = lazy(() => import('../pages/ReferralsPage'));
const IPDDischargePage = lazy(() => import('../pages/ipd/DischargePage'));
const FacilitiesPage = lazy(() => import('../pages/FacilitiesPage'));
const SyncStatusPage = lazy(() => import('../pages/sync/SyncStatusPage'));
const ConflictResolutionPage = lazy(() => import('../pages/sync/ConflictResolutionPage'));
const ProviderCredentialsPage = lazy(() => import('../pages/providers/ProviderCredentialsPage'));
const DrugInteractionsDatabasePage = lazy(() => import('../pages/drug-management/DrugInteractionsDatabasePage'));


const UsersPage = lazy(() => import('../pages/UsersPage'));
const RolesPage = lazy(() => import('../pages/RolesPage'));
const CashierPage = lazy(() => import('../pages/CashierPage'));
const WardManagementPage = lazy(() => import('../pages/WardManagementPage'));
const FinancePage = lazy(() => import('../pages/FinancePage'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'));
const ServicesPage = lazy(() => import('../pages/ServicesPage'));
const OrdersPage = lazy(() => import('../pages/OrdersPage'));
const VitalsPage = lazy(() => import('../pages/VitalsPage'));
const TreatmentPlansPage = lazy(() => import('../pages/TreatmentPlansPage'));
const ItemClassificationsPage = lazy(() => import('../pages/settings/ItemClassificationsPage'));
const OfflineQueuePage = lazy(() => import('../pages/sync/OfflineQueuePage'));
const ProviderDirectoryPage = lazy(() => import('../pages/providers/ProviderDirectoryPage'));
const DrugClassificationsPage = lazy(() => import('../pages/drug-management/DrugClassificationsPage'));
const AllergyClassesPage = lazy(() => import('../pages/drug-management/AllergyClassesPage'));

export default function CoreRoutes() {
  return (
    <Routes>
{/* Pharmacy routes moved to PharmacyRoutes */}
                
                
                
                
                
                
                {/* Stores expiry redirects moved to StoresRoutes */}
                <Route path="/settings/classifications" element={<ModuleRoute module="stores"><AdminRoute><ItemClassificationsPage /></AdminRoute></ModuleRoute>} />
                
                {/* OPD */}
                <Route path="/encounters/:id" element={<ModuleRoute module="doctors"><ClinicalRoute><EncounterDetailPage /></ClinicalRoute></ModuleRoute>} />
                {/* Clinical */}
                <Route path="/cashier" element={<ModuleRoute module="billing"><CashierRoute><CashierPage /></CashierRoute></ModuleRoute>} />
                <Route path="/inventory" element={<ModuleRoute module="stores"><StoreKeeperRoute><InventoryPage /></StoreKeeperRoute></ModuleRoute>} />
                {/* /lab and /radiology handled by LaboratoryRoutes and RadiologyRoutes index routes */}
                <Route path="/wards" element={<ModuleRoute module="ipd"><ClinicalRoute><WardManagementPage /></ClinicalRoute></ModuleRoute>} />
                {/* /emergency handled by EmergencyRoutes index; /theatre and /maternity handled by IPDRoutes */}
                {/* Admin & Finance */}
                <Route path="/hr/*" element={<HRRoutes />} />
                <Route path="/finance" element={<ModuleRoute module="finance"><FinanceRoute><FinancePage /></FinanceRoute></ModuleRoute>} />
                <Route path="/insurance/dashboard" element={<ModuleRoute module="billing"><InsuranceRoute><InsuranceDashboardPage /></InsuranceRoute></ModuleRoute>} />
                <Route path="/insurance" element={<ModuleRoute module="billing"><InsuranceRoute><InsurancePage /></InsuranceRoute></ModuleRoute>} />
                <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
                <Route path="/membership" element={<ModuleRoute module="billing"><AdminRoute><MembershipPage /></AdminRoute></ModuleRoute>} />
                <Route path="/services" element={<AdminRoute><ServicesPage /></AdminRoute>} />
                {/* /stores handled by StoresRoutes index redirect */}
                <Route path="/orders" element={<ModuleRoute module="doctors"><DoctorRoute><OrdersPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/tenants" element={<AdminRoute><TenantsPage /></AdminRoute>} />
                <Route path="/vitals" element={<ModuleRoute module="nursing"><ClinicalRoute><VitalsPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/clinical-notes" element={<ModuleRoute module="doctors"><DoctorRoute><ClinicalNotesPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/referrals" element={<ModuleRoute module="doctors"><DoctorRoute><ReferralsPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/treatment-plans" element={<ModuleRoute module="doctors"><DoctorRoute><TreatmentPlansPage /></DoctorRoute></ModuleRoute>} />
                <Route path="/discharge" element={<ModuleRoute module="ipd"><DoctorRoute><IPDDischargePage /></DoctorRoute></ModuleRoute>} />
                <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                <Route path="/facilities" element={<AdminRoute><FacilitiesPage /></AdminRoute>} />
                <Route path="/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
                

                
                
                
                
                
                
                
                
                
                
                
                {/* Sync Module */}
                <Route path="/sync/status" element={<AdminRoute><SyncStatusPage /></AdminRoute>} />
                <Route path="/sync/queue" element={<AdminRoute><OfflineQueuePage /></AdminRoute>} />
                <Route path="/sync/conflicts" element={<AdminRoute><ConflictResolutionPage /></AdminRoute>} />
                
                {/* Providers Module */}
                <Route path="/providers/directory" element={<AdminRoute><ProviderDirectoryPage /></AdminRoute>} />
                <Route path="/providers/credentials" element={<AdminRoute><ProviderCredentialsPage /></AdminRoute>} />
                
                {/* Drug Management */}
                <Route path="/drug-management/classifications" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugClassificationsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/drug-management/interactions" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DrugInteractionsDatabasePage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/drug-management/allergy-classes" element={<ModuleRoute module="pharmacy"><PharmacistRoute><AllergyClassesPage /></PharmacistRoute></ModuleRoute>} />

                {/* Registration — top-level routes (nav links use /patients, /opd/token, etc.) */}
                <Route path="/patients/search" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientSearchPage /></ProtectedRoute>} />
                <Route path="/patients/new" element={<ProtectedRoute requiredPermissions={['patients.create']}><PatientRegistrationPage /></ProtectedRoute>} />
                <Route path="/patients/hospital-scheme-enroll" element={<ReceptionistRoute><HospitalSchemeEnrollmentPage /></ReceptionistRoute>} />
                <Route path="/patients/documents" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDocumentsPage /></ProtectedRoute>} />
                <Route path="/patients/history" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientHistoryPage /></ProtectedRoute>} />
                <Route path="/patients/:id/edit" element={<ProtectedRoute requiredPermissions={['patients.update']}><PatientEditPage /></ProtectedRoute>} />
                <Route path="/patients/:id" element={<ProtectedRoute requiredPermissions={['patients.read']}><PatientDetailPage /></ProtectedRoute>} />
                <Route path="/patients" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.CASHIER, ROLES.LAB_TECHNICIAN, ROLES.PHARMACIST, ROLES.RADIOLOGIST, ROLES.ADMIN]}><PatientsPage /></RoleRoute>} />
                <Route path="/opd/token" element={<ReceptionistRoute><OPDTokenPage /></ReceptionistRoute>} />
                <Route path="/encounters" element={<ModuleRoute module="doctors"><ClinicalRoute><EncountersPage /></ClinicalRoute></ModuleRoute>} />
                <Route path="/doctors/on-duty" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR]}><DoctorsOnDutyPage /></RoleRoute>} />
                <Route path="/queue/monitor" element={<ReceptionistRoute><QueueMonitorPage /></ReceptionistRoute>} />
                <Route path="/queue/call" element={<ReceptionistRoute><CallNextPatientPage /></ReceptionistRoute>} />
                <Route path="/queue/analytics" element={<ReceptionistRoute><QueueAnalyticsPage /></ReceptionistRoute>} />
                <Route path="/queue/journey" element={<RoleRoute roles={[ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.NURSE, ROLES.ADMIN]}><PatientJourneyPage /></RoleRoute>} />
                <Route path="/queue" element={<ReceptionistRoute><QueueManagementPage /></ReceptionistRoute>} />
                <Route path="/triage" element={<NurseRoute><QueueManagementPage /></NurseRoute>} />
                <Route path="/appointments/new" element={<ReceptionistRoute><BookAppointmentPage /></ReceptionistRoute>} />
                <Route path="/appointments" element={<ReceptionistRoute><ViewAppointmentsPage /></ReceptionistRoute>} />
                <Route path="/schedules/doctors" element={<ReceptionistRoute><DoctorSchedulesPage /></ReceptionistRoute>} />
                <Route path="/appointments/manage" element={<ReceptionistRoute><ManageAppointmentsPage /></ReceptionistRoute>} />
    </Routes>
  );
}
