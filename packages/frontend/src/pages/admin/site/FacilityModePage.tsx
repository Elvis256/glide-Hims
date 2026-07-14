import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Building2, Stethoscope, Bed, MapPin, Pill, Store, Warehouse, Monitor,
  Check, ChevronRight, Info, Loader2, Save, AlertTriangle, ToggleLeft, ToggleRight,
  Layers, Shield, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

interface FacilityPreset {
  mode: string;
  businessType: string;
  name: string;
  description: string;
  icon: string;
  facilityType: string;
  supportsMultiSite: boolean;
  singleUserMode: boolean;
  enabledModules: string[];
  sidebarModules: string[];
  recommendedRoles: string[];
  notes: string[];
}

interface ModuleDefinition {
  code: string;
  name: string;
  requiredPermissions: string[];
}

const PRESET_ICONS: Record<string, React.ReactNode> = {
  monitor: <Monitor className="w-6 h-6" />,
  stethoscope: <Stethoscope className="w-6 h-6" />,
  bed: <Bed className="w-6 h-6" />,
  'map-pin': <MapPin className="w-6 h-6" />,
  building: <Building2 className="w-6 h-6" />,
  pill: <Pill className="w-6 h-6" />,
  store: <Store className="w-6 h-6" />,
  warehouse: <Warehouse className="w-6 h-6" />,
};

const MODULE_COLORS: Record<string, string> = {
  registration: 'bg-blue-100 text-blue-700',
  nursing: 'bg-pink-100 text-pink-700',
  doctors: 'bg-indigo-100 text-indigo-700',
  'chronic-care': 'bg-purple-100 text-purple-700',
  emergency: 'bg-red-100 text-red-700',
  diagnostics: 'bg-amber-100 text-amber-700',
  pharmacy: 'bg-green-100 text-green-700',
  ipd: 'bg-cyan-100 text-cyan-700',
  billing: 'bg-orange-100 text-orange-700',
  stores: 'bg-teal-100 text-teal-700',
  reports: 'bg-gray-100 text-gray-700',
  hr: 'bg-violet-100 text-violet-700',
  assets: 'bg-lime-100 text-lime-700',
  pos: 'bg-yellow-100 text-yellow-700',
  dental_charting: 'bg-sky-100 text-sky-700',
  optical_exams: 'bg-fuchsia-100 text-fuchsia-700',
  theatre: 'bg-rose-100 text-rose-700',
  maternity: 'bg-pink-100 text-pink-700',
  finance: 'bg-emerald-100 text-emerald-700',
  integrations: 'bg-slate-100 text-slate-700',
  admin: 'bg-gray-100 text-gray-700',
};

export default function FacilityModePage() {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [customModules, setCustomModules] = useState<string[] | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  // Fetch current facility mode
  const { data: currentMode, isLoading: loadingMode } = useQuery({
    queryKey: ['facility-mode'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/facility_mode');
        return res.data?.value ?? res.data?.data?.value ?? null;
      } catch {
        return null;
      }
    },
  });

  // Fetch custom enabled_modules override
  const { data: customEnabledModules } = useQuery({
    queryKey: ['enabled-modules'],
    queryFn: async () => {
      try {
        const res = await api.get('/settings/enabled_modules');
        const val = res.data?.value ?? res.data?.data?.value ?? null;
        return Array.isArray(val) ? val : null;
      } catch {
        return null;
      }
    },
  });

  // Fetch all presets
  const { data: presets, isLoading: loadingPresets } = useQuery({
    queryKey: ['facility-presets'],
    queryFn: async () => {
      const res = await api.get('/settings/facility-presets');
      return (res.data?.data ?? []) as FacilityPreset[];
    },
  });

  // Fetch module registry
  const { data: allModules } = useQuery({
    queryKey: ['module-registry'],
    queryFn: async () => {
      const res = await api.get('/settings/module-registry');
      return (res.data?.data ?? []) as ModuleDefinition[];
    },
  });

  // Save facility mode
  const saveMutation = useMutation({
    mutationFn: async (mode: string) => {
      await api.put('/settings/facility_mode', { value: mode });
      // Clear any custom enabled_modules override when switching presets
      try { await api.delete('/settings/enabled_modules'); } catch { /* may not exist */ }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-mode'] });
      queryClient.invalidateQueries({ queryKey: ['enabled-modules'] });
      toast.success('Facility mode updated. Users will see changes on next login.');
      setShowConfirm(false);
      setSelectedPreset(null);
      setShowCustom(false);
      setCustomModules(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save');
    },
  });

  // Save custom module overrides
  const saveCustomMutation = useMutation({
    mutationFn: async (modules: string[]) => {
      await api.put('/settings/enabled_modules', { value: modules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enabled-modules'] });
      toast.success('Custom module configuration saved. Users will see changes on next login.');
      setShowCustom(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save');
    },
  });

  const currentPreset = useMemo(
    () => presets?.find(p => p.mode === currentMode),
    [presets, currentMode],
  );

  const previewPreset = useMemo(
    () => presets?.find(p => p.mode === selectedPreset),
    [presets, selectedPreset],
  );

  // Determine which modules are effectively enabled
  const effectiveModules = useMemo(() => {
    if (customEnabledModules && customEnabledModules.length > 0) {
      return customEnabledModules;
    }
    return currentPreset?.enabledModules ?? [];
  }, [customEnabledModules, currentPreset]);

  const effectiveSidebarModules = useMemo(() => {
    if (customEnabledModules && customEnabledModules.length > 0) {
      // Map custom modules using the preset→sidebar mapping approach
      // For custom modules, the codes are already sidebar codes
      return customEnabledModules;
    }
    return currentPreset?.sidebarModules ?? [];
  }, [customEnabledModules, currentPreset]);

  // Toggle a module in custom config
  const toggleModule = (moduleCode: string) => {
    const current = customModules ?? effectiveSidebarModules;
    if (current.includes(moduleCode)) {
      setCustomModules(current.filter(m => m !== moduleCode));
    } else {
      setCustomModules([...current, moduleCode]);
    }
  };

  if (loadingPresets || loadingMode) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Settings2 className="w-7 h-7 text-indigo-600" />
          Facility Mode & Modules
        </h1>
        <p className="mt-1 text-gray-500">
          Controls which modules appear in the sidebar for all users in this organization.
          Each preset is designed for a specific type of healthcare facility.
        </p>
      </div>

      {/* Current Mode Card */}
      <div className="bg-white rounded-xl border-2 border-indigo-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
              {currentPreset ? PRESET_ICONS[currentPreset.icon] || <Building2 className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Mode: {currentPreset?.name || currentMode || 'Not Set'}
                </h2>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              <p className="text-gray-500 mt-1">{currentPreset?.description || 'No facility mode configured yet.'}</p>
              {customEnabledModules && customEnabledModules.length > 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Custom module overrides active (not using preset defaults)
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Modules */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Enabled Modules ({effectiveSidebarModules.length + 2} total — admin & registration always included)
          </h3>
          <div className="flex flex-wrap gap-2">
            {['admin', 'registration'].map(code => (
              <span key={code} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                <Shield className="w-3 h-3" />
                {allModules?.find(m => m.code === code)?.name || code}
                <span className="text-gray-400 ml-1">(always on)</span>
              </span>
            ))}
            {effectiveSidebarModules
              .filter(code => !['admin', 'registration'].includes(code))
              .map(code => (
                <span key={code} className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${MODULE_COLORS[code] || 'bg-gray-100 text-gray-700'}`}>
                  {allModules?.find(m => m.code === code)?.name || code}
                </span>
              ))}
          </div>
        </div>

        {/* Recommended Roles */}
        {currentPreset?.recommendedRoles && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Recommended Roles</h3>
            <div className="flex flex-wrap gap-2">
              {currentPreset.recommendedRoles.map(role => (
                <span key={role} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 text-gray-600 border">
                  {role}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Module Toggle */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ToggleLeft className="w-5 h-5 text-indigo-600" />
              Custom Module Overrides
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Enable or disable individual modules without changing the preset. Useful for gradual rollout.
            </p>
          </div>
          {!showCustom ? (
            <button
              onClick={() => {
                setShowCustom(true);
                setCustomModules(effectiveSidebarModules.filter(m => !['admin', 'registration'].includes(m)));
              }}
              className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
            >
              Customize Modules
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCustom(false);
                  setCustomModules(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => customModules && saveCustomMutation.mutate(customModules)}
                disabled={saveCustomMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {saveCustomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Custom Config
              </button>
            </div>
          )}
        </div>

        {showCustom && allModules && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {allModules
              .filter(mod => !['admin', 'registration'].includes(mod.code))
              .map(mod => {
                const isEnabled = (customModules ?? effectiveSidebarModules).includes(mod.code);
                return (
                  <button
                    key={mod.code}
                    onClick={() => toggleModule(mod.code)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition text-left ${
                      isEnabled
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isEnabled ? (
                      <ToggleRight className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${isEnabled ? 'text-indigo-900' : 'text-gray-600'}`}>
                        {mod.name}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        )}

        {!showCustom && customEnabledModules && customEnabledModules.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Custom overrides are active</p>
              <p className="text-amber-600">
                {customEnabledModules.length} modules enabled via custom config.
                To reset to preset defaults, click "Customize Modules" and then select a new preset below.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Preset Selector */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Change Facility Mode</h2>
        <p className="text-sm text-gray-500 mb-4">
          Select a preset that matches your facility type. This determines which modules all users see in the sidebar.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presets?.map(preset => {
            const isCurrent = preset.mode === currentMode;
            const isSelected = preset.mode === selectedPreset;
            return (
              <button
                key={preset.mode}
                onClick={() => {
                  if (!isCurrent) {
                    setSelectedPreset(preset.mode);
                    setShowConfirm(true);
                  }
                }}
                disabled={isCurrent}
                className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                  isCurrent
                    ? 'border-indigo-300 bg-indigo-50 cursor-default'
                    : isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-gray-200 bg-white hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-600 text-white">
                    <Check className="w-3 h-3 mr-1" /> Current
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isCurrent ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {PRESET_ICONS[preset.icon] || <Building2 className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{preset.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{preset.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {preset.sidebarModules
                        .filter(code => !['admin', 'registration'].includes(code))
                        .slice(0, 8)
                        .map(code => (
                          <span key={code} className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MODULE_COLORS[code] || 'bg-gray-100 text-gray-600'}`}>
                            {allModules?.find(m => m.code === code)?.name || code}
                          </span>
                        ))}
                      {preset.sidebarModules.filter(c => !['admin', 'registration'].includes(c)).length > 8 && (
                        <span className="text-xs text-gray-400">
                          +{preset.sidebarModules.filter(c => !['admin', 'registration'].includes(c)).length - 8} more
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                      <span>{preset.sidebarModules.length + 2} modules</span>
                      <span>•</span>
                      <span>{preset.recommendedRoles.length} roles</span>
                      {preset.supportsMultiSite && (
                        <>
                          <span>•</span>
                          <span className="text-blue-500">Multi-site</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!isCurrent && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && previewPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Change Facility Mode?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will change the sidebar modules for <strong>all users</strong> in this organization.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Current</p>
                <p className="font-medium text-gray-900">{currentPreset?.name || currentMode}</p>
                <p className="text-xs text-gray-500 mt-1">{currentPreset?.sidebarModules.length ?? 0} + 2 modules</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-xs font-semibold text-indigo-500 uppercase mb-2">New</p>
                <p className="font-medium text-indigo-900">{previewPreset.name}</p>
                <p className="text-xs text-indigo-600 mt-1">{previewPreset.sidebarModules.length} + 2 modules</p>
              </div>
            </div>

            {/* Module diff */}
            <div className="space-y-2">
              {(() => {
                const currentMods = new Set(currentPreset?.sidebarModules ?? []);
                const newMods = new Set(previewPreset.sidebarModules);
                const added = [...newMods].filter(m => !currentMods.has(m) && !['admin', 'registration'].includes(m));
                const removed = [...currentMods].filter(m => !newMods.has(m) && !['admin', 'registration'].includes(m));
                return (
                  <>
                    {added.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs font-semibold text-green-600 mr-1">+ Added:</span>
                        {added.map(code => (
                          <span key={code} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            {allModules?.find(m => m.code === code)?.name || code}
                          </span>
                        ))}
                      </div>
                    )}
                    {removed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-xs font-semibold text-red-600 mr-1">− Removed:</span>
                        {removed.map(code => (
                          <span key={code} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                            {allModules?.find(m => m.code === code)?.name || code}
                          </span>
                        ))}
                      </div>
                    )}
                    {added.length === 0 && removed.length === 0 && (
                      <p className="text-sm text-gray-500">No module changes.</p>
                    )}
                  </>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <Info className="w-4 h-4 flex-shrink-0" />
              Users will see the updated sidebar on their next login or page refresh.
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowConfirm(false); setSelectedPreset(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(previewPreset.mode)}
                disabled={saveMutation.isPending}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
