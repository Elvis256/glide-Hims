import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Users, Award, Calendar, Plus, Loader2, Trash2, Eye } from 'lucide-react';
import { hrService, type TrainingProgram, type CreateTrainingProgramDto, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';

export default function TrainingPage() {
  const [showModal, setShowModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<TrainingProgram | null>(null);
  const [formData, setFormData] = useState<Partial<CreateTrainingProgramDto>>({
    status: 'scheduled',
    isMandatory: false,
    maxParticipants: 20,
    enrolledCount: 0,
    completedCount: 0,
  });
  const [enrolleeIds, setEnrolleeIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Get facility
  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as { data: Employee[] }).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees = employeesData || [];

  // Fetch training programs
  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['training-programs', facilityId],
    queryFn: async () => {
      try {
        return await hrService.training.list({ facilityId });
      } catch { return []; }
    },
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['training-stats', facilityId],
    queryFn: async () => {
      try {
        return await hrService.training.getStats(facilityId!);
      } catch { return { total: 0, active: 0, completed: 0, totalEnrollments: 0, certificatesIssued: 0 }; }
    },
    enabled: !!facilityId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTrainingProgramDto) => {
      return hrService.training.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-stats'] });
      setShowModal(false);
      setFormData({ status: 'scheduled', isMandatory: false, maxParticipants: 20, enrolledCount: 0, completedCount: 0 });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return hrService.training.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-stats'] });
    },
  });

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: async ({ programId, employeeIds }: { programId: string; employeeIds: string[] }) => {
      return hrService.training.enroll(programId, employeeIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-stats'] });
      setShowEnrollModal(false);
      setEnrolleeIds([]);
      setSelectedProgram(null);
    },
  });

  const handleCreate = () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !facilityId) return;
    createMutation.mutate({
      ...formData,
      facilityId,
    } as CreateTrainingProgramDto);
  };

  const handleEnroll = () => {
    if (!selectedProgram || enrolleeIds.length === 0) return;
    enrollMutation.mutate({ programId: selectedProgram.id, employeeIds: enrolleeIds });
  };

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  if (!facilityId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please configure a facility first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Training & Development</h1>
          <p className="text-gray-500">Manage staff training programs and certifications</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Training Program
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <GraduationCap className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Training Programs</p>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Enrolled Staff</p>
              <p className="text-2xl font-bold">{stats?.totalEnrollments || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold">{stats?.active || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Certifications</p>
              <p className="text-2xl font-bold">{stats?.certificatesIssued || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Training Programs */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Training Programs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Program Name</th>
                <th className="text-left p-4 font-medium text-gray-600">Trainer</th>
                <th className="text-left p-4 font-medium text-gray-600">Duration</th>
                <th className="text-left p-4 font-medium text-gray-600">Participants</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : programs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No training programs found</p>
                    <p className="text-sm">Create a training program to start developing your staff</p>
                  </td>
                </tr>
              ) : (
                programs.map((program: TrainingProgram) => (
                  <tr key={program.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{program.name}</p>
                        {program.isMandatory && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Mandatory</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600">{program.trainer || '—'}</td>
                    <td className="p-4 text-gray-600">
                      {new Date(program.startDate).toLocaleDateString()} - {new Date(program.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-gray-600">
                      {program.enrolledCount || 0} / {program.maxParticipants || 'unlimited'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[program.status]}`}>
                        {program.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setSelectedProgram(program);
                            setShowEnrollModal(true);
                          }}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg" 
                          title="Enroll Staff"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteMutation.mutate(program.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg" 
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Add Training Program</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Program Name *</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg" 
                  placeholder="e.g., Basic Life Support"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date *</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.startDate || ''}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date *</label>
                  <input 
                    type="date" 
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.endDate || ''}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trainer/Instructor</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg" 
                  placeholder="Trainer name"
                  value={formData.trainer || ''}
                  onChange={(e) => setFormData({ ...formData, trainer: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-lg" 
                  rows={3} 
                  placeholder="Program description..."
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Participants</label>
                  <input 
                    type="number" 
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.maxParticipants || 20}
                    onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input 
                    type="text" 
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Training venue"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300"
                    checked={formData.isMandatory}
                    onChange={(e) => setFormData({ ...formData, isMandatory: e.target.checked })}
                  />
                  <span className="text-sm">Mandatory for staff</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    className="rounded border-gray-300"
                    checked={formData.hasCertification}
                    onChange={(e) => setFormData({ ...formData, hasCertification: e.target.checked })}
                  />
                  <span className="text-sm">Issues certificate</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.name || !formData.startDate || !formData.endDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Program
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Modal */}
      {showEnrollModal && selectedProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Enroll Staff in {selectedProgram.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Employees</label>
                <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-2">
                  {employees.map((emp: Employee) => (
                    <label key={emp.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        checked={enrolleeIds.includes(emp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEnrolleeIds([...enrolleeIds, emp.id]);
                          } else {
                            setEnrolleeIds(enrolleeIds.filter(id => id !== emp.id));
                          }
                        }}
                      />
                      <span>{emp.fullName}</span>
                    </label>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-500">{enrolleeIds.length} employees selected</p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowEnrollModal(false); setEnrolleeIds([]); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleEnroll}
                disabled={enrollMutation.isPending || enrolleeIds.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {enrollMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Enroll Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
