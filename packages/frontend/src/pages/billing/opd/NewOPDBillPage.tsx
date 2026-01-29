import { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  UserCircle,
  Trash2,
  CheckCircle,
  ArrowLeft,
  Calculator,
  Shield,
  CreditCard,
  Banknote,
  Smartphone,
  Percent,
  DollarSign,
  Save,
  FileText,
} from 'lucide-react';

interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  copayPercent: number;
  coverageLimit: number;
  usedAmount: number;
}

interface MembershipInfo {
  type: string;
  discountPercent: number;
}

interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  phone: string;
  paymentType: 'cash' | 'insurance' | 'membership';
  insurance?: InsuranceInfo;
  membership?: MembershipInfo;
}

const mockPatients: Patient[] = [];

const services = [
  { id: 's1', name: 'General Consultation', category: 'Consultation', price: 50000 },
  { id: 's2', name: 'Specialist Consultation', category: 'Consultation', price: 150000 },
  { id: 's3', name: 'Follow-up Visit', category: 'Consultation', price: 30000 },
  { id: 's4', name: 'Complete Blood Count', category: 'Laboratory', price: 45000 },
  { id: 's5', name: 'Liver Function Test', category: 'Laboratory', price: 85000 },
  { id: 's6', name: 'Urinalysis', category: 'Laboratory', price: 25000 },
  { id: 's7', name: 'Chest X-Ray', category: 'Radiology', price: 120000 },
  { id: 's8', name: 'Abdominal Ultrasound', category: 'Radiology', price: 180000 },
  { id: 's9', name: 'ECG', category: 'Procedures', price: 80000 },
  { id: 's10', name: 'Wound Dressing', category: 'Procedures', price: 35000 },
  { id: 's11', name: 'IV Cannulation', category: 'Procedures', price: 25000 },
  { id: 's12', name: 'Nebulization', category: 'Procedures', price: 40000 },
];

interface BillItem {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'insurance';
type DiscountType = 'percentage' | 'fixed';

export default function NewOPDBillPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [billNumber, setBillNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);

  const patients = useMemo(() => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) => p.fullName.toLowerCase().includes(term) || p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(serviceSearch.toLowerCase())
    );
  }, [serviceSearch]);

  const addService = (service: (typeof services)[0]) => {
    const existing = billItems.find((item) => item.serviceId === service.id);
    if (existing) {
      setBillItems(
        billItems.map((item) =>
          item.serviceId === service.id
            ? { ...item, quantity: item.quantity + 1, lineTotal: (item.quantity + 1) * item.unitPrice }
            : item
        )
      );
    } else {
      setBillItems([
        ...billItems,
        {
          serviceId: service.id,
          name: service.name,
          quantity: 1,
          unitPrice: service.price,
          lineTotal: service.price,
        },
      ]);
    }
  };

  const updateQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(serviceId);
      return;
    }
    setBillItems(
      billItems.map((item) =>
        item.serviceId === serviceId ? { ...item, quantity, lineTotal: quantity * item.unitPrice } : item
      )
    );
  };

  const updateUnitPrice = (serviceId: string, price: number) => {
    setBillItems(
      billItems.map((item) =>
        item.serviceId === serviceId ? { ...item, unitPrice: price, lineTotal: item.quantity * price } : item
      )
    );
  };

  const removeItem = (serviceId: string) => {
    setBillItems(billItems.filter((item) => item.serviceId !== serviceId));
  };

  const subtotal = billItems.reduce((sum, item) => sum + item.lineTotal, 0);

  const billingCalculations = useMemo(() => {
    let manualDiscount = 0;
    if (discountType === 'percentage') {
      manualDiscount = Math.round(subtotal * (discountValue / 100));
    } else {
      manualDiscount = discountValue;
    }

    const afterManualDiscount = subtotal - manualDiscount;

    if (!selectedPatient) {
      const tax = Math.round(afterManualDiscount * 0.18);
      return { manualDiscount, insuranceCovers: 0, patientCopay: 0, membershipDiscount: 0, tax, totalDue: afterManualDiscount + tax };
    }

    if (selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && paymentMethod === 'insurance') {
      const remaining = selectedPatient.insurance.coverageLimit - selectedPatient.insurance.usedAmount;
      const copayPercent = selectedPatient.insurance.copayPercent;
      const patientCopay = Math.round(afterManualDiscount * (copayPercent / 100));
      const insuranceAmount = Math.min(afterManualDiscount - patientCopay, remaining);
      const actualPatientPay = afterManualDiscount - insuranceAmount;
      return {
        manualDiscount,
        insuranceCovers: insuranceAmount,
        patientCopay: actualPatientPay,
        membershipDiscount: 0,
        tax: 0,
        totalDue: actualPatientPay,
      };
    }

    if (selectedPatient.paymentType === 'membership' && selectedPatient.membership) {
      const membershipDiscountPercent = selectedPatient.membership.discountPercent;
      const membershipDiscount = Math.round(afterManualDiscount * (membershipDiscountPercent / 100));
      const afterMembership = afterManualDiscount - membershipDiscount;
      const tax = Math.round(afterMembership * 0.18);
      return {
        manualDiscount,
        insuranceCovers: 0,
        patientCopay: 0,
        membershipDiscount,
        tax,
        totalDue: afterMembership + tax,
      };
    }

    const tax = Math.round(afterManualDiscount * 0.18);
    return { manualDiscount, insuranceCovers: 0, patientCopay: 0, membershipDiscount: 0, tax, totalDue: afterManualDiscount + tax };
  }, [selectedPatient, subtotal, discountType, discountValue, paymentMethod]);

  const handleSaveDraft = () => {
    alert('Draft saved successfully!');
  };

  const handleGenerateBill = () => {
    const num = `OPD-${Date.now().toString().slice(-8)}`;
    setBillNumber(num);
    setShowSuccess(true);
  };

  if (showSuccess) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bill Generated!</h2>
          <p className="text-gray-500 mb-4">Bill for {selectedPatient?.fullName}</p>
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">Bill Number</p>
            <p className="text-2xl font-mono font-bold text-blue-700">{billNumber}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>UGX {subtotal.toLocaleString()}</span>
            </div>
            {billingCalculations.manualDiscount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Discount</span>
                <span>-UGX {billingCalculations.manualDiscount.toLocaleString()}</span>
              </div>
            )}
            {billingCalculations.membershipDiscount > 0 && (
              <div className="flex justify-between text-sm text-purple-600">
                <span>Membership Discount</span>
                <span>-UGX {billingCalculations.membershipDiscount.toLocaleString()}</span>
              </div>
            )}
            {billingCalculations.insuranceCovers > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Insurance Covers</span>
                <span>-UGX {billingCalculations.insuranceCovers.toLocaleString()}</span>
              </div>
            )}
            {billingCalculations.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (18%)</span>
                <span>UGX {billingCalculations.tax.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Total Due</span>
              <span className="text-blue-600">UGX {billingCalculations.totalDue.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSuccess(false);
                setSelectedPatient(null);
                setBillItems([]);
                setDiscountValue(0);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              New Bill
            </button>
            <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Print Bill
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">New OPD Bill</h1>
            <p className="text-gray-500 text-sm">Create outpatient billing</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient & Services */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Patient Selection</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-sm text-blue-600 hover:underline">
                    Change
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-100">
                  {selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && (
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-700">{selectedPatient.insurance.provider}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">
                        Limit: UGX {(selectedPatient.insurance.coverageLimit - selectedPatient.insurance.usedAmount).toLocaleString()}
                      </span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-600">Co-pay: {selectedPatient.insurance.copayPercent}%</span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'membership' && selectedPatient.membership && (
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-purple-700">{selectedPatient.membership.type}</span>
                      <span className="text-gray-500">({selectedPatient.membership.discountPercent}% discount)</span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'cash' && (
                    <div className="flex items-center gap-2 text-sm">
                      <Banknote className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-600">Self-Pay Patient</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or MRN..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                {patients.length > 0 && (
                  <div className="border rounded-lg mt-2 max-h-40 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setSearchTerm('');
                          if (patient.paymentType === 'insurance') {
                            setPaymentMethod('insurance');
                          }
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left border-b last:border-b-0"
                      >
                        <UserCircle className="w-8 h-8 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn} • {patient.phone}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Services Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">Services & Procedures</h2>
            <div className="relative mb-3 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => addService(service)}
                    className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 text-left transition-colors"
                  >
                    <p className="font-medium text-gray-900 text-sm">{service.name}</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">{service.category}</span>
                      <span className="text-xs font-semibold text-blue-600">UGX {service.price.toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bill Summary */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Bill Summary
          </h2>

          {billItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Add services to create bill</p>
              </div>
            </div>
          ) : (
            <>
              {/* Bill Items */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {billItems.map((item) => (
                  <div key={item.serviceId} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900 flex-1">{item.name}</p>
                      <button
                        onClick={() => removeItem(item.serviceId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="text-xs text-gray-500">Qty</label>
                        <div className="flex items-center border rounded bg-white">
                          <button
                            onClick={() => updateQuantity(item.serviceId, item.quantity - 1)}
                            className="px-2 py-1 text-gray-500 hover:bg-gray-100"
                          >
                            -
                          </button>
                          <span className="px-2 text-center flex-1">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.serviceId, item.quantity + 1)}
                            className="px-2 py-1 text-gray-500 hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Unit Price</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateUnitPrice(item.serviceId, Number(e.target.value))}
                          className="w-full px-2 py-1 border rounded text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Line Total</label>
                        <p className="py-1 font-semibold text-blue-600">UGX {item.lineTotal.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount Section */}
              <div className="border-t pt-3 mb-3 flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Apply Discount</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      discountType === 'percentage' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Percent className="w-3 h-3" />
                    %
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      discountType === 'fixed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <DollarSign className="w-3 h-3" />
                    Fixed
                  </button>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder={discountType === 'percentage' ? '0%' : '0'}
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="border-t pt-3 mb-3 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      paymentMethod === 'cash' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-50 text-gray-600'
                    } border`}
                  >
                    <Banknote className="w-4 h-4" />
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      paymentMethod === 'card' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-600'
                    } border`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Card
                  </button>
                  <button
                    onClick={() => setPaymentMethod('mobile_money')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      paymentMethod === 'mobile_money' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-50 text-gray-600'
                    } border`}
                  >
                    <Smartphone className="w-4 h-4" />
                    Mobile Money
                  </button>
                  {selectedPatient?.paymentType === 'insurance' && (
                    <button
                      onClick={() => setPaymentMethod('insurance')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        paymentMethod === 'insurance' ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-50 text-gray-600'
                      } border`}
                    >
                      <Shield className="w-4 h-4" />
                      Insurance
                    </button>
                  )}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-3 space-y-1 flex-shrink-0 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>UGX {subtotal.toLocaleString()}</span>
                </div>
                {billingCalculations.manualDiscount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})</span>
                    <span>-UGX {billingCalculations.manualDiscount.toLocaleString()}</span>
                  </div>
                )}
                {billingCalculations.membershipDiscount > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>Membership Discount</span>
                    <span>-UGX {billingCalculations.membershipDiscount.toLocaleString()}</span>
                  </div>
                )}
                {billingCalculations.insuranceCovers > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Insurance Covers</span>
                    <span>-UGX {billingCalculations.insuranceCovers.toLocaleString()}</span>
                  </div>
                )}
                {billingCalculations.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax (18%)</span>
                    <span>UGX {billingCalculations.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total Due</span>
                  <span className="text-blue-600">UGX {billingCalculations.totalDue.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4 flex-shrink-0">
                <button
                  onClick={handleSaveDraft}
                  disabled={!selectedPatient}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
                <button
                  onClick={handleGenerateBill}
                  disabled={!selectedPatient || billItems.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Receipt className="w-4 h-4" />
                  Generate Bill
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
