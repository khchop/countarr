import { FastifyInstance } from 'fastify';
import { db, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { scheduler } from '../../scheduler/index.js';
import { config } from '../../config.js';
import * as connectionService from '../../services/connections.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Get current settings
  fastify.get('/', async () => {
    // Get settings from DB
    const settings = await db.query.settings.findMany();
    const settingsMap: Record<string, any> = {};

    for (const s of settings) {
      try {
        settingsMap[s.key] = JSON.parse(s.value);
      } catch {
        settingsMap[s.key] = s.value;
      }
    }

    // Get configured service types
    const configuredTypes = await connectionService.getConfiguredServiceTypes();

    return {
      configuredServices: configuredTypes,
      pollIntervals: {
        history: settingsMap.pollIntervalHistory ?? config.defaultPollIntervalHistory,
        metadata: settingsMap.pollIntervalMetadata ?? config.defaultPollIntervalMetadata,
        playback: settingsMap.pollIntervalPlayback ?? config.defaultPollIntervalPlayback,
      },
      historyImportMonths: settingsMap.historyImportMonths ?? config.defaultHistoryImportMonths,
      favoriteReleaseGroups: settingsMap.favoriteReleaseGroups ?? [],
      defaultTimeRange: settingsMap.defaultTimeRange ?? '30d',
    };
  });

  // Update settings
  fastify.patch('/', async (request, reply) => {
    const body = request.body as Record<string, any>;

    for (const [key, value] of Object.entries(body)) {
      const jsonValue = JSON.stringify(value);

      await db.insert(schema.settings)
        .values({ key, value: jsonValue })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: jsonValue },
        });
    }

    return { success: true };
  });

  // Trigger manual sync
  fastify.post('/sync', async (request, reply) => {
    const body = request.body as { type?: 'full' | 'history' | 'metadata' | 'playback' };
    const syncType = body.type ?? 'full';

    // Check if sync is already running
    const currentStatus = scheduler.getSyncStatus();
    if (currentStatus.isRunning) {
      return reply.status(409).send({ 
        error: 'Sync already in progress',
        currentType: currentStatus.currentSyncType,
        startedAt: currentStatus.startedAt,
      });
    }

    // Run sync in background
    switch (syncType) {
      case 'full':
        scheduler.runFullSync().catch(console.error);
        break;
      case 'history':
        scheduler.runHistorySync().catch(console.error);
        break;
      case 'metadata':
        scheduler.runMetadataSync().catch(console.error);
        break;
      case 'playback':
        scheduler.runPlaybackSync().catch(console.error);
        break;
    }

    return { success: true, message: `${syncType} sync started` };
  });

  // Get detailed sync status (for polling)
  fastify.get('/sync-status', async () => {
    return scheduler.getSyncStatus();
  });

  // Get scheduler status
  fastify.get('/scheduler', async () => {
    return scheduler.getStatus();
  });

  // Get sync state (legacy, per-connection state from DB)
  fastify.get('/sync-state', async () => {
    const states = await db.query.syncState.findMany();
    return states;
  });
}
