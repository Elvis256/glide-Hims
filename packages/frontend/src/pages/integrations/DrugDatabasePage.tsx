import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Pill,
  AlertTriangle,
  AlertCircle,
  Shield,
  Activity,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  FileWarning,
  BarChart3,
} from 'lucide-react';
import { integrationsService, type DrugLabel, type DrugInteraction, type SideEffectStat } from '../../services/integrations';

export default function DrugDatabasePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<DrugLabel | null>(null);
  const [interactionDrugs, setInteractionDrugs] = useState<string[]>([]);
  const [newDrugInput, setNewDrugInput] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'interactions' | 'recalls'>('search');

  // Search drugs
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['drug-search', searchQuery],
    queryFn: () => integrationsService.searchDrugs(searchQuery, 20),
    enabled: searchQuery.length >= 2,
  });

  // Get side effects for selected drug
  const { data: sideEffects, isLoading: isLoadingSideEffects } = useQuery({
    queryKey: ['drug-side-effects', selectedDrug?.genericName],
    queryFn: () => integrationsService.getSideEffects(selectedDrug!.genericName),
    enabled: !!selectedDrug,
  });

  // Get drug recalls
  const { data: recalls, isLoading: isLoadingRecalls } = useQuery({
    queryKey: ['drug-recalls'],
    queryFn: () => integrationsService.getDrugRecalls(undefined, 30),
    enabled: activeTab === 'recalls',
  });

  // Check interactions
  const interactionMutation = useMutation({
    mutationFn: (drugs: string[]) => integrationsService.checkDrugInteractions(drugs),
    onSuccess: (data) => {
      if (data.hasInteractions) {
        toast.warning(`Found ${data.interactions.length} potential interaction(s)!`);
      } else {
        toast.success('No known interactions found');
      }
    },
    onError: () => toast.error('Failed to check interactions'),
  });

  const addDrugToCheck = () => {
    if (newDrugInput.trim() && !interactionDrugs.includes(newDrugInput.trim())) {
      setInteractionDrugs([...interactionDrugs, newDrugInput.trim()]);
      setNewDrugInput('');
    }
  };

  const removeDrugFromCheck = (drug: string) => {
    setInteractionDrugs(interactionDrugs.filter(d => d !== drug));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-300';
      case 'moderate': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default: return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Pill className="w-7 h-7 text-blue-600" />
            Drug Database (FDA)
          </h1>
          <p className="text-sm text-gray-500 mt-1">Search drug information, check interactions, view recalls</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'search', label: 'Search Drugs', icon: Search },
          { id: 'interactions', label: 'Check Interactions', icon: AlertTriangle },
          { id: 'recalls', label: 'Drug Recalls', icon: FileWarning },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search Panel */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drugs by name (e.g., aspirin, ibuprofen)..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-600" />}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {searchResults?.data.length === 0 && searchQuery.length >= 2 && (
                <p className="text-center text-gray-500 py-4">No drugs found</p>
              )}
              {searchResults?.data.map((drug) => (
                <div
                  key={drug.id}
                  onClick={() => setSelectedDrug(drug)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedDrug?.id === drug.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">{drug.brandName}</h3>
                      <p className="text-sm text-gray-600">{drug.genericName}</p>
                      <p className="text-xs text-gray-400 mt-1">{drug.manufacturer}</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                      {drug.dosageForm}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drug Details Panel */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            {selectedDrug ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedDrug.brandName}</h2>
                    <p className="text-gray-600">{selectedDrug.genericName}</p>
                  </div>
                  <button
                    onClick={() => setSelectedDrug(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Form:</span>
                    <span className="ml-2 font-medium">{selectedDrug.dosageForm || 'N/A'}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Route:</span>
                    <span className="ml-2 font-medium">{selectedDrug.route || 'N/A'}</span>
                  </div>
                </div>

                {selectedDrug.activeIngredients.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-1">Active Ingredients</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedDrug.activeIngredients.map((ing, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <DrugSection title="Indications" content={selectedDrug.indications} icon={Activity} />
                <DrugSection title="Warnings" content={selectedDrug.warnings} icon={AlertTriangle} color="text-yellow-600" />
                <DrugSection title="Contraindications" content={selectedDrug.contraindications} icon={Shield} color="text-red-600" />
                <DrugSection title="Dosage" content={selectedDrug.dosage} icon={Pill} />

                {/* Side Effects */}
                {isLoadingSideEffects ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading side effects...
                  </div>
                ) : sideEffects?.data && sideEffects.data.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Common Side Effects (Reported)
                    </h4>
                    <div className="space-y-1">
                      {sideEffects.data.slice(0, 10).map((effect, i) => (
                        <SideEffectBar key={i} effect={effect} maxCount={sideEffects.data[0].count} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 py-16">
                <Pill className="w-16 h-16 mb-4 opacity-30" />
                <p>Select a drug to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactions Tab */}
      {activeTab === 'interactions' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Check Drug Interactions
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Add multiple drugs to check for potential interactions between them.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newDrugInput}
              onChange={(e) => setNewDrugInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addDrugToCheck()}
              placeholder="Enter drug name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addDrugToCheck}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {interactionDrugs.map((drug) => (
              <span
                key={drug}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-2"
              >
                {drug}
                <button onClick={() => removeDrugFromCheck(drug)} className="hover:text-blue-900">
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>

          <button
            onClick={() => interactionMutation.mutate(interactionDrugs)}
            disabled={interactionDrugs.length < 2 || interactionMutation.isPending}
            className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
          >
            {interactionMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Check Interactions
          </button>

          {interactionMutation.data && (
            <div className="mt-6">
              {interactionMutation.data.hasInteractions ? (
                <div className="space-y-3">
                  <h4 className="font-medium text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Potential Interactions Found
                  </h4>
                  {interactionMutation.data.interactions.map((interaction, i) => (
                    <div
                      key={i}
                      className={`p-3 border rounded-lg ${getSeverityColor(interaction.severity)}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">
                          {interaction.drug1} ↔ {interaction.drug2}
                        </span>
                        <span className="text-xs uppercase font-bold">
                          {interaction.severity} risk
                        </span>
                      </div>
                      <p className="text-sm">{interaction.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  No known interactions found between these drugs.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recalls Tab */}
      {activeTab === 'recalls' && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-red-600" />
            Recent Drug Recalls
          </h3>

          {isLoadingRecalls ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {recalls?.data.map((recall, i) => (
                <div key={i} className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-sm text-red-600">{recall.recallNumber}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      recall.classification === 'Class I' 
                        ? 'bg-red-600 text-white' 
                        : recall.classification === 'Class II'
                        ? 'bg-orange-500 text-white'
                        : 'bg-yellow-500 text-white'
                    }`}>
                      {recall.classification}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800 mb-1">{recall.productDescription.substring(0, 200)}...</p>
                  <p className="text-sm text-red-700">{recall.reason.substring(0, 200)}...</p>
                  <p className="text-xs text-gray-500 mt-2">Date: {recall.recallInitiationDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DrugSection({ title, content, icon: Icon, color = 'text-gray-600' }: {
  title: string;
  content: string;
  icon: any;
  color?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className={`font-medium flex items-center gap-2 ${color}`}>
          <Icon className="w-4 h-4" />
          {title}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="p-3 pt-0 text-sm text-gray-600 max-h-48 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  );
}

function SideEffectBar({ effect, maxCount }: { effect: SideEffectStat; maxCount: number }) {
  const percentage = (effect.count / maxCount) * 100;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 truncate text-gray-600" title={effect.reaction}>
        {effect.reaction}
      </span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">
        {effect.count.toLocaleString()}
      </span>
    </div>
  );
}
