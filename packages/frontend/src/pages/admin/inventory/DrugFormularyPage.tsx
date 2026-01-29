import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { pharmacyService, type DrugClassification } from '../../../services';

interface DrugFormularyItem {
  id: string;
  drugName: string;
  genericName: string;
  brandName: string;
  category: string;
  strength: string;
  dosageForm: string;
  isControlled: boolean;
  controlSchedule?: string;
  formularyStatus: 'approved' | 'restricted' | 'not-approved';
  restrictionNotes?: string;
  lastReviewed: string;
}

const categories = [
  'All Categories',
  'Antibiotics',
  'Analgesics - Opioid',
  'Antidiabetics',
  'Anxiolytics',
  'Proton Pump Inhibitors',
  'Statins',
  'Anesthetics',
  'ACE Inhibitors',
];

export default function DrugFormularyPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [controlledFilter, setControlledFilter] = useState<string>('all');

  // Fetch drug formulary from API
  const { data: apiDrugs, isLoading } = useQuery({
    queryKey: ['drug-formulary'],
    queryFn: () => pharmacyService.drugs.listClassifications(),
    staleTime: 60000,
  });

  // Transform API data to local format with fallback
  const formulary: DrugFormularyItem[] = useMemo(() => {
    if (!apiDrugs) return [];
    return apiDrugs.map((d: DrugClassification) => ({
      id: d.id,
      drugName: d.drugName,
      genericName: d.genericName || d.drugName,
      brandName: d.brandName || 'N/A',
      category: d.therapeuticClass || 'General',
      strength: 'Various',
      dosageForm: 'Various',
      isControlled: d.isControlled,
      controlSchedule: d.schedule,
      formularyStatus: d.isOnFormulary ? 'approved' as const : 'not-approved' as const,
      restrictionNotes: d.highAlert ? 'High alert medication' : undefined,
      lastReviewed: new Date().toISOString().split('T')[0],
    }));
  }, [apiDrugs]);

  const filteredDrugs = useMemo(() => {
    return formulary.filter((drug) => {
      const matchesSearch =
        drug.drugName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drug.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drug.brandName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All Categories' || drug.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || drug.formularyStatus === statusFilter;
      const matchesControlled =
        controlledFilter === 'all' ||
        (controlledFilter === 'controlled' && drug.isControlled) ||
        (controlledFilter === 'non-controlled' && !drug.isControlled);
      return matchesSearch && matchesCategory && matchesStatus && matchesControlled;
    });
  }, [formulary, searchTerm, categoryFilter, statusFilter, controlledFilter]);

  // Handler for Add Drug button
  const handleAddDrug = useCallback(() => {
    // TODO: Implement add drug modal/navigation
    alert('Add Drug functionality - To be implemented with drug creation form');
  }, []);

  // Handler for Print List button
  const handlePrintList = useCallback(() => {
    alert('Print List functionality coming soon');
  }, []);

  // Handler for Export button
  const handleExport = useCallback(() => {
    alert('Export functionality coming soon');
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'restricted':
        return 'bg-amber-100 text-amber-800';
      case 'not-approved':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'restricted':
        return 'Restricted';
      case 'not-approved':
        return 'Not Approved';
      default:
        return status;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Pill className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Drug Formulary</h1>
            <p className="text-sm text-gray-500">Hospital approved drug catalog</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintList}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-4 h-4" />
            Print List
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleAddDrug}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Drug
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by drug name, generic, or brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="restricted">Restricted</option>
          <option value="not-approved">Not Approved</option>
        </select>
        <select
          value={controlledFilter}
          onChange={(e) => setControlledFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Substances</option>
          <option value="controlled">Controlled Only</option>
          <option value="non-controlled">Non-Controlled</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{formulary.length}</div>
          <div className="text-sm text-gray-500">Total Drugs</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {formulary.filter((d) => d.formularyStatus === 'approved').length}
          </div>
          <div className="text-sm text-gray-500">Approved</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">
            {formulary.filter((d) => d.formularyStatus === 'restricted').length}
          </div>
          <div className="text-sm text-gray-500">Restricted</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {formulary.filter((d) => d.isControlled).length}
          </div>
          <div className="text-sm text-gray-500">Controlled Substances</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drug Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generic / Brand</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Strength</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Form</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Controlled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDrugs.map((drug) => (
                <tr key={drug.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{drug.drugName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{drug.genericName}</div>
                    <div className="text-sm text-gray-500">{drug.brandName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{drug.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{drug.strength}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{drug.dosageForm}</span>
                  </td>
                  <td className="px-4 py-3">
                    {drug.isControlled ? (
                      <div className="flex items-center gap-1">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-600">{drug.controlSchedule}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(drug.formularyStatus)}`}>
                        {getStatusLabel(drug.formularyStatus)}
                      </span>
                      {drug.restrictionNotes && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {drug.restrictionNotes.substring(0, 30)}...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-green-600">
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
