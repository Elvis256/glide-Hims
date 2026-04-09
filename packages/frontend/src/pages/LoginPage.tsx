import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/auth';
import { authService } from '../services/auth';
import { setupService, type SetupStatus } from '../services/setup';
import api from '../services/api';
import { Eye, EyeOff, Loader2, Clock, Building2, UserPlus, AlertCircle, Shield } from 'lucide-react';
import Logo from '../components/Logo';
import { getBusinessConfig } from '../hooks/useBusinessConfig';

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  businessType?: string;
  isSetupComplete?: boolean;
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { login, setAccessibleModules } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  // Deployment mode from backend
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);

  // Tenant resolved from slug (SaaS mode)
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  // Fetch deployment mode on mount
  useEffect(() => {
    setupService.getStatus()
      .then(status => {
        setSetupStatus(status);
        // On-premise: auto-resolve the single tenant by slug if available
        if (status.deploymentMode === 'on-premise' && status.tenantSlug && !slug) {
          api.get(`/tenants/public/by-slug/${status.tenantSlug}`)
            .then(res => {
              // After Axios interceptor unwraps StandardResponse, res.data IS the tenant object
              const tenantData = res.data as TenantInfo;
              setTenant(tenantData);
            })
            .catch((err) => console.error('Failed to fetch tenant info:', err));
        }
      })
      .catch(() => setSetupStatus({ isSetupComplete: false, deploymentMode: 'on-premise' }))
      .finally(() => setSetupLoading(false));
  }, [slug]);

  // Resolve tenant from URL slug (SaaS mode)
  useEffect(() => {
    if (!slug) return;
    setTenantLoading(true);
    setTenantError(null);
    api.get<TenantInfo>(`/tenants/public/by-slug/${slug}`)
      .then(res => {
        const data = res.data;
        if (data && data.isSetupComplete === false) {
          navigate(`/setup/${slug}`, { replace: true });
          return;
        }
        setTenant(data);
      })
      .catch(() => setTenantError('Organization not found. Please check the URL.'))
      .finally(() => setTenantLoading(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpired(true);
      window.history.replaceState({}, '', slug ? `/login/${slug}` : '/login');
    }
    if (searchParams.get('registered') === 'true') {
      setJustRegistered(true);
      window.history.replaceState({}, '', slug ? `/login/${slug}` : '/login');
    }
  }, [searchParams, slug]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const isSaas = setupStatus?.deploymentMode === 'saas';
  const isOnPremise = !isSaas;
  const isMultiTenant = (setupStatus?.tenantCount || 0) > 1;
  // No slug + multi-tenant → redirect to system admin login
  const isSystemAdminLogin = !slug && (isSaas || isMultiTenant);

  const onSubmit = async (data: LoginForm) => {
    // For tenant logins (on-premise or SaaS with slug), tenant must be resolved
    if (!isSystemAdminLogin && !tenant) {
      setError('Organization not resolved. Please check the URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSessionExpired(false);

    try {
      const loginPayload: { username: string; password: string; tenantId?: string } = { ...data };
      // System admin login (SaaS, no slug) → no tenantId
      // Tenant login → include tenantId
      if (tenant) {
        loginPayload.tenantId = tenant.id;
      }

      const response = await authService.login(loginPayload);

      if (tenant) {
        localStorage.setItem('glide_active_tenant_id', tenant.id);
        localStorage.setItem('glide_tenant_slug', tenant.slug);
      }

      const userWithModules = { ...response.user };
      login(userWithModules, response.accessToken, response.refreshToken);

      // Fetch accessible modules, facility mode, and business type
      try {
        const meData = await authService.getMe();
        setAccessibleModules(meData.accessibleModules || []);
        // Store facility context for business-type-specific UI
        const { user: currentUser } = useAuthStore.getState();
        if (currentUser) {
          useAuthStore.setState({
            user: {
              ...currentUser,
              accessibleModules: meData.accessibleModules || [],
              facilityMode: meData.facilityMode,
              businessType: meData.businessType,
            },
          });
        }
      } catch {
        // Falls back to role-based filtering
      }

      // System admin → tenant management dashboard, tenant members → main dashboard
      if (response.user.isSystemAdmin && isSaas) {
        navigate('/admin/tenants');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (setupLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ─── Multi-tenant / SaaS mode, no slug → Redirect to system admin login ───
  if (isSystemAdminLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" variant="full" showTagline />
          </div>

          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Shield className="w-7 h-7 text-slate-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Access Required</h2>
            <p className="text-gray-500 mt-2 text-sm">
              Each organization has its own login link.<br />
              Contact your administrator for your organization's link.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              to="/system/login"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              System Admin Login
            </Link>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            Glide HIMS v1.0.0 • Enterprise Healthcare Platform
          </p>
        </div>
      </div>
    );
  }

  // ─── On-premise mode, no slug → Direct login (auto-resolved tenant) ───
  if (isOnPremise && !slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" variant="full" showTagline tagline={getBusinessConfig(tenant?.businessType).tagline} />
          </div>

          {setupStatus?.organizationName && (
            <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
              <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">{setupStatus.organizationName}</p>
                {setupStatus.facilityName && (
                  <p className="text-xs text-blue-600">{setupStatus.facilityName}</p>
                )}
              </div>
            </div>
          )}

          {sessionExpired && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
              <Clock className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Session Expired</p>
                <p className="text-sm text-amber-700">Your session has expired. Please log in again.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                {...register('username')}
                type="text"
                id="username"
                className="input"
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="input pr-10"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !tenant}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Glide HIMS v1.0.0 • {getBusinessConfig(tenant?.businessType).tagline}
          </p>
        </div>
      </div>
    );
  }

  // ─── SaaS mode with slug → Tenant Member Login ───
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" variant="full" showTagline tagline={getBusinessConfig(tenant?.businessType).tagline} />
        </div>

        {/* Tenant info banner */}
        {tenantLoading && (
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-lg mb-6 text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Resolving organization...
          </div>
        )}

        {tenantError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Organization Not Found</p>
              <p className="text-sm">{tenantError}</p>
              <p className="text-sm text-gray-500 mt-1">Please check the link with your administrator.</p>
            </div>
          </div>
        )}

        {tenant && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg mb-6">
            <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900">{tenant.name}</p>
              <p className="text-xs text-blue-600">Organization: {tenant.slug}</p>
            </div>
          </div>
        )}

        {sessionExpired && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Session Expired</p>
              <p className="text-sm text-amber-700">Your session has expired. Please log in again.</p>
            </div>
          </div>
        )}

        {justRegistered && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <UserPlus className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Organization Registered!</p>
              <p className="text-sm text-green-700">Sign in with your admin credentials below.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              {...register('username')}
              type="text"
              id="username"
              className="input"
              placeholder="Enter your username"
              autoComplete="username"
              disabled={!tenant}
            />
            {errors.username && (
              <p className="text-red-500 text-sm mt-1">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="input pr-10"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={!tenant}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !tenant}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Glide HIMS v1.0.0 • {getBusinessConfig(tenant?.businessType).tagline}
        </p>
      </div>
    </div>
  );
}
