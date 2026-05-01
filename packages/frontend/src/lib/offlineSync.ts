/**
 * Phase D2 — Offline sale sync worker.
 * Drains pendingSales one at a time when online, with exponential backoff on transient errors.
 */
import { offlineDb, type PendingSale } from '../lib/offlineDb';
import { api } from '../services/api';

export type SyncProgressCallback = (synced: number, total: number) => void;

const MAX_TRANSIENT_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

function isTransientError(err: unknown): boolean {
  const status = (err as any)?.response?.status;
  // Network errors, 5xx = transient; 4xx = permanent
  if (!status) return true; // network error
  return status >= 500;
}

function isPriceConflict(data: unknown): boolean {
  const msg = String((data as any)?.message || '');
  return msg.toLowerCase().includes('price') && msg.toLowerCase().includes('changed');
}

export async function syncPendingSales(onProgress?: SyncProgressCallback): Promise<void> {
  if (!navigator.onLine) return;

  const pending = await offlineDb.pendingSales
    .where('status')
    .anyOf(['pending', 'syncing'])
    .toArray();

  if (pending.length === 0) return;

  let synced = 0;
  onProgress?.(0, pending.length);

  for (const sale of pending) {
    if (!navigator.onLine) break;

    await offlineDb.pendingSales.update(sale.clientSaleId, { status: 'syncing' });

    let attempt = 0;
    let succeeded = false;

    while (attempt < MAX_TRANSIENT_RETRIES) {
      try {
        // POST with clientSaleId for idempotency
        const createRes = await api.post('/pharmacy/sales', {
          ...sale.payload,
          saleChannel: 'retail_pos',
        });
        const created = createRes.data as { id: string; saleNumber: string };

        // Complete the sale
        await api.post(`/pharmacy/sales/${created.id}/complete`, {
          amountPaid: sale.payload.amountPaid,
          paymentMethod: sale.payload.paymentMethod,
        });

        await offlineDb.pendingSales.update(sale.clientSaleId, { status: 'synced' });
        synced++;
        onProgress?.(synced, pending.length);
        succeeded = true;
        break;
      } catch (err: unknown) {
        attempt++;
        const res = (err as any)?.response;

        // Idempotent: already synced
        if (res?.status === 200 && res?.data?.id) {
          await offlineDb.pendingSales.update(sale.clientSaleId, { status: 'synced' });
          synced++;
          onProgress?.(synced, pending.length);
          succeeded = true;
          break;
        }

        // Permanent conflict — move to error queue
        if (!isTransientError(err)) {
          const reason =
            (res?.data as any)?.message ||
            (isPriceConflict(res?.data) ? 'Price changed by >20%' : 'Server rejected sale');
          await offlineDb.pendingSales.update(sale.clientSaleId, {
            status: 'error',
            errorReason: reason,
            attempts: (sale.attempts || 0) + attempt,
          });
          await offlineDb.syncErrors.put({
            clientSaleId: sale.clientSaleId,
            payload: sale.payload,
            errorReason: reason,
            occurredAt: new Date().toISOString(),
            discarded: false,
          });
          break;
        }

        // Transient — exponential backoff
        if (attempt < MAX_TRANSIENT_RETRIES) {
          await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS * 2 ** (attempt - 1)));
        }
      }
    }

    if (!succeeded && attempt >= MAX_TRANSIENT_RETRIES) {
      await offlineDb.pendingSales.update(sale.clientSaleId, {
        status: 'error',
        errorReason: 'Max retries exceeded',
        attempts: (sale.attempts || 0) + attempt,
      });
      await offlineDb.syncErrors.put({
        clientSaleId: sale.clientSaleId,
        payload: sale.payload,
        errorReason: 'Max retries exceeded after transient failures',
        occurredAt: new Date().toISOString(),
        discarded: false,
      });
    }
  }
}
