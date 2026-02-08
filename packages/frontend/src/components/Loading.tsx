import { Loader2 } from 'lucide-react';

interface LoadingProps {
  /** Size of the spinner: sm (16px), md (24px), lg (32px), xl (48px) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Text to display below the spinner */
  text?: string;
  /** Whether to center in full screen/container */
  fullScreen?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Color variant */
  variant?: 'primary' | 'white' | 'gray';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses = {
  primary: 'text-blue-600',
  white: 'text-white',
  gray: 'text-gray-400',
};

/**
 * Consistent loading spinner component
 * 
 * Usage:
 * - Inline: <Loading size="sm" />
 * - Page loading: <Loading size="lg" text="Loading data..." fullScreen />
 * - Button: <Loading size="sm" variant="white" />
 */
export function Loading({ 
  size = 'md', 
  text, 
  fullScreen = false, 
  className = '',
  variant = 'primary'
}: LoadingProps) {
  const spinner = (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${variantClasses[variant]}`} />
  );

  if (fullScreen) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[200px] ${className}`}>
        {spinner}
        {text && <p className="text-gray-600 mt-3 text-sm">{text}</p>}
      </div>
    );
  }

  if (text) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {spinner}
        <span className="text-gray-600 text-sm">{text}</span>
      </div>
    );
  }

  return spinner;
}

/**
 * Full page loading overlay
 */
export function LoadingOverlay({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
        <p className="text-gray-600 mt-4">{text}</p>
      </div>
    </div>
  );
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  );
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Card skeleton
 */
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export default Loading;
