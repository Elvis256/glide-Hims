import { useState, useMemo } from 'react';
import {
  Ruler,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  ArrowRight,
  Package,
  Droplets,
  Scale,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  category: 'base' | 'packaging' | 'volume' | 'weight' | 'count';
  baseUnit?: string;
  conversionFactor?: number;
  usageType: 'purchase' | 'dispensing' | 'both';
  description: string;
  isActive: boolean;
}

const mockUnits: UnitOfMeasure[] = [
  {
    id: '1',
    code: 'TAB',
    name: 'Tablet',
    category: 'base',
    usageType: 'dispensing',
    description: 'Single tablet unit',
    isActive: true,
  },
  {
    id: '2',
    code: 'CAP',
    name: 'Capsule',
    category: 'base',
    usageType: 'dispensing',
    description: 'Single capsule unit',
    isActive: true,
  },
  {
    id: '3',
    code: 'BOX',
    name: 'Box',
    category: 'packaging',
    usageType: 'purchase',
    description: 'Packaging box (varies by item)',
    isActive: true,
  },
  {
    id: '4',
    code: 'STRIP',
    name: 'Strip',
    category: 'packaging',
    baseUnit: 'TAB',
    conversionFactor: 10,
    usageType: 'both',
    description: 'Blister strip containing 10 tablets',
    isActive: true,
  },
  {
    id: '5',
    code: 'BOT-100',
    name: 'Bottle (100)',
    category: 'packaging',
    baseUnit: 'TAB',
    conversionFactor: 100,
    usageType: 'purchase',
    description: 'Bottle containing 100 tablets',
    isActive: true,
  },
  {
    id: '6',
    code: 'ML',
    name: 'Milliliter',
    category: 'volume',
    usageType: 'dispensing',
    description: 'Liquid volume in milliliters',
    isActive: true,
  },
  {
    id: '7',
    code: 'L',
    name: 'Liter',
    category: 'volume',
    baseUnit: 'ML',
    conversionFactor: 1000,
    usageType: 'purchase',
    description: 'Liquid volume in liters',
    isActive: true,
  },
  {
    id: '8',
    code: 'BOT-500ML',
    name: 'Bottle (500ml)',
    category: 'packaging',
    baseUnit: 'ML',
    conversionFactor: 500,
    usageType: 'both',
    description: 'Bottle containing 500ml liquid',
    isActive: true,
  },
  {
    id: '9',
    code: 'MG',
    name: 'Milligram',
    category: 'weight',
    usageType: 'dispensing',
    description: 'Weight in milligrams',
    isActive: true,
  },
  {
    id: '10',
    code: 'G',
    name: 'Gram',
    category: 'weight',
    baseUnit: 'MG',
    conversionFactor: 1000,
    usageType: 'both',
    description: 'Weight in grams',
    isActive: true,
  },
  {
    id: '11',
    code: 'KG',
    name: 'Kilogram',
    category: 'weight',
    baseUnit: 'G',
    conversionFactor: 1000,
    usageType: 'purchase',
    description: 'Weight in kilograms',
    isActive: true,
  },
  {
    id: '12',
    code: 'EA',
    name: 'Each',
    category: 'count',
    usageType: 'both',
    description: 'Individual unit count',
    isActive: true,
  },
  {
    id: '13',
    code: 'PKT',
    name: 'Packet',
    category: 'packaging',
    usageType: 'both',
    description: 'Single packet/sachet',
    isActive: true,
  },
  {
    id: '14',
    code: 'AMP',
    name: 'Ampoule',
    category: 'packaging',
    usageType: 'dispensing',
    description: 'Single ampoule for injection',
    isActive: true,
  },
  {
    id: '15',
    code: 'BOX-10AMP',
    name: 'Box (10 Ampoules)',
    category: 'packaging',
    baseUnit: 'AMP',
    conversionFactor: 10,
    usageType: 'purchase',
    description: 'Box containing 10 ampoules',
    isActive: true,
  },
  {
    id: '16',
    code: 'VIAL',
    name: 'Vial',
    category: 'packaging',
    usageType: 'both',
    description: 'Single vial',
    isActive: true,
  },
  {
    id: '17',
    code: 'TUBE',
    name: 'Tube',
    category: 'packaging',
    usageType: 'dispensing',
    description: 'Cream/ointment tube',
    isActive: true,
  },
  {
    id: '18',
    code: 'OLD-UNIT',
    name: 'Old Unit (Deprecated)',
    category: 'base',
    usageType: 'dispensing',
    description: 'Deprecated unit - do not use',
    isActive: false,
  },
];

const categories = ['All Categories', 'base', 'packaging', 'volume', 'weight', 'count'];

export default function UnitOfMeasurePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [usageFilter, setUsageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredUnits = useMemo(() => {
    return mockUnits.filter((unit) => {
      const matchesSearch =
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All Categories' || unit.category === categoryFilter;
      const matchesUsage = usageFilter === 'all' || unit.usageType === usageFilter || unit.usageType === 'both';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && unit.isActive) ||
        (statusFilter === 'inactive' && !unit.isActive);
      return matchesSearch && matchesCategory && matchesUsage && matchesStatus;
    });
  }, [searchTerm, categoryFilter, usageFilter, statusFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'packaging':
        return <Package className="w-4 h-4 text-purple-500" />;
      case 'volume':
        return <Droplets className="w-4 h-4 text-blue-500" />;
      case 'weight':
        return <Scale className="w-4 h-4 text-amber-500" />;
      default:
        return <Ruler className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'base':
        return 'bg-gray-100 text-gray-800';
      case 'packaging':
        return 'bg-purple-100 text-purple-800';
      case 'volume':
        return 'bg-blue-100 text-blue-800';
      case 'weight':
        return 'bg-amber-100 text-amber-800';
      case 'count':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsageBadge = (usage: string) => {
    switch (usage) {
      case 'purchase':
        return 'bg-indigo-100 text-indigo-800';
      case 'dispensing':
        return 'bg-teal-100 text-teal-800';
      case 'both':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Ruler className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Units of Measure</h1>
            <p className="text-sm text-gray-500">Manage base units and conversion factors</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Unit
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'All Categories' ? cat : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={usageFilter}
          onChange={(e) => setUsageFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Usage Types</option>
          <option value="purchase">Purchase</option>
          <option value="dispensing">Dispensing</option>
          <option value="both">Both</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{mockUnits.length}</div>
          <div className="text-sm text-gray-500">Total Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-600">
            {mockUnits.filter((u) => u.category === 'base').length}
          </div>
          <div className="text-sm text-gray-500">Base Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {mockUnits.filter((u) => u.category === 'packaging').length}
          </div>
          <div className="text-sm text-gray-500">Packaging Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-indigo-600">
            {mockUnits.filter((u) => u.usageType === 'purchase' || u.usageType === 'both').length}
          </div>
          <div className="text-sm text-gray-500">Purchase Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-teal-600">
            {mockUnits.filter((u) => u.usageType === 'dispensing' || u.usageType === 'both').length}
          </div>
          <div className="text-sm text-gray-500">Dispensing Units</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conversion</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUnits.map((unit) => (
                <tr key={unit.id} className={`hover:bg-gray-50 ${!unit.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold text-teal-600">{unit.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{unit.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(unit.category)}`}>
                      {getCategoryIcon(unit.category)}
                      {unit.category.charAt(0).toUpperCase() + unit.category.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {unit.baseUnit && unit.conversionFactor ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">1 {unit.code}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {unit.conversionFactor} {unit.baseUnit}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Base unit</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUsageBadge(unit.usageType)}`}>
                      {unit.usageType.charAt(0).toUpperCase() + unit.usageType.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{unit.description}</span>
                  </td>
                  <td className="px-4 py-3">
                    {unit.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-teal-600">
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
