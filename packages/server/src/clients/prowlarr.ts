import { BaseApiClient, ApiClientConfig } from './base.js';

// Prowlarr API types
export interface ProwlarrIndexer {
  id: number;
  name: string;
  protocol: string;
  privacy: string;
  priority: number;
  enable: boolean;
  appProfileId: number;
  added: string;
  capabilities: {
    limitsMax: number;
    limitsDefault: number;
    categories: Array<{ id: number; name: string; subCategories: Array<{ id: number; name: string }> }>;
  };
}

export interface ProwlarrHistoryRecord {
  id: number;
  indexerId: number;
  date: string;
  eventType: string; // 'indexerQuery' | 'releaseGrabbed' | 'indexerRss'
  successful: boolean;
  elapsedTime: number; // ms
  data: {
    source?: string;
    query?: string;
    queryType?: string;
    categories?: string;
    elapsedTime?: string;
    url?: string;
    host?: string;
    limit?: string;
    offset?: string;
    queryResults?: string;
    grabTitle?: string;
    downloadClient?: string;
    downloadClientName?: string;
    [key: string]: string | undefined;
  };
  indexer?: ProwlarrIndexer;
}

export interface ProwlarrHistoryResponse {
  page: number;
  pageSize: number;
  sortKey: string;
  sortDirection: string;
  totalRecords: number;
  records: ProwlarrHistoryRecord[];
}

export interface ProwlarrSystemStatus {
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

export interface ProwlarrIndexerStats {
  indexerId: number;
  indexerName: string;
  averageResponseTime: number;
  numberOfQueries: number;
  numberOfGrabs: number;
  numberOfRssQueries: number;
  numberOfAuthQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  numberOfFailedRssQueries: number;
  numberOfFailedAuthQueries: number;
}

export interface ProwlarrIndexerStatsResponse {
  indexers: ProwlarrIndexerStats[];
  userAgents: Array<{ userAgent: string; numberOfQueries: number }>;
  hosts: Array<{ host: string; numberOfQueries: number }>;
}

export class ProwlarrClient extends BaseApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    const response = await this.get<ProwlarrSystemStatus>('/api/v1/system/status');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.version };
  }

  async getIndexers(): Promise<ProwlarrIndexer[]> {
    const response = await this.get<ProwlarrIndexer[]>('/api/v1/indexer');
    return response.data ?? [];
  }

  async getHistory(page = 1, pageSize = 100, sortDirection = 'descending'): Promise<ProwlarrHistoryResponse | null> {
    const response = await this.get<ProwlarrHistoryResponse>('/api/v1/history', {
      page,
      pageSize,
      sortKey: 'date',
      sortDirection,
      includeIndexer: 'true',
    });
    return response.data;
  }

  async getIndexerStats(): Promise<ProwlarrIndexerStatsResponse | null> {
    const response = await this.get<ProwlarrIndexerStatsResponse>('/api/v1/indexerstats');
    return response.data;
  }
}
