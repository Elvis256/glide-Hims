import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Receipt,
  Search,
  UserCircle,
  Plus,
  Trash2,
  CheckCircle,
  ArrowLeft,
  Calculator,
  Shield,
  CreditCard,
  Banknote,
  Loader2,
} from 'lucide-react';
import { patientsService, type Patient } from '../services/patients';
import { billingService } from '../services/billing';
import { servicesService } from '../services/services';

interface BillItem {
  serviceId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export default function NewBillPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [billNumber, setBillNumber] = useState('');
  const [billToInsurance, setBillToInsurance] = useState(true);

  // Search patients
  const { data: searchData, isLoading: searchingPatients } = useQuery({
    queryKey: ['patients', 'search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm }),
    enabled: searchTerm.length >= 2,
    staleTime: 10000,
  });
  
  const searchResults = searchData?.data || [];

  // Fetch services for billing
  const { data: servicesData = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list(),
    staleTime: 60000,
  });

  const services = servicesData.map(s => ({
    id: s.id,
    name: s.name,
    category: s.category?.name || 'General',
    price: s.basePrice || 0,
  }));

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPatient) throw new Error('No patient selected');
      if (billItems.length === 0) throw new Error('No items in bill');
      
      // Create invoice with items included
      const invoice = await billingService.invoices.create({
        patientId: selectedPatient.id,
        items: billItems.map(item => ({
          serviceCode: item.serviceId,
          description: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
      });
      return invoice;
    },
    onSuccess: (data) => {
      setBillNumber(data.invoiceNumber || `BILL-${Date.now()}`);
      setShowSuccess(true);
    },
    onError: (error) => {
      console.error('Failed to create bill:', error);
      toast.error('Failed to create bill. Please try again.');
    },
  });

  const filteredServices = useMemo(() => {
    if (!serviceSearch.trim()) return services.slice(0, 10);
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(serviceSearch.toLowerCase())
    );
  }, [serviceSearch, services]);

  const addService = (service: typeof services[0]) => {
    const existing = billItems.find((item) => item.serviceId === service.id);
    if (existing) {
      setBillItems(
        billItems.map((item) =>
          item.serviceId === service.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
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
          price: service.price,
          total: service.price,
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
        item.serviceId === serviceId
          ? { ...item, quantity, total: quantity * item.price }
          : item
      )
    );
  };

  const removeItem = (serviceId: string) => {
    setBillItems(billItems.filter((item) => item.serviceId !== serviceId));
  };

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  
  // Calculate amounts based on payment type - simplified for now
  const billingCalculations = useMemo(() => {
    if (!selectedPatient) {
      return { insuranceCovers: 0, patientCopay: 0, discount: 0, totalDue: subtotal };
    }

    if (selectedPatient.paymentType === 'insurance' && billToInsurance) {
      // Default 20% copay for insurance if not specified - would come from insurance API
      const copayPercent = 20;
      const patientCopay = Math.round(subtotal * (copayPercent / 100));
      const insuranceAmount = subtotal - patientCopay;
      return {
        insuranceCovers: insuranceAmount,
        patientCopay: patientCopay,
        copayPercent,
        discount: 0,
        totalDue: patientCopay,
      };
    }

    if (selectedPatient.paymentType === 'membership') {
      // Default 10% discount for membership - would come from membership API
      const discountPercent = 10;
      const discount = Math.round(subtotal * (discountPercent / 100));
      return {
        insuranceCovers: 0,
        patientCopay: 0,
        discount,
        discountPercent,
        totalDue: subtotal - discount,
      };
    }

    return { insuranceCovers: 0, patientCopay: 0, discount: 0, totalDue: subtotal };
  }, [selectedPatient, subtotal, billToInsurance]);

  const grandTotal = billingCalculations.totalDue;

  const handleCreateBill = () => {
    createInvoiceMutation.mutate();
  };

  if (showSuccess) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Bill Created!</h2>
          <p className="text-gray-500 text-sm mb-3">
            Bill for {selectedPatient?.fullName}
          </p>
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-gray-600">Bill Number</p>
            <p className="text-xl font-mono font-bold text-blue-700">{billNumber}</p>
          </div>
          
          {/* Payment Breakdown */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>UGX {subtotal.toLocaleString()}</span>
            </div>
            {selectedPatient?.paymentType === 'insurance' && billToInsurance && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Insurance Covers</span>
                  <span>-UGX {billingCalculations.insuranceCovers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Patient Co-pay (20%)</span>
                  <span>UGX {billingCalculations.patientCopay.toLocaleString()}</span>
                </div>
              </>
            )}
            {selectedPatient?.paymentType === 'membership' && (
              <div className="flex justify-between text-green-600">
                <span>Membership Discount (10%)</span>
                <span>-UGX {billingCalculations.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-1 border-t">
              <span>Total Due</span>
              <span className="text-blue-600">UGX {grandTotal.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSuccess(false);
                setSelectedPatient(null);
                setBillItems([]);
                setBillToInsurance(true);
              }}
              className="btn-secondary flex-1"
            >
              New Bill
            </button>
            <button
              onClick={() => navigate('/billing/reception/payment')}
              className="btn-primary flex-1"
            >
              Collect Payment
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
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Bill</h1>
            <p className="text-gray-500 text-sm">Create a new patient bill</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient & Services */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Patient Selection */}
          <div className="card p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">Patient</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600 hover:underline">
                    Change
                  </button>
                </div>
                {/* Payment Type Info */}
                <div className="mt-2 pt-2 border-t border-blue-100">
                  {selectedPatient.paymentType === 'insurance' && selectedPatient.insuranceProvider && (
                    <div className="flex items-center gap-2 text-xs">
                      <Shield className="w-4 h-4 text-green-600" />
                      <div className="flex-1">
                        <span className="font-medium text-green-700">{selectedPatient.insuranceProvider}</span>
                        <span className="text-gray-500 ml-2">Policy: {selectedPatient.insurancePolicyNumber}</span>
                      </div>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'membership' && selectedPatient.membershipType && (
                    <div className="flex items-center gap-2 text-xs">
                      <CreditCard className="w-4 h-4 text-purple-600" />
                      <span className="font-medium text-purple-700">{selectedPatient.membershipType}</span>
                    </div>
                  )}
                  {(!selectedPatient.paymentType || selectedPatient.paymentType === 'cash') && (
                    <div className="flex items-center gap-2 text-xs">
                      <Banknote className="w-4 h-4 text-gray-600" />
                      <span className="text-gray-600">Cash Payment</span>
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
                    placeholder="Search patient..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-9 py-2 text-sm"
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="border rounded mt-2 max-h-32 overflow-y-auto">
                    {searchResults.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => { setSelectedPatient(patient); setSearchTerm(''); }}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                      >
                        <UserCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Services */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">Add Services</h2>
            <div className="relative mb-3 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="input pl-9 py-2 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => addService(service)}
                    className="p-2 border rounded hover:border-blue-300 hover:bg-blue-50 text-left text-sm"
                  >
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-500">{service.category}</span>
                      <span className="text-xs font-medium text-blue-600">
                        UGX {service.price.toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bill Summary */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            Bill Summary
          </h2>

          {billItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <p>Add services to the bill</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2">
                {billItems.map((item) => (
                  <div key={item.serviceId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        UGX {item.price.toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded">
                        <button
                          onClick={() => updateQuantity(item.serviceId, item.quantity - 1)}
                          className="px-2 py-1 text-gray-500 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="px-2 text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.serviceId, item.quantity + 1)}
                          className="px-2 py-1 text-gray-500 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.serviceId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-3 mt-3 space-y-1 flex-shrink-0 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>UGX {subtotal.toLocaleString()}</span>
                </div>
                
                {/* Insurance billing */}
                {selectedPatient?.paymentType === 'insurance' && billToInsurance && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Insurance Covers</span>
                      <span>-UGX {billingCalculations.insuranceCovers.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Patient Co-pay (20%)</span>
                      <span>UGX {billingCalculations.patientCopay.toLocaleString()}</span>
                    </div>
                  </>
                )}
                
                {/* Membership discount */}
                {selectedPatient?.paymentType === 'membership' && (
                  <div className="flex justify-between text-green-600">
                    <span>Membership (10%)</span>
                    <span>-UGX {billingCalculations.discount.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-base font-bold pt-1">
                  <span>Total Due</span>
                  <span className="text-blue-600">UGX {grandTotal.toLocaleString()}</span>
                </div>
              </div>
              
              {/* Insurance Toggle */}
              {selectedPatient?.paymentType === 'insurance' && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-gray-50 rounded text-xs">
                  <button
                    onClick={() => setBillToInsurance(true)}
                    className={`flex-1 py-1.5 rounded font-medium transition-colors ${
                      billToInsurance ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border'
                    }`}
                  >
                    Bill to Insurance
                  </button>
                  <button
                    onClick={() => setBillToInsurance(false)}
                    className={`flex-1 py-1.5 rounded font-medium transition-colors ${
                      !billToInsurance ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'
                    }`}
                  >
                    Bill to Patient
                  </button>
                </div>
              )}

              <button
                onClick={handleCreateBill}
                disabled={!selectedPatient || billItems.length === 0}
                className="btn-primary mt-4 flex-shrink-0 disabled:opacity-50"
              >
                Create Bill
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
