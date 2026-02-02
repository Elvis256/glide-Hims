import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  FileText,
  Filter,
  Calendar,
  Download,
  Eye,
  Printer,
  RotateCcw,
  XCircle,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Shield,
  FileSpreadsheet,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { billingService, type Invoice } from '../../../services';

type BillStatus = 'paid' | 'pending' | 'partial' | 'cancelled';
type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'insurance';

interface Bill {
  id: string;
  billNumber: string;
  patientMrn: string;
  patientName: string;
  date: string;
  amount: number;
  paidAmount: number;
  status: BillStatus;
  paymentMethod: PaymentMethod;
  services: string[];
}

// Transform API Invoice to UI Bill format
const transformInvoiceToBill = (invoice: Invoice): Bill => {
  const statusMap: Record<string, BillStatus> = {
    paid: 'paid',
    pending: 'pending',
    partially_paid: 'partial',
    partial: 'partial',
    cancelled: 'cancelled',
    draft: 'pending',
    refunded: 'cancelled',
  };
  
  const paymentTypeMap: Record<string, PaymentMethod> = {
    cash: 'cash',
    insurance: 'insurance',
    corporate: 'card',
    membership: 'mobile_money',
  };
  
  return {
    id: invoice.id,
    billNumber: invoice.invoiceNumber,
    patientMrn: invoice.patient?.mrn || 'N/A',
    patientName: invoice.patient?.fullName || 'Unknown',
    date: invoice.createdAt.split('T')[0],
    amount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    status: statusMap[invoice.status] || 'pending',
    paymentMethod: paymentTypeMap[invoice.paymentType] || 'cash',
    services: [], // Services would need to be fetched from invoice items
  };
};

const statusConfig: Record<BillStatus, { color: string; icon: React.ReactNode; label: string }> = {
  paid: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" />, label: 'Paid' },
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
  partial: { color: 'bg-blue-100 text-blue-700', icon: <AlertCircle className="w-4 h-4" />, label: 'Partial' },
  cancelled: { color: 'bg-gray-100 text-gray-500', icon: <XCircle className="w-4 h-4" />, label: 'Cancelled' },
};

const paymentIcons: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4 text-green-600" />,
  card: <CreditCard className="w-4 h-4 text-blue-600" />,
  mobile_money: <Smartphone className="w-4 h-4 text-yellow-600" />,
  insurance: <Shield className="w-4 h-4 text-purple-600" />,
};

export default function SearchBillsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'bill_number' | 'mrn' | 'name'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [actionMenuBill, setActionMenuBill] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Debounced search query for API
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Debounce search input with useEffect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchType === 'bill_number') {
        setInvoiceNumberSearch(searchQuery.trim());
        setDebouncedSearch('');
      } else if (searchType === 'mrn') {
        setDebouncedSearch('');
        // MRN is passed directly via patientMrn param
      } else {
        setDebouncedSearch(searchQuery.trim());
        setInvoiceNumberSearch('');
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchType]);
  
  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // Map UI status to API status
  const getApiStatus = (status: BillStatus | 'all'): string | undefined => {
    if (status === 'all') return undefined;
    // Map frontend status names to backend enum values
    const statusMap: Record<BillStatus, string> = {
      paid: 'paid',
      pending: 'pending',
      partial: 'partially_paid',
      cancelled: 'cancelled',
    };
    return statusMap[status];
  };

  // Fetch invoices list from API
  const { data: invoicesData, isLoading, isError } = useQuery({
    queryKey: ['billing-invoices', statusFilter, dateFrom, dateTo, debouncedSearch, searchType, searchQuery],
    queryFn: () => billingService.invoices.list({
      status: getApiStatus(statusFilter),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      type: 'opd',
      search: (searchType === 'all' || searchType === 'name') && debouncedSearch ? debouncedSearch : undefined,
      patientMrn: searchType === 'mrn' && searchQuery.trim() ? searchQuery.trim() : undefined,
    }),
    staleTime: 30000,
  });

  // Fetch invoice by number (only when searching by bill number)
  const { data: invoiceByNumber, isLoading: isLoadingByNumber } = useQuery({
    queryKey: ['billing-invoice-by-number', invoiceNumberSearch],
    queryFn: () => billingService.invoices.getByNumber(invoiceNumberSearch),
    enabled: !!invoiceNumberSearch && searchType === 'bill_number',
    staleTime: 30000,
  });

  // Transform API data to Bill format
  const bills: Bill[] = useMemo(() => {
    // If searching by invoice number and we have a result
    if (invoiceNumberSearch && searchType === 'bill_number' && invoiceByNumber) {
      return [transformInvoiceToBill(invoiceByNumber)];
    }
    
    // Otherwise use the list data
    const apiInvoices = invoicesData?.data || [];
    return apiInvoices.map(transformInvoiceToBill);
  }, [invoicesData, invoiceByNumber, invoiceNumberSearch, searchType]);

  const filteredBills = useMemo(() => {
    let result = bills;

    // Payment method filter (client-side only - API doesn't support this filter)
    if (paymentFilter !== 'all') {
      result = result.filter((bill) => bill.paymentMethod === paymentFilter);
    }

    return result;
  }, [paymentFilter, bills]);

  const summaryStats = useMemo(() => {
    const total = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const collected = filteredBills.reduce((sum, b) => sum + b.paidAmount, 0);
    const pending = total - collected;
    return { total, collected, pending, count: filteredBills.length };
  }, [filteredBills]);

  const handleExportExcel = () => {
    if (filteredBills.length === 0) {
      toast.error('No bills to export');
      return;
    }
    
    // Create CSV content (Excel-compatible)
    const headers = ['Bill Number', 'Patient Name', 'MRN', 'Date', 'Amount', 'Paid Amount', 'Status', 'Payment Method'];
    const rows = filteredBills.map(bill => [
      bill.billNumber,
      bill.patientName,
      bill.patientMrn,
      bill.date,
      bill.amount,
      bill.paidAmount,
      bill.status,
      bill.paymentMethod.replace('_', ' ')
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bills_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportPDF = () => {
    if (filteredBills.length === 0) {
      toast.error('No bills to export');
      return;
    }
    
    // Create printable HTML for PDF
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bills Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; color: #333; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; justify-content: center; }
          .summary-item { padding: 10px 20px; background: #f5f5f5; border-radius: 8px; text-align: center; }
          .summary-item .label { font-size: 12px; color: #666; }
          .summary-item .value { font-size: 18px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: 600; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .amount { text-align: right; }
          .status-paid { color: green; }
          .status-pending { color: orange; }
          .status-partial { color: blue; }
          .status-cancelled { color: gray; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Bills Report</h1>
        <p style="text-align: center; color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
        
        <div class="summary">
          <div class="summary-item">
            <div class="label">Total Bills</div>
            <div class="value">${summaryStats.count}</div>
          </div>
          <div class="summary-item">
            <div class="label">Total Amount</div>
            <div class="value">UGX ${summaryStats.total.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="label">Collected</div>
            <div class="value" style="color: green;">UGX ${summaryStats.collected.toLocaleString()}</div>
          </div>
          <div class="summary-item">
            <div class="label">Pending</div>
            <div class="value" style="color: orange;">UGX ${summaryStats.pending.toLocaleString()}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Bill #</th>
              <th>Patient</th>
              <th>MRN</th>
              <th>Date</th>
              <th class="amount">Amount</th>
              <th class="amount">Paid</th>
              <th>Status</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBills.map(bill => `
              <tr>
                <td>${bill.billNumber}</td>
                <td>${bill.patientName}</td>
                <td>${bill.patientMrn}</td>
                <td>${bill.date}</td>
                <td class="amount">UGX ${bill.amount.toLocaleString()}</td>
                <td class="amount">UGX ${bill.paidAmount.toLocaleString()}</td>
                <td class="status-${bill.status}">${bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}</td>
                <td>${bill.paymentMethod.replace('_', ' ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Glide HIMS - Healthcare Management System</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleViewBill = (bill: Bill) => {
    setSelectedBill(bill);
    setActionMenuBill(null);
  };

  const handlePrintBill = (bill: Bill) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${bill.billNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; max-width: 600px; margin: 40px auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #333; }
          .header p { margin: 5px 0; color: #666; }
          .bill-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .bill-info div { }
          .bill-info .label { font-size: 12px; color: #666; }
          .bill-info .value { font-weight: bold; }
          .patient-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .amount-section { border-top: 1px solid #ddd; padding-top: 20px; margin-top: 20px; }
          .amount-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .amount-row.total { border-top: 2px solid #333; font-weight: bold; font-size: 18px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-paid { background: #d4edda; color: #155724; }
          .status-pending { background: #fff3cd; color: #856404; }
          .status-partial { background: #cce5ff; color: #004085; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Glide HIMS</h1>
          <p>Healthcare Management System</p>
        </div>
        
        <div class="bill-info">
          <div>
            <div class="label">Bill Number</div>
            <div class="value">${bill.billNumber}</div>
          </div>
          <div>
            <div class="label">Date</div>
            <div class="value">${bill.date}</div>
          </div>
          <div>
            <span class="status status-${bill.status}">${bill.status.toUpperCase()}</span>
          </div>
        </div>
        
        <div class="patient-info">
          <div class="label">Patient</div>
          <div class="value">${bill.patientName}</div>
          <div style="font-size: 14px; color: #666;">MRN: ${bill.patientMrn}</div>
        </div>
        
        <div class="amount-section">
          <div class="amount-row">
            <span>Total Amount</span>
            <span>UGX ${bill.amount.toLocaleString()}</span>
          </div>
          <div class="amount-row">
            <span>Paid Amount</span>
            <span style="color: green;">UGX ${bill.paidAmount.toLocaleString()}</span>
          </div>
          ${bill.status === 'partial' ? `
          <div class="amount-row">
            <span>Balance Due</span>
            <span style="color: orange;">UGX ${(bill.amount - bill.paidAmount).toLocaleString()}</span>
          </div>
          ` : ''}
          <div class="amount-row total">
            <span>Payment Method</span>
            <span>${bill.paymentMethod.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for choosing our services</p>
          <p>Printed on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    setActionMenuBill(null);
  };

  const handleRefundBill = async (bill: Bill) => {
    if (!confirm(`Process refund for bill ${bill.billNumber}?`)) {
      setActionMenuBill(null);
      return;
    }
    
    setIsProcessing(true);
    try {
      await billingService.invoices.refund(bill.id, 'Refund requested by user');
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast.success('Refund processed successfully');
    } catch (error) {
      console.error('Refund error:', error);
      toast.error('Failed to process refund. Please try again.');
    } finally {
      setIsProcessing(false);
      setActionMenuBill(null);
    }
  };

  const handleCancelBill = async (bill: Bill) => {
    if (!confirm(`Cancel bill ${bill.billNumber}? This action cannot be undone.`)) {
      setActionMenuBill(null);
      return;
    }
    
    setIsProcessing(true);
    try {
      await billingService.invoices.cancel(bill.id, 'Cancelled by user');
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      toast.success('Bill cancelled successfully');
    } catch (error) {
      console.error('Cancel error:', error);
      toast.error('Failed to cancel bill. Please try again.');
    } finally {
      setIsProcessing(false);
      setActionMenuBill(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setInvoiceNumberSearch('');
    setDebouncedSearch('');
    setSearchType('all');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setPaymentFilter('all');
  };

  // Handle search type change
  const handleSearchTypeChange = (type: typeof searchType) => {
    setSearchType(type);
    if (type === 'bill_number' && searchQuery.trim()) {
      setInvoiceNumberSearch(searchQuery.trim());
      setDebouncedSearch('');
    } else if (type === 'all' || type === 'name') {
      setDebouncedSearch(searchQuery.trim());
      setInvoiceNumberSearch('');
    } else {
      setInvoiceNumberSearch('');
      setDebouncedSearch('');
    }
  };

  const isLoadingData = isLoading || (searchType === 'bill_number' && isLoadingByNumber);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Search className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Search Bills</h1>
            <p className="text-gray-500 text-sm">Find and manage OPD bills</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4 text-red-600" />
            PDF
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4 flex-shrink-0">
        <div className="flex flex-wrap gap-3">
          {/* Search Input */}
          <div className="flex-1 min-w-[300px] flex gap-2">
            <select
              value={searchType}
              onChange={(e) => handleSearchTypeChange(e.target.value as typeof searchType)}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="all">All Fields</option>
              <option value="bill_number">Bill Number</option>
              <option value="mrn">Patient MRN</option>
              <option value="name">Patient Name</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={searchType === 'bill_number' ? 'Enter invoice number...' : 'Search bills...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
              {isLoadingData && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
              showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Clear Filters */}
          {(searchQuery || dateFrom || dateTo || statusFilter !== 'all' || paymentFilter !== 'all') && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
              <XCircle className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All
                </button>
                {(['paid', 'pending', 'partial', 'cancelled'] as BillStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                      statusFilter === status ? statusConfig[status].color : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {statusConfig[status].icon}
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
              <div className="flex gap-1">
                <button
                  onClick={() => setPaymentFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    paymentFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All
                </button>
                {(['cash', 'card', 'mobile_money', 'insurance'] as PaymentMethod[]).map((method) => (
                  <button
                    key={method}
                    onClick={() => setPaymentFilter(method)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                      paymentFilter === method ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {paymentIcons[method]}
                    {method.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Total Bills</p>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">UGX {summaryStats.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Collected</p>
          <p className="text-2xl font-bold text-green-600">UGX {summaryStats.collected.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-xs text-gray-500">Pending</p>
          <p className="text-2xl font-bold text-orange-600">UGX {summaryStats.pending.toLocaleString()}</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Bill #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Payment</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoadingData ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p>Loading bills...</p>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                    <p className="text-red-600">Failed to load bills</p>
                    <p className="text-sm">Please try again later</p>
                  </td>
                </tr>
              ) : filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No bills found matching your criteria</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-blue-600">{bill.billNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-sm">{bill.patientName}</p>
                      <p className="text-xs text-gray-500">{bill.patientMrn}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{bill.date}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-semibold text-gray-900 text-sm">UGX {bill.amount.toLocaleString()}</p>
                      {bill.status === 'partial' && (
                        <p className="text-xs text-blue-600">Paid: UGX {bill.paidAmount.toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {paymentIcons[bill.paymentMethod]}
                        <span className="text-xs text-gray-600 capitalize">{bill.paymentMethod.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[bill.status].color}`}>
                        {statusConfig[bill.status].icon}
                        {statusConfig[bill.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center relative">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewBill(bill)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintBill(bill)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"
                          title="Print"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setActionMenuBill(actionMenuBill === bill.id ? null : bill.id)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {actionMenuBill === bill.id && (
                          <div className="absolute right-4 top-10 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                            {bill.status === 'paid' && (
                              <button
                                onClick={() => handleRefundBill(bill)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 text-orange-600"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Refund
                              </button>
                            )}
                            {bill.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCancelBill(bill)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 text-red-600"
                              >
                                <XCircle className="w-4 h-4" />
                                Cancel Bill
                              </button>
                            )}
                          </div>
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

      {/* View Bill Modal */}
      {selectedBill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Bill Details</h3>
              <button onClick={() => setSelectedBill(null)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-lg font-bold text-blue-600">{selectedBill.billNumber}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedBill.status].color}`}>
                  {statusConfig[selectedBill.status].icon}
                  {statusConfig[selectedBill.status].label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Patient</p>
                  <p className="font-medium">{selectedBill.patientName}</p>
                  <p className="text-xs text-gray-500">{selectedBill.patientMrn}</p>
                </div>
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">{selectedBill.date}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Services</h4>
              <ul className="space-y-1">
                {selectedBill.services.map((service, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {service}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Payment Method</span>
                <span className="flex items-center gap-1 font-medium capitalize">
                  {paymentIcons[selectedBill.paymentMethod]}
                  {selectedBill.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Amount</span>
                <span className="font-medium">UGX {selectedBill.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Paid Amount</span>
                <span className="font-medium text-green-600">UGX {selectedBill.paidAmount.toLocaleString()}</span>
              </div>
              {selectedBill.status === 'partial' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Balance Due</span>
                  <span className="font-medium text-orange-600">
                    UGX {(selectedBill.amount - selectedBill.paidAmount).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedBill(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => handlePrintBill(selectedBill)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Printer className="w-4 h-4" />
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}