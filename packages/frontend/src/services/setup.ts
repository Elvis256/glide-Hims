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
  workflowMode?: 'simple' | 'departmental';
}

export interface FacilityPreset {
  mode: string;
  businessType: string;
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
  plan?: {
    code: string;
    billingInterval?: 'monthly' | 'annual';
  };
}

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  tier: string;
  priceMonthlyMinor: number;
  priceAnnualMinor: number;
  currency: string;
  annualDiscountPercent: number;
  trialDays: number;
  maxUsers: number | null;
  maxFacilities: number | null;
  enabledModules: string[] | null;
  features?: any;
  sortOrder: number;
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
    try {
      // First, check if system is initialized with tenants (multi-tenant mode)
      const systemStatus = await api.get('/system/initialized');
      if (systemStatus.data && systemStatus.data.initialized === false) {
        // System not initialized - show onboarding
        return {
          isSetupComplete: false,
          deploymentMode: 'saas',
          tenantCount: 0,
        };
      }
    } catch (err) {
      // Fall through to old setup check
      console.log('[setupService] Multi-tenant check failed, falling back to legacy setup check');
    }

    // Fall back to legacy setup status endpoint
    try {
      const response = await api.get<SetupStatus>('/setup/status');
      return response.data;
    } catch (err) {
      // If both fail, assume setup is complete
      return {
        isSetupComplete: true,
        deploymentMode: 'on-premise',
      };
    }
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

  /**
   * Get public pricing plans for the signup wizard.
   */
  getPublicPlans: async (): Promise<PublicPlan[]> => {
    const response = await api.get<PublicPlan[]>('/saas-revenue/public/plans');
    return (response.data as any) ?? [];
  },
};

export default setupService;
