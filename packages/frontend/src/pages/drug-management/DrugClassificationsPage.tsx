import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Filter,
  ChevronDown,
  Loader2,
  AlertTriangle,
  Shield,
  FileText,
  Check,
  X,
  Lock,
  Beaker,
} from 'lucide-react';

interface DrugClassification {
  id: string;
  itemId: string;
  drugName: string;
  genericName: string;
  schedule: 'OTC' | 'PRESCRIPTION_ONLY' | 'SCHEDULE_II' | 'SCHEDULE_III' | 'SCHEDULE_IV' | 'SCHEDULE_V';
  therapeuticClass: string;
  isControlled: boolean;
  isNarcotic: boolean;
  highAlert: boolean;
  isOnFormulary: boolean;
  maxDailyDose?: string;
  contraindications: string[];
  warnings: string[];
  createdAt: string;
}

// Data - will be populated from API
const mockClassifications: DrugClassification[] = [];

const schedules = ['All', 'OTC', 'PRESCRIPTION_ONLY', 'SCHEDULE_II', 'SCHEDULE_III', 'SCHEDULE_IV', 'SCHEDULE_V'];
const therapeuticClasses = ['All', 'ANALGESIC', 'OPIOID_ANALGESIC', 'ANTICOAGULANT', 'BENZODIAZEPINE', 'ANTIBIOTIC', 'ANTIHYPERTENSIVE', 'ANTIDIABETIC'];

export default function DrugClassificationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState('All');
  const [selectedClass, setSelectedClass] = useState('All');
  const [showControlledOnly, setShowControlledOnly] = useState(false);
  const [showHighAlertOnly, setShowHighAlertOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDrug, setEditingDrug] = useState<DrugClassification | null>(null);
  const [showScheduleDropdown, setShowScheduleDropdown] = useState(false);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  const { data: classifications, isLoading } = useQuery({
    queryKey: ['drug-classifications'],
    queryFn: async () => mockClassifications,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<DrugClassification>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-classifications'] });
      setShowAddModal(false);
      setEditingDrug(null);
    },
  });

  const items = classifications || [];

  const filteredDrugs = items.filter((drug) => {
    const matchesSearch = 
      drug.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drug.genericName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchedule = selectedSchedule === 'All' || drug.schedule === selectedSchedule;
    const matchesClass = selectedClass === 'All' || drug.therapeuticClass === selectedClass;
    const matchesControlled = !showControlledOnly || drug.isControlled;
    const matchesHighAlert = !showHighAlertOnly || drug.highAlert;
    return matchesSearch && matchesSchedule && matchesClass && matchesControlled && matchesHighAlert;
  });

  const getScheduleColor = (schedule: string) => {
    switch (schedule) {
      case 'OTC': return 'bg-green-100 text-green-700';
      case 'PRESCRIPTION_ONLY': return 'bg-blue-100 text-blue-700';
      case 'SCHEDULE_II': return 'bg-red-100 text-red-700';
      case 'SCHEDULE_III': return 'bg-orange-100 text-orange-700';
      case 'SCHEDULE_IV': return 'bg-yellow-100 text-yellow-700';
      case 'SCHEDULE_V': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const controlledCount = items.filter(d => d.isControlled).length;
  const narcoticCount = items.filter(d => d.isNarcotic).length;
  const highAlertCount = items.filter(d => d.highAlert).length;
  const formularyCount = items.filter(d => d.isOnFormulary).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drug Classifications</h1>
          <p className="text-gray-600">Manage drug schedules, therapeutic classes, and safety flags</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Classification
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Controlled</p>
              <p className="text-xl font-bold text-red-600">{controlledCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Narcotics</p>
              <p className="text-xl font-bold text-purple-600">{narcoticCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">High Alert</p>
              <p className="text-xl font-bold text-orange-600">{highAlertCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">On Formulary</p>
              <p className="text-xl font-bold text-green-600">{formularyCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drugs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowScheduleDropdown(!showScheduleDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Schedule: {selectedSchedule}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showScheduleDropdown && (
              <div className="absolute top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                {schedules.map((schedule) => (
                  <button
                    key={schedule}
                    onClick={() => {
                      setSelectedSchedule(schedule);
                      setShowScheduleDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {schedule.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setShowClassDropdown(!showClassDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Class: {selectedClass}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showClassDropdown && (
              <div className="absolute top-full mt-1 w-56 bg-white border rounded-lg shadow-lg z-10">
                {therapeuticClasses.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => {
                      setSelectedClass(cls);
                      setShowClassDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {cls.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showControlledOnly}
              onChange={(e) => setShowControlledOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Controlled Only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showHighAlertOnly}
              onChange={(e) => setShowHighAlertOnly(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">High Alert Only</span>
          </label>
        </div>
      </div>

      {/* Classifications Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Drug</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Schedule</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Therapeutic Class</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Flags</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Max Daily</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Formulary</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDrugs.map((drug) => (
              <tr key={drug.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Pill className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{drug.drugName}</p>
                      <p className="text-xs text-gray-500">{drug.genericName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getScheduleColor(drug.schedule)}`}>
                    {drug.schedule.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{drug.therapeuticClass.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {drug.isControlled && (
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs" title="Controlled">
                        <Lock className="w-3 h-3 inline" />
                      </span>
                    )}
                    {drug.isNarcotic && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs" title="Narcotic">
                        N
                      </span>
                    )}
                    {drug.highAlert && (
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs" title="High Alert">
                        <AlertTriangle className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{drug.maxDailyDose || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  {drug.isOnFormulary ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-400" />
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditingDrug(drug)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredDrugs.length === 0 && (
          <div className="text-center py-12">
            <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No drug classifications found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingDrug) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingDrug ? 'Edit Classification' : 'Add Classification'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDrug(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name</label>
                <input
                  type="text"
                  defaultValue={editingDrug?.drugName}
                  placeholder="e.g., Paracetamol 500mg"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Generic Name</label>
                <input
                  type="text"
                  defaultValue={editingDrug?.genericName}
                  placeholder="e.g., Acetaminophen"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schedule</label>
                  <select 
                    defaultValue={editingDrug?.schedule}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {schedules.filter(s => s !== 'All').map(schedule => (
                      <option key={schedule} value={schedule}>{schedule.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Therapeutic Class</label>
                  <select 
                    defaultValue={editingDrug?.therapeuticClass}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {therapeuticClasses.filter(c => c !== 'All').map(cls => (
                      <option key={cls} value={cls}>{cls.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Daily Dose</label>
                <input
                  type="text"
                  defaultValue={editingDrug?.maxDailyDose}
                  placeholder="e.g., 4g"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={editingDrug?.isControlled}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Controlled Substance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={editingDrug?.isNarcotic}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Narcotic</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={editingDrug?.highAlert}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">High Alert Medication</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={editingDrug?.isOnFormulary}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">On Formulary</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraindications</label>
                <textarea
                  rows={2}
                  defaultValue={editingDrug?.contraindications.join(', ')}
                  placeholder="Comma-separated list"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warnings</label>
                <textarea
                  rows={2}
                  defaultValue={editingDrug?.warnings.join(', ')}
                  placeholder="Comma-separated list"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingDrug(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate({})}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingDrug ? 'Save Changes' : 'Add Classification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
