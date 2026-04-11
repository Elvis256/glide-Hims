/**
 * Business configuration for Hospital HIMS
 * This is a pure hospital system - other business types (dental, optical, pharmacy standalone)
 * will be developed as independent systems in the future.
 */

export interface BusinessConfig {
  type: 'hospital';
  name: string;
  tagline: string;
  entityName: { singular: string; plural: string };
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

const hospitalConfig: BusinessConfig = {
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
};

export function getBusinessConfig(): BusinessConfig {
  return hospitalConfig;
}

export function useBusinessConfig(): BusinessConfig {
  return hospitalConfig;
}

export function useEntityName() {
  return hospitalConfig.entityName;
}
