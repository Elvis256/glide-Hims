import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  AlertTriangle,
  Clock,
  Search,
  Loader2,
  User,
  Building2,
  Info,
  X,
} from 'lucide-react';
import { providersService, type Provider } from '../../services/providers';

/**
 * Provider licence expiry / credentialing.
 *
 * There is NO provider_credentials table: licence data (licenseNumber,
 * licenseExpiry, registrationNumber, regulatoryBody) lives on the provider
 * itself, and GET /providers/license-expiry returns Provider[]. This page was
 * previously written against an invented ProviderCredential shape
 * (credentialType/issuingAuthority/issueDate/status VALID|EXPIRING_SOON|...)
 * that matched no column anywhere, plus two endpoints
 * (/providers/credentials/:id/remind and /renew) that do not exist.
 *
 * Status is DERIVED from licenseExpiry — the backend stores no licence status.
 */

type DerivedStatus = 'expired' | 'expiring_soon';

const WINDOWS = [
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
] as const;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'expired', label: 'Expired' },
] as const;

const daysUntil = (date: string): number =>
  Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

const derive = (p: Provider): DerivedStatus =>
  p.licenseExpiry && daysUntil(p.licenseExpiry) < 0 ? 'expired' : 'expiring_soon';

export default function ProviderCredentialsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [windowDays, setWindowDays] = useState<number>(30);
  const [renewing, setRenewing] = useState<Provider | null>(null);
  const [newExpiry, setNewExpiry] = useState('');

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['provider-license-expiry', windowDays],
    queryFn: () => providersService.getLicenseExpiry(windowDays, true),
  });

  // "Renewal" is just moving the licence expiry date forward — PATCH
  // /providers/:id accepts licenseExpiry. The old page POSTed to a
  // /renew endpoint that was never implemented.
  const renewMutation = useMutation({
    mutationFn: (v: { id: string; licenseExpiry: string }) =>
      providersService.update(v.id, { licenseExpiry: v.licenseExpiry }),
    onSuccess: () => {
      toast.success('Licence expiry updated');
      setRenewing(null);
      setNewExpiry('');
      queryClient.invalidateQueries({ queryKey: ['provider-license-expiry'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update licence'),
  });

  const filtered = useMemo(
    () =>
      providers.filter((p) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          p.fullName?.toLowerCase().includes(q) ||
          p.licenseNumber?.toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || derive(p) === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [providers, searchTerm, statusFilter],
  );

  const expiredCount = providers.filter((p) => derive(p) === 'expired').length;
  const expiringCount = providers.length - expiredCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Licences</h1>
          <p className="text-gray-600">
            Active providers whose practising licence has expired or expires within {windowDays} days
          </p>
        </div>
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.days}
              onClick={() => setWindowDays(w.days)}
              className={`px-3 py-1 rounded-full text-sm ${
                windowDays === w.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats — only the two states the data can actually express. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring within {windowDays} days</p>
              <p className="text-xl font-bold text-orange-600">{expiringCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expired (still active)</p>
              <p className="text-xl font-bold text-red-600">{expiredCount}</p>
            </div>
          </div>
        </div>
      </div>

      {expiredCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800">Attention required</h3>
              <p className="text-sm text-red-700">
                {expiredCount} active provider{expiredCount > 1 ? 's are' : ' is'} practising on an
                expired licence.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-700">
            Expiry reminders are sent automatically each morning to providers whose licence expires
            within 60 days.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or licence number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1 rounded-full text-sm ${
                  statusFilter === s.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Provider</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Licence</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Regulatory body</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Expiry</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((p) => {
              const status = derive(p);
              const days = p.licenseExpiry ? daysUntil(p.licenseExpiry) : 0;
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{p.fullName}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {p.department?.name || 'No department'} •{' '}
                          {p.providerType?.replace(/_/g, ' ')}
                          {p.specialty ? ` • ${p.specialty}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.licenseNumber || '—'}</p>
                    {p.registrationNumber && (
                      <p className="text-xs text-gray-500">Reg: {p.registrationNumber}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-700">{p.regulatoryBody || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-900">
                      {p.licenseExpiry ? new Date(p.licenseExpiry).toLocaleDateString() : '—'}
                    </p>
                    <p className={`text-xs ${status === 'expired' ? 'text-red-600' : 'text-orange-600'}`}>
                      {status === 'expired'
                        ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
                        : `${days} day${days === 1 ? '' : 's'} remaining`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        status === 'expired'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}
                    >
                      {status === 'expired' ? 'Expired' : 'Expiring soon'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setRenewing(p);
                        setNewExpiry('');
                      }}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Update expiry
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No licences expiring within {windowDays} days</p>
          </div>
        )}
      </div>

      {renewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Update Licence Expiry</h2>
              <button onClick={() => setRenewing(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{renewing.fullName}</p>
                <p className="text-sm text-gray-500">{renewing.licenseNumber || 'No licence number'}</p>
                <p className="text-sm text-gray-500">
                  Current expiry:{' '}
                  {renewing.licenseExpiry
                    ? new Date(renewing.licenseExpiry).toLocaleDateString()
                    : '—'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New expiry date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setRenewing(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => renewMutation.mutate({ id: renewing.id, licenseExpiry: newExpiry })}
                disabled={!newExpiry || renewMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renewMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
