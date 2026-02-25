import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Loader2,
  Plus,
  Minus,
  Tag,
  Printer,
  AlertCircle,
  Package,
  Clock,
  Hash,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../../services/patients';
import { billingService, type CreateInvoiceDto, type Invoice } from '../../../services/billing';
import { servicesService, type Service } from '../../../services/services';
import { insuranceService } from '../../../services/insurance';
import { useAuthStore } from '../../../store/auth';
import { formatCurrency } from '../../../lib/currency';

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

// Helper to transform API patient to local Patient interface
const transformPatient = (apiPatient: ApiPatient): Patient => ({
  id: apiPatient.id,
  mrn: apiPatient.mrn,
  fullName: apiPatient.fullName,
  phone: apiPatient.phone || '',
  paymentType: (apiPatient.paymentType as 'cash' | 'insurance' | 'membership') || 'cash',
  insurance: apiPatient.paymentType === 'insurance' && apiPatient.insuranceProvider
    ? {
        provider: apiPatient.insuranceProvider,
        policyNumber: apiPatient.insurancePolicyNumber || '',
        copayPercent: 0,
        coverageLimit: 0,
        usedAmount: 0,
      }
    : undefined,
  membership: apiPatient.paymentType === 'membership' && apiPatient.membershipType
    ? {
        type: apiPatient.membershipType,
        discountPercent: 15,
      }
    : undefined,
});

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
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [billNumber, setBillNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [discountType, setDiscountType] = useState<DiscountType>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch services from API
  const { data: servicesData = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['services', facilityId],
    queryFn: () => servicesService.list(facilityId ? { facilityId } : {}),
    staleTime: 60000,
  });

  // Transform services to expected format
  const services = useMemo(() => {
    return servicesData.map((s: Service) => ({
      id: s.id,
      name: s.name,
      category: s.category?.name || 'Other',
      price: Number(s.basePrice) || 0,
    }));
  }, [servicesData]);

  // Patient search query
  const { data: patientSearchData, isLoading: isSearchingPatients } = useQuery({
    queryKey: ['patients', 'search', debouncedSearchTerm],
    queryFn: () => patientsService.search({ search: debouncedSearchTerm, limit: 10 }),
    enabled: debouncedSearchTerm.length >= 2,
    staleTime: 10000,
  });

  const patients = useMemo(() => {
    if (!patientSearchData?.data) return [];
    return patientSearchData.data.map(transformPatient);
  }, [patientSearchData]);

  // Fetch insurance policy for selected patient
  const { data: patientPolicies } = useQuery({
    queryKey: ['insurance-policy', selectedPatient?.id],
    queryFn: () => insuranceService.policies.getByPatient(selectedPatient!.id),
    enabled: !!selectedPatient && selectedPatient.paymentType === 'insurance',
    staleTime: 60000,
  });

  // Update selected patient's insurance details when policy loads
  useEffect(() => {
    if (patientPolicies && patientPolicies.length > 0 && selectedPatient?.paymentType === 'insurance') {
      const activePolicy = patientPolicies.find(p => p.status === 'active') || patientPolicies[0];
      setSelectedPatient(prev => prev ? {
        ...prev,
        insurance: {
          provider: activePolicy.provider?.name || prev.insurance?.provider || '',
          policyNumber: activePolicy.policyNumber || prev.insurance?.policyNumber || '',
          copayPercent: activePolicy.copayPercent ?? 20,
          coverageLimit: activePolicy.coverageLimit ?? 5000000,
          usedAmount: activePolicy.usedAmount ?? 0,
        },
      } : prev);
    }
  }, [patientPolicies]);

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (data: CreateInvoiceDto) => billingService.invoices.create(data),
    onSuccess: (invoice: Invoice) => {
      setBillNumber(invoice.invoiceNumber);
      setShowSuccess(true);
      toast.success('Invoice created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category));
    return ['all', ...Array.from(cats).sort()];
  }, [services]);

  const filteredServices = useMemo(() => {
    let filtered = services;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      filtered = filtered.filter(
        (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [serviceSearch, services, selectedCategory]);

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
    if (!selectedPatient || billItems.length === 0) {
      toast.error('Add a patient and at least one service to save draft');
      return;
    }
    const draft = {
      patientId: selectedPatient.id,
      patientName: selectedPatient.fullName,
      billItems,
      paymentMethod,
      discountType,
      discountValue,
      savedAt: new Date().toISOString(),
    };
    const drafts = JSON.parse(localStorage.getItem('bill-drafts') || '[]');
    // Replace existing draft for same patient or add new
    const idx = drafts.findIndex((d: any) => d.patientId === selectedPatient.id);
    if (idx >= 0) drafts[idx] = draft; else drafts.push(draft);
    localStorage.setItem('bill-drafts', JSON.stringify(drafts));
    toast.success('Draft saved successfully!');
  };

  const handleGenerateBill = () => {
    if (!selectedPatient) return;

    // Calculate discount amount
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = Math.round(subtotal * (discountValue / 100));
    } else {
      discountAmount = discountValue;
    }

    const invoiceData: CreateInvoiceDto = {
      patientId: selectedPatient.id,
      items: billItems.map((item) => ({
        serviceCode: item.serviceId,
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: discountType === 'percentage' ? discountValue : undefined,
      })),
      taxPercent: 18, // 18% VAT
      notes: `Payment method: ${paymentMethod}${discountAmount > 0 ? `, Discount applied: UGX ${discountAmount.toLocaleString()}` : ''}`,
    };

    createInvoiceMutation.mutate(invoiceData);
  };

  const isCreatingInvoice = createInvoiceMutation.isPending;

  if (showSuccess) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Created!</h2>
          <p className="text-gray-500 mb-6">Bill for <span className="font-medium text-gray-700">{selectedPatient?.fullName}</span></p>
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 mb-6 border border-blue-100">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wider mb-1">Invoice Number</p>
            <p className="text-3xl font-mono font-bold text-blue-700">{billNumber}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {billingCalculations.manualDiscount > 0 && (
              <div className="flex justify-between text-sm text-orange-600">
                <span>Discount</span>
                <span>-{formatCurrency(billingCalculations.manualDiscount)}</span>
              </div>
            )}
            {billingCalculations.membershipDiscount > 0 && (
              <div className="flex justify-between text-sm text-purple-600">
                <span>Membership Discount</span>
                <span>-{formatCurrency(billingCalculations.membershipDiscount)}</span>
              </div>
            )}
            {billingCalculations.insuranceCovers > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Insurance Covers</span>
                <span>-{formatCurrency(billingCalculations.insuranceCovers)}</span>
              </div>
            )}
            {billingCalculations.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax (18%)</span>
                <span className="font-medium">{formatCurrency(billingCalculations.tax)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold pt-3 border-t text-lg">
              <span>Total Due</span>
              <span className="text-blue-600">{formatCurrency(billingCalculations.totalDue)}</span>
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors">
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header with running total */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">New OPD Bill</h1>
              <p className="text-gray-500 text-sm">Create outpatient billing</p>
            </div>
          </div>
        </div>
        {billItems.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Running Total</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(billingCalculations.totalDue)}</p>
            </div>
            <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
              <Hash className="w-3.5 h-3.5" />
              {billItems.length} item{billItems.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient & Services */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Patient Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-gray-400" />
                Patient Selection
              </h2>
              {!selectedPatient && (
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Required
                </span>
              )}
            </div>
            {selectedPatient ? (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold text-lg">
                      {selectedPatient.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <span className="bg-white px-2 py-0.5 rounded font-mono">{selectedPatient.mrn}</span>
                        {selectedPatient.phone && <span>• {selectedPatient.phone}</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    Change
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-100">
                  {selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-2.5 py-1 rounded-lg">
                        <Shield className="w-3.5 h-3.5" />
                        <span className="font-medium">{selectedPatient.insurance.provider}</span>
                      </div>
                      <span className="text-gray-500">
                        Remaining: <span className="font-medium text-gray-700">{formatCurrency(selectedPatient.insurance.coverageLimit - selectedPatient.insurance.usedAmount)}</span>
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500">Co-pay: <span className="font-medium text-gray-700">{selectedPatient.insurance.copayPercent}%</span></span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'membership' && selectedPatient.membership && (
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1.5 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="font-medium">{selectedPatient.membership.type}</span>
                      </div>
                      <span className="text-gray-500">({selectedPatient.membership.discountPercent}% discount)</span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'cash' && (
                    <div className="flex items-center gap-1.5 text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg w-fit">
                      <Banknote className="w-3.5 h-3.5" />
                      <span className="font-medium">Self-Pay Patient</span>
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
                  {isSearchingPatients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                  )}
                </div>
                {searchTerm.length >= 2 && !isSearchingPatients && patients.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No patients found for "{searchTerm}"
                  </div>
                )}
                {patients.length > 0 && (
                  <div className="border rounded-xl mt-2 max-h-48 overflow-y-auto shadow-lg">
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
                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 text-left border-b last:border-b-0 transition-colors"
                      >
                        <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium text-sm flex-shrink-0">
                          {patient.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{patient.fullName}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <span className="font-mono">{patient.mrn}</span>
                            {patient.phone && <span>• {patient.phone}</span>}
                          </p>
                        </div>
                        {patient.paymentType !== 'cash' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${patient.paymentType === 'insurance' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                            {patient.paymentType}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Services Selection */}
          <div className="bg-white rounded-xl shadow-sm border p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-400" />
                Services & Procedures
              </h2>
              <span className="text-xs text-gray-400">{filteredServices.length} of {services.length}</span>
            </div>
            <div className="relative mb-3 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search services by name or category..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>
            {/* Category tabs */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 flex-shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'All Services' : cat}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingServices ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                  <span className="text-gray-500 text-sm">Loading services...</span>
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="font-medium text-gray-500 mb-1">
                    {serviceSearch ? `No services matching "${serviceSearch}"` : 'No services available'}
                  </p>
                  <p className="text-xs">
                    {serviceSearch ? 'Try a different search term' : 'Services need to be configured in Settings'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {filteredServices.map((service) => {
                    const isAdded = billItems.some(item => item.serviceId === service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => addService(service)}
                        className={`p-3 border rounded-xl text-left transition-all group ${
                          isAdded
                            ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
                            : 'hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-gray-900 text-sm leading-tight">{service.name}</p>
                          {isAdded && (
                            <span className="bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-1">
                              {billItems.find(i => i.serviceId === service.id)?.quantity || 0}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {service.category}
                          </span>
                          <span className="text-xs font-bold text-blue-600">{formatCurrency(service.price)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Bill Summary */}
        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-gray-400" />
            Bill Summary
            {billItems.length > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{billItems.length} item{billItems.length !== 1 ? 's' : ''}</span>
            )}
          </h2>

          {billItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-gray-500 mb-1">No items yet</p>
                <p className="text-xs">Select services from the left panel</p>
              </div>
            </div>
          ) : (
            <>
              {/* Bill Items */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {billItems.map((item, idx) => (
                  <div key={item.serviceId} className="p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.serviceId)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Qty</label>
                        <div className="flex items-center border rounded-lg bg-white overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.serviceId, item.quantity - 1)}
                            className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-center flex-1 font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.serviceId, item.quantity + 1)}
                            className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Unit Price</label>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateUnitPrice(item.serviceId, Number(e.target.value))}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm bg-white focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Total</label>
                        <p className="py-1.5 font-bold text-blue-600 text-sm">{formatCurrency(item.lineTotal)}</p>
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
              <div className="border-t pt-3 space-y-1.5 flex-shrink-0 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {billingCalculations.manualDiscount > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})</span>
                    <span>-{formatCurrency(billingCalculations.manualDiscount)}</span>
                  </div>
                )}
                {billingCalculations.membershipDiscount > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>Membership Discount</span>
                    <span>-{formatCurrency(billingCalculations.membershipDiscount)}</span>
                  </div>
                )}
                {billingCalculations.insuranceCovers > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Insurance Covers</span>
                    <span>-{formatCurrency(billingCalculations.insuranceCovers)}</span>
                  </div>
                )}
                {billingCalculations.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tax (18%)</span>
                    <span className="font-medium">{formatCurrency(billingCalculations.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-dashed">
                  <span>Total Due</span>
                  <span className="text-blue-600">{formatCurrency(billingCalculations.totalDue)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4 flex-shrink-0">
                <button
                  onClick={handleSaveDraft}
                  disabled={!selectedPatient || isCreatingInvoice}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 font-medium text-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Draft
                </button>
                <button
                  onClick={handleGenerateBill}
                  disabled={!selectedPatient || billItems.length === 0 || isCreatingInvoice}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 font-medium text-sm shadow-sm transition-colors"
                >
                  {isCreatingInvoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Receipt className="w-4 h-4" />
                  )}
                  {isCreatingInvoice ? 'Creating...' : 'Generate Invoice'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
