import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  MapPin,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FolderTree,
  UserCircle,
  Loader2,
} from 'lucide-react';
import { facilitiesService, type Department as APIDept } from '../../../services';

interface SubDepartment {
  id: string;
  name: string;
  staffCount: number;
}

interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  location: string;
  building: string;
  staffCount: number;
  subDepartments: SubDepartment[];
  status: 'Active' | 'Inactive';
}

const mockDepartments: Department[] = [
  {
    id: '1',
    name: 'Cardiology',
    code: 'CARD',
    head: 'Dr. Sarah Johnson',
    location: 'Wing A, Floor 3',
    building: 'Main Building',
    staffCount: 45,
    status: 'Active',
    subDepartments: [
      { id: '1a', name: 'Cardiac Surgery', staffCount: 15 },
      { id: '1b', name: 'Cardiac Rehabilitation', staffCount: 8 },
      { id: '1c', name: 'Interventional Cardiology', staffCount: 12 },
    ],
  },
  {
    id: '2',
    name: 'Neurology',
    code: 'NEUR',
    head: 'Dr. Michael Chen',
    location: 'Wing B, Floor 4',
    building: 'Main Building',
    staffCount: 38,
    status: 'Active',
    subDepartments: [
      { id: '2a', name: 'Neuro Surgery', staffCount: 10 },
      { id: '2b', name: 'Stroke Unit', staffCount: 12 },
    ],
  },
  {
    id: '3',
    name: 'Emergency',
    code: 'EMER',
    head: 'Dr. Emily Davis',
    location: 'Ground Floor',
    building: 'Emergency Block',
    staffCount: 65,
    status: 'Active',
    subDepartments: [
      { id: '3a', name: 'Trauma Center', staffCount: 25 },
      { id: '3b', name: 'Triage', staffCount: 15 },
    ],
  },
  {
    id: '4',
    name: 'Pediatrics',
    code: 'PEDI',
    head: 'Dr. Robert Brown',
    location: 'Wing C, Floor 2',
    building: 'Children\'s Block',
    staffCount: 42,
    status: 'Active',
    subDepartments: [
      { id: '4a', name: 'Neonatal ICU', staffCount: 18 },
      { id: '4b', name: 'Pediatric Surgery', staffCount: 10 },
    ],
  },
  {
    id: '5',
    name: 'Radiology',
    code: 'RADI',
    head: 'Dr. Patricia Lee',
    location: 'Wing A, Basement',
    building: 'Diagnostic Center',
    staffCount: 28,
    status: 'Active',
    subDepartments: [
      { id: '5a', name: 'MRI Unit', staffCount: 8 },
      { id: '5b', name: 'CT Scan', staffCount: 6 },
      { id: '5c', name: 'X-Ray', staffCount: 10 },
    ],
  },
  {
    id: '6',
    name: 'Laboratory',
    code: 'LAB',
    head: 'Dr. James Wilson',
    location: 'Wing B, Floor 1',
    building: 'Diagnostic Center',
    staffCount: 35,
    status: 'Active',
    subDepartments: [
      { id: '6a', name: 'Blood Bank', staffCount: 10 },
      { id: '6b', name: 'Pathology', staffCount: 12 },
    ],
  },
];

export default function DepartmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(['1']));
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch departments from API
  const { data: apiDepts, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
    staleTime: 60000,
  });

  // Transform API data with fallback
  const departments: Department[] = useMemo(() => {
    if (!apiDepts) return [];
    return apiDepts.map((d: APIDept) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      head: 'Department Head',
      location: 'Building A',
      building: 'Main Building',
      staffCount: 0,
      status: d.isActive ? 'Active' as const : 'Inactive' as const,
      subDepartments: [],
    }));
  }, [apiDepts]);

  const filteredDepartments = useMemo(() => {
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.head.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [departments, searchTerm]);

  const toggleExpand = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const stats = useMemo(() => ({
    totalDepartments: mockDepartments.length,
    totalSubDepartments: mockDepartments.reduce((acc, d) => acc + d.subDepartments.length, 0),
    totalStaff: mockDepartments.reduce((acc, d) => acc + d.staffCount, 0),
    activeDepartments: mockDepartments.filter((d) => d.status === 'Active').length,
  }), []);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-blue-600" />
              Departments
            </h1>
            <p className="text-gray-600 mt-1">Manage hospital departments and organizational structure</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Department
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Departments</span>
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalDepartments}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Sub-Departments</span>
              <FolderTree className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalSubDepartments}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Staff</span>
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalStaff}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Active</span>
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activeDepartments}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Departments List */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 w-8"></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Head</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDepartments.map((dept) => (
                <>
                  <tr key={dept.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {dept.subDepartments.length > 0 && (
                        <button
                          onClick={() => toggleExpand(dept.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedDepts.has(dept.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{dept.name}</p>
                          <p className="text-sm text-gray-500">{dept.subDepartments.length} sub-departments</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{dept.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{dept.head}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-gray-700 text-sm">{dept.location}</p>
                          <p className="text-gray-500 text-xs">{dept.building}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{dept.staffCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        dept.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {dept.status}
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
                  {/* Sub-departments */}
                  {expandedDepts.has(dept.id) &&
                    dept.subDepartments.map((sub) => (
                      <tr key={sub.id} className="bg-gray-50">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 pl-16">
                          <div className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{sub.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-600">{sub.staffCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2">
                          <button className="p-1 hover:bg-gray-200 rounded" title="Edit">
                            <Edit className="h-3 w-3 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add New Department</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter department name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="DEPT" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>Select Head</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Building name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Wing A, Floor 1" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Department</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
