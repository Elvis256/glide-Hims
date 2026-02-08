import { AlertCircle, RefreshCw } from 'lucide-react';
import { getApiErrorMessage } from '../services/api';

interface ErrorDisplayProps {
  /** The error object from a query or mutation */
  error: unknown;
  /** Custom title for the error. Defaults to "Something went wrong" */
  title?: string;
  /** Whether to show a retry button */
  onRetry?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Consistent error display component that extracts and shows user-friendly error messages.
 * Use this component to display query/mutation errors with actionable feedback.
 */
export default function ErrorDisplay({ 
  error, 
  title = 'Something went wrong',
  onRetry,
  className = ''
}: ErrorDisplayProps) {
  const errorMessage = getApiErrorMessage(error);

  return (
    <div className={`flex items-center justify-center h-full text-red-500 ${className}`}>
      <div className="text-center p-4">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-sm text-red-600 mt-1 max-w-md">{errorMessage}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
