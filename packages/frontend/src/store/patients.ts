import { create } from 'zustand';

export type PaymentType = 'cash' | 'insurance' | 'membership';

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

// Initial mock patients
const initialPatients: PatientRecord[] = [
  {
    id: '1',
    mrn: 'MRN-2024-0001',
    fullName: 'Sarah Nakimera',
    dateOfBirth: '1985-03-15',
    gender: 'female',
    phone: '+256 700 123 456',
    createdAt: '2024-01-15T10:30:00Z',
    paymentType: 'insurance',
    insurance: { provider: 'AAR Healthcare', policyNumber: 'AAR-2024-001234', expiryDate: '2025-12-31', status: 'active', requiresPreAuth: true, coPay: 10 },
  },
  {
    id: '2',
    mrn: 'MRN-2024-0002',
    fullName: 'James Okello',
    dateOfBirth: '1990-07-22',
    gender: 'male',
    phone: '+256 755 987 654',
    createdAt: '2024-02-20T09:15:00Z',
    paymentType: 'membership',
    membership: { type: 'Gold', cardNumber: 'MEM-GOLD-0002', expiryDate: '2025-06-30', discountPercent: 15, status: 'active' },
  },
  {
    id: '3',
    mrn: 'MRN-2024-0003',
    fullName: 'Grace Atim',
    dateOfBirth: '1978-11-08',
    gender: 'female',
    phone: '+256 780 456 789',
    createdAt: '2024-03-10T16:45:00Z',
    paymentType: 'cash',
  },
  {
    id: '4',
    mrn: 'MRN-2024-0004',
    fullName: 'Peter Ochen',
    dateOfBirth: '2010-05-30',
    gender: 'male',
    phone: '+256 701 234 567',
    createdAt: '2024-04-05T08:00:00Z',
    paymentType: 'insurance',
    insurance: { provider: 'Jubilee Insurance', policyNumber: 'JUB-2024-005678', expiryDate: '2025-12-31', status: 'active', requiresPreAuth: false, coPay: 20 },
  },
  {
    id: '5',
    mrn: 'MRN-2024-0005',
    fullName: 'Mary Apio',
    dateOfBirth: '1995-09-12',
    gender: 'female',
    phone: '+256 772 111 222',
    createdAt: '2024-05-18T11:20:00Z',
    paymentType: 'membership',
    membership: { type: 'Silver', cardNumber: 'MEM-SILV-0005', expiryDate: '2025-08-15', discountPercent: 10, status: 'active' },
  },
  {
    id: '6',
    mrn: 'MRN-2025-0001',
    fullName: 'David Otim',
    dateOfBirth: '1982-01-25',
    gender: 'male',
    phone: '+256 703 555 666',
    createdAt: '2025-01-10T14:30:00Z',
    paymentType: 'cash',
  },
];

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
