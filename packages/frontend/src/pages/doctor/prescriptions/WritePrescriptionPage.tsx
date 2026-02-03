import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { usePermissions } from '../../../components/PermissionGate';
import {
  Pill, Search, Plus, Trash2, AlertTriangle, Star, Copy, Printer,
  CheckCircle, XCircle, Info, ShieldAlert, Clock, User, Weight,
  Heart, Loader2, ChevronDown, Save, Send, FileText
} from 'lucide-react';

interface Drug {
  id: string;
  name: string;
  generic: string;
  strength: string;
  form: string;
  stock: number;
  price: number;
  controlled: boolean;
}

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

const mockDrugs: Drug[] = [
  { id: '1', name: 'Amoxicillin', generic: 'Amoxicillin', strength: '500mg', form: 'Capsule', stock: 500, price: 500, controlled: false },
  { id: '2', name: 'Panadol', generic: 'Paracetamol', strength: '500mg', form: 'Tablet', stock: 1000, price: 200, controlled: false },
  { id: '3', name: 'Ibuprofen', generic: 'Ibuprofen', strength: '400mg', form: 'Tablet', stock: 800, price: 300, controlled: false },
  { id: '4', name: 'Metformin', generic: 'Metformin HCl', strength: '500mg', form: 'Tablet', stock: 600, price: 400, controlled: false },
  { id: '5', name: 'Lisinopril', generic: 'Lisinopril', strength: '10mg', form: 'Tablet', stock: 300, price: 600, controlled: false },
  { id: '6', name: 'Omeprazole', generic: 'Omeprazole', strength: '20mg', form: 'Capsule', stock: 400, price: 500, controlled: false },
  { id: '7', name: 'Tramadol', generic: 'Tramadol HCl', strength: '50mg', form: 'Capsule', stock: 100, price: 800, controlled: true },
  { id: '8', name: 'Diazepam', generic: 'Diazepam', strength: '5mg', form: 'Tablet', stock: 50, price: 1000, controlled: true },
];

const mockPatient = {
  id: '1', name: 'John Mukasa', age: 45, gender: 'Male', weight: 78,
  allergies: ['Penicillin', 'Sulfa drugs'],
  currentMeds: ['Lisinopril 10mg', 'Metformin 500mg'],
  renalFunction: 'Normal', hepaticFunction: 'Normal', pregnant: false
};

export default function WritePrescriptionPage() {
  const { hasPermission } = usePermissions();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDrugSearch, setShowDrugSearch] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [saving, setSaving] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const filteredDrugs = mockDrugs.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.generic.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const checkSafety = (drug: Drug) => {
    const newAlerts: SafetyAlert[] = [];
    if (mockPatient.allergies.some(a => drug.generic.toLowerCase().includes(a.toLowerCase().split(' ')[0]))) {
      newAlerts.push({ type: 'allergy', severity: 'high', message: `Patient allergic to ${drug.generic}`, drug: drug.name });
    }
    if (items.some(i => i.drug?.generic === drug.generic)) {
      newAlerts.push({ type: 'duplicate', severity: 'medium', message: `Duplicate therapy: ${drug.generic} already prescribed`, drug: drug.name });
    }
    if (drug.controlled) {
      newAlerts.push({ type: 'dose', severity: 'low', message: `Controlled substance - requires additional verification`, drug: drug.name });
    }
    setAlerts(prev => [...prev, ...newAlerts]);
    return newAlerts.filter(a => a.severity === 'high').length === 0;
  };

  const addDrug = (drug: Drug) => {
    if (!checkSafety(drug)) {
      toast.error('Cannot add - safety concern detected');
      return;
    }
    const newItem: PrescriptionItem = {
      id: Date.now().toString(),
      drug, dose: '1', frequency: 'BD (Twice daily)', route: 'PO (Oral)',
      duration: '7 days', quantity: 14, refills: 0, instructions: ''
    };
    setItems([...items, newItem]);
    setShowDrugSearch(false);
    setSearchTerm('');
    toast.success(`${drug.name} added`);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    setAlerts(alerts.filter(a => !items.find(i => i.id === id && i.drug?.name === a.drug)));
  };

  const updateItem = (id: string, field: keyof PrescriptionItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Add at least one drug'); return; }
    if (alerts.some(a => a.severity === 'high')) { toast.error('Resolve high-severity alerts first'); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Prescription sent to pharmacy');
    setSaving(false);
  };

  if (!hasPermission('prescriptions.create')) {
    return <div className="p-8 text-center text-red-600">You do not have permission to write prescriptions.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Pill className="text-blue-600" /> Write Prescription</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowFavorites(!showFavorites)} className="px-3 py-2 border rounded-lg flex items-center gap-2 hover:bg-gray-50">
              <Star className="w-4 h-4" /> Favorites
            </button>
            <button onClick={handleSubmit} disabled={saving || items.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to Pharmacy
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Patient Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4" /> Patient</h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{mockPatient.name}</p>
              <p className="text-gray-600">{mockPatient.age}yo {mockPatient.gender} • <Weight className="w-3 h-3 inline" /> {mockPatient.weight}kg</p>
              <div className="mt-3">
                <p className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ALLERGIES</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mockPatient.allergies.map(a => <span key={a} className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">{a}</span>)}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600">Current Medications</p>
                <ul className="text-xs text-gray-500 mt-1">{mockPatient.currentMeds.map(m => <li key={m}>• {m}</li>)}</ul>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-green-50 rounded"><span className="text-gray-500">Renal:</span> {mockPatient.renalFunction}</div>
                <div className="p-2 bg-green-50 rounded"><span className="text-gray-500">Hepatic:</span> {mockPatient.hepaticFunction}</div>
              </div>
            </div>
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
                    <input type="text" placeholder="Search drugs..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border rounded-lg" autoFocus />
                  </div>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {filteredDrugs.map(drug => (
                      <div key={drug.id} onClick={() => addDrug(drug)}
                        className="p-2 hover:bg-blue-50 cursor-pointer rounded flex justify-between items-center">
                        <div>
                          <span className="font-medium">{drug.name}</span>
                          <span className="text-gray-500 text-sm ml-2">({drug.generic}) {drug.strength} {drug.form}</span>
                          {drug.controlled && <ShieldAlert className="w-4 h-4 text-orange-500 inline ml-2" />}
                        </div>
                        <div className="text-right text-xs">
                          <div className={drug.stock > 100 ? 'text-green-600' : 'text-orange-600'}>{drug.stock} in stock</div>
                          <div className="text-gray-500">UGX {drug.price.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No drugs added yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{item.drug?.name}</span>
                          <span className="text-gray-500 text-sm ml-2">{item.drug?.strength} {item.drug?.form}</span>
                          {item.drug?.controlled && <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">Controlled</span>}
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-500">Dose</label>
                          <input type="text" value={item.dose} onChange={e => updateItem(item.id, 'dose', e.target.value)} className="w-full border rounded px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Frequency</label>
                          <select value={item.frequency} onChange={e => updateItem(item.id, 'frequency', e.target.value)} className="w-full border rounded px-2 py-1">
                            {frequencies.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Route</label>
                          <select value={item.route} onChange={e => updateItem(item.id, 'route', e.target.value)} className="w-full border rounded px-2 py-1">
                            {routes.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Duration</label>
                          <select value={item.duration} onChange={e => updateItem(item.id, 'duration', e.target.value)} className="w-full border rounded px-2 py-1">
                            {durations.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-500">Quantity</label>
                          <input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value))} className="w-full border rounded px-2 py-1" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Refills</label>
                          <input type="number" value={item.refills} onChange={e => updateItem(item.id, 'refills', parseInt(e.target.value))} className="w-full border rounded px-2 py-1" min="0" max="5" />
                        </div>
                        <div className="col-span-1">
                          <label className="text-xs text-gray-500">Instructions</label>
                          <input type="text" placeholder="e.g., Take with food" value={item.instructions} onChange={e => updateItem(item.id, 'instructions', e.target.value)} className="w-full border rounded px-2 py-1" />
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
                <h2 className="font-semibold mb-3 flex items-center gap-2 text-red-600"><AlertTriangle className="w-4 h-4" /> Safety Alerts</h2>
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
                <p className="font-medium">Dr. Sarah Nambi</p>
                <p className="text-gray-500">License: UMC-12345</p>
                <p className="text-gray-500">Specialty: General Medicine</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
