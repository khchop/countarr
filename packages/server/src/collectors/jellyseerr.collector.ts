import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { JellyseerrClient, JellyseerrRequest, JELLYSEERR_STATUS } from '../clients/jellyseerr.js';

export class JellyseerrCollector {
  private client: JellyseerrClient;

  constructor(url: string, apiKey: string) {
    this.client = new JellyseerrClient({ baseUrl: url, apiKey });
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  async syncRequests(): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      let page = 1;
      let hasMore = true;
      const pageSize = 100;

      while (hasMore) {
        const response = await this.client.getRequests(page, pageSize);
        if (!response || response.results.length === 0) {
          hasMore = false;
          break;
        }

        for (const request of response.results) {
          try {
            await this.processRequest(request);
            result.processed++;
          } catch (err) {
            result.errors.push(`Failed to process request ${request.id}: ${err}`);
          }
        }

        if (response.results.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`[Jellyseerr] Processed ${result.processed} requests`);
    } catch (err) {
      result.errors.push(`Failed to fetch requests: ${err}`);
    }

    return result;
  }

  private async processRequest(request: JellyseerrRequest): Promise<void> {
    // Check if request already exists
    const existing = await db.query.requests.findFirst({
      where: eq(schema.requests.externalId, String(request.id)),
    });

    const status = this.mapStatus(request.status);
    const title = request.media?.tmdbId
      ? `TMDB:${request.media.tmdbId}`
      : `Request ${request.id}`;

    // Try to link to existing media item
    let mediaItemId: number | null = null;
    if (request.media.tmdbId) {
      const mediaItem = await db.query.mediaItems.findFirst({
        where: eq(schema.mediaItems.tmdbId, request.media.tmdbId),
      });
      mediaItemId = mediaItem?.id ?? null;
    }

    const data = {
      externalId: String(request.id),
      mediaItemId,
      type: request.type === 'movie' ? 'movie' as const : 'series' as const,
      title,
      tmdbId: request.media.tmdbId,
      status,
      requestedAt: request.createdAt,
      approvedAt: status === 'approved' || status === 'available' ? request.updatedAt : null,
      availableAt: status === 'available' ? request.updatedAt : null,
    };

    if (existing) {
      await db.update(schema.requests)
        .set(data)
        .where(eq(schema.requests.id, existing.id));
    } else {
      await db.insert(schema.requests).values(data);
    }
  }

  private mapStatus(status: number): 'pending' | 'approved' | 'available' | 'declined' {
    switch (status) {
      case JELLYSEERR_STATUS.PENDING:
        return 'pending';
      case JELLYSEERR_STATUS.APPROVED:
        return 'approved';
      case JELLYSEERR_STATUS.AVAILABLE:
      case JELLYSEERR_STATUS.PARTIALLY_AVAILABLE:
        return 'available';
      case JELLYSEERR_STATUS.DECLINED:
        return 'declined';
      default:
        return 'pending';
    }
  }
}
