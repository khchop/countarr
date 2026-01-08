import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { BazarrClient, BazarrHistoryRecord } from '../clients/bazarr.js';

export class BazarrCollector {
  private client: BazarrClient;

  constructor(url: string, apiKey: string) {
    this.client = new BazarrClient({ baseUrl: url, apiKey });
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  async syncHistory(): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      // Sync both movie and series history
      const [movieHistory, seriesHistory] = await Promise.all([
        this.client.getMovieHistory(0, 500),
        this.client.getSeriesHistory(0, 500),
      ]);

      // Process movie subtitles
      if (movieHistory?.data) {
        for (const record of movieHistory.data) {
          try {
            if (record.action === 1 || record.action === 3) { // downloaded or upgraded
              await this.processMovieSubtitle(record);
              result.processed++;
            }
          } catch (err) {
            result.errors.push(`Failed to process movie subtitle for ${record.title}: ${err}`);
          }
        }
      }

      // Process series subtitles
      if (seriesHistory?.data) {
        for (const record of seriesHistory.data) {
          try {
            if (record.action === 1 || record.action === 3) {
              await this.processSeriesSubtitle(record);
              result.processed++;
            }
          } catch (err) {
            result.errors.push(`Failed to process series subtitle for ${record.seriesTitle}: ${err}`);
          }
        }
      }

      console.log(`[Bazarr] Processed ${result.processed} subtitle events`);
    } catch (err) {
      result.errors.push(`Failed to fetch subtitle history: ${err}`);
    }

    return result;
  }

  private parseTimestamp(parsedTimestamp: string): string {
    // parsed_timestamp format: "01/07/26 11:42:58" (MM/DD/YY HH:mm:ss)
    const match = parsedTimestamp.match(/(\d{2})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!match) {
      return new Date().toISOString();
    }
    const [, month, day, year, hour, minute, second] = match;
    const fullYear = parseInt(year) < 50 ? `20${year}` : `19${year}`;
    return new Date(`${fullYear}-${month}-${day}T${hour}:${minute}:${second}`).toISOString();
  }

  private parseScore(score: string | null): number | null {
    if (!score) return null;
    // score format: "95.0%"
    const match = score.match(/([\d.]+)%/);
    return match ? parseFloat(match[1]) : null;
  }

  private async processMovieSubtitle(record: BazarrHistoryRecord): Promise<void> {
    if (!record.radarrId) {
      return;
    }

    // Find the corresponding media item
    const mediaItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'radarr'),
        eq(schema.mediaItems.externalId, String(record.radarrId))
      ),
    });

    if (!mediaItem) {
      return; // Movie not synced yet
    }

    const timestamp = this.parseTimestamp(record.parsed_timestamp);
    const languageCode = record.language.code2 || record.language.name;

    // Check if this subtitle event already exists
    const existing = await db.query.subtitleEvents.findFirst({
      where: and(
        eq(schema.subtitleEvents.mediaItemId, mediaItem.id),
        eq(schema.subtitleEvents.language, languageCode),
        eq(schema.subtitleEvents.timestamp, timestamp)
      ),
    });

    if (existing) {
      return;
    }

    await db.insert(schema.subtitleEvents).values({
      mediaItemId: mediaItem.id,
      episodeId: null,
      language: languageCode,
      provider: record.provider ?? 'unknown',
      timestamp,
      score: this.parseScore(record.score),
    });
  }

  private async processSeriesSubtitle(record: BazarrHistoryRecord): Promise<void> {
    if (!record.sonarrSeriesId || !record.sonarrEpisodeId) {
      return;
    }

    // Find the corresponding media item
    const mediaItem = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'sonarr'),
        eq(schema.mediaItems.externalId, String(record.sonarrSeriesId))
      ),
    });

    if (!mediaItem) {
      return; // Series not synced yet
    }

    // Try to find the episode
    const episode = await db.query.episodes.findFirst({
      where: eq(schema.episodes.externalId, String(record.sonarrEpisodeId)),
    });

    const timestamp = this.parseTimestamp(record.parsed_timestamp);
    const languageCode = record.language.code2 || record.language.name;

    // Check if this subtitle event already exists
    const existing = await db.query.subtitleEvents.findFirst({
      where: and(
        eq(schema.subtitleEvents.mediaItemId, mediaItem.id),
        eq(schema.subtitleEvents.language, languageCode),
        eq(schema.subtitleEvents.timestamp, timestamp)
      ),
    });

    if (existing) {
      return;
    }

    await db.insert(schema.subtitleEvents).values({
      mediaItemId: mediaItem.id,
      episodeId: episode?.id ?? null,
      language: languageCode,
      provider: record.provider ?? 'unknown',
      timestamp,
      score: this.parseScore(record.score),
    });
  }

  async getLastSyncedDate(): Promise<string | null> {
    const lastEvent = await db.query.subtitleEvents.findFirst({
      orderBy: [desc(schema.subtitleEvents.timestamp)],
    });
    return lastEvent?.timestamp ?? null;
  }
}
