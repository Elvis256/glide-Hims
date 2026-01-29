import { useState, useMemo } from 'react';
import {
  Baby,
  Heart,
  User,
  Clock,
  Calendar,
  Activity,
  AlertCircle,
  Plus,
  Search,
  FileText,
  Stethoscope,
  Thermometer,
  Droplets,
  TrendingUp,
  CheckCircle,
  Edit,
  Eye,
  UserPlus,
  ClipboardList,
} from 'lucide-react';

type LabourStage = 'First Stage - Latent' | 'First Stage - Active' | 'Second Stage' | 'Third Stage' | 'Delivered' | 'Post-Partum';

interface PartographEntry {
  time: string;
  cervicalDilation: number;
  fetalHeartRate: number;
  contractions: { count: number; duration: number };
  descentLevel: number;
  bloodPressure: string;
  pulse: number;
  temperature: number;
}

interface NewbornInfo {
  id: string;
  gender: 'Male' | 'Female';
  birthWeight: number;
  birthTime: string;
  apgarScore1: number;
  apgarScore5: number;
  status: 'Healthy' | 'Under Observation' | 'NICU';
}

interface Mother {
  id: string;
  name: string;
  age: number;
  gravida: number;
  para: number;
  gestationalAge: number;
  admissionDate: string;
  admissionTime: string;
  bed: string;
  attendingDoctor: string;
  midwife: string;
  labourStage: LabourStage;
  riskLevel: 'Low' | 'Medium' | 'High';
  bloodGroup: string;
  partograph: PartographEntry[];
  deliveryType?: 'Normal Vaginal' | 'Assisted' | 'C-Section';
  deliveryTime?: string;
  newborns: NewbornInfo[];
  notes: string[];
}

const mockMothers: Mother[] = [];

export default function MaternityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'delivered' | 'newborns'>('current');
  const [selectedMother, setSelectedMother] = useState<Mother | null>(null);

  const filteredMothers = useMemo(() => {
    const filtered = mockMothers.filter((m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.bed.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (activeTab === 'current') {
      return filtered.filter((m) => !m.labourStage.includes('Delivered') && m.labourStage !== 'Post-Partum');
    } else if (activeTab === 'delivered') {
      return filtered.filter((m) => m.labourStage === 'Delivered' || m.labourStage === 'Post-Partum');
    }
    return filtered;
  }, [searchTerm, activeTab]);

  const allNewborns = useMemo(() => {
    return mockMothers.flatMap((m) =>
      m.newborns.map((nb) => ({ ...nb, motherName: m.name, motherId: m.id }))
    );
  }, []);

  const stats = useMemo(() => {
    const inLabour = mockMothers.filter((m) => m.labourStage.includes('Stage')).length;
    const delivered = mockMothers.filter((m) => m.labourStage === 'Delivered' || m.labourStage === 'Post-Partum').length;
    const highRisk = mockMothers.filter((m) => m.riskLevel === 'High').length;
    const totalNewborns = mockMothers.reduce((sum, m) => sum + m.newborns.length, 0);
    return { inLabour, delivered, highRisk, totalNewborns };
  }, []);

  const getStageColor = (stage: LabourStage) => {
    if (stage.includes('Latent')) return 'bg-blue-100 text-blue-700';
    if (stage.includes('Active')) return 'bg-yellow-100 text-yellow-700';
    if (stage === 'Second Stage') return 'bg-orange-100 text-orange-700';
    if (stage === 'Third Stage') return 'bg-purple-100 text-purple-700';
    if (stage === 'Delivered') return 'bg-green-100 text-green-700';
    if (stage === 'Post-Partum') return 'bg-pink-100 text-pink-700';
    return 'bg-gray-100 text-gray-700';
  };

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      Low: 'bg-green-100 text-green-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      High: 'bg-red-100 text-red-700',
    };
    return colors[risk];
  };

  const getNewbornStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Healthy: 'bg-green-100 text-green-700',
      'Under Observation': 'bg-yellow-100 text-yellow-700',
      NICU: 'bg-red-100 text-red-700',
    };
    return colors[status];
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Baby className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maternity Ward</h1>
            <p className="text-sm text-gray-500">Labour, delivery, and newborn care</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium">
          <Plus className="w-4 h-4 inline mr-2" />
          New Admission
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Activity className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.inLabour}</p>
              <p className="text-sm text-gray-500">In Labour</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
              <p className="text-sm text-gray-500">Delivered Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
              <p className="text-sm text-gray-500">High Risk</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 rounded-lg">
              <Baby className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{stats.totalNewborns}</p>
              <p className="text-sm text-gray-500">Newborns</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'current' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          In Labour
        </button>
        <button
          onClick={() => setActiveTab('delivered')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'delivered' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Delivered
        </button>
        <button
          onClick={() => setActiveTab('newborns')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'newborns' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Baby className="w-4 h-4 inline mr-2" />
          Newborns
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {activeTab !== 'newborns' ? (
          <>
            {/* Patient List */}
            <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search mothers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {filteredMothers.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Baby className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="font-medium">No patients found</p>
                    <p className="text-sm">Maternity records will appear here</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {filteredMothers.map((mother) => (
                    <div
                      key={mother.id}
                      onClick={() => setSelectedMother(mother)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedMother?.id === mother.id
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{mother.name}</p>
                          <p className="text-sm text-gray-500">{mother.age}y • G{mother.gravida}P{mother.para}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor(mother.riskLevel)}`}>
                          {mother.riskLevel} Risk
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStageColor(mother.labourStage)}`}>
                          {mother.labourStage}
                        </span>
                        <span className="text-xs text-gray-500">• {mother.bed}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{mother.gestationalAge} weeks</span>
                        {mother.deliveryTime && (
                          <>
                            <span>•</span>
                            <span>Delivered: {mother.deliveryTime.split(' ')[1]}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>

            {/* Mother Details */}
            {selectedMother ? (
              <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-gray-900">{selectedMother.name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStageColor(selectedMother.labourStage)}`}>
                          {selectedMother.labourStage}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor(selectedMother.riskLevel)}`}>
                          {selectedMother.riskLevel} Risk
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {selectedMother.age}y • G{selectedMother.gravida}P{selectedMother.para} • {selectedMother.gestationalAge} weeks • {selectedMother.bloodGroup}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium">
                        <Plus className="w-4 h-4 inline mr-2" />
                        Record Partograph
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Care Team */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-rose-600" />
                        Care Team
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Attending Doctor:</span>
                          <span className="font-medium">{selectedMother.attendingDoctor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Midwife:</span>
                          <span className="font-medium">{selectedMother.midwife}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Bed:</span>
                          <span className="font-medium">{selectedMother.bed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Admitted:</span>
                          <span className="font-medium">{selectedMother.admissionDate} {selectedMother.admissionTime}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Info (if delivered) */}
                    {selectedMother.deliveryType && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          Delivery Details
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Type:</span>
                            <span className="font-medium">{selectedMother.deliveryType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Time:</span>
                            <span className="font-medium">{selectedMother.deliveryTime}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Newborns:</span>
                            <span className="font-medium">{selectedMother.newborns.length}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Partograph Summary */}
                    {selectedMother.partograph.length > 0 && (
                      <div className="col-span-2 bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-rose-600" />
                          Labour Progress (Partograph)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-medium text-gray-600">Time</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">Dilation (cm)</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">FHR (bpm)</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">Contractions</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">Descent</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">BP</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">Pulse</th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600">Temp</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedMother.partograph.map((entry, index) => (
                                <tr key={index} className="border-b border-gray-100 hover:bg-gray-100">
                                  <td className="py-2 px-3 font-medium">{entry.time}</td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-medium">
                                      {entry.cervicalDilation}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`${entry.fetalHeartRate >= 110 && entry.fetalHeartRate <= 160 ? 'text-green-600' : 'text-red-600'} font-medium`}>
                                      {entry.fetalHeartRate}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">{entry.contractions.count}/10min ({entry.contractions.duration}s)</td>
                                  <td className="py-2 px-3 text-center">{entry.descentLevel}</td>
                                  <td className="py-2 px-3 text-center">{entry.bloodPressure}</td>
                                  <td className="py-2 px-3 text-center">{entry.pulse}</td>
                                  <td className="py-2 px-3 text-center">{entry.temperature}°C</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Newborns */}
                    {selectedMother.newborns.length > 0 && (
                      <div className="col-span-2 bg-rose-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Baby className="w-5 h-5 text-rose-600" />
                          Newborn(s)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {selectedMother.newborns.map((baby) => (
                            <div key={baby.id} className="bg-white rounded-lg p-4 border border-rose-200">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Baby className={`w-6 h-6 ${baby.gender === 'Male' ? 'text-blue-500' : 'text-pink-500'}`} />
                                  <span className="font-semibold">{baby.gender}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getNewbornStatusColor(baby.status)}`}>
                                  {baby.status}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <p className="text-gray-500">Birth Weight</p>
                                  <p className="font-medium">{baby.birthWeight}g</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Birth Time</p>
                                  <p className="font-medium">{baby.birthTime}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">APGAR (1 min)</p>
                                  <p className="font-medium">{baby.apgarScore1}/10</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">APGAR (5 min)</p>
                                  <p className="font-medium">{baby.apgarScore5}/10</p>
                                </div>
                              </div>
                              <button className="w-full mt-3 px-3 py-1.5 text-sm text-rose-600 border border-rose-300 rounded-lg hover:bg-rose-50 transition-colors">
                                <UserPlus className="w-4 h-4 inline mr-1" />
                                Register Newborn
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedMother.notes.length > 0 && (
                      <div className="col-span-2 bg-gray-50 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-rose-600" />
                          Notes
                        </h3>
                        <ul className="space-y-2">
                          {selectedMother.notes.map((note, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <span className="text-rose-500">•</span>
                              <span className="text-gray-700">{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-2">
                    {!selectedMother.deliveryType && (
                      <>
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Record Delivery
                        </button>
                        <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium">
                          <AlertCircle className="w-4 h-4 inline mr-2" />
                          Emergency C-Section
                        </button>
                      </>
                    )}
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <ClipboardList className="w-4 h-4 inline mr-2" />
                      Post-Natal Care
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Print Records
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
                <Baby className="w-16 h-16 text-gray-300 mb-4" />
                <p className="font-medium text-lg">Select a patient</p>
                <p className="text-sm">Choose a mother from the list to view details</p>
              </div>
            )}
          </>
        ) : (
          /* Newborns Tab */
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search newborns..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-3 gap-4">
                {allNewborns.map((baby) => (
                  <div key={baby.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${baby.gender === 'Male' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                          <Baby className={`w-6 h-6 ${baby.gender === 'Male' ? 'text-blue-600' : 'text-pink-600'}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Baby {baby.gender === 'Male' ? 'Boy' : 'Girl'}</p>
                          <p className="text-sm text-gray-500">ID: {baby.id}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getNewbornStatusColor(baby.status)}`}>
                        {baby.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-gray-500">Mother</p>
                        <p className="font-medium">{baby.motherName}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Birth Weight</p>
                        <p className="font-medium">{baby.birthWeight}g</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Birth Time</p>
                        <p className="font-medium">{baby.birthTime}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">APGAR</p>
                        <p className="font-medium">{baby.apgarScore1}/{baby.apgarScore5}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-1.5 text-sm text-rose-600 border border-rose-300 rounded-lg hover:bg-rose-50 transition-colors">
                        <Eye className="w-4 h-4 inline mr-1" />
                        View
                      </button>
                      <button className="flex-1 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Edit className="w-4 h-4 inline mr-1" />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
