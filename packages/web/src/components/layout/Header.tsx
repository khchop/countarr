import { useLocation } from 'react-router-dom';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { useState } from 'react';
import { TimeRangeSelector } from './TimeRangeSelector';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/movies': 'Movies',
  '/tv': 'TV Shows',
  '/release-groups': 'Release Groups',
  '/genres': 'Genres',
  '/records': 'Records & Fun Stats',
  '/subtitles': 'Subtitles',
  '/downloads': 'Download Statistics',
  '/quality': 'Quality Analytics',
  '/media': 'Media Library',
  '/playback': 'Playback Statistics',
  '/indexers': 'Indexer Performance',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Track if any queries are currently fetching
  const isFetchingCount = useIsFetching();
  const isAnyFetching = isFetchingCount > 0;

  const title = pageTitles[location.pathname] || 'Countarr';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  return (
    <header className="h-16 bg-background-secondary border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{title}</h1>
        
        {/* Global fetching indicator */}
        {isAnyFetching && !isRefreshing && (
          <div className="flex items-center gap-2 text-accent-blue">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-text-muted">Loading...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <TimeRangeSelector />

        <button
          onClick={handleRefresh}
          className="p-2 text-text-muted hover:text-text hover:bg-background-tertiary rounded-lg transition-colors"
          title="Refresh data"
          disabled={isRefreshing}
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
}
