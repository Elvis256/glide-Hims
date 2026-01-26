import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  UserCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  User,
  Bed,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  diagnosis: string;
  priority: 'high' | 'medium' | 'low';
}

interface SBARData {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

const mockPatients: Patient[] = [
  { 
    id: '1', 
    mrn: 'MRN-2024-0001', 
    name: 'Sarah Nakimera', 
    age: 39, 
    gender: 'Female', 
    ward: 'Ward A', 
    bed: 'A-12',
    diagnosis: 'Post-op Day 2 - Appendectomy',
    priority: 'medium',
  },
  { 
    id: '2', 
    mrn: 'MRN-2024-0002', 
    name: 'James Okello', 
    age: 34, 
    gender: 'Male', 
    ward: 'Ward A', 
    bed: 'A-15',
    diagnosis: 'Pneumonia',
    priority: 'high',
  },
  { 
    id: '3', 
    mrn: 'MRN-2024-0003', 
    name: 'Grace Namukasa', 
    age: 28, 
    gender: 'Female',
    ward: 'Ward A',
    bed: 'A-08',
    diagnosis: 'DVT - Left leg',
    priority: 'medium',
  },
  { 
    id: '4', 
    mrn: 'MRN-2024-0004', 
    name: 'Peter Mugisha', 
    age: 55, 
    gender: 'Male',
    ward: 'Ward A',
    bed: 'A-03',
    diagnosis: 'CHF Exacerbation',
    priority: 'high',
  },
];

const mockSBARData: Record<string, SBARData> = {
  '1': {
    situation: 'Post-op day 2 following appendectomy. Patient stable, tolerating oral intake.',
    background: 'Emergency appendectomy on 01/13. No known allergies. History of mild asthma.',
    assessment: 'Vital signs stable. Pain 3/10 controlled with oral analgesics. Incision clean and dry. Bowel sounds present.',
    recommendation: 'Continue current management. Anticipate discharge tomorrow if tolerating regular diet.',
  },
  '2': {
    situation: 'Admitted for community-acquired pneumonia. Currently on IV antibiotics day 3.',
    background: 'Smoker 20 pack-years. No previous hospitalizations. Allergic to Penicillin.',
    assessment: 'Temp 37.8°C, improving. SpO2 94% on 2L NC. Crackles in right lower lobe. WBC trending down.',
    recommendation: 'Continue IV antibiotics. Monitor oxygen requirements. Consider stepping down to oral antibiotics tomorrow.',
  },
  '3': {
    situation: 'Admitted with left leg DVT. On therapeutic anticoagulation.',
    background: 'On oral contraceptives. No previous clotting history. Family history negative.',
    assessment: 'Left leg edema improving. INR 2.3 therapeutic. No signs of PE. Ambulatory with compression stockings.',
    recommendation: 'Continue warfarin. Teach home INR monitoring. Plan discharge with outpatient follow-up.',
  },
  '4': {
    situation: 'CHF exacerbation with volume overload. Admitted 2 days ago.',
    background: 'Known CHF EF 35%. DM Type 2. Previous admission 3 months ago. Non-compliant with diet.',
    assessment: 'Weight down 3kg with diuresis. Still has mild ankle edema. Crackles at bases. BNP improving.',
    recommendation: 'Continue IV diuretics. Cardiology to see today. Dietician consult for sodium education.',
  },
};

const priorityConfig = {
  high: { label: 'High', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
};

export default function ShiftHandoverPage() {
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [handoverAccepted, setHandoverAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [editedSBAR, setEditedSBAR] = useState<SBARData | null>(null);

  const sbarData = selectedPatient 
    ? (editedSBAR || mockSBARData[selectedPatient.id] || { situation: '', background: '', assessment: '', recommendation: '' })
    : null;

  const handleAcceptHandover = () => {
    setAccepting(true);
    setTimeout(() => {
      setAccepting(false);
      setHandoverAccepted(true);
    }, 1000);
  };

  const handleReset = () => {
    setHandoverAccepted(false);
    setSelectedPatient(null);
    setEditedSBAR(null);
  };

  if (handoverAccepted) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Handover Accepted</h2>
          <p className="text-gray-600 mb-6">
            You have accepted responsibility for {mockPatients.length} patients in Ward A
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              View Another Handover
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <RefreshCw className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shift Handover</h1>
              <p className="text-sm text-gray-500">SBAR format patient handover</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Day Shift → Night Shift</span>
          <span className="text-gray-400">|</span>
          <User className="w-4 h-4" />
          <span>From: Nurse Mary Nakato</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient List */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Ward A Patients</h2>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-sm font-medium">
              {mockPatients.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {mockPatients.map((patient) => {
              const priority = priorityConfig[patient.priority];
              return (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setEditedSBAR(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPatient?.id === patient.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <UserCircle className="w-10 h-10 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{patient.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priority.color}`}>
                          {priority.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Bed className="w-3 h-3" />
                        <span>{patient.bed}</span>
                        <span>•</span>
                        <span>{patient.age}y {patient.gender[0]}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 truncate">{patient.diagnosis}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Accept Handover Button */}
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={handleAcceptHandover}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Accept Handover
                </>
              )}
            </button>
          </div>
        </div>

        {/* SBAR Display */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient && sbarData ? (
            <div className="flex-1 overflow-y-auto">
              {/* Patient Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <h2 className="font-semibold text-gray-900 text-lg">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPatient.mrn} • {selectedPatient.bed}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{selectedPatient.diagnosis}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border mt-1 ${priorityConfig[selectedPatient.priority].color}`}>
                    {priorityConfig[selectedPatient.priority].label} Priority
                  </span>
                </div>
              </div>

              {/* SBAR Sections */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">S</div>
                    <h3 className="font-semibold text-blue-900">Situation</h3>
                  </div>
                  <textarea
                    value={sbarData.situation}
                    onChange={(e) => setEditedSBAR({ ...sbarData, situation: e.target.value })}
                    className="w-full p-2 bg-white border border-blue-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">B</div>
                    <h3 className="font-semibold text-green-900">Background</h3>
                  </div>
                  <textarea
                    value={sbarData.background}
                    onChange={(e) => setEditedSBAR({ ...sbarData, background: e.target.value })}
                    className="w-full p-2 bg-white border border-green-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold text-sm">A</div>
                    <h3 className="font-semibold text-yellow-900">Assessment</h3>
                  </div>
                  <textarea
                    value={sbarData.assessment}
                    onChange={(e) => setEditedSBAR({ ...sbarData, assessment: e.target.value })}
                    className="w-full p-2 bg-white border border-yellow-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">R</div>
                    <h3 className="font-semibold text-purple-900">Recommendation</h3>
                  </div>
                  <textarea
                    value={sbarData.recommendation}
                    onChange={(e) => setEditedSBAR({ ...sbarData, recommendation: e.target.value })}
                    className="w-full p-2 bg-white border border-purple-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Alerts/Notes */}
              {selectedPatient.priority === 'high' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">High Priority Patient</p>
                    <p className="text-sm text-red-700">Requires close monitoring. Notify charge nurse of any changes.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view handover details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
