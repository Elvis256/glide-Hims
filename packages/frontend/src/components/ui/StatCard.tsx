import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type StatTone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const toneClasses: Record<StatTone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  neutral: 'bg-surface-100 text-surface-600',
};

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  /** Small line under the value, e.g. "+12% vs last week". */
  hint?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, tone = 'brand', hint, onClick, className }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 bg-white rounded-2xl border border-surface-200/70 p-4 text-left',
        'shadow-[0_1px_3px_rgba(15,23,42,0.05)]',
        onClick && 'hover:border-brand-300 hover:shadow-md transition-all duration-150 cursor-pointer',
        className,
      )}
    >
      {Icon && (
        <div className={cn('p-2.5 rounded-xl shrink-0', toneClasses[tone])}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="text-sm text-surface-500 truncate">{label}</div>
        <div className="text-xl font-bold text-surface-900 leading-tight">{value}</div>
        {hint && <div className="text-xs text-surface-400 mt-0.5">{hint}</div>}
      </div>
    </Tag>
  );
}
