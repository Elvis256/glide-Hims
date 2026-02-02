/**
 * Glide HIMS Logo Component
 * A professional healthcare logo with medical cross, heartbeat pulse, and brand name
 */

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  showTagline?: boolean;
  theme?: 'light' | 'dark';
}

const sizes = {
  xs: { icon: 24, text: 'text-sm', tagline: 'text-[10px]', gap: 'gap-1.5' },
  sm: { icon: 32, text: 'text-base', tagline: 'text-xs', gap: 'gap-2' },
  md: { icon: 40, text: 'text-lg', tagline: 'text-xs', gap: 'gap-2.5' },
  lg: { icon: 48, text: 'text-xl', tagline: 'text-sm', gap: 'gap-3' },
  xl: { icon: 64, text: 'text-2xl', tagline: 'text-sm', gap: 'gap-4' },
};

// SVG Logo Icon component
function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 70 70"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1E40AF', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#10B981', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="iconShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E40AF" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Background circle */}
      <circle cx="35" cy="35" r="33" fill="url(#logoGrad)" filter="url(#iconShadow)" />

      {/* Inner ring */}
      <circle cx="35" cy="35" r="27" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

      {/* Medical cross */}
      <rect x="17" y="30" width="36" height="10" rx="2" fill="white" />
      <rect x="30" y="17" width="10" height="36" rx="2" fill="white" />

      {/* Heartbeat pulse */}
      <path
        d="M 18 35 L 25 35 L 29 26 L 35 44 L 41 30 L 45 35 L 52 35"
        fill="none"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({
  size = 'md',
  variant = 'full',
  className = '',
  showTagline = false,
  theme = 'light',
}: LogoProps) {
  const sizeConfig = sizes[size];
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const taglineColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-500';

  if (variant === 'icon') {
    return <LogoIcon size={sizeConfig.icon} className={className} />;
  }

  if (variant === 'text') {
    return (
      <div className={`flex flex-col ${className}`}>
        <span className={`font-bold ${textColor} ${sizeConfig.text}`}>
          Glide<span className="text-blue-600">HIMS</span>
        </span>
        {showTagline && (
          <span className={`${taglineColor} ${sizeConfig.tagline}`}>
            Healthcare Information Management
          </span>
        )}
      </div>
    );
  }

  // Full variant (icon + text)
  return (
    <div className={`flex items-center ${sizeConfig.gap} ${className}`}>
      <LogoIcon size={sizeConfig.icon} />
      <div className="flex flex-col">
        <span className={`font-bold leading-tight ${sizeConfig.text}`}>
          <span className={textColor}>Glide</span>
          <span className="text-blue-600">HIMS</span>
        </span>
        {showTagline && (
          <span className={`leading-tight ${taglineColor} ${sizeConfig.tagline}`}>
            Healthcare Information Management
          </span>
        )}
      </div>
    </div>
  );
}

// Export icon separately for flexible usage
export { LogoIcon };
