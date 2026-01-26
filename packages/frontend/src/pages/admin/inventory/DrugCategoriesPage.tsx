import { useState, useMemo } from 'react';
import {
  FolderTree,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  Thermometer,
  Lock,
  FileText,
  ChevronRight,
  Shield,
  Snowflake,
  AlertTriangle,
} from 'lucide-react';

interface DrugCategory {
  id: string;
  code: string;
  name: string;
  parentCategory?: string;
  therapeuticClass: string;
  controlSchedule?: string;
  storageRequirement: 'room-temp' | 'cold-chain' | 'controlled' | 'frozen';
  prescriptionRequired: boolean;
  specialHandling?: string;
  drugCount: number;
  isActive: boolean;
}

const mockCategories: DrugCategory[] = [
  {
    id: '1',
    code: 'AB',
    name: 'Antibiotics',
    therapeuticClass: 'Anti-Infectives',
    storageRequirement: 'room-temp',
    prescriptionRequired: true,
    drugCount: 45,
    isActive: true,
  },
  {
    id: '2',
    code: 'AN-OP',
    name: 'Opioid Analgesics',
    parentCategory: 'Analgesics',
    therapeuticClass: 'Pain Management',
    controlSchedule: 'Schedule II',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Double-lock cabinet, witness for waste',
    drugCount: 12,
    isActive: true,
  },
  {
    id: '3',
    code: 'VAC',
    name: 'Vaccines',
    therapeuticClass: 'Immunization',
    storageRequirement: 'cold-chain',
    prescriptionRequired: true,
    specialHandling: 'Maintain 2-8°C, monitor temperature',
    drugCount: 28,
    isActive: true,
  },
  {
    id: '4',
    code: 'INS',
    name: 'Insulins',
    therapeuticClass: 'Antidiabetics',
    storageRequirement: 'cold-chain',
    prescriptionRequired: true,
    specialHandling: 'Refrigerate until use, 28 days at room temp after opening',
    drugCount: 15,
    isActive: true,
  },
  {
    id: '5',
    code: 'BZ',
    name: 'Benzodiazepines',
    parentCategory: 'Anxiolytics',
    therapeuticClass: 'CNS Agents',
    controlSchedule: 'Schedule IV',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Controlled substance cabinet',
    drugCount: 8,
    isActive: true,
  },
  {
    id: '6',
    code: 'BIO',
    name: 'Biologics',
    therapeuticClass: 'Immunomodulators',
    storageRequirement: 'frozen',
    prescriptionRequired: true,
    specialHandling: 'Store at -20°C, thaw before administration',
    drugCount: 6,
    isActive: true,
  },
  {
    id: '7',
    code: 'OTC',
    name: 'Over-the-Counter',
    therapeuticClass: 'General',
    storageRequirement: 'room-temp',
    prescriptionRequired: false,
    drugCount: 52,
    isActive: true,
  },
  {
    id: '8',
    code: 'CHEMO',
    name: 'Chemotherapy Agents',
    therapeuticClass: 'Oncology',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Hazardous material, special handling required',
    drugCount: 18,
    isActive: true,
  },
  {
    id: '9',
    code: 'AN-NS',
    name: 'NSAIDs',
    parentCategory: 'Analgesics',
    therapeuticClass: 'Pain Management',
    storageRequirement: 'room-temp',
    prescriptionRequired: true,
    drugCount: 14,
    isActive: true,
  },
  {
    id: '10',
    code: 'BARB',
    name: 'Barbiturates',
    therapeuticClass: 'CNS Agents',
    controlSchedule: 'Schedule III',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Controlled substance cabinet',
    drugCount: 4,
    isActive: false,
  },
];

export default function DrugCategoriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [storageFilter, setStorageFilter] = useState<string>('all');
  const [controlFilter, setControlFilter] = useState<string>('all');

  const filteredCategories = useMemo(() => {
    return mockCategories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.therapeuticClass.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStorage = storageFilter === 'all' || cat.storageRequirement === storageFilter;
      const matchesControl =
        controlFilter === 'all' ||
        (controlFilter === 'controlled' && cat.controlSchedule) ||
        (controlFilter === 'non-controlled' && !cat.controlSchedule);
      return matchesSearch && matchesStorage && matchesControl;
    });
  }, [searchTerm, storageFilter, controlFilter]);

  const getStorageIcon = (storage: string) => {
    switch (storage) {
      case 'cold-chain':
        return <Snowflake className="w-4 h-4 text-blue-500" />;
      case 'frozen':
        return <Snowflake className="w-4 h-4 text-cyan-500" />;
      case 'controlled':
        return <Lock className="w-4 h-4 text-red-500" />;
      default:
        return <Thermometer className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStorageLabel = (storage: string) => {
    switch (storage) {
      case 'room-temp':
        return 'Room Temperature';
      case 'cold-chain':
        return 'Cold Chain (2-8°C)';
      case 'frozen':
        return 'Frozen (-20°C)';
      case 'controlled':
        return 'Controlled Access';
      default:
        return storage;
    }
  };

  const getStorageBadge = (storage: string) => {
    switch (storage) {
      case 'cold-chain':
        return 'bg-blue-100 text-blue-800';
      case 'frozen':
        return 'bg-cyan-100 text-cyan-800';
      case 'controlled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FolderTree className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Drug Categories</h1>
            <p className="text-sm text-gray-500">Therapeutic classifications and storage requirements</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Storage Types</option>
          <option value="room-temp">Room Temperature</option>
          <option value="cold-chain">Cold Chain</option>
          <option value="frozen">Frozen</option>
          <option value="controlled">Controlled Access</option>
        </select>
        <select
          value={controlFilter}
          onChange={(e) => setControlFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Substances</option>
          <option value="controlled">Controlled Substances</option>
          <option value="non-controlled">Non-Controlled</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{mockCategories.length}</div>
          <div className="text-sm text-gray-500">Total Categories</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600">
              {mockCategories.filter((c) => c.controlSchedule).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Controlled</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">
              {mockCategories.filter((c) => c.storageRequirement === 'cold-chain').length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Cold Chain</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-cyan-500" />
            <span className="text-2xl font-bold text-cyan-600">
              {mockCategories.filter((c) => c.storageRequirement === 'frozen').length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Frozen</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {mockCategories.reduce((sum, c) => sum + c.drugCount, 0)}
          </div>
          <div className="text-sm text-gray-500">Total Drugs</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Therapeutic Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Control Schedule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rx Required</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drugs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map((cat) => (
                <tr key={cat.id} className={`hover:bg-gray-50 ${!cat.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-indigo-600">{cat.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {cat.parentCategory && (
                        <>
                          <span className="text-sm text-gray-400">{cat.parentCategory}</span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        </>
                      )}
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{cat.therapeuticClass}</span>
                  </td>
                  <td className="px-4 py-3">
                    {cat.controlSchedule ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                        <Shield className="w-4 h-4" />
                        {cat.controlSchedule}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStorageBadge(cat.storageRequirement)}`}>
                        {getStorageIcon(cat.storageRequirement)}
                        {getStorageLabel(cat.storageRequirement)}
                      </span>
                      {cat.specialHandling && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {cat.specialHandling.substring(0, 35)}...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {cat.prescriptionRequired ? (
                      <span className="flex items-center gap-1 text-sm text-amber-600">
                        <FileText className="w-4 h-4" />
                        Required
                      </span>
                    ) : (
                      <span className="text-sm text-green-600">OTC</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{cat.drugCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-indigo-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}