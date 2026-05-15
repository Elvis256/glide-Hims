import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Printer,
  Calendar,
  User,
  Eye,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
import { printService } from '../../lib/print';

interface SaleHistory {
  id: string;
  saleNumber: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
  soldBy?: { name?: string; firstName?: string; lastName?: string };
  reprintCount: number;
  status: string;
}

function getUserName(u?: { name?: string; firstName?: string; lastName?: string }): string {
  if (!u) return 'Unknown';
  if (u.name) return u.name;
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unknown';
}

export default function POSReceiptHistoryPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [saleNumber, setSaleNumber] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleHistory | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const historyQuery = useQuery({
    queryKey: ['receipt-history', from, to, saleNumber],
    queryFn: async () => {
      const res = await api.get('/pharmacy/receipts/history', {
        params: { from: from || undefined, to: to || undefined, saleNumber: saleNumber || undefined },
      });
      return asList(res.data) as SaleHistory[];
    },
  });

  async function loadReceipt(sale: SaleHistory, duplicate: boolean) {
    setLoadingReceipt(true);
    try {
      const res = await api.get(`/pharmacy/sales/${sale.id}/receipt`, {
        params: { duplicate: duplicate.toString() },
      });
      setReceiptData({ ...res.data, requestedSale: sale, isDuplicate: duplicate });
      setSelectedSale(sale);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to load receipt'));
    } finally {
      setLoadingReceipt(false);
    }
  }

  const receiptRef = useRef<HTMLDivElement>(null);
  function printReceipt() {
    if (receiptRef.current) {
      printService.printElement(receiptRef.current, {
        title: receiptData?.sale?.saleNumber || 'Receipt',
        preset: 'receipt',
      });
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">Receipt History</h1>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="date"
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Receipt Number</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search receipt..."
              value={saleNumber}
              onChange={(e) => setSaleNumber(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 print:shadow-none">
            <div ref={receiptRef} className="space-y-4">
            {receiptData.isDuplicate && (
              <div className="text-center py-2 border-4 border-red-500 text-red-500 font-bold text-xl tracking-widest">
                *** DUPLICATE ***
              </div>
            )}
            <div className="text-center">
              <p className="font-bold text-lg">{receiptData.sale?.saleNumber}</p>
              <p className="text-sm text-gray-500">
                {receiptData.sale?.createdAt
                  ? new Date(receiptData.sale.createdAt).toLocaleString()
                  : ''}
              </p>
            </div>
            {receiptData.sale?.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.itemName} × {item.quantity}</span>
                <span>{formatCurrency(item.grossAmount || item.amount)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{formatCurrency(receiptData.sale?.totalAmount)}</span>
            </div>
            {receiptData.reprintCount > 0 && (
              <p className="text-xs text-gray-500 text-center">Reprint #{receiptData.reprintCount}</p>
            )}
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                className="flex-1 flex items-center justify-center gap-2 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                onClick={printReceipt}
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                className="flex-1 border rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => { setReceiptData(null); setSelectedSale(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600">Receipt #</th>
                <th className="px-4 py-3 text-left text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left text-gray-600">Cashier</th>
                <th className="px-4 py-3 text-left text-gray-600">Date</th>
                <th className="px-4 py-3 text-right text-gray-600">Amount</th>
                <th className="px-4 py-3 text-center text-gray-600">Reprints</th>
                <th className="px-4 py-3 text-center text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {historyQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {historyQuery.data?.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-blue-700">{sale.saleNumber}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {sale.customerName || sale.customerPhone || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {getUserName(sale.soldBy)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(sale.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatCurrency(sale.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sale.reprintCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                        <Copy className="h-3 w-3" />
                        {sale.reprintCount}×
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs"
                        onClick={() => loadReceipt(sale, false)}
                        disabled={loadingReceipt}
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </button>
                      <button
                        className="flex items-center gap-1 text-amber-600 hover:underline text-xs"
                        onClick={() => loadReceipt(sale, true)}
                        disabled={loadingReceipt}
                      >
                        <Printer className="h-3 w-3" />
                        Reprint
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!historyQuery.isLoading && historyQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No receipts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
