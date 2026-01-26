import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Printer,
  Search,
  Download,
  Eye,
  ArrowLeft,
  Receipt,
  Calendar,
} from 'lucide-react';

interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  billNumber: string;
  patientName: string;
  patientMrn: string;
  amount: number;
  paymentMethod: string;
  date: string;
  time: string;
  cashier: string;
  services: { name: string; amount: number }[];
}

// Mock data
const mockReceipts: PaymentReceipt[] = [
  {
    id: '1',
    receiptNumber: 'REC-12345678',
    billNumber: 'BILL-12345678',
    patientName: 'Sarah Nakimera',
    patientMrn: 'MRN-2024-0001',
    amount: 25000,
    paymentMethod: 'Cash',
    date: '2025-01-25',
    time: '09:30',
    cashier: 'Jane Doe',
    services: [
      { name: 'Consultation - General', amount: 5000 },
      { name: 'Lab - Blood Test', amount: 8000 },
      { name: 'Lab - Urinalysis', amount: 4000 },
      { name: 'Registration Fee', amount: 2000 },
      { name: 'Dressing', amount: 6000 },
    ],
  },
  {
    id: '2',
    receiptNumber: 'REC-12345679',
    billNumber: 'BILL-12345679',
    patientName: 'James Okello',
    patientMrn: 'MRN-2024-0002',
    amount: 50000,
    paymentMethod: 'Mobile Money',
    date: '2025-01-25',
    time: '10:15',
    cashier: 'Jane Doe',
    services: [
      { name: 'Consultation - Specialist', amount: 15000 },
      { name: 'X-Ray', amount: 25000 },
      { name: 'Dressing', amount: 10000 },
    ],
  },
];

export default function PrintReceiptPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  const filteredReceipts = mockReceipts.filter(
    (receipt) =>
      receipt.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.patientMrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg print:hidden">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Printer className="w-6 h-6 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Print Receipt</h1>
            <p className="text-gray-500 text-sm print:hidden">View and print payment receipts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden print:block">
        {/* Left: Receipt List */}
        <div className="card p-4 flex flex-col min-h-0 print:hidden">
          <div className="flex gap-3 mb-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by receipt, patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 py-2 text-sm"
              />
            </div>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input py-2 text-sm w-36"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredReceipts.map((receipt) => (
              <button
                key={receipt.id}
                onClick={() => setSelectedReceipt(receipt)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  selectedReceipt?.id === receipt.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-medium text-green-600">
                    {receipt.receiptNumber}
                  </span>
                  <span className="font-bold text-gray-900">
                    UGX {receipt.amount.toLocaleString()}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{receipt.patientName}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{receipt.date}</span>
                  <span>•</span>
                  <span>{receipt.time}</span>
                  <span>•</span>
                  <span>{receipt.paymentMethod}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Receipt Preview */}
        <div className="card p-4 flex flex-col min-h-0 print:shadow-none print:p-0">
          {!selectedReceipt ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 print:hidden">
              <div className="text-center">
                <Receipt className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a receipt to preview</p>
              </div>
            </div>
          ) : (
            <>
              {/* Receipt Preview */}
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-md mx-auto bg-white border-2 border-dashed border-gray-300 p-6 print:border-none print:max-w-none">
                  {/* Header */}
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold">Glide HIMS Hospital</h2>
                    <p className="text-sm text-gray-500">123 Hospital Road, City</p>
                    <p className="text-sm text-gray-500">Tel: +256 700 000 000</p>
                  </div>

                  <div className="border-t border-b border-dashed py-2 mb-4">
                    <p className="text-center font-bold">PAYMENT RECEIPT</p>
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Receipt No:</span>
                      <span className="font-mono font-bold">{selectedReceipt.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bill No:</span>
                      <span className="font-mono">{selectedReceipt.billNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span>{selectedReceipt.date} {selectedReceipt.time}</span>
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="bg-gray-50 rounded p-3 mb-4 print:bg-transparent print:border">
                    <p className="font-medium">{selectedReceipt.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedReceipt.patientMrn}</p>
                  </div>

                  {/* Services */}
                  <div className="mb-4">
                    <p className="font-medium text-sm mb-2">Services:</p>
                    <div className="space-y-1">
                      {selectedReceipt.services.map((service, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{service.name}</span>
                          <span>UGX {service.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t border-dashed pt-2 mb-4">
                    <div className="flex justify-between font-bold">
                      <span>TOTAL PAID</span>
                      <span>UGX {selectedReceipt.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mt-1">
                      <span>Payment Method:</span>
                      <span>{selectedReceipt.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-center text-xs text-gray-400 border-t border-dashed pt-4">
                    <p>Served by: {selectedReceipt.cashier}</p>
                    <p className="mt-2">Thank you for choosing us!</p>
                    <p>Get well soon</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4 flex-shrink-0 print:hidden">
                <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handlePrint}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
