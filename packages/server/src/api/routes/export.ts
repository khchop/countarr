import { FastifyInstance, FastifyReply } from 'fastify';
import * as movies from '../../stats/movies.js';
import * as tvshows from '../../stats/tvshows.js';
import * as genres from '../../stats/genres.js';
import * as releaseGroups from '../../stats/release-groups.js';
import * as records from '../../stats/records.js';
import * as subtitles from '../../stats/subtitles.js';
import * as stats from '../../stats/index.js';

interface TimeRangeQuery {
  start?: string;
  end?: string;
  format?: 'csv' | 'json';
}

function getDefaultTimeRange(): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

function parseTimeRange(query: TimeRangeQuery): { startDate: string; endDate: string } {
  const defaults = getDefaultTimeRange();
  return {
    startDate: query.start ?? defaults.startDate,
    endDate: query.end ?? defaults.endDate,
  };
}

// Convert array of objects to CSV
function toCSV<T extends object>(data: T[], filename: string): { csv: string; filename: string } {
  if (data.length === 0) {
    return { csv: '', filename: `${filename}.csv` };
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const value = (row as Record<string, unknown>)[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',')
  );

  return {
    csv: [headers.join(','), ...rows].join('\n'),
    filename: `${filename}.csv`,
  };
}

function sendCSV(reply: FastifyReply, csv: string, filename: string) {
  return reply
    .header('Content-Type', 'text/csv')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(csv);
}

function sendJSON(reply: FastifyReply, data: unknown, filename: string) {
  return reply
    .header('Content-Type', 'application/json')
    .header('Content-Disposition', `attachment; filename="${filename}"`)
    .send(JSON.stringify(data, null, 2));
}

export async function exportRoutes(fastify: FastifyInstance) {
  // ============================================
  // Movies export
  // ============================================
  fastify.get('/movies/release-groups', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await movies.getMovieReleaseGroups(params, 1000);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `movie-release-groups-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/movies/decades', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await movies.getMovieDecadeDistribution(params);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `movie-decades-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/movies/studios', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await movies.getMovieStudios(params, 500);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `movie-studios-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // TV Shows export
  // ============================================
  fastify.get('/tv/release-groups', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await tvshows.getTVReleaseGroups(params, 1000);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tv-release-groups-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/tv/networks', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await tvshows.getNetworkDistribution(params, 500);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tv-networks-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/tv/most-episodes', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await tvshows.getSeriesWithMostEpisodes(params, 500);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `tv-most-episodes-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // Release Groups export
  // ============================================
  fastify.get('/release-groups', async (request, reply) => {
    const query = request.query as TimeRangeQuery & { sort?: 'downloads' | 'size' | 'quality' | 'recent' };
    const params = parseTimeRange(query);
    const { groups } = await releaseGroups.getReleaseGroupsList(params, 5000, 0, query.sort);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `release-groups-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(groups, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, groups, `${filename}.json`);
  });

  fastify.get('/release-groups/:group/content', async (request, reply) => {
    const { group } = request.params as { group: string };
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const { items } = await releaseGroups.getReleaseGroupContent(decodeURIComponent(group), params, 10000);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `release-group-${group}-content-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(items, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, items, `${filename}.json`);
  });

  // ============================================
  // Genres export
  // ============================================
  fastify.get('/genres', async (request, reply) => {
    const query = request.query as TimeRangeQuery & { type?: 'movie' | 'series' | 'all' };
    const params = parseTimeRange(query);
    const data = await genres.getGenreDistribution({ ...params, type: query.type });
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `genres-${query.type ?? 'all'}-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/genres/decades', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const data = await genres.getGenreByDecade();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `genres-by-decade-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // Subtitles export
  // ============================================
  fastify.get('/subtitles/languages', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await subtitles.getSubtitleLanguageDistribution(params);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `subtitle-languages-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/subtitles/providers', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await subtitles.getSubtitleProviderPerformance(params);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `subtitle-providers-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/subtitles/recent', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await subtitles.getRecentSubtitles(params, 5000);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `subtitle-downloads-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // Records export
  // ============================================
  fastify.get('/records/calendar', async (request, reply) => {
    const query = request.query as TimeRangeQuery & { year?: string };
    const year = query.year ? parseInt(query.year, 10) : undefined;
    const data = await records.getCalendarHeatmap(year);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `download-calendar-${year ?? 'all'}-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  fastify.get('/records/milestones', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const data = await records.getDownloadMilestones();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `milestones-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // Indexers export
  // ============================================
  fastify.get('/indexers', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const data = await stats.getTopIndexers(params, 500);
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `indexers-${timestamp}`;

    if (query.format === 'csv') {
      const { csv } = toCSV(data, filename);
      return sendCSV(reply, csv, `${filename}.csv`);
    }
    return sendJSON(reply, data, `${filename}.json`);
  });

  // ============================================
  // Full report export (all data combined)
  // ============================================
  fastify.get('/full-report', async (request, reply) => {
    const query = request.query as TimeRangeQuery;
    const params = parseTimeRange(query);
    const timestamp = new Date().toISOString().split('T')[0];

    const [
      contentCounts,
      storageStats,
      releaseGroupsData,
      genreData,
      decadeData,
      allTimeRecordsData,
      milestonesData,
      quirkyData,
    ] = await Promise.all([
      records.getContentCounts(),
      records.getStorageStats(),
      releaseGroups.getReleaseGroupsList(params, 100),
      genres.getGenreDistribution(params),
      records.getDecadeDistribution(),
      records.getAllTimeRecords(),
      records.getDownloadMilestones(),
      records.getQuirkyStats(),
    ]);

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: params,
      summary: {
        content: contentCounts,
        storage: storageStats,
      },
      topReleaseGroups: releaseGroupsData.groups.slice(0, 20),
      topGenres: genreData.slice(0, 20),
      decadeDistribution: decadeData,
      allTimeRecords: allTimeRecordsData,
      milestones: milestonesData,
      quirkyStats: quirkyData,
    };

    const filename = `countarr-full-report-${timestamp}`;
    return sendJSON(reply, report, `${filename}.json`);
  });
}
