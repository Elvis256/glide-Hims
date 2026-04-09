import { useAuthStore } from '../store/auth';

export type BusinessType = 'hospital' | 'pharmacy' | 'dental' | 'optical';

export interface BusinessConfig {
  type: BusinessType;
  name: string;
  tagline: string;
  entityName: { singular: string; plural: string };
  // Registration form: which sections to show
  registrationFields: {
    bloodGroup: boolean;
    religion: boolean;
    maritalStatus: boolean;
    nextOfKin: boolean;
    occupation: boolean;
    allergies: boolean;
    insurance: boolean;
  };
}

const configs: Record<BusinessType, BusinessConfig> = {
  hospital: {
    type: 'hospital',
    name: 'Hospital Management',
    tagline: 'Healthcare Information Management',
    entityName: { singular: 'Patient', plural: 'Patients' },
    registrationFields: {
      bloodGroup: true,
      religion: true,
      maritalStatus: true,
      nextOfKin: true,
      occupation: true,
      allergies: true,
      insurance: true,
    },
  },
  pharmacy: {
    type: 'pharmacy',
    name: 'Pharmacy Management',
    tagline: 'Pharmacy Management System',
    entityName: { singular: 'Customer', plural: 'Customers' },
    registrationFields: {
      bloodGroup: false,
      religion: false,
      maritalStatus: false,
      nextOfKin: false,
      occupation: false,
      allergies: true,
      insurance: true,
    },
  },
  dental: {
    type: 'dental',
    name: 'Dental Practice Management',
    tagline: 'Dental Practice Management',
    entityName: { singular: 'Patient', plural: 'Patients' },
    registrationFields: {
      bloodGroup: false,
      religion: false,
      maritalStatus: false,
      nextOfKin: true,
      occupation: false,
      allergies: true,
      insurance: true,
    },
  },
  optical: {
    type: 'optical',
    name: 'Optical Center Management',
    tagline: 'Optical Practice Management',
    entityName: { singular: 'Client', plural: 'Clients' },
    registrationFields: {
      bloodGroup: false,
      religion: false,
      maritalStatus: false,
      nextOfKin: false,
      occupation: false,
      allergies: true,
      insurance: true,
    },
  },
};

export function getBusinessConfig(businessType?: string): BusinessConfig {
  if (businessType && businessType in configs) {
    return configs[businessType as BusinessType];
  }
  return configs.hospital;
}

export function useBusinessConfig(): BusinessConfig {
  const user = useAuthStore((s) => s.user);
  return getBusinessConfig(user?.businessType);
}

export function useEntityName() {
  const config = useBusinessConfig();
  return config.entityName;
}
