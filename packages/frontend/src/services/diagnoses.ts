import api from './api';

export interface Diagnosis {
  id: string;
  icd10Code: string;
  name: string;
  shortName?: string;
  description?: string;
  category: string;
  chapterCode?: string;
  chapterName?: string;
  blockCode?: string;
  blockName?: string;
  isNotifiable: boolean;
  isChronic: boolean;
  isActive: boolean;
  synonyms?: string[];
  relatedCodes?: string[];
}

export interface WHOSearchResult {
  code: string;
  title: string;
  version: 'ICD-10' | 'ICD-11';
  chapter?: string;
  score: number;
}

export const diagnosesService = {
  // Search diagnoses (handles both response shapes: raw array or { data, total })
  search: async (params?: {
    search?: string;
    category?: string;
    isNotifiable?: boolean;
    isChronic?: boolean;
    limit?: number;
    page?: number;
  }): Promise<{ data: Diagnosis[]; total: number }> => {
    const response = await api.get('/diagnoses', { params });
    // Handle both paginated { data, total } and legacy raw array
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    return response.data;
  },

  // Alias used by DifferentialDxPage — searches local DB then falls back gracefully
  searchICD: async (query: string): Promise<Diagnosis[]> => {
    if (!query || query.length < 2) return [];
    const response = await api.get('/diagnoses', { params: { search: query, limit: 20 } });
    if (Array.isArray(response.data)) return response.data;
    return response.data?.data || [];
  },

  // Get diagnosis by ID
  getOne: async (id: string): Promise<Diagnosis> => {
    const response = await api.get(`/diagnoses/${id}`);
    return response.data;
  },

  // Get diagnosis by code
  getByCode: async (code: string): Promise<Diagnosis> => {
    const response = await api.get(`/diagnoses/code/${code}`);
    return response.data;
  },

  // Create diagnosis
  create: async (data: Partial<Diagnosis>): Promise<Diagnosis> => {
    const response = await api.post('/diagnoses', data);
    return response.data.data;
  },

  // Update diagnosis
  update: async (id: string, data: Partial<Diagnosis>): Promise<Diagnosis> => {
    const response = await api.patch(`/diagnoses/${id}`, data);
    return response.data.data;
  },

  // Delete diagnosis
  delete: async (id: string): Promise<void> => {
    await api.delete(`/diagnoses/${id}`);
  },

  // Seed common diagnoses
  seed: async (): Promise<{ message: string; data: any }> => {
    const response = await api.post('/diagnoses/seed');
    return response.data;
  },

  // Get categories
  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/diagnoses/categories');
    return response.data;
  },

  // Get chronic conditions
  getChronicConditions: async (): Promise<Diagnosis[]> => {
    const response = await api.get('/diagnoses/chronic');
    return response.data;
  },

  // Get notifiable diseases
  getNotifiableDiseases: async (): Promise<Diagnosis[]> => {
    const response = await api.get('/diagnoses/notifiable');
    return response.data;
  },

  // ========== WHO ICD API ==========

  // Check WHO API status
  getWHOStatus: async (): Promise<{ configured: boolean; message: string }> => {
    const response = await api.get('/diagnoses/who/status');
    return response.data;
  },

  // Search WHO ICD API (real-time from WHO)
  searchWHO: async (query: string, version: 'icd10' | 'icd11' | 'both' = 'both', lang = 'en'): Promise<{
    data: WHOSearchResult[];
    source: string;
    version: string;
    count: number;
    error?: boolean;
    message?: string;
  }> => {
    const response = await api.get('/diagnoses/who/search', {
      params: { q: query, version, lang },
    });
    return response.data;
  },

  // Import single code from WHO to local database
  importFromWHO: async (code: string, version: 'ICD-10' | 'ICD-11' = 'ICD-10'): Promise<{
    success: boolean;
    message: string;
    data?: Diagnosis;
  }> => {
    const response = await api.post('/diagnoses/who/import', { code, version });
    return response.data;
  },

  // Seed local ICD code database
  seedLocalCodes: async (): Promise<{ message: string; seeded: number }> => {
    const response = await api.post('/diagnoses/who/seed');
    return response.data;
  },

  // Bulk import from WHO search results
  bulkImportFromWHO: async (codes: Array<{ code: string; title: string; chapter?: string }>): Promise<{
    success: boolean;
    message: string;
    imported: number;
  }> => {
    const response = await api.post('/diagnoses/who/bulk-import', { codes });
    return response.data;
  },
};

export default diagnosesService;
