import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronDown, Check, Loader2, Search, Building2 } from 'lucide-react';
import { facilitiesService, type Facility } from '../services/facilities';
import { useAuthStore } from '../store/auth';

const STORAGE_KEY = 'glide_active_facility_id';
const SEARCH_THRESHOLD = 6; // show search box only when more than N facilities

export function getActiveFacilityId(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setActiveFacilityId(id: string) {
  sessionStorage.setItem(STORAGE_KEY, id);
}

export function clearActiveFacilityId() {
  sessionStorage.removeItem(STORAGE_KEY);
}

interface Props {
  /** Optional: only show when facility has multi-site enabled */
  onlyIfMultiSite?: boolean;
}

export default function FacilitySwitcher({ onlyIfMultiSite = true }: Props) {
  const { user } = useAuthStore();
  const userRoles = (user?.roles || []) as Array<string | { role?: string; name?: string }>;
  const hasRole = (r: string) =>
    userRoles.some((ur: any) => ur === r || ur?.role === r || ur?.name === r);
  const canSwitch =
    !!user?.isSystemAdmin || hasRole('Super Admin') || hasRole('Administrator');

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [active, setActive] = useState<Facility | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    facilitiesService
      .list()
      .then((list) => {
        // Only show active facilities, sorted by name (case-insensitive).
        const visible = (list || [])
          .filter((f) => f.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        setFacilities(visible);

        const savedId = getActiveFacilityId();
        const savedMatch = savedId ? visible.find((f) => f.id === savedId) : undefined;
        // Prefer user.facilityId as the deterministic default; fall back to first.
        const fallback =
          (user?.facilityId && visible.find((f) => f.id === user.facilityId)) ||
          visible[0] ||
          null;
        const current = savedMatch || fallback;
        setActive(current);
        // Important: if the saved id is stale (deleted, deactivated, or from a
        // different tenant after re-login), overwrite sessionStorage so the
        // API interceptor stops sending a bogus x-facility-id header that
        // would 403 on every request.
        if (current && (!savedId || !savedMatch)) {
          setActiveFacilityId(current.id);
        }
        if (!current && savedId) {
          clearActiveFacilityId();
        }
      })
      .finally(() => setLoading(false));
  }, [user?.facilityId]);

  // Close dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  // Auto-focus search box when dropdown opens (only when search is visible).
  useEffect(() => {
    if (open && facilities.length > SEARCH_THRESHOLD) {
      // Defer to next tick so the input is mounted.
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (!open) setQuery('');
  }, [open, facilities.length]);

  const filtered = useMemo(() => {
    if (!query.trim()) return facilities;
    const q = query.toLowerCase();
    return facilities.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.type || '').toLowerCase().includes(q) ||
        (f.location || '').toLowerCase().includes(q),
    );
  }, [facilities, query]);

  if (loading) {
    return (
      <div className="flex items-center gap-1 px-3 py-1 text-gray-400 text-sm" aria-busy="true">
        <Loader2 className="w-3 h-3 animate-spin" />
      </div>
    );
  }

  if (facilities.length === 0) return null;

  // Non-admin users: show current facility name only (no switching).
  if (!canSwitch) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700">
        <MapPin className="w-4 h-4 text-blue-500" aria-hidden="true" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'No facility'}</span>
      </div>
    );
  }

  // Admin users: allow switching between tenant's facilities.
  if (onlyIfMultiSite && facilities.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700">
        <MapPin className="w-4 h-4 text-blue-500" aria-hidden="true" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'No facility'}</span>
      </div>
    );
  }

  const handleSelect = (facility: Facility) => {
    if (facility.id === active?.id) {
      setOpen(false);
      return;
    }
    setActive(facility);
    setActiveFacilityId(facility.id);
    setOpen(false);
    // Full reload is intentional: invalidates react-query caches and any
    // module-specific state that was scoped to the previous facility.
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        title="Switch facility"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active facility: ${active?.name ?? 'none selected'}. Click to switch.`}
      >
        <MapPin className="w-4 h-4 text-blue-500" aria-hidden="true" />
        <span className="max-w-[140px] truncate">{active?.name ?? 'Select facility'}</span>
        <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Available facilities"
          className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-1 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Switch Facility
            </p>
            {user?.isSystemAdmin && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700">
                <Building2 className="w-3 h-3" aria-hidden="true" />
                <span className="truncate">
                  System admin context: facilities scoped to active tenant
                </span>
              </p>
            )}
          </div>

          {facilities.length > SEARCH_THRESHOLD && (
            <div className="px-2 py-2 border-b border-gray-100">
              <div className="relative">
                <Search
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search facilities..."
                  className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Filter facilities by name"
                />
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-500 text-center">
                No facilities match "{query}"
              </p>
            ) : (
              filtered.map((facility) => (
                <button
                  key={facility.id}
                  role="option"
                  aria-selected={active?.id === facility.id}
                  onClick={() => handleSelect(facility)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <MapPin
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {facility.name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {facility.type}
                      {facility.parentFacilityId ? ' • Branch' : ' • Main'}
                    </p>
                  </div>
                  {active?.id === facility.id && (
                    <Check
                      className="w-4 h-4 text-blue-600 flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
