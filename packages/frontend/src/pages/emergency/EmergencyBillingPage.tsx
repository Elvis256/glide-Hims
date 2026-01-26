import { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  User,
  Package,
  CreditCard,
  Shield,
  CheckCircle,
  XCircle,
  Plus,
  Minus,
  FileText,
  ArrowRight,
  DollarSign,
  Clock,
  AlertCircle,
  Printer,
} from 'lucide-react';

interface BillingItem {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface EmergencyPackage {
  id: string;
  name: string;
  items: string[];
  price: number;
}

interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  status: 'verified' | 'pending' | 'rejected';
  coverage: number;
}

const mockPatients = [
  { id: 'EM001', name: 'John Doe', age: 45, mrn: 'MRN-10045', arrivalTime: '10:30 AM', complaint: 'Chest pain' },
  { id: 'EM002', name: 'Mary Jane', age: 32, mrn: 'MRN-10046', arrivalTime: '10:45 AM', complaint: 'Abdominal pain' },
  { id: 'EM003', name: 'Robert Brown', age: 67, mrn: 'MRN-10047', arrivalTime: '11:00 AM', complaint: 'Difficulty breathing' },
];

const edServices = [
  { id: 'SVC001', name: 'ED Consultation', category: 'Consultation', price: 150 },
  { id: 'SVC002', name: 'IV Line Insertion', category: 'Procedure', price: 50 },
  { id: 'SVC003', name: 'Blood Draw', category: 'Lab', price: 25 },
  { id: 'SVC004', name: 'CBC', category: 'Lab', price: 35 },
  { id: 'SVC005', name: 'Basic Metabolic Panel', category: 'Lab', price: 45 },
  { id: 'SVC006', name: 'ECG', category: 'Diagnostic', price: 75 },
  { id: 'SVC007', name: 'X-Ray (Single View)', category: 'Radiology', price: 120 },
  { id: 'SVC008', name: 'CT Scan (Head)', category: 'Radiology', price: 450 },
  { id: 'SVC009', name: 'Wound Suturing', category: 'Procedure', price: 180 },
  { id: 'SVC010', name: 'Splinting', category: 'Procedure', price: 100 },
  { id: 'SVC011', name: 'Nebulization', category: 'Treatment', price: 40 },
  { id: 'SVC012', name: 'IM/IV Injection', category: 'Treatment', price: 20 },
  { id: 'SVC013', name: 'Oxygen Therapy (per hour)', category: 'Treatment', price: 30 },
  { id: 'SVC014', name: 'Cardiac Monitoring (per hour)', category: 'Monitoring', price: 60 },
];

const emergencyPackages: EmergencyPackage[] = [
  { id: 'PKG001', name: 'Basic ED Assessment', items: ['ED Consultation', 'Blood Draw', 'CBC'], price: 180 },
  { id: 'PKG002', name: 'Cardiac Workup', items: ['ED Consultation', 'ECG', 'CBC', 'Basic Metabolic Panel', 'Cardiac Monitoring'], price: 320 },
  { id: 'PKG003', name: 'Trauma Assessment', items: ['ED Consultation', 'X-Ray', 'Blood Draw', 'Wound Care'], price: 350 },
  { id: 'PKG004', name: 'Respiratory Care', items: ['ED Consultation', 'X-Ray Chest', 'Nebulization', 'Oxygen Therapy'], price: 280 },
];

export default function EmergencyBillingPage() {
  const [selectedPatient, setSelectedPatient] = useState<typeof mockPatients[0] | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [insurance, setInsurance] = useState<InsuranceInfo | null>(null);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);

  const filteredServices = useMemo(() => {
    if (!searchTerm) return edServices;
    return edServices.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const addItem = (service: typeof edServices[0]) => {
    const existing = billingItems.find(i => i.id === service.id);
    if (existing) {
      setBillingItems(prev => prev.map(i => 
        i.id === service.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setBillingItems(prev => [...prev, { ...service, quantity: 1 }]);
    }
  };

  const removeItem = (id: string) => {
    setBillingItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item && item.quantity > 1) {
        return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const addPackage = (pkg: EmergencyPackage) => {
    setBillingItems(prev => [...prev, {
      id: pkg.id,
      name: pkg.name,
      category: 'Package',
      price: pkg.price,
      quantity: 1,
    }]);
  };

  const subtotal = useMemo(() => 
    billingItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  , [billingItems]);

  const insuranceDiscount = useMemo(() => 
    insurance?.status === 'verified' ? subtotal * (insurance.coverage / 100) : 0
  , [subtotal, insurance]);

  const deposit = parseFloat(depositAmount) || 0;
  const total = subtotal - insuranceDiscount;
  const balance = total - deposit;

  const verifyInsurance = () => {
    // Simulate insurance verification
    setInsurance({
      provider: 'BlueCross Health',
      policyNumber: 'BC-123456789',
      status: 'verified',
      coverage: 80,
    });
    setShowInsuranceModal(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Receipt className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Billing</h1>
            <p className="text-sm text-gray-500">Quick billing for ED patients</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Left Panel - Patient Selection & Services */}
        <div className="col-span-2 flex flex-col gap-4 min-h-0">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" />
              Select ED Patient
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {mockPatients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`flex-shrink-0 p-3 rounded-lg border text-left transition-all ${
                    selectedPatient?.id === patient.id
                      ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-sm">{patient.name}</p>
                  <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y</p>
                  <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                    <Clock className="w-3 h-3" />
                    {patient.arrivalTime}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Packages */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-500" />
              Emergency Packages
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {emergencyPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => addPackage(pkg)}
                  disabled={!selectedPatient}
                  className="p-3 rounded-lg border hover:bg-gray-50 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm">{pkg.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{pkg.items.length} items</p>
                  <p className="text-sm font-semibold text-green-600 mt-1">${pkg.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center gap-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                ED Services
              </h3>
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search services..."
                  className="w-full pl-10 pr-4 py-1.5 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium">{service.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{service.category}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">${service.price}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => addItem(service)}
                          disabled={!selectedPatient}
                          className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel - Bill Summary */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Insurance */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-500" />
                Insurance
              </h3>
              <button
                onClick={() => setShowInsuranceModal(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Verify
              </button>
            </div>
            {insurance ? (
              <div className={`p-3 rounded-lg ${
                insurance.status === 'verified' ? 'bg-green-50 border border-green-200' :
                insurance.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {insurance.status === 'verified' ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : insurance.status === 'pending' ? (
                    <Clock className="w-4 h-4 text-yellow-600" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600" />
                  )}
                  <span className="font-medium text-sm">{insurance.provider}</span>
                </div>
                <p className="text-xs text-gray-500">Policy: {insurance.policyNumber}</p>
                <p className="text-xs text-green-600 mt-1">Coverage: {insurance.coverage}%</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No insurance verified</p>
            )}
          </div>

          {/* Bill Items */}
          <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Bill Summary</h3>
              {selectedPatient && (
                <p className="text-sm text-gray-500">{selectedPatient.name}</p>
              )}
            </div>
            <div className="flex-1 overflow-auto p-4">
              {billingItems.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <Receipt className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">No items added</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {billingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-gray-500">${item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">${item.price * item.quantity}</span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-red-500 hover:bg-red-100 rounded"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="border-t p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
              {insuranceDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Insurance ({insurance?.coverage}%)</span>
                  <span>-${insuranceDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Deposit & Payment */}
          <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collect Deposit</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="cash">Cash</option>
                <option value="card">Credit/Debit Card</option>
                <option value="mobile">Mobile Payment</option>
              </select>
            </div>
            {deposit > 0 && (
              <div className="flex justify-between p-2 bg-blue-50 rounded">
                <span className="text-sm text-blue-700">Balance Due</span>
                <span className="font-bold text-blue-700">${balance.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              disabled={!selectedPatient || billingItems.length === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Process Bill
            </button>
            <button
              disabled={!selectedPatient || billingItems.length === 0}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>

          {/* Convert to Admission */}
          <button
            disabled={!selectedPatient}
            className="w-full px-4 py-2 border-2 border-dashed border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            Convert to Admission Billing
          </button>
        </div>
      </div>

      {/* Insurance Verification Modal */}
      {showInsuranceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Quick Insurance Verification
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>BlueCross Health</option>
                  <option>Aetna</option>
                  <option>United Healthcare</option>
                  <option>Cigna</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter policy number" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Member ID</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter member ID" />
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    Emergency services may be covered at different rates. Verify coverage limits.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInsuranceModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={verifyInsurance}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
