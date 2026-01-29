import { useState, useMemo } from 'react';
import {
  LogOut,
  Search,
  User,
  Bed,
  Calendar,
  Clock,
  FileText,
  Pill,
  Stethoscope,
  CheckCircle,
  AlertCircle,
  DollarSign,
  ClipboardList,
  BookOpen,
  Printer,
  Download,
  Edit,
  CheckSquare,
  Square,
  CalendarCheck,
  Receipt,
  Award,
} from 'lucide-react';

type DischargeStatus = 'Pending Planning' | 'In Progress' | 'Awaiting Clearance' | 'Ready' | 'Discharged';

interface DischargeMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  dispensed: boolean;
}

interface FollowUp {
  id: string;
  specialty: string;
  doctor: string;
  date: string;
  time: string;
  notes: string;
  scheduled: boolean;
}

interface DischargeChecklist {
  item: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  admissionDate: string;
  attendingDoctor: string;
  diagnosis: string;
  dischargeStatus: DischargeStatus;
  totalBill: number;
  paid: number;
  insuranceCover: number;
  medications: DischargeMedication[];
  followUps: FollowUp[];
  checklist: DischargeChecklist[];
  dischargeSummary?: string;
  patientEducation: string[];
}

const mockPatients: Patient[] = [];

export default function DischargePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'medications' | 'followup' | 'education'>('summary');
  const [statusFilter, setStatusFilter] = useState<'All' | DischargeStatus>('All');

  const filteredPatients = useMemo(() => {
    return mockPatients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bed.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || p.dischargeStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      pending: mockPatients.filter((p) => p.dischargeStatus === 'Pending Planning').length,
      inProgress: mockPatients.filter((p) => p.dischargeStatus === 'In Progress').length,
      awaiting: mockPatients.filter((p) => p.dischargeStatus === 'Awaiting Clearance').length,
      ready: mockPatients.filter((p) => p.dischargeStatus === 'Ready').length,
    };
  }, []);

  const getStatusBadge = (status: DischargeStatus) => {
    const colors: Record<DischargeStatus, string> = {
      'Pending Planning': 'bg-gray-100 text-gray-700',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Awaiting Clearance': 'bg-yellow-100 text-yellow-700',
      Ready: 'bg-green-100 text-green-700',
      Discharged: 'bg-purple-100 text-purple-700',
    };
    return colors[status];
  };

  const checklistProgress = (checklist: DischargeChecklist[]) => {
    const completed = checklist.filter((c) => c.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <LogOut className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discharge Management</h1>
            <p className="text-sm text-gray-500">Plan and process patient discharges</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending Planning</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.awaiting}</p>
              <p className="text-sm text-gray-500">Awaiting Clearance</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.ready}</p>
              <p className="text-sm text-gray-500">Ready to Discharge</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['All', 'Pending Planning', 'In Progress', 'Awaiting Clearance', 'Ready'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {filteredPatients.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <LogOut className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium">No patients found</p>
                <p className="text-sm">Discharge records will appear here</p>
              </div>
            ) : (
            <div className="space-y-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedPatient?.id === patient.id
                      ? 'border-cyan-500 bg-cyan-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{patient.name}</p>
                      <p className="text-sm text-gray-500">{patient.age}y, {patient.gender}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(patient.dischargeStatus)}`}>
                      {patient.dischargeStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <Bed className="w-4 h-4" />
                    <span>{patient.bed} • {patient.ward}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Checklist:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-cyan-500 h-2 rounded-full"
                          style={{ width: `${checklistProgress(patient.checklist)}%` }}
                        />
                      </div>
                      <span className="font-medium text-cyan-600">{checklistProgress(patient.checklist)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Discharge Details */}
        {selectedPatient ? (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Patient Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedPatient.name}</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedPatient.dischargeStatus)}`}>
                      {selectedPatient.dischargeStatus}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {selectedPatient.age}y, {selectedPatient.gender} • {selectedPatient.bed} • Dr. {selectedPatient.attendingDoctor.split(' ')[1]}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Admitted</p>
                  <p className="font-medium">{selectedPatient.admissionDate}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-4 border-b border-gray-200">
              {[
                { key: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
                { key: 'medications', label: 'Medications', icon: <Pill className="w-4 h-4" /> },
                { key: 'followup', label: 'Follow-up', icon: <CalendarCheck className="w-4 h-4" /> },
                { key: 'education', label: 'Patient Education', icon: <BookOpen className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto">
              <div className="flex h-full">
                {/* Main Content Area */}
                <div className="flex-1 p-6 overflow-auto">
                  {activeTab === 'summary' && (
                    <div className="space-y-6">
                      {/* Diagnosis */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Diagnosis</h3>
                        <p className="text-gray-700">{selectedPatient.diagnosis}</p>
                      </div>

                      {/* Discharge Summary */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-gray-900">Discharge Summary</h3>
                          <button className="text-cyan-600 hover:text-cyan-700 text-sm flex items-center gap-1">
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                        </div>
                        {selectedPatient.dischargeSummary ? (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-gray-700 whitespace-pre-line">{selectedPatient.dischargeSummary}</p>
                          </div>
                        ) : (
                          <div className="p-4 bg-gray-50 rounded-lg text-center">
                            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No discharge summary yet</p>
                            <button className="mt-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm">
                              Create Summary
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Billing Summary */}
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Billing Summary</h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-500">Total Bill</p>
                            <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedPatient.totalBill)}</p>
                          </div>
                          <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-500">Paid + Insurance</p>
                            <p className="text-xl font-bold text-green-600">
                              {formatCurrency(selectedPatient.paid + selectedPatient.insuranceCover)}
                            </p>
                          </div>
                          <div className={`p-4 rounded-lg ${selectedPatient.totalBill - selectedPatient.paid - selectedPatient.insuranceCover > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-sm text-gray-500">Balance</p>
                            <p className={`text-xl font-bold ${selectedPatient.totalBill - selectedPatient.paid - selectedPatient.insuranceCover > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {formatCurrency(selectedPatient.totalBill - selectedPatient.paid - selectedPatient.insuranceCover)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'medications' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Discharge Medications</h3>
                        <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm">
                          <Pill className="w-4 h-4 inline mr-2" />
                          Add Medication
                        </button>
                      </div>
                      {selectedPatient.medications.length > 0 ? (
                        <div className="space-y-3">
                          {selectedPatient.medications.map((med) => (
                            <div key={med.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${med.dispensed ? 'bg-green-100' : 'bg-yellow-100'}`}>
                                    <Pill className={`w-5 h-5 ${med.dispensed ? 'text-green-600' : 'text-yellow-600'}`} />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{med.name}</p>
                                    <p className="text-sm text-gray-500">{med.dosage} • {med.frequency} • {med.duration}</p>
                                  </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${med.dispensed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {med.dispensed ? 'Dispensed' : 'Pending'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-2">
                                <span className="font-medium">Instructions:</span> {med.instructions}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p>No discharge medications prescribed</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'followup' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Follow-up Appointments</h3>
                        <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm">
                          <CalendarCheck className="w-4 h-4 inline mr-2" />
                          Schedule Appointment
                        </button>
                      </div>
                      {selectedPatient.followUps.length > 0 ? (
                        <div className="space-y-3">
                          {selectedPatient.followUps.map((fu) => (
                            <div key={fu.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-cyan-100 rounded-lg">
                                    <Stethoscope className="w-5 h-5 text-cyan-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{fu.specialty}</p>
                                    <p className="text-sm text-gray-500">{fu.doctor}</p>
                                  </div>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${fu.scheduled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {fu.scheduled ? 'Scheduled' : 'Pending'}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {fu.date}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {fu.time}
                                </span>
                              </div>
                              {fu.notes && (
                                <p className="text-sm text-gray-600 mt-2">
                                  <span className="font-medium">Notes:</span> {fu.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p>No follow-up appointments scheduled</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'education' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">Patient Education</h3>
                        <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm">
                          <BookOpen className="w-4 h-4 inline mr-2" />
                          Add Instructions
                        </button>
                      </div>
                      {selectedPatient.patientEducation.length > 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <ul className="space-y-3">
                            {selectedPatient.patientEducation.map((item, index) => (
                              <li key={index} className="flex items-start gap-3">
                                <span className="w-6 h-6 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-gray-700">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <p>No patient education provided yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Checklist Sidebar */}
                <div className="w-80 border-l border-gray-200 p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Discharge Checklist</h3>
                    <span className="text-sm font-medium text-cyan-600">{checklistProgress(selectedPatient.checklist)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className="bg-cyan-500 h-2 rounded-full"
                      style={{ width: `${checklistProgress(selectedPatient.checklist)}%` }}
                    />
                  </div>
                  <div className="space-y-3">
                    {selectedPatient.checklist.map((item, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <button className="flex-shrink-0 mt-0.5">
                          {item.completed ? (
                            <CheckSquare className="w-5 h-5 text-green-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 hover:text-cyan-600 transition-colors" />
                          )}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {item.item}
                          </p>
                          {item.completed && item.completedBy && (
                            <p className="text-xs text-gray-400">
                              {item.completedBy} • {item.completedAt}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print Summary
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Download
                  </button>
                </div>
                <div className="flex gap-2">
                  {selectedPatient.dischargeStatus !== 'Ready' && (
                    <button className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium">
                      <Receipt className="w-4 h-4 inline mr-2" />
                      Finance Clearance
                    </button>
                  )}
                  {checklistProgress(selectedPatient.checklist) === 100 && (
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                      <Award className="w-4 h-4 inline mr-2" />
                      Issue Discharge Certificate
                    </button>
                  )}
                  {selectedPatient.dischargeStatus === 'Ready' && (
                    <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium">
                      <LogOut className="w-4 h-4 inline mr-2" />
                      Complete Discharge
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <LogOut className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to manage discharge</p>
          </div>
        )}
      </div>
    </div>
  );
}
