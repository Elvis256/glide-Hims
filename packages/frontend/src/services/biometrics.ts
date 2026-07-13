import api from './api';
import type { FingerIndex } from './secugen';

export interface BiometricEnrollment {
  enrolled: boolean;
  fingers: FingerIndex[];
}

export interface BiometricRecord {
  id: string;
  fingerIndex: FingerIndex;
  qualityScore?: number;
  registeredAt: string;
  lastVerifiedAt?: string;
}

export interface StaffCoverage {
  hasEmployee: boolean;
  coverage: {
    enabled: boolean;
    planType?: string;
    validFrom?: string;
    validUntil?: string;
    coverageLimit?: number;
    usedAmount?: number;
    remainingAmount?: number;
    expired?: boolean;
  } | null;
}

export interface RegisterBiometricDto {
  userId: string;
  fingerIndex: FingerIndex;
  templateData: string;
  qualityScore?: number;
}

export const biometricsService = {
  /**
   * Check if a user has registered fingerprints
   */
  async checkEnrollment(userId: string): Promise<BiometricEnrollment> {
    const response = await api.get<{ data: BiometricEnrollment }>(`/biometrics/check/${userId}`);
    return response.data.data;
  },

  /**
   * Get fingerprint templates for verification
   */
  async getTemplates(userId: string): Promise<{ templates: { fingerIndex: FingerIndex; templateData: string }[] }> {
    const response = await api.get<{ data: { templates: { fingerIndex: FingerIndex; templateData: string }[] } }>(`/biometrics/templates/${userId}`);
    return response.data.data;
  },

  /**
   * Get all biometric records for a user
   */
  async getUserBiometrics(userId: string): Promise<BiometricRecord[]> {
    const response = await api.get<{ data: BiometricRecord[] }>(`/biometrics/user/${userId}`);
    return response.data.data;
  },

  /**
   * Register a fingerprint
   */
  async register(dto: RegisterBiometricDto): Promise<BiometricRecord> {
    const response = await api.post<{ data: BiometricRecord }>('/biometrics/register', dto);
    return response.data.data;
  },

  /**
   * Record a successful verification
   */
  async recordVerification(userId: string, fingerIndex: FingerIndex): Promise<void> {
    await api.post('/biometrics/verify', { userId, fingerIndex });
  },

  /**
   * Delete a fingerprint
   */
  async deleteFingerprint(userId: string, fingerIndex: FingerIndex): Promise<void> {
    await api.delete(`/biometrics/${userId}/${fingerIndex}`);
  },

  /**
   * Check staff insurance coverage
   */
  async checkStaffCoverage(userId: string): Promise<StaffCoverage> {
    const response = await api.get<{ data: StaffCoverage }>(`/biometrics/staff-coverage/${userId}`);
    return response.data.data;
  },

  /**
   * Update staff insurance coverage
   */
  async updateStaffCoverage(userId: string, coverage: {
    enabled: boolean;
    planType?: string;
    validFrom?: string;
    validUntil?: string;
    coverageLimit?: number;
    usedAmount?: number;
  }): Promise<void> {
    await api.post(`/biometrics/staff-coverage/${userId}`, coverage);
  },
};
