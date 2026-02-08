import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Printer,
  Search,
  Download,
  Eye,
  ArrowLeft,
  Receipt,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { billingService } from '../services/billing';

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

export default function PrintReceiptPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: paymentsData, isLoading, error } = useQuery({
    queryKey: ['payments', dateFilter],
    queryFn: () => billingService.payments.list({ startDate: dateFilter, endDate: dateFilter }),
  });

  // Transform API payments to receipt format
  const receipts: PaymentReceipt[] = (paymentsData || []).map((payment: any) => ({
    id: payment.id,
    receiptNumber: payment.receiptNumber || `REC-${payment.id.slice(0, 8).toUpperCase()}`,
    billNumber: payment.invoiceNumber || payment.invoice?.invoiceNumber || 'N/A',
    patientName: payment.patientName || payment.invoice?.patient?.fullName || 'Unknown',
    patientMrn: payment.invoice?.patient?.mrn || 'N/A',
    amount: payment.amount || 0,
    paymentMethod: payment.method || payment.paymentMethod || 'Cash',
    date: new Date(payment.createdAt || payment.paymentDate).toLocaleDateString(),
    time: new Date(payment.createdAt || payment.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cashier: payment.receivedBy || 'System',
    services: payment.invoice?.items?.map((item: any) => ({
      name: item.description || item.serviceName,
      amount: item.amount || item.totalAmount || 0,
    })) || [],
  }));

  const filteredReceipts = receipts.filter(
    (receipt) =>
      receipt.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.patientMrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrint = () => {
    if (!selectedReceipt) return;
    
    const receiptContent = document.getElementById('receipt-content');
    if (!receiptContent) return;
    
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${selectedReceipt.receiptNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              padding: 10px;
              width: 80mm;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .mb-2 { margin-bottom: 8px; }
            .mb-3 { margin-bottom: 12px; }
            .text-xs { font-size: 10px; }
            .text-sm { font-size: 11px; }
            .flex { display: flex; justify-content: space-between; }
            .border-dashed { border-top: 1px dashed #000; margin: 8px 0; }
            .capitalize { text-transform: capitalize; }
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { padding: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="text-center mb-3">
            <div class="font-bold" style="font-size: 14px;">GLIDE HIMS HOSPITAL</div>
            <div class="text-xs">123 Hospital Road, City</div>
            <div class="text-xs">Tel: +256 700 000 000</div>
            <div class="text-xs">TIN: 1234567890</div>
          </div>
          
          <div class="border-dashed"></div>
          <div class="text-center font-bold mb-2">PAYMENT RECEIPT</div>
          <div class="border-dashed"></div>
          
          <div class="mb-2">
            <div class="flex"><span>Receipt No:</span><span class="font-bold">${selectedReceipt.receiptNumber}</span></div>
            <div class="flex"><span>Invoice No:</span><span>${selectedReceipt.billNumber}</span></div>
            <div class="flex"><span>Date:</span><span>${selectedReceipt.date} ${selectedReceipt.time}</span></div>
          </div>
          
          <div class="border-dashed"></div>
          
          <div class="mb-2">
            <div class="flex"><span>Patient:</span><span class="font-bold">${selectedReceipt.patientName}</span></div>
            <div class="flex"><span>MRN:</span><span>${selectedReceipt.patientMrn}</span></div>
          </div>
          
          <div class="border-dashed"></div>
          
          ${selectedReceipt.services.length > 0 ? `
            <div class="mb-2">
              <div class="font-bold text-xs">Services:</div>
              ${selectedReceipt.services.map(s => `
                <div class="flex text-xs">
                  <span>${s.name}</span>
                  <span>${s.amount.toLocaleString()}</span>
                </div>
              `).join('')}
            </div>
            <div class="border-dashed"></div>
          ` : ''}
          
          <div class="mb-2">
            <div class="flex font-bold">
              <span>TOTAL PAID:</span>
              <span>UGX ${selectedReceipt.amount.toLocaleString()}</span>
            </div>
            <div class="flex text-xs">
              <span>Payment Method:</span>
              <span class="capitalize">${selectedReceipt.paymentMethod.replace('_', ' ')}</span>
            </div>
          </div>
          
          <div class="border-dashed"></div>
          
          <div class="text-center text-xs">
            <div>Cashier: ${selectedReceipt.cashier}</div>
            <div class="font-bold" style="margin-top: 8px;">Thank you for choosing us!</div>
            <div style="font-size: 9px; margin-top: 4px;">Get well soon • Computer generated receipt</div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownload = () => {
    if (!selectedReceipt) return;
    
    const receiptText = `
=======================================
        GLIDE HIMS HOSPITAL
       123 Hospital Road, City
       Tel: +256 700 000 000
           TIN: 1234567890
=======================================
          PAYMENT RECEIPT
=======================================

Receipt No:    ${selectedReceipt.receiptNumber}
Invoice No:    ${selectedReceipt.billNumber}
Date:          ${selectedReceipt.date} ${selectedReceipt.time}

---------------------------------------
Patient:       ${selectedReceipt.patientName}
MRN:           ${selectedReceipt.patientMrn}
---------------------------------------

${selectedReceipt.services.length > 0 ? `Services:
${selectedReceipt.services.map(s => `  ${s.name.padEnd(25)} ${s.amount.toLocaleString().padStart(10)}`).join('\n')}
---------------------------------------
` : ''}
TOTAL PAID:    UGX ${selectedReceipt.amount.toLocaleString()}
Payment Method: ${selectedReceipt.paymentMethod.replace('_', ' ')}

---------------------------------------
Cashier: ${selectedReceipt.cashier}

    Thank you for choosing us!
       Get well soon

  Computer generated receipt
=======================================
    `.trim();
    
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${selectedReceipt.receiptNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Failed to load receipts</p>
                </div>
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No receipts found for this date</p>
                  <p className="text-xs mt-1">Try selecting a different date</p>
                </div>
              </div>
            ) : filteredReceipts.map((receipt) => (
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
                <div id="receipt-content" className="print-receipt max-w-md mx-auto bg-white border-2 border-dashed border-gray-300 p-6 print:border-none print:max-w-none print:p-4">
                  {/* Header */}
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-bold">GLIDE HIMS HOSPITAL</h2>
                    <p className="text-xs text-gray-600">123 Hospital Road, City</p>
                    <p className="text-xs text-gray-600">Tel: +256 700 000 000</p>
                    <p className="text-xs text-gray-600">TIN: 1234567890</p>
                  </div>

                  <div className="border-t border-b border-black py-1 mb-3">
                    <p className="text-center text-sm font-bold">PAYMENT RECEIPT</p>
                  </div>

                  {/* Receipt Details */}
                  <div className="space-y-1 text-xs mb-3">
                    <div className="flex justify-between">
                      <span>Receipt No:</span>
                      <span className="font-mono font-bold">{selectedReceipt.receiptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invoice No:</span>
                      <span className="font-mono">{selectedReceipt.billNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date:</span>
                      <span>{selectedReceipt.date} {selectedReceipt.time}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed my-2"></div>

                  {/* Patient Info */}
                  <div className="mb-3 text-xs">
                    <div className="flex justify-between">
                      <span>Patient:</span>
                      <span className="font-medium">{selectedReceipt.patientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>MRN:</span>
                      <span>{selectedReceipt.patientMrn}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed my-2"></div>

                  {/* Services */}
                  {selectedReceipt.services.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium mb-1">Services:</p>
                      <div className="space-y-1">
                        {selectedReceipt.services.map((service, idx) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="flex-1 truncate pr-2">{service.name}</span>
                            <span className="whitespace-nowrap">{service.amount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-dashed my-2"></div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm font-bold">
                      <span>TOTAL PAID:</span>
                      <span>UGX {selectedReceipt.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>Payment Method:</span>
                      <span className="capitalize">{selectedReceipt.paymentMethod.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="border-t border-dashed my-2"></div>

                  {/* Footer */}
                  <div className="text-center text-xs text-gray-600">
                    <p>Cashier: {selectedReceipt.cashier}</p>
                    <p className="mt-2 font-medium">Thank you for choosing us!</p>
                    <p className="text-[10px] mt-1">Get well soon • This receipt is computer generated</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4 flex-shrink-0 print:hidden">
                <button 
                  onClick={handleDownload}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
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
