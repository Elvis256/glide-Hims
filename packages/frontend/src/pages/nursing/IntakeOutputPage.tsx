import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Droplet,
  Search,
  UserCircle,
  Plus,
  Minus,
  Scale,
  Clock,
  Trash2,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
  admissionId?: string;
}

interface IOEntry {
  id: string;
  time: string;
  type: 'intake' | 'output';
  category: string;
  amount: number;
  notes?: string;
}

// Calculate age from date of birth
const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const intakeCategories = [
  { value: 'oral', label: 'Oral', icon: '🥤' },
  { value: 'iv', label: 'IV Fluids', icon: '💉' },
  { value: 'tube', label: 'Tube Feeding', icon: '🍼' },
  { value: 'tpn', label: 'TPN', icon: '💧' },
  { value: 'blood', label: 'Blood Products', icon: '🩸' },
];

const outputCategories = [
  { value: 'urine', label: 'Urine', icon: '🚽' },
  { value: 'drain', label: 'Drain', icon: '💧' },
  { value: 'emesis', label: 'Emesis', icon: '🤢' },
  { value: 'stool', label: 'Stool', icon: '💩' },
  { value: 'ng', label: 'NG Output', icon: '📍' },
  { value: 'ostomy', label: 'Ostomy', icon: '📦' },
];

export default function IntakeOutputPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [entries, setEntries] = useState<IOEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<'intake' | 'output'>('intake');

  const [newEntry, setNewEntry] = useState({
    time: new Date().toTimeString().slice(0, 5),
    category: '',
    amount: '',
    notes: '',
  });

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  // Get current admission for selected patient
  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  // Create nursing note mutation for I/O recording
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
    },
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
    }));
  }, [apiPatients, searchTerm]);

  const { totalIntake, totalOutput, balance, intakeByCategory, outputByCategory } = useMemo(() => {
    const intakes = entries.filter((e) => e.type === 'intake');
    const outputs = entries.filter((e) => e.type === 'output');
    const totalIn = intakes.reduce((sum, e) => sum + e.amount, 0);
    const totalOut = outputs.reduce((sum, e) => sum + e.amount, 0);

    const intakeByCat: Record<string, number> = {};
    intakes.forEach((e) => {
      intakeByCat[e.category] = (intakeByCat[e.category] || 0) + e.amount;
    });

    const outputByCat: Record<string, number> = {};
    outputs.forEach((e) => {
      outputByCat[e.category] = (outputByCat[e.category] || 0) + e.amount;
    });

    return {
      totalIntake: totalIn,
      totalOutput: totalOut,
      balance: totalIn - totalOut,
      intakeByCategory: intakeByCat,
      outputByCategory: outputByCat,
    };
  }, [entries]);

  const handleAddEntry = () => {
    if (!newEntry.category || !newEntry.amount) return;
    
    const entry: IOEntry = {
      id: Date.now().toString(),
      time: newEntry.time,
      type: addType,
      category: newEntry.category,
      amount: parseInt(newEntry.amount),
      notes: newEntry.notes || undefined,
    };
    
    setEntries((prev) => [...prev, entry].sort((a, b) => a.time.localeCompare(b.time)));
    
    // Save to backend if we have an admission
    if (admission?.id) {
      const ioData = addType === 'intake' 
        ? { oralIntake: parseInt(newEntry.amount) }
        : { urineOutput: parseInt(newEntry.amount) };
      
      createNoteMutation.mutate({
        admissionId: admission.id,
        type: 'observation',
        content: `${addType === 'intake' ? 'Intake' : 'Output'}: ${newEntry.category} - ${newEntry.amount}ml${newEntry.notes ? '. ' + newEntry.notes : ''}`,
        intakeOutput: ioData,
      });
    }
    
    setNewEntry({ time: new Date().toTimeString().slice(0, 5), category: '', amount: '', notes: '' });
    setShowAddForm(false);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.time.localeCompare(a.time));
  }, [entries]);

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
          <Droplet className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Intake/Output Tracking</h1>
            <p className="text-sm text-gray-500">24-hour I/O chart</p>
          </div>
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
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
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
                    {admission && (
                      <p className="text-xs text-teal-600">{admission.ward?.name} - Bed {admission.bed?.bedNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient to track I/O</p>
            )}
          </div>
        </div>

        {/* I/O Chart */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          {selectedPatient ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Total Intake</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{totalIntake} ml</p>
                  <div className="mt-2 space-y-1">
                    {Object.entries(intakeByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between text-xs text-green-600">
                        <span>{cat}</span>
                        <span>{amt} ml</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-700">Total Output</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">{totalOutput} ml</p>
                  <div className="mt-2 space-y-1">
                    {Object.entries(outputByCategory).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between text-xs text-orange-600">
                        <span>{cat}</span>
                        <span>{amt} ml</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`border rounded-xl p-4 ${
                  balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Scale className="w-5 h-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Balance</span>
                  </div>
                  <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {balance >= 0 ? '+' : ''}{balance} ml
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {balance >= 0 ? 'Positive balance (fluid retention)' : 'Negative balance (fluid loss)'}
                  </p>
                </div>
              </div>

              {/* Add Entry Form */}
              {showAddForm ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      Add {addType === 'intake' ? 'Intake' : 'Output'}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAddType('intake')}
                        className={`px-3 py-1 rounded text-sm ${
                          addType === 'intake'
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Intake
                      </button>
                      <button
                        onClick={() => setAddType('output')}
                        className={`px-3 py-1 rounded text-sm ${
                          addType === 'output'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        Output
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Time</label>
                      <input
                        type="time"
                        value={newEntry.time}
                        onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Category</label>
                      <select
                        value={newEntry.category}
                        onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select...</option>
                        {(addType === 'intake' ? intakeCategories : outputCategories).map((cat) => (
                          <option key={cat.value} value={cat.label}>
                            {cat.icon} {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Amount (ml)</label>
                      <input
                        type="number"
                        value={newEntry.amount}
                        onChange={(e) => setNewEntry({ ...newEntry, amount: e.target.value })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Notes</label>
                      <input
                        type="text"
                        value={newEntry.notes}
                        onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                        placeholder="Optional"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEntry}
                      disabled={!newEntry.category || !newEntry.amount}
                      className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      Add Entry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAddType('intake'); setShowAddForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Intake
                  </button>
                  <button
                    onClick={() => { setAddType('output'); setShowAddForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700"
                  >
                    <Minus className="w-4 h-4" />
                    Add Output
                  </button>
                </div>
              )}

              {/* I/O Log */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
                <h3 className="font-semibold text-gray-900 mb-3">24-Hour Log</h3>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="pb-2 font-medium">Time</th>
                        <th className="pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium text-right">Amount</th>
                        <th className="pb-2 font-medium">Notes</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-500">
                            <Droplet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p>No entries recorded. Add intake or output to get started.</p>
                          </td>
                        </tr>
                      ) : sortedEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2">
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="w-3 h-3 text-gray-400" />
                              {entry.time}
                            </div>
                          </td>
                          <td className="py-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              entry.type === 'intake'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {entry.type === 'intake' ? 'IN' : 'OUT'}
                            </span>
                          </td>
                          <td className="py-2 text-sm text-gray-700">{entry.category}</td>
                          <td className="py-2 text-sm font-medium text-right">{entry.amount} ml</td>
                          <td className="py-2 text-sm text-gray-500">{entry.notes || '-'}</td>
                          <td className="py-2">
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Droplet className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to track intake/output</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
