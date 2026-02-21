import { create } from 'zustand';

export type PaymentType = 'cash' | 'insurance' | 'membership' | 'corporate';

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  expiryDate: string;
  status?: 'active' | 'expired';
  requiresPreAuth?: boolean;
  coPay?: number;
}

export interface MembershipInfo {
  type: string;
  cardNumber: string;
  expiryDate: string;
  discountPercent?: number;
  status?: 'active' | 'expired';
}

export interface PatientRecord {
  id: string;
  mrn: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  nationalId?: string;
  occupation?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  allergies?: string;
  createdAt: string;
  paymentType: PaymentType;
  insurance?: InsuranceInfo;
  membership?: MembershipInfo;
  userId?: string; // Linked user account for biometric verification
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

interface PatientStore {
  patients: PatientRecord[];
  addPatient: (patient: PatientRecord) => void;
  getPatient: (id: string) => PatientRecord | undefined;
  searchPatients: (term: string) => PatientRecord[];
}

// Patient store starts empty - real data is fetched from the API via patientsService
const initialPatients: PatientRecord[] = [];

export const usePatientStore = create<PatientStore>((set, get) => ({
  patients: initialPatients,
  
  addPatient: (patient) => {
    set((state) => ({
      patients: [patient, ...state.patients],
    }));
  },
  
  getPatient: (id) => {
    return get().patients.find((p) => p.id === id);
  },
  
  searchPatients: (term) => {
    if (!term.trim() || term.length < 2) return [];
    const lowerTerm = term.toLowerCase();
    return get().patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(lowerTerm) ||
        p.mrn.toLowerCase().includes(lowerTerm) ||
        p.phone?.includes(term) ||
        p.nationalId?.toLowerCase().includes(lowerTerm)
    );
  },
}));
