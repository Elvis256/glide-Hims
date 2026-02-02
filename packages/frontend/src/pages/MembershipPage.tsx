import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Users,
  Crown,
  Percent,
  CreditCard,
  X,
  UserPlus,
} from 'lucide-react';

interface MembershipScheme {
  id: string;
  code: string;
  name: string;
  type: 'regular' | 'vip' | 'staff' | 'corporate' | 'insurance' | 'charity';
  description?: string;
  discountPercent: number;
  creditLimit: number;
  validDays: number;
  isActive: boolean;
  createdAt: string;
}

interface PatientMembership {
  id: string;
  patientId: string;
  schemeId: string;
  membershipNumber?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  scheme?: MembershipScheme;
}

const typeColors: Record<string, string> = {
  regular: 'bg-gray-100 text-gray-800',
  vip: 'bg-amber-100 text-amber-800',
  staff: 'bg-blue-100 text-blue-800',
  corporate: 'bg-purple-100 text-purple-800',
  insurance: 'bg-green-100 text-green-800',
  charity: 'bg-pink-100 text-pink-800',
};

export default function MembershipPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showSchemeModal, setShowSchemeModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<MembershipScheme | null>(null);
  const [activeTab, setActiveTab] = useState<'schemes' | 'members'>('schemes');

  // Fetch schemes
  const { data: schemes, isLoading: loadingSchemes } = useQuery({
    queryKey: ['membership-schemes'],
    queryFn: async () => {
      const response = await api.get('/membership/schemes');
      return response.data as MembershipScheme[];
    },
  });

  // Create/update scheme mutation
  const schemeMutation = useMutation({
    mutationFn: (data: Partial<MembershipScheme>) => {
      if (editingScheme) {
        return api.patch(`/membership/schemes/${editingScheme.id}`, data);
      }
      return api.post('/membership/schemes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-schemes'] });
      setShowSchemeModal(false);
      setEditingScheme(null);
    },
  });

  const filteredSchemes = schemes?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleSchemeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    // Generate code from name if not editing
    const code = editingScheme?.id 
      ? undefined 
      : name.toUpperCase().replace(/\s+/g, '_').substring(0, 20);
    schemeMutation.mutate({
      ...(code && { code }),
      name,
      type: formData.get('type') as MembershipScheme['type'],
      description: formData.get('description') as string,
      discountPercent: Number(formData.get('discountPercent')),
      creditLimit: Number(formData.get('creditLimit')),
      validDays: Number(formData.get('validDays')),
      isActive: formData.get('isActive') === 'on',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membership Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage membership schemes and patient memberships</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'schemes') {
              setEditingScheme(null);
              setShowSchemeModal(true);
            } else {
              setShowAssignModal(true);
            }
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === 'schemes' ? 'New Scheme' : 'Assign Membership'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'schemes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Crown className="h-4 w-4 inline mr-2" />
            Schemes
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'members'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="h-4 w-4 inline mr-2" />
            Members
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Schemes Tab */}
      {activeTab === 'schemes' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loadingSchemes ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : !filteredSchemes?.length ? (
            <div className="p-8 text-center">
              <Crown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No membership schemes yet</h3>
              <p className="text-gray-500 mb-4">Create your first membership scheme to get started</p>
              <button
                onClick={() => { setEditingScheme(null); setShowSchemeModal(true); }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Scheme
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scheme</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credit Limit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Days</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSchemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Crown className="h-5 w-5 text-amber-500 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{scheme.name}</div>
                          <div className="text-xs text-gray-400">{scheme.code}</div>
                          <div className="text-sm text-gray-500">{scheme.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[scheme.type]}`}>
                        {scheme.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-green-600">
                        <Percent className="h-4 w-4 mr-1" />
                        {scheme.discountPercent}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-gray-600">
                        <CreditCard className="h-4 w-4 mr-1" />
                        UGX {scheme.creditLimit.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {scheme.validDays} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        scheme.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {scheme.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingScheme(scheme);
                          setShowSchemeModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>Select a patient from the Patients page to assign membership</p>
        </div>
      )}

      {/* Scheme Modal */}
      {showSchemeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowSchemeModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingScheme ? 'Edit Scheme' : 'New Membership Scheme'}
                </h3>
                <button onClick={() => setShowSchemeModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSchemeSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingScheme?.name}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    name="type"
                    defaultValue={editingScheme?.type || 'regular'}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="regular">Regular</option>
                    <option value="vip">VIP</option>
                    <option value="staff">Staff</option>
                    <option value="corporate">Corporate</option>
                    <option value="insurance">Insurance</option>
                    <option value="charity">Charity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingScheme?.description}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Discount %</label>
                    <input
                      type="number"
                      name="discountPercent"
                      defaultValue={editingScheme?.discountPercent || 0}
                      min="0"
                      max="100"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valid Days</label>
                    <input
                      type="number"
                      name="validDays"
                      defaultValue={editingScheme?.validDays || 365}
                      min="1"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Credit Limit (UGX)</label>
                  <input
                    type="number"
                    name="creditLimit"
                    defaultValue={editingScheme?.creditLimit || 0}
                    min="0"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingScheme?.isActive ?? true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Active</label>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSchemeModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={schemeMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {schemeMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
