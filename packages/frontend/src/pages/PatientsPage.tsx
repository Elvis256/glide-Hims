import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Patient } from '../types';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  UserCircle,
  X,
  Eye,
} from 'lucide-react';

interface CreatePatientData {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
  address?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);

  // Fetch patients
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const response = await api.get(`/patients?${params}`);
      // API returns { data: Patient[], meta: {...} }
      return response.data?.data as Patient[] || response.data as Patient[];
    },
  });

  // Create patient mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePatientData) => api.post('/patients', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setShowModal(false);
    },
  });

  // Delete patient mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/patients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage patient records</p>
        </div>
        <button
          onClick={() => navigate('/patients/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Register Patient
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by MRN, name, phone, or national ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : !patients?.length ? (
          <div className="text-center py-12">
            <UserCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No patients found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">MRN</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Gender</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">DOB</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Phone</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        {patient.mrn}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{patient.fullName}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{patient.gender}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{patient.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingPatient(patient)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="View"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPatient(patient);
                            setShowModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="Edit"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this patient?')) {
                              deleteMutation.mutate(patient.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <PatientModal
          patient={editingPatient}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editingPatient) {
              api.patch(`/patients/${editingPatient.id}`, data).then(() => {
                queryClient.invalidateQueries({ queryKey: ['patients'] });
                setShowModal(false);
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending}
        />
      )}

      {/* View Modal */}
      {viewingPatient && (
        <PatientViewModal
          patient={viewingPatient}
          onClose={() => setViewingPatient(null)}
        />
      )}
    </div>
  );
}

interface PatientModalProps {
  patient: Patient | null;
  onClose: () => void;
  onSave: (data: CreatePatientData) => void;
  isLoading: boolean;
}

function PatientModal({ patient, onClose, onSave, isLoading }: PatientModalProps) {
  const [formData, setFormData] = useState<CreatePatientData>({
    fullName: patient?.fullName || '',
    gender: patient?.gender || 'male',
    dateOfBirth: patient?.dateOfBirth?.split('T')[0] || '',
    nationalId: patient?.nationalId || '',
    phone: patient?.phone || '',
    address: patient?.address || '',
    nextOfKin: patient?.nextOfKin || { name: '', phone: '', relationship: '' },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">
            {patient ? 'Edit Patient' : 'Register Patient'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="p-4 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender *
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData({ ...formData, gender: e.target.value as 'male' | 'female' | 'other' })
                }
                className="input"
                required
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                National ID
              </label>
              <input
                type="text"
                value={formData.nationalId}
                onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input"
                rows={2}
              />
            </div>
          </div>

          {/* Next of Kin */}
          <div className="border-t pt-4">
            <h3 className="font-medium text-gray-900 mb-3">Next of Kin</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.nextOfKin?.name || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nextOfKin: { ...formData.nextOfKin, name: e.target.value },
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.nextOfKin?.phone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nextOfKin: { ...formData.nextOfKin, phone: e.target.value },
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={formData.nextOfKin?.relationship || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nextOfKin: { ...formData.nextOfKin, relationship: e.target.value },
                    })
                  }
                  className="input"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : patient ? (
                'Update'
              ) : (
                'Register'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PatientViewModalProps {
  patient: Patient;
  onClose: () => void;
}

function PatientViewModal({ patient, onClose }: PatientViewModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Patient Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <UserCircle className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{patient.fullName}</h3>
              <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                {patient.mrn}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Gender</p>
              <p className="font-medium capitalize">{patient.gender}</p>
            </div>
            <div>
              <p className="text-gray-500">Date of Birth</p>
              <p className="font-medium">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-500">National ID</p>
              <p className="font-medium">{patient.nationalId || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{patient.phone || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Address</p>
              <p className="font-medium">{patient.address || '-'}</p>
            </div>
          </div>

          {patient.nextOfKin && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-2">Next of Kin</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="font-medium">{patient.nextOfKin.name || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{patient.nextOfKin.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Relationship</p>
                  <p className="font-medium">{patient.nextOfKin.relationship || '-'}</p>
                </div>
              </div>
            </div>
          )}

          <button onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
