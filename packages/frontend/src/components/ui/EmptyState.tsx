import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Call to action, e.g. <Button icon={Plus}>Register patient</Button> */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      {Icon && (
        <div className="p-3.5 rounded-2xl bg-surface-100 text-surface-400 mb-4">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
      {description && <p className="text-sm text-surface-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
