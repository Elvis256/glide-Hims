import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import PatientsPage from './pages/PatientsPage';
import FacilitiesPage from './pages/FacilitiesPage';
import RolesPage from './pages/RolesPage';
import EncountersPage from './pages/EncountersPage';
import EncounterDetailPage from './pages/EncounterDetailPage';
import PharmacyPage from './pages/PharmacyPage';
import CashierPage from './pages/CashierPage';
import InventoryPage from './pages/InventoryPage';
import LabPage from './pages/LabPage';
import RadiologyPage from './pages/RadiologyPage';
import WardManagementPage from './pages/WardManagementPage';
import EmergencyPage from './pages/EmergencyPage';
import TheatrePage from './pages/TheatrePage';
import MaternityPage from './pages/MaternityPage';
import HRPage from './pages/HRPage';
import FinancePage from './pages/FinancePage';
import InsurancePage from './pages/InsurancePage';
import AnalyticsPage from './pages/AnalyticsPage';
import MembershipPage from './pages/MembershipPage';
import ServicesPage from './pages/ServicesPage';
import StoresPage from './pages/StoresPage';
import OrdersPage from './pages/OrdersPage';
import TenantsPage from './pages/TenantsPage';
import VitalsPage from './pages/VitalsPage';
import ClinicalNotesPage from './pages/ClinicalNotesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/encounters" element={<EncountersPage />} />
                <Route path="/encounters/:id" element={<EncounterDetailPage />} />
                <Route path="/pharmacy" element={<PharmacyPage />} />
                <Route path="/cashier" element={<CashierPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/lab" element={<LabPage />} />
                <Route path="/radiology" element={<RadiologyPage />} />
                <Route path="/wards" element={<WardManagementPage />} />
                <Route path="/emergency" element={<EmergencyPage />} />
                <Route path="/theatre" element={<TheatrePage />} />
                <Route path="/maternity" element={<MaternityPage />} />
                <Route path="/hr" element={<HRPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/insurance" element={<InsurancePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/membership" element={<MembershipPage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/stores" element={<StoresPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/vitals" element={<VitalsPage />} />
                <Route path="/clinical-notes" element={<ClinicalNotesPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/facilities" element={<FacilitiesPage />} />
                <Route path="/roles" element={<RolesPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
