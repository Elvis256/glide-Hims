import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/currency';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';
import {
  Plus,
  Search,
  X,
  Loader2,
  CreditCard,
  Wallet,
  FileText,
  CheckCircle,
  XCircle,
  DollarSign,
  Receipt,
  Clock,
} from 'lucide-react';

type TabType = 'credit-notes' | 'deposits' | 'waivers';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  patientId: string;
  patientName: string;
  amount: number;
  reason: string;
  status: 'draft' | 'approved' | 'applied';
  invoiceId?: string;
  createdAt: string;
}

interface Deposit {
  id: string;
  patientId: string;
  patientName: string;
  amount: number;
  method: string;
  reference: string;
  status: 'available' | 'applied' | 'refunded';
  appliedToInvoiceId?: string;
  createdAt: string;
}

interface PatientBalance {
  patientId: string;
  patientName: string;
  totalDeposits: number;
  totalApplied: number;
  availableBalance: number;
}

interface Waiver {
  id: string;
  patientId: string;
  patientName: string;
  invoiceId: string;
  invoiceNumber: string;
  originalAmount: number;
  waivedAmount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
}

const tabConfig: Record<TabType, { label: string; icon: React.ElementType }> = {
  'credit-notes': { label: 'Credit Notes', icon: FileText },
  deposits: { label: 'Deposits', icon: Wallet },
  waivers: { label: 'Waivers', icon: Receipt },
};

export default function PatientFinancePage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [activeTab, setActiveTab] = useState<TabType>('credit-notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [balancePatientId, setBalancePatientId] = useState('');

  // Credit Notes
  const { data: creditNotes = [], isLoading: loadingCN } = useQuery<CreditNote[]>({
    queryKey: ['credit-notes', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/patient/credit-notes', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId && activeTab === 'credit-notes',
  });

  // Deposits
  const { data: deposits = [], isLoading: loadingDep } = useQuery<Deposit[]>({
    queryKey: ['patient-deposits', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/patient/deposits', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId && activeTab === 'deposits',
  });

  // Patient Balance
  const { data: patientBalance } = useQuery<PatientBalance>({
    queryKey: ['patient-balance', balancePatientId],
    queryFn: async () => {
      const response = await api.get(`/finance/patient/${balancePatientId}/balance`);
      return response.data?.data || response.data;
    },
    enabled: !!balancePatientId && activeTab === 'deposits',
  });

  // Waivers
  const { data: waivers = [], isLoading: loadingWaiv } = useQuery<Waiver[]>({
    queryKey: ['patient-waivers', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/patient/waivers', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId && activeTab === 'waivers',
  });

  // Create Credit Note
  const createCreditNoteMutation = useMutation({
    mutationFn: async (payload: { patientId: string; amount: number; reason: string; facilityId: string }) => {
      const response = await api.post('/finance/patient/credit-notes', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', facilityId] });
      toast.success('Credit note created');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create credit note'),
  });

  // Apply Credit Note to Invoice
  const applyCreditNoteMutation = useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const response = await api.patch(`/finance/patient/credit-notes/${id}`, { invoiceId, status: 'applied' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', facilityId] });
      toast.success('Credit note applied to invoice');
    },
    onError: () => toast.error('Failed to apply credit note'),
  });

  // Create Deposit
  const createDepositMutation = useMutation({
    mutationFn: async (payload: { patientId: string; amount: number; method: string; reference: string; facilityId: string }) => {
      const response = await api.post('/finance/patient/deposits', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-deposits', facilityId] });
      toast.success('Deposit recorded');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to record deposit'),
  });

  // Apply Deposit to Invoice
  const applyDepositMutation = useMutation({
    mutationFn: async ({ id, invoiceId }: { id: string; invoiceId: string }) => {
      const response = await api.patch(`/finance/patient/deposits/${id}`, { invoiceId, status: 'applied' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-deposits', facilityId] });
      toast.success('Deposit applied to invoice');
    },
    onError: () => toast.error('Failed to apply deposit'),
  });

  // Create Waiver
  const createWaiverMutation = useMutation({
    mutationFn: async (payload: { patientId: string; invoiceId: string; waivedAmount: number; reason: string; facilityId: string }) => {
      const response = await api.post('/finance/patient/waivers', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-waivers', facilityId] });
      toast.success('Waiver request submitted');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to submit waiver'),
  });

  // Approve/Reject Waiver
  const updateWaiverMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const response = await api.patch(`/finance/patient/waivers/${id}`, { status });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patient-waivers', facilityId] });
      toast.success(`Waiver ${variables.status}`);
    },
    onError: () => toast.error('Failed to update waiver'),
  });

  const isLoading = activeTab === 'credit-notes' ? loadingCN : activeTab === 'deposits' ? loadingDep : loadingWaiv;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Finance</h1>
            <p className="text-sm text-gray-500 mt-1">Credit notes, deposits, and waivers management</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'credit-notes' ? 'New Credit Note' : activeTab === 'deposits' ? 'Record Deposit' : 'Request Waiver'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 border-b -mb-[1px]">
          {(Object.keys(tabConfig) as TabType[]).map((tab) => {
            const config = tabConfig[tab];
            const Icon = config.icon;
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {activeTab === 'deposits' && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Patient ID for balance"
                value={balancePatientId}
                onChange={(e) => setBalancePatientId(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {patientBalance && (
                <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                  <span className="text-blue-700 font-medium">{patientBalance.patientName}</span>
                  <span className="text-gray-500">Balance:</span>
                  <span className="font-bold text-blue-700">{formatCurrency(patientBalance.availableBalance)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Credit Notes Tab */}
        {activeTab === 'credit-notes' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>CN Number</div>
              <div>Patient</div>
              <div className="text-right">Amount</div>
              <div>Reason</div>
              <div>Status</div>
              <div>Date</div>
              <div className="text-right">Actions</div>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading credit notes...</p>
              </div>
            ) : creditNotes.filter((cn) => !searchQuery || cn.patientName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
              creditNotes
                .filter((cn) => !searchQuery || cn.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((cn) => (
                  <div key={cn.id} className="grid grid-cols-7 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                    <div className="font-mono text-gray-700">{cn.creditNoteNumber}</div>
                    <div className="font-medium text-gray-900">{cn.patientName}</div>
                    <div className="text-right font-medium text-green-600">{formatCurrency(cn.amount)}</div>
                    <div className="text-gray-600 truncate">{cn.reason}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        cn.status === 'applied' ? 'bg-green-100 text-green-700' :
                        cn.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{cn.status}</span>
                    </div>
                    <div className="text-gray-500 text-xs">{new Date(cn.createdAt).toLocaleDateString()}</div>
                    <div className="flex items-center justify-end">
                      {cn.status === 'approved' && (
                        <button
                          onClick={() => {
                            const invoiceId = window.prompt('Enter Invoice ID to apply credit note:');
                            if (invoiceId) applyCreditNoteMutation.mutate({ id: cn.id, invoiceId });
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Apply to Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No credit notes found</p>
              </div>
            )}
          </div>
        )}

        {/* Deposits Tab */}
        {activeTab === 'deposits' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Patient</div>
              <div className="text-right">Amount</div>
              <div>Method</div>
              <div>Reference</div>
              <div>Status</div>
              <div>Date</div>
              <div className="text-right">Actions</div>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading deposits...</p>
              </div>
            ) : deposits.filter((d) => !searchQuery || d.patientName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
              deposits
                .filter((d) => !searchQuery || d.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((dep) => (
                  <div key={dep.id} className="grid grid-cols-7 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                    <div className="font-medium text-gray-900">{dep.patientName}</div>
                    <div className="text-right font-medium text-green-600">{formatCurrency(dep.amount)}</div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <CreditCard className="w-3 h-3" />
                      {dep.method}
                    </div>
                    <div className="text-gray-500 text-xs font-mono">{dep.reference}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        dep.status === 'available' ? 'bg-green-100 text-green-700' :
                        dep.status === 'applied' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{dep.status}</span>
                    </div>
                    <div className="text-gray-500 text-xs">{new Date(dep.createdAt).toLocaleDateString()}</div>
                    <div className="flex items-center justify-end">
                      {dep.status === 'available' && (
                        <button
                          onClick={() => {
                            const invoiceId = window.prompt('Enter Invoice ID to apply deposit:');
                            if (invoiceId) applyDepositMutation.mutate({ id: dep.id, invoiceId });
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Apply to Invoice
                        </button>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No deposits found</p>
              </div>
            )}
          </div>
        )}

        {/* Waivers Tab */}
        {activeTab === 'waivers' && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-8 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Patient</div>
              <div>Invoice</div>
              <div className="text-right">Original</div>
              <div className="text-right">Waived</div>
              <div>Reason</div>
              <div>Status</div>
              <div>Requested By</div>
              <div className="text-right">Actions</div>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading waivers...</p>
              </div>
            ) : waivers.filter((w) => !searchQuery || w.patientName.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
              waivers
                .filter((w) => !searchQuery || w.patientName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((waiver) => (
                  <div key={waiver.id} className="grid grid-cols-8 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                    <div className="font-medium text-gray-900">{waiver.patientName}</div>
                    <div className="text-gray-600 text-xs font-mono">{waiver.invoiceNumber}</div>
                    <div className="text-right text-gray-700">{formatCurrency(waiver.originalAmount)}</div>
                    <div className="text-right font-medium text-red-600">{formatCurrency(waiver.waivedAmount)}</div>
                    <div className="text-gray-600 truncate">{waiver.reason}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        waiver.status === 'approved' ? 'bg-green-100 text-green-700' :
                        waiver.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{waiver.status}</span>
                    </div>
                    <div className="text-gray-500 text-xs">{waiver.requestedBy}</div>
                    <div className="flex items-center justify-end gap-1">
                      {waiver.status === 'pending' && (
                        <>
                          <button
                            onClick={() => updateWaiverMutation.mutate({ id: waiver.id, status: 'approved' })}
                            disabled={updateWaiverMutation.isPending}
                            className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateWaiverMutation.mutate({ id: waiver.id, status: 'rejected' })}
                            disabled={updateWaiverMutation.isPending}
                            className="p-1.5 hover:bg-red-100 rounded text-red-500" title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No waivers found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {activeTab === 'credit-notes' ? 'New Credit Note' : activeTab === 'deposits' ? 'Record Deposit' : 'Request Waiver'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Credit Note Form */}
            {activeTab === 'credit-notes' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createCreditNoteMutation.mutate({
                    patientId: fd.get('patientId') as string,
                    amount: Number(fd.get('amount')),
                    reason: fd.get('reason') as string,
                    facilityId,
                  });
                }}
              >
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                    <input type="text" name="patientId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter patient ID" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <textarea name="reason" required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Reason for credit note" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={createCreditNoteMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {createCreditNoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Deposit Form */}
            {activeTab === 'deposits' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createDepositMutation.mutate({
                    patientId: fd.get('patientId') as string,
                    amount: Number(fd.get('amount')),
                    method: fd.get('method') as string,
                    reference: fd.get('reference') as string,
                    facilityId,
                  });
                }}
              >
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                    <input type="text" name="patientId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter patient ID" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                      <select name="method" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="mobile_money">Mobile Money</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                    <input type="text" name="reference" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Payment reference" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={createDepositMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {createDepositMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Record
                  </button>
                </div>
              </form>
            )}

            {/* Waiver Form */}
            {activeTab === 'waivers' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  createWaiverMutation.mutate({
                    patientId: fd.get('patientId') as string,
                    invoiceId: fd.get('invoiceId') as string,
                    waivedAmount: Number(fd.get('waivedAmount')),
                    reason: fd.get('reason') as string,
                    facilityId,
                  });
                }}
              >
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Patient ID</label>
                      <input type="text" name="patientId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Patient ID" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID</label>
                      <input type="text" name="invoiceId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Invoice ID" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Waive</label>
                    <input type="number" name="waivedAmount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <textarea name="reason" required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Reason for waiver request" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={createWaiverMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {createWaiverMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
