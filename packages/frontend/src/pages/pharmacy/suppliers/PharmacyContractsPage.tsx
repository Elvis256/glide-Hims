import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';
import { formatCurrency } from '../../../lib/currency';

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

export default function PharmacyContractsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.suppliers')) {
    return <AccessDenied />;
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showRenewalAlerts, setShowRenewalAlerts] = useState(false);

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  // Transform suppliers to contracts format (since API doesn't have contracts endpoint yet)
  const contracts: Contract[] = useMemo(() => {
    if (!suppliersData?.data) return [];
    return suppliersData.data.map((s: Supplier) => {
      const createdDate = new Date(s.createdAt);
      const endDate = new Date(createdDate);
      endDate.setFullYear(endDate.getFullYear() + 1);
      const now = new Date();
      const daysToExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let status: 'Active' | 'Expiring Soon' | 'Expired' | 'Pending' = 'Active';
      if (daysToExpiry < 0) status = 'Expired';
      else if (daysToExpiry < 30) status = 'Expiring Soon';
      else if (s.status !== 'active') status = 'Pending';

      return {
        id: s.id,
        supplierName: s.name,
        contractNumber: `CNT-${s.code}`,
        startDate: createdDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        status,
        totalValue: s.creditLimit || 0,
        volumeCommitment: 1000,
        volumeFulfilled: 500,
        pricingTerms: 'Standard Terms',
        paymentTerms: s.paymentTerms || 'Net 30',
        renewalAlert: daysToExpiry < 30 && daysToExpiry > 0,
        daysToExpiry,
        products: s.type ? [s.type] : [],
      };
    });
  }, [suppliersData]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch =
        contract.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.contractNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || contract.status === statusFilter;
      const matchesRenewal = !showRenewalAlerts || contract.renewalAlert;
      return matchesSearch && matchesStatus && matchesRenewal;
    });
  }, [searchTerm, statusFilter, showRenewalAlerts]);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'Active').length;
    const expiring = contracts.filter((c) => c.status === 'Expiring Soon').length;
    const totalValue = contracts.reduce((sum, c) => sum + c.totalValue, 0);
    const renewalAlerts = contracts.filter((c) => c.renewalAlert).length;
    return { active, expiring, totalValue, renewalAlerts };
  }, [contracts]);

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
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                      <p className="text-gray-500">Loading contracts...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="w-12 h-12 text-gray-300" />
                      <div>
                        <p className="text-gray-900 font-medium">No contracts found</p>
                        <p className="text-gray-500 text-sm">Get started by creating your first contract</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredContracts.map((contract) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
