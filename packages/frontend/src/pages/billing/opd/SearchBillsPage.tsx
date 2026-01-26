import { useState, useMemo } from 'react';
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
} from 'lucide-react';

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

const mockBills: Bill[] = [
  {
    id: '1',
    billNumber: 'OPD-20240115-001',
    patientMrn: 'MRN-2024-0001',
    patientName: 'Sarah Nakimera',
    date: '2024-01-15',
    amount: 350000,
    paidAmount: 350000,
    status: 'paid',
    paymentMethod: 'insurance',
    services: ['General Consultation', 'Complete Blood Count', 'Urinalysis'],
  },
  {
    id: '2',
    billNumber: 'OPD-20240115-002',
    patientMrn: 'MRN-2024-0002',
    patientName: 'James Okello',
    date: '2024-01-15',
    amount: 180000,
    paidAmount: 0,
    status: 'pending',
    paymentMethod: 'cash',
    services: ['Specialist Consultation', 'ECG'],
  },
  {
    id: '3',
    billNumber: 'OPD-20240114-003',
    patientMrn: 'MRN-2024-0003',
    patientName: 'Grace Atim',
    date: '2024-01-14',
    amount: 450000,
    paidAmount: 200000,
    status: 'partial',
    paymentMethod: 'mobile_money',
    services: ['Chest X-Ray', 'Abdominal Ultrasound'],
  },
  {
    id: '4',
    billNumber: 'OPD-20240114-004',
    patientMrn: 'MRN-2024-0004',
    patientName: 'Peter Wasswa',
    date: '2024-01-14',
    amount: 85000,
    paidAmount: 0,
    status: 'cancelled',
    paymentMethod: 'card',
    services: ['Follow-up Visit'],
  },
  {
    id: '5',
    billNumber: 'OPD-20240113-005',
    patientMrn: 'MRN-2024-0005',
    patientName: 'Mary Achieng',
    date: '2024-01-13',
    amount: 520000,
    paidAmount: 520000,
    status: 'paid',
    paymentMethod: 'card',
    services: ['Liver Function Test', 'Renal Function Test', 'Lipid Profile', 'Consultation'],
  },
  {
    id: '6',
    billNumber: 'OPD-20240113-006',
    patientMrn: 'MRN-2024-0006',
    patientName: 'John Mukisa',
    date: '2024-01-13',
    amount: 150000,
    paidAmount: 150000,
    status: 'paid',
    paymentMethod: 'mobile_money',
    services: ['General Consultation', 'Blood Sugar'],
  },
  {
    id: '7',
    billNumber: 'OPD-20240112-007',
    patientMrn: 'MRN-2024-0007',
    patientName: 'Agnes Namuli',
    date: '2024-01-12',
    amount: 280000,
    paidAmount: 100000,
    status: 'partial',
    paymentMethod: 'cash',
    services: ['Specialist Consultation', 'Complete Blood Count', 'Malaria Test'],
  },
  {
    id: '8',
    billNumber: 'OPD-20240112-008',
    patientMrn: 'MRN-2024-0008',
    patientName: 'David Ochen',
    date: '2024-01-12',
    amount: 750000,
    paidAmount: 750000,
    status: 'paid',
    paymentMethod: 'insurance',
    services: ['CT Scan - Head', 'Neurologist Consultation'],
  },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'bill_number' | 'mrn' | 'name'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [actionMenuBill, setActionMenuBill] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    let result = mockBills;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((bill) => {
        switch (searchType) {
          case 'bill_number':
            return bill.billNumber.toLowerCase().includes(query);
          case 'mrn':
            return bill.patientMrn.toLowerCase().includes(query);
          case 'name':
            return bill.patientName.toLowerCase().includes(query);
          default:
            return (
              bill.billNumber.toLowerCase().includes(query) ||
              bill.patientMrn.toLowerCase().includes(query) ||
              bill.patientName.toLowerCase().includes(query)
            );
        }
      });
    }

    // Date filter
    if (dateFrom) {
      result = result.filter((bill) => bill.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((bill) => bill.date <= dateTo);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((bill) => bill.status === statusFilter);
    }

    // Payment method filter
    if (paymentFilter !== 'all') {
      result = result.filter((bill) => bill.paymentMethod === paymentFilter);
    }

    return result;
  }, [searchQuery, searchType, dateFrom, dateTo, statusFilter, paymentFilter]);

  const summaryStats = useMemo(() => {
    const total = filteredBills.reduce((sum, b) => sum + b.amount, 0);
    const collected = filteredBills.reduce((sum, b) => sum + b.paidAmount, 0);
    const pending = total - collected;
    return { total, collected, pending, count: filteredBills.length };
  }, [filteredBills]);

  const handleExportExcel = () => {
    alert('Exporting to Excel...');
  };

  const handleExportPDF = () => {
    alert('Exporting to PDF...');
  };

  const handleViewBill = (bill: Bill) => {
    setSelectedBill(bill);
    setActionMenuBill(null);
  };

  const handlePrintBill = (bill: Bill) => {
    alert(`Printing bill ${bill.billNumber}...`);
    setActionMenuBill(null);
  };

  const handleRefundBill = (bill: Bill) => {
    if (confirm(`Process refund for bill ${bill.billNumber}?`)) {
      alert('Refund initiated');
    }
    setActionMenuBill(null);
  };

  const handleCancelBill = (bill: Bill) => {
    if (confirm(`Cancel bill ${bill.billNumber}? This action cannot be undone.`)) {
      alert('Bill cancelled');
    }
    setActionMenuBill(null);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSearchType('all');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setPaymentFilter('all');
  };

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
              onChange={(e) => setSearchType(e.target.value as typeof searchType)}
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
                placeholder="Search bills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
              />
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
              {filteredBills.length === 0 ? (
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