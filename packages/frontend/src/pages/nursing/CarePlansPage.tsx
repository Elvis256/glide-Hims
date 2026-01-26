import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Edit2,
  Target,
  X,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface CarePlan {
  id: string;
  patientId: string;
  diagnosis: string;
  goals: string[];
  interventions: string[];
  status: 'active' | 'achieved' | 'discontinued';
  createdDate: string;
  targetDate: string;
  updatedDate: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
];

const mockCarePlans: CarePlan[] = [
  {
    id: 'cp1',
    patientId: '1',
    diagnosis: 'Risk for impaired skin integrity related to immobility',
    goals: ['Patient will maintain intact skin', 'Patient will demonstrate understanding of pressure ulcer prevention'],
    interventions: ['Reposition q2h', 'Apply barrier cream to bony prominences', 'Maintain adequate nutrition', 'Assess skin daily'],
    status: 'active',
    createdDate: '2024-01-10',
    targetDate: '2024-02-10',
    updatedDate: '2024-01-15',
  },
  {
    id: 'cp2',
    patientId: '1',
    diagnosis: 'Acute pain related to surgical incision',
    goals: ['Patient will report pain level ≤3/10', 'Patient will demonstrate relaxation techniques'],
    interventions: ['Administer analgesics as prescribed', 'Teach non-pharmacological pain management', 'Assess pain q4h'],
    status: 'achieved',
    createdDate: '2024-01-05',
    targetDate: '2024-01-12',
    updatedDate: '2024-01-12',
  },
  {
    id: 'cp3',
    patientId: '2',
    diagnosis: 'Impaired mobility related to lower extremity weakness',
    goals: ['Patient will ambulate 50 feet with assistance', 'Patient will participate in physical therapy'],
    interventions: ['Assist with ambulation TID', 'Coordinate with physical therapy', 'Provide mobility aids', 'Encourage active ROM exercises'],
    status: 'active',
    createdDate: '2024-01-12',
    targetDate: '2024-01-30',
    updatedDate: '2024-01-15',
  },
];

const statusConfig = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  achieved: { label: 'Achieved', color: 'bg-green-100 text-green-700' },
  discontinued: { label: 'Discontinued', color: 'bg-gray-100 text-gray-700' },
};

export default function CarePlansPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'achieved' | 'discontinued'>('all');

  const [formData, setFormData] = useState({
    diagnosis: '',
    goals: '',
    interventions: '',
    status: 'active' as 'active' | 'achieved' | 'discontinued',
    targetDate: '',
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const patientCarePlans = useMemo(() => {
    let plans = mockCarePlans.filter((cp) => cp.patientId === selectedPatient?.id);
    if (statusFilter !== 'all') {
      plans = plans.filter((cp) => cp.status === statusFilter);
    }
    return plans;
  }, [selectedPatient, statusFilter]);

  const handleOpenAdd = () => {
    setFormData({
      diagnosis: '',
      goals: '',
      interventions: '',
      status: 'active',
      targetDate: '',
    });
    setEditingPlan(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (plan: CarePlan) => {
    setFormData({
      diagnosis: plan.diagnosis,
      goals: plan.goals.join('\n'),
      interventions: plan.interventions.join('\n'),
      status: plan.status,
      targetDate: plan.targetDate,
    });
    setEditingPlan(plan);
    setShowAddModal(true);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setShowAddModal(false);
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Care Plans</h1>
            <p className="text-sm text-gray-500">Nursing care plans management</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Care plan saved</span>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {(searchTerm ? filteredPatients : mockPatients).map((patient) => {
              const planCount = mockCarePlans.filter((cp) => cp.patientId === patient.id && cp.status === 'active').length;
              return (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPatient?.id === patient.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn}</p>
                    </div>
                    {planCount > 0 && (
                      <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                        {planCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Care Plans List */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{patientCarePlans.length} care plan(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="achieved">Achieved</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                  <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Care Plan
                  </button>
                </div>
              </div>

              {/* Plans List */}
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {patientCarePlans.length > 0 ? (
                  patientCarePlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[plan.status].color}`}>
                              {statusConfig[plan.status].label}
                            </span>
                            <span className="text-xs text-gray-400">Target: {plan.targetDate}</span>
                          </div>
                          <h3 className="font-medium text-gray-900">{plan.diagnosis}</h3>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(plan)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Target className="w-4 h-4 text-teal-600" />
                            Goals
                          </h4>
                          <ul className="space-y-1">
                            {plan.goals.map((goal, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-teal-500 mt-1">•</span>
                                {goal}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <ClipboardList className="w-4 h-4 text-teal-600" />
                            Interventions
                          </h4>
                          <ul className="space-y-1">
                            {plan.interventions.map((intervention, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-teal-500 mt-1">•</span>
                                {intervention}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                        Created: {plan.createdDate} • Last updated: {plan.updatedDate}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No care plans found</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view care plans</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPlan ? 'Edit Care Plan' : 'New Care Plan'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nursing Diagnosis *</label>
                <textarea
                  rows={2}
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="e.g., Risk for impaired skin integrity related to immobility"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Goals (one per line)</label>
                <textarea
                  rows={3}
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Enter each goal on a new line..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Interventions (one per line)</label>
                <textarea
                  rows={4}
                  value={formData.interventions}
                  onChange={(e) => setFormData({ ...formData, interventions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Enter each intervention on a new line..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Target Date</label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="achieved">Achieved</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.diagnosis}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Care Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}