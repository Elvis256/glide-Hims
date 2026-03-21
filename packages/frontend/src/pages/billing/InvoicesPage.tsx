import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/currency';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Send,
  Download,
  Printer,
  Mail,
  X,
  Eye,
  Calendar,
  User,
  Building2,
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  Loader2,
  CreditCard,
  Trash2,
  RotateCcw,
  Pill,
  FlaskConical,
} from 'lucide-react';
import { billingService, type Invoice as APIInvoice } from '../../services';
import api from '../../services/api';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { printService } from '../../lib/print';
import { usePrintFormat } from '../../lib/usePrintFormat';
import PrintFormatSelector from '../../components/PrintFormatSelector';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'pending' | 'partial' | 'refunded';
type CustomerType = 'patient' | 'insurance' | 'corporate';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerType: CustomerType;
  date: string;
  dueDate: string;
  amount: number;
  paidAmount?: number;
  balance?: number;
  status: InvoiceStatus;
  items: { description: string; quantity: number; unitPrice: number }[];
  encounterId?: string;
}

const statusConfig: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-700', icon: XCircle },
};

const customerTypeConfig: Record<CustomerType, { label: string; icon: React.ElementType }> = {
  patient: { label: 'Patient', icon: User },
  insurance: { label: 'Insurance', icon: Building2 },
  corporate: { label: 'Corporate', icon: Building2 },
};

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { invoiceId: urlInvoiceId } = useParams<{ invoiceId?: string }>();
  const inst = useInstitutionInfo();
  const { printFormat, setPrintFormat } = usePrintFormat();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<CustomerType | 'all'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewingInvoiceItems, setViewingInvoiceItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [returnDoctorInvoice, setReturnDoctorInvoice] = useState<Invoice | null>(null);
  const [returnDoctorReason, setReturnDoctorReason] = useState('');
  const [returnPharmacyInvoice, setReturnPharmacyInvoice] = useState<Invoice | null>(null);
  const [returnPharmacyReason, setReturnPharmacyReason] = useState('');
  const [returnLabInvoice, setReturnLabInvoice] = useState<Invoice | null>(null);
  const [returnLabReason, setReturnLabReason] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  // Cancel invoice mutation
  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => billingService.invoices.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCancellingInvoice(null);
      setCancelReason('');
      toast.success('Invoice cancelled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel invoice');
    },
  });

  // Return to doctor mutation
  const returnToDoctorMutation = useMutation({
    mutationFn: async ({ encounterId, reason }: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${encounterId}/return-to-doctor`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setReturnDoctorInvoice(null);
      setReturnDoctorReason('');
      toast.success('Patient returned to doctor');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to return patient to doctor');
    },
  });

  // Return to pharmacy mutation
  const returnToPharmacyMutation = useMutation({
    mutationFn: async ({ encounterId, reason }: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${encounterId}/return-to-pharmacy`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setReturnPharmacyInvoice(null);
      setReturnPharmacyReason('');
      toast.success('Patient returned to pharmacy');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to return patient to pharmacy');
    },
  });

  // Return to lab mutation
  const returnToLabMutation = useMutation({
    mutationFn: async ({ encounterId, reason }: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${encounterId}/return-to-lab`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setReturnLabInvoice(null);
      setReturnLabReason('');
      toast.success('Patient returned to lab');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to return patient to lab');
    },
  });

  // Collect payment mutation
  const paymentMutation = useMutation({
    mutationFn: ({ invoiceId, amount, method, reference }: { invoiceId: string; amount: number; method: string; reference?: string }) =>
      billingService.payments.record(invoiceId, { amount, paymentMethod: method, reference }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setPayingInvoice(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      setPaymentReference('');
      setViewingInvoice(null);
      toast.success('Payment recorded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record payment');
    },
  });

  // Map UI status to API status
  const getApiStatus = (status: InvoiceStatus | 'all'): string | undefined => {
    if (status === 'all') return undefined;
    const statusMap: Record<InvoiceStatus, string | undefined> = {
      draft: 'draft',
      sent: 'pending',
      paid: 'paid',
      overdue: 'pending', // Overdue is calculated client-side
      cancelled: 'cancelled',
      pending: 'pending',
      partial: 'partially_paid',
      refunded: 'refunded',
    };
    return statusMap[status];
  };

  // Fetch invoices from API
  const { data: apiInvoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => billingService.invoices.list({ status: getApiStatus(statusFilter) }),
    staleTime: 30000,
  });

  // Transform a raw API invoice into local Invoice shape
  const normalizeApiInvoice = (inv: APIInvoice): Invoice => {
    const rawDue = inv.dueDate || inv.createdAt;
    const dueDate = inv.dueDate
      ? inv.dueDate.split('T')[0]
      : (() => {
          const d = new Date(inv.createdAt);
          d.setDate(d.getDate() + 14);
          return d.toISOString().split('T')[0];
        })();
    const payType = inv.paymentType;
    const customerType: CustomerType = payType === 'insurance' ? 'insurance'
      : payType === 'corporate' ? 'corporate'
      : 'patient';
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.patient?.fullName || 'Unknown',
      customerType,
      date: inv.createdAt?.split('T')[0] || '',
      dueDate,
      amount: Number(inv.totalAmount) || 0,
      paidAmount: Number(inv.paidAmount ?? (inv as any).amountPaid) || 0,
      balance: Number(inv.balance ?? (inv as any).balanceDue) || 0,
      status: inv.status as InvoiceStatus,
      items: inv.items || [],
      encounterId: inv.encounterId,
    };
  };

  // Auto-open invoice from URL parameter (e.g. /billing/invoices/:id)
  useEffect(() => {
    if (!urlInvoiceId || viewingInvoice) return;
    // Try from already-loaded list first
    const apiData = Array.isArray(apiInvoices) ? apiInvoices : (apiInvoices as any)?.data || [];
    const found = apiData.find((inv: any) => inv.id === urlInvoiceId);
    if (found) {
      setViewingInvoice(normalizeApiInvoice(found));
    } else if (apiInvoices !== undefined) {
      // List loaded but invoice not in it — fetch directly
      billingService.invoices.getById(urlInvoiceId).then((inv) => {
        if (inv) setViewingInvoice(normalizeApiInvoice(inv as APIInvoice));
      }).catch(() => { /* invoice not found */ });
    }
  }, [urlInvoiceId, apiInvoices]);

  // Handle view invoice - fetch full details
  const handleViewInvoice = async (invoice: Invoice) => {
    setViewingInvoice(invoice);
    try {
      const fullInvoice = await billingService.invoices.getById(invoice.id);
      // Fetch items if available
      if ((fullInvoice as APIInvoice & { items?: { description: string; quantity: number; unitPrice: number }[] }).items) {
        setViewingInvoiceItems((fullInvoice as APIInvoice & { items: { description: string; quantity: number; unitPrice: number }[] }).items);
      }
    } catch {
      // Keep basic view
    }
  };

  // Handle print invoice — professional layout
  const handlePrintInvoice = (invoice: Invoice) => {
    const items = viewingInvoiceItems.length > 0 ? viewingInvoiceItems : invoice.items;
    const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitPrice)), 0);
    const total = Number(invoice.amount) || subtotal;
    const paidAmount = Number((invoice as any).paidAmount) || 0;
    const balance = Number((invoice as any).balance) || (total - paidAmount);
    const statusLabel = statusConfig[invoice.status]?.label || invoice.status;
    const isPaid = invoice.status === 'paid';

    const header = printService.buildHeader(inst, printService.getVariant(printFormat));
    const body = `
  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
    <div>
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#999; font-weight:600;">Bill To</div>
      <div style="font-size:16px; font-weight:700; margin-top:2px;">${invoice.customerName}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:28px; font-weight:700; letter-spacing:2px; color:#1a1a2e;">INVOICE</div>
      <div style="font-size:14px; color:#2563eb; font-weight:600; margin-top:4px;">${invoice.invoiceNumber}</div>
      <span style="display:inline-block; padding:4px 14px; border-radius:20px; font-size:12px; font-weight:600; margin-top:6px; background:${isPaid ? '#dcfce7' : invoice.status === 'cancelled' ? '#fee2e2' : '#fef3c7'}; color:${isPaid ? '#15803d' : invoice.status === 'cancelled' ? '#b91c1c' : '#a16207'};">${statusLabel}</span>
      <div style="margin-top:8px;">
        <div style="font-size:10px; text-transform:uppercase; color:#999;">Invoice Date</div>
        <div style="font-size:13px; font-weight:500;">${invoice.date}</div>
        <div style="font-size:10px; text-transform:uppercase; color:#999; margin-top:4px;">Due Date</div>
        <div style="font-size:13px; font-weight:500;">${invoice.dueDate}</div>
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>
      ${items.length > 0 ? items.map(i => {
        const qty = Number(i.quantity);
        const price = Number(i.unitPrice);
        return `<tr><td>${i.description}</td><td style="text-align:center">${qty}</td><td style="text-align:right">UGX ${price.toLocaleString()}</td><td style="text-align:right">UGX ${(qty * price).toLocaleString()}</td></tr>`;
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">No items</td></tr>'}
    </tbody>
  </table>
  <div style="display:flex; justify-content:flex-end;">
    <div style="width:280px;">
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;"><span>Subtotal</span><span>UGX ${subtotal.toLocaleString()}</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;"><span>Tax</span><span>UGX 0</span></div>
      <div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px;"><span>Discount</span><span>UGX 0</span></div>
      <div style="display:flex; justify-content:space-between; padding:10px 0 6px; font-size:16px; font-weight:700; border-top:2px solid #1a1a2e; margin-top:6px;"><span>Total</span><span>UGX ${total.toLocaleString()}</span></div>
      ${paidAmount > 0 ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:13px; color:#15803d; font-weight:600;"><span>Paid</span><span>UGX ${paidAmount.toLocaleString()}</span></div>` : ''}
      ${balance > 0 ? `<div style="display:flex; justify-content:space-between; padding:6px 0; font-size:15px; color:#b91c1c; font-weight:700;"><span>Balance Due</span><span>UGX ${balance.toLocaleString()}</span></div>` : ''}
    </div>
  </div>`;
    const footer = printService.buildFooter(inst, printService.getVariant(printFormat));
    printService.printBilling(header + body + footer, printFormat, { title: `Invoice ${invoice.invoiceNumber}` });
  };

  // Open inline payment modal
  const handleCollectPayment = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    const balance = Number(invoice.balance) || (Number(invoice.amount) - Number(invoice.paidAmount || 0));
    setPaymentAmount(String(balance > 0 ? balance : invoice.amount));
  };

  // Transform API invoices to UI format
  const invoices: Invoice[] = useMemo(() => {
    const apiData = apiInvoices?.data || [];
    return apiData.map((inv: APIInvoice) => normalizeApiInvoice(inv));
  }, [apiInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const matchesSearch =
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
      const matchesType = customerTypeFilter === 'all' || invoice.customerType === customerTypeFilter;
      const matchesDate = !dateFilter || invoice.date === dateFilter;
      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [searchQuery, statusFilter, customerTypeFilter, dateFilter, invoices]);

  const summaryStats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paid = invoices.filter((inv) => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
    const pending = invoices.filter((inv) => inv.status === 'sent' || inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
    const overdue = invoices.filter((inv) => inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);
    return { total, paid, pending, overdue };
  }, [invoices]);

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map((inv) => inv.id));
    }
  };



  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
            <p className="text-sm text-gray-500 mt-1">Manage and track all billing invoices</p>
          </div>
          <button onClick={() => navigate('/billing/opd/new')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Create Invoice
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <DollarSign className="w-4 h-4" />
              Total Invoiced
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summaryStats.total)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Paid
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(summaryStats.paid)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(summaryStats.pending)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Overdue
            </div>
            <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(summaryStats.overdue)}</p>
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
              placeholder="Search invoices..."
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

          {selectedInvoices.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500">{selectedInvoices.length} selected</span>
              <button className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100">
                <Send className="w-4 h-4" />
                Send Reminders
              </button>
              <button className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Customer Type</label>
              <select
                value={customerTypeFilter}
                onChange={(e) => setCustomerTypeFilter(e.target.value as CustomerType | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="patient">Patient</option>
                <option value="insurance">Insurance</option>
                <option value="corporate">Corporate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {(statusFilter !== 'all' || customerTypeFilter !== 'all' || dateFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setCustomerTypeFilter('all');
                  setDateFilter('');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invoice List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.map((invoice) => {
                const StatusIcon = statusConfig[invoice.status].icon;
                const TypeIcon = customerTypeConfig[invoice.customerType].icon;
                return (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.includes(invoice.id)}
                        onChange={() => toggleSelectInvoice(invoice.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => setViewingInvoice(invoice)}>
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{invoice.customerName}</p>
                          <p className="text-xs text-gray-500">{customerTypeConfig[invoice.customerType].label}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{invoice.date}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{invoice.dueDate}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(invoice.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[invoice.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[invoice.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewInvoice(invoice)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(invoice.status === 'pending' || invoice.status === 'partially_paid') && (
                          <button
                            onClick={() => handleCollectPayment(invoice)}
                            className="p-1.5 hover:bg-green-100 rounded-lg text-green-600 hover:text-green-700"
                            title="Collect Payment"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {invoice.encounterId && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <>
                            <button 
                              onClick={() => setReturnDoctorInvoice(invoice)}
                              className="p-1.5 hover:bg-orange-100 rounded-lg text-orange-500 hover:text-orange-600" 
                              title="Return to Doctor"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setReturnPharmacyInvoice(invoice)}
                              className="p-1.5 hover:bg-purple-100 rounded-lg text-purple-500 hover:text-purple-600" 
                              title="Return to Pharmacy"
                            >
                              <Pill className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setReturnLabInvoice(invoice)}
                              className="p-1.5 hover:bg-cyan-100 rounded-lg text-cyan-500 hover:text-cyan-600" 
                              title="Return to Lab"
                            >
                              <FlaskConical className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => handlePrintInvoice(invoice)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" 
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <button 
                            onClick={() => setCancellingInvoice(invoice)}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600" 
                            title="Cancel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No invoices found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick View Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingInvoice.invoiceNumber}</h2>
                <p className="text-sm text-gray-500">Invoice Details</p>
              </div>
              <button onClick={() => { setViewingInvoice(null); setViewingInvoiceItems([]); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)]">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{viewingInvoice.customerName}</p>
                  <p className="text-sm text-gray-500">{customerTypeConfig[viewingInvoice.customerType].label}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingInvoice.status].color}`}>
                    {statusConfig[viewingInvoice.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Invoice Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {viewingInvoice.date}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {viewingInvoice.dueDate}
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(viewingInvoiceItems.length > 0 ? viewingInvoiceItems : viewingInvoice.items).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{item.description}</td>
                        <td className="px-4 py-2 text-sm text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                      </tr>
                    ))}
                    {viewingInvoiceItems.length === 0 && viewingInvoice.items.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-sm text-center text-gray-500">No items on this invoice</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold">Total Amount</td>
                      <td className="px-4 py-3 text-right font-bold text-lg">{formatCurrency(viewingInvoice.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <PrintFormatSelector value={printFormat} onChange={setPrintFormat} />
              <button 
                onClick={() => handlePrintInvoice(viewingInvoice)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {(viewingInvoice.status === 'pending' || viewingInvoice.status === 'partially_paid') && (
                <button 
                  onClick={() => handleCollectPayment(viewingInvoice)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CreditCard className="w-4 h-4" />
                  Collect Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {cancellingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Cancel Invoice</h2>
              <button onClick={() => { setCancellingInvoice(null); setCancelReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Are you sure you want to cancel invoice <strong>{cancellingInvoice.invoiceNumber}</strong>?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Enter reason..."
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button 
                onClick={() => { setCancellingInvoice(null); setCancelReason(''); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Keep Invoice
              </button>
              <button
                onClick={() => cancelMutation.mutate({ id: cancellingInvoice.id, reason: cancelReason })}
                disabled={cancelMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Cancel Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Doctor Modal */}
      {returnDoctorInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-500" />
                Return to Doctor
              </h2>
              <button onClick={() => { setReturnDoctorInvoice(null); setReturnDoctorReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-2">
                Patient: <strong>{returnDoctorInvoice.customerName}</strong>
              </p>
              <p className="text-gray-600 mb-4">
                Invoice: <strong>{returnDoctorInvoice.invoiceNumber}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for return</label>
                <textarea
                  value={returnDoctorReason}
                  onChange={(e) => setReturnDoctorReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="e.g., Prescription adjustment needed..."
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Prescription adjustment', 'Additional consultation', 'Lab results review', 'Patient questions'].map((r) => (
                  <button key={r} onClick={() => setReturnDoctorReason(r)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => { setReturnDoctorInvoice(null); setReturnDoctorReason(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={() => returnToDoctorMutation.mutate({ encounterId: returnDoctorInvoice.encounterId!, reason: returnDoctorReason })}
                disabled={returnToDoctorMutation.isPending || !returnDoctorReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {returnToDoctorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Return to Doctor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Lab Modal */}
      {returnLabInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-cyan-500" />
                Return to Lab
              </h2>
              <button onClick={() => { setReturnLabInvoice(null); setReturnLabReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-2">
                Patient: <strong>{returnLabInvoice.customerName}</strong>
              </p>
              <p className="text-gray-600 mb-4">
                Invoice: <strong>{returnLabInvoice.invoiceNumber}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for return</label>
                <textarea
                  value={returnLabReason}
                  onChange={(e) => setReturnLabReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500"
                  rows={3}
                  placeholder="e.g., Additional tests required..."
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Additional tests required', 'Retest needed - inconclusive results', 'Sample quality issue', 'Doctor requested repeat', 'Wrong test performed'].map((r) => (
                  <button key={r} onClick={() => setReturnLabReason(r)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => { setReturnLabInvoice(null); setReturnLabReason(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={() => returnToLabMutation.mutate({ encounterId: returnLabInvoice.encounterId!, reason: returnLabReason })}
                disabled={returnToLabMutation.isPending || !returnLabReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
              >
                {returnToLabMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                Return to Lab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Pharmacy Modal */}
      {returnPharmacyInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-purple-500" />
                Return to Pharmacy
              </h2>
              <button onClick={() => { setReturnPharmacyInvoice(null); setReturnPharmacyReason(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-2">
                Patient: <strong>{returnPharmacyInvoice.customerName}</strong>
              </p>
              <p className="text-gray-600 mb-4">
                Invoice: <strong>{returnPharmacyInvoice.invoiceNumber}</strong>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for return</label>
                <textarea
                  value={returnPharmacyReason}
                  onChange={(e) => setReturnPharmacyReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="e.g., Wrong medication dispensed..."
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Wrong medication', 'Dosage adjustment', 'Alternative needed', 'Out of stock'].map((r) => (
                  <button key={r} onClick={() => setReturnPharmacyReason(r)} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => { setReturnPharmacyInvoice(null); setReturnPharmacyReason(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={() => returnToPharmacyMutation.mutate({ encounterId: returnPharmacyInvoice.encounterId!, reason: returnPharmacyReason })}
                disabled={returnToPharmacyMutation.isPending || !returnPharmacyReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                {returnToPharmacyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pill className="w-4 h-4" />}
                Return to Pharmacy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Collect Payment</h2>
                <p className="text-sm text-gray-500">{payingInvoice.invoiceNumber} • {payingInvoice.customerName}</p>
              </div>
              <button onClick={() => { setPayingInvoice(null); setPaymentAmount(''); setPaymentReference(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-semibold">{formatCurrency(payingInvoice.amount)}</span>
              </div>
              {Number(payingInvoice.paidAmount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Already Paid</span>
                  <span className="font-semibold text-green-600">{formatCurrency(Number(payingInvoice.paidAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t pt-2">
                <span>Balance Due</span>
                <span className="text-red-600">{formatCurrency(Number(payingInvoice.balance) || (Number(payingInvoice.amount) - Number(payingInvoice.paidAmount || 0)))}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <div className="flex gap-2">
                  {(['cash', 'card', 'mobile_money'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        paymentMethod === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {m === 'cash' ? 'Cash' : m === 'card' ? 'Card' : 'Mobile'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">UGX</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {(() => {
                    const bal = Number(payingInvoice.balance) || (Number(payingInvoice.amount) - Number(payingInvoice.paidAmount || 0));
                    return (
                      <>
                        <button onClick={() => setPaymentAmount(String(bal))} className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">Exact</button>
                        <button onClick={() => setPaymentAmount(String(Math.round(bal / 2)))} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">50%</button>
                        {[1000, 5000, 10000, 50000].map((d) => (
                          <button key={d} onClick={() => setPaymentAmount(String(d))} className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                            {d >= 1000 ? `${d / 1000}k` : d}
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>

              {paymentMethod !== 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={paymentMethod === 'card' ? 'Card approval code' : 'Transaction ID'}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { setPayingInvoice(null); setPaymentAmount(''); setPaymentReference(''); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amt = Number(paymentAmount);
                  if (!amt || amt <= 0) {
                    toast.error('Enter a valid payment amount');
                    return;
                  }
                  paymentMutation.mutate({
                    invoiceId: payingInvoice.id,
                    amount: amt,
                    method: paymentMethod,
                    reference: paymentReference || undefined,
                  });
                }}
                disabled={paymentMutation.isPending || !paymentAmount || Number(paymentAmount) <= 0}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {paymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Pay {formatCurrency(Number(paymentAmount) || 0)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
