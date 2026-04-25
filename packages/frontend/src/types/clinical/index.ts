export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
}

export interface Encounter {
  id: string;
  visitNumber: string;
  patientId: string;
  patient?: Patient;
  facilityId: string;
  status: 'registered' | 'triage' | 'waiting' | 'in_consultation' | 'pending_lab' | 'pending_pharmacy' | 'pending_payment' | 'completed' | 'cancelled';
  type: 'opd' | 'ipd' | 'emergency';
  createdAt: string;
}

export interface Prescription {
  id: string;
  encounterId: string;
  status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    dosage?: string;
  }>;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface LabResult {
  id: string;
  sampleId: string;
  parameter: string;
  numericValue?: number;
  textValue?: string;
  abnormalFlag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  status: 'entered' | 'validated' | 'released';
}
