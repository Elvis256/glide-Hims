import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Filter,
  Printer,
  Download,
  Users,
  Stethoscope,
  Pill,
  AlertCircle,
  Clock,
  User,
} from 'lucide-react';

interface KeyEvent {
  id: string;
  time: string;
  type: 'admission' | 'discharge' | 'emergency' | 'procedure' | 'alert';
  description: string;
  patient?: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  shift: string;
}

const keyEvents: KeyEvent[] = [];

const staff: StaffMember[] = [];

const wards = [
  { value: 'all', label: 'All Wards' },
  { value: 'ward-a', label: 'Ward A - General' },
  { value: 'ward-b', label: 'Ward B - Surgical' },
  { value: 'ward-c', label: 'Ward C - Pediatric' },
  { value: 'icu', label: 'ICU' },
  { value: 'maternity', label: 'Maternity' },
];

const eventTypeConfig = {
  admission: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Admission' },
  discharge: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Discharge' },
  emergency: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Emergency' },
  procedure: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Procedure' },
  alert: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Alert' },
};

export default function NursingDailyReportPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedWard, setSelectedWard] = useState('all');

  const summaryStats = {
    patientsCaredFor: 0,
    proceduresPerformed: 0,
    medicationsGiven: 0,
    criticalAlerts: 0,
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    alert('Report exported successfully');
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
            <FileText className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Daily Nursing Report</h1>
              <p className="text-sm text-gray-500">Summary of daily nursing activities</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            >
              {wards.map((ward) => (
                <option key={ward.value} value={ward.value}>{ward.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.patientsCaredFor}</p>
              <p className="text-sm text-gray-500">Patients Cared For</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.proceduresPerformed}</p>
              <p className="text-sm text-gray-500">Procedures Performed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Pill className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.medicationsGiven}</p>
              <p className="text-sm text-gray-500">Medications Given</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.criticalAlerts}</p>
              <p className="text-sm text-gray-500">Critical Alerts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Key Events */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Key Events</h2>
            <span className="text-sm text-gray-500">{keyEvents.length} events</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {keyEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Clock className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">No events recorded</p>
              </div>
            ) : keyEvents.map((event) => {
              const typeConfig = eventTypeConfig[event.type];
              return (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-mono">{event.time}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{event.description}</p>
                      {event.patient && (
                        <p className="text-xs text-gray-500 mt-1">Patient: {event.patient}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Staff on Duty */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Staff on Duty</h2>
            <span className="text-sm text-gray-500">{staff.length} staff</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
            {staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <User className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">No staff assigned</p>
              </div>
            ) : staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className="p-3 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{staffMember.name}</p>
                    <p className="text-xs text-gray-500">{staffMember.role}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    staffMember.shift === 'Day' 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {staffMember.shift}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
