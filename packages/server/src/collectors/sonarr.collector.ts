import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { SonarrClient, SonarrSeries, SonarrEpisode, SonarrHistoryRecord } from '../clients/sonarr.js';
import { parseQuality, parseReleaseGroup } from '../utils/quality-parser.js';

export class SonarrCollector {
  private client: SonarrClient;
  private connectionId: number;

  constructor(url: string, apiKey: string, connectionId: number) {
    this.client = new SonarrClient({ baseUrl: url, apiKey });
    this.connectionId = connectionId;
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  async syncSeries(): Promise<{ added: number; updated: number; errors: string[] }> {
    const result = { added: 0, updated: 0, errors: [] as string[] };

    try {
      const allSeries = await this.client.getSeries();
      console.log(`[Sonarr] Syncing ${allSeries.length} series`);

      for (const series of allSeries) {
        try {
          await this.upsertSeries(series);
          result.added++;
        } catch (err) {
          result.errors.push(`Failed to sync series ${series.title}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Failed to fetch series: ${err}`);
    }

    return result;
  }

  async syncHistory(sinceDate?: string, importMonths = 12): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      let page = 1;
      let hasMore = true;
      const pageSize = 100;
      const cutoffDate = sinceDate ?? this.getCutoffDate(importMonths);

      while (hasMore) {
        const history = await this.client.getHistory(page, pageSize);
        if (!history || history.records.length === 0) {
          hasMore = false;
          break;
        }

        for (const record of history.records) {
          // Stop if we've gone past our cutoff date
          if (new Date(record.date) < new Date(cutoffDate)) {
            console.log(`[Sonarr] Record ${record.id} is before cutoff, stopping`);
            hasMore = false;
            break;
          }

          try {
            await this.processHistoryRecord(record);
            result.processed++;
          } catch (err) {
            console.error(`[Sonarr] Error processing record ${record.id}:`, err);
            result.errors.push(`Failed to process history record ${record.id}: ${err}`);
          }
        }

        if (history.records.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[Sonarr] Processed ${result.processed} history records`);
    } catch (err) {
      result.errors.push(`Failed to fetch history: ${err}`);
    }

    return result;
  }

  private getCutoffDate(months: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date.toISOString();
  }

  private async upsertSeries(series: SonarrSeries): Promise<number> {
    const existing = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.connectionId, this.connectionId),
        eq(schema.mediaItems.externalId, String(series.id))
      ),
    });

    const posterImage = series.images.find(i => i.coverType === 'poster');
    const posterUrl = posterImage?.remoteUrl ?? posterImage?.url ?? null;

    const data = {
      externalId: String(series.id),
      connectionId: this.connectionId,
      source: 'sonarr' as const,
      type: 'series' as const,
      title: series.title,
      year: series.year,
      tmdbId: null, // Sonarr primarily uses TVDB
      imdbId: series.imdbId || null,
      tvdbId: series.tvdbId,
      runtimeMinutes: series.runtime,
      addedAt: series.added,
      sizeBytes: series.statistics?.sizeOnDisk ?? 0,
      quality: null,
      posterUrl,
      genres: JSON.stringify(series.genres ?? []),
      metadata: JSON.stringify({
        network: series.network,
        certification: series.certification,
        seriesType: series.seriesType,
        status: series.status,
        ended: series.ended,
        seasonCount: series.statistics?.seasonCount ?? 0,
        episodeCount: series.statistics?.episodeCount ?? 0,
        monitored: series.monitored,
      }),
    };

    if (existing) {
      await db.update(schema.mediaItems)
        .set(data)
        .where(eq(schema.mediaItems.id, existing.id));
      return existing.id;
    } else {
      const result = await db.insert(schema.mediaItems).values(data).returning({ id: schema.mediaItems.id });
      return result[0].id;
    }
  }

  private async upsertEpisode(mediaItemId: number, episode: SonarrEpisode): Promise<number> {
    const existing = await db.query.episodes.findFirst({
      where: and(
        eq(schema.episodes.mediaItemId, mediaItemId),
        eq(schema.episodes.season, episode.seasonNumber),
        eq(schema.episodes.episode, episode.episodeNumber)
      ),
    });

    const data = {
      mediaItemId,
      externalId: String(episode.id),
      season: episode.seasonNumber,
      episode: episode.episodeNumber,
      title: episode.title,
      sizeBytes: episode.episodeFile?.size ?? 0,
      quality: episode.episodeFile?.quality.quality.name ?? null,
      airDate: episode.airDate,
    };

    if (existing) {
      await db.update(schema.episodes)
        .set(data)
        .where(eq(schema.episodes.id, existing.id));
      return existing.id;
    } else {
      const result = await db.insert(schema.episodes).values(data).returning({ id: schema.episodes.id });
      return result[0].id;
    }
  }

  private async processHistoryRecord(record: SonarrHistoryRecord): Promise<void> {
    if (!record.series) {
      console.warn(`[Sonarr] History record ${record.id} has no series data`);
      return;
    }

    console.log(`[Sonarr] Processing record ${record.id}, event: ${record.eventType}, series: ${record.series.title}`);
    const mediaItemId = await this.upsertSeries(record.series);

    // Get or create episode if present
    let episodeId: number | null = null;
    if (record.episode) {
      episodeId = await this.upsertEpisode(mediaItemId, record.episode);
    }

    // Check if event already exists
    const existingEvent = await db.query.downloadEvents.findFirst({
      where: and(
        eq(schema.downloadEvents.sourceApp, 'sonarr'),
        eq(schema.downloadEvents.mediaItemId, mediaItemId),
        eq(schema.downloadEvents.timestamp, record.date),
        eq(schema.downloadEvents.eventType, this.mapEventType(record.eventType))
      ),
    });

    if (existingEvent) {
      return;
    }

    const parsed = parseQuality(record.sourceTitle);
    const releaseGroup = parseReleaseGroup(record.sourceTitle) ?? record.data.releaseGroup ?? null;
    const sizeBytes = record.data.size ? parseInt(record.data.size, 10) : 0;

    // Determine if this is an upgrade by checking for previous downloads of the same episode
    let isUpgrade = false;
    let previousSizeBytes: number | null = null;

    if (record.eventType === 'downloadFolderImported' && episodeId) {
      // Check if there was a previous download for this specific episode
      const previousDownload = await db.query.downloadEvents.findFirst({
        where: and(
          eq(schema.downloadEvents.sourceApp, 'sonarr'),
          eq(schema.downloadEvents.episodeId, episodeId),
          eq(schema.downloadEvents.eventType, 'downloaded')
        ),
        orderBy: [desc(schema.downloadEvents.timestamp)],
      });

      if (previousDownload) {
        isUpgrade = true;
        previousSizeBytes = previousDownload.sizeBytes;
      }
    }

    await db.insert(schema.downloadEvents).values({
      mediaItemId,
      episodeId,
      connectionId: this.connectionId,
      eventType: this.mapEventType(record.eventType),
      timestamp: record.date,
      sizeBytes,
      quality: record.quality.quality.name,
      qualitySource: parsed.source,
      resolution: parsed.resolution,
      videoCodec: parsed.videoCodec,
      audioCodec: parsed.audioCodec,
      releaseGroup,
      releaseTitle: record.sourceTitle,
      indexer: record.data.indexer ?? null,
      downloadClient: record.data.downloadClient ?? record.data.downloadClientName ?? null,
      sourceApp: 'sonarr',
      qualityScore: parsed.qualityScore,
      rawData: JSON.stringify(record),
      isUpgrade,
      previousSizeBytes,
    });
  }

  private mapEventType(eventType: string): string {
    const mapping: Record<string, string> = {
      'grabbed': 'grabbed',
      'downloadFolderImported': 'downloaded',
      'downloadFailed': 'deleted',
      'episodeFileDeleted': 'deleted',
      'episodeFileRenamed': 'renamed',
      'downloadIgnored': 'deleted',
      'seriesDelete': 'deleted',
    };
    return mapping[eventType] ?? eventType;
  }

  async getLastSyncedHistoryDate(): Promise<string | null> {
    const lastEvent = await db.query.downloadEvents.findFirst({
      where: eq(schema.downloadEvents.connectionId, this.connectionId),
      orderBy: [desc(schema.downloadEvents.timestamp)],
    });
    return lastEvent?.timestamp ?? null;
  }
}
