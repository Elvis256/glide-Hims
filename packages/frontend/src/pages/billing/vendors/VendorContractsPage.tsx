import { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  X,
  Eye,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Upload,
  ChevronDown,
  Building2,
  DollarSign,
  Edit,
  History,
} from 'lucide-react';

type ContractStatus = 'active' | 'expiring_soon' | 'expired' | 'draft' | 'renewed';

interface Amendment {
  id: string;
  date: string;
  description: string;
  changedBy: string;
}

interface Contract {
  id: string;
  contractNumber: string;
  vendorId: string;
  vendorName: string;
  startDate: string;
  endDate: string;
  value: number;
  terms: string;
  status: ContractStatus;
  documents: string[];
  amendments: Amendment[];
}

const mockContracts: Contract[] = [
  {
    id: '1',
    contractNumber: 'CON-2024-001',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    value: 2500000,
    terms: 'Monthly supply of medical consumables with 30-day payment terms',
    status: 'active',
    documents: ['contract.pdf', 'terms.pdf'],
    amendments: [],
  },
  {
    id: '2',
    contractNumber: 'CON-2024-002',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    startDate: '2023-06-01',
    endDate: '2024-02-28',
    value: 5000000,
    terms: 'Exclusive pharmaceutical supply agreement with quarterly reviews',
    status: 'expiring_soon',
    documents: ['pharma_contract.pdf'],
    amendments: [
      { id: 'a1', date: '2023-09-15', description: 'Price adjustment +5%', changedBy: 'John Admin' },
    ],
  },
  {
    id: '3',
    contractNumber: 'CON-2023-015',
    vendorId: '3',
    vendorName: 'EquipMed Africa',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    value: 1500000,
    terms: 'Equipment maintenance and supply agreement',
    status: 'expired',
    documents: ['equipment_contract.pdf', 'sla.pdf'],
    amendments: [],
  },
  {
    id: '4',
    contractNumber: 'CON-2024-003',
    vendorId: '4',
    vendorName: 'CleanPro Services',
    startDate: '2024-02-01',
    endDate: '2025-01-31',
    value: 800000,
    terms: 'Cleaning and sanitation services',
    status: 'draft',
    documents: [],
    amendments: [],
  },
  {
    id: '5',
    contractNumber: 'CON-2024-004',
    vendorId: '5',
    vendorName: 'Lab Consumables Ltd',
    startDate: '2024-01-15',
    endDate: '2025-01-14',
    value: 1200000,
    terms: 'Laboratory consumables supply with monthly deliveries',
    status: 'active',
    documents: ['lab_contract.pdf'],
    amendments: [
      { id: 'a2', date: '2024-01-20', description: 'Added new product categories', changedBy: 'Mary Admin' },
    ],
  },
  {
    id: '6',
    contractNumber: 'CON-2023-010',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    value: 2000000,
    terms: 'Previous annual contract - renewed',
    status: 'renewed',
    documents: ['old_contract.pdf'],
    amendments: [],
  },
];

const statusConfig: Record<ContractStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  expiring_soon: { label: 'Expiring Soon', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: Clock },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  renewed: { label: 'Renewed', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
};

export default function VendorContractsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);
  const [showAmendments, setShowAmendments] = useState(false);

  const vendors = useMemo(() => {
    const unique = [...new Set(mockContracts.map((c) => c.vendorName))];
    return unique.sort();
  }, []);

  const filteredContracts = useMemo(() => {
    const today = new Date();
    return mockContracts.filter((contract) => {
      const matchesSearch =
        contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contract.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVendor = vendorFilter === 'all' || contract.vendorName === vendorFilter;
      const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;

      let matchesExpiry = true;
      if (expiryFilter !== 'all') {
        const endDate = new Date(contract.endDate);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (expiryFilter === '30days') matchesExpiry = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        else if (expiryFilter === '60days') matchesExpiry = daysUntilExpiry <= 60 && daysUntilExpiry > 0;
        else if (expiryFilter === '90days') matchesExpiry = daysUntilExpiry <= 90 && daysUntilExpiry > 0;
      }

      return matchesSearch && matchesVendor && matchesStatus && matchesExpiry;
    });
  }, [searchQuery, vendorFilter, statusFilter, expiryFilter]);

  const summaryStats = useMemo(() => {
    const today = new Date();
    return {
      total: mockContracts.length,
      active: mockContracts.filter((c) => c.status === 'active').length,
      expiringSoon: mockContracts.filter((c) => c.status === 'expiring_soon').length,
      totalValue: mockContracts.filter((c) => c.status === 'active' || c.status === 'expiring_soon').reduce((sum, c) => sum + c.value, 0),
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const getDaysUntilExpiry = (endDate: string) => {
    const today = new Date();
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Contracts</h1>
            <p className="text-sm text-gray-500 mt-1">Manage contracts and agreements</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Contract
          </button>
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
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(summaryStats.totalValue)}</p>
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
              <label className="block text-xs text-gray-500 mb-1">Vendor</label>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expiry</label>
              <select
                value={expiryFilter}
                onChange={(e) => setExpiryFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="30days">Within 30 days</option>
                <option value="60days">Within 60 days</option>
                <option value="90days">Within 90 days</option>
              </select>
            </div>
            {(vendorFilter !== 'all' || statusFilter !== 'all' || expiryFilter !== 'all') && (
              <button
                onClick={() => {
                  setVendorFilter('all');
                  setStatusFilter('all');
                  setExpiryFilter('all');
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
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contract #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Docs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
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
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{contract.vendorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <p className="text-gray-900">{contract.startDate} - {contract.endDate}</p>
                        {daysUntilExpiry > 0 && daysUntilExpiry <= 60 && (
                          <p className="text-orange-600 text-xs">{daysUntilExpiry} days remaining</p>
                        )}
                        {daysUntilExpiry <= 0 && contract.status !== 'renewed' && (
                          <p className="text-red-600 text-xs">Expired</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(contract.value)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[contract.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[contract.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">{contract.documents.length}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingContract(contract)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(contract.status === 'expiring_soon' || contract.status === 'expired') && (
                          <button
                            className="p-1.5 hover:bg-green-100 rounded-lg text-green-600 hover:text-green-700"
                            title="Renew"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredContracts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No contracts found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* View Contract Modal */}
      {viewingContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingContract.contractNumber}</h2>
                <p className="text-sm text-gray-500">Contract Details</p>
              </div>
              <button onClick={() => setViewingContract(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {viewingContract.vendorName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingContract.status].color}`}>
                    {statusConfig[viewingContract.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {viewingContract.startDate}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">End Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {viewingContract.endDate}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Contract Value</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(viewingContract.value)}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Terms & Conditions</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                  {viewingContract.terms}
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Documents</p>
                  <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    Upload
                  </button>
                </div>
                <div className="space-y-2">
                  {viewingContract.documents.length > 0 ? (
                    viewingContract.documents.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{doc}</span>
                        </div>
                        <button className="text-blue-600 hover:underline text-sm">Download</button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">No documents uploaded</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">Amendment History</p>
                  <button className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                    <Edit className="w-3 h-3" />
                    Add Amendment
                  </button>
                </div>
                <div className="space-y-2">
                  {viewingContract.amendments.length > 0 ? (
                    viewingContract.amendments.map((amendment) => (
                      <div key={amendment.id} className="flex items-start gap-3 bg-gray-50 rounded-lg px-4 py-3">
                        <History className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{amendment.description}</p>
                          <p className="text-xs text-gray-500">{amendment.date} by {amendment.changedBy}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 italic">No amendments recorded</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setViewingContract(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Close
              </button>
              {(viewingContract.status === 'expiring_soon' || viewingContract.status === 'expired') && (
                <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  <RefreshCw className="w-4 h-4" />
                  Renew Contract
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Contract Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create New Contract</h2>
                <p className="text-sm text-gray-500">Enter contract details</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Value (KES)</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                <textarea rows={3} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Documents</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Drag and drop files or click to browse</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
