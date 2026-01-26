import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Save,
  X,
  Receipt,
  FileText,
  Settings,
  AlertTriangle,
  Check,
  Percent,
  Building,
  ToggleLeft,
  ToggleRight,
  Download,
  Filter,
} from 'lucide-react';

interface TaxRate {
  id: string;
  name: string;
  code: string;
  rate: number;
  type: 'VAT' | 'Service Tax' | 'Excise' | 'Custom';
  applicableServices: string[];
  isActive: boolean;
  effectiveFrom: string;
}

interface TaxExemption {
  id: string;
  category: string;
  reason: string;
  applicableTaxes: string[];
  isActive: boolean;
}

const mockTaxRates: TaxRate[] = [
  { id: '1', name: 'Standard VAT', code: 'VAT16', rate: 16, type: 'VAT', applicableServices: ['Pharmacy', 'Medical Supplies'], isActive: true, effectiveFrom: '2024-01-01' },
  { id: '2', name: 'Healthcare VAT', code: 'VAT0', rate: 0, type: 'VAT', applicableServices: ['Medical Services', 'Consultation'], isActive: true, effectiveFrom: '2024-01-01' },
  { id: '3', name: 'Service Tax', code: 'SVC5', rate: 5, type: 'Service Tax', applicableServices: ['Administrative Services', 'Hospitality'], isActive: true, effectiveFrom: '2024-01-01' },
  { id: '4', name: 'Excise Duty', code: 'EXC10', rate: 10, type: 'Excise', applicableServices: ['Controlled Substances'], isActive: false, effectiveFrom: '2023-06-01' },
];

const mockExemptions: TaxExemption[] = [
  { id: '1', category: 'Emergency Services', reason: 'Life-threatening conditions exempt from all taxes', applicableTaxes: ['VAT16', 'SVC5'], isActive: true },
  { id: '2', category: 'Maternal & Child Health', reason: 'Government healthcare initiative', applicableTaxes: ['VAT16', 'SVC5'], isActive: true },
  { id: '3', category: 'NHIF Patients', reason: 'Insurance covers tax component', applicableTaxes: ['VAT16'], isActive: true },
  { id: '4', category: 'Charitable Cases', reason: 'Approved hardship cases', applicableTaxes: ['VAT16', 'SVC5', 'EXC10'], isActive: true },
];

const mockReportSettings = {
  reportFrequency: 'Monthly',
  submissionDeadline: '15th of following month',
  taxAuthority: 'Kenya Revenue Authority',
  registrationNumber: 'P051234567X',
  autoGenerateReports: true,
  emailNotifications: true,
};

export default function TaxConfigurationPage() {
  const [activeTab, setActiveTab] = useState<'rates' | 'exemptions' | 'settings'>('rates');
  const [searchTerm, setSearchTerm] = useState('');
  const [taxRates, setTaxRates] = useState<TaxRate[]>(mockTaxRates);
  const [exemptions, setExemptions] = useState<TaxExemption[]>(mockExemptions);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredTaxRates = useMemo(() => {
    return taxRates.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [taxRates, searchTerm]);

  const filteredExemptions = useMemo(() => {
    return exemptions.filter(e =>
      e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [exemptions, searchTerm]);

  const toggleTaxStatus = (id: string) => {
    setTaxRates(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const toggleExemptionStatus = (id: string) => {
    setExemptions(prev => prev.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  const stats = useMemo(() => ({
    totalRates: taxRates.length,
    activeRates: taxRates.filter(t => t.isActive).length,
    exemptions: exemptions.filter(e => e.isActive).length,
  }), [taxRates, exemptions]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Configuration</h1>
            <p className="text-sm text-gray-500">Manage tax rates, exemptions, and reporting</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export Config
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              {activeTab === 'rates' ? 'Add Tax Rate' : activeTab === 'exemptions' ? 'Add Exemption' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Tax Rates</div>
              <div className="text-xl font-bold text-gray-900">{stats.totalRates}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Rates</div>
              <div className="text-xl font-bold text-green-600">{stats.activeRates}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Exemptions</div>
              <div className="text-xl font-bold text-orange-600">{stats.exemptions}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          {[
            { id: 'rates', label: 'Tax Rates', icon: Percent },
            { id: 'exemptions', label: 'Exemptions', icon: AlertTriangle },
            { id: 'settings', label: 'Report Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search (for rates and exemptions) */}
      {activeTab !== 'settings' && (
        <div className="bg-white border-b px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'rates' ? 'Search tax rates...' : 'Search exemptions...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Tax Rates Tab */}
        {activeTab === 'rates' && (
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tax Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Applicable Services</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTaxRates.map(tax => (
                  <tr key={tax.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${
                          tax.rate === 0 ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          <Percent className={`w-4 h-4 ${
                            tax.rate === 0 ? 'text-green-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <span className="font-medium text-gray-900">{tax.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{tax.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-full text-sm">
                        {tax.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === tax.id ? (
                        <input
                          type="number"
                          defaultValue={tax.rate}
                          className="w-20 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className={`font-bold text-lg ${
                          tax.rate === 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {tax.rate}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tax.applicableServices.map((service, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                            {service}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        tax.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tax.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === tax.id ? (
                          <>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingId(tax.id)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleTaxStatus(tax.id)}
                              className={`p-1.5 rounded ${
                                tax.isActive
                                  ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                  : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {tax.isActive ? (
                                <ToggleRight className="w-4 h-4" />
                              ) : (
                                <ToggleLeft className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Exemptions Tab */}
        {activeTab === 'exemptions' && (
          <div className="grid grid-cols-2 gap-4">
            {filteredExemptions.map(exemption => (
              <div key={exemption.id} className={`bg-white rounded-lg border p-4 ${
                !exemption.isActive ? 'opacity-60' : ''
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{exemption.category}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        exemption.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {exemption.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleExemptionStatus(exemption.id)}
                      className={`p-1.5 rounded ${
                        exemption.isActive
                          ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                          : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {exemption.isActive ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">{exemption.reason}</p>

                <div>
                  <span className="text-xs text-gray-500">Exempt from:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {exemption.applicableTaxes.map((tax, idx) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {tax}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-gray-500" />
                  Tax Authority Information
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Authority</label>
                    <input
                      type="text"
                      defaultValue={mockReportSettings.taxAuthority}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                    <input
                      type="text"
                      defaultValue={mockReportSettings.registrationNumber}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border mt-4">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  Report Settings
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Report Frequency</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Annually</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Submission Deadline</label>
                    <input
                      type="text"
                      defaultValue={mockReportSettings.submissionDeadline}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">Auto-generate Reports</div>
                    <div className="text-sm text-gray-500">Automatically generate tax reports on schedule</div>
                  </div>
                  <button className={`p-1 rounded-full ${
                    mockReportSettings.autoGenerateReports ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {mockReportSettings.autoGenerateReports ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">Email Notifications</div>
                    <div className="text-sm text-gray-500">Receive email alerts for tax deadlines</div>
                  </div>
                  <button className={`p-1 rounded-full ${
                    mockReportSettings.emailNotifications ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {mockReportSettings.emailNotifications ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="flex items-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
