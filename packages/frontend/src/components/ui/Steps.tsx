import { Check } from 'lucide-react';
import { cn } from './cn';

export interface StepsProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Allow clicking completed steps to navigate back. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/** Horizontal step indicator for multi-step flows (registration, wizards). */
export function Steps({ steps, current, onStepClick, className }: StepsProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = done && !!onStepClick;
        return (
          <li key={label} className="flex items-center gap-2 min-w-0">
            {i > 0 && <div className={cn('h-px w-6 shrink-0', done || active ? 'bg-brand-400' : 'bg-surface-200')} />}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick(i)}
              className={cn(
                'flex items-center gap-2 rounded-full pr-3 pl-1 py-1 transition-colors',
                clickable && 'hover:bg-surface-100 cursor-pointer',
                !clickable && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
                  done && 'bg-brand-600 text-white',
                  active && 'bg-brand-50 text-brand-700 ring-2 ring-brand-500',
                  !done && !active && 'bg-surface-100 text-surface-400',
                )}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  'text-sm truncate',
                  active ? 'font-semibold text-surface-900' : done ? 'text-surface-700' : 'text-surface-400',
                )}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
