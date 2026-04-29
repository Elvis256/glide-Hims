import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Trash2,
} from 'lucide-react';
import { billingService, type Invoice } from '../services/billing';
import { api } from '../services/api';
import { formatCurrency } from '../lib/currency';
import { usePermissions } from '../components/PermissionGate';
import AccessDenied from '../components/AccessDenied';

const paymentMethods = [
  { id: 'cash', name: 'Cash', icon: Banknote },
  { id: 'card', name: 'Card', icon: CreditCard },
  { id: 'mobile_money', name: 'Mobile Money', icon: Smartphone },
];

export default function CollectPaymentPage() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBill, setSelectedBill] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [transactionRef, setTransactionRef] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [paidAmount, setPaidAmount] = useState(0);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [changeGiven, setChangeGiven] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<number>(0);

  // Mobile-money STK push state
  const [momoProvider, setMomoProvider] = useState<'mtn-momo' | 'airtel-money'>('mtn-momo');
  const [momoMsisdn, setMomoMsisdn] = useState('');
  const [momoTxnId, setMomoTxnId] = useState<string | null>(null);
  const [momoStatus, setMomoStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [momoMessage, setMomoMessage] = useState<string>('');

  const startStkPush = async () => {
    if (!selectedBill) return;
    if (!momoMsisdn || momoMsisdn.replace(/\D/g, '').length < 9) {
      toast.error('Enter a valid mobile number');
      return;
    }
    const amount = parseFloat(amountReceived) || (selectedBill.balance || selectedBill.totalAmount || 0);
    if (amount <= 0) {
      toast.error('Enter the amount to charge');
      return;
    }
    try {
      setMomoStatus('pending');
      setMomoMessage('Sending payment request to phone...');
      const { data } = await api.post('/payment-gateway/initiate', {
        provider: momoProvider,
        channel: 'mobile_money',
        amount,
        currency: 'UGX',
        invoiceId: selectedBill.id,
        invoiceNumber: selectedBill.invoiceNumber || selectedBill.id,
        msisdn: momoMsisdn,
        mobileProvider: momoProvider === 'mtn-momo' ? 'mtn' : 'airtel',
        customer: { phone: momoMsisdn },
        description: `Invoice ${selectedBill.invoiceNumber || ''}`.trim(),
      });
      setMomoTxnId(data.providerTransactionId);
      setMomoMessage(data.message || 'Awaiting customer approval on phone...');
      setTransactionRef(data.providerTransactionId);
      pollStkStatus(data.provider || momoProvider, data.providerTransactionId);
    } catch (err: any) {
      setMomoStatus('failed');
      const msg = err?.response?.data?.message || err?.message || 'STK push failed';
      setMomoMessage(msg);
      toast.error(msg);
    }
  };

  const pollStkStatus = async (provider: string, txnId: string) => {
    const deadline = Date.now() + 120_000; // 2 minutes
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const { data } = await api.get(`/payment-gateway/status/${provider}/${txnId}`);
        if (data.status === 'success') {
          setMomoStatus('success');
          setMomoMessage('Payment confirmed by customer. You can now record it below.');
          toast.success('Mobile money payment confirmed');
          return;
        }
        if (data.status === 'failed') {
          setMomoStatus('failed');
          setMomoMessage('Customer declined or payment failed.');
          toast.error('Mobile money payment failed');
          return;
        }
      } catch {
        // transient — keep polling
      }
    }
    setMomoStatus('failed');
    setMomoMessage('Timed out waiting for customer. They may still complete it; check status later.');
  };

  const resetMomo = () => {
    setMomoTxnId(null);
    setMomoStatus('idle');
    setMomoMessage('');
  };

  const { data: pendingBills = [], isLoading, error } = useQuery({
    queryKey: ['pending-invoices'],
    queryFn: billingService.invoices.getPending,
  });

  // Fetch full invoice details (with items) when a bill is selected
  const { data: selectedBillDetail } = useQuery({
    queryKey: ['invoice-detail', selectedBill?.id],
    queryFn: () => billingService.invoices.getById(selectedBill!.id),
    enabled: !!selectedBill?.id,
  });

  // Use detailed invoice data when available
  const billItems = selectedBillDetail?.items || selectedBill?.items || [];
  const hasZeroPriceItems = billItems.some((item) => !item.unitPrice || Number(item.unitPrice) <= 0);

  const updatePriceMutation = useMutation({
    mutationFn: (data: { invoiceId: string; itemId: string; unitPrice: number }) =>
      billingService.invoices.updateItemPrice(data.invoiceId, data.itemId, data.unitPrice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
      setEditingItemId(null);
      toast.success('Price updated');
    },
    onError: () => toast.error('Failed to update price'),
  });

  const removeItemMutation = useMutation({
    mutationFn: (data: { invoiceId: string; itemId: string }) =>
      billingService.invoices.removeItem(data.invoiceId, data.itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-detail'] });
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
      toast.success('Item removed');
    },
    onError: () => toast.error('Failed to remove item'),
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
      const received = parseFloat(amountReceived);
      const billBalance = selectedBill?.balance || selectedBill?.totalAmount || 0;
      const actualPaid = Math.min(received, billBalance);
      setPaidAmount(actualPaid);
      setRemainingBalance(Math.max(0, billBalance - received));
      setChangeGiven(Math.max(0, received - billBalance));
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
    },
  });

  if (!hasPermission('billing.read')) {
    return <AccessDenied />;
  }

  const filteredBills = pendingBills.filter(
    (bill) =>
      bill.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.patient?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.patient?.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const change = selectedBill 
    ? Math.max(0, parseFloat(amountReceived || '0') - (selectedBill.balance || 0))
    : 0;

  const handlePayment = () => {
    if (!selectedBill) return;

    if (hasZeroPriceItems) {
      toast.error('Cannot process payment: some items have no price. Please set prices first.');
      return;
    }

    const billBalance = selectedBill.balance || selectedBill.totalAmount || 0;
    const received = parseFloat(amountReceived);
    // Record actual payment amount (capped at bill balance for overpayments)
    const actualPayment = Math.min(received, billBalance);
    
    paymentMutation.mutate({
      invoiceId: selectedBill.id,
      amount: actualPayment,
      paymentMethod,
      reference: transactionRef || undefined,
    });
  };

  if (showSuccess) {
    const isPartialPayment = remainingBalance > 0;
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-8">
          <div className={`w-16 h-16 ${isPartialPayment ? 'bg-yellow-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <CheckCircle className={`w-10 h-10 ${isPartialPayment ? 'text-yellow-600' : 'text-green-600'}`} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isPartialPayment ? 'Partial Payment Received!' : 'Payment Received!'}
          </h2>
          <p className="text-gray-500 mb-4">
            Payment of <span className="font-semibold">UGX {paidAmount.toLocaleString()}</span> collected
          </p>
          {isPartialPayment && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-700">
                Remaining balance: <span className="font-bold">UGX {remainingBalance.toLocaleString()}</span>
              </p>
            </div>
          )}
          {changeGiven > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                Change given: <span className="font-bold">UGX {changeGiven.toLocaleString()}</span>
              </p>
            </div>
          )}
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
                setPaidAmount(0);
                setRemainingBalance(0);
                setChangeGiven(0);
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
                    UGX {(bill.balance || bill.totalAmount || 0).toLocaleString()}
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
                    UGX {(selectedBill.balance || selectedBill.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  <p className="font-medium mb-1">Type: {selectedBill.type?.toUpperCase() || 'N/A'}</p>
                  <p>Total: UGX {(selectedBill.totalAmount || 0).toLocaleString()} | Paid: UGX {(selectedBill.paidAmount || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Invoice Items */}
              {billItems.length > 0 && (
                <div className="mb-4 flex-shrink-0">
                  <h3 className="text-sm font-semibold mb-2">Invoice Items</h3>
                  {hasZeroPriceItems && (
                    <div className="p-2 mb-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">Some items have no price. Click "Set price" or remove them before payment.</p>
                    </div>
                  )}
                  <div className="border rounded-lg divide-y max-h-36 overflow-y-auto">
                    {billItems.map((item) => {
                      const isZeroPrice = !item.unitPrice || Number(item.unitPrice) <= 0;
                      const isEditing = editingItemId === item.id;
                      return (
                        <div key={item.id} className={`p-2 flex justify-between items-center text-sm ${isZeroPrice ? 'bg-red-50' : ''}`}>
                          <span className={`flex-1 ${isZeroPrice ? 'text-red-700' : 'text-gray-700'}`}>
                            {item.description} x{item.quantity}
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-right text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editingPrice > 0) {
                                    updatePriceMutation.mutate({ invoiceId: selectedBill.id, itemId: item.id, unitPrice: editingPrice });
                                  } else if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => editingPrice > 0 && updatePriceMutation.mutate({ invoiceId: selectedBill.id, itemId: item.id, unitPrice: editingPrice })}
                                disabled={editingPrice <= 0 || updatePriceMutation.isPending}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >✓</button>
                              <button onClick={() => setEditingItemId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${isZeroPrice ? 'text-red-600 cursor-pointer underline decoration-dashed' : ''}`}
                                onClick={isZeroPrice ? () => { setEditingItemId(item.id); setEditingPrice(Number(item.unitPrice) || 0); } : undefined}
                                title={isZeroPrice ? 'Click to set price' : undefined}
                              >
                                {isZeroPrice ? 'Set price' : formatCurrency(Number(item.totalPrice || item.unitPrice * item.quantity))}
                              </span>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove "${item.description}" from this invoice?`)) {
                                    removeItemMutation.mutate({ invoiceId: selectedBill.id, itemId: item.id });
                                  }
                                }}
                                disabled={removeItemMutation.isPending}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                      placeholder={(selectedBill.balance || selectedBill.totalAmount || 0).toString()}
                      className="input pl-12 py-2 text-lg font-medium"
                    />
                  </div>
                  {/* Quick amount buttons */}
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setAmountReceived((selectedBill.balance || selectedBill.totalAmount || 0).toString())}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Full Amount
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountReceived(((selectedBill.balance || selectedBill.totalAmount || 0) / 2).toString())}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      50%
                    </button>
                  </div>
                </div>

                {paymentMethod === 'mobile_money' && (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Send STK Push to phone
                      </p>
                      {momoStatus !== 'idle' && (
                        <button
                          type="button"
                          onClick={resetMomo}
                          className="text-xs text-gray-600 underline"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={momoProvider}
                        onChange={(e) => setMomoProvider(e.target.value as any)}
                        disabled={momoStatus === 'pending'}
                        className="input py-2 text-sm"
                      >
                        <option value="mtn-momo">MTN MoMo</option>
                        <option value="airtel-money">Airtel Money</option>
                      </select>
                      <input
                        type="tel"
                        value={momoMsisdn}
                        onChange={(e) => setMomoMsisdn(e.target.value)}
                        placeholder="0772XXXXXX or 256772..."
                        disabled={momoStatus === 'pending'}
                        className="input py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={startStkPush}
                      disabled={momoStatus === 'pending'}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {momoStatus === 'pending' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for customer...
                        </>
                      ) : momoStatus === 'success' ? (
                        '✓ Payment confirmed — record below'
                      ) : (
                        'Send Payment Request'
                      )}
                    </button>
                    {momoMessage && (
                      <p
                        className={`text-xs ${
                          momoStatus === 'success'
                            ? 'text-green-700'
                            : momoStatus === 'failed'
                              ? 'text-red-700'
                              : 'text-gray-700'
                        }`}
                      >
                        {momoMessage}
                      </p>
                    )}
                    {momoTxnId && (
                      <p className="text-[10px] text-gray-500 font-mono break-all">
                        ref: {momoTxnId}
                      </p>
                    )}
                  </div>
                )}

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

                {/* Partial Payment Warning */}
                {amountReceived && parseFloat(amountReceived) > 0 && parseFloat(amountReceived) < (selectedBill.balance || selectedBill.totalAmount || 0) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      <span className="font-medium">Partial Payment:</span> Remaining balance will be{' '}
                      <span className="font-bold">
                        UGX {((selectedBill.balance || selectedBill.totalAmount || 0) - parseFloat(amountReceived)).toLocaleString()}
                      </span>
                    </p>
                  </div>
                )}

                {/* Change Due (for overpayment in cash) */}
                {paymentMethod === 'cash' && parseFloat(amountReceived) > (selectedBill.balance || selectedBill.totalAmount || 0) && (
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
                disabled={!amountReceived || parseFloat(amountReceived) <= 0 || hasZeroPriceItems || paymentMutation.isPending}
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
