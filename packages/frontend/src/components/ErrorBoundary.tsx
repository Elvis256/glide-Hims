import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  level?: 'global' | 'route' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.componentError(this.props.level || 'component', error, {
      componentStack: errorInfo.componentStack || undefined,
    });

    // Auto-reload on chunk load errors (stale deployment)
    if (this.isChunkLoadError(error)) {
      const reloadKey = 'chunk_error_reload';
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    } else {
      // Clear the flag so future chunk errors can trigger a reload
      sessionStorage.removeItem('chunk_error_reload');
    }
  }

  private isChunkLoadError(error: Error): boolean {
    const msg = error.message || '';
    return (
      error.name === 'ChunkLoadError' ||
      msg.includes('Loading chunk') ||
      msg.includes('dynamically imported module')
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const level = this.props.level || 'component';
      const isGlobal = level === 'global';

      return (
        <div className={`flex items-center justify-center ${isGlobal ? 'min-h-screen' : 'min-h-[400px]'} bg-gray-50 p-6`}>
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isGlobal ? 'Application Error' : 'Something went wrong'}
            </h2>
            <p className="text-gray-600 mb-6">
              {isGlobal
                ? 'The application encountered an unexpected error. Please try refreshing the page.'
                : 'This section encountered an error. You can try again or navigate away.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              {isGlobal && (
                <button
                  onClick={this.handleGoHome}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
