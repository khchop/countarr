import { BaseApiClient, ApiClientConfig } from './base.js';

// Jellyseerr API types
export interface JellyseerrRequest {
  id: number;
  status: number; // 1 = pending, 2 = approved, 3 = declined, 4 = available
  createdAt: string;
  updatedAt: string;
  type: 'movie' | 'tv';
  is4k: boolean;
  serverId?: number;
  profileId?: number;
  rootFolder?: string;
  languageProfileId?: number;
  tags?: number[];
  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    imdbId?: string;
    mediaType: 'movie' | 'tv';
    status: number;
    status4k: number;
    createdAt: string;
    updatedAt: string;
    mediaInfo?: {
      id: number;
      tmdbId: number;
    };
    externalServiceId?: number;
    externalServiceId4k?: number;
    externalServiceSlug?: string;
    externalServiceSlug4k?: string;
    plexUrl?: string;
    serviceUrl?: string;
  };
  seasons?: Array<{
    id: number;
    seasonNumber: number;
    status: number;
    status4k: number;
    createdAt: string;
    updatedAt: string;
  }>;
  requestedBy: {
    id: number;
    email: string;
    username?: string;
    displayName: string;
    avatar?: string;
    createdAt: string;
    updatedAt: string;
  };
  modifiedBy?: {
    id: number;
    email: string;
    username?: string;
    displayName: string;
  };
}

export interface JellyseerrRequestsResponse {
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
  results: JellyseerrRequest[];
}

export interface JellyseerrStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
}

export interface JellyseerrMediaDetails {
  id: number;
  title?: string;
  name?: string;
  originalTitle?: string;
  originalName?: string;
  adult?: boolean;
  backdropPath?: string;
  posterPath?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  mediaType: 'movie' | 'tv';
  mediaInfo?: {
    id: number;
    tmdbId: number;
    status: number;
    status4k: number;
    createdAt: string;
    updatedAt: string;
    requests?: JellyseerrRequest[];
  };
}

// Status mapping
export const JELLYSEERR_STATUS = {
  PENDING: 1,
  APPROVED: 2,
  DECLINED: 3,
  AVAILABLE: 4,
  PARTIALLY_AVAILABLE: 5,
} as const;

export const JELLYSEERR_MEDIA_STATUS = {
  UNKNOWN: 1,
  PENDING: 2,
  PROCESSING: 3,
  PARTIALLY_AVAILABLE: 4,
  AVAILABLE: 5,
} as const;

export class JellyseerrClient extends BaseApiClient {
  constructor(config: ApiClientConfig) {
    super(config);
  }

  async testConnection(): Promise<{ success: boolean; error?: string; version?: string }> {
    const response = await this.get<JellyseerrStatus>('/api/v1/status');
    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, version: response.data?.version };
  }

  async getRequests(page = 1, pageSize = 100, filter?: 'all' | 'pending' | 'approved' | 'available'): Promise<JellyseerrRequestsResponse | null> {
    const params: Record<string, string | number> = {
      take: pageSize,
      skip: (page - 1) * pageSize,
      sort: 'added',
    };

    if (filter && filter !== 'all') {
      params.filter = filter;
    }

    const response = await this.get<JellyseerrRequestsResponse>('/api/v1/request', params);
    return response.data;
  }

  async getRequestCount(): Promise<{ pending: number; approved: number; available: number } | null> {
    const response = await this.get<{ pending: number; approved: number; available: number }>('/api/v1/request/count');
    return response.data;
  }

  async getMediaDetails(mediaType: 'movie' | 'tv', tmdbId: number): Promise<JellyseerrMediaDetails | null> {
    const response = await this.get<JellyseerrMediaDetails>(`/api/v1/${mediaType}/${tmdbId}`);
    return response.data;
  }
}
