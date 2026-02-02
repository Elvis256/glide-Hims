import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Layers,
  Search,
  User,
  Package,
  FlaskConical,
  Pill,
  Syringe,
  CheckSquare,
  Square,
  Send,
  Info,
  Plus,
  Edit3,
  Building,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Copy,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
}

interface OrderItem {
  id: string;
  type: 'lab' | 'medication' | 'procedure';
  name: string;
  details: string;
}

interface OrderSet {
  id: string;
  name: string;
  category: string;
  description: string;
  scope: 'hospital' | 'personal';
  orders: OrderItem[];
  isFavorite?: boolean;
}

const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const orderSets: OrderSet[] = [
  {
    id: '1',
    name: 'General Admission Orders',
    category: 'Admission',
    description: 'Standard orders for general medical admission',
    scope: 'hospital',
    isFavorite: true,
    orders: [
      { id: 'o1', type: 'lab', name: 'CBC', details: 'Complete Blood Count' },
      { id: 'o2', type: 'lab', name: 'BMP', details: 'Basic Metabolic Panel' },
      { id: 'o3', type: 'lab', name: 'UA', details: 'Urinalysis' },
      { id: 'o4', type: 'medication', name: 'IV NS', details: '0.9% NaCl at 125mL/hr' },
      { id: 'o5', type: 'medication', name: 'DVT Prophylaxis', details: 'Enoxaparin 40mg SC daily' },
    ],
  },
  {
    id: '2',
    name: 'Chest Pain Workup',
    category: 'Chest Pain',
    description: 'Initial evaluation for acute chest pain',
    scope: 'hospital',
    isFavorite: true,
    orders: [
      { id: 'o6', type: 'lab', name: 'Troponin I', details: 'Serial q6h x3' },
      { id: 'o7', type: 'lab', name: 'BNP', details: 'Brain Natriuretic Peptide' },
      { id: 'o8', type: 'lab', name: 'D-Dimer', details: 'If PE suspected' },
      { id: 'o9', type: 'procedure', name: 'ECG', details: '12-lead electrocardiogram' },
      { id: 'o10', type: 'medication', name: 'Aspirin', details: '325mg PO x1' },
      { id: 'o11', type: 'medication', name: 'Nitroglycerin', details: '0.4mg SL PRN chest pain' },
    ],
  },
  {
    id: '3',
    name: 'DKA Protocol',
    category: 'DKA Protocol',
    description: 'Diabetic Ketoacidosis management protocol',
    scope: 'hospital',
    orders: [
      { id: 'o12', type: 'lab', name: 'BMP', details: 'Q2h until stable' },
      { id: 'o13', type: 'lab', name: 'ABG', details: 'Arterial Blood Gas' },
      { id: 'o14', type: 'lab', name: 'Beta-hydroxybutyrate', details: 'Serial monitoring' },
      { id: 'o15', type: 'medication', name: 'Insulin Regular', details: 'IV drip per protocol' },
      { id: 'o16', type: 'medication', name: 'Potassium', details: 'IV replacement per K+ level' },
      { id: 'o17', type: 'medication', name: 'NS', details: '1L bolus then 500mL/hr' },
    ],
  },
  {
    id: '4',
    name: 'Sepsis Bundle (Hour-1)',
    category: 'Sepsis Bundle',
    description: 'Initial sepsis resuscitation bundle',
    scope: 'hospital',
    isFavorite: true,
    orders: [
      { id: 'o18', type: 'lab', name: 'Lactate', details: 'Serial q2h' },
      { id: 'o19', type: 'lab', name: 'Blood Cultures x2', details: 'Before antibiotics' },
      { id: 'o20', type: 'lab', name: 'CBC, BMP, LFT', details: 'Comprehensive panel' },
      { id: 'o21', type: 'medication', name: 'Crystalloid', details: '30mL/kg IV bolus' },
      { id: 'o22', type: 'medication', name: 'Broad-spectrum ABx', details: 'Per local protocol' },
      { id: 'o23', type: 'procedure', name: 'Central Line', details: 'If vasopressors needed' },
    ],
  },
  {
    id: '5',
    name: 'CHF Exacerbation',
    category: 'CHF',
    description: 'Heart failure exacerbation management',
    scope: 'hospital',
    orders: [
      { id: 'o24', type: 'lab', name: 'BNP', details: 'Baseline and daily' },
      { id: 'o25', type: 'lab', name: 'BMP', details: 'Monitor electrolytes' },
      { id: 'o26', type: 'procedure', name: 'CXR', details: 'Portable chest X-ray' },
      { id: 'o27', type: 'procedure', name: 'Echo', details: 'If EF unknown' },
      { id: 'o28', type: 'medication', name: 'Furosemide', details: '40-80mg IV q12h' },
      { id: 'o29', type: 'medication', name: 'Fluid Restriction', details: '1.5L/day' },
    ],
  },
  {
    id: '6',
    name: 'Pre-Op Clearance',
    category: 'Pre-Op',
    description: 'Standard pre-operative laboratory workup',
    scope: 'hospital',
    orders: [
      { id: 'o30', type: 'lab', name: 'CBC', details: 'Complete Blood Count' },
      { id: 'o31', type: 'lab', name: 'BMP', details: 'Basic Metabolic Panel' },
      { id: 'o32', type: 'lab', name: 'PT/INR', details: 'Coagulation studies' },
      { id: 'o33', type: 'lab', name: 'Type & Screen', details: 'Blood bank' },
      { id: 'o34', type: 'procedure', name: 'ECG', details: 'If age >50 or cardiac history' },
    ],
  },
  {
    id: '7',
    name: 'My DM Annual Labs',
    category: 'Diabetes',
    description: 'Annual monitoring for diabetic patients',
    scope: 'personal',
    orders: [
      { id: 'o35', type: 'lab', name: 'HbA1c', details: 'Glycated hemoglobin' },
      { id: 'o36', type: 'lab', name: 'Lipid Panel', details: 'Fasting lipids' },
      { id: 'o37', type: 'lab', name: 'BMP', details: 'Kidney function' },
      { id: 'o38', type: 'lab', name: 'Urine Albumin/Cr', details: 'Microalbuminuria' },
    ],
  },
  {
    id: '8',
    name: 'My HTN Workup',
    category: 'Hypertension',
    description: 'Initial hypertension evaluation',
    scope: 'personal',
    orders: [
      { id: 'o39', type: 'lab', name: 'BMP', details: 'Electrolytes and kidney' },
      { id: 'o40', type: 'lab', name: 'Lipid Panel', details: 'Cardiovascular risk' },
      { id: 'o41', type: 'lab', name: 'TSH', details: 'Thyroid function' },
      { id: 'o42', type: 'procedure', name: 'ECG', details: 'Baseline cardiac' },
    ],
  },
];

const categories = ['All', 'Admission', 'Chest Pain', 'DKA Protocol', 'Sepsis Bundle', 'CHF', 'Pre-Op', 'Diabetes', 'Hypertension'];

export default function OrderSetsPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'hospital' | 'personal'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSet, setSelectedSet] = useState<OrderSet | null>(null);
  const [expandedSets, setExpandedSets] = useState<string[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 20 }),
    enabled: patientSearch.length > 0,
  });

  const filteredPatients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      mrn: p.mrn,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
    }));
  }, [patientsData]);

  const filteredOrderSets = useMemo(() => {
    return orderSets.filter((set) => {
      const matchesCategory = selectedCategory === 'All' || set.category === selectedCategory;
      const matchesScope = scopeFilter === 'all' || set.scope === scopeFilter;
      const matchesSearch =
        set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        set.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesScope && matchesSearch;
    });
  }, [selectedCategory, scopeFilter, searchTerm]);

  const toggleExpand = (setId: string) => {
    setExpandedSets((prev) =>
      prev.includes(setId) ? prev.filter((id) => id !== setId) : [...prev, setId]
    );
  };

  const toggleOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const selectAllFromSet = (set: OrderSet) => {
    const orderIds = set.orders.map((o) => o.id);
    setSelectedOrders((prev) => {
      const newOrders = [...prev];
      orderIds.forEach((id) => {
        if (!newOrders.includes(id)) {
          newOrders.push(id);
        }
      });
      return newOrders;
    });
    setSelectedSet(set);
  };

  const getOrderIcon = (type: string) => {
    switch (type) {
      case 'lab':
        return <FlaskConical className="w-4 h-4 text-purple-500" />;
      case 'medication':
        return <Pill className="w-4 h-4 text-blue-500" />;
      case 'procedure':
        return <Syringe className="w-4 h-4 text-green-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-500" />;
    }
  };

  const selectedOrderDetails = useMemo(() => {
    const allOrders = orderSets.flatMap((set) => set.orders);
    return allOrders.filter((order) => selectedOrders.includes(order.id));
  }, [selectedOrders]);

  const handleSubmit = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one order');
      return;
    }
    toast.success(`Order set applied!\nPatient: ${selectedPatient.name}\nOrders: ${selectedOrders.length} items submitted`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Layers className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Order Sets</h1>
              <p className="text-sm text-gray-500">Pre-defined order bundles</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Order Set
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Order Sets List */}
        <div className="flex-1 flex flex-col overflow-hidden border-r bg-white">
          {/* Patient Selector */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or MRN..."
                value={selectedPatient ? selectedPatient.name : patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatient(null);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {showPatientDropdown && !selectedPatient && patientSearch.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {isLoadingPatients ? (
                    <div className="px-4 py-3 flex items-center justify-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Searching patients...</span>
                    </div>
                  ) : filteredPatients.length === 0 ? (
                    <div className="px-4 py-3 text-center text-sm text-gray-500">
                      No patients found
                    </div>
                  ) : (
                    filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setShowPatientDropdown(false);
                          setPatientSearch('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="font-medium">{patient.name}</span>
                        <span className="text-sm text-gray-500">{patient.mrn}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 text-sm text-gray-600">
                {selectedPatient.age}y {selectedPatient.gender} • {selectedPatient.mrn}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="p-4 border-b">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setScopeFilter('all')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  scopeFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Sets
              </button>
              <button
                onClick={() => setScopeFilter('hospital')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  scopeFilter === 'hospital' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Building className="w-4 h-4" />
                Hospital
              </button>
              <button
                onClick={() => setScopeFilter('personal')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  scopeFilter === 'personal' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <UserCircle className="w-4 h-4" />
                Personal
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search order sets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex border-b overflow-x-auto py-2 px-4 gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Order Sets List */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3">
              {filteredOrderSets.map((set) => (
                <div
                  key={set.id}
                  className={`rounded-lg border transition-colors ${
                    selectedSet?.id === set.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            set.scope === 'hospital' ? 'bg-blue-100' : 'bg-purple-100'
                          }`}
                        >
                          {set.scope === 'hospital' ? (
                            <Building className="w-5 h-5 text-blue-600" />
                          ) : (
                            <UserCircle className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{set.name}</span>
                            {set.isFavorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{set.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                              {set.orders.length} orders
                            </span>
                            <span className="text-xs text-gray-500">{set.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {set.scope === 'personal' && (
                          <button className="p-2 hover:bg-gray-100 rounded-lg" title="Edit">
                            <Edit3 className="w-4 h-4 text-gray-500" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="Duplicate">
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => toggleExpand(set.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          {expandedSets.includes(set.id) ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Order Details */}
                    {expandedSets.includes(set.id) && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="space-y-2">
                          {set.orders.map((order) => (
                            <button
                              key={order.id}
                              onClick={() => toggleOrder(order.id)}
                              className={`w-full p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                                selectedOrders.includes(order.id)
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {selectedOrders.includes(order.id) ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4 text-gray-400" />
                              )}
                              {getOrderIcon(order.type)}
                              <div className="flex-1">
                                <span className="font-medium">{order.name}</span>
                                <span className="text-gray-500 ml-2">{order.details}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => selectAllFromSet(set)}
                          className="mt-3 w-full py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                        >
                          Apply All Orders from This Set
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Selected Orders */}
        <div className="w-96 flex flex-col overflow-hidden bg-gray-50">
          <div className="p-4 border-b bg-white">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Selected Orders ({selectedOrders.length})
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {selectedOrderDetails.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No orders selected</p>
                <p className="text-xs mt-1">Expand an order set and select items</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedOrderDetails.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 bg-white rounded-lg border flex items-start gap-3"
                  >
                    {getOrderIcon(order.type)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900">{order.name}</div>
                      <div className="text-xs text-gray-500">{order.details}</div>
                    </div>
                    <button
                      onClick={() => toggleOrder(order.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary by Type */}
          {selectedOrderDetails.length > 0 && (
            <div className="p-4 border-t bg-white">
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 bg-purple-50 rounded-lg">
                  <FlaskConical className="w-4 h-4 text-purple-600 mx-auto" />
                  <div className="text-sm font-medium mt-1">
                    {selectedOrderDetails.filter((o) => o.type === 'lab').length}
                  </div>
                  <div className="text-xs text-gray-500">Labs</div>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <Pill className="w-4 h-4 text-blue-600 mx-auto" />
                  <div className="text-sm font-medium mt-1">
                    {selectedOrderDetails.filter((o) => o.type === 'medication').length}
                  </div>
                  <div className="text-xs text-gray-500">Meds</div>
                </div>
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <Syringe className="w-4 h-4 text-green-600 mx-auto" />
                  <div className="text-sm font-medium mt-1">
                    {selectedOrderDetails.filter((o) => o.type === 'procedure').length}
                  </div>
                  <div className="text-xs text-gray-500">Procs</div>
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="p-4 border-t bg-white">
            <button
              onClick={handleSubmit}
              disabled={!selectedPatient || selectedOrders.length === 0}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Apply to Patient
            </button>
            <p className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              Orders will be submitted for review
            </p>
          </div>
        </div>
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Create New Order Set</h2>
            <p className="text-gray-500 text-sm mb-4">
              This feature allows you to create custom order sets for your practice.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Order set name..."
                className="w-full p-3 border rounded-lg"
              />
              <textarea
                placeholder="Description..."
                className="w-full p-3 border rounded-lg resize-none"
                rows={2}
              />
              <select className="w-full p-3 border rounded-lg">
                <option>Select category...</option>
                {categories.slice(1).map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('Order set creation would be implemented here');
                  setShowCreateModal(false);
                }}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
