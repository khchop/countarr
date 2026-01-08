import { ReactNode } from 'react';
import { QueryError } from './QueryError';

interface QuerySectionProps {
  /** True when the query is in initial loading state */
  isLoading: boolean;
  /** True when fetching (including background refetch) */
  isFetching?: boolean;
  /** The data from the query - used to determine if we have content to show */
  data?: unknown;
  /** True when showing placeholder data from previous query */
  isPlaceholderData?: boolean;
  /** Error state from useQuery */
  error: Error | null;
  /** Refetch function from useQuery */
  onRetry?: () => void;
  /** Loading skeleton to show on initial load */
  skeleton: ReactNode;
  /** Content to show when loaded successfully */
  children: ReactNode;
  /** Optional class name for the error wrapper */
  errorClassName?: string;
  /** Optional class name for the content wrapper */
  className?: string;
}

/**
 * Wrapper component that handles loading, error, and success states for query-based sections.
 * 
 * Key behaviors:
 * - Shows skeleton ONLY on true initial load (no data at all)
 * - Shows content with reduced opacity during background fetches (smooth 300ms transition)
 * - Never shows skeleton if we have any data (including placeholder data)
 * 
 * The wrapper div ensures CSS transitions work correctly by:
 * 1. Always having the transition property applied
 * 2. Only toggling the opacity value, not adding/removing classes
 */
export function QuerySection({
  isLoading,
  isFetching,
  data,
  isPlaceholderData,
  error,
  onRetry,
  skeleton,
  children,
  errorClassName,
  className = '',
}: QuerySectionProps) {
  // Determine if we have any data to show (real or placeholder)
  const hasData = data !== undefined && data !== null;
  
  // Only show skeleton when we have absolutely no data
  // With keepPreviousData, we should almost never hit this after initial load
  if (isLoading && !hasData) {
    return <>{skeleton}</>;
  }

  // Show error state
  if (error && !hasData) {
    return <QueryError error={error} onRetry={onRetry} className={errorClassName} />;
  }

  // Determine if we should show the fetching indicator (reduced opacity)
  // This happens when:
  // 1. We're fetching new data (isFetching is true)
  // 2. We're showing placeholder data from a previous query
  const showFetchingState = isFetching || isPlaceholderData;

  // Render content with transition wrapper
  // The wrapper div has:
  // - transition-opacity duration-300: Always present for smooth animations
  // - opacity-100 or opacity-50: Toggled based on fetching state
  // - contents: Preserves grid/flex layout of parent
  return (
    <div 
      className={`transition-opacity duration-300 ease-in-out ${showFetchingState ? 'opacity-50' : 'opacity-100'} ${className}`.trim()}
      style={{ display: 'contents' }}
    >
      {children}
    </div>
  );
}

/**
 * Grid-aware query section - alias for QuerySection.
 * Both now handle grid layouts correctly via display: contents.
 */
export const QueryGrid = QuerySection;
