// Lightweight IndexedDB-backed cache for read-mostly resources (patients,
// queue, encounters). Used by the offline mode to keep clinics functional
// during brief network drops. NOT a write queue — writes are still rejected
// when offline, with a clear UI message.
//
// We deliberately use the raw IndexedDB API to avoid adding the `idb` dep.

const DB_NAME = 'glide-hims-offline';
const DB_VERSION = 1;
const STORES = ['patients', 'queue', 'encounters', 'meta'] as const;
type Store = typeof STORES[number];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store: Store, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(store, mode).objectStore(store);
}

export const offlineCache = {
  async put<T extends { id: string }>(store: Store, value: T): Promise<void> {
    const s = await tx(store, 'readwrite');
    await new Promise<void>((res, rej) => {
      const r = s.put(value);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async putAll<T extends { id: string }>(store: Store, values: T[]): Promise<void> {
    if (!values.length) return;
    const s = await tx(store, 'readwrite');
    await Promise.all(values.map((v) => new Promise<void>((res, rej) => {
      const r = s.put(v);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    })));
  },

  async get<T = unknown>(store: Store, id: string): Promise<T | undefined> {
    const s = await tx(store, 'readonly');
    return new Promise((res, rej) => {
      const r = s.get(id);
      r.onsuccess = () => res(r.result as T | undefined);
      r.onerror = () => rej(r.error);
    });
  },

  async getAll<T = unknown>(store: Store): Promise<T[]> {
    const s = await tx(store, 'readonly');
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res((r.result as T[]) || []);
      r.onerror = () => rej(r.error);
    });
  },

  async clear(store: Store): Promise<void> {
    const s = await tx(store, 'readwrite');
    await new Promise<void>((res, rej) => {
      const r = s.clear();
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  },

  async setMeta(key: string, value: unknown) {
    return this.put('meta', { id: key, key, value, updatedAt: Date.now() } as any);
  },

  async getMeta<T = unknown>(key: string): Promise<T | undefined> {
    const row: any = await this.get('meta', key);
    return row?.value as T | undefined;
  },
};

export type OfflineStore = Store;
