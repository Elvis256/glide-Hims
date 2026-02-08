import api from './api';

export interface SetupStatus {
  isSetupComplete: boolean;
  organizationName?: string;
  facilityName?: string;
}

export interface OrganizationData {
  name: string;
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
  enabledModules?: string[];
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
};

export default setupService;
