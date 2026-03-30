// Re-export MedicationAdministration from prescription.entity.ts to avoid duplicate @Entity registration
export { MedicationAdministration } from './prescription.entity';

export enum MedicationStatus {
  SCHEDULED = 'scheduled',
  ADMINISTERED = 'administered',
  HELD = 'held',
  REFUSED = 'refused',
  MISSED = 'missed',
}
