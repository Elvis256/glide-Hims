import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Search,
  Phone,
  MessageSquare,
  Receipt,
  Calendar,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { billingService, type Invoice } from '../services/billing';
import ErrorDisplay from '../components/ErrorDisplay';

interface PendingPayment {
  id: string;
  billNumber: string;
  patientName: string;
  patientMrn: string;
  patientPhone: string;
  amount: number;
  dueDate: string;
  createdDate: string;
  daysOverdue: number;
  status: 'pending' | 'overdue' | 'partial';
  partialPaid?: number;
}

function transformInvoiceToPendingPayment(invoice: Invoice): PendingPayment {
  const dueDate = new Date(invoice.createdAt);
  dueDate.setDate(dueDate.getDate() + 30); // Assume 30-day payment terms
  const today = new Date();
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  let status: 'pending' | 'overdue' | 'partial' = 'pending';
  if (invoice.status === 'partially_paid') {
    status = 'partial';
  } else if (daysOverdue > 0) {
    status = 'overdue';
  }

  return {
    id: invoice.id,
    billNumber: invoice.invoiceNumber,
    patientName: invoice.patient?.fullName || 'Unknown',
    patientMrn: invoice.patient?.mrn || 'N/A',
    patientPhone: '', // Phone not in invoice data
    amount: invoice.totalAmount,
    dueDate: dueDate.toISOString().split('T')[0],
    createdDate: invoice.createdAt.split('T')[0],
    daysOverdue,
    status,
    partialPaid: invoice.paidAmount > 0 ? invoice.paidAmount : undefined,
  };
}

export default function PendingPaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'overdue'>('overdue');

  // Fetch pending and partially paid invoices
  const { data: pendingData, isLoading: pendingLoading, error: pendingError } = useQuery({
    queryKey: ['invoices', 'pending'],
    queryFn: () => billingService.invoices.list({ status: 'pending' }),
  });

  const { data: partialData, isLoading: partialLoading, error: partialError } = useQuery({
    queryKey: ['invoices', 'partially_paid'],
    queryFn: () => billingService.invoices.list({ status: 'partially_paid' }),
  });

  const isLoading = pendingLoading || partialLoading;
  const error = pendingError || partialError;

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const pendingPayments = useMemo(() => {
    const pendingInvoices = pendingData?.data || [];
    const partialInvoices = partialData?.data || [];
    const allInvoices = [...pendingInvoices, ...partialInvoices];
    return allInvoices.map(transformInvoiceToPendingPayment);
  }, [pendingData, partialData]);

  const filteredPayments = useMemo(() => {
    return pendingPayments
      .filter((payment) => {
        const matchesSearch =
          payment.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.patientMrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.billNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'overdue') return b.daysOverdue - a.daysOverdue;
        if (sortBy === 'amount') return b.amount - a.amount;
        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      });
  }, [pendingPayments, searchTerm, statusFilter, sortBy]);

  const stats = useMemo(() => ({
    total: pendingPayments.length,
    pending: pendingPayments.filter(p => p.status === 'pending').length,
    overdue: pendingPayments.filter(p => p.status === 'overdue').length,
    totalAmount: pendingPayments.reduce((sum, p) => sum + (p.amount - (p.partialPaid || 0)), 0),
  }), [pendingPayments]);

  const getStatusBadge = (status: string, daysOverdue: number) => {
    if (status === 'overdue') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          {daysOverdue}d overdue
        </span>
      );
    }
    if (status === 'partial') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          Partial
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
        Pending
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pending Payments</h1>
            <p className="text-gray-500 text-sm">Track and follow up on unpaid bills</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Pending</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">On Time</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
          <p className="text-xs text-gray-500">Overdue</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gray-900">UGX {(stats.totalAmount / 1000).toFixed(0)}K</p>
          <p className="text-xs text-gray-500">Amount Due</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 flex-shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient, MRN, or bill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 py-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input py-2 text-sm w-32"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="input py-2 text-sm w-32"
        >
          <option value="overdue">By Overdue</option>
          <option value="amount">By Amount</option>
          <option value="date">By Date</option>
        </select>
      </div>

      {/* Payments List */}
      <div className="flex-1 card min-h-0 flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 gap-4 p-3 border-b bg-gray-50 text-xs font-medium text-gray-500 flex-shrink-0">
          <div>Bill #</div>
          <div className="col-span-2">Patient</div>
          <div>Amount Due</div>
          <div>Due Date</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin" />
                <p>Loading pending payments...</p>
              </div>
            </div>
          ) : error ? (
            <ErrorDisplay 
              error={error} 
              title="Failed to load pending payments"
              onRetry={handleRetry}
            />
          ) : filteredPayments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No pending payments</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {filteredPayments.map((payment) => (
                <div key={payment.id} className="grid grid-cols-7 gap-4 p-3 items-center hover:bg-gray-50">
                  <div className="font-mono text-sm text-blue-600">{payment.billNumber}</div>
                  <div className="col-span-2">
                    <p className="font-medium text-gray-900">{payment.patientName}</p>
                    <p className="text-xs text-gray-500">{payment.patientMrn}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      UGX {(payment.amount - (payment.partialPaid || 0)).toLocaleString()}
                    </p>
                    {payment.partialPaid && (
                      <p className="text-xs text-gray-500">
                        of {payment.amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="w-3 h-3 text-gray-400" />
                    {new Date(payment.dueDate).toLocaleDateString()}
                  </div>
                  <div>{getStatusBadge(payment.status, payment.daysOverdue)}</div>
                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${payment.patientPhone}`}
                      className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded"
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <button
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Send SMS"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate('/billing/reception/payment')}
                      className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
                      title="Collect Payment"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
