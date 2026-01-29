import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Users,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  AlertTriangle,
  ClipboardList,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

interface PatientMovement {
  id: string;
  name: string;
  mrn: string;
  type: 'admission' | 'discharge' | 'transfer';
  time: string;
  from?: string;
  to?: string;
}

interface CriticalPatient {
  id: string;
  name: string;
  bed: string;
  condition: string;
  priority: 'critical' | 'unstable' | 'monitoring';
}

interface PendingTask {
  id: string;
  patient: string;
  task: string;
  dueTime: string;
  priority: 'high' | 'medium' | 'low';
}

const movements: PatientMovement[] = [];

const criticalPatients: CriticalPatient[] = [];

const pendingTasks: PendingTask[] = [];

const shifts = [
  { value: 'morning', label: 'Morning Shift', icon: Sun, time: '07:00 - 15:00' },
  { value: 'afternoon', label: 'Afternoon Shift', icon: Sunset, time: '15:00 - 23:00' },
  { value: 'night', label: 'Night Shift', icon: Moon, time: '23:00 - 07:00' },
];

const priorityConfig = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Critical' },
  unstable: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Unstable' },
  monitoring: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Monitoring' },
  high: { color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { color: 'bg-green-100 text-green-700 border-green-200' },
};

const movementTypeConfig = {
  admission: { color: 'text-green-600', icon: UserPlus, label: 'Admitted' },
  discharge: { color: 'text-blue-600', icon: UserMinus, label: 'Discharged' },
  transfer: { color: 'text-orange-600', icon: ArrowRightLeft, label: 'Transferred' },
};

export default function ShiftSummaryPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedShift, setSelectedShift] = useState('morning');

  const currentShift = shifts.find((s) => s.value === selectedShift);
  const ShiftIcon = currentShift?.icon || Sun;

  const censusStats = {
    totalPatients: 0,
    admissions: movements.filter((m) => m.type === 'admission').length,
    discharges: movements.filter((m) => m.type === 'discharge').length,
    transfers: movements.filter((m) => m.type === 'transfer').length,
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
            <Clock className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shift Summary Report</h1>
              <p className="text-sm text-gray-500">End-of-shift handover summary</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {shifts.map((shift) => {
              const Icon = shift.icon;
              return (
                <button
                  key={shift.value}
                  onClick={() => setSelectedShift(shift.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    selectedShift === shift.value
                      ? 'bg-white text-teal-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {shift.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Shift Info Banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <ShiftIcon className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-teal-900">{currentShift?.label}</p>
              <p className="text-sm text-teal-700">{currentShift?.time}</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-2xl font-bold text-teal-900">{censusStats.totalPatients}</p>
              <p className="text-xs text-teal-700">Total Census</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">+{censusStats.admissions}</p>
              <p className="text-xs text-gray-600">Admissions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">-{censusStats.discharges}</p>
              <p className="text-xs text-gray-600">Discharges</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{censusStats.transfers}</p>
              <p className="text-xs text-gray-600">Transfers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient Movements */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Admissions/Discharges/Transfers</h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {movements.length > 0 ? (
              movements.map((movement) => {
                const config = movementTypeConfig[movement.type];
                const Icon = config.icon;
                return (
                  <div
                    key={movement.id}
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 ${config.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 text-sm">{movement.name}</p>
                          <span className="text-xs text-gray-500">{movement.time}</span>
                        </div>
                        <p className="text-xs text-gray-500">{movement.mrn}</p>
                        <p className={`text-xs font-medium mt-1 ${config.color}`}>
                          {config.label}
                          {movement.to && ` to ${movement.to}`}
                          {movement.from && movement.type === 'transfer' && ` from ${movement.from}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No patient movements this shift</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Critical Patients */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold text-gray-900">Critical Patients</h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {criticalPatients.length > 0 ? (
              criticalPatients.map((patient) => {
                const config = priorityConfig[patient.priority];
                return (
                  <div
                    key={patient.id}
                    className={`p-3 rounded-lg border ${config.color}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-600">Bed: {patient.bed}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{patient.condition}</p>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No critical patients this shift</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Pending Tasks for Next Shift</h2>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {pendingTasks.length > 0 ? (
              pendingTasks.map((task) => {
                const config = priorityConfig[task.priority];
                return (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-medium text-gray-900 text-sm">{task.task}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${config.color}`}>
                        {task.dueTime}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Patient: {task.patient}</p>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No pending tasks</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
