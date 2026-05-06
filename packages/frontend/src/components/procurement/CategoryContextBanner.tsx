import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Pill, Boxes, X } from 'lucide-react';

export type ProcurementCategory = 'drugs' | 'supplies';

export function useProcurementCategory(): {
  category: ProcurementCategory | null;
  isDrug: boolean | undefined;
  label: string | null;
} {
  const [params] = useSearchParams();
  return useMemo(() => {
    const raw = params.get('category');
    if (raw === 'drugs' || raw === 'supplies') {
      return {
        category: raw,
        isDrug: raw === 'drugs',
        label: raw === 'drugs' ? 'Drug Procurement' : 'Supplies Procurement',
      };
    }
    return { category: null, isDrug: undefined, label: null };
  }, [params]);
}

export function CategoryContextBanner() {
  const { category, label } = useProcurementCategory();
  const [params] = useSearchParams();

  if (!category || !label) return null;

  const Icon = category === 'drugs' ? Pill : Boxes;
  const colors =
    category === 'drugs'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-blue-50 border-blue-200 text-blue-800';

  const cleared = new URLSearchParams(params);
  cleared.delete('category');
  const clearedQs = cleared.toString();
  const clearTo = clearedQs ? `?${clearedQs}` : '';

  return (
    <div className={`mb-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${colors}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span>
          Filtered context: <strong>{label}</strong>
        </span>
      </div>
      <Link
        to={clearTo}
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs hover:bg-white/60"
      >
        <X className="h-3 w-3" />
        Clear filter
      </Link>
    </div>
  );
}
