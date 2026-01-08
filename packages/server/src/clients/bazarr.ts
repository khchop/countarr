import { BaseApiClient, ApiClientConfig } from './base.js';

// Bazarr API types
export interface BazarrLanguage {
  name: string;
  code2: string;
  code3: string;
  forced: boolean;
  hi: boolean;
}

export interface BazarrHistoryRecord {
  action: number; // 1 = downloaded, 2 = erased, 3 = upgraded, 5 = sync
  language: BazarrLanguage;
  provider: string | null;
  score: string | null; // e.g., "95.0%"
  subs_id: string | null;
  sonarrEpisodeId?: number;
  sonarrSeriesId?: number;
  radarrId?: number;
  timestamp: string; // human readable like "4 hours ago"
  parsed_timestamp: string; // e.g., "01/07/26 11:42:58"
  description: string;
  title?: string; // movie title
  seriesTitle?: string; // series title
  episodeTitle?: string;
  episode_number?: string; // e.g., "1x5"
  subtitles_path: string;
  monitored: boolean;
  upgradable: boolean;
  blacklisted: boolean;
}

export interface BazarrHistoryResponse {
  data: BazarrHistoryRecord[];
  total: number;
}

export interface BazarrStatus {
  bazarr_version: string;
  sonarr_version?: string;
  radarr_version?: string;
  operating_system: string;
  python_version: string;
  bazarr_directory: string;
  bazarr_config_directory: string;
}

export interface BazarrProvider {
  name: string;
  status: string;
  retry: string;
}

export interface BazarrLanguageConfig {
  code2: string;
  code3: string;
  name: string;
  enabled: boolean;
}

export class BazarrClient extends BaseApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  protected async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null; status: number }> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers = new Headers(options.headers);
      headers.set('Accept', 'application/json');
      // Bazarr uses X-API-KEY header
      headers.set('X-API-KEY', this.apiKey);

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          data: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      const data = await response.json() as T;
      return { data, error: null, status: response.status };
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return { data: null, error: 'Request timeout', status: 0 };
        }
        return { data: null, error: err.message, status: 0 };
      }
      
      return { data: null, error: 'Unknown error', status: 0 };
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    const response = await this.get<BazarrStatus>('/api/system/status');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.bazarr_version };
  }

  async getMovieHistory(start = 0, length = 100): Promise<BazarrHistoryResponse | null> {
    const response = await this.get<BazarrHistoryResponse>('/api/movies/history', {
      start,
      length,
    });
    return response.data;
  }

  async getSeriesHistory(start = 0, length = 100): Promise<BazarrHistoryResponse | null> {
    const response = await this.get<BazarrHistoryResponse>('/api/episodes/history', {
      start,
      length,
    });
    return response.data;
  }

  async getProviders(): Promise<BazarrProvider[]> {
    const response = await this.get<BazarrProvider[]>('/api/providers');
    return response.data ?? [];
  }

  async getLanguages(): Promise<BazarrLanguageConfig[]> {
    const response = await this.get<BazarrLanguageConfig[]>('/api/system/languages');
    return response.data ?? [];
  }
}
