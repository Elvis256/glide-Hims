import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  User,
  UserPlus,
  PlayCircle,
  ArrowRightCircle,
  Activity,
  Users,
  Timer,
  RefreshCw,
  Stethoscope,
  Bed,
} from 'lucide-react';

interface EmergencyPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  arrivalTime: Date;
  chiefComplaint: string;
  triageLevel: 'red' | 'orange' | 'yellow' | 'green';
  assignedDoctor: string | null;
  bay: string | null;
  status: 'waiting' | 'in-treatment' | 'pending-transfer';
}

const mockPatients: EmergencyPatient[] = [
  { id: 'EM001', name: 'John Doe', age: 45, gender: 'M', arrivalTime: new Date(Date.now() - 15 * 60000), chiefComplaint: 'Chest pain, shortness of breath', triageLevel: 'red', assignedDoctor: 'Dr. Smith', bay: 'Resus 1', status: 'in-treatment' },
  { id: 'EM002', name: 'Mary Jane', age: 32, gender: 'F', arrivalTime: new Date(Date.now() - 25 * 60000), chiefComplaint: 'Severe abdominal pain', triageLevel: 'orange', assignedDoctor: 'Dr. Johnson', bay: 'Bay 3', status: 'in-treatment' },
  { id: 'EM003', name: 'Robert Brown', age: 67, gender: 'M', arrivalTime: new Date(Date.now() - 40 * 60000), chiefComplaint: 'Difficulty breathing, fever', triageLevel: 'orange', assignedDoctor: null, bay: null, status: 'waiting' },
  { id: 'EM004', name: 'Emily Davis', age: 28, gender: 'F', arrivalTime: new Date(Date.now() - 55 * 60000), chiefComplaint: 'Laceration on forearm', triageLevel: 'yellow', assignedDoctor: null, bay: null, status: 'waiting' },
  { id: 'EM005', name: 'Michael Wilson', age: 52, gender: 'M', arrivalTime: new Date(Date.now() - 70 * 60000), chiefComplaint: 'High fever, headache', triageLevel: 'yellow', assignedDoctor: 'Dr. Lee', bay: 'Bay 5', status: 'in-treatment' },
  { id: 'EM006', name: 'Sarah Miller', age: 19, gender: 'F', arrivalTime: new Date(Date.now() - 90 * 60000), chiefComplaint: 'Sprained ankle', triageLevel: 'green', assignedDoctor: null, bay: null, status: 'waiting' },
  { id: 'EM007', name: 'James Taylor', age: 71, gender: 'M', arrivalTime: new Date(Date.now() - 10 * 60000), chiefComplaint: 'Stroke symptoms', triageLevel: 'red', assignedDoctor: 'Dr. Smith', bay: 'Resus 2', status: 'in-treatment' },
  { id: 'EM008', name: 'Linda Anderson', age: 38, gender: 'F', arrivalTime: new Date(Date.now() - 120 * 60000), chiefComplaint: 'Minor burns', triageLevel: 'green', assignedDoctor: null, bay: null, status: 'waiting' },
];

const doctors = ['Dr. Smith', 'Dr. Johnson', 'Dr. Lee', 'Dr. Patel', 'Dr. Chen'];

const triageConfig = {
  red: { label: 'Critical', color: 'bg-red-500', textColor: 'text-red-700', bgLight: 'bg-red-50', border: 'border-red-500' },
  orange: { label: 'Urgent', color: 'bg-orange-500', textColor: 'text-orange-700', bgLight: 'bg-orange-50', border: 'border-orange-500' },
  yellow: { label: 'Standard', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgLight: 'bg-yellow-50', border: 'border-yellow-500' },
  green: { label: 'Minor', color: 'bg-green-500', textColor: 'text-green-700', bgLight: 'bg-green-50', border: 'border-green-500' },
};

function formatElapsedTime(arrivalTime: Date): string {
  const diff = Date.now() - arrivalTime.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function EmergencyQueuePage() {
  const [patients, setPatients] = useState<EmergencyPatient[]>(mockPatients);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const totalInED = patients.length;
    const criticalCount = patients.filter(p => p.triageLevel === 'red').length;
    const waitingPatients = patients.filter(p => p.status === 'waiting');
    const avgWaitMinutes = waitingPatients.length > 0
      ? Math.round(waitingPatients.reduce((sum, p) => sum + (Date.now() - p.arrivalTime.getTime()) / 60000, 0) / waitingPatients.length)
      : 0;
    return { totalInED, criticalCount, avgWaitMinutes, waitingCount: waitingPatients.length };
  }, [patients]);

  const sortedPatients = useMemo(() => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3 };
    return [...patients].sort((a, b) => {
      if (order[a.triageLevel] !== order[b.triageLevel]) {
        return order[a.triageLevel] - order[b.triageLevel];
      }
      return a.arrivalTime.getTime() - b.arrivalTime.getTime();
    });
  }, [patients]);

  const assignDoctor = (patientId: string, doctor: string) => {
    setPatients(prev => prev.map(p => 
      p.id === patientId ? { ...p, assignedDoctor: doctor, bay: `Bay ${Math.floor(Math.random() * 10) + 1}` } : p
    ));
  };

  const startTreatment = (patientId: string) => {
    setPatients(prev => prev.map(p => 
      p.id === patientId ? { ...p, status: 'in-treatment' as const } : p
    ));
  };

  const transferToWard = (patientId: string) => {
    setPatients(prev => prev.filter(p => p.id !== patientId));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Queue</h1>
            <p className="text-sm text-gray-500">Real-time patient management</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalInED}</p>
              <p className="text-sm text-gray-500">Total in ED</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.criticalCount}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.waitingCount}</p>
              <p className="text-sm text-gray-500">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Timer className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgWaitMinutes}m</p>
              <p className="text-sm text-gray-500">Avg Wait Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Triage Legend */}
      <div className="flex gap-4 mb-4">
        {Object.entries(triageConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            <span className="text-sm text-gray-600">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Queue Table */}
      <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chief Complaint</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Wait Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bay</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedPatients.map((patient) => {
                const config = triageConfig[patient.triageLevel];
                return (
                  <tr 
                    key={patient.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedPatient === patient.id ? 'bg-blue-50' : ''} ${config.bgLight}`}
                    onClick={() => setSelectedPatient(patient.id)}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} text-white`}>
                        {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.id} • {patient.age}y {patient.gender}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700 max-w-xs truncate">{patient.chiefComplaint}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Clock className={`w-4 h-4 ${patient.triageLevel === 'red' ? 'text-red-500' : 'text-gray-400'}`} />
                        <span className={`text-sm font-medium ${patient.triageLevel === 'red' ? 'text-red-600' : 'text-gray-700'}`}>
                          {formatElapsedTime(patient.arrivalTime)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {patient.assignedDoctor ? (
                        <div className="flex items-center gap-1">
                          <Stethoscope className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-gray-700">{patient.assignedDoctor}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {patient.bay ? (
                        <div className="flex items-center gap-1">
                          <Bed className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-gray-700">{patient.bay}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        patient.status === 'waiting' ? 'bg-yellow-100 text-yellow-700' :
                        patient.status === 'in-treatment' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {patient.status === 'waiting' ? 'Waiting' : patient.status === 'in-treatment' ? 'In Treatment' : 'Pending Transfer'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!patient.assignedDoctor && (
                          <select
                            className="text-xs border rounded px-2 py-1"
                            onChange={(e) => { e.stopPropagation(); assignDoctor(patient.id, e.target.value); }}
                            onClick={(e) => e.stopPropagation()}
                            defaultValue=""
                          >
                            <option value="" disabled>Assign</option>
                            {doctors.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        )}
                        {patient.assignedDoctor && patient.status === 'waiting' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); startTreatment(patient.id); }}
                            className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200"
                            title="Start Treatment"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        {patient.status === 'in-treatment' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); transferToWard(patient.id); }}
                            className="p-1.5 bg-purple-100 text-purple-600 rounded hover:bg-purple-200"
                            title="Transfer to Ward"
                          >
                            <ArrowRightCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
