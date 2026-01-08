import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { formatQueryError, isRetryableError } from '@/hooks/useQueryError';

interface QueryErrorProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/**
 * Component to display query errors with retry functionality.
 */
export function QueryError({ error, onRetry, className = '', compact = false }: QueryErrorProps) {
  if (!error) return null;

  const message = formatQueryError(error);
  const isRetryable = isRetryableError(error);
  const isNetworkError = error.message.includes('fetch failed') || error.message.includes('NetworkError');

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-red-400 text-sm ${className}`}>
        {isNetworkError ? (
          <WifiOff className="w-4 h-4 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        )}
        <span>{message}</span>
        {onRetry && isRetryable && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-accent-blue hover:text-accent-blue/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`panel p-4 bg-red-500/10 border border-red-500/20 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-red-500/20 rounded-full flex-shrink-0">
          {isNetworkError ? (
            <WifiOff className="w-5 h-5 text-red-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-red-400 mb-1">
            {isNetworkError ? 'Connection Error' : 'Error Loading Data'}
          </h3>
          <p className="text-text-muted text-sm">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline error message for use within other components.
 */
export function InlineError({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  if (!error) return null;

  return (
    <div className="flex items-center justify-center gap-2 p-4 text-red-400">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm">{formatQueryError(error)}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-accent-blue hover:text-accent-blue/80 transition-colors"
          title="Retry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
