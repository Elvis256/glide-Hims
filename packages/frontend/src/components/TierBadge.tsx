import { Award, Crown, Sparkles, Star, Zap } from 'lucide-react';

export type TierName = 'trial' | 'community' | 'standard' | 'professional' | 'enterprise' | string;

interface TierConfig {
  label: string;
  classes: string;
  icon: React.ReactNode;
}

const FALLBACK: TierConfig = {
  label: '—',
  classes: 'bg-gray-100 text-gray-600 border-gray-200',
  icon: <Star className="w-3 h-3" />,
};

const CONFIG: Record<string, TierConfig> = {
  trial: {
    label: 'Trial',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: <Sparkles className="w-3 h-3" />,
  },
  community: {
    label: 'Community',
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <Star className="w-3 h-3" />,
  },
  standard: {
    label: 'Standard',
    classes: 'bg-blue-50 text-blue-800 border-blue-200',
    icon: <Zap className="w-3 h-3" />,
  },
  professional: {
    label: 'Professional',
    classes: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    icon: <Award className="w-3 h-3" />,
  },
  enterprise: {
    label: 'Enterprise',
    classes: 'bg-purple-50 text-purple-800 border-purple-200',
    icon: <Crown className="w-3 h-3" />,
  },
};

interface TierBadgeProps {
  tier?: TierName | null;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export default function TierBadge({ tier, size = 'sm', className = '', showIcon = true }: TierBadgeProps) {
  const key = (tier || '').toString().toLowerCase().trim();
  const cfg = CONFIG[key] || (key ? { ...FALLBACK, label: key.charAt(0).toUpperCase() + key.slice(1) } : FALLBACK);
  const padding = size === 'md' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${cfg.classes} ${padding} ${className}`}
      title={`${cfg.label} tier`}
    >
      {showIcon && cfg.icon}
      {cfg.label}
    </span>
  );
}
