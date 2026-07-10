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
    
    // We keep track of serverSaleId in memory in case we successfully create the sale 
    // but fail to complete it. We also load it from the DB if a previous attempt partially succeeded.
    let currentServerSaleId = sale.serverSaleId;

    while (attempt < MAX_TRANSIENT_RETRIES) {
      try {
        // STEP 1: Create the sale (if not already created)
        if (!currentServerSaleId) {
          const createRes = await api.post('/pharmacy/sales', {
            ...sale.payload,
            saleChannel: 'retail_pos',
          });
          currentServerSaleId = createRes.data?.id;
          
          if (currentServerSaleId) {
            // Persist the partial state so we don't recreate the sale if the complete call fails
            await offlineDb.pendingSales.update(sale.clientSaleId, { 
              serverSaleId: currentServerSaleId 
            });
          }
        }

        // STEP 2: Complete the sale
        if (currentServerSaleId) {
          await api.post(`/pharmacy/sales/${currentServerSaleId}/complete`, {
            amountPaid: sale.payload.amountPaid,
            paymentMethod: sale.payload.paymentMethod,
          });
        } else {
          throw new Error('Failed to obtain serverSaleId during sync');
        }

        // STEP 3: Mark as fully synced
        await offlineDb.pendingSales.update(sale.clientSaleId, { status: 'synced' });
        synced++;
        onProgress?.(synced, pending.length);
        succeeded = true;
        break; // Break out of the retry loop on success

      } catch (err: unknown) {
        attempt++;
        const res = (err as any)?.response;

        // If the backend returns 409 Conflict or 200 indicating idempotency for the FIRST step,
        // extract the ID and let the loop retry the SECOND step.
        if (!currentServerSaleId && (res?.status === 200 || res?.status === 409) && res?.data?.id) {
          currentServerSaleId = res.data.id;
          await offlineDb.pendingSales.update(sale.clientSaleId, { 
            serverSaleId: currentServerSaleId 
          });
          // Continue to next attempt iteration without backing off, so we immediately try completing it
          continue;
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
          break; // Break out of the retry loop, permanent failure
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
