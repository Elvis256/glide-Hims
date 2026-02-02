import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Pill,
  Search,
  AlertTriangle,
  Plus,
  Trash2,
  Eye,
  Send,
  User,
  ChevronDown,
  X,
  FileText,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';
import { prescriptionsService, type CreatePrescriptionDto } from '../../../services/prescriptions';
import { encountersService } from '../../../services/encounters';
import api from '../../../services/api';

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  allergies: string[];
}

interface Drug {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  strength?: string;
  strengths: string[];
  routes: string[];
  formulation?: string;
  category?: string;
  manufacturer?: string;
}

interface Medication {
  id: string;
  drugName: string;
  drugCode: string;
  strength: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: string;
  refills: number;
}

interface CurrentMedication {
  name: string;
  prescribedDate: string;
  status: string;
}

const currentMedications: CurrentMedication[] = [];

const frequencies = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed', 'At bedtime'];
const durations = ['5 days', '7 days', '10 days', '14 days', '21 days', '30 days', '60 days', '90 days', 'Ongoing'];
const routes = ['Oral', 'Intravenous (IV)', 'Intramuscular (IM)', 'Subcutaneous (SC)', 'Topical', 'Rectal', 'Inhalation', 'Sublingual', 'Ophthalmic', 'Otic'];

export default function WritePrescriptionPage() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdPrescriptionNumber, setCreatedPrescriptionNumber] = useState<string | null>(null);

  // Fetch patients based on search
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });

  // Fetch drugs from inventory (items with isDrug: true)
  const { data: drugsData, isLoading: drugsLoading } = useQuery({
    queryKey: ['drugs-search', drugSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        search: drugSearch, 
        isDrug: 'true',
        limit: '20' 
      });
      const response = await api.get(`/inventory/items?${params}`);
      return response.data;
    },
    enabled: drugSearch.length > 1,
  });

  // Transform drug data
  const drugs: Drug[] = useMemo(() => {
    return (drugsData?.data || drugsData || []).map((item: any) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      genericName: item.genericName,
      strength: item.strength,
      strengths: item.strength ? [item.strength] : ['As prescribed'],
      routes: routes,
      formulation: item.formulation?.name,
      category: item.category?.name || item.category,
      manufacturer: item.manufacturer || item.brand?.name,
    }));
  }, [drugsData]);

  // Fetch active encounter for selected patient
  const { data: patientEncounters } = useQuery({
    queryKey: ['encounters', 'patient', selectedPatient?.id],
    queryFn: () => encountersService.list({ patientId: selectedPatient!.id, status: 'in_consultation', limit: 1 }),
    enabled: !!selectedPatient?.id,
  });

  // Set encounter ID when patient encounters load
  useMemo(() => {
    if (patientEncounters?.data && patientEncounters.data.length > 0) {
      setSelectedEncounterId(patientEncounters.data[0].id);
    } else {
      setSelectedEncounterId(null);
    }
  }, [patientEncounters]);

  // Create prescription mutation
  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: CreatePrescriptionDto) => {
      return prescriptionsService.create(data);
    },
    onSuccess: (prescription) => {
      setCreatedPrescriptionNumber(prescription.prescriptionNumber);
      setShowSuccess(true);
      setShowPreview(false);
      toast.success('Prescription created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create prescription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

  // Transform patient data to match the expected interface
  const patients: Patient[] = useMemo(() => {
    return (patientsData?.data || []).map(p => ({
      id: p.id,
      name: p.fullName,
      dateOfBirth: p.dateOfBirth,
      allergies: p.metadata?.allergies 
        ? String(p.metadata.allergies).split(',').map(a => a.trim()).filter(Boolean) 
        : [],
    }));
  }, [patientsData]);
  const [showDrugResults, setShowDrugResults] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<Medication[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [currentMed, setCurrentMed] = useState({
    drugName: '',
    drugCode: '',
    strength: '',
    route: '',
    frequency: '',
    duration: '',
    quantity: '',
    refills: 0,
  });

  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);

  // Drugs are now fetched from API, no need to filter client-side
  const filteredDrugs = drugs;

  const handleSelectDrug = (drug: Drug) => {
    setSelectedDrug(drug);
    setCurrentMed(prev => ({
      ...prev,
      drugName: drug.genericName ? `${drug.name} (${drug.genericName})` : drug.name,
      drugCode: drug.code,
      strength: drug.strength || drug.strengths[0] || '',
      route: drug.routes[0] || 'Oral',
    }));
    setDrugSearch(drug.name);
    setShowDrugResults(false);
  };

  const handleAddMedication = () => {
    if (!currentMed.drugName || !currentMed.strength || !currentMed.frequency) return;
    
    const newMed: Medication = {
      id: Date.now().toString(),
      ...currentMed,
    };
    setPrescriptionItems(prev => [...prev, newMed]);
    setCurrentMed({
      drugName: '',
      drugCode: '',
      strength: '',
      route: '',
      frequency: '',
      duration: '',
      quantity: '',
      refills: 0,
    });
    setSelectedDrug(null);
    setDrugSearch('');
  };

  const handleRemoveMedication = (id: string) => {
    setPrescriptionItems(prev => prev.filter(m => m.id !== id));
  };

  const handleSignAndSend = () => {
    if (!selectedPatient || !selectedEncounterId || prescriptionItems.length === 0) {
      toast.error('Please select a patient with an active encounter and add at least one medication.');
      return;
    }

    const prescriptionData: CreatePrescriptionDto = {
      encounterId: selectedEncounterId,
      items: prescriptionItems.map(item => ({
        drugCode: item.drugCode || item.drugName.substring(0, 10).toUpperCase().replace(/\s+/g, ''),
        drugName: `${item.drugName} ${item.strength}`.trim(),
        dose: item.strength,
        frequency: item.frequency,
        duration: item.duration,
        quantity: parseInt(item.quantity) || 1,
        instructions: item.route ? `${item.route}. ${specialInstructions}` : specialInstructions,
      })),
      notes: specialInstructions,
    };

    createPrescriptionMutation.mutate(prescriptionData);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSelectedEncounterId(null);
    setPrescriptionItems([]);
    setSpecialInstructions('');
    setShowSuccess(false);
    setCreatedPrescriptionNumber(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Success State */}
      {showSuccess && createdPrescriptionNumber && (
        <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Prescription Sent!</h2>
            <p className="text-gray-500 mb-4">
              Prescription has been sent to the pharmacy queue.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Prescription Number</p>
              <p className="text-2xl font-mono font-bold text-blue-700">{createdPrescriptionNumber}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Write Another
              </button>
              <button
                onClick={() => navigate('/pharmacy/queue')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Pharmacy Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Pill className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Write Prescription</h1>
            <p className="text-sm text-gray-500">Create a new prescription for your patient</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPreview(true)}
            disabled={prescriptionItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          <button
            onClick={handleSignAndSend}
            disabled={prescriptionItems.length === 0 || !selectedPatient || !selectedEncounterId || createPrescriptionMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPrescriptionMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {createPrescriptionMutation.isPending ? 'Sending...' : 'Sign & Send'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Patient Selector */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <button
                onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 border rounded-lg bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className={selectedPatient ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedPatient ? selectedPatient.name : 'Choose a patient...'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {patientDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search patients..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {patientsLoading && (
                      <div className="flex items-center justify-center py-4 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Searching...
                      </div>
                    )}
                    {!patientsLoading && patientSearch.length > 1 && patients.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                    )}
                    {!patientsLoading && patientSearch.length <= 1 && (
                      <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters to search</div>
                    )}
                    {patients.map(patient => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientDropdownOpen(false);
                          setPatientSearch('');
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-500">DOB: {patient.dateOfBirth}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedPatient && selectedPatient.allergies.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">Allergies Alert</div>
                  <div className="text-sm text-red-600">{selectedPatient.allergies.join(', ')}</div>
                </div>
              </div>
            )}
          </div>

          {/* Drug Entry Form */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <h3 className="font-medium text-gray-900 mb-4">Add Medication</h3>
            
            {/* Drug Search */}
            <div className="relative mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={drugSearch}
                  onChange={(e) => {
                    setDrugSearch(e.target.value);
                    setShowDrugResults(true);
                  }}
                  onFocus={() => setShowDrugResults(true)}
                  placeholder="Search for a drug..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {showDrugResults && filteredDrugs.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredDrugs.map(drug => (
                    <button
                      key={drug.id}
                      onClick={() => handleSelectDrug(drug)}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50"
                    >
                      <div className="font-medium">{drug.name}</div>
                      <div className="text-sm text-gray-500">Available: {drug.strengths.join(', ')}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strength</label>
                <select
                  value={currentMed.strength}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, strength: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {selectedDrug?.strengths.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                <select
                  value={currentMed.route}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, route: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {selectedDrug?.routes.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={currentMed.frequency}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, frequency: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {frequencies.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                <select
                  value={currentMed.duration}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {durations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="text"
                  value={currentMed.quantity}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="e.g., 30 tablets"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refills</label>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={currentMed.refills}
                  onChange={(e) => setCurrentMed(prev => ({ ...prev, refills: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleAddMedication}
              disabled={!currentMed.drugName || !currentMed.strength || !currentMed.frequency}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Add to Prescription
            </button>
          </div>

          {/* Prescription Items */}
          {prescriptionItems.length > 0 && (
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-3">Prescription Items ({prescriptionItems.length})</h3>
              <div className="space-y-2">
                {prescriptionItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{item.drugName} {item.strength}</div>
                      <div className="text-sm text-gray-500">
                        {item.route} • {item.frequency} • {item.duration} • Qty: {item.quantity} • Refills: {item.refills}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMedication(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div className="bg-white rounded-lg border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              rows={3}
              placeholder="Enter any special instructions for the patient or pharmacist..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Sidebar - Current Medications */}
        <div className="w-80 bg-white border-l p-4 overflow-y-auto">
          <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Current Medications
          </h3>
          <p className="text-xs text-gray-500 mb-3">Check for duplicates before prescribing</p>
          {currentMedications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Pill className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No current medications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentMedications.map((med, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-gray-900">{med.name}</div>
                  <div className="text-sm text-gray-500">Since: {med.prescribedDate}</div>
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                    {med.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Prescription Preview</h2>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium">{selectedPatient?.name || 'Not selected'}</div>
              </div>
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-2">Medications</div>
                {prescriptionItems.map(item => (
                  <div key={item.id} className="p-3 bg-gray-50 rounded-lg mb-2">
                    <div className="font-medium">{item.drugName} {item.strength}</div>
                    <div className="text-sm text-gray-600">
                      Take {item.route} {item.frequency} for {item.duration}
                    </div>
                    <div className="text-sm text-gray-500">
                      Quantity: {item.quantity} | Refills: {item.refills}
                    </div>
                  </div>
                ))}
              </div>
              {specialInstructions && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Special Instructions</div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm">{specialInstructions}</div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button 
                onClick={handleSignAndSend}
                disabled={createPrescriptionMutation.isPending || !selectedEncounterId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createPrescriptionMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {createPrescriptionMutation.isPending ? 'Sending...' : 'Sign & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
