import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  X,
  Save,
  RefreshCw,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Download,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';
import { formatCurrency } from '../../../lib/currency';
import { useFacilityId } from '../../../lib/facility';

interface Contract {
  id: string;
  supplier: Supplier;
  supplierName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Expiring Soon' | 'Expired' | 'Pending';
  totalValue: number;
  paymentTerms: string;
  renewalAlert: boolean;
  daysToExpiry: number;
  supplierType: string;
}

const PAYMENT_TERMS_OPTIONS = ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'COD', 'Prepaid', 'On Receipt'];

export default function PharmacyContractsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.suppliers')) {
    return <AccessDenied />;
  }

  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showRenewalAlerts, setShowRenewalAlerts] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  // Form state for new/edit contract
  const [formData, setFormData] = useState({
    creditLimit: '',
    paymentTerms: 'Net 30',
    notes: '',
  });

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      pharmacyService.suppliers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'suppliers'] });
      toast.success(editingContract ? 'Contract updated successfully' : 'Contract created successfully');
      closeModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save contract');
    },
  });

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
        supplier: s,
        supplierName: s.name,
        contractNumber: `CNT-${s.code}`,
        startDate: createdDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        status,
        totalValue: parseFloat(s.creditLimit as any) || 0,
        paymentTerms: s.paymentTerms || 'Net 30',
        renewalAlert: daysToExpiry < 30 && daysToExpiry > 0,
        daysToExpiry,
        supplierType: s.type || 'general',
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
  }, [contracts, searchTerm, statusFilter, showRenewalAlerts]);

  const stats = useMemo(() => {
    const active = contracts.filter((c) => c.status === 'Active').length;
    const expiring = contracts.filter((c) => c.status === 'Expiring Soon').length;
    const totalValue = contracts.reduce((sum, c) => sum + c.totalValue, 0);
    const renewalAlerts = contracts.filter((c) => c.renewalAlert).length;
    return { active, expiring, totalValue, renewalAlerts };
  }, [contracts]);

  const closeModal = () => {
    setShowModal(false);
    setEditingContract(null);
    setFormData({ creditLimit: '', paymentTerms: 'Net 30', notes: '' });
  };

  const openEditModal = (contract: Contract) => {
    setEditingContract(contract);
    setFormData({
      creditLimit: String(contract.totalValue || ''),
      paymentTerms: contract.paymentTerms || 'Net 30',
      notes: contract.supplier.notes || '',
    });
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingContract(null);
    setFormData({ creditLimit: '', paymentTerms: 'Net 30', notes: '' });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!editingContract) {
      toast.error('Select a supplier from the Supplier Directory first, then edit their contract terms here');
      closeModal();
      return;
    }
    const creditVal = parseFloat(formData.creditLimit);
    if (isNaN(creditVal) || creditVal < 0) {
      toast.error('Please enter a valid contract value');
      return;
    }
    updateMutation.mutate({
      id: editingContract.id,
      data: {
        creditLimit: creditVal,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes,
      },
    });
  };

  const handleExportCSV = () => {
    if (contracts.length === 0) {
      toast.error('No contracts to export');
      return;
    }
    const headers = ['Contract #', 'Supplier', 'Type', 'Start Date', 'End Date', 'Days Left', 'Value', 'Payment Terms', 'Status'];
    const rows = contracts.map((c) => [
      c.contractNumber, c.supplierName, c.supplierType, c.startDate, c.endDate,
      c.daysToExpiry, c.totalValue, c.paymentTerms, c.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-contracts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Contracts exported');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-700';
      case 'Expiring Soon': return 'bg-yellow-100 text-yellow-700';
      case 'Expired': return 'bg-red-100 text-red-700';
      case 'Pending': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Active': return <CheckCircle className="w-3 h-3" />;
      case 'Expiring Soon': return <Clock className="w-3 h-3" />;
      case 'Expired': return <AlertTriangle className="w-3 h-3" />;
      case 'Pending': return <Clock className="w-3 h-3" />;
      default: return null;
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </button>
        </div>
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
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
                              <Bell className="w-4 h-4 text-red-500" title="Renewal alert" />
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
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full capitalize">
                        {contract.supplierType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{contract.paymentTerms}</p>
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
                        <button
                          onClick={() => setViewContract(contract)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => openEditModal(contract)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit contract"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </button>
                        {contract.status === 'Expiring Soon' && (
                          <button
                            onClick={() => {
                              openEditModal(contract);
                              toast.info('Update contract value and terms to renew');
                            }}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors"
                          >
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

      {/* View Contract Detail Modal */}
      {viewContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewContract.contractNumber}</h2>
                <p className="text-sm text-gray-500">{viewContract.supplierName}</p>
              </div>
              <button onClick={() => setViewContract(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewContract.status)}`}>
                  {getStatusIcon(viewContract.status)}
                  {viewContract.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Contract Value</span>
                <span className="font-semibold text-gray-900">{formatCurrency(viewContract.totalValue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Payment Terms</span>
                <span className="text-gray-900">{viewContract.paymentTerms}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Start Date</span>
                <span className="text-gray-900">{viewContract.startDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">End Date</span>
                <span className="text-gray-900">{viewContract.endDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Days Remaining</span>
                <span className={`font-medium ${viewContract.daysToExpiry < 30 ? 'text-red-600' : 'text-green-600'}`}>
                  {viewContract.daysToExpiry > 0 ? `${viewContract.daysToExpiry} days` : 'Expired'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Supplier Type</span>
                <span className="text-gray-900 capitalize">{viewContract.supplierType.replace('_', ' ')}</span>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Supplier Contact</h3>
                <div className="space-y-2">
                  {viewContract.supplier.contactPerson && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{viewContract.supplier.contactPerson}</span>
                    </div>
                  )}
                  {viewContract.supplier.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{viewContract.supplier.email}</span>
                    </div>
                  )}
                  {viewContract.supplier.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{viewContract.supplier.phone}</span>
                    </div>
                  )}
                  {viewContract.supplier.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{viewContract.supplier.address}{viewContract.supplier.city ? `, ${viewContract.supplier.city}` : ''}</span>
                    </div>
                  )}
                  {viewContract.supplier.bankName && (
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{viewContract.supplier.bankName} — {viewContract.supplier.bankAccount || 'N/A'}</span>
                    </div>
                  )}
                </div>
              </div>

              {viewContract.supplier.notes && (
                <div className="border-t border-gray-100 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                  <p className="text-sm text-gray-600">{viewContract.supplier.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setViewContract(null)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                Close
              </button>
              <button
                onClick={() => { setViewContract(null); openEditModal(viewContract); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Contract
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editingContract ? `Edit Contract — ${editingContract.contractNumber}` : 'New Contract'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {editingContract && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{editingContract.supplierName}</p>
                  <p className="text-xs text-gray-500 capitalize">{editingContract.supplierType.replace('_', ' ')} · {editingContract.startDate} — {editingContract.endDate}</p>
                </div>
              )}
              {!editingContract && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Contracts are linked to suppliers. To create a new contract, first add the supplier in the{' '}
                    <a href="/pharmacy/suppliers" className="underline font-medium">Supplier Directory</a>,
                    then edit their contract terms here.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Value (Credit Limit) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">UGX</span>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                    className="w-full pl-12 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PAYMENT_TERMS_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contract terms, special conditions..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || !editingContract}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingContract ? 'Update Contract' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
