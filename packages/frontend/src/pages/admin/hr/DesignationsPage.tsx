import { useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Building2,
  DollarSign,
  Users,
  ArrowUpRight,
  Filter,
  MoreVertical,
} from 'lucide-react';

interface Designation {
  id: string;
  title: string;
  level: number;
  grade: string;
  department: string;
  payScaleMin: number;
  payScaleMax: number;
  reportsTo: string | null;
  staffCount: number;
  status: 'Active' | 'Inactive';
}

const mockDesignations: Designation[] = [
  { id: '1', title: 'Chief Medical Officer', level: 1, grade: 'E1', department: 'Administration', payScaleMin: 250000, payScaleMax: 350000, reportsTo: null, staffCount: 1, status: 'Active' },
  { id: '2', title: 'Medical Director', level: 2, grade: 'E2', department: 'Administration', payScaleMin: 200000, payScaleMax: 280000, reportsTo: 'Chief Medical Officer', staffCount: 3, status: 'Active' },
  { id: '3', title: 'Senior Consultant', level: 3, grade: 'M1', department: 'Multiple', payScaleMin: 150000, payScaleMax: 220000, reportsTo: 'Medical Director', staffCount: 15, status: 'Active' },
  { id: '4', title: 'Consultant', level: 4, grade: 'M2', department: 'Multiple', payScaleMin: 120000, payScaleMax: 180000, reportsTo: 'Senior Consultant', staffCount: 28, status: 'Active' },
  { id: '5', title: 'Resident Doctor', level: 5, grade: 'M3', department: 'Multiple', payScaleMin: 80000, payScaleMax: 120000, reportsTo: 'Consultant', staffCount: 45, status: 'Active' },
  { id: '6', title: 'Head Nurse', level: 3, grade: 'N1', department: 'Nursing', payScaleMin: 70000, payScaleMax: 95000, reportsTo: 'Medical Director', staffCount: 8, status: 'Active' },
  { id: '7', title: 'Senior Nurse', level: 4, grade: 'N2', department: 'Nursing', payScaleMin: 55000, payScaleMax: 75000, reportsTo: 'Head Nurse', staffCount: 35, status: 'Active' },
  { id: '8', title: 'Staff Nurse', level: 5, grade: 'N3', department: 'Nursing', payScaleMin: 40000, payScaleMax: 60000, reportsTo: 'Senior Nurse', staffCount: 120, status: 'Active' },
  { id: '9', title: 'Lab Technician', level: 5, grade: 'T1', department: 'Laboratory', payScaleMin: 35000, payScaleMax: 50000, reportsTo: 'Lab Supervisor', staffCount: 25, status: 'Active' },
  { id: '10', title: 'Radiologist', level: 3, grade: 'M1', department: 'Radiology', payScaleMin: 140000, payScaleMax: 200000, reportsTo: 'Medical Director', staffCount: 6, status: 'Active' },
];

const gradeColors: Record<string, string> = {
  E1: 'bg-purple-100 text-purple-800',
  E2: 'bg-purple-100 text-purple-800',
  M1: 'bg-blue-100 text-blue-800',
  M2: 'bg-blue-100 text-blue-800',
  M3: 'bg-blue-100 text-blue-800',
  N1: 'bg-green-100 text-green-800',
  N2: 'bg-green-100 text-green-800',
  N3: 'bg-green-100 text-green-800',
  T1: 'bg-orange-100 text-orange-800',
};

export default function DesignationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const departments = useMemo(() => [...new Set(mockDesignations.map((d) => d.department))], []);

  const filteredDesignations = useMemo(() => {
    return mockDesignations.filter((designation) => {
      const matchesSearch =
        designation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        designation.grade.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === 'all' || designation.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [searchTerm, departmentFilter]);

  const stats = useMemo(() => ({
    totalDesignations: mockDesignations.length,
    executiveLevel: mockDesignations.filter((d) => d.level <= 2).length,
    medicalRoles: mockDesignations.filter((d) => d.grade.startsWith('M')).length,
    nursingRoles: mockDesignations.filter((d) => d.grade.startsWith('N')).length,
  }), []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="h-7 w-7 text-blue-600" />
              Designations
            </h1>
            <p className="text-gray-600 mt-1">Manage job titles, grades, and reporting structure</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Designation
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Designations</span>
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalDesignations}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Executive Level</span>
              <ArrowUpRight className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.executiveLevel}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Medical Roles</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.medicalRoles}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Nursing Roles</span>
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.nursingRoles}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search designations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Designation</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Level/Grade</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Pay Scale</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Reports To</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDesignations.map((designation) => (
                <tr key={designation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-900">{designation.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">L{designation.level}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradeColors[designation.grade] || 'bg-gray-100 text-gray-800'}`}>
                        {designation.grade}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{designation.department}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {formatCurrency(designation.payScaleMin)} - {formatCurrency(designation.payScaleMax)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {designation.reportsTo ? (
                      <div className="flex items-center gap-1 text-gray-600">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        {designation.reportsTo}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{designation.staffCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      designation.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {designation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                        <Edit className="h-4 w-4 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="Delete">
                        <Trash2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="More">
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing {filteredDesignations.length} designations</span>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add New Designation</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter job title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>Level 1 (Executive)</option>
                    <option>Level 2 (Director)</option>
                    <option>Level 3 (Senior)</option>
                    <option>Level 4 (Mid)</option>
                    <option>Level 5 (Entry)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="E1, M1, N1, etc." />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Pay Scale</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="50000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Pay Scale</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2" placeholder="80000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>None (Top Level)</option>
                  {mockDesignations.map((d) => (
                    <option key={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Designation</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
