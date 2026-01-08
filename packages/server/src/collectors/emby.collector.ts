import { eq, and, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { EmbyClient, EmbyItem, EmbySession, EmbyUser, EmbyActivityLogEntry } from '../clients/emby.js';

// Minimum seconds of playback to count as a real play (filters skips/accidental clicks)
const MIN_PLAYBACK_SECONDS = 60;

export class EmbyCollector {
  private client: EmbyClient;
  private sourceApp: 'emby' | 'jellyfin';
  private connectionId: number;
  private userCache: Map<string, string> = new Map(); // userId -> userName

  constructor(url: string, apiKey: string, connectionId: number, isJellyfin = false) {
    this.sourceApp = isJellyfin ? 'jellyfin' : 'emby';
    this.connectionId = connectionId;
    this.client = new EmbyClient({
      baseUrl: url,
      apiKey,
      isJellyfin,
    });
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    return this.client.testConnection();
  }

  private async getUserName(userId: string): Promise<string> {
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    try {
      const user = await this.client.getUser(userId);
      if (user) {
        this.userCache.set(userId, user.Name);
        return user.Name;
      }
    } catch {
      // Ignore errors
    }

    return 'Unknown';
  }

  async syncPlaybackFromSessions(): Promise<{ processed: number; errors: string[] }> {
    const result = { processed: 0, errors: [] as string[] };

    try {
      const sessions = await this.client.getSessions();

      for (const session of sessions) {
        if (session.NowPlayingItem && session.PlayState) {
          try {
            await this.processActiveSession(session);
            result.processed++;
          } catch (err) {
            result.errors.push(`Failed to process session ${session.Id}: ${err}`);
          }
        }
      }

      console.log(`[${this.sourceApp}] Processed ${result.processed} active sessions`);
    } catch (err) {
      result.errors.push(`Failed to fetch sessions: ${err}`);
    }

    return result;
  }

  // Main sync method - uses Activity Log for proper playback history with timestamps
  // Pairs start/stop events to calculate actual play duration
  async syncPlayedItems(): Promise<{ processed: number; added: number; skipped: number; errors: string[] }> {
    const result = { processed: 0, added: 0, skipped: 0, errors: [] as string[] };

    try {
      // Calculate cutoff date - sync last 6 months of history
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);

      console.log(`[${this.sourceApp}] syncPlayedItems() called - Syncing playback from Activity Log since ${cutoffDate.toISOString().split('T')[0]}...`);

      // Fetch all activity in batches
      const allActivity: EmbyActivityLogEntry[] = [];
      let startIndex = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const activity = await this.client.getActivityLog(startIndex, limit, cutoffDate.toISOString());
        if (!activity || activity.Items.length === 0) {
          hasMore = false;
          break;
        }

        allActivity.push(...activity.Items);

        if (activity.Items.length < limit || startIndex + limit >= activity.TotalRecordCount) {
          hasMore = false;
        } else {
          startIndex += limit;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[${this.sourceApp}] Fetched ${allActivity.length} activity entries`);

      // Filter to only playback events
      const playbackEvents = allActivity.filter(e => e.Type === 'playback.start' || e.Type === 'playback.stop');
      console.log(`[${this.sourceApp}] Found ${playbackEvents.length} playback events (start/stop)`);

      // Sort by date ascending (oldest first) to pair start/stop correctly
      playbackEvents.sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());

      // Group by user+item to pair start/stop events
      // Key: `${userId}-${itemId}`, Value: pending start event
      const pendingStarts = new Map<string, EmbyActivityLogEntry>();
      let stopEventsWithoutStart = 0;

      for (const entry of playbackEvents) {
        if (!entry.UserId || !entry.ItemId) continue;

        const key = `${entry.UserId}-${entry.ItemId}`;

        if (entry.Type === 'playback.start') {
          // Store the start event (overwrite if there was a previous unmatched start)
          pendingStarts.set(key, entry);
        } else if (entry.Type === 'playback.stop') {
          const startEntry = pendingStarts.get(key);
          
          // Calculate duration
          let durationSeconds = 0;
          if (startEntry) {
            const startTime = new Date(startEntry.Date).getTime();
            const stopTime = new Date(entry.Date).getTime();
            durationSeconds = Math.floor((stopTime - startTime) / 1000);
            pendingStarts.delete(key); // Clear the pending start
          } else {
            stopEventsWithoutStart++;
          }

          // Skip very short plays (skips, accidental clicks, buffering tests)
          if (durationSeconds < MIN_PLAYBACK_SECONDS) {
            result.skipped++;
            continue;
          }

          try {
            const added = await this.processActivityEntry(entry, startEntry?.Date, durationSeconds);
            result.processed++;
            if (added) result.added++;
          } catch (err) {
            result.errors.push(`Failed to process activity ${entry.Id}: ${err}`);
          }
        }
      }
      
      if (stopEventsWithoutStart > 0) {
        console.log(`[${this.sourceApp}] Warning: ${stopEventsWithoutStart} stop events without matching start (filtered due to 0 duration)`);
      }

      console.log(`[${this.sourceApp}] Processed ${result.processed} playback events, added ${result.added} new, skipped ${result.skipped} (< ${MIN_PLAYBACK_SECONDS}s)`);
    } catch (err) {
      result.errors.push(`Failed to sync from Activity Log: ${err}`);
    }

    return result;
  }

  private async processActivityEntry(
    stopEntry: EmbyActivityLogEntry, 
    startDate?: string, 
    durationSeconds: number = 0
  ): Promise<boolean> {
    const userName = await this.getUserName(stopEntry.UserId!);
    
    // Parse the activity name to extract title and episode info
    // Format: "user has finished playing Title - S1, Ep1 - Episode Name on Device"
    // or "user has finished playing Movie Title on Device"
    const nameMatch = stopEntry.Name.match(/has finished playing (.+?) on .+$/);
    const displayTitle = nameMatch ? nameMatch[1] : stopEntry.Name;

    // Create a unique external ID based on activity log ID
    const externalId = `activity-${stopEntry.Id}`;

    // Check if we already have this playback recorded
    const existing = await db.query.playbackEvents.findFirst({
      where: and(
        eq(schema.playbackEvents.sourceApp, this.sourceApp),
        eq(schema.playbackEvents.externalId, externalId)
      ),
    });

    if (existing) {
      return false; // Already recorded
    }

    // Try to find the media item by ItemId
    const mediaItem = await this.findMediaItemByEmbyId(stopEntry.ItemId!, displayTitle);
    
    // Only store playback for media we have in our library
    // Skip items we can't match (avoids foreign key errors and keeps data clean)
    if (!mediaItem) {
      return false;
    }
    
    await db.insert(schema.playbackEvents).values({
      mediaItemId: mediaItem.id,
      episodeId: null,
      connectionId: this.connectionId,
      externalId,
      userId: stopEntry.UserId,
      userName,
      startedAt: startDate ?? stopEntry.Date, // Use start time if we have it
      endedAt: stopEntry.Date,
      playDurationSeconds: durationSeconds,
      completed: true, // playback.stop means completed
      playMethod: null,
      sourceApp: this.sourceApp,
    });

    return true;
  }

  private async findMediaItemByEmbyId(embyItemId: string, displayTitle: string): Promise<typeof schema.mediaItems.$inferSelect | null> {
    // Extract just the series/movie name (before " - S1, Ep1" if present)
    // Format: "Show Name (Year) - S1, Ep1 - Episode Title" or "Movie Name (Year)"
    // Use split approach since regex non-greedy matching is tricky
    const parts = displayTitle.split(' - S');
    let searchTitle = parts[0].trim();
    
    // Remove year from title for matching: "The Studio (2025)" -> "The Studio"
    const yearMatch = searchTitle.match(/^(.+?)\s*\(\d{4}\)$/);
    const titleWithoutYear = yearMatch ? yearMatch[1].trim() : searchTitle;

    // Try exact title match for movies (with and without year)
    let match = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'radarr'),
        sql`lower(${schema.mediaItems.title}) = lower(${searchTitle})`
      ),
    });
    if (match) return match;

    match = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'radarr'),
        sql`lower(${schema.mediaItems.title}) = lower(${titleWithoutYear})`
      ),
    });
    if (match) return match;

    // Try exact title match for series (with and without year)
    match = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'sonarr'),
        sql`lower(${schema.mediaItems.title}) = lower(${searchTitle})`
      ),
    });
    if (match) return match;

    match = await db.query.mediaItems.findFirst({
      where: and(
        eq(schema.mediaItems.source, 'sonarr'),
        sql`lower(${schema.mediaItems.title}) = lower(${titleWithoutYear})`
      ),
    });
    if (match) return match;

    // No partial/fuzzy matching - return null if no exact match
    // This prevents "Dikkie Dik" from matching "The Last Duel" etc.
    return null;
  }

  private async processActiveSession(session: EmbySession): Promise<void> {
    const item = session.NowPlayingItem!;
    const playState = session.PlayState!;

    // Find corresponding media item
    const mediaItem = await this.findMediaItem(item);
    if (!mediaItem) {
      return;
    }

    // Find episode if applicable
    let episodeId: number | null = null;
    if (item.Type === 'Episode' && item.SeriesId) {
      const episode = await this.findEpisode(mediaItem.id, item);
      episodeId = episode?.id ?? null;
    }

    const now = new Date().toISOString();
    const positionSeconds = Math.floor((playState.PositionTicks || 0) / 10000000);

    // Check if we have an existing active session for this item
    const existing = await db.query.playbackEvents.findFirst({
      where: and(
        eq(schema.playbackEvents.mediaItemId, mediaItem.id),
        eq(schema.playbackEvents.sourceApp, this.sourceApp),
        eq(schema.playbackEvents.externalId, session.Id)
      ),
    });

    if (existing && !existing.endedAt) {
      // Update existing session
      await db.update(schema.playbackEvents)
        .set({
          playDurationSeconds: positionSeconds,
          playMethod: playState.PlayMethod,
        })
        .where(eq(schema.playbackEvents.id, existing.id));
    } else {
      // Create new playback event
      await db.insert(schema.playbackEvents).values({
        mediaItemId: mediaItem.id,
        episodeId,
        connectionId: this.connectionId,
        externalId: session.Id,
        startedAt: now,
        endedAt: null,
        playDurationSeconds: positionSeconds,
        completed: false,
        playMethod: playState.PlayMethod,
        sourceApp: this.sourceApp,
      });
    }
  }

  private async processPlayedItem(item: EmbyItem, userId?: string, userName?: string): Promise<boolean> {
    const mediaItem = await this.findMediaItem(item);
    if (!mediaItem) {
      return false;
    }

    let episodeId: number | null = null;
    if (item.Type === 'Episode') {
      const episode = await this.findEpisode(mediaItem.id, item);
      episodeId = episode?.id ?? null;
    }

    const playedDate = item.UserData?.LastPlayedDate ?? new Date().toISOString();
    const runtimeSeconds = item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000) : 0;

    // Create a unique external ID based on user + item + date
    const externalId = `${userId ?? 'unknown'}-${item.Id}-${playedDate.split('T')[0]}`;

    // Check if we already have this playback recorded
    const existing = await db.query.playbackEvents.findFirst({
      where: and(
        eq(schema.playbackEvents.mediaItemId, mediaItem.id),
        eq(schema.playbackEvents.sourceApp, this.sourceApp),
        eq(schema.playbackEvents.externalId, externalId)
      ),
    });

    if (existing) {
      return false; // Already recorded
    }

    await db.insert(schema.playbackEvents).values({
      mediaItemId: mediaItem.id,
      episodeId,
      connectionId: this.connectionId,
      externalId,
      userId: userId ?? null,
      userName: userName ?? null,
      startedAt: playedDate,
      endedAt: playedDate,
      playDurationSeconds: runtimeSeconds,
      completed: item.UserData?.Played ?? false,
      playMethod: null,
      sourceApp: this.sourceApp,
    });

    return true;
  }

  private async findMediaItem(item: EmbyItem): Promise<typeof schema.mediaItems.$inferSelect | null> {
    // For episodes, try to find the series first
    if (item.Type === 'Episode') {
      // Try by TVDB ID if available
      if (item.ProviderIds?.Tvdb) {
        const match = await db.query.mediaItems.findFirst({
          where: eq(schema.mediaItems.tvdbId, parseInt(item.ProviderIds.Tvdb, 10)),
        });
        if (match) return match;
      }
      
      // Try by series name (fuzzy match)
      if (item.SeriesName) {
        const match = await db.query.mediaItems.findFirst({
          where: and(
            eq(schema.mediaItems.source, 'sonarr'),
            sql`lower(${schema.mediaItems.title}) = lower(${item.SeriesName})`
          ),
        });
        if (match) return match;
      }
    }

    // Try to match by TMDB ID
    if (item.ProviderIds?.Tmdb) {
      const match = await db.query.mediaItems.findFirst({
        where: eq(schema.mediaItems.tmdbId, parseInt(item.ProviderIds.Tmdb, 10)),
      });
      if (match) return match;
    }

    // Try IMDB ID
    if (item.ProviderIds?.Imdb) {
      const match = await db.query.mediaItems.findFirst({
        where: eq(schema.mediaItems.imdbId, item.ProviderIds.Imdb),
      });
      if (match) return match;
    }

    // Try by title match (for movies)
    if (item.Type === 'Movie' && item.Name) {
      const match = await db.query.mediaItems.findFirst({
        where: and(
          eq(schema.mediaItems.source, 'radarr'),
          sql`lower(${schema.mediaItems.title}) = lower(${item.Name})`
        ),
      });
      if (match) return match;
    }

    return null;
  }

  private async findEpisode(mediaItemId: number, item: EmbyItem): Promise<typeof schema.episodes.$inferSelect | null> {
    if (!item.ParentIndexNumber || !item.IndexNumber) {
      return null;
    }

    const result = await db.query.episodes.findFirst({
      where: and(
        eq(schema.episodes.mediaItemId, mediaItemId),
        eq(schema.episodes.season, item.ParentIndexNumber),
        eq(schema.episodes.episode, item.IndexNumber)
      ),
    });
    return result ?? null;
  }

  async closeExpiredSessions(): Promise<number> {
    // Mark sessions as ended if they haven't been updated in 30 minutes
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - 30);

    // This would need a more complex query - simplified for now
    // In practice, you'd want to track last update time
    return 0;
  }
}
