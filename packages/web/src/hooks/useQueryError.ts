import { useEffect } from 'react';
import { UseQueryResult } from '@tanstack/react-query';

/**
 * Hook to handle and display query errors.
 * Can be used to show toast notifications or log errors.
 */
export function useQueryError(
  query: UseQueryResult<unknown, Error>,
  context?: string
): { error: Error | null; isError: boolean; errorMessage: string | null } {
  const { error, isError } = query;

  useEffect(() => {
    if (isError && error) {
      const prefix = context ? `[${context}] ` : '';
      console.error(`${prefix}Query error:`, error.message);
    }
  }, [isError, error, context]);

  return {
    error: error ?? null,
    isError,
    errorMessage: error?.message ?? null,
  };
}

/**
 * Format error message for display to users.
 */
export function formatQueryError(error: Error | null): string {
  if (!error) return 'An unexpected error occurred';
  
  const message = error.message;
  
  // Handle common error patterns
  if (message.includes('fetch failed') || message.includes('NetworkError')) {
    return 'Unable to connect to the server. Please check your connection.';
  }
  
  if (message.includes('401') || message.includes('Unauthorized')) {
    return 'Authentication failed. Please check your API key.';
  }
  
  if (message.includes('403') || message.includes('Forbidden')) {
    return 'Access denied. You may not have permission for this action.';
  }
  
  if (message.includes('404') || message.includes('Not found')) {
    return 'The requested resource was not found.';
  }
  
  if (message.includes('429') || message.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return 'Server error. Please try again later.';
  }
  
  if (message.includes('timeout')) {
    return 'Request timed out. The server may be slow or unreachable.';
  }
  
  // Return the original message for other errors
  return message;
}

/**
 * Check if an error is retryable (network issues, timeouts, 5xx errors).
 */
export function isRetryableError(error: Error | null): boolean {
  if (!error) return false;
  
  const message = error.message.toLowerCase();
  
  return (
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('timeout') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  );
}
