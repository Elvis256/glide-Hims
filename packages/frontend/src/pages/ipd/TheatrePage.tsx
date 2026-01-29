import { useState, useMemo } from 'react';
import {
  Syringe,
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle,
  AlertCircle,
  FileText,
  ClipboardList,
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Timer,
  Play,
  Pause,
  CheckSquare,
  Square,
  Edit,
  Eye,
} from 'lucide-react';

type SurgeryStatus = 'Scheduled' | 'Pre-Op' | 'In Progress' | 'Post-Op' | 'Completed' | 'Cancelled';

interface Surgery {
  id: string;
  patientName: string;
  patientId: string;
  patientAge: number;
  patientGender: string;
  procedure: string;
  surgeon: string;
  anesthetist: string;
  theatre: string;
  date: string;
  startTime: string;
  estimatedDuration: number;
  status: SurgeryStatus;
  priority: 'Elective' | 'Urgent' | 'Emergency';
  preOpChecklist: { item: string; completed: boolean }[];
  notes?: string;
}

interface Theatre {
  id: string;
  name: string;
  type: string;
  status: 'Available' | 'In Use' | 'Cleaning' | 'Maintenance';
  currentSurgery?: Surgery;
}

const mockTheatres: Theatre[] = [];

const mockSurgeries: Surgery[] = [];

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export default function TheatrePage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'list' | 'booking'>('schedule');
  const [selectedDate, setSelectedDate] = useState('2024-01-15');
  const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SurgeryStatus>('All');

  const todaySurgeries = useMemo(() => {
    return mockSurgeries.filter((s) => s.date === selectedDate);
  }, [selectedDate]);

  const filteredSurgeries = useMemo(() => {
    return mockSurgeries.filter((s) => {
      const matchesSearch =
        s.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.procedure.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.surgeon.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const today = todaySurgeries;
    return {
      total: today.length,
      scheduled: today.filter((s) => s.status === 'Scheduled').length,
      inProgress: today.filter((s) => s.status === 'In Progress').length,
      completed: today.filter((s) => s.status === 'Completed').length,
    };
  }, [todaySurgeries]);

  const theatreUtilization = useMemo(() => {
    if (mockTheatres.length === 0) return 0;
    const inUse = mockTheatres.filter((t) => t.status === 'In Use').length;
    return Math.round((inUse / mockTheatres.length) * 100);
  }, []);

  const getStatusBadge = (status: SurgeryStatus) => {
    const colors: Record<SurgeryStatus, string> = {
      Scheduled: 'bg-blue-100 text-blue-700',
      'Pre-Op': 'bg-yellow-100 text-yellow-700',
      'In Progress': 'bg-green-100 text-green-700',
      'Post-Op': 'bg-purple-100 text-purple-700',
      Completed: 'bg-gray-100 text-gray-700',
      Cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status];
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      Elective: 'bg-blue-100 text-blue-700',
      Urgent: 'bg-orange-100 text-orange-700',
      Emergency: 'bg-red-100 text-red-700',
    };
    return colors[priority];
  };

  const getTheatreStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Available: 'bg-green-500',
      'In Use': 'bg-red-500',
      Cleaning: 'bg-yellow-500',
      Maintenance: 'bg-gray-500',
    };
    return colors[status];
  };

  const checklistProgress = (checklist: { item: string; completed: boolean }[]) => {
    const completed = checklist.filter((c) => c.completed).length;
    return Math.round((completed / checklist.length) * 100);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Syringe className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Theatre Management</h1>
            <p className="text-sm text-gray-500">Schedule and manage surgical procedures</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium">
          <Plus className="w-4 h-4 inline mr-2" />
          Book Surgery
        </button>
      </div>

      {/* Stats & Theatre Status */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        {/* Stats */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Today's Surgeries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.scheduled}</p>
              <p className="text-sm text-gray-500">Scheduled</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.inProgress}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>

        {/* Theatre Utilization */}
        <div className="col-span-2 bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Theatre Utilization</span>
            <span className="text-lg font-bold text-teal-600">{theatreUtilization}%</span>
          </div>
          <div className="flex gap-2 mb-3">
            {mockTheatres.length === 0 ? (
              <div className="flex-1 h-3 rounded bg-gray-200" title="No theatres configured" />
            ) : (
            mockTheatres.map((theatre) => (
              <div
                key={theatre.id}
                className={`flex-1 h-3 rounded ${getTheatreStatusColor(theatre.status)}`}
                title={`${theatre.name}: ${theatre.status}`}
              />
            ))
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              In Use
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Cleaning
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              Maintenance
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'schedule' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'list' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          All Surgeries
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {activeTab === 'schedule' ? (
          <>
            {/* Today's Schedule */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">January 15, 2024</p>
                    <p className="text-sm text-gray-500">Monday</p>
                  </div>
                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                <button className="px-4 py-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                  Today
                </button>
              </div>

              <div className="flex-1 overflow-auto">
                {mockTheatres.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                    <Syringe className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="font-medium text-lg">No theatres configured</p>
                    <p className="text-sm">Theatre schedule will appear here</p>
                  </div>
                ) : (
                <div className="min-w-[800px]">
                  {/* Theatre Headers */}
                  <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
                    <div className="w-20 p-3 border-r border-gray-200 text-sm font-medium text-gray-600">
                      Time
                    </div>
                    {mockTheatres.slice(0, 4).map((theatre) => (
                      <div key={theatre.id} className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                        <p className="font-medium text-gray-900">{theatre.name}</p>
                        <p className="text-xs text-gray-500">{theatre.type}</p>
                      </div>
                    ))}
                  </div>

                  {/* Time Slots */}
                  {timeSlots.map((time) => (
                    <div key={time} className="flex border-b border-gray-100">
                      <div className="w-20 p-3 border-r border-gray-200 text-sm text-gray-600">
                        {time}
                      </div>
                      {mockTheatres.slice(0, 4).map((theatre) => {
                        const surgery = todaySurgeries.find(
                          (s) => s.theatre === theatre.name && s.startTime === time
                        );
                        return (
                          <div
                            key={theatre.id}
                            className="flex-1 p-2 border-r border-gray-200 last:border-r-0 min-h-[60px]"
                          >
                            {surgery && (
                              <div
                                onClick={() => setSelectedSurgery(surgery)}
                                className={`p-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                                  surgery.status === 'In Progress'
                                    ? 'bg-green-100 border-l-4 border-green-500'
                                    : surgery.status === 'Pre-Op'
                                    ? 'bg-yellow-100 border-l-4 border-yellow-500'
                                    : 'bg-blue-100 border-l-4 border-blue-500'
                                }`}
                              >
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {surgery.procedure}
                                </p>
                                <p className="text-xs text-gray-600 truncate">{surgery.patientName}</p>
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                  <Timer className="w-3 h-3" />
                                  {surgery.estimatedDuration} min
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>

            {/* Surgery Details Panel */}
            <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
              {selectedSurgery ? (
                <>
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedSurgery.status)}`}>
                        {selectedSurgery.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(selectedSurgery.priority)}`}>
                        {selectedSurgery.priority}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg text-gray-900">{selectedSurgery.procedure}</h3>
                    <p className="text-sm text-gray-500">{selectedSurgery.theatre}</p>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                    {/* Patient Info */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Patient</h4>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="p-2 bg-white rounded-full border border-gray-200">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedSurgery.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {selectedSurgery.patientAge}y, {selectedSurgery.patientGender} • ID: {selectedSurgery.patientId}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Team */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Surgical Team</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Stethoscope className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">Surgeon:</span>
                          <span className="font-medium">{selectedSurgery.surgeon}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Syringe className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">Anesthetist:</span>
                          <span className="font-medium">{selectedSurgery.anesthetist}</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Schedule</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{selectedSurgery.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span>{selectedSurgery.startTime}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                          <Timer className="w-4 h-4 text-gray-500" />
                          <span>Est. Duration: {selectedSurgery.estimatedDuration} min</span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Op Checklist */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-500">Pre-Op Checklist</h4>
                        <span className="text-sm font-medium text-teal-600">
                          {checklistProgress(selectedSurgery.preOpChecklist)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                        <div
                          className="bg-teal-500 h-2 rounded-full"
                          style={{ width: `${checklistProgress(selectedSurgery.preOpChecklist)}%` }}
                        />
                      </div>
                      <div className="space-y-2 max-h-48 overflow-auto">
                        {selectedSurgery.preOpChecklist.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            {item.completed ? (
                              <CheckSquare className="w-4 h-4 text-green-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                            <span className={item.completed ? 'text-gray-600' : 'text-gray-900'}>
                              {item.item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedSurgery.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Notes</h4>
                        <p className="text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">
                          {selectedSurgery.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      {selectedSurgery.status === 'Scheduled' && (
                        <button className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium">
                          <ClipboardList className="w-4 h-4 inline mr-2" />
                          Start Pre-Op
                        </button>
                      )}
                      {selectedSurgery.status === 'Pre-Op' && (
                        <button className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                          <Play className="w-4 h-4 inline mr-2" />
                          Start Surgery
                        </button>
                      )}
                      {selectedSurgery.status === 'In Progress' && (
                        <button className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Complete
                        </button>
                      )}
                      <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <Syringe className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="font-medium">Select a surgery</p>
                  <p className="text-sm">Click on a scheduled surgery to view details</p>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Surgery List View */
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-4 p-4 border-b border-gray-200">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search surgeries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-500" />
                {(['All', 'Scheduled', 'Pre-Op', 'In Progress', 'Completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {filteredSurgeries.map((surgery) => (
                  <div
                    key={surgery.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <Syringe className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{surgery.procedure}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(surgery.status)}`}>
                              {surgery.status}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(surgery.priority)}`}>
                              {surgery.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Patient: {surgery.patientName} • {surgery.patientAge}y, {surgery.patientGender}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-4 h-4" />
                              {surgery.surgeon}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {surgery.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {surgery.startTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <Timer className="w-4 h-4" />
                              {surgery.estimatedDuration} min
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSurgery(surgery)}
                          className="px-4 py-2 text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors"
                        >
                          <Eye className="w-4 h-4 inline mr-2" />
                          View
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
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
