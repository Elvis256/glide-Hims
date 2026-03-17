import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Star,
  Search,
  Filter,
  Trash2,
  Edit2,
  Copy,
  TrendingUp,
  X,
  Loader2,
  Building,
  User,
  Users,
} from 'lucide-react';
import { prescriptionsService, type RxTemplate, type RxTemplateItem, type CreateRxTemplateDto } from '../../services/prescriptions';
import { toast } from 'sonner';

type ScopeFilter = 'all' | 'personal' | 'department' | 'facility';

const SCOPE_BADGES: Record<string, { label: string; className: string; icon: typeof User }> = {
  personal: { label: 'Personal', className: 'bg-blue-100 text-blue-700', icon: User },
  department: { label: 'Department', className: 'bg-purple-100 text-purple-700', icon: Users },
  facility: { label: 'Facility', className: 'bg-green-100 text-green-700', icon: Building },
};

const EMPTY_ITEM: RxTemplateItem = {
  drugName: '',
  genericName: '',
  dose: '',
  frequency: '',
  duration: '',
  route: '',
  quantity: 1,
  instructions: '',
};

export default function PrescriptionTemplatesPage() {
  const queryClient = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [conditionSearch, setConditionSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RxTemplate | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCondition, setFormCondition] = useState('');
  const [formDepartment, setFormDepartment] = useState('');
  const [formScope, setFormScope] = useState<'personal' | 'department' | 'facility'>('personal');
  const [formItems, setFormItems] = useState<RxTemplateItem[]>([{ ...EMPTY_ITEM }]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['rx-templates', scopeFilter, conditionSearch, departmentFilter],
    queryFn: () =>
      prescriptionsService.getTemplates({
        scope: scopeFilter === 'all' ? undefined : scopeFilter,
        condition: conditionSearch || undefined,
        department: departmentFilter || undefined,
      }),
  });

  const { data: popularTemplates = [] } = useQuery({
    queryKey: ['rx-templates-popular'],
    queryFn: () => prescriptionsService.getPopularTemplates(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRxTemplateDto) => prescriptionsService.createTemplate(data),
    onSuccess: () => {
      toast.success('Template created successfully');
      queryClient.invalidateQueries({ queryKey: ['rx-templates'] });
      resetForm();
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateRxTemplateDto> }) =>
      prescriptionsService.updateTemplate(id, data),
    onSuccess: () => {
      toast.success('Template updated');
      queryClient.invalidateQueries({ queryKey: ['rx-templates'] });
      resetForm();
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => prescriptionsService.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['rx-templates'] });
    },
    onError: () => toast.error('Failed to delete template'),
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => prescriptionsService.applyTemplate(id),
    onSuccess: (data) => {
      toast.success(`Template applied — ${data.items.length} item(s) copied`);
      queryClient.invalidateQueries({ queryKey: ['rx-templates'] });
    },
    onError: () => toast.error('Failed to apply template'),
  });

  function resetForm() {
    setShowCreateForm(false);
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormCondition('');
    setFormDepartment('');
    setFormScope('personal');
    setFormItems([{ ...EMPTY_ITEM }]);
  }

  function openEdit(t: RxTemplate) {
    setEditingTemplate(t);
    setShowCreateForm(true);
    setFormName(t.name);
    setFormDescription(t.description || '');
    setFormCondition(t.condition || '');
    setFormDepartment(t.department || '');
    setFormScope(t.scope);
    setFormItems(t.items.length > 0 ? t.items : [{ ...EMPTY_ITEM }]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = formItems.filter((i) => i.drugName.trim());
    if (!formName.trim() || validItems.length === 0) {
      toast.error('Name and at least one drug item are required');
      return;
    }
    const payload: CreateRxTemplateDto = {
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      condition: formCondition.trim() || undefined,
      department: formDepartment.trim() || undefined,
      scope: formScope,
      items: validItems,
    };
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addItem() {
    setFormItems([...formItems, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setFormItems(formItems.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof RxTemplateItem, value: string | number) {
    const updated = [...formItems];
    (updated[idx] as any)[field] = value;
    setFormItems(updated);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prescription Templates</h1>
          <p className="text-gray-500 mt-1">Create and manage reusable prescription templates</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowCreateForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {/* Popular Templates */}
      {popularTemplates.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
          <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" /> Popular Templates
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {popularTemplates.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => applyMutation.mutate(t.id)}
                className="flex-shrink-0 bg-white rounded-lg px-4 py-2 border border-amber-200 hover:border-amber-400 text-left min-w-[200px]"
              >
                <div className="font-medium text-sm text-gray-900 truncate">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {t.condition && <span>{t.condition} · </span>}
                  {t.items.length} item(s) · Used {t.usageCount}×
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['all', 'personal', 'department', 'facility'] as ScopeFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setScopeFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                scopeFilter === s ? 'bg-white shadow font-medium text-gray-900' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search condition..."
            value={conditionSearch}
            onChange={(e) => setConditionSearch(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Department..."
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="pl-9 pr-3 py-2 border rounded-lg text-sm w-48"
          />
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 mb-10">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Edit Template' : 'New Prescription Template'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Malaria Standard Treatment"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <input
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Malaria, UTI"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <input
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Internal Medicine"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="personal">Personal (only me)</option>
                    <option value="department">Department (shared)</option>
                    <option value="facility">Facility (everyone)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Template Items *</label>
                  <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="border rounded-lg p-3 bg-gray-50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-500">Item {idx + 1}</span>
                        {formItems.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <input
                          placeholder="Drug Name *"
                          value={item.drugName}
                          onChange={(e) => updateItem(idx, 'drugName', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm col-span-2"
                        />
                        <input
                          placeholder="Generic Name"
                          value={item.genericName || ''}
                          onChange={(e) => updateItem(idx, 'genericName', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm col-span-2"
                        />
                        <input
                          placeholder="Dose (e.g. 500mg)"
                          value={item.dose}
                          onChange={(e) => updateItem(idx, 'dose', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm"
                        />
                        <input
                          placeholder="Frequency (e.g. TDS)"
                          value={item.frequency}
                          onChange={(e) => updateItem(idx, 'frequency', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm"
                        />
                        <input
                          placeholder="Duration (e.g. 5 days)"
                          value={item.duration}
                          onChange={(e) => updateItem(idx, 'duration', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm"
                        />
                        <input
                          placeholder="Route (e.g. PO)"
                          value={item.route || ''}
                          onChange={(e) => updateItem(idx, 'route', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                          className="border rounded px-2 py-1.5 text-sm"
                          min={1}
                        />
                        <input
                          placeholder="Instructions"
                          value={item.instructions || ''}
                          onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                          className="border rounded px-2 py-1.5 text-sm col-span-3"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin inline mr-1" />}
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No templates found</p>
          <p className="text-sm mt-1">Create a template to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const badge = SCOPE_BADGES[t.scope] || SCOPE_BADGES.personal;
            const BadgeIcon = badge.icon;
            return (
              <div key={t.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition group">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 truncate pr-2">{t.name}</h3>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {badge.label}
                  </span>
                </div>

                {t.condition && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Condition:</span> {t.condition}
                  </p>
                )}
                {t.department && (
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-medium">Dept:</span> {t.department}
                  </p>
                )}
                {t.description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2">{t.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span>{t.items.length} item(s)</span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3" /> {t.usageCount} uses
                  </span>
                </div>

                {/* Item preview */}
                <div className="space-y-1 mb-3">
                  {t.items.slice(0, 3).map((item, i) => (
                    <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1 truncate">
                      {item.drugName} — {item.dose} {item.frequency} × {item.duration}
                    </div>
                  ))}
                  {t.items.length > 3 && (
                    <div className="text-xs text-gray-400">+{t.items.length - 3} more</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => applyMutation.mutate(t.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                  >
                    <Copy className="w-3 h-3" /> Apply
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-100"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this template?')) deleteMutation.mutate(t.id);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
