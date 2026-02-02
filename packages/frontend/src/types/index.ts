// User types
export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  phone?: string;
  status: 'active' | 'inactive' | 'locked';
  facilityId?: string;
  facility?: Facility;
  roles?: string[];
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface Permission {
  id: string;
  code: string;
  description?: string;
}

export interface UserRole {
  id: string;
  role: Role;
  facility?: Facility;
  department?: Department;
}

// Facility types
export interface Tenant {
  id: string;
  name: string;
  status: string;
}

export interface Facility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'laboratory';
  location?: string;
  status: string;
  tenant: Tenant;
  parentFacility?: Facility;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  facility: Facility;
}

// Patient types
export interface Patient {
  id: string;
  mrn: string;
  nationalId?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

// Auth types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// API types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

// Encounter types
export type EncounterType = 'opd' | 'ipd' | 'emergency';
export type EncounterStatus = 
  | 'registered'
  | 'triage'
  | 'waiting'
  | 'in_consultation'
  | 'pending_lab'
  | 'pending_pharmacy'
  | 'pending_payment'
  | 'admitted'
  | 'discharged'
  | 'completed'
  | 'cancelled';

export interface Encounter {
  id: string;
  visitNumber: string;
  type: EncounterType;
  status: EncounterStatus;
  chiefComplaint?: string;
  queueNumber?: number;
  startTime: string;
  endTime?: string;
  patient: Patient;
  patientId: string;
  facilityId: string;
  departmentId?: string;
  department?: Department;
  attendingProvider?: User;
  createdAt: string;
}

// Vitals types
export interface Vital {
  id: string;
  temperature?: number;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  bloodGlucose?: number;
  painScale?: number;
  notes?: string;
  recordedAt: string;
  encounterId: string;
  recordedBy?: User;
}

// Clinical Note types
export interface Diagnosis {
  code: string;
  description: string;
  type: 'primary' | 'secondary';
}

export interface ClinicalNote {
  id: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnoses?: Diagnosis[];
  followUpDate?: string;
  followUpNotes?: string;
  encounterId: string;
  provider?: User;
  createdAt: string;
}

// Prescription types
export type PrescriptionStatus = 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';

export interface PrescriptionItem {
  id: string;
  drugCode: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  quantityDispensed: number;
  instructions?: string;
  isDispensed: boolean;
}

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  status: PrescriptionStatus;
  notes?: string;
  items: PrescriptionItem[];
  encounter: Encounter;
  prescribedBy?: User;
  createdAt: string;
}

// Billing types
export type InvoiceStatus = 'draft' | 'pending' | 'partially_paid' | 'paid' | 'cancelled' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'insurance' | 'cheque';

export interface InvoiceItem {
  id: string;
  serviceCode: string;
  description: string;
  chargeType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  amount: number;
  method: PaymentMethod;
  status: string;
  transactionReference?: string;
  notes?: string;
  paidAt: string;
  receivedBy?: User;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  notes?: string;
  dueDate?: string;
  items: InvoiceItem[];
  payments?: Payment[];
  patient: Patient;
  encounter?: Encounter;
  createdAt: string;
}

// Order types
export type OrderType = 'lab' | 'radiology' | 'pharmacy' | 'procedure';
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OrderPriority = 'routine' | 'urgent' | 'stat';

export interface TestCode {
  code: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  instructions?: string;
  clinicalNotes?: string;
  testCodes?: TestCode[];
  completedAt?: string;
  encounter: Encounter;
  encounterId: string;
  orderedBy?: User;
  completedBy?: User;
  createdAt: string;
}

// Inventory types
export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'return' | 'expired' | 'damaged';

export interface Item {
  id: string;
  code: string;
  name: string;
  category?: string;
  description?: string;
  unit: string;
  isDrug: boolean;
  requiresPrescription: boolean;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  status: string;
}

export interface StockBalance {
  id: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastMovementAt?: string;
  item: Item;
  itemId: string;
  facilityId: string;
}

export interface StockLedger {
  id: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  balanceAfter: number;
  movementType: MovementType;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  item: Item;
  createdBy?: User;
  createdAt: string;
}
