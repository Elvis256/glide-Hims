/**
 * Phase D — Offline IndexedDB schema using Dexie.
 * Stores: pendingSales, cachedItems, syncErrors
 */
import Dexie, { type Table } from 'dexie';

export interface PendingSale {
  clientSaleId: string; // UUID v4 — primary key
  clientSequenceNumber: number;
  shiftId?: string;
  registerId?: string;
  storeId?: string;
  payload: OfflineSalePayload;
  createdAt: string; // ISO timestamp when sale was completed offline
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorReason?: string;
  attempts: number;
}

export interface OfflineSalePayload {
  saleType: string;
  saleChannel: string;
  taxPricingMode: string;
  items: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>;
  discountAmount?: number;
  paymentMethod: string;
  amountPaid: number;
  customerPhone?: string;
  customerName?: string;
  posShiftId?: string;
  posRegisterId?: string;
  wasOffline: true;
  originalOfflineTimestamp: string;
  clientSaleId: string;
  clientSequenceNumber: number;
}

export interface CachedItem {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  sellingPrice: number;
  unit: string;
  qty: number;
  lastUpdated: string;
  isControlledSubstance: boolean;
  cacheable: boolean;
  cachedAt: number; // Date.now()
}

export interface SyncError {
  clientSaleId: string;
  payload: OfflineSalePayload;
  errorReason: string;
  occurredAt: string;
  discarded: boolean;
  discardReason?: string;
  discardedAt?: string;
  discardedBy?: string;
}

export interface SyncState {
  key: string; // e.g. 'lastCacheRefresh', 'lastSyncAttempt'
  value: string;
}

class OfflineDatabase extends Dexie {
  pendingSales!: Table<PendingSale, string>;
  cachedItems!: Table<CachedItem, string>;
  syncErrors!: Table<SyncError, string>;
  syncState!: Table<SyncState, string>;

  constructor() {
    super('glide-hims-offline');
    this.version(1).stores({
      pendingSales: 'clientSaleId, status, createdAt',
      cachedItems: 'id, name, barcode, cachedAt',
      syncErrors: 'clientSaleId, occurredAt, discarded',
      syncState: 'key',
    });
  }
}

export const offlineDb = new OfflineDatabase();

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCacheAge(): Promise<number | null> {
  const state = await offlineDb.syncState.get('lastCacheRefresh');
  if (!state) return null;
  return Date.now() - parseInt(state.value, 10);
}

export async function setCacheRefreshed(): Promise<void> {
  await offlineDb.syncState.put({ key: 'lastCacheRefresh', value: String(Date.now()) });
}

export async function isCacheStale(): Promise<boolean> {
  const age = await getCacheAge();
  if (age === null) return true;
  return age > CACHE_TTL_MS;
}

export async function getNextSequenceNumber(shiftId: string): Promise<number> {
  const sales = await offlineDb.pendingSales
    .where('shiftId')
    .equals(shiftId)
    .toArray();
  const maxSeq = sales.reduce((max, s) => Math.max(max, s.clientSequenceNumber), 0);
  return maxSeq + 1;
}
