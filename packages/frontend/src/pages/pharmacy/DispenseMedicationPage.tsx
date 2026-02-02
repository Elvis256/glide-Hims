import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
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

export default function DispenseMedicationPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentStep, setCurrentStep] = useState<DispenseStep>('search');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [counselingComplete, setCounselingComplete] = useState(false);
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

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

  // Fetch inventory for drug prices
  const { data: inventoryData } = useQuery({
    queryKey: ['stores', 'inventory'],
    queryFn: () => storesService.inventory.list(),
    staleTime: 60000,
  });

  // Create a map of drug name to selling price
  const drugPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (inventoryData?.data) {
      inventoryData.data.forEach((item) => {
        map.set(item.name.toLowerCase(), item.sellingPrice || 0);
      });
    }
    return map;
  }, [inventoryData]);

  // Dispense mutation
  const dispenseMutation = useMutation({
    mutationFn: () => {
      if (!selectedPrescription) throw new Error('No prescription selected');
      return prescriptionsService.dispense({
        prescriptionId: selectedPrescription.id,
        items: selectedPrescription.items.map(item => ({
          prescriptionItemId: item.id,
          quantity: item.quantity,
          // Get price from inventory lookup by drug name
          unitPrice: item.unitPrice || drugPriceMap.get(item.drugName.toLowerCase()) || 0,
        })),
        counselingProvided: counselingComplete,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      // Reset state
      setSelectedPrescription(null);
      setCurrentStep('search');
      setCounselingComplete(false);
      setPickedItems(new Set());
      setCheckedItems(new Set());
      setSearchTerm('');
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

  const allPicked = selectedPrescription?.items.every((m) => pickedItems.has(m.id));
  const allChecked = selectedPrescription?.items.every((m) => checkedItems.has(m.id));

  const getStepIndex = (step: DispenseStep) => steps.findIndex((s) => s.key === step);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
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

              <div className="flex-1 overflow-auto p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase">
                      <th className="pb-3">Medication</th>
                      <th className="pb-3">Dose</th>
                      <th className="pb-3">Frequency</th>
                      <th className="pb-3">Duration</th>
                      <th className="pb-3">Qty</th>
                      {currentStep === 'pick' && <th className="pb-3">Pick</th>}
                      {currentStep === 'check' && <th className="pb-3">Check</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedPrescription.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Pill className="w-4 h-4 text-blue-600" />
                            <div>
                              <p className="font-medium text-gray-900">{item.drugName}</p>
                              <p className="text-xs text-gray-500">{item.instructions}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-gray-700">{item.dose}</td>
                        <td className="py-3 text-gray-700">{item.frequency}</td>
                        <td className="py-3 text-gray-700">{item.duration}</td>
                        <td className="py-3 text-gray-700">{item.quantity}</td>
                        {currentStep === 'pick' && (
                          <td className="py-3">
                            <button
                              onClick={() => handlePickItem(item.id)}
                              disabled={pickedItems.has(item.id)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                pickedItems.has(item.id)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {pickedItems.has(item.id) ? 'Picked' : 'Pick'}
                            </button>
                          </td>
                        )}
                        {currentStep === 'check' && (
                          <td className="py-3">
                            <button
                              onClick={() => handleCheckItem(item.id)}
                              disabled={checkedItems.has(item.id)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                checkedItems.has(item.id)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              {checkedItems.has(item.id) ? 'Checked' : 'Check'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
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
                      <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Printer className="w-4 h-4" />
                        Print Labels
                      </button>
                      <button
                        onClick={() => dispenseMutation.mutate()}
                        disabled={!counselingComplete || dispenseMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {dispenseMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {dispenseMutation.isPending ? 'Dispensing...' : 'Complete Dispensing'}
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
    </div>
  );
}
