import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Search,
  Plus,
  Edit2,
  AlertTriangle,
  Bell,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  ArrowUpDown,
  Loader2,
  X,
} from 'lucide-react';

interface ExpiryPolicy {
  id: string;
  name: string;
  category: string;
  warningThreshold30: boolean;
  warningThreshold60: boolean;
  warningThreshold90: boolean;
  customThreshold?: number;
  fefoEnforced: boolean;
  disposalProcedure: 'return-to-supplier' | 'destroy-on-site' | 'special-disposal' | 'pharmacy-review';
  returnToSupplierEligible: boolean;
  returnWindow?: number;
  notifyRoles: string[];
  autoQuarantine: boolean;
  isActive: boolean;
}

const STORAGE_KEY = 'expiry-policies';

const defaultPolicies: ExpiryPolicy[] = [
  {
    id: '1',
    name: 'Standard Medication Policy',
    category: 'General Medications',
    warningThreshold30: true,
    warningThreshold60: true,
    warningThreshold90: true,
    fefoEnforced: true,
    disposalProcedure: 'return-to-supplier',
    returnToSupplierEligible: true,
    returnWindow: 90,
    notifyRoles: ['Pharmacist', 'Store Manager'],
    autoQuarantine: true,
    isActive: true,
  },
  {
    id: '2',
    name: 'Controlled Substances Policy',
    category: 'Controlled Substances',
    warningThreshold30: true,
    warningThreshold60: true,
    warningThreshold90: true,
    fefoEnforced: true,
    disposalProcedure: 'special-disposal',
    returnToSupplierEligible: false,
    notifyRoles: ['Chief Pharmacist', 'Compliance Officer', 'Store Manager'],
    autoQuarantine: true,
    isActive: true,
  },
  {
    id: '3',
    name: 'Vaccine Cold Chain Policy',
    category: 'Vaccines',
    warningThreshold30: true,
    warningThreshold60: true,
    warningThreshold90: false,
    customThreshold: 14,
    fefoEnforced: true,
    disposalProcedure: 'destroy-on-site',
    returnToSupplierEligible: false,
    notifyRoles: ['Pharmacist', 'Immunization Officer'],
    autoQuarantine: true,
    isActive: true,
  },
  {
    id: '4',
    name: 'Medical Supplies Policy',
    category: 'Medical Supplies',
    warningThreshold30: false,
    warningThreshold60: true,
    warningThreshold90: true,
    fefoEnforced: false,
    disposalProcedure: 'return-to-supplier',
    returnToSupplierEligible: true,
    returnWindow: 60,
    notifyRoles: ['Store Manager'],
    autoQuarantine: false,
    isActive: true,
  },
  {
    id: '5',
    name: 'Biologics Policy',
    category: 'Biologics',
    warningThreshold30: true,
    warningThreshold60: true,
    warningThreshold90: true,
    customThreshold: 7,
    fefoEnforced: true,
    disposalProcedure: 'special-disposal',
    returnToSupplierEligible: false,
    notifyRoles: ['Chief Pharmacist', 'Quality Assurance'],
    autoQuarantine: true,
    isActive: true,
  },
  {
    id: '6',
    name: 'OTC Products Policy',
    category: 'Over-the-Counter',
    warningThreshold30: false,
    warningThreshold60: false,
    warningThreshold90: true,
    fefoEnforced: false,
    disposalProcedure: 'pharmacy-review',
    returnToSupplierEligible: true,
    returnWindow: 30,
    notifyRoles: ['Pharmacist'],
    autoQuarantine: false,
    isActive: true,
  },
  {
    id: '7',
    name: 'Emergency Stock Policy',
    category: 'Emergency Medications',
    warningThreshold30: true,
    warningThreshold60: true,
    warningThreshold90: true,
    customThreshold: 180,
    fefoEnforced: true,
    disposalProcedure: 'pharmacy-review',
    returnToSupplierEligible: true,
    returnWindow: 120,
    notifyRoles: ['Emergency Pharmacist', 'Store Manager', 'Chief Pharmacist'],
    autoQuarantine: true,
    isActive: true,
  },
  {
    id: '8',
    name: 'Legacy Policy (Deprecated)',
    category: 'General',
    warningThreshold30: true,
    warningThreshold60: false,
    warningThreshold90: false,
    fefoEnforced: false,
    disposalProcedure: 'destroy-on-site',
    returnToSupplierEligible: false,
    notifyRoles: ['Store Manager'],
    autoQuarantine: false,
    isActive: false,
  },
];

const getEmptyPolicy = (): Omit<ExpiryPolicy, 'id'> => ({
  name: '',
  category: '',
  warningThreshold30: true,
  warningThreshold60: true,
  warningThreshold90: true,
  fefoEnforced: true,
  disposalProcedure: 'return-to-supplier',
  returnToSupplierEligible: false,
  notifyRoles: [],
  autoQuarantine: false,
  isActive: true,
});

export default function ExpiryPoliciesPage() {
  const [policies, setPolicies] = useState<ExpiryPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fefoFilter, setFefoFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ExpiryPolicy | null>(null);
  const [formData, setFormData] = useState<Omit<ExpiryPolicy, 'id'>>(getEmptyPolicy());

  useEffect(() => {
    const loadPolicies = () => {
      setLoading(true);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPolicies(JSON.parse(stored));
        } else {
          setPolicies(defaultPolicies);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPolicies));
        }
      } catch {
        setPolicies(defaultPolicies);
      }
      setLoading(false);
    };
    loadPolicies();
  }, []);

  const savePolicies = (newPolicies: ExpiryPolicy[]) => {
    setPolicies(newPolicies);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPolicies));
  };

  const handleAddPolicy = () => {
    setEditingPolicy(null);
    setFormData(getEmptyPolicy());
    setIsModalOpen(true);
  };

  const handleEditPolicy = (policy: ExpiryPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      category: policy.category,
      warningThreshold30: policy.warningThreshold30,
      warningThreshold60: policy.warningThreshold60,
      warningThreshold90: policy.warningThreshold90,
      customThreshold: policy.customThreshold,
      fefoEnforced: policy.fefoEnforced,
      disposalProcedure: policy.disposalProcedure,
      returnToSupplierEligible: policy.returnToSupplierEligible,
      returnWindow: policy.returnWindow,
      notifyRoles: policy.notifyRoles,
      autoQuarantine: policy.autoQuarantine,
      isActive: policy.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSavePolicy = () => {
    if (!formData.name || !formData.category) return;

    if (editingPolicy) {
      const updated = policies.map((p) =>
        p.id === editingPolicy.id ? { ...formData, id: editingPolicy.id } : p
      );
      savePolicies(updated);
    } else {
      const newPolicy: ExpiryPolicy = {
        ...formData,
        id: Date.now().toString(),
      };
      savePolicies([...policies, newPolicy]);
    }
    setIsModalOpen(false);
    setEditingPolicy(null);
    setFormData(getEmptyPolicy());
  };

  const handleDeletePolicy = (id: string) => {
    if (confirm('Are you sure you want to delete this policy?')) {
      savePolicies(policies.filter((p) => p.id !== id));
    }
  };

  const handleToggleStatus = (id: string) => {
    const updated = policies.map((p) =>
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    savePolicies(updated);
  };

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSearch =
        policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        policy.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && policy.isActive) ||
        (statusFilter === 'inactive' && !policy.isActive);
      const matchesFefo =
        fefoFilter === 'all' ||
        (fefoFilter === 'enforced' && policy.fefoEnforced) ||
        (fefoFilter === 'not-enforced' && !policy.fefoEnforced);
      return matchesSearch && matchesStatus && matchesFefo;
    });
  }, [searchTerm, statusFilter, fefoFilter, policies]);

  const getDisposalBadge = (procedure: string) => {
    switch (procedure) {
      case 'return-to-supplier':
        return 'bg-blue-100 text-blue-800';
      case 'destroy-on-site':
        return 'bg-red-100 text-red-800';
      case 'special-disposal':
        return 'bg-purple-100 text-purple-800';
      case 'pharmacy-review':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDisposalLabel = (procedure: string) => {
    switch (procedure) {
      case 'return-to-supplier':
        return 'Return to Supplier';
      case 'destroy-on-site':
        return 'Destroy On-Site';
      case 'special-disposal':
        return 'Special Disposal';
      case 'pharmacy-review':
        return 'Pharmacy Review';
      default:
        return procedure;
    }
  };

  const getDisposalIcon = (procedure: string) => {
    switch (procedure) {
      case 'return-to-supplier':
        return <RotateCcw className="w-3 h-3" />;
      case 'destroy-on-site':
        return <Trash2 className="w-3 h-3" />;
      case 'special-disposal':
        return <AlertTriangle className="w-3 h-3" />;
      case 'pharmacy-review':
        return <Settings className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Calendar className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expiry Policies</h1>
            <p className="text-sm text-gray-500">Configure expiry alerts and disposal procedures</p>
          </div>
        </div>
        <button
          onClick={handleAddPolicy}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Policy
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <select
          value={fefoFilter}
          onChange={(e) => setFefoFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All FEFO Status</option>
          <option value="enforced">FEFO Enforced</option>
          <option value="not-enforced">FEFO Not Enforced</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{policies.length}</div>
          <div className="text-sm text-gray-500">Total Policies</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600">
              {policies.filter((p) => p.fefoEnforced).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">FEFO Enforced</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">
              {policies.filter((p) => p.autoQuarantine).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Auto-Quarantine</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">
              {policies.filter((p) => p.returnToSupplierEligible).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Return Eligible</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold text-orange-600">
              {policies.filter((p) => p.warningThreshold30).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">30-Day Alerts</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          </div>
        ) : (
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Policy Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warning Thresholds</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">FEFO</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disposal</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Policy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notify</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPolicies.map((policy) => (
                <tr key={policy.id} className={`hover:bg-gray-50 ${!policy.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span className="font-medium text-gray-900">{policy.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{policy.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {policy.warningThreshold30 && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">30d</span>
                      )}
                      {policy.warningThreshold60 && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">60d</span>
                      )}
                      {policy.warningThreshold90 && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">90d</span>
                      )}
                      {policy.customThreshold && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                          {policy.customThreshold}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {policy.fefoEnforced ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <ArrowUpDown className="w-4 h-4" />
                        Enforced
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Not Enforced</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getDisposalBadge(policy.disposalProcedure)}`}>
                      {getDisposalIcon(policy.disposalProcedure)}
                      {getDisposalLabel(policy.disposalProcedure)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {policy.returnToSupplierEligible ? (
                      <div className="text-sm">
                        <span className="text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Eligible
                        </span>
                        {policy.returnWindow && (
                          <span className="text-gray-500 text-xs">{policy.returnWindow} day window</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Not Eligible
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Bell className="w-3 h-3 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {policy.notifyRoles.length} role{policy.notifyRoles.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleStatus(policy.id)}
                      className="cursor-pointer"
                    >
                      {policy.isActive ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm hover:text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm hover:text-red-700">
                          <XCircle className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditPolicy(policy)}
                        className="p-1 text-gray-400 hover:text-orange-600"
                        title="Edit policy"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete policy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPolicy ? 'Edit Policy' : 'Add New Policy'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter policy name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter category"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Warning Thresholds</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.warningThreshold30}
                      onChange={(e) => setFormData({ ...formData, warningThreshold30: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-600">30 days</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.warningThreshold60}
                      onChange={(e) => setFormData({ ...formData, warningThreshold60: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-600">60 days</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.warningThreshold90}
                      onChange={(e) => setFormData({ ...formData, warningThreshold90: e.target.checked })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-600">90 days</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.customThreshold || ''}
                      onChange={(e) => setFormData({ ...formData, customThreshold: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                      placeholder="Custom"
                    />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disposal Procedure</label>
                  <select
                    value={formData.disposalProcedure}
                    onChange={(e) => setFormData({ ...formData, disposalProcedure: e.target.value as ExpiryPolicy['disposalProcedure'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="return-to-supplier">Return to Supplier</option>
                    <option value="destroy-on-site">Destroy On-Site</option>
                    <option value="special-disposal">Special Disposal</option>
                    <option value="pharmacy-review">Pharmacy Review</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Window (days)</label>
                  <input
                    type="number"
                    value={formData.returnWindow || ''}
                    onChange={(e) => setFormData({ ...formData, returnWindow: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter return window"
                    disabled={!formData.returnToSupplierEligible}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.fefoEnforced}
                    onChange={(e) => setFormData({ ...formData, fefoEnforced: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">FEFO Enforced</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.returnToSupplierEligible}
                    onChange={(e) => setFormData({ ...formData, returnToSupplierEligible: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Return to Supplier Eligible</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.autoQuarantine}
                    onChange={(e) => setFormData({ ...formData, autoQuarantine: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Auto-Quarantine</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-600">Active</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notify Roles (comma-separated)</label>
                <input
                  type="text"
                  value={formData.notifyRoles.join(', ')}
                  onChange={(e) => setFormData({ ...formData, notifyRoles: e.target.value.split(',').map((r) => r.trim()).filter(Boolean) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Pharmacist, Store Manager"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePolicy}
                disabled={!formData.name || !formData.category}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingPolicy ? 'Save Changes' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
