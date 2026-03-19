import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/auth';
import { authService } from '../services/auth';
import api from '../services/api';
import { Eye, EyeOff, Loader2, Clock, Building2, ChevronDown, UserPlus } from 'lucide-react';
import Logo from '../components/Logo';

interface TenantOption {
  id: string;
  name: string;
}

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, setAccessibleModules } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Tenant selection
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [justRegistered, setJustRegistered] = useState(false);

  // Fetch tenants on mount
  useEffect(() => {
    api.get<TenantOption[]>('/tenants/public/list')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setTenants(list);
        if (list.length === 1) {
          setSelectedTenantId(list[0].id);
        }
      })
      .catch(() => setTenants([]))
      .finally(() => setTenantsLoading(false));
  }, []);

  useEffect(() => {
    if (searchParams.get('expired') === 'true') {
      setSessionExpired(true);
      window.history.replaceState({}, '', '/login');
    }
    if (searchParams.get('registered') === 'true') {
      setJustRegistered(true);
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    if (!selectedTenantId) {
      setError('Please select your organization');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSessionExpired(false);

    try {
      const response = await authService.login({ ...data, tenantId: selectedTenantId });
      // Persist tenant context for API calls
      sessionStorage.setItem('glide_active_tenant_id', selectedTenantId);
      
      // Store accessible modules in user object before login
      const userWithModules = { ...response.user };
      
      login(userWithModules, response.accessToken, response.refreshToken);
      
      // Fetch accessible modules from /auth/me (non-blocking)
      try {
        const meData = await authService.getMe();
        setAccessibleModules(meData.accessibleModules || []);
      } catch {
        // If /auth/me fails, navigation will fall back to role-based filtering
      }
      
      navigate('/');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" variant="full" showTagline />
        </div>

        {sessionExpired && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <Clock className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Session Expired</p>
              <p className="text-sm text-amber-700">Your session has expired. Please log in again to continue.</p>
            </div>
          </div>
        )}

        {justRegistered && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6 flex items-center gap-3">
            <UserPlus className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Organization Registered!</p>
              <p className="text-sm text-green-700">Your organization has been created. Select it below and sign in with your admin credentials.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Organization Picker */}
          <div>
            <label htmlFor="tenant" className="block text-sm font-medium text-gray-700 mb-1">
              Organization
            </label>
            {tenantsLoading ? (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading organizations...
              </div>
            ) : tenants.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
                <Building2 className="w-4 h-4 text-blue-500" />
                {tenants[0].name}
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  id="tenant"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="input pl-9 pr-8 appearance-none cursor-pointer"
                >
                  <option value="">Select your organization</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

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
            disabled={isLoading || !selectedTenantId}
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

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">Don't have an organization yet?</p>
          <Link
            to="/register"
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <UserPlus className="w-4 h-4" /> Register New Organization
          </Link>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Glide HIMS v1.0.0 • Enterprise Healthcare Platform
        </p>
      </div>
    </div>
  );
}
