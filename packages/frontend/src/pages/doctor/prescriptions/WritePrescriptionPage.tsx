import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePermissions } from '../../../components/PermissionGate';
import {
  Pill, Search, Plus, Trash2, AlertTriangle, Star, Copy, Printer,
  CheckCircle, XCircle, Info, ShieldAlert, Clock, User, Weight,
  Heart, Loader2, ChevronDown, Save, Send, FileText, ArrowLeft
} from 'lucide-react';
import { storesService, type Drug } from '../../../services/stores';
import { patientsService } from '../../../services/patients';
import { prescriptionsService, type CreatePrescriptionDto } from '../../../services/prescriptions';
import { pharmacyService } from '../../../services/pharmacy';
import { useAuthStore } from '../../../store/auth';

interface PrescriptionItem {
  id: string;
  drug: Drug | null;
  dose: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
}

interface SafetyAlert {
  type: 'allergy' | 'interaction' | 'duplicate' | 'dose' | 'pregnancy';
  severity: 'high' | 'medium' | 'low';
  message: string;
  drug: string;
}

const frequencies = ['OD (Once daily)', 'BD (Twice daily)', 'TDS (Three times daily)', 'QID (Four times daily)', 'PRN (As needed)', 'STAT (Immediately)', 'Q4H (Every 4 hours)', 'Q6H (Every 6 hours)', 'Q8H (Every 8 hours)', 'Q12H (Every 12 hours)', 'Weekly', 'At bedtime'];
const routes = ['PO (Oral)', 'IV (Intravenous)', 'IM (Intramuscular)', 'SC (Subcutaneous)', 'SL (Sublingual)', 'PR (Rectal)', 'Topical', 'Inhaled', 'Ophthalmic', 'Otic'];
const durations = ['3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '30 days', '60 days', '90 days', 'Ongoing'];

export default function WritePrescriptionPage() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  
  // Get patient and encounter from URL params
  const patientId = searchParams.get('patientId');
  const encounterId = searchParams.get('encounterId');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);

  // Fetch patient details
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => patientsService.getById(patientId!),
    enabled: !!patientId,
  });

  // Search drugs from pharmacy inventory
  const { data: drugSearchResults = [], isLoading: drugsLoading } = useQuery({
    queryKey: ['drug-search', searchTerm],
    queryFn: () => storesService.items.search(searchTerm, true, 20),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Get patient's current medications (from previous prescriptions)
  const { data: patientPrescriptions = [] } = useQuery({
    queryKey: ['patient-prescriptions', patientId],
    queryFn: () => prescriptionsService.getPatientPrescriptions(patientId!),
    enabled: !!patientId,
  });

  // Extract current medications from recent prescriptions
  const currentMedications = useMemo(() => {
    const recentRx = patientPrescriptions.slice(0, 3);
    return recentRx.flatMap(rx => rx.items.map(item => `${item.drugName} ${item.dose}`));
  }, [patientPrescriptions]);

  // Create prescription mutation
  const createPrescriptionMutation = useMutation({
    mutationFn: async (data: CreatePrescriptionDto) => {
      return prescriptionsService.create(data);
    },
    onSuccess: () => {
      toast.success('Prescription sent to pharmacy');
      queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
      // Navigate back or to a confirmation page
      if (encounterId) {
        navigate(`/doctor/consultation/new?encounterId=${encounterId}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create prescription');
    },
  });

  // Check drug interactions
  const checkDrugInteractions = async (drugIds: string[]) => {
    if (drugIds.length < 2) return [];
    try {
      return await pharmacyService.drugs.checkInteractions(drugIds);
    } catch {
      return [];
    }
  };

  const checkSafety = async (drug: Drug) => {
    const newAlerts: SafetyAlert[] = [];
    
    // Check allergies (if patient has allergy data)
    if (patient?.allergies) {
      const allergies = typeof patient.allergies === 'string' 
        ? patient.allergies.split(',').map(a => a.trim().toLowerCase())
        : [];
      const drugName = (drug.genericName || drug.name || '').toLowerCase();
      if (allergies.some(a => drugName.includes(a) || a.includes(drugName.split(' ')[0]))) {
        newAlerts.push({ 
          type: 'allergy', 
          severity: 'high', 
          message: `Patient may be allergic to ${drug.name}`, 
          drug: drug.name 
        });
      }
    }
    
    // Check duplicate therapy
    if (items.some(i => i.drug?.genericName === drug.genericName)) {
      newAlerts.push({ 
        type: 'duplicate', 
        severity: 'medium', 
        message: `Duplicate therapy: ${drug.genericName || drug.name} already prescribed`, 
        drug: drug.name 
      });
    }

    // Check if controlled substance
    if (drug.isControlled) {
      newAlerts.push({ 
        type: 'dose', 
        severity: 'low', 
        message: 'Controlled substance - requires additional verification', 
        drug: drug.name 
      });
    }

    // Check drug interactions with existing items
    const allDrugIds = [...items.filter(i => i.drug).map(i => i.drug!.id), drug.id];
    if (allDrugIds.length >= 2) {
      const interactions = await checkDrugInteractions(allDrugIds);
      interactions.forEach(interaction => {
        if (interaction.severity === 'major' || interaction.severity === 'contraindicated') {
          newAlerts.push({
            type: 'interaction',
            severity: interaction.severity === 'contraindicated' ? 'high' : 'medium',
            message: interaction.description,
            drug: `${interaction.drug1Name} + ${interaction.drug2Name}`,
          });
        }
      });
    }
    
    setAlerts(prev => [...prev, ...newAlerts]);
    return newAlerts.filter(a => a.severity === 'high').length === 0;
  };

  const addDrug = async (drug: Drug) => {
    const isSafe = await checkSafety(drug);
    if (!isSafe) {
      toast.error('Cannot add - high severity safety concern detected');
      return;
    }
    
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      drug,
      dose: '1',
      frequency: 'BD (Twice daily)',
      route: 'PO (Oral)',
      duration: '7 days',
      quantity: 14,
      refills: 0,
      instructions: '',
    };
    setItems([...items, newItem]);
    setShowDrugSearch(false);
    setSearchTerm('');
    toast.success(`${drug.name} added to prescription`);
  };

  const removeItem = (id: string) => {
    const item = items.find(i => i.id === id);
    setItems(items.filter(i => i.id !== id));
    if (item?.drug) {
      setAlerts(alerts.filter(a => a.drug !== item.drug?.name));
    }
  };

  const updateItem = (id: string, field: keyof PrescriptionItem, value: string | number) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      toast.error('Add at least one drug');
      return;
    }
    if (alerts.some(a => a.severity === 'high')) {
      toast.error('Resolve high-severity alerts first');
      return;
    }
    if (!encounterId) {
      toast.error('No encounter selected - prescription requires an active consultation');
      return;
    }

    const prescriptionData: CreatePrescriptionDto = {
      encounterId,
      items: items.map(item => ({
        drugCode: item.drug?.sku || item.drug?.code || '',
        drugName: item.drug?.name || '',
        dose: `${item.dose} ${item.drug?.unit || ''}`.trim(),
        frequency: item.frequency.split(' ')[0], // Extract code like "BD"
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions || undefined,
      })),
      notes: undefined,
    };

    createPrescriptionMutation.mutate(prescriptionData);
  };

  // Calculate patient age
  const patientAge = patient?.dateOfBirth 
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  if (!hasPermission('prescriptions.create')) {
    return <div className="p-8 text-center text-red-600">You do not have permission to write prescriptions.</div>;
  }

  if (!patientId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center justify-center">
        <Pill className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Patient Selected</h2>
        <p className="text-gray-500 mb-4">Please select a patient from the consultation page to write a prescription.</p>
        <button 
          onClick={() => navigate('/doctor/consultation/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Go to Consultation
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Pill className="text-blue-600" /> Write Prescription</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFavorites(!showFavorites)} className="px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50">
              <Star className="w-4 h-4" /> Favorites
            </button>
            <button 
              onClick={handleSubmit} 
              disabled={createPrescriptionMutation.isPending || items.length === 0} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {createPrescriptionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 
              Send to Pharmacy
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Patient</h2>
            {patientLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : patient ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{patient.fullName}</p>
                <p className="text-gray-600">
                  {patientAge ? `${patientAge}yo` : ''} {patient.gender} 
                  {patient.weight && <> • <Weight className="w-3 h-3 inline" /> {patient.weight}kg</>}
                </p>
                <p className="text-xs text-gray-500">MRN: {patient.mrn}</p>
                
                {patient.allergies && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> ALLERGIES
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(typeof patient.allergies === 'string' ? patient.allergies.split(',') : []).map((a: string) => (
                        <span key={a} className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">{a.trim()}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {currentMedications.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600">Current Medications</p>
                    <ul className="text-xs text-gray-500 mt-1">
                      {currentMedications.slice(0, 5).map((m, idx) => <li key={idx}>• {m}</li>)}
                      {currentMedications.length > 5 && (
                        <li className="text-blue-600">+{currentMedications.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Patient not found</p>
            )}
          </div>

          {/* Prescription Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-semibold">Prescription Items ({items.length})</h2>
                <button onClick={() => setShowDrugSearch(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded flex items-center gap-1 text-sm">
                  <Plus className="w-4 h-4" /> Add Drug
                </button>
              </div>

              {showDrugSearch && (
                <div className="mb-4 p-3 border rounded-lg bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search drugs from pharmacy inventory..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-10 py-2 border rounded-lg" 
                      autoFocus 
                    />
                    {drugsLoading && (
                      <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {searchTerm.length < 2 ? (
                      <p className="text-sm text-gray-500 text-center py-2">Type at least 2 characters to search</p>
                    ) : drugSearchResults.length === 0 && !drugsLoading ? (
                      <p className="text-sm text-gray-500 text-center py-2">No drugs found</p>
                    ) : (
                      drugSearchResults.map(drug => (
                        <div 
                          key={drug.id} 
                          onClick={() => addDrug(drug)}
                          className="p-2 hover:bg-blue-50 cursor-pointer rounded flex justify-between items-center"
                        >
                          <div>
                            <span className="font-medium">{drug.name}</span>
                            <span className="text-gray-500 text-sm ml-2">
                              {drug.genericName && `(${drug.genericName})`} {drug.strength || ''} {drug.form || ''}
                            </span>
                            {drug.isControlled && <ShieldAlert className="w-4 h-4 text-orange-500 inline ml-2" />}
                          </div>
                          <div className="text-right text-xs">
                            <div className={drug.currentStock > 100 ? 'text-green-600' : drug.currentStock > 0 ? 'text-orange-600' : 'text-red-600'}>
                              {drug.currentStock} in stock
                            </div>
                            {drug.sellingPrice && (
                              <div className="text-gray-500">UGX {drug.sellingPrice.toLocaleString()}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={() => { setShowDrugSearch(false); setSearchTerm(''); }}
                    className="mt-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No drugs added yet</p>
                  <p className="text-xs mt-1">Search and add drugs from the pharmacy inventory</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{item.drug?.name}</span>
                          <span className="text-gray-500 text-sm ml-2">
                            {item.drug?.strength || ''} {item.drug?.form || ''}
                          </span>
                          {item.drug?.isControlled && (
                            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">Controlled</span>
                          )}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-500">Dose</label>
                          <input 
                            type="text" 
                            value={item.dose} 
                            onChange={e => updateItem(item.id, 'dose', e.target.value)} 
                            className="w-full border rounded px-2 py-1" 
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Frequency</label>
                          <select 
                            value={item.frequency} 
                            onChange={e => updateItem(item.id, 'frequency', e.target.value)} 
                            className="w-full border rounded px-2 py-1"
                          >
                            {frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Route</label>
                          <select 
                            value={item.route} 
                            onChange={e => updateItem(item.id, 'route', e.target.value)} 
                            className="w-full border rounded px-2 py-1"
                          >
                            {routes.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Duration</label>
                          <select 
                            value={item.duration} 
                            onChange={e => updateItem(item.id, 'duration', e.target.value)} 
                            className="w-full border rounded px-2 py-1"
                          >
                            {durations.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-500">Quantity</label>
                          <input 
                            type="number" 
                            value={item.quantity} 
                            onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)} 
                            className="w-full border rounded px-2 py-1" 
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Refills</label>
                          <input 
                            type="number" 
                            value={item.refills} 
                            onChange={e => updateItem(item.id, 'refills', parseInt(e.target.value) || 0)} 
                            className="w-full border rounded px-2 py-1" 
                            min="0" 
                            max="5" 
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-500">Instructions</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Take with food" 
                            value={item.instructions} 
                            onChange={e => updateItem(item.id, 'instructions', e.target.value)} 
                            className="w-full border rounded px-2 py-1" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Safety Alerts & Actions */}
          <div className="space-y-4">
            {alerts.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" /> Safety Alerts
                </h2>
                <div className="space-y-2">
                  {alerts.map((alert, idx) => (
                    <div key={idx} className={`p-2 rounded text-sm flex items-start gap-2 ${
                      alert.severity === 'high' ? 'bg-red-50 text-red-800' :
                      alert.severity === 'medium' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'
                    }`}>
                      {alert.severity === 'high' ? <XCircle className="w-4 h-4 mt-0.5" /> : <Info className="w-4 h-4 mt-0.5" />}
                      <div>
                        <p className="font-medium">{alert.drug}</p>
                        <p className="text-xs">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <button className="w-full px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm">
                  <Star className="w-4 h-4 text-yellow-500" /> Save as Favorite
                </button>
                <button className="w-full px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm">
                  <Copy className="w-4 h-4" /> Copy from Previous
                </button>
                <button className="w-full px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50 text-sm">
                  <Printer className="w-4 h-4" /> Print Preview
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="font-semibold mb-3">Prescriber</h2>
              <div className="text-sm space-y-1">
                <p className="font-medium">{user?.fullName || 'Current User'}</p>
                <p className="text-gray-500">License: {user?.licenseNumber || 'N/A'}</p>
                <p className="text-gray-500">Specialty: {user?.specialty || 'General Medicine'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
