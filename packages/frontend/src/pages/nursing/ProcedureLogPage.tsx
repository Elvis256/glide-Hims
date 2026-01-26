import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Filter,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
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

interface ProcedureRecord {
  id: string;
  patientId: string;
  patientName: string;
  procedureType: string;
  category: string;
  dateTime: string;
  performedBy: string;
  complications: string;
  notes: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
  { id: '4', mrn: 'MRN-2024-0004', name: 'Peter Ochieng', age: 45, gender: 'Male', ward: 'ICU', bed: 'ICU-2' },
  { id: '5', mrn: 'MRN-2024-0005', name: 'Mary Achieng', age: 52, gender: 'Female', ward: 'Ward C', bed: 'C-08' },
];

const mockProcedures: ProcedureRecord[] = [
  { id: '1', patientId: '1', patientName: 'Sarah Nakimera', procedureType: 'IV Cannulation', category: 'Vascular Access', dateTime: '2024-01-15 09:30', performedBy: 'Nurse Mary', complications: 'None', notes: '20G in left antecubital' },
  { id: '2', patientId: '2', patientName: 'James Okello', procedureType: 'Urinary Catheterization', category: 'Urological', dateTime: '2024-01-15 10:15', performedBy: 'Nurse Jane', complications: 'None', notes: '16Fr Foley' },
  { id: '3', patientId: '4', patientName: 'Peter Ochieng', procedureType: 'NG Tube Insertion', category: 'GI', dateTime: '2024-01-15 11:00', performedBy: 'Nurse John', complications: 'Mild epistaxis', notes: 'Confirmed placement with X-ray' },
  { id: '4', patientId: '1', patientName: 'Sarah Nakimera', procedureType: 'Blood Glucose Monitoring', category: 'Monitoring', dateTime: '2024-01-15 14:00', performedBy: 'Nurse Mary', complications: 'None', notes: 'Result: 126 mg/dL' },
  { id: '5', patientId: '5', patientName: 'Mary Achieng', procedureType: 'ECG Recording', category: 'Cardiac', dateTime: '2024-01-15 15:30', performedBy: 'Nurse Sarah', complications: 'None', notes: '12-lead ECG completed' },
];

const procedureCategories = [
  { value: 'all', label: 'All Categories' },
  { value: 'vascular', label: 'Vascular Access' },
  { value: 'urological', label: 'Urological' },
  { value: 'respiratory', label: 'Respiratory' },
  { value: 'gi', label: 'GI/Enteral' },
  { value: 'wound', label: 'Wound Care' },
  { value: 'cardiac', label: 'Cardiac' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'other', label: 'Other' },
];

const procedureTypes: Record<string, string[]> = {
  vascular: ['IV Cannulation', 'Blood Draw', 'Central Line Care', 'PICC Line Care', 'Arterial Line Insertion'],
  urological: ['Urinary Catheterization', 'Catheter Irrigation', 'Catheter Removal', 'Bladder Scan'],
  respiratory: ['Oxygen Therapy', 'Nebulizer Treatment', 'Suctioning', 'Chest Physiotherapy', 'Peak Flow Measurement'],
  gi: ['NG Tube Insertion', 'NG Tube Feeding', 'Enema Administration', 'Ostomy Care', 'Gastrostomy Care'],
  wound: ['Wound Dressing', 'Suture Removal', 'Drain Care', 'Staple Removal', 'Wound Irrigation'],
  cardiac: ['ECG Recording', 'Cardiac Monitoring Setup', 'Telemetry Application'],
  monitoring: ['Blood Glucose Monitoring', 'Vital Signs', 'Neurological Assessment', 'Pain Assessment'],
  other: ['Medication Administration', 'Blood Transfusion', 'Dialysis Access Care', 'Tracheostomy Care'],
};

const complications = [
  'None',
  'Pain/Discomfort',
  'Bleeding',
  'Failed Procedure',
  'Infection Signs',
  'Allergic Reaction',
  'Equipment Malfunction',
  'Patient Refusal',
  'Other',
];

export default function ProcedureLogPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [procedures, setProcedures] = useState(mockProcedures);

  const [formData, setFormData] = useState({
    category: '',
    procedureType: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    performedBy: '',
    complications: 'None',
    notes: '',
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

  const filteredProcedures = useMemo(() => {
    let filtered = procedures;
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((p) => p.category.toLowerCase().includes(categoryFilter));
    }
    if (selectedPatient) {
      filtered = filtered.filter((p) => p.patientId === selectedPatient.id);
    }
    return filtered.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [procedures, categoryFilter, selectedPatient]);

  const availableProcedures = formData.category ? procedureTypes[formData.category] || [] : [];

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const newProcedure: ProcedureRecord = {
        id: Date.now().toString(),
        patientId: selectedPatient!.id,
        patientName: selectedPatient!.name,
        procedureType: formData.procedureType,
        category: procedureCategories.find((c) => c.value === formData.category)?.label || formData.category,
        dateTime: `${formData.date} ${formData.time}`,
        performedBy: formData.performedBy,
        complications: formData.complications,
        notes: formData.notes,
      };
      setProcedures((prev) => [newProcedure, ...prev]);
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  const handleReset = () => {
    setFormData({
      category: '',
      procedureType: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      performedBy: '',
      complications: 'None',
      notes: '',
    });
    setSaved(false);
    setShowNewForm(false);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Procedure Log</h1>
              <p className="text-sm text-gray-500">Record and view nursing procedures</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {procedureCategories.map((cat) => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          {selectedPatient && !showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
            >
              <Plus className="w-4 h-4" />
              New Procedure
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm ? (
              filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearchTerm('');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                        {patient.ward && (
                          <p className="text-xs text-teal-600">{patient.ward} - Bed {patient.bed}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y</p>
                    {selectedPatient.ward && (
                      <p className="text-xs text-teal-600">{selectedPatient.ward} - Bed {selectedPatient.bed}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPatient(null);
                    setShowNewForm(false);
                  }}
                  className="mt-2 text-xs text-teal-600 hover:underline"
                >
                  Clear selection
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient or view all procedures</p>
            )}
          </div>
        </div>

        {/* Procedure Log / New Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {showNewForm && selectedPatient ? (
            saved ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Procedure Logged</h2>
                  <p className="text-gray-600 mb-6">
                    {formData.procedureType} for {selectedPatient.name} has been recorded
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Log Another
                    </button>
                    <button
                      onClick={() => { handleReset(); setShowNewForm(false); }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      View Log
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">New Procedure Entry</h2>
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value, procedureType: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select category...</option>
                      {procedureCategories.filter((c) => c.value !== 'all').map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Procedure Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Procedure Type *</label>
                    <select
                      value={formData.procedureType}
                      onChange={(e) => setFormData({ ...formData, procedureType: e.target.value })}
                      disabled={!formData.category}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                    >
                      <option value="">Select procedure...</option>
                      {availableProcedures.map((proc) => (
                        <option key={proc} value={proc}>{proc}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date/Time */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Performed By */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Performed By</label>
                    <input
                      type="text"
                      value={formData.performedBy}
                      onChange={(e) => setFormData({ ...formData, performedBy: e.target.value })}
                      placeholder="Enter name..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  {/* Complications */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Complications</label>
                    <select
                      value={formData.complications}
                      onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        formData.complications !== 'None'
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      {complications.map((comp) => (
                        <option key={comp} value={comp}>{comp}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                    <textarea
                      rows={3}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Procedure details, observations..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                  <button
                    onClick={() => setShowNewForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.category || !formData.procedureType}
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
                        Save Procedure
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">
                  Procedure History {selectedPatient ? `- ${selectedPatient.name}` : ''}
                </h2>
                <span className="text-sm text-gray-500">{filteredProcedures.length} records</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {filteredProcedures.length > 0 ? (
                  <div className="space-y-2">
                    {filteredProcedures.map((proc) => (
                      <div
                        key={proc.id}
                        className={`p-3 rounded-lg border ${
                          proc.complications !== 'None'
                            ? 'border-red-200 bg-red-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{proc.procedureType}</span>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {proc.category}
                              </span>
                              {proc.complications !== 'None' && (
                                <span className="flex items-center gap-1 text-xs text-red-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  {proc.complications}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{proc.patientName}</p>
                            {proc.notes && (
                              <p className="text-xs text-gray-500 mt-1">{proc.notes}</p>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {proc.dateTime.split(' ')[0]}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {proc.dateTime.split(' ')[1]}
                            </div>
                            <p className="mt-1">{proc.performedBy}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No procedures found</p>
                      {selectedPatient && (
                        <button
                          onClick={() => setShowNewForm(true)}
                          className="mt-2 text-teal-600 hover:underline text-sm"
                        >
                          Log a new procedure
                        </button>
                      )}
                    </div>
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
