import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Download,
  Filter,
  Gift,
  Percent,
  Zap,
  Clock,
  Tag,
  MoreHorizontal,
  Stethoscope,
  FlaskConical,
  Radio,
  Pill,
} from 'lucide-react';

interface Benefit {
  id: string;
  code: string;
  name: string;
  type: 'discount' | 'free_service' | 'priority' | 'cashback';
  applicableServices: string[];
  usageLimit: number | null;
  validityDays: number | null;
  discountValue: number | null;
  isPercentage: boolean;
  isActive: boolean;
  plansUsing: number;
}

const mockBenefits: Benefit[] = [
  {
    id: '1',
    code: 'BEN001',
    name: 'Consultation Discount',
    type: 'discount',
    applicableServices: ['Consultation'],
    usageLimit: null,
    validityDays: null,
    discountValue: 10,
    isPercentage: true,
    isActive: true,
    plansUsing: 4,
  },
  {
    id: '2',
    code: 'BEN002',
    name: 'Free Annual Checkup',
    type: 'free_service',
    applicableServices: ['Health Checkup'],
    usageLimit: 1,
    validityDays: 365,
    discountValue: 100,
    isPercentage: true,
    isActive: true,
    plansUsing: 3,
  },
  {
    id: '3',
    code: 'BEN003',
    name: 'Priority Booking',
    type: 'priority',
    applicableServices: ['Consultation', 'Radiology', 'Lab'],
    usageLimit: null,
    validityDays: null,
    discountValue: null,
    isPercentage: false,
    isActive: true,
    plansUsing: 5,
  },
  {
    id: '4',
    code: 'BEN004',
    name: 'Lab Test Discount',
    type: 'discount',
    applicableServices: ['Lab'],
    usageLimit: 10,
    validityDays: 30,
    discountValue: 15,
    isPercentage: true,
    isActive: true,
    plansUsing: 3,
  },
  {
    id: '5',
    code: 'BEN005',
    name: 'Pharmacy Cashback',
    type: 'cashback',
    applicableServices: ['Pharmacy'],
    usageLimit: null,
    validityDays: null,
    discountValue: 5,
    isPercentage: true,
    isActive: true,
    plansUsing: 2,
  },
  {
    id: '6',
    code: 'BEN006',
    name: 'Free Home Visit',
    type: 'free_service',
    applicableServices: ['Home Care'],
    usageLimit: 2,
    validityDays: 90,
    discountValue: 100,
    isPercentage: true,
    isActive: true,
    plansUsing: 2,
  },
  {
    id: '7',
    code: 'BEN007',
    name: 'Radiology Discount',
    type: 'discount',
    applicableServices: ['Radiology'],
    usageLimit: 4,
    validityDays: 365,
    discountValue: 20,
    isPercentage: true,
    isActive: false,
    plansUsing: 0,
  },
  {
    id: '8',
    code: 'BEN008',
    name: 'VIP Priority Access',
    type: 'priority',
    applicableServices: ['All Services'],
    usageLimit: null,
    validityDays: null,
    discountValue: null,
    isPercentage: false,
    isActive: true,
    plansUsing: 1,
  },
];

const typeColors = {
  discount: 'bg-green-100 text-green-700',
  free_service: 'bg-blue-100 text-blue-700',
  priority: 'bg-purple-100 text-purple-700',
  cashback: 'bg-amber-100 text-amber-700',
};

const typeIcons = {
  discount: Percent,
  free_service: Gift,
  priority: Zap,
  cashback: Tag,
};

const typeLabels = {
  discount: 'Discount',
  free_service: 'Free Service',
  priority: 'Priority',
  cashback: 'Cashback',
};

const serviceIcons: Record<string, React.ReactNode> = {
  Consultation: <Stethoscope className="w-3 h-3" />,
  Lab: <FlaskConical className="w-3 h-3" />,
  Radiology: <Radio className="w-3 h-3" />,
  Pharmacy: <Pill className="w-3 h-3" />,
};

const types = ['All', 'discount', 'free_service', 'priority', 'cashback'];

export default function MembershipBenefitsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [benefits, setBenefits] = useState<Benefit[]>(mockBenefits);

  const filteredBenefits = useMemo(() => {
    return benefits.filter(benefit => {
      const matchesSearch = benefit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        benefit.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'All' || benefit.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [benefits, searchTerm, selectedType]);

  const toggleBenefitStatus = (id: string) => {
    setBenefits(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  const stats = useMemo(() => ({
    total: benefits.length,
    active: benefits.filter(b => b.isActive).length,
    byType: types.slice(1).map(t => ({
      type: t,
      count: benefits.filter(b => b.type === t).length,
    })),
  }), [benefits]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Benefits</h1>
            <p className="text-sm text-gray-500">Manage benefits catalog for membership plans</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Benefit
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Total Benefits:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          {stats.byType.map(({ type, count }) => {
            const Icon = typeIcons[type as keyof typeof typeIcons];
            return (
              <div key={type} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500 capitalize">{typeLabels[type as keyof typeof typeLabels]}:</span>
                <span className="font-semibold">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {types.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'All' ? 'All' : typeLabels[type as keyof typeof typeLabels]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Benefit Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Applicable Services</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Value</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Limits</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredBenefits.map(benefit => {
                const TypeIcon = typeIcons[benefit.type];
                return (
                  <tr key={benefit.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{benefit.code}</code>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{benefit.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${typeColors[benefit.type]}`}>
                        <TypeIcon className="w-3.5 h-3.5" />
                        {typeLabels[benefit.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {benefit.applicableServices.map((service, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                          >
                            {serviceIcons[service] || null}
                            {service}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {benefit.discountValue !== null ? (
                        <span className="font-medium text-green-600">
                          {benefit.isPercentage ? `${benefit.discountValue}%` : `KES ${benefit.discountValue}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {benefit.usageLimit && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Clock className="w-3 h-3" />
                            {benefit.usageLimit}x
                          </span>
                        )}
                        {benefit.validityDays && (
                          <span className="text-xs text-gray-500">{benefit.validityDays} days</span>
                        )}
                        {!benefit.usageLimit && !benefit.validityDays && (
                          <span className="text-xs text-green-600">Unlimited</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        benefit.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {benefit.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleBenefitStatus(benefit.id)}
                          className={`p-1.5 rounded ${
                            benefit.isActive
                              ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                          <MoreHorizontal className="w-4 h-4" />
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
    </div>
  );
}
