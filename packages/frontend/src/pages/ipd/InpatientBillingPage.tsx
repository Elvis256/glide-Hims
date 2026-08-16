import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import api, { getApiErrorMessage } from '../../services/api';
import { confirmDialog } from '../../components/ConfirmDialog';
import { printElement } from '../../lib/print';

interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  admissionDate: string;
  admissionDiagnosis?: string;
  encounterId?: string;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  ward?: {
    id: string;
    name: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
  };
  attendingDoctor?: {
    fullName: string;
  };
  dischargeDate?: string;
  metadata?: {
    inpatientInvoiceId?: string;
    inpatientBilling?: { status: string; at?: string; error?: string };
  };
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  category?: string;
  serviceCode?: string;
  chargeType?: string;
  referenceType?: string;
  referenceId?: string;
}

/** A bed-day charge line as computed by GET /ipd/admissions/:id/bed-charges-preview. */
interface BedChargeLine {
  serviceCode: string;
  description: string;
  chargeType: string;
  quantity: number;
  unitPrice: number;
  referenceType: string;
  referenceId: string;
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<number>(0);
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
      toast.success('Payment recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record payment')),
  });

  // Add charge mutation. When the admission has no open invoice yet, CREATE one
  // with this charge as its first line — previously the button silently did
  // nothing on a fresh admission (it required an invoice that never existed).
  const addChargeMutation = useMutation({
    mutationFn: async (data: {
      invoiceId?: string;
      patientId: string;
      encounterId?: string;
      description: string;
      quantity: number;
      unitPrice: number;
      category?: string;
    }) => {
      if (data.invoiceId) {
        const res = await api.post(`/billing/invoices/${data.invoiceId}/items`, {
          description: data.description,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          chargeType: data.category || undefined,
          serviceCode: 'IPD-CHARGE',
        });
        return res.data;
      }
      const res = await api.post('/billing/invoices', {
        patientId: data.patientId,
        encounterId: data.encounterId,
        items: [{
          serviceCode: 'IPD-CHARGE',
          description: data.description,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
        }],
        notes: 'Inpatient charges',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      setShowAddCharge(false);
      setChargeForm({ category: '', description: '', quantity: 1, unitPrice: 0 });
      toast.success('Charge added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to add charge')),
  });

  /**
   * Post the computed bed-day charges onto the patient's bill.
   *
   * The backend has always been able to work these out — it walks the
   * admission's transfers and prices each segment at that bed's own daily rate
   * — but nothing in the UI ever called it, so bed nights had to be typed in by
   * hand and were easy to under-bill or miss entirely.
   *
   * invoice_items has a UNIQUE index on (reference_type, reference_id), so the
   * segments cannot all be posted under the bare admission id; each line gets a
   * per-segment suffix, which keeps the rows traceable to the admission while
   * satisfying the constraint.
   */
  const addBedChargesMutation = useMutation({
    mutationFn: async (admission: Admission) => {
      const preview = await api.get(`/ipd/admissions/${admission.id}/bed-charges-preview`);
      const lines = (preview.data?.data || preview.data || []) as BedChargeLine[];
      if (!lines.length) return { posted: 0 };

      const withRefs = lines.map((line, i) => ({
        serviceCode: line.serviceCode,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        chargeType: line.chargeType,
        referenceType: line.referenceType,
        referenceId: `${line.referenceId}#${i + 1}`,
      }));

      if (currentInvoice) {
        for (const item of withRefs) {
          await api.post(`/billing/invoices/${currentInvoice.id}/items`, item);
        }
      } else {
        await api.post('/billing/invoices', {
          patientId: admission.patient.id,
          encounterId: admission.encounterId,
          items: withRefs,
          notes: `Bed charges — admission ${admission.admissionNumber}`,
        });
      }
      return { posted: withRefs.length };
    },
    onSuccess: ({ posted }) => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      toast.success(
        posted ? `Added ${posted} bed charge${posted > 1 ? 's' : ''}` : 'No billable bed nights yet',
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to add bed charges')),
  });

  // Update item price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; itemId: string; unitPrice: number }) => {
      const res = await api.patch(`/billing/invoices/${data.invoiceId}/items/${data.itemId}`, { unitPrice: data.unitPrice });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      setEditingItemId(null);
      toast.success('Price updated');
    },
    onError: () => toast.error('Failed to update price'),
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; itemId: string }) => {
      const res = await api.delete(`/billing/invoices/${data.invoiceId}/items/${data.itemId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      toast.success('Item removed');
    },
    onError: () => toast.error('Failed to remove item'),
  });

  // Fetch active admissions
  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['billing-admissions'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'admitted' } });
      return (res.data?.data || res.data) as Admission[];
    },
  });

  /**
   * Discharged stays whose bed-day invoice never got raised.
   *
   * The list above is scoped to status 'admitted', so a discharge whose
   * auto-billing failed disappears from this page entirely — the patient is
   * gone and nothing on screen says the stay was never billed. This is the
   * queue that surfaces them.
   */
  const { data: unbilledDischarges = [] } = useQuery({
    queryKey: ['unbilled-discharges'],
    queryFn: async () => {
      const res = await api.get('/ipd/unbilled-discharges');
      return (res.data?.data || res.data || []) as Admission[];
    },
  });

  const raiseInvoiceMutation = useMutation({
    mutationFn: async (admissionId: string) => {
      // Idempotent server-side: an admission already carrying a live invoice
      // returns it rather than billing the stay a second time.
      const res = await api.post(`/ipd/admissions/${admissionId}/generate-invoice`);
      return (res.data?.data || res.data) as { invoiceId: string | null };
    },
    onSuccess: ({ invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['unbilled-discharges'] });
      queryClient.invalidateQueries({ queryKey: ['patient-invoices'] });
      toast.success(invoiceId ? 'Invoice raised' : 'Stay had nothing chargeable');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not raise the invoice')),
  });

  // Fetch invoices for selected patient. The endpoint returns {data, total} —
  // treating it as a bare array crashed every useMemo below. Scoped to this
  // ADMISSION (invoices raised since admission) so totals don't drag in the
  // patient's old OPD bills.
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['patient-invoices', selectedAdmission?.patient.id, selectedAdmission?.id],
    queryFn: async () => {
      if (!selectedAdmission) return [];
      const res = await api.get('/billing/invoices', { params: { patientId: selectedAdmission.patient.id } });
      const raw = res.data;
      const all = (Array.isArray(raw) ? raw : raw?.data || []) as Invoice[];
      const since = new Date(selectedAdmission.admissionDate).getTime();
      return all.filter((inv) => new Date(inv.createdAt).getTime() >= since);
    },
    enabled: !!selectedAdmission,
  });

  // Get latest/current invoice
  const currentInvoice = useMemo(() => {
    return invoices.find(inv => inv.status !== 'paid') || invoices[0];
  }, [invoices]);

  /** Bed charges already on this bill — used to warn before posting twice. */
  const existingBedCharges = useMemo(
    () =>
      (currentInvoice?.items || []).filter(
        (i) => i.chargeType === 'bed' || (i.serviceCode || '').startsWith('BED-'),
      ),
    [currentInvoice],
  );

  const handleAddBedCharges = async () => {
    if (!selectedAdmission) return;
    if (existingBedCharges.length) {
      const ok = await confirmDialog({
        title: 'Bed charges already on this bill',
        message: `This bill already has ${existingBedCharges.length} bed charge line(s). Adding them again will bill the stay twice. Continue?`,
        confirmLabel: 'Add anyway',
        variant: 'danger',
      });
      if (!ok) return;
    }
    addBedChargesMutation.mutate(selectedAdmission);
  };

  // Calculate totals from invoices
  const totalCharges = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
  }, [invoices]);

  const totalPaid = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
  }, [invoices]);

  const balance = totalCharges - totalPaid;

  const hasZeroPriceItems = useMemo(() => {
    if (!currentInvoice?.items) return false;
    return currentInvoice.items.some((item) => !item.unitPrice || Number(item.unitPrice) <= 0);
  }, [currentInvoice]);

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(
      (a) =>
        `${a.patient.fullName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      {/* Discharged stays that were never billed. Hidden entirely when the
          queue is empty so it reads as an exception, not a standing panel. */}
      {unbilledDischarges.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-amber-900">
              {unbilledDischarges.length} discharged{' '}
              {unbilledDischarges.length === 1 ? 'stay has' : 'stays have'} no bed-day invoice
            </h2>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {unbilledDischarges.map((adm) => {
              const failure = adm.metadata?.inpatientBilling;
              return (
                <div
                  key={adm.id}
                  className="flex items-center justify-between gap-4 bg-white border border-amber-200 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {adm.patient?.fullName || 'Unknown patient'}
                      <span className="ml-2 text-sm text-gray-500">{adm.admissionNumber}</span>
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      Discharged{' '}
                      {adm.dischargeDate ? new Date(adm.dischargeDate).toLocaleDateString() : '—'}
                      {failure?.status === 'failed' && (
                        <span className="text-red-600"> · billing failed: {failure.error}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => raiseInvoiceMutation.mutate(adm.id)}
                    disabled={raiseInvoiceMutation.isPending}
                    className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    Raise invoice
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        <p className="font-semibold text-gray-900">{admission.patient.fullName}</p>
                        <p className="text-sm text-gray-500">{admission.bed?.bedNumber || 'No bed'} • {admission.ward?.name || 'No ward'}</p>
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
                    <p className="font-semibold text-gray-900">{selectedAdmission.patient.fullName}</p>
                    <p className="text-sm text-gray-500">{getAge(selectedAdmission.patient.dateOfBirth)}y, {selectedAdmission.patient.gender || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Ward/Bed</p>
                    <p className="font-medium">{selectedAdmission.ward?.name || 'N/A'} - {selectedAdmission.bed?.bedNumber || 'N/A'}</p>
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
                        ? `Dr. ${selectedAdmission.attendingDoctor.fullName}`
                        : 'Not assigned'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-500">Diagnosis:</span>
                    <span className="font-medium">{selectedAdmission.admissionDiagnosis || 'TBD'}</span>
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
                    onClick={handleAddBedCharges}
                    disabled={addBedChargesMutation.isPending}
                    title="Bill the bed nights for this admission, priced per bed and split across any transfers"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {addBedChargesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    ) : (
                      <Bed className="w-4 h-4 inline mr-2" />
                    )}
                    Add Bed Charges
                  </button>
                  <button
                    onClick={() => setShowAddCharge(!showAddCharge)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Charge
                  </button>
                  <button
                    onClick={() => printElement('ipd-charges-print', `Interim Bill — ${selectedAdmission.patient.fullName}`)}
                    disabled={!currentInvoice || currentInvoice.items.length === 0}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print Interim Bill
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
                      <option value="bed">Room / Bed Charges</option>
                      <option value="nursing">Nursing Care</option>
                      <option value="procedure">Procedures</option>
                      <option value="pharmacy">Pharmacy</option>
                      <option value="lab">Laboratory</option>
                      <option value="radiology">Radiology</option>
                      <option value="consultation">Consultation</option>
                      <option value="other">Consumables / Other</option>
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
                          if (!selectedAdmission || !chargeForm.description || chargeForm.unitPrice <= 0) return;
                          addChargeMutation.mutate({
                            invoiceId: currentInvoice?.status !== 'paid' ? currentInvoice?.id : undefined,
                            patientId: selectedAdmission.patient.id,
                            encounterId: selectedAdmission.encounterId,
                            description: chargeForm.description,
                            quantity: chargeForm.quantity,
                            unitPrice: chargeForm.unitPrice,
                            category: chargeForm.category,
                          });
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
              <div className="flex-1 overflow-auto" id="ipd-charges-print">
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
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-600 w-20">Actions</th>
                      </tr>
                    </thead>
                    {hasZeroPriceItems && (
                      <caption className="caption-top p-2 bg-amber-50 border border-amber-200 rounded-t-lg">
                        <div className="flex items-center gap-2 text-amber-700 text-xs">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>Some items have no price. Set prices or remove them before collecting payment.</span>
                        </div>
                      </caption>
                    )}
                    <tbody>
                      {currentInvoice.items.map((item) => {
                        const isZeroPrice = !item.unitPrice || Number(item.unitPrice) <= 0;
                        const isEditing = editingItemId === item.id;
                        return (
                        <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isZeroPrice ? 'bg-red-50' : ''}`}>
                          <td className="py-3 px-4">
                            <p className={`font-medium ${isZeroPrice ? 'text-red-700' : 'text-gray-900'}`}>{item.description}</p>
                            {item.category && (
                              <p className="text-xs text-gray-500">{item.category}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">{item.quantity}</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={editingPrice}
                                  onChange={(e) => setEditingPrice(parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 border rounded text-right text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingPrice > 0 && currentInvoice) {
                                      updatePriceMutation.mutate({ invoiceId: currentInvoice.id, itemId: item.id, unitPrice: editingPrice });
                                    } else if (e.key === 'Escape') {
                                      setEditingItemId(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => editingPrice > 0 && currentInvoice && updatePriceMutation.mutate({ invoiceId: currentInvoice.id, itemId: item.id, unitPrice: editingPrice })}
                                  disabled={editingPrice <= 0 || updatePriceMutation.isPending}
                                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                                >✓</button>
                                <button onClick={() => setEditingItemId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">✕</button>
                              </div>
                            ) : (
                              <span className={isZeroPrice ? 'text-red-600 font-medium' : ''}>
                                {isZeroPrice ? 'No price' : formatCurrencyValue(item.unitPrice)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">{formatCurrencyValue(item.amount)}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!isEditing && (
                                <button
                                  onClick={() => { setEditingItemId(item.id); setEditingPrice(Number(item.unitPrice) || 0); }}
                                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  title="Edit price"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={async () => {
                                  if (await confirmDialog(`Remove "${item.description}" from this invoice?`)) {
                                    currentInvoice && removeItemMutation.mutate({ invoiceId: currentInvoice.id, itemId: item.id });
                                  }
                                }}
                                disabled={removeItemMutation.isPending}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
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
                    <button
                      onClick={() => {
                        if (hasZeroPriceItems) {
                          toast.error('Cannot collect payment: some items have no price. Set prices or remove them first.');
                          return;
                        }
                        setShowPaymentModal(true);
                      }}
                      disabled={balance <= 0 || hasZeroPriceItems}
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
                        <p className="text-sm text-gray-500">Balance Due (this admission)</p>
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
