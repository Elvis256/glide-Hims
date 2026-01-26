import { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Plus,
  Bed,
  Pill,
  Stethoscope,
  Activity,
  User,
  Calendar,
  DollarSign,
  FileText,
  Download,
  Printer,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

type ChargeCategory = 'Room' | 'Nursing' | 'Procedures' | 'Pharmacy' | 'Laboratory' | 'Radiology' | 'Consumables';

interface Charge {
  id: string;
  category: ChargeCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  date: string;
  addedBy: string;
}

interface InsuranceAuth {
  provider: string;
  policyNumber: string;
  authNumber: string;
  authLimit: number;
  usedAmount: number;
  status: 'Pending' | 'Approved' | 'Denied' | 'Exhausted';
  expiryDate: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  admissionDate: string;
  attendingDoctor: string;
  diagnosis: string;
  charges: Charge[];
  insurance?: InsuranceAuth;
  deposits: number;
  interimBillsPaid: number;
}

const mockPatients: Patient[] = [
  {
    id: 'P001',
    name: 'John Mwangi',
    age: 45,
    gender: 'Male',
    ward: 'General Ward A',
    bed: 'A-102',
    admissionDate: '2024-01-12',
    attendingDoctor: 'Dr. Sarah Kimani',
    diagnosis: 'Acute Appendicitis',
    deposits: 50000,
    interimBillsPaid: 25000,
    insurance: {
      provider: 'AAR Insurance',
      policyNumber: 'AAR-2024-12345',
      authNumber: 'AUTH-78901',
      authLimit: 200000,
      usedAmount: 85000,
      status: 'Approved',
      expiryDate: '2024-12-31',
    },
    charges: [
      { id: 'C001', category: 'Room', description: 'General Ward - Daily Rate', quantity: 4, unitPrice: 5000, date: '2024-01-12', addedBy: 'System' },
      { id: 'C002', category: 'Nursing', description: 'Nursing Care - General', quantity: 4, unitPrice: 2000, date: '2024-01-12', addedBy: 'System' },
      { id: 'C003', category: 'Procedures', description: 'Appendectomy - Laparoscopic', quantity: 1, unitPrice: 80000, date: '2024-01-13', addedBy: 'Dr. Sarah Kimani' },
      { id: 'C004', category: 'Pharmacy', description: 'IV Antibiotics - Ceftriaxone 1g', quantity: 8, unitPrice: 500, date: '2024-01-13', addedBy: 'Pharmacy' },
      { id: 'C005', category: 'Laboratory', description: 'Complete Blood Count', quantity: 2, unitPrice: 1500, date: '2024-01-12', addedBy: 'Lab' },
      { id: 'C006', category: 'Consumables', description: 'Surgical Consumables', quantity: 1, unitPrice: 15000, date: '2024-01-13', addedBy: 'Theatre' },
    ],
  },
  {
    id: 'P002',
    name: 'Mary Wanjiku',
    age: 32,
    gender: 'Female',
    ward: 'Maternity Ward',
    bed: 'MAT-01',
    admissionDate: '2024-01-14',
    attendingDoctor: 'Dr. James Otieno',
    diagnosis: 'Term pregnancy, scheduled C-section',
    deposits: 30000,
    interimBillsPaid: 0,
    charges: [
      { id: 'C007', category: 'Room', description: 'Maternity Ward - Daily Rate', quantity: 2, unitPrice: 4000, date: '2024-01-14', addedBy: 'System' },
      { id: 'C008', category: 'Nursing', description: 'Maternity Nursing Care', quantity: 2, unitPrice: 2500, date: '2024-01-14', addedBy: 'System' },
      { id: 'C009', category: 'Laboratory', description: 'Blood Group & Crossmatch', quantity: 1, unitPrice: 3000, date: '2024-01-14', addedBy: 'Lab' },
    ],
  },
  {
    id: 'P003',
    name: 'Peter Ochieng',
    age: 58,
    gender: 'Male',
    ward: 'ICU',
    bed: 'ICU-01',
    admissionDate: '2024-01-10',
    attendingDoctor: 'Dr. Anne Mutua',
    diagnosis: 'Cardiac arrest, post-resuscitation care',
    deposits: 100000,
    interimBillsPaid: 150000,
    insurance: {
      provider: 'Jubilee Insurance',
      policyNumber: 'JUB-2024-67890',
      authNumber: 'AUTH-45678',
      authLimit: 500000,
      usedAmount: 420000,
      status: 'Approved',
      expiryDate: '2024-06-30',
    },
    charges: [
      { id: 'C010', category: 'Room', description: 'ICU - Daily Rate', quantity: 6, unitPrice: 25000, date: '2024-01-10', addedBy: 'System' },
      { id: 'C011', category: 'Nursing', description: 'ICU Nursing Care - Intensive', quantity: 6, unitPrice: 8000, date: '2024-01-10', addedBy: 'System' },
      { id: 'C012', category: 'Procedures', description: 'Ventilator Support', quantity: 6, unitPrice: 15000, date: '2024-01-10', addedBy: 'ICU' },
      { id: 'C013', category: 'Pharmacy', description: 'IV Inotropes', quantity: 30, unitPrice: 2000, date: '2024-01-10', addedBy: 'Pharmacy' },
      { id: 'C014', category: 'Laboratory', description: 'Cardiac Enzymes Panel', quantity: 4, unitPrice: 5000, date: '2024-01-10', addedBy: 'Lab' },
      { id: 'C015', category: 'Radiology', description: 'Chest X-Ray', quantity: 3, unitPrice: 3000, date: '2024-01-11', addedBy: 'Radiology' },
    ],
  },
];

const chargeCategories: { value: ChargeCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'Room', label: 'Room Charges', icon: <Bed className="w-4 h-4" /> },
  { value: 'Nursing', label: 'Nursing Care', icon: <User className="w-4 h-4" /> },
  { value: 'Procedures', label: 'Procedures', icon: <Activity className="w-4 h-4" /> },
  { value: 'Pharmacy', label: 'Pharmacy', icon: <Pill className="w-4 h-4" /> },
  { value: 'Laboratory', label: 'Laboratory', icon: <Stethoscope className="w-4 h-4" /> },
  { value: 'Radiology', label: 'Radiology', icon: <Activity className="w-4 h-4" /> },
  { value: 'Consumables', label: 'Consumables', icon: <Receipt className="w-4 h-4" /> },
];

export default function InpatientBillingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<ChargeCategory>>(new Set(['Room', 'Procedures']));

  const filteredPatients = useMemo(() => {
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const calculateTotal = (charges: Charge[]) => {
    return charges.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
  };

  const groupChargesByCategory = (charges: Charge[]) => {
    const grouped: Record<ChargeCategory, Charge[]> = {
      Room: [],
      Nursing: [],
      Procedures: [],
      Pharmacy: [],
      Laboratory: [],
      Radiology: [],
      Consumables: [],
    };
    charges.forEach((c) => {
      grouped[c.category].push(c);
    });
    return grouped;
  };

  const toggleCategory = (category: ChargeCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const getInsuranceStatusBadge = (status: string) => {
    const colors = {
      Pending: 'bg-yellow-100 text-yellow-700',
      Approved: 'bg-green-100 text-green-700',
      Denied: 'bg-red-100 text-red-700',
      Exhausted: 'bg-orange-100 text-orange-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Receipt className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inpatient Billing</h1>
            <p className="text-sm text-gray-500">Manage patient charges and billing</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {filteredPatients.map((patient) => {
                const total = calculateTotal(patient.charges);
                const balance = total - patient.deposits - patient.interimBillsPaid;
                return (
                  <div
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedPatient?.id === patient.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{patient.name}</p>
                        <p className="text-sm text-gray-500">{patient.bed} • {patient.ward}</p>
                      </div>
                      {patient.insurance && (
                        <Shield className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Running Bill:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Balance:</span>
                      <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(balance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Billing Details */}
        {selectedPatient ? (
          <div className="flex-1 flex flex-col gap-6 overflow-hidden">
            {/* Patient Info & Summary */}
            <div className="grid grid-cols-3 gap-4">
              {/* Patient Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.age}y, {selectedPatient.gender}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Ward/Bed</p>
                    <p className="font-medium">{selectedPatient.bed}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Admitted</p>
                    <p className="font-medium">{selectedPatient.admissionDate}</p>
                  </div>
                </div>
              </div>

              {/* Billing Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  Billing Summary
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Charges:</span>
                    <span className="font-medium">{formatCurrency(calculateTotal(selectedPatient.charges))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Deposits:</span>
                    <span className="font-medium text-green-600">-{formatCurrency(selectedPatient.deposits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Interim Bills Paid:</span>
                    <span className="font-medium text-green-600">-{formatCurrency(selectedPatient.interimBillsPaid)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold">Balance Due:</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(calculateTotal(selectedPatient.charges) - selectedPatient.deposits - selectedPatient.interimBillsPaid)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Insurance Info */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Insurance
                </h3>
                {selectedPatient.insurance ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{selectedPatient.insurance.provider}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getInsuranceStatusBadge(selectedPatient.insurance.status)}`}>
                        {selectedPatient.insurance.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-gray-500">Auth: {selectedPatient.insurance.authNumber}</p>
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Limit Utilization:</span>
                        <span className="font-medium">
                          {formatCurrency(selectedPatient.insurance.usedAmount)} / {formatCurrency(selectedPatient.insurance.authLimit)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(selectedPatient.insurance.usedAmount / selectedPatient.insurance.authLimit) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-2">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No insurance on file</p>
                  </div>
                )}
              </div>
            </div>

            {/* Charges */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Itemized Charges</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddCharge(!showAddCharge)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Add Charge
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Interim Bill
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Export
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print
                  </button>
                </div>
              </div>

              {/* Add Charge Form */}
              {showAddCharge && (
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-5 gap-4">
                    <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500">
                      <option value="">Select Category</option>
                      {chargeCategories.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Description"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      placeholder="Quantity"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="number"
                      placeholder="Unit Price"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex gap-2">
                      <button className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddCharge(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Charges List */}
              <div className="flex-1 overflow-auto p-4">
                {Object.entries(groupChargesByCategory(selectedPatient.charges)).map(([category, charges]) => {
                  if (charges.length === 0) return null;
                  const categoryTotal = charges.reduce((sum, c) => sum + c.quantity * c.unitPrice, 0);
                  const isExpanded = expandedCategories.has(category as ChargeCategory);
                  const categoryInfo = chargeCategories.find((c) => c.value === category);

                  return (
                    <div key={category} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleCategory(category as ChargeCategory)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {categoryInfo?.icon}
                          <span className="font-medium text-gray-900">{category}</span>
                          <span className="text-sm text-gray-500">({charges.length} items)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-900">{formatCurrency(categoryTotal)}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="divide-y divide-gray-100">
                          {charges.map((charge) => (
                            <div key={charge.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{charge.description}</p>
                                <p className="text-sm text-gray-500">
                                  Added by {charge.addedBy} on {charge.date}
                                </p>
                              </div>
                              <div className="flex items-center gap-6 text-sm">
                                <div className="text-right">
                                  <p className="text-gray-500">Qty</p>
                                  <p className="font-medium">{charge.quantity}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-500">Unit Price</p>
                                  <p className="font-medium">{formatCurrency(charge.unitPrice)}</p>
                                </div>
                                <div className="text-right w-24">
                                  <p className="text-gray-500">Total</p>
                                  <p className="font-semibold">{formatCurrency(charge.quantity * charge.unitPrice)}</p>
                                </div>
                                <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer Total */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                      <Receipt className="w-4 h-4 inline mr-2" />
                      Generate Final Bill
                    </button>
                    <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Receive Payment
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Grand Total</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(calculateTotal(selectedPatient.charges))}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <Receipt className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to view billing details</p>
          </div>
        )}
      </div>
    </div>
  );
}
