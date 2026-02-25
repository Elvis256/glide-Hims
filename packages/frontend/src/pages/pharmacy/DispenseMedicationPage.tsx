import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  Pill,
  User,
  CheckCircle,
  Package,
  AlertTriangle,
  Printer,
  ClipboardCheck,
  ArrowRight,
  FileText,
  Shield,
  Loader2,
  XCircle,
  ShoppingBag,
  RefreshCw,
  Phone,
  CreditCard,
  Home,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { prescriptionsService, type Prescription, type PrescriptionItem } from '../../services/prescriptions';
import { storesService } from '../../services/stores';

type DispenseStep = 'search' | 'verify' | 'pick' | 'check' | 'dispense';

const steps: { key: DispenseStep; label: string; icon: React.ReactNode }[] = [
  { key: 'search', label: 'Search', icon: <Search className="w-4 h-4" /> },
  { key: 'verify', label: 'Verify', icon: <Shield className="w-4 h-4" /> },
  { key: 'pick', label: 'Pick', icon: <Package className="w-4 h-4" /> },
  { key: 'check', label: 'Check', icon: <ClipboardCheck className="w-4 h-4" /> },
  { key: 'dispense', label: 'Dispense', icon: <CheckCircle className="w-4 h-4" /> },
];

// Common counseling points for drug categories
const counselingPoints: Record<string, string[]> = {
  antibiotic: [
    'Complete the full course even if feeling better',
    'Take at evenly spaced intervals',
    'May cause stomach upset - take with food if needed',
    'Avoid alcohol during treatment',
  ],
  analgesic: [
    'Do not exceed recommended dose',
    'Avoid alcohol while taking this medication',
    'Take with food to reduce stomach irritation',
    'Contact doctor if pain persists beyond 7 days',
  ],
  antihypertensive: [
    'Take at the same time each day',
    'Do not stop abruptly - may cause rebound hypertension',
    'Monitor blood pressure regularly',
    'Rise slowly from sitting to prevent dizziness',
  ],
  antidiabetic: [
    'Take as directed with meals',
    'Monitor blood sugar regularly',
    'Carry glucose tablets for hypoglycemia',
    'Report any unusual symptoms to your doctor',
  ],
  anticoagulant: [
    'Watch for signs of bleeding',
    'Maintain consistent vitamin K intake',
    'Avoid NSAIDs without doctor approval',
    'Regular INR monitoring required',
  ],
  nsaid: [
    'Take with food to protect stomach',
    'Do not exceed recommended dose',
    'Avoid if you have stomach ulcers',
    'May interact with blood thinners',
  ],
  default: [
    'Take as directed by your doctor',
    'Report any unusual side effects',
    'Store in a cool, dry place',
    'Keep out of reach of children',
  ],
};

export default function DispenseMedicationPage() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();

  if (!hasPermission('pharmacy.read')) {
    return <AccessDenied />;
  }

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState<DispenseStep>('search');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [counselingComplete, setCounselingComplete] = useState(false);
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [outOfStockItems, setOutOfStockItems] = useState<Set<string>>(new Set());
  const [externalPurchaseItems, setExternalPurchaseItems] = useState<Set<string>>(new Set());
  const [substituteNotes, setSubstituteNotes] = useState<Record<string, string>>({});
  const [dispensedInfo, setDispensedInfo] = useState<{ patientName: string; itemCount: number; oosCount: number; total: number } | null>(null);

  // Fetch pending prescriptions
  const { data: prescriptionsData, isLoading } = useQuery({
    queryKey: ['prescriptions', 'pending'],
    queryFn: () => prescriptionsService.getPending(),
    staleTime: 30000,
  });

  // Search prescriptions
  const { data: searchResults } = useQuery({
    queryKey: ['prescriptions', 'search', searchTerm],
    queryFn: () => prescriptionsService.search(searchTerm),
    enabled: searchTerm.length >= 2,
    staleTime: 10000,
  });

  // Fetch inventory for drug prices and stock — get all items
  const { data: inventoryData } = useQuery({
    queryKey: ['stores', 'inventory', 'all'],
    queryFn: () => storesService.inventory.list({ limit: 500 }),
    staleTime: 60000,
  });

  // Create maps for drug matching (by name, generic name, and code)
  const inventoryLookup = useMemo(() => {
    const byName = new Map<string, { price: number; stock: number; name: string }>();
    const byGeneric = new Map<string, { price: number; stock: number; name: string }>();
    const byCode = new Map<string, { price: number; stock: number; name: string }>();
    if (inventoryData?.data) {
      inventoryData.data.forEach((item: any) => {
        const entry = {
          price: item.sellingPrice || 0,
          stock: item.availableStock ?? item.currentStock ?? 0,
          name: item.name,
        };
        byName.set(item.name.toLowerCase(), entry);
        if (item.genericName) byGeneric.set(item.genericName.toLowerCase(), entry);
        if (item.code) byCode.set(item.code.toLowerCase(), entry);
      });
    }
    return { byName, byGeneric, byCode };
  }, [inventoryData]);

  // Match prescription drug to inventory (fuzzy: exact name > code > generic > partial)
  const findDrugStock = (item: PrescriptionItem): { price: number; stock: number; name: string } | null => {
    const drugNameLower = item.drugName.toLowerCase();
    const drugCodeLower = (item.drugCode || '').toLowerCase();
    // Exact name match
    if (inventoryLookup.byName.has(drugNameLower)) return inventoryLookup.byName.get(drugNameLower)!;
    // Code match
    if (drugCodeLower && inventoryLookup.byCode.has(drugCodeLower)) return inventoryLookup.byCode.get(drugCodeLower)!;
    // Generic name match
    if (inventoryLookup.byGeneric.has(drugNameLower)) return inventoryLookup.byGeneric.get(drugNameLower)!;
    // Partial match (drug name contains or is contained by inventory name)
    for (const [name, entry] of inventoryLookup.byName) {
      if (name.includes(drugNameLower) || drugNameLower.includes(name)) return entry;
    }
    for (const [generic, entry] of inventoryLookup.byGeneric) {
      if (generic.includes(drugNameLower) || drugNameLower.includes(generic)) return entry;
    }
    return null;
  };

  // Patient allergies
  const { data: patientAllergies } = useQuery({
    queryKey: ['patient-allergies', selectedPrescription?.patient?.id],
    queryFn: async () => {
      const res = await import('../../services/api').then(m => m.default.get(`/patients/${selectedPrescription!.patient!.id}/allergies`));
      return (res.data?.data || res.data || []) as Array<{ allergen: string; severity: string; reaction?: string }>;
    },
    enabled: !!selectedPrescription?.patient?.id,
    staleTime: 300000,
  });

  // High-alert drugs from drug-management
  const { data: highAlertDrugs } = useQuery({
    queryKey: ['drug-management', 'high-alert'],
    queryFn: async () => {
      const res = await import('../../services/api').then(m => m.default.get('/drug-management/classifications', { params: { type: 'high-alert' } }));
      const list: string[] = (res.data?.data || res.data || []).map((d: any) => (d.genericName || d.name || '').toLowerCase());
      return new Set(list);
    },
    staleTime: 600000,
  });

  // Derive allergy flags per item
  const allergyFlags = useMemo(() => {
    if (!patientAllergies?.length || !selectedPrescription) return new Map<string, string>();
    const flags = new Map<string, string>();
    selectedPrescription.items.forEach(item => {
      const match = patientAllergies.find(a =>
        item.drugName.toLowerCase().includes(a.allergen.toLowerCase()) ||
        a.allergen.toLowerCase().includes(item.drugName.toLowerCase())
      );
      if (match) flags.set(item.id, `Allergy: ${match.allergen} (${match.severity})`);
    });
    return flags;
  }, [patientAllergies, selectedPrescription]);

  // Dispense mutation
  const dispenseMutation = useMutation({
    mutationFn: () => {
      if (!selectedPrescription) throw new Error('No prescription selected');
      // Only dispense items that are NOT out-of-stock or external purchase
      const dispensableItems = selectedPrescription.items.filter(
        item => !outOfStockItems.has(item.id) && !externalPurchaseItems.has(item.id)
      );
      if (dispensableItems.length === 0) throw new Error('No items to dispense');
      return prescriptionsService.dispense({
        prescriptionId: selectedPrescription.id,
        items: dispensableItems.map(item => {
          const stockInfo = findDrugStock(item);
          return {
            prescriptionItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice || stockInfo?.price || 0,
          };
        }),
        counselingProvided: counselingComplete,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      const oosCount = outOfStockItems.size + externalPurchaseItems.size;
      const dispItems = selectedPrescription!.items.filter(
        item => !outOfStockItems.has(item.id) && !externalPurchaseItems.has(item.id)
      );
      const total = dispItems.reduce((sum, item) => {
        const info = findDrugStock(item);
        return sum + ((info?.price || 0) * item.quantity);
      }, 0);
      setDispensedInfo({
        patientName: selectedPrescription!.patientName || selectedPrescription!.patient?.fullName || 'Patient',
        itemCount: dispItems.length,
        oosCount,
        total,
      });
      setSelectedPrescription(null);
      setCurrentStep('search');
      setCounselingComplete(false);
      setPickedItems(new Set());
      setCheckedItems(new Set());
      setOutOfStockItems(new Set());
      setExternalPurchaseItems(new Set());
      setSubstituteNotes({});
      setSearchTerm('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to dispense');
    },
  });

  const prescriptions = searchTerm.length >= 2 
    ? (searchResults || []) 
    : (prescriptionsData || []);

  const filteredPrescriptions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return prescriptions.slice(0, 10);
    return prescriptions.filter(
      (p) =>
        p.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.prescriptionNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, prescriptions]);

  const handleSelectPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription);
    setCurrentStep('verify');
  };

  const handlePickItem = (medicationId: string) => {
    setPickedItems((prev) => new Set(prev).add(medicationId));
  };

  const handleCheckItem = (medicationId: string) => {
    setCheckedItems((prev) => new Set(prev).add(medicationId));
  };

  const handleMarkOutOfStock = (itemId: string) => {
    setOutOfStockItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); externalPurchaseItems.delete(itemId); }
      return next;
    });
    // Also mark as picked/checked so it doesn't block progress
    setPickedItems(prev => new Set(prev).add(itemId));
    setCheckedItems(prev => new Set(prev).add(itemId));
  };

  const handleMarkExternalPurchase = (itemId: string) => {
    setExternalPurchaseItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) { next.delete(itemId); } else { next.add(itemId); outOfStockItems.delete(itemId); }
      return next;
    });
    setPickedItems(prev => new Set(prev).add(itemId));
    setCheckedItems(prev => new Set(prev).add(itemId));
  };

  const dispensableItems = selectedPrescription?.items.filter(
    item => !outOfStockItems.has(item.id) && !externalPurchaseItems.has(item.id)
  ) || [];
  const allPicked = selectedPrescription?.items.every((m) => pickedItems.has(m.id));
  const allChecked = selectedPrescription?.items.every((m) => checkedItems.has(m.id));

  const getStepIndex = (step: DispenseStep) => steps.findIndex((s) => s.key === step);

  const handlePrintLabel = (item: PrescriptionItem) => {
    if (!selectedPrescription) return;
    const win = window.open('', '_blank', 'width=400,height=300');
    if (!win) return;
    win.document.write(`
      <html><head><title>Medication Label</title>
      <style>
        body { font-family: monospace; padding: 16px; font-size: 12px; }
        .header { font-weight: bold; font-size: 14px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 8px; }
        .field { margin: 4px 0; }
        .big { font-size: 15px; font-weight: bold; margin: 8px 0; }
        .warn { color: red; font-weight: bold; }
      </style></head><body>
      <div class="header">GLIDE HIMS — PHARMACY LABEL</div>
      <div class="field"><b>Patient:</b> ${selectedPrescription.patient?.fullName || 'Unknown'}</div>
      <div class="field"><b>MRN:</b> ${selectedPrescription.patient?.mrn || '-'}</div>
      <div class="field"><b>Rx #:</b> ${selectedPrescription.prescriptionNumber}</div>
      <div class="field"><b>Date:</b> ${new Date(selectedPrescription.createdAt).toLocaleDateString()}</div>
      <hr/>
      <div class="big">${item.drugName}</div>
      <div class="field"><b>Dose:</b> ${item.dose}</div>
      <div class="field"><b>Freq:</b> ${item.frequency}</div>
      <div class="field"><b>Duration:</b> ${item.duration}</div>
      <div class="field"><b>Qty:</b> ${item.quantity}</div>
      ${item.instructions ? `<div class="field"><b>Instructions:</b> ${item.instructions}</div>` : ''}
      ${highAlertDrugs?.has(item.drugName.toLowerCase()) ? '<div class="warn">⚠ HIGH-ALERT MEDICATION — Double check dose</div>' : ''}
      <hr/>
      <div class="field" style="font-size:10px">Dispensed by GLIDE HIMS. Keep out of reach of children.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Post-Dispense Success Screen */}
      {dispensedInfo && (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Dispensing Complete!</h2>
              <p className="text-gray-600 mt-1">
                {dispensedInfo.itemCount} medication(s) dispensed to <b>{dispensedInfo.patientName}</b>
              </p>
              {dispensedInfo.oosCount > 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  {dispensedInfo.oosCount} item(s) were unavailable
                </p>
              )}
              {dispensedInfo.total > 0 && (
                <p className="text-lg font-semibold text-gray-800 mt-2">
                  Total: UGX {dispensedInfo.total.toLocaleString()}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm font-semibold text-blue-800 mb-1">👉 Next Step: Billing &amp; Payment</p>
              <p className="text-xs text-blue-700">
                Direct the patient to the <b>Cashier/Billing</b> counter for payment before leaving the facility.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/cashier')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <CreditCard className="w-5 h-5" />
                Go to Cashier / Billing
              </button>
              <button
                onClick={() => setDispensedInfo(null)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <Pill className="w-5 h-5" />
                Dispense Next Patient
              </button>
              <button
                onClick={() => navigate('/pharmacy')}
                className="flex items-center justify-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
              >
                <Home className="w-4 h-4" />
                Back to Pharmacy Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {!dispensedInfo && (<>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dispense Medication</h1>
          <p className="text-gray-600">Search and dispense prescriptions</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentStep === step.key
                    ? 'bg-blue-100 text-blue-700'
                    : getStepIndex(currentStep) > index
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {step.icon}
                <span className="font-medium">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="w-5 h-5 text-gray-300" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Left Panel - Search/Prescription */}
        <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient or prescription..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {isLoading && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
              </div>
            )}

            {!isLoading && searchTerm && filteredPrescriptions.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Search className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No prescriptions found</p>
              </div>
            )}

            {filteredPrescriptions.map((prescription) => (
              <div
                key={prescription.id}
                onClick={() => handleSelectPrescription(prescription)}
                className={`p-4 border rounded-lg mb-3 cursor-pointer transition-colors ${
                  selectedPrescription?.id === prescription.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{prescription.patient?.fullName || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{prescription.patient?.mrn || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {prescription.prescriptionNumber}
                  </span>
                  <span className="flex items-center gap-1">
                    <Pill className="w-4 h-4" />
                    {prescription.items?.length || 0} items
                  </span>
                </div>
              </div>
            ))}

            {selectedPrescription && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Prescription Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Prescriber:</span>
                    <span className="text-gray-900">{selectedPrescription.doctor?.fullName || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date:</span>
                    <span className="text-gray-900">{new Date(selectedPrescription.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Workflow */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {!selectedPrescription ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Pill className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Search and select a prescription to begin</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Medications</h3>
              </div>

              {/* Allergy Banner */}
              {allergyFlags.size > 0 && (
                <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-300 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">Patient Allergy Alert</p>
                    {[...allergyFlags.values()].map((v, i) => (
                      <p key={i} className="text-xs text-red-700">{v}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-auto p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                      <th className="pb-3">Medication</th>
                      <th className="pb-3">Dose</th>
                      <th className="pb-3">Freq</th>
                      <th className="pb-3">Duration</th>
                      <th className="pb-3">Qty / Stock</th>
                      <th className="pb-3">Status</th>
                      {(currentStep === 'pick' || currentStep === 'check') && <th className="pb-3">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPrescription.items.map((item) => {
                      const stockInfo = findDrugStock(item);
                      const stock = stockInfo?.stock;
                      const stockLow = stock !== undefined && stock < item.quantity;
                      const noStock = stock === undefined || stock === 0;
                      const isHighAlert = highAlertDrugs?.has(item.drugName.toLowerCase());
                      const allergyFlag = allergyFlags.get(item.id);
                      const isOOS = outOfStockItems.has(item.id);
                      const isExternal = externalPurchaseItems.has(item.id);
                      const isUnavailable = isOOS || isExternal;
                      const unitPrice = stockInfo?.price || 0;
                      return (
                      <tr key={item.id} className={`${allergyFlag ? 'bg-red-50' : isUnavailable ? 'bg-gray-50 opacity-60' : ''}`}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Pill className={`w-4 h-4 flex-shrink-0 ${isHighAlert ? 'text-red-600' : isUnavailable ? 'text-gray-400' : 'text-blue-600'}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 flex-wrap">
                                <p className={`font-medium ${isUnavailable ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{item.drugName}</p>
                                {isHighAlert && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">HIGH-ALERT</span>}
                                {allergyFlag && <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded">⚠ ALLERGY</span>}
                              </div>
                              {item.instructions && <p className="text-xs text-gray-500 truncate">{item.instructions}</p>}
                              {stockInfo && <p className="text-xs text-gray-400">Matched: {stockInfo.name}</p>}
                              {unitPrice > 0 && <p className="text-xs text-green-600">UGX {unitPrice.toLocaleString()} / {item.quantity} = UGX {(unitPrice * item.quantity).toLocaleString()}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-gray-700 text-sm">{item.dose}</td>
                        <td className="py-3 text-gray-700 text-sm">{item.frequency}</td>
                        <td className="py-3 text-gray-700 text-sm">{item.duration}</td>
                        <td className="py-3">
                          <span className="text-gray-700 text-sm">{item.quantity}</span>
                          {stock !== undefined ? (
                            <span className={`ml-1 text-xs px-1.5 py-0.5 rounded font-medium ${
                              noStock ? 'bg-red-100 text-red-700' : stockLow ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {noStock ? 'Out of stock' : stockLow ? `Low: ${stock}` : `In stock: ${stock}`}
                            </span>
                          ) : (
                            <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              Not in inventory
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {isOOS ? (
                            <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium flex items-center gap-1 w-fit">
                              <XCircle className="w-3 h-3" /> Out of Stock
                            </span>
                          ) : isExternal ? (
                            <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 font-medium flex items-center gap-1 w-fit">
                              <ShoppingBag className="w-3 h-3" /> Buy Outside
                            </span>
                          ) : item.isDispensed ? (
                            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" /> Dispensed
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                              Pending
                            </span>
                          )}
                        </td>
                        {(currentStep === 'pick' || currentStep === 'check') && (
                          <td className="py-3">
                            {isUnavailable ? (
                              <button
                                onClick={() => { isOOS ? handleMarkOutOfStock(item.id) : handleMarkExternalPurchase(item.id); }}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Undo
                              </button>
                            ) : currentStep === 'pick' ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <button
                                  onClick={() => handlePickItem(item.id)}
                                  disabled={pickedItems.has(item.id)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    pickedItems.has(item.id)
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {pickedItems.has(item.id) ? '✓ Picked' : 'Pick'}
                                </button>
                                <button onClick={() => handlePrintLabel(item)} title="Print label" className="p-1 text-gray-400 hover:text-gray-700">
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                {(noStock || stock === undefined) && !pickedItems.has(item.id) && (
                                  <>
                                    <button
                                      onClick={() => handleMarkOutOfStock(item.id)}
                                      title="Mark out of stock — notify doctor"
                                      className="px-2 py-1 rounded text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                    >
                                      <XCircle className="w-3 h-3 inline mr-0.5" />OOS
                                    </button>
                                    <button
                                      onClick={() => handleMarkExternalPurchase(item.id)}
                                      title="Patient to buy outside"
                                      className="px-2 py-1 rounded text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200"
                                    >
                                      <ShoppingBag className="w-3 h-3 inline mr-0.5" />External
                                    </button>
                                  </>
                                )}
                                {stockLow && !noStock && !pickedItems.has(item.id) && (
                                  <span className="text-xs text-yellow-600">⚠ Low stock</span>
                                )}
                              </div>
                            ) : currentStep === 'check' ? (
                              <button
                                onClick={() => handleCheckItem(item.id)}
                                disabled={checkedItems.has(item.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                  checkedItems.has(item.id)
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                              >
                                {checkedItems.has(item.id) ? '✓ Checked' : 'Check'}
                              </button>
                            ) : null}
                          </td>
                        )}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                {currentStep === 'verify' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Verify patient identity and prescription details</p>
                    <button
                      onClick={() => setCurrentStep('pick')}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Verify & Continue
                    </button>
                  </div>
                )}

                {currentStep === 'pick' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {allPicked ? 'All items picked' : 'Pick each medication from shelves'}
                    </p>
                    <button
                      onClick={() => setCurrentStep('check')}
                      disabled={!allPicked}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Package className="w-4 h-4" />
                      Continue to Check
                    </button>
                  </div>
                )}

                {currentStep === 'check' && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {allChecked ? 'All items verified' : 'Double-check each medication'}
                    </p>
                    <button
                      onClick={() => setCurrentStep('dispense')}
                      disabled={!allChecked}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Continue to Dispense
                    </button>
                  </div>
                )}

                {currentStep === 'dispense' && (
                  <div className="space-y-4">
                    {/* OOS / External Purchase Summary */}
                    {(outOfStockItems.size > 0 || externalPurchaseItems.size > 0) && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="font-semibold text-yellow-800 text-sm mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> Unavailable Items
                        </p>
                        {selectedPrescription.items.filter(i => outOfStockItems.has(i.id)).map(item => (
                          <p key={item.id} className="text-xs text-yellow-700">
                            <XCircle className="w-3 h-3 inline text-red-500 mr-1" />
                            <b>{item.drugName}</b> — Out of stock. Doctor to prescribe alternative.
                          </p>
                        ))}
                        {selectedPrescription.items.filter(i => externalPurchaseItems.has(i.id)).map(item => (
                          <p key={item.id} className="text-xs text-yellow-700">
                            <ShoppingBag className="w-3 h-3 inline text-orange-500 mr-1" />
                            <b>{item.drugName}</b> — Patient to buy from outside pharmacy.
                          </p>
                        ))}
                        <p className="text-xs text-yellow-600 mt-1">
                          {dispensableItems.length > 0
                            ? `${dispensableItems.length} of ${selectedPrescription.items.length} items will be dispensed.`
                            : 'No items to dispense. All items are unavailable.'}
                        </p>
                      </div>
                    )}

                    {/* Price Summary */}
                    {dispensableItems.length > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="font-semibold text-green-800 text-sm mb-1">Payment Summary</p>
                        {dispensableItems.map(item => {
                          const info = findDrugStock(item);
                          const price = info?.price || 0;
                          return (
                            <div key={item.id} className="flex justify-between text-xs text-green-700">
                              <span>{item.drugName} × {item.quantity}</span>
                              <span>UGX {(price * item.quantity).toLocaleString()}</span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between text-sm font-bold text-green-900 mt-1 pt-1 border-t border-green-200">
                          <span>Total</span>
                          <span>UGX {dispensableItems.reduce((sum, item) => {
                            const info = findDrugStock(item);
                            return sum + ((info?.price || 0) * item.quantity);
                          }, 0).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={counselingComplete}
                        onChange={(e) => setCounselingComplete(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">Patient counseling completed</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (!selectedPrescription) return;
                          selectedPrescription.items.forEach(item => handlePrintLabel(item));
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                        Print Labels
                      </button>
                      <button
                        onClick={() => dispenseMutation.mutate()}
                        disabled={!counselingComplete || dispenseMutation.isPending || dispensableItems.length === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {dispenseMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {dispenseMutation.isPending ? 'Dispensing...' : dispensableItems.length === 0 ? 'Nothing to Dispense' : `Dispense ${dispensableItems.length} Item(s)`}
                      </button>
                    </div>
                    {dispenseMutation.isError && (
                      <p className="text-sm text-red-600 text-center">
                        Failed to dispense. Please try again.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}
