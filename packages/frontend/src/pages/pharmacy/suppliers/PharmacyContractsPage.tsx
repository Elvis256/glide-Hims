import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  Bell,
  Eye,
  Edit2,
  Filter,
  TrendingUp,
} from 'lucide-react';

interface Contract {
  id: string;
  supplierName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';
  totalValue: number;
  volumeCommitment: number;
  volumeFulfilled: number;
  pricingTerms: string;
  paymentTerms: string;
  renewalAlert: boolean;
  daysToExpiry: number;
  products: string[];
}

const mockContracts: Contract[] = [
  {
    id: 'CON001',
    supplierName: 'PharmaCorp Kenya',
    contractNumber: 'PC-2024-001',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    status: 'Active',
    totalValue: 5000000,
    volumeCommitment: 10000,
    volumeFulfilled: 4500,
    pricingTerms: '15% discount on bulk orders',
    paymentTerms: 'Net 30 days',
    renewalAlert: false,
    daysToExpiry: 340,
    products: ['Antibiotics', 'Analgesics', 'Cardiovascular'],
  },
  {
    id: 'CON002',
    supplierName: 'MediSupply Ltd',
    contractNumber: 'MS-2024-005',
    startDate: '2024-01-01',
    endDate: '2024-03-31',
    status: 'Expiring Soon',
    totalValue: 2500000,
    volumeCommitment: 5000,
    volumeFulfilled: 4200,
    pricingTerms: '10% discount on orders above KES 100,000',
    paymentTerms: 'Net 45 days',
    renewalAlert: true,
    daysToExpiry: 65,
    products: ['Diabetes', 'Respiratory', 'Vitamins'],
  },
  {
    id: 'CON003',
    supplierName: 'HealthCare Distributors',
    contractNumber: 'HC-2023-012',
    startDate: '2023-06-01',
    endDate: '2024-01-31',
    status: 'Expired',
    totalValue: 1500000,
    volumeCommitment: 3000,
    volumeFulfilled: 2800,
    pricingTerms: 'Fixed pricing for 12 months',
    paymentTerms: 'Net 30 days',
    renewalAlert: false,
    daysToExpiry: -5,
    products: ['Surgical Supplies', 'Antibiotics'],
  },
  {
    id: 'CON004',
    supplierName: 'Global Pharma EA',
    contractNumber: 'GP-2024-003',
    startDate: '2024-02-01',
    endDate: '2025-01-31',
    status: 'Pending',
    totalValue: 8000000,
    volumeCommitment: 15000,
    volumeFulfilled: 0,
    pricingTerms: '20% discount on specialty drugs',
    paymentTerms: 'Net 60 days',
    renewalAlert: false,
    daysToExpiry: 365,
    products: ['Oncology', 'Specialty Drugs'],
  },
  {
    id: 'CON005',
    supplierName: 'PharmaCorp Kenya',
    contractNumber: 'PC-2024-002',
    startDate: '2024-01-01',
    endDate: '2024-04-30',
    status: 'Expiring Soon',
    totalValue: 1200000,
    volumeCommitment: 2000,
    volumeFulfilled: 1500,
    pricingTerms: 'Special pricing for emergency supplies',
    paymentTerms: 'Net 15 days',
    renewalAlert: true,
    daysToExpiry: 95,
    products: ['Emergency Medicines'],
  },
];

export default function PharmacyContractsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showRenewalAlerts, setShowRenewalAlerts] = useState(false);

  const filteredContracts = useMemo(() => {
    return mockContracts.filter((contract) => {
      const matchesSearch =
        contract.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || contract.status === statusFilter;
      const matchesRenewal = !showRenewalAlerts || contract.renewalAlert;
      return matchesSearch && matchesStatus && matchesRenewal;
    });
  }, [searchTerm, statusFilter, showRenewalAlerts]);

  const stats = useMemo(() => {
    const active = mockContracts.filter((c) => c.status === 'Active').length;
    const expiring = mockContracts.filter((c) => c.status === 'Expiring Soon').length;
    const totalValue = mockContracts.reduce((sum, c) => sum + c.totalValue, 0);
    const renewalAlerts = mockContracts.filter((c) => c.renewalAlert).length;
    return { active, expiring, totalValue, renewalAlerts };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Expiring Soon':
        return 'bg-yellow-100 text-yellow-700';
      case 'Expired':
        return 'bg-red-100 text-red-700';
      case 'Pending':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active':
        return <CheckCircle className="w-3 h-3" />;
      case 'Expiring Soon':
        return <Clock className="w-3 h-3" />;
      case 'Expired':
        return <AlertTriangle className="w-3 h-3" />;
      case 'Pending':
        return <Clock className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Contracts</h1>
          <p className="text-gray-500">Manage contracts, terms, and pricing agreements</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-sm text-gray-500">Active Contracts</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.expiring}</p>
              <p className="text-sm text-gray-500">Expiring Soon</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
              <p className="text-sm text-gray-500">Total Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.renewalAlerts}</p>
              <p className="text-sm text-gray-500">Renewal Alerts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by supplier or contract number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRenewalAlerts}
            onChange={(e) => setShowRenewalAlerts(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Renewal alerts only</span>
        </label>
      </div>

      {/* Contracts Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contract</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Volume</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Terms</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredContracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{contract.contractNumber}</span>
                          {contract.renewalAlert && (
                            <Bell className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{contract.supplierName}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-900">{contract.startDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-900">{contract.endDate}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {contract.daysToExpiry > 0
                          ? `${contract.daysToExpiry} days left`
                          : `Expired ${Math.abs(contract.daysToExpiry)} days ago`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {formatCurrency(contract.totalValue)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="w-3 h-3 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {contract.volumeFulfilled.toLocaleString()} / {contract.volumeCommitment.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.min((contract.volumeFulfilled / contract.volumeCommitment) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {Math.round((contract.volumeFulfilled / contract.volumeCommitment) * 100)}% fulfilled
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-900">{contract.pricingTerms}</p>
                      <p className="text-xs text-gray-500">{contract.paymentTerms}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}
                    >
                      {getStatusIcon(contract.status)}
                      {contract.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      {contract.status === 'Expiring Soon' && (
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors">
                          Renew
                        </button>
                      )}
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
