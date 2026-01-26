import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Download,
  Filter,
  FileText,
  Clock,
  Calendar,
  AlertTriangle,
  Ban,
  Award,
  Settings,
  MoreHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';

interface MembershipRule {
  id: string;
  code: string;
  name: string;
  category: 'enrollment' | 'renewal' | 'grace_period' | 'suspension' | 'cancellation' | 'loyalty';
  description: string;
  value: string;
  unit: string | null;
  applicablePlans: string[];
  isActive: boolean;
  priority: number;
}

const mockRules: MembershipRule[] = [
  {
    id: '1',
    code: 'ENR001',
    name: 'Minimum Age Requirement',
    category: 'enrollment',
    description: 'Minimum age for primary membership enrollment',
    value: '18',
    unit: 'years',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 1,
  },
  {
    id: '2',
    code: 'ENR002',
    name: 'Waiting Period',
    category: 'enrollment',
    description: 'Waiting period before benefits become active',
    value: '30',
    unit: 'days',
    applicablePlans: ['Basic Care', 'Silver Health'],
    isActive: true,
    priority: 2,
  },
  {
    id: '3',
    code: 'REN001',
    name: 'Auto-Renewal',
    category: 'renewal',
    description: 'Automatic renewal for annual memberships',
    value: 'Enabled',
    unit: null,
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 1,
  },
  {
    id: '4',
    code: 'REN002',
    name: 'Renewal Notice Period',
    category: 'renewal',
    description: 'Days before expiry to send renewal reminder',
    value: '30',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 2,
  },
  {
    id: '5',
    code: 'GRC001',
    name: 'Payment Grace Period',
    category: 'grace_period',
    description: 'Grace period for payment after due date',
    value: '15',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 1,
  },
  {
    id: '6',
    code: 'GRC002',
    name: 'Benefit Access During Grace',
    category: 'grace_period',
    description: 'Allow benefit access during grace period',
    value: 'Limited',
    unit: null,
    applicablePlans: ['Basic Care', 'Silver Health'],
    isActive: true,
    priority: 2,
  },
  {
    id: '7',
    code: 'SUS001',
    name: 'Auto-Suspension Trigger',
    category: 'suspension',
    description: 'Days overdue before automatic suspension',
    value: '45',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 1,
  },
  {
    id: '8',
    code: 'SUS002',
    name: 'Suspension Duration Limit',
    category: 'suspension',
    description: 'Maximum suspension duration before cancellation',
    value: '90',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 2,
  },
  {
    id: '9',
    code: 'CAN001',
    name: 'Cancellation Notice Period',
    category: 'cancellation',
    description: 'Required notice period for member-initiated cancellation',
    value: '30',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 1,
  },
  {
    id: '10',
    code: 'CAN002',
    name: 'Refund Policy',
    category: 'cancellation',
    description: 'Refund calculation method for early cancellation',
    value: 'Pro-rata',
    unit: null,
    applicablePlans: ['Annual Plans'],
    isActive: true,
    priority: 2,
  },
  {
    id: '11',
    code: 'LOY001',
    name: 'Points Per KES Spent',
    category: 'loyalty',
    description: 'Loyalty points earned per KES 100 spent',
    value: '1',
    unit: 'points',
    applicablePlans: ['Silver Health', 'Gold Premium', 'Platinum Elite'],
    isActive: true,
    priority: 1,
  },
  {
    id: '12',
    code: 'LOY002',
    name: 'Points Expiry',
    category: 'loyalty',
    description: 'Loyalty points validity period',
    value: '365',
    unit: 'days',
    applicablePlans: ['All Plans'],
    isActive: true,
    priority: 2,
  },
  {
    id: '13',
    code: 'LOY003',
    name: 'Points Redemption Minimum',
    category: 'loyalty',
    description: 'Minimum points required for redemption',
    value: '500',
    unit: 'points',
    applicablePlans: ['All Plans'],
    isActive: false,
    priority: 3,
  },
];

const categoryColors = {
  enrollment: 'bg-blue-100 text-blue-700',
  renewal: 'bg-green-100 text-green-700',
  grace_period: 'bg-yellow-100 text-yellow-700',
  suspension: 'bg-orange-100 text-orange-700',
  cancellation: 'bg-red-100 text-red-700',
  loyalty: 'bg-purple-100 text-purple-700',
};

const categoryIcons = {
  enrollment: FileText,
  renewal: Calendar,
  grace_period: Clock,
  suspension: AlertTriangle,
  cancellation: Ban,
  loyalty: Award,
};

const categoryLabels = {
  enrollment: 'Enrollment',
  renewal: 'Renewal',
  grace_period: 'Grace Period',
  suspension: 'Suspension',
  cancellation: 'Cancellation',
  loyalty: 'Loyalty',
};

const categories = ['All', 'enrollment', 'renewal', 'grace_period', 'suspension', 'cancellation', 'loyalty'];

export default function MembershipRulesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [rules, setRules] = useState<MembershipRule[]>(mockRules);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || rule.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [rules, searchTerm, selectedCategory]);

  const groupedRules = useMemo(() => {
    const groups: Record<string, MembershipRule[]> = {};
    filteredRules.forEach(rule => {
      if (!groups[rule.category]) {
        groups[rule.category] = [];
      }
      groups[rule.category].push(rule);
    });
    return groups;
  }, [filteredRules]);

  const toggleRuleStatus = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter(r => r.isActive).length,
    byCategory: Object.entries(categoryLabels).map(([key, label]) => ({
      category: key,
      label,
      count: rules.filter(r => r.category === key).length,
    })),
  }), [rules]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Rules</h1>
            <p className="text-sm text-gray-500">Configure enrollment, renewal, and loyalty policies</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Rules:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          {stats.byCategory.slice(0, 4).map(({ category, label, count }) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            return (
              <div key={category} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{label}:</span>
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
              placeholder="Search rules by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500" />
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat === 'All' ? 'All' : categoryLabels[cat as keyof typeof categoryLabels]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-4">
          {Object.entries(groupedRules).map(([category, categoryRules]) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            const isExpanded = expandedCategory === category || selectedCategory !== 'All';
            
            return (
              <div key={category} className="bg-white rounded-lg border">
                <button
                  onClick={() => setExpandedCategory(isExpanded && selectedCategory === 'All' ? null : category)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${categoryColors[category as keyof typeof categoryColors]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">
                        {categoryLabels[category as keyof typeof categoryLabels]} Rules
                      </h3>
                      <p className="text-xs text-gray-500">{categoryRules.length} rules configured</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                
                {isExpanded && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Code</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Rule Name</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Value</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Applies To</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {categoryRules.sort((a, b) => a.priority - b.priority).map(rule => (
                          <tr key={rule.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{rule.code}</code>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-sm text-gray-600">
                                <span className="truncate max-w-xs">{rule.description}</span>
                                <button className="text-gray-400 hover:text-gray-600">
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-gray-900">
                                {rule.value}
                                {rule.unit && <span className="text-gray-500 font-normal ml-1">{rule.unit}</span>}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {rule.applicablePlans.slice(0, 2).map((plan, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600"
                                  >
                                    {plan}
                                  </span>
                                ))}
                                {rule.applicablePlans.length > 2 && (
                                  <span className="text-xs text-blue-600">+{rule.applicablePlans.length - 2}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => toggleRuleStatus(rule.id)}
                                  className={`p-1.5 rounded ${
                                    rule.isActive
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}