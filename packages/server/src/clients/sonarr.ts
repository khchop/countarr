import { BaseApiClient, ApiClientConfig } from './base.js';

// Sonarr API types
export interface SonarrSeries {
  id: number;
  title: string;
  sortTitle: string;
  status: string;
  ended: boolean;
  overview: string;
  previousAiring?: string;
  network: string;
  airTime: string;
  images: Array<{ coverType: string; url: string; remoteUrl: string }>;
  seasons: Array<{
    seasonNumber: number;
    monitored: boolean;
    statistics?: {
      previousAiring?: string;
      episodeFileCount: number;
      episodeCount: number;
      totalEpisodeCount: number;
      sizeOnDisk: number;
      percentOfEpisodes: number;
    };
  }>;
  year: number;
  path: string;
  qualityProfileId: number;
  languageProfileId: number;
  seasonFolder: boolean;
  monitored: boolean;
  useSceneNumbering: boolean;
  runtime: number;
  tvdbId: number;
  tvRageId: number;
  tvMazeId: number;
  firstAired: string;
  seriesType: string;
  cleanTitle: string;
  imdbId: string;
  titleSlug: string;
  rootFolderPath: string;
  certification: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    totalEpisodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
}

export interface SonarrEpisode {
  id: number;
  seriesId: number;
  tvdbId: number;
  episodeFileId: number;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate: string;
  airDateUtc: string;
  overview: string;
  hasFile: boolean;
  monitored: boolean;
  absoluteEpisodeNumber?: number;
  unverifiedSceneNumbering: boolean;
  endTime?: string;
  grabDate?: string;
  series?: SonarrSeries;
  episodeFile?: SonarrEpisodeFile;
}

export interface SonarrEpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  sceneName: string;
  releaseGroup: string;
  language: { id: number; name: string };
  quality: {
    quality: { id: number; name: string; source: string; resolution: number };
    revision: { version: number; real: number; isRepack: boolean };
  };
  mediaInfo?: {
    audioBitrate: number;
    audioChannels: number;
    audioCodec: string;
    audioLanguages: string;
    audioStreamCount: number;
    videoBitDepth: number;
    videoBitrate: number;
    videoCodec: string;
    videoFps: number;
    resolution: string;
    runTime: string;
    scanType: string;
    subtitles: string;
  };
  qualityCutoffNotMet: boolean;
  customFormats: Array<{ id: number; name: string }>;
}

export interface SonarrHistoryRecord {
  id: number;
  episodeId: number;
  seriesId: number;
  sourceTitle: string;
  language: { id: number; name: string };
  quality: {
    quality: { id: number; name: string; source: string; resolution: number };
    revision: { version: number; real: number; isRepack: boolean };
  };
  customFormats: Array<{ id: number; name: string }>;
  customFormatScore: number;
  qualityCutoffNotMet: boolean;
  date: string;
  downloadId: string;
  eventType: string;
  data: {
    indexer?: string;
    releaseGroup?: string;
    age?: string;
    ageHours?: string;
    ageMinutes?: string;
    publishedDate?: string;
    downloadClient?: string;
    downloadClientName?: string;
    size?: string;
    nzbInfoUrl?: string;
    downloadUrl?: string;
    guid?: string;
    protocol?: string;
    torrentInfoHash?: string;
    reason?: string;
    droppedPath?: string;
    importedPath?: string;
    [key: string]: string | undefined;
  };
  episode?: SonarrEpisode;
  series?: SonarrSeries;
}

export interface SonarrHistoryResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: SonarrHistoryRecord[];
}

export interface SonarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isNetCore: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  isDocker: boolean;
  mode: string;
  branch: string;
  authentication: string;
  sqliteVersion: string;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
  startTime: string;
  packageVersion: string;
  packageAuthor: string;
  packageUpdateMechanism: string;
}

export class SonarrClient extends BaseApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    const response = await this.get<SonarrSystemStatus>('/api/v3/system/status');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.version };
  }

  async getSeries(): Promise<SonarrSeries[]> {
    const response = await this.get<SonarrSeries[]>('/api/v3/series');
    return response.data ?? [];
  }

  async getSeriesById(id: number): Promise<SonarrSeries | null> {
    const response = await this.get<SonarrSeries>(`/api/v3/series/${id}`);
    return response.data;
  }

  async getEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    const response = await this.get<SonarrEpisode[]>('/api/v3/episode', {
      seriesId,
    });
    return response.data ?? [];
  }

  async getEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]> {
    const response = await this.get<SonarrEpisodeFile[]>('/api/v3/episodefile', {
      seriesId,
    });
    return response.data ?? [];
  }

  async getHistory(page = 1, pageSize = 100, sortDirection = 'descending'): Promise<SonarrHistoryResponse | null> {
    const response = await this.get<SonarrHistoryResponse>('/api/v3/history', {
      page,
      pageSize,
      sortKey: 'date',
      sortDirection,
      includeSeries: 'true',
      includeEpisode: 'true',
    });
    return response.data;
  }

  async getHistorySince(date: string, page = 1, pageSize = 100): Promise<SonarrHistoryResponse | null> {
    const response = await this.get<SonarrHistoryResponse>('/api/v3/history/since', {
      date,
      page,
      pageSize,
      includeSeries: 'true',
      includeEpisode: 'true',
    });
    return response.data;
  }

  async getQualityProfiles(): Promise<Array<{ id: number; name: string }>> {
    const response = await this.get<Array<{ id: number; name: string }>>('/api/v3/qualityprofile');
    return response.data ?? [];
  }
}
