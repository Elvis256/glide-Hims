import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Search,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Receipt,
  UserCircle,
} from 'lucide-react';

interface RefundRequest {
  id: string;
  originalReceipt: string;
  billNumber: string;
  patientName: string;
  patientMrn: string;
  originalAmount: number;
  refundAmount: number;
  reason: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  requestDate: string;
  processedDate?: string;
}

// Mock data
const mockRefunds: RefundRequest[] = [
  { id: '1', originalReceipt: 'REC-12345676', billNumber: 'BILL-12345676', patientName: 'Grace Atim', patientMrn: 'MRN-2024-0003', originalAmount: 50000, refundAmount: 15000, reason: 'Cancelled lab test', status: 'pending', requestDate: '2025-01-25' },
  { id: '2', originalReceipt: 'REC-12345675', billNumber: 'BILL-12345675', patientName: 'Peter Ochen', patientMrn: 'MRN-2024-0004', originalAmount: 35000, refundAmount: 35000, reason: 'Duplicate payment', status: 'approved', requestDate: '2025-01-24' },
  { id: '3', originalReceipt: 'REC-12345674', billNumber: 'BILL-12345674', patientName: 'Mary Apio', patientMrn: 'MRN-2024-0005', originalAmount: 25000, refundAmount: 10000, reason: 'Service not rendered', status: 'processed', requestDate: '2025-01-23', processedDate: '2025-01-24' },
];

const refundReasons = [
  'Duplicate payment',
  'Service not rendered',
  'Cancelled procedure',
  'Billing error',
  'Patient request',
  'Other',
];

export default function RefundsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewRefund, setShowNewRefund] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredRefunds = mockRefunds.filter(
    (refund) =>
      refund.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.originalReceipt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refund.patientMrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      processed: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleSubmitRefund = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setShowNewRefund(false);
      setReceiptSearch('');
      setRefundAmount('');
      setRefundReason('');
    }, 2000);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <RotateCcw className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Refunds</h1>
              <p className="text-gray-500 text-sm">Process and track payment refunds</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowNewRefund(true)}
          className="btn-primary"
        >
          New Refund
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Refund Requests List */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <div className="relative mb-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt, patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredRefunds.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No refund requests</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRefunds.map((refund) => (
                  <div key={refund.id} className="p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-blue-600">{refund.originalReceipt}</span>
                        {getStatusBadge(refund.status)}
                      </div>
                      <span className="font-bold text-red-600">
                        -UGX {refund.refundAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{refund.patientName}</p>
                        <p className="text-xs text-gray-500">{refund.patientMrn}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <p>Requested: {refund.requestDate}</p>
                        {refund.processedDate && <p>Processed: {refund.processedDate}</p>}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 ml-11">{refund.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: New Refund Form or Stats */}
        <div className="card p-4 flex flex-col min-h-0">
          {showSuccess ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Refund Submitted!</h3>
                <p className="text-gray-500 text-sm">Awaiting approval</p>
              </div>
            </div>
          ) : showNewRefund ? (
            <>
              <h2 className="text-sm font-semibold mb-3 flex-shrink-0">New Refund Request</h2>
              <div className="flex-1 overflow-y-auto space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Original Receipt Number
                  </label>
                  <input
                    type="text"
                    value={receiptSearch}
                    onChange={(e) => setReceiptSearch(e.target.value)}
                    placeholder="REC-XXXXXXXX"
                    className="input py-2 font-mono"
                  />
                </div>

                {receiptSearch && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-500">Patient:</span>
                      <span className="text-sm font-medium">Sarah Nakimera</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Original Amount:</span>
                      <span className="text-sm font-medium">UGX 25,000</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Refund Amount (UGX)
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="input py-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Reason for Refund
                  </label>
                  <select
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="input py-2"
                  >
                    <option value="">Select reason...</option>
                    {refundReasons.map((reason) => (
                      <option key={reason} value={reason}>{reason}</option>
                    ))}
                  </select>
                </div>

                {refundReason === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Specify Reason
                    </label>
                    <textarea
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="input py-2 h-20 resize-none"
                    />
                  </div>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700">
                    Refund requests require approval from a supervisor before processing.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-4 flex-shrink-0">
                <button
                  onClick={() => setShowNewRefund(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRefund}
                  disabled={!receiptSearch || !refundAmount || !refundReason}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold mb-4 flex-shrink-0">Refund Summary</h2>
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-yellow-700">1</p>
                  <p className="text-xs text-yellow-600">Pending Approval</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">1</p>
                  <p className="text-xs text-blue-600">Approved</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">1</p>
                  <p className="text-xs text-green-600">Processed Today</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-bold text-gray-700">UGX 60,000</p>
                  <p className="text-xs text-gray-600">Total Refunded (Month)</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
