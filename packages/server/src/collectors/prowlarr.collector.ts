import { eq, and } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { ProwlarrClient, ProwlarrHistoryRecord } from '../clients/prowlarr.js';

export class ProwlarrCollector {
  private client: ProwlarrClient;

  constructor(url: string, apiKey: string) {
    this.client = new ProwlarrClient({ baseUrl: url, apiKey });
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  async syncIndexerStats(): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      const stats = await this.client.getIndexerStats();
      if (!stats) {
        return result;
      }

      const today = new Date().toISOString().split('T')[0];

      for (const indexer of stats.indexers) {
        try {
          // Upsert daily stats for each indexer
          const existing = await db.query.indexerStats.findFirst({
            where: and(
              eq(schema.indexerStats.indexerName, indexer.indexerName),
              eq(schema.indexerStats.date, today)
            ),
          });

          const data = {
            indexerName: indexer.indexerName,
            date: today,
            searches: indexer.numberOfQueries + indexer.numberOfRssQueries,
            grabs: indexer.numberOfGrabs,
            failedGrabs: indexer.numberOfFailedGrabs + indexer.numberOfFailedQueries,
            avgResponseMs: Math.round(indexer.averageResponseTime),
          };

          if (existing) {
            await db.update(schema.indexerStats)
              .set(data)
              .where(eq(schema.indexerStats.id, existing.id));
          } else {
            await db.insert(schema.indexerStats).values(data);
          }

          result.processed++;
        } catch (err) {
          result.errors.push(`Failed to process indexer ${indexer.indexerName}: ${err}`);
        }
      }

      console.log(`[Prowlarr] Processed ${result.processed} indexer stats`);
    } catch (err) {
      result.errors.push(`Failed to fetch indexer stats: ${err}`);
    }

    return result;
  }

  async syncHistory(importMonths = 12): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      let page = 1;
      let hasMore = true;
      const pageSize = 100;
      const cutoffDate = this.getCutoffDate(importMonths);

      while (hasMore) {
        const history = await this.client.getHistory(page, pageSize);
        if (!history || history.records.length === 0) {
          hasMore = false;
          break;
        }

        for (const record of history.records) {
          if (new Date(record.date) < new Date(cutoffDate)) {
            hasMore = false;
            break;
          }

          // We mainly care about grab events for tracking successful indexer usage
          if (record.eventType === 'releaseGrabbed') {
            try {
              await this.processGrabEvent(record);
              result.processed++;
            } catch (err) {
              result.errors.push(`Failed to process grab event ${record.id}: ${err}`);
            }
          }
        }

        if (history.records.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[Prowlarr] Processed ${result.processed} history records`);
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

  private async processGrabEvent(record: ProwlarrHistoryRecord): Promise<void> {
    // Update daily indexer stats based on grab events
    const date = record.date.split('T')[0];
    const indexerName = record.indexer?.name ?? 'Unknown';

    const existing = await db.query.indexerStats.findFirst({
      where: and(
        eq(schema.indexerStats.indexerName, indexerName),
        eq(schema.indexerStats.date, date)
      ),
    });

    if (existing) {
      // Increment grabs count
      await db.update(schema.indexerStats)
        .set({
          grabs: existing.grabs + 1,
          avgResponseMs: record.elapsedTime
            ? Math.round(((existing.avgResponseMs ?? 0) + record.elapsedTime) / 2)
            : existing.avgResponseMs,
        })
        .where(eq(schema.indexerStats.id, existing.id));
    } else {
      await db.insert(schema.indexerStats).values({
        indexerName,
        date,
        searches: 0,
        grabs: 1,
        failedGrabs: record.successful ? 0 : 1,
        avgResponseMs: record.elapsedTime ?? null,
      });
    }
  }
}
