import { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Eye,
  X,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  BarChart3,
  Shield,
  AlertTriangle,
} from 'lucide-react';

interface PriceAgreement {
  serviceCode: string;
  serviceName: string;
  agreedPrice: number;
  effectiveDate: string;
}

interface CoverageRule {
  id: string;
  category: string;
  coveragePercent: number;
  maxLimit: number;
  waitingPeriod: number;
  preAuthRequired: boolean;
}

interface Provider {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  contractStatus: 'active' | 'expired' | 'pending' | 'terminated';
  contractStart: string;
  contractEnd: string;
  isActive: boolean;
  totalClaims: number;
  approvalRate: number;
  avgProcessingDays: number;
  totalPaid: number;
  coverageRules: CoverageRule[];
  priceAgreements: PriceAgreement[];
}

const mockProviders: Provider[] = [
  {
    id: '1',
    name: 'AAR Healthcare',
    code: 'AAR',
    email: 'claims@aar-healthcare.com',
    phone: '+256 700 123 456',
    address: 'Plot 34, Kampala Road, Kampala',
    contractStatus: 'active',
    contractStart: '2024-01-01',
    contractEnd: '2025-12-31',
    isActive: true,
    totalClaims: 245,
    approvalRate: 92,
    avgProcessingDays: 3,
    totalPaid: 125000000,
    coverageRules: [
      { id: 'r1', category: 'Outpatient', coveragePercent: 80, maxLimit: 5000000, waitingPeriod: 0, preAuthRequired: false },
      { id: 'r2', category: 'Inpatient', coveragePercent: 90, maxLimit: 50000000, waitingPeriod: 30, preAuthRequired: true },
      { id: 'r3', category: 'Dental', coveragePercent: 70, maxLimit: 2000000, waitingPeriod: 90, preAuthRequired: false },
    ],
    priceAgreements: [
      { serviceCode: 'CONS-001', serviceName: 'General Consultation', agreedPrice: 50000, effectiveDate: '2024-01-01' },
      { serviceCode: 'LAB-001', serviceName: 'Complete Blood Count', agreedPrice: 35000, effectiveDate: '2024-01-01' },
    ],
  },
  {
    id: '2',
    name: 'Jubilee Insurance',
    code: 'JUB',
    email: 'health@jubilee.co.ug',
    phone: '+256 700 234 567',
    address: 'Jubilee Centre, Parliament Avenue, Kampala',
    contractStatus: 'active',
    contractStart: '2024-06-01',
    contractEnd: '2026-05-31',
    isActive: true,
    totalClaims: 189,
    approvalRate: 88,
    avgProcessingDays: 5,
    totalPaid: 98000000,
    coverageRules: [
      { id: 'r4', category: 'Outpatient', coveragePercent: 75, maxLimit: 4000000, waitingPeriod: 0, preAuthRequired: false },
      { id: 'r5', category: 'Inpatient', coveragePercent: 85, maxLimit: 40000000, waitingPeriod: 60, preAuthRequired: true },
    ],
    priceAgreements: [
      { serviceCode: 'CONS-001', serviceName: 'General Consultation', agreedPrice: 45000, effectiveDate: '2024-06-01' },
    ],
  },
  {
    id: '3',
    name: 'UAP Insurance',
    code: 'UAP',
    email: 'medical@uap.co.ug',
    phone: '+256 700 345 678',
    address: 'UAP Building, Jinja Road, Kampala',
    contractStatus: 'expired',
    contractStart: '2023-01-01',
    contractEnd: '2024-12-31',
    isActive: false,
    totalClaims: 156,
    approvalRate: 75,
    avgProcessingDays: 8,
    totalPaid: 67000000,
    coverageRules: [
      { id: 'r6', category: 'Outpatient', coveragePercent: 70, maxLimit: 3000000, waitingPeriod: 0, preAuthRequired: false },
    ],
    priceAgreements: [],
  },
  {
    id: '4',
    name: 'Liberty Insurance',
    code: 'LIB',
    email: 'health@liberty.co.ug',
    phone: '+256 700 456 789',
    address: 'Liberty House, Kira Road, Kampala',
    contractStatus: 'pending',
    contractStart: '2025-02-01',
    contractEnd: '2027-01-31',
    isActive: false,
    totalClaims: 0,
    approvalRate: 0,
    avgProcessingDays: 0,
    totalPaid: 0,
    coverageRules: [],
    priceAgreements: [],
  },
];

export default function ProvidersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'coverage' | 'pricing' | 'metrics'>('info');

  const stats = useMemo(() => ({
    total: mockProviders.length,
    active: mockProviders.filter(p => p.isActive).length,
    expiringSoon: mockProviders.filter(p => {
      const endDate = new Date(p.contractEnd);
      const now = new Date();
      const diff = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff > 0 && diff <= 60;
    }).length,
    totalPaid: mockProviders.reduce((sum, p) => sum + p.totalPaid, 0),
  }), []);

  const filteredProviders = useMemo(() => {
    return mockProviders.filter(provider => {
      const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = !showActiveOnly || provider.isActive;
      return matchesSearch && matchesActive;
    });
  }, [searchTerm, showActiveOnly]);

  const getContractStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      terminated: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleViewDetails = (provider: Provider) => {
    setSelectedProvider(provider);
    setDetailsTab('info');
    setShowDetailsModal(true);
  };

  const handleEdit = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowEditModal(true);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Insurance Providers</h1>
            <p className="text-gray-500 text-sm">Manage provider contracts and coverage</p>
          </div>
        </div>
        <button onClick={() => setShowEditModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Providers</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-200" />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Expiring Soon</p>
              <p className="text-xl font-bold text-yellow-600">{stats.expiringSoon}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-200" />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Paid (YTD)</p>
              <p className="text-lg font-bold text-blue-600">UGX {(stats.totalPaid / 1000000).toFixed(1)}M</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Active providers only</span>
          </label>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map(provider => (
            <div key={provider.id} className={`card p-4 ${!provider.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Building2 className={`w-5 h-5 ${provider.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{provider.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {provider.isActive ? (
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  ) : (
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{provider.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{provider.phone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 py-2 border-y">
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500">Claims</p>
                  <p className="font-semibold">{provider.totalClaims}</p>
                </div>
                <div className="text-center flex-1 border-x">
                  <p className="text-xs text-gray-500">Approval</p>
                  <p className="font-semibold text-green-600">{provider.approvalRate}%</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500">Avg Days</p>
                  <p className="font-semibold">{provider.avgProcessingDays}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Contract Status</p>
                  {getContractStatusBadge(provider.contractStatus)}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Expires</p>
                  <p className="text-sm font-medium">{provider.contractEnd}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewDetails(provider)}
                  className="flex-1 btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleEdit(provider)}
                  className="flex-1 btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
          ))}

          {filteredProviders.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No providers found matching your criteria
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{selectedProvider.name}</h2>
                  <p className="text-sm text-gray-500">{selectedProvider.code}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b flex-shrink-0">
              {[
                { key: 'info', label: 'Information', icon: Building2 },
                { key: 'coverage', label: 'Coverage Rules', icon: Shield },
                { key: 'pricing', label: 'Price Agreements', icon: DollarSign },
                { key: 'metrics', label: 'Performance', icon: BarChart3 },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailsTab(tab.key as typeof detailsTab)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] ${
                    detailsTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {detailsTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="font-medium">{selectedProvider.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Phone</p>
                      <p className="font-medium">{selectedProvider.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="font-medium">{selectedProvider.address}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Contract Details
                    </h3>
                    <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        {getContractStatusBadge(selectedProvider.contractStatus)}
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Start Date</p>
                        <p className="font-medium">{selectedProvider.contractStart}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">End Date</p>
                        <p className="font-medium">{selectedProvider.contractEnd}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'coverage' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Coverage Rules & Limits</h3>
                    <button className="btn-secondary text-sm py-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Rule
                    </button>
                  </div>
                  {selectedProvider.coverageRules.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-600">Category</th>
                          <th className="text-right p-3 font-medium text-gray-600">Coverage %</th>
                          <th className="text-right p-3 font-medium text-gray-600">Max Limit</th>
                          <th className="text-right p-3 font-medium text-gray-600">Waiting Period</th>
                          <th className="text-center p-3 font-medium text-gray-600">Pre-Auth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedProvider.coverageRules.map(rule => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium">{rule.category}</td>
                            <td className="p-3 text-right">{rule.coveragePercent}%</td>
                            <td className="p-3 text-right">UGX {rule.maxLimit.toLocaleString()}</td>
                            <td className="p-3 text-right">{rule.waitingPeriod} days</td>
                            <td className="p-3 text-center">
                              {rule.preAuthRequired ? (
                                <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No coverage rules defined</div>
                  )}
                </div>
              )}

              {detailsTab === 'pricing' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Price Agreements per Service</h3>
                    <button className="btn-secondary text-sm py-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Agreement
                    </button>
                  </div>
                  {selectedProvider.priceAgreements.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-600">Service Code</th>
                          <th className="text-left p-3 font-medium text-gray-600">Service Name</th>
                          <th className="text-right p-3 font-medium text-gray-600">Agreed Price</th>
                          <th className="text-right p-3 font-medium text-gray-600">Effective Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedProvider.priceAgreements.map((agreement, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3 font-mono text-blue-600">{agreement.serviceCode}</td>
                            <td className="p-3">{agreement.serviceName}</td>
                            <td className="p-3 text-right font-medium">UGX {agreement.agreedPrice.toLocaleString()}</td>
                            <td className="p-3 text-right text-gray-600">{agreement.effectiveDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No price agreements defined</div>
                  )}
                </div>
              )}

              {detailsTab === 'metrics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-600">Total Claims</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{selectedProvider.totalClaims}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-600">Approval Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{selectedProvider.approvalRate}%</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-gray-600">Avg Processing</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-600">{selectedProvider.avgProcessingDays} days</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-gray-600">Total Paid</span>
                      </div>
                      <p className="text-xl font-bold text-purple-600">UGX {(selectedProvider.totalPaid / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Performance Summary</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Claims Approval Rate</span>
                          <span className="font-medium">{selectedProvider.approvalRate}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-green-500 rounded-full"
                            style={{ width: `${selectedProvider.approvalRate}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Processing Efficiency</span>
                          <span className="font-medium">{Math.max(0, 100 - selectedProvider.avgProcessingDays * 10)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ width: `${Math.max(0, 100 - selectedProvider.avgProcessingDays * 10)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
              <button onClick={() => setShowDetailsModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">
                {selectedProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>
              <button onClick={() => { setShowEditModal(false); setSelectedProvider(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name</label>
                  <input
                    type="text"
                    defaultValue={selectedProvider?.name || ''}
                    placeholder="Enter name..."
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Code</label>
                  <input
                    type="text"
                    defaultValue={selectedProvider?.code || ''}
                    placeholder="e.g., AAR"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue={selectedProvider?.email || ''}
                  placeholder="claims@provider.com"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  defaultValue={selectedProvider?.phone || ''}
                  placeholder="+256 700 000 000"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  defaultValue={selectedProvider?.address || ''}
                  placeholder="Enter address..."
                  className="input h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Start</label>
                  <input
                    type="date"
                    defaultValue={selectedProvider?.contractStart || ''}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
                  <input
                    type="date"
                    defaultValue={selectedProvider?.contractEnd || ''}
                    className="input"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  defaultChecked={selectedProvider?.isActive ?? true}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active provider</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => { setShowEditModal(false); setSelectedProvider(null); }} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => { setShowEditModal(false); setSelectedProvider(null); alert('Provider saved!'); }}
                className="btn-primary"
              >
                {selectedProvider ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
