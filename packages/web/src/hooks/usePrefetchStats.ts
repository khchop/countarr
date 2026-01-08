import { useEffect } from 'react';
import { useQueryClient, useIsFetching as useIsFetchingQuery } from '@tanstack/react-query';
import { api, TimeRange } from '@/api/client';

const TIME_RANGES: TimeRange[] = ['24h', '7d', '30d', '90d', '1y', 'all'];

/**
 * Prefetches Dashboard stats for all time ranges in the background.
 * This ensures smooth transitions when switching time ranges on the dashboard.
 * 
 * Only prefetches Dashboard endpoints to avoid overwhelming the server.
 * Other pages rely on keepPreviousData for smooth transitions.
 * 
 * Call this once at the app root level.
 */
export function usePrefetchStats() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchDashboard = async () => {
      // Wait for initial page load to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Only prefetch Dashboard endpoints for non-default time ranges
      // The default range is already loaded, so skip it
      for (const range of TIME_RANGES) {
        // Prefetch in parallel per time range (5 requests at once is fine)
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['stats', 'overview', range],
            queryFn: () => api.stats.overview(range),
          }),
          queryClient.prefetchQuery({
            queryKey: ['stats', 'downloads', range],
            queryFn: () => api.stats.downloads(range),
          }),
          queryClient.prefetchQuery({
            queryKey: ['stats', 'quality', range],
            queryFn: () => api.stats.quality(range),
          }),
          queryClient.prefetchQuery({
            queryKey: ['stats', 'release-groups', range, undefined],
            queryFn: () => api.stats.releaseGroups(range),
          }),
          queryClient.prefetchQuery({
            queryKey: ['stats', 'records', range],
            queryFn: () => api.stats.records(range),
          }),
        ]);
        
        // Small delay between time range batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    prefetchDashboard();
  }, [queryClient]);
}

/**
 * Hook to check if any queries are currently fetching.
 * Useful for showing a global loading indicator.
 */
export function useIsAnyFetching() {
  return useIsFetchingQuery();
}
