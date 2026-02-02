/**
 * Glide HIMS Logo Component
 * A professional healthcare logo with medical cross and heartbeat pulse
 */

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  showTagline?: boolean;
}

const sizes = {
  xs: { icon: 24, text: 'text-sm', tagline: 'text-[10px]' },
  sm: { icon: 32, text: 'text-base', tagline: 'text-xs' },
  md: { icon: 40, text: 'text-lg', tagline: 'text-xs' },
  lg: { icon: 48, text: 'text-xl', tagline: 'text-sm' },
  xl: { icon: 64, text: 'text-2xl', tagline: 'text-sm' },
};

// SVG Logo Icon component
function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1E40AF', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#10B981', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E40AF" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Background circle */}
      <circle cx="100" cy="100" r="90" fill="url(#mainGradient)" filter="url(#shadow)" />

      {/* Inner lighter ring */}
      <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />

      {/* Medical cross with rounded corners */}
      <g fill="white">
        <rect x="45" y="85" width="110" height="30" rx="6" ry="6" />
        <rect x="85" y="45" width="30" height="110" rx="6" ry="6" />
      </g>

      {/* Heartbeat pulse line */}
      <path
        d="M 50 100 L 70 100 L 80 75 L 95 125 L 110 85 L 120 100 L 150 100"
        fill="none"
        stroke="url(#accentGradient)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Decorative dots */}
      <circle cx="35" cy="100" r="4" fill="rgba(255,255,255,0.4)" />
      <circle cx="165" cy="100" r="4" fill="rgba(255,255,255,0.4)" />
      <circle cx="100" cy="35" r="4" fill="rgba(255,255,255,0.4)" />
      <circle cx="100" cy="165" r="4" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

export default function Logo({
  size = 'md',
  variant = 'full',
  className = '',
  showTagline = false,
}: LogoProps) {
  const sizeConfig = sizes[size];

  if (variant === 'icon') {
    return <LogoIcon size={sizeConfig.icon} className={className} />;
  }

  if (variant === 'text') {
    return (
      <div className={`flex flex-col ${className}`}>
        <span className={`font-bold text-gray-900 ${sizeConfig.text}`}>
          Glide <span className="text-blue-600">HIMS</span>
        </span>
        {showTagline && (
          <span className={`text-gray-500 ${sizeConfig.tagline}`}>
            Healthcare Information Management
          </span>
        )}
      </div>
    );
  }

  // Full variant (icon + text)
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoIcon size={sizeConfig.icon} />
      <div className="flex flex-col">
        <span className={`font-bold text-gray-900 leading-tight ${sizeConfig.text}`}>
          Glide <span className="text-blue-600">HIMS</span>
        </span>
        {showTagline && (
          <span className={`text-gray-500 leading-tight ${sizeConfig.tagline}`}>
            Healthcare Information Management
          </span>
        )}
      </div>
    </div>
  );
}

// Export icon separately for flexible usage
export { LogoIcon };
