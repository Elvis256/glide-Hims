import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Plus,
  Bed,
  Pill,
  Stethoscope,
  Activity,
  User,
  Calendar,
  DollarSign,
  FileText,
  Download,
  Printer,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import api from '../../services/api';

interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  admissionDate: string;
  primaryDiagnosis?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
    ward?: {
      id: string;
      name: string;
    };
  };
  attendingDoctor?: {
    firstName: string;
    lastName: string;
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  items: InvoiceItem[];
}

export default function InpatientBillingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [chargeForm, setChargeForm] = useState({
    category: '',
    description: '',
    quantity: 1,
    unitPrice: 0,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: 'cash',
    transactionReference: '',
  });
  const queryClient = useQueryClient();

  // Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: number; method: string; transactionReference?: string }) => {
      const res = await api.post('/billing/payments', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      setShowPaymentModal(false);
      setPaymentForm({ amount: 0, method: 'cash', transactionReference: '' });
    },
  });

  // Add charge mutation
  const addChargeMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; description: string; quantity: number; unitPrice: number; category?: string }) => {
      const res = await api.post(`/billing/invoices/${data.invoiceId}/items`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      setShowAddCharge(false);
      setChargeForm({ category: '', description: '', quantity: 1, unitPrice: 0 });
    },
  });

  // Fetch active admissions
  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['billing-admissions'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'active' } });
      return res.data as Admission[];
    },
  });

  // Fetch invoices for selected patient
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['patient-invoices', selectedAdmission?.patient.id],
    queryFn: async () => {
      if (!selectedAdmission) return [];
      const res = await api.get('/billing/invoices', { params: { patientId: selectedAdmission.patient.id } });
      return res.data.data as Invoice[];
    },
    enabled: !!selectedAdmission,
  });

  // Get latest/current invoice
  const currentInvoice = useMemo(() => {
    return invoices.find(inv => inv.status !== 'paid') || invoices[0];
  }, [invoices]);

  // Calculate totals from invoices
  const totalCharges = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  }, [invoices]);

  const totalPaid = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
  }, [invoices]);

  const balance = totalCharges - totalPaid;

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(
      (a) =>
        `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, admissions]);

  const getAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const getDaysSinceAdmission = (admissionDate: string) => {
    const admission = new Date(admissionDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - admission.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatCurrencyValue = (amount: number) => {
    return formatCurrency(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      partially_paid: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inpatient Billing</h1>
            <p className="text-sm text-gray-500">Manage patient charges and billing</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-blue-700 font-medium">{admissions.length} Active Inpatients</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {filteredAdmissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium">No patients found</p>
                <p className="text-sm">Inpatient billing records will appear here</p>
              </div>
            ) : (
            <div className="space-y-3">
              {filteredAdmissions.map((admission) => {
                const days = getDaysSinceAdmission(admission.admissionDate);
                return (
                  <div
                    key={admission.id}
                    onClick={() => setSelectedAdmission(admission)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedAdmission?.id === admission.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{admission.patient.firstName} {admission.patient.lastName}</p>
                        <p className="text-sm text-gray-500">{admission.bed?.bedNumber || 'No bed'} • {admission.bed?.ward?.name || 'No ward'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Days Admitted:</span>
                      <span className="font-semibold text-gray-900">{days} days</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">#{admission.admissionNumber}</p>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>

        {/* Billing Details */}
        {selectedAdmission ? (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            {/* Patient Info & Summary */}
            <div className="grid grid-cols-3 gap-4">
              {/* Patient Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedAdmission.patient.firstName} {selectedAdmission.patient.lastName}</p>
                    <p className="text-sm text-gray-500">{getAge(selectedAdmission.patient.dateOfBirth)}y, {selectedAdmission.patient.gender || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Ward/Bed</p>
                    <p className="font-medium">{selectedAdmission.bed?.ward?.name || 'N/A'} - {selectedAdmission.bed?.bedNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Admitted</p>
                    <p className="font-medium">{new Date(selectedAdmission.admissionDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Billing Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Billing Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Days Admitted:</span>
                    <span className="font-medium">{getDaysSinceAdmission(selectedAdmission.admissionDate)} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Attending Doctor:</span>
                    <span className="font-medium">
                      {selectedAdmission.attendingDoctor 
                        ? `Dr. ${selectedAdmission.attendingDoctor.firstName} ${selectedAdmission.attendingDoctor.lastName}`
                        : 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-500">Diagnosis:</span>
                    <span className="font-medium">{selectedAdmission.primaryDiagnosis || 'TBD'}</span>
                  </div>
                </div>
              </div>

              {/* Insurance Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Insurance
                </h3>
                <div className="text-center text-gray-500 py-2">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Insurance integration pending</p>
                  <p className="text-xs text-gray-400">Configure in billing settings</p>
                </div>
              </div>
            </div>

            {/* Charges */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Itemized Charges</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddCharge(!showAddCharge)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Charge
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Interim Bill
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print
                  </button>
                </div>
              </div>

              {/* Add Charge Form */}
              {showAddCharge && (
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-5 gap-4">
                    <select 
                      value={chargeForm.category}
                      onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select Category</option>
                      <option value="Room">Room Charges</option>
                      <option value="Nursing">Nursing Care</option>
                      <option value="Procedures">Procedures</option>
                      <option value="Pharmacy">Pharmacy</option>
                      <option value="Laboratory">Laboratory</option>
                      <option value="Radiology">Radiology</option>
                      <option value="Consumables">Consumables</option>
                    </select>
                    <input
                      type="text"
                      value={chargeForm.description}
                      onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                      placeholder="Description"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      value={chargeForm.quantity}
                      onChange={(e) => setChargeForm({ ...chargeForm, quantity: parseInt(e.target.value) || 1 })}
                      placeholder="Quantity"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      value={chargeForm.unitPrice || ''}
                      onChange={(e) => setChargeForm({ ...chargeForm, unitPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="Unit Price"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (invoices[0]?.id && chargeForm.description && chargeForm.unitPrice > 0) {
                            addChargeMutation.mutate({
                              invoiceId: invoices[0].id,
                              description: chargeForm.description,
                              quantity: chargeForm.quantity,
                              unitPrice: chargeForm.unitPrice,
                              category: chargeForm.category,
                            });
                          }
                        }}
                        disabled={addChargeMutation.isPending || !chargeForm.description || chargeForm.unitPrice <= 0}
                        className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {addChargeMutation.isPending ? 'Adding...' : 'Add'}
                      </button>
                      <button
                        onClick={() => setShowAddCharge(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Charges List */}
              <div className="flex-1 overflow-auto">
                {invoicesLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                  </div>
                ) : currentInvoice && currentInvoice.items.length > 0 ? (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Description</th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Qty</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Unit Price</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentInvoice.items.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900">{item.description}</p>
                            {item.category && (
                              <p className="text-xs text-gray-500">{item.category}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">{item.quantity}</td>
                          <td className="py-3 px-4 text-right">{formatCurrencyValue(item.unitPrice)}</td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrencyValue(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-8">
                    <Receipt className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="font-medium">No charges yet</p>
                    <p className="text-sm">Add charges using the button above</p>
                  </div>
                )}
              </div>

              {/* Footer Total */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                      <Receipt className="w-4 h-4 inline mr-2" />
                      Generate Final Bill
                    </button>
                    <button 
                      onClick={() => setShowPaymentModal(true)}
                      disabled={balance <= 0}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Receive Payment
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-lg font-semibold text-gray-700">{formatCurrencyValue(totalCharges)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Paid</p>
                        <p className="text-lg font-semibold text-green-600">{formatCurrencyValue(totalPaid)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Balance Due</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrencyValue(balance)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <Receipt className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to view billing details</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedAdmission && currentInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Receive Payment</h2>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Invoice:</span>
                  <span className="font-medium">{currentInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Balance Due:</span>
                  <span className="font-bold text-lg">{formatCurrencyValue(balance)}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    value={paymentForm.amount || ''}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select 
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="mobile_money">Mobile Money</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference (Optional)</label>
                  <input
                    type="text"
                    value={paymentForm.transactionReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                    placeholder="Transaction reference"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (paymentForm.amount > 0) {
                      paymentMutation.mutate({
                        invoiceId: currentInvoice.id,
                        amount: paymentForm.amount,
                        method: paymentForm.method,
                        transactionReference: paymentForm.transactionReference || undefined,
                      });
                    }
                  }}
                  disabled={paymentMutation.isPending || paymentForm.amount <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {paymentMutation.isPending ? (
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                  )}
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
