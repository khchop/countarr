import cron from 'node-cron';
import { config } from '../config.js';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import * as connectionService from '../services/connections.js';
import type { ServiceType } from '../services/connections.js';

// Service capability definitions
const SERVICE_CAPABILITIES = {
  radarr: { history: true, metadata: true, playback: false, stats: false },
  sonarr: { history: true, metadata: true, playback: false, stats: false },
  bazarr: { history: true, metadata: false, playback: false, stats: false },
  prowlarr: { history: true, metadata: false, playback: false, stats: true },
  jellyseerr: { history: true, metadata: false, playback: false, stats: false },
  emby: { history: false, metadata: false, playback: true, stats: false },
  jellyfin: { history: false, metadata: false, playback: true, stats: false },
} as const;

// Sync status types
export interface SyncTaskStatus {
  connectionId: number;
  connectionName: string;
  connectionType: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  syncType: 'history' | 'metadata' | 'playback' | 'stats';
  startedAt?: string;
  completedAt?: string;
  progress?: {
    current: number;
    total: number;
    message: string;
  };
  result?: {
    processed: number;
    added?: number;
    updated?: number;
    errors: string[];
  };
  error?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  currentSyncType: 'full' | 'history' | 'metadata' | 'playback' | null;
  startedAt: string | null;
  tasks: SyncTaskStatus[];
  lastSync: {
    type: string;
    completedAt: string;
    duration: number;
    totalProcessed: number;
    totalErrors: number;
  } | null;
}

export class Scheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  
  // Mutex lock to prevent concurrent sync operations
  private syncLock = false;
  
  // Sync status tracking
  private syncStatus: SyncStatus = {
    isRunning: false,
    currentSyncType: null,
    startedAt: null,
    tasks: [],
    lastSync: null,
  };
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  
  // Maximum number of status listeners to prevent memory leaks
  private readonly MAX_LISTENERS = 100;

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Scheduler] Starting...');

    // Get poll intervals from settings or use defaults
    const settings = await this.getSettings();
    const historyInterval = settings.pollIntervalHistory;
    const metadataInterval = settings.pollIntervalMetadata;
    const playbackInterval = settings.pollIntervalPlayback;

    // Schedule history sync with error handling
    const historyCron = `*/${historyInterval} * * * *`;
    this.jobs.set('history', cron.schedule(historyCron, async () => {
      try {
        await this.runHistorySync();
      } catch (err) {
        console.error('[Scheduler] History sync failed with uncaught error:', err);
      }
    }));

    // Schedule metadata sync with error handling
    const metadataCron = `*/${metadataInterval} * * * *`;
    this.jobs.set('metadata', cron.schedule(metadataCron, async () => {
      try {
        await this.runMetadataSync();
      } catch (err) {
        console.error('[Scheduler] Metadata sync failed with uncaught error:', err);
      }
    }));

    // Schedule playback sync with error handling
    const playbackCron = `*/${playbackInterval} * * * *`;
    this.jobs.set('playback', cron.schedule(playbackCron, async () => {
      try {
        await this.runPlaybackSync();
      } catch (err) {
        console.error('[Scheduler] Playback sync failed with uncaught error:', err);
      }
    }));

    // Run initial sync if we have connections
    const hasConnections = await connectionService.hasAnyConnections();
    if (hasConnections) {
      console.log('[Scheduler] Running initial sync...');
      await this.runFullSync();
    } else {
      console.log('[Scheduler] No connections configured - skipping initial sync');
    }

    console.log('[Scheduler] Started with intervals:');
    console.log(`  - History: every ${historyInterval} minutes`);
    console.log(`  - Metadata: every ${metadataInterval} minutes`);
    console.log(`  - Playback: every ${playbackInterval} minutes`);
  }

  private async getSettings() {
    const settings = await db.query.settings.findMany();
    const map: Record<string, any> = {};
    for (const s of settings) {
      try {
        map[s.key] = JSON.parse(s.value);
      } catch {
        map[s.key] = s.value;
      }
    }

    return {
      pollIntervalHistory: map.pollIntervalHistory ?? config.defaultPollIntervalHistory,
      pollIntervalMetadata: map.pollIntervalMetadata ?? config.defaultPollIntervalMetadata,
      pollIntervalPlayback: map.pollIntervalPlayback ?? config.defaultPollIntervalPlayback,
      historyImportMonths: map.historyImportMonths ?? config.defaultHistoryImportMonths,
    };
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[Scheduler] Stopping...');

    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`[Scheduler] Stopped job: ${name}`);
    }

    this.jobs.clear();
    this.isRunning = false;
  }

  // Check if a service supports a capability
  private serviceSupports(type: string, capability: 'history' | 'metadata' | 'playback' | 'stats'): boolean {
    const caps = SERVICE_CAPABILITIES[type as keyof typeof SERVICE_CAPABILITIES];
    return caps?.[capability] ?? false;
  }

  // Status management
  private updateStatus(updates: Partial<SyncStatus>) {
    this.syncStatus = { ...this.syncStatus, ...updates };
    this.notifyListeners();
  }

  private updateTaskStatus(connectionId: number, syncType: string, updates: Partial<SyncTaskStatus>) {
    const taskIndex = this.syncStatus.tasks.findIndex(
      t => t.connectionId === connectionId && t.syncType === syncType
    );
    
    if (taskIndex >= 0) {
      this.syncStatus.tasks[taskIndex] = {
        ...this.syncStatus.tasks[taskIndex],
        ...updates,
      };
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.statusListeners) {
      try {
        listener(this.getSyncStatus());
      } catch (e) {
        // Ignore listener errors
      }
    }
  }

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    // Prevent memory leaks by limiting listeners
    if (this.statusListeners.size >= this.MAX_LISTENERS) {
      console.warn('[Scheduler] Max status listeners reached, removing oldest');
      const firstListener = this.statusListeners.values().next().value;
      if (firstListener) {
        this.statusListeners.delete(firstListener);
      }
    }
    
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus, tasks: [...this.syncStatus.tasks] };
  }

  private startSync(type: 'full' | 'history' | 'metadata' | 'playback') {
    this.updateStatus({
      isRunning: true,
      currentSyncType: type,
      startedAt: new Date().toISOString(),
      tasks: [],
    });
  }

  private async completeSync(type: string, startTime: Date) {
    const duration = Date.now() - startTime.getTime();
    const totalProcessed = this.syncStatus.tasks.reduce(
      (sum, t) => sum + (t.result?.processed ?? 0), 0
    );
    const totalErrors = this.syncStatus.tasks.reduce(
      (sum, t) => sum + (t.result?.errors?.length ?? 0) + (t.error ? 1 : 0), 0
    );

    this.updateStatus({
      isRunning: false,
      currentSyncType: null,
      lastSync: {
        type,
        completedAt: new Date().toISOString(),
        duration,
        totalProcessed,
        totalErrors,
      },
    });
  }

  async runFullSync(): Promise<void> {
    // Acquire lock atomically to prevent race conditions
    if (this.syncLock) {
      console.log('[Scheduler] Sync already in progress (locked), skipping');
      return;
    }
    this.syncLock = true;

    const startTime = new Date();
    console.log('[Scheduler] Running full sync...');
    
    try {
      this.startSync('full');

      // Run all sync types sequentially to avoid overwhelming services
      await this.runMetadataSync(false);
      await this.runHistorySync(false);
      await this.runPlaybackSync(false);

      await this.completeSync('full', startTime);
      console.log('[Scheduler] Full sync complete');
    } catch (err) {
      console.error('[Scheduler] Full sync failed:', err);
      this.updateStatus({
        isRunning: false,
        currentSyncType: null,
      });
    } finally {
      this.syncLock = false;
    }
  }

  async runHistorySync(standalone = true): Promise<void> {
    // Use lock for standalone runs
    if (standalone) {
      if (this.syncLock) {
        console.log('[Scheduler] Sync already in progress (locked), skipping history sync');
        return;
      }
      this.syncLock = true;
    }

    const startTime = new Date();
    if (standalone) {
      this.startSync('history');
    }
    
    try {
      const connections = await connectionService.getEnabledConnections();
      const settings = await this.getSettings();
      
      // Only add tasks for services that support history sync
      const historyConnections = connections.filter(c => this.serviceSupports(c.type, 'history'));
      
      for (const conn of historyConnections) {
        this.syncStatus.tasks.push({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionType: conn.type,
          status: 'pending',
          syncType: 'history',
        });
      }
      this.notifyListeners();

      // Process connections sequentially to avoid race conditions and overwhelming APIs
      for (const conn of historyConnections) {
        this.updateTaskStatus(conn.id, 'history', {
          status: 'running',
          startedAt: new Date().toISOString(),
          progress: { current: 0, total: 0, message: `Syncing ${conn.type} history...` },
        });

        try {
          const result = await this.syncConnectionHistory(conn, settings.historyImportMonths);
          
          this.updateTaskStatus(conn.id, 'history', {
            status: result.errors.length > 0 ? 'error' : 'completed',
            completedAt: new Date().toISOString(),
            result: {
              processed: result.processed,
              errors: result.errors,
            },
          });
          
          console.log(`[${conn.name}] History: ${result.processed} processed, ${result.errors.length} errors`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.updateTaskStatus(conn.id, 'history', {
            status: 'error',
            completedAt: new Date().toISOString(),
            error: errorMessage,
          });
          console.error(`[${conn.name}] History sync failed:`, err);
        }
      }

      if (standalone) {
        await this.completeSync('history', startTime);
      }
    } catch (err) {
      console.error('[Scheduler] History sync failed:', err);
      if (standalone) {
        this.updateStatus({
          isRunning: false,
          currentSyncType: null,
        });
      }
    } finally {
      if (standalone) {
        this.syncLock = false;
      }
    }
  }

  async runMetadataSync(standalone = true): Promise<void> {
    // Use lock for standalone runs
    if (standalone) {
      if (this.syncLock) {
        console.log('[Scheduler] Sync already in progress (locked), skipping metadata sync');
        return;
      }
      this.syncLock = true;
    }

    const startTime = new Date();
    if (standalone) {
      this.startSync('metadata');
    }

    try {
      const connections = await connectionService.getEnabledConnections();

      // Add tasks for metadata-supporting connections
      const metadataConnections = connections.filter(c => this.serviceSupports(c.type, 'metadata'));
      const statsConnections = connections.filter(c => this.serviceSupports(c.type, 'stats'));

      for (const conn of metadataConnections) {
        this.syncStatus.tasks.push({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionType: conn.type,
          status: 'pending',
          syncType: 'metadata',
        });
      }

      for (const conn of statsConnections) {
        this.syncStatus.tasks.push({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionType: conn.type,
          status: 'pending',
          syncType: 'stats',
        });
      }
      this.notifyListeners();

      // Process metadata syncs
      for (const conn of metadataConnections) {
        this.updateTaskStatus(conn.id, 'metadata', {
          status: 'running',
          startedAt: new Date().toISOString(),
          progress: { current: 0, total: 0, message: `Fetching ${conn.type} library...` },
        });

        try {
          const result = await this.syncConnectionMetadata(conn);
          
          this.updateTaskStatus(conn.id, 'metadata', {
            status: result.errors.length > 0 ? 'error' : 'completed',
            completedAt: new Date().toISOString(),
            result: {
              processed: result.synced,
              added: result.synced,
              errors: result.errors,
            },
          });
          
          console.log(`[${conn.name}] Metadata: ${result.synced} synced, ${result.errors.length} errors`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.updateTaskStatus(conn.id, 'metadata', {
            status: 'error',
            completedAt: new Date().toISOString(),
            error: errorMessage,
          });
          console.error(`[${conn.name}] Metadata sync failed:`, err);
        }
      }

      // Process stats syncs (Prowlarr)
      for (const conn of statsConnections) {
        this.updateTaskStatus(conn.id, 'stats', {
          status: 'running',
          startedAt: new Date().toISOString(),
          progress: { current: 0, total: 0, message: 'Fetching indexer stats...' },
        });

        try {
          const result = await this.syncProwlarrStats(conn);
          
          this.updateTaskStatus(conn.id, 'stats', {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: {
              processed: result.processed,
              errors: [],
            },
          });
          
          console.log(`[${conn.name}] Stats: ${result.processed} processed`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.updateTaskStatus(conn.id, 'stats', {
            status: 'error',
            completedAt: new Date().toISOString(),
            error: errorMessage,
          });
          console.error(`[${conn.name}] Stats sync failed:`, err);
        }
      }

      if (standalone) {
        await this.completeSync('metadata', startTime);
      }
    } catch (err) {
      console.error('[Scheduler] Metadata sync failed:', err);
      if (standalone) {
        this.updateStatus({
          isRunning: false,
          currentSyncType: null,
        });
      }
    } finally {
      if (standalone) {
        this.syncLock = false;
      }
    }
  }

  async runPlaybackSync(standalone = true): Promise<void> {
    // Use lock for standalone runs
    if (standalone) {
      if (this.syncLock) {
        console.log('[Scheduler] Sync already in progress (locked), skipping playback sync');
        return;
      }
      this.syncLock = true;
    }

    const startTime = new Date();
    if (standalone) {
      this.startSync('playback');
    }

    try {
      const connections = await connectionService.getEnabledConnections();
      
      // Only add tasks for playback-supporting connections
      const playbackConnections = connections.filter(c => this.serviceSupports(c.type, 'playback'));

      for (const conn of playbackConnections) {
        this.syncStatus.tasks.push({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionType: conn.type,
          status: 'pending',
          syncType: 'playback',
        });
      }
      this.notifyListeners();

      for (const conn of playbackConnections) {
        this.updateTaskStatus(conn.id, 'playback', {
          status: 'running',
          startedAt: new Date().toISOString(),
          progress: { current: 0, total: 0, message: 'Fetching playback data...' },
        });

        try {
          const result = await this.syncPlayback(conn);
          
          this.updateTaskStatus(conn.id, 'playback', {
            status: 'completed',
            completedAt: new Date().toISOString(),
            result: {
              processed: result.processed,
              errors: [],
            },
          });
          
          console.log(`[${conn.name}] Playback: ${result.processed} processed`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          this.updateTaskStatus(conn.id, 'playback', {
            status: 'error',
            completedAt: new Date().toISOString(),
            error: errorMessage,
          });
          console.error(`[${conn.name}] Playback sync failed:`, err);
        }
      }

      if (standalone) {
        await this.completeSync('playback', startTime);
      }
    } catch (err) {
      console.error('[Scheduler] Playback sync failed:', err);
      if (standalone) {
        this.updateStatus({
          isRunning: false,
          currentSyncType: null,
        });
      }
    } finally {
      if (standalone) {
        this.syncLock = false;
      }
    }
  }

  private async syncConnectionHistory(
    conn: schema.ServiceConnection,
    importMonths: number
  ): Promise<{ processed: number; errors: string[] }> {
    // Dynamically import collectors to avoid circular dependencies
    const { RadarrCollector } = await import('../collectors/radarr.collector.js');
    const { SonarrCollector } = await import('../collectors/sonarr.collector.js');
    const { BazarrCollector } = await import('../collectors/bazarr.collector.js');
    const { ProwlarrCollector } = await import('../collectors/prowlarr.collector.js');
    const { JellyseerrCollector } = await import('../collectors/jellyseerr.collector.js');

    switch (conn.type) {
      case 'radarr': {
        const collector = new RadarrCollector(conn.url, conn.apiKey, conn.id);
        return collector.syncHistory(undefined, importMonths);
      }
      case 'sonarr': {
        const collector = new SonarrCollector(conn.url, conn.apiKey, conn.id);
        return collector.syncHistory(undefined, importMonths);
      }
      case 'bazarr': {
        const collector = new BazarrCollector(conn.url, conn.apiKey, conn.id);
        return collector.syncHistory();
      }
      case 'prowlarr': {
        const collector = new ProwlarrCollector(conn.url, conn.apiKey, conn.id);
        return collector.syncHistory(importMonths);
      }
      case 'jellyseerr': {
        const collector = new JellyseerrCollector(conn.url, conn.apiKey, conn.id);
        return collector.syncRequests();
      }
      default:
        throw new Error(`Unsupported service type for history sync: ${conn.type}`);
    }
  }

  private async syncConnectionMetadata(
    conn: schema.ServiceConnection
  ): Promise<{ synced: number; errors: string[] }> {
    const { RadarrCollector } = await import('../collectors/radarr.collector.js');
    const { SonarrCollector } = await import('../collectors/sonarr.collector.js');

    switch (conn.type) {
      case 'radarr': {
        const collector = new RadarrCollector(conn.url, conn.apiKey, conn.id);
        const r = await collector.syncMovies();
        return { synced: r.added + r.updated, errors: r.errors };
      }
      case 'sonarr': {
        const collector = new SonarrCollector(conn.url, conn.apiKey, conn.id);
        const r = await collector.syncSeries();
        return { synced: r.added + r.updated, errors: r.errors };
      }
      default:
        throw new Error(`Unsupported service type for metadata sync: ${conn.type}`);
    }
  }

  private async syncProwlarrStats(
    conn: schema.ServiceConnection
  ): Promise<{ processed: number }> {
    const { ProwlarrCollector } = await import('../collectors/prowlarr.collector.js');
    const collector = new ProwlarrCollector(conn.url, conn.apiKey, conn.id);
    return collector.syncIndexerStats();
  }

  private async syncPlayback(
    conn: schema.ServiceConnection
  ): Promise<{ processed: number }> {
    const { EmbyCollector } = await import('../collectors/emby.collector.js');
    const collector = new EmbyCollector(conn.url, conn.apiKey, conn.id, conn.type === 'jellyfin');

    const sessions = await collector.syncPlaybackFromSessions();
    const played = await collector.syncPlayedItems();

    return { processed: sessions.processed + played.processed };
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    jobs: string[];
    configuredServices: string[];
    connectionCount: number;
  }> {
    const connections = await connectionService.getEnabledConnections();
    const types = await connectionService.getConfiguredServiceTypes();

    return {
      isRunning: this.isRunning,
      jobs: Array.from(this.jobs.keys()),
      configuredServices: types,
      connectionCount: connections.length,
    };
  }
}

// Export singleton instance
export const scheduler = new Scheduler();
