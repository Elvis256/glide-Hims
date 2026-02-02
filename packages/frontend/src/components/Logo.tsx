/**
 * Glide HIMS Logo Component
 * Professional healthcare logo with "GLIDE" text integrated into the icon
 */

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'compact';
  className?: string;
  showTagline?: boolean;
  theme?: 'light' | 'dark';
}

const sizes = {
  xs: { icon: 60, iconHeight: 24, text: 'text-sm', tagline: 'text-[8px]', gap: 'gap-1' },
  sm: { icon: 90, iconHeight: 32, text: 'text-lg', tagline: 'text-[9px]', gap: 'gap-1.5' },
  md: { icon: 120, iconHeight: 42, text: 'text-xl', tagline: 'text-[10px]', gap: 'gap-2' },
  lg: { icon: 150, iconHeight: 52, text: 'text-2xl', tagline: 'text-xs', gap: 'gap-2.5' },
  xl: { icon: 200, iconHeight: 70, text: 'text-3xl', tagline: 'text-sm', gap: 'gap-3' },
};

// GLIDE badge icon - the word GLIDE in a pill shape with medical accents
function LogoIcon({ width = 120, height = 42, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 70"
      width={width}
      height={height}
      className={className}
    >
      <defs>
        <linearGradient id="glideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#2563EB', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1E40AF', stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glideShadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1E40AF" floodOpacity="0.2" />
        </filter>
        <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Background pill shape */}
      <rect x="5" y="5" width="190" height="60" rx="30" fill="url(#glideGrad)" filter="url(#glideShadow)" />

      {/* Prominent Heartbeat pulse - bright green with glow */}
      <path
        d="M 15 35 L 28 35 L 36 18 L 48 52 L 58 25 L 66 35 L 78 35"
        fill="none"
        stroke="#10B981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glowEffect)"
      />

      {/* GLIDE Text */}
      <text
        x="105"
        y="47"
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontSize="34"
        fontWeight="800"
        fill="white"
        textAnchor="middle"
        letterSpacing="2"
      >
        GLIDE
      </text>

      {/* Small medical cross on right */}
      <g transform="translate(162, 23)" fill="rgba(255,255,255,0.35)">
        <rect x="0" y="8" width="24" height="8" rx="2" />
        <rect x="8" y="0" width="8" height="24" rx="2" />
      </g>
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
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-800';
  const taglineColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-500';

  if (variant === 'icon') {
    return <LogoIcon width={sizeConfig.icon} height={sizeConfig.iconHeight} className={className} />;
  }

  if (variant === 'compact') {
    // Just the GLIDE badge, no HIMS text
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <LogoIcon width={sizeConfig.icon} height={sizeConfig.iconHeight} />
        {showTagline && (
          <span className={`${taglineColor} ${sizeConfig.tagline} mt-1 text-center`}>
            Healthcare Information Management
          </span>
        )}
      </div>
    );
  }

  // Full variant (GLIDE badge + HIMS text)
  return (
    <div className={`flex items-center ${sizeConfig.gap} ${className}`}>
      <LogoIcon width={sizeConfig.icon} height={sizeConfig.iconHeight} />
      <div className="flex flex-col">
        <span className={`font-bold leading-tight ${textColor} ${sizeConfig.text}`}>
          HIMS
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
