import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  RotateCcw,
  ChevronRight,
  Package,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Sale {
  id: string;
  saleNumber: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  createdAt: string;
  items: SaleItem[];
  status: string;
}

interface SaleItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  grossAmount: number;
  batchNumber?: string;
}

interface ReturnLine {
  saleItemId: string;
  qtyReturned: number;
  restockable: boolean;
}

interface ExistingReturn {
  items: Array<{ originalSaleItemId: string; qtyReturned: number }>;
  status: string;
}

export default function POSReturnsPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnLines, setReturnLines] = useState<Record<string, ReturnLine>>({});
  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [managerPin, setManagerPin] = useState('');
  const [step, setStep] = useState<'search' | 'items' | 'confirm' | 'done'>('search');
  const [completedReturn, setCompletedReturn] = useState<any>(null);

  // Search sales
  const salesQuery = useQuery({
    queryKey: ['pos-sales-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 3) return [];
      const res = await api.get('/pharmacy/sales', {
        params: { search: searchTerm, limit: 20, status: 'completed' },
      });
      return asList(res.data);
    },
    enabled: searchTerm.length >= 3,
  });

  // Existing returns for selected sale
  const returnsQuery = useQuery({
    queryKey: ['pos-returns-by-sale', selectedSale?.id],
    queryFn: async () => {
      const res = await api.get('/pos/returns', { params: { saleId: selectedSale!.id } });
      return asList(res.data) as ExistingReturn[];
    },
    enabled: !!selectedSale,
  });

  function getReturnedQty(saleItemId: string): number {
    if (!returnsQuery.data) return 0;
    return returnsQuery.data
      .filter((r) => r.status !== 'voided')
      .flatMap((r) => r.items)
      .filter((i) => i.originalSaleItemId === saleItemId)
      .reduce((sum, i) => sum + i.qtyReturned, 0);
  }

  function getReturnableQty(item: SaleItem): number {
    return item.quantity - getReturnedQty(item.id);
  }

  function initReturnLines(sale: Sale) {
    const lines: Record<string, ReturnLine> = {};
    for (const item of sale.items) {
      const returnable = item.quantity - getReturnedQty(item.id);
      if (returnable > 0) {
        lines[item.id] = {
          saleItemId: item.id,
          qtyReturned: 0,
          restockable: true,
        };
      }
    }
    setReturnLines(lines);
  }

  const returnMutation = useMutation({
    mutationFn: async () => {
      const items = Object.values(returnLines).filter((l) => l.qtyReturned > 0);
      if (items.length === 0) throw new Error('Select at least one item to return');
      if (!reason.trim()) throw new Error('Reason is required');
      const res = await api.post('/pos/returns', {
        originalSaleId: selectedSale!.id,
        reason,
        paymentMethod,
        items,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setCompletedReturn(data);
      setStep('done');
      qc.invalidateQueries({ queryKey: ['pos-returns-by-sale'] });
      toast.success('Return processed successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to process return')),
  });

  const totalRefund = selectedSale
    ? Object.values(returnLines).reduce((sum, line) => {
        if (line.qtyReturned <= 0) return sum;
        const item = selectedSale.items.find((i) => i.id === line.saleItemId);
        if (!item) return sum;
        return sum + (Number(item.grossAmount) / item.quantity) * line.qtyReturned;
      }, 0)
    : 0;

  if (step === 'done' && completedReturn) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-800">Return Processed</h2>
          <p className="text-green-600 mt-2">Return #{completedReturn.returnNumber}</p>
          <p className="text-3xl font-bold text-green-700 mt-4">
            Refund: {formatCurrency(completedReturn.totalRefund)}
          </p>
          <p className="text-sm text-green-600 mt-1">via {completedReturn.paymentMethod}</p>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 font-semibold text-gray-700">
            <Package className="h-4 w-4" />
            Return Items
          </div>
          {completedReturn.items?.map((item: any) => (
            <div key={item.id} className="flex justify-between text-sm py-1 border-b">
              <span>{item.itemId} × {item.qtyReturned}</span>
              <span>{formatCurrency(item.grossAmount)}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 text-center bg-yellow-50 border border-yellow-200 rounded p-2">
          ⚠️ EFRIS Credit Note queued — fiscal reference will update when URA responds
        </div>
        <div className="flex gap-3">
          <button
            className="flex-1 flex items-center justify-center gap-2 border rounded-lg px-4 py-2 hover:bg-gray-50"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print Credit Note
          </button>
          <button
            className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700"
            onClick={() => {
              setStep('search');
              setSelectedSale(null);
              setReturnLines({});
              setReason('');
              setCompletedReturn(null);
            }}
          >
            New Return
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <RotateCcw className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-800">Returns / Refunds</h1>
      </div>

      {/* Step 1: Search original sale */}
      {step === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by receipt number, customer name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {salesQuery.isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}

          {salesQuery.data && salesQuery.data.length === 0 && searchTerm.length >= 3 && (
            <p className="text-center text-gray-500 py-4">No completed sales found</p>
          )}

          <div className="space-y-2">
            {salesQuery.data?.map((sale: Sale) => (
              <button
                key={sale.id}
                className="w-full text-left bg-white border rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition"
                onClick={() => {
                  setSelectedSale(sale);
                  initReturnLines(sale);
                  setStep('items');
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">{sale.saleNumber}</p>
                    {sale.customerName && <p className="text-sm text-gray-600">{sale.customerName}</p>}
                    {sale.customerPhone && (
                      <p className="text-sm text-gray-500">{sale.customerPhone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{formatCurrency(sale.totalAmount)}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(sale.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 mt-1" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select return lines */}
      {step === 'items' && selectedSale && (
        <div className="space-y-4">
          <button
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            onClick={() => { setStep('search'); setSelectedSale(null); }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-semibold">{selectedSale.saleNumber}</p>
            <p className="text-sm text-blue-600">{formatCurrency(selectedSale.totalAmount)}</p>
          </div>

          <div className="space-y-3">
            {selectedSale.items.map((item) => {
              const returnableQty = getReturnableQty(item);
              const line = returnLines[item.id];
              if (!line) return null;
              return (
                <div key={item.id} className="bg-white border rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.itemName}</p>
                      <p className="text-sm text-gray-500">
                        Sold: {item.quantity} | Returnable: {returnableQty}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice)} each</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600">Return qty:</label>
                    <input
                      type="number"
                      min={0}
                      max={returnableQty}
                      value={line.qtyReturned}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(returnableQty, parseInt(e.target.value) || 0));
                        setReturnLines((prev) => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], qtyReturned: v },
                        }));
                      }}
                      className="w-20 border rounded px-2 py-1 text-center"
                    />
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={line.restockable}
                        onChange={(e) =>
                          setReturnLines((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], restockable: e.target.checked },
                          }))
                        }
                      />
                      Restockable
                    </label>
                  </div>
                  {line.qtyReturned > 0 && (
                    <p className="text-sm text-green-600 mt-1">
                      Refund: {formatCurrency((Number(item.grossAmount) / item.quantity) * line.qtyReturned)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for return *
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer returned wrong medication, damaged packaging, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Refund method</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="credit">Store Credit</option>
            </select>
          </div>

          {totalRefund > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-600">Total Refund</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalRefund)}</p>
            </div>
          )}

          {returnMutation.isError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded p-3">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{getApiErrorMessage(returnMutation.error)}</span>
            </div>
          )}

          <button
            className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={
              totalRefund === 0 || !reason.trim() || returnMutation.isPending
            }
            onClick={() => returnMutation.mutate()}
          >
            {returnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Process Return — Refund {formatCurrency(totalRefund)}
          </button>
        </div>
      )}
    </div>
  );
}
