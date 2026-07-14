import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { Toaster, toast } from 'sonner';
import { ConfirmProvider } from './components/ConfirmDialog';
import { useAuthStore } from './store/auth';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { api, getApiErrorMessage, SESSION_EXPIRED_EVENT } from './services/api';
import { isTenantSubdomain, getEffectiveTenantSlug } from './lib/tenant';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleRoute from './components/ModuleRoute';
import RoleRoute, {
  DoctorRoute,
  NurseRoute,
  ClinicalRoute,
  PharmacistRoute,
  LabTechRoute,
  ReceptionistRoute,
  CashierRoute,
  StoreKeeperRoute,
  AccountantRoute,
  AdminRoute,
  SystemAdminRoute,
  FinanceRoute,
  HRRoute,
  BillingRoute,
  InsuranceRoute,
  RadiologyRoute,
  AssetsRoute,
  ROLES,
} from './components/RoleRoute';
import DashboardLayout from './components/DashboardLayout';
import ImpersonationBanner from './components/ImpersonationBanner';
import { PageLoader } from './components/PageLoader';

// Lazy-loaded page components (route-based code splitting)
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SystemRoutes = lazy(() => import('./routes/SystemRoutes'));
const NursingRoutes = lazy(() => import('./routes/NursingRoutes'));
const DoctorRoutes = lazy(() => import('./routes/DoctorRoutes'));
const BillingRoutes = lazy(() => import('./routes/BillingRoutes'));
// RegistrationRoutes removed — all registration routes now in CoreRoutes at root level
const EmergencyRoutes = lazy(() => import('./routes/EmergencyRoutes'));
const LaboratoryRoutes = lazy(() => import('./routes/LaboratoryRoutes'));
const RadiologyRoutes = lazy(() => import('./routes/RadiologyRoutes'));
const PharmacyRoutes = lazy(() => import('./routes/PharmacyRoutes'));
const IPDRoutes = lazy(() => import('./routes/IPDRoutes'));
const StoresRoutes = lazy(() => import('./routes/StoresRoutes'));
const AdminRoutes = lazy(() => import('./routes/AdminRoutes'));
const POSRoutes = lazy(() => import('./routes/POSRoutes'));
const HRRoutes = lazy(() => import('./routes/HRRoutes'));
const ReportRoutes = lazy(() => import('./routes/ReportRoutes'));
const AssetRoutes = lazy(() => import('./routes/AssetRoutes'));
const CoreRoutes = lazy(() => import('./routes/CoreRoutes'));
const SupplierFinanceRoutes = lazy(() => import('./routes/SupplierFinanceRoutes'));
const LabQCRoutes = lazy(() => import('./routes/LabQCRoutes'));
const MDMRoutes = lazy(() => import('./routes/MDMRoutes'));
const ChronicCareRoutes = lazy(() => import('./routes/ChronicCareRoutes'));
const NotificationRoutes = lazy(() => import('./routes/NotificationRoutes'));
const IntegrationRoutes = lazy(() => import('./routes/IntegrationRoutes'));

const PortalLoginPage = lazy(() => import('./pages/portal/PortalLoginPage'));
const PortalDashboardPage = lazy(() => import('./pages/portal/PortalDashboardPage'));
const SystemLoginPage = lazy(() => import('./pages/system/SystemLoginPage'));
const SystemAdminLayout = lazy(() => import('./pages/system/SystemAdminLayout'));
const PublicPricingPage = lazy(() => import('./pages/PublicPricingPage'));
const BillingPortalPage = lazy(() => import('./pages/BillingPortalPage'));
const DownloadsPage = lazy(() => import('./pages/DownloadsPage'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizardPage'));
const TenantSetupWizardPage = lazy(() => import('./pages/TenantSetupWizardPage'));
const RegisterOrganizationPage = lazy(() => import('./pages/RegisterOrganizationPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const MyProfilePage = lazy(() => import('./pages/MyProfilePage'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));
const PublicLandingPage = lazy(() => import('./pages/Public/PublicLandingPage'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SmartDashboardPage = lazy(() => import('./pages/SmartDashboardPage'));
const FacilitiesPage = lazy(() => import('./pages/FacilitiesPage'));
const EncounterDetailPage = lazy(() => import('./pages/EncounterDetailPage'));
// PharmacyPage legacy view removed in audit Phase 1.3 — /pharmacy now redirects to /pharmacy/dashboard
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const RadiologyPage = lazy(() => import('./pages/RadiologyPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const TheatrePage = lazy(() => import('./pages/TheatrePage'));
const MaternityPage = lazy(() => import('./pages/MaternityPage'));
const InsurancePage = lazy(() => import('./pages/InsurancePage'));
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
// StoresPage legacy view removed in audit Phase 1.2 (no route bound it; superseded by MainInventoryPage)
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DischargePage = lazy(() => import('./pages/DischargePage'));
const InsuranceDashboardPage = lazy(() => import('./pages/insurance/InsuranceDashboardPage'));
const CriticalResultsReadOnlyPage = lazy(() => import('./components/CriticalResultsReadOnlyPage'));
// PharmacyAdjustmentsPage and PharmacyTransfersPage removed in audit Phase 3.4 — superseded by
// canonical /inventory/adjustments and /inventory/transfers.
const RetailSalesPage = lazy(() => import('./pages/pharmacy/transactions/RetailSalesPage'));
const WholesalePage = lazy(() => import('./pages/pharmacy/transactions/WholesalePage'));
// Audit Phase 3.5 — promoted from pages/pharmacy/expiry/* to pages/expiry/* so the workflow
// is no longer scoped to pharmacy in the file tree (it serves stores too).
const ExpiringSoonPage = lazy(() => import('./pages/expiry/ExpiringSoonPage'));
const ExpiredItemsPage = lazy(() => import('./pages/expiry/ExpiredItemsPage'));
const ExpiryAlertsPage = lazy(() => import('./pages/expiry/ExpiryAlertsPage'));
const DisposalLogPage = lazy(() => import('./pages/expiry/DisposalLogPage'));
const ReturnToSupplierPage = lazy(() => import('./pages/expiry/ReturnToSupplierPage'));
// Pharmacy procurement & supplier pages removed in audit Phase 3.1 — these routes
// now redirect to the canonical /procurement/* pages.
const ExpiryManagementPage = lazy(() => import('./pages/expiry/ExpiryManagementPage'));
// MainInventoryPage removed in audit Phase 3.3 — superseded by canonical InventoryPage at /inventory.
// StoreTransfersPage removed in audit Phase 1.4 (no route bound it; use StockTransferPage)
// Stores procurement & supplier pages removed in audit Phase 3.2 — these routes
// now redirect to the canonical /procurement/* pages.
const ApprovalsInboxPage = lazy(() => import('./pages/approvals/ApprovalsInboxPage'));
const SyncStatusPage = lazy(() => import('./pages/sync/SyncStatusPage'));
const ConflictResolutionPage = lazy(() => import('./pages/sync/ConflictResolutionPage'));
const ProviderCredentialsPage = lazy(() => import('./pages/providers/ProviderCredentialsPage'));
const DrugInteractionsDatabasePage = lazy(() => import('./pages/drug-management/DrugInteractionsDatabasePage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Never retry 401/403 auth errors — let the interceptor handle them
        if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        // Global error handler for mutations - shows toast with user-friendly message
        toast.error(getApiErrorMessage(error));
      },
    },
  },
});

/**
 * Guard for /login/:slug route.
 * If authenticated and the slug matches the current tenant, redirect to dashboard.
 * If authenticated but slug is for a DIFFERENT tenant, log out first so they can log into the correct org.
 * If not authenticated, show the login page.
 */
function LoginRouteGuard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { slug: routeSlug } = useParams<{ slug: string }>();
  const slug = getEffectiveTenantSlug(routeSlug);
  const { logout } = useAuthStore();
  const [pendingSetup, setPendingSetup] = useState<boolean | null>(null);

  useEffect(() => {
    if (!slug) { setPendingSetup(false); return; }
    let cancelled = false;
    api.get(`/tenants/public/by-slug/${slug}`)
      .then(res => { if (!cancelled) setPendingSetup((res.data as any)?.isSetupComplete === false); })
      .catch(() => { if (!cancelled) setPendingSetup(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (slug && pendingSetup === null) {
    return <PageLoader />;
  }

  // Tenant needs setup — go straight to wizard, regardless of auth state
  if (slug && pendingSetup) {
    return <Navigate to={`/setup/${slug}`} replace />;
  }

  if (!isAuthenticated) {
    return <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>;
  }

  const currentSlug = localStorage.getItem('glide_tenant_slug');

  if (!slug || slug === currentSlug) {
    return <Navigate to="/" replace />;
  }

  logout();
  return <Suspense fallback={<PageLoader />}><LoginPage /></Suspense>;
}

function AppRoutes() {
  const { isAuthenticated, logout, accessToken, refreshToken, setTokens } = useAuthStore();
  const [setupChecked, setSetupChecked] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(true);
  const [deploymentMode, setDeploymentMode] = useState<string>('on-premise');

  // Cancel all in-flight queries immediately when session expires
  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.cancelQueries();
      queryClient.clear();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  // Check setup status and validate token on initial app load
  useEffect(() => {
    const checkSetup = async () => {
      // Skip check if on setup or register page — ensure wizard can render
      if (window.location.pathname.startsWith('/setup') || window.location.pathname === '/register') {
        setIsSetupComplete(false);
        setSetupChecked(true);
        return;
      }

      // If user is authenticated (per persisted flag), rehydrate the user
      // object from the backend using the httpOnly auth cookie. We no
      // longer persist the user object (or any in-memory tokens) to
      // localStorage, so this rehydrate is required for any reloaded tab.
      // Single /auth/me call returns everything (profile + permissions +
      // roles + modules), eliminating the old sequential two-call waterfall.
      if (isAuthenticated) {
        try {
          const { authService } = await import('./services/auth');
          const { useAuthStore } = await import('./store/auth');

          const meData = await authService.getMe();
          useAuthStore.getState().setUser(meData as any);
          useAuthStore.getState().updateFromMe(meData);

          console.log('[App] Auth rehydrated from cookie');
        } catch (err) {
          // Cookie missing or refresh failed — fall back to logout. The
          // axios interceptor already attempts a refresh on 401, so a
          // hard error here means the session is truly gone.
          console.log('[App] Auth rehydrate failed, logging out', err);
          await logout();
        }
        setIsSetupComplete(true);
        setSetupChecked(true);
        return;
      }
      
      // Retry loop: backend may still be starting on first boot (30-60s for postgres + migrations)
      const MAX_RETRIES = 5;
      const RETRY_DELAY = 3000;
      let retries = 0;

      while (retries < MAX_RETRIES) {
        try {
          const status = await import('./services/setup').then(m => m.setupService.getStatus());
          console.log('[App] Setup status:', status);
          setDeploymentMode(status.deploymentMode || 'on-premise');
          setIsSetupComplete(status.isSetupComplete);

          // If setup not complete, clear any stale auth
          if (!status.isSetupComplete) {
            console.log('[App] Setup not complete, clearing auth');
            await logout();
          }
          break;
        } catch (err) {
          retries++;
          console.warn(`[App] Setup check attempt ${retries}/${MAX_RETRIES} failed:`, err);
          if (retries < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAY));
          } else {
            // All retries exhausted — default to NOT complete (safer: shows setup wizard)
            console.error('[App] Setup check failed after all retries, defaulting to setup incomplete');
            setIsSetupComplete(false);
          }
        }
      }
      setSetupChecked(true);
    };
    checkSetup();
  }, []); // Run only once on mount

  // Show loading while checking setup
  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Connecting to server...</p>
        </div>
      </div>
    );
  }

  // Redirect to setup if not complete (allow tenant setup wizard and system routes through)
  if (!isSetupComplete && !window.location.pathname.startsWith('/setup') && !window.location.pathname.startsWith('/system') && !window.location.pathname.startsWith('/change-password')) {
    return <Navigate to="/setup" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <ImpersonationBanner />
    <Routes>
      <Route path="/setup" element={isSetupComplete ? <Navigate to="/" replace /> : <SetupWizardPage />} />
      <Route path="/setup/:slug" element={<TenantSetupWizardPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterOrganizationPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/pricing" element={<PublicPricingPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/dashboard" element={<PortalDashboardPage />} />
      <Route path="/portal" element={<Navigate to="/portal/login" replace />} />
      <Route path="/portal/scan/:mrn" element={<Navigate to="/portal/login" replace />} />
      <Route
        path="/system/login"
        element={isAuthenticated ? <Navigate to="/system" replace /> : <SystemLoginPage />}
      />
      <Route
        path="/change-password"
        element={isAuthenticated ? <ChangePasswordPage /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/me"
        element={isAuthenticated ? <DashboardLayout><MyProfilePage /></DashboardLayout> : <Navigate to="/login" replace />}
      />
      <Route
        path="/system/*"
        element={isAuthenticated ? <SystemAdminRoute><SystemAdminLayout /></SystemAdminRoute> : <Navigate to="/system/login" replace />}
      >
        <Route path="*" element={<SystemRoutes />} />
      </Route>
      <Route
        path="/admin/tenants"
        element={isAuthenticated ? <Navigate to="/system/tenants" replace /> : <Navigate to="/system/login" replace />}
      />
      <Route
        path="/onboarding"
        element={!isSetupComplete ? <Navigate to="/setup" replace /> : <Navigate to="/" replace />}
      />
      <Route
        path="/admin"
        element={<AdminDashboard />}
      />
      <Route
        path="/landing"
        element={<PublicLandingPage />}
      />
      <Route
        path="/login/:slug?"
        element={<LoginRouteGuard isAuthenticated={isAuthenticated} />}
      />
      <Route
        path="/"
        element={
          !isSetupComplete ? (
            <Navigate to="/setup" replace />
          ) : isAuthenticated ? (
            (useAuthStore.getState().user as any)?.isSystemAdmin ? (
              <Navigate to="/system" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (deploymentMode !== 'saas' || isTenantSubdomain) ? (
            <Navigate to="/login" replace />
          ) : (
            <PublicLandingPage />
          )
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ErrorBoundary level="route">
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<SmartDashboardPage />} />
                <Route path="/dashboard" element={<SmartDashboardPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/billing-portal" element={<BillingPortalPage />} />
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                {/* Nursing Domain */}
                <Route path="/nursing/*" element={<NursingRoutes />} />
                
                
                
                
                
                
                
                
                
                
                
                {/* Doctor Domain */}
                <Route path="/doctor/*" element={<DoctorRoutes />} />
                
                
                
                {/* Cross-cutting Approvals */}
                <Route path="/approvals/inbox" element={<ApprovalsInboxPage />} />

                
                
                
                
                
                
                
                
                {/* Expiry Management — canonical /expiry/*; /pharmacy/expiry/* kept as redirects (audit Phase 3.5) */}
                <Route path="/expiry/soon" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiringSoonPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/expiry/expired" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiredItemsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/expiry/alerts" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiryAlertsPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/expiry/disposal" element={<ModuleRoute module="pharmacy"><PharmacistRoute><DisposalLogPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/expiry/return" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ReturnToSupplierPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/expiry/management" element={<ModuleRoute module="pharmacy"><PharmacistRoute><ExpiryManagementPage /></PharmacistRoute></ModuleRoute>} />
                <Route path="/pharmacy/expiry/soon" element={<Navigate to="/expiry/soon" replace />} />
                <Route path="/pharmacy/expiry/expired" element={<Navigate to="/expiry/expired" replace />} />
                <Route path="/pharmacy/expiry/alerts" element={<Navigate to="/expiry/alerts" replace />} />
                <Route path="/pharmacy/expiry/disposal" element={<Navigate to="/expiry/disposal" replace />} />
                <Route path="/pharmacy/expiry/return" element={<Navigate to="/expiry/return" replace />} />
                <Route path="/pharmacy/expiry/management" element={<Navigate to="/expiry/management" replace />} />
                <Route path="/*" element={<CoreRoutes />} />
                
                {/* Supplier Finance */}
                <Route path="/supplier-finance/*" element={<SupplierFinanceRoutes />} />
                
                {/* MDM (Master Data Management) */}
                <Route path="/mdm/*" element={<MDMRoutes />} />
                
                {/* Lab QC */}
                <Route path="/lab-qc/*" element={<LabQCRoutes />} />
                
                {/* Assets Module */}
                <Route path="/assets/*" element={<AssetRoutes />} />

                {/* Chronic Care Module */}
                <Route path="/chronic-care/*" element={<ChronicCareRoutes />} />

                {/* Integrations Module */}
                <Route path="/integrations/*" element={<IntegrationRoutes />} />

                {/* Notifications Module */}
                <Route path="/notifications/*" element={<NotificationRoutes />} />

                {/* Reports Module — restricted by role */}
                <Route path="/reports/*" element={<ReportRoutes />} />
                
                {/* 404 Catch-all */}
                
                {/* Extracted Domains */}
                <Route path="/billing/*" element={<BillingRoutes />} />
                {/* Registration routes now in CoreRoutes at root level */}
                <Route path="/emergency/*" element={<EmergencyRoutes />} />
                <Route path="/lab/*" element={<LaboratoryRoutes />} />
                <Route path="/radiology/*" element={<RadiologyRoutes />} />
                <Route path="/pharmacy/*" element={<PharmacyRoutes />} />
                <Route path="/ipd/*" element={<IPDRoutes />} />
                <Route path="/stores/*" element={<StoresRoutes />} />
                <Route path="/admin/*" element={<AdminRoutes />} />
                <Route path="/pos/*" element={<POSRoutes />} />
<Route path="*" element={<NotFoundPage />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
    </Suspense>
  );
}

// Session timeout wrapper component
function SessionTimeoutWrapper({ children }: { children: React.ReactNode }) {
  useSessionTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    warningBeforeMs: 5 * 60 * 1000, // 5 minutes warning
    onWarning: () => {
      // Could show a modal warning here
      console.warn('[SESSION] Your session will expire in 5 minutes due to inactivity');
    },
  });
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary level="global">
      <QueryClientProvider client={queryClient}>
        <ConfirmProvider>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <SessionTimeoutWrapper>
            <AppRoutes />
          </SessionTimeoutWrapper>
        </BrowserRouter>
        </ConfirmProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
