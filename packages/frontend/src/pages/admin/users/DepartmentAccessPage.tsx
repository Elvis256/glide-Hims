import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Check,
  X,
  ChevronDown,
  Users,
  Star,
  UserCheck,
  Crown,
  ArrowRight,
  Trash2,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  headId: string | null;
  headName: string | null;
  userCount: number;
  location: string;
}

interface UserDepartment {
  id: string;
  name: string;
  role: string;
  email: string;
  departments: { id: string; name: string; isPrimary: boolean }[];
}

const mockDepartments: Department[] = [
  { id: '1', name: 'Emergency', code: 'ER', headId: '1', headName: 'Dr. John Smith', userCount: 25, location: 'Building A, Floor 1' },
  { id: '2', name: 'Cardiology', code: 'CARD', headId: '2', headName: 'Dr. Emily Wilson', userCount: 18, location: 'Building B, Floor 2' },
  { id: '3', name: 'Pediatrics', code: 'PED', headId: '3', headName: 'Dr. Sarah Johnson', userCount: 15, location: 'Building A, Floor 3' },
  { id: '4', name: 'Laboratory', code: 'LAB', headId: '4', headName: 'Peter Brown', userCount: 12, location: 'Building C, Floor 1' },
  { id: '5', name: 'Pharmacy', code: 'PHRM', headId: '5', headName: 'Mike Johnson', userCount: 8, location: 'Building A, Floor 1' },
  { id: '6', name: 'Radiology', code: 'RAD', headId: null, headName: null, userCount: 10, location: 'Building C, Floor 2' },
  { id: '7', name: 'ICU', code: 'ICU', headId: '6', headName: 'Dr. Robert Lee', userCount: 20, location: 'Building A, Floor 4' },
  { id: '8', name: 'Surgery', code: 'SURG', headId: '7', headName: 'Dr. Amanda Chen', userCount: 22, location: 'Building B, Floor 3' },
];

const mockUserDepartments: UserDepartment[] = [
  { id: '1', name: 'Dr. John Smith', role: 'Doctor', email: 'j.smith@hospital.com', departments: [{ id: '1', name: 'Emergency', isPrimary: true }, { id: '7', name: 'ICU', isPrimary: false }] },
  { id: '2', name: 'Jane Williams', role: 'Nurse', email: 'j.williams@hospital.com', departments: [{ id: '1', name: 'Emergency', isPrimary: true }] },
  { id: '3', name: 'Dr. Emily Wilson', role: 'Doctor', email: 'e.wilson@hospital.com', departments: [{ id: '2', name: 'Cardiology', isPrimary: true }, { id: '7', name: 'ICU', isPrimary: false }] },
  { id: '4', name: 'Mike Johnson', role: 'Pharmacist', email: 'm.johnson@hospital.com', departments: [{ id: '5', name: 'Pharmacy', isPrimary: true }] },
  { id: '5', name: 'Peter Brown', role: 'Lab Tech', email: 'p.brown@hospital.com', departments: [{ id: '4', name: 'Laboratory', isPrimary: true }] },
  { id: '6', name: 'Sarah Davis', role: 'Receptionist', email: 's.davis@hospital.com', departments: [{ id: '1', name: 'Emergency', isPrimary: true }, { id: '2', name: 'Cardiology', isPrimary: false }, { id: '3', name: 'Pediatrics', isPrimary: false }] },
  { id: '7', name: 'Tom Anderson', role: 'Nurse', email: 't.anderson@hospital.com', departments: [{ id: '7', name: 'ICU', isPrimary: true }] },
  { id: '8', name: 'Lisa Martinez', role: 'Radiologist', email: 'l.martinez@hospital.com', departments: [{ id: '6', name: 'Radiology', isPrimary: true }] },
];

export default function DepartmentAccessPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(mockDepartments[0]);
  const [viewMode, setViewMode] = useState<'departments' | 'users'>('departments');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showHeadModal, setShowHeadModal] = useState(false);

  const filteredDepartments = useMemo(() => {
    return mockDepartments.filter((dept) =>
      dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const filteredUsers = useMemo(() => {
    return mockUserDepartments.filter((user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const departmentUsers = useMemo(() => {
    if (!selectedDepartment) return [];
    return mockUserDepartments.filter((user) =>
      user.departments.some((d) => d.id === selectedDepartment.id)
    );
  }, [selectedDepartment]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Building2 className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Department Access</h1>
            <p className="text-sm text-gray-500">Manage user department assignments</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('departments')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${viewMode === 'departments' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Building2 className="w-4 h-4" />
              By Department
            </button>
            <button
              onClick={() => setViewMode('users')}
              className={`px-4 py-2 text-sm flex items-center gap-2 ${viewMode === 'users' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <Users className="w-4 h-4" />
              By User
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={viewMode === 'departments' ? 'Search departments...' : 'Search users...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {viewMode === 'departments' ? (
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Departments List */}
          <div className="w-96 bg-white rounded-lg border border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Departments ({filteredDepartments.length})</h2>
            </div>
            <div className="flex-1 overflow-auto">
              {filteredDepartments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedDepartment?.id === dept.id ? 'bg-teal-50 border-l-4 border-l-teal-600' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{dept.name}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{dept.code}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{dept.location}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        {dept.userCount}
                      </span>
                    </div>
                  </div>
                  {dept.headName && (
                    <div className="flex items-center gap-2 mt-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm text-gray-600">{dept.headName}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Department Details */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
            {selectedDepartment ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{selectedDepartment.name}</h2>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{selectedDepartment.code}</span>
                    </div>
                    <p className="text-sm text-gray-500">{selectedDepartment.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHeadModal(true)}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                    >
                      <Crown className="w-4 h-4 text-yellow-500" />
                      {selectedDepartment.headName ? 'Change Head' : 'Assign Head'}
                    </button>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Assign Users
                    </button>
                  </div>
                </div>

                {/* Department Head */}
                {selectedDepartment.headName && (
                  <div className="p-4 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                          <Crown className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-yellow-700">Department Head</p>
                          <p className="font-medium text-gray-900">{selectedDepartment.headName}</p>
                        </div>
                      </div>
                      <button className="text-sm text-yellow-700 hover:text-yellow-800">Remove</button>
                    </div>
                  </div>
                )}

                {/* Users List */}
                <div className="flex-1 overflow-auto p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Assigned Users ({departmentUsers.length})
                  </h3>
                  <div className="space-y-2">
                    {departmentUsers.map((user) => {
                      const deptInfo = user.departments.find((d) => d.id === selectedDepartment.id);
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-gray-500" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{user.name}</p>
                                {deptInfo?.isPrimary && (
                                  <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full flex items-center gap-1">
                                    <Star className="w-3 h-3" />
                                    Primary
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{user.role} • {user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!deptInfo?.isPrimary && (
                              <button className="text-xs text-teal-600 hover:text-teal-800 px-2 py-1 border border-teal-200 rounded">
                                Set Primary
                              </button>
                            )}
                            <button className="p-1 hover:bg-red-50 rounded text-red-500">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                Select a department to view details
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Users View */
        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Primary Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Additional Departments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => {
                  const primaryDept = user.departments.find((d) => d.isPrimary);
                  const additionalDepts = user.departments.filter((d) => !d.isPrimary);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{user.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        {primaryDept && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-700 text-sm rounded-full">
                            <Star className="w-3 h-3" />
                            {primaryDept.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {additionalDepts.map((dept) => (
                            <span
                              key={dept.id}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {dept.name}
                            </span>
                          ))}
                          {additionalDepts.length === 0 && (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded" title="Edit Departments">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 rounded" title="Add Department">
                            <Plus className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Users Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Users to {selectedDepartment?.name}</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users to assign..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="max-h-60 overflow-auto space-y-2">
              {mockUserDepartments.slice(0, 5).map((user) => (
                <label
                  key={user.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm text-gray-600">
                      <input type="checkbox" className="rounded border-gray-300" />
                      Primary
                    </label>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                Assign Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Head Modal */}
      {showHeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHeadModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Department Head</h3>
              <button onClick={() => setShowHeadModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Select a user to be the head of {selectedDepartment?.name}</p>
            <div className="max-h-60 overflow-auto space-y-2">
              {departmentUsers.map((user) => (
                <button
                  key={user.id}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <Crown className="w-5 h-5 text-gray-300 hover:text-yellow-500" />
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowHeadModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}