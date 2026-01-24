import Dexie from 'dexie';
import type { Table } from 'dexie';

// Syncable entity types (must match backend)
export type SyncableEntityType =
  | 'patient'
  | 'encounter'
  | 'vital_sign'
  | 'clinical_note'
  | 'prescription'
  | 'lab_order'
  | 'lab_result'
  | 'imaging_order'
  | 'admission'
  | 'invoice'
  | 'payment'
  | 'antenatal_visit'
  | 'postnatal_visit'
  | 'immunization';

export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id?: number;
  entityType: SyncableEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: Record<string, any>;
  previousPayload?: Record<string, any>;
  clientVersion: number;
  clientTimestamp: number;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';
  retryCount: number;
  errorMessage?: string;
  conflictId?: string;
  createdAt: number;
}

export interface CachedEntity {
  id: string;
  entityType: SyncableEntityType;
  data: Record<string, any>;
  version: number;
  lastSyncedAt: number;
  isDeleted: boolean;
}

export interface SyncMetadata {
  id: string;
  key: string;
  value: any;
}

export interface SyncConflictLocal {
  id: string;
  entityType: SyncableEntityType;
  entityId: string;
  clientPayload: Record<string, any>;
  serverPayload: Record<string, any>;
  conflictingFields: string[];
  createdAt: number;
  resolved: boolean;
}

class GlideOfflineDB extends Dexie {
  syncQueue!: Table<SyncQueueItem, number>;
  patients!: Table<CachedEntity, string>;
  encounters!: Table<CachedEntity, string>;
  vitals!: Table<CachedEntity, string>;
  clinicalNotes!: Table<CachedEntity, string>;
  prescriptions!: Table<CachedEntity, string>;
  labOrders!: Table<CachedEntity, string>;
  labResults!: Table<CachedEntity, string>;
  imagingOrders!: Table<CachedEntity, string>;
  admissions!: Table<CachedEntity, string>;
  invoices!: Table<CachedEntity, string>;
  payments!: Table<CachedEntity, string>;
  antenatalVisits!: Table<CachedEntity, string>;
  postnatalVisits!: Table<CachedEntity, string>;
  immunizations!: Table<CachedEntity, string>;
  metadata!: Table<SyncMetadata, string>;
  conflicts!: Table<SyncConflictLocal, string>;

  constructor() {
    super('GlideHIMSOfflineDB');

    this.version(1).stores({
      syncQueue: '++id, entityType, entityId, status, createdAt',
      patients: 'id, entityType, lastSyncedAt',
      encounters: 'id, entityType, lastSyncedAt, [data.patientId+data.createdAt]',
      vitals: 'id, entityType, lastSyncedAt, [data.encounterId+data.createdAt]',
      clinicalNotes: 'id, entityType, lastSyncedAt, [data.encounterId+data.createdAt]',
      prescriptions: 'id, entityType, lastSyncedAt, [data.encounterId+data.createdAt]',
      labOrders: 'id, entityType, lastSyncedAt, [data.encounterId+data.createdAt]',
      labResults: 'id, entityType, lastSyncedAt, [data.orderId+data.createdAt]',
      imagingOrders: 'id, entityType, lastSyncedAt, [data.encounterId+data.createdAt]',
      admissions: 'id, entityType, lastSyncedAt, [data.patientId+data.createdAt]',
      invoices: 'id, entityType, lastSyncedAt, [data.patientId+data.createdAt]',
      payments: 'id, entityType, lastSyncedAt, [data.invoiceId+data.createdAt]',
      antenatalVisits: 'id, entityType, lastSyncedAt, [data.registrationId+data.createdAt]',
      postnatalVisits: 'id, entityType, lastSyncedAt, [data.registrationId+data.createdAt]',
      immunizations: 'id, entityType, lastSyncedAt, [data.deliveryOutcomeId+data.createdAt]',
      metadata: 'id, key',
      conflicts: 'id, entityType, entityId, resolved',
    });
  }
}

export const db = new GlideOfflineDB();

// Entity type to table mapping
export const entityTableMap: Record<SyncableEntityType, Table<CachedEntity, string>> = {
  patient: db.patients,
  encounter: db.encounters,
  vital_sign: db.vitals,
  clinical_note: db.clinicalNotes,
  prescription: db.prescriptions,
  lab_order: db.labOrders,
  lab_result: db.labResults,
  imaging_order: db.imagingOrders,
  admission: db.admissions,
  invoice: db.invoices,
  payment: db.payments,
  antenatal_visit: db.antenatalVisits,
  postnatal_visit: db.postnatalVisits,
  immunization: db.immunizations,
};

// Utility functions
export async function getLastSyncTimestamp(): Promise<number> {
  const meta = await db.metadata.get('lastSyncTimestamp');
  return meta?.value || 0;
}

export async function setLastSyncTimestamp(timestamp: number): Promise<void> {
  await db.metadata.put({ id: 'lastSyncTimestamp', key: 'lastSyncTimestamp', value: timestamp });
}

export async function getClientId(): Promise<string> {
  let meta = await db.metadata.get('clientId');
  if (!meta) {
    const clientId = crypto.randomUUID();
    await db.metadata.put({ id: 'clientId', key: 'clientId', value: clientId });
    return clientId;
  }
  return meta.value;
}

export async function clearAllData(): Promise<void> {
  await Promise.all([
    db.syncQueue.clear(),
    db.patients.clear(),
    db.encounters.clear(),
    db.vitals.clear(),
    db.clinicalNotes.clear(),
    db.prescriptions.clear(),
    db.labOrders.clear(),
    db.labResults.clear(),
    db.imagingOrders.clear(),
    db.admissions.clear(),
    db.invoices.clear(),
    db.payments.clear(),
    db.antenatalVisits.clear(),
    db.postnatalVisits.clear(),
    db.immunizations.clear(),
    db.metadata.clear(),
    db.conflicts.clear(),
  ]);
}
