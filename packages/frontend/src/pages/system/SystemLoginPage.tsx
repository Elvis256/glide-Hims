import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../../store/auth';
import { authService } from '../../services/auth';
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react';
import Logo from '../../components/Logo';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function SystemLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        username: data.username,
        password: data.password,
      });

      if (!response.user.isSystemAdmin) {
        setError('Access denied. This login is for system administrators only.');
        setIsLoading(false);
        return;
      }

      login(response.user, response.accessToken, response.refreshToken);
      // Mark this session as a system-admin one so /login fall-throughs go to /system/login
      localStorage.setItem('glide_login_kind', 'system');
      localStorage.removeItem('glide_tenant_slug');
      if (response.mustChangePassword) {
        navigate('/change-password', { state: { forced: true } });
        return;
      }
      if (response.mustEnrollMfa) {
        localStorage.setItem('glide_mfa_enroll_required', '1');
      } else {
        localStorage.removeItem('glide_mfa_enroll_required');
      }
      navigate('/system');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo size="lg" variant="full" showTagline={false} />
        </div>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">System Administration</h2>
          <p className="text-gray-500 mt-1 text-sm">Platform management &amp; tenant administration</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
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
              placeholder="System admin username"
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
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Sign In to System Admin
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Forgot your password?{' '}
            <span className="text-slate-700 font-medium">Contact another system administrator to reset it.</span>
          </p>
        </div>

        <p className="text-center text-slate-400 text-xs mt-8">
          Glide HIMS v1.0.0 &bull; System Administration Portal
        </p>
      </div>
    </div>
  );
}
