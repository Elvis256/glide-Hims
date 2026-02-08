import { ShieldAlert } from 'lucide-react';

interface AccessDeniedProps {
  /** Optional custom message. Defaults to generic message. */
  message?: string;
  /** Whether to show the "Go Back" button. Defaults to true. */
  showBackButton?: boolean;
  /** Whether to use full screen height. Defaults to false (uses calc for page content area). */
  fullScreen?: boolean;
}

/**
 * Consistent Access Denied component for unauthorized page access.
 * Use this component whenever a user tries to access a page they don't have permission to view.
 */
export default function AccessDenied({ 
  message = "You don't have permission to access this page.",
  showBackButton = true,
  fullScreen = false
}: AccessDeniedProps) {
  const heightClass = fullScreen 
    ? 'min-h-screen' 
    : 'h-[calc(100vh-120px)]';

  return (
    <div className={`flex items-center justify-center ${heightClass} bg-gray-50`}>
      <div className="text-center p-8">
        <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 mb-4">{message}</p>
        {showBackButton && (
          <button 
            onClick={() => window.history.back()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}
