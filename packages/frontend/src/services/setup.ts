import api from './api';

export interface LicenseDefaults {
  organizationName: string;
  enabledModules: string[];
  maxFacilities: number;
  maxUsers: number;
  licenseType: string;
  suggestedPreset?: string;
  features?: Record<string, boolean>;
}

export interface SetupStatus {
  isSetupComplete: boolean;
  deploymentMode: 'on-premise' | 'saas';
  organizationName?: string;
  facilityName?: string;
  tenantSlug?: string;
  tenantCount?: number;
  licenseDefaults?: LicenseDefaults;
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
    couponCode?: string;
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
    let systemNotInitialized = false;
    try {
      // First, check if system is initialized with tenants (multi-tenant mode)
      const systemStatus = await api.get('/system/initialized');
      if (systemStatus.data && systemStatus.data.initialized === false) {
        systemNotInitialized = true;
        // Don't return early — fall through to /setup/status to get correct deploymentMode
      }
    } catch (err) {
      // Fall through to setup status check
      console.log('[setupService] Multi-tenant check failed, falling back to legacy setup check');
    }

    // Get setup status (has correct deploymentMode from DEPLOYMENT_MODE env var)
    try {
      const response = await api.get<SetupStatus>('/setup/status');
      if (systemNotInitialized) {
        // Override: system has no tenants, so setup is not complete
        return {
          ...response.data,
          isSetupComplete: false,
          tenantCount: 0,
        };
      }
      return response.data;
    } catch (err) {
      // If both fail (backend not ready), assume setup NOT complete (safer default)
      return {
        isSetupComplete: false,
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
  getPublicPlans: async (currency?: string): Promise<PublicPlan[]> => {
    const response = await api.get<PublicPlan[]>('/saas-revenue/public/plans', { params: currency ? { currency } : undefined });
    return (response.data as any) ?? [];
  },
};

export default setupService;
