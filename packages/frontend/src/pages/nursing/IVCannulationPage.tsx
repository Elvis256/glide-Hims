import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Syringe,
  Search,
  UserCircle,
  Save,
  CheckCircle,
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

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
  { id: '4', mrn: 'MRN-2024-0004', name: 'Peter Ochieng', age: 45, gender: 'Male', ward: 'ICU', bed: 'ICU-2' },
  { id: '5', mrn: 'MRN-2024-0005', name: 'Mary Achieng', age: 52, gender: 'Female', ward: 'Ward C', bed: 'C-08' },
];

const cannulaGauges = [
  { value: '14G', label: '14G (Orange) - Large bore, trauma/surgery', color: 'bg-orange-500' },
  { value: '16G', label: '16G (Grey) - Large volume infusions', color: 'bg-gray-500' },
  { value: '18G', label: '18G (Green) - Blood transfusion, surgery', color: 'bg-green-500' },
  { value: '20G', label: '20G (Pink) - Standard IV therapy', color: 'bg-pink-400' },
  { value: '22G', label: '22G (Blue) - Pediatric, fragile veins', color: 'bg-blue-500' },
  { value: '24G', label: '24G (Yellow) - Neonatal, small veins', color: 'bg-yellow-400' },
];

const insertionSites = [
  'Right Hand - Dorsal',
  'Left Hand - Dorsal',
  'Right Forearm - Cephalic Vein',
  'Left Forearm - Cephalic Vein',
  'Right Forearm - Basilic Vein',
  'Left Forearm - Basilic Vein',
  'Right Antecubital Fossa',
  'Left Antecubital Fossa',
  'Right Wrist',
  'Left Wrist',
  'Right Foot - Dorsal',
  'Left Foot - Dorsal',
];

const securingMethods = [
  'Transparent dressing (Tegaderm)',
  'Gauze and tape',
  'IV securement device',
  'Arm board',
  'Splint with dressing',
];

const complications = [
  'None',
  'Infiltration',
  'Phlebitis',
  'Hematoma',
  'Extravasation',
  'Air embolism',
  'Infection',
  'Nerve injury',
  'Arterial puncture',
];

export default function IVCannulationPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    cannulaGauge: '',
    insertionSite: '',
    insertionDate: new Date().toISOString().split('T')[0],
    insertionTime: new Date().toTimeString().slice(0, 5),
    attempts: '1',
    flushVerified: false,
    complications: 'None',
    securingMethod: '',
    insertedBy: '',
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

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setFormData({
      cannulaGauge: '',
      insertionSite: '',
      insertionDate: new Date().toISOString().split('T')[0],
      insertionTime: new Date().toTimeString().slice(0, 5),
      attempts: '1',
      flushVerified: false,
      complications: 'None',
      securingMethod: '',
      insertedBy: '',
      notes: '',
    });
    setSaved(false);
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">IV Cannulation Documented</h2>
          <p className="text-gray-600 mb-6">
            IV cannulation for {selectedPatient?.name} has been recorded
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Record Another
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
          <Syringe className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">IV Cannulation</h1>
            <p className="text-sm text-gray-500">Document IV cannula insertion</p>
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
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient to document IV cannulation</p>
            )}
          </div>
        </div>

        {/* Cannulation Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="font-semibold text-gray-900 mb-3">IV Cannulation Details</h2>
          
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cannula Gauge */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Cannula Size (Gauge) *</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {cannulaGauges.map((gauge) => (
                      <button
                        key={gauge.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, cannulaGauge: gauge.value })}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors text-left ${
                          formData.cannulaGauge === gauge.value
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${gauge.color}`} />
                        <div>
                          <span className="text-sm font-medium">{gauge.value}</span>
                          <p className="text-xs text-gray-500">{gauge.label.split(' - ')[1]}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Insertion Site */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Insertion Site *</label>
                  <select
                    value={formData.insertionSite}
                    onChange={(e) => setFormData({ ...formData, insertionSite: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select site...</option>
                    {insertionSites.map((site) => (
                      <option key={site} value={site}>{site}</option>
                    ))}
                  </select>
                </div>

                {/* Date/Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Date</label>
                    <input
                      type="date"
                      value={formData.insertionDate}
                      onChange={(e) => setFormData({ ...formData, insertionDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={formData.insertionTime}
                      onChange={(e) => setFormData({ ...formData, insertionTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Number of Attempts */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Number of Attempts</label>
                  <div className="flex gap-2">
                    {['1', '2', '3', '4', '5+'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setFormData({ ...formData, attempts: num })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          formData.attempts === num
                            ? num === '1' || num === '2'
                              ? 'bg-green-500 text-white'
                              : num === '3'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flush Verified */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Flush Verification</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, flushVerified: true })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                        formData.flushVerified
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Flushes Well
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, flushVerified: false })}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
                        !formData.flushVerified
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Issue
                    </button>
                  </div>
                </div>

                {/* Securing Method */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Securing Method</label>
                  <select
                    value={formData.securingMethod}
                    onChange={(e) => setFormData({ ...formData, securingMethod: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select method...</option>
                    {securingMethods.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
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

                {/* Inserted By */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Inserted By</label>
                  <input
                    type="text"
                    value={formData.insertedBy}
                    onChange={(e) => setFormData({ ...formData, insertedBy: e.target.value })}
                    placeholder="Enter name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional observations or instructions..."
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
                  disabled={saving || !formData.cannulaGauge || !formData.insertionSite}
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
                      Save Documentation
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to document IV cannulation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
