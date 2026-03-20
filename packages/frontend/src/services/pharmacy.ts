import api from './api';

// Pharmacy Sale
export interface PharmacySale {
  id: string;
  saleNumber: string;
  storeId: string;
  saleType: 'walk-in' | 'prescription' | 'inpatient' | 'wholesale';
  patientId?: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
  instructions?: string;
}

// Drug Classification
export interface DrugClassification {
  id: string;
  itemId: string;
  drugId: string;
  drugName: string;
  genericName?: string;
  brandName?: string;
  schedule?: string;
  therapeuticClass?: string;
  strength?: string;
  formulation?: string;
  isControlled: boolean;
  isNarcotic: boolean;
  highAlert: boolean;
  isOnFormulary: boolean;
  createdAt: string;
}

// Drug Interaction
export interface DrugInteraction {
  id: string;
  drug1Id: string;
  drug2Id: string;
  drug1Name: string;
  drug2Name: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  recommendation?: string;
}

// Supplier
export interface Supplier {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  type: 'pharmaceutical' | 'medical_supplies' | 'equipment' | 'consumables' | 'general';
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
}

// DTOs
export interface CreatePharmacySaleDto {
  storeId: string;
  saleType: 'walk-in' | 'prescription' | 'inpatient' | 'wholesale';
  patientId?: string;
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
  discountAmount?: number;
  notes?: string;
  items: CreateSaleItemDto[];
}

export interface CreateSaleItemDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  instructions?: string;
}

export interface CompleteSaleDto {
  amountPaid: number;
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
}

export interface CreateSupplierDto {
  facilityId: string;
  code: string;
  name: string;
  type: 'pharmaceutical' | 'medical_supplies' | 'equipment' | 'consumables' | 'general';
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
}

export interface SaleListParams {
  storeId?: string;
  status?: string;
  date?: string;
  limit?: number;
}

export interface SupplierListParams {
  facilityId?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// Drug Sync
export interface DrugSyncLogEntry {
  id: string;
  syncType: 'interactions' | 'labels' | 'full';
  status: 'running' | 'completed' | 'failed';
  recordsProcessed: number;
  recordsAdded: number;
  recordsFailed: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  tenantId: string;
}

export interface DrugSyncStatus {
  lastSyncDate: string | null;
  lastSyncType: string | null;
  lastSyncRecordsAdded: number;
  isRunning: boolean;
  runningSyncType: string | null;
  totalInteractions: number;
  totalDrugs: number;
}

// Batch Stock (FEFO)
export interface BatchStock {
  id: string;
  itemId: string;
  facilityId: string;
  storeId?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: 'active' | 'quarantined' | 'expired';
  isExpired: boolean;
  isNearExpiry: boolean;
  item?: {
    id: string;
    code: string;
    name: string;
    genericName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FEFOAllocation {
  itemId: string;
  facilityId: string;
  requestedQuantity: number;
  totalAllocated: number;
  allocations: {
    batchId: string;
    batchNumber: string;
    expiryDate: string;
    allocatedQuantity: number;
  }[];
}

export interface AllocateFEFODto {
  itemId: string;
  facilityId: string;
  quantity: number;
  storeId?: string;
}

export interface ReceiveBatchDto {
  itemId: string;
  facilityId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  storeId?: string;
}

export interface DailySalesSummary {
  date: string;
  totalSales: number;
  totalAmount: number;
  byPaymentMethod: Record<string, number>;
  bySaleType: Record<string, number>;
}

export interface ProfitAnalytics {
  summary: {
    totalRevenue: number;
    totalCOGS: number;
    totalProfit: number;
    profitMargin: number;
    totalTransactions: number;
  };
  itemProfits: {
    itemId: string;
    itemName: string;
    quantitySold: number;
    avgCost: number;
    avgSellPrice: number;
    revenue: number;
    cogs: number;
    profit: number;
    margin: number;
  }[];
  dailyTrend: {
    date: string;
    revenue: number;
    cogs: number;
    profit: number;
  }[];
}

// Low-Stock Alert
export interface LowStockAlert {
  item: {
    id: string;
    code: string;
    name: string;
    genericName?: string;
    unit: string;
    reorderLevel: number;
    maxStockLevel?: number;
  };
  currentQuantity: number;
  reorderLevel: number;
  deficit: number;
}

// Expiry Alert
export interface ExpiringItem {
  itemId: string;
  itemName: string;
  itemCode: string;
  genericName?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  daysUntilExpiry: number;
}

export interface ExpiryAlertRecord {
  id: string;
  itemId: string;
  item?: {
    id: string;
    name: string;
    code: string;
    genericName?: string;
  };
  batchNumber?: string;
  expiryDate: string;
  alertDate?: string;
  quantity: number;
  status: 'active' | 'near_expiry' | 'quarantined' | 'disposed' | 'returned';
  actionTaken?: string;
  actionDate?: string;
  actionBy?: string;
  notes?: string;
  facilityId: string;
  createdAt: string;
}

export interface ExpiryReport {
  summary: {
    nearExpiryCount: number;
    quarantinedCount: number;
    disposedCount: number;
    returnedCount: number;
    totalAlerts: number;
  };
  nearExpiry: ExpiryAlertRecord[];
  quarantined: ExpiryAlertRecord[];
  disposed: ExpiryAlertRecord[];
  returned: ExpiryAlertRecord[];
}

// Drug Label Types
export interface DrugLabel {
  header: string;
  body: string;
  footer: string;
  raw: {
    drugName: string;
    translatedDrugName: string;
    dose: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string;
    translatedDirections: string;
    translatedWarnings: string;
    prescriptionNumber: string;
    date: string;
    language: string;
  };
  templateId: string | null;
}

export interface DrugLabelTemplate {
  id: string;
  name: string;
  language: string;
  labelType: 'prescription' | 'otc' | 'controlled' | 'external_use';
  headerTemplate: string;
  bodyTemplate: string;
  footerTemplate: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CommonDrugTranslation {
  id: string;
  drugName: string;
  language: string;
  translatedName: string;
  directions: string;
  warnings: string;
  createdAt: string;
}

export interface CreateDrugLabelTemplateDto {
  name: string;
  language: string;
  labelType: 'prescription' | 'otc' | 'controlled' | 'external_use';
  headerTemplate: string;
  bodyTemplate: string;
  footerTemplate: string;
  isDefault?: boolean;
}

export interface CreateDrugTranslationDto {
  drugName: string;
  language: string;
  translatedName: string;
  directions?: string;
  warnings?: string;
}

// Temperature Monitoring Types
export interface TemperatureLogEntry {
  id: string;
  sensorId: string;
  location: string;
  temperature: number;
  humidity: number | null;
  recordedAt: string;
  isAlert: boolean;
  alertType: 'normal' | 'warning' | 'critical' | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  facilityId: string;
  sensorName?: string;
  rangeMin?: number;
  rangeMax?: number;
  createdAt: string;
}

export interface TemperatureSensorEntry {
  id: string;
  sensorId: string;
  name: string;
  location: string;
  storageType: 'refrigerated' | 'frozen' | 'room_temperature';
  minTemp: number;
  maxTemp: number;
  isActive: boolean;
  facilityId: string;
  createdAt: string;
}

export interface TemperatureSensorWithReading extends TemperatureSensorEntry {
  latestReading: {
    temperature: number;
    humidity: number | null;
    recordedAt: string;
    isAlert: boolean;
    alertType: 'normal' | 'warning' | 'critical' | null;
  } | null;
}

export interface SensorReadingsResponse {
  readings: TemperatureLogEntry[];
  stats: {
    count: number;
    min: number;
    max: number;
    avg: number;
    alertCount: number;
  } | null;
}

export interface RecordTemperatureReadingDto {
  sensorId: string;
  temperature: number;
  humidity?: number;
  facilityId?: string;
}

export interface CreateTemperatureSensorDto {
  sensorId: string;
  name: string;
  location: string;
  storageType: 'refrigerated' | 'frozen' | 'room_temperature';
  minTemp?: number;
  maxTemp?: number;
  facilityId?: string;
}

// ── Supplier Scoring ──────────────────────────────────────────────────────

export interface ScoreBreakdown {
  delivery: number;
  quality: number;
  invoiceAccuracy: number;
  overall: number;
}

export interface SupplierScorecard {
  supplier: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
  };
  scores: ScoreBreakdown;
  metrics: {
    totalPOs: number;
    deliveredOnTime: number;
    totalGRNItems: number;
    acceptedItems: number;
    rejectedItems: number;
    totalInvoices: number;
    matchedInvoices: number;
  };
  recentPOs: {
    id: string;
    orderNumber: string;
    orderDate: string;
    expectedDelivery: string | null;
    status: string;
    totalAmount: number;
  }[];
  periodFrom: string | null;
  periodTo: string | null;
}

export interface SupplierRanking {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierType: string;
  supplierStatus: string;
  scores: ScoreBreakdown;
  totalPOs: number;
  rank: number;
}

// ── Pharmacy Dashboard KPIs ───────────────────────────────────────────────

export interface DashboardKPIs {
  queue: {
    pendingCount: number;
    avgWaitMinutes: number | null;
  };
  stockAlerts: {
    lowStockCount: number;
    expiringSoonCount: number;
    outOfStockCount: number;
  };
  revenue: {
    todayTotal: number;
    monthTotal: number;
    avgTransactionValue: number;
  };
  dispensing: {
    totalDispensedToday: number;
    controlledSubstancesToday: number;
  };
  recentActivity: {
    id: string;
    type: 'sale' | 'dispensing';
    reference: string;
    description: string;
    amount: number;
    timestamp: string;
  }[];
}

export const pharmacyService = {
  // Sales
  sales: {
    list: async (params?: SaleListParams): Promise<PharmacySale[]> => {
      const response = await api.get<PharmacySale[]>('/pharmacy/sales', { params });
      return response.data;
    },
    getById: async (id: string): Promise<PharmacySale> => {
      const response = await api.get<PharmacySale>(`/pharmacy/sales/${id}`);
      return response.data;
    },
    create: async (data: CreatePharmacySaleDto): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>('/pharmacy/sales', data);
      return response.data;
    },
    complete: async (id: string, data: CompleteSaleDto): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>(`/pharmacy/sales/${id}/complete`, data);
      return response.data;
    },
    cancel: async (id: string): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>(`/pharmacy/sales/${id}/cancel`);
      return response.data;
    },
    getDailySummary: async (storeId?: string, date?: string, facilityId?: string): Promise<DailySalesSummary> => {
      const response = await api.get<DailySalesSummary>('/pharmacy/summary/daily', { params: { storeId, date, facilityId } });
      return response.data;
    },
    getProfitAnalytics: async (params?: { storeId?: string; facilityId?: string; dateFrom?: string; dateTo?: string }): Promise<ProfitAnalytics> => {
      const response = await api.get<ProfitAnalytics>('/pharmacy/analytics/profit', { params });
      return response.data;
    },
  },

  // Batch Stock (FEFO)
  batchStock: {
    getByItem: async (itemId: string): Promise<BatchStock[]> => {
      const response = await api.get<BatchStock[]>(`/pharmacy/batch-stock/${itemId}`);
      return response.data;
    },
    allocateFEFO: async (data: AllocateFEFODto): Promise<FEFOAllocation> => {
      const response = await api.post<FEFOAllocation>('/pharmacy/batch-stock/allocate', data);
      return response.data;
    },
    receiveBatch: async (data: ReceiveBatchDto): Promise<BatchStock> => {
      const response = await api.post<BatchStock>('/pharmacy/batch-stock/receive', data);
      return response.data;
    },
  },

  // Drug Management
  drugs: {
    listClassifications: async (params?: {
      schedule?: string;
      therapeuticClass?: string;
      isControlled?: boolean;
      isOnFormulary?: boolean;
    }): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications', { params });
      return response.data;
    },
    getControlled: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/controlled');
      return response.data;
    },
    getNarcotics: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/narcotics');
      return response.data;
    },
    getHighAlert: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/high-alert');
      return response.data;
    },
    getFormulary: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/formulary');
      return response.data;
    },
    createClassification: async (data: Partial<DrugClassification>): Promise<DrugClassification> => {
      const response = await api.post<DrugClassification>('/drug-management/classifications', data);
      return response.data;
    },
    updateClassification: async (id: string, data: Partial<DrugClassification>): Promise<DrugClassification> => {
      const response = await api.put<DrugClassification>(`/drug-management/classifications/${id}`, data);
      return response.data;
    },
    checkInteractions: async (drugIds: string[]): Promise<DrugInteraction[]> => {
      const response = await api.post<DrugInteraction[]>('/drug-management/interactions/check', { drugIds });
      return response.data;
    },
    getMajorInteractions: async (): Promise<DrugInteraction[]> => {
      const response = await api.get<DrugInteraction[]>('/drug-management/interactions', { params: { severity: 'major' } });
      return response.data;
    },
  },

  // Suppliers
  suppliers: {
    list: async (params?: SupplierListParams): Promise<{ data: Supplier[]; total: number }> => {
      const response = await api.get('/suppliers', { params });
      return response.data;
    },
    getActive: async (facilityId: string): Promise<Supplier[]> => {
      const response = await api.get<Supplier[]>('/suppliers/active', { params: { facilityId } });
      return response.data;
    },
    getById: async (id: string): Promise<Supplier> => {
      const response = await api.get<Supplier>(`/suppliers/${id}`);
      return response.data;
    },
    create: async (data: CreateSupplierDto): Promise<Supplier> => {
      const response = await api.post<Supplier>('/suppliers', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateSupplierDto> & { status?: string }): Promise<Supplier> => {
      const response = await api.put<Supplier>(`/suppliers/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/suppliers/${id}`);
    },
    getDashboard: async (): Promise<{
      totalSuppliers: number;
      activeSuppliers: number;
      byType: Record<string, number>;
    }> => {
      const response = await api.get('/suppliers/dashboard');
      return response.data;
    },
  },

  // Low-Stock Alerts
  alerts: {
    getLowStock: async (): Promise<LowStockAlert[]> => {
      const response = await api.get<LowStockAlert[]>('/pharmacy/alerts/low-stock');
      return response.data;
    },
  },

  // Drug Database Sync
  drugSync: {
    syncInteractions: async (): Promise<DrugSyncLogEntry> => {
      const response = await api.post<DrugSyncLogEntry>('/drug-management/sync/interactions');
      return response.data;
    },
    syncLabels: async (drugName: string): Promise<DrugSyncLogEntry> => {
      const response = await api.post<DrugSyncLogEntry>(`/drug-management/sync/labels/${encodeURIComponent(drugName)}`);
      return response.data;
    },
    getStatus: async (): Promise<DrugSyncStatus> => {
      const response = await api.get<DrugSyncStatus>('/drug-management/sync/status');
      return response.data;
    },
    getLogs: async (): Promise<DrugSyncLogEntry[]> => {
      const response = await api.get<DrugSyncLogEntry[]>('/drug-management/sync/logs');
      return response.data;
    },
  },

  // Expiry Workflow
  expiry: {
    getAlerts: async (daysThreshold?: number): Promise<ExpiringItem[]> => {
      const response = await api.get<ExpiringItem[]>('/pharmacy/expiry/alerts', {
        params: daysThreshold ? { daysThreshold } : undefined,
      });
      return response.data;
    },
    quarantine: async (data: { itemId: string; batchNumber?: string; notes?: string }): Promise<ExpiryAlertRecord> => {
      const response = await api.post<ExpiryAlertRecord>('/pharmacy/expiry/quarantine', data);
      return response.data;
    },
    process: async (data: { itemId: string; action: 'dispose' | 'return'; batchNumber?: string; notes?: string }): Promise<ExpiryAlertRecord> => {
      const response = await api.post<ExpiryAlertRecord>('/pharmacy/expiry/process', data);
      return response.data;
    },
    getReport: async (): Promise<ExpiryReport> => {
      const response = await api.get<ExpiryReport>('/pharmacy/expiry/report');
      return response.data;
    },
  },

  // Drug Label Management
  labels: {
    generate: async (prescriptionItemId: string, language?: string): Promise<DrugLabel> => {
      const response = await api.get<DrugLabel>(`/pharmacy/labels/generate/${prescriptionItemId}`, {
        params: language ? { language } : undefined,
      });
      return response.data;
    },
    getTemplates: async (language?: string): Promise<DrugLabelTemplate[]> => {
      const response = await api.get<DrugLabelTemplate[]>('/pharmacy/labels/templates', {
        params: language ? { language } : undefined,
      });
      return response.data;
    },
    createTemplate: async (data: CreateDrugLabelTemplateDto): Promise<DrugLabelTemplate> => {
      const response = await api.post<DrugLabelTemplate>('/pharmacy/labels/templates', data);
      return response.data;
    },
    getTranslations: async (language?: string): Promise<CommonDrugTranslation[]> => {
      const response = await api.get<CommonDrugTranslation[]>('/pharmacy/labels/translations', {
        params: language ? { language } : undefined,
      });
      return response.data;
    },
    createTranslation: async (data: CreateDrugTranslationDto): Promise<CommonDrugTranslation> => {
      const response = await api.post<CommonDrugTranslation>('/pharmacy/labels/translations', data);
      return response.data;
    },
  },

  // Temperature Monitoring
  temperature: {
    recordReading: async (data: RecordTemperatureReadingDto): Promise<TemperatureLogEntry> => {
      const response = await api.post<TemperatureLogEntry>('/pharmacy/temperature/readings', data);
      return response.data;
    },
    getSensorReadings: async (sensorId: string, dateFrom?: string, dateTo?: string): Promise<SensorReadingsResponse> => {
      const response = await api.get<SensorReadingsResponse>(`/pharmacy/temperature/readings/${sensorId}`, {
        params: { dateFrom, dateTo },
      });
      return response.data;
    },
    getAlerts: async (): Promise<TemperatureLogEntry[]> => {
      const response = await api.get<TemperatureLogEntry[]>('/pharmacy/temperature/alerts');
      return response.data;
    },
    acknowledgeAlert: async (id: string): Promise<TemperatureLogEntry> => {
      const response = await api.post<TemperatureLogEntry>(`/pharmacy/temperature/alerts/${id}/acknowledge`);
      return response.data;
    },
    getSensors: async (): Promise<TemperatureSensorWithReading[]> => {
      const response = await api.get<TemperatureSensorWithReading[]>('/pharmacy/temperature/sensors');
      return response.data;
    },
    createSensor: async (data: CreateTemperatureSensorDto): Promise<TemperatureSensorEntry> => {
      const response = await api.post<TemperatureSensorEntry>('/pharmacy/temperature/sensors', data);
      return response.data;
    },
  },

  // Supplier Scoring
  supplierScoring: {
    getScorecard: async (supplierId: string, params?: { dateFrom?: string; dateTo?: string }): Promise<SupplierScorecard> => {
      const response = await api.get<SupplierScorecard>(`/suppliers/${supplierId}/scorecard`, { params });
      return response.data;
    },
    getRankings: async (): Promise<SupplierRanking[]> => {
      const response = await api.get<SupplierRanking[]>('/suppliers/rankings');
      return response.data;
    },
  },

  // Dashboard KPIs
  dashboard: {
    getKPIs: async (): Promise<DashboardKPIs> => {
      const response = await api.get<DashboardKPIs>('/pharmacy/dashboard/kpis');
      return response.data;
    },
  },
};

export default pharmacyService;
