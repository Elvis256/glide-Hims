import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  TestTube,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Tag,
  Thermometer,
  Clock,
} from 'lucide-react';
import { patientsService, type Patient as ApiPatient } from '../../services/patients';
import { labService, type CollectSampleDto } from '../../services/lab';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

const specimenTypes = [
  { value: 'blood', label: 'Blood', icon: '🩸' },
  { value: 'urine', label: 'Urine', icon: '🧪' },
  { value: 'stool', label: 'Stool', icon: '💩' },
  { value: 'sputum', label: 'Sputum', icon: '🫁' },
  { value: 'wound-swab', label: 'Wound Swab', icon: '🩹' },
  { value: 'throat-swab', label: 'Throat Swab', icon: '👅' },
  { value: 'nasal-swab', label: 'Nasal Swab', icon: '👃' },
  { value: 'csf', label: 'CSF', icon: '🧠' },
  { value: 'pleural-fluid', label: 'Pleural Fluid', icon: '🫁' },
  { value: 'ascitic-fluid', label: 'Ascitic Fluid', icon: '💧' },
  { value: 'tissue', label: 'Tissue/Biopsy', icon: '🔬' },
  { value: 'other', label: 'Other', icon: '📋' },
];

const bloodCollectionSites = [
  'Right Antecubital',
  'Left Antecubital',
  'Right Hand',
  'Left Hand',
  'Right Wrist',
  'Left Wrist',
  'Arterial Line',
  'Central Line',
  'Finger Prick',
  'Heel Prick (Pediatric)',
];

const urineCollectionMethods = [
  'Clean Catch Midstream',
  'Catheter Specimen',
  'Suprapubic Aspiration',
  '24-Hour Collection',
  'Random Sample',
];

const testsOrdered = [
  { category: 'Hematology', tests: ['CBC', 'ESR', 'Coagulation Panel', 'Blood Smear', 'Reticulocyte Count'] },
  { category: 'Chemistry', tests: ['BMP', 'CMP', 'LFTs', 'Lipid Panel', 'Cardiac Enzymes', 'HbA1c'] },
  { category: 'Microbiology', tests: ['Culture & Sensitivity', 'Gram Stain', 'AFB', 'Blood Culture', 'Urine Culture'] },
  { category: 'Serology', tests: ['HIV', 'Hepatitis Panel', 'RPR/VDRL', 'Malaria RDT', 'COVID-19'] },
  { category: 'Urinalysis', tests: ['Routine Urinalysis', 'Urine Microscopy', 'Protein/Creatinine Ratio'] },
  { category: 'Other', tests: ['Stool Ova & Parasites', 'Stool Culture', 'CSF Analysis', 'Cytology'] },
];

const transportRequirements = [
  { value: 'room-temp', label: 'Room Temperature', icon: Thermometer, color: 'text-gray-600' },
  { value: 'refrigerated', label: 'Refrigerated (2-8°C)', icon: Thermometer, color: 'text-blue-600' },
  { value: 'ice', label: 'On Ice', icon: Thermometer, color: 'text-cyan-600' },
  { value: 'immediate', label: 'Immediate Transport', icon: Clock, color: 'text-red-600' },
  { value: 'protected', label: 'Light Protected', icon: Tag, color: 'text-purple-600' },
];

// Helper to convert API patient to local Patient format
const mapPatient = (p: ApiPatient): Patient => ({
  id: p.id,
  mrn: p.mrn,
  name: p.fullName,
  age: Math.floor((new Date().getTime() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)),
  gender: p.gender,
});

export default function SpecimenCollectionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saved, setSaved] = useState(false);

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  });

  // Search patients via API
  const { data: patientsData, isLoading: searchLoading } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () => patientsService.search({ search: debouncedSearch, limit: 20 }),
    enabled: debouncedSearch.length >= 2,
  });

  const patients: Patient[] = useMemo(() => {
    return patientsData?.data?.map(mapPatient) || [];
  }, [patientsData]);

  // Mutation for collecting specimen
  const collectMutation = useMutation({
    mutationFn: (data: CollectSampleDto) => labService.samples.collect(data),
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['lab', 'samples'] });
    },
  });

  const [formData, setFormData] = useState({
    specimenType: '',
    collectionSite: '',
    collectionMethod: '',
    collectionDate: new Date().toISOString().split('T')[0],
    collectionTime: new Date().toTimeString().slice(0, 5),
    testsOrdered: [] as string[],
    labelsVerified: false,
    patientIdVerified: false,
    transportRequirement: 'room-temp',
    collectedBy: '',
    specimenId: `SP-${Date.now().toString().slice(-8)}`,
    notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    return patients;
  }, [searchTerm, patients]);

  const handleTestToggle = (test: string) => {
    setFormData((prev) => ({
      ...prev,
      testsOrdered: prev.testsOrdered.includes(test)
        ? prev.testsOrdered.filter((t) => t !== test)
        : [...prev.testsOrdered, test],
    }));
  };

  const handleSave = () => {
    if (!selectedPatient) return;
    collectMutation.mutate({
      orderId: formData.specimenId,
      patientId: selectedPatient.id,
      facilityId: 'default',
      labTestId: formData.specimenId,
      sampleType: formData.specimenType as CollectSampleDto['sampleType'],
      priority: 'routine',
      collectionNotes: formData.notes,
    });
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setFormData({
      specimenType: '',
      collectionSite: '',
      collectionMethod: '',
      collectionDate: new Date().toISOString().split('T')[0],
      collectionTime: new Date().toTimeString().slice(0, 5),
      testsOrdered: [],
      labelsVerified: false,
      patientIdVerified: false,
      transportRequirement: 'room-temp',
      collectedBy: '',
      specimenId: `SP-${Date.now().toString().slice(-8)}`,
      notes: '',
    });
    setSaved(false);
  };

  const getCollectionOptions = () => {
    if (formData.specimenType === 'blood') return bloodCollectionSites;
    if (formData.specimenType === 'urine') return urineCollectionMethods;
    return [];
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Specimen Collection Logged</h2>
          <p className="text-gray-600 mb-2">
            Specimen for {selectedPatient?.name} has been recorded
          </p>
          <p className="text-sm text-gray-500 mb-6">Specimen ID: {formData.specimenId}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Collect Another
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <TestTube className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Specimen Collection</h1>
            <p className="text-sm text-gray-500">Log specimen collection details</p>
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
                <p className="text-sm text-gray-500 text-center py-4">Searching...</p>
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
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient to log specimen collection</p>
            )}
          </div>
        </div>

        {/* Specimen Collection Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Collection Details</h2>
            {selectedPatient && (
              <span className="text-sm text-gray-500">ID: {formData.specimenId}</span>
            )}
          </div>
          
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Specimen Type */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Specimen Type *</label>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {specimenTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, specimenType: type.value, collectionSite: '', collectionMethod: '' })}
                        className={`p-2 rounded-lg border transition-colors text-center ${
                          formData.specimenType === type.value
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl block">{type.icon}</span>
                        <span className="text-xs">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collection Site/Method */}
                {getCollectionOptions().length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {formData.specimenType === 'blood' ? 'Collection Site' : 'Collection Method'}
                    </label>
                    <select
                      value={formData.specimenType === 'blood' ? formData.collectionSite : formData.collectionMethod}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        [formData.specimenType === 'blood' ? 'collectionSite' : 'collectionMethod']: e.target.value 
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select...</option>
                      {getCollectionOptions().map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date/Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Collection Date</label>
                    <input
                      type="date"
                      value={formData.collectionDate}
                      onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={formData.collectionTime}
                      onChange={(e) => setFormData({ ...formData, collectionTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Tests Ordered */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Tests Ordered *</label>
                  <div className="space-y-3">
                    {testsOrdered.map((category) => (
                      <div key={category.category}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{category.category}</p>
                        <div className="flex flex-wrap gap-1">
                          {category.tests.map((test) => (
                            <button
                              key={test}
                              type="button"
                              onClick={() => handleTestToggle(test)}
                              className={`px-2 py-1 rounded text-xs transition-colors ${
                                formData.testsOrdered.includes(test)
                                  ? 'bg-teal-500 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {test}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Labels Verification */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Verification Checklist</label>
                  <div className="flex flex-wrap gap-3">
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      formData.patientIdVerified ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formData.patientIdVerified}
                        onChange={(e) => setFormData({ ...formData, patientIdVerified: e.target.checked })}
                        className="rounded text-teal-600"
                      />
                      <span className="text-sm">Patient ID Verified</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      formData.labelsVerified ? 'border-green-500 bg-green-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={formData.labelsVerified}
                        onChange={(e) => setFormData({ ...formData, labelsVerified: e.target.checked })}
                        className="rounded text-teal-600"
                      />
                      <span className="text-sm">Labels Verified & Applied</span>
                    </label>
                  </div>
                </div>

                {/* Transport Requirements */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Transport Requirements</label>
                  <div className="flex flex-wrap gap-2">
                    {transportRequirements.map((req) => {
                      const Icon = req.icon;
                      return (
                        <button
                          key={req.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, transportRequirement: req.value })}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                            formData.transportRequirement === req.value
                              ? 'border-teal-500 bg-teal-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${req.color}`} />
                          <span className="text-sm">{req.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Collected By */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Collected By</label>
                  <input
                    type="text"
                    value={formData.collectedBy}
                    onChange={(e) => setFormData({ ...formData, collectedBy: e.target.value })}
                    placeholder="Enter name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={collectMutation.isPending || !formData.specimenType || formData.testsOrdered.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {collectMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Log Specimen
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to log specimen collection</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}