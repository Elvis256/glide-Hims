import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Check, Loader2 } from 'lucide-react';
import { facilitiesService, type Facility } from '../services/facilities';

const STORAGE_KEY = 'glide_active_facility_id';

export function getActiveFacilityId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveFacilityId(id: string) {
  localStorage.setItem(STORAGE_KEY, id);
}

interface Props {
  /** Optional: only show when facility has multi-site enabled */
  onlyIfMultiSite?: boolean;
}

export default function FacilitySwitcher({ onlyIfMultiSite = true }: Props) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [active, setActive] = useState<Facility | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    facilitiesService.list().then((list) => {
      setFacilities(list);
      const savedId = getActiveFacilityId();
      const current = (savedId && list.find(f => f.id === savedId)) || list[0] || null;
      setActive(current);
    }).finally(() => setLoading(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Hide if only one facility or multi-site not required
  if (loading) {
    return (
      <div className="flex items-center gap-1 px-3 py-1 text-gray-400 text-sm">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (onlyIfMultiSite && facilities.length <= 1) return null;
  if (facilities.length === 0) return null;

  const handleSelect = (facility: Facility) => {
    setActive(facility);
    setActiveFacilityId(facility.id);
    setOpen(false);
    // Reload page so all queries pick up the new facility context
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        title="Switch facility"
      >
        <MapPin className="w-4 h-4 text-blue-500" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'Select facility'}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1 overflow-hidden">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Switch Facility</p>
          {facilities.map(facility => (
            <button
              key={facility.id}
              onClick={() => handleSelect(facility)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
            >
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{facility.name}</p>
                <p className="text-xs text-gray-500 capitalize">{facility.type}{facility.parentFacilityId ? ' • Branch' : ' • Main'}</p>
              </div>
              {active?.id === facility.id && (
                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
