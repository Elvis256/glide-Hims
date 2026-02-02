/**
 * Hospital/Institution Settings
 * Stores hospital branding and contact information
 * Each hospital using Glide HIMS can customize their details
 */

const HOSPITAL_SETTINGS_KEY = 'glide_hospital_settings';

export interface HospitalSettings {
  name: string;
  tagline: string;
  logo?: string;
  registrationNumber: string;
  licenseNumber: string;
  taxId: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    emergency: string;
    email: string;
    website: string;
  };
}

// Default hospital settings (can be customized per installation)
const DEFAULT_HOSPITAL: HospitalSettings = {
  name: 'Your Hospital Name',
  tagline: 'Excellence in Healthcare',
  registrationNumber: '',
  licenseNumber: '',
  taxId: '',
  address: {
    street: '',
    city: 'Kampala',
    region: 'Central Region',
    postalCode: '',
    country: 'Uganda',
  },
  contact: {
    phone: '+256 700 000 000',
    emergency: '+256 700 999 999',
    email: 'info@hospital.co.ug',
    website: '',
  },
};

/**
 * Get hospital settings from localStorage
 */
export function getHospitalSettings(): HospitalSettings {
  try {
    const stored = localStorage.getItem(HOSPITAL_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_HOSPITAL, ...JSON.parse(stored) };
    }
  } catch {
    // Fall back to defaults
  }
  return DEFAULT_HOSPITAL;
}

/**
 * Save hospital settings to localStorage
 */
export function saveHospitalSettings(settings: Partial<HospitalSettings>): void {
  const current = getHospitalSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(HOSPITAL_SETTINGS_KEY, JSON.stringify(updated));
  // Dispatch event for components to react to settings change
  window.dispatchEvent(new CustomEvent('hospital-settings-changed', { detail: updated }));
}

/**
 * Get just the hospital name
 */
export function getHospitalName(): string {
  return getHospitalSettings().name;
}

/**
 * Get hospital contact info for printing
 */
export function getHospitalContactLine(): string {
  const settings = getHospitalSettings();
  return `${settings.contact.phone} | ${settings.contact.email}`;
}

/**
 * Get hospital address as single line
 */
export function getHospitalAddressLine(): string {
  const { address } = getHospitalSettings();
  const parts = [address.street, address.city, address.region, address.country].filter(Boolean);
  return parts.join(', ');
}

/**
 * Get formatted hospital header for receipts/documents
 */
export function getHospitalHeader(): { name: string; address: string; contact: string } {
  const settings = getHospitalSettings();
  return {
    name: settings.name,
    address: getHospitalAddressLine(),
    contact: getHospitalContactLine(),
  };
}

export default {
  getHospitalSettings,
  saveHospitalSettings,
  getHospitalName,
  getHospitalContactLine,
  getHospitalAddressLine,
  getHospitalHeader,
};
