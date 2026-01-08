import { FastifyInstance } from 'fastify';
import { db, schema } from '../../db/index.js';
import { eq, desc, like, and, count } from 'drizzle-orm';
import { getMediaUpgradePath } from '../../stats/upgrades.js';

function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function safeParseJson<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

interface MediaQuery {
  page?: string;
  pageSize?: string;
  type?: 'movie' | 'series';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function mediaRoutes(fastify: FastifyInstance) {
  // List media items
  fastify.get('/', async (request, reply) => {
    const query = request.query as MediaQuery;
    const page = safeParseInt(query.page, 1);
    const pageSize = Math.min(safeParseInt(query.pageSize, 50), 100);
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (query.type) {
      conditions.push(eq(schema.mediaItems.type, query.type));
    }
    if (query.search) {
      // Escape special LIKE characters
      const escapedSearch = query.search.replace(/[%_]/g, '\\$&');
      conditions.push(like(schema.mediaItems.title, `%${escapedSearch}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      db.query.mediaItems.findMany({
        where,
        orderBy: [desc(schema.mediaItems.addedAt)],
        limit: pageSize,
        offset,
      }),
      db.select({ count: count() }).from(schema.mediaItems).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items: items.map(item => ({
        ...item,
        genres: safeParseJson<string[]>(item.genres, []),
        metadata: safeParseJson<Record<string, unknown>>(item.metadata, {}),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });

  // Get single media item with upgrade path
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid media item ID' });
    }

    const item = await db.query.mediaItems.findFirst({
      where: eq(schema.mediaItems.id, id),
    });

    if (!item) {
      return reply.status(404).send({ error: 'Media item not found' });
    }

    const upgradePath = await getMediaUpgradePath(id);

    // Get episodes if series
    let episodes: typeof schema.episodes.$inferSelect[] = [];
    if (item.type === 'series') {
      episodes = await db.query.episodes.findMany({
        where: eq(schema.episodes.mediaItemId, id),
        orderBy: [schema.episodes.season, schema.episodes.episode],
      });
    }

    return {
      ...item,
      genres: safeParseJson<string[]>(item.genres, []),
      metadata: safeParseJson<Record<string, unknown>>(item.metadata, {}),
      upgradePath: upgradePath?.upgrades ?? [],
      upgradeCount: upgradePath?.upgradeCount ?? 0,
      totalSizeDownloaded: upgradePath?.totalSizeDownloaded ?? 0,
      episodes,
    };
  });

  // Get download history for a media item
  fastify.get<{ Params: { id: string } }>('/:id/history', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid media item ID' });
    }

    const events = await db.query.downloadEvents.findMany({
      where: eq(schema.downloadEvents.mediaItemId, id),
      orderBy: [desc(schema.downloadEvents.timestamp)],
    });

    return events.map(event => ({
      ...event,
      rawData: safeParseJson<Record<string, unknown> | null>(event.rawData, null),
    }));
  });

  // Get playback history for a media item
  fastify.get<{ Params: { id: string } }>('/:id/playback', async (request, reply) => {
    const id = safeParseInt(request.params.id, 0);
    if (id <= 0) {
      return reply.status(400).send({ error: 'Invalid media item ID' });
    }

    const events = await db.query.playbackEvents.findMany({
      where: eq(schema.playbackEvents.mediaItemId, id),
      orderBy: [desc(schema.playbackEvents.startedAt)],
    });

    return events;
  });
}
