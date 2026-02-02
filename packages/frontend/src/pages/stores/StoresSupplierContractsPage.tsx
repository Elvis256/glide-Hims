import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/currency';
import {
  FileText,
  Search,
  Filter,
  X,
  Eye,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  Building2,
  DollarSign,
  Loader2,
} from 'lucide-react';
import {
  vendorContractsService,
  type VendorContract,
  type ContractStatus as ContractStatusType,
  type RenewContractDto,
} from '../../services/vendor-contracts';
import { useFacilityId } from '../../lib/facility';

type ContractStatus = 'active' | 'expiring_soon' | 'expired' | 'draft' | 'renewed' | 'terminated';

const statusConfig: Record<ContractStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  expiring_soon: { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: Clock },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  renewed: { label: 'Renewed', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  terminated: { label: 'Terminated', color: 'bg-red-100 text-red-700', icon: X },
};

export default function StoresSupplierContractsPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingContract, setViewingContract] = useState<VendorContract | null>(null);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingContract, setRenewingContract] = useState<VendorContract | null>(null);
  const [renewFormData, setRenewFormData] = useState<RenewContractDto>({
    newEndDate: '',
    newTotalValue: undefined,
    notes: '',
  });

  // Fetch contracts
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['supplier-contracts', facilityId, statusFilter],
    queryFn: () =>
      vendorContractsService.list(
        facilityId,
        statusFilter === 'all' ? undefined : (statusFilter as ContractStatusType)
      ),
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['supplier-contracts-stats', facilityId],
    queryFn: () => vendorContractsService.getStats(facilityId),
    enabled: !!facilityId,
  });

  // Renew mutation
  const renewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RenewContractDto }) =>
      vendorContractsService.renew(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-contracts-stats'] });
      setShowRenewModal(false);
      setRenewingContract(null);
      setRenewFormData({ newEndDate: '', newTotalValue: undefined, notes: '' });
    },
  });

  const suppliers = useMemo(() => {
    const unique = [...new Set(contracts.map((c) => c.supplier?.name).filter(Boolean))];
    return unique.sort() as string[];
  }, [contracts]);

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch =
        contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contract.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSupplier =
        supplierFilter === 'all' || contract.supplier?.name === supplierFilter;
      return matchesSearch && matchesSupplier;
    });
  }, [contracts, searchQuery, supplierFilter]);

  const summaryStats = useMemo(() => {
    return {
      total: stats?.total || 0,
      active: stats?.active || 0,
      expiringSoon: stats?.expiringSoon || 0,
      totalValue: stats?.totalActiveValue || 0,
    };
  }, [stats]);

  const getDaysUntilExpiry = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleOpenRenewModal = (contract: VendorContract) => {
    setRenewingContract(contract);
    setRenewFormData({
      newEndDate: '',
      newTotalValue: contract.totalValue,
      notes: '',
    });
    setShowRenewModal(true);
  };

  const handleRenewContract = () => {
    if (renewingContract && renewFormData.newEndDate) {
      renewMutation.mutate({ id: renewingContract.id, data: renewFormData });
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supplier Contracts</h1>
            <p className="text-sm text-gray-500 mt-1">Manage supplier contracts and agreements</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <FileText className="w-4 h-4" />
              Total Contracts
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{summaryStats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Active
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{summaryStats.active}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Expiring Soon
            </div>
            <p className="text-xl font-bold text-orange-700 mt-1">{summaryStats.expiringSoon}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <DollarSign className="w-4 h-4" />
              Active Value
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {formatCurrency(summaryStats.totalValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Supplier</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ContractStatus | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
                <option value="draft">Draft</option>
                <option value="renewed">Renewed</option>
              </select>
            </div>
            {(supplierFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSupplierFilter('all');
                  setStatusFilter('all');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contract List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No contracts found</p>
            <p className="text-sm mt-1">No supplier contracts match your search criteria</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contract #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Terms
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredContracts.map((contract) => {
                  const StatusIcon = statusConfig[contract.status].icon;
                  const daysUntilExpiry = getDaysUntilExpiry(contract.endDate);
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className="font-medium text-blue-600 hover:underline cursor-pointer"
                          onClick={() => setViewingContract(contract)}
                        >
                          {contract.contractNumber}
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">{contract.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {contract.supplier?.name || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                          </p>
                          {daysUntilExpiry > 0 && daysUntilExpiry <= 60 && (
                            <p className="text-orange-600 text-xs">{daysUntilExpiry} days remaining</p>
                          )}
                          {daysUntilExpiry <= 0 && contract.status !== 'renewed' && (
                            <p className="text-red-600 text-xs">Expired</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-600">
                          {contract.paymentTerms && (
                            <p className="truncate max-w-[150px]" title={contract.paymentTerms}>
                              {contract.paymentTerms}
                            </p>
                          )}
                          {contract.deliveryTerms && (
                            <p className="text-xs text-gray-400 truncate max-w-[150px]" title={contract.deliveryTerms}>
                              {contract.deliveryTerms}
                            </p>
                          )}
                          {!contract.paymentTerms && !contract.deliveryTerms && '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatCurrency(contract.totalValue)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[contract.status].color}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[contract.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingContract(contract)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(contract.status === 'expiring_soon' || contract.status === 'expired') && (
                            <button
                              onClick={() => handleOpenRenewModal(contract)}
                              className="p-1.5 hover:bg-green-100 rounded-lg text-green-600 hover:text-green-700"
                              title="Renew Contract"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Contract Modal */}
      {viewingContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingContract.contractNumber}</h2>
                <p className="text-sm text-gray-500">{viewingContract.title}</p>
              </div>
              <button
                onClick={() => setViewingContract(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {viewingContract.supplier?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingContract.status].color}`}
                  >
                    {statusConfig[viewingContract.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(viewingContract.startDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">End Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {formatDate(viewingContract.endDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contract Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(viewingContract.totalValue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Renewal Count</p>
                  <p className="font-medium">{viewingContract.renewalCount}</p>
                </div>
              </div>

              {viewingContract.paymentTerms && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Payment Terms</p>
                  <p className="text-sm text-gray-700">{viewingContract.paymentTerms}</p>
                </div>
              )}

              {viewingContract.deliveryTerms && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Delivery Terms</p>
                  <p className="text-sm text-gray-700">{viewingContract.deliveryTerms}</p>
                </div>
              )}

              {viewingContract.termsAndConditions && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-2">Terms & Conditions</p>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                    {viewingContract.termsAndConditions}
                  </div>
                </div>
              )}

              {viewingContract.amendments && viewingContract.amendments.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Amendment History</p>
                  <div className="space-y-2">
                    {viewingContract.amendments.map((amendment) => (
                      <div
                        key={amendment.id}
                        className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3"
                      >
                        <RefreshCw className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{amendment.description}</p>
                          <p className="text-xs text-gray-500">
                            {amendment.amendmentNumber} - Effective: {formatDate(amendment.effectiveDate)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setViewingContract(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              {(viewingContract.status === 'expiring_soon' || viewingContract.status === 'expired') && (
                <button
                  onClick={() => {
                    setViewingContract(null);
                    handleOpenRenewModal(viewingContract);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Renew Contract
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Renew Contract Modal */}
      {showRenewModal && renewingContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Renew Contract</h2>
                <p className="text-sm text-gray-500">{renewingContract.contractNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowRenewModal(false);
                  setRenewingContract(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={renewFormData.newEndDate}
                  onChange={(e) =>
                    setRenewFormData((prev) => ({ ...prev, newEndDate: e.target.value }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Contract Value
                </label>
                <input
                  type="number"
                  value={renewFormData.newTotalValue || ''}
                  onChange={(e) =>
                    setRenewFormData((prev) => ({
                      ...prev,
                      newTotalValue: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={renewFormData.notes || ''}
                  onChange={(e) =>
                    setRenewFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Add any notes about the renewal..."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowRenewModal(false);
                  setRenewingContract(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRenewContract}
                disabled={!renewFormData.newEndDate || renewMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {renewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Renew Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
