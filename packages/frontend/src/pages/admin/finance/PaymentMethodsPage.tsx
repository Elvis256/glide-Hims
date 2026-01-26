import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Save,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Building2,
  Shield,
  Settings,
  Check,
  Percent,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Wallet,
  Loader2,
} from 'lucide-react';
import { financeService } from '../../../services';

interface PaymentMethod {
  id: string;
  name: string;
  type: 'Cash' | 'Card' | 'Mobile Money' | 'Bank Transfer' | 'Insurance';
  icon: 'cash' | 'card' | 'mobile' | 'bank' | 'insurance';
  isActive: boolean;
  processingFee: number;
  feeType: 'percentage' | 'fixed';
  settlementAccount: string;
  settlementDays: number;
  settings: Record<string, string | boolean>;
}

const mockPaymentMethods: PaymentMethod[] = [
  {
    id: '1',
    name: 'Cash',
    type: 'Cash',
    icon: 'cash',
    isActive: true,
    processingFee: 0,
    feeType: 'percentage',
    settlementAccount: 'Main Cash Account',
    settlementDays: 0,
    settings: {
      requireReceipt: true,
      maxAmount: '5000000',
      requireApprovalAbove: '1000000',
    },
  },
  {
    id: '2',
    name: 'Visa/Mastercard',
    type: 'Card',
    icon: 'card',
    isActive: true,
    processingFee: 2.5,
    feeType: 'percentage',
    settlementAccount: 'Stanbic Bank - 9001234567',
    settlementDays: 2,
    settings: {
      provider: 'Stripe',
      acceptVisa: true,
      acceptMastercard: true,
      acceptAmex: false,
      require3DS: true,
    },
  },
  {
    id: '3',
    name: 'MTN Mobile Money',
    type: 'Mobile Money',
    icon: 'mobile',
    isActive: true,
    processingFee: 1.5,
    feeType: 'percentage',
    settlementAccount: 'MTN MoMo - 0771234567',
    settlementDays: 1,
    settings: {
      provider: 'MTN Uganda',
      shortCode: '*165#',
      apiIntegration: true,
      autoConfirm: true,
    },
  },
  {
    id: '4',
    name: 'Airtel Money',
    type: 'Mobile Money',
    icon: 'mobile',
    isActive: true,
    processingFee: 1.5,
    feeType: 'percentage',
    settlementAccount: 'Airtel Money - 0701234567',
    settlementDays: 1,
    settings: {
      provider: 'Airtel Uganda',
      shortCode: '*185#',
      apiIntegration: true,
      autoConfirm: true,
    },
  },
  {
    id: '5',
    name: 'Bank Transfer',
    type: 'Bank Transfer',
    icon: 'bank',
    isActive: true,
    processingFee: 0,
    feeType: 'fixed',
    settlementAccount: 'Stanbic Bank - 9001234567',
    settlementDays: 3,
    settings: {
      bankName: 'Stanbic Bank Uganda',
      accountNumber: '9001234567',
      branchCode: 'KLA001',
      swiftCode: 'SBICUGKX',
      requireProof: true,
    },
  },
  {
    id: '6',
    name: 'NHIF Insurance',
    type: 'Insurance',
    icon: 'insurance',
    isActive: true,
    processingFee: 0,
    feeType: 'percentage',
    settlementAccount: 'NHIF Claims Account',
    settlementDays: 30,
    settings: {
      provider: 'National Health Insurance Fund',
      contractNumber: 'NHIF-2024-001',
      preAuthRequired: true,
      claimSubmissionDays: '5',
    },
  },
  {
    id: '7',
    name: 'Jubilee Insurance',
    type: 'Insurance',
    icon: 'insurance',
    isActive: true,
    processingFee: 0,
    feeType: 'percentage',
    settlementAccount: 'Jubilee Claims Account',
    settlementDays: 45,
    settings: {
      provider: 'Jubilee Insurance Uganda',
      contractNumber: 'JUB-2024-0234',
      preAuthRequired: true,
      claimSubmissionDays: '7',
    },
  },
  {
    id: '8',
    name: 'AAR Insurance',
    type: 'Insurance',
    icon: 'insurance',
    isActive: false,
    processingFee: 0,
    feeType: 'percentage',
    settlementAccount: 'AAR Claims Account',
    settlementDays: 60,
    settings: {
      provider: 'AAR Insurance',
      contractNumber: 'AAR-2023-0567',
      preAuthRequired: true,
      claimSubmissionDays: '10',
    },
  },
];

const iconMap = {
  cash: Banknote,
  card: CreditCard,
  mobile: Smartphone,
  bank: Building2,
  insurance: Shield,
};

const typeColors = {
  Cash: 'bg-green-100 text-green-700',
  Card: 'bg-blue-100 text-blue-700',
  'Mobile Money': 'bg-yellow-100 text-yellow-700',
  'Bank Transfer': 'bg-purple-100 text-purple-700',
  Insurance: 'bg-red-100 text-red-700',
};

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch payment methods from API
  const { data: apiMethods, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => financeService.paymentMethods.list(),
    staleTime: 60000,
  });

  // Transform API data to local format with fallback
  const paymentMethods: PaymentMethod[] = useMemo(() => {
    if (!apiMethods) return [];
    // API returns simpler data, so we use mock for now with status from API
    return mockPaymentMethods.map(method => {
      const apiMethod = apiMethods.find((m: { code: string }) => m.code === method.name.toLowerCase().replace(/\s+/g, '_'));
      if (apiMethod) {
        return { ...method, isActive: apiMethod.isActive };
      }
      return method;
    });
  }, [apiMethods]);

  // Toggle method status mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => financeService.paymentMethods.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
    },
  });

  const types = useMemo(() => {
    const uniqueTypes = [...new Set(paymentMethods.map(p => p.type))];
    return ['all', ...uniqueTypes];
  }, [paymentMethods]);

  const filteredMethods = useMemo(() => {
    return paymentMethods.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.type.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [paymentMethods, searchTerm, filterType]);

  const toggleMethodStatus = (id: string) => {
    toggleMutation.mutate(id);
  };

  const stats = useMemo(() => ({
    total: paymentMethods.length,
    active: paymentMethods.filter(p => p.isActive).length,
    byType: {
      cash: paymentMethods.filter(p => p.type === 'Cash').length,
      card: paymentMethods.filter(p => p.type === 'Card').length,
      mobile: paymentMethods.filter(p => p.type === 'Mobile Money').length,
      bank: paymentMethods.filter(p => p.type === 'Bank Transfer').length,
      insurance: paymentMethods.filter(p => p.type === 'Insurance').length,
    },
  }), [paymentMethods]);

  const renderSettingsFields = (method: PaymentMethod) => {
    return Object.entries(method.settings).map(([key, value]) => (
      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
        <span className="text-sm text-gray-600 capitalize">
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </span>
        <span className="text-sm font-medium text-gray-900">
          {typeof value === 'boolean' ? (
            value ? (
              <span className="text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Yes
              </span>
            ) : (
              <span className="text-gray-400">No</span>
            )
          ) : (
            value
          )}
        </span>
      </div>
    ));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
            <p className="text-sm text-gray-500">Configure payment methods and processing settings</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Payment Method
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Methods</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active</div>
              <div className="text-xl font-bold text-green-600">{stats.active}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Smartphone className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Mobile Money</div>
              <div className="text-xl font-bold text-yellow-600">{stats.byType.mobile}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Insurance</div>
              <div className="text-xl font-bold text-red-600">{stats.byType.insurance}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Card</div>
              <div className="text-xl font-bold text-blue-600">{stats.byType.card}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search payment methods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Type:</span>
            {types.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  filterType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-3">
          {filteredMethods.map(method => {
            const Icon = iconMap[method.icon];
            const isExpanded = expandedId === method.id;
            
            return (
              <div
                key={method.id}
                className={`bg-white rounded-lg border ${!method.isActive ? 'opacity-60' : ''}`}
              >
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${
                        method.type === 'Cash' ? 'bg-green-100' :
                        method.type === 'Card' ? 'bg-blue-100' :
                        method.type === 'Mobile Money' ? 'bg-yellow-100' :
                        method.type === 'Bank Transfer' ? 'bg-purple-100' :
                        'bg-red-100'
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          method.type === 'Cash' ? 'text-green-600' :
                          method.type === 'Card' ? 'text-blue-600' :
                          method.type === 'Mobile Money' ? 'text-yellow-600' :
                          method.type === 'Bank Transfer' ? 'text-purple-600' :
                          'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{method.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[method.type]}`}>
                            {method.type}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          Settlement: {method.settlementAccount}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Processing Fee */}
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Processing Fee</div>
                        <div className="flex items-center gap-1 font-medium text-gray-900">
                          <Percent className="w-3 h-3 text-gray-400" />
                          {method.processingFee}
                          {method.feeType === 'percentage' ? '%' : ' UGX'}
                        </div>
                      </div>

                      {/* Settlement Days */}
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Settlement</div>
                        <div className="font-medium text-gray-900">
                          {method.settlementDays === 0 ? 'Instant' : `${method.settlementDays} days`}
                        </div>
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        method.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {method.isActive ? 'Active' : 'Inactive'}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingId(method.id)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleMethodStatus(method.id)}
                          className={`p-1.5 rounded ${
                            method.isActive
                              ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {method.isActive ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : method.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Settings */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Settings className="w-4 h-4 text-gray-500" />
                          Method Settings
                        </h4>
                        <div className="bg-white rounded-lg border p-3">
                          {renderSettingsFields(method)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          Settlement Details
                        </h4>
                        <div className="bg-white rounded-lg border p-3 space-y-2">
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-gray-600">Account</span>
                            <span className="text-sm font-medium text-gray-900">{method.settlementAccount}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b">
                            <span className="text-sm text-gray-600">Settlement Period</span>
                            <span className="text-sm font-medium text-gray-900">
                              {method.settlementDays === 0 ? 'Instant' : `T+${method.settlementDays}`}
                            </span>
                          </div>
                          <div className="flex justify-between py-2">
                            <span className="text-sm text-gray-600">Processing Fee</span>
                            <span className="text-sm font-medium text-gray-900">
                              {method.processingFee}{method.feeType === 'percentage' ? '%' : ' UGX fixed'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add Payment Method</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Method Name</label>
                <input
                  type="text"
                  placeholder="e.g., Visa/Mastercard"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type...</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Processing Fee</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (UGX)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Account</label>
                <input
                  type="text"
                  placeholder="e.g., Stanbic Bank - 9001234567"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Days</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Add Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Edit Payment Method</h3>
              <button
                onClick={() => setEditingId(null)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {(() => {
                const method = paymentMethods.find(p => p.id === editingId);
                if (!method) return null;
                
                return (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Method Name</label>
                      <input
                        type="text"
                        defaultValue={method.name}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Processing Fee</label>
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={method.processingFee}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type</label>
                        <select 
                          defaultValue={method.feeType}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed (UGX)</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Account</label>
                      <input
                        type="text"
                        defaultValue={method.settlementAccount}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Settlement Days</label>
                      <input
                        type="number"
                        defaultValue={method.settlementDays}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}