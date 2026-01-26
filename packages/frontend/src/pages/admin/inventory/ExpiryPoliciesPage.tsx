import { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  AlertTriangle,
  Bell,
  Trash2,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  ArrowUpDown,
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

const mockPolicies: ExpiryPolicy[] = [
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

export default function ExpiryPoliciesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fefoFilter, setFefoFilter] = useState<string>('all');

  const filteredPolicies = useMemo(() => {
    return mockPolicies.filter((policy) => {
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
  }, [searchTerm, statusFilter, fefoFilter]);

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
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
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
          <div className="text-2xl font-bold text-gray-900">{mockPolicies.length}</div>
          <div className="text-sm text-gray-500">Total Policies</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-green-500" />
            <span className="text-2xl font-bold text-green-600">
              {mockPolicies.filter((p) => p.fefoEnforced).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">FEFO Enforced</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-2xl font-bold text-amber-600">
              {mockPolicies.filter((p) => p.autoQuarantine).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Auto-Quarantine</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">
              {mockPolicies.filter((p) => p.returnToSupplierEligible).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Return Eligible</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold text-orange-600">
              {mockPolicies.filter((p) => p.warningThreshold30).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">30-Day Alerts</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
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
                    {policy.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-orange-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
