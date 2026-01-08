import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  Film,
  Tv,
  Subtitles,
  Search,
  MessageCircle,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

const SERVICE_ICONS: Record<string, typeof Film> = {
  radarr: Film,
  sonarr: Tv,
  bazarr: Subtitles,
  prowlarr: Search,
  jellyseerr: MessageCircle,
  emby: Play,
  jellyfin: Play,
};

const SERVICE_COLORS: Record<string, string> = {
  radarr: 'text-yellow-500',
  sonarr: 'text-blue-500',
  bazarr: 'text-purple-500',
  prowlarr: 'text-orange-500',
  jellyseerr: 'text-pink-500',
  emby: 'text-green-500',
  jellyfin: 'text-cyan-500',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
  return `${Math.floor(diffMs / 86400000)}d ago`;
}

interface SyncStatusProps {
  onTriggerSync?: (type: 'full' | 'history' | 'metadata' | 'playback') => void;
  isSyncPending?: boolean;
}

export function SyncStatus({ onTriggerSync, isSyncPending }: SyncStatusProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());

  const { data: status, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => api.settings.syncStatus(),
    refetchInterval: (query) => {
      // Poll more frequently when sync is running
      return query.state.data?.isRunning ? 1000 : 5000;
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 bg-background-secondary rounded-lg animate-pulse">
        <div className="h-6 bg-background-tertiary rounded w-1/3 mb-2" />
        <div className="h-4 bg-background-tertiary rounded w-1/2" />
      </div>
    );
  }

  const toggleErrorExpand = (id: number) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Calculate overall progress
  const completedTasks = status?.tasks.filter((t) => t.status === 'completed' || t.status === 'error').length ?? 0;
  const totalTasks = status?.tasks.length ?? 0;
  const hasErrors = status?.tasks.some((t) => t.status === 'error' || (t.result?.errors?.length ?? 0) > 0);

  return (
    <div className="space-y-4">
      {/* Current Status Banner */}
      <div
        className={`p-4 rounded-lg border ${
          status?.isRunning
            ? 'bg-accent-blue/10 border-accent-blue/30'
            : hasErrors && status?.lastSync
            ? 'bg-accent-yellow/10 border-accent-yellow/30'
            : status?.lastSync
            ? 'bg-accent-green/10 border-accent-green/30'
            : 'bg-background-secondary border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {status?.isRunning ? (
              <>
                <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
                <div>
                  <p className="font-medium text-accent-blue">
                    {status.currentSyncType === 'full' ? 'Full Sync' : `${status.currentSyncType?.charAt(0).toUpperCase()}${status.currentSyncType?.slice(1)} Sync`} in Progress
                  </p>
                  <p className="text-sm text-text-muted">
                    {completedTasks}/{totalTasks} tasks completed
                  </p>
                </div>
              </>
            ) : status?.lastSync ? (
              <>
                {hasErrors ? (
                  <AlertTriangle className="w-5 h-5 text-accent-yellow" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-accent-green" />
                )}
                <div>
                  <p className={`font-medium ${hasErrors ? 'text-accent-yellow' : 'text-accent-green'}`}>
                    Last Sync: {status.lastSync.type.charAt(0).toUpperCase() + status.lastSync.type.slice(1)}
                    {hasErrors ? ' (with errors)' : ' Complete'}
                  </p>
                  <p className="text-sm text-text-muted">
                    {formatTimeAgo(status.lastSync.completedAt)} &middot; {formatDuration(status.lastSync.duration)} &middot; {status.lastSync.totalProcessed} items
                    {status.lastSync.totalErrors > 0 && (
                      <span className="text-accent-red"> &middot; {status.lastSync.totalErrors} errors</span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock className="w-5 h-5 text-text-muted" />
                <div>
                  <p className="font-medium text-text-muted">No sync has run yet</p>
                  <p className="text-sm text-text-dim">Trigger a sync to start collecting data</p>
                </div>
              </>
            )}
          </div>

          {/* Toggle Details */}
          {(status?.isRunning || (status?.tasks && status.tasks.length > 0)) && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
            >
              {showDetails ? 'Hide' : 'Show'} Details
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {status?.isRunning && totalTasks > 0 && (
          <div className="mt-3">
            <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-blue transition-all duration-300"
                style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Task Details */}
      {showDetails && status?.tasks && status.tasks.length > 0 && (
        <div className="space-y-2">
          {status.tasks.map((task) => {
            const Icon = SERVICE_ICONS[task.connectionType] ?? RefreshCw;
            const colorClass = SERVICE_COLORS[task.connectionType] ?? 'text-text-muted';
            const hasTaskErrors = task.status === 'error' || (task.result?.errors?.length ?? 0) > 0;
            const isExpanded = expandedErrors.has(task.connectionId);

            return (
              <div
                key={`${task.connectionId}-${task.syncType}`}
                className={`p-3 rounded-lg border ${
                  task.status === 'running'
                    ? 'bg-accent-blue/5 border-accent-blue/20'
                    : task.status === 'error'
                    ? 'bg-accent-red/5 border-accent-red/20'
                    : task.status === 'completed'
                    ? 'bg-background-secondary border-border'
                    : 'bg-background-secondary/50 border-border/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.connectionName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-background-tertiary text-text-muted">
                          {task.syncType}
                        </span>
                      </div>
                      {task.progress && task.status === 'running' && (
                        <p className="text-sm text-text-muted">{task.progress.message}</p>
                      )}
                      {task.result && task.status !== 'running' && (
                        <p className="text-sm text-text-muted">
                          {task.result.processed} processed
                          {task.result.added !== undefined && ` (${task.result.added} added)`}
                          {task.result.errors.length > 0 && (
                            <span className="text-accent-red"> &middot; {task.result.errors.length} errors</span>
                          )}
                        </p>
                      )}
                      {task.error && (
                        <p className="text-sm text-accent-red">{task.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Icon */}
                    {task.status === 'pending' && (
                      <Clock className="w-4 h-4 text-text-muted" />
                    )}
                    {task.status === 'running' && (
                      <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
                    )}
                    {task.status === 'completed' && !hasTaskErrors && (
                      <CheckCircle className="w-4 h-4 text-accent-green" />
                    )}
                    {(task.status === 'error' || hasTaskErrors) && (
                      <button
                        onClick={() => toggleErrorExpand(task.connectionId)}
                        className="flex items-center gap-1 text-accent-red hover:text-accent-red/80"
                      >
                        <XCircle className="w-4 h-4" />
                        {(task.result?.errors?.length ?? 0) > 0 && (
                          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Errors */}
                {isExpanded && task.result?.errors && task.result.errors.length > 0 && (
                  <div className="mt-3 p-2 bg-accent-red/10 rounded text-sm">
                    <p className="font-medium text-accent-red mb-1">Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-text-muted max-h-32 overflow-y-auto">
                      {task.result.errors.slice(0, 10).map((error, i) => (
                        <li key={i} className="truncate">{error}</li>
                      ))}
                      {task.result.errors.length > 10 && (
                        <li className="text-text-dim">...and {task.result.errors.length - 10} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sync Buttons */}
      {onTriggerSync && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onTriggerSync('full')}
            disabled={status?.isRunning || isSyncPending}
            className="flex items-center justify-center gap-2 py-3 bg-accent-blue text-white rounded-lg hover:bg-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status?.isRunning && status.currentSyncType === 'full' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Full Sync
          </button>
          <button
            onClick={() => onTriggerSync('history')}
            disabled={status?.isRunning || isSyncPending}
            className="py-3 bg-background-tertiary rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status?.isRunning && status.currentSyncType === 'history' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            History
          </button>
          <button
            onClick={() => onTriggerSync('metadata')}
            disabled={status?.isRunning || isSyncPending}
            className="py-3 bg-background-tertiary rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status?.isRunning && status.currentSyncType === 'metadata' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Metadata
          </button>
          <button
            onClick={() => onTriggerSync('playback')}
            disabled={status?.isRunning || isSyncPending}
            className="py-3 bg-background-tertiary rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status?.isRunning && status.currentSyncType === 'playback' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            Playback
          </button>
        </div>
      )}
    </div>
  );
}
