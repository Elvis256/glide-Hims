import api from './api';

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  sampleType?: string;
  normalRange?: string;
  unit?: string;
  turnaroundTime?: string;
  price: number;
  cost?: number;
  isActive?: boolean;
}

export interface LabSample {
  id: string;
  sampleNumber: string;
  barcode?: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
  };
  orderId?: string;
  labTestId?: string;
  labTest?: LabTest;
  status: 'collected' | 'received' | 'processing' | 'completed' | 'rejected';
  priority?: 'routine' | 'urgent' | 'stat';
  collectionTime?: string;
  collectedById?: string;
  collectedBy?: { firstName?: string; lastName?: string; fullName?: string };
  collectionNotes?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface LabResult {
  id: string;
  sampleId?: string;
  testId?: string;
  parameter: string;
  value: string;
  numericValue?: number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
  abnormalFlag?: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high' | 'critical';
  flag?: 'normal' | 'low' | 'high' | 'critical';
  status: 'entered' | 'validated' | 'released' | 'amended';
  enteredById?: string;
  enteredBy?: { firstName: string; lastName: string };
  validatedById?: string;
  validatedBy?: string | { firstName: string; lastName: string };
  validatedAt?: string;
  // Legacy aliases for verified (same as validated)
  verifiedBy?: string | { firstName: string; lastName: string };
  verifiedAt?: string;
  releasedById?: string;
  releasedAt?: string;
  comments?: string;
  interpretation?: string;
  // Legacy support for pages expecting array of parameters
  parameters?: Array<{ name: string; value: string; unit: string; referenceRange: string; flag?: string }>;
  createdAt: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  encounterId?: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    room?: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    fullName: string;
  };
  tests: LabOrderTest[];
  priority?: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'sample_collected' | 'processing' | 'completed' | 'cancelled' | 'collected' | 'verified' | 'validated' | 'released' | 'in-progress';
  clinicalNotes?: string;
  orderedBy?: string;
  assignedTo?: string;
  collectedAt?: string;
  collectedBy?: string;
  sampleType?: string;
  sampleId?: string;
  completedAt?: string;
  createdAt: string;
}

export interface LabOrderTest {
  id: string;
  orderId?: string;
  testId: string;
  testName: string;
  name?: string;
  testCode?: string;
  category?: string;
  status: 'pending' | 'collected' | 'processing' | 'completed';
  result?: LabResult;
  price?: number;
  parameters?: Array<{ name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number }>;
}

export interface LabParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag?: 'normal' | 'low' | 'high' | 'critical';
}

export interface CollectSampleDto {
  orderId: string;
  patientId: string;
  facilityId: string;
  labTestId?: string;
  labTestCode?: string;
  sampleType: 'blood' | 'serum' | 'plasma' | 'urine' | 'stool' | 'sputum' | 'csf' | 'swab' | 'tissue' | 'other';
  priority?: 'routine' | 'urgent' | 'stat';
  collectionNotes?: string;
}

export interface EnterResultDto {
  parameter: string;
  value: string;
  numericValue?: number;
  unit?: string;
  referenceMin?: number;
  referenceMax?: number;
  referenceRange?: string;
  abnormalFlag?: string;
  interpretation?: string;
  comments?: string;
}

export const labService = {
  // Test catalog - matches backend /lab/tests endpoints
  tests: {
    list: async (params?: { category?: string; status?: string; search?: string }): Promise<LabTest[]> => {
      const response = await api.get('/lab/tests', { params });
      return response.data;
    },
    getById: async (id: string): Promise<LabTest> => {
      const response = await api.get(`/lab/tests/${id}`);
      return response.data;
    },
    getByCode: async (code: string): Promise<LabTest | undefined> => {
      const response = await api.get('/lab/tests', { params: { search: code } });
      const tests = response.data as LabTest[];
      return tests.find(t => t.code === code);
    },
    create: async (data: Partial<LabTest>): Promise<LabTest> => {
      const response = await api.post('/lab/tests', data);
      return response.data;
    },
    update: async (id: string, data: Partial<LabTest>): Promise<LabTest> => {
      const response = await api.patch(`/lab/tests/${id}`, data);
      return response.data;
    },
    toggleActive: async (id: string): Promise<LabTest> => {
      const response = await api.patch(`/lab/tests/${id}`, { isActive: true }); // Toggle handled by backend or caller
      return response.data;
    },
  },

  // Sample management - matches backend /lab/samples endpoints
  samples: {
    list: async (params?: { facilityId?: string; status?: string; priority?: string; fromDate?: string; toDate?: string }): Promise<{ data: LabSample[]; total: number }> => {
      const response = await api.get('/lab/samples', { params });
      return response.data;
    },
    getById: async (id: string): Promise<LabSample> => {
      const response = await api.get(`/lab/samples/${id}`);
      return response.data;
    },
    collect: async (data: CollectSampleDto): Promise<LabSample> => {
      const response = await api.post('/lab/samples', data);
      return response.data;
    },
    receive: async (id: string, notes?: string): Promise<LabSample> => {
      const response = await api.put(`/lab/samples/${id}/receive`, { notes });
      return response.data;
    },
    startProcessing: async (id: string): Promise<LabSample> => {
      const response = await api.put(`/lab/samples/${id}/process`);
      return response.data;
    },
    reject: async (id: string, rejectionReason: string): Promise<LabSample> => {
      const response = await api.put(`/lab/samples/${id}/reject`, { rejectionReason });
      return response.data;
    },
  },

  // Results - matches backend /lab/samples/:sampleId/results and /lab/results endpoints
  results: {
    getForSample: async (sampleId: string): Promise<LabResult[]> => {
      const response = await api.get(`/lab/samples/${sampleId}/results`);
      return response.data;
    },
    enter: async (sampleId: string, data: EnterResultDto): Promise<LabResult> => {
      const response = await api.post(`/lab/samples/${sampleId}/results`, data);
      return response.data;
    },
    // Legacy create method for backward compatibility
    create: async (data: { orderId: string; values: Array<{ parameter: string; value: string; unit: string; status: string }>; notes?: string }): Promise<LabResult> => {
      const response = await api.post(`/orders/${data.orderId}/lab-results`, data);
      return response.data;
    },
    validate: async (resultId: string, comments?: string): Promise<LabResult> => {
      const response = await api.put(`/lab/results/${resultId}/validate`, { comments });
      return response.data;
    },
    release: async (resultId: string): Promise<LabResult> => {
      const response = await api.put(`/lab/results/${resultId}/release`);
      return response.data;
    },
    amend: async (resultId: string, data: { newValue: string; numericValue?: number; amendmentReason: string }): Promise<LabResult> => {
      const response = await api.put(`/lab/results/${resultId}/amend`, data);
      return response.data;
    },
  },

  // Dashboard/Queue - matches backend /lab/queue and /lab/stats endpoints
  dashboard: {
    getQueue: async (facilityId: string): Promise<{ pendingCollection: number; pendingProcessing: number; inProgress: number; completedToday: number }> => {
      const response = await api.get('/lab/queue', { params: { facilityId } });
      return response.data;
    },
    getTurnaroundStats: async (facilityId: string, days?: number): Promise<Array<{ date: string; avgMinutes: number; count: number }>> => {
      const response = await api.get('/lab/stats/turnaround', { params: { facilityId, days } });
      return response.data;
    },
  },

  // Legacy orders support (uses /orders endpoint for backwards compatibility)
  orders: {
    list: async (params?: { status?: string; patientId?: string; date?: string; facilityId?: string }): Promise<LabOrder[]> => {
      const response = await api.get<{ data: any[]; total: number; page: number; limit: number }>('/orders', { params: { ...params, orderType: 'lab' } });
      // Transform orders API response to LabOrder format
      const orders = response.data.data || [];
      return orders.map(order => {
        // Group lab results by test code
        const labResults = order.labResults || [];
        
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          encounterId: order.encounterId,
          patientId: order.encounter?.patient?.id || order.encounter?.patientId || '',
          patient: order.encounter?.patient ? {
            id: order.encounter.patient.id,
            mrn: order.encounter.patient.mrn,
            fullName: order.encounter.patient.fullName,
          } : undefined,
          doctorId: order.orderedById,
          doctor: order.orderedBy ? {
            id: order.orderedBy.id,
            fullName: order.orderedBy.fullName,
          } : undefined,
          tests: (order.testCodes || []).map((tc: { code: string; name: string; sampleType?: string }) => {
            // Find results for this test - all results belong to this order
            const testResults = labResults.map((r: any) => ({
              id: r.id,
              parameter: r.parameter,
              value: r.value,
              numericValue: r.numericValue,
              unit: r.unit,
              referenceMin: r.referenceMin,
              referenceMax: r.referenceMax,
              referenceRange: r.referenceRange,
              abnormalFlag: r.abnormalFlag,
              status: r.status,
              validatedAt: r.validatedAt,
              releasedAt: r.releasedAt,
            }));
            
            return {
              id: tc.code,
              testId: tc.code,
              testName: tc.name,
              name: tc.name,
              testCode: tc.code,
              sampleType: tc.sampleType,
              status: labResults.length > 0 ? 'completed' : 'pending',
              result: testResults.length > 0 ? {
                parameters: testResults,
                verifiedAt: testResults[0]?.validatedAt,
                validatedAt: testResults[0]?.validatedAt,
              } : undefined,
            };
          }),
          // Derive sample type from first test or use 'blood' as default
          sampleType: (order.testCodes?.[0]?.sampleType) || 'blood',
          priority: order.priority || 'routine',
          status: order.status || 'pending',
          clinicalNotes: order.clinicalNotes,
          orderedBy: order.orderedBy?.fullName,
          assignedTo: order.assignedTo,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
        };
      });
    },
    getPending: async (): Promise<LabOrder[]> => {
      const response = await api.get<{ data: any[]; total: number; page: number; limit: number }>('/orders', { params: { orderType: 'lab', status: 'pending' } });
      const orders = response.data.data || [];
      return orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        encounterId: order.encounterId,
        patientId: order.encounter?.patient?.id || '',
        patient: order.encounter?.patient,
        sampleType: (order.testCodes?.[0]?.sampleType) || 'blood',
        tests: (order.testCodes || []).map((tc: { code: string; name: string; sampleType?: string }) => ({
          id: tc.code,
          testId: tc.code,
          testName: tc.name,
          name: tc.name,
          testCode: tc.code,
        })),
        priority: order.priority || 'routine',
        status: order.status || 'pending',
        clinicalNotes: order.clinicalNotes,
        createdAt: order.createdAt,
      }));
    },
    getById: async (id: string): Promise<LabOrder> => {
      const response = await api.get<LabOrder>(`/orders/${id}`);
      return response.data;
    },
    startProcessing: async (orderId: string): Promise<LabOrder> => {
      const response = await api.post<LabOrder>(`/orders/${orderId}/start`);
      return response.data;
    },
    assign: async (orderId: string, technician: string): Promise<LabOrder> => {
      const response = await api.put<LabOrder>(`/orders/${orderId}/status`, { assignedTo: technician });
      return response.data;
    },
    updateStatus: async (orderId: string, status: string): Promise<LabOrder> => {
      const response = await api.put<LabOrder>(`/orders/${orderId}/status`, { status });
      return response.data;
    },
    // Get historical lab orders for a patient (for comparison)
    getHistory: async (patientId: string, excludeOrderId?: string): Promise<LabOrder[]> => {
      const response = await api.get<{ data: any[]; total: number; page: number; limit: number }>('/orders', { 
        params: { patientId, orderType: 'lab', limit: 50 } 
      });
      const orders = response.data.data || [];
      return orders
        .filter(order => order.id !== excludeOrderId)
        .map(order => {
          const labResults = order.labResults || [];
          return {
            id: order.id,
            orderNumber: order.orderNumber,
            encounterId: order.encounterId,
            patientId: order.encounter?.patient?.id || order.encounter?.patientId || '',
            patient: order.encounter?.patient ? {
              id: order.encounter.patient.id,
              mrn: order.encounter.patient.mrn,
              fullName: order.encounter.patient.fullName,
            } : undefined,
            doctorId: order.orderedById,
            doctor: order.orderedBy ? {
              id: order.orderedBy.id,
              fullName: order.orderedBy.fullName,
            } : undefined,
            tests: (order.testCodes || []).map((tc: { code: string; name: string; sampleType?: string }) => {
              const testResults = labResults.map((r: any) => ({
                id: r.id,
                parameter: r.parameter,
                value: r.value,
                numericValue: r.numericValue,
                unit: r.unit,
                referenceMin: r.referenceMin,
                referenceMax: r.referenceMax,
                referenceRange: r.referenceRange,
                abnormalFlag: r.abnormalFlag,
                status: r.status,
                validatedAt: r.validatedAt,
                releasedAt: r.releasedAt,
              }));
              
              return {
                id: tc.code,
                testId: tc.code,
                testName: tc.name,
                name: tc.name,
                testCode: tc.code,
                sampleType: tc.sampleType,
                status: labResults.length > 0 ? 'completed' : 'pending',
                result: testResults.length > 0 ? {
                  parameters: testResults,
                  verifiedAt: testResults[0]?.validatedAt,
                  validatedAt: testResults[0]?.validatedAt,
                } : undefined,
              };
            }),
            sampleType: (order.testCodes?.[0]?.sampleType) || 'blood',
            priority: order.priority || 'routine',
            status: order.status || 'pending',
            clinicalNotes: order.clinicalNotes,
            orderedBy: order.orderedBy?.fullName,
            assignedTo: order.assignedTo,
            createdAt: order.createdAt,
            completedAt: order.completedAt,
          };
        });
    },
  },
};

export default labService;
