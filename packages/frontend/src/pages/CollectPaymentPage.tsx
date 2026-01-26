import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Search,
  CreditCard,
  Smartphone,
  CheckCircle,
  ArrowLeft,
  Receipt,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { billingService, type Invoice } from '../services/billing';

const paymentMethods = [
  { id: 'cash', name: 'Cash', icon: Banknote },
  { id: 'card', name: 'Card', icon: CreditCard },
  { id: 'mobile', name: 'Mobile Money', icon: Smartphone },
];

export default function CollectPaymentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');

  const { data: pendingBills = [], isLoading, error } = useQuery({
    queryKey: ['pending-invoices'],
    queryFn: billingService.invoices.getPending,
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { invoiceId: string; amount: number; paymentMethod: string; reference?: string }) =>
      billingService.payments.record(data.invoiceId, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
      }),
    onSuccess: (payment) => {
      setReceiptNumber(payment.receiptNumber || `REC-${Date.now().toString().slice(-8)}`);
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
    },
  });

  const filteredBills = pendingBills.filter(
    (bill) =>
      bill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.patient?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.patient?.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const change = selectedBill 
    ? Math.max(0, parseFloat(amountReceived || '0') - selectedBill.balance)
    : 0;

  const handlePayment = () => {
    if (!selectedBill) return;
    paymentMutation.mutate({
      invoiceId: selectedBill.id,
      amount: parseFloat(amountReceived),
      paymentMethod,
      reference: transactionRef || undefined,
    });
  };

  if (showSuccess) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Received!</h2>
          <p className="text-gray-500 mb-4">
            Payment of UGX {selectedBill?.balance.toLocaleString()} collected
          </p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Receipt Number</p>
            <p className="text-2xl font-mono font-bold text-blue-700">{receiptNumber}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSuccess(false);
                setSelectedBill(null);
                setAmountReceived('');
              }}
              className="btn-secondary flex-1"
            >
              Collect Another
            </button>
            <button
              onClick={() => navigate('/billing/reception/receipt')}
              className="btn-primary flex-1"
            >
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Banknote className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Collect Payment</h1>
            <p className="text-gray-500 text-sm">Process patient payments</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* Left: Bill Selection */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Bill</h2>
          
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by bill number, patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span>Failed to load pending bills</span>
              </div>
            )}
            {!isLoading && !error && filteredBills.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No pending bills found
              </div>
            )}
            {filteredBills.map((bill) => (
              <button
                key={bill.id}
                onClick={() => setSelectedBill(bill)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  selectedBill?.id === bill.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-medium text-blue-600">
                    {bill.invoiceNumber}
                  </span>
                  <span className="font-bold text-gray-900">
                    UGX {bill.balance.toLocaleString()}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{bill.patient?.fullName}</p>
                <p className="text-xs text-gray-500">{bill.patient?.mrn}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(bill.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{bill.type}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Payment Processing */}
        <div className="card p-4 flex flex-col min-h-0">
          {!selectedBill ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a bill to process payment</p>
              </div>
            </div>
          ) : (
            <>
              {/* Bill Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 flex-shrink-0">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-mono text-sm text-blue-600">{selectedBill.invoiceNumber}</p>
                    <p className="font-medium text-gray-900">{selectedBill.patient?.fullName}</p>
                    <p className="text-xs text-gray-500">{selectedBill.patient?.mrn}</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">
                    UGX {selectedBill.balance.toLocaleString()}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Type: {selectedBill.type.toUpperCase()}</p>
                  <p>Total: UGX {selectedBill.totalAmount.toLocaleString()} | Paid: UGX {selectedBill.paidAmount.toLocaleString()}</p>
                </div>
              </div>

              {/* Payment Method */}
              <h3 className="text-sm font-semibold mb-2 flex-shrink-0">Payment Method</h3>
              <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-lg border text-center ${
                      paymentMethod === method.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <method.icon className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">{method.name}</span>
                  </button>
                ))}
              </div>

              {/* Amount */}
              <div className="flex-1 overflow-y-auto space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Amount Received
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">UGX</span>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder={selectedBill.balance.toString()}
                      className="input pl-12 py-2 text-lg font-medium"
                    />
                  </div>
                </div>

                {paymentMethod !== 'cash' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Transaction Reference
                    </label>
                    <input
                      type="text"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="Enter reference number"
                      className="input py-2"
                    />
                  </div>
                )}

                {paymentMethod === 'cash' && parseFloat(amountReceived) > selectedBill.balance && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700">
                      Change due: <span className="font-bold">UGX {change.toLocaleString()}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Process Button */}
              <button
                onClick={handlePayment}
                disabled={!amountReceived || parseFloat(amountReceived) < selectedBill.balance || paymentMutation.isPending}
                className="btn-primary py-3 mt-4 flex-shrink-0 disabled:opacity-50"
              >
                {paymentMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  'Process Payment'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
