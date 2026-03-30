import api from './api';

export interface SetupStatus {
  isSetupComplete: boolean;
  deploymentMode: 'on-premise' | 'saas';
  organizationName?: string;
  facilityName?: string;
  tenantSlug?: string;
  tenantCount?: number;
}

export interface OrganizationData {
  name: string;
  slug?: string;
  type?: string;
  country?: string;
  logoUrl?: string;
}

export interface FacilityData {
  name: string;
  type: string;
  location?: string;
  phone?: string;
  email?: string;
}

export interface AdminUserData {
  fullName: string;
  email: string;
  username: string;
  password: string;
  phone?: string;
}

export interface SettingsData {
  currency?: string;
  timezone?: string;
  dateFormat?: string;
  facilityMode?: string;
  enabledModules?: string[];
}

export interface FacilityPreset {
  mode: string;
  name: string;
  description: string;
  icon: string;
  enabledModules: string[];
  facilityType: string;
  supportsMultiSite: boolean;
  singleUserMode: boolean;
  recommendedRoles: string[];
  notes: string[];
}

export interface InitializeSetupData {
  organization: OrganizationData;
  facility: FacilityData;
  admin: AdminUserData;
  settings?: SettingsData;
}

export interface InitializeSetupResponse {
  success: boolean;
  message: string;
  tenantId: string;
  facilityId: string;
  userId: string;
}

export interface TenantSetupData {
  facility: FacilityData;
  admin: AdminUserData;
  settings?: SettingsData;
}

export const setupService = {
  /**
   * Check if initial setup has been completed
   */
  getStatus: async (): Promise<SetupStatus> => {
    const response = await api.get<SetupStatus>('/setup/status');
    return response.data;
  },

  /**
   * Initialize the system with organization, facility, and admin user
   */
  initialize: async (data: InitializeSetupData): Promise<InitializeSetupResponse> => {
    const response = await api.post<InitializeSetupResponse>('/setup/initialize', data);
    return response.data;
  },

  /**
   * Register a new organization (self-service, post-setup)
   */
  registerTenant: async (data: InitializeSetupData): Promise<InitializeSetupResponse> => {
    const response = await api.post<InitializeSetupResponse>('/setup/register-tenant', data);
    return response.data;
  },

  /**
   * Initialize setup for an existing tenant (facility, admin, settings)
   */
  initializeTenant: async (slug: string, data: TenantSetupData): Promise<InitializeSetupResponse> => {
    const response = await api.post<InitializeSetupResponse>(`/setup/initialize-tenant/${slug}`, data);
    return response.data;
  },

  /**
   * Get available facility deployment mode presets
   */
  getPresets: async (): Promise<FacilityPreset[]> => {
    const response = await api.get<FacilityPreset[]>('/setup/presets');
    return response.data;
  },
};

export default setupService;
