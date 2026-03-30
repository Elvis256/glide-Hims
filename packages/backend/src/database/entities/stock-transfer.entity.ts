// Re-export StockTransfer from store.entity.ts to avoid duplicate @Entity registration
export { StockTransfer, TransferStatus } from './store.entity';

export enum TransferReason {
  RESTOCK = 'restock',
  REDISTRIBUTION = 'redistribution',
  EMERGENCY = 'emergency',
  EXPIRY_PREVENTION = 'expiry_prevention',
  FACILITY_REQUEST = 'facility_request',
  SURPLUS = 'surplus',
  OTHER = 'other',
}
