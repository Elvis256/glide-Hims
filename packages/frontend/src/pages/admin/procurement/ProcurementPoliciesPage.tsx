import { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Search,
  Shield,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileCheck,
  Users,
  Clock,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';

interface Policy {
  id: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  rules: PolicyRule[];
  exceptions: PolicyException[];
  lastUpdated: string;
  updatedBy: string;
}

interface PolicyRule {
  id: string;
  type: 'quotation' | 'vendor' | 'documentation' | 'approval' | 'limit';
  description: string;
  value: string | number;
  isRequired: boolean;
}

interface PolicyException {
  id: string;
  name: string;
  condition: string;
  override: string;
  validUntil: string;
  approvedBy: string;
}

const mockPolicies: Policy[] = [
  {
    id: '1',
    name: 'Standard Procurement Policy',
    category: 'General',
    description: 'Default procurement rules for all purchases',
    isActive: true,
    lastUpdated: '2024-01-15',
    updatedBy: 'Admin',
    rules: [
      { id: 'r1', type: 'quotation', description: 'Minimum quotations required', value: 3, isRequired: true },
      { id: 'r2', type: 'vendor', description: 'Preferred vendor priority', value: 'Must check preferred vendors first', isRequired: true },
      { id: 'r3', type: 'documentation', description: 'Purchase justification required', value: 'Above KES 10,000', isRequired: true },
      { id: 'r4', type: 'limit', description: 'Single transaction limit', value: 500000, isRequired: true },
    ],
    exceptions: [
      { id: 'e1', name: 'Emergency Medical Supplies', condition: 'Life-threatening situations', override: 'Single quotation allowed', validUntil: 'Ongoing', approvedBy: 'Medical Director' },
    ],
  },
  {
    id: '2',
    name: 'Emergency Purchase Policy',
    category: 'Emergency',
    description: 'Fast-track rules for urgent and emergency purchases',
    isActive: true,
    lastUpdated: '2024-01-10',
    updatedBy: 'Admin',
    rules: [
      { id: 'r5', type: 'quotation', description: 'Minimum quotations required', value: 1, isRequired: true },
      { id: 'r6', type: 'documentation', description: 'Emergency justification form', value: 'Always required', isRequired: true },
      { id: 'r7', type: 'approval', description: 'Duty manager approval', value: 'Required within 24 hours', isRequired: true },
      { id: 'r8', type: 'limit', description: 'Emergency purchase limit', value: 100000, isRequired: true },
    ],
    exceptions: [],
  },
  {
    id: '3',
    name: 'Capital Equipment Policy',
    category: 'Capital',
    description: 'Rules for capital equipment and high-value purchases',
    isActive: true,
    lastUpdated: '2024-01-05',
    updatedBy: 'Finance',
    rules: [
      { id: 'r9', type: 'quotation', description: 'Minimum quotations required', value: 5, isRequired: true },
      { id: 'r10', type: 'vendor', description: 'Certified vendor requirement', value: 'Must be ISO certified', isRequired: true },
      { id: 'r11', type: 'documentation', description: 'Business case required', value: 'Always required', isRequired: true },
      { id: 'r12', type: 'documentation', description: 'Technical evaluation report', value: 'Above KES 500,000', isRequired: true },
      { id: 'r13', type: 'approval', description: 'Board approval', value: 'Above KES 5,000,000', isRequired: true },
    ],
    exceptions: [],
  },
  {
    id: '4',
    name: 'Pharmaceutical Procurement',
    category: 'Pharmacy',
    description: 'Specialized rules for pharmaceutical purchases',
    isActive: true,
    lastUpdated: '2024-01-20',
    updatedBy: 'Pharmacy Head',
    rules: [
      { id: 'r14', type: 'vendor', description: 'Licensed pharmaceutical suppliers only', value: 'PPB registration required', isRequired: true },
      { id: 'r15', type: 'documentation', description: 'Batch documentation', value: 'Always required', isRequired: true },
      { id: 'r16', type: 'documentation', description: 'Quality certificates', value: 'COA for each batch', isRequired: true },
      { id: 'r17', type: 'limit', description: 'Stock level trigger', value: 'Reorder at 20% stock', isRequired: false },
    ],
    exceptions: [
      { id: 'e2', name: 'Controlled Substances', condition: 'Schedule drugs', override: 'Additional DEA documentation', validUntil: 'Ongoing', approvedBy: 'Pharmacy Head' },
    ],
  },
];

const documentRequirements = [
  { id: '1', name: 'Purchase Requisition Form', mandatory: true, threshold: 0 },
  { id: '2', name: 'Quotation Comparison Sheet', mandatory: true, threshold: 10000 },
  { id: '3', name: 'Vendor Evaluation Form', mandatory: true, threshold: 50000 },
  { id: '4', name: 'Purchase Order', mandatory: true, threshold: 0 },
  { id: '5', name: 'Goods Received Note', mandatory: true, threshold: 0 },
  { id: '6', name: 'Quality Inspection Report', mandatory: false, threshold: 100000 },
  { id: '7', name: 'Technical Specifications', mandatory: true, threshold: 200000 },
  { id: '8', name: 'Business Case Document', mandatory: true, threshold: 500000 },
];

export default function ProcurementPoliciesPage() {
  const [policies, setPolicies] = useState(mockPolicies);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(mockPolicies[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['rules', 'exceptions', 'documents']);
  const [activeTab, setActiveTab] = useState<'policies' | 'documents'>('policies');

  const filteredPolicies = useMemo(() => {
    return policies.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [policies, searchTerm]);

  const stats = useMemo(() => ({
    totalPolicies: policies.length,
    activePolicies: policies.filter(p => p.isActive).length,
    totalRules: policies.reduce((sum, p) => sum + p.rules.length, 0),
    totalExceptions: policies.reduce((sum, p) => sum + p.exceptions.length, 0),
  }), [policies]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  const togglePolicy = (id: string) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
    if (selectedPolicy?.id === id) {
      setSelectedPolicy(prev => prev ? { ...prev, isActive: !prev.isActive } : prev);
    }
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'quotation': return FileCheck;
      case 'vendor': return Users;
      case 'documentation': return FileText;
      case 'approval': return CheckCircle2;
      case 'limit': return AlertCircle;
      default: return Info;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Procurement Policies</h1>
              <p className="text-sm text-gray-500">Configure procurement rules and compliance requirements</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            <Plus className="w-4 h-4" />
            New Policy
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Policies</div>
            <div className="text-xl font-bold text-gray-900">{stats.totalPolicies}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-green-600">Active Policies</div>
            <div className="text-xl font-bold text-green-700">{stats.activePolicies}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">Total Rules</div>
            <div className="text-xl font-bold text-blue-700">{stats.totalRules}</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              Active Exceptions
            </div>
            <div className="text-xl font-bold text-amber-700">{stats.totalExceptions}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('policies')}
            className={`py-3 border-b-2 text-sm font-medium ${
              activeTab === 'policies'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Policy Rules
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 border-b-2 text-sm font-medium ${
              activeTab === 'documents'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Documentation Requirements
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'policies' ? (
          <>
            {/* Policies List */}
            <div className="w-80 bg-white border-r flex flex-col">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search policies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {filteredPolicies.map(policy => (
                  <button
                    key={policy.id}
                    onClick={() => setSelectedPolicy(policy)}
                    className={`w-full p-4 text-left border-b hover:bg-gray-50 ${
                      selectedPolicy?.id === policy.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">{policy.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        policy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{policy.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{policy.category}</span>
                      <span>•</span>
                      <span>{policy.rules.length} rules</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Policy Details */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedPolicy ? (
                <>
                  <div className="p-6 border-b bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-semibold text-gray-900">{selectedPolicy.name}</h2>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            selectedPolicy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {selectedPolicy.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{selectedPolicy.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePolicy(selectedPolicy.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                          title={selectedPolicy.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {selectedPolicy.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded-lg">
                          <Edit2 className="w-5 h-5 text-gray-500" />
                        </button>
                        <button className="p-2 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-5 h-5 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        Updated {selectedPolicy.lastUpdated}
                      </span>
                      <span>by {selectedPolicy.updatedBy}</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Rules Section */}
                    <div className="bg-white rounded-lg border">
                      <button
                        onClick={() => toggleSection('rules')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          {expandedSections.includes('rules') ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <h3 className="font-semibold text-gray-900">Policy Rules</h3>
                          <span className="text-sm text-gray-500">({selectedPolicy.rules.length})</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          + Add Rule
                        </button>
                      </button>
                      {expandedSections.includes('rules') && (
                        <div className="border-t divide-y">
                          {selectedPolicy.rules.map(rule => {
                            const Icon = getRuleIcon(rule.type);
                            return (
                              <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${
                                    rule.type === 'quotation' ? 'bg-blue-100 text-blue-600' :
                                    rule.type === 'vendor' ? 'bg-purple-100 text-purple-600' :
                                    rule.type === 'documentation' ? 'bg-green-100 text-green-600' :
                                    rule.type === 'approval' ? 'bg-amber-100 text-amber-600' :
                                    'bg-red-100 text-red-600'
                                  }`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{rule.description}</div>
                                    <div className="text-sm text-gray-500">
                                      {typeof rule.value === 'number' ? (
                                        rule.type === 'quotation' ? `${rule.value} quotations` : `KES ${rule.value.toLocaleString()}`
                                      ) : rule.value}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {rule.isRequired && (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Required</span>
                                  )}
                                  <button className="p-1.5 hover:bg-gray-100 rounded">
                                    <Edit2 className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Exceptions Section */}
                    <div className="bg-white rounded-lg border">
                      <button
                        onClick={() => toggleSection('exceptions')}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          {expandedSections.includes('exceptions') ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                          <h3 className="font-semibold text-gray-900">Emergency Exceptions</h3>
                          <span className="text-sm text-gray-500">({selectedPolicy.exceptions.length})</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          + Add Exception
                        </button>
                      </button>
                      {expandedSections.includes('exceptions') && (
                        <div className="border-t">
                          {selectedPolicy.exceptions.length > 0 ? (
                            <div className="divide-y">
                              {selectedPolicy.exceptions.map(exception => (
                                <div key={exception.id} className="p-4 hover:bg-gray-50">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{exception.name}</span>
                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                      {exception.validUntil}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-500">Condition:</span>
                                      <span className="ml-2 text-gray-700">{exception.condition}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Override:</span>
                                      <span className="ml-2 text-gray-700">{exception.override}</span>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-2">
                                    Approved by {exception.approvedBy}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-gray-500">
                              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                              <p>No exceptions defined for this policy</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a policy to view details
                </div>
              )}
            </div>
          </>
        ) : (
          /* Documentation Requirements Tab */
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Documentation Requirements</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200">
                  <Plus className="w-4 h-4" />
                  Add Requirement
                </button>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Document</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mandatory</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Threshold</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documentRequirements.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {doc.mandatory ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {doc.threshold > 0 ? `Above KES ${doc.threshold.toLocaleString()}` : 'All purchases'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button className="p-1.5 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-1.5 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}