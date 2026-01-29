import { useState, useMemo } from 'react';
import {
  RotateCcw,
  Package,
  Building2,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  Download,
  Send,
  Eye,
  ChevronRight,
  Truck,
  CreditCard,
} from 'lucide-react';

interface ReturnableItem {
  id: string;
  medication: string;
  batch: string;
  expiryDate: string;
  daysToExpiry: number;
  quantity: number;
  value: number;
  supplier: string;
  returnPolicy: 'full-credit' | 'partial-credit' | 'no-return';
  policyDeadline: string;
  status: 'eligible' | 'requested' | 'authorized' | 'shipped' | 'credited' | 'rejected';
  returnRequestId?: string;
  authorizationNumber?: string;
  creditNoteNumber?: string;
  creditAmount?: number;
}

const returnableItemsData: ReturnableItem[] = [];

const returnPolicyConfig = {
  'full-credit': { label: 'Full Credit', color: 'bg-green-100 text-green-700' },
  'partial-credit': { label: 'Partial Credit', color: 'bg-amber-100 text-amber-700' },
  'no-return': { label: 'No Return', color: 'bg-red-100 text-red-700' },
};

const statusConfig = {
  eligible: { label: 'Eligible', color: 'bg-blue-100 text-blue-700', icon: Package },
  requested: { label: 'Requested', color: 'bg-purple-100 text-purple-700', icon: Send },
  authorized: { label: 'Authorized', color: 'bg-cyan-100 text-cyan-700', icon: CheckCircle2 },
  shipped: { label: 'Shipped', color: 'bg-amber-100 text-amber-700', icon: Truck },
  credited: { label: 'Credited', color: 'bg-green-100 text-green-700', icon: CreditCard },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ReturnToSupplierPage() {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPolicy, setSelectedPolicy] = useState<string>('all');
  const [returnableItems] = useState<ReturnableItem[]>(returnableItemsData);

  const filteredItems = useMemo(() => {
    return returnableItems.filter((item) => {
      const matchesSupplier = selectedSupplier === 'all' || item.supplier === selectedSupplier;
      const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
      const matchesPolicy = selectedPolicy === 'all' || item.returnPolicy === selectedPolicy;
      return matchesSupplier && matchesStatus && matchesPolicy;
    });
  }, [selectedSupplier, selectedStatus, selectedPolicy, returnableItems]);

  const stats = useMemo(() => {
    const eligibleValue = returnableItems
      .filter((i) => i.status === 'eligible')
      .reduce((sum, i) => sum + i.value, 0);
    const pendingReturns = returnableItems.filter((i) => ['requested', 'authorized', 'shipped'].includes(i.status)).length;
    const totalCredited = returnableItems
      .filter((i) => i.status === 'credited')
      .reduce((sum, i) => sum + (i.creditAmount || 0), 0);
    const rejectedCount = returnableItems.filter((i) => i.status === 'rejected').length;
    return { eligibleValue, pendingReturns, totalCredited, rejectedCount };
  }, [returnableItems]);

  const suppliers = useMemo(() => {
    return [...new Set(returnableItems.map((i) => i.supplier))];
  }, [returnableItems]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-blue-500" />
            Return to Supplier
          </h1>
          <p className="text-gray-600 mt-1">Manage medication returns and track credits</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create Return Request
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Eligible Value</p>
              <p className="text-xl font-bold text-gray-900">${stats.eligibleValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Returns</p>
              <p className="text-xl font-bold text-amber-600">{stats.pendingReturns}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Credited</p>
              <p className="text-xl font-bold text-green-600">${stats.totalCredited.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-xl font-bold text-red-600">{stats.rejectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Supplier:</span>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="eligible">Eligible</option>
            <option value="requested">Requested</option>
            <option value="authorized">Authorized</option>
            <option value="shipped">Shipped</option>
            <option value="credited">Credited</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Policy:</span>
          <select
            value={selectedPolicy}
            onChange={(e) => setSelectedPolicy(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Policies</option>
            <option value="full-credit">Full Credit</option>
            <option value="partial-credit">Partial Credit</option>
            <option value="no-return">No Return</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Medication</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Expiry</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Return Policy</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Deadline</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit Note</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <RotateCcw className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No returnable items</p>
                      <p className="text-xs text-gray-400 mt-1">Items eligible for return will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {filteredItems.map((item) => {
                const policyConfig = returnPolicyConfig[item.returnPolicy];
                const itemStatusConfig = statusConfig[item.status];
                const StatusIcon = itemStatusConfig.icon;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.medication}</p>
                        <p className="text-sm text-gray-500 font-mono">{item.batch}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{item.supplier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-900">{item.expiryDate}</p>
                        <p className={`text-xs ${item.daysToExpiry <= 30 ? 'text-red-600' : 'text-gray-500'}`}>
                          {item.daysToExpiry} days
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${item.value.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${policyConfig.color}`}>
                        {policyConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.policyDeadline}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${itemStatusConfig.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {itemStatusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.creditNoteNumber ? (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-green-500" />
                          <div>
                            <p className="text-sm text-green-600 font-mono">{item.creditNoteNumber}</p>
                            <p className="text-xs text-gray-500">${item.creditAmount?.toFixed(2)}</p>
                          </div>
                        </div>
                      ) : item.authorizationNumber ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-blue-600 font-mono">{item.authorizationNumber}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.status === 'eligible' && (
                          <button className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                            Request Return
                          </button>
                        )}
                        {item.status === 'authorized' && (
                          <button className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors">
                            Mark Shipped
                          </button>
                        )}
                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="View Details">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
