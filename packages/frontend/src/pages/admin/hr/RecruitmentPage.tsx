import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Users, FileText, CheckCircle, Clock, Plus, Loader2, Eye, Trash2, Edit } from 'lucide-react';
import { hrService, type JobPosting, type CreateJobPostingDto } from '../../../services/hr';
import { facilitiesService } from '../../../services';

export default function RecruitmentPage() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateJobPostingDto>>({
    title: '',
    description: '',
    employmentType: 'full-time',
    positionsAvailable: 1,
  });
  const queryClient = useQueryClient();

  // Get facility
  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); } 
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      try { return await facilitiesService.departments.listAll(); }
      catch { return []; }
    },
  });

  // Fetch job postings
  const { data: jobPostings = [], isLoading } = useQuery({
    queryKey: ['job-postings', facilityId],
    queryFn: async () => {
      try {
        return await hrService.recruitment.listJobs({ facilityId });
      } catch { return []; }
    },
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['recruitment-stats', facilityId],
    queryFn: async () => {
      try {
        return await hrService.recruitment.getStats(facilityId!);
      } catch { return { openPositions: 0, totalApplications: 0, shortlisted: 0, hired: 0 }; }
    },
    enabled: !!facilityId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateJobPostingDto) => {
      return hrService.recruitment.createJob(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-stats'] });
      setShowModal(false);
      setFormData({ title: '', description: '', employmentType: 'full-time', positionsAvailable: 1 });
    },
  });

  // Update status mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return hrService.recruitment.updateJob(id, { status } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-stats'] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return hrService.recruitment.deleteJob(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      queryClient.invalidateQueries({ queryKey: ['recruitment-stats'] });
    },
  });

  const handleCreate = () => {
    if (!formData.title || !facilityId) return;
    createMutation.mutate({
      ...formData,
      facilityId,
    } as CreateJobPostingDto);
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    open: 'bg-green-100 text-green-800',
    closed: 'bg-red-100 text-red-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    filled: 'bg-blue-100 text-blue-800',
  };

  if (facilitiesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
          <p className="text-gray-500">Manage job postings and applications</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Post New Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Open Positions</p>
              <p className="text-2xl font-bold">{stats?.openPositions || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Applications</p>
              <p className="text-2xl font-bold">{stats?.totalApplications || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Shortlisted</p>
              <p className="text-2xl font-bold">{stats?.shortlisted || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Hired</p>
              <p className="text-2xl font-bold">{stats?.hired || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Job Postings Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Job Postings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Title</th>
                <th className="text-left p-4 font-medium text-gray-600">Department</th>
                <th className="text-left p-4 font-medium text-gray-600">Type</th>
                <th className="text-left p-4 font-medium text-gray-600">Applications</th>
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
              ) : jobPostings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <Briefcase className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No job postings yet</p>
                    <p className="text-sm">Click "Post New Job" to create your first job posting</p>
                  </td>
                </tr>
              ) : (
                jobPostings.map((job: JobPosting) => (
                  <tr key={job.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-medium">{job.title}</p>
                      <p className="text-sm text-gray-500">{job.positionsAvailable} position(s)</p>
                    </td>
                    <td className="p-4 text-gray-600">{job.department?.name || '—'}</td>
                    <td className="p-4 text-gray-600 capitalize">{job.employmentType}</td>
                    <td className="p-4">
                      <span className="font-medium">{job.applicationsCount}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View Applications">
                          <Eye className="w-4 h-4" />
                        </button>
                        {job.status === 'draft' && (
                          <button
                            onClick={() => updateMutation.mutate({ id: job.id, status: 'open' })}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Publish"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {job.status === 'open' && (
                          <button
                            onClick={() => updateMutation.mutate({ id: job.id, status: 'closed' })}
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                            title="Close"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(job.id)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Post New Job</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Job Title *</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border rounded-lg" 
                  placeholder="e.g., Registered Nurse"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.departmentId || ''}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                >
                  <option value="">Select department</option>
                  {departments.map((dept: any) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Employment Type</label>
                <select 
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Positions Available</label>
                <input 
                  type="number" 
                  className="w-full px-3 py-2 border rounded-lg" 
                  min="1"
                  value={formData.positionsAvailable}
                  onChange={(e) => setFormData({ ...formData, positionsAvailable: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border rounded-lg" 
                  rows={4} 
                  placeholder="Job description..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                ></textarea>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button 
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.title}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Post Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
