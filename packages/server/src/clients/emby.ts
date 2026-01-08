import { BaseApiClient, ApiClientConfig } from './base.js';

// Emby/Jellyfin API types (mostly compatible)
export interface EmbyItem {
  Id: string;
  Name: string;
  ServerId?: string;
  Type: string; // 'Movie' | 'Series' | 'Episode' | etc.
  MediaType?: string;
  RunTimeTicks?: number;
  Path?: string;
  ProductionYear?: number;
  IndexNumber?: number; // Episode number
  ParentIndexNumber?: number; // Season number
  PremiereDate?: string;
  DateCreated?: string;
  Container?: string;
  Overview?: string;
  ParentId?: string;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  ProviderIds?: {
    Tmdb?: string;
    Imdb?: string;
    Tvdb?: string;
  };
  ImageTags?: {
    Primary?: string;
    Thumb?: string;
  };
  UserData?: {
    PlaybackPositionTicks: number;
    PlayCount: number;
    IsFavorite: boolean;
    Played: boolean;
    LastPlayedDate?: string;
  };
  MediaSources?: Array<{
    Id: string;
    Path: string;
    Protocol: string;
    Size?: number;
    Container: string;
    Bitrate?: number;
    MediaStreams?: Array<{
      Type: string;
      Codec: string;
      Language?: string;
      IsDefault?: boolean;
      DisplayTitle?: string;
      Width?: number;
      Height?: number;
      BitRate?: number;
      Channels?: number;
    }>;
  }>;
}

export interface EmbyItemsResponse {
  Items: EmbyItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

export interface EmbySession {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client: string;
  DeviceName: string;
  DeviceId: string;
  ApplicationVersion: string;
  LastActivityDate: string;
  NowPlayingItem?: EmbyItem;
  PlayState?: {
    PositionTicks: number;
    CanSeek: boolean;
    IsPaused: boolean;
    IsMuted: boolean;
    VolumeLevel?: number;
    PlayMethod: string; // 'DirectPlay' | 'Transcode'
    RepeatMode: string;
  };
  PlayableMediaTypes?: string[];
  SupportedCommands?: string[];
  TranscodingInfo?: {
    IsVideoDirect: boolean;
    IsAudioDirect: boolean;
    Container: string;
    VideoCodec: string;
    AudioCodec: string;
    Bitrate: number;
    Width: number;
    Height: number;
    TranscodeReasons: string[];
  };
}

export interface EmbyPlaybackInfo {
  ItemId: string;
  UserId: string;
  PositionTicks: number;
  PlaybackStartTimeTicks: number;
  PlayMethod: string;
  SessionId: string;
  MediaSourceId: string;
  CanSeek: boolean;
  IsPaused: boolean;
  IsMuted: boolean;
}

export interface EmbySystemInfo {
  ServerName: string;
  Version: string;
  ProductName: string;
  OperatingSystem: string;
  Id: string;
  LocalAddress: string;
  WanAddress?: string;
  HasUpdateAvailable: boolean;
  HasPendingRestart: boolean;
}

export interface EmbyUser {
  Id: string;
  Name: string;
  ServerId: string;
  HasPassword: boolean;
  HasConfiguredPassword: boolean;
  EnableAutoLogin: boolean;
}

export interface EmbyPlaybackReportingActivity {
  Id: number;
  DateCreated: string;
  UserId: string;
  UserName: string;
  ItemId: string;
  ItemName: string;
  ItemType: string;
  PlaybackMethod: string;
  ClientName: string;
  DeviceName: string;
  PlayDuration: number;
}

// Native Emby/Jellyfin activity log entry
export interface EmbyActivityLogEntry {
  Id: number;
  Name: string;
  Overview?: string;
  Type: string;
  ItemId?: string;
  Date: string;
  UserId?: string;
  UserPrimaryImageTag?: string;
  Severity: string;
}

// User's played items
export interface EmbyUserItemData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  LastPlayedDate?: string;
  Played: boolean;
  Key: string;
}

export class EmbyClient extends BaseApiClient {
  private isJellyfin: boolean;

  constructor(config: ApiClientConfig & { isJellyfin?: boolean }) {
    super(config);
    this.isJellyfin = config.isJellyfin ?? false;
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
      
      // Emby/Jellyfin can use either X-Emby-Token or api_key param
      if (this.isJellyfin) {
        headers.set('Authorization', `MediaBrowser Token="${this.apiKey}"`);
      } else {
        headers.set('X-Emby-Token', this.apiKey);
      }

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
    const response = await this.get<EmbySystemInfo>('/System/Info');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.Version };
  }

  async getUsers(): Promise<EmbyUser[]> {
    const response = await this.get<EmbyUser[]>('/Users');
    return response.data ?? [];
  }

  async getSessions(): Promise<EmbySession[]> {
    const response = await this.get<EmbySession[]>('/Sessions');
    return response.data ?? [];
  }

  async getItems(params?: {
    userId?: string;
    parentId?: string;
    includeItemTypes?: string[];
    recursive?: boolean;
    startIndex?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'Ascending' | 'Descending';
    fields?: string[];
  }): Promise<EmbyItemsResponse | null> {
    const queryParams: Record<string, string | number> = {};

    if (params?.userId) queryParams.UserId = params.userId;
    if (params?.parentId) queryParams.ParentId = params.parentId;
    if (params?.includeItemTypes) queryParams.IncludeItemTypes = params.includeItemTypes.join(',');
    if (params?.recursive) queryParams.Recursive = 'true';
    if (params?.startIndex !== undefined) queryParams.StartIndex = params.startIndex;
    if (params?.limit) queryParams.Limit = params.limit;
    if (params?.sortBy) queryParams.SortBy = params.sortBy;
    if (params?.sortOrder) queryParams.SortOrder = params.sortOrder;
    if (params?.fields) queryParams.Fields = params.fields.join(',');

    const response = await this.get<EmbyItemsResponse>('/Items', queryParams);
    return response.data;
  }

  async getItem(itemId: string, userId?: string): Promise<EmbyItem | null> {
    const params: Record<string, string> = {};
    if (userId) params.UserId = userId;

    const response = await this.get<EmbyItem>(`/Items/${itemId}`, params);
    return response.data;
  }

  async getMovies(userId: string, startIndex = 0, limit = 100): Promise<EmbyItemsResponse | null> {
    return this.getItems({
      userId,
      includeItemTypes: ['Movie'],
      recursive: true,
      startIndex,
      limit,
      sortBy: 'DateCreated',
      sortOrder: 'Descending',
      fields: ['ProviderIds', 'MediaSources', 'UserData', 'Path'],
    });
  }

  async getSeries(userId: string, startIndex = 0, limit = 100): Promise<EmbyItemsResponse | null> {
    return this.getItems({
      userId,
      includeItemTypes: ['Series'],
      recursive: true,
      startIndex,
      limit,
      sortBy: 'DateCreated',
      sortOrder: 'Descending',
      fields: ['ProviderIds', 'UserData'],
    });
  }

  async getEpisodes(userId: string, seriesId: string, startIndex = 0, limit = 100): Promise<EmbyItemsResponse | null> {
    return this.getItems({
      userId,
      parentId: seriesId,
      includeItemTypes: ['Episode'],
      recursive: true,
      startIndex,
      limit,
      sortBy: 'SortName',
      sortOrder: 'Ascending',
      fields: ['ProviderIds', 'MediaSources', 'UserData', 'Path'],
    });
  }

  // Get recently played items (requires Playback Reporting plugin for full history)
  async getRecentlyPlayed(userId: string, limit = 50): Promise<EmbyItemsResponse | null> {
    return this.getItems({
      userId,
      includeItemTypes: ['Movie', 'Episode'],
      recursive: true,
      limit,
      sortBy: 'DatePlayed',
      sortOrder: 'Descending',
      fields: ['ProviderIds', 'UserData'],
    });
  }

  // Get playback activity from Playback Reporting plugin (if installed)
  async getPlaybackActivity(startDate?: string, endDate?: string, limit = 100): Promise<EmbyPlaybackReportingActivity[] | null> {
    const params: Record<string, string | number> = { limit };
    if (startDate) params.StartDate = startDate;
    if (endDate) params.EndDate = endDate;

    // This endpoint is from the Playback Reporting plugin
    const response = await this.get<{ Items: EmbyPlaybackReportingActivity[] }>('/user_usage_stats/PlayActivity', params);
    return response.data?.Items ?? null;
  }

  // Get activity log (built-in to Emby/Jellyfin - includes playback events)
  async getActivityLog(startIndex = 0, limit = 100, minDate?: string): Promise<{ Items: EmbyActivityLogEntry[]; TotalRecordCount: number } | null> {
    const params: Record<string, string | number> = {
      StartIndex: startIndex,
      Limit: limit,
      HasUserId: 'true', // Only get user activities
    };
    if (minDate) params.MinDate = minDate;

    const response = await this.get<{ Items: EmbyActivityLogEntry[]; TotalRecordCount: number }>('/System/ActivityLog/Entries', params);
    return response.data;
  }

  // Get user info by ID
  async getUser(userId: string): Promise<EmbyUser | null> {
    const response = await this.get<EmbyUser>(`/Users/${userId}`);
    return response.data;
  }

  // Get ALL items with their UserData (played status, play count, last played date)
  async getPlayedItems(userId: string, startIndex = 0, limit = 100): Promise<EmbyItemsResponse | null> {
    const params: Record<string, string | number> = {
      UserId: userId,
      IncludeItemTypes: 'Movie,Episode',
      Recursive: 'true',
      StartIndex: startIndex,
      Limit: limit,
      SortBy: 'DatePlayed',
      SortOrder: 'Descending',
      Filters: 'IsPlayed', // Only get played items
      Fields: 'ProviderIds,UserData,Path,RunTimeTicks,SeriesId,SeriesName,ParentIndexNumber,IndexNumber',
    };

    const response = await this.get<EmbyItemsResponse>('/Items', params);
    return response.data;
  }

  // Get all users to aggregate playback across all accounts
  async getAllUsers(): Promise<EmbyUser[]> {
    const response = await this.get<EmbyUser[]>('/Users');
    return response.data ?? [];
  }
}
