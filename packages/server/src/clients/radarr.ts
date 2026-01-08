import { BaseApiClient, ApiClientConfig } from './base.js';

// Radarr API types
export interface RadarrMovie {
  id: number;
  title: string;
  originalTitle: string;
  sortTitle: string;
  sizeOnDisk: number;
  status: string;
  overview: string;
  inCinemas?: string;
  physicalRelease?: string;
  digitalRelease?: string;
  images: Array<{ coverType: string; url: string; remoteUrl: string }>;
  website: string;
  year: number;
  hasFile: boolean;
  youTubeTrailerId: string;
  studio: string;
  path: string;
  qualityProfileId: number;
  monitored: boolean;
  minimumAvailability: string;
  isAvailable: boolean;
  folderName: string;
  runtime: number;
  cleanTitle: string;
  imdbId: string;
  tmdbId: number;
  titleSlug: string;
  rootFolderPath: string;
  certification: string;
  genres: string[];
  tags: number[];
  added: string;
  ratings: { votes: number; value: number };
  movieFile?: RadarrMovieFile;
  collection?: { name: string; tmdbId: number };
}

export interface RadarrMovieFile {
  id: number;
  movieId: number;
  relativePath: string;
  path: string;
  size: number;
  dateAdded: string;
  sceneName: string;
  indexerFlags: number;
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
  originalFilePath: string;
  qualityCutoffNotMet: boolean;
  languages: Array<{ id: number; name: string }>;
  releaseGroup: string;
  edition: string;
}

export interface RadarrHistoryRecord {
  id: number;
  movieId: number;
  sourceTitle: string;
  languages: Array<{ id: number; name: string }>;
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
  movie?: RadarrMovie;
}

export interface RadarrHistoryResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: RadarrHistoryRecord[];
}

export interface RadarrSystemStatus {
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

export class RadarrClient extends BaseApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    const response = await this.get<RadarrSystemStatus>('/api/v3/system/status');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.version };
  }

  async getMovies(): Promise<RadarrMovie[]> {
    const response = await this.get<RadarrMovie[]>('/api/v3/movie');
    return response.data ?? [];
  }

  async getMovie(id: number): Promise<RadarrMovie | null> {
    const response = await this.get<RadarrMovie>(`/api/v3/movie/${id}`);
    return response.data;
  }

  async getHistory(page = 1, pageSize = 100, sortDirection = 'descending'): Promise<RadarrHistoryResponse | null> {
    const response = await this.get<RadarrHistoryResponse>('/api/v3/history', {
      page,
      pageSize,
      sortKey: 'date',
      sortDirection,
      includeMovie: 'true',
    });
    return response.data;
  }

  async getHistorySince(date: string, page = 1, pageSize = 100): Promise<RadarrHistoryResponse | null> {
    const response = await this.get<RadarrHistoryResponse>('/api/v3/history/since', {
      date,
      page,
      pageSize,
      includeMovie: 'true',
    });
    return response.data;
  }

  async getQualityProfiles(): Promise<Array<{ id: number; name: string }>> {
    const response = await this.get<Array<{ id: number; name: string }>>('/api/v3/qualityprofile');
    return response.data ?? [];
  }
}
