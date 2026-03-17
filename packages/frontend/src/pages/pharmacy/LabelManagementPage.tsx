import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Tags,
  Globe,
  Plus,
  FileText,
  Printer,
  Search,
  Loader2,
  Languages,
  X,
} from 'lucide-react';
import { pharmacyService, type DrugLabelTemplate, type CommonDrugTranslation } from '../../services/pharmacy';
import DrugLabelPreview from '../../components/pharmacy/DrugLabelPreview';

type Tab = 'templates' | 'translations' | 'generate';

export default function LabelManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('templates');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
    { key: 'translations', label: 'Drug Translations', icon: <Languages className="w-4 h-4" /> },
    { key: 'generate', label: 'Generate Label', icon: <Printer className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drug Label Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-language prescription labels and drug translations
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'templates' && <TemplatesTab />}
      {activeTab === 'translations' && <TranslationsTab />}
      {activeTab === 'generate' && <GenerateLabelTab />}
    </div>
  );
}

// ── Templates Tab ───────────────────────────────────────────────────────
function TemplatesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [langFilter, setLangFilter] = useState('');

  const { data: templates = [], isLoading } = useQuery<DrugLabelTemplate[]>({
    queryKey: ['label-templates', langFilter],
    queryFn: () => pharmacyService.labels.getTemplates(langFilter || undefined),
  });

  const createMutation = useMutation({
    mutationFn: pharmacyService.labels.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['label-templates'] });
      toast.success('Template created');
      setShowForm(false);
    },
    onError: () => toast.error('Failed to create template'),
  });

  const [form, setForm] = useState({
    name: '',
    language: 'en',
    labelType: 'prescription' as const,
    headerTemplate: '{{drugName}}',
    bodyTemplate: 'Dose: {{dose}} | Frequency: {{frequency}} | Duration: {{duration}}\nQty: {{quantity}}\n{{instructions}}',
    footerTemplate: 'Rx#: {{prescriptionNumber}} | Date: {{date}}',
    isDefault: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Filter by language:</label>
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="en">English</option>
            <option value="lg">Luganda</option>
            <option value="sw">Swahili</option>
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Create Template Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Create Template</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Template name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="lg">Luganda</option>
                <option value="sw">Swahili</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label Type</label>
              <select
                value={form.labelType}
                onChange={(e) => setForm({ ...form, labelType: e.target.value as any })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="prescription">Prescription</option>
                <option value="otc">OTC</option>
                <option value="controlled">Controlled</option>
                <option value="external_use">External Use</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">Set as default</label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Header Template <span className="text-gray-400">(use {'{{placeholders}}'})</span>
            </label>
            <input
              type="text"
              value={form.headerTemplate}
              onChange={(e) => setForm({ ...form, headerTemplate: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body Template</label>
            <textarea
              rows={3}
              value={form.bodyTemplate}
              onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer Template</label>
            <textarea
              rows={2}
              value={form.footerTemplate}
              onChange={(e) => setForm({ ...form, footerTemplate: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Tags className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No templates found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="bg-white border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{t.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {t.language === 'en' ? 'English' : t.language === 'lg' ? 'Luganda' : t.language === 'sw' ? 'Swahili' : t.language}
                  </span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                    {t.labelType}
                  </span>
                  {t.isDefault && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Default</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p><span className="font-medium">Header:</span> {t.headerTemplate}</p>
                <p><span className="font-medium">Body:</span> {t.bodyTemplate.substring(0, 80)}...</p>
                <p><span className="font-medium">Footer:</span> {t.footerTemplate}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Translations Tab ────────────────────────────────────────────────────
function TranslationsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [langFilter, setLangFilter] = useState('');

  const { data: translations = [], isLoading } = useQuery<CommonDrugTranslation[]>({
    queryKey: ['drug-translations', langFilter],
    queryFn: () => pharmacyService.labels.getTranslations(langFilter || undefined),
  });

  const createMutation = useMutation({
    mutationFn: pharmacyService.labels.createTranslation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-translations'] });
      toast.success('Translation added');
      setShowForm(false);
    },
    onError: () => toast.error('Failed to add translation'),
  });

  const [form, setForm] = useState({
    drugName: '',
    language: 'lg',
    translatedName: '',
    directions: '',
    warnings: '',
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Filter:</label>
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">All Languages</option>
            <option value="lg">Luganda</option>
            <option value="sw">Swahili</option>
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Translation
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Add Drug Translation</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name (English)</label>
              <input
                type="text"
                value={form.drugName}
                onChange={(e) => setForm({ ...form, drugName: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="e.g. Paracetamol"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                <option value="lg">Luganda</option>
                <option value="sw">Swahili</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Translated Name</label>
              <input
                type="text"
                value={form.translatedName}
                onChange={(e) => setForm({ ...form, translatedName: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Directions (translated)</label>
            <textarea
              rows={2}
              value={form.directions}
              onChange={(e) => setForm({ ...form, directions: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Mira ekyapa kimu emirundi esatu buli lunaku"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warnings (translated)</label>
            <textarea
              rows={2}
              value={form.warnings}
              onChange={(e) => setForm({ ...form, warnings: e.target.value })}
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="e.g. Kuma abaana baleme okukituuka"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md text-sm">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.drugName || !form.translatedName}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Adding...' : 'Add Translation'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : translations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>No translations found.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Translated Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Directions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Warnings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {translations.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.drugName}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
                      {t.language === 'lg' ? 'Luganda' : t.language === 'sw' ? 'Swahili' : t.language}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.translatedName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{t.directions || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{t.warnings || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Generate Label Tab ──────────────────────────────────────────────────
function GenerateLabelTab() {
  const [prescriptionItemId, setPrescriptionItemId] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Generate Prescription Label</h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Prescription Item ID</label>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={prescriptionItemId}
                onChange={(e) => setPrescriptionItemId(e.target.value)}
                className="flex-1 border rounded-md px-3 py-2 text-sm"
                placeholder="Enter or paste the prescription item UUID"
              />
            </div>
          </div>
          <button
            onClick={() => setShowPreview(true)}
            disabled={!prescriptionItemId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Generate
          </button>
        </div>
      </div>

      {showPreview && prescriptionItemId && (
        <div className="bg-white border rounded-lg p-6">
          <DrugLabelPreview
            prescriptionItemId={prescriptionItemId}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}
    </div>
  );
}
