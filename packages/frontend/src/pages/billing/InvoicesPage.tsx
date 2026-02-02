import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { billingService, type Invoice as APIInvoice } from '../../services';
import api from '../../services/api';

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

  // Handle print invoice
  const handlePrintInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Invoice ${invoice.invoiceNumber}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>Invoice ${invoice.invoiceNumber}</h1>
            <p><strong>Customer:</strong> ${invoice.customerName}</p>
            <p><strong>Date:</strong> ${invoice.date}</p>
            <p><strong>Amount:</strong> ${formatCurrency(invoice.amount)}</p>
            <p><strong>Status:</strong> ${statusConfig[invoice.status].label}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Navigate to collect payment
  const handleCollectPayment = (invoice: Invoice) => {
    navigate(`/cashier?invoice=${invoice.invoiceNumber}`);
  };

  // Transform API invoices to UI format
  const invoices: Invoice[] = useMemo(() => {
    const apiData = apiInvoices?.data || [];
    return apiData.map((inv: APIInvoice) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.patient?.fullName || 'Unknown',
      customerType: (inv.paymentType === 'insurance' ? 'insurance' : 
                    inv.paymentType === 'corporate' ? 'corporate' : 'patient') as CustomerType,
      date: inv.createdAt.split('T')[0],
      dueDate: inv.createdAt.split('T')[0], // Add 14 days logic if needed
      amount: inv.totalAmount,
      status: inv.status as InvoiceStatus,
      items: [],
      encounterId: inv.encounterId,
    }));
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
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
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
                        {(invoice.status === 'pending' || invoice.status === 'partial') && (
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
              <button 
                onClick={() => handlePrintInvoice(viewingInvoice)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {(viewingInvoice.status === 'pending' || viewingInvoice.status === 'partial') && (
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
    </div>
  );
}
