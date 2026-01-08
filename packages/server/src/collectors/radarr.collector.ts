import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { RadarrClient, RadarrMovie, RadarrHistoryRecord } from '../clients/radarr.js';
import { parseQuality, parseReleaseGroup } from '../utils/quality-parser.js';

export class RadarrCollector {
  private client: RadarrClient;

  constructor(url: string, apiKey: string) {
    this.client = new RadarrClient({ baseUrl: url, apiKey });
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  async syncMovies(): Promise<{ added: number; updated: number; errors: string[] }> {
    const result = { added: 0, updated: 0, errors: [] as string[] };

    try {
      const movies = await this.client.getMovies();
      console.log(`[Radarr] Syncing ${movies.length} movies`);

      for (const movie of movies) {
        try {
          await this.upsertMovie(movie);
          result.added++; // Simplified - could track actual adds vs updates
        } catch (err) {
          result.errors.push(`Failed to sync movie ${movie.title}: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`Failed to fetch movies: ${err}`);
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
            hasMore = false;
            break;
          }

          try {
            await this.processHistoryRecord(record);
            result.processed++;
          } catch (err) {
            result.errors.push(`Failed to process history record ${record.id}: ${err}`);
          }
        }

        // Check if we have more pages
        if (history.records.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        // Small delay to avoid hammering the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[Radarr] Processed ${result.processed} history records`);
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

  private async upsertMovie(movie: RadarrMovie): Promise<number> {
    const existing = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'radarr'),
        eq(schema.mediaItems.externalId, String(movie.id))
      ),
    });

    const posterImage = movie.images.find(i => i.coverType === 'poster');
    const posterUrl = posterImage?.remoteUrl ?? posterImage?.url ?? null;

    const data = {
      externalId: String(movie.id),
      source: 'radarr' as const,
      type: 'movie' as const,
      title: movie.title,
      year: movie.year,
      tmdbId: movie.tmdbId,
      imdbId: movie.imdbId || null,
      tvdbId: null,
      runtimeMinutes: movie.runtime,
      addedAt: movie.added,
      sizeBytes: movie.sizeOnDisk,
      quality: movie.movieFile?.quality.quality.name ?? null,
      posterUrl,
      genres: JSON.stringify(movie.genres),
      metadata: JSON.stringify({
        studio: movie.studio,
        certification: movie.certification,
        hasFile: movie.hasFile,
        monitored: movie.monitored,
        collection: movie.collection,
        releaseGroup: movie.movieFile?.releaseGroup,
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

  private async processHistoryRecord(record: RadarrHistoryRecord): Promise<void> {
    // First ensure the movie exists
    if (!record.movie) {
      console.warn(`[Radarr] History record ${record.id} has no movie data`);
      return;
    }

    const mediaItemId = await this.upsertMovie(record.movie);

    // Parse quality from source title
    const parsed = parseQuality(record.sourceTitle);
    const releaseGroup = parseReleaseGroup(record.sourceTitle) ?? record.data.releaseGroup ?? null;
    const sizeBytes = record.data.size ? parseInt(record.data.size, 10) : 0;

    // Determine if this is an upgrade by checking for previous downloads
    // An upgrade is when we have a previous "downloaded" event for the same media item
    let isUpgrade = false;
    let previousSizeBytes: number | null = null;

    if (record.eventType === 'downloadFolderImported') {
      // Check if there was a previous download for this movie
      const previousDownload = await db.query.downloadEvents.findFirst({
        where: and(
          eq(schema.downloadEvents.sourceApp, 'radarr'),
          eq(schema.downloadEvents.mediaItemId, mediaItemId),
          eq(schema.downloadEvents.eventType, 'downloaded')
        ),
        orderBy: [desc(schema.downloadEvents.timestamp)],
      });

      if (previousDownload) {
        isUpgrade = true;
        previousSizeBytes = previousDownload.sizeBytes;
      }
    }

    // Use INSERT ... ON CONFLICT to handle race conditions atomically
    // This prevents duplicate events even if concurrent syncs are running
    await db.insert(schema.downloadEvents).values({
      mediaItemId,
      episodeId: null,
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
      sourceApp: 'radarr',
      qualityScore: parsed.qualityScore,
      rawData: JSON.stringify(record),
      isUpgrade,
      previousSizeBytes,
    }).onConflictDoNothing();
  }

  private mapEventType(eventType: string): string {
    const mapping: Record<string, string> = {
      'grabbed': 'grabbed',
      'downloadFolderImported': 'downloaded',
      'downloadFailed': 'deleted',
      'movieFileDeleted': 'deleted',
      'movieFileRenamed': 'renamed',
      'downloadIgnored': 'deleted',
    };
    return mapping[eventType] ?? eventType;
  }

  async getLastSyncedHistoryDate(): Promise<string | null> {
    const lastEvent = await db.query.downloadEvents.findFirst({
      where: eq(schema.downloadEvents.sourceApp, 'radarr'),
      orderBy: [desc(schema.downloadEvents.timestamp)],
    });
    return lastEvent?.timestamp ?? null;
  }
}
