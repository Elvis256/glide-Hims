import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { authService } from '../services/auth';
import { useAuthStore } from '../store/auth';
import Logo from '../components/Logo';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a symbol'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    path: ['newPassword'],
    message: 'New password must differ from the current password',
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const forced = (location.state as { forced?: boolean } | null)?.forced ?? false;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      setSuccess(true);
      const next = user?.isSystemAdmin ? '/system' : '/';
      setTimeout(() => navigate(next, { replace: true }), 1200);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Could not change password.');
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

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {forced ? 'Set a new password' : 'Change password'}
          </h2>
          <p className="text-gray-500 mt-1 text-sm">
            {forced
              ? 'Your account requires a password change before you can continue.'
              : 'Update the password for your account.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            Password changed. Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <div className="relative">
              <input
                {...register('currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                id="currentPassword"
                className="input pr-10"
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="relative">
              <input
                {...register('newPassword')}
                type={showNew ? 'text' : 'password'}
                id="newPassword"
                className="input pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.newPassword.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              At least 12 characters, with upper, lower, number and symbol.
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <input
              {...register('confirmPassword')}
              type={showNew ? 'text' : 'password'}
              id="confirmPassword"
              className="input"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full py-3 px-4 bg-gradient-to-r from-slate-700 to-slate-900 text-white font-semibold rounded-xl hover:from-slate-800 hover:to-slate-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Updating…
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Change password
              </>
            )}
          </button>
        </form>

        <p className="text-center text-slate-400 text-xs mt-8">
          Glide HIMS v1.0.0 &bull; Account Security
        </p>
      </div>
    </div>
  );
}
