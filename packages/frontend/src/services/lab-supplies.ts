import api from './api';

// Types matching backend entities
export interface QCMaterial {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  manufacturer?: string;
  lotNumber?: string;
  expiryDate?: string;
  level: 'level_1' | 'level_2' | 'level_3';
  testCode: string;
  testName: string;
  targetMean: number;
  targetSd: number;
  targetCv?: number;
  acceptableRangeLow?: number;
  acceptableRangeHigh?: number;
  unit?: string;
  equipmentId?: string;
  storageTemperature?: string;
  isActive: boolean;
  notes?: string;
}

export interface QCResult {
  id: string;
  facilityId: string;
  qcMaterialId: string;
  qcMaterial?: QCMaterial;
  equipmentId?: string;
  testCode: string;
  runDate: string;
  resultValue: number;
  unit?: string;
  targetMean: number;
  targetSd: number;
  zScore: number;
  status: 'in_control' | 'out_of_control' | 'warning' | 'not_evaluated';
  violatedRules?: string[];
  performedBy: string;
  performedByUser?: { firstName: string; lastName: string };
  reviewedBy?: string;
  reviewedAt?: string;
  correctiveAction?: string;
  isRepeat: boolean;
  comments?: string;
  reagentLot?: string;
  calibratorLot?: string;
}

export interface LeveyJenningsData {
  id: string;
  qcMaterialId: string;
  dataDate: string;
  calculatedMean: number;
  calculatedSd: number;
  calculatedCv: number;
  dataPoints: number;
  inControlCount: number;
  outOfControlCount: number;
  plus1Sd: number;
  plus2Sd: number;
  plus3Sd: number;
  minus1Sd: number;
  minus2Sd: number;
  minus3Sd: number;
}

export interface LabReagent {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  category: string;
  manufacturer?: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  unitCost: number;
  isActive: boolean;
}

export interface LabEquipment {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'calibration_due';
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

export interface QCSummary {
  totalRuns: number;
  passRate: number;
  warningCount: number;
  failureCount: number;
  meanBias: number;
  byTest: Array<{
    testCode: string;
    testName: string;
    runs: number;
    passRate: number;
  }>;
}

export const labSuppliesService = {
  // ==================== QC Materials ====================
  qcMaterials: {
    create: async (data: Partial<QCMaterial>): Promise<QCMaterial> => {
      const response = await api.post('/lab-supplies/qc-materials', data);
      return response.data;
    },

    list: async (facilityId: string, testCode?: string): Promise<QCMaterial[]> => {
      const params: Record<string, string> = { facilityId };
      if (testCode) params.testCode = testCode;
      const response = await api.get('/lab-supplies/qc-materials', { params });
      return response.data;
    },
  },

  // ==================== QC Results ====================
  qcResults: {
    record: async (data: {
      facilityId: string;
      qcMaterialId: string;
      equipmentId?: string;
      testCode: string;
      resultValue: number;
      unit?: string;
      performedBy: string;
      reagentLot?: string;
      calibratorLot?: string;
      comments?: string;
    }): Promise<QCResult> => {
      const response = await api.post('/lab-supplies/qc-results', data);
      return response.data;
    },

    list: async (
      facilityId: string,
      testCode: string,
      startDate: string,
      endDate: string
    ): Promise<QCResult[]> => {
      const response = await api.get('/lab-supplies/qc-results', {
        params: { facilityId, testCode, startDate, endDate },
      });
      return response.data;
    },

    getLeveyJenningsData: async (
      materialId: string,
      months?: number
    ): Promise<LeveyJenningsData[]> => {
      const params: Record<string, number> = {};
      if (months) params.months = months;
      const response = await api.get(`/lab-supplies/qc-results/levey-jennings/${materialId}`, {
        params,
      });
      return response.data;
    },

    getSummary: async (
      facilityId: string,
      month: number,
      year: number
    ): Promise<QCSummary> => {
      const response = await api.get('/lab-supplies/qc-results/summary', {
        params: { facilityId, month, year },
      });
      return response.data;
    },
  },

  // ==================== Reagents ====================
  reagents: {
    create: async (data: Partial<LabReagent>): Promise<LabReagent> => {
      const response = await api.post('/lab-supplies/reagents', data);
      return response.data;
    },

    list: async (facilityId: string, category?: string): Promise<LabReagent[]> => {
      const params: Record<string, string> = { facilityId };
      if (category) params.category = category;
      const response = await api.get('/lab-supplies/reagents', { params });
      return response.data;
    },

    get: async (id: string): Promise<LabReagent> => {
      const response = await api.get(`/lab-supplies/reagents/${id}`);
      return response.data;
    },

    update: async (id: string, data: Partial<LabReagent>): Promise<LabReagent> => {
      const response = await api.put(`/lab-supplies/reagents/${id}`, data);
      return response.data;
    },

    getLowStock: async (facilityId: string): Promise<LabReagent[]> => {
      const response = await api.get('/lab-supplies/reagents/low-stock', {
        params: { facilityId },
      });
      return response.data;
    },

    getExpiring: async (facilityId: string, daysAhead?: number): Promise<LabReagent[]> => {
      const params: Record<string, string | number> = { facilityId };
      if (daysAhead) params.daysAhead = daysAhead;
      const response = await api.get('/lab-supplies/reagents/expiring', { params });
      return response.data;
    },

    getConsumptionReport: async (
      facilityId: string,
      startDate: string,
      endDate: string
    ): Promise<any> => {
      const response = await api.get('/lab-supplies/reagents/consumption-report', {
        params: { facilityId, startDate, endDate },
      });
      return response.data;
    },
  },

  // ==================== Reagent Lots ====================
  reagentLots: {
    receive: async (reagentId: string, data: any): Promise<any> => {
      const response = await api.post(`/lab-supplies/reagents/${reagentId}/lots`, data);
      return response.data;
    },

    open: async (lotId: string): Promise<any> => {
      const response = await api.post(`/lab-supplies/lots/${lotId}/open`);
      return response.data;
    },

    recordConsumption: async (lotId: string, data: any): Promise<any> => {
      const response = await api.post(`/lab-supplies/lots/${lotId}/consume`, data);
      return response.data;
    },
  },

  // ==================== Equipment ====================
  equipment: {
    create: async (data: Partial<LabEquipment>): Promise<LabEquipment> => {
      const response = await api.post('/lab-supplies/equipment', data);
      return response.data;
    },

    list: async (facilityId: string, category?: string): Promise<LabEquipment[]> => {
      const params: Record<string, string> = { facilityId };
      if (category) params.category = category;
      const response = await api.get('/lab-supplies/equipment', { params });
      return response.data;
    },

    get: async (id: string): Promise<LabEquipment> => {
      const response = await api.get(`/lab-supplies/equipment/${id}`);
      return response.data;
    },

    update: async (id: string, data: Partial<LabEquipment>): Promise<LabEquipment> => {
      const response = await api.put(`/lab-supplies/equipment/${id}`, data);
      return response.data;
    },

    getCalibrationDue: async (facilityId: string, daysAhead?: number): Promise<LabEquipment[]> => {
      const params: Record<string, string | number> = { facilityId };
      if (daysAhead) params.daysAhead = daysAhead;
      const response = await api.get('/lab-supplies/equipment/calibration-due', { params });
      return response.data;
    },

    recordCalibration: async (equipmentId: string, data: any): Promise<any> => {
      const response = await api.post(`/lab-supplies/equipment/${equipmentId}/calibration`, data);
      return response.data;
    },

    recordMaintenance: async (equipmentId: string, data: any): Promise<any> => {
      const response = await api.post(`/lab-supplies/equipment/${equipmentId}/maintenance`, data);
      return response.data;
    },
  },
};

export default labSuppliesService;
