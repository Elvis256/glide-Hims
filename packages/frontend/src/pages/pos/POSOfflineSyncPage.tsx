import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { offlineDb, type PendingSale, type SyncError } from '../../lib/offlineDb';
import { syncPendingSales } from '../../lib/offlineSync';
import { formatCurrency } from '../../lib/currency';

interface SyncProgress {
  synced: number;
  total: number;
}

export default function POSOfflineSyncPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingSale[]>([]);
  const [errors, setErrors] = useState<SyncError[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [discardModal, setDiscardModal] = useState<{ clientSaleId: string } | null>(null);
  const [discardReason, setDiscardReason] = useState('');

  const loadData = useCallback(async () => {
    const p = await offlineDb.pendingSales.toArray();
    const e = await offlineDb.syncErrors.where('discarded').equals(0).toArray();
    setPending(p);
    setErrors(e);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (!navigator.onLine) {
      toast.error('You are currently offline — cannot sync');
      return;
    }
    setSyncing(true);
    setProgress(null);
    try {
      await syncPendingSales((synced, total) => setProgress({ synced, total }));
      toast.success('Sync complete');
      await loadData();
    } catch {
      toast.error('Sync failed — check errors below');
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handleRetry = async (sale: SyncError) => {
    // Move back to pending
    await offlineDb.pendingSales.put({
      clientSaleId: sale.clientSaleId,
      clientSequenceNumber: sale.payload.clientSequenceNumber,
      shiftId: sale.payload.posShiftId,
      registerId: sale.payload.posRegisterId,
      storeId: sale.payload.posShiftId,
      payload: sale.payload,
      createdAt: sale.occurredAt,
      status: 'pending',
      attempts: 0,
    });
    await offlineDb.syncErrors.delete(sale.clientSaleId);
    await loadData();
    toast.success('Moved back to pending queue — click Sync to retry');
  };

  const handleDiscard = async () => {
    if (!discardModal || !discardReason.trim()) {
      toast.error('Please enter a reason before discarding');
      return;
    }
    await offlineDb.syncErrors.update(discardModal.clientSaleId, {
      discarded: true,
      discardReason: discardReason.trim(),
      discardedAt: new Date().toISOString(),
    });
    await offlineDb.pendingSales.delete(discardModal.clientSaleId);
    setDiscardModal(null);
    setDiscardReason('');
    await loadData();
    toast.success('Sale discarded with reason logged');
  };

  const pendingCount = pending.filter((p) => p.status === 'pending' || p.status === 'syncing').length;
  const errorCount = errors.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/pharmacy/pos/sale')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to POS
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Offline Sales Review</h1>
          <p className="text-sm text-gray-500">
            Manage sales captured while offline
          </p>
        </div>
        <div className="ml-auto">
          <button
            onClick={handleSync}
            disabled={syncing || !navigator.onLine || pendingCount === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing
              ? progress
                ? `Syncing ${progress.synced}/${progress.total}...`
                : 'Syncing...'
              : `Sync Now (${pendingCount} pending)`}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
          <div className="text-xs text-gray-500 mt-1">Pending Sync</div>
        </div>
        <div className="rounded-xl bg-white border p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-red-600">{errorCount}</div>
          <div className="text-xs text-gray-500 mt-1">Sync Errors</div>
        </div>
        <div className="rounded-xl bg-white border p-4 text-center shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {pending.filter((p) => p.status === 'synced').length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Synced</div>
        </div>
      </div>

      {/* Pending sales */}
      {pending.filter((p) => p.status !== 'synced').length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Pending / Syncing
          </h2>
          <div className="space-y-2">
            {pending
              .filter((p) => p.status !== 'synced')
              .map((sale) => (
                <div
                  key={sale.clientSaleId}
                  className="rounded-xl bg-white border border-amber-200 p-4 shadow-sm flex items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">
                        #{sale.clientSequenceNumber}
                      </span>
                      <span className="font-medium text-sm text-gray-900">
                        {sale.payload.items.length} item{sale.payload.items.length !== 1 ? 's' : ''}
                      </span>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          sale.status === 'syncing'
                            ? 'bg-blue-100 text-blue-700'
                            : sale.status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(sale.createdAt).toLocaleString()} ·{' '}
                      {sale.payload.paymentMethod} · {sale.payload.items.map((i) => i.itemName).join(', ')}
                    </div>
                    {sale.errorReason && (
                      <div className="text-xs text-red-500 mt-1">{sale.errorReason}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">
                      {formatCurrency(sale.payload.amountPaid)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Error queue */}
      {errorCount > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Failed Sync — Action Required
          </h2>
          <div className="space-y-2">
            {errors.map((err) => (
              <div
                key={err.clientSaleId}
                className="rounded-xl bg-white border border-red-200 p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      {err.payload.items.length} item{err.payload.items.length !== 1 ? 's' : ''} ·{' '}
                      {formatCurrency(err.payload.amountPaid)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(err.occurredAt).toLocaleString()} · {err.payload.paymentMethod}
                    </div>
                    <div className="mt-1 rounded bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700">
                      <strong>Error:</strong> {err.errorReason}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      Items: {err.payload.items.map((i) => `${i.itemName} ×${i.quantity}`).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRetry(err)}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                  <button
                    onClick={() => setDiscardModal({ clientSaleId: err.clientSaleId })}
                    className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="h-3 w-3" />
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pendingCount === 0 && errorCount === 0 && (
        <div className="text-center py-16">
          <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">All offline sales have been synced successfully.</p>
        </div>
      )}

      {/* Discard modal */}
      {discardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900">Discard Offline Sale</h3>
            <p className="text-sm text-gray-500">
              This sale will be permanently discarded. Please provide a reason for the audit log.
            </p>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Reason for discarding (required)"
              rows={3}
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                disabled={!discardReason.trim()}
                className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Discard Sale
              </button>
              <button
                onClick={() => { setDiscardModal(null); setDiscardReason(''); }}
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
