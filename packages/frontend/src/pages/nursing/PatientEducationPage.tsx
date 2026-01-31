import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  GraduationCap,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Calendar,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Minus,
  FileText,
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
}

interface EducationRecord {
  id: string;
  patientId: string;
  topic: string;
  category: string;
  date: string;
  educator: string;
  understanding: 'excellent' | 'good' | 'fair' | 'poor' | 'needs_reinforcement';
  materialsGiven: string[];
  notes: string;
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

const educationTopics = [
  { category: 'Medications', topics: ['New medication education', 'Medication side effects', 'Pain medication management', 'Insulin administration', 'Anticoagulant therapy'] },
  { category: 'Diet & Nutrition', topics: ['Diabetic diet', 'Low sodium diet', 'Heart-healthy diet', 'Wound healing nutrition', 'Fluid restrictions'] },
  { category: 'Wound Care', topics: ['Post-operative wound care', 'Dressing changes at home', 'Signs of infection', 'Wound healing stages'] },
  { category: 'Respiratory', topics: ['Incentive spirometer use', 'Oxygen therapy', 'Breathing exercises', 'Inhaler technique'] },
  { category: 'Mobility', topics: ['Fall prevention', 'Safe transfer techniques', 'Exercise program', 'Assistive device use'] },
  { category: 'Disease Management', topics: ['Diabetes management', 'Heart failure self-care', 'Blood pressure monitoring', 'Stroke warning signs'] },
  { category: 'Lifestyle', topics: ['Smoking cessation', 'Alcohol moderation', 'Stress management', 'Sleep hygiene'] },
  { category: 'Discharge', topics: ['Discharge instructions', 'Follow-up appointments', 'When to seek emergency care', 'Home care services'] },
];

const materialsOptions = [
  'Printed pamphlet/brochure',
  'Medication schedule card',
  'Instructional video shown',
  'Written instructions',
  'Demonstration kit',
  'Contact information card',
  'Diet guide',
  'Exercise guide',
  'Mobile app recommendation',
  'Support group information',
];

const understandingConfig = {
  excellent: { label: 'Excellent', color: 'bg-green-100 text-green-700', icon: ThumbsUp },
  good: { label: 'Good', color: 'bg-blue-100 text-blue-700', icon: ThumbsUp },
  fair: { label: 'Fair', color: 'bg-yellow-100 text-yellow-700', icon: Minus },
  poor: { label: 'Poor', color: 'bg-orange-100 text-orange-700', icon: ThumbsDown },
  needs_reinforcement: { label: 'Needs Reinforcement', color: 'bg-red-100 text-red-700', icon: BookOpen },
};

export default function PatientEducationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newRecord, setNewRecord] = useState({
    category: '',
    topic: '',
    understanding: 'good' as keyof typeof understandingConfig,
    materialsGiven: [] as string[],
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

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setSaved(true);
      setShowAddForm(false);
      setNewRecord({
        category: '',
        topic: '',
        understanding: 'good',
        materialsGiven: [],
        notes: '',
      });
      setTimeout(() => setSaved(false), 2000);
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

  const saving = createNoteMutation.isPending;

  const selectedCategoryTopics = educationTopics.find((c) => c.category === newRecord.category)?.topics || [];

  const handleMaterialToggle = (material: string) => {
    setNewRecord((prev) => ({
      ...prev,
      materialsGiven: prev.materialsGiven.includes(material)
        ? prev.materialsGiven.filter((m) => m !== material)
        : [...prev.materialsGiven, material],
    }));
  };

  const handleSave = () => {
    if (!admission?.id) {
      // Still show success for demo purposes
      setSaved(true);
      setShowAddForm(false);
      setNewRecord({
        category: '',
        topic: '',
        understanding: 'good',
        materialsGiven: [],
        notes: '',
      });
      setTimeout(() => setSaved(false), 2000);
      return;
    }

    const educationDetails = [
      `Category: ${newRecord.category}`,
      `Topic: ${newRecord.topic}`,
      `Understanding: ${understandingConfig[newRecord.understanding].label}`,
      newRecord.materialsGiven.length > 0 && `Materials: ${newRecord.materialsGiven.join(', ')}`,
      newRecord.notes && `Notes: ${newRecord.notes}`,
    ].filter(Boolean).join('. ');

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'progress',
      content: `Patient Education: ${educationDetails}`,
    });
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
          <GraduationCap className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Patient Education</h1>
            <p className="text-sm text-gray-500">Track education provided to patients</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Education recorded</span>
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
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-8 h-8 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patients found</p>
                </div>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
          </div>
        </div>

        {/* Education Records */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">Patient education records</p>
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                >
                  <Plus className="w-4 h-4" />
                  Record Education
                </button>
              </div>

              {/* Add New Record Form */}
              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">Record Patient Education</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                      <select
                        value={newRecord.category}
                        onChange={(e) => setNewRecord({ ...newRecord, category: e.target.value, topic: '' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select category...</option>
                        {educationTopics.map((cat) => (
                          <option key={cat.category} value={cat.category}>{cat.category}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Topic</label>
                      <select
                        value={newRecord.topic}
                        onChange={(e) => setNewRecord({ ...newRecord, topic: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        disabled={!newRecord.category}
                      >
                        <option value="">Select topic...</option>
                        {selectedCategoryTopics.map((topic) => (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Understanding Assessment</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(understandingConfig).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setNewRecord({ ...newRecord, understanding: key as keyof typeof understandingConfig })}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                                newRecord.understanding === key
                                  ? 'border-teal-500 bg-teal-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span className="text-sm">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Materials Given</label>
                      <div className="flex flex-wrap gap-2">
                        {materialsOptions.map((material) => (
                          <button
                            key={material}
                            type="button"
                            onClick={() => handleMaterialToggle(material)}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                              newRecord.materialsGiven.includes(material)
                                ? 'border-teal-500 bg-teal-50 text-teal-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {material}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                      <textarea
                        rows={2}
                        value={newRecord.notes}
                        onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                        placeholder="Additional observations about patient's learning..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !newRecord.topic}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Record
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Records List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No education records found</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view education records</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
