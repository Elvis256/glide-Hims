import { useState, useMemo } from 'react';
import {
  Plus,
  Filter,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Search,
  X,
  Save,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';

type ProblemStatus = 'Active' | 'Resolved' | 'Chronic';
type FilterType = 'All' | ProblemStatus;

interface Problem {
  id: string;
  diagnosis: string;
  icdCode: string;
  onsetDate: string;
  status: ProblemStatus;
  lastUpdated: string;
  notes?: string;
}

interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
}

const initialProblems: Problem[] = [
  {
    id: '1',
    diagnosis: 'Essential Hypertension',
    icdCode: 'I10',
    onsetDate: '2019-03-15',
    status: 'Chronic',
    lastUpdated: '2024-01-10',
    notes: 'Well controlled on current medication',
  },
  {
    id: '2',
    diagnosis: 'Type 2 Diabetes Mellitus',
    icdCode: 'E11.9',
    onsetDate: '2020-08-22',
    status: 'Chronic',
    lastUpdated: '2024-01-10',
    notes: 'HbA1c 7.2%, on metformin',
  },
  {
    id: '3',
    diagnosis: 'Acute Bronchitis',
    icdCode: 'J20.9',
    onsetDate: '2024-01-05',
    status: 'Active',
    lastUpdated: '2024-01-08',
  },
  {
    id: '4',
    diagnosis: 'Seasonal Allergic Rhinitis',
    icdCode: 'J30.2',
    onsetDate: '2023-04-01',
    status: 'Resolved',
    lastUpdated: '2023-06-15',
  },
  {
    id: '5',
    diagnosis: 'Hyperlipidemia',
    icdCode: 'E78.5',
    onsetDate: '2021-02-10',
    status: 'Chronic',
    lastUpdated: '2024-01-10',
    notes: 'LDL at goal on statin therapy',
  },
];

const commonDiagnoses = [
  { diagnosis: 'Essential Hypertension', icdCode: 'I10' },
  { diagnosis: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9' },
  { diagnosis: 'Hyperlipidemia', icdCode: 'E78.5' },
  { diagnosis: 'Major Depressive Disorder', icdCode: 'F32.9' },
  { diagnosis: 'Generalized Anxiety Disorder', icdCode: 'F41.1' },
  { diagnosis: 'Osteoarthritis', icdCode: 'M19.90' },
  { diagnosis: 'GERD', icdCode: 'K21.0' },
  { diagnosis: 'Asthma', icdCode: 'J45.909' },
];

export default function ProblemListPage() {
  const [problems, setProblems] = useState<Problem[]>(initialProblems);
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProblem, setEditingProblem] = useState<Problem | null>(null);
  const [newProblem, setNewProblem] = useState({
    diagnosis: '',
    icdCode: '',
    onsetDate: new Date().toISOString().split('T')[0],
    status: 'Active' as ProblemStatus,
    notes: '',
  });

  // Fetch patients from API
  const { data: patientsData, isLoading: isLoadingPatients } = useQuery({
    queryKey: ['patients', patientSearchQuery],
    queryFn: () => patientsService.search({ search: patientSearchQuery, limit: 10 }),
  });

  // Transform API patients to local Patient interface
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      dob: p.dateOfBirth,
      mrn: p.mrn,
    }));
  }, [patientsData]);

  const filteredProblems = useMemo(() => {
    return problems.filter((problem) => {
      const matchesFilter = filter === 'All' || problem.status === filter;
      const matchesSearch =
        !searchQuery ||
        problem.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        problem.icdCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [problems, filter, searchQuery]);

  const statusCounts = useMemo(() => {
    return {
      All: problems.length,
      Active: problems.filter((p) => p.status === 'Active').length,
      Chronic: problems.filter((p) => p.status === 'Chronic').length,
      Resolved: problems.filter((p) => p.status === 'Resolved').length,
    };
  }, [problems]);

  const addProblem = () => {
    if (!newProblem.diagnosis || !newProblem.icdCode) return;

    const problem: Problem = {
      id: crypto.randomUUID(),
      diagnosis: newProblem.diagnosis,
      icdCode: newProblem.icdCode,
      onsetDate: newProblem.onsetDate,
      status: newProblem.status,
      lastUpdated: new Date().toISOString().split('T')[0],
      notes: newProblem.notes || undefined,
    };

    setProblems([problem, ...problems]);
    setNewProblem({
      diagnosis: '',
      icdCode: '',
      onsetDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      notes: '',
    });
    setShowAddModal(false);
  };

  const updateProblem = () => {
    if (!editingProblem) return;

    setProblems(
      problems.map((p) =>
        p.id === editingProblem.id
          ? { ...editingProblem, lastUpdated: new Date().toISOString().split('T')[0] }
          : p
      )
    );
    setEditingProblem(null);
  };

  const deleteProblem = (id: string) => {
    setProblems(problems.filter((p) => p.id !== id));
  };

  const markResolved = (id: string) => {
    setProblems(
      problems.map((p) =>
        p.id === id
          ? { ...p, status: 'Resolved' as ProblemStatus, lastUpdated: new Date().toISOString().split('T')[0] }
          : p
      )
    );
  };

  const selectCommonDiagnosis = (diagnosis: { diagnosis: string; icdCode: string }) => {
    setNewProblem({
      ...newProblem,
      diagnosis: diagnosis.diagnosis,
      icdCode: diagnosis.icdCode,
    });
  };

  const getStatusIcon = (status: ProblemStatus) => {
    switch (status) {
      case 'Active':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'Chronic':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'Resolved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getStatusStyle = (status: ProblemStatus) => {
    switch (status) {
      case 'Active':
        return 'bg-red-100 text-red-700';
      case 'Chronic':
        return 'bg-yellow-100 text-yellow-700';
      case 'Resolved':
        return 'bg-green-100 text-green-700';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        {!selectedPatient ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Select Patient</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                placeholder="Search patients by name or MRN..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {isLoadingPatients && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {patients.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{patient.name}</div>
                      <div className="text-sm text-gray-500">
                        DOB: {formatDate(patient.dob)} | MRN: {patient.mrn}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {patientSearchQuery && !isLoadingPatients && patients.length === 0 && (
              <p className="text-sm text-gray-500">No patients found</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{selectedPatient.name}</h2>
              <p className="text-sm text-gray-600">
                DOB: {formatDate(selectedPatient.dob)} | MRN: {selectedPatient.mrn}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
              >
                Change Patient
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Problem
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['All', 'Active', 'Chronic', 'Resolved'] as FilterType[]).map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    filter === filterOption
                      ? 'bg-white text-blue-600 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {filterOption}
                  <span className="ml-1 text-xs text-gray-400">({statusCounts[filterOption]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search problems..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Problem List */}
      <div className="flex-1 bg-white rounded-lg shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-4">Problem / ICD Code</div>
          <div className="col-span-2">Onset Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Last Updated</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {filteredProblems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>No problems found matching your criteria</p>
            </div>
          ) : (
            filteredProblems.map((problem) => (
              <div
                key={problem.id}
                className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-gray-100 hover:bg-gray-50 items-center"
              >
                <div className="col-span-4">
                  <div className="font-medium text-gray-800">{problem.diagnosis}</div>
                  <div className="text-sm font-mono text-blue-600">{problem.icdCode}</div>
                  {problem.notes && (
                    <div className="text-xs text-gray-500 mt-1 truncate">{problem.notes}</div>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(problem.onsetDate)}
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(problem.status)}`}
                  >
                    {getStatusIcon(problem.status)}
                    {problem.status}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-gray-600">{formatDate(problem.lastUpdated)}</div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  {problem.status !== 'Resolved' && (
                    <button
                      onClick={() => markResolved(problem.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                      title="Mark Resolved"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditingProblem(problem)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProblem(problem.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Problem Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Add New Problem</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Quick Pick */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Pick</label>
                <div className="flex flex-wrap gap-2">
                  {commonDiagnoses.map((d) => (
                    <button
                      key={d.icdCode}
                      onClick={() => selectCommonDiagnosis(d)}
                      className="px-2 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full"
                    >
                      {d.diagnosis}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={newProblem.diagnosis}
                  onChange={(e) => setNewProblem({ ...newProblem, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Enter diagnosis"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Code</label>
                <input
                  type="text"
                  value={newProblem.icdCode}
                  onChange={(e) => setNewProblem({ ...newProblem, icdCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., I10"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
                  <input
                    type="date"
                    value={newProblem.onsetDate}
                    onChange={(e) => setNewProblem({ ...newProblem, onsetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={newProblem.status}
                    onChange={(e) => setNewProblem({ ...newProblem, status: e.target.value as ProblemStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Chronic">Chronic</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={newProblem.notes}
                  onChange={(e) => setNewProblem({ ...newProblem, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none h-20"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={addProblem}
                disabled={!newProblem.diagnosis || !newProblem.icdCode}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Add Problem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Problem Modal */}
      {editingProblem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Edit Problem</h3>
              <button onClick={() => setEditingProblem(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={editingProblem.diagnosis}
                  onChange={(e) => setEditingProblem({ ...editingProblem, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ICD-10 Code</label>
                <input
                  type="text"
                  value={editingProblem.icdCode}
                  onChange={(e) => setEditingProblem({ ...editingProblem, icdCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Onset Date</label>
                  <input
                    type="date"
                    value={editingProblem.onsetDate}
                    onChange={(e) => setEditingProblem({ ...editingProblem, onsetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={editingProblem.status}
                    onChange={(e) =>
                      setEditingProblem({ ...editingProblem, status: e.target.value as ProblemStatus })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Chronic">Chronic</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editingProblem.notes || ''}
                  onChange={(e) => setEditingProblem({ ...editingProblem, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none h-20"
                />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setEditingProblem(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={updateProblem}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
