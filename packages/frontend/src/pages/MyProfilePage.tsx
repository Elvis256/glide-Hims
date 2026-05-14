import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, User as UserIcon, Mail, Phone, MapPin, Shield, KeyRound, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/auth';
import { useAuthStore } from '../store/auth';

interface ProfileForm {
  email: string;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export default function MyProfilePage() {
  const { user } = useAuthStore();
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    email: '',
    phone: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });

  useEffect(() => {
    let mounted = true;
    authService
      .getProfile()
      .then((p: any) => {
        if (!mounted) return;
        setForm({
          email: p.email ?? '',
          phone: p.phone ?? '',
          address: p.address ?? '',
          emergencyContactName: p.emergencyContactName ?? '',
          emergencyContactPhone: p.emergencyContactPhone ?? '',
        });
      })
      .catch(() => setError('Could not load your profile'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await authService.updateProfile({
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
      });
      setSuccess('Profile updated');
      try {
        const fresh = await authService.getProfile();
        if (user) setUser({ ...(user as any), ...fresh });
      } catch { /* ignore */ }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading profile…
      </div>
    );
  }

  const roleNames = ((user?.roles as any[]) || []).map((r) =>
    typeof r === 'string' ? r : r?.role || r?.name || ''
  ).filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <UserIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Manage your personal account details</p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <UserIcon className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{user?.fullName || user?.username || '—'}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">@{user?.username}</span>
        </div>
        {roleNames.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-gray-400" />
            <div className="flex flex-wrap gap-1">
              {roleNames.map((r) => (
                <span key={r} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{r}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Contact details</h2>

        <div>
          <label className="text-sm text-gray-700 flex items-center gap-1.5 mb-1">
            <Mail className="w-3.5 h-3.5" /> Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            className="w-full px-3 py-2 border rounded text-sm"
            placeholder="you@hospital.com"
          />
        </div>

        <div>
          <label className="text-sm text-gray-700 flex items-center gap-1.5 mb-1">
            <Phone className="w-3.5 h-3.5" /> Phone
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={handleChange('phone')}
            className="w-full px-3 py-2 border rounded text-sm"
            placeholder="+256…"
          />
        </div>

        <div>
          <label className="text-sm text-gray-700 flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5" /> Address
          </label>
          <input
            type="text"
            value={form.address}
            onChange={handleChange('address')}
            className="w-full px-3 py-2 border rounded text-sm"
          />
        </div>

        <h2 className="font-semibold text-gray-900 pt-2">Emergency contact</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-700 mb-1 block">Name</label>
            <input
              type="text"
              value={form.emergencyContactName}
              onChange={handleChange('emergencyContactName')}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700 mb-1 block">Phone</label>
            <input
              type="tel"
              value={form.emergencyContactPhone}
              onChange={handleChange('emergencyContactPhone')}
              className="w-full px-3 py-2 border rounded text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <Link
            to="/change-password"
            className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5"
          >
            <KeyRound className="w-4 h-4" /> Change password
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
